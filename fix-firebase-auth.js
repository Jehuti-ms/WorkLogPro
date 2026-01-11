// fix-firebase-auth.js - Stop Firebase auth redirect loops
console.log('🔒 FIX: Stopping Firebase auth redirect loops...');

// Block immediate Firebase auth redirects
(function() {
  // Store current time to detect loops
  const now = Date.now();
  const lastRedirect = sessionStorage.getItem('lastRedirectAttempt');
  
  // If we tried to redirect less than 2 seconds ago, STOP
  if (lastRedirect && (now - parseInt(lastRedirect)) < 2000) {
    console.log('🚫 BLOCKED: Redirect loop detected!');
    
    // Disable location changes temporarily
    const originalLocation = window.location;
    let redirectBlocked = false;
    
    Object.defineProperty(window, 'location', {
      get: function() {
        return originalLocation;
      },
      set: function(value) {
        if (value && typeof value === 'string' && value.includes('auth.html')) {
          if (!redirectBlocked) {
            console.log('🚫 BLOCKED: Redirect to auth prevented');
            redirectBlocked = true;
            setTimeout(() => { redirectBlocked = false; }, 5000);
            
            // Show user-friendly message
            const msg = document.createElement('div');
            msg.style.cssText = `
              position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
              background: #ff4444; color: white; padding: 15px; border-radius: 5px;
              z-index: 99999; font-family: Arial; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            msg.innerHTML = '⚠️ Login issue detected. Please <button onclick="window.location.reload()" style="margin-left: 10px; background: white; color: #ff4444; border: none; padding: 5px 10px; border-radius: 3px;">Reload</button>';
            document.body.appendChild(msg);
            
            return;
          }
        }
        originalLocation.href = value;
      }
    });
  }
  
  // Record this redirect attempt
  sessionStorage.setItem('lastRedirectAttempt', now.toString());
  
  // Clear after 10 seconds
  setTimeout(() => {
    sessionStorage.removeItem('lastRedirectAttempt');
  }, 10000);
})();

// Override Firebase auth to add delays
(function() {
  if (typeof firebase !== 'undefined') {
    const originalAuth = firebase.auth;
    
    // Wrap onAuthStateChanged to add delay
    firebase.auth = function() {
      const authInstance = originalAuth.apply(this, arguments);
      
      if (authInstance && authInstance.onAuthStateChanged) {
        const originalOnAuthStateChanged = authInstance.onAuthStateChanged;
        
        authInstance.onAuthStateChanged = function(callback, errorCallback, completedCallback) {
          console.log('🔒 FIX: Wrapping auth state listener with delay');
          
          // Wrap the callback to add a 2-second delay before any redirects
          const wrappedCallback = function(user) {
            console.log('🔒 FIX: Auth state changed, user:', user ? 'yes' : 'no');
            
            // If no user, wait 2 seconds before allowing redirect
            if (!user) {
              setTimeout(() => {
                console.log('🔒 FIX: No user detected, callback fired after delay');
                if (callback) callback(user);
              }, 2000);
            } else {
              // User exists, call immediately
              if (callback) callback(user);
            }
          };
          
          return originalOnAuthStateChanged.call(
            authInstance, 
            wrappedCallback, 
            errorCallback, 
            completedCallback
          );
        };
      }
      
      return authInstance;
    };
    
    console.log('✅ Firebase auth wrapped successfully');
  }
})();

// Check for existing auth data
(function() {
  console.log('🔍 Checking for existing auth...');
  
  // Check multiple possible auth storage locations
  const authChecks = [
    localStorage.getItem('firebase:authUser:'),
    localStorage.getItem('userEmail'),
    localStorage.getItem('userId'),
    sessionStorage.getItem('firebase:authUser:'),
    document.cookie.includes('firebase:authUser:')
  ];
  
  const hasAuth = authChecks.some(check => check && check !== 'null' && check !== 'undefined');
  
  console.log('🔍 Auth check results:', { hasAuth, checks: authChecks });
  
  if (hasAuth) {
    console.log('✅ Found existing auth, should stay on app');
    
    // Add a visual indicator
    const indicator = document.createElement('div');
    indicator.id = 'auth-status-indicator';
    indicator.style.cssText = `
      position: fixed; bottom: 10px; right: 10px; background: #4CAF50; 
      color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px;
      z-index: 9999; display: none;
    `;
    indicator.textContent = '✅ Auth detected';
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      document.getElementById('auth-status-indicator').style.display = 'block';
      setTimeout(() => {
        document.getElementById('auth-status-indicator').style.display = 'none';
      }, 3000);
    }, 1000);
  }
})();

console.log('✅ Firebase auth fix applied');
