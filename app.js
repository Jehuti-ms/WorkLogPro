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
    NotificationSystem.notifySuccess(successMessage);

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
    NotificationSystem.notifyError(`Failed to save ${collectionName}`);
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
    NotificationSystem.notifySuccess(successMessage);

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
    NotificationSystem.notifyError(`Failed to update ${collectionName}`);
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
    NotificationSystem.notifySuccess(successMessage);

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
    NotificationSystem.notifyError(`Failed to delete ${collectionName}`);
    throw error;
  }
}

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
      NotificationSystem.notifySuccess(`Default rate applied to ${updateCount} students`);
      setTimeout(() => renderStudents(), 100);
    } else {
      NotificationSystem.notifyInfo("No students found to update");
    }
    
    return updateCount;
  } catch (err) {
    console.error("❌ Error applying rate to all students:", err);
    NotificationSystem.notifyError("Failed to apply rate to all students");
    return 0;
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
          NotificationSystem.notifyError('Logout failed');
        }
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

document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    setupThemeToggle();
});

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
// FIRESTORE DATA FUNCTIONS
// ===========================

async function loadUserStats(uid) {
  console.log('📊 Loading user stats for:', uid);
  try {
    const statsRef = doc(db, "users", uid);
    const statsSnap = await getDoc(statsRef);

    console.log('📊 Stats snapshot exists:', statsSnap.exists());
    
    if (statsSnap.exists()) {
      const stats = statsSnap.data();
      console.log('📊 Stats data loaded:', stats);
      
      if (document.getElementById('statStudents')) {
        document.getElementById('statStudents').textContent = stats.students ?? 0;
      }
      if (document.getElementById('statHours')) {
        document.getElementById('statHours').textContent = stats.hours ?? 0;
      }
      if (document.getElementById('statEarnings')) {
        const earnings = stats.earnings != null ? fmtMoney(stats.earnings) : "0.00";
        document.getElementById('statEarnings').textContent = earnings;
      }
    } else {
      console.log('📊 No stats found, creating default stats...');
      await setDoc(statsRef, { 
        students: 0, 
        hours: 0, 
        earnings: 0,
        lastSync: new Date().toLocaleString()
      });
      
      if (document.getElementById('statStudents')) document.getElementById('statStudents').textContent = 0;
      if (document.getElementById('statHours')) document.getElementById('statHours').textContent = 0;
      if (document.getElementById('statEarnings')) document.getElementById('statEarnings').textContent = "0.00";
    }

    refreshTimestamp();
    console.log('✅ User stats loaded successfully');
    
  } catch (err) {
    console.error("❌ Error loading stats:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Offline – stats unavailable";
  }
}

async function updateUserStats(uid, newStats) {
  try {
    const statsRef = doc(db, "users", uid);
    await setDoc(statsRef, newStats, { merge: true });
    console.log("✅ Stats updated:", newStats);

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
    if (newStats.lastSync !== undefined) {
      const statUpdated = document.getElementById('statUpdated');
      if (statUpdated) statUpdated.textContent = newStats.lastSync;
    }

    updateHeaderStats();
    refreshTimestamp();
  } catch (err) {
    console.error("❌ Error updating stats:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Offline - stats update failed";
    
    // Fallback to local storage for stats
    const localStats = JSON.parse(localStorage.getItem('userStats') || '{}');
    const updatedStats = { ...localStats, ...newStats };
    localStorage.setItem('userStats', JSON.stringify(updatedStats));
  }
}

// ===========================
// NOTIFICATION SYSTEM
// ===========================

const NotificationSystem = {
  notifySuccess(message) {
    this.showNotification(message, 'success');
  },

  notifyError(message) {
    this.showNotification(message, 'error');
  },

  notifyInfo(message) {
    this.showNotification(message, 'info');
  },

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    // Add to container
    const container = document.getElementById('notificationContainer') || this.createContainer();
    container.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('notification-fadeout');
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);

    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.classList.add('notification-fadeout');
      setTimeout(() => notification.remove(), 300);
    });
  },

  createContainer() {
    const container = document.createElement('div');
    container.id = 'notificationContainer';
    container.className = 'notification-container';
    document.body.appendChild(container);
    return container;
  }
};

// ===========================
// SYNC MANAGEMENT SYSTEM
// ===========================

