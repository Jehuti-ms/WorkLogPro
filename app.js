// ===========================
// WORKLOG APP - COMPLETE FIXED VERSION
// ===========================

import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  getDocs,
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

// Cache system
const cache = {
  students: [],
  hours: [],
  marks: [],
  attendance: [],
  payments: [],
  lastSync: null
};

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
        if (notification.parentNode) {
          notification.classList.remove('notification-show');
          notification.classList.add('notification-hide');
          setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
          }, 300);
        }
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
  },

  clearNotifications() {
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
      notification.remove();
    });
  }
};

// ===========================
// CACHE SYSTEM
// ===========================

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
      if (window.EnhancedStats && window.EnhancedStats.forceRefresh) {
        window.EnhancedStats.forceRefresh();
      }
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
        }
      } catch (error) {
        console.error(`❌ Error loading cached ${collection}:`, error);
        cache[collection] = [];
      }
    });
  },

  async loadCollection(collectionName, forceRefresh = false) {
    const user = auth.currentUser;
    if (!user) return [];

    // Check memory cache first
    if (!forceRefresh && Array.isArray(cache[collectionName]) && cache[collectionName].length > 0) {
      return cache[collectionName];
    }

    // Check localStorage cache
    const localStorageData = this.loadFromLocalStorage(collectionName);
    if (!forceRefresh && localStorageData.length > 0) {
      cache[collectionName] = localStorageData;
      return localStorageData;
    }

    // Load from Firestore
    try {
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

      return data;
    } catch (error) {
      console.error(`❌ Error loading ${collectionName} from Firestore:`, error);
      
      // Fallback to localStorage
      const fallbackData = this.loadFromLocalStorage(collectionName);
      return fallbackData;
    }
  },

  loadFromLocalStorage(collectionName) {
    try {
      const key = `worklog_${collectionName}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const data = JSON.parse(cached);
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
// STATS SYSTEM - COMPLETE VERSION
// ===========================

const EnhancedStats = {
  init() {
    this.setupStatsUpdaters();
    this.startStatsRefresh();
    console.log('✅ Stats system initialized');
  },

  setupStatsUpdaters() {
    // Remove the missing calculateAttendanceStats reference
    this.updateStudentStats = this.debounce(() => this.calculateStudentStats(), 500);
    this.updateHoursStats = this.debounce(() => this.calculateHoursStats(), 500);
    this.updateMarksStats = this.debounce(() => this.calculateMarksStats(), 500);
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
      const now = new Date();
      
      // Get start of current week (Sunday)
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      // Get start of current month
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
      const marks = await EnhancedCache.loadCollection('marks');
      const marksCount = marks.length;
      
      let avgPercentage = 0;
      if (marksCount > 0) {
        const totalPercentage = marks.reduce((sum, mark) => sum + safeNumber(mark.percentage), 0);
        avgPercentage = totalPercentage / marksCount;
      }
      
      this.updateElement('marksCount', marksCount);
      this.updateElement('avgMarks', avgPercentage.toFixed(1));
      this.updateElement('avgMarkReport', `${avgPercentage.toFixed(1)}%`);
    } catch (error) {
      console.error('Error calculating marks stats:', error);
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
      });
      
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
    }
  },

  forceRefresh() {
    console.log('🔄 Forcing stats refresh...');
    this.refreshAllStats();
  }
};

// ===========================
// FIXED ATTENDANCE SYSTEM
// ===========================

async function loadAttendanceStudents() {
  const container = document.getElementById('attendanceStudents');
  if (!container) {
    console.log('❌ Attendance container not found');
    return;
  }

  try {
    const students = await EnhancedCache.loadCollection('students');
    console.log(`👥 Loading ${students.length} students for attendance`);
    
    if (students.length === 0) {
      container.innerHTML = '<div class="empty-state">No students registered. Add students first.</div>';
      return;
    }

    let html = `
      <div class="attendance-header">
        <button type="button" class="btn-secondary" id="selectAllStudentsBtn" onclick="selectAllStudents()">
          Select All
        </button>
      </div>
    `;
    
    students.forEach(student => {
      const studentName = student.name || `Student ${student.id}`;
      html += `
        <div class="student-attendance-item">
          <label>
            <input type="checkbox" class="student-checkbox" name="presentStudents" value="${studentName}">
            ${studentName} ${student.grade ? `(${student.grade})` : ''}
          </label>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    // Setup checkbox listeners
    setupAttendanceCheckboxListeners();
    
  } catch (error) {
    console.error('Error loading attendance students:', error);
    container.innerHTML = '<div class="error">Error loading students</div>';
  }
}

