// ==================== GLOBAL VARIABLES ====================
let appInitialized = false;
let redirectInProgress = false;
let currentEditId = null;
let autoSyncInterval = null;

// ==================== MAIN INITIALIZATION ====================
function initApp() {
  console.log('🚀 Initializing app...');
  
  if (appInitialized) {
    console.log('⚠️ App already initialized');
    return;
  }
  
  if (isAuthPage()) {
    console.log('⏹️ On auth page, stopping');
    return;
  }
  
  safeInit();
}

async function safeInit() {
  console.log('🔒 Starting safe initialization...');
  
  try {
    await delay(800);
    
    const isAuthenticated = await checkAuthentication();
    
    if (!isAuthenticated && !redirectInProgress) {
      console.log('❌ Not authenticated');
      redirectInProgress = true;
      
      setTimeout(() => {
        console.log('🔄 Redirecting to auth page...');
        window.location.href = 'auth.html';
      }, 1200);
      return;
    }
    
    console.log('✅ Authentication successful');
    appInitialized = true;
    
    syncDataManagerWithAuth();
    initAppUI();
    
  } catch (error) {
    console.error('❌ Safe init error:', error);
    showErrorMessage('App initialization failed. Please refresh.');
  }
}

// ==================== SYNC DATAMANAGER ====================
function syncDataManagerWithAuth() {
  console.log('🔄 Syncing DataManager with authentication...');
  
  try {
    const userEmail = localStorage.getItem('userEmail');
    const worklogUser = localStorage.getItem('worklog_user');
    
    if (userEmail && window.dataManager) {
      console.log('📱 Setting user in DataManager:', userEmail);
      
      let userId = null;
      if (worklogUser) {
        try {
          const parsed = JSON.parse(worklogUser);
          userId = parsed.uid || userEmail.replace(/[^a-zA-Z0-9]/g, '_');
        } catch (e) {
          userId = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
        }
      } else {
        userId = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
      }
      
      window.dataManager.userId = userId;
      window.dataManager.currentUserEmail = userEmail;
      
      console.log('✅ DataManager synced with auth');
    } else {
      console.log('⚠️ Cannot sync DataManager: no user or DataManager not found');
    }
  } catch (error) {
    console.error('❌ Error syncing DataManager:', error);
  }
}

// ==================== APP UI INITIALIZATION ====================
function initAppUI() {
  console.log('🎨 Initializing app UI...');
  
  try {
    initDefaultRate();
    updateProfileInfo();
    initTabs();
    initForms();
    initFAB();
    initProfileModal();
    initSyncControls();
    initReportButtons();
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
  
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.protocol === 'file:';
  
  if (isLocal) {
    console.log('🏠 Local environment detected, auto-authenticating');
    const mockUser = {
      uid: 'local_user_' + Date.now(),
      email: 'local@example.com',
      displayName: 'Local User'
    };
    storeUserInLocalStorage(mockUser);
    return true;
  }
  
  if (checkLocalStorageAuth()) {
    console.log('✅ Found auth in localStorage');
    return true;
  }
  
  const firebaseAuth = await checkFirebaseAuth();
  if (firebaseAuth) {
    console.log('✅ Found auth in Firebase');
    return true;
  }
  
  console.log('❌ No auth found');
  return false;
}

function checkLocalStorageAuth() {
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
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.log('Firebase not available');
    return false;
  }
  
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.log('Firebase auth timeout');
      resolve(false);
    }, 2000);
    
    const user = firebase.auth().currentUser;
    if (user) {
      clearTimeout(timeoutId);
      console.log('Firebase user:', user.email);
      storeUserInLocalStorage(user);
      resolve(true);
      return;
    }
    
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
    let userEmail = 'Not logged in';
    
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail) {
      userEmail = storedEmail;
    } else {
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
    
    const profileEmail = document.getElementById('profileUserEmail');
    const userName = document.getElementById('userName');
    
    if (profileEmail) profileEmail.textContent = userEmail;
    
    const displayName = userEmail.split('@')[0] || 'User';
    if (userName) userName.textContent = displayName;
    
    updateProfileStats();
    
  } catch (error) {
    console.error('Error updating profile:', error);
    
    const profileEmail = document.getElementById('profileUserEmail');
    const userName = document.getElementById('userName');
    
    if (profileEmail) profileEmail.textContent = 'Not logged in';
    if (userName) userName.textContent = 'User';
  }
}

