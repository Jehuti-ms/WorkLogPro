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
    form: 'marksForm'
  },
  ATTENDANCE: {
    subject: 'attendanceSubject',
    topic: 'attendanceTopic',
    date: 'attendanceDate',
    notes: 'attendanceNotes',
    studentsContainer: 'attendanceStudents',
    submitBtn: 'attendanceSubmitBtn',
    form: 'attendanceForm'
  },
  PAYMENT: {
    student: 'paymentStudent',
    amount: 'paymentAmount',
    method: 'paymentMethod',
    date: 'paymentDate',
    notes: 'paymentNotes',
    submitBtn: 'paymentSubmitBtn',
    form: 'paymentForm'
  }
};

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

  const form = document.getElementById(FORM_IDS.STUDENT.form);
  const isEditing = form && form.dataset.editingId;
  
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

  if (!isEditing) {
    studentData.createdAt = new Date().toISOString();
  }

  try {
    if (isEditing) {
      // Update existing student
      await updateDoc(doc(db, "users", user.uid, "students", form.dataset.editingId), studentData);
      
      // Update cache
      const index = cache.students.findIndex(s => s.id === form.dataset.editingId);
      if (index !== -1) {
        cache.students[index] = { ...cache.students[index], ...studentData, id: form.dataset.editingId };
        EnhancedCache.saveToLocalStorageBulk('students', cache.students);
      }
      
      NotificationSystem.notifySuccess(`Student "${name}" updated successfully!`);
      
      // Reset form
      delete form.dataset.editingId;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Add Student';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
      }
    } else {
      // Create new student
      const result = await EnhancedCache.saveWithBackgroundSync('students', studentData);
      if (result) {
        NotificationSystem.notifySuccess(`Student "${name}" added successfully!`);
      }
    }
    
    // Clear form
    if (form) form.reset();
    
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

  const form = document.getElementById(FORM_IDS.HOURS.form);
  const isEditing = form && form.dataset.editingId;
  
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

  if (!isEditing) {
    hoursData.createdAt = new Date().toISOString();
  }

  try {
    if (isEditing) {
      // Update existing entry
      await updateDoc(doc(db, "users", user.uid, "hours", form.dataset.editingId), hoursData);
      
      // Update cache
      const index = cache.hours.findIndex(h => h.id === form.dataset.editingId);
      if (index !== -1) {
        cache.hours[index] = { ...cache.hours[index], ...hoursData, id: form.dataset.editingId };
        EnhancedCache.saveToLocalStorageBulk('hours', cache.hours);
      }
      
      NotificationSystem.notifySuccess('Hours updated successfully!');
      
      // Reset form
      delete form.dataset.editingId;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Log Hours';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
      }
    } else {
      // Create new entry
      const result = await EnhancedCache.saveWithBackgroundSync('hours', hoursData);
      if (result) {
        NotificationSystem.notifySuccess('Hours logged successfully!');
      }
    }
    
    // Clear form
    if (form) form.reset();
    
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
  const isEditing = form && form.dataset.editingId;
  
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

  if (!isEditing) {
    marksData.createdAt = new Date().toISOString();
  }

  try {
    if (isEditing) {
      // Update existing entry
      await updateDoc(doc(db, "users", user.uid, "marks", form.dataset.editingId), marksData);
      
      // Update cache
      const index = cache.marks.findIndex(m => m.id === form.dataset.editingId);
      if (index !== -1) {
        cache.marks[index] = { ...cache.marks[index], ...marksData, id: form.dataset.editingId };
        EnhancedCache.saveToLocalStorageBulk('marks', cache.marks);
      }
      
      NotificationSystem.notifySuccess(`Mark updated: ${score}/${max} (${percentage.toFixed(1)}%)`);
      
      // Reset form
      delete form.dataset.editingId;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Add Marks';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
      }
    } else {
      // Create new entry
      const result = await EnhancedCache.saveWithBackgroundSync('marks', marksData);
      if (result) {
        NotificationSystem.notifySuccess(`Mark added: ${score}/${max} (${percentage.toFixed(1)}%)`);
      }
    }
    
    // Clear form
    if (form) form.reset();
    
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
  const isEditing = form && form.dataset.editingId;
  
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

  if (!isEditing) {
    attendanceData.createdAt = new Date().toISOString();
  }

  try {
    if (isEditing) {
      // Update existing entry
      await updateDoc(doc(db, "users", user.uid, "attendance", form.dataset.editingId), attendanceData);
      
      // Update cache
      const index = cache.attendance.findIndex(a => a.id === form.dataset.editingId);
      if (index !== -1) {
        cache.attendance[index] = { ...cache.attendance[index], ...attendanceData, id: form.dataset.editingId };
        EnhancedCache.saveToLocalStorageBulk('attendance', cache.attendance);
      }
      
      NotificationSystem.notifySuccess(`Attendance updated: ${presentStudents.length}/${totalStudents} present`);
      
      // Reset form
      delete form.dataset.editingId;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Record Attendance';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
      }
    } else {
      // Create new entry
      const result = await EnhancedCache.saveWithBackgroundSync('attendance', attendanceData);
      if (result) {
        NotificationSystem.notifySuccess(`Attendance recorded: ${presentStudents.length}/${totalStudents} present`);
      }
    }
    
    // Clear form
    if (form) form.reset();
    
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
  const isEditing = form && form.dataset.editingId;
  
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

  if (!isEditing) {
    paymentData.createdAt = new Date().toISOString();
  }

  try {
    if (isEditing) {
      // Update existing entry
      await updateDoc(doc(db, "users", user.uid, "payments", form.dataset.editingId), paymentData);
      
      // Update cache
      const index = cache.payments.findIndex(p => p.id === form.dataset.editingId);
      if (index !== -1) {
        cache.payments[index] = { ...cache.payments[index], ...paymentData, id: form.dataset.editingId };
        EnhancedCache.saveToLocalStorageBulk('payments', cache.payments);
      }
      
      NotificationSystem.notifySuccess(`Payment updated: ${fmtMoney(amount)} from ${student}`);
      
      // Reset form
      delete form.dataset.editingId;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Add Payment';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
      }
    } else {
      // Create new entry
      const result = await EnhancedCache.saveWithBackgroundSync('payments', paymentData);
      if (result) {
        NotificationSystem.notifySuccess(`Payment recorded: ${fmtMoney(amount)} from ${student}`);
      }
    }
    
    // Clear form
    if (form) form.reset();
    
    // Refresh UI
    await renderPaymentActivityWithEdit();
    await renderStudentBalancesWithEdit();
    
  } catch (error) {
    console.error('Error saving payment:', error);
    NotificationSystem.notifyError('Failed to save payment: ' + error.message);
  }
}

