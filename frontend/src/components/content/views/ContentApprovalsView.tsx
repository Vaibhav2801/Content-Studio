import { BookOpen, Check, CheckSquare, Edit3, LoaderCircle, MessageSquareText, Send, ShieldAlert, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { contentStudioApi } from '../../../api/contentStudio'
import { contentStudioMockApprovals } from '../../../api/contentStudioMock'
import type { ApprovalGroups, ReviewVersion, StudioVariantCard } from '../../../types/contentStudio'
import { useContentStudio } from '../ContentStudioContext'
import { EmptyState } from '../EmptyState'
import { VersionQualityChecklist } from '../VersionQualityChecklist'
import { backendAssetUrl, customerSafeMessage } from '../contentUtils'

const groupDetails = [
  { key: 'NEEDS_REVIEW' as const, label: 'Needs review', detail: 'Ready for a decision.' },
  { key: 'CHANGES_REQUESTED' as const, label: 'Changes requested', detail: 'Waiting for an updated version.' },
  { key: 'APPROVED' as const, label: 'Approved', detail: 'Approved versions are locked for publishing.' },
]

export function ContentApprovalsView() {
  const { isDemo } = useContentStudio()
  const [groups, setGroups] = useState<ApprovalGroups | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    try { setGroups(isDemo ? structuredClone(contentStudioMockApprovals) : await contentStudioApi.approvals()) }
    catch (loadError) { setError(customerSafeMessage(loadError instanceof Error ? loadError.message : undefined, 'Could not load approvals.')) }
  }, [isDemo])
  useEffect(() => { void load() }, [load])

  const decide = async (item: StudioVariantCard, action: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT', version?: ReviewVersion, note?: string) => {
    setBusy(`${item.id}-${action}`); setError('')
    try {
      if (isDemo) {
        const next: ApprovalGroups = structuredClone(groups ?? contentStudioMockApprovals)
        const collections: StudioVariantCard[][] = [next.NEEDS_REVIEW, next.CHANGES_REQUESTED, next.APPROVED]
        collections.forEach((rows) => { const index = rows.findIndex((row) => row.id === item.id); if (index >= 0) rows.splice(index, 1) })
        if (action === 'APPROVE') next.APPROVED.push({ ...item, status: 'APPROVED', review_group: 'APPROVED', approved_version_id: version?.id })
        if (action === 'REQUEST_CHANGES') next.CHANGES_REQUESTED.push({ ...item, review_group: 'CHANGES_REQUESTED', review_note: note || '' })
        setGroups(next)
      } else setGroups(await contentStudioApi.reviewAction(item.id, { action, version_id: version?.id, note }))
      setSelected((current) => { const next = new Set(current); next.delete(item.id); return next })
    } catch (actionError) { setError(customerSafeMessage(actionError instanceof Error ? actionError.message : undefined, 'Could not complete that review action.')) }
    finally { setBusy('') }
  }

  const batch = async () => {
    if (!groups) return
    const rows = groups.NEEDS_REVIEW.filter((item) => selected.has(item.id) && item.versions?.[0] && !item.versions[0].quality_check?.hard_blocked)
    setBusy('batch'); setError('')
    try {
      if (isDemo) {
        let next = groups
        for (const item of rows) {
          const version = item.versions?.[0]
          if (version) {
            next = { ...next, NEEDS_REVIEW: next.NEEDS_REVIEW.filter((row) => row.id !== item.id), APPROVED: [...next.APPROVED, { ...item, status: 'APPROVED', review_group: 'APPROVED', approved_version_id: version.id }] }
          }
        }
        setGroups(next)
      } else setGroups(await contentStudioApi.batchApprove(rows.map((item) => ({ variant_id: item.id, version_id: item.versions![0].id }))))
      setSelected(new Set())
    } catch (batchError) { setError(customerSafeMessage(batchError instanceof Error ? batchError.message : undefined, 'Could not approve the selected posts.')) }
    finally { setBusy('') }
  }

  const publishNow = async (item: StudioVariantCard) => {
    setBusy(`${item.id}-PUBLISH`); setError(''); setNotice('')
    try {
      if (!isDemo) {
        const result = await contentStudioApi.publishNow(item.id)
        setNotice(result.publish_job.status === 'PUBLISHED' ? 'Post published successfully.' : 'Post submitted for publishing. Its status will update automatically.')
      } else setNotice('Post submitted for publishing. Its status will update automatically.')
      setGroups((current) => current ? { ...current, APPROVED: current.APPROVED.filter((row) => row.id !== item.id) } : current)
    } catch (publishError) {
      setError(customerSafeMessage(publishError instanceof Error ? publishError.message : undefined, 'Could not publish this post.'))
    } finally { setBusy('') }
  }

  const reviewCount = useMemo(() => (groups?.NEEDS_REVIEW.length ?? 0) + (groups?.CHANGES_REQUESTED.length ?? 0), [groups])
  return <section className="studio-screen" aria-label="Post approvals">
    {error && <div className="li-banner error" role="alert">{error}</div>}
    {notice && <div className="li-banner success" role="status">{notice}</div>}
    {selected.size > 0 && <div className="batch-review-bar"><span>{selected.size} selected</span><button className="button button-dark" disabled={Boolean(busy)} aria-busy={busy === "batch"} onClick={() => void batch()}>{busy === 'batch' ? <LoaderCircle className="spin" size={16} /> : <CheckSquare size={16} />} Approve selected versions</button></div>}
    {!groups ? <div className="li-loading" role="status">Loading approvals…</div> : reviewCount === 0 && !groups.APPROVED.length ? <div className="card"><EmptyState icon={CheckSquare} title="You’re all caught up" detail="Posts sent for approval will appear here." action={{ label: 'Create a post', to: '/content/create' }} /></div> : <div className="approval-groups">{groupDetails.map((group) => <section className="approval-group" key={group.key} aria-labelledby={`approval-${group.key}`}><header><div><h3 id={`approval-${group.key}`}>{group.label}</h3><p>{group.detail}</p></div><span>{groups[group.key].length}</span></header>{groups[group.key].length ? <div className="approval-card-list">{groups[group.key].map((item) => <ApprovalCard key={item.id} item={item} selectable={group.key === 'NEEDS_REVIEW'} selected={selected.has(item.id)} busy={busy.startsWith(item.id) ? busy : ""} onSelect={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(item.id); else next.delete(item.id); return next })} onAction={decide} onPublish={publishNow} />)}</div> : <p className="approval-empty">No posts in this group.</p>}</section>)}</div>}
  </section>
}

