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
  if (!user) {
    console.warn('⚠️ User not authenticated for create operation');
    return null;
  }

  try {
    // Generate unique ID
    const itemId = data.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const itemData = { ...data, id: itemId };

    // LAYER 1: Save to local storage immediately (INSTANT)
    const localKey = StorageSystem.saveToLocal(collectionName, itemData);
    if (!localKey) {
      throw new Error('Failed to save to local storage');
    }

    // LAYER 2: Clear cache immediately (FAST)
    StorageSystem.clearCache(collectionName);

    // Show success immediately
    showNotification(successMessage, 'success');

    // LAYER 3: Sync to cloud in background (SLOW)
    setTimeout(async () => {
      try {
        await StorageSystem.syncToCloud(collectionName, itemData, 'create');
        
        // Update local storage to mark as synced
        const localItem = JSON.parse(localStorage.getItem(localKey));
        if (localItem) {
          localItem._synced = true;
          localStorage.setItem(localKey, JSON.stringify(localItem));
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
        // Don't show notification for background failures to avoid user confusion
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
  if (!user) {
    console.warn('⚠️ User not authenticated for update operation');
    return;
  }

  try {
    const itemData = { ...data, id: docId };
    const key = `worklog_${collectionName}_${docId}`;

    // LAYER 1: Update local storage immediately
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
        // Don't show notification for background failures
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
  if (!user) {
    console.warn('⚠️ User not authenticated for delete operation');
    return;
  }

  try {
    const key = `worklog_${collectionName}_${docId}`;

    // LAYER 1: Remove from local storage immediately
    StorageSystem.removeFromLocal(key);

    // LAYER 2: Clear cache immediately
    StorageSystem.clearCache(collectionName);

    // Show success immediately
    showNotification(successMessage, 'success');

    // LAYER 3: Delete from cloud in background
    setTimeout(async () => {
      try {
        // For delete operations, we only need the document ID, not the data
        await StorageSystem.syncToCloud(collectionName, { id: docId }, 'delete');
        console.log(`✅ Background delete sync completed: ${collectionName} - ${docId}`);
      } catch (error) {
        console.error(`❌ Background delete sync failed: ${collectionName} - ${docId}`, error);
        // Don't show notification for background failures
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
// TIMEZONE UTILITY FUNCTIONS
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

function formatDateTime(dateString) {
  if (!dateString) return 'Never';
  try {
    const date = convertToLocalDate(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

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

function refreshTimestamp() {
  const now = new Date().toLocaleString();
  if (syncMessageLine) syncMessageLine.textContent = "Status: Last synced at " + now;
  if (document.getElementById('statUpdated')) {
    document.getElementById('statUpdated').textContent = now;
  }
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

async function updateUserDefaultRate(uid, newRate) {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      defaultRate: newRate,
      updatedAt: new Date().toISOString()
    });
    
    if (currentUserData) {
      currentUserData.defaultRate = newRate;
    }
    
    console.log('✅ Default rate updated:', newRate);
    return true;
  } catch (err) {
    console.error("❌ Error updating default rate:", err);
    return false;
  }
}

async function applyDefaultRateToAllStudents(uid, newRate) {
  try {
    const studentsSnap = await getDocs(collection(db, "users", uid, "students"));
    const batch = writeBatch(db);
    let updateCount = 0;

    studentsSnap.forEach((docSnap) => {
      const studentRef = doc(db, "users", uid, "students", docSnap.id);
      batch.update(studentRef, { rate: newRate });
      updateCount++;
    });

    if (updateCount > 0) {
      await batch.commit();
      StorageSystem.clearCache('students');
      showNotification(`Default rate applied to ${updateCount} students`, 'success');
      setTimeout(() => renderStudents(), 100);
    } else {
      showNotification("No students found to update", 'info');
    }
    
    return updateCount;
  } catch (err) {
    console.error("❌ Error applying rate to all students:", err);
    showNotification("Failed to apply rate to all students", 'error');
    return 0;
  }
}

function setupProfileModal() {
  const profileBtn = document.getElementById('profileBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileModal = document.getElementById('closeProfileModal');
  const logoutBtn = document.getElementById('logoutBtn');
  const applyRateToAllBtn = document.getElementById('applyRateToAllBtn');

  console.log('🔧 Setting up profile modal...');

  if (!profileModal) {
    console.error('❌ Profile modal not found in DOM');
    return;
  }

  if (profileBtn && profileModal) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('👤 Profile button clicked');
      
      updateProfileModal();
      
      profileModal.style.display = 'flex';
      document.body.classList.add('modal-open');
    });
  } else {
    console.error('❌ Profile button or modal not found');
  }

  if (closeProfileModal) {
    closeProfileModal.addEventListener('click', () => {
      closeModal();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to logout?')) {
        try {
          await signOut(auth);
          window.location.href = "auth.html";
        } catch (error) {
          console.error('Logout error:', error);
          showNotification('Logout failed', 'error');
        }
      }
    });
  }

  if (applyRateToAllBtn) {
    applyRateToAllBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      const newRate = currentUserData?.defaultRate || 0;
      if (newRate > 0) {
        if (confirm(`Apply $${fmtMoney(newRate)}/hour rate to ALL students?`)) {
          await applyDefaultRateToAllStudents(user.uid, newRate);
        }
      } else {
        showNotification('Please set a default rate first', 'error');
      }
    });
  }

  window.addEventListener('click', (event) => {
    if (profileModal && event.target === profileModal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && profileModal && profileModal.style.display === 'flex') {
      closeModal();
    }
  });

  function closeModal() {
    profileModal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }
}

function updateProfileModal() {
  const profileUserEmail = document.getElementById('profileUserEmail');
  const profileUserSince = document.getElementById('profileUserSince');
  const profileDefaultRate = document.getElementById('profileDefaultRate');
  const modalStatStudents = document.getElementById('modalStatStudents');
  const modalStatHours = document.getElementById('modalStatHours');
  const modalStatEarnings = document.getElementById('modalStatEarnings');
  const modalStatUpdated = document.getElementById('modalStatUpdated');

  if (currentUserData) {
    const email = currentUserData.email || auth.currentUser?.email || 'Not available';
    if (profileUserEmail) profileUserEmail.textContent = email;
    
    const createdAt = currentUserData.createdAt || currentUserData.lastLogin || new Date().toISOString();
    if (profileUserSince) profileUserSince.textContent = formatDate(createdAt);
    
    if (profileDefaultRate) {
      profileDefaultRate.textContent = `$${fmtMoney(currentUserData.defaultRate || 0)}/hour`;
    }
  }

  const statStudents = document.getElementById('statStudents');
  const statHours = document.getElementById('statHours');
  const statEarnings = document.getElementById('statEarnings');
  const statUpdated = document.getElementById('statUpdated');

  if (modalStatStudents && statStudents) modalStatStudents.textContent = statStudents.textContent || '0';
  if (modalStatHours && statHours) modalStatHours.textContent = statHours.textContent || '0';
  if (modalStatEarnings && statEarnings) modalStatEarnings.textContent = statEarnings.textContent || '$0.00';
  if (modalStatUpdated && statUpdated) modalStatUpdated.textContent = statUpdated.textContent || 'Never';

  console.log('✅ Profile modal stats updated');
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
// STUDENT MANAGEMENT WITH 3-LAYER SYSTEM
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

function setupStudentEventListeners() {
  // Edit student buttons
  document.querySelectorAll('.edit-student').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const studentCard = e.target.closest('.student-card');
      const studentId = studentCard.dataset.studentId;
      editStudent(studentId);
    });
  });

  // Delete student buttons
  document.querySelectorAll('.delete-student').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const studentCard = e.target.closest('.student-card');
      const studentId = studentCard.dataset.studentId;
      deleteStudent(studentId);
    });
  });
}

