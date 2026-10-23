import { ArrowRight, BarChart3, Check, MousePointerClick, RotateCcw, Sparkles, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ResultsView() {
  return (
    <section className="results-screen studio-screen">
      <section className="results-decision card">
        <div className="results-decision-icon"><Sparkles size={22} /></div>
        <div className="results-decision-copy">
          <span>QUILLTAP&apos;S NEXT DECISION</span>
          <h2>Double down on practical proof.</h2>
          <p>Proof-led posts generated more qualified attention than general advice. Continue the theme for one more week, using a customer story and a stronger demo call to action.</p>
          <div className="results-confidence"><span><Check size={13} /> High confidence</span><small>Based on 4 posts and your 30-day baseline</small></div>
        </div>
        <div className="results-actions"><Link className="button button-dark" to="/content/strategy">Plan the next campaign <ArrowRight size={16} /></Link><button className="li-quiet-button" type="button">Ask why</button></div>
      </section>

      <section className="results-scorecard" aria-label="Campaign scorecard">
        <article className="card"><span><Users size={18} /> Qualified visits</span><strong>38</strong><small className="positive"><TrendingUp size={13} /> 2.3× baseline</small></article>
        <article className="card"><span><MousePointerClick size={18} /> Click-through rate</span><strong>4.8%</strong><small className="positive"><TrendingUp size={13} /> +1.7 points</small></article>
        <article className="card"><span><BarChart3 size={18} /> Engagement rate</span><strong>6.2%</strong><small className="positive"><TrendingUp size={13} /> +24%</small></article>
        <article className="card"><span><RotateCcw size={18} /> Demo requests</span><strong>5</strong><small>Goal was 4</small></article>
      </section>

      <div className="results-grid">
        <section className="card results-story">
          <header><div><span>CAMPAIGN REVIEW</span><h2>What Quilltap learned</h2></div><small>Oct 19–25</small></header>
          <div className="results-insight-list">
            <article className="winner"><i>1</i><div><strong>Specific numbers made the problem credible</strong><p>The carousel featuring “6 hours back every week” drove 47% of all campaign clicks.</p></div></article>
            <article><i>2</i><div><strong>Customer proof created buying intent</strong><p>Readers who engaged with the customer story were three times more likely to visit the demo page.</p></div></article>
            <article><i>3</i><div><strong>Generic inspiration remains weak</strong><p>The broad founder quote received reactions but produced no meaningful website visits.</p></div></article>
          </div>
        </section>
        <aside className="card results-stop-continue">
          <span>THE SIMPLE VERSION</span>
          <div className="continue"><small>CONTINUE</small><strong>Customer proof, concrete time savings, practical examples</strong></div>
          <div className="stop"><small>STOP</small><strong>Generic inspiration without a business problem</strong></div>
          <div className="test"><small>TEST NEXT</small><strong>A stronger demo CTA attached to a customer story</strong></div>
        </aside>
      </div>
    </section>
  )
}
