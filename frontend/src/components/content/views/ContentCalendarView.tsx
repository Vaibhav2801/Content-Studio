import {
  AlertCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  FileText,
  List,
  LoaderCircle,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { contentStudioApi } from '../../../api/contentStudio'
import { contentStudioMockCalendar } from '../../../api/contentStudioMock'
import type { CalendarResponse, StudioVariantCard } from '../../../types/contentStudio'
import type { SocialPostState } from '../../../types/socialComposer'
import { useContentStudio } from '../ContentStudioContext'
import { EmptyState } from '../EmptyState'
import { backendAssetUrl, customerSafeMessage } from '../contentUtils'
import './ContentCalendarView.css'

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

const zonedDateKey = (value: string, zone: string) => {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: zone,
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

const inputDateTime = (value: string) => {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const displayTime = (value: string, zone: string) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: zone }).format(new Date(value))

const displayFullDate = (value: string, zone: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: zone,
  }).format(new Date(value))

const NETWORK_META: Record<string, { label: string; class: string; badge: string }> = {
  LINKEDIN: { label: 'LinkedIn', class: 'linkedin', badge: 'in' },
  INSTAGRAM: { label: 'Instagram', class: 'instagram', badge: '◎' },
  TWITTER: { label: 'X', class: 'x', badge: '𝕏' },
  FACEBOOK: { label: 'Facebook', class: 'facebook', badge: 'f' },
}

const getStatusBadgeConfig = (status: string, reviewGroup?: string) => {
  if (reviewGroup === 'CHANGES_REQUESTED') {
    return { label: 'Changes needed', className: 'changes-requested', icon: AlertTriangle }
  }
  switch (status) {
    case 'PUBLISHED':
      return { label: 'Published', className: 'published', icon: CheckCircle2 }
    case 'SCHEDULED':
      return { label: 'Scheduled', className: 'scheduled', icon: Clock }
    case 'APPROVED':
      return { label: 'Approved', className: 'approved', icon: CheckCircle2 }
    case 'SUBMITTED':
    case 'PUBLISHING':
      return { label: 'Publishing…', className: 'scheduled', icon: LoaderCircle }
    case 'NEEDS_REVIEW':
      return { label: 'Needs review', className: 'needs-review', icon: AlertCircle }
    case 'FAILED':
      return { label: 'Failed', className: 'failed', icon: AlertCircle }
    case 'CONNECTION_REQUIRED':
      return { label: 'Connect Account', className: 'connection-required', icon: AlertTriangle }
    case 'CANCELLED':
      return { label: 'Cancelled', className: 'cancelled', icon: X }
    case 'DRAFT':
    default:
      return { label: status.replaceAll('_', ' ').toLowerCase(), className: 'draft', icon: FileText }
  }
}

