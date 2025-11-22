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
// ENHANCED REAL-TIME STATS SYSTEM - UPDATED
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
      // Ensure we have fresh data
      const students = await EnhancedCache.loadCollection('students');
      const studentCount = students.length;
      
      let averageRate = 0;
      if (studentCount > 0) {
        const totalRate = students.reduce((sum, student) => {
          const rate = student.rate || student.studentRate || 0;
          return sum + safeNumber(rate);
        }, 0);
        averageRate = totalRate / studentCount;
      }
      
      console.log(`📊 Student stats: ${studentCount} students, avg rate: $${fmtMoney(averageRate)}`);
      
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
      // Ensure we have fresh data
      const hours = await EnhancedCache.loadCollection('hours');
      console.log(`📊 Calculating hours stats from ${hours.length} entries`);
      
      const now = new Date();
      const today = getLocalDateString(now);
      
      // Get start of current week (Sunday)
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      // Get start of current month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Use fixed date comparison function
      const weeklyData = hours.filter(entry => {
        const entryDate = entry.date || entry.dateIso;
        return isDateInRange(entryDate, weekStart, now);
      });
      
      const monthlyData = hours.filter(entry => {
        const entryDate = entry.date || entry.dateIso;
        return isDateInRange(entryDate, monthStart, now);
      });
      
      const weeklyHours = weeklyData.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
      const weeklyTotal = weeklyData.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
      
      const monthlyHours = monthlyData.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
      const monthlyTotal = monthlyData.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
      
      console.log('📈 Hours stats:', {
        weekly: { hours: weeklyHours, total: weeklyTotal, entries: weeklyData.length },
        monthly: { hours: monthlyHours, total: monthlyTotal, entries: monthlyData.length },
        total: hours.length
      });
      
      this.updateElement('weeklyHours', weeklyHours.toFixed(1));
      this.updateElement('weeklyTotal', fmtMoney(weeklyTotal));
      this.updateElement('monthlyHours', monthlyHours.toFixed(1));
      this.updateElement('monthlyTotal', fmtMoney(monthlyTotal));
      
      const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
      const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
      
      this.updateElement('totalHoursReport', totalHours.toFixed(1));
      this.updateElement('totalEarningsReport', `$${fmtMoney(totalEarnings)}`);
    } catch (error) {
      console.error('Error calculating hours stats:', error);
    }
  },

  async calculateMarksStats() {
    try {
      // Ensure we have fresh data
      const marks = await EnhancedCache.loadCollection('marks');
      const marksCount = marks.length;
      
      let avgPercentage = 0;
      if (marksCount > 0) {
        const totalPercentage = marks.reduce((sum, mark) => sum + safeNumber(mark.percentage), 0);
        avgPercentage = totalPercentage / marksCount;
      }
      
      console.log(`📊 Marks stats: ${marksCount} marks, avg: ${avgPercentage.toFixed(1)}%`);
      
      this.updateElement('marksCount', marksCount);
      this.updateElement('avgMarks', avgPercentage.toFixed(1));
      this.updateElement('avgMarkReport', `${avgPercentage.toFixed(1)}%`);
    } catch (error) {
      console.error('Error calculating marks stats:', error);
    }
  },

  async calculateAttendanceStats() {
    try {
      // Ensure we have fresh data
      const attendance = await EnhancedCache.loadCollection('attendance');
      const attendanceCount = attendance.length;
      
      let lastSession = null;
      let lastSessionDate = null;
      
      if (attendanceCount > 0) {
        // Sort by date to find the most recent
        const sortedAttendance = attendance.sort((a, b) => {
          const dateA = new Date(a.date || a.dateIso);
          const dateB = new Date(b.date || b.dateIso);
          return dateB - dateA;
        });
        
        lastSession = sortedAttendance[0];
        lastSessionDate = lastSession.date || lastSession.dateIso;
      }
      
      console.log(`📊 Attendance stats: ${attendanceCount} sessions, last: ${lastSessionDate}`);
      
      this.updateElement('attendanceCount', attendanceCount);
      this.updateElement('lastSessionDate', lastSession ? formatDate(lastSessionDate) : 'Never');
    } catch (error) {
      console.error('Error calculating attendance stats:', error);
    }
  },

  async calculatePaymentStats() {
    try {
      // Ensure we have fresh data
      const payments = await EnhancedCache.loadCollection('payments');
      const now = new Date();
      
      // Get current month in YYYY-MM format for comparison
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const monthlyPayments = payments
        .filter(payment => {
          const paymentDate = payment.date || '';
          return paymentDate.startsWith(currentMonth);
        })
        .reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
      
      const totalPayments = payments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
      
      console.log(`📊 Payment stats: monthly $${fmtMoney(monthlyPayments)}, total $${fmtMoney(totalPayments)}`);
      
      this.updateElement('monthlyPayments', `$${fmtMoney(monthlyPayments)}`);
      this.updateElement('totalPaymentsReport', `$${fmtMoney(totalPayments)}`);
      
      await this.calculateOutstandingBalance();
    } catch (error) {
      console.error('Error calculating payment stats:', error);
    }
  },

  async calculateOutstandingBalance() {
    try {
      // Ensure we have fresh data
      const [students, hours, payments] = await Promise.all([
        EnhancedCache.loadCollection('students'),
        EnhancedCache.loadCollection('hours'),
        EnhancedCache.loadCollection('payments')
      ]);
      
      const earningsByStudent = {};
      hours.forEach(entry => {
        const studentName = entry.student;
        if (studentName) {
          const earnings = entry.total || (entry.hours || 0) * (entry.rate || 0);
          earningsByStudent[studentName] = (earningsByStudent[studentName] || 0) + safeNumber(earnings);
        }
      });
      
      const paymentsByStudent = {};
      payments.forEach(payment => {
        const studentName = payment.student;
        if (studentName) {
          paymentsByStudent[studentName] = (paymentsByStudent[studentName] || 0) + safeNumber(payment.amount);
        }
      });
      
      let totalOwed = 0;
      students.forEach(student => {
        const studentName = student.name || `Student ${student.id}`;
        const earned = earningsByStudent[studentName] || 0;
        const paid = paymentsByStudent[studentName] || 0;
        const owed = Math.max(earned - paid, 0);
        totalOwed += owed;
        
        console.log(`💰 ${studentName}: Earned $${fmtMoney(earned)}, Paid $${fmtMoney(paid)}, Owed $${fmtMoney(owed)}`);
      });
      
      console.log(`📊 Outstanding balance: $${fmtMoney(totalOwed)}`);
      
      this.updateElement('totalOwed', `$${fmtMoney(totalOwed)}`);
      this.updateElement('outstandingBalance', `$${fmtMoney(totalOwed)}`);
    } catch (error) {
      console.error('Error calculating outstanding balance:', error);
    }
  },

  async calculateOverviewStats() {
    try {
      // Ensure we have fresh data for all collections
      const [students, hours, marks, payments] = await Promise.all([
        EnhancedCache.loadCollection('students'),
        EnhancedCache.loadCollection('hours'),
        EnhancedCache.loadCollection('marks'),
        EnhancedCache.loadCollection('payments')
      ]);
      
      const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
      const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
      const totalPayments = payments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
      
      let avgMark = 0;
      if (marks.length > 0) {
        const totalPercentage = marks.reduce((sum, mark) => sum + safeNumber(mark.percentage), 0);
        avgMark = totalPercentage / marks.length;
      }
      
      const outstanding = Math.max(totalEarnings - totalPayments, 0);
      
      console.log('📊 Overview stats:', {
        students: students.length,
        hours: totalHours,
        earnings: totalEarnings,
        payments: totalPayments,
        marks: avgMark.toFixed(1),
        outstanding: outstanding
      });
      
      this.updateElement('totalStudentsReport', students.length);
      this.updateElement('totalHoursReport', totalHours.toFixed(1));
      this.updateElement('totalEarningsReport', `$${fmtMoney(totalEarnings)}`);
      this.updateElement('avgMarkReport', `${avgMark.toFixed(1)}%`);
      this.updateElement('totalPaymentsReport', `$${fmtMoney(totalPayments)}`);
      this.updateElement('outstandingBalance', `$${fmtMoney(outstanding)}`);
    } catch (error) {
      console.error('Error calculating overview stats:', error);
    }
  },

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
      // Add visual feedback for updates
      element.style.transition = 'all 0.3s ease';
      element.style.transform = 'scale(1.05)';
      setTimeout(() => {
        element.style.transform = 'scale(1)';
      }, 300);
    } else {
      console.warn(`⚠️ Element not found: ${id}`);
    }
  },

  forceRefresh() {
    console.log('🔄 Forcing stats refresh...');
    this.refreshAllStats();
  },

  // New method to refresh when data changes
  onDataChanged() {
    console.log('📈 Data changed, updating stats...');
    this.forceRefresh();
  }
};

