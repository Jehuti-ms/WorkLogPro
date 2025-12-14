// ===========================
// FIREBASE IMPORTS
// ===========================
import { auth, db } from './firebase-config.js';
import { 
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, addDoc,
  query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ===========================
// GLOBAL STATE
// ===========================
let currentUserData = null;
let allStudents = [];
let allHours = [];
let allPayments = [];
let allAttendance = [];
let allMarks = [];
let isLoading = false;

// ===========================
// 1. TOAST/MESSAGE SYSTEM
// ===========================
function showToast(message, type = 'info', duration = 5000) {
  console.log(`📢 ${type.toUpperCase()}: ${message}`);
  
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  if (existingToasts.length > 3) {
    existingToasts[0].remove();
  }
  
  // Create toast container if needed
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 350px;
    `;
    document.body.appendChild(container);
  }
  
  // Create toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    background: ${type === 'success' ? '#10b981' : 
                 type === 'error' ? '#ef4444' : 
                 type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    padding: 12px 16px;
    margin-bottom: 10px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: toastSlideIn 0.3s ease;
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  
  // Add icon based on type
  const icon = document.createElement('span');
  icon.textContent = type === 'success' ? '✅' : 
                     type === 'error' ? '❌' : 
                     type === 'warning' ? '⚠️' : 'ℹ️';
  
  const text = document.createElement('span');
  text.textContent = message;
  
  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Add CSS for toast animations
if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes toastSlideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes toastSlideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ===========================
// 2. AUTHENTICATION & USER STATE
// ===========================
async function checkAuthState() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log(`✅ User authenticated: ${user.email}`);
        
        // Update UI immediately
        updateUserUI(user);
        
        // Load user profile
        await loadUserProfile(user.uid);
        
        // Load user data
        await loadUserData(user.uid);
        
        resolve(true);
      } else {
        console.log('👤 No user signed in');
        showGuestUI();
        resolve(false);
      }
    });
  });
}

function updateUserUI(user) {
  console.log('🎨 Updating UI for user:', user.email);
  
  // Hide guest section, show user section
  const guestSection = document.getElementById('guest-section');
  const userSection = document.getElementById('user-section');
  
  if (guestSection) guestSection.style.display = 'none';
  if (userSection) userSection.style.display = 'block';
  
  // Update user info
  const userEmail = document.getElementById('user-email');
  const profileBtn = document.getElementById('profileBtn');
  
  if (userEmail) userEmail.textContent = user.email;
  if (profileBtn) profileBtn.textContent = `👤 ${user.email.split('@')[0]}`;
}

function showGuestUI() {
  const guestSection = document.getElementById('guest-section');
  const userSection = document.getElementById('user-section');
  
  if (guestSection) guestSection.style.display = 'block';
  if (userSection) userSection.style.display = 'none';
}

// ===========================
// 3. USER PROFILE MANAGEMENT
// ===========================
async function loadUserProfile(userId) {
  if (isLoading) return;
  isLoading = true;
  
  console.log('👤 Loading user profile:', userId);
  
  try {
    // Try Firestore first
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      currentUserData = { uid: userId, ...userSnap.data() };
      console.log('✅ Profile loaded from Firestore');
      
      // Cache it
      localStorage.setItem(`user_profile_${userId}`, JSON.stringify(currentUserData));
      
      // Update default rate if exists
      if (currentUserData.defaultRate) {
        localStorage.setItem('userDefaultRate', currentUserData.defaultRate.toString());
      }
      
    } else {
      // Create new profile
      const user = auth.currentUser;
      const newProfile = {
        email: user.email,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        memberSince: new Date().toISOString(),
        defaultRate: 50
      };
      
      await setDoc(userRef, newProfile);
      currentUserData = { uid: userId, ...newProfile };
      console.log('✅ New profile created');
      
      // Cache it
      localStorage.setItem(`user_profile_${userId}`, JSON.stringify(currentUserData));
    }
    
  } catch (error) {
    console.warn('⚠️ Error loading profile, using cache:', error.message);
    
    // Try cache
    const cached = localStorage.getItem(`user_profile_${userId}`);
    if (cached) {
      currentUserData = JSON.parse(cached);
      console.log('📦 Using cached profile');
    } else {
      // Create minimal profile
      const user = auth.currentUser;
      currentUserData = {
        uid: userId,
        email: user.email,
        defaultRate: 50,
        createdAt: new Date().toISOString()
      };
    }
  } finally {
    isLoading = false;
  }
  
  return currentUserData;
}

// ===========================
// 4. DATA LOADING
// ===========================
async function loadUserData(userId) {
  console.log('📊 Loading user data for:', userId);
  
  try {
    // Load students
    await loadStudents(userId);
    
    // Load hours
    await loadHours(userId);
    
    // Update stats
    updateAllStats();
    
    console.log('✅ User data loaded successfully');
    showToast('Data loaded successfully', 'success');
    
  } catch (error) {
    console.error('❌ Error loading user data:', error);
    showToast('Error loading data', 'error');
  }
}

async function loadStudents(userId, forceRefresh = false) {
  console.log('📚 Loading students...');
  
  // Check cache first (unless forced)
  const cacheKey = `students_${userId}`;
  if (!forceRefresh) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Use cache if less than 5 minutes old
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        allStudents = parsed.data;
        updateStudentsTable();
        updateStudentDropdowns();
        console.log(`📦 Using cached students (${allStudents.length})`);
        return allStudents;
      }
    }
  }
  
  try {
    // Try Firestore
    const studentsRef = collection(db, "users", userId, "students");
    const querySnapshot = await getDocs(studentsRef);
    
    allStudents = [];
    querySnapshot.forEach((doc) => {
      allStudents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Loaded ${allStudents.length} students from Firestore`);
    
    // Cache results
    localStorage.setItem(cacheKey, JSON.stringify({
      data: allStudents,
      timestamp: Date.now()
    }));
    
  } catch (error) {
    console.warn('⚠️ Error loading students:', error.message);
    
    // Fall back to cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      allStudents = parsed.data || [];
      console.log(`📦 Fell back to cached students (${allStudents.length})`);
    } else {
      allStudents = [];
    }
  }
  
  updateStudentsTable();
  updateStudentDropdowns();
  return allStudents;
}

