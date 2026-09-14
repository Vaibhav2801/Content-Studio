import type { RewriteAction, SocialVariant } from '../../../types/socialComposer'

const actions: { action: RewriteAction; label: string; network?: SocialVariant['network'] }[] = [
  { action: 'MAKE_SHORTER', label: 'Make shorter' },
  { action: 'MAKE_PERSONAL', label: 'Make more personal' },
  { action: 'NEW_HOOK', label: 'Try a new hook' },
  { action: 'REDUCE_PROMOTION', label: 'Reduce promotion' },
  { action: 'CREATE_X_THREAD', label: 'Create X thread', network: 'X' },
  { action: 'CREATE_INSTAGRAM_CAROUSEL', label: 'Create Instagram carousel', network: 'INSTAGRAM' },
]

interface Props {
  variant: SocialVariant
  busy: boolean
  onChange: (changes: Partial<Pick<SocialVariant, 'copy' | 'hashtags'>>) => void
  onRewrite: (action: RewriteAction) => void
}

function FieldErrors({ messages }: { messages?: string[] }) {
  return messages?.length ? <div className="composer-field-error" role="alert">{messages.map((message) => <span key={message}>{message}</span>)}</div> : null
}

export function VariantEditor({ variant, busy, onChange, onRewrite }: Props) {
  const limit = variant.network === 'X' ? 280 : variant.network === 'INSTAGRAM' ? 2200 : 3000
  return <section className="variant-editor" aria-label={`${variant.network_label} editor`}>
    <div className="rewrite-actions" aria-label="Writing actions">{actions.filter((item) => !item.network || item.network === variant.network).map((item) => <button type="button" disabled={busy || !variant.copy} key={item.action} onClick={() => onRewrite(item.action)}>{item.label}</button>)}</div>
    <label className="li-field"><span>Post text <small>{variant.copy.length}/{limit}</small></span><textarea value={variant.copy} onChange={(event) => onChange({ copy: event.target.value })} aria-invalid={Boolean(variant.validation.fields.copy?.length)} /></label>
    <FieldErrors messages={variant.validation.fields.copy} />
    <label className="li-field"><span>Hashtags <small>separate with spaces or commas</small></span><input value={variant.hashtags.join(' ')} onChange={(event) => onChange({ hashtags: event.target.value.split(/[\s,]+/).filter(Boolean).map((tag) => tag.startsWith('#') ? tag : `#${tag}`) })} aria-invalid={Boolean(variant.validation.fields.hashtags?.length)} /></label>
    <FieldErrors messages={variant.validation.fields.hashtags} />
    <FieldErrors messages={variant.validation.fields.connection} />
  </section>
}
