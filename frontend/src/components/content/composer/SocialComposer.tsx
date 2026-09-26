import { CalendarClock, Check, Image as ImageIcon, LoaderCircle, Save, Send, Sparkles, TriangleAlert } from 'lucide-react'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Link, useSearchParams } from 'react-router-dom'

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



interface Props { onPostChange?: (post: SocialPost | null) => void }



export function SocialComposer({ onPostChange }: Props) {

  const { isDemo, startTrackingGeneration } = useContentStudio()

  const auth = useOptionalAuth()

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

    } catch (submitError) {

      if (!isDemo) { try { await reload() } catch { /* Keep the useful validation response. */ } }

      setError(customerSafeMessage(submitError instanceof Error ? submitError.message : undefined, 'Fix the highlighted fields before sending for approval.'))

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

  if (!options) return <div className="li-loading" role={error ? 'alert' : 'status'}>{error || 'Loading the post creator…'}</div>



  return <div className="social-composer">

    {(error || notice) && <div className={`li-banner ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error ? <TriangleAlert size={17} /> : <Check size={17} />}<span>{error || notice}</span></div>}

    <div className="composer-workspace">

      <section className="card composer-setup" aria-labelledby="composer-start-title">

        <div className="li-section-heading"><span>CREATE</span><h2 id="composer-start-title">Start with what you have</h2><p>Visiofy Studio will shape a different draft for every selected network.</p></div>

        <div className="composer-start-tabs" role="tablist" aria-label="Starting point">{([['manual', 'Write manually'], ['idea', 'Generate with AI'], ['source', 'Saved source'], ['draft', 'Existing draft']] as [StartMode, string][]).map(([value, label]) => <button type="button" role="tab" aria-selected={mode === value} key={value} onClick={() => changeStartMode(value)}>{label}</button>)}</div>
        <p className="composer-series-link">Need several posts? <Link to="/content/series">Create a series automatically from one brief</Link></p>

        {mode === 'draft' ? <label className="li-field"><span>Choose a draft</span><select value={draftId} onChange={(event) => void loadDraft(event.target.value)}><option value="">Select a draft</option>{options.drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.idea_title}</option>)}</select></label> : <>

          {mode === 'source' && <fieldset className="composer-source-picker"><legend>Sources to use</legend><p className="composer-source-help">Saved sources provide approved facts and language for generated posts. Your prompt still decides the angle.</p>{options.sources.length === 0 && <p className="composer-source-help">No sources saved yet. <a href="/content/library?panel=sources">Add a source</a>, or choose New idea to write from a prompt.</p>}{options.sources.map((source) => <label key={source.id}><input type="checkbox" checked={sourceIds.includes(source.id)} disabled={source.processing_status !== 'READY'} onChange={(event) => { const next = event.target.checked ? [...sourceIds, source.id] : sourceIds.filter((id) => id !== source.id); setSourceIds(next); if (event.target.checked && !ideaTitle) setIdeaTitle(source.label); markUnsaved() }} /><span><strong>{source.label}</strong><small>{source.processing_status === 'READY' ? `${source.source_type.replaceAll('_', ' ').toLowerCase()} · ready` : `${source.source_type.replaceAll('_', ' ').toLowerCase()} · still processing`}</small></span></label>)}</fieldset>}

          {mode === 'idea' && !post && !ideaTitle.trim() && !ideaText.trim() && <div className="composer-idea-starters"><span>Start a post faster</span><p>Choose a direction, then add your own details before generating.</p><div>{ideaStarters.map((starter) => <button type="button" key={starter.label} onClick={() => { setIdeaTitle(starter.title); setIdeaText(starter.idea); markUnsaved() }}>{starter.label}</button>)}</div></div>}

          <label className="li-field"><span>Working title</span><input value={ideaTitle} placeholder="For example: A simpler onboarding process" onChange={(event) => { setIdeaTitle(event.target.value); markUnsaved() }} /></label>

          {mode !== 'manual' && <label className="li-field"><span>{mode === 'source' ? 'Extra direction' : 'What is the idea?'}</span><textarea value={ideaText} placeholder="Share the point, rough notes, or message you want the post to convey…" onChange={(event) => { setIdeaText(event.target.value); markUnsaved() }} /></label>}

        </>}

        <PlatformSelector connections={options.connections} selected={networks} selectedConnections={selectedConnections} onChange={(next) => { setNetworks(next); markUnsaved() }} onConnectionChange={(network, connectionId) => { setSelectedConnections((current) => ({ ...current, [network]: connectionId })); markUnsaved() }} />

        {mode !== 'manual' && (
          <label
            className={`composer-image-toggle-card ${controls.include_image ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}
          >
            <input
              type="checkbox"
              checked={controls.include_image}
              onChange={(event) => {
                setControls({ ...controls, include_image: event.target.checked })
                markUnsaved()
              }}
            />
            <ImageIcon size={14} className="composer-image-icon" />
            <span className="composer-image-label">Include AI image with post</span>
            {networks.includes('INSTAGRAM') && (
              <span className="composer-image-notice">Auto on Instagram</span>
            )}
          </label>
        )}

        {mode !== 'manual' && <fieldset className="generation-controls"><legend>What should this post do?</legend><label>Objective<select value={controls.goal} onChange={(event) => { const goal = event.target.value as GenerationControls['goal']; const recommended = goal === 'Education' ? { tone: 'Educational' as const, length: 'Medium' as const } : goal === 'Engagement' ? { tone: 'Friendly' as const, length: 'Short' as const } : goal === 'Leads' ? { tone: 'Bold' as const, length: 'Medium' as const } : { tone: 'Professional' as const, length: 'Short' as const }; setControls({ ...controls, goal, ...recommended }); markUnsaved() }}><option value="Awareness">Share an update</option><option value="Education">Teach something</option><option value="Engagement">Start a conversation</option><option value="Leads">Promote an offer</option></select></label><details className="generation-more"><summary>More writing controls</summary><label>Tone<select value={controls.tone} onChange={(event) => { setControls({ ...controls, tone: event.target.value as GenerationControls['tone'] }); markUnsaved() }}>{options.generation_controls.tones.map((value) => <option key={value}>{value}</option>)}</select></label><label>Length<select value={controls.length} onChange={(event) => { setControls({ ...controls, length: event.target.value as GenerationControls['length'] }); markUnsaved() }}>{options.generation_controls.lengths.map((value) => <option key={value}>{value}</option>)}</select></label></details><p className="generation-cost-note">One writing request creates all selected platform drafts. Images and extra options run only when you choose them.</p></fieldset>}

        {mode !== 'manual' && <details className="composer-creative-brief"><summary>Add details for better results <small>optional</small></summary><p>Your saved business profile supplies the defaults. Open this only when this post needs something specific.</p><label className="li-field"><span>Who is this post for?</span><input value={creativeBrief.target_audience} placeholder="For example: first-time customers" onChange={(event) => { setCreativeBrief({ ...creativeBrief, target_audience: event.target.value }); markUnsaved() }} /></label><label className="li-field"><span>What should people do next?</span><input value={creativeBrief.call_to_action} placeholder="For example: Book a demo" onChange={(event) => { setCreativeBrief({ ...creativeBrief, call_to_action: event.target.value }); markUnsaved() }} /></label><label className="li-field"><span>Important details <small>one per line</small></span><textarea className="short" value={creativeBrief.must_include.join('\n')} placeholder="Facts, offer details, or wording that must appear" onChange={(event) => { setCreativeBrief({ ...creativeBrief, must_include: splitRequirements(event.target.value) }); markUnsaved() }} /></label><label className="li-field"><span>Anything to avoid? <small>one per line</small></span><textarea className="short" value={creativeBrief.must_avoid.join('\n')} placeholder="Claims, phrases, subjects, or visual elements" onChange={(event) => { setCreativeBrief({ ...creativeBrief, must_avoid: splitRequirements(event.target.value) }); markUnsaved() }} /></label><label className="li-field"><span>How should the image look?</span><textarea className="short" value={creativeBrief.image_requirements} placeholder="For example: a real product photo on a clean desk, warm natural light" onChange={(event) => { setCreativeBrief({ ...creativeBrief, image_requirements: event.target.value }); markUnsaved() }} /></label><label className="creative-brief-check"><input type="checkbox" checked={creativeBrief.reserve_logo_space} onChange={(event) => { setCreativeBrief({ ...creativeBrief, reserve_logo_space: event.target.checked }); markUnsaved() }} /><span>Leave clean space where I can add my logo</span></label></details>}

      </section>



      <section className="composer-editing" aria-labelledby="platform-drafts-title">

        <div className="composer-review-head"><div><span>PLATFORM DRAFTS</span><h2 id="platform-drafts-title">Review each version</h2></div><span className={`save-indicator ${saveState.toLowerCase()}`}>{saveState === 'SAVING' ? 'Saving…' : saveState === 'UNSAVED' ? 'Unsaved' : 'Saved'}</span></div>

        {busy === 'generate' && !post?.variants.some((variant) => variant.copy.trim()) ? <div className="li-empty" role="status"><LoaderCircle className="spin" size={30} /><strong>Creating your platform drafts</strong><p>{post ? 'Your draft is saved. You can leave and come back while generation continues.' : 'Saving your idea before generation starts…'}</p></div> : post?.variants.length ? <><div className="platform-tabs" role="tablist" aria-label="Platform drafts">{post.variants.map((variant) => <button role="tab" aria-selected={activeVariant?.network === variant.network} type="button" key={variant.id} onClick={() => setActiveNetwork(variant.network)}>{variant.network_label}{!variant.validation.valid && <span aria-label="Needs attention">!</span>}</button>)}</div>{activeVariant && <div className="variant-workspace"><div><VariantEditor variant={activeVariant} busy={Boolean(busy)} onChange={updateVariant} onRewrite={(action, alternativeIndex) => void rewrite(action, alternativeIndex)} /><MediaManager variant={activeVariant} busy={Boolean(busy)} onUpload={(file) => void mediaAction(() => socialComposerApi.uploadMedia(activeVariant.id, file))} onRemove={(id) => void mediaAction(() => socialComposerApi.deleteMedia(activeVariant.id, id))} onReorder={(ids) => void mediaAction(() => socialComposerApi.reorderMedia(activeVariant.id, ids))} onAltText={(id, value) => void mediaAction(() => socialComposerApi.updateAltText(activeVariant.id, id, value))} onRegenerate={(id) => void mediaAction(() => socialComposerApi.regenerateImage(activeVariant.id, activeVariant.metadata.image_prompt || ideaTitle, id, activeVariant.metadata.alt_text || ''))} /></div><PlatformPreview variant={activeVariant} /></div>}</> : <div className="li-empty">{mode === 'manual' ? <Save size={30} /> : <Sparkles size={30} />}<strong>No platform drafts yet</strong><p>{mode === 'manual' ? 'Choose an account, then select Start writing.' : 'Choose where to post, add an idea or source, then select Generate.'}</p></div>}

      </section>

    </div>

    <div className="composer-action-bar" aria-label="Composer actions">
      <span className={`save-indicator ${saveState.toLowerCase()}`}>
        {saveState === 'SAVING' ? 'Saving changes…' : saveState === 'UNSAVED' ? 'Unsaved changes' : post ? 'All changes saved' : 'Ready to start'}
      </span>
      <button className="li-quiet-button" type="button" disabled={Boolean(busy) || saveState === 'SAVING' || !networks.length} aria-busy={saveState === 'SAVING'} onClick={() => void persist()}>
        {saveState === 'SAVING' ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} {mode === 'manual' && !post ? 'Start writing' : 'Save draft'}
      </button>
      {mode !== 'manual' && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <button className="button button-dark" type="button" disabled={Boolean(busy) || !networks.length || (!ideaText.trim() && !sourceIds.length)} aria-busy={busy === 'generate'} onClick={() => void generate()}>
            {busy === 'generate' ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
            {busy === 'generate' ? ' Generating…' : ' Generate'}
          </button>
          <span style={{ fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }} title="AI credit cost for this generation">
            ⚡ {controls.include_image ? '3 credits' : '2 credits'}
          </span>
        </div>
      )}
      <button className="button button-dark" type="button" disabled={Boolean(busy) || saveState === 'SAVING' || !post} aria-busy={busy === 'schedule'} onClick={() => void schedule()}>
        {busy === 'schedule' ? <LoaderCircle className="spin" size={16} /> : <CalendarClock size={16} />} Schedule post
      </button>
      <button className="li-quiet-button" type="button" disabled={Boolean(busy) || saveState === 'SAVING' || !post} aria-busy={busy === 'submit'} onClick={() => void submit()}>
        {busy === 'submit' ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} Send for approval
      </button>
    </div>

  </div>

}

