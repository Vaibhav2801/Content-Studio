import { Check, LoaderCircle, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { contentKnowledgeApi } from '../../../api/contentKnowledge'
import type { StoryInterview } from '../../../types/contentKnowledge'
import { useContentStudio } from '../ContentStudioContext'
import { customerSafeMessage } from '../contentUtils'

const demo: StoryInterview = { id: 'demo', week_of: new Date().toISOString().slice(0, 10), questions: [{ id: 'moment', label: 'What happened this week that others could learn from?' }, { id: 'why', label: 'Why did it matter?' }, { id: 'lesson', label: 'What practical lesson would you share?' }], answers: {}, status: 'IN_PROGRESS', approved_source_id: '', approved_at: null }

export function StoryInterviewPanel() {
  const { isDemo } = useContentStudio()
  const [story, setStory] = useState<StoryInterview | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { (isDemo ? Promise.resolve(structuredClone(demo)) : contentKnowledgeApi.story()).then(setStory).catch((error) => setMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not load this week’s interview.'))) }, [isDemo])
  const save = async () => { if (!story) return; setBusy('save'); try { setStory(isDemo ? story : await contentKnowledgeApi.saveStory(story.answers)); setMessage('Answers saved.') } catch (error) { setMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not save these answers.')) } finally { setBusy('') } }
  const approve = async () => { if (!story) return; setBusy('approve'); try { if (!isDemo) await contentKnowledgeApi.saveStory(story.answers); setStory(isDemo ? { ...story, status: 'APPROVED', approved_source_id: 'demo-source', approved_at: new Date().toISOString() } : await contentKnowledgeApi.approveStory()); setMessage('Story approved and added to Sources.') } catch (error) { setMessage(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Answer at least two questions before approving this story.')) } finally { setBusy('') } }
  if (!story) return <div className="li-loading" role="status">Loading this week’s interview…</div>
  return <section className="card knowledge-panel story-panel" aria-labelledby="story-title"><header><div><span>WEEK OF {new Date(`${story.week_of}T12:00:00`).toLocaleDateString()}</span><h3 id="story-title">Story Interview</h3><p>A few questions turn a real moment into reusable source material.</p></div>{story.status === 'APPROVED' && <span className="connection-health ready"><Check size={15} /> Added to Sources</span>}</header>{message && <div className="li-banner neutral" role="status">{message}</div>}<div className="story-questions">{story.questions.map((question, index) => <label key={question.id}><span>{index + 1}</span><strong>{question.label}</strong><textarea disabled={story.status === 'APPROVED'} value={story.answers[question.id] || ''} onChange={(event) => setStory({ ...story, answers: { ...story.answers, [question.id]: event.target.value } })} /></label>)}</div>{story.status !== 'APPROVED' && <footer><button className="li-quiet-button" disabled={Boolean(busy)} aria-busy={busy === "save"} onClick={() => void save()}>{busy === 'save' ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} Save answers</button><button className="button button-dark" disabled={Boolean(busy)} aria-busy={busy === "approve"} onClick={() => void approve()}>{busy === 'approve' ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Approve and add to Sources</button></footer>}</section>
}
