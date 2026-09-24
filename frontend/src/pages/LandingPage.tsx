import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  FileText,
  Instagram,
  Layers3,
  Linkedin,
  Lock,
  Mail,
  MessageCircleMore,
  Repeat2,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WandSparkles,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/content/AuthContext'
import { usePricingCatalog } from '../hooks/usePricingCatalog'
import './LandingPage.css'

const planPresentation = {
  free: { description: 'Test the AI creation engine and plan upcoming drafts.', examples: 'Create drafts before connecting an account', cta: 'Start with Free' },
  starter: { description: 'For creators building an authentic personal presence.', examples: 'Consistent creation + unlimited scheduling', cta: 'Get Starter' },
  advance: { description: 'High-volume publishing with Engage lead automation.', examples: 'High-volume creation + Engage suite', cta: 'Get Advance' },
}

const workflowSlides = [
  {
    step: '01',
    tabLabel: 'Brain & Ingest',
    badge: 'FOUNDATION & VOICE CALIBRATION',
    featureName: 'Brand Brain & Knowledge Ingestion',
    title: 'Ground every idea in your genuine voice and verified evidence.',
    description:
      'Before writing a single word, Visiofy Studio calibrates your brand persona, core values, tone pillars, and forbidden buzzwords. Ingest article URLs, team research, or speak into the Story Interviewer to convert raw founder thoughts into structured narrative foundations without synthetic AI fluff.',
    bullets: [
      'Voice Calibration: Strict tone rules guarantee posts sound like you, never generic AI.',
      'Story Interviewer: 5-minute guided prompts convert spoken notes into captivating hooks.',
      'Knowledge Grounding: Ingest URLs and documents to eliminate hallucinations.',
    ],
  },
  {
    step: '02',
    tabLabel: 'Dual AI Composer',
    badge: 'PLATFORM-NATIVE DRAFTING',
    featureName: 'Dual LinkedIn & Instagram AI Composer',
    title: 'One core thesis, platform-perfect copy and visuals generated in seconds.',
    description:
      'Never copy-paste generic text between networks. The AI Composer crafts tailored variants simultaneously—leveraging 2-line click-through hooks for LinkedIn and visually engaging, aesthetic storytelling for Instagram with real-time preview fidelity.',
    bullets: [
      '5 Psychological Hooks: Explore curiosity gaps, counter-intuitive truths, and data hooks.',
      'True Social Preview Fidelity: Line breaks, character counts, and hashtags previewed natively.',
      'Integrated Visuals: Generate 1:1 and 4:5 on-brand graphics directly in your flow.',
    ],
  },
  {
    step: '03',
    tabLabel: 'Series Engine',
    badge: 'MULTI-POST ARCHITECTURE',
    featureName: 'Content Series Multi-Post Engine',
    title: 'Expand one brief into an episodic 3 to 7-post campaign cascade.',
    description:
      'Overcome daily posting burnout. Provide one high-level topic or launch brief, and the Series Engine generates a multi-day narrative arc (e.g. Teaser → Framework → Case Study → Playbook) with optimal scheduling cadences.',
    bullets: [
      'Episodic Narrative Arcs: Pre-built storytelling templates for product launches and authority.',
      'Smart Cadence Spacing: Automatically spaces posts across your best publishing days.',
      'Unified Campaign Workspace: Review, edit, and approve all posts from a single canvas.',
    ],
  },
  {
    step: '04',
    tabLabel: 'Approvals & Calendar',
    badge: 'GOVERNANCE & PUBLISHING',
    featureName: 'Immutable Approvals & Visual Calendar',
    title: 'Zero unapproved publishes, automated pre-flight checks, and unlimited scheduling.',
    description:
      'Protect brand safety with enterprise-grade safeguards. Marking a draft "Approved" locks an immutable version snapshot—any post-approval edit revokes approval immediately. Plan across networks with unlimited 0-credit calendar scheduling.',
    bullets: [
      'Immutable Snapshot Locking: Safeguards against accidental edits going live to networks.',
      'Automated Pre-Flight Check: Inspects character limits, media aspect ratios, and links.',
      'Unlimited 0-Credit Scheduling: Drag-and-drop planning with zero credit burn.',
    ],
  },
  {
    step: '05',
    tabLabel: 'Engagement & Leads',
    badge: 'REVENUE & PIPELINE CONVERSION',
    featureName: 'Engagement Hub & Lead Intelligence',
    title: 'Turn inbound comments into qualified conversations and pipeline.',
    description:
      'Publishing is just the start. The Engagement Hub aggregates incoming comments and reactions into a unified priority inbox, runs real-time sentiment analysis to detect high-intent buyer inquiries, and drafts context-aware replies for fast review.',
    bullets: [
      'Unified Comment Stream: Monitor and triage LinkedIn and Instagram comments centrally.',
      'High-Intent Buyer Detection: Flags comments requesting demos, pricing, or collaboration.',
      'Persona-Calibrated AI Replies: Drafts context-aware, helpful replies in your authentic voice.',
    ],
  },
]

