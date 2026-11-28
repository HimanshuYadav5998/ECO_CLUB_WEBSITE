import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'
import test from 'node:test'
import { createEcoClubServer } from '../server/index.js'
import { filterByCategory, filterByYear, getYears as getAchYears, searchItems } from '../src/assets/data/achievements.js'
import { filterPhotos, getYears as getGalYears } from '../src/assets/data/gallery.js'

function createTempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eco-club-test-'))
  return {
    dir,
    dbPath: path.join(dir, 'test.db'),
    uploadDir: path.join(dir, 'uploads'),
  }
}

async function serializeMultipart(form) {
  const reqObj = new Request('http://127.0.0.1/upload', { method: 'POST', body: form })
  const contentType = reqObj.headers.get('content-type')
  const buffer = Buffer.from(await reqObj.arrayBuffer())
  return { contentType, buffer }
}

async function apiReq(app, pathname, options = {}) {
  const headers = {}
  for (const [k, v] of Object.entries(options.headers || {})) {
    headers[k.toLowerCase()] = v
  }
  if (options.token) headers.authorization = `Bearer ${options.token}`

  let bodyBuf = Buffer.alloc(0)
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json'
    bodyBuf = Buffer.from(JSON.stringify(options.json), 'utf8')
  } else if (options.formData) {
    const mp = await serializeMultipart(options.formData)
    headers['content-type'] = mp.contentType
    bodyBuf = mp.buffer
  } else if (options.body) {
    bodyBuf = Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body))
  }

  const req = Readable.from(bodyBuf.length ? [bodyBuf] : [])
  req.url = pathname
  req.method = options.method || 'GET'
  req.headers = headers

  const resHeaders = {}
  const chunks = []
  let statusCode = 200

  await new Promise((resolve, reject) => {
    const res = new Writable({
      write(chunk, _encoding, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        cb()
      },
    })
    res.setHeader = (name, value) => {
      resHeaders[name.toLowerCase()] = value
    }
    res.getHeader = name => resHeaders[name.toLowerCase()]
    res.writeHead = (code, hdrs = {}) => {
      statusCode = code
      for (const [k, v] of Object.entries(hdrs)) {
        resHeaders[k.toLowerCase()] = v
      }
      return res
    }
    res.on('finish', resolve)
    res.on('error', reject)
    Promise.resolve(app.handler(req, res)).catch(reject)
  })

  const raw = Buffer.concat(chunks)
  const ct = String(resHeaders['content-type'] || '')
  const data = ct.includes('application/json') ? JSON.parse(raw.toString('utf8')) : raw
  return { status: statusCode, headers: resHeaders, data }
}