function setupStudentForm() {
  const studentForm = document.getElementById('studentForm');
  if (!studentForm) return;

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

async function editStudent(studentId) {
  try {
    // Try to get from local storage first
    const localKey = `worklog_students_${studentId}`;
    const localItem = localStorage.getItem(localKey);
    
    if (localItem) {
      const student = JSON.parse(localItem);
      
      // Fill form with student data
      document.getElementById('studentName').value = student.name || '';
      document.getElementById('studentRate').value = student.rate || '';
      document.getElementById('studentSubject').value = student.subject || '';
      document.getElementById('studentContact').value = student.contact || '';
      document.getElementById('studentNotes').value = student.notes || '';
      
      // Change form to edit mode
      currentEditStudentId = studentId;
      document.getElementById('studentForm').querySelector('button[type="submit"]').textContent = 'Update Student';
      
      // Scroll to form
      document.getElementById('studentForm').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    // Fallback to Firestore if not in local storage
    const user = auth.currentUser;
    if (!user) return;

    const studentDoc = await getDoc(doc(db, "users", user.uid, "students", studentId));
    if (studentDoc.exists()) {
      const student = studentDoc.data();
      
      // Fill form with student data
      document.getElementById('studentName').value = student.name || '';
      document.getElementById('studentRate').value = student.rate || '';
      document.getElementById('studentSubject').value = student.subject || '';
      document.getElementById('studentContact').value = student.contact || '';
      document.getElementById('studentNotes').value = student.notes || '';
      
      // Change form to edit mode
      currentEditStudentId = studentId;
      document.getElementById('studentForm').querySelector('button[type="submit"]').textContent = 'Update Student';
      
      // Scroll to form
      document.getElementById('studentForm').scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error loading student for edit:', error);
    showNotification('Failed to load student data', 'error');
  }
}

async function deleteStudent(studentId) {
  if (!confirm('Are you sure you want to delete this student? This will also delete all associated hours, marks, and attendance records.')) {
    return;
  }

  try {
    // Delete using 3-layer system
    await enhancedDeleteOperation('students', studentId, 'Student and all associated data deleted successfully');
    
    // Also delete associated records
    await deleteAssociatedRecords('hours', 'studentId', studentId);
    await deleteAssociatedRecords('marks', 'studentId', studentId);
    await deleteAssociatedRecords('attendance', 'studentId', studentId);
    await deleteAssociatedRecords('payments', 'studentId', studentId);
    
    await renderStudents();
    await renderRecentHours();
    await renderRecentMarks();
    await renderAttendanceRecent();
    await renderPaymentActivity();
    
  } catch (error) {
    console.error('Error deleting student:', error);
    showNotification('Failed to delete student', 'error');
  }
}

async function deleteAssociatedRecords(collectionName, field, value) {
  try {
    const localItems = StorageSystem.getFromLocal(collectionName);
    localItems.forEach(item => {
      if (item[field] === value) {
        const key = `worklog_${collectionName}_${item.id}`;
        StorageSystem.removeFromLocal(key);
      }
    });
    
    // Also delete from Firestore
    const user = auth.currentUser;
    if (user) {
      const querySnap = await getDocs(query(collection(db, "users", user.uid, collectionName), where(field, "==", value)));
      const batch = writeBatch(db);
      querySnap.docs.forEach(docSnap => {
        batch.delete(doc(db, "users", user.uid, collectionName, docSnap.id));
      });
      await batch.commit();
    }
    
    StorageSystem.clearCache(collectionName);
  } catch (error) {
    console.error(`Error deleting associated ${collectionName}:`, error);
  }
}

// ===========================
// HOURS TRACKING WITH 3-LAYER SYSTEM
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

function setupHoursEventListeners() {
  document.querySelectorAll('.edit-hour').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hourItem = e.target.closest('.hour-item');
      const hourId = hourItem.dataset.hourId;
      editHours(hourId);
    });
  });

  document.querySelectorAll('.delete-hour').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hourItem = e.target.closest('.hour-item');
      const hourId = hourItem.dataset.hourId;
      deleteHours(hourId);
    });
  });
}

