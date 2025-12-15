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

let currentUserData = null;
let currentEditId = null;
let currentEditType = null;

// Cache system
const cache = {
  students: [],
  hours: [],
  lastSync: null
};

// ===========================
// SIMPLE NOTIFICATION SYSTEM
// ===========================

function showNotification(message, type = 'info') {
  console.log(`📢 ${type.toUpperCase()}: ${message}`);
  
  // Create simple notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
    color: white;
    padding: 15px 20px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span>${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" 
              style="background: none; border: none; color: white; cursor: pointer; font-size: 20px;">
        ×
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
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
  return '$' + safeNumber(n).toFixed(2);
}

function formatDate(dateString) {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

// ===========================
// FORM ID CONFIGURATION
// ===========================

const FORM_IDS = {
  STUDENT: {
    name: 'studentName',
    id: 'studentId',
    gender: 'studentGender',
    subject: 'studentSubject',
    email: 'studentEmail',
    phone: 'studentPhone',
    rate: 'studentRate',
    notes: 'studentNotes',
    submitBtn: 'studentSubmitBtn',
    cancelBtn: 'studentCancelBtn',
    form: 'studentForm'
  },
  HOURS: {
    organization: 'organization',
    workType: 'workType',
    subject: 'workSubject',
    student: 'hoursStudent',
    hours: 'hoursWorked',
    rate: 'baseRate',
    date: 'workDate',
    notes: 'hoursNotes',
    submitBtn: 'hoursSubmitBtn',
    cancelBtn: 'hoursCancelBtn',
    form: 'hoursForm',
    totalPay: 'totalPay'
  }
};

// ===========================
// EDIT MODE MANAGEMENT
// ===========================

function setEditMode(type, id) {
  currentEditType = type;
  currentEditId = id;
  
  // Show cancel button
  const cancelBtn = document.getElementById(FORM_IDS[type].cancelBtn);
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
  }
  
  // Update submit button text
  const submitBtn = document.getElementById(FORM_IDS[type].submitBtn);
  if (submitBtn) {
    submitBtn.textContent = type === 'STUDENT' ? 'Update Student' : 'Update Hours';
  }
}

function cancelEditMode() {
  if (!currentEditType) return;
  
  // Reset form
  const form = document.getElementById(FORM_IDS[currentEditType].form);
  if (form) {
    form.reset();
  }
  
  // Hide cancel button
  const cancelBtn = document.getElementById(FORM_IDS[currentEditType].cancelBtn);
  if (cancelBtn) {
    cancelBtn.style.display = 'none';
  }
  
  // Reset submit button
  const submitBtn = document.getElementById(FORM_IDS[currentEditType].submitBtn);
  if (submitBtn) {
    submitBtn.textContent = currentEditType === 'STUDENT' ? '➕ Add Student' : 'Log Hours';
  }
  
  // Clear edit state
  currentEditType = null;
  currentEditId = null;
}

// ===========================
// FORM HANDLERS
// ===========================

async function handleStudentSubmit(e) {
  e.preventDefault();
  
  const user = auth.currentUser;
  if (!user) {
    showNotification('Please log in to add students', 'error');
    return;
  }

  // Get form values
  const name = document.getElementById(FORM_IDS.STUDENT.name)?.value.trim();
  const studentId = document.getElementById(FORM_IDS.STUDENT.id)?.value.trim();
  const gender = document.getElementById(FORM_IDS.STUDENT.gender)?.value;
  const subject = document.getElementById(FORM_IDS.STUDENT.subject)?.value;
  const email = document.getElementById(FORM_IDS.STUDENT.email)?.value;
  const phone = document.getElementById(FORM_IDS.STUDENT.phone)?.value;
  const rate = safeNumber(document.getElementById(FORM_IDS.STUDENT.rate)?.value);
  const notes = document.getElementById(FORM_IDS.STUDENT.notes)?.value;

  // Validate
  if (!name || !studentId || !gender) {
    showNotification('Please fill in all required fields (Name, ID, Gender)', 'error');
    return;
  }

  const studentData = {
    name,
    studentId,
    gender,
    subject: subject || '',
    email: email || '',
    phone: phone || '',
    rate,
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (currentEditType === 'STUDENT' && currentEditId) {
      // Update existing
      await updateDoc(doc(db, "users", user.uid, "students", currentEditId), studentData);
      showNotification(`Student "${name}" updated successfully!`, 'success');
      cancelEditMode();
    } else {
      // Create new
      const docRef = await addDoc(collection(db, "users", user.uid, "students"), studentData);
      showNotification(`Student "${name}" added successfully!`, 'success');
    }
    
    // Clear form
    const form = document.getElementById(FORM_IDS.STUDENT.form);
    if (form) form.reset();
    
    // Refresh UI
    await renderStudents();
    await populateStudentDropdowns();
    
  } catch (error) {
    console.error('Error saving student:', error);
    showNotification('Failed to save student: ' + error.message, 'error');
  }
}

async function handleHoursSubmit(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    showNotification('Please log in to log hours', 'error');
    return;
  }

  // Get form values
  const organization = document.getElementById(FORM_IDS.HOURS.organization)?.value;
  const workType = document.getElementById(FORM_IDS.HOURS.workType)?.value;
  const subject = document.getElementById(FORM_IDS.HOURS.subject)?.value;
  const student = document.getElementById(FORM_IDS.HOURS.student)?.value;
  const hours = safeNumber(document.getElementById(FORM_IDS.HOURS.hours)?.value);
  const rate = safeNumber(document.getElementById(FORM_IDS.HOURS.rate)?.value);
  const date = document.getElementById(FORM_IDS.HOURS.date)?.value;
  const notes = document.getElementById(FORM_IDS.HOURS.notes)?.value;

  // Validate
  if (!organization || hours <= 0 || !date) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }

  const hoursData = {
    organization,
    workType: workType || '',
    subject: subject || '',
    student: student || '',
    hours,
    rate: rate || 0,
    total: hours * (rate || 0),
    date,
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (currentEditType === 'HOURS' && currentEditId) {
      // Update existing
      await updateDoc(doc(db, "users", user.uid, "hours", currentEditId), hoursData);
      showNotification('Hours updated successfully!', 'success');
      cancelEditMode();
    } else {
      // Create new
      await addDoc(collection(db, "users", user.uid, "hours"), hoursData);
      showNotification('Hours logged successfully!', 'success');
    }
    
    // Clear form
    const form = document.getElementById(FORM_IDS.HOURS.form);
    if (form) form.reset();
    
    // Refresh UI
    await renderRecentHoursWithEdit();
    
  } catch (error) {
    console.error('Error saving hours:', error);
    showNotification('Failed to save hours: ' + error.message, 'error');
  }
}