test('Full-stack API: auth RBAC, secure uploads, events-gallery-achievements interconnection, and persistence', async () => {
  const paths = createTempPaths()
  let app = createEcoClubServer({ dbPath: paths.dbPath, uploadDir: paths.uploadDir, distDir: null })

  try {
    // 1. Setup status initially requires setup
    const setupCheck = await apiReq(app, '/api/auth/setup-status')
    assert.equal(setupCheck.status, 200)
    assert.equal(setupCheck.data.setupRequired, true)

    // 2. Initialize admin
    const adminSetup = await apiReq(app, '/api/auth/setup', {
      method: 'POST',
      json: { name: 'Head Coordinator', email: 'admin@ecoclub.edu', password: 'StrongPassword123!' },
    })
    assert.equal(adminSetup.status, 201)
    assert.equal(adminSetup.data.user.role, 'admin')
    const adminToken = adminSetup.data.token

    // Second setup attempt must be forbidden
    const secondSetup = await apiReq(app, '/api/auth/setup', {
      method: 'POST',
      json: { name: 'Attacker', email: 'hack@ecoclub.edu', password: 'StrongPassword123!' },
    })
    assert.equal(secondSetup.status, 403)

    // 3. Register member & verify lowest-privilege assignment
    const regRes = await apiReq(app, '/api/auth/register', {
      method: 'POST',
      json: { name: 'Club Student', email: 'student@ecoclub.edu', password: 'StudentPassword1!' },
    })
    assert.equal(regRes.status, 201)
    assert.equal(regRes.data.user.role, 'member')
    const memberToken = regRes.data.token

    // Wrong password rejected
    const badLogin = await apiReq(app, '/api/auth/login', {
      method: 'POST',
      json: { email: 'admin@ecoclub.edu', password: 'WrongPassword' },
    })
    assert.equal(badLogin.status, 401)

    // Member cannot create events or promote users
    const memberEventAttempt = await apiReq(app, '/api/events', {
      method: 'POST',
      token: memberToken,
      json: { title: 'Unauthorized Event' },
    })
    assert.equal(memberEventAttempt.status, 403)

    const memberRoleAttempt = await apiReq(app, `/api/users/${regRes.data.user.id}/role`, {
      method: 'PATCH',
      token: memberToken,
      json: { role: 'admin' },
    })
    assert.equal(memberRoleAttempt.status, 403)

    // Cannot demote the sole admin
    const selfDemote = await apiReq(app, `/api/users/${adminSetup.data.user.id}/role`, {
      method: 'PATCH',
      token: adminToken,
      json: { role: 'member' },
    })
    assert.equal(selfDemote.status, 400)

    // 4. Secure File Upload checks (valid PNG vs spoofed script payload)
    const fakeForm = new FormData()
    fakeForm.append('kind', 'image')
    fakeForm.append('file', new Blob(['<script>alert("xss")</script>'], { type: 'image/png' }), 'evil.png')
    const fakeUpload = await apiReq(app, '/api/uploads', {
      method: 'POST',
      token: adminToken,
      formData: fakeForm,
    })
    assert.equal(fakeUpload.status, 415)

    // Minimal valid 1x1 PNG bytes
    const pngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082',
      'hex'
    )
    const validForm = new FormData()
    validForm.append('kind', 'image')
    validForm.append('file', new Blob([pngBytes], { type: 'image/png' }), 'sapling.png')
    const validUpload = await apiReq(app, '/api/uploads', {
      method: 'POST',
      token: adminToken,
      formData: validForm,
    })
    assert.equal(validUpload.status, 201)
    assert.match(validUpload.data.url, /^\/uploads\/[\w-]+\.png$/)

    // Uploaded file served with nosniff
    const fileFetch = await apiReq(app, validUpload.data.url)
    assert.equal(fileFetch.status, 200)
    assert.equal(fileFetch.headers['x-content-type-options'], 'nosniff')

    // 5. Create Event -> Album -> Photo -> BeforeAfter -> Featured -> Video
    const evRes = await apiReq(app, '/api/events', {
      method: 'POST',
      token: adminToken,
      json: {
        title: 'Monsoon Sapling Drive',
        date: '2026-07-15',
        start: '2026-07-15T09:00',
        end: '2026-07-15T12:00',
        location: 'North Campus Ridge',
        description: 'Native sapling plantation.',
        cover: validUpload.data.url,
      },
    })
    assert.equal(evRes.status, 201)
    const eventId = evRes.data.event.id

    const albumRes = await apiReq(app, '/api/gallery/albums', {
      method: 'POST',
      token: adminToken,
      json: {
        title: 'Monsoon Drive Album',
        coverUrl: validUpload.data.url,
        eventId,
        year: 2026,
      },
    })
    assert.equal(albumRes.status, 201)
    const albumId = albumRes.data.album.id

    const photoRes = await apiReq(app, '/api/gallery/photos', {
      method: 'POST',
      token: adminToken,
      json: {
        url: validUpload.data.url,
        caption: 'Students planting native neem saplings',
        category: 'plantation',
        year: 2026,
        eventId,
        albumId,
        tags: ['neem', 'campus'],
      },
    })
    assert.equal(photoRes.status, 201)
    const photoId = photoRes.data.photo.id

    // Member submits a draft photo — server must force draft status
    const memberDraft = await apiReq(app, '/api/gallery/photos', {
      method: 'POST',
      token: memberToken,
      json: {
        url: validUpload.data.url,
        caption: 'Member submitted snapshot',
        status: 'published',
      },
    })
    assert.equal(memberDraft.status, 201)
    assert.equal(memberDraft.data.photo.status, 'draft')

    // Public gallery hides drafts
    const publicGallery = await apiReq(app, '/api/gallery')
    assert.equal(publicGallery.data.photos.length, 1)

    // Promote member to editor & publish draft
    const promoteRes = await apiReq(app, `/api/users/${regRes.data.user.id}/role`, {
      method: 'PATCH',
      token: adminToken,
      json: { role: 'editor' },
    })
    assert.equal(promoteRes.status, 200)
    assert.equal(promoteRes.data.user.role, 'editor')

    const pubRes = await apiReq(app, `/api/gallery/photos/${memberDraft.data.photo.id}/publish`, {
      method: 'PATCH',
      token: memberToken,
      json: { status: 'published' },
    })
    assert.equal(pubRes.status, 200)
    assert.equal(pubRes.data.photo.status, 'published')

    // Featured, Before/After, Video
    const featRes = await apiReq(app, '/api/gallery/featured', {
      method: 'POST',
      token: adminToken,
      json: { photoId, caption: 'Spotlight Plantation', order: 1 },
    })
    assert.equal(featRes.status, 201)

    const baRes = await apiReq(app, '/api/gallery/before-after', {
      method: 'POST',
      token: adminToken,
      json: {
        title: 'Ridge Restoration',
        beforeUrl: validUpload.data.url,
        afterUrl: validUpload.data.url,
        eventId,
        year: 2026,
      },
    })
    assert.equal(baRes.status, 201)

    const vidRes = await apiReq(app, '/api/gallery/videos', {
      method: 'POST',
      token: adminToken,
      json: {
        title: 'Drive Recap',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        category: 'plantation',
        eventId,
        year: 2026,
      },
    })
    assert.equal(vidRes.status, 201)

    // 6. Achievements CRUD + Certificate Download Permission Policy
    const statRes = await apiReq(app, '/api/achievements/impact-stats', {
      method: 'POST',
      token: adminToken,
      json: { label: 'Native Saplings Planted', value: 240, unit: 'saplings', icon: '🌳', year: 2026 },
    })
    assert.equal(statRes.status, 201)

    const awardRes = await apiReq(app, '/api/achievements/awards', {
      method: 'POST',
      token: adminToken,
      json: {
        title: 'Green Campus Citation',
        organization: 'University Sustainability Council',
        category: 'environmental',
        impactMetric: '240 native trees established',
        year: 2026,
        eventId,
        featured: true,
      },
    })
    assert.equal(awardRes.status, 201)

    // Member-only certificate & restricted certificate
    const memberCert = await apiReq(app, '/api/achievements/certificates', {
      method: 'POST',
      token: adminToken,
      json: {
        title: 'Volunteer Stewardship Certificate',
        issuedBy: 'Eco Club',
        recipientName: 'Active Volunteers',
        imageUrl: validUpload.data.url,
        downloadUrl: validUpload.data.url,
        downloadPolicy: 'members',
        year: 2026,
        eventId,
      },
    })
    assert.equal(memberCert.status, 201)

    const restrictedCert = await apiReq(app, '/api/achievements/certificates', {
      method: 'POST',
      token: adminToken,
      json: {
        title: 'Audit Certificate (Preview Only)',
        issuedBy: 'Green Audit Board',
        imageUrl: validUpload.data.url,
        downloadUrl: validUpload.data.url,
        downloadPolicy: 'restricted',
        year: 2026,
      },
    })
    assert.equal(restrictedCert.status, 201)

    // Unauthenticated download of 'members' certificate must be denied (401)
    const anonMemberDl = await apiReq(app, `/api/achievements/certificates/${memberCert.data.certificate.id}/download?mode=json`)
    assert.equal(anonMemberDl.status, 401)

    // Authenticated download of 'members' certificate succeeds and increments downloadCount
    const authMemberDl = await apiReq(app, `/api/achievements/certificates/${memberCert.data.certificate.id}/download?mode=json`, {
      token: memberToken,
    })
    assert.equal(authMemberDl.status, 200)
    assert.equal(authMemberDl.data.downloadCount, 1)

    // Binary download stream sets attachment header
    const binaryDl = await apiReq(app, `/api/achievements/certificates/${memberCert.data.certificate.id}/download`, {
      token: memberToken,
    })
    assert.equal(binaryDl.status, 200)
    assert.match(binaryDl.headers['content-disposition'], /attachment/)

    // Unauthenticated download of 'restricted' certificate is forbidden (403)
    const anonRestrictedDl = await apiReq(app, `/api/achievements/certificates/${restrictedCert.data.certificate.id}/download?mode=json`)
    assert.equal(anonRestrictedDl.status, 403)

    // Timeline, Hall of Fame, Story
    const tlRes = await apiReq(app, '/api/achievements/timeline', {
      method: 'POST',
      token: adminToken,
      json: { title: 'Ridge Restoration Launched', date: '2026-07-15', category: 'environmental', eventId },
    })
    assert.equal(tlRes.status, 201)

    const hofRes = await apiReq(app, '/api/achievements/hall-of-fame', {
      method: 'POST',
      token: adminToken,
      json: { name: 'Ananya Verma', role: 'Nursery Lead', year: 2026, honorBadge: 'Steward', contribution: 'Coordinated sapling care.' },
    })
    assert.equal(hofRes.status, 201)

    const storyRes = await apiReq(app, '/api/achievements/stories', {
      method: 'POST',
      token: adminToken,
      json: { title: 'Turning Barren Ridge Green', content: 'Detailed field report...', category: 'sustainability', year: 2026, featured: true, eventId },
    })
    assert.equal(storyRes.status, 201)

    // Verify interconnection counts on /api/events/:id
    const evDetail = await apiReq(app, `/api/events/${eventId}`)
    assert.equal(evDetail.status, 200)
    assert.equal(evDetail.data.gallery.photos.length, 1)
    assert.equal(evDetail.data.gallery.albums.length, 1)
    assert.equal(evDetail.data.achievements.awards.length, 1)
    assert.equal(evDetail.data.achievements.timeline.length, 1)

    // 7. Re-open same SQLite DB and verify full persistence
    await app.close()
    app = createEcoClubServer({ dbPath: paths.dbPath, uploadDir: paths.uploadDir, distDir: null })

    const afterRestart = await apiReq(app, '/api/bootstrap')
    assert.equal(afterRestart.status, 200)
    assert.equal(afterRestart.data.setupRequired, false)
    assert.equal(afterRestart.data.events.length, 1)
    assert.equal(afterRestart.data.events[0].photoCount, 1)
    assert.equal(afterRestart.data.events[0].achievementCount, 4)
    assert.equal(afterRestart.data.gallery.photos.length, 2)
    assert.equal(afterRestart.data.achievements.impactStats.length, 1)
    assert.equal(afterRestart.data.achievements.awards.length, 1)
  } finally {
    await app.close()
    fs.rmSync(paths.dir, { recursive: true, force: true })
  }
})

