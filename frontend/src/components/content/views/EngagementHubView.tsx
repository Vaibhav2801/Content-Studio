import {
  BarChart3, Check, CheckCircle2, ChevronDown, Clipboard, ExternalLink, Instagram, Linkedin,
  MessageCircleMore, MousePointerClick, Pause, Play, Plus, Search, Send, ShieldCheck, Sparkles,
  Users, WandSparkles, X, Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { contentStudioApi } from '../../../api/contentStudio'
import type {
  EngagementAnalytics as AnalyticsData, EngagementAutomation, EngagementAutomationKind,
  EngagementCampaign, EngagementConnection, EngagementContactSummary, EngagementOverview, EngagementReview, EngagementTeamMember,
} from '../../../types/engagement'
import './EngagementHubView.css'

type EngageView = 'review' | 'automations' | 'campaigns' | 'analytics' | 'linkedin'
type ReviewFilter = 'all' | 'mine' | 'instagram' | 'linkedin'

const navItems: Array<{ id: EngageView; label: string; icon: typeof CheckCircle2 }> = [
  { id: 'review', label: 'Review', icon: CheckCircle2 },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'campaigns', label: 'Campaigns', icon: Send },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'linkedin', label: 'LinkedIn Copilot', icon: Linkedin },
]

const automationKinds: Array<{ value: EngagementAutomationKind; label: string; description: string }> = [
  { value: 'COMMENT_TO_DM', label: 'Comment to DM', description: 'A keyword comment prepares a public reply and private message.' },
  { value: 'STORY_REPLY', label: 'Story reply', description: 'A story response prepares the exact approved reply.' },
  { value: 'DM_KEYWORD', label: 'DM keyword', description: 'A word in a DM prepares a conversation response.' },
  { value: 'CLICK_TO_DM', label: 'Click-to-DM ad', description: 'Welcome people who open a chat from an Instagram ad.' },
]

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

