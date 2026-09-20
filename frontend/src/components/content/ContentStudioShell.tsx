import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Home,
  Link2,
  MessageCircleMore,
  Menu,
  Plus,
  Settings2,
  LogOut,
  Sparkles,
  LoaderCircle,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { contentStudioApi } from '../../api/contentStudio'
import { contentStudioMockHome } from '../../api/contentStudioMock'
import type { HomeSummary } from '../../types/contentStudio'
import { CONTENT_STUDIO_NAV, type ContentStudioSection } from '../../types/content'
import { useContentStudio } from './ContentStudioContext'
import { useOptionalAuth } from './AuthContext'
import { AskAIButton } from './ai/AskAIFloatingButton'

const icons: Record<ContentStudioSection, LucideIcon> = {
  home: Home,
  create: Plus,
  series: Sparkles,
  approvals: CheckSquare,
  calendar: CalendarDays,
  library: BookOpen,
  engage: MessageCircleMore,
  connections: Link2,
  analytics: BarChart3,
  settings: Settings2,
}

const navigationGroups: { label: string; sections: ContentStudioSection[] }[] = [
  { label: 'Workspace', sections: ['home', 'calendar', 'library'] },
  { label: 'Publishing', sections: ['create', 'series', 'approvals'] },
  { label: 'Engagement', sections: ['engage'] },
  { label: 'Manage', sections: ['connections', 'analytics', 'settings'] },
]

