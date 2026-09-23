import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  Link2,
  LoaderCircle,
  MessageCircleMore,
  Plus,
  Receipt,
  Sparkles,
  Unlock,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { billingApi, BillingApiError } from '../../../api/billingApi'
import type {
  BillingInvoice,
  CheckoutPayload,
  SubscriptionOverview,
} from '../../../types/billing'
import './ContentBillingTab.css'

interface Props {
  onPlanChanged?: () => void
}

export function ContentBillingTab({ onPlanChanged }: Props) {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Checkout modal state
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkoutAction, setCheckoutAction] = useState<CheckoutPayload['action']>('UPGRADE_PLAN')
  const [targetTier, setTargetTier] = useState<'STARTER' | 'ADVANCE'>('STARTER')
  const [boosterCredits, setBoosterCredits] = useState<number>(50)
  const [extraConnections, setExtraConnections] = useState<number>(1)
  const [billingName, setBillingName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [newInvoice, setNewInvoice] = useState<BillingInvoice | null>(null)

  const loadSubscription = useCallback(async () => {
    try {
      setError('')
      const data = await billingApi.getSubscription()
      setOverview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load subscription details.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSubscription()
  }, [loadSubscription])

  const openUpgradeModal = (tier: 'STARTER' | 'ADVANCE') => {
    setCheckoutAction('UPGRADE_PLAN')
    setTargetTier(tier)
    setShowCheckout(true)
    setCheckoutError('')
    setNewInvoice(null)
  }

  const openBoosterModal = (credits: number) => {
    setCheckoutAction('BUY_BOOSTER')
    setBoosterCredits(credits)
    setShowCheckout(true)
    setCheckoutError('')
    setNewInvoice(null)
  }

  const openConnectionModal = () => {
    setCheckoutAction('ADD_CONNECTIONS')
    setExtraConnections(1)
    setShowCheckout(true)
    setCheckoutError('')
    setNewInvoice(null)
  }

  const openEngageModal = () => {
    setCheckoutAction('ADD_ENGAGE')
    setShowCheckout(true)
    setCheckoutError('')
    setNewInvoice(null)
  }

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCheckoutBusy(true)
    setCheckoutError('')

    try {
      const payload: CheckoutPayload = {
        action: checkoutAction,
        billing_name: billingName.trim() || undefined,
        billing_email: billingEmail.trim() || undefined,
        payment_method: 'Credit Card (Stripe Checkout)',
      }

      if (checkoutAction === 'UPGRADE_PLAN') {
        payload.tier = targetTier
      } else if (checkoutAction === 'BUY_BOOSTER') {
        payload.booster_credits = boosterCredits
      } else if (checkoutAction === 'ADD_CONNECTIONS') {
        payload.extra_connections = extraConnections
      } else if (checkoutAction === 'ADD_ENGAGE') {
        payload.has_engage = true
      }

      const res = await billingApi.checkout(payload)
      setNewInvoice(res.invoice)
      setSuccessMessage(res.message)
      await loadSubscription()
      if (onPlanChanged) onPlanChanged()
    } catch (err) {
      if (err instanceof BillingApiError) {
        setCheckoutError(err.message)
      } else {
        setCheckoutError('Payment checkout could not be processed. Please try again.')
      }
    } finally {
      setCheckoutBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="billing-tab-container" style={{ textAlign: 'center', padding: '40px' }}>
        <LoaderCircle className="spin" size={28} />
        <p style={{ marginTop: '12px', color: '#6b7280' }}>Loading billing & plan status…</p>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="billing-tab-container">
        {error && <div className="li-banner error">{error}</div>}
        <p>Could not retrieve subscription information.</p>
      </div>
    )
  }

  const tier = overview.tier
  const isAdmin = overview.is_admin
  const isAdvance = tier === 'ADVANCE'
  const isStarter = tier === 'STARTER'
  const isFree = tier === 'FREE'

  // Credit calculation
  const creditBalance = overview.credits.balance
  const creditAllocated = overview.credits.total_allocated || 50
  const creditPercent = overview.credits.unlimited
    ? 100
    : Math.min(100, Math.round((creditBalance / creditAllocated) * 100))

  return (
    <div className="billing-tab-container">
      {successMessage && (
        <div className="li-banner success">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {error && <div className="li-banner error">{error}</div>}

      {/* Plan Hero Banner */}
      <section className="billing-hero-card">
        <div className="billing-hero-info">
          <div className="billing-tier-badge-row">
            <span className={`billing-tier-badge tier-${tier.toLowerCase()}`}>
              <Sparkles size={14} />
              {overview.role_label}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              {isAdmin
                ? 'System Admin Workspace · Unrestricted Privileges'
                : isAdvance
                ? '$39/month · Billed Monthly'
                : isStarter
                ? '$20/month · Billed Monthly'
                : '$0/month · Free Sandbox Account'}
            </span>
          </div>
          <h2>
            {isAdmin
              ? 'Administrator Full Access'
              : isAdvance
              ? 'Advance Social Studio'
              : isStarter
              ? 'Starter Pack Workspace'
              : 'Free Plan'}
          </h2>
          <p>
            {isAdmin
              ? 'No restrictions on social connections, AI creation credits, or automated engagement copilot.'
              : isAdvance
              ? 'Multi-channel scaling with 150 AI credits/mo, full Engage feature suite, and unlimited scheduling.'
              : isStarter
              ? '1 social connection, 50 AI credits/mo, unlimited scheduling. Easily scale up anytime.'
              : 'Explore Content Studio drafting with 15 AI credits. Upgrade to connect social channels and schedule live posts.'}
          </p>
        </div>

        {!isAdmin && (
          <div className="billing-hero-actions">
            {isFree && (
              <>
                <button
                  type="button"
                  className="metric-action-btn primary"
                  onClick={() => openUpgradeModal('STARTER')}
                >
                  Upgrade to Starter ($20/mo)
                </button>
                <button
                  type="button"
                  className="metric-action-btn"
                  onClick={() => openUpgradeModal('ADVANCE')}
                >
                  Upgrade to Advance ($39/mo)
                </button>
              </>
            )}
            {isStarter && (
              <button
                type="button"
                className="metric-action-btn primary"
                onClick={() => openUpgradeModal('ADVANCE')}
              >
                <Zap size={15} /> Upgrade to Advance ($39/mo)
              </button>
            )}
            {isAdvance && (
              <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> Highest Tier Active
              </span>
            )}
          </div>
        )}
      </section>

      {/* Metrics Grid */}
      <section className="billing-metrics-grid">
        {/* Metric 1: AI Credits */}
        <div className="billing-metric-card">
          <div className="metric-card-header">
            <div className="icon-wrapper purple">
              <Sparkles size={20} />
            </div>
            <div className="metric-title-group">
              <span>AI Credits</span>
              <strong>Generation Quota</strong>
            </div>
          </div>

          <div>
            <div className="metric-stat-display">
              <span className="big-number">
                {overview.credits.unlimited ? '∞' : creditBalance}
              </span>
              <span className="sub-label">
                {overview.credits.unlimited
                  ? 'Unlimited AI credits'
                  : `credits left of ${creditAllocated} allocated`}
              </span>
            </div>
            {!overview.credits.unlimited && (
              <div className="billing-progress-bar-bg" style={{ marginTop: '10px' }}>
                <div
                  className="billing-progress-bar-fill"
                  style={{ width: `${creditPercent}%` }}
                />
              </div>
            )}
          </div>

          <p className="metric-footnote">
            ⚡ <strong>2 credits</strong> per text draft · 🎨 <strong>3 credits</strong> with AI image · 🔄 <strong>1 credit</strong> image regeneration.
          </p>

          {!isAdmin && (
            <button
              type="button"
              className="metric-action-btn"
              onClick={() => openBoosterModal(50)}
            >
              <Plus size={14} /> Buy Booster Credits
            </button>
          )}
        </div>

        {/* Metric 2: Social Connections */}
        <div className="billing-metric-card">
          <div className="metric-card-header">
            <div className="icon-wrapper blue">
              <Link2 size={20} />
            </div>
            <div className="metric-title-group">
              <span>Connections</span>
              <strong>Active Accounts</strong>
            </div>
          </div>

          <div>
            <div className="metric-stat-display">
              <span className="big-number">
                {overview.connections.unlimited
                  ? `${overview.connections.used}`
                  : `${overview.connections.used} / ${overview.connections.limit}`}
              </span>
              <span className="sub-label">
                {overview.connections.unlimited
                  ? 'channels connected (Unlimited)'
                  : 'connected social profiles'}
              </span>
            </div>
            {!overview.connections.unlimited && overview.connections.limit > 0 && (
              <div className="billing-progress-bar-bg" style={{ marginTop: '10px' }}>
                <div
                  className="billing-progress-bar-fill blue"
                  style={{
                    width: `${Math.min(
                      100,
                      (overview.connections.used / overview.connections.limit) * 100
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>

          <p className="metric-footnote">
            {overview.connections.limit === 0
              ? 'Free plan is sandbox mode with 0 live connections. Upgrade to connect LinkedIn/Instagram.'
              : `${overview.connections.limit} account slot${overview.connections.limit > 1 ? 's' : ''} available. Extra connections are $5/month each.`}
          </p>

          {!isAdmin && (
            <button
              type="button"
              className="metric-action-btn"
              onClick={isFree ? () => openUpgradeModal('STARTER') : openConnectionModal}
            >
              <Plus size={14} /> {isFree ? 'Unlock Connections' : 'Add Connection ($5/mo)'}
            </button>
          )}
        </div>

        {/* Metric 3: Unlimited Scheduling */}
        <div className="billing-metric-card">
          <div className="metric-card-header">
            <div className="icon-wrapper green">
              <CalendarDays size={20} />
            </div>
            <div className="metric-title-group">
              <span>Scheduling</span>
              <strong>Unlimited Guarantee</strong>
            </div>
          </div>

          <div>
            <div className="metric-stat-display">
              <span className="big-number" style={{ color: '#059669' }}>
                100%
              </span>
              <span className="sub-label">Unlimited posts across all tiers</span>
            </div>
          </div>

          <p className="metric-footnote">
            No posting throttling or daily post caps. Schedule as far into the future as you need across your connected accounts.
          </p>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              color: '#059669',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} /> Always Active & Included
          </span>
        </div>

        {/* Metric 4: Engage Automation */}
        <div className="billing-metric-card">
          <div className="metric-card-header">
            <div className="icon-wrapper" style={{ background: overview.engage_entitled ? '#ecfdf5' : '#fffbeb', color: overview.engage_entitled ? '#059669' : '#d97706' }}>
              <MessageCircleMore size={20} />
            </div>
            <div className="metric-title-group">
              <span>Engage Feature</span>
              <strong>Automations & CRM</strong>
            </div>
          </div>

          <div>
            <div className="metric-stat-display">
              <span className="big-number" style={{ color: overview.engage_entitled ? '#059669' : '#4b5563' }}>
                {overview.engage_entitled ? 'Active' : 'Locked'}
              </span>
              <span className="sub-label">
                {overview.engage_entitled ? 'Included on this workspace' : 'Advance or Add-on required'}
              </span>
            </div>
          </div>

          <p className="metric-footnote">
            Comment-to-DM, story response copilot, automated review generation, and lead interaction triggers.
          </p>

          {!overview.engage_entitled && !isAdmin && (
            <button
              type="button"
              className="metric-action-btn primary"
              onClick={isStarter ? openEngageModal : () => openUpgradeModal('ADVANCE')}
            >
              <Unlock size={14} /> {isStarter ? 'Add Engage ($15/mo)' : 'Upgrade to Unlock Engage'}
            </button>
          )}

          {overview.engage_entitled && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                color: '#059669',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={16} /> Unlocked & Ready
            </span>
          )}
        </div>
      </section>

      {/* Booster Packs Section */}
      {!isAdmin && (
        <section className="billing-boosters-card">
          <div className="billing-boosters-header">
            <div>
              <h3>AI Credit Booster Packs</h3>
              <p>Top up extra credits on-demand at any time. Booster credits never expire.</p>
            </div>
          </div>

          <div className="boosters-pill-row">
            <div className="booster-item-card">
              <div className="booster-item-top">
                <span className="booster-credits-amount">50 Credits</span>
                <span className="booster-price-tag">$10</span>
              </div>
              <p className="booster-item-desc">
                Ideal for quick sprint campaigns and generating supplemental posts.
              </p>
              <button
                type="button"
                className="metric-action-btn"
                onClick={() => openBoosterModal(50)}
              >
                <Zap size={14} /> Buy 50 Credits ($10)
              </button>
            </div>

            <div className="booster-item-card" style={{ borderColor: '#ddd6fe' }}>
              <div className="booster-item-top">
                <span className="booster-credits-amount">150 Credits</span>
                <span className="booster-price-tag">$25</span>
              </div>
              <p className="booster-item-desc">
                Great value for frequent campaigns and active image regeneration.
              </p>
              <button
                type="button"
                className="metric-action-btn primary"
                onClick={() => openBoosterModal(150)}
              >
                <Zap size={14} /> Buy 150 Credits ($25)
              </button>
            </div>

            <div className="booster-item-card">
              <div className="booster-item-top">
                <span className="booster-credits-amount">350 Credits</span>
                <span className="booster-price-tag">$50</span>
              </div>
              <p className="booster-item-desc">
                Maximum volume pack for intensive publishing and high visual creation.
              </p>
              <button
                type="button"
                className="metric-action-btn"
                onClick={() => openBoosterModal(350)}
              >
                <Zap size={14} /> Buy 350 Credits ($50)
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Invoices & Receipts Section */}
      <section className="billing-invoices-card">
        <div className="billing-boosters-header">
          <div>
            <h3>Billing Invoices & Receipts</h3>
            <p>View transaction history and download official printable invoices.</p>
          </div>
        </div>

        {overview.invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#6b7280' }}>
            <Receipt size={32} style={{ margin: '0 auto 8px', color: '#9ca3af' }} />
            <p>No billing invoices generated yet. Invoices appear automatically upon plan upgrades or credit purchases.</p>
          </div>
        ) : (
          <div className="invoices-table-wrapper">
            <table className="invoices-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {overview.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <span className="invoice-number-tag">{inv.invoice_number}</span>
                    </td>
                    <td>{new Date(inv.paid_at).toLocaleDateString()}</td>
                    <td>
                      <strong>{inv.title}</strong>
                    </td>
                    <td>
                      <strong>
                        ${Number(inv.amount).toFixed(2)} {inv.currency}
                      </strong>
                    </td>
                    <td>
                      <span className="invoice-status-pill paid">{inv.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <a
                        href={billingApi.getInvoiceDownloadUrl(inv.id, true)}
                        className="invoice-download-btn"
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Download size={13} />
                        Download Invoice
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="checkout-modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="checkout-modal-card" onClick={(e) => e.stopPropagation()}>
            <header className="checkout-modal-header">
              <h3>
                {checkoutAction === 'UPGRADE_PLAN'
                  ? `Upgrade to ${targetTier === 'ADVANCE' ? 'Advance' : 'Starter'} Plan`
                  : checkoutAction === 'BUY_BOOSTER'
                  ? `Buy ${boosterCredits} AI Booster Credits`
                  : checkoutAction === 'ADD_CONNECTIONS'
                  ? 'Add Extra Social Connection'
                  : 'Unlock Engage Feature'}
              </h3>
              <button
                type="button"
                className="studio-modal-close"
                onClick={() => setShowCheckout(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            {newInvoice ? (
              <div className="checkout-modal-body" style={{ textAlign: 'center', padding: '30px' }}>
                <CheckCircle2 size={44} style={{ color: '#059669', margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '1.2rem', margin: '0 0 6px 0', color: '#111827' }}>
                  Payment Processed Successfully!
                </h4>
                <p style={{ color: '#4b5563', fontSize: '0.92rem', marginBottom: '20px' }}>
                  Your workspace has been updated. Invoice <strong>#{newInvoice.invoice_number}</strong> is ready for download.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <a
                    href={billingApi.getInvoiceDownloadUrl(newInvoice.id, true)}
                    className="metric-action-btn primary"
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                  >
                    <Download size={15} /> Download Invoice (.html)
                  </a>
                  <button
                    type="button"
                    className="metric-action-btn"
                    onClick={() => setShowCheckout(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckoutSubmit}>
                <div className="checkout-modal-body">
                  {checkoutError && <div className="li-banner error">{checkoutError}</div>}

                  {checkoutAction === 'UPGRADE_PLAN' && (
                    <div className="checkout-summary-box">
                      <div className="summary-row">
                        <span>Plan Tier:</span>
                        <strong>{targetTier === 'ADVANCE' ? 'Advance ($39/mo)' : 'Starter ($20/mo)'}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Billing Cycle:</span>
                        <span>Monthly</span>
                      </div>
                      <div className="summary-row">
                        <span>Included AI Credits:</span>
                        <span>{targetTier === 'ADVANCE' ? '150 credits/mo' : '50 credits/mo'}</span>
                      </div>
                      <div className="summary-row">
                        <span>Social Connections:</span>
                        <span>1 connection included</span>
                      </div>
                      <div className="summary-row">
                        <span>Engage Feature:</span>
                        <span>{targetTier === 'ADVANCE' ? 'Included & Unlocked' : 'Locked ($15/mo add-on)'}</span>
                      </div>
                      <div className="summary-row total">
                        <span>Total Due Today:</span>
                        <span>{targetTier === 'ADVANCE' ? '$39.00' : '$20.00'}</span>
                      </div>
                    </div>
                  )}

                  {checkoutAction === 'BUY_BOOSTER' && (
                    <div className="checkout-summary-box">
                      <div className="summary-row">
                        <span>Item:</span>
                        <strong>{boosterCredits} AI Booster Credits</strong>
                      </div>
                      <div className="summary-row">
                        <span>Credit Validity:</span>
                        <span>Never Expires</span>
                      </div>
                      <div className="summary-row total">
                        <span>Total Due Today:</span>
                        <span>
                          {boosterCredits === 50 ? '$10.00' : boosterCredits === 150 ? '$25.00' : '$50.00'}
                        </span>
                      </div>
                    </div>
                  )}

                  {checkoutAction === 'ADD_CONNECTIONS' && (
                    <div className="checkout-summary-box">
                      <div className="summary-row">
                        <span>Item:</span>
                        <strong>1 Extra Social Connection</strong>
                      </div>
                      <div className="summary-row">
                        <span>Rate:</span>
                        <span>$5.00 / month</span>
                      </div>
                      <div className="summary-row total">
                        <span>Total Due Today:</span>
                        <span>$5.00</span>
                      </div>
                    </div>
                  )}

                  {checkoutAction === 'ADD_ENGAGE' && (
                    <div className="checkout-summary-box">
                      <div className="summary-row">
                        <span>Item:</span>
                        <strong>Engage Automation Suite Add-on</strong>
                      </div>
                      <div className="summary-row">
                        <span>Rate:</span>
                        <span>$15.00 / month</span>
                      </div>
                      <div className="summary-row total">
                        <span>Total Due Today:</span>
                        <span>$15.00</span>
                      </div>
                    </div>
                  )}

                  <label className="li-field">
                    <span>Billing Name (for Invoice)</span>
                    <input
                      type="text"
                      placeholder="e.g. Acme Corp / Alex Smith"
                      value={billingName}
                      onChange={(e) => setBillingName(e.target.value)}
                    />
                  </label>

                  <label className="li-field">
                    <span>Billing Email</span>
                    <input
                      type="email"
                      placeholder="billing@example.com"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                    />
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#6b7280' }}>
                    <CreditCard size={16} />
                    <span>Secure simulated checkout · Immediate invoice generation</span>
                  </div>
                </div>

                <footer className="checkout-modal-footer">
                  <button
                    type="button"
                    className="metric-action-btn"
                    onClick={() => setShowCheckout(false)}
                    disabled={checkoutBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="metric-action-btn primary"
                    disabled={checkoutBusy}
                  >
                    {checkoutBusy ? (
                      <>
                        <LoaderCircle className="spin" size={15} /> Processing…
                      </>
                    ) : (
                      'Confirm & Pay'
                    )}
                  </button>
                </footer>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
