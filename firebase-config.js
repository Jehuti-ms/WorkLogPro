// firebase-config.js - WorklogPro Firebase Configuration
console.log("🔥 Firebase Config loaded");

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdLP_LgiC6EgzC3hUP_mGuNW4_BUEACs8",
  authDomain: "worklogpro-4284e.firebaseapp.com",
  projectId: "worklogpro-4284e",
  storageBucket: "worklogpro-4284e.firebasestorage.app",
  messagingSenderId: "299567233913",
  appId: "1:299567233913:web:7232a5a5a8aa9b79948da8"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  try {
    // Check if Firebase is already initialized
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log("✅ Firebase initialized successfully");
    } else {
      console.log("✅ Firebase already initialized");
    }
    
    // Make Firebase services globally available
    window.firebaseApp = firebase.app();
    window.firestore = firebase.firestore();
    window.firebaseAuth = firebase.auth();
    
    console.log("🔥 Firebase services ready:", {
      app: !!window.firebaseApp,
      firestore: !!window.firestore,
      auth: !!window.firebaseAuth
    });
    
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error);
  }
} else {
  console.warn("⚠️ Firebase SDK not loaded - running in offline mode");
}