const SyncManager = {
  async manualSync() {
    if (!auth.currentUser) {
      NotificationSystem.notifyError('Please sign in to sync');
      return;
    }

    this.setSyncStatus('syncing', 'Syncing data...');
    
    try {
      // Process all pending sync items
      await StorageSystem.processPendingSync();
      
      // Clear all caches to force refresh
      clearAllCache();
      
      // Refresh all views
      await this.refreshAllData();
      
      this.setSyncStatus('success', 'Sync completed successfully');
      NotificationSystem.notifySuccess('Data synced successfully');
      
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      this.setSyncStatus('error', 'Sync failed - check connection');
      NotificationSystem.notifyError('Sync failed - some data may be offline');
    }
  },

  setSyncStatus(status, message = '') {
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
  },

  async refreshAllData() {
    const refreshTasks = [
      renderStudents(),
      renderRecentHours(),
      renderRecentMarks(),
      renderAttendanceRecent(),
      renderPaymentActivity()
    ];

    await Promise.allSettled(refreshTasks);
    console.log('✅ All data refreshed after sync');
  },

  setupAutoSync() {
    autoSyncCheckbox.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      this.toggleAutoSync(enabled);
    });

    // Load saved auto-sync preference
    const savedAutoSync = localStorage.getItem('autoSyncEnabled') === 'true';
    autoSyncCheckbox.checked = savedAutoSync;
    this.toggleAutoSync(savedAutoSync);
  },

  toggleAutoSync(enabled) {
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

      autoSyncText.textContent = 'Auto-sync: ON';
      NotificationSystem.notifyInfo('Auto-sync enabled');
    } else {
      if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
        autoSyncInterval = null;
      }
      autoSyncText.textContent = 'Auto-sync: OFF';
      NotificationSystem.notifyInfo('Auto-sync disabled');
    }

    updateHeaderStats();
  }
};

// ===========================
// DATA MANAGEMENT FUNCTIONS
// ===========================

async function exportAllData() {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please sign in to export data');
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

    NotificationSystem.notifySuccess('Data exported successfully');
  } catch (error) {
    console.error('❌ Export failed:', error);
    NotificationSystem.notifyError('Export failed');
  }
}

async function importAllData(file) {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please sign in to import data');
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

    SyncManager.setSyncStatus('syncing', 'Importing data...');

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
    await SyncManager.refreshAllData();

    SyncManager.setSyncStatus('success', `Imported ${totalImported} items`);
    NotificationSystem.notifySuccess(`Successfully imported ${totalImported} items`);
  } catch (error) {
    console.error('❌ Import failed:', error);
    SyncManager.setSyncStatus('error', 'Import failed');
    NotificationSystem.notifyError('Import failed - invalid file format');
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
// INITIALIZATION FUNCTIONS
// ===========================

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
          NotificationSystem.notifySuccess(`Default rate updated to $${fmtMoney(newRate)}/hour`);
        }
      }
    });
  }
}

function setupEventListeners() {
  console.log('🔧 Setting up event listeners...');

  // Sync buttons
  if (syncBtn) {
    syncBtn.addEventListener('click', () => SyncManager.manualSync());
  }

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
            clearAllCache();
            await SyncManager.refreshAllData();
            NotificationSystem.notifySuccess('All data cleared successfully');
          } catch (error) {
            NotificationSystem.notifyError('Failed to clear data');
          }
        }
      }
    });
  }

  // Online/offline detection
  window.addEventListener('online', () => {
    NotificationSystem.notifyInfo('Connection restored - syncing data...');
    SyncManager.setSyncStatus('success', 'Online - sync available');
    StorageSystem.processPendingSync();
  });

  window.addEventListener('offline', () => {
    NotificationSystem.notifyInfo('Working offline - changes saved locally');
    SyncManager.setSyncStatus('offline', 'Offline - local storage only');
  });

  console.log('✅ Event listeners setup completed');
}

// ===========================
// MAIN INITIALIZATION
// ===========================

async function initializeApp() {
  console.log('🚀 Initializing WorkLog App...');

  try {
    // Wait for auth state
    const user = await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });

    if (!user) {
      console.log('❌ No user signed in, redirecting to auth...');
      window.location.href = "auth.html";
      return;
    }

    console.log('✅ User authenticated:', user.uid);

    // Initialize systems in sequence
    initializeTheme();
    setupThemeToggle();
    setupProfileModal();
    setupFloatingAddButton();
    setupEventListeners();
    SyncManager.setupAutoSync();
    
    // Load user data
    await loadUserProfile(user.uid);
    await loadUserStats(user.uid);
    updateHeaderStats();

    // Load initial data with 3-layer system
    await renderWithLocalAndCloud('studentsList', 'students', renderStudentsList, 'No students added yet');
    await renderWithLocalAndCloud('recentHoursList', 'hours', renderHoursList, 'No hours logged yet', 10);
    await renderWithLocalAndCloud('recentMarksList', 'marks', renderMarksList, 'No marks recorded yet', 10);
    await renderWithLocalAndCloud('attendanceRecentList', 'attendance', renderAttendanceList, 'No attendance records yet', 10);
    await renderWithLocalAndCloud('paymentActivityList', 'payments', renderPaymentsList, 'No payments recorded yet', 10);

    // Process any pending sync items
    setTimeout(() => StorageSystem.processPendingSync(), 2000);

    console.log('✅ WorkLog App initialized successfully');
    NotificationSystem.notifySuccess('App loaded successfully');

  } catch (error) {
    console.error('❌ App initialization failed:', error);
    NotificationSystem.notifyError('App initialization failed');
  }
}

// ===========================
// START THE APPLICATION
// ===========================

document.addEventListener('DOMContentLoaded', initializeApp);

// Export for use in other modules
window.StorageSystem = StorageSystem;
window.SyncManager = SyncManager;
window.NotificationSystem = NotificationSystem;
window.enhancedCreateOperation = enhancedCreateOperation;
window.enhancedUpdateOperation = enhancedUpdateOperation;
window.enhancedDeleteOperation = enhancedDeleteOperation;
