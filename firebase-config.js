// ===========================
// FIREBASE CONFIGURATION - v9 Modular
// ===========================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.1.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.1.0/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/9.1.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.1.0/firebase-storage.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.1.0/firebase-analytics.js';

// Your web app's Firebase configuration
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
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  console.error('Firebase persistence error:', err);
});

console.log('✅ Firebase v9.1 initialized successfully');

// Export for use in other modules
export { app, auth, db, storage, analytics };
