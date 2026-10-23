import { ArrowRight, BarChart3, CalendarDays, CheckSquare, CircleCheck, Clock3, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router-dom'

export function MarketingHomeView() {
  return (
    <section className="marketing-home studio-screen">
      <section className="marketing-home-hero">
        <div className="marketing-home-copy">
          <span className="marketing-home-kicker"><Sparkles size={14} /> YOUR NEXT BEST MOVE</span>
          <h2>Turn a common pricing objection into proof.</h2>
          <p>Your strongest content combines a specific customer problem with practical evidence. Quilltap recommends a focused seven-day LinkedIn campaign.</p>
          <div className="marketing-home-actions">
            <Link className="button button-dark" to="/content/strategy">Discuss the strategy <ArrowRight size={16} /></Link>
            <Link to="/content/campaigns">View active campaign</Link>
          </div>
        </div>
        <aside className="marketing-home-reason">
          <header><span>WHY THIS</span><small>88% confidence</small></header>
          <ul>
            <li><CircleCheck size={15} /> Repeated sales objection</li>
            <li><CircleCheck size={15} /> Proof posts outperform baseline</li>
            <li><CircleCheck size={15} /> Supports your lead goal</li>
          </ul>
          <div><Target size={17} /><span><small>SUCCESS SIGNAL</small><strong>Qualified demo visits</strong></span></div>
        </aside>
      </section>

      <section className="marketing-status-row" aria-label="Current marketing status">
        <Link className="card" to="/content/campaigns"><span className="violet"><CalendarDays size={19} /></span><div><small>ACTIVE CAMPAIGN</small><strong>Pricing objection → proof</strong><p>4 pieces · Oct 26–30</p></div><ArrowRight size={16} /></Link>
        <Link className="card" to="/content/approvals"><span className="coral"><CheckSquare size={19} /></span><div><small>NEEDS YOU</small><strong>1 item to review</strong><p>Before-and-after carousel</p></div><ArrowRight size={16} /></Link>
        <Link className="card" to="/content/results"><span className="mint"><BarChart3 size={19} /></span><div><small>LATEST LEARNING</small><strong>Proof drives intent</strong><p>2.3× more qualified visits</p></div><ArrowRight size={16} /></Link>
      </section>

      <div className="marketing-home-grid">
        <section className="card marketing-week">
          <header><div><span>THIS WEEK</span><h2>Campaign progress</h2></div><Link to="/content/campaigns">Open campaign <ArrowRight size={14} /></Link></header>
          <div className="marketing-week-progress"><span><i /></span><small>62% ready</small></div>
          <div className="marketing-week-list">
            <article><span className="done"><CircleCheck size={16} /></span><div><strong>Strategy approved</strong><small>Campaign direction and success metric locked</small></div><em>Done</em></article>
            <article><span className="active"><Sparkles size={16} /></span><div><strong>Content being created</strong><small>2 of 4 pieces are ready</small></div><em>In progress</em></article>
            <article><span><CheckSquare size={16} /></span><div><strong>Review and approve</strong><small>One carousel is waiting for you</small></div><em>Next</em></article>
            <article><span><CalendarDays size={16} /></span><div><strong>Publish campaign</strong><small>First post scheduled for October 26</small></div><em>Upcoming</em></article>
            <article><span><BarChart3 size={16} /></span><div><strong>Learn and decide</strong><small>Quilltap reviews the result on November 2</small></div><em>Upcoming</em></article>
          </div>
        </section>

        <aside className="marketing-home-side">
          <section className="card marketing-next-task">
            <span>NEXT ACTION</span><h3>Review the carousel</h3><p>Confirm the “6 hours per week” claim and approve the visual direction.</p>
            <Link className="button button-dark" to="/content/approvals">Review now <ArrowRight size={15} /></Link>
          </section>
          <section className="card marketing-upcoming">
            <header><Clock3 size={17} /><div><small>NEXT CHECK-IN</small><strong>Monday, November 2</strong></div></header>
            <p>Quilltap will compare this campaign with your baseline and recommend whether to continue, improve, or stop.</p>
          </section>
        </aside>
      </div>
    </section>
  )
}
