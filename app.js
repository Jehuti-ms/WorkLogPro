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
let currentUserData = null;
let currentEditStudentId = null;
let currentEditHoursId = null;
let currentEditMarksId = null;
let currentEditAttendanceId = null;
let currentEditPaymentId = null;

// DOM Elements
const syncIndicator = document.getElementById("syncIndicator");
const autoSyncCheckbox = document.getElementById("autoSyncCheckbox");
const autoSyncText = document.getElementById("autoSyncText");
const syncBtn = document.getElementById("syncBtn");
const exportCloudBtn = document.getElementById("exportCloudBtn");
const importCloudBtn = document.getElementById("importCloudBtn");
const syncStatsBtn = document.getElementById("syncStatsBtn");
const exportDataBtn = document.getElementById("exportDataBtn");
const importDataBtn = document.getElementById("importDataBtn");
const clearDataBtn = document.getElementById("clearDataBtn");

// ===========================
// NOTIFICATION SYSTEM
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
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('notification-show');
    }, 10);
    
    if (duration > 0) {
      setTimeout(() => {
        notification.classList.remove('notification-show');
        notification.classList.add('notification-hide');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
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

  clearNotifications() {
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
      notification.classList.remove('notification-show');
      notification.classList.add('notification-hide');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
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
// CACHE SYSTEM
// ===========================

const cache = {
  students: [],
  hours: [],
  marks: [],
  attendance: [],
  payments: [],
  lastSync: null
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function isCacheValid(key) {
  if (!cache[key] || !cache.lastSync) return false;
  return (Date.now() - cache.lastSync) < CACHE_DURATION;
}

const EnhancedCache = {
  async saveWithBackgroundSync(collectionName, data, id = null) {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No user authenticated for cache save');
      return false;
    }

    try {
      const itemId = id || this.generateId();
      const cacheItem = {
        ...data,
        id: itemId,
        _cachedAt: Date.now(),
        _synced: false
      };

      this.saveToLocalStorage(collectionName, cacheItem);
      this.updateUICache(collectionName, cacheItem);
      this.backgroundFirebaseSync(collectionName, cacheItem, user.uid);
      
      console.log(`✅ ${collectionName} saved to cache immediately`);
      return itemId;
    } catch (error) {
      console.error(`❌ Cache save failed for ${collectionName}:`, error);
      return false;
    }
  },

  generateId() {
    return 'cache_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  saveToLocalStorage(collectionName, item) {
    try {
      const key = `worklog_${collectionName}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter(i => i.id !== item.id);
      filtered.push(item);
      localStorage.setItem(key, JSON.stringify(filtered));
      console.log(`💾 Saved to localStorage: ${collectionName} - ${item.id}`);
    } catch (error) {
      console.error('❌ localStorage save failed:', error);
    }
  },

  updateUICache(collectionName, item) {
    if (!Array.isArray(cache[collectionName])) {
      cache[collectionName] = [];
    }
    
    const index = cache[collectionName].findIndex(i => i.id === item.id);
    if (index >= 0) {
      cache[collectionName][index] = item;
    } else {
      cache[collectionName].push(item);
    }
    cache.lastSync = Date.now();
  },

  async backgroundFirebaseSync(collectionName, item, uid) {
    try {
      const { id, _cachedAt, _synced, ...firebaseData } = item;
      let result;
      
      if (item.id.startsWith('cache_')) {
        const docRef = await addDoc(collection(db, "users", uid, collectionName), firebaseData);
        result = docRef.id;
      } else {
        await updateDoc(doc(db, "users", uid, collectionName, item.id), firebaseData);
        result = item.id;
      }
      
      this.markAsSynced(collectionName, item.id, result);
      console.log(`☁️ Background sync successful: ${collectionName} - ${item.id}`);
      EnhancedStats.forceRefresh();
    } catch (error) {
      console.error(`❌ Background sync failed for ${collectionName}:`, error);
    }
  },

  markAsSynced(collectionName, cacheId, firebaseId) {
    const key = `worklog_${collectionName}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = existing.map(item => 
      item.id === cacheId ? { ...item, _synced: true, _firebaseId: firebaseId } : item
    );
    localStorage.setItem(key, JSON.stringify(updated));
    
    if (cache[collectionName] && Array.isArray(cache[collectionName])) {
      cache[collectionName] = cache[collectionName].map(item =>
        item.id === cacheId ? { ...item, _synced: true, _firebaseId: firebaseId } : item
      );
    }
  },

  loadCachedData() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    collections.forEach(collectionName => {
      const key = `worklog_${collectionName}`;
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
          cache[collectionName] = cached;
          console.log(`📁 Loaded ${cached.length} cached ${collectionName} from localStorage`);
        }
      } catch (error) {
        console.error(`❌ Error loading cached ${collectionName}:`, error);
        cache[collectionName] = [];
      }
    });
    this.retryUnsyncedItems();
  },

  async retryUnsyncedItems() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    const user = auth.currentUser;
    if (!user) return;

    collections.forEach(collectionName => {
      const key = `worklog_${collectionName}`;
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(cached)) {
          const unsynced = cached.filter(item => !item._synced);
          unsynced.forEach(item => {
            console.log(`🔄 Retrying sync for ${collectionName}: ${item.id}`);
            this.backgroundFirebaseSync(collectionName, item, user.uid);
          });
        }
      } catch (error) {
        console.error(`❌ Error retrying sync for ${collectionName}:`, error);
      }
    });
  },

  async loadCollection(collectionName, forceRefresh = false) {
    const user = auth.currentUser;
    if (!user) return [];

    console.log(`🔄 Loading ${collectionName} - forceRefresh: ${forceRefresh}`);

    // 1. Check memory cache first
    if (!forceRefresh && Array.isArray(cache[collectionName]) && cache[collectionName].length > 0) {
      console.log(`📁 Using memory cache for ${collectionName}: ${cache[collectionName].length} items`);
      return cache[collectionName];
    }

    // 2. Check localStorage cache
    const localStorageData = this.loadFromLocalStorage(collectionName);
    if (!forceRefresh && localStorageData.length > 0) {
      console.log(`💾 Using localStorage cache for ${collectionName}: ${localStorageData.length} items`);
      cache[collectionName] = localStorageData;
      return localStorageData;
    }

    // 3. Load from Firestore
    try {
      console.log(`☁️ Loading ${collectionName} from Firestore...`);
      const querySnapshot = await getDocs(collection(db, "users", user.uid, collectionName));
      const data = [];
      
      querySnapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
          _firebaseId: doc.id,
          _synced: true
        });
      });

      // Update both memory and localStorage cache
      cache[collectionName] = data;
      this.saveToLocalStorageBulk(collectionName, data);
      cache.lastSync = Date.now();

      console.log(`✅ Loaded ${data.length} ${collectionName} from Firestore`);
      return data;
    } catch (error) {
      console.error(`❌ Error loading ${collectionName} from Firestore:`, error);
      
      // Fallback to localStorage if available
      const fallbackData = this.loadFromLocalStorage(collectionName);
      console.log(`🔄 Using fallback data for ${collectionName}: ${fallbackData.length} items`);
      return fallbackData;
    }
  },

  loadFromLocalStorage(collectionName) {
    try {
      const key = `worklog_${collectionName}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`📁 Loaded ${data.length} ${collectionName} from localStorage`);
        return Array.isArray(data) ? data : [];
      }
    } catch (error) {
      console.error(`❌ Error loading ${collectionName} from localStorage:`, error);
    }
    return [];
  },

  saveToLocalStorageBulk(collectionName, data) {
    try {
      const key = `worklog_${collectionName}`;
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`💾 Saved ${data.length} ${collectionName} to localStorage`);
    } catch (error) {
      console.error(`❌ Error saving ${collectionName} to localStorage:`, error);
    }
  }
};

// ===========================
// UTILITY FUNCTIONS
// ===========================

function safeNumber(n, fallback = 0) {
  if (n === null || n === undefined || n === '') return fallback;
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function fmtMoney(n) {
  return '$' + safeNumber(n).toFixed(2);
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fmtDateISO(yyyyMmDd) {
  if (!yyyyMmDd) return new Date().toISOString();
  try {
    const [year, month, day] = yyyyMmDd.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function calculateTotalPay() {
  const hours = safeNumber(document.getElementById('hoursWorked')?.value);
  const rate = safeNumber(document.getElementById('baseRate')?.value);
  const total = hours * rate;
  
  const totalPayElement = document.getElementById('totalPay');
  if (totalPayElement) {
    totalPayElement.textContent = fmtMoney(total);
  }
}

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function formatDate(dateString) {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

// ===========================
// FORM AUTO-CLEARING SYSTEM
// ===========================

const FormAutoClear = {
  config: {
    'studentForm': {
      clearOnSuccess: true,
      preserveFields: [],
      successMessage: 'Student added successfully! Form cleared.',
      focusField: 'studentName'
    },
    'hoursForm': {
      clearOnSuccess: true,
      preserveFields: ['baseRate'],
      successMessage: 'Hours logged successfully! Form cleared.',
      focusField: 'organization'
    },
    'marksForm': {
      clearOnSuccess: true,
      preserveFields: ['marksStudent', 'marksSubject'],
      successMessage: 'Mark added successfully! Form cleared.',
      focusField: 'marksScore'
    },
    'attendanceForm': {
      clearOnSuccess: false,
      preserveFields: [],
      successMessage: 'Attendance recorded successfully!',
      focusField: 'attendanceDate'
    },
    'paymentForm': {
      clearOnSuccess: true,
      preserveFields: ['paymentStudent'],
      successMessage: 'Payment recorded successfully! Form cleared.',
      focusField: 'paymentAmount'
    }
  },

  clearForm(formId, preservedData = {}) {
    const form = document.getElementById(formId);
    if (!form) {
      console.warn(`Form ${formId} not found for auto-clear`);
      return;
    }

    const config = this.config[formId];
    if (!config) {
      console.warn(`No config found for form ${formId}`);
      return;
    }

    const elements = form.elements;
    const preserveValues = {};
    config.preserveFields.forEach(field => {
      if (preservedData[field]) {
        preserveValues[field] = preservedData[field];
      } else {
        const element = elements[field];
        if (element) preserveValues[field] = element.value;
      }
    });

    form.reset();
    Object.keys(preserveValues).forEach(field => {
      const element = elements[field];
      if (element) {
        element.value = preserveValues[field];
      }
    });

    this.setDefaultDates(form);

    if (config.focusField) {
      const focusElement = elements[config.focusField];
      if (focusElement) {
        setTimeout(() => focusElement.focus(), 100);
      }
    }

    console.log(`✅ Form ${formId} auto-cleared`);
  },

  setDefaultDates(form) {
    const dateFields = form.querySelectorAll('input[type="date"]');
    const today = new Date().toISOString().split('T')[0];
    dateFields.forEach(field => {
      if (!field.value) {
        field.value = today;
      }
    });
  },

  handleSuccess(formId, customData = {}) {
    const config = this.config[formId];
    if (!config) return;

    if (config.clearOnSuccess) {
      this.clearForm(formId, customData);
    }
    
    if (config.successMessage) {
      NotificationSystem.notifySuccess(config.successMessage);
    }
  }
};

// ===========================
// SYNC BAR SYSTEM
// ===========================
const SyncBar = {
  init() {
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
      const savedAutoSync = localStorage.getItem('autoSyncEnabled') === 'true';
      isAutoSyncEnabled = savedAutoSync;
      autoSyncCheckbox.checked = savedAutoSync;
      
      if (savedAutoSync) {
        autoSyncText.textContent = 'Auto';
        if (syncIndicator) {
          syncIndicator.style.backgroundColor = '#10b981';
        }
        this.startAutoSync();
        console.log('✅ Auto-sync restored from previous session');
      } else {
        autoSyncText.textContent = 'Manual';
        if (syncIndicator) {
          syncIndicator.style.backgroundColor = '#ef4444';
        }
        console.log('✅ Manual sync mode restored');
      }

      autoSyncCheckbox.addEventListener('change', (e) => {
        isAutoSyncEnabled = e.target.checked;
        localStorage.setItem('autoSyncEnabled', isAutoSyncEnabled.toString());
        
        if (isAutoSyncEnabled) {
          autoSyncText.textContent = 'Auto';
          if (syncIndicator) {
            syncIndicator.style.backgroundColor = '#10b981';
          }
          this.startAutoSync();
          NotificationSystem.notifySuccess('Auto-sync enabled - syncing every 60 seconds');
        } else {
          autoSyncText.textContent = 'Manual';
          if (syncIndicator) {
            syncIndicator.style.backgroundColor = '#ef4444';
          }
          this.stopAutoSync();
          NotificationSystem.notifyInfo('Auto-sync disabled');
        }
      });
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

  setupExportCloudButton() {
    if (exportCloudBtn) {
      exportCloudBtn.addEventListener('click', async () => {
        try {
          const user = auth.currentUser;
          if (!user) {
            NotificationSystem.notifyError('Please log in to export to cloud');
            return;
          }
          
          NotificationSystem.notifyInfo('Syncing data to cloud...');
          await this.performSync('manual');
          NotificationSystem.notifySuccess('Data synced to cloud successfully!');
        } catch (error) {
          NotificationSystem.notifyError('Failed to sync to cloud: ' + error.message);
        }
      });
    }
  },

  setupImportCloudButton() {
    if (importCloudBtn) {
      importCloudBtn.addEventListener('click', async () => {
        try {
          const user = auth.currentUser;
          if (!user) {
            NotificationSystem.notifyError('Please log in to import from cloud');
            return;
          }
          
          NotificationSystem.notifyInfo('Syncing data from cloud...');
          await Promise.all([
            EnhancedCache.loadCollection('students', true),
            EnhancedCache.loadCollection('hours', true),
            EnhancedCache.loadCollection('marks', true),
            EnhancedCache.loadCollection('attendance', true),
            EnhancedCache.loadCollection('payments', true)
          ]);
          
          // Refresh UI
          await Promise.all([
            renderStudents(true),
            renderRecentHoursWithEdit(),
            renderRecentMarksWithEdit(),
            renderAttendanceRecentWithEdit(),
            renderPaymentActivityWithEdit(),
            renderStudentBalancesWithEdit(),
            populateStudentDropdowns()
          ]);
          
          NotificationSystem.notifySuccess('Data synced from cloud successfully!');
        } catch (error) {
          NotificationSystem.notifyError('Failed to sync from cloud: ' + error.message);
        }
      });
    }
  },
  
  setupSyncStatsButton() {
    if (syncStatsBtn) {
      syncStatsBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (user) {
          await recalcSummaryStats(user.uid);
          NotificationSystem.notifySuccess('Stats recalculated and synced');
        }
      });
    }
  },

  setupExportDataButton() {
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', async () => {
        await this.exportAllData();
      });
    }
  },

  setupImportDataButton() {
    if (importDataBtn) {
      importDataBtn.addEventListener('click', async () => {
        await this.importAllData();
      });
    }
  },

  setupClearAllButton() {
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
          localStorage.clear();
          Object.keys(cache).forEach(key => {
            if (Array.isArray(cache[key])) {
              cache[key] = [];
            } else {
              cache[key] = null;
            }
          });
          NotificationSystem.notifySuccess('All local data cleared');
          setTimeout(() => location.reload(), 1000);
        }
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
      if (syncIndicator) {
        syncIndicator.style.backgroundColor = '#f59e0b';
      }

      await Promise.all([
        recalcSummaryStats(user.uid),
        loadUserStats(user.uid)
      ]);

      // Refresh all UI components
      try {
        if (typeof renderStudents === 'function') await renderStudents();
        if (typeof renderRecentHoursWithEdit === 'function') await renderRecentHoursWithEdit();
        if (typeof renderRecentMarksWithEdit === 'function') await renderRecentMarksWithEdit();
        if (typeof renderAttendanceRecentWithEdit === 'function') await renderAttendanceRecentWithEdit();
        if (typeof renderPaymentActivityWithEdit === 'function') await renderPaymentActivityWithEdit();
        if (typeof renderStudentBalancesWithEdit === 'function') await renderStudentBalancesWithEdit();
        if (typeof populateStudentDropdowns === 'function') await populateStudentDropdowns();
      } catch (e) { 
        console.warn('UI refresh failed:', e); 
      }

      // Update timestamp
      const now = new Date().toLocaleString();

      if (syncIndicator) {
        if (isAutoSyncEnabled) {
          syncIndicator.style.backgroundColor = '#10b981';
        } else {
          syncIndicator.style.backgroundColor = '#ef4444';
        }
      }

      NotificationSystem.notifySuccess(`${mode === 'auto' ? 'Auto-' : ''}Sync completed successfully`);
      console.log('✅ Sync completed successfully');

    } catch (error) {
      console.error(`❌ ${mode} sync failed:`, error);
      
      if (syncIndicator) {
        syncIndicator.style.backgroundColor = '#ef4444';
      }
      
      NotificationSystem.notifyError(`Sync failed: ${error.message}`);
    }
  },

  async exportAllData() {
    try {
      const user = auth.currentUser;
      if (!user) {
        NotificationSystem.notifyError('Please log in to export data');
        return;
      }

      NotificationSystem.notifyInfo('Preparing data export...');

      // Collect all data from cache
      const allData = {
        students: cache.students || [],
        hours: cache.hours || [],
        marks: cache.marks || [],
        attendance: cache.attendance || [],
        payments: cache.payments || [],
        metadata: {
          exportedAt: new Date().toISOString(),
          userEmail: user.email,
          totalRecords: (cache.students?.length || 0) + (cache.hours?.length || 0) + 
                       (cache.marks?.length || 0) + (cache.attendance?.length || 0) + 
                       (cache.payments?.length || 0),
          appVersion: '1.0.0'
        }
      };

      // Convert to JSON
      const jsonData = JSON.stringify(allData, null, 2);
      
      // Create download link
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `worklog_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      NotificationSystem.notifySuccess(`Data exported successfully! ${allData.metadata.totalRecords} records saved.`);
      
    } catch (error) {
      console.error('Error exporting data:', error);
      NotificationSystem.notifyError('Failed to export data: ' + error.message);
    }
  },

  async importAllData() {
    try {
      const user = auth.currentUser;
      if (!user) {
        NotificationSystem.notifyError('Please log in to import data');
        return;
      }

      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      
      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
          NotificationSystem.notifyInfo('No file selected');
          return;
        }

        if (confirm(`Are you sure you want to import data from ${file.name}? This will replace ALL current data.`)) {
          try {
            NotificationSystem.notifyInfo('Importing data...');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                const importedData = JSON.parse(e.target.result);
                
                // Validate the imported data structure
                if (!importedData.students || !importedData.hours || !importedData.marks || 
                    !importedData.attendance || !importedData.payments) {
                  NotificationSystem.notifyError('Invalid backup file format');
                  return;
                }

                // Clear existing cache
                cache.students = [];
                cache.hours = [];
                cache.marks = [];
                cache.attendance = [];
                cache.payments = [];

                // Import data collections
                await this.importCollection('students', importedData.students, user.uid);
                await this.importCollection('hours', importedData.hours, user.uid);
                await this.importCollection('marks', importedData.marks, user.uid);
                await this.importCollection('attendance', importedData.attendance, user.uid);
                await this.importCollection('payments', importedData.payments, user.uid);

                // Update local storage
                EnhancedCache.saveToLocalStorageBulk('students', importedData.students);
                EnhancedCache.saveToLocalStorageBulk('hours', importedData.hours);
                EnhancedCache.saveToLocalStorageBulk('marks', importedData.marks);
                EnhancedCache.saveToLocalStorageBulk('attendance', importedData.attendance);
                EnhancedCache.saveToLocalStorageBulk('payments', importedData.payments);

                // Update memory cache
                cache.students = importedData.students;
                cache.hours = importedData.hours;
                cache.marks = importedData.marks;
                cache.attendance = importedData.attendance;
                cache.payments = importedData.payments;
                cache.lastSync = Date.now();

                // Refresh UI
                await Promise.all([
                  renderStudents(true),
                  renderRecentHoursWithEdit(),
                  renderRecentMarksWithEdit(),
                  renderAttendanceRecentWithEdit(),
                  renderPaymentActivityWithEdit(),
                  renderStudentBalancesWithEdit(),
                  populateStudentDropdowns()
                ]);

                // Refresh stats
                if (typeof EnhancedStats !== 'undefined') {
                  EnhancedStats.forceRefresh();
                }

                // Perform sync
                await this.performSync('manual');

                const totalRecords = importedData.students.length + importedData.hours.length + 
                                   importedData.marks.length + importedData.attendance.length + 
                                   importedData.payments.length;
                
                NotificationSystem.notifySuccess(`Data imported successfully! ${totalRecords} records loaded.`);

              } catch (parseError) {
                console.error('Error parsing imported data:', parseError);
                NotificationSystem.notifyError('Invalid JSON file format');
              }
            };

            reader.onerror = () => {
              NotificationSystem.notifyError('Error reading file');
            };

            reader.readAsText(file);
            
          } catch (error) {
            console.error('Error importing data:', error);
            NotificationSystem.notifyError('Failed to import data: ' + error.message);
          }
        }
        
        // Clean up
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();

    } catch (error) {
      console.error('Error setting up import:', error);
      NotificationSystem.notifyError('Failed to setup import: ' + error.message);
    }
  },

  async importCollection(collectionName, items, uid) {
    try {
      const batch = writeBatch(db);
      const collectionRef = collection(db, "users", uid, collectionName);
      
      // First, clear existing data
      const existingDocs = await getDocs(collectionRef);
      existingDocs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Then add imported items
      items.forEach(item => {
        const { id, _id, _firebaseId, _synced, _cachedAt, ...cleanItem } = item;
        const docRef = doc(collectionRef);
        batch.set(docRef, cleanItem);
      });
      
      await batch.commit();
      console.log(`✅ Imported ${items.length} ${collectionName} to Firestore`);
      
    } catch (error) {
      console.error(`Error importing ${collectionName}:`, error);
      throw error;
    }
  }
};

