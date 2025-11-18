// ===========================
// CACHE SYSTEM FOR PERFORMANCE
// ===========================

const cache = {
  students: null,
  hours: null,
  marks: null,
  attendance: null,
  payments: null,
  lastSync: null
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function isCacheValid(key) {
  if (!cache[key] || !cache.lastSync) return false;
  return (Date.now() - cache.lastSync) < CACHE_DURATION;
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
let currentEditHoursId = null; // Track hours being edited

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
// TIMEZONE UTILITY FUNCTIONS - FIXED VERSION
// ===========================

// REPLACE your existing getLocalISODate function with this:
function getLocalISODate() {
  const now = new Date();
  // Get local date in YYYY-MM-DD format
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// REPLACE your existing formatDateForInput function with this:
function formatDateForInput(dateString) {
  if (!dateString) return new Date().toISOString().split('T')[0];
  
  try {
    let date;
    if (dateString.includes('T')) {
      // ISO date with timezone - parse as UTC and convert to local
      date = new Date(dateString);
    } else {
      // Local date string (YYYY-MM-DD) - treat as local date
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }
    
    if (isNaN(date.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    
    // Convert to local date string for input[type="date"]
    const localYear = date.getFullYear();
    const localMonth = String(date.getMonth() + 1).padStart(2, '0');
    const localDay = String(date.getDate()).padStart(2, '0');
    return `${localYear}-${localMonth}-${localDay}`;
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

// REPLACE your existing fmtDateISO function with this:
function fmtDateISO(yyyyMmDd) {
  if (!yyyyMmDd) return new Date().toISOString();
  try {
    // Parse the local date string and create a date at noon local time
    // This avoids timezone issues when converting to ISO string
    const [year, month, day] = yyyyMmDd.split('-').map(Number);
    const localDate = new Date(year, month - 1, day, 12, 0, 0); // Noon local time
    
    // Convert to ISO string - this will include timezone offset
    const isoString = localDate.toISOString();
    
    console.log('🔧 Date conversion:', {
      input: yyyyMmDd,
      localDate: localDate.toString(),
      isoString: isoString,
      timezoneOffset: localDate.getTimezoneOffset()
    });
    
    return isoString;
  } catch (error) {
    console.error('❌ Date conversion error:', error);
    return new Date().toISOString();
  }
}

// REPLACE your existing convertToLocalDate function with this:
function convertToLocalDate(dateString) {
  if (!dateString) return new Date();
  
  try {
    let date;
    if (dateString.includes('T')) {
      // ISO date - parse as is
      date = new Date(dateString);
    } else {
      // Local date string - create as local date
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }
    
    return date;
  } catch {
    return new Date();
  }
}

// REPLACE your existing formatDate function with this:
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

// ADD this new debug function:
function debugTimezone(dateString) {
  console.log('🕐 Timezone Debug:', {
    input: dateString,
    isISO: dateString?.includes('T'),
    localFormat: formatDateForInput(dateString),
    formatted: formatDate(dateString),
    isoConversion: fmtDateISO(dateString?.split('T')[0] || dateString),
    currentTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    currentOffset: new Date().getTimezoneOffset()
  });
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
// USER PROFILE & AUTHENTICATION
// ===========================

async function loadUserProfile(uid) {
  console.log('👤 Loading user profile for:', uid);
  
  // Set immediate fallback profile for instant UI update
  const user = auth.currentUser;
  const fallbackProfile = {
    email: user?.email || '',
    createdAt: new Date().toISOString(),
    defaultRate: parseFloat(localStorage.getItem('userDefaultRate')) || 0
  };
  
  // Update UI IMMEDIATELY with basic info
  updateProfileButton(fallbackProfile);
  initializeDefaultRate(fallbackProfile.defaultRate);
  
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      currentUserData = { uid, ...userSnap.data() };
      console.log('✅ User profile loaded from Firestore');
      
      // Update with full profile data
      updateProfileButton(currentUserData);
      
      if (currentUserData.defaultRate !== undefined) {
        initializeDefaultRate(currentUserData.defaultRate);
        localStorage.setItem('userDefaultRate', currentUserData.defaultRate.toString());
      }
      
      return currentUserData;
    } else {
      // Create profile in background
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
    
    // Update both button and span immediately
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
      NotificationSystem.notifySuccess(`Default rate applied to ${updateCount} students`);
      await renderStudents(); // Refresh the display
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

  // Check if modal elements exist
  if (!profileModal) {
    console.error('❌ Profile modal not found in DOM');
    return;
  }

  // Open modal
  if (profileBtn && profileModal) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('👤 Profile button clicked');
      
      // Update modal content with latest data
      updateProfileModal();
      
      profileModal.style.display = 'flex';
      document.body.classList.add('modal-open');
    });
  } else {
    console.error('❌ Profile button or modal not found');
  }

  // Close modal with X button
  if (closeProfileModal) {
    closeProfileModal.addEventListener('click', () => {
      closeModal();
    });
  }

  // Logout functionality
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

  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (profileModal && event.target === profileModal) {
      closeModal();
    }
  });

  // Close modal with Escape key
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

  // Update user info
  if (currentUserData) {
    const email = currentUserData.email || auth.currentUser?.email || 'Not available';
    if (profileUserEmail) profileUserEmail.textContent = email;
    
    const createdAt = currentUserData.createdAt || currentUserData.lastLogin || new Date().toISOString();
    if (profileUserSince) profileUserSince.textContent = formatDate(createdAt);
    
    if (profileDefaultRate) {
      profileDefaultRate.textContent = `$${fmtMoney(currentUserData.defaultRate || 0)}/hour`;
    }
  }

  // Get fresh stats from DOM or calculate
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
// FLOATING ADD BUTTON - FIXED VERSION
// ===========================

function setupFloatingAddButton() {
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');

  console.log('🔧 Setting up FAB...');
  console.log('FAB elements:', { fab, fabMenu, fabOverlay });

  if (!fab) {
    console.error('❌ FAB button not found!');
    return;
  }

  // Debug: Check if FAB is inside any tab content
  const allTabContents = document.querySelectorAll('.tabcontent');
  let isInsideTab = false;
  allTabContents.forEach(tab => {
    if (tab.contains(fab)) {
      isInsideTab = true;
      console.error('❌ FAB is INSIDE tab content:', tab.id);
    }
  });
  
  if (!isInsideTab) {
    console.log('✅ FAB is properly outside all tab content');
  }

  let isExpanded = false;

  function openFabMenu() {
    console.log('🟢 Opening FAB menu');
    isExpanded = true;
    
    // Update FAB button
    fab.innerHTML = '✕';
    fab.style.transform = 'rotate(45deg)';
    
    // Show menu
    if (fabMenu) {
      fabMenu.classList.add('show');
    }
    
    // Show overlay
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
    
    // Update FAB button
    fab.innerHTML = '+';
    fab.style.transform = 'rotate(0deg)';
    
    // Hide menu
    if (fabMenu) {
      fabMenu.classList.remove('show');
    }
    
    // Hide overlay
    if (fabOverlay) {
      fabOverlay.style.display = 'none';
      fabOverlay.style.pointerEvents = 'none';
    }
    
    console.log('✅ FAB menu closed');
  }

  // Click handler for main FAB button
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

  // Close menu when clicking on overlay
  if (fabOverlay) {
    fabOverlay.addEventListener('click', (e) => {
      console.log('🎯 Overlay clicked');
      e.stopPropagation();
      e.preventDefault();
      closeFabMenu();
    });
  }

  // Close menu when clicking anywhere outside
  document.addEventListener('click', (e) => {
    if (isExpanded) {
      // Check if click is outside FAB and menu
      const isClickOnFab = fab.contains(e.target);
      const isClickOnMenu = fabMenu && fabMenu.contains(e.target);
      const isClickOnFabItem = e.target.closest('.fab-item');
      
      if (!isClickOnFab && !isClickOnMenu && !isClickOnFabItem) {
        console.log('🎯 Click outside FAB, closing menu');
        closeFabMenu();
      }
    }
  });

  // Close with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isExpanded) {
      console.log('🎯 Escape key pressed, closing FAB');
      closeFabMenu();
    }
  });

  // Setup quick action buttons
  setupFabActions(closeFabMenu);
  
  console.log('✅ FAB setup completed');
}

// Enhanced FAB actions to open forms directly
function setupFabActions(closeFabMenu) {
  const quickActions = {
    'fabAddStudent': () => {
      console.log('🎯 FAB: Add Student clicked');
      const studentTab = document.querySelector('[data-tab="students"]');
      if (studentTab) {
        studentTab.click();
        // Scroll to student form after tab animation
        setTimeout(() => {
          const studentForm = document.getElementById('studentForm');
          if (studentForm) {
            studentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Focus on first input
            const firstInput = studentForm.querySelector('input');
            if (firstInput) firstInput.focus();
          }
        }, 300);
      }
    },
    'fabAddHours': () => {
      console.log('🎯 FAB: Add Hours clicked');
      const hoursTab = document.querySelector('[data-tab="hours"]');
      if (hoursTab) {
        hoursTab.click();
        // Scroll to hours form after tab animation
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
      console.log('🎯 FAB: Add Mark clicked');
      const marksTab = document.querySelector('[data-tab="marks"]');
      if (marksTab) {
        marksTab.click();
        // Scroll to marks form after tab animation
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
      console.log('🎯 FAB: Add Attendance clicked');
      const attendanceTab = document.querySelector('[data-tab="attendance"]');
      if (attendanceTab) {
        attendanceTab.click();
        // Scroll to attendance form after tab animation
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

  // Attach event listeners to quick action buttons
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
// THEME MANAGEMENT - SIMPLE VERSION
// ===========================

function updateThemeIcon(theme) {
    const themeButton = document.querySelector('.theme-toggle button');
    if (!themeButton) return;
    
    // Keep the same "🌓" icon but update the tooltip
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    setupThemeToggle();
});

// ===========================
// HEADER STATS
// ===========================

// Enhanced debug version of updateHeaderStats
function updateHeaderStats() {
  console.log('🔍 [updateHeaderStats] Starting...');
  
  const localStatus = document.getElementById('localStatus');
  const syncStatus = document.getElementById('syncStatus');
  const dataStatus = document.getElementById('dataStatus');
  const statStudents = document.getElementById('statStudents');
  const statHours = document.getElementById('statHours');
  
  if (localStatus) {
    localStatus.textContent = '💾 Local Storage: Active';
  }
  
  if (syncStatus) {
    const isAutoSync = localStorage.getItem('autoSyncEnabled') === 'true';
    syncStatus.textContent = isAutoSync ? '☁️ Cloud Sync: Auto' : '☁️ Cloud Sync: Manual';
  }
  
  // dataStatus will auto-update when statStudents and statHours update
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
      
      // Update UI elements
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
      
      // Set UI to 0
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

    // Update DOM elements
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

    // Update header stats after DOM updates
    updateHeaderStats();
    refreshTimestamp();
  } catch (err) {
    console.error("❌ Error updating stats:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to update stats";
  }
}

async function recalcSummaryStats(uid) {
  try {
    console.log('🔄 Recalculating summary stats for:', uid);
    
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

    console.log('📊 Calculated stats:', {
      students: studentsCount,
      hours: totalHours,
      earnings: totalEarnings
    });

    await updateUserStats(uid, {
      students: studentsCount,
      hours: totalHours,
      earnings: totalEarnings,
      lastSync: new Date().toLocaleString()
    });

    // Update header stats AFTER updating user stats
    updateHeaderStats();
    
    console.log('✅ Summary stats recalculated successfully');
  } catch (err) {
    console.error("❌ Error recalculating stats:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to recalc stats";
  }
}

// ===========================
// DATA RENDERING FUNCTIONS
// ===========================

async function renderStudents() {
  const user = auth.currentUser;
  if (!user) return;

  const container = document.getElementById('studentsContainer');
  if (!container) return;

  // Show cached data immediately if available
  if (isCacheValid('students') && cache.students) {
    container.innerHTML = cache.students;
    console.log('✅ Students loaded from cache');
    return;
  }

  container.innerHTML = '<div class="loading">Loading students...</div>';

  try {
    const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
    
    if (studentsSnap.size === 0) {
      const emptyHTML = `
        <div class="empty-state">
          <h3>No Students Yet</h3>
          <p>Add your first student to get started</p>
        </div>
      `;
      container.innerHTML = emptyHTML;
      cache.students = emptyHTML;
      cache.lastSync = Date.now();
      return;
    }

    let studentsHTML = '';
    studentsSnap.forEach(docSnap => {
      const student = { id: docSnap.id, ...docSnap.data() };
      studentsHTML += `
        <div class="student-card">
          <div class="student-card-header">
            <div>
              <strong>${student.name}</strong>
              <span class="student-id">${student.id}</span>
            </div>
            <div class="student-actions">
              <button class="btn-icon" onclick="editStudent('${student.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteStudent('${student.id}')" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="student-details">
            <div class="muted">${student.gender} • ${student.email || 'No email'} • ${student.phone || 'No phone'}</div>
            <div class="student-rate">Rate: $${fmtMoney(student.rate)}/session</div>
            <div class="student-meta">Added: ${formatDate(student.createdAt)}</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = studentsHTML;
    cache.students = studentsHTML;
    cache.lastSync = Date.now();
    
    console.log('✅ Students loaded from Firestore');

  } catch (error) {
    console.error("Error rendering students:", error);
    container.innerHTML = '<div class="error">Error loading students</div>';
  }
}

async function renderRecentHours(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  
  const container = document.getElementById('hoursContainer');
  if (!container) return;

  try {
    const hoursQuery = query(
      collection(db, "users", user.uid, "hours"),
      orderBy("dateIso", "desc")
    );
    
    const snap = await getDocs(hoursQuery);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (rows.length === 0) {
      container.innerHTML = '<p class="empty-message">No work logged yet.</p>';
      // Still update stats even when no hours
      await updateHoursTabStats();
      return;
    }

    let hoursHTML = '';
    rows.slice(0, limit).forEach(entry => {
      hoursHTML += `
        <div class="hours-entry">
          <div class="hours-header">
            <strong>${entry.organization}</strong>
            <span class="hours-type">${getWorkTypeDisplay(entry.workType)}</span>
            <div class="hours-actions">
              <button class="btn-icon" onclick="editHours('${entry.id}')" title="Edit">✏️</button>
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

    // UPDATE: Refresh hours tab stats after rendering
    await updateHoursTabStats();

  } catch (error) {
    console.error("Error rendering hours:", error);
    container.innerHTML = '<p class="error-message">Error loading hours</p>';
  }
}

// Helper function to display work type nicely
function getWorkTypeDisplay(workType) {
  const workTypeMap = {
    'hourly': 'Hourly',
    'session': 'Per-Session', 
    'contract': 'Contract Work',
    'project': 'Project Based',
    'consultation': 'Consultation',
    'other': 'One-off Job'
  };
  return workTypeMap[workType] || workType;
}

async function renderRecentMarks(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById('marksContainer');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading recent marks...</div>';

  try {
    const marksQuery = query(
      collection(db, "users", user.uid, "marks"),
      orderBy("dateIso", "desc")
    );
    
    const snap = await getDocs(marksQuery);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Marks Recorded</h3>
          <p>Add your first mark to get started</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    rows.slice(0, limit).forEach(entry => {
      const item = document.createElement("div");
      item.className = "mark-entry";
      item.innerHTML = `
        <div><strong>${entry.student}</strong> — ${entry.subject} (${entry.topic})</div>
        <div class="muted">${formatDate(entry.date)}</div>
        <div>Score: ${safeNumber(entry.score)}/${safeNumber(entry.max)} — ${safeNumber(entry.percentage).toFixed(2)}% — Grade: ${entry.grade}</div>
      `;
      container.appendChild(item);
    });

    // Update marks summary
    const marksCountEl = document.getElementById('marksCount');
    const avgMarksEl = document.getElementById('avgMarks');
    if (marksCountEl) marksCountEl.textContent = rows.length;
    if (avgMarksEl) {
      const avg = rows.length ? rows.reduce((s, r) => s + safeNumber(r.percentage), 0) / rows.length : 0;
      avgMarksEl.textContent = `${avg.toFixed(1)}%`;
    }

  } catch (error) {
    console.error("Error rendering marks:", error);
    container.innerHTML = '<div class="error">Error loading marks</div>';
  }
}

async function renderAttendanceRecent(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById('attendanceContainer');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading attendance records...</div>';

  try {
    const attendanceQuery = query(
      collection(db, "users", user.uid, "attendance"),
      orderBy("dateIso", "desc")
    );
    
    const snap = await getDocs(attendanceQuery);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Attendance Records</h3>
          <p>Record your first attendance session</p>
        </div>
      `;
      await populateAttendanceStudentList();
      return;
    }

    container.innerHTML = '';
    rows.slice(0, limit).forEach(entry => {
      const item = document.createElement("div");
      item.className = "attendance-entry";
      item.innerHTML = `
        <div class="attendance-header">
          <div>
            <strong>${entry.subject}</strong> — ${entry.topic || "—"}
            <div class="muted">${formatDate(entry.date)}</div>
          </div>
          <div class="attendance-actions">
            <button class="btn-icon" onclick="editAttendance('${entry.id}')" title="Edit">✏️</button>
            <button class="btn-icon" onclick="deleteAttendance('${entry.id}')" title="Delete">🗑️</button>
          </div>
        </div>
        <div>Present: ${Array.isArray(entry.present) ? entry.present.length : 0} students</div>
        ${Array.isArray(entry.present) && entry.present.length > 0 ? 
          `<div class="muted small">Students: ${entry.present.join(', ')}</div>` : ''}
      `;
      container.appendChild(item);
    });

    await populateAttendanceStudentList();

    // Update attendance summary
    const lastSessionDateEl = document.getElementById('lastSessionDate');
    const attendanceCountEl = document.getElementById('attendanceCount');
    if (lastSessionDateEl) lastSessionDateEl.textContent = rows[0]?.date ? formatDate(rows[0].date) : "Never";
    if (attendanceCountEl) attendanceCountEl.textContent = rows.length;

  } catch (error) {
    console.error("Error rendering attendance:", error);
    container.innerHTML = '<div class="error">Error loading attendance</div>';
  }
}

async function renderPaymentActivity(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById('paymentActivityLog');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading payment activity...</div>';

  try {
    const paymentsQuery = query(
      collection(db, "users", user.uid, "payments"),
      orderBy("dateIso", "desc")
    );
    
    const snap = await getDocs(paymentsQuery);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Payment Activity</h3>
          <p>No recent payment activity recorded</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    rows.slice(0, limit).forEach(entry => {
      const item = document.createElement("div");
      item.className = "activity-item";
      item.innerHTML = `
        <div><strong>$${fmtMoney(entry.amount)}</strong> — ${entry.student}</div>
        <div class="muted">${formatDate(entry.date)} | ${entry.method}</div>
        <div>${entry.notes || ""}</div>
      `;
      container.appendChild(item);
    });

    // Update monthly payments
    const monthlyPaymentsEl = document.getElementById('monthlyPayments');
    if (monthlyPaymentsEl) {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
      const sum = rows
        .filter(r => (r.date || "").startsWith(ym))
        .reduce((s, r) => s + safeNumber(r.amount), 0);
      monthlyPaymentsEl.textContent = `$${fmtMoney(sum)}`;
    }

  } catch (error) {
    console.error("Error rendering payments:", error);
    container.innerHTML = '<div class="error">Error loading payments</div>';
  }
}

async function renderStudentBalances() {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById('studentBalancesContainer');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading student balances...</div>';

  try {
    const [studentsSnap, hoursSnap, paymentsSnap] = await Promise.all([
      getDocs(collection(db, "users", user.uid, "students")),
      getDocs(collection(db, "users", user.uid, "hours")),
      getDocs(collection(db, "users", user.uid, "payments"))
    ]);

    const earningsByStudent = {};
    hoursSnap.forEach(d => {
      const row = d.data();
      const sid = row.student || "__unknown__";
      earningsByStudent[sid] = (earningsByStudent[sid] || 0) + safeNumber(row.total);
    });

    const paymentsByStudent = {};
    paymentsSnap.forEach(d => {
      const row = d.data();
      const sid = row.student || "__unknown__";
      paymentsByStudent[sid] = (paymentsByStudent[sid] || 0) + safeNumber(row.amount);
    });

    if (studentsSnap.size === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Student Data</h3>
          <p>Add students and record hours/payments to see balances</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    let totalOwed = 0;
    
    studentsSnap.forEach(snap => {
      const student = snap.data();
      const sid = student.id;
      const earned = earningsByStudent[sid] || 0;
      const paid = paymentsByStudent[sid] || 0;
      const owed = Math.max(earned - paid, 0);
      totalOwed += owed;

      const item = document.createElement("div");
      item.className = "activity-item";
      item.innerHTML = `
        <div><strong>${student.name}</strong> (${student.id})</div>
        <div>Earned: $${fmtMoney(earned)} | Paid: $${fmtMoney(paid)} | Owed: $${fmtMoney(owed)}</div>
      `;
      container.appendChild(item);
    });

    // Update total owed display
    const totalStudentsCountEl = document.getElementById('totalStudentsCount');
    const totalOwedEl = document.getElementById('totalOwed');
    if (totalStudentsCountEl) totalStudentsCountEl.textContent = studentsSnap.size;
    if (totalOwedEl) totalOwedEl.textContent = `$${fmtMoney(totalOwed)}`;

  } catch (error) {
    console.error("Error rendering balances:", error);
    container.innerHTML = '<div class="error">Error loading balances</div>';
  }
}

async function renderOverviewReports() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const [studentsSnap, hoursSnap, marksSnap, paymentsSnap] = await Promise.all([
      getDocs(collection(db, "users", user.uid, "students")),
      getDocs(collection(db, "users", user.uid, "hours")),
      getDocs(collection(db, "users", user.uid, "marks")),
      getDocs(collection(db, "users", user.uid, "payments"))
    ]);

    // Calculate totals
    let hoursTotal = 0;
    let earningsTotal = 0;
    hoursSnap.forEach(d => {
      const r = d.data();
      hoursTotal += safeNumber(r.hours);
      earningsTotal += safeNumber(r.total);
    });

    let markSum = 0;
    let markCount = 0;
    marksSnap.forEach(d => {
      const r = d.data();
      markSum += safeNumber(r.percentage);
      markCount += 1;
    });
    const avgMark = markCount ? (markSum / markCount) : 0;

    let paymentsTotal = 0;
    paymentsSnap.forEach(d => {
      const r = d.data();
      paymentsTotal += safeNumber(r.amount);
    });

    const outstanding = Math.max(earningsTotal - paymentsTotal, 0);

    // Update overview elements
    const totalStudentsReport = document.getElementById('totalStudentsReport');
    const totalHoursReport = document.getElementById('totalHoursReport');
    const totalEarningsReport = document.getElementById('totalEarningsReport');
    const avgMarkReport = document.getElementById('avgMarkReport');
    const totalPaymentsReport = document.getElementById('totalPaymentsReport');
    const outstandingBalance = document.getElementById('outstandingBalance');

    if (totalStudentsReport) totalStudentsReport.textContent = studentsSnap.size;
    if (totalHoursReport) totalHoursReport.textContent = hoursTotal.toFixed(1);
    if (totalEarningsReport) totalEarningsReport.textContent = `$${fmtMoney(earningsTotal)}`;
    if (avgMarkReport) avgMarkReport.textContent = `${avgMark.toFixed(1)}%`;
    if (totalPaymentsReport) totalPaymentsReport.textContent = `$${fmtMoney(paymentsTotal)}`;
    if (outstandingBalance) outstandingBalance.textContent = `$${fmtMoney(outstanding)}`;

  } catch (error) {
    console.error("Error rendering overview:", error);
  }
}

// ===========================
// NOTIFICATION SYSTEM MODULE
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
// SYNC BAR MODULE
// ===========================

const SyncBar = {
  init() {
    NotificationSystem.initNotificationStyles();
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
      // Load saved autoSync preference from localStorage
      const savedAutoSync = localStorage.getItem('autoSyncEnabled') === 'true';
      isAutoSyncEnabled = savedAutoSync;
      
      // Set the checkbox state based on saved preference
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
        
        // Save preference to localStorage
        localStorage.setItem('autoSyncEnabled', isAutoSyncEnabled.toString());
        console.log('💾 Auto-sync preference saved:', isAutoSyncEnabled);
        
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

  async performSync(mode = 'manual') {
    const user = auth.currentUser;
    if (!user) {
      NotificationSystem.notifyError('Please log in to sync');
      return;
    }

    try {
      if (syncSpinner) syncSpinner.style.display = 'inline-block';
      if (syncIndicator) {
        syncIndicator.classList.remove('sync-connected', 'sync-error');
        syncIndicator.classList.add('sync-active');
      }
      if (syncMessageLine) {
        syncMessageLine.textContent = `Status: ${mode === 'auto' ? 'Auto-syncing' : 'Manual syncing'}...`;
      }

      await Promise.all([
        recalcSummaryStats(user.uid),
        loadUserStats(user.uid),
        renderStudents(),
        renderRecentHours(),
        renderRecentMarks(),
        renderAttendanceRecent(),
        renderPaymentActivity(),
        renderStudentBalances(),
        renderOverviewReports()
      ]);

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

      NotificationSystem.notifySuccess(`${mode === 'auto' ? 'Auto-' : ''}Sync completed successfully`);

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
    } finally {
      if (syncSpinner) syncSpinner.style.display = 'none';
    }
  },

  setupExportCloudButton() {
    if (exportCloudBtn) {
      exportCloudBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to export data');
          return;
        }

        try {
          NotificationSystem.notifyInfo('Starting cloud export...');
          const backupRef = doc(db, "backups", user.uid);
          const backupData = await this.createBackupData(user.uid);
          
          await setDoc(backupRef, {
            ...backupData,
            exportedAt: new Date().toISOString(),
            version: '1.0',
            user: user.uid
          });

          NotificationSystem.notifySuccess('Cloud export completed successfully');
        } catch (error) {
          console.error('❌ Cloud export failed:', error);
          NotificationSystem.notifyError(`Export failed: ${error.message}`);
        }
      });
    }
  },

  setupImportCloudButton() {
    if (importCloudBtn) {
      importCloudBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to import data');
          return;
        }

        const proceed = confirm('⚠️ This will overwrite your current data with the cloud backup. This action cannot be undone. Continue?');
        if (!proceed) return;

        try {
          NotificationSystem.notifyInfo('Starting cloud import...');
          const backupRef = doc(db, "backups", user.uid);
          const backupSnap = await getDoc(backupRef);

          if (!backupSnap.exists()) {
            NotificationSystem.notifyWarning('No cloud backup found for your account');
            return;
          }

          const backupData = backupSnap.data();
          await this.restoreBackupData(user.uid, backupData);
          NotificationSystem.notifySuccess('Cloud import completed successfully');
          await this.performSync('manual');
          
        } catch (error) {
          console.error('❌ Cloud import failed:', error);
          NotificationSystem.notifyError(`Import failed: ${error.message}`);
        }
      });
    }
  },

  setupSyncStatsButton() {
    if (syncStatsBtn) {
      syncStatsBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to sync stats');
          return;
        }

        try {
          NotificationSystem.notifyInfo('Fixing statistics... recalculating from your raw data');
          await recalcSummaryStats(user.uid);
          await loadUserStats(user.uid);
          NotificationSystem.notifySuccess('Statistics synced successfully');
        } catch (error) {
          console.error('❌ Stats sync failed:', error);
          NotificationSystem.notifyError(`Stats sync failed: ${error.message}`);
        }
      });
    }
  },

  setupExportDataButton() {
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to export data');
          return;
        }

        try {
          NotificationSystem.notifyInfo('Preparing data export...');
          const exportData = await this.createBackupData(user.uid);
          
          const dataStr = JSON.stringify(exportData, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          NotificationSystem.notifySuccess('Data exported successfully');
        } catch (error) {
          console.error('❌ Local export failed:', error);
          NotificationSystem.notifyError(`Export failed: ${error.message}`);
        }
      });
    }
  },

  setupImportDataButton() {
    if (importDataBtn) {
      importDataBtn.addEventListener('click', () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to import data');
          return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const proceed = confirm('⚠️ This will overwrite your current data with the imported file. This action cannot be undone. Continue?');
          if (!proceed) return;

          try {
            NotificationSystem.notifyInfo('Importing data...');
            const fileText = await file.text();
            const importData = JSON.parse(fileText);
            
            if (!importData.metadata || !importData.students || !importData.hours) {
              throw new Error('Invalid backup file format');
            }

            await this.restoreBackupData(user.uid, importData);
            NotificationSystem.notifySuccess('Data imported successfully');
            await this.performSync('manual');
            
          } catch (error) {
            console.error('❌ Local import failed:', error);
            NotificationSystem.notifyError(`Import failed: ${error.message}`);
          }
        };
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
      });
    }
  },

  setupClearAllButton() {
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          NotificationSystem.notifyError('Please log in to clear data');
          return;
        }

        const proceed = confirm('⚠️🚨 DANGER ZONE 🚨⚠️\n\nThis will PERMANENTLY DELETE ALL your data including:\n• All students\n• All hours worked\n• All marks & assessments\n• All attendance records\n• All payment records\n\nThis action cannot be undone!\n\nType "DELETE ALL" to confirm:');
        
        if (proceed && prompt('Type "DELETE ALL" to confirm:') === 'DELETE ALL') {
          try {
            NotificationSystem.notifyWarning('Clearing all data...');
            await this.clearAllUserData(user.uid);
            NotificationSystem.notifySuccess('All data cleared successfully');
            await this.performSync('manual');
          } catch (error) {
            console.error('❌ Clear data failed:', error);
            NotificationSystem.notifyError(`Clear failed: ${error.message}`);
          }
        } else {
          NotificationSystem.notifyInfo('Data clearance cancelled');
        }
      });
    }
  },

  async createBackupData(uid) {
    const [statsSnap, studentsSnap, hoursSnap, paymentsSnap, marksSnap, attendanceSnap] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDocs(collection(db, "users", uid, "students")),
      getDocs(collection(db, "users", uid, "hours")),
      getDocs(collection(db, "users", uid, "payments")),
      getDocs(collection(db, "users", uid, "marks")),
      getDocs(collection(db, "users", uid, "attendance"))
    ]);

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        user: uid,
        recordCounts: {
          students: studentsSnap.size,
          hours: hoursSnap.size,
          payments: paymentsSnap.size,
          marks: marksSnap.size,
          attendance: attendanceSnap.size
        }
      },
      stats: statsSnap.exists() ? statsSnap.data() : {},
      students: studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      hours: hoursSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      payments: paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      marks: marksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      attendance: attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
  },

  async restoreBackupData(uid, backupData) {
    const batch = writeBatch(db);
    
    await this.clearAllUserData(uid);
    
    if (backupData.stats) {
      const statsRef = doc(db, "users", uid);
      batch.set(statsRef, backupData.stats);
    }
    
    if (backupData.students && Array.isArray(backupData.students)) {
      backupData.students.forEach(student => {
        const studentRef = doc(db, "users", uid, "students", student.id);
        batch.set(studentRef, student);
      });
    }
    
    ['hours', 'payments', 'marks', 'attendance'].forEach(collectionName => {
      if (backupData[collectionName] && Array.isArray(backupData[collectionName])) {
        backupData[collectionName].forEach(item => {
          const itemRef = doc(collection(db, "users", uid, collectionName));
          batch.set(itemRef, item);
        });
      }
    });
    
    await batch.commit();
    console.log('✅ Backup data restored');
  },

  async clearAllUserData(uid) {
    try {
      const collections = ['students', 'hours', 'payments', 'marks', 'attendance'];
      
      for (const collectionName of collections) {
        const colRef = collection(db, "users", uid, collectionName);
        const snapshot = await getDocs(colRef);
        
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        if (snapshot.docs.length > 0) {
          await batch.commit();
        }
      }
      
      const statsRef = doc(db, "users", uid);
      await setDoc(statsRef, {
        students: 0,
        hours: 0,
        earnings: 0,
        lastSync: new Date().toLocaleString()
      });
      
      console.log('✅ All user data cleared');
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
      throw error;
    }
  }
};

// ===========================
// UI MANAGEMENT MODULE
// ===========================

const UIManager = {
  init() {
    this.initializeTheme();
    this.initTabs();
    this.bindUiEvents();
    setupThemeToggle();
    console.log('✅ UI Manager initialized');
  },

  initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();
    console.log(`🎨 Theme initialized to ${savedTheme}`);
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    console.log(`🎨 Theme changed to ${newTheme}`);
  },

initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tabcontent');

  console.log('🔧 Initializing tabs system...');
  console.log('Found tabs:', tabs.length);
  console.log('Found tab contents:', tabContents.length);

  // First, ensure only the active tab is visible
  tabContents.forEach(tab => {
    const isActive = tab.classList.contains('active');
    tab.style.display = isActive ? 'block' : 'none';
    console.log(`Tab ${tab.id}: display = ${tab.style.display}, active = ${isActive}`);
  });

  // Add click listeners to all tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const targetId = tab.getAttribute('data-tab');
      console.log('🎯 Switching to tab:', targetId);

      // Remove active class from all tabs and hide all contents
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      
      tabContents.forEach(tc => {
        tc.classList.remove('active');
        tc.style.display = 'none';
        tc.setAttribute('aria-hidden', 'true');
      });

      // Activate clicked tab and show target content
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
        targetContent.style.display = 'block';
        targetContent.setAttribute('aria-hidden', 'false');
        
        console.log('✅ Tab displayed:', targetId);
        console.log('Target content display style:', targetContent.style.display);
        
        // Load tab-specific data
        this.loadTabData(targetId);
      } else {
        console.error('❌ Tab content not found:', targetId);
      }
    });
  });

  // Ensure first tab is active if none are
  const activeTab = document.querySelector('.tab.active');
  if (!activeTab && tabs.length > 0) {
    tabs[0].click();
  }
  
  console.log('✅ Tab system initialized');
},

loadTabData(tabId) {
  console.log('📥 Loading data for tab:', tabId);
  
  const user = auth.currentUser;
  if (!user) return;

  switch(tabId) {
    case 'payments':
      renderPaymentActivity();
      renderStudentBalances();
      break;
    case 'reports':
      renderOverviewReports();
      break;
    case 'students':
      renderStudents();
      break;
    case 'hours':
      renderRecentHours();
      updateHoursTabStats();
      break;
    case 'marks':
      renderRecentMarks();
      break;
    case 'attendance':
      renderAttendanceRecent();
      populateAttendanceStudentList();
      break;
  }
},
  
  setupMarksFormCalculations() {
    const scoreInput = document.getElementById('marksScore');
    const maxInput = document.getElementById('marksMax');
    if (scoreInput) scoreInput.addEventListener('input', updateMarksPercentage);
    if (maxInput) maxInput.addEventListener('input', updateMarksPercentage);
  },

  setupPaymentFormCalculations() {
    const amountInput = document.getElementById('paymentAmount');
    if (amountInput) {
      amountInput.addEventListener('input', function() {
        // Format as currency if needed
        const value = parseFloat(this.value) || 0;
        if (value > 0) {
          // You can add real-time formatting here if needed
        }
      });
    }
  }, 

  initEventListeners() {
    console.log('🔧 Initializing event listeners...');
    
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const today = new Date().toISOString().split('T')[0];
    dateInputs.forEach(input => {
      if (!input.value) {
        input.value = today;
      }
    });
    
    loadStudentsForDropdowns();
    
    console.log('✅ Event listeners initialized');
  }
}; // ← END OF UIMANAGER OBJECT

// ===========================
// PAYMENT FORM EVENT LISTENERS - ADD THIS
// ===========================

function setupPaymentFormListeners() {
  console.log('🔧 Setting up payment form listeners...');
  
  const submitBtn = document.getElementById('paymentSubmitBtn');
  const clearBtn = document.getElementById('paymentClearBtn');

  if (submitBtn) {
    submitBtn.addEventListener('click', recordPayment);
    console.log('✅ Payment submit listener added');
  } else {
    console.error('❌ Payment submit button not found');
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', resetPaymentForm);
    console.log('✅ Payment clear listener added');
  } else {
    console.error('❌ Payment clear button not found');
  }

  console.log('✅ Payment form event listeners setup');
}

// ===========================
// REPORT TAB EVENT LISTENERS - ADD THIS
// ===========================

function setupReportTabListeners() {
  console.log('🔧 Setting up report tab listeners...');
  
  // Get all report buttons
  const reportButtons = document.querySelectorAll('#reports .button');
  console.log('Found report buttons:', reportButtons.length);

  // Add listeners to all report buttons in the reports tab
  reportButtons.forEach(button => {
    const text = button.textContent.toLowerCase();
    if (text.includes('weekly')) {
      button.addEventListener('click', showWeeklyBreakdown);
      console.log('✅ Weekly report button listener added');
    } else if (text.includes('bi-weekly') || text.includes('biweekly')) {
      button.addEventListener('click', showBiWeeklyBreakdown);
      console.log('✅ Biweekly report button listener added');
    } else if (text.includes('monthly')) {
      button.addEventListener('click', showMonthlyBreakdown);
      console.log('✅ Monthly report button listener added');
    } else if (text.includes('subject')) {
      button.addEventListener('click', showSubjectBreakdown);
      console.log('✅ Subject report button listener added');
    }
  });

  console.log('✅ Report tab event listeners setup');
}

// ===========================
// STUDENT FORM EVENT LISTENERS
// ===========================

function setupStudentFormListeners() {
  const submitBtn = document.getElementById('studentSubmitBtn');
  const clearBtn = document.getElementById('clearStudentFormBtn');
  const cancelBtn = document.getElementById('studentCancelBtn');

  if (submitBtn) {
    submitBtn.addEventListener('click', addStudent);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearStudentForm);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', cancelEdit);
  }

  console.log('✅ Student form event listeners setup');
}

// ===========================
// HOURS FORM EVENT LISTENERS - CLEAN VERSION
// ===========================

function setupHoursFormListeners() {
  const submitBtn = document.getElementById('hoursSubmitBtn');
  const clearBtn = document.getElementById('clearHoursFormBtn');
  const cancelBtn = document.getElementById('hoursCancelBtn');

  if (submitBtn) {
    submitBtn.addEventListener('click', logHours);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', resetHoursForm);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', cancelHoursEdit);
  }

  console.log('✅ Hours form event listeners setup');
  // NOTE: Calculations are handled by UIManager.init()
}

// ===========================
// HOURS MANAGEMENT FUNCTIONS - CLEAN VERSION
// ===========================

function cancelHoursEdit() {
  console.log('❌ Canceling hours edit...');
  currentEditHoursId = null;
  resetHoursForm();
  NotificationSystem.notifyInfo('Hours edit canceled');
}

// ===========================
// STUDENT MANAGEMENT MODULE
// ===========================

async function loadStudentsForDropdowns() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
    const studentsList = [];
    studentsSnap.forEach(doc => {
      studentsList.push({ id: doc.id, ...doc.data() });
    });
    
    updateStudentDropdowns(studentsList);
    return studentsList;
  } catch (error) {
    console.error("Error loading students:", error);
    return [];
  }
}

function updateStudentDropdowns(students) {
  const dropdowns = [
    'marksStudent',
    'paymentStudent',
    'hoursStudent'
  ];
  
  dropdowns.forEach(dropdownId => {
    const select = document.getElementById(dropdownId);
    if (select) {
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name} (${student.id})`;
        select.appendChild(option);
      });
    }
  });
}

function updateMarksPercentage() {
  const scoreEl = document.getElementById('marksScore');
  const maxEl = document.getElementById('marksMax');
  const pctEl = document.getElementById('percentage');
  const gradeEl = document.getElementById('grade');

  const score = parseFloat(scoreEl?.value);
  const max = parseFloat(maxEl?.value);

  if (Number.isFinite(score) && Number.isFinite(max) && max > 0) {
    const percentage = (score / max) * 100;
    if (pctEl) pctEl.value = percentage.toFixed(1);
    if (gradeEl) gradeEl.value = calculateGrade(percentage);
  }
}

function updateUserFriendlyStats() {
  const weeklyHours = parseFloat(document.getElementById('weeklyHours')?.textContent) || 0;
  const weeklyTotal = parseFloat(document.getElementById('weeklyTotal')?.textContent) || 0;
  
  const summaryEl = document.getElementById('weeklySummary');
  if (!summaryEl) return;
  
  let intensity = '';
  if (weeklyHours >= 35) intensity = 'very busy';
  else if (weeklyHours >= 25) intensity = 'productive';
  else if (weeklyHours >= 15) intensity = 'moderate';
  else intensity = 'light';

  summaryEl.textContent = `This was a ${intensity} week! You worked ${weeklyHours} hours and earned $${weeklyTotal}.`;
}

function updateGoalProgress() {
  const weeklyHours = parseFloat(document.getElementById('weeklyHours')?.textContent) || 0;
  const goalProgressEl = document.getElementById('goalProgress');
  if (!goalProgressEl) return;
  
  const weeklyGoal = 30;
  const progress = Math.min((weeklyHours / weeklyGoal) * 100, 100);
  const filled = Math.round(progress / 10);
  
  goalProgressEl.innerHTML = `Weekly Goal: ${'⭐'.repeat(filled)}${'⚪'.repeat(10-filled)} ${Math.round(progress)}%`;
}

// ===========================
// ATTENDANCE STUDENT LIST POPULATION
// ===========================

async function populateAttendanceStudentList() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
    const attendanceList = document.getElementById('attendanceList');
    
    if (!attendanceList) {
      console.error('❌ Attendance list element not found');
      return;
    }

    // Clear existing list (except the template if any)
    attendanceList.innerHTML = '';

    if (studentsSnap.size === 0) {
      attendanceList.innerHTML = `
        <div class="empty-state">
          <p>No students registered yet. Add students in the Students tab first.</p>
        </div>
      `;
      return;
    }

    studentsSnap.forEach(doc => {
      const student = { id: doc.id, ...doc.data() };
      const studentItem = document.createElement('div');
      studentItem.className = 'attendance-student-item';
      studentItem.innerHTML = `
        <label class="checkbox-label">
          <input type="checkbox" value="${student.id}">
          <span class="checkmark"></span>
          <div class="student-info">
            <strong>${student.name}</strong>
            <span class="student-id">${student.id}</span>
          </div>
        </label>
      `;
      attendanceList.appendChild(studentItem);
    });

    console.log(`✅ Populated ${studentsSnap.size} students in attendance list`);

  } catch (error) {
    console.error('❌ Error populating attendance student list:', error);
    const attendanceList = document.getElementById('attendanceList');
    if (attendanceList) {
      attendanceList.innerHTML = '<div class="error">Error loading students</div>';
    }
  }
}

// ===========================
// ATTENDANCE EDIT FUNCTIONS
// ===========================

let currentEditAttendanceId = null;

async function editAttendance(attendanceId) {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to edit attendance');
    return;
  }

  try {
    console.log('✏️ Editing attendance:', attendanceId);
    
    // Show loading state using specific ID
    const saveBtn = document.getElementById('attendanceSubmitBtn');
    if (saveBtn) saveBtn.textContent = 'Loading...';
    
    const attendanceDoc = await getDoc(doc(db, "users", user.uid, "attendance", attendanceId));
    
    if (!attendanceDoc.exists()) {
      NotificationSystem.notifyError('Attendance record not found');
      resetAttendanceFormButtons(); // Reset on error
      return;
    }

    const attendance = attendanceDoc.data();
    
    // Fill the form with attendance data
    document.getElementById('attendanceDate').value = formatDateForInput(attendance.dateIso || attendance.date);
    document.getElementById('attendanceSubject').value = attendance.subject || '';
    document.getElementById('attendanceTopic').value = attendance.topic || '';

    // Wait for student list to populate, then check the present students
    await populateAttendanceStudentList();
    
    // Check the checkboxes for students who were present
    if (Array.isArray(attendance.present)) {
      attendance.present.forEach(studentId => {
        const checkbox = document.querySelector(`#attendanceList input[value="${studentId}"]`);
        if (checkbox) {
          checkbox.checked = true;
        }
      });
    }

    // Set edit mode
    currentEditAttendanceId = attendanceId;
    
    // Update button states for edit mode
    const saveBtnFinal = document.getElementById('attendanceSubmitBtn');
    const clearBtn = document.getElementById('attendanceClearBtn');
    
    if (saveBtnFinal) {
      saveBtnFinal.textContent = '💾 Update Attendance';
      saveBtnFinal.onclick = saveAttendance;
    }
    
    if (clearBtn) {
      clearBtn.textContent = '❌ Cancel Edit';
      clearBtn.onclick = cancelAttendanceEdit;
    }

    // Scroll to form
    const attendanceForm = document.querySelector('#attendance .section-card:first-child');
    if (attendanceForm) {
      attendanceForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    NotificationSystem.notifyInfo(`Editing attendance for ${attendance.subject}`);
    
  } catch (error) {
    console.error('Error loading attendance for edit:', error);
    NotificationSystem.notifyError('Failed to load attendance data');
    resetAttendanceFormButtons(); // Always reset on error
  }
}

function cancelAttendanceEdit() {
  console.log('❌ Canceling attendance edit...');
  
  currentEditAttendanceId = null;
  resetAttendanceFormButtons(); // Use the new reset function
  clearAttendanceForm();
  
  NotificationSystem.notifyInfo('Attendance edit canceled');
}

// ===========================
// FORM MANAGEMENT FUNCTIONS
// ===========================

function clearStudentForm() {
  const form = document.getElementById("studentForm");
  if (form) {
    form.reset();
    
    // Reset specific fields
    const fields = ["studentName", "studentId", "studentEmail", "studentPhone", "studentBaseRate"];
    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) field.value = "";
    });
    
    // Reset dropdown
    const genderSelect = document.getElementById("studentGender");
    if (genderSelect) genderSelect.selectedIndex = 0;
    
    // Reset to add mode
    const submitBtn = document.querySelector('#studentForm button[type="button"]');
    if (submitBtn) {
      submitBtn.textContent = '➕ Add Student';
      submitBtn.onclick = addStudent;
    }
    
    console.log("✅ Student form reset to add mode");
  }
}

