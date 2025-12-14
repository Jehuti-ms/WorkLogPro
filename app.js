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
        NotificationSystem.notifyInfo('Export to cloud feature coming soon');
      });
    }
  },

  setupImportCloudButton() {
    if (importCloudBtn) {
      importCloudBtn.addEventListener('click', async () => {
        NotificationSystem.notifyInfo('Import from cloud feature coming soon');
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
      exportDataBtn.addEventListener('click', () => {
        NotificationSystem.notifyInfo('Export data feature coming soon');
      });
    }
  },

  setupImportDataButton() {
    if (importDataBtn) {
      importDataBtn.addEventListener('click', () => {
        NotificationSystem.notifyInfo('Import data feature coming soon');
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
      } catch (e) { console.warn('UI refresh failed:', e); }

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
      
      studentsHTML += `
        <div class="student-card">
          <div class="student-card-header">
            <div>
              <strong>${studentName}</strong>
            </div>
            <div class="student-actions">
              <button class="btn-icon" onclick="editStudent('${student.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteStudent('${student.id}')" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="student-details">
            <div class="muted">${student.gender || 'Not specified'} • ${student.email || 'No email'} • ${student.phone || 'No phone'}</div>
            <div class="student-rate">Rate: $${student.rate || 0}/session</div>
            <div class="student-meta">Added: ${formatDate(student.createdAt)}</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = studentsHTML;
    console.log(`✅ Rendered ${students.length} students`);

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
      const dateA = new Date(a.date || a.dateIso);
      const dateB = new Date(b.date || b.dateIso);
      return dateB - dateA;
    });

    let hoursHTML = '';
    sortedHours.slice(0, limit).forEach(entry => {
      hoursHTML += `
        <div class="hours-entry" id="hours-entry-${entry.id}">
          <div class="hours-header">
            <strong>${entry.organization || 'No organization'}</strong>
            <span class="hours-type">${entry.workType || 'General'}</span>
            <div class="student-actions">
              <button class="btn-icon" onclick="startEditHours('${entry.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteHours('${entry.id}')" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="muted">${formatDate(entry.date)} • ${entry.subject || 'General'}</div>
          <div class="hours-details">
            <span>Hours: ${safeNumber(entry.hours)}</span>
            <span>Rate: $${entry.rate || 0}</span>
            <span class="hours-total">Total: $${entry.total || 0}</span>
          </div>
          ${entry.student ? `<div class="muted">Student: ${entry.student}</div>` : ''}
          ${entry.notes ? `<div class="muted">Notes: ${entry.notes}</div>` : ''}
        </div>
      `;
    });

    container.innerHTML = hoursHTML;

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
      const dateA = new Date(a.date || a.dateIso);
      const dateB = new Date(b.date || b.dateIso);
      return dateB - dateA;
    });

    let marksHTML = '';
    sortedMarks.slice(0, limit).forEach(entry => {
      const studentName = entry.student || 'Unknown Student';
      
      marksHTML += `
        <div class="mark-entry" id="mark-entry-${entry.id}">
          <div class="mark-header">
            <strong>${studentName}</strong>
            — ${entry.subject || 'No Subject'} (${entry.topic || 'No Topic'})
            <div class="student-actions">
              <button class="btn-icon" onclick="startEditMark('${entry.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteMark('${entry.id}')" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="muted">${formatDate(entry.date)}</div>
          <div>Score: ${safeNumber(entry.score)}/${safeNumber(entry.max)} — ${safeNumber(entry.percentage).toFixed(2)}% — Grade: ${entry.grade || 'N/A'}</div>
          ${entry.notes ? `<div class="muted">Notes: ${entry.notes}</div>` : ''}
        </div>
      `;
    });

    container.innerHTML = marksHTML;

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
      const dateA = new Date(a.date || a.dateIso);
      const dateB = new Date(b.date || b.dateIso);
      return dateB - dateA;
    });

    let attendanceHTML = '';
    sortedAttendance.slice(0, limit).forEach(entry => {
      const presentCount = Array.isArray(entry.present) ? entry.present.length : 0;
      const presentStudents = Array.isArray(entry.present) ? entry.present.join(', ') : 'None';
      
      attendanceHTML += `
        <div class="attendance-entry" id="attendance-entry-${entry.id}">
          <div class="attendance-header">
            <strong>${entry.subject || 'No Subject'}</strong> — ${entry.topic || "—"}
            <div class="student-actions">
              <button class="btn-icon" onclick="startEditAttendance('${entry.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteAttendance('${entry.id}')" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="muted">${formatDate(entry.date)}</div>
          <div>Present: ${presentCount} students</div>
          <div class="muted">Students: ${presentStudents}</div>
          ${entry.notes ? `<div class="muted">Notes: ${entry.notes}</div>` : ''}
        </div>
      `;
    });

    container.innerHTML = attendanceHTML;

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
      const dateA = new Date(a.date || a.dateIso);
      const dateB = new Date(b.date || b.dateIso);
      return dateB - dateA;
    });

    let paymentHTML = '';
    sortedPayments.slice(0, limit).forEach(entry => {
      paymentHTML += `
        <div class="activity-item" id="payment-entry-${entry.id}">
          <div class="payment-header">
            <strong>$${safeNumber(entry.amount).toFixed(2)}</strong> — ${entry.student || 'Unknown Student'}
            <div class="student-actions">
              <button class="btn-icon" onclick="startEditPayment('${entry.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deletePayment('${entry.id}')" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="muted">${formatDate(entry.date)} | ${entry.method || 'Unknown Method'}</div>
          <div>${entry.notes || ""}</div>
        </div>
      `;
    });

    container.innerHTML = paymentHTML;
    
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
    
    hours.forEach(entry => {
      const studentName = entry.student;
      if (studentName) {
        const earnings = entry.total || (entry.hours || 0) * (entry.rate || 0);
        earningsByStudent[studentName] = (earningsByStudent[studentName] || 0) + safeNumber(earnings);
      }
    });

    payments.forEach(payment => {
      const studentName = payment.student;
      if (studentName) {
        paymentsByStudent[studentName] = (paymentsByStudent[studentName] || 0) + safeNumber(payment.amount);
      }
    });

    let balancesHTML = '';
    let totalOwed = 0;

    students.forEach(student => {
      const studentName = student.name || `Student ${student.id}`;
      const earned = earningsByStudent[studentName] || 0;
      const paid = paymentsByStudent[studentName] || 0;
      const owed = Math.max(earned - paid, 0);
      totalOwed += owed;

      balancesHTML += `
        <div class="activity-item" id="balance-${student.id}">
          <div>
            <strong>${studentName}</strong>
            <div class="student-actions" style="display: inline-block; margin-left: 10px;">
              <button class="btn-icon" onclick="quickAddPayment('${studentName}')" title="Add Payment">💰</button>
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
// STUDENT FORM FUNCTIONS
// ===========================

async function handleStudentSubmit(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const formData = new FormData(e.target);
    const studentData = {
        name: document.getElementById('studentName').value,
        email: document.getElementById('studentEmail').value,
        phone: document.getElementById('studentPhone').value,
        gender: document.getElementById('studentGender').value,
        rate: safeNumber(document.getElementById('studentBaseRate').value),
        createdAt: new Date().toISOString()
    };

    try {
        await EnhancedCache.saveWithBackgroundSync('students', studentData);
        NotificationSystem.notifySuccess('Student added successfully!');
        
        // Clear form
        e.target.reset();
        
        // Refresh UI
        await renderStudents();
        
        // Refresh dropdowns
        await populateStudentDropdowns();
        
    } catch (error) {
        console.error('Error adding student:', error);
        NotificationSystem.notifyError('Failed to add student');
    }
}

async function editStudent(id) {
  NotificationSystem.notifyInfo(`Edit student ${id} - Feature coming soon`);
}

async function deleteStudent(id) {
  if (confirm('Are you sure you want to delete this student?')) {
    NotificationSystem.notifyInfo(`Delete student ${id} - Feature coming soon`);
  }
}

// ===========================
// HOURS FORM FUNCTIONS
// ===========================

async function handleHoursSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const hoursData = {
    organization: document.getElementById('organization').value,
    workType: document.getElementById('workType').value,
    subject: document.getElementById('workSubject').value,
    student: document.getElementById('hoursStudent').value,
    hours: safeNumber(document.getElementById('hoursWorked').value),
    rate: safeNumber(document.getElementById('baseRate').value),
    total: safeNumber(document.getElementById('hoursWorked').value) * safeNumber(document.getElementById('baseRate').value),
    date: document.getElementById('workDate').value,
    dateIso: fmtDateISO(document.getElementById('workDate').value)
  };

  try {
    await EnhancedCache.saveWithBackgroundSync('hours', hoursData);
    NotificationSystem.notifySuccess('Hours logged successfully!');
    
    // Clear form
    e.target.reset();
    
    // Refresh UI
    await renderRecentHoursWithEdit();
    
  } catch (error) {
    console.error('Error saving hours:', error);
    NotificationSystem.notifyError('Failed to save hours');
  }
}

// ===========================
// MARKS FORM FUNCTIONS
// ===========================

async function handleMarksSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

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
    dateIso: fmtDateISO(document.getElementById('marksDate').value)
  };

  try {
    await EnhancedCache.saveWithBackgroundSync('marks', marksData);
    NotificationSystem.notifySuccess('Mark added successfully!');
    
    // Clear form
    e.target.reset();
    
    // Refresh UI
    await renderRecentMarksWithEdit();
    
  } catch (error) {
    console.error('Error saving mark:', error);
    NotificationSystem.notifyError('Failed to save mark');
  }
}

// ===========================
// ATTENDANCE FORM FUNCTIONS
// ===========================

async function handleAttendanceSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const presentCheckboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]:checked');
  const presentStudents = Array.from(presentCheckboxes).map(cb => cb.value);

  const attendanceData = {
    subject: document.getElementById('attendanceSubject').value,
    topic: document.getElementById('attendanceTopic').value,
    present: presentStudents,
    date: document.getElementById('attendanceDate').value,
    dateIso: fmtDateISO(document.getElementById('attendanceDate').value)
  };

  try {
    await EnhancedCache.saveWithBackgroundSync('attendance', attendanceData);
    NotificationSystem.notifySuccess('Attendance recorded successfully!');
    
    // Clear form
    e.target.reset();
    
    // Clear checkboxes
    presentCheckboxes.forEach(cb => cb.checked = false);
    
    // Refresh UI
    await renderAttendanceRecentWithEdit();
    
  } catch (error) {
    console.error('Error saving attendance:', error);
    NotificationSystem.notifyError('Failed to save attendance');
  }
}

