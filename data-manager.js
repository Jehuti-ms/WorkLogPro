// data-manager.js
import { firebaseManager } from './firebase-manager.js';

export class DataManager {
  constructor() {
    this.currentEdit = {
      type: null,
      id: null
    };
    this.cache = {
      students: [],
      hours: [],
      marks: [],
      attendance: [],
      payments: []
    };
  }

  async init() {
    console.log('📊 DataManager initializing...');
    
    // Load all data from cache/Firebase
    await this.loadAllData();
    
    console.log('✅ DataManager ready');
  }

  async loadAllData() {
    try {
      this.cache.students = await firebaseManager.getCollection('students');
      this.cache.hours = await firebaseManager.getCollection('hours');
      this.cache.marks = await firebaseManager.getCollection('marks');
      this.cache.attendance = await firebaseManager.getCollection('attendance');
      this.cache.payments = await firebaseManager.getCollection('payments');
      
      console.log('📦 Loaded data:', {
        students: this.cache.students.length,
        hours: this.cache.hours.length,
        marks: this.cache.marks.length,
        attendance: this.cache.attendance.length,
        payments: this.cache.payments.length
      });
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // Student operations
  async saveStudent(data, studentId = null) {
    const cleanData = {
      name: data.name,
      studentId: data.studentId,
      gender: data.gender,
      email: data.email || '',
      phone: data.phone || '',
      rate: parseFloat(data.rate) || 0,
      createdAt: studentId ? data.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const id = await firebaseManager.saveItem('students', cleanData, studentId);
    
    // Update cache
    await this.loadAllData();
    
    return id;
  }

  async deleteStudent(studentId) {
    const success = await firebaseManager.deleteItem('students', studentId);
    if (success) {
      this.cache.students = this.cache.students.filter(s => s._id !== studentId);
    }
    return success;
  }

  // Hours operations
  async saveHours(data, hoursId = null) {
    const hours = parseFloat(data.hours) || 0;
    const rate = parseFloat(data.rate) || 0;
    
    const cleanData = {
      organization: data.organization,
      subject: data.subject || '',
      student: data.student || '',
      workType: data.workType || 'hourly',
      date: data.date,
      dateIso: new Date(data.date).toISOString(),
      hours: hours,
      rate: rate,
      total: hours * rate,
      notes: data.notes || '',
      createdAt: hoursId ? data.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const id = await firebaseManager.saveItem('hours', cleanData, hoursId);
    
    // Update cache
    await this.loadAllData();
    
    return id;
  }

  async deleteHours(hoursId) {
    const success = await firebaseManager.deleteItem('hours', hoursId);
    if (success) {
      this.cache.hours = this.cache.hours.filter(h => h._id !== hoursId);
    }
    return success;
  }

  // Marks operations
  async saveMarks(data, marksId = null) {
    const score = parseFloat(data.score) || 0;
    const max = parseFloat(data.max) || 1;
    const percentage = max > 0 ? (score / max) * 100 : 0;
    
    const cleanData = {
      student: data.student,
      subject: data.subject,
      topic: data.topic || '',
      date: data.date,
      dateIso: new Date(data.date).toISOString(),
      score: score,
      max: max,
      percentage: percentage,
      grade: this.calculateGrade(percentage),
      notes: data.notes || '',
      createdAt: marksId ? data.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const id = await firebaseManager.saveItem('marks', cleanData, marksId);
    
    // Update cache
    await this.loadAllData();
    
    return id;
  }

  calculateGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  async deleteMarks(marksId) {
    const success = await firebaseManager.deleteItem('marks', marksId);
    if (success) {
      this.cache.marks = this.cache.marks.filter(m => m._id !== marksId);
    }
    return success;
  }

  // Attendance operations
  async saveAttendance(data, attendanceId = null) {
    const cleanData = {
      date: data.date,
      dateIso: new Date(data.date).toISOString(),
      subject: data.subject,
      topic: data.topic || '',
      present: Array.isArray(data.present) ? data.present : [],
      notes: data.notes || '',
      createdAt: attendanceId ? data.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const id = await firebaseManager.saveItem('attendance', cleanData, attendanceId);
    
    // Update cache
    await this.loadAllData();
    
    return id;
  }

  async deleteAttendance(attendanceId) {
    const success = await firebaseManager.deleteItem('attendance', attendanceId);
    if (success) {
      this.cache.attendance = this.cache.attendance.filter(a => a._id !== attendanceId);
    }
    return success;
  }

  // Payment operations
  async savePayment(data, paymentId = null) {
    const cleanData = {
      student: data.student,
      amount: parseFloat(data.amount) || 0,
      date: data.date,
      dateIso: new Date(data.date).toISOString(),
      method: data.method || 'Cash',
      notes: data.notes || '',
      createdAt: paymentId ? data.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const id = await firebaseManager.saveItem('payments', cleanData, paymentId);
    
    // Update cache
    await this.loadAllData();
    
    return id;
  }

  async deletePayment(paymentId) {
    const success = await firebaseManager.deleteItem('payments', paymentId);
    if (success) {
      this.cache.payments = this.cache.payments.filter(p => p._id !== paymentId);
    }
    return success;
  }

  // Statistics
  calculateStudentStats() {
    const students = this.cache.students;
    const count = students.length;
    
    let avgRate = 0;
    if (count > 0) {
      const totalRate = students.reduce((sum, student) => sum + (student.rate || 0), 0);
      avgRate = totalRate / count;
    }
    
    return {
      count,
      avgRate: avgRate.toFixed(2)
    };
  }

  calculateHoursStats() {
    const hours = this.cache.hours;
    const now = new Date();
    
    // Weekly stats
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    // Monthly stats
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const weeklyHours = hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= weekStart && entryDate <= now;
    });
    
    const monthlyHours = hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= monthStart && entryDate <= now;
    });
    
    const totalWeekly = weeklyHours.reduce((sum, entry) => sum + (entry.total || 0), 0);
    const totalMonthly = monthlyHours.reduce((sum, entry) => sum + (entry.total || 0), 0);
    
    const hoursWeekly = weeklyHours.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const hoursMonthly = monthlyHours.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    
    return {
      weekly: {
        hours: hoursWeekly.toFixed(1),
        total: totalWeekly.toFixed(2)
      },
      monthly: {
        hours: hoursMonthly.toFixed(1),
        total: totalMonthly.toFixed(2)
      }
    };
  }

  calculateMarksStats() {
    const marks = this.cache.marks;
    const count = marks.length;
    
    let avgPercentage = 0;
    if (count > 0) {
      const total = marks.reduce((sum, mark) => sum + (mark.percentage || 0), 0);
      avgPercentage = total / count;
    }
    
    return {
      count,
      avgPercentage: avgPercentage.toFixed(1)
    };
  }

  calculatePaymentStats() {
    const payments = this.cache.payments;
    const now = new Date();
    
    // Current month payments
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date || payment.dateIso);
      return paymentDate >= monthStart && paymentDate <= now;
    });
    
    const totalMonthly = monthlyPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const totalAllTime = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    
    return {
      monthly: totalMonthly.toFixed(2),
      total: totalAllTime.toFixed(2)
    };
  }

