// app.js - Complete Student Management System

// ==================== GLOBAL VARIABLES ====================
let editingStudentId = null;
let editingHoursId = null;
let editingMarksId = null;
let editingAttendanceId = null;
let editingPaymentId = null;
let currentUser = null;

// ==================== UTILITY FUNCTIONS ====================
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateShort(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    const toastId = 'toast-' + Date.now();
    
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}

// ==================== STUDENT MANAGEMENT ====================
function saveDefaultRate() {
    const defaultRateInput = document.getElementById('defaultRate');
    if (!defaultRateInput) {
        showToast('Default rate input not found', 'danger');
        return;
    }
    
    const defaultRate = defaultRateInput.value.trim();
    if (!defaultRate || isNaN(defaultRate) || parseFloat(defaultRate) <= 0) {
        showToast('Please enter a valid default rate', 'warning');
        return;
    }
    
    // Save to localStorage or database
    localStorage.setItem('defaultHourlyRate', defaultRate);
    showToast('Default rate saved successfully!');
    defaultRateInput.value = defaultRate;
}

function applyDefaultRateToAll() {
    const defaultRate = localStorage.getItem('defaultHourlyRate');
    if (!defaultRate || defaultRate === '0') {
        showToast('Please set a default rate first', 'warning');
        return;
    }
    
    if (!confirm('Apply default rate to ALL students? This action cannot be undone.')) {
        return;
    }
    
    // Here you would update all students in Firebase
    const rate = parseFloat(defaultRate);
    
    // Simulate database update
    showToast(`Applying default rate ($${rate}/hr) to all students...`, 'info');
    
    // In real implementation:
    // db.collection('students').get().then(snapshot => {
    //     const batch = db.batch();
    //     snapshot.forEach(doc => {
    //         batch.update(doc.ref, { hourlyRate: rate });
    //     });
    //     return batch.commit();
    // }).then(() => {
    //     showToast('Default rate applied to all students!');
    //     loadStudents(); // Refresh the list
    // }).catch(error => {
    //     showToast('Error applying rate: ' + error.message, 'danger');
    // });
}

function clearStudentForm() {
    const form = document.getElementById('studentForm');
    if (form) {
        form.reset();
        
        // Clear additional fields
        const photoInput = document.getElementById('studentPhoto');
        if (photoInput) photoInput.value = '';
        
        const photoPreview = document.getElementById('photoPreview');
        if (photoPreview) {
            photoPreview.innerHTML = '<i class="fas fa-user-circle fa-5x text-muted"></i>';
        }
    }
    
    editingStudentId = null;
    
    const submitBtn = document.getElementById('submitStudentBtn');
    if (submitBtn) {
        submitBtn.textContent = 'Add Student';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
    }
    
    showToast('Form cleared', 'info');
}

