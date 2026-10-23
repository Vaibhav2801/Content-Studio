import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  FileText,
  MoreHorizontal,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

const campaignContent = [
  { day: 'MON', date: '26', title: 'The hidden cost of manual reporting', type: 'LinkedIn · Text post', state: 'Approved' },
  { day: 'WED', date: '28', title: 'Before vs. after: 6 hours back every week', type: 'LinkedIn · Carousel', state: 'Review' },
  { day: 'THU', date: '29', title: 'How Northstar Agency changed its workflow', type: 'LinkedIn · Customer proof', state: 'Drafting' },
  { day: 'FRI', date: '30', title: 'See your reporting time in one number', type: 'LinkedIn · CTA post', state: 'Planned' },
]

export function CampaignsView() {
  const [params] = useSearchParams()
  const justCreated = params.get('created') === '1'

  return (
    <section className="campaigns-screen studio-screen">
      {justCreated && <div className="campaign-created-banner" role="status"><CircleCheck size={18} /><span><strong>Campaign created.</strong> Quilltap is preparing the four content drafts now.</span><Link to="/content/approvals">Open approvals <ArrowRight size={15} /></Link></div>}

      <section className="campaign-overview card">
        <div className="campaign-overview-copy">
          <div className="campaign-label-row"><span className="campaign-live-pill"><span /> BUILDING</span><span>Campaign 01</span></div>
          <h2>Pricing objection → proof</h2>
          <p>Show agency owners the operational cost of manual reporting and move high-intent readers toward a demo.</p>
          <div className="campaign-overview-meta">
            <span><CalendarDays size={15} /> Oct 26–30</span>
            <span><FileText size={15} /> 4 pieces</span>
            <span><Sparkles size={15} /> Qualified leads</span>
          </div>
        </div>
        <div className="campaign-progress-card">
          <div><span>Campaign readiness</span><strong>62%</strong></div>
          <div className="campaign-progress-track"><i /></div>
          <small>1 approved · 1 awaiting review · 1 drafting</small>
          <Link className="button button-dark" to="/content/approvals">Review next item <ArrowRight size={16} /></Link>
        </div>
      </section>

      <nav className="campaign-stage-nav" aria-label="Campaign stages">
        <span className="done"><i><Check size={13} /></i><b>Strategy</b><small>Approved</small></span>
        <span className="active"><i>2</i><b>Create</b><small>In progress</small></span>
        <span><i>3</i><b>Approve</b><small>1 waiting</small></span>
        <span><i>4</i><b>Publish</b><small>Starts Oct 26</small></span>
        <span><i>5</i><b>Learn</b><small>Review Nov 2</small></span>
      </nav>

      <div className="campaigns-content-grid">
        <section className="campaign-timeline card" aria-labelledby="campaign-timeline-title">
          <header><div><span>CONTENT PLAN</span><h2 id="campaign-timeline-title">This campaign&apos;s schedule</h2></div><Link className="li-quiet-button" to="/content/calendar"><CalendarDays size={15} /> Full calendar</Link></header>
          <div className="campaign-content-list">
            {campaignContent.map((item) => (
              <article key={item.title}>
                <div className="campaign-date"><span>{item.day}</span><strong>{item.date}</strong></div>
                <span className="campaign-item-icon"><FileText size={18} /></span>
                <div className="campaign-item-copy"><strong>{item.title}</strong><small>{item.type}</small></div>
                <span className={`campaign-content-state ${item.state.toLowerCase()}`}>{item.state === 'Drafting' && <Clock3 size={13} />}{item.state === 'Approved' && <Check size={13} />}{item.state}</span>
                <button type="button" aria-label={`More actions for ${item.title}`}><MoreHorizontal size={18} /></button>
              </article>
            ))}
          </div>
          <button className="campaign-add-item" type="button"><Plus size={16} /> Add content to this campaign</button>
        </section>

        <aside className="campaign-side-rail">
          <section className="card campaign-next-action">
            <span>NEXT ACTION</span><h3>Review the carousel</h3><p>Quilltap prepared the before-and-after story. Confirm the claims and approve the visual direction.</p>
            <Link className="button button-dark" to="/content/approvals">Review now <ArrowRight size={15} /></Link>
          </section>
          <section className="card campaign-learning-card">
            <span>WHAT WE WILL LEARN</span><h3>Does practical proof create more intent?</h3><p>Quilltap will compare demo visits and qualified clicks with your previous educational posts.</p>
            <div><Play size={15} /><span><small>Results review</small><strong>November 2</strong></span></div>
          </section>
        </aside>
      </div>
    </section>
  )
}
