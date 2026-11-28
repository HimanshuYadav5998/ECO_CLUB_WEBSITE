import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  SESSION_COOKIE,
  canManageContent,
  canSubmitDraft,
  getRequestUser,
  hashPassword,
  isAdmin,
  signToken,
  verifyPassword,
} from './auth.js'
import { handleFileUpload, serveUploadedFile } from './uploads.js'

function sendJson(res, status, data, extraHeaders = {}) {
  const payload = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  })
  res.end(payload)
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) {
      throw new Error('PAYLOAD_TOO_LARGE')
    }
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw)
}

function sanitizeUrl(value) {
  if (!value || typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('/uploads/')) return trimmed
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href
    }
  } catch {
    return ''
  }
  return ''
}

function normalizeStatus(status, user) {
  if (!canManageContent(user)) return 'draft'
  return status === 'draft' ? 'draft' : 'published'
}

function parseIntOrNull(val) {
  if (val === '' || val === null || val === undefined) return null
  const num = Number(val)
  return Number.isFinite(num) ? Math.trunc(num) : null
}

function visibilityClause(user, alias = '') {
  const col = alias ? `${alias}.status` : 'status'
  const by = alias ? `${alias}.created_by` : 'created_by'
  if (canManageContent(user)) return { sql: '1=1', params: [] }
  if (user) return { sql: `(${col} = 'published' OR ${by} = ?)`, params: [user.id] }
  return { sql: `${col} = 'published'`, params: [] }
}

function normalizeEventId(db, eventId) {
  if (!eventId || typeof eventId !== 'string') return null
  const row = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId)
  return row ? row.id : null
}

function normalizeAlbumId(db, albumId) {
  if (!albumId || typeof albumId !== 'string') return null
  const row = db.prepare('SELECT id FROM gallery_albums WHERE id = ?').get(albumId)
  return row ? row.id : null
}

function getSettings(db) {
  const bannerRow = db.prepare("SELECT value FROM settings WHERE key = 'events_banner'").get()
  const historyRow = db.prepare("SELECT value FROM settings WHERE key = 'image_history'").get()
  let imageHistory = []
  try {
    const parsed = JSON.parse(historyRow?.value || '[]')
    if (Array.isArray(parsed)) imageHistory = parsed
  } catch {
    imageHistory = []
  }
  return {
    banner: bannerRow?.value || '',
    imageHistory,
  }
}

function mapEventRow(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    start: row.start_time,
    end: row.end_time,
    location: row.location,
    description: row.description,
    cover: row.cover_url,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photoCount: Number(row.photo_count || 0),
    albumCount: Number(row.album_count || 0),
    videoCount: Number(row.video_count || 0),
    achievementCount: Number(row.achievement_count || 0),
  }
}

