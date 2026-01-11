// data-manager.js - Data management and storage for WorkLog Pro
// Handles local storage, Firebase sync, and data operations

console.log('📦 Loading data-manager.js...');

// ==================== LOCAL STORAGE OPERATIONS ====================

// STUDENTS
function saveStudent(student) {
  try {
    console.log('💾 Saving student:', student.name);
    const students = getStudents();
    
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
      student.id = student.id || generateId();
      student.createdAt = new Date().toISOString();
      student.updatedAt = new Date().toISOString();
      students.push(student);
    }
    
    localStorage.setItem('worklog_students', JSON.stringify(students));
    console.log('✅ Student saved successfully');
    return { success: true, data: student };
  } catch (error) {
    console.error('❌ Error saving student:', error);
    return { success: false, error: error.message };
  }
}

function getStudents() {
  try {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    return students.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  } catch (error) {
    console.error('❌ Error getting students:', error);
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
    console.log('✅ Student deleted:', id);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting student:', error);
    return { success: false, error: error.message };
  }
}

// HOURS/WORK LOGS
function saveHour(hour) {
  try {
    console.log('💾 Saving work hour');
    const hours = getHours();
    
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
      hour.createdAt = new Date().toISOString();
      hour.updatedAt = new Date().toISOString();
      hour.total = (parseFloat(hour.hoursWorked) || 0) * (parseFloat(hour.baseRate) || 0);
      hours.push(hour);
    }
    
    localStorage.setItem('worklog_hours', JSON.stringify(hours));
    console.log('✅ Hour saved successfully');
    return { success: true, data: hour };
  } catch (error) {
    console.error('❌ Error saving hour:', error);
    return { success: false, error: error.message };
  }
}

function getHours() {
  try {
    const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
    return hours.sort((a, b) => new Date(b.workDate) - new Date(a.workDate));
  } catch (error) {
    console.error('❌ Error getting hours:', error);
    return [];
  }
}

function deleteHour(id) {
  try {
    const hours = getHours();
    const filteredHours = hours.filter(hour => hour.id !== id);
    localStorage.setItem('worklog_hours', JSON.stringify(filteredHours));
    console.log('✅ Hour deleted:', id);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting hour:', error);
    return { success: false, error: error.message };
  }
}

// MARKS/ASSESSMENTS
function saveMark(mark) {
  try {
    console.log('💾 Saving mark');
    const marks = getMarks();
    
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
      mark.createdAt = new Date().toISOString();
      mark.updatedAt = new Date().toISOString();
      
      // Calculate percentage and grade
      const score = parseFloat(mark.marksScore) || 0;
      const max = parseFloat(mark.marksMax) || 1;
      mark.percentage = max > 0 ? ((score / max) * 100).toFixed(1) : '0.0';
      mark.grade = calculateGrade(mark.percentage);
      
      marks.push(mark);
    }
    
    localStorage.setItem('worklog_marks', JSON.stringify(marks));
    console.log('✅ Mark saved successfully');
    return { success: true, data: mark };
  } catch (error) {
    console.error('❌ Error saving mark:', error);
    return { success: false, error: error.message };
  }
}

function getMarks() {
  try {
    const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
    return marks.sort((a, b) => new Date(b.marksDate) - new Date(a.marksDate));
  } catch (error) {
    console.error('❌ Error getting marks:', error);
    return [];
  }
}

function deleteMark(id) {
  try {
    const marks = getMarks();
    const filteredMarks = marks.filter(mark => mark.id !== id);
    localStorage.setItem('worklog_marks', JSON.stringify(filteredMarks));
    console.log('✅ Mark deleted:', id);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting mark:', error);
    return { success: false, error: error.message };
  }
}

// ATTENDANCE
function saveAttendance(attendance) {
  try {
    console.log('💾 Saving attendance');
    const attendances = getAttendance();
    
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
      attendance.createdAt = new Date().toISOString();
      attendance.updatedAt = new Date().toISOString();
      attendances.push(attendance);
    }
    
    localStorage.setItem('worklog_attendance', JSON.stringify(attendances));
    console.log('✅ Attendance saved successfully');
    return { success: true, data: attendance };
  } catch (error) {
    console.error('❌ Error saving attendance:', error);
    return { success: false, error: error.message };
  }
}

function getAttendance() {
  try {
    const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
    return attendance.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
  } catch (error) {
    console.error('❌ Error getting attendance:', error);
    return [];
  }
}

function deleteAttendance(id) {
  try {
    const attendances = getAttendance();
    const filteredAttendance = attendances.filter(attendance => attendance.id !== id);
    localStorage.setItem('worklog_attendance', JSON.stringify(filteredAttendance));
    console.log('✅ Attendance deleted:', id);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting attendance:', error);
    return { success: false, error: error.message };
  }
}

