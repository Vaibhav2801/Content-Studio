import { Archive, BookOpen, Calendar, Copy, ExternalLink, FileText, LoaderCircle, Recycle, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { contentStudioApi, type LibraryFilters } from '../../../api/contentStudio'
import { contentStudioMockLibrary } from '../../../api/contentStudioMock'
import type { LibraryPost } from '../../../types/contentStudio'
import { useContentStudio } from '../ContentStudioContext'
import { EmptyState } from '../EmptyState'
import { KnowledgeHubLinks } from '../KnowledgeHubLinks'
import { BrandBrainPanel } from '../knowledge/BrandBrainPanel'
import { ContentSourcesPanel } from '../knowledge/ContentSourcesPanel'
import { StoryInterviewPanel } from '../knowledge/StoryInterviewPanel'
import { customerSafeMessage } from '../contentUtils'

const statuses = [
  ['', 'All'], ['DRAFT', 'Drafts'], ['SCHEDULED', 'Scheduled'], ['PUBLISHED', 'Published'], ['FAILED', 'Failed'], ['CANCELLED', 'Cancelled'],
]

export function ContentLibraryView() {
  const { isDemo } = useContentStudio()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedPanel = searchParams.get('panel')
  const panel = requestedPanel === 'brand' || requestedPanel === 'sources' || requestedPanel === 'story' ? requestedPanel : null
  const [filters, setFilters] = useState<LibraryFilters>(() => ({ status: searchParams.get('status') ?? '' }))
  const [posts, setPosts] = useState<LibraryPost[] | null>(null)
  const [details, setDetails] = useState('')
  const [scheduleFor, setScheduleFor] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try { setPosts(isDemo ? structuredClone(contentStudioMockLibrary) : await contentStudioApi.library(filters)) }
    catch (loadError) { setError(customerSafeMessage(loadError instanceof Error ? loadError.message : undefined, 'Could not load the Content Library.')) }
  }, [filters, isDemo])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer) }, [load])

  const action = async (post: LibraryPost, value: 'DUPLICATE' | 'REUSE_IDEA' | 'ARCHIVE') => {
    setBusy(`${post.id}-${value}`); setError('')
    try {
      if (isDemo) {
        if (value === 'ARCHIVE') setPosts((current) => current?.filter((item) => item.id !== post.id) ?? current)
        else navigate(`/content/create?draft=${post.id}`)
      } else {
        const result = await contentStudioApi.libraryAction(post.id, value)
        if (value === 'ARCHIVE') await load()
        else navigate(`/content/create?draft=${result.id}`)
      }
    } catch (actionError) { setError(customerSafeMessage(actionError instanceof Error ? actionError.message : undefined, 'Could not update this post.')) }
    finally { setBusy('') }
  }

  const reschedule = async (variantId: string) => {
    const local = scheduleFor[variantId]
    if (!local) { setError("Choose a new date and time first."); return }
    setBusy(`${variantId}-RESCHEDULE`); setError("")
    try {
      if (!isDemo) await contentStudioApi.reschedule(variantId, new Date(local).toISOString())
      await load()
    } catch (actionError) { setError(customerSafeMessage(actionError instanceof Error ? actionError.message : undefined, "Could not reschedule this post.")) }
    finally { setBusy("") }
  }

  return <section className="studio-screen" aria-label="Content Library">
    <KnowledgeHubLinks base="/content/library" />
    {panel === 'brand' && <BrandBrainPanel />}
    {panel === 'sources' && <ContentSourcesPanel />}
    {panel === 'story' && <StoryInterviewPanel />}
    {!panel && error && <div className="li-banner error" role="alert">{error}</div>}
    {!panel && <>
    <div className="library-filters card"><div className="library-search"><Search size={16} /><input aria-label="Search content" value={filters.q ?? ''} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search topic or source…" /></div><label>Status<select aria-label="Status filter" value={filters.status ?? ''} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>{statuses.map(([value, label]) => <option value={value} key={label}>{label}</option>)}</select></label><label>Platform<select aria-label="Platform filter" value={filters.platform ?? ''} onChange={(event) => setFilters({ ...filters, platform: event.target.value })}><option value="">All platforms</option><option value="LINKEDIN">LinkedIn</option><option value="X">X</option><option value="INSTAGRAM">Instagram</option></select></label><label>From<input aria-label="From date" type="date" value={filters.date_from ?? ''} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} /></label><label>To<input aria-label="To date" type="date" value={filters.date_to ?? ''} onChange={(event) => setFilters({ ...filters, date_to: event.target.value })} /></label></div>
    {!posts ? <div className="li-loading" role="status">Loading Content Library…</div> : posts.length === 0 ? <div className="card"><EmptyState icon={BookOpen} title="No content matches" detail="Try clearing a filter or create a new post." action={{ label: 'Create a post', to: '/content/create' }} /></div> : <div className="library-post-list">{posts.map((post) => <article className="card library-post-card" key={post.id}>
      <header><span className="library-file-icon"><FileText size={18} /></span><div><span>{post.source?.label || 'New idea'}</span><h3>{post.idea_title}</h3><small><Calendar size={13} /> Updated {new Date(post.updated_at).toLocaleDateString()}</small></div><span className={`li-status status-${post.state.toLowerCase()}`}>{post.state.replaceAll('_', ' ')}</span></header>
      <p>{post.idea_text || post.variants[0]?.copy || 'No summary yet.'}</p>
      <div className="library-platforms">{post.variants.map((variant) => <span key={variant.id}>{variant.network_label}{variant.media.length ? ` · ${variant.media.length} media` : ''}</span>)}</div>
      {details === post.id && <div className="library-details"><h4>Platform versions</h4>{post.variants.map((variant) => <div key={variant.id}><strong>{variant.network_label} · {variant.account?.display_name || 'Draft only'}</strong><p>{variant.copy || 'No platform copy yet.'}</p><small>{variant.hashtags.join(' ')}</small>{!["PUBLISHED", "CANCELLED"].includes(variant.status) && <div className="library-reschedule"><label>Publish at <input type="datetime-local" aria-label={`New schedule for ${variant.network_label}`} value={scheduleFor[variant.id] ?? ""} onChange={(event) => setScheduleFor((current) => ({ ...current, [variant.id]: event.target.value }))} /></label><button className="li-quiet-button" type="button" disabled={Boolean(busy) || !scheduleFor[variant.id]} aria-busy={busy === `${variant.id}-RESCHEDULE`} onClick={() => void reschedule(variant.id)}>{busy === `${variant.id}-RESCHEDULE` ? <LoaderCircle className="spin" size={15} /> : <Calendar size={15} />} Reschedule</button></div>}</div>)}</div>}
      <footer><button className="li-quiet-button" onClick={() => setDetails(details === post.id ? '' : post.id)}><ExternalLink size={15} /> {details === post.id ? 'Close details' : 'Open details'}</button><button className="li-quiet-button" disabled={Boolean(busy)} aria-busy={busy === post.id + '-DUPLICATE'} onClick={() => void action(post, 'DUPLICATE')}>{busy === post.id + '-DUPLICATE' ? <LoaderCircle className="spin" size={15} /> : <Copy size={15} />} Duplicate</button><button className="li-quiet-button" disabled={Boolean(busy)} aria-busy={busy === post.id + '-REUSE_IDEA'} onClick={() => void action(post, 'REUSE_IDEA')}>{busy === post.id + '-REUSE_IDEA' ? <LoaderCircle className="spin" size={15} /> : <Recycle size={15} />} Reuse idea</button><button className="li-text-button danger" disabled={Boolean(busy)} aria-busy={busy === post.id + '-ARCHIVE'} onClick={() => void action(post, 'ARCHIVE')}>{busy === `${post.id}-ARCHIVE` ? <LoaderCircle className="spin" size={15} /> : <Archive size={15} />} Archive</button></footer>
    </article>)}</div>}
    </>}
  </section>
}
