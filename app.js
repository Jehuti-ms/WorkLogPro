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
      handleStudentSubmit();
    });
  }
  
  // Initialize hours form
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
    hoursForm.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('Hours form submitted');
      handleHoursSubmit();
    });
    
    // Auto-calculate total pay
    const hoursWorkedInput = document.getElementById('hoursWorked');
    const baseRateInput = document.getElementById('baseRate');
    
    if (hoursWorkedInput && baseRateInput) {
      const calculateTotal = () => {
        const hours = parseFloat(hoursWorkedInput.value) || 0;
        const rate = parseFloat(baseRateInput.value) || 0;
        const total = hours * rate;
        const totalPayElement = document.getElementById('totalPay');
        if (totalPayElement) {
          totalPayElement.textContent = `$${total.toFixed(2)}`;
        }
      };
      
      hoursWorkedInput.addEventListener('input', calculateTotal);
      baseRateInput.addEventListener('input', calculateTotal);
    }
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
  
  // Sync button
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', function() {
      console.log('Sync button clicked');
      // Add sync logic here
    });
  }
  
  // Auto-sync checkbox and label
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
    });
  }
}

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
  
  // Load students
  loadStudents();
  
  // Load hours
  loadHours();
  
  // Load marks
  loadMarks();
  
  // Load attendance
  loadAttendance();
  
  // Load payments
  loadPayments();
  
  // Update global stats
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

function loadMarks() {
  console.log('📝 Loading marks...');
  
  const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
  const container = document.getElementById('marksContainer');
  
  if (!container) return;
  
  if (marks.length === 0) {
    container.innerHTML = '<p class="empty-message">No marks recorded yet.</p>';
    return;
  }
  
  // Update count
  const countElem = document.getElementById('marksCount');
  if (countElem) countElem.textContent = marks.length;
}

function loadAttendance() {
  console.log('✅ Loading attendance...');
  
  const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
  const container = document.getElementById('attendanceContainer');
  
  if (!container) return;
  
  if (attendance.length === 0) {
    container.innerHTML = '<p class="empty-message">No attendance records yet.</p>';
    return;
  }
  
  // Update count
  const countElem = document.getElementById('attendanceCount');
  if (countElem) countElem.textContent = attendance.length;
}

function loadPayments() {
  console.log('💰 Loading payments...');
  
  const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
  const container = document.getElementById('paymentActivityLog');
  
  if (!container) return;
  
  if (payments.length === 0) {
    container.innerHTML = '<p class="empty-message">No recent payment activity.</p>';
    return;
  }
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

// ==================== FORM HANDLERS (Placeholders) ====================
function handleStudentSubmit() {
  console.log('Handling student submission...');
  // Add your student form handling logic here
}

function handleHoursSubmit() {
  console.log('Handling hours submission...');
  // Add your hours form handling logic here
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