function updateProfileStats() {
  console.log('📊 Updating profile stats...');
  
  try {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    
    const totalStudents = students.length;
    
    const totalHours = hours.reduce((sum, hour) => {
      return sum + (parseFloat(hour.hoursWorked) || 0);
    }, 0);
    
    const totalEarnings = hours.reduce((sum, hour) => {
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const rate = parseFloat(hour.baseRate) || 0;
      return sum + (hoursWorked * rate);
    }, 0);
    
    const studentsElem = document.getElementById('modalStatStudents');
    const hoursElem = document.getElementById('modalStatHours');
    const earningsElem = document.getElementById('modalStatEarnings');
    const updatedElem = document.getElementById('modalStatUpdated');
    
    if (studentsElem) studentsElem.textContent = totalStudents;
    if (hoursElem) hoursElem.textContent = totalHours.toFixed(1);
    if (earningsElem) earningsElem.textContent = totalEarnings.toFixed(2);
    if (updatedElem) updatedElem.textContent = new Date().toLocaleTimeString();
    
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
  
  function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    tabContents.forEach(tab => {
      tab.classList.remove('active');
    });
    
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
    });
    
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
      selectedTab.classList.add('active');
    }
    
    const activeButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }
    
    window.location.hash = tabName;
    loadTabData(tabName);
  }
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) {
    switchTab(hash);
  } else {
    switchTab('students');
  }
  
  window.switchTab = switchTab;
}

