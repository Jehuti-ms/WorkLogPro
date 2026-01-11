// app.js - ROCK SOLID VERSION (NO JUMPING)
console.log('🚀 Loading ROCK-SOLID app.js');

// Global flag to prevent multiple redirects
let redirectInProgress = false;

// ==================== MAIN INIT ====================
function initApp() {
  console.log('🚀 initApp() called');
  
  // If we're on auth.html, STOP
  if (window.location.pathname.includes('auth.html')) {
    console.log('⏹️ On auth page, stopping');
    return;
  }
  
  // Start the safe initialization
  safeInit();
}

async function safeInit() {
  console.log('🔒 Starting SAFE initialization');
  
  try {
    // STEP 1: Wait for page to fully load
    await wait(500);
    
    // STEP 2: Check localStorage for previous auth
    const hasPreviousAuth = checkLocalStorageAuth();
    
    // STEP 3: If NO previous auth, redirect (only once)
    if (!hasPreviousAuth && !redirectInProgress) {
      console.log('❌ No previous auth found');
      redirectToAuth();
      return;
    }
    
    // STEP 4: Try Firebase auth (but don't rely on it)
    const firebaseUser = await tryFirebaseAuth();
    
    // STEP 5: If both checks fail AND we haven't redirected yet
    if (!firebaseUser && !hasPreviousAuth && !redirectInProgress) {
      console.log('❌ All auth checks failed');
      redirectToAuth();
      return;
    }
    
    // STEP 6: SUCCESS! Initialize the app
    console.log('✅ Auth successful, initializing app...');
    initializeApplication();
    
  } catch (error) {
    console.error('❌ Safe init error:', error);
    // DON'T redirect on error - just show message
    alert('App initialization error. Please refresh.');
  }
}

// ==================== HELPER FUNCTIONS ====================
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkLocalStorageAuth() {
  console.log('🔍 Checking localStorage for auth...');
  
  const checks = [
    localStorage.getItem('userEmail'),
    localStorage.getItem('userId'),
    localStorage.getItem('lastAuthTime'),
    localStorage.getItem('worklog_user')
  ];
  
  const hasAuth = checks.some(item => item && item !== 'null' && item !== 'undefined');
  
  console.log('LocalStorage auth result:', hasAuth ? 'FOUND' : 'NOT FOUND');
  return hasAuth;
}

async function tryFirebaseAuth() {
  console.log('🔍 Trying Firebase auth...');
  
  // If Firebase isn't loaded, skip
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.log('⚠️ Firebase not loaded, skipping');
    return null;
  }
  
  try {
    // Use the simple firebaseManager
    if (window.firebaseManager && window.firebaseManager.checkAuth) {
      const user = await window.firebaseManager.checkAuth();
      console.log('Firebase auth result:', user ? 'SUCCESS' : 'FAILED');
      return user;
    }
    
    // Fallback: direct check
    const user = firebase.auth().currentUser;
    console.log('Direct Firebase check:', user ? 'User found' : 'No user');
    return user;
    
  } catch (error) {
    console.log('⚠️ Firebase auth error:', error.message);
    return null;
  }
}

function redirectToAuth() {
  if (redirectInProgress) {
    console.log('🛑 Redirect already in progress, skipping');
    return;
  }
  
  redirectInProgress = true;
  console.log('🔄 Redirecting to auth page...');
  
  // Small delay to see logs
  setTimeout(() => {
    window.location.href = 'auth.html';
  }, 800);
}

// ==================== APPLICATION INITIALIZATION ====================
function initializeApplication() {
  console.log('🎨 Initializing application UI...');
  
  try {
    // Initialize tabs
    initTabs();
    
    // Initialize forms
    initForms();
    
    // Initialize FAB
    initFAB();
    
    // Set default rate
    const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
    document.getElementById('currentDefaultRateDisplay')?.textContent = defaultRate;
    document.getElementById('currentDefaultRate')?.textContent = defaultRate;
    document.getElementById('defaultBaseRate')?.value = defaultRate;
    
    // Load data
    loadInitialData();
    
    console.log('✅ Application initialized successfully');
    
  } catch (error) {
    console.error('❌ UI initialization error:', error);
  }
}

// ==================== UI FUNCTIONS ====================
function initTabs() {
  console.log('📋 Initializing tabs...');
  // Your tab code here
}

function initForms() {
  console.log('📝 Initializing forms...');
  // Your form code here
}

function initFAB() {
  console.log('➕ Initializing FAB...');
  // Your FAB code here
}

function loadInitialData() {
  console.log('📊 Loading initial data...');
  // Your data loading code here
}

// ==================== START THE APP ====================
// Wait for DOM to be fully ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM already loaded
  setTimeout(initApp, 100);
}

console.log('✅ ROCK-SOLID app.js loaded');
