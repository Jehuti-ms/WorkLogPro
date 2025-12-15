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
let currentEditId = null;
let currentEditType = null;

// Cache system
const cache = {
  students: [],
  hours: [],
  marks: [],
  attendance: [],
  payments: [],
  lastSync: null
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

    for (const collectionName of collections) {
      const key = `worklog_${collectionName}`;
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(cached)) {
          const unsynced = cached.filter(item => !item._synced);
          for (const item of unsynced) {
            console.log(`🔄 Retrying sync for ${collectionName}: ${item.id}`);
            await this.backgroundFirebaseSync(collectionName, item, user.uid);
          }
        }
      } catch (error) {
        console.error(`❌ Error retrying sync for ${collectionName}:`, error);
      }
    }
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

// ===========================
// FORM ID CONFIGURATION
// ===========================

const FORM_IDS = {
  STUDENT: {
    name: 'studentName',
    id: 'studentId',
    gender: 'studentGender',
    subject: 'studentSubject',
    email: 'studentEmail',
    phone: 'studentPhone',
    rate: 'studentRate',
    notes: 'studentNotes',
    submitBtn: 'studentSubmitBtn',
    cancelBtn: 'studentCancelBtn',
    form: 'studentForm'
  },
  HOURS: {
    organization: 'organization',
    workType: 'workType',
    subject: 'workSubject',
    student: 'hoursStudent',
    hours: 'hoursWorked',
    rate: 'baseRate',
    date: 'workDate',
    notes: 'hoursNotes',
    submitBtn: 'hoursSubmitBtn',
    cancelBtn: 'hoursCancelBtn',
    form: 'hoursForm',
    totalPay: 'totalPay'
  },
  MARKS: {
    student: 'marksStudent',
    subject: 'marksSubject',
    topic: 'marksTopic',
    score: 'marksScore',
    max: 'marksMax',
    date: 'marksDate',
    notes: 'marksNotes',
    submitBtn: 'marksSubmitBtn',
    cancelBtn: 'marksCancelBtn',
    form: 'marksForm'
  },
  ATTENDANCE: {
    subject: 'attendanceSubject',
    topic: 'attendanceTopic',
    date: 'attendanceDate',
    notes: 'attendanceNotes',
    studentsContainer: 'attendanceStudents',
    submitBtn: 'attendanceSubmitBtn',
    cancelBtn: 'attendanceCancelBtn',
    form: 'attendanceForm'
  },
  PAYMENT: {
    student: 'paymentStudent',
    amount: 'paymentAmount',
    method: 'paymentMethod',
    date: 'paymentDate',
    notes: 'paymentNotes',
    submitBtn: 'paymentSubmitBtn',
    cancelBtn: 'paymentCancelBtn',
    form: 'paymentForm'
  }
};

// ===========================
// EDIT MODE MANAGEMENT
// ===========================

function setEditMode(type, id) {
  currentEditType = type;
  currentEditId = id;
  
  // Show cancel button for the current form
  const cancelBtn = document.getElementById(FORM_IDS[type].cancelBtn);
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
  }
  
  // Update submit button text
  const submitBtn = document.getElementById(FORM_IDS[type].submitBtn);
  if (submitBtn) {
    submitBtn.textContent = type === 'STUDENT' ? 'Update Student' : 
                           type === 'HOURS' ? 'Update Hours' :
                           type === 'MARKS' ? 'Update Marks' :
                           type === 'ATTENDANCE' ? 'Update Attendance' :
                           'Update Payment';
    submitBtn.classList.remove('primary');
    submitBtn.classList.add('warning');
  }
}

