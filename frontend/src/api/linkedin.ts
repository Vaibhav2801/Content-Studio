import { csrfToken } from './auth'
import type { LinkedInDashboard, LinkedInPost, LinkedInSettings } from '../types/linkedin'

const baseUrl = (import.meta.env.VITE_LINKEDIN_API_BASE_URL as string | undefined) ?? '/api/v3/linkedin'

export class LinkedInApiError extends Error {
  payload: Record<string, unknown>

  constructor(message: string, payload: Record<string, unknown> = {}) {
    super(message)
    this.name = 'LinkedInApiError'
    this.payload = payload
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method?.toUpperCase() ?? 'GET'
  const token = csrfToken()
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(method !== 'GET' && token ? { 'X-CSRFToken': token } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    const message = [payload.detail, payload.error, payload.failure_reason].find((value) => typeof value === 'string' && value)
    throw new LinkedInApiError(typeof message === 'string' ? message : `Request failed (${response.status})`, payload)
  }
  return response.json() as Promise<T>
}

export const linkedinApi = {
  dashboard: () => request<LinkedInDashboard>('/dashboard/'),
  saveSettings: (settings: Partial<LinkedInSettings>) => request<LinkedInSettings>('/settings/', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),
  generate: (payload: { context?: string; label?: string; brief_id?: string; is_evergreen?: boolean; count?: number }) => request<LinkedInPost[]>('/posts/generate/', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updatePost: (id: string, payload: Partial<LinkedInPost>) => request<LinkedInPost>(`/posts/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  approve: (id: string) => request<LinkedInPost>(`/posts/${id}/approve/`, { method: 'POST', body: '{}' }),
  cancel: (id: string) => request<LinkedInPost>(`/posts/${id}/cancel/`, { method: 'POST', body: '{}' }),
  publishNow: (id: string) => request<LinkedInPost>(`/posts/${id}/publish-now/`, { method: 'POST', body: '{}' }),
  regenerateImage: (id: string) => request<LinkedInPost>(`/posts/${id}/regenerate-image/`, { method: 'POST', body: '{}' }),
}
