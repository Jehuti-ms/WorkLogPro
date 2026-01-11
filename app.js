// app.js - WORKING VERSION (No premature redirects)
console.log('🚀 Loading WORKING app.js');

// Global flag to track initialization state
let appInitialized = false;
let redirectBlocked = false;

// ==================== MAIN INITIALIZATION ====================
async function initializeApp() {
  console.log('🚀 Starting app initialization...');
  
  // Prevent multiple initializations
  if (appInitialized) {
    console.log('⚠️ App already initialized');
    return;
  }
  
  try {
    // STEP 1: Check if we're on auth page
    if (isAuthPage()) {
      console.log('🔐 On auth page - stopping app init');
      return;
    }
    
    // STEP 2: Wait for page to settle
    await wait(800);
    
    // STEP 3: Check authentication WITHOUT redirecting
    const isAuthenticated = await checkAuthentication();
    
    // STEP 4: If not authenticated, redirect (ONLY ONCE)
    if (!isAuthenticated && !redirectBlocked) {
      console.log('❌ Not authenticated, will redirect to auth');
      redirectBlocked = true;
      
      // Wait a bit more then redirect
      setTimeout(() => {
        console.log('🔄 Redirecting to auth page...');
        window.location.href = 'auth.html';
      }, 1200);
      return;
    }
    
    // STEP 5: App is authenticated - proceed
    console.log('✅ App authenticated, proceeding...');
    appInitialized = true;
    
    // Initialize the application
    await initializeApplication();
    
    console.log('✅ App initialized successfully!');
    
  } catch (error) {
    console.error('❌ App initialization error:', error);
    showError('App failed to initialize. Please refresh.');
  }
}

// ==================== HELPER FUNCTIONS ====================
function isAuthPage() {
  return window.location.pathname.includes('auth.html');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkAuthentication() {
  console.log('🔍 Checking authentication status...');
  
  // Method 1: Use AuthManager if available
  if (window.AuthManager && window.AuthManager.isAuthenticated) {
    console.log('Using AuthManager...');
    return window.AuthManager.isAuthenticated();
  }
  
  // Method 2: Check localStorage directly
  console.log('Checking localStorage...');
  const hasLocalAuth = checkLocalAuth();
  
  if (hasLocalAuth) {
    console.log('✅ Found auth in localStorage');
    return true;
  }
  
  // Method 3: Check Firebase (with timeout)
  console.log('Checking Firebase...');
  const hasFirebaseAuth = await checkFirebaseAuth();
  
  return hasLocalAuth || hasFirebaseAuth;
}

function checkLocalAuth() {
  // Check multiple possible auth storage locations
  const authChecks = [
    'worklog_user',
    'userEmail',
    'userId',
    'firebase:authUser:',
    'lastAuthTime'
  ];
  
  for (const key of authChecks) {
    const value = localStorage.getItem(key);
    if (value && value !== 'null' && value !== 'undefined') {
      console.log(`Found auth in ${key}:`, value.substring(0, 50) + '...');
      return true;
    }
  }
  
  return false;
}

async function checkFirebaseAuth() {
  // Check if Firebase is loaded
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.log('Firebase not loaded');
    return false;
  }
  
  return new Promise((resolve) => {
    // Set a timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.log('Firebase auth check timeout');
      resolve(false);
    }, 3000);
    
    // Check for existing user
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
      clearTimeout(timeoutId);
      console.log('✅ Found Firebase user:', currentUser.email);
      resolve(true);
      return;
    }
    
    // Listen for auth state (with timeout)
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      clearTimeout(timeoutId);
      unsubscribe();
      
      if (user) {
        console.log('✅ Firebase auth state changed - user found');
        // Store for future use
        if (window.AuthManager) {
          window.AuthManager.storeAuth(user);
        }
        resolve(true);
      } else {
        console.log('❌ Firebase auth state changed - no user');
        resolve(false);
      }
    });
  });
}

function showError(message) {
  console.error('💥 Error:', message);
  // You can show a nice error message on the page
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: #ff4444; color: white; padding: 15px; border-radius: 5px;
    z-index: 9999; font-family: Arial; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  errorDiv.innerHTML = `
    ${message}<br>
    <button onclick="location.reload()" style="margin-top:10px; padding:5px 10px;">
      🔄 Refresh
    </button>
  `;
  document.body.appendChild(errorDiv);
}

// ==================== APPLICATION INITIALIZATION ====================
async function initializeApplication() {
  console.log('🎨 Initializing application...');
  
  // Show loading state
  document.body.style.opacity = '0.8';
  
  // Initialize all components
  await Promise.all([
    initializeTabs(),
    initializeForms(),
    initializeFAB(),
    initializeProfile(),
    initializeSync()
  ]);
  
  // Set default rate
  const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
  setElementText('currentDefaultRateDisplay', defaultRate);
  setElementText('currentDefaultRate', defaultRate);
  setInputValue('defaultBaseRate', defaultRate);
  
  // Load data
  await loadInitialData();
  
  // Hide loading state
  document.body.style.opacity = '1';
  
  console.log('✅ Application initialized');
}

function setElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// ==================== COMPONENT INITIALIZATIONS ====================
async function initializeTabs() {
  console.log('📋 Initializing tabs...');
  // Your tab initialization code
}

async function initializeForms() {
  console.log('📝 Initializing forms...');
  // Your form initialization code
}

async function initializeFAB() {
  console.log('➕ Initializing FAB...');
  // Your FAB initialization code
}

async function initializeProfile() {
  console.log('👤 Initializing profile...');
  // Your profile initialization code
}

async function initializeSync() {
  console.log('☁️ Initializing sync...');
  // Your sync initialization code
}

async function loadInitialData() {
  console.log('📊 Loading initial data...');
  // Your data loading code
  await wait(500); // Simulate loading
}

// ==================== START THE APP ====================
// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM fully loaded');
    setTimeout(initializeApp, 300); // Small delay
  });
} else {
  console.log('📄 DOM already loaded');
  setTimeout(initializeApp, 300); // Small delay
}

console.log('✅ WORKING app.js loaded');
