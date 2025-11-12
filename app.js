/* ============================================================================
   Global State
============================================================================ */
let students = JSON.parse(localStorage.getItem("students")) || [];
let hours = JSON.parse(localStorage.getItem("hours")) || [];
let marks = JSON.parse(localStorage.getItem("marks")) || [];
let attendance = JSON.parse(localStorage.getItem("attendance")) || [];
let payments = JSON.parse(localStorage.getItem("payments")) || [];
let defaultRate = parseFloat(localStorage.getItem("defaultRate")) || 25.0;

let appData = { students, hours, marks, attendance, payments, defaultRate };

/* ============================================================================
   Utilities
============================================================================ */
function saveAllData() {
  localStorage.setItem("students", JSON.stringify(students));
  localStorage.setItem("hours", JSON.stringify(hours));
  localStorage.setItem("marks", JSON.stringify(marks));
  localStorage.setItem("attendance", JSON.stringify(attendance));
  localStorage.setItem("payments", JSON.stringify(payments));
  localStorage.setItem("defaultRate", defaultRate);
  appData = { students, hours, marks, attendance, payments, defaultRate };
}

async function saveAllDataWithSync() {
  try {
    saveAllData();
    if (typeof firebaseManager !== "undefined" && firebaseManager.isCloudEnabled()) {
      await firebaseManager.saveData(appData);
      setSyncMessage("✅ Synced");
      setSyncIndicator(true);
    }
  } catch (error) {
    console.warn("Cloud sync failed, but local save succeeded:", error);
    setSyncMessage("⚠️ Local only (sync failed)");
    setSyncIndicator(false);
  }
}

function setSyncMessage(msg) {
  const el = document.getElementById("syncMessage");
  if (el) el.textContent = msg;
}
function setSyncIndicator(connected) {
  const el = document.getElementById("syncIndicator");
  if (!el) return;
  el.classList.toggle("sync-connected", connected);
  el.classList.toggle("sync-disconnected", !connected);
}

function updateHeaderCounts() {
  const dataStatus = document.getElementById("dataStatus");
  if (dataStatus) {
    dataStatus.textContent = `📊 Data: ${students.length} Students, ${hours.length} Sessions`;
  }
}

/* ============================================================================
   Tabs
============================================================================ */
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

/* ============================================================================
   Students
============================================================================ */
async function addStudent() {
  const name = document.getElementById("studentName").value.trim();
  const id = document.getElementById("studentId").value.trim();
  const gender = document.getElementById("studentGender").value;
  const email = document.getElementById("studentEmail").value.trim();
  const phone = document.getElementById("studentPhone").value.trim();
  const rate = parseFloat(document.getElementById("studentBaseRate").value) || defaultRate;

  if (!name || !id || !gender) {
    alert("Please fill required fields.");
    return;
  }
  if (students.some(s => s.id === id)) {
    alert("Student ID must be unique.");
    return;
  }

  students.push({ name, id, gender, email, phone, rate, createdAt: new Date().toISOString() });
  await saveAllDataWithSync();
  renderStudents();
  populateStudentSelects();
  updateStudentStats();
  updateHeaderCounts();
  clearStudentForm();
}

function renderStudents(list = students) {
  const container = document.getElementById("studentsContainer");
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = `<p style="color:#666;text-align:center;padding:40px;">No students registered yet. Add your first student above!</p>`;
    return;
  }
  container.innerHTML = list.map(s => `
    <div class="student-card">
      <div class="student-card-header">
        <strong>${s.name}</strong> <span class="muted">(${s.id})</span>
      </div>
      <div class="student-card-body">
        <div>${s.gender}</div>
        <div>Email: ${s.email || "—"}</div>
        <div>Phone: ${s.phone || "—"}</div>
        <div>Rate: $${Number(s.rate).toFixed(2)}/session</div>
      </div>
    </div>
  `).join("");
}

function clearStudentForm() {
  const form = document.getElementById("studentForm");
  if (form) form.reset();
}

function updateStudentStats() {
  const studentCountEl = document.getElementById("studentCount");
  if (studentCountEl) studentCountEl.textContent = students.length;
  const avgRateEl = document.getElementById("averageRate");
  if (avgRateEl) {
    const avg = students.length ? (students.reduce((a, s) => a + (parseFloat(s.rate) || 0), 0) / students.length) : 0;
    avgRateEl.textContent = avg.toFixed(2);
  }
  const defaultRateEl = document.getElementById("currentDefaultRate");
  if (defaultRateEl) defaultRateEl.textContent = defaultRate.toFixed(2);
  const defaultRateDisplayEl = document.getElementById("currentDefaultRateDisplay");
  if (defaultRateDisplayEl) defaultRateDisplayEl.textContent = defaultRate.toFixed(2);
}

