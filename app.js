// app.js - MAIN APPLICATION FILE
import { auth } from './firebase-config.js';
import { firebaseManager } from './firebase-manager.js';
import { dataManager } from './data-manager.js';
import { 
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Global state
let currentEditId = null;
let currentEditType = null;

// Initialize application
async function initApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  // Setup auth listener first
  setupAuthListener();
  
  // Initialize UI components
  setupTabNavigation();
  setupForms();
  setupEventListeners();
  setupProfileModal();
  setupFloatingAddButton();
  setupSyncControls();
  
  // Set default rate from localStorage
  const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
  document.getElementById('currentDefaultRateDisplay').textContent = defaultRate;
  document.getElementById('currentDefaultRate').textContent = defaultRate;
  document.getElementById('defaultBaseRate').value = defaultRate;
  
  console.log('✅ UI components initialized');
}

// Setup authentication listener
function setupAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('🟢 User authenticated:', user.email);
      await initializeUserSession(user);
    } else {
      console.log('🔴 No user authenticated');
      
      // Check if we're already on auth.html
      if (!window.location.pathname.includes('auth.html')) {
        console.log('🔐 Redirecting to login...');
        setTimeout(() => {
          window.location.href = 'auth.html';
        }, 1000);
      }
    }
  });
}

// Initialize user session
async function initializeUserSession(user) {
  try {
    console.log('👤 Initializing user session...');
    
    // Initialize Firebase Manager
    await firebaseManager.init();
    
    // Initialize Data Manager
    await dataManager.init();
    
    // Load initial data
    await loadInitialData();
    
    // Update UI
    updateHeaderStats();
    updateAllStats();
    updateProfileInfo();
    
    console.log('✅ User session initialized successfully');
    
  } catch (error) {
    console.error('Error initializing user session:', error);
    showNotification('Failed to initialize app: ' + error.message, 'error');
  }
}

// Load initial data
async function loadInitialData() {
  try {
    console.log('📦 Loading initial data...');
    
    // Render all data
    await Promise.all([
      renderStudents(),
      renderHours(),
      renderMarks(),
      renderAttendance(),
      renderPayments(),
      populateStudentDropdowns()
    ]);
    
    console.log('✅ Initial data loaded');
    
  } catch (error) {
    console.error('Error loading initial data:', error);
    showNotification('Failed to load data', 'error');
  }
}

// ==================== RENDERING FUNCTIONS ====================

