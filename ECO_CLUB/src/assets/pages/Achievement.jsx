import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { showToast } from '../data/toast'
import { api, getHashParts, navigateTo } from '../data/api'
import {
  filterByCategory,
  filterByEvent,
  filterByYear,
  getAwardCategories,
  getYears,
  searchItems,
} from '../data/achievements'

const FOREST = '#214E34'
const IVORY = '#F8F7F2'
const OLIVE = '#8A9A5B'
const GOLD = '#C5A46D'

const headingFont = '"DM Serif Text", Georgia, serif'
const bodyFont = '"DM Sans", "Segoe UI", sans-serif'

const safe = arr => (Array.isArray(arr) ? arr : [])

const categoryPalette = {
  environmental: '#214E34',
  sustainability: '#3d6b4e',
  community: '#6a7d44',
  innovation: '#9c7d45',
  education: '#4f6d7a',
  leadership: '#8a5a36',
}

function getCategoryColor(cat = '') {
  return categoryPalette[cat.toLowerCase()] || OLIVE
}

function estimateReadTime(text = '') {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 180))
}

function MemberAvatarInner({ name, photoUrl }) {
  const [broken, setBroken] = useState(false)
  if (!photoUrl || broken) {
    return (
      <div className="hall-initials" aria-hidden="true">
        {(name || '?').trim().charAt(0).toUpperCase()}
      </div>
    )
  }
  return <img src={photoUrl} alt={name} loading="lazy" onError={() => setBroken(true)} />
}

function MemberAvatar(props) {
  return <MemberAvatarInner key={props.photoUrl || 'none'} {...props} />
}

