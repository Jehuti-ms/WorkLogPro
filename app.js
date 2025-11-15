// ===========================
// IMPORTS
// ===========================

import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  getDocs,
  writeBatch,
  query, 
  orderBy,
  where,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ===========================
// GLOBAL VARIABLES
// ===========================

let autoSyncInterval = null;
let isAutoSyncEnabled = false;

// DOM Elements
const syncIndicator = document.getElementById("syncIndicator");
const syncSpinner = document.getElementById("syncSpinner");
const autoSyncCheckbox = document.getElementById("autoSyncCheckbox");
const autoSyncText = document.getElementById("autoSyncText");
const syncMessage = document.getElementById("syncMessage");
const syncMessageLine = document.getElementById("syncMessageLine");
const syncBtn = document.getElementById("syncBtn");
const exportCloudBtn = document.getElementById("exportCloudBtn");
const importCloudBtn = document.getElementById("importCloudBtn");
const syncStatsBtn = document.getElementById("syncStatsBtn");
const exportDataBtn = document.getElementById("exportDataBtn");
const importDataBtn = document.getElementById("importDataBtn");
const clearDataBtn = document.getElementById("clearDataBtn");

// ===========================
// UTILITY FUNCTIONS
// ===========================

function safeNumber(n, fallback = 0) {
  if (n === null || n === undefined || n === '') return fallback;
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function fmtMoney(n) {
  return safeNumber(n).toFixed(2);
}

function fmtDateISO(yyyyMmDd) {
  if (!yyyyMmDd) return new Date().toISOString();
  try {
    const d = new Date(yyyyMmDd);
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Never';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

function refreshTimestamp() {
  const now = new Date().toLocaleString();
  if (syncMessageLine) syncMessageLine.textContent = "Status: Last synced at " + now;
  if (document.getElementById('statUpdated')) {
    document.getElementById('statUpdated').textContent = now;
  }
}

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

// ===========================
// NOTIFICATION SYSTEM MODULE
// ===========================

const NotificationSystem = {
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
          max-width: 500px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          z-index: 10000;
          transform: translateX(400px);
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .notification-show {
          transform: translateX(0);
          opacity: 1;
        }

        .notification-hide {
          transform: translateX(400px);
          opacity: 0;
        }

        .notification-content {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
        }

        .notification-icon {
          font-size: 1.2em;
          flex-shrink: 0;
        }

        .notification-message {
          flex: 1;
          font-weight: 500;
          line-height: 1.4;
          color: var(--text);
        }

        .notification-close {
          background: none;
          border: none;
          font-size: 1.5em;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          color: var(--muted);
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .notification-close:hover {
          background: var(--border-light);
          color: var(--text);
        }

        .notification-success {
          border-left: 4px solid var(--success);
        }

        .notification-error {
          border-left: 4px solid var(--error);
        }

        .notification-warning {
          border-left: 4px solid var(--warning);
        }

        .notification-info {
          border-left: 4px solid var(--info);
        }

        @media (max-width: 768px) {
          .notification {
            left: 20px;
            right: 20px;
            min-width: auto;
            max-width: none;
            transform: translateY(-100px);
          }

          .notification-show {
            transform: translateY(0);
          }

          .notification-hide {
            transform: translateY(-100px);
          }
        }
      `;
      document.head.appendChild(style);
    }
  },

  showNotification(message, type = 'info', duration = 5000) {
    this.clearNotifications();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="NotificationSystem.closeNotification(this.parentElement.parentElement)">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('notification-show');
    }, 10);
    
    if (duration > 0) {
      setTimeout(() => {
        this.closeNotification(notification);
      }, duration);
    }
    
    return notification;
  },

  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  },

  closeNotification(notification) {
    if (notification && notification.parentNode) {
      notification.classList.remove('notification-show');
      notification.classList.add('notification-hide');
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  },

  clearNotifications() {
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
      this.closeNotification(notification);
    });
  },

  notifySuccess(message, duration = 5000) {
    return this.showNotification(message, 'success', duration);
  },

  notifyError(message, duration = 5000) {
    return this.showNotification(message, 'error', duration);
  },

  notifyWarning(message, duration = 5000) {
    return this.showNotification(message, 'warning', duration);
  },

  notifyInfo(message, duration = 5000) {
    return this.showNotification(message, 'info', duration);
  }
};

// ===========================
// SYNC BAR MODULE
// ===========================

const SyncBar = {
  init() {
    NotificationSystem.initNotificationStyles();
    this.setupAutoSyncToggle();
    this.setupSyncNowButton();
    this.setupExportCloudButton();
    this.setupImportCloudButton();
    this.setupSyncStatsButton();
    this.setupExportDataButton();
    this.setupImportDataButton();
    this.setupClearAllButton();
    console.log('✅ Sync bar initialized');
  },

  setupAutoSyncToggle() {
    if (autoSyncCheckbox) {
      autoSyncCheckbox.addEventListener('change', (e) => {
        isAutoSyncEnabled = e.target.checked;
        
        if (isAutoSyncEnabled) {
          autoSyncText.textContent = 'Auto';
          if (syncIndicator) {
            syncIndicator.style.backgroundColor = '#10b981';
            syncIndicator.classList.add('sync-connected');
          }
          this.startAutoSync();
          NotificationSystem.notifySuccess('Auto-sync enabled - syncing every 60 seconds');
        } else {
          autoSyncText.textContent = 'Manual';
          if (syncIndicator) {
            syncIndicator.style.backgroundColor = '#ef4444';
            syncIndicator.classList.remove('sync-connected');
          }
          this.stopAutoSync();
          NotificationSystem.notifyInfo('Auto-sync disabled');
        }
      });

      autoSyncCheckbox.checked = false;
      autoSyncText.textContent = 'Manual';
      if (syncIndicator) {
        syncIndicator.style.backgroundColor = '#ef4444';
      }
    }
  },

  startAutoSync() {
    this.stopAutoSync();
    this.performSync('auto');
    autoSyncInterval = setInterval(() => this.performSync('auto'), 60000);
  },

  stopAutoSync() {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval);
      autoSyncInterval = null;
    }
  },

  setupSyncNowButton() {
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        await this.performSync('manual');
      });
    }
  },

  async performSync(mode = 'manual') {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to sync');
      return;
    }

    try {
      if (syncSpinner) syncSpinner.style.display = 'inline-block';
      if (syncIndicator) {
        syncIndicator.classList.remove('sync-connected', 'sync-error');
        syncIndicator.classList.add('sync-active');
      }
      if (syncMessageLine) {
        syncMessageLine.textContent = `Status: ${mode === 'auto' ? 'Auto-syncing' : 'Manual syncing'}...`;
      }

      await Promise.all([
        recalcSummaryStats(user.uid),
        loadUserStats(user.uid),
        renderStudents(),
        renderRecentHours(),
        renderRecentMarks(),
        renderAttendanceRecent(),
        renderPaymentActivity(),
        renderStudentBalances(),
        renderOverviewReports()
      ]);

      const now = new Date().toLocaleString();
      if (syncMessageLine) syncMessageLine.textContent = `Status: Last synced at ${now}`;
      if (document.getElementById('statUpdated')) {
        document.getElementById('statUpdated').textContent = now;
      }

      if (syncIndicator) {
        syncIndicator.classList.remove('sync-active');
        if (isAutoSyncEnabled) {
          syncIndicator.classList.add('sync-connected');
        }
      }

      NotificationSystem.notifySuccess(`${mode === 'auto' ? 'Auto-' : ''}Sync completed successfully`);

    } catch (error) {
      console.error(`❌ ${mode} sync failed:`, error);
      
      if (syncIndicator) {
        syncIndicator.classList.remove('sync-active', 'sync-connected');
        syncIndicator.classList.add('sync-error');
      }
      if (syncMessageLine) {
        syncMessageLine.textContent = `Status: Sync failed - ${error.message}`;
      }
      
      NotificationSystem.notifyError(`Sync failed: ${error.message}`);
    } finally {
      if (syncSpinner) syncSpinner.style.display = 'none';
    }
  },

  setupExportCloudButton() {
    if (exportCloudBtn) {
      exportCloudBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to export data');
          return;
        }

        try {
          NotificationSystem.notifyInfo('Starting cloud export...');
          const backupRef = doc(db, "backups", user.uid);
          const backupData = await this.createBackupData(user.uid);
          
          await setDoc(backupRef, {
            ...backupData,
            exportedAt: new Date().toISOString(),
            version: '1.0',
            user: user.uid
          });

          NotificationSystem.notifySuccess('Cloud export completed successfully');
        } catch (error) {
          console.error('❌ Cloud export failed:', error);
          NotificationSystem.notifyError(`Export failed: ${error.message}`);
        }
      });
    }
  },

  setupImportCloudButton() {
    if (importCloudBtn) {
      importCloudBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to import data');
          return;
        }

        const proceed = confirm('⚠️ This will overwrite your current data with the cloud backup. This action cannot be undone. Continue?');
        if (!proceed) return;

        try {
          NotificationSystem.notifyInfo('Starting cloud import...');
          const backupRef = doc(db, "backups", user.uid);
          const backupSnap = await getDoc(backupRef);

          if (!backupSnap.exists()) {
            NotificationSystem.notifyWarning('No cloud backup found for your account');
            return;
          }

          const backupData = backupSnap.data();
          await this.restoreBackupData(user.uid, backupData);
          NotificationSystem.notifySuccess('Cloud import completed successfully');
          await this.performSync('manual');
          
        } catch (error) {
          console.error('❌ Cloud import failed:', error);
          NotificationSystem.notifyError(`Import failed: ${error.message}`);
        }
      });
    }
  },

  setupSyncStatsButton() {
    if (syncStatsBtn) {
      syncStatsBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to sync stats');
          return;
        }

        try {
          NotificationSystem.notifyInfo('Syncing statistics...');
          await recalcSummaryStats(user.uid);
          await loadUserStats(user.uid);
          NotificationSystem.notifySuccess('Statistics synced successfully');
        } catch (error) {
          console.error('❌ Stats sync failed:', error);
          NotificationSystem.notifyError(`Stats sync failed: ${error.message}`);
        }
      });
    }
  },

  setupExportDataButton() {
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to export data');
          return;
        }

        try {
          NotificationSystem.notifyInfo('Preparing data export...');
          const exportData = await this.createBackupData(user.uid);
          
          const dataStr = JSON.stringify(exportData, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          NotificationSystem.notifySuccess('Data exported successfully');
        } catch (error) {
          console.error('❌ Local export failed:', error);
          NotificationSystem.notifyError(`Export failed: ${error.message}`);
        }
      });
    }
  },

  setupImportDataButton() {
    if (importDataBtn) {
      importDataBtn.addEventListener('click', () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to import data');
          return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const proceed = confirm('⚠️ This will overwrite your current data with the imported file. This action cannot be undone. Continue?');
          if (!proceed) return;

          try {
            NotificationSystem.notifyInfo('Importing data...');
            const fileText = await file.text();
            const importData = JSON.parse(fileText);
            
            if (!importData.metadata || !importData.students || !importData.hours) {
              throw new Error('Invalid backup file format');
            }

            await this.restoreBackupData(user.uid, importData);
            NotificationSystem.notifySuccess('Data imported successfully');
            await this.performSync('manual');
            
          } catch (error) {
            console.error('❌ Local import failed:', error);
            NotificationSystem.notifyError(`Import failed: ${error.message}`);
          }
        };
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
      });
    }
  },

  setupClearAllButton() {
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to clear data');
          return;
        }

        const proceed = confirm('⚠️🚨 DANGER ZONE 🚨⚠️\n\nThis will PERMANENTLY DELETE ALL your data including:\n• All students\n• All hours worked\n• All marks & assessments\n• All attendance records\n• All payment records\n\nThis action cannot be undone!\n\nType "DELETE ALL" to confirm:');
        
        if (proceed && prompt('Type "DELETE ALL" to confirm:') === 'DELETE ALL') {
          try {
            NotificationSystem.notifyWarning('Clearing all data...');
            await this.clearAllUserData(user.uid);
            NotificationSystem.notifySuccess('All data cleared successfully');
            await this.performSync('manual');
          } catch (error) {
            console.error('❌ Clear data failed:', error);
            NotificationSystem.notifyError(`Clear failed: ${error.message}`);
          }
        } else {
          NotificationSystem.notifyInfo('Data clearance cancelled');
        }
      });
    }
  },

  async createBackupData(uid) {
    const [statsSnap, studentsSnap, hoursSnap, paymentsSnap, marksSnap, attendanceSnap] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDocs(collection(db, "users", uid, "students")),
      getDocs(collection(db, "users", uid, "hours")),
      getDocs(collection(db, "users", uid, "payments")),
      getDocs(collection(db, "users", uid, "marks")),
      getDocs(collection(db, "users", uid, "attendance"))
    ]);

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        user: uid,
        recordCounts: {
          students: studentsSnap.size,
          hours: hoursSnap.size,
          payments: paymentsSnap.size,
          marks: marksSnap.size,
          attendance: attendanceSnap.size
        }
      },
      stats: statsSnap.exists() ? statsSnap.data() : {},
      students: studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      hours: hoursSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      payments: paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      marks: marksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      attendance: attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
  },

  async restoreBackupData(uid, backupData) {
    const batch = writeBatch(db);
    
    await this.clearAllUserData(uid);
    
    if (backupData.stats) {
      const statsRef = doc(db, "users", uid);
      batch.set(statsRef, backupData.stats);
    }
    
    if (backupData.students && Array.isArray(backupData.students)) {
      backupData.students.forEach(student => {
        const studentRef = doc(db, "users", uid, "students", student.id);
        batch.set(studentRef, student);
      });
    }
    
    ['hours', 'payments', 'marks', 'attendance'].forEach(collectionName => {
      if (backupData[collectionName] && Array.isArray(backupData[collectionName])) {
        backupData[collectionName].forEach(item => {
          const itemRef = doc(collection(db, "users", uid, collectionName));
          batch.set(itemRef, item);
        });
      }
    });
    
    await batch.commit();
    console.log('✅ Backup data restored');
  },

  async clearAllUserData(uid) {
    try {
      const collections = ['students', 'hours', 'payments', 'marks', 'attendance'];
      
      for (const collectionName of collections) {
        const colRef = collection(db, "users", uid, collectionName);
        const snapshot = await getDocs(colRef);
        
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        if (snapshot.docs.length > 0) {
          await batch.commit();
        }
      }
      
      const statsRef = doc(db, "users", uid);
      await setDoc(statsRef, {
        students: 0,
        hours: 0,
        earnings: 0,
        lastSync: new Date().toLocaleString()
      });
      
      console.log('✅ All user data cleared');
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
      throw error;
    }
  }
};

// ===========================
// UI MANAGEMENT MODULE
// ===========================

const UIManager = {
  init() {
    this.initializeTheme();
    this.initTabs();
    this.bindUiEvents();
    this.initEventListeners();
    console.log('✅ UI Manager initialized');
  },

  initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    console.log(`🎨 Theme initialized to ${savedTheme}`);
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    console.log(`🎨 Theme changed to ${newTheme}`);
  },

  initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tabcontent');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');

        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.style.display = 'none');

        tab.classList.add('active');

        const selected = document.getElementById(target);
        if (selected) {
          selected.style.display = 'block';
          console.log(`📑 Switched to ${target} tab`);
        }
      });
    });

    const firstActive = document.querySelector('.tab.active');
    if (firstActive) {
      const target = firstActive.getAttribute('data-tab');
      const selected = document.getElementById(target);
      if (selected) selected.style.display = 'block';
    }
    
    console.log('✅ Tabs initialized');
  },

  bindUiEvents() {
    console.log('🔧 Binding UI events...');
    
    const themeToggle = document.querySelector('.theme-toggle button');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      form.addEventListener('submit', (e) => e.preventDefault());
    });
    
    this.setupHoursFormCalculations();
    this.setupMarksFormCalculations();
    
    console.log('✅ UI events bound');
  },

  setupHoursFormCalculations() {
    const hoursInput = document.getElementById('hoursWorked');
    const rateInput = document.getElementById('baseRate');
    const workTypeSelect = document.getElementById('workType');
    
    const calculateTotal = () => {
      const hours = parseFloat(hoursInput?.value) || 0;
      const rate = parseFloat(rateInput?.value) || 0;
      const workType = workTypeSelect?.value || "hourly";
      const totalEl = document.getElementById('totalPay');
      
      if (totalEl) {
        const total = workType === "hourly" ? hours * rate : rate;
        if ("value" in totalEl) {
          totalEl.value = fmtMoney(total);
        } else {
          totalEl.textContent = fmtMoney(total);
        }
      }
    };

    if (hoursInput) hoursInput.addEventListener('input', calculateTotal);
    if (rateInput) rateInput.addEventListener('input', calculateTotal);
    if (workTypeSelect) workTypeSelect.addEventListener('change', calculateTotal);
  },

  setupMarksFormCalculations() {
    const scoreInput = document.getElementById('marksScore');
    const maxInput = document.getElementById('marksMax');
    if (scoreInput) scoreInput.addEventListener('input', updateMarksPercentage);
    if (maxInput) maxInput.addEventListener('input', updateMarksPercentage);
  },

  initEventListeners() {
    console.log('🔧 Initializing event listeners...');
    
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const today = new Date().toISOString().split('T')[0];
    dateInputs.forEach(input => {
      if (!input.value) {
        input.value = today;
      }
    });
    
    loadStudentsForDropdowns();
    
    console.log('✅ Event listeners initialized');
  }
};

// ===========================
// STUDENT MANAGEMENT MODULE
// ===========================

async function loadStudentsForDropdowns() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
    const studentsList = [];
    studentsSnap.forEach(doc => {
      studentsList.push({ id: doc.id, ...doc.data() });
    });
    
    updateStudentDropdowns(studentsList);
    return studentsList;
  } catch (error) {
    console.error("Error loading students:", error);
    return [];
  }
}

function updateStudentDropdowns(students) {
  const dropdowns = [
    'marksStudent',
    'paymentStudent',
    'hoursStudent'
  ];
  
  dropdowns.forEach(dropdownId => {
    const select = document.getElementById(dropdownId);
    if (select) {
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name} (${student.id})`;
        select.appendChild(option);
      });
    }
  });
}

