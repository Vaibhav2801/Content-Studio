import { CalendarDays, LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { socialComposerApi } from '../../../api/socialComposer'
import { makeDemoPost, socialComposerMockOptions } from '../../../api/socialComposerMock'
import type { ComposerOptions, SocialNetwork, SocialPost } from '../../../types/socialComposer'
import { useContentStudio } from '../ContentStudioContext'
import { customerSafeMessage } from '../contentUtils'

const firstDate = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
  date.setMinutes(0, 0, 0)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`
}

export function ContentSeriesView() {
  const { isDemo } = useContentStudio()
  const [options, setOptions] = useState<ComposerOptions | null>(null)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(3)
  const [intervalDays, setIntervalDays] = useState(7)
  const [scheduledFor, setScheduledFor] = useState(firstDate)
  const [networks, setNetworks] = useState<SocialNetwork[]>([])
  const [connectionIds, setConnectionIds] = useState<string[]>([])
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (isDemo) { const result = structuredClone(socialComposerMockOptions); setOptions(result); setNetworks(result.connections.map((item) => item.network)); setConnectionIds(result.connections.map((item) => item.id)); return }
    void socialComposerApi.options().then((result) => {
      setOptions(result)
      const available = result.connections.filter((item) => item.health === 'HEALTHY')
      const defaults = available.filter((item, index) => available.findIndex((candidate) => candidate.network === item.network) === index)
      setNetworks(defaults.map((item) => item.network))
      setConnectionIds(defaults.map((item) => item.id))
    }).catch((cause) => setError(customerSafeMessage(cause instanceof Error ? cause.message : undefined, 'Could not load connected accounts.')))
  }, [isDemo])
  const generate = async () => {
    if (!prompt.trim() || !networks.length || !scheduledFor) return
    setBusy(true); setError(''); setPosts([])
    try {
      const result = isDemo ? { posts: Array.from({ length: count }, (_, index) => ({ ...makeDemoPost(`${title.trim() || 'Content series'} — Part ${index + 1}`, `${prompt.trim()} (Part ${index + 1} of ${count})`, networks), id: `demo-series-${index + 1}`, variants: makeDemoPost(title, prompt, networks).variants.map((variant) => ({ ...variant, scheduled_for: new Date(new Date(scheduledFor).getTime() + index * intervalDays * 86400000).toISOString() })) })) } : await socialComposerApi.generateSeries({
        title: title.trim() || 'Content series', prompt: prompt.trim(), count, interval_days: intervalDays,
        scheduled_for: new Date(scheduledFor).toISOString(), networks, connection_ids: connectionIds,
        controls: { tone: 'Professional', goal: 'Awareness', length: 'Medium', include_image: networks.includes('INSTAGRAM') },
      })
      setPosts(result.posts)
    } catch (cause) { setError(customerSafeMessage(cause instanceof Error ? cause.message : undefined, 'Could not create the series.')) }
    finally { setBusy(false) }
  }
  return <section className="studio-screen series-screen" aria-label="Create a post series">
    <div className="card series-panel"><div className="series-heading"><Sparkles size={24} /><div><h2>Plan a content series</h2><p>Give one brief. Content Studio creates distinct drafts and proposes a publish time for each part. Review every version before approval.</p></div></div>
      {error && <div className="li-banner error" role="alert">{error}</div>}
      <div className="series-form"><label className="li-field"><span>Series title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A practical guide to…" /></label>
        <label className="li-field"><span>Series brief</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Explain the topic, audience, goal, and points each part should cover…" rows={6} /></label>
        <div className="series-grid"><label className="li-field"><span>Number of posts</span><input type="number" min={2} max={6} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label><label className="li-field"><span>Days between posts</span><input type="number" min={1} max={30} value={intervalDays} onChange={(event) => setIntervalDays(Number(event.target.value))} /></label><label className="li-field"><span>First publish time</span><input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></label></div>
        <fieldset className="series-networks"><legend>Publishing accounts</legend>{options?.connections.map((item) => <label key={item.id}><input type="checkbox" disabled={item.health !== 'HEALTHY' || busy} checked={connectionIds.includes(item.id)} onChange={(event) => { if (event.target.checked) { const replaced = options.connections.filter((candidate) => candidate.network === item.network).map((candidate) => candidate.id); setConnectionIds((current) => [...current.filter((id) => !replaced.includes(id)), item.id]); setNetworks((current) => current.includes(item.network) ? current : [...current, item.network]) } else { setConnectionIds((current) => current.filter((id) => id !== item.id)); setNetworks((current) => current.filter((value) => value !== item.network)) } }} />{item.label} · {item.display_name}</label>)}{options && !options.connections.length && <p>Connect a social account to create a series.</p>}</fieldset>
        <button className="button button-dark" type="button" disabled={busy || !prompt.trim() || !networks.length || !scheduledFor || count < 2 || count > 6 || intervalDays < 1 || intervalDays > 30} aria-busy={busy} onClick={() => void generate()}>{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{busy ? ' Creating series…' : isDemo ? ` Preview ${count} parts` : ` Create ${count} drafts`}</button>{busy && <p role="status">Generating each part. Keep this page open until the drafts appear.</p>}
      </div>
    </div>
    {posts.length > 0 && <section className="card series-results"><h2>{isDemo ? `${posts.length} series previews` : `${posts.length} drafts are ready`}</h2><p>{isDemo ? 'Demo previews are not saved. Sign in to create reviewable drafts.' : 'Each part is saved with its own proposed time. Open a draft to edit its copy, image, and schedule before approval.'}</p><div>{posts.map((post) => isDemo ? <div className="series-preview" key={post.id}><CalendarDays size={17} /><span><strong>{post.idea_title}</strong><small>{new Date(post.variants[0]?.scheduled_for || post.created_at).toLocaleString()}</small></span></div> : <Link key={post.id} to={`/content/create?draft=${post.id}`}><CalendarDays size={17} /><span><strong>{post.idea_title}</strong><small>{new Date(post.variants[0]?.scheduled_for || post.created_at).toLocaleString()}</small></span>Open draft</Link>)}</div></section>}
  </section>
}
