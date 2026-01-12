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
            
            // ========== ADDED: UPDATE PROFILE STATS ==========
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
            
            // Force update if needed (emergency function)
            if (typeof forceUpdateProfileStats === 'function') {
                setTimeout(() => forceUpdateProfileStats(), 500);
                console.log('✅ Force update scheduled');
            }
            // ========== END ADDED SECTION ==========
            
            // Update global student dropdowns if function exists
            if (typeof refreshStudentDropdowns === 'function') {
                refreshStudentDropdowns();
            }
            
            // Trigger app.js loadStudents if exists
            if (typeof loadStudents === 'function') {
                loadStudents();
            }
            
            // ========== ADDED: DIRECT DOM UPDATES ==========
            // Directly update DOM elements as fallback
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
            // ========== END DIRECT DOM UPDATES ==========
            
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

    // Add this to the FormHandler class after the setupStudentForm method:

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
        const completePaymentData = {
            ...paymentData,
            id: 'payment_' + Date.now(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Show loading
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;
        
        let success = false;
        
        // Try Firebase first
        if (this.useFirebase && this.dataManager && this.dataManager.savePayment) {
            try {
                console.log('☁️ Saving payment to Firebase...');
                success = await this.dataManager.savePayment(completePaymentData);
            } catch (error) {
                console.log('⚠️ Firebase failed:', error.message);
            }
        }
        
        // Fallback to localStorage
        if (!success) {
            console.log('💾 Saving payment to localStorage...');
            success = await this.savePaymentToLocalStorage(completePaymentData);
        }
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        if (success) {
            this.showNotification(`Payment of $${paymentData.paymentAmount} recorded!`, 'success');
            form.reset();
            
            // Reset date to today
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('paymentDate').value = today;
            
            // Refresh payments display
            this.loadPayments();
            
            // Update balances
            this.updatePaymentBalances();
            
        } else {
            this.showNotification('Failed to record payment', 'error');
        }
        
    } catch (error) {
        console.error('❌ Error submitting payment form:', error);
        this.showNotification('Error: ' + error.message, 'error');
    }
}

async savePaymentToLocalStorage(paymentData) {
    try {
        console.log('💾 Saving payment to localStorage...');
        
        // Get existing payments
        const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
        
        // Add payment
        payments.push(paymentData);
        
        // Sort by date (newest first)
        payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
        
        // Save back to localStorage
        localStorage.setItem('worklog_payments', JSON.stringify(payments));
        
        console.log(`✅ Saved ${payments.length} payments to localStorage`);
        return true;
        
    } catch (error) {
        console.error('❌ Error saving payment to localStorage:', error);
        return false;
    }
}

async loadPayments() {
    console.log('📊 Loading payments list...');
    try {
        const payments = await this.getAllPayments();
        console.log(`✅ Loaded ${payments.length} payments`);
        
        // Update payments display
        this.updatePaymentsDisplay(payments);
        
        // Update balances
        this.updatePaymentBalances();
        
    } catch (error) {
        console.error('❌ Error loading payments:', error);
    }
}

async getAllPayments() {
    console.log('💰 Getting all payments...');
    
    // Try DataManager first
    if (this.dataManager && this.dataManager.getAllPayments) {
        try {
            const payments = await this.dataManager.getAllPayments();
            if (payments && payments.length > 0) {
                console.log(`✅ Got ${payments.length} payments from DataManager`);
                return payments;
            }
        } catch (error) {
            console.log('⚠️ DataManager failed, trying localStorage:', error);
        }
    }
    
    // Fallback to localStorage
    try {
        const payments = JSON.parse(localStorage.getItem('worklog_payments') || '[]');
        console.log(`✅ Got ${payments.length} payments from localStorage`);
        return payments;
    } catch (error) {
        console.error('❌ Error getting payments:', error);
        return [];
    }
}

