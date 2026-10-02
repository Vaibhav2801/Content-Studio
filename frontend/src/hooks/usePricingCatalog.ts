import { useEffect, useState } from 'react'
import { billingApi } from '../api/billingApi'
import type { PricingCatalog } from '../types/billing'
import { detectBrowserCountryCode } from '../utils/money'

const pendingCatalog = new Map<string, Promise<PricingCatalog>>()

function expectedRegion(): PricingCatalog['pricing_region'] {
  return 'global'
}

function catalogMatchesCountry(catalog: PricingCatalog): boolean {
  const region = expectedRegion()
  const starter = catalog.plans?.find((plan) => plan.id === 'starter')
  const premium = catalog.plans?.find((plan) => plan.id === 'advance')
  return catalog.pricing_region === region
    && catalog.currency === 'USD'
    && starter?.price === 14
    && premium?.price === 20
}

// Keep public pricing readable during the initial request and in local previews
// where the backend may not be running. The API response still replaces this
// snapshot as soon as it is available.
function fallbackCatalog(countryCode: string): PricingCatalog {
  const country = countryCode.toUpperCase()
  const region = expectedRegion()
  const prices = { starter: 14, advance: 20, booster50: '10.00', booster150: '25.00', booster350: '50.00', connection: '5.00', engage: '15.00' }
  return {
  country_code: country,
  pricing_region: region,
  region_label: 'Worldwide',
  currency: 'USD',
  checkout_available: true,
  availability_message: '',
  credit_costs: { draft: 2, image: 1, image_regeneration: 1 },
  plans: [
    { id: 'free', name: 'Free', product_id: null, price: 0, credits: 15, connections: 0, engage: false },
    { id: 'starter', name: 'Starter', product_id: 'plan_starter_monthly', price: prices.starter, credits: 50, connections: 1, engage: false },
    { id: 'advance', name: 'Premium', product_id: 'plan_advance_monthly', price: prices.advance, credits: 150, connections: 1, engage: true },
    { id: 'custom', name: 'Custom', product_id: null, price: null, credits: null, connections: null, engage: true },
  ],
  addons: [
    { product_id: 'booster_50', kind: 'booster', amount: prices.booster50, credits: 50, title: '50 AI Credit Booster' },
    { product_id: 'booster_150', kind: 'booster', amount: prices.booster150, credits: 150, title: '150 AI Credit Booster' },
    { product_id: 'booster_350', kind: 'booster', amount: prices.booster350, credits: 350, title: '350 AI Credit Booster' },
    { product_id: 'connection_1_monthly', kind: 'connection', amount: prices.connection, connections: 1, title: 'Additional Social Connection' },
    { product_id: 'engage_monthly', kind: 'engage', amount: prices.engage, title: 'Engage Automation Suite Add-On' },
  ],
  simulated_checkout_enabled: false,
  simulated_checkout_status: 'disabled',
  }
}

function loadCatalog(countryCode: string) {
  const existing = pendingCatalog.get(countryCode)
  if (existing) return existing
  const request = billingApi.getCatalog(countryCode).finally(() => {
    pendingCatalog.delete(countryCode)
  })
  pendingCatalog.set(countryCode, request)
  return request
}

export function usePricingCatalog(countryCode?: string) {
  const resolvedCountry = (countryCode || detectBrowserCountryCode()).toUpperCase()
  const [catalog, setCatalog] = useState<PricingCatalog>(() => fallbackCatalog(resolvedCountry))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setCatalog(fallbackCatalog(resolvedCountry))
    setLoading(true)
    void loadCatalog(resolvedCountry).then((value) => {
      if (active) {
        // A stale backend process can still answer with former plan prices.
        // Never let that late response replace the current USD catalog.
        setCatalog(catalogMatchesCountry(value) ? value : fallbackCatalog(resolvedCountry))
        setLoading(false)
      }
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : 'Pricing is temporarily unavailable.')
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [resolvedCountry])

  return { catalog, error, loading }
}
