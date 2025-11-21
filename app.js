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
// CACHE SYSTEM - FIXED VERSION
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
  async saveWithBackgroundSync(collection, data, id = null) {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No user authenticated for cache save');
      return false;
    }

    try {
      const itemId = id || this.generateId();
      const cacheItem = {
        ...data,
        _id: itemId,
        _cachedAt: Date.now(),
        _synced: false
      };

      this.saveToLocalStorage(collection, cacheItem);
      this.updateUICache(collection, cacheItem);
      this.backgroundFirebaseSync(collection, cacheItem, user.uid);
      
      console.log(`✅ ${collection} saved to cache immediately`);
      return itemId;
    } catch (error) {
      console.error(`❌ Cache save failed for ${collection}:`, error);
      return false;
    }
  },

  generateId() {
    return 'cache_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  saveToLocalStorage(collection, item) {
    try {
      const key = `worklog_${collection}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter(i => i._id !== item._id);
      filtered.push(item);
      localStorage.setItem(key, JSON.stringify(filtered));
      console.log(`💾 Saved to localStorage: ${collection} - ${item._id}`);
    } catch (error) {
      console.error('❌ localStorage save failed:', error);
    }
  },

  updateUICache(collection, item) {
    if (!Array.isArray(cache[collection])) {
      cache[collection] = [];
    }
    
    const index = cache[collection].findIndex(i => i._id === item._id);
    if (index >= 0) {
      cache[collection][index] = item;
    } else {
      cache[collection].push(item);
    }
    cache.lastSync = Date.now();
  },

  async backgroundFirebaseSync(collection, item, uid) {
    try {
      const { _id, _cachedAt, _synced, ...firebaseData } = item;
      let result;
      
      if (item._id.startsWith('cache_')) {
        const docRef = await addDoc(collection(db, "users", uid, collection), firebaseData);
        result = docRef.id;
      } else {
        await updateDoc(doc(db, "users", uid, collection, item._id), firebaseData);
        result = item._id;
      }
      
      this.markAsSynced(collection, item._id, result);
      console.log(`☁️ Background sync successful: ${collection} - ${item._id}`);
      EnhancedStats.forceRefresh();
    } catch (error) {
      console.error(`❌ Background sync failed for ${collection}:`, error);
    }
  },

  markAsSynced(collection, cacheId, firebaseId) {
    const key = `worklog_${collection}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = existing.map(item => 
      item._id === cacheId ? { ...item, _synced: true, _firebaseId: firebaseId } : item
    );
    localStorage.setItem(key, JSON.stringify(updated));
    
    if (cache[collection] && Array.isArray(cache[collection])) {
      cache[collection] = cache[collection].map(item =>
        item._id === cacheId ? { ...item, _synced: true, _firebaseId: firebaseId } : item
      );
    }
  },

  loadCachedData() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    collections.forEach(collection => {
      const key = `worklog_${collection}`;
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
          cache[collection] = cached;
          console.log(`📁 Loaded ${cached.length} cached ${collection} from localStorage`);
        }
      } catch (error) {
        console.error(`❌ Error loading cached ${collection}:`, error);
        cache[collection] = [];
      }
    });
    this.retryUnsyncedItems();
  },

  async retryUnsyncedItems() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    const user = auth.currentUser;
    if (!user) return;

    collections.forEach(collection => {
      const key = `worklog_${collection}`;
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(cached)) {
          const unsynced = cached.filter(item => !item._synced);
          unsynced.forEach(item => {
            console.log(`🔄 Retrying sync for ${collection}: ${item._id}`);
            this.backgroundFirebaseSync(collection, item, user.uid);
          });
        }
      } catch (error) {
        console.error(`❌ Error retrying sync for ${collection}:`, error);
      }
    });
  },

  getCacheStatus() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    let total = 0;
    let unsynced = 0;

    collections.forEach(collection => {
      const key = `worklog_${collection}`;
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(cached)) {
          total += cached.length;
          unsynced += cached.filter(item => !item._synced).length;
        }
      } catch (error) {
        console.error(`❌ Error getting cache status for ${collection}:`, error);
      }
    });

    return { total, unsynced };
  },

  // NEW: Enhanced data loading with caching
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
// ENHANCED REAL-TIME STATS SYSTEM
// ===========================

