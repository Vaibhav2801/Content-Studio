import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contentOnboardingApi } from '../api/contentOnboarding'
import { contentStudioApi } from '../api/contentStudio'
import { contentStudioMockAnalytics, contentStudioMockApprovals, contentStudioMockCalendar, contentStudioMockConnections, contentStudioMockHome, contentStudioMockLibrary } from '../api/contentStudioMock'
import { linkedinApi } from '../api/linkedin'
import { contentOnboardingMock, linkedinMockDashboard } from '../api/linkedinMock'
import { ContentApprovalsView } from '../components/content/views/ContentApprovalsView'
import { ContentAnalyticsView } from '../components/content/views/ContentAnalyticsView'
import { ContentCalendarView } from '../components/content/views/ContentCalendarView'
import { ContentConnectionsView } from '../components/content/views/ContentConnectionsView'
import { ContentHomeView } from '../components/content/views/ContentHomeView'
import { ContentLibraryView } from '../components/content/views/ContentLibraryView'
import type { ApprovalGroups, HomeSummary, StudioConnection } from '../types/contentStudio'
import { ContentStudioPage } from './ContentStudioPage'

function renderScreen(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="content" element={<ContentStudioPage />}><Route index element={<ContentHomeView />} /><Route path="approvals" element={<ContentApprovalsView />} /><Route path="calendar" element={<ContentCalendarView />} /><Route path="library" element={<ContentLibraryView />} /><Route path="connections" element={<ContentConnectionsView />} /><Route path="analytics" element={<ContentAnalyticsView />} /><Route path="create" element={<div>Create destination</div>} /></Route></Routes></MemoryRouter>)
}

