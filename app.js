// app.js — WorkLog main application logic
// Existing imports at the top of app.js
import { auth, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ===========================
// AUTH SECTION WIRING
// ===========================

// Toggle user menu
const authButton = document.getElementById("authButton");
const userMenu = document.getElementById("userMenu");

if (authButton && userMenu) {
  authButton.addEventListener("click", () => {
    userMenu.classList.toggle("open");
    authButton.parentElement.classList.toggle("open");
  });
}

document.addEventListener("click", (e) => {
  if (!authButton.contains(e.target) && !userMenu.contains(e.target)) {
    userMenu.classList.remove("open");
    authButton.parentElement.classList.remove("open");
  }
});

// Handle auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("userName").textContent = user.displayName || user.email;
    document.getElementById("userDisplayName").textContent = user.displayName || "User";
    document.getElementById("userEmail").textContent = user.email || "";

    document.querySelector(".container").style.display = "block";
  } else {
    window.location.href = "auth.html";
  }
});

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "auth.html";
    } catch (err) {
      console.error("Logout failed:", err);
    }
  });
}

// Usage stats updater
export function updateUsageStats(students, hours, earnings) {
  document.getElementById("statStudents").textContent = students;
  document.getElementById("statHours").textContent = hours;
  document.getElementById("statEarnings").textContent = earnings.toFixed(2);
  document.getElementById("statUpdated").textContent = new Date().toLocaleString();
}

// ----------------------
// DOM Elements (defensive)
// ----------------------
// ----------------------
// Sync Toolbar Elements
// ----------------------
const syncIndicator    = document.getElementById("syncIndicator");
const syncSpinner      = document.getElementById("syncSpinner");
const autoSyncCheckbox = document.getElementById("autoSyncCheckbox");
const autoSyncText     = document.getElementById("autoSyncText");
const syncMessage      = document.getElementById("syncMessage");
const syncMessageLine  = document.getElementById("syncMessageLine");

const syncBtn          = document.getElementById("syncBtn");
const exportCloudBtn   = document.getElementById("exportCloudBtn");
const importCloudBtn   = document.getElementById("importCloudBtn");
const syncStatsBtn     = document.getElementById("syncStatsBtn");

const exportDataBtn    = document.getElementById("exportDataBtn");
const importDataBtn    = document.getElementById("importDataBtn");
const clearDataBtn     = document.getElementById("clearDataBtn");

// ----------------------
// Stats Displays
// ----------------------
const statStudents          = document.getElementById("statStudents");
const statHours             = document.getElementById("statHours");
const statEarnings          = document.getElementById("statEarnings");
const statUpdated           = document.getElementById("statUpdated");

// ----------------------
// Reports and UI Sections
// ----------------------
const weeklyBody            = document.getElementById("weeklyBody");
const subjectBody           = document.getElementById("subjectBody");

const weeklyContainer       = document.getElementById("weeklyContainer");
const subjectContainer      = document.getElementById("subjectContainer");

const studentsContainer     = document.getElementById("studentsContainer");

// ----------------------
// Activity Containers
// ----------------------
const hoursContainer        = document.getElementById("hoursContainer");
const marksContainer        = document.getElementById("marksContainer");
const attendanceContainer   = document.getElementById("attendanceContainer");
const paymentActivityLog    = document.getElementById("paymentActivityLog");
const studentBalancesContainer = document.getElementById("studentBalancesContainer");

// ----------------------
// Overview Report Widgets
// ----------------------
const totalStudentsReport   = document.getElementById("totalStudentsReport");
const totalHoursReport      = document.getElementById("totalHoursReport");
const totalEarningsReport   = document.getElementById("totalEarningsReport");
const avgMarkReport         = document.getElementById("avgMarkReport");
const totalPaymentsReport   = document.getElementById("totalPaymentsReport");
const outstandingBalance    = document.getElementById("outstandingBalance");

// ----------------------
// Other Small Displays
// ----------------------
const lastSessionDateEl     = document.getElementById("lastSessionDate");
const attendanceCountEl     = document.getElementById("attendanceCount");
const monthlyPaymentsEl     = document.getElementById("monthlyPayments");
const totalStudentsCountEl  = document.getElementById("totalStudentsCount");
const totalOwedEl           = document.getElementById("totalOwed");

let autoSyncInterval = null;

// Ensure floating button works once
document.addEventListener("DOMContentLoaded", () => {
  const floatBtn = document.getElementById("floatingButton");
  if (floatBtn && !floatBtn.dataset.listenerAttached) {
    floatBtn.addEventListener("click", () => {
      console.log("Floating button clicked!");
      resetHoursForm();
    });
    floatBtn.dataset.listenerAttached = "true";
  }
});

