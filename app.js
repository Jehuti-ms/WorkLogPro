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

function fmtDateISO(yyyyMmDd) {
  if (!yyyyMmDd) return new Date().toISOString();
  try {
    const d = new Date(yyyyMmDd);
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Never';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
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
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      currentUserData = { uid, ...userSnap.data() };
      console.log('✅ User profile loaded:', currentUserData);
      
      // Update profile button with user info
      updateProfileButton(currentUserData);
      
      // Initialize default rate from user profile (this takes priority)
      initializeDefaultRate(currentUserData.defaultRate);
      
      return currentUserData;
    } else {
      // Create new user profile - try to use localStorage rate if available
      const savedRate = parseFloat(localStorage.getItem('userDefaultRate')) || 0;
      const defaultProfile = {
        email: auth.currentUser?.email || '',
        createdAt: new Date().toISOString(),
        defaultRate: savedRate,
        lastLogin: new Date().toISOString()
      };
      
      await setDoc(userRef, defaultProfile);
      currentUserData = { uid, ...defaultProfile };
      console.log('✅ New user profile created with rate:', savedRate);
      
      updateProfileButton(currentUserData);
      initializeDefaultRate(savedRate);
      
      return currentUserData;
    }
  } catch (err) {
    console.error("❌ Error loading user profile:", err);
    
    // Fallback: use localStorage rate
    const fallbackRate = parseFloat(localStorage.getItem('userDefaultRate')) || 0;
    initializeDefaultRate(fallbackRate);
    
    return null;
  }
}

function updateProfileButton(userData) {
  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) {
    const email = userData?.email || auth.currentUser?.email || 'User';
    const displayName = email.split('@')[0];
    
    // Update both the button text and the userName span
    profileBtn.innerHTML = `👤 ${displayName}`;
    
    // Also update the userName span if it exists separately
    const userNameSpan = document.getElementById('userName');
    if (userNameSpan) {
      userNameSpan.textContent = displayName;
    }
    
    profileBtn.title = `Logged in as ${email}`;
    console.log('✅ Profile button updated for:', displayName);
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
  console.log('Profile button:', profileBtn);
  console.log('Profile modal:', profileModal);

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
      console.log('📱 Profile modal opened');
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
    console.log('📱 Profile modal closed');
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
    if (profileUserSince) profileUserSince.textContent = formatDate(currentUserData.createdAt);
    if (profileDefaultRate) profileDefaultRate.textContent = `$${fmtMoney(currentUserData.defaultRate || 0)}/hour`;
  }

  // Update stats in modal
  const mainStatStudents = document.getElementById('statStudents');
  const mainStatHours = document.getElementById('statHours');
  const mainStatEarnings = document.getElementById('statEarnings');
  const mainStatUpdated = document.getElementById('statUpdated');

  if (modalStatStudents && mainStatStudents) modalStatStudents.textContent = mainStatStudents.textContent;
  if (modalStatHours && mainStatHours) modalStatHours.textContent = mainStatHours.textContent;
  if (modalStatEarnings && mainStatEarnings) modalStatEarnings.textContent = mainStatEarnings.textContent;
  if (modalStatUpdated && mainStatUpdated) modalStatUpdated.textContent = mainStatUpdated.textContent;
}

// ===========================
// FLOATING ADD BUTTON
// ===========================

