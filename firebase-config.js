// firebase-config.js - Updated version
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, 
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  // Your existing config here
  apiKey: "AIzaSyDq1nEVXqGJ2_6Q8QeCgKiN7e9V4w7n8B4",
  authDomain: "worklog-app-8d3e7.firebaseapp.com",
  projectId: "worklog-app-8d3e7",
  storageBucket: "worklog-app-8d3e7.firebasestorage.app",
  messagingSenderId: "1098360802985",
  appId: "1:1098360802985:web:8d3e7a1b5c5f9a8c4e8a9a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistence
const db = getFirestore(app);

// Enable offline persistence (updated method)
enableIndexedDbPersistence(db)
  .then(() => {
    console.log("✅ Offline persistence enabled");
  })
  .catch((err) => {
    console.error("❌ Offline persistence error:", err);
  });

// Initialize Auth
const auth = getAuth(app);

console.log("✅ Firebase initialized successfully");

export { auth, db };