// ===========================
// EDIT/DELETE HANDLERS
// ===========================

async function handleStudentEdit(event) {
  event.preventDefault();
  const button = event.target.closest('.edit-student-btn');
  if (!button) return;
  
  const studentId = button.dataset.id;
  if (!studentId) return;
  
  try {
    const student = cache.students.find(s => s.id === studentId);
    if (!student) {
      NotificationSystem.notifyError('Student not found');
      return;
    }
    
    // Fill the student form
    document.getElementById(FORM_IDS.STUDENT.name).value = student.name || '';
    document.getElementById(FORM_IDS.STUDENT.id).value = student.studentId || '';
    document.getElementById(FORM_IDS.STUDENT.gender).value = student.gender || '';
    document.getElementById(FORM_IDS.STUDENT.subject).value = student.subject || '';
    document.getElementById(FORM_IDS.STUDENT.email).value = student.email || '';
    document.getElementById(FORM_IDS.STUDENT.phone).value = student.phone || '';
    document.getElementById(FORM_IDS.STUDENT.rate).value = student.rate || student.hourlyRate || '';
    document.getElementById(FORM_IDS.STUDENT.notes).value = student.notes || '';
    
    // Set the editing mode
    const form = document.getElementById(FORM_IDS.STUDENT.form);
    form.dataset.editingId = studentId;
    
    // Change button text
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = 'Update Student';
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-warning');
    }
    
    // Scroll to form
    form.scrollIntoView({ behavior: 'smooth' });
    NotificationSystem.notifyInfo(`Editing student: ${student.name}`);
    
  } catch (error) {
    console.error('Error editing student:', error);
    NotificationSystem.notifyError('Failed to edit student: ' + error.message);
  }
}

async function handleStudentDelete(event) {
  event.preventDefault();
  const button = event.target.closest('.delete-student-btn');
  if (!button) return;
  
  const studentId = button.dataset.id;
  const studentName = button.dataset.name || 'this student';
  
  if (!confirm(`Are you sure you want to delete ${studentName}? This will also delete all associated records!`)) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to delete student');
      return;
    }
    
    // Delete associated records
    await deleteAssociatedRecords(user.uid, studentId);
    
    // Delete the student
    await deleteDoc(doc(db, "users", user.uid, "students", studentId));
    
    // Update cache
    cache.students = cache.students.filter(s => s.id !== studentId);
    EnhancedCache.saveToLocalStorageBulk('students', cache.students);
    
    // Refresh UI
    await renderStudents();
    await populateStudentDropdowns();
    
    NotificationSystem.notifySuccess(`Student ${studentName} deleted successfully`);
    
  } catch (error) {
    console.error('Error deleting student:', error);
    NotificationSystem.notifyError('Failed to delete student: ' + error.message);
  }
}

async function deleteAssociatedRecords(uid, studentId) {
  try {
    const collections = ['hours', 'marks', 'attendance', 'payments'];
    
    for (const collectionName of collections) {
      const querySnapshot = await getDocs(collection(db, "users", uid, collectionName));
      const batch = writeBatch(db);
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.studentId === studentId || data.student === studentId) {
          batch.delete(doc.ref);
        }
      });
      
      await batch.commit();
    }
    
    console.log(`✅ Deleted associated records for student ${studentId}`);
  } catch (error) {
    console.error('Error deleting associated records:', error);
    throw error;
  }
}