function updateMarksPercentage() {
  const scoreEl = document.getElementById('marksScore');
  const maxEl = document.getElementById('marksMax');
  const pctEl = document.getElementById('percentage');
  const gradeEl = document.getElementById('grade');

  const score = parseFloat(scoreEl?.value);
  const max = parseFloat(maxEl?.value);

  if (Number.isFinite(score) && Number.isFinite(max) && max > 0) {
    const percentage = (score / max) * 100;
    if (pctEl) pctEl.value = percentage.toFixed(1);
    if (gradeEl) gradeEl.value = calculateGrade(percentage);
  }
}

// ===========================
// FORM MANAGEMENT FUNCTIONS
// ===========================

function clearStudentForm() {
  const form = document.getElementById("studentForm");
  if (form) form.reset();
}

function resetHoursForm() {
  const form = document.getElementById("hoursForm");
  if (form) {
    form.reset();
    console.log("✅ Hours form reset");
  }
}

function resetMarksForm() {
  const form = document.getElementById("marksForm");
  if (form) form.reset();

  const pctEl = document.getElementById("percentage");
  const gradeEl = document.getElementById("grade");
  if (pctEl) pctEl.value = "";
  if (gradeEl) gradeEl.value = "";
}

function clearAttendanceForm() {
  const dateEl = document.getElementById("attendanceDate");
  const subjectEl = document.getElementById("attendanceSubject");
  const topicEl = document.getElementById("attendanceTopic");

  if (dateEl) dateEl.value = "";
  if (subjectEl) subjectEl.value = "";
  if (topicEl) topicEl.value = "";

  document.querySelectorAll("#attendanceList input[type=checkbox]")
    .forEach(cb => cb.checked = false);
}

