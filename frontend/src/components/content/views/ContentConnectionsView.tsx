import { ArrowRight, CheckCircle2, Instagram, Linkedin, Link2, LoaderCircle, Plus, RefreshCw, ShieldCheck, TriangleAlert, Unlink, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { billingApi } from '../../../api/billingApi'
import { contentOnboardingApi, type LinkedInAccountChoice } from '../../../api/contentOnboarding'
import { contentStudioApi } from '../../../api/contentStudio'
import { contentStudioMockConnections } from '../../../api/contentStudioMock'
import type { SubscriptionOverview } from '../../../types/billing'
import type { StudioConnection } from '../../../types/contentStudio'
import { useContentStudio } from '../ContentStudioContext'
import { customerSafeMessage } from '../contentUtils'
import { useToast } from '../../notifications/useToast'

const networkIcons: Record<string, LucideIcon> = { LINKEDIN: Linkedin, INSTAGRAM: Instagram, X: Link2 }
type ConnectButton = 'empty-linkedin' | 'options-linkedin' | 'options-instagram'

export function ContentConnectionsView() {
  const studio = useContentStudio()
  const { showToast } = useToast()
  const { isDemo, onboarding, busy: studioBusy, connectLinkedIn } = studio
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const handledReturn = useRef(false)
  const [connections, setConnections] = useState<StudioConnection[] | null>(null)
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null)
  const [busy, setBusy] = useState('')
  const [connectingButton, setConnectingButton] = useState<ConnectButton | null>(null)
  const [error, setError] = useState('')
  const [pendingSelection, setPendingSelection] = useState<{ state: string; pendingDataToken: string; connectToken: string; accounts: LinkedInAccountChoice[]; loading: boolean } | null>(null)
  const [selectionBusy, setSelectionBusy] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setConnections(isDemo ? structuredClone(contentStudioMockConnections) : await contentStudioApi.connections())
      if (!isDemo) {
        const sub = await billingApi.getSubscription()
        setOverview(sub)
      }
    } catch (loadError) {
      setError(customerSafeMessage(loadError instanceof Error ? loadError.message : undefined, 'Could not load social accounts.'))
    }
  }, [isDemo])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const state = searchParams.get('state') || undefined
    const code = searchParams.get('code') || undefined
    const profileId = searchParams.get('profileId') || undefined
    const accountId = searchParams.get('accountId') || undefined
    const pendingDataToken = searchParams.get('pendingDataToken') || undefined
    if (!handledReturn.current && state && pendingDataToken && searchParams.get('step') === 'select_organization') {
      handledReturn.current = true
      const connectToken = searchParams.get('connect_token') || ''
      navigate('/content/connections', { replace: true })
      setPendingSelection({ state, pendingDataToken, connectToken, accounts: [], loading: true })
      void contentOnboardingApi.connectionChoices({ state, pending_data_token: pendingDataToken })
        .then(({ accounts }) => setPendingSelection((current) => current?.pendingDataToken === pendingDataToken ? { ...current, accounts, loading: false } : current))
        .catch((choiceError) => {
          setError(customerSafeMessage(choiceError instanceof Error ? choiceError.message : undefined, 'Could not load LinkedIn accounts. Start the connection again.'))
          setPendingSelection((current) => current?.pendingDataToken === pendingDataToken ? { ...current, loading: false } : current)
        })
      return
    }
    const status = searchParams.get('connect_status')
    const providerError = searchParams.get('error') || undefined
    const cancelled = status === 'cancelled' || providerError === 'access_denied'
    const returnError = providerError || (status === 'error' ? 'connection_failed' : undefined)
    if (handledReturn.current || (!state && !returnError && !cancelled)) return
    handledReturn.current = true
    void studio.completeLinkedInConnection({ state, code, error: returnError, cancelled, profile_id: profileId, account_id: accountId }).then(load).finally(() => navigate('/content/connections', { replace: true }))
  }, [load, navigate, searchParams, studio])

  const chooseAccount = async (account: LinkedInAccountChoice) => {
    if (!pendingSelection || selectionBusy) return
    setSelectionBusy(`${account.account_type}:${account.id}`); setError('')
    try {
      const connected = await studio.selectLinkedInConnection({
        state: pendingSelection.state,
        pending_data_token: pendingSelection.pendingDataToken,
        account_type: account.account_type,
        organization_id: account.account_type === 'ORGANIZATION' ? account.id : undefined,
        connect_token: pendingSelection.connectToken,
      })
      if (connected) { setPendingSelection(null); await load() }
    } finally { setSelectionBusy('') }
  }
  const cancelSelection = async () => {
    await studio.cancelLinkedInConnection()
    setPendingSelection(null)
  }

  const act = async (connection: StudioConnection, action: 'RECONNECT' | 'DISCONNECT' | 'PREPARE_REMOVE' | 'REMOVE') => {
    const managerTab = action === 'PREPARE_REMOVE' && !isDemo ? window.open('about:blank', '_blank') : null
    if (managerTab) managerTab.opener = null
    setBusy(`${connection.id}-${action}`); setError('')
    try {
      if (isDemo) {
        setConnections((current) => current?.map((item) => item.id === connection.id ? { ...item, status: action === 'DISCONNECT' ? 'DISCONNECTED' : 'CONNECTING', health: 'NEEDS_ATTENTION', message: action === 'DISCONNECT' ? 'Disconnected' : 'Connection in progress' } : item) ?? current)
      } else {
        const result = await contentStudioApi.connectionAction(connection.id, action)
        if ('authorization_url' in result) {
          if (action === 'PREPARE_REMOVE') sessionStorage.setItem('pending_account_removal', connection.id)
          if (managerTab) managerTab.location.assign(result.authorization_url)
          else window.location.assign(result.authorization_url)
          return true
        }
        if ('removed' in result) {
          sessionStorage.removeItem('pending_account_removal')
          setConnections((current) => current?.filter((item) => item.id !== result.id) ?? current)
        } else {
          setConnections((current) => current?.map((item) => item.id === result.id ? result : item) ?? current)
        }
      }
      return true
    } catch (actionError) {
      managerTab?.close()
      showToast({
        tone: 'error',
        title: 'Account action failed',
        message: customerSafeMessage(actionError instanceof Error ? actionError.message : undefined, action === 'RECONNECT' ? 'The social account connection step could not start.' : action === 'PREPARE_REMOVE' ? 'Could not open the account manager.' : action === 'REMOVE' ? 'Could not remove this social account.' : 'Could not disconnect this social account.'),
        dedupeKey: `connection-${action.toLowerCase()}-error`,
      })
      return false
    }
    finally { setBusy('') }
  }

  const connect = async (button: ConnectButton, network: 'LINKEDIN' | 'INSTAGRAM') => {
    if (connectingButton) return
    if (
      overview &&
      !overview.connections.unlimited &&
      (connections?.length || 0) >= overview.connections.limit
    ) {
      showToast({
        tone: 'warning',
        title: 'Connection limit reached',
        message: `Your ${overview.role_label} plan allows ${overview.connections.limit} connected ${overview.connections.limit === 1 ? 'account' : 'accounts'}. Upgrade your plan or add an extra connection in Plan & Invoices.`,
        duration: 8000,
        dedupeKey: 'connection-plan-limit',
        action: {
          label: 'View plans and invoices',
          onClick: () => navigate('/content/settings?tab=plan'),
        },
      })
      return
    }
    setConnectingButton(button)
    try { await connectLinkedIn(network, 'connections') }
    finally { setConnectingButton(null) }
  }

  const connectionInProgress = connectingButton !== null || studioBusy === 'connection'

  if (pendingSelection) return <section className="studio-screen" aria-labelledby="connection-account-title"><div className="card onboarding-panel">
    <div className="onboarding-panel-head"><span>CONNECT LINKEDIN</span><h2 id="connection-account-title">Choose where to publish</h2><p>Select one personal LinkedIn profile or Company Page for this connection.</p></div>
    {pendingSelection.loading ? <div className="li-loading" role="status"><LoaderCircle className="spin" size={18} /> Loading your LinkedIn accounts…</div> : null}
    {error ? <div className="onboarding-plain-error" role="alert"><TriangleAlert size={17} /><span>{error}</span></div> : null}
    {!pendingSelection.loading && !error ? <div className="onboarding-networks">{pendingSelection.accounts.map((account) => { const personal = account.account_type === 'PERSON'; const pending = selectionBusy === `${account.account_type}:${account.id}`; return <article className="onboarding-network featured" key={`${account.account_type}:${account.id}`}><span className="onboarding-network-icon"><Linkedin size={20} /></span><div><h3>{account.name}</h3><p>{account.vanity_name ? `linkedin.com/${personal ? 'in' : 'company'}/${account.vanity_name}` : personal ? 'Personal LinkedIn profile' : 'LinkedIn Company Page'}</p></div><button className="button button-dark" type="button" disabled={Boolean(selectionBusy)} aria-busy={pending} onClick={() => void chooseAccount(account)}>{pending ? <LoaderCircle className="spin" size={16} /> : null} Connect {personal ? 'Profile' : 'Page'}</button></article> })}</div> : null}
    <div className="onboarding-actions"><button className="li-quiet-button" type="button" disabled={Boolean(selectionBusy)} onClick={() => void cancelSelection()}>Cancel</button>{error ? <button className="button button-dark" type="button" onClick={() => void connect('options-linkedin', 'LINKEDIN')}>Try again</button> : null}</div>
  </div></section>

  return <section className="studio-screen" aria-label="Social account connections">
    {error && <div className="li-banner error" role="alert">{error}</div>}

    {overview && (
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          marginBottom: '16px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: '#f3f4f6',
              color: '#374151',
            }}
          >
            {overview.role_label} Plan
          </span>
          <span style={{ fontSize: '0.92rem', color: '#111827' }}>
            Connected Accounts:{' '}
            <strong>
              {overview.connections.unlimited
                ? `${connections?.length || 0} (Unlimited)`
                : `${connections?.length || 0} of ${overview.connections.limit} active`}
            </strong>
          </span>
        </div>

        {!overview.connections.unlimited && (
          <Link
            to="/content/settings?tab=plan"
            className="button button-outline"
            style={{ fontSize: '0.82rem', padding: '6px 14px', textDecoration: 'none' }}
          >
            {overview.connections.limit === 0
              ? 'Upgrade to Connect Accounts'
              : 'Add Extra Connection ($5/mo)'}
          </Link>
        )}
      </div>
    )}

    {!connections ? <div className="li-loading" role="status">Loading social accounts…</div> : connections.length === 0 ? <div className="card"><div className="li-empty"><Link2 size={30} /><strong>No social accounts yet</strong><p>Connect LinkedIn or Instagram to publish from Visiofy Studio. You can also continue creating drafts without a connection.</p><button className="button button-dark" type="button" disabled={isDemo || connectionInProgress} aria-busy={connectingButton === 'empty-linkedin'} onClick={() => void connect('empty-linkedin', 'LINKEDIN')}>{connectingButton === 'empty-linkedin' ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />} Connect LinkedIn</button></div></div> : <div className="connection-card-grid">{connections.map((connection) => <ConnectionCard connection={connection} busy={busy.startsWith(connection.id) ? busy : ""} onAction={act} key={connection.id} />)}</div>}
    <div className="card redesigned-connect-options">
      <div className="connect-options-head">
        <div className="connect-options-title">
          <span className="connect-options-icon" aria-hidden="true"><Plus size={20} /></span>
          <div>
            <span className="connect-options-eyebrow">ADD A CHANNEL</span>
            <h2>Connect another account</h2>
            <p>Bring another social profile into your publishing workspace.</p>
          </div>
        </div>
      </div>

      <div className="connect-platform-cards">
        <article className="connect-platform-card linkedin">
          <div className="platform-card-header">
            <span className="platform-brand-icon linkedin" aria-hidden="true"><Linkedin size={21} /></span>
            <div className="platform-card-meta">
              <strong>LinkedIn</strong>
              <small>Profile or Company Page</small>
            </div>
          </div>
          <p className="platform-card-desc">Publish professional content to your personal profile or a Company Page you manage.</p>
          <button className="button connect-platform-action linkedin" type="button" disabled={isDemo || connectionInProgress || !onboarding.networks.some((item) => item.network === 'LINKEDIN' && item.enabled)} aria-busy={connectingButton === 'options-linkedin'} onClick={() => void connect('options-linkedin', 'LINKEDIN')}>
            {connectingButton === 'options-linkedin' ? <LoaderCircle className="spin" size={17} /> : <Linkedin size={17} />}
            <span>Connect LinkedIn</span>
            {connectingButton !== 'options-linkedin' && <ArrowRight className="connect-action-arrow" size={16} />}
          </button>
        </article>

        <article className="connect-platform-card instagram">
          <div className="platform-card-header">
            <span className="platform-brand-icon instagram" aria-hidden="true"><Instagram size={21} /></span>
            <div className="platform-card-meta">
              <strong>Instagram</strong>
              <small>Business or Creator account</small>
            </div>
          </div>
          <p className="platform-card-desc">Plan and publish visual content through an eligible professional Instagram account.</p>
          {!onboarding.networks.some((item) => item.network === 'INSTAGRAM' && item.enabled) && (
            <small className="platform-unavailable-hint">Available after your publishing provider is configured.</small>
          )}
          <button className="button connect-platform-action instagram" type="button" disabled={isDemo || connectionInProgress || !onboarding.networks.some((item) => item.network === 'INSTAGRAM' && item.enabled)} aria-busy={connectingButton === 'options-instagram'} onClick={() => void connect('options-instagram', 'INSTAGRAM')}>
            {connectingButton === 'options-instagram' ? <LoaderCircle className="spin" size={17} /> : <Instagram size={17} />}
            <span>Connect Instagram</span>
            {connectingButton !== 'options-instagram' && <ArrowRight className="connect-action-arrow" size={16} />}
          </button>
        </article>
      </div>

      <div className="connect-security-note">
        <span className="connect-security-icon" aria-hidden="true"><ShieldCheck size={18} /></span>
        <div>
          <strong>Your credentials stay private</strong>
          <span>Connections use secure OAuth. Visiofy Studio never sees or stores your password.</span>
        </div>
      </div>
    </div>
  </section>
}

