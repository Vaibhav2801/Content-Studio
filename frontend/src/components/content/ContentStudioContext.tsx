import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LinkedInApiError, linkedinApi } from '../../api/linkedin'
import { contentOnboardingApi } from '../../api/contentOnboarding'
import { socialComposerApi } from '../../api/socialComposer'
import { contentOnboardingMock, linkedinMockDashboard } from '../../api/linkedinMock'
import type { ContentDashboard, ContentPost, ContentPostStatus, ContentSettings, ContentStudioOnboarding } from '../../types/content'
import { customerSafeMessage } from './contentUtils'
import { useOptionalAuth } from './AuthContext'

type PostAction = 'approve' | 'publish' | 'cancel'

export interface ActiveGenerationItem {
  postId: string
  title: string
  startedAt: number
  status: 'GENERATING' | 'READY' | 'FAILED'
  error?: string
}

export interface GenerationNotice {
  message: string
  postId?: string
  isError?: boolean
}

interface ContentStudioState {
  dashboard: ContentDashboard
  onboarding: ContentStudioOnboarding
  settingsDraft: ContentSettings
  selected?: ContentPost
  selectedId: string
  selectedBriefId: string
  context: string
  contextLabel: string
  saveContext: boolean
  busy: string
  notice: string
  noticeError: boolean
  isDemo: boolean
  activeGenerations: Record<string, ActiveGenerationItem>
  generationNotice: GenerationNotice | null
  startTrackingGeneration: (postId: string, title?: string) => void
  stopTrackingGeneration: (postId: string) => void
  dismissGenerationNotice: () => void
  setSelectedId: (id: string) => void
  setSelectedBriefId: (id: string) => void
  setContext: (value: string) => void
  setContextLabel: (value: string) => void
  setSaveContext: (value: boolean) => void
  setSettingsDraft: (settings: ContentSettings) => void
  dismissNotice: () => void
  generate: () => Promise<void>
  runPostAction: (action: PostAction) => Promise<void>
  updatePost: (body: string, imagePrompt: string) => Promise<void>
  regenerateImage: () => Promise<void>
  saveSettings: () => Promise<boolean>
  toggleAutomation: () => Promise<void>
  startOnboarding: () => Promise<void>
  moveOnboardingStep: (step: number) => Promise<void>
  completeOnboardingStep: (step: number, payload: Record<string, unknown>) => Promise<ContentStudioOnboarding | undefined>
  saveBusinessProfile: (payload: { name?: string; description?: string; audience?: string; language?: string; skip?: boolean }) => Promise<boolean>
  connectLinkedIn: (network?: "LINKEDIN" | "INSTAGRAM", returnTo?: 'onboarding' | 'connections') => Promise<void>
  completeLinkedInConnection: (payload: { state?: string; code?: string; error?: string; cancelled?: boolean; profile_id?: string; account_id?: string }) => Promise<void>
  selectLinkedInConnection: (payload: { state: string; pending_data_token: string; account_type: 'PERSON' | 'ORGANIZATION'; organization_id?: string; connect_token?: string }) => Promise<boolean>
  cancelLinkedInConnection: () => Promise<void>
  reload: () => Promise<void>
}

const ContentStudioContext = createContext<ContentStudioState | null>(null)
const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'

