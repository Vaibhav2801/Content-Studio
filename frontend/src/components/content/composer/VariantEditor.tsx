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
  onRewrite: (action: RewriteAction, alternativeIndex?: number) => void
}

function FieldErrors({ messages }: { messages?: string[] }) {
  return messages?.length ? <div className="composer-field-error" role="alert">{messages.map((message) => <span key={message}>{message}</span>)}</div> : null
}

export function VariantEditor({ variant, busy, onChange, onRewrite }: Props) {
  const limit = variant.network === 'X' ? 280 : variant.network === 'INSTAGRAM' ? 2200 : 3000
  const qualityIssues = [...(variant.quality_check?.deterministic ?? []), ...(variant.quality_check?.suggestions ?? [])].filter((item) => item.status !== 'PASS')
  const quickFix = (key: string): { action: RewriteAction; label: string } | null => {
    if (key === 'hook_quality') return { action: 'NEW_HOOK', label: 'Fix hook' }
    if (key === 'promotional_intensity') return { action: 'REDUCE_PROMOTION', label: 'Tone down' }
    if (key === 'platform_fit') return { action: 'MAKE_SHORTER', label: 'Shorten' }
    return null
  }
  return <section className="variant-editor" aria-label={`${variant.network_label} editor`}>
    <div className="rewrite-actions" aria-label="Writing actions">{actions.filter((item) => !item.network || item.network === variant.network).map((item) => <button type="button" disabled={busy || !variant.copy} key={item.action} onClick={() => onRewrite(item.action)}>{item.label}</button>)}<button type="button" disabled={busy || !variant.copy} onClick={() => onRewrite('GENERATE_ALTERNATIVES')}>Show 2 more options</button><small>Extra options run only when requested.</small></div>
    {variant.metadata.alternatives?.length ? <section className="composer-alternatives" aria-label="Alternative drafts"><header><strong>Choose another direction</strong><small>Created together in one AI request.</small></header>{variant.metadata.alternatives.map((option, index) => <article key={`${index}-${option.copy.slice(0, 24)}`}><p>{option.copy}</p><small>{option.hashtags.join(' ')}</small><button type="button" className="li-quiet-button" disabled={busy} onClick={() => onRewrite('USE_ALTERNATIVE', index)}>Use this option</button></article>)}</section> : null}
    {variant.quality_check && <section className={`composer-quality ${qualityIssues.length ? 'attention' : 'pass'}`} aria-label="Draft quality check"><header><strong>{qualityIssues.length ? `${qualityIssues.length} item${qualityIssues.length === 1 ? '' : 's'} to review` : 'Draft checks passed'}</strong><small>Automatic checks · no extra AI request</small></header>{qualityIssues.map((item) => { const fix = quickFix(item.key); return <div key={item.key}><span><strong>{item.label}</strong><small>{item.message}</small></span>{fix && <button type="button" disabled={busy} onClick={() => onRewrite(fix.action)}>{fix.label}</button>}</div> })}</section>}
    <label className="li-field"><span>Post text <small>{variant.copy.length}/{limit}</small></span><textarea value={variant.copy} onChange={(event) => onChange({ copy: event.target.value })} aria-invalid={Boolean(variant.validation.fields.copy?.length)} /></label>
    <FieldErrors messages={variant.validation.fields.copy} />
    <label className="li-field"><span>Hashtags <small>separate with spaces or commas</small></span><input value={variant.hashtags.join(' ')} onChange={(event) => onChange({ hashtags: event.target.value.split(/[\s,]+/).filter(Boolean).map((tag) => tag.startsWith('#') ? tag : `#${tag}`) })} aria-invalid={Boolean(variant.validation.fields.hashtags?.length)} /></label>
    <FieldErrors messages={variant.validation.fields.hashtags} />
    <FieldErrors messages={variant.validation.fields.connection} />
  </section>
}
