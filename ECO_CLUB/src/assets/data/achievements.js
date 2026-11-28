// Achievements data utilities and local fallback storage.

const storageKey = 'eco-club.achievements.v1'

export const achievementsStorage = {
  read() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      return {
        awards: Array.isArray(saved?.awards) ? saved.awards : [],
        certificates: Array.isArray(saved?.certificates) ? saved.certificates : [],
        impactStats: Array.isArray(saved?.impactStats) ? saved.impactStats : [],
        hallOfFame: Array.isArray(saved?.hallOfFame) ? saved.hallOfFame : [],
        stories: Array.isArray(saved?.stories) ? saved.stories : [],
        timeline: Array.isArray(saved?.timeline) ? saved.timeline : [],
      }
    } catch {
      return { awards: [], certificates: [], impactStats: [], hallOfFame: [], stories: [], timeline: [] }
    }
  },
  write(data) {
    localStorage.setItem(storageKey, JSON.stringify(data))
  },
}

export function generateId() {
  return 'achieve-' + crypto.randomUUID()
}

export function getAwardCategories() {
  return ['environmental', 'community', 'innovation', 'education', 'leadership', 'sustainability']
}

export function getYears(items = []) {
  if (!Array.isArray(items)) return []
  const years = [...new Set(items.map(i => Number(i?.year)).filter(y => Number.isFinite(y) && y > 1900))]
  return years.sort((a, b) => b - a)
}

export function filterByCategory(items = [], category) {
  if (!category || category.toLowerCase() === 'all') return items
  const norm = category.toLowerCase()
  return items.filter(i => (i.category || '').toLowerCase() === norm)
}

export function filterByYear(items = [], year) {
  if (!year) return items
  return items.filter(i => String(i.year || '') === String(year))
}

export function filterByEvent(items = [], eventId) {
  if (!eventId) return items
  return items.filter(i => i.eventId === eventId)
}

export function searchItems(items = [], query = '') {
  if (!query) return items
  const q = query.toLowerCase().trim()
  return items.filter(i =>
    (i.title || '').toLowerCase().includes(q) ||
    (i.description || '').toLowerCase().includes(q) ||
    (i.organization || '').toLowerCase().includes(q) ||
    (i.recipient || '').toLowerCase().includes(q) ||
    (i.recipientName || '').toLowerCase().includes(q) ||
    (i.name || '').toLowerCase().includes(q) ||
    (i.role || '').toLowerCase().includes(q) ||
    (i.contribution || '').toLowerCase().includes(q) ||
    (i.content || '').toLowerCase().includes(q) ||
    (i.eventTitle || '').toLowerCase().includes(q)
  )
}
