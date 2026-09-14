import { Check, LoaderCircle, Save, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { contentKnowledgeApi } from '../../../api/contentKnowledge'
import type { BrandBrain } from '../../../types/contentKnowledge'
import { useContentStudio } from '../ContentStudioContext'
import { customerSafeMessage } from '../contentUtils'

const splitLines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean)
const demoBrand: BrandBrain = { id: 'demo', version: 1, version_id: 'demo-v1', business_description: 'A practical software company.', audience: 'Growing teams', goals: ['Teach useful ideas'], voice: 'Clear, credible and human', voice_rules: ['Prefer concrete examples'], example_posts: [], content_pillars: ['Customer learning'], calls_to_action: ['Share your experience'], visual_direction: 'Simple editorial imagery', forbidden_topics: [], performance_rules: [], suggestions: [], updated_at: new Date().toISOString() }

export function BrandBrainPanel() {
  const { isDemo } = useContentStudio()
  const [brand, setBrand] = useState<BrandBrain | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { (isDemo ? Promise.resolve(structuredClone(demoBrand)) : contentKnowledgeApi.brand()).then(setBrand).catch((error) => setMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not load Brand.'))) }, [isDemo])
  const change = <K extends keyof BrandBrain>(key: K, value: BrandBrain[K]) => setBrand((current) => current ? { ...current, [key]: value } : current)
  const save = async () => {
    if (!brand) return
    setBusy('save'); setMessage('')
    try { setBrand(isDemo ? { ...brand, version: brand.version + 1 } : await contentKnowledgeApi.saveBrand(brand)); setMessage('Brand saved as a new version.') }
    catch (error) { setMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not save Brand.')) }
    finally { setBusy('') }
  }
  const decide = async (id: string, action: 'CONFIRM' | 'DISMISS') => {
    if (!brand) return
    setBusy(id + '-' + action)
    try { setBrand(isDemo ? { ...brand, suggestions: brand.suggestions.filter((item) => item.id !== id) } : await contentKnowledgeApi.decideSuggestion(id, action)) }
    catch (error) { setMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not update that suggestion.')) }
    finally { setBusy('') }
  }
  if (!brand) return <div className="li-loading" role="status">Loading Brand…</div>
  return <section className="card knowledge-panel" aria-labelledby="brand-brain-title"><header><div><span>BRAND · VERSION {brand.version}</span><h3 id="brand-brain-title">What the writer should know</h3><p>Every save creates a version so generated posts keep their original context.</p></div><button className="button button-dark" disabled={Boolean(busy)} aria-busy={busy === "save"} onClick={() => void save()}>{busy === 'save' ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save Brand</button></header>
    {message && <div className="li-banner neutral" role="status">{message}</div>}
    {brand.suggestions.map((suggestion) => <div className="voice-suggestion" key={suggestion.id}><Sparkles size={18} /><span><strong>Suggested voice rule</strong><small>Not applied · noticed in {suggestion.evidence_count} edits</small><p>{suggestion.rule}</p></span><button className="li-quiet-button" disabled={Boolean(busy)} aria-busy={busy === suggestion.id + "-CONFIRM"} onClick={() => void decide(suggestion.id, 'CONFIRM')}><Check size={15} /> Add rule</button><button className="li-text-button" disabled={Boolean(busy)} aria-busy={busy === suggestion.id + "-DISMISS"} onClick={() => void decide(suggestion.id, 'DISMISS')}><X size={15} /> Dismiss</button></div>)}
    {brand.performance_rules.length > 0 && <div className="brand-performance-rules"><strong>Accepted performance rules</strong><small>Added only after someone accepted an analytics suggestion.</small><ul>{brand.performance_rules.map((rule) => <li key={rule}>{rule}</li>)}</ul></div>}
    <div className="knowledge-form-grid"><label>Business description<textarea value={brand.business_description} onChange={(event) => change('business_description', event.target.value)} /></label><label>Audience<textarea value={brand.audience} onChange={(event) => change('audience', event.target.value)} /></label><label>Goals <small>one per line</small><textarea value={brand.goals.join('\n')} onChange={(event) => change('goals', splitLines(event.target.value))} /></label><label>Overall voice<input value={brand.voice} onChange={(event) => change('voice', event.target.value)} /></label><label>Voice rules <small>one per line</small><textarea value={brand.voice_rules.join('\n')} onChange={(event) => change('voice_rules', splitLines(event.target.value))} /></label><label>Example posts <small>one per line</small><textarea value={brand.example_posts.join('\n')} onChange={(event) => change('example_posts', splitLines(event.target.value))} /></label><label>Content pillars <small>one per line</small><textarea value={brand.content_pillars.join('\n')} onChange={(event) => change('content_pillars', splitLines(event.target.value))} /></label><label>Calls to action <small>one per line</small><textarea value={brand.calls_to_action.join('\n')} onChange={(event) => change('calls_to_action', splitLines(event.target.value))} /></label><label>Visual direction<textarea value={brand.visual_direction} onChange={(event) => change('visual_direction', event.target.value)} /></label><label>Prohibited topics <small>one per line</small><textarea value={brand.forbidden_topics.join('\n')} onChange={(event) => change('forbidden_topics', splitLines(event.target.value))} /></label></div>
  </section>
}
