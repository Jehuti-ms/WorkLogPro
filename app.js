// app.js - WorkLog Pro Application
// Student Tracker & Hours Management System

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let isOnline = navigator.onLine;
let syncInterval = null;
let autoSyncEnabled = false;
let currentEditId = null;

// ==================== INITIALIZATION ====================
async function initApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  try {
    // Check online status
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Setup auth listener
    await setupAuthListener();
    
    // Initialize UI components
    setupTabNavigation();
    setupForms();
    setupEventListeners();
    setupProfileModal();
    setupFloatingAddButton();
    setupSyncControls();
    
    // Set default rate from localStorage
    const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
    updateElementText('currentDefaultRateDisplay', defaultRate);
    updateElementText('currentDefaultRate', defaultRate);
    setInputValue('defaultBaseRate', defaultRate);
    
    // Load initial data
    await loadAllData();
    
    console.log('✅ App initialized successfully');
  } catch (error) {
    console.error('❌ App initialization error:', error);
    showNotification('Error initializing app. Please refresh.', 'error');
  }
}

// ==================== UTILITY FUNCTIONS ====================
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
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <span class="notification-icon">${getNotificationIcon(type)}</span>
    <span class="notification-text">${message}</span>
    <button class="notification-close">&times;</button>
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Show with animation
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
  
  // Close button
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.classList.remove('show');
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

// ==================== TAB NAVIGATION ====================
function setupTabNavigation() {
  console.log("📋 Setting up tab navigation...");
  
  const tabButtons = document.querySelectorAll('.tab');
  
  if (tabButtons.length === 0) {
    console.error('No tab buttons found!');
    return;
  }
  
  // Add click events to tabs
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Check for URL hash or default to students
  const hash = window.location.hash.replace('#', '');
  const validTabs = ['students', 'hours', 'marks', 'attendance', 'payments', 'reports'];
  
  if (hash && validTabs.includes(hash)) {
    switchTab(hash);
  } else {
    switchTab('students');
  }
  
  console.log("✅ Tab navigation setup complete");
}

function switchTab(tabName) {
  console.log("📋 Switching to tab:", tabName);
  
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
  
  // Update URL hash
  window.location.hash = tabName;
  
  // Load data for this tab
  loadTabData(tabName);
  
  // Close FAB if open
  closeFAB();
}

async function loadTabData(tabName) {
  try {
    console.log(`📊 Loading data for ${tabName} tab...`);
    
    switch(tabName) {
      case 'students':
        await loadStudents();
        break;
      case 'hours':
        await loadHours();
        break;
      case 'marks':
        await loadMarks();
        break;
      case 'attendance':
        await loadAttendance();
        break;
      case 'payments':
        await loadPayments();
        break;
      case 'reports':
        await loadReports();
        break;
    }
  } catch (error) {
    console.error(`Error loading ${tabName} data:`, error);
    showNotification(`Error loading ${tabName} data`, 'error');
  }
}

// ==================== FLOATING ACTION BUTTON ====================
function setupFloatingAddButton() {
  console.log("🔄 Setting up Floating Action Button...");
  
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');
  
  if (!fab || !fabMenu || !fabOverlay) {
    console.error('❌ FAB elements not found');
    return;
  }
  
  // Toggle FAB menu
  fab.addEventListener('click', function(e) {
    e.stopPropagation();
    const isOpen = fabMenu.classList.contains('active');
    
    if (isOpen) {
      closeFAB();
    } else {
      fabMenu.classList.add('active');
      fabOverlay.classList.add('active');
      fab.innerHTML = '×';
      fab.style.transform = 'rotate(45deg)';
    }
  });
  
  // Close when clicking overlay
  fabOverlay.addEventListener('click', closeFAB);
  
  // Close when clicking outside
  document.addEventListener('click', function(e) {
    if (fabMenu.classList.contains('active') && 
        !fab.contains(e.target) && 
        !fabMenu.contains(e.target)) {
      closeFAB();
    }
  });
  
  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && fabMenu.classList.contains('active')) {
      closeFAB();
    }
  });
  
  // Setup FAB menu items
  setupFABMenuItems();
  
  console.log("✅ FAB setup complete");
}