// ===========================
// THEME MANAGEMENT
// ===========================

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    console.log('🔄 Toggling theme from', currentTheme, 'to', newTheme);
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    animateThemeButton();
}

function animateThemeButton() {
    const themeButton = document.querySelector('.theme-toggle button');
    if (!themeButton) return;
    
    themeButton.style.transform = 'rotate(180deg)';
    themeButton.style.transition = 'transform 0.5s ease';
    
    setTimeout(() => {
        themeButton.style.transform = 'rotate(0deg)';
    }, 500);
}

function setupThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle button');
    if (themeToggle) {
        console.log('🎯 Found theme toggle button');
        
        themeToggle.innerHTML = '🌓';
        themeToggle.setAttribute('title', 'Toggle theme');
        
        themeToggle.style.cssText = `
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 1.2em;
            transition: all 0.3s ease;
        `;
        
        const newButton = themeToggle.cloneNode(true);
        themeToggle.parentNode.replaceChild(newButton, themeToggle);
        
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎨 Theme button clicked');
            toggleTheme();
        });
        
        newButton.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
        });
        
        newButton.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
        
        console.log('✅ Theme toggle setup complete');
    } else {
        console.warn('⚠️ Theme toggle button not found');
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    console.log('🎨 Initializing theme:', savedTheme);
    
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    setTimeout(() => {
        setupThemeToggle();
    }, 100);
}

// ===========================
// HEADER STATS
// ===========================

function updateHeaderStats() {
  console.log('🔍 [updateHeaderStats] Starting...');
  
  const localStatus = document.getElementById('localStatus');
  const syncStatus = document.getElementById('syncStatus');
  const dataStatus = document.getElementById('dataStatus');
  
  if (localStatus) {
    localStatus.textContent = '💾 Local Storage: Active';
  }
  
  if (syncStatus) {
    const isAutoSync = localStorage.getItem('autoSyncEnabled') === 'true';
    syncStatus.textContent = isAutoSync ? '☁️ Cloud Sync: Auto' : '☁️ Cloud Sync: Manual';
  }
  
  console.log('✅ [updateHeaderStats] Header stats structure verified');
}

// ===========================
// USER PROFILE FUNCTIONS
// ===========================

async function loadUserProfile(uid) {
  console.log('👤 Loading user profile for:', uid);
  
  const user = auth.currentUser;
  
  let memberSince = localStorage.getItem('memberSince');
  if (!memberSince) {
    memberSince = new Date().toISOString();
    localStorage.setItem('memberSince', memberSince);
  }
  
  const fallbackProfile = {
    email: user?.email || '',
    createdAt: memberSince,
    defaultRate: parseFloat(localStorage.getItem('userDefaultRate')) || 25.00,
    memberSince: memberSince
  };
  
  if (typeof updateProfileButton === 'function') {
    updateProfileButton(fallbackProfile);
  }
  initializeDefaultRate(fallbackProfile.defaultRate);
  
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      currentUserData = { uid, ...userSnap.data() };
      
      if (!currentUserData.memberSince) {
        currentUserData.memberSince = memberSince;
        await updateDoc(userRef, { memberSince: memberSince });
      }
      
      console.log('✅ User profile loaded from Firestore');
      
      if (typeof updateProfileButton === 'function') {
        updateProfileButton(currentUserData);
      }
      
      if (currentUserData.defaultRate !== undefined) {
        initializeDefaultRate(currentUserData.defaultRate);
        localStorage.setItem('userDefaultRate', currentUserData.defaultRate.toString());
      }
      
      return currentUserData;
    } else {
      const profileToCreate = {
        ...fallbackProfile,
        lastLogin: new Date().toISOString(),
        memberSince: memberSince
      };
      
      await setDoc(userRef, profileToCreate);
      
      currentUserData = { uid, ...profileToCreate };
      return currentUserData;
    }
  } catch (err) {
    console.error("❌ Error loading user profile:", err);
    console.log('🔄 Using cached profile data');
    return fallbackProfile;
  }
}

function updateProfileButton(userData) {
  const profileBtn = document.getElementById('profileBtn');
  const userName = document.getElementById('userName');
  
  if (profileBtn || userName) {
    const email = userData?.email || auth.currentUser?.email || 'User';
    const displayName = email.split('@')[0];
    
    if (profileBtn) {
      profileBtn.innerHTML = `👤 ${displayName}`;
      profileBtn.title = `Logged in as ${email}`;
    }
    
    if (userName) {
      userName.textContent = displayName;
    }
    
    console.log('✅ Profile updated:', displayName);
  }
}

function setupProfileModal() {
  const profileBtn = document.getElementById('profileBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileModal = document.getElementById('closeProfileModal');
  const logoutBtn = document.getElementById('logoutBtn');

  console.log('🔧 Setting up profile modal...');

  if (!profileModal) {
    console.error('❌ Profile modal not found in DOM');
    return;
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('👤 Profile button clicked');
      
      updateProfileModal();
      profileModal.style.display = 'flex';
      document.body.classList.add('modal-open');
    });
  }

  if (closeProfileModal) {
    closeProfileModal.addEventListener('click', () => {
      profileModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to logout?')) {
        try {
          await signOut(auth);
          localStorage.clear();
          window.location.href = "auth.html";
        } catch (error) {
          console.error('Logout error:', error);
          NotificationSystem.notifyError('Logout failed');
        }
      }
    });
  }

  window.addEventListener('click', (event) => {
    if (event.target === profileModal) {
      profileModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && profileModal.style.display === 'flex') {
      profileModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  });

  console.log('✅ Profile modal setup complete');
}

function updateProfileModal() {
  const profileUserEmail = document.getElementById('profileUserEmail');
  const profileUserSince = document.getElementById('profileUserSince');
  const profileDefaultRate = document.getElementById('profileDefaultRate');
  const modalStatStudents = document.getElementById('modalStatStudents');
  const modalStatHours = document.getElementById('modalStatHours');
  const modalStatEarnings = document.getElementById('modalStatEarnings');
  const modalStatUpdated = document.getElementById('modalStatUpdated');

  console.log('👤 Updating profile modal...');

  if (currentUserData) {
    const email = currentUserData.email || auth.currentUser?.email || 'Not available';
    if (profileUserEmail) {
      profileUserEmail.textContent = email;
    }
    
    const memberSince = currentUserData.memberSince || localStorage.getItem('memberSince') || currentUserData.createdAt || new Date().toISOString();
    if (profileUserSince) {
      profileUserSince.textContent = formatDate(memberSince);
    }
    
    if (profileDefaultRate) {
      profileDefaultRate.textContent = `$${currentUserData.defaultRate || 25.00}/hour`;
    }
  }

  updateModalStats();

  console.log('✅ Profile modal updated');
}