function setupHoursForm() {
  const hoursForm = document.getElementById('hoursForm');
  console.log('🔍 Looking for hoursForm:', hoursForm);
  
  if (!hoursForm) {
    console.warn('⚠️ Hours form not found in DOM - checking tab state');
    // Check if we're in the hours tab
    const hoursTab = document.getElementById('hours');
    console.log('🔍 Hours tab exists:', hoursTab);
    if (hoursTab) {
      console.log('🔍 Hours tab active:', hoursTab.classList.contains('active'));
    }
    return;
  }

  // Rate calculation elements
  const durationInput = document.getElementById('hoursDuration');
  const rateInput = document.getElementById('hoursRate');
  const amountDisplay = document.getElementById('hoursAmount');

  console.log('🔍 Hours form elements:', {
    durationInput: !!durationInput,
    rateInput: !!rateInput,
    amountDisplay: !!amountDisplay
  });

  // Check if all required elements exist
  if (!durationInput || !rateInput || !amountDisplay) {
    console.warn('⚠️ Some hours form elements not found');
    console.log('🔍 Available elements in hours form:');
    hoursForm.querySelectorAll('*').forEach(el => {
      console.log('  -', el.tagName, el.id || el.className);
    });
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
        const submitBtn = hoursForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Log Hours';
        hoursForm.reset();
        amountDisplay.textContent = '0.00';
      } else {
        // Add new hours using 3-layer system
        await enhancedCreateOperation('hours', hoursData, 'Hours logged successfully!');
        hoursForm.reset();
        amountDisplay.textContent = '0.00';
      }
      
      await renderRecentHours();
      
      // Update student totals
      if (studentId) {
        await updateStudentTotals(studentId);
      }
      
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

async function editHours(hoursId) {
  try {
    // Try to get from local storage first
    const localKey = `worklog_hours_${hoursId}`;
    const localItem = localStorage.getItem(localKey);
    
    if (localItem) {
      const hours = JSON.parse(localItem);
      
      // Fill form with hours data
      const studentSelect = document.getElementById('hoursStudent');
      const dateInput = document.getElementById('hoursDate');
      const durationInput = document.getElementById('hoursDuration');
      const rateInput = document.getElementById('hoursRate');
      const notesInput = document.getElementById('hoursNotes');
      
      if (studentSelect) studentSelect.value = hours.studentId || '';
      if (dateInput) dateInput.value = formatDateForInput(hours.date);
      if (durationInput) durationInput.value = hours.duration || '';
      if (rateInput) rateInput.value = hours.rate || '';
      if (notesInput) notesInput.value = hours.notes || '';
      
      // Update amount display
      const amountDisplay = document.getElementById('hoursAmount');
      if (amountDisplay) amountDisplay.textContent = fmtMoney(hours.amount || 0);
      
      // Change form to edit mode
      currentEditHoursId = hoursId;
      const submitBtn = document.getElementById('hoursForm')?.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Hours';
      
      // Scroll to form
      const hoursForm = document.getElementById('hoursForm');
      if (hoursForm) hoursForm.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    // Fallback to Firestore
    const user = auth.currentUser;
    if (!user) return;

    const hoursDoc = await getDoc(doc(db, "users", user.uid, "hours", hoursId));
    if (hoursDoc.exists()) {
      const hours = hoursDoc.data();
      
      // Fill form with hours data
      const studentSelect = document.getElementById('hoursStudent');
      const dateInput = document.getElementById('hoursDate');
      const durationInput = document.getElementById('hoursDuration');
      const rateInput = document.getElementById('hoursRate');
      const notesInput = document.getElementById('hoursNotes');
      
      if (studentSelect) studentSelect.value = hours.studentId || '';
      if (dateInput) dateInput.value = formatDateForInput(hours.date);
      if (durationInput) durationInput.value = hours.duration || '';
      if (rateInput) rateInput.value = hours.rate || '';
      if (notesInput) notesInput.value = hours.notes || '';
      
      // Update amount display
      const amountDisplay = document.getElementById('hoursAmount');
      if (amountDisplay) amountDisplay.textContent = fmtMoney(hours.amount || 0);
      
      // Change form to edit mode
      currentEditHoursId = hoursId;
      const submitBtn = document.getElementById('hoursForm')?.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Hours';
      
      // Scroll to form
      const hoursForm = document.getElementById('hoursForm');
      if (hoursForm) hoursForm.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error loading hours for edit:', error);
    showNotification('Failed to load hours data', 'error');
  }
}

async function deleteHours(hoursId) {
  if (!confirm('Are you sure you want to delete these hours?')) {
    return;
  }

  try {
    // Get hours data first to update student totals
    let studentId = null;
    
    // Try local storage first
    const localKey = `worklog_hours_${hoursId}`;
    const localItem = localStorage.getItem(localKey);
    if (localItem) {
      const hours = JSON.parse(localItem);
      studentId = hours.studentId;
    } else {
      // Fallback to Firestore
      const user = auth.currentUser;
      if (user) {
        const hoursDoc = await getDoc(doc(db, "users", user.uid, "hours", hoursId));
        if (hoursDoc.exists()) {
          const hours = hoursDoc.data();
          studentId = hours.studentId;
        }
      }
    }
    
    // Delete using 3-layer system
    await enhancedDeleteOperation('hours', hoursId, 'Hours deleted successfully');
    
    // Update student totals
    if (studentId) {
      await updateStudentTotals(studentId);
    }
    
  } catch (error) {
    console.error('Error deleting hours:', error);
    showNotification('Failed to delete hours', 'error');
  }
}

async function updateStudentTotals(studentId) {
  try {
    // Get all hours for this student from both local and cloud
    const localHours = StorageSystem.getFromLocal('hours').filter(hour => hour.studentId === studentId);
    let cloudHours = [];
    
    const user = auth.currentUser;
    if (user) {
      const hoursQuery = query(collection(db, "users", user.uid, "hours"), where("studentId", "==", studentId));
      const hoursSnap = await getDocs(hoursQuery);
      cloudHours = hoursSnap.docs.map(doc => doc.data());
    }
    
    // Combine and deduplicate
    const allHours = [...cloudHours];
    const cloudIds = new Set(cloudHours.map(hour => hour.id));
    
    localHours.forEach(localHour => {
      if (!cloudIds.has(localHour.id) && !localHour._synced) {
        allHours.push(localHour);
      }
    });
    
    // Calculate totals
    const totalHours = allHours.reduce((sum, hour) => sum + safeNumber(hour.duration), 0);
    const totalEarned = allHours.reduce((sum, hour) => sum + safeNumber(hour.amount), 0);
    
    // Update student using 3-layer system
    const updateData = {
      totalHours: totalHours,
      totalEarned: totalEarned
    };
    
    await enhancedUpdateOperation('students', studentId, updateData, 'Student totals updated');
    
  } catch (error) {
    console.error('Error updating student totals:', error);
  }
}

// ===========================
// MARKS/GRADES TRACKING WITH 3-LAYER SYSTEM
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

function setupMarksEventListeners() {
  document.querySelectorAll('.edit-mark').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const markItem = e.target.closest('.mark-item');
      const markId = markItem.dataset.markId;
      editMarks(markId);
    });
  });

  document.querySelectorAll('.delete-mark').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const markItem = e.target.closest('.mark-item');
      const markId = markItem.dataset.markId;
      deleteMarks(markId);
    });
  });
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
        const submitBtn = marksForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Record Marks';
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

