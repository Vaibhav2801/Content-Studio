import { ArrowRight, Check, ChevronDown, Clock3, FileText, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

const posts = [
  { title: 'The hidden cost of manual reporting', meta: 'LinkedIn · Monday', status: 'Approved' },
  { title: 'Before vs. after: 6 hours back every week', meta: 'LinkedIn · Wednesday', status: 'Review' },
  { title: 'How Northstar Agency changed its workflow', meta: 'LinkedIn · Thursday', status: 'Creating' },
  { title: 'See your reporting time in one number', meta: 'LinkedIn · Friday', status: 'Planned' },
]

export function CampaignsView() {
  const [params] = useSearchParams()

  return (
    <section className="simple-campaigns">
      {params.get('created') === '1' && <div className="simple-success"><Check size={16} /> Campaign created. Quilltap is preparing the posts.</div>}

      <header className="simple-campaigns-head">
        <div><span>ACTIVE CAMPAIGN</span><h2>Pricing objection → proof</h2><p>October 26–30 · LinkedIn</p></div>
        <button className="simple-more-button" type="button">Campaign details <ChevronDown size={15} /></button>
      </header>

      <section className="simple-campaign-progress">
        <div><span>Campaign progress</span><strong>2 of 4 posts ready</strong></div>
        <span className="simple-progress-track"><i /></span>
      </section>

      <section className="simple-post-list" aria-labelledby="campaign-posts-title">
        <header><div><h3 id="campaign-posts-title">Posts</h3><p>Quilltap creates them here. You review each one before publishing.</p></div><button type="button"><Plus size={15} /> Add post</button></header>
        {posts.map((post) => (
          <article key={post.title}>
            <span className="simple-post-icon"><FileText size={17} /></span>
            <div><strong>{post.title}</strong><small>{post.meta}</small></div>
            <span className={`simple-post-status ${post.status.toLowerCase()}`}>{post.status === 'Approved' && <Check size={13} />}{post.status === 'Creating' && <Clock3 size={13} />}{post.status}</span>
            {post.status === 'Review' ? <Link to="/content/approvals">Review <ArrowRight size={14} /></Link> : <button type="button">Open</button>}
          </article>
        ))}
      </section>
    </section>
  )
}
