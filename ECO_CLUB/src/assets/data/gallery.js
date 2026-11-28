// Gallery data utilities and local fallback storage.

const storageKey = 'eco-club.gallery.v1'

const emptyGallery = { photos: [], albums: [], videos: [], beforeAfter: [], featured: [] }

export const galleryStorage = {
  read() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      return {
        photos: Array.isArray(saved?.photos) ? saved.photos : [],
        albums: Array.isArray(saved?.albums) ? saved.albums : [],
        videos: Array.isArray(saved?.videos) ? saved.videos : [],
        beforeAfter: Array.isArray(saved?.beforeAfter) ? saved.beforeAfter : [],
        featured: Array.isArray(saved?.featured) ? saved.featured : [],
      }
    } catch {
      return { ...emptyGallery }
    }
  },
  write(data) {
    localStorage.setItem(storageKey, JSON.stringify(data))
  },
}

export function generateId() {
  return 'gallery-' + crypto.randomUUID()
}

export function getCategories() {
  return ['plantation', 'cleanup', 'workshop', 'awareness', 'wildlife', 'campus', 'celebration', 'other']
}

export function getYears(items = []) {
  if (!Array.isArray(items)) return []
  const years = [...new Set(items.map(i => Number(i?.year)).filter(y => Number.isFinite(y) && y > 1900))]
  return years.sort((a, b) => b - a)
}

export function searchPhotos(photos = [], query = '') {
  if (!query) return photos
  const q = query.toLowerCase().trim()
  return photos.filter(p =>
    (p.caption || '').toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q) ||
    (p.eventTitle || '').toLowerCase().includes(q) ||
    (p.albumTitle || '').toLowerCase().includes(q) ||
    (p.tags || []).some(t => String(t).toLowerCase().includes(q))
  )
}

export function filterPhotos(photos = [], { category, year, eventId, albumId, search } = {}) {
  let result = photos
  if (category && category !== 'all') {
    result = result.filter(p => (p.category || '').toLowerCase() === category.toLowerCase())
  }
  if (year) {
    result = result.filter(p => String(p.year || '') === String(year))
  }
  if (eventId) {
    result = result.filter(p => p.eventId === eventId)
  }
  if (albumId) {
    result = result.filter(p => p.albumId === albumId)
  }
  if (search) {
    result = searchPhotos(result, search)
  }
  return result
}