async function editMarks(markId) {
  try {
    // Try to get from local storage first
    const localKey = `worklog_marks_${markId}`;
    const localItem = localStorage.getItem(localKey);
    
    if (localItem) {
      const mark = JSON.parse(localItem);
      
      // Fill form with mark data
      const studentSelect = document.getElementById('marksStudent');
      const testNameInput = document.getElementById('marksTestName');
      const dateInput = document.getElementById('marksDate');
      const scoreInput = document.getElementById('marksScore');
      const maxScoreInput = document.getElementById('marksMaxScore');
      const notesInput = document.getElementById('marksNotes');
      
      if (studentSelect) studentSelect.value = mark.studentId || '';
      if (testNameInput) testNameInput.value = mark.testName || '';
      if (dateInput) dateInput.value = formatDateForInput(mark.date);
      if (scoreInput) scoreInput.value = mark.score || '';
      if (maxScoreInput) maxScoreInput.value = mark.maxScore || '';
      if (notesInput) notesInput.value = mark.notes || '';
      
      // Update grade display
      const percentageDisplay = document.getElementById('marksPercentage');
      const gradeDisplay = document.getElementById('marksGrade');
      if (percentageDisplay && gradeDisplay) {
        percentageDisplay.textContent = (mark.percentage || 0).toFixed(1) + '%';
        gradeDisplay.textContent = mark.grade || 'N/A';
        gradeDisplay.className = `grade-display grade-${(mark.grade || 'n/a').toLowerCase()}`;
      }
      
      // Change form to edit mode
      currentEditMarksId = markId;
      const submitBtn = document.getElementById('marksForm')?.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Marks';
      
      // Scroll to form
      const marksForm = document.getElementById('marksForm');
      if (marksForm) marksForm.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    // Fallback to Firestore
    const user = auth.currentUser;
    if (!user) return;

    const markDoc = await getDoc(doc(db, "users", user.uid, "marks", markId));
    if (markDoc.exists()) {
      const mark = markDoc.data();
      
      // Fill form with mark data
      const studentSelect = document.getElementById('marksStudent');
      const testNameInput = document.getElementById('marksTestName');
      const dateInput = document.getElementById('marksDate');
      const scoreInput = document.getElementById('marksScore');
      const maxScoreInput = document.getElementById('marksMaxScore');
      const notesInput = document.getElementById('marksNotes');
      
      if (studentSelect) studentSelect.value = mark.studentId || '';
      if (testNameInput) testNameInput.value = mark.testName || '';
      if (dateInput) dateInput.value = formatDateForInput(mark.date);
      if (scoreInput) scoreInput.value = mark.score || '';
      if (maxScoreInput) maxScoreInput.value = mark.maxScore || '';
      if (notesInput) notesInput.value = mark.notes || '';
      
      // Update grade display
      const percentageDisplay = document.getElementById('marksPercentage');
      const gradeDisplay = document.getElementById('marksGrade');
      if (percentageDisplay && gradeDisplay) {
        percentageDisplay.textContent = (mark.percentage || 0).toFixed(1) + '%';
        gradeDisplay.textContent = mark.grade || 'N/A';
        gradeDisplay.className = `grade-display grade-${(mark.grade || 'n/a').toLowerCase()}`;
      }
      
      // Change form to edit mode
      currentEditMarksId = markId;
      const submitBtn = document.getElementById('marksForm')?.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Marks';
      
      // Scroll to form
      const marksForm = document.getElementById('marksForm');
      if (marksForm) marksForm.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error loading marks for edit:', error);
    showNotification('Failed to load marks data', 'error');
  }
}

async function deleteMarks(markId) {
  if (!confirm('Are you sure you want to delete these marks?')) {
    return;
  }

  try {
    await enhancedDeleteOperation('marks', markId, 'Marks deleted successfully');
    await renderRecentMarks();
  } catch (error) {
    console.error('Error deleting marks:', error);
    showNotification('Failed to delete marks', 'error');
  }
}

// ===========================
// ATTENDANCE TRACKING WITH 3-LAYER SYSTEM
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

function setupAttendanceEventListeners() {
  document.querySelectorAll('.edit-attendance').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const attendanceItem = e.target.closest('.attendance-item');
      const attendanceId = attendanceItem.dataset.attendanceId;
      editAttendance(attendanceId);
    });
  });

  document.querySelectorAll('.delete-attendance').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const attendanceItem = e.target.closest('.attendance-item');
      const attendanceId = attendanceItem.dataset.attendanceId;
      deleteAttendance(attendanceId);
    });
  });
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
        const submitBtn = attendanceForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Record Attendance';
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

