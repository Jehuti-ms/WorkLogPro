// ===========================
// PAYMENT MANAGEMENT FUNCTIONS (CONTINUED) - WITH SAFETY CHECKS
// ===========================

function cancelEditPayment() {
  console.log('❌ Cancelling payment edit...');
  
  currentEditPaymentId = null;
  
  const form = document.getElementById('paymentForm');
  if (form) {
    form.reset();
  }
  
  const submitBtn = document.querySelector('#paymentForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Record Payment';
  }
  
  const cancelBtn = document.querySelector('#paymentForm button[type="button"]');
  if (cancelBtn) {
    cancelBtn.remove();
  }
  
  // FIX: Add safety check for NotificationSystem
  if (window.NotificationSystem) {
    window.NotificationSystem.notifyInfo('Edit cancelled');
  } else {
    console.log('ℹ️ Edit cancelled');
  }
}

async function deletePayment(id) {
  if (!confirm('Are you sure you want to delete this payment?')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) return;

    const payments = await EnhancedCache.loadCollection('payments');
    const entry = payments.find(p => p.id === id);
    
    if (entry && entry._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "payments", entry._firebaseId));
    }

    const updatedPayments = payments.filter(p => p.id !== id);
    cache.payments = updatedPayments;
    EnhancedCache.saveToLocalStorageBulk('payments', updatedPayments);

    await renderPaymentActivityWithEdit();
    await renderStudentBalancesWithEdit();
    
    // FIX: Refresh stats after deletion
    EnhancedStats.forceRefresh();
    
    NotificationSystem.notifySuccess('Payment deleted successfully');
    
  } catch (error) {
    console.error('Error deleting payment:', error);
    NotificationSystem.notifyError('Failed to delete payment');
  }
}

function quickAddPayment(studentName) {
  console.log(`💰 Quick add payment for: ${studentName}`);
  
  const paymentStudentSelect = document.getElementById('paymentStudent');
  if (paymentStudentSelect) {
    paymentStudentSelect.value = studentName;
    
    const paymentTab = document.querySelector('[data-tab="payments"]');
    if (paymentTab) {
      paymentTab.click();
      
      setTimeout(() => {
        const paymentAmount = document.getElementById('paymentAmount');
        if (paymentAmount) {
          paymentAmount.focus();
        }
      }, 300);
    }
  }
  
  NotificationSystem.notifyInfo(`Quick payment mode for ${studentName}`);
}

async function handlePaymentSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const formData = new FormData(e.target);
  
  const paymentData = {
    student: formData.get('paymentStudent'),
    amount: safeNumber(formData.get('paymentAmount')),
    method: formData.get('paymentMethod'),
    date: formData.get('paymentDate'),
    dateIso: fmtDateISO(formData.get('paymentDate')),
    notes: formData.get('paymentNotes')
  };

  try {
    if (currentEditPaymentId) {
      const payments = await EnhancedCache.loadCollection('payments');
      const entryIndex = payments.findIndex(p => p.id === currentEditPaymentId);
      
      if (entryIndex !== -1) {
        const existingEntry = payments[entryIndex];
        paymentData.id = currentEditPaymentId;
        paymentData._firebaseId = existingEntry._firebaseId;
        paymentData._synced = existingEntry._synced;
        
        if (existingEntry._firebaseId) {
          await updateDoc(doc(db, "users", user.uid, "payments", existingEntry._firebaseId), paymentData);
        }
        
        payments[entryIndex] = { ...payments[entryIndex], ...paymentData };
        cache.payments = payments;
        EnhancedCache.saveToLocalStorageBulk('payments', payments);
        
        NotificationSystem.notifySuccess('Payment updated successfully');
        currentEditPaymentId = null;
        
        const submitBtn = document.querySelector('#paymentForm button[type="submit"]');
        submitBtn.textContent = 'Record Payment';
        const cancelBtn = document.querySelector('#paymentForm button[type="button"]');
        if (cancelBtn) cancelBtn.remove();
        
        e.target.reset();
      }
    } else {
      await EnhancedCache.saveWithBackgroundSync('payments', paymentData);
      FormAutoClear.handleSuccess('paymentForm', { paymentStudent: paymentData.student });
    }
    
    // FIX: Refresh stats after save/update
    EnhancedStats.forceRefresh();
    await renderPaymentActivityWithEdit();
    await renderStudentBalancesWithEdit();
    
  } catch (error) {
    console.error('Error saving payment:', error);
    NotificationSystem.notifyError('Failed to save payment');
  }
}