function submitStudent() {
    const form = document.getElementById('studentForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const studentData = {
        name: formData.get('studentName'),
        email: formData.get('studentEmail'),
        phone: formData.get('studentPhone'),
        address: formData.get('studentAddress'),
        hourlyRate: parseFloat(formData.get('hourlyRate')) || parseFloat(localStorage.getItem('defaultHourlyRate') || '0'),
        notes: formData.get('studentNotes'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Basic validation
    if (!studentData.name || !studentData.email) {
        showToast('Name and email are required', 'warning');
        return;
    }
    
    const photoFile = formData.get('studentPhoto');
    if (photoFile && photoFile.size > 0) {
        // Handle file upload
        studentData.photoFile = photoFile;
    }
    
    if (editingStudentId) {
        // Update existing student
        updateStudent(editingStudentId, studentData);
    } else {
        // Add new student
        addStudent(studentData);
    }
}

function addStudent(studentData) {
    // Firebase implementation
    if (typeof db !== 'undefined') {
        db.collection('students').add(studentData)
            .then((docRef) => {
                showToast('Student added successfully!');
                clearStudentForm();
                loadStudents();
                const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
                if (modal) modal.hide();
            })
            .catch((error) => {
                showToast('Error adding student: ' + error.message, 'danger');
            });
    } else {
        // Fallback to localStorage for demo
        const students = JSON.parse(localStorage.getItem('students') || '[]');
        studentData.id = 'student-' + Date.now();
        students.push(studentData);
        localStorage.setItem('students', JSON.stringify(students));
        
        showToast('Student added successfully!');
        clearStudentForm();
        loadStudents();
        const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
        if (modal) modal.hide();
    }
}

function updateStudent(studentId, studentData) {
    // Firebase implementation
    if (typeof db !== 'undefined') {
        db.collection('students').doc(studentId).update(studentData)
            .then(() => {
                showToast('Student updated successfully!');
                clearStudentForm();
                loadStudents();
                const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
                if (modal) modal.hide();
            })
            .catch((error) => {
                showToast('Error updating student: ' + error.message, 'danger');
            });
    } else {
        // Fallback to localStorage for demo
        const students = JSON.parse(localStorage.getItem('students') || '[]');
        const index = students.findIndex(s => s.id === studentId);
        if (index !== -1) {
            students[index] = { ...students[index], ...studentData };
            localStorage.setItem('students', JSON.stringify(students));
            
            showToast('Student updated successfully!');
            clearStudentForm();
            loadStudents();
            const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
            if (modal) modal.hide();
        }
    }
}

function editStudent(studentId) {
    if (typeof db !== 'undefined') {
        db.collection('students').doc(studentId).get()
            .then((doc) => {
                if (doc.exists) {
                    const student = doc.data();
                    populateStudentForm(student, studentId);
                }
            })
            .catch((error) => {
                showToast('Error loading student: ' + error.message, 'danger');
            });
    } else {
        const students = JSON.parse(localStorage.getItem('students') || '[]');
        const student = students.find(s => s.id === studentId);
        if (student) {
            populateStudentForm(student, studentId);
        }
    }
}

function populateStudentForm(student, studentId) {
    editingStudentId = studentId;
    
    // Populate form fields
    document.getElementById('studentName').value = student.name || '';
    document.getElementById('studentEmail').value = student.email || '';
    document.getElementById('studentPhone').value = student.phone || '';
    document.getElementById('studentAddress').value = student.address || '';
    document.getElementById('hourlyRate').value = student.hourlyRate || localStorage.getItem('defaultHourlyRate') || '';
    document.getElementById('studentNotes').value = student.notes || '';
    
    // Update button
    const submitBtn = document.getElementById('submitStudentBtn');
    if (submitBtn) {
        submitBtn.textContent = 'Update Student';
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-warning');
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('addStudentModal'));
    modal.show();
}

function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student? All associated data will also be deleted.')) {
        return;
    }
    
    if (typeof db !== 'undefined') {
        db.collection('students').doc(studentId).delete()
            .then(() => {
                showToast('Student deleted successfully');
                loadStudents();
            })
            .catch((error) => {
                showToast('Error deleting student: ' + error.message, 'danger');
            });
    } else {
        const students = JSON.parse(localStorage.getItem('students') || '[]');
        const filtered = students.filter(s => s.id !== studentId);
        localStorage.setItem('students', JSON.stringify(filtered));
        showToast('Student deleted successfully');
        loadStudents();
    }
}

