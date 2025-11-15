// ===========================
// MISSING IMPORTS & INITIALIZATION
// ===========================

import { 
  writeBatch,
  query, 
  orderBy,
  where,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Initialize global state
let currentUser = null;
let studentsList = [];

// ===========================
// ENHANCED UTILITY FUNCTIONS
// ===========================

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
    color: white;
    border-radius: 4px;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
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

// ===========================
// ENHANCED STUDENTS MANAGEMENT
// ===========================

async function loadStudentsForDropdowns() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
    studentsList = [];
    studentsSnap.forEach(doc => {
      studentsList.push({ id: doc.id, ...doc.data() });
    });
    
    // Update all dropdowns
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
    'hoursStudent' // Add this for hours tracking per student
  ];
  
  dropdowns.forEach(dropdownId => {
    const select = document.getElementById(dropdownId);
    if (select) {
      // Clear existing options except the first one
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

// Enhanced addStudent with validation
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
    showNotification("Please fill required fields: Name, ID, Gender", "error");
    return;
  }

  // Validate ID uniqueness
  const existingStudent = studentsList.find(s => s.id === id);
  if (existingStudent) {
    showNotification("Student ID already exists", "error");
    return;
  }

  const student = { 
    name, 
    id, 
    gender, 
    email, 
    phone, 
    rate,
    createdAt: new Date().toISOString(),
    active: true
  };

  const user = auth.currentUser;
  if (user) {
    try {
      const studentRef = doc(db, "users", user.uid, "students", id);
      await setDoc(studentRef, student);
      
      showNotification("Student added successfully", "success");
      clearStudentForm();
      await renderStudents();
      await loadStudentsForDropdowns();

    } catch (err) {
      console.error("Error adding student:", err);
      showNotification("Failed to add student", "error");
    }
  }
}

// Enhanced student rendering with actions
async function renderStudents() {
  const user = auth.currentUser;
  if (!user) return;

  const container = document.getElementById("studentsContainer");
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
    const students = [];
    
    studentsSnap.forEach(docSnap => {
      const student = { id: docSnap.id, ...docSnap.data() };
      students.push(student);
      
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

// ===========================
// ENHANCED HOURS LOGGING
// ===========================

// Enhanced logHours function with student association
async function logHours() {
  const studentEl = document.getElementById("hoursStudent");
  const orgEl = document.getElementById("organization");
  const subjectEl = document.getElementById("workSubject");
  const typeEl = document.getElementById("workType");
  const dateEl = document.getElementById("workDate");
  const hoursEl = document.getElementById("hoursWorked");
  const rateEl = document.getElementById("baseRate");
  const totalEl = document.getElementById("totalPay");

  const studentId = studentEl?.value;
  const organization = orgEl?.value.trim();
  const subject = subjectEl?.value.trim() || "General";
  const workType = typeEl?.value || "hourly";
  const workDate = dateEl?.value;
  const hours = parseFloat(hoursEl?.value);
  const rate = parseFloat(rateEl?.value);

  if (!organization || !workDate || !Number.isFinite(hours) || hours <= 0 || !Number.isFinite(rate) || rate <= 0) {
    showNotification("Please fill required fields: Organization, Date, Hours, Rate", "error");
    return;
  }

  const total = workType === "hourly" ? hours * rate : rate;
  
  const user = auth.currentUser;
  if (!user) return;

  try {
    const hoursData = {
      student: studentId || null,
      organization,
      subject,
      workType,
      date: workDate,
      dateIso: fmtDateISO(workDate),
      hours,
      rate,
      total,
      loggedAt: new Date().toISOString()
    };

    await addDoc(collection(db, "users", user.uid, "hours"), hoursData);
    
    showNotification("Hours logged successfully", "success");
    await recalcSummaryStats(user.uid);
    await renderRecentHours();
    resetHoursForm();
    
  } catch (err) {
    console.error("Error logging hours:", err);
    showNotification("Failed to log hours", "error");
  }
}

// Enhanced recent hours rendering
async function renderRecentHours(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  
  const container = document.getElementById("hoursContainer");
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
        <div class="muted">${formatDate(entry.date)} • ${entry.subject}</div>
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

// ===========================
// COMPLETE MARKS MANAGEMENT
// ===========================

async function addMark() {
  const studentEl = document.getElementById("marksStudent");
  const subjectEl = document.getElementById("marksSubject");
  const topicEl = document.getElementById("marksTopic");
  const scoreEl = document.getElementById("marksScore");
  const maxEl = document.getElementById("marksMax");
  const dateEl = document.getElementById("marksDate");
  const notesEl = document.getElementById("marksNotes");

  const student = studentEl?.value;
  const subject = subjectEl?.value.trim();
  const topic = topicEl?.value.trim();
  const score = parseFloat(scoreEl?.value);
  const maxScore = parseFloat(maxEl?.value);
  const date = dateEl?.value;
  const notes = notesEl?.value.trim();

  if (!student || !subject || !Number.isFinite(score) || !Number.isFinite(maxScore) || !date) {
    showNotification("Please fill required fields: Student, Subject, Score, Max Score, Date", "error");
    return;
  }

  if (score > maxScore) {
    showNotification("Score cannot be greater than maximum score", "error");
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
    notes: notes || "",
    recordedAt: new Date().toISOString()
  };

  const user = auth.currentUser;
  if (user) {
    try {
      await addMark(user.uid, markData);
      showNotification("Mark added successfully", "success");
      resetMarksForm();
      await renderRecentMarks();
    } catch (err) {
      console.error("Error adding mark:", err);
      showNotification("Failed to add mark", "error");
    }
  }
}

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function updateMarksPercentage() {
  const scoreEl = document.getElementById("marksScore");
  const maxEl = document.getElementById("marksMax");
  const pctEl = document.getElementById("percentage");
  const gradeEl = document.getElementById("grade");

  const score = parseFloat(scoreEl?.value);
  const max = parseFloat(maxEl?.value);

  if (Number.isFinite(score) && Number.isFinite(max) && max > 0) {
    const percentage = (score / max) * 100;
    if (pctEl) pctEl.value = percentage.toFixed(1);
    if (gradeEl) gradeEl.value = calculateGrade(percentage);
  }
}

// ===========================
// COMPLETE ATTENDANCE SYSTEM
// ===========================

async function saveAttendance() {
  const dateEl = document.getElementById("attendanceDate");
  const subjectEl = document.getElementById("attendanceSubject");
  const topicEl = document.getElementById("attendanceTopic");
  const notesEl = document.getElementById("attendanceNotes");

  const date = dateEl?.value;
  const subject = subjectEl?.value.trim();
  const topic = topicEl?.value.trim();
  const notes = notesEl?.value.trim();

  if (!date || !subject) {
    showNotification("Please fill required fields: Date and Subject", "error");
    return;
  }

  // Get present students
  const presentStudents = [];
  document.querySelectorAll("#attendanceList input[type=checkbox]:checked")
    .forEach(cb => presentStudents.push(cb.value));

  if (presentStudents.length === 0) {
    showNotification("Please select at least one student", "error");
    return;
  }

  const attendanceData = {
    date,
    dateIso: fmtDateISO(date),
    subject,
    topic: topic || "General",
    present: presentStudents,
    notes: notes || "",
    recordedAt: new Date().toISOString()
  };

  const user = auth.currentUser;
  if (user) {
    try {
      await addAttendance(user.uid, attendanceData);
      showNotification("Attendance recorded successfully", "success");
      clearAttendanceForm();
      await renderAttendanceRecent();
    } catch (err) {
      console.error("Error saving attendance:", err);
      showNotification("Failed to save attendance", "error");
    }
  }
}

// ===========================
// ENHANCED PAYMENTS SYSTEM
// ===========================

async function recordPayment() {
  const studentEl = document.getElementById("paymentStudent");
  const amountEl = document.getElementById("paymentAmount");
  const dateEl = document.getElementById("paymentDate");
  const methodEl = document.getElementById("paymentMethod");
  const notesEl = document.getElementById("paymentNotes");

  const student = studentEl?.value;
  const amount = parseFloat(amountEl?.value);
  const date = dateEl?.value;
  const method = methodEl?.value;
  const notes = notesEl?.value.trim();

  if (!student || !Number.isFinite(amount) || amount <= 0 || !date || !method) {
    showNotification("Please fill required fields: Student, Amount, Date, Method", "error");
    return;
  }

  const paymentData = {
    student,
    amount,
    date,
    dateIso: fmtDateISO(date),
    method,
    notes: notes || "",
    recordedAt: new Date().toISOString()
  };

  const user = auth.currentUser;
  if (user) {
    try {
      await recordPayment(user.uid, paymentData);
      showNotification("Payment recorded successfully", "success");
      resetPaymentForm();
      await renderPaymentActivity();
      await renderStudentBalances();
    } catch (err) {
      console.error("Error recording payment:", err);
      showNotification("Failed to record payment", "error");
    }
  }
}

// ===========================
// ENHANCED SYNC SYSTEM
// ===========================

async function exportUserData(uid) {
  try {
    showNotification("Starting data export...", "info");
    
    const [statsSnap, studentsSnap, hoursSnap, paymentsSnap, marksSnap, attendanceSnap] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDocs(collection(db, "users", uid, "students")),
      getDocs(collection(db, "users", uid, "hours")),
      getDocs(collection(db, "users", uid, "payments")),
      getDocs(collection(db, "users", uid, "marks")),
      getDocs(collection(db, "users", uid, "attendance"))
    ]);

    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        user: uid
      },
      stats: statsSnap.exists() ? statsSnap.data() : {},
      students: studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      hours: hoursSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      payments: paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      marks: marksSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      attendance: attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    };

    // Download as JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification("Data exported successfully", "success");
  } catch (err) {
    console.error("Export failed:", err);
    showNotification("Export failed", "error");
  }
}

// ===========================
// ENHANCED INITIALIZATION
// ===========================

async function initAuthenticatedUi(user) {
  currentUser = user;
  
  if (syncIndicator) {
    syncIndicator.classList.remove("sync-error", "sync-active");
    syncIndicator.classList.add("sync-connected");
  }
  if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
  if (syncMessageLine) syncMessageLine.textContent = "Status: Connected";

  // Load all initial data
  try {
    await Promise.all([
      loadUserStats(user.uid),
      loadStudentsForDropdowns(),
      renderStudents(),
      renderRecentHours(),
      renderRecentMarks(),
      renderAttendanceRecent(),
      renderPaymentActivity(),
      renderStudentBalances(),
      renderOverviewReports()
    ]);

    // Start autosync if enabled
    if (autoSyncCheckbox && autoSyncCheckbox.checked) {
      setAutosyncEnabled(true);
    }

    showNotification("Welcome back!", "success");
  } catch (error) {
    console.error("Error initializing UI:", error);
    showNotification("Error loading data", "error");
  }
}

// ===========================
// ADDITIONAL UI ENHANCEMENTS
// ===========================

function initEventListeners() {
  // Real-time percentage calculation for marks
  const scoreInput = document.getElementById("marksScore");
  const maxInput = document.getElementById("marksMax");
  if (scoreInput) scoreInput.addEventListener('input', updateMarksPercentage);
  if (maxInput) maxInput.addEventListener('input', updateMarksPercentage);

  // Auto-calculate total in hours form
  const hoursInput = document.getElementById("hoursWorked");
  const rateInput = document.getElementById("baseRate");
  const workTypeSelect = document.getElementById("workType");
  
  const calculateTotal = () => {
    const hours = parseFloat(hoursInput?.value) || 0;
    const rate = parseFloat(rateInput?.value) || 0;
    const workType = workTypeSelect?.value || "hourly";
    const totalEl = document.getElementById("totalPay");
    
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

  // Set default dates to today
  const dateInputs = document.querySelectorAll('input[type="date"]');
  const today = new Date().toISOString().split('T')[0];
  dateInputs.forEach(input => {
    if (!input.value) {
      input.value = today;
    }
  });
}

// ===========================
// ENHANCED BOOT SEQUENCE
// ===========================

function boot() {
  bindUiEvents();
  initEventListeners();
  
  if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
  if (syncMessageLine) syncMessageLine.textContent = "Status: Initializing...";

  console.log("WorkLog App Initialized");
}

// Update the existing onAuthStateChanged listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    initAuthenticatedUi(user);
  } else {
    teardownOnSignOut();
  }
});

// ===========================
// EXPOSE FUNCTIONS TO WINDOW
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

// New functions
window.exportUserData = exportUserData;
window.editStudent = async (studentId) => {
  // Implementation for editing students
  showNotification("Edit feature coming soon", "info");
};

window.deleteStudent = async (studentId) => {
  if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
    const user = auth.currentUser;
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "students", studentId));
        showNotification("Student deleted successfully", "success");
        await renderStudents();
        await loadStudentsForDropdowns();
      } catch (error) {
        console.error("Error deleting student:", error);
        showNotification("Failed to delete student", "error");
      }
    }
  }
};

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
