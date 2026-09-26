import { Check, Circle, ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ContentStudioOnboarding } from '../../types/content'

const labels = ['Connect a social account', 'Add business and audience', 'Choose topics and schedule', 'Create the first post']

export function OnboardingChecklist({ onboarding }: { onboarding: ContentStudioOnboarding }) {
  if (onboarding.status === 'COMPLETE') return null
  return <section className="card onboarding-checklist" aria-labelledby="setup-checklist-title">
    <div className="onboarding-checklist-head"><ClipboardCheck size={21} /><div><span>SETUP CHECKLIST</span><h2 id="setup-checklist-title">Finish setting up Visiofy Studio</h2><p>{onboarding.completed_steps.length} of 4 steps complete</p></div><Link className="li-quiet-button" to="/content/onboarding">Continue setup</Link></div>
    <ol>{labels.map((label, index) => { const done = onboarding.completed_steps.includes(index + 1); return <li className={done ? 'done' : ''} key={label}>{done ? <Check size={15} /> : <Circle size={15} />}<span>{label}</span></li> })}</ol>
  </section>
}
