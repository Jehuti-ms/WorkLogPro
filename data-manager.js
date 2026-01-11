// data-manager.js - Data management and storage for WorkLog Pro
// Handles local storage, Firebase sync, and data operations

// ==================== LOCAL STORAGE OPERATIONS ====================

// STUDENTS
function saveStudent(student) {
  try {
    const students = getStudents();
    
    // Check if editing existing student
    const existingIndex = students.findIndex(s => s.id === student.id);
    
    if (existingIndex !== -1) {
      // Update existing student
      students[existingIndex] = {
        ...students[existingIndex],
        ...student,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new student
      student.createdAt = student.createdAt || new Date().toISOString();
      student.updatedAt = new Date().toISOString();
      students.push(student);
    }
    
    localStorage.setItem('worklog_students', JSON.stringify(students));
    return { success: true, data: student };
  } catch (error) {
    console.error('Error saving student:', error);
    return { success: false, error: error.message };
  }
}

function getStudents() {
  try {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    return students.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  } catch (error) {
    console.error('Error getting students:', error);
    return [];
  }
}

function getStudentById(id) {
  const students = getStudents();
  return students.find(student => student.id === id);
}

function deleteStudent(id) {
  try {
    const students = getStudents();
    const filteredStudents = students.filter(student => student.id !== id);
    localStorage.setItem('worklog_students', JSON.stringify(filteredStudents));
    return { success: true };
  } catch (error) {
    console.error('Error deleting student:', error);
    return { success: false, error: error.message };
  }
}

// HOURS/WORK LOGS
function saveHour(hour) {
  try {
    const hours = getHours();
    
    // Check if editing existing hour
    const existingIndex = hours.findIndex(h => h.id === hour.id);
    
    if (existingIndex !== -1) {
      // Update existing hour
      hours[existingIndex] = {
        ...hours[existingIndex],
        ...hour,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new hour
      hour.id = hour.id || generateId();
      hour.createdAt = hour.createdAt || new Date().toISOString();
      hour.updatedAt = new Date().toISOString();
      hour.total = (parseFloat(hour.hoursWorked) || 0) * (parseFloat(hour.baseRate) || 0);
      hours.push(hour);
    }
    
    localStorage.setItem('worklog_hours', JSON.stringify(hours));
    return { success: true, data: hour };
  } catch (error) {
    console.error('Error saving hour:', error);
    return { success: false, error: error.message };
  }
}

function getHours() {
  try {
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    return hours.sort((a, b) => new Date(b.workDate) - new Date(a.workDate));
  } catch (error) {
    console.error('Error getting hours:', error);
    return [];
  }
}

function deleteHour(id) {
  try {
    const hours = getHours();
    const filteredHours = hours.filter(hour => hour.id !== id);
    localStorage.setItem('worklog_hours', JSON.stringify(filteredHours));
    return { success: true };
  } catch (error) {
    console.error('Error deleting hour:', error);
    return { success: false, error: error.message };
  }
}

// MARKS/ASSESSMENTS
function saveMark(mark) {
  try {
    const marks = getMarks();
    
    // Check if editing existing mark
    const existingIndex = marks.findIndex(m => m.id === mark.id);
    
    if (existingIndex !== -1) {
      // Update existing mark
      marks[existingIndex] = {
        ...marks[existingIndex],
        ...mark,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new mark
      mark.id = mark.id || generateId();
      mark.createdAt = mark.createdAt || new Date().toISOString();
      mark.updatedAt = new Date().toISOString();
      
      // Calculate percentage and grade
      const score = parseFloat(mark.marksScore) || 0;
      const max = parseFloat(mark.marksMax) || 1;
      mark.percentage = max > 0 ? ((score / max) * 100).toFixed(1) : '0.0';
      mark.grade = calculateGrade(mark.percentage);
      
      marks.push(mark);
    }
    
    localStorage.setItem('worklog_marks', JSON.stringify(marks));
    return { success: true, data: mark };
  } catch (error) {
    console.error('Error saving mark:', error);
    return { success: false, error: error.message };
  }
}

function getMarks() {
  try {
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    return marks.sort((a, b) => new Date(b.marksDate) - new Date(a.marksDate));
  } catch (error) {
    console.error('Error getting marks:', error);
    return [];
  }
}

function deleteMark(id) {
  try {
    const marks = getMarks();
    const filteredMarks = marks.filter(mark => mark.id !== id);
    localStorage.setItem('worklog_marks', JSON.stringify(filteredMarks));
    return { success: true };
  } catch (error) {
    console.error('Error deleting mark:', error);
    return { success: false, error: error.message };
  }
}

// ATTENDANCE
function saveAttendance(attendance) {
  try {
    const attendances = getAttendance();
    
    // Check if editing existing attendance
    const existingIndex = attendances.findIndex(a => a.id === attendance.id);
    
    if (existingIndex !== -1) {
      // Update existing attendance
      attendances[existingIndex] = {
        ...attendances[existingIndex],
        ...attendance,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new attendance
      attendance.id = attendance.id || generateId();
      attendance.createdAt = attendance.createdAt || new Date().toISOString();
      attendance.updatedAt = new Date().toISOString();
      attendances.push(attendance);
    }
    
    localStorage.setItem('worklog_attendance', JSON.stringify(attendances));
    return { success: true, data: attendance };
  } catch (error) {
    console.error('Error saving attendance:', error);
    return { success: false, error: error.message };
  }
}

function getAttendance() {
  try {
    const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
    return attendance.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
  } catch (error) {
    console.error('Error getting attendance:', error);
    return [];
  }
}

function deleteAttendance(id) {
  try {
    const attendances = getAttendance();
    const filteredAttendance = attendances.filter(attendance => attendance.id !== id);
    localStorage.setItem('worklog_attendance', JSON.stringify(filteredAttendance));
    return { success: true };
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return { success: false, error: error.message };
  }
}

// PAYMENTS
function savePayment(payment) {
  try {
    const payments = getPayments();
    
    // Check if editing existing payment
    const existingIndex = payments.findIndex(p => p.id === payment.id);
    
    if (existingIndex !== -1) {
      // Update existing payment
      payments[existingIndex] = {
        ...payments[existingIndex],
        ...payment,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new payment
      payment.id = payment.id || generateId();
      payment.createdAt = payment.createdAt || new Date().toISOString();
      payment.updatedAt = new Date().toISOString();
      payments.push(payment);
    }
    
    localStorage.setItem('worklog_payments', JSON.stringify(payments));
    return { success: true, data: payment };
  } catch (error) {
    console.error('Error saving payment:', error);
    return { success: false, error: error.message };
  }
}

function getPayments() {
  try {
    const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    return payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  } catch (error) {
    console.error('Error getting payments:', error);
    return [];
  }
}

function deletePayment(id) {
  try {
    const payments = getPayments();
    const filteredPayments = payments.filter(payment => payment.id !== id);
    localStorage.setItem('worklog_payments', JSON.stringify(filteredPayments));
    return { success: true };
  } catch (error) {
    console.error('Error deleting payment:', error);
    return { success: false, error: error.message };
  }
}

// ==================== STATISTICS FUNCTIONS ====================

function getStatistics() {
  const students = getStudents();
  const hours = getHours();
  const marks = getMarks();
  const payments = getPayments();
  
  // Calculate total hours and earnings
  const totalHours = hours.reduce((sum, hour) => sum + (parseFloat(hour.hoursWorked) || 0), 0);
  const totalEarnings = hours.reduce((sum, hour) => {
    const hoursWorked = parseFloat(hour.hoursWorked) || 0;
    const baseRate = parseFloat(hour.baseRate) || 0;
    return sum + (hoursWorked * baseRate);
  }, 0);
  
  // Calculate average mark
  const totalMarks = marks.length;
  const averageMark = totalMarks > 0 
    ? (marks.reduce((sum, mark) => sum + parseFloat(mark.percentage || 0), 0) / totalMarks).toFixed(1)
    : 0;
  
  // Calculate total payments
  const totalPayments = payments.reduce((sum, payment) => sum + (parseFloat(payment.paymentAmount) || 0), 0);
  
  // Calculate student balances (simplified)
  const studentBalances = students.map(student => {
    const studentHours = hours.filter(h => h.studentId === student.id);
    const studentPayments = payments.filter(p => p.studentId === student.id);
    
    const hoursTotal = studentHours.reduce((sum, hour) => {
      const hoursWorked = parseFloat(hour.hoursWorked) || 0;
      const rate = parseFloat(hour.baseRate) || parseFloat(student.rate) || 0;
      return sum + (hoursWorked * rate);
    }, 0);
    
    const paymentsTotal = studentPayments.reduce((sum, payment) => sum + (parseFloat(payment.paymentAmount) || 0), 0);
    
    return {
      studentId: student.id,
      studentName: student.name,
      owed: hoursTotal - paymentsTotal
    };
  });
  
  const totalOwed = studentBalances.reduce((sum, balance) => sum + (balance.owed > 0 ? balance.owed : 0), 0);
  
  return {
    students: students.length,
    totalHours: totalHours.toFixed(1),
    totalEarnings: totalEarnings.toFixed(2),
    averageMark: averageMark,
    totalPayments: totalPayments.toFixed(2),
    totalOwed: totalOwed.toFixed(2),
    studentBalances: studentBalances
  };
}

function getWeeklyStats() {
  const hours = getHours();
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const weeklyHours = hours.filter(hour => {
    const hourDate = new Date(hour.workDate);
    return hourDate >= oneWeekAgo && hourDate <= now;
  });
  
  const weeklyTotalHours = weeklyHours.reduce((sum, hour) => sum + (parseFloat(hour.hoursWorked) || 0), 0);
  const weeklyTotalEarnings = weeklyHours.reduce((sum, hour) => {
    const hoursWorked = parseFloat(hour.hoursWorked) || 0;
    const baseRate = parseFloat(hour.baseRate) || 0;
    return sum + (hoursWorked * baseRate);
  }, 0);
  
  return {
    hours: weeklyTotalHours.toFixed(1),
    earnings: weeklyTotalEarnings.toFixed(2),
    count: weeklyHours.length
  };
}

function getMonthlyStats() {
  const hours = getHours();
  const now = new Date();
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  
  const monthlyHours = hours.filter(hour => {
    const hourDate = new Date(hour.workDate);
    return hourDate >= oneMonthAgo && hourDate <= now;
  });
  
  const monthlyTotalHours = monthlyHours.reduce((sum, hour) => sum + (parseFloat(hour.hoursWorked) || 0), 0);
  const monthlyTotalEarnings = monthlyHours.reduce((sum, hour) => {
    const hoursWorked = parseFloat(hour.hoursWorked) || 0;
    const baseRate = parseFloat(hour.baseRate) || 0;
    return sum + (hoursWorked * baseRate);
  }, 0);
  
  return {
    hours: monthlyTotalHours.toFixed(1),
    earnings: monthlyTotalEarnings.toFixed(2),
    count: monthlyHours.length
  };
}

// ==================== DATA EXPORT/IMPORT ====================

function exportAllData() {
  try {
    const data = {
      students: getStudents(),
      hours: getHours(),
      marks: getMarks(),
      attendance: getAttendance(),
      payments: getPayments(),
      settings: {
        defaultHourlyRate: localStorage.getItem('defaultHourlyRate') || '25.00',
        autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
        theme: localStorage.getItem('worklog-theme') || 'dark'
      },
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0'
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    return { success: true, filename: exportFileDefaultName };
  } catch (error) {
    console.error('Error exporting data:', error);
    return { success: false, error: error.message };
  }
}

function importAllData(jsonData) {
  try {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    // Validate data structure
    if (!data.students || !Array.isArray(data.students)) {
      throw new Error('Invalid data format: students array missing');
    }
    
    // Backup current data
    const backup = {
      students: getStudents(),
      hours: getHours(),
      marks: getMarks(),
      attendance: getAttendance(),
      payments: getPayments()
    };
    
    // Store backup in case of rollback
    localStorage.setItem('worklog_backup', JSON.stringify(backup));
    
    // Import new data
    if (data.students) localStorage.setItem('worklog_students', JSON.stringify(data.students));
    if (data.hours) localStorage.setItem('worklog_hours', JSON.stringify(data.hours));
    if (data.marks) localStorage.setItem('worklog_marks', JSON.stringify(data.marks));
    if (data.attendance) localStorage.setItem('worklog_attendance', JSON.stringify(data.attendance));
    if (data.payments) localStorage.setItem('worklog_payments', JSON.stringify(data.payments));
    
    // Import settings
    if (data.settings) {
      if (data.settings.defaultHourlyRate) {
        localStorage.setItem('defaultHourlyRate', data.settings.defaultHourlyRate);
      }
      if (data.settings.theme) {
        localStorage.setItem('worklog-theme', data.settings.theme);
      }
    }
    
    return { success: true, count: data.students.length };
  } catch (error) {
    console.error('Error importing data:', error);
    
    // Try to restore from backup
    try {
      const backup = JSON.parse(localStorage.getItem('worklog_backup') || '{}');
      if (backup.students) localStorage.setItem('worklog_students', JSON.stringify(backup.students));
      if (backup.hours) localStorage.setItem('worklog_hours', JSON.stringify(backup.hours));
      if (backup.marks) localStorage.setItem('worklog_marks', JSON.stringify(backup.marks));
      if (backup.attendance) localStorage.setItem('worklog_attendance', JSON.stringify(backup.attendance));
      if (backup.payments) localStorage.setItem('worklog_payments', JSON.stringify(backup.payments));
    } catch (backupError) {
      console.error('Backup restoration failed:', backupError);
    }
    
    return { success: false, error: error.message };
  }
}

function clearAllData() {
  try {
    // Backup current data
    const backup = {
      students: getStudents(),
      hours: getHours(),
      marks: getMarks(),
      attendance: getAttendance(),
      payments: getPayments(),
      settings: {
        defaultHourlyRate: localStorage.getItem('defaultHourlyRate'),
        theme: localStorage.getItem('worklog-theme')
      }
    };
    
    localStorage.setItem('worklog_clear_backup', JSON.stringify(backup));
    
    // Clear data
    localStorage.removeItem('worklog_students');
    localStorage.removeItem('worklog_hours');
    localStorage.removeItem('worklog_marks');
    localStorage.removeItem('worklog_attendance');
    localStorage.removeItem('worklog_payments');
    
    return { success: true };
  } catch (error) {
    console.error('Error clearing data:', error);
    return { success: false, error: error.message };
  }
}

function restoreBackup() {
  try {
    const backup = JSON.parse(localStorage.getItem('worklog_clear_backup') || '{}');
    
    if (!backup.students) {
      throw new Error('No backup found');
    }
    
    if (backup.students) localStorage.setItem('worklog_students', JSON.stringify(backup.students));
    if (backup.hours) localStorage.setItem('worklog_hours', JSON.stringify(backup.hours));
    if (backup.marks) localStorage.setItem('worklog_marks', JSON.stringify(backup.marks));
    if (backup.attendance) localStorage.setItem('worklog_attendance', JSON.stringify(backup.attendance));
    if (backup.payments) localStorage.setItem('worklog_payments', JSON.stringify(backup.payments));
    
    if (backup.settings) {
      if (backup.settings.defaultHourlyRate) {
        localStorage.setItem('defaultHourlyRate', backup.settings.defaultHourlyRate);
      }
      if (backup.settings.theme) {
        localStorage.setItem('worklog-theme', backup.settings.theme);
      }
    }
    
    localStorage.removeItem('worklog_clear_backup');
    return { success: true };
  } catch (error) {
    console.error('Error restoring backup:', error);
    return { success: false, error: error.message };
  }
}

// ==================== FIREBASE SYNC OPERATIONS ====================

async function syncToFirebase(collectionName, data) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      console.log('No user logged in, skipping Firebase sync');
      return { success: false, error: 'No user logged in' };
    }
    
    const db = firebase.firestore();
    const userDocRef = db.collection('users').doc(user.uid);
    const collectionRef = userDocRef.collection(collectionName);
    
    // Get existing documents from Firebase
    const snapshot = await collectionRef.get();
    const existingDocs = snapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data();
      return acc;
    }, {});
    
    // Batch write for efficiency
    const batch = db.batch();
    
    // Update or add each local item
    for (const item of data) {
      const docRef = collectionRef.doc(item.id);
      const existingData = existingDocs[item.id];
      
      if (existingData) {
        // Update if local is newer
        const localUpdated = new Date(item.updatedAt || item.createdAt || 0);
        const remoteUpdated = new Date(existingData.updatedAt || existingData.createdAt || 0);
        
        if (localUpdated > remoteUpdated) {
          batch.set(docRef, item);
        }
      } else {
        // Add new item
        batch.set(docRef, item);
      }
    }
    
    // Delete items that no longer exist locally
    const localIds = data.map(item => item.id);
    for (const remoteId in existingDocs) {
      if (!localIds.includes(remoteId)) {
        batch.delete(collectionRef.doc(remoteId));
      }
    }
    
    await batch.commit();
    console.log(`✅ Successfully synced ${collectionName} to Firebase`);
    return { success: true };
  } catch (error) {
    console.error(`Error syncing ${collectionName} to Firebase:`, error);
    return { success: false, error: error.message };
  }
}

async function syncFromFirebase(collectionName) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      console.log('No user logged in, skipping Firebase sync');
      return { success: false, error: 'No user logged in' };
    }
    
    const db = firebase.firestore();
    const userDocRef = db.collection('users').doc(user.uid);
    const collectionRef = userDocRef.collection(collectionName);
    
    const snapshot = await collectionRef.get();
    const firebaseData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get local data
    const localData = getLocalData(collectionName);
    
    // Merge: prefer Firebase data if newer
    const mergedData = mergeData(localData, firebaseData);
    
    // Save merged data locally
    saveLocalData(collectionName, mergedData);
    
    console.log(`✅ Successfully synced ${collectionName} from Firebase`);
    return { success: true, data: mergedData };
  } catch (error) {
    console.error(`Error syncing ${collectionName} from Firebase:`, error);
    return { success: false, error: error.message };
  }
}

