// ==================== GLOBAL VARIABLES ====================
let appInitialized = false;
let redirectInProgress = false;
let currentEditId = null;

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

// ==================== APP UI INITIALIZATION ====================
function initAppUI() {
  console.log('🎨 Initializing app UI...');
  
  try {
    // Set default rate
    initDefaultRate();
    
    // Update user info immediately
    updateProfileInfo();
    
    // Initialize all components
    initTabs();
    initForms();
    initFAB();
    initProfileModal();
    initSyncControls();
    initReportButtons(); // Initialize report buttons
    
    // Load data
    loadInitialData();
    
    console.log('✅ App UI initialized');
    
  } catch (error) {
    console.error('❌ UI init error:', error);
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

// ==================== DEFAULT RATE ====================
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

// ==================== PROFILE INFO FUNCTION ====================
function updateProfileInfo() {
  console.log('🔄 Updating profile info...');
  
  try {
    // Get user email from multiple sources
    let userEmail = 'Not logged in';
    
    // Try localStorage first
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail) {
      userEmail = storedEmail;
    } else {
      // Try parsing worklog_user
      const worklogUser = localStorage.getItem('worklog_user');
      if (worklogUser) {
        try {
          const parsed = JSON.parse(worklogUser);
          if (parsed && parsed.email) {
            userEmail = parsed.email;
          }
        } catch (e) {
          console.log('Could not parse worklog_user');
        }
      }
    }
    
    console.log('User email found:', userEmail);
    
    // Update UI elements
    const profileEmail = document.getElementById('profileUserEmail');
    const userName = document.getElementById('userName');
    
    if (profileEmail) profileEmail.textContent = userEmail;
    
    // Set username (email without domain)
    const displayName = userEmail.split('@')[0] || 'User';
    if (userName) userName.textContent = displayName;
    
    // Update stats
    updateProfileStats();
    
  } catch (error) {
    console.error('Error updating profile:', error);
    
    // Set fallback values
    const profileEmail = document.getElementById('profileUserEmail');
    const userName = document.getElementById('userName');
    
    if (profileEmail) profileEmail.textContent = 'Not logged in';
    if (userName) userName.textContent = 'User';
  }
}

function updateProfileStats() {
  console.log('📊 Updating profile stats...');
  
  try {
    // Get data from localStorage - use correct keys
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
    
    // Also update header stats
    const headerStudents = document.getElementById('statStudents');
    const headerHours = document.getElementById('statHours');
    
    if (headerStudents) headerStudents.textContent = totalStudents;
    if (headerHours) headerHours.textContent = totalHours.toFixed(1);
    
  } catch (error) {
    console.error('Error updating profile stats:', error);
  }
}

// ==================== COMPONENT INITIALIZATION FUNCTIONS ====================

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
    
    // Load data for this tab
    loadTabData(tabName);
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

function loadTabData(tabName) {
  console.log(`📊 Loading data for ${tabName} tab...`);
  
  switch(tabName) {
    case 'students':
      loadStudents();
      break;
    case 'hours':
      loadHours();
      break;
    case 'marks':
      loadMarks();
      break;
    case 'attendance':
      loadAttendance();
      break;
    case 'payments':
      loadPayments();
      break;
    case 'reports':
      loadReports(); // This was missing!
      break;
  }
}

/*function initForms() {
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
  
  // Student form
if (studentForm) {
  studentForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const studentData = {
      name: document.getElementById('studentName').value.trim(),
      studentId: document.getElementById('studentId').value.trim(),
      gender: document.getElementById('studentGender').value,
      email: document.getElementById('studentEmail').value.trim(),
      phone: document.getElementById('studentPhone').value.trim(),
      rate: parseFloat(document.getElementById('studentRate').value) || 0
    };
    
    if (!studentData.name || !studentData.studentId || !studentData.gender) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    
    if (window.formHandler && window.formHandler.saveStudent) {
      const result = window.formHandler.saveStudent(studentData);
      if (result.success) {
        showNotification('Student saved!', 'success');
        studentForm.reset();
        loadStudents();
        updateProfileStats();
      } else {
        showNotification('Error: ' + result.error, 'error');
      }
    }
  });
}
  
  // Hours form
if (hoursForm) {
  hoursForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const hourData = {
      organization: document.getElementById('organization').value.trim(),
      workSubject: document.getElementById('workSubject').value.trim(),
      hoursStudent: document.getElementById('hoursStudent').value,
      workType: document.getElementById('workType').value,
      workDate: document.getElementById('workDate').value,
      hoursWorked: parseFloat(document.getElementById('hoursWorked').value) || 0,
      baseRate: parseFloat(document.getElementById('baseRate').value) || 0,
      hoursNotes: document.getElementById('hoursNotes').value.trim()
    };
    
    if (!hourData.organization || !hourData.workDate || hourData.hoursWorked <= 0) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    
    if (window.formHandler && window.formHandler.saveHours) {
      const result = window.formHandler.saveHours(hourData);
      if (result.success) {
        showNotification('Hours logged!', 'success');
        hoursForm.reset();
        document.getElementById('workDate').value = today;
        loadHours();
        updateProfileStats();
      }
    }
  });
}*/
  
function initFAB() {
  console.log('➕ Initializing FAB...');
  
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');
  
  if (!fab || !fabMenu || !fabOverlay) {
    console.log('FAB elements not found');
    return;
  }
  
  let isFabOpen = false;
  
  // Toggle FAB menu
  fab.addEventListener('click', function(e) {
    e.stopPropagation();
    
    if (isFabOpen) {
      fabMenu.classList.remove('active');
      fabOverlay.classList.remove('active');
      fab.textContent = '+';
      fab.style.transform = 'rotate(0deg)';
    } else {
      fabMenu.classList.add('active');
      fabOverlay.classList.add('active');
      fab.textContent = '×';
      fab.style.transform = 'rotate(45deg)';
    }
    
    isFabOpen = !isFabOpen;
  });
  
  // Close on overlay click
  fabOverlay.addEventListener('click', function() {
    fabMenu.classList.remove('active');
    fabOverlay.classList.remove('active');
    fab.textContent = '+';
    fab.style.transform = 'rotate(0deg)';
    isFabOpen = false;
  });
  
  // Close on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isFabOpen) {
      fabMenu.classList.remove('active');
      fabOverlay.classList.remove('active');
      fab.textContent = '+';
      fab.style.transform = 'rotate(0deg)';
      isFabOpen = false;
    }
  });
  
  // Close when clicking outside
  document.addEventListener('click', function(e) {
    if (isFabOpen && 
        !fab.contains(e.target) && 
        !fabMenu.contains(e.target)) {
      fabMenu.classList.remove('active');
      fabOverlay.classList.remove('active');
      fab.textContent = '+';
      fab.style.transform = 'rotate(0deg)';
      isFabOpen = false;
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
        
        // Close FAB menu
        fabMenu.classList.remove('active');
        fabOverlay.classList.remove('active');
        fab.textContent = '+';
        fab.style.transform = 'rotate(0deg)';
        isFabOpen = false;
        
        // Switch to tab
        if (window.switchTab) {
          window.switchTab(tabName);
        }
      });
    }
  });
  
  // Add Payment button if not exists
  if (!document.getElementById('fabAddPayment')) {
    const fabAddPayment = document.createElement('button');
    fabAddPayment.id = 'fabAddPayment';
    fabAddPayment.className = 'fab-item';
    fabAddPayment.innerHTML = '<span class="icon">💰</span>Record Payment';
    fabAddPayment.addEventListener('click', function() {
      // Close FAB menu
      fabMenu.classList.remove('active');
      fabOverlay.classList.remove('active');
      fab.textContent = '+';
      fab.style.transform = 'rotate(0deg)';
      isFabOpen = false;
      
      // Switch to payments tab
      if (window.switchTab) {
        window.switchTab('payments');
      }
    });
    
    fabMenu.appendChild(fabAddPayment);
  }
}

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

