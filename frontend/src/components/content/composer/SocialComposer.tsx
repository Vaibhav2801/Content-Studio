import { BookOpen, CalendarClock, Check, FileText, Image as ImageIcon, LoaderCircle, Palette, PenLine, Plus, Save, Send, Sparkles, TriangleAlert } from 'lucide-react'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { socialComposerApi } from '../../../api/socialComposer'

import { makeDemoPost, socialComposerMockOptions } from '../../../api/socialComposerMock'

import type { ComposerOptions, CreativeBrief, GenerationControls, RewriteAction, SocialNetwork, SocialPost, SocialVariant } from '../../../types/socialComposer'

import { useOptionalAuth } from '../AuthContext'

import { useContentStudio } from '../ContentStudioContext'

import { customerSafeMessage } from '../contentUtils'

import { clearComposerRecovery, composerRecoveryEvent, composerRecoveryKey, finishComposerGeneration, readComposerDraft, readComposerForm, rememberComposerDraft, saveComposerForm } from './composerRecovery'

import { MediaManager } from './MediaManager'

import { PlatformPreview } from './PlatformPreview'

import { PlatformSelector } from './PlatformSelector'

import { VariantEditor } from './VariantEditor'

import { useToast } from '../../notifications/useToast'



type StartMode = 'manual' | 'idea' | 'source' | 'draft'

const defaultControls: GenerationControls = { tone: 'Professional', goal: 'Awareness', length: 'Medium', include_image: false }

const defaultCreativeBrief: CreativeBrief = { target_audience: '', key_message: '', call_to_action: '', must_include: [], must_avoid: [], visual_theme: '', image_requirements: '', reserve_logo_space: false }

const splitRequirements = (value: string) => value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)

const ideaStarters = [
  { label: 'Quick tip', title: 'A helpful tip for our audience', idea: 'Share one practical tip our audience can try today. Explain why it helps and end with one clear next step.' },
  { label: 'Common question', title: 'Answer a common customer question', idea: 'Answer a question our customers often ask. Start with the short answer, add a useful example, and invite a follow-up.' },
  { label: 'Behind the scenes', title: 'A look behind the scenes', idea: 'Show one real step in how our team works. Explain the care behind it without inventing details or results.' },
  { label: 'Customer story', title: 'A customer story', idea: 'Tell a customer story using only facts we can verify. Describe the challenge, what changed, and the lesson others can use.' },
]

const startModes = [
  { value: 'idea', label: 'Generate with AI', description: 'Turn a topic or rough notes into ready-to-edit posts.', icon: Sparkles },
  { value: 'source', label: 'Saved source', description: 'Create from approved facts and saved material.', icon: BookOpen },
  { value: 'manual', label: 'Write manually', description: 'Start with a blank post and write it yourself.', icon: PenLine },
  { value: 'draft', label: 'Existing draft', description: 'Continue something you already started.', icon: FileText },
] as const



interface Props { onPostChange?: (post: SocialPost | null) => void }