// ----------------------
// Utilities
// ----------------------
function refreshTimestamp() {
  const now = new Date().toLocaleString();
  if (syncMessageLine) syncMessageLine.textContent = "Status: Last synced at " + now;
  if (statUpdated) statUpdated.textContent = now;
}

function safeNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function fmtMoney(n) {
  return safeNumber(n).toFixed(2);
}

function fmtDateISO(yyyyMmDd) {
  // Convert yyyy-mm-dd to ISO-like string for ordering, or now if blank
  if (!yyyyMmDd) return new Date().toISOString();
  try {
    const d = new Date(yyyyMmDd);
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ----------------------
// Stats: Load and Update
// ----------------------
async function loadUserStats(uid) {
  try {
    const statsRef = doc(db, "users", uid);

    // Try cache first, then server
    let statsSnap;
    try {
      statsSnap = await getDoc(statsRef, { source: "cache" });
    } catch {
      statsSnap = await getDoc(statsRef); // fallback to server
    }

    if (statsSnap.exists()) {
      const stats = statsSnap.data();
      if (statStudents) statStudents.textContent = stats.students ?? 0;
      if (statHours)    statHours.textContent    = stats.hours ?? 0;
      if (statEarnings) statEarnings.textContent = stats.earnings != null
        ? fmtMoney(stats.earnings)
        : "0.00";
    } else {
      // Initialize if no stats doc exists
      await setDoc(statsRef, { students: 0, hours: 0, earnings: 0 });
      if (statStudents) statStudents.textContent = 0;
      if (statHours)    statHours.textContent    = 0;
      if (statEarnings) statEarnings.textContent = "0.00";
    }

    refreshTimestamp();
  } catch (err) {
    console.error("❌ Error loading stats:", err);
    if (syncMessageLine) {
      syncMessageLine.textContent = "Status: Offline – stats unavailable";
    }
  }
}

async function updateUserStats(uid, newStats) {
  try {
    const statsRef = doc(db, "users", uid);
    await setDoc(statsRef, newStats, { merge: true });
    console.log("✅ Stats updated:", newStats);

    if (newStats.students !== undefined && statStudents) {
      statStudents.textContent = newStats.students;
    }
    if (newStats.hours !== undefined && statHours) {
      statHours.textContent = newStats.hours;
    }
    if (newStats.earnings !== undefined && statEarnings) {
      statEarnings.textContent = fmtMoney(newStats.earnings);
    }
    if (newStats.lastSync !== undefined && statUpdated) {
      statUpdated.textContent = newStats.lastSync;
    }

    refreshTimestamp();
  } catch (err) {
    console.error("❌ Error updating stats:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to update stats";
  }
}

// Recalculate summary stats (students count, total hours, total earnings)
async function recalcSummaryStats(uid) {
  try {
    const studentsSnap = await getDocs(collection(db, "users", uid, "students"));
    const hoursSnap    = await getDocs(collection(db, "users", uid, "hours"));

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
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to recalc stats";
  }
}

// ----------------------
// Sync Bar Logic
// ----------------------
// Export all user data to a cloud backup collection
console.log({
  syncBtn,
  exportCloudBtn,
  importCloudBtn,
  syncStatsBtn
});

async function exportUserData(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const backupRef = doc(db, "backups", uid);

    // Get the main stats doc
    const statsSnap = await getDoc(userRef);
    const statsData = statsSnap.exists() ? statsSnap.data() : {};

    // Get subcollections (students, hours, payments, etc.)
    const studentsSnap = await getDocs(collection(db, "users", uid, "students"));
    const hoursSnap    = await getDocs(collection(db, "users", uid, "hours"));
    const paymentsSnap = await getDocs(collection(db, "users", uid, "payments"));

    const students = studentsSnap.docs.map(d => d.data());
    const hours    = hoursSnap.docs.map(d => d.data());
    const payments = paymentsSnap.docs.map(d => d.data());

    // Save everything into a backup doc
    await setDoc(backupRef, {
      stats: statsData,
      students,
      hours,
      payments,
      exportedAt: new Date().toISOString()
    });

    console.log("✅ Export complete");
    if (syncMessageLine) syncMessageLine.textContent = "Status: Exported to cloud";
  } catch (err) {
    console.error("❌ Export failed:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Export failed";
  }
}

// Import user data from cloud backup into live collections
async function importUserData(uid) {
  try {
    const backupRef = doc(db, "backups", uid);
    const backupSnap = await getDoc(backupRef);

    if (!backupSnap.exists()) {
      console.warn("⚠️ No backup found for user:", uid);
      if (syncMessageLine) syncMessageLine.textContent = "Status: No backup found";
      return;
    }

    const backupData = backupSnap.data();

    // Restore stats doc
    if (backupData.stats) {
      await setDoc(doc(db, "users", uid), backupData.stats, { merge: true });
    }

    // Restore students
    if (backupData.students) {
      for (const student of backupData.students) {
        const studentRef = doc(db, "users", uid, "students", student.id);
        await setDoc(studentRef, student, { merge: true });
      }
    }

    // Restore hours
    if (backupData.hours) {
      for (const entry of backupData.hours) {
        await addDoc(collection(db, "users", uid, "hours"), entry);
      }
    }

    // Restore payments
    if (backupData.payments) {
      for (const payment of backupData.payments) {
        await addDoc(collection(db, "users", uid, "payments"), payment);
      }
    }

    console.log("✅ Import complete");
    if (syncMessageLine) syncMessageLine.textContent = "Status: Import complete";

    // Recalculate stats after import
    await recalcSummaryStats(uid);
  } catch (err) {
    console.error("❌ Import failed:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Import failed";
  }
}

// Autosync loop
function startAutosync() {
  if (autosyncInterval) clearInterval(autosyncInterval);
  autosyncInterval = setInterval(runSync, 60 * 1000); // every 60s
  runSync(); // run immediately
}

function stopAutosync() {
  if (autosyncInterval) {
    clearInterval(autosyncInterval);
    autosyncInterval = null;
  }
}

// Run one sync cycle
async function runSync(manual = false) {
  try {
    syncSpinner.style.display = "inline-block";

    const user = auth.currentUser;
    if (user) {
      await recalcSummaryStats(user.uid);
      statUpdated.textContent = new Date().toLocaleString();
      console.log(manual ? "✅ Manual sync complete" : "✅ Autosync complete");
    } else {
      console.warn("⚠️ Not logged in, sync skipped");
    }
  } catch (err) {
    console.error("❌ Sync error:", err);
  } finally {
    syncSpinner.style.display = "none";
  }
}

// ----------------------
// Sync Bar Event Listeners
// ----------------------
let autosyncInterval = null;

document.addEventListener("DOMContentLoaded", () => {

  // Toggle autosync
  if (autoSyncCheckbox) {
    autoSyncCheckbox.addEventListener("change", () => {
      if (autoSyncCheckbox.checked) {
        autoSyncText.textContent = "Auto";
        syncIndicator.style.backgroundColor = "green";
        startAutosync();
      } else {
        autoSyncText.textContent = "Manual";
        syncIndicator.style.backgroundColor = "red";
        stopAutosync();
      }
    });
  }

  // Manual sync
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      await runSync(true);
    });
  }

  // Export cloud
  if (exportCloudBtn) {
    exportCloudBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (user) await exportUserData(user.uid);
    });
  }

  // Import cloud
  if (importCloudBtn) {
    importCloudBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) return;

      const proceed = confirm("⚠️ This will overwrite your current data with the backup. Continue?");
      if (proceed) await importUserData(user.uid);
    });
  }

  // Sync stats only
  if (syncStatsBtn) {
    syncStatsBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (user) await recalcSummaryStats(user.uid);
    });
  }

  // Extra buttons
  if (exportDataBtn) {
    exportDataBtn.addEventListener("click", async () => {
      await exportData();
    });
  }

  if (importDataBtn) {
    importDataBtn.addEventListener("click", async () => {
      await importData();
    });
  }

  if (clearDataBtn) {
    clearDataBtn.addEventListener("click", async () => {
      const proceed = confirm("⚠️ This will clear ALL data. Continue?");
      if (proceed) await clearData();
    });
  }
});

