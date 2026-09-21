import {
  BarChart3, Check, CheckCircle2, ChevronDown, ExternalLink, Instagram, Linkedin,
  MessageCircleMore, MessageSquare, MousePointerClick, Pause, Play, Plus, Search, Send, ShieldCheck, Sparkles,
  Users, WandSparkles, X, Zap, Copy, AlertCircle, Clock, CornerDownRight, RotateCw, RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { contentStudioApi } from '../../../api/contentStudio'
import type {
  EngagementAnalytics as AnalyticsData, EngagementAutomation, EngagementAutomationKind,
  EngagementCampaign, EngagementConnection, EngagementContactSummary, EngagementOverview, EngagementReview, EngagementTeamMember,
} from '../../../types/engagement'
import './EngagementHubView.css'

type EngageView = 'review' | 'automations' | 'campaigns' | 'analytics' | 'linkedin'
type ReviewFilter = 'all' | 'mine' | 'story' | 'comment' | 'dm' | 'instagram' | 'linkedin' | 'failed'

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
    <div className="engage-safety-strip">
      <div className="engage-safety-icon"><ShieldCheck size={20} /></div>
      <div className="engage-safety-copy">
        <strong>Human approval is always on</strong>
        <span>AI can suggest copy, but nothing new is posted or sent until a person approves it.</span>
      </div>
    </div>
    <nav className="engage-tabs" aria-label="Engagement tools">
      {navItems.map((item) => {
        const Icon = item.icon
        const count = item.id === 'review' ? (data?.reviews.length ?? 0) : 0
        return (
          <button
            key={item.id}
            type="button"
            className={`engage-tab-btn ${view === item.id ? 'active' : ''}`}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => setView(item.id)}
          >
            <Icon size={17} />
            <span>{item.label}</span>
            {count > 0 && <span className="engage-tab-badge">{count}</span>}
          </button>
        )
      })}
    </nav>
    {notice && (
      <div className="engage-toast" role="status">
        <CheckCircle2 size={18} className="engage-toast-icon" />
        <span className="engage-toast-message">{notice}</span>
        <button type="button" aria-label="Dismiss" className="engage-toast-close" onClick={() => setNotice('')}><X size={15} /></button>
      </div>
    )}
    {error && (
      <div className="engage-toast engage-toast-error" role="alert">
        <AlertCircle size={18} />
        <span className="engage-toast-message">{error}</span>
        <button type="button" className="engage-toast-retry" onClick={() => void load()}>Try again</button>
      </div>
    )}
    {loading && (
      <div className="engage-empty" aria-live="polite">
        <div className="engage-loading-spinner"><Sparkles size={28} /></div>
        <h3>Loading engagement workspace…</h3>
        <p>Gathering conversations, automations, and AI suggestions.</p>
      </div>
    )}
    {!loading && data && view === 'review' && <ReviewWorkspace reviews={data.reviews} team={data.team} connections={data.connections} onReplace={replaceReview} showNotice={showNotice} />}
    {!loading && data && view === 'automations' && <AutomationsWorkspace automations={data.automations} team={data.team} connections={data.connections} onCreate={(item) => updateData((current) => ({ ...current, automations: [item, ...current.automations] }))} onReplace={replaceAutomation} showNotice={showNotice} />}
    {!loading && data && view === 'campaigns' && <CampaignsWorkspace campaigns={data.campaigns} team={data.team} connections={data.connections} contacts={data.contacts} onCreate={(item) => updateData((current) => ({ ...current, campaigns: [item, ...current.campaigns] }))} onReplace={replaceCampaign} showNotice={showNotice} />}
    {!loading && data && view === 'analytics' && <EngagementAnalytics analytics={data.analytics} team={data.team} reviews={data.reviews} />}
    {!loading && data && view === 'linkedin' && <LinkedInCopilot reviews={data.reviews.filter((item) => item.platform === 'linkedin')} team={data.team} onReplace={replaceReview} showNotice={showNotice} />}
  </section>
}

