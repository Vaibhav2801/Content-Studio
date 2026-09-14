import { Image as ImageIcon } from 'lucide-react'
import type { ContentPost } from '../../types/content'

export function PostArtwork({ post, compact = false }: { post: ContentPost; compact?: boolean }) {
  if (post.image_url) return <img className={`li-artwork ${compact ? 'compact' : ''}`} src={post.image_url} alt={post.alt_text || ''} />
  return <div className={`li-image-placeholder ${compact ? 'compact' : ''}`} aria-label="No image added">
    <ImageIcon size={compact ? 18 : 28} />
    {!compact && <><strong>Image preview</strong><span>{post.image_prompt || 'Add visual direction to create an image.'}</span></>}
  </div>
}
