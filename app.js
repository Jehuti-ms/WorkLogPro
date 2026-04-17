// ==================== GLOBAL VARIABLES ====================
let appInitialized = false;
let redirectInProgress = false;
let currentEditId = null;
let autoSyncInterval = null;
let isSyncing = false;

// ==================== DATE UTILITIES (FIXES TIMEZONE ISSUES) ====================
// Convert YYYY-MM-DD to DD/MM/YYYY for display (NO timezone conversion)
function formatDisplayDate(dateString) {
    if (!dateString || dateString === 'Never') return 'Never';
    if (dateString.includes('/')) return dateString; // Already formatted
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
}

// Get today's date in YYYY-MM-DD format (local timezone)
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Set a date input to a specific date (no conversion)
function setDateInput(inputId, dateString) {
    const input = document.getElementById(inputId);
    if (input && dateString) {
        input.value = dateString;
    }
}

// Get date from input as-is (no conversion)
function getDateFromInput(inputId) {
    const input = document.getElementById(inputId);
    return input ? input.value : '';
}

// Sort dates in YYYY-MM-DD format (newest first)
function sortDatesDescending(dateA, dateB) {
    return (dateB || '').localeCompare(dateA || '');
}

// Sort dates in YYYY-MM-DD format (oldest first)
function sortDatesAscending(dateA, dateB) {
    return (dateA || '').localeCompare(dateB || '');
}

// ==================== SIMPLE RATE MANAGER ====================
const SimpleRateManager = {
    // Get the current default rate
    get: function() {
        return localStorage.getItem('defaultHourlyRate') || '25.00';
    },
    
    // Set the default rate
    set: function(rate) {
        const formattedRate = parseFloat(rate).toFixed(2);
        localStorage.setItem('defaultHourlyRate', formattedRate);
        this.updateUI(formattedRate);
        return formattedRate;
    },
    
    // Update all UI elements
    updateUI: function(rate) {
        rate = rate || this.get();
        
        // Update all rate displays
        const displays = {
            'currentDefaultRate': rate,
            'currentDefaultRateDisplay': rate,
            'defaultRateDisplay': rate,
            'profileDefaultRate': `$${rate}/hour`
        };
        
        Object.entries(displays).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
        
        // Update input field
        const rateInput = document.getElementById('defaultBaseRate');
        if (rateInput) {
            rateInput.value = rate;
            rateInput.placeholder = rate;
        }
        
        // Update form placeholders
        const studentRate = document.getElementById('studentRate');
        if (studentRate) studentRate.placeholder = `Default: $${rate}`;
        
        const baseRate = document.getElementById('baseRate');
        if (baseRate) baseRate.placeholder = `Default: $${rate}`;
    },
    
    // Apply to current form
    applyToForm: function() {
        const rate = this.get();
        const studentRate = document.getElementById('studentRate');
        const baseRate = document.getElementById('baseRate');
        
        if (studentRate) studentRate.value = rate;
        if (baseRate) baseRate.value = rate;
        
        showNotification(`Default rate $${rate} applied to form`, 'info');
    },
    
    // Apply to all students
    applyToAllStudents: function() {
        const rate = this.get();
        const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
        
        if (students.length === 0) {
            showNotification('No students to update', 'warning');
            return;
        }
        
        const updated = students.map(s => ({
            ...s,
            rate: parseFloat(rate),
            hourlyRate: parseFloat(rate)
        }));
        
        localStorage.setItem('worklog_students', JSON.stringify(updated));
        
        // Refresh display
        if (window.dataManager) window.dataManager.syncUI();
        if (typeof loadStudents === 'function') loadStudents();
        
        showNotification(`Updated ${students.length} students to $${rate}/hour`, 'success');
    }
};

window.SimpleRateManager = SimpleRateManager;

// ==================== IMPROVED AUTH CHECK ====================
async function checkAuthentication() {
  console.log('🔍 Checking authentication...');
  
  // First check Firebase directly (it has persistence)
  if (typeof firebase !== 'undefined' && firebase.auth) {
    try {
      // Wait for Firebase to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const user = firebase.auth().currentUser;
      if (user) {
        console.log('✅ Found Firebase user:', user.email);
        storeUserInLocalStorage(user);
        return true;
      }
      
      // If no current user, wait for auth state (but with timeout)
      const authUser = await new Promise((resolve) => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });
        setTimeout(() => {
          unsubscribe();
          resolve(null);
        }, 2000);
      });
      
      if (authUser) {
        console.log('✅ Firebase auth state resolved:', authUser.email);
        storeUserInLocalStorage(authUser);
        return true;
      }
    } catch (error) {
      console.log('Firebase auth error:', error);
    }
  }
  
  // Check localStorage as fallback
  if (checkLocalStorageAuth()) {
    console.log('✅ Found user in localStorage');
    return true;
  }
  
  console.log('❌ No authentication found');
  return false;
}

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
    initSyncToggle();
    initSync();
    loadInitialData();
    initClientManager();
    initMyBusinesses();
        
    // ===== FIX: Worklog save button handler =====
    setTimeout(function() {
      const saveBtn = document.getElementById('worklogSubmitBtn');
      if (saveBtn) {
        // Clone and replace to remove any stale event handlers
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        // Attach the correct save function
        newSaveBtn.onclick = function(e) {
          e.preventDefault();
          if (typeof saveWorklogEntry === 'function') {
            saveWorklogEntry();
            console.log('✅ SaveWorklogEntry called from fixed button');
          } else {
            console.error('❌ saveWorklogEntry function not found');
          }
        };
        console.log('✅ Save button handler permanently fixed');
      } else {
        console.log('⚠️ worklogSubmitBtn not found yet, will retry...');
        // Retry after a longer delay if button not found
        setTimeout(function() {
          const retryBtn = document.getElementById('worklogSubmitBtn');
          if (retryBtn) {
            const newBtn = retryBtn.cloneNode(true);
            retryBtn.parentNode.replaceChild(newBtn, retryBtn);
            newBtn.onclick = function(e) {
              e.preventDefault();
              if (typeof saveWorklogEntry === 'function') saveWorklogEntry();
            };
            console.log('✅ Save button fixed on retry');
          }
        }, 1000);
      }
    }, 500);
    // ===== END OF FIX =====
    
    console.log('✅ App UI initialized');
  } catch (error) {
    console.error('❌ UI init error:', error);
  }
}

// ==================== INIT DEFAULT RATE ====================
function initDefaultRate() {
    console.log('💰 Initializing default rate...');
    SimpleRateManager.updateUI();
}

// ==================== SAVE DEFAULT RATE ====================
window.saveDefaultRate = function() {
    const input = document.getElementById('defaultBaseRate');
    if (!input) return;
    
    const rate = parseFloat(input.value);
    if (isNaN(rate) || rate <= 0) {
        showNotification('Please enter a valid rate', 'error');
        return;
    }
    
    // Save and update UI
    const saved = SimpleRateManager.set(rate);
    showNotification(`Default rate set to $${saved}`, 'success');
    
    // Simple cloud sync if available
    if (window.syncService && firebase.auth().currentUser) {
        setTimeout(() => window.syncService.sync(false, false), 500);
    }
};

// ==================== APPLY DEFAULT RATE TO FORM ====================
window.useDefaultRate = function() {
    SimpleRateManager.applyToForm();
};

// ==================== APPLY DEFAULT RATE TO ALL STUDENTS ====================
window.applyDefaultRateToAll = function() {
    SimpleRateManager.applyToAllStudents();
};

// ==================== HELPER FUNCTIONS ====================
function isAuthPage() {
  return window.location.pathname.includes('auth.html') || 
         window.location.href.includes('auth.html');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

// ==================== PROFILE INFO FUNCTION ====================
function updateProfileInfo() {
  console.log('🔄 Updating profile info...');
  
  try {
    let userEmail = 'Not logged in';
    let userName = 'User';
    let memberSince = 'Unknown';
    
    // Get current default rate
  //const defaultRate = SimpleRateManager.get();
    const defaultRate = RateManager.get();
    
    // Get user email from various sources
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail) {
      userEmail = storedEmail;
      userName = userEmail.split('@')[0];
    } else {
      const worklogUser = localStorage.getItem('worklog_user');
      if (worklogUser) {
        try {
          const parsed = JSON.parse(worklogUser);
          if (parsed && parsed.email) {
            userEmail = parsed.email;
            userName = parsed.displayName || parsed.email.split('@')[0];
          }
        } catch (e) {
          console.log('Could not parse worklog_user');
        }
      }
    }
    
    // Try to get member since from Firebase
    if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
      const user = firebase.auth().currentUser;
      if (user.metadata && user.metadata.creationTime) {
        memberSince = new Date(user.metadata.creationTime).toLocaleDateString();
      }
    }
    
    console.log('User email found:', userEmail);
    console.log('Member since:', memberSince);
    console.log('Default rate:', defaultRate);
    
    // Update profile modal elements
    const profileEmail = document.getElementById('profileUserEmail');
    const userNameElem = document.getElementById('userName');
    const memberSinceElem = document.getElementById('profileUserSince');
    const defaultRateElem = document.getElementById('profileDefaultRate');
    
    if (profileEmail) profileEmail.textContent = userEmail;
    if (userNameElem) userNameElem.textContent = userName;
    if (memberSinceElem) memberSinceElem.textContent = memberSince;
    if (defaultRateElem) defaultRateElem.textContent = `$${parseFloat(defaultRate).toFixed(2)}/hour`;
    
    // Update profile stats
    updateProfileStats();
    
  } catch (error) {
    console.error('Error updating profile:', error);
    
    // Set fallback values
    const profileEmail = document.getElementById('profileUserEmail');
    const userName = document.getElementById('userName');
    const memberSinceElem = document.getElementById('profileUserSince');
    const defaultRateElem = document.getElementById('profileDefaultRate');
    
    if (profileEmail) profileEmail.textContent = 'Not logged in';
    if (userName) userName.textContent = 'User';
    if (memberSinceElem) memberSinceElem.textContent = 'Unknown';
    if (defaultRateElem) defaultRateElem.textContent = '$25.00/hour';
  }
}

// ==================== UPDATED PROFILE STATS WITH WORKLOG ====================
function updateProfileStats() {
  console.log('📊 Updating profile stats...');
  
  try {
    // Get all data
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    const worklogs = JSON.parse(localStorage.getItem('worklog_entries') || '[]'); // ADD THIS
    
    // Calculate totals from traditional hours
    const totalHoursFromHours = hours.reduce((sum, hour) => {
      return sum + (parseFloat(hour.hoursWorked) || 0);
    }, 0);
    
    // Calculate totals from worklog
    const totalHoursFromWorklog = worklogs.reduce((sum, entry) => {
      return sum + (parseFloat(entry.duration) || 0);
    }, 0);
    
    // Combined total hours
    const totalHours = totalHoursFromHours + totalHoursFromWorklog;
    
    // Calculate earnings from traditional hours
    const earningsFromHours = hours.reduce((sum, hour) => {
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const rate = parseFloat(hour.baseRate) || 0;
      return sum + (hoursWorked * rate);
    }, 0);
    
    // Calculate earnings from worklog
    const earningsFromWorklog = worklogs.reduce((sum, entry) => {
      return sum + (parseFloat(entry.totalEarnings) || 0);
    }, 0);
    
    // Combined total earnings
    const totalEarnings = earningsFromHours + earningsFromWorklog;
    
    // Calculate total payments received
    const totalPayments = payments.reduce((sum, payment) => {
      return sum + (parseFloat(payment.paymentAmount) || 0);
    }, 0);
    
    // Calculate outstanding balance
    const outstandingBalance = totalEarnings - totalPayments;
    
    // Calculate average rate from students
    let avgRate = 0;
    if (students.length > 0) {
      const totalRate = students.reduce((sum, student) => {
        return sum + (parseFloat(student.rate || student.hourlyRate || 0));
      }, 0);
      avgRate = totalRate / students.length;
    }
    
    // Calculate average mark
    let avgMark = 0;
    if (marks.length > 0) {
      const totalPercentage = marks.reduce((sum, mark) => {
        return sum + (parseFloat(mark.percentage) || 0);
      }, 0);
      avgMark = totalPercentage / marks.length;
    }
    
    // Get default rate
    const defaultRate = SimpleRateManager.get();
    
    console.log(`📊 Stats calculated:`, {
      students: students.length,
      hours: totalHours.toFixed(1),
      earnings: totalEarnings.toFixed(2),
      payments: totalPayments.toFixed(2),
      outstanding: outstandingBalance.toFixed(2),
      avgRate: avgRate.toFixed(2),
      avgMark: avgMark.toFixed(1),
      defaultRate: defaultRate,
      worklogEntries: worklogs.length
    });
    
    // Update PROFILE MODAL stats
    const updateElement = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
        console.log(`✅ Updated ${id}: ${value}`);
      }
    };
    
    updateElement('modalStatStudents', students.length);
    updateElement('modalStatHours', totalHours.toFixed(1));
    updateElement('modalStatEarnings', `$${totalEarnings.toFixed(2)}`);
    updateElement('modalStatRate', `$${avgRate.toFixed(2)}`);
    updateElement('modalStatMarks', `${avgMark.toFixed(1)}%`);
    updateElement('modalStatUpdated', new Date().toLocaleTimeString());
    
    // Also update header stats
    const headerStudents = document.getElementById('statStudents');
    const headerHours = document.getElementById('statHours');
    const headerAvgRate = document.getElementById('averageRate');
    
    if (headerStudents) headerStudents.textContent = students.length;
    if (headerHours) headerHours.textContent = totalHours.toFixed(1);
    if (headerAvgRate) headerAvgRate.textContent = avgRate.toFixed(2);
    
    // Update worklog-specific stats if they exist
    const worklogCount = document.getElementById('worklogStatsCount');
    const worklogAvgDuration = document.getElementById('worklogAvgDuration');
    
    if (worklogCount) worklogCount.textContent = worklogs.length;
    if (worklogAvgDuration && worklogs.length > 0) {
      const avgDuration = totalHoursFromWorklog / worklogs.length;
      worklogAvgDuration.textContent = avgDuration.toFixed(1) + 'h';
    }
    
  } catch (error) {
    console.error('❌ Error updating profile stats:', error);
    
    // Set fallback values
    const fallbacks = {
      'modalStatStudents': '0',
      'modalStatHours': '0.0',
      'modalStatEarnings': '$0.00',
      'modalStatRate': '$0.00',
      'modalStatMarks': '0.0%',
      'modalStatUpdated': 'Error'
    };
    
    Object.entries(fallbacks).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }
}

