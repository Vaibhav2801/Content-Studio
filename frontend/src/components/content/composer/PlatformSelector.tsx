import { Instagram, Linkedin } from 'lucide-react'
import type { ComposerConnection, SocialNetwork } from '../../../types/socialComposer'

interface Props {
  connections: ComposerConnection[]
  selected: SocialNetwork[]
  onChange: (networks: SocialNetwork[]) => void
}

export function PlatformSelector({ connections, selected, onChange }: Props) {
  const toggle = (network: SocialNetwork) => {
    onChange(selected.includes(network) ? selected.filter((item) => item !== network) : [...selected, network])
  }
  return <fieldset className="composer-platforms">
    <legend>Where should this post appear?</legend>
    {connections.length ? connections.map((connection) => <label key={connection.network}>
      <input type="checkbox" checked={selected.includes(connection.network)} onChange={() => toggle(connection.network)} />
      <span className={`platform-mark ${connection.network.toLowerCase()}`}>{connection.network === 'LINKEDIN' ? <Linkedin size={17} /> : connection.network === 'INSTAGRAM' ? <Instagram size={17} /> : <strong>X</strong>}</span>
      <span><strong>{connection.label}</strong><small>{connection.display_name} · {connection.account_type}</small></span>
    </label>) : <p className="composer-inline-empty">Connect a social account before creating a platform post.</p>}
  </fieldset>
}