function resetMarksForm() {
  const form = document.getElementById("marksForm");
  if (form) form.reset();

  const pctEl = document.getElementById("percentage");
  const gradeEl = document.getElementById("grade");
  if (pctEl) pctEl.value = "";
  if (gradeEl) gradeEl.value = "";
}

function clearAttendanceForm() {
  console.log('🗑️ Clearing attendance form...');
  
  const dateEl = document.getElementById("attendanceDate");
  const subjectEl = document.getElementById("attendanceSubject");
  const topicEl = document.getElementById("attendanceTopic");

  // Reset form fields
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0]; // Default to today
  if (subjectEl) subjectEl.value = "";
  if (topicEl) topicEl.value = "";

  // Uncheck all student checkboxes
  document.querySelectorAll("#attendanceList input[type=checkbox]")
    .forEach(cb => cb.checked = false);

  console.log('✅ Attendance form cleared');
}

function resetAttendanceFormButtons() {
  console.log('🔄 Resetting attendance form buttons...');
  
  const saveBtn = document.querySelector('#attendance .button.primary') || 
                 document.getElementById('attendanceSubmitBtn');
  const clearBtn = document.querySelector('#attendance .button.secondary') || 
                  document.getElementById('attendanceClearBtn');
  
  // Reset save button
  if (saveBtn) {
    saveBtn.textContent = '💾 Save Attendance';
    saveBtn.onclick = saveAttendance;
    saveBtn.disabled = false;
  }
  
  // Reset clear button
  if (clearBtn) {
    clearBtn.textContent = '🗑️ Clear Form';
    clearBtn.onclick = clearAttendanceForm;
    clearBtn.disabled = false;
  }
  
  // Clear edit state
  currentEditAttendanceId = null;
  
  console.log('✅ Attendance form buttons reset');
}

