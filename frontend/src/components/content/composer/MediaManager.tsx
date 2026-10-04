import { ArrowLeft, ArrowRight, Film, ImagePlus, LoaderCircle, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { SocialVariant, VideoGenerationJob } from '../../../types/socialComposer'
import { backendAssetUrl } from '../contentUtils'
import { VideoGeneratorPanel } from './VideoGeneratorPanel'

interface Props {
  variant: SocialVariant
  busy: boolean
  onUpload: (file: File) => void
  onRemove: (assetId: string) => void
  onReorder: (assetIds: string[]) => void
  onAltText: (assetId: string, value: string) => void
  onRegenerate: (assetId?: string) => void
  initialVideoPrompt: string
  onGenerateVideo: (prompt: string, aspectRatio: '16:9' | '9:16') => Promise<VideoGenerationJob>
  onPollVideo: (jobId: string) => Promise<VideoGenerationJob>
  onVideoComplete: () => Promise<void>
}

export function MediaManager({ variant, busy, onUpload, onRemove, onReorder, onAltText, onRegenerate, initialVideoPrompt, onGenerateVideo, onPollVideo, onVideoComplete }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [showVideoGenerator, setShowVideoGenerator] = useState(false)
  const move = (index: number, direction: -1 | 1) => {
    const ids = variant.media.map((asset) => asset.id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    onReorder(ids)
  }
  return <section className="media-manager" aria-labelledby={`media-title-${variant.id}`}>
    <div className="media-manager-head"><div><h3 id={`media-title-${variant.id}`}>Media</h3><p>Add media supported by {variant.network_label}. Uploads are used directly and are not sent to an AI generator.</p></div><div><input ref={input} hidden type="file" accept="image/*,video/mp4,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = '' }} /><button type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} /> Upload</button><button type="button" disabled={busy} onClick={() => onRegenerate()}>{busy ? <LoaderCircle className="spin" size={15} /> : <ImagePlus size={15} />} Create image</button><button type="button" className="create-video-button" disabled={busy} onClick={() => setShowVideoGenerator((value) => !value)}><Film size={15} /> Create video</button></div></div>
    {showVideoGenerator && <VideoGeneratorPanel
      initialPrompt={initialVideoPrompt}
      defaultAspectRatio={variant.network === 'INSTAGRAM' ? '9:16' : '16:9'}
      blockedReason={variant.media.length ? 'Remove the current media first. Your existing asset stays in place until you choose to remove it.' : undefined}
      onGenerate={onGenerateVideo}
      onPoll={onPollVideo}
      onComplete={onVideoComplete}
      onClose={() => setShowVideoGenerator(false)}
    />}
    {variant.media.length > 0 && <div className="media-list">{variant.media.map((asset, index) => <article className="media-item" key={asset.id}>
      {asset.asset_type === 'IMAGE' ? <img src={backendAssetUrl(asset.publish_url)} alt={asset.alt_text || ''} /> : asset.asset_type === 'VIDEO' ? <video src={backendAssetUrl(asset.publish_url)} controls preload="metadata" aria-label={asset.alt_text || 'Generated video'} /> : <div className="media-file">{asset.asset_type}</div>}
      <div><strong>{asset.original_filename || `${asset.asset_type.toLowerCase()} ${index + 1}`}</strong><label>Alt text<input defaultValue={asset.alt_text} onBlur={(event) => { if (event.target.value !== asset.alt_text) onAltText(asset.id, event.target.value) }} /></label></div>
      <div className="media-item-actions">{variant.media.length > 1 && <><button type="button" aria-label="Move left" disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowLeft size={14} /></button><button type="button" aria-label="Move right" disabled={busy || index === variant.media.length - 1} onClick={() => move(index, 1)}><ArrowRight size={14} /></button></>} {asset.asset_type === 'IMAGE' && <button type="button" aria-label="Create this image again" disabled={busy} onClick={() => onRegenerate(asset.id)}><RefreshCw size={14} /></button>}<button type="button" aria-label="Remove media" disabled={busy} onClick={() => onRemove(asset.id)}><Trash2 size={14} /></button></div>
    </article>)}</div>}
    {variant.validation.fields.media?.map((message) => <div className="composer-field-error" role="alert" key={message}>{message}</div>)}
  </section>
}