function setupFloatingAddButton() {
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');

  console.log('🔧 Setting up FAB...');
  console.log('FAB element:', fab);
  console.log('FAB menu:', fabMenu);
  console.log('FAB overlay:', fabOverlay);

  if (!fab) {
    console.error('❌ FAB not found!');
    return;
  }

  // Initialize state
  fab.setAttribute('data-expanded', 'false');

  // Click handler for main FAB button
  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = fab.getAttribute('data-expanded') === 'true';
    console.log('🎯 FAB clicked, current state:', isExpanded);
    
    if (isExpanded) {
      // Close menu
      fab.setAttribute('data-expanded', 'false');
      if (fabMenu) {
        fabMenu.classList.remove('show');
        console.log('📱 FAB menu closed');
      }
      if (fabOverlay) {
        fabOverlay.style.display = 'none';
      }
    } else {
      // Open menu
      fab.setAttribute('data-expanded', 'true');
      if (fabMenu) {
        fabMenu.classList.add('show');
        console.log('📱 FAB menu opened');
      }
      if (fabOverlay) {
        fabOverlay.style.display = 'block';
      }
    }
  });

  // Close menu when clicking on overlay
  if (fabOverlay) {
    fabOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      fab.setAttribute('data-expanded', 'false');
      if (fabMenu) fabMenu.classList.remove('show');
      fabOverlay.style.display = 'none';
      console.log('📱 FAB closed via overlay');
    });
  }

  // Setup quick action buttons
  const quickActions = {
    'fabAddStudent': () => {
      console.log('🎯 FAB: Add Student clicked');
      const studentTab = document.querySelector('[data-tab="students"]');
      if (studentTab) {
        studentTab.click();
        setTimeout(() => {
          const form = document.getElementById('studentForm');
          if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log('📱 Scrolled to student form');
          }
        }, 300);
      }
    },
    'fabAddHours': () => {
      console.log('🎯 FAB: Add Hours clicked');
      const hoursTab = document.querySelector('[data-tab="hours"]');
      if (hoursTab) {
        hoursTab.click();
        setTimeout(() => {
          const form = document.getElementById('hoursForm');
          if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log('📱 Scrolled to hours form');
          }
        }, 300);
      }
    },
    'fabAddMark': () => {
      console.log('🎯 FAB: Add Mark clicked');
      const marksTab = document.querySelector('[data-tab="marks"]');
      if (marksTab) {
        marksTab.click();
        setTimeout(() => {
          const form = document.getElementById('marksForm');
          if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log('📱 Scrolled to marks form');
          }
        }, 300);
      }
    },
    'fabAddAttendance': () => {
      console.log('🎯 FAB: Add Attendance clicked');
      const attendanceTab = document.querySelector('[data-tab="attendance"]');
      if (attendanceTab) {
        attendanceTab.click();
        setTimeout(() => {
          const form = document.getElementById('attendanceForm');
          if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log('📱 Scrolled to attendance form');
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
        
        // Close FAB menu
        fab.setAttribute('data-expanded', 'false');
        if (fabMenu) fabMenu.classList.remove('show');
        if (fabOverlay) fabOverlay.style.display = 'none';
      });
    } else {
      console.error(`❌ FAB action button not found: ${btnId}`);
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (fab.getAttribute('data-expanded') === 'true') {
      if (!fab.contains(e.target) && (!fabMenu || !fabMenu.contains(e.target))) {
        fab.setAttribute('data-expanded', 'false');
        if (fabMenu) fabMenu.classList.remove('show');
        if (fabOverlay) fabOverlay.style.display = 'none';
        console.log('📱 FAB closed via outside click');
      }
    }
  });

  console.log('✅ FAB setup completed');
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

    if (newStats.students !== undefined && document.getElementById('statStudents')) {
      document.getElementById('statStudents').textContent = newStats.students;
    }
    if (newStats.hours !== undefined && document.getElementById('statHours')) {
      document.getElementById('statHours').textContent = newStats.hours;
    }
    if (newStats.earnings !== undefined && document.getElementById('statEarnings')) {
      document.getElementById('statEarnings').textContent = fmtMoney(newStats.earnings);
    }
    if (newStats.lastSync !== undefined && document.getElementById('statUpdated')) {
      document.getElementById('statUpdated').textContent = newStats.lastSync;
    }

    refreshTimestamp();
  } catch (err) {
    console.error("❌ Error updating stats:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to update stats";
  }
}