// ===========================
// STUDENT MANAGEMENT FUNCTIONS (FIXED)
// ===========================

async function editStudent(id) {
  console.log(`✏️ Starting edit for student: ${id}`);
  
  try {
    const students = await EnhancedCache.loadCollection('students');
    const student = students.find(s => s.id === id);
    
    if (!student) {
      NotificationSystem.notifyError('Student not found');
      return;
    }

    currentEditStudentId = id;
    
    document.getElementById('studentName').value = student.name || '';
    document.getElementById('studentEmail').value = student.email || '';
    document.getElementById('studentPhone').value = student.phone || '';
    document.getElementById('studentGender').value = student.gender || '';
    document.getElementById('studentRate').value = student.rate || '';
    
    const submitBtn = document.querySelector('#studentForm button[type="submit"]');
    // FIX: Remove existing cancel button before adding new one
    const existingCancelBtn = document.querySelector('#studentForm button[type="button"]');
    if (existingCancelBtn) {
      existingCancelBtn.remove();
    }
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel Edit';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.onclick = cancelEditStudent;
    
    submitBtn.textContent = 'Update Student';
    submitBtn.parentNode.appendChild(cancelBtn);
    
    NotificationSystem.notifyInfo('Edit mode activated. Update the form and click "Update Student"');
    
  } catch (error) {
    console.error('Error starting student edit:', error);
    NotificationSystem.notifyError('Failed to start editing');
  }
}

function cancelEditStudent() {
  console.log('❌ Cancelling student edit...');
  
  currentEditStudentId = null;
  
  const form = document.getElementById('studentForm');
  if (form) {
    form.reset();
  }
  
  const submitBtn = document.querySelector('#studentForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Add Student';
  }
  
  const cancelBtn = document.querySelector('#studentForm button[type="button"]');
  if (cancelBtn) {
    cancelBtn.remove();
  }
  
  NotificationSystem.notifyInfo('Edit cancelled');
}

async function deleteStudent(id) {
  if (!confirm('Are you sure you want to delete this student?')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) return;

    const students = await EnhancedCache.loadCollection('students');
    const student = students.find(s => s.id === id);
    
    if (student && student._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "students", student._firebaseId));
    }

    const updatedStudents = students.filter(s => s.id !== id);
    cache.students = updatedStudents;
    EnhancedCache.saveToLocalStorageBulk('students', updatedStudents);

    await renderStudents();
    
    // FIX: Refresh stats after deletion
    EnhancedStats.forceRefresh();
    
    // FIX: Refresh student dropdowns after deletion
    await StudentDropdownManager.forceRefresh();
    
    NotificationSystem.notifySuccess('Student deleted successfully');
    
  } catch (error) {
    console.error('Error deleting student:', error);
    NotificationSystem.notifyError('Failed to delete student');
  }
}