function resetPaymentForm() {
  const studentEl = document.getElementById("paymentStudent");
  const amountEl = document.getElementById("paymentAmount");
  const dateEl = document.getElementById("paymentDate");
  const methodEl = document.getElementById("paymentMethod");
  const notesEl = document.getElementById("paymentNotes");

  if (studentEl) studentEl.value = "";
  if (amountEl) amountEl.value = "";
  if (dateEl) dateEl.value = "";
  if (methodEl) methodEl.value = methodEl.options[0]?.value || "";
  if (notesEl) notesEl.value = "";
}

function selectAllStudents() {
  document.querySelectorAll("#attendanceList input[type=checkbox]").forEach(cb => cb.checked = true);
}

function deselectAllStudents() {
  document.querySelectorAll("#attendanceList input[type=checkbox]").forEach(cb => cb.checked = false);
}

// ===========================
// RATE MANAGEMENT FUNCTIONS
// ===========================

function saveDefaultRate() {
  const input = document.getElementById("defaultBaseRate");
  const currentDisplay = document.getElementById("currentDefaultRate");
  const hoursDisplay = document.getElementById("currentDefaultRateDisplay");

  const val = parseFloat(input?.value) || 0;
  if (currentDisplay) currentDisplay.textContent = fmtMoney(val);
  if (hoursDisplay) hoursDisplay.textContent = fmtMoney(val);
  NotificationSystem.notifySuccess("Default rate saved");
}