// Similar edit/delete handlers for other collections would go here...
// For brevity, I'll show the pattern and you can extend it

function setupEditDeleteHandlers() {
  // Student handlers
  document.querySelectorAll('.edit-student-btn').forEach(btn => {
    btn.addEventListener('click', handleStudentEdit);
  });
  
  document.querySelectorAll('.delete-student-btn').forEach(btn => {
    btn.addEventListener('click', handleStudentDelete);
  });
  
  // Note: Add similar handlers for hours, marks, attendance, payments
  // using the same pattern as above
}

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
      const studentName = student.name || `Student ${student.id}`;
      const studentId = student.id || student._id || student._firebaseId;
      
      studentsHTML += `
        <div class="student-card" id="student-${studentId}">
          <div class="student-card-header">
            <div>
              <strong>${studentName}</strong>
              <div class="muted">${student.subject || 'No subject'}</div>
            </div>
            <div class="student-actions">
              <button class="btn-icon edit-student-btn" data-id="${studentId}" data-name="${studentName}" title="Edit">✏️</button>
              <button class="btn-icon delete-student-btn" data-id="${studentId}" data-name="${studentName}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="student-details">
            <div class="muted">${student.gender || 'Not specified'} • ${student.email || 'No email'} • ${student.phone || 'No phone'}</div>
            <div class="student-rate">Rate: $${safeNumber(student.rate || student.hourlyRate || 0)}/hr</div>
            <div class="student-meta">Added: ${formatDate(student.createdAt || student.dateAdded)}</div>
            ${student.notes ? `<div class="student-notes">${student.notes}</div>` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = studentsHTML;
    setupEditDeleteHandlers();
    
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
      const dateA = new Date(a.date || a.dateIso || a.createdAt);
      const dateB = new Date(b.date || b.dateIso || b.createdAt);
      return dateB - dateA;
    });

    let hoursHTML = '';
    sortedHours.slice(0, limit).forEach(entry => {
      const entryId = entry.id || entry._id || entry._firebaseId;
      const hoursWorked = safeNumber(entry.hours || entry.hoursWorked);
      const rate = safeNumber(entry.rate || entry.baseRate || entry.hourlyRate);
      const total = hoursWorked * rate;
      
      hoursHTML += `
        <div class="hours-entry" id="hours-entry-${entryId}">
          <div class="hours-header">
            <strong>${entry.student || 'No Student'}</strong>
            <span class="hours-type">${entry.workType || entry.subject || 'General'}</span>
            <div class="student-actions">
              <button class="btn-icon edit-hours-btn" data-id="${entryId}" title="Edit">✏️</button>
              <button class="btn-icon delete-hours-btn" data-id="${entryId}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="muted">${formatDate(entry.date || entry.dateIso)} • ${entry.subject || 'General'}</div>
          <div class="hours-details">
            <span>Hours: ${hoursWorked}</span>
            <span>Rate: $${rate}</span>
            <span class="hours-total">Total: $${total.toFixed(2)}</span>
          </div>
          ${entry.organization ? `<div class="muted">Organization: ${entry.organization}</div>` : ''}
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

// Similar rendering functions for marks, attendance, payments...
// For brevity, I'll show one more example