function loadTabData(tabName) {
  console.log(`📊 Loading data for ${tabName} tab...`);
  
  setTimeout(() => {
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
        if (window.reportManager && window.reportManager.loadData) {
          window.reportManager.loadData().then(() => {
            updateReportStats();
            generateWeeklyBreakdown();
            generateSubjectBreakdown();
          });
        } else {
          updateReportStats();
          generateWeeklyBreakdown();
          generateSubjectBreakdown();
        }
        break;
    }
  }, 100);
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
  
  let isFabOpen = false;
  
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
  
  fabOverlay.addEventListener('click', function() {
    fabMenu.classList.remove('active');
    fabOverlay.classList.remove('active');
    fab.textContent = '+';
    fab.style.transform = 'rotate(0deg)';
    isFabOpen = false;
  });
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isFabOpen) {
      fabMenu.classList.remove('active');
      fabOverlay.classList.remove('active');
      fab.textContent = '+';
      fab.style.transform = 'rotate(0deg)';
      isFabOpen = false;
    }
  });
  
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
  
  const fabActions = {
    'fabAddStudent': 'students',
    'fabAddHours': 'hours',
    'fabAddMark': 'marks',
    'fabAddAttendance': 'attendance',
    'fabAddPayment': 'payments'
  };
  
  Object.keys(fabActions).forEach(fabId => {
    const fabItem = document.getElementById(fabId);
    if (fabItem) {
      fabItem.addEventListener('click', function() {
        const tabName = fabActions[fabId];
        
        fabMenu.classList.remove('active');
        fabOverlay.classList.remove('active');
        fab.textContent = '+';
        fab.style.transform = 'rotate(0deg)';
        isFabOpen = false;
        
        if (window.switchTab) {
          window.switchTab(tabName);
        }
      });
    }
  });
  
  if (!document.getElementById('fabAddPayment')) {
    const fabAddPayment = document.createElement('button');
    fabAddPayment.id = 'fabAddPayment';
    fabAddPayment.className = 'fab-item';
    fabAddPayment.innerHTML = '<span class="icon">💰</span>Record Payment';
    fabAddPayment.addEventListener('click', function() {
      fabMenu.classList.remove('active');
      fabOverlay.classList.remove('active');
      fab.textContent = '+';
      fab.style.transform = 'rotate(0deg)';
      isFabOpen = false;
      
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
  
  if (profileBtn && profileModal) {
    profileBtn.addEventListener('click', function() {
      updateProfileInfo();
      profileModal.style.display = 'block';
    });
  }
  
  if (closeProfileBtn && profileModal) {
    closeProfileBtn.addEventListener('click', function() {
      profileModal.style.display = 'none';
    });
  }
  
  if (profileModal) {
    window.addEventListener('click', function(event) {
      if (event.target === profileModal) {
        profileModal.style.display = 'none';
      }
    });
  }
  
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
  
  localStorage.removeItem('worklog_user');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userId');
  localStorage.removeItem('lastAuthTime');
  
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().signOut().catch(error => {
      console.log('Firebase logout error:', error);
    });
  }
  
  window.location.href = 'auth.html';
}

// ==================== SYNC CONTROLS FUNCTIONS ====================
function initSyncControls() {
  console.log('☁️ Initializing sync controls...');
  
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async function() {
      console.log('Sync button clicked');
      await handleSync();
    });
  }
  
  const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
  const autoSyncText = document.getElementById('autoSyncText');
  
  if (autoSyncCheckbox) {
    const autoSyncEnabled = localStorage.getItem('autoSyncEnabled') === 'true';
    autoSyncCheckbox.checked = autoSyncEnabled;
    
    if (autoSyncText) {
      autoSyncText.textContent = autoSyncEnabled ? 'Auto' : 'Manual';
    }
    
    autoSyncCheckbox.addEventListener('change', function() {
      const isChecked = this.checked;
      console.log('Auto-sync:', isChecked ? 'enabled' : 'disabled');
      
      if (autoSyncText) {
        autoSyncText.textContent = isChecked ? 'Auto' : 'Manual';
      }
      
      localStorage.setItem('autoSyncEnabled', isChecked);
      
      if (isChecked) {
        startAutoSync();
        showNotification('Auto-sync enabled (every 30 seconds)', 'success');
      } else {
        stopAutoSync();
        showNotification('Auto-sync disabled', 'warning');
      }
    });
  }
  
  // Export Cloud Button
  const exportCloudBtn = document.getElementById('exportCloudBtn');
  if (exportCloudBtn) {
    exportCloudBtn.addEventListener('click', async function() {
      console.log('Export Cloud button clicked');
      await exportToCloud();
    });
  }
  
  // Import Cloud Button
  const importCloudBtn = document.getElementById('importCloudBtn');
  if (importCloudBtn) {
    importCloudBtn.addEventListener('click', async function() {
      console.log('Import Cloud button clicked');
      await importFromCloud();
    });
  }
  
  // Fix Stats Button
  const syncStatsBtn = document.getElementById('syncStatsBtn');
  if (syncStatsBtn) {
    syncStatsBtn.addEventListener('click', function() {
      console.log('Fix Stats button clicked');
      fixAllStats();
    });
  }
  
  // Export Data Button
  const exportDataBtn = document.getElementById('exportDataBtn');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', function() {
      console.log('Export Data button clicked');
      exportAllData();
    });
  }
  
  // Import Data Button
  const importDataBtn = document.getElementById('importDataBtn');
  if (importDataBtn) {
    importDataBtn.addEventListener('click', function() {
      console.log('Import Data button clicked');
      createFileInput(); // This was missing!
      document.getElementById('importFileInput').click();
    });
  }
  
  // Clear All Button
  const clearDataBtn = document.getElementById('clearDataBtn');
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', function() {
      console.log('Clear All button clicked');
      clearAllData();
    });
  }
  
  // Create the file input
  createFileInput();
  
  updateSyncIndicator('Online', 'online');
}

