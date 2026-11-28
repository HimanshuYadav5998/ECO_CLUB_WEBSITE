import { navigateTo } from '../data/api'

export default function EventCard({ event, status, highlighted = false }) {
  const palette = Array.from(String(event.id ?? event.title)).reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 0)
  const formatTime = value => new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const photoTotal = Number(event.photoCount || 0) + (Array.isArray(event.photos) ? event.photos.length : 0)
  const albumTotal = Number(event.albumCount || 0)
  const achieveTotal = Number(event.achievementCount || 0)
  const hasInterconnections = !event.source && (photoTotal > 0 || albumTotal > 0 || achieveTotal > 0)

  return (
    <article
      id={`event-${event.id}`}
      className={`${status ? 'event-tile' : 'agenda-entry'}${highlighted ? ' event-highlighted' : ''}`}
    >
      <div className={status ? 'tile-cover' : 'agenda-date'} style={status ? { '--hue': palette % 360, '--sun-x': (48 + palette % 40) + '%' } : undefined}>
        {status && event.cover && <img src={event.cover} alt="" loading="lazy" onError={e => { e.currentTarget.hidden = true }} />}
        {event.date && <time dateTime={event.date}>
          {new Date(event.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </time>}
      </div>
      <div className={status ? 'tile-body' : undefined}>
        <small>{status || (event.source ? 'UN observance' : 'Club event')}</small>
        <h3>{event.title}</h3>
        {event.start && event.end && <p>{formatTime(event.start)} – {formatTime(event.end)}</p>}
        {event.location && <p>{event.location}</p>}
        {event.description && <p>{event.description}</p>}
        {event.source && <a href={event.source} target="_blank" rel="noopener noreferrer">UN calendar ↗</a>}
        {hasInterconnections && (
          <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-stone-200/80">
            {(photoTotal > 0 || albumTotal > 0) && (
              <button
                type="button"
                onClick={() => navigateTo('gallery', { event: event.id })}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-opacity hover:opacity-85"
                style={{ backgroundColor: 'rgba(33, 78, 52, 0.1)', color: '#214E34' }}
              >
                📸 Gallery ({photoTotal}{albumTotal ? ` · ${albumTotal} albums` : ''}) ↗
              </button>
            )}
            {achieveTotal > 0 && (
              <button
                type="button"
                onClick={() => navigateTo('achievements', { event: event.id })}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-opacity hover:opacity-85"
                style={{ backgroundColor: 'rgba(197, 164, 109, 0.22)', color: '#6b4d1b' }}
              >
                🏆 Achievements ({achieveTotal}) ↗
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