function ReviewWorkspace({ reviews, team, connections, onReplace, showNotice }: { reviews: EngagementReview[]; team: EngagementTeamMember[]; connections: EngagementConnection[]; onReplace: (item: EngagementReview) => void; showNotice: (message: string) => void }) {
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [platformFilter, setPlatformFilter] = useState<'all' | 'instagram' | 'linkedin'>('all')
  const [connectionId, setConnectionId] = useState('all')
  const [query, setQuery] = useState('')
  const currentUser = team.find((member) => member.is_current_user)
  const connectedAccounts = useMemo(() => connections.filter((item) => item.connected && item.engagement_supported), [connections])

  const storyCount = useMemo(() => reviews.filter((r) => r.kind === 'Story reply').length, [reviews])
  const commentCount = useMemo(() => reviews.filter((r) => r.kind === 'Comment reply').length, [reviews])
  const dmCount = useMemo(() => reviews.filter((r) => r.kind === 'Direct message').length, [reviews])
  const assignedCount = useMemo(() => reviews.filter((item) => item.assignee_id === currentUser?.id).length, [currentUser?.id, reviews])
  const failedCount = useMemo(() => reviews.filter((item) => item.status === 'FAILED').length, [reviews])

  const filtered = useMemo(() => reviews.filter((item) => {
    // Kind / Category Filter
    if (filter === 'mine' && item.assignee_id !== currentUser?.id) return false
    if (filter === 'failed' && item.status !== 'FAILED') return false
    if (filter === 'story' && item.kind !== 'Story reply') return false
    if (filter === 'comment' && item.kind !== 'Comment reply') return false
    if (filter === 'dm' && item.kind !== 'Direct message') return false
    if (filter === 'instagram' && item.platform !== 'instagram') return false
    if (filter === 'linkedin' && item.platform !== 'linkedin') return false

    // Platform Filter
    if (platformFilter !== 'all' && item.platform !== platformFilter) return false

    // Account Filter
    if (connectionId !== 'all' && item.connection_id !== connectionId) return false

    // Text Search
    if (query.trim()) {
      const q = query.toLowerCase()
      const searchContent = `${item.person} ${item.handle} ${item.account_name} ${item.incoming} ${item.draft} ${item.kind} ${item.source}`.toLowerCase()
      if (!searchContent.includes(q)) return false
    }

    return true
  }), [connectionId, currentUser?.id, filter, platformFilter, query, reviews])

  return <div className="engage-view">
    <header className="engage-hero-section">
      <div className="engage-hero-content">
        <div className="engage-hero-badge">
          <Sparkles size={13} className="hero-sparkle" />
          <span>ONE CLEAR QUEUE</span>
        </div>
        <h2>Review AI suggestions</h2>
        <p>Edit the draft, choose an owner, and approve when it sounds right. Solo users and teams follow the same flow.</p>
      </div>

      <div className="engage-hero-metrics" role="region" aria-label="Review metrics">
        <button
          type="button"
          className={`hero-metric-card ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
          title="Show all pending reviews"
        >
          <div className="metric-icon-wrap waiting">
            <Clock size={16} />
          </div>
          <div className="metric-info">
            <strong className="metric-value">{reviews.length}</strong>
            <span className="metric-label">Waiting</span>
          </div>
        </button>

        <button
          type="button"
          className={`hero-metric-card ${filter === 'mine' ? 'active' : ''}`}
          onClick={() => setFilter('mine')}
          title="Show reviews assigned to you"
        >
          <div className="metric-icon-wrap assigned">
            <Users size={16} />
          </div>
          <div className="metric-info">
            <strong className="metric-value">{assignedCount}</strong>
            <span className="metric-label">Assigned to you</span>
          </div>
        </button>

        <button
          type="button"
          className={`hero-metric-card ${filter === 'failed' ? 'active' : ''}`}
          onClick={() => setFilter('failed')}
          title="Show reviews needing retry"
        >
          <div className="metric-icon-wrap failed">
            <AlertCircle size={16} />
          </div>
          <div className="metric-info">
            <strong className="metric-value">{failedCount}</strong>
            <span className="metric-label">Need retry</span>
          </div>
        </button>
      </div>
    </header>

    <div className="engage-toolbar">
      <div className="engage-toolbar-filters">
        <div className="engage-pill-filters" role="group" aria-label="Filter review queue">
          <button
            type="button"
            className={`engage-pill-btn ${filter === 'all' ? 'active' : ''}`}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            <span>All</span>
            <span className="pill-count">{reviews.length}</span>
          </button>

          <button
            type="button"
            className={`engage-pill-btn story-pill ${filter === 'story' ? 'active' : ''}`}
            aria-pressed={filter === 'story'}
            onClick={() => setFilter('story')}
            title="Filter by Story Automation Replies"
          >
            <span className="kind-dot story-dot" />
            <span>Story replies</span>
            <span className="pill-count">{storyCount}</span>
          </button>

          <button
            type="button"
            className={`engage-pill-btn comment-pill ${filter === 'comment' ? 'active' : ''}`}
            aria-pressed={filter === 'comment'}
            onClick={() => setFilter('comment')}
            title="Filter by Comment to DM Automations"
          >
            <MessageCircleMore size={13} />
            <span>Comment to DM</span>
            <span className="pill-count">{commentCount}</span>
          </button>

          <button
            type="button"
            className={`engage-pill-btn dm-pill ${filter === 'dm' ? 'active' : ''}`}
            aria-pressed={filter === 'dm'}
            onClick={() => setFilter('dm')}
            title="Filter by Direct Messages"
          >
            <MessageSquare size={13} />
            <span>Direct messages</span>
            <span className="pill-count">{dmCount}</span>
          </button>

          <button
            type="button"
            className={`engage-pill-btn ${filter === 'mine' ? 'active' : ''}`}
            aria-pressed={filter === 'mine'}
            onClick={() => setFilter('mine')}
            title="Filter by reviews assigned to you"
          >
            <Users size={13} />
            <span>Mine</span>
            <span className="pill-count">{assignedCount}</span>
          </button>

          {failedCount > 0 && (
            <button
              type="button"
              className={`engage-pill-btn failed-pill ${filter === 'failed' ? 'active' : ''}`}
              aria-pressed={filter === 'failed'}
              onClick={() => setFilter('failed')}
              title="Filter by failed sends"
            >
              <AlertCircle size={12} />
              <span>Retry</span>
              <span className="pill-count">{failedCount}</span>
            </button>
          )}
        </div>

        <div className="engage-dropdown-filters">
          <label className="engage-account-select-wrap">
            <span className="sr-only">Platform</span>
            <select
              aria-label="Platform"
              className="engage-account-select"
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value as 'all' | 'instagram' | 'linkedin')}
            >
              <option value="all">All platforms</option>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </label>

          <label className="engage-account-select-wrap">
            <span className="sr-only">Connected account</span>
            <select
              aria-label="Connected account"
              className="engage-account-select"
              value={connectionId}
              onChange={(event) => setConnectionId(event.target.value)}
            >
              <option value="all">All accounts ({connectedAccounts.length})</option>
              {connectedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.platform === 'instagram' ? 'Instagram' : 'LinkedIn'}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </label>
        </div>
      </div>

      <div className="engage-search-container">
        <label className="engage-search-label">
          <Search size={15} className="search-icon" />
          <span className="sr-only">Search reviews</span>
          <input
            type="text"
            className="engage-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, messages, handles…"
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <X size={13} />
            </button>
          )}
        </label>
      </div>
    </div>

    {filtered.length ? (
      <div className="review-inbox-grid">
        {filtered.map((item) => (
          <ReviewCard key={item.id} item={item} team={team} onReplace={onReplace} showNotice={showNotice} />
        ))}
      </div>
    ) : (
      <div className="engage-empty-state">
        <div className="empty-state-icon-wrap">
          <CheckCircle2 size={36} />
        </div>
        <h3>You’re all caught up!</h3>
        <p>No messages or suggestions match the selected view.</p>
        {(filter !== 'all' || connectionId !== 'all' || query) && (
          <button
            type="button"
            className="empty-state-reset-btn"
            onClick={() => { setFilter('all'); setConnectionId('all'); setQuery('') }}
          >
            Reset all filters
          </button>
        )}
      </div>
    )}
  </div>
}

function ReviewCard({ item, team, onReplace, showNotice }: { item: EngagementReview; team: EngagementTeamMember[]; onReplace: (item: EngagementReview) => void; showNotice: (message: string) => void }) {
  const [draft, setDraft] = useState(item.draft)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const PlatformIcon = item.platform === 'instagram' ? Instagram : Linkedin

  useEffect(() => {
    setDraft(item.draft)
  }, [item.draft])

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

  const copyDraft = () => {
    if (!draft) return
    navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  const getInitials = (name: string) => {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return <article className={`engage-review-card ${item.status === 'FAILED' ? 'card-failed' : ''}`}>
    {/* Card Top: Author Profile & Channel & Time */}
    <header className="card-top-bar">
      <div className="card-author-cluster">
        <div className={`card-avatar ${item.platform}`}>
          <span>{getInitials(item.person)}</span>
          <span className={`card-avatar-network ${item.platform}`} title={item.platform === 'instagram' ? 'Instagram' : 'LinkedIn'}>
            <PlatformIcon size={11} />
          </span>
        </div>
        <div className="card-author-details">
          <div className="card-author-primary">
            <strong className="card-author-name">{item.person || 'Social contact'}</strong>
            {item.handle && <span className="card-author-handle">{item.handle}</span>}
          </div>
          <div className="card-meta-line">
            <span className="card-account-tag" title={`Connected account: ${item.account_name}`}>
              {item.account_name}
            </span>
            <span className="meta-separator">•</span>
            <span className="card-relative-time" title={new Date(item.received_at).toLocaleString()}>
              <Clock size={11} />
              {relativeTime(item.received_at)}
            </span>
          </div>
        </div>
      </div>

      <div className="card-top-badges">
        <span className={`card-kind-badge kind-${item.kind.toLowerCase().replace(/\s+/g, '-')}`}>
          {item.kind === 'Story reply' ? (
            <>
              <span className="kind-dot story-dot" />
              Story reply
            </>
          ) : item.kind === 'Comment reply' ? (
            <>
              <MessageCircleMore size={12} />
              Comment
            </>
          ) : (
            <>
              <MessageSquare size={12} />
              Direct message
            </>
          )}
        </span>
        {item.status === 'FAILED' && (
          <span className="card-failed-badge">
            <AlertCircle size={11} />
            Send failed
          </span>
        )}
      </div>
    </header>

    {/* Inbound Context: What the user sent or commented */}
    <section className="card-inbound-section">
      <div className="inbound-label-bar">
        <span className="inbound-source-label">
          {item.source || (item.kind === 'Story reply' ? 'Story response' : 'Incoming interaction')}
        </span>
      </div>
      <div className="inbound-chat-bubble">
        <p>{item.incoming || '(Empty message)'}</p>
      </div>
    </section>

    {/* Visual Flow Indicator */}
    <div className="card-flow-connector">
      <div className="connector-line" />
      <div className="connector-tag">
        <CornerDownRight size={12} />
        <span>AI Generated Suggestion</span>
      </div>
      <div className="connector-line" />
    </div>

    {/* AI Suggestion Box */}
    <section className="card-ai-section">
      <div className="ai-section-header">
        <div className="ai-header-left">
          <Sparkles size={14} className="sparkles-icon" />
          <strong className="ai-header-title">AI suggestion</strong>
        </div>
        <div className="ai-header-right">
          <span className="ai-char-count">{draft.length} chars</span>
          <span className={`ai-status-tag ${item.status === 'FAILED' ? 'failed' : 'ready'}`}>
            {item.status === 'FAILED' ? (item.error || 'Failed') : 'Not sent'}
          </span>
        </div>
      </div>

      <div className="ai-editor-box">
        <textarea
          className="ai-draft-textarea"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Edit the suggested response before sending…"
          rows={3}
        />
      </div>

      {/* Quick AI Polish Toolbar */}
      <div className="ai-quick-toolbar">
        <span className="quick-toolbar-label">Quick polish:</span>
        <button
          type="button"
          className="quick-action-chip"
          disabled={busy}
          onClick={() => void action('GENERATE')}
          title="Regenerate copy with AI"
        >
          <Sparkles size={11} />
          <span>Improve with AI</span>
        </button>
        <button
          type="button"
          className="quick-action-chip"
          disabled={busy || !draft.trim()}
          onClick={() => {
            const trimmed = draft.trim()
            if (trimmed.length > 80) {
              const shortened = trimmed.split(/([.!?])/).slice(0, 2).join('').trim() || trimmed.slice(0, 80)
              setDraft(shortened)
            }
          }}
          title="Make this response concise"
        >
          <span>Shorter</span>
        </button>
        <button
          type="button"
          className="quick-action-chip"
          disabled={busy || !draft.trim()}
          onClick={() => {
            if (!draft.includes('😊') && !draft.includes('🙌')) {
              setDraft(draft.trim() + ' 🙌')
            }
          }}
          title="Add a friendly closing"
        >
          <span>Friendly 🙌</span>
        </button>
      </div>
    </section>

    {/* Card Footer: Assignee & Actions */}
    <footer className="card-bottom-actions">
      <div className="bottom-left-controls">
        <label className="card-assignee-control">
          <Users size={14} className="assignee-icon" />
          <span className="sr-only">Assignee</span>
          <select
            className="card-assignee-select"
            value={item.assignee_id}
            disabled={busy}
            onChange={(event) => void update({ assignee_id: event.target.value })}
            aria-label="Assignee"
          >
            <option value="">Unassigned</option>
            {team.map((person) => (
              <option key={person.id} value={person.id}>
                {person.is_current_user ? 'You' : person.name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="select-chevron" />
        </label>

        <button
          type="button"
          className="card-copy-btn"
          onClick={copyDraft}
          title="Copy response to clipboard"
        >
          {copied ? <Check size={13} className="copy-success" /> : <Copy size={13} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      <div className="bottom-right-actions">
        <button
          type="button"
          className="btn-ghost-dismiss"
          disabled={busy}
          onClick={() => void action('DISMISS')}
          title="Dismiss this review suggestion"
        >
          Dismiss
        </button>

        <button
          type="button"
          className={`btn-subtle-save ${draft !== item.draft ? 'has-changes' : ''}`}
          disabled={busy || draft === item.draft}
          onClick={() => void update({ draft }, 'Draft saved.')}
          title="Save draft without sending"
        >
          Save draft
        </button>

        <button
          type="button"
          className={`btn-primary-approve ${item.status === 'FAILED' ? 'is-retry' : ''}`}
          disabled={busy || !draft.trim() || !item.can_send}
          onClick={() => void action(item.status === 'FAILED' ? 'RETRY' : 'APPROVE_SEND')}
        >
          {busy ? (
            <>
              <RefreshCw size={14} className="btn-spinner" />
              <span>Working…</span>
            </>
          ) : item.status === 'FAILED' ? (
            <>
              <RotateCw size={14} />
              <span>Retry send</span>
            </>
          ) : (
            <>
              <Check size={15} />
              <span>Approve {item.platform === 'linkedin' ? 'reply' : '& send'}</span>
            </>
          )}
        </button>
      </div>
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
  const [autoActivate, setAutoActivate] = useState(false)
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
        activate: autoActivate,
      })
      onCreate(item)
      setName(''); setKeyword(''); setMessage(''); setPublicReply(''); setCreating(false)
      showNotice(item.status === 'ACTIVE'
        ? `Automation "${item.name}" created and activated! Incoming matched interactions will prepare drafts in Review.`
        : 'Automation created in review mode. Nothing will run until it is approved.')
    } catch (error) { showNotice(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const action = async (item: EngagementAutomation) => {
    const actionName = item.status === 'ACTIVE' ? 'PAUSE' : item.status === 'DRAFT' || item.status === 'FAILED' ? 'APPROVE' : 'ACTIVATE'
    try {
      const updated = await contentStudioApi.engagementAutomationAction(item.id, actionName)
      onReplace(updated)
      showNotice(`${updated.name} is now ${updated.state.toLowerCase()}.`)
    } catch (error) { showNotice(errorMessage(error)) }
  }

  return <div className="engage-view">
    <section className="engage-intro">
      <div className="engage-intro-copy">
        <span className="engage-eyebrow">APPROVED RULES, PREDICTABLE REPLIES</span>
        <h2>Simple automations</h2>
        <p>Choose what starts the flow and the exact suggested reply. Every matched response still goes to the review queue.</p>
      </div>
      <button className="button button-dark" type="button" disabled={!instagram.length} onClick={() => setCreating((value) => !value)}>
        {creating ? <X size={16} /> : <Plus size={16} />}
        {creating ? 'Close' : 'New automation'}
      </button>
    </section>

    {!instagram.length && (
      <div className="campaign-guardrail">
        <Instagram size={20} />
        <div>
          <strong>Connect Instagram to begin</strong>
          <span>A connected Instagram business or creator account is required for engagement automations.</span>
        </div>
      </div>
    )}

    {creating && (
      <form className="quick-automation-card" onSubmit={(event) => void create(event)}>
        <div className="quick-form-header">
          <div className="quick-form-icon"><WandSparkles size={20} /></div>
          <div>
            <strong>Create a simple automation</strong>
            <span>Replies are prepared for human sign-off in the Review tab.</span>
          </div>
        </div>

        <div className="quick-form-grid">
          <label className="quick-field">
            <span>Account</span>
            <select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
              {instagram.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="quick-field">
            <span>Trigger Type</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as EngagementAutomationKind)}>
              {automationKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="quick-field">
            <span>Automation Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Send pricing guide" autoFocus />
          </label>
          <label className="quick-field">
            <span>Trigger Keywords (comma-separated)</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={kind === 'STORY_REPLY' ? 'Optional: Leave empty or type * for all story replies' : 'Example: PRICE, PLANS'}
            />
          </label>
          <label className="quick-field quick-field-full">
            <span>Suggested Direct Message (DM)</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Exact message a reviewer can approve" rows={3} />
          </label>
          {kind === 'COMMENT_TO_DM' && (
            <label className="quick-field quick-field-full">
              <span>Suggested Public Reply</span>
              <textarea value={publicReply} onChange={(event) => setPublicReply(event.target.value)} placeholder="Example: I’ll send the details privately." rows={2} />
            </label>
          )}
          <label className="quick-field">
            <span>Default Reviewer</span>
            <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
              {team.map((person) => <option key={person.id} value={person.id}>{person.is_current_user ? 'You' : person.name}</option>)}
            </select>
          </label>
          <label className="quick-field quick-field-full" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoActivate} onChange={(event) => setAutoActivate(event.target.checked)} />
            <span><strong>Activate immediately</strong> (start matching incoming interactions right away)</span>
          </label>
        </div>

        <div className="quick-form-footer">
          <button type="button" className="li-quiet-button" onClick={() => setCreating(false)}>Cancel</button>
          <button
            className="button button-dark"
            disabled={busy || !name.trim() || (kind !== 'STORY_REPLY' && !keyword.trim()) || !message.trim()}
            type="submit"
          >
            {busy ? 'Creating…' : autoActivate ? 'Create and activate' : 'Create for review'}
          </button>
        </div>
      </form>
    )}

    <div className="automation-kind-grid">
      {automationKinds.map((item) => (
        <div key={item.value} className="automation-kind-card">
          <div className="kind-icon"><CheckCircle2 size={16} /></div>
          <div>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </div>
        </div>
      ))}
    </div>

    {automations.length ? (
      <div className="automation-list">
        {automations.map((item) => (
          <AutomationCard key={item.id} item={item} onAction={() => void action(item)} showNotice={showNotice} />
        ))}
      </div>
    ) : (
      <div className="engage-empty">
        <div className="engage-empty-icon"><Zap size={30} /></div>
        <h3>No automations yet</h3>
        <p>Create one rule, approve it, and matched conversations will appear in Review.</p>
      </div>
    )}
  </div>
}

function AutomationCard({ item, onAction, showNotice }: { item: EngagementAutomation; onAction: () => void; showNotice: (message: string) => void }) {
  const [testing, setTesting] = useState(false)
  const icons = { COMMENT_TO_DM: MessageCircleMore, STORY_REPLY: Instagram, DM_KEYWORD: Search, CLICK_TO_DM: MousePointerClick }
  const Icon = icons[item.kind] || MessageCircleMore
  const trigger = item.keywords.length
    ? `${item.match_mode} “${item.keywords.join('”, “')}”`
    : (item.kind === 'STORY_REPLY' ? 'Any story reply' : 'Any comment')

  const handleTest = async () => {
    try {
      setTesting(true)
      const res = await contentStudioApi.testEngagementAutomation({ automation_id: item.id })
      showNotice(`${res.message} Switch to the Review tab to view and approve!`)
    } catch (error) {
      showNotice(errorMessage(error))
    } finally {
      setTesting(false)
    }
  }

  return <article className="automation-row">
    <div className="automation-row-icon"><Icon size={20} /></div>
    <div className="automation-main">
      <div className="automation-header-meta">
        <span className="automation-type-tag">{item.type}</span>
        <span className={`automation-state ${item.state.toLowerCase().replaceAll(' ', '-')}`}>
          {item.status === 'ACTIVE' ? 'Active' : item.status === 'DRAFT' ? 'Draft (Needs Activation)' : item.state}
        </span>
      </div>
      <h3>{item.name}</h3>
      <p className="automation-guard-note">Matched replies are prepared for human review; no copy is sent automatically.</p>
      <div className="automation-details">
        <div className="automation-detail-pill">
          <span className="detail-key">Trigger:</span>
          <span className="detail-val">{trigger}</span>
        </div>
        <div className="automation-detail-pill">
          <span className="detail-key">DM:</span>
          <span className="detail-val">{item.dm_message}</span>
        </div>
        {item.kind === 'COMMENT_TO_DM' && item.comment_reply && (
          <div className="automation-detail-pill">
            <span className="detail-key">Public:</span>
            <span className="detail-val">{item.comment_reply}</span>
          </div>
        )}
      </div>
    </div>
    <div className="automation-owner">
      <span className="automation-runs-count">{item.runs} conversations</span>
      <span className="automation-owner-name">Owner: {item.owner}</span>
      {item.error && <span className="automation-error-tag">{item.error}</span>}
    </div>
    <div className="automation-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        className="li-quiet-button"
        type="button"
        disabled={testing}
        onClick={() => void handleTest()}
        title="Simulate a test interaction for this automation to verify review card creation"
        style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        <Sparkles size={14} />
        <span>{testing ? 'Testing…' : 'Test Rule'}</span>
      </button>
      {item.status === 'DRAFT' ? (
        <button
          className="button button-dark"
          type="button"
          onClick={onAction}
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          <Play size={14} style={{ marginRight: '4px' }} /> Activate
        </button>
      ) : (
        <button
          className="automation-play"
          type="button"
          aria-label={item.status === 'ACTIVE' ? `Pause ${item.name}` : `Activate ${item.name}`}
          onClick={onAction}
        >
          {item.status === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
        </button>
      )}
    </div>
  </article>
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
    <section className="engage-intro">
      <div className="engage-intro-copy">
        <span className="engage-eyebrow">APPROVE BEFORE SCHEDULING</span>
        <h2>Campaigns and sequences</h2>
        <p>Choose eligible contacts, approve exact messages, then start. Replies and unsubscribes stop the sequence.</p>
      </div>
      <button className="button button-dark" type="button" disabled={!instagram.length} onClick={() => setCreating((value) => !value)}>
        {creating ? <X size={16} /> : <Plus size={16} />}
        {creating ? 'Close' : 'New campaign'}
      </button>
    </section>

    <div className="campaign-guardrail">
      <ShieldCheck size={20} />
      <div>
        <strong>Built-in sending guardrails</strong>
        <span>Only selected Instagram contacts are enrolled. Every audience and message requires approval, and contacts exit when they reply or unsubscribe.</span>
      </div>
    </div>

    {creating && (
      <form className="quick-automation-card campaign-create-form" onSubmit={(event) => void create(event)}>
        <div className="quick-form-header">
          <div className="quick-form-icon"><Send size={20} /></div>
          <div>
            <strong>Create campaign draft</strong>
            <span>Set the audience and message steps. Nothing is enrolled or sent until approved.</span>
          </div>
        </div>

        <div className="quick-form-grid">
          <label className="quick-field">
            <span>Account</span>
            <select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
              {instagram.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="quick-field">
            <span>Campaign Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Demo follow-up" autoFocus />
          </label>

          <fieldset className="campaign-audience-picker quick-field-full">
            <legend>Instagram Contacts ({selectedContacts.length} selected)</legend>
            {contacts.length ? (
              <div className="contacts-checklist-container">
                {contacts.map((contact) => (
                  <label key={contact.id} className="contact-checkbox-card">
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contact.id)}
                      onChange={() => setSelectedContacts((current) => current.includes(contact.id) ? current.filter((id) => id !== contact.id) : [...current, contact.id])}
                    />
                    <div className="contact-checkbox-info">
                      <strong>{contact.name}</strong>
                      <small>{contact.handle}</small>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="no-contacts-note">Contacts appear after someone messages or comments.</p>
            )}
          </fieldset>

          <label className="quick-field quick-field-full">
            <span>First Approved Message</span>
            <textarea value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} placeholder="Message sent when the campaign starts" rows={3} />
          </label>
          <label className="quick-field quick-field-full">
            <span>Optional Follow-up Message</span>
            <textarea value={secondMessage} onChange={(event) => setSecondMessage(event.target.value)} placeholder="Leave blank for one step" rows={2} />
          </label>
          {secondMessage && (
            <label className="quick-field">
              <span>Follow-up Delay (minutes)</span>
              <input type="number" min="1" value={delay} onChange={(event) => setDelay(Number(event.target.value))} />
            </label>
          )}
        </div>

        <div className="quick-form-footer">
          <button type="button" className="li-quiet-button" onClick={() => setCreating(false)}>Cancel</button>
          <button className="button button-dark" disabled={busy || !name.trim() || !selectedContacts.length || !firstMessage.trim()} type="submit">
            {busy ? 'Saving…' : 'Save campaign draft'}
          </button>
        </div>
      </form>
    )}

    {campaigns.length ? (
      <div className="campaign-grid">
        {campaigns.map((item) => (
          <article className="campaign-card" key={item.id}>
            <header className="campaign-card-header">
              <span className="engage-platform-icon instagram"><Instagram size={18} /></span>
              <span className={`campaign-status ${item.status === 'ACTIVE' ? 'active' : 'review'}`}>{item.state}</span>
            </header>
            <div className="campaign-card-content">
              <h3>{item.name}</h3>
              <p className="campaign-audience-label">{item.audience.label || 'Selected Instagram contacts'}</p>

              <div className="campaign-steps-timeline">
                {item.steps.map((step, index) => (
                  <div key={`${item.id}-${index}`} className="timeline-step">
                    <div className="timeline-step-indicator">{index + 1}</div>
                    <div className="timeline-step-body">
                      <strong>{step.message}</strong>
                      <small>{index === 0 ? 'On start' : `${step.delay_minutes} min later`} · stops on reply</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="campaign-card-meta">
                <div className="campaign-meta-item">
                  <span className="meta-label">Audience</span>
                  <strong className="meta-value">{item.audience.contact_ids?.length ?? 0} contacts</strong>
                </div>
                <div className="campaign-meta-item">
                  <span className="meta-label">Owner</span>
                  <strong className="meta-value">{item.owner}</strong>
                </div>
              </div>

              {item.error && <p className="campaign-error-text">{item.error}</p>}
            </div>

            <footer className="campaign-card-footer">
              <button
                className={item.status === 'ACTIVE' ? 'li-quiet-button campaign-action-btn' : 'button button-dark campaign-action-btn'}
                type="button"
                onClick={() => void action(item)}
              >
                {item.status === 'ACTIVE' ? <Pause size={15} /> : <Play size={15} />}
                {item.status === 'DRAFT' || item.status === 'FAILED' ? 'Approve campaign' : item.status === 'ACTIVE' ? 'Pause campaign' : 'Start campaign'}
              </button>
            </footer>
          </article>
        ))}
      </div>
    ) : (
      <div className="engage-empty">
        <div className="engage-empty-icon"><Send size={30} /></div>
        <h3>No campaigns yet</h3>
        <p>Create a small, focused sequence for eligible Instagram contacts.</p>
      </div>
    )}
  </div>
}

function EngagementAnalytics({ analytics, team, reviews }: { analytics: AnalyticsData; team: EngagementTeamMember[]; reviews: EngagementReview[] }) {
  const maximum = Math.max(1, ...analytics.sources.map((item) => item.value))

  return <div className="engage-view">
    <section className="engage-intro">
      <div className="engage-intro-copy">
        <span className="engage-eyebrow">CLEAR, USEFUL NUMBERS</span>
        <h2>Engagement analytics</h2>
        <p>See which approved flows start conversations and where your team needs attention.</p>
      </div>
    </section>

    <div className="engagement-metrics-grid">
      <article className="metric-tile">
        <span className="metric-title">Conversations started</span>
        <strong className="metric-number">{analytics.conversations_started}</strong>
        <span className="metric-subtext">Known contacts and enrollments</span>
      </article>
      <article className="metric-tile">
        <span className="metric-title">Replies approved</span>
        <strong className="metric-number">{analytics.replies_approved}</strong>
        <span className="metric-subtext">{analytics.pending_reviews} waiting for review</span>
      </article>
      <article className="metric-tile">
        <span className="metric-title">Reply rate</span>
        <strong className="metric-number">{analytics.reply_rate}%</strong>
        <span className="metric-subtext">Across known conversations</span>
      </article>
      <article className="metric-tile">
        <span className="metric-title">Link clicks</span>
        <strong className="metric-number">{analytics.link_clicks}</strong>
        <span className="metric-subtext">Tracked automation links</span>
      </article>
    </div>

    <div className="engagement-analytics-grid">
      <section className="analytics-card engage-chart">
        <header className="analytics-card-header">
          <div>
            <h3>Conversations by source</h3>
            <p>Runs recorded by approved rule.</p>
          </div>
          <div className="analytics-header-icon"><BarChart3 size={20} /></div>
        </header>
        <div className="engage-bars-list">
          {analytics.sources.length ? analytics.sources.map((bar) => (
            <div className="engage-bar-row" key={bar.label}>
              <span className="engage-bar-label">{bar.label}</span>
              <div className="engage-bar-track">
                <div className="engage-bar-fill" style={{ width: `${Math.round((bar.value / maximum) * 100)}%` }} />
              </div>
              <strong className="engage-bar-count">{bar.value}</strong>
            </div>
          )) : (
            <p className="no-data-note">No source activity recorded yet.</p>
          )}
        </div>
      </section>

      <section className="analytics-card team-performance">
        <header className="analytics-card-header">
          <div>
            <h3>Team review load</h3>
            <p>Suggestions currently assigned.</p>
          </div>
        </header>
        <div className="team-members-list">
          {team.map((member) => {
            const waiting = reviews.filter((item) => item.assignee_id === member.id).length
            return (
              <div key={member.id} className="team-member-row">
                <span className="team-avatar">{member.name.slice(0, 1).toUpperCase()}</span>
                <div className="team-member-info">
                  <strong>{member.is_current_user ? 'You' : member.name}</strong>
                  <span className="team-waiting-tag">{waiting} waiting</span>
                </div>
                <span className="team-role-tag">{member.role.toLowerCase()}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  </div>
}

function LinkedInCopilot({ reviews, team, onReplace, showNotice }: { reviews: EngagementReview[]; team: EngagementTeamMember[]; onReplace: (item: EngagementReview) => void; showNotice: (message: string) => void }) {
  const first = reviews[0]
  const manualDraft = first ? `Hi ${first.person.split(' ')[0]} — thanks for your question on our post. I wanted to follow up personally in case more detail would be useful.` : 'Write a short personal follow-up after you have replied publicly.'
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(manualDraft)
      showNotice('Draft copied. Open LinkedIn and send it yourself.')
    } catch {
      showNotice('Copy is unavailable in this browser. Select the draft text manually.')
    }
  }

  return <div className="engage-view">
    <section className="engage-intro">
      <div className="engage-intro-copy">
        <span className="engage-eyebrow">LINKEDIN ENGAGEMENT COPILOT</span>
        <h2>Turn comments into thoughtful follow-up</h2>
        <p>AI suggests public replies and personal follow-ups. Your team reviews everything; personal messages are always sent manually on LinkedIn.</p>
      </div>
      <span className="linkedin-compliance"><ShieldCheck size={16} />Compliant, human-led workflow</span>
    </section>

    <div className="linkedin-limit">
      <div className="linkedin-limit-icon"><Linkedin size={22} /></div>
      <div className="linkedin-limit-col">
        <strong>What this workspace can do</strong>
        <p>Manage Company Page comments, suggest replies, identify leads, assign follow-up, and prepare a personal message for a human to send.</p>
      </div>
      <div className="linkedin-limit-col">
        <strong>What stays manual</strong>
        <p>Connection requests, personal DMs, and InMail are never automated.</p>
      </div>
    </div>

    <div className="copilot-layout">
      <section className="copilot-comments">
        <header className="copilot-comments-header">
          <div>
            <h3>Comments to review</h3>
            <p>Company Page comments appear here.</p>
          </div>
          <span className="copilot-count-badge">{reviews.length}</span>
        </header>
        {reviews.length ? (
          <div className="copilot-cards-list">
            {reviews.map((item) => (
              <LinkedInReview key={item.id} item={item} team={team} onReplace={onReplace} showNotice={showNotice} />
            ))}
          </div>
        ) : (
          <div className="engage-empty">
            <div className="engage-empty-icon"><CheckCircle2 size={30} /></div>
            <h3>No LinkedIn comments waiting</h3>
            <p>Any incoming questions on your LinkedIn posts will appear here.</p>
          </div>
        )}
      </section>

      <aside className="manual-followup">
        <div className="manual-followup-header">
          <span className="manual-followup-icon"><Copy size={18} /></span>
          <div>
            <h3>Personal follow-up draft</h3>
            <p>{first ? `For ${first.person} · after the public reply` : 'Prepared for manual sending'}</p>
          </div>
        </div>
        <div className="manual-followup-box">{manualDraft}</div>
        <div className="manual-followup-actions">
          <button className="li-quiet-button" type="button" onClick={() => void copy()}>
            <Copy size={15} />Copy draft
          </button>
          <a className="button button-dark" href="https://www.linkedin.com" target="_blank" rel="noreferrer">
            Open LinkedIn <ExternalLink size={14} />
          </a>
        </div>
        <small className="manual-followup-disclaimer">This product cannot send personal LinkedIn messages for you.</small>
      </aside>
    </div>
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

  return <article className="copilot-card">
    <header className="copilot-card-header">
      <div className="review-card-author">
        <span className="engage-platform-icon linkedin"><Linkedin size={17} /></span>
        <div className="review-person-info">
          <strong className="review-person-name">{item.person}</strong>
          <span className="review-person-handle">{item.handle}</span>
        </div>
      </div>
      <span className="lead-intent">Comment</span>
    </header>
    <blockquote className="copilot-blockquote">{item.incoming}</blockquote>
    <label className="copilot-draft-field">
      <span className="copilot-draft-label"><Sparkles size={14} />Suggested public reply</span>
      <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} />
    </label>
    <footer className="copilot-card-footer">
      <div className="copilot-footer-assignee">
        <select value={item.assignee_id} aria-label="Assign follow-up" onChange={(event) => void assign(event.target.value)}>
          <option value="">Unassigned</option>
          {team.map((person) => (
            <option key={person.id} value={person.id}>{person.is_current_user ? 'You' : person.name}</option>
          ))}
        </select>
      </div>
      <button className="button button-dark" type="button" disabled={!draft.trim()} onClick={() => void approve()}>
        <Check size={15} />Approve public reply
      </button>
    </footer>
  </article>
}