// ==================== SYNC FUNCTIONS ====================
async function handleSync() {
  try {
    console.log('🔄 Starting sync process...');
    updateSyncIndicator('Syncing...', 'syncing');
    showNotification('Syncing data...', 'info');
    
    if (!navigator.onLine) {
      updateSyncIndicator('Offline', 'offline');
      showNotification('Cannot sync while offline', 'error');
      return { success: false, error: 'Offline' };
    }
    
    const firebaseAvailable = typeof firebase !== 'undefined' && 
                             firebase.auth && 
                             firebase.firestore;
    
    let firebaseUser = null;
    if (firebaseAvailable) {
      try {
        firebaseUser = firebase.auth().currentUser;
      } catch (authError) {
        console.log('Firebase auth error:', authError);
      }
    }
    
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
      
      const timestamp = new Date().toISOString();
      localStorage.setItem('lastSync', timestamp);
      
      setTimeout(() => {
        updateSyncIndicator('Local', 'warning');
      }, 2000);
      
      return { success: true, localOnly: true };
    }
    
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
      console.log('☁️ User authenticated, syncing to Firebase...');
      
      try {
        const db = firebase.firestore();
        const userRef = db.collection('users').doc(firebaseUser.uid).collection('data').doc('worklog');
        
        await userRef.set({
          ...allData,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Firebase sync successful');
        
        const timestamp = new Date().toISOString();
        localStorage.setItem('lastSync', timestamp);
        
        updateSyncIndicator('Cloud Synced', 'success');
        showNotification('Data synced to cloud successfully!', 'success');
        
      } catch (firestoreError) {
        console.error('Firestore error:', firestoreError);
        updateSyncIndicator('Cloud Error', 'error');
        showNotification('Cloud sync failed. Using local backup.', 'warning');
        
        const timestamp = new Date().toISOString();
        localStorage.setItem('lastSync', timestamp);
      }
      
    } else {
      console.log('👤 No Firebase user, local sync only');
      
      const timestamp = new Date().toISOString();
      localStorage.setItem('lastSync', timestamp);
      
      updateSyncIndicator('Local Synced', 'warning');
      showNotification('Local sync completed (login for cloud)', 'info');
    }
    
    updateProfileStats();
    updateGlobalStats();
    
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

function updateSyncIndicator(text, status) {
  const syncIndicator = document.getElementById('syncIndicator');
  if (!syncIndicator) return;
  
  syncIndicator.textContent = text;
  syncIndicator.className = status;
  
  console.log(`✅ Sync indicator: "${text}" (${status})`);
}

function startAutoSync() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  
  autoSyncInterval = setInterval(async () => {
    if (navigator.onLine && firebase.auth().currentUser) {
      console.log('🔄 Auto-sync running...');
      await handleSync();
    }
  }, 30000);
  
  console.log('✅ Auto-sync started');
}

function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
    console.log('⏹️ Auto-sync stopped');
  }
}

// ==================== FILE INPUT FUNCTION ====================
function createFileInput() {
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
            setTimeout(() => location.reload(), 1000);
          }
        } catch (error) {
          showNotification('Invalid file format', 'error');
        }
      };
      reader.readAsText(file);
      
      event.target.value = '';
    });
    
    document.body.appendChild(fileInput);
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
    
    const data = getAllDataForExport();
    
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
    
    if (window.firebaseManager && window.firebaseManager.loadFromFirestore) {
      const result = await window.firebaseManager.loadFromFirestore('backup');
      
      if (result.success && result.data.length > 0) {
        const latestBackup = result.data.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        )[0];
        
        if (latestBackup && latestBackup.data) {
          importAllData(latestBackup.data);
          showNotification('Data imported from cloud successfully!', 'success');
          location.reload();
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
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }
    
    if (data.students) localStorage.setItem('worklog_students', JSON.stringify(data.students));
    if (data.hours) localStorage.setItem('worklog_hours', JSON.stringify(data.hours));
    if (data.marks) localStorage.setItem('worklog_marks', JSON.stringify(data.marks));
    if (data.attendance) localStorage.setItem('worklog_attendance', JSON.stringify(data.attendance));
    if (data.payments) localStorage.setItem('worklog_payments', JSON.stringify(data.payments));
    
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

function fixAllStats() {
  try {
    showNotification('Fixing statistics...', 'info');
    
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
    const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    
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
    
    let balancesFixed = 0;
    
    showNotification(
      `Fixed: ${hoursFixed} hours, ${marksFixed} marks, ${balancesFixed} balances`,
      'success'
    );
    
    loadInitialData();
    updateGlobalStats();
    updateProfileStats();
    
  } catch (error) {
    console.error('Fix stats error:', error);
    showNotification('Failed to fix statistics', 'error');
  }
}

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
    const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
    const theme = localStorage.getItem('worklog-theme') || 'dark';
    const autoSync = localStorage.getItem('autoSyncEnabled');
    
    localStorage.clear();
    
    localStorage.setItem('defaultHourlyRate', defaultRate);
    localStorage.setItem('worklog-theme', theme);
    if (autoSync) localStorage.setItem('autoSyncEnabled', autoSync);
    
    showNotification('All data has been cleared!', 'success');
    
    setTimeout(() => location.reload(), 1500);
    
  } catch (error) {
    console.error('Clear data error:', error);
    showNotification('Failed to clear data', 'error');
  }
}