function resetPaymentForm() {
  const studentEl = document.getElementById("paymentStudent");
  const amountEl = document.getElementById("paymentAmount");
  const dateEl = document.getElementById("paymentDate");
  const methodEl = document.getElementById("paymentMethod");
  const notesEl = document.getElementById("paymentNotes");

  if (studentEl) studentEl.value = "";
  if (amountEl) amountEl.value = "";
  if (dateEl) dateEl.value = "";
  if (methodEl) methodEl.value = methodEl.options[0]?.value || "";
  if (notesEl) notesEl.value = "";
}

function selectAllStudents() {
  document.querySelectorAll("#attendanceList input[type=checkbox]").forEach(cb => cb.checked = true);
}

function deselectAllStudents() {
  document.querySelectorAll("#attendanceList input[type=checkbox]").forEach(cb => cb.checked = false);
}

// ===========================
// RATE MANAGEMENT FUNCTIONS
// ===========================

async function saveDefaultRate() {
  const input = document.getElementById("defaultBaseRate");
  const user = auth.currentUser;
  
  if (!user) {
    NotificationSystem.notifyError("Please log in to save default rate");
    return;
  }

  const val = parseFloat(input?.value) || 0;
  
  const success = await updateUserDefaultRate(user.uid, val);
  
  if (success) {
    const currentDisplay = document.getElementById("currentDefaultRate");
    const hoursDisplay = document.getElementById("currentDefaultRateDisplay");
    
    if (currentDisplay) currentDisplay.textContent = fmtMoney(val);
    if (hoursDisplay) hoursDisplay.textContent = fmtMoney(val);
    
    // Save to localStorage as backup and for immediate access
    localStorage.setItem('userDefaultRate', val.toString());
    console.log('💾 Default rate saved to localStorage:', val);
    
    NotificationSystem.notifySuccess("Default rate saved and synced to cloud");
  } else {
    NotificationSystem.notifyError("Failed to save default rate");
  }
}