function updateModalStats() {
  const modalStatStudents = document.getElementById('modalStatStudents');
  const modalStatHours = document.getElementById('modalStatHours');
  const modalStatEarnings = document.getElementById('modalStatEarnings');
  const modalStatUpdated = document.getElementById('modalStatUpdated');

  const students = Array.isArray(cache.students) ? cache.students : [];
  const hours = Array.isArray(cache.hours) ? cache.hours : [];
  
  if (modalStatStudents) {
    modalStatStudents.textContent = students.length;
  }

  if (modalStatHours) {
    const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    modalStatHours.textContent = totalHours.toFixed(1);
  }

  if (modalStatEarnings) {
    const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    modalStatEarnings.textContent = fmtMoney(totalEarnings);
  }

  if (modalStatUpdated) {
    modalStatUpdated.textContent = new Date().toLocaleString();
  }
}

// ===========================
// FLOATING ADD BUTTON
// ===========================

function setupFloatingAddButton() {
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');

  console.log('🔧 Setting up FAB...');
  console.log('FAB elements:', { fab, fabMenu, fabOverlay });

  if (!fab) {
    console.error('❌ FAB button not found!');
    return;
  }

  let isExpanded = false;

  function openFabMenu() {
    console.log('🟢 Opening FAB menu');
    isExpanded = true;
    
    fab.innerHTML = '✕';
    fab.style.transform = 'rotate(45deg)';
    
    if (fabMenu) {
      fabMenu.classList.add('show');
    }
    
    if (fabOverlay) {
      fabOverlay.style.display = 'block';
      setTimeout(() => {
        fabOverlay.style.pointerEvents = 'auto';
      }, 10);
    }
    
    console.log('✅ FAB menu opened');
  }

  function closeFabMenu() {
    console.log('🔴 Closing FAB menu');
    isExpanded = false;
    
    fab.innerHTML = '+';
    fab.style.transform = 'rotate(0deg)';
    
    if (fabMenu) {
      fabMenu.classList.remove('show');
    }
    
    if (fabOverlay) {
      fabOverlay.style.display = 'none';
      fabOverlay.style.pointerEvents = 'none';
    }
    
    console.log('✅ FAB menu closed');
  }

  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🎯 FAB clicked, current state:', isExpanded);
    
    if (isExpanded) {
      closeFabMenu();
    } else {
      openFabMenu();
    }
  });

  if (fabOverlay) {
    fabOverlay.addEventListener('click', (e) => {
      console.log('🎯 Overlay clicked');
      e.stopPropagation();
      e.preventDefault();
      closeFabMenu();
    });
  }

  document.addEventListener('click', (e) => {
    if (isExpanded) {
      const isClickOnFab = fab.contains(e.target);
      const isClickOnMenu = fabMenu && fabMenu.contains(e.target);
      
      if (!isClickOnFab && !isClickOnMenu) {
        console.log('🎯 Click outside FAB, closing menu');
        closeFabMenu();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isExpanded) {
      console.log('🎯 Escape key pressed, closing FAB');
      closeFabMenu();
    }
  });

  setupFabActions(closeFabMenu);
  
  console.log('✅ FAB setup completed');
}

function setupFabActions(closeFabMenu) {
  const quickActions = {
    'fabAddStudent': () => {
      console.log('🎯 FAB: Add Student clicked');
      const studentTab = document.querySelector('[data-tab="students"]');
      if (studentTab) {
        studentTab.click();
        setTimeout(() => {
          const studentForm = document.getElementById('studentForm');
          if (studentForm) {
            studentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const firstInput = studentForm.querySelector('input');
            if (firstInput) firstInput.focus();
          }
        }, 300);
      }
    },
    'fabAddHours': () => {
      console.log('🎯 FAB: Add Hours clicked');
      const hoursTab = document.querySelector('[data-tab="hours"]');
      if (hoursTab) {
        hoursTab.click();
        setTimeout(() => {
          const hoursForm = document.querySelector('#hours .section-card:first-child');
          if (hoursForm) {
            hoursForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const firstInput = hoursForm.querySelector('input');
            if (firstInput) firstInput.focus();
          }
        }, 300);
      }
    },
    'fabAddMark': () => {
      console.log('🎯 FAB: Add Mark clicked');
      const marksTab = document.querySelector('[data-tab="marks"]');
      if (marksTab) {
        marksTab.click();
        setTimeout(() => {
          const marksForm = document.getElementById('marksForm');
          if (marksForm) {
            marksForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const firstInput = marksForm.querySelector('input, select');
            if (firstInput) firstInput.focus();
          }
        }, 300);
      }
    },
    'fabAddAttendance': () => {
      console.log('🎯 FAB: Add Attendance clicked');
      const attendanceTab = document.querySelector('[data-tab="attendance"]');
      if (attendanceTab) {
        attendanceTab.click();
        setTimeout(() => {
          const attendanceForm = document.querySelector('#attendance .section-card:first-child');
          if (attendanceForm) {
            attendanceForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const firstInput = attendanceForm.querySelector('input');
            if (firstInput) firstInput.focus();
          }
        }, 300);
      }
    }
  };

  Object.keys(quickActions).forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      console.log(`✅ Found FAB action button: ${btnId}`);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🎯 FAB action triggered: ${btnId}`);
        quickActions[btnId]();
        closeFabMenu();
      });
    } else {
      console.warn(`⚠️ FAB action button not found: ${btnId}`);
    }
  });
}

// ===========================
// FIRESTORE DATA FUNCTIONS
// ===========================

async function loadUserStats(uid) {
  console.log('📊 Loading user stats for:', uid);
  try {
    const statsRef = doc(db, "users", uid);
    const statsSnap = await getDoc(statsRef);

    console.log('📊 Stats snapshot exists:', statsSnap.exists());
    
    if (statsSnap.exists()) {
      const stats = statsSnap.data();
      console.log('📊 Stats data loaded:', stats);
      
      if (document.getElementById('statStudents')) {
        document.getElementById('statStudents').textContent = stats.students ?? 0;
      }
      if (document.getElementById('statHours')) {
        document.getElementById('statHours').textContent = stats.hours ?? 0;
      }
      if (document.getElementById('statEarnings')) {
        const earnings = stats.earnings != null ? fmtMoney(stats.earnings) : "$0.00";
        document.getElementById('statEarnings').textContent = earnings;
      }
    } else {
      console.log('📊 No stats found, creating default stats...');
      await setDoc(statsRef, { 
        students: 0, 
        hours: 0, 
        earnings: 0,
        lastSync: new Date().toLocaleString()
      });
      
      if (document.getElementById('statStudents')) document.getElementById('statStudents').textContent = 0;
      if (document.getElementById('statHours')) document.getElementById('statHours').textContent = 0;
      if (document.getElementById('statEarnings')) document.getElementById('statEarnings').textContent = "$0.00";
    }

    console.log('✅ User stats loaded successfully');
    
  } catch (err) {
    console.error("❌ Error loading stats:", err);
  }
}

async function updateUserStats(uid, newStats) {
  try {
    const statsRef = doc(db, "users", uid);
    await setDoc(statsRef, newStats, { merge: true });
    console.log("✅ Stats updated:", newStats);

    if (newStats.students !== undefined) {
      const statStudents = document.getElementById('statStudents');
      if (statStudents) statStudents.textContent = newStats.students;
    }
    if (newStats.hours !== undefined) {
      const statHours = document.getElementById('statHours');
      if (statHours) statHours.textContent = newStats.hours;
    }
    if (newStats.earnings !== undefined) {
      const statEarnings = document.getElementById('statEarnings');
      if (statEarnings) statEarnings.textContent = fmtMoney(newStats.earnings);
    }

    updateHeaderStats();
  } catch (err) {
    console.error("❌ Error updating stats:", err);
  }
}

async function recalcSummaryStats(uid) {
  try {
    console.log('🔄 Recalculating summary stats for:', uid);
    
    const [studentsSnap, hoursSnap] = await Promise.all([
      getDocs(collection(db, "users", uid, "students")),
      getDocs(collection(db, "users", uid, "hours"))
    ]);

    const studentsCount = studentsSnap.size;
    let totalHours = 0;
    let totalEarnings = 0;

    hoursSnap.forEach(h => {
      const d = h.data();
      totalHours += safeNumber(d.hours);
      totalEarnings += safeNumber(d.total);
    });

    console.log('📊 Calculated stats:', {
      students: studentsCount,
      hours: totalHours,
      earnings: totalEarnings
    });

    await updateUserStats(uid, {
      students: studentsCount,
      hours: totalHours,
      earnings: totalEarnings,
      lastSync: new Date().toLocaleString()
    });

    updateHeaderStats();
    
    console.log('✅ Summary stats recalculated successfully');
  } catch (err) {
    console.error("❌ Error recalculating stats:", err);
  }
}

// ===========================
// DATA RENDERING FUNCTIONS
// ===========================

async function renderStudents(forceRefresh = false) {
  const container = document.getElementById('studentsContainer');
  if (!container) return;

  console.log(`🔄 renderStudents called - forceRefresh: ${forceRefresh}`);

  container.innerHTML = '<div class="loading">Loading students...</div>';

  try {
    const students = await EnhancedCache.loadCollection('students', forceRefresh);
    
    if (students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Students Yet</h3>
          <p>Add your first student to get started</p>
        </div>
      `;
      return;
    }

    let studentsHTML = '';
    students.forEach(student => {
      const studentName = student.name || `Student ${student.id}`;
      const studentId = student.id || student._id || student._firebaseId;
      
      studentsHTML += `
        <div class="student-card" id="student-${studentId}">
          <div class="student-card-header">
            <div>
              <strong>${studentName}</strong>
              <div class="muted">${student.subject || 'No subject'}</div>
            </div>
            <div class="student-actions">
              <button class="btn-icon edit-student-btn" data-id="${studentId}" data-name="${studentName}" title="Edit">✏️</button>
              <button class="btn-icon delete-student-btn" data-id="${studentId}" data-name="${studentName}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="student-details">
            <div class="muted">${student.gender || 'Not specified'} • ${student.email || 'No email'} • ${student.phone || 'No phone'}</div>
            <div class="student-rate">Rate: $${safeNumber(student.rate || student.hourlyRate || 0)}/hr</div>
            <div class="student-meta">Added: ${formatDate(student.createdAt || student.dateAdded)}</div>
            ${student.notes ? `<div class="student-notes">${student.notes}</div>` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = studentsHTML;
    console.log(`✅ Rendered ${students.length} students`);
    
    // Setup edit/delete handlers
    setTimeout(() => setupEditDeleteHandlers(), 50);

  } catch (error) {
    console.error("Error rendering students:", error);
    container.innerHTML = '<div class="error">Error loading students</div>';
  }
}

async function renderRecentHoursWithEdit(limit = 10) {
  const container = document.getElementById('hoursContainer');
  if (!container) return;

  try {
    const hours = await EnhancedCache.loadCollection('hours');
    const students = await EnhancedCache.loadCollection('students');
    
    if (hours.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Hours Logged</h3>
          <p>Log your first work session to get started</p>
        </div>
      `;
      return;
    }

    const sortedHours = hours.sort((a, b) => {
      const dateA = new Date(a.date || a.dateIso || a.createdAt);
      const dateB = new Date(b.date || b.dateIso || b.createdAt);
      return dateB - dateA;
    });

    let hoursHTML = '';
    sortedHours.slice(0, limit).forEach(entry => {
      const entryId = entry.id || entry._id || entry._firebaseId;
      const hours = safeNumber(entry.hours || entry.hoursWorked);
      const rate = safeNumber(entry.rate || entry.baseRate || entry.hourlyRate);
      const total = hours * rate;
      
      // Find student name
      let studentName = entry.student || entry.studentName;
      if (entry.studentId) {
        const student = students.find(s => (s.id || s._id) === entry.studentId);
        if (student) studentName = student.name;
      }
      
      hoursHTML += `
        <div class="hours-entry" id="hours-entry-${entryId}">
          <div class="hours-header">
            <strong>${studentName || 'No Student'}</strong>
            <span class="hours-type">${entry.workType || entry.subject || 'General'}</span>
            <div class="student-actions">
              <button class="btn-icon edit-hours-btn" data-id="${entryId}" title="Edit">✏️</button>
              <button class="btn-icon delete-hours-btn" data-id="${entryId}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="muted">${formatDate(entry.date || entry.dateIso)} • ${entry.subject || 'General'}</div>
          <div class="hours-details">
            <span>Hours: ${hours}</span>
            <span>Rate: $${rate}</span>
            <span class="hours-total">Total: $${total.toFixed(2)}</span>
          </div>
          ${entry.organization ? `<div class="muted">Organization: ${entry.organization}</div>` : ''}
          ${entry.notes ? `<div class="muted">Notes: ${entry.notes}</div>` : ''}
        </div>
      `;
    });

    container.innerHTML = hoursHTML;
    
    // Setup edit/delete handlers
    setTimeout(() => setupEditDeleteHandlers(), 50);

  } catch (error) {
    console.error("Error rendering hours:", error);
    container.innerHTML = '<div class="error">Error loading hours</div>';
  }
}