  // Get student for dropdowns
  getStudentsForDropdown() {
    return this.cache.students.map(student => ({
      id: student._id,
      name: student.name,
      display: `${student.name} (${student.studentId || 'No ID'})`
    }));
  }

  // Start edit mode
  startEdit(type, id) {
    this.currentEdit.type = type;
    this.currentEdit.id = id;
    
    const item = this.cache[type]?.find(item => item._id === id);
    return item;
  }

  // Cancel edit
  cancelEdit() {
    this.currentEdit.type = null;
    this.currentEdit.id = null;
  }

  // Get sync status
  getSyncStatus() {
    return firebaseManager.getSyncStatus();
  }

  // Manual sync
  async manualSync() {
    return await firebaseManager.manualSync();
  }

  // Export data
  async exportData() {
    return await firebaseManager.exportData();
  }

  // Import data
  async importData(file) {
    return await firebaseManager.importData(file);
  }

  // Clear all data
  async clearAllData() {
    if (confirm('Are you sure? This will delete ALL local data and sync deletions to cloud!')) {
      try {
        // Delete from Firebase first if online
        const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
        
        for (const collection of collections) {
          const key = `worklog_${collection}`;
          const data = JSON.parse(localStorage.getItem(key) || '[]');
          
          // Mark all items for deletion
          for (const item of data) {
            await firebaseManager.deleteItem(collection, item._id);
          }
        }
        
        // Clear cache
        Object.keys(this.cache).forEach(key => {
          this.cache[key] = [];
        });
        
        return true;
      } catch (error) {
        console.error('Error clearing data:', error);
        return false;
      }
    }
    return false;
  }
}

// Export singleton
export const dataManager = new DataManager();