async function handleStudentSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const formData = new FormData(e.target);
  
  const studentData = {
    name: formData.get('studentName'),
    email: formData.get('studentEmail'),
    phone: formData.get('studentPhone'),
    gender: formData.get('studentGender'),
    rate: safeNumber(formData.get('studentRate')),
    createdAt: getLocalDateString(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (currentEditStudentId) {
      const students = await EnhancedCache.loadCollection('students');
      const studentIndex = students.findIndex(s => s.id === currentEditStudentId);
      
      if (studentIndex !== -1) {
        const existingStudent = students[studentIndex];
        studentData.id = currentEditStudentId;
        studentData._firebaseId = existingStudent._firebaseId;
        studentData._synced = existingStudent._synced;
        
        if (existingStudent._firebaseId) {
          await updateDoc(doc(db, "users", user.uid, "students", existingStudent._firebaseId), studentData);
        }
        
        students[studentIndex] = { ...students[studentIndex], ...studentData };
        cache.students = students;
        EnhancedCache.saveToLocalStorageBulk('students', students);
        
        NotificationSystem.notifySuccess('Student updated successfully');
        currentEditStudentId = null;
        
        const submitBtn = document.querySelector('#studentForm button[type="submit"]');
        submitBtn.textContent = 'Add Student';
        const cancelBtn = document.querySelector('#studentForm button[type="button"]');
        if (cancelBtn) cancelBtn.remove();
        
        e.target.reset();
      }
    } else {
      await EnhancedCache.saveWithBackgroundSync('students', studentData);
      FormAutoClear.handleSuccess('studentForm');
    }
    
    // FIX: Refresh stats after save/update
    EnhancedStats.forceRefresh();
    await renderStudents();
    
    // FIX: Refresh student dropdowns after adding/updating
    await StudentDropdownManager.forceRefresh();
    
  } catch (error) {
    console.error('Error saving student:', error);
    NotificationSystem.notifyError('Failed to save student');
  }
}

// ===========================
// STUDENT DROPDOWN MANAGER (FIXED)
// ===========================

const StudentDropdownManager = {
  initialized: false,
  
  async init() {
    if (this.initialized) {
      console.log('⚠️ StudentDropdownManager already initialized');
      return;
    }
    
    try {
      console.log('🔄 Initializing StudentDropdownManager...');
      
      this.setupDropdownListeners();
      await this.populateAllDropdowns();
      
      this.initialized = true;
      console.log('✅ StudentDropdownManager initialized successfully');
      
    } catch (error) {
      console.error('❌ Error initializing StudentDropdownManager:', error);
    }
  },
  
  setupDropdownListeners() {
    const tabContainer = document.querySelector('.tabs');
    if (tabContainer) {
      tabContainer.addEventListener('click', async (e) => {
        const tab = e.target.closest('.tab');
        if (tab) {
          const tabName = tab.getAttribute('data-tab');
          console.log(`📌 Tab clicked: ${tabName}`);
          
          if (tabName === 'hours' || tabName === 'marks' || tabName === 'payments') {
            setTimeout(async () => {
              await this.populateDropdownForTab(tabName);
            }, 100);
          }
        }
      });
    }
    
    document.addEventListener('studentsUpdated', async () => {
      console.log('🎯 Event: studentsUpdated - refreshing all dropdowns');
      await this.populateAllDropdowns();
    });
  },
  
  async populateAllDropdowns() {
    try {
      console.log('📝 Populating ALL student dropdowns...');
      
      await Promise.all([
        this.populateDropdown('hoursStudent'),
        this.populateDropdown('marksStudent'),
        this.populateDropdown('paymentStudent'),
        this.populateAttendanceStudents()
      ]);
      
      console.log('✅ All student dropdowns populated');
      
    } catch (error) {
      console.error('❌ Error populating all dropdowns:', error);
    }
  },
  
  async populateDropdownForTab(tabName) {
    const dropdownMap = {
      hours: 'hoursStudent',
      marks: 'marksStudent',
      payments: 'paymentStudent'
    };
    
    const dropdownId = dropdownMap[tabName];
    if (dropdownId) {
      await this.populateDropdown(dropdownId);
    }
  },
  
  async populateDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) {
      console.log(`❌ Dropdown not found: ${dropdownId}`);
      return false;
    }

    try {
      const students = await EnhancedCache.loadCollection('students');
      console.log(`📝 Populating ${dropdownId} with ${students.length} students`);
      
      const currentValue = dropdown.value;
      
      dropdown.innerHTML = '';
      
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = students.length > 0 ? 'Select a student...' : 'No students available';
      defaultOption.disabled = true;
      defaultOption.selected = true;
      dropdown.appendChild(defaultOption);
      
      students.forEach(student => {
        // FIX: Use formatStudentDisplay for consistent display
        const studentDisplay = formatStudentDisplay(student);
        
        const option = document.createElement('option');
        option.value = student.name || student.id;
        option.textContent = studentDisplay;
        option.setAttribute('data-student-id', student.id);
        dropdown.appendChild(option);
      });
      
      if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
        dropdown.value = currentValue;
      }
      
      console.log(`✅ ${dropdownId} populated with ${students.length} students`);
      return true;
      
    } catch (error) {
      console.error(`Error populating ${dropdownId}:`, error);
      return false;
    }
  },
  
  async forceRefresh() {
    console.log('🔄 Force-refreshing all student dropdowns...');
    this.initialized = false;
    await this.init();
  }
};

