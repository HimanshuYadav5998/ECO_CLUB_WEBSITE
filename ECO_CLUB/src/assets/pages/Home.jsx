import Hero from '../components/Hero'
import { navigateTo } from '../data/api'

const FOREST = '#214E34'
const IVORY = '#F8F7F2'
const OLIVE = '#8A9A5B'
const GOLD = '#C5A46D'
const headingFont = '"DM Serif Text", Georgia, serif'

export default function Home({ events = [], galleryData, achieveData }) {
  const photoCount = Array.isArray(galleryData?.photos) ? galleryData.photos.length : 0
  const albumCount = Array.isArray(galleryData?.albums) ? galleryData.albums.length : 0
  const awardCount = Array.isArray(achieveData?.awards) ? achieveData.awards.length : 0
  const impactStats = Array.isArray(achieveData?.impactStats) ? achieveData.impactStats.slice(0, 4) : []

  const sections = [
    [
      'Gallery',
      'Moments from our campus activities.',
      photoCount > 0 || albumCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'}${albumCount ? ` · ${albumCount} album${albumCount === 1 ? '' : 's'}` : ''}` : '',
    ],
    [
      'About',
      'The people and ideas behind Eco Club.',
      '',
    ],
    [
      'Achievements',
      'Milestones from our work together.',
      awardCount > 0 || impactStats.length > 0 ? `${awardCount} recognition${awardCount === 1 ? '' : 's'}` : '',
    ],
  ]

  return (
    <>
      <Hero />
      <section className="shell club-index" aria-labelledby="club-index-title">
        <h2 id="club-index-title">Inside the <em>club.</em></h2>
        <div className="directory">
          {sections.map(([title, description, badge]) => (
            <a className={'club-card card-' + title.toLowerCase()} href={'#' + title.toLowerCase()} key={title}>
              {title === 'Gallery' ? (
                <div className="gallery-print" aria-hidden="true" />
              ) : <span className="card-art" aria-hidden="true" />}
              <span className="card-arrow" aria-hidden="true">↗</span>
              <div className="card-copy">
                {badge && (
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider mb-2"
                    style={
                      title === 'Gallery'
                        ? { backgroundColor: 'rgba(33, 78, 52, 0.1)', color: FOREST }
                        : { backgroundColor: 'rgba(255, 255, 255, 0.18)', color: '#fff8ed' }
                    }
                  >
                    {badge}
                  </span>
                )}
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </a>
          ))}
        </div>

        {(impactStats.length > 0 || events.length > 0) && (
          <div
            className="mt-12 p-6 sm:p-8 rounded-2xl border flex flex-wrap items-center justify-between gap-6"
            style={{ backgroundColor: '#fffdf8', borderColor: '#ded5c5' }}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.16em] font-semibold mb-1" style={{ color: OLIVE }}>
                Live Club Snapshot
              </p>
              <h3 className="text-2xl" style={{ fontFamily: headingFont, color: FOREST }}>
                Verified Campus Impact &amp; Activity
              </h3>
              <div className="flex flex-wrap gap-3 mt-4">
                {events.length > 0 && (
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: IVORY, color: FOREST, border: `1px solid ${OLIVE}44` }}>
                    📅 {events.length} Club Event{events.length === 1 ? '' : 's'}
                  </span>
                )}
                {impactStats.map(stat => (
                  <span
                    key={stat.id}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: IVORY, color: FOREST, border: `1px solid ${GOLD}66` }}
                  >
                    {stat.icon || '🌱'} {Number(stat.value || 0).toLocaleString()} {stat.unit || ''} — {stat.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigateTo('events')}
                className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: FOREST, color: IVORY }}
              >
                Events Board →
              </button>
              <button
                type="button"
                onClick={() => navigateTo('achievements')}
                className="px-4 py-2 rounded-full text-xs font-semibold border cursor-pointer"
                style={{ borderColor: FOREST, color: FOREST }}
              >
                Impact Report →
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
