import {
  ArrowRight, BarChart3, Bot, CalendarDays, Check, ChevronRight, HelpCircle,
  Instagram, Layers3, Linkedin, MessageSquare, Plus, RefreshCw, Repeat2,
  ShieldCheck, Sparkles, WandSparkles, Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/content/AuthContext'
import './PricingPage.css'

interface BaseTierConfig {
  id: 'starter' | 'growth' | 'scale'
  name: string
  monthlyPrice: number
  connections: number
  credits: number
  engageIncluded: boolean
  description: string
  popular?: boolean
}

const BASE_TIERS: Record<string, BaseTierConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    connections: 2,
    credits: 50,
    engageIncluded: false,
    description: 'For solopreneurs & creators growing an authentic personal brand.',
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 69,
    connections: 5,
    credits: 200,
    engageIncluded: true,
    description: 'For growing businesses and consultants turning content into inbound leads.',
    popular: true,
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    monthlyPrice: 139,
    connections: 15,
    credits: 600,
    engageIncluded: true,
    description: 'For agencies and multi-channel teams managing high-volume publishing.',
  },
}

const BOOSTER_PACKS = [
  { credits: 50, label: 'Starter Pack', price: 10, unit: '$0.20 / credit' },
  { credits: 150, label: 'Growth Pack', price: 25, unit: '$0.16 / credit' },
  { credits: 500, label: 'Power Pack', price: 60, unit: '$0.12 / credit' },
  { credits: 1200, label: 'Agency Pack', price: 120, unit: '$0.10 / credit' },
]

