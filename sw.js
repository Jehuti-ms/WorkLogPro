// Service Worker Control
if ('serviceWorker' in navigator) {
  // Check if we should skip service worker
  const skipSW = localStorage.getItem('skipServiceWorker') === 'true';
  const isAuthPage = window.location.pathname.includes('auth.html');
  
  console.log('🛠️ Service Worker Check:', {
    skipSW,
    isAuthPage,
    path: window.location.pathname
  });
  
  if (skipSW) {
    console.log('🛠️ Skipping service worker registration');
    
    // Unregister any existing service workers
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
      console.log('🛠️ All service workers unregistered');
      localStorage.removeItem('skipServiceWorker');
    });
  } else {
    // Register service worker ONLY for main app, not auth
    if (!isAuthPage) {
      navigator.serviceWorker.register('/Attendance-Track-v2/service-worker.js')
        .then(registration => {
          console.log('🛠️ Service Worker registered:', registration.scope);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            console.log('🛠️ New service worker found');
          });
        })
        .catch(error => {
          console.error('🛠️ Service Worker registration failed:', error);
        });
    }
  }
}