export function ContentStudioProvider({ children }: { children: ReactNode }) {
  const auth = useOptionalAuth()
  const [dashboard, setDashboard] = useState<ContentDashboard | null>(null)
  const [onboarding, setOnboarding] = useState<ContentStudioOnboarding | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<ContentSettings | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [selectedBriefId, setSelectedBriefId] = useState('')
  const [context, setContext] = useState('')
  const [contextLabel, setContextLabel] = useState('')
  const [saveContext, setSaveContext] = useState(true)
  const [isDemo, setIsDemo] = useState(demoMode)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [activeGenerations, setActiveGenerations] = useState<Record<string, ActiveGenerationItem>>(() => {
    try {
      const saved = localStorage.getItem('content-studio-active-generations')
      return saved ? JSON.parse(saved) as Record<string, ActiveGenerationItem> : {}
    } catch {
      return {}
    }
  })
  const [generationNotice, setGenerationNotice] = useState<GenerationNotice | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem('content-studio-active-generations', JSON.stringify(activeGenerations))
    } catch { /* storage may be unavailable */ }
  }, [activeGenerations])

  const startTrackingGeneration = (postId: string, title = 'New post') => {
    setActiveGenerations((current) => ({
      ...current,
      [postId]: {
        postId,
        title: title || 'New post',
        startedAt: Date.now(),
        status: 'GENERATING',
      },
    }))
  }

  const stopTrackingGeneration = (postId: string) => {
    setActiveGenerations((current) => {
      const next = { ...current }
      delete next[postId]
      return next
    })
  }

  const dismissGenerationNotice = () => setGenerationNotice(null)

  useEffect(() => {
    const generatingIds = Object.keys(activeGenerations).filter(
      (id) => activeGenerations[id]?.status === 'GENERATING'
    )
    if (!generatingIds.length || isDemo) return

    let cancelled = false
    const pollTimer = window.setInterval(async () => {
      for (const id of generatingIds) {
        if (cancelled) break
        const item = activeGenerations[id]
        if (!item) continue

        if (Date.now() - item.startedAt > 10 * 60 * 1000) {
          setActiveGenerations((current) => {
            const next = { ...current }
            delete next[id]
            return next
          })
          setGenerationNotice({
            message: `Generation for "${item.title}" timed out. Click to review draft and retry.`,
            postId: id,
            isError: true,
          })
          continue
        }

        try {
          const post = await socialComposerApi.getPost(id)
          if (cancelled) break

          const isFailed = post.generation_status === 'FAILED'
          const isReady = post.generation_status === 'READY' || post.variants.some((v) => Boolean(v.copy && v.copy.trim()))

          if (isFailed) {
            setActiveGenerations((current) => {
              const next = { ...current }
              delete next[id]
              return next
            })
            setGenerationNotice({
              message: `Post generation failed for "${post.idea_title || item.title}": ${post.generation_error || 'An error occurred.'}`,
              postId: id,
              isError: true,
            })
            window.dispatchEvent(new CustomEvent('content-studio-generation-failed', { detail: post }))
          } else if (isReady) {
            setActiveGenerations((current) => {
              const next = { ...current }
              delete next[id]
              return next
            })
            setGenerationNotice({
              message: `Post "${post.idea_title || item.title}" has been generated and is ready to review!`,
              postId: id,
              isError: false,
            })
            window.dispatchEvent(new CustomEvent('content-studio-generation-complete', { detail: post }))
          }
        } catch {
          // ignore network glitch and retry on next interval
        }
      }
    }, 2500)

    return () => {
      cancelled = true
      window.clearInterval(pollTimer)
    }
  }, [activeGenerations, isDemo])

  const load = async () => {
    setLoadError('')
    if (demoMode) {
      const data = structuredClone(linkedinMockDashboard)
      setDashboard(data)
      setOnboarding(structuredClone(contentOnboardingMock))
      setSettingsDraft(data.settings)
      setIsDemo(true)
      setSelectedId((current) => current || data.posts[0]?.id || '')
      setSelectedBriefId((current) => current || data.briefs[0]?.id || '')
      return
    }
    try {
      const [data, onboardingState] = await Promise.all([linkedinApi.dashboard(), contentOnboardingApi.get()])
      setDashboard(data)
      setOnboarding(onboardingState)
      setSettingsDraft(data.settings)
      setIsDemo(false)
      setSelectedId((current) => current || data.posts[0]?.id || '')
      setSelectedBriefId((current) => current || data.briefs[0]?.id || '')
    } catch (error) {
      setDashboard(null)
      setOnboarding(null)
      setSettingsDraft(null)
      setIsDemo(false)
      setLoadError(customerSafeMessage(error instanceof Error ? error.message : undefined, 'Could not load Content Studio.'))
    }
  }

  useEffect(() => { void load() }, [auth?.workspace?.id])
  const selected = useMemo(() => dashboard?.posts.find((post) => post.id === selectedId) ?? dashboard?.posts[0], [dashboard, selectedId])
  const replacePost = (post: ContentPost) => setDashboard((current) => current ? {
    ...current,
    posts: current.posts.map((item) => item.id === post.id ? post : item),
  } : current)
  const fail = (error: unknown, fallback: string) => {
    setNoticeError(true)
    setNotice(customerSafeMessage(error instanceof Error ? error.message : undefined, fallback))
  }

  const generate = async () => {
    setBusy('generate'); setNotice(''); setNoticeError(false)
    try {
      if (isDemo) {
        const demoPost = {
          ...linkedinMockDashboard.posts[0],
          id: `demo-${Date.now()}`,
          topic: contextLabel || 'New social post',
          scheduled_for: dashboard?.next_slots[0] || new Date().toISOString(),
        }
        setDashboard((current) => current ? { ...current, posts: [demoPost, ...current.posts] } : current)
        setSelectedId(demoPost.id)
        setNotice('Demo post created. Connect the backend to create a live post.')
      } else {
        const posts = await linkedinApi.generate({
          context: context.trim() || undefined,
          label: contextLabel.trim() || undefined,
          brief_id: context.trim() ? undefined : selectedBriefId || undefined,
          is_evergreen: saveContext,
          count: 1,
        })
        setDashboard((current) => current ? { ...current, posts: [...posts, ...current.posts] } : current)
        setSelectedId(posts[0]?.id ?? '')
        setNotice('Post, hashtags, and image direction created.')
      }
      setContext(''); setContextLabel('')
    } catch (error) { fail(error, 'Could not create the post.') }
    finally { setBusy('') }
  }

  const runPostAction = async (action: PostAction) => {
    if (!selected) return
    setBusy(action); setNotice(''); setNoticeError(false)
    try {
      if (isDemo) {
        const status: ContentPostStatus = action === 'approve' ? 'SCHEDULED' : action === 'publish' ? 'SUBMITTED' : 'CANCELLED'
        replacePost({ ...selected, status })
      } else {
        const post = action === 'approve' ? await linkedinApi.approve(selected.id)
          : action === 'publish' ? await linkedinApi.publishNow(selected.id)
          : await linkedinApi.cancel(selected.id)
        replacePost(post)
      }
      setNotice(action === 'approve' ? 'Approved and added to the schedule.' : action === 'publish' ? 'Post accepted for publishing. Its status will update automatically.' : 'Removed from the schedule.')
    } catch (error) {
      if (error instanceof LinkedInApiError && typeof error.payload.id === 'string') replacePost(error.payload as unknown as ContentPost)
      fail(error, 'Could not complete that action.')
    } finally { setBusy('') }
  }

  const updatePost = async (body: string, imagePrompt: string) => {
    if (!selected) return
    setBusy('edit'); setNotice(''); setNoticeError(false)
    try {
      const updated = isDemo ? { ...selected, body, image_prompt: imagePrompt, character_count: body.length + selected.hashtags.join(' ').length }
        : await linkedinApi.updatePost(selected.id, { body, image_prompt: imagePrompt })
      replacePost(updated)
      setNotice('Post changes saved.')
    } catch (error) { fail(error, 'Could not save the post.') }
    finally { setBusy('') }
  }

  const regenerateImage = async () => {
    if (!selected) return
    setBusy('image'); setNotice(''); setNoticeError(false)
    try {
      if (isDemo) setNotice('Image creation is unavailable in demo mode.')
      else {
        replacePost(await linkedinApi.regenerateImage(selected.id))
        setNotice('A new image was created from the visual direction.')
      }
    } catch (error) { fail(error, 'Could not create a new image.') }
    finally { setBusy('') }
  }

  const saveSettings = async () => {
    if (!settingsDraft) return false
    setBusy('settings'); setNotice(''); setNoticeError(false)
    try {
      const saved = isDemo ? settingsDraft : await linkedinApi.saveSettings(settingsDraft)
      setDashboard((current) => current ? { ...current, settings: saved } : current)
      setSettingsDraft(saved)
      setNotice(isDemo ? 'Demo settings updated for this visit.' : 'Content Studio settings saved.')
      return true
    } catch (error) { fail(error, 'Could not save settings.'); return false }
    finally { setBusy('') }
  }

  const toggleAutomation = async () => {
    if (!settingsDraft) return
    const previous = settingsDraft
    const next = { ...settingsDraft, is_active: !settingsDraft.is_active }
    setBusy('automation')
    setSettingsDraft(next)
    try {
      if (isDemo) {
        setDashboard((current) => current ? { ...current, settings: next } : current)
      } else {
        const saved = await linkedinApi.saveSettings({ is_active: next.is_active })
        setDashboard((current) => current ? { ...current, settings: saved } : current)
        setSettingsDraft(saved)
      }
    } catch (error) {
      setSettingsDraft(previous)
      fail(error, 'Could not change publishing status.')
    } finally { setBusy('') }
  }

  const startOnboardingFlow = async () => {
    if (isDemo) {
      setOnboarding({ ...contentOnboardingMock, status: 'IN_PROGRESS', current_step: 1, completed_steps: [] })
      return
    }
    try { setOnboarding(await contentOnboardingApi.start()) }
    catch (error) { fail(error, 'Could not start setup.') }
  }

  const moveOnboardingStep = async (step: number) => {
    if (!onboarding) return
    if (isDemo) { setOnboarding({ ...onboarding, current_step: step, status: 'IN_PROGRESS' }); return }
    try { setOnboarding(await contentOnboardingApi.setCurrentStep(step)) }
    catch (error) { fail(error, 'Could not save your setup progress.') }
  }

  const completeOnboardingStep = async (step: number, payload: Record<string, unknown>) => {
    if (!onboarding) return undefined
    try {
      let saved: ContentStudioOnboarding
      if (isDemo) {
        saved = {
          ...onboarding,
          status: step === 4 ? 'COMPLETE' : 'IN_PROGRESS',
          current_step: Math.min(4, step + 1),
          completed_steps: [...new Set([...onboarding.completed_steps, step])].sort(),
        }
      } else {
        saved = await contentOnboardingApi.completeStep(step, payload)
      }
      setOnboarding(saved)
      if (!isDemo && (step === 2 || step === 3)) {
        const data = await linkedinApi.dashboard()
        setDashboard(data)
        setSettingsDraft(data.settings)
      }
      return saved
    } catch (error) { fail(error, 'Could not save this setup step.'); return undefined }
  }

  const saveBusinessProfile = async (payload: { name?: string; description?: string; audience?: string; language?: string; skip?: boolean }) => {
    setBusy('business-profile'); setNotice(''); setNoticeError(false)
    try {
      if (isDemo) {
        setOnboarding((current) => current ? { ...current, business_profile_configured: !payload.skip, business_prompt_skipped: Boolean(payload.skip) } : current)
      } else {
        setOnboarding(await contentOnboardingApi.saveBusinessProfile(payload))
        const data = await linkedinApi.dashboard()
        setDashboard(data); setSettingsDraft(data.settings)
      }
      setNotice(payload.skip ? 'You can add business details later in Settings.' : 'Business profile saved for this workspace.')
      return true
    } catch (error) { fail(error, 'Could not save the business profile.'); return false }
    finally { setBusy('') }
  }

  const connectLinkedIn = async (network: "LINKEDIN" | "INSTAGRAM" = "LINKEDIN", returnTo: 'onboarding' | 'connections' = 'onboarding') => {
    setBusy('connection'); setNotice(''); setNoticeError(false)
    try {
      if (isDemo) { setNotice('Social account connection is unavailable in demo mode.'); return }
      const result = await contentOnboardingApi.startConnection(network, returnTo)
      window.open(result.authorization_url, '_self')
    } catch (error) { fail(error, `Could not start the ${network === 'INSTAGRAM' ? 'Instagram' : 'LinkedIn'} connection.`) }
    finally { setBusy('') }
  }

  const completeLinkedInConnection = async (payload: { state?: string; code?: string; error?: string; cancelled?: boolean; profile_id?: string; account_id?: string }) => {
    setBusy('connection-return'); setNotice(''); setNoticeError(false)
    try {
      const saved = await contentOnboardingApi.completeConnection(payload)
      setOnboarding(saved)
      setNotice(payload.cancelled || payload.error ? 'The connection was cancelled.' : 'Social account connected successfully.')
    } catch (error) {
      fail(error, 'The social account could not be connected. Choose Reconnect to try again.')
      try { setOnboarding(await contentOnboardingApi.get()) } catch { /* Keep the actionable connection error visible. */ }
    }
    finally { setBusy('') }
  }

  const selectLinkedInConnection = async (payload: { state: string; pending_data_token: string; account_type: 'PERSON' | 'ORGANIZATION'; organization_id?: string; connect_token?: string }) => {
    setBusy('connection-return'); setNotice(''); setNoticeError(false)
    try {
      const saved = await contentOnboardingApi.selectConnection(payload)
      setOnboarding(saved)
      setNotice('LinkedIn account connected successfully.')
      return true
    } catch (error) {
      fail(error, 'Could not connect that LinkedIn account. Please try again.')
      return false
    } finally { setBusy('') }
  }

  const cancelLinkedInConnection = async () => {
    setBusy('connection'); setNotice(''); setNoticeError(false)
    try {
      if (isDemo) return
      setOnboarding(await contentOnboardingApi.cancelConnection())
      setNotice('The connection was cancelled. You can reconnect later.')
    } catch (error) { fail(error, 'Could not cancel the connection step.') }
    finally { setBusy('') }
  }

  if (loadError) return <div className="li-loading" role="alert">{loadError}<button className="button button-dark" type="button" onClick={() => void load()}>Try again</button></div>
  if (!dashboard || !settingsDraft || !onboarding) return <div className="li-loading" role="status">Loading Content Studio…</div>

  return <ContentStudioContext.Provider value={{
    dashboard, onboarding, settingsDraft, selected, selectedId, selectedBriefId, context, contextLabel, saveContext,
    busy, notice, noticeError, isDemo, activeGenerations, generationNotice,
    startTrackingGeneration, stopTrackingGeneration, dismissGenerationNotice,
    setSelectedId, setSelectedBriefId, setContext, setContextLabel,
    setSaveContext, setSettingsDraft, dismissNotice: () => { setNotice(''); setNoticeError(false) }, generate,
    runPostAction, updatePost, regenerateImage, saveSettings, toggleAutomation,
    startOnboarding: startOnboardingFlow, moveOnboardingStep, completeOnboardingStep,
    saveBusinessProfile, connectLinkedIn, completeLinkedInConnection, selectLinkedInConnection, cancelLinkedInConnection, reload: load,
  }}>{children}</ContentStudioContext.Provider>
}

// Context hooks intentionally live beside their provider to keep one public state contract.
// eslint-disable-next-line react-refresh/only-export-components
export function useContentStudio() {
  const value = useContext(ContentStudioContext)
  if (!value) throw new Error('useContentStudio must be used within ContentStudioProvider')
  return value
}
