// Frontend API & hash-routing utilities for Eco Club backend + fallback behavior.

async function request(url, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  })

  const contentType = response.headers.get('content-type') || ''
  let data = null
  if (contentType.includes('application/json')) {
    data = await response.json()
  }

  if (!response.ok) {
    const err = new Error(data?.error || `Request failed (${response.status})`)
    err.status = response.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  bootstrap() {
    return request('/api/bootstrap')
  },
  setupStatus() {
    return request('/api/auth/setup-status')
  },
  setupAdmin(payload) {
    return request('/api/auth/setup', { method: 'POST', body: JSON.stringify(payload) })
  },
  register(payload) {
    return request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) })
  },
  login(payload) {
    return request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) })
  },
  logout() {
    return request('/api/auth/logout', { method: 'POST' })
  },
  listUsers() {
    return request('/api/users')
  },
  updateUserRole(id, role) {
    return request(`/api/users/${encodeURIComponent(id)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  },
  listUploads() {
    return request('/api/uploads')
  },
  uploadFile(file, kind = 'image') {
    const form = new FormData()
    form.append('kind', kind)
    form.append('file', file)
    return request('/api/uploads', { method: 'POST', body: form })
  },
  deleteUpload(id) {
    return request(`/api/uploads/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  updateSettings(payload) {
    return request('/api/settings', { method: 'PUT', body: JSON.stringify(payload) })
  },

  // Events
  createEvent(payload) {
    return request('/api/events', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateEvent(id, payload) {
    return request(`/api/events/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  toggleEventPublish(id, status) {
    return request(`/api/events/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteEvent(id) {
    return request(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  getEventDetail(id) {
    return request(`/api/events/${encodeURIComponent(id)}`)
  },

  // Gallery
  createPhoto(payload) {
    return request('/api/gallery/photos', { method: 'POST', body: JSON.stringify(payload) })
  },
  updatePhoto(id, payload) {
    return request(`/api/gallery/photos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  togglePhotoPublish(id, status) {
    return request(`/api/gallery/photos/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deletePhoto(id) {
    return request(`/api/gallery/photos/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  createAlbum(payload) {
    return request('/api/gallery/albums', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateAlbum(id, payload) {
    return request(`/api/gallery/albums/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  toggleAlbumPublish(id, status) {
    return request(`/api/gallery/albums/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteAlbum(id) {
    return request(`/api/gallery/albums/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  createVideo(payload) {
    return request('/api/gallery/videos', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateVideo(id, payload) {
    return request(`/api/gallery/videos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  toggleVideoPublish(id, status) {
    return request(`/api/gallery/videos/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteVideo(id) {
    return request(`/api/gallery/videos/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  createBeforeAfter(payload) {
    return request('/api/gallery/before-after', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateBeforeAfter(id, payload) {
    return request(`/api/gallery/before-after/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  toggleBeforeAfterPublish(id, status) {
    return request(`/api/gallery/before-after/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteBeforeAfter(id) {
    return request(`/api/gallery/before-after/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  createFeatured(payload) {
    return request('/api/gallery/featured', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateFeatured(id, payload) {
    return request(`/api/gallery/featured/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  deleteFeatured(id) {
    return request(`/api/gallery/featured/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  // Achievements
  createStat(payload) {
    return request('/api/achievements/impact-stats', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateStat(id, payload) {
    return request(`/api/achievements/impact-stats/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  toggleStatPublish(id, status) {
    return request(`/api/achievements/impact-stats/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteStat(id) {
    return request(`/api/achievements/impact-stats/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  createAward(payload) {
    return request('/api/achievements/awards', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateAward(id, payload) {
    return request(`/api/achievements/awards/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  toggleAwardPublish(id, status) {
    return request(`/api/achievements/awards/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteAward(id) {
    return request(`/api/achievements/awards/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  createCertificate(payload) {
    return request('/api/achievements/certificates', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateCertificate(id, payload) {
    return request(`/api/achievements/certificates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  toggleCertificatePublish(id, status) {
    return request(`/api/achievements/certificates/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteCertificate(id) {
    return request(`/api/achievements/certificates/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  checkCertificateDownload(id) {
    return request(`/api/achievements/certificates/${encodeURIComponent(id)}/download?mode=json`)
  },

  createTimeline(payload) {
    return request('/api/achievements/timeline', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateTimeline(id, payload) {
    return request(`/api/achievements/timeline/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  toggleTimelinePublish(id, status) {
    return request(`/api/achievements/timeline/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteTimeline(id) {
    return request(`/api/achievements/timeline/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  createHallOfFame(payload) {
    return request('/api/achievements/hall-of-fame', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateHallOfFame(id, payload) {
    return request(`/api/achievements/hall-of-fame/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  toggleHallOfFamePublish(id, status) {
    return request(`/api/achievements/hall-of-fame/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteHallOfFame(id) {
    return request(`/api/achievements/hall-of-fame/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  createStory(payload) {
    return request('/api/achievements/stories', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateStory(id, payload) {
    return request(`/api/achievements/stories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })
  },
  toggleStoryPublish(id, status) {
    return request(`/api/achievements/stories/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
  deleteStory(id) {
    return request(`/api/achievements/stories/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}

export function getHashParts(hash = window.location.hash) {
  const raw = (hash || '#home').replace(/^#/, '')
  const [routePart, queryPart = ''] = raw.split('?')
  return {
    route: routePart.toLowerCase() || 'home',
    params: new URLSearchParams(queryPart),
  }
}

export function navigateTo(page, params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)
  const query = entries.length ? '?' + new URLSearchParams(entries).toString() : ''
  window.location.hash = `#${page.toLowerCase()}${query}`
}