function applyDefaultRateToAll() {
  const val = parseFloat(document.getElementById("defaultBaseRate")?.value) || 0;
  const user = auth.currentUser;
  if (!user) return;
  
  NotificationSystem.notifyInfo("Applying default rate to all students...");
  NotificationSystem.notifyWarning("This feature needs Firestore implementation");
}

function useDefaultRate() {
  const val = parseFloat(document.getElementById("defaultBaseRate")?.value) || 0;
  const input = document.getElementById("studentBaseRate");
  if (input) input.value = fmtMoney(val);
}

function useDefaultRateInHours() {
  const defaultRateDisplay = document.getElementById("currentDefaultRateDisplay");
  const baseRateInput = document.getElementById("baseRate");
  if (defaultRateDisplay && baseRateInput) {
    baseRateInput.value = parseFloat(defaultRateDisplay.textContent) || 0;
  }
}

// ===========================
// STUDENT ACTIONS
// ===========================

async function editStudent(studentId) {
  NotificationSystem.notifyInfo("Edit student feature coming soon");
}

async function deleteStudent(studentId) {
  if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
    const user = auth.currentUser;
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "students", studentId));
        NotificationSystem.notifySuccess("Student deleted successfully");
        await renderStudents();
        await loadStudentsForDropdowns();
      } catch (error) {
        console.error("Error deleting student:", error);
        NotificationSystem.notifyError("Failed to delete student");
      }
    }
  }
}