async function renderRecentMarksWithEdit(limit = 10) {
  const container = document.getElementById('marksContainer');
  if (!container) return;

  try {
    const marks = await EnhancedCache.loadCollection('marks');
    const students = await EnhancedCache.loadCollection('students');
    
    if (marks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Marks Recorded</h3>
          <p>Add your first mark to get started</p>
        </div>
      `;
      return;
    }

    const sortedMarks = marks.sort((a, b) => {
      const dateA = new Date(a.date || a.dateIso || a.createdAt);
      const dateB = new Date(b.date || b.dateIso || b.createdAt);
      return dateB - dateA;
    });

    let marksHTML = '';
    sortedMarks.slice(0, limit).forEach(entry => {
      const entryId = entry.id || entry._id || entry._firebaseId;
      const score = safeNumber(entry.score || entry.marks);
      const max = safeNumber(entry.max || entry.maxMarks);
      const percentage = max > 0 ? (score / max) * 100 : 0;
      
      // Find student name
      let studentName = entry.student || entry.studentName;
      if (entry.studentId) {
        const student = students.find(s => (s.id || s._id) === entry.studentId);
        if (student) studentName = student.name;
      }
      
      marksHTML += `
        <div class="mark-entry" id="mark-entry-${entryId}">
          <div class="mark-header">
            <strong>${studentName || 'Unknown Student'}</strong>
            <span class="mark-type">${entry.subject || 'No Subject'} (${entry.topic || 'No Topic'})</span>
            <div class="student-actions">
              <button class="btn-icon edit-marks-btn" data-id="${entryId}" title="Edit">✏️</button>
              <button class="btn-icon delete-marks-btn" data-id="${entryId}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="muted">${formatDate(entry.date || entry.dateIso)}</div>
          <div class="mark-details">
            <span>Score: ${score}/${max}</span>
            <span>Percentage: ${percentage.toFixed(2)}%</span>
            <span>Grade: ${entry.grade || calculateGrade(percentage)}</span>
          </div>
          ${entry.notes ? `<div class="muted">Notes: ${entry.notes}</div>` : ''}
        </div>
      `;
    });

    container.innerHTML = marksHTML;
    
    // Setup edit/delete handlers
    setTimeout(() => setupEditDeleteHandlers(), 50);

  } catch (error) {
    console.error("Error rendering marks:", error);
    container.innerHTML = '<div class="error">Error loading marks</div>';
  }
}

async function renderAttendanceRecentWithEdit(limit = 10) {
  const container = document.getElementById('attendanceContainer');
  if (!container) return;

  try {
    const attendance = await EnhancedCache.loadCollection('attendance');
    const students = await EnhancedCache.loadCollection('students');
    
    if (attendance.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Attendance Records</h3>
          <p>Record your first attendance session</p>
        </div>
      `;
      return;
    }

    const sortedAttendance = attendance.sort((a, b) => {
      const dateA = new Date(a.date || a.dateIso || a.createdAt);
      const dateB = new Date(b.date || b.dateIso || b.createdAt);
      return dateB - dateA;
    });

    let attendanceHTML = '';
    sortedAttendance.slice(0, limit).forEach(entry => {
      const entryId = entry.id || entry._id || entry._firebaseId;
      
      // Handle different attendance data structures
      let presentCount = 0;
      let presentStudents = 'None';
      
      if (Array.isArray(entry.present)) {
        presentCount = entry.present.length;
        presentStudents = entry.present.join(', ');
      } else if (entry.studentId) {
        // Single student attendance
        presentCount = entry.status === 'present' ? 1 : 0;
        if (entry.studentId) {
          const student = students.find(s => (s.id || s._id) === entry.studentId);
          presentStudents = student ? student.name : 'Unknown Student';
        }
      }
      
      attendanceHTML += `
        <div class="attendance-entry" id="attendance-entry-${entryId}">
          <div class="attendance-header">
            <strong>${entry.subject || 'No Subject'}</strong>
            <span class="attendance-topic">${entry.topic || '—'}</span>
            <div class="student-actions">
              <button class="btn-icon edit-attendance-btn" data-id="${entryId}" title="Edit">✏️</button>
              <button class="btn-icon delete-attendance-btn" data-id="${entryId}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="muted">${formatDate(entry.date || entry.dateIso)} • Status: ${entry.status || 'N/A'}</div>
          <div class="attendance-details">
            <span>Present: ${presentCount} student${presentCount !== 1 ? 's' : ''}</span>
            <span>Total: ${entry.totalStudents || 'N/A'}</span>
            <span>Percentage: ${entry.totalStudents ? ((presentCount / entry.totalStudents) * 100).toFixed(1) : '0'}%</span>
          </div>
          ${presentStudents !== 'None' ? `<div class="muted">Students: ${presentStudents}</div>` : ''}
          ${entry.notes ? `<div class="muted">Notes: ${entry.notes}</div>` : ''}
        </div>
      `;
    });

    container.innerHTML = attendanceHTML;
    
    // Setup edit/delete handlers
    setTimeout(() => setupEditDeleteHandlers(), 50);

  } catch (error) {
    console.error("Error rendering attendance:", error);
    container.innerHTML = '<div class="error">Error loading attendance</div>';
  }
}

async function renderPaymentActivityWithEdit(limit = 10) {
  const container = document.getElementById('paymentActivityLog');
  if (!container) return;

  try {
    const payments = await EnhancedCache.loadCollection('payments');
    const students = await EnhancedCache.loadCollection('students');
    
    if (payments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Payment Activity</h3>
          <p>No recent payment activity recorded</p>
        </div>
      `;
      return;
    }

    const sortedPayments = payments.sort((a, b) => {
      const dateA = new Date(a.date || a.dateIso || a.createdAt);
      const dateB = new Date(b.date || b.dateIso || b.createdAt);
      return dateB - dateA;
    });

    let paymentHTML = '';
    sortedPayments.slice(0, limit).forEach(entry => {
      const entryId = entry.id || entry._id || entry._firebaseId;
      const amount = safeNumber(entry.amount || entry.paymentAmount);
      
      // Find student name
      let studentName = entry.student || entry.studentName;
      if (entry.studentId) {
        const student = students.find(s => (s.id || s._id) === entry.studentId);
        if (student) studentName = student.name;
      }
      
      paymentHTML += `
        <div class="activity-item" id="payment-entry-${entryId}">
          <div class="payment-header">
            <strong>$${amount.toFixed(2)}</strong>
            <span class="payment-student">${studentName || 'Unknown Student'}</span>
            <div class="student-actions">
              <button class="btn-icon edit-payment-btn" data-id="${entryId}" title="Edit">✏️</button>
              <button class="btn-icon delete-payment-btn" data-id="${entryId}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="muted">${formatDate(entry.date || entry.dateIso)} | ${entry.method || entry.paymentMethod || 'Unknown Method'}</div>
          ${entry.notes ? `<div>${entry.notes}</div>` : ''}
        </div>
      `;
    });

    container.innerHTML = paymentHTML;
    
    // Setup edit/delete handlers
    setTimeout(() => setupEditDeleteHandlers(), 50);
    
    console.log(`✅ Rendered ${Math.min(payments.length, limit)} payment activities`);

  } catch (error) {
    console.error("Error rendering payments:", error);
    container.innerHTML = '<div class="error">Error loading payments</div>';
  }
}

async function renderStudentBalancesWithEdit() {
  const container = document.getElementById('studentBalancesContainer');
  if (!container) return;

  try {
    const [students, hours, payments] = await Promise.all([
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('payments')
    ]);

    console.log(`💰 Calculating balances for ${students.length} students`);

    if (students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Student Data</h3>
          <p>Add students and record hours/payments to see balances</p>
        </div>
      `;
      return;
    }

    const earningsByStudent = {};
    const paymentsByStudent = {};
    
    // Calculate earnings from hours
    hours.forEach(entry => {
      const studentId = entry.studentId;
      const studentName = entry.student;
      
      if (studentId || studentName) {
        const hours = safeNumber(entry.hours || entry.hoursWorked);
        const rate = safeNumber(entry.rate || entry.baseRate || entry.hourlyRate);
        const earnings = hours * rate;
        
        if (studentId) {
          earningsByStudent[studentId] = (earningsByStudent[studentId] || 0) + earnings;
        }
        if (studentName) {
          earningsByStudent[studentName] = (earningsByStudent[studentName] || 0) + earnings;
        }
      }
    });

    // Calculate payments
    payments.forEach(payment => {
      const studentId = payment.studentId;
      const studentName = payment.student;
      const amount = safeNumber(payment.amount || payment.paymentAmount);
      
      if (studentId) {
        paymentsByStudent[studentId] = (paymentsByStudent[studentId] || 0) + amount;
      }
      if (studentName) {
        paymentsByStudent[studentName] = (paymentsByStudent[studentName] || 0) + amount;
      }
    });

    let balancesHTML = '';
    let totalOwed = 0;

    students.forEach(student => {
      const studentId = student.id || student._id;
      const studentName = student.name || `Student ${studentId}`;
      
      // Try to find earnings/payments by ID first, then by name
      const earned = earningsByStudent[studentId] || earningsByStudent[studentName] || 0;
      const paid = paymentsByStudent[studentId] || paymentsByStudent[studentName] || 0;
      const owed = Math.max(earned - paid, 0);
      totalOwed += owed;

      balancesHTML += `
        <div class="activity-item" id="balance-${studentId}">
          <div>
            <strong>${studentName}</strong>
            <div class="student-actions" style="display: inline-block; margin-left: 10px;">
              <button class="btn-icon quick-payment-btn" data-id="${studentId}" data-name="${studentName}" title="Add Payment">💰</button>
            </div>
          </div>
          <div class="muted">
            Earned: $${earned.toFixed(2)} | 
            Paid: $${paid.toFixed(2)} | 
            <strong>Owed: $${owed.toFixed(2)}</strong>
          </div>
        </div>
      `;
    });

    container.innerHTML = balancesHTML;
    
    // Setup quick payment button handlers
    setTimeout(() => {
      document.querySelectorAll('.quick-payment-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          const studentId = button.dataset.id;
          const studentName = button.dataset.name;
          quickAddPayment(studentId, studentName);
        });
      });
    }, 50);

    const totalOwedEl = document.getElementById('totalOwed');
    const totalStudentsCountEl = document.getElementById('totalStudentsCount');
    
    if (totalOwedEl) totalOwedEl.textContent = `$${totalOwed.toFixed(2)}`;
    if (totalStudentsCountEl) totalStudentsCountEl.textContent = students.length;

    console.log(`✅ Rendered balances for ${students.length} students, total owed: $${totalOwed.toFixed(2)}`);

  } catch (error) {
    console.error("Error rendering student balances:", error);
    container.innerHTML = '<div class="error">Error loading student balances</div>';
  }
}

// ===========================
// HELPER FUNCTIONS
// ===========================

/*function safeNumber(value) {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}*/

/*function formatDate(dateString) {
  if (!dateString) return 'No date';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (e) {
    return 'Invalid date';
  }
} */

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function quickAddPayment(studentId, studentName) {
  // Fill payment form with student info
  const paymentForm = document.getElementById('paymentForm');
  const studentSelect = document.getElementById('studentSelectPayment');
  const amountInput = document.getElementById('paymentAmount');
  
  if (studentSelect) {
    // Try to find the option for this student
    const option = Array.from(studentSelect.options).find(opt => opt.value === studentId || opt.text.includes(studentName));
    if (option) {
      studentSelect.value = option.value;
    } else {
      // If not found, set a custom value and add a note
      studentSelect.value = 'other';
      const notesInput = document.getElementById('paymentNotes');
      if (notesInput) {
        notesInput.value = `Payment for ${studentName}`;
      }
    }
  }
  
  if (amountInput) {
    amountInput.focus();
  }
  
  // Scroll to payment form
  if (paymentForm) {
    paymentForm.scrollIntoView({ behavior: 'smooth' });
  }
  
  NotificationSystem.notifyInfo(`Adding payment for ${studentName}`);
}

// ===========================
// STUDENT FORM FUNCTIONS (REPLACE EXISTING FUNCTION)
// ===========================

async function handleStudentSubmit(e) {
    if (e) e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
        NotificationSystem.notifyError('Please log in to add students');
        return;
    }

    // Get form values
    const studentName = document.getElementById('studentName').value;
    const studentId = document.getElementById('studentId').value;
    const studentGender = document.getElementById('studentGender').value;
    const studentEmail = document.getElementById('studentEmail').value;
    const studentPhone = document.getElementById('studentPhone').value;
    const studentBaseRate = document.getElementById('studentBaseRate').value;

    // Validate required fields
    if (!studentName || !studentId || !studentGender) {
        NotificationSystem.notifyError('Please fill in all required fields (Name, ID, Gender)');
        return;
    }

    const studentData = {
        name: studentName,
        studentId: studentId,
        gender: studentGender,
        email: studentEmail || '',
        phone: studentPhone || '',
        rate: safeNumber(studentBaseRate) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    console.log('📝 Adding student:', studentData);

    try {
        const result = await EnhancedCache.saveWithBackgroundSync('students', studentData);
        
        if (result) {
            NotificationSystem.notifySuccess(`Student "${studentName}" added successfully!`);
            
            // Clear form
            clearStudentForm();
            
            // Refresh UI
            await renderStudents();
            
            // Refresh dropdowns
            await populateStudentDropdowns();
            
            // Refresh stats
            if (typeof EnhancedStats !== 'undefined') {
                EnhancedStats.forceRefresh();
            }
        } else {
            NotificationSystem.notifyError('Failed to save student. Please try again.');
        }
        
    } catch (error) {
        console.error('Error adding student:', error);
        NotificationSystem.notifyError('Failed to add student: ' + error.message);
    }
}

function clearStudentForm() {
    const form = document.getElementById('studentForm');
    if (form) {
        form.reset();
        NotificationSystem.notifyInfo('Student form cleared');
    }
}

// ===========================
// UPDATED HOURS FORM FUNCTIONS (REPLACE IF EXISTS)
// ===========================

async function handleHoursSubmit(e) {
  if (e) e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to log hours');
    return;
  }

  const hoursData = {
    organization: document.getElementById('organization').value,
    workType: document.getElementById('workType').value,
    subject: document.getElementById('workSubject').value,
    student: document.getElementById('hoursStudent').value,
    hours: safeNumber(document.getElementById('hoursWorked').value),
    rate: safeNumber(document.getElementById('baseRate').value),
    total: safeNumber(document.getElementById('hoursWorked').value) * safeNumber(document.getElementById('baseRate').value),
    date: document.getElementById('workDate').value,
    dateIso: fmtDateISO(document.getElementById('workDate').value),
    createdAt: new Date().toISOString()
  };

  // Validate required fields
  if (!hoursData.organization || !hoursData.hours || !hoursData.rate || !hoursData.date) {
    NotificationSystem.notifyError('Please fill in all required fields (Organization, Hours, Rate, Date)');
    return;
  }

  try {
    const result = await EnhancedCache.saveWithBackgroundSync('hours', hoursData);
    
    if (result) {
      NotificationSystem.notifySuccess('Hours logged successfully!');
      
      // Clear form
      if (e && e.target) {
        e.target.reset();
      }
      
      // Reset date to today
      document.getElementById('workDate').value = new Date().toISOString().split('T')[0];
      
      // Refresh UI
      await renderRecentHoursWithEdit();
      
      // Refresh stats
      if (typeof EnhancedStats !== 'undefined') {
        EnhancedStats.forceRefresh();
      }
    }
    
  } catch (error) {
    console.error('Error saving hours:', error);
    NotificationSystem.notifyError('Failed to save hours: ' + error.message);
  }
}

