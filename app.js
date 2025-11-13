// app.js - COMPLETE FILE WITH CLOUD SYNC INTEGRATION
import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const authButton = document.getElementById("authButton");
const userMenu = document.getElementById("userMenu");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const profileBtn = document.getElementById("profileBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Toggle profile menu
profileBtn.addEventListener("click", () => {
  userMenu.style.display = userMenu.style.display === "block" ? "none" : "block";
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  console.log("✅ User signed out");
  window.location.href = "auth.html";
});

// Update profile info when auth state changes
onAuthStateChanged(auth, user => {
  if (user) {
    authButton.style.display = "none";
    userMenu.style.display = "block";
    userName.textContent = user.displayName || "Staff Member";
    userEmail.textContent = user.email;
  } else {
    authButton.style.display = "inline-block";
    userMenu.style.display = "none";
  }
});

/* ============================================================================
   Global state
============================================================================ */
let appData = {
  students: [],
  hours: [],
  marks: [],
  attendance: [],
  payments: [],
  settings: {
    defaultRate: 25.0
  }
};

let allPayments = [];
let isEditingAttendance = false;
let editingHoursIndex = null;
window.hoursEntries = [];

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

let currentTab = "dashboard";

/* ============================================================================
   Initialization
============================================================================ */
async function init() {
  console.log("🎯 App initialization started");

  try {
    // Initialize Firebase manager (modular import)
    const firebaseReady = await initFirebaseManager();
    if (firebaseReady) {
      console.log("✅ Firebase manager ready");
    } else {
      console.warn("⚠️ Firebase manager not ready, running in offline mode");
    }

    // Load data - try Firebase first, then fallback to local
    await loadAllData();

    // Setup cloud sync UI
    setupCloudSyncUI();

    // Tabs and events
    setupTabs();
    setupEventListeners();

    // Settings
    loadDefaultRate();

    // Initial stats render
    renderStudents();
    updateStats();

    console.log("✅ App initialized successfully");
    
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    console.log("🔄 Falling back to local mode...");

    // Fallback sequence
    await loadAllData();
    setupCloudSyncUI();
    setupTabs();
    setupEventListeners();
    loadDefaultRate();
    renderStudents();
    updateStats();
  }
}

/* ============================================================================
   Data loading and settings
============================================================================ */
async function loadAllData() {
  try {
    let loadedData = null;

    // Try to load from Firebase first (if user is authenticated)
    if (typeof firebaseManager !== 'undefined' && firebaseManager.isCloudEnabled && firebaseManager.isCloudEnabled()) {
      console.log("📥 Attempting to load data from Firebase...");
      loadedData = await firebaseManager.loadData();
    }

    if (loadedData) {
      // Use Firebase data
      console.log("✅ Data loaded from Firebase");
      Object.assign(appData, loadedData);
    } else {
      // Fallback to local storage
      console.log("📥 Loading from local storage...");
      const stored = JSON.parse(localStorage.getItem("appData")) || null;
      if (stored && typeof stored === "object") {
        Object.assign(appData, stored);
      }
    }

    // Initialize payments single source of truth
    allPayments = Array.isArray(appData.payments) ? appData.payments.slice() : [];

    // Ensure all arrays exist
    if (!Array.isArray(appData.students)) appData.students = [];
    if (!Array.isArray(appData.hours)) appData.hours = [];
    if (!Array.isArray(appData.marks)) appData.marks = [];
    if (!Array.isArray(appData.attendance)) appData.attendance = [];
    if (!appData.settings) appData.settings = { defaultRate: 25.0 };

    console.log("📥 Data loaded:", {
      students: appData.students.length,
      payments: allPayments.length,
      defaultRate: appData.settings.defaultRate
    });

  } catch (err) {
    console.warn("⚠️ Failed to load data:", err);
    // Initialize with empty data
    initializeEmptyData();
  }
}

async function saveAllData() {
  try {
    // Keep appData.payments in sync with allPayments before save
    appData.payments = Array.isArray(allPayments) ? allPayments.slice() : [];

    // Save to Firebase if available
    if (typeof firebaseManager !== 'undefined' && firebaseManager.isCloudEnabled && firebaseManager.isCloudEnabled()) {
      await firebaseManager.saveData(appData);
      console.log("💾 Data saved to Firebase");
    } else {
      // Fallback to local storage
      localStorage.setItem("appData", JSON.stringify(appData));
      console.log("💾 Data saved locally");
    }
  } catch (err) {
    console.warn("⚠️ Failed to save data:", err);
    // Fallback to local storage
    localStorage.setItem("appData", JSON.stringify(appData));
  }
}

// Enhanced save function that includes cloud sync
async function saveAllDataWithSync() {
  try {
    // Always save locally first
    await saveAllData();
    
    // Try to sync to cloud if available
    if (typeof firebaseManager !== 'undefined' && firebaseManager.isCloudEnabled && firebaseManager.isCloudEnabled()) {
      await firebaseManager.saveData(appData);
    }
  } catch (error) {
    console.warn("Cloud sync failed, but local save succeeded:", error);
  }
}

function initializeEmptyData() {
  appData.students = [];
  appData.hours = [];
  appData.marks = [];
  appData.attendance = [];
  appData.payments = [];
  appData.settings = { defaultRate: 25.0 };
  allPayments = [];
}

function loadDefaultRate() {
  // Ensure we have a valid default rate
  if (typeof appData.settings.defaultRate !== 'number' || isNaN(appData.settings.defaultRate)) {
    appData.settings.defaultRate = 25.0;
    console.log("🔄 Reset default rate to $25.00");
  }
  
  const rateEl = document.getElementById("defaultRateDisplay");
  if (rateEl) {
    rateEl.textContent = `$${appData.settings.defaultRate.toFixed(2)}/hr`;
  }
}

/* ============================================================================
   Cloud Sync Integration
============================================================================ */
function setupCloudSyncUI() {
  const syncBar = document.querySelector('.sync-bar');
  if (!syncBar) return;

  const cloudSection = document.createElement('div');
  cloudSection.className = 'cloud-sync-section';
  cloudSection.innerHTML = `
    <div id="syncStatus" class="sync-status offline">🔴 Offline</div>
    <div id="cloudControls" style="display: none;">
      <button id="backupBtn" class="btn btn-sm btn-success" title="Backup to cloud">
        💾 Backup Now
      </button>
      <button id="disableBtn" class="btn btn-sm btn-secondary" title="Disable cloud backup">
        ☁️ Disable
      </button>
    </div>
    <div id="cloudPrompt" style="display: none;">
      <button id="enableBtn" class="btn btn-sm btn-primary">
        Enable Cloud Backup
      </button>
    </div>
  `;

  syncBar.appendChild(cloudSection);

  // Wire buttons explicitly
  document.getElementById("backupBtn").addEventListener("click", () => {
    firebaseManager.manualSync(appData);
    updateCloudSyncUI();
  });
  document.getElementById("disableBtn").addEventListener("click", () => {
    firebaseManager.signOut();
    updateCloudSyncUI();
  });
  document.getElementById("enableBtn").addEventListener("click", () => {
    firebaseManager.enableCloudSync();
    updateCloudSyncUI();
  });

  // Initial UI update
  updateCloudSyncUI();
}

function updateCloudSyncUI() {
  if (typeof firebaseManager === 'undefined') return;

  const syncStatus = document.getElementById('syncStatus');
  const cloudControls = document.getElementById('cloudControls');
  const cloudPrompt = document.getElementById('cloudPrompt');

  const cloudEnabled = typeof firebaseManager.isCloudEnabled === "function"
    ? firebaseManager.isCloudEnabled()
    : firebaseManager.isCloudEnabled;

  if (syncStatus) {
    if (cloudEnabled) {
      syncStatus.textContent = '🟢 Cloud Backup';
      syncStatus.className = 'sync-status online';
      const lastSync = typeof firebaseManager.getLastSync === "function"
        ? firebaseManager.getLastSync()
        : null;
      if (lastSync) {
        syncStatus.title = `Last sync: ${lastSync.toLocaleTimeString()}`;
      }
      setSyncIndicator("online");
    } else {
      syncStatus.textContent = '🔴 Offline';
      syncStatus.className = 'sync-status offline';
      syncStatus.title = 'Enable cloud backup for data safety';
      setSyncIndicator("offline");
    }
  }

  if (cloudControls) {
    cloudControls.style.display = cloudEnabled ? 'flex' : 'none';
  }

  if (cloudPrompt) {
    cloudPrompt.style.display = !cloudEnabled ? 'flex' : 'none';
  }
}


//Sync Indicator
function setSyncIndicator(state) {
  const indicator = document.getElementById("syncIndicator");
  const message = document.getElementById("syncMessage");
  if (!indicator || !message) return;

  // Reset classes
  indicator.className = "sync-indicator";

  switch (state) {
    case "online":
      indicator.classList.add("sync-connected");
      indicator.style.background = "green";
      message.textContent = "🟢 Cloud Backup Enabled";
      break;

    case "local":
      indicator.classList.add("sync-local");
      indicator.style.background = "orange";
      message.textContent = "🟡 Local Only (not synced)";
      break;

    default:
      indicator.classList.add("sync-offline");
      indicator.style.background = "red";
      message.textContent = "🔴 Offline";
      break;
  }
}

/* ============================================================================
   Tabs and events
============================================================================ */
function setupTabs() {
  // Attach click listeners to all tab buttons
  const tabButtons = document.querySelectorAll(".tabs .tab");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      activateTab(target);
    });
  });
}

