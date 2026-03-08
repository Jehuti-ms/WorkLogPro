// form-handler.js - COMPLETE FIXED VERSION
console.log('📝 Loading form-handler.js...');

class FormHandler {
    constructor() {
        console.log('✅ FormHandler constructor called');
        this.dataManager = window.dataManager;
        this.currentUserEmail = null;
        this.useFirebase = true; // Set to false to disable Firebase
        
        // Bind methods to maintain 'this' context
        this.handleStudentSubmit = this.handleStudentSubmit.bind(this);
        this.handleStudentSubmitClick = this.handleStudentSubmitClick.bind(this);
        this.addStudentToLocalStorage = this.addStudentToLocalStorage.bind(this);
        this.getAllStudents = this.getAllStudents.bind(this);
        this.loadStudents = this.loadStudents.bind(this);
        
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
        newBtn.addEventListener('click', this.handleStudentSubmitClick);
        
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

    handleStudentSubmitClick(e) {
        e.preventDefault();
        console.log('🟢 Add Student button clicked!');
        
        const form = document.getElementById('studentForm');
        if (form) {
            this.handleStudentSubmit(form);
        }
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
                rate: parseFloat(document.getElementById('studentRate').value) || 0
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
            
            // Show loading state IMMEDIATELY
            this.showLoadingState(true);
            
            // Prepare data for saving
            const saveData = {
                name: studentData.name,
                studentId: studentData.studentId,
                gender: studentData.gender,
                email: studentData.email || '',
                phone: studentData.phone || '',
                rate: studentData.rate,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            console.log('📊 Data for saving:', saveData);
            
            let success = false;
            let usedFirebase = false;
            
            // TRY 1: Use DataManager/Firebase with timeout (if enabled)
            if (this.useFirebase && this.dataManager && this.dataManager.addStudent) {
                try {
                    console.log('☁️ Trying to add student via DataManager...');
                    usedFirebase = true;
                    
                    // Set a timeout
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Firebase timeout')), 3000);
                    });
                    
                    // Race between Firebase and timeout
                    success = await Promise.race([
                        this.dataManager.addStudent(saveData),
                        timeoutPromise
                    ]);
                    
                    console.log('Firebase result:', success);
                } catch (firebaseError) {
                    console.log('⚠️ Firebase failed:', firebaseError.message);
                    success = false;
                }
            }
            
            // TRY 2: Fallback to localStorage if Firebase fails or is disabled
            if (!success) {
                console.log(usedFirebase ? '💾 Falling back to localStorage...' : '💾 Using localStorage...');
                success = await this.addStudentToLocalStorage(saveData);
            }
            
            // Hide loading state
            this.showLoadingState(false);
            
            if (success) {
                console.log('✅ Student added successfully!');
                
                // Show success message
                const source = usedFirebase ? 'cloud' : 'local';
                this.showNotification(`Student "${studentData.name}" saved to ${source}!`, 'success');
                
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
                
                // Update profile stats in modal
                if (typeof updateProfileStats === 'function') {
                    updateProfileStats();
                    console.log('✅ Profile stats updated');
                }
                
                // Update global stats (header)
                if (typeof updateGlobalStats === 'function') {
                    updateGlobalStats();
                    console.log('✅ Global stats updated');
                }
                
                // Try to refresh all stats if function exists
                if (typeof refreshAllStats === 'function') {
                    refreshAllStats();
                    console.log('✅ All stats refreshed');
                }
                
                // Update global student dropdowns if function exists
                if (typeof refreshStudentDropdowns === 'function') {
                    refreshStudentDropdowns();
                }
                
                // Trigger app.js loadStudents if exists
                if (typeof loadStudents === 'function') {
                    loadStudents();
                }
                
                // Direct DOM updates as fallback
                setTimeout(() => {
                    try {
                        // Get current student count
                        const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
                        const studentCount = students.length;
                        
                        // Calculate average rate
                        let avgRate = 0;
                        if (students.length > 0) {
                            const totalRate = students.reduce((sum, student) => sum + (parseFloat(student.rate) || 0), 0);
                            avgRate = totalRate / students.length;
                        }
                        
                        console.log(`📊 Direct update: ${studentCount} students, avg rate: $${avgRate.toFixed(2)}`);
                        
                        // Update ALL possible student count elements
                        const studentCountIds = [
                            'modalStatStudents', 'statStudents', 
                            'profileStatStudents', 'totalStudentsCount'
                        ];
                        
                        studentCountIds.forEach(id => {
                            const elem = document.getElementById(id);
                            if (elem) {
                                elem.textContent = studentCount;
                                console.log(`✅ Set ${id} = ${studentCount}`);
                            }
                        });
                        
                        // Update ALL possible rate elements
                        const rateIds = ['modalStatRate', 'averageRate', 'profileStatRate'];
                        rateIds.forEach(id => {
                            const elem = document.getElementById(id);
                            if (elem) {
                                elem.textContent = `$${avgRate.toFixed(2)}`;
                                console.log(`✅ Set ${id} = $${avgRate.toFixed(2)}`);
                            }
                        });
                        
                        // Update timestamp
                        const timeElem = document.getElementById('modalStatUpdated');
                        if (timeElem) {
                            timeElem.textContent = new Date().toLocaleTimeString();
                        }
                        
                    } catch (error) {
                        console.error('❌ Error in direct DOM update:', error);
                    }
                }, 100);
                
            } else {
                console.error('❌ Failed to add student');
                this.showNotification('Failed to add student. Please try again.', 'error');
            }
            
        } catch (error) {
            console.error('❌ Error submitting student form:', error);
            
            // Hide loading state
            this.showLoadingState(false);
            
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    showLoadingState(show = true) {
        const submitBtn = document.getElementById('studentSubmitBtn');
        if (!submitBtn) return;
        
        if (show) {
            submitBtn.innerHTML = '<span class="spinner"></span> Saving...';
            submitBtn.disabled = true;
            
            // Add spinner styles if not already present
            if (!document.getElementById('form-spinner-styles')) {
                const style = document.createElement('style');
                style.id = 'form-spinner-styles';
                style.textContent = `
                    .spinner {
                        display: inline-block;
                        width: 16px;
                        height: 16px;
                        border: 2px solid rgba(255,255,255,0.3);
                        border-radius: 50%;
                        border-top-color: white;
                        animation: spin 1s ease-in-out infinite;
                        margin-right: 8px;
                        vertical-align: middle;
                    }
                    
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            const isEditMode = window.editingStudentId ? true : false;
            submitBtn.textContent = isEditMode ? '💾 Update Student' : '➕ Add Student';
            submitBtn.disabled = false;
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
        console.log('📝 Found marks form');
        const form = document.getElementById('marksForm');
        
        if (!form) {
            console.log('⚠️ Marks form not found');
            return;
        }
        
        // Get submit button
        const submitBtn = form.querySelector('button[type="submit"]');
        if (!submitBtn) {
            console.log('⚠️ No submit button found in marks form');
            return;
        }
        
        // Remove existing listener and add new one
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleMarksSubmit(form);
        });
        
        console.log('✅ Marks form handler attached');
    }

    async handleMarksSubmit(form) {
        console.log('📤 Handling marks form submission...');
        
        try {
            // Get form values
            const marksData = {
                marksStudent: document.getElementById('marksStudent').value,
                marksSubject: document.getElementById('marksSubject').value.trim(),
                marksTopic: document.getElementById('marksTopic').value.trim(),
                marksDate: document.getElementById('marksDate').value,
                marksScore: parseFloat(document.getElementById('marksScore').value) || 0,
                marksMax: parseFloat(document.getElementById('marksMax').value) || 100,
                marksNotes: document.getElementById('marksNotes').value.trim()
            };
            
            console.log('📄 Marks data from form:', marksData);
            
            // Validate
            if (!marksData.marksStudent) {
                this.showNotification('Please select a student', 'error');
                return;
            }
            
            if (!marksData.marksSubject) {
                this.showNotification('Subject is required', 'error');
                return;
            }
            
            if (marksData.marksScore <= 0) {
                this.showNotification('Score must be greater than 0', 'error');
                return;
            }
            
            // Calculate percentage and grade
            const percentage = ((marksData.marksScore / marksData.marksMax) * 100).toFixed(1);
            let grade = 'F';
            const percNum = parseFloat(percentage);
            if (percNum >= 90) grade = 'A';
            else if (percNum >= 80) grade = 'B';
            else if (percNum >= 70) grade = 'C';
            else if (percNum >= 60) grade = 'D';
            
            // Complete data object
            const completeMarksData = {
                ...marksData,
                id: 'mark_' + Date.now(),
                percentage: percentage,
                grade: grade,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Show loading
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;
            
            let success = false;
            
            // Try Firebase first
            if (this.useFirebase && this.dataManager && this.dataManager.saveMark) {
                try {
                    console.log('☁️ Saving mark to Firebase...');
                    success = await this.dataManager.saveMark(completeMarksData);
                } catch (error) {
                    console.log('⚠️ Firebase failed:', error.message);
                }
            }
            
            // Fallback to localStorage
            if (!success) {
                console.log('💾 Saving mark to localStorage...');
                success = await this.saveMarkToLocalStorage(completeMarksData);
            }
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            
            if (success) {
                this.showNotification('Mark saved successfully!', 'success');
                form.reset();
                
                // Reset date to today
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('marksDate').value = today;
                
                // Refresh marks display
                this.loadMarks();
                
            } else {
                this.showNotification('Failed to save mark', 'error');
            }
            
        } catch (error) {
            console.error('❌ Error submitting marks form:', error);
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    async saveMarkToLocalStorage(markData) {
        try {
            console.log('💾 Saving mark to localStorage...');
            
            // Get existing marks
            const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
            
            // Add mark
            marks.push(markData);
            
            // Save back to localStorage
            localStorage.setItem('worklog_marks', JSON.stringify(marks));
            
            console.log(`✅ Saved ${marks.length} marks to localStorage`);
            return true;
            
        } catch (error) {
            console.error('❌ Error saving mark to localStorage:', error);
            return false;
        }
    }

    async loadMarks() {
        console.log('📊 Loading marks list...');
        try {
            const marks = await this.getAllMarks();
            console.log(`✅ Loaded ${marks.length} marks`);
            
            // Update marks count
            const marksCount = document.getElementById('marksCount');
            if (marksCount) {
                marksCount.textContent = marks.length;
            }
            
            // Update marks display
            this.updateMarksDisplay(marks);
            
        } catch (error) {
            console.error('❌ Error loading marks:', error);
        }
    }

    async getAllMarks() {
        console.log('📊 Getting all marks...');
        
        // Try DataManager first
        if (this.dataManager && this.dataManager.getAllMarks) {
            try {
                const marks = await this.dataManager.getAllMarks();
                if (marks && marks.length > 0) {
                    console.log(`✅ Got ${marks.length} marks from DataManager`);
                    return marks;
                }
            } catch (error) {
                console.log('⚠️ DataManager failed, trying localStorage:', error);
            }
        }
        
        // Fallback to localStorage
        try {
            const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
            console.log(`✅ Got ${marks.length} marks from localStorage`);
            return marks;
        } catch (error) {
            console.error('❌ Error getting marks:', error);
            return [];
        }
    }

    updateMarksDisplay(marks) {
        // Look for marks container
        const container = document.getElementById('marksContainer');
        
        if (!container) {
            console.log('No marks container found to update');
            return;
        }
        
        if (marks.length === 0) {
            container.innerHTML = '<p class="empty-message">No marks recorded yet</p>';
            return;
        }
        
        // Show recent marks (last 10)
        const recentMarks = marks.slice(-10).reverse();
        
        container.innerHTML = recentMarks.map(mark => `
            <div class="mark-entry" data-id="${mark.id}">
                <div class="mark-header">
                    <div>
                        <strong>${mark.marksSubject || 'Subject'}</strong>
                        <span>${mark.marksTopic || 'Topic'}</span>
                    </div>
                    <div class="hours-total">
                        ${mark.percentage || '0.0'}% (${mark.grade || 'F'})
                    </div>
                </div>
                <div class="hours-details">
                    <span>📅 ${new Date(mark.marksDate).toLocaleDateString()}</span>
                    <span>📊 ${mark.marksScore || 0}/${mark.marksMax || 100}</span>
                    <span>👤 Student ID: ${mark.marksStudent || 'N/A'}</span>
                </div>
                ${mark.marksNotes ? `<div class="muted">Notes: ${mark.marksNotes}</div>` : ''}
            </div>
        `).join('');
    }

    setupAttendanceForm() {
        console.log('✅ Setting up attendance form...');
        const form = document.getElementById('attendanceForm');
        
        if (!form) {
            console.log('⚠️ Attendance form not found');
            return;
        }
        
        // Get submit button
        const submitBtn = form.querySelector('button[type="submit"]');
        if (!submitBtn) {
            console.log('⚠️ No submit button found in attendance form');
            return;
        }
        
        // Remove existing listener and add new one
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleAttendanceSubmit(form);
        });
        
        console.log('✅ Attendance form handler attached');
        
        // Populate student checkboxes
        this.populateAttendanceStudents();
    }

    async handleAttendanceSubmit(form) {
        console.log('📤 Handling attendance form submission...');
        
        try {
            // Get form values
            const attendanceData = {
                attendanceDate: document.getElementById('attendanceDate').value,
                attendanceSubject: document.getElementById('attendanceSubject').value.trim(),
                attendanceTopic: document.getElementById('attendanceTopic').value.trim(),
                attendanceNotes: document.getElementById('attendanceNotes').value.trim()
            };
            
            console.log('📄 Attendance data from form:', attendanceData);
            
            // Validate
            if (!attendanceData.attendanceDate) {
                this.showNotification('Date is required', 'error');
                return;
            }
            
            if (!attendanceData.attendanceSubject) {
                this.showNotification('Subject is required', 'error');
                return;
            }
            
            // Get checked students
            const checkedStudents = Array.from(
                document.querySelectorAll('#attendanceStudents input[type="checkbox"]:checked')
            ).map(cb => cb.value);
            
            if (checkedStudents.length === 0) {
                this.showNotification('Please select at least one student', 'error');
                return;
            }
            
            attendanceData.presentStudents = checkedStudents;
            
            // Complete data object
            const completeAttendanceData = {
                ...attendanceData,
                id: 'attendance_' + Date.now(),
                totalPresent: checkedStudents.length,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Show loading
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;
            
            let success = false;
            
            // Try Firebase first
            if (this.useFirebase && this.dataManager && this.dataManager.saveAttendance) {
                try {
                    console.log('☁️ Saving attendance to Firebase...');
                    success = await this.dataManager.saveAttendance(completeAttendanceData);
                } catch (error) {
                    console.log('⚠️ Firebase failed:', error.message);
                }
            }
            
            // Fallback to localStorage
            if (!success) {
                console.log('💾 Saving attendance to localStorage...');
                success = await this.saveAttendanceToLocalStorage(completeAttendanceData);
            }
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            
            if (success) {
                this.showNotification('Attendance saved successfully!', 'success');
                form.reset();
                
                // Reset date to today and clear checkboxes
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('attendanceDate').value = today;
                
                // Uncheck all checkboxes
                document.querySelectorAll('#attendanceStudents input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                });
                
                // Refresh attendance display
                this.loadAttendance();
                
            } else {
                this.showNotification('Failed to save attendance', 'error');
            }
            
        } catch (error) {
            console.error('❌ Error submitting attendance form:', error);
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    async saveAttendanceToLocalStorage(attendanceData) {
        try {
            console.log('💾 Saving attendance to localStorage...');
            
            // Get existing attendance records
            const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
            
            // Add attendance record
            attendance.push(attendanceData);
            
            // Sort by date (newest first)
            attendance.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
            
            // Save back to localStorage
            localStorage.setItem('worklog_attendance', JSON.stringify(attendance));
            
            console.log(`✅ Saved ${attendance.length} attendance records to localStorage`);
            return true;
            
        } catch (error) {
            console.error('❌ Error saving attendance to localStorage:', error);
            return false;
        }
    }

    async populateAttendanceStudents() {
        const container = document.getElementById('attendanceStudents');
        if (!container) return;
        
        try {
            const students = await this.getAllStudents();
            
            if (students.length === 0) {
                container.innerHTML = '<p class="empty-message">No students registered. Add students first.</p>';
                return;
            }
            
            container.innerHTML = students.map(student => `
                <div class="attendance-student-item">
                    <input type="checkbox" id="attendance_student_${student.id}" value="${student.id}">
                    <label for="attendance_student_${student.id}">
                        ${student.name} (${student.studentId || 'No ID'})
                    </label>
                </div>
            `).join('');
            
            console.log(`✅ Populated ${students.length} students for attendance`);
            
        } catch (error) {
            console.error('❌ Error populating attendance students:', error);
            container.innerHTML = '<p class="error-message">Error loading students</p>';
        }
    }

    async loadAttendance() {
        console.log('📊 Loading attendance list...');
        try {
            const attendance = await this.getAllAttendance();
            console.log(`✅ Loaded ${attendance.length} attendance records`);
            
            // Update attendance count
            const attendanceCount = document.getElementById('attendanceCount');
            if (attendanceCount) {
                attendanceCount.textContent = attendance.length;
            }
            
            // Update last session date
            const lastSessionElem = document.getElementById('lastSessionDate');
            if (lastSessionElem) {
                if (attendance.length > 0) {
                    const latest = attendance[0]; // Already sorted by date
                    lastSessionElem.textContent = new Date(latest.attendanceDate).toLocaleDateString();
                } else {
                    lastSessionElem.textContent = 'Never';
                }
            }
            
            // Update attendance display
            this.updateAttendanceDisplay(attendance);
            
        } catch (error) {
            console.error('❌ Error loading attendance:', error);
        }
    }

    async getAllAttendance() {
        console.log('📊 Getting all attendance records...');
        
        // Try DataManager first
        if (this.dataManager && this.dataManager.getAllAttendance) {
            try {
                const attendance = await this.dataManager.getAllAttendance();
                if (attendance && attendance.length > 0) {
                    console.log(`✅ Got ${attendance.length} attendance records from DataManager`);
                    return attendance;
                }
            } catch (error) {
                console.log('⚠️ DataManager failed, trying localStorage:', error);
            }
        }
        
        // Fallback to localStorage
        try {
            const attendance = JSON.parse(localStorage.getItem('worklog_attendance') || '[]');
            console.log(`✅ Got ${attendance.length} attendance records from localStorage`);
            return attendance;
        } catch (error) {
            console.error('❌ Error getting attendance:', error);
            return [];
        }
    }

    updateAttendanceDisplay(attendance) {
        // Look for attendance container
        const container = document.getElementById('attendanceContainer');
        
        if (!container) {
            console.log('No attendance container found to update');
            return;
        }
        
        if (attendance.length === 0) {
            container.innerHTML = '<p class="empty-message">No attendance records yet</p>';
            return;
        }
        
        // Show recent attendance (last 5)
        const recentAttendance = attendance.slice(0, 5);
        
        container.innerHTML = recentAttendance.map(record => {
            // Get student names for display
            let studentNames = 'No students';
            if (record.presentStudents && record.presentStudents.length > 0) {
                studentNames = record.presentStudents.length + ' students';
            }
            
            return `
                <div class="attendance-entry" data-id="${record.id}">
                    <div class="attendance-header">
                        <div>
                            <strong>${record.attendanceSubject || 'Subject'}</strong>
                            <div>${record.attendanceTopic || 'General Session'}</div>
                        </div>
                        <div>📅 ${new Date(record.attendanceDate).toLocaleDateString()}</div>
                    </div>
                    <div class="hours-details">
                        <span>👥 ${studentNames}</span>
                        ${record.attendanceNotes ? `<div class="muted">Notes: ${record.attendanceNotes}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    setupPaymentForm() {
        console.log('💰 Setting up payment form...');
        const form = document.getElementById('paymentForm');
        
        if (!form) {
            console.log('⚠️ Payment form not found');
            return;
        }
        
        // Get submit button
        const submitBtn = form.querySelector('button[type="submit"]');
        if (!submitBtn) {
            console.log('⚠️ No submit button found in payment form');
            return;
        }
        
        // Remove existing listener and add new one
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handlePaymentSubmit(form);
        });
        
        console.log('✅ Payment form handler attached');
    }

    async handlePaymentSubmit(form) {
        console.log('📤 Handling payment form submission...');
        
        try {
            // Get form values
            const paymentData = {
                paymentStudent: document.getElementById('paymentStudent').value,
                paymentAmount: parseFloat(document.getElementById('paymentAmount').value) || 0,
                paymentDate: document.getElementById('paymentDate').value,
                paymentMethod: document.getElementById('paymentMethod').value,
                paymentNotes: document.getElementById('paymentNotes').value.trim()
            };
            
            console.log('📄 Payment data from form:', paymentData);
            
            // Validate
            if (!paymentData.paymentStudent) {
                this.showNotification('Please select a student', 'error');
                return;
            }
            
            if (paymentData.paymentAmount <= 0) {
                this.showNotification('Payment amount must be greater than 0', 'error');
                return;
            }
            
            if (!paymentData.paymentMethod) {
                this.showNotification('Payment method is required', 'error');
                return;
            }
            
            // Complete data object
            const
