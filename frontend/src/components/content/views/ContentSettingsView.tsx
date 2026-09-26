import {
  Building2,
  ChevronRight,
  CreditCard,
  Link2,
  Mail,
  Palette,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useOptionalAuth } from '../AuthContext'
import { useContentStudio } from '../ContentStudioContext'
import { ContentBillingTab } from './ContentBillingTab'
import './ContentSettingsView.css'

type SettingsTab = 'profile' | 'plan' | 'invoices'

const tabs: { id: SettingsTab; label: string; description: string; icon: typeof UserRound }[] = [
  { id: 'profile', label: 'Profile & workspace', description: 'Account details and shortcuts', icon: UserRound },
  { id: 'plan', label: 'Plan & usage', description: 'Credits, limits, and add-ons', icon: CreditCard },
  { id: 'invoices', label: 'Billing history', description: 'Invoices and receipts', icon: ReceiptText },
]

export function ContentSettingsView() {
  const { reload, onboarding } = useContentStudio()
  const auth = useOptionalAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab: SettingsTab = requestedTab === 'invoices'
    ? 'invoices'
    : requestedTab === 'plan' || requestedTab === 'billing'
      ? 'plan'
      : 'profile'

  const userName = auth?.user?.name || 'Visiofy Studio user'
  const userEmail = auth?.user?.email || 'Sign in to view account details'
  const workspaceName = auth?.workspace?.name || onboarding.business.name || 'Your workspace'
  const membership = auth?.workspaces.find((item) => item.id === auth.workspace?.id)
  const role = membership?.role
    ? membership.role.charAt(0).toUpperCase() + membership.role.slice(1).toLowerCase()
    : 'Member'

  const selectTab = (tab: SettingsTab) => {
    setSearchParams(tab === 'profile' ? {} : { tab })
  }

  return (
    <section className="settings-hub" aria-label="Visiofy Studio settings">
      <header className="settings-hub-hero">
        <div className="settings-hub-hero-copy">
          <span className="settings-hub-eyebrow">Account &amp; workspace</span>
          <h2>Everything that powers your workspace, in one place.</h2>
          <p>Review your account, understand usage, manage your plan, and find every invoice without searching through one long page.</p>
        </div>
        <div className="settings-account-summary" aria-label="Signed-in account">
          <span className="settings-account-avatar">{userName.slice(0, 1).toUpperCase()}</span>
          <span><strong>{userName}</strong><small>{userEmail}</small></span>
        </div>
      </header>

      <nav className="settings-tabs" role="tablist" aria-label="Settings sections">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-panel-${tab.id}`}
              className={selected ? 'active' : ''}
              onClick={() => selectTab(tab.id)}
            >
              <span className="settings-tab-icon"><Icon size={18} /></span>
              <span><strong>{tab.label}</strong><small>{tab.description}</small></span>
            </button>
          )
        })}
      </nav>

      <div
        className="settings-tab-panel"
        id={`settings-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
      >
        {activeTab === 'profile' && (
          <>
            <div className="settings-section-heading">
              <div><span>Profile</span><h3>Your account and workspace</h3><p>These details identify you and the workspace you are currently managing.</p></div>
            </div>

            <div className="settings-profile-grid">
              <article className="settings-info-card">
                <header><span><UserRound size={19} /></span><div><h4>Personal details</h4><p>Your signed-in Visiofy Studio identity.</p></div></header>
                <dl>
                  <div><dt>Full name</dt><dd>{userName}</dd></div>
                  <div><dt>Email address</dt><dd><Mail size={15} /> {userEmail}</dd></div>
                  <div><dt>Account access</dt><dd><ShieldCheck size={15} /> Active session</dd></div>
                </dl>
              </article>

              <article className="settings-info-card">
                <header><span className="workspace"><Building2 size={19} /></span><div><h4>Current workspace</h4><p>Your role and active business context.</p></div></header>
                <dl>
                  <div><dt>Workspace</dt><dd>{workspaceName}</dd></div>
                  <div><dt>Your role</dt><dd>{role}</dd></div>
                  <div><dt>Accessible workspaces</dt><dd>{auth?.workspaces.length || 1}</dd></div>
                </dl>
              </article>
            </div>

            <section className="settings-shortcuts" aria-labelledby="settings-shortcuts-title">
              <div className="settings-section-heading compact">
                <div><span>Workspace tools</span><h3 id="settings-shortcuts-title">Common settings shortcuts</h3><p>Jump directly to the workspace controls people use most often.</p></div>
              </div>
              <div className="settings-shortcut-grid">
                <Link to="/content/library?panel=brand">
                  <span className="brand"><Palette size={19} /></span>
                  <span><strong>Brand &amp; Publishing</strong><small>Voice, visual direction, schedule, and approvals</small></span>
                  <ChevronRight size={17} />
                </Link>
                <Link to="/content/connections">
                  <span className="connections"><Link2 size={19} /></span>
                  <span><strong>Social connections</strong><small>Review connected accounts and publishing health</small></span>
                  <ChevronRight size={17} />
                </Link>
              </div>
            </section>
          </>
        )}

        {activeTab === 'plan' && (
          <>
            <div className="settings-section-heading">
              <div><span>Subscription</span><h3>Plan, usage, and add-ons</h3><p>See what is included, how many credits remain, and which features are active.</p></div>
            </div>
            <ContentBillingTab view="overview" onPlanChanged={() => void reload()} />
          </>
        )}

        {activeTab === 'invoices' && (
          <>
            <div className="settings-section-heading">
              <div><span>Billing</span><h3>Invoices and receipts</h3><p>Your payment history lives here. Download any available invoice for your records.</p></div>
            </div>
            <ContentBillingTab view="invoices" onPlanChanged={() => void reload()} />
          </>
        )}
      </div>
    </section>
  )
}
