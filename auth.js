// auth.js
// WorkLog Authentication using Firebase CDN modules

// Import Firebase directly from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Replace with your Firebase project config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// -------------------- Event Listeners --------------------

// Login
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert("Login failed: " + err.message);
  }
});

// Register
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Account created successfully!");
  } catch (err) {
    alert("Registration failed: " + err.message);
  }
});

// Forgot password
document.getElementById("forgotPasswordForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("forgotEmail").value.trim();
  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent!");
  } catch (err) {
    alert("Error: " + err.message);
  }
});

// Google sign-in
document.getElementById("googleSignInBtn")?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Google sign-in failed: " + err.message);
  }
});

// Sign out
document.getElementById("signOutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
});

// -------------------- Auth Guard --------------------
onAuthStateChanged(auth, (user) => {
  const onAuthPage = window.location.pathname.includes("auth.html");

  if (user) {
    console.log("✅ Signed in:", user.email);
    if (onAuthPage) {
      window.location.href = "index.html";
    }
  } else {
    console.log("🔴 Signed out");
    if (!onAuthPage) {
      window.location.href = "auth.html";
    }
  }
});
