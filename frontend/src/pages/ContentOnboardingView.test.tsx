import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contentOnboardingApi, ContentOnboardingApiError } from '../api/contentOnboarding'
import { linkedinApi } from '../api/linkedin'
import { contentOnboardingMock, linkedinMockDashboard } from '../api/linkedinMock'
import { ContentHomeView } from '../components/content/views/ContentHomeView'
import { ContentOnboardingView } from '../components/content/views/ContentOnboardingView'
import type { ContentStudioOnboarding } from '../types/content'
import { ContentStudioPage } from './ContentStudioPage'

const inProgress = (overrides: Partial<ContentStudioOnboarding> = {}): ContentStudioOnboarding => ({
  ...structuredClone(contentOnboardingMock),
  status: 'IN_PROGRESS',
  current_step: 1,
  completed_steps: [],
  draft_only_mode: false,
  first_post_id: '',
  connection: { connected: false, display_name: '', account_type: '', health: 'NOT_CONNECTED', message: '' },
  ...overrides,
})

function renderOnboarding(path = '/content') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="content" element={<ContentStudioPage />}><Route index element={<ContentHomeView />} /><Route path="onboarding" element={<ContentOnboardingView />} /></Route></Routes></MemoryRouter>)
}

describe('Visiofy Studio onboarding', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(linkedinApi, 'dashboard').mockResolvedValue(structuredClone(linkedinMockDashboard))
    vi.spyOn(contentOnboardingApi, 'start').mockResolvedValue(inProgress())
    vi.spyOn(contentOnboardingApi, 'setCurrentStep').mockImplementation(async (step) => inProgress({ current_step: step }))
    vi.spyOn(contentOnboardingApi, 'completeStep').mockImplementation(async (step) => inProgress({ current_step: Math.min(4, step + 1), completed_steps: [step] }))
    vi.spyOn(contentOnboardingApi, 'startConnection').mockResolvedValue({ authorization_url: 'https://social.example/connect', expires_at: new Date().toISOString() })
    vi.spyOn(contentOnboardingApi, 'completeConnection').mockResolvedValue(inProgress())
    vi.spyOn(contentOnboardingApi, 'cancelConnection').mockResolvedValue(inProgress())
  })

  it('opens Home without forcing the four-step wizard on first use', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress({ status: 'NOT_STARTED' }))
    renderOnboarding()
    expect(await screen.findByRole('heading', { name: 'Good content starts here.' }, { timeout: 5000 })).toBeInTheDocument()
    expect(contentOnboardingApi.start).not.toHaveBeenCalled()
    expect(screen.queryByText('Step 1 of 4')).not.toBeInTheDocument()
  })

  it('goes back to saved business data without losing it', async () => {
    const saved = inProgress({
      current_step: 3,
      completed_steps: [1, 2],
      business: { name: 'Saved Co', description: 'Saved description', audience: 'Saved audience', language: 'English' },
    })
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(saved)
    vi.mocked(contentOnboardingApi.setCurrentStep).mockResolvedValue({ ...saved, current_step: 2 })
    renderOnboarding('/content/onboarding')
    fireEvent.click(await screen.findByRole('button', { name: /^Back$/i }))
    expect(await screen.findByDisplayValue('Saved Co')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Saved audience')).toBeInTheDocument()
  })

  it('recovers the current step and entered values after refresh', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress({
      current_step: 2,
      completed_steps: [1],
      business: { name: 'Refresh Co', description: 'Recovered description', audience: 'Recovered audience', language: 'English' },
    }))
    renderOnboarding('/content/onboarding')
    expect(await screen.findByDisplayValue('Refresh Co')).toBeInTheDocument()
    expect(screen.getAllByText('Step 2 of 4').length).toBeGreaterThan(0)
  })

  it('shows saving feedback and prevents a second setup submission', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress({
      current_step: 2,
      completed_steps: [1],
      business: { name: 'RouteFloww', description: 'Route planning', audience: 'Dispatch teams', language: 'English' },
    }))
    let finishSaving!: (value: ContentStudioOnboarding) => void
    vi.mocked(contentOnboardingApi.completeStep).mockImplementationOnce(
      () => new Promise<ContentStudioOnboarding>((resolve) => { finishSaving = resolve }),
    )
    renderOnboarding('/content/onboarding')
    const save = await screen.findByRole('button', { name: 'Save and continue' })
    fireEvent.click(save)
    const saving = await screen.findByRole('button', { name: 'Saving…' })
    expect(saving).toBeDisabled()
    expect(saving).toHaveAttribute('aria-busy', 'true')
    expect(saving).toHaveClass('studio-click-feedback')
    expect(contentOnboardingApi.completeStep).toHaveBeenCalledTimes(1)
    finishSaving(inProgress({ current_step: 3, completed_steps: [1, 2] }))
    expect(await screen.findByRole('heading', { name: 'Set a posting schedule' })).toBeInTheDocument()
  })

  it('saves a posting schedule without asking for content topics', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress({
      current_step: 3,
      completed_steps: [1, 2],
    }))
    renderOnboarding('/content/onboarding')
    expect(await screen.findByRole('heading', { name: 'Set a posting schedule' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/content topics/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(contentOnboardingApi.completeStep).toHaveBeenCalledWith(3, expect.objectContaining({
      posting_days: expect.any(Array),
      time: expect.any(String),
      timezone: expect.any(String),
    })))
    expect(vi.mocked(contentOnboardingApi.completeStep).mock.calls[0][1]).not.toHaveProperty('topics')
  })

  it('does not show an incomplete setup checklist on Visiofy Studio Home', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress({ current_step: 3, completed_steps: [1, 2] }))
    renderOnboarding()
    expect(await screen.findByRole('heading', { name: 'Good content starts here.' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Finish setting up Visiofy Studio' })).not.toBeInTheDocument()
  })

  it('shows connected account name, type and health after success', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress({ connection: {
      connected: true,
      display_name: 'LumaDesk Company Page',
      account_type: 'Company Page',
      health: 'HEALTHY',
      message: 'Connection healthy',
    } }))
    renderOnboarding('/content/onboarding')
    expect(await screen.findByText('LumaDesk Company Page')).toBeInTheDocument()
    expect(screen.getByText(/Company Page · Connection healthy/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
  })

  it('recovers cleanly when authorization is cancelled', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress())
    vi.mocked(contentOnboardingApi.completeConnection).mockResolvedValue(inProgress({ connection: {
      connected: false, display_name: '', account_type: '', health: 'NEEDS_ATTENTION', message: 'The connection was cancelled. You can reconnect when ready.',
    } }))
    renderOnboarding('/content/onboarding?state=return-state&connect_status=cancelled')
    expect((await screen.findAllByText(/connection was cancelled/i)).length).toBeGreaterThan(0)
    expect(contentOnboardingApi.completeConnection).toHaveBeenCalledWith(expect.objectContaining({ cancelled: true }))
  })

  it('reports a provider connection failure without treating it as a successful return', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress())
    vi.mocked(contentOnboardingApi.completeConnection).mockResolvedValue(inProgress())
    renderOnboarding('/content/onboarding?state=return-state&connect_status=error&error_code=oauth_failed')
    await waitFor(() => expect(contentOnboardingApi.completeConnection).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'return-state', error: 'connection_failed', cancelled: false }),
    ))
  })

  it('shows a plain failure and offers reconnect', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress({ connection: {
      connected: false, display_name: 'Expired Page', account_type: 'Company Page', health: 'NEEDS_ATTENTION', message: 'Access expired. Reconnect to continue.',
    } }))
    vi.mocked(contentOnboardingApi.startConnection).mockRejectedValue(new ContentOnboardingApiError('LinkedIn connection is temporarily unavailable.'))
    renderOnboarding('/content/onboarding')
    fireEvent.click(await screen.findByRole('button', { name: 'Reconnect' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('LinkedIn connection is temporarily unavailable.')
    expect(screen.queryByText(/Upload Post|Zernio/i)).not.toBeInTheDocument()
  })

  it('lets the user choose a personal LinkedIn profile or Company Page after OAuth', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress())
    vi.spyOn(contentOnboardingApi, 'connectionChoices').mockResolvedValue({ accounts: [
      { id: 'personal', name: 'Onboarding Member', vanity_name: 'member', account_type: 'PERSON' },
      { id: '123', name: 'First Page', vanity_name: 'first-page', account_type: 'ORGANIZATION' },
      { id: '456', name: 'Routefloww', vanity_name: 'routefloww', account_type: 'ORGANIZATION' },
    ] })
    vi.spyOn(contentOnboardingApi, 'selectConnection').mockResolvedValue(inProgress({ connection: {
      connected: true, display_name: 'Onboarding Member', account_type: 'Profile', health: 'HEALTHY', message: 'Connection healthy',
    } }))
    renderOnboarding('/content/onboarding?state=return-state&step=select_organization&pendingDataToken=pending-token&connect_token=short-token')
    expect(await screen.findByRole('heading', { name: 'Choose where to publish' })).toBeInTheDocument()
    expect(screen.getByText('Onboarding Member')).toBeInTheDocument()
    expect(screen.getByText('linkedin.com/in/member')).toBeInTheDocument()
    expect(screen.getByText('Routefloww')).toBeInTheDocument()
    expect(screen.queryByText(/Zernio/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Connect Profile' }))
    await waitFor(() => expect(contentOnboardingApi.selectConnection).toHaveBeenCalledWith({
      state: 'return-state', pending_data_token: 'pending-token', account_type: 'PERSON',
      organization_id: undefined, connect_token: 'short-token',
    }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Choose where to publish' })).not.toBeInTheDocument())
    expect(screen.getByText('Onboarding Member')).toBeInTheDocument()
  })

  it('starts reconnection without showing a vendor choice', async () => {
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(inProgress({ connection: {
      connected: false, display_name: 'Expired Page', account_type: 'Company Page', health: 'NEEDS_ATTENTION', message: 'Reconnect to continue.',
    } }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderOnboarding('/content/onboarding')
    fireEvent.click(await screen.findByRole('button', { name: 'Reconnect' }))
    await waitFor(() => expect(contentOnboardingApi.startConnection).toHaveBeenCalled())
    expect(open).toHaveBeenCalledWith('https://social.example/connect', '_self')
    expect(document.body).not.toHaveTextContent(/Upload Post|Zernio/i)
  })
})
