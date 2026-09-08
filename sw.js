const CACHE_NAME = 'amcal-rosters-v10.3.8';
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
  './js/modules/ai-ops.js',
  './manifest.json',
  './version.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        for (const asset of ASSETS) {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn('[SW] Pre-caching asset failed (skipping):', asset, err);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Purging old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'PURGE_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.skipWaiting())
    );
  }
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  // Don't cache Supabase API calls, external dynamic requests, binary PDF downloads, version check, or SW itself
  if (
    event.request.url.includes('supabase.co') || 
    event.request.url.includes('/api/') || 
    event.request.url.endsWith('.pdf') || 
    event.request.url.includes('staff-guide') ||
    event.request.url.includes('version.json') ||
    event.request.url.includes('sw.js')
  ) {
    return;
  }

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
