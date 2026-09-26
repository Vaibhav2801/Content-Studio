import { Check, ChevronLeft, ChevronRight, Instagram, Linkedin, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useContentStudio } from '../ContentStudioContext'
import { ContentCreateView } from './ContentCreateView'
import type { SocialPost } from '../../../types/socialComposer'
import { contentOnboardingApi, type LinkedInAccountChoice } from '../../../api/contentOnboarding'

const steps = [
  'Connect an account',
  'Business and audience',
  'Posting schedule',
  'First post',
]
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type PendingAccountSelection = { state: string; pendingDataToken: string; connectToken: string; accounts: LinkedInAccountChoice[]; loading: boolean }

export function ContentOnboardingView() {
  const studio = useContentStudio()
  const { onboarding } = studio
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const handledReturn = useRef(false)
  const startedOnboarding = useRef(false)
  const [business, setBusiness] = useState(onboarding.business)
  const [postingDays, setPostingDays] = useState(onboarding.schedule.posting_days)
  const [postTime, setPostTime] = useState(onboarding.schedule.time)
  const [timezone, setTimezone] = useState(onboarding.schedule.timezone)
  const [firstPost, setFirstPost] = useState<SocialPost | null>(null)
  const [pendingSelection, setPendingSelection] = useState<PendingAccountSelection | null>(null)
  const [selectionError, setSelectionError] = useState('')
  const [selectionBusy, setSelectionBusy] = useState('')

  useEffect(() => {
    if (onboarding.status === 'NOT_STARTED' && !startedOnboarding.current) {
      startedOnboarding.current = true
      void studio.startOnboarding()
    }
  }, [onboarding.status, studio])

  useEffect(() => {
    const state = searchParams.get('state') || undefined
    const code = searchParams.get('code') || undefined
    const profileId = searchParams.get('profileId') || undefined
    const accountId = searchParams.get('accountId') || undefined
    const pendingDataToken = searchParams.get('pendingDataToken') || undefined
    if (!handledReturn.current && state && pendingDataToken && searchParams.get('step') === 'select_organization') {
      handledReturn.current = true
      const connectToken = searchParams.get('connect_token') || ''
      navigate('/content/onboarding', { replace: true })
      setPendingSelection({ state, pendingDataToken, connectToken, accounts: [], loading: true })
      void contentOnboardingApi.connectionChoices({ state, pending_data_token: pendingDataToken })
        .then(({ accounts }) => setPendingSelection((current) => current?.pendingDataToken === pendingDataToken ? { ...current, accounts, loading: false } : current))
        .catch((error) => {
          setSelectionError(error instanceof Error ? error.message : 'Could not load LinkedIn accounts. Start the connection again.')
          setPendingSelection((current) => current?.pendingDataToken === pendingDataToken ? { ...current, loading: false } : current)
        })
      return
    }
    const status = searchParams.get('connect_status')
    const providerError = searchParams.get('error') || undefined
    const cancelled = status === 'cancelled' || providerError === 'access_denied'
    const error = providerError || (status === 'error' ? 'connection_failed' : undefined)
    if (handledReturn.current || (!state && !error && !cancelled)) return
    handledReturn.current = true
    void studio.completeLinkedInConnection({ state, code, error, cancelled, profile_id: profileId, account_id: accountId }).finally(() => {
      navigate('/content/onboarding', { replace: true })
    })
  }, [navigate, searchParams, studio])

  useEffect(() => { setBusiness(onboarding.business) }, [onboarding.business])
  useEffect(() => {
    setPostingDays(onboarding.schedule.posting_days)
    setPostTime(onboarding.schedule.time)
    setTimezone(onboarding.schedule.timezone)
  }, [onboarding.schedule])

  const chooseAccount = async (account: LinkedInAccountChoice) => {
    if (!pendingSelection || selectionBusy) return
    setSelectionBusy(`${account.account_type}:${account.id}`)
    setSelectionError('')
    try {
      const connected = await studio.selectLinkedInConnection({
        state: pendingSelection.state,
        pending_data_token: pendingSelection.pendingDataToken,
        account_type: account.account_type,
        organization_id: account.account_type === 'ORGANIZATION' ? account.id : undefined,
        connect_token: pendingSelection.connectToken,
      })
      if (connected) setPendingSelection(null)
    } finally { setSelectionBusy('') }
  }
  const cancelSelection = async () => {
    await studio.cancelLinkedInConnection()
    setPendingSelection(null)
  }

  const current = onboarding.current_step
  const goBack = () => void studio.moveOnboardingStep(Math.max(1, current - 1))
  const saveBusiness = () => studio.completeOnboardingStep(2, business)
  const saveSchedule = () => studio.completeOnboardingStep(3, {
    posting_days: postingDays,
    time: postTime,
    timezone,
  })
  const finish = async () => {
    if (!firstPost) return
    const saved = await studio.completeOnboardingStep(4, { post_id: firstPost.id })
    if (saved?.status === 'COMPLETE') navigate('/content')
  }

  if (pendingSelection) return <section className="onboarding" aria-labelledby="linkedin-account-title">
    <div className="card onboarding-panel">
      <div className="onboarding-panel-head"><span>CONNECT LINKEDIN</span><h2 id="linkedin-account-title">Choose where to publish</h2><p>Select your personal LinkedIn profile or a Company Page.</p></div>
      {pendingSelection.loading ? <div className="li-loading" role="status"><LoaderCircle className="spin" size={18} /> Loading your LinkedIn accounts…</div> : null}
      {selectionError ? <div className="onboarding-plain-error" role="alert"><TriangleAlert size={17} /><span>{selectionError}</span></div> : null}
      {!pendingSelection.loading && !selectionError ? <div className="onboarding-networks">
        {pendingSelection.accounts.map((account) => {
          const personal = account.account_type === 'PERSON'
          const pending = selectionBusy === `${account.account_type}:${account.id}`
          return <article className="onboarding-network featured" key={`${account.account_type}:${account.id}`}>
            <span className="onboarding-network-icon"><Linkedin size={20} /></span>
            <div><h3>{account.name}</h3>{account.vanity_name ? <p>linkedin.com/{personal ? 'in' : 'company'}/{account.vanity_name}</p> : <p>{personal ? 'Personal LinkedIn profile' : 'LinkedIn Company Page'}</p>}</div>
            <button className="button button-dark" type="button" disabled={Boolean(selectionBusy)} aria-busy={pending} onClick={() => void chooseAccount(account)}>{pending ? <LoaderCircle className="spin" size={16} /> : null} Connect {personal ? 'Profile' : 'Page'}</button>
          </article>
        })}
      </div> : null}
      <div className="onboarding-actions"><button className="li-quiet-button" type="button" disabled={Boolean(selectionBusy)} onClick={() => void cancelSelection()}>Cancel</button>{selectionError ? <button className="button button-dark" type="button" onClick={() => void studio.connectLinkedIn('LINKEDIN')}>Try again</button> : null}</div>
    </div>
  </section>

  return <section className="onboarding" aria-labelledby="onboarding-step-title">
    <div className="onboarding-progress"><div><span>Step {current} of 4</span><progress value={current} max={4}>Step {current} of 4</progress></div><ol>{steps.map((label, index) => { const number = index + 1; const done = onboarding.completed_steps.includes(number); const available = number <= current || done; return <li key={label}><button type="button" disabled={!available} className={number === current ? 'current' : done ? 'done' : ''} aria-current={number === current ? 'step' : undefined} onClick={() => available && void studio.moveOnboardingStep(number)}>{done ? <Check size={15} /> : <span>{number}</span>}<small>{label}</small></button></li> })}</ol></div>

    {current === 1 && <div className="card onboarding-panel">
      <div className="onboarding-panel-head"><span>STEP 1</span><h2 id="onboarding-step-title">Connect a social account</h2><p>Choose a supported social network. It will display its own secure authorization screen so you can review access before continuing.</p></div>
      <div className="onboarding-networks">
        {onboarding.networks.map((network) => <article className={`onboarding-network ${network.network === 'LINKEDIN' ? 'featured' : ''}`} key={network.network}>
          <span className="onboarding-network-icon">{network.network === 'LINKEDIN' ? <Linkedin size={20} /> : network.network === 'INSTAGRAM' ? <Instagram size={20} /> : <strong>X</strong>}</span>
          <div><h3>{network.label}</h3><p>{network.network === 'LINKEDIN' ? 'Connect a Company Page or profile.' : network.network === 'INSTAGRAM' ? 'Connect a Business or Creator account for image posts.' : network.enabled ? 'Available for this workspace.' : 'Not available yet.'}</p></div>
          {network.network === 'LINKEDIN' || network.network === 'INSTAGRAM' ? <>{onboarding.connection.connected && onboarding.connection.health === 'HEALTHY' && (onboarding.connection.network || 'LINKEDIN') === network.network ? <span className="connection-health healthy"><Check size={15} /> Connected</span> : <button className="button button-dark" type="button" disabled={!network.enabled || studio.busy === 'connection'} aria-busy={studio.busy === 'connection'} onClick={() => void studio.connectLinkedIn(network.network as 'LINKEDIN' | 'INSTAGRAM')}>{studio.busy === 'connection' ? <LoaderCircle className="spin" size={16} /> : null}{onboarding.connection.health === 'NEEDS_ATTENTION' && (onboarding.connection.network || 'LINKEDIN') === network.network ? 'Reconnect' : `Connect ${network.label}`}</button>}</> : <span className={`availability ${network.enabled ? 'enabled' : ''}`}>{network.enabled ? 'Available' : 'Coming later'}</span>}
        </article>)}
      </div>
      {onboarding.connection.display_name && <div className={`onboarding-connection-summary ${onboarding.connection.health === 'HEALTHY' ? 'healthy' : 'attention'}`}>{onboarding.connection.health === 'HEALTHY' ? <Check size={18} /> : <TriangleAlert size={18} />}<div><strong>{onboarding.connection.display_name}</strong><span>{onboarding.connection.account_type} · {onboarding.connection.health === 'HEALTHY' ? 'Connection healthy' : 'Needs attention'}</span><small>{onboarding.connection.message}</small></div></div>}
      {!onboarding.connection.display_name && onboarding.connection.message && <div className="onboarding-plain-error" role="status"><TriangleAlert size={17} /><span>{onboarding.connection.message}</span></div>}
      <div className="onboarding-actions"><Link to="/content" className="li-text-button">Exit setup</Link>{onboarding.can_skip_connection && !onboarding.connection.connected && <button className="li-text-button" type="button" onClick={() => void studio.completeOnboardingStep(1, { skip: true })}>Skip for now and create drafts</button>}<button className="button button-dark" type="button" disabled={!onboarding.connection.connected} onClick={() => void studio.completeOnboardingStep(1, { skip: false })}>Continue <ChevronRight size={16} /></button></div>
    </div>}

    {current === 2 && <div className="card onboarding-panel">
      <div className="onboarding-panel-head"><span>STEP 2</span><h2 id="onboarding-step-title">Tell us about the business</h2><p>This helps Visiofy Studio write useful posts in the right voice.</p></div>
      <div className="onboarding-form-grid"><label className="li-field"><span>Business name</span><input value={business.name} onChange={(event) => setBusiness({ ...business, name: event.target.value })} /></label><label className="li-field"><span>Language</span><select value={business.language} onChange={(event) => setBusiness({ ...business, language: event.target.value })}><option>English</option><option>Hindi</option><option>Spanish</option><option>French</option></select></label><label className="li-field full"><span>What does the business do?</span><textarea value={business.description} onChange={(event) => setBusiness({ ...business, description: event.target.value })} /></label><label className="li-field full"><span>Who is the audience?</span><textarea value={business.audience} onChange={(event) => setBusiness({ ...business, audience: event.target.value })} /></label></div>
      <WizardActions onBack={goBack} onContinue={saveBusiness} />
    </div>}

    {current === 3 && <div className="card onboarding-panel">
      <div className="onboarding-panel-head"><span>STEP 3</span><h2 id="onboarding-step-title">Set a posting schedule</h2><p>Choose when approved posts can be published. You can change this later in Settings.</p></div>
      <fieldset className="onboarding-days"><legend>Posting days</legend>{days.map((day, index) => { const selected = postingDays.includes(index); return <button type="button" aria-pressed={selected} className={selected ? 'selected' : ''} key={day} onClick={() => setPostingDays(selected ? postingDays.filter((item) => item !== index) : [...postingDays, index].sort())}>{day}</button> })}</fieldset>
      <div className="onboarding-form-grid"><label className="li-field"><span>Posting time</span><input type="time" value={postTime} onChange={(event) => setPostTime(event.target.value)} /></label><label className="li-field"><span>Timezone</span><select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option>Asia/Kolkata</option><option>Europe/London</option><option>America/New_York</option><option>UTC</option></select></label></div>
      <WizardActions onBack={goBack} onContinue={saveSchedule} />
    </div>}

    {current === 4 && <div className="onboarding-first-post"><div className="card onboarding-first-post-intro"><span>STEP 4</span><h2 id="onboarding-step-title">Generate and review your first post</h2><p>Create a draft, check the preview, and make any changes before finishing setup.</p></div><ContentCreateView onPostChange={setFirstPost} /><div className="card onboarding-finish"><button className="li-quiet-button" type="button" onClick={goBack}><ChevronLeft size={16} /> Back</button><span>{firstPost ? 'Your first post is ready to review.' : 'Create a post to finish setup.'}</span><button className="button button-dark" type="button" disabled={!firstPost} onClick={() => void finish()}>Finish setup <Check size={16} /></button></div></div>}
  </section>
}

function WizardActions({ onBack, onContinue }: { onBack: () => void; onContinue: () => Promise<unknown> }) {
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (saving) return
    setSaving(true)
    try { await onContinue() }
    finally { setSaving(false) }
  }

  return <div className="onboarding-actions"><button className="li-quiet-button" type="button" disabled={saving} onClick={onBack}><ChevronLeft size={16} /> Back</button><span /><button className="button button-dark" type="button" disabled={saving} aria-busy={saving} onClick={() => void save()}>{saving ? <><LoaderCircle className="spin" size={16} /> Saving…</> : <>Save and continue <ChevronRight size={16} /></>}</button></div>
}