// ===========================
// APP INITIALIZATION
// ===========================

function initializeApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  UIManager.init();
  SyncBar.init();
  
  if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
  if (syncMessageLine) syncMessageLine.textContent = "Status: Connected";
  
  const user = auth.currentUser;
  if (user) {
    console.log('👤 User authenticated, loading data...');
    loadInitialData(user);
  }
  
  console.log('✅ WorkLog App Fully Initialized');
}

async function loadInitialData(user) {
  try {
    await Promise.all([
      loadUserStats(user.uid),
      loadStudentsForDropdowns(),
      renderStudents(),
      renderRecentHours(),
      renderRecentMarks(),
      renderAttendanceRecent(),
      renderPaymentActivity(),
      renderStudentBalances(),
      renderOverviewReports()
    ]);
    console.log('✅ Initial data loaded');
  } catch (error) {
    console.error('❌ Error loading initial data:', error);
  }
}

// ===========================
// AUTH STATE MANAGEMENT
// ===========================

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('✅ User authenticated:', user.email);
    document.querySelector(".container").style.display = "block";
    
    if (typeof initializeApp === 'function') {
      loadInitialData(user);
    }
  } else {
    console.log('🚫 No user authenticated - redirecting to login');
    window.location.href = "auth.html";
  }
});

// ===========================
// BOOT THE APPLICATION
// ===========================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