async function syncAllToFirebase() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      console.log('No user logged in, skipping Firebase sync');
      return { success: false, error: 'No user logged in' };
    }
    
    console.log('🔄 Starting full sync to Firebase...');
    
    const results = {
      students: await syncToFirebase('students', getStudents()),
      hours: await syncToFirebase('hours', getHours()),
      marks: await syncToFirebase('marks', getMarks()),
      attendance: await syncToFirebase('attendance', getAttendance()),
      payments: await syncToFirebase('payments', getPayments())
    };
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    console.log(`✅ Sync completed: ${successCount}/${totalCount} successful`);
    return { success: successCount === totalCount, results };
  } catch (error) {
    console.error('Error during full sync:', error);
    return { success: false, error: error.message };
  }
}

async function syncAllFromFirebase() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      console.log('No user logged in, skipping Firebase sync');
      return { success: false, error: 'No user logged in' };
    }
    
    console.log('🔄 Starting full sync from Firebase...');
    
    const results = {
      students: await syncFromFirebase('students'),
      hours: await syncFromFirebase('hours'),
      marks: await syncFromFirebase('marks'),
      attendance: await syncFromFirebase('attendance'),
      payments: await syncFromFirebase('payments')
    };
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    console.log(`✅ Sync completed: ${successCount}/${totalCount} successful`);
    return { success: successCount === totalCount, results };
  } catch (error) {
    console.error('Error during full sync:', error);
    return { success: false, error: error.message };
  }
}

