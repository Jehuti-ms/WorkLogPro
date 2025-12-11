// auth.js - Firebase Authentication & Database Setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  doc, 
  setDoc,
  collection,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase configuration
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
console.log("🔥 Initializing Firebase...");
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistence
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

// Initialize Auth
const auth = getAuth(app);

// Enable auth persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("✅ Auth persistence enabled");
  })
  .catch((error) => {
    console.error("❌ Auth persistence error:", error);
  });

console.log("✅ Firebase initialized successfully");

// Export everything for use in other files
export { 
  // Core Firebase objects
  app, 
  auth, 
  db,
  
  // Auth functions
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut, 
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  
  // Firestore functions
  doc,
  setDoc,
  collection,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  initializeFirestore,
  persistentLocalCache
};

// Auth state change listener
onAuthStateChanged(auth, (user) => {
  const currentPage = window.location.pathname;
  
  if (user) {
    console.log("🟢 User authenticated:", user.email);
    
    // If we're on login page, redirect to app
    if (currentPage.includes('auth.html') || currentPage.endsWith('/')) {
      console.log("📤 Redirecting to app...");
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 100);
    }
  } else {
    console.log("🔴 No user authenticated");
    
    // If we're on app page, redirect to login
    if (currentPage.includes('index.html')) {
      console.log("📥 Redirecting to login...");
      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 100);
    }
  }
});

// Debug helper - can be called from browser console
window.firebaseDebug = {
  getCurrentUser: () => auth.currentUser,
  getAuthState: () => new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => resolve(user));
  }),
  testConnection: async () => {
    try {
      console.log("Testing Firebase connection...");
      console.log("App:", app.name);
      console.log("Auth:", !!auth);
      console.log("Firestore:", !!db);
      console.log("Current user:", auth.currentUser?.email || "None");
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }
};

console.log("✅ auth.js loaded successfully");