function ApprovalCard({ item, selectable, selected, busy, onSelect, onAction, onPublish }: { item: StudioVariantCard; selectable: boolean; selected: boolean; busy: string; onSelect: (value: boolean) => void; onAction: (item: StudioVariantCard, action: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT', version?: ReviewVersion, note?: string) => Promise<void>; onPublish: (item: StudioVariantCard) => Promise<void> }) {
  const versions = item.versions ?? []
  const [versionId, setVersionId] = useState(item.approved_version_id || versions[0]?.id || '')
  const [askingChanges, setAskingChanges] = useState(false)
  const [note, setNote] = useState(item.review_note)
  const version = versions.find((entry) => entry.id === versionId) ?? versions[0]
  const hardBlocked = Boolean(version?.quality_check?.hard_blocked)
  const latestHardBlocked = Boolean(versions[0]?.quality_check?.hard_blocked)
  const sourceReferences = version && Array.isArray(version.metadata.source_references) ? version.metadata.source_references as Array<{ id: string; label: string; source_type: string; available?: boolean }> : []
  const availableSources = sourceReferences.filter((source) => source.available !== false)
  const unavailableSources = sourceReferences.filter((source) => source.available === false)
  return <article className="card approval-card">
    <header>{selectable && <label className="approval-select"><input type="checkbox" checked={selected} disabled={latestHardBlocked} onChange={(event) => onSelect(event.target.checked)} /><span className="sr-only">Select {item.topic}</span></label>}<div><span>{item.network_label} · {item.account?.display_name || 'Draft only'}</span><h4>{item.topic}</h4><small>{item.source || 'New idea'}</small></div><span className={`li-status status-${item.status.toLowerCase()}`}>{item.review_group === 'CHANGES_REQUESTED' ? 'Changes requested' : item.review_group === 'APPROVED' ? 'Approved' : 'Needs review'}</span></header>
    {versions.length > 1 && <label className="version-picker">Preview version<select value={versionId} onChange={(event) => setVersionId(event.target.value)}>{versions.map((entry) => <option value={entry.id} key={entry.id}>Version {entry.version}{entry.approved_at ? ' · approved' : ''}</option>)}</select></label>}
    {version ? <><div className="exact-version-preview"><div><strong>Version {version.version}</strong><small>Saved {new Date(version.created_at).toLocaleString()}</small></div><p>{version.copy}</p><p className="preview-tags">{version.hashtags.join(' ')}</p>{availableSources.length > 0 && <div className="review-sources"><BookOpen size={14} /><span><strong>Sources used</strong>{availableSources.map((source) => source.label).join(', ')}</span></div>}{unavailableSources.length > 0 && <div className="approval-warning"><ShieldAlert size={15} /><span>Source support is no longer available. Review these claims before approval.</span></div>}{version.media[0]?.storage_url && <img src={backendAssetUrl(String(version.media[0].storage_url))} alt={String(version.media[0].alt_text || '')} />}</div><VersionQualityChecklist report={version.quality_check} /></> : <div className="composer-field-error">Send this draft for approval to create an exact version.</div>}
    {item.review_note && <div className="review-note"><MessageSquareText size={16} /><span><strong>Requested change</strong>{item.review_note}</span></div>}
    {item.review_group === 'APPROVED' && <div className="approval-warning"><ShieldAlert size={16} /><span>Editing this approved post creates a new version and revokes approval.</span></div>}
    {askingChanges && <label className="review-change-field">What should change?<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Give a clear, useful note…" /><span><button type="button" className="li-text-button" onClick={() => setAskingChanges(false)}>Cancel</button><button type="button" className="li-quiet-button" disabled={!note.trim() || Boolean(busy)} aria-busy={busy === item.id + "-REQUEST_CHANGES"} onClick={() => void onAction(item, 'REQUEST_CHANGES', version, note)}>Send request</button></span></label>}
    <footer><Link className="li-quiet-button" to={`/content/create?draft=${item.post_id}`}><Edit3 size={15} /> Edit</Link>{item.review_group !== 'APPROVED' && <button className="li-quiet-button" type="button" onClick={() => setAskingChanges(true)}><MessageSquareText size={15} /> Request changes</button>}<button className="li-text-button danger" type="button" disabled={Boolean(busy)} aria-busy={busy === item.id + "-REJECT"} onClick={() => void onAction(item, 'REJECT', version)}><Trash2 size={15} /> Reject</button>{item.review_group === 'APPROVED' ? <button className="button button-dark" type="button" disabled={Boolean(busy)} aria-busy={busy === item.id + "-PUBLISH"} onClick={() => void onPublish(item)}>{busy === item.id + "-PUBLISH" ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} Publish now</button> : <button className="button button-dark" type="button" disabled={!version || Boolean(busy) || hardBlocked || version.id !== versions[0]?.id} title={hardBlocked ? 'Fix required checks before approval.' : undefined} aria-busy={busy === item.id + "-APPROVE"} onClick={() => void onAction(item, 'APPROVE', version)}><Check size={15} /> Approve version</button>}</footer>
  </article>
}