function saveDefaultRate() {
  const val = parseFloat(document.getElementById("defaultBaseRate").value);
  if (!isNaN(val) && val >= 0) {
    defaultRate = val;
    saveAllDataWithSync();
    updateStudentStats();
  } else {
    alert("Please enter a valid default rate (>= 0).");
  }
}
function applyDefaultRateToAll() {
  students.forEach(s => s.rate = defaultRate);
  saveAllDataWithSync();
  renderStudents();
  updateStudentStats();
}
function useDefaultRate() {
  document.getElementById("studentBaseRate").value = defaultRate.toFixed(2);
}
function useDefaultRateInHours() {
  const input = document.getElementById("baseRate");
  if (input) input.value = defaultRate.toFixed(2);
}

/* Search filter */
const studentSearch = document.getElementById("studentSearch");
if (studentSearch) {
  studentSearch.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    const filtered = students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.phone || "").toLowerCase().includes(q)
    );
    renderStudents(filtered);
  });
}

/* Populate selects used across tabs */
function populateStudentSelects() {
  const marksStudent = document.getElementById("marksStudent");
  const paymentStudent = document.getElementById("paymentStudent");
  if (marksStudent) {
    marksStudent.innerHTML = `<option value="">Select student...</option>` +
      students.map(s => `<option value="${s.id}">${s.name} (${s.id})</option>`).join("");
  }
  if (paymentStudent) {
    paymentStudent.innerHTML = `<option value="">Select Student</option>` +
      students.map(s => `<option value="${s.id}">${s.name} (${s.id})</option>`).join("");
  }
  renderAttendanceList();
}

/* ============================================================================
   Hours
============================================================================ */
async function logHours() {
  const org = document.getElementById("organization").value.trim();
  const type = document.getElementById("workType").value;
  const subject = document.getElementById("subject").value.trim();
  const topic = document.getElementById("topic").value.trim();
  const date = document.getElementById("workDate").value;
  const hoursWorked = parseFloat(document.getElementById("hoursWorked").value);
  const rate = parseFloat(document.getElementById("baseRate").value) || defaultRate;
  const notes = document.getElementById("workNotes").value.trim();

  if (!org || !date || isNaN(hoursWorked) || hoursWorked <= 0 || isNaN(rate)) {
    alert("Please fill required fields (valid hours and rate).");
    return;
  }

  const total = hoursWorked * rate;
  const entry = { org, type, subject, topic, date, hoursWorked, rate, total, notes, createdAt: new Date().toISOString() };
  hours.push(entry);
  await saveAllDataWithSync();
  renderHours();
  updateHoursStats();
  document.getElementById("totalPay").value = total.toFixed(2);
  resetHoursForm(false);
}

function renderHours() {
  const container = document.getElementById("hoursContainer");
  if (!container) return;
  if (hours.length === 0) {
    container.innerHTML = `<p style="color:#666;text-align:center;padding:40px;">No work logged yet. Start tracking your earnings!</p>`;
    return;
  }
  const rows = hours
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(h => `
      <div class="hours-entry">
        <div><strong>${h.date}</strong> — ${h.org}</div>
        <div>${h.type} | ${h.subject || "—"} ${h.topic ? "• " + h.topic : ""}</div>
        <div>${h.hoursWorked}h @ $${h.rate}/h = <strong>$${h.total.toFixed(2)}</strong></div>
        <div class="muted">${h.notes || ""}</div>
      </div>
    `).join("");
  container.innerHTML = rows;
}

