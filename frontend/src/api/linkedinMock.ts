import type { LinkedInDashboard } from '../types/linkedin'
import type { ContentStudioOnboarding } from '../types/content'

const future = (dayOffset: number, hour = 10) => {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

const settings = {
  id: 'demo-settings',
  page_name: 'LumaDesk',
  company_description: 'A collaborative workspace for growing service businesses.',
  audience: 'Operations leaders and client service teams at growing businesses.',
  brand_voice: 'Clear, credible and human',
  content_pillars: ['Client experience', 'Team collaboration', 'Sustainable growth'],
  calls_to_action: ['Share your experience', 'Follow for more practical ideas'],
  forbidden_topics: ['Unverified statistics', 'Competitor criticism'],
  image_style: 'Premium editorial photography, deep blue and warm yellow palette, one simple focal subject',
  language: 'English',
  timezone: 'Asia/Kolkata',
  schedule_days: [0, 1, 2, 3, 4],
  post_time: '10:00:00',
  posts_per_week: 5,
  queue_horizon_days: 14,
  approval_mode: 'REQUIRE_APPROVAL' as const,
  publisher: 'MANUAL' as const,
  is_active: false,
  provider_ready: { ready: true, mode: 'manual' as const, label: 'Publishing ready', detail: 'Due posts move to Ready for posting', missing: [], target: 'MANUAL' as const },
  image_provider_ready: { ready: true, label: 'Image creation ready', detail: 'Ready for 4:5 post images' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export const linkedinMockDashboard: LinkedInDashboard = {
  settings,
  counts: { DRAFT: 2, SCHEDULED: 2, PUBLISHED: 8 },
  briefs: [{
    id: 'brief-1',
    label: 'Client handoff principles',
    context: 'LumaDesk helps service teams make client handoffs visible, consistent, and easy to improve.',
    is_evergreen: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }],
  posts: [
    {
      id: 'post-1', brief: 'brief-1', brief_label: 'Client handoff principles', topic: 'The handoff customers can feel',
      hook: 'Customers notice the space between “sold” and “started.”',
      body: 'Customers notice the space between “sold” and “started.”\n\nA strong handoff is more than an internal checklist. It is the moment a promise becomes a working relationship.\n\nMake the owner clear. Carry the context forward. Tell the customer exactly what happens next.\n\nSmall details here create confidence everywhere else.',
      hashtags: ['#CustomerExperience', '#Operations', '#BusinessGrowth'],
      image_prompt: 'Two refined ceramic forms passing a warm glowing sphere between them, deep blue studio background, premium editorial still life, directional light, generous negative space, 4:5 portrait',
      image_url: '', alt_text: 'Two sculptural forms passing a glowing sphere between them.', status: 'DRAFT',
      scheduled_for: future(1), approved_at: null, published_at: null, external_post_id: '', failure_reason: '',
      generation_metadata: { provider: 'demo' }, character_count: 463, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    {
      id: 'post-2', brief: 'brief-1', brief_label: 'Client handoff principles', topic: 'One shared client record',
      hook: 'The best client teams do not ask customers to repeat themselves.',
      body: 'The best client teams do not ask customers to repeat themselves.\n\nWhen sales, delivery, and support share the same context, every conversation starts further ahead. Less chasing. Less rework. More confidence.\n\nContinuity is part of the customer experience.',
      hashtags: ['#ClientExperience', '#Collaboration', '#Operations'], image_prompt: 'A single continuous ribbon connecting three elegant workstations, premium 3D editorial scene, deep blue and warm yellow, simple 4:5 composition',
      image_url: '', alt_text: 'One continuous ribbon connecting three work areas.', status: 'SCHEDULED', scheduled_for: future(3),
      approved_at: new Date().toISOString(), published_at: null, external_post_id: '', failure_reason: '', generation_metadata: { provider: 'demo' },
      character_count: 354, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    {
      id: 'post-3', brief: 'brief-1', brief_label: 'Client handoff principles', topic: 'Measure handoff friction',
      hook: 'Before adding another process, measure where the current handoff slows down.',
      body: 'Before adding another process, measure where the current handoff slows down.\n\nWhere is context copied? Where does ownership become unclear? Where does the customer wait?\n\nThe handoff itself is part of service quality.',
      hashtags: ['#BusinessOperations', '#CustomerSuccess', '#ServiceDesign'], image_prompt: 'A smooth polished bridge interrupted by one visible rough joint, macro editorial photograph, controlled light, blue and yellow palette, 4:5 portrait',
      image_url: '', alt_text: 'A polished bridge with one rough connection point.', status: 'SCHEDULED', scheduled_for: future(5),
      approved_at: new Date().toISOString(), published_at: null, external_post_id: '', failure_reason: '', generation_metadata: { provider: 'demo' },
      character_count: 270, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
  ],
  next_slots: [future(7), future(8), future(9)],
  server_time: new Date().toISOString(),
}

export const contentOnboardingMock: ContentStudioOnboarding = {
  status: 'COMPLETE',
  current_step: 4,
  completed_steps: [1, 2, 3, 4],
  steps_total: 4,
  can_skip_connection: true,
  draft_only_mode: true,
  connection: { connected: false, display_name: '', account_type: '', health: 'NOT_CONNECTED', message: '' },
  networks: [
    { network: 'LINKEDIN', label: 'LinkedIn', enabled: true },
    { network: 'X', label: 'X', enabled: false },
    { network: 'INSTAGRAM', label: 'Instagram', enabled: false },
  ],
  business: { name: 'LumaDesk', description: settings.company_description, audience: settings.audience, language: settings.language },
  schedule: { topics: settings.content_pillars, posting_days: settings.schedule_days, time: '10:00', timezone: settings.timezone },
  first_post_id: 'post-1',
  updated_at: new Date().toISOString(),
}
