import { useEffect, useRef, useState } from 'react'
import EventCard from '../components/EventCard'
import { showToast } from '../data/toast'
import { api, getHashParts, navigateTo } from '../data/api'
import { imageAddress, imageKey, natureDates } from '../data/events'
import woodland from '../events-woodland.jpg'
import homeCover from '../hero.png'

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function readDate(value) {
  if (!value) return null
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value)
  return Number.isNaN(date.getTime()) ? null : date
}

function observances(year) {
  return natureDates.map(([day, title, slug]) => ({
    id: 'un-' + slug, title, date: year + '-' + day,
    source: 'https://www.un.org/en/observances/list-days-weeks',
  }))
}

function EventEditor({ mode, banner, usedImages, onSave, onClose }) {
  const dialog = useRef(null)
  useEffect(() => {
    const panel = dialog.current
    panel.showModal()
    return () => panel.close()
  }, [])
  const creating = mode === 'create'
  const [input, setInput] = useState(creating ? '' : banner)
  const [preview, setPreview] = useState('')
  const [imageFailed, setImageFailed] = useState(false)
  const [error, setError] = useState('')
  const [start, setStart] = useState('')
  let url = ''
  try { url = imageAddress(input) } catch { /* Incomplete URL while typing. */ }
  function alreadyUsed(value) {
    return value && (creating || value !== banner) && usedImages.includes(imageKey(value))
  }

  async function submit(e) {
    e.preventDefault()
    const fields = new FormData(e.currentTarget)
    const title = fields.get('title')?.trim()
    const end = fields.get('end')
    if (creating && (!title || !start || !end || end <= start)) {
      setError('Enter an event name and an end time after the start.')
      return
    }
    if (input.trim() && (!url || preview !== url || alreadyUsed(url))) {
      setError('Choose a different image with a working preview.')
      return
    }
    const event = creating ? {
      id: 'local-' + crypto.randomUUID(), title, date: start.slice(0, 10), start, end,
      location: fields.get('location').trim(), description: fields.get('description').trim(), cover: url,
    } : null
    try {
      await onSave(event, url)
    } catch (failure) {
      setError(failure.message === 'duplicate' ? 'This picture is already used. Choose another image.' : failure.message || 'Could not save. Check browser storage and try again.')
    }
  }

  return (
    <dialog className="editor-dialog" ref={dialog} onCancel={onClose} aria-labelledby="editor-title">
      <form className="event-editor" onSubmit={submit}>
        <div className="editor-heading"><h2 id="editor-title">{creating ? 'Create a club event' : 'Change background'}</h2>
          <button type="button" onClick={onClose} aria-label="Close editor">×</button></div>
        {creating && <>
          <label>Event name<input name="title" required maxLength="120" autoFocus /></label>
          <div className="editor-dates">
            <label>Starts<input name="start" type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label>
            <label>Ends<input name="end" type="datetime-local" required min={start} /></label>
          </div>
          <label>Location<input name="location" maxLength="180" /></label>
          <label>Description<textarea name="description" rows="2" maxLength="2000" /></label>
        </>}
        <label>{creating ? 'Event cover image (optional)' : 'Background image URL'}<input type="url" value={input} autoFocus={!creating} placeholder="https://…" onChange={e => {
          setInput(e.target.value); setPreview(''); setImageFailed(false); setError('')
        }} /></label>
        <p>In Google Images, open the picture and choose “Copy image address”.</p>
        {input.trim() && (!url || imageFailed || alreadyUsed(url)) && <p role="alert">{alreadyUsed(url) ? 'This picture is already used. Choose another image.' : 'Use a public link that opens the image itself.'}</p>}
        {url && !alreadyUsed(url) && <img className="cover-preview" key={input} src={url} alt="Background preview"
          onLoad={() => setPreview(url)} onError={() => { setPreview(''); setImageFailed(true) }} />}
        {error && <p role="alert">{error}</p>}
        <p>Synced to Eco Club database when signed in as Editor/Admin, or saved locally in this browser.</p>
        <div className="editor-actions"><button className="button" type="submit">{creating ? 'Create event' : 'Save background'}</button>
          <button type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </dialog>
  )
}