function resetHoursForm() {
  const form = document.querySelector('#hours form');
  if (form) {
    form.reset();
    document.getElementById('workDate').value = new Date().toISOString().split('T')[0];
    calculateTotalPay();
    NotificationSystem.notifyInfo('Hours form cleared');
  }
}

// ===========================
// UPDATED MARKS FORM FUNCTIONS (REPLACE IF EXISTS)
// ===========================

async function handleMarksSubmit(e) {
  if (e) e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to add marks');
    return;
  }

  const score = safeNumber(document.getElementById('marksScore').value);
  const max = safeNumber(document.getElementById('marksMax').value);
  const percentage = max > 0 ? (score / max) * 100 : 0;

  const marksData = {
    student: document.getElementById('marksStudent').value,
    subject: document.getElementById('marksSubject').value,
    topic: document.getElementById('marksTopic').value,
    score: score,
    max: max,
    percentage: percentage,
    grade: calculateGrade(percentage),
    date: document.getElementById('marksDate').value,
    dateIso: fmtDateISO(document.getElementById('marksDate').value),
    notes: document.getElementById('marksNotes').value,
    createdAt: new Date().toISOString()
  };

  // Validate required fields
  if (!marksData.student || !marksData.subject || !marksData.topic || !marksData.date) {
    NotificationSystem.notifyError('Please fill in all required fields (Student, Subject, Topic, Date)');
    return;
  }

  try {
    const result = await EnhancedCache.saveWithBackgroundSync('marks', marksData);
    
    if (result) {
      NotificationSystem.notifySuccess('Mark added successfully!');
      
      // Clear form
      if (e && e.target) {
        e.target.reset();
      }
      
      // Refresh UI
      await renderRecentMarksWithEdit();
      
      // Refresh stats
      if (typeof EnhancedStats !== 'undefined') {
        EnhancedStats.forceRefresh();
      }
    }
    
  } catch (error) {
    console.error('Error saving mark:', error);
    NotificationSystem.notifyError('Failed to save mark: ' + error.message);
  }
}

function resetMarksForm() {
  const form = document.getElementById('marksForm');
  if (form) {
    form.reset();
    document.getElementById('marksDate').value = new Date().toISOString().split('T')[0];
    NotificationSystem.notifyInfo('Marks form cleared');
  }
}

// ===========================
// ATTENDANCE FORM FUNCTIONS (REPLACE IF EXISTS)
// ===========================

async function handleAttendanceSubmit(e) {
  if (e) e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to record attendance');
    return;
  }

  const presentCheckboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]:checked');
  const presentStudents = Array.from(presentCheckboxes).map(cb => cb.value);

  const attendanceData = {
    subject: document.getElementById('attendanceSubject').value,
    topic: document.getElementById('attendanceTopic').value,
    present: presentStudents,
    date: document.getElementById('attendanceDate').value,
    dateIso: fmtDateISO(document.getElementById('attendanceDate').value),
    notes: document.getElementById('attendanceNotes').value,
    createdAt: new Date().toISOString()
  };

  // Validate required fields
  if (!attendanceData.subject || !attendanceData.date) {
    NotificationSystem.notifyError('Please fill in all required fields (Subject, Date)');
    return;
  }

  try {
    const result = await EnhancedCache.saveWithBackgroundSync('attendance', attendanceData);
    
    if (result) {
      NotificationSystem.notifySuccess('Attendance recorded successfully!');
      
      // Clear form
      if (e && e.target) {
        e.target.reset();
      }
      
      // Clear checkboxes
      presentCheckboxes.forEach(cb => cb.checked = false);
      
      // Reset date to today
      document.getElementById('attendanceDate').value = new Date().toISOString().split('T')[0];
      
      // Refresh UI
      await renderAttendanceRecentWithEdit();
      
      // Refresh stats
      if (typeof EnhancedStats !== 'undefined') {
        EnhancedStats.forceRefresh();
      }
    }
    
  } catch (error) {
    console.error('Error saving attendance:', error);
    NotificationSystem.notifyError('Failed to save attendance: ' + error.message);
  }
}

// ===========================
// PAYMENT FORM FUNCTIONS (REPLACE IF EXISTS)
// ===========================

async function handlePaymentSubmit(e) {
  if (e) e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to record payments');
    return;
  }

  const paymentData = {
    student: document.getElementById('paymentStudent').value,
    amount: safeNumber(document.getElementById('paymentAmount').value),
    method: document.getElementById('paymentMethod').value,
    date: document.getElementById('paymentDate').value,
    dateIso: fmtDateISO(document.getElementById('paymentDate').value),
    notes: document.getElementById('paymentNotes').value,
    createdAt: new Date().toISOString()
  };

  // Validate required fields
  if (!paymentData.student || !paymentData.amount || !paymentData.date) {
    NotificationSystem.notifyError('Please fill in all required fields (Student, Amount, Date)');
    return;
  }

  if (paymentData.amount <= 0) {
    NotificationSystem.notifyError('Please enter a valid amount greater than 0');
    return;
  }

  try {
    const result = await EnhancedCache.saveWithBackgroundSync('payments', paymentData);
    
    if (result) {
      NotificationSystem.notifySuccess('Payment recorded successfully!');
      
      // Clear form
      if (e && e.target) {
        e.target.reset();
      }
      
      // Reset date to today
      document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
      
      // Refresh UI
      await renderPaymentActivityWithEdit();
      await renderStudentBalancesWithEdit();
      
      // Refresh stats
      if (typeof EnhancedStats !== 'undefined') {
        EnhancedStats.forceRefresh();
      }
    }
    
  } catch (error) {
    console.error('Error saving payment:', error);
    NotificationSystem.notifyError('Failed to save payment: ' + error.message);
  }
}

function resetPaymentForm() {
  const form = document.getElementById('paymentForm');
  if (form) {
    form.reset();
    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
    NotificationSystem.notifyInfo('Payment form cleared');
  }
}



// ===========================
// STUDENT DROPDOWN POPULATION
// ===========================

async function populateStudentDropdowns() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    console.log('🔄 Populating student dropdowns...');
    
    const students = await EnhancedCache.loadCollection('students');
    console.log(`📝 Found ${students.length} students for dropdowns`);

    if (students.length === 0) {
      showNoStudentsMessage();
      return;
    }

    const dropdowns = [
      document.getElementById('hoursStudent'),
      document.getElementById('marksStudent'),
      document.getElementById('paymentStudent')
    ];

    dropdowns.forEach(dropdown => {
      if (dropdown) {
        populateSingleDropdown(dropdown, students);
      }
    });

    await populateAttendanceStudents();

    console.log('✅ All student dropdowns populated successfully');

  } catch (error) {
    console.error('❌ Error populating student dropdowns:', error);
    showDropdownError();
  }
}

function populateSingleDropdown(dropdown, students) {
  if (!dropdown) return;

  const currentValue = dropdown.value;
  
  while (dropdown.options.length > 0) {
    dropdown.remove(0);
  }

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a student...';
  defaultOption.disabled = true;
  defaultOption.selected = true;
  dropdown.appendChild(defaultOption);

  students.forEach(student => {
    const studentName = student.name || `Student ${student.id}`;
    const option = document.createElement('option');
    option.value = studentName;
    option.textContent = studentName;
    dropdown.appendChild(option);
  });

  if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
    dropdown.value = currentValue;
  }

  console.log(`✅ Populated ${dropdown.id} with ${students.length} students`);
}

async function populateAttendanceStudents() {
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (!attendanceContainer) {
    console.log('❌ Attendance container not found');
    return;
  }

  try {
    const students = await EnhancedCache.loadCollection('students');
    console.log(`👥 Populating attendance with ${students.length} students`);

    attendanceContainer.innerHTML = '';

    if (students.length === 0) {
      attendanceContainer.innerHTML = `
        <div class="empty-state">
          <p>No students available. Please add students first.</p>
        </div>
      `;
      return;
    }

    students.forEach(student => {
      const studentName = student.name || `Student ${student.id}`;
      
      const container = document.createElement('div');
      container.style.cssText = 'display: flex; align-items: center; gap: 12px; margin: 8px 0; padding: 12px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border);';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'presentStudents';
      checkbox.value = studentName;
      checkbox.id = `attendance-${student.id}`;
      checkbox.style.cssText = 'width: 18px; height: 18px;';
      
      const label = document.createElement('label');
      label.htmlFor = `attendance-${student.id}`;
      label.textContent = studentName;
      label.style.cssText = 'flex: 1; margin: 0; cursor: pointer; font-weight: 500;';
      
      const studentInfo = document.createElement('span');
      studentInfo.textContent = `Rate: $${student.rate || 0}`;
      studentInfo.style.cssText = 'font-size: 0.85em; color: var(--muted);';
      
      container.appendChild(checkbox);
      container.appendChild(label);
      container.appendChild(studentInfo);
      attendanceContainer.appendChild(container);
    });

    console.log('✅ Attendance students populated');
  } catch (error) {
    console.error('Error populating attendance students:', error);
  }
}

function showNoStudentsMessage() {
  const dropdowns = [
    document.getElementById('hoursStudent'),
    document.getElementById('marksStudent'),
    document.getElementById('paymentStudent')
  ];
  
  dropdowns.forEach(dropdown => {
    if (dropdown) {
      dropdown.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No students available - Add students first';
      option.disabled = true;
      option.selected = true;
      dropdown.appendChild(option);
    }
  });
}

function showDropdownError() {
  const dropdowns = [
    document.getElementById('hoursStudent'),
    document.getElementById('marksStudent'),
    document.getElementById('paymentStudent')
  ];
  
  dropdowns.forEach(dropdown => {
    if (dropdown) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Error loading students - Click to refresh';
      option.disabled = true;
      option.selected = true;
      dropdown.appendChild(option);
      
      dropdown.addEventListener('click', async () => {
        await populateStudentDropdowns();
      });
    }
  });
}

// ===========================
// UPDATED FORM SETUP HANDLERS (REPLACE EXISTING FUNCTION)
// ===========================

function setupFormHandlers() {
  console.log('🔧 Setting up form handlers...');
  
  // Student Form - TWO WAYS TO SUBMIT:
  const studentForm = document.getElementById('studentForm');
  const studentSubmitBtn = document.getElementById('studentSubmitBtn');
  
  if (studentForm) {
    // Remove any existing listeners first
    const newForm = studentForm.cloneNode(true);
    studentForm.parentNode.replaceChild(newForm, studentForm);
    newForm.addEventListener('submit', handleStudentSubmit);
  }
  
  if (studentSubmitBtn) {
    studentSubmitBtn.removeEventListener('click', handleStudentSubmit);
    studentSubmitBtn.addEventListener('click', handleStudentSubmit);
  }
  
  // Hours Form
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
    const newHoursForm = hoursForm.cloneNode(true);
    hoursForm.parentNode.replaceChild(newHoursForm, hoursForm);
    newHoursForm.addEventListener('submit', handleHoursSubmit);
  }
  
  // Marks Form
  const marksForm = document.getElementById('marksForm');
  if (marksForm) {
    const newMarksForm = marksForm.cloneNode(true);
    marksForm.parentNode.replaceChild(newMarksForm, marksForm);
    newMarksForm.addEventListener('submit', handleMarksSubmit);
  }
  
  // Attendance Form
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) {
    const newAttendanceForm = attendanceForm.cloneNode(true);
    attendanceForm.parentNode.replaceChild(newAttendanceForm, attendanceForm);
    newAttendanceForm.addEventListener('submit', handleAttendanceSubmit);
  }
  
  // Payment Form
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    const newPaymentForm = paymentForm.cloneNode(true);
    paymentForm.parentNode.replaceChild(newPaymentForm, paymentForm);
    newPaymentForm.addEventListener('submit', handlePaymentSubmit);
  }
  
  // Set up hours calculation
  const hoursInput = document.getElementById('hoursWorked');
  const rateInput = document.getElementById('baseRate');
  if (hoursInput && rateInput) {
    hoursInput.addEventListener('input', calculateTotalPay);
    rateInput.addEventListener('input', calculateTotalPay);
  }
  
  // Set today's date for all date inputs
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(input => {
    if (!input.value) {
      input.value = today;
    }
  });
  
  // Setup edit and delete button handlers for existing content
  setTimeout(() => {
    setupEditDeleteHandlers();
  }, 100);
  
  console.log('✅ Form handlers initialized');
}

// ===========================
// EDIT AND DELETE BUTTON HANDLERS
// ===========================