// ----------------------
// Local Data Actions
// ----------------------
async function exportData() {
  console.log("📤 ExportData triggered");
  // Example: simulate export
  const dummy = { students: [], hours: [], marks: [], attendance: [], payments: [] };
  const blob = new Blob([JSON.stringify(dummy, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "worklog-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function importData() {
  console.log("📥 ImportData triggered");
  // Example: prompt for file input
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    console.log("✅ Imported Data:", data);
    // TODO: validate and apply to Firestore/local state
  };
  input.click();
}

async function clearData() {
  console.log("🗑️ ClearData triggered");
  // Example: simulate clear
  // TODO: wipe Firestore collections or local state
}

// ----------------------
// Students Tab
// ----------------------
async function renderStudents() {
  const user = auth.currentUser;
  if (!user) return;

  const container = document.getElementById("studentsContainer");
  if (!container) return;
  container.innerHTML = "";

  const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
  if (studentsSnap.size === 0) {
    container.innerHTML = "<p style='color:#666;text-align:center;padding:40px;'>No students registered yet.</p>";
    return;
  }

  studentsSnap.forEach(docSnap => {
    const s = docSnap.data();
    const card = document.createElement("div");
    card.className = "student-card";
    card.innerHTML = `
      <div class="student-card-header">${s.name} (${s.id})</div>
      <div class="muted">${s.gender} | ${s.email || ""} | ${s.phone || ""}</div>
      <div>Rate: $${fmtMoney(s.rate)}/session</div>
    `;
    container.appendChild(card);
  });

  // Update dropdowns used elsewhere
  const marksStudentSelect = document.getElementById("marksStudent");
  const paymentStudentSelect = document.getElementById("paymentStudent");
  const attendanceList = document.getElementById("attendanceList");

  if (marksStudentSelect) marksStudentSelect.innerHTML = "";
  if (paymentStudentSelect) paymentStudentSelect.innerHTML = "";
  if (attendanceList) attendanceList.innerHTML = "";

  studentsSnap.forEach(docSnap => {
    const s = docSnap.data();
    if (marksStudentSelect) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.id})`;
      marksStudentSelect.appendChild(opt);
    }
    if (paymentStudentSelect) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.id})`;
      paymentStudentSelect.appendChild(opt);
    }
    if (attendanceList) {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.innerHTML = `
        <input type="checkbox" id="att_${s.id}" value="${s.id}">
        <label for="att_${s.id}">${s.name} (${s.id})</label>
      `;
      attendanceList.appendChild(row);
    }
  });

  await recalcSummaryStats(user.uid);
}