// ===========================
// DATE HELPER FUNCTIONS
// ===========================

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
// MISSING REFRESH TIMESTAMP FUNCTION
// ===========================

function refreshTimestamp() {
  const now = new Date().toLocaleString();
  
  // Update sync status
  if (syncMessageLine) {
    syncMessageLine.textContent = `Status: Last synced at ${now}`;
  }
  
  // Update stats timestamp
  if (document.getElementById('statUpdated')) {
    document.getElementById('statUpdated').textContent = now;
  }
  
  // Update modal timestamp if it exists
  const modalStatUpdated = document.getElementById('modalStatUpdated');
  if (modalStatUpdated) {
    modalStatUpdated.textContent = now;
  }
  
  console.log('🕒 Timestamp refreshed:', now);
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
// SYNC BAR SYSTEM - FIXED VERSION
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
      syncIndicator.classList.remove('sync-connected', 'sync-error');
      syncIndicator.classList.add('sync-active');
    }
    if (syncMessageLine) {
      syncMessageLine.textContent = `Status: ${mode === 'auto' ? 'Auto-syncing' : 'Manual syncing'}...`;
    }

    // Core sync tasks that must work
    await Promise.all([
      recalcSummaryStats(user.uid),
      loadUserStats(user.uid)
    ]);

    // Optional UI updates - these won't break the sync if they fail
    try {
      if (typeof renderStudents === 'function') await renderStudents();
    } catch (e) { console.warn('renderStudents failed:', e); }

     try {
      if (typeof renderOverviewReports === 'function') await renderOverviewReports();
    } catch (e) { console.warn('renderOverviewReports failed:', e); }
    
    try {
      if (typeof renderRecentHours === 'function') await renderRecentHours();
    } catch (e) { console.warn('renderRecentHours failed:', e); }
    
    try {
      if (typeof renderRecentMarks === 'function') await renderRecentMarks();
    } catch (e) { console.warn('renderRecentMarks failed:', e); }
    
    try {
      if (typeof renderAttendanceRecent === 'function') await renderAttendanceRecent();
    } catch (e) { console.warn('renderAttendanceRecent failed:', e); }
    
    try {
      if (typeof renderPaymentActivity === 'function') await renderPaymentActivity();
    } catch (e) { console.warn('renderPaymentActivity failed:', e); }
    
    try {
      if (typeof renderStudentBalances === 'function') await renderStudentBalances();
    } catch (e) { console.warn('renderStudentBalances failed:', e); }
    
    try {
      if (typeof renderOverviewReports === 'function') await renderOverviewReports();
    } catch (e) { console.warn('renderOverviewReports failed:', e); }
    
    try {
      if (typeof populateStudentDropdowns === 'function') await populateStudentDropdowns();
    } catch (e) { console.warn('populateStudentDropdowns failed:', e); }

    // Update timestamp
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

    // Refresh stats
    if (typeof EnhancedStats !== 'undefined' && EnhancedStats.forceRefresh) {
      EnhancedStats.forceRefresh();
    }

    NotificationSystem.notifySuccess(`${mode === 'auto' ? 'Auto-' : ''}Sync completed successfully`);
    console.log('✅ Sync completed successfully');

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
}
};
  
// ===========================
// UTILITY FUNCTIONS - DECLARE ONLY ONCE
// ===========================

function safeNumber(n, fallback = 0) {
  if (n === null || n === undefined || n === '') return fallback;
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function fmtMoney(n) {
  return safeNumber(n).toFixed(2);
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
  const hours = safeNumber(document.getElementById('hours')?.value);
  const rate = safeNumber(document.getElementById('rate')?.value);
  const total = hours * rate;
  
  const totalPayElement = document.getElementById('totalPay');
  if (totalPayElement) {
    totalPayElement.textContent = `$${fmtMoney(total)}`;
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

function isDateInRange(entryDate, startDate, endDate) {
  try {
    const entry = new Date(entryDate);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const entryDateOnly = new Date(entry.getFullYear(), entry.getMonth(), entry.getDate());
    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    
    return entryDateOnly >= startDateOnly && entryDateOnly <= endDateOnly;
  } catch (error) {
    console.error('Date comparison error:', error);
    return false;
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
    createdAt: memberSince,
    defaultRate: parseFloat(localStorage.getItem('userDefaultRate')) || 0,
    memberSince: memberSince
  };
  
  // Initialize profile button with fallback data
  if (typeof updateProfileButton === 'function') {
    updateProfileButton(fallbackProfile);
  }
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
      
      // Update profile button with actual data
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

// ===========================
// PROFILE BUTTON FUNCTIONS - ADD THIS SECTION
// ===========================

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

  // Setup profile button click
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('👤 Profile button clicked');
      
      // Update modal with current data before showing
      updateProfileModal();
      profileModal.style.display = 'flex';
      document.body.classList.add('modal-open');
    });
  }

  // Setup close button
  if (closeProfileModal) {
    closeProfileModal.addEventListener('click', () => {
      profileModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    });
  }

  // Setup logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to logout?')) {
        try {
          await signOut(auth);
          // Clear all local storage
          localStorage.clear();
          window.location.href = "auth.html";
        } catch (error) {
          console.error('Logout error:', error);
          NotificationSystem.notifyError('Logout failed');
        }
      }
    });
  }

  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === profileModal) {
      profileModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  });

  // Close modal with Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && profileModal.style.display === 'flex') {
      profileModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  });

  console.log('✅ Profile modal setup complete');
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

    // Call refreshTimestamp here
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
// MISSING RENDER STUDENT BALANCES FUNCTION
// ===========================