// ===========================
// DEFAULT RATE MANAGEMENT
// ===========================

function initializeDefaultRate(defaultRate = null) {
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  const baseRateInput = document.getElementById('baseRate');
  
  if (defaultRate === null) {
    defaultRate = parseFloat(localStorage.getItem('userDefaultRate')) || 0;
  }
  
  if (defaultBaseRateInput) {
    defaultBaseRateInput.value = defaultRate;
  }
  
  if (baseRateInput && !baseRateInput.value) {
    baseRateInput.value = defaultRate;
  }
  
  console.log(`💰 Default rate initialized: $${defaultRate}/hour`);
}

async function saveDefaultRate() {
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  if (!defaultBaseRateInput) return;
  
  const newRate = parseFloat(defaultBaseRateInput.value) || 0;
  
  try {
    const user = auth.currentUser;
    if (user) {
      await updateDoc(doc(db, "users", user.uid), { defaultRate: newRate });
    }
    
    localStorage.setItem('userDefaultRate', newRate.toString());
    
    if (currentUserData) {
      currentUserData.defaultRate = newRate;
    }
    
    initializeDefaultRate(newRate);
    NotificationSystem.notifySuccess(`Default rate updated to $${newRate}/hour`);
    
  } catch (error) {
    console.error('Error saving default rate:', error);
    NotificationSystem.notifyError('Failed to save default rate');
  }
}

// ===========================
// REPORTS & OVERVIEW FUNCTIONS
// ===========================

async function renderOverviewReports() {
  await EnhancedStats.calculateOverviewStats();
  
  const reportContainer = document.getElementById('reportContent');
  if (!reportContainer) return;
  
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const [students, hours, marks, payments] = await Promise.all([
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('marks'),
      EnhancedCache.loadCollection('payments')
    ]);
    
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentHours = hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= last30Days;
    });
    
    const recentPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date || payment.dateIso);
      return paymentDate >= last30Days;
    });
    
    const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    const totalPayments = payments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
    
    let avgMark = 0;
    if (marks.length > 0) {
      const totalPercentage = marks.reduce((sum, mark) => sum + safeNumber(mark.percentage), 0);
      avgMark = totalPercentage / marks.length;
    }
    
    const outstanding = Math.max(totalEarnings - totalPayments, 0);
    
    const reportHTML = `
      <div class="report-section">
        <h4>📊 Summary Report</h4>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${students.length}</div>
            <div class="stat-label">Total Students</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${totalHours.toFixed(1)}</div>
            <div class="stat-label">Total Hours</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">$${fmtMoney(totalEarnings)}</div>
            <div class="stat-label">Total Earnings</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgMark.toFixed(1)}%</div>
            <div class="stat-label">Average Mark</div>
          </div>
        </div>
      </div>
      
      <div class="report-section">
        <h4>💰 Financial Overview</h4>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">$${fmtMoney(totalPayments)}</div>
            <div class="stat-label">Total Payments</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">$${fmtMoney(outstanding)}</div>
            <div class="stat-label">Outstanding Balance</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${recentHours.length}</div>
            <div class="stat-label">Last 30 Days Hours</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${recentPayments.length}</div>
            <div class="stat-label">Recent Payments</div>
          </div>
        </div>
      </div>
      
      <div class="report-section">
        <h4>📈 Recent Activity</h4>
        <div class="activity-list">
          <div class="activity-item">
            <strong>Last Login:</strong> ${formatDate(currentUserData?.lastLogin || new Date().toISOString())}
          </div>
          <div class="activity-item">
            <strong>Member Since:</strong> ${formatDate(currentUserData?.memberSince || new Date().toISOString())}
          </div>
          <div class="activity-item">
            <strong>Default Rate:</strong> $${fmtMoney(currentUserData?.defaultRate || 0)}/hour
          </div>
          <div class="activity-item">
            <strong>Last Sync:</strong> ${formatDate(cache.lastSync)}
          </div>
        </div>
      </div>
    `;
    
    reportContainer.innerHTML = reportHTML;
    console.log('✅ Overview report rendered');
    
  } catch (error) {
    console.error('Error rendering overview report:', error);
    reportContainer.innerHTML = '<div class="error">Error loading report data</div>';
  }
}