async function addStudent() {
  const nameEl   = document.getElementById("studentName");
  const idEl     = document.getElementById("studentId");
  const genderEl = document.getElementById("studentGender");
  const emailEl  = document.getElementById("studentEmail");
  const phoneEl  = document.getElementById("studentPhone");
  const rateEl   = document.getElementById("studentBaseRate");

  const name   = nameEl?.value.trim();
  const id     = idEl?.value.trim();
  const gender = genderEl?.value;
  const email  = emailEl?.value.trim();
  const phone  = phoneEl?.value.trim();
  const rate   = parseFloat(rateEl?.value) || 0;

  if (!name || !id || !gender) {
    alert("Please fill required fields: Name, ID, Gender");
    return;
  }

  const student = { name, id, gender, email, phone, rate };

  const user = auth.currentUser;
  if (user) {
    try {
      const studentRef = doc(db, "users", user.uid, "students", id);
      await setDoc(studentRef, student);
      console.log("✅ Student added:", student);

      clearStudentForm();
      await renderStudents();

      // Recalculate stats → updateUserStats handles dropdown refresh
      await recalcSummaryStats(user.uid);
    } catch (err) {
      console.error("❌ Error adding student:", err);
    }
  }
}


function clearStudentForm() {
  const form = document.getElementById("studentForm");
  if (form) form.reset();
}

function saveDefaultRate() {
  const input = document.getElementById("defaultBaseRate");
  const currentDisplay = document.getElementById("currentDefaultRate");
  const hoursDisplay = document.getElementById("currentDefaultRateDisplay");

  const val = parseFloat(input?.value) || 0;
  if (currentDisplay) currentDisplay.textContent = fmtMoney(val);
  if (hoursDisplay) hoursDisplay.textContent = fmtMoney(val);
  console.log("💾 Default rate saved:", val);
}

async function applyDefaultRateToAll() {
  const val = parseFloat(document.getElementById("defaultBaseRate")?.value) || 0;
  const user = auth.currentUser;
  if (!user) return;
  const studentsCol = collection(db, "users", user.uid, "students");
  const snap = await getDocs(studentsCol);
  const updates = [];
  snap.forEach(docSnap => {
    updates.push(setDoc(doc(db, "users", user.uid, "students", docSnap.id), { rate: val }, { merge: true }));
  });
  await Promise.all(updates);
  console.log("🔄 Applied default rate to all:", fmtMoney(val));
  await renderStudents();
}

function useDefaultRate() {
  const val = parseFloat(document.getElementById("defaultBaseRate")?.value) || 0;
  const input = document.getElementById("studentBaseRate");
  if (input) input.value = fmtMoney(val);
}

