import {
  ArrowRight, CalendarDays, Check, Instagram,
  Layers3, Linkedin, MessageSquare, Sparkles, WandSparkles, X, Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/content/AuthContext'
import './PricingPage.css'

export function PricingPage() {
  const { user } = useAuth()
  const primaryPath = user ? '/content' : '/signup'
  const primaryLabel = user ? 'Open workspace' : 'Get started free'

  // Dynamic Cost Manager State (Default on Starter $20)
  const [baseTier, setBaseTier] = useState<'free' | 'starter' | 'advance'>('starter')
  const [connections, setConnections] = useState<number>(1)
  const [credits, setCredits] = useState<number>(50)
  const [engageEnabled, setEngageEnabled] = useState<boolean>(false)

  const handleSelectTier = (tier: 'free' | 'starter' | 'advance') => {
    setBaseTier(tier)
    if (tier === 'free') {
      setConnections(0)
      setCredits(15)
      setEngageEnabled(false)
    } else if (tier === 'starter') {
      setConnections(1)
      setCredits(50)
      setEngageEnabled(false)
    } else if (tier === 'advance') {
      setConnections(1)
      setCredits(150)
      setEngageEnabled(true)
    }
  }

  // Cost calculation:
  // Free = $0 (0 conn, 15 credits)
  // Starter = $20 (1 conn, 50 credits)
  // Advance = $39 (1 conn, 150 credits, Engage included)
  // Extra connections: $5 / month each
  // Extra credits: $10 per 50 credits
  // Engage: $15 / month (free on Advance)
  const basePrice = baseTier === 'free' ? 0 : baseTier === 'starter' ? 20 : 39
  const baseIncludedConns = baseTier === 'free' ? 0 : 1
  const baseIncludedCredits = baseTier === 'free' ? 15 : baseTier === 'starter' ? 50 : 150

  const extraConnections = Math.max(0, connections - baseIncludedConns)
  const extraConnectionsCost = extraConnections * 5

  const extraCredits = Math.max(0, credits - baseIncludedCredits)
  const extraCreditsCost = Math.round((extraCredits / 50) * 10)

  let engageCost = 0
  if (engageEnabled && baseTier !== 'advance') {
    engageCost = 15
  }

  const dynamicMonthlyTotal = basePrice + extraConnectionsCost + extraCreditsCost + engageCost

  return (
    <div className="pricing-page">
      {/* Navigation Header */}
      <header className="pricing-header">
        <Link className="pricing-brand" to="/" aria-label="Content Studio home">
          <span><Sparkles size={18} /></span> content studio
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/#features">Features</Link>
          <Link to="/#how-it-works">How it works</Link>
          <Link to="/pricing" style={{ color: '#6352de', fontWeight: 750 }}>Pricing</Link>
        </nav>
        <div className="pricing-header-actions">
          {!user && <Link className="pricing-signin" to="/signin">Sign in</Link>}
          <Link className="pricing-top-cta" to={primaryPath}>
            {primaryLabel} <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pricing-hero">
          <div className="pricing-hero-badge">
            <Sparkles size={13} /> Transparent Monthly Pricing
          </div>
          <h1>
            Simple plans. <em>Infinite reach.</em>
          </h1>
          <p>
            Choose a plan that fits your current workflow, or buy credit top-ups anytime.
            Post scheduling is always 100% free and unlimited on every plan.
          </p>
        </section>

        {/* 3 Modern Light Plan Cards */}
        <section className="pricing-plans-section">
          <div className="pricing-plans-grid">
            
            {/* Card 1: Free */}
            <div className="light-plan-card">
              <div className="plan-card-name">Free</div>
              <div className="plan-card-desc">
                Test drive the AI content creation engine and plan drafts risk-free.
              </div>
              <div className="plan-card-price">
                <strong>$0</strong>
                <span>/ month</span>
              </div>
              <Link to={primaryPath} className="plan-card-btn">
                Try for Free <ArrowRight size={14} />
              </Link>
              <div className="plan-card-divider" />
              <div className="plan-card-specs-title">What's included:</div>
              <ul className="plan-card-specs">
                <li><Check size={16} /> <strong>0 Social Connections</strong> (Sandbox mode)</li>
                <li><Check size={16} /> <strong>15 AI Credits</strong></li>
                <li><Check size={16} /> <strong>Unlimited Post Scheduling</strong> &amp; Calendar</li>
                <li><Check size={16} /> Multi-platform copy adaptation</li>
                <li className="disabled-spec"><X size={16} /> Social account publishing</li>
                <li className="disabled-spec"><X size={16} /> Engage automation suite</li>
              </ul>
            </div>

            {/* Card 2: Starter ($20) */}
            <div className="light-plan-card">
              <div className="plan-card-name">Starter</div>
              <div className="plan-card-desc">
                For creators and founders building a consistent personal channel.
              </div>
              <div className="plan-card-price">
                <strong>$20</strong>
                <span>/ month</span>
              </div>
              <Link to={primaryPath} className="plan-card-btn">
                Start with Starter <ArrowRight size={14} />
              </Link>
              <div className="plan-card-divider" />
              <div className="plan-card-specs-title">What's included:</div>
              <ul className="plan-card-specs">
                <li><Check size={16} /> <strong>1 Social Connection</strong> (LinkedIn or Instagram)</li>
                <li><Check size={16} /> <strong>50 AI Credits / month</strong></li>
                <li><Check size={16} /> <strong>100% Unlimited Post Scheduling</strong></li>
                <li><Check size={16} /> Brand Voice Brain &amp; tone settings</li>
                <li><Check size={16} /> Standard post analytics</li>
                <li className="disabled-spec"><X size={16} /> Engage suite (Available as Add-on)</li>
              </ul>
            </div>

            {/* Card 3: Advance ($39) - Featured */}
            <div className="light-plan-card featured">
              <span className="plan-card-tag">Recommended</span>
              <div className="plan-card-name">Advance</div>
              <div className="plan-card-desc">
                High-volume content creation with full Engage lead conversion automation.
              </div>
              <div className="plan-card-price">
                <strong>$39</strong>
                <span>/ month</span>
              </div>
              <Link to={primaryPath} className="plan-card-btn featured-btn">
                Start 14-Day Free Trial <ArrowRight size={14} />
              </Link>
              <div className="plan-card-divider" />
              <div className="plan-card-specs-title">Everything in Starter, plus:</div>
              <ul className="plan-card-specs">
                <li><Check size={16} /> <strong>1 Social Connection</strong> (Expandable with add-ons)</li>
                <li><Check size={16} /> <strong>150 AI Credits / month</strong></li>
                <li><Check size={16} /> <strong>Engage Automation Suite Included</strong></li>
                <li><Check size={16} /> Automated Comment-to-DM lead magnets</li>
                <li><Check size={16} /> Instagram Story replies &amp; DM keywords</li>
                <li><Check size={16} /> <strong>100% Unlimited Post Scheduling</strong></li>
                <li><Check size={16} /> LinkedIn Copilot smart inbox triage</li>
              </ul>
            </div>

          </div>
        </section>

        {/* Credit Top-Up Booster Packs (Positioned prominently right under plans) */}
        <section className="boosters-prominent-section">
          <div className="boosters-prominent-card">
            <div className="boosters-header">
              <span className="boosters-kicker">On-Demand Credit Top-Ups</span>
              <h3>Need extra credits? Buy booster packs anytime.</h3>
              <p>
                If you exhaust your monthly plan credits, top up on-demand without upgrading your tier. Booster credits never expire while your account is active.
              </p>
            </div>

            <div className="boosters-grid-row">
              <div className="booster-item-box">
                <div className="booster-item-name">Starter Booster</div>
                <div className="booster-item-credits">50 Credits</div>
                <div className="booster-item-price">$10</div>
                <Link to={primaryPath} className="booster-item-btn">Buy Credits</Link>
              </div>

              <div className="booster-item-box">
                <div className="booster-item-name">Growth Booster</div>
                <div className="booster-item-credits">150 Credits</div>
                <div className="booster-item-price">$25</div>
                <Link to={primaryPath} className="booster-item-btn">Buy Credits</Link>
              </div>

              <div className="booster-item-box">
                <div className="booster-item-name">Power Booster</div>
                <div className="booster-item-credits">350 Credits</div>
                <div className="booster-item-price">$50</div>
                <Link to={primaryPath} className="booster-item-btn">Buy Credits</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Cost Manager */}
        <section className="light-calculator-section">
          <div className="light-calculator-card">
            <div className="calc-title-header">
              <h2>Dynamic Cost Manager</h2>
              <p>
                Need more social connections or higher monthly credit volume? Adjust the controls below to calculate your custom rate.
              </p>
            </div>

            <div className="calc-main-layout">
              {/* Controls Column */}
              <div className="calc-inputs-col">
                
                {/* Step 1: Base Tier Selector */}
                <div className="calc-slider-block">
                  <div className="calc-slider-top">
                    <span>1. Base Plan</span>
                    <span className="calc-pill-badge">{baseTier.toUpperCase()}</span>
                  </div>
                  <div className="calc-base-selector">
                    <button
                      type="button"
                      className={`calc-base-btn ${baseTier === 'free' ? 'selected' : ''}`}
                      onClick={() => handleSelectTier('free')}
                    >
                      <strong>Free ($0)</strong>
                      <span>Sandbox &bull; 15 Credits</span>
                    </button>
                    <button
                      type="button"
                      className={`calc-base-btn ${baseTier === 'starter' ? 'selected' : ''}`}
                      onClick={() => handleSelectTier('starter')}
                    >
                      <strong>Starter ($20)</strong>
                      <span>1 Conn &bull; 50 Credits</span>
                    </button>
                    <button
                      type="button"
                      className={`calc-base-btn ${baseTier === 'advance' ? 'selected' : ''}`}
                      onClick={() => handleSelectTier('advance')}
                    >
                      <strong>Advance ($39)</strong>
                      <span>1 Conn &bull; Engage Incl.</span>
                    </button>
                  </div>
                </div>

                {/* Slider 1: Social Connections (Unlimited) */}
                <div className="calc-slider-block">
                  <div className="calc-slider-top">
                    <span>2. Connected Social Accounts</span>
                    <div className="calc-stepper-wrap">
                      <button
                        type="button"
                        className="calc-stepper-btn"
                        onClick={() => setConnections(Math.max(baseTier === 'free' ? 0 : 1, connections - 1))}
                        title="Decrease connections"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={baseTier === 'free' ? 0 : 1}
                        value={connections}
                        onChange={(e) => setConnections(Math.max(baseTier === 'free' ? 0 : 1, parseInt(e.target.value, 10) || 0))}
                        className="calc-number-input"
                        title="Enter any number of connections"
                      />
                      <button
                        type="button"
                        className="calc-stepper-btn"
                        onClick={() => setConnections(connections + 1)}
                        title="Increase connections"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={baseTier === 'free' ? 0 : 1}
                    max={Math.max(20, connections + 5)}
                    value={connections}
                    onChange={(e) => setConnections(parseInt(e.target.value, 10))}
                    className="light-range"
                  />
                  <div className="calc-quick-pills">
                    <span style={{ fontSize: '11px', color: '#8c88a0', marginRight: '4px' }}>Quick Add:</span>
                    <button type="button" className="calc-quick-pill" onClick={() => setConnections(connections + 1)}>+1</button>
                    <button type="button" className="calc-quick-pill" onClick={() => setConnections(connections + 5)}>+5</button>
                    <button type="button" className="calc-quick-pill" onClick={() => setConnections(connections + 10)}>+10</button>
                    <button type="button" className="calc-quick-pill" onClick={() => setConnections(connections + 25)}>+25</button>
                  </div>
                  <div className="calc-subnote">
                    {extraConnections > 0
                      ? `+${extraConnections} additional accounts (+$${extraConnectionsCost}/mo)`
                      : `${baseIncludedConns} connection included in base plan`}
                    {' '}&bull; <em>No upper limit (type any number)</em>
                  </div>
                </div>

                {/* Slider 2: Monthly Credits (Unlimited) */}
                <div className="calc-slider-block">
                  <div className="calc-slider-top">
                    <span>3. Monthly AI Credit Quota</span>
                    <div className="calc-stepper-wrap">
                      <button
                        type="button"
                        className="calc-stepper-btn"
                        onClick={() => setCredits(Math.max(baseTier === 'free' ? 15 : 50, credits - 25))}
                        title="Decrease credits"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={baseTier === 'free' ? 15 : 50}
                        step={25}
                        value={credits}
                        onChange={(e) => setCredits(Math.max(baseTier === 'free' ? 15 : 50, parseInt(e.target.value, 10) || 0))}
                        className="calc-number-input"
                        style={{ width: '82px' }}
                        title="Enter any credit volume"
                      />
                      <button
                        type="button"
                        className="calc-stepper-btn"
                        onClick={() => setCredits(credits + 25)}
                        title="Increase credits"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={baseTier === 'free' ? 15 : 50}
                    max={Math.max(500, credits + 100)}
                    step={25}
                    value={credits}
                    onChange={(e) => setCredits(parseInt(e.target.value, 10))}
                    className="light-range"
                  />
                  <div className="calc-quick-pills">
                    <span style={{ fontSize: '11px', color: '#8c88a0', marginRight: '4px' }}>Quick Add:</span>
                    <button type="button" className="calc-quick-pill" onClick={() => setCredits(credits + 50)}>+50</button>
                    <button type="button" className="calc-quick-pill" onClick={() => setCredits(credits + 100)}>+100</button>
                    <button type="button" className="calc-quick-pill" onClick={() => setCredits(credits + 250)}>+250</button>
                    <button type="button" className="calc-quick-pill" onClick={() => setCredits(credits + 500)}>+500</button>
                  </div>
                  <div className="calc-subnote">
                    {extraCredits > 0
                      ? `+${extraCredits} additional credits (+$${extraCreditsCost}/mo)`
                      : `${baseIncludedCredits} credits included in base plan`}
                    {' '}&bull; <em>No upper limit (type any number)</em>
                  </div>
                </div>

                {/* Unlimited Scheduling Callout */}
                <div className="calc-unlimited-box">
                  <CalendarDays size={18} />
                  <span>Unlimited Post Scheduling is always included at no extra charge</span>
                </div>

                {/* Engage Feature Toggle */}
                <div className="calc-toggle-row">
                  <div className="calc-toggle-copy">
                    <strong>Engage Automation Suite</strong>
                    <span>
                      {baseTier === 'advance'
                        ? 'Included Free in the Advance Plan'
                        : 'Comment-to-DM flows, story triggers & auto replies (+$15/mo)'}
                    </span>
                  </div>
                  <label className="calc-switch">
                    <input
                      type="checkbox"
                      checked={engageEnabled || baseTier === 'advance'}
                      disabled={baseTier === 'advance'}
                      onChange={(e) => setEngageEnabled(e.target.checked)}
                    />
                    <span className="calc-switch-slider" />
                  </label>
                </div>

              </div>

              {/* Output Invoice Card */}
              <div className="calc-output-card">
                <div className="output-eyebrow">Calculated Plan</div>
                <div className="output-price-number">${dynamicMonthlyTotal}</div>
                <div className="output-price-cycle">/ month (no contracts, cancel anytime)</div>

                <div className="output-details-list">
                  <div>
                    <span>Base Tier:</span>
                    <strong>${basePrice} ({baseTier.toUpperCase()})</strong>
                  </div>
                  <div>
                    <span>Social Connections:</span>
                    <strong>{connections} account{connections !== 1 ? 's' : ''}</strong>
                  </div>
                  <div>
                    <span>Monthly AI Credits:</span>
                    <strong>{credits} credits</strong>
                  </div>
                  <div>
                    <span>Post Scheduling:</span>
                    <strong style={{ color: '#34d399' }}>100% Unlimited</strong>
                  </div>
                  <div>
                    <span>Engage Automation:</span>
                    <strong>{engageEnabled || baseTier === 'advance' ? 'Active' : 'Off'}</strong>
                  </div>
                </div>

                <Link to={primaryPath} className="output-action-btn">
                  <span>Start with this Plan</span>
                  <ArrowRight size={15} />
                </Link>

                <div className="output-footnote">
                  Adjust your connections or credits from settings anytime.
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Feature Explanations ("What You Get") */}
        <section className="features-light-section">
          <div className="calc-title-header">
            <h2>Everything you get with Content Studio</h2>
            <p>Designed for consistent publishing, authentic brand voice, and inbound lead conversion.</p>
          </div>

          <div className="features-grid-light">
            <div className="feature-box-light">
              <div className="feature-icon-circle">
                <Linkedin size={20} />
              </div>
              <h3>Social Connections</h3>
              <p>
                Link personal LinkedIn profiles, company pages, and Instagram Business accounts securely. Connect or disconnect accounts anytime without losing scheduled queues.
              </p>
            </div>

            <div className="feature-box-light">
              <div className="feature-icon-circle">
                <WandSparkles size={20} />
              </div>
              <h3>Automated Post Generation</h3>
              <p>
                Use your AI credits to create complete multi-channel posts tailored to your brand voice with compelling hooks, custom image generation, and hashtag recommendations.
              </p>
            </div>

            <div className="feature-box-light">
              <div className="feature-icon-circle">
                <CalendarDays size={20} />
              </div>
              <h3>100% Unlimited Scheduling</h3>
              <p>
                Schedule without limits. Whether you queue 5 posts or 200 posts, our publishing engine handles delivery automatically without extra fees.
              </p>
            </div>

            <div className="feature-box-light">
              <div className="feature-icon-circle">
                <Zap size={20} />
              </div>
              <h3>Engage Lead Conversion</h3>
              <p>
                Turn comments into warm leads. Automatically deliver download links or lead magnets via private DM whenever someone comments a keyword.
              </p>
            </div>

            <div className="feature-box-light">
              <div className="feature-icon-circle">
                <Layers3 size={20} />
              </div>
              <h3>Brand Voice Brain</h3>
              <p>
                Upload company notes, guidelines, or PDFs to ground all AI drafts in your real expertise and unique tone of voice.
              </p>
            </div>

            <div className="feature-box-light">
              <div className="feature-icon-circle">
                <MessageSquare size={20} />
              </div>
              <h3>LinkedIn Copilot Inbox</h3>
              <p>
                Stay on top of every comment, mention, and inbound conversation with auto-suggested smart reply drafts.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="faq-light-section">
          <div className="calc-title-header">
            <h2>Frequently Asked Questions</h2>
          </div>

          <div className="faq-grid-light">
            <div className="faq-card-light">
              <h4>What happens when I exhaust my post generation credits?</h4>
              <p>
                Your already scheduled posts will publish normally without interruption. You can immediately purchase an on-demand credit booster pack starting at $10 to generate more content. Booster credits never expire.
              </p>
            </div>

            <div className="faq-card-light">
              <h4>Is post scheduling really 100% unlimited?</h4>
              <p>
                Yes! We do not charge for scheduling posts or queue depth. You can schedule as many posts, carousels, and threads as you want across your connected channels.
              </p>
            </div>

            <div className="faq-card-light">
              <h4>How do social connections work?</h4>
              <p>
                Each connection allows you to link one social profile (LinkedIn Personal Profile, LinkedIn Company Page, or Instagram Business Profile). You can disconnect and connect a different account at any time.
              </p>
            </div>

            <div className="faq-card-light">
              <h4>Can I cancel or change plans anytime?</h4>
              <p>
                Yes, there are no contracts or commitments. You can adjust your connections, credits, or cancel your subscription directly from your settings at any time.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="cta-light-section">
          <h2>Start publishing better content today</h2>
          <p>Join creators and teams using Content Studio to run their content creation and publishing smoothly.</p>
          <Link to={primaryPath} className="cta-btn-main">
            {primaryLabel} <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="pricing-footer">
        <Link className="pricing-brand" to="/">
          <span><Sparkles size={16} /></span> content studio
        </Link>
        <p>&copy; Content Studio Platform. Simple, calm content publishing.</p>
        <div>
          <Link to="/">Home</Link>
          <Link to="/#features">Features</Link>
          <Link to="/signin">Sign in</Link>
        </div>
      </footer>
    </div>
  )
}
