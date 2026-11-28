import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { showToast } from '../data/toast'
import { getHashParts, navigateTo } from '../data/api'
import { filterPhotos, getCategories, getYears } from '../data/gallery'

const FOREST = '#214E34'
const IVORY = '#F8F7F2'
const OLIVE = '#8A9A5B'
const GOLD = '#C5A46D'

const headingFont = '"DM Serif Text", Georgia, serif'
const bodyFont = '"DM Sans", "Segoe UI", sans-serif'

const safe = arr => (Array.isArray(arr) ? arr : [])

function isEmbedUrl(url = '') {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url)
}

function toEmbedUrl(url = '') {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`
  const vmMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}?autoplay=1`
  return url
}

function EmptyState({ icon, title, message, actionLabel, onAction }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-6 rounded-2xl text-center"
      style={{ border: `2px dashed ${OLIVE}55`, backgroundColor: '#fffdf8' }}
    >
      <span className="text-4xl mb-3" aria-hidden="true">{icon}</span>
      <h3 className="text-xl mb-1" style={{ fontFamily: headingFont, color: FOREST }}>{title}</h3>
      <p className="text-sm max-w-md mb-4" style={{ color: '#5f5a4f' }}>{message}</p>
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

function GalleryImageInner({ src, alt, className = '', style = {} }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 text-center ${className}`}
        style={{ backgroundColor: '#ebe5d7', color: '#5f5a4f', minHeight: '11rem', ...style }}
      >
        <span className="text-3xl mb-1" aria-hidden="true">🌿</span>
        <span className="text-xs">{alt || 'Image unavailable'}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt || 'Eco Club gallery photo'}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={`${className} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-60'}`}
      style={style}
    />
  )
}

function GalleryImage(props) {
  return <GalleryImageInner key={props.src || 'empty'} {...props} />
}