async function renderStudentBalances() {
  const container = document.getElementById('studentBalancesContainer');
  if (!container) return;

  try {
    // Load fresh data
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

    // Calculate earnings and payments by student
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
        <div class="activity-item">
          <div><strong>${studentName}</strong></div>
          <div class="muted">
            Earned: $${fmtMoney(earned)} | 
            Paid: $${fmtMoney(paid)} | 
            <strong>Owed: $${fmtMoney(owed)}</strong>
          </div>
        </div>
      `;
    });

    container.innerHTML = balancesHTML;

    // Update total owed display
    const totalOwedEl = document.getElementById('totalOwed');
    const totalStudentsCountEl = document.getElementById('totalStudentsCount');
    
    if (totalOwedEl) totalOwedEl.textContent = `$${fmtMoney(totalOwed)}`;
    if (totalStudentsCountEl) totalStudentsCountEl.textContent = students.length;

    console.log(`✅ Rendered balances for ${students.length} students, total owed: $${fmtMoney(totalOwed)}`);

  } catch (error) {
    console.error("Error rendering student balances:", error);
    container.innerHTML = '<div class="error">Error loading student balances</div>';
  }
}

// ===========================
// MISSING RENDER PAYMENT ACTIVITY FUNCTION
// ===========================

async function renderPaymentActivity(limit = 10) {
  const container = document.getElementById('paymentActivityLog');
  if (!container) return;

  try {
    // Use cached payments or load fresh
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

    // Sort by date (newest first)
    const sortedPayments = payments.sort((a, b) => {
      const dateA = new Date(a.date || a.dateIso);
      const dateB = new Date(b.date || b.dateIso);
      return dateB - dateA;
    });

    let paymentHTML = '';
    sortedPayments.slice(0, limit).forEach(entry => {
      paymentHTML += `
        <div class="activity-item">
          <div class="payment-header">
            <strong>$${fmtMoney(entry.amount)}</strong> — ${entry.student || 'Unknown Student'}
            <div class="student-actions">
              <button class="btn-icon" onclick="editPayment('${entry.id}')" title="Edit">✏️</button>
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

function clearAttendanceForm() {
  const form = document.getElementById('attendanceForm');
  if (form) {
    form.reset();
    
    // Clear all student checkboxes
    const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      if (checkbox.parentElement) {
        checkbox.parentElement.style.backgroundColor = '';
        checkbox.parentElement.classList.remove('selected');
      }
    });
    
    // Reset select all button
    updateSelectAllButton(false);
    
    // Set today's date as default
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    NotificationSystem.notifyInfo('Attendance form cleared');
  }
}

// ===========================
// ENHANCED FORM SETUP WITH DROPDOWN SUPPORT
// ===========================

function setupFormHandlers() {
  console.log('🔧 Setting up form handlers with enhanced attendance support...');
  
  // Initialize dropdown manager
  StudentDropdownManager.init();
  
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
    const studentDropdown = document.getElementById('student');
    
    if (baseRateInput && defaultBaseRateInput && !baseRateInput.value) {
      baseRateInput.value = defaultBaseRateInput.value || currentUserData?.defaultRate || '0';
    }
    
    if (hoursInput) hoursInput.addEventListener('input', calculateTotalPay);
    if (baseRateInput) baseRateInput.addEventListener('input', calculateTotalPay);
    
    // Enhance student dropdown in hours form
    if (studentDropdown) {
      studentDropdown.addEventListener('focus', async () => {
        console.log('🎯 Hours form student dropdown focused');
        await StudentDropdownManager.refreshAllDropdowns();
      });
    }
    
    calculateTotalPay();
  }
  
  const marksForm = document.getElementById('marksForm');
  if (marksForm) {
    marksForm.addEventListener('submit', handleMarksSubmit);
    
    const studentDropdown = document.getElementById('marksStudent');
    if (studentDropdown) {
      studentDropdown.addEventListener('focus', async () => {
        console.log('🎯 Marks form student dropdown focused');
        await StudentDropdownManager.refreshAllDropdowns();
      });
    }
  }
  
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', handleAttendanceSubmit);
    
    // Enhanced attendance setup with select all functionality
    const attendanceTab = document.querySelector('[data-tab="attendance"]');
    if (attendanceTab) {
      attendanceTab.addEventListener('click', () => {
        setTimeout(async () => {
          console.log('🎯 Attendance tab opened, setting up enhanced features...');
          await StudentDropdownManager.refreshAllDropdowns();
          setupAttendanceTab(); // Initialize enhanced attendance features
        }, 500);
      });
    }
  }
  
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmit);
    
    const studentDropdown = document.getElementById('paymentStudent');
    if (studentDropdown) {
      studentDropdown.addEventListener('focus', async () => {
        console.log('🎯 Payment form student dropdown focused');
        await StudentDropdownManager.refreshAllDropdowns();
      });
    }
  }
  
  // Setup student dropdown population on tab changes
  setupFormStudentPopulation();
  
  console.log('✅ All form handlers with enhanced attendance support initialized');
}

function setupFormStudentPopulation() {
  console.log('🔧 Setting up student form population...');
  
  // Populate dropdowns immediately if we have data
  if (Array.isArray(cache.students) && cache.students.length > 0) {
    setTimeout(() => populateStudentDropdowns(), 1000);
  }
  
  // Set up tab change listeners
  const formTabs = ['hours', 'marks', 'attendance', 'payments'];
  formTabs.forEach(tabName => {
    const tab = document.querySelector(`[data-tab="${tabName}"]`);
    if (tab) {
      tab.addEventListener('click', () => {
        setTimeout(async () => {
          console.log(`🎯 ${tabName} tab activated, refreshing dropdowns...`);
          await StudentDropdownManager.refreshAllDropdowns();
          
          // Special handling for attendance tab
          if (tabName === 'attendance') {
            setupAttendanceTab(); // Initialize enhanced attendance features
          }
        }, 300);
      });
    }
  });
}

