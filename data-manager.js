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

// ==================== REPORTING =========================
  // data-manager.js - Add these Firebase report methods
    
async generateWeeklyReport() {
        return await this.generateDateRangeReport('weekly');
    }

    async generateBiWeeklyReport() {
        return await this.generateDateRangeReport('biweekly');
    }

    async generateMonthlyReport() {
        return await this.generateDateRangeReport('monthly');
    }

    async generateDateRangeReport(type) {
        try {
            const allLogs = await this.getAllLogs();
            const students = await this.getAllStudents();
            
            const now = new Date();
            let startDate = new Date(now);
            
            switch(type) {
                case 'weekly':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case 'biweekly':
                    startDate.setDate(now.getDate() - 14);
                    break;
                case 'monthly':
                    startDate.setMonth(now.getMonth() - 1);
                    break;
            }
            
            const filteredLogs = allLogs.filter(log => {
                const logDate = new Date(log.date);
                return logDate >= startDate && logDate <= now;
            });
            
            return this.formatReport(filteredLogs, students, `${type.toUpperCase()} REPORT`, startDate, now);
        } catch (error) {
            console.error('Error generating report:', error);
            return `Error generating report: ${error.message}`;
        }
    }

    async generateSubjectReport(subject) {
        try {
            const allLogs = await this.getAllLogs();
            const students = await this.getAllStudents();
            
            const subjectLogs = allLogs.filter(log => 
                log.activity.toLowerCase().includes(subject.toLowerCase()) || 
                (log.notes && log.notes.toLowerCase().includes(subject.toLowerCase()))
            );
            
            return this.formatReport(subjectLogs, students, `SUBJECT REPORT: ${subject}`);
        } catch (error) {
            console.error('Error generating subject report:', error);
            return `Error generating report: ${error.message}`;
        }
    }

    async generateClaimForm(type, periodEndDate = null) {
        try {
            const allLogs = await this.getAllLogs();
            const students = await this.getAllStudents();
            
            // Create a map of student rates for quick lookup
            const studentRateMap = {};
            students.forEach(student => {
                studentRateMap[student.name] = student.hourlyRate || 0;
            });
            
            const now = new Date();
            let startDate = new Date(now);
            let endDate = now;
            
            if (periodEndDate) {
                endDate = new Date(periodEndDate);
            }
            
            // Set start date based on type
            switch(type) {
                case 'weekly':
                    startDate = new Date(endDate);
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case 'biweekly':
                    startDate = new Date(endDate);
                    startDate.setDate(endDate.getDate() - 14);
                    break;
                case 'monthly':
                    startDate = new Date(endDate);
                    startDate.setMonth(endDate.getMonth() - 1);
                    break;
            }
            
            const filteredLogs = allLogs.filter(log => {
                const logDate = new Date(log.date);
                return logDate >= startDate && logDate <= endDate;
            });
            
            // Format for claim submission
            let claim = 'CLAIM FORM FOR PAYMENT\n';
            claim += '='.repeat(30) + '\n\n';
            claim += `Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n`;
            claim += `Type: ${type.toUpperCase()} CLAIM\n`;
            claim += `Generated: ${new Date().toLocaleDateString()}\n`;
            claim += `Provider: [Your Name/Company]\n\n`;
            
            // Group by student and calculate amounts
            const groupedByStudent = {};
            let grandTotalHours = 0;
            let grandTotalAmount = 0;
            
            filteredLogs.forEach(log => {
                if (!groupedByStudent[log.studentName]) {
                    groupedByStudent[log.studentName] = {
                        logs: [],
                        totalHours: 0,
                        rate: studentRateMap[log.studentName] || 0,
                        amount: 0
                    };
                }
                
                const hours = parseFloat(log.duration) || 0;
                groupedByStudent[log.studentName].logs.push(log);
                groupedByStudent[log.studentName].totalHours += hours;
            });
            
            // Calculate amounts for each student
            Object.keys(groupedByStudent).forEach(student => {
                const data = groupedByStudent[student];
                data.amount = data.totalHours * data.rate;
                grandTotalHours += data.totalHours;
                grandTotalAmount += data.amount;
            });
            
            claim += 'DETAILED BREAKDOWN:\n';
            claim += '-'.repeat(30) + '\n\n';
            
            Object.keys(groupedByStudent).forEach(student => {
                const data = groupedByStudent[student];
                
                claim += `Student: ${student}\n`;
                claim += `Rate: $${data.rate.toFixed(2)}/hour\n`;
                claim += `Total Hours: ${data.totalHours.toFixed(2)}\n`;
                claim += `Amount Due: $${data.amount.toFixed(2)}\n\n`;
                
                claim += 'Date         Hours  Activity\n';
                claim += '-'.repeat(35) + '\n';
                
                data.logs.forEach(log => {
                    claim += `${log.date.padEnd(12)} ${log.duration.toString().padStart(5)}  ${log.activity}\n`;
                });
                
                claim += '\n';
            });
            
            claim += 'SUMMARY:\n';
            claim += '-'.repeat(30) + '\n';
            claim += `Total Hours: ${grandTotalHours.toFixed(2)}\n`;
            claim += `Total Students: ${Object.keys(groupedByStudent).length}\n`;
            claim += `Grand Total Due: $${grandTotalAmount.toFixed(2)}\n\n`;
            
            claim += 'PAYMENT INFORMATION:\n';
            claim += '-'.repeat(30) + '\n';
            claim += 'Payable to: [Your Name/Company]\n';
            claim += 'Payment Method: [Bank Transfer/Check/etc.]\n';
            claim += 'Account Details: [If applicable]\n\n';
            
            claim += 'AUTHORIZATION:\n';
            claim += '-'.repeat(30) + '\n';
            claim += 'Provider Signature: __________________________\n';
            claim += 'Date: ______________\n\n';
            claim += 'Approver Signature: __________________________\n';
            claim += 'Date: ______________\n';
            
            return claim;
        } catch (error) {
            console.error('Error generating claim form:', error);
            return `Error generating claim form: ${error.message}`;
        }
    }

    async generateInvoice(studentName, periodStart, periodEnd) {
        try {
            const allLogs = await this.getAllLogs();
            const students = await this.getAllStudents();
            
            const student = students.find(s => s.name === studentName);
            if (!student) {
                return `Student "${studentName}" not found.`;
            }
            
            const rate = student.hourlyRate || 0;
            const studentLogs = allLogs.filter(log => {
                if (log.studentName !== studentName) return false;
                const logDate = new Date(log.date);
                const start = new Date(periodStart);
                const end = new Date(periodEnd);
                return logDate >= start && logDate <= end;
            });
            
            if (studentLogs.length === 0) {
                return `No logs found for ${studentName} in the specified period.`;
            }
            
            const totalHours = studentLogs.reduce((sum, log) => sum + parseFloat(log.duration || 0), 0);
            const subtotal = totalHours * rate;
            const tax = subtotal * 0.10; // Assuming 10% tax - adjust as needed
            const total = subtotal + tax;
            
            let invoice = 'INVOICE\n';
            invoice += '='.repeat(50) + '\n\n';
            invoice += `Invoice Date: ${new Date().toLocaleDateString()}\n`;
            invoice += `Invoice #: INV-${Date.now().toString().slice(-8)}\n\n`;
            
            invoice += 'BILL TO:\n';
            invoice += `  Student: ${studentName}\n`;
            invoice += `  Grade: ${student.grade || 'N/A'}\n`;
            invoice += `  Subjects: ${student.subjects ? student.subjects.join(', ') : 'N/A'}\n\n`;
            
            invoice += 'SERVICE PERIOD:\n';
            invoice += `  From: ${new Date(periodStart).toLocaleDateString()}\n`;
            invoice += `  To: ${new Date(periodEnd).toLocaleDateString()}\n\n`;
            
            invoice += 'SERVICES RENDERED:\n';
            invoice += '-'.repeat(80) + '\n';
            invoice += 'Date         Hours  Rate        Activity          Notes\n';
            invoice += '-'.repeat(80) + '\n';
            
            studentLogs.forEach(log => {
                invoice += `${log.date.padEnd(12)} ${log.duration.toString().padStart(5)}  $${rate.toFixed(2).padStart(8)}  ${log.activity.padEnd(18)} ${log.notes || ''}\n`;
            });
            
            invoice += '-'.repeat(80) + '\n\n';
            
            invoice += 'PAYMENT SUMMARY:\n';
            invoice += `  Total Hours: ${totalHours.toFixed(2)}\n`;
            invoice += `  Hourly Rate: $${rate.toFixed(2)}\n`;
            invoice += `  Subtotal: $${subtotal.toFixed(2)}\n`;
            invoice += `  Tax (10%): $${tax.toFixed(2)}\n`;
            invoice += `  TOTAL DUE: $${total.toFixed(2)}\n\n`;
            
            invoice += 'PAYMENT TERMS:\n';
            invoice += '  Due upon receipt. Please make payment within 30 days.\n\n';
            
            invoice += 'THANK YOU FOR YOUR BUSINESS!\n';
            
            return invoice;
        } catch (error) {
            console.error('Error generating invoice:', error);
            return `Error generating invoice: ${error.message}`;
        }
    }

    formatReport(logs, students, title, startDate = null, endDate = null) {
        if (logs.length === 0) {
            return `No data found for ${title}`;
        }
        
        // Create student rate map
        const studentRateMap = {};
        students.forEach(student => {
            studentRateMap[student.name] = student.hourlyRate || 0;
        });
        
        let report = `${title}\n`;
        report += '='.repeat(title.length) + '\n\n';
        
        if (startDate && endDate) {
            report += `Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n`;
        }
        report += `Report Date: ${new Date().toLocaleDateString()}\n`;
        report += `Total Entries: ${logs.length}\n`;
        
        const totalHours = logs.reduce((sum, log) => sum + parseFloat(log.duration || 0), 0);
        report += `Total Hours: ${totalHours.toFixed(2)}\n`;
        
        // Calculate total amount if rates are available
        let totalAmount = 0;
        logs.forEach(log => {
            const rate = studentRateMap[log.studentName] || 0;
            totalAmount += (parseFloat(log.duration || 0) * rate);
        });
        
        if (totalAmount > 0) {
            report += `Estimated Value: $${totalAmount.toFixed(2)}\n`;
        }
        
        report += '\n';
        
        // Group by student
        const groupedByStudent = {};
        logs.forEach(log => {
            if (!groupedByStudent[log.studentName]) {
                groupedByStudent[log.studentName] = {
                    logs: [],
                    hours: 0,
                    amount: 0
                };
            }
            const hours = parseFloat(log.duration || 0);
            const rate = studentRateMap[log.studentName] || 0;
            groupedByStudent[log.studentName].logs.push(log);
            groupedByStudent[log.studentName].hours += hours;
            groupedByStudent[log.studentName].amount += (hours * rate);
        });
        
        report += 'BY STUDENT:\n';
        report += '-'.repeat(50) + '\n\n';
        
        Object.keys(groupedByStudent).forEach(student => {
            const data = groupedByStudent[student];
            const activities = [...new Set(data.logs.map(log => log.activity))];
            
            report += `Student: ${student}\n`;
            report += `  Total Hours: ${data.hours.toFixed(2)}\n`;
            if (data.amount > 0) {
                const rate = studentRateMap[student] || 0;
                report += `  Hourly Rate: $${rate.toFixed(2)}\n`;
                report += `  Total Amount: $${data.amount.toFixed(2)}\n`;
            }
            report += `  Activities: ${activities.join(', ')}\n`;
            report += `  Average per session: ${(data.hours / data.logs.length).toFixed(2)} hours\n\n`;
        });
        
        // Group by activity
        const groupedByActivity = {};
        logs.forEach(log => {
            if (!groupedByActivity[log.activity]) {
                groupedByActivity[log.activity] = {
                    logs: [],
                    hours: 0,
                    students: new Set()
                };
            }
            groupedByActivity[log.activity].logs.push(log);
            groupedByActivity[log.activity].hours += parseFloat(log.duration || 0);
            groupedByActivity[log.activity].students.add(log.studentName);
        });
        
        report += 'BY ACTIVITY:\n';
        report += '-'.repeat(50) + '\n\n';
        
        Object.keys(groupedByActivity).forEach(activity => {
            const data = groupedByActivity[activity];
            
            report += `Activity: ${activity}\n`;
            report += `  Total Hours: ${data.hours.toFixed(2)}\n`;
            report += `  Sessions: ${data.logs.length}\n`;
            report += `  Students: ${[...data.students].join(', ')}\n\n`;
        });
        
        return report;
    }

    async getAllSubjects() {
        try {
            const allLogs = await this.getAllLogs();
            const subjects = new Set();
            
            allLogs.forEach(log => {
                // Extract subjects from activity
                const activity = log.activity.toLowerCase();
                const commonSubjects = ['math', 'reading', 'writing', 'science', 'history', 'english', 
                                       'algebra', 'geometry', 'biology', 'chemistry', 'physics', 
                                       'art', 'music', 'pe', 'physical', 'education', 'tutoring',
                                       'homework', 'study', 'test', 'exam', 'project', 'essay',
                                       'grammar', 'vocabulary', 'spelling', 'calculus', 'trigonometry'];
                
                commonSubjects.forEach(subject => {
                    if (activity.includes(subject)) {
                        subjects.add(subject);
                    }
                });
                
                // Also check notes
                if (log.notes) {
                    const notes = log.notes.toLowerCase();
                    commonSubjects.forEach(subject => {
                        if (notes.includes(subject)) {
                            subjects.add(subject);
                        }
                    });
                }
            });
            
            return Array.from(subjects).sort();
        } catch (error) {
            console.error('Error getting subjects:', error);
            return [];
        }
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

// Make DataManager available globally
window.DataManager = DataManager;

// Create and expose a global instance
if (!window.dataManager) {
    window.dataManager = new DataManager();
    console.log('Global dataManager instance created');
}

// Export functions globally (simpler approach)
// These functions will be available globally since they're defined in global scope