function activateTab(tabName) {
  currentTab = tabName;
  console.log(`🗂️ Activated tab: ${tabName}`);

  // Hide all tab contents
  document.querySelectorAll(".tab-content").forEach(el => {
    el.classList.remove("active");
  });

  // Remove active class from all tab buttons
  document.querySelectorAll(".tabs .tab").forEach(btn => {
    btn.classList.remove("active");
  });

  // Show the selected tab content
  const targetContent = document.getElementById(tabName);
  if (targetContent) {
    targetContent.classList.add("active");
  }

  // Highlight the clicked tab button
  const targetButton = document.querySelector(`.tabs .tab[data-tab="${tabName}"]`);
  if (targetButton) {
    targetButton.classList.add("active");
  }

  // Dispatch per-tab loaders
  switch (tabName) {
    case "payments":
      loadPaymentsTab();
      break;
    case "students":
      loadStudentsTab();
      break;
    case "attendance":
      loadAttendanceTab();
      break;
    case "hours":
      loadHoursTab();
      break;
    case "marks":
      loadMarksTab();
      break;
    case "reports":
      loadReportsTab();
      break;
  }
}

function setupEventListeners() {
  // === Students ===
  document.getElementById("addStudentBtn")?.addEventListener("click", addStudent);
  document.getElementById("clearStudentFormBtn")?.addEventListener("click", clearStudentForm);
  document.getElementById("saveDefaultRateBtn")?.addEventListener("click", saveDefaultRate);
  document.getElementById("applyDefaultRateBtn")?.addEventListener("click", applyDefaultRateToAll);
  document.getElementById("useDefaultRateBtn")?.addEventListener("click", useDefaultRate);

  // === Hours ===
  document.getElementById("logHoursBtn")?.addEventListener("click", logHours);
  document.getElementById("resetHoursFormBtn")?.addEventListener("click", resetHoursForm);

  // === Marks ===
  document.getElementById("addMarkBtn")?.addEventListener("click", addMark);
  document.getElementById("clearMarksFormBtn")?.addEventListener("click", () => {
    document.getElementById("marksForm")?.reset();
  });

  // === Attendance ===
  document.getElementById("saveAttendanceBtn")?.addEventListener("click", saveAttendance);
  document.getElementById("clearAttendanceBtn")?.addEventListener("click", clearAttendanceFormManual);

  // === Payments ===
  document.getElementById("recordPaymentBtn")?.addEventListener("click", recordPayment);
  document.getElementById("paymentsYearSelect")?.addEventListener("change", updatePaymentsByYearMonth);
  document.getElementById("paymentsMonthSelect")?.addEventListener("change", updatePaymentsByYearMonth);

  // === Sync Bar ===
  document.getElementById("autoSyncCheckbox")?.addEventListener("change", toggleAutoSync);
  document.getElementById("syncBtn")?.addEventListener("click", manualSync);
  document.getElementById("exportCloudBtn")?.addEventListener("click", exportCloudData);
  document.getElementById("importCloudBtn")?.addEventListener("click", importToCloud);
  document.getElementById("syncStatsBtn")?.addEventListener("click", showSyncStats);
  document.getElementById("exportDataBtn")?.addEventListener("click", exportData);
  document.getElementById("importDataBtn")?.addEventListener("click", importData);
  document.getElementById("clearAllBtn")?.addEventListener("click", clearAllData);
}

