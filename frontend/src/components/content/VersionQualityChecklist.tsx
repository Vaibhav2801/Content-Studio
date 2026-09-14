import { AlertTriangle, CheckCircle2, ShieldX } from 'lucide-react'
import type { QualityCheckItem, VersionQualityReport } from '../../types/contentStudio'

function CheckIcon({ status }: Pick<QualityCheckItem, 'status'>) {
  if (status === 'BLOCKED') return <ShieldX aria-hidden="true" size={16} />
  if (status === 'REVIEW_SUGGESTED') return <AlertTriangle aria-hidden="true" size={16} />
  return <CheckCircle2 aria-hidden="true" size={16} />
}

export function VersionQualityChecklist({ report }: { report?: VersionQualityReport }) {
  if (!report?.summary) {
    return <div className="quality-check quality-check-legacy"><strong>Quality check</strong><span>This older version does not have a saved quality report.</span></div>
  }
  const items = [...(report.deterministic ?? []), ...(report.suggestions ?? [])]
  const attention = items.filter((item) => item.status !== 'PASS')
  const state = report.hard_blocked ? 'blocked' : report.review_suggested ? 'review' : 'ready'
  const heading = report.hard_blocked ? 'Changes required' : report.review_suggested ? 'Review suggested' : 'Ready for approval'

  return <section className={`quality-check quality-${state}`} aria-label="Pre-approval quality check">
    <div className="quality-check-heading"><CheckIcon status={report.hard_blocked ? 'BLOCKED' : report.review_suggested ? 'REVIEW_SUGGESTED' : 'PASS'} /><span><strong>{heading}</strong><small>{report.summary.passed} passed · {report.summary.review} to review · {report.summary.blocked} blocked</small></span></div>
    {attention.length > 0 ? <ul className="quality-check-short">{attention.slice(0, 3).map((item) => <li key={item.key}><CheckIcon status={item.status} /><span>{item.label}</span></li>)}</ul> : <p className="quality-check-clear"><CheckCircle2 size={15} /> All checks passed.</p>}
    <details className="quality-check-details"><summary>View quality details</summary><div><QualityGroup title="Required checks" items={report.deterministic ?? []} /><QualityGroup title="Editorial suggestions" items={report.suggestions ?? []} /></div></details>
  </section>
}

function QualityGroup({ title, items }: { title: string; items: QualityCheckItem[] }) {
  return <section><h5>{title}</h5><ul>{items.map((item) => <li className={`quality-item quality-item-${item.status.toLowerCase()}`} key={item.key}><CheckIcon status={item.status} /><span><strong>{item.label}</strong><small>{item.message}</small></span></li>)}</ul></section>
}