function queryEvents(db, user) {
  const vis = visibilityClause(user, 'e')
  const rows = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM gallery_photos p WHERE p.event_id = e.id AND p.status = 'published') AS photo_count,
      (SELECT COUNT(*) FROM gallery_albums a WHERE a.event_id = e.id AND a.status = 'published') AS album_count,
      (SELECT COUNT(*) FROM gallery_videos v WHERE v.event_id = e.id AND v.status = 'published') AS video_count,
      (
        (SELECT COUNT(*) FROM achievement_awards aw WHERE aw.event_id = e.id AND aw.status = 'published') +
        (SELECT COUNT(*) FROM achievement_timeline tl WHERE tl.event_id = e.id AND tl.status = 'published') +
        (SELECT COUNT(*) FROM achievement_certificates c WHERE c.event_id = e.id AND c.status = 'published') +
        (SELECT COUNT(*) FROM achievement_stories s WHERE s.event_id = e.id AND s.status = 'published')
      ) AS achievement_count
    FROM events e
    WHERE ${vis.sql}
    ORDER BY e.date DESC, e.created_at DESC
  `).all(...vis.params)
  return rows.map(mapEventRow)
}

function mapPhotoRow(row) {
  let tags
  try {
    tags = JSON.parse(row.tags_json || '[]')
  } catch {
    tags = []
  }
  return {
    id: row.id,
    url: row.url,
    caption: row.caption,
    category: row.category,
    year: row.year,
    eventId: row.event_id || '',
    eventTitle: row.event_title || '',
    albumId: row.album_id || '',
    albumTitle: row.album_title || '',
    tags: Array.isArray(tags) ? tags : [],
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function queryGallery(db, user) {
  const pVis = visibilityClause(user, 'p')
  const aVis = visibilityClause(user, 'a')
  const vVis = visibilityClause(user, 'v')
  const bVis = visibilityClause(user, 'b')
  const fVis = visibilityClause(user, 'f')

  const photos = db.prepare(`
    SELECT p.*, e.title AS event_title, a.title AS album_title
    FROM gallery_photos p
    LEFT JOIN events e ON e.id = p.event_id
    LEFT JOIN gallery_albums a ON a.id = p.album_id
    WHERE ${pVis.sql}
    ORDER BY p.created_at DESC
  `).all(...pVis.params).map(mapPhotoRow)

  const albums = db.prepare(`
    SELECT a.*, e.title AS event_title,
      (SELECT COUNT(*) FROM gallery_photos p WHERE p.album_id = a.id AND p.status = 'published') AS photo_count
    FROM gallery_albums a
    LEFT JOIN events e ON e.id = a.event_id
    WHERE ${aVis.sql}
    ORDER BY a.year DESC, a.created_at DESC
  `).all(...aVis.params).map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    coverUrl: r.cover_url,
    eventId: r.event_id || '',
    eventTitle: r.event_title || '',
    year: r.year,
    photoCount: Number(r.photo_count || 0),
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  const videos = db.prepare(`
    SELECT v.*, e.title AS event_title
    FROM gallery_videos v
    LEFT JOIN events e ON e.id = v.event_id
    WHERE ${vVis.sql}
    ORDER BY v.year DESC, v.created_at DESC
  `).all(...vVis.params).map(r => ({
    id: r.id,
    title: r.title,
    url: r.url,
    thumbnailUrl: r.thumbnail_url,
    category: r.category,
    description: r.description,
    duration: r.duration,
    eventId: r.event_id || '',
    eventTitle: r.event_title || '',
    year: r.year,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  const beforeAfter = db.prepare(`
    SELECT b.*, e.title AS event_title
    FROM gallery_before_after b
    LEFT JOIN events e ON e.id = b.event_id
    WHERE ${bVis.sql}
    ORDER BY b.year DESC, b.created_at DESC
  `).all(...bVis.params).map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    beforeUrl: r.before_url,
    afterUrl: r.after_url,
    eventId: r.event_id || '',
    eventTitle: r.event_title || '',
    year: r.year,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  const featured = db.prepare(`
    SELECT f.*, p.url AS photo_url, p.caption AS photo_caption, p.category AS photo_category, p.event_id, e.title AS event_title
    FROM gallery_featured f
    JOIN gallery_photos p ON p.id = f.photo_id
    LEFT JOIN events e ON e.id = p.event_id
    WHERE ${fVis.sql} AND p.status = 'published'
    ORDER BY f.sort_order ASC, f.created_at DESC
  `).all(...fVis.params).map(r => ({
    id: r.id,
    photoId: r.photo_id,
    caption: r.caption,
    order: r.sort_order,
    status: r.status,
    url: r.photo_url,
    photoCaption: r.photo_caption,
    category: r.photo_category,
    eventId: r.event_id || '',
    eventTitle: r.event_title || '',
    createdAt: r.created_at,
  }))

  return { photos, albums, videos, beforeAfter, featured }
}

function queryAchievements(db, user) {
  const sVis = visibilityClause(user, 's')
  const aVis = visibilityClause(user, 'a')
  const cVis = visibilityClause(user, 'c')
  const tVis = visibilityClause(user, 't')
  const hVis = visibilityClause(user, 'h')
  const stVis = visibilityClause(user, 'st')

  const impactStats = db.prepare(`
    SELECT * FROM impact_stats s
    WHERE ${sVis.sql}
    ORDER BY s.created_at ASC
  `).all(...sVis.params).map(r => ({
    id: r.id,
    label: r.label,
    value: Number(r.value || 0),
    unit: r.unit,
    icon: r.icon,
    description: r.description,
    year: r.year,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  const awards = db.prepare(`
    SELECT a.*, e.title AS event_title,
      (SELECT COUNT(*) FROM gallery_photos p WHERE p.event_id = a.event_id AND p.status = 'published') AS gallery_count
    FROM achievement_awards a
    LEFT JOIN events e ON e.id = a.event_id
    WHERE ${aVis.sql}
    ORDER BY a.year DESC, a.created_at DESC
  `).all(...aVis.params).map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    organization: r.organization,
    recipient: r.recipient,
    impactMetric: r.impact_metric,
    category: r.category,
    year: r.year,
    featured: Boolean(r.featured),
    eventId: r.event_id || '',
    eventTitle: r.event_title || '',
    galleryCount: Number(r.gallery_count || 0),
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  const certificates = db.prepare(`
    SELECT c.*, e.title AS event_title
    FROM achievement_certificates c
    LEFT JOIN events e ON e.id = c.event_id
    WHERE ${cVis.sql}
    ORDER BY c.year DESC, c.created_at DESC
  `).all(...cVis.params).map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    issuedBy: r.issued_by,
    recipientName: r.recipient_name,
    year: r.year,
    imageUrl: r.image_url,
    downloadUrl: r.download_url,
    allowDownload: Boolean(r.allow_download),
    downloadPolicy: r.download_policy,
    downloadCount: Number(r.download_count || 0),
    eventId: r.event_id || '',
    eventTitle: r.event_title || '',
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  const timeline = db.prepare(`
    SELECT t.*, e.title AS event_title,
      (SELECT COUNT(*) FROM gallery_photos p WHERE p.event_id = t.event_id AND p.status = 'published') AS gallery_count
    FROM achievement_timeline t
    LEFT JOIN events e ON e.id = t.event_id
    WHERE ${tVis.sql}
    ORDER BY t.date ASC, t.year ASC, t.created_at ASC
  `).all(...tVis.params).map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    date: r.date,
    year: r.year,
    category: r.category,
    eventId: r.event_id || '',
    eventTitle: r.event_title || '',
    galleryCount: Number(r.gallery_count || 0),
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  const hallOfFame = db.prepare(`
    SELECT * FROM achievement_hall_of_fame h
    WHERE ${hVis.sql}
    ORDER BY h.year DESC, h.created_at DESC
  `).all(...hVis.params).map(r => ({
    id: r.id,
    name: r.name,
    role: r.role,
    year: r.year,
    honorBadge: r.honor_badge,
    contribution: r.contribution,
    photoUrl: r.photo_url,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  const stories = db.prepare(`
    SELECT st.*, e.title AS event_title
    FROM achievement_stories st
    LEFT JOIN events e ON e.id = st.event_id
    WHERE ${stVis.sql}
    ORDER BY st.featured DESC, st.year DESC, st.created_at DESC
  `).all(...stVis.params).map(r => ({
    id: r.id,
    title: r.title,
    content: r.content,
    authorName: r.author_name,
    category: r.category,
    year: r.year,
    imageUrl: r.image_url,
    featured: Boolean(r.featured),
    eventId: r.event_id || '',
    eventTitle: r.event_title || '',
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  return { impactStats, awards, certificates, timeline, hallOfFame, stories }
}

function setSessionCookie(res, token) {
  const maxAge = 60 * 60 * 24 * 7
  return {
    'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
  }
}

function clearSessionCookie() {
  return {
    'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  }
}

function seedFromEnvIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt
  if (count === 0 && process.env.ECO_CLUB_ADMIN_EMAIL && process.env.ECO_CLUB_ADMIN_PASSWORD) {
    const email = process.env.ECO_CLUB_ADMIN_EMAIL.trim().toLowerCase()
    const password = process.env.ECO_CLUB_ADMIN_PASSWORD
    const name = process.env.ECO_CLUB_ADMIN_NAME || 'Eco Club Admin'
    if (password.length >= 8) {
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, 'admin', ?)
      `).run('user-' + crypto.randomUUID(), name, email, hashPassword(password), new Date().toISOString())
    }
  }
}

