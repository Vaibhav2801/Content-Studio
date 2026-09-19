import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import type { SocialVariant } from '../../../types/socialComposer'
import { backendAssetUrl } from '../contentUtils'

interface Props {
  variant: SocialVariant
  busy: boolean
  onUpload: (file: File) => void
  onRemove: (assetId: string) => void
  onReorder: (assetIds: string[]) => void
  onAltText: (assetId: string, value: string) => void
  onRegenerate: (assetId?: string) => void
}

export function MediaManager({ variant, busy, onUpload, onRemove, onReorder, onAltText, onRegenerate }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const move = (index: number, direction: -1 | 1) => {
    const ids = variant.media.map((asset) => asset.id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    onReorder(ids)
  }
  return <section className="media-manager" aria-labelledby={`media-title-${variant.id}`}>
    <div className="media-manager-head"><div><h3 id={`media-title-${variant.id}`}>Media</h3><p>Add media supported by {variant.network_label}. Uploads are used directly and are not sent to the image generator.</p></div><div><input ref={input} hidden type="file" accept="image/*,video/mp4,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = '' }} /><button type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} /> Upload</button><button type="button" disabled={busy} onClick={() => onRegenerate()}>{busy ? <LoaderCircle className="spin" size={15} /> : <ImagePlus size={15} />} Create image</button></div></div>
    {variant.media.length > 0 && <div className="media-list">{variant.media.map((asset, index) => <article className="media-item" key={asset.id}>
      {asset.asset_type === 'IMAGE' ? <img src={backendAssetUrl(asset.publish_url)} alt={asset.alt_text || ''} /> : <div className="media-file">{asset.asset_type}</div>}
      <div><strong>{asset.original_filename || `${asset.asset_type.toLowerCase()} ${index + 1}`}</strong><label>Alt text<input defaultValue={asset.alt_text} onBlur={(event) => { if (event.target.value !== asset.alt_text) onAltText(asset.id, event.target.value) }} /></label></div>
      <div className="media-item-actions">{variant.media.length > 1 && <><button type="button" aria-label="Move left" disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowLeft size={14} /></button><button type="button" aria-label="Move right" disabled={busy || index === variant.media.length - 1} onClick={() => move(index, 1)}><ArrowRight size={14} /></button></>} {asset.asset_type === 'IMAGE' && <button type="button" aria-label="Create this image again" disabled={busy} onClick={() => onRegenerate(asset.id)}><RefreshCw size={14} /></button>}<button type="button" aria-label="Remove media" disabled={busy} onClick={() => onRemove(asset.id)}><Trash2 size={14} /></button></div>
    </article>)}</div>}
    {variant.validation.fields.media?.map((message) => <div className="composer-field-error" role="alert" key={message}>{message}</div>)}
  </section>
}