function cancelEditMode() {
  if (!currentEditType) return;
  
  // Reset form
  const form = document.getElementById(FORM_IDS[currentEditType].form);
  if (form) {
    form.reset();
  }
  
  // Hide cancel button
  const cancelBtn = document.getElementById(FORM_IDS[currentEditType].cancelBtn);
  if (cancelBtn) {
    cancelBtn.style.display = 'none';
  }
  
  // Reset submit button
  const submitBtn = document.getElementById(FORM_IDS[currentEditType].submitBtn);
  if (submitBtn) {
    submitBtn.textContent = currentEditType === 'STUDENT' ? '➕ Add Student' : 
                           currentEditType === 'HOURS' ? 'Log Hours' :
                           currentEditType === 'MARKS' ? 'Add Marks' :
                           currentEditType === 'ATTENDANCE' ? 'Record Attendance' :
                           'Add Payment';
    submitBtn.classList.remove('warning');
    submitBtn.classList.add('primary');
  }
  
  // Clear edit state
  currentEditType = null;
  currentEditId = null;
}

// ===========================
// FORM HANDLERS
// ===========================

async function handleStudentSubmit(e) {
  if (e) e.preventDefault();
  
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to add students');
    return;
  }

  // Get form values
  const name = document.getElementById(FORM_IDS.STUDENT.name)?.value.trim();
  const studentId = document.getElementById(FORM_IDS.STUDENT.id)?.value.trim();
  const gender = document.getElementById(FORM_IDS.STUDENT.gender)?.value;
  const subject = document.getElementById(FORM_IDS.STUDENT.subject)?.value;
  const email = document.getElementById(FORM_IDS.STUDENT.email)?.value;
  const phone = document.getElementById(FORM_IDS.STUDENT.phone)?.value;
  const rate = safeNumber(document.getElementById(FORM_IDS.STUDENT.rate)?.value);
  const notes = document.getElementById(FORM_IDS.STUDENT.notes)?.value;

  // Validate required fields
  if (!name || !studentId || !gender) {
    NotificationSystem.notifyError('Please fill in all required fields (Name, ID, Gender)');
    return;
  }

  const studentData = {
    name,
    studentId,
    gender,
    subject: subject || '',
    email: email || '',
    phone: phone || '',
    rate,
    hourlyRate: rate,
    notes: notes || '',
    updatedAt: new Date().toISOString()
  };

  try {
    if (currentEditType === 'STUDENT' && currentEditId) {
      // Update existing student
      await updateDoc(doc(db, "users", user.uid, "students", currentEditId), studentData);
      
      // Update cache
      const index = cache.students.findIndex(s => s.id === currentEditId);
      if (index !== -1) {
        cache.students[index] = { ...cache.students[index], ...studentData, id: currentEditId };
        EnhancedCache.saveToLocalStorageBulk('students', cache.students);
      }
      
      NotificationSystem.notifySuccess(`Student "${name}" updated successfully!`);
      cancelEditMode();
    } else {
      // Create new student
      studentData.createdAt = new Date().toISOString();
      const result = await EnhancedCache.saveWithBackgroundSync('students', studentData);
      if (result) {
        NotificationSystem.notifySuccess(`Student "${name}" added successfully!`);
      }
    }
    
    // Clear form if not in edit mode
    if (currentEditType !== 'STUDENT') {
      const form = document.getElementById(FORM_IDS.STUDENT.form);
      if (form) form.reset();
    }
    
    // Refresh UI
    await renderStudents();
    await populateStudentDropdowns();
    
    // Refresh stats
    await recalcSummaryStats(user.uid);
    
  } catch (error) {
    console.error('Error saving student:', error);
    NotificationSystem.notifyError('Failed to save student: ' + error.message);
  }
}

