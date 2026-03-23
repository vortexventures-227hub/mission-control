'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service worker registered:', registration.scope)
        })
        .catch((error) => {
          console.warn('[PWA] Service worker registration failed:', error)
        })
    }
  }, [])

  return null
}