async function loadHours(userId, forceRefresh = false) {
  console.log('⏰ Loading hours...');
  
  // Check cache
  const cacheKey = `hours_${userId}`;
  if (!forceRefresh) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        allHours = parsed.data;
        updateHoursTable();
        console.log(`📦 Using cached hours (${allHours.length})`);
        return allHours;
      }
    }
  }
  
  try {
    const hoursRef = collection(db, "users", userId, "hours");
    const querySnapshot = await getDocs(hoursRef);
    
    allHours = [];
    querySnapshot.forEach((doc) => {
      allHours.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Loaded ${allHours.length} hours from Firestore`);
    
    // Cache
    localStorage.setItem(cacheKey, JSON.stringify({
      data: allHours,
      timestamp: Date.now()
    }));
    
  } catch (error) {
    console.warn('⚠️ Error loading hours:', error.message);
    
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      allHours = parsed.data || [];
    } else {
      allHours = [];
    }
  }
  
  updateHoursTable();
  return allHours;
}

// ===========================
// 5. UI UPDATES
// ===========================
function updateStudentsTable() {
  const tableBody = document.querySelector('#students-table tbody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (allStudents.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="5" class="no-data">No students yet. Add your first student!</td>`;
    tableBody.appendChild(row);
    return;
  }
  
  allStudents.forEach(student => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${student.name || 'Unnamed'}</td>
      <td>${student.email || '-'}</td>
      <td>${student.phone || '-'}</td>
      <td>$${student.rate || currentUserData?.defaultRate || 50}/hr</td>
      <td>
        <button class="btn-small btn-edit" onclick="editStudent('${student.id}')">Edit</button>
        <button class="btn-small btn-delete" onclick="deleteStudent('${student.id}')">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function updateStudentDropdowns() {
  const studentSelects = document.querySelectorAll('select[name="studentId"]');
  
  studentSelects.forEach(select => {
    const currentValue = select.value;
    select.innerHTML = '<option value="">Select Student</option>';
    
    allStudents.forEach(student => {
      const option = document.createElement('option');
      option.value = student.id;
      option.textContent = student.name || `Student ${student.id.substring(0, 6)}`;
      if (student.id === currentValue) option.selected = true;
      select.appendChild(option);
    });
  });
}

function updateHoursTable() {
  const tableBody = document.querySelector('#hours-table tbody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (allHours.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="6" class="no-data">No hours logged yet</td>`;
    tableBody.appendChild(row);
    return;
  }
  
  // Sort by date (newest first)
  const sortedHours = [...allHours].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
  
  sortedHours.forEach(hour => {
    const student = allStudents.find(s => s.id === hour.studentId);
    const studentName = student ? student.name : 'Unknown';
    const rate = hour.rate || student?.rate || currentUserData?.defaultRate || 50;
    const earnings = (hour.hours || 0) * rate;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(hour.date)}</td>
      <td>${studentName}</td>
      <td>${hour.hours || 0}</td>
      <td>$${rate}/hr</td>
      <td>$${earnings.toFixed(2)}</td>
      <td>${hour.notes || '-'}</td>
    `;
    tableBody.appendChild(row);
  });
}

function updateAllStats() {
  console.log('📊 Updating statistics...');
  
  // Student count
  const studentCount = document.getElementById('student-count');
  if (studentCount) studentCount.textContent = allStudents.length;
  
  // Total hours
  const totalHours = allHours.reduce((sum, hour) => sum + (hour.hours || 0), 0);
  const hourCount = document.getElementById('hour-count');
  if (hourCount) hourCount.textContent = totalHours.toFixed(1);
  
  // Average rate
  const validRates = allStudents.filter(s => s.rate > 0).map(s => s.rate);
  const avgRate = validRates.length > 0 
    ? validRates.reduce((a, b) => a + b, 0) / validRates.length
    : currentUserData?.defaultRate || 50;
  
  const avgRateElement = document.getElementById('avg-rate');
  if (avgRateElement) avgRateElement.textContent = `$${avgRate.toFixed(2)}/session`;
  
  // Total earnings
  const totalEarnings = allHours.reduce((sum, hour) => {
    const student = allStudents.find(s => s.id === hour.studentId);
    const rate = hour.rate || student?.rate || currentUserData?.defaultRate || 50;
    return sum + ((hour.hours || 0) * rate);
  }, 0);
  
  const totalEarningsElement = document.getElementById('total-earnings');
  if (totalEarningsElement) totalEarningsElement.textContent = `$${totalEarnings.toFixed(2)}`;
  
  console.log(`✅ Stats: ${allStudents.length} students, ${totalHours} hours, $${totalEarnings.toFixed(2)} earnings`);
}

// ===========================
// 6. DATA OPERATIONS
// ===========================
async function saveStudent(studentData) {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please sign in to save students', 'error');
    return false;
  }
  
  try {
    const studentsRef = collection(db, "users", user.uid, "students");
    
    if (studentData.id) {
      // Update existing
      const studentRef = doc(studentsRef, studentData.id);
      await updateDoc(studentRef, {
        ...studentData,
        id: undefined,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Student updated:', studentData.id);
    } else {
      // Create new
      const newStudentRef = doc(studentsRef);
      await setDoc(newStudentRef, {
        ...studentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Student created:', newStudentRef.id);
    }
    
    // Reload students
    await loadStudents(user.uid, true);
    updateAllStats();
    
    showToast('Student saved successfully', 'success');
    return true;
    
  } catch (error) {
    console.error('❌ Error saving student:', error);
    showToast('Error saving student: ' + error.message, 'error');
    return false;
  }
}

async function saveHour(hourData) {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please sign in to log hours', 'error');
    return false;
  }
  
  try {
    const hoursRef = collection(db, "users", user.uid, "hours");
    
    if (hourData.id) {
      const hourRef = doc(hoursRef, hourData.id);
      await updateDoc(hourRef, {
        ...hourData,
        id: undefined,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Hour updated:', hourData.id);
    } else {
      const newHourRef = doc(hoursRef);
      await setDoc(newHourRef, {
        ...hourData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Hour created:', newHourRef.id);
    }
    
    await loadHours(user.uid, true);
    updateAllStats();
    
    showToast('Hours saved successfully', 'success');
    return true;
    
  } catch (error) {
    console.error('❌ Error saving hours:', error);
    showToast('Error saving hours: ' + error.message, 'error');
    return false;
  }
}

// ===========================
// 7. IMPORT/EXPORT SYSTEM
// ===========================
async function exportData() {
  console.log('📤 Exporting data...');
  
  const user = auth.currentUser;
  if (!user) {
    showToast('Please sign in to export', 'error');
    return;
  }
  
  try {
    const exportData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      user: {
        email: user.email,
        uid: user.uid
      },
      data: {
        students: allStudents,
        hours: allHours,
        payments: allPayments,
        attendance: allAttendance,
        marks: allMarks
      }
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `worklog_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    showToast(`Exported ${allStudents.length} students and ${allHours.length} hours`, 'success');
    
  } catch (error) {
    console.error('❌ Export error:', error);
    showToast('Export failed: ' + error.message, 'error');
  }
}

async function importData(file) {
  console.log('📥 Importing data from:', file.name);
  
  const user = auth.currentUser;
  if (!user) {
    showToast('Please sign in to import', 'error');
    return false;
  }
  
  showToast('Reading import file...', 'info');
  
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // Validate
    if (!importData.data || !Array.isArray(importData.data.students)) {
      throw new Error('Invalid backup file format');
    }
    
    showToast(`Importing ${importData.data.students.length} students...`, 'info');
    
    let importedCount = 0;
    let errorCount = 0;
    
    // Import students
    for (const student of importData.data.students) {
      try {
        await saveStudent(student);
        importedCount++;
      } catch (error) {
        console.warn('Failed to import student:', error);
        errorCount++;
      }
    }
    
    // Import hours if available
    if (importData.data.hours && Array.isArray(importData.data.hours)) {
      showToast(`Importing ${importData.data.hours.length} hours...`, 'info');
      
      for (const hour of importData.data.hours) {
        try {
          await saveHour(hour);
        } catch (error) {
          console.warn('Failed to import hour:', error);
        }
      }
    }
    
    // Reload data
    await loadStudents(user.uid, true);
    updateAllStats();
    
    if (errorCount > 0) {
      showToast(`Imported ${importedCount} students (${errorCount} errors)`, 'warning');
    } else {
      showToast(`Successfully imported ${importedCount} students`, 'success');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Import error:', error);
    showToast('Import failed: ' + error.message, 'error');
    return false;
  }
}

// ===========================
// 8. BUTTON & FAB SYSTEM
// ===========================
function setupAllButtons() {
  console.log('🎯 Setting up ALL buttons...');
  
  // Create file input for imports
  const importFileInput = document.createElement('input');
  importFileInput.type = 'file';
  importFileInput.accept = '.json';
  importFileInput.style.display = 'none';
  importFileInput.id = 'import-file-input';
  document.body.appendChild(importFileInput);
  
  importFileInput.addEventListener('change', async (e) => {
    if (e.target.files[0]) {
      console.log('📄 File selected for import:', e.target.files[0].name);
      await importData(e.target.files[0]);
    }
  });
  
  // Map buttons to functions
  const buttonMap = {
    // Sync/Export/Import buttons
    'syncBtn': syncNow,
    'exportCloudBtn': exportData,
    'exportDataBtn': exportData,
    'importCloudBtn': () => importFileInput.click(),
    'importDataBtn': () => importFileInput.click(),
    'syncStatsBtn': () => { updateAllStats(); showToast('Stats refreshed', 'success'); },
    'clearDataBtn': () => {
      if (confirm('Clear ALL local cached data?')) {
        localStorage.clear();
        showToast('Cache cleared', 'success');
        setTimeout(() => location.reload(), 1000);
      }
    },
    'logoutBtn': async () => {
      if (confirm('Are you sure you want to log out?')) {
        try {
          await signOut(auth);
          showToast('Logged out successfully', 'success');
        } catch (error) {
          console.error('Logout error:', error);
          showToast('Logout failed', 'error');
        }
      }
    },
    
    // Student form
    'studentSubmitBtn': async () => {
      const form = document.getElementById('student-form');
      if (!form) return;
      
      const formData = new FormData(form);
      const studentData = {
        id: formData.get('student-id') || undefined,
        name: formData.get('student-name'),
        email: formData.get('student-email'),
        phone: formData.get('student-phone'),
        rate: parseFloat(formData.get('student-rate')) || currentUserData?.defaultRate || 50
      };
      
      if (!studentData.name) {
        showToast('Please enter a student name', 'error');
        return;
      }
      
      await saveStudent(studentData);
      form.reset();
      document.getElementById('student-id')?.value = '';
    },
    
    // Hour form
    'logHoursBtn': async () => {
      const form = document.getElementById('hour-form');
      if (!form) return;
      
      const formData = new FormData(form);
      const hourData = {
        id: formData.get('hour-id') || undefined,
        studentId: formData.get('hour-student'),
        date: formData.get('hour-date') || new Date().toISOString().split('T')[0],
        hours: parseFloat(formData.get('hour-hours')) || 0,
        rate: parseFloat(formData.get('hour-rate')) || undefined,
        notes: formData.get('hour-notes')
      };
      
      if (!hourData.studentId) {
        showToast('Please select a student', 'error');
        return;
      }
      
      if (!hourData.hours || hourData.hours <= 0) {
        showToast('Please enter valid hours', 'error');
        return;
      }
      
      await saveHour(hourData);
      form.reset();
      document.getElementById('hour-id')?.value = '';
    }
  };
  
  // Apply button handlers
  Object.entries(buttonMap).forEach(([id, handler]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = handler;
      console.log(`✅ ${id} connected`);
    }
  });
  
  // Setup FAB system
  setupFABSystem();
  
  // Setup tab buttons
  setupTabButtons();
  
  console.log('✅ All buttons configured');
}

function setupFABSystem() {
  console.log('🌀 Setting up FAB system...');
  
  const floatingAddBtn = document.getElementById('floatingAddBtn');
  const fabMenu = document.querySelector('.fab-menu, .fab-container');
  
  if (floatingAddBtn && fabMenu) {
    floatingAddBtn.onclick = () => {
      const isHidden = fabMenu.style.display === 'none' || !fabMenu.style.display;
      fabMenu.style.display = isHidden ? 'flex' : 'none';
      console.log('➕ FAB menu toggled');
    };
    console.log('✅ Main FAB connected');
  }
  
  // FAB items
  const fabItems = {
    'fabAddStudent': () => {
      console.log('👤 Add Student FAB clicked');
      switchTab('students');
      setTimeout(() => {
        const nameInput = document.getElementById('student-name');
        if (nameInput) {
          nameInput.focus();
          nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    },
    'fabAddHours': () => {
      console.log('⏱️ Log Hours FAB clicked');
      switchTab('hours');
      setTimeout(() => {
        const dateInput = document.getElementById('hour-date');
        if (dateInput) {
          dateInput.value = new Date().toISOString().split('T')[0];
          dateInput.focus();
          dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    },
    'fabAddMark': () => {
      console.log('📝 Add Mark FAB clicked');
      switchTab('marks');
    },
    'fabAddAttendance': () => {
      console.log('✅ Take Attendance FAB clicked');
      switchTab('attendance');
    }
  };
  
  Object.entries(fabItems).forEach(([id, handler]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = handler;
      console.log(`✅ ${id} connected`);
    }
  });
}

function setupTabButtons() {
  console.log('📑 Setting up tab buttons...');
  
  const tabButtons = document.querySelectorAll('.tab');
  tabButtons.forEach(btn => {
    btn.onclick = () => {
      const text = btn.textContent.trim().toLowerCase();
      let tabName = '';
      
      if (text.includes('student')) tabName = 'students';
      else if (text.includes('hour')) tabName = 'hours';
      else if (text.includes('mark')) tabName = 'marks';
      else if (text.includes('attendance')) tabName = 'attendance';
      else if (text.includes('payment')) tabName = 'payments';
      else if (text.includes('report')) tabName = 'reports';
      
      if (tabName) {
        console.log(`📑 Switching to ${tabName} tab`);
        switchTab(tabName);
      }
    };
  });
  
  console.log(`✅ ${tabButtons.length} tab buttons connected`);
}

function switchTab(tabName) {
  console.log(`📑 Switching to tab: ${tabName}`);
  
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(el => {
    el.style.display = 'none';
  });
  
  // Show selected tab
  const tabContent = document.getElementById(`${tabName}-tab`);
  if (tabContent) tabContent.style.display = 'block';
  
  // Update active tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Find and activate matching tab button
  document.querySelectorAll('.tab').forEach(tab => {
    const text = tab.textContent.trim().toLowerCase();
    if (text.includes(tabName.toLowerCase())) {
      tab.classList.add('active');
    }
  });
}

// ===========================
// 9. SYNC FUNCTION
// ===========================
async function syncNow() {
  console.log('🔄 Syncing data...');
  
  const user = auth.currentUser;
  if (!user) {
    showToast('Please sign in to sync', 'error');
    return;
  }
  
  showToast('Syncing data...', 'info');
  
  try {
    // Force refresh all data
    await loadUserProfile(user.uid);
    await loadStudents(user.uid, true);
    await loadHours(user.uid, true);
    
    updateAllStats();
    
    showToast('Sync complete!', 'success');
    
  } catch (error) {
    console.error('❌ Sync error:', error);
    showToast('Sync failed: ' + error.message, 'error');
  }
}

// ===========================
// 10. UTILITY FUNCTIONS
// ===========================
function formatDate(dateString) {
  if (!dateString) return '-';
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

// ===========================
// 11. INITIALIZATION
// ===========================
async function initializeApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  try {
    // Check auth state
    await checkAuthState();
    
    // Setup all buttons and event listeners
    setupAllButtons();
    
    // Setup network listeners
    window.addEventListener('online', () => {
      console.log('🌐 Online');
      showToast('Back online!', 'success');
      if (auth.currentUser) {
        setTimeout(syncNow, 2000);
      }
    });
    
    window.addEventListener('offline', () => {
      console.log('📴 Offline');
      showToast('Working offline', 'warning');
    });
    
    console.log('✅ App initialization complete');
    showToast('App ready!', 'success');
    
  } catch (error) {
    console.error('❌ App initialization failed:', error);
    showToast('App initialization failed', 'error');
  }
}

// ===========================
// 12. GLOBAL EXPORTS
// ===========================
// Make functions available globally for onclick handlers in HTML
window.editStudent = async (studentId) => {
  const student = allStudents.find(s => s.id === studentId);
  if (!student) {
    showToast('Student not found', 'error');
    return;
  }
  
  // Populate form
  const form = document.getElementById('student-form');
  if (form) {
    document.getElementById('student-id').value = student.id;
    document.getElementById('student-name').value = student.name || '';
    document.getElementById('student-email').value = student.email || '';
    document.getElementById('student-phone').value = student.phone || '';
    document.getElementById('student-rate').value = student.rate || currentUserData?.defaultRate || 50;
    
    // Switch to students tab and scroll to form
    switchTab('students');
    setTimeout(() => {
      form.scrollIntoView({ behavior: 'smooth' });
    }, 300);
    
    showToast(`Editing student: ${student.name}`, 'info');
  }
};

window.deleteStudent = async (studentId) => {
  if (!confirm('Are you sure you want to delete this student?')) {
    return;
  }
  
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const studentRef = doc(db, "users", user.uid, "students", studentId);
    await deleteDoc(studentRef);
    
    console.log('✅ Student deleted:', studentId);
    
    // Reload students
    await loadStudents(user.uid, true);
    updateAllStats();
    
    showToast('Student deleted successfully', 'success');
    
  } catch (error) {
    console.error('❌ Error deleting student:', error);
    showToast('Error deleting student', 'error');
  }
};

// Also export other functions that might be called from HTML
window.syncNow = syncNow;
window.exportData = exportData;
window.showToast = showToast;
window.switchTab = switchTab;

// ===========================
// 13. START THE APP
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM Content Loaded');
  initializeApp();
});

console.log('✅ app.js loaded successfully');