// Function to refresh all stats
function refreshAllStats() {
  console.log('🔄 Refreshing all statistics...');
  
  // Update profile modal stats
  updateProfileStats();
  
  // Update global header stats
  updateGlobalStats();
  
  // Update report stats if on reports tab
  if (document.getElementById('reports')?.classList.contains('active')) {
    if (typeof updateReportStats === 'function') {
      updateReportStats();
    }
  }
  
  // Update payments tab stats if on payments tab
  if (document.getElementById('payments')?.classList.contains('active')) {
    if (typeof loadPayments === 'function') {
      loadPayments();
    }
  }
  
  console.log('✅ All stats refreshed');
}

// Make it globally available
window.refreshAllStats = refreshAllStats;

// ==================== STUDENT SORTING FUNCTION ====================
window.changeStudentSort = function(method) {
  console.log(`🔄 Changing sort method to: ${method}`);
  localStorage.setItem('studentSortMethod', method);
  
  if (typeof loadStudents === 'function') {
    loadStudents();
  }
  
  if (window.dataManager) {
    window.dataManager.syncUI(method);
  }
  
  const methodNames = {
    'id': 'ID',
    'name': 'name', 
    'date': 'date added',
    'rate': 'hourly rate'
  };
  
  if (typeof showNotification === 'function') {
    showNotification(`Sorting by ${methodNames[method] || method}`, 'info');
  }
};

// ==================== INIT TABS ====================
function initTabs() {
  console.log('📋 Initializing tabs...');
  
  const tabButtons = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tabcontent');
  
  function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    tabContents.forEach(tab => tab.classList.remove('active'));
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) selectedTab.classList.add('active');
    
    const activeButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (activeButton) activeButton.classList.add('active');
    
    window.location.hash = tabName;
    loadTabData(tabName);
    
    // ===== ADD THIS - Refresh attendance when attendance tab is opened =====
    if (tabName === 'attendance') {
        setTimeout(refreshAttendanceStudentList, 150);
    }
    // ===== END ADD =====
  }
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      switchTab(this.getAttribute('data-tab'));
    });
  });
  
  const hash = window.location.hash.replace('#', '');
  switchTab(hash && document.getElementById(hash) ? hash : 'students');
  
  window.switchTab = switchTab;
    
    // Add this at the end of your DOMContentLoaded or initApp function
    window.addEventListener('load', function() {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
}

function switchTab(tabName) {
  console.log('Switching to tab:', tabName);
  
  tabContents.forEach(tab => tab.classList.remove('active'));
  tabButtons.forEach(btn => btn.classList.remove('active'));
  
  const selectedTab = document.getElementById(tabName);
  if (selectedTab) selectedTab.classList.add('active');
  
  const activeButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (activeButton) activeButton.classList.add('active');
  
  // ADD THIS LINE - Scroll to top smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  window.location.hash = tabName;
  loadTabData(tabName);
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
        refreshAttendanceStudentList();  // ← ADD THIS LINE
        break;
      case 'payments':
        loadPayments();
        initPaymentForm();
        break;
      case 'reports':
        loadReports();
        break;
      case 'worklog':
        if (window.worklogManager) {
          window.worklogManager.loadData();
          window.worklogManager.populateDropdowns();
          window.worklogManager.updateUI();
          window.worklogManager.updateStats();
        }
        break;
    }
  }, 100);
}

// ==================== INIT FAB ====================
function initFAB() {
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');
  
  if (!fab || !fabMenu || !fabOverlay) return;
  
  // ===== ENSURE WORKLOG BUTTON EXISTS =====
  if (!document.getElementById('fabAddWorklog')) {
    const fabAddWorklog = document.createElement('button');
    fabAddWorklog.id = 'fabAddWorklog';
    fabAddWorklog.className = 'fab-item';
    fabAddWorklog.innerHTML = '<span class="icon">📝</span>Log Work';
    fabMenu.appendChild(fabAddWorklog);
    console.log('✅ Added Worklog FAB button');
  }
  // ==========================================
  
  let isFabOpen = false;
  
  fab.addEventListener('click', function(e) {
    e.stopPropagation();
    isFabOpen = !isFabOpen;
    fabMenu.classList.toggle('active', isFabOpen);
    fabOverlay.classList.toggle('active', isFabOpen);
    fab.textContent = isFabOpen ? '×' : '+';
    fab.style.transform = isFabOpen ? 'rotate(45deg)' : 'rotate(0deg)';
  });
  
  fabOverlay.addEventListener('click', () => {
    isFabOpen = false;
    fabMenu.classList.remove('active');
    fabOverlay.classList.remove('active');
    fab.textContent = '+';
    fab.style.transform = 'rotate(0deg)';
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFabOpen) {
      fabOverlay.click();
    }
  });
  
      const fabActions = {
      'fabAddStudent': 'students',
      'fabAddWorklog': 'worklog',  
      'fabAddMark': 'marks',
      'fabAddAttendance': 'attendance',
      'fabAddPayment': 'payments',
      'fabAddReports': 'reports'
    };
  
  Object.entries(fabActions).forEach(([id, tab]) => {
    const btn = document.getElementById(id);
    if (btn) {
      // Remove any existing listeners to prevent duplicates
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', () => {
        fabOverlay.click();
        if (window.switchTab) window.switchTab(tab);
      });
    }
  });
}

// ==================== INIT PROFILE MODAL ====================
function initProfileModal() {
  const profileBtn = document.getElementById('profileBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileBtn = document.getElementById('closeProfileModal');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (profileBtn && profileModal) {
    profileBtn.addEventListener('click', () => {
      updateProfileInfo();
      profileModal.style.display = 'block';
    });
  }
  
  if (closeProfileBtn && profileModal) {
    closeProfileBtn.addEventListener('click', () => {
      profileModal.style.display = 'none';
    });
  }
  
  if (profileModal) {
    window.addEventListener('click', (event) => {
      if (event.target === profileModal) {
        profileModal.style.display = 'none';
      }
    });
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
  
  console.log('🚪 Logging out...');
  
  localStorage.removeItem('worklog_user');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userId');
  localStorage.removeItem('lastAuthTime');
  
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().signOut().catch(console.log);
  }
  
  window.location.href = 'auth.html';
}