/* ============================================================================
   Feature Functions (UPDATED WITH CLOUD SYNC)
============================================================================ */
// === Students ===
async function addStudent() {
  const name = document.getElementById("studentName").value.trim();
  const id = document.getElementById("studentId").value.trim();
  const gender = document.getElementById("studentGender").value;
  const email = document.getElementById("studentEmail").value.trim();
  const phone = document.getElementById("studentPhone").value.trim();
  const rate = parseFloat(document.getElementById("studentBaseRate").value);

  if (!name || !id) {
    alert("Name and ID are required.");
    return;
  }

  const student = { 
    name, 
    id, 
    gender, 
    email, 
    phone, 
    rate: rate || appData.settings.defaultRate || 25.0
  };
  
  appData.students.push(student);
  await saveAllDataWithSync(); // ← UPDATED: Uses cloud sync

  renderStudents();
  updateStats();
  clearStudentForm();
  console.log("➕ Student added:", student);
}

function clearStudentForm() {
  document.getElementById("studentForm")?.reset();
}

function renderStudents() {
  const container = document.getElementById("studentsContainer");
  const studentsCountEl = document.getElementById("studentsCount");
  const avgRateEl = document.getElementById("avgRate");
  
  if (!container) return;

  // Render student cards
  if (appData.students.length === 0) {
    container.innerHTML = "<p>No students registered yet.</p>";
  } else {
    container.innerHTML = appData.students.map(s => `
      <div class="student-card">
        <strong>${s.name}</strong> (${s.id}) - ${s.gender}<br>
        Email: ${s.email || "N/A"}, Phone: ${s.phone || "N/A"}<br>
        Rate: $${(s.rate || 0).toFixed(2)}
      </div>
    `).join("");
  }

  // Update stats
  if (studentsCountEl) {
    studentsCountEl.textContent = appData.students.length;
  }
  
  if (avgRateEl) {
    if (appData.students.length > 0) {
      const totalRate = appData.students.reduce((sum, s) => sum + (s.rate || 0), 0);
      const averageRate = totalRate / appData.students.length;
      avgRateEl.textContent = `$${averageRate.toFixed(2)}/session`;
    } else {
      avgRateEl.textContent = "$0.00/session";
    }
  }
}

