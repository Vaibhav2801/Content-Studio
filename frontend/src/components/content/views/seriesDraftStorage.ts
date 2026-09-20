import type { SocialNetwork } from '../../../types/socialComposer'
import type { SeriesPostItem } from './ContentSeriesView'

export interface SeriesCampaignDraft {
  id: string
  title: string
  prompt: string
  count: number
  intervalDays: number
  scheduledFor: string
  networks: SocialNetwork[]
  connectionIds: string[]
  tone: string
  goal: string
  length: string
  includeImage: boolean
  selectedSourceId: string
  targetAudience: string
  keyMessage: string
  callToAction: string
  mustInclude: string
  mustAvoid: string
  postItems: SeriesPostItem[]
  currentStep: number
  updatedAt: string
}

const STORAGE_KEY = 'content_studio_series_campaign_drafts_v1'

export function getSavedSeriesDrafts(workspaceId = 'default'): SeriesCampaignDraft[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${workspaceId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SeriesCampaignDraft[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSeriesCampaignDraft(draft: SeriesCampaignDraft, workspaceId = 'default'): void {
  try {
    const existing = getSavedSeriesDrafts(workspaceId)
    const filtered = existing.filter((d) => d.id !== draft.id)
    const updated = [{ ...draft, updatedAt: new Date().toISOString() }, ...filtered].slice(0, 10)
    localStorage.setItem(`${STORAGE_KEY}:${workspaceId}`, JSON.stringify(updated))
  } catch {
    // Gracefully handle private browsing or storage quota limits
  }
}

export function deleteSeriesCampaignDraft(id: string, workspaceId = 'default'): void {
  try {
    const existing = getSavedSeriesDrafts(workspaceId)
    const updated = existing.filter((d) => d.id !== id)
    localStorage.setItem(`${STORAGE_KEY}:${workspaceId}`, JSON.stringify(updated))
  } catch {
    // Ignore storage deletion errors
  }
}
