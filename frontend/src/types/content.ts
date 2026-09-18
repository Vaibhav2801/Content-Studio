import type {
  ContentBrief,
  LinkedInDashboard,
  LinkedInPost,
  LinkedInPostStatus,
  LinkedInSettings,
} from './linkedin'

export type ContentStudioSection =
  | 'home'
  | 'create'
  | 'series'
  | 'approvals'
  | 'calendar'
  | 'library'
  | 'engage'
  | 'connections'
  | 'analytics'
  | 'settings'

export interface ContentStudioNavItem {
  section: ContentStudioSection
  label: string
  path: string
  description: string
}

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
export type ConnectionHealth = 'NOT_CONNECTED' | 'HEALTHY' | 'NEEDS_ATTENTION'

export interface OnboardingConnection {
  connected: boolean
  network?: string
  status?: string
  display_name: string
  account_type: string
  health: ConnectionHealth
  message: string
  last_checked_at?: string
}

export interface OnboardingNetwork {
  network: 'LINKEDIN' | 'X' | 'INSTAGRAM'
  label: string
  enabled: boolean
}

export interface ContentStudioOnboarding {
  status: OnboardingStatus
  current_step: number
  completed_steps: number[]
  steps_total: number
  can_skip_connection: boolean
  draft_only_mode: boolean
  connection: OnboardingConnection
  networks: OnboardingNetwork[]
  business: { name: string; description: string; audience: string; language: string }
  business_profile_configured: boolean
  business_prompt_skipped: boolean
  schedule: { topics: string[]; posting_days: number[]; time: string; timezone: string }
  first_post_id: string
  updated_at: string
}

// Transitional aliases keep the existing LinkedIn API contract behind a
// platform-neutral Content Studio UI until the new backend API is adopted.
export type ContentDashboard = LinkedInDashboard
export type ContentPost = LinkedInPost
export type ContentPostStatus = LinkedInPostStatus
export type ContentSettings = LinkedInSettings
export type ContentSource = ContentBrief

export const CONTENT_STUDIO_NAV: ContentStudioNavItem[] = [
  { section: 'home', label: 'Home', path: '/content', description: 'See what needs your attention.' },
  { section: 'create', label: 'Create', path: '/content/create', description: 'Turn an idea into a post.' },
  { section: 'series', label: 'Post series', path: '/content/series', description: 'Create and schedule a sequence of posts.' },
  { section: 'approvals', label: 'Approvals', path: '/content/approvals', description: 'Review posts before they publish.' },
  { section: 'calendar', label: 'Calendar', path: '/content/calendar', description: 'See your publishing schedule.' },
  { section: 'library', label: 'Content Library', path: '/content/library', description: 'Reuse saved ideas and source material.' },
  { section: 'engage', label: 'Engage', path: '/content/engage', description: 'Review replies, run approved automations, and follow up with leads.' },
  { section: 'connections', label: 'Connections', path: '/content/connections', description: 'Check connected social accounts.' },
  { section: 'analytics', label: 'Analytics', path: '/content/analytics', description: 'Compare results and find practical improvements.' },
  { section: 'settings', label: 'Settings', path: '/content/settings', description: 'Set your brand, schedule, and approvals.' },
]
