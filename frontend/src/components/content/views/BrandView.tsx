import { ArrowRight, Check, Edit3, Globe2, Instagram, Linkedin, RefreshCw, Search, Target, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export function BrandView() {
  return (
    <section className="brand-screen studio-screen">
      <section className="brand-health card">
        <div className="brand-health-score"><strong>86</strong><span>Brand readiness</span></div>
        <div><span>BUSINESS BRAIN</span><h2>Quilltap has enough context to recommend campaigns.</h2><p>Review this profile whenever your offer, audience, positioning, or goals change.</p></div>
        <button className="li-quiet-button" type="button"><RefreshCw size={15} /> Rescan website</button>
      </section>

      <div className="brand-grid">
        <section className="card brand-profile-card">
          <header><div><span>CORE PROFILE</span><h2>Northstar Reports</h2></div><button type="button"><Edit3 size={15} /> Edit</button></header>
          <dl>
            <div><dt><Globe2 size={16} /> What you sell</dt><dd>Automated client reporting for growing marketing agencies.</dd></div>
            <div><dt><Users size={16} /> Best-fit customer</dt><dd>Agency owners and operations leads managing 5–30 employees.</dd></div>
            <div><dt><Target size={16} /> Primary problem</dt><dd>Manual reporting consumes billable time and delays client decisions.</dd></div>
          </dl>
          <div className="brand-proof"><span>PROOF QUILLTAP CAN USE</span><p>“Save 6+ hours per client every month” · 3 customer stories · 8 approved claims</p></div>
        </section>

        <section className="card brand-voice-card">
          <header><div><span>VOICE</span><h2>How the brand should sound</h2></div><button type="button"><Edit3 size={15} /> Edit</button></header>
          <div className="brand-tone-tags"><span>Practical</span><span>Confident</span><span>Clear</span><span>Evidence-led</span></div>
          <blockquote>“Show the operational reality, explain the cost clearly, and offer a useful next step without hype.”</blockquote>
          <div className="brand-guardrails"><div><Check size={15} /><span><strong>Prefer</strong> Concrete examples and plain language</span></div><div><span>×</span><span><strong>Avoid</strong> Hype, vague inspiration, and unsupported claims</span></div></div>
        </section>

        <section className="card brand-goals-card">
          <header><div><span>ACTIVE DIRECTION</span><h2>Business goals</h2></div><button type="button"><Edit3 size={15} /> Change</button></header>
          <div className="brand-primary-goal"><Target size={19} /><span><small>PRIMARY GOAL</small><strong>Generate qualified demo requests</strong></span></div>
          <ul><li><span /> Build authority with agency owners</li><li><span /> Increase website traffic from LinkedIn</li><li><span /> Support the reporting automation offer</li></ul>
        </section>

        <section className="card brand-signals-card">
          <header><div><span>CONNECTED SIGNALS</span><h2>Where Quilltap learns</h2></div><Link to="/content/connections">Manage <ArrowRight size={14} /></Link></header>
          <div className="brand-signal-list">
            <span><i className="linkedin"><Linkedin size={16} /></i><b>LinkedIn</b><small>Connected · Updated today</small><Check size={15} /></span>
            <span><i><Globe2 size={16} /></i><b>Website</b><small>12 pages indexed</small><Check size={15} /></span>
            <span><i><Search size={16} /></i><b>Search Console</b><small>Connected · 90 days of data</small><Check size={15} /></span>
            <span className="muted"><i><Instagram size={16} /></i><b>Instagram</b><small>Not connected</small><ArrowRight size={15} /></span>
          </div>
        </section>
      </div>
    </section>
  )
}