function setupFABMenuItems() {
  // Add Student
  document.getElementById('fabAddStudent')?.addEventListener('click', function() {
    closeFAB();
    switchTab('students');
    setTimeout(() => document.getElementById('studentName')?.focus(), 100);
  });
  
  // Log Hours
  document.getElementById('fabAddHours')?.addEventListener('click', function() {
    closeFAB();
    switchTab('hours');
    setTimeout(() => document.getElementById('organization')?.focus(), 100);
  });
  
  // Add Mark
  document.getElementById('fabAddMark')?.addEventListener('click', function() {
    closeFAB();
    switchTab('marks');
    setTimeout(() => document.getElementById('marksStudent')?.focus(), 100);
  });
  
  // Take Attendance
  document.getElementById('fabAddAttendance')?.addEventListener('click', function() {
    closeFAB();
    switchTab('attendance');
    setTimeout(() => document.getElementById('attendanceDate')?.focus(), 100);
  });
  
  // Add Payment button if not exists
  if (!document.getElementById('fabAddPayment')) {
    const fabAddPayment = document.createElement('button');
    fabAddPayment.id = 'fabAddPayment';
    fabAddPayment.className = 'fab-item';
    fabAddPayment.innerHTML = '<span class="icon">💰</span>Record Payment';
    fabAddPayment.addEventListener('click', function() {
      closeFAB();
      switchTab('payments');
      setTimeout(() => document.getElementById('paymentStudent')?.focus(), 100);
    });
    
    const fabMenu = document.getElementById('fabMenu');
    if (fabMenu) fabMenu.appendChild(fabAddPayment);
  }
}

function closeFAB() {
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');
  
  fabMenu.classList.remove('active');
  fabOverlay.classList.remove('active');
  if (fab) {
    fab.innerHTML = '+';
    fab.style.transform = 'rotate(0deg)';
  }
}

// ==================== FORM SETUP ====================
function setupForms() {
  console.log("📝 Setting up forms...");
  
  // Student Form
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
    document.getElementById('studentSubmitBtn').addEventListener('click', () => studentForm.requestSubmit());
  }
  
  // Hours Form
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
    // Recalculate total when hours or rate changes
    document.getElementById('hoursWorked')?.addEventListener('input', calculateTotalPay);
    document.getElementById('baseRate')?.addEventListener('input', calculateTotalPay);
  }
  
  // Marks Form
  const marksForm = document.getElementById('marksForm');
  if (marksForm) {
    marksForm.addEventListener('submit', handleMarksSubmit);
  }
  
  // Attendance Form
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', handleAttendanceSubmit);
  }
  
  // Payment Form
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmit);
  }
  
  console.log("✅ Forms setup complete");
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  console.log("🎯 Setting up event listeners...");
  
  // Theme toggle
  const themeToggle = document.querySelector('.theme-toggle button');
  if (themeToggle) {
    // Set initial theme
    const savedTheme = localStorage.getItem('worklog-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.className = savedTheme;
    themeToggle.textContent = savedTheme === 'dark' ? '🌓' : '🌞';
    
    themeToggle.addEventListener('click', function() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      document.body.className = newTheme;
      localStorage.setItem('worklog-theme', newTheme);
      themeToggle.textContent = newTheme === 'dark' ? '🌓' : '🌞';
    });
  }
  
  // Student search
  const studentSearch = document.getElementById('studentSearch');
  if (studentSearch) {
    studentSearch.addEventListener('input', debounce(searchStudents, 300));
  }
  
  // Auto-fill today's date in forms
  const today = new Date().toISOString().split('T')[0];
  ['workDate', 'marksDate', 'attendanceDate', 'paymentDate'].forEach(id => {
    const element = document.getElementById(id);
    if (element && !element.value) {
      element.value = today;
    }
  });
  
  // Default rate functions
  document.getElementById('defaultBaseRate')?.addEventListener('change', function() {
    localStorage.setItem('defaultHourlyRate', this.value || '25.00');
  });
  
  console.log("✅ Event listeners setup complete");
}

