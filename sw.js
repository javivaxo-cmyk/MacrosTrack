/**
 * sw.js - Service Worker para soporte Offline completo en la PWA MacrosTrack
 */

const CACHE_NAME = 'macrostrack-v1.0.0';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/main.css',
  './css/components.css',
  './css/views.css',
  './js/app.js',
  './js/db.js',
  './js/food-service.js',
  './js/units.js',
  './js/components/modal.js',
  './js/components/charts.js',
  './js/components/toast.js',
  './js/views/diary-view.js',
  './js/views/shared-view.js',
  './js/views/recipes-view.js',
  './js/views/metrics-view.js',
  './js/views/profile-view.js',
  './bam_foods_json/bam_foods.min.json',
  './icons/icon.svg',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Stale-While-Revalidate para recursos locales
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
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
          // Si no hay red y no está en caché
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
