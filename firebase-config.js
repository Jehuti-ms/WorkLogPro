// ===========================
// FIREBASE CONFIGURATION - ES6 Modules Version
// ===========================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js';

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
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    console.error('Firebase persistence error:', err);
});

console.log('✅ Firebase initialized successfully with project:', firebaseConfig.projectId);

// Export for use in other modules
export { auth, db, storage };
