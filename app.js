// ===========================
// IMPORTS - FIREBASE V10
// ===========================

import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  getDocs,
  writeBatch,
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
  lastSync: null
};

const EnhancedCache = {
  async saveWithBackgroundSync(collectionName, data, id = null) {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No user authenticated for cache save');
      NotificationSystem.notifyError('Please sign in to save data');
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

      this.saveToLocalStorage(collectionName, cacheItem);
      this.updateUICache(collectionName, cacheItem);
      
      // Background sync
      setTimeout(() => {
        this.backgroundFirebaseSync(collectionName, cacheItem, user.uid);
      }, 100);
      
      console.log(`✅ ${collectionName} saved to cache for user: ${user.email}`);
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
      const filtered = existing.filter(i => i._id !== item._id);
      filtered.push(item);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch (error) {
      console.error('❌ localStorage save failed:', error);
    }
  },

  updateUICache(collectionName, item) {
    if (!Array.isArray(cache[collectionName])) {
      cache[collectionName] = [];
    }
    
    const index = cache[collectionName].findIndex(i => i._id === item._id);
    if (index >= 0) {
      cache[collectionName][index] = item;
    } else {
      cache[collectionName].push(item);
    }
    cache.lastSync = Date.now();
  },

  async backgroundFirebaseSync(collectionName, item, uid) {
    try {
      const { _id, _cachedAt, _synced, ...firebaseData } = item;
      let result;
      
      if (item._id.startsWith('cache_')) {
        const docRef = await addDoc(collection(db, "users", uid, collectionName), firebaseData);
        result = docRef.id;
      } else {
        await updateDoc(doc(db, "users", uid, collectionName, item._id), firebaseData);
        result = item._id;
      }
      
      this.markAsSynced(collectionName, item._id, result);
      console.log(`☁️ Background sync successful: ${collectionName} - ${item._id}`);
      
      // Refresh stats after successful sync
      setTimeout(() => EnhancedStats.forceRefresh(), 500);
    } catch (error) {
      console.error(`❌ Background sync failed for ${collectionName}:`, error);
    }
  },

  markAsSynced(collectionName, cacheId, firebaseId) {
    const key = `worklog_${collectionName}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = existing.map(item => 
      item._id === cacheId ? { ...item, _synced: true, _firebaseId: firebaseId } : item
    );
    localStorage.setItem(key, JSON.stringify(updated));
    
    if (cache[collectionName] && Array.isArray(cache[collectionName])) {
      cache[collectionName] = cache[collectionName].map(item =>
        item._id === cacheId ? { ...item, _synced: true, _firebaseId: firebaseId } : item
      );
    }
  },

  loadCachedData() {
    const collections = ['students', 'hours'];
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
    
    // Retry unsynced items after a delay
    setTimeout(() => this.retryUnsyncedItems(), 2000);
  },

  async retryUnsyncedItems() {
    const collections = ['students', 'hours'];
    const user = auth.currentUser;
    if (!user) {
      console.log('🔄 No user found for retry - will try again later');
      return;
    }

    console.log(`🔄 Retrying sync for user: ${user.email}`);
    
    collections.forEach(collectionName => {
      const key = `worklog_${collectionName}`;
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(cached)) {
          const unsynced = cached.filter(item => !item._synced);
          unsynced.forEach(item => {
            console.log(`🔄 Retrying sync for ${collectionName}: ${item._id}`);
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
    if (!user) {
      console.log(`❌ No user for ${collectionName} load - checking localStorage`);
      return this.loadFromLocalStorage(collectionName);
    }

    console.log(`🔄 Loading ${collectionName} for user: ${user.email}`);

    // 1. Check memory cache first
    if (!forceRefresh && Array.isArray(cache[collectionName]) && cache[collectionName].length > 0) {
      return cache[collectionName];
    }

    // 2. Check localStorage cache
    const localStorageData = this.loadFromLocalStorage(collectionName);
    if (!forceRefresh && localStorageData.length > 0) {
      cache[collectionName] = localStorageData;
      return localStorageData;
    }

    // 3. Load from Firestore
    try {
      console.log(`☁️ Loading ${collectionName} from Firestore for user: ${user.uid}`);
      const querySnapshot = await getDocs(collection(db, "users", user.uid, collectionName));
      const data = [];
      
      querySnapshot.forEach((docSnap) => {
        data.push({
          id: docSnap.id,
          ...docSnap.data(),
          _firebaseId: docSnap.id,
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
      
      // Fallback to localStorage
      return this.loadFromLocalStorage(collectionName);
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
  const hours = safeNumber(document.getElementById('hoursWorked')?.value);
  const rate = safeNumber(document.getElementById('baseRate')?.value);
  const total = hours * rate;
  
  const totalPayElement = document.getElementById('totalPay');
  if (totalPayElement) {
    totalPayElement.textContent = `$${fmtMoney(total)}`;
  }
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

function formatStudentDisplay(student) {
  if (!student) return 'Unknown Student';
  
  if (typeof student === 'string') {
    return student;
  }
  
  if (typeof student === 'object') {
    const name = student.name || `Student ${student.id}`;
    return name;
  }
  
  return 'Unknown Student';
}

// ===========================
// ENHANCED REAL-TIME STATS SYSTEM
// ===========================

const EnhancedStats = {
  init() {
    console.log('✅ Enhanced stats system initialized');
    this.setupStatsUpdaters();
    this.startStatsRefresh();
  },

  setupStatsUpdaters() {
    this.updateStudentStats = this.debounce(() => this.calculateStudentStats(), 500);
    this.updateHoursStats = this.debounce(() => this.calculateHoursStats(), 500);
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
    // Refresh stats every 30 seconds
    setInterval(() => {
      this.refreshAllStats();
    }, 30000);
  },

  async refreshAllStats() {
    try {
      await Promise.all([
        this.calculateStudentStats(),
        this.calculateHoursStats()
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
        const totalRate = students.reduce((sum, student) => sum + safeNumber(student.rate), 0);
        averageRate = totalRate / studentCount;
      }
      
      this.updateElement('studentCount', studentCount);
      this.updateElement('averageRate', `$${fmtMoney(averageRate)}`);
      this.updateElement('totalStudentsCount', studentCount);
      
    } catch (error) {
      console.error('Error calculating student stats:', error);
    }
  },

  async calculateHoursStats() {
    try {
      const hours = await EnhancedCache.loadCollection('hours');
      
      const now = new Date();
      const today = getLocalDateString(now);
      
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const weeklyData = hours.filter(entry => {
        const entryDate = entry.date || entry.dateIso;
        try {
          const entryDateObj = new Date(entryDate);
          return entryDateObj >= weekStart && entryDateObj <= now;
        } catch {
          return false;
        }
      });
      
      const monthlyData = hours.filter(entry => {
        const entryDate = entry.date || entry.dateIso;
        try {
          const entryDateObj = new Date(entryDate);
          return entryDateObj >= monthStart && entryDateObj <= now;
        } catch {
          return false;
        }
      });
      
      const weeklyHours = weeklyData.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
      const weeklyTotal = weeklyData.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
      
      const monthlyHours = monthlyData.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
      const monthlyTotal = monthlyData.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
      
      this.updateElement('weeklyHours', weeklyHours.toFixed(1));
      this.updateElement('weeklyTotal', `$${fmtMoney(weeklyTotal)}`);
      this.updateElement('monthlyHours', monthlyHours.toFixed(1));
      this.updateElement('monthlyTotal', `$${fmtMoney(monthlyTotal)}`);
      
    } catch (error) {
      console.error('Error calculating hours stats:', error);
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
// DATA RENDERING FUNCTIONS
// ===========================

async function renderStudents(forceRefresh = false) {
  const container = document.getElementById('studentsContainer');
  if (!container) return;

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

// ===========================
// HOURS MANAGEMENT FUNCTIONS
// ===========================

async function startEditHours(id) {
  try {
    const hours = await EnhancedCache.loadCollection('hours');
    const entry = hours.find(h => h.id === id);
    
    if (!entry) {
      NotificationSystem.notifyError('Hours entry not found');
      return;
    }

    currentEditHoursId = id;
    
    // Populate form fields
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
    
    fields.forEach(field => {
      const element = document.getElementById(field.id);
      if (element) {
        element.value = field.value;
      }
    });
    
    // Update submit button
    const submitBtn = document.querySelector('#hoursForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = 'Update Hours';
      
      // Remove existing cancel button
      const existingCancelBtn = document.querySelector('#hoursForm button[type="button"]');
      if (existingCancelBtn) {
        existingCancelBtn.remove();
      }
      
      // Add cancel button
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel Edit';
      cancelBtn.className = 'btn-secondary';
      cancelBtn.onclick = cancelEditHours;
      submitBtn.parentNode.appendChild(cancelBtn);
    }
    
    NotificationSystem.notifyInfo('Edit mode activated');
    
  } catch (error) {
    console.error('Error starting edit:', error);
    NotificationSystem.notifyError('Failed to start editing');
  }
}

function cancelEditHours() {
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
  
  NotificationSystem.notifyInfo('Edit cancelled');
}

async function deleteHours(id) {
  if (!confirm('Are you sure you want to delete this hours entry?')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please sign in to delete hours');
      return;
    }

    const hours = await EnhancedCache.loadCollection('hours');
    const entry = hours.find(h => h.id === id);
    
    if (entry && entry._firebaseId) {
      await deleteDoc(doc(db, "users", user.uid, "hours", entry._firebaseId));
    }

    const updatedHours = hours.filter(h => h.id !== id);
    cache.hours = updatedHours;
    EnhancedCache.saveToLocalStorageBulk('hours', updatedHours);

    await renderRecentHoursWithEdit();
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
  if (!user) {
    NotificationSystem.notifyError('Please sign in to log hours');
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
      NotificationSystem.notifySuccess('Hours logged successfully!');
      e.target.reset();
    }
    
    EnhancedStats.forceRefresh();
    await renderRecentHoursWithEdit();
    
  } catch (error) {
    console.error('Error saving hours:', error);
    NotificationSystem.notifyError('Failed to save hours');
  }
}

// ===========================
// STUDENT DROPDOWN MANAGEMENT
// ===========================

async function populateStudentDropdowns() {
  const user = auth.currentUser;
  if (!user) {
    console.log('❌ No user found for dropdown population');
    return;
  }

  try {
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

    dropdownSelectors.forEach(selector => {
      const dropdown = document.querySelector(selector);
      if (dropdown) {
        populateSingleDropdown(dropdown, students);
      }
    });

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
  
  // Clear existing options
  while (dropdown.options.length > 0) {
    dropdown.remove(0);
  }

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
  } else if (currentIndex > 0 && dropdown.options.length > currentIndex) {
    dropdown.selectedIndex = currentIndex;
  }

  console.log(`✅ Populated ${dropdown.id} with ${students.length} students`);
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
  
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
  }
  
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
    
    const hoursInput = document.getElementById('hoursWorked');
    const baseRateInput = document.getElementById('baseRate');
    
    if (hoursInput) hoursInput.addEventListener('input', calculateTotalPay);
    if (baseRateInput) baseRateInput.addEventListener('input', calculateTotalPay);
    
    calculateTotalPay();
  }
  
  console.log('✅ Form handlers initialized');
}

// ===========================
// STUDENT FORM FUNCTIONS
// ===========================

async function handleStudentSubmit(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
        NotificationSystem.notifyError('Please sign in to add students');
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

    try {
        await EnhancedCache.saveWithBackgroundSync('students', studentData);
        NotificationSystem.notifySuccess('Student added successfully!');
        e.target.reset();
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
// USER PROFILE FUNCTIONS
// ===========================

// Add this flag at the top of your file
let isFirestoreInitialized = false;

async function loadUserProfile(uid) {
  console.log('👤 Loading user profile for:', uid);
  
  const user = auth.currentUser;
  
  // Check if we're offline first
  if (!navigator.onLine) {
    console.log('📴 Offline mode - using cached data');
    return getCachedProfile(uid, user);
  }
  
  let memberSince = localStorage.getItem('memberSince');
  if (!memberSince) {
    memberSince = new Date().toISOString();
    localStorage.setItem('memberSince', memberSince);
  }
  
  const fallbackProfile = {
    email: user?.email || '',
    createdAt: memberSince,
    defaultRate: parseFloat(localStorage.getItem('userDefaultRate')) || 0,
    memberSince: memberSince,
    uid: uid
  };
  
  try {
    // Initialize Firestore with offline persistence if not done
    await ensureFirestoreReady();
    
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      currentUserData = { uid, ...userSnap.data() };
      
      if (!currentUserData.memberSince) {
        currentUserData.memberSince = memberSince;
        await updateDoc(userRef, { memberSince: memberSince });
      }
      
      console.log('✅ User profile loaded from Firestore for:', user.email);
      
      if (currentUserData.defaultRate !== undefined) {
        localStorage.setItem('userDefaultRate', currentUserData.defaultRate.toString());
      }
      
      // Cache the profile
      cacheProfile(uid, currentUserData);
      
      return currentUserData;
    } else {
      const profileToCreate = {
        ...fallbackProfile,
        lastLogin: new Date().toISOString(),
        memberSince: memberSince
      };
      
      await setDoc(userRef, profileToCreate);
      
      currentUserData = { uid, ...profileToCreate };
      console.log('✅ Created new user profile for:', user.email);
      
      // Cache the new profile
      cacheProfile(uid, currentUserData);
      
      return currentUserData;
    }
  } catch (err) {
    console.warn("⚠️ Error loading user profile, using cached data:", err.message);
    return getCachedProfile(uid, user, fallbackProfile);
  }
}

// ===========================
// HELPER FUNCTIONS
// ===========================

async function ensureFirestoreReady() {
  if (isFirestoreInitialized) return;
  
  try {
    // Enable offline persistence
    await enableIndexedDbPersistence(db);
    console.log('✅ Firestore offline persistence enabled');
    isFirestoreInitialized = true;
  } catch (err) {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Multiple tabs open, persistence can only be enabled in one tab');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Browser doesn\'t support persistence');
    } else {
      console.error('❌ Error enabling persistence:', err);
    }
    isFirestoreInitialized = true; // Still mark as initialized
  }
}

function getCachedProfile(uid, user, fallbackProfile = null) {
  const cachedKey = `cached_profile_${uid}`;
  const cachedData = localStorage.getItem(cachedKey);
  
  if (cachedData) {
    try {
      const profile = JSON.parse(cachedData);
      console.log('📦 Using cached profile data');
      return profile;
    } catch (e) {
      console.log('❌ Error parsing cached profile');
    }
  }
  
  // Return fallback if no cache
  if (fallbackProfile) {
    return fallbackProfile;
  }
  
  // Create basic fallback
  return {
    email: user?.email || '',
    createdAt: new Date().toISOString(),
    defaultRate: parseFloat(localStorage.getItem('userDefaultRate')) || 0,
    memberSince: localStorage.getItem('memberSince') || new Date().toISOString(),
    uid: uid
  };
}

function cacheProfile(uid, profileData) {
  const cacheKey = `cached_profile_${uid}`;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(profileData));
    console.log('💾 Profile cached locally');
  } catch (e) {
    console.warn('⚠️ Could not cache profile (localStorage may be full)');
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
    button.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(tabName);
    });
  });
  
  const initialTab = getInitialTab();
  console.log(`📑 Initial tab: ${initialTab}`);
  setTimeout(() => {
    switchTab(initialTab);
  }, 100);
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
  
  if (!tabName) return;
  
  window.location.hash = tabName;
  
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeButtons = document.querySelectorAll(`.tab[data-tab="${tabName}"]`);
  activeButtons.forEach(btn => {
    btn.classList.add('active');
  });
  
  const allTabContents = document.querySelectorAll('.tabcontent');
  allTabContents.forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
  
  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.classList.add('active');
    targetTab.style.display = 'block';
    console.log(`✅ Successfully showing: ${tabName}`);
  }
}

// ===========================
// AUTHENTICATION CHECK
// ===========================

async function checkAuthStatus() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// ===========================
// INITIALIZATION
// ===========================

async function initializeApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  // Initialize notification system first
  NotificationSystem.initNotificationStyles();
  
  // Check auth status with timeout
  let user = null;
  try {
    // Wait for auth state to be determined
    user = await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
      
      // Timeout after 3 seconds
      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 3000);
    });
  } catch (error) {
    console.error('❌ Auth check error:', error);
    user = null;
  }
  
  if (user) {
    console.log('✅ User authenticated:', user.email, 'UID:', user.uid);
    
    // Load user profile and data
    await loadUserProfile(user.uid);
    EnhancedCache.loadCachedData();
    
    // Initialize systems
    setupTabNavigation();
    setupFormHandlers();
    EnhancedStats.init();
    
    // Load and render initial data
    await Promise.all([
      renderStudents(),
      renderRecentHoursWithEdit(),
      populateStudentDropdowns()
    ]);
    
    // Refresh stats
    EnhancedStats.forceRefresh();
    
    console.log('✅ App initialization complete');
    
  } else {
    console.log('⚠️ No user signed in or auth timeout');
    
    // Check if we're already on the auth page
    if (window.location.pathname.includes('auth.html')) {
      console.log('Already on auth page');
      return;
    }
    
    // Try to check if auth.html exists before redirecting
    try {
      const response = await fetch('auth.html');
      if (response.ok) {
        console.log('Redirecting to auth.html...');
        window.location.href = 'auth.html';
      } else {
        console.error('auth.html not found, staying on page');
        // Initialize without auth
        setupTabNavigation();
        setupFormHandlers();
        NotificationSystem.notifyWarning('Working in offline mode. Data will be saved locally only.');
      }
    } catch (error) {
      console.error('Error checking for auth.html:', error);
      // Initialize without auth
      setupTabNavigation();
      setupFormHandlers();
      NotificationSystem.notifyInfo('Working offline. Sign in to sync across devices.');
    }
  }
}

// ===========================
// FIX FOR MISSING AUTH.HTML
// ===========================

// Alternative: Create a simple inline auth check
function checkAuthAndInitialize() {
  // Check if we're on the index page
  if (window.location.pathname.includes('index.html') || 
      window.location.pathname === '/' || 
      window.location.pathname.endsWith('.github.io/') ||
      window.location.pathname.endsWith('.github.io/WorkLogPro/')) {
    
    // Check auth state
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('✅ User is signed in:', user.email);
        // User is signed in, continue with app initialization
        fullAppInitialization(user);
      } else {
        console.log('⚠️ No user signed in');
        
        // Check if auth.html exists
        fetch('auth.html')
          .then(response => {
            if (response.ok) {
              console.log('Redirecting to auth.html');
              window.location.href = 'auth.html';
            } else {
              console.log('auth.html not found, continuing in offline mode');
              setupTabNavigation();
              setupFormHandlers();
              NotificationSystem.notifyInfo('Working offline. Sign in to sync across devices.');
            }
          })
          .catch(error => {
            console.log('Error checking auth.html, continuing offline:', error);
            setupTabNavigation();
            setupFormHandlers();
            NotificationSystem.notifyInfo('Working offline. Sign in to sync across devices.');
          });
      }
    });
  } else if (window.location.pathname.includes('auth.html')) {
    // We're on the auth page, let auth.html handle its own logic
    console.log('On auth page');
  }
}

async function fullAppInitialization(user) {
  console.log('🔄 Starting full app initialization for user:', user.email);
  
  // Load user profile and data
  await loadUserProfile(user.uid);
  EnhancedCache.loadCachedData();
  
  // Initialize systems
  setupTabNavigation();
  setupFormHandlers();
  EnhancedStats.init();
  
  // Load and render initial data
  await Promise.all([
    renderStudents(),
    renderRecentHoursWithEdit(),
    populateStudentDropdowns()
  ]);
  
  // Refresh stats
  EnhancedStats.forceRefresh();
  
  console.log('✅ Full app initialization complete');
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM Content Loaded - Starting app...');
  
  // Use the safer initialization method
  checkAuthAndInitialize();
});