function initSyncControls() {
  console.log('☁️ Initializing sync controls...');
  
  // ==================== SYNC BUTTON ====================
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async function() {
      console.log('Sync button clicked');
      await handleSync();
    });
  }
  
  // ==================== AUTO-SYNC CHECKBOX ====================
  const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
  const autoSyncText = document.getElementById('autoSyncText');
  
  if (autoSyncCheckbox) {
    // Load saved setting
    const autoSyncEnabled = localStorage.getItem('autoSyncEnabled') === 'true';
    autoSyncCheckbox.checked = autoSyncEnabled;
    
    // Update label text
    if (autoSyncText) {
      autoSyncText.textContent = autoSyncEnabled ? 'Auto' : 'Manual';
    }
    
    autoSyncCheckbox.addEventListener('change', function() {
      const isChecked = this.checked;
      console.log('Auto-sync:', isChecked ? 'enabled' : 'disabled');
      
      // Update label text
      if (autoSyncText) {
        autoSyncText.textContent = isChecked ? 'Auto' : 'Manual';
      }
      
      // Save setting
      localStorage.setItem('autoSyncEnabled', isChecked);
      
      // Start/stop auto-sync
      if (isChecked) {
        startAutoSync();
        showNotification('Auto-sync enabled (every 30 seconds)', 'success');
      } else {
        stopAutoSync();
        showNotification('Auto-sync disabled', 'warning');
      }
    });
  }
  
  // ==================== EXPORT CLOUD BUTTON ====================
  const exportCloudBtn = document.getElementById('exportCloudBtn');
  if (exportCloudBtn) {
    exportCloudBtn.addEventListener('click', async function() {
      console.log('Export Cloud button clicked');
      await exportToCloud();
    });
  }
  
  // ==================== IMPORT CLOUD BUTTON ====================
  const importCloudBtn = document.getElementById('importCloudBtn');
  if (importCloudBtn) {
    importCloudBtn.addEventListener('click', async function() {
      console.log('Import Cloud button clicked');
      await importFromCloud();
    });
  }
  
  // ==================== FIX STATS BUTTON ====================
  const syncStatsBtn = document.getElementById('syncStatsBtn');
  if (syncStatsBtn) {
    syncStatsBtn.addEventListener('click', function() {
      console.log('Fix Stats button clicked');
      fixAllStats();
    });
  }
  
  // ==================== EXPORT DATA BUTTON ====================
  const exportDataBtn = document.getElementById('exportDataBtn');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', function() {
      console.log('Export Data button clicked');
      exportAllData();
    });
  }
  
  // ==================== IMPORT DATA BUTTON ====================
  const importDataBtn = document.getElementById('importDataBtn');
  if (importDataBtn) {
    importDataBtn.addEventListener('click', function() {
      console.log('Import Data button clicked');
      // Trigger hidden file input
      const fileInput = document.getElementById('importFileInput');
      if (!fileInput) {
        createFileInput();
      }
      document.getElementById('importFileInput').click();
    });
  }
  
  // ==================== CLEAR ALL BUTTON ====================
  const clearDataBtn = document.getElementById('clearDataBtn');
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', function() {
      console.log('Clear All button clicked');
      clearAllData();
    });
  }
  
  // Create hidden file input for import
  createFileInput();
  
  // Initialize sync indicator
  updateSyncIndicator('Online', 'online');
}

// ==================== SYNC FUNCTIONS ====================

