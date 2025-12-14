// ===========================
// GLOBAL VARIABLES & STATE
// ===========================

// Global state
let currentUserData = null;
let allStudents = [];
let allHours = [];
let allPayments = [];
let allAttendance = [];
let allMarks = [];

// UI Elements cache
let uiElements = {};

// Loading states
let isLoading = {
  app: false,
  profile: false,
  students: false,
  hours: false,
  payments: false,
  stats: false
};

// ===========================
// INITIALIZATION
// ===========================

document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM Content Loaded - Starting app...');
  initializeApp();
});

async function initializeApp() {
  if (isLoading.app) {
    console.log('⏳ App already initializing...');
    return;
  }
  
  isLoading.app = true;
  console.log('🚀 Initializing WorkLog App...');
  
  try {
    // Initialize UI first
    await initializeUI();
    
    // Check authentication
    await checkAuthAndInitialize();
    
    // Setup network listeners
    setupNetworkListeners();
    
    console.log('✅ App initialization complete');
  } catch (error) {
    console.error('❌ App initialization failed:', error);
  } finally {
    isLoading.app = false;
  }
}

async function initializeUI() {
  console.log('🎨 Initializing UI...');
  
  try {
    // Cache UI elements
    cacheUIElements();
    
    // Initialize tabs
    initializeTabs();
    
    // Setup form handlers
    setupFormHandlers();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('✅ UI initialized');
  } catch (error) {
    console.error('❌ UI initialization failed:', error);
  }
}

function cacheUIElements() {
  console.log('🔍 Caching UI elements...');
  
  uiElements = {
    // Main sections
    guestSection: document.getElementById('guest-section'),
    userSection: document.getElementById('user-section'),
    
    // Stats
    studentCount: document.getElementById('student-count'),
    hourCount: document.getElementById('hour-count'),
    avgRate: document.getElementById('avg-rate'),
    totalEarnings: document.getElementById('total-earnings'),
    
    // Tabs
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Forms
    studentForm: document.getElementById('student-form'),
    hourForm: document.getElementById('hour-form'),
    paymentForm: document.getElementById('payment-form'),
    attendanceForm: document.getElementById('attendance-form'),
    markForm: document.getElementById('mark-form'),
    
    // Tables
    studentsTable: document.getElementById('students-table'),
    hoursTable: document.getElementById('hours-table'),
    paymentsTable: document.getElementById('payments-table'),
    
    // Buttons
    syncButton: document.getElementById('sync-button'),
    exportButton: document.getElementById('export-button'),
    importButton: document.getElementById('import-button'),
    clearButton: document.getElementById('clear-button'),
    logoutButton: document.getElementById('logout-button'),
    
    // User info
    userEmail: document.getElementById('user-email'),
    memberSince: document.getElementById('member-since')
  };
  
  console.log(`✅ Cached ${Object.keys(uiElements).length} UI elements`);
}

// ===========================
// AUTHENTICATION
// ===========================

async function checkAuthAndInitialize() {
  console.log('🔍 Checking authentication...');
  
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log(`✅ User signed in: ${user.email}`);
        await handleUserSignedIn(user);
        resolve(true);
      } else {
        console.log('👤 No user signed in');
        showGuestUI();
        resolve(false);
      }
    });
  });
}

async function handleUserSignedIn(user) {
  try {
    showUserUI();
    updateUserInfo(user);
    
    // Load all data sequentially
    await loadUserProfile(user.uid);
    await loadStudents(user.uid);
    await loadHours(user.uid);
    await loadPayments(user.uid);
    await loadAttendance(user.uid);
    await loadMarks(user.uid);
    
    // Update stats
    updateAllStats();
    
    console.log('✅ User data loaded successfully');
  } catch (error) {
    console.error('❌ Error loading user data:', error);
    showToast('Error loading data. Working in offline mode.', 'error');
  }
}

