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
  deleteDoc,
  serverTimestamp
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
let currentEditMarksId = null;
let currentEditAttendanceId = null;
let currentEditPaymentId = null;
let appInitialized = false;
let domContentLoadedFired = false;

// ===========================
// UTILITY FUNCTIONS
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

function safeNumber(n, fallback = 0) {
  if (n === null || n === undefined || n === '') return fallback;
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function fmtMoney(n) {
  return safeNumber(n).toFixed(2);
}

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function showNotification(message, type = 'info') {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notification => notification.remove());

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);

  // Close button
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });
}

// ===========================
// SIMPLE STORAGE SYSTEM (Back to basics)
// ===========================

const SimpleStorage = {
  async saveItem(collectionName, data) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      if (data.id && data.id.startsWith('local_')) {
        // Update existing local item
        const docRef = doc(db, "users", user.uid, collectionName, data.id);
        await updateDoc(docRef, data);
        return data.id;
      } else {
        // Create new item
        const docRef = await addDoc(collection(db, "users", user.uid, collectionName), data);
        return docRef.id;
      }
    } catch (error) {
      console.error(`Error saving ${collectionName}:`, error);
      throw error;
    }
  },

  async getItems(collectionName, orderField = null) {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const firestoreQuery = orderField 
        ? query(collection(db, "users", user.uid, collectionName), orderBy(orderField, "desc"))
        : collection(db, "users", user.uid, collectionName);
      
      const snap = await getDocs(firestoreQuery);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Error loading ${collectionName}:`, error);
      return [];
    }
  },

  async deleteItem(collectionName, itemId) {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      await deleteDoc(doc(db, "users", user.uid, collectionName, itemId));
    } catch (error) {
      console.error(`Error deleting ${collectionName}:`, error);
      throw error;
    }
  }
};

// ===========================
// STUDENT MANAGEMENT (Working version)
// ===========================

async function renderStudents() {
  const container = document.getElementById('studentsList');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading students...</div>';

  try {
    const students = await SimpleStorage.getItems('students');
    
    if (students.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No students added yet</h3><p>Add your first student to get started</p></div>';
      return;
    }

    container.innerHTML = renderStudentsList(students);
    setupStudentEventListeners();
    
  } catch (error) {
    console.error('Error loading students:', error);
    container.innerHTML = '<div class="error">Error loading students</div>';
  }
}

function renderStudentsList(students) {
  return `
    <div class="students-grid">
      ${students.map(student => `
        <div class="student-card" data-student-id="${student.id}">
          <div class="student-header">
            <h3>${student.name || 'Unnamed Student'}</h3>
            <div class="student-actions">
              <button class="btn-icon edit-student" title="Edit Student">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon delete-student" title="Delete Student">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="student-details">
            <div class="student-info">
              <span class="label">Rate:</span>
              <span class="value">$${fmtMoney(student.rate || 0)}/hr</span>
            </div>
            <div class="student-info">
              <span class="label">Subject:</span>
              <span class="value">${student.subject || 'Not specified'}</span>
            </div>
            <div class="student-info">
              <span class="label">Contact:</span>
              <span class="value">${student.contact || 'Not provided'}</span>
            </div>
            ${student.notes ? `
            <div class="student-info">
              <span class="label">Notes:</span>
              <span class="value">${student.notes}</span>
            </div>
            ` : ''}
          </div>
          <div class="student-stats">
            <div class="stat">
              <span class="stat-label">Total Hours</span>
              <span class="stat-value">${student.totalHours || 0}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Total Earned</span>
              <span class="stat-value">$${fmtMoney(student.totalEarned || 0)}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function setupStudentEventListeners() {
  // Edit student buttons
  document.querySelectorAll('.edit-student').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const studentCard = e.target.closest('.student-card');
      const studentId = studentCard.dataset.studentId;
      editStudent(studentId);
    });
  });

  // Delete student buttons
  document.querySelectorAll('.delete-student').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const studentCard = e.target.closest('.student-card');
      const studentId = studentCard.dataset.studentId;
      deleteStudent(studentId);
    });
  });
}

function setupStudentForm() {
  const studentForm = document.getElementById('studentForm');
  if (!studentForm) {
    console.warn('⚠️ Student form not found in DOM');
    return;
  }

  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(studentForm);
    const studentData = {
      name: formData.get('name'),
      rate: safeNumber(formData.get('rate')),
      subject: formData.get('subject'),
      contact: formData.get('contact'),
      notes: formData.get('notes'),
      createdAt: new Date().toISOString(),
      totalHours: 0,
      totalEarned: 0
    };

    try {
      if (currentEditStudentId) {
        // Update existing student
        await SimpleStorage.saveItem('students', { ...studentData, id: currentEditStudentId });
        showNotification('Student updated successfully!', 'success');
        currentEditStudentId = null;
        
        // Reset form to "add" mode
        studentForm.querySelector('button[type="submit"]').textContent = 'Add Student';
        studentForm.reset();
      } else {
        // Add new student
        await SimpleStorage.saveItem('students', studentData);
        showNotification('Student added successfully!', 'success');
        studentForm.reset();
      }
      
      await renderStudents();
      await populateStudentDropdowns(); // Refresh dropdowns
    } catch (error) {
      console.error('Error saving student:', error);
      showNotification('Failed to save student', 'error');
    }
  });
}

async function editStudent(studentId) {
  try {
    const students = await SimpleStorage.getItems('students');
    const student = students.find(s => s.id === studentId);
    
    if (student) {
      // Fill form with student data
      document.getElementById('studentName').value = student.name || '';
      document.getElementById('studentRate').value = student.rate || '';
      document.getElementById('studentSubject').value = student.subject || '';
      document.getElementById('studentContact').value = student.contact || '';
      document.getElementById('studentNotes').value = student.notes || '';
      
      // Change form to edit mode
      currentEditStudentId = studentId;
      document.getElementById('studentForm').querySelector('button[type="submit"]').textContent = 'Update Student';
      
      // Scroll to form
      document.getElementById('studentForm').scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error loading student for edit:', error);
    showNotification('Failed to load student data', 'error');
  }
}

async function deleteStudent(studentId) {
  if (!confirm('Are you sure you want to delete this student? This will also delete all associated hours, marks, and attendance records.')) {
    return;
  }

  try {
    await SimpleStorage.deleteItem('students', studentId);
    
    // Also delete associated records
    await deleteAssociatedRecords('hours', 'studentId', studentId);
    await deleteAssociatedRecords('marks', 'studentId', studentId);
    await deleteAssociatedRecords('attendance', 'studentId', studentId);
    await deleteAssociatedRecords('payments', 'studentId', studentId);
    
    showNotification('Student and all associated data deleted successfully', 'success');
    await renderStudents();
    await populateStudentDropdowns(); // Refresh dropdowns
    
  } catch (error) {
    console.error('Error deleting student:', error);
    showNotification('Failed to delete student', 'error');
  }
}

async function deleteAssociatedRecords(collectionName, field, value) {
  try {
    const items = await SimpleStorage.getItems(collectionName);
    const deletePromises = items
      .filter(item => item[field] === value)
      .map(item => SimpleStorage.deleteItem(collectionName, item.id));
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error(`Error deleting associated ${collectionName}:`, error);
  }
}

// ===========================
// HOURS TRACKING (Working version)
// ===========================

async function renderRecentHours() {
  const container = document.getElementById('recentHoursList');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading hours...</div>';

  try {
    const hours = await SimpleStorage.getItems('hours', 'dateIso');
    
    if (hours.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No hours logged yet</h3><p>Track your tutoring sessions to see them here</p></div>';
      return;
    }

    const recentHours = hours.slice(0, 10);
    container.innerHTML = renderHoursList(recentHours);
    setupHoursEventListeners();
    
  } catch (error) {
    console.error('Error loading hours:', error);
    container.innerHTML = '<div class="error">Error loading hours</div>';
  }
}

function renderHoursList(hours) {
  return `
    <div class="hours-list">
      ${hours.map(hour => `
        <div class="hour-item" data-hour-id="${hour.id}">
          <div class="hour-header">
            <div class="hour-student">${hour.studentName || 'Unknown Student'}</div>
            <div class="hour-amount">$${fmtMoney(hour.amount || 0)}</div>
          </div>
          <div class="hour-details">
            <div class="hour-date">${formatDate(hour.date)}</div>
            <div class="hour-duration">${hour.duration || 0} hours</div>
            <div class="hour-rate">@ $${fmtMoney(hour.rate || 0)}/hr</div>
          </div>
          ${hour.notes ? `<div class="hour-notes">${hour.notes}</div>` : ''}
          <div class="hour-actions">
            <button class="btn-small edit-hour">Edit</button>
            <button class="btn-small btn-danger delete-hour">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function setupHoursEventListeners() {
  document.querySelectorAll('.edit-hour').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hourItem = e.target.closest('.hour-item');
      const hourId = hourItem.dataset.hourId;
      editHours(hourId);
    });
  });

  document.querySelectorAll('.delete-hour').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hourItem = e.target.closest('.hour-item');
      const hourId = hourItem.dataset.hourId;
      deleteHours(hourId);
    });
  });
}

function setupHoursForm() {
  const hoursForm = document.getElementById('hoursForm');
  if (!hoursForm) {
    console.warn('⚠️ Hours form not found in DOM');
    return;
  }

  // Rate calculation
  const durationInput = document.getElementById('hoursDuration');
  const rateInput = document.getElementById('hoursRate');
  const amountDisplay = document.getElementById('hoursAmount');

  if (durationInput && rateInput && amountDisplay) {
    function calculateAmount() {
      const duration = safeNumber(durationInput.value);
      const rate = safeNumber(rateInput.value);
      const amount = duration * rate;
      amountDisplay.textContent = fmtMoney(amount);
    }

    durationInput.addEventListener('input', calculateAmount);
    rateInput.addEventListener('input', calculateAmount);
  }

  // Form submission
  hoursForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(hoursForm);
    const studentId = formData.get('studentId');
    const studentSelect = document.getElementById('hoursStudent');
    const studentName = studentSelect ? studentSelect.selectedOptions[0]?.text || 'Unknown' : 'Unknown';
    
    const hoursData = {
      studentId: studentId,
      studentName: studentName,
      date: formData.get('date'),
      dateIso: fmtDateISO(formData.get('date')),
      duration: safeNumber(formData.get('duration')),
      rate: safeNumber(formData.get('rate')),
      amount: safeNumber(formData.get('duration')) * safeNumber(formData.get('rate')),
      notes: formData.get('notes'),
      createdAt: new Date().toISOString()
    };

    try {
      if (currentEditHoursId) {
        // Update existing hours
        await SimpleStorage.saveItem('hours', { ...hoursData, id: currentEditHoursId });
        showNotification('Hours updated successfully!', 'success');
        currentEditHoursId = null;
        
        // Reset form
        hoursForm.querySelector('button[type="submit"]').textContent = 'Log Hours';
        hoursForm.reset();
        if (amountDisplay) amountDisplay.textContent = '0.00';
      } else {
        // Add new hours
        await SimpleStorage.saveItem('hours', hoursData);
        showNotification('Hours logged successfully!', 'success');
        hoursForm.reset();
        if (amountDisplay) amountDisplay.textContent = '0.00';
      }
      
      await renderRecentHours();
      await updateStudentTotals(studentId);
      
    } catch (error) {
      console.error('Error saving hours:', error);
      showNotification('Failed to save hours', 'error');
    }
  });

  // Set default date to today
  const dateInput = document.getElementById('hoursDate');
  if (dateInput) {
    dateInput.value = getLocalISODate();
  }
}

async function editHours(hoursId) {
  try {
    const hours = await SimpleStorage.getItems('hours');
    const hour = hours.find(h => h.id === hoursId);
    
    if (hour) {
      // Fill form with hours data
      document.getElementById('hoursStudent').value = hour.studentId || '';
      document.getElementById('hoursDate').value = formatDateForInput(hour.date);
      document.getElementById('hoursDuration').value = hour.duration || '';
      document.getElementById('hoursRate').value = hour.rate || '';
      document.getElementById('hoursNotes').value = hour.notes || '';
      
      // Update amount display
      const amountDisplay = document.getElementById('hoursAmount');
      if (amountDisplay) amountDisplay.textContent = fmtMoney(hour.amount || 0);
      
      // Change form to edit mode
      currentEditHoursId = hoursId;
      document.getElementById('hoursForm').querySelector('button[type="submit"]').textContent = 'Update Hours';
      
      // Scroll to form
      document.getElementById('hoursForm').scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error loading hours for edit:', error);
    showNotification('Failed to load hours data', 'error');
  }
}

async function deleteHours(hoursId) {
  if (!confirm('Are you sure you want to delete these hours?')) {
    return;
  }

  try {
    const hours = await SimpleStorage.getItems('hours');
    const hour = hours.find(h => h.id === hoursId);
    const studentId = hour?.studentId;

    await SimpleStorage.deleteItem('hours', hoursId);
    showNotification('Hours deleted successfully', 'success');
    await renderRecentHours();
    
    if (studentId) {
      await updateStudentTotals(studentId);
    }
    
  } catch (error) {
    console.error('Error deleting hours:', error);
    showNotification('Failed to delete hours', 'error');
  }
}

async function updateStudentTotals(studentId) {
  try {
    const hours = await SimpleStorage.getItems('hours');
    const studentHours = hours.filter(hour => hour.studentId === studentId);
    
    const totalHours = studentHours.reduce((sum, hour) => sum + safeNumber(hour.duration), 0);
    const totalEarned = studentHours.reduce((sum, hour) => sum + safeNumber(hour.amount), 0);
    
    // Update student document
    const students = await SimpleStorage.getItems('students');
    const student = students.find(s => s.id === studentId);
    
    if (student) {
      await SimpleStorage.saveItem('students', {
        ...student,
        totalHours: totalHours,
        totalEarned: totalEarned
      });
      
      await renderStudents(); // Refresh students display
    }
    
  } catch (error) {
    console.error('Error updating student totals:', error);
  }
}

// ===========================
// STUDENT DROPDOWN MANAGEMENT
// ===========================

async function populateStudentDropdowns() {
  try {
    const students = await SimpleStorage.getItems('students');
    const dropdowns = [
      'hoursStudent',
      'marksStudent', 
      'attendanceStudent',
      'paymentStudent'
    ];

    dropdowns.forEach(dropdownId => {
      const dropdown = document.getElementById(dropdownId);
      if (dropdown) {
        // Clear existing options except the first one
        while (dropdown.options.length > 1) {
          dropdown.remove(1);
        }

        // Add student options
        students.forEach(student => {
          const option = document.createElement('option');
          option.value = student.id;
          option.textContent = student.name || 'Unnamed Student';
          dropdown.appendChild(option);
        });
      }
    });
  } catch (error) {
    console.error('Error populating student dropdowns:', error);
  }
}

// ===========================
// TAB NAVIGATION (Simple version)
// ===========================

function setupTabNavigation() {
  console.log('🔧 Setting up tab navigation...');
  
  const tabButtons = document.querySelectorAll('[data-tab]');
  const tabContents = document.querySelectorAll('.tab-content');

  if (tabButtons.length === 0 || tabContents.length === 0) {
    console.error('❌ No tabs found in DOM!');
    return;
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      switchToTab(targetTab);
    });
  });

  // Activate first tab by default
  if (tabButtons.length > 0) {
    switchToTab(tabButtons[0].getAttribute('data-tab'));
  }
}

function switchToTab(tabName) {
  // Update tab buttons
  const tabButtons = document.querySelectorAll('[data-tab]');
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    }
  });

  // Update tab contents
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.classList.remove('active');
    if (content.id === tabName) {
      content.classList.add('active');
    }
  });

  // Load data for the active tab
  switch(tabName) {
    case 'students':
      renderStudents();
      break;
    case 'hours':
      renderRecentHours();
      populateStudentDropdowns();
      break;
    case 'marks':
      // renderRecentMarks();
      populateStudentDropdowns();
      break;
    case 'attendance':
      // renderAttendanceRecent();
      populateStudentDropdowns();
      break;
    case 'payments':
      // renderPaymentActivity();
      populateStudentDropdowns();
      break;
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
  
  if (currentUserData) {
    updateProfileButton(currentUserData);
  } else {
    updateProfileButton(fallbackProfile);
  }
  
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
      
      await setDoc(userRef, profileToCreate);
      currentUserData = { uid, ...profileToCreate };
      return currentUserData;
    }
  } catch (err) {
    console.error("❌ Error loading user profile:", err);
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
  }
}

function initializeDefaultRate(defaultRate = 0) {
  const defaultRateInput = document.getElementById('defaultRate');
  if (defaultRateInput) {
    defaultRateInput.value = defaultRate;
  }
}

// ===========================
// PROFILE MODAL
// ===========================

function setupProfileModal() {
  const profileBtn = document.getElementById('profileBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileModal = document.getElementById('closeProfileModal');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!profileModal) return;

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      profileModal.style.display = 'flex';
    });
  }

  if (closeProfileModal) {
    closeProfileModal.addEventListener('click', () => {
      profileModal.style.display = 'none';
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
          showNotification('Logout failed', 'error');
        }
      }
    });
  }

  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === profileModal) {
      profileModal.style.display = 'none';
    }
  });
}

// ===========================
// THEME MANAGEMENT
// ===========================

function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function setupThemeToggle() {
  const themeToggle = document.querySelector('.theme-toggle button');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
}

// ===========================
// FLOATING ADD BUTTON
// ===========================

function setupFloatingAddButton() {
  const fab = document.getElementById('floatingAddBtn');
  if (!fab) return;

  fab.addEventListener('click', () => {
    // Simple implementation - just scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===========================
// SYNC MANAGEMENT (Basic)
// ===========================

function setupSyncManagement() {
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      await manualSync();
    });
  }
}

async function manualSync() {
  showNotification('Syncing data...', 'info');
  
  try {
    // Refresh all data
    await Promise.all([
      renderStudents(),
      renderRecentHours()
    ]);
    
    showNotification('Data synced successfully', 'success');
  } catch (error) {
    console.error('Sync failed:', error);
    showNotification('Sync failed', 'error');
  }
}

// ===========================
// MAIN APP INITIALIZATION
// ===========================

async function initializeApp() {
  if (appInitialized) return;
  
  console.log('🚀 Initializing WorkLog App...');
  appInitialized = true;

  try {
    // Wait for auth state
    const user = await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });

    if (!user) {
      window.location.href = "auth.html";
      return;
    }

    console.log('✅ User authenticated:', user.uid);

    // Initialize core systems
    initializeTheme();
    setupThemeToggle();
    setupProfileModal();
    setupFloatingAddButton();
    setupSyncManagement();
    
    // Load user data
    await loadUserProfile(user.uid);

    // Setup tab navigation
    setupTabNavigation();

    // Setup forms
    setupStudentForm();
    setupHoursForm();

    console.log('✅ WorkLog App initialized successfully');
    showNotification('App loaded successfully', 'success');

  } catch (error) {
    console.error('❌ App initialization failed:', error);
    showNotification('App initialization failed', 'error');
  }
}

// ===========================
// START THE APPLICATION
// ===========================

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    initializeApp().catch(console.error);
  }, 100);
});