// ===============Sync Panel Toggle - Same pattern as FAB ==============
function initSyncToggle() {
  const toggleBtn = document.getElementById('toggleSyncBtn');
  const syncPanel = document.querySelector('.sync-toolbar');
  
  // Create overlay if not exists (like FAB)
  let overlay = document.querySelector('.sync-fab-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sync-fab-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.3);
      z-index: 999;
      display: none;
    `;
    document.body.appendChild(overlay);
  }
  
  if (!toggleBtn || !syncPanel) return;
  
  const newBtn = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
  
  function openPanel() {
    syncPanel.classList.add('active');
    overlay.style.display = 'block';
    newBtn.classList.add('active');
  }
  
  function closePanel() {
    syncPanel.classList.remove('active');
    overlay.style.display = 'none';
    newBtn.classList.remove('active');
  }
  
  newBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (syncPanel.classList.contains('active')) {
      closePanel();
    } else {
      openPanel();
    }
  });
  
  overlay.addEventListener('click', closePanel);
  
  console.log('✅ Sync toggle with overlay ready');
} 

// ==================== INIT SYNC CONTROLS ====================
function initSyncControls() {
  console.log('☁️ Initializing sync controls...');
  
  const hasSyncService = !!window.syncService;
  
  // Sync Now Button
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    const newSyncBtn = syncBtn.cloneNode(true);
    syncBtn.parentNode.replaceChild(newSyncBtn, syncBtn);
    newSyncBtn.addEventListener('click', handleSync);
  }
  
  // Auto-sync Checkbox with visual indicator
  const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
  const autoSyncText = document.getElementById('autoSyncText');
  
  if (autoSyncCheckbox) {
    const autoSyncEnabled = localStorage.getItem('autoSyncEnabled') === 'true';
    autoSyncCheckbox.checked = autoSyncEnabled;
    if (autoSyncText) autoSyncText.textContent = autoSyncEnabled ? 'Auto' : 'Manual';
    
    // Add visual indicator class to parent label
    const autoSyncLabel = autoSyncCheckbox.closest('.auto-sync-label');
    if (autoSyncLabel) {
      if (autoSyncEnabled) {
        autoSyncLabel.classList.add('auto-enabled');
      } else {
        autoSyncLabel.classList.remove('auto-enabled');
      }
    }
    
    const newCheckbox = autoSyncCheckbox.cloneNode(true);
    autoSyncCheckbox.parentNode.replaceChild(newCheckbox, autoSyncCheckbox);
    
    newCheckbox.addEventListener('change', function() {
      const isChecked = this.checked;
      if (autoSyncText) autoSyncText.textContent = isChecked ? 'Auto' : 'Manual';
      localStorage.setItem('autoSyncEnabled', isChecked);
      
      // Update visual indicator
      const label = this.closest('.auto-sync-label');
      if (label) {
        if (isChecked) {
          label.classList.add('auto-enabled');
        } else {
          label.classList.remove('auto-enabled');
        }
      }
      
      if (hasSyncService) {
        if (isChecked) {
          window.syncService.startAutoSync();
          showNotification('Auto-sync enabled', 'success');
        } else {
          window.syncService.stopAutoSync();
          showNotification('Auto-sync disabled', 'warning');
        }
      } else {
        if (isChecked) {
          startAutoSync();
          showNotification('Auto-sync enabled', 'success');
        } else {
          stopAutoSync();
          showNotification('Auto-sync disabled', 'warning');
        }
      }
    });
  }
  
  // Export Cloud Button
  setupButton('exportCloudBtn', exportToCloud);
  setupButton('importCloudBtn', importFromCloud);
  setupButton('syncStatsBtn', fixAllStats);
  setupButton('exportDataBtn', exportAllData);
  setupButton('importDataBtn', () => {
    createFileInput();
    document.getElementById('importFileInput').click();
  });
  setupButton('clearDataBtn', clearAllData);
  
  createFileInput();
  updateSyncIndicator(navigator.onLine ? 'Online' : 'Offline', navigator.onLine ? 'online' : 'offline');
  
  window.addEventListener('online', () => {
    updateSyncIndicator('Online', 'online');
    if (localStorage.getItem('autoSyncEnabled') === 'true') setTimeout(handleSync, 2000);
  });
  
  window.addEventListener('offline', () => {
    updateSyncIndicator('Offline', 'offline');
    showNotification('You are offline', 'warning');
  });
  
  console.log('✅ Sync controls initialized');
}

// Helper function to setup buttons (keep this as is)
function setupButton(id, handler) {
  const btn = document.getElementById(id);
  if (!btn) return;
  
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', handler);
}

function setupButton(id, handler) {
  const btn = document.getElementById(id);
  if (!btn) return;
  
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', handler);
}

function updateSyncIndicator(text, status) {
  const indicator = document.getElementById('syncIndicator');
  if (!indicator) return;
  
  indicator.className = '';
  indicator.textContent = text;
  indicator.classList.add(status);
  indicator.style.animation = status === 'syncing' ? 'pulse 1.5s infinite' : 'none';
}

// ==================== SYNC FUNCTIONS ====================
async function handleSync() {
  try {
    updateSyncIndicator('Syncing...', 'syncing');
    showNotification('Syncing data...', 'info');
    
    if (window.syncService) {
      const result = await window.syncService.sync();
      if (!result.success) updateSyncIndicator('Sync Failed', 'error');
      return result;
    }
    
    // Fallback sync
    if (!navigator.onLine) {
      updateSyncIndicator('Offline', 'offline');
      showNotification('Cannot sync while offline', 'error');
      return { success: false };
    }
    
    showNotification('Local sync only', 'warning');
    localStorage.setItem('lastSync', new Date().toISOString());
    updateSyncIndicator('Local', 'warning');
    setTimeout(() => updateSyncIndicator('Online', 'online'), 2000);
    
    return { success: true, localOnly: true };
    
  } catch (error) {
    console.error('Sync error:', error);
    updateSyncIndicator('Sync Failed', 'error');
    showNotification('Sync failed', 'error');
    setTimeout(() => updateSyncIndicator('Online', 'online'), 3000);
    return { success: false };
  }
}

function startAutoSync() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  autoSyncInterval = setInterval(async () => {
    if (navigator.onLine && firebase.auth().currentUser) {
      await handleSync();
    }
  }, 30000);
}

function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}

// ==================== CROSS-DEVICE SYNC ====================
let syncUnsubscribe = null;

function initCrossDeviceSync() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  
  console.log('🔄 Setting up cross-device sync for:', user.email);
  
  // Listen for real-time changes from Firestore
  const db = firebase.firestore();
  const userDocRef = db.collection('users').doc(user.uid).collection('data').doc('worklog');
  
  if (syncUnsubscribe) {
    syncUnsubscribe();
  }
  
  syncUnsubscribe = userDocRef.onSnapshot((doc) => {
    if (doc.exists && doc.data()) {
      const remoteData = doc.data();
      console.log('📡 Real-time update received from cloud');
      
      // Check if remote data is different from local
      const localData = {
        students: JSON.parse(localStorage.getItem('worklog_students') || '[]'),
        worklogs: JSON.parse(localStorage.getItem('worklog_entries') || '[]'),
        marks: JSON.parse(localStorage.getItem('worklog_marks') || '[]'),
        attendance: JSON.parse(localStorage.getItem('worklog_attendance') || '[]'),
        payments: JSON.parse(localStorage.getItem('worklog_payments') || '[]')
      };
      
      let hasChanges = false;
      
      // Compare and update if needed
      if (JSON.stringify(remoteData.students) !== JSON.stringify(localData.students)) {
        localStorage.setItem('worklog_students', JSON.stringify(remoteData.students || []));
        hasChanges = true;
        console.log('🔄 Students updated from cloud');
      }
      
      if (JSON.stringify(remoteData.worklog_entries) !== JSON.stringify(localData.worklogs)) {
        localStorage.setItem('worklog_entries', JSON.stringify(remoteData.worklog_entries || []));
        hasChanges = true;
        console.log('🔄 Worklogs updated from cloud');
      }
      
      if (JSON.stringify(remoteData.marks) !== JSON.stringify(localData.marks)) {
        localStorage.setItem('worklog_marks', JSON.stringify(remoteData.marks || []));
        hasChanges = true;
        console.log('🔄 Marks updated from cloud');
      }
      
      if (JSON.stringify(remoteData.attendance) !== JSON.stringify(localData.attendance)) {
        localStorage.setItem('worklog_attendance', JSON.stringify(remoteData.attendance || []));
        hasChanges = true;
        console.log('🔄 Attendance updated from cloud');
      }
      
      if (JSON.stringify(remoteData.payments) !== JSON.stringify(localData.payments)) {
        localStorage.setItem('worklog_payments', JSON.stringify(remoteData.payments || []));
        hasChanges = true;
        console.log('🔄 Payments updated from cloud');
      }
      
      // Refresh UI if changes were made
      if (hasChanges) {
        console.log('🔄 Refreshing UI with cloud data');
        refreshAllStats();
        if (typeof loadStudents === 'function') loadStudents();
        if (typeof loadWorklogEntries === 'function') loadWorklogEntries();
        if (typeof loadMarks === 'function') loadMarks();
        if (typeof loadAttendance === 'function') loadAttendance();
        if (typeof loadPayments === 'function') loadPayments();
        
        // Show notification
        showNotification('Data synced from cloud', 'info');
      }
    }
  }, (error) => {
    console.error('❌ Sync listener error:', error);
  });
}

// Save to cloud whenever data changes
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const saveToCloud = debounce(async () => {
  // Prevent recursion during save
  if (isSyncing) return;
  
  const user = firebase.auth().currentUser;
  if (!user) return;
  
  const db = firebase.firestore();
  const data = {
    students: JSON.parse(localStorage.getItem('worklog_students') || '[]'),
    worklog_entries: JSON.parse(localStorage.getItem('worklog_entries') || '[]'),
    marks: JSON.parse(localStorage.getItem('worklog_marks') || '[]'),
    attendance: JSON.parse(localStorage.getItem('worklog_attendance') || '[]'),
    payments: JSON.parse(localStorage.getItem('worklog_payments') || '[]'),
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    await db.collection('users').doc(user.uid).collection('data').doc('worklog').set(data, { merge: true });
    console.log('☁️ Data saved to cloud');
  } catch (error) {
    console.error('❌ Error saving to cloud:', error);
  }
}, 1000);


// Hook into existing save functions
function hookDataSaving() {
  // Override localStorage.setItem to detect changes
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    if (key.startsWith('worklog_') && !key.includes('backup')) {
      saveToCloud();
    }
  };
}

// Initialize cross-device sync
function initSync() {
  hookDataSaving();
  
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('👤 User logged in, starting cross-device sync');
      initCrossDeviceSync();
      // Initial load from cloud
      setTimeout(() => saveToCloud(), 1000);
    } else {
      console.log('👤 No user, sync disabled');
      if (syncUnsubscribe) {
        syncUnsubscribe();
        syncUnsubscribe = null;
      }
    }
  });
}

// ==================== FILE INPUT ====================
function createFileInput() {
  if (document.getElementById('importFileInput')) return;
  
  const input = document.createElement('input');
  input.id = 'importFileInput';
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  
  input.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (confirm('Import data? This will replace current data.')) {
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
  
  document.body.appendChild(input);
}

// ==================== CLOUD FUNCTIONS ====================
async function exportToCloud() {
  if (!navigator.onLine) {
    showNotification('Cannot export while offline', 'error');
    return;
  }
  
  showNotification('Exporting to cloud...', 'info');
  
  if (window.syncService) {
    const user = await window.syncService.getCurrentUser();
    if (!user) {
      showNotification('Please login first', 'error');
      return;
    }
    const result = await window.syncService.sync(true);
    if (result.success) showNotification('Data exported to cloud!', 'success');
  } else {
    showNotification('Cloud export not available', 'warning');
  }
}

async function importFromCloud() {
  if (!confirm('Import from cloud? This will replace local data.')) return;
  
  if (!navigator.onLine) {
    showNotification('Cannot import while offline', 'error');
    return;
  }
  
  showNotification('Importing from cloud...', 'info');
  
  if (window.syncService) {
    const user = await window.syncService.getCurrentUser();
    if (!user) {
      showNotification('Please login first', 'error');
      return;
    }
    const result = await window.syncService.importFromCloud();
    if (result) {
      showNotification('Data imported!', 'success');
      setTimeout(() => location.reload(), 1500);
    }
  } else {
    showNotification('Cloud import not available', 'warning');
  }
}

// ==================== DATA EXPORT/IMPORT ====================
function exportAllData() {
  const data = {
    students: JSON.parse(localStorage.getItem('worklog_students') || '[]'),
    hours: JSON.parse(localStorage.getItem('worklog_hours') || '[]'),
    marks: JSON.parse(localStorage.getItem('worklog_marks') || '[]'),
    attendance: JSON.parse(localStorage.getItem('worklog_attendance') || '[]'),
    payments: JSON.parse(localStorage.getItem('worklog_payments') || '[]'),
    settings: {
      defaultHourlyRate: SimpleRateManager.get(),
      autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
      theme: localStorage.getItem('worklog-theme') || 'dark'
    },
    exportDate: new Date().toISOString()
  };
  
  const dataStr = JSON.stringify(data, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  const fileName = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
  
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = fileName;
  link.click();
  
  showNotification('Data exported!', 'success');
}

function importAllData(data) {
  if (!data || typeof data !== 'object') {
    showNotification('Invalid data format', 'error');
    return;
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
  
  showNotification('Data imported!', 'success');
}

function fixAllStats() {
  showNotification('Fixing statistics...', 'info');
  
  const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
  const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
  
  const fixedHours = hours.map(h => ({
    ...h,
    total: (parseFloat(h.hoursWorked) || 0) * (parseFloat(h.baseRate) || 0)
  }));
  
  const fixedMarks = marks.map(m => {
    const percentage = ((parseFloat(m.marksScore) || 0) / (parseFloat(m.marksMax) || 1) * 100).toFixed(1);
    let grade = 'F';
    const p = parseFloat(percentage);
    if (p >= 90) grade = 'A';
    else if (p >= 80) grade = 'B';
    else if (p >= 70) grade = 'C';
    else if (p >= 60) grade = 'D';
    return { ...m, percentage, grade };
  });
  
  localStorage.setItem('worklog_hours', JSON.stringify(fixedHours));
  localStorage.setItem('worklog_marks', JSON.stringify(fixedMarks));
  
  showNotification('Stats fixed!', 'success');
  loadInitialData();
}

function clearAllData() {
  if (!confirm('⚠️ Delete ALL data? This cannot be undone!')) return;
  if (!confirm('LAST CHANCE: Type "DELETE" to confirm')) return;
  if (prompt('Type DELETE to confirm:') !== 'DELETE') {
    showNotification('Cancelled', 'warning');
    return;
  }
  
  const defaultRate = SimpleRateManager.get();
  const theme = localStorage.getItem('worklog-theme') || 'dark';
  const autoSync = localStorage.getItem('autoSyncEnabled');
  
  localStorage.clear();
  
  localStorage.setItem('defaultHourlyRate', defaultRate);
  localStorage.setItem('worklog-theme', theme);
  if (autoSync) localStorage.setItem('autoSyncEnabled', autoSync);
  
  showNotification('All data cleared!', 'success');
  setTimeout(() => location.reload(), 1500);
}

// ==================== FORM INITIALIZATION ====================
function initForms() {
  const today = new Date().toISOString().split('T')[0];
  ['workDate', 'marksDate', 'attendanceDate', 'paymentDate'].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.value = today;
  });
  
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
        rate: parseFloat(document.getElementById('studentRate').value) || parseFloat(SimpleRateManager.get())
      };
      
      if (!studentData.name || !studentData.studentId) {
        showNotification('Name and Student ID are required!', 'error');
        return;
      }
      
      if (window.formHandler?.handleStudentSubmit) {
        window.formHandler.handleStudentSubmit(studentForm);
      } else {
        saveStudentToLocalStorage(studentData);
      }
    });
  }

    // In your initForms function, add this for marks form:
    const marksForm = document.getElementById('marksForm');
    if (marksForm) {
        marksForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveMark();
        });
    }
    
    // Also set up the cancel button
    const cancelMarkBtn = document.getElementById('cancelMarkBtn');
    if (cancelMarkBtn) {
        cancelMarkBtn.addEventListener('click', cancelMarksEdit);
    }
    
    // Set up percentage calculation
    window.updateMarksPercentage = updateMarksPercentage;
}

function saveStudentToLocalStorage(studentData) {
  try {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    studentData.id = 'student_' + Date.now();
    studentData.createdAt = new Date().toISOString();
    students.push(studentData);
    localStorage.setItem('worklog_students', JSON.stringify(students));
    
    showNotification('Student saved!', 'success');
    document.getElementById('studentForm').reset();
    
    loadStudents();
    updateProfileStats();
    updateGlobalStats();
    refreshAttendanceStudentList();
    
  } catch (error) {
    console.error('Error saving student:', error);
    showNotification('Error saving student', 'error');
  }
}

// ==================== REPORT FUNCTIONS ====================
function initReportButtons() {
  setTimeout(() => {
    const buttons = {
      'weeklyReportBtn': generateWeeklyReport,
      'biWeeklyReportBtn': generateBiWeeklyReport,
      'monthlyReportBtn': generateMonthlyReport,
      'subjectReportBtn': generateSubjectReport,
      'pdfReportBtn': generatePDFReport,
      'emailReportBtn': generateEmailReport
    };
    
    Object.entries(buttons).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', handler);
    });
  }, 500);
}

function loadReports() {
  updateReportStats();
  generateWeeklyBreakdown();
  generateSubjectBreakdown();
}

function updateReportStats() {
  try {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    
    const totalEarnings = hours.reduce((sum, h) => sum + (parseFloat(h.hoursWorked) || 0) * (parseFloat(h.baseRate) || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (parseFloat(p.paymentAmount) || 0), 0);
    const avgMark = marks.length ? marks.reduce((sum, m) => sum + (parseFloat(m.percentage) || 0), 0) / marks.length : 0;
    
    const updates = {
      'totalStudentsReport': students.length,
      'totalHoursReport': hours.reduce((sum, h) => sum + (parseFloat(h.hoursWorked) || 0), 0).toFixed(1),
      'totalEarningsReport': `$${totalEarnings.toFixed(2)}`,
      'avgMarkReport': `${avgMark.toFixed(1)}%`,
      'totalPaymentsReport': `$${totalPayments.toFixed(2)}`,
      'outstandingBalance': `$${(totalEarnings - totalPayments).toFixed(2)}`
    };
    
    Object.entries(updates).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
    
  } catch (error) {
    console.error('Error updating report stats:', error);
  }
}

// ==================== CLIENT/ORGANIZATION MANAGER ====================

function saveOrganization() {
    const name = document.getElementById('clientName')?.value.trim();
    const address = document.getElementById('clientAddress')?.value.trim();
    const phone = document.getElementById('clientPhone')?.value.trim();
    const email = document.getElementById('clientEmail')?.value.trim();
    
    if (!name) {
        showNotification('Organization name is required', 'error');
        return;
    }
    
    let organizations = JSON.parse(localStorage.getItem('worklog_organizations') || '[]');
    
    // Check for duplicate
    const existing = organizations.find(org => org.name === name);
    if (existing) {
        if (!confirm(`Organization "${name}" already exists. Update it?`)) return;
        existing.address = address;
        existing.phone = phone;
        existing.email = email;
    } else {
        organizations.push({
            id: Date.now().toString(),
            name: name,
            address: address,
            phone: phone,
            email: email,
            createdAt: new Date().toISOString()
        });
    }
    
    localStorage.setItem('worklog_organizations', JSON.stringify(organizations));
    loadOrganizations();
    clearClientForm();
    showNotification(`Organization "${name}" saved!`, 'success');
}

function loadOrganizations() {
    const organizations = JSON.parse(localStorage.getItem('worklog_organizations') || '[]');
    const select = document.getElementById('clientSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Select Organization --</option>' +
        organizations.map(org => `<option value="${org.id}">${org.name}</option>`).join('');
    
    console.log(`✅ Loaded ${organizations.length} organizations`);
}

function loadOrganizationToForm() {
    const select = document.getElementById('clientSelect');
    const selectedId = select?.value;
    if (!selectedId) return;
    
    const organizations = JSON.parse(localStorage.getItem('worklog_organizations') || '[]');
    const org = organizations.find(o => o.id === selectedId);
    
    if (org) {
        document.getElementById('clientName').value = org.name;
        document.getElementById('clientAddress').value = org.address || '';
        document.getElementById('clientPhone').value = org.phone || '';
        document.getElementById('clientEmail').value = org.email || '';
        
        // Also fill invoice/claim form fields
        fillReportForms(org);
    }
}

function fillReportForms(org) {
    // Fill invoice form
    const invoiceTo = document.getElementById('invoiceTo');
    if (invoiceTo) {
        invoiceTo.value = `${org.name}\n${org.address || ''}\n${org.phone || ''}\n${org.email || ''}`;
    }
    
    // Fill claim form
    const claimAddress = document.getElementById('claimAddress');
    if (claimAddress) {
        claimAddress.value = org.address || '';
    }
    
    const claimHomePhone = document.getElementById('claimHomePhone');
    if (claimHomePhone && org.phone) {
        claimHomePhone.value = org.phone;
    }
    
    const claimWorkPhone = document.getElementById('claimWorkPhone');
    if (claimWorkPhone && org.phone) {
        claimWorkPhone.value = org.phone;
    }
}

function clearClientForm() {
    document.getElementById('clientName').value = '';
    document.getElementById('clientAddress').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientEmail').value = '';
}

function deleteOrganization() {
    const select = document.getElementById('clientSelect');
    const selectedId = select?.value;
    if (!selectedId) {
        showNotification('Select an organization to delete', 'warning');
        return;
    }
    
    const organizations = JSON.parse(localStorage.getItem('worklog_organizations') || '[]');
    const org = organizations.find(o => o.id === selectedId);
    
    if (!confirm(`Delete "${org.name}"?`)) return;
    
    const filtered = organizations.filter(o => o.id !== selectedId);
    localStorage.setItem('worklog_organizations', JSON.stringify(filtered));
    loadOrganizations();
    clearClientForm();
    showNotification(`Organization "${org.name}" deleted`, 'success');
}

// Add delete button to the HTML
function addDeleteButton() {
    const clientManager = document.querySelector('.client-manager');
    if (clientManager && !document.getElementById('deleteClientBtn')) {
        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'deleteClientBtn';
        deleteBtn.textContent = '🗑️ Delete Selected';
        deleteBtn.className = 'button danger';
        deleteBtn.style.marginLeft = '10px';
        deleteBtn.onclick = deleteOrganization;
        clientManager.querySelector('div:first-child').appendChild(deleteBtn);
    }
}

// Initialize client manager
function initClientManager() {
    loadOrganizations();
    addDeleteButton();
    
    const saveBtn = document.getElementById('saveClientBtn');
    if (saveBtn) {
        saveBtn.onclick = saveOrganization;
    }
    
    const select = document.getElementById('clientSelect');
    if (select) {
        select.onchange = loadOrganizationToForm;
    }
}

// =========== AUTO SAVING FOR REPORTS ===========
// Save the last used organization
function saveLastUsedOrganization(orgId) {
    localStorage.setItem('lastUsedOrganization', orgId);
}

// Auto-load last used organization
function loadLastUsedOrganization() {
    const lastUsedId = localStorage.getItem('lastUsedOrganization');
    if (lastUsedId) {
        const select = document.getElementById('clientSelect');
        if (select) {
            select.value = lastUsedId;
            loadOrganizationToForm();
        }
    }
}

// ==================== USER PROFILE MANAGER ====================

// Save user business info to profile
function saveUserBusinessInfo() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        showNotification('Please login first', 'error');
        return;
    }
    
    const businessInfo = {
        businessName: document.getElementById('profileBusinessName')?.value || '',
        businessAddress: document.getElementById('profileBusinessAddress')?.value || '',
        businessPhone: document.getElementById('profileBusinessPhone')?.value || '',
        businessEmail: document.getElementById('profileBusinessEmail')?.value || '',
        updatedAt: new Date().toISOString()
    };
    
    // Save to localStorage with user-specific key
    const storageKey = `user_profile_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    localStorage.setItem(storageKey, JSON.stringify(businessInfo));
    
    // Also save individual fields for easy access
    localStorage.setItem('invoiceBusinessName', businessInfo.businessName);
    localStorage.setItem('businessAddress', businessInfo.businessAddress);
    localStorage.setItem('businessPhone', businessInfo.businessPhone);
    localStorage.setItem('businessEmail', businessInfo.businessEmail);
    
    showNotification('Business information saved!', 'success');
    
    // Update any open forms
    updateFormsWithUserInfo();
}

function saveBusinessInfo() {
    saveUserBusinessInfo();
}

// ==================== MY BUSINESSES (MULTIPLE PROFILES) ====================
// Save a new business profile
function saveMyBusiness() {
    const name = document.getElementById('myBusinessName')?.value.trim();
    const address = document.getElementById('myBusinessAddress')?.value.trim();
    const phone = document.getElementById('myBusinessPhone')?.value.trim();
    const email = document.getElementById('myBusinessEmail')?.value.trim();
    
    if (!name) {
        showNotification('Business name is required', 'error');
        return;
    }
    
    let myBusinesses = JSON.parse(localStorage.getItem('worklog_my_businesses') || '[]');
    
    // Check for duplicate
    const existing = myBusinesses.find(b => b.name === name);
    if (existing) {
        if (!confirm(`Business "${name}" already exists. Update it?`)) return;
        existing.address = address;
        existing.phone = phone;
        existing.email = email;
    } else {
        myBusinesses.push({
            id: Date.now().toString(),
            name: name,
            address: address,
            phone: phone,
            email: email,
            createdAt: new Date().toISOString()
        });
    }
    
    localStorage.setItem('worklog_my_businesses', JSON.stringify(myBusinesses));
    loadMyBusinesses();
    clearMyBusinessForm();
    showNotification(`Business "${name}" saved!`, 'success');
}

// Load my businesses into dropdown
function loadMyBusinesses() {
    const myBusinesses = JSON.parse(localStorage.getItem('worklog_my_businesses') || '[]');
    const select = document.getElementById('myBusinessSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Select Business Profile --</option>' +
        myBusinesses.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    
    console.log(`✅ Loaded ${myBusinesses.length} business profiles`);
}

// Load selected business into the main profile form
function loadSelectedBusiness() {
    const select = document.getElementById('myBusinessSelect');
    const selectedId = select?.value;
    if (!selectedId) return;
    
    const myBusinesses = JSON.parse(localStorage.getItem('worklog_my_businesses') || '[]');
    const business = myBusinesses.find(b => b.id === selectedId);
    
    if (business) {
        // Fill the business info form
        document.getElementById('profileBusinessName').value = business.name;
        document.getElementById('profileBusinessAddress').value = business.address || '';
        document.getElementById('profileBusinessPhone').value = business.phone || '';
        document.getElementById('profileBusinessEmail').value = business.email || '';
        
        // Also fill the edit form fields for reference
        document.getElementById('myBusinessName').value = business.name;
        document.getElementById('myBusinessAddress').value = business.address || '';
        document.getElementById('myBusinessPhone').value = business.phone || '';
        document.getElementById('myBusinessEmail').value = business.email || '';
        
        showNotification(`Loaded: ${business.name}`, 'success');
    }
}

// Use selected business for invoices and claims
function useSelectedBusiness() {
    const select = document.getElementById('myBusinessSelect');
    const selectedId = select?.value;
    if (!selectedId) {
        showNotification('Select a business first', 'warning');
        return;
    }
    
    const myBusinesses = JSON.parse(localStorage.getItem('worklog_my_businesses') || '[]');
    const business = myBusinesses.find(b => b.id === selectedId);
    
    if (business) {
        // Save as active business
        localStorage.setItem('invoiceBusinessName', business.name);
        localStorage.setItem('businessAddress', business.address || '');
        localStorage.setItem('businessPhone', business.phone || '');
        localStorage.setItem('businessEmail', business.email || '');
        
        // Update the main profile
        const storageKey = `user_profile_${localStorage.getItem('userEmail')?.replace(/[^a-zA-Z0-9]/g, '_') || 'default'}`;
        const userProfile = JSON.parse(localStorage.getItem(storageKey) || '{}');
        userProfile.businessName = business.name;
        userProfile.businessAddress = business.address;
        userProfile.businessPhone = business.phone;
        userProfile.businessEmail = business.email;
        localStorage.setItem(storageKey, JSON.stringify(userProfile));
        
        // Update form fields
        const invoiceBusinessName = document.getElementById('invoiceBusinessName');
        if (invoiceBusinessName) invoiceBusinessName.value = business.name;
        
        showNotification(`Now using: ${business.name} for invoices and claims`, 'success');
    }
}

// Delete a business profile
function deleteMyBusiness() {
    const select = document.getElementById('myBusinessSelect');
    const selectedId = select?.value;
    if (!selectedId) {
        showNotification('Select a business to delete', 'warning');
        return;
    }
    
    let myBusinesses = JSON.parse(localStorage.getItem('worklog_my_businesses') || '[]');
    const business = myBusinesses.find(b => b.id === selectedId);
    
    if (!confirm(`Delete "${business?.name}"? This cannot be undone.`)) return;
    
    myBusinesses = myBusinesses.filter(b => b.id !== selectedId);
    localStorage.setItem('worklog_my_businesses', JSON.stringify(myBusinesses));
    loadMyBusinesses();
    clearMyBusinessForm();
    showNotification(`Business "${business?.name}" deleted`, 'success');
}

// Clear the add business form
function clearMyBusinessForm() {
    document.getElementById('myBusinessName').value = '';
    document.getElementById('myBusinessAddress').value = '';
    document.getElementById('myBusinessPhone').value = '';
    document.getElementById('myBusinessEmail').value = '';
}

// Initialize My Businesses section
function initMyBusinesses() {
    loadMyBusinesses();
    
    const saveBtn = document.getElementById('saveMyBusinessBtn');
    if (saveBtn) {
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.onclick = saveMyBusiness;
    }
    
    const select = document.getElementById('myBusinessSelect');
    if (select) {
        select.onchange = loadSelectedBusiness;
    }
    
    const useBtn = document.getElementById('useSelectedBusinessBtn');
    if (useBtn) {
        const newUseBtn = useBtn.cloneNode(true);
        useBtn.parentNode.replaceChild(newUseBtn, useBtn);
        newUseBtn.onclick = useSelectedBusiness;
    }
    
    const deleteBtn = document.getElementById('deleteMyBusinessBtn');
    if (deleteBtn) {
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        newDeleteBtn.onclick = deleteMyBusiness;
    }
}

// Load user business info into profile form
function loadUserBusinessInfo() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    
    const storageKey = `user_profile_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const savedInfo = localStorage.getItem(storageKey);
    
    if (savedInfo) {
        const businessInfo = JSON.parse(savedInfo);
        document.getElementById('profileBusinessName').value = businessInfo.businessName || '';
        document.getElementById('profileBusinessAddress').value = businessInfo.businessAddress || '';
        document.getElementById('profileBusinessPhone').value = businessInfo.businessPhone || '';
        document.getElementById('profileBusinessEmail').value = businessInfo.businessEmail || '';
    }
    
    // Also load into invoice form
    const invoiceBusinessName = document.getElementById('invoiceBusinessName');
    if (invoiceBusinessName) {
        invoiceBusinessName.value = localStorage.getItem('invoiceBusinessName') || '';
    }
}

// Update all forms with saved user info
function updateFormsWithUserInfo() {
    const businessName = localStorage.getItem('invoiceBusinessName') || '';
    const businessAddress = localStorage.getItem('businessAddress') || '';
    const businessPhone = localStorage.getItem('businessPhone') || '';
    const businessEmail = localStorage.getItem('businessEmail') || '';
    
    // Update invoice form
    const invoiceBusinessNameField = document.getElementById('invoiceBusinessName');
    if (invoiceBusinessNameField) invoiceBusinessNameField.value = businessName;
    
    // Update claim form
    const claimAddress = document.getElementById('claimAddress');
    if (claimAddress && businessAddress) claimAddress.value = businessAddress;
    
    const claimHomePhone = document.getElementById('claimHomePhone');
    if (claimHomePhone && businessPhone) claimHomePhone.value = businessPhone;
    
    const claimWorkPhone = document.getElementById('claimWorkPhone');
    if (claimWorkPhone && businessPhone) claimWorkPhone.value = businessPhone;
    
    // Update profile display
    const profileDefaultRate = document.getElementById('profileDefaultRate');
    if (profileDefaultRate) {
        const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
        profileDefaultRate.textContent = `$${parseFloat(defaultRate).toFixed(2)}/hour`;
    }
}

// Initialize profile business section
function initProfileBusinessSection() {
    loadUserBusinessInfo();
    
    const saveBtn = document.getElementById('saveBusinessInfoBtn');
    if (saveBtn) {
        saveBtn.onclick = saveUserBusinessInfo;
    }
}

// ==================== DATA LOADING FUNCTIONS ====================
function loadInitialData() {
  if (window.formHandler?.initializeStorage) {
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
  
  if (document.getElementById('reports')?.classList.contains('active')) {
    loadReports();
  }
}

// ==================== LOAD STUDENTS (FIXED WITH DATE HANDLING) ====================
function loadStudents() {
  console.log('👥 Loading students...');
  
  const container = document.getElementById('studentsContainer');
  if (!container) return;
  
  // Get students
  let students = window.formHandler?.getStudents?.() || 
                 JSON.parse(localStorage.getItem('worklog_students') || '[]');
  
  // ===== FIX 1: Ensure rate consistency across all students =====
  let studentsFixed = false;
  students = students.map(student => {
    // Check if rate fields are inconsistent
    const rateValue = student.rate || student.hourlyRate;
    const needsRateFix = (student.rate !== student.hourlyRate) || 
                         (rateValue && (!student.rate || !student.hourlyRate));
    
    if (needsRateFix) {
      studentsFixed = true;
      const correctRate = rateValue || SimpleRateManager.get();
      student.rate = correctRate;
      student.hourlyRate = correctRate;
    }
    
    // ===== FIX 2: Fix invalid dates =====
    if (student.createdAt) {
      try {
        // Test if it's a valid date
        const date = new Date(student.createdAt);
        if (isNaN(date.getTime())) {
          // Invalid date - replace with current date
          console.log(`🔄 Fixing invalid date for ${student.name}`);
          student.createdAt = new Date().toISOString();
          studentsFixed = true;
        }
      } catch (e) {
        // Date parsing error - replace with current date
        console.log(`🔄 Fixing date error for ${student.name}`);
        student.createdAt = new Date().toISOString();
        studentsFixed = true;
      }
    } else {
      // Missing createdAt - add it
      console.log(`🔄 Adding missing createdAt for ${student.name}`);
      student.createdAt = new Date().toISOString();
      studentsFixed = true;
    }
    
    return student;
  });
  
  // If we fixed any students, save back to localStorage
  if (studentsFixed) {
    console.log('✅ Fixed student data, saving to localStorage');
    localStorage.setItem('worklog_students', JSON.stringify(students));
    
    // Also update formHandler if it exists
    if (window.formHandler) {
      window.formHandler.students = students;
    }
  }
  // ===== END FIXES =====
  
  // Get saved sort method
  const sortMethod = localStorage.getItem('studentSortMethod') || 'id';
  
  // Apply sorting
  if (sortMethod === 'id') {
    students.sort((a, b) => {
      const getNum = (id) => parseInt((id || '').toString().match(/\d+/)?.[0] || '999999', 10);
      return getNum(a.studentId) - getNum(b.studentId);
    });
  } else if (sortMethod === 'name') {
    students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortMethod === 'date') {
    students.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA; // Newest first
    });
  } else if (sortMethod === 'rate') {
    students.sort((a, b) => (parseFloat(b.rate || b.hourlyRate || 0)) - (parseFloat(a.rate || a.hourlyRate || 0)));
  }
  
  // Update counts
  const countElem = document.getElementById('studentCount');
  if (countElem) countElem.textContent = students.length;
  
  // Update average rate
  const avgRateElem = document.getElementById('averageRate');
  if (avgRateElem) {
    if (students.length) {
      const total = students.reduce((sum, s) => sum + parseFloat(s.rate || s.hourlyRate || 0), 0);
      avgRateElem.textContent = (total / students.length).toFixed(2);
    } else {
      avgRateElem.textContent = '0.00';
    }
  }
  
  // Update sort dropdown
  const sortSelect = document.getElementById('studentSortSelect');
  if (sortSelect) sortSelect.value = sortMethod;
  
  // Get default rate
  const defaultRate = SimpleRateManager.get();
  
  // Display students with SAFE date formatting
  if (!students.length) {
    container.innerHTML = '<p class="empty-message">No students registered yet.</p>';
    return;
  }
  
  container.innerHTML = students.map(student => {
    const studentRate = student.rate || student.hourlyRate;
    const rate = studentRate ? parseFloat(studentRate).toFixed(2) : defaultRate;
    const isUsingDefault = !student.rate && !student.hourlyRate;
    
    // SAFE DATE FORMATTING - FIXES INVALID DATE ISSUE
    let dateStr = 'Unknown';
    if (student.createdAt) {
      try {
        const date = new Date(student.createdAt);
        // Check if it's a valid date
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleDateString();
        } else {
          dateStr = 'Recent';
        }
      } catch (e) {
        dateStr = 'Recent';
      }
    } else {
      dateStr = 'Recent';
    }
    
    return `
      <div class="student-card" data-id="${student.id}" ${isUsingDefault ? 'style="border-left: 3px solid #ffc107;"' : ''}>
        <div class="student-card-header">
          <strong>${student.name || ''}</strong>
          <span class="student-id">${student.studentId || 'No ID'}</span>
          <div class="student-actions">
            <button class="btn-icon edit-student" onclick="editStudent('${student.id}')" title="Edit">✏️</button>
            <button class="btn-icon delete-student" onclick="deleteStudent('${student.id}')" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="student-details">
          <div class="student-rate">
            $${rate}/hour
            ${isUsingDefault ? '<span style="color: #ffc107; font-size: 0.8em; margin-left: 8px;">(default)</span>' : ''}
          </div>
          <div>${student.gender || ''} • ${student.email || 'No email'}</div>
          <div>${student.phone || 'No phone'}</div>
          <div class="student-meta">Added: ${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');
  
  console.log(`✅ Loaded ${students.length} students (sorted by: ${sortMethod})`);
  if (studentsFixed) {
    console.log('🔧 Fixed data issues for some students');
  }

    refreshAttendanceStudentList();
}

function refreshAttendanceStudentList() {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const attendanceContainer = document.getElementById('attendanceStudents');
    
    if (!attendanceContainer) return;
    
    // Sort by ID NUMBER (001, 002, 003...)
    const sortedStudents = [...students].sort((a, b) => {
        const numA = parseInt((a.studentId || '0').toString().replace(/\D/g, '')) || 0;
        const numB = parseInt((b.studentId || '0').toString().replace(/\D/g, '')) || 0;
        return numA - numB;
    });
    
    if (sortedStudents.length === 0) {
        attendanceContainer.innerHTML = '<p class="empty-message">No students registered. Add students in the Students tab first.</p>';
        return;
    }
    
    attendanceContainer.innerHTML = sortedStudents.map(s => `
        <div class="attendance-student-item" style="display: flex; align-items: center; margin-bottom: 8px; padding: 5px;">
            <input type="checkbox" id="att_${s.id}" value="${s.id}" style="margin-right: 8px;">
            <label for="att_${s.id}" style="cursor: pointer;">${s.name} (${s.studentId})</label>
        </div>
    `).join('');
    
    console.log(`✅ Attendance student list refreshed: ${sortedStudents.length} students (sorted by ID number)`);
}

// ==================== OTHER LOAD FUNCTIONS (simplified) ====================
function loadHours() {
  const container = document.getElementById('hoursContainer');
  if (!container) return;
  
  const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
  
  if (!hours.length) {
    container.innerHTML = '<p class="empty-message">No hours logged yet.</p>';
    return;
  }
  
  container.innerHTML = hours.slice(0, 10).map(h => `
    <div class="hours-entry">
      <div class="hours-header">
        <strong>${h.organization}</strong>
        <span class="hours-total">$${(h.total || 0).toFixed(2)}</span>
      </div>
      <div class="hours-details">
        <span>📅 ${new Date(h.workDate).toLocaleDateString()}</span>
        <span>⏱️ ${h.hoursWorked}h</span>
        <span>💰 $${h.baseRate}/hr</span>
      </div>
    </div>
  `).join('');
}

// ==================== MARKS FUNCTIONS WITH EDIT/DELETE ====================
// Load marks with edit/delete buttons
function loadMarks() {
    const container = document.getElementById('marksContainer');
    if (!container) return;
    
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    
    const marksCount = document.getElementById('marksCount');
    if (marksCount) marksCount.textContent = marks.length;
    
    if (!marks.length) {
        container.innerHTML = '<p class="empty-message">No marks recorded yet.</p>';
        return;
    }
    
    // Sort by date using date utility
    const sortedMarks = [...marks].sort((a, b) => {
        return sortDatesDescending(a.marksDate, b.marksDate);
    });
    
    container.innerHTML = sortedMarks.map(mark => {
        const student = students.find(s => s.id === mark.studentId);
        const studentName = student ? `${student.name} (${student.studentId})` : 'Unknown Student';
        
        // Use date utility for display
        const displayDate = formatDisplayDate(mark.marksDate);
        
        return `
            <div class="mark-card" data-id="${mark.id}" style="border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong>📚 ${mark.marksSubject}</strong>
                        <span style="margin-left: 10px; color: #666;">📅 ${displayDate}</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="marks-edit-btn" data-id="${mark.id}" style="background: #4CAF50; color: white; border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer;">✏️ Edit</button>
                        <button class="marks-delete-btn" data-id="${mark.id}" style="background: #f44336; color: white; border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer;">🗑️ Delete</button>
                    </div>
                </div>
                <div style="margin-top: 8px;">
                    <div><strong>Student:</strong> ${studentName}</div>
                    <div><strong>Topic:</strong> ${mark.marksTopic || 'N/A'}</div>
                    <div><strong>Score:</strong> ${mark.marksScore}/${mark.marksMax} = ${mark.percentage}% (${mark.grade})</div>
                    ${mark.marksNotes ? `<div><strong>Notes:</strong> ${mark.marksNotes}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners
    document.querySelectorAll('.marks-edit-btn').forEach(btn => {
        btn.removeEventListener('click', handleMarksEditClick);
        btn.addEventListener('click', handleMarksEditClick);
    });
    
    document.querySelectorAll('.marks-delete-btn').forEach(btn => {
        btn.removeEventListener('click', handleMarksDeleteClick);
        btn.addEventListener('click', handleMarksDeleteClick);
    });
    
    updateAverageMark();
}

function handleMarksEditClick(e) {
    const id = e.target.getAttribute('data-id');
    editMark(id);
}

function handleMarksDeleteClick(e) {
    const id = e.target.getAttribute('data-id');
    deleteMark(id);
}

// Update percentage and grade in real-time
function updateMarksPercentage() {
    const score = parseFloat(document.getElementById('marksScore')?.value);
    const maxScore = parseFloat(document.getElementById('marksMax')?.value);
    
    if (!isNaN(score) && !isNaN(maxScore) && maxScore > 0) {
        const percentage = (score / maxScore * 100).toFixed(1);
        document.getElementById('percentage').value = percentage + '%';
        
        let grade = 'F';
        const p = parseFloat(percentage);
        if (p >= 90) grade = 'A';
        else if (p >= 80) grade = 'B';
        else if (p >= 70) grade = 'C';
        else if (p >= 60) grade = 'D';
        document.getElementById('grade').value = grade;
    } else {
        document.getElementById('percentage').value = '';
        document.getElementById('grade').value = '';
    }
}

// Edit mark
function editMark(markId) {
    console.log('✏️ Editing mark:', markId);
    
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    const mark = marks.find(m => m.id === markId);
    
    if (!mark) {
        showNotification('Mark record not found', 'error');
        return;
    }
    
    // Fill form - use date utility to set the date
    document.getElementById('marksStudent').value = mark.studentId;
    document.getElementById('marksSubject').value = mark.marksSubject;
    document.getElementById('marksTopic').value = mark.marksTopic || '';
    setDateInput('marksDate', mark.marksDate);
    document.getElementById('marksScore').value = mark.marksScore;
    document.getElementById('marksMax').value = mark.marksMax;
    document.getElementById('marksNotes').value = mark.marksNotes || '';
    
    // Update percentage and grade
    updateMarksPercentage();
    
    // Store editing ID
    window.editingMarkId = markId;
    
    // Update save button
    const saveBtn = document.getElementById('marksSubmitBtn');
    if (saveBtn) {
        saveBtn.textContent = '✏️ Update Mark';
        saveBtn.style.backgroundColor = '#f59e0b';
    }
    
    // Show cancel button
    const cancelBtn = document.getElementById('cancelMarkBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'inline-block';
    }
    
    // Scroll to form
    document.getElementById('marksForm').scrollIntoView({ behavior: 'smooth' });
    showNotification('Edit mode: Make changes and click Update', 'info');
}

// Delete mark
function deleteMark(markId) {
    if (!confirm('Delete this mark record? This cannot be undone.')) return;
    
    let marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    marks = marks.filter(m => m.id !== markId);
    localStorage.setItem('worklog_marks', JSON.stringify(marks));
    
    showNotification('Mark record deleted', 'success');
    loadMarks();
    updateProfileStats();
}

// Cancel marks edit
function cancelMarksEdit() {
    window.editingMarkId = null;
    
    const saveBtn = document.getElementById('marksSubmitBtn');
    if (saveBtn) {
        saveBtn.textContent = '➕ Add Mark';
        saveBtn.style.backgroundColor = '';
    }
    
    const cancelBtn = document.getElementById('cancelMarkBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
    
    resetMarksForm();
    showNotification('Edit cancelled', 'info');
}

// Reset marks form
function resetMarksForm() {
    document.getElementById('marksForm').reset();
    setDateInput('marksDate', getTodayDate());
    document.getElementById('percentage').value = '';
    document.getElementById('grade').value = '';
    window.editingMarkId = null;
}

// Update average mark display
function updateAverageMark() {
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    
    if (marks.length === 0) {
        const avgMarksElem = document.getElementById('avgMarks');
        if (avgMarksElem) avgMarksElem.textContent = '0%';
        return;
    }
    
    const totalPercentage = marks.reduce((sum, mark) => sum + (parseFloat(mark.percentage) || 0), 0);
    const avgPercentage = totalPercentage / marks.length;
    
    const avgMarksElem = document.getElementById('avgMarks');
    if (avgMarksElem) avgMarksElem.textContent = `${avgPercentage.toFixed(1)}%`;
    
    console.log(`📊 Average mark updated: ${avgPercentage.toFixed(1)}%`);
}

// Save mark (handles both new and edit)
function saveMark() {
    // Use date utility to get date from input
    const date = getDateFromInput('marksDate');
    const studentId = document.getElementById('marksStudent')?.value;
    const subject = document.getElementById('marksSubject')?.value;
    const topic = document.getElementById('marksTopic')?.value;
    const score = parseFloat(document.getElementById('marksScore')?.value);
    const maxScore = parseFloat(document.getElementById('marksMax')?.value);
    const notes = document.getElementById('marksNotes')?.value;
    
    console.log('Saving mark with date:', date);
    
    if (!studentId) {
        showNotification('Please select a student', 'error');
        return;
    }
    
    if (!subject || !date || isNaN(score) || isNaN(maxScore)) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (maxScore <= 0) {
        showNotification('Max score must be greater than 0', 'error');
        return;
    }
    
    const percentage = (score / maxScore * 100).toFixed(1);
    let grade = 'F';
    const p = parseFloat(percentage);
    if (p >= 90) grade = 'A';
    else if (p >= 80) grade = 'B';
    else if (p >= 70) grade = 'C';
    else if (p >= 60) grade = 'D';
    
    let marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    
    if (window.editingMarkId) {
        const index = marks.findIndex(m => m.id === window.editingMarkId);
        if (index !== -1) {
            marks[index] = {
                ...marks[index],
                studentId: studentId,
                marksSubject: subject,
                marksTopic: topic,
                marksDate: date,
                marksScore: score,
                marksMax: maxScore,
                marksNotes: notes,
                percentage: percentage,
                grade: grade,
                lastUpdated: new Date().toISOString()
            };
            showNotification('Mark updated!', 'success');
        }
        window.editingMarkId = null;
        
        const saveBtn = document.getElementById('marksSubmitBtn');
        if (saveBtn) {
            saveBtn.textContent = '➕ Add Mark';
            saveBtn.style.backgroundColor = '';
        }
        
        const cancelBtn = document.getElementById('cancelMarkBtn');
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
        
    } else {
        const newMark = {
            id: Date.now().toString(),
            studentId: studentId,
            marksSubject: subject,
            marksTopic: topic,
            marksDate: date,
            marksScore: score,
            marksMax: maxScore,
            marksNotes: notes,
            percentage: percentage,
            grade: grade,
            createdAt: new Date().toISOString()
        };
        marks.unshift(newMark);
        showNotification('Mark saved!', 'success');
    }
    
    localStorage.setItem('worklog_marks', JSON.stringify(marks));
    
    resetMarksForm();
    loadMarks();
    updateProfileStats();
}

// ==================== COMPLETE ATTENDANCE SYSTEM ====================
// Load attendance with proper display
function loadAttendance() {
    const container = document.getElementById('attendanceContainer');
    if (!container) return;
    
    const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const attendanceCount = document.getElementById('attendanceCount');
    if (attendanceCount) attendanceCount.textContent = attendance.length;
    
    if (!attendance.length) {
        container.innerHTML = '<p class="empty-message">No attendance records yet.</p>';
        return;
    }
    
    // Sort using date utility
    const sortedAttendance = [...attendance].sort((a, b) => {
        return sortDatesDescending(a.attendanceDate, b.attendanceDate);
    });
    
    container.innerHTML = sortedAttendance.map(record => {
        // Use date utility for display
        const displayDate = formatDisplayDate(record.attendanceDate);
        
        const presentNames = (record.presentStudents || []).map(studentId => {
            const student = students.find(s => s.id === studentId);
            return student ? `${student.name} (${student.studentId})` : 'Unknown';
        });
        
        return `
            <div class="attendance-record" data-id="${record.id}" style="border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong>📚 ${record.attendanceSubject}</strong>
                        <span style="margin-left: 10px; color: #666;">📅 ${displayDate}</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="attendance-edit-btn" data-id="${record.id}" style="background: #4CAF50; color: white; border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer;">✏️ Edit</button>
                        <button class="attendance-delete-btn" data-id="${record.id}" style="background: #f44336; color: white; border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer;">🗑️ Delete</button>
                    </div>
                </div>
                <div style="margin-top: 8px;">👥 <strong>${presentNames.length}</strong> student(s) present</div>
                ${presentNames.length > 0 ? `<div style="font-size: 0.85em; color: #555; margin-top: 5px;">Present: ${presentNames.join(', ')}</div>` : ''}
            </div>
        `;
    }).join('');
    
    // Attach event listeners
    document.querySelectorAll('.attendance-edit-btn').forEach(btn => {
        btn.removeEventListener('click', handleEditClick);
        btn.addEventListener('click', handleEditClick);
    });
    
    document.querySelectorAll('.attendance-delete-btn').forEach(btn => {
        btn.removeEventListener('click', handleDeleteClick);
        btn.addEventListener('click', handleDeleteClick);
    });

    updateLastSessionDisplay();
}

function handleEditClick(e) {
    const id = e.target.getAttribute('data-id');
    editAttendance(id);
}

function handleDeleteClick(e) {
    const id = e.target.getAttribute('data-id');
    deleteAttendance(id);
}

// Edit attendance
function editAttendance(attendanceId) {
    console.log('✏️ Editing attendance:', attendanceId);
    
    const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
    const record = attendance.find(a => a.id === attendanceId);
    
    if (!record) {
        showNotification('Attendance record not found', 'error');
        return;
    }
    
    // Fill form - use the stored date as-is
    document.getElementById('attendanceDate').value = record.attendanceDate;
    document.getElementById('attendanceSubject').value = record.attendanceSubject;
    
    // Reset all checkboxes
    document.querySelectorAll('#attendanceStudents input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Check the students who were present
    const presentIds = record.presentStudents || [];
    document.querySelectorAll('#attendanceStudents input[type="checkbox"]').forEach(cb => {
        if (presentIds.includes(cb.value)) {
            cb.checked = true;
        }
    });
    
    // Store editing ID
    window.editingAttendanceId = attendanceId;
    
    // Update save button
    const saveBtn = document.getElementById('attendanceSubmitBtn');
    if (saveBtn) {
        saveBtn.textContent = '✏️ Update Attendance';
        saveBtn.style.backgroundColor = '#f59e0b';
    }
    
    // Show cancel button
    let cancelBtn = document.getElementById('cancelAttendanceEditBtn');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelAttendanceEditBtn';
        cancelBtn.textContent = '❌ Cancel Edit';
        cancelBtn.style.marginLeft = '10px';
        cancelBtn.style.padding = '10px 20px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.onclick = cancelAttendanceEdit;
        saveBtn.parentNode.appendChild(cancelBtn);
    } else {
        cancelBtn.style.display = 'inline-block';
    }
    
    // Scroll to form
    document.getElementById('attendanceForm').scrollIntoView({ behavior: 'smooth' });
    showNotification('Edit mode: Check/uncheck students, then click Update', 'info');
}

// Delete attendance
function deleteAttendance(attendanceId) {
    if (!confirm('Delete this attendance record?')) return;
    
    let attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
    attendance = attendance.filter(a => a.id !== attendanceId);
    localStorage.setItem('worklog_attendance', JSON.stringify(attendance));
    
    showNotification('Attendance record deleted', 'success');
    loadAttendance();
    updateProfileStats();
    updateLastSessionDisplay();
}

// Cancel edit
function cancelAttendanceEdit() {
    window.editingAttendanceId = null;
    
    const saveBtn = document.getElementById('attendanceSubmitBtn');
    if (saveBtn) {
        saveBtn.textContent = '💾 Save Attendance';
        saveBtn.style.backgroundColor = '';
    }
    
    const cancelBtn = document.getElementById('cancelAttendanceEditBtn');
    if (cancelBtn) {
        cancelBtn.remove();
    }
    
    // Clear form using date utilities
    setDateInput('attendanceDate', getTodayDate());
    document.getElementById('attendanceSubject').value = '';
    document.querySelectorAll('#attendanceStudents input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    showNotification('Edit cancelled', 'info');
}

// Save attendance (handles both new and edit)
function saveAttendance() {
    console.log('💾 Saving attendance...');
    
    // Use date utility to get date from input
    const date = getDateFromInput('attendanceDate');
    const subject = document.getElementById('attendanceSubject')?.value;
    
    if (!date || !subject) {
        showNotification('Date and Subject are required', 'error');
        return;
    }
    
    // Get checked student IDs
    const checkedBoxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]:checked');
    const presentStudentIds = Array.from(checkedBoxes).map(cb => cb.value);
    
    let attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
    
    if (window.editingAttendanceId) {
        // UPDATE existing record
        const index = attendance.findIndex(a => a.id === window.editingAttendanceId);
        if (index !== -1) {
            attendance[index] = {
                ...attendance[index],
                attendanceDate: date,
                attendanceSubject: subject,
                presentStudents: presentStudentIds,
                lastUpdated: new Date().toISOString()
            };
            showNotification('Attendance updated!', 'success');
        }
        
        // Reset edit mode
        window.editingAttendanceId = null;
        
        // Reset save button
        const saveBtn = document.getElementById('attendanceSubmitBtn');
        if (saveBtn) {
            saveBtn.textContent = '💾 Save Attendance';
            saveBtn.style.backgroundColor = '';
        }
        
        // Remove cancel button
        const cancelBtn = document.getElementById('cancelAttendanceEditBtn');
        if (cancelBtn) cancelBtn.remove();
        
    } else {
        // CREATE new record
        const newAttendance = {
            id: Date.now().toString(),
            attendanceDate: date,
            attendanceSubject: subject,
            presentStudents: presentStudentIds,
            createdAt: new Date().toISOString()
        };
        attendance.unshift(newAttendance);
        showNotification('Attendance saved!', 'success');
    }
    
    localStorage.setItem('worklog_attendance', JSON.stringify(attendance));
    
    // Clear form - use date utility for today's date
    setDateInput('attendanceDate', getTodayDate());
    document.getElementById('attendanceSubject').value = '';
    document.querySelectorAll('#attendanceStudents input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    // Refresh display
    loadAttendance();
    updateProfileStats();
    updateLastSessionDisplay();
}

// Update attendance statistics
function updateAttendanceStats() {
    const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
    
    // Sort by date (newest first)
    const sortedAttendance = [...attendance].sort((a, b) => {
        return b.attendanceDate.localeCompare(a.attendanceDate);
    });
    
    const lastSession = sortedAttendance.length > 0 ? sortedAttendance[0].attendanceDate : 'Never';
    const totalSessions = attendance.length;
    
    // Update the UI elements
    const lastSessionElement = document.getElementById('lastAttendanceSession');
    const totalSessionsElement = document.getElementById('totalAttendanceSessions');
    
    if (lastSessionElement) lastSessionElement.textContent = lastSession;
    if (totalSessionsElement) totalSessionsElement.textContent = totalSessions;
    
    console.log(`📊 Attendance stats - Last Session: ${lastSession}, Total: ${totalSessions}`);
}

// Format date for display (YYYY-MM-DD to DD/MM/YYYY)
function formatAttendanceDate(dateString) {
    if (!dateString || dateString === 'Never') return 'Never';
    const parts = dateString.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Update the last session display in attendance header
function updateLastSessionDisplay() {
    const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
    
    if (attendance.length === 0) {
        const lastSessionElement = document.getElementById('lastSessionDate');
        if (lastSessionElement) lastSessionElement.textContent = 'Never';
        return;
    }
    
    // Sort using string comparison (no timezone issues)
    const sortedAttendance = [...attendance].sort((a, b) => {
        return (b.attendanceDate || '').localeCompare(a.attendanceDate || '');
    });
    
    const lastDate = sortedAttendance[0].attendanceDate;
    
    // Use the global date formatter if available
    let formattedDate = lastDate;
    if (typeof window.formatDisplayDate === 'function') {
        formattedDate = window.formatDisplayDate(lastDate);
    } else {
        // Fallback: convert YYYY-MM-DD to DD/MM/YYYY
        const parts = lastDate.split('-');
        if (parts.length === 3) {
            formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    
    const lastSessionElement = document.getElementById('lastSessionDate');
    if (lastSessionElement) {
        lastSessionElement.textContent = formattedDate;
    }
    
    console.log(`✅ Last session updated: ${formattedDate}`);
}

// ==================== PAYMENT FUNCTIONS WITH BALANCE TRACKING ====================
// Load payments and calculate balances
function loadPayments() {
    const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const worklogs = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
    
    // Calculate total earnings from worklogs
    const totalEarnings = worklogs.reduce((sum, entry) => sum + (entry.hours * entry.rate), 0);
    
    // Calculate total payments
    const totalPayments = payments.reduce((sum, p) => sum + p.paymentAmount, 0);
    
    // Calculate outstanding balance
    const outstanding = totalEarnings - totalPayments;
    
    // Calculate this month's payments
    const thisMonth = payments.filter(p => {
        return p.paymentDate && p.paymentDate.startsWith(getTodayDate().substring(0, 7));
    }).reduce((sum, p) => sum + p.paymentAmount, 0);
    
    // Update stats
    const totalStudentsElem = document.getElementById('totalStudentsCount');
    if (totalStudentsElem) totalStudentsElem.textContent = students.length;
    
    const totalOwedElem = document.getElementById('totalOwed');
    if (totalOwedElem) totalOwedElem.textContent = `$${Math.abs(outstanding).toFixed(2)}`;
    
    const monthlyPaymentsElem = document.getElementById('monthlyPayments');
    if (monthlyPaymentsElem) monthlyPaymentsElem.textContent = `$${thisMonth.toFixed(2)}`;
    
    // Display student balances with OWED amounts clearly
    displayStudentBalances(students, payments, worklogs);
    
    // Display payment activity with edit/delete buttons
    displayPaymentActivity(payments);
}

function displayStudentBalances(students, payments, worklogs) {
    const container = document.getElementById('studentBalancesContainer');
    if (!container) return;
    
    if (students.length === 0) {
        container.innerHTML = '<p class="empty-message">No students registered.</p>';
        return;
    }
    
    // Calculate earnings per student from worklogs
    const studentEarnings = {};
    worklogs.forEach(entry => {
        if (entry.type === 'student' && entry.studentId) {
            if (!studentEarnings[entry.studentId]) {
                studentEarnings[entry.studentId] = 0;
            }
            studentEarnings[entry.studentId] += entry.hours * entry.rate;
        }
    });
    
    // Calculate payments per student
    const studentPayments = {};
    payments.forEach(payment => {
        if (!studentPayments[payment.studentId]) {
            studentPayments[payment.studentId] = 0;
        }
        studentPayments[payment.studentId] += payment.paymentAmount;
    });
    
    // Sort students by ID
    const sortedStudents = [...students].sort((a, b) => {
        const numA = parseInt((a.studentId || '0').toString().replace(/\D/g, '')) || 0;
        const numB = parseInt((b.studentId || '0').toString().replace(/\D/g, '')) || 0;
        return numA - numB;
    });
    
    container.innerHTML = sortedStudents.map(student => {
        const earned = studentEarnings[student.id] || 0;
        const paid = studentPayments[student.id] || 0;
        const balance = earned - paid;
        
        let statusClass = '';
        let statusText = '';
        let amountColor = '';
        
        if (balance > 0) {
            statusClass = 'status-owed';
            statusText = '🔴 OWES';
            amountColor = '#f44336';
        } else if (balance < 0) {
            statusClass = 'status-credit';
            statusText = '🟢 CREDIT';
            amountColor = '#4CAF50';
        } else {
            statusClass = 'status-paid';
            statusText = '✅ PAID IN FULL';
            amountColor = '#666';
        }
        
        return `
            <div class="balance-card" style="border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 8px; background: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <strong>${student.name}</strong>
                        <span style="color: #666; font-size: 0.85em;"> (${student.studentId})</span>
                    </div>
                    <div style="font-weight: bold; color: ${amountColor}; font-size: 1.1em;">
                        ${statusText}: $${Math.abs(balance).toFixed(2)}
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.85em; color: #666;">
                    <span>💰 Earned: $${earned.toFixed(2)}</span>
                    <span>💵 Paid: $${paid.toFixed(2)}</span>
                    <span>📊 Owed: $${balance > 0 ? balance.toFixed(2) : '0.00'}</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Add total summary at the top
    const totalOwed = sortedStudents.reduce((sum, student) => {
        const earned = studentEarnings[student.id] || 0;
        const paid = studentPayments[student.id] || 0;
        return sum + (earned - paid);
    }, 0);
    
    const summaryHTML = `
        <div style="background: #f0f0f0; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><strong>📊 TOTAL OUTSTANDING:</strong></span>
                <span style="font-size: 1.2em; font-weight: bold; color: ${totalOwed > 0 ? '#f44336' : '#4CAF50'};">$${Math.abs(totalOwed).toFixed(2)} ${totalOwed > 0 ? 'owed' : 'credit'}</span>
            </div>
        </div>
    `;
    
    container.innerHTML = summaryHTML + container.innerHTML;
}

function displayPaymentActivity(payments) {
    const container = document.getElementById('paymentActivityLog');
    if (!container) return;
    
    if (payments.length === 0) {
        container.innerHTML = '<p class="empty-message">No recent payment activity.</p>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedPayments = [...payments].sort((a, b) => {
        return (b.paymentDate || '').localeCompare(a.paymentDate || '');
    });
    
    container.innerHTML = sortedPayments.map(payment => {
        const displayDate = formatDisplayDate(payment.paymentDate);
        return `
            <div class="payment-item" data-id="${payment.id}" style="border-bottom: 1px solid #eee; padding: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 2;">
                    <div><strong>${payment.studentName || 'Unknown'}</strong></div>
                    <div style="font-size: 0.85em; color: #666;">${displayDate} • ${payment.paymentMethod || 'Cash'}</div>
                    ${payment.notes ? `<div style="font-size: 0.8em; color: #888;">📝 ${payment.notes}</div>` : ''}
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: bold; color: #4CAF50; font-size: 1.1em;">+$${payment.paymentAmount.toFixed(2)}</div>
                    <div style="margin-top: 8px;">
                        <button class="payment-edit-btn" data-id="${payment.id}" style="background: #4CAF50; color: white; border: none; border-radius: 4px; padding: 5px 12px; margin-right: 5px; cursor: pointer;">✏️ Edit</button>
                        <button class="payment-delete-btn" data-id="${payment.id}" style="background: #f44336; color: white; border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer;">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners
    document.querySelectorAll('.payment-edit-btn').forEach(btn => {
        btn.removeEventListener('click', handlePaymentEditClick);
        btn.addEventListener('click', handlePaymentEditClick);
    });
    
    document.querySelectorAll('.payment-delete-btn').forEach(btn => {
        btn.removeEventListener('click', handlePaymentDeleteClick);
        btn.addEventListener('click', handlePaymentDeleteClick);
    });
}

function handlePaymentEditClick(e) {
    const id = e.target.getAttribute('data-id');
    editPayment(id);
}

function handlePaymentDeleteClick(e) {
    const id = e.target.getAttribute('data-id');
    deletePayment(id);
}

// Save payment (handles both new and edit)
function savePayment() {
    console.log('💾 Saving payment...');
    
    const studentId = document.getElementById('paymentStudent')?.value;
    const amount = parseFloat(document.getElementById('paymentAmount')?.value);
    const date = getDateFromInput('paymentDate');
    const method = document.getElementById('paymentMethod')?.value;
    const notes = document.getElementById('paymentNotes')?.value;
    
    if (!studentId) {
        showNotification('Please select a student', 'error');
        return;
    }
    
    if (isNaN(amount) || amount <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }
    
    if (!date) {
        showNotification('Please select a date', 'error');
        return;
    }
    
    // Get student name
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const student = students.find(s => s.id === studentId);
    const studentName = student ? student.name : 'Unknown';
    
    let payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    
    if (window.editingPaymentId) {
        // UPDATE existing record
        const index = payments.findIndex(p => p.id === window.editingPaymentId);
        if (index !== -1) {
            payments[index] = {
                ...payments[index],
                studentId: studentId,
                studentName: studentName,
                paymentAmount: amount,
                paymentDate: date,
                paymentMethod: method,
                notes: notes,
                lastUpdated: new Date().toISOString()
            };
            showNotification('Payment updated!', 'success');
        }
        window.editingPaymentId = null;
        
        const saveBtn = document.getElementById('paymentSubmitBtn');
        if (saveBtn) {
            saveBtn.textContent = '💰 Record Payment';
            saveBtn.style.backgroundColor = '';
        }
        
        const cancelBtn = document.getElementById('cancelPaymentBtn');
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
        
    } else {
        // CREATE new record
        const newPayment = {
            id: Date.now().toString(),
            studentId: studentId,
            studentName: studentName,
            paymentAmount: amount,
            paymentDate: date,
            paymentMethod: method || 'Cash',
            notes: notes || '',
            createdAt: new Date().toISOString()
        };
        payments.unshift(newPayment);
        showNotification('Payment recorded!', 'success');
    }
    
    localStorage.setItem('worklog_payments', JSON.stringify(payments));
    
    resetPaymentForm();
    loadPayments();
    updateProfileStats();
    updateGlobalStats();
}

// Edit payment
function editPayment(paymentId) {
    console.log('✏️ Editing payment:', paymentId);
    
    const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    const payment = payments.find(p => p.id === paymentId);
    
    if (!payment) {
        showNotification('Payment record not found', 'error');
        return;
    }
    
    // Fill form
    document.getElementById('paymentStudent').value = payment.studentId;
    document.getElementById('paymentAmount').value = payment.paymentAmount;
    setDateInput('paymentDate', payment.paymentDate);
    document.getElementById('paymentMethod').value = payment.paymentMethod || 'Cash';
    document.getElementById('paymentNotes').value = payment.notes || '';
    
    // Store editing ID
    window.editingPaymentId = paymentId;
    
    // Update save button
    const saveBtn = document.getElementById('paymentSubmitBtn');
    if (saveBtn) {
        saveBtn.textContent = '✏️ Update Payment';
        saveBtn.style.backgroundColor = '#f59e0b';
    }
    
    // Show cancel button
    const cancelBtn = document.getElementById('cancelPaymentBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'inline-block';
    }
    
    // Scroll to form
    document.getElementById('paymentForm').scrollIntoView({ behavior: 'smooth' });
    showNotification('Edit mode: Make changes and click Update', 'info');
}

// Delete payment
function deletePayment(paymentId) {
    if (!confirm('Delete this payment record? This cannot be undone.')) return;
    
    let payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    payments = payments.filter(p => p.id !== paymentId);
    localStorage.setItem('worklog_payments', JSON.stringify(payments));
    
    showNotification('Payment record deleted', 'success');
    loadPayments();
    updateProfileStats();
    updateGlobalStats();
}

// Reset payment form
function resetPaymentForm() {
    document.getElementById('paymentForm').reset();
    setDateInput('paymentDate', getTodayDate());
    window.editingPaymentId = null;
    
    const saveBtn = document.getElementById('paymentSubmitBtn');
    if (saveBtn) {
        saveBtn.textContent = '💰 Record Payment';
        saveBtn.style.backgroundColor = '';
    }
    
    const cancelBtn = document.getElementById('cancelPaymentBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
}

// Cancel payment edit
function cancelPaymentEdit() {
    window.editingPaymentId = null;
    resetPaymentForm();
    showNotification('Edit cancelled', 'info');
}

// Populate payment student dropdown
function populatePaymentStudentDropdown() {
    const select = document.getElementById('paymentStudent');
    if (!select) return;
    
    let students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const sortedStudents = [...students].sort((a, b) => {
        const numA = parseInt((a.studentId || '0').toString().replace(/\D/g, '')) || 0;
        const numB = parseInt((b.studentId || '0').toString().replace(/\D/g, '')) || 0;
        return numA - numB;
    });
    
    select.innerHTML = '<option value="">Select Student</option>' + 
        sortedStudents.map(s => `<option value="${s.id}">${s.name} (${s.studentId})</option>`).join('');
}

// Initialize payment form
function initPaymentForm() {
    populatePaymentStudentDropdown();
    resetPaymentForm();
    
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            savePayment();
        });
    }
    
    const cancelBtn = document.getElementById('cancelPaymentBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelPaymentEdit);
    }
}

// ==================== HELPER FUNCTIONS ====================
function populateStudentDropdowns() {
    let students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    
    // Sort students by ID number (001, 002, 003...)
    const sortedStudents = [...students].sort((a, b) => {
        const numA = parseInt((a.studentId || '0').toString().replace(/\D/g, '')) || 0;
        const numB = parseInt((b.studentId || '0').toString().replace(/\D/g, '')) || 0;
        return numA - numB;
    });
    
    console.log('Populating dropdowns with students sorted by ID:', sortedStudents.map(s => s.studentId));
    
    // Marks student dropdown
    const marksStudent = document.getElementById('marksStudent');
    if (marksStudent) {
        marksStudent.innerHTML = '<option value="">Select Student</option>' + 
            sortedStudents.map(s => `<option value="${s.id}">${s.name} (${s.studentId})</option>`).join('');
        console.log('Marks dropdown populated with', sortedStudents.length, 'students (sorted by ID)');
    }
    
    // Hours student dropdown
    const hoursStudent = document.getElementById('hoursStudent');
    if (hoursStudent) {
        hoursStudent.innerHTML = '<option value="">Select Student</option>' + 
            sortedStudents.map(s => `<option value="${s.id}">${s.name} (${s.studentId})</option>`).join('');
    }
    
    // Payment student dropdown
    const paymentStudent = document.getElementById('paymentStudent');
    if (paymentStudent) {
        paymentStudent.innerHTML = '<option value="">Select Student</option>' + 
            sortedStudents.map(s => `<option value="${s.id}">${s.name} (${s.studentId})</option>`).join('');
    }
    
    refreshAttendanceStudentList();
}

function updateGlobalStats() {
  console.log('📈 Updating global stats...');
  
  // Get data from all sources
  const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
  const worklogs = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  
  // Calculate total hours from both sources
  const hoursFromHoursTab = hours.reduce((sum, hour) => sum + (parseFloat(hour.hoursWorked) || 0), 0);
  const hoursFromWorklog = worklogs.reduce((sum, entry) => sum + (parseFloat(entry.duration) || 0), 0);
  
  // Combined total hours
  const totalHours = hoursFromHoursTab + hoursFromWorklog;
  
  // Calculate average rate from students
  let avgRate = 0;
  if (students.length > 0) {
    const totalRate = students.reduce((sum, student) => sum + (parseFloat(student.rate || student.hourlyRate || 0)), 0);
    avgRate = totalRate / students.length;
  }
  
  // Update UI elements
  const studentCountElem = document.getElementById('statStudents');
  const hoursElem = document.getElementById('statHours');
  const avgRateElem = document.getElementById('averageRate');
  
  if (studentCountElem) studentCountElem.textContent = students.length;
  if (hoursElem) hoursElem.textContent = totalHours.toFixed(1);
  if (avgRateElem) avgRateElem.textContent = avgRate.toFixed(2);
  
  console.log(`📊 Global stats updated - Students: ${students.length}, Hours: ${totalHours.toFixed(1)}`);
}

function showNotification(message, type = 'info') {
  console.log(`🔔 ${type}: ${message}`);
  
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();
  
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
  
  setTimeout(() => notification.classList.add('notification-show'), 10);
  
  const timer = setTimeout(() => {
    notification.classList.remove('notification-show');
    notification.classList.add('notification-hide');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
  
  notification.querySelector('.notification-close').addEventListener('click', () => {
    clearTimeout(timer);
    notification.classList.remove('notification-show');
    notification.classList.add('notification-hide');
    setTimeout(() => notification.remove(), 300);
  });
}

// ==================== REPORT GENERATION FUNCTIONS ====================
// Helper: Get start of week (Monday)
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper: Format date nicely
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Helper: Get all data for reports
function getReportData() {
  return {
    students: JSON.parse(localStorage.getItem('worklog_students') || '[]'),
    worklogs: JSON.parse(localStorage.getItem('worklog_entries') || '[]'),
    hours: JSON.parse(localStorage.getItem('worklog_hours') || '[]'),
    marks: JSON.parse(localStorage.getItem('worklog_marks') || '[]'),
    payments: JSON.parse(localStorage.getItem('worklog_payments') || '[]')
  };
}

// Generate Weekly Breakdown
function generateWeeklyBreakdown() {
  const { worklogs, hours } = getReportData();
  const allEntries = [...worklogs, ...hours];
  
  if (allEntries.length === 0) {
    showNotification('No data available for weekly breakdown', 'warning');
    return;
  }
  
  // Group by week
  const weeklyData = {};
  allEntries.forEach(entry => {
    const date = entry.date || entry.workDate;
    if (!date) return;
    
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { hours: 0, earnings: 0, subjects: new Set(), weekStart };
    }
    
    const hoursWorked = parseFloat(entry.duration || entry.hoursWorked || 0);
    const rate = parseFloat(entry.rate || entry.baseRate || 0);
    const earnings = hoursWorked * rate;
    
    weeklyData[weekKey].hours += hoursWorked;
    weeklyData[weekKey].earnings += earnings;
    if (entry.subject) weeklyData[weekKey].subjects.add(entry.subject);
  });
  
  // Display in report-content container
  const container = document.getElementById('report-content');
  if (!container) return;
  
  const weeks = Object.keys(weeklyData).sort().reverse();
  if (weeks.length === 0) {
    container.innerHTML = '<p class="empty-message">No weekly data available</p>';
    return;
  }
  
  let html = '<div class="report-display"><h4>📅 Weekly Breakdown</h4><table class="table"><thead><tr><th>Week</th><th>Hours</th><th>Earnings</th><th>Subjects</th><th>Net (80%)</th></tr></thead><tbody>';
  
  weeks.slice(0, 10).forEach(weekKey => {
    const week = weeklyData[weekKey];
    const net = week.earnings * 0.8;
    html += `<tr>
      <td>${formatDate(week.weekStart)}</td>
      <td>${week.hours.toFixed(1)}</td>
      <td>$${week.earnings.toFixed(2)}</td>
      <td>${week.subjects.size}</td>
      <td>$${net.toFixed(2)}</td>
    </tr>`;
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// Generate Subject Breakdown
function generateSubjectBreakdown() {
  const { worklogs, hours, marks } = getReportData();
  const allEntries = [...worklogs, ...hours];
  
  if (allEntries.length === 0) {
    showNotification('No data available for subject breakdown', 'warning');
    return;
  }
  
  // Group by subject
  const subjectData = {};
  allEntries.forEach(entry => {
    const subject = entry.subject || 'General';
    if (!subjectData[subject]) {
      subjectData[subject] = { hours: 0, earnings: 0, sessions: 0, marks: [] };
    }
    
    const hoursWorked = parseFloat(entry.duration || entry.hoursWorked || 0);
    const rate = parseFloat(entry.rate || entry.baseRate || 0);
    
    subjectData[subject].hours += hoursWorked;
    subjectData[subject].earnings += hoursWorked * rate;
    subjectData[subject].sessions += 1;
  });
  
  // Add marks data
  marks.forEach(mark => {
    const subject = mark.marksSubject;
    if (subjectData[subject]) {
      subjectData[subject].marks.push(parseFloat(mark.percentage) || 0);
    }
  });
  
  // Calculate averages
  Object.keys(subjectData).forEach(subject => {
    if (subjectData[subject].marks.length > 0) {
      const avgMark = subjectData[subject].marks.reduce((a, b) => a + b, 0) / subjectData[subject].marks.length;
      subjectData[subject].avgMark = avgMark.toFixed(1);
    } else {
      subjectData[subject].avgMark = 'N/A';
    }
  });
  
  // Display
  const container = document.getElementById('report-content');
  if (!container) return;
  
  const subjects = Object.keys(subjectData).sort();
  if (subjects.length === 0) {
    container.innerHTML = '<p class="empty-message">No subject data available</p>';
    return;
  }
  
  let html = '<div class="report-display"><h4>📚 Subject Breakdown</h4><table class="table"><thead><tr><th>Subject</th><th>Hours</th><th>Earnings</th><th>Sessions</th><th>Avg Mark</th></tr></thead><tbody>';
  
  subjects.forEach(subject => {
    const data = subjectData[subject];
    html += `<tr>
      <td><strong>${subject}</strong></td>
      <td>${data.hours.toFixed(1)}</td>
      <td>$${data.earnings.toFixed(2)}</td>
      <td>${data.sessions}</td>
      <td>${data.avgMark === 'N/A' ? '—' : data.avgMark + '%'}</td>
    </tr>`;
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// Generate Weekly Report
function generateWeeklyReport() {
  generateWeeklyBreakdown();
  showNotification('Weekly report generated', 'success');
}

// Generate Bi-Weekly Report
function generateBiWeeklyReport() {
  const { worklogs, hours } = getReportData();
  const allEntries = [...worklogs, ...hours];
  
  if (allEntries.length === 0) {
    showNotification('No data available', 'warning');
    return;
  }
  
  // Group by 2-week periods
  const biWeeklyData = {};
  allEntries.forEach(entry => {
    const date = entry.date || entry.workDate;
    if (!date) return;
    
    const d = new Date(date);
    const weekNum = Math.floor(d.getTime() / (1000 * 60 * 60 * 24 * 14));
    const periodKey = weekNum.toString();
    
    if (!biWeeklyData[periodKey]) {
      biWeeklyData[periodKey] = { hours: 0, earnings: 0, startDate: d };
    }
    
    const hoursWorked = parseFloat(entry.duration || entry.hoursWorked || 0);
    const rate = parseFloat(entry.rate || entry.baseRate || 0);
    
    biWeeklyData[periodKey].hours += hoursWorked;
    biWeeklyData[periodKey].earnings += hoursWorked * rate;
  });
  
  const container = document.getElementById('report-content');
  if (!container) return;
  
  let html = '<div class="report-display"><h4>📅 Bi-Weekly Report</h4><table class="table"><thead><tr><th>Period Start</th><th>Hours</th><th>Earnings</th><th>Net (80%)</th></tr></thead><tbody>';
  
  Object.values(biWeeklyData).slice(0, 10).forEach(period => {
    const net = period.earnings * 0.8;
    html += `<tr>
      <td>${formatDate(period.startDate)}</td>
      <td>${period.hours.toFixed(1)}</td>
      <td>$${period.earnings.toFixed(2)}</td>
      <td>$${net.toFixed(2)}</td>
    </tr>`;
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
  showNotification('Bi-weekly report generated', 'success');
}

// Generate Monthly Report
function generateMonthlyReport() {
  const { worklogs, hours } = getReportData();
  const allEntries = [...worklogs, ...hours];
  
  if (allEntries.length === 0) {
    showNotification('No data available', 'warning');
    return;
  }
  
  // Group by month
  const monthlyData = {};
  allEntries.forEach(entry => {
    const date = entry.date || entry.workDate;
    if (!date) return;
    
    const d = new Date(date);
    const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { hours: 0, earnings: 0, month: d };
    }
    
    const hoursWorked = parseFloat(entry.duration || entry.hoursWorked || 0);
    const rate = parseFloat(entry.rate || entry.baseRate || 0);
    
    monthlyData[monthKey].hours += hoursWorked;
    monthlyData[monthKey].earnings += hoursWorked * rate;
  });
  
  const container = document.getElementById('report-content');
  if (!container) return;
  
  let html = '<div class="report-display"><h4>📅 Monthly Report</h4><table class="table"><thead><tr><th>Month</th><th>Hours</th><th>Earnings</th><th>Net (80%)</th></tr></thead><tbody>';
  
  Object.values(monthlyData).slice(0, 12).forEach(month => {
    const net = month.earnings * 0.8;
    html += `<tr>
      <td>${month.month.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</td>
      <td>${month.hours.toFixed(1)}</td>
      <td>$${month.earnings.toFixed(2)}</td>
      <td>$${net.toFixed(2)}</td>
    </tr>`;
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
  showNotification('Monthly report generated', 'success');
}

// Generate Subject Report
function generateSubjectReport() {
  generateSubjectBreakdown();
  showNotification('Subject report generated', 'success');
}

// Generate PDF Report
function generatePDFReport() {
  const container = document.getElementById('report-content');
  if (!container || container.innerHTML.includes('No data')) {
    showNotification('Generate a report first before exporting to PDF', 'warning');
    return;
  }
  
  const printWindow = window.open('', '_blank');
  const styles = document.querySelector('style').innerHTML;
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WorkLog Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #2563eb; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>WorkLog Report</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      ${container.innerHTML}
      <p class="no-print"><button onclick="window.print()">Print</button></p>
    </body>
    </html>
  `);
  
  printWindow.document.close();
  showNotification('PDF report opened', 'success');
}

// Generate Email Report
function generateEmailReport() {
  const container = document.getElementById('report-content');
  if (!container || container.innerHTML.includes('No data')) {
    showNotification('Generate a report first before emailing', 'warning');
    return;
  }
  
  const reportContent = container.innerText;
  const subject = encodeURIComponent('WorkLog Report');
  const body = encodeURIComponent(reportContent + '\n\nGenerated: ' + new Date().toLocaleString());
  
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  showNotification('Email client opened', 'success');
}

// ==================== INITIALIZE SORTING ====================
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    const sortSelect = document.getElementById('studentSortSelect');
    if (sortSelect) {
      sortSelect.value = localStorage.getItem('studentSortMethod') || 'id';
      sortSelect.addEventListener('change', (e) => window.changeStudentSort(e.target.value));
    }
  }, 1000);
});

// ==================== START APP ====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initApp, 300));
} else {
  setTimeout(initApp, 300);
}

console.log('✅ App initialization script loaded');