async function handleHoursSubmit(e) {
  if (e) e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to log hours');
    return;
  }

  // Get form values
  const organization = document.getElementById(FORM_IDS.HOURS.organization)?.value;
  const workType = document.getElementById(FORM_IDS.HOURS.workType)?.value;
  const subject = document.getElementById(FORM_IDS.HOURS.subject)?.value;
  const student = document.getElementById(FORM_IDS.HOURS.student)?.value;
  const hours = safeNumber(document.getElementById(FORM_IDS.HOURS.hours)?.value);
  const rate = safeNumber(document.getElementById(FORM_IDS.HOURS.rate)?.value);
  const date = document.getElementById(FORM_IDS.HOURS.date)?.value;
  const notes = document.getElementById(FORM_IDS.HOURS.notes)?.value;

  // Validate required fields
  if (!organization || hours <= 0 || rate <= 0 || !date) {
    NotificationSystem.notifyError('Please fill in all required fields with valid values');
    return;
  }

  const hoursData = {
    organization,
    workType: workType || '',
    subject: subject || '',
    student: student || '',
    hours,
    rate,
    total: hours * rate,
    date,
    dateIso: fmtDateISO(date),
    notes: notes || '',
    updatedAt: new Date().toISOString()
  };

  try {
    if (currentEditType === 'HOURS' && currentEditId) {
      // Update existing entry
      await updateDoc(doc(db, "users", user.uid, "hours", currentEditId), hoursData);
      
      // Update cache
      const index = cache.hours.findIndex(h => h.id === currentEditId);
      if (index !== -1) {
        cache.hours[index] = { ...cache.hours[index], ...hoursData, id: currentEditId };
        EnhancedCache.saveToLocalStorageBulk('hours', cache.hours);
      }
      
      NotificationSystem.notifySuccess('Hours updated successfully!');
      cancelEditMode();
    } else {
      // Create new entry
      hoursData.createdAt = new Date().toISOString();
      const result = await EnhancedCache.saveWithBackgroundSync('hours', hoursData);
      if (result) {
        NotificationSystem.notifySuccess('Hours logged successfully!');
      }
    }
    
    // Clear form if not in edit mode
    if (currentEditType !== 'HOURS') {
      const form = document.getElementById(FORM_IDS.HOURS.form);
      if (form) form.reset();
    }
    
    // Refresh UI
    await renderRecentHoursWithEdit();
    
    // Refresh stats
    await recalcSummaryStats(user.uid);
    
  } catch (error) {
    console.error('Error saving hours:', error);
    NotificationSystem.notifyError('Failed to save hours: ' + error.message);
  }
}

async function handleMarksSubmit(e) {
  if (e) e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to add marks');
    return;
  }

  const form = document.getElementById(FORM_IDS.MARKS.form);
  const isEditing = currentEditType === 'MARKS' && currentEditId;
  
  // Get form values
  const student = document.getElementById(FORM_IDS.MARKS.student)?.value;
  const subject = document.getElementById(FORM_IDS.MARKS.subject)?.value;
  const topic = document.getElementById(FORM_IDS.MARKS.topic)?.value;
  const score = safeNumber(document.getElementById(FORM_IDS.MARKS.score)?.value);
  const max = safeNumber(document.getElementById(FORM_IDS.MARKS.max)?.value);
  const date = document.getElementById(FORM_IDS.MARKS.date)?.value;
  const notes = document.getElementById(FORM_IDS.MARKS.notes)?.value;
  const percentage = max > 0 ? (score / max) * 100 : 0;

  // Validate required fields
  if (!student || !subject || max <= 0 || !date) {
    NotificationSystem.notifyError('Please fill in all required fields with valid values');
    return;
  }

  const marksData = {
    student,
    subject,
    topic: topic || '',
    score,
    marks: score,
    max,
    maxMarks: max,
    percentage,
    grade: calculateGrade(percentage),
    date,
    dateIso: fmtDateISO(date),
    notes: notes || '',
    updatedAt: new Date().toISOString()
  };

  try {
    if (isEditing) {
      // Update existing entry
      await updateDoc(doc(db, "users", user.uid, "marks", currentEditId), marksData);
      
      // Update cache
      const index = cache.marks.findIndex(m => m.id === currentEditId);
      if (index !== -1) {
        cache.marks[index] = { ...cache.marks[index], ...marksData, id: currentEditId };
        EnhancedCache.saveToLocalStorageBulk('marks', cache.marks);
      }
      
      NotificationSystem.notifySuccess(`Mark updated: ${score}/${max} (${percentage.toFixed(1)}%)`);
      cancelEditMode();
    } else {
      // Create new entry
      marksData.createdAt = new Date().toISOString();
      const result = await EnhancedCache.saveWithBackgroundSync('marks', marksData);
      if (result) {
        NotificationSystem.notifySuccess(`Mark added: ${score}/${max} (${percentage.toFixed(1)}%)`);
      }
    }
    
    // Clear form if not in edit mode
    if (!isEditing) {
      const form = document.getElementById(FORM_IDS.MARKS.form);
      if (form) form.reset();
    }
    
    // Refresh UI
    await renderRecentMarksWithEdit();
    
  } catch (error) {
    console.error('Error saving marks:', error);
    NotificationSystem.notifyError('Failed to save marks: ' + error.message);
  }
}