async function handleSync() {
  try {
    console.log('🔄 Starting sync process...');
    updateSyncIndicator('Syncing...', 'syncing');
    showNotification('Syncing data...', 'info');
    
    // Check if online
    if (!navigator.onLine) {
      updateSyncIndicator('Offline', 'offline');
      showNotification('Cannot sync while offline', 'error');
      return { success: false, error: 'Offline' };
    }
    
    // Check Firebase availability FIRST
    const firebaseAvailable = typeof firebase !== 'undefined' && 
                             firebase.auth && 
                             firebase.firestore;
    
    // Check if user is logged into Firebase (do this early)
    let firebaseUser = null;
    if (firebaseAvailable) {
      try {
        firebaseUser = firebase.auth().currentUser;
      } catch (authError) {
        console.log('Firebase auth error:', authError);
      }
    }
    
    // Now check if we have any form of authentication
    const hasLocalAuth = localStorage.getItem('userEmail') || localStorage.getItem('worklog_user');
    const hasFirebaseAuth = firebaseUser !== null;
    
    if (!hasLocalAuth && !hasFirebaseAuth) {
      console.log('⚠️ No authentication found');
      updateSyncIndicator('Login Required', 'error');
      showNotification('Please login to sync data', 'error');
      return { success: false, error: 'Authentication required' };
    }
    
    if (!firebaseAvailable) {
      console.log('⚠️ Firebase not available, doing local sync only');
      updateSyncIndicator('Local Only', 'warning');
      showNotification('Firebase not configured. Local sync only.', 'warning');
      
      // Still update local sync timestamp
      const timestamp = new Date().toISOString();
      localStorage.setItem('lastSync', timestamp);
      
      setTimeout(() => {
        updateSyncIndicator('Local', 'warning');
      }, 2000);
      
      return { success: true, localOnly: true };
    }
    
    // Get all local data
    const allData = {
      students: JSON.parse(localStorage.getItem('worklog_students') || '[]'),
      hours: JSON.parse(localStorage.getItem('worklog_hours') || '[]'),
      marks: JSON.parse(localStorage.getItem('worklog_marks') || '[]'),
      attendance: JSON.parse(localStorage.getItem('worklog_attendance') || '[]'),
      payments: JSON.parse(localStorage.getItem('worklog_payments') || '[]'),
      settings: {
        defaultHourlyRate: localStorage.getItem('defaultHourlyRate') || '25.00',
        autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
        theme: localStorage.getItem('worklog-theme') || 'dark'
      },
      syncDate: new Date().toISOString(),
      appVersion: '1.0.0'
    };
    
    console.log(`📊 Syncing: ${allData.students.length} students, ${allData.hours.length} hours`);
    
    if (firebaseUser) {
      // User is logged into Firebase - do cloud sync
      console.log('☁️ User authenticated, syncing to Firebase...');
      
      try {
        const db = firebase.firestore();
        const userRef = db.collection('users').doc(firebaseUser.uid).collection('data').doc('worklog');
        
        // Save to Firestore
        await userRef.set({
          ...allData,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Firebase sync successful');
        
        // Update local sync timestamp
        const timestamp = new Date().toISOString();
        localStorage.setItem('lastSync', timestamp);
        
        
        // When starting sync:
        updateSyncIndicator('Syncing...', 'syncing');
        
        // When sync succeeds:
        updateSyncIndicator('Cloud Synced', 'success');
       /* updateSyncIndicator('Online', 'online'); */ // or 'Synced' if you prefer
        
        // When offline:
        updateSyncIndicator('Offline', 'offline');
        
        // When error:
        updateSyncIndicator('Error', 'error');
        
        // When local only:
        updateSyncIndicator('Local', 'local');
        showNotification('Data synced to cloud successfully!', 'success');
        
      } catch (firestoreError) {
        console.error('Firestore error:', firestoreError);
        updateSyncIndicator('Cloud Error', 'error');
        showNotification('Cloud sync failed. Using local backup.', 'warning');
        
        // Fallback to local only
        const timestamp = new Date().toISOString();
        localStorage.setItem('lastSync', timestamp);
      }
      
    } else {
      // No Firebase user - local sync only
      console.log('👤 No Firebase user, local sync only');
      
      const timestamp = new Date().toISOString();
      localStorage.setItem('lastSync', timestamp);
      
      updateSyncIndicator('Local Synced', 'warning');
      showNotification('Local sync completed (login for cloud)', 'info');
    }
    
    // Update profile stats
    updateProfileStats();
    updateGlobalStats();
    
    // Reset indicator after delay
    setTimeout(() => {
      if (firebaseUser) {
        updateSyncIndicator('Online', 'online');
      } else {
        updateSyncIndicator('Local', 'warning');
      }
    }, 3000);
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Sync error:', error);
    updateSyncIndicator('Sync Failed', 'error');
    showNotification('Sync failed: ' + error.message, 'error');
    
    setTimeout(() => {
      updateSyncIndicator('Online', 'online');
    }, 3000);
    
    return { success: false, error: error.message };
  }
}



// ==================== CLOUD FUNCTIONS ====================

async function exportToCloud() {
  try {
    showNotification('Exporting to cloud...', 'info');
    
    if (!navigator.onLine) {
      showNotification('Cannot export while offline', 'error');
      return;
    }
    
    if (!firebase.auth().currentUser) {
      showNotification('Please login to export to cloud', 'error');
      return;
    }
    
    // Get all data
    const data = getAllDataForExport();
    
    // Save to Firebase
    if (window.firebaseManager && window.firebaseManager.saveToFirestore) {
      await window.firebaseManager.saveToFirestore('backup', {
        data: data,
        timestamp: new Date().toISOString(),
        type: 'full_export'
      });
      
      showNotification('Data exported to cloud successfully!', 'success');
    } else {
      showNotification('Cloud export not available', 'warning');
    }
    
  } catch (error) {
    console.error('Cloud export error:', error);
    showNotification('Export failed: ' + error.message, 'error');
  }
}

async function importFromCloud() {
  try {
    if (!confirm('Import data from cloud? This will replace your local data.')) {
      return;
    }
    
    showNotification('Importing from cloud...', 'info');
    
    if (!navigator.onLine) {
      showNotification('Cannot import while offline', 'error');
      return;
    }
    
    if (!firebase.auth().currentUser) {
      showNotification('Please login to import from cloud', 'error');
      return;
    }
    
    // Load from Firebase
    if (window.firebaseManager && window.firebaseManager.loadFromFirestore) {
      const result = await window.firebaseManager.loadFromFirestore('backup');
      
      if (result.success && result.data.length > 0) {
        // Get latest backup
        const latestBackup = result.data.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        )[0];
        
        if (latestBackup && latestBackup.data) {
          importAllData(latestBackup.data);
          showNotification('Data imported from cloud successfully!', 'success');
          location.reload(); // Reload to show new data
        } else {
          showNotification('No backup found in cloud', 'warning');
        }
      } else {
        showNotification('No data found in cloud', 'warning');
      }
    } else {
      showNotification('Cloud import not available', 'warning');
    }
    
  } catch (error) {
    console.error('Cloud import error:', error);
    showNotification('Import failed: ' + error.message, 'error');
  }
}

// ==================== DATA EXPORT/IMPORT FUNCTIONS ====================

function exportAllData() {
  try {
    const data = getAllDataForExport();
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Data exported to file successfully!', 'success');
    
  } catch (error) {
    console.error('Export error:', error);
    showNotification('Export failed: ' + error.message, 'error');
  }
}

function getAllDataForExport() {
  return {
    students: JSON.parse(localStorage.getItem('worklog_students') || '[]'),
    hours: JSON.parse(localStorage.getItem('worklog_hours') || '[]'),
    marks: JSON.parse(localStorage.getItem('worklog_marks') || '[]'),
    attendance: JSON.parse(localStorage.getItem('worklog_attendance') || '[]'),
    payments: JSON.parse(localStorage.getItem('worklog_payments') || '[]'),
    settings: {
      defaultHourlyRate: localStorage.getItem('defaultHourlyRate') || '25.00',
      autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
      theme: localStorage.getItem('worklog-theme') || 'dark'
    },
    exportDate: new Date().toISOString(),
    appVersion: '1.0.0'
  };
}

function importAllData(data) {
  try {
    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }
    
    // Import data
    if (data.students) localStorage.setItem('worklog_students', JSON.stringify(data.students));
    if (data.hours) localStorage.setItem('worklog_hours', JSON.stringify(data.hours));
    if (data.marks) localStorage.setItem('worklog_marks', JSON.stringify(data.marks));
    if (data.attendance) localStorage.setItem('worklog_attendance', JSON.stringify(data.attendance));
    if (data.payments) localStorage.setItem('worklog_payments', JSON.stringify(data.payments));
    
    // Import settings
    if (data.settings) {
      if (data.settings.defaultHourlyRate) {
        localStorage.setItem('defaultHourlyRate', data.settings.defaultHourlyRate);
      }
      if (data.settings.autoSyncEnabled !== undefined) {
        localStorage.setItem('autoSyncEnabled', data.settings.autoSyncEnabled);
      }
      if (data.settings.theme) {
        localStorage.setItem('worklog-theme', data.settings.theme);
      }
    }
    
    showNotification('Data imported successfully!', 'success');
    
  } catch (error) {
    console.error('Import error:', error);
    showNotification('Import failed: ' + error.message, 'error');
  }
}

function createFileInput() {
  // Create hidden file input for import
  let fileInput = document.getElementById('importFileInput');
  
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.id = 'importFileInput';
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          if (confirm('Import data from file? This will replace your current data.')) {
            importAllData(data);
            setTimeout(() => location.reload(), 1000); // Reload to show new data
          }
        } catch (error) {
          showNotification('Invalid file format', 'error');
        }
      };
      reader.readAsText(file);
      
      // Reset file input
      event.target.value = '';
    });
    
    document.body.appendChild(fileInput);
  }
}

// ==================== FIX STATS FUNCTION ====================

