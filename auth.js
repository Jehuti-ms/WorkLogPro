// auth.js
// WorkLog Authentication using Firebase CDN modules
console.log("✅ auth.js loaded");
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
  apiKey: "AIzaSyDdLP_LgiC6EgzC3hUP_mGuNW4_BUEACs8",
  authDomain: "worklogpro-4284e.firebaseapp.com",
  projectId: "worklogpro-4284e",
  storageBucket: "worklogpro-4284e.firebasestorage.app",
  messagingSenderId: "299567233913",
  appId: "1:299567233913:web:7232a5a5a8aa9b79948da8"
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
  console.log("Register form submitted"); // Debug line

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("registerConfirmPassword").value;
  const acceptTerms = document.getElementById("acceptTerms").checked;

  // Basic validation
  if (!acceptTerms) {
    alert("You must accept the Terms of Service and Privacy Policy.");
    return;
  }
  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  try {
    // Create account in Firebase
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Optionally set displayName
    if (name) {
      await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js")
        .then(({ updateProfile }) => updateProfile(userCredential.user, { displayName: name }));
    }

    alert("Account created successfully!");
  } catch (err) {
    console.error("Registration error:", err);
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
