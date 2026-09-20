import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  LoaderCircle,
  PenSquare,
  Save,
  Send,
  Sliders,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { socialComposerApi } from '../../../api/socialComposer'
import { makeDemoPost, socialComposerMockOptions } from '../../../api/socialComposerMock'
import type { ComposerOptions, SocialNetwork, SocialPost, SocialVariant } from '../../../types/socialComposer'
import { useOptionalAuth } from '../AuthContext'
import { useContentStudio } from '../ContentStudioContext'
import { customerSafeMessage } from '../contentUtils'
import {
  deleteSeriesCampaignDraft,
  getSavedSeriesDrafts,
  saveSeriesCampaignDraft,
  type SeriesCampaignDraft,
} from './seriesDraftStorage'

export interface SeriesPostItem {
  idea_title: string
  idea_text: string
  scheduled_for: string
  include_image?: boolean
  image_prompt?: string
}

const firstDate = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
  date.setMinutes(0, 0, 0)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`
}

const calculateDate = (baseDateStr: string, offsetDays: number): string => {
  const base = new Date(baseDateStr)
  if (isNaN(base.getTime())) return ''
  const target = new Date(base.getTime() + offsetDays * 86400000)
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}T${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`
}

const starterPartThemes = [
  { title: 'The Core Challenge & Context', text: 'Introduce the central problem, why conventional wisdom fails, and the stakes for your audience.' },
  { title: 'Foundational Strategy & Framework', text: 'Break down the core framework, key pillars, and mental model needed to solve the problem.' },
  { title: 'Tactical Execution & Action Steps', text: 'Step-by-step practical guide on implementing the strategy with real-world examples.' },
  { title: 'Common Mistakes & Pitfalls', text: 'Highlight 3 subtle mistakes teams make when doing this and how to prevent them.' },
  { title: 'Advanced Tips & Scaling', text: 'Tactical nuances, efficiency shortcuts, and how to measure long-term impact.' },
  { title: 'Summary & Actionable Checklist', text: 'Consolidate the top lessons into a concise recap, next steps checklist, and invitation to discuss.' },
]