export function createApiHandler({ db, secret, uploadDir, distDir }) {
  seedFromEnvIfEmpty(db)

  return async function handleRequest(req, res) {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1')
    const pathname = reqUrl.pathname
    const method = req.method || 'GET'

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

    try {
      // Serve uploaded files securely
      if (method === 'GET' && pathname.startsWith('/uploads/')) {
        const filename = pathname.slice('/uploads/'.length)
        const asDownload = reqUrl.searchParams.get('download') === '1'
        const served = serveUploadedFile(req, res, uploadDir, filename, asDownload)
        if (!served) sendJson(res, 404, { error: 'File not found' })
        return
      }

      if (!pathname.startsWith('/api/')) {
        // Serve static frontend build when available (production mode)
        if (distDir && fs.existsSync(distDir)) {
          const cleanPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
          const fullPath = path.resolve(distDir, cleanPath)
          if (fullPath.startsWith(path.resolve(distDir)) && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const ext = path.extname(fullPath).toLowerCase()
            const mimeMap = {
              '.html': 'text/html; charset=utf-8',
              '.js': 'application/javascript; charset=utf-8',
              '.css': 'text/css; charset=utf-8',
              '.svg': 'image/svg+xml',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.webp': 'image/webp',
              '.json': 'application/json',
            }
            res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' })
            fs.createReadStream(fullPath).pipe(res)
            return
          }
          const indexHtml = path.join(distDir, 'index.html')
          if (!path.extname(cleanPath) && fs.existsSync(indexHtml)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            fs.createReadStream(indexHtml).pipe(res)
            return
          }
        }
        sendJson(res, 404, { error: 'Not found' })
        return
      }

      const user = getRequestUser(req, db, secret)

      // ─── Health & Bootstrap ────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() })
        return
      }

      if (method === 'GET' && pathname === '/api/bootstrap') {
        const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt
        const settings = getSettings(db)
        sendJson(res, 200, {
          user,
          setupRequired: userCount === 0,
          events: queryEvents(db, user),
          banner: settings.banner,
          imageHistory: settings.imageHistory,
          gallery: queryGallery(db, user),
          achievements: queryAchievements(db, user),
        })
        return
      }

      // ─── Auth & Users ──────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/api/auth/setup-status') {
        const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt
        sendJson(res, 200, { hasUsers: userCount > 0, setupRequired: userCount === 0 })
        return
      }

      if (method === 'POST' && pathname === '/api/auth/setup') {
        const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt
        if (userCount > 0) {
          sendJson(res, 403, { error: 'Admin account is already initialized. Please sign in.' })
          return
        }
        const body = await readJsonBody(req)
        const name = String(body.name || '').trim()
        const email = String(body.email || '').trim().toLowerCase()
        const password = String(body.password || '')
        if (!name || !email.includes('@') || password.length < 8) {
          sendJson(res, 400, { error: 'Provide a valid name, email, and password (at least 8 characters).' })
          return
        }
        const id = 'user-' + crypto.randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO users (id, name, email, password_hash, role, created_at)
          VALUES (?, ?, ?, ?, 'admin', ?)
        `).run(id, name, email, hashPassword(password), now)
        const token = signToken({ sub: id, role: 'admin' }, secret)
        const createdUser = { id, name, email, role: 'admin', createdAt: now }
        sendJson(res, 201, { user: createdUser, token }, setSessionCookie(res, token))
        return
      }

      if (method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJsonBody(req)
        const name = String(body.name || '').trim()
        const email = String(body.email || '').trim().toLowerCase()
        const password = String(body.password || '')
        if (!name || !email.includes('@') || password.length < 8) {
          sendJson(res, 400, { error: 'Provide a valid name, email, and password (at least 8 characters).' })
          return
        }
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
        if (existing) {
          sendJson(res, 409, { error: 'An account with this email already exists.' })
          return
        }
        const id = 'user-' + crypto.randomUUID()
        const now = new Date().toISOString()
        // Public registration always assigns lowest-privilege 'member' role
        db.prepare(`
          INSERT INTO users (id, name, email, password_hash, role, created_at)
          VALUES (?, ?, ?, ?, 'member', ?)
        `).run(id, name, email, hashPassword(password), now)
        const token = signToken({ sub: id, role: 'member' }, secret)
        const createdUser = { id, name, email, role: 'member', createdAt: now }
        sendJson(res, 201, { user: createdUser, token }, setSessionCookie(res, token))
        return
      }

      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJsonBody(req)
        const email = String(body.email || '').trim().toLowerCase()
        const password = String(body.password || '')
        const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
        if (!row || !verifyPassword(password, row.password_hash)) {
          sendJson(res, 401, { error: 'Invalid email or password.' })
          return
        }
        const token = signToken({ sub: row.id, role: row.role }, secret)
        const safeUser = { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at }
        sendJson(res, 200, { user: safeUser, token }, setSessionCookie(res, token))
        return
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        sendJson(res, 200, { ok: true }, clearSessionCookie())
        return
      }

      if (method === 'GET' && pathname === '/api/auth/me') {
        sendJson(res, 200, { user })
        return
      }

      if (method === 'GET' && pathname === '/api/users') {
        if (!isAdmin(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Administrator permission required.' })
          return
        }
        const users = db.prepare('SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY created_at ASC').all()
        sendJson(res, 200, { users })
        return
      }

      const userRoleMatch = pathname.match(/^\/api\/users\/([^/]+)\/role$/)
      if (method === 'PATCH' && userRoleMatch) {
        if (!isAdmin(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Administrator permission required.' })
          return
        }
        const targetId = userRoleMatch[1]
        const body = await readJsonBody(req)
        const nextRole = body.role
        if (!['admin', 'editor', 'member'].includes(nextRole)) {
          sendJson(res, 400, { error: 'Invalid role. Choose admin, editor, or member.' })
          return
        }
        const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(targetId)
        if (!target) {
          sendJson(res, 404, { error: 'User not found.' })
          return
        }
        if (target.role === 'admin' && nextRole !== 'admin') {
          const adminCount = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'").get().cnt
          if (adminCount <= 1) {
            sendJson(res, 400, { error: 'Cannot demote the last remaining administrator.' })
            return
          }
        }
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(nextRole, targetId)
        const updated = db.prepare('SELECT id, name, email, role, created_at AS createdAt FROM users WHERE id = ?').get(targetId)
        sendJson(res, 200, { user: updated })
        return
      }

      // ─── Settings (Events banner & image history) ──────────────────────────
      if (method === 'GET' && pathname === '/api/settings') {
        sendJson(res, 200, getSettings(db))
        return
      }

      if (method === 'PUT' && pathname === '/api/settings') {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const body = await readJsonBody(req)
        const now = new Date().toISOString()
        if (body.banner !== undefined) {
          const banner = sanitizeUrl(body.banner)
          if (body.banner && !banner) {
            sendJson(res, 400, { error: 'Invalid banner image URL.' })
            return
          }
          db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('events_banner', banner, now)
        }
        if (Array.isArray(body.imageHistory)) {
          const clean = [...new Set(body.imageHistory.map(sanitizeUrl).filter(Boolean))]
          db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
            'image_history',
            JSON.stringify(clean),
            now
          )
        }
        sendJson(res, 200, getSettings(db))
        return
      }

      // ─── Secure Media Uploads ──────────────────────────────────────────────
      if (method === 'GET' && pathname === '/api/uploads') {
        if (!canSubmitDraft(user)) {
          sendJson(res, 401, { error: 'Sign in required.' })
          return
        }
        const rows = canManageContent(user)
          ? db.prepare('SELECT id, filename, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes, kind, url, uploaded_by AS uploadedBy, created_at AS createdAt FROM media_uploads ORDER BY created_at DESC').all()
          : db.prepare('SELECT id, filename, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes, kind, url, uploaded_by AS uploadedBy, created_at AS createdAt FROM media_uploads WHERE uploaded_by = ? ORDER BY created_at DESC').all(user.id)
        sendJson(res, 200, { uploads: rows })
        return
      }

      if (method === 'POST' && pathname === '/api/uploads') {
        if (!canSubmitDraft(user)) {
          sendJson(res, 401, { error: 'Sign in required to upload media.' })
          return
        }
        const result = await handleFileUpload(req, db, uploadDir, user)
        sendJson(res, result.status, result.body)
        return
      }

      const uploadDelMatch = pathname.match(/^\/api\/uploads\/([^/]+)$/)
      if (method === 'DELETE' && uploadDelMatch) {
        if (!canSubmitDraft(user)) {
          sendJson(res, 401, { error: 'Sign in required.' })
          return
        }
        const row = db.prepare('SELECT * FROM media_uploads WHERE id = ?').get(uploadDelMatch[1])
        if (!row) {
          sendJson(res, 404, { error: 'Upload not found.' })
          return
        }
        if (!canManageContent(user) && row.uploaded_by !== user.id) {
          sendJson(res, 403, { error: 'Permission denied.' })
          return
        }
        const filePath = path.join(uploadDir, path.basename(row.filename))
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        db.prepare('DELETE FROM media_uploads WHERE id = ?').run(row.id)
        sendJson(res, 200, { ok: true })
        return
      }

      // ─── Events ────────────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/api/events') {
        sendJson(res, 200, { events: queryEvents(db, user) })
        return
      }

      const eventDetailMatch = pathname.match(/^\/api\/events\/([^/]+)$/)
      if (method === 'GET' && eventDetailMatch) {
        const eventId = eventDetailMatch[1]
        const vis = visibilityClause(user, 'e')
        const row = db.prepare(`SELECT e.* FROM events e WHERE e.id = ? AND ${vis.sql}`).get(eventId, ...vis.params)
        if (!row) {
          sendJson(res, 404, { error: 'Event not found.' })
          return
        }
        const gallery = queryGallery(db, user)
        const ach = queryAchievements(db, user)
        sendJson(res, 200, {
          event: mapEventRow(row),
          gallery: {
            photos: gallery.photos.filter(p => p.eventId === eventId),
            albums: gallery.albums.filter(a => a.eventId === eventId),
            videos: gallery.videos.filter(v => v.eventId === eventId),
            beforeAfter: gallery.beforeAfter.filter(b => b.eventId === eventId),
          },
          achievements: {
            awards: ach.awards.filter(a => a.eventId === eventId),
            certificates: ach.certificates.filter(c => c.eventId === eventId),
            timeline: ach.timeline.filter(t => t.eventId === eventId),
            stories: ach.stories.filter(s => s.eventId === eventId),
          },
        })
        return
      }

      if (method === 'POST' && pathname === '/api/events') {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title || '').trim()
        if (!title) {
          sendJson(res, 400, { error: 'Event title is required.' })
          return
        }
        const id = 'event-' + crypto.randomUUID()
        const now = new Date().toISOString()
        const start = String(body.start || '').trim()
        const end = String(body.end || '').trim()
        const date = String(body.date || (start ? start.slice(0, 10) : '')).trim()
        const cover = sanitizeUrl(body.cover || '')
        const status = normalizeStatus(body.status, user)

        db.prepare(`
          INSERT INTO events (id, title, date, start_time, end_time, location, description, cover_url, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, title, date, start, end, String(body.location || '').trim(), String(body.description || '').trim(), cover, status, user.id, now, now)

        const created = queryEvents(db, user).find(e => e.id === id)
        sendJson(res, 201, { event: created })
        return
      }

      if (method === 'PUT' && eventDetailMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const id = eventDetailMatch[1]
        const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id)
        if (!existing) {
          sendJson(res, 404, { error: 'Event not found.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title ?? existing.title).trim()
        if (!title) {
          sendJson(res, 400, { error: 'Event title is required.' })
          return
        }
        const start = body.start !== undefined ? String(body.start).trim() : existing.start_time
        const end = body.end !== undefined ? String(body.end).trim() : existing.end_time
        const date = body.date !== undefined ? String(body.date).trim() : (start ? start.slice(0, 10) : existing.date)
        const cover = body.cover !== undefined ? sanitizeUrl(body.cover) : existing.cover_url
        const status = body.status !== undefined ? normalizeStatus(body.status, user) : existing.status
        const now = new Date().toISOString()

        db.prepare(`
          UPDATE events SET title = ?, date = ?, start_time = ?, end_time = ?, location = ?, description = ?, cover_url = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          title,
          date,
          start,
          end,
          body.location !== undefined ? String(body.location).trim() : existing.location,
          body.description !== undefined ? String(body.description).trim() : existing.description,
          cover,
          status,
          now,
          id
        )
        const updated = queryEvents(db, user).find(e => e.id === id)
        sendJson(res, 200, { event: updated })
        return
      }

      const eventPubMatch = pathname.match(/^\/api\/events\/([^/]+)\/publish$/)
      if (method === 'PATCH' && eventPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const id = eventPubMatch[1]
        const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id)
        if (!existing) {
          sendJson(res, 404, { error: 'Event not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE events SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), id)
        const updated = queryEvents(db, user).find(e => e.id === id)
        sendJson(res, 200, { event: updated })
        return
      }

      if (method === 'DELETE' && eventDetailMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM events WHERE id = ?').run(eventDetailMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Event not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // ─── Gallery ───────────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/api/gallery') {
        sendJson(res, 200, queryGallery(db, user))
        return
      }

      // Photos CRUD
      if (method === 'POST' && pathname === '/api/gallery/photos') {
        if (!canSubmitDraft(user)) {
          sendJson(res, 401, { error: 'Sign in required.' })
          return
        }
        const body = await readJsonBody(req)
        const url = sanitizeUrl(body.url)
        if (!url) {
          sendJson(res, 400, { error: 'A valid photo URL or uploaded file is required.' })
          return
        }
        const id = 'photo-' + crypto.randomUUID()
        const now = new Date().toISOString()
        const tags = Array.isArray(body.tags)
          ? body.tags.map(t => String(t).trim()).filter(Boolean)
          : String(body.tags || '').split(',').map(t => t.trim()).filter(Boolean)
        const status = normalizeStatus(body.status, user)

        db.prepare(`
          INSERT INTO gallery_photos (id, url, caption, category, year, event_id, album_id, tags_json, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          url,
          String(body.caption || '').trim(),
          String(body.category || 'other').trim().toLowerCase(),
          parseIntOrNull(body.year),
          normalizeEventId(db, body.eventId),
          normalizeAlbumId(db, body.albumId),
          JSON.stringify(tags),
          status,
          user.id,
          now,
          now
        )
        const created = queryGallery(db, user).photos.find(p => p.id === id)
        sendJson(res, 201, { photo: created })
        return
      }

      const photoMatch = pathname.match(/^\/api\/gallery\/photos\/([^/]+)$/)
      const photoPubMatch = pathname.match(/^\/api\/gallery\/photos\/([^/]+)\/publish$/)
      if (method === 'PUT' && photoMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM gallery_photos WHERE id = ?').get(photoMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Photo not found.' })
          return
        }
        const body = await readJsonBody(req)
        const url = body.url !== undefined ? sanitizeUrl(body.url) : existing.url
        if (!url) {
          sendJson(res, 400, { error: 'Valid photo URL required.' })
          return
        }
        const tags = body.tags !== undefined
          ? (Array.isArray(body.tags) ? body.tags : String(body.tags).split(',')).map(t => String(t).trim()).filter(Boolean)
          : JSON.parse(existing.tags_json || '[]')
        db.prepare(`
          UPDATE gallery_photos SET url = ?, caption = ?, category = ?, year = ?, event_id = ?, album_id = ?, tags_json = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          url,
          body.caption !== undefined ? String(body.caption).trim() : existing.caption,
          body.category !== undefined ? String(body.category).trim().toLowerCase() : existing.category,
          body.year !== undefined ? parseIntOrNull(body.year) : existing.year,
          body.eventId !== undefined ? normalizeEventId(db, body.eventId) : existing.event_id,
          body.albumId !== undefined ? normalizeAlbumId(db, body.albumId) : existing.album_id,
          JSON.stringify(tags),
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          new Date().toISOString(),
          existing.id
        )
        const updated = queryGallery(db, user).photos.find(p => p.id === existing.id)
        sendJson(res, 200, { photo: updated })
        return
      }
      if (method === 'PATCH' && photoPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM gallery_photos WHERE id = ?').get(photoPubMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Photo not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE gallery_photos SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id)
        const updated = queryGallery(db, user).photos.find(p => p.id === existing.id)
        sendJson(res, 200, { photo: updated })
        return
      }
      if (method === 'DELETE' && photoMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM gallery_photos WHERE id = ?').run(photoMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Photo not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // Albums CRUD
      if (method === 'POST' && pathname === '/api/gallery/albums') {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title || '').trim()
        if (!title) {
          sendJson(res, 400, { error: 'Album title is required.' })
          return
        }
        const id = 'album-' + crypto.randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO gallery_albums (id, title, description, cover_url, event_id, year, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          title,
          String(body.description || '').trim(),
          sanitizeUrl(body.coverUrl || ''),
          normalizeEventId(db, body.eventId),
          parseIntOrNull(body.year),
          normalizeStatus(body.status, user),
          user.id,
          now,
          now
        )
        const created = queryGallery(db, user).albums.find(a => a.id === id)
        sendJson(res, 201, { album: created })
        return
      }

      const albumMatch = pathname.match(/^\/api\/gallery\/albums\/([^/]+)$/)
      const albumPubMatch = pathname.match(/^\/api\/gallery\/albums\/([^/]+)\/publish$/)
      if (method === 'PUT' && albumMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM gallery_albums WHERE id = ?').get(albumMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Album not found.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title ?? existing.title).trim()
        if (!title) {
          sendJson(res, 400, { error: 'Album title is required.' })
          return
        }
        db.prepare(`
          UPDATE gallery_albums SET title = ?, description = ?, cover_url = ?, event_id = ?, year = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          title,
          body.description !== undefined ? String(body.description).trim() : existing.description,
          body.coverUrl !== undefined ? sanitizeUrl(body.coverUrl) : existing.cover_url,
          body.eventId !== undefined ? normalizeEventId(db, body.eventId) : existing.event_id,
          body.year !== undefined ? parseIntOrNull(body.year) : existing.year,
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          new Date().toISOString(),
          existing.id
        )
        const updated = queryGallery(db, user).albums.find(a => a.id === existing.id)
        sendJson(res, 200, { album: updated })
        return
      }
      if (method === 'PATCH' && albumPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM gallery_albums WHERE id = ?').get(albumPubMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Album not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE gallery_albums SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id)
        const updated = queryGallery(db, user).albums.find(a => a.id === existing.id)
        sendJson(res, 200, { album: updated })
        return
      }
      if (method === 'DELETE' && albumMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM gallery_albums WHERE id = ?').run(albumMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Album not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // Videos CRUD
      if (method === 'POST' && pathname === '/api/gallery/videos') {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title || '').trim()
        const url = sanitizeUrl(body.url)
        if (!title || !url) {
          sendJson(res, 400, { error: 'Video title and valid URL are required.' })
          return
        }
        const id = 'video-' + crypto.randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO gallery_videos (id, title, url, thumbnail_url, category, description, duration, event_id, year, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          title,
          url,
          sanitizeUrl(body.thumbnailUrl || ''),
          String(body.category || 'other').trim().toLowerCase(),
          String(body.description || '').trim(),
          String(body.duration || '').trim(),
          normalizeEventId(db, body.eventId),
          parseIntOrNull(body.year),
          normalizeStatus(body.status, user),
          user.id,
          now,
          now
        )
        const created = queryGallery(db, user).videos.find(v => v.id === id)
        sendJson(res, 201, { video: created })
        return
      }

      const videoMatch = pathname.match(/^\/api\/gallery\/videos\/([^/]+)$/)
      const videoPubMatch = pathname.match(/^\/api\/gallery\/videos\/([^/]+)\/publish$/)
      if (method === 'PUT' && videoMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM gallery_videos WHERE id = ?').get(videoMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Video not found.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title ?? existing.title).trim()
        const url = body.url !== undefined ? sanitizeUrl(body.url) : existing.url
        if (!title || !url) {
          sendJson(res, 400, { error: 'Video title and valid URL required.' })
          return
        }
        db.prepare(`
          UPDATE gallery_videos SET title = ?, url = ?, thumbnail_url = ?, category = ?, description = ?, duration = ?, event_id = ?, year = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          title,
          url,
          body.thumbnailUrl !== undefined ? sanitizeUrl(body.thumbnailUrl) : existing.thumbnail_url,
          body.category !== undefined ? String(body.category).trim().toLowerCase() : existing.category,
          body.description !== undefined ? String(body.description).trim() : existing.description,
          body.duration !== undefined ? String(body.duration).trim() : existing.duration,
          body.eventId !== undefined ? normalizeEventId(db, body.eventId) : existing.event_id,
          body.year !== undefined ? parseIntOrNull(body.year) : existing.year,
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          new Date().toISOString(),
          existing.id
        )
        const updated = queryGallery(db, user).videos.find(v => v.id === existing.id)
        sendJson(res, 200, { video: updated })
        return
      }
      if (method === 'PATCH' && videoPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM gallery_videos WHERE id = ?').get(videoPubMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Video not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE gallery_videos SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id)
        const updated = queryGallery(db, user).videos.find(v => v.id === existing.id)
        sendJson(res, 200, { video: updated })
        return
      }
      if (method === 'DELETE' && videoMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM gallery_videos WHERE id = ?').run(videoMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Video not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // Before / After CRUD
      if (method === 'POST' && pathname === '/api/gallery/before-after') {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const body = await readJsonBody(req)
        const beforeUrl = sanitizeUrl(body.beforeUrl)
        const afterUrl = sanitizeUrl(body.afterUrl)
        if (!beforeUrl || !afterUrl) {
          sendJson(res, 400, { error: 'Valid Before and After image URLs are required.' })
          return
        }
        const id = 'ba-' + crypto.randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO gallery_before_after (id, title, description, before_url, after_url, event_id, year, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          String(body.title || '').trim(),
          String(body.description || '').trim(),
          beforeUrl,
          afterUrl,
          normalizeEventId(db, body.eventId),
          parseIntOrNull(body.year),
          normalizeStatus(body.status, user),
          user.id,
          now,
          now
        )
        const created = queryGallery(db, user).beforeAfter.find(b => b.id === id)
        sendJson(res, 201, { beforeAfter: created })
        return
      }

      const baMatch = pathname.match(/^\/api\/gallery\/before-after\/([^/]+)$/)
      const baPubMatch = pathname.match(/^\/api\/gallery\/before-after\/([^/]+)\/publish$/)
      if (method === 'PUT' && baMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM gallery_before_after WHERE id = ?').get(baMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Comparison not found.' })
          return
        }
        const body = await readJsonBody(req)
        const beforeUrl = body.beforeUrl !== undefined ? sanitizeUrl(body.beforeUrl) : existing.before_url
        const afterUrl = body.afterUrl !== undefined ? sanitizeUrl(body.afterUrl) : existing.after_url
        if (!beforeUrl || !afterUrl) {
          sendJson(res, 400, { error: 'Valid Before and After image URLs required.' })
          return
        }
        db.prepare(`
          UPDATE gallery_before_after SET title = ?, description = ?, before_url = ?, after_url = ?, event_id = ?, year = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          body.title !== undefined ? String(body.title).trim() : existing.title,
          body.description !== undefined ? String(body.description).trim() : existing.description,
          beforeUrl,
          afterUrl,
          body.eventId !== undefined ? normalizeEventId(db, body.eventId) : existing.event_id,
          body.year !== undefined ? parseIntOrNull(body.year) : existing.year,
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          new Date().toISOString(),
          existing.id
        )
        const updated = queryGallery(db, user).beforeAfter.find(b => b.id === existing.id)
        sendJson(res, 200, { beforeAfter: updated })
        return
      }
      if (method === 'PATCH' && baPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM gallery_before_after WHERE id = ?').get(baPubMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Comparison not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE gallery_before_after SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id)
        const updated = queryGallery(db, user).beforeAfter.find(b => b.id === existing.id)
        sendJson(res, 200, { beforeAfter: updated })
        return
      }
      if (method === 'DELETE' && baMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM gallery_before_after WHERE id = ?').run(baMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Comparison not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // Featured Carousel CRUD
      if (method === 'POST' && pathname === '/api/gallery/featured') {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const body = await readJsonBody(req)
        const photo = db.prepare('SELECT id FROM gallery_photos WHERE id = ?').get(body.photoId)
        if (!photo) {
          sendJson(res, 400, { error: 'Select a valid existing gallery photo.' })
          return
        }
        const id = 'feat-' + crypto.randomUUID()
        db.prepare(`
          INSERT INTO gallery_featured (id, photo_id, caption, sort_order, status, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          photo.id,
          String(body.caption || '').trim(),
          Number(body.order || 0),
          normalizeStatus(body.status, user),
          user.id,
          new Date().toISOString()
        )
        const created = queryGallery(db, user).featured.find(f => f.id === id) || { id, photoId: photo.id }
        sendJson(res, 201, { featured: created })
        return
      }

      const featMatch = pathname.match(/^\/api\/gallery\/featured\/([^/]+)$/)
      if (method === 'PUT' && featMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM gallery_featured WHERE id = ?').get(featMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Featured entry not found.' })
          return
        }
        const body = await readJsonBody(req)
        const photoId = body.photoId || existing.photo_id
        const photo = db.prepare('SELECT id FROM gallery_photos WHERE id = ?').get(photoId)
        if (!photo) {
          sendJson(res, 400, { error: 'Invalid photo selection.' })
          return
        }
        db.prepare(`
          UPDATE gallery_featured SET photo_id = ?, caption = ?, sort_order = ?, status = ? WHERE id = ?
        `).run(
          photoId,
          body.caption !== undefined ? String(body.caption).trim() : existing.caption,
          body.order !== undefined ? Number(body.order || 0) : existing.sort_order,
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          existing.id
        )
        const updated = queryGallery(db, user).featured.find(f => f.id === existing.id) || { id: existing.id }
        sendJson(res, 200, { featured: updated })
        return
      }
      if (method === 'DELETE' && featMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM gallery_featured WHERE id = ?').run(featMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Featured entry not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // ─── Achievements ──────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/api/achievements') {
        sendJson(res, 200, queryAchievements(db, user))
        return
      }

      // Impact Stats CRUD
      if (method === 'POST' && pathname === '/api/achievements/impact-stats') {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const body = await readJsonBody(req)
        const label = String(body.label || '').trim()
        if (!label) {
          sendJson(res, 400, { error: 'Impact statistic label is required.' })
          return
        }
        const id = 'stat-' + crypto.randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO impact_stats (id, label, value, unit, icon, description, year, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          label,
          Number(body.value || 0),
          String(body.unit || '').trim(),
          String(body.icon || '🌱').trim(),
          String(body.description || '').trim(),
          parseIntOrNull(body.year),
          normalizeStatus(body.status, user),
          user.id,
          now,
          now
        )
        const created = queryAchievements(db, user).impactStats.find(s => s.id === id)
        sendJson(res, 201, { stat: created })
        return
      }

      const statMatch = pathname.match(/^\/api\/achievements\/impact-stats\/([^/]+)$/)
      const statPubMatch = pathname.match(/^\/api\/achievements\/impact-stats\/([^/]+)\/publish$/)
      if (method === 'PUT' && statMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM impact_stats WHERE id = ?').get(statMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Impact statistic not found.' })
          return
        }
        const body = await readJsonBody(req)
        const label = String(body.label ?? existing.label).trim()
        if (!label) {
          sendJson(res, 400, { error: 'Label is required.' })
          return
        }
        db.prepare(`
          UPDATE impact_stats SET label = ?, value = ?, unit = ?, icon = ?, description = ?, year = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          label,
          body.value !== undefined ? Number(body.value || 0) : existing.value,
          body.unit !== undefined ? String(body.unit).trim() : existing.unit,
          body.icon !== undefined ? String(body.icon).trim() : existing.icon,
          body.description !== undefined ? String(body.description).trim() : existing.description,
          body.year !== undefined ? parseIntOrNull(body.year) : existing.year,
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          new Date().toISOString(),
          existing.id
        )
        const updated = queryAchievements(db, user).impactStats.find(s => s.id === existing.id)
        sendJson(res, 200, { stat: updated })
        return
      }
      if (method === 'PATCH' && statPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM impact_stats WHERE id = ?').get(statPubMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Statistic not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE impact_stats SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id)
        const updated = queryAchievements(db, user).impactStats.find(s => s.id === existing.id)
        sendJson(res, 200, { stat: updated })
        return
      }
      if (method === 'DELETE' && statMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM impact_stats WHERE id = ?').run(statMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Statistic not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // Awards CRUD
      if (method === 'POST' && pathname === '/api/achievements/awards') {
        if (!canSubmitDraft(user)) {
          sendJson(res, 401, { error: 'Sign in required.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title || '').trim()
        if (!title) {
          sendJson(res, 400, { error: 'Award title is required.' })
          return
        }
        const id = 'award-' + crypto.randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO achievement_awards (id, title, description, organization, recipient, impact_metric, category, year, featured, event_id, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          title,
          String(body.description || '').trim(),
          String(body.organization || '').trim(),
          String(body.recipient || '').trim(),
          String(body.impactMetric || '').trim(),
          String(body.category || 'environmental').trim().toLowerCase(),
          parseIntOrNull(body.year),
          body.featured ? 1 : 0,
          normalizeEventId(db, body.eventId),
          normalizeStatus(body.status, user),
          user.id,
          now,
          now
        )
        const created = queryAchievements(db, user).awards.find(a => a.id === id)
        sendJson(res, 201, { award: created })
        return
      }

      const awardMatch = pathname.match(/^\/api\/achievements\/awards\/([^/]+)$/)
      const awardPubMatch = pathname.match(/^\/api\/achievements\/awards\/([^/]+)\/publish$/)
      if (method === 'PUT' && awardMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM achievement_awards WHERE id = ?').get(awardMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Award not found.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title ?? existing.title).trim()
        if (!title) {
          sendJson(res, 400, { error: 'Award title is required.' })
          return
        }
        db.prepare(`
          UPDATE achievement_awards SET title = ?, description = ?, organization = ?, recipient = ?, impact_metric = ?, category = ?, year = ?, featured = ?, event_id = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          title,
          body.description !== undefined ? String(body.description).trim() : existing.description,
          body.organization !== undefined ? String(body.organization).trim() : existing.organization,
          body.recipient !== undefined ? String(body.recipient).trim() : existing.recipient,
          body.impactMetric !== undefined ? String(body.impactMetric).trim() : existing.impact_metric,
          body.category !== undefined ? String(body.category).trim().toLowerCase() : existing.category,
          body.year !== undefined ? parseIntOrNull(body.year) : existing.year,
          body.featured !== undefined ? (body.featured ? 1 : 0) : existing.featured,
          body.eventId !== undefined ? normalizeEventId(db, body.eventId) : existing.event_id,
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          new Date().toISOString(),
          existing.id
        )
        const updated = queryAchievements(db, user).awards.find(a => a.id === existing.id)
        sendJson(res, 200, { award: updated })
        return
      }
      if (method === 'PATCH' && awardPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM achievement_awards WHERE id = ?').get(awardPubMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Award not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE achievement_awards SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id)
        const updated = queryAchievements(db, user).awards.find(a => a.id === existing.id)
        sendJson(res, 200, { award: updated })
        return
      }
      if (method === 'DELETE' && awardMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM achievement_awards WHERE id = ?').run(awardMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Award not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // Certificates CRUD & Permitted Download
      if (method === 'POST' && pathname === '/api/achievements/certificates') {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title || '').trim()
        if (!title) {
          sendJson(res, 400, { error: 'Certificate title is required.' })
          return
        }
        const policy = ['public', 'members', 'restricted'].includes(body.downloadPolicy) ? body.downloadPolicy : 'public'
        const allowDownload = policy === 'restricted' ? 0 : (body.allowDownload === false ? 0 : 1)
        const id = 'cert-' + crypto.randomUUID()
        const now = new Date().toISOString()

        db.prepare(`
          INSERT INTO achievement_certificates (id, title, description, issued_by, recipient_name, year, image_url, download_url, allow_download, download_policy, download_count, event_id, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
        `).run(
          id,
          title,
          String(body.description || '').trim(),
          String(body.issuedBy || '').trim(),
          String(body.recipientName || body.recipient || '').trim(),
          parseIntOrNull(body.year),
          sanitizeUrl(body.imageUrl || ''),
          sanitizeUrl(body.downloadUrl || ''),
          allowDownload,
          policy,
          normalizeEventId(db, body.eventId),
          normalizeStatus(body.status, user),
          user.id,
          now,
          now
        )
        const created = queryAchievements(db, user).certificates.find(c => c.id === id)
        sendJson(res, 201, { certificate: created })
        return
      }

      const certDownloadMatch = pathname.match(/^\/api\/achievements\/certificates\/([^/]+)\/download$/)
      if (method === 'GET' && certDownloadMatch) {
        const cert = db.prepare('SELECT * FROM achievement_certificates WHERE id = ?').get(certDownloadMatch[1])
        if (!cert || (cert.status !== 'published' && !canManageContent(user))) {
          sendJson(res, 404, { error: 'Certificate not found.' })
          return
        }
        if (!cert.allow_download || cert.download_policy === 'restricted') {
          if (!canManageContent(user)) {
            sendJson(res, 403, { error: 'Download is restricted for this certificate (preview only).' })
            return
          }
        } else if (cert.download_policy === 'members' && !user) {
          sendJson(res, 401, { error: 'Sign in with an Eco Club account to download this certificate.' })
          return
        }

        const targetUrl = cert.download_url || cert.image_url
        if (!targetUrl) {
          sendJson(res, 404, { error: 'No downloadable file is attached to this certificate.' })
          return
        }

        db.prepare('UPDATE achievement_certificates SET download_count = download_count + 1 WHERE id = ?').run(cert.id)

        if (reqUrl.searchParams.get('mode') === 'json') {
          const downloadEndpoint = targetUrl.startsWith('/uploads/')
            ? `/uploads/${path.basename(targetUrl)}?download=1`
            : targetUrl
          sendJson(res, 200, { url: downloadEndpoint, downloadCount: Number(cert.download_count || 0) + 1 })
          return
        }

        if (targetUrl.startsWith('/uploads/')) {
          const served = serveUploadedFile(req, res, uploadDir, path.basename(targetUrl), true, cert.title || 'certificate')
          if (!served) sendJson(res, 404, { error: 'Certificate file missing from storage.' })
          return
        }

        res.writeHead(302, { Location: targetUrl })
        res.end()
        return
      }

      const certMatch = pathname.match(/^\/api\/achievements\/certificates\/([^/]+)$/)
      const certPubMatch = pathname.match(/^\/api\/achievements\/certificates\/([^/]+)\/publish$/)
      if (method === 'PUT' && certMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM achievement_certificates WHERE id = ?').get(certMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Certificate not found.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title ?? existing.title).trim()
        if (!title) {
          sendJson(res, 400, { error: 'Certificate title is required.' })
          return
        }
        const policy = body.downloadPolicy !== undefined && ['public', 'members', 'restricted'].includes(body.downloadPolicy)
          ? body.downloadPolicy
          : existing.download_policy
        const allowDownload = policy === 'restricted'
          ? 0
          : (body.allowDownload !== undefined ? (body.allowDownload ? 1 : 0) : existing.allow_download)

        db.prepare(`
          UPDATE achievement_certificates SET title = ?, description = ?, issued_by = ?, recipient_name = ?, year = ?, image_url = ?, download_url = ?, allow_download = ?, download_policy = ?, event_id = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          title,
          body.description !== undefined ? String(body.description).trim() : existing.description,
          body.issuedBy !== undefined ? String(body.issuedBy).trim() : existing.issued_by,
          (body.recipientName ?? body.recipient) !== undefined ? String(body.recipientName ?? body.recipient).trim() : existing.recipient_name,
          body.year !== undefined ? parseIntOrNull(body.year) : existing.year,
          body.imageUrl !== undefined ? sanitizeUrl(body.imageUrl) : existing.image_url,
          body.downloadUrl !== undefined ? sanitizeUrl(body.downloadUrl) : existing.download_url,
          allowDownload,
          policy,
          body.eventId !== undefined ? normalizeEventId(db, body.eventId) : existing.event_id,
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          new Date().toISOString(),
          existing.id
        )
        const updated = queryAchievements(db, user).certificates.find(c => c.id === existing.id)
        sendJson(res, 200, { certificate: updated })
        return
      }
      if (method === 'PATCH' && certPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM achievement_certificates WHERE id = ?').get(certPubMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Certificate not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE achievement_certificates SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id)
        const updated = queryAchievements(db, user).certificates.find(c => c.id === existing.id)
        sendJson(res, 200, { certificate: updated })
        return
      }
      if (method === 'DELETE' && certMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM achievement_certificates WHERE id = ?').run(certMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Certificate not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // Timeline CRUD
      if (method === 'POST' && pathname === '/api/achievements/timeline') {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title || '').trim()
        if (!title) {
          sendJson(res, 400, { error: 'Timeline entry title is required.' })
          return
        }
        const id = 'tl-' + crypto.randomUUID()
        const now = new Date().toISOString()
        const date = String(body.date || '').trim()
        const year = parseIntOrNull(body.year) || (date ? parseIntOrNull(date.slice(0, 4)) : null)
        db.prepare(`
          INSERT INTO achievement_timeline (id, title, description, date, year, category, event_id, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          title,
          String(body.description || '').trim(),
          date,
          year,
          String(body.category || 'environmental').trim().toLowerCase(),
          normalizeEventId(db, body.eventId),
          normalizeStatus(body.status, user),
          user.id,
          now,
          now
        )
        const created = queryAchievements(db, user).timeline.find(t => t.id === id)
        sendJson(res, 201, { entry: created })
        return
      }

      const tlMatch = pathname.match(/^\/api\/achievements\/timeline\/([^/]+)$/)
      const tlPubMatch = pathname.match(/^\/api\/achievements\/timeline\/([^/]+)\/publish$/)
      if (method === 'PUT' && tlMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM achievement_timeline WHERE id = ?').get(tlMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Timeline entry not found.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title ?? existing.title).trim()
        if (!title) {
          sendJson(res, 400, { error: 'Title is required.' })
          return
        }
        const date = body.date !== undefined ? String(body.date).trim() : existing.date
        const year = body.year !== undefined ? parseIntOrNull(body.year) : (date ? parseIntOrNull(date.slice(0, 4)) : existing.year)
        db.prepare(`
          UPDATE achievement_timeline SET title = ?, description = ?, date = ?, year = ?, category = ?, event_id = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          title,
          body.description !== undefined ? String(body.description).trim() : existing.description,
          date,
          year,
          body.category !== undefined ? String(body.category).trim().toLowerCase() : existing.category,
          body.eventId !== undefined ? normalizeEventId(db, body.eventId) : existing.event_id,
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          new Date().toISOString(),
          existing.id
        )
        const updated = queryAchievements(db, user).timeline.find(t => t.id === existing.id)
        sendJson(res, 200, { entry: updated })
        return
      }
      if (method === 'PATCH' && tlPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM achievement_timeline WHERE id = ?').get(tlPubMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Timeline entry not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE achievement_timeline SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id)
        const updated = queryAchievements(db, user).timeline.find(t => t.id === existing.id)
        sendJson(res, 200, { entry: updated })
        return
      }
      if (method === 'DELETE' && tlMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM achievement_timeline WHERE id = ?').run(tlMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Timeline entry not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // Hall of Fame CRUD
      if (method === 'POST' && pathname === '/api/achievements/hall-of-fame') {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const body = await readJsonBody(req)
        const name = String(body.name || '').trim()
        if (!name) {
          sendJson(res, 400, { error: 'Member name is required.' })
          return
        }
        const id = 'hof-' + crypto.randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO achievement_hall_of_fame (id, name, role, year, honor_badge, contribution, photo_url, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          name,
          String(body.role || '').trim(),
          parseIntOrNull(body.year),
          String(body.honorBadge || '').trim(),
          String(body.contribution || '').trim(),
          sanitizeUrl(body.photoUrl || ''),
          normalizeStatus(body.status, user),
          user.id,
          now,
          now
        )
        const created = queryAchievements(db, user).hallOfFame.find(h => h.id === id)
        sendJson(res, 201, { member: created })
        return
      }

      const hofMatch = pathname.match(/^\/api\/achievements\/hall-of-fame\/([^/]+)$/)
      const hofPubMatch = pathname.match(/^\/api\/achievements\/hall-of-fame\/([^/]+)\/publish$/)
      if (method === 'PUT' && hofMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM achievement_hall_of_fame WHERE id = ?').get(hofMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Member not found.' })
          return
        }
        const body = await readJsonBody(req)
        const name = String(body.name ?? existing.name).trim()
        if (!name) {
          sendJson(res, 400, { error: 'Member name is required.' })
          return
        }
        db.prepare(`
          UPDATE achievement_hall_of_fame SET name = ?, role = ?, year = ?, honor_badge = ?, contribution = ?, photo_url = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          name,
          body.role !== undefined ? String(body.role).trim() : existing.role,
          body.year !== undefined ? parseIntOrNull(body.year) : existing.year,
          body.honorBadge !== undefined ? String(body.honorBadge).trim() : existing.honor_badge,
          body.contribution !== undefined ? String(body.contribution).trim() : existing.contribution,
          body.photoUrl !== undefined ? sanitizeUrl(body.photoUrl) : existing.photo_url,
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          new Date().toISOString(),
          existing.id
        )
        const updated = queryAchievements(db, user).hallOfFame.find(h => h.id === existing.id)
        sendJson(res, 200, { member: updated })
        return
      }
      if (method === 'PATCH' && hofPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM achievement_hall_of_fame WHERE id = ?').get(hofPubMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Member not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE achievement_hall_of_fame SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id)
        const updated = queryAchievements(db, user).hallOfFame.find(h => h.id === existing.id)
        sendJson(res, 200, { member: updated })
        return
      }
      if (method === 'DELETE' && hofMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM achievement_hall_of_fame WHERE id = ?').run(hofMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Member not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      // Stories CRUD
      if (method === 'POST' && pathname === '/api/achievements/stories') {
        if (!canSubmitDraft(user)) {
          sendJson(res, 401, { error: 'Sign in required.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title || '').trim()
        if (!title) {
          sendJson(res, 400, { error: 'Story title is required.' })
          return
        }
        const id = 'story-' + crypto.randomUUID()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO achievement_stories (id, title, content, author_name, category, year, image_url, featured, event_id, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          title,
          String(body.content || '').trim(),
          String(body.authorName || body.author || user.name).trim(),
          String(body.category || 'sustainability').trim().toLowerCase(),
          parseIntOrNull(body.year),
          sanitizeUrl(body.imageUrl || ''),
          canManageContent(user) && body.featured ? 1 : 0,
          normalizeEventId(db, body.eventId),
          normalizeStatus(body.status, user),
          user.id,
          now,
          now
        )
        const created = queryAchievements(db, user).stories.find(s => s.id === id)
        sendJson(res, 201, { story: created })
        return
      }

      const storyMatch = pathname.match(/^\/api\/achievements\/stories\/([^/]+)$/)
      const storyPubMatch = pathname.match(/^\/api\/achievements\/stories\/([^/]+)\/publish$/)
      if (method === 'PUT' && storyMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM achievement_stories WHERE id = ?').get(storyMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Story not found.' })
          return
        }
        const body = await readJsonBody(req)
        const title = String(body.title ?? existing.title).trim()
        if (!title) {
          sendJson(res, 400, { error: 'Story title is required.' })
          return
        }
        db.prepare(`
          UPDATE achievement_stories SET title = ?, content = ?, author_name = ?, category = ?, year = ?, image_url = ?, featured = ?, event_id = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          title,
          body.content !== undefined ? String(body.content).trim() : existing.content,
          (body.authorName ?? body.author) !== undefined ? String(body.authorName ?? body.author).trim() : existing.author_name,
          body.category !== undefined ? String(body.category).trim().toLowerCase() : existing.category,
          body.year !== undefined ? parseIntOrNull(body.year) : existing.year,
          body.imageUrl !== undefined ? sanitizeUrl(body.imageUrl) : existing.image_url,
          body.featured !== undefined ? (body.featured ? 1 : 0) : existing.featured,
          body.eventId !== undefined ? normalizeEventId(db, body.eventId) : existing.event_id,
          body.status !== undefined ? normalizeStatus(body.status, user) : existing.status,
          new Date().toISOString(),
          existing.id
        )
        const updated = queryAchievements(db, user).stories.find(s => s.id === existing.id)
        sendJson(res, 200, { story: updated })
        return
      }
      if (method === 'PATCH' && storyPubMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const existing = db.prepare('SELECT * FROM achievement_stories WHERE id = ?').get(storyPubMatch[1])
        if (!existing) {
          sendJson(res, 404, { error: 'Story not found.' })
          return
        }
        const body = await readJsonBody(req)
        const nextStatus = body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : (existing.status === 'published' ? 'draft' : 'published')
        db.prepare('UPDATE achievement_stories SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, new Date().toISOString(), existing.id)
        const updated = queryAchievements(db, user).stories.find(s => s.id === existing.id)
        sendJson(res, 200, { story: updated })
        return
      }
      if (method === 'DELETE' && storyMatch) {
        if (!canManageContent(user)) {
          sendJson(res, user ? 403 : 401, { error: 'Editor or Administrator permission required.' })
          return
        }
        const info = db.prepare('DELETE FROM achievement_stories WHERE id = ?').run(storyMatch[1])
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Story not found.' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      sendJson(res, 404, { error: `Unknown API route: ${method} ${pathname}` })
    } catch (error) {
      if (error?.message === 'PAYLOAD_TOO_LARGE') {
        sendJson(res, 413, { error: 'Request payload too large.' })
        return
      }
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { error: 'Invalid JSON request body.' })
        return
      }
      console.error('API Error:', error)
      sendJson(res, 500, { error: 'Internal server error.' })
    }
  }
}