const EnhancedStats = {
  init() {
    this.setupStatsUpdaters();
    this.startStatsRefresh();
    console.log('✅ Enhanced stats system initialized');
  },

  setupStatsUpdaters() {
    this.updateStudentStats = this.debounce(() => this.calculateStudentStats(), 500);
    this.updateHoursStats = this.debounce(() => this.calculateHoursStats(), 500);
    this.updateMarksStats = this.debounce(() => this.calculateMarksStats(), 500);
    this.updateAttendanceStats = this.debounce(() => this.calculateAttendanceStats(), 500);
    this.updatePaymentStats = this.debounce(() => this.calculatePaymentStats(), 500);
    this.updateOverviewStats = this.debounce(() => this.calculateOverviewStats(), 1000);
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  startStatsRefresh() {
    setInterval(() => {
      this.refreshAllStats();
    }, 30000);
  },

  async refreshAllStats() {
    try {
      await Promise.all([
        this.calculateStudentStats(),
        this.calculateHoursStats(),
        this.calculateMarksStats(),
        this.calculateAttendanceStats(),
        this.calculatePaymentStats(),
        this.calculateOverviewStats()
      ]);
      console.log('✅ All stats refreshed');
    } catch (error) {
      console.error('❌ Error refreshing stats:', error);
    }
  },

  async calculateStudentStats() {
    try {
      const students = Array.isArray(cache.students) ? cache.students : [];
      const studentCount = students.length;
      
      let averageRate = 0;
      if (studentCount > 0) {
        const totalRate = students.reduce((sum, student) => {
          const rate = student.rate || student.studentRate || 0;
          return sum + safeNumber(rate);
        }, 0);
        averageRate = totalRate / studentCount;
      }
      
      this.updateElement('studentCount', studentCount);
      this.updateElement('averageRate', fmtMoney(averageRate));
      this.updateElement('totalStudentsCount', studentCount);
      this.updateElement('totalStudentsReport', studentCount);
    } catch (error) {
      console.error('Error calculating student stats:', error);
    }
  },

  async calculateHoursStats() {
    try {
      const hours = Array.isArray(cache.hours) ? cache.hours : [];
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const weeklyData = hours.filter(entry => {
        const entryDate = new Date(entry.date || entry.dateIso);
        return entryDate >= weekStart;
      });
      
      const monthlyData = hours.filter(entry => {
        const entryDate = new Date(entry.date || entry.dateIso);
        return entryDate >= monthStart;
      });
      
      const weeklyHours = weeklyData.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const weeklyTotal = weeklyData.reduce((sum, entry) => sum + (entry.total || 0), 0);
      const monthlyHours = monthlyData.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const monthlyTotal = monthlyData.reduce((sum, entry) => sum + (entry.total || 0), 0);
      
      this.updateElement('weeklyHours', weeklyHours.toFixed(1));
      this.updateElement('weeklyTotal', fmtMoney(weeklyTotal));
      this.updateElement('monthlyHours', monthlyHours.toFixed(1));
      this.updateElement('monthlyTotal', fmtMoney(monthlyTotal));
      
      const totalHours = hours.reduce((sum, entry) => sum + (entry.hours || 0), 0);
      const totalEarnings = hours.reduce((sum, entry) => sum + (entry.total || 0), 0);
      
      this.updateElement('totalHoursReport', totalHours.toFixed(1));
      this.updateElement('totalEarningsReport', `$${fmtMoney(totalEarnings)}`);
    } catch (error) {
      console.error('Error calculating hours stats:', error);
    }
  },

  async calculateMarksStats() {
    try {
      const marks = Array.isArray(cache.marks) ? cache.marks : [];
      const marksCount = marks.length;
      
      let avgPercentage = 0;
      if (marksCount > 0) {
        const totalPercentage = marks.reduce((sum, mark) => sum + (mark.percentage || 0), 0);
        avgPercentage = totalPercentage / marksCount;
      }
      
      this.updateElement('marksCount', marksCount);
      this.updateElement('avgMarks', avgPercentage.toFixed(1));
      this.updateElement('avgMarkReport', `${avgPercentage.toFixed(1)}%`);
    } catch (error) {
      console.error('Error calculating marks stats:', error);
    }
  },

  async calculateAttendanceStats() {
    try {
      const attendance = Array.isArray(cache.attendance) ? cache.attendance : [];
      const attendanceCount = attendance.length;
      
      let lastSession = null;
      if (attendanceCount > 0) {
        lastSession = attendance.reduce((latest, session) => {
          const sessionDate = new Date(session.date || session.dateIso);
          const latestDate = new Date(latest.date || latest.dateIso);
          return sessionDate > latestDate ? session : latest;
        });
      }
      
      this.updateElement('attendanceCount', attendanceCount);
      this.updateElement('lastSessionDate', lastSession ? formatDate(lastSession.date) : 'Never');
    } catch (error) {
      console.error('Error calculating attendance stats:', error);
    }
  },

  async calculatePaymentStats() {
    try {
      const payments = Array.isArray(cache.payments) ? cache.payments : [];
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const monthlyPayments = payments
        .filter(payment => (payment.date || '').startsWith(currentMonth))
        .reduce((sum, payment) => sum + (payment.amount || 0), 0);
      
      const totalPayments = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      
      this.updateElement('monthlyPayments', `$${fmtMoney(monthlyPayments)}`);
      this.updateElement('totalPaymentsReport', `$${fmtMoney(totalPayments)}`);
      await this.calculateOutstandingBalance();
    } catch (error) {
      console.error('Error calculating payment stats:', error);
    }
  },

  async calculateOutstandingBalance() {
    try {
      const students = Array.isArray(cache.students) ? cache.students : [];
      const hours = Array.isArray(cache.hours) ? cache.hours : [];
      const payments = Array.isArray(cache.payments) ? cache.payments : [];
      
      const earningsByStudent = {};
      hours.forEach(entry => {
        const studentId = entry.student;
        if (studentId) {
          earningsByStudent[studentId] = (earningsByStudent[studentId] || 0) + (entry.total || 0);
        }
      });
      
      const paymentsByStudent = {};
      payments.forEach(payment => {
        const studentId = payment.student;
        if (studentId) {
          paymentsByStudent[studentId] = (paymentsByStudent[studentId] || 0) + (payment.amount || 0);
        }
      });
      
      let totalOwed = 0;
      students.forEach(student => {
        const studentId = student.id || student._id;
        const earned = earningsByStudent[studentId] || 0;
        const paid = paymentsByStudent[studentId] || 0;
        const owed = Math.max(earned - paid, 0);
        totalOwed += owed;
      });
      
      this.updateElement('totalOwed', `$${fmtMoney(totalOwed)}`);
      this.updateElement('outstandingBalance', `$${fmtMoney(totalOwed)}`);
    } catch (error) {
      console.error('Error calculating outstanding balance:', error);
    }
  },

  async calculateOverviewStats() {
    console.log('📊 Overview stats calculated');
  },

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  },

  forceRefresh() {
    this.refreshAllStats();
  }
};

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
          syncIndicator.classList.add('sync-connected');
        }
        this.startAutoSync();
        console.log('✅ Auto-sync restored from previous session');
      } else {
        autoSyncText.textContent = 'Manual';
        if (syncIndicator) {
          syncIndicator.style.backgroundColor = '#ef4444';
          syncIndicator.classList.remove('sync-connected');
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
  return safeNumber(n).toFixed(2);
}

function fmtDateISO(yyyyMmDd) {
  if (!yyyyMmDd) return new Date().toISOString();
  try {
    const [year, month, day] = yyyyMmDd.split('-');
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function formatDate(dateString) {
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

function getLocalISODate() {
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

function formatDateForInput(dateString) {
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
}

// ===========================
// THEME MANAGEMENT - SIMPLE WITH 🌓
// ===========================

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    console.log('🔄 Toggling theme from', currentTheme, 'to', newTheme);
    
    // Apply the theme
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Add animation to the button
    animateThemeButton();
}

function animateThemeButton() {
    const themeButton = document.querySelector('.theme-toggle button');
    if (!themeButton) return;
    
    // Add spin animation
    themeButton.style.transform = 'rotate(180deg)';
    themeButton.style.transition = 'transform 0.5s ease';
    
    // Reset animation after it completes
    setTimeout(() => {
        themeButton.style.transform = 'rotate(0deg)';
    }, 500);
}

function setupThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle button');
    if (themeToggle) {
        console.log('🎯 Found theme toggle button');
        
        // Set the 🌓 symbol
        themeToggle.innerHTML = '🌓';
        themeToggle.setAttribute('title', 'Toggle theme');
        
        // Add basic styles
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
        
        // Remove any existing event listeners by cloning
        const newButton = themeToggle.cloneNode(true);
        themeToggle.parentNode.replaceChild(newButton, themeToggle);
        
        // Add click event to the new button
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎨 Theme button clicked');
            toggleTheme();
        });
        
        // Add hover effects
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
    
    // Apply the theme
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Initialize the theme button after a short delay to ensure DOM is ready
    setTimeout(() => {
        setupThemeToggle();
    }, 100);
}

// Add CSS for smooth animations
function injectThemeStyles() {
    if (!document.querySelector('#theme-button-styles')) {
        const style = document.createElement('style');
        style.id = 'theme-button-styles';
        style.textContent = `
            .theme-toggle button {
                transition: all 0.3s ease !important;
                border-radius: 50% !important;
                width: 40px !important;
                height: 40px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                background: var(--surface) !important;
                border: 1px solid var(--border) !important;
                font-size: 1.2em !important;
            }
            
            .theme-toggle button:hover {
                transform: scale(1.1) !important;
                background: var(--border-light) !important;
            }
            
            .theme-toggle button:active {
                transform: scale(0.95) !important;
            }
            
            @media (max-width: 768px) {
                .theme-toggle button {
                    width: 36px !important;
                    height: 36px !important;
                    font-size: 1.1em !important;
                }
            }
        `;
        document.head.appendChild(style);
        console.log('✅ Theme button styles injected');
    }
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
// FIXED USER PROFILE FUNCTIONS
// ===========================

async function loadUserProfile(uid) {
  console.log('👤 Loading user profile for:', uid);
  
  const user = auth.currentUser;
  
  // Try to get memberSince from localStorage first (persistent)
  let memberSince = localStorage.getItem('memberSince');
  if (!memberSince) {
    memberSince = new Date().toISOString();
    localStorage.setItem('memberSince', memberSince);
  }
  
  const fallbackProfile = {
    email: user?.email || '',
    createdAt: memberSince, // Use persistent member since date
    defaultRate: parseFloat(localStorage.getItem('userDefaultRate')) || 0,
    memberSince: memberSince
  };
  
  updateProfileButton(fallbackProfile);
  initializeDefaultRate(fallbackProfile.defaultRate);
  
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      currentUserData = { uid, ...userSnap.data() };
      
      // Ensure memberSince is preserved
      if (!currentUserData.memberSince) {
        currentUserData.memberSince = memberSince;
        // Update Firestore with memberSince
        await updateDoc(userRef, { memberSince: memberSince });
      }
      
      console.log('✅ User profile loaded from Firestore');
      
      updateProfileButton(currentUserData);
      
      if (currentUserData.defaultRate !== undefined) {
        initializeDefaultRate(currentUserData.defaultRate);
        localStorage.setItem('userDefaultRate', currentUserData.defaultRate.toString());
      }
      
      return currentUserData;
    } else {
      const profileToCreate = {
        ...fallbackProfile,
        lastLogin: new Date().toISOString(),
        memberSince: memberSince // Ensure it's set
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

function updateProfileModal() {
  const profileUserEmail = document.getElementById('profileUserEmail');
  const profileUserSince = document.getElementById('profileUserSince');
  const profileDefaultRate = document.getElementById('profileDefaultRate');
  const modalStatStudents = document.getElementById('modalStatStudents');
  const modalStatHours = document.getElementById('modalStatHours');
  const modalStatEarnings = document.getElementById('modalStatEarnings');
  const modalStatUpdated = document.getElementById('modalStatUpdated');

  if (currentUserData) {
    const email = currentUserData.email || auth.currentUser?.email || 'Not available';
    if (profileUserEmail) profileUserEmail.textContent = email;
    
    // FIX: Use persistent member since date
    const memberSince = currentUserData.memberSince || localStorage.getItem('memberSince') || currentUserData.createdAt || new Date().toISOString();
    if (profileUserSince) profileUserSince.textContent = formatDate(memberSince);
    
    if (profileDefaultRate) {
      profileDefaultRate.textContent = `$${fmtMoney(currentUserData.defaultRate || 0)}/hour`;
    }
  }

  // Calculate and display actual earnings
  calculateAndDisplayActualEarnings();

  const statStudents = document.getElementById('statStudents');
  const statHours = document.getElementById('statHours');
  const statUpdated = document.getElementById('statUpdated');

  if (modalStatStudents && statStudents) modalStatStudents.textContent = statStudents.textContent || '0';
  if (modalStatHours && statHours) modalStatHours.textContent = statHours.textContent || '0';
  if (modalStatUpdated && statUpdated) modalStatUpdated.textContent = statUpdated.textContent || 'Never';

  console.log('✅ Profile modal stats updated');
}

// Calculate actual earnings from hours data
async function calculateAndDisplayActualEarnings() {
  const modalStatEarnings = document.getElementById('modalStatEarnings');
  if (!modalStatEarnings) return;

  try {
    const hours = await EnhancedCache.loadCollection('hours');
    
    const totalEarnings = hours.reduce((sum, entry) => {
      return sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0));
    }, 0);

    modalStatEarnings.textContent = `$${fmtMoney(totalEarnings)}`;
    console.log('💰 Calculated actual earnings:', totalEarnings);

  } catch (error) {
    console.error('Error calculating earnings:', error);
    modalStatEarnings.textContent = '$0.00';
  }
}

// Helper function to get member since date
function getMemberSinceDate() {
  return localStorage.getItem('memberSince') || new Date().toISOString();
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
        const earnings = stats.earnings != null ? fmtMoney(stats.earnings) : "0.00";
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
      if (document.getElementById('statEarnings')) document.getElementById('statEarnings').textContent = "0.00";
    }

    refreshTimestamp();
    console.log('✅ User stats loaded successfully');
    
  } catch (err) {
    console.error("❌ Error loading stats:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Offline – stats unavailable";
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
    if (newStats.lastSync !== undefined) {
      const statUpdated = document.getElementById('statUpdated');
      if (statUpdated) statUpdated.textContent = newStats.lastSync;
    }

    updateHeaderStats();
    refreshTimestamp();
  } catch (err) {
    console.error("❌ Error updating stats:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to update stats";
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
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to recalc stats";
  }
}

// ===========================
// DATA RENDERING FUNCTIONS
// ===========================

// ===========================
// FIXED DATA RENDERING FUNCTIONS
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
      studentsHTML += `
        <div class="student-card">
          <div class="student-card-header">
            <div>
              <strong>${student.name || 'Unnamed Student'}</strong>
              <span class="student-id">${student.id}</span>
            </div>
            <div class="student-actions">
              <button class="btn-icon" onclick="editStudent('${student.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteStudent('${student.id}')" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="student-details">
            <div class="muted">${student.gender || 'Not specified'} • ${student.email || 'No email'} • ${student.phone || 'No phone'}</div>
            <div class="student-rate">Rate: $${fmtMoney(student.rate || 0)}/session</div>
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

async function renderRecentHours(limit = 10) {
  const container = document.getElementById('hoursContainer');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading recent hours...</div>';

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

    // Sort by date (newest first)
    const sortedHours = hours.sort((a, b) => {
      const dateA = new Date(a.date || a.dateIso);
      const dateB = new Date(b.date || b.dateIso);
      return dateB - dateA;
    });

    container.innerHTML = '';
    sortedHours.slice(0, limit).forEach(entry => {
      const item = document.createElement("div");
      item.className = "hours-entry";
      item.innerHTML = `
        <div class="hours-header">
          <strong>${entry.organization || 'No organization'}</strong>
          <span class="hours-type">${entry.workType || 'General'}</span>
          <div class="student-actions">
            <button class="btn-icon" onclick="editHours('${entry.id}')" title="Edit">✏️</button>
            <button class="btn-icon" onclick="deleteHours('${entry.id}')" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="muted">${formatDate(entry.date)} • ${entry.subject || 'General'}</div>
        <div class="hours-details">
          <span>Hours: ${safeNumber(entry.hours)}</span>
          <span>Rate: $${fmtMoney(entry.rate)}</span>
          <span class="hours-total">Total: $${fmtMoney(entry.total)}</span>
        </div>
        ${entry.student ? `<div class="muted">Student: ${entry.student}</div>` : ''}
      `;
      container.appendChild(item);
    });

  } catch (error) {
    console.error("Error rendering hours:", error);
    container.innerHTML = '<div class="error">Error loading hours</div>';
  }
}

async function renderRecentMarks(limit = 10) {
  const container = document.getElementById('marksContainer');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading recent marks...</div>';

  try {
    const marks = await EnhancedCache.loadCollection('marks');
    
    if (marks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Marks Recorded</h3>
          <p>Add your first mark to get started</p>
        </div>
      `;
      return;
    }

    // Sort by date (newest first) and enhance with student names
    const sortedMarks = marks.sort((a, b) => {
      const dateA = new Date(a.date || a.dateIso);
      const dateB = new Date(b.date || b.dateIso);
      return dateB - dateA;
    });

    // Get students for name lookup
    const students = await EnhancedCache.loadCollection('students');
    const studentMap = {};
    students.forEach(student => {
      studentMap[student.name || student.id] = student.name || `Student ${student.id}`;
    });

    container.innerHTML = '';
    sortedMarks.slice(0, limit).forEach(entry => {
      const studentName = studentMap[entry.student] || entry.student || 'Unknown Student';
      
      const item = document.createElement("div");
      item.className = "mark-entry";
      item.innerHTML = `
        <div class="mark-header">
          <strong>${studentName}</strong> — ${entry.subject || 'No Subject'} (${entry.topic || 'No Topic'})
          <div class="student-actions">
            <button class="btn-icon" onclick="editMark('${entry.id}')" title="Edit">✏️</button>
            <button class="btn-icon" onclick="deleteMark('${entry.id}')" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="muted">${formatDate(entry.date)}</div>
        <div>Score: ${safeNumber(entry.score)}/${safeNumber(entry.max)} — ${safeNumber(entry.percentage).toFixed(2)}% — Grade: ${entry.grade || 'N/A'}</div>
      `;
      container.appendChild(item);
    });

  } catch (error) {
    console.error("Error rendering marks:", error);
    container.innerHTML = '<div class="error">Error loading marks</div>';
  }
}