function selectAllStudents() {
  const container = document.getElementById('attendanceStudents');
  if (!container) return;

  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = !allChecked;
  });
  
  const selectAllBtn = document.getElementById('selectAllStudentsBtn');
  if (selectAllBtn) {
    selectAllBtn.textContent = allChecked ? 'Select All' : 'Deselect All';
  }
}

function setupAttendanceCheckboxListeners() {
  const container = document.getElementById('attendanceStudents');
  if (!container) return;

  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectAllButtonState);
  });
}

function updateSelectAllButtonState() {
  const container = document.getElementById('attendanceStudents');
  if (!container) return;
  
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  const someChecked = Array.from(checkboxes).some(cb => cb.checked);
  
  const selectAllBtn = document.getElementById('selectAllStudentsBtn');
  if (selectAllBtn) {
    if (allChecked) {
      selectAllBtn.textContent = 'Deselect All';
    } else if (someChecked) {
      selectAllBtn.textContent = 'Select All';
    } else {
      selectAllBtn.textContent = 'Select All';
    }
  }
}

// ===========================
// FIXED STUDENT DROPDOWN SYSTEM
// ===========================

async function populateStudentDropdowns() {
  try {
    const students = await EnhancedCache.loadCollection('students');
    console.log(`📝 Populating dropdowns with ${students.length} students`);
    
    // Update all student dropdowns
    const dropdowns = [
      { id: 'student', container: 'hours' },
      { id: 'marksStudent', container: 'marks' },
      { id: 'paymentStudent', container: 'payments' }
    ];
    
    dropdowns.forEach(({ id, container }) => {
      const dropdown = document.getElementById(id);
      if (dropdown) {
        const currentValue = dropdown.value;
        
        // Clear existing options
        dropdown.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a student...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        dropdown.appendChild(defaultOption);
        
        // Add student options
        students.forEach(student => {
          const studentName = student.name || `Student ${student.id}`;
          const option = document.createElement('option');
          option.value = studentName;
          option.textContent = studentName;
          option.setAttribute('data-student-id', student.id);
          dropdown.appendChild(option);
        });
        
        // Restore previous selection if possible
        if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
          dropdown.value = currentValue;
        }
        
        console.log(`✅ Populated ${id} dropdown`);
      }
    });
    
    // Also update attendance list
    await loadAttendanceStudents();
    
  } catch (error) {
    console.error('Error populating student dropdowns:', error);
  }
}

// ===========================
// FIXED DATA RENDERING FUNCTIONS
// ===========================