function ConnectionCard({ connection, busy, onAction }: { connection: StudioConnection; busy: string; onAction: (connection: StudioConnection, action: 'RECONNECT' | 'DISCONNECT' | 'PREPARE_REMOVE' | 'REMOVE') => Promise<boolean> }) {
  const Icon = networkIcons[connection.network] ?? Link2
  const healthy = connection.health === 'HEALTHY'
  const disconnected = connection.status === 'DISCONNECTED'
  const canRemove = Boolean(connection.can_remove)
  const providerManaged = connection.removal_method === 'PROVIDER_MANAGED'
  const [confirming, setConfirming] = useState<'DISCONNECT' | 'REMOVE' | null>(() => sessionStorage.getItem('pending_account_removal') === connection.id ? 'REMOVE' : null)
  const pending = confirming ? busy === `${connection.id}-${confirming}` : false

  const confirmAction = async () => {
    if (confirming && await onAction(connection, confirming)) setConfirming(null)
  }

  return <article className={`card studio-connection-card ${disconnected ? 'disconnected' : healthy ? 'healthy' : 'attention'}`}>
    <header className="connection-card-header">
      <span className={`connection-network-icon ${connection.network.toLowerCase()}`}>
        <Icon size={22} />
      </span>
      <div className="connection-card-header-info">
        <span className="connection-network-badge">{connection.network_label}</span>
        <h3 className="connection-display-name">{connection.display_name || 'Account name unavailable'}</h3>
        <p className="connection-account-type">{connection.account_type || 'Social account'}{connection.provider_label ? ` · via ${connection.provider_label}` : ''}</p>
      </div>
      <span className={`connection-health ${disconnected ? 'disconnected' : healthy ? 'ready' : 'attention'}`}>
        {disconnected ? <Unlink size={14} /> : healthy ? <CheckCircle2 size={14} /> : <RefreshCw size={14} />} {disconnected ? 'Disconnected' : healthy ? 'Ready' : 'Needs attention'}
      </span>
    </header>
    <div className="connection-detail">
      <strong>{connection.message}</strong>
      <small>{connection.status === 'DISCONNECTED' && connection.disconnected_at ? `Disconnected ${new Date(connection.disconnected_at).toLocaleDateString()}` : connection.connected_at ? `Connected ${new Date(connection.connected_at).toLocaleDateString()}` : 'Not currently connected'} · Checked {new Date(connection.last_checked_at).toLocaleString()}</small>
    </div>
    <footer>{confirming ? <div className="connection-disconnect-confirm" role="alertdialog" aria-labelledby={`connection-${connection.id}-title`} aria-describedby={`connection-${connection.id}-description`}>
      <strong id={`connection-${connection.id}-title`}>{confirming === 'REMOVE' ? 'Remove' : 'Disconnect'} {connection.display_name || connection.network_label}?</strong>
      <p id={`connection-${connection.id}-description`}>{confirming === 'REMOVE' ? providerManaged ? 'Open Upload Post in a new tab and disconnect this account there. Return to this page and verify removal; Visiofy Studio will remove the card only after Upload Post confirms the account is gone. Drafts and published posts stay.' : 'This account will be removed from Visiofy Studio and Zernio, freeing its connected-account slot. Scheduled posts will need a new connection. Drafts and published posts stay.' : 'Visiofy Studio will stop publishing to this account, and scheduled posts will move to Needs attention. Drafts and published posts stay. Revoke the platform grant separately in your social account settings if needed.'}</p>
      <div><button className="li-quiet-button" type="button" disabled={Boolean(busy)} onClick={() => { sessionStorage.removeItem('pending_account_removal'); setConfirming(null) }}>Keep connected</button>{confirming === 'REMOVE' && providerManaged ? <><button className="li-quiet-button" type="button" disabled={Boolean(busy)} onClick={() => void onAction(connection, 'PREPARE_REMOVE')}>Open account manager</button><button className="content-danger-button" type="button" disabled={Boolean(busy)} aria-busy={pending} onClick={() => void confirmAction()}>{pending ? <LoaderCircle className="spin" size={15} /> : <Unlink size={15} />} Verify removal</button></> : <button className="content-danger-button" type="button" disabled={Boolean(busy)} aria-busy={pending} onClick={() => void confirmAction()}>{pending ? <LoaderCircle className="spin" size={15} /> : <Unlink size={15} />} {confirming === 'REMOVE' ? 'Remove account' : 'Disconnect account'}</button>}</div>
    </div> : <div className="connection-card-actions">
      {disconnected ? <button className="button button-dark" type="button" disabled={Boolean(busy)} aria-busy={busy === `${connection.id}-RECONNECT`} onClick={() => void onAction(connection, 'RECONNECT')}>{busy === `${connection.id}-RECONNECT` ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Reconnect</button> : <button className="li-text-button" type="button" disabled={Boolean(busy)} onClick={() => setConfirming('DISCONNECT')}><Unlink size={15} /> Disconnect</button>}
      {canRemove && <button className="li-text-button danger" type="button" disabled={Boolean(busy)} onClick={() => setConfirming('REMOVE')}><Unlink size={15} /> Remove account</button>}
      {!canRemove && <small className="connection-removal-note">To free this account's provider slot, remove it in the publishing service's account manager.</small>}
    </div>}</footer>
  </article>
}