export function ContentSeriesView() {
  const { isDemo, startTrackingGeneration } = useContentStudio()
  const auth = useOptionalAuth()
  const workspaceId = auth?.workspace?.id ?? (isDemo ? 'demo' : 'default')

  const [options, setOptions] = useState<ComposerOptions | null>(null)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [campaignId, setCampaignId] = useState(() => `series-${Date.now()}`)

  // Series overview (Step 1)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(3)
  const [networks, setNetworks] = useState<SocialNetwork[]>([])
  const [connectionIds, setConnectionIds] = useState<string[]>([])

  // Controls & Cadence (Step 2)
  const [intervalDays, setIntervalDays] = useState(7)
  const [scheduledFor, setScheduledFor] = useState(firstDate)
  const [tone, setTone] = useState('Professional')
  const [goal, setGoal] = useState('Awareness')
  const [length, setLength] = useState('Medium')
  const [includeImage, setIncludeImage] = useState(false)
  const [selectedSourceId, setSelectedSourceId] = useState('')

  // Creative brief (Step 2 optional)
  const [briefOpen, setBriefOpen] = useState(false)
  const [targetAudience, setTargetAudience] = useState('')
  const [keyMessage, setKeyMessage] = useState('')
  const [callToAction, setCallToAction] = useState('')
  const [mustInclude, setMustInclude] = useState('')
  const [mustAvoid, setMustAvoid] = useState('')

  // Per-post breakdown items (Step 3)
  const [postItems, setPostItems] = useState<SeriesPostItem[]>(() =>
    Array.from({ length: 3 }, (_, index) => ({
      idea_title: `Part ${index + 1}`,
      idea_text: '',
      scheduled_for: calculateDate(firstDate(), index * 7),
    }))
  )

  // Generated posts & review states (Step 4)
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [selectedPostIndex, setSelectedPostIndex] = useState(0)
  const [activeNetwork, setActiveNetwork] = useState<SocialNetwork>('LINKEDIN')
  const [editedCopies, setEditedCopies] = useState<Record<string, string>>({})
  const [editedHashtags, setEditedHashtags] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [batchActionNotice, setBatchActionNotice] = useState<string>('')

  // Saved Draft Campaigns Modal
  const [savedDraftsModalOpen, setSavedDraftsModalOpen] = useState(false)
  const [savedDraftsList, setSavedDraftsList] = useState<SeriesCampaignDraft[]>([])
  const [draftToast, setDraftToast] = useState<string>('')

  const [busy, setBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState('')
  const [error, setError] = useState('')

  // Listen for background Celery generation updates from global context
  useEffect(() => {
    const handleCompleted = (e: Event) => {
      const customEvent = e as CustomEvent<SocialPost>
      const updatedPost = customEvent.detail
      if (!updatedPost?.id) return
      setPosts((prev) =>
        prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
      )
    }
    const handleFailed = (e: Event) => {
      const customEvent = e as CustomEvent<SocialPost>
      const updatedPost = customEvent.detail
      if (!updatedPost?.id) return
      setPosts((prev) =>
        prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
      )
    }
    window.addEventListener('content-studio-generation-complete', handleCompleted)
    window.addEventListener('content-studio-generation-failed', handleFailed)
    return () => {
      window.removeEventListener('content-studio-generation-complete', handleCompleted)
      window.removeEventListener('content-studio-generation-failed', handleFailed)
    }
  }, [])

  // Load connected options and refresh saved drafts
  useEffect(() => {
    setSavedDraftsList(getSavedSeriesDrafts(workspaceId))

    if (isDemo) {
      const result = structuredClone(socialComposerMockOptions)
      setOptions(result)
      setNetworks(result.connections.map((item) => item.network))
      setConnectionIds(result.connections.map((item) => item.id))
      return
    }
    void socialComposerApi
      .options()
      .then((result) => {
        setOptions(result)
        const available = result.connections.filter((item) => item.health === 'HEALTHY')
        const defaults = available.filter(
          (item, index) => available.findIndex((candidate) => candidate.network === item.network) === index
        )
        setNetworks(defaults.map((item) => item.network))
        setConnectionIds(defaults.map((item) => item.id))
      })
      .catch((cause) =>
        setError(customerSafeMessage(cause instanceof Error ? cause.message : undefined, 'Could not load connected accounts.'))
      )
  }, [isDemo, workspaceId])

  // Save current series campaign progress to persistent storage
  const persistCurrentProgress = (targetStep = currentStep, customPosts = posts) => {
    const draft: SeriesCampaignDraft = {
      id: campaignId,
      title,
      prompt,
      count,
      intervalDays,
      scheduledFor,
      networks,
      connectionIds,
      tone,
      goal,
      length,
      includeImage,
      selectedSourceId,
      targetAudience,
      keyMessage,
      callToAction,
      mustInclude,
      mustAvoid,
      postItems,
      posts: customPosts,
      postIds: customPosts.map((p) => p.id),
      currentStep: targetStep,
      updatedAt: new Date().toISOString(),
    }
    saveSeriesCampaignDraft(draft, workspaceId)
    setSavedDraftsList(getSavedSeriesDrafts(workspaceId))
    setDraftToast(`Progress saved for Step ${targetStep}`)
    setTimeout(() => setDraftToast(''), 3000)
  }

  // Real-time active polling while on Step 4 if any posts are in GENERATING state
  useEffect(() => {
    if (isDemo || currentStep !== 4) return
    const generatingPosts = posts.filter((p) => p.generation_status === 'GENERATING')
    if (generatingPosts.length === 0) return

    let cancelled = false
    const pollInterval = window.setInterval(async () => {
      try {
        const updates = await Promise.all(
          generatingPosts.map((p) =>
            socialComposerApi.getPost(p.id).catch(() => null)
          )
        )
        if (cancelled) return

        let anyChanged = false
        setPosts((currentPosts) => {
          const next = currentPosts.map((p) => {
            const updated = updates.find((u) => u && u.id === p.id)
            if (!updated) return p
            const hasChanged =
              updated.generation_status !== p.generation_status ||
              (updated.variants?.length || 0) !== (p.variants?.length || 0) ||
              updated.variants?.some((uv, idx) => uv.copy !== p.variants?.[idx]?.copy) ||
              updated.variants?.some((uv, idx) => uv.media?.length !== p.variants?.[idx]?.media?.length)
            if (hasChanged) {
              anyChanged = true
              return updated
            }
            return p
          })
          if (anyChanged) {
            persistCurrentProgress(4, next)
          }
          return anyChanged ? next : currentPosts
        })
      } catch {
        // Polling retry on next tick
      }
    }, 2500)

    return () => {
      cancelled = true
      window.clearInterval(pollInterval)
    }
  }, [isDemo, currentStep, posts])

  // Restore a saved draft campaign
  const handleResumeDraft = (draft: SeriesCampaignDraft) => {
    setCampaignId(draft.id)
    setTitle(draft.title)
    setPrompt(draft.prompt)
    setCount(draft.count)
    setIntervalDays(draft.intervalDays)
    setScheduledFor(draft.scheduledFor)
    setNetworks(draft.networks)
    setConnectionIds(draft.connectionIds)
    setTone(draft.tone)
    setGoal(draft.goal)
    setLength(draft.length)
    setIncludeImage(draft.includeImage)
    setSelectedSourceId(draft.selectedSourceId)
    setTargetAudience(draft.targetAudience)
    setKeyMessage(draft.keyMessage)
    setCallToAction(draft.callToAction)
    setMustInclude(draft.mustInclude)
    setMustAvoid(draft.mustAvoid)
    setPostItems(draft.postItems)

    if (draft.posts && draft.posts.length > 0) {
      setPosts(draft.posts)
      setCurrentStep((draft.currentStep as 1 | 2 | 3 | 4) || 1)
      if (!isDemo && draft.postIds?.length) {
        Promise.allSettled(draft.postIds.map((id) => socialComposerApi.getPost(id))).then((results) => {
          const fresh = results
            .filter((r): r is PromiseFulfilledResult<SocialPost> => r.status === 'fulfilled')
            .map((r) => r.value)
          if (fresh.length > 0) {
            setPosts(fresh)
          }
        })
      }
    } else {
      setPosts([])
      if (draft.currentStep === 4) {
        setCurrentStep(3)
      } else {
        setCurrentStep((draft.currentStep as 1 | 2 | 3 | 4) || 1)
      }
    }

    setSavedDraftsModalOpen(false)
    setDraftToast(`Resumed "${draft.title || 'Untitled series'}"`)
    setTimeout(() => setDraftToast(''), 3500)
  }

  // Delete a saved draft campaign
  const handleDeleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteSeriesCampaignDraft(id, workspaceId)
    setSavedDraftsList(getSavedSeriesDrafts(workspaceId))
  }

  // Start fresh campaign
  const handleStartFresh = () => {
    setCampaignId(`series-${Date.now()}`)
    setTitle('')
    setPrompt('')
    setCount(3)
    setIntervalDays(7)
    setScheduledFor(firstDate())
    setTone('Professional')
    setGoal('Awareness')
    setLength('Medium')
    setIncludeImage(false)
    setSelectedSourceId('')
    setTargetAudience('')
    setKeyMessage('')
    setCallToAction('')
    setMustInclude('')
    setMustAvoid('')
    setPostItems(
      Array.from({ length: 3 }, (_, index) => ({
        idea_title: `Part ${index + 1}`,
        idea_text: '',
        scheduled_for: calculateDate(firstDate(), index * 7),
      }))
    )
    setPosts([])
    setCurrentStep(1)
    setDraftToast('Started new campaign')
    setTimeout(() => setDraftToast(''), 2500)
  }

  // Sync postItems length when count changes
  const handleCountChange = (newCount: number) => {
    const clamped = Math.max(2, Math.min(6, newCount))
    setCount(clamped)
    setPostItems((current) => {
      const next = [...current]
      while (next.length < clamped) {
        const idx = next.length
        next.push({
          idea_title: `${title.trim() || 'Part'} ${idx + 1}`,
          idea_text: '',
          scheduled_for: calculateDate(scheduledFor, idx * intervalDays),
        })
      }
      return next.slice(0, clamped)
    })
  }

  const handleBaseScheduleChange = (newBaseDate: string) => {
    setScheduledFor(newBaseDate)
    setPostItems((current) =>
      current.map((item, index) => ({
        ...item,
        scheduled_for: calculateDate(newBaseDate, index * intervalDays),
      }))
    )
  }

  const handleIntervalChange = (newInterval: number) => {
    setIntervalDays(newInterval)
    setPostItems((current) =>
      current.map((item, index) => ({
        ...item,
        scheduled_for: calculateDate(scheduledFor, index * newInterval),
      }))
    )
  }

  const handleItemChange = (index: number, field: keyof SeriesPostItem, value: any) => {
    setPostItems((current) => {
      const copy = [...current]
      if (copy[index]) {
        copy[index] = { ...copy[index], [field]: value }
      }
      return copy
    })
  }

  const handleSuggestBreakdown = () => {
    setPostItems((current) =>
      current.map((item, index) => {
        const theme = starterPartThemes[index % starterPartThemes.length]
        return {
          ...item,
          idea_title: `Part ${index + 1}: ${theme.title}`,
          idea_text: theme.text,
        }
      })
    )
  }

  // Step transition handlers with automatic saving
  const handleNextStep = (next: 1 | 2 | 3 | 4) => {
    persistCurrentProgress(next)
    setCurrentStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePrevStep = (prev: 1 | 2 | 3 | 4) => {
    persistCurrentProgress(prev)
    setCurrentStep(prev)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Generation action
  const generate = async () => {
    if (!prompt.trim() || !networks.length || !scheduledFor) return
    setBusy(true)
    setError('')
    setSaveStatus('')
    setBatchActionNotice('')
    try {
      const splitList = (val: string) =>
        val
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean)

      let resultPosts: SocialPost[] = []

      if (isDemo) {
        resultPosts = Array.from({ length: count }, (_, index) => {
          const item = postItems[index]
          const partTitle = item?.idea_title.trim() || `${title.trim() || 'Content series'} — Part ${index + 1}`
          const partText = item?.idea_text.trim() || `${prompt.trim()} (Part ${index + 1} of ${count})`
          const partDate = item?.scheduled_for
            ? new Date(item.scheduled_for).toISOString()
            : new Date(new Date(scheduledFor).getTime() + index * intervalDays * 86400000).toISOString()
          const demo = makeDemoPost(partTitle, partText, networks)
          return {
            ...demo,
            id: `demo-series-${index + 1}`,
            idea_title: partTitle,
            idea_text: partText,
            variants: demo.variants.map((variant) => ({
              ...variant,
              scheduled_for: partDate,
              copy: `${partTitle}\n\n${partText}\n\n${variant.copy}`,
            })),
          }
        })
      } else {
        const res = await socialComposerApi.generateSeries({
          title: title.trim() || 'Content series',
          prompt: prompt.trim(),
          count,
          interval_days: intervalDays,
          scheduled_for: new Date(scheduledFor).toISOString(),
          networks,
          connection_ids: connectionIds,
          controls: {
            tone: tone as any,
            goal: goal as any,
            length: length as any,
            include_image: includeImage || networks.includes('INSTAGRAM'),
          },
          creative_brief: {
            target_audience: targetAudience.trim(),
            key_message: keyMessage.trim(),
            call_to_action: callToAction.trim(),
            must_include: splitList(mustInclude),
            must_avoid: splitList(mustAvoid),
            visual_theme: '',
            image_requirements: '',
            reserve_logo_space: false,
          },
          source_ids: selectedSourceId ? [selectedSourceId] : [],
          items: postItems.slice(0, count).map((item, idx) => ({
            idea_title: item.idea_title.trim() || `${title.trim() || 'Content series'} — Part ${idx + 1}`,
            idea_text: item.idea_text.trim(),
            scheduled_for: item.scheduled_for ? new Date(item.scheduled_for).toISOString() : undefined,
            include_image: item.include_image ?? includeImage,
            image_prompt: item.image_prompt?.trim() || undefined,
          })),
        })
        resultPosts = res.posts
        if (!isDemo && res?.posts) {
          res.posts.forEach((p) => {
            if (p.generation_status === 'GENERATING') {
              startTrackingGeneration(p.id, p.idea_title)
            }
          })
        }
      }

      setPosts(resultPosts)
      setSelectedPostIndex(0)
      if (networks.length > 0) {
        setActiveNetwork(networks[0])
      }
      setCurrentStep(4)
      persistCurrentProgress(4, resultPosts)
    } catch (cause) {
      setError(customerSafeMessage(cause instanceof Error ? cause.message : undefined, 'Could not create the series.'))
    } finally {
      setBusy(false)
    }
  }

  // Active post and variant in review mode (Step 4)
  const currentPost = posts[selectedPostIndex] ?? posts[0]
  const currentVariant = useMemo(() => {
    if (!currentPost) return null
    return currentPost.variants.find((v) => v.network === activeNetwork) || currentPost.variants[0] || null
  }, [currentPost, activeNetwork])

  // Active copy and hashtag edits
  const currentCopy = currentVariant ? (editedCopies[currentVariant.id] ?? currentVariant.copy) : ''
  const currentHashtags = currentVariant
    ? (editedHashtags[currentVariant.id] ?? currentVariant.hashtags.join(', '))
    : ''

  // Save variant copy changes
  const handleSaveVariantCopy = async () => {
    if (!currentVariant || !currentPost) return
    setActionBusy('saving-copy')
    setError('')
    try {
      const hashtagsList = currentHashtags
        .split(/[\n,]+/)
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => (h.startsWith('#') ? h : `#${h}`))

      if (!isDemo) {
        await socialComposerApi.updateVariant(currentVariant.id, {
          copy: currentCopy,
          hashtags: hashtagsList,
        })
      }

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== currentPost.id) return p
          return {
            ...p,
            variants: p.variants.map((v) =>
              v.id === currentVariant.id ? { ...v, copy: currentCopy, hashtags: hashtagsList } : v
            ),
          }
        })
      )
      setSaveStatus('Variant changes saved.')
      setTimeout(() => setSaveStatus(''), 3000)
    } catch (cause) {
      setError(customerSafeMessage(cause instanceof Error ? cause.message : undefined, 'Could not save variant edits.'))
    } finally {
      setActionBusy('')
    }
  }

  // Generate or regenerate image for a variant
  const handleGenerateVariantImage = async (variant: SocialVariant) => {
    if (!currentPost) return
    setActionBusy(`img-${variant.id}`)
    setError('')
    try {
      if (isDemo) {
        setSaveStatus('Demo image preview generated.')
        setTimeout(() => setSaveStatus(''), 2500)
        return
      }
      const prompt = variant.metadata?.image_prompt || currentPost.idea_title
      await socialComposerApi.regenerateImage(
        variant.id,
        prompt,
        undefined,
        variant.metadata?.alt_text || ''
      )
      const refreshed = await socialComposerApi.getPost(currentPost.id)
      setPosts((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)))
      setSaveStatus('Image generated successfully.')
      setTimeout(() => setSaveStatus(''), 3000)
    } catch (cause) {
      setError(customerSafeMessage(cause instanceof Error ? cause.message : undefined, 'Could not generate the image.'))
    } finally {
      setActionBusy('')
    }
  }

  // Approve single post
  const handleApprovePost = async (postIndex: number) => {
    const targetPost = posts[postIndex]
    if (!targetPost) return
    setActionBusy(`approve-${targetPost.id}`)
    setError('')
    try {
      if (!isDemo) {
        for (const variant of targetPost.variants) {
          try {
            await socialComposerApi.approveVariant(variant.id)
          } catch {
            await socialComposerApi.submitForReview(targetPost.id)
            break
          }
        }
      }

      setPosts((prev) =>
        prev.map((p, idx) =>
          idx === postIndex
            ? {
                ...p,
                state: 'APPROVED' as any,
                variants: p.variants.map((v) => ({ ...v, status: 'APPROVED' as any })),
              }
            : p
        )
      )
      setSaveStatus(`Post ${postIndex + 1} approved.`)
      setTimeout(() => setSaveStatus(''), 3000)
    } catch (cause) {
      setError(customerSafeMessage(cause instanceof Error ? cause.message : undefined, 'Could not approve this post.'))
    } finally {
      setActionBusy('')
    }
  }

  // Schedule single post
  const handleSchedulePost = async (postIndex: number) => {
    const targetPost = posts[postIndex]
    if (!targetPost) return
    setActionBusy(`schedule-${targetPost.id}`)
    setError('')
    try {
      if (!isDemo) {
        await socialComposerApi.schedule(targetPost.id)
      }

      setPosts((prev) =>
        prev.map((p, idx) =>
          idx === postIndex
            ? {
                ...p,
                state: 'SCHEDULED' as any,
                variants: p.variants.map((v) => ({ ...v, status: 'SCHEDULED' as any })),
              }
            : p
        )
      )
      setSaveStatus(`Post ${postIndex + 1} scheduled successfully!`)
      setTimeout(() => setSaveStatus(''), 3000)
    } catch (cause) {
      setError(customerSafeMessage(cause instanceof Error ? cause.message : undefined, 'Could not schedule this post.'))
    } finally {
      setActionBusy('')
    }
  }

  // Batch action: Approve all posts
  const handleApproveAll = async () => {
    setActionBusy('approve-all')
    setError('')
    try {
      if (!isDemo) {
        for (const p of posts) {
          if (p.state !== 'APPROVED' && p.state !== 'SCHEDULED') {
            for (const v of p.variants) {
              try {
                await socialComposerApi.approveVariant(v.id)
              } catch {
                await socialComposerApi.submitForReview(p.id)
                break
              }
            }
          }
        }
      }

      setPosts((prev) =>
        prev.map((p) => ({
          ...p,
          state: p.state === 'SCHEDULED' ? 'SCHEDULED' : ('APPROVED' as any),
          variants: p.variants.map((v) => ({
            ...v,
            status: v.status === 'SCHEDULED' ? 'SCHEDULED' : ('APPROVED' as any),
          })),
        }))
      )
      setBatchActionNotice(`All ${posts.length} posts have been approved!`)
      setTimeout(() => setBatchActionNotice(''), 4000)
    } catch (cause) {
      setError(customerSafeMessage(cause instanceof Error ? cause.message : undefined, 'Could not approve all posts.'))
    } finally {
      setActionBusy('')
    }
  }

  // Batch action: Schedule all posts
  const handleScheduleAll = async () => {
    setActionBusy('schedule-all')
    setError('')
    try {
      if (!isDemo) {
        for (const p of posts) {
          if (p.state !== 'SCHEDULED') {
            await socialComposerApi.schedule(p.id)
          }
        }
      }

      setPosts((prev) =>
        prev.map((p) => ({
          ...p,
          state: 'SCHEDULED' as any,
          variants: p.variants.map((v) => ({ ...v, status: 'SCHEDULED' as any })),
        }))
      )
      setBatchActionNotice(`Entire series of ${posts.length} posts has been scheduled!`)
      setTimeout(() => setBatchActionNotice(''), 5000)
    } catch (cause) {
      setError(customerSafeMessage(cause instanceof Error ? cause.message : undefined, 'Could not schedule all posts.'))
    } finally {
      setActionBusy('')
    }
  }

  const approvedCount = posts.filter((p) => p.state === 'APPROVED' || p.variants.some((v) => v.status === 'APPROVED')).length
  const scheduledCount = posts.filter((p) => p.state === 'SCHEDULED' || p.variants.some((v) => v.status === 'SCHEDULED')).length

  return (
    <section className="studio-screen series-screen" aria-label="Create a post series">
      {/* Top Header & Drafts Bar */}
      <div className="series-top-toolbar">
        <div className="series-stepper-track">
          <button
            type="button"
            className={`series-step-pill ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}
            onClick={() => handleNextStep(1)}
          >
            <span className="step-num">1</span>
            <span className="step-label">Campaign Concept</span>
          </button>
          <span className="step-divider" />
          <button
            type="button"
            className={`series-step-pill ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}
            onClick={() => handleNextStep(2)}
          >
            <span className="step-num">2</span>
            <span className="step-label">Voice & Cadence</span>
          </button>
          <span className="step-divider" />
          <button
            type="button"
            className={`series-step-pill ${currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : ''}`}
            onClick={() => handleNextStep(3)}
          >
            <span className="step-num">3</span>
            <span className="step-label">Post Breakdown</span>
          </button>
          <span className="step-divider" />
          <button
            type="button"
            className={`series-step-pill ${currentStep === 4 ? 'active' : ''}`}
            disabled={posts.length === 0}
            onClick={() => setCurrentStep(4)}
          >
            <span className="step-num">4</span>
            <span className="step-label">Review & Schedule ({posts.length})</span>
          </button>
        </div>

        <div className="series-toolbar-actions">
          {draftToast && (
            <span className="series-draft-toast" role="status">
              <Check size={14} />
              {draftToast}
            </span>
          )}

          <button
            type="button"
            className="button button-subtle series-saved-campaigns-btn"
            onClick={() => {
              setSavedDraftsList(getSavedSeriesDrafts(workspaceId))
              setSavedDraftsModalOpen(true)
            }}
            title="Open saved series drafts"
          >
            <FolderOpen size={16} />
            <span>Saved Drafts ({savedDraftsList.length})</span>
          </button>

          <button
            type="button"
            className="button button-subtle"
            onClick={handleStartFresh}
            title="Start a fresh campaign"
          >
            <span>Start New</span>
          </button>
        </div>
      </div>

      {/* Saved Draft Campaigns Modal */}
      {savedDraftsModalOpen && (
        <div className="series-modal-overlay" onClick={() => setSavedDraftsModalOpen(false)}>
          <div className="series-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="series-modal-header">
              <div className="series-modal-title">
                <FolderOpen size={20} className="series-icon-sparkle" />
                <h3>Saved Series Drafts</h3>
              </div>
              <button
                type="button"
                className="series-modal-close"
                onClick={() => setSavedDraftsModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <p className="series-modal-desc">
              Your series campaign drafts are saved automatically after each step. You can resume any in-progress
              campaign right where you left off.
            </p>

            <div className="series-saved-drafts-list">
              {savedDraftsList.length === 0 ? (
                <div className="series-empty-saved">
                  <p>No saved series drafts yet. Fill in any step and save to keep your campaign draft here.</p>
                </div>
              ) : (
                savedDraftsList.map((draft) => (
                  <div key={draft.id} className="series-saved-item" onClick={() => handleResumeDraft(draft)}>
                    <div className="series-saved-meta">
                      <strong>{draft.title || 'Untitled Campaign Series'}</strong>
                      <div className="series-saved-details">
                        <span>{draft.count} parts</span>
                        <span>·</span>
                        <span>Step {draft.currentStep} of 3</span>
                        <span>·</span>
                        <small>{new Date(draft.updatedAt).toLocaleString()}</small>
                      </div>
                    </div>
                    <div className="series-saved-actions">
                      <button type="button" className="button button-subtle button-sm">
                        Resume
                      </button>
                      <button
                        type="button"
                        className="series-delete-draft-btn"
                        onClick={(e) => handleDeleteDraft(draft.id, e)}
                        title="Delete draft"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="li-banner error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: CAMPAIGN CONCEPT & ACCOUNTS */}
      {currentStep === 1 && (
        <div className="card series-panel series-step-panel">
          <div className="series-heading">
            <Sparkles size={26} className="series-icon-sparkle" />
            <div>
              <h2>Plan a content series</h2>
              <p>
                Step 1 of 3: Define your series topic, overarching narrative brief, and connected publishing accounts.
                Save your progress and advance to customize voice and cadence.
              </p>
            </div>
          </div>

          <div className="series-form">
            <div className="series-card-section">
              <div className="series-section-header">
                <Layers size={18} />
                <h3>1. Campaign Narrative & Theme</h3>
              </div>

              <label className="li-field">
                <span>Series title</span>
                <input
                  value={title}
                  onChange={(event) => {
                    const val = event.target.value
                    setTitle(val)
                    setPostItems((current) =>
                      current.map((it, i) => ({
                        ...it,
                        idea_title: it.idea_title.startsWith('Part ') && val ? `${val} — Part ${i + 1}` : it.idea_title,
                      }))
                    )
                  }}
                  placeholder="e.g. Master Modern Product Strategy in 5 Days"
                />
              </label>

              <label className="li-field">
                <span>Series brief</span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Explain the overarching theme, audience, goal, and the narrative journey this series covers across its posts…"
                  rows={4}
                />
              </label>
            </div>

            <div className="series-card-section">
              <div className="series-section-header">
                <CalendarClock size={18} />
                <h3>Publishing Accounts & Post Count</h3>
              </div>

              <div className="series-grid">
                <label className="li-field">
                  <span>Number of posts</span>
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={count}
                    onChange={(event) => handleCountChange(Number(event.target.value))}
                  />
                </label>
              </div>

              <fieldset className="series-networks">
                <legend>Publishing accounts</legend>
                {options?.connections.map((item) => (
                  <label key={item.id} className="series-network-chip">
                    <input
                      type="checkbox"
                      disabled={item.health !== 'HEALTHY' || busy}
                      checked={connectionIds.includes(item.id)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          const replaced = options.connections
                            .filter((candidate) => candidate.network === item.network)
                            .map((candidate) => candidate.id)
                          setConnectionIds((current) => [
                            ...current.filter((id) => !replaced.includes(id)),
                            item.id,
                          ])
                          setNetworks((current) =>
                            current.includes(item.network) ? current : [...current, item.network]
                          )
                        } else {
                          setConnectionIds((current) => current.filter((id) => id !== item.id))
                          setNetworks((current) => current.filter((value) => value !== item.network))
                        }
                      }}
                    />
                    <span>
                      <strong>{item.label}</strong> · {item.display_name}
                    </span>
                  </label>
                ))}
                {options && !options.connections.length && (
                  <p className="series-no-connections">Connect a social account to create a series.</p>
                )}
              </fieldset>
            </div>

            {/* Step 1 Footer Actions */}
            <div className="series-step-footer">
              <button
                type="button"
                className="button button-subtle"
                onClick={() => persistCurrentProgress(1)}
              >
                <Save size={16} />
                <span>Save Draft</span>
              </button>

              <div className="series-step-footer-right">
                <button
                  type="button"
                  className="button button-subtle"
                  disabled={busy || !prompt.trim() || !networks.length}
                  onClick={() => void generate()}
                >
                  <Sparkles size={16} />
                  <span>{isDemo ? `Preview ${count} parts` : `Create ${count} drafts`}</span>
                </button>

                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => handleNextStep(2)}
                >
                  <span>Continue to Step 2 (Voice & Cadence)</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: VOICE, CADENCE & SCHEDULE */}
      {currentStep === 2 && (
        <div className="card series-panel series-step-panel">
          <div className="series-heading">
            <Sliders size={26} className="series-icon-sparkle" />
            <div>
              <h2>Voice, Tone & Publishing Cadence</h2>
              <p>
                Step 2 of 3: Configure publishing frequency, timing, brand tone, and generation guardrails. Save your
                progress and proceed to define individual post takeaways.
              </p>
            </div>
          </div>

          <div className="series-form">
            <div className="series-card-section">
              <div className="series-section-header">
                <CalendarDays size={18} />
                <h3>Schedule & Cadence</h3>
              </div>

              <div className="series-grid">
                <label className="li-field">
                  <span>Days between posts</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={intervalDays}
                    onChange={(event) => handleIntervalChange(Number(event.target.value))}
                  />
                </label>
                <label className="li-field">
                  <span>First publish time</span>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(event) => handleBaseScheduleChange(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="series-card-section">
              <div className="series-section-header">
                <Sliders size={18} />
                <h3>Brand Controls & Creative Voice</h3>
              </div>

              <div className="series-controls-grid">
                <label className="li-field">
                  <span>Tone</span>
                  <select value={tone} onChange={(e) => setTone(e.target.value)}>
                    {(options?.generation_controls.tones ?? ['Professional', 'Friendly', 'Bold', 'Educational', 'Casual']).map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="li-field">
                  <span>Goal</span>
                  <select value={goal} onChange={(e) => setGoal(e.target.value)}>
                    {(options?.generation_controls.goals ?? ['Awareness', 'Engagement', 'Education', 'Leads']).map(
                      (g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="li-field">
                  <span>Length</span>
                  <select value={length} onChange={(e) => setLength(e.target.value)}>
                    {(options?.generation_controls.lengths ?? ['Short', 'Medium', 'Long']).map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>

                {options?.sources && options.sources.length > 0 && (
                  <label className="li-field">
                    <span>Source Material</span>
                    <select value={selectedSourceId} onChange={(e) => setSelectedSourceId(e.target.value)}>
                      <option value="">No reference source</option>
                      {options.sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <label className="series-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeImage}
                  onChange={(e) => setIncludeImage(e.target.checked)}
                />
                <span>Generate contextual visual images for supporting platforms</span>
              </label>

              {/* Collapsible Creative Brief */}
              <div className="series-creative-brief-box">
                <button
                  type="button"
                  className="series-brief-toggle"
                  onClick={() => setBriefOpen((prev) => !prev)}
                >
                  <PenSquare size={16} />
                  <span>Creative Brief & Guardrails (Optional)</span>
                  {briefOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {briefOpen && (
                  <div className="series-brief-fields">
                    <div className="series-grid-2">
                      <label className="li-field">
                        <span>Target Audience</span>
                        <input
                          value={targetAudience}
                          onChange={(e) => setTargetAudience(e.target.value)}
                          placeholder="e.g. Senior product leaders, startup founders"
                        />
                      </label>
                      <label className="li-field">
                        <span>Key Message</span>
                        <input
                          value={keyMessage}
                          onChange={(e) => setKeyMessage(e.target.value)}
                          placeholder="e.g. Build product conviction with small rapid tests"
                        />
                      </label>
                    </div>
                    <div className="series-grid-3">
                      <label className="li-field">
                        <span>Call to Action</span>
                        <input
                          value={callToAction}
                          onChange={(e) => setCallToAction(e.target.value)}
                          placeholder="e.g. Drop your experiences below"
                        />
                      </label>
                      <label className="li-field">
                        <span>Must Include Terms</span>
                        <input
                          value={mustInclude}
                          onChange={(e) => setMustInclude(e.target.value)}
                          placeholder="comma separated"
                        />
                      </label>
                      <label className="li-field">
                        <span>Must Avoid Terms</span>
                        <input
                          value={mustAvoid}
                          onChange={(e) => setMustAvoid(e.target.value)}
                          placeholder="comma separated"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 Footer Actions */}
            <div className="series-step-footer">
              <button
                type="button"
                className="button button-subtle"
                onClick={() => handlePrevStep(1)}
              >
                <ArrowLeft size={16} />
                <span>Back to Step 1</span>
              </button>

              <div className="series-step-footer-right">
                <button
                  type="button"
                  className="button button-subtle"
                  onClick={() => persistCurrentProgress(2)}
                >
                  <Save size={16} />
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => handleNextStep(3)}
                >
                  <span>Continue to Step 3 (Post Breakdown)</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: POST-BY-POST BREAKDOWN */}
      {currentStep === 3 && (
        <div className="card series-panel series-step-panel">
          <div className="series-heading">
            <Sparkles size={26} className="series-icon-sparkle" />
            <div>
              <h2>Post-by-Post Breakdown & Angles</h2>
              <p>
                Step 3 of 3: Give each post in the series a distinct angle, takeaway, and scheduled time. When ready,
                create all drafts in one action to review and approve them.
              </p>
            </div>
          </div>

          <div className="series-form">
            <div className="series-card-section">
              <div className="series-section-header series-between-header">
                <div>
                  <Sparkles size={18} />
                  <h3>Part Focus & Key Takeaways</h3>
                  <p className="series-section-sub">
                    Specify the distinct idea and angle for each post in the sequence.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-subtle series-suggest-btn"
                  onClick={handleSuggestBreakdown}
                  title="Auto-fill progressive themes for each part"
                >
                  <Wand2 size={15} />
                  <span>Auto-fill starter breakdown</span>
                </button>
              </div>

              <div className="series-parts-stack">
                {postItems.slice(0, count).map((item, index) => (
                  <div key={index} className="series-part-card">
                    <div className="series-part-badge-row">
                      <span className="series-part-number">Part {index + 1} of {count}</span>
                      <div className="series-part-date-wrapper">
                        <CalendarDays size={14} />
                        <input
                          type="datetime-local"
                          className="series-part-date-input"
                          value={item.scheduled_for}
                          onChange={(e) => handleItemChange(index, 'scheduled_for', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="series-part-inputs">
                      <label className="li-field">
                        <span>Post subtitle / angle</span>
                        <input
                          value={item.idea_title}
                          onChange={(e) => handleItemChange(index, 'idea_title', e.target.value)}
                          placeholder={`e.g. Part ${index + 1}: The Core Strategy`}
                        />
                      </label>

                      <label className="li-field">
                        <span>Specific idea & takeaway for this post</span>
                        <textarea
                          rows={2}
                          value={item.idea_text}
                          onChange={(e) => handleItemChange(index, 'idea_text', e.target.value)}
                          placeholder={`What key point, lesson, or story should Part ${index + 1} focus on?`}
                        />
                      </label>

                      <div className="series-part-image-toggle-row" style={{ marginTop: 8, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                        <label className="series-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={item.include_image ?? includeImage}
                            onChange={(e) => handleItemChange(index, 'include_image', e.target.checked)}
                          />
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>
                            Generate AI image for this post
                          </span>
                        </label>
                        {(item.include_image ?? includeImage) && (
                          <div style={{ marginTop: 8 }}>
                            <label className="li-field" style={{ marginBottom: 0 }}>
                              <span style={{ fontSize: 12 }}>Custom image prompt (optional)</span>
                              <input
                                value={item.image_prompt ?? ''}
                                onChange={(e) => handleItemChange(index, 'image_prompt', e.target.value)}
                                placeholder={`Specific visual prompt for Part ${index + 1} (leave blank to auto-direct)`}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3 Footer Actions */}
            <div className="series-step-footer">
              <button
                type="button"
                className="button button-subtle"
                onClick={() => handlePrevStep(2)}
              >
                <ArrowLeft size={16} />
                <span>Back to Step 2</span>
              </button>

              <div className="series-step-footer-right">
                <button
                  type="button"
                  className="button button-subtle"
                  onClick={() => persistCurrentProgress(3)}
                >
                  <Save size={16} />
                  <span>Save Draft</span>
                </button>

                <button
                  className="button button-dark series-submit-btn"
                  type="button"
                  disabled={
                    busy ||
                    !prompt.trim() ||
                    !networks.length ||
                    !scheduledFor ||
                    count < 2 ||
                    count > 6
                  }
                  aria-busy={busy}
                  onClick={() => void generate()}
                >
                  {busy ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                  {busy
                    ? ' Generating series with AI…'
                    : isDemo
                    ? ` Preview ${count} parts`
                    : ` Create ${count} drafts`}
                </button>
              </div>
            </div>

            {busy && (
              <p role="status" className="series-generating-status">
                Generating tailored posts for each connected network. Keep this page open while drafts are prepared.
              </p>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW, APPROVE & SCHEDULE */}
      {currentStep === 4 && (
        posts.length > 0 ? (
          <section className="card series-results" aria-label="Review series drafts">
          <div className="series-results-header">
            <div>
              <h2>{isDemo ? `${posts.length} series previews` : `${posts.length} drafts are ready`}</h2>
              <p>
                {isDemo
                  ? 'Demo previews are ready. Review each part, tailored copies, and scheduled times.'
                  : 'Review the tailored copy for each network, approve drafts, or schedule the whole series in one click.'}
              </p>
            </div>

            {/* Batch Series Controls */}
            <div className="series-batch-actions">
              <button
                type="button"
                className="button button-subtle"
                onClick={() => setCurrentStep(1)}
              >
                <ArrowLeft size={16} />
                <span>Edit Series Setup</span>
              </button>

              <button
                type="button"
                className="button button-subtle"
                disabled={actionBusy === 'approve-all' || approvedCount === posts.length}
                onClick={() => void handleApproveAll()}
              >
                {actionBusy === 'approve-all' ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <CheckCheck size={16} />
                )}
                <span>Approve All ({posts.length})</span>
              </button>

              <button
                type="button"
                className="button button-dark"
                disabled={actionBusy === 'schedule-all' || scheduledCount === posts.length}
                onClick={() => void handleScheduleAll()}
              >
                {actionBusy === 'schedule-all' ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <CalendarCheck size={16} />
                )}
                <span>Schedule Entire Series</span>
              </button>
            </div>
          </div>

          {batchActionNotice && (
            <div className="li-banner success" role="status">
              <Check size={18} />
              <span>{batchActionNotice}</span>
            </div>
          )}

          {posts.some((p) => p.generation_status === 'GENERATING') && (
            <div className="li-banner warning" role="status">
              <LoaderCircle className="spin" size={16} />
              <span>AI is generating series drafts in the background with Celery. Platform copies will populate automatically as each part completes.</span>
            </div>
          )}

          {/* Review Workspace: Left Navigation Rail & Right Post Content */}
          <div className="series-review-workspace">
            {/* Left Rail: Post Parts */}
            <div className="series-posts-rail">
              <h4>Series Sequence</h4>
              <div className="series-rail-list">
                {posts.map((post, idx) => {
                  const isCurrent = idx === selectedPostIndex
                  const isScheduled = post.state === 'SCHEDULED' || post.variants.some((v) => v.status === 'SCHEDULED')
                  const isApproved =
                    post.state === 'APPROVED' || post.variants.some((v) => v.status === 'APPROVED')
                  const firstVariantDate = post.variants[0]?.scheduled_for

                  return (
                    <div
                      key={post.id}
                      className={`series-rail-card ${isCurrent ? 'active' : ''}`}
                      onClick={() => setSelectedPostIndex(idx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedPostIndex(idx)
                        }
                      }}
                    >
                      <div className="series-rail-top">
                        <span className="series-rail-part">Part {idx + 1}</span>
                        <span
                          className={`series-status-tag ${
                            post.generation_status === 'GENERATING'
                              ? 'generating'
                              : post.generation_status === 'FAILED'
                              ? 'failed'
                              : isScheduled
                              ? 'scheduled'
                              : isApproved
                              ? 'approved'
                              : 'draft'
                          }`}
                        >
                          {post.generation_status === 'GENERATING'
                            ? 'Generating...'
                            : post.generation_status === 'FAILED'
                            ? 'Failed'
                            : isScheduled
                            ? 'Scheduled'
                            : isApproved
                            ? 'Approved'
                            : 'Draft'}
                        </span>
                      </div>
                      <Link
                        to={`/content/create?draft=${post.id}`}
                        className="series-rail-link"
                        onClick={(e) => e.stopPropagation()}
                        title="Open this draft in Composer"
                      >
                        <strong>{post.idea_title}</strong>
                      </Link>
                      <div className="series-rail-date">
                        <CalendarDays size={13} />
                        <span>
                          {firstVariantDate
                            ? new Date(firstVariantDate).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Unscheduled'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Editor/Preview Area */}
            {currentPost && (
              <div className="series-post-viewer">
                {/* Viewer Top Bar */}
                <div className="series-viewer-bar">
                  <div className="series-viewer-meta">
                    <h3>{currentPost.idea_title}</h3>
                    <p>{currentPost.idea_text}</p>
                  </div>

                  <div className="series-viewer-actions">
                    <Link
                      to={`/content/create?draft=${currentPost.id}`}
                      className="button button-subtle series-open-draft-link"
                      title="Open full composer for advanced media and thread editing"
                    >
                      <ExternalLink size={15} />
                      <span>Open draft</span>
                    </Link>

                    <button
                      type="button"
                      className="button button-subtle"
                      disabled={
                        actionBusy === `approve-${currentPost.id}` ||
                        currentPost.generation_status === 'GENERATING' ||
                        currentPost.state === 'APPROVED' ||
                        currentPost.state === 'SCHEDULED'
                      }
                      onClick={() => void handleApprovePost(selectedPostIndex)}
                    >
                      {actionBusy === `approve-${currentPost.id}` ? (
                        <LoaderCircle className="spin" size={15} />
                      ) : (
                        <Check size={15} />
                      )}
                      <span>
                        {currentPost.state === 'APPROVED' || currentPost.state === 'SCHEDULED'
                          ? 'Approved'
                          : 'Approve Part'}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="button button-dark"
                      disabled={
                        actionBusy === `schedule-${currentPost.id}` ||
                        currentPost.generation_status === 'GENERATING' ||
                        currentPost.state === 'SCHEDULED'
                      }
                      onClick={() => void handleSchedulePost(selectedPostIndex)}
                    >
                      {actionBusy === `schedule-${currentPost.id}` ? (
                        <LoaderCircle className="spin" size={15} />
                      ) : (
                        <Send size={15} />
                      )}
                      <span>
                        {currentPost.state === 'SCHEDULED' ? 'Scheduled' : 'Schedule Part'}
                      </span>
                    </button>
                  </div>
                </div>

                {saveStatus && (
                  <div className="li-banner success" role="status">
                    <Check size={16} />
                    <span>{saveStatus}</span>
                  </div>
                )}

                {currentPost.generation_status === 'GENERATING' && (
                  <div className="li-banner warning" role="status" style={{ marginBottom: 12 }}>
                    <LoaderCircle className="spin" size={15} />
                    <span>AI is generating tailored copy for this part in the background. It will automatically populate once complete.</span>
                  </div>
                )}

                {currentPost.generation_status === 'FAILED' && (
                  <div className="li-banner error" role="status" style={{ marginBottom: 12 }}>
                    <AlertCircle size={15} />
                    <span>Generation failed: {currentPost.generation_error || 'An error occurred during generation.'}</span>
                  </div>
                )}

                {/* Network Switcher Tabs */}
                <div className="series-network-tabs">
                  {currentPost.variants.map((variant) => (
                    <button
                      key={variant.network}
                      type="button"
                      className={`series-network-tab ${
                        variant.network === activeNetwork ? 'active' : ''
                      }`}
                      onClick={() => setActiveNetwork(variant.network)}
                    >
                      <span>{variant.network_label}</span>
                      <small>({variant.account?.display_name || variant.network})</small>
                    </button>
                  ))}
                </div>

                {/* Platform Copy Editor */}
                {currentVariant && (
                  <div className="series-editor-body">
                    <div className="series-editor-field">
                      <div className="series-field-header">
                        <span>Tailored Post Copy ({currentVariant.network_label})</span>
                        <span className="series-char-count">{currentCopy.length} characters</span>
                      </div>
                      <textarea
                        rows={8}
                        className="series-copy-textarea"
                        value={currentCopy}
                        onChange={(e) => {
                          const val = e.target.value
                          setEditedCopies((prev) => ({ ...prev, [currentVariant.id]: val }))
                        }}
                      />
                    </div>

                    <div className="series-editor-field">
                      <div className="series-field-header">
                        <span>Hashtags</span>
                      </div>
                      <input
                        value={currentHashtags}
                        onChange={(e) => {
                          const val = e.target.value
                          setEditedHashtags((prev) => ({ ...prev, [currentVariant.id]: val }))
                        }}
                        placeholder="#strategy, #growth"
                      />
                    </div>

                    <div className="series-editor-field series-media-field">
                      <div className="series-field-header">
                        <span>Media & Visual ({currentVariant.network_label})</span>
                      </div>
                      {currentVariant.media && currentVariant.media.length > 0 ? (
                        <div className="series-media-preview-box" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          {currentVariant.media.map((asset) => (
                            <div key={asset.id} style={{ maxWidth: 200, position: 'relative' }}>
                              <img
                                src={asset.publish_url}
                                alt={asset.alt_text || currentPost.idea_title}
                                style={{ width: '100%', height: 'auto', borderRadius: 6, display: 'block', objectFit: 'cover' }}
                              />
                              {asset.alt_text && (
                                <p style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>
                                  {asset.alt_text}
                                </p>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            className="button button-subtle"
                            style={{ alignSelf: 'flex-start', marginTop: 4 }}
                            disabled={actionBusy === `img-${currentVariant.id}`}
                            onClick={() => void handleGenerateVariantImage(currentVariant)}
                          >
                            {actionBusy === `img-${currentVariant.id}` ? (
                              <LoaderCircle className="spin" size={14} />
                            ) : (
                              <Sparkles size={14} />
                            )}
                            <span>Regenerate Image</span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 }}>
                            <ImageIcon size={16} />
                            <span>No image attached yet for this platform draft.</span>
                          </div>
                          <button
                            type="button"
                            className="button button-subtle"
                            disabled={actionBusy === `img-${currentVariant.id}`}
                            onClick={() => void handleGenerateVariantImage(currentVariant)}
                          >
                            {actionBusy === `img-${currentVariant.id}` ? (
                              <LoaderCircle className="spin" size={14} />
                            ) : (
                              <Sparkles size={14} />
                            )}
                            <span>Generate AI Image</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="series-editor-save-row">
                      <button
                        type="button"
                        className="button button-subtle series-save-btn"
                        disabled={actionBusy === 'saving-copy'}
                        onClick={() => void handleSaveVariantCopy()}
                      >
                        {actionBusy === 'saving-copy' ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <Save size={15} />
                        )}
                        <span>Save Copy Changes</span>
                      </button>

                      <span className="series-variant-schedule-info">
                        Scheduled for:{' '}
                        <strong>
                          {new Date(currentVariant.scheduled_for).toLocaleString()}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        ) : (
          <section className="card series-results empty-series-results" aria-label="No series drafts">
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <Sparkles size={40} style={{ color: '#6366f1', margin: '0 auto 16px', display: 'block' }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
                No Drafts Generated For This Campaign Yet
              </h3>
              <p style={{ color: '#64748b', maxWidth: 480, margin: '0 auto 24px', fontSize: 14, lineHeight: 1.5 }}>
                You have reached Step 4, but drafts for this series haven&apos;t been created yet. Return to Post Breakdown to review your parts and generate your sequence with AI.
              </p>
              <button
                type="button"
                className="button button-dark"
                onClick={() => setCurrentStep(3)}
              >
                <ArrowLeft size={16} />
                <span>Go to Post Breakdown & Generate</span>
              </button>
            </div>
          </section>
        )
      )}
    </section>
  )
}
