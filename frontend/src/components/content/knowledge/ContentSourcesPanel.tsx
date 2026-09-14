import { FileText, Link as LinkIcon, LoaderCircle, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { contentKnowledgeApi } from '../../../api/contentKnowledge'
import type { ContentSource, ContentSourceInput } from '../../../types/contentKnowledge'
import { useContentStudio } from '../ContentStudioContext'
import { customerSafeMessage } from '../contentUtils'
import { TaskButton } from '../TaskButton'

const blank: ContentSourceInput = { source_type: 'TEXT', label: '', text_content: '' }

export function ContentSourcesPanel() {
  const { isDemo } = useContentStudio()
  const [sources, setSources] = useState<ContentSource[]>([])
  const [draft, setDraft] = useState<ContentSourceInput>(blank)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { (isDemo ? Promise.resolve([]) : contentKnowledgeApi.sources()).then(setSources).catch((error) => setMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not load sources.'))) }, [isDemo])
  const create = async () => {
    setMessage('')
    try {
      const result = isDemo ? { ...draft, id: `demo-${Date.now()}`, text_content: draft.text_content || '', source_url: draft.source_url || '', original_filename: draft.original_filename || '', processing_status: draft.source_type === 'URL' || draft.source_type === 'PDF' ? 'PENDING' as const : 'READY' as const, metadata: {}, owner_name: 'You', updated_at: new Date().toISOString() } as ContentSource : await contentKnowledgeApi.createSource(draft)
      setSources((current) => [result, ...current]); setDraft(blank); setAdding(false)
    } catch (error) { setMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not add this source.')) }
  }
  return <section className="card knowledge-panel" aria-labelledby="sources-panel-title"><header><div><span>SOURCES</span><h3 id="sources-panel-title">Material the writer can rely on</h3><p>Only ready sources are used or shown as support for generated statements.</p></div><button className="button button-dark" onClick={() => setAdding(!adding)}><Plus size={16} /> Add source</button></header>
    {message && <div className="li-banner error" role="alert">{message}</div>}
    {adding && <div className="source-create"><label>Source type<select value={draft.source_type} onChange={(event) => setDraft({ ...draft, source_type: event.target.value as ContentSource['source_type'] })}><option value="TEXT">Text</option><option value="URL">URL</option><option value="PDF">PDF details</option><option value="TRANSCRIPT">Transcript</option><option value="VOICE_NOTE">Voice-note transcript</option></select></label><label>Name<input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label>{draft.source_type === 'URL' ? <label className="full">Public URL<input type="url" value={draft.source_url || ''} onChange={(event) => setDraft({ ...draft, source_url: event.target.value })} /></label> : draft.source_type === 'PDF' ? <label className="full">PDF filename<input value={draft.original_filename || ''} onChange={(event) => setDraft({ ...draft, original_filename: event.target.value })} placeholder="research.pdf" /></label> : <label className="full">{draft.source_type.includes('TRANSCRIPT') || draft.source_type === 'VOICE_NOTE' ? 'Transcript' : 'Text'}<textarea value={draft.text_content || ''} onChange={(event) => setDraft({ ...draft, text_content: event.target.value })} /></label>}<span className="full"><button className="li-text-button" onClick={() => setAdding(false)}>Cancel</button><TaskButton className="li-quiet-button" onClick={create} loadingLabel="Saving source…"><Plus size={15} /> Save source</TaskButton></span></div>}
    {!sources.length ? <div className="content-inline-empty">No sources yet. Add notes, links, transcripts or PDF details.</div> : <div className="source-list">{sources.map((source) => <article key={source.id}><span>{source.source_type === 'URL' ? <LinkIcon size={17} /> : <FileText size={17} />}</span><div><strong>{source.label}</strong><small>{source.source_type.replaceAll('_', ' ').toLowerCase()} · {source.owner_name}</small></div><span className={`source-processing ${source.processing_status.toLowerCase()}`}>{source.processing_status === 'READY' ? 'Ready' : source.processing_status === 'FAILED' ? 'Needs attention' : <><LoaderCircle size={13} className={source.processing_status === 'PROCESSING' ? 'spin' : ''} /> Processing</>}</span>{source.processing_status === 'READY' && <Link className="li-quiet-button" to={`/content/create?source=${source.id}`}>Use in post</Link>}</article>)}</div>}
  </section>
}