export function SocialComposer({ onPostChange }: Props) {

  const { isDemo, startTrackingGeneration } = useContentStudio()

  const { showToast } = useToast()

  const auth = useOptionalAuth()

  const navigate = useNavigate()

  const recoveryKey = composerRecoveryKey(auth?.user?.id, auth?.workspace?.id)

  const [searchParams] = useSearchParams()

  const startFresh = searchParams.get('new') === '1'

  const requestedDraft = searchParams.get('draft') ?? ''

  const requestedSource = searchParams.get('source') ?? ''

  const restoredForm = useRef(startFresh || requestedSource ? null : readComposerForm(recoveryKey)).current

  const restoredDraft = useRef(startFresh || requestedSource ? null : readComposerDraft(recoveryKey)).current

  const [options, setOptions] = useState<ComposerOptions | null>(null)

  const [mode, setMode] = useState<StartMode>(restoredForm?.mode ?? 'idea')

  const [ideaTitle, setIdeaTitle] = useState(restoredForm?.ideaTitle ?? '')

  const [ideaText, setIdeaText] = useState(restoredForm?.ideaText ?? '')

  const [sourceIds, setSourceIds] = useState<string[]>(restoredForm?.sourceIds ?? [])

  const [draftId, setDraftId] = useState(restoredDraft?.draftId ?? '')

  const [networks, setNetworks] = useState<SocialNetwork[]>(restoredForm?.networks ?? [])

  const [selectedConnections, setSelectedConnections] = useState<Partial<Record<SocialNetwork, string>>>(restoredForm?.selectedConnections ?? {})

  const [controls, setControls] = useState<GenerationControls>({ ...defaultControls, ...restoredForm?.controls })

  const [creativeBrief, setCreativeBrief] = useState<CreativeBrief>({ ...defaultCreativeBrief, ...restoredForm?.creativeBrief })

  const [post, setPost] = useState<SocialPost | null>(null)

  const [activeNetwork, setActiveNetwork] = useState<SocialNetwork>(restoredForm?.activeNetwork ?? 'LINKEDIN')

  const [saveState, setSaveState] = useState<'SAVED' | 'UNSAVED' | 'SAVING'>('SAVED')

  const [busy, setBusy] = useState('')

  const [notice, setNotice] = useState('')

  const [error, setError] = useState('')

  const saveTimer = useRef<number | undefined>(undefined)

  const openedDraft = useRef('')

  const livePost = useRef<SocialPost | null>(null)

  const editRevision = useRef(0)

  const [dirtyTick, setDirtyTick] = useState(0)

  const [recoveryVersion, setRecoveryVersion] = useState(0)



  useEffect(() => {

    const update = () => setRecoveryVersion((current) => current + 1)

    window.addEventListener(composerRecoveryEvent, update)

    return () => window.removeEventListener(composerRecoveryEvent, update)

  }, [])



  useEffect(() => {

    if (startFresh) clearComposerRecovery(recoveryKey)

  }, [recoveryKey, startFresh])



  useEffect(() => {

    saveComposerForm(recoveryKey, { mode, ideaTitle, ideaText, sourceIds, networks, selectedConnections, controls, creativeBrief, activeNetwork })

  }, [recoveryKey, mode, ideaTitle, ideaText, sourceIds, networks, selectedConnections, controls, creativeBrief, activeNetwork])



  const markUnsaved = () => {

    if (!livePost.current) return

    editRevision.current += 1

    setDirtyTick(editRevision.current)

    setSaveState('UNSAVED')

  }



  const adoptPost = useCallback((value: SocialPost | null) => {

    livePost.current = value

    setPost(value)

    onPostChange?.(value)

    if (value) {

      setIdeaTitle(value.idea_title)

      setIdeaText(value.idea_text)

      setSourceIds(value.sources?.map((source) => source.id) ?? (value.source ? [value.source.id] : []))

      setControls({ ...defaultControls, ...value.controls })

      setCreativeBrief({ ...defaultCreativeBrief, ...value.creative_brief })

      const postNetworks = value.variants.map((variant) => variant.network)

      setNetworks(postNetworks)

      setSelectedConnections((current) => ({ ...current, ...Object.fromEntries(value.variants.filter((variant) => variant.account).map((variant) => [variant.network, variant.account!.id])) }))

      if (!postNetworks.includes(activeNetwork)) setActiveNetwork(postNetworks[0] ?? 'LINKEDIN')

    }

  }, [activeNetwork, onPostChange])



  useEffect(() => {
    const onComplete = (event: Event) => {
      const custom = event as CustomEvent<SocialPost>
      if (custom.detail && (!livePost.current || custom.detail.id === livePost.current.id)) {
        adoptPost(custom.detail)
        setBusy('')
        setNotice('Your generated post is ready to review.')
      }
    }
    const onFailed = (event: Event) => {
      const custom = event as CustomEvent<SocialPost>
      if (custom.detail && (!livePost.current || custom.detail.id === livePost.current.id)) {
        setBusy('')
        setError(custom.detail.generation_error || 'Post generation failed.')
      }
    }
    window.addEventListener('content-studio-generation-complete', onComplete)
    window.addEventListener('content-studio-generation-failed', onFailed)
    return () => {
      window.removeEventListener('content-studio-generation-complete', onComplete)
      window.removeEventListener('content-studio-generation-failed', onFailed)
    }
  }, [adoptPost])



  useEffect(() => {

    let active = true

    const load = async () => {

      try {

        const loaded = isDemo ? structuredClone(socialComposerMockOptions) : await socialComposerApi.options()

        if (!active) return

        setOptions(loaded)

        setSelectedConnections((current) => {
          const next = { ...current }
          for (const connection of loaded.connections) {
            if (!next[connection.network] || !loaded.connections.some((candidate) => candidate.id === next[connection.network])) next[connection.network] = connection.id
          }
          return next
        })

        const first = loaded.connections[0]?.network

        if (first) { setNetworks((current) => current.length ? current : [first]); setActiveNetwork((current) => current || first) }

      } catch (loadError) {

        if (active) setError(customerSafeMessage(loadError instanceof Error ? loadError.message : undefined, 'Could not load the post creator.'))

      }

    }

    void load()

    return () => { active = false; if (saveTimer.current) window.clearTimeout(saveTimer.current) }

  }, [isDemo])



  useEffect(() => {

    const id = requestedDraft || (!requestedSource && !startFresh ? readComposerDraft(recoveryKey)?.draftId : '')

    if (!options || !id || isDemo || openedDraft.current === id) return

    openedDraft.current = id

    let active = true

    let pollTimer: number | undefined

    if (requestedDraft) setMode('draft')

    setDraftId(id)

    setBusy('draft')

    setError('')



    const checkGeneration = async (loaded?: SocialPost) => {

      if (!active) return

      const recovery = readComposerDraft(recoveryKey)

      if (recovery?.draftId !== id) { setBusy(''); return }

      if (recovery.error) {

        setError(recovery.error)

        setBusy('')

        return

      }

      const current = loaded ?? await socialComposerApi.getPost(id)

      if (!active) return

      if (current.generation_status === 'FAILED') {
        const message = current.generation_error || 'Generation did not finish. Your idea is saved; select Generate to try again.'
        finishComposerGeneration(recoveryKey, id, message)
        setBusy('')
        setError(message)
        adoptPost(current)
        return
      }

      if (recovery.generating && recovery.startedAt && Date.now() - recovery.startedAt > 10 * 60 * 1000 && !current.variants.some((variant) => variant.copy.trim())) {
        const message = 'Generation did not finish. Your idea is saved; select Generate to try again.'
        finishComposerGeneration(recoveryKey, id, message)
        setBusy('')
        setError(message)
        adoptPost(current)
        return
      }

      adoptPost(current)

      const isReady = current.generation_status === 'READY' || current.variants.some((variant) => variant.copy.trim())
      if (isReady && current.variants.some((variant) => variant.copy.trim())) {
        if (recovery.generating) finishComposerGeneration(recoveryKey, id)
        setBusy('')
        setNotice(recovery.generating ? 'Your generated post is ready to review.' : '')
        return
      }

      setBusy('generate')

      setNotice('Generating your post… You can leave this page and return to it.')

      pollTimer = window.setTimeout(() => { void checkGeneration().catch(() => {

        if (active) { setBusy(''); setError('Could not check generation progress. Your draft is saved; reopen it from Content Library.') }

      }) }, 2000)

    }



    socialComposerApi.getPost(id)

      .then(async (loaded) => {

        if (!active) return

        adoptPost(loaded)

        setSaveState('SAVED')

        await checkGeneration(loaded)

        if (active && readComposerDraft(recoveryKey)?.draftId !== id) rememberComposerDraft(recoveryKey, id)

      })

      .catch((draftError) => {

        if (!active) return

        openedDraft.current = ''

        setBusy('')

        setError(customerSafeMessage(draftError instanceof Error ? draftError.message : undefined, 'Could not open that draft.'))

      })

    return () => { active = false; if (pollTimer) window.clearTimeout(pollTimer) }

    // A stored draft is reopened only once per mounted editor.

  }, [isDemo, options, requestedDraft, requestedSource, startFresh, recoveryKey, recoveryVersion]) // eslint-disable-line react-hooks/exhaustive-deps



  useEffect(() => {

    if (!options || !requestedSource) return

    const source = options.sources.find((item) => item.id === requestedSource && item.processing_status === 'READY')

    if (!source) return

    setMode('source'); setSourceIds([source.id]); setIdeaTitle((current) => current || source.label)

  }, [options, requestedSource])



  const payload = () => {
    const connection_ids = networks.map((network) => selectedConnections[network]).filter((id): id is string => Boolean(id && !id.startsWith('draft-')))
    return { idea_title: ideaTitle.trim() || 'Untitled idea', idea_text: ideaText.trim(), source_ids: sourceIds, networks, controls, creative_brief: creativeBrief, ...(connection_ids.length ? { connection_ids } : {}) }
  }



  const persist = async () => {

    const current = livePost.current

    const savingRevision = editRevision.current

    setError(''); setSaveState('SAVING')

    try {

      if (!current) {

        const created = isDemo ? makeDemoPost(ideaTitle || 'Untitled idea', ideaText, networks) : await socialComposerApi.createDraft(payload())

        adoptPost(created)

        if (!isDemo) { openedDraft.current = created.id; setDraftId(created.id); rememberComposerDraft(recoveryKey, created.id) }

      } else if (!isDemo) {

        for (const variant of current.variants) await socialComposerApi.updateVariant(variant.id, { copy: variant.copy, hashtags: variant.hashtags, scheduled_for: variant.scheduled_for })

        await socialComposerApi.updatePost(current.id, { idea_title: ideaTitle, idea_text: ideaText, source_ids: sourceIds, networks, controls })

        const refreshed = await socialComposerApi.getPost(current.id)

        if (savingRevision === editRevision.current) adoptPost(refreshed)

      }

      setSaveState(savingRevision === editRevision.current ? 'SAVED' : 'UNSAVED')

      return savingRevision === editRevision.current

    } catch (saveError) {

      setSaveState('UNSAVED')

      setError(customerSafeMessage(saveError instanceof Error ? saveError.message : undefined, 'Could not save this draft.'))

      return false

    }

  }



  useEffect(() => {

    if (saveState !== 'UNSAVED' || !post) return

    if (saveTimer.current) window.clearTimeout(saveTimer.current)

    saveTimer.current = window.setTimeout(() => void persist(), 900)

    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }

    // The post snapshot intentionally resets this debounce whenever the user edits.

  }, [post, saveState, dirtyTick]) // eslint-disable-line react-hooks/exhaustive-deps



  const generate = async () => {

    if (!networks.length) { setError('Choose at least one connected social account.'); return }

    if (!ideaText.trim() && !sourceIds.length) { setError('Describe the idea or choose a saved source.'); return }

    setBusy('generate'); setError(''); setNotice('Saving your draft and starting generation…')

    let generatingId = ''

    try {

      let current = livePost.current

      if (!isDemo && !current) {

        current = await socialComposerApi.createDraft(payload())

        adoptPost(current)

        setDraftId(current.id)

      }

      if (!isDemo && current) {
        generatingId = current.id
        openedDraft.current = current.id
        rememberComposerDraft(recoveryKey, current.id, true)
        startTrackingGeneration?.(current.id, ideaTitle || 'New post')
        setNotice('Generating your post… You can leave this page and return to it.')
      }

      let generated = isDemo ? makeDemoPost(ideaTitle || 'New post', ideaText || options?.sources.filter((item) => sourceIds.includes(item.id)).map((item) => item.text_content).join(' ') || '', networks) : await socialComposerApi.generate({ ...payload(), post_id: generatingId })

      const isStillGenerating = !isDemo && (generated.generation_status === 'GENERATING' || !generated.variants.some((v) => v.copy.trim()))

      if (isStillGenerating) {
        adoptPost(generated)
        setSaveState('SAVED')
        setBusy('generate')
        setNotice('Generating your post… You can freely browse other sections or reload; it will continue in the background.')
        return
      }

      let imageWarning = false
      const imageTargets = generated.variants.filter((variant) => !variant.media.length && (variant.network === 'INSTAGRAM' || controls.include_image))
      if (imageTargets.length && !isDemo) {
        const imageResults = await Promise.allSettled(imageTargets.map((variant) => socialComposerApi.regenerateImage(variant.id, variant.metadata.image_prompt || ideaTitle, undefined, variant.metadata.alt_text || '')))
        imageWarning = imageResults.some((result) => result.status === 'rejected')
        generated = await socialComposerApi.getPost(generated.id)
      }

      if (generatingId) finishComposerGeneration(recoveryKey, generatingId)
      adoptPost(generated); setSaveState('SAVED')
      const usedFallback = generated.variants.some((variant) => variant.metadata.generation_status === 'FALLBACK')
      setNotice(imageWarning ? 'The drafts are ready, but one or more images need attention.' : usedFallback ? 'Drafts were created, but one or more used the safe fallback because AI output could not be validated.' : 'Created ' + generated.variants.length + ' platform-specific ' + (generated.variants.length === 1 ? 'draft' : 'drafts') + '.')


    } catch (generateError) {

      const message = customerSafeMessage(generateError instanceof Error ? generateError.message : undefined, 'Could not generate the post.')

      if (generatingId) finishComposerGeneration(recoveryKey, generatingId, message)

      setError(message)

    } finally { setBusy('') }

  }



  const loadDraft = async (id: string) => {

    setDraftId(id)

    if (!id) return

    setBusy('draft'); setError('')

    try {

      if (isDemo) return

      const loaded = await socialComposerApi.getPost(id)

      adoptPost(loaded); setSaveState('SAVED'); openedDraft.current = id; rememberComposerDraft(recoveryKey, id)

    } catch (draftError) { setError(customerSafeMessage(draftError instanceof Error ? draftError.message : undefined, 'Could not open that draft.')) }

    finally { setBusy('') }

  }



  const changeStartMode = (value: StartMode) => {

    if (value === mode && !(value === 'idea' && post)) return

    setMode(value)

    setDraftId('')

    if (value === 'idea') setSourceIds([])

    if (post) {

      clearComposerRecovery(recoveryKey)

      adoptPost(null)

      setIdeaTitle('')

      setIdeaText('')

      setSourceIds([])

      setSaveState('SAVED')

    }

  }

  const startNewPost = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    clearComposerRecovery(recoveryKey)
    openedDraft.current = ''
    editRevision.current = 0
    setDirtyTick(0)
    adoptPost(null)
    setMode('idea')
    setIdeaTitle('')
    setIdeaText('')
    setSourceIds([])
    setDraftId('')
    setControls(defaultControls)
    setCreativeBrief(defaultCreativeBrief)
    const firstNetwork = options?.connections[0]?.network
    setNetworks(firstNetwork ? [firstNetwork] : [])
    setActiveNetwork(firstNetwork ?? 'LINKEDIN')
    setSaveState('SAVED')
    setBusy('')
    setError('')
    setNotice('Ready for a new post.')
    navigate('/content/create?new=1', { replace: true })
  }



  const updateVariant = (changes: Partial<Pick<SocialVariant, 'copy' | 'hashtags'>>) => {

    if (!post) return

    const next = { ...post, variants: post.variants.map((variant) => variant.network === activeNetwork ? { ...variant, ...changes } : variant) }

    livePost.current = next; setPost(next); markUnsaved(); onPostChange?.(next)

  }



  const reload = async () => {

    if (!post || isDemo) return

    adoptPost(await socialComposerApi.getPost(post.id)); setSaveState('SAVED')

  }



  const rewrite = async (action: RewriteAction, alternativeIndex?: number) => {

    const variant = post?.variants.find((item) => item.network === activeNetwork)

    if (!variant) return

    setBusy('rewrite'); setError('')

    try {

      if (isDemo) {

        const copy = action === 'MAKE_SHORTER' ? variant.copy.slice(0, Math.max(80, variant.copy.length / 2)) : action === 'NEW_HOOK' ? `What if there is a simpler way?\n\n${variant.copy}` : variant.copy

        updateVariant({ copy }); setSaveState('SAVED')

      } else adoptPost(await socialComposerApi.rewrite(variant.id, action, alternativeIndex))

    } catch (rewriteError) { setError(customerSafeMessage(rewriteError instanceof Error ? rewriteError.message : undefined, 'Could not update this version.')) }

    finally { setBusy('') }

  }



  const mediaAction = async (action: () => Promise<unknown>) => {

    setBusy('media'); setError('')

    try { await action(); await reload() }

    catch (mediaError) { setError(customerSafeMessage(mediaError instanceof Error ? mediaError.message : undefined, 'Could not update the media.')) }

    finally { setBusy('') }

  }



  const submit = async () => {

    if (!post) return

    if (saveState === 'UNSAVED' && !(await persist())) return

    setBusy('submit'); setError(''); setNotice('')

    try {

      if (isDemo) { setNotice('Demo draft is ready for review.'); return }

      const submitted = await socialComposerApi.submitForReview(post.id)

      adoptPost(submitted); setNotice('Sent for approval.')
      showToast({
        tone: 'success',
        title: 'Post sent for approval',
        message: 'It is now waiting in Approvals for a reviewer.',
        duration: 7000,
        dedupeKey: `composer-approval-${post.id}`,
      })

    } catch (submitError) {

      if (!isDemo) { try { await reload() } catch { /* Keep the useful validation response. */ } }

      const message = customerSafeMessage(submitError instanceof Error ? submitError.message : undefined, 'Fix the highlighted fields before sending for approval.')
      setError(message)
      showToast({
        tone: 'error',
        title: 'Could not send for approval',
        message,
        dedupeKey: `composer-approval-error-${post.id}`,
      })

    } finally { setBusy('') }

  }

  const schedule = async () => {
    if (!post) return
    if (saveState === 'UNSAVED' && !(await persist())) return
    setBusy('schedule'); setError(''); setNotice('')
    try {
      if (isDemo) { setNotice('Demo post added to the schedule.'); return }
      const scheduled = await socialComposerApi.schedule(post.id)
      adoptPost(scheduled); setNotice('Post scheduled for publishing.')
    } catch (scheduleError) {
      if (!isDemo) { try { await reload() } catch { /* Keep the useful validation response. */ } }
      setError(customerSafeMessage(scheduleError instanceof Error ? scheduleError.message : undefined, 'Fix the highlighted fields before scheduling.'))
    } finally { setBusy('') }
  }



  const activeVariant = useMemo(() => post?.variants.find((variant) => variant.network === activeNetwork) ?? post?.variants[0], [activeNetwork, post])

  const hasDirection = mode === 'manual' || Boolean(ideaText.trim() || sourceIds.length)
  const hasChannels = networks.length > 0
  const generationReady = hasDirection && hasChannels
  const generationCost = controls.include_image ? 3 : 2

  if (!options) return <div className="li-loading" role={error ? 'alert' : 'status'}>{error || 'Loading the post creator…'}</div>



  return <div className="social-composer">

    {(error || notice) && <div className={`li-banner ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error ? <TriangleAlert size={17} /> : <Check size={17} />}<span>{error || notice}</span></div>}

    <header className="composer-create-header">
      <div>
        <span>CREATE</span>
        <h1>Create a social post</h1>
        <p>Start with one idea. Quilltap will apply your brand and adapt it for every selected platform.</p>
      </div>
      <div className="composer-header-actions">
        <button className="composer-new-post" type="button" disabled={Boolean(busy)} onClick={startNewPost}><Plus size={16} /> New post</button>
        <Link className="composer-series-cta" to="/content/series" aria-label="Create a series automatically"><FileText size={16} /> Create a post series</Link>
      </div>
    </header>

    <div className="composer-progress" aria-label="Post creation progress">
      <span className="active"><b>1</b> Add your content</span>
      <span className={post ? 'active' : ''}><b>2</b> Review drafts</span>
      <span className={post ? 'active' : ''}><b>3</b> Schedule or approve</span>
    </div>

    <div className="composer-workspace">

      <section className="card composer-setup" aria-labelledby="composer-start-title">

        <div className="composer-section-heading">
          <span className="composer-step-number">1</span>
          <div><h2 id="composer-start-title">Start with what you have</h2><p>Choose the starting point that best matches your task.</p></div>
        </div>

        <div className="composer-brand-context"><Palette size={17} /><span><strong>Your brand settings are applied automatically</strong><small>Voice, audience, calls to action, and visual direction come from Brand &amp; Publishing.</small></span><Link to="/content/library?panel=brand">Review</Link></div>

        <div className="composer-start-tabs" role="tablist" aria-label="Starting point">{startModes.map(({ value, label, description, icon: Icon }) => <button className="composer-mode-tab" type="button" role="tab" aria-label={label} aria-selected={mode === value} key={value} onClick={() => changeStartMode(value)}><Icon size={18} /><span><strong>{label}</strong><small>{description}</small></span>{mode === value && <Check className="composer-mode-check" size={15} />}</button>)}</div>

        <div className="composer-form-section">
          <div className="composer-section-heading compact"><span className="composer-step-number">2</span><div><h3>{mode === 'draft' ? 'Choose your draft' : mode === 'source' ? 'Choose a source and angle' : mode === 'manual' ? 'Name your post' : 'Describe the post'}</h3><p>{mode === 'idea' ? 'A few clear notes are enough—the AI will structure the post.' : mode === 'source' ? 'Select trusted material, then tell the AI what angle to take.' : mode === 'manual' ? 'Add a working title so you can find this post later.' : 'Pick up exactly where you left off.'}</p></div></div>

        {mode === 'draft' ? <label className="li-field"><span>Choose a draft</span><select value={draftId} onChange={(event) => void loadDraft(event.target.value)}><option value="">Select a draft</option>{options.drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.idea_title}</option>)}</select></label> : <>

          {mode === 'source' && <fieldset className="composer-source-picker"><legend>Sources to use</legend><p className="composer-source-help">Saved sources provide approved facts and language for generated posts. Your prompt still decides the angle.</p>{options.sources.length === 0 && <p className="composer-source-help">No sources saved yet. <a href="/content/library?panel=sources">Add a source</a>, or choose New idea to write from a prompt.</p>}{options.sources.map((source) => <label key={source.id}><input type="checkbox" checked={sourceIds.includes(source.id)} disabled={source.processing_status !== 'READY'} onChange={(event) => { const next = event.target.checked ? [...sourceIds, source.id] : sourceIds.filter((id) => id !== source.id); setSourceIds(next); if (event.target.checked && !ideaTitle) setIdeaTitle(source.label); markUnsaved() }} /><span><strong>{source.label}</strong><small>{source.processing_status === 'READY' ? `${source.source_type.replaceAll('_', ' ').toLowerCase()} · ready` : `${source.source_type.replaceAll('_', ' ').toLowerCase()} · still processing`}</small></span></label>)}</fieldset>}

          {mode === 'idea' && !post && !ideaTitle.trim() && !ideaText.trim() && <div className="composer-idea-starters"><span className="idea-starters-heading"><Sparkles size={14} /> Need inspiration?</span><p>Choose a starting point, then make the idea your own.</p><div className="idea-starters-grid">{ideaStarters.map((starter) => <button type="button" key={starter.label} onClick={() => { setIdeaTitle(starter.title); setIdeaText(starter.idea); markUnsaved() }}>{starter.label}</button>)}</div></div>}

          <label className="li-field"><span>Working title <small>Only your team will see this</small></span><input aria-label="Working title" value={ideaTitle} placeholder="For example: A simpler onboarding process" onChange={(event) => { setIdeaTitle(event.target.value); markUnsaved() }} /></label>

          {mode !== 'manual' && <label className="li-field"><span>{mode === 'source' ? 'What should the post focus on?' : 'What do you want to say?'} <small>{mode === 'source' ? 'Optional' : 'Required'}</small></span><textarea aria-label={mode === 'source' ? 'Extra direction' : 'What is the idea?'} value={ideaText} placeholder={mode === 'source' ? 'For example: Focus on how route optimization reduces planning time for small delivery teams.' : 'Share the point, key message, rough notes, or paste text here. A few sentences are enough.'} onChange={(event) => { setIdeaText(event.target.value); markUnsaved() }} /></label>}

        </>}
        </div>

        <div className="composer-form-section composer-channel-section">
          <div className="composer-section-heading compact"><span className="composer-step-number">3</span><div><h3>Choose where to publish</h3><p>Each selected account receives a version tailored to that platform.</p></div></div>
          <PlatformSelector connections={options.connections} selected={networks} selectedConnections={selectedConnections} onChange={(next) => { setNetworks(next); markUnsaved() }} onConnectionChange={(network, connectionId) => { setSelectedConnections((current) => ({ ...current, [network]: connectionId })); markUnsaved() }} />
        </div>

        {mode !== 'manual' && <details className="composer-customize"><summary><span><strong>Customize this post</strong><small>Optional · objective, tone, image, audience, and CTA</small></span><span aria-hidden="true">+</span></summary><div className="composer-customize-body"><fieldset className="generation-controls"><legend>What should this post do?</legend><label>Objective<select value={controls.goal} onChange={(event) => { const goal = event.target.value as GenerationControls['goal']; const recommended = goal === 'Education' ? { tone: 'Educational' as const, length: 'Medium' as const } : goal === 'Engagement' ? { tone: 'Friendly' as const, length: 'Short' as const } : goal === 'Leads' ? { tone: 'Bold' as const, length: 'Medium' as const } : { tone: 'Professional' as const, length: 'Short' as const }; setControls({ ...controls, goal, ...recommended }); markUnsaved() }}><option value="Awareness">Share an update</option><option value="Education">Teach something</option><option value="Engagement">Start a conversation</option><option value="Leads">Promote an offer</option></select></label><label>Tone<select value={controls.tone} onChange={(event) => { setControls({ ...controls, tone: event.target.value as GenerationControls['tone'] }); markUnsaved() }}>{options.generation_controls.tones.map((value) => <option key={value}>{value}</option>)}</select></label><label>Length<select value={controls.length} onChange={(event) => { setControls({ ...controls, length: event.target.value as GenerationControls['length'] }); markUnsaved() }}>{options.generation_controls.lengths.map((value) => <option key={value}>{value}</option>)}</select></label></fieldset><label className={`composer-image-toggle-card ${controls.include_image ? 'active' : ''}`}><input type="checkbox" checked={controls.include_image} onChange={(event) => { setControls({ ...controls, include_image: event.target.checked }); markUnsaved() }} /><ImageIcon size={16} className="composer-image-icon" /><span className="composer-image-label">Include an AI-generated image</span>{networks.includes('INSTAGRAM') && <span className="composer-image-notice">Recommended for Instagram</span>}</label><div className="composer-brief-grid"><label className="li-field"><span>Specific audience</span><input value={creativeBrief.target_audience} placeholder="For example: first-time customers" onChange={(event) => { setCreativeBrief({ ...creativeBrief, target_audience: event.target.value }); markUnsaved() }} /></label><label className="li-field"><span>Call to action</span><input value={creativeBrief.call_to_action} placeholder="For example: Book a demo" onChange={(event) => { setCreativeBrief({ ...creativeBrief, call_to_action: event.target.value }); markUnsaved() }} /></label><label className="li-field"><span>Must include <small>one per line</small></span><textarea className="short" value={creativeBrief.must_include.join('\n')} placeholder="Facts, offer details, or required wording" onChange={(event) => { setCreativeBrief({ ...creativeBrief, must_include: splitRequirements(event.target.value) }); markUnsaved() }} /></label><label className="li-field"><span>Avoid <small>one per line</small></span><textarea className="short" value={creativeBrief.must_avoid.join('\n')} placeholder="Claims, phrases, or subjects to avoid" onChange={(event) => { setCreativeBrief({ ...creativeBrief, must_avoid: splitRequirements(event.target.value) }); markUnsaved() }} /></label><label className="li-field full"><span>Image direction</span><textarea className="short" value={creativeBrief.image_requirements} placeholder="Only add details that differ from your saved visual direction" onChange={(event) => { setCreativeBrief({ ...creativeBrief, image_requirements: event.target.value }); markUnsaved() }} /></label></div><label className="creative-brief-check"><input type="checkbox" checked={creativeBrief.reserve_logo_space} onChange={(event) => { setCreativeBrief({ ...creativeBrief, reserve_logo_space: event.target.checked }); markUnsaved() }} /><span>Leave clean space where I can add my logo</span></label></div></details>}

      </section>



      <section className="composer-editing" aria-labelledby="platform-drafts-title">

        <div className="composer-review-head"><div><span>PLATFORM DRAFTS</span><h2 id="platform-drafts-title">Review each version</h2></div><span className={`save-indicator ${saveState.toLowerCase()}`}>{saveState === 'SAVING' ? 'Saving…' : saveState === 'UNSAVED' ? 'Unsaved' : 'Saved'}</span></div>

        {busy === 'generate' && !post?.variants.some((variant) => variant.copy.trim()) ? <div className="li-empty composer-draft-empty" role="status"><LoaderCircle className="spin" size={30} /><strong>Creating your platform drafts</strong><p>{post ? 'Your draft is saved. You can leave and come back while generation continues.' : 'Saving your idea before generation starts…'}</p></div> : post?.variants.length ? <><div className="platform-tabs" role="tablist" aria-label="Platform drafts">{post.variants.map((variant) => <button role="tab" aria-selected={activeVariant?.network === variant.network} type="button" key={variant.id} onClick={() => setActiveNetwork(variant.network)}>{variant.network_label}{!variant.validation.valid && <span aria-label="Needs attention">!</span>}</button>)}</div>{activeVariant && <div className="variant-workspace"><div><VariantEditor variant={activeVariant} busy={Boolean(busy)} onChange={updateVariant} onRewrite={(action, alternativeIndex) => void rewrite(action, alternativeIndex)} /><MediaManager variant={activeVariant} busy={Boolean(busy)} onUpload={(file) => void mediaAction(() => socialComposerApi.uploadMedia(activeVariant.id, file))} onRemove={(id) => void mediaAction(() => socialComposerApi.deleteMedia(activeVariant.id, id))} onReorder={(ids) => void mediaAction(() => socialComposerApi.reorderMedia(activeVariant.id, ids))} onAltText={(id, value) => void mediaAction(() => socialComposerApi.updateAltText(activeVariant.id, id, value))} onRegenerate={(id) => void mediaAction(() => socialComposerApi.regenerateImage(activeVariant.id, activeVariant.metadata.image_prompt || ideaTitle, id, activeVariant.metadata.alt_text || ''))} /></div><PlatformPreview variant={activeVariant} /></div>}</> : <div className="li-empty composer-draft-empty">{mode === 'manual' ? <PenLine size={32} /> : <Sparkles size={32} />}<strong>Your platform drafts will appear here</strong><p>{mode === 'manual' ? 'Select an account and start writing. You can add media and preview the finished post here.' : 'Complete the essentials on the left, then generate a tailored draft for each selected account.'}</p><ul className="composer-ready-list"><li className={hasDirection ? 'done' : ''}><span>{hasDirection ? <Check size={14} /> : '1'}</span>{mode === 'source' ? 'Choose a source or add direction' : mode === 'manual' ? 'Choose manual writing' : 'Describe what you want to say'}</li><li className={hasChannels ? 'done' : ''}><span>{hasChannels ? <Check size={14} /> : '2'}</span>Select at least one social account</li><li><span>3</span>{mode === 'manual' ? 'Start writing your post' : 'Generate your platform drafts'}</li></ul></div>}

      </section>

    </div>

    <div className="composer-action-bar" aria-label="Composer actions">
      <div className="composer-action-status"><span className={`save-indicator ${saveState.toLowerCase()}`}>{saveState === 'SAVING' ? 'Saving changes…' : saveState === 'UNSAVED' ? 'Unsaved changes' : post ? 'All changes saved' : generationReady ? 'Ready to create' : 'Finish the essentials above'}</span><small>{!hasChannels ? 'Select at least one social account.' : !hasDirection ? 'Add an idea or select a saved source.' : mode === 'manual' ? 'Start writing, then preview and publish.' : `Generation will use ${generationCost} credits.`}</small></div>
      <button className="li-quiet-button" type="button" disabled={Boolean(busy) || saveState === 'SAVING' || !networks.length} aria-busy={saveState === 'SAVING'} onClick={() => void persist()}>
        {saveState === 'SAVING' ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} {mode === 'manual' && !post ? 'Start writing' : 'Save draft'}
      </button>
      {mode !== 'manual' && (
        <div className="composer-generate-action">
          <button className="button button-dark" type="button" aria-label={post ? 'Regenerate' : 'Generate'} disabled={Boolean(busy) || !generationReady} aria-busy={busy === 'generate'} onClick={() => void generate()}>
            {busy === 'generate' ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
            {busy === 'generate' ? ' Generating…' : post ? ' Regenerate' : ' Generate drafts'}
          </button>
        </div>
      )}
      {post && <button className="button button-dark" type="button" disabled={Boolean(busy) || saveState === 'SAVING'} aria-busy={busy === 'schedule'} onClick={() => void schedule()}>
        {busy === 'schedule' ? <LoaderCircle className="spin" size={16} /> : <CalendarClock size={16} />} Schedule post
      </button>}
      {post && <button className="li-quiet-button" type="button" disabled={Boolean(busy) || saveState === 'SAVING'} aria-busy={busy === 'submit'} onClick={() => void submit()}>
        {busy === 'submit' ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} Send for approval
      </button>}
    </div>

  </div>

}