function updateHoursStats() {
  // Weekly and monthly summary shown in Hours header
  const weeklyHoursEl = document.getElementById("weeklyHours");
  const weeklyTotalEl = document.getElementById("weeklyTotal");
  const monthlyHoursEl = document.getElementById("monthlyHours");
  const monthlyTotalEl = document.getElementById("monthlyTotal");

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let weeklyHours = 0, weeklyTotal = 0, monthlyHours = 0, monthlyTotal = 0;
  hours.forEach(h => {
    const d = new Date(h.date);
    if (d >= startOfWeek) { weeklyHours += h.hoursWorked; weeklyTotal += h.total; }
    if (d >= startOfMonth) { monthlyHours += h.hoursWorked; monthlyTotal += h.total; }
  });

  if (weeklyHoursEl) weeklyHoursEl.textContent = weeklyHours.toFixed(1);
  if (weeklyTotalEl) weeklyTotalEl.textContent = weeklyTotal.toFixed(2);
  if (monthlyHoursEl) monthlyHoursEl.textContent = monthlyHours.toFixed(1);
  if (monthlyTotalEl) monthlyTotalEl.textContent = monthlyTotal.toFixed(2);
}

function resetHoursForm(resetTotal = true) {
  const fields = ["organization","subject","topic","workDate","hoursWorked","baseRate","workNotes"];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.getElementById("workType").value = "hourly";
  if (resetTotal) {
    const totalPay = document.getElementById("totalPay");
    if (totalPay) totalPay.value = "";
  }
}

/* ============================================================================
   Marks
============================================================================ */
async function addMark() {
  const studentId = document.getElementById("marksStudent").value;
  const subject = document.getElementById("markSubject").value.trim();
  const topic = document.getElementById("markTopic").value.trim();
  const date = document.getElementById("markDate").value;
  const score = parseFloat(document.getElementById("score").value);
  const maxScore = parseFloat(document.getElementById("maxScore").value);
  const comments = document.getElementById("markComments").value.trim();

  if (!studentId || !subject || !topic || !date || isNaN(score) || isNaN(maxScore) || maxScore <= 0) {
    alert("Please fill required fields and valid scores.");
    return;
  }

  const percentage = (score / maxScore) * 100;
  const grade = percentage >= 90 ? "A" :
                percentage >= 80 ? "B" :
                percentage >= 70 ? "C" :
                percentage >= 60 ? "D" : "F";

  const m = { studentId, subject, topic, date, score, maxScore, percentage, grade, comments, createdAt: new Date().toISOString() };
  marks.push(m);
  await saveAllDataWithSync();
  renderMarks();
  updateMarksStats();
  // Update live percentage/grade fields
  const percentageEl = document.getElementById("percentage");
  const gradeEl = document.getElementById("grade");
  if (percentageEl) percentageEl.value = `${percentage.toFixed(1)}%`;
  if (gradeEl) gradeEl.value = grade;
}

function renderMarks() {
  const container = document.getElementById("marksContainer");
  if (!container) return;
  if (marks.length === 0) {
    container.innerHTML = `<p style="color:#666;text-align:center;padding:40px;">No marks recorded yet. Add student assessments!</p>`;
    return;
  }
  const rows = marks
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(m => {
      const student = students.find(s => s.id === m.studentId);
      const name = student ? student.name : m.studentId;
      return `
        <div class="mark-entry">
          <div><strong>${m.date}</strong> — ${name} • ${m.subject} • ${m.topic}</div>
          <div>${m.score}/${m.maxScore} (${m.percentage.toFixed(1)}%) — Grade: <strong>${m.grade}</strong></div>
          <div class="muted">${m.comments || ""}</div>
        </div>
      `;
    }).join("");
  container.innerHTML = rows;
}

function updateMarksStats() {
  const marksCountEl = document.getElementById("marksCount");
  const avgMarksEl = document.getElementById("avgMarks");
  if (marksCountEl) marksCountEl.textContent = marks.length;
  if (avgMarksEl) {
    const avg = marks.length ? (marks.reduce((a, m) => a + m.percentage, 0) / marks.length) : 0;
    avgMarksEl.textContent = `${avg.toFixed(1)}%`;
  }
}

/* ============================================================================
   Attendance
============================================================================ */
function renderAttendanceList() {
  const list = document.getElementById("attendanceList");
  if (!list) return;
  if (students.length === 0) {
    list.innerHTML = `<p style="color:#666;text-align:center;padding:20px;">No students registered. Add students first.</p>`;
    return;
  }
  list.innerHTML = students.map(s => `
    <label class="attendance-item">
      <input type="checkbox" class="attendance-checkbox" value="${s.id}">
      <span>${s.name} (${s.id})</span>
    </label>
  `).join("");
}

