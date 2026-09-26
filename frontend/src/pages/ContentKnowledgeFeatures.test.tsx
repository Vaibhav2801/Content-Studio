import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contentKnowledgeApi } from '../api/contentKnowledge'
import { contentOnboardingApi } from '../api/contentOnboarding'
import { contentStudioApi } from '../api/contentStudio'
import { billingApi } from '../api/billingApi'
import { contentStudioMockHome, contentStudioMockLibrary } from '../api/contentStudioMock'
import { linkedinApi } from '../api/linkedin'
import { contentOnboardingMock, linkedinMockDashboard } from '../api/linkedinMock'
import { ContentLibraryView } from '../components/content/views/ContentLibraryView'
import { ContentSettingsView } from '../components/content/views/ContentSettingsView'
import type { BrandBrain, ContentSource, StoryInterview } from '../types/contentKnowledge'
import type { PricingCatalog, SubscriptionOverview } from '../types/billing'
import { ContentStudioPage } from './ContentStudioPage'

const brand: BrandBrain = { id: 'brand-1', version: 2, version_id: 'version-2', business_description: 'Helpful software', audience: 'Operations teams', goals: ['Teach'], voice: 'Clear', voice_rules: [], example_posts: [], content_pillars: ['Operations'], calls_to_action: ['Share a lesson'], visual_direction: 'Editorial', forbidden_topics: ['Unsupported claims'], performance_rules: [], suggestions: [{ id: 'suggestion-1', rule: 'Prefer concise posts.', evidence_count: 3 }], updated_at: new Date().toISOString() }
const source: ContentSource = { id: 'source-1', source_type: 'TEXT', label: 'Customer note', text_content: 'A supported insight', source_url: '', original_filename: '', processing_status: 'READY', metadata: {}, owner_name: 'You', updated_at: new Date().toISOString() }
const story: StoryInterview = { id: 'story-1', week_of: '2030-06-10', questions: [{ id: 'moment', label: 'What happened?' }, { id: 'why', label: 'Why did it matter?' }], answers: {}, status: 'IN_PROGRESS', approved_source_id: '', approved_at: null }
const subscription: SubscriptionOverview = {
  tier: 'FREE', role_label: 'Free', is_admin: false, can_manage_billing: true,
  connections: { used: 0, limit: 0, unlimited: false, extra_purchased: 0 },
  credits: { balance: 15, total_allocated: 15, total_used: 0, unlimited: false, cost_per_draft: 2, cost_per_image: 1 },
  engage_entitled: false, scheduling_unlimited: true, transactions: [], invoices: [],
}
const catalog: PricingCatalog = {
  currency: 'USD', credit_costs: { draft: 2, image: 1, image_regeneration: 1 }, simulated_checkout_enabled: false,
  plans: [
    { id: 'free', name: 'Free', product_id: null, price: 0, credits: 15, connections: 0, engage: false },
    { id: 'starter', name: 'Starter', product_id: 'plan_starter_monthly', price: 20, credits: 50, connections: 1, engage: false },
    { id: 'advance', name: 'Advance', product_id: 'plan_advance_monthly', price: 39, credits: 150, connections: 1, engage: true },
  ],
  addons: [],
}

function renderStudio(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="content" element={<ContentStudioPage />}><Route path="library" element={<ContentLibraryView />} /><Route path="settings" element={<ContentSettingsView />} /><Route path="create" element={<div>Create</div>} /><Route index element={<div>Home</div>} /></Route></Routes></MemoryRouter>)
}

