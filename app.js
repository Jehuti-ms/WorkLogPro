// ==================== GLOBAL VARIABLES ====================
let appInitialized = false;
let redirectInProgress = false;
let currentEditId = null;
let autoSyncInterval = null;

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
    loadInitialData();
    
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
    const defaultRate = SimpleRateManager.get();
    
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
    
    // Hide all tab contents
    tabContents.forEach(tab => {
      tab.style.display = 'none';
      tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show the selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
      selectedTab.style.display = 'block';
      selectedTab.classList.add('active');
      console.log(`✅ Showing ${tabName} tab`);
    }
    
    // Activate the clicked tab button
    const activeButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }
    
    // Update URL hash
    window.location.hash = tabName;
    
    // Load tab data
    loadTabData(tabName);
  }
  
  // Add click handlers to all tab buttons
  tabButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Check URL hash for initial tab
  const hash = window.location.hash.replace('#', '');
  const initialTab = hash && document.getElementById(hash) ? hash : 'students';
  
  // Show initial tab
  setTimeout(() => {
    switchTab(initialTab);
  }, 100);
  
  // Make switchTab globally available
  window.switchTab = switchTab;
  
  console.log('✅ Tabs initialized');
}

function loadTabData(tabName) {
  console.log(`📊 Loading data for ${tabName} tab...`);
  
  setTimeout(() => {
    switch(tabName) {
      case 'students':
        if (typeof loadStudents === 'function') loadStudents();
        break;
      case 'worklog':
        if (window.worklogManager) {
          window.worklogManager.loadData();
          window.worklogManager.populateDropdowns();
          window.worklogManager.updateUI();
          window.worklogManager.updateStats();
        }
        break;
      case 'marks':
        if (typeof loadMarks === 'function') loadMarks();
        populateMarksStudentDropdown();
        break;
      case 'attendance':
        if (typeof loadAttendance === 'function') loadAttendance();
        populateAttendanceStudents();
        break;
      case 'payments':
        if (typeof loadPayments === 'function') loadPayments();
        populatePaymentStudentDropdown();
        if (typeof updatePaymentBalances === 'function') updatePaymentBalances();
        break;
      case 'reports':
        if (typeof loadReports === 'function') loadReports();
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
      'fabAddPayment': 'payments'
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

function loadMarks() {
  const container = document.getElementById('marksContainer');
  if (!container) return;
  
  const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
  document.getElementById('marksCount') && (document.getElementById('marksCount').textContent = marks.length);
  
  if (!marks.length) {
    container.innerHTML = '<p class="empty-message">No marks recorded yet.</p>';
    return;
  }
  
  container.innerHTML = marks.slice(0, 10).map(m => `
    <div class="mark-entry">
      <div class="mark-header">
        <strong>${m.marksSubject}</strong>
        <span class="hours-total">${m.percentage}% (${m.grade})</span>
      </div>
      <div class="hours-details">
        <span>📅 ${new Date(m.marksDate).toLocaleDateString()}</span>
        <span>📊 ${m.marksScore}/${m.marksMax}</span>
      </div>
    </div>
  `).join('');
}

function loadAttendance() {
  const container = document.getElementById('attendanceContainer');
  if (!container) return;
  
  const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
  document.getElementById('attendanceCount') && (document.getElementById('attendanceCount').textContent = attendance.length);
  
  if (!attendance.length) {
    container.innerHTML = '<p class="empty-message">No attendance records yet.</p>';
    return;
  }
  
  container.innerHTML = attendance.slice(0, 5).map(a => `
    <div class="attendance-entry">
      <div class="attendance-header">
        <strong>${a.attendanceSubject}</strong>
        <span>📅 ${new Date(a.attendanceDate).toLocaleDateString()}</span>
      </div>
      <div>👥 ${a.presentStudents?.length || 0} students present</div>
    </div>
  `).join('');
}

function loadPayments() {
  const container = document.getElementById('paymentActivityLog');
  if (!container) return;
  
  const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
  
  if (!payments.length) {
    container.innerHTML = '<p class="empty-message">No payments yet.</p>';
    return;
  }
  
  container.innerHTML = payments.slice(0, 10).map(p => `
    <div class="payment-item">
      <div class="payment-header">
        <span><strong>Payment</strong> (${p.paymentMethod})</span>
        <span class="payment-amount success">$${p.paymentAmount}</span>
      </div>
      <div class="payment-meta">📅 ${new Date(p.paymentDate).toLocaleDateString()}</div>
    </div>
  `).join('');
}

// ==================== HELPER FUNCTIONS ====================
function populateStudentDropdowns() {
  const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  
  ['hoursStudent', 'marksStudent', 'paymentStudent'].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">Select Student</option>' + 
      students.map(s => `<option value="${s.id}">${s.name} (${s.studentId})</option>`).join('');
  });
  
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (attendanceContainer) {
    if (!students.length) {
      attendanceContainer.innerHTML = '<p class="empty-message">No students registered.</p>';
    } else {
      attendanceContainer.innerHTML = students.map(s => `
        <div class="attendance-student-item">
          <input type="checkbox" id="student_${s.id}" value="${s.id}">
          <label for="student_${s.id}">${s.name} (${s.studentId})</label>
        </div>
      `).join('');
    }
  }
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

// ==================== GENERATE FUNCTIONS (placeholders) ====================
function generateWeeklyBreakdown() { /* ... */ }
function generateSubjectBreakdown() { /* ... */ }
function getWeekStart(date) { /* ... */ }
function formatDate(date) { /* ... */ }
function generateWeeklyReport() { alert('Weekly report'); }
function generateBiWeeklyReport() { alert('Bi-weekly report'); }
function generateMonthlyReport() { alert('Monthly report'); }
function generateSubjectReport() { alert('Subject report'); }
function generatePDFReport() { alert('PDF report'); }
function generateEmailReport() { alert('Email report'); }

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