// === Hours ===
async function logHours() {
  const org = document.getElementById("organization").value.trim();
  const type = document.getElementById("workType").value;
  const date = document.getElementById("workDate").value;
  const hours = parseFloat(document.getElementById("hoursWorked").value);
  const rate = parseFloat(document.getElementById("baseRate").value);

  if (!org || !date || isNaN(hours) || isNaN(rate)) {
    alert("Fill out all fields.");
    return;
  }

  const entry = { org, type, date, hours, rate };
  appData.hours.push(entry);
  await saveAllDataWithSync(); // ← UPDATED: Uses cloud sync

  renderHours();
  resetHoursForm();
  console.log("💾 Hours logged:", entry);
}

function resetHoursForm() {
  document.getElementById("hoursForm")?.reset();
}

function renderHours() {
  const container = document.getElementById("hoursContainer");
  if (!container) return;

  if (appData.hours.length === 0) {
    container.innerHTML = "<p>No work logged yet.</p>";
    return;
  }

  container.innerHTML = appData.hours.map(h => `
    <div class="hours-card">
      ${h.date}: ${h.org} (${h.type}) — ${h.hours}h @ $${h.rate}
    </div>
  `).join("");
}

// === Marks ===
async function addMark() {
  const studentId = document.getElementById("marksStudent").value;
  const subject = document.getElementById("markSubject").value.trim();
  const date = document.getElementById("markDate").value;
  const score = parseFloat(document.getElementById("score").value);
  const maxScore = parseFloat(document.getElementById("maxScore").value);

  if (!studentId || !subject || !date || isNaN(score) || isNaN(maxScore)) {
    alert("Fill out all fields.");
    return;
  }

  const mark = { studentId, subject, date, score, maxScore };
  appData.marks.push(mark);
  await saveAllDataWithSync(); // ← UPDATED: Uses cloud sync

  renderMarks();
  document.getElementById("marksForm")?.reset();
  console.log("💾 Mark added:", mark);
}

