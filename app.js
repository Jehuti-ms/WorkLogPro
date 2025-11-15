// app.js — WorkLog main application logic
// Loaded via <script type="module" src="app.js"></script> in index.html

import { auth, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ----------------------
// DOM Elements (defensive)
// ----------------------
const autoSyncCheckbox = document.getElementById("autoSyncCheckbox");
const autoSyncText     = document.getElementById("autoSyncText");
const syncBtn          = document.getElementById("syncBtn");
const syncIndicator    = document.getElementById("syncIndicator");
const syncMessage      = document.getElementById("syncMessage");
const syncMessageLine  = document.getElementById("syncMessageLine");
const syncSpinner      = document.getElementById("syncSpinner");
const statStudents     = document.getElementById("statStudents");
const statHours        = document.getElementById("statHours");
const statEarnings     = document.getElementById("statEarnings");
const statUpdated      = document.getElementById("statUpdated");

// Reports and other UI
const weeklyBody       = document.getElementById("weeklyBody");
const subjectBody      = document.getElementById("subjectBody");

let autoSyncInterval = null;

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
    if (!navigator.onLine) {
      console.warn("⚠️ Offline mode: skipping stats load");
      if (syncMessageLine) syncMessageLine.textContent = "Status: Offline - stats unavailable";
      return;
    }

    const statsRef = doc(db, "users", uid);
    const statsSnap = await getDoc(statsRef);

    if (statsSnap.exists()) {
      const stats = statsSnap.data();
      if (statStudents) statStudents.textContent = stats.students ?? 0;
      if (statHours)    statHours.textContent    = stats.hours ?? 0;
      if (statEarnings) statEarnings.textContent = stats.earnings != null
        ? fmtMoney(stats.earnings)
        : "0.00";
    } else {
      await setDoc(statsRef, { students: 0, hours: 0, earnings: 0 });
      if (statStudents) statStudents.textContent = 0;
      if (statHours)    statHours.textContent    = 0;
      if (statEarnings) statEarnings.textContent = "0.00";
    }

    refreshTimestamp();
  } catch (err) {
    console.error("❌ Error loading stats:", err);
    if (syncMessageLine) syncMessageLine.textContent = "Status: Failed to load stats";
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
    earnings: totalEarnings
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("✅ User authenticated:", user.email);
    await loadUserStats(user.uid);
  } else {
    console.warn("No user signed in, skipping stats load");
  }
});

