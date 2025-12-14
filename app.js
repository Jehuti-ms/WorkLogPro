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

  getCacheStatus() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    let total = 0;
    let unsynced = 0;

    collections.forEach(collectionName => {
      const key = `worklog_${collectionName}`;
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(cached)) {
          total += cached.length;
          unsynced += cached.filter(item => !item._synced).length;
        }
      } catch (error) {
        console.error(`❌ Error getting cache status for ${collectionName}:`, error);
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
      this.updateElement('averageRate', fmtMoney(averageRate));
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
      this.updateElement('weeklyTotal', fmtMoney(weeklyTotal));
      this.updateElement('monthlyHours', monthlyHours.toFixed(1));
      this.updateElement('monthlyTotal', fmtMoney(monthlyTotal));
      
      const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
      const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
      
      this.updateElement('totalHoursReport', totalHours.toFixed(1));
      this.updateElement('totalEarningsReport', fmtMoney(totalEarnings));
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
      
      this.updateElement('monthlyPayments', fmtMoney(monthlyPayments));
      this.updateElement('totalPaymentsReport', fmtMoney(totalPayments));
      
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
      
      this.updateElement('totalOwed', fmtMoney(totalOwed));
      this.updateElement('outstandingBalance', fmtMoney(totalOwed));
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
      
      this.updateElement('totalStudentsReport', students.length);
      this.updateElement('totalHoursReport', totalHours.toFixed(1));
      this.updateElement('totalEarningsReport', fmtMoney(totalEarnings));
      this.updateElement('avgMarkReport', `${avgMark.toFixed(1)}%`);
      this.updateElement('totalPaymentsReport', fmtMoney(totalPayments));
      this.updateElement('outstandingBalance', fmtMoney(outstanding));
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

function formatStudentDisplay(student) {
  if (!student) return 'Unknown Student';
  
  if (typeof student === 'string') {
    return student;
  }
  
  if (typeof student === 'object') {
    const name = student.name || `Student ${student.id}`;
    const id = student.id ? ` (${student.id})` : '';
    return `${name}${id}`;
  }
  
  return 'Unknown Student';
}

function findStudentByNameOrId(students, identifier) {
  if (!identifier) return null;
  
  let student = students.find(s => s.name === identifier);
  
  if (!student) {
    student = students.find(s => s.id === identifier);
  }
  
  return student;
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
      if (!
