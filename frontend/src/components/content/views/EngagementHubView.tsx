import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  ExternalLink,
  Instagram,
  Linkedin,
  MessageCircleMore,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import './EngagementHubView.css'

type EngageView = 'review' | 'automations' | 'campaigns' | 'analytics' | 'linkedin'
type Platform = 'instagram' | 'linkedin'
type ReviewFilter = 'all' | 'mine' | Platform
type AutomationState = 'Active' | 'Paused' | 'Needs approval'

interface ReviewItem {
  id: string
  platform: Platform
  kind: 'Comment reply' | 'Direct message' | 'Story reply'
  person: string
  handle: string
  source: string
  received: string
  incoming: string
  draft: string
  assignee: string
}

interface AutomationItem {
  id: string
  name: string
  type: string
  description: string
  trigger: string
  reply: string
  state: AutomationState
  runs: number
  owner: string
  icon: 'comment' | 'story' | 'keyword' | 'campaign' | 'ad'
}

const team = ['You', 'Maya', 'Arjun']

const startingReviews: ReviewItem[] = [
  {
    id: 'review-1', platform: 'instagram', kind: 'Direct message', person: 'Priya Mehta', handle: '@priyamehta',
    source: 'DM keyword · DEMO', received: '4 min ago', incoming: 'DEMO', assignee: 'You',
    draft: 'Hi Priya! Thanks for your interest. I can share a quick product tour. Would you like to see how it works for a solo creator or a team?',
  },
  {
    id: 'review-2', platform: 'instagram', kind: 'Story reply', person: 'Noah Williams', handle: '@noah.builds',
    source: 'Story · September offer', received: '12 min ago', incoming: 'Can I use this with my team?', assignee: 'Maya',
    draft: 'Absolutely — you can invite teammates, assign conversations, and keep every reply in one review queue. How many people are on your team?',
  },
  {
    id: 'review-3', platform: 'linkedin', kind: 'Comment reply', person: 'Daniel Kim', handle: 'Growth Lead at Northstar',
    source: 'LinkedIn company post', received: '26 min ago', incoming: 'Does this work for multiple client accounts?', assignee: 'You',
    draft: 'Yes, each client can have a separate workspace, connected accounts, reviewers, and reporting. I’d be happy to share the agency workflow.',
  },
  {
    id: 'review-4', platform: 'instagram', kind: 'Comment reply', person: 'Aisha Khan', handle: '@aishakhan.co',
    source: 'Comment keyword · GUIDE', received: '41 min ago', incoming: 'Guide please 🙌', assignee: 'Arjun',
    draft: 'Sent it your way, Aisha! Check your DMs ✨',
  },
]

const startingAutomations: AutomationItem[] = [
  { id: 'auto-1', name: 'Send the product guide', type: 'Comment to DM', description: 'Turns GUIDE comments into an approved public reply and DM.', trigger: 'Comment contains “GUIDE”', reply: 'Public reply + guide link in DM', state: 'Active', runs: 128, owner: 'You', icon: 'comment' },
  { id: 'auto-2', name: 'Story pricing questions', type: 'Story reply', description: 'Prepares a helpful answer when someone replies about pricing.', trigger: 'Story reply mentions price', reply: 'Pricing answer + plan chooser', state: 'Needs approval', runs: 0, owner: 'Maya', icon: 'story' },
  { id: 'auto-3', name: 'Demo requests', type: 'DM keyword', description: 'Qualifies people who send DEMO in a direct message.', trigger: 'DM contains “DEMO”', reply: 'Ask solo or team + booking link', state: 'Active', runs: 74, owner: 'You', icon: 'keyword' },
  { id: 'auto-4', name: 'Warm lead follow-up', type: 'Campaign sequence', description: 'A two-step follow-up for people who clicked but did not book.', trigger: 'Clicked demo link, no booking', reply: '2 approved messages over 3 days', state: 'Paused', runs: 39, owner: 'Arjun', icon: 'campaign' },
  { id: 'auto-5', name: 'September click-to-DM ad', type: 'Click-to-DM ad', description: 'Welcomes people arriving from the current Instagram ad.', trigger: 'Opens DM from campaign ad', reply: 'Welcome + quick reply choices', state: 'Active', runs: 216, owner: 'Maya', icon: 'ad' },
]

const automationKinds = [
  ['Comment to DM', 'A keyword comment prepares a public reply and private message.'],
  ['Story reply', 'A story response prepares the right approved reply.'],
  ['DM keyword', 'A word in a DM starts an approved conversation flow.'],
  ['Campaign sequence', 'Send approved follow-ups to an eligible audience.'],
  ['Click-to-DM ad', 'Welcome people who open a chat from an Instagram ad.'],
]

