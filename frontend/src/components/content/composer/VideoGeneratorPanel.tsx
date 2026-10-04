import { CheckCircle2, Film, LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { VideoGenerationJob } from '../../../types/socialComposer'

interface Props {
  initialPrompt: string
  defaultAspectRatio: '16:9' | '9:16'
  blockedReason?: string
  onGenerate: (prompt: string, aspectRatio: '16:9' | '9:16') => Promise<VideoGenerationJob>
  onPoll: (jobId: string) => Promise<VideoGenerationJob>
  onComplete: () => Promise<void>
  onClose: () => void
}

const activeStatuses = new Set<VideoGenerationJob['status']>(['QUEUED', 'SUBMITTED', 'PROCESSING'])

export function VideoGeneratorPanel({
  initialPrompt,
  defaultAspectRatio,
  blockedReason,
  onGenerate,
  onPoll,
  onComplete,
  onClose,
}: Props) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>(defaultAspectRatio)
  const [job, setJob] = useState<VideoGenerationJob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!job || !activeStatuses.has(job.status)) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const next = await onPoll(job.id)
        if (cancelled) return
        setJob(next)
        setError('')
        if (next.status === 'COMPLETED') await onComplete()
        if (next.status === 'FAILED') setError(next.error_message || 'The video could not be generated. Your credits were refunded.')
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : 'Could not refresh video progress. Retrying…')
          setJob((current) => current ? { ...current, updated_at: new Date().toISOString() } : current)
        }
      }
    }, 4000)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [job, onComplete, onPoll])

  const submit = async () => {
    const cleanPrompt = prompt.trim()
    if (cleanPrompt.length < 10) {
      setError('Describe the subject, movement, and camera direction in at least 10 characters.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      setJob(await onGenerate(cleanPrompt, aspectRatio))
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not start video generation.')
    } finally {
      setSubmitting(false)
    }
  }

  const isActive = Boolean(job && activeStatuses.has(job.status))
  return (
    <div className="video-generator-panel" aria-label="AI video generator">
      <div className="video-generator-title">
        <span className="video-generator-icon"><Film size={18} /></span>
        <div><strong>Create an animated video</strong><small>8 seconds · 720p · synchronized audio</small></div>
        <button type="button" className="video-panel-close" onClick={onClose} disabled={isActive}>Close</button>
      </div>

      {blockedReason ? (
        <div className="video-generator-message warning"><TriangleAlert size={16} /><span>{blockedReason}</span></div>
      ) : (
        <>
          <label className="video-prompt-field">
            <span>Describe the scene and movement</span>
            <textarea
              value={prompt}
              maxLength={1500}
              disabled={submitting || isActive}
              placeholder="Example: A ceramic coffee cup on a wooden desk, morning light moving across the surface while the camera slowly pushes forward. Calm ambient café sound."
              onChange={(event) => setPrompt(event.target.value)}
            />
            <small><span>Include subject, action, camera movement, lighting, and sound.</span><b>{prompt.length}/1500</b></small>
          </label>

          <fieldset className="video-orientation-picker" disabled={submitting || isActive}>
            <legend>Format</legend>
            <label className={aspectRatio === '9:16' ? 'selected' : ''}>
              <input type="radio" name="video-aspect" checked={aspectRatio === '9:16'} onChange={() => setAspectRatio('9:16')} />
              <span className="orientation-shape portrait" /><span><strong>Vertical</strong><small>Reels &amp; Stories · 9:16</small></span>
            </label>
            <label className={aspectRatio === '16:9' ? 'selected' : ''}>
              <input type="radio" name="video-aspect" checked={aspectRatio === '16:9'} onChange={() => setAspectRatio('16:9')} />
              <span className="orientation-shape landscape" /><span><strong>Landscape</strong><small>LinkedIn &amp; X · 16:9</small></span>
            </label>
          </fieldset>

          {error && <div className="video-generator-message error" role="alert"><TriangleAlert size={16} /><span>{error}</span></div>}
          {job?.status === 'COMPLETED' && <div className="video-generator-message success" role="status"><CheckCircle2 size={16} /><span>Your video is ready and attached to this draft.</span></div>}
          {isActive && <div className="video-progress-card" role="status"><LoaderCircle className="spin" size={20} /><span><strong>Creating your video…</strong><small>You can keep working; this panel updates automatically.</small></span></div>}

          {!job || job.status === 'FAILED' ? (
            <div className="video-generator-submit">
              <span><strong>10 AI credits</strong><small>Charged once; automatically refunded if generation fails.</small></span>
              <button type="button" className="video-generate-button" disabled={submitting} onClick={() => void submit()}>
                {submitting ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                {submitting ? 'Starting…' : 'Generate video'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
