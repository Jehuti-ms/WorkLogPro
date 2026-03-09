// data-manager.js - COMPLETE FIXED VERSION
console.log('📊 Loading data-manager.js...');

class DataManager {
    constructor() {
        console.log('📊 DataManager constructor called');
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.userId = null;
        this.currentUserEmail = null;
        this.students = []; // Add students array to store in memory
        
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
                
                // Load students from Firestore on init
                await this.loadFromFirestore();
            } else {
                console.log('📊 DataManager: No user logged in');
            }
        } catch (error) {
            console.error('❌ Error initializing DataManager:', error);
        }
    }

    // SYNC UI METHOD - WITH PROPER SORTING AND TEST DATA HANDLING
    syncUI(sortMethod = 'id') {
        console.log('🔄 Syncing UI with student data...');
        
        // Get students from localStorage
        let students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
        
        // Split into real students (with valid studentId) and test data
        const realStudents = students.filter(s => s.studentId && s.studentId.toString().trim() !== '');
        const testStudents = students.filter(s => !s.studentId || s.studentId.toString().trim() === '');
        
        // Sort based on method
        if (sortMethod === 'id') {
            // Sort by student ID numerically
            realStudents.sort((a, b) => {
                const getNum = (id) => {
                    const match = id.toString().match(/\d+/);
                    return match ? parseInt(match[0], 10) : 999999;
                };
                
                const numA = getNum(a.studentId);
                const numB = getNum(b.studentId);
                
                if (numA !== numB) {
                    return numA - numB; // Sort by numeric part
                }
                
                // If same number, sort alphabetically by full ID
                return (a.studentId || '').localeCompare(b.studentId || '');
            });
        } else if (sortMethod === 'name') {
            // Sort by name alphabetically
            realStudents.sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        } else if (sortMethod === 'date') {
            // Sort by creation date (newest first)
            realStudents.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA; // Newest first
            });
        } else if (sortMethod === 'rate') {
            // Sort by rate (highest first)
            realStudents.sort((a, b) => {
                const rateA = parseFloat(a.rate || a.hourlyRate || 0);
                const rateB = parseFloat(b.rate || b.hourlyRate || 0);
                return rateB - rateA; // Highest first
            });
        }
        
        // Combine real students first, then test data at the end
        students = [...realStudents, ...testStudents];
        
        // Update formHandler
        if (window.formHandler) {
            window.formHandler.students = students;
        }
        
        // DIRECT UI UPDATE
        const container = document.getElementById('studentsContainer');
        if (container) {
            if (students.length === 0) {
                container.innerHTML = '<p class="empty-message">No students registered yet.</p>';
            } else {
                container.innerHTML = students.map(student => {
                    // Format the date properly
                    let dateStr = 'Unknown';
                    if (student.createdAt) {
                        try {
                            const date = student.createdAt.toDate ? 
                                student.createdAt.toDate() : 
                                new Date(student.createdAt);
                            dateStr = date.toLocaleDateString();
                        } catch (e) {
                            dateStr = 'Unknown';
                        }
                    }
                    
                    // Add a visual indicator for test students
                    const isTestStudent = !student.studentId || student.studentId.toString().trim() === '';
                    
                    // Calculate rate display
                    const rate = student.hourlyRate || student.rate || 0;
                    
                    return `
                        <div class="student-card" data-id="${student.id}" style="${isTestStudent ? 'opacity: 0.7; border-left: 3px solid orange;' : ''}">
                            <div class="student-card-header">
                                <strong>${student.name || ''}</strong>
                                <span class="student-id">${student.studentId || '⚠️ No ID'}</span>
                                <div class="student-actions">
                                    <button class="btn-icon edit-student" onclick="window.editStudent('${student.id}')" title="Edit">✏️</button>
                                    <button class="btn-icon delete-student" onclick="window.deleteStudent('${student.id}')" title="Delete">🗑️</button>
                                </div>
                            </div>
                            <div class="student-details">
                                <div class="student-rate">$${rate.toFixed(2)}/hour</div>
                                <div>${student.gender || ''} • ${student.email || 'No email'}</div>
                                <div>${student.phone || 'No phone'}</div>
                                <div class="student-meta">
                                    Added: ${dateStr}
                                    ${isTestStudent ? '<span style="color: orange; margin-left: 10px;">⚠️ Test Data</span>' : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            
            // Update student count
            const countElem = document.getElementById('studentCount');
            if (countElem) countElem.textContent = realStudents.length;
            
            // Also update stats
            const statStudents = document.getElementById('statStudents');
            if (statStudents) statStudents.textContent = realStudents.length;
            
            // Update average rate
            const avgRateElem = document.getElementById('averageRate');
            if (avgRateElem && realStudents.length > 0) {
                const totalRate = realStudents.reduce((sum, student) => 
                    sum + parseFloat(student.rate || student.hourlyRate || 0), 0);
                const avgRate = totalRate / realStudents.length;
                avgRateElem.textContent = avgRate.toFixed(2);
            }
        }
        
        console.log(`✅ UI synced with ${realStudents.length} real students + ${testStudents.length} test entries`);
        console.log(`📋 Student order (${sortMethod}):`, realStudents.map(s => 
            sortMethod === 'id' ? `${s.studentId}: ${s.name}` : 
            sortMethod === 'name' ? s.name : 
            sortMethod === 'date' ? `${new Date(s.createdAt).toLocaleDateString()}: ${s.name}` :
            sortMethod === 'rate' ? `$${parseFloat(s.rate || 0).toFixed(2)}: ${s.name}` : 
            `${s.studentId}: ${s.name}`
        ).join(' → '));
        
        return students;
    }

    // STUDENT METHODS
    async addStudent(studentData) {
        try {
            if (!this.userId) {
                console.error('❌ User not authenticated');
                return false;
            }
            
            console.log('📤 Adding student to Firebase:', studentData);
            
            // Generate a new document reference with auto-ID
            const studentsCollectionRef = this.db
                .collection('users')
                .doc(this.userId)
                .collection('students');
            
            const studentRef = studentsCollectionRef.doc(); // Auto-generate ID
            
            // Prepare data for Firestore
            const studentToSave = {
                name: studentData.name,
                studentId: studentData.studentId || '',
                gender: studentData.gender || '',
                email: studentData.email || '',
                phone: studentData.phone || '',
                hourlyRate: parseFloat(studentData.hourlyRate || studentData.rate || 0),
                grade: studentData.grade || '',
                subjects: Array.isArray(studentData.subjects) ? studentData.subjects : 
                          (studentData.subjects ? studentData.subjects.split(',').map(s => s.trim()) : []),
                notes: studentData.notes || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // IMPORTANT: Actually await the Firestore save
            await studentRef.set(studentToSave);
            console.log('✅ Student saved to Firestore with ID:', studentRef.id);
            
            // Also save student ID to the data object for localStorage
            studentData.id = studentRef.id;
            
            // Add to in-memory array
            this.students.push({
                id: studentRef.id,
                ...studentToSave,
                createdAt: new Date() // Use regular date for localStorage
            });
            
            // Save to localStorage as backup
            this.saveToLocalStorage();
            
            // Auto-refresh the UI
            this.syncUI();
            
            return true;
        } catch (error) {
            console.error('❌ Error adding student to Firestore:', error);
            
            // Fallback: save only to localStorage with a generated ID
            console.log('⚠️ Falling back to localStorage only');
            studentData.id = studentData.id || 'local-' + Date.now();
            
            // Add to in-memory array
            this.students.push({
                id: studentData.id,
                name: studentData.name,
                studentId: studentData.studentId || '',
                gender: studentData.gender || '',
                email: studentData.email || '',
                phone: studentData.phone || '',
                hourlyRate: parseFloat(studentData.hourlyRate || studentData.rate || 0),
                grade: studentData.grade || '',
                subjects: Array.isArray(studentData.subjects) ? studentData.subjects : 
                          (studentData.subjects ? [studentData.subjects] : []),
                notes: studentData.notes || '',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            // Save to localStorage
            this.saveToLocalStorage();
            
            // Still try to refresh UI with localStorage data
            this.syncUI();
            
            return false;
        }
    }

    async getAllStudents() {
        try {
            if (!this.userId) return [];
            
            const snapshot = await this.db.collection('users').doc(this.userId).collection('students').get();
            let students = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Sort by studentId numerically
            students.sort((a, b) => {
                const getNumericId = (student) => {
                    if (!student.studentId) return 999999;
                    const match = student.studentId.toString().match(/\d+/);
                    return match ? parseInt(match[0], 10) : 999999;
                };
                
                const idA = getNumericId(a);
                const idB = getNumericId(b);
                
                return idA - idB;
            });
            
            // Update in-memory array
            this.students = students;
            
            return students;
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
            
            // Update in-memory array
            const index = this.students.findIndex(s => s.id === studentId);
            if (index !== -1) {
                this.students[index] = {
                    ...this.students[index],
                    ...studentData,
                    updatedAt: new Date()
                };
            }
            
            // Refresh localStorage and UI
            await this.loadFromFirestore();
            this.saveToLocalStorage();
            this.syncUI();
            
            return true;
        } catch (error) {
            console.error('❌ Error updating student:', error);
            return false;
        }
    }

    async deleteStudent(studentId) {
        try {
            console.log(`🗑️ Attempting to delete student: ${studentId}`);
            
            if (!studentId) {
                console.error('❌ No student ID provided');
                return false;
            }
            
            // Double confirmation for safety
            if (!confirm('Are you sure you want to permanently delete this student? This cannot be undone.')) {
                return false;
            }
            
            // Show loading indicator
            this.showNotification('Deleting student...', 'info');
            
            // 1. Delete from Firebase if user is authenticated
            if (this.userId) {
                try {
                    console.log('☁️ Deleting from Firebase...');
                    
                    // Delete from main data document
                    const db = firebase.firestore();
                    const userRef = db.collection('users').doc(this.userId);
                    
                    // Remove from consolidated data document
                    const dataDocRef = userRef.collection('data').doc('worklog');
                    
                    // Get current data, filter, set back
                    const docSnap = await dataDocRef.get();
                    if (docSnap.exists) {
                        const data = docSnap.data();
                        if (data.students) {
                            data.students = data.students.filter(s => s.id !== studentId);
                            await dataDocRef.set(data, { merge: true });
                        }
                    }
                    
                    // Also delete from separate students collection if it exists
                    const studentDocRef = userRef.collection('students').doc(studentId);
                    await studentDocRef.delete().catch(e => {
                        console.log('No separate student document to delete');
                    });
                    
                    console.log('✅ Deleted from Firebase');
                } catch (firebaseError) {
                    console.error('❌ Firebase delete error:', firebaseError);
                    // Continue with local delete even if Firebase fails
                }
            }
            
            // 2. Delete from localStorage (ALWAYS do this)
            console.log('💾 Deleting from localStorage...');
            
            // Get current students
            let students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
            const beforeCount = students.length;
            
            // Filter out the student
            students = students.filter(s => s.id !== studentId);
            const afterCount = students.length;
            
            if (beforeCount === afterCount) {
                console.warn('⚠️ Student not found in localStorage');
            } else {
                console.log(`✅ Removed ${beforeCount - afterCount} student(s) from localStorage`);
            }
            
            // Save back to localStorage
            localStorage.setItem('worklog_students', JSON.stringify(students));
            
            // 3. Also delete related data (hours, marks, attendance, payments)
            await this.deleteRelatedData(studentId);
            
            // 4. Force a sync to ensure Firebase reflects the deletion
            if (this.userId && window.syncService) {
                console.log('🔄 Syncing deletion to cloud...');
                
                // Wait a moment for local changes to settle
                setTimeout(async () => {
                    await window.syncService.sync(true);
                    console.log('✅ Deletion synced to cloud');
                }, 500);
            }
            
            // 5. Update UI
            this.syncUI();
            
            // 6. Show success message
            this.showNotification('Student permanently deleted!', 'success');
            
            // 7. Update all stats
            this.refreshAllStats();
            
            return true;
            
        } catch (error) {
            console.error('❌ Error deleting student:', error);
            this.showNotification('Error deleting student: ' + error.message, 'error');
            return false;
        }
    }

    // Helper method to delete related data
    async deleteRelatedData(studentId) {
        try {
            console.log(`🗑️ Deleting related data for student: ${studentId}`);
            
            // Data types to clean up
            const dataTypes = ['hours', 'marks', 'attendance', 'payments'];
            
            for (const type of dataTypes) {
                const key = `worklog_${type}`;
                let items = JSON.parse(localStorage.getItem(key) || '[]');
                
                // Filter based on the correct field name
                let filtered;
                if (type === 'hours') {
                    filtered = items.filter(item => item.hoursStudent !== studentId);
                } else if (type === 'marks') {
                    filtered = items.filter(item => item.marksStudent !== studentId);
                } else if (type === 'attendance') {
                    filtered = items.filter(item => !item.presentStudents?.includes(studentId));
                } else if (type === 'payments') {
                    filtered = items.filter(item => item.paymentStudent !== studentId);
                }
                
                if (filtered.length !== items.length) {
                    localStorage.setItem(key, JSON.stringify(filtered));
                    console.log(`✅ Removed ${items.length - filtered.length} ${type} records`);
                }
                
                // Also delete from Firebase if needed
                if (this.userId && firebase.firestore) {
                    try {
                        const db = firebase.firestore();
                        const collectionRef = db.collection('users').doc(this.userId).collection(type);
                        
                        // Query for items with this studentId
                        let fieldName;
                        if (type === 'hours') fieldName = 'hoursStudent';
                        else if (type === 'marks') fieldName = 'marksStudent';
                        else if (type === 'payments') fieldName = 'paymentStudent';
                        
                        if (fieldName) {
                            const snapshot = await collectionRef.where(fieldName, '==', studentId).get();
                            const batch = db.batch();
                            snapshot.docs.forEach(doc => {
                                batch.delete(doc.ref);
                            });
                            await batch.commit();
                            console.log(`✅ Deleted ${snapshot.size} ${type} from Firebase`);
                        }
                    } catch (e) {
                        console.log(`Could not delete ${type} from Firebase:`, e);
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting related data:', error);
            return false;
        }
    }

    // Add notification method if not present
    showNotification(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`🔔 [${type}] ${message}`);
            // Create temporary notification
            const notification = document.createElement('div');
            notification.className = `temp-notification ${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
                color: white;
                border-radius: 4px;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }
    }

    // Refresh all stats
    refreshAllStats() {
        if (typeof refreshAllStats === 'function') {
            refreshAllStats();
        } else {
            // Manual refresh
            if (typeof updateProfileStats === 'function') updateProfileStats();
            if (typeof updateGlobalStats === 'function') updateGlobalStats();
        }
    }

    // Load from Firestore to localStorage
    async loadFromFirestore() {
        try {
            const students = await this.getAllStudents();
            localStorage.setItem('worklog_students', JSON.stringify(students));
            console.log(`📚 Loaded ${students.length} students from Firestore to localStorage`);
            return students;
        } catch (error) {
            console.error('❌ Error loading from Firestore:', error);
            return [];
        }
    }

    // Save to localStorage - FIXED VERSION
    saveToLocalStorage() {
        try {
            // Use in-memory students array or get from wherever they're stored
            const students = this.students && this.students.length > 0 ? 
                this.students : 
                JSON.parse(localStorage.getItem('worklog_students') || '[]');
            
            localStorage.setItem('worklog_students', JSON.stringify(students));
            console.log(`💾 Saved ${students.length} students to localStorage`);
        } catch (error) {
            console.error('❌ Error saving to localStorage:', error);
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

    // REPORT METHODS
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
                // ... all your existing code ...

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

// Add global helper functions
window.editStudent = function(studentId) {
    console.log('✏️ Edit student:', studentId);
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const student = students.find(s => s.id === studentId);
    if (student) {
        // Populate your edit form here
        console.log('Student data to edit:', student);
        alert(`Edit student: ${student.name}\nThis feature is coming soon!`);
    }
};

window.deleteStudent = function(studentId) {
    console.log('🗑️ Delete student:', studentId);
    if (confirm('Are you sure you want to delete this student?')) {
        if (window.dataManager) {
            window.dataManager.deleteStudent(studentId);
        }
    }
};

// Force render helper
window.forceRender = function() {
    if (window.dataManager) {
        window.dataManager.syncUI();
    }
};
           