// Enhanced attendance setup function
function setupAttendanceTab() {
  console.log('🎯 Setting up enhanced attendance features...');
  
  // Wait a bit for the DOM to be ready and students to be populated
  setTimeout(() => {
    setupAttendanceSelectAll();
    setupAttendanceCheckboxListeners();
    updateSelectAllButtonState();
  }, 500);
}

// Setup attendance select all button with event listeners
function setupAttendanceSelectAll() {
  const selectAllBtn = document.getElementById('selectAllStudentsBtn');
  
  if (!selectAllBtn) {
    console.warn('⚠️ Select All button not found in DOM');
    return;
  }

  console.log('✅ Setting up Select All button with event listener...');

  // Remove any existing event listeners by cloning the button
  const newSelectAllBtn = selectAllBtn.cloneNode(true);
  selectAllBtn.parentNode.replaceChild(newSelectAllBtn, selectAllBtn);

  // Add click event listener
  newSelectAllBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 Select All button clicked via event listener');
    selectAllStudents();
  });

  // Add hover effects
  newSelectAllBtn.addEventListener('mouseenter', function() {
    this.style.transform = 'translateY(-1px)';
    this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
  });

  newSelectAllBtn.addEventListener('mouseleave', function() {
    this.style.transform = 'translateY(0)';
    this.style.boxShadow = 'none';
  });

  // Initialize button state
  updateSelectAllButtonState();
  
  console.log('✅ Select All button setup complete with event listeners');
}

// Real-time checkbox monitoring for attendance
function setupAttendanceCheckboxListeners() {
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (!attendanceContainer) {
    console.log('⏳ Attendance container not ready yet, will retry...');
    return;
  }

  const checkboxes = attendanceContainer.querySelectorAll('input[type="checkbox"][name="presentStudents"]');
  
  if (checkboxes.length === 0) {
    console.log('⏳ No student checkboxes found yet, will retry...');
    return;
  }
  
  checkboxes.forEach(checkbox => {
    // Remove existing listeners by cloning
    const newCheckbox = checkbox.cloneNode(true);
    checkbox.parentNode.replaceChild(newCheckbox, checkbox);

    newCheckbox.addEventListener('change', function() {
      // Update visual feedback
      if (this.checked) {
        this.parentElement.style.backgroundColor = 'var(--primary-light)';
        this.parentElement.classList.add('selected');
      } else {
        this.parentElement.style.backgroundColor = '';
        this.parentElement.classList.remove('selected');
      }
      
      // Update select all button state
      updateSelectAllButtonState();
    });
  });

  console.log(`✅ Setup change listeners for ${checkboxes.length} student checkboxes`);
}

function updateSelectAllButtonState() {
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (!attendanceContainer) return;
  
  const checkboxes = attendanceContainer.querySelectorAll('input[type="checkbox"][name="presentStudents"]');
  const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  const allSelected = selectedCount === checkboxes.length && checkboxes.length > 0;
  
  updateSelectAllButton(allSelected);
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
// ENHANCED SELECT ALL STUDENTS FUNCTION - EVENT LISTENER APPROACH
// ===========================

function selectAllStudents() {
  console.log('👥 Selecting all students for attendance...');
  
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (!attendanceContainer) {
    console.error('❌ Attendance container not found');
    NotificationSystem.notifyError('Attendance form not loaded properly');
    return;
  }
  
  const checkboxes = attendanceContainer.querySelectorAll('input[type="checkbox"][name="presentStudents"]');
  
  if (checkboxes.length === 0) {
    console.warn('⚠️ No student checkboxes found');
    NotificationSystem.notifyWarning('No students available. Please add students first.');
    return;
  }
  
  // Check current selection state
  const selectedCount = Array.from(checkboxes).filter(checkbox => checkbox.checked).length;
  const allSelected = selectedCount === checkboxes.length;
  const someSelected = selectedCount > 0 && selectedCount < checkboxes.length;
  
  let action;
  let message;
  
  if (allSelected || someSelected) {
    // Deselect all
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      checkbox.parentElement.style.backgroundColor = ''; // Remove highlight
    });
    action = 'deselected';
    message = `Deselected all ${checkboxes.length} students`;
    console.log('✅ All students deselected');
    NotificationSystem.notifyInfo(message);
  } else {
    // Select all
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      checkbox.parentElement.style.backgroundColor = 'var(--primary-light)'; // Add highlight
    });
    action = 'selected';
    message = `Selected all ${checkboxes.length} students`;
    console.log(`✅ All ${checkboxes.length} students selected`);
    NotificationSystem.notifySuccess(message);
  }
  
  // Update button text and style
  updateSelectAllButton(action === 'selected');
  
  return action;
}

function updateSelectAllButton(allSelected) {
  const selectAllBtn = document.getElementById('selectAllStudentsBtn');
  if (selectAllBtn) {
    if (allSelected) {
      selectAllBtn.textContent = 'Deselect All';
      selectAllBtn.title = 'Deselect all students';
      selectAllBtn.classList.remove('btn-secondary');
      selectAllBtn.classList.add('btn-warning');
    } else {
      selectAllBtn.textContent = 'Select All';
      selectAllBtn.title = 'Select all students';
      selectAllBtn.classList.remove('btn-warning');
      selectAllBtn.classList.add('btn-secondary');
    }
  }
}

// Get current selection count for the button
function getSelectedStudentsCount() {
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (!attendanceContainer) return 0;
  
  const checkboxes = attendanceContainer.querySelectorAll('input[type="checkbox"][name="presentStudents"]');
  return Array.from(checkboxes).filter(checkbox => checkbox.checked).length;
}

// ===========================
// MISSING UPDATE PROFILE MODAL FUNCTION
// ===========================

function updateProfileModal() {
  const profileUserEmail = document.getElementById('profileUserEmail');
  const profileUserSince = document.getElementById('profileUserSince');
  const profileDefaultRate = document.getElementById('profileDefaultRate');
  const modalStatStudents = document.getElementById('modalStatStudents');
  const modalStatHours = document.getElementById('modalStatHours');
  const modalStatEarnings = document.getElementById('modalStatEarnings');
  const modalStatUpdated = document.getElementById('modalStatUpdated');

  console.log('👤 Updating profile modal...');

  // Update user info
  if (currentUserData) {
    const email = currentUserData.email || auth.currentUser?.email || 'Not available';
    if (profileUserEmail) {
      profileUserEmail.textContent = email;
    }
    
    // Use persistent member since date
    const memberSince = currentUserData.memberSince || localStorage.getItem('memberSince') || currentUserData.createdAt || new Date().toISOString();
    if (profileUserSince) {
      profileUserSince.textContent = formatDate(memberSince);
    }
    
    if (profileDefaultRate) {
      profileDefaultRate.textContent = `$${fmtMoney(currentUserData.defaultRate || 0)}/hour`;
    }
  }

  // Update stats in modal - call the function directly, not with "this"
  updateModalStats();

  console.log('✅ Profile modal updated');
}