async function handleAttendanceSubmit(e) {
  if (e) e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to record attendance');
    return;
  }

  const form = document.getElementById(FORM_IDS.ATTENDANCE.form);
  const isEditing = currentEditType === 'ATTENDANCE' && currentEditId;
  
  // Get form values
  const subject = document.getElementById(FORM_IDS.ATTENDANCE.subject)?.value;
  const topic = document.getElementById(FORM_IDS.ATTENDANCE.topic)?.value;
  const date = document.getElementById(FORM_IDS.ATTENDANCE.date)?.value;
  const notes = document.getElementById(FORM_IDS.ATTENDANCE.notes)?.value;
  
  const presentCheckboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]:checked');
  const presentStudents = Array.from(presentCheckboxes).map(cb => cb.value);
  const totalStudents = document.querySelectorAll('#attendanceStudents input[type="checkbox"]').length;

  // Validate required fields
  if (!subject || !date) {
    NotificationSystem.notifyError('Please fill in all required fields');
    return;
  }

  const attendanceData = {
    subject,
    topic: topic || '',
    present: presentStudents,
    totalStudents,
    date,
    dateIso: fmtDateISO(date),
    notes: notes || '',
    status: presentStudents.length > 0 ? 'present' : 'absent',
    updatedAt: new Date().toISOString()
  };

  try {
    if (isEditing) {
      // Update existing entry
      await updateDoc(doc(db, "users", user.uid, "attendance", currentEditId), attendanceData);
      
      // Update cache
      const index = cache.attendance.findIndex(a => a.id === currentEditId);
      if (index !== -1) {
        cache.attendance[index] = { ...cache.attendance[index], ...attendanceData, id: currentEditId };
        EnhancedCache.saveToLocalStorageBulk('attendance', cache.attendance);
      }
      
      NotificationSystem.notifySuccess(`Attendance updated: ${presentStudents.length}/${totalStudents} present`);
      cancelEditMode();
    } else {
      // Create new entry
      attendanceData.createdAt = new Date().toISOString();
      const result = await EnhancedCache.saveWithBackgroundSync('attendance', attendanceData);
      if (result) {
        NotificationSystem.notifySuccess(`Attendance recorded: ${presentStudents.length}/${totalStudents} present`);
      }
    }
    
    // Clear form if not in edit mode
    if (!isEditing) {
      const form = document.getElementById(FORM_IDS.ATTENDANCE.form);
      if (form) form.reset();
    }
    
    // Clear checkboxes
    presentCheckboxes.forEach(cb => cb.checked = false);
    
    // Refresh UI
    await renderAttendanceRecentWithEdit();
    
  } catch (error) {
    console.error('Error saving attendance:', error);
    NotificationSystem.notifyError('Failed to save attendance: ' + error.message);
  }
}

