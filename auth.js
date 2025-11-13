// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyDdLP_LgiC6EgzC3hUP_mGuNW4_BUEACs8",
  authDomain: "worklogpro-4284e.firebaseapp.com",
  projectId: "worklogpro-4284e",
  storageBucket: "worklogpro-4284e.firebasestorage.app",
  messagingSenderId: "299567233913",
  appId: "1:299567233913:web:7232a5a5a8aa9b79948da8",
 };

// --- Initialize ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- Persist Session ---
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log("✅ Persistence set to local"))
  .catch(err => console.error("Persistence error:", err));

// --- Auth State Listener ---
onAuthStateChanged(auth, user => {
  if (user) {
    console.log("🟢 Signed in:", user.email);
    // Redirect to your app/dashboard
    window.location.href = "index.html"; 
  } else {
    console.log("🔴 No user signed in");
    // Stay on auth.html until login/register
  }
});

// --- Login Form ---
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Login successful");
      // Redirect immediately after login
      window.location.href = "index.html";
    } catch (err) {
      console.error("❌ Login error:", err.code, err.message);
      alert("Login failed: " + err.message);
    }
  });
}

// --- Register Form ---
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const confirmPassword = document.getElementById("registerConfirmPassword").value.trim();

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log("✅ Account created for:", name, email);
      // Redirect immediately after registration
      window.location.href = "index.html";
    } catch (err) {
      console.error("❌ Registration error:", err.code, err.message);
      alert("Registration failed: " + err.message);
    }
  });
}

// --- Forgot Password Form ---
const forgotForm = document.getElementById("forgotPasswordForm");
if (forgotForm) {
  forgotForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("forgotEmail").value.trim();

    try {
      await sendPasswordResetEmail(auth, email);
      console.log("✅ Reset email sent to:", email);
      alert("Password reset email sent!");
    } catch (err) {
      console.error("❌ Reset error:", err.code, err.message);
      alert("Reset failed: " + err.message);
    }
  });
}

// --- Optional: Logout Button ---
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      console.log("✅ User signed out");
      window.location.href = "auth.html"; // back to login screen
    } catch (err) {
      console.error("❌ Sign-out error:", err.code, err.message);
    }
  });
}