// ==================== HELPER FUNCTIONS ====================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function calculateGrade(percentage) {
  const perc = parseFloat(percentage);
  if (perc >= 90) return 'A';
  if (perc >= 80) return 'B';
  if (perc >= 70) return 'C';
  if (perc >= 60) return 'D';
  return 'F';
}

function getLocalData(collectionName) {
  switch(collectionName) {
    case 'students': return getStudents();
    case 'hours': return getHours();
    case 'marks': return getMarks();
    case 'attendance': return getAttendance();
    case 'payments': return getPayments();
    default: return [];
  }
}

function saveLocalData(collectionName, data) {
  switch(collectionName) {
    case 'students': 
      localStorage.setItem('worklog_students', JSON.stringify(data));
      break;
    case 'hours': 
      localStorage.setItem('worklog_hours', JSON.stringify(data));
      break;
    case 'marks': 
      localStorage.setItem('worklog_marks', JSON.stringify(data));
      break;
    case 'attendance': 
      localStorage.setItem('worklog_attendance', JSON.stringify(data));
      break;
    case 'payments': 
      localStorage.setItem('worklog_payments', JSON.stringify(data));
      break;
  }
}

function mergeData(localData, firebaseData) {
  const merged = [...localData];
  
  for (const fbItem of firebaseData) {
    const localIndex = merged.findIndex(item => item.id === fbItem.id);
    
    if (localIndex !== -1) {
      // Item exists in both local and Firebase
      const localItem = merged[localIndex];
      const localDate = new Date(localItem.updatedAt || localItem.createdAt || 0);
      const fbDate = new Date(fbItem.updatedAt || fbItem.createdAt || 0);
      
      // Keep the newer version
      if (fbDate > localDate) {
        merged[localIndex] = fbItem;
      }
    } else {
      // Item only exists in Firebase
      merged.push(fbItem);
    }
  }
  
  return merged;
}