describe('Content Studio core screens', () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(linkedinApi, 'dashboard').mockResolvedValue(structuredClone(linkedinMockDashboard))
    vi.spyOn(contentOnboardingApi, 'get').mockResolvedValue(structuredClone(contentOnboardingMock))
    vi.spyOn(contentOnboardingApi, 'startConnection').mockResolvedValue({ authorization_url: 'https://social.example/connect', expires_at: new Date().toISOString() })
    vi.spyOn(contentStudioApi, 'home').mockResolvedValue(structuredClone(contentStudioMockHome))
    vi.spyOn(contentStudioApi, 'approvals').mockResolvedValue(structuredClone(contentStudioMockApprovals))
    vi.spyOn(contentStudioApi, 'calendar').mockResolvedValue(structuredClone(contentStudioMockCalendar))
    vi.spyOn(contentStudioApi, 'library').mockResolvedValue(structuredClone(contentStudioMockLibrary))
    vi.spyOn(contentStudioApi, 'connections').mockResolvedValue(structuredClone(contentStudioMockConnections))
    vi.spyOn(contentStudioApi, 'analytics').mockResolvedValue(structuredClone(contentStudioMockAnalytics))
  })

  it('groups approvals, previews exact versions, warns about edits and batch approves', async () => {
    const needsReview = structuredClone(contentStudioMockApprovals.NEEDS_REVIEW[0])
    const approved = { ...structuredClone(needsReview), id: 'approved-variant', review_group: 'APPROVED' as const, status: 'APPROVED' as const, approved_version_id: needsReview.versions?.[0].id }
    const groups: ApprovalGroups = { NEEDS_REVIEW: [needsReview], CHANGES_REQUESTED: [], APPROVED: [approved] }
    vi.mocked(contentStudioApi.approvals).mockResolvedValue(groups)
    vi.spyOn(contentStudioApi, 'batchApprove').mockResolvedValue({ NEEDS_REVIEW: [], CHANGES_REQUESTED: [], APPROVED: [approved, needsReview] })
    renderScreen('/content/approvals')
    expect((await screen.findAllByText(/Customers move faster when each next step is clear/i)).length).toBeGreaterThan(0)
    expect(screen.getByText(/Editing this approved post creates a new version and revokes approval/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: `Select ${needsReview.topic}` }))
    fireEvent.click(screen.getByRole('button', { name: /Approve selected versions/i }))
    await waitFor(() => expect(contentStudioApi.batchApprove).toHaveBeenCalledWith([{ variant_id: needsReview.id, version_id: needsReview.versions![0].id }]))
  })

  it('publishes an approved version immediately', async () => {
    const approved = { ...structuredClone(contentStudioMockApprovals.NEEDS_REVIEW[0]), review_group: 'APPROVED' as const, status: 'APPROVED' as const }
    vi.mocked(contentStudioApi.approvals).mockResolvedValue({ NEEDS_REVIEW: [], CHANGES_REQUESTED: [], APPROVED: [approved] })
    vi.spyOn(contentStudioApi, 'publishNow').mockResolvedValue({
      variant: { ...approved, status: 'SUBMITTED', review_group: '' },
      publish_job: { id: 'publish-job-1', status: 'SUBMITTED', external_id: 'provider-post-1', failure_message: '' },
    })

    renderScreen('/content/approvals')
    fireEvent.click(await screen.findByRole('button', { name: 'Publish now' }))

    await waitFor(() => expect(contentStudioApi.publishNow).toHaveBeenCalledWith(approved.id))
    expect(screen.getByText(/Post submitted for publishing/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish now' })).not.toBeInTheDocument()
  })

  it('publishes a scheduled post from the calendar schedule list', async () => {
    const scheduled = structuredClone(contentStudioMockCalendar.items[0])
    scheduled.status = 'SCHEDULED'
    scheduled.review_group = 'APPROVED'
    const submitted = { ...scheduled, status: 'SUBMITTED' as const }
    vi.mocked(contentStudioApi.calendar)
      .mockResolvedValueOnce({ ...structuredClone(contentStudioMockCalendar), items: [scheduled] })
      .mockResolvedValue({ ...structuredClone(contentStudioMockCalendar), items: [submitted] })
    vi.spyOn(contentStudioApi, 'publishNow').mockResolvedValue({
      variant: submitted,
      publish_job: { id: 'job-1', status: 'SUBMITTED', external_id: 'provider-1', failure_message: '' },
    })

    renderScreen('/content/calendar')
    const list = (await screen.findByRole('heading', { name: 'Schedule list' })).closest('section')!
    const label = 'Publish ' + scheduled.topic + ' to ' + scheduled.network_label + ' now'
    fireEvent.click(await within(list).findByRole('button', { name: label }))

    await waitFor(() => expect(contentStudioApi.publishNow).toHaveBeenCalledWith(scheduled.id))
    expect(await screen.findByText(/Post submitted for publishing/i)).toBeInTheDocument()
    await waitFor(() => expect(within(list).queryByRole('button', { name: label })).not.toBeInTheDocument())
  })

  it('publishes a scheduled variant from Content Library', async () => {
    const scheduledPost = structuredClone(contentStudioMockLibrary[0])
    scheduledPost.state = 'SCHEDULED'
    scheduledPost.variants[0].status = 'SCHEDULED'
    const submittedPost = structuredClone(scheduledPost)
    submittedPost.variants[0].status = 'SUBMITTED'
    vi.mocked(contentStudioApi.library)
      .mockResolvedValueOnce([scheduledPost])
      .mockResolvedValue([submittedPost])
    vi.spyOn(contentStudioApi, 'publishNow').mockResolvedValue({
      variant: { ...structuredClone(contentStudioMockCalendar.items[0]), id: scheduledPost.variants[0].id, status: 'SUBMITTED' },
      publish_job: { id: 'job-2', status: 'SUBMITTED', external_id: 'provider-2', failure_message: '' },
    })

    renderScreen('/content/library?status=SCHEDULED')
    const label = 'Publish ' + scheduledPost.idea_title + ' to ' + scheduledPost.variants[0].network_label + ' now'
    fireEvent.click(await screen.findByRole('button', { name: label }))

    await waitFor(() => expect(contentStudioApi.publishNow).toHaveBeenCalledWith(scheduledPost.variants[0].id))
    expect(await screen.findByText(/Post submitted for publishing/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument())
  })
  it('shows advisory quality details without blocking approval', async () => {
    const needsReview = structuredClone(contentStudioMockApprovals.NEEDS_REVIEW[0])
    const report = needsReview.versions![0].quality_check!
    report.review_suggested = true
    report.summary = { passed: 10, review: 1, blocked: 0 }
    report.suggestions = [{ key: 'voice_match', label: 'Voice match', status: 'REVIEW_SUGGESTED', message: 'The tone may not match the saved voice rule.', blocking: false }]
    vi.mocked(contentStudioApi.approvals).mockResolvedValue({ NEEDS_REVIEW: [needsReview], CHANGES_REQUESTED: [], APPROVED: [] })
    renderScreen('/content/approvals')

    expect(await screen.findByText('Review suggested')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve version' })).toBeEnabled()
    fireEvent.click(screen.getByText('View quality details'))
    expect(screen.getByText('The tone may not match the saved voice rule.')).toBeInTheDocument()
  })

  it('disables approval and batch selection for required quality changes', async () => {
    const needsReview = structuredClone(contentStudioMockApprovals.NEEDS_REVIEW[0])
    const report = needsReview.versions![0].quality_check!
    report.hard_blocked = true
    report.summary = { passed: 10, review: 0, blocked: 1 }
    report.deterministic = [{ key: 'platform_fit', label: 'Platform length and media', status: 'BLOCKED', message: 'The post is over the platform limit.', blocking: true }]
    vi.mocked(contentStudioApi.approvals).mockResolvedValue({ NEEDS_REVIEW: [needsReview], CHANGES_REQUESTED: [], APPROVED: [] })
    renderScreen('/content/approvals')

    expect(await screen.findByText('Changes required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve version' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: `Select ${needsReview.topic}` })).toBeDisabled()
  })

  it('offers week, month, drag targets and a keyboard scheduling fallback', async () => {
    vi.spyOn(contentStudioApi, 'reschedule').mockResolvedValue(structuredClone(contentStudioMockCalendar.items[0]))
    renderScreen('/content/calendar')
    expect(await screen.findByText(/Times shown in Asia\/Kolkata/i, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    await waitFor(() => expect(contentStudioApi.calendar).toHaveBeenCalledWith('MONTH', expect.any(String)))
    const row = screen.getByRole('heading', { name: 'Schedule list' }).closest('section')!
    fireEvent.change(within(row).getByLabelText(`Schedule ${contentStudioMockCalendar.items[0].topic}`), { target: { value: '2030-06-15T10:30' } })
    fireEvent.click(within(row).getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(contentStudioApi.reschedule).toHaveBeenCalledWith(contentStudioMockCalendar.items[0].id, expect.stringContaining('2030-06-15')))
  })

  it('filters and searches the library and exposes all reuse actions and details', async () => {
    vi.spyOn(contentStudioApi, 'libraryAction').mockResolvedValue(structuredClone(contentStudioMockLibrary[0]))
    renderScreen('/content/library')
    expect(await screen.findByText(contentStudioMockLibrary[0].idea_title)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Open details/i }))
    expect(screen.getByText('Platform versions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Duplicate/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reuse idea/i })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'FAILED' } })
    fireEvent.change(screen.getByLabelText('Search content'), { target: { value: 'onboarding' } })
    await waitFor(() => expect(contentStudioApi.library).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'FAILED', q: 'onboarding' })), { timeout: 1500 })
  })

  it('confirms account disconnection, explains its effect, and updates the connection state', async () => {
    const attention: StudioConnection = { ...structuredClone(contentStudioMockConnections[0]), id: 'connection-2', network: 'X', network_label: 'X', display_name: '@lumadesk', status: 'REVOKED', health: 'NEEDS_ATTENTION', message: 'Access expired — reconnect' }
    vi.mocked(contentStudioApi.connections).mockResolvedValue([...structuredClone(contentStudioMockConnections), attention])
    vi.spyOn(contentStudioApi, 'connectionAction').mockResolvedValue({ ...contentStudioMockConnections[0], status: 'DISCONNECTED', health: 'NEEDS_ATTENTION' })
    renderScreen('/content/connections')
    expect(await screen.findByText('@lumadesk')).toBeInTheDocument()
    expect(within(screen.getByText('@lumadesk').closest('article')!).getByRole('button', { name: /^Disconnect$/i })).toBeInTheDocument()
    const accountCard = screen.getByText('LumaDesk').closest('article')!
    fireEvent.click(within(accountCard).getByRole('button', { name: /Disconnect/i }))
    expect(contentStudioApi.connectionAction).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/stop publishing to this account/i)
    fireEvent.click(screen.getByRole('button', { name: /Keep connected/i }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    fireEvent.click(within(accountCard).getByRole('button', { name: /^Disconnect$/i }))
    fireEvent.click(within(accountCard).getByRole('button', { name: /Disconnect account/i }))
    await waitFor(() => expect(contentStudioApi.connectionAction).toHaveBeenCalledWith('connection-1', 'DISCONNECT'))
    await waitFor(() => expect(within(accountCard).getByRole('button', { name: /Reconnect/i })).toBeInTheDocument())
    expect(document.body.textContent).not.toMatch(/Upload Post|Zernio/i)
  })

  it('lets a user connect their first social account from the empty Connections screen', async () => {
    vi.mocked(contentStudioApi.connections).mockResolvedValue([])
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderScreen('/content/connections')

    const connect = await screen.findByRole('button', { name: /Connect LinkedIn/i })
    expect(connect).toBeEnabled()
    fireEvent.click(connect)

    await waitFor(() => expect(contentOnboardingApi.startConnection).toHaveBeenCalledTimes(1))
    expect(open).toHaveBeenCalledWith('https://social.example/connect', '_self')
    expect(screen.getByText(/continue creating drafts without a connection/i)).toBeInTheDocument()
  })

  it('summarizes setup, approvals, upcoming posts and failures on Home', async () => {
    const review = structuredClone(contentStudioMockApprovals.NEEDS_REVIEW[0])
    const summary: HomeSummary = { needs_approval: [review], upcoming: [{ ...review, id: 'upcoming', status: 'SCHEDULED' }], failures: [{ ...review, id: 'failed', status: 'FAILED' }], connections_needing_attention: 1 }
    vi.mocked(contentStudioApi.home).mockResolvedValue(summary)
    renderScreen('/content')
    expect(await screen.findByRole('heading', { name: 'Posts needing approval' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Next scheduled posts' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Failures requiring attention' })).toBeInTheDocument()
    expect(screen.getByText('Publishing needs a quick check')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /New post/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^Home$/i }).length).toBeGreaterThan(0)
  })

  it('shows honest metric availability, comparisons, evidence and explicit suggestion decisions', async () => {
    const accepted = structuredClone(contentStudioMockAnalytics)
    accepted.suggestions[0].status = 'ACCEPTED'
    vi.spyOn(contentStudioApi, 'decideAnalyticsSuggestion').mockResolvedValue(accepted)
    renderScreen('/content/analytics')

    expect(await screen.findByRole('heading', { name: 'Analytics' })).toBeInTheDocument()
    expect((await screen.findAllByText('Unavailable')).length).toBeGreaterThan(0)
    expect(screen.getByText(/association only/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Content pillar' }))
    expect(screen.getByText('Customer learning')).toBeInTheDocument()
    expect(screen.getByText(/Evidence: 4 posts/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(contentStudioApi.decideAnalyticsSuggestion).toHaveBeenCalledWith('analytics-suggestion-1', 'ACCEPT'))
    expect(document.body.textContent).not.toMatch(/Upload Post|Zernio/i)
  })

  it('refreshes missing published metrics and keeps publishing activity visible', async () => {
    const waiting = structuredClone(contentStudioMockAnalytics)
    Object.values(waiting.summary).forEach((metric) => { metric.available = false; metric.value = null; metric.measured_posts = 0 })
    waiting.readiness = { published_posts: 8, measured_posts: 0, connected_accounts: 1, last_measured_at: null, draft_posts: 2, scheduled_posts: 3, failed_posts: 0 }
    waiting.suggestions = []
    vi.mocked(contentStudioApi.analytics).mockResolvedValue(waiting)
    vi.spyOn(contentStudioApi, 'refreshAnalytics').mockResolvedValue({ analytics: waiting, refresh: { checked: 8, failed: 0, observations: 0 } })
    renderScreen('/content/analytics')
    await waitFor(() => expect(contentStudioApi.refreshAnalytics).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('region', { name: 'Publishing activity' })).toHaveTextContent('Draft versions')
    expect(screen.getByRole('heading', { name: 'Published by platform' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh metrics' })).toBeInTheDocument()
  })

  it('shows a useful Analytics next step when no posts have metrics yet', async () => {
    const empty = structuredClone(contentStudioMockAnalytics)
    Object.values(empty.summary).forEach((metric) => { metric.available = false; metric.value = null; metric.measured_posts = 0 })
    empty.comparisons = { platform: [], topic: [], content_pillar: [], format: [] }
    empty.suggestions = []
    empty.readiness = { published_posts: 0, measured_posts: 0, connected_accounts: 1, last_measured_at: null }
    vi.mocked(contentStudioApi.analytics).mockResolvedValue(empty)

    renderScreen('/content/analytics')

    expect(await screen.findByText('No published posts yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create a post' })).toHaveAttribute('href', '/content/create')
    expect(screen.queryByRole('heading', { name: 'Compare results' })).not.toBeInTheDocument()
  })
})