function initializeDefaultRate(rate) {
  const defaultRateInput = document.getElementById("defaultBaseRate");
  const currentRateDisplay = document.getElementById("currentDefaultRate");
  const hoursRateDisplay = document.getElementById("currentDefaultRateDisplay");
  
  // Priority: 1. Provided rate, 2. localStorage, 3. Default to 0
  const finalRate = rate !== undefined ? rate : 
                   parseFloat(localStorage.getItem('userDefaultRate')) || 0;
  
  if (defaultRateInput) defaultRateInput.value = finalRate;
  if (currentRateDisplay) currentRateDisplay.textContent = fmtMoney(finalRate);
  if (hoursRateDisplay) hoursRateDisplay.textContent = fmtMoney(finalRate);
  
  console.log('💰 Default rate initialized:', finalRate, 'from source:', 
              rate !== undefined ? 'user profile' : 'localStorage');
}

async function applyDefaultRateToAll() {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError("Please log in to apply default rate");
    return;
  }

  const val = parseFloat(document.getElementById("defaultBaseRate")?.value) || 0;
  
  if (val <= 0) {
    NotificationSystem.notifyError("Please set a valid default rate first");
    return;
  }

  const confirmed = confirm(`This will update the rate for ALL students to $${fmtMoney(val)}. This action cannot be undone. Continue?`);
  
  if (confirmed) {
    const updateCount = await applyDefaultRateToAllStudents(user.uid, val);
    // No need to show notification here - it's handled in the function
  }
}

