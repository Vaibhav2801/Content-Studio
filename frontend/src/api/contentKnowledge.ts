import { csrfToken } from './auth'
import type { BrandBrain, ContentSource, ContentSourceInput, StoryInterview } from '../types/contentKnowledge'

const baseUrl = (import.meta.env.VITE_SOCIAL_API_BASE_URL as string | undefined) ?? '/api/v3/social'

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
    const message = Object.values(payload).flat(3).find((value) => typeof value === 'string')
    throw new Error(typeof message === 'string' ? message : `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export const contentKnowledgeApi = {
  brand: () => request<BrandBrain>('/brand-brain/'),
  saveBrand: (value: Partial<BrandBrain>) => request<BrandBrain>('/brand-brain/', { method: 'PUT', body: JSON.stringify(value) }),
  decideSuggestion: (id: string, action: 'CONFIRM' | 'DISMISS') => request<BrandBrain>(`/brand-brain/suggestions/${id}/`, { method: 'POST', body: JSON.stringify({ action }) }),
  sources: () => request<ContentSource[]>('/sources/'),
  createSource: (value: ContentSourceInput) => request<ContentSource>('/sources/', { method: 'POST', body: JSON.stringify(value) }),
  story: () => request<StoryInterview>('/story-interview/'),
  saveStory: (answers: Record<string, string>) => request<StoryInterview>('/story-interview/', { method: 'PATCH', body: JSON.stringify({ answers }) }),
  approveStory: () => request<StoryInterview>('/story-interview/', { method: 'POST', body: JSON.stringify({ action: 'APPROVE' }) }),
}
