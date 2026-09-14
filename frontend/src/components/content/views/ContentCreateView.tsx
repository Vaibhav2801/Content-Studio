import type { SocialPost } from '../../../types/socialComposer'
import { SocialComposer } from '../composer/SocialComposer'

export function ContentCreateView({ onPostChange }: { onPostChange?: (post: SocialPost | null) => void }) {
  return <SocialComposer onPostChange={onPostChange} />
}
