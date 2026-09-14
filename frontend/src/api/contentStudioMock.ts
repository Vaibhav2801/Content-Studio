import { makeDemoPost } from './socialComposerMock'
import type { AnalyticsMetricCell, ApprovalGroups, CalendarResponse, ContentAnalytics, HomeSummary, LibraryPost, StudioConnection, StudioVariantCard } from '../types/contentStudio'

const post = makeDemoPost('Make onboarding easier', 'Customers move faster when each next step is clear.', ['LINKEDIN', 'X'])
const card = (index = 0): StudioVariantCard => ({
  id: post.variants[index].id, post_id: post.id, topic: post.idea_title, source: 'Customer onboarding notes', network: post.variants[index].network,
  network_label: post.variants[index].network_label, account: post.variants[index].account, copy: post.variants[index].copy,
  hashtags: post.variants[index].hashtags, metadata: {}, scheduled_for: new Date(Date.now() + 86400000).toISOString(), status: 'NEEDS_REVIEW',
  review_group: 'NEEDS_REVIEW', review_note: '', validation: { valid: true, fields: {} }, media_thumbnail: '', media_count: 0, updated_at: new Date().toISOString(),
  versions: [{ id: 'version-1', version: 1, copy: post.variants[index].copy, hashtags: post.variants[index].hashtags, metadata: {}, media: [], quality_check: {
    schema_version: 1, checked_at: new Date().toISOString(), hard_blocked: false, review_suggested: false,
    summary: { passed: 11, review: 0, blocked: 0 },
    deterministic: [{ key: 'platform_fit', label: 'Platform length and media', status: 'PASS', message: 'Fits the current platform limits.', blocking: false }],
    suggestions: [{ key: 'voice_match', label: 'Voice match', status: 'PASS', message: 'The post matches the saved voice.', blocking: false }],
  }, scheduled_for: new Date(Date.now() + 86400000).toISOString(), approved_at: null, created_at: new Date().toISOString() }], approved_version_id: '',
})

export const contentStudioMockApprovals: ApprovalGroups = { NEEDS_REVIEW: [card()], CHANGES_REQUESTED: [], APPROVED: [] }
export const contentStudioMockCalendar: CalendarResponse = { view: 'WEEK', timezone: 'Asia/Kolkata', start: new Date().toISOString(), end: new Date(Date.now() + 7 * 86400000).toISOString(), items: [card()] }
export const contentStudioMockLibrary: LibraryPost[] = [post]
export const contentStudioMockConnections: StudioConnection[] = [{ id: 'connection-1', network: 'LINKEDIN', network_label: 'LinkedIn', display_name: 'LumaDesk', account_type: 'Company Page', status: 'CONNECTED', health: 'HEALTHY', message: 'Ready', connected_at: new Date().toISOString(), disconnected_at: null, last_checked_at: new Date().toISOString() }]
export const contentStudioMockHome: HomeSummary = { needs_approval: [card()], upcoming: [], failures: [], connections_needing_attention: 0, totals: { drafts: 3, needs_review: 1, scheduled: 2, published: 8 } }

const metric = (label: string, value?: number): AnalyticsMetricCell => ({ label, available: value !== undefined, value: value ?? null, measured_posts: value === undefined ? 0 : 8 })
const metrics = () => ({
  IMPRESSIONS: metric('Impressions', 18400), VIEWS: metric('Views'), REACTIONS: metric('Reactions'), LIKES: metric('Likes', 620),
  COMMENTS: metric('Comments', 74), SHARES: metric('Shares', 38), REPOSTS: metric('Reposts'), CLICKS: metric('Clicks'), FOLLOWER_GROWTH: metric('Follower growth', 24),
})
export const contentStudioMockAnalytics: ContentAnalytics = {
  summary: metrics(),
  readiness: { published_posts: 8, measured_posts: 8, connected_accounts: 1, last_measured_at: new Date().toISOString() },
  comparisons: {
    platform: [{ key: 'LinkedIn', label: 'LinkedIn', posts: 8, metrics: metrics() }],
    topic: [{ key: 'Onboarding', label: 'Onboarding', posts: 4, metrics: metrics() }],
    content_pillar: [{ key: 'Customer learning', label: 'Customer learning', posts: 4, metrics: metrics() }],
    format: [{ key: 'Image', label: 'Image', posts: 4, metrics: metrics() }],
  },
  suggestions: [{
    id: 'analytics-suggestion-1', dimension: 'format', segment: 'Image', status: 'PENDING',
    rule: 'Test more Image content when it fits the idea, and compare the results with other formats.',
    rationale: 'Image posts were associated with a 4.2% average interaction rate across 4 posts, compared with 2.1% for other formats. This is an observed association, not evidence that the format caused the difference.',
    evidence: { posts: 4, average_interaction_rate: 4.2, comparison_interaction_rate: 2.1, denominator: 'impressions when available, otherwise views', disclaimer: 'This comparison shows correlation only and does not establish causation.' },
  }],
  data_note: 'Suggestions require enough posts with reach and interaction data. Comparisons show association only; they do not prove what caused a result.',
}
