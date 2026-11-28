import crypto from 'node:crypto'

export const SESSION_COOKIE = 'ecoclub_session'
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export function createAuthSecret(db) {
  if (process.env.ECO_CLUB_AUTH_SECRET) {
    return process.env.ECO_CLUB_AUTH_SECRET
  }
  const existing = db.prepare("SELECT value FROM settings WHERE key = 'auth_secret'").get()
  if (existing?.value) return existing.value
  const generated = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
    'auth_secret',
    generated,
    new Date().toISOString()
  )
  return generated
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, keyHex] = storedHash.split(':')
  const keyBuf = Buffer.from(keyHex, 'hex')
  const derived = crypto.scryptSync(password, salt, 64)
  if (keyBuf.length !== derived.length) return false
  return crypto.timingSafeEqual(keyBuf, derived)
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url')
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

export function signToken(payload, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS })
  )
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${signature}`
}

export function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(base64UrlDecode(body))
    if (!parsed.exp || parsed.exp < Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

export function parseCookies(cookieHeader = '') {
  const cookies = {}
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    try {
      cookies[key] = decodeURIComponent(val)
    } catch {
      cookies[key] = val
    }
  }
  return cookies
}

export function getRequestUser(req, db, secret) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (parseCookies(req.headers.cookie || '')[SESSION_COOKIE] || '')
  const payload = verifyToken(token, secret)
  if (!payload?.sub) return null
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(payload.sub)
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at } : null
}

export function canManageContent(user) {
  return Boolean(user && (user.role === 'admin' || user.role === 'editor'))
}

export function canSubmitDraft(user) {
  return Boolean(user && ['admin', 'editor', 'member'].includes(user.role))
}

export function isAdmin(user) {
  return Boolean(user && user.role === 'admin')
}