// Make sure updateModalStats function exists and is defined
function updateModalStats() {
  const modalStatStudents = document.getElementById('modalStatStudents');
  const modalStatHours = document.getElementById('modalStatHours');
  const modalStatEarnings = document.getElementById('modalStatEarnings');
  const modalStatUpdated = document.getElementById('modalStatUpdated');

  // Get current stats from main display or calculate fresh
  const statStudents = document.getElementById('statStudents');
  const statHours = document.getElementById('statHours');
  const statEarnings = document.getElementById('statEarnings');
  const statUpdated = document.getElementById('statUpdated');

  // Use main stats if available, otherwise calculate
  if (modalStatStudents) {
    if (statStudents && statStudents.textContent) {
      modalStatStudents.textContent = statStudents.textContent;
    } else {
      const students = Array.isArray(cache.students) ? cache.students : [];
      modalStatStudents.textContent = students.length;
    }
  }

  if (modalStatHours) {
    if (statHours && statHours.textContent) {
      modalStatHours.textContent = statHours.textContent;
    } else {
      const hours = Array.isArray(cache.hours) ? cache.hours : [];
      const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
      modalStatHours.textContent = totalHours.toFixed(1);
    }
  }

  if (modalStatEarnings) {
    if (statEarnings && statEarnings.textContent) {
      modalStatEarnings.textContent = statEarnings.textContent;
    } else {
      const hours = Array.isArray(cache.hours) ? cache.hours : [];
      const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
      modalStatEarnings.textContent = `$${fmtMoney(totalEarnings)}`;
    }
  }

  if (modalStatUpdated) {
    if (statUpdated && statUpdated.textContent) {
      modalStatUpdated.textContent = statUpdated.textContent;
    } else {
      modalStatUpdated.textContent = new Date().toLocaleString();
    }
  }
}

// ===========================
// FIXED DATA LOADING FUNCTIONS
// ===========================

async function loadAllData() {
  const user = auth.currentUser;
  if (!user) return;

  console.log('🔄 Loading all data from Firebase...');
  
  try {
    // Load all collections in parallel
    const [students, hours, marks, attendance, payments] = await Promise.all([
      loadCollectionWithRetry('students'),
      loadCollectionWithRetry('hours'),
      loadCollectionWithRetry('marks'),
      loadCollectionWithRetry('attendance'),
      loadCollectionWithRetry('payments')
    ]);

    console.log('📊 Data loaded:', {
      students: students.length,
      hours: hours.length,
      marks: marks.length,
      attendance: attendance.length,
      payments: payments.length
    });

    // Update cache
    cache.students = students;
    cache.hours = hours;
    cache.marks = marks;
    cache.attendance = attendance;
    cache.payments = payments;
    cache.lastSync = Date.now();

    // Update UI
    await refreshAllUI();

    return true;
  } catch (error) {
    console.error('❌ Error loading all data:', error);
    NotificationSystem.notifyError('Failed to load data from server');
    return false;
  }
}

async function loadCollectionWithRetry(collectionName, retries = 3) {
  const user = auth.currentUser;
  if (!user) return [];

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Loading ${collectionName} (attempt ${attempt})...`);
      
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

      console.log(`✅ Loaded ${data.length} ${collectionName} from Firebase`);
      return data;
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed for ${collectionName}:`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return [];
}

async function refreshAllUI() {
  console.log('🔄 Refreshing all UI components...');
  
  await Promise.all([
    renderStudents(),
    renderRecentHours(),
    renderRecentMarks(),
    renderAttendanceRecent(),
    renderPaymentActivity(),
    renderStudentBalances(),
    renderOverviewReports()
  ]);
  
  await populateStudentDropdowns();
  EnhancedStats.forceRefresh();
  
  console.log('✅ All UI components refreshed');
}

// ===========================
// ENHANCED STUDENT DROPDOWN SYSTEM
// ===========================

const StudentDropdownManager = {
  initialized: false,
  dropdowns: [],
  
  init() {
    if (this.initialized) return;
    
    console.log('🎯 Initializing student dropdown manager...');
    this.setupDropdownListeners();
    this.initialized = true;
  },
  
  setupDropdownListeners() {
    // Watch for tab changes to refresh dropdowns
    document.addEventListener('click', (e) => {
      if (e.target.matches('.tab[data-tab]')) {
        setTimeout(() => this.refreshAllDropdowns(), 300);
      }
    });
    
    // Watch for form submissions that might add new students
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'studentForm') {
        setTimeout(() => this.refreshAllDropdowns(), 1000);
      }
    });
  },
  
  async refreshAllDropdowns() {
    console.log('🔄 Refreshing all student dropdowns...');
    await populateStudentDropdowns();
    this.enhanceDropdownBehavior();
  },
  
  enhanceDropdownBehavior() {
    // Get all student dropdowns
    const dropdownSelectors = [
      '#student', // Hours form
      '#marksStudent', // Marks form  
      '#paymentStudent', // Payments form
      'select[name="student"]',
      'select[name="marksStudent"]', 
      'select[name="paymentStudent"]'
    ];
    
    this.dropdowns = [];
    dropdownSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el && !this.dropdowns.includes(el)) {
          this.dropdowns.push(el);
          this.enhanceSingleDropdown(el);
        }
      });
    });
    
    console.log(`✅ Enhanced ${this.dropdowns.length} student dropdowns`);
  },
  
  enhanceSingleDropdown(dropdown) {
    // Remove existing event listeners by cloning
    const newDropdown = dropdown.cloneNode(true);
    dropdown.parentNode.replaceChild(newDropdown, dropdown);
    
    // Add click handler to open and refresh
    newDropdown.addEventListener('click', async (e) => {
      console.log('🎯 Student dropdown clicked:', newDropdown.id || newDropdown.name);
      
      // Refresh data if dropdown is empty
      if (newDropdown.options.length <= 1) {
        console.log('🔄 Dropdown empty, refreshing students...');
        await this.refreshAllDropdowns();
      }
    });
    
    // Add focus handler
    newDropdown.addEventListener('focus', async (e) => {
      console.log('🎯 Student dropdown focused:', newDropdown.id || newDropdown.name);
      
      // Ensure we have the latest students
      const students = await EnhancedCache.loadCollection('students');
      if (students.length > 0 && newDropdown.options.length <= 1) {
        console.log('🔄 Populating dropdown on focus...');
        await populateStudentDropdowns();
      }
    });
    
    return newDropdown;
  },
  
  // Force refresh all dropdowns
  async forceRefresh() {
    console.log('🔄 Force refreshing all dropdowns...');
    await populateStudentDropdowns();
    this.enhanceDropdownBehavior();
  }
};

