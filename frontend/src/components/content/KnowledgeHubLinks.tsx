import { LibraryBig, MessagesSquare, Palette } from 'lucide-react'
import { Link } from 'react-router-dom'

export function KnowledgeHubLinks({ base }: { base: '/content/library' }) {
  return <nav className="knowledge-links" aria-label="Content knowledge tools">
    <Link to={`${base}?panel=sources`}><LibraryBig size={18} /><span><strong>Sources</strong><small>Approved material for posts</small></span></Link>
    <Link to={`${base}?panel=story`}><MessagesSquare size={18} /><span><strong>Story Interview</strong><small>Capture this week’s story</small></span></Link>
    <Link to={`${base}?panel=brand`}><Palette size={18} /><span><strong>Brand &amp; Publishing</strong><small>Voice, schedule, and approvals</small></span></Link>
  </nav>
}