export function ContentStudioShell() {
  const {
    dashboard,
    onboarding,
    settingsDraft,
    notice,
    noticeError,
    dismissNotice,
    isDemo,
    activeGenerations,
    generationNotice,
    dismissGenerationNotice,
  } = useContentStudio()
  const auth = useOptionalAuth()
  const [summary, setSummary] = useState<HomeSummary | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signoutError, setSignoutError] = useState('')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState('')
  const [workspaceBusy, setWorkspaceBusy] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')
  const feedbackTimers = useRef(new WeakMap<HTMLElement, number>())

  const showClickFeedback = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return
    const control = event.target.closest('button, a[href]') as HTMLElement | null
    if (!control || !event.currentTarget.contains(control) || control.matches(':disabled, [aria-disabled="true"]')) return
    const previousTimer = feedbackTimers.current.get(control)
    if (previousTimer) window.clearTimeout(previousTimer)
    control.classList.remove('studio-click-feedback')
    void control.offsetWidth
    control.classList.add('studio-click-feedback')
    const timer = window.setTimeout(() => {
      control.classList.remove('studio-click-feedback')
      feedbackTimers.current.delete(control)
    }, 650)
    feedbackTimers.current.set(control, timer)
  }
  const location = useLocation()
  const current = CONTENT_STUDIO_NAV.find((item) => item.path === location.pathname) ?? CONTENT_STUDIO_NAV[0]
  const isOnboarding = location.pathname === '/content/onboarding'
  const pageLabel = isOnboarding ? 'Set up Content Studio' : current.label === 'Home' ? 'Content Studio' : current.label
  const pageDescription = isOnboarding ? 'A few steps to get ready for your first post.' : current.description
  const workspaceName = auth?.workspace?.name || (onboarding.business.name?.trim() ? onboarding.business.name.trim() + ' workspace' : 'Your workspace')

  useEffect(() => setSidebarOpen(false), [location.pathname])

  const activateWorkspace = async (workspaceId: string) => {
    if (!auth || workspaceBusy || workspaceId === auth.workspace?.id) return
    setWorkspaceBusy(true); setWorkspaceError('')
    try {
      await auth.switchWorkspace(workspaceId)
      window.location.assign('/content')
    } catch { setWorkspaceError('Could not switch workspace. Please try again.'); setWorkspaceBusy(false) }
  }
  const createWorkspace = async () => {
    if (!auth || workspaceBusy || !workspaceNameDraft.trim()) return
    setWorkspaceBusy(true); setWorkspaceError('')
    try {
      await auth.createWorkspace(workspaceNameDraft.trim())
      window.location.assign('/content')
    } catch { setWorkspaceError('Could not create workspace. Please try again.'); setWorkspaceBusy(false) }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const result = isDemo ? structuredClone(contentStudioMockHome) : await contentStudioApi.home()
        if (active) setSummary(result)
      } catch { /* Each screen presents its own load error. */ }
    }
    void load()
    return () => { active = false }
  }, [isDemo, location.pathname])

  const failedCount = summary?.failures.length ?? dashboard.posts.filter((post) => post.status === 'FAILED').length
  const reviewCount = summary?.needs_approval.length ?? dashboard.posts.filter((post) => post.status === 'DRAFT').length
  const needsAttention = failedCount > 0 || Boolean(summary?.connections_needing_attention) || (onboarding.connection.health === 'NEEDS_ATTENTION' && onboarding.connection.status !== 'DISCONNECTED')

  return (
    <div className="content-studio studio-app-shell" onClickCapture={showClickFeedback}>
      <a className="studio-skip-link" href="#studio-main">Skip to content</a>
      {sidebarOpen && <button className="studio-sidebar-scrim" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <aside className={`studio-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="studio-sidebar-top">
          <Link className="studio-brand" to="/content" aria-label="Content Studio home">
            <span className="studio-brand-mark"><Sparkles size={20} strokeWidth={2.1} /></span>
            <span className="studio-brand-copy"><strong>content studio</strong><small>CREATE · PUBLISH · GROW</small></span>
          </Link>
          <button className="studio-sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>

        <div className="studio-workspace-switcher">
          <button className="studio-workspace-card" type="button" aria-expanded={workspaceMenuOpen} onClick={() => setWorkspaceMenuOpen((open) => !open)}>
            <span className="studio-workspace-avatar">{workspaceName.slice(0, 1).toUpperCase()}</span>
            <span><small>WORKSPACE</small><strong>{workspaceName}</strong></span>
            <ChevronDown size={16} />
          </button>
          {workspaceMenuOpen && <div className="studio-workspace-menu">
            <strong>Switch workspace</strong>
            <div className="studio-workspace-list">{auth?.workspaces.map((workspace) => <button type="button" key={workspace.id} disabled={workspaceBusy} aria-current={workspace.id === auth.workspace?.id ? 'true' : undefined} onClick={() => void activateWorkspace(workspace.id)}><span>{workspace.name.slice(0, 1).toUpperCase()}</span><span><strong>{workspace.name}</strong><small>{workspace.role.toLowerCase()}</small></span>{workspace.id === auth.workspace?.id ? <CircleCheck size={15} /> : null}</button>)}</div>
            <label><span>New workspace</span><input value={workspaceNameDraft} maxLength={255} placeholder="Business name" onChange={(event) => setWorkspaceNameDraft(event.target.value)} /></label>
            <button className="studio-workspace-create" type="button" disabled={workspaceBusy || !workspaceNameDraft.trim()} onClick={() => void createWorkspace()}>{workspaceBusy ? 'Working…' : <><Plus size={14} /> Create workspace</>}</button>
            {workspaceError && <small className="studio-workspace-error" role="alert">{workspaceError}</small>}
            <Link to="/content/settings" onClick={() => setWorkspaceMenuOpen(false)}>Manage current workspace settings</Link>
          </div>}
        </div>

        <Link className="studio-sidebar-create" to="/content/create"><Plus size={17} /> Create post <span>↗</span></Link>

        <nav className="studio-sidebar-nav" aria-label="Content Studio sections">
          {navigationGroups.map((group) => (
            <div className="studio-nav-group" key={group.label}>
              <span className="studio-nav-heading">{group.label}</span>
              {group.sections.map((section) => {
                const item = CONTENT_STUDIO_NAV.find((entry) => entry.section === section)!
                const Icon = icons[section]
                return (
                  <NavLink key={item.path} to={item.path} end={section === 'home'} className={({ isActive }) => `studio-nav-item ${isActive ? 'active' : ''}`}>
                    <Icon size={18} strokeWidth={1.9} />
                    <span>{item.label}</span>
                    {section === 'approvals' && reviewCount > 0 && <small className="studio-nav-count">{reviewCount}</small>}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="studio-sidebar-bottom">
          <Link className="studio-health-card" to={needsAttention ? '/content/connections' : '/content/calendar'}>
            <span className={`studio-health-icon ${needsAttention ? 'warning' : ''}`}>{needsAttention ? <CircleAlert size={17} /> : <CircleCheck size={17} />}</span>
            <span><strong>{needsAttention ? 'Needs attention' : settingsDraft.is_active ? 'Publishing is on' : 'Ready when you are'}</strong><small>{needsAttention ? 'Review your connections' : settingsDraft.is_active ? 'Your schedule is active' : 'Plan your next post'}</small></span>
            <ChevronRight size={15} />
          </Link>
          {auth?.user && <div className="studio-account"><span>{auth.user.name.slice(0, 1).toUpperCase()}</span><div><strong>{auth.user.name}</strong><small>{auth.user.email}</small></div></div>}
          {auth?.user && <button className="studio-signout" type="button" onClick={() => { void auth.signOut().catch(() => setSignoutError('Could not sign out. Please try again.')) }}><LogOut size={16} /><span>Sign out</span></button>}
          <span className="studio-sidebar-footnote">A calmer way to keep content moving.</span>
        </div>
      </aside>

      <div className="studio-main-column">
        <header className="studio-topbar">
          <button className="studio-menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="studio-breadcrumb"><span>Workspace</span><ChevronRight size={15} /><strong>{isOnboarding ? 'Setup' : current.label}</strong></div>
          <div className="studio-topbar-right">
            {isDemo && <span className="studio-demo-pill"><span /> Demo mode</span>}
            <AskAIButton />
            <Link className="studio-topbar-settings" to="/content/settings" aria-label="Open Content Studio settings"><Settings2 size={18} /></Link>
          </div>
        </header>
        <main className="studio-main" id="studio-main">
          <div className="studio-page-heading content-page-head">
            <div><span className="studio-page-kicker">CONTENT WORKSPACE</span><h1>{pageLabel}</h1><p>{pageDescription}</p></div>
            {needsAttention && current.section === 'home' && <Link className="content-attention" to="/content/connections"><CircleAlert size={17} /> Needs attention <ChevronRight size={15} /></Link>}
          </div>
          {isDemo && <div className="li-banner neutral"><Sparkles size={17} /><span>Demo data is on. Changes stay in this preview.</span></div>}
          {signoutError && <div className="li-banner error" role="alert">{signoutError}<button type="button" onClick={() => setSignoutError('')} aria-label="Dismiss sign-out error"><X size={16} /></button></div>}
          {notice && <div className={`li-banner ${noticeError ? 'error' : 'success'}`} role={noticeError ? 'alert' : 'status'}><span>{notice}</span><button onClick={dismissNotice} aria-label="Dismiss message"><X size={16} /></button></div>}
          {generationNotice && (
            <div className={`li-banner ${generationNotice.isError ? 'error' : 'success'}`} role={generationNotice.isError ? 'alert' : 'status'}>
              <Sparkles size={17} />
              <span>{generationNotice.message}</span>
              {generationNotice.postId && (
                <Link
                  className="button button-dark"
                  style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '0.85rem' }}
                  to={`/content/create?draft=${generationNotice.postId}`}
                  onClick={dismissGenerationNotice}
                >
                  {generationNotice.isError ? 'View Draft & Retry' : 'Review in Composer'}
                </Link>
              )}
              <button onClick={dismissGenerationNotice} aria-label="Dismiss notification"><X size={16} /></button>
            </div>
          )}
          {location.pathname !== '/content/create' &&
            Object.values(activeGenerations)
              .filter((item) => item.status === 'GENERATING')
              .map((item) => (
                <div key={item.postId} className="li-banner neutral" role="status">
                  <LoaderCircle className="spin" size={16} />
                  <span>
                    Generating post: <strong>{item.title}</strong> in the background…
                  </span>
                  <Link
                    className="button button-dark"
                    style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: '0.8rem' }}
                    to={`/content/create?draft=${item.postId}`}
                  >
                    View Progress
                  </Link>
                </div>
              ))}
          <Outlet />
        </main>
      </div>
    </div>
  )
}


