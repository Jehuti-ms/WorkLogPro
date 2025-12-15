// service-worker.js - Fixed version
const CACHE_NAME = 'worklog-v4';
const APP_SHELL = [
  '/Attendance-Track-v2/',  // Your app root
  '/Attendance-Track-v2/index.html',
  '/Attendance-Track-v2/firebase-config.js',
  '/Attendance-Track-v2/app.js',
  '/Attendance-Track-v2/manifest.json'
];

// External resources to cache
const EXTERNAL_RESOURCES = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
];

// Debug function
function log(message, data = null) {
  console.log(`🛠️ Service Worker: ${message}`, data || '');
}

self.addEventListener('install', (event) => {
  log('Installing...');
  
  // Force the waiting service worker to become active
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        log('Caching app shell');
        
        // Cache local files first
        const cachePromises = APP_SHELL.map(url => {
          return cache.add(url).catch(err => {
            log(`Warning: Failed to cache ${url}`, err.message);
            return null; // Don't fail the entire install
          });
        });
        
        return Promise.all(cachePromises).then(() => {
          log('Local files cached');
          
          // Cache external resources
          const externalPromises = EXTERNAL_RESOURCES.map(url => {
            return fetch(url)
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                return null;
              })
              .catch(err => {
                log(`Warning: Failed to cache external ${url}`, err.message);
                return null;
              });
          });
          
          return Promise.all(externalPromises);
        });
      })
      .then(() => {
        log('Installation complete');
        return self.skipWaiting();
      })
      .catch(err => {
        log('Installation failed', err);
        // Even if caching fails, continue with activation
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  log('Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            log(`Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      log('Activated and ready');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip browser extensions
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // Skip Firebase and other external APIs
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com/auth')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          log(`Cache hit: ${event.request.url}`);
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request.clone())
          .then((response) => {
            // Only cache successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response for caching
            const responseToCache = response.clone();
            
            // Cache the response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                log(`Cached new resource: ${event.request.url}`);
              })
              .catch(err => {
                log(`Failed to cache ${event.request.url}`, err);
              });
            
            return response;
          })
          .catch((error) => {
            log(`Network error for ${event.request.url}`, error);
            
            // For navigation requests, return the cached index.html
            if (event.request.mode === 'navigate') {
              return caches.match('/Attendance-Track-v2/index.html')
                .then(indexResponse => {
                  if (indexResponse) {
                    log('Serving fallback index.html');
                    return indexResponse;
                  }
                  return new Response('Network error occurred', {
                    status: 408,
                    headers: { 'Content-Type': 'text/plain' }
                  });
                });
            }
            
            // For other requests, return error
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

// Background sync event (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
      log('Background sync triggered');
      event.waitUntil(syncData());
    }
  });
}

async function syncData() {
  log('Syncing data in background...');
  // Implement your background sync logic here
}
