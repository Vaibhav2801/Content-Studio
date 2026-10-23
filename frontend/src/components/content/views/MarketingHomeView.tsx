import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export function MarketingHomeView() {
  return (
    <section className="simple-home">
      <header className="simple-home-intro">
        <span>FRIDAY, OCTOBER 23</span>
        <h2>Good morning.</h2>
        <p>Here is the one thing that needs your attention.</p>
      </header>

      <section className="simple-next-action">
        <span className="simple-next-icon"><Sparkles size={20} /></span>
        <div>
          <span>NEXT ACTION</span>
          <h3>Choose what to market next week</h3>
          <p>Quilltap found one strong opportunity based on your business and recent results.</p>
        </div>
        <Link className="button button-dark" to="/content/strategy">Open strategy <ArrowRight size={16} /></Link>
      </section>

      <section className="simple-current-campaign">
        <header><div><span>ACTIVE CAMPAIGN</span><h3>Pricing objection → proof</h3></div><Link to="/content/campaigns">Open <ArrowRight size={14} /></Link></header>
        <div className="simple-campaign-line"><span><i /></span><strong>2 of 4 posts ready</strong><small>One post needs your approval</small></div>
        <Link className="simple-review-link" to="/content/approvals"><CheckCircle2 size={16} /> Review the next post <ArrowRight size={15} /></Link>
      </section>
    </section>
  )
}
