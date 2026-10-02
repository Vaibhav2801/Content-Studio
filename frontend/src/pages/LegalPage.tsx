import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, FileText, ReceiptText, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QuilltapLogo } from '../components/branding/QuilltapLogo'
import './LegalPage.css'
import './QuilltapTheme.css'

const EFFECTIVE_DATE = 'October 2, 2026'
const SUPPORT_EMAIL = 'visiofytech@gmail.com'

type LegalKind = 'privacy' | 'terms' | 'cancellation'

type LegalSection = {
  id: string
  title: string
  content: ReactNode
}

type LegalDocument = {
  eyebrow: string
  title: string
  summary: string
  icon: typeof ShieldCheck
  sections: LegalSection[]
}

const privacySections: LegalSection[] = [
  {
    id: 'scope',
    title: '1. Scope and who is responsible',
    content: <>
      <p>This Privacy Policy explains how Quilltap collects, uses, discloses, stores, and protects personal data when you visit our website, create an account, use a workspace, contact support, or connect a third-party service.</p>
      <p>The Quilltap service is operated by the person or entity identified as the supplier on your invoice, order form, or other commercial agreement (referred to as “Quilltap”, “we”, “us”, or “our”). That operator is the controller or data fiduciary for the personal data described here unless an agreement states otherwise. Privacy questions and rights requests can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </>,
  },
  {
    id: 'data-we-collect',
    title: '2. Personal data we collect',
    content: <>
      <p>Depending on how you use Quilltap, we collect the following categories of data:</p>
      <ul>
        <li><strong>Account and workspace data:</strong> name, email address, password hash, session information, workspace name, membership, role, preferences, and timezone.</li>
        <li><strong>Content and brand data:</strong> drafts, captions, prompts, instructions, uploaded media and documents, source URLs, notes, interview responses, brand voice settings, approval history, schedules, and publishing records.</li>
        <li><strong>Connected-channel data:</strong> social-network and provider account identifiers, display names, account type, connection status, authentication grants or tokens, publishing results, and webhook events. We use tokens to provide requested connections and do not display them back to users.</li>
        <li><strong>Engagement and analytics data:</strong> comments, reactions, public profile details associated with engagement, performance metrics, lead or sentiment labels, reply drafts, and automation settings that you choose to use.</li>
        <li><strong>Billing and transaction data:</strong> selected products, subscription status, billing name and email, invoice details, payment reference, credit allocations and usage, and tax or accounting records. A live payment processor may collect payment-card details directly; Quilltap should not receive full card numbers from that processor.</li>
        <li><strong>Support data:</strong> your name, email address, support category, message, and related correspondence.</li>
        <li><strong>Technical and security data:</strong> IP address, browser and device information, timestamps, request and error logs, session and CSRF cookies, and security or audit events.</li>
      </ul>
    </>,
  },
  {
    id: 'sources',
    title: '3. Where data comes from',
    content: <p>We receive data from you and other workspace members; from the social networks and publishing providers you connect; from payment, hosting, email, and support providers; and from public webpages or files that you ask Quilltap to process. A workspace administrator may provide information about other members and is responsible for having authority to do so.</p>,
  },
  {
    id: 'use',
    title: '4. Why we use personal data',
    content: <>
      <p>We use personal data to provide and secure accounts; create and manage workspaces; generate, store, review, schedule, and publish content; connect social channels; provide analytics and engagement tools; process transactions and credits; respond to support; prevent abuse; comply with law; and improve the reliability and usability of the service.</p>
      <p>Where applicable law requires a legal basis, we rely on performance of our contract, your consent, compliance with legal obligations, and our legitimate interests in operating, securing, supporting, and improving Quilltap. Where we rely on consent, you may withdraw it, but that does not affect processing already completed or processing required on another lawful basis.</p>
    </>,
  },
  {
    id: 'ai-and-sharing',
    title: '5. AI processing and when we share data',
    content: <>
      <p>When you request an AI feature, the prompt, relevant workspace instructions, source material, and requested output parameters may be sent to the AI provider configured for that feature. Depending on the deployment, providers may include Google Gemini, OpenAI, OpenRouter, Groq, Cerebras, or Cloudflare. Do not submit information to an AI feature unless you have the right to process and disclose it.</p>
      <p>We also disclose data as needed to:</p>
      <ul>
        <li>social networks and publishing intermediaries, including LinkedIn, Instagram, Zernio, or Upload Post, when you connect an account or direct us to publish;</li>
        <li>hosting, storage, email, security, support, analytics, and payment processors acting for us;</li>
        <li>workspace owners and members according to their roles;</li>
        <li>professional advisers, a buyer or successor in a corporate transaction, or authorities where required to protect rights, safety, the service, or comply with law.</li>
      </ul>
      <p>We do not sell personal data or share it for cross-context behavioural advertising. If that practice changes, we will update this Policy and provide any required choices before doing so.</p>
    </>,
  },
  {
    id: 'cookies',
    title: '6. Cookies and similar technologies',
    content: <p>Quilltap currently uses cookies and browser storage that are necessary for sign-in, session continuity, CSRF protection, security, preferences, and unfinished draft recovery. We do not currently use advertising cookies. If we introduce optional analytics or advertising technologies, we will provide notice and consent controls where required.</p>,
  },
  {
    id: 'retention',
    title: '7. Retention, export, and deletion',
    content: <>
      <p>We retain data while your account or workspace is active and as reasonably necessary to provide the service, resolve disputes, enforce agreements, maintain security, and meet tax, accounting, or legal duties. Retention periods differ by record type.</p>
      <p>Workspace administrators can export supported workspace data. A workspace owner can use the deletion control in Settings to delete Quilltap content such as posts, sources, connections, metrics, engagement records, interviews, publishing jobs, onboarding information, and workspace settings. This workspace-content deletion does not itself delete the user account, workspace membership, invoices, subscription and credit ledgers, fraud or security records, or information we must retain by law. Residual copies may remain in protected backups until their normal rotation, and providers may retain data under their own policies.</p>
      <p>To request account deletion or deletion beyond the in-product workspace tool, email <a href={`mailto:${SUPPORT_EMAIL}?subject=Quilltap%20privacy%20request`}>{SUPPORT_EMAIL}</a>. We may verify your identity and authority before acting.</p>
    </>,
  },
  {
    id: 'security',
    title: '8. Security',
    content: <p>We use reasonable administrative, technical, and organisational safeguards designed to protect personal data, including access controls, workspace scoping, secret redaction, secure session controls, and encryption for supported connection credentials. No online service can guarantee absolute security. You are responsible for using a strong password, protecting your devices, limiting workspace access, and promptly reporting suspected misuse.</p>,
  },
  {
    id: 'international',
    title: '9. International processing',
    content: <p>Quilltap and its providers may process data in countries other than yours. Where required, we use an approved transfer mechanism or other lawful safeguards. Some connected services process data under their own international-transfer terms.</p>,
  },
  {
    id: 'rights',
    title: '10. Your privacy rights',
    content: <>
      <p>Subject to local law, you may have rights to access or obtain a summary of your data, correct or update it, obtain a portable copy, request deletion, withdraw consent, object to or restrict certain processing, and complain to a privacy regulator. You may also have a right to identify processors or recipients, nominate another person to exercise rights where law permits, and appeal a denied request.</p>
      <p>Use the export and deletion tools in Settings or email <a href={`mailto:${SUPPORT_EMAIL}?subject=Quilltap%20privacy%20rights%20request`}>{SUPPORT_EMAIL}</a>. Describe the account and right involved. We will respond within the period required by applicable law and explain if an exception applies. You may first use our grievance process by emailing the same address, without giving up a right to contact the competent authority.</p>
    </>,
  },
  {
    id: 'children',
    title: '11. Children',
    content: <p>Quilltap is a business and creator tool and is not directed to children. You must be at least 18 years old, or the age of legal majority where you live, to create an account. If you believe a child has provided personal data, contact us so we can investigate and take appropriate action.</p>,
  },
  {
    id: 'changes-contact',
    title: '12. Changes and contact',
    content: <p>We may update this Policy when the service or law changes. We will post the updated date and provide additional notice where required. For privacy questions, an accessible copy, a grievance, or a rights request, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>,
  },
]