updatePaymentsDisplay(payments) {
    // Look for payments container
    const container = document.getElementById('paymentActivityLog');
    
    if (!container) {
        console.log('No payments container found to update');
        return;
    }
    
    if (payments.length === 0) {
        container.innerHTML = '<p class="empty-message">No recent payment activity</p>';
        return;
    }
    
    // Show recent payments (last 10)
    const recentPayments = payments.slice(0, 10);
    
    container.innerHTML = recentPayments.map(payment => `
        <div class="payment-item" data-id="${payment.id}">
            <div class="payment-header">
                <div>
                    <strong>Payment Received</strong>
                    <div>${this.getStudentName(payment.paymentStudent) || 'Unknown Student'}</div>
                </div>
                <div class="payment-amount success">$${parseFloat(payment.paymentAmount || 0).toFixed(2)}</div>
            </div>
            <div class="payment-meta">
                <span>📅 ${new Date(payment.paymentDate).toLocaleDateString()}</span>
                <span>💳 ${payment.paymentMethod || 'Cash'}</span>
            </div>
            ${payment.paymentNotes ? `<div class="payment-notes">${payment.paymentNotes}</div>` : ''}
        </div>
    `).join('');
}

async updatePaymentBalances() {
    try {
        const students = await this.getAllStudents();
        const hours = await this.getAllHours();
        const payments = await this.getAllPayments();
        
        if (students.length === 0) {
            const balancesContainer = document.getElementById('studentBalancesContainer');
            if (balancesContainer) {
                balancesContainer.innerHTML = '<p class="empty-message">No student data yet</p>';
            }
            return;
        }
        
        // Calculate balances for each student
        const studentBalances = students.map(student => {
            // Get hours for this student
            const studentHours = hours.filter(h => h.hoursStudent === student.id);
            const studentPayments = payments.filter(p => p.paymentStudent === student.id);
            
            // Calculate total earnings from hours
            const hoursEarnings = studentHours.reduce((sum, hour) => {
                const hoursWorked = parseFloat(hour.hoursWorked) || 0;
                const rate = parseFloat(hour.baseRate) || parseFloat(student.rate) || 0;
                return sum + (hoursWorked * rate);
            }, 0);
            
            // Calculate total payments
            const totalPayments = studentPayments.reduce((sum, payment) => {
                return sum + (parseFloat(payment.paymentAmount) || 0);
            }, 0);
            
            const balance = hoursEarnings - totalPayments;
            
            return {
                id: student.id,
                name: student.name,
                owed: balance,
                hoursEarnings: hoursEarnings,
                payments: totalPayments,
                status: balance > 0 ? 'Owes' : balance < 0 ? 'Credit' : 'Paid up'
            };
        });
        
        // Update balances container
        const balancesContainer = document.getElementById('studentBalancesContainer');
        if (balancesContainer) {
            balancesContainer.innerHTML = studentBalances.map(balance => `
                <div class="payment-item">
                    <div class="payment-header">
                        <strong>${balance.name}</strong>
                        <span class="payment-amount ${balance.owed > 0 ? 'warning' : balance.owed < 0 ? 'info' : 'success'}">
                            ${balance.owed > 0 ? `Owes: $${balance.owed.toFixed(2)}` : 
                              balance.owed < 0 ? `Credit: $${Math.abs(balance.owed).toFixed(2)}` : 'Paid up'}
                        </span>
                    </div>
                    <div class="payment-meta">
                        <span>Earned: $${balance.hoursEarnings.toFixed(2)}</span>
                        <span>Paid: $${balance.payments.toFixed(2)}</span>
                    </div>
                </div>
            `).join('');
        }
        
        // Update total owed
        const totalOwed = studentBalances.reduce((sum, balance) => sum + Math.max(0, balance.owed), 0);
        const totalOwedElem = document.getElementById('totalOwed');
        if (totalOwedElem) {
            totalOwedElem.textContent = `$${totalOwed.toFixed(2)}`;
        }
        
        // Update monthly payments
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyPayments = payments.reduce((sum, payment) => {
            const paymentDate = new Date(payment.paymentDate);
            if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
                return sum + (parseFloat(payment.paymentAmount) || 0);
            }
            return sum;
        }, 0);
        
        const monthlyPaymentsElem = document.getElementById('monthlyPayments');
        if (monthlyPaymentsElem) {
            monthlyPaymentsElem.textContent = `$${monthlyPayments.toFixed(2)}`;
        }
        
    } catch (error) {
        console.error('❌ Error updating payment balances:', error);
    }
}

