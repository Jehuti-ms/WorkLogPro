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
    
    // Delete associated records first
    await deleteAssociatedRecords(user.uid, studentId);
    
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
    // ... (continuing from where the code left off)

// ===========================
// DELETE HANDLERS (CONTINUED)
// ===========================

async function deleteAssociatedRecords(uid, studentId) {
  try {
    const collections = ['hours', 'marks', 'attendance', 'payments'];
    
    for (const collectionName of collections) {
      // Get all records for this student
      const q = query(
        collection(db, "users", uid, collectionName),
        where("student", "==", studentId)
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      if (snapshot.size > 0) {
        await batch.commit();
        console.log(`Deleted ${snapshot.size} ${collectionName} records for student ${studentId}`);
        
        // Update cache
        cache[collectionName] = cache[collectionName].filter(item => 
          item.student !== studentId
        );
        EnhancedCache.saveToLocalStorageBulk(collectionName, cache[collectionName]);
      }
    }
  } catch (error) {
    console.error('Error deleting associated records:', error);
    throw error;
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

async function handleMarksDelete(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const button = event.target.closest('.delete-marks-btn');
  if (!button) return;
  
  const entryId = button.dataset.id;
  const score = button.dataset.score || '';
  const max = button.dataset.max || '';
  
  if (!confirm(`Are you sure you want to delete this marks entry (${score}/${max})?`)) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete marks');
      return;
    }
    
    await deleteDoc(doc(db, "users", user.uid, "marks", entryId));
    
    // Update cache
    cache.marks = cache.marks.filter(m => m.id !== entryId);
    EnhancedCache.saveToLocalStorageBulk('marks', cache.marks);
    
    // Refresh UI
    await renderRecentMarksWithEdit();
    
    NotificationSystem.notifySuccess('Marks entry deleted successfully');
    
  } catch (error) {
    console.error('Error deleting marks:', error);
    NotificationSystem.notifyError('Failed to delete marks: ' + error.message);
  }
}

async function handleAttendanceDelete(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const button = event.target.closest('.delete-attendance-btn');
  if (!button) return;
  
  const entryId = button.dataset.id;
  const date = button.dataset.date || '';
  
  if (!confirm(`Are you sure you want to delete attendance record for ${date}?`)) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete attendance');
      return;
    }
    
    await deleteDoc(doc(db, "users", user.uid, "attendance", entryId));
    
    // Update cache
    cache.attendance = cache.attendance.filter(a => a.id !== entryId);
    EnhancedCache.saveToLocalStorageBulk('attendance', cache.attendance);
    
    // Refresh UI
    await renderAttendanceRecentWithEdit();
    
    NotificationSystem.notifySuccess('Attendance record deleted successfully');
    
  } catch (error) {
    console.error('Error deleting attendance:', error);
    NotificationSystem.notifyError('Failed to delete attendance: ' + error.message);
  }
}

async function handlePaymentDelete(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const button = event.target.closest('.delete-payment-btn');
  if (!button) return;
  
  const entryId = button.dataset.id;
  const amount = button.dataset.amount || '';
  
  if (!confirm(`Are you sure you want to delete payment of ${fmtMoney(amount)}?`)) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete payment');
      return;
    }
    
    await deleteDoc(doc(db, "users", user.uid, "payments", entryId));
    
    // Update cache
    cache.payments = cache.payments.filter(p => p.id !== entryId);
    EnhancedCache.saveToLocalStorageBulk('payments', cache.payments);
    
    // Refresh UI
    await renderPaymentActivityWithEdit();
    await renderStudentBalancesWithEdit();
    
    NotificationSystem.notifySuccess('Payment record deleted successfully');
    
  } catch (error) {
    console.error('Error deleting payment:', error);
    NotificationSystem.notifyError('Failed to delete payment: ' + error.message);
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
    ).slice(0, 50); // Limit to 50 most recent
    
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

