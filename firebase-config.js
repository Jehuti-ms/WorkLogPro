// firebase-config.js - MOBILE OPTIMIZED with loop prevention
console.log('🔥 Loading mobile-optimized firebase-config.js');

// Your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyA-duULS1Do5F6Ac-2vzRgE_1d9Xm-lC0M",
    authDomain: "worklog-3351a.firebaseapp.com",
    projectId: "worklog-3351a",
    storageBucket: "worklog-3351a.firebasestorage.app",
    messagingSenderId: "549780363324",
    appId: "1:549780363324:web:fb85fbcd42b566e1932559"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized');
}

// CRITICAL MOBILE FIX: Disable redirects completely
const auth = firebase.auth();
auth.useDeviceLanguage();

// SET PERSISTENCE FIRST - BEFORE ANYTHING ELSE
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log('✅ Auth persistence set to LOCAL (mobile friendly)');
    })
    .catch((error) => {
        console.error('❌ Auth persistence error:', error);
    });

// DISABLE ALL REDIRECTS - Use popup instead
auth.signInWithRedirect = function() {
    console.log('🚫 Redirects disabled - use signInWithPopup instead');
    return Promise.reject(new Error('Redirects disabled'));
};

// Firestore with mobile-friendly settings
const db = firebase.firestore();
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    ignoreUndefinedProperties: true
});

// Enable persistence but handle errors gracefully
db.enablePersistence({
    synchronizeTabs: false, // DISABLE for mobile to prevent conflicts
    experimentalForceOwningTab: false
})
.then(() => {
    console.log('✅ Firestore persistence enabled (mobile mode)');
})
.catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('⚠️ Multiple tabs open - this is fine on mobile');
    } else if (err.code == 'unimplemented') {
        console.warn('⚠️ Browser doesn\'t support persistence');
    }
});

// SMART AUTH STATE HANDLER - FIXED VERSION
let authCheckInProgress = false;
auth.onAuthStateChanged((user) => {
    if (authCheckInProgress) {
        console.log('⏭️ Skipping duplicate auth check');
        return;
    }
    
    authCheckInProgress = true;
    
    if (user) {
        console.log('👤 User logged in:', user.email);
        
        // Store in localStorage as backup
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userId', user.uid);
        localStorage.setItem('lastAuthTime', Date.now().toString());
        
        // CRITICAL: Notify RateManager about the user
        if (window.RateManager && window.RateManager.handleUserLogin) {
            window.RateManager.handleUserLogin(user);
        }
        
        // WE ARE ON THE MAIN APP - STAY HERE
        if (window.location.pathname.includes('auth.html')) {
            console.log('📱 On auth page but logged in - redirecting to app');
            window.location.replace('index.html');
        }
    } else {
        console.log('👤 No user');
        
        // Clear stored user
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
        
        // CRITICAL: Notify RateManager about logout
        if (window.RateManager && window.RateManager.handleUserLogout) {
            window.RateManager.handleUserLogout();
        }
        
        // ONLY redirect if we're not already on auth page AND not in a loop
        if (!window.location.pathname.includes('auth.html')) {
            const lastRedirect = sessionStorage.getItem('lastRedirect');
            const now = Date.now();
            
            if (!lastRedirect || (now - parseInt(lastRedirect)) > 5000) {
                console.log('📱 No user - redirecting to auth');
                sessionStorage.setItem('lastRedirect', now.toString());
                window.location.replace('auth.html');
            } else {
                console.log('🚫 Preventing redirect loop');
            }
        }
    }
    
    setTimeout(() => {
        authCheckInProgress = false;
    }, 1000);
});

// Add emergency recovery to window
window.emergencyReset = function() {
    console.log('🚨 Emergency reset triggered');
    localStorage.clear();
    sessionStorage.clear();
    
    // Sign out
    auth.signOut()
        .then(() => {
            window.location.replace('auth.html');
        })
        .catch(() => {
            window.location.replace('auth.html');
        });
};

console.log('✅ Mobile-optimized Firebase config loaded');
