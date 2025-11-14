// auth.js - Authentication flow only
import { auth } from "./firebase-config.js";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Persist session locally ---
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log("✅ Persistence set to local"))
  .catch(err => console.error("Persistence error:", err));

// --- Auth state listener ---
onAuthStateChanged(auth, user => {
  if (user) {
    console.log("🟢 Signed in:", user.email);
    if (!window.location.pathname.includes("index.html")) {
      window.location.href = "index.html";
    }
  } else {
    console.log("🔴 No user signed in");
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

// --- Logout Button ---
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      console.log("✅ User signed out");
      window.location.href = "auth.html";
    } catch (err) {
      console.error("❌ Sign-out error:", err.code, err.message);
    }
  });
}