function useDefaultRate() {
  const val = parseFloat(document.getElementById("defaultBaseRate")?.value) || 0;
  const input = document.getElementById("studentBaseRate");
  if (input) input.value = fmtMoney(val);
}

function useDefaultRateInHours() {
  const defaultRateDisplay = document.getElementById("currentDefaultRateDisplay");
  const baseRateInput = document.getElementById("baseRate");
  if (defaultRateDisplay && baseRateInput) {
    baseRateInput.value = parseFloat(defaultRateDisplay.textContent) || 0;
  }
}

// ===========================
// HOURS MANAGEMENT FUNCTIONS - WITH PROPER EDIT/CANCEL/CLEAR
// ===========================

async function logHours() {
  const studentEl = document.getElementById("hoursStudent");
  const orgEl = document.getElementById("organization");
  const subjectEl = document.getElementById("workSubject");
  const typeEl = document.getElementById("workType");
  const dateEl = document.getElementById("workDate");
  const hoursEl = document.getElementById("hoursWorked");
  const rateEl = document.getElementById("baseRate");
  const notesEl = document.getElementById("workNotes"); // Add this if you have a notes field
  const totalDisplay = document.getElementById('totalPay'); // ADD THIS

  const studentId = studentEl?.value;
  const organization = orgEl?.value.trim();
  const subject = subjectEl?.value.trim();
  const workType = typeEl?.value || "hourly";
  const workDate = dateEl?.value;
  const hours = parseFloat(hoursEl?.value);
  const rate = parseFloat(rateEl?.value);
  const notes = notesEl?.value.trim() || '';

  if (!organization || !workDate || !Number.isFinite(rate) || rate <= 0) {
    NotificationSystem.notifyError("Please fill required fields: Organization, Date, Rate");
    return;
  }

  // For hourly work, require hours. For fixed work, hours are optional.
  if (workType === "hourly" && (!Number.isFinite(hours) || hours <= 0)) {
    NotificationSystem.notifyError("Please enter valid hours for hourly work");
    return;
  }

  // FIX: Get total from display instead of recalculating
  const totalText = totalDisplay?.textContent?.replace('$', '') || '0';
  const total = parseFloat(totalText);
  
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Show loading state
    const submitBtn = document.getElementById('hoursSubmitBtn');
    if (submitBtn) {
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;
    }

    const hoursData = {
      student: studentId || null,
      organization,
      subject: subject || null,
      workType,
      date: workDate,
      dateIso: fmtDateISO(workDate),
      hours: workType === "hourly" ? hours : (hours || 0),
      rate,
      total, // Now using the display value
      notes: notes || null,
      loggedAt: new Date().toISOString()
    };

    if (currentEditHoursId) {
      // Update existing hours
      const hoursRef = doc(db, "users", user.uid, "hours", currentEditHoursId);
      await updateDoc(hoursRef, hoursData);
      NotificationSystem.notifySuccess("Hours updated successfully");
    } else {
      // Add new hours
      await addDoc(collection(db, "users", user.uid, "hours"), hoursData);
      NotificationSystem.notifySuccess("Work logged successfully");
    }

    // Clear cache to force fresh data on next load
    cache.hours = null;
    cache.lastSync = null;
    console.log('🗑️ Cache cleared for hours');
    
    // CRITICAL: Reset form and button states IMMEDIATELY after successful save
    resetHoursForm();
    
    // Refresh data in background including hours tab stats
    Promise.all([
      renderRecentHours(),
      updateHoursTabStats(), // Update the weekly/monthly stats
      recalcSummaryStats(user.uid)
    ]).then(() => {
      console.log('✅ Background refresh completed with fresh hours data');
    }).catch(error => {
      console.error("Background refresh failed:", error);
    });

  } catch (err) {
    console.error("Error logging hours:", err);
    NotificationSystem.notifyError("Failed to log work");
    
    // Re-enable button on error but don't reset form
    const submitBtn = document.getElementById('hoursSubmitBtn');
    if (submitBtn) {
      submitBtn.textContent = currentEditHoursId ? '💾 Update Hours' : '💾 Log Hours';
      submitBtn.disabled = false;
    }
  }
}