// ----------------------
// Sync (manual/auto)
// ----------------------
async function performSync(uid, mode = "Manual") {
  if (!uid) return;

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

// Run after DOM is ready
document.addEventListener("DOMContentLoaded", initTabs);

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
  if (studentsSnap.empty) {
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

  if (marksStudentSelect) {
    marksStudentSelect.innerHTML = "";
  }
  if (paymentStudentSelect) {
    paymentStudentSelect.innerHTML = "";
  }
  if (attendanceList) {
    attendanceList.innerHTML = "";
  }

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

function addStudent() {
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
    const studentRef = doc(db, "users", user.uid, "students", id);
    setDoc(studentRef, student).then(async () => {
      console.log("✅ Student added:", student);
      clearStudentForm();
      await renderStudents();
      await recalcSummaryStats(user.uid);
    }).catch(err => console.error("❌ Error adding student:", err));
  }
}

// ----------------------
// Students Tab Reset
// ----------------------
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
function useDefaultRateInHours() {
  const defaultRateDisplay = document.getElementById("currentDefaultRateDisplay");
  const baseRateInput = document.getElementById("baseRate");
  if (defaultRateDisplay && baseRateInput) {
    baseRateInput.value = parseFloat(defaultRateDisplay.textContent) || 0;
  }
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
  const hours        = parseFloat(hoursEl?.value) || 0;
  const rate         = parseFloat(rateEl?.value) || 0;

  if (!organization || !workDate || hours <= 0 || rate <= 0) {
    alert("Please fill required fields: Organization, Date, Hours, Rate");
    return;
  }

  const total = workType === "hourly" ? hours * rate : rate;
  if (totalEl) totalEl.value = fmtMoney(total);

  const user = auth.currentUser;
  if (!user) return;
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
  await recalcSummaryStats(user.uid);
  refreshTimestamp();
  await renderRecentHours();
  resetHoursForm();
}

// ----------------------
// Render recent hours
// ----------------------
async function renderRecentHours(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById("hoursContainer");
  if (!container) return;

  container.innerHTML = "";

  const snap = await getDocs(collection(db, "users", user.uid, "hours"));
  const rows = [];
  snap.forEach(d => rows.push(d.data()));
  rows.sort((a, b) => (a.dateIso || "") < (b.dateIso || "") ? 1 : -1);

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



// ----------------------
// Marks Tab
// ----------------------
async function addMark() {
  const studentEl = document.getElementById("marksStudent");
  const subjectEl = document.getElementById("markSubject");
  const topicEl   = document.getElementById("markTopic");
  const dateEl    = document.getElementById("markDate");
  const scoreEl   = document.getElementById("score");
  const maxEl     = document.getElementById("maxScore");
  const pctEl     = document.getElementById("percentage");
  const gradeEl   = document.getElementById("grade");

  const student = studentEl?.value;
  const subject = subjectEl?.value.trim();
  const topic   = topicEl?.value.trim();
  const date    = dateEl?.value;
  const score   = parseFloat(scoreEl?.value);
  const max     = parseFloat(maxEl?.value);

  if (!student || !subject || !topic || !date || !Number.isFinite(score) || !Number.isFinite(max) || max <= 0) {
    alert("Please fill all required fields and ensure score/max are valid");
    return;
  }

  const pctVal = (score / max) * 100;
  const percentage = pctVal.toFixed(2);
  const grade = pctVal >= 90 ? "A" :
                pctVal >= 80 ? "B" :
                pctVal >= 70 ? "C" :
                pctVal >= 60 ? "D" : "F";

  if (pctEl)   pctEl.value   = `${percentage}%`;
  if (gradeEl) gradeEl.value = grade;

  const user = auth.currentUser;
  if (!user) return;
  await addDoc(collection(db, "users", user.uid, "marks"), {
    student, subject, topic, date, percentage: pctVal, score, max
  });

  console.log("✅ Mark saved");
  refreshTimestamp();
  await renderRecentMarks();
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
  rows.sort((a, b) => (a.date || "") < (b.date || "") ? 1 : -1);

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

// ----------------------
// Marks Tab Reset
// ----------------------
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
async function saveAttendance() {
  const dateEl    = document.getElementById("attendanceDate");
  const subjectEl = document.getElementById("attendanceSubject");
  const topicEl   = document.getElementById("attendanceTopic");

  const date    = dateEl?.value;
  const subject = subjectEl?.value.trim();
  const topic   = topicEl?.value.trim();

  if (!date || !subject) {
    alert("Please fill required fields: Date, Subject");
    return;
  }

  const presentStudents = [];
  document.querySelectorAll("#attendanceList input[type=checkbox]:checked")
    .forEach(cb => presentStudents.push(cb.value));

  const record = { date, subject, topic, present: presentStudents };

  const user = auth.currentUser;
  if (!user) return;

  await addDoc(collection(db, "users", user.uid, "attendance"), record);
  console.log("✅ Attendance saved");
  refreshTimestamp();
  await renderAttendanceRecent();
}

// ----------------------
// Attendance Tab Reset
// ----------------------
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
  rows.sort((a, b) => (a.date || "") < (b.date || "") ? 1 : -1);

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

  const lastSessionDateEl = document.getElementById("lastSessionDate");
  if (lastSessionDateEl) lastSessionDateEl.textContent = rows[0]?.date || "Never";

  const attendanceCountEl = document.getElementById("attendanceCount");
  if (attendanceCountEl) attendanceCountEl.textContent = rows.length;
}

// ----------------------
// Payments Tab
// ----------------------
async function recordPayment() {
  const studentEl = document.getElementById("paymentStudent");
  const amountEl  = document.getElementById("paymentAmount");
  const dateEl    = document.getElementById("paymentDate");
  const methodEl  = document.getElementById("paymentMethod");
  const notesEl   = document.getElementById("paymentNotes");

  const student = studentEl?.value;
  const amount  = parseFloat(amountEl?.value);
  const date    = dateEl?.value;
  const method  = methodEl?.value;
  const notes   = notesEl?.value.trim();

  if (!student || !Number.isFinite(amount) || amount <= 0 || !date) {
    alert("Please fill required fields: Student, Amount (>0), Date");
    return;
  }

  const payment = { student, amount, date, method, notes };

  const user = auth.currentUser;
  if (!user) return;
  await addDoc(collection(db, "users", user.uid, "payments"), payment);

  console.log("✅ Payment recorded");
  refreshTimestamp();
  await renderPaymentActivity();
  await renderStudentBalances();
  resetPaymentForm();
}

// ----------------------
// Payments Tab Reset
// ----------------------
function resetPaymentForm() {
  const studentEl = document.getElementById("paymentStudent");
  const amountEl  = document.getElementById("paymentAmount");
  const dateEl    = document.getElementById("paymentDate");
  const methodEl  = document.getElementById("paymentMethod");
  const notesEl   = document.getElementById("paymentNotes");

  if (studentEl) studentEl.value = "";
  if (amountEl)  amountEl.value  = "";
  if (dateEl)    dateEl.value    = "";
  if (methodEl)  methodEl.value  = "Cash";
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
  rows.sort((a, b) => (a.date || "") < (b.date || "") ? 1 : -1);

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

  // Summary UI
  const monthlyEl = document.getElementById("monthlyPayments");
  if (monthlyEl) {
    // Simple monthly filter by yyyy-mm from date string
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const sum = rows
      .filter(r => (r.date || "").startsWith(ym))
      .reduce((s, r) => s + safeNumber(r.amount), 0);
    monthlyEl.textContent = `$${fmtMoney(sum)}`;
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

  const totalStudentsEl = document.getElementById("totalStudentsCount");
  const totalOwedEl     = document.getElementById("totalOwed");
  if (totalStudentsEl) totalStudentsEl.textContent = studentsSnap.size;
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

  // Group by ISO week (Mon-start approximate using date)
  const groups = {};
  rows.forEach(r => {
    const d = new Date(r.date || r.dateIso || new Date().toISOString());
    const year = d.getFullYear();
    const tmp = new Date(d);
    tmp.setHours(0,0,0,0);
    // approximate week number
    const oneJan = new Date(year, 0, 1);
    const week = Math.ceil((((tmp - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
    const key = `${year}-W${String(week).padStart(2,"0")}`;
    if (!groups[key]) groups[key] = { hours: 0, earnings: 0, subjects: new Set() };
    groups[key].hours += safeNumber(r.hours);
    groups[key].earnings += safeNumber(r.total);
    if (r.subject) groups[key].subjects.add(r.subject);
  });

  const keys = Object.keys(groups).sort().reverse();
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
  // Simple approach: reuse weekly and merge pairs
  await showWeeklyBreakdown();
  // Optionally implement real bi-weekly groups if needed
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

  const keys = Object.keys(groups).sort().reverse();
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
    const subj = r.subject || "Unknown";
    if (!bySubject[subj]) bySubject[subj] = { marks: [], hours: 0, earnings: 0, sessions: 0 };
    bySubject[subj].marks.push(safeNumber(r.percentage));
  });

  hoursSnap.forEach(d => {
    const r = d.data();
    const subj = r.subject || "General";
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

  const totalStudentsReport = document.getElementById("totalStudentsReport");
  const totalHoursReport    = document.getElementById("totalHoursReport");
  const totalEarningsReport = document.getElementById("totalEarningsReport");
  const avgMarkReport       = document.getElementById("avgMarkReport");
  const totalPaymentsReport = document.getElementById("totalPaymentsReport");
  const outstandingBalance  = document.getElementById("outstandingBalance");

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

  // Students
  document.getElementById("studentForm")?.addEventListener("submit", e => e.preventDefault());
  // Buttons are inline onclick in HTML for addStudent, clearStudentForm, etc.

  // Hours
  // Buttons are inline onclick in HTML for logHours, resetHoursForm, useDefaultRateInHours

  // Marks
  document.getElementById("marksForm")?.addEventListener("submit", e => e.preventDefault());

  // Attendance
  // Buttons are inline onclick in HTML for saveAttendance, clearAttendanceForm, select/deselect

  // Payments
  // Buttons are inline onclick in HTML for recordPayment, resetPaymentForm

  // Reports buttons are inline onclick in HTML
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
  const user = auth.currentUser;
  if (user) {
    initAuthenticatedUi(user);
  } else {
    if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
    if (syncMessageLine) syncMessageLine.textContent = "Status: Awaiting authentication";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// Keep UI in sync with auth changes (index.html also handles redirect)
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
