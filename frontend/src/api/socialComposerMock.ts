import type { ComposerOptions, SocialPost } from '../types/socialComposer'

export const socialComposerMockOptions: ComposerOptions = {
  connections: [
    { network: 'LINKEDIN', label: 'LinkedIn', display_name: 'LumaDesk', account_type: 'Company Page', health: 'HEALTHY' },
    { network: 'X', label: 'X', display_name: '@lumadesk', account_type: 'Profile', health: 'HEALTHY' },
    { network: 'INSTAGRAM', label: 'Instagram', display_name: '@lumadesk', account_type: 'Business account', health: 'HEALTHY' },
  ],
  sources: [{ id: 'source-1', source_type: 'TEXT', label: 'Customer onboarding notes', text_content: 'Simple onboarding works best when every next step is visible.', source_url: '', original_filename: '', processing_status: 'READY', metadata: {}, owner_name: 'Workspace', updated_at: new Date().toISOString() }],
  drafts: [],
  generation_controls: { tones: ['Professional', 'Friendly', 'Bold', 'Educational'], goals: ['Awareness', 'Engagement', 'Education', 'Leads'], lengths: ['Short', 'Medium', 'Long'] },
}

export function makeDemoPost(ideaTitle: string, ideaText: string, networks: SocialPost['variants'][number]['network'][]): SocialPost {
  const now = new Date().toISOString()
  const copy = {
    LINKEDIN: `${ideaTitle}\n\n${ideaText}\n\nA clear next step helps a team turn a good idea into repeatable progress.`,
    X: `${ideaTitle}: ${ideaText}\n\nMake the next step obvious.`,
    INSTAGRAM: `${ideaTitle} ✨\n\n${ideaText}\n\nSave this for the next planning session.`,
  }
  return {
    id: `demo-${Date.now()}`, idea_title: ideaTitle, idea_text: ideaText, source: null, sources: [], brand_brain_version: null, state: 'DRAFT',
    controls: { tone: 'Professional', goal: 'Awareness', length: 'Medium', include_image: false }, created_at: now, updated_at: now,
    variants: networks.map((network, index) => ({
      id: `demo-variant-${index}`, network, network_label: network === 'LINKEDIN' ? 'LinkedIn' : network === 'INSTAGRAM' ? 'Instagram' : 'X',
      account: { id: `demo-account-${index}`, display_name: socialComposerMockOptions.connections.find((item) => item.network === network)?.display_name ?? '', account_type: 'Social account', health: 'HEALTHY' },
      copy: copy[network], hashtags: network === 'INSTAGRAM' ? ['#BusinessTips', '#Growth'] : ['#Business'], scheduled_for: now,
      status: 'DRAFT', metadata: {}, media: [], validation: { valid: true, fields: {} }, updated_at: now,
    })),
  }
}