// ===========================
// TAB NAVIGATION
// ===========================

function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  console.log('🔧 Setting up tab navigation...');
  console.log(`Found ${tabs.length} tabs, ${tabContents.length} tab contents`);
  
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      const targetTab = tab.getAttribute('data-tab');
      console.log(`🎯 Tab clicked: ${targetTab}`);
      
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      
      tab.classList.add('active');
      const targetContent = document.getElementById(targetTab);
      if (targetContent) {
        targetContent.classList.add('active');
      } else {
        console.warn(`❌ Tab content not found for: ${targetTab}`);
      }
      
      await handleTabActivation(targetTab);
    });
  });
  
  const defaultTab = document.querySelector('.tab.active');
  if (defaultTab) {
    const defaultTabName = defaultTab.getAttribute('data-tab');
    console.log(`🎯 Default active tab: ${defaultTabName}`);
    handleTabActivation(defaultTabName);
  }
}

async function handleTabActivation(tabName) {
  console.log(`🔄 Handling activation for tab: ${tabName}`);
  
  switch (tabName) {
    case 'overview':
      await renderOverviewReports();
      break;
    case 'students':
      await renderStudents();
      await StudentDropdownManager.populateAllDropdowns();
      break;
    case 'hours':
      await renderRecentHoursWithEdit();
      await populateHoursStudentDropdown();
      break;
    case 'marks':
      await renderRecentMarksWithEdit();
      await StudentDropdownManager.populateDropdown('marksStudent');
      break;
    case 'attendance':
      await renderAttendanceRecentWithEdit();
      await populateAttendanceStudents();
      break;
    case 'payments':
      await renderPaymentActivityWithEdit();
      await renderStudentBalancesWithEdit();
      await StudentDropdownManager.populateDropdown('paymentStudent');
      break;
    default:
      console.log(`ℹ️ No special handling for tab: ${tabName}`);
  }
  
  console.log(`✅ Tab ${tabName} activated and data loaded`);
}

// ===========================
// FORM EVENT LISTENERS
// ===========================

function setupFormListeners() {
  console.log('🔧 Setting up form listeners...');
  
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
    console.log('✅ Student form listener added');
  }
  
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
    
    const hoursWorked = document.getElementById('hoursWorked');
    const baseRate = document.getElementById('baseRate');
    
    if (hoursWorked) {
      hoursWorked.addEventListener('input', calculateTotalPay);
    }
    
    if (baseRate) {
      baseRate.addEventListener('input', calculateTotalPay);
    }
    
    console.log('✅ Hours form listener added');
  }
  
  const marksForm = document.getElementById('marksForm');
  if (marksForm) {
    marksForm.addEventListener('submit', handleMarksSubmit);
    
    const marksScore = document.getElementById('marksScore');
    const marksMax = document.getElementById('marksMax');
    
    if (marksScore) {
      marksScore.addEventListener('input', updateMarksPercentage);
    }
    
    if (marksMax) {
      marksMax.addEventListener('input', updateMarksPercentage);
    }
    
    console.log('✅ Marks form listener added');
  }
  
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', handleAttendanceSubmit);
    console.log('✅ Attendance form listener added');
  }
  
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmit);
    console.log('✅ Payment form listener added');
  }
  
  const defaultRateBtn = document.getElementById('defaultRateBtn');
  if (defaultRateBtn) {
    defaultRateBtn.addEventListener('click', saveDefaultRate);
    console.log('✅ Default rate button listener added');
  }
  
  console.log('✅ All form listeners setup complete');
}