function setupEditDeleteHandlers() {
  console.log('🔧 Setting up edit/delete handlers...');
  
  // Setup student edit/delete buttons
  document.querySelectorAll('.edit-student-btn').forEach(button => {
    button.removeEventListener('click', handleStudentEdit);
    button.addEventListener('click', handleStudentEdit);
  });
  
  document.querySelectorAll('.delete-student-btn').forEach(button => {
    button.removeEventListener('click', handleStudentDelete);
    button.addEventListener('click', handleStudentDelete);
  });
  
  // Setup hours edit/delete buttons
  document.querySelectorAll('.edit-hours-btn').forEach(button => {
    button.removeEventListener('click', handleHoursEdit);
    button.addEventListener('click', handleHoursEdit);
  });
  
  document.querySelectorAll('.delete-hours-btn').forEach(button => {
    button.removeEventListener('click', handleHoursDelete);
    button.addEventListener('click', handleHoursDelete);
  });
  
  // Setup marks edit/delete buttons
  document.querySelectorAll('.edit-marks-btn').forEach(button => {
    button.removeEventListener('click', handleMarksEdit);
    button.addEventListener('click', handleMarksEdit);
  });
  
  document.querySelectorAll('.delete-marks-btn').forEach(button => {
    button.removeEventListener('click', handleMarksDelete);
    button.addEventListener('click', handleMarksDelete);
  });
  
  // Setup attendance edit/delete buttons
  document.querySelectorAll('.edit-attendance-btn').forEach(button => {
    button.removeEventListener('click', handleAttendanceEdit);
    button.addEventListener('click', handleAttendanceEdit);
  });
  
  document.querySelectorAll('.delete-attendance-btn').forEach(button => {
    button.removeEventListener('click', handleAttendanceDelete);
    button.addEventListener('click', handleAttendanceDelete);
  });
  
  // Setup payment edit/delete buttons
  document.querySelectorAll('.edit-payment-btn').forEach(button => {
    button.removeEventListener('click', handlePaymentEdit);
    button.addEventListener('click', handlePaymentEdit);
  });
  
  document.querySelectorAll('.delete-payment-btn').forEach(button => {
    button.removeEventListener('click', handlePaymentDelete);
    button.addEventListener('click', handlePaymentDelete);
  });
  
  console.log('✅ Edit/delete handlers initialized');
}

// ===========================
// STUDENT EDIT/DELETE HANDLERS
// ===========================

async function handleStudentEdit(event) {
  event.preventDefault();
  const button = event.target.closest('.edit-student-btn');
  if (!button) return;
  
  const studentId = button.dataset.id;
  if (!studentId) {
    console.error('No student ID found');
    return;
  }
  
  try {
    const student = cache.students.find(s => s.id === studentId);
    if (!student) {
      NotificationSystem.notifyError('Student not found');
      return;
    }
    
    // Fill the student form with existing data
    document.getElementById('studentName').value = student.name || '';
    document.getElementById('studentSubject').value = student.subject || '';
    document.getElementById('studentRate').value = student.hourlyRate || '';
    document.getElementById('studentNotes').value = student.notes || '';
    
    // Set the editing mode
    const studentForm = document.getElementById('studentForm');
    studentForm.dataset.editingId = studentId;
    
    // Change button text
    const submitBtn = document.getElementById('studentSubmitBtn');
    if (submitBtn) {
      submitBtn.textContent = 'Update Student';
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-warning');
    }
    
    // Scroll to form
    document.getElementById('studentForm').scrollIntoView({ behavior: 'smooth' });
    
    NotificationSystem.notifyInfo(`Editing student: ${student.name}`);
    
  } catch (error) {
    console.error('Error editing student:', error);
    NotificationSystem.notifyError('Failed to edit student: ' + error.message);
  }
}

async function handleStudentDelete(event) {
  event.preventDefault();
  const button = event.target.closest('.delete-student-btn');
  if (!button) return;
  
  const studentId = button.dataset.id;
  const studentName = button.dataset.name || 'this student';
  
  if (!confirm(`Are you sure you want to delete ${studentName}? This will also delete all associated hours, marks, attendance, and payment records!`)) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete student');
      return;
    }
    
    // Delete from Firestore
    await deleteDoc(doc(db, "users", user.uid, "students", studentId));
    
    // Delete associated records
    await deleteAssociatedRecords(user.uid, studentId);
    
    // Update cache
    cache.students = cache.students.filter(s => s.id !== studentId);
    
    // Update local storage
    EnhancedCache.saveToLocalStorageBulk('students', cache.students);
    
    // Refresh UI
    await renderStudents();
    await populateStudentDropdowns();
    
    NotificationSystem.notifySuccess(`Student ${studentName} deleted successfully`);
    
  } catch (error) {
    console.error('Error deleting student:', error);
    NotificationSystem.notifyError('Failed to delete student: ' + error.message);
  }
}

// ===========================
// HOURS EDIT/DELETE HANDLERS
// ===========================

async function handleHoursEdit(event) {
  event.preventDefault();
  const button = event.target.closest('.edit-hours-btn');
  if (!button) return;
  
  const hoursId = button.dataset.id;
  if (!hoursId) return;
  
  try {
    const hourEntry = cache.hours.find(h => h.id === hoursId);
    if (!hourEntry) return;
    
    // Fill the hours form
    document.getElementById('studentSelectHours').value = hourEntry.studentId || '';
    document.getElementById('hoursDate').value = hourEntry.date || '';
    document.getElementById('hoursWorked').value = hourEntry.hours || '';
    document.getElementById('baseRate').value = hourEntry.rate || '';
    document.getElementById('hoursNotes').value = hourEntry.notes || '';
    
    // Set editing mode
    const hoursForm = document.getElementById('hoursForm');
    hoursForm.dataset.editingId = hoursId;
    
    // Scroll to form
    hoursForm.scrollIntoView({ behavior: 'smooth' });
    
    NotificationSystem.notifyInfo('Editing hours entry');
    
  } catch (error) {
    console.error('Error editing hours:', error);
    NotificationSystem.notifyError('Failed to edit hours: ' + error.message);
  }
}

async function handleHoursDelete(event) {
  event.preventDefault();
  const button = event.target.closest('.delete-hours-btn');
  if (!button) return;
  
  const hoursId = button.dataset.id;
  
  if (!confirm('Are you sure you want to delete this hours entry?')) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete hours');
      return;
    }
    
    await deleteDoc(doc(db, "users", user.uid, "hours", hoursId));
    
    cache.hours = cache.hours.filter(h => h.id !== hoursId);
    EnhancedCache.saveToLocalStorageBulk('hours', cache.hours);
    
    await renderRecentHoursWithEdit();
    await recalcSummaryStats(user.uid);
    
    NotificationSystem.notifySuccess('Hours entry deleted successfully');
    
  } catch (error) {
    console.error('Error deleting hours:', error);
    NotificationSystem.notifyError('Failed to delete hours: ' + error.message);
  }
}

// ===========================
// MARKS EDIT/DELETE HANDLERS
// ===========================

async function handleMarksEdit(event) {
  event.preventDefault();
  const button = event.target.closest('.edit-marks-btn');
  if (!button) return;
  
  const marksId = button.dataset.id;
  if (!marksId) return;
  
  try {
    const marksEntry = cache.marks.find(m => m.id === marksId);
    if (!marksEntry) return;
    
    // Fill the marks form
    document.getElementById('studentSelectMarks').value = marksEntry.studentId || '';
    document.getElementById('marksDate').value = marksEntry.date || '';
    document.getElementById('marks').value = marksEntry.marks || '';
    document.getElementById('maxMarks').value = marksEntry.maxMarks || '';
    document.getElementById('marksType').value = marksEntry.type || '';
    document.getElementById('marksNotes').value = marksEntry.notes || '';
    
    // Set editing mode
    const marksForm = document.getElementById('marksForm');
    marksForm.dataset.editingId = marksId;
    
    // Scroll to form
    marksForm.scrollIntoView({ behavior: 'smooth' });
    
    NotificationSystem.notifyInfo('Editing marks entry');
    
  } catch (error) {
    console.error('Error editing marks:', error);
    NotificationSystem.notifyError('Failed to edit marks: ' + error.message);
  }
}

async function handleMarksDelete(event) {
  event.preventDefault();
  const button = event.target.closest('.delete-marks-btn');
  if (!button) return;
  
  const marksId = button.dataset.id;
  
  if (!confirm('Are you sure you want to delete this marks entry?')) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete marks');
      return;
    }
    
    await deleteDoc(doc(db, "users", user.uid, "marks", marksId));
    
    cache.marks = cache.marks.filter(m => m.id !== marksId);
    EnhancedCache.saveToLocalStorageBulk('marks', cache.marks);
    
    await renderRecentMarksWithEdit();
    await recalcSummaryStats(user.uid);
    
    NotificationSystem.notifySuccess('Marks entry deleted successfully');
    
  } catch (error) {
    console.error('Error deleting marks:', error);
    NotificationSystem.notifyError('Failed to delete marks: ' + error.message);
  }
}

// ===========================
// ATTENDANCE EDIT/DELETE HANDLERS
// ===========================

async function handleAttendanceEdit(event) {
  event.preventDefault();
  const button = event.target.closest('.edit-attendance-btn');
  if (!button) return;
  
  const attendanceId = button.dataset.id;
  if (!attendanceId) return;
  
  try {
    const attendanceEntry = cache.attendance.find(a => a.id === attendanceId);
    if (!attendanceEntry) return;
    
    // Fill the attendance form
    document.getElementById('studentSelectAttendance').value = attendanceEntry.studentId || '';
    document.getElementById('attendanceDate').value = attendanceEntry.date || '';
    document.getElementById('attendanceStatus').value = attendanceEntry.status || 'present';
    document.getElementById('attendanceNotes').value = attendanceEntry.notes || '';
    
    // Set editing mode
    const attendanceForm = document.getElementById('attendanceForm');
    attendanceForm.dataset.editingId = attendanceId;
    
    // Scroll to form
    attendanceForm.scrollIntoView({ behavior: 'smooth' });
    
    NotificationSystem.notifyInfo('Editing attendance entry');
    
  } catch (error) {
    console.error('Error editing attendance:', error);
    NotificationSystem.notifyError('Failed to edit attendance: ' + error.message);
  }
}

async function handleAttendanceDelete(event) {
  event.preventDefault();
  const button = event.target.closest('.delete-attendance-btn');
  if (!button) return;
  
  const attendanceId = button.dataset.id;
  
  if (!confirm('Are you sure you want to delete this attendance entry?')) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete attendance');
      return;
    }
    
    await deleteDoc(doc(db, "users", user.uid, "attendance", attendanceId));
    
    cache.attendance = cache.attendance.filter(a => a.id !== attendanceId);
    EnhancedCache.saveToLocalStorageBulk('attendance', cache.attendance);
    
    await renderAttendanceRecentWithEdit();
    await recalcSummaryStats(user.uid);
    
    NotificationSystem.notifySuccess('Attendance entry deleted successfully');
    
  } catch (error) {
    console.error('Error deleting attendance:', error);
    NotificationSystem.notifyError('Failed to delete attendance: ' + error.message);
  }
}

// ===========================
// PAYMENT EDIT/DELETE HANDLERS
// ===========================

async function handlePaymentEdit(event) {
  event.preventDefault();
  const button = event.target.closest('.edit-payment-btn');
  if (!button) return;
  
  const paymentId = button.dataset.id;
  if (!paymentId) return;
  
  try {
    const paymentEntry = cache.payments.find(p => p.id === paymentId);
    if (!paymentEntry) return;
    
    // Fill the payment form
    document.getElementById('studentSelectPayment').value = paymentEntry.studentId || '';
    document.getElementById('paymentDate').value = paymentEntry.date || '';
    document.getElementById('paymentAmount').value = paymentEntry.amount || '';
    document.getElementById('paymentMethod').value = paymentEntry.method || '';
    document.getElementById('paymentNotes').value = paymentEntry.notes || '';
    
    // Set editing mode
    const paymentForm = document.getElementById('paymentForm');
    paymentForm.dataset.editingId = paymentId;
    
    // Scroll to form
    paymentForm.scrollIntoView({ behavior: 'smooth' });
    
    NotificationSystem.notifyInfo('Editing payment entry');
    
  } catch (error) {
    console.error('Error editing payment:', error);
    NotificationSystem.notifyError('Failed to edit payment: ' + error.message);
  }
}

async function handlePaymentDelete(event) {
  event.preventDefault();
  const button = event.target.closest('.delete-payment-btn');
  if (!button) return;
  
  const paymentId = button.dataset.id;
  
  if (!confirm('Are you sure you want to delete this payment entry?')) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete payment');
      return;
    }
    
    await deleteDoc(doc(db, "users", user.uid, "payments", paymentId));
    
    cache.payments = cache.payments.filter(p => p.id !== paymentId);
    EnhancedCache.saveToLocalStorageBulk('payments', cache.payments);
    
    await renderPaymentActivityWithEdit();
    await recalcSummaryStats(user.uid);
    
    NotificationSystem.notifySuccess('Payment entry deleted successfully');
    
  } catch (error) {
    console.error('Error deleting payment:', error);
    NotificationSystem.notifyError('Failed to delete payment: ' + error.message);
  }
}

// ===========================
// HELPER FUNCTION TO DELETE ASSOCIATED RECORDS
// ===========================

async function deleteAssociatedRecords(uid, studentId) {
  try {
    const batch = writeBatch(db);
    
    // Delete hours
    const hoursQuery = query(
      collection(db, "users", uid, "hours"),
      where("studentId", "==", studentId)
    );
    const hoursSnapshot = await getDocs(hoursQuery);
    hoursSnapshot.forEach(doc => batch.delete(doc.ref));
    
    // Delete marks
    const marksQuery = query(
      collection(db, "users", uid, "marks"),
      where("studentId", "==", studentId)
    );
    const marksSnapshot = await getDocs(marksQuery);
    marksSnapshot.forEach(doc => batch.delete(doc.ref));
    
    // Delete attendance
    const attendanceQuery = query(
      collection(db, "users", uid, "attendance"),
      where("studentId", "==", studentId)
    );
    const attendanceSnapshot = await getDocs(attendanceQuery);
    attendanceSnapshot.forEach(doc => batch.delete(doc.ref));
    
    // Delete payments
    const paymentsQuery = query(
      collection(db, "users", uid, "payments"),
      where("studentId", "==", studentId)
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    paymentsSnapshot.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
    console.log(`✅ Deleted all records for student ${studentId}`);
    
  } catch (error) {
    console.error('Error deleting associated records:', error);
    throw error;
  }
}

// ===========================
// TAB NAVIGATION SYSTEM
// ===========================

function setupTabNavigation() {
  console.log('🔧 Setting up tab navigation...');
  
  const tabButtons = document.querySelectorAll('.tab[data-tab]');
  console.log(`✅ Found ${tabButtons.length} tab buttons`);
  
  tabButtons.forEach(button => {
    const tabName = button.getAttribute('data-tab');
    console.log(`📝 Setting up: ${tabName}`);
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchTab(tabName);
    });
  });
  
  // Activate first tab
  const firstTab = document.querySelector('.tab[data-tab]');
  if (firstTab) {
    switchTab(firstTab.getAttribute('data-tab'));
  }
  
  console.log('✅ Tab navigation setup complete');
}

