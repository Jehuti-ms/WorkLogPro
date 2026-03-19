// firebase-config.js - WITH FORCED PERSISTENCE
console.log('🔥 Loading firebase-config.js with enhanced persistence...');

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

// CRITICAL: Enable persistence with forced cache size
firebase.firestore().enablePersistence({
    synchronizeTabs: true,
    experimentalForceOwningTab: true
})
.then(() => {
    console.log('✅ Firestore persistence enabled - works across tabs');
})
.catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('⚠️ Multiple tabs open, persistence disabled');
    } else if (err.code == 'unimplemented') {
        console.warn('⚠️ Browser doesn\'t support persistence');
    }
});

// Set auth persistence to LOCAL (survives browser restart)
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => console.log('✅ Auth persistence set to LOCAL'))
    .catch((error) => console.error('❌ Auth persistence error:', error));

// Monitor auth state
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log('👤 Auth state changed: User logged in:', user.email);
        
        // FORCE A SYNC WHEN USER LOGS IN ON PHONE
        setTimeout(() => {
            if (window.syncService) {
                console.log('📱 Phone detected - forcing sync...');
                window.syncService.forceRefreshFromCloud();
            }
        }, 2000);
    } else {
        console.log('👤 Auth state changed: No user');
    }
});

console.log('✅ Firebase config loaded with enhanced mobile support');