function fixAllStats() {
  try {
    showNotification('Fixing statistics...', 'info');
    
    // Get all data
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
    const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    
    // Fix 1: Ensure all hours have proper calculations
    let hoursFixed = 0;
    const fixedHours = hours.map(hour => {
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const baseRate = parseFloat(hour.baseRate) || 0;
      const total = hoursWorked * baseRate;
      
      if (hour.total !== total) {
        hoursFixed++;
        return { ...hour, total: total };
      }
      return hour;
    });
    
    if (hoursFixed > 0) {
      localStorage.setItem('worklog_hours', JSON.stringify(fixedHours));
    }
    
    // Fix 2: Ensure all marks have percentage and grade
    let marksFixed = 0;
    const fixedMarks = marks.map(mark => {
      const score = parseFloat(mark.marksScore) || 0;
      const max = parseFloat(mark.marksMax) || 1;
      const percentage = max > 0 ? ((score / max) * 100).toFixed(1) : '0.0';
      
      let grade = 'F';
      const percNum = parseFloat(percentage);
      if (percNum >= 90) grade = 'A';
      else if (percNum >= 80) grade = 'B';
      else if (percNum >= 70) grade = 'C';
      else if (percNum >= 60) grade = 'D';
      
      if (mark.percentage !== percentage || mark.grade !== grade) {
        marksFixed++;
        return { ...mark, percentage, grade };
      }
      return mark;
    });
    
    if (marksFixed > 0) {
      localStorage.setItem('worklog_marks', JSON.stringify(fixedMarks));
    }
    
    // Fix 3: Recalculate student balances
    let balancesFixed = 0;
    
    showNotification(
      `Fixed: ${hoursFixed} hours, ${marksFixed} marks, ${balancesFixed} balances`,
      'success'
    );
    
    // Reload all data
    loadInitialData();
    updateGlobalStats();
    updateProfileStats();
    
  } catch (error) {
    console.error('Fix stats error:', error);
    showNotification('Failed to fix statistics', 'error');
  }
}

// ==================== CLEAR DATA FUNCTION ====================

function clearAllData() {
  if (!confirm('⚠️ WARNING: This will delete ALL your data!\n\nThis includes:\n• All students\n• All hours worked\n• All marks\n• All attendance\n• All payments\n\nThis action cannot be undone!\n\nAre you absolutely sure?')) {
    return;
  }
  
  if (!confirm('LAST CHANCE: This will delete EVERYTHING!\nType "DELETE" to confirm.')) {
    return;
  }
  
  const userInput = prompt('Type DELETE to confirm permanent deletion:');
  if (userInput !== 'DELETE') {
    showNotification('Deletion cancelled', 'warning');
    return;
  }
  
  try {
    // Clear all data
    localStorage.removeItem('worklog_students');
    localStorage.removeItem('worklog_hours');
    localStorage.removeItem('worklog_marks');
    localStorage.removeItem('worklog_attendance');
    localStorage.removeItem('worklog_payments');
    
    // Keep settings
    const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
    const theme = localStorage.getItem('worklog-theme') || 'dark';
    const autoSync = localStorage.getItem('autoSyncEnabled');
    
    // Clear everything except auth
    localStorage.clear();
    
    // Restore settings
    localStorage.setItem('defaultHourlyRate', defaultRate);
    localStorage.setItem('worklog-theme', theme);
    if (autoSync) localStorage.setItem('autoSyncEnabled', autoSync);
    
    showNotification('All data has been cleared!', 'success');
    
    // Reload page
    setTimeout(() => location.reload(), 1500);
    
  } catch (error) {
    console.error('Clear data error:', error);
    showNotification('Failed to clear data', 'error');
  }
}

// ==================== AUTO-SYNC FUNCTIONS ====================

let autoSyncInterval = null;

function startAutoSync() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  
  autoSyncInterval = setInterval(async () => {
    if (navigator.onLine && firebase.auth().currentUser) {
      console.log('🔄 Auto-sync running...');
      await handleSync();
    }
  }, 30000); // 30 seconds
  
  console.log('✅ Auto-sync started');
}

function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
    console.log('⏹️ Auto-sync stopped');
  }
}

// ==================== HELPER FUNCTIONS ====================

function updateSyncIndicator(text, status) {
  const syncIndicator = document.getElementById('syncIndicator');
  if (!syncIndicator) {
    console.log('❌ Sync indicator not found');
    return;
  }
  
  console.log(`🔄 Updating sync indicator: ${text} (${status})`);
  
  // Clear all classes
  syncIndicator.className = '';
  
  // Set the text inside the pill
  syncIndicator.textContent = text;
  
  // Add the status class for color
  syncIndicator.classList.add(status);
  
  // Handle animation - DON'T set style.animation directly!
  // Let CSS handle it through the class
  if (status === 'syncing') {
    // Force CSS re-evaluation by toggling the class
    syncIndicator.classList.remove('syncing');
    void syncIndicator.offsetWidth; // Trigger reflow
    syncIndicator.classList.add('syncing');
  }
  
  console.log('Sync indicator updated. Classes:', syncIndicator.className);
  console.log('Computed animation:', window.getComputedStyle(syncIndicator).animation);
}