export function PricingPage() {
  const { user } = useAuth()
  const primaryPath = user ? '/content' : '/signup'
  const primaryLabel = user ? 'Open workspace' : 'Get started'

  // Configurator state
  const [selectedTier, setSelectedTier] = useState<'starter' | 'growth' | 'scale'>('growth')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [connections, setConnections] = useState<number>(5)
  const [credits, setCredits] = useState<number>(200)
  const [engageEnabled, setEngageEnabled] = useState<boolean>(true)

  const activeTierConfig = BASE_TIERS[selectedTier]
  const isAnnual = billingCycle === 'annual'
  const annualDiscount = isAnnual ? 0.2 : 0

  // Calculation logic
  const extraConnections = Math.max(0, connections - activeTierConfig.connections)
  const connectionRate = extraConnections >= 5 ? 4 : 5
  const extraConnectionsCost = extraConnections * connectionRate

  const extraCredits = Math.max(0, credits - activeTierConfig.credits)
  let extraCreditsCost = 0
  if (extraCredits > 0) {
    if (extraCredits <= 200) {
      extraCreditsCost = extraCredits * 0.15
    } else {
      extraCreditsCost = (200 * 0.15) + ((extraCredits - 200) * 0.1)
    }
  }

  let engageCost = 0
  if (!activeTierConfig.engageIncluded && engageEnabled) {
    engageCost = 25
  }

  const rawMonthlyTotal = activeTierConfig.monthlyPrice + extraConnectionsCost + extraCreditsCost + engageCost
  const finalMonthlyTotal = Math.round(rawMonthlyTotal * (1 - annualDiscount))
  const annualSavings = Math.round(rawMonthlyTotal * 12 * 0.2)

  const effectiveCostPerConn = (finalMonthlyTotal / connections).toFixed(2)
  const effectiveCostPerCredit = (finalMonthlyTotal / credits).toFixed(2)

  // Handlers
  const handleTierChange = (tierId: 'starter' | 'growth' | 'scale') => {
    setSelectedTier(tierId)
    const tier = BASE_TIERS[tierId]
    if (connections < tier.connections) {
      setConnections(tier.connections)
    }
    if (credits < tier.credits) {
      setCredits(tier.credits)
    }
    if (tier.engageIncluded) {
      setEngageEnabled(true)
    }
  }

  const applyArchetype = (type: 'creator' | 'growth' | 'agency' | 'power') => {
    if (type === 'creator') {
      setSelectedTier('starter')
      setConnections(2)
      setCredits(50)
      setEngageEnabled(false)
    } else if (type === 'growth') {
      setSelectedTier('growth')
      setConnections(5)
      setCredits(200)
      setEngageEnabled(true)
    } else if (type === 'agency') {
      setSelectedTier('scale')
      setConnections(12)
      setCredits(500)
      setEngageEnabled(true)
    } else if (type === 'power') {
      setSelectedTier('scale')
      setConnections(20)
      setCredits(1200)
      setEngageEnabled(true)
    }
  }

  return (
    <div className="pricing-page">
      {/* Navigation Header */}
      <header className="pricing-header">
        <Link className="pricing-brand" to="/" aria-label="Content Studio home">
          <span><Sparkles size={20} /></span> content studio
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/#features">Features</Link>
          <Link to="/#how-it-works">How it works</Link>
          <Link to="/pricing" className="active">Pricing</Link>
        </nav>
        <div className="pricing-header-actions">
          {!user && <Link className="pricing-signin" to="/signin">Sign in</Link>}
          <Link className="pricing-top-cta" to={primaryPath}>
            {primaryLabel} <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pricing-hero">
          <span className="pricing-kicker">
            <span /> TRANSPARENT &amp; DYNAMIC PRICING
          </span>
          <h1>
            Pay for your actual reach. <em>Never for scheduling.</em>
          </h1>
          <p className="pricing-hero-desc">
            Scale seamlessly on the basis of social connections and automated post creation credits.
            Enjoy unlimited post scheduling across all plans with our modular Engage automation suite.
          </p>

          {/* Billing Toggle */}
          <div className="pricing-toggle-wrap">
            <button
              type="button"
              className={`pricing-toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('monthly')}
            >
              Billed Monthly
            </button>
            <button
              type="button"
              className={`pricing-toggle-btn ${billingCycle === 'annual' ? 'active' : ''}`}
              onClick={() => setBillingCycle('annual')}
            >
              <span>Billed Annually</span>
              <span className="pricing-discount-pill">Save 20%</span>
            </button>
          </div>

          {/* Preset Archetypes */}
          <div className="pricing-archetypes">
            <span className="pricing-archetypes-label">Quick Setups:</span>
            <button
              type="button"
              className={`pricing-preset-btn ${selectedTier === 'starter' && connections === 2 ? 'selected' : ''}`}
              onClick={() => applyArchetype('creator')}
            >
              Solo Creator (2 Conn, 50 Credits)
            </button>
            <button
              type="button"
              className={`pricing-preset-btn ${selectedTier === 'growth' && connections === 5 ? 'selected' : ''}`}
              onClick={() => applyArchetype('growth')}
            >
              Growth Team (5 Conn, 200 Credits + Engage)
            </button>
            <button
              type="button"
              className={`pricing-preset-btn ${selectedTier === 'scale' && connections === 12 ? 'selected' : ''}`}
              onClick={() => applyArchetype('agency')}
            >
              Agency / Multi-Brand (12 Conn, 500 Credits)
            </button>
            <button
              type="button"
              className={`pricing-preset-btn ${selectedTier === 'scale' && connections === 20 ? 'selected' : ''}`}
              onClick={() => applyArchetype('power')}
            >
              Power Publisher (20 Conn, 1,200 Credits)
            </button>
          </div>
        </section>

        {/* Dynamic Builder & Cost Manager */}
        <section className="pricing-builder-container">
          <div className="pricing-builder-grid">
            
            {/* Left: Controls */}
            <div className="builder-controls-card">
              
              {/* Step 1: Base Tier Selection */}
              <div className="builder-section-title">
                <h3>
                  <span className="builder-step-num">1</span>
                  Choose your base foundation
                </h3>
              </div>

              <div className="builder-tier-cards">
                {(Object.keys(BASE_TIERS) as Array<'starter' | 'growth' | 'scale'>).map((tierKey) => {
                  const tier = BASE_TIERS[tierKey]
                  const isSelected = selectedTier === tierKey
                  const displayPrice = isAnnual ? Math.round(tier.monthlyPrice * 0.8) : tier.monthlyPrice

                  return (
                    <div
                      key={tier.id}
                      className={`builder-tier-card ${isSelected ? 'active' : ''}`}
                      onClick={() => handleTierChange(tier.id)}
                      role="button"
                      tabIndex={0}
                    >
                      {tier.popular && <span className="builder-tier-badge">Most Popular</span>}
                      <div className="tier-card-header">
                        <strong>{tier.name}</strong>
                        <span className="tier-card-price">${displayPrice}/mo</span>
                      </div>
                      <div className="tier-card-desc">{tier.description}</div>
                      <div className="tier-card-specs">
                        <div className="spec-item">
                          <Check size={14} /> {tier.connections} Social Connections
                        </div>
                        <div className="spec-item">
                          <Check size={14} /> {tier.credits} AI Post Credits / mo
                        </div>
                        <div className="spec-item">
                          <Check size={14} /> Unlimited Scheduling
                        </div>
                        <div className="spec-item">
                          <Check size={14} /> {tier.engageIncluded ? 'Engage Suite Included' : 'Engage available as Add-on'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Step 2: Dynamic Volume Controls */}
              <div className="builder-section-title">
                <h3>
                  <span className="builder-step-num">2</span>
                  Scale volume dynamically
                </h3>
              </div>

              {/* Slider 1: Connections */}
              <div className="slider-group">
                <div className="slider-header">
                  <div className="slider-title-area">
                    <span className="slider-title">Social Account Connections</span>
                    <span className="slider-value-badge">{connections} connected</span>
                  </div>
                  <span className="slider-subdetail">
                    {extraConnections > 0
                      ? `+${extraConnections} extra accounts ($${extraConnectionsCost}/mo)`
                      : `${activeTierConfig.connections} accounts included in plan`}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={25}
                  value={connections}
                  onChange={(e) => setConnections(parseInt(e.target.value, 10))}
                  className="custom-range-slider"
                />
                <div className="slider-ticks">
                  <span>1</span>
                  <span>5 (Growth)</span>
                  <span>10</span>
                  <span>15 (Scale)</span>
                  <span>20</span>
                  <span>25+</span>
                </div>
                <div className="slider-explanation">
                  Base plan includes {activeTierConfig.connections} connections (LinkedIn Profile/Page, Instagram Business). Additional connections are $5/month ($4/mo for 5+).
                </div>
              </div>

              {/* Slider 2: Automated Post Credits */}
              <div className="slider-group">
                <div className="slider-header">
                  <div className="slider-title-area">
                    <span className="slider-title">Monthly Automated Post Credits</span>
                    <span className="slider-value-badge">{credits} credits / mo</span>
                  </div>
                  <span className="slider-subdetail">
                    {extraCredits > 0
                      ? `+${extraCredits} extra credits ($${Math.round(extraCreditsCost)}/mo)`
                      : `${activeTierConfig.credits} credits included in plan`}
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={1500}
                  step={10}
                  value={credits}
                  onChange={(e) => setCredits(parseInt(e.target.value, 10))}
                  className="custom-range-slider"
                />
                <div className="slider-ticks">
                  <span>20</span>
                  <span>200 (Growth)</span>
                  <span>500</span>
                  <span>600 (Scale)</span>
                  <span>1,000</span>
                  <span>1,500</span>
                </div>
                <div className="slider-explanation">
                  1 credit generates a full brand-tailored post with channel variants and hooks. Run out mid-month? Purchase non-expiring credit packs anytime.
                </div>
              </div>

              {/* Unlimited Scheduling Callout */}
              <div className="unlimited-scheduling-banner">
                <div className="unlimited-badge-icon">
                  <CalendarDays size={16} />
                </div>
                <div className="unlimited-text">
                  <strong>Post Scheduling is 100% Free &amp; Unlimited</strong>
                  <p>
                    Unlike legacy platforms, we never cap how many posts you schedule or queue.
                    Plan as far ahead on your calendar as you want without paying a dime extra.
                  </p>
                </div>
              </div>

              {/* Engage Feature Toggle Box */}
              <div className={`engage-module-box ${engageEnabled ? 'active' : ''}`}>
                <div className="engage-module-copy">
                  <strong>
                    Engage Automation Module {activeTierConfig.engageIncluded ? '(Included in your plan)' : '(+$25/mo Add-on)'}
                  </strong>
                  <p>
                    Convert engagement into pipeline: automated Comment-to-DM flows, Instagram story replies, DM keyword triggers, and LinkedIn Copilot inbox management.
                  </p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={engageEnabled}
                    disabled={activeTierConfig.engageIncluded}
                    onChange={(e) => setEngageEnabled(e.target.checked)}
                  />
                  <span className="switch-slider" />
                </label>
              </div>

            </div>

            {/* Right: Real-time Invoice & Cost Summary */}
            <div className="builder-summary-card">
              <div className="summary-header">
                <span className="summary-label">Dynamic Cost Estimate</span>
                <div className="summary-total-price">
                  <strong>${finalMonthlyTotal}</strong>
                  <span>{isAnnual ? '/ month (billed annually)' : '/ month'}</span>
                </div>
                {isAnnual && (
                  <div className="summary-savings-banner">
                    ✨ Saving ${annualSavings}/year with annual billing
                  </div>
                )}
              </div>

              <div className="summary-divider" />

              <div className="summary-item-list">
                <div className="summary-item">
                  <span>{activeTierConfig.name} Base Plan</span>
                  <strong>${(activeTierConfig.monthlyPrice * (1 - annualDiscount)).toFixed(2)}</strong>
                </div>

                <div className="summary-item">
                  <span>
                    Extra Connections ({extraConnections} @ ${connectionRate}/mo)
                  </span>
                  <strong>${(extraConnectionsCost * (1 - annualDiscount)).toFixed(2)}</strong>
                </div>

                <div className="summary-item">
                  <span>Extra Credits ({extraCredits})</span>
                  <strong>${(extraCreditsCost * (1 - annualDiscount)).toFixed(2)}</strong>
                </div>

                <div className="summary-item">
                  <span>Engage Feature Suite</span>
                  <strong>
                    {activeTierConfig.engageIncluded
                      ? 'INCLUDED'
                      : `$${(engageCost * (1 - annualDiscount)).toFixed(2)}`}
                  </strong>
                </div>

                {isAnnual && (
                  <div className="summary-item discount-item">
                    <span>20% Annual Prepaid Discount</span>
                    <strong>-${(rawMonthlyTotal * 0.2).toFixed(2)}</strong>
                  </div>
                )}
              </div>

              <div className="summary-divider" />

              <div className="summary-unit-metrics">
                <div className="metric-box">
                  <small>Cost / Connection</small>
                  <strong>${effectiveCostPerConn}/mo</strong>
                </div>
                <div className="metric-box">
                  <small>Cost / Post Credit</small>
                  <strong>${effectiveCostPerCredit}/post</strong>
                </div>
              </div>

              <Link to={primaryPath} className="summary-checkout-btn">
                <span>Lock in this Plan</span>
                <ArrowRight size={16} />
              </Link>

              <div className="summary-guarantee">
                ✓ 14-day free trial &bull; No contracts &bull; Change or cancel quotas anytime
              </div>
            </div>

          </div>
        </section>

        {/* Deep Dive Feature Explanations ("What You Get") */}
        <section className="pricing-features-section" id="features-detail">
          <div className="features-section-header">
            <span className="pricing-kicker"><span /> DEEP-DIVE ARCHITECTURE</span>
            <h2>Everything you get with Content Studio</h2>
            <p>
              Designed from the ground up for modern B2B creators, founders, and marketing teams who demand predictable costs and uncompromised content quality.
            </p>
          </div>

          <div className="feature-cards-grid">
            {/* Feature 1: Connections */}
            <div className="feature-detail-card">
              <div className="feature-icon-badge purple">
                <Linkedin size={22} />
              </div>
              <h3>1. Multi-Platform Social Connections</h3>
              <p>
                Connect personal LinkedIn profiles, company pages, and Instagram Business profiles securely via OAuth 2.0 with persistent token management.
              </p>
              <ul className="feature-bullets">
                <li><Check size={16} /> Seamlessly switch between brand pages and executive personal profiles.</li>
                <li><Check size={16} /> Instant disconnect and reconnect without losing scheduled queues or historical analytics.</li>
                <li><Check size={16} /> Multi-brand tenancy keeps assets, voices, and drafts strictly isolated.</li>
              </ul>
            </div>

            {/* Feature 2: Automated Post Credits */}
            <div className="feature-detail-card">
              <div className="feature-icon-badge emerald">
                <WandSparkles size={22} />
              </div>
              <h3>2. Automated Post Generation Credits</h3>
              <p>
                Each credit fuels an end-to-end multi-platform post generation powered by state-of-the-art LLMs, grounded in your Brand Brain.
              </p>
              <ul className="feature-bullets">
                <li><Check size={16} /> Generates tailored variants for LinkedIn, Instagram carousels, and stories simultaneously.</li>
                <li><Check size={16} /> Grounded directly in your uploaded source documents, PDFs, and notes.</li>
                <li><Check size={16} /> Exhausted credits? Refill instantly with top-up booster packs that <strong>never expire</strong>.</li>
              </ul>
            </div>

            {/* Feature 3: Unlimited Scheduling */}
            <div className="feature-detail-card">
              <div className="feature-icon-badge blue">
                <CalendarDays size={22} />
              </div>
              <h3>3. Unlimited Post Scheduling (100% Free)</h3>
              <p>
                We believe scheduling and publishing are core utilities, not paywalled commodities. Never pay extra for planning ahead.
              </p>
              <ul className="feature-bullets">
                <li><Check size={16} /> Unlimited queue depth and calendar planning months in advance.</li>
                <li><Check size={16} /> Visual drag-and-drop calendar with per-network time slot recommendations.</li>
                <li><Check size={16} /> Automated Celery-backed worker publishing with automatic retry and rate-limit handling.</li>
              </ul>
            </div>

            {/* Feature 4: Engage Automation Suite */}
            <div className="feature-detail-card">
              <div className="feature-icon-badge amber">
                <Zap size={22} />
              </div>
              <h3>4. Engage Inbound Conversion Engine</h3>
              <p>
                Turn content views and comments into active conversations, qualified leads, and booked discovery calls around the clock.
              </p>
              <ul className="feature-bullets">
                <li><Check size={16} /> <strong>Comment-to-DM:</strong> Auto-reply to comments with keyword triggers and deliver private lead magnets.</li>
                <li><Check size={16} /> <strong>Story &amp; DM Triggers:</strong> Instant response sequences to story mentions and inbound inquiries.</li>
                <li><Check size={16} /> <strong>LinkedIn Copilot:</strong> Inbox review queue with smart reply suggestions and lead prioritization.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Credit Booster Top-Up Packs */}
        <section className="pricing-booster-section">
          <div className="features-section-header">
            <span className="pricing-kicker"><span /> ON-DEMAND BOOSTERS</span>
            <h2>Need more generation credits? Top up anytime.</h2>
            <p>
              If your team is running a major launch or needs extra drafts, top-up booster packs add credits immediately. Booster credits roll over indefinitely while your account is active.
            </p>
          </div>

          <div className="booster-grid">
            {BOOSTER_PACKS.map((pack) => (
              <div key={pack.label} className="booster-card">
                <div className="booster-credits">{pack.credits}</div>
                <div className="booster-label">{pack.label}</div>
                <div className="booster-price">${pack.price}</div>
                <div className="booster-unit-rate">{pack.unit}</div>
                <Link to={primaryPath} className="booster-buy-btn">
                  Select Booster
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Full Plan Comparison Table */}
        <section className="pricing-matrix-section">
          <div className="features-section-header">
            <span className="pricing-kicker"><span /> SIDE-BY-SIDE MATRIX</span>
            <h2>Compare all features &amp; capabilities</h2>
          </div>

          <div className="pricing-table-wrapper">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th className="col-feature">Feature / Quota</th>
                  <th className="col-tier">Starter</th>
                  <th className="col-tier">Growth</th>
                  <th className="col-tier">Scale</th>
                </tr>
              </thead>
              <tbody>
                {/* Section: Pricing & Base */}
                <tr className="table-category-row">
                  <td colSpan={4}>Pricing &amp; Base Entitlements</td>
                </tr>
                <tr>
                  <td>Monthly Base Cost</td>
                  <td className="cell-tier"><strong>$29 / mo</strong></td>
                  <td className="cell-tier"><strong>$69 / mo</strong></td>
                  <td className="cell-tier"><strong>$139 / mo</strong></td>
                </tr>
                <tr>
                  <td>Annual Base Cost (-20%)</td>
                  <td className="cell-tier">$23 / mo</td>
                  <td className="cell-tier">$55 / mo</td>
                  <td className="cell-tier">$111 / mo</td>
                </tr>
                <tr>
                  <td>Included Social Connections</td>
                  <td className="cell-tier">2 accounts</td>
                  <td className="cell-tier">5 accounts</td>
                  <td className="cell-tier">15 accounts</td>
                </tr>
                <tr>
                  <td>Extra Connection Cost</td>
                  <td className="cell-tier">$5 / conn / mo</td>
                  <td className="cell-tier">$5 / conn / mo ($4 for 5+)</td>
                  <td className="cell-tier">$4 / conn / mo</td>
                </tr>
                <tr>
                  <td>Included Monthly Post Credits</td>
                  <td className="cell-tier">50 credits / mo</td>
                  <td className="cell-tier">200 credits / mo</td>
                  <td className="cell-tier">600 credits / mo</td>
                </tr>

                {/* Section: Publishing & Scheduling */}
                <tr className="table-category-row">
                  <td colSpan={4}>Publishing &amp; Content Management</td>
                </tr>
                <tr>
                  <td>Scheduled Posts &amp; Calendar</td>
                  <td className="cell-tier"><strong>Unlimited</strong></td>
                  <td className="cell-tier"><strong>Unlimited</strong></td>
                  <td className="cell-tier"><strong>Unlimited</strong></td>
                </tr>
                <tr>
                  <td>Multi-channel Content Series</td>
                  <td className="cell-tier">Basic (3-part series)</td>
                  <td className="cell-tier">Full (7-part series)</td>
                  <td className="cell-tier">Unlimited Series</td>
                </tr>
                <tr>
                  <td>Brand Brain Knowledge Base</td>
                  <td className="cell-tier">1 Brand Voice</td>
                  <td className="cell-tier">3 Brand Voices</td>
                  <td className="cell-tier">Unlimited Brand Voices</td>
                </tr>
                <tr>
                  <td>Story Interview Audio Engine</td>
                  <td className="cell-tier">Optional add-on</td>
                  <td className="cell-tier"><Check size={16} color="#10b981" /></td>
                  <td className="cell-tier"><Check size={16} color="#10b981" /></td>
                </tr>

                {/* Section: Engagement & Lead Generation */}
                <tr className="table-category-row">
                  <td colSpan={4}>Engage Automation Suite</td>
                </tr>
                <tr>
                  <td>Comment-to-DM Triggers</td>
                  <td className="cell-tier">Add-on ($25/mo)</td>
                  <td className="cell-tier"><Check size={16} color="#10b981" /> Included</td>
                  <td className="cell-tier"><Check size={16} color="#10b981" /> Included</td>
                </tr>
                <tr>
                  <td>Instagram Story Reply Automations</td>
                  <td className="cell-tier">Add-on ($25/mo)</td>
                  <td className="cell-tier"><Check size={16} color="#10b981" /> Included</td>
                  <td className="cell-tier"><Check size={16} color="#10b981" /> Included</td>
                </tr>
                <tr>
                  <td>LinkedIn Copilot Smart Triage</td>
                  <td className="cell-tier">—</td>
                  <td className="cell-tier"><Check size={16} color="#10b981" /> Included</td>
                  <td className="cell-tier"><Check size={16} color="#10b981" /> Included</td>
                </tr>

                {/* Section: Team & Support */}
                <tr className="table-category-row">
                  <td colSpan={4}>Team &amp; Governance</td>
                </tr>
                <tr>
                  <td>Team Seats</td>
                  <td className="cell-tier">1 user</td>
                  <td className="cell-tier">Up to 3 users</td>
                  <td className="cell-tier">Up to 10 users</td>
                </tr>
                <tr>
                  <td>Multi-workspace Isolation</td>
                  <td className="cell-tier">—</td>
                  <td className="cell-tier"><Check size={16} color="#10b981" /></td>
                  <td className="cell-tier"><Check size={16} color="#10b981" /></td>
                </tr>
                <tr>
                  <td>Support Channel</td>
                  <td className="cell-tier">Standard Email</td>
                  <td className="cell-tier">Priority Support</td>
                  <td className="cell-tier">Dedicated Account Manager</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="pricing-faq-section">
          <div className="features-section-header">
            <span className="pricing-kicker"><span /> FREQUENTLY ASKED QUESTIONS</span>
            <h2>Got questions? We've got answers.</h2>
          </div>

          <div className="faq-grid">
            <div className="faq-item">
              <h4>What happens when I exhaust my post generation credits?</h4>
              <p>
                When your credits hit zero, your existing scheduled posts will continue to publish without any interruption.
                You can instantly purchase top-up booster packs (starting at $10 for 50 credits) from your dashboard. Booster credits never expire while your account remains active.
              </p>
            </div>

            <div className="faq-item">
              <h4>How do social connections work?</h4>
              <p>
                A connection is any individual social channel profile (e.g., a LinkedIn Personal Profile, a LinkedIn Company Page, or an Instagram Business account).
                You can disconnect an account and connect a different one at any time without penalty.
              </p>
            </div>

            <div className="faq-item">
              <h4>Is post scheduling truly unlimited on all tiers?</h4>
              <p>
                Yes! We never limit the number of posts, carousels, or threads you schedule.
                Whether you schedule 10 posts a week or 300 posts a month across your connected accounts, there are zero extra fees.
              </p>
            </div>

            <div className="faq-item">
              <h4>Can I add the Engage module to the Starter plan?</h4>
              <p>
                Yes! The Engage suite is available as a flexible $25/month add-on for Starter plans, or you can upgrade to the Growth plan ($69/mo) where it is included completely free alongside more connections and credits.
              </p>
            </div>

            <div className="faq-item">
              <h4>Can I upgrade, downgrade, or cancel anytime?</h4>
              <p>
                Absolutely. Content Studio has no lock-in contracts. You can scale your connections and credits up or down dynamically, and prorated credits will apply to your next invoice.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="pricing-bottom-cta">
          <span className="pricing-kicker" style={{ color: '#c2baf8' }}>
            GET STARTED TODAY
          </span>
          <h2>Start creating better content in 2 minutes.</h2>
          <p>
            Join founders, creators, and agencies using Content Studio to build consistent presence across LinkedIn and Instagram.
          </p>
          <Link to={primaryPath} className="pricing-primary-btn" style={{ minHeight: 50, padding: '0 28px', fontSize: 15 }}>
            {primaryLabel} <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="pricing-footer">
        <Link className="pricing-brand" to="/">
          <span><Sparkles size={17} /></span> content studio
        </Link>
        <p>Create with clarity. Publish with confidence.</p>
        <div>
          <Link to="/">Home</Link>
          <Link to="/#features">Features</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/signin">Sign in</Link>
        </div>
      </footer>
    </div>
  )
}
