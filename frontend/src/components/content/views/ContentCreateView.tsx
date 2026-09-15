import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { SocialPost } from '../../../types/socialComposer'
import { SocialComposer } from '../composer/SocialComposer'
import { useContentStudio } from '../ContentStudioContext'

export function ContentCreateView({ onPostChange }: { onPostChange?: (post: SocialPost | null) => void }) {
  const { onboarding, busy, saveBusinessProfile } = useContentStudio()
  const [business, setBusiness] = useState(onboarding.business)
  useEffect(() => setBusiness(onboarding.business), [onboarding.business])

  if (!onboarding.business_profile_configured && !onboarding.business_prompt_skipped) {
    const saving = busy === 'business-profile'
    return <section className="card create-business-prompt" aria-labelledby="create-business-title">
      <div className="li-section-heading"><span>WORKSPACE PROFILE</span><h2 id="create-business-title">Tell us about this business</h2><p>These details are shared by every social account in this workspace and help generated posts stay relevant. You can change them later in Settings.</p></div>
      <div className="onboarding-form-grid"><label className="li-field"><span>Business name</span><input value={business.name === 'Your business' ? '' : business.name} placeholder="Your business" onChange={(event) => setBusiness({ ...business, name: event.target.value })} /></label><label className="li-field"><span>Language</span><select value={business.language} onChange={(event) => setBusiness({ ...business, language: event.target.value })}><option>English</option><option>Hindi</option><option>Spanish</option><option>French</option></select></label><label className="li-field full"><span>What does the business do?</span><textarea value={business.description} placeholder="Products, services, and positioning" onChange={(event) => setBusiness({ ...business, description: event.target.value })} /></label><label className="li-field full"><span>Who is the audience?</span><textarea value={business.audience} placeholder="The people these posts should help" onChange={(event) => setBusiness({ ...business, audience: event.target.value })} /></label></div>
      <div className="onboarding-actions"><button className="li-text-button" type="button" disabled={saving} onClick={() => void saveBusinessProfile({ skip: true })}>Skip for now</button><span /><button className="button button-dark" type="button" disabled={saving || !business.name.trim() || !business.description.trim() || !business.audience.trim()} aria-busy={saving} onClick={() => void saveBusinessProfile(business)}>{saving ? <LoaderCircle className="spin" size={16} /> : null} Save and create post</button></div>
    </section>
  }
  return <SocialComposer onPostChange={onPostChange} />
}