async function recalcSummaryStats(uid) {
  try {
    console.log('🔄 Recalculating summary stats for:', uid);
    
    const studentsSnap = await getDocs(collection(db, "users", uid, "students"));
    const hoursSnap = await getDocs(collection(db, "users", uid, "hours"));

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

    console.log('✅ Summary stats recalculated successfully');
  } catch (err) {
    console.error("❌ Error recalculating stats:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to recalc stats";
  }
}

// Add this debug function
async function debugDataLoad() {
  const user = auth.currentUser;
  if (!user) return;
  
  console.log('🔍 DEBUG: Checking data load...');
  
  // Check if students exist
  const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
  console.log('🔍 DEBUG: Students count:', studentsSnap.size);
  studentsSnap.forEach(doc => {
    console.log('🔍 DEBUG: Student:', doc.id, doc.data());
  });
  
  // Check user stats
  const statsRef = doc(db, "users", user.uid);
  const statsSnap = await getDoc(statsRef);
  console.log('🔍 DEBUG: Stats exist:', statsSnap.exists());
  if (statsSnap.exists()) {
    console.log('🔍 DEBUG: Stats data:', statsSnap.data());
  }
  
  // Check user profile
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  console.log('🔍 DEBUG: User profile exist:', userSnap.exists());
  if (userSnap.exists()) {
    console.log('🔍 DEBUG: User data:', userSnap.data());
  }
}
// Call this in initializeApp after loadInitialData

// ===========================
// DATA RENDERING FUNCTIONS
// ===========================

async function renderStudents() {
  const user = auth.currentUser;
  if (!user) return;

  const container = document.getElementById('studentsContainer');
  if (!container) return;
  
  container.innerHTML = '<div class="loading">Loading students...</div>';

  try {
    const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
    
    if (studentsSnap.size === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Students Yet</h3>
          <p>Add your first student to get started</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    
    studentsSnap.forEach(docSnap => {
      const student = { id: docSnap.id, ...docSnap.data() };
      
      const card = document.createElement("div");
      card.className = "student-card";
      card.innerHTML = `
        <div class="student-card-header">
          <div>
            <strong>${student.name}</strong>
            <span class="student-id">${student.id}</span>
          </div>
          <div class="student-actions">
            <button class="btn-icon" onclick="editStudent('${student.id}')" title="Edit">
              ✏️
            </button>
            <button class="btn-icon" onclick="deleteStudent('${student.id}')" title="Delete">
              🗑️
            </button>
          </div>
        </div>
        <div class="student-details">
          <div class="muted">${student.gender} • ${student.email || 'No email'} • ${student.phone || 'No phone'}</div>
          <div class="student-rate">Rate: $${fmtMoney(student.rate)}/session</div>
          <div class="student-meta">Added: ${formatDate(student.createdAt)}</div>
        </div>
      `;
      container.appendChild(card);
    });

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

  container.innerHTML = '<div class="loading">Loading recent hours...</div>';

  try {
    const hoursQuery = query(
      collection(db, "users", user.uid, "hours"),
      orderBy("dateIso", "desc")
    );
    
    const snap = await getDocs(hoursQuery);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Hours Logged</h3>
          <p>Log your first work session to get started</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    rows.slice(0, limit).forEach(entry => {
      const item = document.createElement("div");
      item.className = "hours-entry";
      item.innerHTML = `
        <div class="hours-header">
          <strong>${entry.organization}</strong>
          <span class="hours-type">${entry.workType}</span>
        </div>
        <div class="muted">${formatDate(entry.date)} • ${entry.subject || 'General'}</div>
        <div class="hours-details">
          <span>Hours: ${safeNumber(entry.hours)}</span>
          <span>Rate: $${fmtMoney(entry.rate)}</span>
          <span class="hours-total">Total: $${fmtMoney(entry.total)}</span>
        </div>
        ${entry.student ? `<div class="muted">Student: ${entry.student}</div>` : ''}
      `;
      container.appendChild(item);
    });

  } catch (error) {
    console.error("Error rendering hours:", error);
    container.innerHTML = '<div class="error">Error loading hours</div>';
  }
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
      return;
    }

    container.innerHTML = '';
    rows.slice(0, limit).forEach(entry => {
      const item = document.createElement("div");
      item.className = "attendance-entry";
      item.innerHTML = `
        <div><strong>${entry.subject}</strong> — ${entry.topic || "—"}</div>
        <div class="muted">${formatDate(entry.date)}</div>
        <div>Present: ${Array.isArray(entry.present) ? entry.present.length : 0} students</div>
      `;
      container.appendChild(item);
    });

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
      paymentsByStudent[sid] = (payningsByStudent[sid] || 0) + safeNumber(row.amount);
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

  setupAutoSyncToggle: function() {  // Use function expression
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
        SyncBar.startAutoSync(); // Use SyncBar directly instead of this
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
          SyncBar.startAutoSync(); // Use SyncBar directly
          NotificationSystem.notifySuccess('Auto-sync enabled - syncing every 60 seconds');
        } else {
          autoSyncText.textContent = 'Manual';
          if (syncIndicator) {
            syncIndicator.style.backgroundColor = '#ef4444';
            syncIndicator.classList.remove('sync-connected');
          }
          SyncBar.stopAutoSync(); // Use SyncBar directly
          NotificationSystem.notifyInfo('Auto-sync disabled');
        }
      });
    }
  },

  startAutoSync: function() {
    SyncBar.stopAutoSync(); // Use SyncBar directly
    SyncBar.performSync('auto'); // Use SyncBar directly
    autoSyncInterval = setInterval(() => SyncBar.performSync('auto'), 60000);
  },

  stopAutoSync: function() {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval);
      autoSyncInterval = null;
    }
  },

  // ... rest of your SyncBar methods
};

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
          NotificationSystem.notifyInfo('Syncing statistics...');
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
    this.initEventListeners();
    console.log('✅ UI Manager initialized');
  },

  initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
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

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');

        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.style.display = 'none');

        tab.classList.add('active');

        const selected = document.getElementById(target);
        if (selected) {
          selected.style.display = 'block';
          console.log(`📑 Switched to ${target} tab`);
        }
      });
    });

    const firstActive = document.querySelector('.tab.active');
    if (firstActive) {
      const target = firstActive.getAttribute('data-tab');
      const selected = document.getElementById(target);
      if (selected) selected.style.display = 'block';
    }
    
    console.log('✅ Tabs initialized');
  },

  bindUiEvents() {
    console.log('🔧 Binding UI events...');
    
    const themeToggle = document.querySelector('.theme-toggle button');
    if (themeToggle) {
      themeToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleTheme();
      });
    }
    
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      form.addEventListener('submit', (e) => e.preventDefault());
    });
    
    this.setupHoursFormCalculations();
    this.setupMarksFormCalculations();
    
    console.log('✅ UI events bound');
  },

  setupHoursFormCalculations() {
    const hoursInput = document.getElementById('hoursWorked');
    const rateInput = document.getElementById('baseRate');
    const workTypeSelect = document.getElementById('workType');
    
    const calculateTotal = () => {
      const hours = parseFloat(hoursInput?.value) || 0;
      const rate = parseFloat(rateInput?.value) || 0;
      const workType = workTypeSelect?.value || "hourly";
      const totalEl = document.getElementById('totalPay');
      
      if (totalEl) {
        const total = workType === "hourly" ? hours * rate : rate;
        if ("value" in totalEl) {
          totalEl.value = fmtMoney(total);
        } else {
          totalEl.textContent = fmtMoney(total);
        }
      }
    };

    if (hoursInput) hoursInput.addEventListener('input', calculateTotal);
    if (rateInput) rateInput.addEventListener('input', calculateTotal);
    if (workTypeSelect) workTypeSelect.addEventListener('change', calculateTotal);
  },

  setupMarksFormCalculations() {
    const scoreInput = document.getElementById('marksScore');
    const maxInput = document.getElementById('marksMax');
    if (scoreInput) scoreInput.addEventListener('input', updateMarksPercentage);
    if (maxInput) maxInput.addEventListener('input', updateMarksPercentage);
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
};

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

