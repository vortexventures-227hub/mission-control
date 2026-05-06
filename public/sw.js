// Mission Control Service Worker v1.1
const CACHE_NAME = 'mission-control-static-v1'
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-icon.png',
  '/brand/mc-logo-128.png',
  '/brand/mc-logo-512.png',
]

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

function isStaticAsset(requestUrl) {
  return requestUrl.origin === self.location.origin && STATIC_ASSETS.includes(requestUrl.pathname)
}

// Fetch - cache install assets only. Never cache dynamic Mission Control pages.
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  const requestUrl = new URL(event.request.url)

  // Skip API, navigations, HTML documents, and cross-origin requests so
  // dynamic command-center data is never stored by the service worker.
  if (
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.startsWith('/api/') ||
    event.request.mode === 'navigate' ||
    event.request.destination === 'document'
  ) return

  if (!isStaticAsset(requestUrl)) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful static install assets only.
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone)
          })
        }
        return response
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request)
      })
  )
})