async function renderRecentMarksWithEdit() {
  try {
    const marks = await EnhancedCache.loadCollection('marks');
    const container = document.getElementById('recentMarksTable');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sort by date (newest first)
    const sortedMarks = [...marks].sort((a, b) => 
      new Date(b.dateIso || b.date) - new Date(a.dateIso || a.date)
    ).slice(0, 50);
    
    if (sortedMarks.length === 0) {
      container.innerHTML = `
        <div class="no-data-message">
          <p>No marks recorded yet.</p>
          <p>Use the "Add Marks" form to get started.</p>
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
          <th>Student</th>
          <th>Subject</th>
          <th>Topic</th>
          <th>Score</th>
          <th>Percentage</th>
          <th>Grade</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sortedMarks.map(entry => {
          const percentage = entry.maxMarks > 0 ? 
            (entry.marks / entry.maxMarks) * 100 : 0;
          return `
          <tr>
            <td>${formatDate(entry.date)}</td>
            <td>${entry.student || 'N/A'}</td>
            <td>${entry.subject || 'N/A'}</td>
            <td>${entry.topic || 'N/A'}</td>
            <td>${entry.marks || 0}/${entry.maxMarks || 0}</td>
            <td>${percentage.toFixed(1)}%</td>
            <td>
              <span class="grade-badge grade-${calculateGrade(percentage).toLowerCase()}">
                ${calculateGrade(percentage)}
              </span>
            </td>
            <td class="actions">
              <button class="btn-icon edit-marks-btn" 
                      data-id="${entry.id}"
                      data-student="${entry.student || ''}"
                      data-subject="${entry.subject || ''}"
                      data-topic="${entry.topic || ''}"
                      data-score="${entry.marks || 0}"
                      data-max="${entry.maxMarks || 0}"
                      data-date="${entry.date || ''}"
                      data-notes="${entry.notes || ''}">
                ✏️
              </button>
              <button class="btn-icon delete-marks-btn" 
                      data-id="${entry.id}"
                      data-score="${entry.marks || 0}"
                      data-max="${entry.maxMarks || 0}">
                🗑️
              </button>
            </td>
          </tr>
        `}).join('')}
      </tbody>
    `;
    container.appendChild(table);
    
    // Add event listeners
    document.querySelectorAll('.edit-marks-btn').forEach(btn => {
      btn.addEventListener('click', handleMarksEdit);
    });
    
    document.querySelectorAll('.delete-marks-btn').forEach(btn => {
      btn.addEventListener('click', handleMarksDelete);
    });
    
  } catch (error) {
    console.error('Error rendering marks:', error);
  }
}

async function renderAttendanceRecentWithEdit() {
  try {
    const attendance = await EnhancedCache.loadCollection('attendance');
    const container = document.getElementById('recentAttendanceTable');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sort by date (newest first)
    const sortedAttendance = [...attendance].sort((a, b) => 
      new Date(b.dateIso || b.date) - new Date(a.dateIso || a.date)
    ).slice(0, 50);
    
    if (sortedAttendance.length === 0) {
      container.innerHTML = `
        <div class="no-data-message">
          <p>No attendance recorded yet.</p>
          <p>Use the "Record Attendance" form to get started.</p>
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
          <th>Subject</th>
          <th>Topic</th>
          <th>Present</th>
          <th>Attendance</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sortedAttendance.map(entry => {
          const presentCount = Array.isArray(entry.present) ? entry.present.length : 0;
          const totalCount = entry.totalStudents || 0;
          const percentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;
          return `
          <tr>
            <td>${formatDate(entry.date)}</td>
            <td>${entry.subject || 'N/A'}</td>
            <td>${entry.topic || 'N/A'}</td>
            <td>${presentCount}/${totalCount}</td>
            <td>
              <span class="attendance-badge ${percentage >= 50 ? 'attendance-good' : 'attendance-poor'}">
                ${percentage.toFixed(1)}%
              </span>
            </td>
            <td class="actions">
              <button class="btn-icon edit-attendance-btn" 
                      data-id="${entry.id}"
                      data-subject="${entry.subject || ''}"
                      data-topic="${entry.topic || ''}"
                      data-date="${entry.date || ''}"
                      data-notes="${entry.notes || ''}"
                      data-present="${Array.isArray(entry.present) ? entry.present.join(',') : ''}">
                ✏️
              </button>
              <button class="btn-icon delete-attendance-btn" 
                      data-id="${entry.id}"
                      data-date="${entry.date || ''}">
                🗑️
              </button>
            </td>
          </tr>
        `}).join('')}
      </tbody>
    `;
    container.appendChild(table);
    
    // Add event listeners
    document.querySelectorAll('.edit-attendance-btn').forEach(btn => {
      btn.addEventListener('click', handleAttendanceEdit);
    });
    
    document.querySelectorAll('.delete-attendance-btn').forEach(btn => {
      btn.addEventListener('click', handleAttendanceDelete);
    });
    
  } catch (error) {
    console.error('Error rendering attendance:', error);
  }
}

async function renderPaymentActivityWithEdit() {
  try {
    const payments = await EnhancedCache.loadCollection('payments');
    const container = document.getElementById('paymentActivityTable');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sort by date (newest first)
    const sortedPayments = [...payments].sort((a, b) => 
      new Date(b.dateIso || b.date) - new Date(a.dateIso || a.date)
    ).slice(0, 50);
    
    if (sortedPayments.length === 0) {
      container.innerHTML = `
        <div class="no-data-message">
          <p>No payments recorded yet.</p>
          <p>Use the "Add Payment" form to get started.</p>
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
          <th>Student</th>
          <th>Amount</th>
          <th>Method</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sortedPayments.map(entry => `
          <tr>
            <td>${formatDate(entry.date)}</td>
            <td>${entry.student || 'N/A'}</td>
            <td>${fmtMoney(entry.amount || 0)}</td>
            <td>
              <span class="method-badge method-${entry.method?.toLowerCase() || 'cash'}">
                ${entry.method || 'Cash'}
              </span>
            </td>
            <td>
              <span class="status-badge status-${entry.status?.toLowerCase() || 'completed'}">
                ${entry.status || 'Completed'}
              </span>
            </td>
            <td class="actions">
              <button class="btn-icon edit-payment-btn" 
                      data-id="${entry.id}"
                      data-student="${entry.student || ''}"
                      data-amount="${entry.amount || 0}"
                      data-method="${entry.method || 'Cash'}"
                      data-date="${entry.date || ''}"
                      data-notes="${entry.notes || ''}">
                ✏️
              </button>
              <button class="btn-icon delete-payment-btn" 
                      data-id="${entry.id}"
                      data-amount="${entry.amount || 0}">
                🗑️
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    container.appendChild(table);
    
    // Add event listeners
    document.querySelectorAll('.edit-payment-btn').forEach(btn => {
      btn.addEventListener('click', handlePaymentEdit);
    });
    
    document.querySelectorAll('.delete-payment-btn').forEach(btn => {
      btn.addEventListener('click', handlePaymentDelete);
    });
    
  } catch (error) {
    console.error('Error rendering payments:', error);
  }
}

async function renderStudentBalancesWithEdit() {
  try {
    const students = await EnhancedCache.loadCollection('students');
    const hours = await EnhancedCache.loadCollection('hours');
    const payments = await EnhancedCache.loadCollection('payments');
    
    const container = document.getElementById('studentBalancesTable');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Calculate balances for each student
    const studentBalances = {};
    
    students.forEach(student => {
      studentBalances[student.id] = {
        name: student.name,
        studentId: student.studentId,
        subject: student.subject,
        hours: 0,
        earnings: 0,
        payments: 0,
        balance: 0,
        rate: student.rate || 0
      };
    });
    
    // Calculate hours and earnings
    hours.forEach(entry => {
      if (entry.student && studentBalances[entry.student]) {
        const student = studentBalances[entry.student];
        const entryHours = safeNumber(entry.hours);
        const entryRate = safeNumber(entry.rate) || student.rate;
        const earnings = entryHours * entryRate;
        
        student.hours += entryHours;
        student.earnings += earnings;
        student.balance += earnings; // Earnings increase balance
      }
    });
    
    // Subtract payments
    payments.forEach(payment => {
      if (payment.student && studentBalances[payment.student]) {
        const student = studentBalances[payment.student];
        const amount = safeNumber(payment.amount);
        
        student.payments += amount;
        student.balance -= amount; // Payments decrease balance
      }
    });
    
    // Convert to array and sort by balance (highest owed first)
    const balanceArray = Object.values(studentBalances)
      .sort((a, b) => b.balance - a.balance);
    
    if (balanceArray.length === 0) {
      container.innerHTML = `
        <div class="no-data-message">
          <p>No student balances to display.</p>
          <p>Add students and log hours to see balances.</p>
        </div>
      `;
      return;
    }
    
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Student</th>
          <th>ID</th>
          <th>Subject</th>
          <th>Total Hours</th>
          <th>Total Earnings</th>
          <th>Total Payments</th>
          <th>Balance</th>
        </tr>
      </thead>
      <tbody>
        ${balanceArray.map(student => `
          <tr>
            <td>${student.name}</td>
            <td>${student.studentId || 'N/A'}</td>
            <td>${student.subject || 'N/A'}</td>
            <td>${student.hours.toFixed(1)}</td>
            <td>${fmtMoney(student.earnings)}</td>
            <td>${fmtMoney(student.payments)}</td>
            <td>
              <span class="balance-badge ${student.balance > 0 ? 'balance-negative' : 'balance-positive'}">
                ${fmtMoney(student.balance)}
              </span>
              ${student.balance > 0 ? 
                `<button class="btn-icon add-payment-btn" data-student="${student.name}">
                   💳
                 </button>` : 
                ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    container.appendChild(table);
    
    // Add event listeners for quick payment buttons
    document.querySelectorAll('.add-payment-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const studentName = this.dataset.student;
        document.getElementById(FORM_IDS.PAYMENT.student).value = studentName;
        
        // Calculate suggested payment amount (minimum of balance or 100)
        const row = this.closest('tr');
        const balanceText = row.querySelector('.balance-badge').textContent;
        const balance = parseFloat(balanceText.replace(/[^\d.-]/g, ''));
        
        if (balance > 0) {
          const suggestedAmount = Math.min(balance, 100);
          document.getElementById(FORM_IDS.PAYMENT.amount).value = suggestedAmount.toFixed(2);
        }
        
        // Scroll to payment form
        document.getElementById('paymentFormSection').scrollIntoView({ behavior: 'smooth' });
      });
    });
    
  } catch (error) {
    console.error('Error rendering student balances:', error);
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

function handleMarksEdit(event) {
  const button = event.currentTarget;
  const entryId = button.dataset.id;
  
  // Find entry in cache
  const entry = cache.marks.find(m => m.id === entryId);
  if (!entry) {
    NotificationSystem.notifyError('Marks entry not found in cache');
    return;
  }
  
  // Fill form with entry data
  const formIds = FORM_IDS.MARKS;
  document.getElementById(formIds.student).value = entry.student || '';
  document.getElementById(formIds.subject).value = entry.subject || '';
  document.getElementById(formIds.topic).value = entry.topic || '';
  document.getElementById(formIds.score).value = entry.marks || '';
  document.getElementById(formIds.max).value = entry.maxMarks || '';
  document.getElementById(formIds.date).value = entry.date || '';
  document.getElementById(formIds.notes).value = entry.notes || '';
  
  // Set edit mode
  setEditMode('MARKS', entryId);
  
  // Scroll to form
  document.getElementById('marksFormSection').scrollIntoView({ behavior: 'smooth' });
}

function handleAttendanceEdit(event) {
  const button = event.currentTarget;
  const entryId = button.dataset.id;
  
  // Find entry in cache
  const entry = cache.attendance.find(a => a.id === entryId);
  if (!entry) {
    NotificationSystem.notifyError('Attendance entry not found in cache');
    return;
  }
  
  // Fill form with entry data
  const formIds = FORM_IDS.ATTENDANCE;
  document.getElementById(formIds.subject).value = entry.subject || '';
  document.getElementById(formIds.topic).value = entry.topic || '';
  document.getElementById(formIds.date).value = entry.date || '';
  document.getElementById(formIds.notes).value = entry.notes || '';
  
  // Check present students
  const presentStudents = Array.isArray(entry.present) ? entry.present : [];
  const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = presentStudents.includes(cb.value);
  });
  
  // Set edit mode
  setEditMode('ATTENDANCE', entryId);
  
  // Scroll to form
  document.getElementById('attendanceFormSection').scrollIntoView({ behavior: 'smooth' });
}

function handlePaymentEdit(event) {
  const button = event.currentTarget;
  const entryId = button.dataset.id;
  
  // Find entry in cache
  const entry = cache.payments.find(p => p.id === entryId);
  if (!entry) {
    NotificationSystem.notifyError('Payment entry not found in cache');
    return;
  }
  
  // Fill form with entry data
  const formIds = FORM_IDS.PAYMENT;
  document.getElementById(formIds.student).value = entry.student || '';
  document.getElementById(formIds.amount).value = entry.amount || '';
  document.getElementById(formIds.method).value = entry.method || 'Cash';
  document.getElementById(formIds.date).value = entry.date || '';
  document.getElementById(formIds.notes).value = entry.notes || '';
  
  // Set edit mode
  setEditMode('PAYMENT', entryId);
  
  // Scroll to form
  document.getElementById('paymentFormSection').scrollIntoView({ behavior: 'smooth' });
}

// ===========================
// POPULATE DROPDOWNS
// ===========================

async function populateStudentDropdowns() {
  try {
    const students = await EnhancedCache.loadCollection('students');
    
    // Student dropdowns in various forms
    const dropdowns = [
      FORM_IDS.HOURS.student,
      FORM_IDS.MARKS.student,
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
    
    // Populate attendance students checklist
    await populateAttendanceStudents();
    
  } catch (error) {
    console.error('Error populating student dropdowns:', error);
  }
}

async function populateAttendanceStudents() {
  try {
    const students = await EnhancedCache.loadCollection('students');
    const container = document.getElementById(FORM_IDS.ATTENDANCE.studentsContainer);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (students.length === 0) {
      container.innerHTML = `
        <div class="no-data-message">
          <p>No students available for attendance.</p>
          <p>Add students first.</p>
        </div>
      `;
      return;
    }
    
    students.forEach(student => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      label.innerHTML = `
        <input type="checkbox" value="${student.id}">
        <span>${student.name} (${student.studentId || 'No ID'})</span>
      `;
      container.appendChild(label);
    });
    
  } catch (error) {
    console.error('Error populating attendance students:', error);
  }
}

// ===========================
// SUMMARY STATISTICS
// ===========================

async function recalcSummaryStats(uid) {
  try {
    const [hours, marks, attendance, payments] = await Promise.all([
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('marks'),
      EnhancedCache.loadCollection('attendance'),
      EnhancedCache.loadCollection('payments')
    ]);
    
    // Calculate total hours and earnings
    let totalHours = 0;
    let totalEarnings = 0;
    let recentEarnings = 0; // Last 30 days
    
    hours.forEach(entry => {
      const entryHours = safeNumber(entry.hours);
      const entryRate = safeNumber(entry.rate);
      const entryTotal = entryHours * entryRate;
      
      totalHours += entryHours;
      totalEarnings += entryTotal;
      
      // Check if entry is from last 30 days
      const entryDate = new Date(entry.dateIso || entry.date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (entryDate >= thirtyDaysAgo) {
        recentEarnings += entryTotal;
      }
    });
    
    // Calculate average marks
    let totalMarks = 0;
    let totalMaxMarks = 0;
    let avgPercentage = 0;
    
    if (marks.length > 0) {
      marks.forEach(entry => {
        totalMarks += safeNumber(entry.marks);
        totalMaxMarks += safeNumber(entry.maxMarks);
      });
      
      if (totalMaxMarks > 0) {
        avgPercentage = (totalMarks / totalMaxMarks) * 100;
      }
    }
    
    // Calculate attendance rate
    let totalPresent = 0;
    let totalPossible = 0;
    
    attendance.forEach(entry => {
      const presentCount = Array.isArray(entry.present) ? entry.present.length : 0;
      const totalCount = entry.totalStudents || 0;
      
      totalPresent += presentCount;
      totalPossible += totalCount;
    });
    
    const attendanceRate = totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0;
    
    // Calculate total payments
    let totalPayments = 0;
    payments.forEach(payment => {
      totalPayments += safeNumber(payment.amount);
    });
    
    // Update UI
    updateSummaryUI({
      totalHours: totalHours.toFixed(1),
      totalEarnings: fmtMoney(totalEarnings),
      recentEarnings: fmtMoney(recentEarnings),
      avgPercentage: avgPercentage.toFixed(1),
      attendanceRate: attendanceRate.toFixed(1),
      totalPayments: fmtMoney(totalPayments),
      totalStudents: cache.students?.length || 0,
      balance: fmtMoney(totalEarnings - totalPayments)
    });
    
  } catch (error) {
    console.error('Error calculating summary stats:', error);
  }
}

function updateSummaryUI(stats) {
  const statElements = {
    totalHours: document.getElementById('statTotalHours'),
    totalEarnings: document.getElementById('statTotalEarnings'),
    recentEarnings: document.getElementById('statRecentEarnings'),
    avgPercentage: document.getElementById('statAvgPercentage'),
    attendanceRate: document.getElementById('statAttendanceRate'),
    totalPayments: document.getElementById('statTotalPayments'),
    totalStudents: document.getElementById('statTotalStudents'),
    balance: document.getElementById('statBalance')
  };
  
  Object.keys(statElements).forEach(key => {
    const element = statElements[key];
    if (element && stats[key] !== undefined) {
      element.textContent = stats[key];
    }
  });
}

// ===========================
// AUTO-SYNC SYSTEM
// ===========================

function setupAutoSync() {
  const syncToggle = document.getElementById('autoSyncToggle');
  const syncStatus = document.getElementById('syncStatus');
  
  if (!syncToggle || !syncStatus) return;
  
  // Load saved sync preference
  const savedSyncEnabled = localStorage.getItem('worklog_autoSync') === 'true';
  isAutoSyncEnabled = savedSyncEnabled;
  syncToggle.checked = isAutoSyncEnabled;
  updateSyncStatus();
  
  if (isAutoSyncEnabled) {
    startAutoSync();
  }
  
  syncToggle.addEventListener('change', function() {
    isAutoSyncEnabled = this.checked;
    localStorage.setItem('worklog_autoSync', isAutoSyncEnabled.toString());
    
    if (isAutoSyncEnabled) {
      startAutoSync();
    } else {
      stopAutoSync();
    }
    
    updateSyncStatus();
  });
}

function startAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }
  
  autoSyncInterval = setInterval(async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        // Load all collections to refresh cache
        await Promise.all([
          EnhancedCache.loadCollection('hours', true),
          EnhancedCache.loadCollection('marks', true),
          EnhancedCache.loadCollection('attendance', true),
          EnhancedCache.loadCollection('payments', true),
          EnhancedCache.loadCollection('students', true)
        ]);
        
        // Retry any unsynced items
        await EnhancedCache.retryUnsyncedItems();
        
        console.log('🔄 Auto-sync completed');
      }
    } catch (error) {
      console.error('❌ Auto-sync error:', error);
    }
  }, 300000); // Sync every 5 minutes
  
  console.log('🔄 Auto-sync started');
}

function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
    console.log('⏹️ Auto-sync stopped');
  }
}

function updateSyncStatus() {
  const syncStatus = document.getElementById('syncStatus');
  if (!syncStatus) return;
  
  if (isAutoSyncEnabled) {
    syncStatus.innerHTML = `
      <span class="status-indicator status-active"></span>
      Auto-sync enabled
    `;
    syncStatus.title = 'Data is automatically syncing every 5 minutes';
  } else {
    syncStatus.innerHTML = `
      <span class="status-indicator status-inactive"></span>
      Auto-sync disabled
    `;
    syncStatus.title = 'Data is only synced when you manually refresh';
  }
}

// ===========================
// MANUAL SYNC FUNCTION
// ===========================

async function manualSync() {
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to sync');
      return;
    }
    
    NotificationSystem.notifyInfo('Syncing data...', 2000);
    
    // Force refresh all collections
    await Promise.all([
      EnhancedCache.loadCollection('students', true),
      EnhancedCache.loadCollection('hours', true),
      EnhancedCache.loadCollection('marks', true),
      EnhancedCache.loadCollection('attendance', true),
      EnhancedCache.loadCollection('payments', true)
    ]);
    
    // Retry any unsynced items
    await EnhancedCache.retryUnsyncedItems();
    
    // Refresh all UI components
    await Promise.all([
      renderStudents(),
      renderRecentHoursWithEdit(),
      renderRecentMarksWithEdit(),
      renderAttendanceRecentWithEdit(),
      renderPaymentActivityWithEdit(),
      renderStudentBalancesWithEdit(),
      recalcSummaryStats(user.uid)
    ]);
    
    NotificationSystem.notifySuccess('Sync complete!', 3000);
    
  } catch (error) {
    console.error('Error during manual sync:', error);
    NotificationSystem.notifyError('Sync failed: ' + error.message);
  }
}

// ===========================
// FILTERS AND SEARCH
// ===========================

function setupFilters() {
  // Hours filters
  const hoursMonthFilter = document.getElementById('hoursMonthFilter');
  const hoursTypeFilter = document.getElementById('hoursTypeFilter');
  
  if (hoursMonthFilter) {
    hoursMonthFilter.addEventListener('change', applyHoursFilters);
  }
  if (hoursTypeFilter) {
    hoursTypeFilter.addEventListener('change', applyHoursFilters);
  }
  
  // Marks filters
  const marksStudentFilter = document.getElementById('marksStudentFilter');
  const marksSubjectFilter = document.getElementById('marksSubjectFilter');
  
  if (marksStudentFilter) {
    marksStudentFilter.addEventListener('change', applyMarksFilters);
  }
  if (marksSubjectFilter) {
    marksSubjectFilter.addEventListener('change', applyMarksFilters);
  }
  
  // Attendance filters
  const attendanceMonthFilter = document.getElementById('attendanceMonthFilter');
  const attendanceSubjectFilter = document.getElementById('attendanceSubjectFilter');
  
  if (attendanceMonthFilter) {
    attendanceMonthFilter.addEventListener('change', applyAttendanceFilters);
  }
  if (attendanceSubjectFilter) {
    attendanceSubjectFilter.addEventListener('change', applyAttendanceFilters);
  }
  
  // Payment filters
  const paymentMonthFilter = document.getElementById('paymentMonthFilter');
  const paymentStudentFilter = document.getElementById('paymentStudentFilter');
  
  if (paymentMonthFilter) {
    paymentMonthFilter.addEventListener('change', applyPaymentFilters);
  }
  if (paymentStudentFilter) {
    paymentStudentFilter.addEventListener('change', applyPaymentFilters);
  }
}

async function applyHoursFilters() {
  try {
    const hours = await EnhancedCache.loadCollection('hours');
    const monthFilter = document.getElementById('hoursMonthFilter')?.value;
    const typeFilter = document.getElementById('hoursTypeFilter')?.value;
    
    let filteredHours = [...hours];
    
    // Apply month filter
    if (monthFilter) {
      filteredHours = filteredHours.filter(entry => {
        const entryDate = new Date(entry.dateIso || entry.date);
        const entryMonth = entryDate.getMonth() + 1; // 1-12
        const entryYear = entryDate.getFullYear();
        const [filterYear, filterMonth] = monthFilter.split('-').map(Number);
        return entryYear === filterYear && entryMonth === filterMonth;
      });
    }
    
    // Apply type filter
    if (typeFilter) {
      filteredHours = filteredHours.filter(entry => entry.workType === typeFilter);
    }
    
    // Sort by date (newest first)
    filteredHours.sort((a, b) => 
      new Date(b.dateIso || b.date) - new Date(a.dateIso || a.date)
    );
    
    // Update UI (simplified version for demo)
    const container = document.getElementById('recentHoursTable');
    if (!container) return;
    
    // Clear and re-render table with filtered data
    // This would be similar to renderRecentHoursWithEdit but with filtered data
    
  } catch (error) {
    console.error('Error applying hours filters:', error);
  }
}

async function applyMarksFilters() {
  // Similar implementation for marks filters
}

async function applyAttendanceFilters() {
  // Similar implementation for attendance filters
}

async function applyPaymentFilters() {
  // Similar implementation for payment filters
}

// ===========================
// REPORT GENERATION
// ===========================

async function generateReport(type) {
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to generate reports');
      return;
    }
    
    NotificationSystem.notifyInfo('Generating report...', 2000);
    
    let reportData = {};
    let reportTitle = '';
    let fileName = '';
    
    switch (type) {
      case 'earnings':
        reportData = await generateEarningsReport();
        reportTitle = 'Earnings Report';
        fileName = `earnings-report-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      
      case 'attendance':
        reportData = await generateAttendanceReport();
        reportTitle = 'Attendance Report';
        fileName = `attendance-report-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      
      case 'marks':
        reportData = await generateMarksReport();
        reportTitle = 'Marks Report';
        fileName = `marks-report-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      
      case 'student':
        reportData = await generateStudentReport();
        reportTitle = 'Student Report';
        fileName = `student-report-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      
      default:
        NotificationSystem.notifyError('Invalid report type');
        return;
    }
    
    // Download the report
    downloadCSV(reportData.csv, fileName);
    NotificationSystem.notifySuccess(`${reportTitle} downloaded!`, 3000);
    
  } catch (error) {
    console.error('Error generating report:', error);
    NotificationSystem.notifyError('Failed to generate report: ' + error.message);
  }
}

async function generateEarningsReport() {
  const hours = await EnhancedCache.loadCollection('hours');
  const payments = await EnhancedCache.loadCollection('payments');
  
  // Calculate monthly earnings
  const monthlyEarnings = {};
  
  hours.forEach(entry => {
    const date = new Date(entry.dateIso || entry.date);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    if (!monthlyEarnings[monthKey]) {
      monthlyEarnings[monthKey] = {
        hours: 0,
        earnings: 0,
        payments: 0
      };
    }
    
    const entryHours = safeNumber(entry.hours);
    const entryRate = safeNumber(entry.rate);
    const entryTotal = entryHours * entryRate;
    
    monthlyEarnings[monthKey].hours += entryHours;
    monthlyEarnings[monthKey].earnings += entryTotal;
  });
  
  // Calculate monthly payments
  payments.forEach(payment => {
    const date = new Date(payment.dateIso || payment.date);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    if (!monthlyEarnings[monthKey]) {
      monthlyEarnings[monthKey] = {
        hours: 0,
        earnings: 0,
        payments: 0
      };
    }
    
    monthlyEarnings[monthKey].payments += safeNumber(payment.amount);
  });
  
  // Convert to CSV
  const csvRows = ['Month,Total Hours,Total Earnings,Total Payments,Net Balance'];
  
  Object.keys(monthlyEarnings)
    .sort()
    .forEach(month => {
      const data = monthlyEarnings[month];
      const netBalance = data.earnings - data.payments;
      csvRows.push(
        `"${month}",${data.hours.toFixed(2)},${data.earnings.toFixed(2)},${data.payments.toFixed(2)},${netBalance.toFixed(2)}`
      );
    });
  
  return {
    csv: csvRows.join('\n'),
    data: monthlyEarnings
  };
}

async function generateAttendanceReport() {
  const attendance = await EnhancedCache.loadCollection('attendance');
  const students = await EnhancedCache.loadCollection('students');
  
  // Calculate student attendance
  const studentAttendance = {};
  
  students.forEach(student => {
    studentAttendance[student.id] = {
      name: student.name,
      studentId: student.studentId,
      totalSessions: 0,
      presentSessions: 0,
      attendanceRate: 0
    };
  });
  
  attendance.forEach(session => {
    const presentStudents = Array.isArray(session.present) ? session.present : [];
    
    students.forEach(student => {
      if (studentAttendance[student.id]) {
        studentAttendance[student.id].totalSessions++;
        if (presentStudents.includes(student.id)) {
          studentAttendance[student.id].presentSessions++;
        }
      }
    });
  });
  
  // Calculate attendance rates
  Object.values(studentAttendance).forEach(student => {
    if (student.totalSessions > 0) {
      student.attendanceRate = (student.presentSessions / student.totalSessions) * 100;
    }
  });
  
  // Convert to CSV
  const csvRows = ['Student Name,Student ID,Total Sessions,Present Sessions,Attendance Rate'];
  
  Object.values(studentAttendance).forEach(student => {
    csvRows.push(
      `"${student.name}","${student.studentId || ''}",${student.totalSessions},${student.presentSessions},${student.attendanceRate.toFixed(2)}%`
    );
  });
  
  return {
    csv: csvRows.join('\n'),
    data: studentAttendance
  };
}

async function generateMarksReport() {
  const marks = await EnhancedCache.loadCollection('marks');
  const students = await EnhancedCache.loadCollection('students');
  
  // Calculate student performance
  const studentPerformance = {};
  
  students.forEach(student => {
    studentPerformance[student.id] = {
      name: student.name,
      studentId: student.studentId,
      totalTests: 0,
      totalMarks: 0,
      totalMaxMarks: 0,
      averagePercentage: 0
    };
  });
  
  marks.forEach(entry => {
    if (studentPerformance[entry.student]) {
      const student = studentPerformance[entry.student];
      student.totalTests++;
      student.totalMarks += safeNumber(entry.marks);
      student.totalMaxMarks += safeNumber(entry.maxMarks);
    }
  });
  
  // Calculate averages
  Object.values(studentPerformance).forEach(student => {
    if (student.totalMaxMarks > 0) {
      student.averagePercentage = (student.totalMarks / student.totalMaxMarks) * 100;
    }
  });
  
  // Convert to CSV
  const csvRows = ['Student Name,Student ID,Total Tests,Total Marks,Total Max Marks,Average Percentage,Grade'];
  
  Object.values(studentPerformance).forEach(student => {
    const grade = calculateGrade(student.averagePercentage);
    csvRows.push(
      `"${student.name}","${student.studentId || ''}",${student.totalTests},${student.totalMarks},${student.totalMaxMarks},${student.averagePercentage.toFixed(2)}%,${grade}`
    );
  });
  
  return {
    csv: csvRows.join('\n'),
    data: studentPerformance
  };
}

async function generateStudentReport() {
  const students = await EnhancedCache.loadCollection('students');
  const hours = await EnhancedCache.loadCollection('hours');
  const payments = await EnhancedCache.loadCollection('payments');
  const marks = await EnhancedCache.loadCollection('marks');
  const attendance = await EnhancedCache.loadCollection('attendance');
  
  // Calculate comprehensive student data
  const studentReports = [];
  
  students.forEach(student => {
    const report = {
      name: student.name,
      studentId: student.studentId,
      gender: student.gender,
      subject: student.subject,
      email: student.email,
      phone: student.phone,
      hourlyRate: student.rate || 0,
      totalHours: 0,
      totalEarnings: 0,
      totalPayments: 0,
      balance: 0,
      totalTests: 0,
      averageScore: 0,
      totalSessions: 0,
      attendanceRate: 0
    };
    
    // Calculate hours and earnings
    const studentHours = hours.filter(h => h.student === student.id);
    studentHours.forEach(entry => {
      const entryHours = safeNumber(entry.hours);
      const entryRate = safeNumber(entry.rate) || report.hourlyRate;
      report.totalHours += entryHours;
      report.totalEarnings += entryHours * entryRate;
    });
    
    // Calculate payments
    const studentPayments = payments.filter(p => p.student === student.id);
    studentPayments.forEach(payment => {
      report.totalPayments += safeNumber(payment.amount);
    });
    
    report.balance = report.totalEarnings - report.totalPayments;
    
    // Calculate marks
    const studentMarks = marks.filter(m => m.student === student.id);
    report.totalTests = studentMarks.length;
    
    if (report.totalTests > 0) {
      let totalMarks = 0;
      let totalMaxMarks = 0;
      
      studentMarks.forEach(mark => {
        totalMarks += safeNumber(mark.marks);
        totalMaxMarks += safeNumber(mark.maxMarks);
      });
      
      if (totalMaxMarks > 0) {
        report.averageScore = (totalMarks / totalMaxMarks) * 100;
      }
    }
    
    // Calculate attendance
    const studentAttendanceSessions = attendance.filter(session => 
      Array.isArray(session.present) && session.present.includes(student.id)
    );
    
    report.totalSessions = attendance.length;
    if (report.totalSessions > 0) {
      report.attendanceRate = (studentAttendanceSessions.length / report.totalSessions) * 100;
    }
    
    studentReports.push(report);
  });
  
  // Convert to CSV
  const csvRows = [
    'Student Name,Student ID,Gender,Subject,Email,Phone,Hourly Rate,Total Hours,Total Earnings,Total Payments,Balance,Total Tests,Average Score,Total Sessions,Attendance Rate'
  ];
  
  studentReports.forEach(report => {
    csvRows.push(
      `"${report.name}","${report.studentId}","${report.gender}","${report.subject}","${report.email}","${report.phone}",${report.hourlyRate},${report.totalHours.toFixed(2)},${report.totalEarnings.toFixed(2)},${report.totalPayments.toFixed(2)},${report.balance.toFixed(2)},${report.totalTests},${report.averageScore.toFixed(2)}%,${report.totalSessions},${report.attendanceRate.toFixed(2)}%`
    );
  });
  
  return {
    csv: csvRows.join('\n'),
    data: studentReports
  };
}

function downloadCSV(csvContent, fileName) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (navigator.msSaveBlob) { // IE 10+
    navigator.msSaveBlob(blob, fileName);
  } else {
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// ===========================
// EXPORT/IMPORT FUNCTIONS
// ===========================

async function exportAllData() {
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to export data');
      return;
    }
    
    NotificationSystem.notifyInfo('Preparing export...', 2000);
    
    // Load all data
    const [students, hours, marks, attendance, payments] = await Promise.all([
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('marks'),
      EnhancedCache.loadCollection('attendance'),
      EnhancedCache.loadCollection('payments')
    ]);
    
    // Create export object
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      userId: user.uid,
      data: {
        students,
        hours,
        marks,
        attendance,
        payments
      }
    };
    
    // Convert to JSON
    const jsonData = JSON.stringify(exportData, null, 2);
    
    // Create download
    const blob = new Blob([jsonData], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `worklog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    
    NotificationSystem.notifySuccess('Export completed!', 3000);
    
  } catch (error) {
    console.error('Error exporting data:', error);
    NotificationSystem.notifyError('Export failed: ' + error.message);
  }
}

async function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!confirm('WARNING: This will overwrite all your current data. Continue?')) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to import data');
      return;
    }
    
    NotificationSystem.notifyInfo('Importing data...', 2000);
    
    const fileText = await file.text();
    const importData = JSON.parse(fileText);
    
    // Validate import data
    if (!importData.version || !importData.data) {
      throw new Error('Invalid backup file format');
    }
    
    // Clear all existing data first
    await clearAllData();
    
    // Import each collection
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    
    for (const collectionName of collections) {
      const items = importData.data[collectionName] || [];
      
      for (const item of items) {
        // Remove firebase IDs from import
        const { id, _firebaseId, _synced, _cachedAt, ...cleanItem } = item;
        
        // Add to Firestore
        await addDoc(collection(db, "users", user.uid, collectionName), cleanItem);
      }
    }
    
    // Clear cache and reload
    EnhancedCache.loadCachedData();
    await refreshAllData();
    
    NotificationSystem.notifySuccess('Import completed!', 3000);
    
  } catch (error) {
    console.error('Error importing data:', error);
    NotificationSystem.notifyError('Import failed: ' + error.message);
  }
}

async function clearAllData() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    
    for (const collectionName of collections) {
      const snapshot = await getDocs(collection(db, "users", user.uid, collectionName));
      const batch = writeBatch(db);
      
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      if (snapshot.size > 0) {
        await batch.commit();
      }
      
      // Clear cache
      cache[collectionName] = [];
      localStorage.removeItem(`worklog_${collectionName}`);
    }
    
    console.log('🗑️ All data cleared');
    
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

// ===========================
// DATA REFRESH
// ===========================

async function refreshAllData() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    
    NotificationSystem.notifyInfo('Refreshing data...', 1000);
    
    // Force refresh all collections
    await Promise.all([
      EnhancedCache.loadCollection('students', true),
      EnhancedCache.loadCollection('hours', true),
      EnhancedCache.loadCollection('marks', true),
      EnhancedCache.loadCollection('attendance', true),
      EnhancedCache.loadCollection('payments', true)
    ]);
    
    // Refresh all UI components
    await Promise.all([
      renderStudents(),
      renderRecentHoursWithEdit(),
      renderRecentMarksWithEdit(),
      renderAttendanceRecentWithEdit(),
      renderPaymentActivityWithEdit(),
      renderStudentBalancesWithEdit(),
      populateStudentDropdowns(),
      recalcSummaryStats(user.uid)
    ]);
    
    NotificationSystem.notifySuccess('Data refreshed!', 2000);
    
  } catch (error) {
    console.error('Error refreshing data:', error);
    NotificationSystem.notifyError('Refresh failed: ' + error.message);
  }
}

