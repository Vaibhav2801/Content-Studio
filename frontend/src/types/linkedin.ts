export type LinkedInPostStatus = 'DRAFT' | 'SCHEDULED' | 'READY' | 'PUBLISHING' | 'SUBMITTED' | 'PUBLISHED' | 'FAILED' | 'CANCELLED'

export interface PublisherStatus {
  ready: boolean
  mode: 'manual' | 'buffer' | 'n8n' | 'webhook'
  label: string
  detail: string
  missing: string[]
  target: 'MANUAL' | 'PERSON' | 'ORGANIZATION'
}

export interface ImageProviderStatus {
  ready: boolean
  label: string
  detail: string
}

export interface LinkedInSettings {
  id: string
  page_name: string
  company_description: string
  audience: string
  brand_voice: string
  content_pillars: string[]
  calls_to_action: string[]
  forbidden_topics: string[]
  image_style: string
  language: string
  timezone: string
  schedule_days: number[]
  post_time: string
  posts_per_week: number
  queue_horizon_days: number
  approval_mode: 'REQUIRE_APPROVAL' | 'AUTO_PUBLISH'
  publisher: 'MANUAL' | 'BUFFER' | 'N8N' | 'WEBHOOK'
  is_active: boolean
  provider_ready: PublisherStatus
  image_provider_ready: ImageProviderStatus
  created_at: string
  updated_at: string
}

export interface ContentBrief {
  id: string
  label: string
  context: string
  is_evergreen: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LinkedInPost {
  id: string
  brief: string | null
  brief_label: string
  topic: string
  hook: string
  body: string
  hashtags: string[]
  image_prompt: string
  image_url: string
  alt_text: string
  status: LinkedInPostStatus
  scheduled_for: string
  approved_at: string | null
  published_at: string | null
  external_post_id: string
  failure_reason: string
  generation_metadata: Record<string, unknown>
  character_count: number
  created_at: string
  updated_at: string
}

export interface LinkedInDashboard {
  settings: LinkedInSettings
  counts: Partial<Record<LinkedInPostStatus, number>>
  posts: LinkedInPost[]
  briefs: ContentBrief[]
  next_slots: string[]
  server_time: string
}
