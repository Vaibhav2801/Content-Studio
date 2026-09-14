import type { SocialVariant } from '../../../types/socialComposer'
import { backendAssetUrl } from '../contentUtils'

function PreviewCopy({ variant }: { variant: SocialVariant }) {
  const thread = variant.metadata.format === 'THREAD' ? variant.metadata.thread : undefined
  return <>{thread?.length ? thread.map((item, index) => <p className="preview-thread-item" key={`${item}-${index}`}><small>{index + 1}/{thread.length}</small>{item}</p>) : <p>{variant.copy || 'Your post preview will appear here.'}</p>}<p className="preview-tags">{variant.hashtags.join(' ')}</p></>
}

export function PlatformPreview({ variant }: { variant: SocialVariant }) {
  const name = variant.account?.display_name || variant.network_label
  const media = variant.media[0]
  return <article className={`platform-preview preview-${variant.network.toLowerCase()}`} aria-label={`${variant.network_label} preview`}>
    <header><span className="preview-avatar">{name.slice(0, 2).toUpperCase()}</span><div><strong>{name}</strong><small>{variant.account?.account_type || 'Social account'} · now</small></div></header>
    <div className="platform-preview-copy"><PreviewCopy variant={variant} /></div>
    {media && <img src={backendAssetUrl(media.publish_url)} alt={media.alt_text || ''} />}
    {variant.metadata.format === 'CAROUSEL' && <div className="carousel-preview">{variant.metadata.carousel_slides?.map((slide, index) => <div key={`${slide}-${index}`}><small>Slide {index + 1}</small><strong>{slide}</strong></div>)}</div>}
    <footer>{variant.network === 'LINKEDIN' ? 'Like · Comment · Repost · Send' : variant.network === 'X' ? 'Reply · Repost · Like · Share' : 'Like · Comment · Share · Save'}</footer>
  </article>
}
