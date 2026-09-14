import { ArrowRight, BarChart3, BookOpen, CalendarDays, Check, ChevronRight, Instagram, Layers3, Linkedin, Repeat2, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/content/AuthContext'
import './LandingPage.css'

const plans = [
  { name: 'Starter', price: 19, credits: 50, accounts: 1, description: 'For one brand finding its rhythm.', examples: 'About 5 AI image posts', featured: false },
  { name: 'Growth', price: 49, credits: 250, accounts: 2, description: 'For consistent publishing on two channels.', examples: 'About 25 image posts', featured: true },
  { name: 'Studio', price: 99, credits: 600, accounts: 4, description: 'For teams managing more ideas and accounts.', examples: 'About 60 image posts', featured: false },
]

export function LandingPage() {
  const { user } = useAuth()
  const primaryPath = user ? '/content' : '/signup'
  const primaryLabel = user ? 'Open workspace' : 'Create your workspace'

  return <div className="landing-page">
    <header className="landing-header">
      <Link className="landing-brand" to="/" aria-label="Content Studio home"><span><Sparkles size={20} /></span> content studio</Link>
      <nav aria-label="Main navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a></nav>
      <div className="landing-header-actions">{!user && <Link className="landing-signin" to="/signin">Sign in</Link>}<Link className="landing-top-cta" to={primaryPath}>{user ? 'Workspace' : 'Get started'} <ArrowRight size={15} /></Link></div>
    </header>

    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker"><span /> THE CALMER WAY TO SHOW UP</span>
          <h1>Great content needs <em>room to think.</em></h1>
          <p>Turn ideas and trusted sources into posts, review every detail, and publish to LinkedIn and Instagram from one clear workspace.</p>
          <div className="landing-hero-actions"><Link className="landing-primary" to={primaryPath}>{primaryLabel} <ArrowRight size={18} /></Link><a className="landing-secondary" href="#how-it-works">See how it works <ChevronRight size={18} /></a></div>
          <div className="landing-hero-note"><Check size={16} /> Keep your voice, schedule, and connected accounts together.</div>
        </div>
        <div className="landing-visual" aria-label="Illustration of the Content Studio workflow">
          <div className="landing-visual-top"><span className="landing-visual-logo"><Sparkles size={15} /> content studio</span><span className="landing-visual-dots"><i /><i /><i /></span></div>
          <div className="landing-visual-body">
            <div className="landing-visual-sidebar"><span className="active"><Layers3 size={15} /> Create</span><span><CalendarDays size={15} /> Calendar</span><span><ShieldCheck size={15} /> Approvals</span></div>
            <div className="landing-visual-content"><div className="landing-visual-eyebrow">YOUR NEXT POST</div><h3>A better way to welcome new customers</h3><p>One clear next step can make the whole experience feel easier.</p><div className="landing-platform-chips"><span><Linkedin size={14} /> LinkedIn</span><span><Instagram size={14} /> Instagram</span></div><div className="landing-visual-post"><div className="landing-post-image"><span className="landing-image-orbit" /><Sparkles size={27} /></div><div><small>INSTAGRAM PREVIEW</small><strong>Make the first step feel simple.</strong><p>Turn the moments that confuse new customers into moments that build trust.</p><span className="landing-post-tags">#CustomerExperience #Growth</span></div></div><div className="landing-visual-footer"><span><Check size={14} /> Ready for review</span><span>Schedule post <ArrowRight size={13} /></span></div></div>
          </div>
          <div className="landing-floating-card"><span><WandSparkles size={15} /> Drafts that sound like you</span><strong>Idea → post → published</strong></div>
        </div>
      </section>

      <section className="landing-trust-strip" aria-label="Publishing platforms"><span>MADE FOR YOUR EVERYDAY CONTENT</span><div><Linkedin size={20} /> LinkedIn</div><div><Instagram size={20} /> Instagram</div><div><ShieldCheck size={20} /> Review before publishing</div></section>

      <section className="landing-section" id="features"><div className="landing-section-head"><span className="landing-kicker">WHAT YOU CAN DO</span><h2>One place for every step.</h2><p>Keep your content moving without losing the thinking behind it.</p></div><div className="landing-feature-grid">
        <article><span className="landing-feature-icon purple"><WandSparkles size={22} /></span><h3>Create with context</h3><p>Start from an idea or saved source and shape a version for each connected channel.</p></article>
        <article><span className="landing-feature-icon peach"><ShieldCheck size={22} /></span><h3>Review with confidence</h3><p>Check the copy, image, and platform fit before a post goes live.</p></article>
        <article><span className="landing-feature-icon blue"><CalendarDays size={22} /></span><h3>Publish on your schedule</h3><p>Plan upcoming posts in a calendar and keep published work easy to find.</p></article>
        <article><span className="landing-feature-icon purple"><Repeat2 size={22} /></span><h3>Create a series at once</h3><p>Give one brief and automatically create a sequence of drafts to review and schedule.</p></article>
        <article><span className="landing-feature-icon peach"><BookOpen size={22} /></span><h3>Keep your source library</h3><p>Save trusted material, reuse it in new drafts, and keep your brand voice consistent.</p></article>
        <article><span className="landing-feature-icon blue"><BarChart3 size={22} /></span><h3>Learn from your posts</h3><p>View publishing analytics and use what worked to shape your next idea.</p></article>
      </div></section>

      <section className="landing-workflow" id="how-it-works"><div className="landing-workflow-copy"><span className="landing-kicker">A SIMPLE FLOW</span><h2>From first thought to final post.</h2><p>Content Studio gives every idea a clear path to publishing.</p><Link className="landing-text-link" to={primaryPath}>{primaryLabel} <ArrowRight size={17} /></Link></div><div className="landing-steps"><div><span>01</span><div><h3>Bring your idea</h3><p>Add a prompt, source, or rough note.</p></div></div><div><span>02</span><div><h3>Make it yours</h3><p>Refine the channel draft and add an image for Instagram.</p></div></div><div><span>03</span><div><h3>Approve and publish</h3><p>Choose a time or publish when you are ready.</p></div></div></div></section>

      <section className="landing-section landing-pricing" id="pricing"><div className="landing-section-head"><span className="landing-kicker">PLANNED PRICING</span><h2>Pay for the creative work you use.</h2><p>Every plan includes AI post and series creation, planning, approvals, and analytics. Credits cover AI work; scheduling and publishing use no credits.</p></div><div className="landing-pricing-grid">{plans.map((plan) => <article className={plan.featured ? 'featured' : ''} key={plan.name}>{plan.featured && <span className="landing-plan-badge">POPULAR CHOICE</span>}<div className="landing-plan-name">{plan.name}</div><p>{plan.description}</p><div className="landing-plan-price"><strong>${plan.price}</strong><span>/ month<br />plus applicable tax</span></div><div className="landing-plan-divider" /><ul><li><Check size={17} /> {plan.credits} AI credits each month</li><li><Check size={17} /> {plan.accounts} connected {plan.accounts === 1 ? 'account' : 'accounts'}</li><li><Check size={17} /> {plan.examples}</li><li><Check size={17} /> AI post and series creation</li><li><Check size={17} /> Calendar, approvals and analytics</li><li><Check size={17} /> Unlimited scheduling and publishing</li></ul><Link className={plan.featured ? 'landing-plan-cta featured' : 'landing-plan-cta'} to={primaryPath}>{primaryLabel} <ArrowRight size={16} /></Link></article>)}</div><p className="landing-pricing-note">Pricing is a proposal; checkout and credit metering are not active yet. A platform draft uses 2 credits and an AI image uses 8; series creation uses the same rates per draft. Extra credits and accounts would be available separately.</p></section>

      <section className="landing-close"><span className="landing-kicker">MAKE SPACE FOR WHAT MATTERS</span><h2>Your next good idea deserves to be shared.</h2><Link className="landing-primary" to={primaryPath}>{primaryLabel} <ArrowRight size={18} /></Link></section>
    </main>
    <footer className="landing-footer"><Link className="landing-brand" to="/"><span><Sparkles size={17} /></span> content studio</Link><p>Create with clarity. Publish with confidence.</p><div><a href="#features">Features</a><a href="#pricing">Pricing</a><Link to="/signin">Sign in</Link></div></footer>
  </div>
}