function selectAllStudents() {
  document.querySelectorAll(".attendance-checkbox").forEach(cb => cb.checked = true);
}
function deselectAllStudents() {
  document.querySelectorAll(".attendance-checkbox").forEach(cb => cb.checked = false);
}

async function saveAttendance() {
  const date = document.getElementById("attendanceDate").value;
  const subject = document.getElementById("attendanceSubject").value.trim();
  const topic = document.getElementById("attendanceTopic").value.trim();

  if (!date || !subject) {
    alert("Please fill required fields.");
    return;
  }

  const presentIds = Array.from(document.querySelectorAll(".attendance-checkbox"))
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  const record = { date, subject, topic, presentIds, createdAt: new Date().toISOString() };
  attendance.push(record);
  await saveAllDataWithSync();
  renderAttendance();
  updateAttendanceStats();
  clearAttendanceForm();
}

function renderAttendance() {
  const container = document.getElementById("attendanceContainer");
  if (!container) return;
  if (attendance.length === 0) {
    container.innerHTML = `<p style="color:#666;text-align:center;padding:40px;">No attendance records yet. Track your first session!</p>`;
    return;
  }
  container.innerHTML = attendance
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(a => `
      <div class="attendance-entry">
        <div><strong>${a.date}</strong> — ${a.subject}${a.topic ? " • " + a.topic : ""}</div>
        <div>Present: ${a.presentIds.length}/${students.length}</div>
      </div>
    `).join("");
}

