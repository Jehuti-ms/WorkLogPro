// data-manager.js - NEW FILE
import { firebaseManager } from './firebase-manager.js';

export class DataManager {
  constructor() {
    this.cache = {
      students: [],
      hours: [],
      marks: [],
      attendance: [],
      payments: [],
      lastUpdated: null
    };
  }

  async init() {
    console.log('📊 DataManager initializing...');
    await this.loadAllData();
    console.log('✅ DataManager ready');
  }

  async loadAllData() {
    const promises = [
      this.loadStudents(),
      this.loadHours(),
      this.loadMarks(),
      this.loadAttendance(),
      this.loadPayments()
    ];
    
    await Promise.all(promises);
    this.cache.lastUpdated = new Date().toISOString();
  }

  async loadStudents() {
    this.cache.students = await firebaseManager.getData('students');
    return this.cache.students;
  }

  async loadHours() {
    this.cache.hours = await firebaseManager.getData('hours');
    return this.cache.hours;
  }

  async loadMarks() {
    this.cache.marks = await firebaseManager.getData('marks');
    return this.cache.marks;
  }

  async loadAttendance() {
    this.cache.attendance = await firebaseManager.getData('attendance');
    return this.cache.attendance;
  }

  async loadPayments() {
    this.cache.payments = await firebaseManager.getData('payments');
    return this.cache.payments;
  }

  async saveStudent(studentData, studentId = null) {
    const id = await firebaseManager.saveData('students', studentData, !!studentId, studentId);
    
    // Update cache
    if (studentId) {
      const index = this.cache.students.findIndex(s => s._id === studentId);
      if (index >= 0) {
        this.cache.students[index] = { ...this.cache.students[index], ...studentData, _id: id };
      }
    } else {
      this.cache.students.push({ ...studentData, _id: id });
    }
    
    return id;
  }

  async deleteStudent(studentId) {
    const success = await firebaseManager.deleteData('students', studentId);
    if (success) {
      this.cache.students = this.cache.students.filter(s => s._id !== studentId);
    }
    return success;
  }

  async saveHours(hoursData, hoursId = null) {
    const id = await firebaseManager.saveData('hours', hoursData, !!hoursId, hoursId);
    
    if (hoursId) {
      const index = this.cache.hours.findIndex(h => h._id === hoursId);
      if (index >= 0) {
        this.cache.hours[index] = { ...this.cache.hours[index], ...hoursData, _id: id };
      }
    } else {
      this.cache.hours.push({ ...hoursData, _id: id });
    }
    
    return id;
  }

  async deleteHours(hoursId) {
    const success = await firebaseManager.deleteData('hours', hoursId);
    if (success) {
      this.cache.hours = this.cache.hours.filter(h => h._id !== hoursId);
    }
    return success;
  }

  // Similar methods for marks, attendance, payments...

  getStudentById(id) {
    return this.cache.students.find(s => s._id === id || s.id === id);
  }

  getStudentByName(name) {
    return this.cache.students.find(s => s.name === name);
  }

  getHoursByDateRange(startDate, endDate) {
    return this.cache.hours.filter(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      return entryDate >= startDate && entryDate <= endDate;
    });
  }

  getSyncStatus() {
    return firebaseManager.getSyncStatus();
  }

  async forceSync() {
    await firebaseManager.syncLocalToCloud();
    await this.loadAllData();
    return this.getSyncStatus();
  }

  async exportData() {
    const data = {
      students: this.cache.students,
      hours: this.cache.hours,
      marks: this.cache.marks,
      attendance: this.cache.attendance,
      payments: this.cache.payments,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          // Validate data structure
          if (!data.students || !data.hours || !data.marks) {
            throw new Error('Invalid backup file format');
          }
          
          // Clear existing data
          const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
          collections.forEach(col => localStorage.removeItem(`worklog_${col}`));
          
          // Import each collection
          for (const collection of collections) {
            if (data[collection]) {
              for (const item of data[collection]) {
                await firebaseManager.saveData(collection, item);
              }
            }
          }
          
          // Reload all data
          await this.loadAllData();
          
          resolve('Data imported successfully');
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

// Export singleton
export const dataManager = new DataManager();
