const CACHE_NAME = 'amcal-rosters-v9.3.2';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/database.js',
  './js/scheduler.js',
  './js/supabase-client.js',
  './js/swaps.js',
  './js/modules/payroll-engine.js',
  './js/modules/compliance.js',
  './js/modules/role-customization.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  // Don't cache Supabase API calls, external dynamic requests, or binary PDF downloads
  if (event.request.url.includes('supabase.co') || event.request.url.includes('/api/') || event.request.url.endsWith('.pdf') || event.request.url.includes('staff-guide')) return;

  // Network-First strategy for HTML and JS to ensure instant updates
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request);
      })
  );
});