// ==================== SYNC CONTROLS ====================
function setupSyncControls() {
  console.log("☁️ Setting up sync controls...");
  
  // Sync button
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', handleSyncClick);
  }
  
  // Auto-sync checkbox
  const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
  if (autoSyncCheckbox) {
    autoSyncCheckbox.addEventListener('change', function() {
      autoSyncEnabled = this.checked;
      if (autoSyncEnabled) {
        startAutoSync();
        showNotification('Auto-sync enabled (every 30 seconds)', 'success');
      } else {
        stopAutoSync();
        showNotification('Auto-sync disabled', 'warning');
      }
    });
    
    // Load auto-sync preference
    autoSyncEnabled = localStorage.getItem('autoSyncEnabled') === 'true';
    autoSyncCheckbox.checked = autoSyncEnabled;
    if (autoSyncEnabled) startAutoSync();
  }
  
  // Export/Import buttons
  document.getElementById('exportDataBtn')?.addEventListener('click', exportAllData);
  document.getElementById('importDataBtn')?.addEventListener('click', () => document.getElementById('importDataInput')?.click());
  document.getElementById('clearDataBtn')?.addEventListener('click', confirmClearAllData);
  
  console.log("✅ Sync controls setup complete");
}

function startAutoSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(async () => {
    if (isOnline && currentUser) {
      await syncAllData();
    }
  }, 30000); // 30 seconds
  localStorage.setItem('autoSyncEnabled', 'true');
}

function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  localStorage.setItem('autoSyncEnabled', 'false');
}

// ==================== PROFILE MODAL ====================
function setupProfileModal() {
  console.log("👤 Setting up profile modal...");
  
  const profileBtn = document.getElementById('profileBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileModal = document.getElementById('closeProfileModal');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (profileBtn && profileModal) {
    profileBtn.addEventListener('click', function() {
      updateProfileInfo();
      profileModal.style.display = 'block';
    });
  }
  
  if (closeProfileModal) {
    closeProfileModal.addEventListener('click', function() {
      profileModal.style.display = 'none';
    });
  }
  
  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === profileModal) {
      profileModal.style.display = 'none';
    }
  });
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to logout?')) {
        handleLogout();
      }
    });
  }
  
  console.log("✅ Profile modal setup complete");
}

async function updateProfileInfo() {
  try {
    const user = currentUser || getCurrentUser();
    if (!user) return;
    
    // Update user info
    updateElementText('profileUserEmail', user.email || 'N/A');
    updateElementText('userName', user.displayName || user.email.split('@')[0]);
    
    // Update usage stats
    const students = getStudents();
    const hours = getHours();
    
    // Calculate totals
    const totalHours = hours.reduce((sum, hour) => sum + (parseFloat(hour.hoursWorked) || 0), 0);
    const totalEarnings = hours.reduce((sum, hour) => {
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const baseRate = parseFloat(hour.baseRate) || 0;
      return sum + (hoursWorked * baseRate);
    }, 0);
    
    // Update modal stats
    updateElementText('modalStatStudents', students.length);
    updateElementText('modalStatHours', totalHours.toFixed(1));
    updateElementText('modalStatEarnings', totalEarnings.toFixed(2));
    updateElementText('modalStatUpdated', new Date().toLocaleTimeString());
    
  } catch (error) {
    console.error('Error updating profile info:', error);
  }
}

// ==================== ONLINE/OFFLINE STATUS ====================
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  const syncIndicator = document.getElementById('syncIndicator');
  
  if (syncIndicator) {
    if (isOnline) {
      syncIndicator.innerHTML = '🌐 Online';
      syncIndicator.className = 'sync-status online';
    } else {
      syncIndicator.innerHTML = '📴 Offline';
      syncIndicator.className = 'sync-status offline';
      showNotification('You are offline. Changes will be saved locally.', 'warning');
    }
  }
}

