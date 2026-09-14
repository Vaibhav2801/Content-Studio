import { Copy } from 'lucide-react'
import type { ContentPost } from '../../types/content'
import { initials } from './contentUtils'
import { PostArtwork } from './PostArtwork'

export function SocialPostPreview({ post, accountName }: { post: ContentPost; accountName: string }) {
  const copyPost = () => navigator.clipboard?.writeText(`${post.body}\n\n${post.hashtags.join(' ')}`)
  return <article className="linkedin-preview" aria-label="Post preview">
    <header><span className="linkedin-avatar">{initials(accountName)}</span><div><strong>{accountName || 'Your company'}</strong><small>LinkedIn Company Page · Preview</small></div><button type="button" aria-label="Copy post" onClick={copyPost}><Copy size={17} /></button></header>
    <div className="linkedin-copy">{post.body.split('\n').map((line, index) => <p key={`${line}-${index}`}>{line || '\u00a0'}</p>)}<p className="linkedin-tags">{post.hashtags.join(' ')}</p></div>
    <PostArtwork post={post} />
    <footer><span>👍 💡 <small>24</small></span><span><small>5 comments · 2 reposts</small></span></footer>
    <div className="linkedin-actions"><span>Like</span><span>Comment</span><span>Repost</span><span>Send</span></div>
  </article>
}
