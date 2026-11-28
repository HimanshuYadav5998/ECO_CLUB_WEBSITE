import { useEffect, useState } from 'react'
import { showToast } from '../data/toast'
import { api, getHashParts, navigateTo } from '../data/api'
import { getAwardCategories } from '../data/achievements'
import { getCategories } from '../data/gallery'

const FOREST = '#214E34'
const IVORY = '#F8F7F2'
const OLIVE = '#8A9A5B'
const GOLD = '#C5A46D'
const headingFont = '"DM Serif Text", Georgia, serif'
const bodyFont = '"DM Sans", "Segoe UI", sans-serif'

const safe = arr => (Array.isArray(arr) ? arr : [])

function MediaUploadControl({ label, value, onChange, kind = 'image', accept = 'image/*', placeholder = 'https://... or drop/upload file' }) {
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [dragActive, setDragActive] = useState(false)

  async function uploadSelectedFile(file) {
    if (!file) return
    setUploading(true)
    setUploadErr('')
    try {
      const res = await api.uploadFile(file, kind)
      onChange(res.url)
      showToast(`Uploaded ${file.name}`)
    } catch (err) {
      const msg = err.message || 'Upload failed'
      setUploadErr(msg)
      showToast(msg, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    await uploadSelectedFile(file)
  }

  async function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer?.files?.[0]
    await uploadSelectedFile(file)
  }

  return (
    <div
      className={`upload-dropzone space-y-2${dragActive ? ' dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-semibold" style={{ color: FOREST }}>
          {label}
        </label>
        <span className="text-[11px]" style={{ color: '#7b7466' }}>Drag &amp; drop or browse</span>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border text-sm bg-white"
          style={{ borderColor: `${OLIVE}66` }}
        />
        <label
          className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90"
          style={{ backgroundColor: FOREST, color: IVORY }}
        >
          {uploading ? 'Uploading...' : 'Upload File'}
          <input type="file" accept={accept} onChange={handleFileChange} disabled={uploading} className="hidden" />
        </label>
      </div>
      {uploadErr && <p className="text-xs text-red-700" role="alert">{uploadErr}</p>}
      {value && !value.toLowerCase().endsWith('.pdf') && kind === 'image' && (
        <img src={value} alt="Preview" className="h-16 w-28 object-cover rounded border border-stone-300 mt-1" />
      )}
    </div>
  )
}

function AdminListToolbar({ query, onQueryChange, statusFilter, onStatusChange, total, shown }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-xl border bg-[#fffdf8]" style={{ borderColor: '#e4ddd0' }}>
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
        <input
          type="search"
          aria-label="Filter admin items"
          placeholder="Search items..."
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          className="filter-search"
        />
        <div className="inline-flex rounded-full p-0.5 border" style={{ borderColor: `${OLIVE}55` }} role="group" aria-label="Status filter">
          {['all', 'published', 'draft'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => onStatusChange(st)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize cursor-pointer"
              style={statusFilter === st ? { backgroundColor: FOREST, color: IVORY } : { color: FOREST }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>
      <span className="text-xs font-semibold" style={{ color: OLIVE }}>
        Showing {shown} of {total}
      </span>
    </div>
  )
}

function filterAdminItems(items, query, statusFilter) {
  return items.filter(item => {
    const itemStatus = item.status === 'draft' ? 'draft' : 'published'
    if (statusFilter !== 'all' && itemStatus !== statusFilter) return false
    if (query) {
      const q = query.toLowerCase().trim()
      const hay = [
        item.title,
        item.caption,
        item.name,
        item.label,
        item.organization,
        item.issuedBy,
        item.category,
        item.eventTitle,
        item.albumTitle,
        item.authorName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

function StatusBadge({ status }) {
  const published = status !== 'draft'
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase"
      style={{
        backgroundColor: published ? `${FOREST}18` : '#fef3c7',
        color: published ? FOREST : '#92400e',
      }}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

function FormModalCard({ title, onCancel, onSubmit, children, saving }) {
  return (
    <form
      onSubmit={onSubmit}
      className="p-5 rounded-2xl border mb-6 space-y-4"
      style={{ backgroundColor: '#fffdf8', borderColor: `${OLIVE}55` }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg" style={{ fontFamily: headingFont, color: FOREST }}>{title}</h3>
        <button type="button" onClick={onCancel} className="text-xs font-semibold underline cursor-pointer" style={{ color: '#6b6558' }}>
          Cancel
        </button>
      </div>
      {children}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-full text-sm font-semibold cursor-pointer"
          style={{ backgroundColor: FOREST, color: IVORY, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 rounded-full text-sm font-semibold border cursor-pointer"
          style={{ borderColor: OLIVE, color: FOREST }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function ItemRow({ thumb, title, meta, status, onTogglePublish, onEdit, onDelete, canPublish, canEdit, canDelete }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border bg-white"
      style={{ borderColor: '#e4ddd0' }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {thumb && (
          <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover flex-none border border-stone-200" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm truncate" style={{ color: FOREST }}>{title}</strong>
            <StatusBadge status={status} />
          </div>
          {meta && <p className="text-xs truncate mt-0.5" style={{ color: '#6b6558' }}>{meta}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canPublish && onTogglePublish && (
          <button
            type="button"
            onClick={onTogglePublish}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer"
            style={{ borderColor: GOLD, color: '#6d5426', backgroundColor: '#fffaf0' }}
          >
            {status === 'draft' ? 'Publish' : 'Unpublish'}
          </button>
        )}
        {canEdit && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer"
            style={{ borderColor: OLIVE, color: FOREST }}
          >
            Edit
          </button>
        )}
        {canDelete && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 cursor-pointer"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

export default function Admin({
  events = [],
  banner = '',
  galleryData,
  achieveData,
  currentUser = null,
  setupRequired = false,
  backendAvailable = true,
  onAuthChange,
  refreshAll,
}) {
  const [tab, setTab] = useState('overview')
  const [gallerySub, setGallerySub] = useState('photos')
  const [achieveSub, setAchieveSub] = useState('impactStats')

  // Auth forms state
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  // Dashboard notifications & CRUD state
  const [notice, setNotice] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({})

  // Banner & users & uploads
  const [bannerDraft, setBannerDraft] = useState(null)
  const bannerInput = bannerDraft ?? (banner || '')
  const [users, setUsers] = useState([])
  const [uploads, setUploads] = useState([])
  const [listSearch, setListSearch] = useState('')
  const [listStatus, setListStatus] = useState('all')
  const [confirmState, setConfirmState] = useState(null)

  useEffect(() => {
    if (!confirmState) return
    const onKey = e => {
      if (e.key === 'Escape') setConfirmState(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmState])

  useEffect(() => {
    function syncFromHash() {
      const { route, params } = getHashParts()
      if (route !== 'admin') return
      const t = params.get('tab')
      const sub = params.get('subtab')
      if (t && ['overview', 'events', 'gallery', 'achievements', 'uploads', 'users'].includes(t)) {
        setTab(t)
        setShowForm(false)
        setEditingItem(null)
      }
      if (sub) {
        if (t === 'gallery') setGallerySub(sub)
        if (t === 'achievements') setAchieveSub(sub)
      }
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const role = currentUser?.role || 'public'
  const canManage = role === 'admin' || role === 'editor'
  const isAdmin = role === 'admin'

  useEffect(() => {
    if (!currentUser) return
    if (tab === 'uploads') {
      api.listUploads().then(res => setUploads(res.uploads || [])).catch(() => {})
    }
    if (tab === 'users' && isAdmin) {
      api.listUsers().then(res => setUsers(res.users || [])).catch(() => {})
    }
  }, [currentUser, tab, isAdmin])

  const photos = safe(galleryData?.photos)
  const albums = safe(galleryData?.albums)
  const videos = safe(galleryData?.videos)
  const beforeAfter = safe(galleryData?.beforeAfter)
  const featured = safe(galleryData?.featured)

  const impactStats = safe(achieveData?.impactStats)
  const awards = safe(achieveData?.awards)
  const certificates = safe(achieveData?.certificates)
  const timeline = safe(achieveData?.timeline)
  const hallOfFame = safe(achieveData?.hallOfFame)
  const stories = safe(achieveData?.stories)

  async function handleAuthSubmit(e) {
    e.preventDefault()
    setAuthError('')
    setAuthBusy(true)
    try {
      let res
      if (setupRequired) {
        res = await api.setupAdmin(authForm)
      } else if (authMode === 'register') {
        res = await api.register(authForm)
      } else {
        res = await api.login({ email: authForm.email, password: authForm.password })
      }
      onAuthChange?.(res.user)
      await refreshAll?.()
      setAuthForm({ name: '', email: '', password: '' })
    } catch (err) {
      setAuthError(err.message || 'Authentication failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogout() {
    await api.logout().catch(() => {})
    onAuthChange?.(null)
    await refreshAll?.()
    setNotice('Signed out cleanly.')
    showToast('Signed out cleanly.', 'info')
  }

  function resetForm() {
    setShowForm(false)
    setEditingItem(null)
    setForm({})
    setErrorMsg('')
  }

  function startCreate(defaults = {}) {
    setEditingItem(null)
    setForm({ status: canManage ? 'published' : 'draft', year: new Date().getFullYear(), ...defaults })
    setShowForm(true)
    setErrorMsg('')
    setNotice('')
  }

  function startEdit(item, mapper) {
    setEditingItem(item)
    setForm(mapper ? mapper(item) : { ...item })
    setShowForm(true)
    setErrorMsg('')
    setNotice('')
  }

  function askConfirm(message, action) {
    setConfirmState({ message, action })
  }

  async function runAction(fn, successMsg) {
    setSaving(true)
    setErrorMsg('')
    setNotice('')
    try {
      await fn()
      await refreshAll?.()
      if (tab === 'uploads') {
        const res = await api.listUploads()
        setUploads(res.uploads || [])
      }
      if (tab === 'users' && isAdmin) {
        const res = await api.listUsers()
        setUsers(res.users || [])
      }
      setNotice(successMsg)
      showToast(successMsg)
      resetForm()
    } catch (err) {
      const msg = err.message || 'Action failed.'
      setErrorMsg(msg)
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ─── Unauthenticated / Setup View ──────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="module-page" style={{ backgroundColor: IVORY, fontFamily: bodyFont, minHeight: '100%' }}>
        <header className="module-hero">
          <div className="max-w-2xl mx-auto relative z-10">
            <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: GOLD }}>
              Role-Based Control Center
            </p>
            <h1>Eco Club Admin</h1>
            <p className="hero-sub mx-auto">
              Securely manage Events, Gallery media, Achievements, and certificate download permissions.
            </p>
            <span className="gold-line" aria-hidden="true" />
          </div>
        </header>

        <div className="page-content max-w-lg mx-auto">
          {!backendAvailable && (
            <div role="alert" className="mb-6 p-4 rounded-xl border border-amber-400 bg-amber-50 text-amber-900 text-sm">
              <strong>Backend API offline:</strong> Start the Eco Club server (`npm run dev` or `npm run server`) to enable database persistence, secure uploads, and role-based sign in.
            </div>
          )}

          <div className="p-6 sm:p-8 rounded-2xl border bg-white shadow-sm" style={{ borderColor: '#ded5c5' }}>
            {setupRequired ? (
              <>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3" style={{ backgroundColor: `${GOLD}33`, color: FOREST }}>
                  First-Time Initialization
                </span>
                <h2 className="text-2xl mb-2" style={{ fontFamily: headingFont, color: FOREST }}>
                  Create Administrator Account
                </h2>
                <p className="text-sm mb-5" style={{ color: '#5f5a4f' }}>
                  No accounts exist yet in the SQLite database. Create the primary administrator account to unlock content publishing, secure file uploads, and role management.
                </p>
              </>
            ) : (
              <>
                <div className="flex gap-2 mb-5 border-b border-stone-200 pb-3">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setAuthError('') }}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                    style={authMode === 'login' ? { backgroundColor: FOREST, color: IVORY } : { color: FOREST }}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setAuthError('') }}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                    style={authMode === 'register' ? { backgroundColor: FOREST, color: IVORY } : { color: FOREST }}
                  >
                    Member Sign Up
                  </button>
                </div>
                <h2 className="text-2xl mb-1" style={{ fontFamily: headingFont, color: FOREST }}>
                  {authMode === 'register' ? 'Join as Eco Club Member' : 'Sign In to Dashboard'}
                </h2>
                <p className="text-xs mb-5" style={{ color: '#5f5a4f' }}>
                  {authMode === 'register'
                    ? 'New accounts receive Member permissions (draft submissions & member certificate access) until promoted by an Admin.'
                    : 'Admins & Editors can publish content; Members can submit drafts and access permitted downloads.'}
                </p>
              </>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {(setupRequired || authMode === 'register') && (
                <label className="block">
                  <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Full Name</span>
                  <input
                    type="text"
                    required
                    value={authForm.name}
                    onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: `${OLIVE}88` }}
                    placeholder="e.g. Aarav Sharma"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Email Address</span>
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: `${OLIVE}88` }}
                  placeholder="coordinator@ecoclub.edu"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>
                  Password {setupRequired || authMode === 'register' ? '(min 8 characters)' : ''}
                </span>
                <input
                  type="password"
                  required
                  minLength={setupRequired || authMode === 'register' ? 8 : 1}
                  value={authForm.password}
                  onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: `${OLIVE}88` }}
                />
              </label>

              {authError && (
                <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authBusy || !backendAvailable}
                className="w-full py-2.5 rounded-full text-sm font-semibold cursor-pointer"
                style={{ backgroundColor: FOREST, color: IVORY, opacity: authBusy || !backendAvailable ? 0.6 : 1 }}
              >
                {authBusy
                  ? 'Please wait...'
                  : setupRequired
                  ? 'Create Admin & Enter Dashboard'
                  : authMode === 'register'
                  ? 'Register Member Account'
                  : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ─── Authenticated Dashboard ───────────────────────────────────────────────
  const mainTabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'events', label: `Events (${events.length})` },
    { key: 'gallery', label: `Gallery (${photos.length})` },
    { key: 'achievements', label: `Achievements (${awards.length})` },
    { key: 'uploads', label: 'Media Uploads' },
    ...(isAdmin ? [{ key: 'users', label: 'Users & Roles' }] : []),
  ]

  return (
    <div className="module-page" style={{ backgroundColor: IVORY, fontFamily: bodyFont, minHeight: '100%' }}>
      <header className="module-hero" style={{ minHeight: '15rem', paddingBlock: '2.5rem' }}>
        <div className="max-w-5xl mx-auto w-full flex flex-wrap items-center justify-between gap-4 text-left relative z-10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-1" style={{ color: GOLD }}>
              Eco Club Management Workspace
            </p>
            <h1 style={{ fontSize: 'clamp(2.1rem, 4.5vw, 3.2rem)', marginBottom: '0.25rem' }}>Admin Dashboard</h1>
            <p className="text-sm text-white/80">
              Signed in as <strong>{currentUser.name}</strong> ({currentUser.email}) · Role:{' '}
              <span className="uppercase font-bold" style={{ color: GOLD }}>{currentUser.role}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigateTo('events')} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white cursor-pointer">
              Events ↗
            </button>
            <button type="button" onClick={() => navigateTo('gallery')} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white cursor-pointer">
              Gallery ↗
            </button>
            <button type="button" onClick={() => navigateTo('achievements')} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white cursor-pointer">
              Achievements ↗
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
              style={{ backgroundColor: GOLD, color: '#1b271e' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="page-content">
        {/* Main Navigation Tabs */}
        <div className="admin-tabs">
          {mainTabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key)
                setListSearch('')
                setListStatus('all')
                resetForm()
              }}
              className={`admin-tab ${tab === t.key ? 'active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {notice && (
          <div role="status" className="mb-5 p-3.5 rounded-xl border text-sm" style={{ backgroundColor: '#eef6f0', borderColor: FOREST, color: FOREST }}>
            {notice}
          </div>
        )}
        {errorMsg && (
          <div role="alert" className="mb-5 p-3.5 rounded-xl border text-sm bg-red-50 border-red-300 text-red-800">
            {errorMsg}
          </div>
        )}

        {!canManage && (
          <div className="mb-6 p-4 rounded-xl border text-sm" style={{ backgroundColor: '#fffaf0', borderColor: GOLD, color: '#5c4317' }}>
            You are signed in as a <strong>Member</strong>. You can upload media and submit draft photos, award nominations, or stories for Editor/Admin publishing review.
          </div>
        )}

        {/* ═══════ TAB: OVERVIEW ═══════ */}
        {tab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Events', value: events.length, action: () => setTab('events') },
                { label: 'Gallery Photos', value: photos.length, action: () => setTab('gallery') },
                { label: 'Awards & Honours', value: awards.length, action: () => setTab('achievements') },
                { label: 'Impact Metrics', value: impactStats.length, action: () => { setTab('achievements'); setAchieveSub('impactStats') } },
              ].map(card => (
                <button
                  key={card.label}
                  type="button"
                  onClick={card.action}
                  className="p-5 rounded-2xl border bg-white text-left cursor-pointer premium-card-glow"
                  style={{ borderColor: '#e4ddd0' }}
                >
                  <div className="text-3xl mb-1" style={{ fontFamily: headingFont, color: FOREST }}>{card.value}</div>
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: OLIVE }}>{card.label}</div>
                </button>
              ))}
            </div>

            {(() => {
              const allItems = [
                ...events, ...photos, ...albums, ...videos, ...beforeAfter,
                ...impactStats, ...awards, ...certificates, ...timeline, ...hallOfFame, ...stories,
              ]
              const totalCount = allItems.length
              const draftCount = allItems.filter(i => i.status === 'draft').length
              const pubCount = totalCount - draftCount
              const pct = totalCount > 0 ? Math.round((pubCount / totalCount) * 100) : 0
              return (
                <div className="p-6 rounded-2xl border bg-white" style={{ borderColor: '#e4ddd0' }}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-xl" style={{ fontFamily: headingFont, color: FOREST }}>Publishing Overview</h2>
                      <p className="text-xs" style={{ color: '#5f5a4f' }}>
                        {pubCount} published · {draftCount} pending review across all modules
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${FOREST}16`, color: FOREST }}>
                      {totalCount > 0 ? `${pct}% Published` : 'Ready for Content'}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#ebe5d7' }} aria-hidden="true">
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${FOREST}, ${GOLD})` }}
                    />
                  </div>
                </div>
              )
            })()}

            <div className="p-6 rounded-2xl border bg-white" style={{ borderColor: '#e4ddd0' }}>
              <h2 className="text-xl mb-3" style={{ fontFamily: headingFont, color: FOREST }}>
                Events ↔ Gallery ↔ Achievements Interconnection
              </h2>
              {events.length === 0 ? (
                <p className="text-sm" style={{ color: '#5f5a4f' }}>
                  No events in the database yet. Create an event in the Events tab to link photo albums, highlight videos, awards, and timeline entries together.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-xs uppercase" style={{ color: OLIVE }}>
                        <th className="py-2 pr-4">Event</th>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Gallery</th>
                        <th className="py-2">Achievements</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map(ev => (
                        <tr key={ev.id} className="border-b border-stone-100">
                          <td className="py-2.5 pr-4 font-semibold" style={{ color: FOREST }}>{ev.title}</td>
                          <td className="py-2.5 pr-4 text-xs" style={{ color: '#5f5a4f' }}>{ev.date || 'TBD'}</td>
                          <td className="py-2.5 pr-4"><StatusBadge status={ev.status} /></td>
                          <td className="py-2.5 pr-4">
                            <button
                              type="button"
                              onClick={() => navigateTo('gallery', { event: ev.id })}
                              className="text-xs underline cursor-pointer"
                              style={{ color: FOREST }}
                            >
                              {ev.photoCount || 0} photos · {ev.albumCount || 0} albums
                            </button>
                          </td>
                          <td className="py-2.5">
                            <button
                              type="button"
                              onClick={() => navigateTo('achievements', { event: ev.id })}
                              className="text-xs underline cursor-pointer"
                              style={{ color: FOREST }}
                            >
                              {ev.achievementCount || 0} linked items
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ TAB: EVENTS ═══════ */}
        {tab === 'events' && (
          <div className="space-y-6">
            {canManage && (
              <div className="p-5 rounded-2xl border bg-white" style={{ borderColor: '#e4ddd0' }}>
                <h3 className="text-lg mb-2" style={{ fontFamily: headingFont, color: FOREST }}>Events Page Cover Banner</h3>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[240px]">
                    <MediaUploadControl label="Banner Image URL or Upload" value={bannerInput} onChange={setBannerDraft} kind="image" />
                  </div>
                  <button
                    type="button"
                    onClick={() => runAction(async () => { await api.updateSettings({ banner: bannerInput }); setBannerDraft(null) }, 'Events cover banner updated.')}
                    className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                    style={{ backgroundColor: FOREST, color: IVORY }}
                  >
                    Save Banner
                  </button>
                </div>
              </div>
            )}

            {canManage && !showForm && (
              <button
                type="button"
                onClick={() => startCreate({ title: '', date: '', start: '', end: '', location: '', description: '', cover: '' })}
                className="admin-add-btn"
              >
                + Add Event
              </button>
            )}

            {showForm && canManage && (
              <FormModalCard
                title={editingItem ? 'Edit Event' : 'Create Event'}
                onCancel={resetForm}
                saving={saving}
                onSubmit={e => {
                  e.preventDefault()
                  runAction(
                    () => (editingItem ? api.updateEvent(editingItem.id, form) : api.createEvent(form)),
                    editingItem ? 'Event updated.' : 'Event created.'
                  )
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Event Title *</span>
                    <input
                      required
                      value={form.title || ''}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                      style={{ borderColor: `${OLIVE}66` }}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Location</span>
                    <input
                      value={form.location || ''}
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                      style={{ borderColor: `${OLIVE}66` }}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Start Date &amp; Time</span>
                    <input
                      type="datetime-local"
                      value={form.start || ''}
                      onChange={e => setForm(f => ({ ...f, start: e.target.value, date: e.target.value.slice(0, 10) }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                      style={{ borderColor: `${OLIVE}66` }}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>End Date &amp; Time</span>
                    <input
                      type="datetime-local"
                      value={form.end || ''}
                      onChange={e => setForm(f => ({ ...f, end: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                      style={{ borderColor: `${OLIVE}66` }}
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <MediaUploadControl label="Cover Image" value={form.cover} onChange={v => setForm(f => ({ ...f, cover: v }))} />
                  </div>
                  <label className="sm:col-span-2 block">
                    <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Description</span>
                    <textarea
                      rows={3}
                      value={form.description || ''}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                      style={{ borderColor: `${OLIVE}66` }}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Publish Status</span>
                    <select
                      value={form.status || 'published'}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                      style={{ borderColor: `${OLIVE}66` }}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </label>
                </div>
              </FormModalCard>
            )}

            {(() => {
              const filtered = filterAdminItems(events, listSearch, listStatus)
              return (
                <>
                  <AdminListToolbar query={listSearch} onQueryChange={setListSearch} statusFilter={listStatus} onStatusChange={setListStatus} total={events.length} shown={filtered.length} />
                  <div className="space-y-3">
                    {filtered.map(ev => (
                      <ItemRow
                        key={ev.id}
                        thumb={ev.cover}
                        title={ev.title}
                        meta={`${ev.date || 'Date pending'}${ev.location ? ` · ${ev.location}` : ''} · ${ev.photoCount || 0} photos · ${ev.achievementCount || 0} achievements`}
                        status={ev.status}
                        canPublish={canManage}
                        canEdit={canManage}
                        canDelete={canManage}
                        onTogglePublish={() => runAction(() => api.toggleEventPublish(ev.id), 'Event visibility updated.')}
                        onEdit={() => startEdit(ev)}
                        onDelete={() => askConfirm(`Delete event "${ev.title}"?`, () => runAction(() => api.deleteEvent(ev.id), 'Event deleted.'))}
                      />
                    ))}
                    {filtered.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>{events.length === 0 ? 'No events added yet.' : 'No matching events.'}</p>}
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* ═══════ TAB: GALLERY ═══════ */}
        {tab === 'gallery' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { key: 'photos', label: `Photos (${photos.length})` },
                { key: 'albums', label: `Albums (${albums.length})` },
                { key: 'videos', label: `Videos (${videos.length})` },
                { key: 'beforeAfter', label: `Before & After (${beforeAfter.length})` },
                { key: 'featured', label: `Featured Carousel (${featured.length})` },
              ].map(sub => (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => { setGallerySub(sub.key); setListSearch(''); setListStatus('all'); resetForm() }}
                  className="filter-pill"
                  aria-pressed={gallerySub === sub.key}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Photos Subtab */}
            {gallerySub === 'photos' && (
              <div>
                {!showForm && (
                  <button
                    type="button"
                    onClick={() => startCreate({ url: '', caption: '', category: 'plantation', tags: '', eventId: '', albumId: '' })}
                    className="admin-add-btn"
                  >
                    + {canManage ? 'Add / Upload Photo' : 'Submit Draft Photo'}
                  </button>
                )}
                {showForm && (
                  <FormModalCard
                    title={editingItem ? 'Edit Gallery Photo' : 'Add Gallery Photo'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      const payload = {
                        ...form,
                        tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
                      }
                      runAction(
                        () => (editingItem ? api.updatePhoto(editingItem.id, payload) : api.createPhoto(payload)),
                        editingItem ? 'Photo updated.' : 'Photo saved.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <MediaUploadControl label="Photo File or URL *" value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} />
                      </div>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Caption</span>
                        <input value={form.caption || ''} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Category</span>
                        <select value={form.category || 'other'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          {getCategories().map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Year</span>
                        <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Tags (comma separated)</span>
                        <input value={Array.isArray(form.tags) ? form.tags.join(', ') : (form.tags || '')} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Linked Event</span>
                        <select value={form.eventId || ''} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="">None</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Album</span>
                        <select value={form.albumId || ''} onChange={e => setForm(f => ({ ...f, albumId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="">None</option>
                          {albums.map(al => <option key={al.id} value={al.id}>{al.title}</option>)}
                        </select>
                      </label>
                      {canManage && (
                        <label className="block">
                          <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Status</span>
                          <select value={form.status || 'published'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                            <option value="published">Published</option>
                            <option value="draft">Draft</option>
                          </select>
                        </label>
                      )}
                    </div>
                  </FormModalCard>
                )}

                {(() => {
                  const filtered = filterAdminItems(photos, listSearch, listStatus)
                  return (
                    <>
                      <AdminListToolbar query={listSearch} onQueryChange={setListSearch} statusFilter={listStatus} onStatusChange={setListStatus} total={photos.length} shown={filtered.length} />
                      <div className="space-y-3">
                        {filtered.map(p => (
                          <ItemRow
                            key={p.id}
                            thumb={p.url}
                            title={p.caption || 'Untitled Photo'}
                            meta={`${p.category || 'other'}${p.year ? ` · ${p.year}` : ''}${p.eventTitle ? ` · Event: ${p.eventTitle}` : ''}${p.albumTitle ? ` · Album: ${p.albumTitle}` : ''}`}
                            status={p.status}
                            canPublish={canManage}
                            canEdit={canManage}
                            canDelete={canManage}
                            onTogglePublish={() => runAction(() => api.togglePhotoPublish(p.id), 'Photo status updated.')}
                            onEdit={() => startEdit(p, item => ({ ...item, tags: (item.tags || []).join(', ') }))}
                            onDelete={() => askConfirm('Delete this photo permanently?', () => runAction(() => api.deletePhoto(p.id), 'Photo deleted.'))}
                          />
                        ))}
                        {filtered.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>{photos.length === 0 ? 'No photos uploaded yet.' : 'No matching photos.'}</p>}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {/* Albums Subtab */}
            {gallerySub === 'albums' && (
              <div>
                {canManage && !showForm && (
                  <button type="button" onClick={() => startCreate({ title: '', description: '', coverUrl: '', eventId: '' })} className="admin-add-btn">
                    + Create Album
                  </button>
                )}
                {showForm && canManage && (
                  <FormModalCard
                    title={editingItem ? 'Edit Album' : 'Create Event Album'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      runAction(
                        () => (editingItem ? api.updateAlbum(editingItem.id, form) : api.createAlbum(form)),
                        editingItem ? 'Album updated.' : 'Album created.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Title *</span>
                        <input required value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Year</span>
                        <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <div className="sm:col-span-2">
                        <MediaUploadControl label="Cover Image" value={form.coverUrl} onChange={v => setForm(f => ({ ...f, coverUrl: v }))} />
                      </div>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Linked Event</span>
                        <select value={form.eventId || ''} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="">None</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Status</span>
                        <select value={form.status || 'published'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </select>
                      </label>
                      <label className="sm:col-span-2 block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Description</span>
                        <textarea rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                    </div>
                  </FormModalCard>
                )}

                <div className="space-y-3">
                  {albums.map(al => (
                    <ItemRow
                      key={al.id}
                      thumb={al.coverUrl}
                      title={al.title}
                      meta={`${al.photoCount || 0} photos${al.year ? ` · ${al.year}` : ''}${al.eventTitle ? ` · Event: ${al.eventTitle}` : ''}`}
                      status={al.status}
                      canPublish={canManage}
                      canEdit={canManage}
                      canDelete={canManage}
                      onTogglePublish={() => runAction(() => api.toggleAlbumPublish(al.id), 'Album status updated.')}
                      onEdit={() => startEdit(al)}
                      onDelete={() => askConfirm('Delete this album?', () => runAction(() => api.deleteAlbum(al.id), 'Album deleted.'))}
                    />
                  ))}
                  {albums.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>No albums created yet.</p>}
                </div>
              </div>
            )}

            {/* Videos Subtab */}
            {gallerySub === 'videos' && (
              <div>
                {canManage && !showForm && (
                  <button type="button" onClick={() => startCreate({ title: '', url: '', thumbnailUrl: '', category: 'campus', duration: '', description: '', eventId: '' })} className="admin-add-btn">
                    + Add / Upload Video
                  </button>
                )}
                {showForm && canManage && (
                  <FormModalCard
                    title={editingItem ? 'Edit Video' : 'Add Highlight Video'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      runAction(
                        () => (editingItem ? api.updateVideo(editingItem.id, form) : api.createVideo(form)),
                        editingItem ? 'Video updated.' : 'Video added.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Title *</span>
                        <input required value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Duration (e.g. 2:45)</span>
                        <input value={form.duration || ''} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <div className="sm:col-span-2">
                        <MediaUploadControl label="Video File (MP4/WebM) or YouTube/Vimeo URL *" value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} kind="video" accept="video/mp4,video/webm" placeholder="https://youtube.com/watch?v=... or upload MP4/WebM" />
                      </div>
                      <div className="sm:col-span-2">
                        <MediaUploadControl label="Thumbnail Image" value={form.thumbnailUrl} onChange={v => setForm(f => ({ ...f, thumbnailUrl: v }))} />
                      </div>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Category</span>
                        <select value={form.category || 'other'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          {getCategories().map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Linked Event</span>
                        <select value={form.eventId || ''} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="">None</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Year</span>
                        <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Status</span>
                        <select value={form.status || 'published'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </select>
                      </label>
                      <label className="sm:col-span-2 block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Description</span>
                        <textarea rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                    </div>
                  </FormModalCard>
                )}

                <div className="space-y-3">
                  {videos.map(v => (
                    <ItemRow
                      key={v.id}
                      thumb={v.thumbnailUrl}
                      title={v.title}
                      meta={`${v.category || 'other'}${v.duration ? ` · ${v.duration}` : ''}${v.eventTitle ? ` · Event: ${v.eventTitle}` : ''}`}
                      status={v.status}
                      canPublish={canManage}
                      canEdit={canManage}
                      canDelete={canManage}
                      onTogglePublish={() => runAction(() => api.toggleVideoPublish(v.id), 'Video status updated.')}
                      onEdit={() => startEdit(v)}
                      onDelete={() => askConfirm('Delete this video?', () => runAction(() => api.deleteVideo(v.id), 'Video deleted.'))}
                    />
                  ))}
                  {videos.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>No videos added yet.</p>}
                </div>
              </div>
            )}

            {/* Before/After Subtab */}
            {gallerySub === 'beforeAfter' && (
              <div>
                {canManage && !showForm && (
                  <button type="button" onClick={() => startCreate({ title: '', description: '', beforeUrl: '', afterUrl: '', eventId: '' })} className="admin-add-btn">
                    + Add Before &amp; After
                  </button>
                )}
                {showForm && canManage && (
                  <FormModalCard
                    title={editingItem ? 'Edit Comparison' : 'Add Before & After Comparison'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      runAction(
                        () => (editingItem ? api.updateBeforeAfter(editingItem.id, form) : api.createBeforeAfter(form)),
                        editingItem ? 'Comparison updated.' : 'Comparison saved.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Title</span>
                        <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Linked Event</span>
                        <select value={form.eventId || ''} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="">None</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                        </select>
                      </label>
                      <MediaUploadControl label="Before Image *" value={form.beforeUrl} onChange={v => setForm(f => ({ ...f, beforeUrl: v }))} />
                      <MediaUploadControl label="After Image *" value={form.afterUrl} onChange={v => setForm(f => ({ ...f, afterUrl: v }))} />
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Year</span>
                        <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Status</span>
                        <select value={form.status || 'published'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </select>
                      </label>
                      <label className="sm:col-span-2 block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Description</span>
                        <textarea rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                    </div>
                  </FormModalCard>
                )}

                <div className="space-y-3">
                  {beforeAfter.map(b => (
                    <ItemRow
                      key={b.id}
                      thumb={b.afterUrl}
                      title={b.title || 'Before & After'}
                      meta={`${b.year || ''}${b.eventTitle ? ` · Event: ${b.eventTitle}` : ''}`}
                      status={b.status}
                      canPublish={canManage}
                      canEdit={canManage}
                      canDelete={canManage}
                      onTogglePublish={() => runAction(() => api.toggleBeforeAfterPublish(b.id), 'Comparison status updated.')}
                      onEdit={() => startEdit(b)}
                      onDelete={() => askConfirm('Delete this comparison?', () => runAction(() => api.deleteBeforeAfter(b.id), 'Comparison deleted.'))}
                    />
                  ))}
                  {beforeAfter.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>No before &amp; after comparisons yet.</p>}
                </div>
              </div>
            )}

            {/* Featured Carousel Subtab */}
            {gallerySub === 'featured' && (
              <div>
                {canManage && !showForm && (
                  <button type="button" onClick={() => startCreate({ photoId: '', caption: '', order: 0 })} className="admin-add-btn">
                    + Pin Featured Moment
                  </button>
                )}
                {showForm && canManage && (
                  <FormModalCard
                    title={editingItem ? 'Edit Featured Moment' : 'Pin Photo to Carousel'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      runAction(
                        () => (editingItem ? api.updateFeatured(editingItem.id, form) : api.createFeatured(form)),
                        editingItem ? 'Featured slide updated.' : 'Added to carousel.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Select Photo *</span>
                        <select required value={form.photoId || ''} onChange={e => setForm(f => ({ ...f, photoId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="">Choose a photo...</option>
                          {photos.map(p => <option key={p.id} value={p.id}>{p.caption || p.url}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Display Order</span>
                        <input type="number" value={form.order ?? 0} onChange={e => setForm(f => ({ ...f, order: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="sm:col-span-2 block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Caption Override</span>
                        <input value={form.caption || ''} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                    </div>
                  </FormModalCard>
                )}

                <div className="space-y-3">
                  {featured.map(f => (
                    <ItemRow
                      key={f.id}
                      thumb={f.url}
                      title={f.caption || f.photoCaption || 'Featured Slide'}
                      meta={`Order: ${f.order ?? 0}${f.eventTitle ? ` · Event: ${f.eventTitle}` : ''}`}
                      status={f.status}
                      canEdit={canManage}
                      canDelete={canManage}
                      onEdit={() => startEdit(f)}
                      onDelete={() => askConfirm('Remove from featured carousel?', () => runAction(() => api.deleteFeatured(f.id), 'Removed from carousel.'))}
                    />
                  ))}
                  {featured.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>No custom carousel slides pinned (shows recent photos automatically).</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ TAB: ACHIEVEMENTS ═══════ */}
        {tab === 'achievements' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { key: 'impactStats', label: `Impact Stats (${impactStats.length})` },
                { key: 'awards', label: `Awards (${awards.length})` },
                { key: 'certificates', label: `Certificates (${certificates.length})` },
                { key: 'timeline', label: `Timeline (${timeline.length})` },
                { key: 'hallOfFame', label: `Hall of Fame (${hallOfFame.length})` },
                { key: 'stories', label: `Stories (${stories.length})` },
              ].map(sub => (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => { setAchieveSub(sub.key); setListSearch(''); setListStatus('all'); resetForm() }}
                  className="filter-pill"
                  aria-pressed={achieveSub === sub.key}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Impact Stats */}
            {achieveSub === 'impactStats' && (
              <div>
                {canManage && !showForm && (
                  <button type="button" onClick={() => startCreate({ label: '', value: 0, unit: '', icon: '🌱', description: '' })} className="admin-add-btn">
                    + Add Impact Stat
                  </button>
                )}
                {showForm && canManage && (
                  <FormModalCard
                    title={editingItem ? 'Edit Impact Statistic' : 'Add Impact Statistic'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      runAction(
                        () => (editingItem ? api.updateStat(editingItem.id, form) : api.createStat(form)),
                        editingItem ? 'Statistic updated.' : 'Statistic added.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Label *</span>
                        <input required value={form.label || ''} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Numeric Value *</span>
                        <input type="number" step="any" required value={form.value ?? ''} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Unit (e.g. trees, kg, hrs)</span>
                        <input value={form.unit || ''} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Icon Emoji</span>
                        <input value={form.icon || ''} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Year</span>
                        <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Status</span>
                        <select value={form.status || 'published'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </select>
                      </label>
                      <label className="sm:col-span-2 block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Verification Note / Description</span>
                        <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                    </div>
                  </FormModalCard>
                )}

                <div className="space-y-3">
                  {impactStats.map(s => (
                    <ItemRow
                      key={s.id}
                      title={`${s.icon || '🌱'} ${s.label}: ${Number(s.value).toLocaleString()} ${s.unit || ''}`}
                      meta={`${s.description || ''}${s.year ? ` · ${s.year}` : ''}`}
                      status={s.status}
                      canPublish={canManage}
                      canEdit={canManage}
                      canDelete={canManage}
                      onTogglePublish={() => runAction(() => api.toggleStatPublish(s.id), 'Stat status updated.')}
                      onEdit={() => startEdit(s)}
                      onDelete={() => askConfirm('Delete this statistic?', () => runAction(() => api.deleteStat(s.id), 'Statistic deleted.'))}
                    />
                  ))}
                  {impactStats.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>No impact statistics recorded yet.</p>}
                </div>
              </div>
            )}

            {/* Awards */}
            {achieveSub === 'awards' && (
              <div>
                {!showForm && (
                  <button type="button" onClick={() => startCreate({ title: '', organization: '', recipient: '', impactMetric: '', category: 'environmental', description: '', featured: false, eventId: '' })} className="admin-add-btn">
                    + {canManage ? 'Add Award' : 'Nominate Draft Award'}
                  </button>
                )}
                {showForm && (
                  <FormModalCard
                    title={editingItem ? 'Edit Award' : 'Add Award / Recognition'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      runAction(
                        () => (editingItem ? api.updateAward(editingItem.id, form) : api.createAward(form)),
                        editingItem ? 'Award updated.' : 'Award saved.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Title *</span>
                        <input required value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Issuing Organization</span>
                        <input value={form.organization || ''} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Recipient / Team</span>
                        <input value={form.recipient || ''} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Measured Outcome</span>
                        <input value={form.impactMetric || ''} onChange={e => setForm(f => ({ ...f, impactMetric: e.target.value }))} placeholder="e.g. 120 kg plastic diverted" className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Category</span>
                        <select value={form.category || 'environmental'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          {getAwardCategories().map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Year</span>
                        <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Linked Event</span>
                        <select value={form.eventId || ''} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="">None</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                        </select>
                      </label>
                      {canManage && (
                        <label className="block">
                          <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Status</span>
                          <select value={form.status || 'published'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                            <option value="published">Published</option>
                            <option value="draft">Draft</option>
                          </select>
                        </label>
                      )}
                      <label className="sm:col-span-2 block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Description</span>
                        <textarea rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      {canManage && (
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: FOREST }}>
                          <input type="checkbox" checked={Boolean(form.featured)} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} />
                          Highlight as Featured Award
                        </label>
                      )}
                    </div>
                  </FormModalCard>
                )}

                {(() => {
                  const filtered = filterAdminItems(awards, listSearch, listStatus)
                  return (
                    <>
                      <AdminListToolbar query={listSearch} onQueryChange={setListSearch} statusFilter={listStatus} onStatusChange={setListStatus} total={awards.length} shown={filtered.length} />
                      <div className="space-y-3">
                        {filtered.map(a => (
                          <ItemRow
                            key={a.id}
                            title={a.title}
                            meta={`${a.organization || ''}${a.year ? ` · ${a.year}` : ''} · ${a.category}${a.eventTitle ? ` · Event: ${a.eventTitle}` : ''}`}
                            status={a.status}
                            canPublish={canManage}
                            canEdit={canManage}
                            canDelete={canManage}
                            onTogglePublish={() => runAction(() => api.toggleAwardPublish(a.id), 'Award visibility updated.')}
                            onEdit={() => startEdit(a)}
                            onDelete={() => askConfirm(`Delete award "${a.title}"?`, () => runAction(() => api.deleteAward(a.id), 'Award deleted.'))}
                          />
                        ))}
                        {filtered.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>{awards.length === 0 ? 'No awards recorded yet.' : 'No matching awards.'}</p>}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {/* Certificates */}
            {achieveSub === 'certificates' && (
              <div>
                {canManage && !showForm && (
                  <button type="button" onClick={() => startCreate({ title: '', issuedBy: '', recipientName: '', imageUrl: '', downloadUrl: '', downloadPolicy: 'public', allowDownload: true, eventId: '' })} className="admin-add-btn">
                    + Add Certificate
                  </button>
                )}
                {showForm && canManage && (
                  <FormModalCard
                    title={editingItem ? 'Edit Certificate' : 'Add Certificate'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      runAction(
                        () => (editingItem ? api.updateCertificate(editingItem.id, form) : api.createCertificate(form)),
                        editingItem ? 'Certificate updated.' : 'Certificate added.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Title *</span>
                        <input required value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Issued By</span>
                        <input value={form.issuedBy || ''} onChange={e => setForm(f => ({ ...f, issuedBy: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Recipient Name</span>
                        <input value={form.recipientName || ''} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Year</span>
                        <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <div className="sm:col-span-2">
                        <MediaUploadControl label="Preview Image (JPG/PNG/WebP)" value={form.imageUrl} onChange={v => setForm(f => ({ ...f, imageUrl: v }))} />
                      </div>
                      <div className="sm:col-span-2">
                        <MediaUploadControl label="Downloadable File (PDF or High-Res Image)" value={form.downloadUrl} onChange={v => setForm(f => ({ ...f, downloadUrl: v }))} kind="certificate" accept="image/*,application/pdf" placeholder="Optional separate PDF/high-res URL or upload" />
                      </div>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Download Permission Policy</span>
                        <select
                          value={form.downloadPolicy || 'public'}
                          onChange={e => setForm(f => ({ ...f, downloadPolicy: e.target.value, allowDownload: e.target.value !== 'restricted' }))}
                          className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                          style={{ borderColor: `${OLIVE}66` }}
                        >
                          <option value="public">Public (anyone can download)</option>
                          <option value="members">Members Only (sign-in required)</option>
                          <option value="restricted">Preview Only (download restricted)</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Linked Event</span>
                        <select value={form.eventId || ''} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="">None</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Status</span>
                        <select value={form.status || 'published'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </select>
                      </label>
                      <label className="sm:col-span-2 block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Description</span>
                        <textarea rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                    </div>
                  </FormModalCard>
                )}

                <div className="space-y-3">
                  {certificates.map(c => (
                    <ItemRow
                      key={c.id}
                      thumb={c.imageUrl}
                      title={c.title}
                      meta={`${c.issuedBy || ''}${c.recipientName ? ` · ${c.recipientName}` : ''} · Policy: ${c.downloadPolicy} · Downloads: ${c.downloadCount || 0}`}
                      status={c.status}
                      canPublish={canManage}
                      canEdit={canManage}
                      canDelete={canManage}
                      onTogglePublish={() => runAction(() => api.toggleCertificatePublish(c.id), 'Certificate status updated.')}
                      onEdit={() => startEdit(c)}
                      onDelete={() => askConfirm(`Delete certificate "${c.title}"?`, () => runAction(() => api.deleteCertificate(c.id), 'Certificate deleted.'))}
                    />
                  ))}
                  {certificates.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>No certificates uploaded yet.</p>}
                </div>
              </div>
            )}

            {/* Timeline */}
            {achieveSub === 'timeline' && (
              <div>
                {canManage && !showForm && (
                  <button type="button" onClick={() => startCreate({ title: '', date: '', category: 'environmental', description: '', eventId: '' })} className="admin-add-btn">
                    + Add Timeline Milestone
                  </button>
                )}
                {showForm && canManage && (
                  <FormModalCard
                    title={editingItem ? 'Edit Milestone' : 'Add Timeline Milestone'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      runAction(
                        () => (editingItem ? api.updateTimeline(editingItem.id, form) : api.createTimeline(form)),
                        editingItem ? 'Milestone updated.' : 'Milestone added.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Title *</span>
                        <input required value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Date</span>
                        <input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value, year: e.target.value ? e.target.value.slice(0, 4) : f.year }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Category</span>
                        <select value={form.category || 'environmental'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          {getAwardCategories().map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Linked Event</span>
                        <select value={form.eventId || ''} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="">None</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Year</span>
                        <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Status</span>
                        <select value={form.status || 'published'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </select>
                      </label>
                      <label className="sm:col-span-2 block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Description</span>
                        <textarea rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                    </div>
                  </FormModalCard>
                )}

                <div className="space-y-3">
                  {timeline.map(t => (
                    <ItemRow
                      key={t.id}
                      title={t.title}
                      meta={`${t.date || t.year || ''} · ${t.category}${t.eventTitle ? ` · Event: ${t.eventTitle}` : ''}`}
                      status={t.status}
                      canPublish={canManage}
                      canEdit={canManage}
                      canDelete={canManage}
                      onTogglePublish={() => runAction(() => api.toggleTimelinePublish(t.id), 'Milestone status updated.')}
                      onEdit={() => startEdit(t)}
                      onDelete={() => askConfirm(`Delete milestone "${t.title}"?`, () => runAction(() => api.deleteTimeline(t.id), 'Milestone deleted.'))}
                    />
                  ))}
                  {timeline.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>No timeline milestones added yet.</p>}
                </div>
              </div>
            )}

            {/* Hall of Fame */}
            {achieveSub === 'hallOfFame' && (
              <div>
                {canManage && !showForm && (
                  <button type="button" onClick={() => startCreate({ name: '', role: '', honorBadge: '', contribution: '', photoUrl: '' })} className="admin-add-btn">
                    + Add Hall of Fame Honoree
                  </button>
                )}
                {showForm && canManage && (
                  <FormModalCard
                    title={editingItem ? 'Edit Honoree' : 'Add Hall of Fame Member'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      runAction(
                        () => (editingItem ? api.updateHallOfFame(editingItem.id, form) : api.createHallOfFame(form)),
                        editingItem ? 'Honoree updated.' : 'Honoree added.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Member Name *</span>
                        <input required value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Role / Title</span>
                        <input value={form.role || ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Honor Badge</span>
                        <input value={form.honorBadge || ''} onChange={e => setForm(f => ({ ...f, honorBadge: e.target.value }))} placeholder="e.g. Green Steward" className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Year</span>
                        <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <div className="sm:col-span-2">
                        <MediaUploadControl label="Member Portrait" value={form.photoUrl} onChange={v => setForm(f => ({ ...f, photoUrl: v }))} />
                      </div>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Status</span>
                        <select value={form.status || 'published'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                        </select>
                      </label>
                      <label className="sm:col-span-2 block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Contribution Summary</span>
                        <textarea rows={3} value={form.contribution || ''} onChange={e => setForm(f => ({ ...f, contribution: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                    </div>
                  </FormModalCard>
                )}

                <div className="space-y-3">
                  {hallOfFame.map(h => (
                    <ItemRow
                      key={h.id}
                      thumb={h.photoUrl}
                      title={h.name}
                      meta={`${h.role || ''}${h.year ? ` · ${h.year}` : ''}${h.honorBadge ? ` · ${h.honorBadge}` : ''}`}
                      status={h.status}
                      canPublish={canManage}
                      canEdit={canManage}
                      canDelete={canManage}
                      onTogglePublish={() => runAction(() => api.toggleHallOfFamePublish(h.id), 'Honoree status updated.')}
                      onEdit={() => startEdit(h)}
                      onDelete={() => askConfirm(`Remove "${h.name}" from Hall of Fame?`, () => runAction(() => api.deleteHallOfFame(h.id), 'Honoree removed.'))}
                    />
                  ))}
                  {hallOfFame.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>No Hall of Fame members added yet.</p>}
                </div>
              </div>
            )}

            {/* Stories */}
            {achieveSub === 'stories' && (
              <div>
                {!showForm && (
                  <button type="button" onClick={() => startCreate({ title: '', content: '', authorName: currentUser.name, category: 'sustainability', imageUrl: '', featured: false, eventId: '' })} className="admin-add-btn">
                    + {canManage ? 'Write Success Story' : 'Submit Draft Story'}
                  </button>
                )}
                {showForm && (
                  <FormModalCard
                    title={editingItem ? 'Edit Story' : 'Add Success Story'}
                    onCancel={resetForm}
                    saving={saving}
                    onSubmit={e => {
                      e.preventDefault()
                      runAction(
                        () => (editingItem ? api.updateStory(editingItem.id, form) : api.createStory(form)),
                        editingItem ? 'Story updated.' : 'Story saved.'
                      )
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Title *</span>
                        <input required value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Author Name</span>
                        <input value={form.authorName || ''} onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Category</span>
                        <select value={form.category || 'sustainability'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          {getAwardCategories().map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Year</span>
                        <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                      <div className="sm:col-span-2">
                        <MediaUploadControl label="Story Cover Photo" value={form.imageUrl} onChange={v => setForm(f => ({ ...f, imageUrl: v }))} />
                      </div>
                      <label className="block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Linked Event</span>
                        <select value={form.eventId || ''} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                          <option value="">None</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                        </select>
                      </label>
                      {canManage && (
                        <label className="block">
                          <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Status</span>
                          <select value={form.status || 'published'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }}>
                            <option value="published">Published</option>
                            <option value="draft">Draft</option>
                          </select>
                        </label>
                      )}
                      {canManage && (
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: FOREST }}>
                          <input type="checkbox" checked={Boolean(form.featured)} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} />
                          Feature this story at top
                        </label>
                      )}
                      <label className="sm:col-span-2 block">
                        <span className="text-xs font-semibold block mb-1" style={{ color: FOREST }}>Story Narrative *</span>
                        <textarea required rows={5} value={form.content || ''} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: `${OLIVE}66` }} />
                      </label>
                    </div>
                  </FormModalCard>
                )}

                {(() => {
                  const filtered = filterAdminItems(stories, listSearch, listStatus)
                  return (
                    <>
                      <AdminListToolbar query={listSearch} onQueryChange={setListSearch} statusFilter={listStatus} onStatusChange={setListStatus} total={stories.length} shown={filtered.length} />
                      <div className="space-y-3">
                        {filtered.map(st => (
                          <ItemRow
                            key={st.id}
                            thumb={st.imageUrl}
                            title={`${st.featured ? '★ ' : ''}${st.title}`}
                            meta={`${st.authorName || ''} · ${st.category}${st.year ? ` · ${st.year}` : ''}`}
                            status={st.status}
                            canPublish={canManage}
                            canEdit={canManage}
                            canDelete={canManage}
                            onTogglePublish={() => runAction(() => api.toggleStoryPublish(st.id), 'Story status updated.')}
                            onEdit={() => startEdit(st)}
                            onDelete={() => askConfirm(`Delete story "${st.title}"?`, () => runAction(() => api.deleteStory(st.id), 'Story deleted.'))}
                          />
                        ))}
                        {filtered.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>{stories.length === 0 ? 'No success stories written yet.' : 'No matching stories.'}</p>}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* ═══════ TAB: MEDIA UPLOADS ═══════ */}
        {tab === 'uploads' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl border bg-white" style={{ borderColor: '#e4ddd0' }}>
              <h3 className="text-lg mb-2" style={{ fontFamily: headingFont, color: FOREST }}>Secure File Upload</h3>
              <p className="text-xs mb-4" style={{ color: '#5f5a4f' }}>
                Validates magic bytes server-side. Allowed types: JPG, PNG, WebP, GIF, PDF, MP4, WebM (max 50 MB).
              </p>
              <MediaUploadControl
                label="Upload Any Supported Media"
                value=""
                kind="any"
                accept="image/*,application/pdf,video/mp4,video/webm"
                onChange={() => api.listUploads().then(res => setUploads(res.uploads || []))}
              />
            </div>

            <div className="space-y-3">
              {uploads.map(u => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border bg-white" style={{ borderColor: '#e4ddd0' }}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {u.kind === 'image' ? (
                      <img src={u.url} alt={u.originalName} className="w-12 h-12 rounded object-cover border border-stone-200" />
                    ) : (
                      <div className="w-12 h-12 rounded flex items-center justify-center bg-stone-100 text-xl">
                        {u.kind === 'video' ? '🎬' : '📄'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <strong className="text-sm block truncate" style={{ color: FOREST }}>{u.originalName}</strong>
                      <p className="text-xs truncate" style={{ color: '#5f5a4f' }}>
                        {u.mimeType} · {(u.sizeBytes / 1024).toFixed(1)} KB · <code>{u.url}</code>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(u.url)
                        setNotice(`Copied ${u.url}`)
                        showToast(`Copied ${u.url}`)
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer"
                      style={{ borderColor: OLIVE, color: FOREST }}
                    >
                      Copy URL
                    </button>
                    <button
                      type="button"
                      onClick={() => askConfirm(`Delete "${u.originalName}" permanently?`, () => runAction(() => api.deleteUpload(u.id), 'Uploaded file removed.'))}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-300 text-red-700 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {uploads.length === 0 && <p className="text-sm" style={{ color: '#5f5a4f' }}>No files uploaded yet.</p>}
            </div>
          </div>
        )}

        {/* ═══════ TAB: USERS & ROLES (ADMIN ONLY) ═══════ */}
        {tab === 'users' && isAdmin && (
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border bg-white" style={{ borderColor: '#e4ddd0' }}>
                <div>
                  <strong className="text-sm block" style={{ color: FOREST }}>{u.name}</strong>
                  <span className="text-xs" style={{ color: '#5f5a4f' }}>{u.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold" style={{ color: FOREST }}>
                    Role:
                    <select
                      value={u.role}
                      onChange={e => runAction(() => api.updateUserRole(u.id, e.target.value), `Updated role for ${u.name}.`)}
                      className="ml-2 px-3 py-1.5 rounded-lg border text-xs bg-white"
                      style={{ borderColor: `${OLIVE}66` }}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="member">Member</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmState && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 22, 18, 0.72)' }}
          onClick={e => {
            if (e.target === e.currentTarget) setConfirmState(null)
          }}
        >
          <div className="max-w-sm w-full rounded-2xl p-6 shadow-2xl border page-enter" style={{ backgroundColor: IVORY, borderColor: '#d8cebd' }}>
            <h3 className="text-xl mb-2" style={{ fontFamily: headingFont, color: FOREST }}>
              Confirm Action
            </h3>
            <p className="text-sm mb-5" style={{ color: '#5b564b' }}>
              {confirmState.message}
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold border cursor-pointer"
                style={{ borderColor: OLIVE, color: FOREST }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = confirmState.action
                  setConfirmState(null)
                  fn?.()
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer bg-red-700 text-white hover:bg-red-800"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
