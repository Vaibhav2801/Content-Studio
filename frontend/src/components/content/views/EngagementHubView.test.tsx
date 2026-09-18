import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contentStudioApi } from '../../../api/contentStudio'
import type { EngagementOverview } from '../../../types/engagement'
import { EngagementHubView } from './EngagementHubView'

vi.mock('../../../api/contentStudio', () => ({
  contentStudioApi: {
    engagement: vi.fn(),
    updateEngagementReview: vi.fn(),
    engagementReviewAction: vi.fn(),
    createEngagementAutomation: vi.fn(),
    engagementAutomationAction: vi.fn(),
    createEngagementCampaign: vi.fn(),
    engagementCampaignAction: vi.fn(),
  },
}))

const overview: EngagementOverview = {
  reviews: [
    { id: 'review-1', platform: 'instagram', kind: 'Direct message', status: 'PENDING', person: 'Priya Mehta', handle: '@priya', source: 'DM keyword', received_at: new Date().toISOString(), incoming: 'DEMO', draft: 'Thanks! Would you like a tour?', assignee_id: 'user-1', assignee: 'You', error: '', can_send: true },
    { id: 'review-2', platform: 'linkedin', kind: 'Comment reply', status: 'PENDING', person: 'Daniel Kim', handle: 'Growth Lead', source: 'Company Page', received_at: new Date().toISOString(), incoming: 'Does this work for teams?', draft: 'Yes, it supports team review.', assignee_id: 'user-1', assignee: 'You', error: '', can_send: true },
  ],
  automations: [],
  campaigns: [],
  analytics: { conversations_started: 2, replies_approved: 0, pending_reviews: 2, reply_rate: 0, link_clicks: 0, automation_runs: 0, sources: [] },
  team: [{ id: 'user-1', name: 'Owner', role: 'OWNER', is_current_user: true }],
  connections: [{ id: 'connection-1', platform: 'instagram', name: '@company', account_type: 'BUSINESS', connected: true, engagement_supported: true }],
  contacts: [{ id: 'contact-1', platform: 'instagram', name: 'Priya Mehta', handle: '@priya' }],
  policy: { human_approval_required: true, linkedin_personal_messages_manual: true },
}

beforeEach(() => {
  vi.mocked(contentStudioApi.engagement).mockResolvedValue(structuredClone(overview))
  vi.mocked(contentStudioApi.engagementReviewAction).mockImplementation(async (id, action, draft) => ({
    ...overview.reviews.find((item) => item.id === id)!,
    status: action === 'DISMISS' ? 'DISMISSED' : 'SENT',
    draft: draft ?? '',
  }))
  vi.mocked(contentStudioApi.createEngagementAutomation).mockImplementation(async (payload) => ({
    id: 'automation-1', connection_id: payload.connection_id, platform: 'instagram', name: payload.name,
    kind: payload.kind, type: 'Comment to DM', status: 'DRAFT', state: 'Needs approval', keywords: payload.keywords,
    match_mode: payload.match_mode, dm_message: payload.dm_message, comment_reply: payload.comment_reply ?? '',
    configuration: {}, runs: 0, owner_id: 'user-1', owner: 'Owner', error: '',
  }))
})

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('EngagementHubView', () => {
  it('loads the review queue and sends only after approval', async () => {
    render(<EngagementHubView />)
    expect(screen.getByText('Human approval is always on')).toBeInTheDocument()
    expect(await screen.findAllByText('AI suggestion')).not.toHaveLength(0)
    fireEvent.click(screen.getAllByRole('button', { name: /Approve & send/i })[0])
    await waitFor(() => expect(contentStudioApi.engagementReviewAction).toHaveBeenCalledWith('review-1', 'APPROVE_SEND', 'Thanks! Would you like a tour?'))
    expect(await screen.findByRole('status')).toHaveTextContent(/approved and sent/i)
  })

  it('creates new automations as persistent drafts', async () => {
    render(<EngagementHubView />)
    await screen.findByText('Priya Mehta')
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }))
    fireEvent.click(screen.getByRole('button', { name: /New automation/i }))
    fireEvent.change(screen.getByPlaceholderText('Example: Send pricing guide'), { target: { value: 'Send launch guide' } })
    fireEvent.change(screen.getByPlaceholderText('Example: PRICE, PLANS'), { target: { value: 'LAUNCH' } })
    fireEvent.change(screen.getByPlaceholderText('Exact message a reviewer can approve'), { target: { value: 'Here is the launch guide.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create for review' }))
    expect(await screen.findByText('Send launch guide')).toBeInTheDocument()
    expect(contentStudioApi.createEngagementAutomation).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(/Nothing will run until it is approved/i)
  })

  it('makes LinkedIn personal outreach limits explicit', async () => {
    render(<EngagementHubView />)
    await screen.findByText('Priya Mehta')
    fireEvent.click(screen.getByRole('button', { name: 'LinkedIn Copilot' }))
    expect(screen.getByText('What stays manual')).toBeInTheDocument()
    expect(screen.getByText(/Connection requests, personal DMs, and InMail are never automated/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open LinkedIn/i })).toHaveAttribute('href', 'https://www.linkedin.com')
  })
})