async function editAttendance(attendanceId) {
  try {
    // Try to get from local storage first
    const localKey = `worklog_attendance_${attendanceId}`;
    const localItem = localStorage.getItem(localKey);
    
    if (localItem) {
      const attendance = JSON.parse(localItem);
      
      // Fill form with attendance data
      const studentSelect = document.getElementById('attendanceStudent');
      const dateInput = document.getElementById('attendanceDate');
      const statusInput = document.getElementById('attendanceStatus');
      const durationInput = document.getElementById('attendanceDuration');
      const notesInput = document.getElementById('attendanceNotes');
      
      if (studentSelect) studentSelect.value = attendance.studentId || '';
      if (dateInput) dateInput.value = formatDateForInput(attendance.date);
      if (statusInput) statusInput.value = attendance.status || 'present';
      if (durationInput) durationInput.value = attendance.duration || '';
      if (notesInput) notesInput.value = attendance.notes || '';
      
      // Change form to edit mode
      currentEditAttendanceId = attendanceId;
      const submitBtn = document.getElementById('attendanceForm')?.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Attendance';
      
      // Scroll to form
      const attendanceForm = document.getElementById('attendanceForm');
      if (attendanceForm) attendanceForm.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    // Fallback to Firestore
    const user = auth.currentUser;
    if (!user) return;

    const attendanceDoc = await getDoc(doc(db, "users", user.uid, "attendance", attendanceId));
    if (attendanceDoc.exists()) {
      const attendance = attendanceDoc.data();
      
      // Fill form with attendance data
      const studentSelect = document.getElementById('attendanceStudent');
      const dateInput = document.getElementById('attendanceDate');
      const statusInput = document.getElementById('attendanceStatus');
      const durationInput = document.getElementById('attendanceDuration');
      const notesInput = document.getElementById('attendanceNotes');
      
      if (studentSelect) studentSelect.value = attendance.studentId || '';
      if (dateInput) dateInput.value = formatDateForInput(attendance.date);
      if (statusInput) statusInput.value = attendance.status || 'present';
      if (durationInput) durationInput.value = attendance.duration || '';
      if (notesInput) notesInput.value = attendance.notes || '';
      
      // Change form to edit mode
      currentEditAttendanceId = attendanceId;
      const submitBtn = document.getElementById('attendanceForm')?.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Attendance';
      
      // Scroll to form
      const attendanceForm = document.getElementById('attendanceForm');
      if (attendanceForm) attendanceForm.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error loading attendance for edit:', error);
    showNotification('Failed to load attendance data', 'error');
  }
}

async function deleteAttendance(attendanceId) {
  if (!confirm('Are you sure you want to delete this attendance record?')) {
    return;
  }

  try {
    await enhancedDeleteOperation('attendance', attendanceId, 'Attendance record deleted successfully');
    await renderAttendanceRecent();
  } catch (error) {
    console.error('Error deleting attendance:', error);
    showNotification('Failed to delete attendance record', 'error');
  }
}

// ===========================
// PAYMENTS TRACKING WITH 3-LAYER SYSTEM
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

function setupPaymentsEventListeners() {
  document.querySelectorAll('.edit-payment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const paymentItem = e.target.closest('.payment-item');
      const paymentId = paymentItem.dataset.paymentId;
      editPayment(paymentId);
    });
  });

  document.querySelectorAll('.delete-payment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const paymentItem = e.target.closest('.payment-item');
      const paymentId = paymentItem.dataset.paymentId;
      deletePayment(paymentId);
    });
  });
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
        const submitBtn = paymentsForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Record Payment';
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