// ===========================
// RENDER FUNCTIONS
// ===========================

async function renderStudents() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    
    // Load from Firestore
    const querySnapshot = await getDocs(collection(db, "users", user.uid, "students"));
    const students = [];
    querySnapshot.forEach((doc) => {
      students.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Update cache
    cache.students = students;
    cache.lastSync = Date.now();
    
    const container = document.getElementById('studentsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (students.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <p>No students added yet.</p>
          <p>Use the "Add Student" form to get started.</p>
        </div>
      `;
      return;
    }
    
    students.forEach(student => {
      const studentCard = document.createElement('div');
      studentCard.className = 'card';
      studentCard.innerHTML = `
        <div class="card-header">
          <h3>${student.name}</h3>
          <span class="badge ${student.gender === 'Male' ? 'badge-primary' : 'badge-secondary'}">
            ${student.gender}
          </span>
        </div>
        <div class="card-body">
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Student ID:</span>
              <span class="value">${student.studentId || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="label">Subject:</span>
              <span class="value">${student.subject || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="label">Hourly Rate:</span>
              <span class="value">${fmtMoney(student.rate || 0)}</span>
            </div>
          </div>
          ${student.notes ? `<p class="notes"><strong>Notes:</strong> ${student.notes}</p>` : ''}
        </div>
        <div class="card-footer">
          <button class="btn btn-sm btn-primary edit-student-btn" data-id="${student.id}">
            ✏️ Edit
          </button>
          <button class="btn btn-sm btn-danger delete-student-btn" 
                  data-id="${student.id}" 
                  data-name="${student.name}">
            🗑️ Delete
          </button>
        </div>
      `;
      container.appendChild(studentCard);
    });
    
    // Add event listeners
    document.querySelectorAll('.edit-student-btn').forEach(btn => {
      btn.addEventListener('click', handleStudentEdit);
    });
    
    document.querySelectorAll('.delete-student-btn').forEach(btn => {
      btn.addEventListener('click', handleStudentDelete);
    });
    
  } catch (error) {
    console.error('Error rendering students:', error);
    showNotification('Error loading students: ' + error.message, 'error');
  }
}

async function renderRecentHoursWithEdit() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    
    // Load from Firestore
    const querySnapshot = await getDocs(collection(db, "users", user.uid, "hours"));
    const hours = [];
    querySnapshot.forEach((doc) => {
      hours.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Update cache
    cache.hours = hours;
    
    const container = document.getElementById('recentHoursTable');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sort by date (newest first)
    const sortedHours = [...hours].sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    ).slice(0, 20);
    
    if (sortedHours.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <p>No hours logged yet.</p>
          <p>Use the "Log Hours" form to get started.</p>
        </div>
      `;
      return;
    }
    
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Organization</th>
          <th>Work Type</th>
          <th>Student</th>
          <th>Hours</th>
          <th>Rate</th>
          <th>Total</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sortedHours.map(entry => `
          <tr>
            <td>${formatDate(entry.date)}</td>
            <td>${entry.organization || 'N/A'}</td>
            <td>${entry.workType || 'N/A'}</td>
            <td>${entry.student || 'N/A'}</td>
            <td>${entry.hours?.toFixed(1) || '0.0'}</td>
            <td>${fmtMoney(entry.rate || 0)}</td>
            <td>${fmtMoney(entry.total || 0)}</td>
            <td class="actions">
              <button class="btn-icon edit-hours-btn" 
                      data-id="${entry.id}">
                ✏️
              </button>
              <button class="btn-icon delete-hours-btn" 
                      data-id="${entry.id}">
                🗑️
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    container.appendChild(table);
    
    // Add event listeners
    document.querySelectorAll('.edit-hours-btn').forEach(btn => {
      btn.addEventListener('click', handleHoursEdit);
    });
    
    document.querySelectorAll('.delete-hours-btn').forEach(btn => {
      btn.addEventListener('click', handleHoursDelete);
    });
    
  } catch (error) {
    console.error('Error rendering hours:', error);
  }
}

// ===========================
// EDIT HANDLERS
// ===========================

function handleStudentEdit(event) {
  const button = event.currentTarget;
  const studentId = button.dataset.id;
  
  // Find student in cache
  const student = cache.students.find(s => s.id === studentId);
  if (!student) {
    showNotification('Student not found', 'error');
    return;
  }
  
  // Fill form with student data
  const formIds = FORM_IDS.STUDENT;
  document.getElementById(formIds.name).value = student.name || '';
  document.getElementById(formIds.id).value = student.studentId || '';
  document.getElementById(formIds.gender).value = student.gender || '';
  document.getElementById(formIds.subject).value = student.subject || '';
  document.getElementById(formIds.email).value = student.email || '';
  document.getElementById(formIds.phone).value = student.phone || '';
  document.getElementById(formIds.rate).value = student.rate || '';
  document.getElementById(formIds.notes).value = student.notes || '';
  
  // Set edit mode
  setEditMode('STUDENT', studentId);
  
  // Scroll to form
  document.getElementById('studentFormSection').scrollIntoView({ behavior: 'smooth' });
}

function handleHoursEdit(event) {
  const button = event.currentTarget;
  const entryId = button.dataset.id;
  
  // Find entry in cache
  const entry = cache.hours.find(h => h.id === entryId);
  if (!entry) {
    showNotification('Hours entry not found', 'error');
    return;
  }
  
  // Fill form with entry data
  const formIds = FORM_IDS.HOURS;
  document.getElementById(formIds.organization).value = entry.organization || '';
  document.getElementById(formIds.workType).value = entry.workType || '';
  document.getElementById(formIds.subject).value = entry.subject || '';
  document.getElementById(formIds.student).value = entry.student || '';
  document.getElementById(formIds.hours).value = entry.hours || '';
  document.getElementById(formIds.rate).value = entry.rate || '';
  document.getElementById(formIds.date).value = entry.date || '';
  document.getElementById(formIds.notes).value = entry.notes || '';
  
  // Set edit mode
  setEditMode('HOURS', entryId);
  
  // Scroll to form
  document.getElementById('hoursFormSection').scrollIntoView({ behavior: 'smooth' });
}

// ===========================
// DELETE HANDLERS
// ===========================

async function handleStudentDelete(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const button = event.target.closest('.delete-student-btn');
  if (!button) return;
  
  const studentId = button.dataset.id;
  const studentName = button.dataset.name || 'this student';
  
  if (!confirm(`Are you sure you want to delete "${studentName}"?`)) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      showNotification('Please log in to delete student', 'error');
      return;
    }
    
    // Delete the student
    await deleteDoc(doc(db, "users", user.uid, "students", studentId));
    
    // Update cache
    cache.students = cache.students.filter(s => s.id !== studentId);
    
    // Refresh UI
    await renderStudents();
    await populateStudentDropdowns();
    
    showNotification(`Student "${studentName}" deleted successfully`, 'success');
    
  } catch (error) {
    console.error('Error deleting student:', error);
    showNotification('Failed to delete student: ' + error.message, 'error');
  }
}

async function handleHoursDelete(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const button = event.target.closest('.delete-hours-btn');
  if (!button) return;
  
  const entryId = button.dataset.id;
  
  if (!confirm('Are you sure you want to delete this hours entry?')) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    if (!user) {
      showNotification('Please log in to delete hours', 'error');
      return;
    }
    
    await deleteDoc(doc(db, "users", user.uid, "hours", entryId));
    
    // Update cache
    cache.hours = cache.hours.filter(h => h.id !== entryId);
    
    // Refresh UI
    await renderRecentHoursWithEdit();
    
    showNotification('Hours entry deleted successfully', 'success');
    
  } catch (error) {
    console.error('Error deleting hours:', error);
    showNotification('Failed to delete hours: ' + error.message, 'error');
  }
}

// ===========================
// DROPDOWN POPULATION
// ===========================

async function populateStudentDropdowns() {
  try {
    const students = cache.students;
    
    // Student dropdown for hours form
    const dropdown = document.getElementById(FORM_IDS.HOURS.student);
    if (!dropdown) return;
    
    const currentValue = dropdown.value;
    dropdown.innerHTML = '<option value="">Select Student</option>';
    
    students.forEach(student => {
      const option = document.createElement('option');
      option.value = student.id;
      option.textContent = `${student.name} (${student.studentId || 'No ID'})`;
      dropdown.appendChild(option);
    });
    
    // Restore previous selection if possible
    if (currentValue && students.some(s => s.id === currentValue)) {
      dropdown.value = currentValue;
    }
    
  } catch (error) {
    console.error('Error populating student dropdowns:', error);
  }
}

// ===========================
// INITIALIZATION
// ===========================

async function initApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  // Set up auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('👤 User signed in:', user.email);
      currentUserData = user;
      
      // Load initial data
      await Promise.all([
        renderStudents(),
        renderRecentHoursWithEdit()
      ]);
      
      // Initialize UI
      await initUI();
      
    } else {
      console.log('👤 No user signed in');
      currentUserData = null;
      showLoginScreen();
    }
  });
  
  // Set up form event listeners
  setupFormListeners();
}

async function initUI() {
  console.log('🎨 Initializing UI...');
  
  // Update stats
  await updateStats();
  
  // Populate dropdowns
  await populateStudentDropdowns();
  
  console.log('✅ UI initialized');
}

async function updateStats() {
  try {
    const totalHours = cache.hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = cache.hours.reduce((sum, entry) => sum + safeNumber(entry.total), 0);
    const totalStudents = cache.students.length;
    
    // Update UI elements if they exist
    const totalHoursEl = document.getElementById('statTotalHours');
    const totalEarningsEl = document.getElementById('statTotalEarnings');
    const totalStudentsEl = document.getElementById('statTotalStudents');
    
    if (totalHoursEl) totalHoursEl.textContent = totalHours.toFixed(1);
    if (totalEarningsEl) totalEarningsEl.textContent = fmtMoney(totalEarnings);
    if (totalStudentsEl) totalStudentsEl.textContent = totalStudents;
    
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

function setupFormListeners() {
  // Student form
  const studentForm = document.getElementById(FORM_IDS.STUDENT.form);
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
    
    const cancelBtn = document.getElementById(FORM_IDS.STUDENT.cancelBtn);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEditMode);
    }
  }
  
  // Hours form
  const hoursForm = document.getElementById(FORM_IDS.HOURS.form);
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
    
    const cancelBtn = document.getElementById(FORM_IDS.HOURS.cancelBtn);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEditMode);
    }
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        showNotification('Logged out successfully', 'success');
      } catch (error) {
        console.error('Error signing out:', error);
        showNotification('Logout failed: ' + error.message, 'error');
      }
    });
  }
}

function showLoginScreen() {
  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.innerHTML = `
      <div style="max-width: 400px; margin: 100px auto; text-align: center;">
        <h2>Please Sign In</h2>
        <p>You need to sign in to access the WorkLog system.</p>
        <button onclick="window.location.href='login.html'" 
                style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
          Go to Login
        </button>
      </div>
    `;
  }
}

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Make functions available globally
window.handleStudentSubmit = handleStudentSubmit;
window.handleHoursSubmit = handleHoursSubmit;
window.cancelEditMode = cancelEditMode;
