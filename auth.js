// auth.js
// WorkLog Authentication (Firebase) - Drop-in replacement

import { auth } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

/* ---------------------------------------------
   Helpers: lightweight UI feedback
--------------------------------------------- */
function showBtnLoading(btn, isLoading, loadingText = "Loading...") {
  if (!btn) return;
  const textEl = btn.querySelector(".btn-text");
  const loadingEl = btn.querySelector(".btn-loading");
  if (textEl && loadingEl) {
    textEl.style.display = isLoading ? "none" : "inline";
    loadingEl.style.display = isLoading ? "inline" : "none";
    if (isLoading) loadingEl.textContent = loadingText;
  }
}

function showInlineMessage(el, msg, type = "error") {
  if (!el) return;
  el.textContent = msg;
  el.className = type === "success" ? "success-message message-show" : "error-message message-show";
}

/* ---------------------------------------------
   Event wiring for forms and buttons
--------------------------------------------- */
function setupAuthEventListeners() {
  // Tabs
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.getAttribute("data-tab");
      switchAuthTab(name);
    });
  });

  // Login form
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail")?.value?.trim();
      const password = document.getElementById("loginPassword")?.value;

      const submitBtn = loginForm.querySelector("button[type='submit']");
      showBtnLoading(submitBtn, true, "Signing in...");

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        showInlineMessage(loginForm.querySelector(".error-message"), err.message, "error");
        alert("Login failed: " + err.message);
      } finally {
        showBtnLoading(submitBtn, false);
      }
    });
  }

  // Register form
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("registerName")?.value?.trim(); // optional, not stored by Firebase Auth
      const email = document.getElementById("registerEmail")?.value?.trim();
      const password = document.getElementById("registerPassword")?.value;

      const submitBtn = registerForm.querySelector("button[type='submit']");
      showBtnLoading(submitBtn, true, "Creating account...");

      try {
        await createUserWithEmailAndPassword(auth, email, password);
        // Optionally save displayName later via updateProfile
        showInlineMessage(registerForm.querySelector(".success-message"), "Account created!", "success");
      } catch (err) {
        showInlineMessage(registerForm.querySelector(".error-message"), err.message, "error");
        alert("Registration failed: " + err.message);
      } finally {
        showBtnLoading(submitBtn, false);
      }
    });
  }

  // Forgot password form
  const forgotForm = document.getElementById("forgotPasswordForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("forgotEmail")?.value?.trim();

      const submitBtn = forgotForm.querySelector("button[type='submit']");
      showBtnLoading(submitBtn, true, "Sending...");

      try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent!");
      } catch (err) {
        alert("Error: " + err.message);
      } finally {
        showBtnLoading(submitBtn, false);
      }
    });
  }

  // Google sign-in
  const googleBtn = document.getElementById("googleSignInBtn");
  if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
      const provider = new GoogleAuthProvider();
      showBtnLoading(googleBtn, true, "Connecting...");
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        alert("Google sign-in failed: " + err.message);
      } finally {
        showBtnLoading(googleBtn, false);
      }
    });
  }

  // Sign out (if present on auth.html)
  const signOutBtn = document.getElementById("signOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await signOut(auth);
    });
  }

  // Utility links
  window.showForgotPassword = function () {
    document.querySelectorAll(".auth-tab-content").forEach((c) => (c.style.display = "none"));
    document.getElementById("forgotPassword").style.display = "block";
  };
  window.showLogin = function () {
    switchAuthTab("login");
  };
}

/* ---------------------------------------------
   Tab switching
--------------------------------------------- */
function switchAuthTab(tabName) {
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.getAttribute("data-tab") === tabName);
  });

  document.querySelectorAll(".auth-tab-content").forEach((content) => {
    content.classList.remove("active");
    content.style.display = "none";
  });

  const target = document.getElementById(tabName);
  if (target) {
    target.classList.add("active");
    target.style.display = "block";
  }
}

/* ---------------------------------------------
   Auth state listener + routing guard
--------------------------------------------- */
function attachAuthGuard() {
  onAuthStateChanged(auth, (user) => {
    const onAuthPage = window.location.pathname.includes("auth.html");

    if (user) {
      // Signed in: go to app if we’re on the auth page
      if (onAuthPage) {
        window.location.href = "index.html";
      }
    } else {
      // Signed out: keep auth.html visible, bounce away from index.html
      if (!onAuthPage) {
        window.location.href = "auth.html";
      }
    }
  });
}

/* ---------------------------------------------
   Init
--------------------------------------------- */
function initAuth() {
  const onAuthPage = window.location.pathname.includes("auth.html");

  // Always attach guard
  attachAuthGuard();

  if (onAuthPage) {
    setupAuthEventListeners();
    // Ensure default visible tab
    switchAuthTab("login");
  }
}

/* ---------------------------------------------
   Bootstrap on DOM ready
--------------------------------------------- */
document.addEventListener("DOMContentLoaded", initAuth);

// Expose if needed
window.initAuth = initAuth;