async function editPayment(paymentId) {
  try {
    // Try to get from local storage first
    const localKey = `worklog_payments_${paymentId}`;
    const localItem = localStorage.getItem(localKey);
    
    if (localItem) {
      const payment = JSON.parse(localItem);
      
      // Fill form with payment data
      const studentSelect = document.getElementById('paymentStudent');
      const dateInput = document.getElementById('paymentDate');
      const amountInput = document.getElementById('paymentAmount');
      const statusInput = document.getElementById('paymentStatus');
      const methodInput = document.getElementById('paymentMethod');
      const notesInput = document.getElementById('paymentNotes');
      
      if (studentSelect) studentSelect.value = payment.studentId || '';
      if (dateInput) dateInput.value = formatDateForInput(payment.date);
      if (amountInput) amountInput.value = payment.amount || '';
      if (statusInput) statusInput.value = payment.status || 'pending';
      if (methodInput) methodInput.value = payment.method || '';
      if (notesInput) notesInput.value = payment.notes || '';
      
      // Change form to edit mode
      currentEditPaymentId = paymentId;
      const submitBtn = document.getElementById('paymentsForm')?.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Payment';
      
      // Scroll to form
      const paymentsForm = document.getElementById('paymentsForm');
      if (paymentsForm) paymentsForm.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    // Fallback to Firestore
    const user = auth.currentUser;
    if (!user) return;

    const paymentDoc = await getDoc(doc(db, "users", user.uid, "payments", paymentId));
    if (paymentDoc.exists()) {
      const payment = paymentDoc.data();
      
      // Fill form with payment data
      const studentSelect = document.getElementById('paymentStudent');
      const dateInput = document.getElementById('paymentDate');
      const amountInput = document.getElementById('paymentAmount');
      const statusInput = document.getElementById('paymentStatus');
      const methodInput = document.getElementById('paymentMethod');
      const notesInput = document.getElementById('paymentNotes');
      
      if (studentSelect) studentSelect.value = payment.studentId || '';
      if (dateInput) dateInput.value = formatDateForInput(payment.date);
      if (amountInput) amountInput.value = payment.amount || '';
      if (statusInput) statusInput.value = payment.status || 'pending';
      if (methodInput) methodInput.value = payment.method || '';
      if (notesInput) notesInput.value = payment.notes || '';
      
      // Change form to edit mode
      currentEditPaymentId = paymentId;
      const submitBtn = document.getElementById('paymentsForm')?.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Update Payment';
      
      // Scroll to form
      const paymentsForm = document.getElementById('paymentsForm');
      if (paymentsForm) paymentsForm.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error loading payment for edit:', error);
    showNotification('Failed to load payment data', 'error');
  }
}

async function deletePayment(paymentId) {
  if (!confirm('Are you sure you want to delete this payment record?')) {
    return;
  }

  try {
    await enhancedDeleteOperation('payments', paymentId, 'Payment record deleted successfully');
    await renderPaymentActivity();
  } catch (error) {
    console.error('Error deleting payment:', error);
    showNotification('Failed to delete payment record', 'error');
  }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

function populateStudentDropdown(dropdownId, students) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  // Clear existing options except the first one
  while (dropdown.options.length > 1) {
    dropdown.remove(1);
  }

  // Add student options
  students.forEach(student => {
    const option = document.createElement('option');
    option.value = student.id;
    option.textContent = student.name || 'Unnamed Student';
    dropdown.appendChild(option);
  });
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
// SYNC MANAGEMENT
// ===========================

function setupSyncManagement() {
  // Manual sync button
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      await manualSync();
    });
  }

  // Auto-sync toggle
  if (autoSyncCheckbox) {
    autoSyncCheckbox.addEventListener('change', (e) => {
      toggleAutoSync(e.target.checked);
    });

    // Load saved preference
    const savedAutoSync = localStorage.getItem('autoSyncEnabled') === 'true';
    autoSyncCheckbox.checked = savedAutoSync;
    toggleAutoSync(savedAutoSync);
  }

  // Export/Import buttons
  if (exportCloudBtn) {
    exportCloudBtn.addEventListener('click', exportAllData);
  }

  if (importCloudBtn) {
    importCloudBtn.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        importAllData(e.target.files[0]);
        e.target.value = ''; // Reset file input
      }
    });
  }

  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', exportAllData);
  }

  if (importDataBtn) {
    importDataBtn.addEventListener('click', () => {
      importCloudBtn?.click();
    });
  }

  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', async () => {
      if (confirm('⚠️ This will permanently delete ALL your data (local and cloud). Continue?')) {
        const user = auth.currentUser;
        if (user) {
          try {
            await clearAllUserData(user.uid);
            showNotification('All data cleared successfully', 'success');
            await renderStudents();
            await renderRecentHours();
            await renderRecentMarks();
            await renderAttendanceRecent();
            await renderPaymentActivity();
          } catch (error) {
            showNotification('Failed to clear data', 'error');
          }
        }
      }
    });
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

    if (autoSyncText) autoSyncText.textContent = 'Auto-sync: ON';
    showNotification('Auto-sync enabled', 'info');
  } else {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval);
      autoSyncInterval = null;
    }
    if (autoSyncText) autoSyncText.textContent = 'Auto-sync: OFF';
    showNotification('Auto-sync disabled', 'info');
  }

  updateHeaderStats();
}

