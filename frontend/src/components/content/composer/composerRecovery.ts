import type { GenerationControls, SocialNetwork } from '../../../types/socialComposer'

export type ComposerMode = 'manual' | 'idea' | 'source' | 'draft'

export interface ComposerFormSnapshot {
  mode: ComposerMode
  ideaTitle: string
  ideaText: string
  sourceIds: string[]
  networks: SocialNetwork[]
  selectedConnections?: Partial<Record<SocialNetwork, string>>
  controls: GenerationControls
  activeNetwork: SocialNetwork
}

export interface ComposerDraftRecovery {
  draftId: string
  generating: boolean
  error: string
  startedAt: number
}

const prefix = 'content-studio-composer-v1'
export const composerRecoveryEvent = 'content-studio-composer-recovery-changed'

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(composerRecoveryEvent))
}

export function composerRecoveryKey(userId?: string, workspaceId?: string) {
  return `${prefix}:${userId || 'preview'}:${workspaceId || 'preview'}`
}

function read<T>(key: string): T | null {
  try {
    const value = sessionStorage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) }
  catch { /* Drafts remain available through Content Library when storage is unavailable. */ }
}

export function readComposerForm(key: string): ComposerFormSnapshot | null {
  const value = read<ComposerFormSnapshot>(`${key}:form`)
  return value && typeof value.ideaTitle === 'string' && typeof value.ideaText === 'string'
    && Array.isArray(value.networks) && Array.isArray(value.sourceIds) ? value : null
}

export function saveComposerForm(key: string, value: ComposerFormSnapshot) {
  write(`${key}:form`, value)
}

export function readComposerDraft(key: string): ComposerDraftRecovery | null {
  const value = read<ComposerDraftRecovery>(`${key}:draft`)
  return value && typeof value.draftId === 'string' && value.draftId
    ? { draftId: value.draftId, generating: value.generating === true, error: typeof value.error === 'string' ? value.error : '', startedAt: typeof value.startedAt === 'number' ? value.startedAt : 0 }
    : null
}

export function rememberComposerDraft(key: string, draftId: string, generating = false) {
  write(`${key}:draft`, { draftId, generating, error: '', startedAt: Date.now() } satisfies ComposerDraftRecovery)
  notify()
}

export function finishComposerGeneration(key: string, draftId: string, error = '') {
  const current = readComposerDraft(key)
  if (current?.draftId !== draftId) return
  write(`${key}:draft`, { draftId, generating: false, error, startedAt: current.startedAt } satisfies ComposerDraftRecovery)
}

export function clearComposerRecovery(key: string) {
  try {
    sessionStorage.removeItem(`${key}:form`)
    sessionStorage.removeItem(`${key}:draft`)
    notify()
  } catch { /* Storage may be unavailable in private browsing. */ }
}

