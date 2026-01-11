// app.js - COMPLETE FIXED VERSION
console.log('🚀 Loading COMPLETE app.js');

// ==================== GLOBAL VARIABLES ====================
let appInitialized = false;
let redirectInProgress = false;

// ==================== MAIN INITIALIZATION ====================
function initApp() {
  console.log('🚀 Initializing app...');
  
  // Prevent multiple initializations
  if (appInitialized) {
    console.log('⚠️ App already initialized');
    return;
  }
  
  // Don't run on auth page
  if (isAuthPage()) {
    console.log('⏹️ On auth page, stopping');
    return;
  }
  
  // Start safe initialization
  safeInit();
}

async function safeInit() {
  console.log('🔒 Starting safe initialization...');
  
  try {
    // Wait for page to settle
    await delay(800);
    
    // Check authentication
    const isAuthenticated = await checkAuthentication();
    
    // If not authenticated and no redirect yet, redirect
    if (!isAuthenticated && !redirectInProgress) {
      console.log('❌ Not authenticated');
      redirectInProgress = true;
      
      // Delay then redirect
      setTimeout(() => {
        console.log('🔄 Redirecting to auth page...');
        window.location.href = 'auth.html';
      }, 1200);
      return;
    }
    
    // Authentication successful
    console.log('✅ Authentication successful');
    appInitialized = true;
    
    // Initialize app UI
    initAppUI();
    
  } catch (error) {
    console.error('❌ Safe init error:', error);
    showErrorMessage('App initialization failed. Please refresh.');
  }
}

// ==================== HELPER FUNCTIONS ====================
function isAuthPage() {
  return window.location.pathname.includes('auth.html') || 
         window.location.href.includes('auth.html');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkAuthentication() {
  console.log('🔍 Checking authentication...');
  
  // Check localStorage first
  if (checkLocalStorageAuth()) {
    console.log('✅ Found auth in localStorage');
    return true;
  }
  
  // Check Firebase
  const firebaseAuth = await checkFirebaseAuth();
  if (firebaseAuth) {
    console.log('✅ Found auth in Firebase');
    return true;
  }
  
  console.log('❌ No auth found');
  return false;
}

function checkLocalStorageAuth() {
  // Check multiple possible auth keys
  const authKeys = [
    'worklog_user',
    'userEmail', 
    'userId',
    'firebase:authUser:',
    'lastAuthTime'
  ];
  
  for (const key of authKeys) {
    const value = localStorage.getItem(key);
    if (value && value !== 'null' && value !== 'undefined') {
      console.log(`Found ${key}:`, value.substring(0, 30) + '...');
      return true;
    }
  }
  
  return false;
}

async function checkFirebaseAuth() {
  // Check if Firebase is loaded
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.log('Firebase not available');
    return false;
  }
  
  return new Promise((resolve) => {
    // Set timeout
    const timeoutId = setTimeout(() => {
      console.log('Firebase auth timeout');
      resolve(false);
    }, 2000);
    
    // Check current user
    const user = firebase.auth().currentUser;
    if (user) {
      clearTimeout(timeoutId);
      console.log('Firebase user:', user.email);
      storeUserInLocalStorage(user);
      resolve(true);
      return;
    }
    
    // Listen for auth changes
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      clearTimeout(timeoutId);
      unsubscribe();
      
      if (user) {
        console.log('Firebase auth changed - user found');
        storeUserInLocalStorage(user);
        resolve(true);
      } else {
        console.log('Firebase auth changed - no user');
        resolve(false);
      }
    });
  });
}

function storeUserInLocalStorage(user) {
  if (!user) return;
  
  const userData = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0],
    timestamp: Date.now()
  };
  
  localStorage.setItem('worklog_user', JSON.stringify(userData));
  localStorage.setItem('userEmail', user.email);
  console.log('✅ User stored in localStorage');
}