export function LandingPage() {
  const { user } = useAuth()
  const { catalog, error: pricingError } = usePricingCatalog()
  const primaryPath = user ? '/content' : '/signup'
  const primaryLabel = user ? 'Open workspace' : 'Create your workspace'

  // Hero interactive preview state
  const [heroPlatform, setHeroPlatform] = useState<'linkedin' | 'instagram'>('linkedin')

  // Workflow slides state
  const [activeWorkflowSlide, setActiveWorkflowSlide] = useState(0)

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0)

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index)
  }

  // Support & Question Form State
  const [supportForm, setSupportForm] = useState({
    name: '',
    email: '',
    category: 'General Question',
    message: '',
  })
  const [supportSubmitted, setSupportSubmitted] = useState(false)
  const [supportBusy, setSupportBusy] = useState(false)

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!supportForm.name.trim() || !supportForm.email.trim() || !supportForm.message.trim()) return
    setSupportBusy(true)

    const subject = encodeURIComponent(`[Visiofy Studio Support] ${supportForm.category} from ${supportForm.name.trim()}`)
    const body = encodeURIComponent(
      `Name: ${supportForm.name.trim()}\nEmail: ${supportForm.email.trim()}\nTopic: ${supportForm.category}\n\nQuestion / Message:\n${supportForm.message.trim()}\n\n---\nSent from Visiofy Studio Support Form`
    )
    const mailtoUrl = `mailto:visiofytech@gmail.com?subject=${subject}&body=${body}`

    // Trigger user mail client to send to visiofytech@gmail.com
    window.open(mailtoUrl, '_blank')

    setTimeout(() => {
      setSupportBusy(false)
      setSupportSubmitted(true)
    }, 400)
  }

  const handleResetSupport = () => {
    setSupportForm({
      name: '',
      email: '',
      category: 'General Question',
      message: '',
    })
    setSupportSubmitted(false)
  }

  const faqs = [
    {
      q: 'What makes Visiofy Studio different from a standard scheduler?',
      a: 'Traditional schedulers are empty containers—you must write, format, design, and paste content yourself. Visiofy Studio is an intelligent publishing operating system that houses your Brand Brain, ingests your raw ideas or sources, writes platform-native variants for LinkedIn and Instagram, generates visuals, enforces version-controlled approvals, and converts post comments into qualified leads.',
    },
    {
      q: 'What core features are available in Visiofy Studio today?',
      a: 'Visiofy Studio is fully operational! Live features today include: (1) Dual LinkedIn & Instagram AI Composer with live social preview fidelity; (2) Automated Content Series Multi-Post Engine; (3) Brand Brain voice calibration & Story Interviewer; (4) Strict Version-Controlled Approvals with immutable locking; (5) Multi-Platform Interactive Calendar with zero-credit scheduling; (6) Engagement Hub for comment triage, AI replies, and lead capture; and (7) Unified Performance Analytics.',
    },
    {
      q: 'Do I get charged credits for scheduling or publishing posts?',
      a: 'Never. Post scheduling, calendar management, approvals, manual editing, and automatic publishing consume 0 credits. Credits are strictly deducted when our AI engines generate drafts (2 credits) or generate standard AI visuals (8 credits).',
    },
    {
      q: 'How does the Immutable Approval gate protect my brand?',
      a: 'Once a post is marked Approved, Visiofy Studio locks that version into an immutable snapshot. If anyone modifies the copy, hashtags, or attachments after approval, the system immediately revokes the approved status and moves the post back to Needs Review, preventing accidental or unauthorized changes from going live.',
    },
    {
      q: 'Can I connect multiple accounts and manage different clients?',
      a: 'Yes. Visiofy Studio is built with multi-tenant workspace architecture. You can switch between independent workspaces for different brands or clients, each maintaining its own Brand Brain, connected accounts, approvals queue, and calendar.',
    },
    {
      q: 'What social networks are supported today and what is on the roadmap?',
      a: 'Visiofy Studio currently supports publishing to LinkedIn (personal profiles & company pages) and Instagram (creator & business accounts) powered by resilient provider adapters (Zernio & Upload Post). Our active roadmap includes X (Twitter), Threads, TikTok, and direct CRM integrations (HubSpot & Salesforce).',
    },
  ]

  return (
    <div className="landing-page">
      {/* Top Banner / Announcement */}
      <div className="landing-announcement">
        <span>
          <Sparkles size={14} className="sparkle-pulse" />
          <strong>Visiofy Studio:</strong> AI Composer, Series Engine, Brand Brain &amp; Engagement Hub are live.
        </span>
        <Link to="/pricing" className="announcement-link">
          Explore Dynamic Cost Builder <ArrowRight size={13} />
        </Link>
      </div>

      {/* Modern Frosted Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link className="landing-brand" to="/" aria-label="Visiofy Studio home">
            <span className="brand-icon">
              <Sparkles size={19} />
            </span>
            <div className="brand-text">
              <strong>visiofy</strong>
              <small>STUDIO</small>
            </div>
          </Link>

          <nav aria-label="Main navigation">
            <a href="#outcomes">Outcomes</a>
            <a href="#features">All Features</a>
            <a href="#how-it-works">How It Works</a>
            <Link to="/pricing">Pricing</Link>
            <a href="#faq">FAQ</a>
            <a href="#support">Support</a>
          </nav>

          <div className="landing-header-actions">
            {!user && (
              <Link className="landing-signin" to="/signin">
                Sign in
              </Link>
            )}
            <Link className="landing-top-cta" to={primaryPath}>
              {user ? 'Open Studio' : 'Start Free'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-kicker">
              <span className="kicker-pulse" /> VISIOFY STUDIO · THE INTELLIGENT SOCIAL ENGINE
            </span>
            <h1>
              Great content needs <em>room to think.</em>
            </h1>
            <p>
              Visiofy Studio transforms raw ideas, interviews, and brand knowledge into high-performing,
              multi-channel posts. Review with immutable approval guardrails, plan on a visual calendar,
              and publish seamlessly to LinkedIn and Instagram.
            </p>

            <div className="landing-hero-actions">
              <Link className="landing-primary" to={primaryPath}>
                {primaryLabel} <ArrowRight size={18} />
              </Link>
              <a className="landing-secondary" href="#how-it-works">
                See How It Works <ChevronRight size={17} />
              </a>
            </div>

            <div className="landing-hero-badges">
              <div className="hero-badge-pill">
                <Check size={14} /> Unlimited 0-Credit Scheduling
              </div>
              <div className="hero-badge-pill">
                <ShieldCheck size={14} /> Immutable Version Control
              </div>
              <div className="hero-badge-pill">
                <Zap size={14} /> Dual LinkedIn &amp; Instagram AI Variants
              </div>
            </div>
          </div>

          {/* Interactive Hero Visual */}
          <div className="landing-visual" aria-label="Interactive Visiofy Studio Workspace Mockup">
            <div className="landing-visual-top">
              <div className="visual-top-left">
                <span className="landing-visual-logo">
                  <Sparkles size={14} /> visiofy studio
                </span>
                <span className="visual-env-tag">WORKSPACE · PROD</span>
              </div>
              <div className="landing-visual-dots">
                <i />
                <i />
                <i />
              </div>
            </div>

            <div className="landing-visual-body">
              <div className="landing-visual-sidebar">
                <span className="active">
                  <Layers3 size={15} /> Composer
                </span>
                <span>
                  <Sparkles size={15} /> Series
                </span>
                <span>
                  <CalendarDays size={15} /> Calendar
                </span>
                <span>
                  <ShieldCheck size={15} /> Approvals
                </span>
                <span>
                  <MessageCircleMore size={15} /> Engage
                </span>
                <span>
                  <BarChart3 size={15} /> Analytics
                </span>
              </div>

              <div className="landing-visual-content">
                <div className="preview-top-toolbar">
                  <div className="preview-status-pill">
                    <span className="dot-green" /> Approved · v1 (Immutable)
                  </div>
                  <div className="preview-platform-switch">
                    <button
                      type="button"
                      className={heroPlatform === 'linkedin' ? 'active' : ''}
                      onClick={() => setHeroPlatform('linkedin')}
                    >
                      <Linkedin size={13} /> LinkedIn
                    </button>
                    <button
                      type="button"
                      className={heroPlatform === 'instagram' ? 'active' : ''}
                      onClick={() => setHeroPlatform('instagram')}
                    >
                      <Instagram size={13} /> Instagram
                    </button>
                  </div>
                </div>

                {heroPlatform === 'linkedin' ? (
                  <div className="hero-mockup-post linkedin-mode">
                    <div className="mockup-author">
                      <div className="mockup-avatar">VS</div>
                      <div>
                        <strong>Alex Morgan</strong>
                        <span>Founder &amp; CEO · 1st</span>
                      </div>
                    </div>
                    <div className="mockup-body-text">
                      <p>
                        Most social media strategies fail because of friction, not lack of ideas.
                      </p>
                      <p>
                        When we designed <strong>Visiofy Studio</strong>, we built an immutable approvals
                        system: write once, tailor variants automatically, and lock versions so zero
                        mistakes reach live production.
                      </p>
                      <span className="mockup-hashtags">#Leadership #SocialPublishing #GrowthEngine</span>
                    </div>
                    <div className="mockup-engagement-bar">
                      <span>👍 142 Likes</span>
                      <span>💬 38 Comments</span>
                      <span>🔄 19 Reposts</span>
                    </div>
                  </div>
                ) : (
                  <div className="hero-mockup-post instagram-mode">
                    <div className="mockup-author">
                      <div className="mockup-avatar ig-gradient">VS</div>
                      <div>
                        <strong>@visiofy.studio</strong>
                        <span>Original Audio</span>
                      </div>
                    </div>
                    <div className="mockup-ig-graphic">
                      <div className="ig-graphic-art">
                        <span className="orbit-ring" />
                        <Sparkles size={28} />
                        <h4>Turn Ideas Into Influence</h4>
                        <small>VISIOFY CREATIVE SUITE</small>
                      </div>
                    </div>
                    <div className="mockup-body-text">
                      <p>
                        <strong>visiofy.studio</strong> Clarity over noise. The calmer way to show up on
                        Instagram with AI-crafted storytelling &amp; automated comment leads.
                      </p>
                      <span className="mockup-hashtags">#CreatorTools #ContentMarketing #InstagramGrowth</span>
                    </div>
                  </div>
                )}

                <div className="landing-visual-footer">
                  <span className="approval-check">
                    <CheckSquare size={13} /> Quality Checklist: 100% Passed
                  </span>
                  <span className="schedule-btn">
                    Scheduled for Thursday, 9:00 AM <Clock size={12} />
                  </span>
                </div>
              </div>
            </div>

            {/* Floating Quick Metric Badges */}
            <div className="landing-floating-card top-float">
              <span className="float-icon">
                <WandSparkles size={14} />
              </span>
              <div>
                <small>AI DRAFT ENGINE</small>
                <strong>2-Second Variant Generation</strong>
              </div>
            </div>

            <div className="landing-floating-card bottom-float">
              <span className="float-icon green">
                <ShieldCheck size={14} />
              </span>
              <div>
                <small>SAFETY GUARANTEE</small>
                <strong>Zero Unapproved Publishes</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Network Strip */}
        <section className="landing-trust-strip" aria-label="Publishing platforms & trust badges">
          <span className="strip-title">NATIVELY INTEGRATED PUBLISHING INFRASTRUCTURE</span>
          <div className="strip-items">
            <div className="strip-item">
              <Linkedin size={20} className="brand-linkedin" />
              <span>LinkedIn Profiles &amp; Pages</span>
            </div>
            <div className="strip-item">
              <Instagram size={20} className="brand-instagram" />
              <span>Instagram Feed &amp; Carousels</span>
            </div>
            <div className="strip-item">
              <Cpu size={19} />
              <span>Resilient Provider Engines (Zernio &amp; Upload Post)</span>
            </div>
            <div className="strip-item">
              <Lock size={19} />
              <span>Enterprise OAuth &amp; Tenancy Isolation</span>
            </div>
          </div>
        </section>

        {/* Section: What You Can Achieve (Outcomes & Value Proposition) */}
        <section className="landing-section" id="outcomes">
          <div className="landing-section-head">
            <span className="landing-kicker">REAL-WORLD IMPACT</span>
            <h2>What you can achieve with Visiofy Studio.</h2>
            <p>
              Replace disconnected tools, chaotic spreadsheets, and writer&apos;s block with an
              intelligent operating system tailored to your exact publishing objectives.
            </p>
          </div>

          <div className="outcomes-grid">
            <div className="outcome-card">
              <div className="outcome-header">
                <div className="outcome-badge-icon purple">
                  <Target size={22} />
                </div>
                <span className="outcome-audience">FOR FOUNDERS &amp; EXECUTIVES</span>
              </div>
              <h3>Build high-impact authority in 15 minutes a week.</h3>
              <p>
                Eliminate the $5,000/mo ghostwriter expense. Use the Story Interviewer to speak your
                thoughts or drop a voice memo; Visiofy Studio extracts key lessons and writes authentic,
                deeply grounded leadership posts.
              </p>
              <ul className="outcome-points">
                <li>
                  <Check size={15} /> 10x faster personal branding workflow
                </li>
                <li>
                  <Check size={15} /> Authentic tone preserved through Brand Brain
                </li>
                <li>
                  <Check size={15} /> Direct pipeline generation via inbound engagement
                </li>
              </ul>
            </div>

            <div className="outcome-card">
              <div className="outcome-header">
                <div className="outcome-badge-icon blue">
                  <Zap size={22} />
                </div>
                <span className="outcome-audience">FOR CONTENT CREATORS &amp; SOLOPRENEURS</span>
              </div>
              <h3>Multiply creative leverage with zero burnout.</h3>
              <p>
                Turn 1 good article, video transcript, or newsletter into a 5-day cohesive social series.
                Never stare at a blank cursor again—let the AI Composer handle platform adaptations
                while you focus on great thinking.
              </p>
              <ul className="outcome-points">
                <li>
                  <Check size={15} /> 1-brief multi-post campaign cascades
                </li>
                <li>
                  <Check size={15} /> Separate LinkedIn &amp; Instagram hooks automatically
                </li>
                <li>
                  <Check size={15} /> Standard AI images generated inside your composer
                </li>
              </ul>
            </div>

            <div className="outcome-card">
              <div className="outcome-header">
                <div className="outcome-badge-icon green">
                  <ShieldCheck size={22} />
                </div>
                <span className="outcome-audience">FOR MARKETING TEAMS &amp; AGENCIES</span>
              </div>
              <h3>Eliminate publishing anxiety and accidental errors.</h3>
              <p>
                Strict immutable versioning means once a client or manager approves a post, no accidental
                keystroke or late edit can go live without re-approval. Keep multi-client workspaces
                isolated and secure.
              </p>
              <ul className="outcome-points">
                <li>
                  <Check size={15} /> Immutable approval snapshots before publish
                </li>
                <li>
                  <Check size={15} /> Automated pre-flight compliance &amp; link checklists
                </li>
                <li>
                  <Check size={15} /> Multi-tenant workspace switching for agencies
                </li>
              </ul>
            </div>

            <div className="outcome-card">
              <div className="outcome-header">
                <div className="outcome-badge-icon orange">
                  <TrendingUp size={22} />
                </div>
                <span className="outcome-audience">FOR GROWTH &amp; B2B SALES</span>
              </div>
              <h3>Convert social engagement into measurable revenue.</h3>
              <p>
                Social publishing shouldn&apos;t end when a post goes live. The Engagement Hub monitors
                every comment, flags buying intent and positive sentiment, drafts AI responses, and
                organizes warm prospects into high-converting leads.
              </p>
              <ul className="outcome-points">
                <li>
                  <Check size={15} /> Automated comment triage &amp; sentiment analysis
                </li>
                <li>
                  <Check size={15} /> 1-click context-aware AI reply generation
                </li>
                <li>
                  <Check size={15} /> Direct lead qualification and exportable data
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section: Comprehensive Feature Grid (All Features) */}
        <section className="landing-section dark-alt" id="features">
          <div className="landing-section-head">
            <span className="landing-kicker">COMPLETE PLATFORM ARSENAL</span>
            <h2>Every feature you need to dominate social.</h2>
            <p>
              A unified powerhouse integrating creation, verification, scheduling, and community
              intelligence into one frictionless flow.
            </p>
          </div>

          <div className="features-grid-complete">
            <article className="feature-box">
              <div className="feature-box-top">
                <span className="feature-icon purple">
                  <WandSparkles size={22} />
                </span>
                <span className="feature-tag">CREATION ENGINE</span>
              </div>
              <h3>AI Social Composer</h3>
              <p>
                Transform any prompt, note, or source into channel-perfect copy. Tailors hooks, formatting,
                line breaks, and hashtags specifically for LinkedIn and Instagram with live realistic previews.
              </p>
              <div className="feature-sublist">
                <span>• Hook variation generator</span>
                <span>• Tone switcher (Bold, Story, Punchy)</span>
                <span>• Realistic mobile &amp; desktop mockups</span>
              </div>
            </article>

            <article className="feature-box">
              <div className="feature-box-top">
                <span className="feature-icon blue">
                  <Repeat2 size={22} />
                </span>
                <span className="feature-tag">CAMPAIGN SUITE</span>
              </div>
              <h3>Content Series Engine</h3>
              <p>
                Give one overarching brief, case study, or theme and generate a sequenced multi-part
                series. Keeps narrative momentum across 3 to 7 scheduled days with suggested publishing times.
              </p>
              <div className="feature-sublist">
                <span>• 1-brief campaign generator</span>
                <span>• Episodic pacing &amp; narrative arcs</span>
                <span>• Batch approval &amp; queue insertion</span>
              </div>
            </article>

            <article className="feature-box">
              <div className="feature-box-top">
                <span className="feature-icon green">
                  <BookOpen size={22} />
                </span>
                <span className="feature-tag">KNOWLEDGE BASE</span>
              </div>
              <h3>Brand Brain &amp; Voice Hub</h3>
              <p>
                Teach the AI your exact brand persona, target audience, core values, and forbidden buzzwords.
                Every generated piece matches your personal voice without sounding synthetic.
              </p>
              <div className="feature-sublist">
                <span>• Company voice pillars &amp; tone</span>
                <span>• Persona &amp; audience calibration</span>
                <span>• Forbidden words &amp; style guardrails</span>
              </div>
            </article>

            <article className="feature-box">
              <div className="feature-box-top">
                <span className="feature-icon orange">
                  <Bot size={22} />
                </span>
                <span className="feature-tag">INTERVIEW ENGINE</span>
              </div>
              <h3>Story Interviewer</h3>
              <p>
                Extract deep founder wisdom and customer case studies via interactive Q&amp;A prompts.
                Converts genuine spoken anecdotes into captivating, high-performing social narratives.
              </p>
              <div className="feature-sublist">
                <span>• Guided story extraction prompts</span>
                <span>• Anecdote &amp; lesson identification</span>
                <span>• Zero-friction voice-to-text drafting</span>
              </div>
            </article>

            <article className="feature-box">
              <div className="feature-box-top">
                <span className="feature-icon purple">
                  <FileText size={22} />
                </span>
                <span className="feature-tag">GROUNDED CONTEXT</span>
              </div>
              <h3>Source Library &amp; Ingestion</h3>
              <p>
                Save articles, URLs, research papers, and team notes into your knowledge vault. Ground social
                posts directly in verified context to eliminate AI hallucinations and amplify authority.
              </p>
              <div className="feature-sublist">
                <span>• Ingest URLs &amp; raw research</span>
                <span>• Fact-grounded generation</span>
                <span>• Reusable evergreen material</span>
              </div>
            </article>

            <article className="feature-box">
              <div className="feature-box-top">
                <span className="feature-icon red">
                  <ShieldCheck size={22} />
                </span>
                <span className="feature-tag">GOVERNANCE &amp; SAFETY</span>
              </div>
              <h3>Version-Controlled Approvals</h3>
              <p>
                Move posts through an enterprise state machine: Draft → Needs Review → Approved → Scheduled.
                Approvals freeze an immutable version; any subsequent edit immediately re-opens the review.
              </p>
              <div className="feature-sublist">
                <span>• Immutable version locking</span>
                <span>• Automated pre-flight checklist</span>
                <span>• Team sign-off workflow</span>
              </div>
            </article>

            <article className="feature-box">
              <div className="feature-box-top">
                <span className="feature-icon blue">
                  <CalendarDays size={22} />
                </span>
                <span className="feature-tag">VISUAL SCHEDULING</span>
              </div>
              <h3>Unified Content Calendar</h3>
              <p>
                Plan your multi-channel publishing schedule on a beautiful drag-and-drop calendar. Filter
                by platform, view cadence gaps, and manage publishing queues with 0 credit consumption.
              </p>
              <div className="feature-sublist">
                <span>• Drag-and-drop rescheduling</span>
                <span>• Channel status color-coding</span>
                <span>• 100% free unlimited scheduling</span>
              </div>
            </article>

            <article className="feature-box">
              <div className="feature-box-top">
                <span className="feature-icon green">
                  <MessageCircleMore size={22} />
                </span>
                <span className="feature-tag">REVENUE &amp; PIPELINE</span>
              </div>
              <h3>Engagement Hub &amp; Leads</h3>
              <p>
                Turn comments into conversations and conversations into customers. Centralizes inbound
                comments, detects buyer sentiment, generates AI replies, and flags qualified business leads.
              </p>
              <div className="feature-sublist">
                <span>• Centralized comment stream</span>
                <span>• Context-aware AI reply generator</span>
                <span>• Sentiment detection &amp; lead capture</span>
              </div>
            </article>
          </div>
        </section>

        {/* Section: How It Works — Interactive Feature Slides */}
        <section className="landing-workflow" id="how-it-works">
          <div className="landing-workflow-header">
            <span className="landing-kicker">INTERACTIVE WALKTHROUGH</span>
            <h2>How Visiofy Studio Works</h2>
            <p>
              Follow how raw thoughts transform into calibrated, scheduled, revenue-generating social posts across each core capability.
            </p>
          </div>

          {/* Slide Navigation Tabs */}
          <div className="workflow-tab-bar" role="tablist" aria-label="Feature walkthrough slides">
            {workflowSlides.map((slide, idx) => (
              <button
                key={slide.step}
                type="button"
                role="tab"
                aria-selected={activeWorkflowSlide === idx}
                className={`workflow-tab-btn ${activeWorkflowSlide === idx ? 'active' : ''}`}
                onClick={() => setActiveWorkflowSlide(idx)}
              >
                <span className="workflow-tab-num">{slide.step}</span>
                <span className="workflow-tab-label">{slide.tabLabel}</span>
              </button>
            ))}
          </div>

          {/* Active Slide Display */}
          <div className="workflow-slide-card">
            <div className="workflow-slide-content">
              <div className="workflow-slide-badge">
                <Sparkles size={13} /> {workflowSlides[activeWorkflowSlide].badge}
              </div>
              <h3 className="workflow-slide-title">{workflowSlides[activeWorkflowSlide].featureName}</h3>
              <h4 className="workflow-slide-subtitle">{workflowSlides[activeWorkflowSlide].title}</h4>
              <p className="workflow-slide-desc">{workflowSlides[activeWorkflowSlide].description}</p>

              <div className="workflow-slide-bullets">
                {workflowSlides[activeWorkflowSlide].bullets.map((bullet, i) => (
                  <div key={i} className="workflow-bullet-item">
                    <span className="bullet-check">
                      <Check size={14} />
                    </span>
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              {/* Slide Controls (Prev / Next & Dots) */}
              <div className="workflow-slide-controls">
                <button
                  type="button"
                  className="workflow-ctrl-btn"
                  disabled={activeWorkflowSlide === 0}
                  onClick={() => setActiveWorkflowSlide((prev) => Math.max(0, prev - 1))}
                  aria-label="Previous feature slide"
                >
                  <ChevronLeft size={16} /> Previous
                </button>

                <div className="workflow-dots">
                  {workflowSlides.map((_, dotIdx) => (
                    <button
                      key={dotIdx}
                      type="button"
                      className={`workflow-dot ${activeWorkflowSlide === dotIdx ? 'active' : ''}`}
                      onClick={() => setActiveWorkflowSlide(dotIdx)}
                      aria-label={`Go to slide ${dotIdx + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="workflow-ctrl-btn"
                  disabled={activeWorkflowSlide === workflowSlides.length - 1}
                  onClick={() => setActiveWorkflowSlide((prev) => Math.min(workflowSlides.length - 1, prev + 1))}
                  aria-label="Next feature slide"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Slide Interactive Visual Simulation */}
            <div className="workflow-slide-mockup">
              {activeWorkflowSlide === 0 && (
                <div className="mockup-frame mockup-brain">
                  <div className="mockup-header-bar">
                    <span className="mockup-status-dot green" />
                    <strong>Brand Brain · Active Calibration</strong>
                    <span className="mockup-pill-badge">Voice Engine</span>
                  </div>
                  <div className="mockup-body">
                    <div className="mockup-chip-row">
                      <small>CALIBRATED PILLARS</small>
                      <div className="mockup-tags">
                        <span className="tag-pill active">Thought Leadership</span>
                        <span className="tag-pill active">Actionable Data</span>
                        <span className="tag-pill active">Zero Fluff</span>
                      </div>
                    </div>
                    <div className="mockup-forbidden-box">
                      <small>STRICTLY BLOCKED BUZZWORDS</small>
                      <p>&ldquo;synergy&rdquo;, &ldquo;10x rockstar&rdquo;, &ldquo;game-changer&rdquo;, &ldquo;guru&rdquo;</p>
                    </div>
                    <div className="mockup-source-ingest">
                      <div className="mockup-source-icon">
                        <FileText size={16} />
                      </div>
                      <div className="mockup-source-info">
                        <strong>Source Ingested: 2026_growth_benchmark.pdf</strong>
                        <small>Extracted 4 factual thesis points for social grounding</small>
                      </div>
                    </div>
                    <div className="mockup-interview-bubble">
                      <div className="bubble-speaker">
                        <Bot size={14} /> Story Interviewer
                      </div>
                      <p>&ldquo;What was the counter-intuitive lesson from your Q3 expansion?&rdquo;</p>
                      <div className="bubble-reply">Founder voice note transcribed into 3 high-converting post angles.</div>
                    </div>
                  </div>
                </div>
              )}

              {activeWorkflowSlide === 1 && (
                <div className="mockup-frame mockup-composer">
                  <div className="mockup-header-bar">
                    <span className="mockup-status-dot blue" />
                    <strong>Dual AI Composer Fidelity</strong>
                    <span className="mockup-pill-badge">LinkedIn &amp; Instagram</span>
                  </div>
                  <div className="mockup-body">
                    <div className="mockup-hook-banner">
                      <Sparkles size={14} />
                      <span>Psychological Hook: <strong>Curiosity Gap (Score: 98/100)</strong></span>
                    </div>
                    <div className="mockup-preview-split">
                      <div className="preview-pane linkedin">
                        <div className="pane-tag"><Linkedin size={12} /> LinkedIn Variant</div>
                        <p className="pane-lead">90% of founders fail at retention for one simple reason.</p>
                        <p className="pane-sub">They celebrate the signup instead of the second-week habit.</p>
                        <span className="pane-more">...see more</span>
                        <div className="pane-hashtags">#SaaS #ProductStrategy #Growth</div>
                      </div>
                      <div className="preview-pane instagram">
                        <div className="pane-tag"><Instagram size={12} /> Instagram Variant</div>
                        <div className="mockup-insta-art">
                          <Sparkles size={20} />
                          <span>4:5 AI Visual Asset Generated</span>
                        </div>
                        <p className="pane-caption">Retention &gt; Acquisition. Here is the 3-step breakdown 👇</p>
                      </div>
                    </div>
                    <div className="mockup-metric-footer">
                      <span>⚡ Generation time: <strong>2.1s</strong></span>
                      <span>🛡️ Zero hallucinations grounded</span>
                    </div>
                  </div>
                </div>
              )}

              {activeWorkflowSlide === 2 && (
                <div className="mockup-frame mockup-series">
                  <div className="mockup-header-bar">
                    <span className="mockup-status-dot purple" />
                    <strong>Content Series Campaign Engine</strong>
                    <span className="mockup-pill-badge">3-Part Episodic Arc</span>
                  </div>
                  <div className="mockup-body">
                    <div className="mockup-series-header">
                      <strong>Campaign: The 2026 Founder Playbook</strong>
                      <span className="campaign-status">3 of 3 Posts Ready</span>
                    </div>
                    <div className="mockup-series-chain">
                      <div className="series-node">
                        <div className="node-num">01</div>
                        <div className="node-detail">
                          <strong>Part 1 · The Hidden Bottleneck</strong>
                          <small>Scheduled: Monday, 9:00 AM · LinkedIn &amp; IG</small>
                        </div>
                        <span className="node-state done">Drafted</span>
                      </div>
                      <div className="series-node">
                        <div className="node-num">02</div>
                        <div className="node-detail">
                          <strong>Part 2 · The Tactical Breakdown</strong>
                          <small>Scheduled: Wednesday, 9:00 AM · Carousel</small>
                        </div>
                        <span className="node-state done">Drafted</span>
                      </div>
                      <div className="series-node">
                        <div className="node-num">03</div>
                        <div className="node-detail">
                          <strong>Part 3 · The Actionable Checklist</strong>
                          <small>Scheduled: Friday, 9:00 AM · High-CTA Post</small>
                        </div>
                        <span className="node-state done">Drafted</span>
                      </div>
                    </div>
                    <div className="mockup-series-footer">
                      <span>Episodic Arc: <strong>Teaser → Breakdown → Playbook</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {activeWorkflowSlide === 3 && (
                <div className="mockup-frame mockup-approvals">
                  <div className="mockup-header-bar">
                    <span className="mockup-status-dot green" />
                    <strong>Approvals Gate &amp; Calendar</strong>
                    <span className="mockup-pill-badge">Zero Unapproved Publishes</span>
                  </div>
                  <div className="mockup-body">
                    <div className="mockup-lock-card">
                      <div className="lock-icon">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <strong>Version 1.0 Locked &amp; Immutable</strong>
                        <small>Approved by Team Lead · Any modification revokes status</small>
                      </div>
                    </div>
                    <div className="mockup-checklist-grid">
                      <div className="check-item passed">
                        <Check size={13} /> Hook character limit verified
                      </div>
                      <div className="check-item passed">
                        <Check size={13} /> Image aspect ratio 4:5 optimized
                      </div>
                      <div className="check-item passed">
                        <Check size={13} /> Brand voice guidelines 100% matched
                      </div>
                      <div className="check-item passed">
                        <Check size={13} /> Destination link validity passed
                      </div>
                    </div>
                    <div className="mockup-calendar-slot">
                      <CalendarDays size={16} />
                      <div>
                        <strong>Queued on Visual Calendar: Thursday 9:00 AM</strong>
                        <small>Consumes 0 Credits · Automated Publishing via Resilient Celery</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeWorkflowSlide === 4 && (
                <div className="mockup-frame mockup-engage">
                  <div className="mockup-header-bar">
                    <span className="mockup-status-dot orange" />
                    <strong>Engagement Hub &amp; Lead Capture</strong>
                    <span className="mockup-pill-badge">Revenue Pipeline</span>
                  </div>
                  <div className="mockup-body">
                    <div className="mockup-inbox-item">
                      <div className="inbox-avatar">SJ</div>
                      <div className="inbox-content">
                        <div className="inbox-author">
                          <strong>Sarah Jenkins</strong>
                          <span className="lead-tag high">🔥 High-Intent Buyer Lead</span>
                        </div>
                        <p className="inbox-comment">
                          &ldquo;Does Visiofy Studio support multi-tenant workspaces for our 12-person agency? Looking to switch this month.&rdquo;
                        </p>
                      </div>
                    </div>
                    <div className="mockup-ai-reply-box">
                      <div className="ai-reply-head">
                        <Sparkles size={12} /> Suggested AI Reply (Calibrated Brand Voice)
                      </div>
                      <p className="ai-reply-text">
                        &ldquo;Hi Sarah! Yes, Visiofy Studio features isolated multi-tenant workspaces with individual Brand Brains for each client. Would love to show your agency a quick walkthrough!&rdquo;
                      </p>
                      <div className="ai-reply-actions">
                        <span className="mockup-action-pill primary">Approve &amp; Send Reply</span>
                        <span className="mockup-action-pill secondary">Export to Pipeline</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section: Planned Pricing & Dynamic Builder */}
        <section className="landing-section landing-pricing" id="pricing">
          <div className="landing-section-head">
            <span className="landing-kicker">TRANSPARENT VALUE</span>
            <h2>Pay for the creative work you use.</h2>
            <p>
              Every plan includes AI post and series creation, planning, approvals, and analytics. Credits cover
              AI work; scheduling and publishing use no credits.
            </p>
          </div>

          <div className="landing-pricing-grid">
            {catalog?.plans.map((plan) => {
              const presentation = planPresentation[plan.id]
              const featured = plan.id === 'advance'
              return (
              <article className={featured ? 'featured' : ''} key={plan.id}>
                {featured && <span className="landing-plan-badge">MOST POPULAR</span>}
                <div className="landing-plan-name">{plan.name}</div>
                <p>{presentation.description}</p>
                <div className="landing-plan-price">
                  <strong>${plan.price}</strong>
                  <span>
                    / month
                    <br />
                    plus applicable tax
                  </span>
                </div>
                <div className="landing-plan-divider" />
                <ul>
                  <li>
                    <Check size={17} /> {plan.credits} AI credits each month
                  </li>
                  <li>
                    <Check size={17} /> {plan.connections} connected {plan.connections === 1 ? 'account' : 'accounts'}
                  </li>
                  <li>
                    <Check size={17} /> {presentation.examples}
                  </li>
                  <li>
                    <Check size={17} /> AI post &amp; series creation
                  </li>
                  <li>
                    <Check size={17} /> Calendar, approvals &amp; analytics
                  </li>
                  <li>
                    <Check size={17} /> 100% Unlimited scheduling &amp; publishing
                  </li>
                </ul>
                <Link
                  className={featured ? 'landing-plan-cta featured' : 'landing-plan-cta'}
                  to={primaryPath}
                >
                  {presentation.cta} <ArrowRight size={16} />
                </Link>
              </article>
            )})}
            {pricingError && <p role="alert">{pricingError}</p>}
          </div>

          <div className="landing-builder-banner">
            <div className="landing-builder-banner-copy">
              <span className="landing-kicker">
                <span /> DYNAMIC COST MANAGER &amp; BUILDER
              </span>
              <h3>Need more connections or credits? Calculate your exact plan</h3>
              <p>
                Customize social accounts, monthly automated post credits, and unlock the Engage automation
                suite with real-time dynamic pricing and complete feature breakdowns.
              </p>
            </div>
            <Link to="/pricing" className="landing-primary" style={{ whiteSpace: 'nowrap' }}>
              Open Dynamic Cost Builder <ArrowRight size={17} />
            </Link>
          </div>

          <p className="landing-pricing-note">
            Credit metering is active. A platform draft uses {catalog?.credit_costs.draft ?? '...'} credits and
            an AI image uses {catalog?.credit_costs.image ?? '...'}; series creation uses the same rates per draft.
            Secure payment checkout is enabled only when a payment provider is configured. Unlimited post
            scheduling consumes 0 credits.
          </p>
        </section>

        {/* Section: Frequently Asked Questions */}
        <section className="landing-section dark-alt" id="faq">
          <div className="landing-section-head">
            <span className="landing-kicker">GOT QUESTIONS?</span>
            <h2>Frequently Asked Questions</h2>
            <p>Everything you need to know about Visiofy Studio, our MVP, and how we compare.</p>
          </div>

          <div className="faq-container">
            {faqs.map((faq, index) => {
              const isOpen = expandedFaq === index
              return (
                <div
                  key={faq.q}
                  className={`faq-item ${isOpen ? 'open' : ''}`}
                  onClick={() => toggleFaq(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleFaq(index)
                  }}
                  aria-expanded={isOpen}
                >
                  <div className="faq-question">
                    <h4>{faq.q}</h4>
                    <span className="faq-icon-wrap">
                      <ChevronDown size={18} className={`chevron-icon ${isOpen ? 'rotated' : ''}`} />
                    </span>
                  </div>
                  {isOpen && (
                    <div className="faq-answer">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Section: Support & Questions Form */}
        <section className="landing-section" id="support">
          <div className="landing-section-head">
            <span className="landing-kicker">
              <Mail size={13} /> DIRECT ASSISTANCE
            </span>
            <h2>Have a question? We&apos;re here to help.</h2>
            <p>
              Send us any question about Visiofy Studio, feature requests, or custom workspace setups.
              All messages are delivered straight to <strong>visiofytech@gmail.com</strong>.
            </p>
          </div>

          <div className="support-card-container">
            <div className="support-form-side">
              {supportSubmitted ? (
                <div className="support-success-box">
                  <div className="success-icon-wrap">
                    <Check size={28} />
                  </div>
                  <h4>Message Initiated!</h4>
                  <p>
                    Thank you, <strong>{supportForm.name}</strong>. Your message to{' '}
                    <strong>visiofytech@gmail.com</strong> has been initiated via your mail client.
                  </p>
                  <p className="success-subtext">
                    You can also email us directly at{' '}
                    <a href="mailto:visiofytech@gmail.com" className="support-email-link">
                      visiofytech@gmail.com
                    </a>
                  </p>
                  <button type="button" className="landing-primary support-reset-btn" onClick={handleResetSupport}>
                    Send Another Question <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <form className="support-form" onSubmit={handleSupportSubmit}>
                  <div className="form-row">
                    <label>
                      <span>Your Name</span>
                      <input
                        type="text"
                        placeholder="Alex Morgan"
                        value={supportForm.name}
                        onChange={(e) => setSupportForm({ ...supportForm, name: e.target.value })}
                        required
                      />
                    </label>
                    <label>
                      <span>Your Email</span>
                      <input
                        type="email"
                        placeholder="alex@example.com"
                        value={supportForm.email}
                        onChange={(e) => setSupportForm({ ...supportForm, email: e.target.value })}
                        required
                      />
                    </label>
                  </div>

                  <label>
                    <span>Topic / Category</span>
                    <select
                      value={supportForm.category}
                      onChange={(e) => setSupportForm({ ...supportForm, category: e.target.value })}
                    >
                      <option value="General Question">General Question</option>
                      <option value="Features &amp; Capabilities">Features &amp; Capabilities</option>
                      <option value="Social Account Connections">Social Account Connections</option>
                      <option value="Custom Plan / Billing">Custom Plan / Billing</option>
                      <option value="Technical Support">Technical Support</option>
                    </select>
                  </label>

                  <label>
                    <span>Your Question or Message</span>
                    <textarea
                      rows={5}
                      placeholder="Ask anything about Visiofy Studio, social publishing, or team setups..."
                      value={supportForm.message}
                      onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })}
                      required
                    />
                  </label>

                  <div className="support-form-actions">
                    <button type="submit" className="landing-primary support-submit-btn" disabled={supportBusy}>
                      {supportBusy ? 'Preparing...' : 'Send Message to visiofytech@gmail.com'} <Send size={15} />
                    </button>
                    <small className="support-form-hint">
                      Delivered directly to visiofytech@gmail.com
                    </small>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Closing High-Impact CTA */}
        <section className="landing-close">
          <div className="landing-close-content">
            <span className="landing-kicker">MAKE SPACE FOR WHAT MATTERS</span>
            <h2>Your next good idea deserves to be shared.</h2>
            <p>
              Experience the calmer, intelligent social studio. Turn raw thoughts into published authority
              with Visiofy Studio today.
            </p>
            <div className="close-cta-group">
              <Link className="landing-primary hero-btn" to={primaryPath}>
                {primaryLabel} <ArrowRight size={18} />
              </Link>
              <Link className="landing-secondary light-theme" to="/pricing">
                View Pricing &amp; Plans <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Modern Footer */}
      <footer className="landing-footer">
        <div className="footer-top">
          <div className="footer-brand-col">
            <Link className="landing-brand" to="/">
              <span className="brand-icon">
                <Sparkles size={17} />
              </span>
              <div className="brand-text">
                <strong>visiofy</strong>
                <small>STUDIO</small>
              </div>
            </Link>
            <p className="footer-tagline">
              The intelligent social publishing operating system. Grounded in your voice, protected by
              immutable approvals.
            </p>
            <div className="footer-system-status">
              <span className="status-dot-pulse" /> All Systems Operational · v1.2
            </div>
          </div>

          <div className="footer-nav-col">
            <h5>Product</h5>
            <a href="#outcomes">Outcomes</a>
            <a href="#features">All Features</a>
            <a href="#how-it-works">How It Works</a>
          </div>

          <div className="footer-nav-col">
            <h5>Pricing &amp; Tools</h5>
            <Link to="/pricing">Planned Pricing</Link>
            <Link to="/pricing">Dynamic Cost Builder</Link>
            <a href="#faq">FAQ</a>
            <a href="#support">Direct Support</a>
          </div>

          <div className="footer-nav-col">
            <h5>Access</h5>
            <Link to="/signin">Sign In</Link>
            <Link to="/signup">Create Account</Link>
            <Link to="/content">Open Studio</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Visiofy Studio. All rights reserved.</p>
          <div className="footer-meta-links">
            <a href="#features">Privacy Policy</a>
            <a href="#features">Terms of Service</a>
            <a href="#features">Security &amp; Tenancy</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