function showGuestUI() {
  if (uiElements.guestSection) uiElements.guestSection.style.display = 'block';
  if (uiElements.userSection) uiElements.userSection.style.display = 'none';
}

function showUserUI() {
  if (uiElements.guestSection) uiElements.guestSection.style.display = 'none';
  if (uiElements.userSection) uiElements.userSection.style.display = 'block';
}

function updateUserInfo(user) {
  if (uiElements.userEmail) {
    uiElements.userEmail.textContent = user.email;
  }
  
  if (uiElements.memberSince && currentUserData?.memberSince) {
    const date = new Date(currentUserData.memberSince);
    uiElements.memberSince.textContent = date.toLocaleDateString();
  }
}

// ===========================
// USER PROFILE FUNCTIONS
// ===========================

async function loadUserProfile(uid, forceRefresh = false) {
  if (isLoading.profile && !forceRefresh) {
    console.log('⏳ Profile already loading...');
    return currentUserData;
  }
  
  isLoading.profile = true;
  console.log('👤 Loading user profile for:', uid);
  
  const user = auth.currentUser;
  if (!user) {
    console.error('❌ No authenticated user');
    isLoading.profile = false;
    return null;
  }
  
  // Check if we're online
  const isOnline = navigator.onLine;
  
  // Create fallback profile
  const fallbackProfile = {
    uid: uid,
    email: user.email || '',
    createdAt: new Date().toISOString(),
    defaultRate: parseFloat(localStorage.getItem('userDefaultRate')) || 50,
    memberSince: localStorage.getItem('memberSince') || new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };
  
  // Try to load from Firestore if online and not forced to use cache
  if (isOnline && !forceRefresh) {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        currentUserData = { uid, ...userSnap.data() };
        console.log('✅ Profile loaded from Firestore');
        
        // Ensure required fields
        if (!currentUserData.memberSince) {
          currentUserData.memberSince = fallbackProfile.memberSince;
          await updateDoc(userRef, { memberSince: currentUserData.memberSince });
        }
        
        if (!currentUserData.defaultRate) {
          currentUserData.defaultRate = fallbackProfile.defaultRate;
          await updateDoc(userRef, { defaultRate: currentUserData.defaultRate });
        }
        
        // Update last login
        await updateDoc(userRef, {
          lastLogin: new Date().toISOString()
        });
        
      } else {
        // Create new profile
        console.log('🆕 Creating new user profile...');
        const newProfile = {
          email: user.email,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          memberSince: fallbackProfile.memberSince,
          defaultRate: fallbackProfile.defaultRate,
          settings: {}
        };
        
        await setDoc(userRef, newProfile);
        currentUserData = { uid, ...newProfile };
        console.log('✅ New profile created');
      }
      
      // Cache profile locally
      cacheData(`profile_${uid}`, currentUserData);
      
      // Update default rate in localStorage
      if (currentUserData.defaultRate) {
        localStorage.setItem('userDefaultRate', currentUserData.defaultRate.toString());
      }
      
    } catch (error) {
      console.warn('⚠️ Error loading profile from Firestore:', error.message);
      // Fall back to cached data
      currentUserData = getCachedData(`profile_${uid}`) || fallbackProfile;
    }
  } else {
    // Offline mode - use cached data
    console.log('📴 Offline - using cached profile');
    currentUserData = getCachedData(`profile_${uid}`) || fallbackProfile;
  }
  
  isLoading.profile = false;
  return currentUserData;
}

// ===========================
// STUDENT FUNCTIONS
// ===========================

