import { useEffect, useState } from 'react'
import { subscribeToasts } from '../data/toast'

export default function ToastHost() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return subscribeToasts(item => {
      setToasts(prev => [...prev.slice(-3), item])
      window.setTimeout(() => {
        setToasts(prev => prev.map(t => (t.id === item.id ? { ...t, exiting: true } : t)))
      }, 3200)
      window.setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== item.id))
      }, 3550)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast-item ${toast.type}${toast.exiting ? ' exiting' : ''}`}>
          <span aria-hidden="true">
            {toast.type === 'error' ? '⚠' : toast.type === 'info' ? 'ℹ' : '✓'}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