function clearAttendanceForm() {
  ["attendanceDate","attendanceSubject","attendanceTopic"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  deselectAllStudents();
}

function updateAttendanceStats() {
  const countEl = document.getElementById("attendanceCount");
  const lastEl = document.getElementById("lastSessionDate");
  if (countEl) countEl.textContent = attendance.length;
  if (lastEl) {
    const last = attendance.slice().sort((a,b) => new Date(b.date) - new Date(a.date))[0];
    lastEl.textContent = last ? last.date : "Never";
  }
}

/* ============================================================================
   Payments
============================================================================ */
async function recordPayment() {
  const studentId = document.getElementById("paymentStudent").value;
  const amount = parseFloat(document.getElementById("paymentAmount").value);
  const date = document.getElementById("paymentDate").value;
  const method = document.getElementById("paymentMethod").value;
  const notes = document.getElementById("paymentNotes").value.trim();

  if (!studentId || isNaN(amount) || amount <= 0 || !date) {
    alert("Please fill required fields with a valid amount.");
    return;
  }

  payments.push({ studentId, amount, date, method, notes, createdAt: new Date().toISOString() });
  await saveAllDataWithSync();
  renderPayments();
  renderPaymentActivity();
  updatePaymentsStats();
  resetPaymentForm();
}

function renderPayments() {
  const container = document.getElementById("studentBalancesContainer");
  if (!container) return;

  if (students.length === 0) {
    container.innerHTML = `<p style="color:#666;text-align:center;padding:40px;">No students with balances. Add students and payments first.</p>`;
    return;
  }

  // Compute balances: sessions owed (from hours by subject/session?) — baseline: show total payments per student
  const perStudent = new Map();
  students.forEach(s => perStudent.set(s.id, { student: s, paid: 0, sessions: 0, owed: 0 }));

  payments.forEach(p => {
    const entry = perStudent.get(p.studentId);
    if (entry) entry.paid += p.amount;
  });

  // Optionally, tie "owed" to hours or session rate — here we’ll use hours total by subject/student if topic contains student ID
  // For simplicity in this baseline, owed is 0 unless you compute from your business rules.

  const cards = Array.from(perStudent.values()).map(({ student, paid, owed }) => `
    <div class="student-card">
      <div class="student-card-header">
        <strong>${student.name}</strong> <span class="muted">(${student.id})</span>
      </div>
      <div class="student-card-body">
        <div>Total Paid: <strong>$${paid.toFixed(2)}</strong></div>
        <div>Owed: <strong>$${owed.toFixed(2)}</strong></div>
      </div>
    </div>
  `).join("");

  container.innerHTML = cards || `<p style="color:#666;text-align:center;padding:40px;">No payment data yet.</p>`;
}

function renderPaymentActivity() {
  const log = document.getElementById("paymentActivityLog");
  if (!log) return;
  if (payments.length === 0) {
    log.innerHTML = `<p style="color:#666;text-align:center;padding:20px;">No recent payment activity.</p>`;
    return;
  }
  log.innerHTML = payments
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(p => {
      const s = students.find(st => st.id === p.studentId);
      const name = s ? s.name : p.studentId;
      return `
        <div class="activity-item">
          <div><strong>${p.date}</strong> — ${name}</div>
          <div>$${p.amount.toFixed(2)} via ${p.method}</div>
          <div class="muted">${p.notes || ""}</div>
        </div>
      `;
    }).join("");
}

function updatePaymentsStats() {
  const totalStudentsCountEl = document.getElementById("totalStudentsCount");
  if (totalStudentsCountEl) totalStudentsCountEl.textContent = students.length;

  const monthlyPaymentsEl = document.getElementById("monthlyPayments");
  const totalOwedEl = document.getElementById("totalOwed");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthly = payments.filter(p => new Date(p.date) >= startOfMonth)
                          .reduce((a, p) => a + p.amount, 0);
  if (monthlyPaymentsEl) monthlyPaymentsEl.textContent = `$${monthly.toFixed(2)}`;

  // Owed baseline — set to 0 unless you define owed logic
  const totalOwed = 0;
  if (totalOwedEl) totalOwedEl.textContent = `$${totalOwed.toFixed(2)}`;
}

function resetPaymentForm() {
  ["paymentStudent","paymentAmount","paymentDate","paymentMethod","paymentNotes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const method = document.getElementById("paymentMethod");
  if (method) method.value = "Cash";
}

/* ============================================================================
   Reports
============================================================================ */
function updateReports() {
  const totalStudentsReport = document.getElementById("totalStudentsReport");
  const totalHoursReport = document.getElementById("totalHoursReport");
  const totalEarningsReport = document.getElementById("totalEarningsReport");
  const avgMarkReport = document.getElementById("avgMarkReport");
  const totalPaymentsReport = document.getElementById("totalPaymentsReport");
  const outstandingBalance = document.getElementById("outstandingBalance");

  if (totalStudentsReport) totalStudentsReport.textContent = students.length;
  const totalHours = hours.reduce((a, h) => a + h.hoursWorked, 0);
  const totalEarn = hours.reduce((a, h) => a + h.total, 0);
  if (totalHoursReport) totalHoursReport.textContent = totalHours.toFixed(1);
  if (totalEarningsReport) totalEarningsReport.textContent = `$${totalEarn.toFixed(2)}`;

  const avgMark = marks.length ? (marks.reduce((a, m) => a + m.percentage, 0) / marks.length) : 0;
  if (avgMarkReport) avgMarkReport.textContent = `${avgMark.toFixed(1)}%`;

  const totalPaid = payments.reduce((a, p) => a + p.amount, 0);
  if (totalPaymentsReport) totalPaymentsReport.textContent = `$${totalPaid.toFixed(2)}`;

  // Outstanding baseline: earnings - payments (simple view)
  const outstanding = Math.max(totalEarn - totalPaid, 0);
  if (outstandingBalance) outstandingBalance.textContent = `$${outstanding.toFixed(2)}`;

  // Clear breakdown tables initially
  const weeklyBody = document.getElementById("weeklyBody");
  const subjectBody = document.getElementById("subjectBody");
  if (weeklyBody) weeklyBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">No weekly data available</td></tr>`;
  if (subjectBody) subjectBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">No subject data available</td></tr>`;
}

function showWeeklyBreakdown() {
  const weeklyBody = document.getElementById("weeklyBody");
  if (!weeklyBody) return;
  const byWeek = new Map();
  hours.forEach(h => {
    const date = new Date(h.date);
    const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
    if (!byWeek.has(weekKey)) byWeek.set(weekKey, { hours: 0, earnings: 0, subjects: new Set() });
    const acc = byWeek.get(weekKey);
    acc.hours += h.hoursWorked;
    acc.earnings += h.total;
    if (h.subject) acc.subjects.add(h.subject);
  });
  const rows = Array.from(byWeek.entries()).sort((a,b) => a[0] < b[0] ? 1 : -1).map(([wk, acc]) => `
    <tr>
      <td>${wk}</td>
      <td>${acc.hours.toFixed(1)}</td>
      <td>$${acc.earnings.toFixed(2)}</td>
      <td>${Array.from(acc.subjects).join(", ") || "—"}</td>
      <td>$${(acc.earnings * 0.80).toFixed(2)}</td>
    </tr>
  `).join("");
  weeklyBody.innerHTML = rows || `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">No weekly data available</td></tr>`;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function showBiWeeklyBreakdown() {
  // Simple bi-weekly aggregation by week number pairing
  const weeklyBody = document.getElementById("weeklyBody");
  if (!weeklyBody) return;
  const byBiWeek = new Map();
  hours.forEach(h => {
    const date = new Date(h.date);
    const wn = getWeekNumber(date);
    const key = `${date.getFullYear()}-BW${Math.ceil(wn / 2)}`;
    if (!byBiWeek.has(key)) byBiWeek.set(key, { hours: 0, earnings: 0, subjects: new Set() });
    const acc = byBiWeek.get(key);
    acc.hours += h.hoursWorked;
    acc.earnings += h.total;
    if (h.subject) acc.subjects.add(h.subject);
  });
  const rows = Array.from(byBiWeek.entries()).sort((a,b) => a[0] < b[0] ? 1 : -1).map(([bw, acc]) => `
    <tr>
      <td>${bw}</td>
      <td>${acc.hours.toFixed(1)}</td>
      <td>$${acc.earnings.toFixed(2)}</td>
      <td>${Array.from(acc.subjects).join(", ") || "—"}</td>
      <td>$${(acc.earnings * 0.80).toFixed(2)}</td>
    </tr>
  `).join("");
  weeklyBody.innerHTML = rows || `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">No bi-weekly data available</td></tr>`;
}

function showMonthlyBreakdown() {
  const weeklyBody = document.getElementById("weeklyBody");
  if (!weeklyBody) return;
  const byMonth = new Map();
  hours.forEach(h => {
    const date = new Date(h.date);
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
    if (!byMonth.has(key)) byMonth.set(key, { hours: 0, earnings: 0, subjects: new Set() });
    const acc = byMonth.get(key);
    acc.hours += h.hoursWorked;
    acc.earnings += h.total;
    if (h.subject) acc.subjects.add(h.subject);
  });
  const rows = Array.from(byMonth.entries()).sort((a,b) => a[0] < b[0] ? 1 : -1).map(([mo, acc]) => `
    <tr>
      <td>${mo}</td>
      <td>${acc.hours.toFixed(1)}</td>
      <td>$${acc.earnings.toFixed(2)}</td>
      <td>${Array.from(acc.subjects).join(", ") || "—"}</td>
      <td>$${(acc.earnings * 0.80).toFixed(2)}</td>
    </tr>
  `).join("");
  weeklyBody.innerHTML = rows || `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">No monthly data available</td></tr>`;
}

function showSubjectBreakdown() {
  const subjectBody = document.getElementById("subjectBody");
  if (!subjectBody) return;
  const bySubject = new Map();
  // Aggregate from marks and hours
  marks.forEach(m => {
    const key = m.subject || "—";
    if (!bySubject.has(key)) bySubject.set(key, { scores: [], hours: 0, earnings: 0, sessions: 0 });
    bySubject.get(key).scores.push(m.percentage);
  });
  hours.forEach(h => {
    const key = h.subject || "—";
    if (!bySubject.has(key)) bySubject.set(key, { scores: [], hours: 0, earnings: 0, sessions: 0 });
    const acc = bySubject.get(key);
    acc.hours += h.hoursWorked;
    acc.earnings += h.total;
    acc.sessions += 1;
  });

  const rows = Array.from(bySubject.entries()).map(([sub, acc]) => {
    const avg = acc.scores.length ? (acc.scores.reduce((a, s) => a + s, 0) / acc.scores.length) : 0;
    return `
      <tr>
        <td>${sub}</td>
        <td>${avg.toFixed(1)}%</td>
        <td>${acc.hours.toFixed(1)}</td>
        <td>$${acc.earnings.toFixed(2)}</td>
        <td>${acc.sessions}</td>
      </tr>
    `;
  }).join("");
  subjectBody.innerHTML = rows || `<tr><td colspan="5" style="text-align:center;color:#666;padding:20px;">No subject data available</td></tr>`;
}

/* ============================================================================
   Import/Export Local
============================================================================ */
function exportData() {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `worklog-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.getElementById("importFile") || (() => {
    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".json";
    document.body.appendChild(file);
    return file;
  })();
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      students = Array.isArray(data.students) ? data.students : [];
      hours = Array.isArray(data.hours) ? data.hours : [];
      marks = Array.isArray(data.marks) ? data.marks : [];
      attendance = Array.isArray(data.attendance) ? data.attendance : [];
      payments = Array.isArray(data.payments) ? data.payments : [];
      defaultRate = typeof data.defaultRate === "number" ? data.defaultRate : defaultRate;
      await saveAllDataWithSync();
      // re-render everything
      renderStudents();
      populateStudentSelects();
      updateStudentStats();
      renderHours();
      updateHoursStats();
      renderMarks();
      updateMarksStats();
      renderAttendance();
      updateAttendanceStats();
      renderPayments();
      renderPaymentActivity();
      updatePaymentsStats();
      updateReports();
      alert("Data imported successfully.");
    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  input.click();
}

function clearAllData() {
  if (!confirm("This will clear all local data. Continue?")) return;
  students = [];
  hours = [];
  marks = [];
  attendance = [];
  payments = [];
  saveAllDataWithSync();
  // Refresh UI
  renderStudents();
  populateStudentSelects();
  updateStudentStats();
  renderHours();
  updateHoursStats();
  renderMarks();
  updateMarksStats();
  renderAttendance();
  updateAttendanceStats();
  renderPayments();
  renderPaymentActivity();
  updatePaymentsStats();
  updateReports();
  updateHeaderCounts();
}

/* ============================================================================
   Cloud Sync UI + Controls (Firebase Manager)
============================================================================ */
function setupCloudSyncUI() {
  const statusEl = document.getElementById("syncStatus"); // header area shows text; cloud bar has indicator/message
  if (statusEl) statusEl.textContent = "☁️ Cloud Sync: Ready";
  setSyncMessage("Connecting to cloud...");
  setSyncIndicator(false);

  const autoSyncCheckbox = document.getElementById("autoSyncCheckbox");
  if (autoSyncCheckbox) {
    autoSyncCheckbox.checked = !!(typeof firebaseManager !== "undefined" && firebaseManager.isCloudEnabled());
    autoSyncCheckbox.addEventListener("change", async (e) => {
      if (typeof firebaseManager === "undefined") {
        alert("Cloud manager is not available.");
        e.target.checked = false;
        return;
      }
      if (e.target.checked) {
        await firebaseManager.enableCloudSync();
        setSyncMessage("✅ Cloud enabled");
        setSyncIndicator(true);
        await firebaseManager.manualSync(appData);
      } else {
        await firebaseManager.signOut();
        setSyncMessage("🔴 Cloud disabled");
        setSyncIndicator(false);
      }
    });
  }

  const syncBtn = document.getElementById("syncBtn");
  if (syncBtn) {
    syncBtn.style.display = "inline-block";
    syncBtn.addEventListener("click", async () => {
      setSyncMessage("Syncing...");
      await saveAllDataWithSync();
    });
  }

  const exportCloudBtn = document.getElementById("exportCloudBtn");
  if (exportCloudBtn) {
    exportCloudBtn.addEventListener("click", async () => {
      if (typeof firebaseManager === "undefined" || !firebaseManager.isCloudEnabled()) {
        alert("Enable cloud sync first.");
        return;
      }
      const data = await firebaseManager.fetchData();
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cloud-export-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert("No cloud data available.");
      }
    });
  }

  const importCloudBtn = document.getElementById("importCloudBtn");
  if (importCloudBtn) {
    importCloudBtn.addEventListener("click", async () => {
      if (typeof firebaseManager === "undefined" || !firebaseManager.isCloudEnabled()) {
        alert("Enable cloud sync first.");
        return;
      }
      await firebaseManager.saveData(appData);
      setSyncMessage("✅ Uploaded local data to cloud");
    });
  }

  const syncStatsBtn = document.getElementById("syncStatsBtn");
  if (syncStatsBtn) {
    syncStatsBtn.addEventListener("click", () => {
      showSyncStats();
    });
  }
}

async function showSyncStats() {
  const modal = document.getElementById("syncStatsModal");
  const content = document.getElementById("syncStatsContent");
  if (!modal || !content) return;
  modal.style.display = "block";
  content.innerHTML = `<p>Loading sync statistics...</p>`;
  try {
    let stats = null;
    if (typeof firebaseManager !== "undefined" && firebaseManager.isCloudEnabled()) {
      stats = await firebaseManager.getStats();
    }
    if (!stats) {
      stats = {
        students: students.length,
        hours: hours.length,
        marks: marks.length,
        attendance: attendance.length,
        payments: payments.length,
        lastSync: new Date().toLocaleString()
      };
    }
    content.innerHTML = `
      <div class="stats-grid">
        <div><strong>Students:</strong> ${stats.students}</div>
        <div><strong>Hours:</strong> ${stats.hours}</div>
        <div><strong>Marks:</strong> ${stats.marks}</div>
        <div><strong>Attendance:</strong> ${stats.attendance}</div>
        <div><strong>Payments:</strong> ${stats.payments}</div>
        <div><strong>Last Sync:</strong> ${stats.lastSync || "—"}</div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p style="color:#dc3545;">Failed to load stats.</p>`;
  }
}
function closeSyncStats() {
  const modal = document.getElementById("syncStatsModal");
  if (modal) modal.style.display = "none";
}

/* ============================================================================
   Auth menu (UI stubs)
============================================================================ */
const authButton = document.getElementById("authButton");
if (authButton) {
  authButton.addEventListener("click", () => {
    const menu = document.getElementById("userMenu");
    if (menu) {
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    }
  });
}
const profileBtn = document.getElementById("profileBtn");
if (profileBtn) {
  profileBtn.addEventListener("click", () => {
    alert("Profile & Settings coming soon.");
  });
}
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (typeof firebaseManager !== "undefined" && firebaseManager.isCloudEnabled()) {
      await firebaseManager.signOut();
      setSyncMessage("🔴 Logged out from cloud");
      setSyncIndicator(false);
    }
    const menu = document.getElementById("userMenu");
    if (menu) menu.style.display = "none";
  });
}

/* Close user menu when clicking outside */
document.addEventListener("click", function(event) {
  const userMenu = document.getElementById("userMenu");
  const authBtn = document.getElementById("authButton");
  if (userMenu && authBtn && !authBtn.contains(event.target) && !userMenu.contains(event.target)) {
    userMenu.style.display = "none";
  }
});

/* ============================================================================
   Wire buttons in Cloud/App Controls bar
============================================================================ */
const exportDataBtn = document.getElementById("exportDataBtn");
if (exportDataBtn) exportDataBtn.addEventListener("click", exportData);

const importDataBtn = document.getElementById("importDataBtn");
if (importDataBtn) importDataBtn.addEventListener("click", importData);

const clearDataBtn = document.getElementById("clearDataBtn");
if (clearDataBtn) clearDataBtn.addEventListener("click", clearAllData);

/* ============================================================================
   Initialization
============================================================================ */
function init() {
  // Initial renders
  renderStudents();
  populateStudentSelects();
  updateStudentStats();

  renderHours();
  updateHoursStats();

  renderMarks();
  updateMarksStats();

  renderAttendance();
  updateAttendanceStats();

  renderPayments();
  renderPaymentActivity();
  updatePaymentsStats();

  updateReports();
  updateHeaderCounts();

  // Cloud sync UI
  setupCloudSyncUI();

  // Hook action buttons that rely on inline HTML onClick — ensure availability on window
  window.addStudent = addStudent;
  window.clearStudentForm = clearStudentForm;
  window.saveDefaultRate = saveDefaultRate;
  window.applyDefaultRateToAll = applyDefaultRateToAll;
  window.useDefaultRate = useDefaultRate;

  window.useDefaultRateInHours = useDefaultRateInHours;
  window.logHours = logHours;
  window.resetHoursForm = resetHoursForm;

  window.addMark = addMark;

  window.selectAllStudents = selectAllStudents;
  window.deselectAllStudents = deselectAllStudents;
  window.saveAttendance = saveAttendance;
  window.clearAttendanceForm = clearAttendanceForm;

  window.recordPayment = recordPayment;
  window.resetPaymentForm = resetPaymentForm;

  window.exportData = exportData;
  window.importData = importData;
  window.clearAllData = clearAllData;

  window.showWeeklyBreakdown = showWeeklyBreakdown;
  window.showBiWeeklyBreakdown = showBiWeeklyBreakdown;
  window.showMonthlyBreakdown = showMonthlyBreakdown;
  window.showSubjectBreakdown = showSubjectBreakdown;

  window.showSyncStats = showSyncStats;
  window.closeSyncStats = closeSyncStats;

  // Ready
  setSyncMessage("Ready");
}

document.addEventListener("DOMContentLoaded", init);
