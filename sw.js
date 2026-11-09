/* SDR Viewer PWA service worker */
const CACHE_NAME = 'sdr-viewer-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
];
const PROJ4_URL = 'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.2/proj4.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Cache the exact Proj4JS build used by the original HTML so it can be
    // served from cache when the device is offline after first online launch.
    try {
      const response = await fetch(PROJ4_URL, { mode: 'cors', cache: 'reload' });
      if (response.ok) await cache.put(PROJ4_URL, response.clone());
    } catch (_) {
      // The app shell still installs; Proj4JS will be cached on first online use.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = request.url;
  if (url === PROJ4_URL) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(PROJ4_URL);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh.ok) await cache.put(PROJ4_URL, fresh.clone());
        return fresh;
      } catch (_) {
        return new Response('Proj4JS is not cached yet. Connect to the internet once, then reopen the app.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }
  if (url.startsWith(self.location.origin)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch (_) {
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
  }
});
