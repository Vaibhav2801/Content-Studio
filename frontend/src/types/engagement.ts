export type EngagementPlatform = 'instagram' | 'linkedin'
export type EngagementReviewStatus = 'PENDING' | 'SENDING' | 'SENT' | 'DISMISSED' | 'FAILED'
export type EngagementAutomationKind = 'COMMENT_TO_DM' | 'STORY_REPLY' | 'DM_KEYWORD' | 'CLICK_TO_DM'
export type EngagementAutomationStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'FAILED'
export type EngagementCampaignStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'FAILED'

export interface EngagementReview {
  id: string
  connection_id: string
  account_name: string
  account_type: string
  platform: EngagementPlatform
  kind: 'Comment reply' | 'Direct message' | 'Story reply'
  status: EngagementReviewStatus
  person: string
  handle: string
  source: string
  received_at: string
  incoming: string
  draft: string
  assignee_id: string
  assignee: string
  error: string
  can_send: boolean
}

export interface EngagementAutomation {
  id: string
  connection_id: string
  platform: EngagementPlatform
  name: string
  kind: EngagementAutomationKind
  type: string
  status: EngagementAutomationStatus
  state: string
  keywords: string[]
  match_mode: 'contains' | 'word' | 'exact'
  dm_message: string
  comment_reply: string
  configuration: Record<string, unknown>
  runs: number
  owner_id: string
  owner: string
  error: string
}

export interface EngagementCampaign {
  id: string
  connection_id: string
  platform: EngagementPlatform
  name: string
  status: EngagementCampaignStatus
  state: string
  audience: { contact_ids?: string[]; label?: string }
  steps: Array<{ message: string; delay_minutes: number }>
  provider_sequence_id: string
  owner_id: string
  owner: string
  stats: { enrolled?: number; replies?: number; clicks?: number }
  error: string
}

export interface EngagementAnalytics {
  conversations_started: number
  replies_approved: number
  pending_reviews: number
  reply_rate: number
  link_clicks: number
  automation_runs: number
  sources: Array<{ label: string; value: number }>
}

export interface EngagementTeamMember {
  id: string
  name: string
  role: string
  is_current_user: boolean
}

export interface EngagementConnection {
  id: string
  platform: EngagementPlatform
  name: string
  account_type: string
  connected: boolean
  engagement_supported: boolean
}

export interface EngagementContactSummary {
  id: string
  platform: 'instagram'
  name: string
  handle: string
}

export interface EngagementOverview {
  reviews: EngagementReview[]
  automations: EngagementAutomation[]
  campaigns: EngagementCampaign[]
  analytics: EngagementAnalytics
  team: EngagementTeamMember[]
  connections: EngagementConnection[]
  contacts: EngagementContactSummary[]
  policy: { human_approval_required: true; linkedin_personal_messages_manual: true }
}

export interface CreateEngagementAutomation {
  connection_id: string
  kind: EngagementAutomationKind
  name: string
  keywords: string[]
  match_mode: 'contains' | 'word' | 'exact'
  dm_message: string
  comment_reply?: string
  owner_id?: string
  activate?: boolean
}

export interface CreateEngagementCampaign {
  connection_id: string
  name: string
  audience: { contact_ids: string[]; label?: string }
  steps: Array<{ message: string; delay_minutes: number }>
  owner_id?: string
}
