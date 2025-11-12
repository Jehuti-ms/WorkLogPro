// auth.js
console.log("✅ auth.js loaded");

// Firebase CDN imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Firebase config (corrected storageBucket)
const firebaseConfig = {
  apiKey: "AIzaSyDdLP_LgiC6EgzC3hUP_mGuNW4_BUEACs8",
  authDomain: "worklogpro-4284e.firebaseapp.com",
  projectId: "worklogpro-4284e",
  storageBucket: "worklogpro-4284e.appspot.com",
  messagingSenderId: "299567233913",
  appId: "1:299567233913:web:7232a5a5a8aa9b79948da8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Wait for DOM before attaching listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("🧩 DOM ready");

  // -------------------- Login --------------------
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail")?.value.trim();
      const password = document.getElementById("loginPassword")?.value;
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        alert("Login failed: " + err.message);
      }
    });
  }

  // -------------------- Register --------------------
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("🟢 Register form submitted");

      const name = document.getElementById("registerName")?.value.trim();
      const email = document.getElementById("registerEmail")?.value.trim();
      const password = document.getElementById("registerPassword")?.value;
      const confirmPassword = document.getElementById("registerConfirmPassword")?.value;
      const acceptTerms = document.getElementById("acceptTerms")?.checked;

      if (!acceptTerms) return alert("You must accept the Terms.");
      if (password !== confirmPassword) return alert("Passwords do not match.");

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
        alert("Account created successfully!");
      } catch (err) {
        console.error("Registration error:", err);
        alert("Registration failed: " + err.message);
      }
    });
  }

  // -------------------- Forgot Password --------------------
  const forgotForm = document.getElementById("forgotPasswordForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("forgotEmail")?.value.trim();
      try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent!");
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  }

  // -------------------- Google Sign-In --------------------
  const googleBtn = document.getElementById("googleSignInBtn");
  if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        alert("Google sign-in failed: " + err.message);
      }
    });
  }

  // -------------------- Sign Out --------------------
  const signOutBtn = document.getElementById("signOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await signOut(auth);
    });
  }
});

// -------------------- Auth Guard --------------------
onAuthStateChanged(auth, (user) => {
  const onAuthPage = window.location.pathname.includes("auth.html");

  if (user) {
    console.log("✅ Signed in:", user.email);
    if (onAuthPage) window.location.href = "index.html";
  } else {
    console.log("🔴 Signed out");
    if (!onAuthPage) window.location.href = "auth.html";
  }
});
