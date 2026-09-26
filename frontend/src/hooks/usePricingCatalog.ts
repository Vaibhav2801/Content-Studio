import { useEffect, useState } from 'react'
import { billingApi } from '../api/billingApi'
import type { PricingCatalog } from '../types/billing'

let pendingCatalog: Promise<PricingCatalog> | null = null

function loadCatalog() {
  pendingCatalog ??= billingApi.getCatalog().finally(() => {
    pendingCatalog = null
  })
  return pendingCatalog
}

export function usePricingCatalog() {
  const [catalog, setCatalog] = useState<PricingCatalog | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void loadCatalog().then((value) => {
      if (active) setCatalog(value)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Pricing is temporarily unavailable.')
    })
    return () => { active = false }
  }, [])

  return { catalog, error, loading: !catalog && !error }
}
