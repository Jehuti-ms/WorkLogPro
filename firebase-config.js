// firebase-config.js - FIXED WITH PROPER PERSISTENCE
console.log('🔥 Loading FIXED firebase-config.js with proper persistence');

const firebaseConfig = {
  apiKey: "AIzaSyDdLP_LgiC6EgzC3hUP_mGuNW4_BUEACs8",
  authDomain: "worklogpro-4284e.firebaseapp.com",
  projectId: "worklogpro-4284e",
  storageBucket: "worklogpro-4284e.firebasestorage.app",
  messagingSenderId: "299567233913",
  appId: "1:299567233913:web:7232a5a5a8aa9b79948da8",
  measurementId: "G-7JMG3LLJXX"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized');
    
    // CRITICAL: Set persistence to LOCAL
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => {
        console.log('✅ Auth persistence set to LOCAL - user will stay logged in');
      })
      .catch((error) => {
        console.error('❌ Failed to set persistence:', error);
      });
    
    // Enable Firestore offline persistence
    firebase.firestore().enablePersistence()
      .then(() => {
        console.log('✅ Firestore persistence enabled - works offline');
      })
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('⚠️ Multiple tabs open, persistence enabled in one tab only');
        } else if (err.code === 'unimplemented') {
          console.warn('⚠️ Browser doesn\'t support persistence');
        }
      });
  }
} else {
  console.error('❌ Firebase SDK not loaded!');
}

// Store auth state in localStorage as backup
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    console.log('👤 Auth state changed: User logged in:', user.email);
    localStorage.setItem('worklog_user', JSON.stringify({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      lastLogin: new Date().toISOString()
    }));
    localStorage.setItem('userEmail', user.email);
  } else {
    console.log('👤 Auth state changed: No user');
    // Don't clear on every change, only on explicit logout
  }
});

// Helper to check auth status
window.checkFirebaseAuth = function() {
  return new Promise((resolve) => {
    const user = firebase.auth().currentUser;
    if (user) {
      resolve(user);
    } else {
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
      // Timeout after 3 seconds
      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 3000);
    }
  });
};