// ----------------------
// Hours Tab
// ----------------------
async function logHours() {
  const orgEl   = document.getElementById("organization");
  const typeEl  = document.getElementById("workType");
  const dateEl  = document.getElementById("workDate");
  const hoursEl = document.getElementById("hoursWorked");
  const rateEl  = document.getElementById("baseRate");
  const totalEl = document.getElementById("totalPay");

  const organization = orgEl?.value.trim();
  const workType     = typeEl?.value || "hourly";
  const workDate     = dateEl?.value;
  const hours        = parseFloat(hoursEl?.value);
  const rate         = parseFloat(rateEl?.value);

  if (!organization || !workDate || !Number.isFinite(hours) || hours <= 0 || !Number.isFinite(rate) || rate <= 0) {
    alert("Please fill required fields: Organization, Date, Hours, Rate");
    return;
  }

  const total = workType === "hourly" ? hours * rate : rate;
  if (totalEl) {
    if ("value" in totalEl) totalEl.value = fmtMoney(total);
    else totalEl.textContent = fmtMoney(total);
  }

  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, "users", user.uid, "hours"), {
      organization,
      workType,
      date: workDate,
      dateIso: fmtDateISO(workDate),
      hours,
      rate,
      total
    });

    console.log("✅ Hours logged");

    // Recalculate stats → updateUserStats handles dropdown refresh
    await recalcSummaryStats(user.uid);

    refreshTimestamp();
    await renderRecentHours();
    resetHoursForm();
  } catch (err) {
    console.error("❌ Error logging hours:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to log hours";
  }
}

async function renderRecentHours(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById("hoursContainer");
  if (!container) return;

  container.innerHTML = "";

  const snap = await getDocs(collection(db, "users", user.uid, "hours"));
  const rows = [];
  snap.forEach(d => rows.push(d.data()));

  // safer sort by ISO string descending
  rows.sort((a, b) => (b.dateIso || "").localeCompare(a.dateIso || ""));

  if (rows.length === 0) {
    container.innerHTML = "<p style='color:#666;text-align:center;padding:40px;'>No work logged yet.</p>";
    return;
  }

  rows.slice(0, limit).forEach(r => {
    const entry = document.createElement("div");
    entry.className = "hours-entry";
    entry.innerHTML = `
      <div><strong>${r.organization}</strong> — ${r.workType}</div>
      <div class="muted">${r.date}</div>
      <div>Hours: ${safeNumber(r.hours)} | Rate: $${fmtMoney(r.rate)} | Total: $${fmtMoney(r.total)}</div>
    `;
    container.appendChild(entry);
  });
}

// Reset Hours
function resetHoursForm() {
  const form = document.getElementById("hoursForm");
  if (form) {
    form.reset();
    console.log("✅ Hours form reset");
  } else {
    console.warn("resetHoursForm: hoursForm element not found");
  }
}

function useDefaultRateInHours() {
  const defaultRateDisplay = document.getElementById("currentDefaultRateDisplay");
  const baseRateInput = document.getElementById("baseRate");
  if (defaultRateDisplay && baseRateInput) {
    baseRateInput.value = parseFloat(defaultRateDisplay.textContent) || 0;
  }
}