async function handlePaymentSubmit(e) {
  if (e) e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to record payments');
    return;
  }

  const form = document.getElementById(FORM_IDS.PAYMENT.form);
  const isEditing = currentEditType === 'PAYMENT' && currentEditId;
  
  // Get form values
  const student = document.getElementById(FORM_IDS.PAYMENT.student)?.value;
  const amount = safeNumber(document.getElementById(FORM_IDS.PAYMENT.amount)?.value);
  const method = document.getElementById(FORM_IDS.PAYMENT.method)?.value || 'Cash';
  const date = document.getElementById(FORM_IDS.PAYMENT.date)?.value;
  const notes = document.getElementById(FORM_IDS.PAYMENT.notes)?.value;

  // Validate required fields
  if (!student || amount <= 0 || !date) {
    NotificationSystem.notifyError('Please fill in all required fields with valid values');
    return;
  }

  const paymentData = {
    student,
    amount,
    method,
    paymentMethod: method,
    date,
    dateIso: fmtDateISO(date),
    notes: notes || '',
    status: 'Completed',
    updatedAt: new Date().toISOString()
  };

  try {
    if (isEditing) {
      // Update existing entry
      await updateDoc(doc(db, "users", user.uid, "payments", currentEditId), paymentData);
      
      // Update cache
      const index = cache.payments.findIndex(p => p.id === currentEditId);
      if (index !== -1) {
        cache.payments[index] = { ...cache.payments[index], ...paymentData, id: currentEditId };
        EnhancedCache.saveToLocalStorageBulk('payments', cache.payments);
      }
      
      NotificationSystem.notifySuccess(`Payment updated: ${fmtMoney(amount)} from ${student}`);
      cancelEditMode();
    } else {
      // Create new entry
      paymentData.createdAt = new Date().toISOString();
      const result = await EnhancedCache.saveWithBackgroundSync('payments', paymentData);
      if (result) {
        NotificationSystem.notifySuccess(`Payment recorded: ${fmtMoney(amount)} from ${student}`);
      }
    }
    
    // Clear form if not in edit mode
    if (!isEditing) {
      const form = document.getElementById(FORM_IDS.PAYMENT.form);
      if (form) form.reset();
    }
    
    // Refresh UI
    await renderPaymentActivityWithEdit();
    await renderStudentBalancesWithEdit();
    
  } catch (error) {
    console.error('Error saving payment:', error);
    NotificationSystem.notifyError('Failed to save payment: ' + error.message);
  }
}

// ===========================
// RENDER FUNCTIONS
// ===========================