async function renderAttendanceRecent(limit = 10) {
  const container = document.getElementById('attendanceContainer');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading attendance records...</div>';

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

    // Sort by date (newest first)
    const sortedAttendance = attendance.sort((a, b) => {
      const dateA = new Date(a.date || a.dateIso);
      const dateB = new Date(b.date || b.dateIso);
      return dateB - dateA;
    });

    container.innerHTML = '';
    sortedAttendance.slice(0, limit).forEach(entry => {
      const presentCount = Array.isArray(entry.present) ? entry.present.length : 0;
      
      const item = document.createElement("div");
      item.className = "attendance-entry";
      item.innerHTML = `
        <div class="attendance-header">
          <strong>${entry.subject || 'No Subject'}</strong> — ${entry.topic || "—"}
          <div class="student-actions">
            <button class="btn-icon" onclick="editAttendance('${entry.id}')" title="Edit">✏️</button>
            <button class="btn-icon" onclick="deleteAttendance('${entry.id}')" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="muted">${formatDate(entry.date)}</div>
        <div>Present: ${presentCount} students</div>
      `;
      container.appendChild(item);
    });

  } catch (error) {
    console.error("Error rendering attendance:", error);
    container.innerHTML = '<div class="error">Error loading attendance</div>';
  }
}

