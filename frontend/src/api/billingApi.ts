import { csrfToken } from './auth'
import type {
  BillingInvoice,
  CheckoutPayload,
  CheckoutResponse,
  PricingCatalog,
  SubscriptionOverview,
} from '../types/billing'

const baseUrl = (import.meta.env.VITE_SOCIAL_API_BASE_URL as string | undefined) ?? '/api/v3/social'

export class BillingApiError extends Error {
  payload: Record<string, unknown>
  constructor(message: string, payload: Record<string, unknown> = {}) {
    super(message)
    this.name = 'BillingApiError'
    this.payload = payload
  }
}

function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(firstMessage).find(Boolean)
  if (value && typeof value === 'object') return Object.values(value).map(firstMessage).find(Boolean)
  return undefined
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method?.toUpperCase() ?? 'GET'
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  headers.set('Content-Type', 'application/json')
  const token = csrfToken()
  if (method !== 'GET' && token) headers.set('X-CSRFToken', token)
  const response = await fetch(`${baseUrl}${path}`, { ...options, credentials: 'include', headers })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
    const message = firstMessage(payload.detail) || firstMessage(payload.error) || firstMessage(payload)
    throw new BillingApiError(message || `Request failed (${response.status})`, payload)
  }
  return response.json() as Promise<T>
}

export const billingApi = {
  getCatalog: () => request<PricingCatalog>('/billing/catalog/'),
  getSubscription: () => request<SubscriptionOverview>('/billing/subscription/'),
  checkout: (payload: CheckoutPayload) =>
    request<CheckoutResponse>('/billing/checkout/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getInvoices: () => request<{ invoices: BillingInvoice[] }>('/billing/invoices/'),
  getInvoiceDownloadUrl: (invoiceId: string, download = true) =>
    `${baseUrl}/billing/invoices/${invoiceId}/download/${download ? '?download=true' : ''}`,
}