async function renderStudents() {
  try {
    const students = await EnhancedCache.loadCollection('students');
    const container = document.getElementById('studentsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (students.length === 0) {
      container.innerHTML = `
        <div class="no-data-message">
          <p>No students added yet.</p>
          <p>Use the "Add Student" form to get started.</p>
        </div>
      `;
      return;
    }
    
    students.forEach(student => {
      const studentCard = document.createElement('div');
      studentCard.className = 'card';
      studentCard.innerHTML = `
        <div class="card-header">
          <h3>${student.name}</h3>
          <span class="badge ${student.gender === 'Male' ? 'badge-primary' : 'badge-secondary'}">
            ${student.gender}
          </span>
        </div>
        <div class="card-body">
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Student ID:</span>
              <span class="value">${student.studentId || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="label">Subject:</span>
              <span class="value">${student.subject || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="label">Email:</span>
              <span class="value">${student.email || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="label">Phone:</span>
              <span class="value">${student.phone || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="label">Hourly Rate:</span>
              <span class="value">${fmtMoney(student.rate || 0)}</span>
            </div>
          </div>
          ${student.notes ? `<p class="notes"><strong>Notes:</strong> ${student.notes}</p>` : ''}
        </div>
        <div class="card-footer">
          <button class="btn btn-sm btn-primary edit-student-btn" data-id="${student.id}">
            ✏️ Edit
          </button>
          <button class="btn btn-sm btn-danger delete-student-btn" 
                  data-id="${student.id}" 
                  data-name="${student.name}">
            🗑️ Delete
          </button>
        </div>
      `;
      container.appendChild(studentCard);
    });
    
    // Add event listeners for edit and delete
    document.querySelectorAll('.edit-student-btn').forEach(btn => {
      btn.addEventListener('click', handleStudentEdit);
    });
    
    document.querySelectorAll('.delete-student-btn').forEach(btn => {
      btn.addEventListener('click', handleStudentDelete);
    });
    
  } catch (error) {
    console.error('Error rendering students:', error);
    const container = document.getElementById('studentsList');
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <p>Error loading students. Please try again.</p>
          <p>Error: ${error.message}</p>
        </div>
      `;
    }
  }
}

async function renderRecentHoursWithEdit() {
  try {
    const hours = await EnhancedCache.loadCollection('hours');
    const container = document.getElementById('recentHoursTable');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sort by date (newest first)
    const sortedHours = [...hours].sort((a, b) => 
      new Date(b.dateIso || b.date) - new Date(a.dateIso || a.date)
    ).slice(0, 50);
    
    if (sortedHours.length === 0) {
      container.innerHTML = `
        <div class="no-data-message">
          <p>No hours logged yet.</p>
          <p>Use the "Log Hours" form to get started.</p>
        </div>
      `;
      return;
    }
    
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Organization</th>
          <th>Work Type</th>
          <th>Subject</th>
          <th>Student</th>
          <th>Hours</th>
          <th>Rate</th>
          <th>Total</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sortedHours.map(entry => `
          <tr>
            <td>${formatDate(entry.date)}</td>
            <td>${entry.organization || 'N/A'}</td>
            <td>${entry.workType || 'N/A'}</td>
            <td>${entry.subject || 'N/A'}</td>
            <td>${entry.student || 'N/A'}</td>
            <td>${entry.hours?.toFixed(1) || '0.0'}</td>
            <td>${fmtMoney(entry.rate || 0)}</td>
            <td>${fmtMoney(entry.total || 0)}</td>
            <td class="actions">
              <button class="btn-icon edit-hours-btn" 
                      data-id="${entry.id}"
                      data-organization="${entry.organization || ''}"
                      data-worktype="${entry.workType || ''}"
                      data-subject="${entry.subject || ''}"
                      data-student="${entry.student || ''}"
                      data-hours="${entry.hours || 0}"
                      data-rate="${entry.rate || 0}"
                      data-date="${entry.date || ''}"
                      data-notes="${entry.notes || ''}">
                ✏️
              </button>
              <button class="btn-icon delete-hours-btn" 
                      data-id="${entry.id}">
                🗑️
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    container.appendChild(table);
    
    // Add event listeners
    document.querySelectorAll('.edit-hours-btn').forEach(btn => {
      btn.addEventListener('click', handleHoursEdit);
    });
    
    document.querySelectorAll('.delete-hours-btn').forEach(btn => {
      btn.addEventListener('click', handleHoursDelete);
    });
    
  } catch (error) {
    console.error('Error rendering hours:', error);
  }
}

// ===========================
// EDIT HANDLERS
// ===========================

function handleStudentEdit(event) {
  const button = event.currentTarget;
  const studentId = button.dataset.id;
  
  // Find student in cache
  const student = cache.students.find(s => s.id === studentId);
  if (!student) {
    NotificationSystem.notifyError('Student not found in cache');
    return;
  }
  
  // Fill form with student data
  const formIds = FORM_IDS.STUDENT;
  document.getElementById(formIds.name).value = student.name || '';
  document.getElementById(formIds.id).value = student.studentId || '';
  document.getElementById(formIds.gender).value = student.gender || '';
  document.getElementById(formIds.subject).value = student.subject || '';
  document.getElementById(formIds.email).value = student.email || '';
  document.getElementById(formIds.phone).value = student.phone || '';
  document.getElementById(formIds.rate).value = student.rate || '';
  document.getElementById(formIds.notes).value = student.notes || '';
  
  // Set edit mode
  setEditMode('STUDENT', studentId);
  
  // Scroll to form
  document.getElementById('studentFormSection').scrollIntoView({ behavior: 'smooth' });
}