// ===========================
// FORM SUBMIT HANDLERS
// ===========================

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
        createdAt: new Date().toISOString()
    };

    try {
        await EnhancedCache.saveWithBackgroundSync('students', studentData);
        FormAutoClear.handleSuccess('studentForm');
        EnhancedStats.forceRefresh();
        
        // Refresh student dropdowns after adding new student
        setTimeout(() => {
            populateStudentDropdowns();
        }, 500);
        
    } catch (error) {
        console.error('Error adding student:', error);
        NotificationSystem.notifyError('Failed to add student');
    }
}

async function handleHoursSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const formData = new FormData(e.target);
  const hours = safeNumber(formData.get('hours'));
  const rate = safeNumber(formData.get('rate'));
  const total = hours * rate;

  const hoursData = {
    organization: formData.get('organization'),
    workType: formData.get('workType'),
    subject: formData.get('subject'),
    student: formData.get('student'),
    hours: hours,
    rate: rate,
    total: total,
    date: formData.get('date'),
    dateIso: fmtDateISO(formData.get('date')),
    notes: formData.get('notes')
  };

  try {
    await EnhancedCache.saveWithBackgroundSync('hours', hoursData);
    FormAutoClear.handleSuccess('hoursForm', { baseRate: rate });
    EnhancedStats.forceRefresh();
  } catch (error) {
    console.error('Error adding hours:', error);
    NotificationSystem.notifyError('Failed to log hours');
  }
}

async function handleMarksSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const formData = new FormData(e.target);
  const score = safeNumber(formData.get('marksScore'));
  const max = safeNumber(formData.get('marksMax'));
  const percentage = max > 0 ? (score / max) * 100 : 0;

  const marksData = {
    student: formData.get('marksStudent'),
    subject: formData.get('marksSubject'),
    topic: formData.get('marksTopic'),
    score: score,
    max: max,
    percentage: percentage,
    grade: calculateGrade(percentage),
    date: formData.get('marksDate'),
    dateIso: fmtDateISO(formData.get('marksDate')),
    notes: formData.get('marksNotes')
  };

  try {
    await EnhancedCache.saveWithBackgroundSync('marks', marksData);
    FormAutoClear.handleSuccess('marksForm');
    EnhancedStats.forceRefresh();
  } catch (error) {
    console.error('Error adding marks:', error);
    NotificationSystem.notifyError('Failed to add marks');
  }
}

async function handleAttendanceSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const formData = new FormData(e.target);
  const presentStudents = formData.getAll('presentStudents');

  const attendanceData = {
    subject: formData.get('attendanceSubject'),
    topic: formData.get('attendanceTopic'),
    present: presentStudents,
    date: formData.get('attendanceDate'),
    dateIso: fmtDateISO(formData.get('attendanceDate')),
    notes: formData.get('attendanceNotes')
  };

  try {
    await EnhancedCache.saveWithBackgroundSync('attendance', attendanceData);
    FormAutoClear.handleSuccess('attendanceForm');
    EnhancedStats.forceRefresh();
  } catch (error) {
    console.error('Error recording attendance:', error);
    NotificationSystem.notifyError('Failed to record attendance');
  }
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
    await EnhancedCache.saveWithBackgroundSync('payments', paymentData);
    FormAutoClear.handleSuccess('paymentForm');
    EnhancedStats.forceRefresh();
  } catch (error) {
    console.error('Error recording payment:', error);
    NotificationSystem.notifyError('Failed to record payment');
  }
}

// ===========================
// FORM SETUP & BASE RATE FUNCTIONS
// ===========================

function calculateTotalPay() {
  const hours = safeNumber(document.getElementById('hours')?.value);
  const rate = safeNumber(document.getElementById('rate')?.value);
  const total = hours * rate;
  
  const totalPayElement = document.getElementById('totalPay');
  if (totalPayElement) {
    totalPayElement.textContent = `$${fmtMoney(total)}`;
  }
}

function setupFormHandlers() {
  console.log('🔧 Setting up form handlers...');
  
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
    
    const studentRateInput = document.getElementById('studentRate');
    const defaultBaseRateInput = document.getElementById('defaultBaseRate');
    
    if (studentRateInput && defaultBaseRateInput && !studentRateInput.value) {
      studentRateInput.value = defaultBaseRateInput.value || currentUserData?.defaultRate || '0';
    }
  }
  
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
    
    const baseRateInput = document.getElementById('rate');
    const defaultBaseRateInput = document.getElementById('defaultBaseRate');
    const hoursInput = document.getElementById('hours');
    
    if (baseRateInput && defaultBaseRateInput && !baseRateInput.value) {
      baseRateInput.value = defaultBaseRateInput.value || currentUserData?.defaultRate || '0';
    }
    
    if (hoursInput) hoursInput.addEventListener('input', calculateTotalPay);
    if (baseRateInput) baseRateInput.addEventListener('input', calculateTotalPay);
    
    calculateTotalPay();
  }
  
  const marksForm = document.getElementById('marksForm');
  if (marksForm) marksForm.addEventListener('submit', handleMarksSubmit);
  
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) attendanceForm.addEventListener('submit', handleAttendanceSubmit);
  
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) paymentForm.addEventListener('submit', handlePaymentSubmit);
  
  // Setup student dropdown population
  setupFormStudentPopulation();
  
  console.log('✅ All form handlers initialized');
}

function initializeDefaultRate(rate) {
  const baseRateInput = document.getElementById('baseRate');
  const studentRateInput = document.getElementById('studentRate');  
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  
  console.log('💰 Initializing default rate:', rate);
  
  if (baseRateInput && !baseRateInput.value) {
    baseRateInput.value = rate;
    calculateTotalPay();
  }
  
  if (studentRateInput && !studentRateInput.value) {
    studentRateInput.value = rate;
  }
  
  if (defaultBaseRateInput && !defaultBaseRateInput.value) {
    defaultBaseRateInput.value = rate;
  }
  
  const currentDefaultRateDisplay = document.getElementById('currentDefaultRateDisplay');
  if (currentDefaultRateDisplay) {
    currentDefaultRateDisplay.textContent = fmtMoney(rate);
  }
  
  const currentDefaultRate = document.getElementById('currentDefaultRate');
  if (currentDefaultRate) {
    currentDefaultRate.textContent = fmtMoney(rate);
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
    const success = await updateUserDefaultRate(user.uid, newRate);
    if (success) {
      NotificationSystem.notifySuccess(`Default rate saved: $${fmtMoney(newRate)}/session`);
      initializeDefaultRate(newRate);
    }
  } catch (error) {
    console.error('Error saving default rate:', error);
    NotificationSystem.notifyError('Failed to save default rate');
  }
}