function ComparisonSlider({ item, onOpenEvent }) {
  const containerRef = useRef(null)
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)

  const updatePos = useCallback(clientX => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || !rect.width) return
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setPos(pct)
  }, [])

  const onPointerDown = useCallback(
    e => {
      dragging.current = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
      updatePos(e.clientX)
    },
    [updatePos]
  )

  const onPointerMove = useCallback(
    e => {
      if (!dragging.current) return
      updatePos(e.clientX)
    },
    [updatePos]
  )

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const onKeyDown = useCallback(e => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPos(p => Math.max(0, p - 4))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPos(p => Math.min(100, p + 4))
    }
  }, [])

  return (
    <article
      className="rounded-2xl overflow-hidden border premium-card-glow"
      style={{ backgroundColor: '#fffdf8', borderColor: '#ded5c5' }}
    >
      <div
        ref={containerRef}
        className="comparison-container premium-comparison relative aspect-video select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img src={item.afterUrl} alt={`${item.title || 'Transformation'} after`} draggable={false} />
        <img
          src={item.beforeUrl}
          alt={`${item.title || 'Transformation'} before`}
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          draggable={false}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label={`Before and after comparison slider for ${item.title || 'campus transformation'}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={onKeyDown}
          className="comparison-handle"
          style={{ left: `${pos}%` }}
        />
        <span className="comparison-label before">Before</span>
        <span className="comparison-label after">After</span>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-lg font-normal" style={{ fontFamily: headingFont, color: FOREST }}>
            {item.title || 'Campus Transformation'}
          </h3>
          <div className="flex items-center gap-2">
            {item.year && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${OLIVE}26`, color: FOREST }}>
                {item.year}
              </span>
            )}
            {item.status === 'draft' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: GOLD, color: '#1b271e' }}>
                Draft
              </span>
            )}
          </div>
        </div>
        {item.description && <p className="text-sm leading-relaxed mb-3" style={{ color: '#5b564b' }}>{item.description}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200/80">
          <div className="flex gap-1.5" role="group" aria-label="Comparison split presets">
            {[
              { label: 'Before', val: 95 },
              { label: '50 / 50', val: 50 },
              { label: 'After', val: 5 },
            ].map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setPos(preset.val)}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border cursor-pointer transition-colors"
                style={{
                  borderColor: `${OLIVE}55`,
                  backgroundColor: Math.abs(pos - preset.val) < 8 ? FOREST : 'transparent',
                  color: Math.abs(pos - preset.val) < 8 ? IVORY : FOREST,
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {item.eventId && (
            <button
              type="button"
              onClick={() => onOpenEvent(item.eventId)}
              className="text-xs font-semibold underline underline-offset-4 cursor-pointer"
              style={{ color: FOREST }}
            >
              Event: {item.eventTitle || 'View'} ↗
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function Gallery({
  events = [],
  galleryData,
  loading = false,
  apiError = '',
  onRetry,
  currentUser = null,
}) {
  const photosFromEvents = useMemo(
    () =>
      events.flatMap(ev =>
        safe(ev.photos).map((p, idx) => ({
          id: p.id || `evphoto-${ev.id}-${idx}`,
          url: p.url,
          caption: p.caption || ev.title,
          category: p.category || 'campus',
          year: p.year || (ev.date ? Number(ev.date.slice(0, 4)) : undefined),
          eventId: ev.id,
          eventTitle: ev.title,
          albumId: '',
          tags: safe(p.tags),
          status: 'published',
        }))
      ),
    [events]
  )

  const photos = useMemo(() => {
    const dbPhotos = safe(galleryData?.photos)
    const existingUrls = new Set(dbPhotos.map(p => `${p.eventId}:${p.url}`))
    const extras = photosFromEvents.filter(p => p.url && !existingUrls.has(`${p.eventId}:${p.url}`))
    return [...dbPhotos, ...extras]
  }, [galleryData?.photos, photosFromEvents])

  const albums = useMemo(() => safe(galleryData?.albums), [galleryData?.albums])
  const videos = useMemo(() => safe(galleryData?.videos), [galleryData?.videos])
  const beforeAfter = useMemo(() => safe(galleryData?.beforeAfter), [galleryData?.beforeAfter])
  const featured = useMemo(() => safe(galleryData?.featured), [galleryData?.featured])

  const [category, setCategory] = useState('all')
  const [year, setYear] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [albumFilter, setAlbumFilter] = useState('')
  const [search, setSearch] = useState('')
  const [layoutMode, setLayoutMode] = useState('masonry')

  // Sync URL hash query parameters (#gallery?event=...&album=...)
  useEffect(() => {
    function syncFromHash() {
      const { route, params } = getHashParts()
      if (route !== 'gallery') return
      setEventFilter(params.get('event') || '')
      setAlbumFilter(params.get('album') || '')
      setCategory(params.get('category') || 'all')
      setYear(params.get('year') || '')
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  // Carousel state
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [carouselPaused, setCarouselPaused] = useState(false)
  const carouselTouchX = useRef(null)

  // Lightbox viewer state
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIdx, setViewerIdx] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panStart = useRef(null)
  const touchStartX = useRef(null)

  // Video modal state
  const [videoModal, setVideoModal] = useState(null)

  // Section refs for smooth navigation
  const featuredRef = useRef(null)
  const albumsRef = useRef(null)
  const masonryRef = useRef(null)
  const beforeAfterRef = useRef(null)
  const videosRef = useRef(null)

  // Safe scroll reveal that never leaves visible content stuck hidden
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

  const categories = getCategories()
  const years = useMemo(() => getYears([...photos, ...albums, ...videos, ...beforeAfter]), [photos, albums, videos, beforeAfter])

  const filteredPhotos = useMemo(
    () => filterPhotos(photos, { category, year, eventId: eventFilter, albumId: albumFilter, search }),
    [photos, category, year, eventFilter, albumFilter, search]
  )

  const filteredAlbums = useMemo(() => {
    return albums.filter(al => {
      if (year && String(al.year || '') !== String(year)) return false
      if (eventFilter && al.eventId !== eventFilter) return false
      if (search) {
        const q = search.toLowerCase().trim()
        const match =
          (al.title || '').toLowerCase().includes(q) ||
          (al.description || '').toLowerCase().includes(q) ||
          (al.eventTitle || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [albums, year, eventFilter, search])

  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      if (category !== 'all' && (v.category || '').toLowerCase() !== category.toLowerCase()) return false
      if (year && String(v.year || '') !== String(year)) return false
      if (eventFilter && v.eventId !== eventFilter) return false
      if (search) {
        const q = search.toLowerCase().trim()
        const match =
          (v.title || '').toLowerCase().includes(q) ||
          (v.description || '').toLowerCase().includes(q) ||
          (v.eventTitle || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [videos, category, year, eventFilter, search])

  const filteredBeforeAfter = useMemo(() => {
    return beforeAfter.filter(item => {
      if (year && String(item.year || '') !== String(year)) return false
      if (eventFilter && item.eventId !== eventFilter) return false
      if (search) {
        const q = search.toLowerCase().trim()
        const match =
          (item.title || '').toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [beforeAfter, year, eventFilter, search])

  const featuredSlides = useMemo(() => {
    if (featured.length > 0) {
      return [...featured]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(f => {
          const matched = photos.find(p => p.id === f.photoId)
          return {
            id: f.id,
            photoId: f.photoId,
            url: f.url || matched?.url,
            caption: f.caption || f.photoCaption || matched?.caption || 'Featured Eco Club Moment',
            category: f.category || matched?.category || '',
            eventId: f.eventId || matched?.eventId || '',
            eventTitle: f.eventTitle || matched?.eventTitle || '',
          }
        })
        .filter(s => Boolean(s.url))
    }
    return photos.slice(0, 5)
  }, [featured, photos])

  const activeCarouselIdx = featuredSlides.length > 0 ? carouselIdx % featuredSlides.length : 0

  // Carousel auto-play
  useEffect(() => {
    if (carouselPaused || featuredSlides.length <= 1) return
    const timer = window.setInterval(() => {
      setCarouselIdx(i => (i + 1) % featuredSlides.length)
    }, 5500)
    return () => window.clearInterval(timer)
  }, [carouselPaused, featuredSlides.length])

  const goToViewerSlide = useCallback(nextIdx => {
    setViewerIdx(nextIdx)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Keyboard support for modals
  useEffect(() => {
    if (!viewerOpen && !videoModal) return
    const onKey = e => {
      if (e.key === 'Escape') {
        setViewerOpen(false)
        setVideoModal(null)
        setZoom(1)
        setPan({ x: 0, y: 0 })
      }
      if (!viewerOpen) return
      if (e.key === 'ArrowRight') {
        goToViewerSlide(Math.min(viewerIdx + 1, filteredPhotos.length - 1))
      } else if (e.key === 'ArrowLeft') {
        goToViewerSlide(Math.max(viewerIdx - 1, 0))
      } else if (e.key === '+' || e.key === '=') {
        setZoom(z => Math.min(4, Number((z + 0.35).toFixed(2))))
      } else if (e.key === '-') {
        setZoom(z => {
          const next = Math.max(1, Number((z - 0.35).toFixed(2)))
          if (next === 1) setPan({ x: 0, y: 0 })
          return next
        })
      } else if (e.key === '0') {
        setZoom(1)
        setPan({ x: 0, y: 0 })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewerOpen, videoModal, filteredPhotos.length, viewerIdx, goToViewerSlide])

  useEffect(() => {
    document.body.style.overflow = viewerOpen || videoModal ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [viewerOpen, videoModal])

  function openViewer(idx) {
    goToViewerSlide(idx)
    setViewerOpen(true)
  }

  function openFeaturedInViewer(slide) {
    const idx = filteredPhotos.findIndex(p => p.id === (slide.photoId || slide.id))
    if (idx !== -1) {
      openViewer(idx)
    } else {
      setCategory('all')
      setYear('')
      setEventFilter('')
      setAlbumFilter('')
      setSearch('')
      const allIdx = photos.findIndex(p => p.id === (slide.photoId || slide.id))
      if (allIdx !== -1) openViewer(allIdx)
    }
  }

  function handleSharePhoto(photo) {
    const shareUrl = `${window.location.origin}${window.location.pathname}#gallery${photo.eventId ? `?event=${encodeURIComponent(photo.eventId)}` : ''}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).then(
        () => showToast('Gallery share link copied to clipboard.'),
        () => showToast('Copy unavailable in this browser.', 'info')
      )
    } else {
      showToast('Share link ready in browser address bar.', 'info')
    }
  }

  function handleDownloadPhoto(photo) {
    if (!photo?.url) return
    const link = document.createElement('a')
    link.href = photo.url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.download = (photo.caption || 'eco-club-photo').replace(/[^\w.-]+/g, '_')
    document.body.appendChild(link)
    link.click()
    link.remove()
    showToast('Photo download started.')
  }

  function clearAllFilters() {
    setCategory('all')
    setYear('')
    setEventFilter('')
    setAlbumFilter('')
    setSearch('')
    navigateTo('gallery')
  }

  const hasActiveFilters = Boolean(category !== 'all' || year || eventFilter || albumFilter || search)
  const activeAlbum = albums.find(a => a.id === albumFilter)
  const activeEvent = events.find(e => e.id === eventFilter)
  const currentViewerPhoto = filteredPhotos[viewerIdx] || null

  const photoContainerClass =
    layoutMode === 'grid'
      ? 'photo-uniform-grid'
      : layoutMode === 'compact'
      ? 'photo-compact-grid'
      : 'masonry-grid'

  return (
    <div className="module-page" style={{ backgroundColor: IVORY, fontFamily: bodyFont, minHeight: '100%' }}>
      {/* ═══════ 1. NATURE-INSPIRED HERO ═══════ */}
      <header className="module-hero">
        <div className="max-w-3xl mx-auto relative z-10">
          <svg className="hero-float-icon mx-auto mb-4" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path d="M24 4c-8 6-16 14-16 24a16 16 0 0032 0c0-10-8-18-16-24z" fill="rgba(197,164,109,.28)" stroke={GOLD} strokeWidth="1.5" />
            <path d="M24 14v20M18 24c2-3 6-5 10-4" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: GOLD }}>
            Eco Club Visual Archive
          </p>
          <h1>Our Gallery</h1>
          <p className="hero-sub mx-auto">
            Moments of campus conservation, tree plantations, ecological restoration, and student action.
          </p>
          <span className="gold-line" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-7">
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: IVORY }}>
              📷 {photos.length} Photo{photos.length === 1 ? '' : 's'}
            </span>
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: IVORY }}>
              📁 {albums.length} Album{albums.length === 1 ? '' : 's'}
            </span>
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: IVORY }}>
              🔄 {beforeAfter.length} Comparison{beforeAfter.length === 1 ? '' : 's'}
            </span>
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: IVORY }}>
              🎬 {videos.length} Video{videos.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => navigateTo('admin', { tab: 'gallery' })}
              className="px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: GOLD, color: '#1b271e' }}
            >
              {currentUser ? `Manage Gallery (${currentUser.role}) ↗` : 'Admin & Upload ↗'}
            </button>
          </div>
        </div>
      </header>

      {/* ═══════ 2. GLASSMORPHISM STICKY FILTER BAR ═══════ */}
      <div className="sticky top-0 z-30 py-3.5 px-4 glass-filter-bar">
        <div className="shell space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1 min-w-[220px]" role="group" aria-label="Filter gallery by category">
              {['all', ...categories].map(c => {
                const active = category === c
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(c)}
                    className="filter-pill whitespace-nowrap"
                  >
                    {c === 'all' ? 'All Moments' : c}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by year"
                value={year}
                onChange={e => setYear(e.target.value)}
                className="filter-select cursor-pointer"
              >
                <option value="">All Years</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <select
                aria-label="Filter by event"
                value={eventFilter}
                onChange={e => setEventFilter(e.target.value)}
                className="filter-select cursor-pointer max-w-[12rem]"
              >
                <option value="">All Events</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>

              <input
                type="search"
                aria-label="Search gallery"
                placeholder="Search captions, tags..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="filter-search"
              />

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                  style={{ backgroundColor: GOLD, color: '#1b271e' }}
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>

          <div className="section-jump-bar" aria-label="Jump to gallery section">
            {featuredSlides.length > 0 && (
              <button type="button" className="jump-chip" onClick={() => featuredRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Featured <span className="chip-count">{featuredSlides.length}</span>
              </button>
            )}
            <button type="button" className="jump-chip" onClick={() => albumsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Albums <span className="chip-count">{filteredAlbums.length}</span>
            </button>
            <button type="button" className="jump-chip" onClick={() => masonryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Photos <span className="chip-count">{filteredPhotos.length}</span>
            </button>
            <button type="button" className="jump-chip" onClick={() => beforeAfterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Before &amp; After <span className="chip-count">{filteredBeforeAfter.length}</span>
            </button>
            <button type="button" className="jump-chip" onClick={() => videosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Videos <span className="chip-count">{filteredVideos.length}</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" aria-label="Loading gallery">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="h-56 shimmer-skeleton" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ═══════ 3. FEATURED MOMENTS CAROUSEL ═══════ */}
            {featuredSlides.length > 0 && (
              <section ref={featuredRef} aria-label="Featured moments">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <h2 className="section-title mb-0">
                    Featured <span className="gold-accent">Moments</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${OLIVE}22`, color: FOREST }}>
                      Slide {activeCarouselIdx + 1} / {featuredSlides.length}
                    </span>
                    {featuredSlides.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCarouselPaused(p => !p)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold border cursor-pointer"
                        style={{ borderColor: OLIVE, color: FOREST }}
                      >
                        {carouselPaused ? '▶ Resume Slideshow' : '⏸ Pause Slideshow'}
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="carousel-wrap shadow-lg"
                  onMouseEnter={() => setCarouselPaused(true)}
                  onMouseLeave={() => setCarouselPaused(false)}
                  onTouchStart={e => {
                    carouselTouchX.current = e.touches[0]?.clientX ?? null
                  }}
                  onTouchEnd={e => {
                    if (carouselTouchX.current === null || featuredSlides.length <= 1) return
                    const dx = (e.changedTouches[0]?.clientX ?? 0) - carouselTouchX.current
                    if (dx > 45) setCarouselIdx(i => (i - 1 + featuredSlides.length) % featuredSlides.length)
                    else if (dx < -45) setCarouselIdx(i => (i + 1) % featuredSlides.length)
                    carouselTouchX.current = null
                  }}
                >
                  <div
                    className="carousel-track"
                    style={{ transform: `translateX(-${activeCarouselIdx * 100}%)` }}
                  >
                    {featuredSlides.map((slide, idx) => (
                      <div key={slide.id || idx} className={`carousel-slide ${idx === activeCarouselIdx ? 'ken-burns' : ''}`}>
                        <img
                          src={slide.url}
                          alt={slide.caption || 'Featured Eco Club highlight'}
                          className="cursor-pointer"
                          onClick={() => openFeaturedInViewer(slide)}
                        />
                        <div className="slide-caption flex flex-wrap items-end justify-between gap-3">
                          <div>
                            {slide.category && (
                              <span
                                className="inline-block px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-semibold mb-2"
                                style={{ backgroundColor: GOLD, color: '#1b271e' }}
                              >
                                {slide.category}
                              </span>
                            )}
                            <p className="text-lg sm:text-xl text-white">{slide.caption}</p>
                            {slide.eventTitle && (
                              <p className="text-xs mt-1 text-white/80">Event: {slide.eventTitle}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openFeaturedInViewer(slide)}
                            className="px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                            style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: FOREST }}
                          >
                            Expand ↗
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {featuredSlides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setCarouselIdx(i => (i - 1 + featuredSlides.length) % featuredSlides.length)}
                        className="carousel-btn prev"
                        aria-label="Previous featured slide"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => setCarouselIdx(i => (i + 1) % featuredSlides.length)}
                        className="carousel-btn next"
                        aria-label="Next featured slide"
                      >
                        ›
                      </button>
                      <div className="carousel-dots">
                        {featuredSlides.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setCarouselIdx(idx)}
                            className={`carousel-dot ${idx === activeCarouselIdx ? 'active' : ''}`}
                            aria-label={`View featured slide ${idx + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {/* ═══════ 4. EVENT-WISE PHOTO ALBUMS ═══════ */}
            <section ref={albumsRef} aria-labelledby="albums-heading">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 id="albums-heading" className="section-title mb-0">
                  Event <span className="gold-accent">Albums</span>
                </h2>
                {activeAlbum && (
                  <button
                    type="button"
                    onClick={() => setAlbumFilter('')}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                    style={{ backgroundColor: FOREST, color: IVORY }}
                  >
                    Viewing Album: {activeAlbum.title} ✕
                  </button>
                )}
              </div>

              {filteredAlbums.length === 0 ? (
                <EmptyState
                  icon="📁"
                  title={albums.length === 0 ? 'No event albums published yet' : 'No matching albums'}
                  message={
                    albums.length === 0
                      ? 'Group photos by Eco Club events into curated albums from the Admin Dashboard.'
                      : 'Reset filters to view all published event albums.'
                  }
                  actionLabel={albums.length === 0 ? 'Create an Album in Admin ↗' : 'Reset Filters'}
                  onAction={albums.length === 0 ? () => navigateTo('admin', { tab: 'gallery', subtab: 'albums' }) : clearAllFilters}
                />
              ) : (
                <div className="album-grid">
                  {filteredAlbums.map(album => {
                    const count = album.photoCount ?? photos.filter(p => p.albumId === album.id).length
                    const selected = albumFilter === album.id
                    return (
                      <article
                        key={album.id}
                        className="album-card premium-album border transition-all"
                        style={{
                          borderColor: selected ? GOLD : '#d8cebd',
                          boxShadow: selected ? `0 0 0 3px ${GOLD}66` : undefined,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setAlbumFilter(selected ? '' : album.id)
                            if (!selected) setCategory('all')
                            masonryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }}
                          className="w-full h-full block text-left cursor-pointer border-0 p-0 bg-transparent"
                          aria-pressed={selected}
                        >
                          {album.coverUrl ? (
                            <GalleryImage src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: FOREST }}>
                              <span className="text-5xl" aria-hidden="true">🌿</span>
                            </div>
                          )}
                          <div className="album-info">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: GOLD, color: '#1b271e' }}>
                                {count} photo{count === 1 ? '' : 's'}
                              </span>
                              {album.year && <small>{album.year}</small>}
                            </div>
                            <h3>{album.title}</h3>
                            {album.eventTitle && <small className="block truncate">Event: {album.eventTitle}</small>}
                          </div>
                        </button>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ═══════ 5. PINTEREST-STYLE MASONRY / GRID PHOTO GALLERY ═══════ */}
            <section ref={masonryRef} aria-labelledby="masonry-heading">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <h2 id="masonry-heading" className="section-title mb-1">
                    Photo <span className="gold-accent">Masonry</span>
                  </h2>
                  {(activeAlbum || activeEvent) && (
                    <p className="text-sm" style={{ color: '#5f5a4f' }}>
                      {activeAlbum ? `Album: ${activeAlbum.title}` : ''}
                      {activeAlbum && activeEvent ? ' · ' : ''}
                      {activeEvent ? `Event: ${activeEvent.title}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-full p-0.5 border" style={{ borderColor: `${OLIVE}55`, backgroundColor: '#fffdf8' }} role="group" aria-label="Photo gallery layout">
                    {[
                      { id: 'masonry', label: 'Masonry' },
                      { id: 'grid', label: 'Grid' },
                      { id: 'compact', label: 'Compact' },
                    ].map(mode => (
                      <button
                        key={mode.id}
                        type="button"
                        aria-pressed={layoutMode === mode.id}
                        onClick={() => setLayoutMode(mode.id)}
                        className="px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors"
                        style={
                          layoutMode === mode.id
                            ? { backgroundColor: FOREST, color: IVORY }
                            : { color: FOREST }
                        }
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: OLIVE }}>
                    {filteredPhotos.length} / {photos.length}
                  </span>
                </div>
              </div>

              {filteredPhotos.length === 0 ? (
                <EmptyState
                  icon="📷"
                  title={photos.length === 0 ? 'No gallery photos published yet' : 'No matching photos found'}
                  message={
                    photos.length === 0
                      ? 'Upload authentic campus eco-drive and event photographs from the Admin Dashboard.'
                      : 'Try clearing some category, year, event, or search filters.'
                  }
                  actionLabel={photos.length === 0 ? 'Upload Photos in Admin ↗' : 'Reset All Filters'}
                  onAction={photos.length === 0 ? () => navigateTo('admin', { tab: 'gallery', subtab: 'photos' }) : clearAllFilters}
                />
              ) : (
                <div className={photoContainerClass}>
                  {filteredPhotos.map((photo, idx) => (
                    <article key={photo.id || idx} className="masonry-item premium-hover group">
                      <button
                        type="button"
                        onClick={() => openViewer(idx)}
                        className="w-full block text-left p-0 border-0 bg-transparent cursor-pointer"
                        aria-label={`View photo: ${photo.caption || 'Eco Club moment'}`}
                      >
                        <GalleryImage src={photo.url} alt={photo.caption || 'Eco Club activity'} className="w-full" />
                        <div className="masonry-overlay">
                          <div className="w-full">
                            <p className="font-semibold text-white">{photo.caption || 'Campus Moment'}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-white/80">
                              {photo.eventTitle && <span>{photo.eventTitle}</span>}
                              {photo.year && <span>• {photo.year}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                      {photo.category && <span className="category-badge">{photo.category}</span>}
                      {photo.status === 'draft' && (
                        <span
                          className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={{ backgroundColor: GOLD, color: '#1b271e' }}
                        >
                          Draft
                        </span>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* ═══════ 6. INTERACTIVE BEFORE & AFTER COMPARISON ═══════ */}
            <section ref={beforeAfterRef} aria-labelledby="before-after-heading">
              <h2 id="before-after-heading" className="section-title">
                Before &amp; <span className="gold-accent">After</span>
              </h2>
              {filteredBeforeAfter.length === 0 ? (
                <EmptyState
                  icon="🔄"
                  title="No transformation comparisons yet"
                  message="Showcase campus cleanups, garden restorations, and planting drives with an interactive comparison slider."
                  actionLabel="Add Comparison in Admin ↗"
                  onAction={() => navigateTo('admin', { tab: 'gallery', subtab: 'beforeAfter' })}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredBeforeAfter.map(item => (
                    <ComparisonSlider
                      key={item.id}
                      item={item}
                      onOpenEvent={evId => navigateTo('events', { event: evId })}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ═══════ 7. VIDEO GALLERY ═══════ */}
            <section ref={videosRef} aria-labelledby="videos-heading">
              <h2 id="videos-heading" className="section-title">
                Event Highlight <span className="gold-accent">Videos</span>
              </h2>
              {filteredVideos.length === 0 ? (
                <EmptyState
                  icon="🎬"
                  title="No highlight videos published yet"
                  message="Upload MP4/WebM highlight reels or link event recaps from the Admin Dashboard."
                  actionLabel="Add Video in Admin ↗"
                  onAction={() => navigateTo('admin', { tab: 'gallery', subtab: 'videos' })}
                />
              ) : (
                <div className="video-grid">
                  {filteredVideos.map(vid => (
                    <article key={vid.id} className="video-card premium-video relative">
                      <button
                        type="button"
                        onClick={() => setVideoModal(vid)}
                        className="w-full text-left p-0 border-0 bg-transparent cursor-pointer block"
                      >
                        <div className="video-thumb">
                          {vid.thumbnailUrl ? (
                            <GalleryImage src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: FOREST }}>
                              <span className="text-4xl" aria-hidden="true">🎬</span>
                            </div>
                          )}
                          <div className="video-play">
                            <span aria-hidden="true">▶</span>
                          </div>
                          {vid.duration && (
                            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-xs font-semibold bg-black/75 text-white">
                              {vid.duration}
                            </span>
                          )}
                        </div>
                        <div className="video-body">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {vid.category && <span className="cat-badge">{vid.category}</span>}
                            {vid.year && <span className="year-badge">{vid.year}</span>}
                          </div>
                          <h3>{vid.title}</h3>
                          {vid.description && <p className="mt-1">{vid.description}</p>}
                        </div>
                      </button>
                      {vid.eventId && (
                        <div className="px-4 pb-3">
                          <button
                            type="button"
                            onClick={() => navigateTo('events', { event: vid.eventId })}
                            className="text-xs font-semibold underline underline-offset-4 cursor-pointer"
                            style={{ color: FOREST }}
                          >
                            Event: {vid.eventTitle || 'View event'} ↗
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
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
              Explore Impact &amp; Upcoming Drives
            </h2>
            <p className="text-sm" style={{ color: '#5f5a4f' }}>
              See how these campus moments translate into measurable milestones and upcoming Eco Club gatherings.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigateTo('achievements', eventFilter ? { event: eventFilter } : {})}
              className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer"
              style={{ backgroundColor: FOREST, color: IVORY }}
            >
              View Achievements →
            </button>
            <button
              type="button"
              onClick={() => navigateTo('events', eventFilter ? { event: eventFilter } : {})}
              className="px-4 py-2 rounded-full text-sm font-semibold border cursor-pointer"
              style={{ borderColor: FOREST, color: FOREST }}
            >
              Browse Events →
            </button>
          </div>
        </section>
      </div>

      {/* ═══════ FULLSCREEN PHOTO VIEWER ═══════ */}
      {viewerOpen && currentViewerPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen photo viewer"
          className="fullscreen-viewer"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setViewerOpen(false)
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }
          }}
          onTouchStart={e => {
            touchStartX.current = e.touches[0]?.clientX ?? null
          }}
          onTouchEnd={e => {
            if (touchStartX.current === null || zoom > 1) return
            const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current
            if (dx > 50 && viewerIdx > 0) goToViewerSlide(viewerIdx - 1)
            else if (dx < -50 && viewerIdx < filteredPhotos.length - 1) goToViewerSlide(viewerIdx + 1)
            touchStartX.current = null
          }}
        >
          <div className="viewer-topbar">
            <span className="text-xs sm:text-sm font-semibold text-white/85 tabular-nums">
              {viewerIdx + 1} / {filteredPhotos.length}
            </span>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(1, Number((z - 0.35).toFixed(2))))}
                className="px-2.5 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white hover:bg-white/25 cursor-pointer"
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
                className="px-2.5 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white hover:bg-white/25 cursor-pointer"
                aria-label="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(4, Number((z + 0.35).toFixed(2))))}
                className="px-2.5 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white hover:bg-white/25 cursor-pointer"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => handleSharePhoto(currentViewerPhoto)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white hover:bg-white/25 cursor-pointer"
                aria-label="Copy link"
              >
                Share
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPhoto(currentViewerPhoto)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white hover:bg-white/25 cursor-pointer"
                aria-label="Download photo"
              >
                ⬇
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewerOpen(false)
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
                className="w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center cursor-pointer"
                aria-label="Close fullscreen viewer"
              >
                ✕
              </button>
            </div>
          </div>

          {viewerIdx > 0 && (
            <button
              type="button"
              onClick={() => goToViewerSlide(viewerIdx - 1)}
              className="viewer-nav prev"
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}
          {viewerIdx < filteredPhotos.length - 1 && (
            <button
              type="button"
              onClick={() => goToViewerSlide(viewerIdx + 1)}
              className="viewer-nav next"
              aria-label="Next photo"
            >
              ›
            </button>
          )}

          <img
            src={currentViewerPhoto.url}
            alt={currentViewerPhoto.caption || 'Gallery photo'}
            className="viewer-photo"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              cursor: zoom > 1 ? 'grab' : 'zoom-in',
            }}
            onWheel={e => {
              e.preventDefault()
              setZoom(z => {
                const next = Math.max(1, Math.min(4, Number((z + (e.deltaY > 0 ? -0.2 : 0.2)).toFixed(2))))
                if (next === 1) setPan({ x: 0, y: 0 })
                return next
              })
            }}
            onDoubleClick={() => {
              if (zoom > 1) {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              } else {
                setZoom(2)
              }
            }}
            onMouseDown={e => {
              if (zoom <= 1) return
              panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
            }}
            onMouseMove={e => {
              if (!panStart.current) return
              setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
            }}
            onMouseUp={() => {
              panStart.current = null
            }}
            draggable={false}
          />

          {filteredPhotos.length > 1 && (
            <div className="viewer-filmstrip" aria-label="Photo filmstrip">
              {filteredPhotos.map((thumb, idx) => (
                <button
                  key={thumb.id || idx}
                  type="button"
                  onClick={() => goToViewerSlide(idx)}
                  className={`viewer-thumb-btn${idx === viewerIdx ? ' active' : ''}`}
                  aria-label={`Jump to photo ${idx + 1}: ${thumb.caption || 'Moment'}`}
                >
                  <img src={thumb.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          <div className="viewer-caption flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white">{currentViewerPhoto.caption || 'Eco Club Moment'}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/75 mt-1">
                {currentViewerPhoto.category && <span className="capitalize">{currentViewerPhoto.category}</span>}
                {currentViewerPhoto.year && <span>• {currentViewerPhoto.year}</span>}
                {currentViewerPhoto.tags?.length > 0 && <span>• #{currentViewerPhoto.tags.join(' #')}</span>}
              </div>
            </div>
            {currentViewerPhoto.eventId && (
              <button
                type="button"
                onClick={() => {
                  setViewerOpen(false)
                  navigateTo('events', { event: currentViewerPhoto.eventId })
                }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: GOLD, color: '#1b271e' }}
              >
                Event: {currentViewerPhoto.eventTitle || 'View Event'} ↗
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══════ VIDEO MODAL ═══════ */}
      {videoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Video player: ${videoModal.title}`}
          className="video-modal"
          onClick={e => {
            if (e.target === e.currentTarget) setVideoModal(null)
          }}
        >
          <button
            type="button"
            onClick={() => setVideoModal(null)}
            className="viewer-close"
            aria-label="Close video player"
          >
            ✕
          </button>
          <div className="video-modal-inner">
            {isEmbedUrl(videoModal.url) ? (
              <iframe
                src={toEmbedUrl(videoModal.url)}
                title={videoModal.title}
                allowFullScreen
                allow="autoplay; fullscreen"
              />
            ) : (
              <video src={videoModal.url} controls autoPlay />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