// ==================== INITIALIZATION ====================

function initializeData() {
  console.log('📊 Initializing data storage...');
  
  // Initialize empty arrays if they don't exist
  if (!localStorage.getItem('worklog_students')) {
    localStorage.setItem('worklog_students', JSON.stringify([]));
  }
  if (!localStorage.getItem('worklog_hours')) {
    localStorage.setItem('worklog_hours', JSON.stringify([]));
  }
  if (!localStorage.getItem('worklog_marks')) {
    localStorage.setItem('worklog_marks', JSON.stringify([]));
  }
  if (!localStorage.getItem('worklog_attendance')) {
    localStorage.setItem('worklog_attendance', JSON.stringify([]));
  }
  if (!localStorage.getItem('worklog_payments')) {
    localStorage.setItem('worklog_payments', JSON.stringify([]));
  }
  if (!localStorage.getItem('defaultHourlyRate')) {
    localStorage.setItem('defaultHourlyRate', '25.00');
  }
  if (!localStorage.getItem('worklog-theme')) {
    localStorage.setItem('worklog-theme', 'dark');
  }
  
  console.log('✅ Data storage initialized');
}

// ==================== EXPORT FUNCTIONS ====================

// Export functions for use in other files
window.dataManager = {
  // Local storage operations
  saveStudent,
  getStudents,
  getStudentById,
  deleteStudent,
  
  saveHour,
  getHours,
  deleteHour,
  
  saveMark,
  getMarks,
  deleteMark,
  
  saveAttendance,
  getAttendance,
  deleteAttendance,
  
  savePayment,
  getPayments,
  deletePayment,
  
  // Statistics
  getStatistics,
  getWeeklyStats,
  getMonthlyStats,
  
  // Export/Import
  exportAllData,
  importAllData,
  clearAllData,
  restoreBackup,
  
  // Firebase sync
  syncToFirebase,
  syncFromFirebase,
  syncAllToFirebase,
  syncAllFromFirebase,
  
  // Initialization
  initializeData,
  
  // Helpers
  generateId,
  calculateGrade
};

// Initialize data storage on load
initializeData();

console.log('✅ data-manager.js loaded successfully');