const navItems: Array<{ id: EngageView; label: string; icon: typeof CheckCircle2 }> = [
  { id: 'review', label: 'Review', icon: CheckCircle2 },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'campaigns', label: 'Campaigns', icon: Send },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'linkedin', label: 'LinkedIn Copilot', icon: Linkedin },
]

export function EngagementHubView() {
  const [view, setView] = useState<EngageView>('review')
  const [reviews, setReviews] = useState(startingReviews)
  const [automations, setAutomations] = useState(startingAutomations)
  const [notice, setNotice] = useState('')

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  return <section className="engagement-hub" aria-label="Engagement workspace">
    <div className="engage-safety-strip">
      <span><ShieldCheck size={18} /></span>
      <div><strong>Human approval is always on</strong><small>AI can suggest copy, but nothing new is posted or sent until a person approves it.</small></div>
    </div>

    <nav className="engage-tabs" aria-label="Engagement tools">
      {navItems.map((item) => {
        const Icon = item.icon
        return <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}><Icon size={16} /><span>{item.label}</span>{item.id === 'review' && reviews.length > 0 ? <small>{reviews.length}</small> : null}</button>
      })}
    </nav>

    {notice && <div className="engage-toast" role="status"><CheckCircle2 size={17} />{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice('')}><X size={15} /></button></div>}

    {view === 'review' && <ReviewWorkspace reviews={reviews} setReviews={setReviews} showNotice={showNotice} />}
    {view === 'automations' && <AutomationsWorkspace automations={automations} setAutomations={setAutomations} showNotice={showNotice} />}
    {view === 'campaigns' && <CampaignsWorkspace openReview={() => setView('review')} showNotice={showNotice} />}
    {view === 'analytics' && <EngagementAnalytics />}
    {view === 'linkedin' && <LinkedInCopilot reviews={reviews.filter((item) => item.platform === 'linkedin')} updateDraft={(id, draft) => setReviews((current) => current.map((item) => item.id === id ? { ...item, draft } : item))} showNotice={showNotice} />}
  </section>
}

