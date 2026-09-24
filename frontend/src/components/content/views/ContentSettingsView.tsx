import { CreditCard } from 'lucide-react'
import { useContentStudio } from '../ContentStudioContext'
import { ContentBillingTab } from './ContentBillingTab'

export function ContentSettingsView() {
  const { reload } = useContentStudio()

  return (
    <section className="li-settings-page" aria-label="Content Studio settings">
      <header style={{ marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <CreditCard size={20} /> Plan &amp; Invoices
        </h2>
        <p style={{ margin: '4px 0 0', color: '#64748b' }}>Manage your Content Studio plan, credits, billing details, and invoices.</p>
      </header>
      <ContentBillingTab onPlanChanged={() => void reload()} />
    </section>
  )
}
