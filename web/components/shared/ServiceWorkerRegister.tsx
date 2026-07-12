'use client'

import { useEffect } from 'react'
import { isEnabled } from '@/lib/features'

// Registers the offline service worker — but ONLY in production and ONLY when the
// `offline` flag is on. If the flag is off, any previously-registered worker is
// unregistered, so flipping the flag truly turns the feature off. Renders nothing.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    if (isEnabled('offline') && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    } else {
      navigator.serviceWorker
        .getRegistrations?.()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {})
    }
  }, [])

  return null
}