function ReviewWorkspace({ reviews, setReviews, showNotice }: { reviews: ReviewItem[]; setReviews: Dispatch<SetStateAction<ReviewItem[]>>; showNotice: (message: string) => void }) {
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => reviews.filter((item) => {
    if (filter === 'mine' && item.assignee !== 'You') return false
    if ((filter === 'instagram' || filter === 'linkedin') && item.platform !== filter) return false
    const text = `${item.person} ${item.handle} ${item.incoming} ${item.draft}`.toLowerCase()
    return text.includes(query.toLowerCase())
  }), [filter, query, reviews])

  const update = (id: string, changes: Partial<ReviewItem>) => setReviews((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
  const finish = (item: ReviewItem) => {
    setReviews((current) => current.filter((row) => row.id !== item.id))
    showNotice(item.platform === 'linkedin' ? 'Reply approved and added to the posting queue.' : 'Reply approved and added to the sending queue.')
  }

  return <div className="engage-view">
    <section className="engage-intro">
      <div><span className="engage-eyebrow">ONE CLEAR QUEUE</span><h2>Review AI suggestions</h2><p>Edit the draft, choose an owner, and approve when it sounds right. Solo users and teams follow the same simple flow.</p></div>
      <div className="engage-mini-stats"><span><strong>{reviews.length}</strong>Waiting</span><span><strong>{reviews.filter((item) => item.assignee === 'You').length}</strong>Assigned to you</span><span><strong>18</strong>Approved today</span></div>
    </section>

    <div className="engage-toolbar">
      <div className="engage-filters" role="group" aria-label="Filter review queue">{([['all', 'All'], ['mine', 'Mine'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn']] as Array<[ReviewFilter, string]>).map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}{id === 'all' ? <span>{reviews.length}</span> : null}</button>)}</div>
      <label className="engage-search"><Search size={16} /><span className="sr-only">Search reviews</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people or messages" /></label>
    </div>

    {filtered.length ? <div className="review-inbox">{filtered.map((item) => <ReviewCard item={item} key={item.id} onChange={(changes) => update(item.id, changes)} onApprove={() => finish(item)} onSkip={() => { setReviews((current) => current.filter((row) => row.id !== item.id)); showNotice('Suggestion dismissed.') }} />)}</div> : <div className="engage-empty"><CheckCircle2 size={34} /><h3>You’re all caught up</h3><p>No suggestions match this view.</p></div>}
  </div>
}

function ReviewCard({ item, onChange, onApprove, onSkip }: { item: ReviewItem; onChange: (changes: Partial<ReviewItem>) => void; onApprove: () => void; onSkip: () => void }) {
  const PlatformIcon = item.platform === 'instagram' ? Instagram : Linkedin
  return <article className="engage-review-card">
    <div className="review-person">
      <span className={`engage-platform-icon ${item.platform}`}><PlatformIcon size={18} /></span>
      <div><strong>{item.person}</strong><small>{item.handle}</small></div>
      <span className="review-time">{item.received}</span>
    </div>
    <div className="review-context"><span>{item.kind}</span><small>{item.source}</small><blockquote>{item.incoming}</blockquote></div>
    <label className="review-draft"><span><Sparkles size={15} /> AI suggestion <small>Not sent</small></span><textarea value={item.draft} onChange={(event) => onChange({ draft: event.target.value })} /></label>
    <footer>
      <label className="review-assignee"><Users size={15} /><span className="sr-only">Assignee</span><select value={item.assignee} onChange={(event) => onChange({ assignee: event.target.value })}>{team.map((person) => <option key={person}>{person}</option>)}</select><ChevronDown size={14} /></label>
      <button className="li-text-button" type="button" onClick={onSkip}>Dismiss</button>
      <button className="li-quiet-button" type="button" onClick={() => onChange({ draft: item.draft })}>Save draft</button>
      <button className="button button-dark" type="button" disabled={!item.draft.trim()} onClick={onApprove}><Check size={16} />Approve {item.platform === 'linkedin' ? 'reply' : '& send'}</button>
    </footer>
  </article>
}

function AutomationsWorkspace({ automations, setAutomations, showNotice }: { automations: AutomationItem[]; setAutomations: Dispatch<SetStateAction<AutomationItem[]>>; showNotice: (message: string) => void }) {
  const [creating, setCreating] = useState(false)
  const [kind, setKind] = useState(automationKinds[0][0])
  const [name, setName] = useState('')
  const [keyword, setKeyword] = useState('')
  const [owner, setOwner] = useState('You')

  const create = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setAutomations((current) => [{ id: `auto-${Date.now()}`, name: name.trim(), type: kind, description: 'New automation ready for its message and audience to be reviewed.', trigger: keyword.trim() ? `Contains “${keyword.trim()}”` : 'Trigger needs review', reply: 'Message needs approval', state: 'Needs approval', runs: 0, owner, icon: kind === 'Story reply' ? 'story' : kind === 'DM keyword' ? 'keyword' : kind === 'Campaign sequence' ? 'campaign' : kind === 'Click-to-DM ad' ? 'ad' : 'comment' }, ...current])
    setName('')
    setKeyword('')
    setCreating(false)
    showNotice('Automation created in review mode. Nothing will run until it is approved.')
  }

  const toggle = (item: AutomationItem) => {
    if (item.state === 'Needs approval') {
      showNotice('Review the trigger, message, and audience before activating.')
      return
    }
    const state = item.state === 'Active' ? 'Paused' : 'Active'
    setAutomations((current) => current.map((row) => row.id === item.id ? { ...row, state } : row))
    showNotice(`${item.name} is now ${state.toLowerCase()}.`)
  }

  return <div className="engage-view">
    <section className="engage-intro"><div><span className="engage-eyebrow">APPROVED RULES, PREDICTABLE REPLIES</span><h2>Simple automations</h2><p>Choose what starts the flow, approve the exact reply, then turn it on. Active automations never invent new copy.</p></div><button className="button button-dark" type="button" onClick={() => setCreating((value) => !value)}>{creating ? <X size={16} /> : <Plus size={16} />}{creating ? 'Close' : 'New automation'}</button></section>
    {creating && <form className="quick-automation" onSubmit={create}><div><WandSparkles size={21} /><span><strong>Create a simple automation</strong><small>It starts in review mode.</small></span></div><label>Type<select value={kind} onChange={(event) => setKind(event.target.value)}>{automationKinds.map(([label]) => <option key={label}>{label}</option>)}</select></label><label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Send pricing guide" autoFocus /></label><label>Keyword or intent<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Example: PRICE" /></label><label>Reviewer<select value={owner} onChange={(event) => setOwner(event.target.value)}>{team.map((person) => <option key={person}>{person}</option>)}</select></label><button className="button button-dark" disabled={!name.trim()} type="submit">Create for review</button></form>}
    <div className="automation-kind-grid">{automationKinds.map(([label, description]) => <div key={label}><CheckCircle2 size={16} /><span><strong>{label}</strong><small>{description}</small></span></div>)}</div>
    <div className="automation-list">{automations.map((item) => <AutomationCard key={item.id} item={item} onToggle={() => toggle(item)} showNotice={showNotice} />)}</div>
  </div>
}

function AutomationCard({ item, onToggle, showNotice }: { item: AutomationItem; onToggle: () => void; showNotice: (message: string) => void }) {
  const icons = { comment: MessageCircleMore, story: Instagram, keyword: Search, campaign: Send, ad: MousePointerClick }
  const Icon = icons[item.icon]
  return <article className="automation-row"><span className="automation-row-icon"><Icon size={19} /></span><div className="automation-main"><span>{item.type}</span><h3>{item.name}</h3><p>{item.description}</p><dl><div><dt>When</dt><dd>{item.trigger}</dd></div><div><dt>Then</dt><dd>{item.reply}</dd></div></dl></div><div className="automation-owner"><span className={`automation-state ${item.state.toLowerCase().replace(' ', '-')}`}>{item.state}</span><small>{item.runs} conversations</small><small>Owner: {item.owner}</small></div><div className="automation-actions"><button className="li-quiet-button" type="button" onClick={() => showNotice(item.state === 'Needs approval' ? 'Review opened. Approve the exact trigger, message, and audience to activate it.' : 'Automation details opened.')}>{item.state === 'Needs approval' ? 'Review setup' : 'Edit'}</button><button className="automation-play" type="button" aria-label={item.state === 'Active' ? `Pause ${item.name}` : `Activate ${item.name}`} onClick={onToggle}>{item.state === 'Active' ? <Pause size={15} /> : <Play size={15} />}</button></div></article>
}

function CampaignsWorkspace({ openReview, showNotice }: { openReview: () => void; showNotice: (message: string) => void }) {
  return <div className="engage-view">
    <section className="engage-intro"><div><span className="engage-eyebrow">APPROVE BEFORE SCHEDULING</span><h2>Campaigns and sequences</h2><p>Pick an eligible audience, approve the exact messages, and schedule. Replies stop the sequence automatically.</p></div><button className="button button-dark" type="button" onClick={() => showNotice('Campaign builder opened in draft mode.')}><Plus size={16} />New campaign</button></section>
    <div className="campaign-guardrail"><ShieldCheck size={19} /><div><strong>Built-in sending guardrails</strong><span>Only eligible Instagram contacts are included. Every audience and message requires approval, and contacts exit when they reply or unsubscribe.</span></div></div>
    <div className="campaign-grid">
      <article className="campaign-card"><header><span className="engage-platform-icon instagram"><Instagram size={18} /></span><span className="campaign-status review">Needs review</span></header><h3>September demo follow-up</h3><p>People who clicked the demo link but have not booked.</p><div className="campaign-steps"><span><i>1</i><strong>Helpful reminder</strong><small>Send after approval</small></span><span><i>2</i><strong>Customer example</strong><small>2 days later · stop on reply</small></span></div><dl><div><dt>Eligible audience</dt><dd>84 contacts</dd></div><div><dt>Owner</dt><dd>You</dd></div></dl><button className="button button-dark" type="button" onClick={openReview}>Review audience and copy <ArrowRight size={15} /></button></article>
      <article className="campaign-card"><header><span className="engage-platform-icon instagram"><MousePointerClick size={18} /></span><span className="campaign-status active">Running</span></header><h3>Click-to-DM welcome</h3><p>Conversation starter for people arriving from the current Instagram ad.</p><div className="campaign-steps compact"><span><i>1</i><strong>Approved welcome</strong><small>Two quick reply choices</small></span></div><dl><div><dt>Started</dt><dd>216 chats</dd></div><div><dt>Reply rate</dt><dd>42%</dd></div></dl><button className="li-quiet-button" type="button" onClick={() => showNotice('Campaign paused. Existing conversations stay in the inbox.')}><Pause size={15} />Pause campaign</button></article>
      <article className="campaign-card new"><Zap size={25} /><h3>Turn engagement into conversations</h3><p>Create a small, focused campaign from a comment keyword, story reply, link click, or Instagram ad.</p><button className="li-quiet-button" type="button" onClick={() => showNotice('New campaign created as a draft.')}>Start with a template</button></article>
    </div>
  </div>
}

function EngagementAnalytics() {
  const bars = [
    { label: 'Comment to DM', value: 312, width: 100 },
    { label: 'Click-to-DM ads', value: 216, width: 69 },
    { label: 'DM keywords', value: 128, width: 41 },
    { label: 'Story replies', value: 74, width: 24 },
  ]
  return <div className="engage-view">
    <section className="engage-intro"><div><span className="engage-eyebrow">CLEAR, USEFUL NUMBERS</span><h2>Engagement analytics</h2><p>See which approved flows start conversations and where your team needs attention.</p></div><label className="analytics-period"><span className="sr-only">Time period</span><select defaultValue="30"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select><ChevronDown size={14} /></label></section>
    <div className="engagement-metrics"><article><span>Conversations started</span><strong>730</strong><small>↑ 18% from last period</small></article><article><span>Replies approved</span><strong>412</strong><small>Median review time 8 min</small></article><article><span>Reply rate</span><strong>42%</strong><small>Across active flows</small></article><article><span>Link clicks</span><strong>186</strong><small>26% click-through rate</small></article></div>
    <div className="engagement-analytics-grid"><section className="card engage-chart"><header><div><h3>Conversations by source</h3><p>Where people entered your inbox.</p></div><BarChart3 size={20} /></header><div>{bars.map((bar) => <div className="engage-bar" key={bar.label}><span>{bar.label}</span><i><b style={{ width: `${bar.width}%` }} /></i><strong>{bar.value}</strong></div>)}</div></section><section className="card team-performance"><header><div><h3>Team review load</h3><p>Pending suggestions and typical review time.</p></div></header>{[['You', '2 waiting', '6 min'], ['Maya', '1 waiting', '9 min'], ['Arjun', '1 waiting', '12 min']].map(([name, waiting, time]) => <div key={name}><span>{name.slice(0, 1)}</span><strong>{name}<small>{waiting}</small></strong><em>{time}</em></div>)}</section></div>
  </div>
}

function LinkedInCopilot({ reviews, updateDraft, showNotice }: { reviews: ReviewItem[]; updateDraft: (id: string, draft: string) => void; showNotice: (message: string) => void }) {
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showNotice('Draft copied. Open LinkedIn and send it yourself.')
    } catch {
      showNotice('Copy is unavailable in this browser. Select the draft text manually.')
    }
  }

  return <div className="engage-view">
    <section className="engage-intro"><div><span className="engage-eyebrow">LINKEDIN ENGAGEMENT COPILOT</span><h2>Turn comments into thoughtful follow-up</h2><p>AI suggests public replies and personal follow-ups. Your team reviews everything; personal messages are always sent manually on LinkedIn.</p></div><span className="linkedin-compliance"><ShieldCheck size={17} />Compliant, human-led workflow</span></section>
    <div className="linkedin-limit"><Linkedin size={22} /><div><strong>What this workspace can do</strong><p>Manage Company Page comments, suggest replies, identify leads, assign follow-up, and prepare a personal message for a human to send.</p></div><div><strong>What stays manual</strong><p>Connection requests, personal DMs, and InMail are never automated.</p></div></div>
    <div className="copilot-layout"><section className="copilot-comments"><header><div><h3>Comments to review</h3><p>High-intent comments appear first.</p></div><span>{reviews.length}</span></header>{reviews.length ? reviews.map((item) => <article key={item.id}><div className="review-person"><span className="engage-platform-icon linkedin"><Linkedin size={17} /></span><div><strong>{item.person}</strong><small>{item.handle}</small></div><span className="lead-intent">Sales question</span></div><blockquote>{item.incoming}</blockquote><label><span><Sparkles size={14} />Suggested public reply</span><textarea value={item.draft} onChange={(event) => updateDraft(item.id, event.target.value)} /></label><footer><select value={item.assignee} aria-label="Assign follow-up" onChange={() => undefined}>{team.map((person) => <option key={person}>{person}</option>)}</select><button className="button button-dark" type="button" onClick={() => showNotice('Public reply approved and added to the posting queue.')}><Check size={15} />Approve public reply</button></footer></article>) : <div className="engage-empty"><CheckCircle2 size={30} /><h3>No LinkedIn comments waiting</h3></div>}</section><aside className="manual-followup"><span className="manual-followup-icon"><Clipboard size={20} /></span><h3>Personal follow-up draft</h3><p>For Daniel Kim · after the public reply</p><div>Hi Daniel — thanks for your question on our post. Since you mentioned multiple client accounts, I thought our agency workspace example might be useful. Happy to share it if you’d like.</div><button className="li-quiet-button" type="button" onClick={() => void copy('Hi Daniel — thanks for your question on our post. Since you mentioned multiple client accounts, I thought our agency workspace example might be useful. Happy to share it if you’d like.')}><Clipboard size={15} />Copy draft</button><a className="button button-dark" href="https://www.linkedin.com" target="_blank" rel="noreferrer">Open LinkedIn <ExternalLink size={14} /></a><small>This product cannot send personal LinkedIn messages for you.</small></aside></div>
  </div>
}
