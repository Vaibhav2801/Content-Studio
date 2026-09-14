import type { SocialNetwork, SocialPost, SocialPostState, VariantValidation } from './socialComposer'

export type QualityCheckStatus = 'PASS' | 'REVIEW_SUGGESTED' | 'BLOCKED'

export interface QualityCheckItem {
  key: string
  label: string
  status: QualityCheckStatus
  message: string
  blocking: boolean
}

export interface VersionQualityReport {
  schema_version: number
  checked_at: string
  hard_blocked: boolean
  review_suggested: boolean
  summary: { passed: number; review: number; blocked: number }
  deterministic: QualityCheckItem[]
  suggestions: QualityCheckItem[]
}

export interface ReviewVersion {
  id: string
  version: number
  copy: string
  hashtags: string[]
  metadata: Record<string, unknown>
  media: Array<Record<string, unknown> & { storage_url?: string; alt_text?: string; asset_type?: string }>
  quality_check?: VersionQualityReport
  scheduled_for: string
  approved_at: string | null
  created_at: string
}

export interface StudioVariantCard {
  id: string
  post_id: string
  topic: string
  source: string
  network: SocialNetwork
  network_label: string
  account: { id: string; display_name: string; account_type: string; health: string } | null
  copy: string
  hashtags: string[]
  metadata: Record<string, unknown>
  scheduled_for: string
  status: SocialPostState
  review_group: 'NEEDS_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | ''
  review_note: string
  validation: VariantValidation
  media_thumbnail: string
  media_count: number
  updated_at: string
  versions?: ReviewVersion[]
  approved_version_id?: string
}

export interface ApprovalGroups {
  NEEDS_REVIEW: StudioVariantCard[]
  CHANGES_REQUESTED: StudioVariantCard[]
  APPROVED: StudioVariantCard[]
}

export interface PublishNowResponse {
  variant: StudioVariantCard
  publish_job: {
    id: string
    status: 'SCHEDULED' | 'PUBLISHING' | 'SUBMITTED' | 'PUBLISHED' | 'FAILED' | 'CONNECTION_REQUIRED' | 'UNKNOWN' | 'CANCELLED'
    external_id: string
    failure_message: string
  }
}

export interface CalendarResponse {
  view: 'WEEK' | 'MONTH'
  timezone: string
  start: string
  end: string
  items: StudioVariantCard[]
}

export interface StudioConnection {
  id: string
  network: SocialNetwork
  network_label: string
  display_name: string
  account_type: string
  provider_label?: string
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR' | 'REVOKED'
  health: 'HEALTHY' | 'NEEDS_ATTENTION'
  message: string
  connected_at: string | null
  disconnected_at: string | null
  last_checked_at: string
  can_remove?: boolean
  removal_method?: "DIRECT" | "PROVIDER_MANAGED"
}

export interface HomeSummary {
  needs_approval: StudioVariantCard[]
  upcoming: StudioVariantCard[]
  recent_drafts?: StudioVariantCard[]
  failures: StudioVariantCard[]
  connections_needing_attention: number
  totals?: { drafts: number; needs_review: number; scheduled: number; published: number }
}

export type LibraryPost = SocialPost

export type AnalyticsMetricName = 'IMPRESSIONS' | 'VIEWS' | 'REACTIONS' | 'LIKES' | 'COMMENTS' | 'SHARES' | 'REPOSTS' | 'CLICKS' | 'FOLLOWER_GROWTH'

export interface AnalyticsMetricCell {
  label: string
  available: boolean
  value: number | null
  measured_posts: number
}

export interface AnalyticsComparisonRow {
  key: string
  label: string
  posts: number
  metrics: Record<AnalyticsMetricName, AnalyticsMetricCell>
}

export interface AnalyticsSuggestion {
  id: string
  dimension: 'platform' | 'content_pillar' | 'format'
  segment: string
  rule: string
  rationale: string
  evidence: { posts?: number; average_interaction_rate?: number; comparison_interaction_rate?: number; denominator?: string; disclaimer?: string }
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED'
}

export interface ContentAnalytics {
  summary: Record<AnalyticsMetricName, AnalyticsMetricCell>
  comparisons: Record<'platform' | 'topic' | 'content_pillar' | 'format', AnalyticsComparisonRow[]>
  suggestions: AnalyticsSuggestion[]
  data_note: string
  readiness?: { published_posts: number; measured_posts: number; connected_accounts: number; last_measured_at: string | null; draft_posts?: number; scheduled_posts?: number; failed_posts?: number }
}