export default function Events({ events = [], banner = '', imageHistory = [], saveBoard, currentUser = null, refreshAll }) {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => setToday(new Date())
    const timer = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  const [editor, setEditor] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('All')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [highlightEventId, setHighlightEventId] = useState('')
  const todayKey = dateKey(today)
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState('')
  const boardRef = useRef(null)

  useEffect(() => {
    function checkHighlight() {
      const { route, params } = getHashParts()
      if (route !== 'events') return
      const targetId = params.get('event') || ''
      setHighlightEventId(targetId)
      if (targetId) {
        requestAnimationFrame(() => {
          document.getElementById(`event-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      }
    }
    checkHighlight()
    window.addEventListener('hashchange', checkHighlight)
    return () => window.removeEventListener('hashchange', checkHighlight)
  }, [events.length])

  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const clubs = events.map(event => {
    const date = readDate(event.date)
    return { ...event, date: date ? dateKey(date) : '', source: null }
  })
  const byDate = (a, b) => a.date.localeCompare(b.date)
  const scheduled = clubs.filter(event => event.date).sort((a, b) => (a.start || a.date).localeCompare(b.start || b.date))
  const active = [], upcoming = [], past = []
  for (const event of scheduled) {
    const start = new Date(event.start || event.date + 'T00:00')
    const end = new Date(event.end || event.date + 'T23:59:59.999')
    if (start > today) upcoming.push(event)
    else if (end > today) active.push(event)
    else past.push(event)
  }
  const usedImages = [
    ...imageHistory, banner, ...events.flatMap(event => [event.cover, ...(event.photos || []).map(photo => photo?.url)]),
    new URL(woodland, document.baseURI).href, new URL(homeCover, document.baseURI).href,
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e',
  ].map(imageKey).filter(Boolean)

  async function save(event, url) {
    const canManage = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor')
    if (canManage) {
      if (event) {
        await api.createEvent(event)
      } else {
        const nextHistory = [...new Set([...usedImages, url].filter(Boolean))]
        await api.updateSettings({ banner: url, imageHistory: nextHistory })
      }
      await refreshAll?.()
      const msg = event ? 'Event saved to Eco Club database.' : 'Events background updated in database.'
      setNotice(msg)
      showToast(msg)
    } else {
      saveBoard(board => {
        const history = [...new Set([...usedImages, ...(board.imageHistory || []), imageKey(board.banner), ...board.localEvents.map(item => imageKey(item.cover))].filter(Boolean))]
        if (url && history.includes(imageKey(url)) && (event || board.banner !== url)) throw new Error('duplicate')
        if (url) history.push(imageKey(url))
        return { ...board, imageHistory: [...new Set(history)], banner: event ? board.banner : url, localEvents: event ? [...board.localEvents, event] : board.localEvents }
      })
      const msg = event ? 'Event saved in this browser.' : 'Events background updated.'
      setNotice(msg)
      showToast(msg)
    }
    setToday(new Date())
    setEditor('')
    if (event) {
      setFilter(new Date(event.end) <= new Date() ? 'Past' : 'All')
      requestAnimationFrame(() => boardRef.current?.scrollIntoView({ block: 'start' }))
    }
  }
  const lastDay = dateKey(new Date(year, monthIndex + 1, 0))
  const inMonth = [...clubs, ...observances(year)].filter(event => event.date && event.date <= lastDay && (event.end?.slice(0, 10) || event.date) >= dateKey(month)).sort(byDate)
  const onDay = (event, key) => event.date <= key && (event.end?.slice(0, 10) || event.date) >= key
  const agenda = selected ? inMonth.filter(event => onDay(event, selected)) : inMonth
  const undated = clubs.filter(event => !event.date)
  const offset = (month.getDay() + 6) % 7
  const days = new Date(year, monthIndex + 1, 0).getDate()

  function changeMonth(delta) {
    setMonth(new Date(year, monthIndex + delta, 1))
    setSelected('')
  }

  const lists = { 'Live now': active, Upcoming: upcoming, Past: past.slice().reverse() }
  const entries = Object.entries(lists).filter(([label]) => filter === 'All' || filter === label)
    .flatMap(([status, items]) => items.map(event => ({ status, event })))

  return (
    <section className="events-page">
      <header className="events-cover">
        <div className="events-intro">
          <time className="today-label" dateTime={todayKey}>{today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</time>
          <h1>Club <em>events.</em></h1>
          <p>Find your next campus gathering, or bring people together for one of your own.</p>
          <div className="board-actions">
            <button className="button" type="button" onClick={() => setEditor('create')}>+ Create event</button>
            <button
              type="button"
              onClick={() => navigateTo('admin', { tab: 'events' })}
              className="text-link"
            >
              Manage in Admin ↗
            </button>
          </div>
        </div>
        <div className="event-cover-print">
          <img key={banner} src={banner || woodland} alt="" onError={e => { if (banner && e.currentTarget.getAttribute('src') !== woodland) e.currentTarget.src = woodland }} />
          <button className="picture-action" type="button" onClick={() => setEditor('banner')}>Change background ↗</button>
        </div>
      </header>
      {editor && <EventEditor key={editor} mode={editor} banner={banner} usedImages={usedImages} onSave={save} onClose={() => setEditor('')} />}
      <p className="board-notice" role="status">{notice}</p>
      <section className="schedule-board" ref={boardRef} aria-label="Club schedule">
        <div className="schedule-bar"><h2>Event board</h2>
          <div className="board-filters" role="group" aria-label="Filter club events">
            {['All', ...Object.keys(lists)].map(label => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)}>
              {label} <span>{label === 'All' ? scheduled.length : lists[label].length}</span>
            </button>)}
          </div>
        </div>
        {entries.length ? <div className="event-tiles">{entries.map(({ event, status }) => <EventCard key={event.id} event={event} status={status} highlighted={highlightEventId === event.id} />)}</div>
          : <div className="empty-board"><div className="ticket-art" aria-hidden="true"><i /><i /></div><div>
            <h3>{filter === 'All' ? 'Plan the first event' : { 'Live now': 'No event is live right now', Upcoming: 'No upcoming events yet', Past: 'No past events yet' }[filter]}</h3>
            <p>{filter === 'All' ? 'Pick a date, add a cover and invite the club.' : 'Create an event or browse the full board.'}</p></div>
            <button type="button" onClick={() => setEditor('create')}>Create event <span aria-hidden="true">↗</span></button>
          </div>}
      </section>
      <button type="button" className="calendar-toggle" aria-expanded={calendarOpen} aria-controls="event-calendar" onClick={() => setCalendarOpen(!calendarOpen)}>
        Monthly calendar <span aria-hidden="true">{calendarOpen ? '−' : '+'}</span>
      </button>
      <div id="event-calendar" className="event-desk" hidden={!calendarOpen}>
        <section aria-label="Monthly calendar" className="month-panel">
          <div className="month-bar">
            <h2 aria-live="polite">{monthLabel}</h2>
            <div>
              <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>←</button>
              <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>→</button>
            </div>
          </div>
          <div className="month-grid">
            {weekdays.map(day => <small key={day}>{day}</small>)}
            {Array.from({ length: offset }, (_, i) => <span key={'space-' + i} />)}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1
              const key = dateKey(new Date(year, monthIndex, day))
              const items = inMonth.filter(event => onDay(event, key))
              return items.length ? (
                <button type="button" key={key} aria-pressed={selected === key} aria-label={key + ': ' + items.map(event => event.title).join(', ')}
                  onClick={() => setSelected(selected === key ? '' : key)}>{day}</button>
              ) : <span key={key} aria-current={key === todayKey ? 'date' : undefined}>{day}</span>
            })}
          </div>
          <p className="calendar-key">Marked dates have events</p>
        </section>
        <section className="agenda-panel" aria-live="polite">
          <div className="agenda-heading">
            <h2>{selected ? readDate(selected).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : 'Month at a glance'}</h2>
            {selected && <button type="button" onClick={() => setSelected('')}>Show month</button>}
          </div>
          {agenda.map(event => <EventCard key={event.id} event={event} highlighted={highlightEventId === event.id} />)}
          {!agenda.length && <p>No dates listed for {monthLabel}.</p>}
          {!events.length && <p className="club-notice">Club events will appear here when announced.</p>}
        </section>
      </div>
      {undated.length > 0 && <section className="agenda-panel"><h2>Dates to be confirmed</h2><div className="event-tiles">{undated.map(event => <EventCard key={event.id} event={event} status="Date pending" highlighted={highlightEventId === event.id} />)}</div></section>}
    </section>
  )
}
