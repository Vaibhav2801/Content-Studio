import { Check, LoaderCircle, Save, Send, Sparkles, TriangleAlert } from 'lucide-react'

import { useEffect, useMemo, useRef, useState } from 'react'

import { useSearchParams } from 'react-router-dom'

import { socialComposerApi } from '../../../api/socialComposer'

import { makeDemoPost, socialComposerMockOptions } from '../../../api/socialComposerMock'

import type { ComposerOptions, GenerationControls, RewriteAction, SocialNetwork, SocialPost, SocialVariant } from '../../../types/socialComposer'

import { useOptionalAuth } from '../AuthContext'

import { useContentStudio } from '../ContentStudioContext'

import { customerSafeMessage } from '../contentUtils'

import { clearComposerRecovery, composerRecoveryEvent, composerRecoveryKey, finishComposerGeneration, readComposerDraft, readComposerForm, rememberComposerDraft, saveComposerForm } from './composerRecovery'

import { MediaManager } from './MediaManager'

import { PlatformPreview } from './PlatformPreview'

import { PlatformSelector } from './PlatformSelector'

import { VariantEditor } from './VariantEditor'



type StartMode = 'idea' | 'source' | 'draft'

const defaultControls: GenerationControls = { tone: 'Professional', goal: 'Awareness', length: 'Medium', include_image: false }



interface Props { onPostChange?: (post: SocialPost | null) => void }