// ----------------------
// Marks Tab
// ----------------------
async function addMark(uid, markData) {
  try {
    const marksRef = collection(db, "users", uid, "marks");
    await addDoc(marksRef, markData);
    console.log("✅ Mark added:", markData);

    // Recalculate stats → updateUserStats handles dropdown refresh
    await recalcSummaryStats(uid);
  } catch (err) {
    console.error("❌ Error adding mark:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to add mark";
  }
}


async function renderRecentMarks(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById("marksContainer");
  if (!container) return;

  container.innerHTML = "";

  const snap = await getDocs(collection(db, "users", user.uid, "marks"));
  const rows = [];
  snap.forEach(d => rows.push(d.data()));

  // safer sort by date string descending
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (rows.length === 0) {
    container.innerHTML = "<p style='color:#666;text-align:center;padding:40px;'>No marks recorded yet.</p>";
    return;
  }

  rows.slice(0, limit).forEach(r => {
    const entry = document.createElement("div");
    entry.className = "mark-entry";
    entry.innerHTML = `
      <div><strong>${r.student}</strong> — ${r.subject} (${r.topic})</div>
      <div class="muted">${r.date}</div>
      <div>Score: ${safeNumber(r.score)}/${safeNumber(r.max)} — ${safeNumber(r.percentage).toFixed(2)}%</div>
    `;
    container.appendChild(entry);
  });

  // Update marks summary
  const marksCountEl = document.getElementById("marksCount");
  const avgMarksEl   = document.getElementById("avgMarks");
  if (marksCountEl) marksCountEl.textContent = rows.length;
  if (avgMarksEl) {
    const avg = rows.length ? rows.reduce((s, r) => s + safeNumber(r.percentage), 0) / rows.length : 0;
    avgMarksEl.textContent = `${avg.toFixed(1)}%`;
  }
}

function resetMarksForm() {
  const form = document.getElementById("marksForm");
  if (form) form.reset();

  const pctEl   = document.getElementById("percentage");
  const gradeEl = document.getElementById("grade");
  if (pctEl)   pctEl.value   = "";
  if (gradeEl) gradeEl.value = "";
}

// ----------------------
// Attendance Tab
// ----------------------
async function addAttendance(uid, attendanceData) {
  try {
    const attendanceRef = collection(db, "users", uid, "attendance");
    await addDoc(attendanceRef, attendanceData);
    console.log("✅ Attendance recorded:", attendanceData);

    // Recalculate stats → updateUserStats handles dropdown refresh
    await recalcSummaryStats(uid);
  } catch (err) {
    console.error("❌ Error adding attendance:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to add attendance";
  }
}


function clearAttendanceForm() {
  const dateEl    = document.getElementById("attendanceDate");
  const subjectEl = document.getElementById("attendanceSubject");
  const topicEl   = document.getElementById("attendanceTopic");

  if (dateEl)    dateEl.value    = "";
  if (subjectEl) subjectEl.value = "";
  if (topicEl)   topicEl.value   = "";

  document.querySelectorAll("#attendanceList input[type=checkbox]")
    .forEach(cb => cb.checked = false);
}

function selectAllStudents() {
  document.querySelectorAll("#attendanceList input[type=checkbox]").forEach(cb => cb.checked = true);
}

function deselectAllStudents() {
  document.querySelectorAll("#attendanceList input[type=checkbox]").forEach(cb => cb.checked = false);
}

async function renderAttendanceRecent(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById("attendanceContainer");
  if (!container) return;

  container.innerHTML = "";

  const snap = await getDocs(collection(db, "users", user.uid, "attendance"));
  const rows = [];
  snap.forEach(d => rows.push(d.data()));

  // safer sort by date string descending
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (rows.length === 0) {
    container.innerHTML = "<p style='color:#666;text-align:center;padding:40px;'>No attendance records yet.</p>";
    return;
  }

  rows.slice(0, limit).forEach(r => {
    const entry = document.createElement("div");
    entry.className = "attendance-entry";
    entry.innerHTML = `
      <div><strong>${r.subject}</strong> — ${r.topic || "—"}</div>
      <div class="muted">${r.date}</div>
      <div>Present: ${Array.isArray(r.present) ? r.present.length : 0}</div>
    `;
    container.appendChild(entry);
  });

  if (lastSessionDateEl) lastSessionDateEl.textContent = rows[0]?.date || "Never";
  if (attendanceCountEl) attendanceCountEl.textContent = rows.length;
}

// ----------------------
// Payments Tab
// ----------------------
async function recordPayment(uid, paymentData) {
  try {
    const paymentsRef = collection(db, "users", uid, "payments");
    await addDoc(paymentsRef, paymentData);
    console.log("✅ Payment recorded:", paymentData);

    // Recalculate stats → updateUserStats handles dropdown refresh
    await recalcSummaryStats(uid);
  } catch (err) {
    console.error("❌ Error recording payment:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to record payment";
  }
}


function resetPaymentForm() {
  const studentEl = document.getElementById("paymentStudent");
  const amountEl  = document.getElementById("paymentAmount");
  const dateEl    = document.getElementById("paymentDate");
  const methodEl  = document.getElementById("paymentMethod");
  const notesEl   = document.getElementById("paymentNotes");

  if (studentEl) studentEl.value = "";
  if (amountEl)  amountEl.value  = "";
  if (dateEl)    dateEl.value    = "";
  if (methodEl)  methodEl.value  = methodEl.options[0]?.value || "";
  if (notesEl)   notesEl.value   = "";
}

async function renderPaymentActivity(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById("paymentActivityLog");
  if (!container) return;

  container.innerHTML = "";

  const snap = await getDocs(collection(db, "users", user.uid, "payments"));
  const rows = [];
  snap.forEach(d => rows.push(d.data()));

  // safer sort by date string descending
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (rows.length === 0) {
    container.innerHTML = "<p style='color:#666;text-align:center;padding:20px;'>No recent payment activity.</p>";
    return;
  }

  rows.slice(0, limit).forEach(r => {
    const entry = document.createElement("div");
    entry.className = "activity-item";
    entry.innerHTML = `
      <div><strong>$${fmtMoney(r.amount)}</strong> — ${r.student}</div>
      <div class="muted">${r.date} | ${r.method}</div>
      <div>${r.notes || ""}</div>
    `;
    container.appendChild(entry);
  });

  // Summary UI (assumes yyyy-mm-dd date strings)
  if (monthlyPaymentsEl) {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const sum = rows
      .filter(r => (r.date || "").startsWith(ym))
      .reduce((s, r) => s + safeNumber(r.amount), 0);
    monthlyPaymentsEl.textContent = `$${fmtMoney(sum)}`;
  }
}

async function renderStudentBalances() {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById("studentBalancesContainer");
  if (!container) return;

  container.innerHTML = "";

  // Build per-student earnings (from hours) minus payments
  const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
  const hoursSnap    = await getDocs(collection(db, "users", user.uid, "hours"));
  const paymentsSnap = await getDocs(collection(db, "users", user.uid, "payments"));

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

  // Render list
  if (studentsSnap.size === 0) {
    container.innerHTML = "<p style='color:#666;text-align:center;padding:40px;'>No payment data yet.</p>";
    return;
  }

  let totalOwed = 0;
  studentsSnap.forEach(snap => {
    const s = snap.data();
    const sid = s.id;
    const earned = earningsByStudent[sid] || 0;
    const paid   = paymentsByStudent[sid] || 0;
    const owed   = Math.max(earned - paid, 0);
    totalOwed += owed;

    const entry = document.createElement("div");
    entry.className = "activity-item";
    entry.innerHTML = `
      <div><strong>${s.name}</strong> (${s.id})</div>
      <div>Earned: $${fmtMoney(earned)} | Paid: $${fmtMoney(paid)} | Owed: $${fmtMoney(owed)}</div>
    `;
    container.appendChild(entry);
  });

  if (totalStudentsCountEl) totalStudentsCountEl.textContent = studentsSnap.size;
  if (totalOwedEl) totalOwedEl.textContent = `$${fmtMoney(totalOwed)}`;
}

// ----------------------
// Reports Tab
// ----------------------
async function showWeeklyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;
  if (!weeklyBody) return;

  weeklyBody.innerHTML = "";

  const snap = await getDocs(collection(db, "users", user.uid, "hours"));
  const rows = [];
  snap.forEach(d => rows.push(d.data()));

  // Group by approximate ISO week (Mon-start approx)
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
    const net = g.earnings * 0.8; // example 80% net
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
}

async function showBiWeeklyBreakdown() {
  // Simple approach: reuse weekly and (optionally) merge pairs later
  await showWeeklyBreakdown();
}

async function showMonthlyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;
  if (!weeklyBody) return; // reuse weeklyBody table for monthly
  weeklyBody.innerHTML = "";

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
}

async function showSubjectBreakdown() {
  const user = auth.currentUser;
  if (!user) return;
  if (!subjectBody) return;

  subjectBody.innerHTML = "";

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
}

// ----------------------
// Overview report numbers
// ----------------------
async function renderOverviewReports() {
  const user = auth.currentUser;
  if (!user) return;

  const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
  const hoursSnap    = await getDocs(collection(db, "users", user.uid, "hours"));
  const marksSnap    = await getDocs(collection(db, "users", user.uid, "marks"));
  const paymentsSnap = await getDocs(collection(db, "users", user.uid, "payments"));

  // Hours & Earnings from hours
  let hoursTotal = 0;
  let earningsTotal = 0;
  hoursSnap.forEach(d => {
    const r = d.data();
    hoursTotal += safeNumber(r.hours);
    earningsTotal += safeNumber(r.total);
  });

  // Avg mark
  let markSum = 0;
  let markCount = 0;
  marksSnap.forEach(d => {
    const r = d.data();
    markSum += safeNumber(r.percentage);
    markCount += 1;
  });
  const avgMark = markCount ? (markSum / markCount) : 0;

  // Payments total
  let paymentsTotal = 0;
  paymentsSnap.forEach(d => {
    const r = d.data();
    paymentsTotal += safeNumber(r.amount);
  });

  // Outstanding = earnings - payments (rough)
  const outstanding = Math.max(earningsTotal - paymentsTotal, 0);

  if (totalStudentsReport) totalStudentsReport.textContent = studentsSnap.size;
  if (totalHoursReport)    totalHoursReport.textContent    = hoursTotal.toFixed(1);
  if (totalEarningsReport) totalEarningsReport.textContent = `$${fmtMoney(earningsTotal)}`;
  if (avgMarkReport)       avgMarkReport.textContent       = `${avgMark.toFixed(1)}%`;
  if (totalPaymentsReport) totalPaymentsReport.textContent = `$${fmtMoney(paymentsTotal)}`;
  if (outstandingBalance)  outstandingBalance.textContent  = `$${fmtMoney(outstanding)}`;
}

// ----------------------
// Sync (manual/auto)
// ----------------------
async function performSync(uid, mode = "Manual") {
  if (!uid) return;

  if (!navigator.onLine) {
    console.warn("⚠️ Offline mode: skipping sync");
    if (syncMessageLine) syncMessageLine.textContent = `Status: ${mode} sync skipped (offline)`;
    return;
  }

  try {
    if (syncIndicator) {
      syncIndicator.classList.add("sync-active");
      syncIndicator.classList.remove("sync-error");
    }
    if (syncSpinner) syncSpinner.style.display = "inline-block";
    if (syncMessageLine) syncMessageLine.textContent = `Status: ${mode} syncing…`;

    // Refresh summaries and UI
    await recalcSummaryStats(uid);
    await loadUserStats(uid);

    await updateUserStats(uid, { lastSync: new Date().toLocaleString() });

    if (syncSpinner) syncSpinner.style.display = "none";
    if (syncIndicator) syncIndicator.classList.remove("sync-active");
    console.log(`✅ ${mode} sync complete`);
  } catch (err) {
    if (syncSpinner) syncSpinner.style.display = "none";
    if (syncIndicator) {
      syncIndicator.classList.remove("sync-active");
      syncIndicator.classList.add("sync-error");
    }
    if (syncMessageLine) syncMessageLine.textContent = `Status: ${mode} sync failed`;
    console.error(`❌ ${mode} sync error:`, err);
  }
}

function setAutosyncEnabled(enabled) {
  if (enabled) {
    if (autoSyncText) autoSyncText.textContent = "Auto-sync";
    if (syncMessage) syncMessage.textContent = "Cloud Sync: Auto";
    if (syncMessageLine) syncMessageLine.textContent = "Status: Auto-sync enabled";

    clearAutosyncInterval();
    autoSyncInterval = setInterval(() => {
      const u = auth.currentUser;
      if (u) performSync(u.uid, "Auto");
    }, 60000);

    console.log("✅ Auto-sync enabled");
  } else {
    if (autoSyncText) autoSyncText.textContent = "Manual";
    if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
    if (syncMessageLine) syncMessageLine.textContent = "Status: Auto-sync disabled";

    if (syncIndicator) {
      syncIndicator.classList.remove("sync-active", "sync-error");
      syncIndicator.classList.add("sync-connected");
    }

    clearAutosyncInterval();
    console.log("⏹️ Auto-sync disabled");
  }
}

function clearAutosyncInterval() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}

