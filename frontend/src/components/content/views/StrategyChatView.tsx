import { ArrowRight, ChevronDown, Send, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

type Message = { id: number; role: 'quilltap' | 'user'; copy: string }

const goals = ['Get more leads', 'Grow awareness', 'Promote an offer']

export function StrategyChatView() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [hasRecommendation, setHasRecommendation] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'quilltap', copy: 'What should marketing achieve for your business this week?' },
  ])

  const reply = (copy: string) => {
    const value = copy.trim()
    if (!value) return
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: 'user', copy: value },
      {
        id: Date.now() + 1,
        role: 'quilltap',
        copy: hasRecommendation
          ? 'I’ve updated the recommendation. It remains focused on one audience, one problem, and one outcome.'
          : 'Based on your website and recent results, I recommend one focused campaign.',
      },
    ])
    setHasRecommendation(true)
    setInput('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    reply(input)
  }

  return (
    <section className="simple-strategy" aria-label="Strategy conversation">
      <div className="simple-chat-head">
        <span><Sparkles size={18} /></span>
        <div><strong>Strategy with Quilltap</strong><small>Uses your website, brand, and results</small></div>
      </div>

      <div className="simple-chat-thread" aria-live="polite">
        {messages.map((message) => (
          <article className={`simple-message ${message.role}`} key={message.id}>
            {message.role === 'quilltap' && <span><Sparkles size={15} /></span>}
            <p>{message.copy}</p>
          </article>
        ))}

        {!hasRecommendation && (
          <div className="simple-goal-choices" aria-label="Choose a marketing goal">
            {goals.map((goal) => <button type="button" key={goal} onClick={() => reply(goal)}>{goal}</button>)}
          </div>
        )}

        {hasRecommendation && (
          <article className="simple-campaign-answer">
            <span className="simple-answer-label">RECOMMENDED CAMPAIGN</span>
            <h2>Show the real cost of manual reporting</h2>
            <p>Use practical proof to turn a common customer objection into qualified interest.</p>
            <div className="simple-answer-meta"><span>7 days</span><span>LinkedIn</span><span>4 posts</span></div>
            <button className="simple-details-toggle" type="button" aria-expanded={showDetails} onClick={() => setShowDetails((value) => !value)}>Why this campaign? <ChevronDown size={15} /></button>
            {showDetails && <div className="simple-answer-details"><p>Your audience repeatedly engages with practical proof.</p><p>The campaign supports your current lead goal.</p><p>Success will be measured using qualified demo visits.</p></div>}
            <div className="simple-answer-actions">
              <button className="button button-dark" type="button" onClick={() => navigate('/content/campaigns?created=1')}>Create this campaign <ArrowRight size={16} /></button>
              <button type="button" onClick={() => reply('Give me another idea')}>Try another idea</button>
            </div>
          </article>
        )}
      </div>

      <form className="simple-chat-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="simple-strategy-message">Message Quilltap</label>
        <textarea id="simple-strategy-message" rows={1} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tell Quilltap what you want to achieve…" />
        <button type="submit" disabled={!input.trim()} aria-label="Send message"><Send size={18} /></button>
      </form>
    </section>
  )
}
