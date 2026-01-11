// form-handler.js - Complete form handling for WorkLog Pro
console.log('📝 Loading form-handler.js');

class FormHandler {
  constructor() {
    console.log('✅ FormHandler initialized');
    this.initializeStorage();
  }

  initializeStorage() {
    // Initialize all localStorage keys if they don't exist
    const storageKeys = [
      'worklog_students',
      'worklog_hours', 
      'worklog_marks',
      'worklog_attendance',
      'worklog_payments'
    ];
    
    storageKeys.forEach(key => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify([]));
      }
    });
    
    // Initialize settings
    if (!localStorage.getItem('defaultHourlyRate')) {
      localStorage.setItem('defaultHourlyRate', '25.00');
    }
    if (!localStorage.getItem('worklog-theme')) {
      localStorage.setItem('worklog-theme', 'dark');
    }
  }

  // ==================== STUDENT METHODS ====================
  saveStudent(formData) {
    try {
      console.log('💾 Saving student:', formData.name);
      
      const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
      
      // Add or update student
      const existingIndex = students.findIndex(s => s.id === formData.id);
      
      if (existingIndex !== -1) {
        // Update existing
        students[existingIndex] = {
          ...students[existingIndex],
          ...formData,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Add new
        const newStudent = {
          ...formData,
          id: formData.id || 'student_' + Date.now(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        students.push(newStudent);
      }
      
      localStorage.setItem('worklog_students', JSON.stringify(students));
      console.log('✅ Student saved');
      
      return { success: true, data: formData };
    } catch (error) {
      console.error('❌ Error saving student:', error);
      return { success: false, error: error.message };
    }
  }

  getStudents() {
    try {
      const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
      return students.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error('❌ Error getting students:', error);
      return [];
    }
  }

  deleteStudent(id) {
    try {
      const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
      const filtered = students.filter(student => student.id !== id);
      localStorage.setItem('worklog_students', JSON.stringify(filtered));
      console.log('✅ Student deleted:', id);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting student:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== HOURS METHODS ====================
  saveHours(formData) {
    try {
      console.log('💾 Saving hours');
      
      const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
      
      const newHour = {
        ...formData,
        id: formData.id || 'hour_' + Date.now(),
        total: (parseFloat(formData.hoursWorked) || 0) * (parseFloat(formData.baseRate) || 0),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      hours.push(newHour);
      localStorage.setItem('worklog_hours', JSON.stringify(hours));
      console.log('✅ Hours saved');
      
      return { success: true, data: newHour };
    } catch (error) {
      console.error('❌ Error saving hours:', error);
      return { success: false, error: error.message };
    }
  }

  getHours() {
    try {
      const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
      return hours.sort((a, b) => new Date(b.workDate) - new Date(a.workDate));
    } catch (error) {
      console.error('❌ Error getting hours:', error);
      return [];
    }
  }

  // ==================== MARKS METHODS ====================
  saveMark(formData) {
    try {
      console.log('💾 Saving mark');
      
      const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
      
      const score = parseFloat(formData.marksScore) || 0;
      const max = parseFloat(formData.marksMax) || 1;
      const percentage = max > 0 ? ((score / max) * 100).toFixed(1) : '0.0';
      
      // Calculate grade
      let grade = 'F';
      const percNum = parseFloat(percentage);
      if (percNum >= 90) grade = 'A';
      else if (percNum >= 80) grade = 'B';
      else if (percNum >= 70) grade = 'C';
      else if (percNum >= 60) grade = 'D';
      
      const newMark = {
        ...formData,
        id: formData.id || 'mark_' + Date.now(),
        percentage: percentage,
        grade: grade,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      marks.push(newMark);
      localStorage.setItem('worklog_marks', JSON.stringify(marks));
      console.log('✅ Mark saved');
      
      return { success: true, data: newMark };
    } catch (error) {
      console.error('❌ Error saving mark:', error);
      return { success: false, error: error.message };
    }
  }

  getMarks() {
    try {
      const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
      return marks.sort((a, b) => new Date(b.marksDate) - new Date(a.marksDate));
    } catch (error) {
      console.error('❌ Error getting marks:', error);
      return [];
    }
  }

  // ==================== ATTENDANCE METHODS ====================
  saveAttendance(formData) {
    try {
      console.log('💾 Saving attendance');
      
      const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
      
      const newAttendance = {
        ...formData,
        id: formData.id || 'attendance_' + Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      attendance.push(newAttendance);
      localStorage.setItem('worklog_attendance', JSON.stringify(attendance));
      console.log('✅ Attendance saved');
      
      return { success: true, data: newAttendance };
    } catch (error) {
      console.error('❌ Error saving attendance:', error);
      return { success: false, error: error.message };
    }
  }

  getAttendance() {
    try {
      const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
      return attendance.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
    } catch (error) {
      console.error('❌ Error getting attendance:', error);
      return [];
    }
  }

  // ==================== PAYMENT METHODS ====================
  savePayment(formData) {
    try {
      console.log('💾 Saving payment');
      
      const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
      
      const newPayment = {
        ...formData,
        id: formData.id || 'payment_' + Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      payments.push(newPayment);
      localStorage.setItem('worklog_payments', JSON.stringify(payments));
      console.log('✅ Payment saved');
      
      return { success: true, data: newPayment };
    } catch (error) {
      console.error('❌ Error saving payment:', error);
      return { success: false, error: error.message };
    }
  }

  getPayments() {
    try {
      const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
      return payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
    } catch (error) {
      console.error('❌ Error getting payments:', error);
      return [];
    }
  }

  // ==================== HELPER METHODS ====================
  getStatistics() {
    try {
      const students = this.getStudents();
      const hours = this.getHours();
      const marks = this.getMarks();
      const payments = this.getPayments();
      
      // Calculate totals
      const totalStudents = students.length;
      
      const totalHours = hours.reduce((sum, hour) => {
        return sum + (parseFloat(hour.hoursWorked) || 0);
      }, 0);
      
      const totalEarnings = hours.reduce((sum, hour) => {
        const hoursWorked = parseFloat(hour.hoursWorked) || 0;
        const rate = parseFloat(hour.baseRate) || 0;
        return sum + (hoursWorked * rate);
      }, 0);
      
      // Calculate average mark
      let avgMark = 0;
      if (marks.length > 0) {
        const totalPercentage = marks.reduce((sum, mark) => {
          return sum + parseFloat(mark.percentage || 0);
        }, 0);
        avgMark = (totalPercentage / marks.length).toFixed(1);
      }
      
      // Calculate total payments
      const totalPayments = payments.reduce((sum, payment) => {
        return sum + (parseFloat(payment.paymentAmount) || 0);
      }, 0);
      
      // Calculate outstanding balance
      const outstandingBalance = totalEarnings - totalPayments;
      
      return {
        students: totalStudents,
        totalHours: totalHours.toFixed(1),
        totalEarnings: totalEarnings.toFixed(2),
        averageMark: avgMark,
        totalPayments: totalPayments.toFixed(2),
        outstandingBalance: outstandingBalance.toFixed(2)
      };
    } catch (error) {
      console.error('❌ Error getting statistics:', error);
      return {
        students: 0,
        totalHours: '0.0',
        totalEarnings: '0.00',
        averageMark: 0,
        totalPayments: '0.00',
        outstandingBalance: '0.00'
      };
    }
  }

  // Clear all data
  clearAllData() {
    try {
      const storageKeys = [
        'worklog_students',
        'worklog_hours', 
        'worklog_marks',
        'worklog_attendance',
        'worklog_payments'
      ];
      
      storageKeys.forEach(key => {
        localStorage.setItem(key, JSON.stringify([]));
      });
      
      console.log('✅ All data cleared');
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      return { success: false, error: error.message };
    }
  }

  // Export all data
  exportAllData() {
    try {
      const data = {
        students: this.getStudents(),
        hours: this.getHours(),
        marks: this.getMarks(),
        attendance: this.getAttendance(),
        payments: this.getPayments(),
        settings: {
          defaultHourlyRate: localStorage.getItem('defaultHourlyRate') || '25.00',
          autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
          theme: localStorage.getItem('worklog-theme') || 'dark'
        },
        exportDate: new Date().toISOString(),
        appVersion: '1.0.0'
      };
      
      return { success: true, data: data };
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      return { success: false, error: error.message };
    }
  }

  // Import data
  importAllData(data) {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
      }
      
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
        if (data.settings.autoSyncEnabled !== undefined) {
          localStorage.setItem('autoSyncEnabled', data.settings.autoSyncEnabled);
        }
        if (data.settings.theme) {
          localStorage.setItem('worklog-theme', data.settings.theme);
        }
      }
      
      console.log('✅ Data imported successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Error importing data:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create global instance
window.formHandler = new FormHandler();
console.log('✅ form-handler.js loaded with ALL methods');