async function loadStudents(userId, forceRefresh = false) {
  if (isLoading.students && !forceRefresh) {
    console.log('⏳ Students already loading...');
    return allStudents;
  }
  
  isLoading.students = true;
  console.log('📚 Loading students for user:', userId);
  
  const isOnline = navigator.onLine;
  
  // Try to load from Firestore if online
  if (isOnline && !forceRefresh) {
    try {
      const studentsRef = collection(db, "users", userId, "students");
      const querySnapshot = await getDocs(studentsRef);
      
      allStudents = [];
      querySnapshot.forEach((doc) => {
        allStudents.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt || new Date().toISOString()
        });
      });
      
      console.log(`✅ Loaded ${allStudents.length} students from Firestore`);
      
      // Cache locally
      cacheData(`students_${userId}`, allStudents);
      
      // Update UI
      updateStudentsTable();
      updateStudentDropdowns();
      
    } catch (error) {
      console.warn('⚠️ Error loading students from Firestore:', error.message);
      // Fall back to cached data
      allStudents = getCachedData(`students_${userId}`) || [];
    }
  } else {
    // Offline mode
    console.log('📴 Offline - using cached students');
    allStudents = getCachedData(`students_${userId}`) || [];
  }
  
  // Update UI even with empty data
  updateStudentsTable();
  updateStudentDropdowns();
  
  isLoading.students = false;
  return allStudents;
}

function updateStudentsTable() {
  const tableBody = document.querySelector('#students-table tbody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (allStudents.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="5" class="no-data">No students found. Add your first student!</td>`;
    tableBody.appendChild(row);
    return;
  }
  
  allStudents.forEach(student => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${student.name || 'Unnamed Student'}</td>
      <td>${student.email || '-'}</td>
      <td>${student.phone || '-'}</td>
      <td>$${student.rate || currentUserData?.defaultRate || 0}/hr</td>
      <td>
        <button class="btn-small btn-edit" onclick="editStudent('${student.id}')">Edit</button>
        <button class="btn-small btn-delete" onclick="deleteStudent('${student.id}')">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
  
  console.log(`✅ Updated students table with ${allStudents.length} students`);
}

function updateStudentDropdowns() {
  const studentSelects = document.querySelectorAll('select[name="studentId"], .student-select');
  
  studentSelects.forEach(select => {
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Select Student</option>';
    
    allStudents.forEach(student => {
      const option = document.createElement('option');
      option.value = student.id;
      option.textContent = student.name || `Student ${student.id.substring(0, 6)}`;
      option.selected = (student.id === currentValue);
      select.appendChild(option);
    });
  });
  
  console.log(`✅ Updated ${studentSelects.length} student dropdowns`);
}

async function saveStudent(studentData) {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please sign in to save students', 'error');
    return false;
  }
  
  try {
    const studentsRef = collection(db, "users", user.uid, "students");
    const studentId = studentData.id || `student_${Date.now()}`;
    
    const studentToSave = {
      ...studentData,
      id: undefined, // Remove id from data since it's the document ID
      updatedAt: new Date().toISOString(),
      createdAt: studentData.createdAt || new Date().toISOString()
    };
    
    if (studentData.id) {
      // Update existing
      await updateDoc(doc(studentsRef, studentData.id), studentToSave);
      console.log('✅ Student updated:', studentData.id);
    } else {
      // Create new
      await setDoc(doc(studentsRef, studentId), studentToSave);
      console.log('✅ Student created:', studentId);
    }
    
    // Reload students
    await loadStudents(user.uid, true);
    updateAllStats();
    
    showToast('Student saved successfully!', 'success');
    return true;
    
  } catch (error) {
    console.error('❌ Error saving student:', error);
    showToast('Error saving student', 'error');
    return false;
  }
}

async function editStudent(studentId) {
  const student = allStudents.find(s => s.id === studentId);
  if (!student) {
    showToast('Student not found', 'error');
    return;
  }
  
  // Populate form
  if (uiElements.studentForm) {
    document.getElementById('student-id').value = student.id;
    document.getElementById('student-name').value = student.name || '';
    document.getElementById('student-email').value = student.email || '';
    document.getElementById('student-phone').value = student.phone || '';
    document.getElementById('student-rate').value = student.rate || currentUserData?.defaultRate || 50;
    
    // Show form
    uiElements.studentForm.scrollIntoView({ behavior: 'smooth' });
    showToast(`Editing student: ${student.name}`, 'info');
  }
}

