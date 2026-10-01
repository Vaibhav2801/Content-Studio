import { useEffect, useState } from 'react'
import { billingApi } from '../api/billingApi'
import type { PricingCatalog } from '../types/billing'

let pendingCatalog: Promise<PricingCatalog> | null = null

// Keep public pricing readable during the initial request and in local previews
// where the backend may not be running. The API response still replaces this
// snapshot as soon as it is available.
const fallbackCatalog: PricingCatalog = {
  currency: 'USD',
  credit_costs: { draft: 2, image: 1, image_regeneration: 1 },
  plans: [
    { id: 'free', name: 'Free', product_id: null, price: 0, credits: 15, connections: 0, engage: false },
    { id: 'starter', name: 'Starter', product_id: 'plan_starter_monthly', price: 9, credits: 50, connections: 1, engage: false },
    { id: 'advance', name: 'Premium', product_id: 'plan_advance_monthly', price: 14, credits: 150, connections: 1, engage: true },
    { id: 'custom', name: 'Custom', product_id: null, price: null, credits: null, connections: null, engage: true },
  ],
  addons: [
    { product_id: 'booster_50', kind: 'booster', amount: '10.00', credits: 50, title: '50 AI Credit Booster' },
    { product_id: 'booster_150', kind: 'booster', amount: '25.00', credits: 150, title: '150 AI Credit Booster' },
    { product_id: 'booster_350', kind: 'booster', amount: '50.00', credits: 350, title: '350 AI Credit Booster' },
    { product_id: 'connection_1_monthly', kind: 'connection', amount: '5.00', connections: 1, title: 'Additional Social Connection' },
    { product_id: 'engage_monthly', kind: 'engage', amount: '15.00', title: 'Engage Automation Suite Add-On' },
  ],
  simulated_checkout_enabled: false,
  simulated_checkout_status: 'disabled',
}

function loadCatalog() {
  pendingCatalog ??= billingApi.getCatalog().finally(() => {
    pendingCatalog = null
  })
  return pendingCatalog
}

export function usePricingCatalog() {
  const [catalog, setCatalog] = useState<PricingCatalog>(fallbackCatalog)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void loadCatalog().then((value) => {
      if (active) {
        setCatalog(value)
        setLoading(false)
      }
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : 'Pricing is temporarily unavailable.')
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [])

  return { catalog, error, loading }
}