// PAYMENTS
function savePayment(payment) {
  try {
    console.log('💾 Saving payment');
    const payments = getPayments();
    
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
      payment.createdAt = new Date().toISOString();
      payment.updatedAt = new Date().toISOString();
      payments.push(payment);
    }
    
    localStorage.setItem('worklog_payments', JSON.stringify(payments));
    console.log('✅ Payment saved successfully');
    return { success: true, data: payment };
  } catch (error) {
    console.error('❌ Error saving payment:', error);
    return { success: false, error: error.message };
  }
}

function getPayments() {
  try {
    const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
    return payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  } catch (error) {
    console.error('❌ Error getting payments:', error);
    return [];
  }
}

function deletePayment(id) {
  try {
    const payments = getPayments();
    const filteredPayments = payments.filter(payment => payment.id !== id);
    localStorage.setItem('worklog_payments', JSON.stringify(filteredPayments));
    console.log('✅ Payment deleted:', id);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting payment:', error);
    return { success: false, error: error.message };
  }
}

// ==================== STATISTICS FUNCTIONS ====================

function getStatistics() {
  try {
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
    
    // Calculate student balances
    const studentBalances = students.map(student => {
      const studentHours = hours.filter(h => h.hoursStudent === student.id);
      const studentPayments = payments.filter(p => p.paymentStudent === student.id);
      
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
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    return {
      students: 0,
      totalHours: '0.0',
      totalEarnings: '0.00',
      averageMark: 0,
      totalPayments: '0.00',
      totalOwed: '0.00',
      studentBalances: []
    };
  }
}

function getWeeklyStats() {
  try {
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
  } catch (error) {
    console.error('❌ Error getting weekly stats:', error);
    return { hours: '0.0', earnings: '0.00', count: 0 };
  }
}

function getMonthlyStats() {
  try {
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
  } catch (error) {
    console.error('❌ Error getting monthly stats:', error);
    return { hours: '0.0', earnings: '0.00', count: 0 };
  }
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
    
    console.log('✅ Data exported successfully');
    return { success: true, filename: exportFileDefaultName };
  } catch (error) {
    console.error('❌ Error exporting data:', error);
    return { success: false, error: error.message };
  }
}

function importAllData(jsonData) {
  try {
    console.log('📥 Importing data...');
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    // Validate data structure
    if (!data.students || !Array.isArray(data.students)) {
      throw new Error('Invalid data format: students array missing');
    }
    
    // Import new data
    if (data.students) {
      localStorage.setItem('worklog_students', JSON.stringify(data.students));
    }
    if (data.hours) {
      localStorage.setItem('worklog_hours', JSON.stringify(data.hours));
    }
    if (data.marks) {
      localStorage.setItem('worklog_marks', JSON.stringify(data.marks));
    }
    if (data.attendance) {
      localStorage.setItem('worklog_attendance', JSON.stringify(data.attendance));
    }
    if (data.payments) {
      localStorage.setItem('worklog_payments', JSON.stringify(data.payments));
    }
    
    // Import settings
    if (data.settings) {
      if (data.settings.defaultHourlyRate) {
        localStorage.setItem('defaultHourlyRate', data.settings.defaultHourlyRate);
      }
      if (data.settings.theme) {
        localStorage.setItem('worklog-theme', data.settings.theme);
      }
    }
    
    console.log('✅ Data imported successfully');
    return { success: true, count: data.students.length };
  } catch (error) {
    console.error('❌ Error importing data:', error);
    return { success: false, error: error.message };
  }
}

function clearAllData() {
  try {
    if (!confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
      return { success: false, cancelled: true };
    }
    
    // Clear data
    localStorage.removeItem('worklog_students');
    localStorage.removeItem('worklog_hours');
    localStorage.removeItem('worklog_marks');
    localStorage.removeItem('worklog_attendance');
    localStorage.removeItem('worklog_payments');
    
    console.log('✅ All data cleared');
    return { success: true };
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    return { success: false, error: error.message };
  }
}

// ==================== HELPER FUNCTIONS ====================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function calculateGrade(percentage) {
  const perc = parseFloat(percentage);
  if (perc >= 90) return 'A';
  if (perc >= 80) return 'B';
  if (perc >= 70) return 'C';
  if (perc >= 60) return 'D';
  return 'F';
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
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

// ==================== PAGE LOAD ====================

// Initialize data storage when script loads
initializeData();

console.log('✅ data-manager.js loaded successfully');

// Export functions globally (simpler approach)
// These functions will be available globally since they're defined in global scope