// Render students list
async function renderStudents() {
  const container = document.getElementById('studentsContainer');
  if (!container) return;
  
  const students = dataManager.cache.students;
  
  if (students.length === 0) {
    container.innerHTML = '<p class="empty-message">No students registered yet.</p>';
    return;
  }
  
  let html = '';
  students.forEach(student => {
    html += `
      <div class="student-card">
        <div class="student-card-header">
          <div>
            <strong>${student.name}</strong>
            <span class="student-id">${student.studentId || 'No ID'}</span>
          </div>
          <div class="student-actions">
            <button class="btn-icon" onclick="startEditStudent('${student._id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" onclick="deleteStudent('${student._id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="student-details">
          <div class="muted">
            ${student.gender || 'Not specified'} • 
            ${student.email || 'No email'} • 
            ${student.phone || 'No phone'}
          </div>
          <div class="student-rate">Rate: $${student.rate || 0}/session</div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Render hours list
async function renderHours() {
  const container = document.getElementById('hoursContainer');
  if (!container) return;
  
  const hours = dataManager.cache.hours;
  
  if (hours.length === 0) {
    container.innerHTML = '<p class="empty-message">No work logged yet.</p>';
    return;
  }
  
  // Sort by date (newest first)
  const sortedHours = [...hours].sort((a, b) => 
    new Date(b.date || b.dateIso) - new Date(a.date || a.dateIso)
  );
  
  let html = '';
  sortedHours.slice(0, 20).forEach(entry => {
    html += `
      <div class="hours-entry">
        <div class="hours-header">
          <strong>${entry.organization}</strong>
          <span class="hours-type">${entry.workType}</span>
          <div class="student-actions">
            <button class="btn-icon" onclick="startEditHours('${entry._id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" onclick="deleteHours('${entry._id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="muted">
          ${formatDate(entry.date)} • ${entry.subject || 'General'}
          ${entry.student ? ` • Student: ${entry.student}` : ''}
        </div>
        <div class="hours-details">
          <span>Hours: ${entry.hours || 0}</span>
          <span>Rate: $${entry.rate || 0}/hr</span>
          <span class="hours-total">Total: $${entry.total || 0}</span>
        </div>
        ${entry.notes ? `<div class="muted small">Notes: ${entry.notes}</div>` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Render marks list
async function renderMarks() {
  const container = document.getElementById('marksContainer');
  if (!container) return;
  
  const marks = dataManager.cache.marks;
  
  if (marks.length === 0) {
    container.innerHTML = '<p class="empty-message">No marks recorded yet.</p>';
    return;
  }
  
  // Sort by date (newest first)
  const sortedMarks = [...marks].sort((a, b) => 
    new Date(b.date || b.dateIso) - new Date(a.date || a.dateIso)
  );
  
  let html = '';
  sortedMarks.slice(0, 20).forEach(mark => {
    html += `
      <div class="mark-entry">
        <div class="mark-header">
          <strong>${mark.student || 'Unknown'}</strong>
          <span class="mark-subject">${mark.subject}</span>
          <div class="student-actions">
            <button class="btn-icon" onclick="startEditMark('${mark._id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" onclick="deleteMark('${mark._id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="muted">
          ${formatDate(mark.date)} • ${mark.topic || 'No topic'}
        </div>
        <div class="mark-details">
          <span>Score: ${mark.score || 0}/${mark.max || 0}</span>
          <span>Percentage: ${mark.percentage || 0}%</span>
          <span class="mark-grade">Grade: ${mark.grade || 'N/A'}</span>
        </div>
        ${mark.notes ? `<div class="muted small">Notes: ${mark.notes}</div>` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Render attendance list
async function renderAttendance() {
  const container = document.getElementById('attendanceContainer');
  if (!container) return;
  
  const attendance = dataManager.cache.attendance;
  
  if (attendance.length === 0) {
    container.innerHTML = '<p class="empty-message">No attendance records yet.</p>';
    return;
  }
  
  // Sort by date (newest first)
  const sortedAttendance = [...attendance].sort((a, b) => 
    new Date(b.date || b.dateIso) - new Date(a.date || a.dateIso)
  );
  
  let html = '';
  sortedAttendance.slice(0, 20).forEach(record => {
    const presentCount = Array.isArray(record.present) ? record.present.length : 0;
    
    html += `
      <div class="attendance-entry">
        <div class="attendance-header">
          <strong>${record.subject || 'No subject'}</strong>
          <span class="attendance-count">${presentCount} present</span>
          <div class="student-actions">
            <button class="btn-icon" onclick="startEditAttendance('${record._id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" onclick="deleteAttendance('${record._id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="muted">
          ${formatDate(record.date)} • ${record.topic || 'No topic'}
        </div>
        <div class="attendance-students">
          ${Array.isArray(record.present) && record.present.length > 0 
            ? `<span>Present: ${record.present.join(', ')}</span>`
            : '<span class="muted">No students marked present</span>'
          }
        </div>
        ${record.notes ? `<div class="muted small">Notes: ${record.notes}</div>` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Render payments list
async function renderPayments() {
  const container = document.getElementById('paymentActivityLog');
  if (!container) return;
  
  const payments = dataManager.cache.payments;
  
  if (payments.length === 0) {
    container.innerHTML = '<p class="empty-message">No payment activity yet.</p>';
    return;
  }
  
  // Sort by date (newest first)
  const sortedPayments = [...payments].sort((a, b) => 
    new Date(b.date || b.dateIso) - new Date(a.date || a.dateIso)
  );
  
  let html = '';
  sortedPayments.slice(0, 20).forEach(payment => {
    html += `
      <div class="payment-entry">
        <div class="payment-header">
          <strong>${payment.student || 'Unknown'}</strong>
          <span class="payment-amount">$${payment.amount || 0}</span>
          <div class="student-actions">
            <button class="btn-icon" onclick="startEditPayment('${payment._id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" onclick="deletePayment('${payment._id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="muted">
          ${formatDate(payment.date)} • ${payment.method || 'No method'}
        </div>
        ${payment.notes ? `<div class="muted small">Notes: ${payment.notes}</div>` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Render student balances
async function renderStudentBalances() {
  const container = document.getElementById('studentBalancesContainer');
  if (!container) return;
  
  const students = dataManager.cache.students;
  const hours = dataManager.cache.hours;
  const payments = dataManager.cache.payments;
  
  if (students.length === 0) {
    container.innerHTML = '<p class="empty-message">No student data available.</p>';
    return;
  }
  
  let html = '';
  let totalOwed = 0;
  
  students.forEach(student => {
    // Calculate earnings for this student
    const studentHours = hours.filter(h => h.student === student.name);
    const earnings = studentHours.reduce((sum, h) => sum + (h.total || 0), 0);
    
    // Calculate payments from this student
    const studentPayments = payments.filter(p => p.student === student.name);
    const paid = studentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const owed = Math.max(earnings - paid, 0);
    totalOwed += owed;
    
    html += `
      <div class="balance-entry">
        <div class="balance-header">
          <strong>${student.name}</strong>
          <span class="balance-owed">$${owed.toFixed(2)}</span>
        </div>
        <div class="balance-details">
          <span>Earned: $${earnings.toFixed(2)}</span>
          <span>Paid: $${paid.toFixed(2)}</span>
          <span>Owed: $${owed.toFixed(2)}</span>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Update total owed display
  const totalOwedEl = document.getElementById('totalOwed');
  if (totalOwedEl) {
    totalOwedEl.textContent = `$${totalOwed.toFixed(2)}`;
  }
}

// ==================== FORM HANDLERS ====================

// Student form
async function handleStudentSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const studentData = {
    name: formData.get('studentName'),
    studentId: formData.get('studentId'),
    gender: formData.get('studentGender'),
    email: formData.get('studentEmail'),
    phone: formData.get('studentPhone'),
    rate: formData.get('studentRate')
  };
  
  try {
    let message;
    
    if (currentEditId && currentEditType === 'student') {
      await dataManager.updateStudent(currentEditId, studentData);
      message = 'Student updated successfully';
      exitEditMode();
    } else {
      await dataManager.saveStudent(studentData);
      message = 'Student added successfully';
    }
    
    // Refresh UI
    await renderStudents();
    await populateStudentDropdowns();
    await renderStudentBalances();
    updateAllStats();
    
    // Clear form
    e.target.reset();
    
    // Show success message
    showNotification(message, 'success');
    
  } catch (error) {
    console.error('Error saving student:', error);
    showNotification('Failed to save student', 'error');
  }
}

// Hours form
async function handleHoursSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const hoursData = {
    organization: formData.get('organization'),
    subject: formData.get('workSubject'),
    student: formData.get('hoursStudent'),
    workType: formData.get('workType'),
    date: formData.get('workDate'),
    hours: formData.get('hoursWorked'),
    rate: formData.get('baseRate'),
    notes: formData.get('hoursNotes')
  };
  
  try {
    let message;
    
    if (currentEditId && currentEditType === 'hours') {
      await dataManager.updateHours(currentEditId, hoursData);
      message = 'Hours updated successfully';
      exitEditMode();
    } else {
      await dataManager.saveHours(hoursData);
      message = 'Hours logged successfully';
    }
    
    // Refresh UI
    await renderHours();
    await renderStudentBalances();
    updateAllStats();
    
    // Clear form (keep rate)
    const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
    e.target.reset();
    document.getElementById('baseRate').value = defaultRate;
    calculateTotalPay();
    
    showNotification(message, 'success');
    
  } catch (error) {
    console.error('Error saving hours:', error);
    showNotification('Failed to save hours', 'error');
  }
}

// Marks form
async function handleMarksSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const marksData = {
    student: formData.get('marksStudent'),
    subject: formData.get('marksSubject'),
    topic: formData.get('marksTopic'),
    date: formData.get('marksDate'),
    score: formData.get('marksScore'),
    max: formData.get('marksMax'),
    notes: formData.get('marksNotes')
  };
  
  try {
    let message;
    
    if (currentEditId && currentEditType === 'marks') {
      await dataManager.saveMarks(marksData, currentEditId);
      message = 'Mark updated successfully';
      exitEditMode();
    } else {
      await dataManager.saveMarks(marksData);
      message = 'Mark added successfully';
    }
    
    // Refresh UI
    await renderMarks();
    updateAllStats();
    
    // Clear form
    e.target.reset();
    
    showNotification(message, 'success');
    
  } catch (error) {
    console.error('Error saving marks:', error);
    showNotification('Failed to save marks', 'error');
  }
}

// Attendance form
async function handleAttendanceSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const presentStudents = Array.from(
    document.querySelectorAll('#attendanceStudents input[type="checkbox"]:checked')
  ).map(cb => cb.value);
  
  const attendanceData = {
    date: formData.get('attendanceDate'),
    subject: formData.get('attendanceSubject'),
    topic: formData.get('attendanceTopic'),
    present: presentStudents,
    notes: formData.get('attendanceNotes')
  };
  
  try {
    let message;
    
    if (currentEditId && currentEditType === 'attendance') {
      await dataManager.saveAttendance(attendanceData, currentEditId);
      message = 'Attendance updated successfully';
      exitEditMode();
    } else {
      await dataManager.saveAttendance(attendanceData);
      message = 'Attendance recorded successfully';
    }
    
    // Refresh UI
    await renderAttendance();
    updateAllStats();
    
    // Clear form
    e.target.reset();
    document.querySelectorAll('#attendanceStudents input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    
    showNotification(message, 'success');
    
  } catch (error) {
    console.error('Error saving attendance:', error);
    showNotification('Failed to save attendance', 'error');
  }
}

// Payment form
async function handlePaymentSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const paymentData = {
    student: formData.get('paymentStudent'),
    amount: formData.get('paymentAmount'),
    date: formData.get('paymentDate'),
    method: formData.get('paymentMethod'),
    notes: formData.get('paymentNotes')
  };
  
  try {
    let message;
    
    if (currentEditId && currentEditType === 'payment') {
      await dataManager.savePayment(paymentData, currentEditId);
      message = 'Payment updated successfully';
      exitEditMode();
    } else {
      await dataManager.savePayment(paymentData);
      message = 'Payment recorded successfully';
    }
    
    // Refresh UI
    await renderPayments();
    await renderStudentBalances();
    updateAllStats();
    
    // Clear form
    e.target.reset();
    
    showNotification(message, 'success');
    
  } catch (error) {
    console.error('Error saving payment:', error);
    showNotification('Failed to save payment', 'error');
  }
}

// ==================== EDIT FUNCTIONS ====================

// Start editing a student
async function startEditStudent(id) {
  const student = dataManager.cache.students.find(s => s._id === id);
  if (!student) return;
  
  currentEditId = id;
  currentEditType = 'student';
  
  // Fill form
  document.getElementById('studentName').value = student.name || '';
  document.getElementById('studentId').value = student.studentId || '';
  document.getElementById('studentGender').value = student.gender || '';
  document.getElementById('studentEmail').value = student.email || '';
  document.getElementById('studentPhone').value = student.phone || '';
  document.getElementById('studentRate').value = student.rate || '';
  
  // Update button text
  const submitBtn = document.getElementById('studentSubmitBtn');
  if (submitBtn) {
    submitBtn.textContent = 'Update Student';
    submitBtn.className = 'button warning';
  }
  
  // Show cancel button
  const cancelBtn = document.getElementById('studentCancelBtn');
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
  }
  
  showNotification('Edit mode activated. Update the student details.', 'info');
}

// Start editing hours
async function startEditHours(id) {
  const entry = dataManager.cache.hours.find(h => h._id === id);
  if (!entry) return;
  
  currentEditId = id;
  currentEditType = 'hours';
  
  // Fill form
  document.getElementById('organization').value = entry.organization || '';
  document.getElementById('workSubject').value = entry.subject || '';
  document.getElementById('hoursStudent').value = entry.student || '';
  document.getElementById('workType').value = entry.workType || 'hourly';
  document.getElementById('workDate').value = entry.date || '';
  document.getElementById('hoursWorked').value = entry.hours || '';
  document.getElementById('baseRate').value = entry.rate || '';
  document.getElementById('hoursNotes').value = entry.notes || '';
  calculateTotalPay();
  
  // Update button
  const submitBtn = document.getElementById('hoursSubmitBtn');
  if (submitBtn) {
    submitBtn.textContent = 'Update Hours';
    submitBtn.className = 'button warning';
  }
  
  // Show cancel button
  const cancelBtn = document.getElementById('cancelHoursEdit');
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
  }
  
  showNotification('Edit mode activated. Update the hours entry.', 'info');
}

// Start editing marks
async function startEditMark(id) {
  const mark = dataManager.cache.marks.find(m => m._id === id);
  if (!mark) return;
  
  currentEditId = id;
  currentEditType = 'marks';
  
  // Fill form
  document.getElementById('marksStudent').value = mark.student || '';
  document.getElementById('marksSubject').value = mark.subject || '';
  document.getElementById('marksTopic').value = mark.topic || '';
  document.getElementById('marksDate').value = mark.date || '';
  document.getElementById('marksScore').value = mark.score || '';
  document.getElementById('marksMax').value = mark.max || '';
  document.getElementById('marksNotes').value = mark.notes || '';
  updateMarksPercentage();
  
  // Update button
  const submitBtn = document.getElementById('marksSubmitBtn');
  if (submitBtn) {
    submitBtn.textContent = 'Update Mark';
    submitBtn.className = 'button warning';
  }
  
  // Show cancel button
  const cancelBtn = document.getElementById('cancelMarkBtn');
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
  }
  
  showNotification('Edit mode activated. Update the mark.', 'info');
}

// Start editing attendance
async function startEditAttendance(id) {
  const record = dataManager.cache.attendance.find(a => a._id === id);
  if (!record) return;
  
  currentEditId = id;
  currentEditType = 'attendance';
  
  // Fill form
  document.getElementById('attendanceDate').value = record.date || '';
  document.getElementById('attendanceSubject').value = record.subject || '';
  document.getElementById('attendanceTopic').value = record.topic || '';
  document.getElementById('attendanceNotes').value = record.notes || '';
  
  // Populate attendance students
  await populateAttendanceStudents();
  
  // Check the students who were present
  if (Array.isArray(record.present)) {
    record.present.forEach(studentName => {
      const checkbox = document.querySelector(`input[value="${studentName}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }
  
  // Update button
  const submitBtn = document.getElementById('attendanceSubmitBtn');
  if (submitBtn) {
    submitBtn.textContent = 'Update Attendance';
    submitBtn.className = 'button warning';
  }
  
  // Show cancel button
  const cancelBtn = document.getElementById('cancelAttendanceBtn');
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
  }
  
  showNotification('Edit mode activated. Update the attendance record.', 'info');
}

// Start editing payment
async function startEditPayment(id) {
  const payment = dataManager.cache.payments.find(p => p._id === id);
  if (!payment) return;
  
  currentEditId = id;
  currentEditType = 'payment';
  
  // Fill form
  document.getElementById('paymentStudent').value = payment.student || '';
  document.getElementById('paymentAmount').value = payment.amount || '';
  document.getElementById('paymentDate').value = payment.date || '';
  document.getElementById('paymentMethod').value = payment.method || '';
  document.getElementById('paymentNotes').value = payment.notes || '';
  
  // Update button
  const submitBtn = document.getElementById('paymentSubmitBtn');
  if (submitBtn) {
    submitBtn.textContent = 'Update Payment';
    submitBtn.className = 'button warning';
  }
  
  // Show cancel button
  const cancelBtn = document.getElementById('cancelPaymentBtn');
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
  }
  
  showNotification('Edit mode activated. Update the payment.', 'info');
}

// Exit edit mode
function exitEditMode() {
  currentEditId = null;
  currentEditType = null;
  
  // Reset all form buttons
  const forms = [
    { type: 'student', btn: 'studentSubmitBtn', defaultText: '➕ Add Student' },
    { type: 'hours', btn: 'hoursSubmitBtn', defaultText: '💾 Log Work' },
    { type: 'marks', btn: 'marksSubmitBtn', defaultText: '➕ Add Mark' },
    { type: 'attendance', btn: 'attendanceSubmitBtn', defaultText: '💾 Save Attendance' },
    { type: 'payment', btn: 'paymentSubmitBtn', defaultText: '💾 Record Payment' }
  ];
  
  forms.forEach(form => {
    const submitBtn = document.getElementById(form.btn);
    if (submitBtn) {
      submitBtn.textContent = form.defaultText;
      submitBtn.className = 'button primary';
    }
    
    const cancelBtn = document.getElementById(`${form.type}CancelBtn`) || 
                      document.getElementById(`cancel${form.type.charAt(0).toUpperCase() + form.type.slice(1)}Edit`);
    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }
  });
}

// ==================== DELETE FUNCTIONS ====================

// Delete student
async function deleteStudent(id) {
  if (!confirm('Are you sure you want to delete this student?')) return;
  
  try {
    await dataManager.deleteStudent(id);
    await renderStudents();
    await populateStudentDropdowns();
    await renderStudentBalances();
    updateAllStats();
    showNotification('Student deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting student:', error);
    showNotification('Failed to delete student', 'error');
  }
}

// Delete hours
async function deleteHours(id) {
  if (!confirm('Are you sure you want to delete this hours entry?')) return;
  
  try {
    await dataManager.deleteHours(id);
    await renderHours();
    await renderStudentBalances();
    updateAllStats();
    showNotification('Hours entry deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting hours:', error);
    showNotification('Failed to delete hours entry', 'error');
  }
}

// Delete marks
async function deleteMark(id) {
  if (!confirm('Are you sure you want to delete this mark?')) return;
  
  try {
    await dataManager.deleteMarks(id);
    await renderMarks();
    updateAllStats();
    showNotification('Mark deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting mark:', error);
    showNotification('Failed to delete mark', 'error');
  }
}

// Delete attendance
async function deleteAttendance(id) {
  if (!confirm('Are you sure you want to delete this attendance record?')) return;
  
  try {
    await dataManager.deleteAttendance(id);
    await renderAttendance();
    updateAllStats();
    showNotification('Attendance record deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting attendance:', error);
    showNotification('Failed to delete attendance record', 'error');
  }
}

// Delete payment
async function deletePayment(id) {
  if (!confirm('Are you sure you want to delete this payment?')) return;
  
  try {
    await dataManager.deletePayment(id);
    await renderPayments();
    await renderStudentBalances();
    updateAllStats();
    showNotification('Payment deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting payment:', error);
    showNotification('Failed to delete payment', 'error');
  }
}

// ==================== UTILITY FUNCTIONS ====================

// Format date
function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

// Calculate total pay
function calculateTotalPay() {
  const hours = parseFloat(document.getElementById('hoursWorked')?.value) || 0;
  const rate = parseFloat(document.getElementById('baseRate')?.value) || 0;
  const total = hours * rate;
  
  const totalPayElement = document.getElementById('totalPay');
  if (totalPayElement) {
    totalPayElement.textContent = `$${total.toFixed(2)}`;
  }
}

// Update marks percentage
function updateMarksPercentage() {
  const score = parseFloat(document.getElementById('marksScore')?.value) || 0;
  const max = parseFloat(document.getElementById('marksMax')?.value) || 1;
  const percentage = max > 0 ? (score / max) * 100 : 0;
  
  const percentageField = document.getElementById('percentage');
  const gradeField = document.getElementById('grade');
  
  if (percentageField) {
    percentageField.value = `${percentage.toFixed(1)}%`;
  }
  
  if (gradeField) {
    if (percentage >= 90) gradeField.value = 'A';
    else if (percentage >= 80) gradeField.value = 'B';
    else if (percentage >= 70) gradeField.value = 'C';
    else if (percentage >= 60) gradeField.value = 'D';
    else gradeField.value = 'F';
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;
  
  // Add to body
  document.body.appendChild(notification);
  
  // Add close button event
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

// Update all stats
function updateAllStats() {
  const studentStats = dataManager.calculateStudentStats();
  const hoursStats = dataManager.calculateHoursStats();
  const paymentStats = dataManager.calculatePaymentStats();
  
  // Update student stats
  updateElement('studentCount', studentStats.count);
  updateElement('averageRate', studentStats.avgRate);
  updateElement('totalStudentsCount', studentStats.count);
  updateElement('totalStudentsReport', studentStats.count);
  
  // Update hours stats
  updateElement('weeklyHours', hoursStats.weekly.hours);
  updateElement('weeklyTotal', hoursStats.weekly.total);
  updateElement('monthlyHours', hoursStats.monthly.hours);
  updateElement('monthlyTotal', hoursStats.monthly.total);
  updateElement('totalHoursReport', hoursStats.total.hours);
  updateElement('totalEarningsReport', `$${hoursStats.total.earnings}`);
  
  // Update marks stats
  const marksCount = dataManager.cache.marks.length;
  updateElement('marksCount', marksCount);
  updateElement('avgMarks', '0%'); // Would need to calculate
  updateElement('avgMarkReport', '0%');
  
  // Update payment stats
  updateElement('monthlyPayments', `$${paymentStats.monthly}`);
  updateElement('totalPaymentsReport', `$${paymentStats.total}`);
  
  // Update header stats
  updateHeaderStats();
}

function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

// Update header stats
function updateHeaderStats() {
  const studentCount = dataManager.cache.students.length;
  const totalHours = dataManager.cache.hours.reduce((sum, h) => sum + (h.hours || 0), 0);
  
  updateElement('statStudents', studentCount);
  updateElement('statHours', totalHours.toFixed(1));
  
  // Update data status
  const dataStatus = document.getElementById('dataStatus');
  if (dataStatus) {
    dataStatus.innerHTML = `📊 Data: <span id="statStudents">${studentCount}</span> Students, <span id="statHours">${totalHours.toFixed(1)}</span> Hours`;
  }
}

// ==================== SETUP FUNCTIONS ====================

// Setup tab navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab[data-tab]');
  const tabContents = document.querySelectorAll('.tabcontent');
  
  function switchTab(tabName) {
    // Hide all tab contents
    tabContents.forEach(content => {
      content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    tabButtons.forEach(button => {
      button.classList.remove('active');
    });
    
    // Show the selected tab content
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
      selectedTab.classList.add('active');
    }
    
    // Activate the clicked tab button
    const activeButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }
    
    // Load data for the tab if needed
    if (tabName === 'hours') {
      calculateTotalPay();
    } else if (tabName === 'marks') {
      updateMarksPercentage();
    } else if (tabName === 'attendance') {
      populateAttendanceStudents();
    } else if (tabName === 'payments') {
      renderStudentBalances();
    }
  }
  
  // Add click event to all tab buttons
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Initialize with Students tab
  switchTab('students');
}

// Setup forms
function setupForms() {
  // Student form
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
  }
  
  // Hours form
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
    
    // Add event listeners for real-time calculation
    const hoursInput = document.getElementById('hoursWorked');
    const rateInput = document.getElementById('baseRate');
    
    if (hoursInput) hoursInput.addEventListener('input', calculateTotalPay);
    if (rateInput) rateInput.addEventListener('input', calculateTotalPay);
  }
  
  // Marks form
  const marksForm = document.getElementById('marksForm');
  if (marksForm) {
    marksForm.addEventListener('submit', handleMarksSubmit);
  }
  
  // Attendance form
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', handleAttendanceSubmit);
  }
  
  // Payment form
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmit);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Sync button
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      try {
        await dataManager.manualSync();
      } catch (error) {
        console.error('Sync error:', error);
      }
    });
  }
  
  // Export data button
  const exportDataBtn = document.getElementById('exportDataBtn');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', async () => {
      try {
        await dataManager.exportData();
      } catch (error) {
        console.error('Export error:', error);
      }
    });
  }
  
  // Import data button
  const importDataBtn = document.getElementById('importDataBtn');
  if (importDataBtn) {
    importDataBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          await dataManager.importData(file);
          await dataManager.loadAllData();
          await loadInitialData();
        } catch (error) {
          console.error('Import error:', error);
        }
      });
      
      input.click();
    });
  }
  
  // Clear data button
  const clearDataBtn = document.getElementById('clearDataBtn');
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', async () => {
      const success = await dataManager.clearAllData();
      if (success) {
        setTimeout(() => location.reload(), 1000);
      }
    });
  }
  
  // Cancel edit buttons
  document.getElementById('studentCancelBtn')?.addEventListener('click', exitEditMode);
  document.getElementById('cancelHoursEdit')?.addEventListener('click', exitEditMode);
  document.getElementById('cancelMarkBtn')?.addEventListener('click', exitEditMode);
  document.getElementById('cancelAttendanceBtn')?.addEventListener('click', exitEditMode);
  document.getElementById('cancelPaymentBtn')?.addEventListener('click', exitEditMode);
}

// Setup profile modal
function setupProfileModal() {
  const profileBtn = document.getElementById('profileBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileModal = document.getElementById('closeProfileModal');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (profileBtn && profileModal) {
    profileBtn.addEventListener('click', () => {
      updateProfileInfo();
      profileModal.style.display = 'block';
    });
  }
  
  if (closeProfileModal) {
    closeProfileModal.addEventListener('click', () => {
      profileModal.style.display = 'none';
    });
  }
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === profileModal) {
      profileModal.style.display = 'none';
    }
  });
  
  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to logout?')) {
        try {
          await signOut(auth);
        } catch (error) {
          console.error('Logout error:', error);
          showNotification('Logout failed', 'error');
        }
      }
    });
  }
}

// Update profile info
function updateProfileInfo() {
  const user = auth.currentUser;
  if (!user) return;
  
  // Update email
  const profileUserEmail = document.getElementById('profileUserEmail');
  if (profileUserEmail) {
    profileUserEmail.textContent = user.email;
  }
  
  // Update user name in header
  const userName = document.getElementById('userName');
  if (userName) {
    userName.textContent = user.email.split('@')[0];
  }
  
  // Update stats in modal
  document.getElementById('modalStatStudents').textContent = dataManager.cache.students.length;
  
  const totalHours = dataManager.cache.hours.reduce((sum, h) => sum + (h.hours || 0), 0);
  document.getElementById('modalStatHours').textContent = totalHours.toFixed(1);
  
  const totalEarnings = dataManager.cache.hours.reduce((sum, h) => sum + (h.total || 0), 0);
  document.getElementById('modalStatEarnings').textContent = totalEarnings.toFixed(2);
  
  document.getElementById('modalStatUpdated').textContent = new Date().toLocaleString();
}

// Setup floating action button
function setupFloatingAddButton() {
  const fab = document.getElementById('floatingAddBtn');
  const fabMenu = document.getElementById('fabMenu');
  const fabOverlay = document.getElementById('fabOverlay');
  
  if (fab && fabMenu && fabOverlay) {
    fab.addEventListener('click', () => {
      const isActive = fabMenu.classList.contains('active');
      
      if (isActive) {
        fabMenu.classList.remove('active');
        fabOverlay.style.display = 'none';
      } else {
        fabMenu.classList.add('active');
        fabOverlay.style.display = 'block';
      }
    });
    
    fabOverlay.addEventListener('click', () => {
      fabMenu.classList.remove('active');
      fabOverlay.style.display = 'none';
    });
    
    // FAB actions
    document.getElementById('fabAddStudent')?.addEventListener('click', () => {
      switchTab('students');
      document.getElementById('studentName')?.focus();
      closeFabMenu();
    });
    
    document.getElementById('fabAddHours')?.addEventListener('click', () => {
      switchTab('hours');
      document.getElementById('organization')?.focus();
      closeFabMenu();
    });
    
    document.getElementById('fabAddMark')?.addEventListener('click', () => {
      switchTab('marks');
      document.getElementById('marksStudent')?.focus();
      closeFabMenu();
    });
    
    document.getElementById('fabAddAttendance')?.addEventListener('click', () => {
      switchTab('attendance');
      document.getElementById('attendanceDate')?.focus();
      closeFabMenu();
    });
    
    function closeFabMenu() {
      if (fabMenu) fabMenu.classList.remove('active');
      if (fabOverlay) fabOverlay.style.display = 'none';
    }
  }
}

// Setup sync controls
function setupSyncControls() {
  const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
  const autoSyncText = document.getElementById('autoSyncText');
  
  if (autoSyncCheckbox && autoSyncText) {
    // Load saved setting (default to true)
    const autoSyncEnabled = localStorage.getItem('autoSyncEnabled') !== 'false';
    autoSyncCheckbox.checked = autoSyncEnabled;
    autoSyncText.textContent = autoSyncEnabled ? 'Auto' : 'Manual';
    
    // Update on change
    autoSyncCheckbox.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('autoSyncEnabled', enabled.toString());
      autoSyncText.textContent = enabled ? 'Auto' : 'Manual';
      
      // Re-initialize auto-sync
      firebaseManager.initAutoSync();
      
      if (enabled) {
        showNotification('Auto-sync enabled (every 30 seconds)', 'success');
      } else {
        showNotification('Auto-sync disabled', 'info');
      }
    });
  }
}

// Populate student dropdowns
async function populateStudentDropdowns() {
  const students = dataManager.getStudentsForDropdown();
  
  // Update all student dropdowns
  const dropdowns = [
    'hoursStudent',
    'marksStudent',
    'paymentStudent'
  ];
  
  dropdowns.forEach(dropdownId => {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    // Save current value
    const currentValue = dropdown.value;
    
    // Clear and repopulate
    dropdown.innerHTML = '<option value="">Select Student</option>';
    
    students.forEach(student => {
      const option = document.createElement('option');
      option.value = student.name;
      option.textContent = student.display;
      option.dataset.id = student.id;
      dropdown.appendChild(option);
    });
    
    // Restore previous value if possible
    if (currentValue) {
      dropdown.value = currentValue;
    }
  });
}

// Populate attendance students
async function populateAttendanceStudents() {
  const container = document.getElementById('attendanceStudents');
  if (!container) return;
  
  const students = dataManager.getStudentsForDropdown();
  
  if (students.length === 0) {
    container.innerHTML = '<p class="empty-message">No students registered. Add students first.</p>';
    return;
  }
  
  let html = '';
  students.forEach(student => {
    html += `
      <div class="attendance-student">
        <input type="checkbox" id="attendance-${student.id}" value="${student.name}">
        <label for="attendance-${student.id}">${student.display}</label>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ==================== GLOBAL FUNCTIONS ====================

// Functions that need to be available globally
window.selectAllStudents = function() {
  const checkboxes = document.querySelectorAll('#attendanceStudents input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
  });
  
  const btn = document.getElementById('selectAllStudentsBtn');
  if (btn) {
    btn.textContent = allChecked ? 'Select All' : 'Deselect All';
  }
};

window.clearAttendanceForm = function() {
  const form = document.getElementById('attendanceForm');
  if (form) {
    form.reset();
    document.querySelectorAll('#attendanceStudents input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
  }
};

window.saveDefaultRate = function() {
  const defaultRateInput = document.getElementById('defaultBaseRate');
  if (!defaultRateInput) return;
  
  const rate = parseFloat(defaultRateInput.value) || 0;
  localStorage.setItem('defaultHourlyRate', rate.toString());
  
  // Update displays
  document.getElementById('currentDefaultRateDisplay').textContent = rate.toFixed(2);
  document.getElementById('currentDefaultRate').textContent = rate.toFixed(2);
  
  showNotification(`Default rate saved: $${rate.toFixed(2)}/session`, 'success');
};

window.useDefaultRate = function() {
  const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
  const studentRateField = document.getElementById('studentRate');
  
  if (studentRateField) {
    studentRateField.value = defaultRate;
  }
};

window.useDefaultRateInHours = function() {
  const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
  const baseRateInput = document.getElementById('baseRate');
  
  if (baseRateInput) {
    baseRateInput.value = defaultRate;
    calculateTotalPay();
  }
};

window.showWeeklyBreakdown = function() {
  showNotification('Weekly report feature coming soon', 'info');
};

window.showBiWeeklyBreakdown = function() {
  showNotification('Bi-weekly report feature coming soon', 'info');
};

window.showMonthlyBreakdown = function() {
  showNotification('Monthly report feature coming soon', 'info');
};

window.showSubjectBreakdown = function() {
  showNotification('Subject report feature coming soon', 'info');
};

window.clearStudentForm = function() {
  const form = document.getElementById('studentForm');
  if (form) form.reset();
  exitEditMode();
};

window.resetHoursForm = function() {
  const form = document.getElementById('hoursForm');
  if (form) {
    form.reset();
    calculateTotalPay();
  }
  exitEditMode();
};

window.resetMarksForm = function() {
  const form = document.getElementById('marksForm');
  if (form) form.reset();
  exitEditMode();
};

window.resetPaymentForm = function() {
  const form = document.getElementById('paymentForm');
  if (form) form.reset();
  exitEditMode();
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

// Export for debugging
window.dataManager = dataManager;
window.firebaseManager = firebaseManager;
window.startEditStudent = startEditStudent;
window.startEditHours = startEditHours;
window.startEditMark = startEditMark;
window.startEditAttendance = startEditAttendance;
window.startEditPayment = startEditPayment;
window.deleteStudent = deleteStudent;
window.deleteHours = deleteHours;
window.deleteMark = deleteMark;
window.deleteAttendance = deleteAttendance;
window.deletePayment = deletePayment;
