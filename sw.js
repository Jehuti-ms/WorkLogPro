// Service Worker for WorkLog App - FIXED VERSION
const cacheName = 'worklog-app-v3'; // Increment version
const assetsToCache = [
  './styles.css',
  './app.js',
  './auth.js',
  './cloud-sync.js',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-144x144.png', 
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
  // REMOVED: index.html and auth.html from cache
];

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(cacheName)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(assetsToCache)
          .then(() => console.log('All assets cached successfully'))
          .catch(err => {
            console.error('Failed to cache assets:', err);
          });
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== cacheName) {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // DON'T cache HTML files - always fetch fresh versions
  if (event.request.url.includes('.html')) {
    console.log('Fetching fresh HTML:', event.request.url);
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For other assets, try cache first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