function showNotification(message, type = 'info') {
  console.log(`🔔 ${type.toUpperCase()}: ${message}`);
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <span class="notification-icon">${getNotificationIcon(type)}</span>
    <span class="notification-text">${message}</span>
    <button class="notification-close">&times;</button>
  `;
  
  // Add styles
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${getNotificationColor(type)};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideIn 0.3s ease;
    max-width: 350px;
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
  
  // Close button
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  });
}

function getNotificationIcon(type) {
  switch(type) {
    case 'success': return '✅';
    case 'error': return '❌';
    case 'warning': return '⚠️';
    default: return 'ℹ️';
  }
}

function getNotificationColor(type) {
  switch(type) {
    case 'success': return '#4CAF50';
    case 'error': return '#f44336';
    case 'warning': return '#FF9800';
    default: return '#2196F3';
  }
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .notification-close {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    margin-left: 10px;
  }
`;
document.head.appendChild(style);

// ==================== REPORT FUNCTIONS ====================
function initReportButtons() {
  console.log('📊 Initializing report buttons...');
  
  // Weekly report
  const weeklyReportBtn = document.getElementById('weeklyReportBtn');
  if (weeklyReportBtn) {
    weeklyReportBtn.addEventListener('click', function() {
      generateWeeklyReport();
    });
  }
  
  // Bi-weekly report
  const biWeeklyReportBtn = document.getElementById('biWeeklyReportBtn');
  if (biWeeklyReportBtn) {
    biWeeklyReportBtn.addEventListener('click', function() {
      generateBiWeeklyReport();
    });
  }
  
  // Monthly report
  const monthlyReportBtn = document.getElementById('monthlyReportBtn');
  if (monthlyReportBtn) {
    monthlyReportBtn.addEventListener('click', function() {
      generateMonthlyReport();
    });
  }
  
  // Subject report
  const subjectReportBtn = document.getElementById('subjectReportBtn');
  if (subjectReportBtn) {
    subjectReportBtn.addEventListener('click', function() {
      generateSubjectReport();
    });
  }
  
  // PDF report
  const pdfReportBtn = document.getElementById('pdfReportBtn');
  if (pdfReportBtn) {
    pdfReportBtn.addEventListener('click', function() {
      generatePDFReport();
    });
  }
  
  // Email report
  const emailReportBtn = document.getElementById('emailReportBtn');
  if (emailReportBtn) {
    emailReportBtn.addEventListener('click', function() {
      generateEmailReport();
    });
  }
}

function loadReports() {
  console.log('📈 Loading reports...');
  
  // Update report statistics
  updateReportStats();
  
  // Generate weekly breakdown
  generateWeeklyBreakdown();
  
  // Generate subject breakdown
  generateSubjectBreakdown();
}

function updateReportStats() {
  console.log('📊 Updating report statistics...');
  
  try {
    // Get all data
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    
    // Calculate totals
    const totalStudents = students.length;
    
    const totalHours = hours.reduce((sum, hour) => {
      return sum + (parseFloat(hour.hoursWorked) || 0);
    }, 0);
    
    const totalEarnings = hours.reduce((sum, hour) => {
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const rate = parseFloat(hour.baseRate) || 0;
      return sum + (hoursWorked * rate);
    }, 0);
    
    // Calculate average mark
    let avgMark = 0;
    if (marks.length > 0) {
      const totalPercentage = marks.reduce((sum, mark) => {
        return sum + (parseFloat(mark.percentage) || 0);
      }, 0);
      avgMark = totalPercentage / marks.length;
    }
    
    // Calculate total payments
    const totalPayments = payments.reduce((sum, payment) => {
      return sum + (parseFloat(payment.paymentAmount) || 0);
    }, 0);
    
    // Calculate outstanding balance
    const outstandingBalance = totalEarnings - totalPayments;
    
    // Update UI
    const updateElement = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    
    updateElement('totalStudentsReport', totalStudents);
    updateElement('totalHoursReport', totalHours.toFixed(1));
    updateElement('totalEarningsReport', `$${totalEarnings.toFixed(2)}`);
    updateElement('avgMarkReport', `${avgMark.toFixed(1)}%`);
    updateElement('totalPaymentsReport', `$${totalPayments.toFixed(2)}`);
    updateElement('outstandingBalance', `$${outstandingBalance.toFixed(2)}`);
    
  } catch (error) {
    console.error('Error updating report stats:', error);
  }
}

function generateWeeklyBreakdown() {
  console.log('📅 Generating weekly breakdown...');
  
  try {
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    const weeklyBody = document.getElementById('weeklyBody');
    
    if (!weeklyBody) return;
    
    if (hours.length === 0) {
      weeklyBody.innerHTML = '<tr><td colspan="5" class="empty-message">No data available</td></tr>';
      return;
    }
    
    // Group by week
    const weeks = {};
    hours.forEach(hour => {
      const date = new Date(hour.workDate);
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          period: formatDate(weekStart) + ' - ' + formatDate(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)),
          hours: 0,
          earnings: 0,
          subjects: new Set(),
          net: 0
        };
      }
      
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const rate = parseFloat(hour.baseRate) || 0;
      const earnings = hoursWorked * rate;
      
      weeks[weekKey].hours += hoursWorked;
      weeks[weekKey].earnings += earnings;
      weeks[weekKey].net += earnings * 0.8; // 80% net
      
      if (hour.workSubject) {
        weeks[weekKey].subjects.add(hour.workSubject);
      }
    });
    
    // Convert to array and sort by date
    const weekArray = Object.values(weeks).sort((a, b) => {
      return new Date(b.period.split(' - ')[0]) - new Date(a.period.split(' - ')[0]);
    });
    
    // Update table
    weeklyBody.innerHTML = weekArray.map(week => `
      <tr>
        <td>${week.period}</td>
        <td>${week.hours.toFixed(1)}h</td>
        <td>$${week.earnings.toFixed(2)}</td>
        <td>${Array.from(week.subjects).slice(0, 3).join(', ')}${week.subjects.size > 3 ? '...' : ''}</td>
        <td>$${week.net.toFixed(2)}</td>
      </tr>
    `).join('');
    
  } catch (error) {
    console.error('Error generating weekly breakdown:', error);
  }
}

function generateSubjectBreakdown() {
  console.log('📚 Generating subject breakdown...');
  
  try {
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    const subjectBody = document.getElementById('subjectBody');
    
    if (!subjectBody) return;
    
    if (hours.length === 0 && marks.length === 0) {
      subjectBody.innerHTML = '<tr><td colspan="5" class="empty-message">No data available</td></tr>';
      return;
    }
    
    // Group by subject
    const subjects = {};
    
    // Process hours
    hours.forEach(hour => {
      const subject = hour.workSubject || 'Uncategorized';
      if (!subjects[subject]) {
        subjects[subject] = {
          hours: 0,
          earnings: 0,
          sessions: 0,
          marks: []
        };
      }
      
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const rate = parseFloat(hour.baseRate) || 0;
      
      subjects[subject].hours += hoursWorked;
      subjects[subject].earnings += hoursWorked * rate;
      subjects[subject].sessions += 1;
    });
    
    // Process marks
    marks.forEach(mark => {
      const subject = mark.marksSubject || 'Uncategorized';
      if (!subjects[subject]) {
        subjects[subject] = {
          hours: 0,
          earnings: 0,
          sessions: 0,
          marks: []
        };
      }
      
      subjects[subject].marks.push(parseFloat(mark.percentage) || 0);
    });
    
    // Calculate averages and convert to array
    const subjectArray = Object.entries(subjects).map(([subject, data]) => {
      const avgMark = data.marks.length > 0 
        ? (data.marks.reduce((a, b) => a + b, 0) / data.marks.length).toFixed(1)
        : 'N/A';
      
      return {
        subject,
        avgMark,
        hours: data.hours.toFixed(1),
        earnings: data.earnings.toFixed(2),
        sessions: data.sessions
      };
    }).sort((a, b) => b.earnings - a.earnings);
    
    // Update table
    subjectBody.innerHTML = subjectArray.map(item => `
      <tr>
        <td>${item.subject}</td>
        <td>${item.avgMark}${item.avgMark !== 'N/A' ? '%' : ''}</td>
        <td>${item.hours}h</td>
        <td>$${item.earnings}</td>
        <td>${item.sessions}</td>
      </tr>
    `).join('');
    
  } catch (error) {
    console.error('Error generating subject breakdown:', error);
  }
}

function getWeekStart(date) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(date.setDate(diff));
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Placeholder report functions
function generateWeeklyReport() {
  console.log('📅 Generating weekly report...');
  alert('Weekly report would be generated here');
}

function generateBiWeeklyReport() {
  console.log('📅 Generating bi-weekly report...');
  alert('Bi-weekly report would be generated here');
}

function generateMonthlyReport() {
  console.log('📅 Generating monthly report...');
  alert('Monthly report would be generated here');
}

function generateSubjectReport() {
  console.log('📚 Generating subject report...');
  alert('Subject report would be generated here');
}

function generatePDFReport() {
  console.log('📄 Generating PDF report...');
  alert('PDF report would be generated here');
}

function generateEmailReport() {
  console.log('📧 Generating email report...');
  alert('Email report would be generated here');
}

// ==================== DATA LOADING FUNCTIONS ====================
function loadInitialData() {
  console.log('📊 Loading initial data...');
  
  // Initialize form handler if available
  if (window.formHandler && window.formHandler.initializeStorage) {
    window.formHandler.initializeStorage();
  }
  
  // Load and display data
  loadStudents();
  loadHours();
  loadMarks();
  loadAttendance();
  loadPayments();
  
  // Populate student dropdowns
  populateStudentDropdowns();
  
  // Update stats
  updateGlobalStats();
  updateProfileStats();
  
  // Update reports if on reports tab
  if (document.getElementById('reports').classList.contains('active')) {
    loadReports();
  }
}
  
// ==================== COMPLETE DATA DISPLAY FUNCTIONS ====================