function showErrorMessage(message) {
  console.error('💥 Error:', message);
  
  const errorDiv = document.createElement('div');
  errorDiv.id = 'app-error-message';
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #ff4444;
    color: white;
    padding: 15px;
    border-radius: 5px;
    z-index: 99999;
    font-family: Arial;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    max-width: 400px;
  `;
  
  errorDiv.innerHTML = `
    <strong>⚠️ Error</strong><br>
    ${message}<br>
    <button onclick="this.parentElement.remove(); location.reload();" 
            style="margin-top:10px; padding:5px 10px;">
      🔄 Refresh
    </button>
  `;
  
  document.body.appendChild(errorDiv);
}

// ==================== APP UI INITIALIZATION ====================
function initAppUI() {
  console.log('🎨 Initializing app UI...');
  
  try {
    // Set default rate
    initDefaultRate();
    
    // Initialize all components
    initTabs();
    initForms();
    initFAB();
    initProfileModal();
    initSyncControls();
    
    // Load data
    loadInitialData();
    
    console.log('✅ App UI initialized');
    
  } catch (error) {
    console.error('❌ UI init error:', error);
  }
}

function initDefaultRate() {
  const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
  
  const elements = {
    'currentDefaultRateDisplay': defaultRate,
    'currentDefaultRate': defaultRate
  };
  
  Object.keys(elements).forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = elements[id];
  });
  
  const rateInput = document.getElementById('defaultBaseRate');
  if (rateInput) rateInput.value = defaultRate;
}

function initTabs() {
  console.log('📋 Initializing tabs...');
  
  const tabButtons = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tabcontent');
  
  // Define switchTab function
  function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Hide all tab contents
    tabContents.forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Remove active from all buttons
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
      selectedTab.classList.add('active');
    }
    
    // Activate button
    const activeButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }
    
    // Update URL hash
    window.location.hash = tabName;
  }
  
  // Add click listeners
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Check URL hash
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) {
    switchTab(hash);
  } else {
    switchTab('students');
  }
  
  // Make switchTab available globally for FAB
  window.switchTab = switchTab;
}

function initForms() {
  console.log('📝 Initializing forms...');
  
  // Set today's date in date fields
  const today = new Date().toISOString().split('T')[0];
  const dateFields = ['workDate', 'marksDate', 'attendanceDate', 'paymentDate'];
  
  dateFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = today;
    }
  });
  
  // Initialize student form
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('Student form submitted');
      // Add your form handling here
    });
  }
}

function initFAB() {
  console.log('➕ Initializing FAB...');
  
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');
  
  if (!fab || !fabMenu || !fabOverlay) {
    console.log('FAB elements not found');
    return;
  }
  
  // Toggle FAB menu
  fab.addEventListener('click', function(e) {
    e.stopPropagation();
    const isActive = fabMenu.classList.contains('active');
    
    if (isActive) {
      fabMenu.classList.remove('active');
      fabOverlay.style.display = 'none';
      fab.textContent = '+';
    } else {
      fabMenu.classList.add('active');
      fabOverlay.style.display = 'block';
      fab.textContent = '×';
    }
  });
  
  // Close on overlay click
  fabOverlay.addEventListener('click', function() {
    fabMenu.classList.remove('active');
    fabOverlay.style.display = 'none';
    fab.textContent = '+';
  });
  
  // Close on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && fabMenu.classList.contains('active')) {
      fabMenu.classList.remove('active');
      fabOverlay.style.display = 'none';
      fab.textContent = '+';
    }
  });
  
  // FAB menu items
  const fabActions = {
    'fabAddStudent': 'students',
    'fabAddHours': 'hours',
    'fabAddMark': 'marks',
    'fabAddAttendance': 'attendance'
  };
  
  Object.keys(fabActions).forEach(fabId => {
    const fabItem = document.getElementById(fabId);
    if (fabItem) {
      fabItem.addEventListener('click', function() {
        const tabName = fabActions[fabId];
        
        // Switch to tab
        if (window.switchTab) {
          window.switchTab(tabName);
        }
        
        // Close FAB menu
        fabMenu.classList.remove('active');
        fabOverlay.style.display = 'none';
        fab.textContent = '+';
      });
    }
  });
}

// ==================== PROFILE FUNCTIONS ====================
function initProfileModal() {
  console.log('👤 Initializing profile modal...');
  
  const profileBtn = document.getElementById('profileBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileBtn = document.getElementById('closeProfileModal');
  const logoutBtn = document.getElementById('logoutBtn');
  
  // Open modal
  if (profileBtn && profileModal) {
    profileBtn.addEventListener('click', function() {
      updateProfileInfo();
      profileModal.style.display = 'block';
    });
  }
  
  // Close modal
  if (closeProfileBtn && profileModal) {
    closeProfileBtn.addEventListener('click', function() {
      profileModal.style.display = 'none';
    });
  }
  
  // Close on outside click
  if (profileModal) {
    window.addEventListener('click', function(event) {
      if (event.target === profileModal) {
        profileModal.style.display = 'none';
      }
    });
  }
  
  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to logout?')) {
        handleLogout();
      }
    });
  }
  
  // Make updateProfileInfo available globally
  window.updateProfileInfo = updateProfileInfo;
}

function updateProfileInfo() {
  console.log('🔄 Updating profile info...');
  
  try {
    // Get user email
    const userEmail = localStorage.getItem('userEmail') || 
                     localStorage.getItem('worklog_user') ? 
                     JSON.parse(localStorage.getItem('worklog_user')).email : 
                     'Not logged in';
    
    // Update UI elements
    const profileEmail = document.getElementById('profileUserEmail');
    const userName = document.getElementById('userName');
    
    if (profileEmail) profileEmail.textContent = userEmail;
    if (userName) userName.textContent = userEmail.split('@')[0] || 'User';
    
    // Update stats
    updateProfileStats();
    
  } catch (error) {
    console.error('Error updating profile:', error);
  }
}

function updateProfileStats() {
  console.log('📊 Updating profile stats...');
  
  // Get data from localStorage
  const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
  
  // Calculate stats
  const totalStudents = students.length;
  
  const totalHours = hours.reduce((sum, hour) => {
    return sum + (parseFloat(hour.hoursWorked) || 0);
  }, 0);
  
  const totalEarnings = hours.reduce((sum, hour) => {
    const hoursWorked = parseFloat(hour.hoursWorked) || 0;
    const rate = parseFloat(hour.baseRate) || 0;
    return sum + (hoursWorked * rate);
  }, 0);
  
  // Update UI
  const studentsElem = document.getElementById('modalStatStudents');
  const hoursElem = document.getElementById('modalStatHours');
  const earningsElem = document.getElementById('modalStatEarnings');
  const updatedElem = document.getElementById('modalStatUpdated');
  
  if (studentsElem) studentsElem.textContent = totalStudents;
  if (hoursElem) hoursElem.textContent = totalHours.toFixed(1);
  if (earningsElem) earningsElem.textContent = totalEarnings.toFixed(2);
  if (updatedElem) updatedElem.textContent = new Date().toLocaleTimeString();
}

function handleLogout() {
  console.log('🚪 Logging out...');
  
  // Clear localStorage
  localStorage.removeItem('worklog_user');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userId');
  localStorage.removeItem('lastAuthTime');
  
  // Sign out from Firebase if available
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().signOut().catch(error => {
      console.log('Firebase logout error:', error);
    });
  }
  
  // Redirect to auth page
  window.location.href = 'auth.html';
}

// ==================== SYNC CONTROLS ====================
function initSyncControls() {
  console.log('☁️ Initializing sync controls...');
  
  // Sync button
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', function() {
      console.log('Sync button clicked');
      // Add sync logic here
    });
  }
  
  // Auto-sync checkbox
  const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
  if (autoSyncCheckbox) {
    autoSyncCheckbox.addEventListener('change', function() {
      console.log('Auto-sync:', this.checked ? 'enabled' : 'disabled');
      localStorage.setItem('autoSyncEnabled', this.checked);
    });
    
    // Load saved setting
    const autoSyncEnabled = localStorage.getItem('autoSyncEnabled') === 'true';
    autoSyncCheckbox.checked = autoSyncEnabled;
  }
}

// ==================== DATA LOADING ====================
function loadInitialData() {
  console.log('📊 Loading initial data...');
  
  // Load students
  loadStudents();
  
  // Load hours
  loadHours();
  
  // Update stats
  updateGlobalStats();
}

function loadStudents() {
  console.log('👥 Loading students...');
  
  const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  const container = document.getElementById('studentsContainer');
  
  if (!container) return;
  
  if (students.length === 0) {
    container.innerHTML = '<p class="empty-message">No students registered yet.</p>';
    return;
  }
  
  // Update count
  const countElem = document.getElementById('studentCount');
  if (countElem) countElem.textContent = students.length;
  
  // You can add more student loading logic here
}

function loadHours() {
  console.log('⏱️ Loading hours...');
  
  const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
  const container = document.getElementById('hoursContainer');
  
  if (!container) return;
  
  if (hours.length === 0) {
    container.innerHTML = '<p class="empty-message">No hours logged yet.</p>';
    return;
  }
  
  // You can add more hours loading logic here
}

function updateGlobalStats() {
  console.log('📈 Updating global stats...');
  
  const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
  
  // Update student count
  const studentCountElem = document.getElementById('statStudents');
  if (studentCountElem) studentCountElem.textContent = students.length;
  
  // Calculate total hours
  const totalHours = hours.reduce((sum, hour) => {
    return sum + (parseFloat(hour.hoursWorked) || 0);
  }, 0);
  
  const hoursElem = document.getElementById('statHours');
  if (hoursElem) hoursElem.textContent = totalHours.toFixed(1);
}

// ==================== START APP ====================
// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM fully loaded');
    setTimeout(initApp, 300);
  });
} else {
  console.log('📄 DOM already loaded');
  setTimeout(initApp, 300);
}

console.log('✅ COMPLETE app.js loaded');
