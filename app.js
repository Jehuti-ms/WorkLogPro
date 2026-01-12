// ==================== GLOBAL VARIABLES ====================
let appInitialized = false;
let redirectInProgress = false;
let currentEditId = null;

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
  
  const exportCloudBtn = document.getElementById('exportCloudBtn');
  if (exportCloudBtn) {
    exportCloudBtn.addEventListener('click', async function() {
      console.log('Export Cloud button clicked');
      await exportToCloud();
    });
  }
  
  const importCloudBtn = document.getElementById('importCloudBtn');
  if (importCloudBtn) {
    importCloudBtn.addEventListener('click', async function() {
      console.log('Import Cloud button clicked');
      await importFromCloud();
    });
  }
  
  const syncStatsBtn = document.getElementById('syncStatsBtn');
  if (syncStatsBtn) {
    syncStatsBtn.addEventListener('click', function() {
      console.log('Fix Stats button clicked');
      fixAllStats();
    });
  }
  
  const exportDataBtn = document.getElementById('exportDataBtn');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', function() {
      console.log('Export Data button clicked');
      exportAllData();
    });
  }
  
  const importDataBtn = document.getElementById('importDataBtn');
  if (importDataBtn) {
    importDataBtn.addEventListener('click', function() {
      console.log('Import Data button clicked');
      const fileInput = document.getElementById('importFileInput');
      if (!fileInput) {
        createFileInput();
      }
      document.getElementById('importFileInput').click();
    });
  }
  
  const clearDataBtn = document.getElementById('clearDataBtn');
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', function() {
      console.log('Clear All button clicked');
      clearAllData();
    });
  }
  
  createFileInput();
  updateSyncIndicator('Online', 'online');
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
        // Fallback to localStorage
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

// Add notification styles
function addNotificationStyles() {
  if (document.getElementById('notification-styles')) return;
  
  const styleElement = document.createElement('style');
  styleElement.id = 'notification-styles';
  styleElement.textContent = `
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
  document.head.appendChild(styleElement);
}

addNotificationStyles();