function EmptyState({ emoji, title, message, actionLabel, onAction }) {
  return (
    <div
      className="text-center py-12 px-6 rounded-2xl"
      style={{ border: `2px dashed ${GOLD}88`, backgroundColor: '#fffdf8' }}
    >
      <div className="text-4xl mb-3" aria-hidden="true">{emoji}</div>
      <h3 className="text-xl mb-1" style={{ fontFamily: headingFont, color: FOREST }}>{title}</h3>
      <p className="text-sm max-w-md mx-auto mb-4" style={{ color: '#5f5a4f' }}>{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90"
          style={{ backgroundColor: FOREST, color: IVORY }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default function Achievement({
  achievements = [],
  achieveData,
  events = [],
  loading = false,
  apiError = '',
  onRetry,
  currentUser = null,
}) {
  const impactStats = useMemo(() => safe(achieveData?.impactStats), [achieveData?.impactStats])

  const awards = useMemo(() => {
    const dbAwards = safe(achieveData?.awards)
    if (!achievements.length) return dbAwards
    const ids = new Set(dbAwards.map(a => a.id))
    const legacy = achievements
      .filter(a => !ids.has(a.id))
      .map(a => ({ ...a, category: a.category || 'environmental', status: 'published' }))
    return [...dbAwards, ...legacy]
  }, [achieveData?.awards, achievements])

  const certificates = useMemo(() => safe(achieveData?.certificates), [achieveData?.certificates])
  const timeline = useMemo(() => safe(achieveData?.timeline), [achieveData?.timeline])
  const hallOfFame = useMemo(() => safe(achieveData?.hallOfFame), [achieveData?.hallOfFame])
  const stories = useMemo(() => safe(achieveData?.stories), [achieveData?.stories])

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [timelineSort, setTimelineSort] = useState('asc')

  // Interactive modals & expansions
  const [detailAward, setDetailAward] = useState(null)
  const [previewCert, setPreviewCert] = useState(null)
  const [certNotice, setCertNotice] = useState('')
  const [activeTimelineId, setActiveTimelineId] = useState('')
  const [expandedStories, setExpandedStories] = useState({})

  // Section refs for quick navigation
  const counterRef = useRef(null)
  const awardsRef = useRef(null)
  const certsRef = useRef(null)
  const timelineRef = useRef(null)
  const hallRef = useRef(null)
  const storiesRef = useRef(null)

  const [countersVisible, setCountersVisible] = useState(() =>
    typeof IntersectionObserver === 'undefined' ||
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
  )
  const [counterValues, setCounterValues] = useState({})

  // Sync URL hash query parameters (#achievements?event=...)
  useEffect(() => {
    function syncFromHash() {
      const { route, params } = getHashParts()
      if (route !== 'achievements') return
      setSelectedEvent(params.get('event') || '')
      setSelectedYear(params.get('year') || '')
      setSelectedCategory(params.get('category') || 'All')
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  // Safe scroll-reveal for sections
  useEffect(() => {
    if (loading) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || typeof IntersectionObserver === 'undefined') {
      return
    }
    const sections = Array.from(document.querySelectorAll('.module-page section'))
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    )
    sections.forEach(el => {
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight * 0.95) {
        el.classList.add('reveal-section', 'revealed')
      } else {
        el.classList.add('reveal-section')
        observer.observe(el)
      }
    })
    const safetyTimer = window.setTimeout(() => {
      sections.forEach(el => el.classList.add('revealed'))
    }, 1200)
    return () => {
      observer.disconnect()
      window.clearTimeout(safetyTimer)
    }
  }, [loading])

  // Counter IntersectionObserver
  useEffect(() => {
    const el = counterRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setCountersVisible(true)
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!countersVisible || impactStats.length === 0) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduced) return

    let rafId = 0
    const duration = 1400
    const startTime = performance.now()
    const targets = impactStats.map(s => ({ id: s.id, value: Number(s.value) || 0 }))

    const animate = now => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = {}
      for (const item of targets) {
        next[item.id] = Math.round(item.value * eased)
      }
      setCounterValues(next)
      if (progress < 1) rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [countersVisible, impactStats])

  // Keyboard close for modals
  useEffect(() => {
    if (!previewCert && !detailAward) return
    const handler = e => {
      if (e.key === 'Escape') {
        setPreviewCert(null)
        setDetailAward(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewCert, detailAward])

  const categories = getAwardCategories()
  const years = useMemo(
    () => getYears([...awards, ...certificates, ...timeline, ...hallOfFame, ...stories, ...impactStats]),
    [awards, certificates, timeline, hallOfFame, stories, impactStats]
  )

  const filteredImpactStats = useMemo(() => {
    let result = impactStats
    if (selectedYear) result = filterByYear(result, selectedYear)
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        s =>
          (s.label || '').toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q) ||
          (s.unit || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [impactStats, selectedYear, searchQuery])

  const applyFilters = useCallback(
    items => {
      let result = items
      if (selectedCategory && selectedCategory !== 'All') {
        result = filterByCategory(result, selectedCategory)
      }
      if (selectedYear) {
        result = filterByYear(result, selectedYear)
      }
      if (selectedEvent) {
        result = filterByEvent(result, selectedEvent)
      }
      if (searchQuery) {
        result = searchItems(result, searchQuery)
      }
      return result
    },
    [selectedCategory, selectedYear, selectedEvent, searchQuery]
  )

  const filteredAwards = useMemo(() => applyFilters(awards), [applyFilters, awards])
  const filteredTimeline = useMemo(() => {
    const items = applyFilters(timeline)
    return [...items].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : new Date(a.year || 0, 0).getTime()
      const db = b.date ? new Date(b.date).getTime() : new Date(b.year || 0, 0).getTime()
      return timelineSort === 'asc' ? da - db : db - da
    })
  }, [applyFilters, timeline, timelineSort])

  const filteredStories = useMemo(() => applyFilters(stories), [applyFilters, stories])

  const filteredCertificates = useMemo(() => {
    let result = certificates
    if (selectedYear) result = filterByYear(result, selectedYear)
    if (selectedEvent) result = filterByEvent(result, selectedEvent)
    if (searchQuery) result = searchItems(result, searchQuery)
    return result
  }, [certificates, selectedYear, selectedEvent, searchQuery])

  const filteredHallOfFame = useMemo(() => {
    let result = hallOfFame
    if (selectedYear) result = filterByYear(result, selectedYear)
    if (searchQuery) result = searchItems(result, searchQuery)
    return result
  }, [hallOfFame, selectedYear, searchQuery])

  async function handleCertificateDownload(cert) {
    setCertNotice('')
    try {
      const result = await api.checkCertificateDownload(cert.id)
      const link = document.createElement('a')
      link.href = result.url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.download = (cert.title || 'certificate').replace(/[^\w.-]+/g, '_')
      document.body.appendChild(link)
      link.click()
      link.remove()
      showToast(`Downloading "${cert.title}"`)
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setCertNotice(err.message)
        showToast(err.message, 'error')
      } else {
        // Fallback only if backend server is offline AND cert permits public download
        if (cert.allowDownload !== false && cert.downloadPolicy !== 'restricted') {
          const target = cert.downloadUrl || cert.imageUrl
          if (target) {
            window.open(target, '_blank', 'noopener,noreferrer')
            showToast(`Opening "${cert.title}"`)
          }
        } else {
          setCertNotice('Download is restricted for this certificate.')
          showToast('Download is restricted for this certificate.', 'error')
        }
      }
    }
  }

  function handleCopyCitation(itemTitle) {
    const shareUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || '#achievements'}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(`${itemTitle} — Eco Club Achievement (${shareUrl})`).then(
        () => showToast('Citation link copied to clipboard.'),
        () => showToast('Clipboard unavailable.', 'info')
      )
    }
  }

  function clearFilters() {
    setSelectedCategory('All')
    setSelectedYear('')
    setSelectedEvent('')
    setSearchQuery('')
    navigateTo('achievements')
  }

  const hasFilters = Boolean(selectedCategory !== 'All' || selectedYear || selectedEvent || searchQuery)
  const featuredStories = filteredStories.filter(s => s.featured)
  const regularStories = filteredStories.filter(s => !s.featured)

  return (
    <div className="module-page" style={{ backgroundColor: IVORY, fontFamily: bodyFont, minHeight: '100%' }}>
      {/* ═══════ 1. HERO SECTION ═══════ */}
      <header className="module-hero">
        <div className="max-w-3xl mx-auto relative z-10">
          <svg
            width="64"
            height="64"
            viewBox="0 0 80 80"
            fill="none"
            className="mx-auto mb-3 hero-float-icon"
            aria-hidden="true"
          >
            <path d="M25 15h30v5c0 12-6 22-15 26-9-4-15-14-15-26v-5z" fill={GOLD} opacity="0.95" />
            <path d="M20 15h-8c0 10 4 16 8 18v-18z" fill={GOLD} opacity="0.65" />
            <path d="M60 15h8c0 10-4 16-8 18v-18z" fill={GOLD} opacity="0.65" />
            <rect x="35" y="46" width="10" height="10" fill={GOLD} opacity="0.85" />
            <rect x="28" y="56" width="24" height="6" rx="2" fill={GOLD} />
          </svg>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: GOLD }}>
            Impact · Recognition · Legacy
          </p>
          <h1>Our Achievements</h1>
          <p className="hero-sub mx-auto">
            Documented environmental outcomes, awards, verified certificates, and the members driving lasting change.
          </p>
          <span className="gold-line" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-7">
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: IVORY }}>
              📊 {impactStats.length} Metric{impactStats.length === 1 ? '' : 's'}
            </span>
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: IVORY }}>
              🏆 {awards.length} Award{awards.length === 1 ? '' : 's'}
            </span>
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: IVORY }}>
              📜 {certificates.length} Certificate{certificates.length === 1 ? '' : 's'}
            </span>
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: IVORY }}>
              ⭐ {hallOfFame.length} Honoree{hallOfFame.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => navigateTo('admin', { tab: 'achievements' })}
              className="px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: GOLD, color: '#1b271e' }}
            >
              {currentUser ? `Manage Achievements (${currentUser.role}) ↗` : 'Admin & Publish ↗'}
            </button>
          </div>
        </div>
      </header>

      {/* ═══════ 2. GLASSMORPHISM STICKY FILTER BAR ═══════ */}
      <div className="sticky top-0 z-30 py-3.5 px-4 glass-filter-bar">
        <div className="shell space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1 min-w-[220px]" role="group" aria-label="Filter achievements by category">
              {['All', ...categories].map(cat => {
                const active = selectedCategory.toLowerCase() === cat.toLowerCase()
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCategory(cat)}
                    className="filter-pill whitespace-nowrap"
                  >
                    {cat}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by year"
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="filter-select cursor-pointer"
              >
                <option value="">All Years</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <select
                aria-label="Filter by event"
                value={selectedEvent}
                onChange={e => setSelectedEvent(e.target.value)}
                className="filter-select cursor-pointer max-w-[12rem]"
              >
                <option value="">All Events</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>

              <input
                type="search"
                aria-label="Search achievements"
                placeholder="Search awards, members, stories..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="filter-search"
              />

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                  style={{ backgroundColor: GOLD, color: '#1b271e' }}
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>

          <div className="section-jump-bar" aria-label="Jump to achievements section">
            <button type="button" className="jump-chip" onClick={() => counterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Impact <span className="chip-count">{filteredImpactStats.length}</span>
            </button>
            <button type="button" className="jump-chip" onClick={() => awardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Awards <span className="chip-count">{filteredAwards.length}</span>
            </button>
            <button type="button" className="jump-chip" onClick={() => certsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Certificates <span className="chip-count">{filteredCertificates.length}</span>
            </button>
            <button type="button" className="jump-chip" onClick={() => timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Timeline <span className="chip-count">{filteredTimeline.length}</span>
            </button>
            <button type="button" className="jump-chip" onClick={() => hallRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Hall of Fame <span className="chip-count">{filteredHallOfFame.length}</span>
            </button>
            <button type="button" className="jump-chip" onClick={() => storiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Stories <span className="chip-count">{filteredStories.length}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <div className="page-content space-y-16">
        {apiError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border"
            style={{ backgroundColor: '#fef6ee', borderColor: '#d9a47c', color: '#6b3316' }}
          >
            <span>{apiError}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: '#6b3316', color: '#fff' }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" aria-busy="true" aria-label="Loading achievements">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-44 shimmer-skeleton" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ═══════ 3. ENVIRONMENTAL IMPACT COUNTERS ═══════ */}
            <section ref={counterRef} aria-labelledby="impact-heading">
              <h2 id="impact-heading" className="section-title">
                Environmental <span className="gold-accent">Impact</span>
              </h2>
              {filteredImpactStats.length === 0 ? (
                <EmptyState
                  emoji="📊"
                  title={impactStats.length === 0 ? 'No verified impact metrics published yet' : 'No metrics match current filters'}
                  message={
                    impactStats.length === 0
                      ? 'Record authentic campus numbers—saplings planted, waste diverted, volunteer hours—through the Admin Dashboard.'
                      : 'Reset year or search filters to view all published environmental impact metrics.'
                  }
                  actionLabel={impactStats.length === 0 ? 'Add Impact Metric in Admin ↗' : 'Reset Filters'}
                  onAction={impactStats.length === 0 ? () => navigateTo('admin', { tab: 'achievements', subtab: 'impactStats' }) : clearFilters}
                />
              ) : (
                <div className="impact-grid">
                  {filteredImpactStats.map(stat => {
                    const targetVal = Number(stat.value || 0)
                    const displayVal = counterValues[stat.id] ?? (countersVisible ? targetVal : 0)
                    const ringRatio = targetVal > 0 ? Math.min(displayVal / targetVal, 1) : 1
                    const dashOffset = 251.3 - 251.3 * ringRatio
                    return (
                      <article key={stat.id} className="impact-card premium-card-glow">
                        <div className="impact-ring-wrap" aria-hidden="true">
                          <svg viewBox="0 0 88 88">
                            <circle className="impact-ring-bg" cx="44" cy="44" r="40" />
                            <circle
                              className="impact-ring-progress"
                              cx="44"
                              cy="44"
                              r="40"
                              style={{
                                strokeDasharray: '251.3',
                                strokeDashoffset: countersVisible ? String(dashOffset) : '251.3',
                              }}
                            />
                          </svg>
                          <span className="ring-icon">{stat.icon || '🌱'}</span>
                        </div>
                        <div className="impact-value">{Number(displayVal).toLocaleString()}</div>
                        {stat.unit && <div className="impact-unit">{stat.unit}</div>}
                        <h3 className="impact-label font-semibold" style={{ color: FOREST }}>{stat.label}</h3>
                        {stat.description && (
                          <p className="text-xs mt-1.5" style={{ color: '#6b6558' }}>{stat.description}</p>
                        )}
                        {stat.year && (
                          <span className="inline-block mt-2 text-[11px] font-semibold" style={{ color: OLIVE }}>
                            {stat.year}
                          </span>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ═══════ 4. AWARDS & RECOGNITION SHOWCASE ═══════ */}
            <section ref={awardsRef} aria-labelledby="awards-heading">
              <h2 id="awards-heading" className="section-title">
                Awards &amp; <span className="gold-accent">Recognition</span>
              </h2>
              {filteredAwards.length === 0 ? (
                <EmptyState
                  emoji="🏆"
                  title={awards.length === 0 ? 'No awards published yet' : 'No awards match current filters'}
                  message={
                    awards.length === 0
                      ? 'Publish verified Eco Club honors, sustainability recognitions, and event outcomes from Admin.'
                      : 'Reset filters to see all recorded club recognitions.'
                  }
                  actionLabel={awards.length === 0 ? 'Add Award in Admin ↗' : 'Reset Filters'}
                  onAction={awards.length === 0 ? () => navigateTo('admin', { tab: 'achievements', subtab: 'awards' }) : clearFilters}
                />
              ) : (
                <div className="award-grid pt-2">
                  {filteredAwards.map(award => (
                    <article key={award.id} className="award-card medal-card premium-card-glow flex flex-col justify-between">
                      <div>
                        <span className="award-medal" aria-hidden="true">🏆</span>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pr-10">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {award.year && <span className="year-badge">{award.year}</span>}
                            {award.category && (
                              <span
                                className="cat-badge"
                                style={{
                                  backgroundColor: `${getCategoryColor(award.category)}18`,
                                  color: getCategoryColor(award.category),
                                }}
                              >
                                {award.category}
                              </span>
                            )}
                            {award.featured && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: GOLD, color: '#1b271e' }}>
                                Featured
                              </span>
                            )}
                          </div>
                          {award.status === 'draft' && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                              Draft
                            </span>
                          )}
                        </div>
                        <h3>{award.title}</h3>
                        {award.organization && <p className="award-org">{award.organization}</p>}
                        {award.impactMetric && (
                          <p className="text-xs font-semibold mb-2 px-2.5 py-1 rounded-md inline-block" style={{ backgroundColor: IVORY, color: FOREST }}>
                            Outcome: {award.impactMetric}
                          </p>
                        )}
                        {award.description && <p className="award-desc">{award.description}</p>}
                      </div>

                      <div className="pt-4 mt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailAward(award)}
                          className="text-xs font-semibold underline underline-offset-4 cursor-pointer"
                          style={{ color: FOREST }}
                        >
                          View Details →
                        </button>
                        {award.eventId && (
                          <button
                            type="button"
                            onClick={() => navigateTo('events', { event: award.eventId })}
                            className="text-xs font-medium cursor-pointer"
                            style={{ color: OLIVE }}
                          >
                            {award.eventTitle || 'Related Event'} ↗
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* ═══════ 5. CERTIFICATES WITH PREVIEW & PERMITTED DOWNLOAD ═══════ */}
            <section ref={certsRef} aria-labelledby="certificates-heading">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 id="certificates-heading" className="section-title mb-0">
                  Verified <span className="gold-accent">Certificates</span>
                </h2>
              </div>
              {certNotice && (
                <div
                  role="status"
                  className="mb-5 p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-sm"
                  style={{ backgroundColor: '#fff8eb', borderColor: GOLD, color: '#5c4317' }}
                >
                  <span>{certNotice}</span>
                  {!currentUser && (
                    <button
                      type="button"
                      onClick={() => navigateTo('admin')}
                      className="px-3 py-1 rounded-full text-xs font-semibold cursor-pointer"
                      style={{ backgroundColor: FOREST, color: IVORY }}
                    >
                      Sign In ↗
                    </button>
                  )}
                </div>
              )}

              {filteredCertificates.length === 0 ? (
                <EmptyState
                  emoji="📜"
                  title="No certificates published yet"
                  message="Upload official eco-club certificates or PDFs and configure public, member-only, or preview-only download permissions."
                  actionLabel="Manage Certificates in Admin ↗"
                  onAction={() => navigateTo('admin', { tab: 'achievements', subtab: 'certificates' })}
                />
              ) : (
                <div className="cert-grid">
                  {filteredCertificates.map(cert => {
                    const isPdf = (cert.downloadUrl || cert.imageUrl || '').toLowerCase().endsWith('.pdf')
                    const recipient = cert.recipientName || cert.recipient
                    const policyLabel =
                      cert.downloadPolicy === 'restricted' || !cert.allowDownload
                        ? 'Preview only'
                        : cert.downloadPolicy === 'members'
                        ? 'Members download'
                        : 'Public download'

                    return (
                      <article key={cert.id} className="cert-card premium-cert flex flex-col justify-between">
                        <div>
                          <div
                            className="cert-thumb relative cursor-pointer"
                            onClick={() => setPreviewCert(cert)}
                          >
                            {cert.imageUrl ? (
                              <img src={cert.imageUrl} alt={cert.title} loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-4" style={{ backgroundColor: IVORY }}>
                                <span className="text-4xl mb-1" aria-hidden="true">{isPdf ? '📄' : '📜'}</span>
                                <span className="text-xs font-semibold" style={{ color: FOREST }}>Certificate Document</span>
                              </div>
                            )}
                            <span
                              className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                              style={{ backgroundColor: 'rgba(33,78,52,0.9)', color: IVORY }}
                            >
                              {policyLabel}
                            </span>
                          </div>
                          <div className="cert-body">
                            <h3>{cert.title}</h3>
                            {cert.issuedBy && <p>Issued by: {cert.issuedBy}</p>}
                            {recipient && <p>Recipient: {recipient}</p>}
                            {cert.year && <p className="font-semibold mt-1" style={{ color: '#9c7d45' }}>{cert.year}</p>}
                            {cert.description && <p className="mt-1">{cert.description}</p>}
                          </div>
                        </div>

                        <div className="px-4 pb-4">
                          <div className="cert-actions">
                            <button
                              type="button"
                              onClick={() => setPreviewCert(cert)}
                              className="cert-btn view flex-1"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCertificateDownload(cert)}
                              className="cert-btn download flex-1"
                              disabled={!cert.allowDownload || cert.downloadPolicy === 'restricted'}
                              style={
                                !cert.allowDownload || cert.downloadPolicy === 'restricted'
                                  ? { opacity: 0.5, cursor: 'not-allowed' }
                                  : undefined
                              }
                            >
                              {!cert.allowDownload || cert.downloadPolicy === 'restricted' ? 'Restricted' : 'Download'}
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ═══════ 6. INTERACTIVE ACHIEVEMENT TIMELINE ═══════ */}
            <section ref={timelineRef} aria-labelledby="timeline-heading">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h2 id="timeline-heading" className="section-title mb-0">
                  Interactive <span className="gold-accent">Timeline</span>
                </h2>
                {timeline.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTimelineSort(s => (s === 'asc' ? 'desc' : 'asc'))}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold border cursor-pointer"
                    style={{ borderColor: OLIVE, color: FOREST }}
                  >
                    Order: {timelineSort === 'asc' ? 'Oldest → Newest' : 'Newest → Oldest'}
                  </button>
                )}
              </div>

              {filteredTimeline.length === 0 ? (
                <EmptyState
                  emoji="📅"
                  title="No timeline milestones published yet"
                  message="Chronicle Eco Club milestones and link them to campus events from the Admin Dashboard."
                  actionLabel="Add Milestone in Admin ↗"
                  onAction={() => navigateTo('admin', { tab: 'achievements', subtab: 'timeline' })}
                />
              ) : (
                <div className="timeline-container premium max-w-4xl mx-auto">
                  <div className="timeline-line" aria-hidden="true" />
                  {(() => {
                    let lastYear = null
                    const nodes = []
                    filteredTimeline.forEach((entry, idx) => {
                      const entryYear = entry.year || (entry.date ? Number(entry.date.slice(0, 4)) : null)
                      if (entryYear && entryYear !== lastYear) {
                        lastYear = entryYear
                        nodes.push(
                          <div key={`year-${entryYear}`} className="timeline-year-marker">
                            <span>{entryYear}</span>
                          </div>
                        )
                      }
                      const isOpen = activeTimelineId === entry.id
                      const sideClass = idx % 2 === 0 ? 'timeline-left' : 'timeline-right'
                      nodes.push(
                        <div key={entry.id} className={`timeline-entry ${sideClass}`}>
                          <div className="timeline-dot" aria-hidden="true" />
                          <div className="timeline-content text-left">
                            <button
                              type="button"
                              onClick={() => setActiveTimelineId(isOpen ? '' : entry.id)}
                              className="w-full text-left bg-transparent border-0 p-0 cursor-pointer"
                              aria-expanded={isOpen}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                <time dateTime={entry.date || String(entryYear || '')}>
                                  {entry.date
                                    ? new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                      })
                                    : entryYear || 'Milestone'}
                                </time>
                                <div className="flex items-center gap-1.5">
                                  {entry.category && <span className="cat-badge">{entry.category}</span>}
                                  <span className="text-xs font-bold" style={{ color: OLIVE }} aria-hidden="true">
                                    {isOpen ? '−' : '+'}
                                  </span>
                                </div>
                              </div>
                              <h3>{entry.title}</h3>
                            </button>
                            {entry.description && (
                              <p>{!isOpen && entry.description.length > 140 ? `${entry.description.slice(0, 140)}…` : entry.description}</p>
                            )}
                            {isOpen && (
                              <div className="mt-3 pt-2.5 border-t border-stone-200 flex flex-wrap items-center gap-3 text-xs font-semibold">
                                {entry.eventId ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => navigateTo('events', { event: entry.eventId })}
                                      className="underline underline-offset-4 cursor-pointer"
                                      style={{ color: FOREST }}
                                    >
                                      Event: {entry.eventTitle || 'View Event'} ↗
                                    </button>
                                    {entry.galleryCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => navigateTo('gallery', { event: entry.eventId })}
                                        className="underline underline-offset-4 cursor-pointer"
                                        style={{ color: OLIVE }}
                                      >
                                        {entry.galleryCount} Event Photo{entry.galleryCount === 1 ? '' : 's'} ↗
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ color: '#6b6558' }}>Recorded milestone in Eco Club archive</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                    return nodes
                  })()}
                </div>
              )}
            </section>

            {/* ═══════ 7. HALL OF FAME ═══════ */}
            <section ref={hallRef} aria-labelledby="hall-heading">
              <h2 id="hall-heading" className="section-title">
                Hall of <span className="gold-accent">Fame</span>
              </h2>
              {filteredHallOfFame.length === 0 ? (
                <EmptyState
                  emoji="⭐"
                  title="No Hall of Fame honorees yet"
                  message="Recognize student organizers, faculty mentors, and environmental stewards in the Hall of Fame."
                  actionLabel="Add Honoree in Admin ↗"
                  onAction={() => navigateTo('admin', { tab: 'achievements', subtab: 'hallOfFame' })}
                />
              ) : (
                <div className="hall-grid">
                  {filteredHallOfFame.map(member => (
                    <article key={member.id} className="hall-card premium premium-card-glow">
                      <div className="hall-avatar">
                        <MemberAvatar name={member.name} photoUrl={member.photoUrl} />
                      </div>
                      <h3>{member.name}</h3>
                      {member.role && <p className="hall-role">{member.role}</p>}
                      <div className="flex items-center justify-center gap-2 mt-1">
                        {member.year && <span className="year-badge">{member.year}</span>}
                        {member.honorBadge && <span className="cat-badge">{member.honorBadge}</span>}
                      </div>
                      {member.contribution && <p className="hall-contrib">{member.contribution}</p>}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* ═══════ 8. FEATURED ACHIEVEMENTS & SUCCESS STORIES ═══════ */}
            <section ref={storiesRef} aria-labelledby="stories-heading">
              <h2 id="stories-heading" className="section-title">
                Success <span className="gold-accent">Stories</span>
              </h2>
              {filteredStories.length === 0 ? (
                <EmptyState
                  emoji="📖"
                  title="No success stories published yet"
                  message="Document long-form case studies and community reflections behind Eco Club milestones."
                  actionLabel="Write Story in Admin ↗"
                  onAction={() => navigateTo('admin', { tab: 'achievements', subtab: 'stories' })}
                />
              ) : (
                <div className="story-grid">
                  {featuredStories.map(story => {
                    const expanded = Boolean(expandedStories[story.id])
                    const content = story.content || ''
                    const author = story.authorName || story.author
                    const readMins = estimateReadTime(content)
                    return (
                      <article key={story.id} className="story-card featured premium-story">
                        {story.imageUrl && (
                          <div className="story-img">
                            <img src={story.imageUrl} alt={story.title} loading="lazy" />
                          </div>
                        )}
                        <div className="story-body flex flex-col justify-center">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span
                              className="inline-block px-3 py-0.5 rounded-full text-xs font-bold"
                              style={{ backgroundColor: GOLD, color: '#1b271e' }}
                            >
                              ★ Featured Story
                            </span>
                            <span className="text-xs font-semibold" style={{ color: OLIVE }}>
                              {readMins} min read
                            </span>
                          </div>
                          <h3 className="text-2xl">{story.title}</h3>
                          <div className="story-meta">
                            {author && <span>By {author}</span>}
                            {story.year && <span>• {story.year}</span>}
                            {story.category && <span className="capitalize">• {story.category}</span>}
                          </div>
                          <p>{expanded || content.length <= 280 ? content : content.slice(0, 280) + '…'}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-3">
                            {content.length > 280 && (
                              <button
                                type="button"
                                className="read-more mt-0"
                                onClick={() => setExpandedStories(p => ({ ...p, [story.id]: !p[story.id] }))}
                              >
                                {expanded ? 'Show less' : 'Read full story'}
                              </button>
                            )}
                            {story.eventId && (
                              <button
                                type="button"
                                onClick={() => navigateTo('events', { event: story.eventId })}
                                className="text-xs font-semibold underline underline-offset-4 cursor-pointer"
                                style={{ color: OLIVE }}
                              >
                                Related Event: {story.eventTitle || 'View'} ↗
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  })}

                  {regularStories.map(story => {
                    const expanded = Boolean(expandedStories[story.id])
                    const content = story.content || ''
                    const author = story.authorName || story.author
                    return (
                      <article key={story.id} className="story-card premium-card-glow">
                        {story.imageUrl && (
                          <div className="story-img">
                            <img src={story.imageUrl} alt={story.title} loading="lazy" />
                          </div>
                        )}
                        <div className="story-body">
                          <div className="story-meta">
                            {story.category && <span className="cat-badge">{story.category}</span>}
                            {story.year && <span className="year-badge">{story.year}</span>}
                          </div>
                          <h3>{story.title}</h3>
                          {author && <p className="text-xs mb-2" style={{ color: '#7b7466' }}>By {author}</p>}
                          <p>{expanded || content.length <= 160 ? content : content.slice(0, 160) + '…'}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                            {content.length > 160 && (
                              <button
                                type="button"
                                className="read-more mt-0"
                                onClick={() => setExpandedStories(p => ({ ...p, [story.id]: !p[story.id] }))}
                              >
                                {expanded ? 'Show less' : 'Read more'}
                              </button>
                            )}
                            {story.eventId && (
                              <button
                                type="button"
                                onClick={() => navigateTo('events', { event: story.eventId })}
                                className="text-xs font-semibold underline underline-offset-4 cursor-pointer"
                                style={{ color: OLIVE }}
                              >
                                Event ↗
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* ═══════ INTERCONNECTED CTA BAND ═══════ */}
        <section
          className="rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 border"
          style={{ backgroundColor: '#fffdf8', borderColor: '#d8cebd' }}
        >
          <div>
            <h2 className="text-2xl mb-1" style={{ fontFamily: headingFont, color: FOREST }}>
              See the Visual Moments &amp; Upcoming Drives
            </h2>
            <p className="text-sm" style={{ color: '#5f5a4f' }}>
              Explore event photo albums, before-and-after restorations, or join the next Eco Club activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigateTo('gallery', selectedEvent ? { event: selectedEvent } : {})}
              className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer"
              style={{ backgroundColor: FOREST, color: IVORY }}
            >
              Open Gallery →
            </button>
            <button
              type="button"
              onClick={() => navigateTo('events', selectedEvent ? { event: selectedEvent } : {})}
              className="px-4 py-2 rounded-full text-sm font-semibold border cursor-pointer"
              style={{ borderColor: FOREST, color: FOREST }}
            >
              View Events →
            </button>
          </div>
        </section>
      </div>

      {/* ═══════ AWARD DETAIL MODAL ═══════ */}
      {detailAward && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Achievement details: ${detailAward.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 22, 18, 0.78)' }}
          onClick={e => {
            if (e.target === e.currentTarget) setDetailAward(null)
          }}
        >
          <div className="max-w-lg w-full rounded-2xl p-6 sm:p-8 relative shadow-2xl page-enter" style={{ backgroundColor: IVORY }}>
            <button
              type="button"
              onClick={() => setDetailAward(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center border border-stone-300 cursor-pointer"
              aria-label="Close detail dialog"
            >
              ✕
            </button>
            <div className="flex flex-wrap gap-2 mb-3">
              {detailAward.year && <span className="year-badge">{detailAward.year}</span>}
              {detailAward.category && <span className="cat-badge">{detailAward.category}</span>}
            </div>
            <h3 className="text-2xl mb-1" style={{ fontFamily: headingFont, color: FOREST }}>
              {detailAward.title}
            </h3>
            {detailAward.organization && (
              <p className="text-sm font-semibold mb-3" style={{ color: '#9c7d45' }}>
                {detailAward.organization}
              </p>
            )}
            {detailAward.recipient && (
              <p className="text-xs mb-2" style={{ color: '#5f5a4f' }}>
                <strong>Recipient:</strong> {detailAward.recipient}
              </p>
            )}
            {detailAward.impactMetric && (
              <p className="text-xs mb-3 px-3 py-1.5 rounded-lg font-semibold" style={{ backgroundColor: '#fff', color: FOREST }}>
                Measured Outcome: {detailAward.impactMetric}
              </p>
            )}
            {detailAward.description && (
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#454138' }}>
                {detailAward.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-stone-300">
              <button
                type="button"
                onClick={() => handleCopyCitation(detailAward.title)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold border cursor-pointer"
                style={{ borderColor: GOLD, color: '#6d5426', backgroundColor: '#fff' }}
              >
                Share Citation ↗
              </button>
              {detailAward.eventId && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailAward(null)
                      navigateTo('events', { event: detailAward.eventId })
                    }}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                    style={{ backgroundColor: FOREST, color: IVORY }}
                  >
                    View Event: {detailAward.eventTitle || 'Open'} ↗
                  </button>
                  {detailAward.galleryCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailAward(null)
                        navigateTo('gallery', { event: detailAward.eventId })
                      }}
                      className="px-4 py-1.5 rounded-full text-xs font-semibold border cursor-pointer"
                      style={{ borderColor: FOREST, color: FOREST }}
                    >
                      Event Photos ({detailAward.galleryCount}) ↗
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ CERTIFICATE PREVIEW MODAL ═══════ */}
      {previewCert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Certificate preview: ${previewCert.title}`}
          className="cert-preview p-4"
          onClick={e => {
            if (e.target === e.currentTarget) setPreviewCert(null)
          }}
        >
          <div className="max-w-4xl w-full flex flex-col items-center relative">
            <button
              type="button"
              onClick={() => setPreviewCert(null)}
              className="viewer-close"
              aria-label="Close certificate preview"
            >
              ✕
            </button>
            {(previewCert.imageUrl || '').toLowerCase().endsWith('.pdf') ||
            (!previewCert.imageUrl && (previewCert.downloadUrl || '').toLowerCase().endsWith('.pdf')) ? (
              <iframe
                src={previewCert.imageUrl || previewCert.downloadUrl}
                title={previewCert.title}
                className="w-full h-[72vh] rounded-lg bg-white"
              />
            ) : previewCert.imageUrl ? (
              <img src={previewCert.imageUrl} alt={previewCert.title} />
            ) : (
              <div className="p-12 rounded-xl bg-white text-center">
                <p style={{ color: FOREST }}>No preview image uploaded for this certificate.</p>
              </div>
            )}
            <div className="mt-4 text-center text-white">
              <h3 className="text-xl mb-1" style={{ fontFamily: headingFont }}>{previewCert.title}</h3>
              <p className="text-xs text-white/75 mb-3">
                {previewCert.issuedBy ? `Issued by ${previewCert.issuedBy}` : 'Verified Certificate'}
                {previewCert.recipientName ? ` · Recipient: ${previewCert.recipientName}` : ''}
                {previewCert.id ? ` · Verification ID: ${previewCert.id.slice(0, 12)}` : ''}
              </p>
              <button
                type="button"
                onClick={() => handleCertificateDownload(previewCert)}
                disabled={!previewCert.allowDownload || previewCert.downloadPolicy === 'restricted'}
                className="px-5 py-2 rounded-full text-sm font-semibold cursor-pointer"
                style={{
                  backgroundColor: GOLD,
                  color: '#1b271e',
                  opacity: !previewCert.allowDownload || previewCert.downloadPolicy === 'restricted' ? 0.5 : 1,
                }}
              >
                {!previewCert.allowDownload || previewCert.downloadPolicy === 'restricted'
                  ? 'Preview Only (Download Restricted)'
                  : '⬇ Download Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