async function deleteStudent(studentId) {
  if (!confirm('Are you sure you want to delete this student? This will also delete their hours and payments.')) {
    return;
  }
  
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const studentRef = doc(db, "users", user.uid, "students", studentId);
    await deleteDoc(studentRef);
    
    console.log('✅ Student deleted:', studentId);
    
    // Reload data
    await loadStudents(user.uid, true);
    updateAllStats();
    
    showToast('Student deleted successfully', 'success');
  } catch (error) {
    console.error('❌ Error deleting student:', error);
    showToast('Error deleting student', 'error');
  }
}

// ===========================
// HOURS FUNCTIONS
// ===========================

async function loadHours(userId, forceRefresh = false) {
  if (isLoading.hours && !forceRefresh) {
    console.log('⏳ Hours already loading...');
    return allHours;
  }
  
  isLoading.hours = true;
  console.log('⏰ Loading hours for user:', userId);
  
  const isOnline = navigator.onLine;
  
  if (isOnline && !forceRefresh) {
    try {
      const hoursRef = collection(db, "users", userId, "hours");
      const querySnapshot = await getDocs(hoursRef);
      
      allHours = [];
      querySnapshot.forEach((doc) => {
        allHours.push({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date || new Date().toISOString().split('T')[0]
        });
      });
      
      console.log(`✅ Loaded ${allHours.length} hours from Firestore`);
      cacheData(`hours_${userId}`, allHours);
      updateHoursTable();
      
    } catch (error) {
      console.warn('⚠️ Error loading hours from Firestore:', error.message);
      allHours = getCachedData(`hours_${userId}`) || [];
    }
  } else {
    console.log('📴 Offline - using cached hours');
    allHours = getCachedData(`hours_${userId}`) || [];
  }
  
  updateHoursTable();
  isLoading.hours = false;
  return allHours;
}