function relativeTime(value: string) {
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} hr ago` : `${Math.floor(hours / 24)} d ago`
}

export function EngagementHubView() {
  const [view, setView] = useState<EngageView>('review')
  const [data, setData] = useState<EngagementOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    try { setError(''); setData(await contentStudioApi.engagement()) }
    catch (caught) { setError(errorMessage(caught)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3600)
  }
  const updateData = (updater: (current: EngagementOverview) => EngagementOverview) => {
    setData((current) => current ? updater(current) : current)
  }
  const replaceReview = (review: EngagementReview) => updateData((current) => ({
    ...current,
    reviews: ['SENT', 'DISMISSED'].includes(review.status)
      ? current.reviews.filter((item) => item.id !== review.id)
      : current.reviews.map((item) => item.id === review.id ? review : item),
  }))
  const replaceAutomation = (automation: EngagementAutomation) => updateData((current) => ({
    ...current, automations: current.automations.map((item) => item.id === automation.id ? automation : item),
  }))
  const replaceCampaign = (campaign: EngagementCampaign) => updateData((current) => ({
    ...current, campaigns: current.campaigns.map((item) => item.id === campaign.id ? campaign : item),
  }))

  return <section className="engagement-hub" aria-label="Engagement workspace">
    <div className="engage-safety-strip"><span><ShieldCheck size={18} /></span><div><strong>Human approval is always on</strong><small>AI can suggest copy, but nothing new is posted or sent until a person approves it.</small></div></div>
    <nav className="engage-tabs" aria-label="Engagement tools">{navItems.map((item) => {
      const Icon = item.icon
      return <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}><Icon size={16} /><span>{item.label}</span>{item.id === 'review' && (data?.reviews.length ?? 0) > 0 ? <small>{data?.reviews.length}</small> : null}</button>
    })}</nav>
    {notice && <div className="engage-toast" role="status"><CheckCircle2 size={17} />{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {error && <div className="engage-toast" role="alert"><X size={17} />{error}<button type="button" onClick={() => void load()}>Try again</button></div>}
    {loading && <div className="engage-empty" aria-live="polite"><Sparkles size={30} /><h3>Loading engagement workspace…</h3></div>}
    {!loading && data && view === 'review' && <ReviewWorkspace reviews={data.reviews} team={data.team} connections={data.connections} onReplace={replaceReview} showNotice={showNotice} />}
    {!loading && data && view === 'automations' && <AutomationsWorkspace automations={data.automations} team={data.team} connections={data.connections} onCreate={(item) => updateData((current) => ({ ...current, automations: [item, ...current.automations] }))} onReplace={replaceAutomation} showNotice={showNotice} />}
    {!loading && data && view === 'campaigns' && <CampaignsWorkspace campaigns={data.campaigns} team={data.team} connections={data.connections} contacts={data.contacts} onCreate={(item) => updateData((current) => ({ ...current, campaigns: [item, ...current.campaigns] }))} onReplace={replaceCampaign} showNotice={showNotice} />}
    {!loading && data && view === 'analytics' && <EngagementAnalytics analytics={data.analytics} team={data.team} reviews={data.reviews} />}
    {!loading && data && view === 'linkedin' && <LinkedInCopilot reviews={data.reviews.filter((item) => item.platform === 'linkedin')} team={data.team} onReplace={replaceReview} showNotice={showNotice} />}
  </section>
}

function ReviewWorkspace({ reviews, team, connections, onReplace, showNotice }: { reviews: EngagementReview[]; team: EngagementTeamMember[]; connections: EngagementConnection[]; onReplace: (item: EngagementReview) => void; showNotice: (message: string) => void }) {
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [connectionId, setConnectionId] = useState('all')
  const [query, setQuery] = useState('')
  const currentUser = team.find((member) => member.is_current_user)
  const connectedAccounts = useMemo(() => connections.filter((item) => item.connected && item.engagement_supported), [connections])
  const filtered = useMemo(() => reviews.filter((item) => {
    if (filter === 'mine' && item.assignee_id !== currentUser?.id) return false
    if ((filter === 'instagram' || filter === 'linkedin') && item.platform !== filter) return false
    if (connectionId !== 'all' && item.connection_id !== connectionId) return false
    return `${item.person} ${item.handle} ${item.account_name} ${item.incoming} ${item.draft}`.toLowerCase().includes(query.toLowerCase())
  }), [connectionId, currentUser?.id, filter, query, reviews])
  return <div className="engage-view">
    <section className="engage-intro"><div><span className="engage-eyebrow">ONE CLEAR QUEUE</span><h2>Review AI suggestions</h2><p>Edit the draft, choose an owner, and approve when it sounds right. Solo users and teams follow the same flow.</p></div><div className="engage-mini-stats"><span><strong>{reviews.length}</strong>Waiting</span><span><strong>{reviews.filter((item) => item.assignee_id === currentUser?.id).length}</strong>Assigned to you</span><span><strong>{reviews.filter((item) => item.status === 'FAILED').length}</strong>Need retry</span></div></section>
    <div className="engage-toolbar"><div className="engage-toolbar-filters"><div className="engage-filters" role="group" aria-label="Filter review queue">{([['all', 'All'], ['mine', 'Mine'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn']] as Array<[ReviewFilter, string]>).map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}{id === 'all' ? <span>{reviews.length}</span> : null}</button>)}</div><label className="engage-account-filter"><span className="sr-only">Connected account</span><select aria-label="Connected account" value={connectionId} onChange={(event) => setConnectionId(event.target.value)}><option value="all">All accounts</option>{connectedAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.platform === 'instagram' ? 'Instagram' : 'LinkedIn'}</option>)}</select><ChevronDown size={14} /></label></div><label className="engage-search"><Search size={16} /><span className="sr-only">Search reviews</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people or messages" /></label></div>
    {filtered.length ? <div className="review-inbox">{filtered.map((item) => <ReviewCard key={item.id} item={item} team={team} onReplace={onReplace} showNotice={showNotice} />)}</div> : <div className="engage-empty"><CheckCircle2 size={34} /><h3>You’re all caught up</h3><p>No suggestions match this view.</p></div>}
  </div>
}

function ReviewCard({ item, team, onReplace, showNotice }: { item: EngagementReview; team: EngagementTeamMember[]; onReplace: (item: EngagementReview) => void; showNotice: (message: string) => void }) {
  const [draft, setDraft] = useState(item.draft)
  const [busy, setBusy] = useState(false)
  const PlatformIcon = item.platform === 'instagram' ? Instagram : Linkedin
  const update = async (payload: { draft?: string; assignee_id?: string }, message?: string) => {
    try {
      setBusy(true)
      const updated = await contentStudioApi.updateEngagementReview(item.id, payload)
      onReplace(updated)
      if (message) showNotice(message)
    } catch (error) { showNotice(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const action = async (name: 'GENERATE' | 'APPROVE_SEND' | 'RETRY' | 'DISMISS') => {
    try {
      setBusy(true)
      const updated = await contentStudioApi.engagementReviewAction(item.id, name, draft)
      onReplace(updated)
      if (name === 'GENERATE') {
        setDraft(updated.draft)
        showNotice('AI suggestion is ready for your review.')
      } else {
        showNotice(name === 'DISMISS' ? 'Suggestion dismissed.' : item.platform === 'linkedin' ? 'Public reply approved and posted.' : 'Reply approved and sent.')
      }
    } catch (error) { showNotice(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <article className="engage-review-card">
    <div className="review-person"><span className={`engage-platform-icon ${item.platform}`}><PlatformIcon size={18} /></span><div><strong>{item.person}</strong><small>{item.handle}</small></div><span className="review-account-name" title={item.account_name}>{item.account_name}</span><span className="review-time">{relativeTime(item.received_at)}</span></div>
    <div className="review-context"><span>{item.kind}</span><small>{item.source}</small><blockquote>{item.incoming}</blockquote></div>
    <label className="review-draft"><span><Sparkles size={15} /> AI suggestion <small>{item.status === 'FAILED' ? item.error : 'Not sent'}</small></span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
    <footer>
      <label className="review-assignee"><Users size={15} /><span className="sr-only">Assignee</span><select value={item.assignee_id} disabled={busy} onChange={(event) => void update({ assignee_id: event.target.value })}><option value="">Unassigned</option>{team.map((person) => <option key={person.id} value={person.id}>{person.is_current_user ? 'You' : person.name}</option>)}</select><ChevronDown size={14} /></label>
      <button className="li-text-button" type="button" disabled={busy} onClick={() => void action('DISMISS')}>Dismiss</button>
      <button className="li-quiet-button" type="button" disabled={busy} onClick={() => void action('GENERATE')}><Sparkles size={15} />Improve with AI</button>
      <button className="li-quiet-button" type="button" disabled={busy || draft === item.draft} onClick={() => void update({ draft }, 'Draft saved.')}>Save draft</button>
      <button className="button button-dark" type="button" disabled={busy || !draft.trim() || !item.can_send} onClick={() => void action(item.status === 'FAILED' ? 'RETRY' : 'APPROVE_SEND')}><Check size={16} />{busy ? 'Working…' : item.status === 'FAILED' ? 'Retry send' : `Approve ${item.platform === 'linkedin' ? 'reply' : '& send'}`}</button>
    </footer>
  </article>
}

function AutomationsWorkspace({ automations, team, connections, onCreate, onReplace, showNotice }: { automations: EngagementAutomation[]; team: EngagementTeamMember[]; connections: EngagementConnection[]; onCreate: (item: EngagementAutomation) => void; onReplace: (item: EngagementAutomation) => void; showNotice: (message: string) => void }) {
  const instagram = connections.filter((item) => item.platform === 'instagram' && item.engagement_supported)
  const currentUser = team.find((item) => item.is_current_user)
  const [creating, setCreating] = useState(false)
  const [kind, setKind] = useState<EngagementAutomationKind>('COMMENT_TO_DM')
  const [name, setName] = useState('')
  const [keyword, setKeyword] = useState('')
  const [message, setMessage] = useState('')
  const [publicReply, setPublicReply] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!connectionId && instagram[0]) setConnectionId(instagram[0].id)
    if (!ownerId && currentUser) setOwnerId(currentUser.id)
  }, [connectionId, currentUser, instagram, ownerId])
  const create = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setBusy(true)
      const item = await contentStudioApi.createEngagementAutomation({
        connection_id: connectionId, kind, name: name.trim(),
        keywords: keyword.split(',').map((value) => value.trim()).filter(Boolean),
        match_mode: 'contains', dm_message: message.trim(), comment_reply: publicReply.trim(), owner_id: ownerId || undefined,
      })
      onCreate(item)
      setName(''); setKeyword(''); setMessage(''); setPublicReply(''); setCreating(false)
      showNotice('Automation created in review mode. Nothing will run until it is approved.')
    } catch (error) { showNotice(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const action = async (item: EngagementAutomation) => {
    const name = item.status === 'ACTIVE' ? 'PAUSE' : item.status === 'DRAFT' || item.status === 'FAILED' ? 'APPROVE' : 'ACTIVATE'
    try {
      const updated = await contentStudioApi.engagementAutomationAction(item.id, name)
      onReplace(updated)
      showNotice(`${updated.name} is now ${updated.state.toLowerCase()}.`)
    } catch (error) { showNotice(errorMessage(error)) }
  }
  return <div className="engage-view">
    <section className="engage-intro"><div><span className="engage-eyebrow">APPROVED RULES, PREDICTABLE REPLIES</span><h2>Simple automations</h2><p>Choose what starts the flow and the exact suggested reply. Every matched response still goes to the review queue.</p></div><button className="button button-dark" type="button" disabled={!instagram.length} onClick={() => setCreating((value) => !value)}>{creating ? <X size={16} /> : <Plus size={16} />}{creating ? 'Close' : 'New automation'}</button></section>
    {!instagram.length && <div className="campaign-guardrail"><Instagram size={19} /><div><strong>Connect Instagram to begin</strong><span>A connected Instagram business or creator account is required for engagement automations.</span></div></div>}
    {creating && <form className="quick-automation" onSubmit={(event) => void create(event)}>
      <div><WandSparkles size={21} /><span><strong>Create a simple automation</strong><small>It starts in review mode.</small></span></div>
      <label>Account<select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>{instagram.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Type<select value={kind} onChange={(event) => setKind(event.target.value as EngagementAutomationKind)}>{automationKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Send pricing guide" autoFocus /></label>
      <label>Keywords<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Example: PRICE, PLANS" /></label>
      <label>Suggested DM<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Exact message a reviewer can approve" /></label>
      {kind === 'COMMENT_TO_DM' && <label>Suggested public reply<textarea value={publicReply} onChange={(event) => setPublicReply(event.target.value)} placeholder="Example: I’ll send the details privately." /></label>}
      <label>Reviewer<select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>{team.map((person) => <option key={person.id} value={person.id}>{person.is_current_user ? 'You' : person.name}</option>)}</select></label>
      <button className="button button-dark" disabled={busy || !name.trim() || !keyword.trim() || !message.trim()} type="submit">{busy ? 'Creating…' : 'Create for review'}</button>
    </form>}
    <div className="automation-kind-grid">{automationKinds.map((item) => <div key={item.value}><CheckCircle2 size={16} /><span><strong>{item.label}</strong><small>{item.description}</small></span></div>)}</div>
    {automations.length ? <div className="automation-list">{automations.map((item) => <AutomationCard key={item.id} item={item} onAction={() => void action(item)} />)}</div> : <div className="engage-empty"><Zap size={30} /><h3>No automations yet</h3><p>Create one rule, approve it, and matched conversations will appear in Review.</p></div>}
  </div>
}

function AutomationCard({ item, onAction }: { item: EngagementAutomation; onAction: () => void }) {
  const icons = { COMMENT_TO_DM: MessageCircleMore, STORY_REPLY: Instagram, DM_KEYWORD: Search, CLICK_TO_DM: MousePointerClick }
  const Icon = icons[item.kind]
  const trigger = item.keywords.length ? `${item.match_mode} “${item.keywords.join('”, “')}”` : 'No keywords'
  return <article className="automation-row"><span className="automation-row-icon"><Icon size={19} /></span><div className="automation-main"><span>{item.type}</span><h3>{item.name}</h3><p>Matched replies are prepared for human review; no generated copy is sent automatically.</p><dl><div><dt>When</dt><dd>{trigger}</dd></div><div><dt>Suggest</dt><dd>{item.dm_message}</dd></div></dl></div><div className="automation-owner"><span className={`automation-state ${item.state.toLowerCase().replaceAll(' ', '-')}`}>{item.state}</span><small>{item.runs} conversations</small><small>Owner: {item.owner}</small>{item.error && <small>{item.error}</small>}</div><div className="automation-actions"><button className="automation-play" type="button" aria-label={item.status === 'ACTIVE' ? `Pause ${item.name}` : item.status === 'DRAFT' ? `Approve ${item.name}` : `Activate ${item.name}`} onClick={onAction}>{item.status === 'ACTIVE' ? <Pause size={15} /> : <Play size={15} />}</button></div></article>
}

function CampaignsWorkspace({ campaigns, team, connections, contacts, onCreate, onReplace, showNotice }: { campaigns: EngagementCampaign[]; team: EngagementTeamMember[]; connections: EngagementConnection[]; contacts: EngagementContactSummary[]; onCreate: (item: EngagementCampaign) => void; onReplace: (item: EngagementCampaign) => void; showNotice: (message: string) => void }) {
  const instagram = connections.filter((item) => item.platform === 'instagram' && item.engagement_supported)
  const currentUser = team.find((item) => item.is_current_user)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [firstMessage, setFirstMessage] = useState('')
  const [secondMessage, setSecondMessage] = useState('')
  const [delay, setDelay] = useState(2880)
  const [connectionId, setConnectionId] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!connectionId && instagram[0]) setConnectionId(instagram[0].id) }, [connectionId, instagram])
  const create = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setBusy(true)
      const steps = [{ message: firstMessage.trim(), delay_minutes: 0 }]
      if (secondMessage.trim()) steps.push({ message: secondMessage.trim(), delay_minutes: delay })
      const item = await contentStudioApi.createEngagementCampaign({
        connection_id: connectionId, name: name.trim(),
        audience: { contact_ids: selectedContacts, label: 'Selected Instagram contacts' },
        steps, owner_id: currentUser?.id,
      })
      onCreate(item)
      setName(''); setSelectedContacts([]); setFirstMessage(''); setSecondMessage(''); setCreating(false)
      showNotice('Campaign saved as a draft. Review and approve it before starting.')
    } catch (error) { showNotice(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const action = async (item: EngagementCampaign) => {
    const actionName = item.status === 'DRAFT' || item.status === 'FAILED' ? 'APPROVE' : item.status === 'ACTIVE' ? 'PAUSE' : 'START'
    try {
      const updated = await contentStudioApi.engagementCampaignAction(item.id, actionName)
      onReplace(updated)
      showNotice(`${updated.name} is now ${updated.state.toLowerCase()}.`)
    } catch (error) { showNotice(errorMessage(error)) }
  }
  return <div className="engage-view">
    <section className="engage-intro"><div><span className="engage-eyebrow">APPROVE BEFORE SCHEDULING</span><h2>Campaigns and sequences</h2><p>Choose eligible contacts, approve exact messages, then start. Replies and unsubscribes stop the sequence.</p></div><button className="button button-dark" type="button" disabled={!instagram.length} onClick={() => setCreating((value) => !value)}>{creating ? <X size={16} /> : <Plus size={16} />}{creating ? 'Close' : 'New campaign'}</button></section>
    <div className="campaign-guardrail"><ShieldCheck size={19} /><div><strong>Built-in sending guardrails</strong><span>Only selected Instagram contacts are enrolled. Every audience and message requires approval, and contacts exit when they reply or unsubscribe.</span></div></div>
    {creating && <form className="quick-automation" onSubmit={(event) => void create(event)}>
      <div><Send size={21} /><span><strong>Create campaign draft</strong><small>Nothing is enrolled yet.</small></span></div>
      <label>Account<select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>{instagram.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Demo follow-up" /></label>
      <fieldset className="campaign-audience-picker"><legend>Instagram contacts</legend>{contacts.length ? <div>{contacts.map((contact) => <label key={contact.id}><input type="checkbox" checked={selectedContacts.includes(contact.id)} onChange={() => setSelectedContacts((current) => current.includes(contact.id) ? current.filter((id) => id !== contact.id) : [...current, contact.id])} /><span><strong>{contact.name}</strong><small>{contact.handle}</small></span></label>)}</div> : <p>Contacts appear after someone messages or comments.</p>}</fieldset>
      <label>First approved message<textarea value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} placeholder="Message sent when the campaign starts" /></label>
      <label>Optional follow-up<textarea value={secondMessage} onChange={(event) => setSecondMessage(event.target.value)} placeholder="Leave blank for one step" /></label>
      {secondMessage && <label>Follow-up delay (minutes)<input type="number" min="1" value={delay} onChange={(event) => setDelay(Number(event.target.value))} /></label>}
      <button className="button button-dark" disabled={busy || !name.trim() || !selectedContacts.length || !firstMessage.trim()} type="submit">{busy ? 'Saving…' : 'Save campaign draft'}</button>
    </form>}
    {campaigns.length ? <div className="campaign-grid">{campaigns.map((item) => <article className="campaign-card" key={item.id}><header><span className="engage-platform-icon instagram"><Instagram size={18} /></span><span className={`campaign-status ${item.status === 'ACTIVE' ? 'active' : 'review'}`}>{item.state}</span></header><h3>{item.name}</h3><p>{item.audience.label || 'Selected Instagram contacts'}</p><div className="campaign-steps">{item.steps.map((step, index) => <span key={`${item.id}-${index}`}><i>{index + 1}</i><strong>{step.message}</strong><small>{index === 0 ? 'On start' : `${step.delay_minutes} minutes later`} · stop on reply</small></span>)}</div><dl><div><dt>Eligible audience</dt><dd>{item.audience.contact_ids?.length ?? 0} contacts</dd></div><div><dt>Owner</dt><dd>{item.owner}</dd></div></dl>{item.error && <p>{item.error}</p>}<button className={item.status === 'ACTIVE' ? 'li-quiet-button' : 'button button-dark'} type="button" onClick={() => void action(item)}>{item.status === 'ACTIVE' ? <Pause size={15} /> : <Play size={15} />}{item.status === 'DRAFT' || item.status === 'FAILED' ? 'Approve campaign' : item.status === 'ACTIVE' ? 'Pause campaign' : 'Start campaign'}</button></article>)}</div> : <div className="engage-empty"><Send size={30} /><h3>No campaigns yet</h3><p>Create a small, focused sequence for eligible Instagram contacts.</p></div>}
  </div>
}

function EngagementAnalytics({ analytics, team, reviews }: { analytics: AnalyticsData; team: EngagementTeamMember[]; reviews: EngagementReview[] }) {
  const maximum = Math.max(1, ...analytics.sources.map((item) => item.value))
  return <div className="engage-view">
    <section className="engage-intro"><div><span className="engage-eyebrow">CLEAR, USEFUL NUMBERS</span><h2>Engagement analytics</h2><p>See which approved flows start conversations and where your team needs attention.</p></div></section>
    <div className="engagement-metrics"><article><span>Conversations started</span><strong>{analytics.conversations_started}</strong><small>Known contacts and campaign enrollments</small></article><article><span>Replies approved</span><strong>{analytics.replies_approved}</strong><small>{analytics.pending_reviews} waiting for review</small></article><article><span>Reply rate</span><strong>{analytics.reply_rate}%</strong><small>Across known conversations</small></article><article><span>Link clicks</span><strong>{analytics.link_clicks}</strong><small>Tracked automation links</small></article></div>
    <div className="engagement-analytics-grid"><section className="card engage-chart"><header><div><h3>Conversations by source</h3><p>Runs recorded by approved rule.</p></div><BarChart3 size={20} /></header><div>{analytics.sources.map((bar) => <div className="engage-bar" key={bar.label}><span>{bar.label}</span><i><b style={{ width: `${(bar.value / maximum) * 100}%` }} /></i><strong>{bar.value}</strong></div>)}</div></section><section className="card team-performance"><header><div><h3>Team review load</h3><p>Suggestions currently assigned.</p></div></header>{team.map((member) => { const waiting = reviews.filter((item) => item.assignee_id === member.id).length; return <div key={member.id}><span>{member.name.slice(0, 1).toUpperCase()}</span><strong>{member.is_current_user ? 'You' : member.name}<small>{waiting} waiting</small></strong><em>{member.role.toLowerCase()}</em></div> })}</section></div>
  </div>
}

function LinkedInCopilot({ reviews, team, onReplace, showNotice }: { reviews: EngagementReview[]; team: EngagementTeamMember[]; onReplace: (item: EngagementReview) => void; showNotice: (message: string) => void }) {
  const first = reviews[0]
  const manualDraft = first ? `Hi ${first.person.split(' ')[0]} — thanks for your question on our post. I wanted to follow up personally in case more detail would be useful.` : 'Write a short personal follow-up after you have replied publicly.'
  const copy = async () => {
    try { await navigator.clipboard.writeText(manualDraft); showNotice('Draft copied. Open LinkedIn and send it yourself.') }
    catch { showNotice('Copy is unavailable in this browser. Select the draft text manually.') }
  }
  return <div className="engage-view">
    <section className="engage-intro"><div><span className="engage-eyebrow">LINKEDIN ENGAGEMENT COPILOT</span><h2>Turn comments into thoughtful follow-up</h2><p>AI suggests public replies and personal follow-ups. Your team reviews everything; personal messages are always sent manually on LinkedIn.</p></div><span className="linkedin-compliance"><ShieldCheck size={17} />Compliant, human-led workflow</span></section>
    <div className="linkedin-limit"><Linkedin size={22} /><div><strong>What this workspace can do</strong><p>Manage Company Page comments, suggest replies, identify leads, assign follow-up, and prepare a personal message for a human to send.</p></div><div><strong>What stays manual</strong><p>Connection requests, personal DMs, and InMail are never automated.</p></div></div>
    <div className="copilot-layout"><section className="copilot-comments"><header><div><h3>Comments to review</h3><p>Company Page comments appear here.</p></div><span>{reviews.length}</span></header>{reviews.length ? reviews.map((item) => <LinkedInReview key={item.id} item={item} team={team} onReplace={onReplace} showNotice={showNotice} />) : <div className="engage-empty"><CheckCircle2 size={30} /><h3>No LinkedIn comments waiting</h3></div>}</section><aside className="manual-followup"><span className="manual-followup-icon"><Clipboard size={20} /></span><h3>Personal follow-up draft</h3><p>{first ? `For ${first.person} · after the public reply` : 'Prepared for manual sending'}</p><div>{manualDraft}</div><button className="li-quiet-button" type="button" onClick={() => void copy()}><Clipboard size={15} />Copy draft</button><a className="button button-dark" href="https://www.linkedin.com" target="_blank" rel="noreferrer">Open LinkedIn <ExternalLink size={14} /></a><small>This product cannot send personal LinkedIn messages for you.</small></aside></div>
  </div>
}

function LinkedInReview({ item, team, onReplace, showNotice }: { item: EngagementReview; team: EngagementTeamMember[]; onReplace: (item: EngagementReview) => void; showNotice: (message: string) => void }) {
  const [draft, setDraft] = useState(item.draft)
  const approve = async () => {
    try { onReplace(await contentStudioApi.engagementReviewAction(item.id, 'APPROVE_SEND', draft)); showNotice('Public reply approved and posted.') }
    catch (error) { showNotice(errorMessage(error)) }
  }
  const assign = async (assigneeId: string) => {
    try { onReplace(await contentStudioApi.updateEngagementReview(item.id, { assignee_id: assigneeId })) }
    catch (error) { showNotice(errorMessage(error)) }
  }
  return <article><div className="review-person"><span className="engage-platform-icon linkedin"><Linkedin size={17} /></span><div><strong>{item.person}</strong><small>{item.handle}</small></div><span className="lead-intent">Comment</span></div><blockquote>{item.incoming}</blockquote><label><span><Sparkles size={14} />Suggested public reply</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} /></label><footer><select value={item.assignee_id} aria-label="Assign follow-up" onChange={(event) => void assign(event.target.value)}><option value="">Unassigned</option>{team.map((person) => <option key={person.id} value={person.id}>{person.is_current_user ? 'You' : person.name}</option>)}</select><button className="button button-dark" type="button" disabled={!draft.trim()} onClick={() => void approve()}><Check size={15} />Approve public reply</button></footer></article>
}
