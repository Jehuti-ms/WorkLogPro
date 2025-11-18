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
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ===========================
// 3-LAYER STORAGE SYSTEM: LOCAL → CACHE → CLOUD
// ===========================

const StorageSystem = {
  // Layer 1: Local Storage (Instant)
  saveToLocal(collectionName, data) {
    try {
      const key = `worklog_${collectionName}_${data.id || Date.now()}`;
      const item = {
        ...data,
        _local: true,
        _synced: false,
        _createdAt: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(item));
      console.log(`💾 Saved to local storage: ${key}`);
      return key;
    } catch (error) {
      console.error('❌ Local storage save failed:', error);
      return null;
    }
  },

  getFromLocal(collectionName) {
    try {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`worklog_${collectionName}_`)) {
          const item = JSON.parse(localStorage.getItem(key));
          items.push(item);
        }
      }
      return items;
    } catch (error) {
      console.error('❌ Local storage read failed:', error);
      return [];
    }
  },

  removeFromLocal(key) {
    try {
      localStorage.removeItem(key);
      console.log(`🗑️ Removed from local storage: ${key}`);
    } catch (error) {
      console.error('❌ Local storage remove failed:', error);
    }
  },

  // Layer 2: Cache (Fast)
  updateCache(collectionName, data) {
    cache[collectionName] = data;
    cache.lastSync = Date.now();
    console.log(`✅ Cache updated: ${collectionName}`);
  },

  clearCache(collectionName) {
    cache[collectionName] = null;
    console.log(`🗑️ Cache cleared: ${collectionName}`);
  },

  // Layer 3: Background Cloud Sync
  async syncToCloud(collectionName, data, operation = 'create') {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      let result;
      switch (operation) {
        case 'create':
          result = await addDoc(collection(db, "users", user.uid, collectionName), data);
          break;
        case 'update':
          const docRef = doc(db, "users", user.uid, collectionName, data.id);
          await updateDoc(docRef, data);
          result = docRef;
          break;
        case 'delete':
          const deleteRef = doc(db, "users", user.uid, collectionName, data.id);
          await deleteDoc(deleteRef);
          result = deleteRef;
          break;
      }
      
      console.log(`☁️ Cloud sync successful: ${collectionName} ${operation}`);
      return result;
    } catch (error) {
      console.error(`❌ Cloud sync failed: ${collectionName} ${operation}`, error);
      throw error;
    }
  },

  // Process pending local items in background
  async processPendingSync() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    let processedCount = 0;
    
    for (const collectionName of collections) {
      const pendingItems = this.getFromLocal(collectionName);
      
      for (const item of pendingItems) {
        if (item._local && !item._synced) {
          try {
            // Remove local flags before syncing to cloud
            const { _local, _synced, _createdAt, ...cleanData } = item;
            await this.syncToCloud(collectionName, cleanData, 'create');
            
            // Mark as synced and update in local storage
            item._synced = true;
            const key = `worklog_${collectionName}_${item.id}`;
            localStorage.setItem(key, JSON.stringify(item));
            
            processedCount++;
            console.log(`✅ Processed pending sync: ${collectionName} - ${item.id}`);
          } catch (error) {
            console.error(`❌ Failed to sync pending item: ${collectionName} - ${item.id}`, error);
          }
        }
      }
    }
    
    if (processedCount > 0) {
      console.log(`✅ Processed ${processedCount} pending sync items`);
    }
  }
};

// Enhanced cache system
const cache = {
  students: null,
  hours: null,
  marks: null,
  attendance: null,
  payments: null,
  lastSync: null
};

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function isCacheValid(key) {
  if (!cache[key] || !cache.lastSync) return false;
  return (Date.now() - cache.lastSync) < CACHE_DURATION;
}

function clearAllCache() {
  cache.students = null;
  cache.hours = null;
  cache.marks = null;
  cache.attendance = null;
  cache.payments = null;
  cache.lastSync = null;
  console.log('🗑️ All cache cleared');
}

// ===========================
// ENHANCED CRUD OPERATIONS WITH 3-LAYER SYSTEM
// ===========================

async function enhancedCreateOperation(collectionName, data, successMessage) {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    // Generate unique ID
    const itemId = data.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const itemData = { ...data, id: itemId };

    // LAYER 1: Save to local storage immediately (INSTANT)
    StorageSystem.saveToLocal(collectionName, itemData);

    // LAYER 2: Update cache immediately (FAST)
    StorageSystem.clearCache(collectionName);

    // Show success immediately
    showNotification(successMessage, 'success');

    // LAYER 3: Sync to cloud in background (SLOW)
    setTimeout(async () => {
      try {
        await StorageSystem.syncToCloud(collectionName, itemData, 'create');
        
        // Update local storage to mark as synced
        const key = `worklog_${collectionName}_${itemId}`;
        const localItem = JSON.parse(localStorage.getItem(key));
        if (localItem) {
          localItem._synced = true;
          localStorage.setItem(key, JSON.stringify(localItem));
        }
        
        console.log(`✅ Background sync completed: ${collectionName} - ${itemId}`);
        
        // Refresh the view to show synced status
        setTimeout(() => {
          switch(collectionName) {
            case 'students': renderStudents(); break;
            case 'hours': renderRecentHours(); break;
            case 'marks': renderRecentMarks(); break;
            case 'attendance': renderAttendanceRecent(); break;
            case 'payments': renderPaymentActivity(); break;
          }
        }, 500);
      } catch (error) {
        console.error(`❌ Background sync failed: ${collectionName} - ${itemId}`, error);
      }
    }, 1000);

    return itemId;
  } catch (error) {
    console.error(`Error in enhanced create operation for ${collectionName}:`, error);
    showNotification(`Failed to save ${collectionName}`, 'error');
    throw error;
  }
}

