import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckSquare,
  CircleAlert,
  FileText,
  Link2,
  Plus,
  Settings2,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { contentStudioApi } from '../../../api/contentStudio'
import { contentStudioMockHome } from '../../../api/contentStudioMock'
import type { HomeSummary, StudioVariantCard } from '../../../types/contentStudio'
import { useContentStudio } from '../ContentStudioContext'
import { customerSafeMessage, formatSchedule } from '../contentUtils'

const workflow = [
  { number: '01', label: 'Collect your ideas', detail: 'Keep source material and stories in one place.', to: '/content/library?panel=sources' },
  { number: '02', label: 'Create and review', detail: 'Shape platform-ready drafts with your team.', to: '/content/create' },
  { number: '03', label: 'Schedule and learn', detail: 'Publish on time, then see what resonates.', to: '/content/calendar' },
]

export function ContentHomeView() {
  const { settingsDraft, isDemo, busy, toggleAutomation } = useContentStudio()
  const [summary, setSummary] = useState<HomeSummary | null>(null)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(() => {
      if (active) setError('The live overview is taking longer than expected. You can retry or keep working in another section.')
    }, 12000)
    const load = async () => {
      setError('')
      try {
        const result = isDemo ? structuredClone(contentStudioMockHome) : await contentStudioApi.home()
        if (active) { setSummary(result); setError('') }
      } catch (loadError) {
        if (active) setError(customerSafeMessage(loadError instanceof Error ? loadError.message : undefined, 'Could not load the Content Studio summary.'))
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void load()
    return () => { active = false; window.clearTimeout(timeout) }
  }, [isDemo, retryKey])

  const failures = summary?.failures ?? []
  const attentionCount = failures.length + (summary?.connections_needing_attention ?? 0)
  const hasActivity = Boolean(summary && (summary.needs_approval.length || summary.upcoming.length || summary.recent_drafts?.length || failures.length))
  const totals = summary?.totals

  return <section className="studio-screen studio-home" aria-label="Content Studio overview">
    <section className="studio-home-hero" aria-labelledby="studio-home-hero-title">
      <div className="studio-home-hero-copy">
        <span className="studio-home-eyebrow"><span /> YOUR PUBLISHING DESK</span>
        <h2 id="studio-home-hero-title">Good content starts here.</h2>
        <p>Bring your ideas, drafts, approvals and publishing plan together in one place.</p>
        <div className="studio-home-hero-actions">
          <Link className="button button-dark" to="/content/create?new=1"><Plus size={17} /> New post</Link>
          <Link className="studio-hero-secondary" to="/content/calendar">Explore calendar <ArrowRight size={16} /></Link>
        </div>
      </div>
      <div className="studio-home-hero-art" aria-hidden="true">
        <div className="studio-art-orbit orbit-one" />
        <div className="studio-art-orbit orbit-two" />
        <div className="studio-art-card">
          <span><Sparkles size={14} /> THE CONTENT FLOW</span>
          <div><i>01</i><strong>Idea</strong><small>Find your angle</small></div>
          <div><i>02</i><strong>Draft</strong><small>Make it yours</small></div>
          <div><i>03</i><strong>Publish</strong><small>Share it well</small></div>
        </div>
      </div>
    </section>

    <div className="studio-publishing-bar card">
      <div className="studio-publishing-state">
        <span className={`studio-publishing-indicator ${settingsDraft.is_active ? 'live' : ''}`} />
        <div><strong>{settingsDraft.is_active ? 'Scheduled publishing is on' : 'Scheduled publishing is off'}</strong><small>{settingsDraft.is_active ? `Posts will go out in ${settingsDraft.timezone}` : 'Approved posts will wait until you turn it on.'}</small></div>
      </div>
      <div className="studio-publishing-actions">
        <button className={`switch ${settingsDraft.is_active ? 'on' : ''}`} type="button" disabled={busy === "automation"} aria-busy={busy === "automation"} onClick={() => void toggleAutomation()} aria-label="Toggle scheduled publishing" aria-pressed={settingsDraft.is_active}><i /></button>
        <Link className="li-quiet-button" to="/content/settings"><Settings2 size={16} /> Schedule settings</Link>
      </div>
    </div>

    {attentionCount > 0 && <section className="card content-attention-card" aria-labelledby="attention-title"><CircleAlert size={22} /><div><span>NEEDS ATTENTION</span><h2 id="attention-title">Publishing needs a quick check</h2><p>{failures.length ? `${failures.length} post${failures.length === 1 ? '' : 's'} could not be published.` : `${summary?.connections_needing_attention} social account${summary?.connections_needing_attention === 1 ? '' : 's'} need to be reconnected.`}</p></div><Link className="li-quiet-button" to={failures.length ? '/content/library?status=FAILED' : '/content/connections'}>Review now <ArrowRight size={15} /></Link></section>}

    <div className="studio-section-intro"><div><span>AT A GLANCE</span><h2>Your content pipeline</h2></div><Link to="/content/library">View all content <ArrowRight size={16} /></Link></div>
    <section className="content-stat-grid" aria-label="Content summary">
      <Link className="card content-stat" to="/content/approvals"><span className="studio-stat-icon violet"><CheckSquare size={21} /></span><span>Needs review</span><strong>{summary ? totals?.needs_review ?? summary.needs_approval.length : '—'}</strong><small>Approve exact versions <ArrowRight size={14} /></small></Link>
      <Link className="card content-stat" to="/content/calendar"><span className="studio-stat-icon blue"><CalendarDays size={21} /></span><span>Scheduled</span><strong>{summary ? totals?.scheduled ?? summary.upcoming.length : '—'}</strong><small>View publishing plan <ArrowRight size={14} /></small></Link>
      <Link className="card content-stat" to="/content/library?status=PUBLISHED"><span className="studio-stat-icon peach"><BookOpen size={21} /></span><span>Published</span><strong>{summary ? totals?.published ?? 0 : '—'}</strong><small>Review live content <ArrowRight size={14} /></small></Link>
      <Link className="card content-stat" to="/content/library?status=DRAFT"><span className="studio-stat-icon mint"><FileText size={21} /></span><span>Drafts</span><strong>{summary ? totals?.drafts ?? 0 : '—'}</strong><small>Continue writing <ArrowRight size={14} /></small></Link>
    </section>

    <div className="studio-home-body">
      <div className="studio-home-feed">
        <div className="studio-section-intro compact"><div><span>WHAT'S NEXT</span><h2>Your desk</h2></div></div>
        {!summary && error ? <section className="card studio-overview-error" role="alert"><CircleAlert size={24} /><div><h3>Could not load the live overview</h3><p>{error}</p><div><button className="button button-dark" type="button" onClick={() => { setSummary(null); setRetryKey((value) => value + 1) }}>Try again</button><Link className="li-quiet-button" to="/content/create">Keep creating</Link></div></div></section> : !summary ? <section className="card studio-overview-skeleton" role="status" aria-label="Loading content overview"><div className="studio-skeleton-title" /><div className="studio-skeleton-row" /><div className="studio-skeleton-row short" /><span>Loading your content overview…</span></section> : !hasActivity ? <section className="card content-home-empty"><span><Sparkles size={24} /></span><div><h2>Your workspace is ready</h2><p>Start with an idea, add source material, or connect the account that will publish your work.</p><div className="studio-empty-actions"><Link className="li-quiet-button" to="/content/library?panel=sources">Add sources</Link><Link className="li-quiet-button" to="/content/connections"><Link2 size={15} /> Check accounts</Link></div></div></section> : <>
          {(summary.recent_drafts?.length ?? 0) > 0 && <HomeList title="Continue your drafts" eyebrow="IN PROGRESS" link="/content/library?status=DRAFT" linkLabel="All drafts" items={summary.recent_drafts ?? []} timezone={settingsDraft.timezone} />}
          {summary.needs_approval.length > 0 && <HomeList title="Posts needing approval" eyebrow="REVIEW" link="/content/approvals" linkLabel="Open approvals" items={summary.needs_approval} timezone={settingsDraft.timezone} />}
          {summary.upcoming.length > 0 && <HomeList title="Next scheduled posts" eyebrow="UP NEXT" link="/content/calendar" linkLabel="View calendar" items={summary.upcoming} timezone={settingsDraft.timezone} />}
          {failures.length > 0 && <HomeList title="Failures requiring attention" eyebrow="NEEDS ATTENTION" link="/content/library?status=FAILED" linkLabel="View failed posts" items={failures} timezone={settingsDraft.timezone} failure />}
        </>}
      </div>
      <aside className="studio-home-rail" aria-label="Publishing guide">
        <section className="card studio-workflow-card"><span className="studio-rail-eyebrow">A SIMPLE WORKFLOW</span><h3>From first thought to published post.</h3><div>{workflow.map((step) => <Link key={step.number} to={step.to}><span>{step.number}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><ArrowRight size={15} /></Link>)}</div></section>
        <Link className="studio-sources-callout" to="/content/library?panel=sources"><span><BookOpen size={20} /></span><strong>Build your source library</strong><small>Give every post a stronger starting point.</small><ArrowRight size={17} /></Link>
      </aside>
    </div>
  </section>
}

function HomeList({ title, eyebrow, link, linkLabel, items, timezone, failure = false }: { title: string; eyebrow: string; link: string; linkLabel: string; items: StudioVariantCard[]; timezone: string; failure?: boolean }) {
  const headingId = `home-${eyebrow.toLowerCase().replaceAll(' ', '-')}`
  return <section className="card content-home-section" aria-labelledby={headingId}><div className="li-section-heading row"><div><span>{eyebrow}</span><h2 id={headingId}>{title}</h2></div><Link className="li-quiet-button" to={link}>{linkLabel} <ArrowRight size={15} /></Link></div><div className="content-simple-list">{items.map((item) => <Link key={item.id} to={`/content/create?draft=${item.post_id}`}><span><strong>{item.topic}</strong><small>{item.network_label} · {item.account?.display_name || 'Draft only'}{item.status === 'DRAFT' ? ' · Continue editing' : ` · ${formatSchedule(item.scheduled_for, timezone)}`}</small></span><span className={`li-status status-${failure ? 'failed' : item.status.toLowerCase()}`}>{failure ? 'Needs attention' : item.status.replaceAll('_', ' ')}</span></Link>)}</div></section>
}