function loadStudents() {
    const tbody = document.querySelector('#studentsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';
    
    if (typeof db !== 'undefined') {
        db.collection('students').orderBy('createdAt', 'desc').get()
            .then((snapshot) => {
                if (snapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="8" class="text-center">No students found</td></tr>';
                    return;
                }
                
                let html = '';
                snapshot.forEach((doc) => {
                    const student = doc.data();
                    html += `
                        <tr data-id="${doc.id}">
                            <td>${student.name || 'N/A'}</td>
                            <td>${student.email || 'N/A'}</td>
                            <td>${student.phone || 'N/A'}</td>
                            <td>${student.address || 'N/A'}</td>
                            <td>${formatCurrency(student.hourlyRate || 0)}</td>
                            <td>${formatDate(student.createdAt)}</td>
                            <td>
                                <button class="btn btn-sm btn-warning" onclick="editStudent('${doc.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteStudent('${doc.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
            })
            .catch((error) => {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error: ${error.message}</td></tr>`;
            });
    } else {
        // Fallback to localStorage
        const students = JSON.parse(localStorage.getItem('students') || '[]');
        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No students found</td></tr>';
            return;
        }
        
        let html = '';
        students.forEach((student) => {
            html += `
                <tr data-id="${student.id}">
                    <td>${student.name || 'N/A'}</td>
                    <td>${student.email || 'N/A'}</td>
                    <td>${student.phone || 'N/A'}</td>
                    <td>${student.address || 'N/A'}</td>
                    <td>${formatCurrency(student.hourlyRate || 0)}</td>
                    <td>${formatDate(student.createdAt)}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editStudent('${student.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteStudent('${student.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }
}

function cancelEditStudent() {
    clearStudentForm();
    const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
    if (modal) modal.hide();
}

// ==================== HOURS MANAGEMENT ====================
function resetHoursForm() {
    const form = document.getElementById('hoursForm');
    if (form) {
        form.reset();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('hoursDate');
        if (dateInput) dateInput.value = today;
    }
    
    editingHoursId = null;
    
    const submitBtn = document.getElementById('submitHoursBtn');
    if (submitBtn) {
        submitBtn.textContent = 'Add Hours';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
    }
    
    showToast('Hours form cleared', 'info');
}

function submitHours() {
    const form = document.getElementById('hoursForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const hoursData = {
        studentId: formData.get('hoursStudent'),
        date: formData.get('hoursDate'),
        hours: parseFloat(formData.get('hoursWorked')),
        description: formData.get('hoursDescription'),
        createdAt: new Date().toISOString()
    };
    
    if (!hoursData.studentId || !hoursData.date || !hoursData.hours) {
        showToast('Please fill in all required fields', 'warning');
        return;
    }
    
    if (editingHoursId) {
        updateHours(editingHoursId, hoursData);
    } else {
        addHours(hoursData);
    }
}

function addHours(hoursData) {
    if (typeof db !== 'undefined') {
        db.collection('hours').add(hoursData)
            .then(() => {
                showToast('Hours added successfully!');
                resetHoursForm();
                loadHours();
            })
            .catch((error) => {
                showToast('Error adding hours: ' + error.message, 'danger');
            });
    } else {
        const hours = JSON.parse(localStorage.getItem('hours') || '[]');
        hoursData.id = 'hours-' + Date.now();
        hours.push(hoursData);
        localStorage.setItem('hours', JSON.stringify(hours));
        
        showToast('Hours added successfully!');
        resetHoursForm();
        loadHours();
    }
}

function loadHours() {
    // Implementation similar to loadStudents()
    console.log('Loading hours...');
}

// ==================== MARKS MANAGEMENT ====================
function resetMarksForm() {
    const form = document.getElementById('marksForm');
    if (form) {
        form.reset();
    }
    
    editingMarksId = null;
    
    const submitBtn = document.getElementById('submitMarksBtn');
    if (submitBtn) {
        submitBtn.textContent = 'Add Marks';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
    }
    
    showToast('Marks form cleared', 'info');
}

// ==================== ATTENDANCE MANAGEMENT ====================
function clearAttendanceForm() {
    const form = document.getElementById('attendanceForm');
    if (form) {
        form.reset();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('attendanceDate');
        if (dateInput) dateInput.value = today;
    }
    
    editingAttendanceId = null;
    
    const submitBtn = document.getElementById('submitAttendanceBtn');
    if (submitBtn) {
        submitBtn.textContent = 'Add Attendance';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
    }
    
    showToast('Attendance form cleared', 'info');
}

// ==================== PAYMENTS MANAGEMENT ====================
function resetPaymentForm() {
    const form = document.getElementById('paymentForm');
    if (form) {
        form.reset();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('paymentDate');
        if (dateInput) dateInput.value = today;
    }
    
    editingPaymentId = null;
    
    const submitBtn = document.getElementById('submitPaymentBtn');
    if (submitBtn) {
        submitBtn.textContent = 'Add Payment';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-primary');
    }
    
    showToast('Payment form cleared', 'info');
}

// ==================== REPORTS MANAGEMENT ====================
function generateReport() {
    const reportType = document.getElementById('reportType')?.value;
    const startDate = document.getElementById('reportStartDate')?.value;
    const endDate = document.getElementById('reportEndDate')?.value;
    
    if (!reportType) {
        showToast('Please select a report type', 'warning');
        return;
    }
    
    showToast(`Generating ${reportType} report...`, 'info');
    
    // Simulate report generation
    setTimeout(() => {
        const reportResults = document.getElementById('reportResults');
        if (reportResults) {
            reportResults.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</h5>
                    </div>
                    <div class="card-body">
                        <p><strong>Period:</strong> ${startDate || 'N/A'} to ${endDate || 'N/A'}</p>
                        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>Status:</strong> Report generated successfully</p>
                        <p class="text-muted">This is a demo report. Actual data would appear here.</p>
                    </div>
                </div>
            `;
        }
        showToast('Report generated successfully!');
    }, 1500);
}

function exportReport() {
    const reportType = document.getElementById('reportType')?.value;
    if (!reportType) {
        showToast('Please generate a report first', 'warning');
        return;
    }
    
    showToast(`Exporting ${reportType} report as CSV...`, 'info');
    
    // Simulate export
    setTimeout(() => {
        // Create a dummy CSV
        const csvContent = "data:text/csv;charset=utf-8,Report Type,Date\n" + 
                          `${reportType},${new Date().toISOString()}`;
        
        // Create download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${reportType}_report_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Report exported successfully!');
    }, 1000);
}

function printReport() {
    const reportResults = document.getElementById('reportResults');
    if (!reportResults || !reportResults.innerHTML.trim()) {
        showToast('Please generate a report first', 'warning');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Report Print</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; }
                    .report-info { margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .footer { margin-top: 30px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <h1>Student Management System Report</h1>
                <div class="report-info">
                    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>User:</strong> ${currentUser?.email || 'N/A'}</p>
                </div>
                ${reportResults.innerHTML}
                <div class="footer">
                    <p>Confidential - For internal use only</p>
                </div>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ==================== INITIALIZATION ====================
function initializeApp() {
    console.log('📱 Initializing Student Management System...');
    
    // Load saved default rate
    const defaultRate = localStorage.getItem('defaultHourlyRate');
    const defaultRateInput = document.getElementById('defaultRate');
    if (defaultRateInput && defaultRate) {
        defaultRateInput.value = defaultRate;
    }
    
    // Load initial data
    loadStudents();
    // loadHours(); // Uncomment when hours functionality is ready
    // loadMarks(); // Uncomment when marks functionality is ready
    
    // Initialize date inputs with today's date
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('✅ App initialized successfully');
}

function setupEventListeners() {
    // Student photo preview
    const photoInput = document.getElementById('studentPhoto');
    if (photoInput) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const preview = document.getElementById('photoPreview');
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<img src="${e.target.result}" class="img-thumbnail" style="max-width: 200px; max-height: 200px;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Report date range
    const reportType = document.getElementById('reportType');
    const dateRangeDiv = document.getElementById('reportDateRange');
    if (reportType && dateRangeDiv) {
        reportType.addEventListener('change', function() {
            if (this.value && this.value !== 'all') {
                dateRangeDiv.style.display = 'block';
            } else {
                dateRangeDiv.style.display = 'none';
            }
        });
    }
}

// ==================== TAB SWITCHING ====================
function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content
    const tabContent = document.getElementById(tabName + 'Tab');
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Activate selected tab button
    const tabButton = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (tabButton) {
        tabButton.classList.add('active');
    }
    
    // Load data for the tab if needed
    switch(tabName) {
        case 'students':
            loadStudents();
            break;
        case 'hours':
            // loadHours();
            break;
        case 'marks':
            // loadMarks();
            break;
        case 'attendance':
            // loadAttendance();
            break;
        case 'payments':
            // loadPayments();
            break;
    }
}

// ==================== USER MANAGEMENT ====================
function initializeAuth(user) {
    currentUser = user;
    console.log('👤 User authenticated:', user?.email);
    
    // Update UI based on auth state
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement && user) {
        userEmailElement.textContent = user.email;
    }
    
    // Initialize app after auth
    initializeApp();
}

function logout() {
    if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
        firebase.auth().signOut().then(() => {
            window.location.href = 'login.html';
        }).catch((error) => {
            showToast('Error logging out: ' + error.message, 'danger');
        });
    } else {
        window.location.href = 'login.html';
    }
}

// ==================== DOCUMENT READY ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM fully loaded');
    
    // Initialize app after a short delay to ensure Firebase is ready
    setTimeout(() => {
        if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
            initializeAuth(firebase.auth().currentUser);
        } else {
            initializeApp();
        }
    }, 500);
    
    // Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});

// ==================== ERROR HANDLING ====================
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showToast('An error occurred: ' + e.message, 'danger');
});

// ==================== EXPORT FUNCTIONS FOR GLOBAL ACCESS ====================
// Make all functions globally available
window.saveDefaultRate = saveDefaultRate;
window.applyDefaultRateToAll = applyDefaultRateToAll;
window.clearStudentForm = clearStudentForm;
window.submitStudent = submitStudent;
window.editStudent = editStudent;
window.deleteStudent = deleteStudent;
window.cancelEditStudent = cancelEditStudent;
window.resetHoursForm = resetHoursForm;
window.submitHours = submitHours;
window.resetMarksForm = resetMarksForm;
window.clearAttendanceForm = clearAttendanceForm;
window.resetPaymentForm = resetPaymentForm;
window.generateReport = generateReport;
window.exportReport = exportReport;
window.printReport = printReport;
window.switchTab = switchTab;
window.logout = logout;
window.formatDateShort = formatDateShort;