const termsSections: LegalSection[] = [
  {
    id: 'agreement',
    title: '1. Agreement and service provider',
    content: <>
      <p>These Terms and Conditions (“Terms”) form a binding agreement between you and the Quilltap supplier identified on your invoice, order form, or commercial agreement (“Quilltap”, “we”, “us”, or “our”). By creating an account, selecting “I agree”, accessing the service, or using Quilltap, you accept these Terms and the <Link to="/privacy">Privacy Policy</Link>.</p>
      <p>If you use Quilltap for a company or other organisation, you represent that you have authority to bind it. If you do not agree, do not create an account or use the service.</p>
    </>,
  },
  {
    id: 'eligibility',
    title: '2. Eligibility and accounts',
    content: <>
      <p>You must be at least 18 years old, or the age of legal majority where you live, and legally able to enter this agreement. You must provide accurate information, keep credentials confidential, and promptly update account details. You are responsible for activity under your account except to the extent caused by our breach.</p>
      <p>Workspace owners and administrators control membership, roles, connected channels, content, billing, exports, and deletion. Your organisation may restrict or remove your access. You must not share an account between people or access a workspace without permission.</p>
    </>,
  },
  {
    id: 'service',
    title: '3. The service and changes',
    content: <p>Quilltap provides tools for content planning, AI-assisted generation, brand knowledge, approvals, scheduling, social publishing, engagement, analytics, and related workflows. Features, provider availability, limits, and beta functionality may change. We may modify or discontinue a feature, but will provide notice of a material reduction to a paid service when reasonably practicable. Roadmap statements are not commitments.</p>,
  },
  {
    id: 'user-content',
    title: '4. Your content and permissions',
    content: <>
      <p>You retain ownership of content you submit and outputs to the extent the law permits. You grant Quilltap a worldwide, non-exclusive, limited licence to host, copy, process, transmit, adapt, and display that content only as needed to provide, secure, support, and improve the service, comply with your instructions, and meet legal obligations. This licence ends when the content is deleted, subject to backups, completed publications, legal retention, and rights already granted to connected services.</p>
      <p>You represent that you have all permissions needed for content, personal data, trademarks, music, images, documents, URLs, and social accounts you provide. You must respect confidentiality, publicity, privacy, intellectual-property, and platform rights.</p>
    </>,
  },
  {
    id: 'ai',
    title: '5. AI-assisted features',
    content: <>
      <p>AI output may be incomplete, inaccurate, biased, offensive, non-unique, or unsuitable. Quilltap does not warrant factual accuracy, originality, legal clearance, platform compliance, or performance. You must review and approve output before relying on or publishing it, and independently verify facts, citations, claims, permissions, and professional advice.</p>
      <p>Do not use AI output as a substitute for legal, medical, financial, employment, housing, credit, or other high-impact professional judgment. You remain responsible for your prompts, edits, approvals, publications, and decisions.</p>
    </>,
  },
  {
    id: 'third-parties',
    title: '6. Connected services and publishing',
    content: <>
      <p>LinkedIn, Instagram, publishing intermediaries, AI providers, and other connected services are independent third parties with their own terms and privacy practices. You authorise Quilltap to send and receive data and take actions on your behalf when you connect them or schedule a publication.</p>
      <p>We do not control third-party availability, moderation, API changes, account restrictions, delays, or data retention. Scheduling is not a guarantee of publication. You are responsible for reviewing the final content, destination, time, permissions, disclosures, advertising rules, and each network’s policies. Disconnect integrations you no longer use.</p>
    </>,
  },
  {
    id: 'acceptable-use',
    title: '7. Acceptable use',
    content: <>
      <p>You must not use Quilltap to:</p>
      <ul>
        <li>break the law, violate another person’s rights, or publish unlawful, deceptive, defamatory, infringing, harassing, or exploitative material;</li>
        <li>send spam, run inauthentic engagement, misrepresent identity or affiliation, or evade network rules;</li>
        <li>process sensitive or personal data without a lawful basis, permission, and appropriate safeguards;</li>
        <li>make solely automated high-impact decisions about individuals;</li>
        <li>upload malware, probe or disrupt security, bypass limits, scrape the service, reverse engineer protected components, or access another workspace;</li>
        <li>resell, sublicense, or use the service to build a competing model or service unless we agree in writing.</li>
      </ul>
      <p>We may investigate suspected misuse, limit automated activity, remove content from our service, suspend connections, or restrict access where reasonably necessary.</p>
    </>,
  },
  {
    id: 'billing',
    title: '8. Free accounts, subscriptions, credits, and taxes',
    content: <>
      <p>A free account may have limited credits, connections, storage, or features and is not a time-limited paid trial unless the offer expressly says otherwise. Paid plans and add-ons are billed at the price, currency, interval, and taxes shown before purchase. Recurring plans renew automatically until cancelled if that is disclosed at checkout and you expressly authorise it.</p>
      <p>Usage credits are service units, not money, have no cash value, cannot be transferred, and may be subject to plan-specific expiry or rollover terms disclosed at purchase. We may correct credit balances affected by error, fraud, reversal, or a failed operation. You are responsible for applicable taxes other than taxes on our income.</p>
      <p>A checkout labelled “test”, “simulated”, or “no real payment” does not create a charged subscription. We will not treat test invoices or credits as evidence that money was collected.</p>
    </>,
  },
  {
    id: 'cancellation',
    title: '9. Cancellation and refunds',
    content: <p>The <Link to="/cancellation">Cancellation and Refund Policy</Link> is part of these Terms. It explains how to stop renewal, when cancellation takes effect, and when a refund may be available. Cancelling a paid plan does not delete your account or workspace data.</p>,
  },
  {
    id: 'ip',
    title: '10. Quilltap intellectual property',
    content: <p>Quilltap and its licensors own the service, software, design, documentation, trademarks, and other materials we provide, excluding your content. We grant you a limited, revocable, non-exclusive, non-transferable right to use the service during the agreement. Feedback may be used without restriction or payment, but we will not identify you publicly without permission.</p>,
  },
  {
    id: 'privacy',
    title: '11. Privacy and confidential information',
    content: <p>Our <Link to="/privacy">Privacy Policy</Link> explains our handling of personal data. Each party must use reasonable care to protect the other party’s non-public confidential information and use it only for the service or agreement. This duty does not cover information that is public without breach, independently developed, lawfully obtained without restriction, or required to be disclosed by law.</p>,
  },
  {
    id: 'termination',
    title: '12. Suspension, termination, and data',
    content: <>
      <p>You may stop using Quilltap at any time. Workspace owners may export supported data and use the workspace-content deletion tool in Settings. For full account requests, contact support.</p>
      <p>We may suspend or terminate access for a material breach, security risk, unlawful use, non-payment, provider restriction, or risk to others or the service. Where appropriate, we will give notice and an opportunity to cure. On termination, your right to use the service ends, but provisions that by nature should survive will survive, including payment, ownership, disclaimers, liability limits, and dispute terms.</p>
    </>,
  },
  {
    id: 'disclaimers',
    title: '13. Disclaimers',
    content: <p>To the maximum extent permitted by law, Quilltap is provided “as is” and “as available”. We disclaim implied warranties of merchantability, fitness for a particular purpose, title, non-infringement, uninterrupted operation, and results. Nothing in these Terms excludes a warranty or consumer right that cannot lawfully be excluded.</p>,
  },
  {
    id: 'liability',
    title: '14. Limitation of liability',
    content: <>
      <p>To the maximum extent permitted by law, neither party is liable for indirect, incidental, special, exemplary, punitive, or consequential loss, or for lost profits, revenue, goodwill, data, or business opportunity arising from these Terms or the service.</p>
      <p>Quilltap’s total liability arising from the service will not exceed the greater of (a) the fees you paid for the service during the 12 months before the event giving rise to the claim or (b) US$100. These exclusions and limits do not apply to fraud, wilful misconduct, death or personal injury caused by negligence, your payment obligations, or liability that cannot be limited by law.</p>
    </>,
  },
  {
    id: 'indemnity',
    title: '15. Indemnity',
    content: <p>If you use Quilltap for business purposes, you will defend and indemnify Quilltap and its personnel against third-party claims, losses, and reasonable costs arising from your content, connected accounts, unlawful use, or material breach of these Terms, except to the extent caused by Quilltap. This section does not apply where prohibited by consumer law.</p>,
  },
  {
    id: 'law',
    title: '16. Governing law and disputes',
    content: <>
      <p>Before filing a claim, contact <a href={`mailto:${SUPPORT_EMAIL}?subject=Quilltap%20legal%20dispute`}>{SUPPORT_EMAIL}</a> and allow 30 days for a good-faith resolution, unless urgent relief or law requires otherwise. These Terms are governed by the laws of India, without regard to conflict-of-law rules. Courts with competent jurisdiction in India may hear disputes.</p>
      <p>If you are a consumer, this section does not deprive you of mandatory rights, remedies, or the ability to bring a claim in a forum available under the laws where you live. Nothing here prevents either party from seeking urgent injunctive relief or reporting a matter to a regulator.</p>
    </>,
  },
  {
    id: 'general',
    title: '17. General terms and changes',
    content: <>
      <p>These Terms, the Privacy Policy, Cancellation and Refund Policy, and any order form are the entire agreement for the service. An order form controls if it expressly conflicts with these Terms. You may not assign the agreement without our consent; we may assign it as part of a reorganisation, financing, or sale of the relevant business. Failure to enforce a term is not a waiver. If a term is unenforceable, the remainder stays effective. Neither party is liable for delay caused by events beyond reasonable control.</p>
      <p>We may update these Terms. We will post the updated date and give reasonable advance notice of a material change when required. Continued use after the effective date constitutes acceptance where law permits; otherwise we will request consent. Questions may be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </>,
  },
]

