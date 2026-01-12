// form-handler.js - UPDATED WITH LOCALSTORAGE FALLBACK
console.log('📝 Loading form-handler.js...');

class FormHandler {
    constructor() {
        console.log('✅ FormHandler constructor called');
        this.dataManager = window.dataManager;
        this.currentUserEmail = null;
        
        this.init();
    }

    async init() {
        console.log('🔄 Initializing FormHandler...');
        try {
            await this.initializeForms();
            console.log('✅ FormHandler initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing FormHandler:', error);
        }
    }

    async initializeForms() {
        console.log('📋 Setting up forms...');
        
        // Setup student form
        this.setupStudentForm();
        
        // Setup other forms if needed
        this.setupHoursForm();
        this.setupMarksForm();
        this.setupAttendanceForm();
        this.setupPaymentForm();
    }

    setupStudentForm() {
        console.log('👤 Setting up student form...');
        const form = document.getElementById('studentForm');
        
        if (!form) {
            console.log('⚠️ Student form not found - may be on different tab');
            return;
        }
        
        console.log('✅ Found student form with ID-based fields');
        
        // Get the submit button
        const submitBtn = document.getElementById('studentSubmitBtn');
        if (!submitBtn) {
            console.error('❌ studentSubmitBtn not found!');
            return;
        }
        
        console.log('✅ Found submit button inside form');
        
        // Remove any existing listeners
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        
        // Add click handler to the button
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('🟢 Add Student button clicked!');
            
            await this.handleStudentSubmit(form);
        });
        
        console.log('✅ Student form handler attached');
        
        // Also handle Enter key in form fields
        form.querySelectorAll('input, select').forEach(field => {
            field.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    newBtn.click();
                }
            });
        });
        
        // Setup edit/cancel buttons
        this.setupStudentEditButtons();
    }

    async handleStudentSubmit(form) {
        console.log('📤 Handling student form submission...');
        
        try {
            // Get values from ID-based fields
            const studentData = {
                name: document.getElementById('studentName').value.trim(),
                studentId: document.getElementById('studentId').value.trim(),
                gender: document.getElementById('studentGender').value,
                email: document.getElementById('studentEmail').value.trim(),
                phone: document.getElementById('studentPhone').value.trim(),
                rate: parseFloat(document.getElementById('studentRate').value) || 0  // Note: using 'rate' not 'hourlyRate'
            };
            
            console.log('📄 Student data from form:', studentData);
            
            // Validate required fields
            if (!studentData.name) {
                this.showNotification('Student name is required!', 'error');
                document.getElementById('studentName').focus();
                return;
            }
            
            if (!studentData.studentId) {
                this.showNotification('Student ID is required!', 'error');
                document.getElementById('studentId').focus();
                return;
            }
            
            if (!studentData.gender) {
                this.showNotification('Gender is required!', 'error');
                document.getElementById('studentGender').focus();
                return;
            }
            
            // Show loading state
            const submitBtn = document.getElementById('studentSubmitBtn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Adding...';
            submitBtn.disabled = true;
            
            // Prepare data for Firebase (use correct field names)
            const firebaseData = {
                name: studentData.name,
                studentId: studentData.studentId,
                gender: studentData.gender,
                email: studentData.email || '',
                phone: studentData.phone || '',
                rate: studentData.rate,  // Note: using 'rate' here
                // Add timestamp
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            console.log('📊 Data for saving:', firebaseData);
            
            let success = false;
            
            // TRY 1: Use DataManager/Firebase if available
            if (this.dataManager && this.dataManager.addStudent) {
                try {
                    console.log('☁️ Trying to add student via DataManager...');
                    success = await this.dataManager.addStudent(firebaseData);
                    console.log('DataManager result:', success);
                } catch (firebaseError) {
                    console.log('⚠️ Firebase failed, falling back to localStorage:', firebaseError);
                    success = false;
                }
            }
            
            // TRY 2: Fallback to localStorage if Firebase fails
            if (!success) {
                console.log('💾 Falling back to localStorage...');
                success = await this.addStudentToLocalStorage(firebaseData);
            }
            
            // Restore button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            
            if (success) {
                console.log('✅ Student added successfully!');
                
                // Show success message
                this.showNotification(`Student "${studentData.name}" added successfully!`, 'success');
                
                // Clear form
                this.clearStudentForm();
                
                // Refresh student list
                await this.loadStudents();
                
                // Update reports
                if (window.reportManager) {
                    window.reportManager.loadDataInBackground();
                }
                
                // Update UI stats
                this.updateStudentStats();
                
                // Update global student dropdowns if function exists
                if (typeof refreshStudentDropdowns === 'function') {
                    refreshStudentDropdowns();
                }
                
                // Trigger app.js loadStudents if exists
                if (typeof loadStudents === 'function') {
                    loadStudents();
                }
                
                // Trigger app.js updateGlobalStats if exists
                if (typeof updateGlobalStats === 'function') {
                    updateGlobalStats();
                }
                
            } else {
                console.error('❌ Failed to add student');
                this.showNotification('Failed to add student. Please try again.', 'error');
            }
            
        } catch (error) {
            console.error('❌ Error submitting student form:', error);
            
            // Restore button
            const submitBtn = document.getElementById('studentSubmitBtn');
            if (submitBtn) {
                submitBtn.textContent = '➕ Add Student';
                submitBtn.disabled = false;
            }
            
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    async addStudentToLocalStorage(studentData) {
        try {
            console.log('💾 Saving student to localStorage...');
            
            // Get existing students
            const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
            
            // Generate ID if not provided
            const studentId = studentData.id || 'student_' + Date.now();
            
            // Create complete student object
            const student = {
                ...studentData,
                id: studentId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Check if student ID already exists
            const existingIndex = students.findIndex(s => s.studentId === student.studentId);
            if (existingIndex >= 0) {
                // Update existing
                students[existingIndex] = { ...students[existingIndex], ...student };
                console.log('📝 Updated existing student:', student.studentId);
            } else {
                // Add new
                students.push(student);
                console.log('➕ Added new student:', student.studentId);
            }
            
            // Save to localStorage
            localStorage.setItem('worklog_students', JSON.stringify(students));
            
            console.log(`✅ Saved ${students.length} students to localStorage`);
            return true;
            
        } catch (error) {
            console.error('❌ Error saving to localStorage:', error);
            return false;
        }
    }

    async getAllStudents() {
        console.log('👥 Getting all students...');
        
        // Try DataManager first
        if (this.dataManager && this.dataManager.getAllStudents) {
            try {
                const students = await this.dataManager.getAllStudents();
                if (students && students.length > 0) {
                    console.log(`✅ Got ${students.length} students from DataManager`);
                    return students;
                }
            } catch (error) {
                console.log('⚠️ DataManager failed, trying localStorage:', error);
            }
        }
        
        // Fallback to localStorage
        try {
            const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
            console.log(`✅ Got ${students.length} students from localStorage`);
            return students;
        } catch (error) {
            console.error('❌ Error getting students:', error);
            return [];
        }
    }
        
    clearStudentForm() {
        const form = document.getElementById('studentForm');
        if (form) {
            form.reset();
            console.log('🗑️ Form cleared');
            
            // Hide cancel button if visible
            const cancelBtn = document.getElementById('studentCancelBtn');
            if (cancelBtn) {
                cancelBtn.style.display = 'none';
            }
            
            // Clear any edit mode
            delete window.editingStudentId;
            
            // Focus on first field
            document.getElementById('studentName').focus();
        }
    }

    async loadStudents() {
        console.log('👥 Loading students list...');
        try {
            const students = await this.getAllStudents();
            console.log(`✅ Loaded ${students.length} students`);
            
            // Update student count
            const studentCount = document.getElementById('studentCount');
            if (studentCount) {
                studentCount.textContent = students.length;
            }
            
            // Update average rate
            const averageRate = document.getElementById('averageRate');
            if (averageRate && students.length > 0) {
                const totalRate = students.reduce((sum, student) => sum + (student.rate || 0), 0);
                const avgRate = totalRate / students.length;
                averageRate.textContent = avgRate.toFixed(2);
            }
            
            // Update students table if it exists
            this.updateStudentsTable(students);
            
            return students;
            
        } catch (error) {
            console.error('❌ Error loading students:', error);
            return [];
        }
    }

    updateStudentsTable(students) {
        // Look for students table
        const table = document.querySelector('#studentsTable tbody') || 
                     document.querySelector('.students-table tbody') ||
                     document.querySelector('#studentsContainer');
        
        if (!table) {
            console.log('No students table found to update');
            return;
        }
        
        // Clear table
        if (table.tagName === 'TBODY' || table.tagName === 'DIV') {
            table.innerHTML = '';
        }
        
        if (students.length === 0) {
            if (table.tagName === 'TBODY') {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="6" class="empty-message">No students added yet</td>';
                table.appendChild(row);
            } else {
                table.innerHTML = '<p class="empty-message">No students added yet</p>';
            }
            return;
        }
        
        if (table.tagName === 'TBODY') {
            // Table format
            students.forEach(student => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${student.name}</td>
                    <td>${student.studentId || ''}</td>
                    <td>${student.gender || ''}</td>
                    <td>${student.email || ''}</td>
                    <td>$${(student.rate || 0).toFixed(2)}</td>
                    <td>
                        <button onclick="editStudent('${student.id}')" class="btn btn-sm btn-outline-primary">Edit</button>
                        <button onclick="deleteStudent('${student.id}')" class="btn btn-sm btn-outline-danger">Delete</button>
                    </td>
                `;
                table.appendChild(row);
            });
        } else if (table.tagName === 'DIV') {
            // Card/div format
            table.innerHTML = students.map(student => `
                <div class="student-card" data-id="${student.id}">
                    <div class="student-card-header">
                        <strong>${student.name}</strong>
                        <span class="student-id">${student.studentId}</span>
                        <div class="student-actions">
                            <button class="btn-icon edit-student" onclick="editStudent('${student.id}')" title="Edit">✏️</button>
                            <button class="btn-icon delete-student" onclick="deleteStudent('${student.id}')" title="Delete">🗑️</button>
                        </div>
                    </div>
                    <div class="student-details">
                        <div class="student-rate">$${student.rate || '0.00'}/session</div>
                        <div>${student.gender} • ${student.email || 'No email'}</div>
                        <div>${student.phone || 'No phone'}</div>
                        <div class="student-meta">
                            Added: ${new Date(student.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    updateStudentStats() {
        console.log('📊 Updating student stats...');
        // This will be called after adding/editing/deleting students
    }

    setupStudentEditButtons() {
        const cancelBtn = document.getElementById('studentCancelBtn');
        if (cancelBtn) {
            // Remove any existing listener
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            newCancelBtn.addEventListener('click', () => {
                this.clearStudentForm();
            });
        }
    }

    // Setup other forms (simplified versions)
    setupHoursForm() {
        const form = document.getElementById('hoursForm');
        if (form) {
            console.log('⏱️ Found hours form');
            // Add similar logic for hours form
        }
    }

    setupMarksForm() {
        const form = document.getElementById('marksForm');
        if (form) {
            console.log('📝 Found marks form');
            // Add similar logic for marks form
        }
    }

    setupAttendanceForm() {
        const form = document.getElementById('attendanceForm');
        if (form) {
            console.log('✅ Found attendance form');
            // Add similar logic for attendance form
        }
    }

    setupPaymentForm() {
        const form = document.getElementById('paymentForm');
        if (form) {
            console.log('💰 Found payment form');
            // Add similar logic for payment form
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.form-notification');
        if (existing) existing.remove();
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `form-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 5px;
            color: white;
            z-index: 1000;
            font-weight: 500;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
            ${type === 'success' ? 'background: #28a745;' : ''}
            ${type === 'error' ? 'background: #dc3545;' : ''}
            ${type === 'info' ? 'background: #17a2b8;' : ''}
            ${type === 'warning' ? 'background: #ffc107; color: #000;' : ''}
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Utility function to save any data type
    async saveData(dataType, data) {
        try {
            // Try Firebase first if available
            if (this.dataManager && this.dataManager[`save${dataType}`]) {
                const result = await this.dataManager[`save${dataType}`](data);
                if (result && result.success) return true;
            }
            
            // Fallback to localStorage
            const key = `worklog_${dataType.toLowerCase()}s`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            
            // Add ID if not present
            if (!data.id) {
                data.id = `${dataType.toLowerCase()}_${Date.now()}`;
            }
            
            data.createdAt = data.createdAt || new Date().toISOString();
            data.updatedAt = new Date().toISOString();
            
            existing.push(data);
            localStorage.setItem(key, JSON.stringify(existing));
            
            return true;
        } catch (error) {
            console.error(`❌ Error saving ${dataType}:`, error);
            return false;
        }
    }
}

// Add CSS for notifications (only if not already added)
if (!document.getElementById('form-handler-styles')) {
    const style = document.createElement('style');
    style.id = 'form-handler-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .student-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            background: white;
        }
        
        .student-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .student-id {
            color: #666;
            font-size: 0.9em;
        }
        
        .student-actions {
            display: flex;
            gap: 5px;
        }
        
        .btn-icon {
            background: none;
            border: none;
            cursor: pointer;
            padding: 5px;
            font-size: 16px;
        }
        
        .student-rate {
            font-weight: bold;
            color: #28a745;
            margin-bottom: 5px;
        }
        
        .student-meta {
            font-size: 0.8em;
            color: #888;
            margin-top: 5px;
        }
        
        .empty-message {
            text-align: center;
            color: #666;
            padding: 20px;
            font-style: italic;
        }
    `;
    document.head.appendChild(style);
}

// Make sure it's globally accessible
window.FormHandler = FormHandler;

// Initialize when DOM is ready
console.log('📄 Initializing FormHandler...');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.formHandler = new FormHandler();
    });
} else {
    window.formHandler = new FormHandler();
}

// Global functions for student operations
window.editStudent = async function(studentId) {
    console.log('✏️ Editing student:', studentId);
    
    try {
        const students = await window.formHandler.getAllStudents();
        const student = students.find(s => s.id === studentId);
        
        if (!student) {
            window.formHandler.showNotification('Student not found', 'error');
            return;
        }
        
        // Fill form with student data
        document.getElementById('studentName').value = student.name || '';
        document.getElementById('studentId').value = student.studentId || '';
        document.getElementById('studentGender').value = student.gender || '';
        document.getElementById('studentEmail').value = student.email || '';
        document.getElementById('studentPhone').value = student.phone || '';
        document.getElementById('studentRate').value = student.rate || '';
        
        // Set edit mode
        window.editingStudentId = studentId;
        
        const submitBtn = document.getElementById('studentSubmitBtn');
        const cancelBtn = document.getElementById('studentCancelBtn');
        
        if (submitBtn) submitBtn.textContent = '💾 Update Student';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
        
        window.formHandler.showNotification('Editing student: ' + student.name, 'info');
        
        // Scroll to form
        document.getElementById('studentName').focus();
        
    } catch (error) {
        console.error('Error editing student:', error);
        window.formHandler.showNotification('Error editing student', 'error');
    }
};

window.deleteStudent = async function(studentId) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    try {
        // Get students
        const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
        const filtered = students.filter(student => student.id !== studentId);
        
        // Save to localStorage
        localStorage.setItem('worklog_students', JSON.stringify(filtered));
        
        window.formHandler.showNotification('Student deleted', 'success');
        
        // Refresh UI
        if (window.formHandler.loadStudents) {
            await window.formHandler.loadStudents();
        }
        
        // Update other parts of the app
        if (typeof refreshStudentDropdowns === 'function') {
            refreshStudentDropdowns();
        }
        
        if (typeof updateGlobalStats === 'function') {
            updateGlobalStats();
        }
        
        if (typeof updateProfileStats === 'function') {
            updateProfileStats();
        }
        
    } catch (error) {
        console.error('Error deleting student:', error);
        window.formHandler.showNotification('Error deleting student', 'error');
    }
};

console.log('✅ FormHandler script loaded');
