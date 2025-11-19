// ===========================
// MODULE: CACHE SYSTEM
// ===========================

const CacheSystem = {
  cache: {
    students: null,
    hours: null,
    marks: null,
    attendance: null,
    payments: null,
    lastSync: null
  },

  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes

  isValid(key) {
    if (!this.cache[key] || !this.cache.lastSync) return false;
    return (Date.now() - this.cache.lastSync) < this.CACHE_DURATION;
  },

  update(key, data) {
    this.cache[key] = data;
    this.cache.lastSync = Date.now();
  },

  clear() {
    this.cache.students = null;
    this.cache.hours = null;
    this.cache.marks = null;
    this.cache.attendance = null;
    this.cache.payments = null;
    this.cache.lastSync = null;
  }
};

// ===========================
// MODULE: UTILITIES
// ===========================

const Utils = {
  safeNumber(n, fallback = 0) {
    if (n === null || n === undefined || n === '') return fallback;
    const v = Number(n);
    return Number.isFinite(v) ? v : fallback;
  },

  fmtMoney(n) {
    return this.safeNumber(n).toFixed(2);
  },

  fmtDateISO(yyyyMmDd) {
    if (!yyyyMmDd) return new Date().toISOString();
    try {
      const [year, month, day] = yyyyMmDd.split('-');
      const d = new Date(year, month - 1, day, 12, 0, 0);
      return d.toISOString();
    } catch {
      return new Date().toISOString();
    }
  },

  formatDate(dateString) {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch {
      return dateString;
    }
  },

  formatDateForInput(dateString) {
    if (!dateString) return new Date().toISOString().split('T')[0];
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return new Date().toISOString().split('T')[0];
      }
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  },

  calculateGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  },

  getLocalISODate() {
    const now = new Date();
    const tzOffset = -now.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    const pad = n => `${Math.floor(Math.abs(n))}`.padStart(2, '0');
    return now.getFullYear() +
      '-' + pad(now.getMonth() + 1) +
      '-' + pad(now.getDate()) +
      'T' + pad(now.getHours()) +
      ':' + pad(now.getMinutes()) +
      ':' + pad(now.getSeconds()) +
      diff + pad(tzOffset / 60) +
      ':' + pad(tzOffset % 60);
  }
};

// ===========================
// MODULE: TAB SYSTEM (SIMPLE & RELIABLE)
// ===========================

const TabSystem = {
  currentTab: null,

  init() {
    console.log('🔧 Initializing tab system...');
    this.setupEventListeners();
    this.activateTab('students'); // Default tab
    console.log('✅ Tab system ready');
  },

  setupEventListeners() {
    // Remove any existing listeners by cloning
    const tabsContainer = document.querySelector('.tabs');
    if (tabsContainer) {
      const newTabs = tabsContainer.cloneNode(true);
      tabsContainer.parentNode.replaceChild(newTabs, tabsContainer);
    }

    // Add fresh event listeners
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = tab.getAttribute('data-tab');
        this.activateTab(targetTab);
      });
    });

    console.log('✅ Tab event listeners setup');
  },

  activateTab(tabName) {
    console.log('🔄 Switching to tab:', tabName);

    // Hide all tab contents
    document.querySelectorAll('.tabcontent').forEach(tab => {
      tab.style.display = 'none';
      tab.classList.remove('active');
    });

    // Remove active from all buttons
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });

    // Show target tab
    const targetContent = document.getElementById(tabName);
    const targetButton = document.querySelector(`[data-tab="${tabName}"]`);

    if (targetContent && targetButton) {
      targetContent.style.display = 'block';
      targetContent.classList.add('active');
      targetButton.classList.add('active');
      this.currentTab = tabName;

      // Fix layout for specific tabs
      this.fixTabLayout(tabName);

      console.log('✅ Tab activated:', tabName);
    } else {
      console.error('❌ Tab not found:', tabName);
    }
  },

  fixTabLayout(tabName) {
    // Fix grid layout for payments and reports
    if (tabName === 'payments' || tabName === 'reports') {
      const tab = document.getElementById(tabName);
      const formGrid = tab?.querySelector('.form-grid');
      
      if (formGrid) {
        formGrid.style.gridTemplateColumns = '1fr 1fr 1fr';
        formGrid.style.gap = '20px';
        formGrid.style.minHeight = '400px';
        console.log('✅ Grid layout fixed for:', tabName);
      }
    }
  }
};