async function renderStudents() {
  const container = document.getElementById('studentsContainer');
  if (!container) return;

  try {
    const students = await EnhancedCache.loadCollection('students');
    
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

async function renderRecentMarks(limit = 10) {
  const container = document.getElementById('marksContainer');
  if (!container) return;

  try {
    const marks = await EnhancedCache.loadCollection('marks');
    const students = await EnhancedCache.loadCollection('students');
    
    // Create student name mapping
    const studentMap = {};
    students.forEach(student => {
      studentMap[student.name || student.id] = student.name || `Student ${student.id}`;
    });
    
    if (marks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Marks Recorded</h3>
          <p>Add your first mark to get started</p>
        </div>
      `;
      return;
    }

    // Sort by date (newest first)
    const sortedMarks = marks.sort((a, b) => {
      const dateA = new Date(a.date || a.dateIso);
      const dateB = new Date(b.date || b.dateIso);
      return dateB - dateA;
    });

    container.innerHTML = '';
    sortedMarks.slice(0, limit).forEach(entry => {
      // FIX: Use studentMap to get proper student names instead of IDs
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

    console.log(`✅ Rendered ${Math.min(marks.length, limit)} marks`);

  } catch (error) {
    console.error("Error rendering marks:", error);
    container.innerHTML = '<div class="error">Error loading marks</div>';
  }
}

// ===========================
// FIXED REPORT SYSTEM
// ===========================

async function loadReportData() {
  try {
    const [hours, marks] = await Promise.all([
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('marks')
    ]);

    console.log('📊 Generating reports with:', {
      hours: hours.length,
      marks: marks.length
    });

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

  // Calculate period data
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

  const reportHTML = `
    <div class="report-table">
      <div class="report-row header">
        <div class="report-cell">Period</div>
        <div class="report-cell">Hours</div>
        <div class="report-cell">Earnings</div>
        <div class="report-cell">Net (80%)</div>
      </div>
      <div class="report-row">
        <div class="report-cell"><strong>This Week</strong></div>
        <div class="report-cell">${weeklyHours.toFixed(1)}</div>
        <div class="report-cell">$${fmtMoney(weeklyEarnings)}</div>
        <div class="report-cell">$${fmtMoney(weeklyEarnings * 0.8)}</div>
      </div>
      <div class="report-row">
        <div class="report-cell"><strong>This Month</strong></div>
        <div class="report-cell">${monthlyHours.toFixed(1)}</div>
        <div class="report-cell">$${fmtMoney(monthlyEarnings)}</div>
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
        count: 0
      };
    }
    subjectMarks[subject].totalPercentage += safeNumber(mark.percentage);
    subjectMarks[subject].count++;
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
    // FIX: Remove double dollar sign
    const totalEarnings = hourData ? fmtMoney(hourData.earnings) : '0';
    const totalSessions = hourData ? hourData.sessions : markData ? markData.count : 0;

    reportHTML += `
      <div class="report-row">
        <div class="report-cell"><strong>${subject}</strong></div>
        <div class="report-cell">${avgMark}%</div>
        <div class="report-cell">${totalHours}</div>
        <div class="report-cell">$${totalEarnings}</div>
        <div class="report-cell">${totalSessions}</div>
      </div>
    `;
  });

  reportHTML += '</div>';
  container.innerHTML = reportHTML;
  console.log('✅ Subject report generated');
}

// ===========================
// FIXED USER PROFILE SYSTEM
// ===========================

async function loadUserProfile(uid) {
  const user = auth.currentUser;
  
  // Try to get memberSince from localStorage first
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
        await updateDoc(userRef, { memberSince: memberSince });
      }
      
      // Update profile button with actual data
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
        memberSince: memberSince
      };
      
      await setDoc(userRef, profileToCreate);
      
      currentUserData = { uid, ...profileToCreate };
      return currentUserData;
    }
  } catch (err) {
    console.error("❌ Error loading user profile:", err);
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
  }
}

function updateProfileModal() {
  const profileUserEmail = document.getElementById('profileUserEmail');
  const profileUserSince = document.getElementById('profileUserSince');
  const profileDefaultRate = document.getElementById('profileDefaultRate');
  const modalStatStudents = document.getElementById('modalStatStudents');
  const modalStatHours = document.getElementById('modalStatHours');
  const modalStatEarnings = document.getElementById('modalStatEarnings');

  // Update user info
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
      // FIX: Remove double dollar sign
      profileDefaultRate.textContent = `$${fmtMoney(currentUserData.defaultRate || 0)}/hour`;
    }
  }

  // Update stats in modal
  if (modalStatStudents) {
    const students = Array.isArray(cache.students) ? cache.students : [];
    modalStatStudents.textContent = students.length;
  }

  if (modalStatHours) {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    modalStatHours.textContent = totalHours.toFixed(1);
  }

  if (modalStatEarnings) {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    // FIX: Remove double dollar sign
    modalStatEarnings.textContent = `$${fmtMoney(totalEarnings)}`;
  }
}

// ===========================
// FORM HANDLERS
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
        NotificationSystem.notifySuccess('Student added successfully!');
        e.target.reset();
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
    NotificationSystem.notifySuccess('Mark added successfully!');
    e.target.reset();
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
    NotificationSystem.notifySuccess('Attendance recorded successfully!');
    e.target.reset();
    EnhancedStats.forceRefresh();
  } catch (error) {
    console.error('Error recording attendance:', error);
    NotificationSystem.notifyError('Failed to record attendance');
  }
}

// ===========================
// TAB NAVIGATION
// ===========================

function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab[data-tab]');
  
  tabButtons.forEach(button => {
    const tabName = button.getAttribute('data-tab');
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchTab(tabName);
    });
  });
  
  // Set initial tab
  const initialTab = getInitialTab();
  setTimeout(() => switchTab(initialTab), 100);
}

