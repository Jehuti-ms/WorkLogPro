// auth.js - Authentication flow only
import { auth } from "./firebase-config.js";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Persist session locally ---
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log("✅ Persistence set to local"))
  .catch(err => console.error("Persistence error:", err));

// --- UI Helper Functions ---
function showLoading() {
  const loading = document.getElementById('loadingOverlay');
  if (loading) loading.style.display = 'flex';
}

function hideLoading() {
  const loading = document.getElementById('loadingOverlay');
  if (loading) loading.style.display = 'none';
}

function showMessage(elementId, message, isError = true) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.className = isError ? 'error-message message-show' : 'success-message message-show';
    setTimeout(() => {
      element.className = isError ? 'error-message' : 'success-message';
    }, 5000);
  }
}

function clearFormMessages() {
  const messages = document.querySelectorAll('.error-message, .success-message');
  messages.forEach(msg => {
    msg.className = msg.classList.contains('error-message') ? 'error-message' : 'success-message';
  });
}

// --- Tab Management ---
function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab[data-tab-target]");
  const tabContents = document.querySelectorAll(".auth-tab-content");
  const internalLinks = document.querySelectorAll("[data-link-target]");

  function showTab(targetId) {
    clearFormMessages();
    tabContents.forEach(content => content.classList.remove("active"));
    tabButtons.forEach(btn => btn.classList.remove("active"));

    const targetContent = document.getElementById(targetId);
    const targetButton = document.querySelector(`.tab[data-tab-target="${targetId}"]`);
    
    if (targetContent) targetContent.classList.add("active");
    if (targetButton) targetButton.classList.add("active");
  }

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-tab-target");
      showTab(targetId);
    });
  });

  internalLinks.forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const targetId = link.getAttribute("data-link-target");
      showTab(targetId);
    });
  });

  // Set default tab
  showTab("login");
}

// --- Auth state listener ---
onAuthStateChanged(auth, user => {
  console.log("🔐 Auth state changed:", user ? user.email : "No user");
  if (user) {
    console.log("🟢 User authenticated:", user.email);
    // Redirect to main app if we're on auth page
    if (window.location.pathname.includes("auth.html") || window.location.pathname.endsWith("/")) {
      window.location.href = "index.html";
    }
  } else {
    console.log("🔴 No user signed in");
    // If we're on index.html without auth, redirect to login
    if (window.location.pathname.includes("index.html")) {
      window.location.href = "auth.html";
    }
  }
});

// --- Login Form ---
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    showLoading();
    clearFormMessages();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
      showMessage('loginError', 'Please fill in all fields');
      hideLoading();
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Login successful for:", userCredential.user.email);
      // Redirect will happen automatically via auth state listener
    } catch (err) {
      console.error("❌ Login error:", err.code, err.message);
      let errorMessage = "Login failed. Please try again.";
      
      switch (err.code) {
        case 'auth/invalid-email':
          errorMessage = "Invalid email address.";
          break;
        case 'auth/user-disabled':
          errorMessage = "This account has been disabled.";
          break;
        case 'auth/user-not-found':
          errorMessage = "No account found with this email.";
          break;
        case 'auth/wrong-password':
          errorMessage = "Incorrect password.";
          break;
        case 'auth/too-many-requests':
          errorMessage = "Too many failed attempts. Please try again later.";
          break;
      }
      
      showMessage('loginError', errorMessage);
    } finally {
      hideLoading();
    }
  });
}

// --- Register Form ---
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    showLoading();
    clearFormMessages();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const confirmPassword = document.getElementById("registerConfirmPassword").value.trim();
    const acceptTerms = document.getElementById("acceptTerms").checked;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      showMessage('registerError', 'Please fill in all fields');
      hideLoading();
      return;
    }

    if (password !== confirmPassword) {
      showMessage('registerError', 'Passwords do not match');
      hideLoading();
      return;
    }

    if (password.length < 6) {
      showMessage('registerError', 'Password must be at least 6 characters long');
      hideLoading();
      return;
    }

    if (!acceptTerms) {
      showMessage('registerError', 'Please accept the Terms and Privacy Policy');
      hideLoading();
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile with display name
      await updateProfile(userCredential.user, {
        displayName: name
      });

      console.log("✅ Account created for:", name, email);
      showMessage('registerSuccess', 'Account created successfully! Redirecting...', false);
      
      // Wait a moment then redirect
      setTimeout(() => {
        window.location.href = "index.html";
      }, 2000);
      
    } catch (err) {
      console.error("❌ Registration error:", err.code, err.message);
      let errorMessage = "Registration failed. Please try again.";
      
      switch (err.code) {
        case 'auth/email-already-in-use':
          errorMessage = "An account with this email already exists.";
          break;
        case 'auth/invalid-email':
          errorMessage = "Invalid email address.";
          break;
        case 'auth/operation-not-allowed':
          errorMessage = "Operation not allowed. Please contact support.";
          break;
        case 'auth/weak-password':
          errorMessage = "Password is too weak. Please use a stronger password.";
          break;
      }
      
      showMessage('registerError', errorMessage);
    } finally {
      hideLoading();
    }
  });
}

// --- Forgot Password Form ---
const forgotForm = document.getElementById("forgotPasswordForm");
if (forgotForm) {
  forgotForm.addEventListener("submit", async e => {
    e.preventDefault();
    showLoading();
    clearFormMessages();

    const email = document.getElementById("forgotEmail").value.trim();

    if (!email) {
      showMessage('forgotError', 'Please enter your email address');
      hideLoading();
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      console.log("✅ Reset email sent to:", email);
      showMessage('forgotSuccess', 'Password reset email sent! Check your inbox.', false);
      document.getElementById('forgotEmail').value = '';
    } catch (err) {
      console.error("❌ Reset error:", err.code, err.message);
      let errorMessage = "Failed to send reset email. Please try again.";
      
      switch (err.code) {
        case 'auth/invalid-email':
          errorMessage = "Invalid email address.";
          break;
        case 'auth/user-not-found':
          errorMessage = "No account found with this email.";
          break;
        case 'auth/too-many-requests':
          errorMessage = "Too many attempts. Please try again later.";
          break;
      }
      
      showMessage('forgotError', errorMessage);
    } finally {
      hideLoading();
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

// --- Initialize when DOM is loaded ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("🔐 Auth system initializing...");
  setupTabs();
  
  // Check if user is already logged in
  const user = auth.currentUser;
  if (user && window.location.pathname.includes("auth.html")) {
    console.log("🔄 User already logged in, redirecting...");
    window.location.href = "index.html";
  }
});