// ==================== FORM HANDLERS ====================
async function handleStudentSubmit(e) {
  e.preventDefault();
  console.log('📝 Handling student submission...');
  
  try {
    const studentData = {
      id: currentEditId || generateId(),
      name: document.getElementById('studentName').value.trim(),
      studentId: document.getElementById('studentId').value.trim(),
      gender: document.getElementById('studentGender').value,
      email: document.getElementById('studentEmail').value.trim(),
      phone: document.getElementById('studentPhone').value.trim(),
      rate: parseFloat(document.getElementById('studentRate').value) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Validate required fields
    if (!studentData.name || !studentData.studentId || !studentData.gender) {
      showNotification('Please fill in all required fields (Name, ID, Gender)', 'error');
      return;
    }
    
    // Save student
    await saveStudent(studentData);
    
    // Reset form
    document.getElementById('studentForm').reset();
    currentEditId = null;
    document.getElementById('studentCancelBtn').style.display = 'none';
    document.getElementById('studentSubmitBtn').textContent = '➕ Add Student';
    
    // Reload students list
    await loadStudents();
    
    showNotification(`Student ${currentEditId ? 'updated' : 'added'} successfully!`, 'success');
    
  } catch (error) {
    console.error('Error saving student:', error);
    showNotification('Error saving student. Please try again.', 'error');
  }
}

function calculateTotalPay() {
  const hours = parseFloat(document.getElementById('hoursWorked')?.value) || 0;
  const rate = parseFloat(document.getElementById('baseRate')?.value) || 0;
  const total = hours * rate;
  const totalPayElement = document.getElementById('totalPay');
  
  if (totalPayElement) {
    totalPayElement.textContent = `$${total.toFixed(2)}`;
  }
}

// ==================== DATA LOADING FUNCTIONS ====================
async function loadStudents() {
  try {
    const students = getStudents();
    const container = document.getElementById('studentsContainer');
    
    if (!container) return;
    
    if (students.length === 0) {
      container.innerHTML = '<p class="empty-message">No students registered yet.</p>';
      updateElementText('studentCount', '0');
      return;
    }
    
    // Calculate average rate
    const avgRate = students.length > 0 
      ? (students.reduce((sum, s) => sum + (parseFloat(s.rate) || 0), 0) / students.length).toFixed(2)
      : '0.00';
    
    updateElementText('averageRate', avgRate);
    updateElementText('studentCount', students.length.toString());
    
    // Render students
    container.innerHTML = students.map(student => `
      <div class="student-card" data-id="${student.id}">
        <div class="student-header">
          <h4>${student.name}</h4>
          <span class="student-id">ID: ${student.studentId}</span>
        </div>
        <div class="student-details">
          <p><strong>Gender:</strong> ${student.gender}</p>
          <p><strong>Rate:</strong> $${student.rate || '0.00'}/session</p>
          ${student.email ? `<p><strong>Email:</strong> ${student.email}</p>` : ''}
          ${student.phone ? `<p><strong>Phone:</strong> ${student.phone}</p>` : ''}
        </div>
        <div class="student-actions">
          <button class="btn-edit" onclick="editStudent('${student.id}')">✏️ Edit</button>
          <button class="btn-delete" onclick="deleteStudent('${student.id}')">🗑️ Delete</button>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading students:', error);
    showNotification('Error loading students', 'error');
  }
}

async function loadHours() {
  try {
    const hours = getHours();
    const container = document.getElementById('hoursContainer');
    
    if (!container) return;
    
    if (hours.length === 0) {
      container.innerHTML = '<p class="empty-message">No work logged yet.</p>';
      return;
    }
    
    // Sort by date (newest first)
    hours.sort((a, b) => new Date(b.workDate) - new Date(a.workDate));
    
    // Render hours
    container.innerHTML = hours.map(hour => `
      <div class="hours-card" data-id="${hour.id}">
        <div class="hours-header">
          <h4>${hour.organization}</h4>
          <span class="hours-date">${formatDate(hour.workDate)}</span>
        </div>
        <div class="hours-details">
          <p><strong>Hours:</strong> ${hour.hoursWorked} @ $${hour.baseRate}/hr</p>
          <p><strong>Total:</strong> $${(parseFloat(hour.hoursWorked) * parseFloat(hour.baseRate)).toFixed(2)}</p>
          ${hour.workSubject ? `<p><strong>Subject:</strong> ${hour.workSubject}</p>` : ''}
          ${hour.hoursNotes ? `<p><strong>Notes:</strong> ${hour.hoursNotes}</p>` : ''}
        </div>
        <div class="hours-actions">
          <button class="btn-edit" onclick="editHours('${hour.id}')">✏️ Edit</button>
          <button class="btn-delete" onclick="deleteHours('${hour.id}')">🗑️ Delete</button>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading hours:', error);
    showNotification('Error loading work hours', 'error');
  }
}

// ==================== HELPER FUNCTIONS ====================
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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// ==================== DATA STORAGE FUNCTIONS ====================
async function saveStudent(student) {
  try {
    const students = getStudents();
    
    if (currentEditId) {
      // Update existing student
      const index = students.findIndex(s => s.id === currentEditId);
      if (index !== -1) {
        students[index] = { ...students[index], ...student, updatedAt: new Date().toISOString() };
      }
    } else {
      // Add new student
      students.push(student);
    }
    
    localStorage.setItem('worklog_students', JSON.stringify(students));
    
    // Sync with Firebase if online
    if (isOnline && currentUser) {
      await syncToFirebase('students', students);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving student:', error);
    throw error;
  }
}

function getStudents() {
  try {
    return JSON.parse(localStorage.getItem('worklog_students') || '[]');
  } catch (error) {
    console.error('Error getting students:', error);
    return [];
  }
}

// ==================== AUTH FUNCTIONS ====================
async function setupAuthListener() {
  console.log('🔐 Setting up auth listener...');
  
  try {
    // Listen for auth state changes
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        console.log('✅ User authenticated:', user.email);
        
        // Update UI with user info
        updateElementText('userName', user.displayName || user.email.split('@')[0]);
        updateElementText('profileUserEmail', user.email);
        
        // Sync data from Firebase
        if (isOnline) {
          await syncFromFirebase();
          showNotification('Data synced from cloud', 'success');
        }
        
      } else {
        // No user, redirect to login
        console.log('❌ No user authenticated, redirecting to login...');
        window.location.href = 'auth.html';
      }
    });
    
  } catch (error) {
    console.error('Auth setup error:', error);
    window.location.href = 'auth.html';
  }
}