// ===========================
// REAL-TIME UPDATES
// ===========================

function setupRealTimeUpdates() {
  const user = auth.currentUser;
  if (!user) return;
  
  // Note: For full real-time, you would use onSnapshot listeners
  // This is a simplified version using periodic updates
  
  // Update UI every 30 seconds
  setInterval(async () => {
    if (document.visibilityState === 'visible') {
      await recalcSummaryStats(user.uid);
    }
  }, 30000);
  
  // Update when tab becomes visible
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      await refreshAllData();
    }
  });
}

// ===========================
// FORM INPUT VALIDATION
// ===========================

function setupFormValidation() {
  // Hours form validation
  const hoursForm = document.getElementById(FORM_IDS.HOURS.form);
  if (hoursForm) {
    const hoursInput = document.getElementById(FORM_IDS.HOURS.hours);
    const rateInput = document.getElementById(FORM_IDS.HOURS.rate);
    const totalPayElement = document.getElementById(FORM_IDS.HOURS.totalPay);
    
    const calculateTotal = () => {
      const hours = safeNumber(hoursInput?.value);
      const rate = safeNumber(rateInput?.value);
      const total = hours * rate;
      
      if (totalPayElement) {
        totalPayElement.textContent = fmtMoney(total);
      }
    };
    
    if (hoursInput) hoursInput.addEventListener('input', calculateTotal);
    if (rateInput) rateInput.addEventListener('input', calculateTotal);
  }
  
  // Marks form validation
  const marksForm = document.getElementById(FORM_IDS.MARKS.form);
  if (marksForm) {
    const scoreInput = document.getElementById(FORM_IDS.MARKS.score);
    const maxInput = document.getElementById(FORM_IDS.MARKS.max);
    
    const validateScore = () => {
      const score = safeNumber(scoreInput?.value);
      const max = safeNumber(maxInput?.value);
      
      if (score > max) {
        scoreInput.setCustomValidity('Score cannot be greater than maximum marks');
      } else {
        scoreInput.setCustomValidity('');
      }
    };
    
    if (scoreInput) scoreInput.addEventListener('input', validateScore);
    if (maxInput) maxInput.addEventListener('input', validateScore);
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
        EnhancedCache.loadCollection('hours'),
        EnhancedCache.loadCollection('marks'),
        EnhancedCache.loadCollection('attendance'),
        EnhancedCache.loadCollection('payments')
      ]);
      
      // Initialize UI
      await initUI();
      
      // Set up real-time updates
      setupRealTimeUpdates();
      
    } else {
      console.log('👤 No user signed in');
      currentUserData = null;
      
      // Clear UI or show login screen
      showLoginScreen();
    }
  });
  
  // Set up form event listeners
  setupFormListeners();
}

