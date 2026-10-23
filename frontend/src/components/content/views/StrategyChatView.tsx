import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  Lightbulb,
  MessageSquareText,
  Send,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

type ChatMessage = { id: number; role: 'quilltap' | 'user'; copy: string }

const starters = [
  'Why is this the best campaign?',
  'Make it a 7-day LinkedIn campaign',
  'Show me two other directions',
]

export function StrategyChatView() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'quilltap',
      copy: 'I reviewed your website, audience, recent posts, and goal to generate qualified leads. Your strongest opportunity this week is to turn the pricing objection into a proof campaign.',
    },
  ])

  const sendMessage = (copy: string) => {
    const value = copy.trim()
    if (!value) return
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: 'user', copy: value },
      {
        id: Date.now() + 1,
        role: 'quilltap',
        copy: value.toLowerCase().includes('other')
          ? 'Two strong alternatives are a customer workflow teardown and a founder-led myth-busting series. The proof campaign still ranks first because it connects a repeated sales objection with your best-performing content theme.'
          : 'Done. I kept the campaign focused on qualified leads, practical proof, and one clear demo call to action. The updated plan is ready on the right.',
      },
    ])
    setInput('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    sendMessage(input)
  }

  return (
    <section className="strategy-workspace" aria-label="Marketing strategy copilot">
      <div className="strategy-chat card">
        <header className="strategy-chat-header">
          <span className="strategy-agent-mark"><Sparkles size={18} /></span>
          <div><strong>Quilltap Strategy</strong><small><span /> Business context is up to date</small></div>
          <button className="strategy-context-button" type="button">What I used <ChevronRight size={15} /></button>
        </header>

        <div className="strategy-chat-thread" aria-live="polite">
          <div className="strategy-date-divider"><span>This week&apos;s decision</span></div>
          {messages.map((message) => (
            <article className={`strategy-message ${message.role}`} key={message.id}>
              <span className="strategy-message-avatar">{message.role === 'quilltap' ? <Sparkles size={16} /> : 'You'}</span>
              <div>
                <strong>{message.role === 'quilltap' ? 'Quilltap' : 'You'}</strong>
                <p>{message.copy}</p>
              </div>
            </article>
          ))}

          {messages.length === 1 && (
            <section className="strategy-recommendation" aria-labelledby="recommendation-title">
              <div className="strategy-recommendation-top">
                <span><Lightbulb size={16} /> RECOMMENDED</span>
                <small>88% confidence</small>
              </div>
              <h2 id="recommendation-title">Prove the hidden cost of manual reporting</h2>
              <p>Use concrete before-and-after examples to show agency owners how manual reporting quietly consumes billable time.</p>
              <div className="strategy-reasons">
                <span><Users size={16} /><b>Audience</b> Agency owners</span>
                <span><Target size={16} /><b>Goal</b> Qualified leads</span>
                <span><CalendarDays size={16} /><b>Run</b> 7 days</span>
                <span><BarChart3 size={16} /><b>Measure</b> Demo visits</span>
              </div>
              <button className="strategy-why" type="button" onClick={() => sendMessage('Why is this the best campaign?')}>See why Quilltap chose this <ArrowRight size={15} /></button>
            </section>
          )}
        </div>

        <div className="strategy-starters" aria-label="Suggested questions">
          {starters.map((starter) => <button type="button" key={starter} onClick={() => sendMessage(starter)}>{starter}</button>)}
        </div>
        <form className="strategy-composer" onSubmit={submit}>
          <MessageSquareText size={19} />
          <label className="sr-only" htmlFor="strategy-message">Ask Quilltap about your strategy</label>
          <textarea id="strategy-message" rows={1} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask a question or change the plan…" />
          <button type="submit" disabled={!input.trim()} aria-label="Send message"><Send size={17} /></button>
        </form>
        <small className="strategy-composer-note">Quilltap can use your brand, connected accounts, and results to answer.</small>
      </div>

      <aside className="strategy-plan card" aria-label="Proposed campaign plan">
        <header>
          <div><span>PROPOSED CAMPAIGN</span><h2>Pricing objection → proof</h2></div>
          <span className="strategy-plan-state"><CircleCheck size={14} /> Ready</span>
        </header>
        <div className="strategy-plan-summary">
          <div><small>Objective</small><strong>Generate qualified demo visits</strong></div>
          <div><small>Audience</small><strong>Agency owners with 5–30 staff</strong></div>
          <div><small>Primary channel</small><strong>LinkedIn</strong></div>
          <div><small>Duration</small><strong>7 days · 4 posts</strong></div>
        </div>
        <section className="strategy-angle">
          <span>CAMPAIGN IDEA</span>
          <p>Manual reports do not only waste time. They delay decisions, hide risk, and reduce the time an agency can spend on clients.</p>
        </section>
        <section className="strategy-plan-list">
          <h3>What Quilltap will create</h3>
          <ul>
            <li><Check size={15} /> Educational problem post</li>
            <li><Check size={15} /> Before-and-after carousel</li>
            <li><Check size={15} /> Customer proof post</li>
            <li><Check size={15} /> Direct demo invitation</li>
          </ul>
        </section>
        <section className="strategy-success">
          <BarChart3 size={18} />
          <div><small>SUCCESS SIGNAL</small><strong>Demo page visits from LinkedIn</strong><span>Compared with your previous 30-day baseline</span></div>
        </section>
        <div className="strategy-plan-actions">
          <button className="button button-dark" type="button" onClick={() => navigate('/content/campaigns?created=1')}>Approve &amp; build campaign <ArrowRight size={16} /></button>
          <button className="li-quiet-button" type="button" onClick={() => sendMessage('Show me two other directions')}>Explore alternatives</button>
        </div>
        <small className="strategy-approval-note">Approval creates drafts. Nothing publishes until you approve the content.</small>
      </aside>
    </section>
  )
}
