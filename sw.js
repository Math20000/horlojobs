const CACHE = 'horlojobs-v1';
const STATIC_FILES = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (new URL(request.url).pathname.endsWith('/data/jobs.json')) {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put('./data/jobs.json', copy)); return response; }).catch(() => caches.match('./data/jobs.json')));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