async function editHours(hoursId) {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to edit hours');
    return;
  }

  try {
    console.log('✏️ Editing hours:', hoursId);
    
    // Show loading state immediately
    const submitBtn = document.getElementById('hoursSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Loading...';
    
    const hoursDoc = await getDoc(doc(db, "users", user.uid, "hours", hoursId));
    
    if (!hoursDoc.exists()) {
      NotificationSystem.notifyError('Hours entry not found');
      return;
    }

    const hours = hoursDoc.data();
    
    // Fill the form with hours data
    document.getElementById('hoursStudent').value = hours.student || '';
    document.getElementById('organization').value = hours.organization || '';
    document.getElementById('workSubject').value = hours.subject || '';
    document.getElementById('workType').value = hours.workType || 'hourly';
    document.getElementById('workDate').value = formatDateForInput(hours.dateIso || hours.date);
    document.getElementById('hoursWorked').value = hours.hours || '';
    document.getElementById('baseRate').value = hours.rate || '';
    // If you have notes field: document.getElementById('workNotes').value = hours.notes || '';

    // Set edit mode
    currentEditHoursId = hoursId;
    
    const submitBtnFinal = document.getElementById('hoursSubmitBtn');
    const cancelBtn = document.getElementById('hoursCancelBtn');
    
    if (submitBtnFinal) {
      submitBtnFinal.textContent = '💾 Update Hours';
      submitBtnFinal.onclick = logHours;
      submitBtnFinal.disabled = false;
    }
    
    if (cancelBtn) {
      cancelBtn.style.display = 'inline-flex';
    }

    // Update total display
    const total = hours.total || 0;
    const totalDisplay = document.getElementById('totalPay');
    if (totalDisplay) {
      totalDisplay.textContent = `$${fmtMoney(total)}`;
    }

    // Scroll to form immediately
    const hoursForm = document.querySelector('#hours .section-card:first-child');
    if (hoursForm) {
      hoursForm.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
    
    NotificationSystem.notifyInfo(`Editing work entry for ${hours.organization}`);
    
  } catch (error) {
    console.error('Error loading hours for edit:', error);
    NotificationSystem.notifyError('Failed to load work data');
    
    // Reset button on error
    const submitBtn = document.getElementById('hoursSubmitBtn');
    if (submitBtn) {
      submitBtn.textContent = '💾 Log Hours';
      submitBtn.onclick = logHours;
      submitBtn.disabled = false;
    }
  }
}

async function deleteHours(hoursId) {
  if (confirm("Are you sure you want to delete this hours entry? This action cannot be undone.")) {
    const user = auth.currentUser;
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "hours", hoursId));
        
        // Clear cache to force fresh data
        cache.hours = null;
        cache.lastSync = null;
        
        NotificationSystem.notifySuccess("Hours entry deleted successfully");
        
        // Refresh in background
        Promise.all([
          renderRecentHours(),
          recalcSummaryStats(user.uid)
        ]).then(() => {
          console.log('✅ Background refresh after deletion completed');
        }).catch(error => {
          console.error("Background refresh failed:", error);
        });
        
      } catch (error) {
        console.error("Error deleting hours:", error);
        NotificationSystem.notifyError("Failed to delete hours entry");
      }
    }
  }
}

// ENHANCED: Properly reset hours form and button states
function resetHoursForm() {
  console.log('🔄 Resetting hours form...');
  
  // Clear form fields
  const form = document.querySelector('#hours form');
  if (form) {
    form.reset();
  }
  
  // Reset specific fields to ensure clean state
  const fieldsToReset = {
    'organization': '',
    'workSubject': '',
    'hoursStudent': 0, // select index
    'workType': 0, // select index  
    'workDate': new Date().toISOString().split('T')[0],
    'hoursWorked': '',
    'baseRate': '',
    'workNotes': '' // Add this if you have notes
  };

  Object.keys(fieldsToReset).forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
      if (element.type === 'select-one') {
        element.selectedIndex = fieldsToReset[fieldId];
      } else {
        element.value = fieldsToReset[fieldId];
      }
    }
  });
  
  // Reset total display
  const totalDisplay = document.getElementById('totalPay');
  if (totalDisplay) {
    totalDisplay.textContent = '$0.00';
  }
  
  // CRITICAL FIX: Reset button states properly
  const submitBtn = document.getElementById('hoursSubmitBtn');
  const cancelBtn = document.getElementById('hoursCancelBtn');
  
  if (submitBtn) {
    submitBtn.textContent = '💾 Log Hours';
    submitBtn.onclick = logHours;
    submitBtn.disabled = false;
    console.log('✅ Submit button reset to "Log Hours"');
  }
  
  if (cancelBtn) {
    cancelBtn.style.display = 'none';
    console.log('✅ Cancel button hidden');
  }
  
  // Clear edit state
  currentEditHoursId = null;
  
  console.log("✅ Hours form completely reset to add mode");
}
// ===========================
// HOURS TAB STATS FUNCTIONS - UPDATED
// ===========================

async function updateHoursTabStats() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const hoursSnap = await getDocs(collection(db, "users", user.uid, "hours"));
    const rows = [];
    hoursSnap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    // Get current date range for weekly/monthly calculations
    const now = new Date();
    const startOfWeek = getStartOfWeek(now);
    const startOfMonth = getStartOfMonth(now);

    let weeklyHours = 0;
    let weeklyTotal = 0;
    let monthlyHours = 0;
    let monthlyTotal = 0;
    let totalHours = 0;
    let totalEarnings = 0;

    rows.forEach(entry => {
      const entryDate = new Date(entry.dateIso || entry.date || entry.loggedAt);
      const hours = safeNumber(entry.hours);
      const total = safeNumber(entry.total);

      totalHours += hours;
      totalEarnings += total;

      // Check if this entry is within current week
      if (entryDate >= startOfWeek) {
        weeklyHours += hours;
        weeklyTotal += total;
      }

      // Check if this entry is within current month
      if (entryDate >= startOfMonth) {
        monthlyHours += hours;
        monthlyTotal += total;
      }
    });

    // Update the stats display with your new HTML structure
    const weeklyHoursEl = document.getElementById('weeklyHours');
    const weeklyTotalEl = document.getElementById('weeklyTotal');
    const monthlyHoursEl = document.getElementById('monthlyHours');
    const monthlyTotalEl = document.getElementById('monthlyTotal');

    if (weeklyHoursEl) weeklyHoursEl.textContent = weeklyHours.toFixed(1);
    if (weeklyTotalEl) weeklyTotalEl.textContent = fmtMoney(weeklyTotal);
    if (monthlyHoursEl) monthlyHoursEl.textContent = monthlyHours.toFixed(1);
    if (monthlyTotalEl) monthlyTotalEl.textContent = fmtMoney(monthlyTotal);

    console.log('✅ Hours tab stats updated:', {
      weeklyHours,
      weeklyTotal,
      monthlyHours,
      monthlyTotal,
      totalHours,
      totalEarnings
    });

    updateUserFriendlyStats();
    updateGoalProgress();
    
  } catch (error) {
    console.error('❌ Error updating hours tab stats:', error);
  }
}

// Helper functions for date calculations
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ===========================
// FORM SUBMISSION FUNCTIONS
// ===========================

