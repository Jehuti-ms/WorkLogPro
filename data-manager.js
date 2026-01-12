// data-manager.js - FIXED VERSION
console.log('📊 Loading data-manager.js...');

class DataManager {
    constructor() {
        console.log('📊 DataManager constructor called');
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.userId = null;
        this.currentUserEmail = null;
        
        this.init();
    }

    async init() {
        try {
            // Get current user
            const user = this.auth.currentUser;
            if (user) {
                this.userId = user.uid;
                this.currentUserEmail = user.email;
                console.log(`📊 DataManager initialized for user: ${this.currentUserEmail}`);
            } else {
                console.log('📊 DataManager: No user logged in');
            }
        } catch (error) {
            console.error('❌ Error initializing DataManager:', error);
        }
    }

    // STUDENT METHODS
   async addStudent(studentData) {
    try {
        if (!this.userId) {
            console.error('❌ User not authenticated');
            return false;
        }
        
        console.log('📤 Adding student to Firebase:', studentData);
        
        const studentRef = this.db.collection('users').doc(this.userId).collection('students').doc();
        
        await studentRef.set({
            name: studentData.name,
            studentId: studentData.studentId || '',
            gender: studentData.gender || '',
            email: studentData.email || '',
            phone: studentData.phone || '',
            hourlyRate: studentData.hourlyRate || studentData.rate || 0,
            grade: studentData.grade || '',
            subjects: studentData.subjects || [],
            notes: studentData.notes || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Student added:', studentData.name);
        return true;
    } catch (error) {
        console.error('❌ Error adding student:', error);
        return false;
    }
}

    async getAllStudents() {
        try {
            if (!this.userId) return [];
            
            const snapshot = await this.db.collection('users').doc(this.userId).collection('students').get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('❌ Error getting students:', error);
            return [];
        }
    }

    async updateStudent(studentId, studentData) {
        try {
            if (!this.userId) throw new Error('User not authenticated');
            
            await this.db.collection('users').doc(this.userId).collection('students').doc(studentId).update({
                ...studentData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Student updated:', studentId);
            return true;
        } catch (error) {
            console.error('❌ Error updating student:', error);
            return false;
        }
    }

    async deleteStudent(studentId) {
        try {
            if (!this.userId) throw new Error('User not authenticated');
            
            await this.db.collection('users').doc(this.userId).collection('students').doc(studentId).delete();
            console.log('✅ Student deleted:', studentId);
            return true;
        } catch (error) {
            console.error('❌ Error deleting student:', error);
            return false;
        }
    }

    // HOURS/LOGS METHODS
    async addLog(logData) {
        try {
            if (!this.userId) throw new Error('User not authenticated');
            
            const logRef = this.db.collection('users').doc(this.userId).collection('hours').doc();
            
            await logRef.set({
                ...logData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Log added:', logData.studentName, logData.date);
            return true;
        } catch (error) {
            console.error('❌ Error adding log:', error);
            return false;
        }
    }

    async getAllLogs() {
        try {
            if (!this.userId) return [];
            
            const snapshot = await this.db.collection('users').doc(this.userId).collection('hours').get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('❌ Error getting logs:', error);
            return [];
        }
    }

    async updateLog(logId, logData) {
        try {
            if (!this.userId) throw new Error('User not authenticated');
            
            await this.db.collection('users').doc(this.userId).collection('hours').doc(logId).update({
                ...logData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Log updated:', logId);
            return true;
        } catch (error) {
            console.error('❌ Error updating log:', error);
            return false;
        }
    }

    async deleteLog(logId) {
        try {
            if (!this.userId) throw new Error('User not authenticated');
            
            await this.db.collection('users').doc(this.userId).collection('hours').doc(logId).delete();
            console.log('✅ Log deleted:', logId);
            return true;
        } catch (error) {
            console.error('❌ Error deleting log:', error);
            return false;
        }
    }

    // MARKS METHODS
    async addMark(markData) {
        try {
            if (!this.userId) throw new Error('User not authenticated');
            
            const markRef = this.db.collection('users').doc(this.userId).collection('marks').doc();
            
            await markRef.set({
                ...markData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Mark added:', markData.studentName, markData.subject);
            return true;
        } catch (error) {
            console.error('❌ Error adding mark:', error);
            return false;
        }
    }

    async getAllMarks() {
        try {
            if (!this.userId) return [];
            
            const snapshot = await this.db.collection('users').doc(this.userId).collection('marks').get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('❌ Error getting marks:', error);
            return [];
        }
    }

    // ATTENDANCE METHODS
    async addAttendance(attendanceData) {
        try {
            if (!this.userId) throw new Error('User not authenticated');
            
            const attendanceRef = this.db.collection('users').doc(this.userId).collection('attendance').doc();
            
            await attendanceRef.set({
                ...attendanceData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Attendance added:', attendanceData.studentName, attendanceData.date);
            return true;
        } catch (error) {
            console.error('❌ Error adding attendance:', error);
            return false;
        }
    }

    async getAllAttendance() {
        try {
            if (!this.userId) return [];
            
            const snapshot = await this.db.collection('users').doc(this.userId).collection('attendance').get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('❌ Error getting attendance:', error);
            return [];
        }
    }

    // PAYMENTS METHODS
    async addPayment(paymentData) {
        try {
            if (!this.userId) throw new Error('User not authenticated');
            
            const paymentRef = this.db.collection('users').doc(this.userId).collection('payments').doc();
            
            await paymentRef.set({
                ...paymentData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Payment added:', paymentData.studentName, paymentData.amount);
            return true;
        } catch (error) {
            console.error('❌ Error adding payment:', error);
            return false;
        }
    }

    async getAllPayments() {
        try {
            if (!this.userId) return [];
            
            const snapshot = await this.db.collection('users').doc(this.userId).collection('payments').get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('❌ Error getting payments:', error);
            return [];
        }
    }

    // REPORT METHODS - ADD THESE CORRECTLY
    generateWeeklyReport() {
        return this.generateDateRangeReport('weekly');
    }

    generateBiWeeklyReport() {
        return this.generateDateRangeReport('biweekly');
    }

    generateMonthlyReport() {
        return this.generateDateRangeReport('monthly');
    }

    async generateDateRangeReport(type) {
        try {
            const logs = await this.getAllLogs();
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
            
            const filteredLogs = logs.filter(log => {
                const logDate = new Date(log.date);
                return logDate >= startDate && logDate <= now;
            });
            
            if (filteredLogs.length === 0) {
                return `No data found for ${type} report (${startDate.toLocaleDateString()} to ${now.toLocaleDateString()})`;
            }
            
            let report = `${type.toUpperCase()} REPORT\n`;
            report += '='.repeat(50) + '\n\n';
            report += `Period: ${startDate.toLocaleDateString()} to ${now.toLocaleDateString()}\n`;
            report += `Generated: ${new Date().toLocaleDateString()}\n`;
            report += `Total Hours: ${filteredLogs.reduce((sum, log) => sum + parseFloat(log.duration || 0), 0).toFixed(2)}\n\n`;
            
            // Group by student
            const byStudent = {};
            filteredLogs.forEach(log => {
                if (!byStudent[log.studentName]) {
                    byStudent[log.studentName] = [];
                }
                byStudent[log.studentName].push(log);
            });
            
            report += 'BY STUDENT:\n';
            report += '-'.repeat(30) + '\n';
            
            Object.keys(byStudent).forEach(student => {
                const studentLogs = byStudent[student];
                const studentHours = studentLogs.reduce((sum, log) => sum + parseFloat(log.duration || 0), 0);
                const studentData = students.find(s => s.name === student);
                const rate = studentData?.hourlyRate || 0;
                const amount = studentHours * rate;
                
                report += `\n${student}:\n`;
                report += `  Hours: ${studentHours.toFixed(2)}\n`;
                report += `  Rate: $${rate.toFixed(2)}/hour\n`;
                report += `  Amount: $${amount.toFixed(2)}\n`;
                report += `  Sessions: ${studentLogs.length}\n`;
            });
            
            return report;
            
        } catch (error) {
            console.error(`Error generating ${type} report:`, error);
            return `Error generating report: ${error.message}`;
        }
    }

    async generateSubjectReport(subject) {
        try {
            const logs = await this.getAllLogs();
            const students = await this.getAllStudents();
            
            const subjectLogs = logs.filter(log => 
                log.activity.toLowerCase().includes(subject.toLowerCase()) ||
                (log.notes && log.notes.toLowerCase().includes(subject.toLowerCase()))
            );
            
            if (subjectLogs.length === 0) {
                return `No data found for subject: ${subject}`;
            }
            
            let report = `SUBJECT REPORT: ${subject.toUpperCase()}\n`;
            report += '='.repeat(50) + '\n\n';
            report += `Generated: ${new Date().toLocaleDateString()}\n`;
            report += `Total Hours: ${subjectLogs.reduce((sum, log) => sum + parseFloat(log.duration || 0), 0).toFixed(2)}\n`;
            report += `Total Sessions: ${subjectLogs.length}\n\n`;
            
            // Group by student
            const byStudent = {};
            subjectLogs.forEach(log => {
                if (!byStudent[log.studentName]) {
                    byStudent[log.studentName] = [];
                }
                byStudent[log.studentName].push(log);
            });
            
            report += 'BY STUDENT:\n';
            report += '-'.repeat(30) + '\n';
            
            Object.keys(byStudent).forEach(student => {
                const studentLogs = byStudent[student];
                const studentHours = studentLogs.reduce((sum, log) => sum + parseFloat(log.duration || 0), 0);
                
                report += `\n${student}:\n`;
                report += `  Hours: ${studentHours.toFixed(2)}\n`;
                report += `  Sessions: ${studentLogs.length}\n`;
            });
            
            return report;
            
        } catch (error) {
            console.error(`Error generating subject report for ${subject}:`, error);
            return `Error generating report: ${error.message}`;
        }
    }

    async getAllSubjects() {
        try {
            const logs = await this.getAllLogs();
            const subjects = new Set();
            
            logs.forEach(log => {
                // Simple subject extraction
                const activity = log.activity.toLowerCase();
                const commonSubjects = ['math', 'reading', 'writing', 'science', 'history', 'english'];
                
                commonSubjects.forEach(subject => {
                    if (activity.includes(subject)) {
                        subjects.add(subject);
                    }
                });
            });
            
            return Array.from(subjects).sort();
        } catch (error) {
            console.error('Error getting subjects:', error);
            return [];
        }
    }

    async generateClaimForm(type, periodEndDate = null) {
        try {
            const logs = await this.getAllLogs();
            const students = await this.getAllStudents();
            
            const now = new Date();
            let endDate = periodEndDate ? new Date(periodEndDate) : now;
            let startDate = new Date(endDate);
            
            switch(type) {
                case 'weekly':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case 'biweekly':
                    startDate.setDate(endDate.getDate() - 14);
                    break;
                case 'monthly':
                    startDate.setMonth(endDate.getMonth() - 1);
                    break;
            }
            
            const filteredLogs = logs.filter(log => {
                const logDate = new Date(log.date);
                return logDate >= startDate && logDate <= endDate;
            });
            
            let claim = `CLAIM FORM - ${type.toUpperCase()}\n`;
            claim += '='.repeat(50) + '\n\n';
            claim += `Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n`;
            claim += `Generated: ${new Date().toLocaleDateString()}\n\n`;
            
            // Calculate totals
            let totalHours = 0;
            let totalAmount = 0;
            
            const byStudent = {};
            filteredLogs.forEach(log => {
                if (!byStudent[log.studentName]) {
                    byStudent[log.studentName] = {
                        logs: [],
                        hours: 0,
                        amount: 0
                    };
                }
                
                const hours = parseFloat(log.duration || 0);
                const studentData = students.find(s => s.name === log.studentName);
                const rate = studentData?.hourlyRate || 0;
                const amount = hours * rate;
                
                byStudent[log.studentName].logs.push(log);
                byStudent[log.studentName].hours += hours;
                byStudent[log.studentName].amount += amount;
                
                totalHours += hours;
                totalAmount += amount;
            });
            
            claim += 'DETAILS:\n';
            claim += '-'.repeat(30) + '\n';
            
            Object.keys(byStudent).forEach(student => {
                const data = byStudent[student];
                claim += `\n${student}:\n`;
                claim += `  Hours: ${data.hours.toFixed(2)}\n`;
                claim += `  Amount: $${data.amount.toFixed(2)}\n`;
            });
            
            claim += '\n' + '='.repeat(50) + '\n';
            claim += `TOTAL HOURS: ${totalHours.toFixed(2)}\n`;
            claim += `TOTAL AMOUNT: $${totalAmount.toFixed(2)}\n\n`;
            
            claim += 'SIGNATURE:\n';
            claim += '__________\n';
            claim += 'Date: __________\n';
            
            return claim;
            
        } catch (error) {
            console.error(`Error generating ${type} claim form:`, error);
            return `Error generating claim form: ${error.message}`;
        }
    }

    async generateInvoice(studentName, startDate, endDate) {
        try {
            const logs = await this.getAllLogs();
            const students = await this.getAllStudents();
            
            const student = students.find(s => s.name === studentName);
            if (!student) {
                return `Student "${studentName}" not found.`;
            }
            
            const studentLogs = logs.filter(log => 
                log.studentName === studentName &&
                new Date(log.date) >= new Date(startDate) &&
                new Date(log.date) <= new Date(endDate)
            );
            
            if (studentLogs.length === 0) {
                return `No data found for ${studentName} from ${startDate} to ${endDate}`;
            }
            
            const rate = student.hourlyRate || 0;
            const totalHours = studentLogs.reduce((sum, log) => sum + parseFloat(log.duration || 0), 0);
            const subtotal = totalHours * rate;
            const tax = subtotal * 0.10; // 10% tax
            const total = subtotal + tax;
            
            let invoice = `INVOICE\n`;
            invoice += '='.repeat(50) + '\n\n';
            invoice += `Invoice Date: ${new Date().toLocaleDateString()}\n`;
            invoice += `Invoice #: INV-${Date.now().toString().slice(-6)}\n\n`;
            
            invoice += 'BILL TO:\n';
            invoice += `  ${studentName}\n`;
            invoice += `  ${student.grade ? 'Grade: ' + student.grade : ''}\n\n`;
            
            invoice += 'PERIOD:\n';
            invoice += `  ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}\n\n`;
            
            invoice += 'SERVICES:\n';
            invoice += '-'.repeat(50) + '\n';
            invoice += 'Date         Hours  Activity\n';
            invoice += '-'.repeat(50) + '\n';
            
            studentLogs.forEach(log => {
                invoice += `${log.date.padEnd(12)} ${log.duration.toString().padStart(5)}  ${log.activity}\n`;
            });
            
            invoice += '\n' + '='.repeat(50) + '\n';
            invoice += `Total Hours: ${totalHours.toFixed(2)}\n`;
            invoice += `Rate: $${rate.toFixed(2)} per hour\n`;
            invoice += `Subtotal: $${subtotal.toFixed(2)}\n`;
            invoice += `Tax (10%): $${tax.toFixed(2)}\n`;
            invoice += `TOTAL DUE: $${total.toFixed(2)}\n\n`;
            
            invoice += 'Payment due upon receipt. Thank you for your business!\n';
            
            return invoice;
            
        } catch (error) {
            console.error(`Error generating invoice for ${studentName}:`, error);
            return `Error generating invoice: ${error.message}`;
        }
    }
}

// Create global instance when script loads
console.log('📊 DataManager script loaded, creating global instance...');

// Wait for Firebase to be ready
const initDataManager = () => {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        if (!window.dataManager) {
            window.dataManager = new DataManager();
            console.log('✅ Global dataManager instance created');
            
            // Test the instance
            setTimeout(() => {
                console.log('🧪 Testing DataManager instance...');
                if (window.dataManager) {
                    console.log('✅ dataManager is ready:', window.dataManager);
                }
            }, 1000);
        }
    } else {
        console.log('⏳ Waiting for Firebase...');
        setTimeout(initDataManager, 100);
    }
};

// Start initialization
initDataManager();