async function applyDefaultRateToAll() {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to apply default rate');
    return;
  }
  
  if (confirm('Apply the default rate to ALL existing students? This cannot be undone.')) {
    const defaultBaseRateInput = document.getElementById('defaultBaseRate');
    const newRate = defaultBaseRateInput ? safeNumber(defaultBaseRateInput.value) : currentUserData?.defaultRate || 0;
    
    if (newRate > 0) {
      await applyDefaultRateToAllStudents(user.uid, newRate);
    } else {
      NotificationSystem.notifyError('Please set a valid default rate first');
    }
  }
}

function useDefaultRate() {
  const studentRateInput = document.getElementById('studentRate');
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  
  if (studentRateInput && defaultBaseRateInput) {
    studentRateInput.value = defaultBaseRateInput.value;
    NotificationSystem.notifyInfo('Default rate applied to student form');
  }
}

function useDefaultRateInHours() {
  const baseRateInput = document.getElementById('rate');
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  
  if (baseRateInput && defaultBaseRateInput) {
    baseRateInput.value = defaultBaseRateInput.value;
    NotificationSystem.notifyInfo('Default rate applied to hours form');
    calculateTotalPay();
  }
}

// ===========================
// FIXED STUDENT DROPDOWN POPULATION
// ===========================

async function populateStudentDropdowns() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // Load students with caching
        const students = await EnhancedCache.loadCollection('students');
        console.log('📝 Students for dropdowns:', students.length);

        // Get all student dropdowns
        const studentDropdowns = [
            document.getElementById('student'), // Hours form
            document.getElementById('marksStudent'), // Marks form
            document.getElementById('paymentStudent'), // Payments form
            document.querySelector('select[name="student"]'),
            document.querySelector('select[name="marksStudent"]'),
            document.querySelector('select[name="paymentStudent"]')
        ].filter(Boolean);

        console.log('🎯 Found student dropdowns to populate:', studentDropdowns.length);

        studentDropdowns.forEach(dropdown => {
            // Clear existing options except the first one
            while (dropdown.options.length > 1) {
                dropdown.remove(1);
            }

            // Add students to dropdown
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.name || student.id;
                option.textContent = student.name || `Student ${student.id}`;
                option.setAttribute('data-student-id', student.id);
                dropdown.appendChild(option);
            });

            console.log(`✅ Populated dropdown ${dropdown.id || dropdown.name} with ${students.length} students`);
        });

        populateAttendanceStudents(students);

    } catch (error) {
        console.error('❌ Error populating student dropdowns:', error);
    }
}

function populateAttendanceStudents(students) {
    const attendanceContainer = document.getElementById('attendanceStudents');
    if (!attendanceContainer) {
        console.log('❌ Attendance container not found');
        return;
    }

    attendanceContainer.innerHTML = '';

    if (students.length === 0) {
        attendanceContainer.innerHTML = '<div class="muted">No students available. Add students first.</div>';
        return;
    }

    students.forEach(student => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 8px; margin: 5px 0;';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'presentStudents';
        checkbox.value = student.name || student.id;
        
        const span = document.createElement('span');
        span.textContent = student.name || `Student ${student.id}`;
        
        label.appendChild(checkbox);
        label.appendChild(span);
        attendanceContainer.appendChild(label);
    });

    console.log('✅ Populated attendance with', students.length, 'students');
}

// ===========================
// EDIT & DELETE FUNCTIONS
// ===========================

async function editStudent(id) {
  NotificationSystem.notifyInfo(`Edit student ${id} - Feature coming soon`);
}

async function deleteStudent(id) {
  if (confirm('Are you sure you want to delete this student?')) {
    NotificationSystem.notifyInfo(`Delete student ${id} - Feature coming soon`);
  }
}

async function editHours(id) {
  NotificationSystem.notifyInfo(`Edit hours ${id} - Feature coming soon`);
}

async function deleteHours(id) {
  if (confirm('Are you sure you want to delete this hours entry?')) {
    NotificationSystem.notifyInfo(`Delete hours ${id} - Feature coming soon`);
  }
}

async function editMark(id) {
  NotificationSystem.notifyInfo(`Edit mark ${id} - Feature coming soon`);
}

async function deleteMark(id) {
  if (confirm('Are you sure you want to delete this mark?')) {
    NotificationSystem.notifyInfo(`Delete mark ${id} - Feature coming soon`);
  }
}

async function editAttendance(id) {
  NotificationSystem.notifyInfo(`Edit attendance ${id} - Feature coming soon`);
}

async function deleteAttendance(id) {
  if (confirm('Are you sure you want to delete this attendance record?')) {
    NotificationSystem.notifyInfo(`Delete attendance ${id} - Feature coming soon`);
  }
}

async function editPayment(id) {
  NotificationSystem.notifyInfo(`Edit payment ${id} - Feature coming soon`);
}

async function deletePayment(id) {
  if (confirm('Are you sure you want to delete this payment?')) {
    NotificationSystem.notifyInfo(`Delete payment ${id} - Feature coming soon`);
  }
}

// ===========================
// TAB NAVIGATION SYSTEM
// ===========================

function setupTabNavigation() {
  console.log('🔧 Setting up tab navigation...');
  
  // Inject CSS that matches your HTML structure
  injectTabCSS();
  
  // Find tab buttons
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
  
  // Set initial tab
  const initialTab = getInitialTab();
  console.log(`📑 Initial tab: ${initialTab}`);
  setTimeout(() => switchTab(initialTab), 100);
}

function injectTabCSS() {
  if (!document.querySelector('#tab-css-fixed')) {
    const style = document.createElement('style');
    style.id = 'tab-css-fixed';
    style.textContent = `
      /* Hide ALL tabcontent by default */
      .tabcontent {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
      
      /* Show only active tabcontent */
      .tabcontent.active {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        overflow: visible !important;
      }
      
      /* Tab button styles */
      .tab.active {
        background: var(--primary) !important;
        color: white !important;
      }
    `;
    document.head.appendChild(style);
    console.log('✅ Tab CSS injected for your HTML structure');
  }
}

function getInitialTab() {
  // Check URL hash
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) return hash;
  
  // Check for active tab
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) return activeTab.getAttribute('data-tab');
  
  // Default to students (since it's first in your HTML)
  return 'students';
}

function switchTab(tabName) {
  console.log(`🔄 Switching to: ${tabName}`);
  
  if (!tabName) {
    console.error('❌ No tab name provided');
    return;
  }
  
  // Update URL
  window.location.hash = tabName;
  
  // 1. Update buttons - remove active from all
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active to clicked tab button
  const activeButtons = document.querySelectorAll(`.tab[data-tab="${tabName}"]`);
  activeButtons.forEach(btn => {
    btn.classList.add('active');
  });
  
  // 2. Hide ALL tab content
  const allTabContents = document.querySelectorAll('.tabcontent');
  console.log(`📊 Hiding ${allTabContents.length} tabcontent elements`);
  
  allTabContents.forEach(content => {
    content.classList.remove('active');
    // Apply multiple hiding methods
    content.style.display = 'none';
    content.style.visibility = 'hidden';
    content.style.opacity = '0';
    content.style.height = '0';
    content.style.overflow = 'hidden';
  });
  
  // 3. Show ONLY the target tab
  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.classList.add('active');
    // Apply multiple showing methods
    targetTab.style.display = 'block';
    targetTab.style.visibility = 'visible';
    targetTab.style.opacity = '1';
    targetTab.style.height = 'auto';
    targetTab.style.overflow = 'visible';
    
    console.log(`✅ Successfully showing: ${tabName}`);
  } else {
    console.error(`❌ Tab content not found: ${tabName}`);
  }
  
  // Debug what's visible
  setTimeout(debugTabState, 50);
}

