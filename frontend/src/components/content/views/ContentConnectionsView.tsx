import { CheckCircle2, Instagram, Linkedin, Link2, LoaderCircle, RefreshCw, Unlink, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { contentStudioApi } from '../../../api/contentStudio'
import { contentStudioMockConnections } from '../../../api/contentStudioMock'
import type { StudioConnection } from '../../../types/contentStudio'
import { useContentStudio } from '../ContentStudioContext'
import { customerSafeMessage } from '../contentUtils'

const networkIcons: Record<string, LucideIcon> = { LINKEDIN: Linkedin, INSTAGRAM: Instagram, X: Link2 }
type ConnectButton = 'empty-linkedin' | 'options-linkedin' | 'options-instagram'

export function ContentConnectionsView() {
  const { isDemo, onboarding, busy: studioBusy, connectLinkedIn } = useContentStudio()
  const [connections, setConnections] = useState<StudioConnection[] | null>(null)
  const [busy, setBusy] = useState('')
  const [connectingButton, setConnectingButton] = useState<ConnectButton | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try { setConnections(isDemo ? structuredClone(contentStudioMockConnections) : await contentStudioApi.connections()) }
    catch (loadError) { setError(customerSafeMessage(loadError instanceof Error ? loadError.message : undefined, 'Could not load social accounts.')) }
  }, [isDemo])
  useEffect(() => { void load() }, [load])

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
      setError(customerSafeMessage(actionError instanceof Error ? actionError.message : undefined, action === 'RECONNECT' ? 'The social account connection step could not start.' : action === 'PREPARE_REMOVE' ? 'Could not open the account manager.' : action === 'REMOVE' ? 'Could not remove this social account.' : 'Could not disconnect this social account.'))
      return false
    }
    finally { setBusy('') }
  }

  const connect = async (button: ConnectButton, network: 'LINKEDIN' | 'INSTAGRAM') => {
    if (connectingButton) return
    setConnectingButton(button)
    try { await connectLinkedIn(network) }
    finally { setConnectingButton(null) }
  }

  const connectionInProgress = connectingButton !== null || studioBusy === 'connection'

  return <section className="studio-screen" aria-label="Social account connections">
    {error && <div className="li-banner error" role="alert">{error}</div>}
    {!connections ? <div className="li-loading" role="status">Loading social accounts…</div> : connections.length === 0 ? <div className="card"><div className="li-empty"><Link2 size={30} /><strong>No social accounts yet</strong><p>Connect LinkedIn or Instagram to publish from Content Studio. You can also continue creating drafts without a connection.</p><button className="button button-dark" type="button" disabled={isDemo || connectionInProgress} aria-busy={connectingButton === 'empty-linkedin'} onClick={() => void connect('empty-linkedin', 'LINKEDIN')}>{connectingButton === 'empty-linkedin' ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />} Connect LinkedIn</button></div></div> : <div className="connection-card-grid">{connections.map((connection) => <ConnectionCard connection={connection} busy={busy.startsWith(connection.id) ? busy : ""} onAction={act} key={connection.id} />)}</div>}
    <div className="card content-connect-options">
      <h2>Connect another account</h2>
      <p>Choose a personal LinkedIn profile or Company Page, or connect an Instagram Business or Creator account.</p>
      <button className="button button-dark" type="button" disabled={isDemo || connectionInProgress || !onboarding.networks.some((item) => item.network === 'LINKEDIN' && item.enabled)} aria-busy={connectingButton === 'options-linkedin'} onClick={() => void connect('options-linkedin', 'LINKEDIN')}>{connectingButton === 'options-linkedin' ? <LoaderCircle className="spin" size={16} /> : <Linkedin size={16} />} Connect LinkedIn</button>
      <button className="button button-dark" type="button" disabled={isDemo || connectionInProgress || !onboarding.networks.some((item) => item.network === 'INSTAGRAM' && item.enabled)} aria-busy={connectingButton === 'options-instagram'} onClick={() => void connect('options-instagram', 'INSTAGRAM')}>{connectingButton === 'options-instagram' ? <LoaderCircle className="spin" size={16} /> : <Instagram size={16} />} Connect Instagram</button>
      {!onboarding.networks.some((item) => item.network === 'INSTAGRAM' && item.enabled) && <small>Instagram connection is unavailable until the selected publishing provider is configured and healthy.</small>}
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
    <header><span className="connection-network-icon"><Icon size={21} /></span><div><span>{connection.network_label}</span><h3>{connection.display_name || 'Account name unavailable'}</h3><p>{connection.account_type || 'Social account'}{connection.provider_label ? ` · via ${connection.provider_label}` : ''}</p></div><span className={`connection-health ${disconnected ? 'disconnected' : healthy ? 'ready' : 'attention'}`}>{disconnected ? <Unlink size={15} /> : healthy ? <CheckCircle2 size={15} /> : <RefreshCw size={15} />} {disconnected ? 'Disconnected' : healthy ? 'Ready' : 'Needs attention'}</span></header>
    <div className="connection-detail"><strong>{connection.message}</strong><small>{connection.status === 'DISCONNECTED' && connection.disconnected_at ? `Disconnected ${new Date(connection.disconnected_at).toLocaleDateString()}` : connection.connected_at ? `Connected ${new Date(connection.connected_at).toLocaleDateString()}` : 'Not currently connected'} · Checked {new Date(connection.last_checked_at).toLocaleString()}</small></div>
    <footer>{confirming ? <div className="connection-disconnect-confirm" role="alertdialog" aria-labelledby={`connection-${connection.id}-title`} aria-describedby={`connection-${connection.id}-description`}>
      <strong id={`connection-${connection.id}-title`}>{confirming === 'REMOVE' ? 'Remove' : 'Disconnect'} {connection.display_name || connection.network_label}?</strong>
      <p id={`connection-${connection.id}-description`}>{confirming === 'REMOVE' ? providerManaged ? 'Open Upload Post in a new tab and disconnect this account there. Return to this page and verify removal; Content Studio will remove the card only after Upload Post confirms the account is gone. Drafts and published posts stay.' : 'This account will be removed from Content Studio and Zernio, freeing its connected-account slot. Scheduled posts will need a new connection. Drafts and published posts stay.' : 'Content Studio will stop publishing to this account, and scheduled posts will move to Needs attention. Drafts and published posts stay. Revoke the platform grant separately in your social account settings if needed.'}</p>
      <div><button className="li-quiet-button" type="button" disabled={Boolean(busy)} onClick={() => { sessionStorage.removeItem('pending_account_removal'); setConfirming(null) }}>Keep connected</button>{confirming === 'REMOVE' && providerManaged ? <><button className="li-quiet-button" type="button" disabled={Boolean(busy)} onClick={() => void onAction(connection, 'PREPARE_REMOVE')}>Open account manager</button><button className="content-danger-button" type="button" disabled={Boolean(busy)} aria-busy={pending} onClick={() => void confirmAction()}>{pending ? <LoaderCircle className="spin" size={15} /> : <Unlink size={15} />} Verify removal</button></> : <button className="content-danger-button" type="button" disabled={Boolean(busy)} aria-busy={pending} onClick={() => void confirmAction()}>{pending ? <LoaderCircle className="spin" size={15} /> : <Unlink size={15} />} {confirming === 'REMOVE' ? 'Remove account' : 'Disconnect account'}</button>}</div>
    </div> : <div className="connection-card-actions">
      {disconnected ? <button className="button button-dark" type="button" disabled={Boolean(busy)} aria-busy={busy === `${connection.id}-RECONNECT`} onClick={() => void onAction(connection, 'RECONNECT')}>{busy === `${connection.id}-RECONNECT` ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Reconnect</button> : <button className="li-text-button" type="button" disabled={Boolean(busy)} onClick={() => setConfirming('DISCONNECT')}><Unlink size={15} /> Disconnect</button>}
      {canRemove && <button className="li-text-button danger" type="button" disabled={Boolean(busy)} onClick={() => setConfirming('REMOVE')}><Unlink size={15} /> Remove account</button>}
      {!canRemove && <small className="connection-removal-note">To free this account's provider slot, remove it in the publishing service's account manager.</small>}
    </div>}</footer>
  </article>
}