// ===========================
// UPDATED STUDENT DROPDOWN POPULATION
// ===========================

async function populateStudentDropdowns() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    console.log('🔄 Populating student dropdowns...');
    
    const students = await EnhancedCache.loadCollection('students');
    console.log(`📝 Found ${students.length} students for dropdowns`);

    if (students.length === 0) {
      showDropdownError();
      return;
    }

    // Get all dropdown elements
    const dropdownSelectors = [
      '#student',
      '#marksStudent', 
      '#paymentStudent',
      'select[name="student"]',
      'select[name="marksStudent"]', 
      'select[name="paymentStudent"]'
    ];

    const dropdowns = [];
    dropdownSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el) dropdowns.push(el);
      });
    });

    console.log(`🎯 Found ${dropdowns.length} student dropdowns to populate`);

    dropdowns.forEach(dropdown => {
      populateSingleDropdown(dropdown, students);
    });

    console.log('✅ All student dropdowns populated successfully');

  } catch (error) {
    console.error('❌ Error populating student dropdowns:', error);
    showDropdownError();
  }
}

function populateSingleDropdown(dropdown, students) {
  if (!dropdown) return;

  // Store current selection
  const currentValue = dropdown.value;
  const currentIndex = dropdown.selectedIndex;
  
  // Clear existing options except the first placeholder
  while (dropdown.options.length > 0) {
    dropdown.remove(0);
  }

  // Add default placeholder option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a student...';
  defaultOption.disabled = true;
  defaultOption.selected = true;
  dropdown.appendChild(defaultOption);

  // Add students to dropdown
  students.forEach(student => {
    const studentName = student.name || `Student ${student.id}`;
    const option = document.createElement('option');
    option.value = studentName;
    option.textContent = studentName;
    option.setAttribute('data-student-id', student.id);
    dropdown.appendChild(option);
  });

  // Restore selection if possible
  if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
    dropdown.value = currentValue;
  } else if (currentIndex > 0 && dropdown.options.length > currentIndex) {
    dropdown.selectedIndex = currentIndex;
  }

  // Add visual feedback
  dropdown.style.borderColor = '#10b981';
  setTimeout(() => {
    dropdown.style.borderColor = '';
  }, 1000);

  console.log(`✅ Populated ${dropdown.id || dropdown.name} with ${students.length} students`);
}

function populateAttendanceStudents(students) {
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (!attendanceContainer) {
    console.log('❌ Attendance container not found');
    return;
  }

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
    studentInfo.textContent = `Rate: $${fmtMoney(student.rate || 0)}`;
    studentInfo.style.cssText = 'font-size: 0.85em; color: var(--muted);';
    
    container.appendChild(checkbox);
    container.appendChild(label);
    container.appendChild(studentInfo);
    attendanceContainer.appendChild(container);
  });

  console.log('✅ Attendance students populated');
}

function showNoStudentsMessage() {
  const dropdowns = document.querySelectorAll('select[name="student"], select[name="marksStudent"], select[name="paymentStudent"]');
  
  dropdowns.forEach(dropdown => {
    if (dropdown && dropdown.options.length <= 1) {
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
  const dropdowns = document.querySelectorAll('select[name="student"], select[name="marksStudent"], select[name="paymentStudent"]');
  
  dropdowns.forEach(dropdown => {
    if (dropdown) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Error loading students - Click to refresh';
      option.disabled = true;
      option.selected = true;
      dropdown.appendChild(option);
      
      // Add click handler to retry
      dropdown.addEventListener('click', async () => {
        await populateStudentDropdowns();
      });
    }
  });
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
// MISSING RENDER OVERVIEW REPORTS FUNCTION
// ===========================

async function renderOverviewReports() {
  console.log('📊 Rendering overview reports...');
  
  try {
    // Load all necessary data
    const [students, hours, marks, payments] = await Promise.all([
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('marks'),
      EnhancedCache.loadCollection('payments')
    ]);

    // Calculate totals
    const totalStudents = students.length;
    const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    const totalPayments = payments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
    
    // Calculate average marks
    let avgMark = 0;
    if (marks.length > 0) {
      const totalPercentage = marks.reduce((sum, mark) => sum + safeNumber(mark.percentage), 0);
      avgMark = totalPercentage / marks.length;
    }
    
    // Calculate outstanding balance
    const outstandingBalance = Math.max(totalEarnings - totalPayments, 0);

    // Update overview report elements
    const elements = {
      'totalStudentsReport': totalStudents,
      'totalHoursReport': totalHours.toFixed(1),
      'totalEarningsReport': `$${fmtMoney(totalEarnings)}`,
      'avgMarkReport': `${avgMark.toFixed(1)}%`,
      'totalPaymentsReport': `$${fmtMoney(totalPayments)}`,
      'outstandingBalance': `$${fmtMoney(outstandingBalance)}`
    };

    // Update each element
    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });

    console.log('✅ Overview reports rendered:', {
      students: totalStudents,
      hours: totalHours,
      earnings: totalEarnings,
      payments: totalPayments,
      marks: avgMark.toFixed(1),
      outstanding: outstandingBalance
    });

  } catch (error) {
    console.error('❌ Error rendering overview reports:', error);
    
    // Show error state
    const errorElements = [
      'totalStudentsReport', 'totalHoursReport', 'totalEarningsReport',
      'avgMarkReport', 'totalPaymentsReport', 'outstandingBalance'
    ];
    
    errorElements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = 'Error';
      }
    });
  }
}

// ===========================
// REPORT DATA FUNCTIONS
// ===========================

async function loadReportData() {
  console.log('📊 Loading report data...');
  
  try {
    const [hours, marks] = await Promise.all([
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('marks')
    ]);

    console.log('📈 Report data loaded:', {
      hours: hours.length,
      marks: marks.length
    });

    // Generate reports
    generatePeriodReport(hours);
    generateSubjectReport(marks, hours);
    
    return true;
  } catch (error) {
    console.error('❌ Error loading report data:', error);
    return false;
  }
}