function loadStudents() {
  console.log('👥 Loading students...');
  
  const container = document.getElementById('studentsContainer');
  if (!container) return;
  
  // Get students
  let students = [];
  if (window.formHandler && window.formHandler.getStudents) {
    students = window.formHandler.getStudents();
    console.log('Students from formHandler:', students.length, students);
  } else {
    students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    console.log('Students from localStorage:', students.length, students);
  }
  
  // Update count
  const countElem = document.getElementById('studentCount');
  if (countElem) countElem.textContent = students.length;
  
  if (students.length === 0) {
    container.innerHTML = '<p class="empty-message">No students registered yet.</p>';
    return;
  }
  
  // Display students
  container.innerHTML = students.map(student => `
    <div class="student-card" data-id="${student.id}">
      <div class="student-card-header">
        <strong>${student.name}</strong>
        <span class="student-id">${student.studentId}</span>
        <div class="student-actions">
          <button class="btn-icon edit-student" title="Edit">✏️</button>
          <button class="btn-icon delete-student" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="student-details">
        <div class="student-rate">$${student.rate || '0.00'}/session</div>
        <div>${student.gender} • ${student.email || 'No email'}</div>
        <div>${student.phone || 'No phone'}</div>
        <div class="student-meta">
          Added: ${new Date(student.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  `).join('');
  
  // Add event listeners for edit/delete
  container.querySelectorAll('.edit-student').forEach(btn => {
    btn.addEventListener('click', function() {
      const studentCard = this.closest('.student-card');
      const studentId = studentCard.getAttribute('data-id');
      editStudent(studentId);
    });
  });
  
  container.querySelectorAll('.delete-student').forEach(btn => {
    btn.addEventListener('click', function() {
      const studentCard = this.closest('.student-card');
      const studentId = studentCard.getAttribute('data-id');
      deleteStudent(studentId);
    });
  });
}

function loadHours() {
  console.log('⏱️ Loading hours...');
  
  const container = document.getElementById('hoursContainer');
  if (!container) return;
  
  // Get hours
  let hours = [];
  if (window.formHandler && window.formHandler.getHours) {
    hours = window.formHandler.getHours();
  } else {
    hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
  }
  
  if (hours.length === 0) {
    container.innerHTML = '<p class="empty-message">No hours logged yet.</p>';
    return;
  }
  
  // Display hours (show last 10)
  const recentHours = hours.slice(0, 10);
  container.innerHTML = recentHours.map(hour => `
    <div class="hours-entry" data-id="${hour.id}">
      <div class="hours-header">
        <div>
          <strong>${hour.organization}</strong>
          <span class="hours-type">${hour.workType || 'Hourly'}</span>
        </div>
        <div class="hours-total">$${hour.total?.toFixed(2) || '0.00'}</div>
      </div>
      <div class="hours-details">
        <span>📅 ${new Date(hour.workDate).toLocaleDateString()}</span>
        <span>⏱️ ${hour.hoursWorked} hours</span>
        <span>💰 $${hour.baseRate}/hr</span>
        ${hour.workSubject ? `<span>📚 ${hour.workSubject}</span>` : ''}
      </div>
      ${hour.hoursNotes ? `<div class="muted">Notes: ${hour.hoursNotes}</div>` : ''}
    </div>
  `).join('');
}

function loadMarks() {
  console.log('📝 Loading marks...');
  
  const container = document.getElementById('marksContainer');
  if (!container) return;
  
  // Get marks
  let marks = [];
  if (window.formHandler && window.formHandler.getMarks) {
    marks = window.formHandler.getMarks();
  } else {
    marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
  }
  
  // Update count
  const countElem = document.getElementById('marksCount');
  if (countElem) countElem.textContent = marks.length;
  
  if (marks.length === 0) {
    container.innerHTML = '<p class="empty-message">No marks recorded yet.</p>';
    return;
  }
  
  // Display marks (show last 10)
  const recentMarks = marks.slice(0, 10);
  container.innerHTML = recentMarks.map(mark => `
    <div class="mark-entry" data-id="${mark.id}">
      <div class="mark-header">
        <div>
          <strong>${mark.marksSubject || 'Subject'}</strong>
          <span>${mark.marksTopic || 'Topic'}</span>
        </div>
        <div class="hours-total">
          ${mark.percentage || '0.0'}% (${mark.grade || 'F'})
        </div>
      </div>
      <div class="hours-details">
        <span>📅 ${new Date(mark.marksDate).toLocaleDateString()}</span>
        <span>📊 ${mark.marksScore || 0}/${mark.marksMax || 100}</span>
        <span>👤 Student ID: ${mark.marksStudent || 'N/A'}</span>
      </div>
      ${mark.marksNotes ? `<div class="muted">Notes: ${mark.marksNotes}</div>` : ''}
    </div>
  `).join('');
}