async function exportAllData() {
  const user = auth.currentUser;
  if (!user) {
    showNotification('Please sign in to export data', 'error');
    return;
  }

  try {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    const exportData = {};

    for (const collectionName of collections) {
      const localItems = StorageSystem.getFromLocal(collectionName);
      
      try {
        const snap = await getDocs(collection(db, "users", user.uid, collectionName));
        const cloudItems = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Merge local and cloud data (cloud takes precedence)
        const allItems = [...localItems];
        const cloudIds = new Set(cloudItems.map(item => item.id));
        
        cloudItems.forEach(cloudItem => {
          const existingIndex = allItems.findIndex(item => item.id === cloudItem.id);
          if (existingIndex >= 0) {
            allItems[existingIndex] = cloudItem;
          } else {
            allItems.push(cloudItem);
          }
        });

        exportData[collectionName] = allItems;
      } catch (error) {
        console.warn(`⚠️ Could not export ${collectionName} from cloud:`, error);
        exportData[collectionName] = localItems;
      }
    }

    // Add metadata
    exportData.metadata = {
      exportedAt: new Date().toISOString(),
      userId: user.uid,
      version: '1.0'
    };

    // Download as JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    showNotification('Data exported successfully', 'success');
  } catch (error) {
    console.error('Export failed:', error);
    showNotification('Export failed', 'error');
  }
}

async function importAllData(file) {
  const user = auth.currentUser;
  if (!user) {
    showNotification('Please sign in to import data', 'error');
    return;
  }

  if (!confirm('This will replace all your current data. Continue?')) {
    return;
  }

  try {
    const text = await file.text();
    const importData = JSON.parse(text);

    // Validate import data
    if (!importData.metadata || !importData.metadata.version) {
      throw new Error('Invalid backup file format');
    }

    setSyncStatus('syncing', 'Importing data...');

    // Clear existing data first
    await clearAllUserData(user.uid);

    // Import each collection
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    let totalImported = 0;

    for (const collectionName of collections) {
      if (importData[collectionName]) {
        for (const item of importData[collectionName]) {
          try {
            await enhancedCreateOperation(collectionName, item, `Imported ${collectionName}`);
            totalImported++;
          } catch (error) {
            console.error(`❌ Failed to import ${collectionName} item:`, error);
          }
        }
      }
    }

    // Clear cache and refresh
    clearAllCache();
    await Promise.all([
      renderStudents(),
      renderRecentHours(),
      renderRecentMarks(),
      renderAttendanceRecent(),
      renderPaymentActivity()
    ]);

    setSyncStatus('success', `Imported ${totalImported} items`);
    showNotification(`Successfully imported ${totalImported} items`, 'success');
  } catch (error) {
    console.error('Import failed:', error);
    setSyncStatus('error', 'Import failed');
    showNotification('Import failed - invalid file format', 'error');
  }
}

async function clearAllUserData(uid) {
  try {
    // Clear local storage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('worklog_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear cloud data
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    const batch = writeBatch(db);

    for (const collectionName of collections) {
      const snap = await getDocs(collection(db, "users", uid, collectionName));
      snap.docs.forEach(docSnap => {
        batch.delete(doc(db, "users", uid, collectionName, docSnap.id));
      });
    }

    await batch.commit();
    clearAllCache();

    console.log('✅ All user data cleared');
  } catch (error) {
    console.error('❌ Error clearing user data:', error);
    throw error;
  }
}

// ===========================
// TAB NAVIGATION - DEBUGGING VERSION
// ===========================

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
// MAIN INITIALIZATION
// ===========================

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
    return;
  }

  // Load data for the active tab
  loadTabData(tabName);
  
  // Setup forms for the active tab
  setupTabForms(tabName);
}

// ===========================
// MAIN APP INITIALIZATION
// ===========================

// Flag to prevent duplicate initialization
let appInitialized = false;

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
    updateHeaderStats();

    // Setup tab navigation - this is critical
    const tabsSetup = setupTabNavigation();
    if (!tabsSetup) {
      console.error('❌ Tab navigation setup failed');
      showNotification('Navigation setup failed', 'error');
      return;
    }

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
// EVENT LISTENERS - SINGLE INITIALIZATION
// ===========================

// Only set up one event listener to prevent duplicates
let domContentLoadedFired = false;

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

// Also handle window load as a fallback
window.addEventListener('load', function() {
  console.log('🔄 Window loaded - checking if app initialized');
  if (!appInitialized) {
    console.log('🔄 App not initialized from DOMContentLoaded, initializing now...');
    setTimeout(() => {
      initializeApp().catch(console.error);
    }, 200);
  }
});

// ===========================
// EMERGENCY FALLBACKS
// ===========================