function generatePeriodReport(hours) {
  const container = document.getElementById('periodReport');
  if (!container) return;

  if (!hours || hours.length === 0) {
    container.innerHTML = '<div class="empty-state">No hours data available</div>';
    return;
  }

  // Group by period (weekly, monthly, etc.)
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

  const weeklyHours = weeklyData.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
  const weeklyEarnings = weeklyData.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
  
  const monthlyHours = monthlyData.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
  const monthlyEarnings = monthlyData.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);

  // Get unique subjects
  const weeklySubjects = [...new Set(weeklyData.map(entry => entry.subject || 'General'))].join(', ');
  const monthlySubjects = [...new Set(monthlyData.map(entry => entry.subject || 'General'))].join(', ');

  const reportHTML = `
    <div class="report-table">
      <div class="report-row header">
        <div class="report-cell">Period</div>
        <div class="report-cell">Hours</div>
        <div class="report-cell">Earnings</div>
        <div class="report-cell">Subjects</div>
        <div class="report-cell">Net (80%)</div>
      </div>
      <div class="report-row">
        <div class="report-cell"><strong>This Week</strong></div>
        <div class="report-cell">${weeklyHours.toFixed(1)}</div>
        <div class="report-cell">$${fmtMoney(weeklyEarnings)}</div>
        <div class="report-cell" title="${weeklySubjects}">${weeklySubjects.substring(0, 20)}${weeklySubjects.length > 20 ? '...' : ''}</div>
        <div class="report-cell">$${fmtMoney(weeklyEarnings * 0.8)}</div>
      </div>
      <div class="report-row">
        <div class="report-cell"><strong>This Month</strong></div>
        <div class="report-cell">${monthlyHours.toFixed(1)}</div>
        <div class="report-cell">$${fmtMoney(monthlyEarnings)}</div>
        <div class="report-cell" title="${monthlySubjects}">${monthlySubjects.substring(0, 20)}${monthlySubjects.length > 20 ? '...' : ''}</div>
        <div class="report-cell">$${fmtMoney(monthlyEarnings * 0.8)}</div>
      </div>
    </div>
  `;

  container.innerHTML = reportHTML;
  console.log('✅ Period report generated');
}

function generateSubjectReport(marks, hours) {
  const container = document.getElementById('subjectReport');
  if (!container) return;

  if ((!marks || marks.length === 0) && (!hours || hours.length === 0)) {
    container.innerHTML = '<div class="empty-state">No marks or hours data available</div>';
    return;
  }

  // Group marks by subject
  const subjectMarks = {};
  marks.forEach(mark => {
    const subject = mark.subject || 'General';
    if (!subjectMarks[subject]) {
      subjectMarks[subject] = {
        totalPercentage: 0,
        count: 0,
        marks: []
      };
    }
    subjectMarks[subject].totalPercentage += safeNumber(mark.percentage);
    subjectMarks[subject].count++;
    subjectMarks[subject].marks.push(mark);
  });

  // Group hours by subject
  const subjectHours = {};
  hours.forEach(entry => {
    const subject = entry.subject || 'General';
    if (!subjectHours[subject]) {
      subjectHours[subject] = {
        hours: 0,
        earnings: 0,
        sessions: 0
      };
    }
    subjectHours[subject].hours += safeNumber(entry.hours);
    subjectHours[subject].earnings += safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0));
    subjectHours[subject].sessions++;
  });

  // Combine data
  const allSubjects = new Set([
    ...Object.keys(subjectMarks),
    ...Object.keys(subjectHours)
  ]);

  if (allSubjects.size === 0) {
    container.innerHTML = '<div class="empty-state">No subject data available</div>';
    return;
  }

  let reportHTML = `
    <div class="report-table">
      <div class="report-row header">
        <div class="report-cell">Subject</div>
        <div class="report-cell">Avg Mark</div>
        <div class="report-cell">Hours</div>
        <div class="report-cell">Earnings</div>
        <div class="report-cell">Sessions</div>
      </div>
  `;

  allSubjects.forEach(subject => {
    const markData = subjectMarks[subject];
    const hourData = subjectHours[subject];
    
    const avgMark = markData ? (markData.totalPercentage / markData.count).toFixed(1) : 'N/A';
    const totalHours = hourData ? hourData.hours.toFixed(1) : '0';
    const totalEarnings = hourData ? fmtMoney(hourData.earnings) : '$0';
    const totalSessions = hourData ? hourData.sessions : markData ? markData.count : 0;

    reportHTML += `
      <div class="report-row">
        <div class="report-cell"><strong>${subject}</strong></div>
        <div class="report-cell">${avgMark}%</div>
        <div class="report-cell">${totalHours}</div>
        <div class="report-cell">${totalEarnings}</div>
        <div class="report-cell">${totalSessions}</div>
      </div>
    `;
  });

  reportHTML += '</div>';
  container.innerHTML = reportHTML;
  console.log('✅ Subject report generated');
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
  
// ===========================
// ENHANCED AUTH STATE HANDLER
// ===========================

