// Quizmoo service worker: makes the app installable and opens it fast. It only keeps the app
// itself (pages, built assets, icons, the colour mode script); the API, the socket and uploaded
// images always go to the server, so a live game never sees stale data.
const CACHE = 'quizmoo-app-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

function keep(key, response) {
  if (response.ok) {
    const copy = response.clone()
    void caches.open(CACHE).then((cache) => cache.put(key, copy))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return

  // Built assets carry a content hash in their name, so a cached copy is never stale.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => keep(request, response))))
    return
  }

  // Pages and the other app files: the network first, so a new build shows at once; the cached
  // copy when offline. Every page is the same app shell, kept under '/'.
  const key = request.mode === 'navigate' ? '/' : request
  event.respondWith(
    fetch(request)
      .then((response) => keep(key, response))
      .catch(() => caches.match(key).then((cached) => cached ?? Response.error())),
  )
})
