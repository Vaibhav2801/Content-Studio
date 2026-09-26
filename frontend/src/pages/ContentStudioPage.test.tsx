import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { linkedinApi, LinkedInApiError } from '../api/linkedin'
import { contentOnboardingApi } from '../api/contentOnboarding'
import { contentStudioApi } from '../api/contentStudio'
import { contentStudioMockApprovals, contentStudioMockCalendar, contentStudioMockConnections, contentStudioMockHome, contentStudioMockLibrary } from '../api/contentStudioMock'
import { contentOnboardingMock, linkedinMockDashboard } from '../api/linkedinMock'
import { socialComposerApi } from '../api/socialComposer'
import { makeDemoPost, socialComposerMockOptions } from '../api/socialComposerMock'
import { ContentApprovalsView } from '../components/content/views/ContentApprovalsView'
import { ContentCalendarView } from '../components/content/views/ContentCalendarView'
import { ContentConnectionsView } from '../components/content/views/ContentConnectionsView'
import { ContentCreateView } from '../components/content/views/ContentCreateView'
import { ContentSeriesView } from '../components/content/views/ContentSeriesView'
import { ContentHomeView } from '../components/content/views/ContentHomeView'
import { ContentLibraryView } from '../components/content/views/ContentLibraryView'
import { ContentSettingsView } from '../components/content/views/ContentSettingsView'
import { ContentStudioPage } from './ContentStudioPage'

function renderStudio(path = '/content') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="content" element={<ContentStudioPage />}>
      <Route index element={<ContentHomeView />} />
      <Route path="create" element={<ContentCreateView />} />
      <Route path="series" element={<ContentSeriesView />} />
      <Route path="approvals" element={<ContentApprovalsView />} />
      <Route path="calendar" element={<ContentCalendarView />} />
      <Route path="library" element={<ContentLibraryView />} />
      <Route path="connections" element={<ContentConnectionsView />} />
      <Route path="settings" element={<ContentSettingsView />} />
    </Route>
    <Route path="linkedin/*" element={<Navigate to="/content" replace />} />
  </Routes></MemoryRouter>)
}