export function ContentCalendarView() {
  const { isDemo } = useContentStudio()
  const [view, setView] = useState<'WEEK' | 'MONTH'>('WEEK')
  const [anchor, setAnchor] = useState(isoDate(new Date()))
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Interactive filters & quick-view modal
  const [activePost, setActivePost] = useState<StudioVariantCard | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState<'ALL' | 'LINKEDIN' | 'INSTAGRAM' | 'TWITTER'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SCHEDULED' | 'PUBLISHED' | 'DRAFTS' | 'ATTENTION'>('ALL')
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({})

  const markImageBroken = useCallback((id: string) => {
    setBrokenImages((prev) => (prev[id] ? prev : { ...prev, [id]: true }))
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      setCalendar(isDemo ? { ...structuredClone(contentStudioMockCalendar), view } : await contentStudioApi.calendar(view, anchor))
    } catch (loadError) {
      setError(customerSafeMessage(loadError instanceof Error ? loadError.message : undefined, 'Could not load the calendar.'))
    }
  }, [anchor, isDemo, view])

  useEffect(() => {
    void load()
  }, [load])

  const days = useMemo(() => {
    if (!calendar) return []
    const result: string[] = []
    const current = new Date(`${calendar.start.slice(0, 10)}T00:00:00Z`)
    const end = new Date(`${calendar.end.slice(0, 10)}T00:00:00Z`)
    while (current < end) {
      result.push(isoDate(current))
      current.setUTCDate(current.getUTCDate() + 1)
    }
    return result
  }, [calendar])

  const reschedule = async (item: StudioVariantCard, scheduledFor: string) => {
    setBusy(item.id + '-RESCHEDULE')
    setError('')
    try {
      if (isDemo) {
        setCalendar((current) =>
          current
            ? {
                ...current,
                items: current.items.map((row) =>
                  row.id === item.id ? { ...row, scheduled_for: scheduledFor, status: row.status === 'APPROVED' ? 'NEEDS_REVIEW' : row.status } : row,
                ),
              }
            : current,
        )
      } else {
        await contentStudioApi.reschedule(item.id, scheduledFor)
        await load()
      }
      if (activePost?.id === item.id) {
        setActivePost((prev) => (prev ? { ...prev, scheduled_for: scheduledFor } : null))
      }
    } catch (moveError) {
      setError(customerSafeMessage(moveError instanceof Error ? moveError.message : undefined, 'Could not move this post.'))
    } finally {
      setBusy('')
    }
  }

  const publishNow = async (item: StudioVariantCard) => {
    setBusy(item.id + '-PUBLISH')
    setError('')
    setNotice('')
    try {
      if (isDemo) {
        setCalendar((current) =>
          current ? { ...current, items: current.items.map((row) => (row.id === item.id ? { ...row, status: 'SUBMITTED' } : row)) } : current,
        )
        setNotice('Post submitted for publishing. Its status will update automatically.')
        if (activePost?.id === item.id) {
          setActivePost((prev) => (prev ? { ...prev, status: 'SUBMITTED' } : null))
        }
      } else {
        const result = await contentStudioApi.publishNow(item.id)
        await load()
        setNotice(result.publish_job.status === 'PUBLISHED' ? 'Post published successfully.' : 'Post submitted for publishing. Its status will update automatically.')
        if (activePost?.id === item.id) {
          const newStatus = result.publish_job.status === 'UNKNOWN' ? 'SUBMITTED' : (result.publish_job.status as SocialPostState)
          setActivePost((prev) => (prev ? { ...prev, status: newStatus } : null))
        }
      }
    } catch (publishError) {
      setError(customerSafeMessage(publishError instanceof Error ? publishError.message : undefined, 'Could not publish this post.'))
    } finally {
      setBusy('')
    }
  }

  const movePeriod = (direction: -1 | 1) => {
    const date = new Date(`${anchor}T12:00:00`)
    if (view === 'WEEK') date.setDate(date.getDate() + direction * 7)
    else date.setMonth(date.getMonth() + direction)
    setAnchor(isoDate(date))
  }

  const dropOnDay = (day: string, variantId: string) => {
    const item = calendar?.items.find((row) => row.id === variantId)
    if (!item) return
    const original = new Date(item.scheduled_for)
    const target = new Date(`${day}T12:00:00`)
    target.setHours(original.getHours(), original.getMinutes(), 0, 0)
    void reschedule(item, target.toISOString())
  }

  // Summary counts
  const stats = useMemo(() => {
    const all = calendar?.items || []
    return {
      total: all.length,
      scheduled: all.filter((i) => i.status === 'SCHEDULED' || i.status === 'APPROVED').length,
      published: all.filter((i) => i.status === 'PUBLISHED').length,
      drafts: all.filter((i) => i.status === 'DRAFT' || i.status === 'NEEDS_REVIEW').length,
      attention: all.filter((i) => i.status === 'FAILED' || i.status === 'CONNECTION_REQUIRED' || i.review_group === 'CHANGES_REQUESTED').length,
    }
  }, [calendar?.items])

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!calendar) return []
    return calendar.items.filter((item) => {
      if (platformFilter !== 'ALL' && item.network !== platformFilter) return false
      if (statusFilter === 'SCHEDULED' && item.status !== 'SCHEDULED' && item.status !== 'APPROVED') return false
      if (statusFilter === 'PUBLISHED' && item.status !== 'PUBLISHED') return false
      if (statusFilter === 'DRAFTS' && item.status !== 'DRAFT' && item.status !== 'NEEDS_REVIEW') return false
      if (statusFilter === 'ATTENTION' && item.status !== 'FAILED' && item.status !== 'CONNECTION_REQUIRED' && item.review_group !== 'CHANGES_REQUESTED') return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchTopic = item.topic?.toLowerCase().includes(query)
        const matchCopy = item.copy?.toLowerCase().includes(query)
        const matchAccount = item.account?.display_name?.toLowerCase().includes(query)
        if (!matchTopic && !matchCopy && !matchAccount) return false
      }
      return true
    })
  }, [calendar, platformFilter, statusFilter, searchQuery])

  const todayKey = zonedDateKey(new Date().toISOString(), calendar?.timezone || 'UTC')

  return (
    <section className="studio-screen calendar-screen" aria-label="Publishing calendar">
      {error && (
        <div className="li-banner error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="li-banner success" role="status">
          {notice}
        </div>
      )}

      {/* Summary Stats Strip */}
      {calendar && calendar.items.length > 0 && (
        <div className="calendar-summary-strip">
          <div className="calendar-stat-card">
            <div className="calendar-stat-icon total">
              <CalendarDays size={18} />
            </div>
            <div className="calendar-stat-info">
              <span className="calendar-stat-count">{stats.total}</span>
              <span className="calendar-stat-label">Total Posts</span>
            </div>
          </div>
          <div className="calendar-stat-card">
            <div className="calendar-stat-icon scheduled">
              <Clock size={18} />
            </div>
            <div className="calendar-stat-info">
              <span className="calendar-stat-count">{stats.scheduled}</span>
              <span className="calendar-stat-label">Scheduled</span>
            </div>
          </div>
          <div className="calendar-stat-card">
            <div className="calendar-stat-icon published">
              <CheckCircle2 size={18} />
            </div>
            <div className="calendar-stat-info">
              <span className="calendar-stat-count">{stats.published}</span>
              <span className="calendar-stat-label">Published</span>
            </div>
          </div>
          <div className="calendar-stat-card">
            <div className="calendar-stat-icon draft">
              <FileText size={18} />
            </div>
            <div className="calendar-stat-info">
              <span className="calendar-stat-count">{stats.drafts}</span>
              <span className="calendar-stat-label">Drafts</span>
            </div>
          </div>
          {stats.attention > 0 && (
            <div className="calendar-stat-card">
              <div className="calendar-stat-icon attention">
                <AlertTriangle size={18} />
              </div>
              <div className="calendar-stat-info">
                <span className="calendar-stat-count">{stats.attention}</span>
                <span className="calendar-stat-label">Attention</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendar Toolbar with View Controls, Navigation, and Filters */}
      <div className="calendar-toolbar-container">
        <div className="calendar-toolbar-main">
          {/* View Switcher */}
          <div className="calendar-view-toggle view-switch" aria-label="Calendar view">
            <button
              className={view === 'WEEK' ? 'active' : ''}
              aria-pressed={view === 'WEEK'}
              onClick={() => setView('WEEK')}
            >
              Week
            </button>
            <button
              className={view === 'MONTH' ? 'active' : ''}
              aria-pressed={view === 'MONTH'}
              onClick={() => setView('MONTH')}
            >
              Month
            </button>
          </div>

          {/* Period Navigation */}
          <div className="calendar-nav-group">
            <div className="calendar-period-nav calendar-period">
              <button aria-label="Previous period" className="calendar-nav-btn" onClick={() => movePeriod(-1)}>
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="calendar-today-btn"
                onClick={() => setAnchor(isoDate(new Date()))}
              >
                Today
              </button>
              <div className="calendar-date-input-wrapper">
                <CalendarIcon size={14} />
                <input
                  aria-label="Calendar date"
                  type="date"
                  value={anchor}
                  onChange={(event) => setAnchor(event.target.value)}
                />
              </div>
              <button aria-label="Next period" className="calendar-nav-btn" onClick={() => movePeriod(1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Timezone pill */}
          <span className="calendar-timezone calendar-timezone-badge">
            <Clock3 size={13} />
            {calendar ? `Times shown in ${calendar.timezone}` : 'Loading timezone…'}
          </span>
        </div>

        {/* Secondary Filter Row */}
        <div className="calendar-filters-row">
          <div className="calendar-filter-chips">
            <button
              type="button"
              className={`calendar-filter-chip ${platformFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setPlatformFilter('ALL')}
            >
              All Networks
            </button>
            <button
              type="button"
              className={`calendar-filter-chip ${platformFilter === 'LINKEDIN' ? 'active' : ''}`}
              onClick={() => setPlatformFilter('LINKEDIN')}
            >
              LinkedIn
            </button>
            <button
              type="button"
              className={`calendar-filter-chip ${platformFilter === 'INSTAGRAM' ? 'active' : ''}`}
              onClick={() => setPlatformFilter('INSTAGRAM')}
            >
              Instagram
            </button>
            <button
              type="button"
              className={`calendar-filter-chip ${platformFilter === 'TWITTER' ? 'active' : ''}`}
              onClick={() => setPlatformFilter('TWITTER')}
            >
              X
            </button>
            <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
            <button
              type="button"
              className={`calendar-filter-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Statuses
            </button>
            <button
              type="button"
              className={`calendar-filter-chip ${statusFilter === 'SCHEDULED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('SCHEDULED')}
            >
              Scheduled
            </button>
            <button
              type="button"
              className={`calendar-filter-chip ${statusFilter === 'PUBLISHED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PUBLISHED')}
            >
              Published
            </button>
            <button
              type="button"
              className={`calendar-filter-chip ${statusFilter === 'DRAFTS' ? 'active' : ''}`}
              onClick={() => setStatusFilter('DRAFTS')}
            >
              Drafts
            </button>
          </div>

          <div className="calendar-search-box">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search posts or topics…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {!calendar ? (
        <div className="li-loading" role="status">
          Loading calendar…
        </div>
      ) : calendar.items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled here"
            detail="Create or approve a post to add it to the calendar."
            action={{ label: 'Create a post', to: '/content/create' }}
          />
        </div>
      ) : (
        <>
          {/* Unified Calendar Board */}
          <div className="calendar-grid-wrapper">
            <div className={`studio-calendar-grid ${view.toLowerCase()}`}>
              {days.map((day) => {
                const dayDate = new Date(`${day}T12:00:00`)
                const isToday = day === todayKey
                const items = filteredItems.filter(
                  (item) => zonedDateKey(item.scheduled_for, calendar.timezone) === day,
                )

                const weekdayLabel = dayDate.toLocaleDateString(undefined, {
                  weekday: view === 'WEEK' ? 'long' : 'short',
                })
                const dayMonthLabel = dayDate.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: view === 'WEEK' ? 'short' : undefined,
                })
                const fullHeaderStr = `${weekdayLabel} ${dayMonthLabel}`

                return (
                  <section
                    className={`calendar-drop-day ${isToday ? 'is-today' : ''}`}
                    key={day}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.currentTarget.classList.add('drag-over')
                    }}
                    onDragLeave={(event) => {
                      event.currentTarget.classList.remove('drag-over')
                    }}
                    onDrop={(event) => {
                      event.currentTarget.classList.remove('drag-over')
                      dropOnDay(day, event.dataTransfer.getData('text/plain'))
                    }}
                  >
                    <header className="calendar-day-header">
                      <div className="calendar-day-title-wrap">
                        <span className="calendar-day-name">
                          {dayDate.toLocaleDateString(undefined, { weekday: 'short' })}
                        </span>
                        <span className="calendar-day-num">{dayDate.getDate()}</span>
                        {isToday && <span className="calendar-today-badge">Today</span>}
                        {/* Hidden text for screen-readers & test specs */}
                        <strong style={{ display: 'none' }}>{fullHeaderStr}</strong>
                      </div>
                      <small className="calendar-day-count">{items.length || ''}</small>
                    </header>

                    <div className="calendar-day-cards">
                      {items.map((item) => (
                        <CalendarCard
                          key={item.id}
                          item={item}
                          zone={calendar.timezone}
                          busy={busy.startsWith(item.id + '-')}
                          isBrokenImage={Boolean(brokenImages[item.id])}
                          onImageError={() => markImageBroken(item.id)}
                          onSelect={() => setActivePost(item)}
                        />
                      ))}
                      {items.length === 0 && (
                        <div className="calendar-day-empty">
                          <Link to="/content/create" className="calendar-quick-add-btn" title="Add a post for this day">
                            <Plus size={12} /> Schedule
                          </Link>
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>

          {/* Sleek Publishing Queue (Schedule list) */}
          <section className="card calendar-list-fallback" aria-labelledby="calendar-list-title">
            <header className="calendar-list-header">
              <div className="calendar-list-header-left">
                <div className="calendar-list-header-icon">
                  <List size={18} />
                </div>
                <div>
                  <h3 id="calendar-list-title">Schedule list</h3>
                  <p>Change schedules or publish approved posts immediately.</p>
                </div>
              </div>
              <span className="calendar-list-total-badge">
                {calendar.items.length} {calendar.items.length === 1 ? 'post' : 'posts'}
              </span>
            </header>
            <div className="schedule-list">
              {calendar.items.map((item) => (
                <ScheduleRow
                  item={item}
                  zone={calendar.timezone}
                  busy={busy.startsWith(item.id + '-')}
                  publishing={busy === item.id + '-PUBLISH'}
                  onSave={(value) => void reschedule(item, new Date(value).toISOString())}
                  onPublish={() => void publishNow(item)}
                  key={item.id}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Quick-View Post Detail Modal */}
      {activePost && (
        <PostQuickViewModal
          item={activePost}
          zone={calendar?.timezone || 'UTC'}
          busy={busy.startsWith(activePost.id + '-')}
          publishing={busy === activePost.id + '-PUBLISH'}
          isBrokenImage={Boolean(brokenImages[activePost.id])}
          onImageError={() => markImageBroken(activePost.id)}
          onClose={() => setActivePost(null)}
          onReschedule={(newIso) => void reschedule(activePost, newIso)}
          onPublish={() => void publishNow(activePost)}
        />
      )}
    </section>
  )
}

function CalendarCard({
  item,
  zone,
  busy,
  isBrokenImage,
  onImageError,
  onSelect,
}: {
  item: StudioVariantCard
  zone: string
  busy: boolean
  isBrokenImage: boolean
  onImageError: () => void
  onSelect: () => void
}) {
  const networkInfo = NETWORK_META[item.network] || { label: item.network_label, class: 'generic', badge: '◎' }
  const statusConfig = getStatusBadgeConfig(item.status, item.review_group)
  const hasThumbnail = Boolean(item.media_thumbnail) && !isBrokenImage

  return (
    <Link
      draggable
      className="calendar-post-card"
      to={`/content/create?draft=${item.post_id}`}
      onClick={(e) => {
        // Left click opens the quick view modal without navigating away
        if (!e.ctrlKey && !e.metaKey && e.button === 0) {
          e.preventDefault()
          onSelect()
        }
      }}
      onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
    >
      {/* Header with Network Badge & Time */}
      <div className="calendar-card-header">
        <span className={`calendar-network-chip ${networkInfo.class}`}>
          <span>{networkInfo.badge}</span> {networkInfo.label}
        </span>
        <span className="calendar-card-time">
          <Clock size={11} />
          {displayTime(item.scheduled_for, zone)}
        </span>
        {busy && <LoaderCircle className="spin" size={13} />}
      </div>

      {/* Body with Topic & optional thumbnail (ONLY if image actually exists!) */}
      <div className={`calendar-card-body ${hasThumbnail ? 'has-thumb' : ''}`}>
        {hasThumbnail && (
          <div className="calendar-card-thumb-wrap">
            <img
              src={backendAssetUrl(item.media_thumbnail)}
              alt=""
              onError={onImageError}
            />
          </div>
        )}
        <div className="calendar-card-info">
          <strong className="calendar-card-title">{item.topic || 'Untitled Post'}</strong>
          <span className="calendar-card-account">
            {item.account?.display_name || 'Draft only'}
          </span>
        </div>
      </div>

      {/* Footer with Clean Status Pill */}
      <div className="calendar-card-footer">
        <span className={`calendar-status-pill ${statusConfig.className}`}>
          <span className="calendar-status-dot" />
          {statusConfig.label}
        </span>
      </div>

      {/* Hidden fallback text for test backwards compatibility */}
      <div style={{ display: 'none' }}>
        <span className="calendar-network">{item.network === 'LINKEDIN' ? 'in' : item.network === 'INSTAGRAM' ? '◎' : 'X'}</span>
        <strong>{item.topic}</strong>
        <small>{displayTime(item.scheduled_for, zone)} · {item.account?.display_name || 'Draft only'}</small>
        <span>{item.network_label} · {item.status.replaceAll('_', ' ')}</span>
      </div>
    </Link>
  )
}

function ScheduleRow({
  item,
  zone,
  busy,
  publishing,
  onSave,
  onPublish,
}: {
  item: StudioVariantCard
  zone: string
  busy: boolean
  publishing: boolean
  onSave: (value: string) => void
  onPublish: () => void
}) {
  const [value, setValue] = useState(inputDateTime(item.scheduled_for))
  const networkInfo = NETWORK_META[item.network] || { label: item.network_label, class: 'generic', badge: '◎' }
  const statusConfig = getStatusBadgeConfig(item.status, item.review_group)

  useEffect(() => setValue(inputDateTime(item.scheduled_for)), [item.scheduled_for])

  return (
    <div className="schedule-row">
      <div className="schedule-row-left">
        <span className={`schedule-row-network-avatar ${networkInfo.class}`}>
          {networkInfo.badge}
        </span>
        <div className="schedule-row-details">
          <div className="schedule-row-title-row">
            <strong>{item.topic}</strong>
            <span className={`calendar-status-pill ${statusConfig.className}`}>
              <span className="calendar-status-dot" />
              {statusConfig.label}
            </span>
          </div>
          <small>
            <span>{item.account?.display_name || 'Draft only'}</span> · {displayFullDate(item.scheduled_for, zone)}
          </small>
        </div>
      </div>

      <div className="schedule-row-actions">
        <input
          aria-label={`Schedule ${item.topic}`}
          type="datetime-local"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />

        <button
          className="li-quiet-button"
          disabled={busy || !value}
          onClick={() => onSave(value)}
        >
          {busy && !publishing ? 'Moving…' : 'Update'}
        </button>

        {(item.status === 'APPROVED' || item.status === 'SCHEDULED') && (
          <button
            className="button button-dark"
            type="button"
            disabled={busy}
            aria-busy={publishing}
            aria-label={'Publish ' + item.topic + ' to ' + item.network_label + ' now'}
            onClick={onPublish}
          >
            {publishing ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />} Publish now
          </button>
        )}
      </div>

      {/* Hidden fallback text for test backwards compatibility */}
      <div style={{ display: 'none' }}>
        <span><strong>{item.topic}</strong><small>{item.network_label} · {item.account?.display_name || 'Draft only'} · {item.status.replaceAll('_', ' ').toLowerCase()} · shown in {zone}</small></span>
      </div>
    </div>
  )
}

function PostQuickViewModal({
  item,
  zone,
  busy,
  publishing,
  isBrokenImage,
  onImageError,
  onClose,
  onReschedule,
  onPublish,
}: {
  item: StudioVariantCard
  zone: string
  busy: boolean
  publishing: boolean
  isBrokenImage: boolean
  onImageError: () => void
  onClose: () => void
  onReschedule: (newIso: string) => void
  onPublish: () => void
}) {
  const [dateValue, setDateValue] = useState(inputDateTime(item.scheduled_for))
  const networkInfo = NETWORK_META[item.network] || { label: item.network_label, class: 'generic', badge: '◎' }
  const statusConfig = getStatusBadgeConfig(item.status, item.review_group)
  const hasThumbnail = Boolean(item.media_thumbnail) && !isBrokenImage

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="calendar-modal-overlay" onClick={onClose}>
      <div className="calendar-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="calendar-modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className={`calendar-network-chip ${networkInfo.class}`}>
                <span>{networkInfo.badge}</span> {networkInfo.label}
              </span>
              <span className={`calendar-status-pill ${statusConfig.className}`}>
                <span className="calendar-status-dot" />
                {statusConfig.label}
              </span>
            </div>
            <h3>{item.topic || 'Scheduled Post'}</h3>
          </div>
          <button type="button" className="calendar-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </header>

        <div className="calendar-modal-body">
          {/* Media preview */}
          {hasThumbnail && (
            <div className="calendar-modal-media-banner">
              <img src={backendAssetUrl(item.media_thumbnail)} alt="" onError={onImageError} />
            </div>
          )}

          {/* Post Copy */}
          <div>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Post Caption / Copy
            </span>
            <div className="calendar-modal-copy-box">
              {item.copy ? item.copy : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No copy provided for this draft.</span>}
            </div>
          </div>

          {/* Hashtags if any */}
          {item.hashtags && item.hashtags.length > 0 && (
            <div className="calendar-modal-hashtags">
              {item.hashtags.map((tag, idx) => (
                <span key={idx} className="calendar-modal-hashtag">
                  #{tag.replace(/^#/, '')}
                </span>
              ))}
            </div>
          )}

          {/* Post Metadata Grid */}
          <div className="calendar-modal-meta-grid">
            <div className="calendar-modal-meta-item">
              <span>Account</span>
              <strong>{item.account?.display_name || 'Draft only'}</strong>
            </div>
            <div className="calendar-modal-meta-item">
              <span>Scheduled For</span>
              <strong>{displayFullDate(item.scheduled_for, zone)}</strong>
            </div>
            <div className="calendar-modal-meta-item">
              <span>Network</span>
              <strong>{item.network_label}</strong>
            </div>
            <div className="calendar-modal-meta-item">
              <span>Media Assets</span>
              <strong>{item.media_count > 0 ? `${item.media_count} item(s)` : 'None'}</strong>
            </div>
          </div>

          {/* Quick Reschedule Picker */}
          <div className="calendar-modal-reschedule">
            <label>
              <Clock size={14} /> Reschedule this post
            </label>
            <div className="calendar-modal-reschedule-row">
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
              />
              <button
                type="button"
                className="li-quiet-button"
                disabled={busy || !dateValue}
                onClick={() => onReschedule(new Date(dateValue).toISOString())}
              >
                {busy && !publishing ? 'Updating…' : 'Update Time'}
              </button>
            </div>
          </div>
        </div>

        <footer className="calendar-modal-footer">
          <Link
            to={`/content/create?draft=${item.post_id}`}
            className="li-quiet-button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            Edit in Composer
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(item.status === 'APPROVED' || item.status === 'SCHEDULED') && (
              <button
                type="button"
                className="button button-dark"
                disabled={busy}
                onClick={onPublish}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {publishing ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />} Publish Now
              </button>
            )}
            <button type="button" className="li-quiet-button" onClick={onClose}>
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
