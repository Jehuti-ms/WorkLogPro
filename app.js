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
// WINDOW EXPORTS - DEFINED FIRST
// ===========================

// Define all functions on window first to prevent reference errors
window.selectAllStudents = function() {
  console.log('Select All called - implementation loading...');
};

window.loadReportData = function() {
  console.log('Load Report Data called - implementation loading...');
};

window.switchTab = function(tabName) {
  console.log('Switch Tab called - implementation loading...', tabName);
};

window.calculateTotalPay = function() {
  console.log('Calculate Total Pay called - implementation loading...');
};

window.toggleTheme = function() {
  console.log('Toggle Theme called - implementation loading...');
};

window.showWeeklyBreakdown = function() {
  console.log('Weekly Breakdown called - implementation loading...');
};

window.showBiWeeklyBreakdown = function() {
  console.log('Bi-Weekly Breakdown called - implementation loading...');
};

window.showMonthlyBreakdown = function() {
  console.log('Monthly Breakdown called - implementation loading...');
};

window.showSubjectBreakdown = function() {
  console.log('Subject Breakdown called - implementation loading...');
};

window.editStudent = function(id) {
  console.log('Edit Student called - implementation loading...', id);
};

window.deleteStudent = function(id) {
  console.log('Delete Student called - implementation loading...', id);
};

window.editMark = function(id) {
  console.log('Edit Mark called - implementation loading...', id);
};

window.deleteMark = function(id) {
  console.log('Delete Mark called - implementation loading...', id);
};

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

// Export to window
window.NotificationSystem = NotificationSystem;

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

// Update window export with actual implementation
window.calculateTotalPay = calculateTotalPay;

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
// STATS SYSTEM
// ===========================

const EnhancedStats = {
  init() {
    this.setupStatsUpdaters();
    this.startStatsRefresh();
    console.log('✅ Stats system initialized');
  },

  setupStatsUpdaters() {
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

// Export to window
window.EnhancedStats = EnhancedStats;

// ===========================
// THEME MANAGEMENT SYSTEM
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
        themeToggle.setAttribute('aria-label', 'Toggle theme');
        
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
            this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        });
        
        newButton.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = 'none';
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

// Update window export with actual implementation
window.toggleTheme = toggleTheme;

// ===========================
// ATTENDANCE SYSTEM
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
  
  let action;
  let message;
  
  if (allSelected) {
    // Deselect all
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      if (checkbox.parentElement) {
        checkbox.parentElement.style.backgroundColor = '';
        checkbox.parentElement.classList.remove('selected');
      }
    });
    action = 'deselected';
    message = `Deselected all ${checkboxes.length} students`;
    console.log('✅ All students deselected');
    NotificationSystem.notifyInfo(message);
  } else {
    // Select all
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      if (checkbox.parentElement) {
        checkbox.parentElement.style.backgroundColor = 'var(--primary-light)';
        checkbox.parentElement.classList.add('selected');
      }
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

// Update window export with actual implementation
window.selectAllStudents = selectAllStudents;

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

function setupAttendanceCheckboxListeners() {
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (!attendanceContainer) return;

  const checkboxes = attendanceContainer.querySelectorAll('input[type="checkbox"][name="presentStudents"]');
  
  checkboxes.forEach(checkbox => {
    // Remove existing listeners by cloning
    const newCheckbox = checkbox.cloneNode(true);
    checkbox.parentNode.replaceChild(newCheckbox, checkbox);

    newCheckbox.addEventListener('change', function() {
      // Update visual feedback
      if (this.checked) {
        if (this.parentElement) {
          this.parentElement.style.backgroundColor = 'var(--primary-light)';
          this.parentElement.classList.add('selected');
        }
      } else {
        if (this.parentElement) {
          this.parentElement.style.backgroundColor = '';
          this.parentElement.classList.remove('selected');
        }
      }
      
      // Update select all button state
      updateSelectAllButtonState();
    });
  });
}

function updateSelectAllButtonState() {
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (!attendanceContainer) return;
  
  const checkboxes = attendanceContainer.querySelectorAll('input[type="checkbox"][name="presentStudents"]');
  const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  const allSelected = selectedCount === checkboxes.length && checkboxes.length > 0;
  
  updateSelectAllButton(allSelected);
}

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
        <button type="button" class="btn-secondary" id="selectAllStudentsBtn">
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
    
    // Setup checkbox listeners and select all button
    setupAttendanceSelectAll();
    setupAttendanceCheckboxListeners();
    
  } catch (error) {
    console.error('Error loading attendance students:', error);
    container.innerHTML = '<div class="error">Error loading students</div>';
  }
}

// ===========================
// STUDENT DROPDOWN SYSTEM
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
// DATA RENDERING FUNCTIONS
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
// REPORT SYSTEM
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

// Update window export with actual implementation
window.loadReportData = loadReportData;

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
// REPORT BREAKDOWN FUNCTIONS
// ===========================

function showWeeklyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current week
  const today = new Date();
  const startDate = getStartOfWeek(today);
  const endDate = getEndOfWeek(today);
  
  generateWeeklyReport(startDate, endDate);
}

function showBiWeeklyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current bi-weekly period (last 2 weeks)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 13); // Last 14 days (2 weeks)
  
  generateBiWeeklyReport(startDate, endDate);
}

function showMonthlyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current month
  const today = new Date();
  const startDate = getStartOfMonth(today);
  const endDate = getEndOfMonth(today);
  
  generateMonthlyReport(startDate, endDate);
}

function showSubjectBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current month
  const today = new Date();
  const startDate = getStartOfMonth(today);
  const endDate = getEndOfMonth(today);
  
  generateSubjectBreakdown(startDate, endDate);
}

// Update window exports with actual implementations
window.showWeeklyBreakdown = showWeeklyBreakdown;
window.showBiWeeklyBreakdown = showBiWeeklyBreakdown;
window.showMonthlyBreakdown = showMonthlyBreakdown;
window.showSubjectBreakdown = showSubjectBreakdown;

// Date helper functions
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

// Report generation functions
function generateWeeklyReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    
    console.log('🔍 Weekly Report - Looking for data between:', formatDateForDisplay(startDate), 'and', formatDateForDisplay(endDate));
    
    const weeklyData = hours.filter(entry => {
      if (!entry.date && !entry.dateIso) return false;
      
      const entryDate = entry.date || entry.dateIso;
      return isDateInRange(entryDate, startDate, endDate);
    });

    console.log('✅ Found entries for weekly report:', weeklyData.length);

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

function generateSubjectBreakdown(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    
    console.log('🔍 Subject Breakdown - Looking for data between:', formatDateForDisplay(startDate), 'and', formatDateForDisplay(endDate));
    
    const periodData = hours.filter(entry => {
      if (!entry.date && !entry.dateIso) return false;
      
      const entryDate = entry.date || entry.dateIso;
      return isDateInRange(entryDate, startDate, endDate);
    });

    console.log('✅ Found entries for subject breakdown:', periodData.length);

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

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
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

// ===========================
// USER PROFILE SYSTEM
// ===========================

async function loadUserProfile(uid) {
  console.log('👤 Loading user profile for:', uid);
  
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
      
      console.log('✅ User profile loaded from Firestore');
      
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
    // Remove any existing listeners by cloning
    const newProfileBtn = profileBtn.cloneNode(true);
    profileBtn.parentNode.replaceChild(newProfileBtn, profileBtn);
    
    newProfileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('👤 Profile button clicked');
      
      // Update modal with current data before showing
      updateProfileModal();
      profileModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
    
    console.log('✅ Profile button setup complete');
  } else {
    console.warn('⚠️ Profile button not found');
  }

  // Setup close button
  if (closeProfileModal) {
    closeProfileModal.addEventListener('click', () => {
      profileModal.style.display = 'none';
      document.body.style.overflow = 'auto';
    });
  } else {
    console.warn('⚠️ Close profile modal button not found');
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
  } else {
    console.warn('⚠️ Logout button not found');
  }

  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === profileModal) {
      profileModal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  });

  // Close modal with Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && profileModal.style.display === 'flex') {
      profileModal.style.display = 'none';
      document.body.style.overflow = 'auto';
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
      profileDefaultRate.textContent = `$${fmtMoney(currentUserData.defaultRate || 0)}/hour`;
    }
  }

  // Update stats in modal
  updateModalStats();

  console.log('✅ Profile modal updated');
}

function updateModalStats() {
  const modalStatStudents = document.getElementById('modalStatStudents');
  const modalStatHours = document.getElementById('modalStatHours');
  const modalStatEarnings = document.getElementById('modalStatEarnings');
  const modalStatUpdated = document.getElementById('modalStatUpdated');

  // Get current stats from cache
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
    modalStatEarnings.textContent = `$${fmtMoney(totalEarnings)}`;
  }

  if (modalStatUpdated) {
    modalStatUpdated.textContent = new Date().toLocaleString();
  }
}

// Update window exports
window.updateProfileModal = updateProfileModal;
window.setupProfileModal = setupProfileModal;

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

// Update window export with actual implementation
window.switchTab = switchTab;

function getInitialTab() {
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) return hash;
  
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) return activeTab.getAttribute('data-tab');
  
  return 'students';
}

// ===========================
// EDIT/DELETE FUNCTIONS
// ===========================

function editStudent(id) {
  NotificationSystem.notifyInfo(`Edit student ${id} - Feature coming soon`);
}

function deleteStudent(id) {
  if (confirm('Are you sure you want to delete this student?')) {
    NotificationSystem.notifyInfo(`Delete student ${id} - Feature coming soon`);
  }
}

function editMark(id) {
  NotificationSystem.notifyInfo(`Edit mark ${id} - Feature coming soon`);
}

function deleteMark(id) {
  if (confirm('Are you sure you want to delete this mark?')) {
    NotificationSystem.notifyInfo(`Delete mark ${id} - Feature coming soon`);
  }
}

// Update window exports with actual implementations
window.editStudent = editStudent;
window.deleteStudent = deleteStudent;
window.editMark = editMark;
window.deleteMark = deleteMark;

// ===========================
// INITIALIZATION
// ===========================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🏠 DOM fully loaded, starting app...');
  
  // Initialize core systems
  injectThemeStyles();
  initializeTheme();
  NotificationSystem.initNotificationStyles();
  EnhancedCache.loadCachedData();
  EnhancedStats.init();
  
  // Setup UI components
  setupTabNavigation();
  setupFormHandlers();
  setupProfileModal();
  
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

console.log('✅ Worklog App fully initialized with all functions');