describe('Visiofy Studio', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
    localStorage.clear()
    vi.spyOn(linkedinApi, 'dashboard').mockResolvedValue(structuredClone(linkedinMockDashboard))
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(structuredClone(contentOnboardingMock))
    vi.spyOn(contentStudioApi, 'home').mockResolvedValue(structuredClone(contentStudioMockHome))
    vi.spyOn(contentStudioApi, 'approvals').mockResolvedValue(structuredClone(contentStudioMockApprovals))
    vi.spyOn(contentStudioApi, 'calendar').mockResolvedValue(structuredClone(contentStudioMockCalendar))
    vi.spyOn(contentStudioApi, 'library').mockResolvedValue(structuredClone(contentStudioMockLibrary))
    vi.spyOn(contentStudioApi, 'connections').mockResolvedValue(structuredClone(contentStudioMockConnections))
    vi.spyOn(socialComposerApi, 'options').mockResolvedValue(structuredClone(socialComposerMockOptions))
    vi.spyOn(socialComposerApi, 'getPost').mockImplementation(async () => makeDemoPost('Loaded draft', 'Saved draft copy', ['LINKEDIN']))
    vi.spyOn(socialComposerApi, 'createDraft').mockImplementation(async (payload) => makeDemoPost(payload.idea_title, payload.idea_text, payload.networks))
    vi.spyOn(socialComposerApi, 'updatePost').mockImplementation(async () => makeDemoPost('Saved', 'Saved copy', ['LINKEDIN']))
    vi.spyOn(socialComposerApi, 'updateVariant').mockImplementation(async () => makeDemoPost('Saved', 'Saved copy', ['LINKEDIN']))
    vi.spyOn(socialComposerApi, 'rewrite').mockImplementation(async () => makeDemoPost('Rewritten', 'A shorter personal version.', ['LINKEDIN']))
    vi.spyOn(socialComposerApi, 'submitForReview').mockImplementation(async () => ({ ...makeDemoPost('Review', 'Ready to review', ['LINKEDIN']), state: 'NEEDS_REVIEW' }))
  })

  it('shows the compact sidebar and keeps creation actions in one place', async () => {
    renderStudio()
    expect(await screen.findByRole('heading', { name: 'Visiofy Studio' })).toBeInTheDocument()
    const navigation = screen.getByRole('navigation', { name: 'Visiofy Studio sections' })
    for (const label of ['Home', 'Create', 'Approvals', 'Calendar', 'Content Library', 'Connections', 'Analytics']) {
      expect(navigation).toHaveTextContent(label)
    }
    expect(navigation).not.toHaveTextContent('Settings')
    expect(screen.queryByRole('link', { name: /^Create post/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /new post/i })).toHaveLength(1)
    expect(screen.getByRole('link', { name: /new post/i })).toHaveAttribute('href', '/content/create?new=1')
    cleanup()
    renderStudio('/content/library')
    await screen.findByRole('heading', { name: 'Content Library' })
    expect(screen.queryByRole('link', { name: /new post/i })).not.toBeInTheDocument()
  })

  it('creates a reviewable sequence from one series brief', async () => {
    const first = { ...makeDemoPost('Launch guide — Part 1', 'First lesson', ['LINKEDIN']), id: 'series-1' }
    const second = { ...makeDemoPost('Launch guide — Part 2', 'Second lesson', ['LINKEDIN']), id: 'series-2' }
    vi.spyOn(socialComposerApi, 'generateSeries').mockResolvedValue({ posts: [first, second] })
    renderStudio('/content/series')
    expect(await screen.findByRole('heading', { name: 'Plan a content series' })).toBeInTheDocument()
    await screen.findByRole('checkbox', { name: /LinkedIn/i })
    fireEvent.change(screen.getByLabelText('Series title'), { target: { value: 'Launch guide' } })
    fireEvent.change(screen.getByLabelText('Series brief'), { target: { value: 'Explain how to onboard new users in stages.' } })
    fireEvent.change(screen.getByLabelText('Number of posts'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create 2 drafts' }))
    await waitFor(() => expect(socialComposerApi.generateSeries).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Launch guide', count: 2, interval_days: 7, prompt: 'Explain how to onboard new users in stages.',
    })))
    expect(await screen.findByRole('heading', { name: '2 drafts are ready' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Launch guide — Part 1/i })).toHaveAttribute('href', '/content/create?draft=series-1')
  })

  it('supports per-post breakdown customization, approval, and scheduling in the series workspace', async () => {
    const first = { ...makeDemoPost('Product Design — Part 1', 'First lesson', ['LINKEDIN']), id: 'series-1' }
    const second = { ...makeDemoPost('Product Design — Part 2', 'Second lesson', ['LINKEDIN']), id: 'series-2' }
    vi.spyOn(socialComposerApi, 'generateSeries').mockResolvedValue({ posts: [first, second] })
    vi.spyOn(socialComposerApi, 'approveVariant').mockResolvedValue({ variant_id: 'v-1', approved_version_id: 'av-1', version: 1, status: 'APPROVED' })
    vi.spyOn(socialComposerApi, 'schedule').mockResolvedValue({ ...first, state: 'SCHEDULED' })

    renderStudio('/content/series')
    expect(await screen.findByRole('heading', { name: 'Plan a content series' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Series title'), { target: { value: 'Product Design 101' } })
    fireEvent.change(screen.getByLabelText('Series brief'), { target: { value: 'A sequence on modern design principles.' } })
    fireEvent.change(screen.getByLabelText('Number of posts'), { target: { value: '2' } })

    // Save draft on Step 1
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))

    // Move to Step 3: Post Breakdown
    fireEvent.click(screen.getByRole('button', { name: /Post Breakdown/i }))
    expect(await screen.findByRole('heading', { name: /Post-by-Post Breakdown & Angles/i })).toBeInTheDocument()

    // Test auto-fill starter breakdown
    fireEvent.click(screen.getByRole('button', { name: /Auto-fill starter breakdown/i }))
    expect(screen.getByDisplayValue(/Part 1: The Core Challenge/i)).toBeInTheDocument()

    // Test customizing a specific post's angle and takeaway
    fireEvent.change(screen.getByDisplayValue(/Part 1: The Core Challenge/i), {
      target: { value: 'Part 1: Discovering User Needs' },
    })
    const textareas = screen.getAllByPlaceholderText(/What key point, lesson, or story/i)
    fireEvent.change(textareas[0], {
      target: { value: 'Deep user interviews before wireframing' },
    })

    // Generate series from Step 3
    fireEvent.click(screen.getByRole('button', { name: 'Create 2 drafts' }))
    await waitFor(() => expect(socialComposerApi.generateSeries).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Product Design 101',
      count: 2,
      items: expect.arrayContaining([
        expect.objectContaining({
          idea_title: 'Part 1: Discovering User Needs',
          idea_text: 'Deep user interviews before wireframing',
        }),
      ]),
    })))

    expect(await screen.findByRole('heading', { name: '2 drafts are ready' })).toBeInTheDocument()

    // Test approving post
    fireEvent.click(screen.getByRole('button', { name: /Approve Part/i }))
    await waitFor(() => expect(socialComposerApi.approveVariant).toHaveBeenCalled())

    // Test scheduling post
    fireEvent.click(screen.getByRole('button', { name: /Schedule Part/i }))
    await waitFor(() => expect(socialComposerApi.schedule).toHaveBeenCalledWith('series-1'))
  })

  it('allows saving draft campaigns and opening saved drafts to resume progress', async () => {
    renderStudio('/content/series')
    expect(await screen.findByRole('heading', { name: 'Plan a content series' })).toBeInTheDocument()

    // Fill in Step 1
    fireEvent.change(screen.getByLabelText('Series title'), { target: { value: 'SaaS Marketing Secrets' } })
    fireEvent.change(screen.getByLabelText('Series brief'), { target: { value: 'Growth strategies for early-stage B2B.' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))

    // Open Saved Drafts modal
    fireEvent.click(screen.getByRole('button', { name: /^Saved Drafts/i }))
    expect(await screen.findByRole('heading', { name: 'Saved Series Drafts' })).toBeInTheDocument()
    expect(screen.getByText('SaaS Marketing Secrets')).toBeInTheDocument()

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))

    // Start fresh
    fireEvent.click(screen.getByRole('button', { name: 'Start New' }))
    expect(screen.getByLabelText('Series title')).toHaveValue('')

    // Reopen modal and resume
    fireEvent.click(screen.getByRole('button', { name: /^Saved Drafts/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }))
    expect(screen.getByLabelText('Series title')).toHaveValue('SaaS Marketing Secrets')
  })

  it('shows the generic composer controls and connected networks', async () => {
    renderStudio('/content/create')
    expect(await screen.findByText('Start with what you have')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Write manually' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Generate with AI' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('checkbox', { name: /LinkedIn/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /@lumadesk · Profile/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Create a series automatically/i })).toHaveAttribute('href', '/content/series')
    expect(screen.getByRole('button', { name: /^Generate$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Schedule post/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send for approval/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Write manually' }))
    expect(screen.getByRole('button', { name: /Start writing/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Generate$/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('What is the idea?')).not.toBeInTheDocument()
  })

  it('fills a new post from a quick-start idea', async () => {
    renderStudio('/content/create?new=1')
    fireEvent.click(await screen.findByRole('button', { name: 'Common question' }))
    expect(screen.getByLabelText('Working title')).toHaveValue('Answer a common customer question')
    expect((screen.getByLabelText('What is the idea?') as HTMLTextAreaElement).value).toContain('question our customers often ask')
    expect(screen.queryByRole('button', { name: 'Common question' })).not.toBeInTheDocument()
  })

  it('navigates directly to Calendar, billing Settings, and Brand in the Library', async () => {
    renderStudio('/content/create')
    await screen.findByText('Start with what you have')
    fireEvent.click(screen.getByRole('link', { name: /^calendar$/i }))
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Open Visiofy Studio settings/i }))
    expect(screen.getByRole('heading', { name: 'Your account and workspace' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Brand and business' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /^content library$/i }))
    fireEvent.click(await screen.findByRole('link', { name: /Brand & Publishing/i }))
    expect(await screen.findByRole('heading', { name: 'Brand and business' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('LumaDesk')).toBeInTheDocument()
    const advanced = screen.getByText('Advanced workspace settings').closest('details')
    expect(advanced).toBeInTheDocument()
    expect(advanced).not.toHaveAttribute('open')
  })

  it('asks for workspace business details on first Create and allows skipping', async () => {
    const missingProfile = {
      ...structuredClone(contentOnboardingMock),
      business: { name: 'Your business', description: '', audience: '', language: 'English' },
      business_profile_configured: false,
      business_prompt_skipped: false,
    }
    vi.mocked(contentOnboardingApi.get).mockResolvedValue(missingProfile)
    vi.spyOn(contentOnboardingApi, 'saveBusinessProfile').mockResolvedValue({ ...missingProfile, business_prompt_skipped: true })
    renderStudio('/content/create')

    expect(await screen.findByRole('heading', { name: 'Tell us about this business' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))

    await waitFor(() => expect(contentOnboardingApi.saveBusinessProfile).toHaveBeenCalledWith({ skip: true }))
    expect(await screen.findByRole('heading', { name: 'Start with what you have' })).toBeInTheDocument()
  })

  it('generates separate platform drafts from a fresh idea', async () => {
    const generated = makeDemoPost('Customer onboarding', 'New customer onboarding workflow', ['LINKEDIN', 'X'])
    vi.spyOn(socialComposerApi, 'generate').mockResolvedValue(generated)
    renderStudio('/content/create')
    await screen.findByText('Start with what you have')
    fireEvent.change(screen.getByPlaceholderText(/Share the point/i), { target: { value: 'New customer onboarding workflow' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /@lumadesk · Profile/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/i }))
    await waitFor(() => expect(socialComposerApi.generate).toHaveBeenCalledWith(expect.objectContaining({ idea_text: 'New customer onboarding workflow', networks: ['LINKEDIN', 'X'] })))
    expect(await screen.findByText('Created 2 platform-specific drafts.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'LinkedIn' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'X' })).toBeInTheDocument()
  })

  it('starts a blank post from Home while Create remains resumable', async () => {
    renderStudio('/content/create')
    fireEvent.change(await screen.findByPlaceholderText(/Share the point/i), { target: { value: 'Saved unfinished idea' } })
    fireEvent.click(screen.getByRole('link', { name: /^home$/i }))
    await screen.findByRole('heading', { name: 'Visiofy Studio' })
    fireEvent.click(screen.getByRole('link', { name: /^create$/i }))
    expect(await screen.findByDisplayValue('Saved unfinished idea')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /^home$/i }))
    await screen.findByRole('heading', { name: 'Visiofy Studio' })
    fireEvent.click(screen.getByRole('link', { name: /new post/i }))
    expect(await screen.findByPlaceholderText(/Share the point/i)).toHaveValue('')
  })

  it('restores the active post when leaving Create during generation', async () => {
    const draft = { ...makeDemoPost('Routefloww launch', 'Explain the route planning feature.', ['LINKEDIN']), id: 'recoverable-draft' }
    draft.variants = draft.variants.map((variant) => ({ ...variant, copy: '' }))
    const generated = { ...makeDemoPost('Routefloww launch', 'Explain the route planning feature.', ['LINKEDIN']), id: draft.id }
    let finishGeneration: (post: typeof generated) => void = () => {}
    let complete = false
    vi.mocked(socialComposerApi.createDraft).mockResolvedValue(draft)
    vi.mocked(socialComposerApi.getPost).mockImplementation(async () => complete ? generated : draft)
    vi.spyOn(socialComposerApi, 'generate').mockImplementation(() => new Promise((resolve) => { finishGeneration = resolve }))

    renderStudio('/content/create')
    fireEvent.change(await screen.findByPlaceholderText(/Share the point/i), { target: { value: 'Explain the route planning feature.' } })
    fireEvent.change(screen.getByPlaceholderText(/For example: A simpler onboarding/i), { target: { value: 'Routefloww launch' } })
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/i }))
    await waitFor(() => expect(socialComposerApi.generate).toHaveBeenCalledWith(expect.objectContaining({ post_id: draft.id })))
    fireEvent.click(screen.getByRole('link', { name: /^calendar$/i }))
    await screen.findByRole('heading', { name: 'Calendar' })
    fireEvent.click(screen.getByRole('link', { name: /^create$/i }))
    expect(await screen.findByDisplayValue('Explain the route planning feature.')).toBeInTheDocument()
    expect(await screen.findByText('Creating your platform drafts')).toBeInTheDocument()

    complete = true
    finishGeneration(generated)
    expect(await screen.findByRole('region', { name: 'LinkedIn editor' }, { timeout: 5000 })).toHaveTextContent('Routefloww launch')
    expect(screen.getByDisplayValue('Routefloww launch')).toBeInTheDocument()
  })

  it('recovers the draft after leaving before the first save finishes', async () => {
    const draft = { ...makeDemoPost('Quick navigation', 'A post in progress.', ['LINKEDIN']), id: 'quick-navigation-draft' }
    draft.variants = draft.variants.map((variant) => ({ ...variant, copy: '' }))
    const generated = { ...makeDemoPost('Quick navigation', 'A post in progress.', ['LINKEDIN']), id: draft.id }
    let finishSave: (post: typeof draft) => void = () => {}
    let finishGeneration: (post: typeof generated) => void = () => {}
    vi.mocked(socialComposerApi.createDraft).mockImplementation(() => new Promise((resolve) => { finishSave = resolve }))
    vi.mocked(socialComposerApi.getPost).mockResolvedValue(draft)
    vi.spyOn(socialComposerApi, 'generate').mockImplementation(() => new Promise((resolve) => { finishGeneration = resolve }))

    renderStudio('/content/create')
    fireEvent.change(await screen.findByPlaceholderText(/Share the point/i), { target: { value: 'A post in progress.' } })
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/i }))
    await waitFor(() => expect(socialComposerApi.createDraft).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('link', { name: /^calendar$/i }))
    await screen.findByRole('heading', { name: 'Calendar' })
    fireEvent.click(screen.getByRole('link', { name: /^create$/i }))
    expect(await screen.findByDisplayValue('A post in progress.')).toBeInTheDocument()

    finishSave(draft)
    await waitFor(() => expect(socialComposerApi.generate).toHaveBeenCalledWith(expect.objectContaining({ post_id: draft.id })))
    expect(await screen.findByText('Creating your platform drafts')).toBeInTheDocument()
    finishGeneration(generated)
  })

  it('starts from a saved source or reopens an existing draft', async () => {
    vi.mocked(socialComposerApi.options).mockResolvedValue({
      ...structuredClone(socialComposerMockOptions),
      drafts: [{ id: 'draft-1', idea_title: 'Existing campaign', state: 'DRAFT', networks: ['LINKEDIN'], updated_at: new Date().toISOString() }],
    })
    vi.spyOn(socialComposerApi, 'generate').mockResolvedValue(makeDemoPost('Saved source', 'Source copy', ['LINKEDIN']))
    renderStudio('/content/create')
    fireEvent.click(await screen.findByRole('tab', { name: 'Saved source' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Customer onboarding notes/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/i }))
    await waitFor(() => expect(socialComposerApi.generate).toHaveBeenCalledWith(expect.objectContaining({ source_ids: ['source-1'] })))
    fireEvent.click(screen.getByRole('tab', { name: 'Existing draft' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose a draft' }), { target: { value: 'draft-1' } })
    await waitFor(() => expect(socialComposerApi.getPost).toHaveBeenCalledWith('draft-1'))
  })

  it('offers direct writing actions and autosaves edited platform copy', async () => {
    const generated = makeDemoPost('Customer onboarding', 'One useful onboarding lesson.', ['LINKEDIN'])
    vi.spyOn(socialComposerApi, 'generate').mockResolvedValue(generated)
    renderStudio('/content/create')
    fireEvent.change(await screen.findByPlaceholderText(/Share the point/i), { target: { value: 'One useful onboarding lesson.' } })
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/i }))
    const editor = await screen.findByRole('region', { name: 'LinkedIn editor' })
    expect(editor).toHaveTextContent('Make shorter')
    const copy = screen.getByRole('textbox', { name: /Post text/i })
    fireEvent.change(copy, { target: { value: 'Edited platform copy.' } })
    expect(screen.getAllByText(/Unsaved/).length).toBeGreaterThan(0)
    await waitFor(() => expect(socialComposerApi.updateVariant).toHaveBeenCalled(), { timeout: 2500 })
  })

  it('shows backend errors instead of silently loading demo data', async () => {
    vi.spyOn(linkedinApi, 'dashboard').mockRejectedValue(new LinkedInApiError('Authentication is required'))
    renderStudio()
    expect(await screen.findByRole('alert')).toHaveTextContent('Authentication is required')
    expect(screen.queryByText('LumaDesk')).not.toBeInTheDocument()
  })

  it('redirects the old LinkedIn route to Visiofy Studio home', async () => {
    renderStudio('/linkedin')
    expect(await screen.findByRole('heading', { name: 'Visiofy Studio' })).toBeInTheDocument()
  })
})