// Helper function to get student name by ID
async getStudentName(studentId) {
    try {
        const students = await this.getAllStudents();
        const student = students.find(s => s.id === studentId);
        return student ? student.name : 'Unknown Student';
    } catch (error) {
        return 'Unknown Student';
    }
}

// Add these methods to get hours data
async getAllHours() {
    console.log('⏱️ Getting all hours...');
    
    // Try DataManager first
    if (this.dataManager && this.dataManager.getAllHours) {
        try {
            const hours = await this.dataManager.getAllHours();
            if (hours && hours.length > 0) {
                console.log(`✅ Got ${hours.length} hours from DataManager`);
                return hours;
            }
        } catch (error) {
            console.log('⚠️ DataManager failed, trying localStorage:', error);
        }
    }
    
    // Fallback to localStorage
    try {
        const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
        console.log(`✅ Got ${hours.length} hours from localStorage`);
        return hours;
    } catch (error) {
        console.error('❌ Error getting hours:', error);
        return [];
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
        
        .form-notification {
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
        }
        
        .form-notification.success { background: #28a745; }
        .form-notification.error { background: #dc3545; }
        .form-notification.info { background: #17a2b8; }
        .form-notification.warning { background: #ffc107; color: #000; }
    `;
    document.head.appendChild(style);
}

// Make sure it's globally accessible
window.FormHandler = FormHandler;

// Initialize when DOM is ready
console.log('📄 Initializing FormHandler...');

// Create global instance
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
        if (!window.formHandler) {
            console.error('FormHandler not available');
            return;
        }
        
        const students = await window.formHandler.getAllStudents();
        const student = students.find(s => s.id === studentId);
        
        if (!student) {
            if (window.formHandler.showNotification) {
                window.formHandler.showNotification('Student not found', 'error');
            }
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
        
        if (window.formHandler.showNotification) {
            window.formHandler.showNotification('Editing student: ' + student.name, 'info');
        }
        
        // Scroll to form
        document.getElementById('studentName').focus();
        
    } catch (error) {
        console.error('Error editing student:', error);
        if (window.formHandler && window.formHandler.showNotification) {
            window.formHandler.showNotification('Error editing student', 'error');
        }
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
        
        if (window.formHandler && window.formHandler.showNotification) {
            window.formHandler.showNotification('Student deleted', 'success');
        }
        
        // Refresh UI
        if (window.formHandler && window.formHandler.loadStudents) {
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
        if (window.formHandler && window.formHandler.showNotification) {
            window.formHandler.showNotification('Error deleting student', 'error');
        }
    }

    // ==================== ADD THIS TO THE END OF YOUR FILE ====================

// Add necessary styles for form displays
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('worklog-form-styles')) {
        const style = document.createElement('style');
        style.id = 'worklog-form-styles';
        style.textContent = `
            /* Basic styling for form elements */
            .attendance-student-item {
                display: flex;
                align-items: center;
                margin: 5px 0;
                padding: 5px;
            }
            
            .attendance-student-item input {
                margin-right: 10px;
            }
            
            .student-card, .attendance-entry, .payment-item, .mark-entry, .hours-entry {
                background: white;
                border: 1px solid #ccc;
                border-radius: 5px;
                padding: 10px;
                margin: 10px 0;
            }
            
            .student-card-header, .attendance-header, .payment-header {
                display: flex;
                justify-content: space-between;
            }
            
            .student-actions {
                display: flex;
                gap: 5px;
            }
            
            .btn-icon {
                background: none;
                border: none;
                cursor: pointer;
            }
            
            .payment-amount {
                font-weight: bold;
            }
            
            .payment-amount.success {
                color: green;
            }
            
            .payment-amount.warning {
                color: orange;
            }
            
            .empty-message {
                text-align: center;
                color: #666;
                font-style: italic;
                padding: 20px;
            }
        `;
        document.head.appendChild(style);
    }
});
};

console.log('✅ FormHandler script loaded');
