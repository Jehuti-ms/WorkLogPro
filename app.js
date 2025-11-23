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
      this.updateElement('averageRate', `$${fmtMoney(averageRate)}`);
      this.updateElement('totalStudentsCount', studentCount);
      this.updateElement('totalStudentsReport', studentCount);
    } catch (error) {
      console.error('Error calculating student stats:', error);
    }
  },

  async calculateHoursStats() {
    try {
      const hours = await EnhancedCache.loadCollection('hours');
      console.log(`📊 Calculating hours stats from ${hours.length} entries`);
      
      const now = new Date();
      const today = getLocalDateString(now);
      
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
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
      this.updateElement('weeklyTotal', `$${fmtMoney(weeklyTotal)}`);
      this.updateElement('monthlyHours', monthlyHours.toFixed(1));
      this.updateElement('monthlyTotal', `$${fmtMoney(monthlyTotal)}`);
      
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
      const attendance = await EnhancedCache.loadCollection('attendance');
      const attendanceCount = attendance.length;
      
      let lastSession = null;
      let lastSessionDate = null;
      
      if (attendanceCount > 0) {
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
      const payments = await EnhancedCache.loadCollection('payments');
      const now = new Date();
      
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
      const [students, hours, payments] = await Promise.all([
        EnhancedCache.loadCollection('students'),
        EnhancedCache.loadCollection('hours'),
        EnhancedCache.loadCollection('payments')
      ]);
      
      // FIX 1: Use student IDs as keys to prevent merging issues
      const earningsByStudentId = {};
      const paymentsByStudentId = {};
      
      hours.forEach(entry => {
        const studentName = entry.student;
        if (studentName) {
          const student = findStudentByNameOrId(students, studentName);
          if (student) {
            const earnings = entry.total || (entry.hours || 0) * (entry.rate || 0);
            earningsByStudentId[student.id] = (earningsByStudentId[student.id] || 0) + safeNumber(earnings);
          }
        }
      });

      payments.forEach(payment => {
        const studentName = payment.student;
        if (studentName) {
          const student = findStudentByNameOrId(students, studentName);
          if (student) {
            paymentsByStudentId[student.id] = (paymentsByStudentId[student.id] || 0) + safeNumber(payment.amount);
          }
        }
      });
      
      let totalOwed = 0;
      students.forEach(student => {
        const earned = earningsByStudentId[student.id] || 0;
        const paid = paymentsByStudentId[student.id] || 0;
        const owed = Math.max(earned - paid, 0);
        totalOwed += owed;
        
        console.log(`💰 ${formatStudentDisplay(student)}: Earned $${fmtMoney(earned)}, Paid $${fmtMoney(paid)}, Owed $${fmtMoney(owed)}`);
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
      
      // FIX 3: Currency formatting - fmtMoney is numeric only, prepend $ in display
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

  onDataChanged() {
    console.log('📈 Data changed, updating stats...');
    this.forceRefresh();
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

// FIX 3: fmtMoney returns numeric only to prevent double $$ formatting
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
  const hours = safeNumber(document.getElementById('hoursWorked')?.value);
  const rate = safeNumber(document.getElementById('baseRate')?.value);
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

// FIX 2: Student display formatting consistency
function formatStudentDisplay(student) {
  if (!student) return 'Unknown Student';
  
  // Handle different parameter types
  if (typeof student === 'string') {
    return student; // It's already a string
  }
  
  if (typeof student === 'object') {
    const name = student.name || `Student ${student.id}`;
    const id = student.id ? ` (${student.id})` : '';
    return `${name}${id}`;
  }
  
  return 'Unknown Student';
}

// FIX 1: Enhanced student lookup helper
function findStudentByNameOrId(students, identifier) {
  if (!identifier) return null;
  
  // Try to find by name first
  let student = students.find(s => s.name === identifier);
  
  // If not found by name, try by ID
  if (!student) {
    student = students.find(s => s.id === identifier);
  }
  
  return student;
}

// Debug functions
function debugStudentDropdowns() {
  console.log('🔍 DEBUG: Comprehensive student dropdown check...');
  
  const user = auth.currentUser;
  console.log('👤 User:', user ? user.email : 'No user');
  console.log('📊 Cache students:', cache.students?.length || 0);
  
  const dropdowns = [
    { id: 'hoursStudent', name: 'Hours Tab' },
    { id: 'marksStudent', name: 'Marks Tab' },
    { id: 'paymentStudent', name: 'Payments Tab' }
  ];
  
  dropdowns.forEach(dropdown => {
    const element = document.getElementById(dropdown.id);
    if (element) {
      console.log(`✅ ${dropdown.name}:`, {
        id: element.id,
        options: element.options.length,
        value: element.value,
        populated: element.options.length > 1
      });
    } else {
      console.log(`❌ ${dropdown.name}: ELEMENT NOT FOUND (looking for #${dropdown.id})`);
    }
  });
}

function manuallyRefreshStudentDropdowns() {
  console.log('🔄 Manually refreshing student dropdowns...');
  StudentDropdownManager.forceRefresh();
  debugStudentDropdowns();
}

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

function refreshTimestamp() {
  const now = new Date().toLocaleString();
  
  if (syncMessageLine) {
    syncMessageLine.textContent = `Status: Last synced at ${now}`;
  }
  
  if (document.getElementById('statUpdated')) {
    document.getElementById('statUpdated').textContent = now;
  }
  
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

      await Promise.all([
        recalcSummaryStats(user.uid),
        loadUserStats(user.uid)
      ]);

      // Refresh all UI components
      try {
        if (typeof renderStudents === 'function') await renderStudents();
        if (typeof renderOverviewReports === 'function') await renderOverviewReports();
        if (typeof renderRecentHoursWithEdit === 'function') await renderRecentHoursWithEdit();
        if (typeof renderRecentMarksWithEdit === 'function') await renderRecentMarksWithEdit();
        if (typeof renderAttendanceRecentWithEdit === 'function') await renderAttendanceRecentWithEdit();
        if (typeof renderPaymentActivityWithEdit === 'function') await renderPaymentActivityWithEdit();
        if (typeof renderStudentBalancesWithEdit === 'function') await renderStudentBalancesWithEdit();
        if (typeof populateStudentDropdowns === 'function') await populateStudentDropdowns();
      } catch (e) { console.warn('UI refresh failed:', e); }

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
      EnhancedStats.forceRefresh();

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
    defaultRate: parseFloat(localStorage.getItem('userDefaultRate')) || 0,
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
      profileDefaultRate.textContent = `$${fmtMoney(currentUserData.defaultRate || 0)}/hour`;
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

  const statStudents = document.getElementById('statStudents');
  const statHours = document.getElementById('statHours');
  const statEarnings = document.getElementById('statEarnings');
  const statUpdated = document.getElementById('statUpdated');

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
        document.getElementById('statEarnings').textContent = `$${earnings}`;
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
      if (statEarnings) statEarnings.textContent = `$${fmtMoney(newStats.earnings)}`;
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
      // FIX 2: Use formatStudentDisplay for consistent display
      const studentDisplay = formatStudentDisplay(student);
      
      studentsHTML += `
        <div class="student-card">
          <div class="student-card-header">
            <div>
              <strong>${studentDisplay}</strong>
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

// ===========================
// HOURS TAB FUNCTIONS
// ===========================

async function populateHoursStudentDropdown() {
  const dropdown = document.getElementById('hoursStudent');
  if (!dropdown) {
    console.log('❌ Hours student dropdown not found (looking for #hoursStudent)');
    return false;
  }

  try {
    const students = await EnhancedCache.loadCollection('students');
    console.log(`📝 Populating hours dropdown (#hoursStudent) with ${students.length} students`);
    
    const currentValue = dropdown.value;
    
    dropdown.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = students.length > 0 ? 'Select a student...' : 'No students available';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    dropdown.appendChild(defaultOption);
    
    students.forEach(student => {
      const studentName = student.name || `Student ${student.id}`;
      const option = document.createElement('option');
      option.value = studentName;
      option.textContent = studentName;
      option.setAttribute('data-student-id', student.id);
      dropdown.appendChild(option);
    });
    
    if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
      dropdown.value = currentValue;
    }
    
    console.log(`✅ Hours dropdown populated with ${students.length} students`);
    return true;
  } catch (error) {
    console.error('Error populating hours dropdown:', error);
    return false;
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
            <span>Rate: $${fmtMoney(entry.rate)}</span>
            <span class="hours-total">Total: $${fmtMoney(entry.total)}</span>
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

async function startEditHours(id) {
  try {
    // Ensure dropdown is populated first
    await populateHoursStudentDropdown();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const hours = await EnhancedCache.loadCollection('hours');
    const entry = hours.find(h => h.id === id);
    
    if (!entry) {
      NotificationSystem.notifyError('Hours entry not found');
      return;
    }

    currentEditHoursId = id;
    
    console.log('🔧 Starting edit for hours entry:', entry);
    
    const fields = [
      { id: 'organization', value: entry.organization || '' },
      { id: 'workType', value: entry.workType || '' },
      { id: 'workSubject', value: entry.subject || '' },
      { id: 'hoursStudent', value: entry.student || '' },
      { id: 'hoursWorked', value: entry.hours || '' },
      { id: 'baseRate', value: entry.rate || '' },
      { id: 'workDate', value: entry.date || '' },
      { id: 'notes', value: entry.notes || '' }
    ];
    
    let missingFields = [];
    
    fields.forEach(field => {
      const element = document.getElementById(field.id);
      if (element) {
        element.value = field.value;
        console.log(`✅ Set ${field.id} to:`, field.value);
      } else {
        missingFields.push(field.id);
        console.warn(`❌ Field not found: ${field.id}`);
      }
    });
    
    const studentDropdown = document.getElementById('hoursStudent');
    if (studentDropdown && studentDropdown.value === '' && entry.student) {
      console.log('🔄 Student dropdown exists but value not set, searching for option...');
      for (let option of studentDropdown.options) {
        if (option.value === entry.student) {
          studentDropdown.value = entry.student;
          console.log('✅ Found and set student option:', entry.student);
          break;
        }
      }
    }
    
    if (missingFields.length > 0) {
      console.warn('Missing form fields:', missingFields);
    }
    
    const submitBtn = document.querySelector('#hoursForm button[type="submit"]');
    if (!submitBtn) {
      console.error('❌ Submit button not found in hours form');
      NotificationSystem.notifyError('Cannot enter edit mode - form not found');
      return;
    }
    
    // FIX 4: Remove existing cancel button before adding new one
    const existingCancelBtn = document.querySelector('#hoursForm button[type="button"]');
    if (existingCancelBtn) {
      existingCancelBtn.remove();
    }
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel Edit';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.onclick = cancelEditHours;
    
    submitBtn.textContent = 'Update Hours';
    submitBtn.parentNode.appendChild(cancelBtn);
    
    NotificationSystem.notifyInfo('Edit mode activated. Update the form and click "Update Hours"');
    
  } catch (error) {
    console.error('Error starting edit:', error);
    NotificationSystem.notifyError('Failed to start editing');
  }
}

function cancelEditHours() {
  console.log('❌ Cancelling hours edit...');
  
  currentEditHoursId = null;
  
  const form = document.getElementById('hoursForm');
  if (form) {
    form.reset();
  } else {
    console.warn('❌ hoursForm not found for reset');
  }
  
  const submitBtn = document.querySelector('#hoursForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Log Hours';
  }
  
  const cancelBtn = document.querySelector('#hoursForm button[type="button"]');
  if (cancelBtn) {
    cancelBtn.remove();
  }
  
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  const rateInput = document.getElementById('baseRate');
  if (rateInput && defaultBaseRateInput) {
    rateInput.value = defaultBaseRateInput.value || currentUserData?.defaultRate || '0';
  }
  
  NotificationSystem.notifyInfo('Edit cancelled');
}

async function deleteHours(id) {
  if (!confirm('Are you sure you want to delete this hours entry?')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) return;

    const hours = await EnhancedCache.loadCollection('hours');
    const entry = hours.find(h => h.id === id);
    
    if (entry && entry._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "hours", entry._firebaseId));
    }

    const updatedHours = hours.filter(h => h.id !== id);
    cache.hours = updatedHours;
    EnhancedCache.saveToLocalStorageBulk('hours', updatedHours);

    await renderRecentHoursWithEdit();
    // FIX 4: Refresh stats after deletion
    EnhancedStats.forceRefresh();
    
    NotificationSystem.notifySuccess('Hours entry deleted successfully');
    
  } catch (error) {
    console.error('Error deleting hours:', error);
    NotificationSystem.notifyError('Failed to delete hours entry');
  }
}

async function handleHoursSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const formData = new FormData(e.target);
  const hours = safeNumber(formData.get('hoursWorked'));
  const rate = safeNumber(formData.get('baseRate'));
  const total = hours * rate;

  const hoursData = {
    organization: formData.get('organization'),
    workType: formData.get('workType'),
    subject: formData.get('workSubject'),
    student: formData.get('hoursStudent'),
    hours: hours,
    rate: rate,
    total: total,
    date: formData.get('workDate'),
    dateIso: fmtDateISO(formData.get('workDate')),
    notes: formData.get('notes')
  };

  try {
    if (currentEditHoursId) {
      const hours = await EnhancedCache.loadCollection('hours');
      const entryIndex = hours.findIndex(h => h.id === currentEditHoursId);
      
      if (entryIndex !== -1) {
        const existingEntry = hours[entryIndex];
        hoursData.id = currentEditHoursId;
        hoursData._firebaseId = existingEntry._firebaseId;
        hoursData._synced = existingEntry._synced;
        
        if (existingEntry._firebaseId) {
          await updateDoc(doc(db, "users", user.uid, "hours", existingEntry._firebaseId), hoursData);
        }
        
        hours[entryIndex] = { ...hours[entryIndex], ...hoursData };
        cache.hours = hours;
        EnhancedCache.saveToLocalStorageBulk('hours', hours);
        
        NotificationSystem.notifySuccess('Hours updated successfully');
        currentEditHoursId = null;
        
        const submitBtn = document.querySelector('#hoursForm button[type="submit"]');
        submitBtn.textContent = 'Log Hours';
        const cancelBtn = document.querySelector('#hoursForm button[type="button"]');
        if (cancelBtn) cancelBtn.remove();
        
        e.target.reset();
      }
    } else {
      await EnhancedCache.saveWithBackgroundSync('hours', hoursData);
      FormAutoClear.handleSuccess('hoursForm', { baseRate: rate });
    }
    
    // FIX 4: Refresh stats after save/update
    EnhancedStats.forceRefresh();
    await renderRecentHoursWithEdit();
    
  } catch (error) {
    console.error('Error saving hours:', error);
    NotificationSystem.notifyError('Failed to save hours');
  }
}

// ===========================
// MARKS TAB FUNCTIONS (FIXED)
// ===========================

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

    // FIX: Create a proper student map for lookup
    const studentMap = {};
    students.forEach(student => {
      studentMap[student.name || student.id] = student;
      studentMap[student.id] = student; // Also map by ID for backward compatibility
    });

    let marksHTML = '';
    sortedMarks.slice(0, limit).forEach(entry => {
      // FIX: Better student lookup - try by name first, then by ID
      let student = studentMap[entry.student];
      if (!student && entry.student) {
        // If not found by name, try to find by ID in the students array
        student = students.find(s => s.id === entry.student) || { name: entry.student, id: 'N/A' };
      }
      
      const studentDisplay = formatStudentDisplay(student || { name: entry.student, id: 'N/A' });
      
      marksHTML += `
        <div class="mark-entry" id="mark-entry-${entry.id}">
          <div class="mark-header">
            <strong>${studentDisplay}</strong>
            — ${entry.subject || 'No Subject'} (${entry.topic || 'No Topic'})
            <div class="student-actions">
              <button class="btn-icon" onclick="startEditMark('${entry.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteMark('${entry.id}')" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="muted">${formatDate(entry.date)}</div>
          <div>Score: ${safeNumber(entry.score)}/${safeNumber(entry.max)} — ${safeNumber(entry.percentage).toFixed(1)}% — Grade: ${entry.grade || 'N/A'}</div>
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

// FIX: Add real-time percentage and grade calculation
function calculateMarkPercentage() {
  const score = safeNumber(document.getElementById('marksScore')?.value);
  const max = safeNumber(document.getElementById('marksMax')?.value);
  
  let percentage = 0;
  let grade = 'N/A';
  
  if (max > 0) {
    percentage = (score / max) * 100;
    grade = calculateGrade(percentage);
  }
  
  // Update display elements if they exist
  const percentageDisplay = document.getElementById('marksPercentageDisplay');
  const gradeDisplay = document.getElementById('marksGradeDisplay');
  
  if (percentageDisplay) {
    percentageDisplay.textContent = `${percentage.toFixed(1)}%`;
  }
  
  if (gradeDisplay) {
    gradeDisplay.textContent = grade;
  }
  
  return { percentage, grade };
}

// FIX: Enhanced mark edit function with proper form handling
async function startEditMark(id) {
  try {
    console.log('🔧 Starting mark edit for:', id);
    
    const marks = await EnhancedCache.loadCollection('marks');
    const entry = marks.find(m => m.id === id);
    
    if (!entry) {
      NotificationSystem.notifyError('Mark entry not found');
      return;
    }

    currentEditMarksId = id;
    
    console.log('📝 Editing mark entry:', entry);
    
    // FIX: Set form values
    document.getElementById('marksStudent').value = entry.student || '';
    document.getElementById('marksSubject').value = entry.subject || '';
    document.getElementById('marksTopic').value = entry.topic || '';
    document.getElementById('marksScore').value = entry.score || '';
    document.getElementById('marksMax').value = entry.max || '';
    document.getElementById('marksDate').value = entry.date || '';
    document.getElementById('marksNotes').value = entry.notes || '';
    
    // FIX: Update percentage and grade display
    const percentageDisplay = document.getElementById('marksPercentageDisplay');
    const gradeDisplay = document.getElementById('marksGradeDisplay');
    if (percentageDisplay) {
      percentageDisplay.textContent = `${safeNumber(entry.percentage).toFixed(1)}%`;
    }
    if (gradeDisplay) {
      gradeDisplay.textContent = entry.grade || 'N/A';
    }
    
    const submitBtn = document.querySelector('#marksForm button[type="submit"]');
    if (!submitBtn) {
      console.error('❌ Submit button not found in marks form');
      return;
    }
    
    // FIX: Remove existing cancel button before adding new one
    const existingCancelBtn = document.querySelector('#marksForm button[type="button"]');
    if (existingCancelBtn) {
      existingCancelBtn.remove();
    }
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel Edit';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.onclick = cancelEditMark;
    
    submitBtn.textContent = 'Update Mark';
    submitBtn.parentNode.appendChild(cancelBtn);
    
    // FIX: Scroll to form
    const marksForm = document.getElementById('marksForm');
    if (marksForm) {
      marksForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    NotificationSystem.notifyInfo('Edit mode activated. Update the form and click "Update Mark"');
    
  } catch (error) {
    console.error('Error starting mark edit:', error);
    NotificationSystem.notifyError('Failed to start editing');
  }
}

// FIX: Enhanced cancel edit function
function cancelEditMark() {
  console.log('❌ Cancelling mark edit...');
  
  currentEditMarksId = null;
  
  const form = document.getElementById('marksForm');
  if (form) {
    form.reset();
  } else {
    console.warn('❌ marksForm not found for reset');
  }
  
  const submitBtn = document.querySelector('#marksForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Add Mark';
  }
  
  const cancelBtn = document.querySelector('#marksForm button[type="button"]');
  if (cancelBtn) {
    cancelBtn.remove();
  }
  
  // FIX: Reset percentage and grade display
  const percentageDisplay = document.getElementById('marksPercentageDisplay');
  const gradeDisplay = document.getElementById('marksGradeDisplay');
  if (percentageDisplay) percentageDisplay.textContent = '0%';
  if (gradeDisplay) gradeDisplay.textContent = 'N/A';
  
  NotificationSystem.notifyInfo('Edit cancelled');
}

// FIX: Enhanced delete mark function
async function deleteMark(id) {
  if (!confirm('Are you sure you want to delete this mark?')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete marks');
      return;
    }

    const marks = await EnhancedCache.loadCollection('marks');
    const entry = marks.find(m => m.id === id);
    
    if (!entry) {
      NotificationSystem.notifyError('Mark entry not found');
      return;
    }

    // FIX: Delete from Firestore if it exists there
    if (entry._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "marks", entry._firebaseId));
      console.log('✅ Deleted mark from Firestore:', entry._firebaseId);
    }

    // FIX: Update local cache
    const updatedMarks = marks.filter(m => m.id !== id);
    cache.marks = updatedMarks;
    EnhancedCache.saveToLocalStorageBulk('marks', updatedMarks);

    // FIX: Refresh UI
    await renderRecentMarksWithEdit();
    
    // FIX: Refresh stats
    EnhancedStats.forceRefresh();
    
    NotificationSystem.notifySuccess('Mark deleted successfully');
    
  } catch (error) {
    console.error('Error deleting mark:', error);
    NotificationSystem.notifyError('Failed to delete mark');
  }
}

// FIX: Enhanced marks submit handler
async function handleMarksSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to save marks');
    return;
  }

  const formData = new FormData(e.target);
  const score = safeNumber(formData.get('marksScore'));
  const max = safeNumber(formData.get('marksMax'));
  
  // FIX: Validate inputs
  if (score < 0 || max <= 0) {
    NotificationSystem.notifyError('Please enter valid score and maximum values');
    return;
  }
  
  const percentage = max > 0 ? (score / max) * 100 : 0;
  const grade = calculateGrade(percentage);

  const marksData = {
    student: formData.get('marksStudent'),
    subject: formData.get('marksSubject'),
    topic: formData.get('marksTopic'),
    score: score,
    max: max,
    percentage: percentage,
    grade: grade,
    date: formData.get('marksDate'),
    dateIso: fmtDateISO(formData.get('marksDate')),
    notes: formData.get('marksNotes')
  };

  // FIX: Validate required fields
  if (!marksData.student) {
    NotificationSystem.notifyError('Please select a student');
    return;
  }

  if (!marksData.subject) {
    NotificationSystem.notifyError('Please enter a subject');
    return;
  }

  try {
    if (currentEditMarksId) {
      // FIX: Update existing mark
      const marks = await EnhancedCache.loadCollection('marks');
      const entryIndex = marks.findIndex(m => m.id === currentEditMarksId);
      
      if (entryIndex !== -1) {
        const existingEntry = marks[entryIndex];
        marksData.id = currentEditMarksId;
        marksData._firebaseId = existingEntry._firebaseId;
        marksData._synced = existingEntry._synced;
        
        // FIX: Update in Firestore if it exists there
        if (existingEntry._firebaseId) {
          await updateDoc(doc(db, "users", user.uid, "marks", existingEntry._firebaseId), marksData);
          console.log('✅ Updated mark in Firestore:', existingEntry._firebaseId);
        }
        
        // FIX: Update local cache
        marks[entryIndex] = { ...marks[entryIndex], ...marksData };
        cache.marks = marks;
        EnhancedCache.saveToLocalStorageBulk('marks', marks);
        
        NotificationSystem.notifySuccess('Mark updated successfully');
        currentEditMarksId = null;
        
        // FIX: Reset form and UI
        const submitBtn = document.querySelector('#marksForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Add Mark';
        
        const cancelBtn = document.querySelector('#marksForm button[type="button"]');
        if (cancelBtn) cancelBtn.remove();
        
        e.target.reset();
        
        // FIX: Reset percentage and grade display
        const percentageDisplay = document.getElementById('marksPercentageDisplay');
        const gradeDisplay = document.getElementById('marksGradeDisplay');
        if (percentageDisplay) percentageDisplay.textContent = '0%';
        if (gradeDisplay) gradeDisplay.textContent = 'N/A';
      } else {
        NotificationSystem.notifyError('Mark entry not found for editing');
        return;
      }
    } else {
      // FIX: Add new mark
      const result = await EnhancedCache.saveWithBackgroundSync('marks', marksData);
      if (result) {
        FormAutoClear.handleSuccess('marksForm');
        console.log('✅ New mark saved with ID:', result);
      } else {
        NotificationSystem.notifyError('Failed to save mark');
        return;
      }
    }
    
    // FIX: Refresh stats and UI
    EnhancedStats.forceRefresh();
    await renderRecentMarksWithEdit();
    
  } catch (error) {
    console.error('Error saving mark:', error);
    NotificationSystem.notifyError('Failed to save mark: ' + error.message);
  }
}

// ===========================
// MARKS FORM SETUP ENHANCEMENTS
// ===========================

function setupMarksFormHandlers() {
  const marksForm = document.getElementById('marksForm');
  if (!marksForm) return;

  // FIX: Add real-time calculation listeners
  const scoreInput = document.getElementById('marksScore');
  const maxInput = document.getElementById('marksMax');
  
  if (scoreInput) {
    scoreInput.addEventListener('input', calculateMarkPercentage);
  }
  
  if (maxInput) {
    maxInput.addEventListener('input', calculateMarkPercentage);
  }

  // FIX: Ensure form submission is handled
  marksForm.addEventListener('submit', handleMarksSubmit);
  
  // FIX: Initialize percentage and grade display
  const percentageDisplay = document.getElementById('marksPercentageDisplay');
  const gradeDisplay = document.getElementById('marksGradeDisplay');
  
  if (!percentageDisplay) {
    // Create percentage display if it doesn't exist
    const scoreGroup = document.querySelector('#marksScore').closest('.form-group');
    if (scoreGroup) {
      const percentageDiv = document.createElement('div');
      percentageDiv.className = 'form-group';
      percentageDiv.innerHTML = `
        <label>Percentage & Grade:</label>
        <div style="display: flex; gap: 10px; align-items: center;">
          <span id="marksPercentageDisplay" style="font-weight: bold; color: var(--primary);">0%</span>
          <span id="marksGradeDisplay" style="font-weight: bold; color: var(--secondary);">N/A</span>
        </div>
      `;
      scoreGroup.parentNode.insertBefore(percentageDiv, scoreGroup.nextSibling);
    }
  }
  
  console.log('✅ Marks form handlers setup complete');
}

// ===========================
// UPDATE FORM SETUP HANDLERS TO INCLUDE MARKS
// ===========================

function setupFormHandlers() {
  console.log('🔧 Setting up form handlers with enhanced marks support...');
  
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
    
    const baseRateInput = document.getElementById('baseRate');
    const defaultBaseRateInput = document.getElementById('defaultBaseRate');
    const hoursInput = document.getElementById('hoursWorked');
    const studentDropdown = document.getElementById('hoursStudent');
    
    if (baseRateInput && defaultBaseRateInput && !baseRateInput.value) {
      baseRateInput.value = defaultBaseRateInput.value || currentUserData?.defaultRate || '0';
    }
    
    if (hoursInput) hoursInput.addEventListener('input', calculateTotalPay);
    if (baseRateInput) baseRateInput.addEventListener('input', calculateTotalPay);
    
    const hoursTab = document.querySelector('[data-tab="hours"]');
    if (hoursTab) {
      hoursTab.addEventListener('click', async () => {
        console.log('🎯 Hours tab activated, populating student dropdown...');
        setTimeout(async () => {
          await StudentDropdownManager.forceRefresh();
          await populateHoursStudentDropdown();
        }, 300);
      });
    }
    
    if (studentDropdown) {
      studentDropdown.addEventListener('focus', async () => {
        console.log('🎯 Hours form student dropdown focused');
        await StudentDropdownManager.refreshAllDropdowns();
      });
    }
    
    calculateTotalPay();
  }
  
  // FIX: Enhanced marks form setup
  const marksForm = document.getElementById('marksForm');
  if (marksForm) {
    setupMarksFormHandlers();
    
    const studentDropdown = document.getElementById('marksStudent');
    if (studentDropdown) {
      studentDropdown.addEventListener('focus', async () => {
        console.log('🎯 Marks form student dropdown focused');
        await StudentDropdownManager.refreshAllDropdowns();
      });
    }
    
    // FIX: Initialize percentage calculation on marks tab activation
    const marksTab = document.querySelector('[data-tab="marks"]');
    if (marksTab) {
      marksTab.addEventListener('click', () => {
        setTimeout(() => {
          calculateMarkPercentage(); // Initialize display
        }, 300);
      });
    }
  }
  
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', handleAttendanceSubmit);
    
    const attendanceTab = document.querySelector('[data-tab="attendance"]');
    if (attendanceTab) {
      attendanceTab.addEventListener('click', async () => {
        setTimeout(async () => {
          console.log('🎯 Attendance tab opened, setting up enhanced features...');
          await StudentDropdownManager.refreshAllDropdowns();
          setupAttendanceTab();
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
  
  setupFormStudentPopulation();
  
  console.log('✅ All form handlers with enhanced marks support initialized');
}

// ===========================
// UPDATE INITIALIZATION TO SETUP MARKS FORM
// ===========================

// Add this to your existing initialization code
function initializeMarksTab() {
  console.log('🎯 Initializing marks tab features...');
  
  // Setup real-time percentage calculation
  setupMarksFormHandlers();
  
  // Ensure percentage display is initialized
  setTimeout(() => {
    calculateMarkPercentage();
  }, 1000);
}

// Update your main initialization to call this
// In your existing initializeApp function, add:
// initializeMarksTab();

// ===========================
// ATTENDANCE TAB FUNCTIONS
// ===========================

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
      // FIX 2: Use formatStudentDisplay for consistent display
      const studentDisplay = formatStudentDisplay(student);
      
      const container = document.createElement('div');
      container.style.cssText = 'display: flex; align-items: center; gap: 12px; margin: 8px 0; padding: 12px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border);';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'presentStudents';
      checkbox.value = student.name || student.id;
      checkbox.id = `attendance-${student.id}`;
      checkbox.style.cssText = 'width: 18px; height: 18px;';
      
      const label = document.createElement('label');
      label.htmlFor = `attendance-${student.id}`;
      label.textContent = studentDisplay;
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
  } catch (error) {
    console.error('Error populating attendance students:', error);
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

async function startEditAttendance(id) {
  try {
    const attendance = await EnhancedCache.loadCollection('attendance');
    const entry = attendance.find(a => a.id === id);
    
    if (!entry) {
      NotificationSystem.notifyError('Attendance record not found');
      return;
    }

    currentEditAttendanceId = id;
    
    document.getElementById('attendanceSubject').value = entry.subject || '';
    document.getElementById('attendanceTopic').value = entry.topic || '';
    document.getElementById('attendanceDate').value = entry.date || '';
    document.getElementById('attendanceNotes').value = entry.notes || '';
    
    await populateAttendanceStudents();
    
    if (Array.isArray(entry.present)) {
      entry.present.forEach(studentName => {
        const checkbox = document.querySelector(`input[value="${studentName}"]`);
        if (checkbox) {
          checkbox.checked = true;
          checkbox.parentElement.style.backgroundColor = 'var(--primary-light)';
          checkbox.parentElement.classList.add('selected');
        }
      });
    }
    
    const submitBtn = document.querySelector('#attendanceForm button[type="submit"]');
    // FIX 4: Remove existing cancel button before adding new one
    const existingCancelBtn = document.querySelector('#attendanceForm button[type="button"]');
    if (existingCancelBtn) {
      existingCancelBtn.remove();
    }
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel Edit';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.onclick = cancelEditAttendance;
    
    submitBtn.textContent = 'Update Attendance';
    submitBtn.parentNode.appendChild(cancelBtn);
    
    NotificationSystem.notifyInfo('Edit mode activated. Update the form and click "Update Attendance"');
    
  } catch (error) {
    console.error('Error starting attendance edit:', error);
    NotificationSystem.notifyError('Failed to start editing');
  }
}

function cancelEditAttendance() {
  currentEditAttendanceId = null;
  const form = document.getElementById('attendanceForm');
  form.reset();
  
  const submitBtn = document.querySelector('#attendanceForm button[type="submit"]');
  submitBtn.textContent = 'Record Attendance';
  
  const cancelBtn = document.querySelector('#attendanceForm button[type="button"]');
  if (cancelBtn) cancelBtn.remove();
  
  const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
    if (checkbox.parentElement) {
      checkbox.parentElement.style.backgroundColor = '';
      checkbox.parentElement.classList.remove('selected');
    }
  });
  
  NotificationSystem.notifyInfo('Edit cancelled');
}

async function deleteAttendance(id) {
  if (!confirm('Are you sure you want to delete this attendance record?')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) return;

    const attendance = await EnhancedCache.loadCollection('attendance');
    const entry = attendance.find(a => a.id === id);
    
    if (entry && entry._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "attendance", entry._firebaseId));
    }

    const updatedAttendance = attendance.filter(a => a.id !== id);
    cache.attendance = updatedAttendance;
    EnhancedCache.saveToLocalStorageBulk('attendance', updatedAttendance);

    await renderAttendanceRecentWithEdit();
    // FIX 4: Refresh stats after deletion
    EnhancedStats.forceRefresh();
    
    NotificationSystem.notifySuccess('Attendance record deleted successfully');
    
  } catch (error) {
    console.error('Error deleting attendance:', error);
    NotificationSystem.notifyError('Failed to delete attendance record');
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
    if (currentEditAttendanceId) {
      const attendance = await EnhancedCache.loadCollection('attendance');
      const entryIndex = attendance.findIndex(a => a.id === currentEditAttendanceId);
      
      if (entryIndex !== -1) {
        const existingEntry = attendance[entryIndex];
        attendanceData.id = currentEditAttendanceId;
        attendanceData._firebaseId = existingEntry._firebaseId;
        attendanceData._synced = existingEntry._synced;
        
        if (existingEntry._firebaseId) {
          await updateDoc(doc(db, "users", user.uid, "attendance", existingEntry._firebaseId), attendanceData);
        }
        
        attendance[entryIndex] = { ...attendance[entryIndex], ...attendanceData };
        cache.attendance = attendance;
        EnhancedCache.saveToLocalStorageBulk('attendance', attendance);
        
        NotificationSystem.notifySuccess('Attendance updated successfully');
        currentEditAttendanceId = null;
        
        const submitBtn = document.querySelector('#attendanceForm button[type="submit"]');
        submitBtn.textContent = 'Record Attendance';
        const cancelBtn = document.querySelector('#attendanceForm button[type="button"]');
        if (cancelBtn) cancelBtn.remove();
        
        e.target.reset();
      }
    } else {
      await EnhancedCache.saveWithBackgroundSync('attendance', attendanceData);
      FormAutoClear.handleSuccess('attendanceForm');
    }
    
    // FIX 4: Refresh stats after save/update
    EnhancedStats.forceRefresh();
    await renderAttendanceRecentWithEdit();
    
  } catch (error) {
    console.error('Error saving attendance:', error);
    NotificationSystem.notifyError('Failed to save attendance');
  }
}

// ===========================
// PAYMENT MANAGEMENT FUNCTIONS
// ===========================

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
            <strong>$${fmtMoney(entry.amount)}</strong> — ${entry.student || 'Unknown Student'}
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

// FIX 1 & 2: Student balances with consistent identification and display
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

    // FIX 1: Use student IDs as keys instead of names to prevent merging issues
    const earningsByStudentId = {};
    const paymentsByStudentId = {};
    
    hours.forEach(entry => {
      const studentName = entry.student;
      if (studentName) {
        const student = findStudentByNameOrId(students, studentName);
        if (student) {
          const earnings = entry.total || (entry.hours || 0) * (entry.rate || 0);
          earningsByStudentId[student.id] = (earningsByStudentId[student.id] || 0) + safeNumber(earnings);
        }
      }
    });

    payments.forEach(payment => {
      const studentName = payment.student;
      if (studentName) {
        const student = findStudentByNameOrId(students, studentName);
        if (student) {
          paymentsByStudentId[student.id] = (paymentsByStudentId[student.id] || 0) + safeNumber(payment.amount);
        }
      }
    });

    let balancesHTML = '';
    let totalOwed = 0;

    students.forEach(student => {
      const earned = earningsByStudentId[student.id] || 0;
      const paid = paymentsByStudentId[student.id] || 0;
      const owed = Math.max(earned - paid, 0);
      totalOwed += owed;

      // FIX 2: Use formatStudentDisplay for consistent display
      const studentDisplay = formatStudentDisplay(student);

      balancesHTML += `
        <div class="activity-item" id="balance-${student.id}">
          <div>
            <strong>${studentDisplay}</strong>
            <div class="student-actions" style="display: inline-block; margin-left: 10px;">
              <button class="btn-icon" onclick="quickAddPayment('${student.name || student.id}')" title="Add Payment">💰</button>
            </div>
          </div>
          <div class="muted">
            Earned: $${fmtMoney(earned)} | 
            Paid: $${fmtMoney(paid)} | 
            <strong>Owed: $${fmtMoney(owed)}</strong>
          </div>
        </div>
      `;
    });

    container.innerHTML = balancesHTML;

    const totalOwedEl = document.getElementById('totalOwed');
    const totalStudentsCountEl = document.getElementById('totalStudentsCount');
    
    if (totalOwedEl) totalOwedEl.textContent = `$${fmtMoney(totalOwed)}`;
    if (totalStudentsCountEl) totalStudentsCountEl.textContent = students.length;

    // FIX 4: Refresh stats to stay in sync
    EnhancedStats.forceRefresh();

    console.log(`✅ Rendered balances for ${students.length} students, total owed: $${fmtMoney(totalOwed)}`);

  } catch (error) {
    console.error("Error rendering student balances:", error);
    container.innerHTML = '<div class="error">Error loading student balances</div>';
  }
}

async function startEditPayment(id) {
  try {
    const payments = await EnhancedCache.loadCollection('payments');
    const entry = payments.find(p => p.id === id);
    
    if (!entry) {
      NotificationSystem.notifyError('Payment not found');
      return;
    }

    currentEditPaymentId = id;
    
    document.getElementById('paymentStudent').value = entry.student || '';
    document.getElementById('paymentAmount').value = entry.amount || '';
    document.getElementById('paymentMethod').value = entry.method || '';
    document.getElementById('paymentDate').value = entry.date || '';
    document.getElementById('paymentNotes').value = entry.notes || '';
    
    const submitBtn = document.querySelector('#paymentForm button[type="submit"]');
    // FIX 4: Remove existing cancel button before adding new one
    const existingCancelBtn = document.querySelector('#paymentForm button[type="button"]');
    if (existingCancelBtn) {
      existingCancelBtn.remove();
    }
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel Edit';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.onclick = cancelEditPayment;
    
    submitBtn.textContent = 'Update Payment';
    submitBtn.parentNode.appendChild(cancelBtn);
    
    NotificationSystem.notifyInfo('Edit mode activated. Update the form and click "Update Payment"');
    
  } catch (error) {
    console.error('Error starting payment edit:', error);
    NotificationSystem.notifyError('Failed to start editing');
  }
}

function cancelEditPayment() {
  currentEditPaymentId = null;
  const form = document.getElementById('paymentForm');
  form.reset();
  
  const submitBtn = document.querySelector('#paymentForm button[type="submit"]');
  submitBtn.textContent = 'Record Payment';
  
  const cancelBtn = document.querySelector('#paymentForm button[type="button"]');
  if (cancelBtn) cancelBtn.remove();
  
  NotificationSystem.notifyInfo('Edit cancelled');
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
    // FIX 4: Refresh stats after deletion
    EnhancedStats.forceRefresh();
    
    NotificationSystem.notifySuccess('Payment deleted successfully');
    
  } catch (error) {
    console.error('Error deleting payment:', error);
    NotificationSystem.notifyError('Failed to delete payment');
  }
}

function quickAddPayment(studentName) {
  document.getElementById('paymentStudent').value = studentName;
  document.getElementById('paymentAmount').focus();
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
      FormAutoClear.handleSuccess('paymentForm');
    }
    
    // FIX 4: Refresh stats after save/update
    EnhancedStats.forceRefresh();
    await renderPaymentActivityWithEdit();
    await renderStudentBalancesWithEdit();
    
  } catch (error) {
    console.error('Error saving payment:', error);
    NotificationSystem.notifyError('Failed to save payment');
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
        // FIX 4: Refresh stats after student creation
        EnhancedStats.forceRefresh();
        
        setTimeout(() => {
            populateStudentDropdowns();
        }, 500);
        
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
    document.addEventListener('click', (e) => {
      if (e.target.matches('.tab[data-tab]')) {
        const tabName = e.target.getAttribute('data-tab');
        console.log(`📑 Tab changed to: ${tabName}`);
        setTimeout(() => this.refreshAllDropdowns(), 300);
      }
    });
  },
  
  async refreshAllDropdowns() {
    console.log('🔄 StudentDropdownManager: Refreshing all dropdowns...');
    await populateStudentDropdowns();
    this.enhanceDropdownBehavior();
  },
  
  enhanceDropdownBehavior() {
    const dropdownSelectors = [
      '#hoursStudent',
      '#marksStudent', 
      '#paymentStudent'
    ];
    
    this.dropdowns = [];
    dropdownSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el && !this.dropdowns.includes(el)) {
          this.dropdowns.push(el);
        }
      });
    });
    
    console.log(`✅ Enhanced ${this.dropdowns.length} student dropdowns`);
  },
  
  async forceRefresh() {
    console.log('🔄 StudentDropdownManager: Force refreshing all dropdowns...');
    
    const students = await EnhancedCache.loadCollection('students', true);
    
    if (students.length === 0) {
      console.log('❌ No students found to populate dropdowns');
      return;
    }
    
    const dropdownSelectors = ['#hoursStudent', '#marksStudent', '#paymentStudent'];
    const dropdowns = [];
    
    dropdownSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el) dropdowns.push(el);
      });
    });
    
    console.log(`🎯 Found ${dropdowns.length} dropdowns to populate with ${students.length} students`);
    
    dropdowns.forEach(dropdown => {
      this.populateDropdown(dropdown, students);
    });
    
    console.log('✅ Force refresh completed');
  },
  
  populateDropdown(dropdown, students) {
    if (!dropdown) {
      console.log('❌ Dropdown element is null');
      return;
    }
    
    console.log(`📝 Populating ${dropdown.id} with ${students.length} students`);
    
    const currentValue = dropdown.value;
    
    dropdown.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = students.length > 0 ? 'Select a student...' : 'No students available';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    dropdown.appendChild(defaultOption);
    
    students.forEach(student => {
      const studentName = student.name || `Student ${student.id}`;
      const option = document.createElement('option');
      option.value = studentName;
      option.textContent = studentName;
      option.setAttribute('data-student-id', student.id);
      dropdown.appendChild(option);
    });
    
    if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
      dropdown.value = currentValue;
    }
    
    console.log(`✅ ${dropdown.id} populated with ${students.length} options`);
  }
};

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

    const dropdownSelectors = [
      '#hoursStudent',
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
        if (el && !dropdowns.includes(el)) {
          dropdowns.push(el);
        }
      });
    });

    console.log(`🎯 Found ${dropdowns.length} student dropdowns to populate`);

    dropdowns.forEach(dropdown => {
      populateSingleDropdown(dropdown, students);
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
  const currentIndex = dropdown.selectedIndex;
  
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
    option.setAttribute('data-student-id', student.id);
    dropdown.appendChild(option);
  });

  if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
    dropdown.value = currentValue;
  } else if (currentIndex > 0 && dropdown.options.length > currentIndex) {
    dropdown.selectedIndex = currentIndex;
  }

  dropdown.style.borderColor = '#10b981';
  setTimeout(() => {
    dropdown.style.borderColor = '';
  }, 1000);

  console.log(`✅ Populated ${dropdown.id || dropdown.name} with ${students.length} students`);
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
  console.log('🔧 Setting up form handlers with enhanced attendance support...');
  
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
    
    const baseRateInput = document.getElementById('baseRate');
    const defaultBaseRateInput = document.getElementById('defaultBaseRate');
    const hoursInput = document.getElementById('hoursWorked');
    const studentDropdown = document.getElementById('hoursStudent');
    
    if (baseRateInput && defaultBaseRateInput && !baseRateInput.value) {
      baseRateInput.value = defaultBaseRateInput.value || currentUserData?.defaultRate || '0';
    }
    
    if (hoursInput) hoursInput.addEventListener('input', calculateTotalPay);
    if (baseRateInput) baseRateInput.addEventListener('input', calculateTotalPay);
    
    const hoursTab = document.querySelector('[data-tab="hours"]');
    if (hoursTab) {
      hoursTab.addEventListener('click', async () => {
        console.log('🎯 Hours tab activated, populating student dropdown...');
        setTimeout(async () => {
          await StudentDropdownManager.forceRefresh();
          await populateHoursStudentDropdown();
        }, 300);
      });
    }
    
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
    
    const attendanceTab = document.querySelector('[data-tab="attendance"]');
    if (attendanceTab) {
      attendanceTab.addEventListener('click', async () => {
        setTimeout(async () => {
          console.log('🎯 Attendance tab opened, setting up enhanced features...');
          await StudentDropdownManager.refreshAllDropdowns();
          setupAttendanceTab();
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
  
  setupFormStudentPopulation();
  
  console.log('✅ All form handlers with enhanced attendance support initialized');
}

function setupFormStudentPopulation() {
  console.log('🔧 Setting up student form population...');
  
  if (Array.isArray(cache.students) && cache.students.length > 0) {
    setTimeout(() => populateStudentDropdowns(), 1000);
  }
  
  const formTabs = ['hours', 'marks', 'attendance', 'payments'];
  formTabs.forEach(tabName => {
    const tab = document.querySelector(`[data-tab="${tabName}"]`);
    if (tab) {
      tab.addEventListener('click', () => {
        setTimeout(async () => {
          console.log(`🎯 ${tabName} tab activated, refreshing dropdowns...`);
          await StudentDropdownManager.refreshAllDropdowns();
          
          if (tabName === 'attendance') {
            setupAttendanceTab();
          }
        }, 300);
      });
    }
  });
}

function setupAttendanceTab() {
  console.log('🎯 Setting up enhanced attendance features...');
  
  setTimeout(() => {
    setupAttendanceSelectAll();
    setupAttendanceCheckboxListeners();
    updateSelectAllButtonState();
  }, 500);
}

function setupAttendanceSelectAll() {
  const selectAllBtn = document.getElementById('selectAllStudentsBtn');
  
  if (!selectAllBtn) {
    console.warn('⚠️ Select All button not found in DOM');
    return;
  }

  console.log('✅ Setting up Select All button with event listener...');

  const newSelectAllBtn = selectAllBtn.cloneNode(true);
  selectAllBtn.parentNode.replaceChild(newSelectAllBtn, selectAllBtn);

  newSelectAllBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 Select All button clicked via event listener');
    selectAllStudents();
  });

  newSelectAllBtn.addEventListener('mouseenter', function() {
    this.style.transform = 'translateY(-1px)';
    this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
  });

  newSelectAllBtn.addEventListener('mouseleave', function() {
    this.style.transform = 'translateY(0)';
    this.style.boxShadow = 'none';
  });

  updateSelectAllButtonState();
  
  console.log('✅ Select All button setup complete with event listeners');
}

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
    const newCheckbox = checkbox.cloneNode(true);
    checkbox.parentNode.replaceChild(newCheckbox, checkbox);

    newCheckbox.addEventListener('change', function() {
      if (this.checked) {
        this.parentElement.style.backgroundColor = 'var(--primary-light)';
        this.parentElement.classList.add('selected');
      } else {
        this.parentElement.style.backgroundColor = '';
        this.parentElement.classList.remove('selected');
      }
      
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
  
  const selectedCount = Array.from(checkboxes).filter(checkbox => checkbox.checked).length;
  const allSelected = selectedCount === checkboxes.length;
  const someSelected = selectedCount > 0 && selectedCount < checkboxes.length;
  
  let action;
  let message;
  
  if (allSelected || someSelected) {
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      checkbox.parentElement.style.backgroundColor = '';
    });
    action = 'deselected';
    message = `Deselected all ${checkboxes.length} students`;
    console.log('✅ All students deselected');
    NotificationSystem.notifyInfo(message);
  } else {
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      checkbox.parentElement.style.backgroundColor = 'var(--primary-light)';
    });
    action = 'selected';
    message = `Selected all ${checkboxes.length} students`;
    console.log(`✅ All ${checkboxes.length} students selected`);
    NotificationSystem.notifySuccess(message);
  }
  
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

function getSelectedStudentsCount() {
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (!attendanceContainer) return 0;
  
  const checkboxes = attendanceContainer.querySelectorAll('input[type="checkbox"][name="presentStudents"]');
  return Array.from(checkboxes).filter(checkbox => checkbox.checked).length;
}

function clearAttendanceForm() {
  const form = document.getElementById('attendanceForm');
  if (form) {
    form.reset();
    
    const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      if (checkbox.parentElement) {
        checkbox.parentElement.style.backgroundColor = '';
        checkbox.parentElement.classList.remove('selected');
      }
    });
    
    updateSelectAllButton(false);
    
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    NotificationSystem.notifyInfo('Attendance form cleared');
  }
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
  const baseRateInput = document.getElementById('baseRate');
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  
  if (baseRateInput && defaultBaseRateInput) {
    baseRateInput.value = defaultBaseRateInput.value;
    NotificationSystem.notifyInfo('Default rate applied to hours form');
    calculateTotalPay();
  }
}

// ===========================
// TAB NAVIGATION SYSTEM
// ===========================

function setupTabNavigation() {
  console.log('🔧 Setting up tab navigation...');
  
  injectTabCSS();
  
  const tabButtons = document.querySelectorAll('.tab[data-tab]');
  console.log(`✅ Found ${tabButtons.length} tab buttons`);
  
  tabButtons.forEach(button => {
    const tabName = button.getAttribute('data-tab');
    console.log(`📝 Setting up: ${tabName}`);
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchTab(tabName);
      
      // Auto-fix: When hours tab is clicked, fix the dropdown
      if (tabName === 'hours') {
        console.log('🎯 Hours tab clicked, fixing dropdown...');
        setTimeout(() => {
          populateHoursStudentDropdown();
        }, 500);
      }
    });
  });
  
  const initialTab = getInitialTab();
  console.log(`📑 Initial tab: ${initialTab}`);
  setTimeout(() => {
    switchTab(initialTab);
    if (initialTab === 'hours') {
      setTimeout(() => populateHoursStudentDropdown(), 1000);
    }
  }, 100);
}

function injectTabCSS() {
  if (!document.querySelector('#tab-css-fixed')) {
    const style = document.createElement('style');
    style.id = 'tab-css-fixed';
    style.textContent = `
      .tabcontent {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
      
      .tabcontent.active {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        overflow: visible !important;
      }
      
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
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) return hash;
  
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) return activeTab.getAttribute('data-tab');
  
  return 'students';
}

function switchTab(tabName) {
  console.log(`🔄 Switching to: ${tabName}`);
  
  if (!tabName) {
    console.error('❌ No tab name provided');
    return;
  }
  
  window.location.hash = tabName;
  
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeButtons = document.querySelectorAll(`.tab[data-tab="${tabName}"]`);
  activeButtons.forEach(btn => {
    btn.classList.add('active');
  });
  
  const allTabContents = document.querySelectorAll('.tabcontent');
  console.log(`📊 Hiding ${allTabContents.length} tabcontent elements`);
  
  allTabContents.forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
    content.style.visibility = 'hidden';
    content.style.opacity = '0';
    content.style.height = '0';
    content.style.overflow = 'hidden';
  });
  
  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.classList.add('active');
    targetTab.style.display = 'block';
    targetTab.style.visibility = 'visible';
    targetTab.style.opacity = '1';
    targetTab.style.height = 'auto';
    targetTab.style.overflow = 'visible';
    
    console.log(`✅ Successfully showing: ${tabName}`);
  } else {
    console.error(`❌ Tab content not found: ${tabName}`);
  }
  
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

  const today = new Date();
  const startDate = getStartOfWeek(today);
  const endDate = getEndOfWeek(today);
  
  generateWeeklyReport(startDate, endDate);
  
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

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 13);
  
  generateBiWeeklyReport(startDate, endDate);
  
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

  const today = new Date();
  const startDate = getStartOfMonth(today);
  const endDate = getEndOfMonth(today);
  
  generateMonthlyReport(startDate, endDate);
  
  setTimeout(() => {
    if (confirm('Would you like to generate a report for a different month?')) {
      const modal = createDateSelectionModal('monthly', (selectedDate) => {
        const customStartDate = getStartOfMonth(selectedDate);
        const customEndDate = getEndOfMonth(selectedDate);
        
        generateMonthlyReport(customStartDate, customEndDate);
      }, true);
      
      document.body.appendChild(modal);
    }
  }, 1000);
}

function showSubjectBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  const today = new Date();
  const startDate = getStartOfMonth(today);
  const endDate = getEndOfMonth(today);
  
  generateSubjectReport(startDate, endDate);
  
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
    const customStartDate = new Date(startDateInput.value);
    const customEndDate = new Date(endDateInput.value);
    customEndDate.setHours(23, 59, 59, 999);
    
    onConfirm(customStartDate, customEndDate);
    document.body.removeChild(modal);
  };
  
  cancelBtn.onclick = () => {
    document.body.removeChild(modal);
  };
  
  modalContent.appendChild(title);
  modalContent.appendChild(startDateInput);
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

// ===========================
// REPORT GENERATION FUNCTIONS
// ===========================

async function generateWeeklyReport(startDate, endDate) {
  try {
    console.log(`📊 Generating weekly report from ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    const [hours, students] = await Promise.all([
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('students')
    ]);
    
    const weekHours = hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= startDate && entryDate <= endDate;
    });
    
    const totalHours = weekHours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = weekHours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    
    const studentEarnings = {};
    weekHours.forEach(entry => {
      if (entry.student) {
        const earnings = entry.total || (entry.hours || 0) * (entry.rate || 0);
        studentEarnings[entry.student] = (studentEarnings[entry.student] || 0) + safeNumber(earnings);
      }
    });
    
    const reportHTML = `
      <div class="report-header">
        <h3>Weekly Report: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}</h3>
        <div class="report-summary">
          <div class="stat-card">
            <div class="stat-value">${totalHours.toFixed(1)}</div>
            <div class="stat-label">Total Hours</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">$${fmtMoney(totalEarnings)}</div>
            <div class="stat-label">Total Earnings</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${weekHours.length}</div>
            <div class="stat-label">Sessions</div>
          </div>
        </div>
      </div>
      
      ${Object.keys(studentEarnings).length > 0 ? `
        <div class="report-section">
          <h4>Earnings by Student</h4>
          <div class="student-earnings">
            ${Object.entries(studentEarnings).map(([student, earnings]) => `
              <div class="earning-item">
                <span class="student-name">${student}</span>
                <span class="earning-amount">$${fmtMoney(earnings)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="report-section">
        <h4>Recent Sessions</h4>
        <div class="session-list">
          ${weekHours.slice(0, 10).map(entry => `
            <div class="session-item">
              <div class="session-header">
                <strong>${entry.organization || 'No Organization'}</strong>
                <span class="session-hours">${safeNumber(entry.hours)}h</span>
              </div>
              <div class="session-details">
                ${entry.student ? `<span>Student: ${entry.student}</span>` : ''}
                <span>Date: ${formatDate(entry.date)}</span>
                <span class="session-total">$${fmtMoney(entry.total)}</span>
              </div>
              ${entry.notes ? `<div class="session-notes">Notes: ${entry.notes}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    showReportModal('Weekly Report', reportHTML);
    
  } catch (error) {
    console.error('Error generating weekly report:', error);
    NotificationSystem.notifyError('Failed to generate weekly report');
  }
}

async function generateBiWeeklyReport(startDate, endDate) {
  try {
    console.log(`📊 Generating bi-weekly report from ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    const [hours, students, payments] = await Promise.all([
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('payments')
    ]);
    
    const periodHours = hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= startDate && entryDate <= endDate;
    });
    
    const periodPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date || payment.dateIso);
      return paymentDate >= startDate && paymentDate <= endDate;
    });
    
    const totalHours = periodHours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = periodHours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    const totalPayments = periodPayments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
    const outstanding = Math.max(totalEarnings - totalPayments, 0);
    
    const reportHTML = `
      <div class="report-header">
        <h3>Bi-Weekly Report: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}</h3>
        <div class="report-summary">
          <div class="stat-card">
            <div class="stat-value">${totalHours.toFixed(1)}</div>
            <div class="stat-label">Total Hours</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">$${fmtMoney(totalEarnings)}</div>
            <div class="stat-label">Total Earnings</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">$${fmtMoney(totalPayments)}</div>
            <div class="stat-label">Payments Received</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">$${fmtMoney(outstanding)}</div>
            <div class="stat-label">Outstanding</div>
          </div>
        </div>
      </div>
      
      <div class="report-section">
        <h4>Payment Summary</h4>
        <div class="payment-summary">
          <div class="payment-item">
            <span>Earned this period:</span>
            <span class="amount-earned">$${fmtMoney(totalEarnings)}</span>
          </div>
          <div class="payment-item">
            <span>Received this period:</span>
            <span class="amount-received">$${fmtMoney(totalPayments)}</span>
          </div>
          <div class="payment-item outstanding">
            <span>Outstanding balance:</span>
            <span class="amount-outstanding">$${fmtMoney(outstanding)}</span>
          </div>
        </div>
      </div>
      
      ${periodPayments.length > 0 ? `
        <div class="report-section">
          <h4>Recent Payments</h4>
          <div class="payment-list">
            ${periodPayments.slice(0, 10).map(payment => `
              <div class="payment-item">
                <div class="payment-header">
                  <strong>${payment.student || 'Unknown Student'}</strong>
                  <span class="payment-amount">$${fmtMoney(payment.amount)}</span>
                </div>
                <div class="payment-details">
                  <span>${formatDate(payment.date)}</span>
                  <span>${payment.method || 'Unknown Method'}</span>
                </div>
                ${payment.notes ? `<div class="payment-notes">${payment.notes}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
    
    showReportModal('Bi-Weekly Report', reportHTML);
    
  } catch (error) {
    console.error('Error generating bi-weekly report:', error);
    NotificationSystem.notifyError('Failed to generate bi-weekly report');
  }
}

async function generateMonthlyReport(startDate, endDate) {
  try {
    console.log(`📊 Generating monthly report from ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    const [hours, students, marks, payments] = await Promise.all([
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('marks'),
      EnhancedCache.loadCollection('payments')
    ]);
    
    const monthHours = hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= startDate && entryDate <= endDate;
    });
    
    const monthMarks = marks.filter(mark => {
      const markDate = new Date(mark.date || mark.dateIso);
      return markDate >= startDate && markDate <= endDate;
    });
    
    const monthPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date || payment.dateIso);
      return paymentDate >= startDate && paymentDate <= endDate;
    });
    
    const totalHours = monthHours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = monthHours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    const totalPayments = monthPayments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0);
    
    let avgMark = 0;
    if (monthMarks.length > 0) {
      const totalPercentage = monthMarks.reduce((sum, mark) => sum + safeNumber(mark.percentage), 0);
      avgMark = totalPercentage / monthMarks.length;
    }
    
    const reportHTML = `
      <div class="report-header">
        <h3>Monthly Report: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}</h3>
        <div class="report-summary">
          <div class="stat-card">
            <div class="stat-value">${totalHours.toFixed(1)}</div>
            <div class="stat-label">Total Hours</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">$${fmtMoney(totalEarnings)}</div>
            <div class="stat-label">Total Earnings</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${monthMarks.length}</div>
            <div class="stat-label">Marks Recorded</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgMark.toFixed(1)}%</div>
            <div class="stat-label">Avg Mark</div>
          </div>
        </div>
      </div>
      
      <div class="report-section">
        <h4>Performance Overview</h4>
        <div class="performance-grid">
          <div class="performance-item">
            <label>Sessions Conducted:</label>
            <span>${monthHours.length}</span>
          </div>
          <div class="performance-item">
            <label>Students Taught:</label>
            <span>${new Set(monthHours.map(h => h.student).filter(Boolean)).size}</span>
          </div>
          <div class="performance-item">
            <label>Subjects Covered:</label>
            <span>${new Set(monthHours.map(h => h.subject).filter(Boolean)).size}</span>
          </div>
          <div class="performance-item">
            <label>Payments Received:</label>
            <span>${monthPayments.length}</span>
          </div>
        </div>
      </div>
      
      ${monthMarks.length > 0 ? `
        <div class="report-section">
          <h4>Recent Marks</h4>
          <div class="marks-list">
            ${monthMarks.slice(0, 8).map(mark => `
              <div class="mark-item">
                <div class="mark-header">
                  <strong>${mark.student || 'Unknown Student'}</strong>
                  <span class="mark-percentage">${safeNumber(mark.percentage).toFixed(1)}%</span>
                </div>
                <div class="mark-details">
                  <span>${mark.subject || 'No Subject'}</span>
                  <span>${mark.topic || 'No Topic'}</span>
                  <span class="mark-grade">${mark.grade || 'N/A'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
    
    showReportModal('Monthly Report', reportHTML);
    
  } catch (error) {
    console.error('Error generating monthly report:', error);
    NotificationSystem.notifyError('Failed to generate monthly report');
  }
}

async function generateSubjectReport(startDate, endDate) {
  try {
    console.log(`📊 Generating subject report from ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    const [hours, marks] = await Promise.all([
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('marks')
    ]);
    
    const periodHours = hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= startDate && entryDate <= endDate;
    });
    
    const periodMarks = marks.filter(mark => {
      const markDate = new Date(mark.date || mark.dateIso);
      return markDate >= startDate && markDate <= endDate;
    });
    
    const subjectHours = {};
    const subjectEarnings = {};
    const subjectMarks = {};
    
    periodHours.forEach(entry => {
      const subject = entry.subject || 'General';
      subjectHours[subject] = (subjectHours[subject] || 0) + safeNumber(entry.hours);
      subjectEarnings[subject] = (subjectEarnings[subject] || 0) + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0));
    });
    
    periodMarks.forEach(mark => {
      const subject = mark.subject || 'General';
      if (!subjectMarks[subject]) {
        subjectMarks[subject] = { total: 0, count: 0, grades: {} };
      }
      subjectMarks[subject].total += safeNumber(mark.percentage);
      subjectMarks[subject].count += 1;
      
      const grade = mark.grade || calculateGrade(mark.percentage);
      subjectMarks[subject].grades[grade] = (subjectMarks[subject].grades[grade] || 0) + 1;
    });
    
    const reportHTML = `
      <div class="report-header">
        <h3>Subject Report: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}</h3>
        <div class="report-summary">
          <div class="stat-card">
            <div class="stat-value">${Object.keys(subjectHours).length}</div>
            <div class="stat-label">Subjects</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${periodHours.length}</div>
            <div class="stat-label">Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${periodMarks.length}</div>
            <div class="stat-label">Marks</div>
          </div>
        </div>
      </div>
      
      <div class="report-section">
        <h4>Subject Breakdown</h4>
        <div class="subject-breakdown">
          ${Object.keys(subjectHours).map(subject => {
            const hours = subjectHours[subject];
            const earnings = subjectEarnings[subject];
            const marksData = subjectMarks[subject];
            const avgMark = marksData ? (marksData.total / marksData.count).toFixed(1) : 'N/A';
            
            return `
              <div class="subject-item">
                <div class="subject-header">
                  <strong>${subject}</strong>
                  <span class="subject-hours">${hours.toFixed(1)}h</span>
                </div>
                <div class="subject-details">
                  <span>Earnings: $${fmtMoney(earnings)}</span>
                  ${marksData ? `<span>Avg Mark: ${avgMark}%</span>` : ''}
                </div>
                ${marksData && marksData.count > 0 ? `
                  <div class="subject-grades">
                    ${Object.entries(marksData.grades).map(([grade, count]) => `
                      <span class="grade-badge">${grade}: ${count}</span>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <div class="report-section">
        <h4>Subject Performance</h4>
        <div class="performance-chart">
          ${Object.keys(subjectHours).map(subject => {
            const hours = subjectHours[subject];
            const totalHours = Object.values(subjectHours).reduce((sum, h) => sum + h, 0);
            const percentage = totalHours > 0 ? (hours / totalHours) * 100 : 0;
            
            return `
              <div class="chart-item">
                <div class="chart-label">${subject}</div>
                <div class="chart-bar">
                  <div class="chart-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="chart-value">${hours.toFixed(1)}h (${percentage.toFixed(1)}%)</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    showReportModal('Subject Report', reportHTML);
    
  } catch (error) {
    console.error('Error generating subject report:', error);
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
  modalContent.className = 'modal-content report-modal';
  modalContent.style.cssText = `
    background: var(--surface); padding: 20px; border-radius: 12px; 
    max-width: 800px; max-height: 90vh; overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  `;
  
  const modalHeader = document.createElement('div');
  modalHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
  
  const modalTitle = document.createElement('h2');
  modalTitle.textContent = title;
  modalTitle.style.margin = '0';
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    background: none; border: none; font-size: 24px; cursor: pointer;
    color: var(--muted); padding: 5px; border-radius: 4px;
  `;
  closeBtn.onclick = () => document.body.removeChild(modal);
  
  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeBtn);
  
  modalContent.appendChild(modalHeader);
  modalContent.innerHTML += content;
  
  modal.appendChild(modalContent);
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };
  
  document.body.appendChild(modal);
  
  // Add report styles if not already added
  if (!document.querySelector('#report-styles')) {
    const style = document.createElement('style');
    style.id = 'report-styles';
    style.textContent = `
      .report-header {
        border-bottom: 2px solid var(--border);
        padding-bottom: 20px;
        margin-bottom: 20px;
      }
      
      .report-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 15px;
        margin-top: 15px;
      }
      
      .stat-card {
        background: var(--background);
        padding: 15px;
        border-radius: 8px;
        text-align: center;
        border: 1px solid var(--border);
      }
      
      .stat-value {
        font-size: 1.5em;
        font-weight: bold;
        color: var(--primary);
      }
      
      .stat-label {
        font-size: 0.85em;
        color: var(--muted);
        margin-top: 5px;
      }
      
      .report-section {
        margin: 25px 0;
      }
      
      .report-section h4 {
        color: var(--text);
        margin-bottom: 15px;
        border-bottom: 1px solid var(--border-light);
        padding-bottom: 8px;
      }
      
      .student-earnings, .session-list, .payment-list, .marks-list, .subject-breakdown {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .earning-item, .session-item, .payment-item, .mark-item, .subject-item {
        background: var(--background);
        padding: 12px;
        border-radius: 8px;
        border: 1px solid var(--border);
      }
      
      .session-header, .payment-header, .mark-header, .subject-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .session-details, .payment-details, .mark-details, .subject-details {
        display: flex;
        gap: 15px;
        font-size: 0.9em;
        color: var(--muted);
        flex-wrap: wrap;
      }
      
      .session-total, .payment-amount, .mark-percentage, .subject-hours {
        font-weight: bold;
        color: var(--primary);
      }
      
      .payment-summary {
        background: var(--background);
        padding: 15px;
        border-radius: 8px;
        border: 1px solid var(--border);
      }
      
      .payment-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--border-light);
      }
      
      .payment-item.outstanding {
        border-bottom: none;
        font-weight: bold;
        color: var(--warning);
      }
      
      .performance-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
      }
      
      .performance-item {
        display: flex;
        justify-content: space-between;
        padding: 10px;
        background: var(--background);
        border-radius: 6px;
        border: 1px solid var(--border-light);
      }
      
      .grade-badge {
        background: var(--primary-light);
        color: var(--primary);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8em;
        margin-right: 5px;
      }
      
      .chart-item {
        display: flex;
        align-items: center;
        margin: 10px 0;
        gap: 10px;
      }
      
      .chart-label {
        min-width: 100px;
        font-size: 0.9em;
      }
      
      .chart-bar {
        flex: 1;
        background: var(--border-light);
        height: 20px;
        border-radius: 10px;
        overflow: hidden;
      }
      
      .chart-fill {
        background: var(--primary);
        height: 100%;
        transition: width 0.5s ease;
      }
      
      .chart-value {
        min-width: 80px;
        text-align: right;
        font-size: 0.85em;
        color: var(--muted);
      }
      
      .subject-grades {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
    `;
    document.head.appendChild(style);
  }
}

// ===========================
// OVERVIEW REPORTS
// ===========================

async function renderOverviewReports() {
  await renderStudentBalancesWithEdit();
  await renderPaymentActivityWithEdit();
  
  // Update overview stats
  EnhancedStats.forceRefresh();
}

// ===========================
// USER SETTINGS FUNCTIONS
// ===========================

async function updateUserDefaultRate(uid, newRate) {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { defaultRate: newRate });
    
    currentUserData.defaultRate = newRate;
    localStorage.setItem('userDefaultRate', newRate.toString());
    
    console.log('✅ Default rate updated:', newRate);
    return true;
  } catch (error) {
    console.error('Error updating default rate:', error);
    return false;
  }
}