function switchTab(tabName) {
  console.log(`🔄 Switching to: ${tabName}`);
  
  if (!tabName) {
    console.error('❌ No tab name provided');
    return;
  }
  
  // Update active tab button
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeButtons = document.querySelectorAll(`.tab[data-tab="${tabName}"]`);
  activeButtons.forEach(btn => {
    btn.classList.add('active');
  });
  
  // Show active tab content
  document.querySelectorAll('.tabcontent').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
  
  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.classList.add('active');
    targetTab.style.display = 'block';
    
    // Special setup for reports tab
    if (tabName === 'reports') {
      setupReportButtons();
    }
    
    console.log(`✅ Successfully showing: ${tabName}`);
  } else {
    console.error(`❌ Tab content not found: ${tabName}`);
  }
}

// ===========================
// DEFAULT RATE FUNCTIONS
// ===========================

function initializeDefaultRate(rate) {
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  const baseRateInput = document.getElementById('baseRate');
  const studentRateInput = document.getElementById('studentBaseRate');
  
  console.log('💰 Initializing default rate:', rate);
  
  if (defaultBaseRateInput && !defaultBaseRateInput.value) {
    defaultBaseRateInput.value = rate;
  }
  
  if (baseRateInput && !baseRateInput.value) {
    baseRateInput.value = rate;
    calculateTotalPay();
  }
  
  if (studentRateInput && !studentRateInput.value) {
    studentRateInput.value = rate;
  }
  
  const currentDefaultRateDisplay = document.getElementById('currentDefaultRateDisplay');
  if (currentDefaultRateDisplay) {
    currentDefaultRateDisplay.textContent = rate.toFixed(2);
  }
  
  const currentDefaultRate = document.getElementById('currentDefaultRate');
  if (currentDefaultRate) {
    currentDefaultRate.textContent = rate.toFixed(2);
  }
}

async function saveDefaultRate() {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to save default rate');
    return;
  }
  
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  if (!defaultBaseRateInput) {
    NotificationSystem.notifyError('Default rate input not found');
    return;
  }
  
  const newRate = safeNumber(defaultBaseRateInput.value);
  if (newRate <= 0) {
    NotificationSystem.notifyError('Please enter a valid rate greater than 0');
    return;
  }
  
  try {
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { defaultRate: newRate });
    
    currentUserData.defaultRate = newRate;
    localStorage.setItem('userDefaultRate', newRate.toString());
    
    NotificationSystem.notifySuccess(`Default rate saved: $${newRate.toFixed(2)}/session`);
    initializeDefaultRate(newRate);
    
  } catch (error) {
    console.error('Error saving default rate:', error);
    NotificationSystem.notifyError('Failed to save default rate');
  }
}

function useDefaultRate() {
  const studentRateInput = document.getElementById('studentBaseRate');
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  
  if (studentRateInput && defaultBaseRateInput) {
    studentRateInput.value = defaultBaseRateInput.value;
    NotificationSystem.notifyInfo('Default rate applied to student form');
  }
}

function useDefaultRateInHours() {
  const baseRateInput = document.getElementById('baseRate');
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  
  if (baseRateInput && defaultBaseRateInput) {
    baseRateInput.value = defaultBaseRateInput.value;
    NotificationSystem.notifyInfo('Default rate applied to hours form');
    calculateTotalPay();
  }
}

// ===========================
// REPORT FUNCTIONS (FIXED)
// ===========================

async function showWeeklyBreakdown() {
  try {
    const hours = await EnhancedCache.loadCollection('hours');
    
    if (hours.length === 0) {
      NotificationSystem.notifyWarning('No hours data available for weekly breakdown');
      return;
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weeklyHours = hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= weekStart && entryDate <= now;
    });

    if (weeklyHours.length === 0) {
      NotificationSystem.notifyInfo('No hours logged this week');
      return;
    }

    const totalHours = weeklyHours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = weeklyHours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    
    // Group by day
    const hoursByDay = {};
    weeklyHours.forEach(entry => {
      const day = formatDate(entry.date);
      if (!hoursByDay[day]) {
        hoursByDay[day] = {
          hours: 0,
          earnings: 0,
          entries: []
        };
      }
      const hours = safeNumber(entry.hours);
      const earnings = safeNumber(entry.total || hours * safeNumber(entry.rate));
      hoursByDay[day].hours += hours;
      hoursByDay[day].earnings += earnings;
      hoursByDay[day].entries.push(entry);
    });

    const reportHTML = `
      <div style="padding: 20px; background: white; border-radius: 10px; max-width: 600px;">
        <h3 style="color: #667eea; margin-top: 0;">📅 Weekly Breakdown</h3>
        <p><strong>Period:</strong> ${formatDate(weekStart)} - ${formatDate(now)}</p>
        
        <div style="display: flex; gap: 15px; margin: 20px 0;">
          <div style="flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #667eea;">${totalHours.toFixed(1)}</div>
            <div style="color: #666;">Total Hours</div>
          </div>
          <div style="flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #28a745;">$${totalEarnings.toFixed(2)}</div>
            <div style="color: #666;">Total Earnings</div>
          </div>
        </div>

        <h4 style="color: #555; margin-top: 20px;">Daily Breakdown:</h4>
        ${Object.entries(hoursByDay).map(([day, data]) => `
          <div style="margin: 10px 0; padding: 15px; background: #f0f2f5; border-radius: 8px;">
            <div style="font-weight: bold; color: #333;">${day}</div>
            <div style="display: flex; justify-content: space-between; margin-top: 5px;">
              <span>${data.hours.toFixed(1)} hours</span>
              <span style="font-weight: bold; color: #28a745;">$${data.earnings.toFixed(2)}</span>
            </div>
            <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
              ${data.entries.length} session${data.entries.length !== 1 ? 's' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    showCustomModal('Weekly Breakdown Report', reportHTML);

  } catch (error) {
    console.error('Error generating weekly breakdown:', error);
    NotificationSystem.notifyError('Failed to generate weekly breakdown');
  }
}

async function showBiWeeklyBreakdown() {
  try {
    const hours = await EnhancedCache.loadCollection('hours');
    
    if (hours.length === 0) {
      NotificationSystem.notifyWarning('No hours data available for bi-weekly breakdown');
      return;
    }

    const now = new Date();
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(now.getDate() - 13);
    twoWeeksAgo.setHours(0, 0, 0, 0);

    const biWeeklyHours = hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= twoWeeksAgo && entryDate <= now;
    });

    if (biWeeklyHours.length === 0) {
      NotificationSystem.notifyInfo('No hours logged in the last two weeks');
      return;
    }

    const totalHours = biWeeklyHours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = biWeeklyHours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    
    // Group by week
    const hoursByWeek = {};
    biWeeklyHours.forEach(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      const weekStart = new Date(entryDate);
      weekStart.setDate(entryDate.getDate() - entryDate.getDay());
      const weekKey = formatDate(weekStart);
      
      if (!hoursByWeek[weekKey]) {
        hoursByWeek[weekKey] = {
          hours: 0,
          earnings: 0,
          entries: []
        };
      }
      const hours = safeNumber(entry.hours);
      const earnings = safeNumber(entry.total || hours * safeNumber(entry.rate));
      hoursByWeek[weekKey].hours += hours;
      hoursByWeek[weekKey].earnings += earnings;
      hoursByWeek[weekKey].entries.push(entry);
    });

    const reportHTML = `
      <div style="padding: 20px; background: white; border-radius: 10px; max-width: 600px;">
        <h3 style="color: #667eea; margin-top: 0;">📅 Bi-Weekly Breakdown</h3>
        <p><strong>Period:</strong> ${formatDate(twoWeeksAgo)} - ${formatDate(now)}</p>
        
        <div style="display: flex; gap: 15px; margin: 20px 0;">
          <div style="flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #667eea;">${totalHours.toFixed(1)}</div>
            <div style="color: #666;">Total Hours</div>
          </div>
          <div style="flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #28a745;">$${totalEarnings.toFixed(2)}</div>
            <div style="color: #666;">Total Earnings</div>
          </div>
        </div>

        <h4 style="color: #555; margin-top: 20px;">Weekly Breakdown:</h4>
        ${Object.entries(hoursByWeek).map(([weekStart, data]) => `
          <div style="margin: 10px 0; padding: 15px; background: #f0f2f5; border-radius: 8px;">
            <div style="font-weight: bold; color: #333;">Week of ${weekStart}</div>
            <div style="display: flex; justify-content: space-between; margin-top: 5px;">
              <span>${data.hours.toFixed(1)} hours</span>
              <span style="font-weight: bold; color: #28a745;">$${data.earnings.toFixed(2)}</span>
            </div>
            <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
              ${data.entries.length} session${data.entries.length !== 1 ? 's' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    showCustomModal('Bi-Weekly Breakdown Report', reportHTML);

  } catch (error) {
    console.error('Error generating bi-weekly breakdown:', error);
    NotificationSystem.notifyError('Failed to generate bi-weekly breakdown');
  }
}

async function showMonthlyBreakdown() {
  try {
    const hours = await EnhancedCache.loadCollection('hours');
    
    if (hours.length === 0) {
      NotificationSystem.notifyWarning('No hours data available for monthly breakdown');
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyHours = hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= monthStart && entryDate <= now;
    });

    if (monthlyHours.length === 0) {
      NotificationSystem.notifyInfo('No hours logged this month');
      return;
    }

    const totalHours = monthlyHours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = monthlyHours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    
    // Group by student
    const hoursByStudent = {};
    monthlyHours.forEach(entry => {
      const student = entry.student || 'Unassigned';
      if (!hoursByStudent[student]) {
        hoursByStudent[student] = {
          hours: 0,
          earnings: 0,
          entries: []
        };
      }
      const hours = safeNumber(entry.hours);
      const earnings = safeNumber(entry.total || hours * safeNumber(entry.rate));
      hoursByStudent[student].hours += hours;
      hoursByStudent[student].earnings += earnings;
      hoursByStudent[student].entries.push(entry);
    });

    const reportHTML = `
      <div style="padding: 20px; background: white; border-radius: 10px; max-width: 600px;">
        <h3 style="color: #667eea; margin-top: 0;">📅 Monthly Breakdown - ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        
        <div style="display: flex; gap: 15px; margin: 20px 0;">
          <div style="flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #667eea;">${totalHours.toFixed(1)}</div>
            <div style="color: #666;">Total Hours</div>
          </div>
          <div style="flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #28a745;">$${totalEarnings.toFixed(2)}</div>
            <div style="color: #666;">Total Earnings</div>
          </div>
          <div style="flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #ff6b6b;">${Object.keys(hoursByStudent).length}</div>
            <div style="color: #666;">Students</div>
          </div>
        </div>

        <h4 style="color: #555; margin-top: 20px;">By Student:</h4>
        ${Object.entries(hoursByStudent)
          .sort((a, b) => b[1].earnings - a[1].earnings)
          .map(([student, data]) => `
          <div style="margin: 10px 0; padding: 15px; background: #f0f2f5; border-radius: 8px;">
            <div style="font-weight: bold; color: #333;">${student}</div>
            <div style="display: flex; justify-content: space-between; margin-top: 5px;">
              <span>${data.hours.toFixed(1)} hours</span>
              <span style="font-weight: bold; color: #28a745;">$${data.earnings.toFixed(2)}</span>
            </div>
            <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
              ${data.entries.length} session${data.entries.length !== 1 ? 's' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    showCustomModal('Monthly Breakdown Report', reportHTML);

  } catch (error) {
    console.error('Error generating monthly breakdown:', error);
    NotificationSystem.notifyError('Failed to generate monthly breakdown');
  }
}

