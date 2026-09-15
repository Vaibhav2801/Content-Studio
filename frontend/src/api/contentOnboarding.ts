import { csrfToken } from './auth'
import type { ContentStudioOnboarding } from '../types/content'

const baseUrl = (import.meta.env.VITE_SOCIAL_API_BASE_URL as string | undefined) ?? '/api/v3/social'

export class ContentOnboardingApiError extends Error {
  payload: Record<string, unknown>

  constructor(message: string, payload: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ContentOnboardingApiError'
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
    const first = Object.values(payload).flat().find((value) => typeof value === 'string')
    throw new ContentOnboardingApiError(typeof first === 'string' ? first : `Request failed (${response.status})`, payload)
  }
  return response.json() as Promise<T>
}

export interface LinkedInAccountChoice {
  id: string
  name: string
  vanity_name: string
  account_type: 'PERSON' | 'ORGANIZATION'
}

export const contentOnboardingApi = {
  get: () => request<ContentStudioOnboarding>('/onboarding/'),
  start: () => request<ContentStudioOnboarding>('/onboarding/', { method: 'POST', body: '{}' }),
  setCurrentStep: (current_step: number) => request<ContentStudioOnboarding>('/onboarding/', {
    method: 'PATCH', body: JSON.stringify({ current_step }),
  }),
  completeStep: (step: number, payload: Record<string, unknown>) => request<ContentStudioOnboarding>(`/onboarding/steps/${step}/`, {
    method: 'POST', body: JSON.stringify(payload),
  }),
  startConnection: (network: 'LINKEDIN' | 'INSTAGRAM' = 'LINKEDIN') => request<{ authorization_url: string; expires_at: string }>('/onboarding/connection/start/', {
    method: 'POST', body: JSON.stringify({ network }),
  }),
  connectionChoices: (payload: { state: string; pending_data_token: string }) => request<{ accounts: LinkedInAccountChoice[] }>('/onboarding/connection/choices/', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  selectConnection: (payload: { state: string; pending_data_token: string; account_type: 'PERSON' | 'ORGANIZATION'; organization_id?: string; connect_token?: string }) => request<ContentStudioOnboarding>('/onboarding/connection/select/', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  completeConnection: (payload: { state?: string; code?: string; error?: string; cancelled?: boolean }) => request<ContentStudioOnboarding>('/onboarding/connection/complete/', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  cancelConnection: () => request<ContentStudioOnboarding>('/onboarding/connection/cancel/', {
    method: 'POST', body: '{}',
  }),
}