function renderMarks() {
  const container = document.getElementById("marksContainer");
  if (!container) return;

  if (appData.marks.length === 0) {
    container.innerHTML = "<p>No marks recorded yet.</p>";
    return;
  }

  container.innerHTML = appData.marks.map(m => `
    <div class="mark-card">
      ${m.date}: ${m.subject} — ${m.score}/${m.maxScore} (Student: ${m.studentId})
    </div>
  `).join("");
}

// === Attendance ===
async function saveAttendance() {
  const date = document.getElementById("attendanceDate").value;
  const subject = document.getElementById("attendanceSubject").value.trim();

  if (!date || !subject) {
    alert("Fill out all fields.");
    return;
  }

  // Collect checkbox states
  const checkboxes = document.querySelectorAll("#attendanceList input[type='checkbox']");
  const studentsMarked = Array.from(checkboxes).map(cb => ({
    id: cb.getAttribute("data-student"),
    present: cb.checked
  }));

  const record = { date, subject, students: studentsMarked };
  appData.attendance.push(record);
  await saveAllDataWithSync(); // ← UPDATED: Uses cloud sync

  renderAttendance();
  clearAttendanceFormManual();
  console.log("💾 Attendance saved:", record);
}

function clearAttendanceFormManual() {
  document.getElementById("attendanceForm")?.reset();
}

function renderAttendance() {
  const container = document.getElementById("attendanceContainer");
  if (!container) return;

  if (appData.attendance.length === 0) {
    container.innerHTML = "<p>No attendance records yet.</p>";
    return;
  }

  container.innerHTML = appData.attendance.map(a => {
    const presentCount = a.students.filter(s => s.present).length;
    const absentCount = a.students.filter(s => !s.present).length;
    return `
      <div class="attendance-card">
        ${a.date}: ${a.subject} — Present: ${presentCount}, Absent: ${absentCount}
      </div>
    `;
  }).join("");
}

// === Payments ===
async function recordPayment() {
  const studentId = document.getElementById("paymentStudent").value;
  const amount = parseFloat(document.getElementById("paymentAmount").value);
  const date = document.getElementById("paymentDate").value;
  const method = document.getElementById("paymentMethod").value;
  const notes = document.getElementById("paymentNotes").value.trim();

  if (!studentId || isNaN(amount) || !date) {
    alert("Fill out all fields.");
    return;
  }

  const payment = { studentId, amount, date, method, notes };
  appData.payments.push(payment);
  allPayments.push(payment);
  await saveAllDataWithSync(); // ← UPDATED: Uses cloud sync

  renderPayments();
  document.getElementById("paymentForm")?.reset();
  console.log("💳 Payment recorded:", payment);
}

function updatePaymentsByYearMonth() {
  const year = document.getElementById("paymentsYearSelect")?.value;
  const month = document.getElementById("paymentsMonthSelect")?.value;

  let filtered = allPayments;
  if (year) filtered = filtered.filter(p => new Date(p.date).getFullYear().toString() === year);
  if (month) filtered = filtered.filter(p => (new Date(p.date).getMonth() + 1).toString() === month);

  renderPayments(filtered);
}

function renderPayments(filteredList) {
  const payments = filteredList || allPayments;
  const container = document.getElementById("paymentsStats");

  if (!container) return;

  if (payments.length === 0) {
    container.innerHTML = "<p>No payments recorded yet.</p>";
    return;
  }

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  // Balance per student
  const balances = {};
  payments.forEach(p => {
    if (!balances[p.studentId]) balances[p.studentId] = 0;
    balances[p.studentId] += p.amount;
  });

  container.innerHTML = `
    <div>Total: $${total.toFixed(2)}</div>
    <div>Payments: ${payments.length}</div>
    <h4>Balances by Student</h4>
    ${Object.entries(balances).map(([id, amt]) => {
      const student = appData.students.find(s => s.id === id);
      return `<div>${student?.name || id}: $${amt.toFixed(2)}</div>`;
    }).join("")}
  `;
}

/* ============================================================================
   Tab Loaders
============================================================================ */
function loadStudentsTab() {
  console.log("📂 Loading tab data: students");
  renderStudents();

  const container = document.getElementById("studentsSummary");
  if (!container) return;

  const studentCount = appData.students.length;
  if (studentCount === 0) {
    container.innerHTML = "<p>No students registered yet.</p>";
    return;
  }

  // Breakdown by gender (if stored)
  const genderStats = {};
  appData.students.forEach(s => {
    if (s.gender) {
      if (!genderStats[s.gender]) genderStats[s.gender] = 0;
      genderStats[s.gender]++;
    }
  });

  // Render summary
  container.innerHTML = `
    <h3>👩‍🎓 Students Summary</h3>
    <p>Total students: ${studentCount}</p>
    <h4>By Gender</h4>
    ${Object.entries(genderStats).map(([g, count]) => `<div>${g}: ${count}</div>`).join("") || "<p>No gender data.</p>"}
  `;
}