// ===========================
// PAYMENT FORM FUNCTIONS
// ===========================

async function handlePaymentSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const paymentData = {
    student: document.getElementById('paymentStudent').value,
    amount: safeNumber(document.getElementById('paymentAmount').value),
    method: document.getElementById('paymentMethod').value,
    date: document.getElementById('paymentDate').value,
    dateIso: fmtDateISO(document.getElementById('paymentDate').value)
  };

  try {
    await EnhancedCache.saveWithBackgroundSync('payments', paymentData);
    NotificationSystem.notifySuccess('Payment recorded successfully!');
    
    // Clear form
    e.target.reset();
    
    // Refresh UI
    await renderPaymentActivityWithEdit();
    await renderStudentBalancesWithEdit();
    
  } catch (error) {
    console.error('Error saving payment:', error);
    NotificationSystem.notifyError('Failed to save payment');
  }
}

function quickAddPayment(studentName) {
  document.getElementById('paymentStudent').value = studentName;
  document.getElementById('paymentAmount').focus();
  NotificationSystem.notifyInfo(`Quick payment mode for ${studentName}`);
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
// FORM SETUP HANDLERS
// ===========================

function setupFormHandlers() {
  console.log('🔧 Setting up form handlers...');
  
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
  }
  
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
  }
  
  const marksForm = document.getElementById('marksForm');
  if (marksForm) {
    marksForm.addEventListener('submit', handleMarksSubmit);
  }
  
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', handleAttendanceSubmit);
  }
  
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmit);
  }
  
  // Set today's date for date inputs
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(input => {
    if (!input.value) {
      input.value = today;
    }
  });
  
  // Set up hours calculation
  const hoursInput = document.getElementById('hoursWorked');
  const rateInput = document.getElementById('baseRate');
  if (hoursInput && rateInput) {
    hoursInput.addEventListener('input', calculateTotalPay);
    rateInput.addEventListener('input', calculateTotalPay);
  }
  
  console.log('✅ Form handlers initialized');
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

// Export functions for global access
window.NotificationSystem = NotificationSystem;
window.saveDefaultRate = saveDefaultRate;
window.useDefaultRate = useDefaultRate;
window.useDefaultRateInHours = useDefaultRateInHours;
window.selectAllStudents = function() {
  const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = true);
  NotificationSystem.notifySuccess(`Selected all ${checkboxes.length} students`);
};

console.log('✅ app.js loaded successfully');