async function addStudent() {
  const nameEl = document.getElementById("studentName");
  const idEl = document.getElementById("studentId");
  const genderEl = document.getElementById("studentGender");
  const emailEl = document.getElementById("studentEmail");
  const phoneEl = document.getElementById("studentPhone");
  const rateEl = document.getElementById("studentBaseRate");

  const name = nameEl?.value.trim();
  const id = idEl?.value.trim();
  const gender = genderEl?.value;
  const email = emailEl?.value.trim();
  const phone = phoneEl?.value.trim();
  const rate = parseFloat(rateEl?.value) || 0;

  if (!name || !id || !gender) {
    NotificationSystem.notifyError("Please fill required fields: Name, ID, Gender");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError("Please log in to add students");
    return;
  }

  try {
    // Show loading state
    const submitBtn = document.querySelector('#studentForm button[type="button"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;
    }

    const student = { 
      name, 
      id, 
      gender, 
      email, 
      phone, 
      rate,
      createdAt: new Date().toISOString()
    };

    const studentRef = doc(db, "users", user.uid, "students", id);
    await setDoc(studentRef, student);
    
    // Clear cache to force fresh data on next load
    cache.students = null;
    cache.lastSync = null;
    console.log('🗑️ Cache cleared for students');
    
    // Clear form IMMEDIATELY after successful save
    clearStudentForm();
    
    NotificationSystem.notifySuccess("Student added successfully");
    
    // Refresh data in background (don't wait for it)
    Promise.all([
      renderStudents(), // This will now fetch fresh data due to cache clear
      loadStudentsForDropdowns(),
      recalcSummaryStats(user.uid)
    ]).then(() => {
      console.log('✅ Background refresh completed with fresh data');
    }).catch(error => {
      console.error("Background refresh failed:", error);
      // Don't show error to user for background tasks
    });

  } catch (err) {
    console.error("Error adding student:", err);
    
    if (err.code === 'already-exists' || err.message.includes('already exists')) {
      NotificationSystem.notifyError("A student with this ID already exists");
    } else {
      NotificationSystem.notifyError("Failed to add student");
    }
    
    // Re-enable button on error
    const submitBtn = document.querySelector('#studentForm button[type="button"]');
    if (submitBtn) {
      submitBtn.textContent = '➕ Add Student';
      submitBtn.disabled = false;
    }
  }
}

async function addMark() {
  const studentEl = document.getElementById("marksStudent");
  const subjectEl = document.getElementById("marksSubject");
  const topicEl = document.getElementById("marksTopic");
  const scoreEl = document.getElementById("marksScore");
  const maxEl = document.getElementById("marksMax");
  const dateEl = document.getElementById("marksDate");

  const student = studentEl?.value;
  const subject = subjectEl?.value.trim();
  const topic = topicEl?.value.trim();
  const score = parseFloat(scoreEl?.value);
  const maxScore = parseFloat(maxEl?.value);
  const date = dateEl?.value;

  if (!student || !subject || !Number.isFinite(score) || !Number.isFinite(maxScore) || !date) {
    NotificationSystem.notifyError("Please fill required fields: Student, Subject, Score, Max Score, Date");
    return;
  }

  if (score > maxScore) {
    NotificationSystem.notifyError("Score cannot be greater than maximum score");
    return;
  }

  const percentage = (score / maxScore) * 100;
  const grade = calculateGrade(percentage);

  const markData = {
    student,
    subject,
    topic: topic || "General",
    score,
    max: maxScore,
    percentage,
    grade,
    date,
    dateIso: fmtDateISO(date), // Timezone-aware date conversion
    recordedAt: new Date().toISOString()
  };

  const user = auth.currentUser;
  if (user) {
    try {
      await addDoc(collection(db, "users", user.uid, "marks"), markData);
      NotificationSystem.notifySuccess("Mark added successfully");
      resetMarksForm();
      await renderRecentMarks();
    } catch (err) {
      console.error("Error adding mark:", err);
      NotificationSystem.notifyError("Failed to add mark");
    }
  }
}

async function saveAttendance() {
  const dateEl = document.getElementById("attendanceDate");
  const subjectEl = document.getElementById("attendanceSubject");
  const topicEl = document.getElementById("attendanceTopic");

  const date = dateEl?.value;
  const subject = subjectEl?.value.trim();
  const topic = topicEl?.value.trim();

  if (!date || !subject) {
    NotificationSystem.notifyError("Please fill required fields: Date and Subject");
    return;
  }

  const presentStudents = [];
  document.querySelectorAll("#attendanceList input[type=checkbox]:checked")
    .forEach(cb => presentStudents.push(cb.value));

  if (presentStudents.length === 0) {
    NotificationSystem.notifyError("Please select at least one student");
    return;
  }

  const attendanceData = {
    date,
    dateIso: fmtDateISO(date),
    subject,
    topic: topic || "General",
    present: presentStudents,
    recordedAt: new Date().toISOString()
  };

  const user = auth.currentUser;
  if (!user) return;

  try {
    // Show loading state
    const saveBtn = document.querySelector('#attendance .button.primary');
    if (saveBtn) {
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;
    }

    if (currentEditAttendanceId) {
      // Update existing attendance
      const attendanceRef = doc(db, "users", user.uid, "attendance", currentEditAttendanceId);
      await updateDoc(attendanceRef, {
        ...attendanceData,
        updatedAt: new Date().toISOString()
      });
      NotificationSystem.notifySuccess("Attendance updated successfully");
    } else {
      // Add new attendance
      await addDoc(collection(db, "users", user.uid, "attendance"), attendanceData);
      NotificationSystem.notifySuccess("Attendance recorded successfully");
    }

    // Clear cache
    cache.attendance = null;
    cache.lastSync = null;
    
    // Reset form and button states
    clearAttendanceForm();
    cancelAttendanceEdit();
    
    // Refresh data
    await renderAttendanceRecent();

  } catch (err) {
    console.error("Error saving attendance:", err);
    NotificationSystem.notifyError("Failed to save attendance");
    
    // Re-enable button on error
    const saveBtn = document.querySelector('#attendance .button.primary');
    if (saveBtn) {
      saveBtn.textContent = currentEditAttendanceId ? '💾 Update Attendance' : '💾 Save Attendance';
      saveBtn.disabled = false;
    }
  }
}

async function recordPayment() {
  const studentEl = document.getElementById("paymentStudent");
  const amountEl = document.getElementById("paymentAmount");
  const dateEl = document.getElementById("paymentDate");
  const methodEl = document.getElementById("paymentMethod");

  const student = studentEl?.value;
  const amount = parseFloat(amountEl?.value);
  const date = dateEl?.value;
  const method = methodEl?.value;

  if (!student || !Number.isFinite(amount) || amount <= 0 || !date || !method) {
    NotificationSystem.notifyError("Please fill required fields: Student, Amount, Date, Method");
    return;
  }

  const paymentData = {
    student,
    amount,
    date,
    dateIso: fmtDateISO(date), // Timezone-aware date conversion
    method,
    recordedAt: new Date().toISOString()
  };

  const user = auth.currentUser;
  if (user) {
    try {
      await addDoc(collection(db, "users", user.uid, "payments"), paymentData);
      NotificationSystem.notifySuccess("Payment recorded successfully");
      resetPaymentForm();
      await renderPaymentActivity();
      await renderStudentBalances();
    } catch (err) {
      console.error("Error recording payment:", err);
      NotificationSystem.notifyError("Failed to record payment");
    }
  }
}

// ===========================
// STUDENT ACTIONS
// ===========================

// ===========================
// STUDENT EDITING FUNCTIONS
// ===========================

async function editStudent(studentId) {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('Please log in to edit students');
    return;
  }

  try {
    console.log('✏️ Editing student:', studentId);
    
    // Show loading state immediately
    const submitBtn = document.getElementById('studentSubmitBtn');
    const cancelBtn = document.getElementById('studentCancelBtn');
    if (submitBtn) submitBtn.textContent = 'Loading...';
    
    const studentDoc = await getDoc(doc(db, "users", user.uid, "students", studentId));
    
    if (!studentDoc.exists()) {
      NotificationSystem.notifyError('Student not found');
      return;
    }

    const student = studentDoc.data();
    
    // Fill the form with student data
    document.getElementById('studentName').value = student.name || '';
    document.getElementById('studentId').value = student.id || '';
    document.getElementById('studentGender').value = student.gender || '';
    document.getElementById('studentEmail').value = student.email || '';
    document.getElementById('studentPhone').value = student.phone || '';
    document.getElementById('studentBaseRate').value = student.rate || '';

    // Set edit mode
    currentEditStudentId = studentId;
    
    if (submitBtn) {
      submitBtn.textContent = '💾 Update Student';
      submitBtn.onclick = () => updateStudent(studentId);
    }
    
    if (cancelBtn) {
      cancelBtn.style.display = 'inline-flex';
    }

    // Scroll to form immediately
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
      studentForm.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
    
    NotificationSystem.notifyInfo(`Editing student: ${student.name}`);
    
  } catch (error) {
    console.error('Error loading student for edit:', error);
    NotificationSystem.notifyError('Failed to load student data');
    
    // Reset button on error
    const submitBtn = document.getElementById('studentSubmitBtn');
    if (submitBtn) {
      submitBtn.textContent = '➕ Add Student';
      submitBtn.onclick = addStudent;
    }
  }
}

function cancelEdit() {
  console.log('❌ Canceling edit...');
  
  currentEditStudentId = null;
  
  const submitBtn = document.getElementById('studentSubmitBtn');
  const cancelBtn = document.getElementById('studentCancelBtn');
  
  if (submitBtn) {
    submitBtn.textContent = '➕ Add Student';
    submitBtn.onclick = addStudent;
  }
  
  if (cancelBtn) {
    cancelBtn.style.display = 'none';
  }
  
  // Clear the form
  clearStudentForm();
  
  NotificationSystem.notifyInfo('Edit canceled');
}

async function updateStudent(studentId) {
  const nameEl = document.getElementById("studentName");
  const idEl = document.getElementById("studentId");
  const genderEl = document.getElementById("studentGender");
  const emailEl = document.getElementById("studentEmail");
  const phoneEl = document.getElementById("studentPhone");
  const rateEl = document.getElementById("studentBaseRate");

  const name = nameEl?.value.trim();
  const id = idEl?.value.trim();
  const gender = genderEl?.value;
  const email = emailEl?.value.trim();
  const phone = phoneEl?.value.trim();
  const rate = parseFloat(rateEl?.value) || 0;

  if (!name || !id || !gender) {
    NotificationSystem.notifyError("Please fill required fields: Name, ID, Gender");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError("Please log in to update students");
    return;
  }

  try {
    // Show loading state
    const submitBtn = document.getElementById('studentSubmitBtn');
    if (submitBtn) {
      submitBtn.textContent = 'Updating...';
      submitBtn.disabled = true;
    }

    const studentData = { 
      name, 
      id, 
      gender, 
      email, 
      phone, 
      rate,
      updatedAt: getLocalISODate()
    };

    const studentRef = doc(db, "users", user.uid, "students", studentId);
    await updateDoc(studentRef, studentData);
    
    // Clear cache
    cache.students = null;
    cache.lastSync = null;
    
    // Reset form to add mode
    clearStudentForm();
    
    NotificationSystem.notifySuccess("Student updated successfully");
    
    // Refresh data
    await Promise.all([
      renderStudents(),
      loadStudentsForDropdowns(),
      recalcSummaryStats(user.uid)
    ]);

  } catch (err) {
    console.error("Error updating student:", err);
    NotificationSystem.notifyError("Failed to update student");
    
    // Re-enable button on error
    const submitBtn = document.getElementById('studentSubmitBtn');
    if (submitBtn) {
      submitBtn.textContent = '💾 Update Student';
      submitBtn.disabled = false;
    }
  }
}