function loadAttendanceTab() {
  console.log("📂 Loading tab data: attendance");
  renderAttendance();

  const summaryContainer = document.getElementById("attendanceSummary");
  if (!summaryContainer) return;

  if (appData.students.length === 0) {
    summaryContainer.innerHTML = "<p>No students registered.</p>";
    return;
  }

  if (appData.attendance.length === 0) {
    summaryContainer.innerHTML = "<p>No attendance records yet.</p>";
    return;
  }

  // Calculate per-student attendance
  const stats = {};
  appData.students.forEach(s => {
    stats[s.id] = { name: s.name, present: 0, total: 0 };
  });

  appData.attendance.forEach(session => {
    session.students.forEach(stu => {
      if (stats[stu.id]) {
        stats[stu.id].total++;
        if (stu.present) stats[stu.id].present++;
      }
    });
  });

  // Render summary
  summaryContainer.innerHTML = `
    <h3>📅 Attendance Summary</h3>
    ${Object.values(stats).map(s => {
      const rate = s.total > 0 ? ((s.present / s.total) * 100).toFixed(1) : "N/A";
      return `<div>${s.name}: ${s.present}/${s.total} sessions (${rate}%)</div>`;
    }).join("")}
  `;
}

function loadHoursTab() {
  console.log("📂 Loading tab data: hours");
  renderHours();

  const container = document.getElementById("hoursSummary");
  if (!container) return;

  const hoursCount = appData.hours.length;
  if (hoursCount === 0) {
    container.innerHTML = "<p>No hours logged yet.</p>";
    return;
  }

  // Totals and averages
  const totalHours = appData.hours.reduce((sum, h) => sum + h.hours, 0);
  const avgHours = (totalHours / hoursCount).toFixed(1);

  // Breakdown by work type
  const typeStats = {};
  appData.hours.forEach(h => {
    if (!typeStats[h.type]) typeStats[h.type] = 0;
    typeStats[h.type] += h.hours;
  });

  // Breakdown by organization
  const orgStats = {};
  appData.hours.forEach(h => {
    if (!orgStats[h.org]) orgStats[h.org] = 0;
    orgStats[h.org] += h.hours;
  });

  // Render summary
  container.innerHTML = `
    <h3>⏱️ Hours Summary</h3>
    <p>Total hours logged: ${totalHours}</p>
    <p>Average hours per entry: ${avgHours}</p>
    <h4>By Work Type</h4>
    ${Object.entries(typeStats).map(([type, hrs]) => `<div>${type}: ${hrs}h</div>`).join("")}
    <h4>By Organization</h4>
    ${Object.entries(orgStats).map(([org, hrs]) => `<div>${org}: ${hrs}h</div>`).join("")}
  `;
}

function loadMarksTab() {
  console.log("📂 Loading tab data: marks");
  renderMarks();
}

