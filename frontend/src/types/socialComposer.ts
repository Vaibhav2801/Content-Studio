export type SocialNetwork = 'LINKEDIN' | 'X' | 'INSTAGRAM'
export type SocialPostState = 'DRAFT' | 'NEEDS_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHING' | 'SUBMITTED' | 'PUBLISHED' | 'FAILED' | 'CANCELLED' | 'CONNECTION_REQUIRED'

export interface ComposerConnection {
  id: string
  network: SocialNetwork
  label: string
  display_name: string
  account_type: string
  health: 'HEALTHY' | 'NEEDS_ATTENTION'
}

export interface ComposerSource {
  id: string
  source_type: 'TEXT' | 'URL' | 'PDF' | 'DOCUMENT' | 'TRANSCRIPT' | 'VOICE_NOTE'
  label: string
  text_content: string
  source_url: string
  original_filename: string
  processing_status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
  metadata: Record<string, unknown>
  owner_name: string
  updated_at: string
}

export interface ComposerDraftSummary {
  id: string
  idea_title: string
  state: SocialPostState
  networks: SocialNetwork[]
  updated_at: string
}

export interface GenerationControls {
  tone: 'Professional' | 'Friendly' | 'Bold' | 'Educational'
  goal: 'Awareness' | 'Engagement' | 'Education' | 'Leads'
  length: 'Short' | 'Medium' | 'Long'
  include_image: boolean
}

export interface CreativeBrief {
  target_audience: string
  key_message: string
  call_to_action: string
  must_include: string[]
  must_avoid: string[]
  visual_theme: string
  image_requirements: string
  reserve_logo_space: boolean
}

export interface ComposerOptions {
  connections: ComposerConnection[]
  sources: ComposerSource[]
  drafts: ComposerDraftSummary[]
  generation_controls: { tones: GenerationControls['tone'][]; goals: GenerationControls['goal'][]; lengths: GenerationControls['length'][] }
}

export interface VariantValidation {
  valid: boolean
  fields: Partial<Record<'copy' | 'hashtags' | 'media' | 'connection', string[]>>
}

export interface QualityCheckItem {
  key: string
  label: string
  status: 'PASS' | 'REVIEW_SUGGESTED' | 'BLOCKED'
  message: string
  blocking: boolean
}

export interface QualityReport {
  hard_blocked: boolean
  review_suggested: boolean
  summary: { passed: number; review: number; blocked: number }
  deterministic: QualityCheckItem[]
  suggestions: QualityCheckItem[]
  cost?: 'NO_AI_CALL'
}

export interface MediaAsset {
  id: string
  asset_type: 'IMAGE' | 'MULTI_IMAGE' | 'VIDEO' | 'DOCUMENT'
  source: 'UPLOAD' | 'AI' | 'LEGACY'
  original_filename: string
  content_type: string
  byte_size: number
  width: number | null
  height: number | null
  duration_ms: number | null
  alt_text: string
  sort_order: number
  publish_url: string
}

export interface SocialVariant {
  id: string
  network: SocialNetwork
  network_label: string
  account: { id: string; display_name: string; account_type: string; health: string } | null
  copy: string
  hashtags: string[]
  scheduled_for: string
  status: SocialPostState
  metadata: { image_prompt?: string; alt_text?: string; include_image?: boolean; generation_status?: 'AI' | 'FALLBACK'; generation_provider?: string; generation_model?: string; format?: 'THREAD' | 'CAROUSEL'; thread?: string[]; carousel_slides?: string[]; brand_brain_version?: { id: string; version: number }; source_references?: Array<{ id: string; label: string; source_type: string }>; alternatives?: Array<{ copy: string; hashtags: string[] }>; alternatives_generation?: { provider?: string; model?: string } }
  media: MediaAsset[]
  validation: VariantValidation
  quality_check: QualityReport
  updated_at: string
}

export type PostGenerationStatus = 'IDLE' | 'GENERATING' | 'READY' | 'FAILED'

export interface SocialPost {
  id: string
  idea_title: string
  idea_text: string
  source: ComposerSource | null
  sources: ComposerSource[]
  brand_brain_version: { id: string; version: number } | null
  state: SocialPostState
  generation_status?: PostGenerationStatus
  generation_error?: string
  controls: GenerationControls
  creative_brief: CreativeBrief
  variants: SocialVariant[]
  created_at: string
  updated_at: string
}

export type RewriteAction = 'MAKE_SHORTER' | 'MAKE_PERSONAL' | 'NEW_HOOK' | 'REDUCE_PROMOTION' | 'CREATE_X_THREAD' | 'CREATE_INSTAGRAM_CAROUSEL' | 'GENERATE_ALTERNATIVES' | 'USE_ALTERNATIVE'

export interface DraftPayload {
  idea_title: string
  idea_text: string
  source_id?: string
  source_ids?: string[]
  networks: SocialNetwork[]
  connection_ids?: string[]
  controls: GenerationControls
  creative_brief?: CreativeBrief
}