function updateHoursTable() {
  const tableBody = document.querySelector('#hours-table tbody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (allHours.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="6" class="no-data">No hours logged yet. Add your first hour entry!</td>`;
    tableBody.appendChild(row);
    return;
  }
  
  // Sort by date (newest first)
  const sortedHours = [...allHours].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
  
  sortedHours.forEach(hour => {
    const student = allStudents.find(s => s.id === hour.studentId);
    const studentName = student ? student.name : 'Unknown Student';
    const rate = hour.rate || student?.rate || currentUserData?.defaultRate || 0;
    const earnings = hour.hours * rate;
    
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
  
  console.log(`✅ Updated hours table with ${allHours.length} entries`);
}

async function saveHour(hourData) {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please sign in to log hours', 'error');
    return false;
  }
  
  if (!hourData.studentId) {
    showToast('Please select a student', 'error');
    return false;
  }
  
  if (!hourData.hours || hourData.hours <= 0) {
    showToast('Please enter valid hours', 'error');
    return false;
  }
  
  try {
    const hoursRef = collection(db, "users", user.uid, "hours");
    const hourId = hourData.id || `hour_${Date.now()}`;
    
    const hourToSave = {
      ...hourData,
      id: undefined,
      date: hourData.date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (hourData.id) {
      await updateDoc(doc(hoursRef, hourData.id), hourToSave);
      console.log('✅ Hour updated:', hourData.id);
    } else {
      await setDoc(doc(hoursRef, hourId), hourToSave);
      console.log('✅ Hour created:', hourId);
    }
    
    // Reload hours
    await loadHours(user.uid, true);
    updateAllStats();
    
    showToast('Hours saved successfully!', 'success');
    return true;
    
  } catch (error) {
    console.error('❌ Error saving hours:', error);
    showToast('Error saving hours', 'error');
    return false;
  }
}

// ===========================
// PAYMENTS FUNCTIONS
// ===========================

async function loadPayments(userId, forceRefresh = false) {
  try {
    const paymentsRef = collection(db, "users", userId, "payments");
    const querySnapshot = await getDocs(paymentsRef);
    
    allPayments = [];
    querySnapshot.forEach((doc) => {
      allPayments.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`✅ Loaded ${allPayments.length} payments from Firestore`);
    cacheData(`payments_${userId}`, allPayments);
    updatePaymentsTable();
    
    return allPayments;
  } catch (error) {
    console.warn('⚠️ Error loading payments:', error.message);
    allPayments = getCachedData(`payments_${userId}`) || [];
    return allPayments;
  }
}

function updatePaymentsTable() {
  const tableBody = document.querySelector('#payments-table tbody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (allPayments.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="6" class="no-data">No payments recorded yet.</td>`;
    tableBody.appendChild(row);
    return;
  }
  
  allPayments.forEach(payment => {
    const student = allStudents.find(s => s.id === payment.studentId);
    const studentName = student ? student.name : 'Unknown Student';
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(payment.date)}</td>
      <td>${studentName}</td>
      <td>$${payment.amount?.toFixed(2) || '0.00'}</td>
      <td>${payment.method || '-'}</td>
      <td>${payment.notes || '-'}</td>
      <td>${payment.status || 'Pending'}</td>
    `;
    tableBody.appendChild(row);
  });
}

// ===========================
// ATTENDANCE & MARKS FUNCTIONS
// ===========================

async function loadAttendance(userId) {
  try {
    const attendanceRef = collection(db, "users", userId, "attendance");
    const querySnapshot = await getDocs(attendanceRef);
    
    allAttendance = [];
    querySnapshot.forEach((doc) => {
      allAttendance.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`✅ Loaded ${allAttendance.length} attendance records`);
    return allAttendance;
  } catch (error) {
    console.warn('⚠️ Error loading attendance:', error.message);
    return [];
  }
}

async function loadMarks(userId) {
  try {
    const marksRef = collection(db, "users", userId, "marks");
    const querySnapshot = await getDocs(marksRef);
    
    allMarks = [];
    querySnapshot.forEach((doc) => {
      allMarks.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`✅ Loaded ${allMarks.length} marks records`);
    return allMarks;
  } catch (error) {
    console.warn('⚠️ Error loading marks:', error.message);
    return [];
  }
}

// ===========================
// STATS FUNCTIONS
// ===========================

function updateAllStats() {
  console.log('📊 Updating all statistics...');
  
  if (isLoading.stats) return;
  isLoading.stats = true;
  
  try {
    // Student count
    if (uiElements.studentCount) {
      uiElements.studentCount.textContent = allStudents.length;
    }
    
    // Hour count
    const totalHours = allHours.reduce((sum, hour) => sum + (hour.hours || 0), 0);
    if (uiElements.hourCount) {
      uiElements.hourCount.textContent = totalHours.toFixed(1);
    }
    
    // Average rate
    const validStudents = allStudents.filter(s => s.rate && s.rate > 0);
    const avgStudentRate = validStudents.length > 0 
      ? validStudents.reduce((sum, s) => sum + s.rate, 0) / validStudents.length
      : currentUserData?.defaultRate || 50;
    
    if (uiElements.avgRate) {
      uiElements.avgRate.textContent = `$${avgStudentRate.toFixed(2)}/session`;
    }
    
    // Total earnings
    const totalEarnings = allHours.reduce((sum, hour) => {
      const student = allStudents.find(s => s.id === hour.studentId);
      const rate = hour.rate || student?.rate || currentUserData?.defaultRate || 0;
      return sum + (hour.hours * rate);
    }, 0);
    
    if (uiElements.totalEarnings) {
      uiElements.totalEarnings.textContent = `$${totalEarnings.toFixed(2)}`;
    }
    
    console.log(`✅ Stats updated: ${allStudents.length} students, ${totalHours} hours, $${totalEarnings.toFixed(2)} earnings`);
    
  } catch (error) {
    console.error('❌ Error updating stats:', error);
  } finally {
    isLoading.stats = false;
  }
}

// ===========================
// CACHE MANAGEMENT
// ===========================

function cacheData(key, data) {
  try {
    localStorage.setItem(`cache_${key}`, JSON.stringify({
      data: data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn(`⚠️ Could not cache ${key}:`, error.message);
  }
}

function getCachedData(key) {
  try {
    const cached = localStorage.getItem(`cache_${key}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Check if cache is fresh (less than 1 hour old)
      if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
        return parsed.data;
      }
    }
  } catch (error) {
    console.warn(`⚠️ Error reading cached ${key}:`, error.message);
  }
  return null;
}

function clearAllCache() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('cache_')) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log(`🧹 Cleared ${keysToRemove.length} cached items`);
}