const cancellationSections: LegalSection[] = [
  {
    id: 'free',
    title: '1. Free accounts',
    content: <p>The Quilltap Free plan is a continuing limited account, not a paid subscription and not a time-limited trial, unless a specific offer clearly says otherwise. It does not require cancellation to avoid a charge. You may stop using it, remove workspace content in Settings, or request account deletion by contacting support.</p>,
  },
  {
    id: 'test-checkout',
    title: '2. Test and simulated checkout',
    content: <p>Quilltap currently supports an allowlisted checkout that is labelled “test”, “simulated”, and “no real payment”. Completing that flow does not charge a payment method and does not create a real recurring payment obligation. A test plan can be changed or removed without a refund because no money was collected.</p>,
  },
  {
    id: 'recurring',
    title: '3. Live paid subscriptions',
    content: <>
      <p>When live billing is offered, the checkout will clearly show the price, currency, taxes, billing interval, renewal terms, included limits, and how to cancel before payment information is accepted. A recurring monthly plan renews each month until cancelled. We will obtain your express agreement before starting recurring charges.</p>
      <p>Plan changes and add-ons take effect as disclosed at checkout. Custom plans follow the applicable order form if it contains different cancellation or notice terms.</p>
    </>,
  },
  {
    id: 'how-to-cancel',
    title: '4. How to cancel',
    content: <>
      <p>Cancel through the subscription control in <strong>Workspace → Settings → Billing</strong> when that control is available. If the control is unavailable, email <a href={`mailto:${SUPPORT_EMAIL}?subject=Cancel%20my%20Quilltap%20subscription`}>{SUPPORT_EMAIL}</a> from the account owner or billing email with the workspace name and the request “Cancel my Quilltap subscription”. We may verify authority to protect the account.</p>
      <p>Your cancellation request is effective when submitted through the available cancellation control or received at that email address. Submit it before the next renewal date to stop the next charge. We will send confirmation. We do not require a phone call, a reason, or acceptance of another offer to cancel.</p>
    </>,
  },
  {
    id: 'effect',
    title: '5. What happens after cancellation',
    content: <>
      <ul>
        <li>Unless the checkout, order form, or mandatory law says otherwise, cancellation stops renewal and takes effect at the end of the current paid period.</li>
        <li>You retain paid access through that period. Afterward, the workspace may move to the Free plan and paid features, add-ons, connections, or limits may stop.</li>
        <li>Review scheduled publications and disconnect channels before paid access ends. A queued or scheduled item is not guaranteed to publish after the related entitlement or connection ends.</li>
        <li>Cancellation does not delete your account, workspace, content, or connected-service data. Use Settings or send a separate privacy request if you want deletion.</li>
      </ul>
    </>,
  },
  {
    id: 'refunds',
    title: '6. Refunds and billing corrections',
    content: <>
      <p>Fees are non-refundable and we do not provide prorated refunds for unused time merely because you stop using the service or cancel after a renewal, except where an offer, order form, or applicable law requires otherwise.</p>
      <p>We will investigate and, where appropriate, refund or correct duplicate charges, charges made after an effective cancellation, unauthorised charges, or paid service that Quilltap failed to provide. Consumer remedies for a service that is defective, deficient, or materially different from what was advertised are not limited by this Policy.</p>
      <p>Used credits and completed AI operations are not refundable. Unused top-ups or prepaid credits are refundable only if the purchase terms or applicable law require it. A credit automatically returned after a failed AI operation is a usage correction, not a cash refund.</p>
    </>,
  },
  {
    id: 'request-refund',
    title: '7. How to request a refund or report a charge',
    content: <p>Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Quilltap%20billing%20request`}>{SUPPORT_EMAIL}</a> with the workspace name, invoice or transaction reference, charge date, amount, and reason. Do not send a full card number or password. We may request information needed to verify the account and payment. We will acknowledge the request and respond within the period required by applicable law.</p>,
  },
  {
    id: 'suspension',
    title: '8. Suspension or termination by Quilltap',
    content: <p>If we end a paid service without cause before the current paid period ends, we will provide a prorated refund for the unused period. No refund is due where we suspend or terminate for material breach, unlawful activity, fraud, security risk, charge reversal, or non-payment, except as required by law.</p>,
  },
  {
    id: 'changes',
    title: '9. Changes and mandatory rights',
    content: <p>We may update this Policy for future purchases or renewals and will post the updated date. Changes do not remove rights already accrued or mandatory rights under applicable consumer law. If an order form grants more favourable cancellation or refund rights, that order form controls. Questions can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>,
  },
]

const documents: Record<LegalKind, LegalDocument> = {
  privacy: {
    eyebrow: 'YOUR DATA, CLEARLY EXPLAINED',
    title: 'Privacy Policy',
    summary: 'What Quilltap collects, why we use it, who receives it, and the choices available to you.',
    icon: ShieldCheck,
    sections: privacySections,
  },
  terms: {
    eyebrow: 'THE RULES OF THE WORKSPACE',
    title: 'Terms and Conditions',
    summary: 'The agreement that governs your account, content, connected channels, AI-assisted work, and use of Quilltap.',
    icon: FileText,
    sections: termsSections,
  },
  cancellation: {
    eyebrow: 'STRAIGHTFORWARD BILLING',
    title: 'Cancellation and Refund Policy',
    summary: 'How free accounts, test checkout, recurring plans, cancellation, billing corrections, and refunds work.',
    icon: ReceiptText,
    sections: cancellationSections,
  },
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  const document = documents[kind]
  const Icon = document.icon

  return <div className="legal-page">
    <header className="legal-header">
      <Link className="legal-brand" to="/" aria-label="Quilltap home"><QuilltapLogo alt="" /></Link>
      <nav aria-label="Legal documents">
        <Link className={kind === 'privacy' ? 'active' : ''} to="/privacy">Privacy</Link>
        <Link className={kind === 'terms' ? 'active' : ''} to="/terms">Terms</Link>
        <Link className={kind === 'cancellation' ? 'active' : ''} to="/cancellation">Cancellation</Link>
      </nav>
      <Link className="legal-back" to="/"><ArrowLeft size={15} /> Back to Quilltap</Link>
    </header>

    <main>
      <section className="legal-hero">
        <div className="legal-icon" aria-hidden="true"><Icon size={24} /></div>
        <span>{document.eyebrow}</span>
        <h1>{document.title}</h1>
        <p>{document.summary}</p>
        <div className="legal-dates"><CalendarDays size={15} /> Effective and last updated: {EFFECTIVE_DATE}</div>
      </section>

      <div className="legal-layout">
        <aside className="legal-toc" aria-label="On this page">
          <strong>On this page</strong>
          {document.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title.replace(/^\d+\.\s*/, '')}</a>)}
        </aside>

        <article className="legal-document">
          <div className="legal-notice" role="note">
            <ShieldCheck size={19} />
            <div><strong>Plain-language notice</strong><p>This document is written to describe Quilltap’s current service. Mandatory rights under applicable law continue to apply even if they are not repeated here.</p></div>
          </div>
          {document.sections.map((section) => <section id={section.id} key={section.id}>
            <h2>{section.title}</h2>
            {section.content}
          </section>)}
          <div className="legal-contact-card">
            <div><span>QUESTIONS OR REQUESTS</span><h2>We’re here to help.</h2><p>Contact Quilltap support and include your workspace name so we can route your request correctly.</p></div>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL} <ArrowRight size={16} /></a>
          </div>
        </article>
      </div>
    </main>

    <footer className="legal-footer">
      <p>© {new Date().getFullYear()} Quilltap. All rights reserved.</p>
      <div><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms and Conditions</Link><Link to="/cancellation">Cancellation Policy</Link></div>
    </footer>
  </div>
}