// ----------------------
// Tab Navigation (for data-tab buttons)
// ----------------------
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tabcontent");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");

      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove("active"));

      // Hide all tabcontent
      tabContents.forEach(tc => tc.style.display = "none");

      // Activate clicked tab
      tab.classList.add("active");

      // Show the selected tab content
      const selected = document.getElementById(target);
      if (selected) selected.style.display = "block";
    });
  });

  // Default: show the first tab’s content
  const firstActive = document.querySelector(".tab.active");
  if (firstActive) {
    const target = firstActive.getAttribute("data-tab");
    const selected = document.getElementById(target);
    if (selected) selected.style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", initTabs);

// ----------------------
// UI Events & Boot
// ----------------------
function bindUiEvents() {
  // Sync
  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      const user = auth.currentUser;
      if (user) performSync(user.uid, "Manual");
    });
  }
  if (autoSyncCheckbox) {
    autoSyncCheckbox.addEventListener("change", () => {
      setAutosyncEnabled(autoSyncCheckbox.checked);
    });
    if (autoSyncText) autoSyncText.textContent = autoSyncCheckbox.checked ? "Auto-sync" : "Manual";
  }

  // Prevent default form submits
  document.getElementById("studentForm")?.addEventListener("submit", e => e.preventDefault());
  document.getElementById("marksForm")?.addEventListener("submit", e => e.preventDefault());
}

