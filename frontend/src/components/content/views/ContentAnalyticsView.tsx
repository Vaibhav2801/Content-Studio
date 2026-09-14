import { BarChart3, Check, Lightbulb, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { contentStudioApi } from '../../../api/contentStudio'
import { contentStudioMockAnalytics } from '../../../api/contentStudioMock'
import type { AnalyticsComparisonRow, AnalyticsMetricCell, AnalyticsMetricName, ContentAnalytics } from '../../../types/contentStudio'
import { useContentStudio } from '../ContentStudioContext'
import { EmptyState } from '../EmptyState'
import { customerSafeMessage } from '../contentUtils'

const summaryMetrics: AnalyticsMetricName[] = ['IMPRESSIONS', 'VIEWS', 'LIKES', 'REACTIONS', 'COMMENTS', 'SHARES', 'REPOSTS', 'CLICKS', 'FOLLOWER_GROWTH']
const comparisonMetrics: AnalyticsMetricName[] = ['IMPRESSIONS', 'VIEWS', 'LIKES', 'REACTIONS', 'COMMENTS', 'SHARES', 'REPOSTS', 'CLICKS']
const dimensions = [
  { key: 'platform' as const, label: 'Platform' },
  { key: 'topic' as const, label: 'Topic' },
  { key: 'content_pillar' as const, label: 'Content pillar' },
  { key: 'format' as const, label: 'Format' },
]

const displayValue = (cell?: AnalyticsMetricCell) => cell?.available && cell.value !== null ? new Intl.NumberFormat().format(cell.value) : 'Unavailable'

export function ContentAnalyticsView() {
  const { isDemo } = useContentStudio()
  const [data, setData] = useState<ContentAnalytics | null>(null)
  const [dimension, setDimension] = useState<(typeof dimensions)[number]['key']>('platform')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const attemptedInitialRefresh = useRef(false)
  const load = useCallback(async () => {
    setError('')
    try { setData(isDemo ? structuredClone(contentStudioMockAnalytics) : await contentStudioApi.analytics()) }
    catch (loadError) { setError(customerSafeMessage(loadError instanceof Error ? loadError.message : undefined, 'Could not load content analytics.')) }
  }, [isDemo])
  useEffect(() => { void load() }, [load])
  const refresh = async () => {
    setBusy('refresh'); setError('')
    try { if (isDemo) await load(); else { const result = await contentStudioApi.refreshAnalytics(); setData(result.analytics); if (result.refresh.failed && !result.refresh.observations) setError('The connected network has not returned metrics yet. Check the connection and try again later.') } }
    catch (refreshError) { setError(customerSafeMessage(refreshError instanceof Error ? refreshError.message : undefined, 'Could not refresh analytics.')) }
    finally { setBusy('') }
  }
  const decide = async (id: string, action: 'ACCEPT' | 'DISMISS') => {
    setBusy(id + '-' + action); setError('')
    try {
      if (isDemo) setData((current) => current ? { ...current, suggestions: current.suggestions.map((item) => item.id === id ? { ...item, status: action === 'ACCEPT' ? 'ACCEPTED' : 'DISMISSED' } : item) } : current)
      else setData(await contentStudioApi.decideAnalyticsSuggestion(id, action))
    } catch (actionError) { setError(customerSafeMessage(actionError instanceof Error ? actionError.message : undefined, 'Could not update that suggestion.')) }
    finally { setBusy('') }
  }
  const availableSummary = useMemo(() => data ? summaryMetrics.filter((name) => data.summary[name]?.available) : [], [data])
  const rows = data?.comparisons[dimension] ?? []
  const publishedPosts = data?.readiness?.published_posts ?? data?.comparisons.platform.reduce((total, row) => total + row.posts, 0) ?? 0
  const measuredPosts = data?.readiness?.measured_posts ?? Math.max(0, ...Object.values(data?.summary ?? {}).map((cell) => cell.measured_posts))
  useEffect(() => {
    if (!isDemo && data && publishedPosts > 0 && measuredPosts === 0 && !attemptedInitialRefresh.current) { attemptedInitialRefresh.current = true; void refresh() }
  }, [data, isDemo, publishedPosts, measuredPosts]) // eslint-disable-line react-hooks/exhaustive-deps

  return <section className="studio-screen analytics-screen" aria-label="Content analytics">
    {error && <div className="li-banner error" role="alert">{error}</div>}
    {!data ? <div className="li-loading" role="status">Loading analytics…</div> : <>
      <section className="card analytics-readiness" aria-label="Analytics readiness"><div><BarChart3 size={21} /><span><strong>{availableSummary.length ? 'Performance data is available' : publishedPosts ? 'Waiting for performance metrics' : 'Publish to start measuring performance'}</strong><small>{availableSummary.length ? `Last updated ${data.readiness?.last_measured_at ? new Date(data.readiness.last_measured_at).toLocaleString() : 'from the latest provider data'}` : publishedPosts ? 'Published posts are visible; provider metrics will appear after they sync.' : 'Analytics begins automatically after your first post is published.'}</small></span></div><button className="li-quiet-button" type="button" disabled={Boolean(busy)} aria-busy={busy === 'refresh'} onClick={() => void refresh()}>{busy === 'refresh' ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Refresh metrics</button><dl><div><dt>Published</dt><dd>{publishedPosts}</dd></div><div><dt>Measured</dt><dd>{measuredPosts}</dd></div><div><dt>Accounts</dt><dd>{data.readiness?.connected_accounts ?? '—'}</dd></div></dl></section>
      <section className="card analytics-activity" aria-label="Publishing activity"><div><strong>{data.readiness?.draft_posts ?? 0}</strong><span>Draft versions</span></div><div><strong>{data.readiness?.scheduled_posts ?? 0}</strong><span>Planned versions</span></div><div><strong>{publishedPosts}</strong><span>Published versions</span></div><div><strong>{data.readiness?.failed_posts ?? 0}</strong><span>Need attention</span></div></section>
      {publishedPosts > 0 && <section className="card analytics-platform-activity"><h3>Published by platform</h3><div>{data.comparisons.platform.map((row) => <div key={row.key}><span>{row.label}</span><strong>{row.posts}</strong></div>)}</div></section>}
      {availableSummary.length ? <><div className="analytics-summary">{summaryMetrics.map((name) => <MetricCard key={name} name={name} cell={data.summary[name]} />)}</div><p className="analytics-correlation-note">{data.data_note}</p></> : <div className="card analytics-empty-state"><EmptyState icon={BarChart3} title={publishedPosts ? 'Metrics are still syncing' : 'No published posts yet'} detail={publishedPosts ? 'Select Refresh metrics to fetch the latest available results from your connected network.' : 'Publish a post first. Nomad will then collect every metric the connected network makes available.'} action={publishedPosts ? { label: 'Check connections', to: '/content/connections' } : { label: 'Create a post', to: '/content/create' }} /></div>}
      {availableSummary.length > 0 && <section className="card analytics-comparison" aria-labelledby="comparison-title"><div className="li-section-heading row"><div><h3 id="comparison-title">Compare results</h3></div></div><div className="analytics-dimension-tabs" role="group" aria-label="Comparison type">{dimensions.map((item) => <button type="button" key={item.key} aria-pressed={dimension === item.key} onClick={() => setDimension(item.key)}>{item.label}</button>)}</div>{rows.length ? <ComparisonTable rows={rows} /> : <p className="analytics-empty">Publish more posts to compare this view.</p>}</section>}
      {data.suggestions.length > 0 && <section className="card analytics-suggestions" aria-labelledby="suggestions-title"><div className="li-section-heading row"><div><h3 id="suggestions-title">Practical improvements</h3><p>Nothing changes in Brand Brain until you accept it.</p></div></div><div className="analytics-suggestion-list">{data.suggestions.map((suggestion) => <article key={suggestion.id}><Lightbulb size={18} /><div><span className={`li-status status-${suggestion.status.toLowerCase()}`}>{suggestion.status === 'PENDING' ? 'Suggested' : suggestion.status.toLowerCase()}</span><h4>{suggestion.rule}</h4><p>{suggestion.rationale}</p><small>Evidence: {suggestion.evidence.posts ?? 0} posts · {suggestion.evidence.denominator || 'available post metrics'}</small></div>{suggestion.status === 'PENDING' && <div><button className="li-quiet-button" disabled={Boolean(busy)} aria-busy={busy === suggestion.id + "-ACCEPT"} onClick={() => void decide(suggestion.id, 'ACCEPT')}>{busy === suggestion.id + "-ACCEPT" ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Accept</button><button className="li-text-button" disabled={Boolean(busy)} aria-busy={busy === suggestion.id + "-DISMISS"} onClick={() => void decide(suggestion.id, 'DISMISS')}><X size={15} /> Dismiss</button></div>}</article>)}</div></section>}
      <div className="analytics-footer-link"><Link to="/content/library?status=PUBLISHED">View published content</Link></div>
    </>}
  </section>
}

function MetricCard({ name, cell }: { name: AnalyticsMetricName; cell: AnalyticsMetricCell }) {
  const subject = name === 'FOLLOWER_GROWTH' ? 'account' : 'post'
  return <div className={`card analytics-metric ${cell.available ? '' : 'unavailable'}`}><span>{cell.label}</span><strong>{displayValue(cell)}</strong><small>{cell.available ? `Across ${cell.measured_posts} measured ${subject}${cell.measured_posts === 1 ? '' : 's'}` : `Not reported for connected ${subject}s`}</small></div>
}

function ComparisonTable({ rows }: { rows: AnalyticsComparisonRow[] }) {
  return <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th scope="col">Group</th><th scope="col">Posts</th>{comparisonMetrics.map((name) => <th scope="col" key={name}>{rows[0]?.metrics[name]?.label ?? name.toLowerCase()}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.key}><th scope="row">{row.label}</th><td>{row.posts}</td>{comparisonMetrics.map((name) => <td key={name} className={row.metrics[name]?.available ? '' : 'unavailable'}>{displayValue(row.metrics[name])}</td>)}</tr>)}</tbody></table></div>
}
