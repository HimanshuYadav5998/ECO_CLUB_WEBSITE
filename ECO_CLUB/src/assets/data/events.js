// Event fields: id, title, date (YYYY-MM-DD), location, description, photos (each with url and caption).
export const events = []

const storageKey = 'eco-club.events.v1'

export function readClubBoard() {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
  return {
    localEvents: Array.isArray(saved?.localEvents) ? saved.localEvents : [],
    banner: typeof saved?.banner === 'string' ? saved.banner : '',
    imageHistory: Array.isArray(saved?.imageHistory) ? saved.imageHistory : [],
  }
}

export function writeClubBoard(board) {
  localStorage.setItem(storageKey, JSON.stringify(board))
}

export function imageAddress(input) {
  let url = new URL(input.trim())
  if (/^(?:www\.|images\.)?google\.(?:[a-z]{2,3}|(?:co|com)\.[a-z]{2})$/.test(url.hostname) && url.searchParams.has('imgurl')) {
    url = new URL(url.searchParams.get('imgurl'))
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use a public image URL.')
  url.hash = ''
  return url.href
}

export function imageKey(input) {
  try {
    const url = new URL(imageAddress(input))
    if (url.hostname === 'images.unsplash.com') url.search = ''
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_')) url.searchParams.delete(key)
    }
    url.searchParams.sort()
    return url.href
  } catch { return '' }
}

// Annual UN observances. Club announcements come from the events list above.
export const natureDates = [
  ['03-03', 'World Wildlife Day', 'wildlife-day'],
  ['03-22', 'World Water Day', 'water-day'],
  ['06-05', 'World Environment Day', 'environment-day'],
  ['11-26', 'World Sustainable Transport Day', 'sustainable-transport-day'],
  ['12-05', 'World Soil Day', 'world-soil-day'],
  ['12-11', 'International Mountain Day', 'mountain-day'],
]

// Achievement fields: id, title, description.
export const achievements = []
