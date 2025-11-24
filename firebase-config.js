// ===========================
// FIREBASE CONFIGURATION - Use Original Working Config
// ===========================

// Firebase configuration - FROM WHEN IT WAS WORKING
const firebaseConfig = {
    apiKey: "AIzaSyCxRv7j2d3o6yOq2N4Q7Y3w9zvL1eZ8X9A",
    authDomain: "worklogpro-4284e.firebaseapp.com",
    projectId: "worklogpro-4284e",
    storageBucket: "worklogpro-4284e.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence
db.enablePersistence()
  .catch((err) => {
      console.error('Firebase persistence error:', err);
  });

console.log('✅ Firebase initialized with ORIGINAL working config');
