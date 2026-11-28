const listeners = new Set()

/**
 * Subscribe to global toast notifications.
 * @param {(payload: {id: string, message: string, type: 'success'|'info'|'error'}) => void} fn
 * @returns {() => void}
 */
export function subscribeToasts(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Dispatch a global non-blocking toast notification from any component.
 * @param {string} message
 * @param {'success'|'info'|'error'} [type='success']
 */
export function showToast(message, type = 'success') {
  if (!message) return
  const payload = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, message, type }
  listeners.forEach(fn => fn(payload))
}