function handleHoursEdit(event) {
  const button = event.currentTarget;
  const entryId = button.dataset.id;
  
  // Find entry in cache
  const entry = cache.hours.find(h => h.id === entryId);
  if (!entry) {
    NotificationSystem.notifyError('Hours entry not found in cache');
    return;
  }
  
  // Fill form with entry data
  const formIds = FORM_IDS.HOURS;
  document.getElementById(formIds.organization).value = entry.organization || '';
  document.getElementById(formIds.workType).value = entry.workType || '';
  document.getElementById(formIds.subject).value = entry.subject || '';
  document.getElementById(formIds.student).value = entry.student || '';
  document.getElementById(formIds.hours).value = entry.hours || '';
  document.getElementById(formIds.rate).value = entry.rate || '';
  document.getElementById(formIds.date).value = entry.date || '';
  document.getElementById(formIds.notes).value = entry.notes || '';
  
  // Update total pay display
  const total = safeNumber(entry.hours) * safeNumber(entry.rate);
  const totalPayElement = document.getElementById(formIds.totalPay);
  if (totalPayElement) {
    totalPayElement.textContent = fmtMoney(total);
  }
  
  // Set edit mode
  setEditMode('HOURS', entryId);
  
  // Scroll to form
  document.getElementById('hoursFormSection').scrollIntoView({ behavior: 'smooth' });
}

// ===========================
// DELETE HANDLERS
// ===========================

async function handleStudentDelete(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const button = event.target.closest('.delete-student-btn');
  if (!button) return;
  
  const studentId = button.dataset.id;
  const studentName = button.dataset.name || 'this student';
  
  if (!confirm(`Are you sure you want to delete "${studentName}"? This will also delete all associated hours, marks, attendance, and payment records!`)) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete student');
      return;
    }
    
    // Delete the student
    await deleteDoc(doc(db, "users", user.uid, "students", studentId));
    
    // Update cache
    cache.students = cache.students.filter(s => s.id !== studentId);
    EnhancedCache.saveToLocalStorageBulk('students', cache.students);
    
    // Refresh UI
    await renderStudents();
    await populateStudentDropdowns();
    
    NotificationSystem.notifySuccess(`Student "${studentName}" deleted successfully`);
    
  } catch (error) {
    console.error('Error deleting student:', error);
    NotificationSystem.notifyError('Failed to delete student: ' + error.message);
  }
}

async function handleHoursDelete(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const button = event.target.closest('.delete-hours-btn');
  if (!button) return;
  
  const entryId = button.dataset.id;
  
  if (!confirm('Are you sure you want to delete this hours entry?')) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete hours');
      return;
    }
    
    await deleteDoc(doc(db, "users", user.uid, "hours", entryId));
    
    // Update cache
    cache.hours = cache.hours.filter(h => h.id !== entryId);
    EnhancedCache.saveToLocalStorageBulk('hours', cache.hours);
    
    // Refresh UI
    await renderRecentHoursWithEdit();
    await recalcSummaryStats(user.uid);
    
    NotificationSystem.notifySuccess('Hours entry deleted successfully');
    
  } catch (error) {
    console.error('Error deleting hours:', error);
    NotificationSystem.notifyError('Failed to delete hours: ' + error.message);
  }
}

// ===========================
// INITIALIZATION
// ===========================

