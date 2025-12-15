// service-worker.js - Improved version
const CACHE_NAME = 'worklog-v3';
const urlsToCache = [
  '/Attendance-Track-v2/',
  '/Attendance-Track-v2/index.html',
  '/Attendance-Track-v2/manifest.json',
  '/Attendance-Track-v2/firebase-config.js',
  '/Attendance-Track-v2/app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker: Installing...');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Caching app shell');
        // Use Promise.all to handle individual cache requests
        const cachePromises = urlsToCache.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`⚠️ Failed to cache: ${url}`, err);
            // Continue even if some files fail to cache
          });
        });
        return Promise.all(cachePromises);
      })
      .then(() => {
        console.log('✅ Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('❌ Service Worker: Installation failed', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  
  // Delete old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Service Worker: Deleting old cache ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Activated and ready');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          console.log(`📦 Service Worker: Serving from cache: ${event.request.url}`);
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Cache the new response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log(`💾 Service Worker: Caching new resource: ${event.request.url}`);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('❌ Service Worker: Fetch failed:', error);
            // Return a fallback for specific pages
            if (event.request.mode === 'navigate') {
              return caches.match('/Attendance-Track-v2/index.html');
            }
            return new Response('Network error occurred', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('🔄 Service Worker: Background sync triggered');
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('🔄 Service Worker: Syncing data...');
  // This would sync any pending data
  // You can add your sync logic here
}
