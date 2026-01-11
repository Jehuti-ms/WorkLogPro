// app.js - Fixed single version
console.log('🚀 Loading app.js...');

// ==================== HELPER FUNCTIONS ====================
function updateElementText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function showNotification(message, type = 'info') {
  console.log(`${type.toUpperCase()}: ${message}`);
  // Add your notification UI here
}

function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  console.log(isOnline ? '🌐 Online' : '📴 Offline');
  // Update UI if needed
}

// ==================== INITIALIZATION ====================
async function initApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  try {
    // Skip if on auth page
    if (window.location.pathname.includes('auth.html')) {
      console.log('🔐 On auth page, skipping init');
      return;
    }
    
    // Show loading
    document.body.style.opacity = '0.7';
    
    // Wait for Firebase to load
    await waitForFirebase();
    
    // Check auth with delay
    console.log('🔍 Checking authentication...');
    const user = await checkAuthWithTimeout();
    
    // If no user, redirect to auth page
    if (!user) {
      console.log('❌ No user found, redirecting to auth...');
      document.body.style.opacity = '1';
      
      // Small delay before redirect
      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 1000);
      return;
    }
    
    // User exists, continue
    console.log('✅ User authenticated:', user.email || user.uid);
    document.body.style.opacity = '1';
    
    // Initialize UI components
    initializeUI();
    
    // Load data
    await loadAllData();
    
    console.log('✅ App initialized successfully');
    
  } catch (error) {
    console.error('❌ App initialization error:', error);
    document.body.style.opacity = '1';
    
    // Don't redirect on error - let user decide
    showNotification('Error initializing app. Please refresh.', 'error');
  }
}

// ==================== AUTH FUNCTIONS ====================
function waitForFirebase() {
  return new Promise((resolve) => {
    const checkFirebase = () => {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        console.log('✅ Firebase loaded');
        resolve();
      } else {
        console.log('⏳ Waiting for Firebase...');
        setTimeout(checkFirebase, 100);
      }
    };
    checkFirebase();
  });
}

async function checkAuthWithTimeout() {
  return new Promise((resolve) => {
    // Try multiple methods
    
    // 1. First check localStorage (fastest)
    const storedAuth = localStorage.getItem('firebase_auth_user');
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        if (parsed.email && parsed.uid) {
          console.log('✅ Using cached auth from localStorage');
          resolve({
            uid: parsed.uid,
            email: parsed.email,
            displayName: parsed.email.split('@')[0],
            isCached: true
          });
          return;
        }
      } catch (e) {
        console.log('❌ Could not parse cached auth');
      }
    }
    
    // 2. Check if firebaseManager exists
    if (window.firebaseManager && window.firebaseManager.checkAuthDelayed) {
      console.log('🔍 Using firebaseManager.checkAuthDelayed()');
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth timeout')), 5000)
      );
      
      Promise.race([
        window.firebaseManager.checkAuthDelayed(),
        timeoutPromise
      ])
      .then(user => resolve(user))
      .catch(() => {
        console.log('⚠️ Firebase auth timed out, checking direct');
        checkDirectAuth(resolve);
      });
      
    } else {
      // 3. Direct check as fallback
      checkDirectAuth(resolve);
    }
  });
}

function checkDirectAuth(resolve) {
  console.log('🔍 Checking auth directly...');
  
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.log('❌ Firebase not available');
    resolve(null);
    return;
  }
  
  // Simple direct check
  const user = firebase.auth().currentUser;
  console.log('Direct auth check:', user ? 'Found user' : 'No user');
  
  if (user) {
    // Store for future
    localStorage.setItem('firebase_auth_user', JSON.stringify({
      email: user.email,
      uid: user.uid,
      timestamp: Date.now()
    }));
  }
  
  resolve(user);
}

// ==================== UI INITIALIZATION ====================
function initializeUI() {
  console.log('🎨 Initializing UI...');
  
  // Setup tab navigation
  setupTabNavigation();
  
  // Setup forms
  setupForms();
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup profile modal
  setupProfileModal();
  
  // Setup floating action button
  setupFloatingAddButton();
  
  // Setup sync controls
  setupSyncControls();
  
  // Set default rate
  const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
  updateElementText('currentDefaultRateDisplay', defaultRate);
  updateElementText('currentDefaultRate', defaultRate);
  setInputValue('defaultBaseRate', defaultRate);
  
  // Setup online/offline listeners
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

// ==================== DATA LOADING ====================
async function loadAllData() {
  console.log('📊 Loading all data...');
  
  try {
    // Load data for current tab
    const hash = window.location.hash.replace('#', '');
    const currentTab = hash || 'students';
    
    await loadTabData(currentTab);
    
    console.log('✅ Data loaded successfully');
  } catch (error) {
    console.error('❌ Error loading data:', error);
    showNotification('Error loading data', 'error');
  }
}

// ==================== TAB FUNCTIONS ====================
function setupTabNavigation() {
  console.log('📋 Setting up tab navigation...');
  
  const tabButtons = document.querySelectorAll('.tab');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Check URL hash
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    switchTab(hash);
  } else {
    switchTab('students');
  }
}

function switchTab(tabName) {
  console.log('📋 Switching to tab:', tabName);
  
  // Hide all tab contents
  document.querySelectorAll('.tabcontent').forEach(content => {
    content.classList.remove('active');
  });
  
  // Remove active class from all tab buttons
  document.querySelectorAll('.tab').forEach(button => {
    button.classList.remove('active');
  });
  
  // Show selected tab
  const selectedTab = document.getElementById(tabName);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }
  
  // Activate clicked tab button
  const activeButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }
  
  // Load data for this tab
  loadTabData(tabName);
}

async function loadTabData(tabName) {
  console.log(`📊 Loading data for ${tabName}...`);
  // Add your tab-specific data loading here
}

// ==================== START APP ====================
// Wait for DOM and Firebase
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM loaded, starting app...');
  initApp();
});