async function deleteStudent(studentId) {
  if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
    const user = auth.currentUser;
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "students", studentId));
        NotificationSystem.notifySuccess("Student deleted successfully");
        await renderStudents();
        await loadStudentsForDropdowns();
      } catch (error) {
        console.error("Error deleting student:", error);
        NotificationSystem.notifyError("Failed to delete student");
      }
    }
  }
}

// ===========================
// APP INITIALIZATION - ENHANCED
// ===========================

function initializeApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  UIManager.init();
  SyncBar.init();
  setupProfileModal();
  setupFloatingAddButton();
  setupStudentFormListeners();
  setupHoursFormListeners();
  setupPaymentFormListeners(); // This should work now
  setupReportTabListeners();   // This should work now
  updateHeaderStats();
  
  if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
  if (syncMessageLine) syncMessageLine.textContent = "Status: Connected";
  
  const user = auth.currentUser;
  if (user) {
    console.log('👤 User authenticated, loading data...');
    loadInitialData(user);
  }
  
  console.log('✅ WorkLog App Fully Initialized');
}

async function loadInitialData(user) {
  try {
    console.log('📥 Loading initial data for user:', user.uid);
    
    // Load critical data first
    await Promise.allSettled([
      loadUserProfile(user.uid),
      loadStudentsForDropdowns(),
      recalcSummaryStats(user.uid), // This will update everything
      updateHoursTabStats(),
      populateAttendanceStudentList() // NEW: Populate attendance list
    ]);
    
    // Then load visible content
    await renderStudents();
    
    // Force header stats update
    updateHeaderStats();
    
    console.log('✅ Initial data loaded successfully');
    
  } catch (error) {
    console.error('❌ Error loading initial data:', error);
  }
}

// ===========================
// AUTH STATE MANAGEMENT
// ===========================

document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ DOM fully loaded, setting up auth listener');
  
  onAuthStateChanged(auth, user => {
    if (user) {
      console.log("✅ User authenticated:", user.email);
      
      // Safe container access with null check
      const container = document.querySelector(".container");
      if (container && container.style) {
        container.style.display = "block";
        console.log('✅ Container displayed');
      } else {
        console.warn('⚠️ Container element not found or inaccessible');
      }
      
      // Safely initialize app
      if (typeof initializeApp === 'function') {
        try {
          initializeApp();
        } catch (error) {
          console.error('❌ Error initializing app:', error);
        }
      }
    } else {
      console.log("🚫 No user authenticated - redirecting to login");
      window.location.href = "auth.html";
    }
  });
});

// ===========================
// REPORT FUNCTIONS
// ===========================

async function showWeeklyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  const weeklyBody = document.getElementById('weeklyBody');
  if (!weeklyBody) return;

  weeklyBody.innerHTML = "";

  try {
    const snap = await getDocs(collection(db, "users", user.uid, "hours"));
    const rows = [];
    snap.forEach(d => rows.push(d.data()));

    // Group by approximate ISO week
    const groups = {};
    rows.forEach(r => {
      const d = new Date(r.date || r.dateIso || new Date().toISOString());
      const year = d.getFullYear();
      const tmp = new Date(d);
      tmp.setHours(0,0,0,0);
      const oneJan = new Date(year, 0, 1);
      const week = Math.ceil((((tmp - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
      const key = `${year}-W${String(week).padStart(2,"0")}`;
      if (!groups[key]) groups[key] = { hours: 0, earnings: 0, subjects: new Set() };
      groups[key].hours += safeNumber(r.hours);
      groups[key].earnings += safeNumber(r.total);
      if (r.subject) groups[key].subjects.add(r.subject);
    });

    const keys = Object.keys(groups).sort((a, b) => {
      const [ay, aw] = a.split("-W").map(Number);
      const [by, bw] = b.split("-W").map(Number);
      return by === ay ? bw - aw : by - ay;
    });

    if (keys.length === 0) {
      weeklyBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">No data available</td></tr>`;
      return;
    }

    keys.forEach(k => {
      const g = groups[k];
      const subjectsCount = g.subjects.size || 0;
      const net = g.earnings * 0.8;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${k}</td>
        <td>${safeNumber(g.hours).toFixed(1)}</td>
        <td>$${fmtMoney(g.earnings)}</td>
        <td>${subjectsCount}</td>
        <td>$${fmtMoney(net)}</td>
      `;
      weeklyBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error showing weekly breakdown:", error);
    weeklyBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">Error loading data</td></tr>`;
  }
}

async function showBiWeeklyBreakdown() {
  await showWeeklyBreakdown();
}

async function showMonthlyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  const weeklyBody = document.getElementById('weeklyBody');
  if (!weeklyBody) return;

  weeklyBody.innerHTML = "";

  try {
    const snap = await getDocs(collection(db, "users", user.uid, "hours"));
    const rows = [];
    snap.forEach(d => rows.push(d.data()));

    const groups = {};
    rows.forEach(r => {
      const d = new Date(r.date || r.dateIso || new Date().toISOString());
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!groups[key]) groups[key] = { hours: 0, earnings: 0, subjects: new Set() };
      groups[key].hours += safeNumber(r.hours);
      groups[key].earnings += safeNumber(r.total);
      if (r.subject) groups[key].subjects.add(r.subject);
    });

    const keys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    if (keys.length === 0) {
      weeklyBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">No data available</td></tr>`;
      return;
    }

    keys.forEach(k => {
      const g = groups[k];
      const subjectsCount = g.subjects.size || 0;
      const net = g.earnings * 0.8;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${k}</td>
        <td>${safeNumber(g.hours).toFixed(1)}</td>
        <td>$${fmtMoney(g.earnings)}</td>
        <td>${subjectsCount}</td>
        <td>$${fmtMoney(net)}</td>
      `;
      weeklyBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error showing monthly breakdown:", error);
    weeklyBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">Error loading data</td></tr>`;
  }
}

async function showSubjectBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  const subjectBody = document.getElementById('subjectBody');
  if (!subjectBody) return;

  subjectBody.innerHTML = "";

  try {
    const marksSnap = await getDocs(collection(db, "users", user.uid, "marks"));
    const hoursSnap = await getDocs(collection(db, "users", user.uid, "hours"));

    const bySubject = {};

    marksSnap.forEach(d => {
      const r = d.data();
      const subj = r.subject?.trim() || "Unknown";
      if (!bySubject[subj]) bySubject[subj] = { marks: [], hours: 0, earnings: 0, sessions: 0 };
      bySubject[subj].marks.push(safeNumber(r.percentage));
    });

    hoursSnap.forEach(d => {
      const r = d.data();
      const subj = r.subject?.trim() || "General";
      if (!bySubject[subj]) bySubject[subj] = { marks: [], hours: 0, earnings: 0, sessions: 0 };
      bySubject[subj].hours += safeNumber(r.hours);
      bySubject[subj].earnings += safeNumber(r.total);
      bySubject[subj].sessions += 1;
    });

    const keys = Object.keys(bySubject).sort();
    if (keys.length === 0) {
      subjectBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">No data available</td></tr>`;
      return;
    }

    keys.forEach(subj => {
      const g = bySubject[subj];
      const avgMark = g.marks.length ? (g.marks.reduce((s, v) => s + v, 0) / g.marks.length) : 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${subj}</td>
        <td>${avgMark.toFixed(1)}%</td>
        <td>${safeNumber(g.hours).toFixed(1)}</td>
        <td>$${fmtMoney(g.earnings)}</td>
        <td>${g.sessions}</td>
      `;
      subjectBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error showing subject breakdown:", error);
    subjectBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">Error loading data</td></tr>`;
  }
}

// ===========================
// GLOBAL FUNCTION EXPORTS - ENHANCED
// ===========================

window.addStudent = addStudent;
window.clearStudentForm = clearStudentForm;
window.saveDefaultRate = saveDefaultRate;
window.applyDefaultRateToAll = applyDefaultRateToAll;
window.useDefaultRate = useDefaultRate;

window.logHours = logHours;
window.resetHoursForm = resetHoursForm;
window.useDefaultRateInHours = useDefaultRateInHours;

// NEW: Hours edit/delete functions
window.editHours = editHours;
window.deleteHours = deleteHours;
window.cancelHoursEdit = cancelHoursEdit;

window.addMark = addMark;
window.resetMarksForm = resetMarksForm;
window.updateMarksPercentage = updateMarksPercentage;

window.saveAttendance = saveAttendance;
window.clearAttendanceForm = clearAttendanceForm;
window.selectAllStudents = selectAllStudents;
window.deselectAllStudents = deselectAllStudents;

window.recordPayment = recordPayment;
window.resetPaymentForm = resetPaymentForm;

window.showWeeklyBreakdown = showWeeklyBreakdown;
window.showBiWeeklyBreakdown = showBiWeeklyBreakdown;
window.showMonthlyBreakdown = showMonthlyBreakdown;
window.showSubjectBreakdown = showSubjectBreakdown;
window.renderOverviewReports = renderOverviewReports;

// Student actions
window.editStudent = editStudent;
window.deleteStudent = deleteStudent;
window.cancelEdit = cancelEdit;

// Add this to your global exports for debugging
window.debugTimezone = debugTimezone;

// Expose NotificationSystem for global access
window.NotificationSystem = NotificationSystem;

// Sync bar functions for global access
window.performSync = (mode = 'manual') => SyncBar.performSync(mode);

// Manual tab system initialization
function initTabsManually() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tabcontent');
  
  console.log('Found tabs:', tabs.length);
  console.log('Found tab contents:', tabContents.length);
  
  tabs.forEach(tab => {
    // Remove any existing listeners
    const newTab = tab.cloneNode(true);
    tab.parentNode.replaceChild(newTab, tab);
    
    // Add click listener
    newTab.addEventListener('click', function() {
      const target = this.getAttribute('data-tab');
      console.log('Clicked tab:', target);
      
      // Hide all tab contents
      tabContents.forEach(tc => {
        tc.style.display = 'none';
        tc.classList.remove('active');
      });
      
      // Deactivate all tabs
      tabs.forEach(t => t.classList.remove('active'));
      
      // Activate clicked tab
      this.classList.add('active');
      const targetContent = document.getElementById(target);
      if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active');
        console.log('✅ Showing tab:', target);
      } else {
        console.log('❌ Tab content not found:', target);
      }
    });
  });
  
  console.log('✅ Manual tab initialization complete');
}

initTabsManually();