function initAuthenticatedUi(user) {
  if (syncIndicator) {
    syncIndicator.classList.remove("sync-error", "sync-active");
    syncIndicator.classList.add("sync-connected");
  }
  if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
  if (syncMessageLine) syncMessageLine.textContent = "Status: Not synced yet";

  // Load initial data
  loadUserStats(user.uid);
  renderStudents();
  renderRecentHours();
  renderRecentMarks();
  renderAttendanceRecent();
  renderPaymentActivity();
  renderStudentBalances();
  renderOverviewReports();

  // Start autosync if enabled
  if (autoSyncCheckbox && autoSyncCheckbox.checked) {
    setAutosyncEnabled(true);
  }
}

function teardownOnSignOut() {
  clearAutosyncInterval();
  if (syncIndicator) {
    syncIndicator.classList.remove("sync-active");
    syncIndicator.classList.add("sync-error");
  }
  if (syncMessage) syncMessage.textContent = "Cloud Sync: Disconnected";
  if (syncMessageLine) syncMessageLine.textContent = "Status: Signed out";
}

function boot() {
  bindUiEvents();
  if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
  if (syncMessageLine) syncMessageLine.textContent = "Status: Awaiting authentication";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// Keep UI in sync with auth changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    initAuthenticatedUi(user);
  } else {
    teardownOnSignOut();
  }
});

// ----------------------
// Expose functions to window for inline onclick handlers
// ----------------------
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

window.saveAttendance = addAttendance;
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