// Emergency tab creation if none exist
function createEmergencyTabs() {
  console.log('🚨 Creating emergency tabs...');
  
  const mainContainer = document.querySelector('main') || document.body;
  const existingTabs = document.querySelector('.tabs');
  
  if (existingTabs) {
    console.log('✅ Tabs already exist, no need for emergency creation');
    return true;
  }

  // Create emergency tab structure
  const tabBar = document.createElement('div');
  tabBar.className = 'tabs';
  tabBar.style.cssText = `
    display: flex;
    gap: 10px;
    padding: 10px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    margin-bottom: 20px;
  `;
  
  tabBar.innerHTML = `
    <button data-tab="students" class="tab-button" style="padding: 10px 20px; border: 1px solid #ccc; background: white; border-radius: 5px; cursor: pointer;">Students</button>
    <button data-tab="hours" class="tab-button" style="padding: 10px 20px; border: 1px solid #ccc; background: white; border-radius: 5px; cursor: pointer;">Hours</button>
    <button data-tab="marks" class="tab-button" style="padding: 10px 20px; border: 1px solid #ccc; background: white; border-radius: 5px; cursor: pointer;">Marks</button>
    <button data-tab="attendance" class="tab-button" style="padding: 10px 20px; border: 1px solid #ccc; background: white; border-radius: 5px; cursor: pointer;">Attendance</button>
    <button data-tab="payments" class="tab-button" style="padding: 10px 20px; border: 1px solid #ccc; background: white; border-radius: 5px; cursor: pointer;">Payments</button>
  `;
  
  mainContainer.insertBefore(tabBar, mainContainer.firstChild);
  console.log('✅ Emergency tabs created');
  
  // Create emergency tab contents if they don't exist
  const tabs = ['students', 'hours', 'marks', 'attendance', 'payments'];
  tabs.forEach(tabName => {
    if (!document.getElementById(tabName)) {
      const tabContent = document.createElement('div');
      tabContent.id = tabName;
      tabContent.className = 'tab-content';
      tabContent.style.cssText = 'display: none; padding: 20px;';
      tabContent.innerHTML = `<h3>${tabName.charAt(0).toUpperCase() + tabName.slice(1)}</h3><p>Content for ${tabName} will appear here.</p>`;
      mainContainer.appendChild(tabContent);
    }
  });
  
  return true;
}

// Auto-fix if tabs don't exist after 3 seconds
setTimeout(() => {
  if (!appInitialized) {
    console.log('⏰ Auto-fix: Checking if tabs exist...');
    const hasTabs = document.querySelectorAll('[data-tab]').length > 0;
    if (!hasTabs) {
      console.log('🚨 No tabs found, running emergency setup...');
      createEmergencyTabs();
      // Retry initialization
      if (!appInitialized) {
        initializeApp().catch(console.error);
      }
    }
  }
}, 3000);

// ===========================
// EVENT LISTENERS - SINGLE INITIALIZATION
// ===========================

// Only set up one event listener to prevent duplicates
let domContentLoadedFired = false;

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

// Also handle window load as a fallback
window.addEventListener('load', function() {
  console.log('🔄 Window loaded - checking if app initialized');
  if (!appInitialized) {
    console.log('🔄 App not initialized from DOMContentLoaded, initializing now...');
    setTimeout(() => {
      initializeApp().catch(console.error);
    }, 200);
  }
});

// ===========================
// EMERGENCY FALLBACKS
// ===========================

// Emergency tab creation if none exist
function createEmergencyTabs() {
  console.log('🚨 Creating emergency tabs...');
  
  const mainContainer = document.querySelector('main') || document.body;
  const existingTabs = document.querySelector('.tabs');
  
  if (existingTabs) {
    console.log('✅ Tabs already exist, no need for emergency creation');
    return true;
  }

  // Create emergency tab structure
  const tabBar = document.createElement('div');
  tabBar.className = 'tabs';
  tabBar.style.cssText = `
    display: flex;
    gap: 10px;
    padding: 10px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    margin-bottom: 20px;
  `;
  
  tabBar.innerHTML = `
    <button data-tab="students" class="tab-button" style="padding: 10px 20px; border: 1px solid #ccc; background: white; border-radius: 5px; cursor: pointer;">Students</button>
    <button data-tab="hours" class="tab-button" style="padding: 10px 20px; border: 1px solid #ccc; background: white; border-radius: 5px; cursor: pointer;">Hours</button>
    <button data-tab="marks" class="tab-button" style="padding: 10px 20px; border: 1px solid #ccc; background: white; border-radius: 5px; cursor: pointer;">Marks</button>
    <button data-tab="attendance" class="tab-button" style="padding: 10px 20px; border: 1px solid #ccc; background: white; border-radius: 5px; cursor: pointer;">Attendance</button>
    <button data-tab="payments" class="tab-button" style="padding: 10px 20px; border: 1px solid #ccc; background: white; border-radius: 5px; cursor: pointer;">Payments</button>
  `;
  
  mainContainer.insertBefore(tabBar, mainContainer.firstChild);
  console.log('✅ Emergency tabs created');
  
  // Create emergency tab contents if they don't exist
  const tabs = ['students', 'hours', 'marks', 'attendance', 'payments'];
  tabs.forEach(tabName => {
    if (!document.getElementById(tabName)) {
      const tabContent = document.createElement('div');
      tabContent.id = tabName;
      tabContent.className = 'tab-content';
      tabContent.style.cssText = 'display: none; padding: 20px;';
      tabContent.innerHTML = `<h3>${tabName.charAt(0).toUpperCase() + tabName.slice(1)}</h3><p>Content for ${tabName} will appear here.</p>`;
      mainContainer.appendChild(tabContent);
    }
  });
  
  return true;
}

// Auto-fix if tabs don't exist after 3 seconds
setTimeout(() => {
  if (!appInitialized) {
    console.log('⏰ Auto-fix: Checking if tabs exist...');
    const hasTabs = document.querySelectorAll('[data-tab]').length > 0;
    if (!hasTabs) {
      console.log('🚨 No tabs found, running emergency setup...');
      createEmergencyTabs();
      // Retry initialization
      if (!appInitialized) {
        initializeApp().catch(console.error);
      }
    }
  }
}, 3000);

// ===========================
// START THE APPLICATION
// ===========================

document.addEventListener('DOMContentLoaded', initializeApp);

// Export for use in other modules
window.StorageSystem = StorageSystem;
window.enhancedCreateOperation = enhancedCreateOperation;
window.enhancedUpdateOperation = enhancedUpdateOperation;
window.enhancedDeleteOperation = enhancedDeleteOperation;
