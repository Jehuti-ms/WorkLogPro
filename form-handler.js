// form-handler.js - UPDATED FOR ID-BASED FIELDS
console.log('📝 Loading form-handler.js...');

class FormHandler {
    constructor() {
        console.log('✅ FormHandler constructor called');
        this.dataManager = window.dataManager;
        this.currentUserEmail = null;
        
        if (!this.dataManager) {
            console.error('❌ DataManager not found!');
            return;
        }
        
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
    }

    setupStudentForm() {
        console.log('👤 Setting up student form...');
        const form = document.getElementById('studentForm');
        
        if (!form) {
            console.error('❌ Student form not found!');
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
                hourlyRate: parseFloat(document.getElementById('studentRate').value) || 0
            };
            
            console.log('📄 Student data from form:', studentData);
            
            // Validate required fields
            if (!studentData.name) {
                alert('Student name is required!');
                document.getElementById('studentName').focus();
                return;
            }
            
            if (!studentData.studentId) {
                alert('Student ID is required!');
                document.getElementById('studentId').focus();
                return;
            }
            
            if (!studentData.gender) {
                alert('Gender is required!');
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
                hourlyRate: studentData.hourlyRate,
                // Add timestamp
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            console.log('📊 Data for Firebase:', firebaseData);
            
            // Add student to Firebase
            console.log('☁️ Adding student to Firebase...');
            const success = await this.dataManager.addStudent(firebaseData);
            
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
                this.loadStudents();
                
                // Update reports
                if (window.reportManager) {
                    window.reportManager.loadDataInBackground();
                }
                
                // Update UI stats
                this.updateStudentStats();
                
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
            const students = await this.dataManager.getAllStudents();
            console.log(`✅ Loaded ${students.length} students`);
            
            // Update student count
            const studentCount = document.getElementById('studentCount');
            if (studentCount) {
                studentCount.textContent = students.length;
            }
            
            // Update average rate
            const averageRate = document.getElementById('averageRate');
            if (averageRate && students.length > 0) {
                const totalRate = students.reduce((sum, student) => sum + (student.hourlyRate || 0), 0);
                const avgRate = totalRate / students.length;
                averageRate.textContent = avgRate.toFixed(2);
            }
            
            // Update students table if it exists
            this.updateStudentsTable(students);
            
        } catch (error) {
            console.error('❌ Error loading students:', error);
        }
    }

    updateStudentsTable(students) {
        // Look for students table
        const table = document.querySelector('#studentsTable tbody') || 
                     document.querySelector('.students-table tbody') ||
                     document.querySelector('table tbody');
        
        if (!table) {
            console.log('No students table found to update');
            return;
        }
        
        table.innerHTML = '';
        
        if (students.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="5" class="empty-message">No students added yet</td>';
            table.appendChild(row);
            return;
        }
        
        students.forEach(student => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.name}</td>
                <td>${student.studentId || ''}</td>
                <td>${student.gender || ''}</td>
                <td>${student.email || ''}</td>
                <td>$${student.hourlyRate || 0}</td>
                <td>
                    <button onclick="editStudent('${student.id}')" class="btn btn-sm btn-outline-primary">Edit</button>
                    <button onclick="deleteStudent('${student.id}')" class="btn btn-sm btn-outline-danger">Delete</button>
                </td>
            `;
            table.appendChild(row);
        });
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
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Add CSS for notifications
const style = document.createElement('style');
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
`;
document.head.appendChild(style);

// Make sure it's globally accessible
window.FormHandler = FormHandler;

// Initialize
console.log('📄 Initializing FormHandler...');
window.formHandler = new FormHandler();