test('Production static serving and upload path-traversal protection', async () => {
  const paths = createTempPaths()
  const distDir = path.resolve(import.meta.dirname, '..', 'dist')
  const app = createEcoClubServer({ dbPath: paths.dbPath, uploadDir: paths.uploadDir, distDir })
  try {
    const indexRes = await apiReq(app, '/')
    assert.equal(indexRes.status, 200)
    assert.match(String(indexRes.headers['content-type']), /text\/html/)
    assert.match(indexRes.data.toString('utf8'), /Eco Club/)

    const travRes = await apiReq(app, '/uploads/..%2Fpackage.json')
    assert.equal(travRes.status, 400)

    const travRawRes = await apiReq(app, '/uploads/../package.json')
    assert.equal(travRawRes.status, 404)
  } finally {
    await app.close()
    fs.rmSync(paths.dir, { recursive: true, force: true })
  }
})

test('Frontend filter and search helpers handle edge cases safely', () => {
  const samplePhotos = [
    { id: '1', caption: 'Oak Plantation', category: 'plantation', year: 2025, eventId: 'ev1', albumId: 'al1', tags: ['trees'] },
    { id: '2', caption: 'River Cleanup', category: 'cleanup', year: 2026, eventId: 'ev2', albumId: 'al2', tags: ['water'] },
  ]
  const sampleAchievements = [
    { id: 'a1', title: 'River Cleanup Citation', description: 'Restored urban riverbank', category: 'cleanup', year: 2026 },
    { id: 'a2', title: 'Campus Solar Pilot', description: 'Student clean energy initiative', category: 'innovation', year: 2025 },
  ]
  assert.deepEqual(getGalYears(samplePhotos), [2026, 2025])
  assert.deepEqual(getAchYears([]), [])
  assert.equal(filterPhotos(samplePhotos, { category: 'plantation' }).length, 1)
  assert.equal(filterPhotos(samplePhotos, { eventId: 'ev2', search: 'water' }).length, 1)
  assert.equal(filterByCategory(sampleAchievements, 'CLEANUP').length, 1)
  assert.equal(filterByYear(sampleAchievements, '2025').length, 1)
  assert.equal(searchItems(sampleAchievements, 'riverbank').length, 1)
})
