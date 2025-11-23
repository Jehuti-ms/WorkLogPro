// ===========================
// FIREBASE CONFIGURATION
// ===========================

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCxRv7j2d3o6yOq2N4Q7Y3w9zvL1eZ8X9A",
    authDomain: "worklogpro-4284e.firebaseapp.com",
    projectId: "worklogpro-4284e",
    storageBucket: "worklogpro-4284e.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence
db.enablePersistence()
  .then(() => {
    console.log('✅ Auth persistence enabled');
  })
  .catch((err) => {
    console.error('❌ Auth persistence error:', err);
  });

console.log('✅ Firebase initialized successfully with project:', firebaseConfig.projectId);