async function renderStudentBalancesWithEdit() {
  const container = document.getElementById('studentBalancesContainer');
  if (!container) return;

  try {
    const [students, hours, payments] = await Promise.all([
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('payments')
    ]);

    if (students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Student Data</h3>
          <p>Add students and record hours/payments to see balances</p>
        </div>
      `;
      return;
    }

    const earningsByStudent = {};
    const paymentsByStudent = {};
    
    // Calculate earnings from hours
    hours.forEach(entry => {
      const studentName = entry.student;
      if (studentName) {
        const hoursWorked = safeNumber(entry.hours || entry.hoursWorked);
        const rate = safeNumber(entry.rate || entry.baseRate || entry.hourlyRate);
        const earnings = hoursWorked * rate;
        earningsByStudent[studentName] = (earningsByStudent[studentName] || 0) + earnings;
      }
    });

    // Calculate payments
    payments.forEach(payment => {
      const studentName = payment.student;
      const amount = safeNumber(payment.amount || payment.paymentAmount);
      if (studentName) {
        paymentsByStudent[studentName] = (paymentsByStudent[studentName] || 0) + amount;
      }
    });

    let balancesHTML = '';
    let totalOwed = 0;

    students.forEach(student => {
      const studentId = student.id || student._id;
      const studentName = student.name || `Student ${studentId}`;
      
      const earned = earningsByStudent[studentName] || 0;
      const paid = paymentsByStudent[studentName] || 0;
      const owed = Math.max(earned - paid, 0);
      totalOwed += owed;

      balancesHTML += `
        <div class="activity-item" id="balance-${studentId}">
          <div>
            <strong>${studentName}</strong>
            <div class="student-actions" style="display: inline-block; margin-left: 10px;">
              <button class="btn-icon quick-payment-btn" data-id="${studentId}" data-name="${studentName}" title="Add Payment">💰</button>
            </div>
          </div>
          <div class="muted">
            Earned: $${earned.toFixed(2)} | 
            Paid: $${paid.toFixed(2)} | 
            <strong>Owed: $${owed.toFixed(2)}</strong>
          </div>
        </div>
      `;
    });

    container.innerHTML = balancesHTML;
    
    // Setup quick payment button handlers
    document.querySelectorAll('.quick-payment-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const studentId = button.dataset.id;
        const studentName = button.dataset.name;
        quickAddPayment(studentId, studentName);
      });
    });

    const totalOwedEl = document.getElementById('totalOwed');
    const totalStudentsCountEl = document.getElementById('totalStudentsCount');
    
    if (totalOwedEl) totalOwedEl.textContent = `$${totalOwed.toFixed(2)}`;
    if (totalStudentsCountEl) totalStudentsCountEl.textContent = students.length;

  } catch (error) {
    console.error("Error rendering student balances:", error);
    container.innerHTML = '<div class="error">Error loading student balances</div>';
  }
}

function quickAddPayment(studentId, studentName) {
  const studentSelect = document.getElementById(FORM_IDS.PAYMENT.student);
  const amountInput = document.getElementById(FORM_IDS.PAYMENT.amount);
  
  if (studentSelect) {
    const option = Array.from(studentSelect.options).find(opt => opt.value === studentName);
    if (option) {
      studentSelect.value = option.value;
    }
  }
  
  if (amountInput) {
    amountInput.focus();
  }
  
  // Scroll to payment form
  const paymentForm = document.getElementById(FORM_IDS.PAYMENT.form);
  if (paymentForm) {
    paymentForm.scrollIntoView({ behavior: 'smooth' });
  }
  
  NotificationSystem.notifyInfo(`Adding payment for ${studentName}`);
}

// ===========================
// STUDENT DROPDOWN MANAGEMENT
// ===========================

async function populateStudentDropdowns() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const students = await EnhancedCache.loadCollection('students');

    if (students.length === 0) {
      showNoStudentsMessage();
      return;
    }

    // Update student dropdowns
    const dropdownIds = ['hoursStudent', 'marksStudent', 'paymentStudent'];
    dropdownIds.forEach(dropdownId => {
      const dropdown = document.getElementById(dropdownId);
      if (dropdown) {
        populateSingleDropdown(dropdown, students);
      }
    });

    // Update attendance checkboxes
    await populateAttendanceStudents();

  } catch (error) {
    console.error('❌ Error populating student dropdowns:', error);
    showDropdownError();
  }
}

function populateSingleDropdown(dropdown, students) {
  if (!dropdown) return;

  const currentValue = dropdown.value;
  
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
    dropdown.appendChild(option);
  });

  if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
    dropdown.value = currentValue;
  }
}

async function populateAttendanceStudents() {
  const container = document.getElementById('attendanceStudents');
  if (!container) return;

  try {
    const students = await EnhancedCache.loadCollection('students');

    container.innerHTML = '';

    if (students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No students available. Please add students first.</p>
        </div>
      `;
      return;
    }

    students.forEach(student => {
      const studentName = student.name || `Student ${student.id}`;
      
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; align-items: center; gap: 12px; margin: 8px 0; padding: 12px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border);';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'presentStudents';
      checkbox.value = studentName;
      checkbox.id = `attendance-${student.id}`;
      
      const label = document.createElement('label');
      label.htmlFor = `attendance-${student.id}`;
      label.textContent = studentName;
      label.style.cssText = 'flex: 1; margin: 0; cursor: pointer; font-weight: 500;';
      
      const rateInfo = document.createElement('span');
      rateInfo.textContent = `Rate: $${student.rate || 0}`;
      rateInfo.style.cssText = 'font-size: 0.85em; color: var(--muted);';
      
      item.appendChild(checkbox);
      item.appendChild(label);
      item.appendChild(rateInfo);
      container.appendChild(item);
    });

  } catch (error) {
    console.error('Error populating attendance students:', error);
  }
}