describe('Content knowledge features', () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(linkedinApi, 'dashboard').mockResolvedValue(structuredClone(linkedinMockDashboard))
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(structuredClone(contentOnboardingMock))
    vi.spyOn(contentStudioApi, 'home').mockResolvedValue(structuredClone(contentStudioMockHome))
    vi.spyOn(contentStudioApi, 'library').mockResolvedValue(structuredClone(contentStudioMockLibrary))
    vi.spyOn(billingApi, 'getSubscription').mockResolvedValue(structuredClone(subscription))
    vi.spyOn(billingApi, 'getCatalog').mockResolvedValue(structuredClone(catalog))
    vi.spyOn(contentKnowledgeApi, 'brand').mockResolvedValue(structuredClone(brand))
    vi.spyOn(contentKnowledgeApi, 'sources').mockResolvedValue([structuredClone(source)])
    vi.spyOn(contentKnowledgeApi, 'story').mockResolvedValue(structuredClone(story))
  })

  it('keeps source tools and the single Brand profile in the Library', async () => {
    renderStudio('/content/library')
    await screen.findByRole('heading', { name: 'Content Library' })
    for (const label of ['Sources', 'Story Interview', 'Brand & Publishing']) expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    cleanup()
    renderStudio('/content/settings')
    await screen.findByRole('heading', { name: 'Settings' })
    expect(screen.getByRole('tab', { name: /Profile & workspace/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Your account and workspace' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Brand and business' })).not.toBeInTheDocument()
    cleanup()
    renderStudio('/content/library?panel=brand')
    expect(await screen.findByRole('heading', { name: 'Brand and business' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Content style' })).toBeInTheDocument()
  })

  it('shows the Brand version and keeps edit suggestions pending until confirmation', async () => {
    vi.spyOn(contentKnowledgeApi, 'decideSuggestion').mockResolvedValue({ ...brand, version: 3, voice_rules: ['Prefer concise posts.'], suggestions: [] })
    renderStudio('/content/library?panel=brand')
    expect(await screen.findByText('Version 2')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/More brand guidance/i))
    expect(screen.getByText(/Not applied · noticed in 3 draft edits/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Add rule/i }))
    await waitFor(() => expect(contentKnowledgeApi.decideSuggestion).toHaveBeenCalledWith('suggestion-1', 'CONFIRM'))
    expect(await screen.findByText('Version 3')).toBeInTheDocument()
  })

  it('separates profile, plan usage, and invoice history into Settings tabs', async () => {
    renderStudio('/content/settings')
    expect(await screen.findByRole('heading', { name: 'Your account and workspace' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Plan & usage/i }))
    expect(await screen.findByRole('heading', { name: 'Free Plan' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Billing Invoices & Receipts' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Billing history/i }))
    expect(await screen.findByRole('heading', { name: 'Billing Invoices & Receipts' })).toBeInTheDocument()
    expect(screen.getByText(/No billing invoices generated yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Free Plan' })).not.toBeInTheDocument()
  })

  it('adds sources and labels processing state plainly', async () => {
    vi.spyOn(contentKnowledgeApi, 'createSource').mockResolvedValue({ ...source, id: 'source-2', label: 'Interview transcript' })
    renderStudio('/content/library?panel=sources')
    expect(await screen.findByText('Customer note')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Add source/i }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Interview transcript' } })
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'A safe transcript.' } })
    fireEvent.click(screen.getByRole('button', { name: /Save source/i }))
    await waitFor(() => expect(contentKnowledgeApi.createSource).toHaveBeenCalledWith(expect.objectContaining({ label: 'Interview transcript', text_content: 'A safe transcript.' })))
  })

  it('saves and approves the weekly interview as source material', async () => {
    vi.spyOn(contentKnowledgeApi, 'saveStory').mockImplementation(async (answers) => ({ ...story, answers }))
    vi.spyOn(contentKnowledgeApi, 'approveStory').mockResolvedValue({ ...story, status: 'APPROVED', approved_source_id: 'source-2', approved_at: new Date().toISOString() })
    renderStudio('/content/library?panel=story')
    fireEvent.change(await screen.findByLabelText(/What happened\?/), { target: { value: 'A customer changed our approach.' } })
    fireEvent.change(screen.getByLabelText(/Why did it matter\?/), { target: { value: 'It clarified the next step.' } })
    fireEvent.click(screen.getByRole('button', { name: /Approve and add to Sources/i }))
    await waitFor(() => expect(contentKnowledgeApi.saveStory).toHaveBeenCalled())
    await waitFor(() => expect(contentKnowledgeApi.approveStory).toHaveBeenCalled())
    expect((await screen.findAllByText(/Added to Sources/i)).length).toBeGreaterThan(0)
  })

  it('keeps workspace export and confirmed deletion with Brand and Publishing', async () => {
    const exportData = vi.spyOn(contentStudioApi, 'exportData').mockResolvedValue({
      format: 'content-studio-export-v1',
      workspace: { id: 'workspace-1', name: 'Example workspace' },
      settings: {}, sources: [], connections: [], posts: [], audit_events: [],
    })
    const deleteData = vi.spyOn(contentStudioApi, 'deleteData').mockResolvedValue({ deleted: { posts: 1 } })
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:export') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderStudio('/content/library?panel=brand')
    await screen.findByRole('heading', { name: 'Brand & Publishing' })
    fireEvent.click(screen.getByText('Advanced workspace settings'))
    fireEvent.click(screen.getByRole('button', { name: /Download data/i }))
    await waitFor(() => expect(exportData).toHaveBeenCalled())
    expect(await screen.findByText('Your download is ready.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/To delete, type DELETE VISIOFY STUDIO/i), {
      target: { value: 'DELETE VISIOFY STUDIO' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Delete Visiofy Studio data/i }))
    await waitFor(() => expect(deleteData).toHaveBeenCalledWith('DELETE VISIOFY STUDIO'))
  })
})
