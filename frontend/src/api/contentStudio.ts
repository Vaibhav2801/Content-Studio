import { csrfToken } from './auth'
import type { ApprovalGroups, CalendarResponse, ContentAnalytics, HomeSummary, LibraryPost, PublishNowResponse, StudioConnection, StudioVariantCard } from '../types/contentStudio'

const baseUrl = (import.meta.env.VITE_SOCIAL_API_BASE_URL as string | undefined) ?? '/api/v3/social'

export class ContentStudioApiError extends Error {
  payload: Record<string, unknown>
  constructor(message: string, payload: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ContentStudioApiError'
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
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    const message = firstMessage(payload.detail) || firstMessage(payload.error) || firstMessage(payload)
    throw new ContentStudioApiError(message || `Request failed (${response.status})`, payload)
  }
  return response.json() as Promise<T>
}

export interface LibraryFilters { status?: string; q?: string; platform?: string; date_from?: string; date_to?: string }
export interface ContentStudioExport {
  format: 'content-studio-export-v1'
  workspace: { id: string; name: string }
  settings: Record<string, unknown> | null
  sources: Array<Record<string, unknown>>
  connections: Array<Record<string, unknown>>
  posts: Array<Record<string, unknown>>
  audit_events: Array<Record<string, unknown>>
}

export const contentStudioApi = {
  home: () => request<HomeSummary>('/studio/home/'),
  analytics: () => request<ContentAnalytics>('/analytics/'),
  refreshAnalytics: () => request<{ analytics: ContentAnalytics; refresh: { checked: number; failed: number; observations: number } }>('/analytics/refresh/', { method: 'POST', body: '{}' }),
  decideAnalyticsSuggestion: (suggestionId: string, action: 'ACCEPT' | 'DISMISS') => request<ContentAnalytics>(`/analytics/suggestions/${suggestionId}/`, { method: 'POST', body: JSON.stringify({ action }) }),
  approvals: () => request<ApprovalGroups>('/approvals/'),
  reviewAction: (variantId: string, payload: { action: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT'; version_id?: string; note?: string }) => request<ApprovalGroups>(`/variants/${variantId}/review/`, { method: 'POST', body: JSON.stringify(payload) }),
  publishNow: (variantId: string) => request<PublishNowResponse>(`/variants/${variantId}/publish-now/`, { method: 'POST', body: '{}' }),
  batchApprove: (approvals: Array<{ variant_id: string; version_id: string }>) => request<ApprovalGroups>('/approvals/batch/', { method: 'POST', body: JSON.stringify({ approvals }) }),
  calendar: (view: 'WEEK' | 'MONTH', date: string) => request<CalendarResponse>(`/calendar/?${new URLSearchParams({ view, date })}`),
  reschedule: (variantId: string, scheduled_for: string) => request<StudioVariantCard>(`/variants/${variantId}/reschedule/`, { method: 'PATCH', body: JSON.stringify({ scheduled_for }) }),
  library: (filters: LibraryFilters = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
    return request<LibraryPost[]>(`/library/${params.size ? `?${params}` : ''}`)
  },
  libraryAction: (postId: string, action: 'DUPLICATE' | 'REUSE_IDEA' | 'ARCHIVE') => request<LibraryPost>(`/posts/${postId}/library-action/`, { method: 'POST', body: JSON.stringify({ action }) }),
  connections: () => request<StudioConnection[]>('/connections/'),
  connectionAction: (connectionId: string, action: 'RECONNECT' | 'DISCONNECT') => request<StudioConnection | { authorization_url: string; expires_at: string | null }>(`/connections/${connectionId}/action/`, { method: 'POST', body: JSON.stringify({ action }) }),
  exportData: () => request<ContentStudioExport>('/studio/data-export/'),
  deleteData: (confirmation: string) => request<{ deleted: Record<string, number> }>('/studio/data/', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation }),
  }),
}