function loadReportsTab() {
  console.log("📂 Loading tab data: reports");
  const container = document.getElementById("reportsContainer");
  if (!container) return;

  // Basic counts
  const studentCount = appData.students.length;
  const paymentCount = allPayments.length;
  const hoursCount = appData.hours.length;
  const marksCount = appData.marks.length;
  const attendanceSessions = appData.attendance.length;

  // Attendance breakdown (overall)
  let totalPresent = 0;
  let totalMarked = 0;
  appData.attendance.forEach(session => {
    session.students.forEach(s => {
      totalMarked++;
      if (s.present) totalPresent++;
    });
  });
  const attendanceRate = totalMarked > 0 ? ((totalPresent / totalMarked) * 100).toFixed(1) : "N/A";

  // Financial summaries
  const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);
  const avgPayment = paymentCount > 0 ? (totalRevenue / paymentCount).toFixed(2) : "N/A";
  const avgPerStudent = studentCount > 0 ? (totalRevenue / studentCount).toFixed(2) : "N/A";

  // Marks analysis
  let avgScore = "N/A";
  let highestMark = "N/A";
  let lowestMark = "N/A";
  if (marksCount > 0) {
    const percentages = appData.marks.map(m => (m.score / m.maxScore) * 100);
    avgScore = (percentages.reduce((sum, p) => sum + p, 0) / percentages.length).toFixed(1);
    highestMark = Math.max(...percentages).toFixed(1);
    lowestMark = Math.min(...percentages).toFixed(1);
  }

  // Render summary
  container.innerHTML = `
    <h3>📊 Reports Summary</h3>
    <p>👩‍🎓 Students: ${studentCount}</p>
    <p>💳 Payments: ${paymentCount}</p>
    <p>⏱️ Hours logged: ${hoursCount}</p>
    <p>📝 Marks recorded: ${marksCount}</p>
    <p>📅 Attendance sessions: ${attendanceSessions}</p>
    <p>✅ Average attendance rate: ${attendanceRate}%</p>
    <hr>
    <p>💰 Total revenue: $${totalRevenue.toFixed(2)}</p>
    <p>💵 Average payment: $${avgPayment}</p>
    <p>👨‍🎓 Average revenue per student: $${avgPerStudent}</p>
    <hr>
    <p>📈 Average score: ${avgScore}%</p>
    <p>🏆 Highest mark: ${highestMark}%</p>
    <p>📉 Lowest mark: ${lowestMark}%</p>
  `;
}

function loadPaymentsTab() {
  console.log("📂 Loading tab data: payments");
  renderPayments();

  const yearSelect = document.getElementById("paymentsYearSelect");
  const monthSelect = document.getElementById("paymentsMonthSelect");

  if (yearSelect) {
    const years = [...new Set(allPayments.map(p => new Date(p.date).getFullYear()))];
    yearSelect.innerHTML = `<option value="">All Years</option>` +
      years.map(y => `<option value="${y}">${y}</option>`).join("");
  }

  if (monthSelect) {
    const months = [...new Set(allPayments.map(p => new Date(p.date).getMonth() + 1))];
    monthSelect.innerHTML = `<option value="">All Months</option>` +
      months.map(m => `<option value="${m}">${m}</option>`).join("");
  }
}

// Context-aware FAB
function updateFabAction() {
  const activeTab = document.querySelector(".tab.active")?.dataset.tab;
  const fab = document.getElementById("fab");
  if (!fab) return;

  switch (activeTab) {
    case "students":
      fab.textContent = "👤";
      fab.title = "Add Student";
      fab.onclick = () => {
        document.getElementById("students").classList.add("active");
        document.getElementById("studentName").focus();
      };
      break;

    case "hours":
      fab.textContent = "⏱️";
      fab.title = "Log Hours";
      fab.onclick = () => {
        document.getElementById("hours").classList.add("active");
        document.getElementById("organization").focus();
      };
      break;

    case "marks":
      fab.textContent = "📊";
      fab.title = "Add Mark";
      fab.onclick = () => {
        document.getElementById("marks").classList.add("active");
        document.getElementById("marksStudent").focus();
      };
      break;

    case "attendance":
      fab.textContent = "✅";
      fab.title = "Record Attendance";
      fab.onclick = () => {
        document.getElementById("attendance").classList.add("active");
        document.getElementById("attendanceDate").focus();
      };
      break;

    case "payments":
      fab.textContent = "💰";
      fab.title = "Record Payment";
      fab.onclick = () => {
        document.getElementById("payments").classList.add("active");
        document.getElementById("paymentStudent").focus();
      };
      break;

    case "reports":
      fab.textContent = "📈";
      fab.title = "View Reports";
      fab.onclick = () => {
        document.getElementById("reports").classList.add("active");
      };
      break;

    default:
      fab.textContent = "➕";
      fab.title = "Quick Action";
      fab.onclick = () => {};
  }
}

// Update FAB whenever a tab is clicked
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    updateFabAction();
  });
});

// Initialize FAB on load
document.addEventListener("DOMContentLoaded", updateFabAction);

/* ============================================================================
   Stats and UI updates
============================================================================ */
function updateStats() {
  // Dashboard/global stats
  const studentsCountEl = document.getElementById("studentsCount");
  const avgRateEl = document.getElementById("avgRate");
  
  if (studentsCountEl) {
    studentsCountEl.textContent = appData.students.length;
  }
  
  if (avgRateEl && appData.students.length > 0) {
    const totalRate = appData.students.reduce((sum, s) => sum + (s.rate || 0), 0);
    const averageRate = totalRate / appData.students.length;
    avgRateEl.textContent = `$${averageRate.toFixed(2)}/session`;
  } else if (avgRateEl) {
    avgRateEl.textContent = "$0.00/session";
  }
}