function showNoStudentsMessage() {
  const dropdownIds = ['hoursStudent', 'marksStudent', 'paymentStudent'];
  dropdownIds.forEach(dropdownId => {
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
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
  const dropdownIds = ['hoursStudent', 'marksStudent', 'paymentStudent'];
  dropdownIds.forEach(dropdownId => {
    const dropdown = document.getElementById(dropdownId);
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
// STATS AND SYNC FUNCTIONS
// ===========================

async function loadUserStats(uid) {
  try {
    const statsRef = doc(db, "users", uid);
    const statsSnap = await getDoc(statsRef);
    
    if (statsSnap.exists()) {
      const stats = statsSnap.data();
      
      if (document.getElementById('statStudents')) {
        document.getElementById('statStudents').textContent = stats.students ?? 0;
      }
      if (document.getElementById('statHours')) {
        document.getElementById('statHours').textContent = stats.hours ?? 0;
      }
      if (document.getElementById('statEarnings')) {
        const earnings = stats.earnings != null ? fmtMoney(stats.earnings) : "$0.00";
        document.getElementById('statEarnings').textContent = earnings;
      }
    } else {
      await setDoc(statsRef, { 
        students: 0, 
        hours: 0, 
        earnings: 0,
        lastSync: new Date().toLocaleString()
      });
    }

  } catch (err) {
    console.error("❌ Error loading stats:", err);
  }
}

async function updateUserStats(uid, newStats) {
  try {
    const statsRef = doc(db, "users", uid);
    await setDoc(statsRef, newStats, { merge: true });

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

  } catch (err) {
    console.error("❌ Error updating stats:", err);
  }
}

async function recalcSummaryStats(uid) {
  try {
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

    await updateUserStats(uid, {
      students: studentsCount,
      hours: totalHours,
      earnings: totalEarnings,
      lastSync: new Date().toLocaleString()
    });

  } catch (err) {
    console.error("❌ Error recalculating stats:", err);
  }
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
  },

  setupAutoSyncToggle() {
    const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
    const autoSyncText = document.getElementById('autoSyncText');
    const syncIndicator = document.getElementById('syncIndicator');
    
    if (!autoSyncCheckbox) return;
    
    const savedAutoSync = localStorage.getItem('autoSyncEnabled') === 'true';
    isAutoSyncEnabled = savedAutoSync;
    autoSyncCheckbox.checked = savedAutoSync;
    
    if (savedAutoSync) {
      autoSyncText.textContent = 'Auto';
      if (syncIndicator) syncIndicator.style.backgroundColor = '#10b981';
      this.startAutoSync();
    } else {
      autoSyncText.textContent = 'Manual';
      if (syncIndicator) syncIndicator.style.backgroundColor = '#ef4444';
    }

    autoSyncCheckbox.addEventListener('change', (e) => {
      isAutoSyncEnabled = e.target.checked;
      localStorage.setItem('autoSyncEnabled', isAutoSyncEnabled.toString());
      
      if (isAutoSyncEnabled) {
        autoSyncText.textContent = 'Auto';
        if (syncIndicator) syncIndicator.style.backgroundColor = '#10b981';
        this.startAutoSync();
        NotificationSystem.notifySuccess('Auto-sync enabled');
      } else {
        autoSyncText.textContent = 'Manual';
        if (syncIndicator) syncIndicator.style.backgroundColor = '#ef4444';
        this.stopAutoSync();
        NotificationSystem.notifyInfo('Auto-sync disabled');
      }
    });
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
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        await this.performSync('manual');
      });
    }
  },

  setupExportCloudButton() {
    const exportCloudBtn = document.getElementById('exportCloudBtn');
    if (exportCloudBtn) {
      exportCloudBtn.addEventListener('click', async () => {
        try {
          const user = auth.currentUser;
          if (!user) {
            NotificationSystem.notifyError('Please log in to export to cloud');
            return;
          }
          
          NotificationSystem.notifyInfo('Syncing data to cloud...');
          await this.performSync('manual');
          NotificationSystem.notifySuccess('Data synced to cloud successfully!');
        } catch (error) {
          NotificationSystem.notifyError('Failed to sync to cloud: ' + error.message);
        }
      });
    }
  },

  setupImportCloudButton() {
    const importCloudBtn = document.getElementById('importCloudBtn');
    if (importCloudBtn) {
      importCloudBtn.addEventListener('click', async () => {
        try {
          const user = auth.currentUser;
          if (!user) {
            NotificationSystem.notifyError('Please log in to import from cloud');
            return;
          }
          
          NotificationSystem.notifyInfo('Syncing data from cloud...');
          await Promise.all([
            EnhancedCache.loadCollection('students', true),
            EnhancedCache.loadCollection('hours', true),
            EnhancedCache.loadCollection('marks', true),
            EnhancedCache.loadCollection('attendance', true),
            EnhancedCache.loadCollection('payments', true)
          ]);
          
          // Refresh UI
          await Promise.all([
            renderStudents(true),
            renderRecentHoursWithEdit(),
            renderRecentMarksWithEdit(),
            renderAttendanceRecentWithEdit(),
            renderPaymentActivityWithEdit(),
            renderStudentBalancesWithEdit(),
            populateStudentDropdowns()
          ]);
          
          NotificationSystem.notifySuccess('Data synced from cloud successfully!');
        } catch (error) {
          NotificationSystem.notifyError('Failed to sync from cloud: ' + error.message);
        }
      });
    }
  },
  
  setupSyncStatsButton() {
    const syncStatsBtn = document.getElementById('syncStatsBtn');
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
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', async () => {
        await this.exportAllData();
      });
    }
  },

  setupImportDataButton() {
    const importDataBtn = document.getElementById('importDataBtn');
    if (importDataBtn) {
      importDataBtn.addEventListener('click', async () => {
        await this.importAllData();
      });
    }
  },

  setupClearAllButton() {
    const clearDataBtn = document.getElementById('clearDataBtn');
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

    const syncIndicator = document.getElementById('syncIndicator');
    
    try {
      if (syncIndicator) {
        syncIndicator.style.backgroundColor = '#f59e0b';
      }

      await Promise.all([
        recalcSummaryStats(user.uid),
        loadUserStats(user.uid)
      ]);

      // Refresh all UI components
      try {
        await Promise.all([
          renderStudents(),
          renderRecentHoursWithEdit(),
          renderRecentMarksWithEdit(),
          renderAttendanceRecentWithEdit(),
          renderPaymentActivityWithEdit(),
          renderStudentBalancesWithEdit(),
          populateStudentDropdowns()
        ]);
      } catch (e) { 
        console.warn('UI refresh failed:', e); 
      }

      if (syncIndicator) {
        if (isAutoSyncEnabled) {
          syncIndicator.style.backgroundColor = '#10b981';
        } else {
          syncIndicator.style.backgroundColor = '#ef4444';
        }
      }

      NotificationSystem.notifySuccess(`${mode === 'auto' ? 'Auto-' : ''}Sync completed successfully`);

    } catch (error) {
      console.error(`❌ ${mode} sync failed:`, error);
      
      if (syncIndicator) {
        syncIndicator.style.backgroundColor = '#ef4444';
      }
      
      NotificationSystem.notifyError(`Sync failed: ${error.message}`);
    }
  },

  async exportAllData() {
    try {
      const user = auth.currentUser;
      if (!user) {
        NotificationSystem.notifyError('Please log in to export data');
        return;
      }

      NotificationSystem.notifyInfo('Preparing data export...');

      const allData = {
        students: cache.students || [],
        hours: cache.hours || [],
        marks: cache.marks || [],
        attendance: cache.attendance || [],
        payments: cache.payments || [],
        metadata: {
          exportedAt: new Date().toISOString(),
          userEmail: user.email,
          totalRecords: (cache.students?.length || 0) + (cache.hours?.length || 0) + 
                       (cache.marks?.length || 0) + (cache.attendance?.length || 0) + 
                       (cache.payments?.length || 0),
          appVersion: '1.0.0'
        }
      };

      const jsonData = JSON.stringify(allData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `worklog_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      NotificationSystem.notifySuccess(`Data exported successfully! ${allData.metadata.totalRecords} records saved.`);
      
    } catch (error) {
      console.error('Error exporting data:', error);
      NotificationSystem.notifyError('Failed to export data: ' + error.message);
    }
  },

  async importAllData() {
    try {
      const user = auth.currentUser;
      if (!user) {
        NotificationSystem.notifyError('Please log in to import data');
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      
      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
          NotificationSystem.notifyInfo('No file selected');
          return;
        }

        if (confirm(`Are you sure you want to import data from ${file.name}? This will replace ALL current data.`)) {
          try {
            NotificationSystem.notifyInfo('Importing data...');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                const importedData = JSON.parse(e.target.result);
                
                if (!importedData.students || !importedData.hours || !importedData.marks || 
                    !importedData.attendance || !importedData.payments) {
                  NotificationSystem.notifyError('Invalid backup file format');
                  return;
                }

                // Import data collections
                await this.importCollection('students', importedData.students, user.uid);
                await this.importCollection('hours', importedData.hours, user.uid);
                await this.importCollection('marks', importedData.marks, user.uid);
                await this.importCollection('attendance', importedData.attendance, user.uid);
                await this.importCollection('payments', importedData.payments, user.uid);

                // Update local storage
                EnhancedCache.saveToLocalStorageBulk('students', importedData.students);
                EnhancedCache.saveToLocalStorageBulk('hours', importedData.hours);
                EnhancedCache.saveToLocalStorageBulk('marks', importedData.marks);
                EnhancedCache.saveToLocalStorageBulk('attendance', importedData.attendance);
                EnhancedCache.saveToLocalStorageBulk('payments', importedData.payments);

                // Update memory cache
                cache.students = importedData.students;
                cache.hours = importedData.hours;
                cache.marks = importedData.marks;
                cache.attendance = importedData.attendance;
                cache.payments = importedData.payments;
                cache.lastSync = Date.now();

                // Refresh UI
                await Promise.all([
                  renderStudents(true),
                  renderRecentHoursWithEdit(),
                  renderRecentMarksWithEdit(),
                  renderAttendanceRecentWithEdit(),
                  renderPaymentActivityWithEdit(),
                  renderStudentBalancesWithEdit(),
                  populateStudentDropdowns()
                ]);

                // Perform sync
                await this.performSync('manual');

                const totalRecords = importedData.students.length + importedData.hours.length + 
                                   importedData.marks.length + importedData.attendance.length + 
                                   importedData.payments.length;
                
                NotificationSystem.notifySuccess(`Data imported successfully! ${totalRecords} records loaded.`);

              } catch (parseError) {
                console.error('Error parsing imported data:', parseError);
                NotificationSystem.notifyError('Invalid JSON file format');
              }
            };

            reader.onerror = () => {
              NotificationSystem.notifyError('Error reading file');
            };

            reader.readAsText(file);
            
          } catch (error) {
            console.error('Error importing data:', error);
            NotificationSystem.notifyError('Failed to import data: ' + error.message);
          }
        }
        
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();

    } catch (error) {
      console.error('Error setting up import:', error);
      NotificationSystem.notifyError('Failed to setup import: ' + error.message);
    }
  },

  async importCollection(collectionName, items, uid) {
    try {
      const batch = writeBatch(db);
      const collectionRef = collection(db, "users", uid, collectionName);
      
      // Clear existing data
      const existingDocs = await getDocs(collectionRef);
      existingDocs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Add imported items
      items.forEach(item => {
        const { id, _id, _firebaseId, _synced, _cachedAt, ...cleanItem } = item;
        const docRef = doc(collectionRef);
        batch.set(docRef, cleanItem);
      });
      
      await batch.commit();
      
    } catch (error) {
      console.error(`Error importing ${collectionName}:`, error);
      throw error;
    }
  }
};

// ===========================
// FORM SETUP AND UTILITIES
// ===========================

function setupFormHandlers() {
  // Student Form
  const studentForm = document.getElementById(FORM_IDS.STUDENT.form);
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
  }

  // Hours Form
  const hoursForm = document.getElementById(FORM_IDS.HOURS.form);
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
  }

  // Marks Form
  const marksForm = document.getElementById(FORM_IDS.MARKS.form);
  if (marksForm) {
    marksForm.addEventListener('submit', handleMarksSubmit);
  }

  // Attendance Form
  const attendanceForm = document.getElementById(FORM_IDS.ATTENDANCE.form);
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', handleAttendanceSubmit);
  }

  // Payment Form
  const paymentForm = document.getElementById(FORM_IDS.PAYMENT.form);
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmit);
  }

  // Set today's date for all date inputs
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(input => {
    if (!input.value) {
      input.value = today;
    }
  });
}

function calculateTotalPay() {
  const hoursInput = document.getElementById(FORM_IDS.HOURS.hours);
  const rateInput = document.getElementById(FORM_IDS.HOURS.rate);
  
  if (!hoursInput || !rateInput) return;
  
  const hours = safeNumber(hoursInput.value);
  const rate = safeNumber(rateInput.value);
  const total = hours * rate;
  
  const totalPayElement = document.getElementById(FORM_IDS.HOURS.totalPay);
  if (totalPayElement) {
    totalPayElement.textContent = fmtMoney(total);
  }
}

// ===========================
// USER PROFILE MANAGEMENT
// ===========================

async function loadUserProfile(uid) {
  const user = auth.currentUser;
  
  let memberSince = localStorage.getItem('memberSince');
  if (!memberSince) {
    memberSince = new Date().toISOString();
    localStorage.setItem('memberSince', memberSince);
  }
  
  const fallbackProfile = {
    email: user?.email || '',
    createdAt: memberSince,
    defaultRate: parseFloat(localStorage.getItem('userDefaultRate')) || 25.00,
    memberSince: memberSince
  };
  
  updateProfileButton(fallbackProfile);
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

  if (!profileModal) return;

  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
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
}

function updateProfileModal() {
  const profileUserEmail = document.getElementById('profileUserEmail');
  const profileUserSince = document.getElementById('profileUserSince');
  const profileDefaultRate = document.getElementById('profileDefaultRate');

  if (currentUserData) {
    const email = currentUserData.email || auth.currentUser?.email || 'Not available';
    if (profileUserEmail) profileUserEmail.textContent = email;
    
    const memberSince = currentUserData.memberSince || localStorage.getItem('memberSince') || new Date().toISOString();
    if (profileUserSince) profileUserSince.textContent = formatDate(memberSince);
    
    if (profileDefaultRate) {
      profileDefaultRate.textContent = `$${currentUserData.defaultRate || 25.00}/hour`;
    }
  }

  updateModalStats();
}

function updateModalStats() {
  const modalStatStudents = document.getElementById('modalStatStudents');
  const modalStatHours = document.getElementById('modalStatHours');
  const modalStatEarnings = document.getElementById('modalStatEarnings');
  const modalStatUpdated = document.getElementById('modalStatUpdated');

  const students = Array.isArray(cache.students) ? cache.students : [];
  const hours = Array.isArray(cache.hours) ? cache.hours : [];
  
  if (modalStatStudents) modalStatStudents.textContent = students.length;
  if (modalStatHours) {
    const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    modalStatHours.textContent = totalHours.toFixed(1);
  }
  if (modalStatEarnings) {
    const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    modalStatEarnings.textContent = fmtMoney(totalEarnings);
  }
  if (modalStatUpdated) modalStatUpdated.textContent = new Date().toLocaleString();
}

// ===========================
// THEME MANAGEMENT
// ===========================

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
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
      toggleTheme();
    });
    
    newButton.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.1)';
    });
    
    newButton.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
    });
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  setTimeout(() => {
    setupThemeToggle();
  }, 100);
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
  
  // Activate first tab
  const firstTab = document.querySelector('.tab[data-tab]');
  if (firstTab) {
    switchTab(firstTab.getAttribute('data-tab'));
  }
}

function switchTab(tabName) {
  if (!tabName) return;
  
  // Update active tab button
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeButtons = document.querySelectorAll(`.tab[data-tab="${tabName}"]`);
  activeButtons.forEach(btn => {
    btn.classList.add('active');
  });
  
  // Show active tab content
  document.querySelectorAll('.tabcontent').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
  
  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.classList.add('active');
    targetTab.style.display = 'block';
  }
}

// ===========================
// DEFAULT RATE MANAGEMENT
// ===========================

function initializeDefaultRate(rate) {
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  const baseRateInput = document.getElementById('baseRate');
  const studentRateInput = document.getElementById('studentRate');
  
  if (defaultBaseRateInput && !defaultBaseRateInput.value) {
    defaultBaseRateInput.value = rate;
  }
  
  if (baseRateInput && !baseRateInput.value) {
    baseRateInput.value = rate;
  }
  
  if (studentRateInput && !studentRateInput.value) {
    studentRateInput.value = rate;
  }
}

async function saveDefaultRate() {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to save default rate');
    return;
  }
  
  const defaultBaseRateInput = document.getElementById('defaultBaseRate');
  if (!defaultBaseRateInput) return;
  
  const newRate = safeNumber(defaultBaseRateInput.value);
  if (newRate <= 0) {
    NotificationSystem.notifyError('Please enter a valid rate greater than 0');
    return;
  }
  
  try {
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { defaultRate: newRate });
    
    currentUserData.defaultRate = newRate;
    localStorage.setItem('userDefaultRate', newRate.toString());
    
    NotificationSystem.notifySuccess(`Default rate saved: $${newRate.toFixed(2)}/session`);
    initializeDefaultRate(newRate);
    
  } catch (error) {
    console.error('Error saving default rate:', error);
    NotificationSystem.notifyError('Failed to save default rate');
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
// FLOATING ADD BUTTON
// ===========================

function setupFloatingAddButton() {
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');

  if (!fab) return;

  let isExpanded = false;

  function openFabMenu() {
    isExpanded = true;
    
    fab.innerHTML = '✕';
    fab.style.transform = 'rotate(45deg)';
    
    if (fabMenu) fabMenu.classList.add('show');
    if (fabOverlay) {
      fabOverlay.style.display = 'block';
      setTimeout(() => {
        fabOverlay.style.pointerEvents = 'auto';
      }, 10);
    }
  }

  function closeFabMenu() {
    isExpanded = false;
    
    fab.innerHTML = '+';
    fab.style.transform = 'rotate(0deg)';
    
    if (fabMenu) fabMenu.classList.remove('show');
    if (fabOverlay) {
      fabOverlay.style.display = 'none';
      fabOverlay.style.pointerEvents = 'none';
    }
  }

  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isExpanded) {
      closeFabMenu();
    } else {
      openFabMenu();
    }
  });

  if (fabOverlay) {
    fabOverlay.addEventListener('click', (e) => {
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
        closeFabMenu();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isExpanded) {
      closeFabMenu();
    }
  });

  setupFabActions(closeFabMenu);
}

function setupFabActions(closeFabMenu) {
  const quickActions = {
    'fabAddStudent': () => {
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
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        quickActions[btnId]();
        closeFabMenu();
      });
    }
  });
}

// ===========================
// INITIALIZATION
// ===========================

async function initializeApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  // Initialize notification system first
  NotificationSystem.initNotificationStyles();
  
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
      
      // Load and render initial data
      await Promise.all([
        renderStudents(),
        renderRecentHoursWithEdit(),
        populateStudentDropdowns()
      ]);
      
      console.log('✅ App initialization complete');
      
    } else {
      console.log('❌ No user signed in, redirecting to auth...');
      window.location.href = "auth.html";
    }
  });
  
  // Initialize theme
  initializeTheme();
}

// ===========================
// START THE APP
// ===========================

document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM Content Loaded - Starting app initialization...');
  initializeApp();
});

// ===========================
// GLOBAL EXPORTS
// ===========================

window.NotificationSystem = NotificationSystem;
window.saveDefaultRate = saveDefaultRate;
window.useDefaultRate = useDefaultRate;
window.useDefaultRateInHours = useDefaultRateInHours;
window.calculateTotalPay = calculateTotalPay;
window.selectAllStudents = function() {
  const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = true);
  NotificationSystem.notifySuccess(`Selected all ${checkboxes.length} students`);
};
window.clearStudentForm = function() {
  const form = document.getElementById(FORM_IDS.STUDENT.form);
  if (form) {
    form.reset();
    NotificationSystem.notifyInfo('Student form cleared');
  }
};
window.clearAttendanceForm = function() {
  const form = document.getElementById(FORM_IDS.ATTENDANCE.form);
  if (form) {
    form.reset();
    const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    NotificationSystem.notifyInfo('Attendance form cleared');
  }
};
window.safeNumber = safeNumber;
window.formatDate = formatDate;
window.fmtMoney = fmtMoney;

console.log('✅ app.js loaded successfully!');