function debugTabState() {
  console.log('🔍 TAB DEBUG:');
  const tabs = ['students', 'hours', 'marks', 'attendance', 'payments', 'reports'];
  
  tabs.forEach(tabId => {
    const element = document.getElementById(tabId);
    if (element) {
      const computed = window.getComputedStyle(element);
      console.log(`${tabId}:`, {
        active: element.classList.contains('active'),
        display: computed.display,
        visibility: computed.visibility
      });
    }
  });
}

// ===========================
// REPORT FUNCTIONS
// ===========================

function showWeeklyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current week
  const today = new Date();
  const startDate = getStartOfWeek(today);
  const endDate = getEndOfWeek(today);
  
  generateWeeklyReport(startDate, endDate);
  
  // Add option to choose different week
  setTimeout(() => {
    if (confirm('Would you like to generate a report for a different week?')) {
      const modal = createDateSelectionModal('weekly', (selectedDate) => {
        const customStartDate = getStartOfWeek(selectedDate);
        const customEndDate = getEndOfWeek(selectedDate);
        
        generateWeeklyReport(customStartDate, customEndDate);
      });
      
      document.body.appendChild(modal);
    }
  }, 1000);
}

function showBiWeeklyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current bi-weekly period (last 2 weeks)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 13); // Last 14 days (2 weeks)
  
  generateBiWeeklyReport(startDate, endDate);
  
  // Add option to choose different period
  setTimeout(() => {
    if (confirm('Would you like to generate a report for a different 2-week period?')) {
      const modal = createDateRangeModal('bi-weekly', (customStartDate, customEndDate) => {
        generateBiWeeklyReport(customStartDate, customEndDate);
      });
      
      document.body.appendChild(modal);
    }
  }, 1000);
}

function showMonthlyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current month
  const today = new Date();
  const startDate = getStartOfMonth(today);
  const endDate = getEndOfMonth(today);
  
  generateMonthlyReport(startDate, endDate);
  
  // Add option to choose different month
  setTimeout(() => {
    if (confirm('Would you like to generate a report for a different month?')) {
      const modal = createDateSelectionModal('monthly', (selectedDate) => {
        const customStartDate = getStartOfMonth(selectedDate);
        const customEndDate = getEndOfMonth(selectedDate);
        
        generateMonthlyReport(customStartDate, customEndDate);
      }, true); // true for month selection
      
      document.body.appendChild(modal);
    }
  }, 1000);
}

function showSubjectBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current month
  const today = new Date();
  const startDate = getStartOfMonth(today);
  const endDate = getEndOfMonth(today);
  
  generateSubjectReport(startDate, endDate);
  
  // Add option to choose custom range
  setTimeout(() => {
    if (confirm('Would you like to generate a report for a different period?')) {
      const modal = createDateRangeModal('subject', (customStartDate, customEndDate) => {
        generateSubjectReport(customStartDate, customEndDate);
      });
      
      document.body.appendChild(modal);
    }
  }, 1000);
}

// TIMEZONE-SAFE DATE FUNCTIONS
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfWeek(date) {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getStartOfMonth(date) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfMonth(date) {
  const d = new Date(date);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return end;
}

// TIMEZONE-SAFE DATE COMPARISON
function isDateInRange(entryDate, startDate, endDate) {
  // Convert all dates to start of day in local timezone for comparison
  const entry = new Date(entryDate);
  const entryLocal = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate());
  
  const start = new Date(startDate);
  const startLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  
  const end = new Date(endDate);
  const endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  return entryLocal >= startLocal && entryLocal <= endLocal;
}

function formatDateForDisplay(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

function formatDateShort(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

// Date Selection Modal
function createDateSelectionModal(reportType, onConfirm, showMonthPicker = false) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); display: flex; align-items: center; 
    justify-content: center; z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.style.cssText = `
    background: var(--surface); padding: 20px; border-radius: 12px; 
    min-width: 300px; max-width: 90vw; max-height: 90vh; overflow-y: auto;
  `;
  
  const title = document.createElement('h3');
  title.textContent = `Select ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Period`;
  
  const dateInput = document.createElement('input');
  dateInput.type = showMonthPicker ? 'month' : 'date';
  
  // Fix: Set correct default value for month picker
  if (showMonthPicker) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    dateInput.value = `${year}-${month}`;
  } else {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  
  dateInput.style.cssText = `
    width: 100%; padding: 10px; margin: 10px 0; border: 1px solid var(--border);
    border-radius: 6px; background: var(--background); color: var(--text);
  `;
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 15px;';
  
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Generate Report';
  confirmBtn.style.cssText = `
    flex: 1; padding: 10px; background: var(--primary); color: white;
    border: none; border-radius: 6px; cursor: pointer;
  `;
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    flex: 1; padding: 10px; background: var(--border); color: var(--text);
    border: none; border-radius: 6px; cursor: pointer;
  `;
  
  confirmBtn.onclick = () => {
    let selectedDate;
    if (showMonthPicker) {
      // Fix: Properly handle month selection - use the 1st of the month
      const [year, month] = dateInput.value.split('-');
      selectedDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    } else {
      selectedDate = new Date(dateInput.value);
    }
    onConfirm(selectedDate);
    document.body.removeChild(modal);
  };
  
  cancelBtn.onclick = () => {
    document.body.removeChild(modal);
  };
  
  modalContent.appendChild(title);
  modalContent.appendChild(dateInput);
  buttonContainer.appendChild(confirmBtn);
  buttonContainer.appendChild(cancelBtn);
  modalContent.appendChild(buttonContainer);
  modal.appendChild(modalContent);
  
  // Close modal when clicking outside
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };
  
  return modal;
}

// Date Range Modal for custom periods
function createDateRangeModal(reportType, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); display: flex; align-items: center; 
    justify-content: center; z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--surface); padding: 20px; border-radius: 12px; 
    min-width: 300px; max-width: 90vw;
  `;
  
  const title = document.createElement('h3');
  title.textContent = `Select Date Range for ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
  
  const startDateInput = document.createElement('input');
  startDateInput.type = 'date';
  startDateInput.placeholder = 'Start Date';
  startDateInput.style.cssText = `
    width: 100%; padding: 10px; margin: 5px 0; border: 1px solid var(--border);
    border-radius: 6px; background: var(--background); color: var(--text);
  `;
  
  const endDateInput = document.createElement('input');
  endDateInput.type = 'date';
  endDateInput.placeholder = 'End Date';
  endDateInput.value = new Date().toISOString().split('T')[0];
  endDateInput.style.cssText = startDateInput.style.cssText;
  
  // Set start date to first day of current month by default
  const firstDay = getStartOfMonth(new Date());
  startDateInput.value = firstDay.toISOString().split('T')[0];
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 15px;';
  
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Generate Report';
  confirmBtn.style.cssText = `
    flex: 1; padding: 10px; background: var(--primary); color: white;
    border: none; border-radius: 6px; cursor: pointer;
  `;
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    flex: 1; padding: 10px; background: var(--border); color: var(--text);
    border: none; border-radius: 6px; cursor: pointer;
  `;
  
  confirmBtn.onclick = () => {
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    
    if (startDate > endDate) {
      NotificationSystem.notifyError('Start date cannot be after end date');
      return;
    }
    
    onConfirm(startDate, endDate);
    document.body.removeChild(modal);
  };
  
  cancelBtn.onclick = () => {
    document.body.removeChild(modal);
  };
  
  modalContent.appendChild(title);
  modalContent.appendChild(createLabel('Start Date:'));
  modalContent.appendChild(startDateInput);
  modalContent.appendChild(createLabel('End Date:'));
  modalContent.appendChild(endDateInput);
  buttonContainer.appendChild(confirmBtn);
  buttonContainer.appendChild(cancelBtn);
  modalContent.appendChild(buttonContainer);
  modal.appendChild(modalContent);
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };
  
  return modal;
}