async function initApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  // Initialize notification system
  NotificationSystem.initNotificationStyles();
  
  // Load cached data
  EnhancedCache.loadCachedData();
  
  // Set up auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('👤 User signed in:', user.email);
      currentUserData = user;
      
      // Load initial data
      await Promise.all([
        EnhancedCache.loadCollection('students'),
        EnhancedCache.loadCollection('hours')
      ]);
      
      // Initialize UI
      await initUI();
      
    } else {
      console.log('👤 No user signed in');
      currentUserData = null;
      showLoginScreen();
    }
  });
  
  // Set up form event listeners
  setupFormListeners();
}

async function initUI() {
  console.log('🎨 Initializing UI...');
  
  // Initial render
  await renderStudents();
  await renderRecentHoursWithEdit();
  await populateStudentDropdowns();
  
  // Calculate summary stats
  const user = auth.currentUser;
  if (user) {
    await recalcSummaryStats(user.uid);
  }
  
  console.log('✅ UI initialized');
}

function setupFormListeners() {
  // Student form
  const studentForm = document.getElementById(FORM_IDS.STUDENT.form);
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
    
    const cancelBtn = document.getElementById(FORM_IDS.STUDENT.cancelBtn);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEditMode);
    }
  }
  
  // Hours form
  const hoursForm = document.getElementById(FORM_IDS.HOURS.form);
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
    
    const cancelBtn = document.getElementById(FORM_IDS.HOURS.cancelBtn);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEditMode);
    }
  }
}

async function recalcSummaryStats(uid) {
  try {
    const hours = await EnhancedCache.loadCollection('hours');
    
    // Calculate total hours and earnings
    let totalHours = 0;
    let totalEarnings = 0;
    
    hours.forEach(entry => {
      const entryHours = safeNumber(entry.hours);
      const entryRate = safeNumber(entry.rate);
      const entryTotal = entryHours * entryRate;
      
      totalHours += entryHours;
      totalEarnings += entryTotal;
    });
    
    // Update UI
    updateSummaryUI({
      totalHours: totalHours.toFixed(1),
      totalEarnings: fmtMoney(totalEarnings),
      totalStudents: cache.students?.length || 0
    });
    
  } catch (error) {
    console.error('Error calculating summary stats:', error);
  }
}

function updateSummaryUI(stats) {
  const statElements = {
    totalHours: document.getElementById('statTotalHours'),
    totalEarnings: document.getElementById('statTotalEarnings'),
    totalStudents: document.getElementById('statTotalStudents')
  };
  
  Object.keys(statElements).forEach(key => {
    const element = statElements[key];
    if (element && stats[key] !== undefined) {
      element.textContent = stats[key];
    }
  });
}

async function populateStudentDropdowns() {
  try {
    const students = await EnhancedCache.loadCollection('students');
    
    // Student dropdowns
    const dropdowns = [
      FORM_IDS.HOURS.student,
      FORM_IDS.PAYMENT.student
    ];
    
    dropdowns.forEach(dropdownId => {
      const dropdown = document.getElementById(dropdownId);
      if (!dropdown) return;
      
      const currentValue = dropdown.value;
      dropdown.innerHTML = '<option value="">Select Student</option>';
      
      students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name} (${student.studentId || 'No ID'})`;
        dropdown.appendChild(option);
      });
      
      // Restore previous selection if possible
      if (currentValue && students.some(s => s.id === currentValue)) {
        dropdown.value = currentValue;
      }
    });
    
  } catch (error) {
    console.error('Error populating student dropdowns:', error);
  }
}

function showLoginScreen() {
  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.innerHTML = `
      <div class="login-prompt">
        <h2>Please Sign In</h2>
        <p>You need to sign in to access the WorkLog system.</p>
        <button onclick="window.location.href='login.html'" class="btn btn-primary">
          Go to Login
        </button>
      </div>
    `;
  }
}

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Make functions available globally
window.handleStudentSubmit = handleStudentSubmit;
window.handleHoursSubmit = handleHoursSubmit;
window.cancelEditMode = cancelEditMode;
