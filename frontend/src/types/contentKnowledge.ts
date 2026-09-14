import type { ComposerSource } from './socialComposer'

export interface VoiceRuleSuggestion { id: string; rule: string; evidence_count: number }
export interface BrandBrain {
  id: string
  version: number
  version_id: string
  business_description: string
  audience: string
  goals: string[]
  voice: string
  voice_rules: string[]
  example_posts: string[]
  content_pillars: string[]
  calls_to_action: string[]
  visual_direction: string
  forbidden_topics: string[]
  performance_rules: string[]
  suggestions: VoiceRuleSuggestion[]
  updated_at: string
}

export interface StoryQuestion { id: string; label: string }
export interface StoryInterview {
  id: string
  week_of: string
  questions: StoryQuestion[]
  answers: Record<string, string>
  status: 'IN_PROGRESS' | 'APPROVED'
  approved_source_id: string
  approved_at: string | null
}

export type ContentSource = ComposerSource
export type ContentSourceInput = Pick<ComposerSource, 'source_type' | 'label'> & Partial<Pick<ComposerSource, 'text_content' | 'source_url' | 'original_filename' | 'metadata'>>