// ==================== FORM INITIALIZATION ====================
function initForms() {
  console.log('📝 Initializing forms...');
  
  const today = new Date().toISOString().split('T')[0];
  const dateFields = ['workDate', 'marksDate', 'attendanceDate', 'paymentDate'];
  
  dateFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = today;
    }
  });
  
  // Student form - use formHandler
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const studentData = {
        name: document.getElementById('studentName').value.trim(),
        studentId: document.getElementById('studentId').value.trim(),
        gender: document.getElementById('studentGender').value,
        email: document.getElementById('studentEmail').value.trim(),
        phone: document.getElementById('studentPhone').value.trim(),
        rate: parseFloat(document.getElementById('studentRate').value) || 25.00
      };
      
      if (!studentData.name || !studentData.studentId) {
        showNotification('Name and Student ID are required!', 'error');
        return;
      }
      
      if (window.formHandler && window.formHandler.handleStudentSubmit) {
        window.formHandler.handleStudentSubmit(studentForm);
      } else {
        saveStudentToLocalStorage(studentData);
      }
    });
  }
}

function saveStudentToLocalStorage(studentData) {
  try {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    
    studentData.id = 'student_' + Date.now();
    studentData.createdAt = new Date().toISOString();
    
    students.push(studentData);
    localStorage.setItem('worklog_students', JSON.stringify(students));
    
    showNotification('Student saved locally!', 'success');
    document.getElementById('studentForm').reset();
    
    loadStudents();
    updateProfileStats();
    updateGlobalStats();
    
  } catch (error) {
    console.error('Error saving student:', error);
    showNotification('Error saving student: ' + error.message, 'error');
  }
}

// ==================== REPORT FUNCTIONS ====================
function initReportButtons() {
  console.log('📊 Initializing report buttons...');
  
  setTimeout(() => {
    const weeklyReportBtn = document.getElementById('weeklyReportBtn');
    if (weeklyReportBtn) {
      weeklyReportBtn.addEventListener('click', function() {
        if (window.reportManager && window.reportManager.generateWeeklyReport) {
          window.reportManager.generateWeeklyReport();
        } else {
          generateWeeklyReport();
        }
      });
    }
    
    const biWeeklyReportBtn = document.getElementById('biWeeklyReportBtn');
    if (biWeeklyReportBtn) {
      biWeeklyReportBtn.addEventListener('click', function() {
        if (window.reportManager && window.reportManager.generateBiWeeklyReport) {
          window.reportManager.generateBiWeeklyReport();
        } else {
          generateBiWeeklyReport();
        }
      });
    }
    
    const monthlyReportBtn = document.getElementById('monthlyReportBtn');
    if (monthlyReportBtn) {
      monthlyReportBtn.addEventListener('click', function() {
        if (window.reportManager && window.reportManager.generateMonthlyReport) {
          window.reportManager.generateMonthlyReport();
        } else {
          generateMonthlyReport();
        }
      });
    }
    
    const subjectReportBtn = document.getElementById('subjectReportBtn');
    if (subjectReportBtn) {
      subjectReportBtn.addEventListener('click', function() {
        if (window.reportManager && window.reportManager.generateSubjectReport) {
          window.reportManager.generateSubjectReport();
        } else {
          generateSubjectReport();
        }
      });
    }
    
    const pdfReportBtn = document.getElementById('pdfReportBtn');
    if (pdfReportBtn) {
      pdfReportBtn.addEventListener('click', function() {
        if (window.reportManager && window.reportManager.exportToPDF) {
          window.reportManager.exportToPDF();
        } else {
          generatePDFReport();
        }
      });
    }
    
    const emailReportBtn = document.getElementById('emailReportBtn');
    if (emailReportBtn) {
      emailReportBtn.addEventListener('click', function() {
        if (window.reportManager && window.reportManager.emailReport) {
          window.reportManager.emailReport();
        } else {
          generateEmailReport();
        }
      });
    }
    
    const claimFormBtn = document.getElementById('claimFormBtn');
    if (claimFormBtn && window.reportManager && window.reportManager.generateClaimForm) {
      claimFormBtn.addEventListener('click', function() {
        window.reportManager.generateClaimForm();
      });
    }
    
    const invoiceBtn = document.getElementById('invoiceBtn');
    if (invoiceBtn && window.reportManager && window.reportManager.generateInvoice) {
      invoiceBtn.addEventListener('click', function() {
        window.reportManager.generateInvoice();
      });
    }
    
  }, 500);
}

