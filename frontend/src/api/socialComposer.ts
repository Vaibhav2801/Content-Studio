import { csrfToken } from './auth'
import type { ComposerOptions, DraftPayload, MediaAsset, RewriteAction, SocialPost } from '../types/socialComposer'

const baseUrl = (import.meta.env.VITE_SOCIAL_API_BASE_URL as string | undefined) ?? '/api/v3/social'

export class SocialComposerApiError extends Error {
  payload: Record<string, unknown>

  constructor(message: string, payload: Record<string, unknown> = {}) {
    super(message)
    this.name = 'SocialComposerApiError'
    this.payload = payload
  }
}

function csrfHeader(method: string): Record<string, string> {
  const token = csrfToken()
  return method !== 'GET' && token ? { 'X-CSRFToken': token } : {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method?.toUpperCase() ?? 'GET'
  const isForm = options.body instanceof FormData
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (!isForm) headers.set('Content-Type', 'application/json')
  Object.entries(csrfHeader(method)).forEach(([key, value]) => headers.set(key, value))
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    const values = Object.values(payload).flat(3)
    const message = values.find((value) => typeof value === 'string')
    throw new SocialComposerApiError(typeof message === 'string' ? message : `Request failed (${response.status})`, payload)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const socialComposerApi = {
  options: () => request<ComposerOptions>('/composer/options/'),
  getPost: (id: string) => request<SocialPost>(`/posts/${id}/`),
  createDraft: (payload: DraftPayload) => request<SocialPost>('/posts/', { method: 'POST', body: JSON.stringify(payload) }),
  generate: (payload: DraftPayload & { post_id?: string }) => request<SocialPost>('/posts/generate/', { method: 'POST', body: JSON.stringify(payload) }),
  generateSeries: (payload: { title: string; prompt: string; count: number; interval_days: number; scheduled_for: string; networks: DraftPayload['networks']; connection_ids?: string[]; controls: DraftPayload['controls'] }) => request<{ posts: SocialPost[] }>('/posts/series/', { method: 'POST', body: JSON.stringify(payload) }),
  updatePost: (id: string, payload: Partial<DraftPayload>) => request<SocialPost>(`/posts/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updateVariant: (id: string, payload: { copy?: string; hashtags?: string[]; scheduled_for?: string }) => request<SocialPost>(`/variants/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  rewrite: (id: string, action: RewriteAction) => request<SocialPost>(`/variants/${id}/rewrite/`, { method: 'POST', body: JSON.stringify({ action }) }),
  submitForReview: (id: string) => request<SocialPost>(`/posts/${id}/submit-review/`, { method: 'POST', body: '{}' }),
  schedule: (id: string) => request<SocialPost>(`/posts/${id}/schedule/`, { method: 'POST', body: '{}' }),
  uploadMedia: (variantId: string, file: File, altText = '') => {
    const data = new FormData()
    data.append('file', file)
    data.append('alt_text', altText)
    return request<MediaAsset>(`/variants/${variantId}/media/`, { method: 'POST', body: data })
  },
  updateAltText: (variantId: string, assetId: string, alt_text: string) => request<MediaAsset>(`/variants/${variantId}/media/${assetId}/`, { method: 'PATCH', body: JSON.stringify({ alt_text }) }),
  deleteMedia: (variantId: string, assetId: string) => request<void>(`/variants/${variantId}/media/${assetId}/`, { method: 'DELETE' }),
  reorderMedia: (variantId: string, assetIds: string[]) => request<MediaAsset[]>(`/variants/${variantId}/media/reorder/`, { method: 'POST', body: JSON.stringify({ asset_ids: assetIds }) }),
  regenerateImage: (variantId: string, prompt: string, assetId?: string) => request<MediaAsset>(`/variants/${variantId}/media/regenerate-image/`, { method: 'POST', body: JSON.stringify({ prompt, asset_id: assetId }) }),
}
