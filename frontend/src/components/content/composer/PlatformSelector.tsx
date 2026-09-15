import { Instagram, Linkedin } from 'lucide-react'
import type { ComposerConnection, SocialNetwork } from '../../../types/socialComposer'

interface Props {
  connections: ComposerConnection[]
  selected: SocialNetwork[]
  selectedConnections: Partial<Record<SocialNetwork, string>>
  onChange: (networks: SocialNetwork[]) => void
  onConnectionChange: (network: SocialNetwork, connectionId: string) => void
}

export function PlatformSelector({ connections, selected, selectedConnections, onChange, onConnectionChange }: Props) {
  const toggle = (connection: ComposerConnection) => {
    const alreadySelected = selected.includes(connection.network) && selectedConnections[connection.network] === connection.id
    if (alreadySelected) onChange(selected.filter((item) => item !== connection.network))
    else {
      onConnectionChange(connection.network, connection.id)
      if (!selected.includes(connection.network)) onChange([...selected, connection.network])
    }
  }
  return <fieldset className="composer-platforms">
    <legend>Which accounts should publish this post?</legend>
    {connections.length ? connections.map((connection) => <label key={connection.id}>
      <input type="checkbox" checked={selected.includes(connection.network) && selectedConnections[connection.network] === connection.id} onChange={() => toggle(connection)} />
      <span className={`platform-mark ${connection.network.toLowerCase()}`}>{connection.network === 'LINKEDIN' ? <Linkedin size={17} /> : connection.network === 'INSTAGRAM' ? <Instagram size={17} /> : <strong>X</strong>}</span>
      <span><strong>{connection.label}</strong><small>{connection.display_name} · {connection.account_type}</small></span>
    </label>) : <p className="composer-inline-empty">Connect a social account before creating a platform post.</p>}
  </fieldset>
}