async function enhancedUpdateOperation(collectionName, docId, data, successMessage) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const itemData = { ...data, id: docId };

    // LAYER 1: Update local storage immediately
    const key = `worklog_${collectionName}_${docId}`;
    const existingItem = JSON.parse(localStorage.getItem(key));
    if (existingItem) {
      const updatedItem = { ...existingItem, ...itemData, _synced: false };
      localStorage.setItem(key, JSON.stringify(updatedItem));
    } else {
      // If not in local storage, create new local entry
      StorageSystem.saveToLocal(collectionName, itemData);
    }

    // LAYER 2: Clear cache immediately
    StorageSystem.clearCache(collectionName);

    // Show success immediately
    showNotification(successMessage, 'success');

    // LAYER 3: Sync to cloud in background
    setTimeout(async () => {
      try {
        await StorageSystem.syncToCloud(collectionName, itemData, 'update');
        
        // Mark as synced in local storage
        const localItem = JSON.parse(localStorage.getItem(key));
        if (localItem) {
          localItem._synced = true;
          localStorage.setItem(key, JSON.stringify(localItem));
        }
        
        console.log(`✅ Background update sync completed: ${collectionName} - ${docId}`);
      } catch (error) {
        console.error(`❌ Background update sync failed: ${collectionName} - ${docId}`, error);
      }
    }, 1000);

  } catch (error) {
    console.error(`Error in enhanced update operation for ${collectionName}:`, error);
    showNotification(`Failed to update ${collectionName}`, 'error');
    throw error;
  }
}

async function enhancedDeleteOperation(collectionName, docId, successMessage) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // LAYER 1: Remove from local storage immediately
    const key = `worklog_${collectionName}_${docId}`;
    StorageSystem.removeFromLocal(key);

    // LAYER 2: Clear cache immediately
    StorageSystem.clearCache(collectionName);

    // Show success immediately
    showNotification(successMessage, 'success');

    // LAYER 3: Delete from cloud in background
    setTimeout(async () => {
      try {
        await StorageSystem.syncToCloud(collectionName, { id: docId }, 'delete');
        console.log(`✅ Background delete sync completed: ${collectionName} - ${docId}`);
      } catch (error) {
        console.error(`❌ Background delete sync failed: ${collectionName} - ${docId}`, error);
      }
    }, 1000);

  } catch (error) {
    console.error(`Error in enhanced delete operation for ${collectionName}:`, error);
    showNotification(`Failed to delete ${collectionName}`, 'error');
    throw error;
  }
}

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
let appInitialized = false;
let domContentLoadedFired = false;

// ===========================
// UTILITY FUNCTIONS
// ===========================

function getLocalISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForInput(dateString) {
  if (!dateString) return new Date().toISOString().split('T')[0];
  
  try {
    let date;
    if (dateString.includes('T')) {
      date = new Date(dateString);
    } else {
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }
    
    if (isNaN(date.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    
    const localYear = date.getFullYear();
    const localMonth = String(date.getMonth() + 1).padStart(2, '0');
    const localDay = String(date.getDate()).padStart(2, '0');
    return `${localYear}-${localMonth}-${localDay}`;
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function fmtDateISO(yyyyMmDd) {
  if (!yyyyMmDd) return new Date().toISOString();
  try {
    const [year, month, day] = yyyyMmDd.split('-').map(Number);
    const localDate = new Date(year, month - 1, day, 12, 0, 0);
    const isoString = localDate.toISOString();
    return isoString;
  } catch (error) {
    console.error('❌ Date conversion error:', error);
    return new Date().toISOString();
  }
}

function convertToLocalDate(dateString) {
  if (!dateString) return new Date();
  
  try {
    let date;
    if (dateString.includes('T')) {
      date = new Date(dateString);
    } else {
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }
    return date;
  } catch {
    return new Date();
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Never';
  try {
    const date = convertToLocalDate(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

function safeNumber(n, fallback = 0) {
  if (n === null || n === undefined || n === '') return fallback;
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function fmtMoney(n) {
  return safeNumber(n).toFixed(2);
}

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function showNotification(message, type = 'info') {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notification => notification.remove());

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);

  // Close button
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });
}

// ===========================
// ENHANCED RENDER FUNCTIONS WITH LOCAL + CLOUD DATA
// ===========================

async function renderWithLocalAndCloud(containerId, collectionName, renderFunction, emptyMessage, limit = null) {
  const user = auth.currentUser;
  if (!user) return;

  const container = document.getElementById(containerId);
  if (!container) return;

  // Show cached data immediately if available
  if (isCacheValid(collectionName) && cache[collectionName]) {
    container.innerHTML = cache[collectionName];
    console.log(`✅ ${collectionName} loaded from cache`);
    return;
  }

  container.innerHTML = '<div class="loading">Loading...</div>';

  try {
    // Get data from both local storage and cloud
    const localItems = StorageSystem.getFromLocal(collectionName);
    let cloudItems = [];

    try {
      const isTimeBased = ['hours', 'marks', 'attendance', 'payments'].includes(collectionName);
      const firestoreQuery = isTimeBased 
        ? query(collection(db, "users", user.uid, collectionName), orderBy("dateIso", "desc"))
        : collection(db, "users", user.uid, collectionName);
      
      const snap = await getDocs(firestoreQuery);
      cloudItems = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), _synced: true }));
    } catch (cloudError) {
      console.warn(`⚠️ Cloud data unavailable for ${collectionName}, using local data only`);
    }

    // Merge and deduplicate items (local items take precedence for un-synced data)
    const allItems = [...cloudItems];
    const localItemIds = new Set(cloudItems.map(item => item.id));
    
    localItems.forEach(localItem => {
      if (!localItemIds.has(localItem.id) && !localItem._synced) {
        allItems.push(localItem);
      }
    });

    if (allItems.length === 0) {
      const emptyHTML = `<div class="empty-state"><h3>${emptyMessage}</h3></div>`;
      container.innerHTML = emptyHTML;
      StorageSystem.updateCache(collectionName, emptyHTML);
      return;
    }

    // Sort if needed (for time-based collections)
    if (['hours', 'marks', 'attendance', 'payments'].includes(collectionName)) {
      allItems.sort((a, b) => new Date(b.dateIso || b.date) - new Date(a.dateIso || a.date));
    }

    // Apply limit if specified
    const finalItems = limit ? allItems.slice(0, limit) : allItems;
    const html = await renderFunction(finalItems);
    container.innerHTML = html;
    StorageSystem.updateCache(collectionName, html);
    
    const unsyncedCount = localItems.filter(i => !i._synced).length;
    console.log(`✅ ${collectionName} loaded: ${unsyncedCount} local + ${cloudItems.length} cloud items`);

  } catch (error) {
    console.error(`Error rendering ${collectionName}:`, error);
    container.innerHTML = '<div class="error">Error loading data</div>';
  }
}

// ===========================
// DOM STRUCTURE CHECKER
// ===========================

function checkDOMStructure() {
  console.log('🔍 Checking DOM structure...');
  
  // Check tabs
  const tabButtons = document.querySelectorAll('[data-tab]');
  const tabContents = document.querySelectorAll('.tab-content');
  
  console.log('📋 Tab Buttons:', tabButtons.length);
  tabButtons.forEach(btn => {
    console.log(`  - ${btn.getAttribute('data-tab')} (${btn.textContent})`);
  });
  
  console.log('📋 Tab Contents:', tabContents.length);
  tabContents.forEach(content => {
    console.log(`  - ${content.id}`);
  });

  // Check forms
  const forms = ['studentForm', 'hoursForm', 'marksForm', 'attendanceForm', 'paymentsForm'];
  console.log('📋 Forms:');
  forms.forEach(formId => {
    const form = document.getElementById(formId);
    console.log(`  - ${formId}: ${form ? 'FOUND' : 'MISSING'}`);
  });

  // Check lists
  const lists = ['studentsList', 'recentHoursList', 'recentMarksList', 'attendanceRecentList', 'paymentActivityList'];
  console.log('📋 Lists:');
  lists.forEach(listId => {
    const list = document.getElementById(listId);
    console.log(`  - ${listId}: ${list ? 'FOUND' : 'MISSING'}`);
  });

  return tabButtons.length > 0 && tabContents.length > 0;
}

// ===========================
// TAB NAVIGATION SYSTEM
// ===========================

function setupTabNavigation() {
  console.log('🔧 Setting up tab navigation...');
  
  const tabButtons = document.querySelectorAll('[data-tab]');
  const tabContents = document.querySelectorAll('.tab-content');

  console.log(`📊 Found ${tabButtons.length} tab buttons and ${tabContents.length} tab contents`);

  if (tabButtons.length === 0 || tabContents.length === 0) {
    console.error('❌ No tabs found in DOM! Check your HTML structure');
    showNotification('Tab navigation not available', 'error');
    return;
  }

  // Add click listeners to all tab buttons
  tabButtons.forEach(button => {
    const targetTab = button.getAttribute('data-tab');
    console.log(`📌 Setting up tab button for: ${targetTab}`);
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      console.log(`🎯 Clicked tab: ${targetTab}`);
      switchToTab(targetTab);
    });
  });

  // Activate first tab by default
  const firstTab = tabButtons[0]?.getAttribute('data-tab');
  if (firstTab) {
    console.log(`🚀 Activating first tab: ${firstTab}`);
    switchToTab(firstTab);
  } else {
    console.error('❌ No tabs available to activate');
  }
}

function switchToTab(tabName) {
  console.log(`🔄 Switching to tab: ${tabName}`);
  
  // Update tab buttons
  const tabButtons = document.querySelectorAll('[data-tab]');
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
      console.log(`✅ Activated button: ${tabName}`);
    }
  });

  // Update tab contents
  const tabContents = document.querySelectorAll('.tab-content');
  let foundTab = false;
  
  tabContents.forEach(content => {
    content.classList.remove('active');
    if (content.id === tabName) {
      content.classList.add('active');
      foundTab = true;
      console.log(`✅ Activated content: ${tabName}`);
    }
  });

  if (!foundTab) {
    console.error(`❌ Tab content not found for: ${tabName}`);
    showNotification(`Tab '${tabName}' not found`, 'error');
    return;
  }

  // Load data for the active tab
  loadTabData(tabName);
  
  // Setup forms for the active tab
  setupTabForms(tabName);
}

function loadTabData(tabName) {
  console.log(`📊 Loading data for tab: ${tabName}`);
  
  switch(tabName) {
    case 'students':
      renderStudents();
      break;
    case 'hours':
      renderRecentHours();
      break;
    case 'marks':
      renderRecentMarks();
      break;
    case 'attendance':
      renderAttendanceRecent();
      break;
    case 'payments':
      renderPaymentActivity();
      break;
    default:
      console.warn(`⚠️ Unknown tab: ${tabName}`);
  }
}

