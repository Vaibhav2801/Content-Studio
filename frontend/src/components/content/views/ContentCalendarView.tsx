import { CalendarDays, ChevronLeft, ChevronRight, Clock3, List, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { contentStudioApi } from '../../../api/contentStudio'
import { contentStudioMockCalendar } from '../../../api/contentStudioMock'
import type { CalendarResponse, StudioVariantCard } from '../../../types/contentStudio'
import { useContentStudio } from '../ContentStudioContext'
import { EmptyState } from '../EmptyState'
import { backendAssetUrl, customerSafeMessage } from '../contentUtils'

const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const zonedDateKey = (value: string, zone: string) => {
  const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
const inputDateTime = (value: string) => {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
const displayTime = (value: string, zone: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: zone }).format(new Date(value))

export function ContentCalendarView() {
  const { isDemo } = useContentStudio()
  const [view, setView] = useState<'WEEK' | 'MONTH'>('WEEK')
  const [anchor, setAnchor] = useState(isoDate(new Date()))
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try { setCalendar(isDemo ? { ...structuredClone(contentStudioMockCalendar), view } : await contentStudioApi.calendar(view, anchor)) }
    catch (loadError) { setError(customerSafeMessage(loadError instanceof Error ? loadError.message : undefined, 'Could not load the calendar.')) }
  }, [anchor, isDemo, view])
  useEffect(() => { void load() }, [load])

  const days = useMemo(() => {
    if (!calendar) return []
    const result: string[] = []
    const current = new Date(`${calendar.start.slice(0, 10)}T00:00:00Z`)
    const end = new Date(`${calendar.end.slice(0, 10)}T00:00:00Z`)
    while (current < end) { result.push(isoDate(current)); current.setUTCDate(current.getUTCDate() + 1) }
    return result
  }, [calendar])

  const reschedule = async (item: StudioVariantCard, scheduledFor: string) => {
    setBusy(item.id); setError('')
    try {
      if (isDemo) setCalendar((current) => current ? { ...current, items: current.items.map((row) => row.id === item.id ? { ...row, scheduled_for: scheduledFor, status: row.status === 'APPROVED' ? 'NEEDS_REVIEW' : row.status } : row) } : current)
      else { await contentStudioApi.reschedule(item.id, scheduledFor); await load() }
    } catch (moveError) { setError(customerSafeMessage(moveError instanceof Error ? moveError.message : undefined, 'Could not move this post.')) }
    finally { setBusy('') }
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

  return <section className="studio-screen" aria-label="Publishing calendar">
    {error && <div className="li-banner error" role="alert">{error}</div>}
    <div className="calendar-toolbar"><div className="view-switch" aria-label="Calendar view"><button className={view === 'WEEK' ? 'active' : ''} aria-pressed={view === 'WEEK'} onClick={() => setView('WEEK')}>Week</button><button className={view === 'MONTH' ? 'active' : ''} aria-pressed={view === 'MONTH'} onClick={() => setView('MONTH')}>Month</button></div><span className="calendar-timezone">{calendar ? `Times shown in ${calendar.timezone}` : 'Loading timezone…'}</span><div className="calendar-period"><button aria-label="Previous period" onClick={() => movePeriod(-1)}><ChevronLeft size={16} /></button><input aria-label="Calendar date" type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} /><button aria-label="Next period" onClick={() => movePeriod(1)}><ChevronRight size={16} /></button></div></div>
    {!calendar ? <div className="li-loading" role="status">Loading calendar…</div> : calendar.items.length === 0 ? <div className="card"><EmptyState icon={CalendarDays} title="Nothing scheduled here" detail="Create or approve a post to add it to the calendar." action={{ label: 'Create a post', to: '/content/create' }} /></div> : <>
      <div className={`studio-calendar-grid ${view.toLowerCase()}`}>{days.map((day) => { const items = calendar.items.filter((item) => zonedDateKey(item.scheduled_for, calendar.timezone) === day); return <section className="calendar-drop-day" key={day} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnDay(day, event.dataTransfer.getData('text/plain'))}><header><strong>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: view === 'WEEK' ? 'long' : 'short', day: 'numeric', month: view === 'WEEK' ? 'short' : undefined })}</strong><small>{items.length || ''}</small></header>{items.map((item) => <CalendarCard item={item} zone={calendar.timezone} busy={busy === item.id} key={item.id} />)}</section> })}</div>
      <section className="card calendar-list-fallback" aria-labelledby="calendar-list-title"><header><List size={17} /><div><h3 id="calendar-list-title">Schedule list</h3><p>Keyboard-friendly alternative for changing dates and times.</p></div></header><div className="schedule-list">{calendar.items.map((item) => <ScheduleRow item={item} zone={calendar.timezone} busy={busy === item.id} onSave={(value) => void reschedule(item, new Date(value).toISOString())} key={item.id} />)}</div></section>
    </>}
  </section>
}

function CalendarCard({ item, zone, busy }: { item: StudioVariantCard; zone: string; busy: boolean }) {
  return <Link draggable className="calendar-post-card" to={`/content/create?draft=${item.post_id}`} onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}>{item.media_thumbnail ? <img src={backendAssetUrl(item.media_thumbnail)} alt="" /> : <span className="calendar-network">{item.network === 'LINKEDIN' ? 'in' : item.network === 'INSTAGRAM' ? '◎' : 'X'}</span>}<div><strong>{item.topic}</strong><small>{displayTime(item.scheduled_for, zone)} · {item.account?.display_name || 'Draft only'}</small><span>{item.network_label} · {item.status.replaceAll('_', ' ')}</span></div>{busy && <LoaderCircle className="spin" size={15} />}</Link>
}

function ScheduleRow({ item, zone, busy, onSave }: { item: StudioVariantCard; zone: string; busy: boolean; onSave: (value: string) => void }) {
  const [value, setValue] = useState(inputDateTime(item.scheduled_for))
  useEffect(() => setValue(inputDateTime(item.scheduled_for)), [item.scheduled_for])
  return <div className="schedule-row"><Clock3 size={16} /><span><strong>{item.topic}</strong><small>{item.network_label} · {item.account?.display_name || 'Draft only'} · shown in {zone}</small></span><input aria-label={`Schedule ${item.topic}`} type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} /><button className="li-quiet-button" disabled={busy || !value} onClick={() => onSave(value)}>{busy ? 'Moving…' : 'Update'}</button></div>
}
