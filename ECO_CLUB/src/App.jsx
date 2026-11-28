import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import Navbar from './assets/components/Navbar'
import Footer from './assets/components/Footer'
import ToastHost from './assets/components/ToastHost'
import Home from './assets/pages/Home'
import About from './assets/pages/About'
import Events from './assets/pages/Events'
import Gallery from './assets/pages/Gallery'
import Achievement from './assets/pages/Achievement'
import { api, getHashParts } from './assets/data/api'
import { events, achievements, readClubBoard, writeClubBoard } from './assets/data/events'
import { team, socialLinks } from './assets/data/team'
import { galleryStorage } from './assets/data/gallery'
import { achievementsStorage } from './assets/data/achievements'
import './App.css'

const Admin = lazy(() => import('./assets/pages/Admin'))

const pages = { Home, About, Events, Gallery, Achievements: Achievement, Admin }
const names = Object.keys(pages)
const localData = { events, achievements, team, socialLinks }

function currentPage() {
  const { route } = getHashParts()
  return names.find(name => name.toLowerCase() === route) || 'Home'
}

function AdminLoadingFallback() {
  return (
    <div className="page-content space-y-5 py-12" aria-busy="true" aria-label="Loading admin portal">
      <div className="h-12 w-64 shimmer-skeleton" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-28 shimmer-skeleton" />
        <div className="h-28 shimmer-skeleton" />
        <div className="h-28 shimmer-skeleton" />
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState(currentPage)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [data, setData] = useState(localData)
  const [loadError, setLoadError] = useState(false)
  const [board, setBoard] = useState(() => {
    try { return readClubBoard() } catch { return { localEvents: [], banner: '', imageHistory: [] } }
  })

  // Backend state
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [backendAvailable, setBackendAvailable] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [dbEvents, setDbEvents] = useState([])
  const [dbBanner, setDbBanner] = useState('')
  const [dbImageHistory, setDbImageHistory] = useState([])
  const [galleryData, setGalleryData] = useState(() => galleryStorage.read())
  const [achieveData, setAchieveData] = useState(() => achievementsStorage.read())

  function saveBoard(update) {
    const updated = update(readClubBoard())
    writeClubBoard(updated)
    setBoard(updated)
  }

  const applyBootstrap = useCallback((res) => {
    setApiError('')
    setBackendAvailable(true)
    setCurrentUser(res.user || null)
    setSetupRequired(Boolean(res.setupRequired))
    setDbEvents(Array.isArray(res.events) ? res.events : [])
    setDbImageHistory(Array.isArray(res.imageHistory) ? res.imageHistory : [])
    setDbBanner(res.banner || '')
    if (res.gallery) {
      setGalleryData(res.gallery)
      galleryStorage.write(res.gallery)
    }
    if (res.achievements) {
      setAchieveData(res.achievements)
      achievementsStorage.write(res.achievements)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    try {
      const res = await api.bootstrap()
      applyBootstrap(res)
    } catch (err) {
      if (err?.status >= 500) {
        setApiError('Unable to reach the Eco Club database right now. Showing locally cached data.')
      }
      setBackendAvailable(false)
      setGalleryData(galleryStorage.read())
      setAchieveData(achievementsStorage.read())
    } finally {
      setLoading(false)
    }
  }, [applyBootstrap])

  useEffect(() => {
    let cancelled = false
    api.bootstrap()
      .then(res => {
        if (!cancelled) applyBootstrap(res)
      })
      .catch(err => {
        if (cancelled) return
        if (err?.status >= 500) {
          setApiError('Unable to reach the Eco Club database right now. Showing locally cached data.')
        }
        setBackendAvailable(false)
        setGalleryData(galleryStorage.read())
        setAchieveData(achievementsStorage.read())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applyBootstrap])

  useEffect(() => {
    function sync() {
      try { setBoard(readClubBoard()) } catch { /* Keep the last readable board. */ }
      if (!backendAvailable) {
        try { setGalleryData(galleryStorage.read()) } catch { /* Keep last state. */ }
        try { setAchieveData(achievementsStorage.read()) } catch { /* Keep last state. */ }
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [backendAvailable])

  useEffect(() => {
    function navigate() {
      setPage(currentPage())
      const { params } = getHashParts()
      if (!params.get('event')) window.scrollTo(0, 0)
      document.querySelector('main')?.focus()
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])

  useEffect(() => {
    document.title = page + ' | Eco Club'
  }, [page])

  useEffect(() => {
    function onScroll() {
      setShowScrollTop(window.scrollY > 360)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const url = import.meta.env.VITE_CLUB_DATA_URL
    if (!url) return
    const controller = new AbortController()
    async function loadData() {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error('Club data request failed')
        const result = await response.json()
        if (!Object.keys(localData).every(key => Array.isArray(result[key]))) {
          throw new Error('Invalid club data')
        }
        setData(result)
      } catch (error) {
        if (error.name !== 'AbortError') setLoadError(true)
      }
    }
    loadData()
    return () => controller.abort()
  }, [])

  const allEvents = backendAvailable
    ? [...data.events, ...dbEvents]
    : [...data.events, ...board.localEvents]

  const activeBanner = backendAvailable ? (dbBanner || board.banner) : board.banner
  const activeHistory = backendAvailable
    ? [...new Set([...(dbImageHistory || []), ...(board.imageHistory || [])])]
    : board.imageHistory

  const Page = pages[page]
  return (
    <>
      <Navbar names={names} page={page} currentUser={currentUser} />
      <main tabIndex="-1" className="shell flex-1">
        {loadError && <p role="status">Club updates are unavailable. Showing the saved club information.</p>}
        <div key={page} className="page-enter">
          <Suspense fallback={<AdminLoadingFallback />}>
            <Page
              {...data}
              events={allEvents}
              banner={activeBanner}
              imageHistory={activeHistory}
              saveBoard={saveBoard}
              galleryData={galleryData}
              achieveData={achieveData}
              loading={loading}
              apiError={apiError}
              onRetry={refreshAll}
              currentUser={currentUser}
              setupRequired={setupRequired}
              backendAvailable={backendAvailable}
              onAuthChange={setCurrentUser}
              refreshAll={refreshAll}
            />
          </Suspense>
        </div>
      </main>
      <Footer links={data.socialLinks} />
      <ToastHost />
      <button
        type="button"
        className={`scroll-to-top${showScrollTop ? ' visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Scroll to top"
      >
        ↑
      </button>
    </>
  )
}