async function initUI() {
  console.log('🎨 Initializing UI...');
  
  // Initial render of all data
  await Promise.all([
    renderStudents(),
    renderRecentHoursWithEdit(),
    renderRecentMarksWithEdit(),
    renderAttendanceRecentWithEdit(),
    renderPaymentActivityWithEdit(),
    renderStudentBalancesWithEdit(),
    populateStudentDropdowns()
  ]);
  
  // Calculate and display summary stats
  const user = auth.currentUser;
  if (user) {
    await recalcSummaryStats(user.uid);
  }
  
  // Set up auto-sync
  setupAutoSync();
  
  // Set up filters
  setupFilters();
  
  // Set up form validation
  setupFormValidation();
  
  // Set up manual sync button
  const manualSyncBtn = document.getElementById('manualSyncBtn');
  if (manualSyncBtn) {
    manualSyncBtn.addEventListener('click', manualSync);
  }
  
  // Set up export/import buttons
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importInput = document.getElementById('importInput');
  
  if (exportBtn) {
    exportBtn.addEventListener('click', exportAllData);
  }
  
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', importAllData);
  }
  
  // Set up report generation buttons
  document.querySelectorAll('.report-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const reportType = e.target.dataset.report;
      if (reportType) {
        generateReport(reportType);
      }
    });
  });
  
  // Set up logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        NotificationSystem.notifySuccess('Logged out successfully');
      } catch (error) {
        console.error('Error signing out:', error);
        NotificationSystem.notifyError('Logout failed: ' + error.message);
      }
    });
  }
  
  // Set up refresh button
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshAllData);
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
  
  // Marks form
  const marksForm = document.getElementById(FORM_IDS.MARKS.form);
  if (marksForm) {
    marksForm.addEventListener('submit', handleMarksSubmit);
    
    const cancelBtn = document.getElementById(FORM_IDS.MARKS.cancelBtn);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEditMode);
    }
  }
  
  // Attendance form
  const attendanceForm = document.getElementById(FORM_IDS.ATTENDANCE.form);
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', handleAttendanceSubmit);
    
    const cancelBtn = document.getElementById(FORM_IDS.ATTENDANCE.cancelBtn);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEditMode);
    }
  }
  
  // Payment form
  const paymentForm = document.getElementById(FORM_IDS.PAYMENT.form);
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmit);
    
    const cancelBtn = document.getElementById(FORM_IDS.PAYMENT.cancelBtn);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEditMode);
    }
  }
}

function showLoginScreen() {
  // This would typically redirect to a login page
  // For now, just show a message
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

// ===========================
// START THE APP
// ===========================

// Start the app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ===========================
// MAKE FUNCTIONS AVAILABLE GLOBALLY
// ===========================

// Export functions that might be needed in HTML onclick attributes
window.handleStudentSubmit = handleStudentSubmit;
window.handleHoursSubmit = handleHoursSubmit;
window.handleMarksSubmit = handleMarksSubmit;
window.handleAttendanceSubmit = handleAttendanceSubmit;
window.handlePaymentSubmit = handlePaymentSubmit;
window.manualSync = manualSync;
window.refreshAllData = refreshAllData;
window.exportAllData = exportAllData;
window.generateReport = generateReport;
window.cancelEditMode = cancelEditMode;