function switchTab(tabName) {
  if (!tabName) return;
  
  // Update URL
  window.location.hash = tabName;
  
  // Update buttons
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeButtons = document.querySelectorAll(`.tab[data-tab="${tabName}"]`);
  activeButtons.forEach(btn => {
    btn.classList.add('active');
  });
  
  // Hide all tab content
  const allTabContents = document.querySelectorAll('.tabcontent');
  allTabContents.forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
  
  // Show target tab
  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.classList.add('active');
    targetTab.style.display = 'block';
    
    // Load report data when reports tab is activated
    if (tabName === 'reports') {
      setTimeout(() => {
        loadReportData();
      }, 300);
    }
    
    // Load attendance students when attendance tab is activated
    if (tabName === 'attendance') {
      setTimeout(() => {
        loadAttendanceStudents();
      }, 300);
    }
    
    // Refresh data when marks tab is activated
    if (tabName === 'marks') {
      setTimeout(() => {
        renderRecentMarks();
      }, 300);
    }
    
    // Refresh data when students tab is activated
    if (tabName === 'students') {
      setTimeout(() => {
        renderStudents();
      }, 300);
    }
  }
}

function getInitialTab() {
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) return hash;
  
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) return activeTab.getAttribute('data-tab');
  
  return 'students';
}

// ===========================
// INITIALIZATION
// ===========================

function setupFormHandlers() {
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
  }
  
  const marksForm = document.getElementById('marksForm');
  if (marksForm) {
    marksForm.addEventListener('submit', handleMarksSubmit);
  }
  
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', handleAttendanceSubmit);
  }
  
  // Setup hours form rate calculation
  const hoursInput = document.getElementById('hours');
  const rateInput = document.getElementById('rate');
  if (hoursInput) hoursInput.addEventListener('input', calculateTotalPay);
  if (rateInput) rateInput.addEventListener('input', calculateTotalPay);
}

function initializeDefaultRate(rate) {
  const baseRateInput = document.getElementById('rate');
  const studentRateInput = document.getElementById('studentRate');  
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  
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
}

// Start the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🏠 DOM fully loaded, starting app...');
  
  // Initialize core systems
  NotificationSystem.initNotificationStyles();
  EnhancedCache.loadCachedData();
  EnhancedStats.init();
  
  // Setup UI components
  setupTabNavigation();
  setupFormHandlers();
  
  // Wait for authentication
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('👤 User authenticated:', user.email);
      
      try {
        // Load user profile
        await loadUserProfile(user.uid);
        
        // Load all data
        await EnhancedCache.loadCollection('students', true);
        await EnhancedCache.loadCollection('hours', true);
        await EnhancedCache.loadCollection('marks', true);
        
        // Populate dropdowns
        await populateStudentDropdowns();
        
        // Refresh stats
        EnhancedStats.forceRefresh();
        
        NotificationSystem.notifySuccess('App loaded successfully!');
        
      } catch (error) {
        console.error('❌ Error during app initialization:', error);
        NotificationSystem.notifyError('Failed to load app data');
      }
      
    } else {
      // Redirect to auth page
      setTimeout(() => {
        window.location.href = "auth.html";
      }, 1000);
    }
  });
});

// ===========================
// WINDOW EXPORTS
// ===========================

window.selectAllStudents = selectAllStudents;
window.loadReportData = loadReportData;
window.switchTab = switchTab;
window.NotificationSystem = NotificationSystem;
window.calculateTotalPay = calculateTotalPay;
window.EnhancedStats = EnhancedStats;

// Placeholder functions for edit/delete operations
window.editStudent = (id) => NotificationSystem.notifyInfo(`Edit student ${id} - Feature coming soon`);
window.deleteStudent = (id) => {
  if (confirm('Are you sure you want to delete this student?')) {
    NotificationSystem.notifyInfo(`Delete student ${id} - Feature coming soon`);
  }
};

window.editMark = (id) => NotificationSystem.notifyInfo(`Edit mark ${id} - Feature coming soon`);
window.deleteMark = (id) => {
  if (confirm('Are you sure you want to delete this mark?')) {
    NotificationSystem.notifyInfo(`Delete mark ${id} - Feature coming soon`);
  }
};

console.log('✅ Worklog App initialized successfully');