function getCurrentUser() {
  return firebase.auth().currentUser;
}

async function handleLogout() {
  try {
    // Stop auto-sync
    stopAutoSync();
    
    // Sign out from Firebase
    await firebase.auth().signOut();
    
    // Clear local data (optional - you might want to keep it)
    // localStorage.clear();
    
    // Redirect to login
    window.location.href = 'auth.html';
    
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Error during logout', 'error');
  }
}

// ==================== SYNC FUNCTIONS ====================
async function handleSyncClick() {
  try {
    if (!isOnline) {
      showNotification('Cannot sync while offline', 'error');
      return;
    }
    
    if (!currentUser) {
      showNotification('Please login to sync', 'error');
      return;
    }
    
    showNotification('Syncing data...', 'info');
    await syncAllData();
    showNotification('Sync completed successfully!', 'success');
    
  } catch (error) {
    console.error('Sync error:', error);
    showNotification('Sync failed. Please try again.', 'error');
  }
}

async function syncAllData() {
  console.log('🔄 Syncing all data...');
  
  try {
    if (!currentUser) return;
    
    // Get all local data
    const students = getStudents();
    const hours = getHours();
    const marks = getMarks();
    const attendance = getAttendance();
    const payments = getPayments();
    
    // Sync each data type to Firebase
    await syncToFirebase('students', students);
    await syncToFirebase('hours', hours);
    await syncToFirebase('marks', marks);
    await syncToFirebase('attendance', attendance);
    await syncToFirebase('payments', payments);
    
    // Update sync status
    updateSyncStatus(true);
    
  } catch (error) {
    console.error('Sync error:', error);
    updateSyncStatus(false);
    throw error;
  }
}

function updateSyncStatus(success) {
  const syncIndicator = document.getElementById('syncIndicator');
  if (syncIndicator) {
    if (success) {
      syncIndicator.innerHTML = '✅ Synced';
      syncIndicator.className = 'sync-status success';
    } else {
      syncIndicator.innerHTML = '❌ Sync Failed';
      syncIndicator.className = 'sync-status error';
    }
    
    // Reset after 5 seconds
    setTimeout(() => {
      if (isOnline) {
        syncIndicator.innerHTML = '🌐 Online';
        syncIndicator.className = 'sync-status online';
      }
    }, 5000);
  }
}

// ==================== START APPLICATION ====================
// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM already loaded
  initApp();
}