function createLabel(text) {
  const label = document.createElement('div');
  label.textContent = text;
  label.style.cssText = 'margin-top: 10px; font-weight: bold; color: var(--text);';
  return label;
}

// Report Generation Functions with Timezone Fixes
function generateWeeklyReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    
    console.log('🔍 Weekly Report - Looking for data between:', formatDateForDisplay(startDate), 'and', formatDateForDisplay(endDate));
    console.log('📊 Total hours in cache:', hours.length);
    
    const weeklyData = hours.filter(entry => {
      if (!entry.date && !entry.dateIso) return false;
      
      const entryDate = entry.date || entry.dateIso;
      return isDateInRange(entryDate, startDate, endDate);
    });

    console.log('✅ Found entries for weekly report:', weeklyData.length);
    weeklyData.forEach(entry => {
      console.log('  -', entry.date || entry.dateIso, entry.hours, 'hours');
    });

    if (weeklyData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for week of ${formatDateForDisplay(startDate)}`);
      return;
    }

    const weeklyHours = weeklyData.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const weeklyTotal = weeklyData.reduce((sum, entry) => sum + (entry.total || 0), 0);
    
    const byDay = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayKey = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      byDay[dayKey] = 0;
    }
    
    weeklyData.forEach(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      const dayKey = entryDate.toLocaleDateString('en-US', { 
        weekday: 'short', month: 'short', day: 'numeric' 
      });
      byDay[dayKey] = (byDay[dayKey] || 0) + (entry.hours || 0);
    });

    let breakdown = `Weekly Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
    breakdown += `Total Hours: ${weeklyHours.toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(weeklyTotal)}\n`;
    if (weeklyHours > 0) {
      breakdown += `Average Rate: $${fmtMoney(weeklyTotal / weeklyHours)}/hour\n`;
    }
    breakdown += '\nDaily Breakdown:\n';
    
    Object.entries(byDay).forEach(([day, hours]) => {
      breakdown += `${day}: ${hours.toFixed(1)} hours\n`;
    });

    showReportModal('Weekly Breakdown', breakdown);

  } catch (error) {
    console.error('Error generating weekly breakdown:', error);
    NotificationSystem.notifyError('Failed to generate weekly report');
  }
}

function generateBiWeeklyReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    
    console.log('🔍 Bi-Weekly Report - Looking for data between:', formatDateForDisplay(startDate), 'and', formatDateForDisplay(endDate));
    
    const biWeeklyData = hours.filter(entry => {
      if (!entry.date && !entry.dateIso) return false;
      
      const entryDate = entry.date || entry.dateIso;
      return isDateInRange(entryDate, startDate, endDate);
    });

    console.log('✅ Found entries for bi-weekly report:', biWeeklyData.length);

    if (biWeeklyData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for period ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`);
      return;
    }

    const totalHours = biWeeklyData.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const totalEarnings = biWeeklyData.reduce((sum, entry) => sum + (entry.total || 0), 0);
    
    const byWeek = {};
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(currentDate.getDate() + 6);
      const actualWeekEnd = weekEnd > endDate ? endDate : weekEnd;
      const weekKey = `Week of ${formatDateShort(currentDate)}`;
      
      const weekData = biWeeklyData.filter(entry => {
        if (!entry.date && !entry.dateIso) return false;
        const entryDate = entry.date || entry.dateIso;
        return isDateInRange(entryDate, currentDate, actualWeekEnd);
      });
      
      byWeek[weekKey] = {
        hours: weekData.reduce((sum, entry) => sum + (entry.hours || 0), 0),
        earnings: weekData.reduce((sum, entry) => sum + (entry.total || 0), 0),
        sessions: weekData.length
      };
      
      currentDate.setDate(currentDate.getDate() + 7);
    }

    let breakdown = `Bi-Weekly Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
    breakdown += `Total Hours: ${totalHours.toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(totalEarnings)}\n`;
    if (totalHours > 0) {
      breakdown += `Average Rate: $${fmtMoney(totalEarnings / totalHours)}/hour\n`;
    }
    breakdown += '\nWeekly Breakdown:\n';
    
    Object.entries(byWeek).forEach(([week, data]) => {
      breakdown += `${week}: ${data.hours.toFixed(1)} hours (${data.sessions} sessions) - $${fmtMoney(data.earnings)}\n`;
    });

    showReportModal('Bi-Weekly Breakdown', breakdown);

  } catch (error) {
    console.error('Error generating bi-weekly breakdown:', error);
    NotificationSystem.notifyError('Failed to generate bi-weekly report');
  }
}

function generateMonthlyReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    
    console.log('🔍 Monthly Report - Looking for data between:', formatDateForDisplay(startDate), 'and', formatDateForDisplay(endDate));
    
    const monthlyData = hours.filter(entry => {
      if (!entry.date && !entry.dateIso) return false;
      
      const entryDate = entry.date || entry.dateIso;
      return isDateInRange(entryDate, startDate, endDate);
    });

    console.log('✅ Found entries for monthly report:', monthlyData.length);
    monthlyData.forEach(entry => {
      console.log('  -', entry.date || entry.dateIso, entry.hours, 'hours -', entry.student);
    });

    if (monthlyData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for ${formatDateForDisplay(startDate)}`);
      return;
    }

    const monthlyHours = monthlyData.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const monthlyTotal = monthlyData.reduce((sum, entry) => sum + (entry.total || 0), 0);
    
    const byStudent = {};
    const byWorkType = {};
    const byWeek = {};
    
    monthlyData.forEach(entry => {
      // By student
      const student = entry.student || 'Unknown Student';
      if (!byStudent[student]) {
        byStudent[student] = { hours: 0, total: 0, sessions: 0 };
      }
      byStudent[student].hours += entry.hours || 0;
      byStudent[student].total += entry.total || 0;
      byStudent[student].sessions += 1;
      
      // By work type
      const workType = entry.workType || 'General';
      byWorkType[workType] = (byWorkType[workType] || 0) + (entry.hours || 0);
      
      // By week
      const entryDate = new Date(entry.date || entry.dateIso);
      const weekStart = getStartOfWeek(entryDate);
      const weekKey = `Week ${getWeekNumber(entryDate)} (${formatDateShort(weekStart)})`;
      byWeek[weekKey] = (byWeek[weekKey] || 0) + (entry.hours || 0);
    });

    let breakdown = `Monthly Breakdown (${formatDateForDisplay(startDate)}):\n\n`;
    breakdown += `Total Hours: ${monthlyHours.toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(monthlyTotal)}\n`;
    if (monthlyHours > 0) {
      breakdown += `Average Rate: $${fmtMoney(monthlyTotal / monthlyHours)}/hour\n`;
    }
    breakdown += '\nBy Student:\n';
    Object.entries(byStudent)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([student, data]) => {
        breakdown += `• ${student}: ${data.hours.toFixed(1)} hours (${data.sessions} sessions) - $${fmtMoney(data.total)}\n`;
      });

    breakdown += '\nBy Work Type:\n';
    Object.entries(byWorkType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([workType, hours]) => {
        breakdown += `• ${workType}: ${hours.toFixed(1)} hours\n`;
      });

    breakdown += '\nBy Week:\n';
    Object.entries(byWeek)
      .forEach(([week, hours]) => {
        breakdown += `• ${week}: ${hours.toFixed(1)} hours\n`;
      });

    showReportModal('Monthly Breakdown', breakdown);

  } catch (error) {
    console.error('Error generating monthly breakdown:', error);
    NotificationSystem.notifyError('Failed to generate monthly report');
  }
}

function generateSubjectReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    
    console.log('🔍 Subject Report - Looking for data between:', formatDateForDisplay(startDate), 'and', formatDateForDisplay(endDate));
    
    const periodData = hours.filter(entry => {
      if (!entry.date && !entry.dateIso) return false;
      
      const entryDate = entry.date || entry.dateIso;
      return isDateInRange(entryDate, startDate, endDate);
    });

    console.log('✅ Found entries for subject report:', periodData.length);

    if (periodData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for selected period`);
      return;
    }

    const bySubject = {};
    const byOrganization = {};
    const byStudent = {};
    
    periodData.forEach(entry => {
      // By subject
      const subject = entry.subject || 'General';
      if (!bySubject[subject]) {
        bySubject[subject] = { hours: 0, total: 0, sessions: 0, students: new Set() };
      }
      bySubject[subject].hours += entry.hours || 0;
      bySubject[subject].total += entry.total || 0;
      bySubject[subject].sessions += 1;
      if (entry.student) {
        bySubject[subject].students.add(entry.student);
      }
      
      // By organization
      const org = entry.organization || 'Unknown Organization';
      byOrganization[org] = (byOrganization[org] || 0) + (entry.hours || 0);
      
      // By student
      const student = entry.student || 'Unknown Student';
      byStudent[student] = (byStudent[student] || 0) + (entry.hours || 0);
    });

    let breakdown = `Subject Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
    breakdown += `Total Hours: ${periodData.reduce((sum, entry) => sum + (entry.hours || 0), 0).toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(periodData.reduce((sum, entry) => sum + (entry.total || 0), 0))}\n`;
    if (periodData.reduce((sum, entry) => sum + (entry.hours || 0), 0) > 0) {
      breakdown += `Average Rate: $${fmtMoney(periodData.reduce((sum, entry) => sum + (entry.total || 0), 0) / periodData.reduce((sum, entry) => sum + (entry.hours || 0), 0))}/hour\n`;
    }
    breakdown += '\nBy Subject:\n';
    Object.entries(bySubject)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([subject, data]) => {
        breakdown += `• ${subject}: ${data.hours.toFixed(1)} hours (${data.sessions} sessions) - $${fmtMoney(data.total)}\n`;
        if (data.students.size > 0) {
          breakdown += `  Students: ${Array.from(data.students).join(', ')}\n`;
        }
        breakdown += '\n';
      });

    breakdown += 'By Organization:\n';
    Object.entries(byOrganization)
      .sort((a, b) => b[1] - a[1])
      .forEach(([org, hours]) => {
        breakdown += `• ${org}: ${hours.toFixed(1)} hours\n`;
      });

    breakdown += '\nBy Student:\n';
    Object.entries(byStudent)
      .sort((a, b) => b[1] - a[1])
      .forEach(([student, hours]) => {
        breakdown += `• ${student}: ${hours.toFixed(1)} hours\n`;
      });

    showReportModal('Subject Breakdown', breakdown);

  } catch (error) {
    console.error('Error generating subject breakdown:', error);
    NotificationSystem.notifyError('Failed to generate subject report');
  }
}

function showReportModal(title, content) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); display: flex; align-items: center; 
    justify-content: center; z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--surface); padding: 20px; border-radius: 12px; 
    min-width: 300px; max-width: 80vw; max-height: 80vh; overflow-y: auto;
    white-space: pre-line; font-family: monospace; line-height: 1.4;
  `;
  
  const modalTitle = document.createElement('h3');
  modalTitle.textContent = title;
  modalTitle.style.cssText = 'margin-bottom: 15px; color: var(--text);';
  
  const reportContent = document.createElement('div');
  reportContent.textContent = content;
  reportContent.style.cssText = 'margin-bottom: 15px;';
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    padding: 10px 20px; background: var(--primary); color: white;
    border: none; border-radius: 6px; cursor: pointer; float: right;
  `;
  
  closeBtn.onclick = () => {
    document.body.removeChild(modal);
  };
  
  modalContent.appendChild(modalTitle);
  modalContent.appendChild(reportContent);
  modalContent.appendChild(closeBtn);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// ===========================
// ENHANCED APP INITIALIZATION
// ===========================

// Start the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🏠 DOM fully loaded, starting app...');
  
  // IMMEDIATELY hide all tab content before anything else
  const allTabContents = document.querySelectorAll('.tabcontent');
  allTabContents.forEach(content => {
    content.style.display = 'none';
    content.style.visibility = 'hidden';
  });
  
  // Initialize core systems in correct order
  injectThemeStyles();
  initializeTheme();
  NotificationSystem.initNotificationStyles();
  EnhancedCache.loadCachedData();
  EnhancedStats.init();
  
  // Setup tab navigation with a small delay to ensure DOM is ready
  setTimeout(() => {
    setupTabNavigation();
  }, 100);
  
  // Wait for authentication
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('👤 User authenticated:', user.email);
      try {
        // Initialize member since date if not set
        if (!localStorage.getItem('memberSince')) {
          localStorage.setItem('memberSince', new Date().toISOString());
        }

        // Load all data in parallel with proper caching
        await Promise.all([
          loadUserProfile(user.uid),
          EnhancedCache.loadCollection('students', true), // Force refresh on app start
          EnhancedCache.loadCollection('hours', true),
          EnhancedCache.loadCollection('marks', true),
          EnhancedCache.loadCollection('attendance', true),
          EnhancedCache.loadCollection('payments', true)
        ]);
        
        // Initialize systems that depend on user data
        SyncBar.init();
        setupProfileModal();
        setupFloatingAddButton();
        updateHeaderStats();
        
        // Setup form handlers and populate student dropdowns
        setupFormHandlers();
        await populateStudentDropdowns(); // Ensure dropdowns are populated
        
        // Render all data
        await Promise.all([
          renderStudents(),
          renderRecentHours(),
          renderRecentMarks(),
          renderAttendanceRecent(),
          renderPaymentActivity(),
          renderStudentBalances(),
          renderOverviewReports()
        ]);

        NotificationSystem.notifySuccess(`Welcome back, ${user.email.split('@')[0]}!`);
        console.log('✅ Worklog App initialized successfully with cached data');
      } catch (error) {
        console.error('❌ Error during user login:', error);
        NotificationSystem.notifyError('Error loading user data');
      }
    } else {
      console.log('👤 No user, redirecting to auth...');
      window.location.href = "auth.html";
    }
  });
});

// ===========================
// EXPORT FUNCTIONS TO WINDOW
// ===========================

window.showWeeklyBreakdown = showWeeklyBreakdown;
window.showBiWeeklyBreakdown = showBiWeeklyBreakdown;
window.showMonthlyBreakdown = showMonthlyBreakdown;
window.showSubjectBreakdown = showSubjectBreakdown;
window.saveDefaultRate = saveDefaultRate;
window.applyDefaultRateToAll = applyDefaultRateToAll;
window.useDefaultRate = useDefaultRate;
window.useDefaultRateInHours = useDefaultRateInHours;
window.editStudent = editStudent;
window.deleteStudent = deleteStudent;
window.editHours = editHours;
window.deleteHours = deleteHours;
window.editMark = editMark;
window.deleteMark = deleteMark;
window.editAttendance = editAttendance;
window.deleteAttendance = deleteAttendance;
window.editPayment = editPayment;
window.deletePayment = deletePayment;
window.NotificationSystem = NotificationSystem;
window.switchTab = switchTab;