function loadAttendance() {
  console.log('✅ Loading attendance...');
  
  const container = document.getElementById('attendanceContainer');
  if (!container) return;
  
  // Get attendance
  let attendance = [];
  if (window.formHandler && window.formHandler.getAttendance) {
    attendance = window.formHandler.getAttendance();
  } else {
    attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
  }
  
  // Update count
  const countElem = document.getElementById('attendanceCount');
  if (countElem) countElem.textContent = attendance.length;
  
  // Update last session date
  const lastSessionElem = document.getElementById('lastSessionDate');
  if (lastSessionElem && attendance.length > 0) {
    const latest = attendance[0]; // Already sorted by date
    lastSessionElem.textContent = new Date(latest.attendanceDate).toLocaleDateString();
  } else if (lastSessionElem) {
    lastSessionElem.textContent = 'Never';
  }
  
  if (attendance.length === 0) {
    container.innerHTML = '<p class="empty-message">No attendance records yet.</p>';
    return;
  }
  
  // Display attendance (show last 5)
  const recentAttendance = attendance.slice(0, 5);
  container.innerHTML = recentAttendance.map(record => `
    <div class="attendance-entry" data-id="${record.id}">
      <div class="attendance-header">
        <div>
          <strong>${record.attendanceSubject || 'Subject'}</strong>
          <div>${record.attendanceTopic || 'General Session'}</div>
        </div>
        <div>📅 ${new Date(record.attendanceDate).toLocaleDateString()}</div>
      </div>
      <div class="hours-details">
        <span>👥 ${record.presentStudents?.length || 0} students present</span>
        ${record.attendanceNotes ? `<div class="muted">Notes: ${record.attendanceNotes}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function loadPayments() {
  console.log('💰 Loading payments...');
  
  const container = document.getElementById('paymentActivityLog');
  const balancesContainer = document.getElementById('studentBalancesContainer');
  
  // Get payments
  let payments = [];
  if (window.formHandler && window.formHandler.getPayments) {
    payments = window.formHandler.getPayments();
  } else {
    payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
  }
  
  // Get students for balances
  let students = [];
  if (window.formHandler && window.formHandler.getStudents) {
    students = window.formHandler.getStudents();
  } else {
    students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  }
  
  // Get hours for balance calculation
  let hours = [];
  if (window.formHandler && window.formHandler.getHours) {
    hours = window.formHandler.getHours();
  } else {
    hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
  }
  
  // Update total students count
  const totalStudentsElem = document.getElementById('totalStudentsCount');
  if (totalStudentsElem) totalStudentsElem.textContent = students.length;
  
  // Calculate total owed and monthly payments
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  let totalOwed = 0;
  let monthlyPayments = 0;
  
  // Calculate student balances
  const studentBalances = students.map(student => {
    // Get hours for this student
    const studentHours = hours.filter(h => h.hoursStudent === student.id);
    const studentPayments = payments.filter(p => p.paymentStudent === student.id);
    
    // Calculate total earnings from hours
    const hoursEarnings = studentHours.reduce((sum, hour) => {
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const rate = parseFloat(hour.baseRate) || parseFloat(student.rate) || 0;
      return sum + (hoursWorked * rate);
    }, 0);
    
    // Calculate total payments
    const totalPayments = studentPayments.reduce((sum, payment) => {
      const amount = parseFloat(payment.paymentAmount) || 0;
      
      // Check if payment is from this month
      const paymentDate = new Date(payment.paymentDate);
      if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
        monthlyPayments += amount;
      }
      
      return sum + amount;
    }, 0);
    
    const balance = hoursEarnings - totalPayments;
    if (balance > 0) totalOwed += balance;
    
    return {
      id: student.id,
      name: student.name,
      owed: balance,
      hoursEarnings: hoursEarnings,
      payments: totalPayments
    };
  });
  
  // Update UI elements
  const totalOwedElem = document.getElementById('totalOwed');
  const monthlyPaymentsElem = document.getElementById('monthlyPayments');
  
  if (totalOwedElem) totalOwedElem.textContent = `$${totalOwed.toFixed(2)}`;
  if (monthlyPaymentsElem) monthlyPaymentsElem.textContent = `$${monthlyPayments.toFixed(2)}`;
  
  // Display student balances
  if (balancesContainer) {
    if (students.length === 0) {
      balancesContainer.innerHTML = '<p class="empty-message">No student data yet.</p>';
    } else {
      balancesContainer.innerHTML = studentBalances.map(balance => `
        <div class="payment-item">
          <div class="payment-header">
            <strong>${balance.name}</strong>
            <span class="payment-amount ${balance.owed > 0 ? 'warning' : 'success'}">
              ${balance.owed > 0 ? `Owes: $${balance.owed.toFixed(2)}` : 'Paid up'}
            </span>
          </div>
          <div class="payment-meta">
            <span>Earned: $${balance.hoursEarnings.toFixed(2)}</span>
            <span>Paid: $${balance.payments.toFixed(2)}</span>
          </div>
        </div>
      `).join('');
    }
  }
  
  // Display payment activity
  if (container) {
    if (payments.length === 0) {
      container.innerHTML = '<p class="empty-message">No recent payment activity.</p>';
      return;
    }
    
    // Display recent payments (last 10)
    const recentPayments = payments.slice(0, 10);
    container.innerHTML = recentPayments.map(payment => `
      <div class="payment-item" data-id="${payment.id}">
        <div class="payment-header">
          <div>
            <strong>Payment Received</strong>
            <div>Student ID: ${payment.paymentStudent || 'N/A'}</div>
          </div>
          <div class="payment-amount success">$${parseFloat(payment.paymentAmount || 0).toFixed(2)}</div>
        </div>
        <div class="payment-meta">
          <span>📅 ${new Date(payment.paymentDate).toLocaleDateString()}</span>
          <span>💳 ${payment.paymentMethod || 'Cash'}</span>
        </div>
        ${payment.paymentNotes ? `<div class="payment-notes">${payment.paymentNotes}</div>` : ''}
      </div>
    `).join('');
  }
}

// ==================== HELPER FUNCTIONS ====================

function editStudent(studentId) {
  console.log('✏️ Editing student:', studentId);
  
  // Get student data
  let students = [];
  if (window.formHandler && window.formHandler.getStudents) {
    students = window.formHandler.getStudents();
  } else {
    students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  }
  
  const student = students.find(s => s.id === studentId);
  if (!student) {
    showNotification('Student not found', 'error');
    return;
  }
  
  // Fill form with student data
  document.getElementById('studentName').value = student.name || '';
  document.getElementById('studentId').value = student.studentId || '';
  document.getElementById('studentGender').value = student.gender || '';
  document.getElementById('studentEmail').value = student.email || '';
  document.getElementById('studentPhone').value = student.phone || '';
  document.getElementById('studentRate').value = student.rate || '';
  
  // Set edit mode
  currentEditId = studentId;
  document.getElementById('studentCancelBtn').style.display = 'inline-block';
  document.getElementById('studentSubmitBtn').textContent = '💾 Update Student';
  
  // Scroll to form
  document.getElementById('studentName').focus();
  showNotification('Editing student: ' + student.name, 'info');
}

function deleteStudent(studentId) {
  if (!confirm('Are you sure you want to delete this student?')) {
    return;
  }
  
  try {
    if (window.formHandler && window.formHandler.deleteStudent) {
      const result = window.formHandler.deleteStudent(studentId);
      if (result.success) {
        showNotification('Student deleted', 'success');
        loadStudents();
        updateProfileStats();
        updateGlobalStats();
      } else {
        showNotification('Error: ' + result.error, 'error');
      }
    } else {
      // Fallback to direct localStorage
      const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
      const filtered = students.filter(student => student.id !== studentId);
      localStorage.setItem('worklog_students', JSON.stringify(filtered));
      showNotification('Student deleted', 'success');
      loadStudents();
      updateProfileStats();
      updateGlobalStats();
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    showNotification('Error deleting student', 'error');
  }
}

// ==================== UPDATE GLOBAL STATS ====================

function updateGlobalStats() {
  console.log('📈 Updating global stats...');
  
  // Get statistics
  let stats = { students: 0, totalHours: 0, totalEarnings: 0 };
  
  if (window.formHandler && window.formHandler.getStatistics) {
    stats = window.formHandler.getStatistics();
    console.log('Stats from formHandler:', stats);
  } else {
    // Fallback calculation
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    
    stats.students = students.length;
    stats.totalHours = hours.reduce((sum, hour) => sum + (parseFloat(hour.hoursWorked) || 0), 0);
    stats.totalEarnings = hours.reduce((sum, hour) => {
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const rate = parseFloat(hour.baseRate) || 0;
      return sum + (hoursWorked * rate);
    }, 0);
  }
  
  // FIX: Ensure totalHours is a number
  const totalHours = parseFloat(stats.totalHours) || 0;
  const totalEarnings = parseFloat(stats.totalEarnings) || 0;
  
  console.log('Processed stats:', { totalHours, totalEarnings, students: stats.students });
  
  // Update UI elements
  const studentCountElem = document.getElementById('statStudents');
  const hoursElem = document.getElementById('statHours');
  const avgRateElem = document.getElementById('averageRate');
  
  if (studentCountElem) studentCountElem.textContent = stats.students || 0;
  if (hoursElem) hoursElem.textContent = totalHours.toFixed(1);
  
  // Calculate average rate
  if (avgRateElem) {
    let students = [];
    if (window.formHandler && window.formHandler.getStudents) {
      students = window.formHandler.getStudents();
    } else {
      students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    }
    
    if (students.length > 0) {
      const totalRate = students.reduce((sum, student) => sum + (parseFloat(student.rate) || 0), 0);
      const avgRate = totalRate / students.length;
      avgRateElem.textContent = avgRate.toFixed(2);
    } else {
      avgRateElem.textContent = '0.00';
    }
  }
}

  function populateStudentDropdowns() {
  console.log('👥 Populating student dropdowns...');
  
  // Get students
  let students = [];
  if (window.formHandler && window.formHandler.getStudents) {
    students = window.formHandler.getStudents();
  } else {
    students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  }
  
  // Update all student dropdowns
  const dropdownIds = [
    'hoursStudent',
    'marksStudent', 
    'paymentStudent',
    'attendanceStudents'
  ];
  
  dropdownIds.forEach(dropdownId => {
    const element = document.getElementById(dropdownId);
    if (!element) return;
    
    if (dropdownId === 'attendanceStudents') {
      // This is a container for checkboxes, not a select
      if (students.length === 0) {
        element.innerHTML = '<p class="empty-message">No students registered. Add students first.</p>';
      } else {
        element.innerHTML = students.map(student => `
          <div class="attendance-student-item">
            <input type="checkbox" id="student_${student.id}" value="${student.id}">
            <label for="student_${student.id}">${student.name} (${student.studentId})</label>
          </div>
        `).join('');
      }
    } else {
      // Regular select dropdown
      element.innerHTML = '<option value="">Select Student</option>' + 
        students.map(student => `
          <option value="${student.id}">${student.name} (${student.studentId})</option>
        `).join('');
    }
  });
  
  console.log(`✅ Populated ${students.length} students in dropdowns`);
}

// Call this function when data changes
function refreshStudentDropdowns() {
  populateStudentDropdowns();
}
  
// ==================== FORM HANDLERS =========================
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
  
  // ========== SUBMISSION HANDLERS START HERE ==========
  
  // Initialize student form
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
  studentForm.addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('Student form submitted');
    
    // Collect form data
    const studentData = {
      id: currentEditId || 'student_' + Date.now(),
      name: document.getElementById('studentName').value.trim(),
      studentId: document.getElementById('studentId').value.trim(),
      gender: document.getElementById('studentGender').value,
      email: document.getElementById('studentEmail').value.trim(),
      phone: document.getElementById('studentPhone').value.trim(),
      rate: parseFloat(document.getElementById('studentRate').value) || 25.00
    };
    
    // Validate
    if (!studentData.name || !studentData.studentId || !studentData.gender) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    
    // Save using formHandler
    if (window.formHandler && window.formHandler.saveStudent) {
      const result = window.formHandler.saveStudent(studentData);
      if (result.success) {
        showNotification('Student saved!', 'success');
        studentForm.reset();
        currentEditId = null;
        document.getElementById('studentCancelBtn').style.display = 'none';
        document.getElementById('studentSubmitBtn').textContent = '➕ Add Student';
        
        // Refresh data
        loadStudents();
        populateStudentDropdowns();
        updateProfileStats();
        updateGlobalStats();
      } else {
        showNotification('Error: ' + result.error, 'error');
      }
    }
  });
}
  
  // Initialize hours form
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
  hoursForm.addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('Hours form submitted');
    
    // Collect form data
    const hourData = {
      organization: document.getElementById('organization').value.trim(),
      workSubject: document.getElementById('workSubject').value.trim(),
      hoursStudent: document.getElementById('hoursStudent').value,
      workType: document.getElementById('workType').value,
      workDate: document.getElementById('workDate').value,
      hoursWorked: parseFloat(document.getElementById('hoursWorked').value) || 0,
      baseRate: parseFloat(document.getElementById('baseRate').value) || 0,
      hoursNotes: document.getElementById('hoursNotes').value.trim()
    };
    
    // Validate
    if (!hourData.organization || !hourData.workDate || hourData.hoursWorked <= 0) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    
    // Save using formHandler
    if (window.formHandler && window.formHandler.saveHours) {
      const result = window.formHandler.saveHours(hourData);
      if (result.success) {
        showNotification('Hours logged!', 'success');
        hoursForm.reset();
        document.getElementById('workDate').value = today;
        document.getElementById('totalPay').textContent = '$0.00';
        
        // Refresh data
        loadHours();
        updateProfileStats();
        updateGlobalStats();
      }
    }
  });
}
  
  // Initialize marks form
  const marksForm = document.getElementById('marksForm');
  if (marksForm && window.dataManager && window.dataManager.saveMark) {
    marksForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const markData = {
        id: generateId(),
        marksStudent: document.getElementById('marksStudent').value,
        marksSubject: document.getElementById('marksSubject').value.trim(),
        marksTopic: document.getElementById('marksTopic').value.trim(),
        marksDate: document.getElementById('marksDate').value,
        marksScore: parseFloat(document.getElementById('marksScore').value) || 0,
        marksMax: parseFloat(document.getElementById('marksMax').value) || 100,
        marksNotes: document.getElementById('marksNotes').value.trim()
      };
      
      window.dataManager.saveMark(markData)
        .then(result => {
          if (result.success) {
            showNotification('Mark saved successfully!', 'success');
            marksForm.reset();
            document.getElementById('marksDate').value = today;
            loadMarks();
          }
        });
    });
  }
  
  // Initialize attendance form
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm && window.dataManager && window.dataManager.saveAttendance) {
    attendanceForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Get checked students
      const checkedStudents = Array.from(
        document.querySelectorAll('#attendanceStudents input[type="checkbox"]:checked')
      ).map(cb => cb.value);
      
      const attendanceData = {
        id: generateId(),
        attendanceDate: document.getElementById('attendanceDate').value,
        attendanceSubject: document.getElementById('attendanceSubject').value.trim(),
        attendanceTopic: document.getElementById('attendanceTopic').value.trim(),
        presentStudents: checkedStudents,
        attendanceNotes: document.getElementById('attendanceNotes').value.trim()
      };
      
      window.dataManager.saveAttendance(attendanceData)
        .then(result => {
          if (result.success) {
            showNotification('Attendance saved successfully!', 'success');
            attendanceForm.reset();
            document.getElementById('attendanceDate').value = today;
            loadAttendance();
          }
        });
    });
  }
  
  // Initialize payment form
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm && window.dataManager && window.dataManager.savePayment) {
    paymentForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const paymentData = {
        id: generateId(),
        paymentStudent: document.getElementById('paymentStudent').value,
        paymentAmount: parseFloat(document.getElementById('paymentAmount').value) || 0,
        paymentDate: document.getElementById('paymentDate').value,
        paymentMethod: document.getElementById('paymentMethod').value,
        paymentNotes: document.getElementById('paymentNotes').value.trim()
      };
      
      window.dataManager.savePayment(paymentData)
        .then(result => {
          if (result.success) {
            showNotification('Payment recorded successfully!', 'success');
            paymentForm.reset();
            document.getElementById('paymentDate').value = today;
            loadPayments();
          }
        });
    });
  }
}

// Helper function to generate IDs
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Helper function to show notifications (make sure this exists)
function showNotification(message, type = 'info') {
  console.log(`🔔 ${type}: ${message}`);
  
  // Try to use existing notification system
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Show animation
  setTimeout(() => {
    notification.classList.add('notification-show');
  }, 10);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.classList.remove('notification-show');
    notification.classList.add('notification-hide');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 5000);
  
  // Close button
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.classList.remove('notification-show');
    notification.classList.add('notification-hide');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  });
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

console.log('✅ App initialization script loaded');
