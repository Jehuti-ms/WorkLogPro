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
// UTILITY FUNCTIONS
// ===========================

function safeNumber(n, fallback = 0) {
  if (n === null || n === undefined || n === '') return fallback;
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

// FIX: fmtMoney returns numeric only to prevent double $$ formatting
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

// FIX: Student display formatting consistency
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

// FIX: Enhanced student lookup helper
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
      
      // FIX: Use student IDs as keys to prevent merging issues
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
      
      // FIX: Currency formatting - fmtMoney is numeric only, prepend $ in display
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
  }
};

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
// STUDENTS TAB FUNCTIONS
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
      // FIX: Use formatStudentDisplay for consistent display
      const studentDisplay = formatStudentDisplay(student);
      
      studentsHTML += `
        <div class="student-card">
          <div class="student-card-header">
            <div>
              <strong>${studentDisplay}</strong>
            </div>
            <div class="student-actions">
              <button class="btn-icon" onclick="startEditStudent('${student.id}')" title="Edit">✏️</button>
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

// FIX: Enhanced student edit function
async function startEditStudent(id) {
  try {
    console.log('🔧 Starting student edit for:', id);
    
    const students = await EnhancedCache.loadCollection('students');
    const student = students.find(s => s.id === id);
    
    if (!student) {
      NotificationSystem.notifyError('Student not found');
      return;
    }

    currentEditStudentId = id;
    
    console.log('📝 Editing student:', student);
    
    // Set form values
    document.getElementById('studentName').value = student.name || '';
    document.getElementById('studentEmail').value = student.email || '';
    document.getElementById('studentPhone').value = student.phone || '';
    document.getElementById('studentGender').value = student.gender || '';
    document.getElementById('studentRate').value = student.rate || '';
    
    const submitBtn = document.querySelector('#studentForm button[type="submit"]');
    if (!submitBtn) {
      console.error('❌ Submit button not found in student form');
      return;
    }
    
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
    
    // Scroll to form
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
      studentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    NotificationSystem.notifyInfo('Edit mode activated. Update the form and click "Update Student"');
    
  } catch (error) {
    console.error('Error starting student edit:', error);
    NotificationSystem.notifyError('Failed to start editing');
  }
}

// FIX: Enhanced cancel edit function
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

// FIX: Enhanced delete student function
async function deleteStudent(id) {
  if (!confirm('Are you sure you want to delete this student? This will also delete associated hours, marks, and payments.')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete students');
      return;
    }

    const students = await EnhancedCache.loadCollection('students');
    const student = students.find(s => s.id === id);
    
    if (!student) {
      NotificationSystem.notifyError('Student not found');
      return;
    }

    // Delete from Firestore if it exists there
    if (student._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "students", student._firebaseId));
      console.log('✅ Deleted student from Firestore:', student._firebaseId);
    }

    // Update local cache
    const updatedStudents = students.filter(s => s.id !== id);
    cache.students = updatedStudents;
    EnhancedCache.saveToLocalStorageBulk('students', updatedStudents);

    // Refresh UI
    await renderStudents();
    
    // Refresh stats
    EnhancedStats.forceRefresh();
    
    NotificationSystem.notifySuccess('Student deleted successfully');
    
  } catch (error) {
    console.error('Error deleting student:', error);
    NotificationSystem.notifyError('Failed to delete student');
  }
}

// FIX: Enhanced student submit handler
async function handleStudentSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to save students');
    return;
  }

  const formData = new FormData(e.target);
  const studentData = {
    name: formData.get('studentName'),
    email: formData.get('studentEmail'),
    phone: formData.get('studentPhone'),
    gender: formData.get('studentGender'),
    rate: safeNumber(formData.get('studentRate')),
    createdAt: new Date().toISOString()
  };

  // Validate required fields
  if (!studentData.name) {
    NotificationSystem.notifyError('Please enter student name');
    return;
  }

  try {
    if (currentEditStudentId) {
      // Update existing student
      const students = await EnhancedCache.loadCollection('students');
      const studentIndex = students.findIndex(s => s.id === currentEditStudentId);
      
      if (studentIndex !== -1) {
        const existingStudent = students[studentIndex];
        studentData.id = currentEditStudentId;
        studentData._firebaseId = existingStudent._firebaseId;
        studentData._synced = existingStudent._synced;
        
        // Update in Firestore if it exists there
        if (existingStudent._firebaseId) {
          await updateDoc(doc(db, "users", user.uid, "students", existingStudent._firebaseId), studentData);
          console.log('✅ Updated student in Firestore:', existingStudent._firebaseId);
        }
        
        // Update local cache
        students[studentIndex] = { ...students[studentIndex], ...studentData };
        cache.students = students;
        EnhancedCache.saveToLocalStorageBulk('students', students);
        
        NotificationSystem.notifySuccess('Student updated successfully');
        currentEditStudentId = null;
        
        // Reset form and UI
        const submitBtn = document.querySelector('#studentForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Add Student';
        
        const cancelBtn = document.querySelector('#studentForm button[type="button"]');
        if (cancelBtn) cancelBtn.remove();
        
        e.target.reset();
      } else {
        NotificationSystem.notifyError('Student not found for editing');
        return;
      }
    } else {
      // Add new student
      const result = await EnhancedCache.saveWithBackgroundSync('students', studentData);
      if (result) {
        FormAutoClear.handleSuccess('studentForm');
        console.log('✅ New student saved with ID:', result);
      } else {
        NotificationSystem.notifyError('Failed to save student');
        return;
      }
    }
    
    // Refresh stats and UI
    EnhancedStats.forceRefresh();
    await renderStudents();
    
    // Refresh dropdowns
    setTimeout(() => {
      populateStudentDropdowns();
    }, 500);
    
  } catch (error) {
    console.error('Error saving student:', error);
    NotificationSystem.notifyError('Failed to save student: ' + error.message);
  }
}

// ===========================
// HOURS TAB FUNCTIONS
// ===========================

function calculateTotalPay() {
  const hours = safeNumber(document.getElementById('hoursWorked')?.value);
  const rate = safeNumber(document.getElementById('baseRate')?.value);
  const total = hours * rate;
  
  const totalPayElement = document.getElementById('totalPay');
  if (totalPayElement) {
    totalPayElement.textContent = `$${fmtMoney(total)}`;
  }
}

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

// FIX: Enhanced hours edit function
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
    
    // Update total pay display
    calculateTotalPay();
    
    const submitBtn = document.querySelector('#hoursForm button[type="submit"]');
    if (!submitBtn) {
      console.error('❌ Submit button not found in hours form');
      NotificationSystem.notifyError('Cannot enter edit mode - form not found');
      return;
    }
    
    // FIX: Remove existing cancel button before adding new one
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
    
    // Scroll to form
    const hoursForm = document.getElementById('hoursForm');
    if (hoursForm) {
      hoursForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    NotificationSystem.notifyInfo('Edit mode activated. Update the form and click "Update Hours"');
    
  } catch (error) {
    console.error('Error starting edit:', error);
    NotificationSystem.notifyError('Failed to start editing');
  }
}

// FIX: Enhanced cancel edit function
function cancelEditHours() {
  console.log('❌ Cancelling hours edit...');
  
  currentEditHoursId = null;
  
  const form = document.getElementById('hoursForm');
  if (form) {
    form.reset();
  }
  
  const submitBtn = document.querySelector('#hoursForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Log Hours';
  }
  
  const cancelBtn = document.querySelector('#hoursForm button[type="button"]');
  if (cancelBtn) {
    cancelBtn.remove();
  }
  
  // Reset rate to default
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  const rateInput = document.getElementById('baseRate');
  if (rateInput && defaultBaseRateInput) {
    rateInput.value = defaultBaseRateInput.value || currentUserData?.defaultRate || '0';
  }
  
  // Reset total pay
  calculateTotalPay();
  
  NotificationSystem.notifyInfo('Edit cancelled');
}

// FIX: Enhanced delete hours function
async function deleteHours(id) {
  if (!confirm('Are you sure you want to delete this hours entry?')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete hours');
      return;
    }

    const hours = await EnhancedCache.loadCollection('hours');
    const entry = hours.find(h => h.id === id);
    
    if (!entry) {
      NotificationSystem.notifyError('Hours entry not found');
      return;
    }

    // Delete from Firestore if it exists there
    if (entry._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "hours", entry._firebaseId));
      console.log('✅ Deleted hours from Firestore:', entry._firebaseId);
    }

    // Update local cache
    const updatedHours = hours.filter(h => h.id !== id);
    cache.hours = updatedHours;
    EnhancedCache.saveToLocalStorageBulk('hours', updatedHours);

    // Refresh UI
    await renderRecentHoursWithEdit();
    
    // Refresh stats
    EnhancedStats.forceRefresh();
    
    NotificationSystem.notifySuccess('Hours entry deleted successfully');
    
  } catch (error) {
    console.error('Error deleting hours:', error);
    NotificationSystem.notifyError('Failed to delete hours entry');
  }
}

// FIX: Enhanced hours submit handler
async function handleHoursSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to save hours');
    return;
  }

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

  // Validate required fields
  if (!hoursData.organization) {
    NotificationSystem.notifyError('Please enter organization');
    return;
  }

  if (!hoursData.student) {
    NotificationSystem.notifyError('Please select a student');
    return;
  }

  if (hours <= 0) {
    NotificationSystem.notifyError('Please enter valid hours');
    return;
  }

  try {
    if (currentEditHoursId) {
      // Update existing hours
      const hours = await EnhancedCache.loadCollection('hours');
      const entryIndex = hours.findIndex(h => h.id === currentEditHoursId);
      
      if (entryIndex !== -1) {
        const existingEntry = hours[entryIndex];
        hoursData.id = currentEditHoursId;
        hoursData._firebaseId = existingEntry._firebaseId;
        hoursData._synced = existingEntry._synced;
        
        // Update in Firestore if it exists there
        if (existingEntry._firebaseId) {
          await updateDoc(doc(db, "users", user.uid, "hours", existingEntry._firebaseId), hoursData);
          console.log('✅ Updated hours in Firestore:', existingEntry._firebaseId);
        }
        
        // Update local cache
        hours[entryIndex] = { ...hours[entryIndex], ...hoursData };
        cache.hours = hours;
        EnhancedCache.saveToLocalStorageBulk('hours', hours);
        
        NotificationSystem.notifySuccess('Hours updated successfully');
        currentEditHoursId = null;
        
        // Reset form and UI
        const submitBtn = document.querySelector('#hoursForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Log Hours';
        
        const cancelBtn = document.querySelector('#hoursForm button[type="button"]');
        if (cancelBtn) cancelBtn.remove();
        
        e.target.reset();
        
        // Reset rate to default
        const defaultBaseRateInput = document.getElementById('defaultBaseRate');
        const rateInput = document.getElementById('baseRate');
        if (rateInput && defaultBaseRateInput) {
          rateInput.value = defaultBaseRateInput.value || currentUserData?.defaultRate || '0';
        }
      } else {
        NotificationSystem.notifyError('Hours entry not found for editing');
        return;
      }
    } else {
      // Add new hours
      const result = await EnhancedCache.saveWithBackgroundSync('hours', hoursData);
      if (result) {
        FormAutoClear.handleSuccess('hoursForm', { baseRate: rate });
        console.log('✅ New hours saved with ID:', result);
      } else {
        NotificationSystem.notifyError('Failed to save hours');
        return;
      }
    }
    
    // Refresh stats and UI
    EnhancedStats.forceRefresh();
    await renderRecentHoursWithEdit();
    
  } catch (error) {
    console.error('Error saving hours:', error);
    NotificationSystem.notifyError('Failed to save hours: ' + error.message);
  }
}

// ===========================
// MARKS TAB FUNCTIONS
// ===========================

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

// FIX: Alias function for HTML compatibility
function updateMarksPercentage() {
  return calculateMarkPercentage();
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
      
      // FIX: Use formatStudentDisplay for consistent display
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

// FIX: Enhanced mark edit function
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
    
    // Set form values
    document.getElementById('marksStudent').value = entry.student || '';
    document.getElementById('marksSubject').value = entry.subject || '';
    document.getElementById('marksTopic').value = entry.topic || '';
    document.getElementById('marksScore').value = entry.score || '';
    document.getElementById('marksMax').value = entry.max || '';
    document.getElementById('marksDate').value = entry.date || '';
    document.getElementById('marksNotes').value = entry.notes || '';
    
    // Update percentage and grade display
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
    
    // Scroll to form
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
  }
  
  const submitBtn = document.querySelector('#marksForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Add Mark';
  }
  
  const cancelBtn = document.querySelector('#marksForm button[type="button"]');
  if (cancelBtn) {
    cancelBtn.remove();
  }
  
  // Reset percentage and grade display
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

    // Delete from Firestore if it exists there
    if (entry._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "marks", entry._firebaseId));
      console.log('✅ Deleted mark from Firestore:', entry._firebaseId);
    }

    // Update local cache
    const updatedMarks = marks.filter(m => m.id !== id);
    cache.marks = updatedMarks;
    EnhancedCache.saveToLocalStorageBulk('marks', updatedMarks);

    // Refresh UI
    await renderRecentMarksWithEdit();
    
    // Refresh stats
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
  
  // Validate inputs
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

  // Validate required fields
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
      // Update existing mark
      const marks = await EnhancedCache.loadCollection('marks');
      const entryIndex = marks.findIndex(m => m.id === currentEditMarksId);
      
      if (entryIndex !== -1) {
        const existingEntry = marks[entryIndex];
        marksData.id = currentEditMarksId;
        marksData._firebaseId = existingEntry._firebaseId;
        marksData._synced = existingEntry._synced;
        
        // Update in Firestore if it exists there
        if (existingEntry._firebaseId) {
          await updateDoc(doc(db, "users", user.uid, "marks", existingEntry._firebaseId), marksData);
          console.log('✅ Updated mark in Firestore:', existingEntry._firebaseId);
        }
        
        // Update local cache
        marks[entryIndex] = { ...marks[entryIndex], ...marksData };
        cache.marks = marks;
        EnhancedCache.saveToLocalStorageBulk('marks', marks);
        
        NotificationSystem.notifySuccess('Mark updated successfully');
        currentEditMarksId = null;
        
        // Reset form and UI
        const submitBtn = document.querySelector('#marksForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Add Mark';
        
        const cancelBtn = document.querySelector('#marksForm button[type="button"]');
        if (cancelBtn) cancelBtn.remove();
        
        e.target.reset();
        
        // Reset percentage and grade display
        const percentageDisplay = document.getElementById('marksPercentageDisplay');
        const gradeDisplay = document.getElementById('marksGradeDisplay');
        if (percentageDisplay) percentageDisplay.textContent = '0%';
        if (gradeDisplay) gradeDisplay.textContent = 'N/A';
      } else {
        NotificationSystem.notifyError('Mark entry not found for editing');
        return;
      }
    } else {
      // Add new mark
      const result = await EnhancedCache.saveWithBackgroundSync('marks', marksData);
      if (result) {
        FormAutoClear.handleSuccess('marksForm');
        console.log('✅ New mark saved with ID:', result);
      } else {
        NotificationSystem.notifyError('Failed to save mark');
        return;
      }
    }
    
    // Refresh stats and UI
    EnhancedStats.forceRefresh();
    await renderRecentMarksWithEdit();
    
  } catch (error) {
    console.error('Error saving mark:', error);
    NotificationSystem.notifyError('Failed to save mark: ' + error.message);
  }
}

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
      // FIX: Use formatStudentDisplay for consistent display
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

// FIX: Enhanced attendance edit function
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
    if (!submitBtn) {
      console.error('❌ Submit button not found in attendance form');
      return;
    }
    
    // FIX: Remove existing cancel button before adding new one
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
    
    // Scroll to form
    const attendanceForm = document.getElementById('attendanceForm');
    if (attendanceForm) {
      attendanceForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    NotificationSystem.notifyInfo('Edit mode activated. Update the form and click "Update Attendance"');
    
  } catch (error) {
    console.error('Error starting attendance edit:', error);
    NotificationSystem.notifyError('Failed to start editing');
  }
}

// FIX: Enhanced cancel edit function
function cancelEditAttendance() {
  console.log('❌ Cancelling attendance edit...');
  
  currentEditAttendanceId = null;
  
  const form = document.getElementById('attendanceForm');
  if (form) {
    form.reset();
  }
  
  const submitBtn = document.querySelector('#attendanceForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Record Attendance';
  }
  
  const cancelBtn = document.querySelector('#attendanceForm button[type="button"]');
  if (cancelBtn) {
    cancelBtn.remove();
  }
  
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

// FIX: Enhanced delete attendance function
async function deleteAttendance(id) {
  if (!confirm('Are you sure you want to delete this attendance record?')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete attendance');
      return;
    }

    const attendance = await EnhancedCache.loadCollection('attendance');
    const entry = attendance.find(a => a.id === id);
    
    if (!entry) {
      NotificationSystem.notifyError('Attendance record not found');
      return;
    }

    // Delete from Firestore if it exists there
    if (entry._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "attendance", entry._firebaseId));
      console.log('✅ Deleted attendance from Firestore:', entry._firebaseId);
    }

    // Update local cache
    const updatedAttendance = attendance.filter(a => a.id !== id);
    cache.attendance = updatedAttendance;
    EnhancedCache.saveToLocalStorageBulk('attendance', updatedAttendance);

    // Refresh UI
    await renderAttendanceRecentWithEdit();
    
    // Refresh stats
    EnhancedStats.forceRefresh();
    
    NotificationSystem.notifySuccess('Attendance record deleted successfully');
    
  } catch (error) {
    console.error('Error deleting attendance:', error);
    NotificationSystem.notifyError('Failed to delete attendance record');
  }
}

// FIX: Enhanced attendance submit handler
async function handleAttendanceSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to save attendance');
    return;
  }

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

  // Validate required fields
  if (!attendanceData.subject) {
    NotificationSystem.notifyError('Please enter a subject');
    return;
  }

  if (presentStudents.length === 0) {
    NotificationSystem.notifyError('Please select at least one student');
    return;
  }

  try {
    if (currentEditAttendanceId) {
      // Update existing attendance
      const attendance = await EnhancedCache.loadCollection('attendance');
      const entryIndex = attendance.findIndex(a => a.id === currentEditAttendanceId);
      
      if (entryIndex !== -1) {
        const existingEntry = attendance[entryIndex];
        attendanceData.id = currentEditAttendanceId;
        attendanceData._firebaseId = existingEntry._firebaseId;
        attendanceData._synced = existingEntry._synced;
        
        // Update in Firestore if it exists there
        if (existingEntry._firebaseId) {
          await updateDoc(doc(db, "users", user.uid, "attendance", existingEntry._firebaseId), attendanceData);
          console.log('✅ Updated attendance in Firestore:', existingEntry._firebaseId);
        }
        
        // Update local cache
        attendance[entryIndex] = { ...attendance[entryIndex], ...attendanceData };
        cache.attendance = attendance;
        EnhancedCache.saveToLocalStorageBulk('attendance', attendance);
        
        NotificationSystem.notifySuccess('Attendance updated successfully');
        currentEditAttendanceId = null;
        
        // Reset form and UI
        const submitBtn = document.querySelector('#attendanceForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Record Attendance';
        
        const cancelBtn = document.querySelector('#attendanceForm button[type="button"]');
        if (cancelBtn) cancelBtn.remove();
        
        e.target.reset();
        
        // Reset checkboxes
        const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
          checkbox.checked = false;
          if (checkbox.parentElement) {
            checkbox.parentElement.style.backgroundColor = '';
            checkbox.parentElement.classList.remove('selected');
          }
        });
      } else {
        NotificationSystem.notifyError('Attendance record not found for editing');
        return;
      }
    } else {
      // Add new attendance
      const result = await EnhancedCache.saveWithBackgroundSync('attendance', attendanceData);
      if (result) {
        FormAutoClear.handleSuccess('attendanceForm');
        console.log('✅ New attendance saved with ID:', result);
      } else {
        NotificationSystem.notifyError('Failed to save attendance');
        return;
      }
    }
    
    // Refresh stats and UI
    EnhancedStats.forceRefresh();
    await renderAttendanceRecentWithEdit();
    
  } catch (error) {
    console.error('Error saving attendance:', error);
    NotificationSystem.notifyError('Failed to save attendance: ' + error.message);
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

// FIX: Student balances with consistent identification and display
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

    // FIX: Use student IDs as keys instead of names to prevent merging issues
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

      // FIX: Use formatStudentDisplay for consistent display
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

    // FIX: Refresh stats to stay in sync
    EnhancedStats.forceRefresh();

    console.log(`✅ Rendered balances for ${students.length} students, total owed: $${fmtMoney(totalOwed)}`);

  } catch (error) {
    console.error("Error rendering student balances:", error);
    container.innerHTML = '<div class="error">Error loading student balances</div>';
  }
}

// FIX: Enhanced payment edit function
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
    if (!submitBtn) {
      console.error('❌ Submit button not found in payment form');
      return;
    }
    
    // FIX: Remove existing cancel button before adding new one
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
    
    // Scroll to form
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
      paymentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    NotificationSystem.notifyInfo('Edit mode activated. Update the form and click "Update Payment"');
    
  } catch (error) {
    console.error('Error starting payment edit:', error);
    NotificationSystem.notifyError('Failed to start editing');
  }
}

// FIX: Enhanced cancel edit function
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
  
  NotificationSystem.notifyInfo('Edit cancelled');
}

// FIX: Enhanced delete payment function
async function deletePayment(id) {
  if (!confirm('Are you sure you want to delete this payment?')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete payments');
      return;
    }

    const payments = await EnhancedCache.loadCollection('payments');
    const entry = payments.find(p => p.id === id);
    
    if (!entry) {
      NotificationSystem.notifyError('Payment not found');
      return;
    }

    // Delete from Firestore if it exists there
    if (entry._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "payments", entry._firebaseId));
      console.log('✅ Deleted payment from Firestore:', entry._firebaseId);
    }

    // Update local cache
    const updatedPayments = payments.filter(p => p.id !== id);
    cache.payments = updatedPayments;
    EnhancedCache.saveToLocalStorageBulk('payments', updatedPayments);

    // Refresh UI
    await renderPaymentActivityWithEdit();
    await renderStudentBalancesWithEdit();
    
    // Refresh stats
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

// FIX: Enhanced payment submit handler
async function handlePaymentSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to save payments');
    return;
  }

  const formData = new FormData(e.target);
  const paymentData = {
    student: formData.get('paymentStudent'),
    amount: safeNumber(formData.get('paymentAmount')),
    method: formData.get('paymentMethod'),
    date: formData.get('paymentDate'),
    dateIso: fmtDateISO(formData.get('paymentDate')),
    notes: formData.get('paymentNotes')
  };

  // Validate required fields
  if (!paymentData.student) {
    NotificationSystem.notifyError('Please select a student');
    return;
  }

  if (paymentData.amount <= 0) {
    NotificationSystem.notifyError('Please enter a valid payment amount');
    return;
  }

  try {
    if (currentEditPaymentId) {
      // Update existing payment
      const payments = await EnhancedCache.loadCollection('payments');
      const entryIndex = payments.findIndex(p => p.id === currentEditPaymentId);
      
      if (entryIndex !== -1) {
        const existingEntry = payments[entryIndex];
        paymentData.id = currentEditPaymentId;
        paymentData._firebaseId = existingEntry._firebaseId;
        paymentData._synced = existingEntry._synced;
        
        // Update in Firestore if it exists there
        if (existingEntry._firebaseId) {
          await updateDoc(doc(db, "users", user.uid, "payments", existingEntry._firebaseId), paymentData);
          console.log('✅ Updated payment in Firestore:', existingEntry._firebaseId);
        }
        
        // Update local cache
        payments[entryIndex] = { ...payments[entryIndex], ...paymentData };
        cache.payments = payments;
        EnhancedCache.saveToLocalStorageBulk('payments', payments);
        
        NotificationSystem.notifySuccess('Payment updated successfully');
        currentEditPaymentId = null;
        
        // Reset form and UI
        const submitBtn = document.querySelector('#paymentForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Record Payment';
        
        const cancelBtn = document.querySelector('#paymentForm button[type="button"]');
        if (cancelBtn) cancelBtn.remove();
        
        e.target.reset();
      } else {
        NotificationSystem.notifyError('Payment not found for editing');
        return;
      }
    } else {
      // Add new payment
      const result = await EnhancedCache.saveWithBackgroundSync('payments', paymentData);
      if (result) {
        FormAutoClear.handleSuccess('paymentForm');
        console.log('✅ New payment saved with ID:', result);
      } else {
        NotificationSystem.notifyError('Failed to save payment');
        return;
      }
    }
    
    // Refresh stats and UI
    EnhancedStats.forceRefresh();
    await renderPaymentActivityWithEdit();
    await renderStudentBalancesWithEdit();
    
  } catch (error) {
    console.error('Error saving payment:', error);
    NotificationSystem.notifyError('Failed to save payment: ' + error.message);
  }
}

// ===========================
// STUDENT DROPDOWN MANAGEMENT
// ===========================

const StudentDropdownManager = {
  initialized: false,
  
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
      '#paymentStudent'
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
  const dropdowns = document.querySelectorAll('#hoursStudent, #marksStudent, #paymentStudent');
  
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
  const dropdowns = document.querySelectorAll('#hoursStudent, #marksStudent, #paymentStudent');
  
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
  
  StudentDropdownManager.init();
  
  // Student Form
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
    
    const studentRateInput = document.getElementById('studentRate');
    const defaultBaseRateInput = document.getElementById('defaultBaseRate');
    
    if (studentRateInput && defaultBaseRateInput && !studentRateInput.value) {
      studentRateInput.value = defaultBaseRateInput.value || currentUserData?.defaultRate || '0';
    }
  }
  
  // Hours Form
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
  
  // Marks Form
  const marksForm = document.getElementById('marksForm');
  if (marksForm) {
    marksForm.addEventListener('submit', handleMarksSubmit);
    
    const scoreInput = document.getElementById('marksScore');
    const maxInput = document.getElementById('marksMax');
    
    if (scoreInput) {
      scoreInput.addEventListener('input', calculateMarkPercentage);
    }
    
    if (maxInput) {
      maxInput.addEventListener('input', calculateMarkPercentage);
    }
    
    const studentDropdown = document.getElementById('marksStudent');
    if (studentDropdown) {
      studentDropdown.addEventListener('focus', async () => {
        console.log('🎯 Marks form student dropdown focused');
        await StudentDropdownManager.refreshAllDropdowns();
      });
    }
    
    // Initialize percentage calculation
    setTimeout(() => {
      calculateMarkPercentage();
    }, 1000);
  }
  
  // Attendance Form
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
  
  // Payment Form
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
  
  console.log('✅ All form handlers initialized');
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
}

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
// OVERVIEW REPORTS
// ===========================

async function renderOverviewReports() {
  await renderStudentBalancesWithEdit();
  await renderPaymentActivityWithEdit();
  
  // Update overview stats
  EnhancedStats.forceRefresh();
}

/**
 * Clear the attendance form and reset to default values
 */
function clearAttendanceForm() {
    console.log('🧹 Clearing attendance form...');
    
    // Reset form fields
    document.getElementById('attendance-date').value = '';
    document.getElementById('clock-in-time').value = '';
    document.getElementById('clock-out-time').value = '';
    document.getElementById('break-duration').value = '30';
    document.getElementById('notes').value = '';
    
    // Reset any error states
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
        element.style.display = 'none';
    });
    
    // Remove any success messages
    const successMessage = document.getElementById('success-message');
    if (successMessage) {
        successMessage.style.display = 'none';
    }
    
    console.log('✅ Attendance form cleared');
}

/**
 * Load user profile data from Firestore
 */
/**
 * Load user profile data from Firestore
 */
async function loadUserProfile(userId) {
    console.log('👤 Loading user profile for:', userId);
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('✅ User profile loaded:', userData);
            
            // Store user data globally for easy access
            window.currentUser = userData;
            window.currentUser.uid = userId;
            
            // Update UI with user data
            updateUserProfileUI(userData);
            
            return userData;
        } else {
            console.log('⚠️ No user profile found, creating default...');
            // Create default user profile
            const user = auth.currentUser;
            const defaultUserData = {
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                createdAt: new Date(),
                theme: 'dark',
                breakDuration: 30,
                currency: 'USD',
                schoolName: '',
                className: ''
            };
            
            await db.collection('users').doc(userId).set(defaultUserData);
            
            // Store globally
            window.currentUser = defaultUserData;
            window.currentUser.uid = userId;
            
            updateUserProfileUI(defaultUserData);
            
            return defaultUserData;
        }
    } catch (error) {
        console.error('❌ Error loading user profile:', error);
        showNotification('Error loading user profile', 'error');
        throw error; // Re-throw to handle in caller
    }
}

/**
 * Update UI with user profile data
 */
function updateUserProfileUI(userData) {
    console.log('🎨 Updating UI with user profile data...');
    
    // Update user display name if element exists
    const userDisplayElement = document.getElementById('user-display-name');
    if (userDisplayElement && userData.displayName) {
        userDisplayElement.textContent = userData.displayName;
    }
    
    // Update user email if element exists
    const userEmailElement = document.getElementById('user-email');
    if (userEmailElement && userData.email) {
        userEmailElement.textContent = userData.email;
    }
    
    // Apply user theme preference
    if (userData.theme) {
        applyTheme(userData.theme);
        
        // Update theme toggle button state
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const isDark = userData.theme === 'dark';
            themeToggle.innerHTML = isDark ? '☀️' : '🌙';
            themeToggle.setAttribute('data-theme', userData.theme);
        }
    }
    
    // Update break duration in form if it exists
    const breakDurationInput = document.getElementById('break-duration');
    if (breakDurationInput && userData.breakDuration) {
        breakDurationInput.value = userData.breakDuration;
    }
    
    console.log('✅ UI updated with user profile');
}

/**
 * Apply theme to the application
 */
function applyTheme(theme) {
    console.log(`🎨 Applying ${theme} theme...`);
    
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme;
    
    // Update theme in localStorage
    localStorage.setItem('worklog-theme', theme);
    
    console.log(`✅ ${theme} theme applied`);
}

/**
 * Setup tab navigation system
 */


/**
 * Setup form handlers for all forms
 */
function setupFormHandlers() {
    console.log('🔧 Setting up form handlers...');
    
    // Student form
    const studentForm = document.getElementById('student-form');
    if (studentForm) {
        studentForm.addEventListener('submit', handleStudentSubmit);
    }
    
    // Hours form
    const hoursForm = document.getElementById('hours-form');
    if (hoursForm) {
        hoursForm.addEventListener('submit', handleHoursSubmit);
    }
    
    // Marks form
    const marksForm = document.getElementById('marks-form');
    if (marksForm) {
        marksForm.addEventListener('submit', handleMarksSubmit);
    }
    
    // Attendance form
    const attendanceForm = document.getElementById('attendance-form');
    if (attendanceForm) {
        attendanceForm.addEventListener('submit', handleAttendanceSubmit);
    }
    
    console.log('✅ Form handlers setup complete');
}

/**
 * Setup profile modal functionality
 */
function setupProfileModal() {
    console.log('🔧 Setting up profile modal...');
    
    const profileModal = document.getElementById('profile-modal');
    const profileButton = document.getElementById('profile-button');
    const closeProfile = document.getElementById('close-profile');
    const profileForm = document.getElementById('profile-form');
    
    if (profileButton && profileModal) {
        profileButton.addEventListener('click', () => {
            profileModal.style.display = 'block';
            loadProfileData();
        });
    }
    
    if (closeProfile) {
        closeProfile.addEventListener('click', () => {
            profileModal.style.display = 'none';
        });
    }
    
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileSubmit);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === profileModal) {
            profileModal.style.display = 'none';
        }
    });
    
    console.log('✅ Profile modal setup complete');
}

/**
 * Setup floating add button
 */
function setupFloatingAddButton() {
    console.log('🔧 Setting up floating add button...');
    
    const fab = document.getElementById('floating-add-btn');
    const quickAddModal = document.getElementById('quick-add-modal');
    const closeQuickAdd = document.getElementById('close-quick-add');
    
    if (fab && quickAddModal) {
        fab.addEventListener('click', () => {
            quickAddModal.style.display = 'block';
        });
    }
    
    if (closeQuickAdd) {
        closeQuickAdd.addEventListener('click', () => {
            quickAddModal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === quickAddModal) {
            quickAddModal.style.display = 'none';
        }
    });
    
    console.log('✅ Floating add button setup complete');
}

/**
 * Load data into profile form
 */
async function loadProfileData() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Populate form fields
            document.getElementById('profile-display-name').value = userData.displayName || '';
            document.getElementById('profile-school').value = userData.schoolName || '';
            document.getElementById('profile-class').value = userData.className || '';
            document.getElementById('profile-break-duration').value = userData.breakDuration || 30;
            document.getElementById('profile-currency').value = userData.currency || 'USD';
            
            // Theme selection
            const themeSelect = document.getElementById('profile-theme');
            if (themeSelect) {
                themeSelect.value = userData.theme || 'dark';
            }
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
        showNotification('Error loading profile data', 'error');
    }
}

/**
 * Handle profile form submission
 */
async function handleProfileSubmit(e) {
    e.preventDefault();
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const profileData = {
            displayName: document.getElementById('profile-display-name').value,
            schoolName: document.getElementById('profile-school').value,
            className: document.getElementById('profile-class').value,
            breakDuration: parseInt(document.getElementById('profile-break-duration').value),
            currency: document.getElementById('profile-currency').value,
            theme: document.getElementById('profile-theme').value,
            updatedAt: new Date()
        };
        
        await db.collection('users').doc(user.uid).set(profileData, { merge: true });
        
        // Update global user data
        if (window.currentUser) {
            Object.assign(window.currentUser, profileData);
        }
        
        // Apply theme if changed
        applyTheme(profileData.theme);
        
        showNotification('Profile updated successfully!', 'success');
        
        // Close modal
        document.getElementById('profile-modal').style.display = 'none';
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Error updating profile', 'error');
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

// ===========================
// GLOBAL FUNCTION EXPORTS
// ===========================

// Make functions available globally for HTML onclick attributes
window.NotificationSystem = NotificationSystem;
window.startEditStudent = startEditStudent;
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
window.calculateMarkPercentage = calculateMarkPercentage;
window.updateMarksPercentage = updateMarksPercentage;
window.calculateTotalPay = calculateTotalPay;
window.selectAllStudents = selectAllStudents;
window.clearAttendanceForm = clearAttendanceForm;
window.manuallyRefreshStudentDropdowns = manuallyRefreshStudentDropdowns;

console.log('✅ app.js loaded successfully with all button fixes applied');