/* ============================================================================
   Sync Bar Functions (Updated for Firebase)
============================================================================ */
async function manualSync() { 
  console.log("🔄 manualSync() called");
  try {
    if (typeof firebaseManager !== 'undefined' && firebaseManager.manualSync) {
      await firebaseManager.manualSync();
    } else {
      await saveAllDataWithSync();
      console.log("✅ Manual sync completed");
    }
  } catch (error) {
    console.error("❌ Manual sync failed:", error);
  }
}

function exportCloudData() { 
  console.log("☁️ exportCloudData() called");
  // This would be handled by your firebase-manager.js
}

function importToCloud() { 
  console.log("📥 importToCloud() called");
  // This would be handled by your firebase-manager.js
}

function showSyncStats() { 
  console.log("📊 showSyncStats() called");
  // Show Firebase sync statistics
  if (typeof firebaseManager !== 'undefined') {
    const stats = {
      cloudEnabled: firebaseManager.isCloudEnabled ? firebaseManager.isCloudEnabled() : false,
      lastSync: firebaseManager.getLastSync ? firebaseManager.getLastSync() : null,
      user: firebaseManager.getCloudUser ? firebaseManager.getCloudUser() : null
    };
    alert(`Cloud Sync Stats:\n\nEnabled: ${stats.cloudEnabled}\nLast Sync: ${stats.lastSync ? stats.lastSync.toLocaleString() : 'Never'}\nUser: ${stats.user ? stats.user.email : 'None'}`);
  } else {
    alert("Cloud sync not available");
  }
}

function exportData() { 
  console.log("📤 exportData() called");
  // Export to JSON file
  const dataStr = JSON.stringify(appData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tutor-data-backup.json';
  link.click();
  URL.revokeObjectURL(url);
}

function importData() { 
  console.log("📥 importData() called");
  // Trigger file input for import
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await file.text();
      try {
        const importedData = JSON.parse(text);
        Object.assign(appData, importedData);
        await saveAllDataWithSync();
        location.reload();
      } catch (error) {
        alert('Error importing data: ' + error.message);
      }
    }
  };
  input.click();
}

async function clearAllData() {
  if (confirm("Are you sure you want to clear ALL data? This cannot be undone!")) {
    initializeEmptyData();
    await saveAllDataWithSync();
    renderStudents(); 
    renderPayments(); 
    renderHours(); 
    renderMarks(); 
    renderAttendance();
    updateStats();
    console.log("🗑️ All data cleared");
  }
}

function toggleAutoSync() { 
  console.log("🔁 toggleAutoSync() called");
  // Could be implemented with Firebase real-time updates
}

// Placeholder functions for settings
async function saveDefaultRate() {
  const newRate = parseFloat(prompt("Enter new default rate:", appData.settings.defaultRate));
  if (!isNaN(newRate) && newRate > 0) {
    appData.settings.defaultRate = newRate;
    await saveAllDataWithSync();
    loadDefaultRate();
    console.log("💵 Default rate updated to:", newRate);
  }
}

async function applyDefaultRateToAll() {
  if (confirm("Apply the default rate to all existing students?")) {
    appData.students.forEach(student => {
      student.rate = appData.settings.defaultRate;
    });
    await saveAllDataWithSync();
    renderStudents();
    updateStats();
    console.log("✅ Default rate applied to all students");
  }
}

function useDefaultRate() {
  const rateInput = document.getElementById("studentBaseRate");
  if (rateInput) {
    rateInput.value = appData.settings.defaultRate;
  }
}

/* ============================================================================
   Boot and Global Exposure
============================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  try {
    init();
  } catch (err) {
    console.error("❌ Initialization failed:", err);
  }
});

// Expose functions that HTML expects
window.updatePaymentsByYearMonth = updatePaymentsByYearMonth;
window.toggleAutoSync = toggleAutoSync;
window.manualSync = manualSync;
window.exportData = exportData;
window.importData = importData;
window.clearAllData = clearAllData;

// Make app data accessible for debugging
window.appData = appData;