async function applyDefaultRateToAllStudents(uid, newRate) {
  try {
    const students = await EnhancedCache.loadCollection('students');
    const batch = writeBatch(db);
    
    let updateCount = 0;
    
    students.forEach(student => {
      if (student._firebaseId) {
        const studentRef = doc(db, "users", uid, "students", student._firebaseId);
        batch.update(studentRef, { rate: newRate });
        updateCount++;
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      
      // Update local cache
      students.forEach(student => {
        student.rate = newRate;
      });
      cache.students = students;
      EnhancedCache.saveToLocalStorageBulk('students', students);
      
      NotificationSystem.notifySuccess(`Applied default rate to ${updateCount} students`);
      console.log(`✅ Applied default rate to ${updateCount} students`);
    } else {
      NotificationSystem.notifyInfo('No students found to update');
    }
    
    return updateCount;
  } catch (error) {
    console.error('Error applying default rate to all students:', error);
    NotificationSystem.notifyError('Failed to apply default rate to all students');
    return 0;
  }
}

// ===========================
// INITIALIZATION
// ===========================

async function initializeApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  // Initialize notification system first
  NotificationSystem.initNotificationStyles();
  
  // Initialize theme
  initializeTheme();
  injectThemeStyles();
  
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
      EnhancedStats.init();
      
      // Load and render initial data
      await Promise.all([
        renderStudents(),
        renderRecentHoursWithEdit(),
        renderRecentMarksWithEdit(),
        renderAttendanceRecentWithEdit(),
        renderOverviewReports()
      ]);
      
      // Populate dropdowns
      await StudentDropdownManager.forceRefresh();
      
      // Update UI
      updateHeaderStats();
      refreshTimestamp();
      
      console.log('✅ App initialization complete');
      
    } else {
      console.log('❌ No user signed in, redirecting to auth...');
      window.location.href = "auth.html";
    }
  });
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM Content Loaded - Starting app initialization...');
  initializeApp();
});

// Export functions for global access
window.NotificationSystem = NotificationSystem;
window.debugStudentDropdowns = debugStudentDropdowns;
window.manuallyRefreshStudentDropdowns = manuallyRefreshStudentDropdowns;
window.selectAllStudents = selectAllStudents;
window.clearAttendanceForm = clearAttendanceForm;
window.saveDefaultRate = saveDefaultRate;
window.applyDefaultRateToAll = applyDefaultRateToAll;
window.useDefaultRate = useDefaultRate;
window.useDefaultRateInHours = useDefaultRateInHours;
window.showWeeklyBreakdown = showWeeklyBreakdown;
window.showBiWeeklyBreakdown = showBiWeeklyBreakdown;
window.showMonthlyBreakdown = showMonthlyBreakdown;
window.showSubjectBreakdown = showSubjectBreakdown;

console.log('✅ app.js loaded successfully with all fixes applied');
