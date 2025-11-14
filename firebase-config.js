// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyDdLP_LgiC6EgzC3hUP_mGuNW4_BUEACs8",
  authDomain: "worklogpro-4284e.firebaseapp.com",
  projectId: "worklogpro-4284e",
  storageBucket: "worklogpro-4284e.firebasestorage.app",
  messagingSenderId: "299567233913",
  appId: "1:299567233913:web:7232a5a5a8aa9b79948da8",
};

// --- Initialize once ---
let app;
let auth;
let db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("✅ Firebase initialized successfully");
} catch (error) {
  console.error("❌ Firebase initialization failed:", error);
}

export { auth, db };