function loadReports() {
  console.log('📈 Loading reports...');
  updateReportStats();
  generateWeeklyBreakdown();
  generateSubjectBreakdown();
}

function updateReportStats() {
  console.log('📊 Updating report statistics...');
  
  try {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    
    const totalStudents = students.length;
    
    const totalHours = hours.reduce((sum, hour) => {
      return sum + (parseFloat(hour.hoursWorked) || 0);
    }, 0);
    
    const totalEarnings = hours.reduce((sum, hour) => {
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const rate = parseFloat(hour.baseRate) || 0;
      return sum + (hoursWorked * rate);
    }, 0);
    
    let avgMark = 0;
    if (marks.length > 0) {
      const totalPercentage = marks.reduce((sum, mark) => {
        return sum + (parseFloat(mark.percentage) || 0);
      }, 0);
      avgMark = totalPercentage / marks.length;
    }
    
    const totalPayments = payments.reduce((sum, payment) => {
      return sum + (parseFloat(payment.paymentAmount) || 0);
    }, 0);
    
    const outstandingBalance = totalEarnings - totalPayments;
    
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
      weeks[weekKey].net += earnings * 0.8;
      
      if (hour.workSubject) {
        weeks[weekKey].subjects.add(hour.workSubject);
      }
    });
    
    const weekArray = Object.values(weeks).sort((a, b) => {
      return new Date(b.period.split(' - ')[0]) - new Date(a.period.split(' - ')[0]);
    });
    
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
    
    const subjects = {};
    
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
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
  
  if (window.formHandler && window.formHandler.initializeStorage) {
    window.formHandler.initializeStorage();
  }
  
  loadStudents();
  loadHours();
  loadMarks();
  loadAttendance();
  loadPayments();
  populateStudentDropdowns();
  updateGlobalStats();
  updateProfileStats();
  
  if (document.getElementById('reports').classList.contains('active')) {
    loadReports();
  }
}

