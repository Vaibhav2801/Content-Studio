import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

export function EmptyState({ icon: Icon, title, detail, action }: { icon: LucideIcon; title: string; detail: string; action?: { label: string; to: string } }) {
  return <div className="li-empty"><Icon size={30} /><strong>{title}</strong><p>{detail}</p>{action && <Link className="li-quiet-button" to={action.to}>{action.label}</Link>}</div>
}