// Export functions that need to be accessible from HTML
window.switchTab = switchTab;
window.closeFAB = closeFAB;
window.useDefaultRate = useDefaultRate;
window.useDefaultRateInHours = useDefaultRateInHours;
window.selectAllStudents = selectAllStudents;
window.clearStudentForm = clearStudentForm;
window.clearAttendanceForm = clearAttendanceForm;
window.resetHoursForm = resetHoursForm;
window.resetMarksForm = resetMarksForm;
window.resetPaymentForm = resetPaymentForm;
window.updateMarksPercentage = updateMarksPercentage;
window.saveDefaultRate = saveDefaultRate;
window.applyDefaultRateToAll = applyDefaultRateToAll;

// Helper functions for inline HTML
function useDefaultRate() {
  const studentRateField = document.getElementById('studentRate');
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  
  if (studentRateField && defaultBaseRateInput) {
    studentRateField.value = defaultBaseRateInput.value;
  }
}

function useDefaultRateInHours() {
  const baseRateInput = document.getElementById('baseRate');
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  
  if (baseRateInput && defaultBaseRateInput) {
    baseRateInput.value = defaultBaseRateInput.value;
  }
}

function selectAllStudents() {
  const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = true);
}

function clearStudentForm() {
  const form = document.getElementById('studentForm');
  if (form) {
    form.reset();
    currentEditId = null;
    document.getElementById('studentCancelBtn').style.display = 'none';
    document.getElementById('studentSubmitBtn').textContent = '➕ Add Student';
  }
}

function clearAttendanceForm() {
  const form = document.getElementById('attendanceForm');
  if (form) {
    form.reset();
    const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    document.getElementById('attendanceDate').value = new Date().toISOString().split('T')[0];
  }
}

function resetHoursForm() {
  const form = document.getElementById('hoursForm');
  if (form) {
    form.reset();
    document.getElementById('workDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('totalPay').textContent = '$0.00';
  }
}

function resetMarksForm() {
  const form = document.getElementById('marksForm');
  if (form) {
    form.reset();
    document.getElementById('marksDate').value = new Date().toISOString().split('T')[0];
  }
}

function resetPaymentForm() {
  const form = document.getElementById('paymentForm');
  if (form) {
    form.reset();
    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
  }
}

function updateMarksPercentage() {
  const scoreField = document.getElementById('marksScore');
  const maxField = document.getElementById('marksMax');
  const percentageField = document.getElementById('percentage');
  const gradeField = document.getElementById('grade');
  
  if (scoreField && maxField && percentageField && gradeField) {
    const score = parseFloat(scoreField.value) || 0;
    const max = parseFloat(maxField.value) || 1;
    const percentage = max > 0 ? (score / max) * 100 : 0;
    
    percentageField.value = percentage.toFixed(1) + '%';
    
    // Calculate grade
    let grade = 'F';
    if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';
    
    gradeField.value = grade;
  }
}

function saveDefaultRate() {
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  const currentDefaultRateDisplay = document.getElementById('currentDefaultRateDisplay');
  const currentDefaultRate = document.getElementById('currentDefaultRate');
  
  if (defaultBaseRateInput && currentDefaultRateDisplay && currentDefaultRate) {
    const rate = parseFloat(defaultBaseRateInput.value) || 25.00;
    localStorage.setItem('defaultHourlyRate', rate.toString());
    currentDefaultRateDisplay.textContent = rate.toFixed(2);
    currentDefaultRate.textContent = rate.toFixed(2);
    showNotification('Default rate saved!', 'success');
  }
}

function applyDefaultRateToAll() {
  const defaultRate = parseFloat(document.getElementById('defaultBaseRate').value) || 25.00;
  const students = getStudents();
  
  if (students.length === 0) {
    showNotification('No students to update', 'warning');
    return;
  }
  
  if (confirm(`Apply default rate of $${defaultRate} to all ${students.length} students?`)) {
    const updatedStudents = students.map(student => ({
      ...student,
      rate: defaultRate,
      updatedAt: new Date().toISOString()
    }));
    
    localStorage.setItem('worklog_students', JSON.stringify(updatedStudents));
    loadStudents();
    showNotification(`Applied default rate to ${students.length} students`, 'success');
  }
}

console.log('📦 app.js loaded successfully');