function setupTabForms(tabName) {
  console.log(`🔧 Setting up forms for tab: ${tabName}`);
  
  switch(tabName) {
    case 'students':
      setupStudentForm();
      break;
    case 'hours':
      setupHoursForm();
      break;
    case 'marks':
      setupMarksForm();
      break;
    case 'attendance':
      setupAttendanceForm();
      break;
    case 'payments':
      setupPaymentsForm();
      break;
  }
}

// ===========================
// STUDENT MANAGEMENT
// ===========================

async function renderStudents() {
  await renderWithLocalAndCloud('studentsList', 'students', renderStudentsList, 'No students added yet');
}

function renderStudentsList(students) {
  if (!students || students.length === 0) {
    return '<div class="empty-state"><h3>No students added yet</h3><p>Add your first student to get started</p></div>';
  }

  return `
    <div class="students-grid">
      ${students.map(student => {
        const isLocal = student._local && !student._synced;
        const syncBadge = isLocal ? '<span class="sync-badge local" title="Local only - not synced">💾</span>' : '';
        
        return `
        <div class="student-card" data-student-id="${student.id}">
          <div class="student-header">
            <h3>${student.name || 'Unnamed Student'} ${syncBadge}</h3>
            <div class="student-actions">
              <button class="btn-icon edit-student" title="Edit Student">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon delete-student" title="Delete Student">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="student-details">
            <div class="student-info">
              <span class="label">Rate:</span>
              <span class="value">$${fmtMoney(student.rate || 0)}/hr</span>
            </div>
            <div class="student-info">
              <span class="label">Subject:</span>
              <span class="value">${student.subject || 'Not specified'}</span>
            </div>
            <div class="student-info">
              <span class="label">Contact:</span>
              <span class="value">${student.contact || 'Not provided'}</span>
            </div>
            ${student.notes ? `
            <div class="student-info">
              <span class="label">Notes:</span>
              <span class="value">${student.notes}</span>
            </div>
            ` : ''}
          </div>
          <div class="student-stats">
            <div class="stat">
              <span class="stat-label">Total Hours</span>
              <span class="stat-value">${student.totalHours || 0}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Total Earned</span>
              <span class="stat-value">$${fmtMoney(student.totalEarned || 0)}</span>
            </div>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  `;
}

function setupStudentForm() {
  const studentForm = document.getElementById('studentForm');
  if (!studentForm) {
    console.warn('⚠️ Student form not found in DOM');
    return;
  }

  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(studentForm);
    const studentData = {
      name: formData.get('name'),
      rate: safeNumber(formData.get('rate')),
      subject: formData.get('subject'),
      contact: formData.get('contact'),
      notes: formData.get('notes'),
      createdAt: new Date().toISOString(),
      totalHours: 0,
      totalEarned: 0
    };

    try {
      if (currentEditStudentId) {
        // Update existing student using 3-layer system
        await enhancedUpdateOperation('students', currentEditStudentId, studentData, 'Student updated successfully!');
        currentEditStudentId = null;
        
        // Reset form to "add" mode
        studentForm.querySelector('button[type="submit"]').textContent = 'Add Student';
        studentForm.reset();
      } else {
        // Add new student using 3-layer system
        await enhancedCreateOperation('students', studentData, 'Student added successfully!');
        studentForm.reset();
      }
      
      await renderStudents();
    } catch (error) {
      console.error('Error saving student:', error);
    }
  });
}

// ===========================
// HOURS TRACKING
// ===========================

async function renderRecentHours() {
  await renderWithLocalAndCloud('recentHoursList', 'hours', renderHoursList, 'No hours logged yet', 10);
}

function renderHoursList(hours) {
  if (!hours || hours.length === 0) {
    return '<div class="empty-state"><h3>No hours logged yet</h3><p>Track your tutoring sessions to see them here</p></div>';
  }

  return `
    <div class="hours-list">
      ${hours.map(hour => {
        const isLocal = hour._local && !hour._synced;
        const syncBadge = isLocal ? '<span class="sync-badge local" title="Local only - not synced">💾</span>' : '';
        
        return `
        <div class="hour-item" data-hour-id="${hour.id}">
          <div class="hour-header">
            <div class="hour-student">${hour.studentName || 'Unknown Student'} ${syncBadge}</div>
            <div class="hour-amount">$${fmtMoney(hour.amount || 0)}</div>
          </div>
          <div class="hour-details">
            <div class="hour-date">${formatDate(hour.date)}</div>
            <div class="hour-duration">${hour.duration || 0} hours</div>
            <div class="hour-rate">@ $${fmtMoney(hour.rate || 0)}/hr</div>
          </div>
          ${hour.notes ? `<div class="hour-notes">${hour.notes}</div>` : ''}
          <div class="hour-actions">
            <button class="btn-small edit-hour">Edit</button>
            <button class="btn-small btn-danger delete-hour">Delete</button>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  `;
}

function setupHoursForm() {
  const hoursForm = document.getElementById('hoursForm');
  if (!hoursForm) {
    console.warn('⚠️ Hours form not found in DOM');
    return;
  }

  // Rate calculation elements
  const durationInput = document.getElementById('hoursDuration');
  const rateInput = document.getElementById('hoursRate');
  const amountDisplay = document.getElementById('hoursAmount');

  // Check if all required elements exist
  if (!durationInput || !rateInput || !amountDisplay) {
    console.warn('⚠️ Some hours form elements not found');
    return;
  }

  function calculateAmount() {
    const duration = safeNumber(durationInput.value);
    const rate = safeNumber(rateInput.value);
    const amount = duration * rate;
    amountDisplay.textContent = fmtMoney(amount);
  }

  durationInput.addEventListener('input', calculateAmount);
  rateInput.addEventListener('input', calculateAmount);

  // Form submission
  hoursForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(hoursForm);
    const studentId = formData.get('studentId');
    const studentSelect = document.getElementById('hoursStudent');
    const studentName = studentSelect ? studentSelect.selectedOptions[0]?.text || 'Unknown' : 'Unknown';
    
    const hoursData = {
      studentId: studentId,
      studentName: studentName,
      date: formData.get('date') || getLocalISODate(),
      dateIso: fmtDateISO(formData.get('date')),
      duration: safeNumber(formData.get('duration')),
      rate: safeNumber(formData.get('rate')),
      amount: safeNumber(formData.get('duration')) * safeNumber(formData.get('rate')),
      notes: formData.get('notes') || '',
      createdAt: new Date().toISOString()
    };

    try {
      if (currentEditHoursId) {
        // Update existing hours using 3-layer system
        await enhancedUpdateOperation('hours', currentEditHoursId, hoursData, 'Hours updated successfully!');
        currentEditHoursId = null;
        
        // Reset form
        hoursForm.querySelector('button[type="submit"]').textContent = 'Log Hours';
        hoursForm.reset();
        amountDisplay.textContent = '0.00';
      } else {
        // Add new hours using 3-layer system
        await enhancedCreateOperation('hours', hoursData, 'Hours logged successfully!');
        hoursForm.reset();
        amountDisplay.textContent = '0.00';
      }
      
      await renderRecentHours();
      
    } catch (error) {
      console.error('Error saving hours:', error);
    }
  });

  // Set default date to today
  const dateInput = document.getElementById('hoursDate');
  if (dateInput) {
    dateInput.value = getLocalISODate();
  }

  console.log('✅ Hours form setup completed');
}

// ===========================
// MARKS/GRADES TRACKING
// ===========================

async function renderRecentMarks() {
  await renderWithLocalAndCloud('recentMarksList', 'marks', renderMarksList, 'No marks recorded yet', 10);
}

function renderMarksList(marks) {
  if (!marks || marks.length === 0) {
    return '<div class="empty-state"><h3>No marks recorded yet</h3><p>Record test scores and grades to see them here</p></div>';
  }

  return `
    <div class="marks-list">
      ${marks.map(mark => {
        const percentage = safeNumber(mark.percentage);
        const grade = calculateGrade(percentage);
        const gradeClass = `grade-${grade.toLowerCase()}`;
        const isLocal = mark._local && !mark._synced;
        const syncBadge = isLocal ? '<span class="sync-badge local" title="Local only - not synced">💾</span>' : '';
        
        return `
        <div class="mark-item" data-mark-id="${mark.id}">
          <div class="mark-header">
            <div class="mark-student">${mark.studentName || 'Unknown Student'} ${syncBadge}</div>
            <div class="mark-percentage ${gradeClass}">${percentage}%</div>
          </div>
          <div class="mark-details">
            <div class="mark-test">${mark.testName || 'Unnamed Test'}</div>
            <div class="mark-grade ${gradeClass}">${grade}</div>
            <div class="mark-date">${formatDate(mark.date)}</div>
          </div>
          ${mark.notes ? `<div class="mark-notes">${mark.notes}</div>` : ''}
          <div class="mark-actions">
            <button class="btn-small edit-mark">Edit</button>
            <button class="btn-small btn-danger delete-mark">Delete</button>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  `;
}

function setupMarksForm() {
  const marksForm = document.getElementById('marksForm');
  if (!marksForm) {
    console.warn('⚠️ Marks form not found in DOM');
    return;
  }

  // Grade calculation elements
  const scoreInput = document.getElementById('marksScore');
  const maxScoreInput = document.getElementById('marksMaxScore');
  const percentageDisplay = document.getElementById('marksPercentage');
  const gradeDisplay = document.getElementById('marksGrade');

  // Check if all required elements exist
  if (!scoreInput || !maxScoreInput || !percentageDisplay || !gradeDisplay) {
    console.warn('⚠️ Some marks form elements not found');
    return;
  }

  function calculateGradeDisplay() {
    const score = safeNumber(scoreInput.value);
    const maxScore = safeNumber(maxScoreInput.value);
    
    if (maxScore > 0) {
      const percentage = (score / maxScore) * 100;
      const grade = calculateGrade(percentage);
      
      percentageDisplay.textContent = percentage.toFixed(1) + '%';
      gradeDisplay.textContent = grade;
      gradeDisplay.className = `grade-display grade-${grade.toLowerCase()}`;
    } else {
      percentageDisplay.textContent = '0%';
      gradeDisplay.textContent = 'N/A';
      gradeDisplay.className = 'grade-display';
    }
  }

  scoreInput.addEventListener('input', calculateGradeDisplay);
  maxScoreInput.addEventListener('input', calculateGradeDisplay);

  // Form submission
  marksForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(marksForm);
    const studentId = formData.get('studentId');
    const studentSelect = document.getElementById('marksStudent');
    const studentName = studentSelect ? studentSelect.selectedOptions[0]?.text || 'Unknown' : 'Unknown';
    const score = safeNumber(formData.get('score'));
    const maxScore = safeNumber(formData.get('maxScore'));
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    
    const marksData = {
      studentId: studentId,
      studentName: studentName,
      testName: formData.get('testName') || '',
      date: formData.get('date') || getLocalISODate(),
      dateIso: fmtDateISO(formData.get('date')),
      score: score,
      maxScore: maxScore,
      percentage: percentage,
      grade: calculateGrade(percentage),
      notes: formData.get('notes') || '',
      createdAt: new Date().toISOString()
    };

    try {
      if (currentEditMarksId) {
        // Update existing marks using 3-layer system
        await enhancedUpdateOperation('marks', currentEditMarksId, marksData, 'Marks updated successfully!');
        currentEditMarksId = null;
        
        // Reset form
        marksForm.querySelector('button[type="submit"]').textContent = 'Record Marks';
        marksForm.reset();
        percentageDisplay.textContent = '0%';
        gradeDisplay.textContent = 'N/A';
        gradeDisplay.className = 'grade-display';
      } else {
        // Add new marks using 3-layer system
        await enhancedCreateOperation('marks', marksData, 'Marks recorded successfully!');
        marksForm.reset();
        percentageDisplay.textContent = '0%';
        gradeDisplay.textContent = 'N/A';
        gradeDisplay.className = 'grade-display';
      }
      
      await renderRecentMarks();
      
    } catch (error) {
      console.error('Error saving marks:', error);
    }
  });

  // Set default date to today
  const dateInput = document.getElementById('marksDate');
  if (dateInput) {
    dateInput.value = getLocalISODate();
  }

  console.log('✅ Marks form setup completed');
}

// ===========================
// ATTENDANCE TRACKING
// ===========================

async function renderAttendanceRecent() {
  await renderWithLocalAndCloud('attendanceRecentList', 'attendance', renderAttendanceList, 'No attendance records yet', 10);
}

function renderAttendanceList(attendance) {
  if (!attendance || attendance.length === 0) {
    return '<div class="empty-state"><h3>No attendance records yet</h3><p>Record student attendance to see them here</p></div>';
  }

  return `
    <div class="attendance-list">
      ${attendance.map(record => {
        const statusClass = `attendance-${record.status || 'present'}`;
        const statusIcon = record.status === 'absent' ? '❌' : record.status === 'late' ? '⚠️' : '✅';
        const isLocal = record._local && !record._synced;
        const syncBadge = isLocal ? '<span class="sync-badge local" title="Local only - not synced">💾</span>' : '';
        
        return `
        <div class="attendance-item" data-attendance-id="${record.id}">
          <div class="attendance-header">
            <div class="attendance-student">${record.studentName || 'Unknown Student'} ${syncBadge}</div>
            <div class="attendance-status ${statusClass}">${statusIcon} ${record.status || 'present'}</div>
          </div>
          <div class="attendance-details">
            <div class="attendance-date">${formatDate(record.date)}</div>
            ${record.duration ? `<div class="attendance-duration">${record.duration} hours</div>` : ''}
          </div>
          ${record.notes ? `<div class="attendance-notes">${record.notes}</div>` : ''}
          <div class="attendance-actions">
            <button class="btn-small edit-attendance">Edit</button>
            <button class="btn-small btn-danger delete-attendance">Delete</button>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  `;
}

function setupAttendanceForm() {
  const attendanceForm = document.getElementById('attendanceForm');
  if (!attendanceForm) {
    console.warn('⚠️ Attendance form not found in DOM');
    return;
  }

  // Form submission
  attendanceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(attendanceForm);
    const studentId = formData.get('studentId');
    const studentSelect = document.getElementById('attendanceStudent');
    const studentName = studentSelect ? studentSelect.selectedOptions[0]?.text || 'Unknown' : 'Unknown';
    
    const attendanceData = {
      studentId: studentId,
      studentName: studentName,
      date: formData.get('date') || getLocalISODate(),
      dateIso: fmtDateISO(formData.get('date')),
      status: formData.get('status') || 'present',
      duration: safeNumber(formData.get('duration')),
      notes: formData.get('notes') || '',
      createdAt: new Date().toISOString()
    };

    try {
      if (currentEditAttendanceId) {
        // Update existing attendance using 3-layer system
        await enhancedUpdateOperation('attendance', currentEditAttendanceId, attendanceData, 'Attendance updated successfully!');
        currentEditAttendanceId = null;
        
        // Reset form
        attendanceForm.querySelector('button[type="submit"]').textContent = 'Record Attendance';
        attendanceForm.reset();
      } else {
        // Add new attendance using 3-layer system
        await enhancedCreateOperation('attendance', attendanceData, 'Attendance recorded successfully!');
        attendanceForm.reset();
      }
      
      await renderAttendanceRecent();
      
    } catch (error) {
      console.error('Error saving attendance:', error);
    }
  });

  // Set default date to today
  const dateInput = document.getElementById('attendanceDate');
  if (dateInput) {
    dateInput.value = getLocalISODate();
  }

  console.log('✅ Attendance form setup completed');
}

// ===========================
// PAYMENTS TRACKING
// ===========================

async function renderPaymentActivity() {
  await renderWithLocalAndCloud('paymentActivityList', 'payments', renderPaymentsList, 'No payments recorded yet', 10);
}

function renderPaymentsList(payments) {
  if (!payments || payments.length === 0) {
    return '<div class="empty-state"><h3>No payments recorded yet</h3><p>Record payment transactions to see them here</p></div>';
  }

  return `
    <div class="payments-list">
      ${payments.map(payment => {
        const statusClass = `payment-${payment.status || 'pending'}`;
        const statusIcon = payment.status === 'paid' ? '✅' : payment.status === 'overdue' ? '❌' : '⏳';
        const isLocal = payment._local && !payment._synced;
        const syncBadge = isLocal ? '<span class="sync-badge local" title="Local only - not synced">💾</span>' : '';
        
        return `
        <div class="payment-item" data-payment-id="${payment.id}">
          <div class="payment-header">
            <div class="payment-student">${payment.studentName || 'Unknown Student'} ${syncBadge}</div>
            <div class="payment-amount">$${fmtMoney(payment.amount || 0)}</div>
          </div>
          <div class="payment-details">
            <div class="payment-date">${formatDate(payment.date)}</div>
            <div class="payment-status ${statusClass}">${statusIcon} ${payment.status || 'pending'}</div>
            <div class="payment-method">${payment.method || 'Not specified'}</div>
          </div>
          ${payment.notes ? `<div class="payment-notes">${payment.notes}</div>` : ''}
          <div class="payment-actions">
            <button class="btn-small edit-payment">Edit</button>
            <button class="btn-small btn-danger delete-payment">Delete</button>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  `;
}

function setupPaymentsForm() {
  const paymentsForm = document.getElementById('paymentsForm');
  if (!paymentsForm) {
    console.warn('⚠️ Payments form not found in DOM');
    return;
  }

  // Form submission
  paymentsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(paymentsForm);
    const studentId = formData.get('studentId');
    const studentSelect = document.getElementById('paymentStudent');
    const studentName = studentSelect ? studentSelect.selectedOptions[0]?.text || 'Unknown' : 'Unknown';
    
    const paymentData = {
      studentId: studentId,
      studentName: studentName,
      date: formData.get('date') || getLocalISODate(),
      dateIso: fmtDateISO(formData.get('date')),
      amount: safeNumber(formData.get('amount')),
      status: formData.get('status') || 'pending',
      method: formData.get('method') || '',
      notes: formData.get('notes') || '',
      createdAt: new Date().toISOString()
  };
    try {
      if (currentEditPaymentId) {
        // Update existing payment using 3-layer system
        await enhancedUpdateOperation('payments', currentEditPaymentId, paymentData, 'Payment updated successfully!');
        currentEditPaymentId = null;
        
        // Reset form
        paymentsForm.querySelector('button[type="submit"]').textContent = 'Record Payment';
        paymentsForm.reset();
      } else {
        // Add new payment using 3-layer system
        await enhancedCreateOperation('payments', paymentData, 'Payment recorded successfully!');
        paymentsForm.reset();
      }
      
      await renderPaymentActivity();
      
    } catch (error) {
      console.error('Error saving payment:', error);
    }
  });

  // Set default date to today
  const dateInput = document.getElementById('paymentDate');
  if (dateInput) {
    dateInput.value = getLocalISODate();
  }

  console.log('✅ Payments form setup completed');
}

// ===========================
// USER PROFILE & AUTHENTICATION
// ===========================

async function loadUserProfile(uid) {
  console.log('👤 Loading user profile for:', uid);
  
  const user = auth.currentUser;
  const fallbackProfile = {
    email: user?.email || '',
    createdAt: new Date().toISOString(),
    defaultRate: parseFloat(localStorage.getItem('userDefaultRate')) || 0
  };
  
  updateProfileButton(fallbackProfile);
  initializeDefaultRate(fallbackProfile.defaultRate);
  
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      currentUserData = { uid, ...userSnap.data() };
      console.log('✅ User profile loaded from Firestore');
      
      updateProfileButton(currentUserData);
      
      if (currentUserData.defaultRate !== undefined) {
        initializeDefaultRate(currentUserData.defaultRate);
        localStorage.setItem('userDefaultRate', currentUserData.defaultRate.toString());
      }
      
      return currentUserData;
    } else {
      const profileToCreate = {
        ...fallbackProfile,
        lastLogin: new Date().toISOString()
      };
      
      setDoc(userRef, profileToCreate).catch(console.error);
      
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

function initializeDefaultRate(defaultRate = 0) {
  const defaultRateInput = document.getElementById('defaultRate');
  if (defaultRateInput) {
    defaultRateInput.value = defaultRate;
    
    defaultRateInput.addEventListener('change', async (e) => {
      const newRate = safeNumber(e.target.value);
      const user = auth.currentUser;
      
      if (user) {
        const success = await updateUserDefaultRate(user.uid, newRate);
        if (success) {
          showNotification(`Default rate updated to $${fmtMoney(newRate)}/hour`, 'success');
        }
      }
    });
  }
}

// ===========================
// THEME MANAGEMENT
// ===========================

function updateThemeIcon(theme) {
    const themeButton = document.querySelector('.theme-toggle button');
    if (!themeButton) return;
    
    if (theme === 'dark') {
        themeButton.setAttribute('title', 'Switch to light mode');
    } else {
        themeButton.setAttribute('title', 'Switch to dark mode');
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    console.log(`🎨 Theme changed to ${newTheme}`);
}

function setupThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle button');
    if (themeToggle) {
        themeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTheme();
        });
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// ===========================
// FLOATING ADD BUTTON
// ===========================

function setupFloatingAddButton() {
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');

  console.log('🔧 Setting up FAB...');

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
      const isClickOnFabItem = e.target.closest('.fab-item');
      
      if (!isClickOnFab && !isClickOnMenu && !isClickOnFabItem) {
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
        }, 100);
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
        }, 100);
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
        }, 100);
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
        }, 100);
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
// SYNC MANAGEMENT
// ===========================

function setupSyncManagement() {
  // Manual sync button
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      await manualSync();
    });
  }

  // Auto-sync toggle
  const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
  const autoSyncText = document.getElementById('autoSyncText');
  
  if (autoSyncCheckbox) {
    autoSyncCheckbox.addEventListener('change', (e) => {
      toggleAutoSync(e.target.checked);
    });

    // Load saved preference
    const savedAutoSync = localStorage.getItem('autoSyncEnabled') === 'true';
    autoSyncCheckbox.checked = savedAutoSync;
    toggleAutoSync(savedAutoSync);
  }

  // Online/offline detection
  window.addEventListener('online', () => {
    showNotification('Connection restored - syncing data...', 'info');
    setSyncStatus('success', 'Online - sync available');
    StorageSystem.processPendingSync();
  });

  window.addEventListener('offline', () => {
    showNotification('Working offline - changes saved locally', 'info');
    setSyncStatus('offline', 'Offline - local storage only');
  });
}

async function manualSync() {
  const user = auth.currentUser;
  if (!user) {
    showNotification('Please sign in to sync', 'error');
    return;
  }

  setSyncStatus('syncing', 'Syncing data...');
  
  try {
    // Process pending sync items
    await StorageSystem.processPendingSync();
    
    // Clear all caches to force refresh
    clearAllCache();
    
    // Refresh all views
    await Promise.all([
      renderStudents(),
      renderRecentHours(),
      renderRecentMarks(),
      renderAttendanceRecent(),
      renderPaymentActivity()
    ]);
    
    setSyncStatus('success', 'Sync completed successfully');
    showNotification('Data synced successfully', 'success');
    
  } catch (error) {
    console.error('Manual sync failed:', error);
    setSyncStatus('error', 'Sync failed - check connection');
    showNotification('Sync failed - some data may be offline', 'error');
  }
}

function setSyncStatus(status, message = '') {
  const statusMap = {
    syncing: { icon: '🔄', class: 'syncing' },
    success: { icon: '✅', class: 'success' },
    error: { icon: '❌', class: 'error' },
    offline: { icon: '🌐', class: 'offline' }
  };

  const statusInfo = statusMap[status] || statusMap.offline;
  
  const syncIndicator = document.getElementById('syncIndicator');
  const syncSpinner = document.getElementById('syncSpinner');
  
  if (syncIndicator) {
    syncIndicator.innerHTML = `${statusInfo.icon} ${message}`;
    syncIndicator.className = `sync-status ${statusInfo.class}`;
  }

  if (syncSpinner) {
    syncSpinner.style.display = status === 'syncing' ? 'inline-block' : 'none';
  }
}

function toggleAutoSync(enabled) {
  isAutoSyncEnabled = enabled;
  localStorage.setItem('autoSyncEnabled', enabled.toString());

  if (enabled) {
    // Start auto-sync every 2 minutes
    autoSyncInterval = setInterval(() => {
      if (auth.currentUser && navigator.onLine) {
        console.log('🔄 Auto-sync running...');
        StorageSystem.processPendingSync();
      }
    }, 2 * 60 * 1000);

    const autoSyncText = document.getElementById('autoSyncText');
    if (autoSyncText) autoSyncText.textContent = 'Auto-sync: ON';
    showNotification('Auto-sync enabled', 'info');
  } else {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval);
      autoSyncInterval = null;
    }
    const autoSyncText = document.getElementById('autoSyncText');
    if (autoSyncText) autoSyncText.textContent = 'Auto-sync: OFF';
    showNotification('Auto-sync disabled', 'info');
  }
}

// ===========================
// MAIN APP INITIALIZATION
// ===========================

async function initializeApp() {
  // Prevent duplicate initialization
  if (appInitialized) {
    console.log('⚠️ App already initialized, skipping...');
    return;
  }
  
  console.log('🚀 Initializing WorkLog App...');
  appInitialized = true;

  try {
    // Wait for auth state
    const user = await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe(); // Important: unsubscribe immediately
        resolve(user);
      });
    });

    if (!user) {
      console.log('❌ No user signed in, redirecting to auth...');
      window.location.href = "auth.html";
      return;
    }

    console.log('✅ User authenticated:', user.uid);

    // Check DOM structure first
    const domValid = checkDOMStructure();
    if (!domValid) {
      console.error('❌ DOM structure invalid, cannot initialize app');
      showNotification('App structure error - please refresh', 'error');
      return;
    }

    // Initialize core systems
    initializeTheme();
    setupThemeToggle();
    setupProfileModal();
    setupFloatingAddButton();
    setupSyncManagement();
    
    // Load user profile
    await loadUserProfile(user.uid);

    // Setup tab navigation - this is critical
    setupTabNavigation();

    console.log('✅ WorkLog App initialized successfully');
    showNotification('App loaded successfully', 'success');

  } catch (error) {
    console.error('❌ App initialization failed:', error);
    showNotification('App initialization failed', 'error');
    // Reset flag on failure so we can retry
    appInitialized = false;
  }
}

// ===========================
// START THE APPLICATION
// ===========================

// Only set up one event listener to prevent duplicates
document.addEventListener('DOMContentLoaded', function() {
  if (domContentLoadedFired) {
    console.log('⚠️ DOMContentLoaded already fired, skipping...');
    return;
  }
  
  domContentLoadedFired = true;
  console.log('📄 DOM Content Loaded - Starting app initialization');
  
  // Small delay to ensure all DOM is ready
  setTimeout(() => {
    initializeApp().catch(error => {
      console.error('Failed to initialize app:', error);
    });
  }, 100);
});

// Export for use in other modules
window.StorageSystem = StorageSystem;
window.enhancedCreateOperation = enhancedCreateOperation;
window.enhancedUpdateOperation = enhancedUpdateOperation;
window.enhancedDeleteOperation = enhancedDeleteOperation;
