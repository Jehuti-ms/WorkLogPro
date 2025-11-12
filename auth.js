// ============================================================================
// AUTH STATE
// ============================================================================
const authState = {
  users: [],            // stored users
  isAuthenticated: false,
  currentUser: null
};

// Load and save helpers
function loadAuthData() {
  try {
    const data = localStorage.getItem("worklog_auth");
    if (data) {
      authState.users = JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading auth data:", err);
    authState.users = [];
  }
}

function saveAuthData() {
  try {
    localStorage.setItem("worklog_auth", JSON.stringify(authState.users));
  } catch (err) {
    console.error("Error saving auth data:", err);
  }
}

// ============================================================================
// AUTH OPERATIONS
// ============================================================================
async function registerUser(name, email, password) {
  console.log("Registering user:", email);

  try {
    if (!name || !email || !password) {
      throw new Error("Please fill in all fields");
    }

    const existingUser = authState.users.find(
      u => u.email.toLowerCase() === email.toLowerCase()
    );
    if (existingUser) {
      throw new Error("An account with this email already exists");
    }

    const user = {
      id: "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    authState.users.push(user);
    authState.isAuthenticated = true;
    authState.currentUser = user;

    saveAuthData();
    localStorage.setItem("worklog_session", user.id);

    showNotification("🎉 Account created successfully!", "success");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);

    return user;
  } catch (error) {
    console.error("Registration error:", error);
    showNotification(error.message, "error");
    throw error;
  }
}

async function loginUser(email, password) {
  console.log("Login attempt:", email);

  try {
    if (!email || !password) {
      throw new Error("Please fill in all fields");
    }

    const user = authState.users.find(
      u => u.email.toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      throw new Error("No account found with this email");
    }
    if (user.password !== password) {
      throw new Error("Invalid password");
    }

    user.lastLogin = new Date().toISOString();
    authState.isAuthenticated = true;
    authState.currentUser = user;

    saveAuthData();
    localStorage.setItem("worklog_session", user.id);

    showNotification(`👋 Welcome back, ${user.name}!`, "success");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);

    return user;
  } catch (error) {
    console.error("Login error:", error);
    showNotification(error.message, "error");
    throw error;
  }
}

function logoutUser() {
  console.log("Logging out user");
  authState.isAuthenticated = false;
  authState.currentUser = null;
  localStorage.removeItem("worklog_session");
  window.location.href = "auth.html";
}

function getCurrentUser() {
  return authState.currentUser;
}

function getCurrentUserId() {
  return authState.currentUser ? authState.currentUser.id : null;
}

// ============================================================================
// SESSION VALIDATION
// ============================================================================
function validateSession() {
  const sessionId = localStorage.getItem("worklog_session");
  console.log("🔍 Validating session:", sessionId);

  if (!sessionId) {
    console.log("❌ No session found");
    return false;
  }

  const user = authState.users.find(u => u.id === sessionId);
  if (!user) {
    console.log("❌ Session invalid - user not found");
    localStorage.removeItem("worklog_session");
    return false;
  }

  console.log("✅ Session valid for user:", user.email);
  authState.isAuthenticated = true;
  authState.currentUser = user;
  return true;
}

function checkExistingSession() {
  return validateSession();
}

// ============================================================================
// INIT AUTH
// ============================================================================
function initAuth() {
  console.log("🔐 Initializing auth system...");
  loadAuthData();

  const hasValidSession = validateSession();

  if (window.location.pathname.includes("auth.html")) {
    setupAuthEventListeners();
    if (hasValidSession) {
      console.log("✅ Already logged in, redirecting to app...");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
    }
  } else {
    // We're on index.html
    if (hasValidSession) {
      console.log("✅ Valid session - user can access main app");
      // continue loading app
    } else {
      console.log("❌ No valid session - redirecting to auth page");
      window.location.href = "auth.html";
    }
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupAuthEventListeners() {
  // Login form
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;
      await loginUser(email, password);
    });
  }

  // Register form
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("registerName").value;
      const email = document.getElementById("registerEmail").value;
      const password = document.getElementById("registerPassword").value;
      await registerUser(name, email, password);
    });
  }

  // Forgot password form
  const forgotForm = document.getElementById("forgotPasswordForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("forgotEmail").value;
      if (!email) {
        showNotification("Please enter your email", "error");
        return;
      }
      const user = authState.users.find(u => u.email === email);
      if (user) {
        showNotification("📧 Password reset link would be sent (demo)", "success");
      } else {
        showNotification("No account found with this email", "error");
      }
    });
  }

  // Google sign-in button (demo stub)
  const googleBtn = document.getElementById("googleSignInBtn");
  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      showNotification("🔑 Google sign-in not yet wired (demo)", "info");
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.getCurrentUser = getCurrentUser;
window.getCurrentUserId = getCurrentUserId;
window.initAuth = initAuth;
