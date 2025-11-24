// firebase-config.js - UPDATED WITH YOUR CONFIG
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

// Initialize Firestore with new persistence method (no more warnings)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

// Initialize Auth
const auth = getAuth(app);

// Set auth persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("✅ Auth persistence enabled");
  })
  .catch((error) => {
    console.error("❌ Auth persistence error:", error);
  });

console.log("✅ Firebase initialized successfully with project: worklogpro-4284e");

export { auth, db };
