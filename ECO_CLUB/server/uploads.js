import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 // 50 MB max

const ALLOWED_SIGNATURES = [
  { ext: '.jpg', mime: 'image/jpeg', kind: 'image', match: buf => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff },
  { ext: '.png', mime: 'image/png', kind: 'image', match: buf => buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a },
  { ext: '.gif', mime: 'image/gif', kind: 'image', match: buf => buf.length >= 6 && (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a') },
  { ext: '.webp', mime: 'image/webp', kind: 'image', match: buf => buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP' },
  { ext: '.pdf', mime: 'application/pdf', kind: 'document', match: buf => buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-' },
  { ext: '.mp4', mime: 'video/mp4', kind: 'video', match: buf => buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp' },
  { ext: '.webm', mime: 'video/webm', kind: 'video', match: buf => buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3 },
]

export function detectFileType(buffer) {
  for (const rule of ALLOWED_SIGNATURES) {
    if (rule.match(buffer)) return rule
  }
  return null
}

export function parseMultipart(bodyBuffer, contentType) {
  const match = contentType?.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)
  if (!match) {
    throw new Error('Missing multipart boundary')
  }
  const boundary = match[1] || match[2]
  const boundaryBytes = Buffer.from(`--${boundary}`)
  const parts = []
  let pos = bodyBuffer.indexOf(boundaryBytes)
  if (pos === -1) return parts

  while (pos !== -1) {
    const start = pos + boundaryBytes.length
    if (bodyBuffer.subarray(start, start + 2).toString() === '--') break
    const partStart = bodyBuffer[start] === 0x0d && bodyBuffer[start + 1] === 0x0a ? start + 2 : start + 1
    const nextPos = bodyBuffer.indexOf(boundaryBytes, partStart)
    if (nextPos === -1) break

    let partEnd = nextPos
    if (bodyBuffer[partEnd - 2] === 0x0d && bodyBuffer[partEnd - 1] === 0x0a) {
      partEnd -= 2
    } else if (bodyBuffer[partEnd - 1] === 0x0a) {
      partEnd -= 1
    }

    const partBuf = bodyBuffer.subarray(partStart, partEnd)
    const headerEnd = partBuf.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd !== -1) {
      const headerStr = partBuf.subarray(0, headerEnd).toString('utf8')
      const content = partBuf.subarray(headerEnd + 4)
      const dispMatch = headerStr.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i)
      const typeMatch = headerStr.match(/Content-Type:\s*([^\r\n;]+)/i)
      if (dispMatch) {
        parts.push({
          fieldName: dispMatch[1],
          filename: dispMatch[2] || '',
          contentType: typeMatch ? typeMatch[1].trim().toLowerCase() : 'application/octet-stream',
          data: content,
        })
      }
    }
    pos = nextPos
  }

  return parts
}

export async function handleFileUpload(req, db, uploadDir, user) {
  fs.mkdirSync(uploadDir, { recursive: true })
  const contentType = req.headers['content-type'] || ''
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return { status: 400, body: { error: 'Expected multipart/form-data upload.' } }
  }

  const chunks = []
  let totalSize = 0
  for await (const chunk of req) {
    totalSize += chunk.length
    if (totalSize > MAX_UPLOAD_BYTES) {
      return { status: 413, body: { error: 'File exceeds 50 MB size limit.' } }
    }
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks)
  let parts
  try {
    parts = parseMultipart(rawBody, contentType)
  } catch {
    return { status: 400, body: { error: 'Malformed multipart upload payload.' } }
  }

  const filePart = parts.find(p => p.filename && p.data.length > 0)
  if (!filePart) {
    return { status: 400, body: { error: 'No valid file found in upload.' } }
  }

  const detected = detectFileType(filePart.data)
  if (!detected) {
    return {
      status: 415,
      body: { error: 'Unsupported or unsafe file signature. Allowed: JPG, PNG, GIF, WebP, PDF, MP4, WebM.' },
    }
  }

  const kindField = parts.find(p => p.fieldName === 'kind')?.data?.toString('utf8')?.trim()
  if (kindField === 'image' && detected.kind !== 'image') {
    return { status: 415, body: { error: 'Expected an image file (JPG, PNG, GIF, or WebP).' } }
  }
  if (kindField === 'video' && detected.kind !== 'video') {
    return { status: 415, body: { error: 'Expected a video file (MP4 or WebM).' } }
  }
  if (kindField === 'certificate' && !['image', 'document'].includes(detected.kind)) {
    return { status: 415, body: { error: 'Expected an image or PDF file for certificate.' } }
  }

  const id = 'media-' + crypto.randomUUID()
  const safeFilename = `${crypto.randomUUID()}${detected.ext}`
  const targetPath = path.join(uploadDir, safeFilename)
  fs.writeFileSync(targetPath, filePart.data)

  const url = `/uploads/${safeFilename}`
  const now = new Date().toISOString()
  const originalName = path.basename(filePart.filename).slice(0, 180) || safeFilename

  db.prepare(`
    INSERT INTO media_uploads (id, filename, original_name, mime_type, size_bytes, kind, url, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, safeFilename, originalName, detected.mime, filePart.data.length, detected.kind, url, user.id, now)

  return {
    status: 201,
    body: {
      id,
      filename: safeFilename,
      originalName,
      mimeType: detected.mime,
      sizeBytes: filePart.data.length,
      kind: detected.kind,
      url,
      createdAt: now,
    },
  }
}

export function serveUploadedFile(req, res, uploadDir, requestedName, asDownload = false, customDownloadName = '') {
  let decodedName
  try {
    decodedName = decodeURIComponent(requestedName)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid filename' }))
    return true
  }
  const safeName = path.basename(decodedName)
  if (!safeName || safeName !== decodedName || safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid filename' }))
    return true
  }
  const filePath = path.join(uploadDir, safeName)
  if (!fs.existsSync(filePath)) return false

  const ext = path.extname(safeName).toLowerCase()
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  }
  const mime = mimeMap[ext] || 'application/octet-stream'
  const stat = fs.statSync(filePath)
  const headers = {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=86400',
  }
  if (asDownload) {
    const cleanName = (customDownloadName || safeName).replace(/[^\w.-]+/g, '_')
    headers['Content-Disposition'] = `attachment; filename="${cleanName}${cleanName.endsWith(ext) ? '' : ext}"`
  }

  if (req.headers.range && (mime === 'video/mp4' || mime === 'video/webm')) {
    const match = req.headers.range.match(/bytes=(\d+)-(\d*)/)
    if (match) {
      const start = Number(match[1])
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1
      if (start < stat.size && end >= start) {
        res.writeHead(206, {
          ...headers,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
        })
        fs.createReadStream(filePath, { start, end }).pipe(res)
        return true
      }
    }
  }

  res.writeHead(200, { ...headers, 'Accept-Ranges': 'bytes' })
  fs.createReadStream(filePath).pipe(res)
  return true
}