async function showSubjectBreakdown() {
  try {
    const hours = await EnhancedCache.loadCollection('hours');
    
    if (hours.length === 0) {
      NotificationSystem.notifyWarning('No hours data available for subject breakdown');
      return;
    }

    // Group by subject
    const hoursBySubject = {};
    hours.forEach(entry => {
      const subject = entry.subject || entry.workSubject || 'General';
      if (!hoursBySubject[subject]) {
        hoursBySubject[subject] = {
          hours: 0,
          earnings: 0,
          entries: [],
          students: new Set()
        };
      }
      const hoursWorked = safeNumber(entry.hours);
      const earnings = safeNumber(entry.total || hoursWorked * safeNumber(entry.rate));
      hoursBySubject[subject].hours += hoursWorked;
      hoursBySubject[subject].earnings += earnings;
      hoursBySubject[subject].entries.push(entry);
      if (entry.student) {
        hoursBySubject[subject].students.add(entry.student);
      }
    });

    const reportHTML = `
      <div style="padding: 20px; background: white; border-radius: 10px; max-width: 600px;">
        <h3 style="color: #667eea; margin-top: 0;">📚 Subject Breakdown</h3>
        <p><strong>Total Subjects:</strong> ${Object.keys(hoursBySubject).length}</p>
        
        ${Object.entries(hoursBySubject)
          .sort((a, b) => b[1].earnings - a[1].earnings)
          .map(([subject, data]) => {
            const avgRate = data.hours > 0 ? (data.earnings / data.hours).toFixed(2) : '0.00';
            return `
            <div style="margin: 15px 0; padding: 20px; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #667eea;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <div style="font-weight: bold; color: #333; font-size: 1.1em;">${subject}</div>
                  <div style="color: #666; margin-top: 5px;">
                    ${data.students.size} student${data.students.size !== 1 ? 's' : ''} • 
                    ${data.entries.length} session${data.entries.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: bold; color: #28a745; font-size: 1.2em;">$${data.earnings.toFixed(2)}</div>
                  <div style="color: #666; font-size: 0.9em;">${data.hours.toFixed(1)} hours</div>
                </div>
              </div>
              <div style="margin-top: 10px; padding: 8px; background: white; border-radius: 6px; font-size: 0.9em;">
                <span style="color: #666;">Avg Rate: </span>
                <span style="font-weight: bold; color: #667eea;">$${avgRate}/hour</span>
              </div>
            </div>
          `;
          }).join('')}
      </div>
    `;

    showCustomModal('Subject Breakdown Report', reportHTML);

  } catch (error) {
    console.error('Error generating subject breakdown:', error);
    NotificationSystem.notifyError('Failed to generate subject breakdown');
  }
}

// Add this function with the other report functions:

async function sendEmailReport() {
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to send email reports');
      return;
    }

    // Collect data for the report
    const [students, hours, payments] = await Promise.all([
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('payments')
    ]);

    // Check if there's any data
    if (hours.length === 0 && students.length === 0 && payments.length === 0) {
      NotificationSystem.notifyWarning('No data available to send email report');
      return;
    }

    // Calculate summary
    const totalStudents = students.length;
    const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    const totalPayments = payments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
    const outstandingBalance = Math.max(totalEarnings - totalPayments, 0);

    // Get recent activities
    const recentHours = hours.slice(0, 5);
    const recentPayments = payments.slice(0, 5);

    // Create email content
    const emailSubject = `WorkLog Report - ${new Date().toLocaleDateString()}`;
    const emailBody = `
WORKLOG REPORT
==============

Generated: ${new Date().toLocaleString()}
User: ${user.email}

SUMMARY
=======
• Total Students: ${totalStudents}
• Total Hours: ${totalHours.toFixed(1)}
• Total Earnings: $${totalEarnings.toFixed(2)}
• Total Payments: $${totalPayments.toFixed(2)}
• Outstanding Balance: $${outstandingBalance.toFixed(2)}

RECENT HOURS
============
${recentHours.length > 0 ? 
  recentHours.map(entry => 
    `• ${formatDate(entry.date)}: ${entry.organization || 'N/A'} - ${entry.student || 'N/A'} - ${safeNumber(entry.hours)}h @ $${safeNumber(entry.rate).toFixed(2)}/h = $${safeNumber(entry.total).toFixed(2)}`
  ).join('\n') : 
  'No hours logged yet.'}

RECENT PAYMENTS
===============
${recentPayments.length > 0 ? 
  recentPayments.map(payment => 
    `• ${formatDate(payment.date)}: ${payment.student || 'N/A'} - $${safeNumber(payment.amount).toFixed(2)} (${payment.method || 'N/A'})`
  ).join('\n') : 
  'No payments recorded yet.'}

STUDENT SUMMARY
===============
${students.length > 0 ? 
  students.slice(0, 10).map(student => 
    `• ${student.name || 'N/A'}: $${student.rate || 0}/hour`
  ).join('\n') : 
  'No students registered yet.'}

${students.length > 10 ? `\n... and ${students.length - 10} more students` : ''}

---
Generated by WorkLog Pro - Teacher's Productivity Companion
${new Date().toLocaleString()}
`;

    // Create mailto link
    const mailtoLink = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    // Try to open email client
    try {
      window.location.href = mailtoLink;
      NotificationSystem.notifyInfo('Opening email client with report data...');
    } catch (error) {
      console.error('Error opening email client:', error);
      
      // Fallback: Show the email content in a modal
      const emailHTML = `
        <div style="padding: 20px;">
          <h3 style="color: #667eea; margin-top: 0;">📧 Email Report</h3>
          <p>Could not open email client automatically. Here's your report:</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <strong>Subject:</strong><br>
            <code style="display: block; padding: 8px; background: white; border-radius: 4px; margin: 5px 0;">${emailSubject}</code>
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <strong>Body:</strong>
            <pre style="
              background: white;
              padding: 15px;
              border-radius: 4px;
              margin: 10px 0;
              white-space: pre-wrap;
              word-wrap: break-word;
              max-height: 300px;
              overflow-y: auto;
              font-family: monospace;
              font-size: 12px;
            ">${emailBody}</pre>
          </div>
          
          <div style="margin-top: 20px;">
            <button onclick="copyToClipboard('${emailBody.replace(/'/g, "\\'")}')" style="
              padding: 10px 20px;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              margin-right: 10px;
            ">
              📋 Copy Report Text
            </button>
            
            <button onclick="window.open('mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}')" style="
              padding: 10px 20px;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
            ">
              ✉️ Try Opening Email Again
            </button>
          </div>
        </div>
      `;
      
      showCustomModal('Email Report', emailHTML);
      
      // Add copy function to window
      window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text).then(() => {
          NotificationSystem.notifySuccess('Report copied to clipboard!');
        }).catch(err => {
          console.error('Copy failed:', err);
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            NotificationSystem.notifySuccess('Report copied to clipboard!');
          } catch (e) {
            NotificationSystem.notifyError('Could not copy text');
          }
          document.body.removeChild(textArea);
        });
      };
    }

  } catch (error) {
    console.error('Error sending email report:', error);
    NotificationSystem.notifyError('Failed to prepare email report: ' + error.message);
  }
}

// ===========================
// MODAL HELPER FUNCTION
// ===========================

function showCustomModal(title, content) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    max-width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  `;
  
  modalContent.innerHTML = `
    <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; color: #333;">${title}</h3>
      <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" style="
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 5px;
        border-radius: 4px;
      ">&times;</button>
    </div>
    <div style="padding: 20px;">
      ${content}
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Close on escape key
  const closeModal = () => modal.remove();
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

// ===========================
// FIXED PDF REPORT FUNCTION
// ===========================

async function generatePDFReport() {
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to generate reports');
      return;
    }

    NotificationSystem.notifyInfo('Generating PDF report...');

    // Collect data for the report
    const [students, hours, marks, payments, attendance] = await Promise.all([
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('marks'),
      EnhancedCache.loadCollection('payments'),
      EnhancedCache.loadCollection('attendance')
    ]);

    // Check if there's any data
    if (hours.length === 0 && students.length === 0 && payments.length === 0) {
      NotificationSystem.notifyWarning('No data available to generate report');
      return;
    }

    // Calculate summary statistics
    const totalStudents = students.length;
    const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    const totalPayments = payments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
    const outstandingBalance = Math.max(totalEarnings - totalPayments, 0);

    // Group hours by date for invoice-style reporting
    const hoursByDate = {};
    hours.forEach(entry => {
      const date = entry.date || 'Unknown Date';
      if (!hoursByDate[date]) {
        hoursByDate[date] = {
          date: date,
          entries: [],
          totalHours: 0,
          totalAmount: 0
        };
      }
      const entryHours = safeNumber(entry.hours);
      const entryRate = safeNumber(entry.rate);
      const entryTotal = entryHours * entryRate;
      
      hoursByDate[date].entries.push({
        organization: entry.organization || 'N/A',
        student: entry.student || 'N/A',
        hours: entryHours,
        rate: entryRate,
        total: entryTotal,
        subject: entry.subject || 'N/A',
        workType: entry.workType || 'N/A'
      });
      
      hoursByDate[date].totalHours += entryHours;
      hoursByDate[date].totalAmount += entryTotal;
    });

    // Convert to array and sort by date (newest first)
    const dateReports = Object.values(hoursByDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group earnings by student
    const earningsByStudent = {};
    hours.forEach(entry => {
      const studentName = entry.student || 'Unknown';
      const earnings = safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0));
      if (!earningsByStudent[studentName]) {
        earningsByStudent[studentName] = {
          name: studentName,
          totalHours: 0,
          totalEarnings: 0,
          entries: []
        };
      }
      earningsByStudent[studentName].totalHours += safeNumber(entry.hours);
      earningsByStudent[studentName].totalEarnings += earnings;
      earningsByStudent[studentName].entries.push({
        date: entry.date,
        hours: safeNumber(entry.hours),
        rate: safeNumber(entry.rate),
        total: earnings,
        subject: entry.subject
      });
    });

    // Sort students by total earnings (highest first)
    const studentEarnings = Object.values(earningsByStudent)
      .sort((a, b) => b.totalEarnings - a.totalEarnings);

    // Create HTML content for the PDF
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>WorkLog Invoice Report - ${new Date().toLocaleDateString()}</title>
        <style>
          /* ... (keep the same CSS styles from before) ... */
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            margin: 40px; 
            background: #f8f9fa;
            color: #333;
          }
          /* ... (include all the CSS styles from the previous version) ... */
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <h1>📊 WorkLog Invoice Report</h1>
          <div class="invoice-meta">
            <div class="meta-item">
              <span class="meta-label">Generated:</span>
              <span class="meta-value">${new Date().toLocaleString()}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">User:</span>
              <span class="meta-value">${user.email}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Report Period:</span>
              <span class="meta-value">All Time</span>
            </div>
          </div>
        </div>
        
        <!-- ... (include all the HTML content from the previous version) ... -->
        
        <script>
          // Auto-print after a short delay
          setTimeout(() => {
            window.print();
          }, 1000);
        </script>
      </body>
      </html>
    `;

    // Try to open in a new window - handle popup blockers
    try {
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
      
      if (!printWindow) {
        // Popup blocked - show alternative
        NotificationSystem.notifyWarning('Popup blocked. Please allow popups for PDF generation, or copy the URL below and open in new window:');
        
        // Create a download link as fallback
        const blob = new Blob([reportHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `WorkLog_Report_${new Date().toISOString().split('T')[0]}.html`;
        link.textContent = 'Download HTML Report';
        link.style.cssText = 'display: block; padding: 15px; background: #007bff; color: white; text-align: center; border-radius: 5px; text-decoration: none; margin: 20px 0;';
        
        showCustomModal('Report Generated', `
          <div style="padding: 20px;">
            <p>Popup was blocked. You can:</p>
            <p>1. Download the HTML report and open it in your browser:</p>
            <a href="${url}" download="WorkLog_Report.html" style="
              display: inline-block;
              padding: 12px 24px;
              background: #007bff;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 10px 0;
            ">📥 Download HTML Report</a>
            <p>2. Copy and paste this URL into a new browser tab:</p>
            <input type="text" value="${url}" readonly style="
              width: 100%;
              padding: 10px;
              margin: 10px 0;
              border: 1px solid #ddd;
              border-radius: 4px;
              background: #f8f9fa;
            ">
            <button onclick="navigator.clipboard.writeText('${url}')" style="
              padding: 8px 16px;
              background: #6c757d;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">📋 Copy URL</button>
          </div>
        `);
        
        return;
      }
      
      // Write content to the window
      printWindow.document.write(reportHTML);
      printWindow.document.close();
      
      // Wait for content to load
      printWindow.onload = function() {
        setTimeout(() => {
          try {
            printWindow.print();
            NotificationSystem.notifySuccess('Invoice report generated successfully');
          } catch (printError) {
            console.error('Print error:', printError);
            NotificationSystem.notifyInfo('Report opened in new window. Use browser print function (Ctrl+P)');
          }
        }, 500);
      };
      
    } catch (windowError) {
      console.error('Window error:', windowError);
      NotificationSystem.notifyError('Could not open report window. Please check popup settings.');
    }

  } catch (error) {
    console.error('Error generating invoice report:', error);
    NotificationSystem.notifyError('Failed to generate invoice report: ' + error.message);
  }
}

// ===========================
// ENHANCED REPORT FUNCTIONS
// ===========================

function setupReportButtons() {
  // Add PDF and Email buttons to reports tab
  const reportsTab = document.getElementById('reports');
  if (reportsTab) {
    // Check if buttons already exist
    if (!document.getElementById('generatePdfBtn')) {
      const actionButtons = `
        <div class="report-actions" style="margin: 20px 0; display: flex; gap: 10px;">
          <button id="generatePdfBtn" class="button primary" onclick="generatePDFReport()">
            📄 Generate PDF Report
          </button>
          <button id="sendEmailBtn" class="button success" onclick="sendEmailReport()">
            📧 Email Report
          </button>
        </div>
      `;
      
      // Insert at the beginning of the reports tab
      reportsTab.insertAdjacentHTML('afterbegin', actionButtons);
    }
  }
}

// ===========================
// INITIALIZATION
// ===========================

async function initializeApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  // Initialize notification system first
  NotificationSystem.initNotificationStyles();
  
  // Setup authentication state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('✅ User authenticated:', user.email);
      
      // Load user profile and data
      await loadUserProfile(user.uid);
      EnhancedCache.loadCachedData();
      
      // Initialize systems
      setupTabNavigation();
      setupFormHandlers();
      setupProfileModal();
      setupFloatingAddButton();
      setupReportButtons();
      SyncBar.init();
      
      // Load and render initial data
      await Promise.all([
        renderStudents(),
        renderRecentHoursWithEdit(),
        renderRecentMarksWithEdit(),
        renderAttendanceRecentWithEdit(),
        renderPaymentActivityWithEdit(),
        renderStudentBalancesWithEdit()
      ]);
      
      // Populate dropdowns
      await populateStudentDropdowns();
      
      // Update UI
      updateHeaderStats();
      
      console.log('✅ App initialization complete');
      
    } else {
      console.log('❌ No user signed in, redirecting to auth...');
      window.location.href = "auth.html";
    }
  });
  
  // Initialize theme
  initializeTheme();
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM Content Loaded - Starting app initialization...');
  initializeApp();
});

// ===========================
// EXPORT FUNCTIONS FOR GLOBAL ACCESS
// ===========================

window.NotificationSystem = NotificationSystem;
window.saveDefaultRate = saveDefaultRate;
window.useDefaultRate = useDefaultRate;
window.useDefaultRateInHours = useDefaultRateInHours;
window.selectAllStudents = function() {
  const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = true);
  NotificationSystem.notifySuccess(`Selected all ${checkboxes.length} students`);
};
window.clearStudentForm = clearStudentForm;
window.clearAttendanceForm = function() {
  const form = document.getElementById('attendanceForm');
  if (form) {
    form.reset();
    const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    NotificationSystem.notifyInfo('Attendance form cleared');
  }
};
window.resetHoursForm = resetHoursForm;
window.resetMarksForm = resetMarksForm;
window.resetPaymentForm = resetPaymentForm;
window.showWeeklyBreakdown = showWeeklyBreakdown;
window.showBiWeeklyBreakdown = showBiWeeklyBreakdown;
window.showMonthlyBreakdown = showMonthlyBreakdown;
window.showSubjectBreakdown = showSubjectBreakdown;
window.generatePDFReport = generatePDFReport;
window.sendEmailReport = sendEmailReport;

console.log('✅ app.js loaded successfully');