// ===========================
// FORM MANAGEMENT FUNCTIONS
// ===========================

function clearStudentForm() {
  const form = document.getElementById("studentForm");
  if (form) form.reset();
}

function resetHoursForm() {
  const form = document.getElementById("hoursForm");
  if (form) {
    form.reset();
    console.log("✅ Hours form reset");
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
  const dateEl = document.getElementById("attendanceDate");
  const subjectEl = document.getElementById("attendanceSubject");
  const topicEl = document.getElementById("attendanceTopic");

  if (dateEl) dateEl.value = "";
  if (subjectEl) subjectEl.value = "";
  if (topicEl) topicEl.value = "";

  document.querySelectorAll("#attendanceList input[type=checkbox]")
    .forEach(cb => cb.checked = false);
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

  const student = { 
    name, 
    id, 
    gender, 
    email, 
    phone, 
    rate,
    createdAt: new Date().toISOString()
  };

  const user = auth.currentUser;
  if (user) {
    try {
      const studentRef = doc(db, "users", user.uid, "students", id);
      await setDoc(studentRef, student);
      
      NotificationSystem.notifySuccess("Student added successfully");
      clearStudentForm();
      await renderStudents();
      await loadStudentsForDropdowns();

    } catch (err) {
      console.error("Error adding student:", err);
      NotificationSystem.notifyError("Failed to add student");
    }
  }
}

async function logHours() {
  const studentEl = document.getElementById("hoursStudent");
  const orgEl = document.getElementById("organization");
  const typeEl = document.getElementById("workType");
  const dateEl = document.getElementById("workDate");
  const hoursEl = document.getElementById("hoursWorked");
  const rateEl = document.getElementById("baseRate");

  const studentId = studentEl?.value;
  const organization = orgEl?.value.trim();
  const workType = typeEl?.value || "hourly";
  const workDate = dateEl?.value;
  const hours = parseFloat(hoursEl?.value);
  const rate = parseFloat(rateEl?.value);

  if (!organization || !workDate || !Number.isFinite(hours) || hours <= 0 || !Number.isFinite(rate) || rate <= 0) {
    NotificationSystem.notifyError("Please fill required fields: Organization, Date, Hours, Rate");
    return;
  }

  const total = workType === "hourly" ? hours * rate : rate;
  
  const user = auth.currentUser;
  if (!user) return;

  try {
    const hoursData = {
      student: studentId || null,
      organization,
      workType,
      date: workDate,
      dateIso: fmtDateISO(workDate),
      hours,
      rate,
      total,
      loggedAt: new Date().toISOString()
    };

    await addDoc(collection(db, "users", user.uid, "hours"), hoursData);
    
    NotificationSystem.notifySuccess("Hours logged successfully");
    await recalcSummaryStats(user.uid);
    await renderRecentHours();
    resetHoursForm();
    
  } catch (err) {
    console.error("Error logging hours:", err);
    NotificationSystem.notifyError("Failed to log hours");
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
    dateIso: fmtDateISO(date),
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
  if (user) {
    try {
      await addDoc(collection(db, "users", user.uid, "attendance"), attendanceData);
      NotificationSystem.notifySuccess("Attendance recorded successfully");
      clearAttendanceForm();
      await renderAttendanceRecent();
    } catch (err) {
      console.error("Error saving attendance:", err);
      NotificationSystem.notifyError("Failed to save attendance");
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
    dateIso: fmtDateISO(date),
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

async function editStudent(studentId) {
  NotificationSystem.notifyInfo("Edit student feature coming soon");
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
// APP INITIALIZATION
// ===========================

function initializeApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  UIManager.init();
  SyncBar.init();
  setupProfileModal();
  setupFloatingAddButton();
  
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
    
    // Load user profile first
    await loadUserProfile(user.uid);
    
    // Recalculate stats FIRST to ensure they're current
    await recalcSummaryStats(user.uid);
    
    // Then load all other data with fresh stats
    await Promise.all([
      loadUserStats(user.uid), // This will now show updated stats
      loadStudentsForDropdowns(),
      renderStudents(),
      renderRecentHours(),
      renderRecentMarks(),
      renderAttendanceRecent(),
      renderPaymentActivity(),
      renderStudentBalances(),
      renderOverviewReports()
    ]);
    
    console.log('✅ Initial data loaded successfully');
    
  } catch (error) {
    console.error('❌ Error loading initial data:', error);
    NotificationSystem.notifyError('Error loading data');
  }
}

// ===========================
// AUTH STATE MANAGEMENT
// ===========================

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('✅ User authenticated:', user.email);
    document.querySelector(".container").style.display = "block";
    
    if (typeof initializeApp === 'function') {
      loadInitialData(user);
    }
  } else {
    console.log('🚫 No user authenticated - redirecting to login');
    window.location.href = "auth.html";
  }
});

// ===========================
// BOOT THE APPLICATION
// ===========================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

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
  // Simple approach: reuse weekly
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
// GLOBAL FUNCTION EXPORTS
// ===========================

window.addStudent = addStudent;
window.clearStudentForm = clearStudentForm;
window.saveDefaultRate = saveDefaultRate;
window.applyDefaultRateToAll = applyDefaultRateToAll;
window.useDefaultRate = useDefaultRate;

window.logHours = logHours;
window.resetHoursForm = resetHoursForm;
window.useDefaultRateInHours = useDefaultRateInHours;

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

// Expose NotificationSystem for global access
window.NotificationSystem = NotificationSystem;

// Student actions
window.editStudent = editStudent;
window.deleteStudent = deleteStudent;

// Sync bar functions for global access
window.performSync = (mode = 'manual') => SyncBar.performSync(mode);