// ===========================
// MODULE: NOTIFICATION SYSTEM
// ===========================

const NotificationSystem = {
  init() {
    this.initNotificationStyles();
    console.log('✅ Notification system ready');
  },

  initNotificationStyles() {
    if (!document.querySelector('#notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          min-width: 300px;
          background: var(--surface);
          border-left: 4px solid var(--primary);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          transform: translateX(400px);
          opacity: 0;
          transition: all 0.3s ease;
        }
        .notification-show { transform: translateX(0); opacity: 1; }
        .notification-hide { transform: translateX(400px); opacity: 0; }
        .notification-content { padding: 16px; display: flex; align-items: center; gap: 12px; }
        .notification-success { border-left-color: var(--success); }
        .notification-error { border-left-color: var(--error); }
        .notification-warning { border-left-color: var(--warning); }
        .notification-info { border-left-color: var(--info); }
      `;
      document.head.appendChild(style);
    }
  },

  show(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span>${this.getIcon(type)}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" style="margin-left: auto; background: none; border: none; font-size: 18px; cursor: pointer;">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('notification-show'), 10);
    
    if (duration > 0) {
      setTimeout(() => {
        notification.classList.remove('notification-show');
        notification.classList.add('notification-hide');
        setTimeout(() => notification.remove(), 300);
      }, duration);
    }
    
    return notification;
  },

  getIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  },

  notifySuccess(message, duration = 5000) {
    return this.show(message, 'success', duration);
  },

  notifyError(message, duration = 5000) {
    return this.show(message, 'error', duration);
  },

  notifyWarning(message, duration = 5000) {
    return this.show(message, 'warning', duration);
  },

  notifyInfo(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }
};

// ===========================
// MODULE: FLOATING ACTION BUTTON
// ===========================

const FABSystem = {
  isExpanded: false,

  init() {
    console.log('🔧 Initializing FAB system...');
    this.setupFAB();
    this.setupActions();
    console.log('✅ FAB system ready');
  },

  setupFAB() {
    const fab = document.getElementById('floatingAddBtn');
    const fabMenu = document.getElementById('fabMenu');
    const fabOverlay = document.getElementById('fabOverlay');

    if (!fab) {
      console.error('❌ FAB button not found');
      return;
    }

    fab.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });

    if (fabOverlay) {
      fabOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenu();
      });
    }

    // Close on outside click
    document.addEventListener('click', () => {
      if (this.isExpanded) this.closeMenu();
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isExpanded) this.closeMenu();
    });
  },

  setupActions() {
    const actions = {
      'fabAddStudent': () => this.openTab('students'),
      'fabAddHours': () => this.openTab('hours'),
      'fabAddMark': () => this.openTab('marks'),
      'fabAddAttendance': () => this.openTab('attendance'),
      'fabAddPayment': () => this.openTab('payments'),
      'fabGenerateReport': () => this.openTab('reports')
    };

    Object.keys(actions).forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          actions[btnId]();
          this.closeMenu();
        });
      }
    });
  },

  toggleMenu() {
    const fab = document.getElementById('floatingAddBtn');
    const fabMenu = document.getElementById('fabMenu');
    const fabOverlay = document.getElementById('fabOverlay');

    this.isExpanded = !this.isExpanded;

    if (this.isExpanded) {
      fab.innerHTML = '✕';
      fab.style.transform = 'rotate(45deg)';
      fabMenu?.classList.add('show');
      fabOverlay?.classList.add('show');
    } else {
      this.closeMenu();
    }
  },

  closeMenu() {
    const fab = document.getElementById('floatingAddBtn');
    const fabMenu = document.getElementById('fabMenu');
    const fabOverlay = document.getElementById('fabOverlay');

    this.isExpanded = false;
    fab.innerHTML = '+';
    fab.style.transform = 'rotate(0deg)';
    fabMenu?.classList.remove('show');
    fabOverlay?.classList.remove('show');
  },

  openTab(tabName) {
    TabSystem.activateTab(tabName);
    
    // Scroll to form after a delay
    setTimeout(() => {
      const tab = document.getElementById(tabName);
      const firstForm = tab?.querySelector('form, .section-card');
      if (firstForm) {
        firstForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstInput = firstForm.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
      }
    }, 300);
  }
};

// ===========================
// MODULE: THEME MANAGEMENT
// ===========================

const ThemeSystem = {
  init() {
    console.log('🔧 Initializing theme system...');
    this.loadTheme();
    this.setupToggle();
    console.log('✅ Theme system ready');
  },

  loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  },

  setupToggle() {
    const themeToggle = document.querySelector('.theme-toggle button');
    if (themeToggle) {
      themeToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle();
      });
    }
  },

  toggle() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.updateThemeIcon(newTheme);
    
    console.log('🎨 Theme changed to:', newTheme);
  },

  updateThemeIcon(theme) {
    const themeButton = document.querySelector('.theme-toggle button');
    if (themeButton) {
      themeButton.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }
};

// ===========================
// MODULE: SYNC SYSTEM
// ===========================

const SyncSystem = {
  isAutoSyncEnabled: false,
  autoSyncInterval: null,

  init() {
    console.log('🔧 Initializing sync system...');
    this.loadSettings();
    this.setupEventListeners();
    console.log('✅ Sync system ready');
  },

  loadSettings() {
    const savedAutoSync = localStorage.getItem('autoSyncEnabled') === 'true';
    this.isAutoSyncEnabled = savedAutoSync;
    
    const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
    const autoSyncText = document.getElementById('autoSyncText');
    const syncIndicator = document.getElementById('syncIndicator');

    if (autoSyncCheckbox) {
      autoSyncCheckbox.checked = savedAutoSync;
      autoSyncText.textContent = savedAutoSync ? 'Auto' : 'Manual';
      
      if (syncIndicator) {
        syncIndicator.style.backgroundColor = savedAutoSync ? '#10b981' : '#ef4444';
      }
    }

    if (savedAutoSync) {
      this.startAutoSync();
    }
  },

  setupEventListeners() {
    const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
    const syncBtn = document.getElementById('syncBtn');

    if (autoSyncCheckbox) {
      autoSyncCheckbox.addEventListener('change', (e) => {
        this.isAutoSyncEnabled = e.target.checked;
        localStorage.setItem('autoSyncEnabled', this.isAutoSyncEnabled.toString());
        
        if (this.isAutoSyncEnabled) {
          this.startAutoSync();
          NotificationSystem.notifySuccess('Auto-sync enabled');
        } else {
          this.stopAutoSync();
          NotificationSystem.notifyInfo('Auto-sync disabled');
        }
      });
    }

    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.performSync('manual'));
    }
  },

  startAutoSync() {
    this.stopAutoSync();
    this.performSync('auto');
    this.autoSyncInterval = setInterval(() => this.performSync('auto'), 60000);
  },

  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  },

  async performSync(mode = 'manual') {
    console.log(`🔄 Performing ${mode} sync...`);
    
    try {
      // Update sync indicator
      const syncIndicator = document.getElementById('syncIndicator');
      const syncMessageLine = document.getElementById('syncMessageLine');
      
      if (syncIndicator) syncIndicator.classList.add('sync-active');
      if (syncMessageLine) syncMessageLine.textContent = `Status: ${mode === 'auto' ? 'Auto-syncing' : 'Syncing'}...`;

      // Perform sync operations
      await Promise.all([
        this.recalcSummaryStats(),
        this.loadUserStats(),
        this.renderAllData()
      ]);

      // Update timestamp
      const now = new Date().toLocaleString();
      if (syncMessageLine) syncMessageLine.textContent = `Status: Last synced at ${now}`;

      NotificationSystem.notifySuccess(`${mode === 'auto' ? 'Auto-' : ''}Sync completed`);

    } catch (error) {
      console.error('❌ Sync failed:', error);
      NotificationSystem.notifyError(`Sync failed: ${error.message}`);
    } finally {
      const syncIndicator = document.getElementById('syncIndicator');
      if (syncIndicator) {
        syncIndicator.classList.remove('sync-active');
        syncIndicator.style.backgroundColor = this.isAutoSyncEnabled ? '#10b981' : '#ef4444';
      }
    }
  },

  async recalcSummaryStats() {
    // Implementation depends on your Firestore structure
    console.log('📊 Recalculating summary stats...');
  },

  async loadUserStats() {
    // Implementation depends on your Firestore structure
    console.log('📈 Loading user stats...');
  },

  async renderAllData() {
    // Implementation depends on your rendering functions
    console.log('🎨 Rendering all data...');
  }
};

// ===========================
// MODULE: FORM MANAGEMENT
// ===========================

const FormSystem = {
  init() {
    console.log('🔧 Initializing form system...');
    this.setupFormListeners();
    this.setupCalculations();
    console.log('✅ Form system ready');
  },

  setupFormListeners() {
    // Student form
    this.setupStudentForm();
    // Hours form
    this.setupHoursForm();
    // Marks form
    this.setupMarksForm();
    // Attendance form
    this.setupAttendanceForm();
    // Payment form
    this.setupPaymentForm();
  },

  setupStudentForm() {
    const submitBtn = document.getElementById('studentSubmitBtn');
    const clearBtn = document.getElementById('clearStudentFormBtn');
    const cancelBtn = document.getElementById('studentCancelBtn');

    if (submitBtn) submitBtn.addEventListener('click', () => this.addStudent());
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearStudentForm());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelEdit());
  },

  setupHoursForm() {
    const logHoursBtn = document.getElementById('logHoursBtn');
    if (logHoursBtn) logHoursBtn.addEventListener('click', () => this.logHours());
    
    // Hours calculations
    const hoursInput = document.getElementById('hoursWorked');
    const rateInput = document.getElementById('baseRate');
    const workTypeSelect = document.getElementById('workType');
    
    if (hoursInput) hoursInput.addEventListener('input', () => this.calculateHoursTotal());
    if (rateInput) rateInput.addEventListener('input', () => this.calculateHoursTotal());
    if (workTypeSelect) workTypeSelect.addEventListener('change', () => this.calculateHoursTotal());
  },

  setupMarksForm() {
    const addMarkBtn = document.getElementById('addMarkBtn');
    if (addMarkBtn) addMarkBtn.addEventListener('click', () => this.addMark());
    
    // Marks calculations
    const scoreInput = document.getElementById('marksScore');
    const maxInput = document.getElementById('marksMax');
    
    if (scoreInput) scoreInput.addEventListener('input', () => this.updateMarksPercentage());
    if (maxInput) maxInput.addEventListener('input', () => this.updateMarksPercentage());
  },

  setupAttendanceForm() {
    const saveBtn = document.getElementById('saveAttendanceBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveAttendance());
  },

  setupPaymentForm() {
    const recordBtn = document.getElementById('recordPaymentBtn');
    if (recordBtn) recordBtn.addEventListener('click', () => this.recordPayment());
  },

  setupCalculations() {
    // Initial calculations
    this.calculateHoursTotal();
    this.updateMarksPercentage();
  },

  calculateHoursTotal() {
    const hours = Utils.safeNumber(document.getElementById('hoursWorked')?.value);
    const rate = Utils.safeNumber(document.getElementById('baseRate')?.value);
    const workType = document.getElementById('workType')?.value || "hourly";
    const totalEl = document.getElementById('totalPay');
    
    if (totalEl) {
      let total = workType === "hourly" ? hours * rate : rate;
      if ("value" in totalEl) {
        totalEl.value = Utils.fmtMoney(total);
      } else {
        totalEl.textContent = Utils.fmtMoney(total);
      }
    }
  },

  updateMarksPercentage() {
    const score = Utils.safeNumber(document.getElementById('marksScore')?.value);
    const max = Utils.safeNumber(document.getElementById('marksMax')?.value);
    const pctEl = document.getElementById('percentage');
    const gradeEl = document.getElementById('grade');

    if (max > 0) {
      const percentage = (score / max) * 100;
      if (pctEl) pctEl.value = percentage.toFixed(1);
      if (gradeEl) gradeEl.value = Utils.calculateGrade(percentage);
    }
  },

  // Form submission methods
  async addStudent() {
    console.log('➕ Adding student...');
    // Implementation
  },

  async logHours() {
    console.log('⏱️ Logging hours...');
    // Implementation
  },

  async addMark() {
    console.log('📊 Adding mark...');
    // Implementation
  },

  async saveAttendance() {
    console.log('✅ Saving attendance...');
    // Implementation
  },

  async recordPayment() {
    console.log('💳 Recording payment...');
    // Implementation
  },

  clearStudentForm() {
    console.log('🧹 Clearing student form...');
    // Implementation
  },

  cancelEdit() {
    console.log('❌ Canceling edit...');
    // Implementation
  }
};

// ===========================
// MODULE: APP INITIALIZATION
// ===========================

const App = {
  currentUser: null,

  async init() {
    console.log('🚀 Initializing WorkLog App...');
    
    try {
      // Initialize all systems
      NotificationSystem.init();
      ThemeSystem.init();
      TabSystem.init();
      FABSystem.init();
      SyncSystem.init();
      FormSystem.init();
      
      // Set up auth listener
      this.setupAuth();
      
      console.log('✅ WorkLog App Fully Initialized');
      
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      NotificationSystem.notifyError('App failed to initialize');
    }
  },

  setupAuth() {
    // Your Firebase auth listener here
    console.log('🔐 Setting up auth listener...');
    
    // Mock auth for now - replace with your Firebase auth
    this.currentUser = { uid: 'mock-user', email: 'user@example.com' };
    this.onAuthStateChanged(this.currentUser);
  },

  onAuthStateChanged(user) {
    if (user) {
      console.log('✅ User authenticated:', user.email);
      this.showApp();
      this.loadUserData(user);
    } else {
      console.log('🚫 No user - redirecting to login');
      window.location.href = "auth.html";
    }
  },

  showApp() {
    const container = document.querySelector(".container");
    if (container) {
      container.style.display = "block";
    }
  },

  async loadUserData(user) {
    console.log('📥 Loading user data for:', user.uid);
    // Load user-specific data
  }
};

// ===========================
// GLOBAL EXPORTS
// ===========================

// Make systems available globally
window.TabSystem = TabSystem;
window.NotificationSystem = NotificationSystem;
window.Utils = Utils;

// Form functions
window.addStudent = () => FormSystem.addStudent();
window.logHours = () => FormSystem.logHours();
window.addMark = () => FormSystem.addMark();
window.saveAttendance = () => FormSystem.saveAttendance();
window.recordPayment = () => FormSystem.recordPayment();

// Tab functions
window.switchTab = (tabName) => TabSystem.activateTab(tabName);

// ===========================
// START THE APP
// ===========================

document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM fully loaded');
  App.init();
});