// ===========================
// SYNC & IMPORT/EXPORT
// ===========================

async function syncNow() {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please sign in to sync', 'error');
    return;
  }
  
  showToast('Syncing data...', 'info');
  
  try {
    // Force refresh all data
    await loadUserProfile(user.uid, true);
    await loadStudents(user.uid, true);
    await loadHours(user.uid, true);
    await loadPayments(user.uid, true);
    
    updateAllStats();
    
    showToast('Sync complete!', 'success');
  } catch (error) {
    console.error('❌ Sync error:', error);
    showToast('Sync failed', 'error');
  }
}

async function exportData() {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please sign in to export', 'error');
    return;
  }
  
  try {
    const exportData = {
      version: '1.0',
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
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `worklog_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    showToast('Data exported successfully!', 'success');
  } catch (error) {
    console.error('❌ Export error:', error);
    showToast('Export failed', 'error');
  }
}

async function importData(file) {
  const user = auth.currentUser;
  if (!user) {
    showToast('Please sign in to import', 'error');
    return false;
  }
  
  if (!file) {
    showToast('Please select a file to import', 'error');
    return false;
  }
  
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // Validate import data
    if (!importData.data || !importData.data.students) {
      showToast('Invalid backup file format', 'error');
      return false;
    }
    
    showToast('Importing data...', 'info');
    
    // Import students
    for (const student of importData.data.students) {
      await saveStudent(student);
    }
    
    // Import hours
    for (const hour of importData.data.hours || []) {
      await saveHour(hour);
    }
    
    showToast('Import complete!', 'success');
    return true;
  } catch (error) {
    console.error('❌ Import error:', error);
    showToast('Import failed: ' + error.message, 'error');
    return false;
  }
}

// ===========================
// UI FUNCTIONS
// ===========================

function initializeTabs() {
  console.log('📑 Initializing tabs...');
  
  if (!uiElements.tabButtons || !uiElements.tabContents) {
    console.warn('⚠️ Tab elements not found');
    return;
  }
  
  uiElements.tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Show first tab by default
  if (uiElements.tabButtons.length > 0) {
    const firstTab = uiElements.tabButtons[0].getAttribute('data-tab');
    switchTab(firstTab);
  }
}

function switchTab(tabName) {
  console.log(`🔄 Switching to tab: ${tabName}`);
  
  // Update active tab button
  uiElements.tabButtons.forEach(button => {
    const isActive = button.getAttribute('data-tab') === tabName;
    button.classList.toggle('active', isActive);
  });
  
  // Show active tab content
  uiElements.tabContents.forEach(content => {
    const isActive = content.id === `${tabName}-tab`;
    content.style.display = isActive ? 'block' : 'none';
  });
  
  // Load tab-specific data if needed
  switch (tabName) {
    case 'students':
      updateStudentsTable();
      break;
    case 'hours':
      updateHoursTable();
      break;
    case 'payments':
      updatePaymentsTable();
      break;
  }
}

function setupFormHandlers() {
  console.log('📝 Setting up form handlers...');
  
  // Student form
  if (uiElements.studentForm) {
    uiElements.studentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const studentData = {
        id: document.getElementById('student-id').value || undefined,
        name: document.getElementById('student-name').value,
        email: document.getElementById('student-email').value,
        phone: document.getElementById('student-phone').value,
        rate: parseFloat(document.getElementById('student-rate').value) || currentUserData?.defaultRate || 50,
        notes: document.getElementById('student-notes')?.value || ''
      };
      
      const saved = await saveStudent(studentData);
      if (saved) {
        uiElements.studentForm.reset();
        document.getElementById('student-id').value = '';
      }
    });
  }
  
  // Hour form
  if (uiElements.hourForm) {
    uiElements.hourForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const hourData = {
        id: document.getElementById('hour-id').value || undefined,
        studentId: document.getElementById('hour-student').value,
        date: document.getElementById('hour-date').value,
        hours: parseFloat(document.getElementById('hour-hours').value),
        rate: parseFloat(document.getElementById('hour-rate').value) || undefined, // Will use student rate if not set
        notes: document.getElementById('hour-notes').value
      };
      
      const saved = await saveHour(hourData);
      if (saved) {
        uiElements.hourForm.reset();
        document.getElementById('hour-id').value = '';
      }
    });
  }
  
  console.log('✅ Form handlers set up');
}

function setupEventListeners() {
  console.log('🔗 Setting up event listeners...');
  
  // Sync button
  if (uiElements.syncButton) {
    uiElements.syncButton.addEventListener('click', syncNow);
  }
  
  // Export button
  if (uiElements.exportButton) {
    uiElements.exportButton.addEventListener('click', exportData);
  }
  
  // Import button
  if (uiElements.importButton) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    uiElements.importButton.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
      if (e.target.files[0]) {
        await importData(e.target.files[0]);
        fileInput.value = '';
      }
    });
  }
  
  // Clear button
  if (uiElements.clearButton) {
    uiElements.clearButton.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all cached data? This will not delete your cloud data.')) {
        clearAllCache();
        showToast('Cache cleared', 'info');
      }
    });
  }
  
  // Logout button
  if (uiElements.logoutButton) {
    uiElements.logoutButton.addEventListener('click', async () => {
      if (confirm('Are you sure you want to log out?')) {
        try {
          await auth.signOut();
          showToast('Logged out successfully', 'success');
          showGuestUI();
        } catch (error) {
          console.error('❌ Logout error:', error);
          showToast('Logout failed', 'error');
        }
      }
    });
  }
  
  console.log('✅ Event listeners set up');
}

function setupNetworkListeners() {
  window.addEventListener('online', () => {
    console.log('🌐 Online - syncing data...');
    showToast('Back online! Syncing data...', 'info');
    
    if (auth.currentUser) {
      setTimeout(() => syncNow(), 2000);
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('📴 Offline - using cached data');
    showToast('Offline. Using cached data.', 'warning');
  });
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function showToast(message, type = 'info') {
  console.log(`📢 Toast (${type}): ${message}`);
  
  // Create or get toast container
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 300px;
    `;
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    background: ${type === 'success' ? '#4CAF50' : 
                 type === 'error' ? '#f44336' : 
                 type === 'warning' ? '#ff9800' : '#2196F3'};
    color: white;
    padding: 12px 20px;
    margin-bottom: 10px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease;
  `;
  
  toastContainer.appendChild(toast);
  
  // Remove toast after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
  }, 5000);
}

// ===========================
// GLOBAL EXPORTS
// ===========================

// Make functions available globally for onclick handlers
window.editStudent = editStudent;
window.deleteStudent = deleteStudent;
window.syncNow = syncNow;
window.exportData = exportData;

// Add CSS for animations
if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

console.log('✅ app.js loaded successfully');