function loadStudents() {
  console.log('👥 Loading students...');
  
  const container = document.getElementById('studentsContainer');
  if (!container) return;
  
  let students = [];
  if (window.formHandler && window.formHandler.getStudents) {
    students = window.formHandler.getStudents();
  } else {
    students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  }
  
  const countElem = document.getElementById('studentCount');
  if (countElem) countElem.textContent = students.length;
  
  if (students.length === 0) {
    container.innerHTML = '<p class="empty-message">No students registered yet.</p>';
    return;
  }
  
  container.innerHTML = students.map(student => `
    <div class="student-card" data-id="${student.id}">
      <div class="student-card-header">
        <strong>${student.name}</strong>
        <span class="student-id">${student.studentId}</span>
        <div class="student-actions">
          <button class="btn-icon edit-student" onclick="editStudent('${student.id}')" title="Edit">✏️</button>
          <button class="btn-icon delete-student" onclick="deleteStudent('${student.id}')" title="Delete">🗑️</button>
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
}

function loadHours() {
  console.log('⏱️ Loading hours...');
  
  const container = document.getElementById('hoursContainer');
  if (!container) return;
  
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
  
  let marks = [];
  if (window.formHandler && window.formHandler.getMarks) {
    marks = window.formHandler.getMarks();
  } else {
    marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
  }
  
  const countElem = document.getElementById('marksCount');
  if (countElem) countElem.textContent = marks.length;
  
  if (marks.length === 0) {
    container.innerHTML = '<p class="empty-message">No marks recorded yet.</p>';
    return;
  }
  
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
  
  let attendance = [];
  if (window.formHandler && window.formHandler.getAttendance) {
    attendance = window.formHandler.getAttendance();
  } else {
    attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
  }
  
  const countElem = document.getElementById('attendanceCount');
  if (countElem) countElem.textContent = attendance.length;
  
  const lastSessionElem = document.getElementById('lastSessionDate');
  if (lastSessionElem && attendance.length > 0) {
    const latest = attendance[0];
    lastSessionElem.textContent = new Date(latest.attendanceDate).toLocaleDateString();
  } else if (lastSessionElem) {
    lastSessionElem.textContent = 'Never';
  }
  
  if (attendance.length === 0) {
    container.innerHTML = '<p class="empty-message">No attendance records yet.</p>';
    return;
  }
  
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
  
  let payments = [];
  if (window.formHandler && window.formHandler.getPayments) {
    payments = window.formHandler.getPayments();
  } else {
    payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
  }
  
  let students = [];
  if (window.formHandler && window.formHandler.getStudents) {
    students = window.formHandler.getStudents();
  } else {
    students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  }
  
  let hours = [];
  if (window.formHandler && window.formHandler.getHours) {
    hours = window.formHandler.getHours();
  } else {
    hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
  }
  
  const totalStudentsElem = document.getElementById('totalStudentsCount');
  if (totalStudentsElem) totalStudentsElem.textContent = students.length;
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  let totalOwed = 0;
  let monthlyPayments = 0;
  
  const studentBalances = students.map(student => {
    const studentHours = hours.filter(h => h.hoursStudent === student.id);
    const studentPayments = payments.filter(p => p.paymentStudent === student.id);
    
    const hoursEarnings = studentHours.reduce((sum, hour) => {
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const rate = parseFloat(hour.baseRate) || parseFloat(student.rate) || 0;
      return sum + (hoursWorked * rate);
    }, 0);
    
    const totalPayments = studentPayments.reduce((sum, payment) => {
      const amount = parseFloat(payment.paymentAmount) || 0;
      
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
  
  const totalOwedElem = document.getElementById('totalOwed');
  const monthlyPaymentsElem = document.getElementById('monthlyPayments');
  
  if (totalOwedElem) totalOwedElem.textContent = `$${totalOwed.toFixed(2)}`;
  if (monthlyPaymentsElem) monthlyPaymentsElem.textContent = `$${monthlyPayments.toFixed(2)}`;
  
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
  
  if (container) {
    if (payments.length === 0) {
      container.innerHTML = '<p class="empty-message">No recent payment activity.</p>';
      return;
    }
    
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
function populateStudentDropdowns() {
  console.log('👥 Populating student dropdowns...');
  
  let students = [];
  if (window.formHandler && window.formHandler.getStudents) {
    students = window.formHandler.getStudents();
  } else {
    students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  }
  
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
      element.innerHTML = '<option value="">Select Student</option>' + 
        students.map(student => `
          <option value="${student.id}">${student.name} (${student.studentId})</option>
        `).join('');
    }
  });
  
  console.log(`✅ Populated ${students.length} students in dropdowns`);
}

function updateGlobalStats() {
  console.log('📈 Updating global stats...');
  
  let stats = { students: 0, totalHours: 0, totalEarnings: 0 };
  
  if (window.formHandler && window.formHandler.getStatistics) {
    stats = window.formHandler.getStatistics();
  } else {
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
  
  const totalHours = parseFloat(stats.totalHours) || 0;
  const totalEarnings = parseFloat(stats.totalEarnings) || 0;
  
  const studentCountElem = document.getElementById('statStudents');
  const hoursElem = document.getElementById('statHours');
  const avgRateElem = document.getElementById('averageRate');
  
  if (studentCountElem) studentCountElem.textContent = stats.students || 0;
  if (hoursElem) hoursElem.textContent = totalHours.toFixed(1);
  
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

function showNotification(message, type = 'info') {
  console.log(`🔔 ${type}: ${message}`);
  
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
  
  setTimeout(() => {
    notification.classList.add('notification-show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('notification-show');
    notification.classList.add('notification-hide');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 5000);
  
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