// ===========================
// INITIALIZATION
// ===========================

async function initializeApp() {
  console.log('🚀 Initializing WorkLog application...');
  
  try {
    NotificationSystem.initNotificationStyles();
    console.log('✅ Notification system initialized');
    
    // Initialize theme
    initializeTheme();
    injectThemeStyles();
    console.log('✅ Theme system initialized');
    
    // Setup authentication state listener
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log(`👤 User authenticated: ${user.email}`);
        
        await loadUserProfile(user.uid);
        
        EnhancedCache.loadCachedData();
        
        setupProfileModal();
        
        setupTabNavigation();
        
        setupFormListeners();
        
        setupFloatingAddButton();
        
        await StudentDropdownManager.init();
        
        SyncBar.init();
        
        EnhancedStats.init();
        
        updateHeaderStats();
        
        const defaultTab = document.querySelector('.tab.active');
        if (defaultTab) {
          const tabName = defaultTab.getAttribute('data-tab');
          await handleTabActivation(tabName);
        }
        
        console.log('✅ Application initialization complete');
        
      } else {
        console.log('👤 No user authenticated, redirecting to login...');
        window.location.href = "auth.html";
      }
    });
    
  } catch (error) {
    console.error('❌ Critical error during initialization:', error);
    NotificationSystem.notifyError('Failed to initialize application');
  }
}

// ===========================
// EXPORT FUNCTIONS FOR GLOBAL ACCESS
// ===========================

window.NotificationSystem = NotificationSystem;
window.SyncBar = SyncBar;
window.EnhancedStats = EnhancedStats;
window.FormAutoClear = FormAutoClear;
window.EnhancedCache = EnhancedCache;
window.StudentDropdownManager = StudentDropdownManager;

window.toggleTheme = toggleTheme;
window.showSyncStats = showSyncStats;
window.closeSyncStats = closeSyncStats;
window.openSyncStats = openSyncStats;
window.debugStudentDropdowns = debugStudentDropdowns;
window.manuallyRefreshStudentDropdowns = manuallyRefreshStudentDropdowns;
window.updateMarksPercentage = updateMarksPercentage;
window.calculateTotalPay = calculateTotalPay;
window.editStudent = editStudent;
window.cancelEditStudent = cancelEditStudent;
window.deleteStudent = deleteStudent;
window.startEditHours = startEditHours;
window.cancelEditHours = cancelEditHours;
window.deleteHours = deleteHours;
window.startEditMark = startEditMark;
window.cancelEditMark = cancelEditMark;
window.deleteMark = deleteMark;
window.startEditAttendance = startEditAttendance;
window.cancelEditAttendance = cancelEditAttendance;
window.deleteAttendance = deleteAttendance;
window.startEditPayment = startEditPayment;
window.cancelEditPayment = cancelEditPayment;
window.deletePayment = deletePayment;
window.quickAddPayment = quickAddPayment;

// ===========================
// START THE APPLICATION
// ===========================

document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM fully loaded and parsed');
  
  // FIX: Check if NotificationSystem exists, if not create a simple fallback
  if (typeof NotificationSystem === 'undefined') {
    console.warn('⚠️ NotificationSystem not found, creating simple fallback');
    window.NotificationSystem = {
      notifyInfo: (msg) => console.log('ℹ️ ' + msg),
      notifySuccess: (msg) => console.log('✅ ' + msg),
      notifyError: (msg) => console.log('❌ ' + msg),
      notifyWarning: (msg) => console.log('⚠️ ' + msg),
      initNotificationStyles: () => console.log('📱 Notification styles initialized')
    };
  }
  
  initializeApp();
});