// Wait for authentication
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log('👤 User authenticated:', user.email);
    
    // Show loading state
    document.body.classList.add('loading');
    
    try {
      console.log('🚀 Starting app initialization...');
      
      // Step 1: Initialize persistent data
      if (!localStorage.getItem('memberSince')) {
        localStorage.setItem('memberSince', new Date().toISOString());
        console.log('✅ Member since date initialized');
      }

      // Step 2: Load user profile
      console.log('📋 Loading user profile...');
      await loadUserProfile(user.uid);
      console.log('✅ User profile loaded');

      // Step 3: Load ALL data from Firebase with progress tracking
      console.log('📥 Loading all data from Firebase...');
      const dataLoaded = await loadAllData();
      
      if (!dataLoaded) {
        console.warn('⚠️ Using cached data - some features may be limited');
        NotificationSystem.notifyWarning('Using cached data - some features may be limited');
      } else {
        console.log('✅ All data loaded successfully from Firebase');
      }

      // Step 4: Initialize core UI components
      console.log('🎨 Initializing UI components...');
      SyncBar.init();
      setupProfileModal();
      setupFloatingAddButton();
      updateHeaderStats();
      
      // Step 5: Initialize dropdown manager and forms
      console.log('⚙️ Setting up forms and dropdowns...');
      StudentDropdownManager.init();
      setupFormHandlers();
      
      // Step 6: Force refresh all dropdowns with retry logic
      console.log('🔄 Refreshing student dropdowns...');
      let dropdownsPopulated = false;
      let retryCount = 0;
      
      while (!dropdownsPopulated && retryCount < 3) {
        try {
          await StudentDropdownManager.forceRefresh();
          const students = await EnhancedCache.loadCollection('students');
          if (students.length > 0) {
            dropdownsPopulated = true;
            console.log('✅ Student dropdowns populated successfully');
          } else {
            retryCount++;
            console.log(`🔄 No students found, retry ${retryCount}/3...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          retryCount++;
          console.error(`❌ Dropdown population failed, retry ${retryCount}/3:`, error);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Step 7: Force refresh all stats and UI
      console.log('📊 Refreshing stats and UI...');
      EnhancedStats.forceRefresh();
      
      // Additional UI refresh to ensure everything is updated
      setTimeout(() => {
        refreshAllUI();
        EnhancedStats.forceRefresh();
      }, 2000);

      // Step 8: Set up periodic data refresh
      console.log('⏰ Setting up periodic data refresh...');
      setInterval(async () => {
        try {
          await loadAllData();
          EnhancedStats.forceRefresh();
          console.log('✅ Periodic data refresh completed');
        } catch (error) {
          console.error('❌ Periodic data refresh failed:', error);
        }
      }, 60000); // Refresh every 60 seconds

      // Step 9: Final initialization complete
      document.body.classList.remove('loading');
      
      // Show success notification with user info
      const displayName = user.email.split('@')[0];
      NotificationSystem.notifySuccess(
        `Welcome back, ${displayName}! All systems ready.`, 
        3000
      );
      
      console.log('🎉 Worklog App fully initialized and ready!');
      console.log('📊 Current data state:', {
        students: cache.students?.length || 0,
        hours: cache.hours?.length || 0,
        marks: cache.marks?.length || 0,
        attendance: cache.attendance?.length || 0,
        payments: cache.payments?.length || 0
      });

    } catch (error) {
      // Comprehensive error handling
      document.body.classList.remove('loading');
      
      console.error('❌ Critical error during app initialization:', error);
      
      let errorMessage = 'Failed to load application. ';
      
      if (error.code === 'permission-denied') {
        errorMessage += 'Permission denied. Please check your Firebase rules.';
      } else if (error.code === 'unavailable') {
        errorMessage += 'Network unavailable. Using offline data.';
      } else if (error.message.includes('quota')) {
        errorMessage += 'Firebase quota exceeded. Please try again later.';
      } else {
        errorMessage += error.message;
      }
      
      NotificationSystem.notifyError(errorMessage);
      
      // Try to load from cache as fallback
      try {
        console.log('🔄 Attempting to load from cache...');
        EnhancedCache.loadCachedData();
        EnhancedStats.forceRefresh();
        NotificationSystem.notifyInfo('Loaded cached data. Some features may be limited.');
      } catch (cacheError) {
        console.error('❌ Cache load also failed:', cacheError);
      }
    }
    
  } else {
    // User is not authenticated
    console.log('👤 No user authenticated, redirecting to login...');
    
    // Clear any existing data
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    
    // Redirect to auth page
    setTimeout(() => {
      window.location.href = "auth.html";
    }, 1000);
  }
});

// ===========================
// SUPPORTING FUNCTIONS
// ===========================

async function loadAllData() {
  const user = auth.currentUser;
  if (!user) {
    console.error('❌ No user for data loading');
    return false;
  }

  console.log('🔄 Loading all data from Firebase...');
  
  try {
    // Load all collections in parallel with progress tracking
    const loadPromises = [
      loadCollectionWithRetry('students'),
      loadCollectionWithRetry('hours'), 
      loadCollectionWithRetry('marks'),
      loadCollectionWithRetry('attendance'),
      loadCollectionWithRetry('payments')
    ];

    const [students, hours, marks, attendance, payments] = await Promise.all(loadPromises);

    console.log('📊 Data loaded successfully:', {
      students: students.length,
      hours: hours.length,
      marks: marks.length,
      attendance: attendance.length,
      payments: payments.length
    });

    // Update cache with fresh data
    cache.students = students;
    cache.hours = hours;
    cache.marks = marks;
    cache.attendance = attendance;
    cache.payments = payments;
    cache.lastSync = Date.now();

    // Save to localStorage for offline use
    EnhancedCache.saveToLocalStorageBulk('students', students);
    EnhancedCache.saveToLocalStorageBulk('hours', hours);
    EnhancedCache.saveToLocalStorageBulk('marks', marks);
    EnhancedCache.saveToLocalStorageBulk('attendance', attendance);
    EnhancedCache.saveToLocalStorageBulk('payments', payments);

    return true;
  } catch (error) {
    console.error('❌ Error loading all data:', error);
    
    // Try to load from localStorage as fallback
    try {
      console.log('🔄 Attempting to load from localStorage cache...');
      cache.students = EnhancedCache.loadFromLocalStorage('students');
      cache.hours = EnhancedCache.loadFromLocalStorage('hours');
      cache.marks = EnhancedCache.loadFromLocalStorage('marks');
      cache.attendance = EnhancedCache.loadFromLocalStorage('attendance');
      cache.payments = EnhancedCache.loadFromLocalStorage('payments');
      
      console.log('📁 Loaded from cache:', {
        students: cache.students.length,
        hours: cache.hours.length,
        marks: cache.marks.length,
        attendance: cache.attendance.length,
        payments: cache.payments.length
      });
      
      return false; // Indicate we're using cached data
    } catch (cacheError) {
      console.error('❌ Cache load failed:', cacheError);
      return false;
    }
  }
}

async function loadCollectionWithRetry(collectionName, retries = 3) {
  const user = auth.currentUser;
  if (!user) return [];

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Loading ${collectionName} (attempt ${attempt}/${retries})...`);
      
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

      console.log(`✅ Loaded ${data.length} ${collectionName} from Firebase`);
      return data;
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed for ${collectionName}:`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = 1000 * attempt;
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return [];
}

async function refreshAllUI() {
  console.log('🔄 Refreshing all UI components...');
  
  try {
    await Promise.all([
      renderStudents(),
      renderRecentHours(),
      renderRecentMarks(),
      renderAttendanceRecent(),
      renderPaymentActivity(),
      renderStudentBalances(),
      renderOverviewReports(), // Now this exists
      loadReportData() 
    ]);
    
    await populateStudentDropdowns();
    
    // Refresh stats
    if (typeof EnhancedStats !== 'undefined' && EnhancedStats.forceRefresh) {
      EnhancedStats.forceRefresh();
    }
    
    console.log('✅ All UI components refreshed');
  } catch (error) {
    console.error('❌ Error refreshing UI:', error);
  }
}

// Add loading CSS for better UX
function injectLoadingStyles() {
  if (!document.querySelector('#loading-styles')) {
    const style = document.createElement('style');
    style.id = 'loading-styles';
    style.textContent = `
      body.loading {
        cursor: wait !important;
      }
      
      body.loading * {
        pointer-events: none !important;
      }
      
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-size: 1.2em;
      }
      
      .loading-spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 2s linear infinite;
        margin-bottom: 20px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize loading styles when app starts
injectLoadingStyles();

// ===========================
// FIXED DATE HANDLING FUNCTIONS
// ===========================

function fmtDateISO(yyyyMmDd) {
  if (!yyyyMmDd) return new Date().toISOString();
  try {
    // Parse as local date, convert to UTC for storage
    const [year, month, day] = yyyyMmDd.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}




// ===========================
// EXPORT FUNCTIONS TO WINDOW OBJECT
// ===========================

// Make sure all necessary functions are available globally
window.updateProfileButton = updateProfileButton;
window.setupProfileModal = setupProfileModal;
window.loadUserProfile = loadUserProfile;

// Your existing exports
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
window.renderPaymentActivity = renderPaymentActivity;
window.updateProfileModal = updateProfileModal;
window.setupProfileModal = setupProfileModal;
window.renderOverviewReports = renderOverviewReports;
  
console.log('✅ All functions exported to window object');
});
