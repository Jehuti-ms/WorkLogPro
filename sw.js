// sw.js - Updated to prevent auth page caching
const cacheName = 'worklog-app-v4';
const assetsToCache = [
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-144x144.png', 
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
  // NO HTML FILES CACHED!
];

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
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
  // NEVER cache HTML files
  if (event.request.url.includes('.html')) {
    console.log('🌐 Fetching fresh HTML:', event.request.url);
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If offline and trying to get auth page, show offline message
          if (event.request.url.includes('auth.html')) {
            return new Response(
              '<html><body><h1>Offline</h1><p>Please check your connection</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return caches.match('./offline.html');
        })
    );
    return;
  }
  
  // For other assets, try cache first
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