export function SocialComposer({ onPostChange }: Props) {

  const { isDemo } = useContentStudio()

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

  const [controls, setControls] = useState<GenerationControls>({ ...defaultControls, ...restoredForm?.controls })

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

    saveComposerForm(recoveryKey, { mode, ideaTitle, ideaText, sourceIds, networks, controls, activeNetwork })

  }, [recoveryKey, mode, ideaTitle, ideaText, sourceIds, networks, controls, activeNetwork])



  const markUnsaved = () => {

    if (!livePost.current) return

    editRevision.current += 1

    setDirtyTick(editRevision.current)

    setSaveState('UNSAVED')

  }



  const adoptPost = (value: SocialPost | null) => {

    livePost.current = value

    setPost(value)

    onPostChange?.(value)

    if (value) {

      setIdeaTitle(value.idea_title)

      setIdeaText(value.idea_text)

      setSourceIds(value.sources?.map((source) => source.id) ?? (value.source ? [value.source.id] : []))

      setControls({ ...defaultControls, ...value.controls })

      const postNetworks = value.variants.map((variant) => variant.network)

      setNetworks(postNetworks)

      if (!postNetworks.includes(activeNetwork)) setActiveNetwork(postNetworks[0] ?? 'LINKEDIN')

    }

  }



  useEffect(() => {

    let active = true

    const load = async () => {

      try {

        const loaded = isDemo ? structuredClone(socialComposerMockOptions) : await socialComposerApi.options()

        if (!active) return

        setOptions(loaded)

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

      if (recovery.generating && recovery.startedAt && Date.now() - recovery.startedAt > 10 * 60 * 1000 && !current.variants.some((variant) => variant.copy.trim())) {

        const message = 'Generation did not finish. Your idea is saved; select Generate to try again.'

        finishComposerGeneration(recoveryKey, id, message)

        setBusy('')

        setError(message)

        adoptPost(current)

        return

      }

      adoptPost(current)

      if (!recovery.generating || current.variants.some((variant) => variant.copy.trim())) {

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



  const payload = () => ({ idea_title: ideaTitle.trim() || 'Untitled idea', idea_text: ideaText.trim(), source_ids: sourceIds, networks, controls })



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

        setNotice('Generating your post… You can leave this page and return to it.')

      }

      let generated = isDemo ? makeDemoPost(ideaTitle || 'New post', ideaText || options?.sources.filter((item) => sourceIds.includes(item.id)).map((item) => item.text_content).join(' ') || '', networks) : await socialComposerApi.generate({ ...payload(), post_id: generatingId })

      let imageWarning = false

      if (controls.include_image && !isDemo) {

        const imageResults = await Promise.allSettled(generated.variants.filter((variant) => !variant.media.length).map((variant) => socialComposerApi.regenerateImage(variant.id, variant.metadata.image_prompt || ideaTitle)))

        imageWarning = imageResults.some((result) => result.status === 'rejected')

        generated = await socialComposerApi.getPost(generated.id)

      }

      if (generatingId) finishComposerGeneration(recoveryKey, generatingId)

      adoptPost(generated); setSaveState('SAVED')

      setNotice(imageWarning ? 'The drafts are ready, but one or more images need attention.' : 'Created ' + generated.variants.length + ' platform-specific ' + (generated.variants.length === 1 ? 'draft' : 'drafts') + '.')

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



  const rewrite = async (action: RewriteAction) => {

    const variant = post?.variants.find((item) => item.network === activeNetwork)

    if (!variant) return

    setBusy('rewrite'); setError('')

    try {

      if (isDemo) {

        const copy = action === 'MAKE_SHORTER' ? variant.copy.slice(0, Math.max(80, variant.copy.length / 2)) : action === 'NEW_HOOK' ? `What if there is a simpler way?\n\n${variant.copy}` : variant.copy

        updateVariant({ copy }); setSaveState('SAVED')

      } else adoptPost(await socialComposerApi.rewrite(variant.id, action))

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



  const activeVariant = useMemo(() => post?.variants.find((variant) => variant.network === activeNetwork) ?? post?.variants[0], [activeNetwork, post])

  if (!options) return <div className="li-loading" role={error ? 'alert' : 'status'}>{error || 'Loading the post creator…'}</div>



  return <div className="social-composer">

    {(error || notice) && <div className={`li-banner ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error ? <TriangleAlert size={17} /> : <Check size={17} />}<span>{error || notice}</span></div>}

    <div className="composer-workspace">

      <section className="card composer-setup" aria-labelledby="composer-start-title">

        <div className="li-section-heading"><span>CREATE</span><h2 id="composer-start-title">Start with what you have</h2><p>Content Studio will shape a different draft for every selected network.</p></div>

        <div className="composer-start-tabs" role="tablist" aria-label="Starting point">{([['idea', 'New idea'], ['source', 'Saved source'], ['draft', 'Existing draft']] as [StartMode, string][]).map(([value, label]) => <button type="button" role="tab" aria-selected={mode === value} key={value} onClick={() => changeStartMode(value)}>{label}</button>)}</div>

        {mode === 'draft' ? <label className="li-field"><span>Choose a draft</span><select value={draftId} onChange={(event) => void loadDraft(event.target.value)}><option value="">Select a draft</option>{options.drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.idea_title}</option>)}</select></label> : <>

          {mode === 'source' && <fieldset className="composer-source-picker"><legend>Sources to use</legend><p className="composer-source-help">Saved sources provide approved facts and language for generated posts. Your prompt still decides the angle.</p>{options.sources.length === 0 && <p className="composer-source-help">No sources saved yet. <a href="/content/library?panel=sources">Add a source</a>, or choose New idea to write from a prompt.</p>}{options.sources.map((source) => <label key={source.id}><input type="checkbox" checked={sourceIds.includes(source.id)} disabled={source.processing_status !== 'READY'} onChange={(event) => { const next = event.target.checked ? [...sourceIds, source.id] : sourceIds.filter((id) => id !== source.id); setSourceIds(next); if (event.target.checked && !ideaTitle) setIdeaTitle(source.label); markUnsaved() }} /><span><strong>{source.label}</strong><small>{source.processing_status === 'READY' ? `${source.source_type.replaceAll('_', ' ').toLowerCase()} · ready` : `${source.source_type.replaceAll('_', ' ').toLowerCase()} · still processing`}</small></span></label>)}</fieldset>}

          <label className="li-field"><span>Working title</span><input value={ideaTitle} placeholder="For example: A simpler onboarding process" onChange={(event) => { setIdeaTitle(event.target.value); markUnsaved() }} /></label>

          <label className="li-field"><span>{mode === 'source' ? 'Extra direction' : 'What is the idea?'}</span><textarea value={ideaText} placeholder="Share the point, rough notes, or message you want the post to convey…" onChange={(event) => { setIdeaText(event.target.value); markUnsaved() }} /></label>

        </>}

        <PlatformSelector connections={options.connections} selected={networks} onChange={setNetworks} />

        <fieldset className="generation-controls"><legend>Shape the drafts</legend><label>Tone<select value={controls.tone} onChange={(event) => { setControls({ ...controls, tone: event.target.value as GenerationControls['tone'] }); markUnsaved() }}>{options.generation_controls.tones.map((value) => <option key={value}>{value}</option>)}</select></label><label>Goal<select value={controls.goal} onChange={(event) => { setControls({ ...controls, goal: event.target.value as GenerationControls['goal'] }); markUnsaved() }}>{options.generation_controls.goals.map((value) => <option key={value}>{value}</option>)}</select></label><label>Length<select value={controls.length} onChange={(event) => { setControls({ ...controls, length: event.target.value as GenerationControls['length'] }); markUnsaved() }}>{options.generation_controls.lengths.map((value) => <option key={value}>{value}</option>)}</select></label><label className="include-image"><input type="checkbox" checked={controls.include_image} onChange={(event) => { setControls({ ...controls, include_image: event.target.checked }); markUnsaved() }} /> Include image</label></fieldset>

      </section>



      <section className="composer-editing" aria-labelledby="platform-drafts-title">

        <div className="composer-review-head"><div><span>PLATFORM DRAFTS</span><h2 id="platform-drafts-title">Review each version</h2></div><span className={`save-indicator ${saveState.toLowerCase()}`}>{saveState === 'SAVING' ? 'Saving…' : saveState === 'UNSAVED' ? 'Unsaved' : 'Saved'}</span></div>

        {busy === 'generate' && !post?.variants.some((variant) => variant.copy.trim()) ? <div className="li-empty" role="status"><LoaderCircle className="spin" size={30} /><strong>Creating your platform drafts</strong><p>{post ? 'Your draft is saved. You can leave and come back while generation continues.' : 'Saving your idea before generation starts…'}</p></div> : post?.variants.length ? <><div className="platform-tabs" role="tablist" aria-label="Platform drafts">{post.variants.map((variant) => <button role="tab" aria-selected={activeVariant?.network === variant.network} type="button" key={variant.id} onClick={() => setActiveNetwork(variant.network)}>{variant.network_label}{!variant.validation.valid && <span aria-label="Needs attention">!</span>}</button>)}</div>{activeVariant && <div className="variant-workspace"><div><VariantEditor variant={activeVariant} busy={Boolean(busy)} onChange={updateVariant} onRewrite={(action) => void rewrite(action)} /><MediaManager variant={activeVariant} busy={Boolean(busy)} onUpload={(file) => void mediaAction(() => socialComposerApi.uploadMedia(activeVariant.id, file))} onRemove={(id) => void mediaAction(() => socialComposerApi.deleteMedia(activeVariant.id, id))} onReorder={(ids) => void mediaAction(() => socialComposerApi.reorderMedia(activeVariant.id, ids))} onAltText={(id, value) => void mediaAction(() => socialComposerApi.updateAltText(activeVariant.id, id, value))} onRegenerate={(id) => void mediaAction(() => socialComposerApi.regenerateImage(activeVariant.id, activeVariant.metadata.image_prompt || ideaTitle, id))} /></div><PlatformPreview variant={activeVariant} /></div>}</> : <div className="li-empty"><Sparkles size={30} /><strong>No platform drafts yet</strong><p>Choose where to post, add an idea or source, then select Generate.</p></div>}

      </section>

    </div>

    <div className="composer-action-bar" aria-label="Composer actions"><span className={`save-indicator ${saveState.toLowerCase()}`}>{saveState === 'SAVING' ? 'Saving changes…' : saveState === 'UNSAVED' ? 'Unsaved changes' : post ? 'All changes saved' : 'Ready to start'}</span><button className="li-quiet-button" type="button" disabled={Boolean(busy) || saveState === 'SAVING' || !networks.length} aria-busy={saveState === 'SAVING'} onClick={() => void persist()}>{saveState === 'SAVING' ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save draft</button><button className="button button-dark" type="button" disabled={Boolean(busy) || !networks.length || (!ideaText.trim() && !sourceIds.length)} aria-busy={busy === 'generate'} onClick={() => void generate()}>{busy === 'generate' ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{busy === 'generate' ? ' Generating…' : ' Generate'}</button><button className="li-quiet-button" type="button" disabled={Boolean(busy) || saveState === 'SAVING' || !post} aria-busy={busy === 'submit'} onClick={() => void submit()}>{busy === 'submit' ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} Send for approval</button></div>

  </div>

}

