// ===========================
// GLOBAL VARIABLES
// ===========================

let currentUser = null;
let students = [];
let attendanceRecords = [];
let hoursRecords = [];
let marksRecords = [];

// ===========================
// NOTIFICATION SYSTEM
// ===========================

const NotificationSystem = {
    initNotificationStyles() {
        console.log('🔔 Initializing notification styles...');
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                z-index: 10000;
                max-width: 300px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                transform: translateX(400px);
                transition: transform 0.3s ease;
            }
            .notification.show {
                transform: translateX(0);
            }
            .notification.success { background: #4CAF50; }
            .notification.error { background: #f44336; }
            .notification.warning { background: #ff9800; }
            .notification.info { background: #2196F3; }
        `;
        document.head.appendChild(style);
        console.log('✅ Notification styles initialized');
    },

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
        
        console.log(`🔔 ${type.toUpperCase()}: ${message}`);
    }
};

// ===========================
// THEME MANAGEMENT
// ===========================

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    console.log('🔄 Toggling theme from', currentTheme, 'to', newTheme);
    
    document.documentElement.setAttribute('data-theme', newTheme);
    document.body.className = newTheme;
    localStorage.setItem('worklog-theme', newTheme);
    
    updateThemeButton();
    animateThemeButton();
}

function updateThemeButton() {
    const themeButton = document.querySelector('.theme-toggle button');
    if (!themeButton) return;
    
    themeButton.innerHTML = '🌓';
    themeButton.setAttribute('title', 'Toggle theme');
}

function animateThemeButton() {
    const themeButton = document.querySelector('.theme-toggle button');
    if (!themeButton) return;
    
    themeButton.style.transform = 'rotate(180deg)';
    themeButton.style.transition = 'transform 0.5s ease';
    
    setTimeout(() => {
        themeButton.style.transform = 'rotate(0deg)';
    }, 500);
}

function setupThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle button');
    if (themeToggle) {
        console.log('🎯 Found theme toggle button');
        
        themeToggle.innerHTML = '🌓';
        themeToggle.setAttribute('title', 'Toggle theme');
        
        themeToggle.style.cssText = `
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 1.2em;
            transition: all 0.3s ease;
        `;
        
        themeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎨 Theme button clicked');
            toggleTheme();
        });
        
        themeToggle.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
        });
        
        themeToggle.addEventListener('mouseleave', function() {
            if (!this.style.transform.includes('rotate')) {
                this.style.transform = 'scale(1)';
            }
        });
        
        console.log('✅ Theme toggle setup complete');
    } else {
        console.warn('⚠️ Theme toggle button not found');
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('worklog-theme') || 'light';
    console.log('🎨 Initializing theme:', savedTheme);
    
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.className = savedTheme;
    
    setTimeout(() => {
        setupThemeToggle();
    }, 100);
}

// ===========================
// AUTHENTICATION & USER PROFILE - v8 SYNTAX
// ===========================

async function loadUserProfile(userId) {
    console.log('👤 Loading user profile for:', userId);
    
    try {
        // v8 SYNTAX
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('✅ User profile loaded:', userData);
            
            currentUser = { ...userData, uid: userId };
            window.currentUser = currentUser;
            
            updateUserProfileUI(userData);
            return userData;
        } else {
            console.log('⚠️ No user profile found, creating default...');
            const user = auth.currentUser;
            const defaultUserData = {
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                createdAt: new Date(),
                theme: 'dark',
                breakDuration: 30,
                currency: 'USD',
                schoolName: '',
                className: ''
            };
            
            // v8 SYNTAX
            await db.collection('users').doc(userId).set(defaultUserData);
            
            currentUser = { ...defaultUserData, uid: userId };
            window.currentUser = currentUser;
            
            updateUserProfileUI(defaultUserData);
            return defaultUserData;
        }
    } catch (error) {
        console.error('❌ Error loading user profile:', error);
        showNotification('Error loading user profile', 'error');
        throw error;
    }
}

function updateUserProfileUI(userData) {
    console.log('🎨 Updating UI with user profile data...');
    
    const userDisplayElement = document.getElementById('user-display-name');
    if (userDisplayElement && userData.displayName) {
        userDisplayElement.textContent = userData.displayName;
    }
    
    const userEmailElement = document.getElementById('user-email');
    if (userEmailElement && userData.email) {
        userEmailElement.textContent = userData.email;
    }
    
    if (userData.theme) {
        applyTheme(userData.theme);
    }
    
    console.log('✅ UI updated with user profile');
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme;
    localStorage.setItem('worklog-theme', theme);
}

// ===========================
// UI COMPONENTS SETUP
// ===========================

function setupTabNavigation() {
    console.log('🔧 Setting up tab navigation...');
    
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === targetTab) {
                    pane.classList.add('active');
                }
            });
            
            console.log(`📱 Switched to tab: ${targetTab}`);
        });
    });
    
    console.log('✅ Tab navigation setup complete');
}

function setupFormHandlers() {
    console.log('🔧 Setting up form handlers...');
    
    const studentForm = document.getElementById('student-form');
    if (studentForm) {
        studentForm.addEventListener('submit', handleStudentSubmit);
    }
    
    const hoursForm = document.getElementById('hours-form');
    if (hoursForm) {
        hoursForm.addEventListener('submit', handleHoursSubmit);
    }
    
    const marksForm = document.getElementById('marks-form');
    if (marksForm) {
        marksForm.addEventListener('submit', handleMarksSubmit);
    }
    
    const attendanceForm = document.getElementById('attendance-form');
    if (attendanceForm) {
        attendanceForm.addEventListener('submit', handleAttendanceSubmit);
    }
    
    console.log('✅ Form handlers setup complete');
}

function setupProfileModal() {
    console.log('🔧 Setting up profile modal...');
    
    const profileModal = document.getElementById('profile-modal');
    const profileButton = document.getElementById('profile-button');
    const closeProfile = document.getElementById('close-profile');
    const profileForm = document.getElementById('profile-form');
    
    if (profileButton && profileModal) {
        profileButton.addEventListener('click', () => {
            profileModal.style.display = 'block';
            loadProfileData();
        });
    }
    
    if (closeProfile) {
        closeProfile.addEventListener('click', () => {
            profileModal.style.display = 'none';
        });
    }
    
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileSubmit);
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === profileModal) {
            profileModal.style.display = 'none';
        }
    });
    
    console.log('✅ Profile modal setup complete');
}

function setupFloatingAddButton() {
    console.log('🔧 Setting up floating add button...');
    
    const fab = document.getElementById('floating-add-btn');
    const quickAddModal = document.getElementById('quick-add-modal');
    const closeQuickAdd = document.getElementById('close-quick-add');
    
    if (fab && quickAddModal) {
        fab.addEventListener('click', () => {
            quickAddModal.style.display = 'block';
        });
    }
    
    if (closeQuickAdd) {
        closeQuickAdd.addEventListener('click', () => {
            quickAddModal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === quickAddModal) {
            quickAddModal.style.display = 'none';
        }
    });
    
    console.log('✅ Floating add button setup complete');
}

// ===========================
// FORM HANDLERS - v8 SYNTAX
// ===========================

async function handleStudentSubmit(e) {
    e.preventDefault();
    console.log('📝 Handling student form submission...');
    
    try {
        const formData = {
            name: document.getElementById('student-name').value,
            studentId: document.getElementById('student-id').value,
            grade: document.getElementById('student-grade').value,
            parentContact: document.getElementById('parent-contact').value,
            notes: document.getElementById('student-notes').value,
            createdAt: new Date(),
            userId: currentUser.uid
        };
        
        // v8 SYNTAX
        await db.collection('students').add(formData);
        showNotification('Student added successfully!', 'success');
        e.target.reset();
        
        await renderStudents();
        manuallyRefreshStudentDropdowns();
        
    } catch (error) {
        console.error('Error adding student:', error);
        showNotification('Error adding student', 'error');
    }
}

async function handleHoursSubmit(e) {
    e.preventDefault();
    console.log('⏰ Handling hours form submission...');
    
    try {
        const formData = {
            studentId: document.getElementById('hours-student').value,
            date: document.getElementById('hours-date').value,
            subject: document.getElementById('hours-subject').value,
            hours: parseFloat(document.getElementById('hours-worked').value),
            notes: document.getElementById('hours-notes').value,
            createdAt: new Date(),
            userId: currentUser.uid
        };
        
        // v8 SYNTAX
        await db.collection('hours').add(formData);
        showNotification('Hours logged successfully!', 'success');
        e.target.reset();
        
        await renderRecentHoursWithEdit();
        updateHeaderStats();
        
    } catch (error) {
        console.error('Error logging hours:', error);
        showNotification('Error logging hours', 'error');
    }
}

async function handleMarksSubmit(e) {
    e.preventDefault();
    console.log('📊 Handling marks form submission...');
    
    try {
        const formData = {
            studentId: document.getElementById('marks-student').value,
            date: document.getElementById('marks-date').value,
            subject: document.getElementById('marks-subject').value,
            marks: parseInt(document.getElementById('marks-obtained').value),
            totalMarks: parseInt(document.getElementById('total-marks').value),
            notes: document.getElementById('marks-notes').value,
            createdAt: new Date(),
            userId: currentUser.uid
        };
        
        // v8 SYNTAX
        await db.collection('marks').add(formData);
        showNotification('Marks recorded successfully!', 'success');
        e.target.reset();
        
        await renderRecentMarksWithEdit();
        updateHeaderStats();
        
    } catch (error) {
        console.error('Error recording marks:', error);
        showNotification('Error recording marks', 'error');
    }
}

async function handleAttendanceSubmit(e) {
    e.preventDefault();
    console.log('✅ Handling attendance form submission...');
    
    try {
        const formData = {
            studentId: document.getElementById('attendance-student').value,
            date: document.getElementById('attendance-date').value,
            status: document.getElementById('attendance-status').value,
            notes: document.getElementById('attendance-notes').value,
            createdAt: new Date(),
            userId: currentUser.uid
        };
        
        // v8 SYNTAX
        await db.collection('attendance').add(formData);
        showNotification('Attendance recorded successfully!', 'success');
        e.target.reset();
        
        await renderAttendanceRecentWithEdit();
        updateHeaderStats();
        
    } catch (error) {
        console.error('Error recording attendance:', error);
        showNotification('Error recording attendance', 'error');
    }
}

async function handleProfileSubmit(e) {
    e.preventDefault();
    console.log('👤 Handling profile form submission...');
    
    try {
        const profileData = {
            displayName: document.getElementById('profile-display-name').value,
            schoolName: document.getElementById('profile-school').value,
            className: document.getElementById('profile-class').value,
            breakDuration: parseInt(document.getElementById('profile-break-duration').value),
            currency: document.getElementById('profile-currency').value,
            theme: document.getElementById('profile-theme').value,
            updatedAt: new Date()
        };
        
        // v8 SYNTAX
        await db.collection('users').doc(currentUser.uid).set(profileData, { merge: true });
        
        currentUser = { ...currentUser, ...profileData };
        window.currentUser = currentUser;
        
        applyTheme(profileData.theme);
        
        showNotification('Profile updated successfully!', 'success');
        document.getElementById('profile-modal').style.display = 'none';
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Error updating profile', 'error');
    }
}

// ===========================
// DATA RENDERING FUNCTIONS - v8 SYNTAX
// ===========================

async function renderStudents() {
    console.log('👥 Rendering students...');
    
    try {
        // v8 SYNTAX
        const snapshot = await db.collection('students')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const container = document.getElementById('students-container');
        if (container) {
            container.innerHTML = students.map(student => `
                <div class="student-card">
                    <h4>${student.name}</h4>
                    <p>ID: ${student.studentId}</p>
                    <p>Grade: ${student.grade}</p>
                    <p>Contact: ${student.parentContact}</p>
                    <p>Notes: ${student.notes || 'None'}</p>
                </div>
            `).join('');
        }
        
        console.log(`✅ Rendered ${students.length} students`);
    } catch (error) {
        console.error('Error rendering students:', error);
    }
}

async function renderRecentHoursWithEdit() {
    console.log('⏰ Rendering recent hours...');
    
    try {
        // v8 SYNTAX
        const snapshot = await db.collection('hours')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .limit(10)
            .get();
        
        hoursRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const container = document.getElementById('recent-hours-container');
        if (container) {
            container.innerHTML = hoursRecords.map(record => `
                <div class="record-card">
                    <div class="record-info">
                        <strong>${getStudentName(record.studentId)}</strong>
                        <span>${record.date} - ${record.hours}h</span>
                        <small>${record.subject}</small>
                    </div>
                    <div class="record-actions">
                        <button onclick="editHoursRecord('${record.id}')">✏️</button>
                        <button onclick="deleteHoursRecord('${record.id}')">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
        
        console.log(`✅ Rendered ${hoursRecords.length} hours records`);
    } catch (error) {
        console.error('Error rendering hours:', error);
    }
}

async function renderRecentMarksWithEdit() {
    console.log('📊 Rendering recent marks...');
    
    try {
        // v8 SYNTAX
        const snapshot = await db.collection('marks')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .limit(10)
            .get();
        
        marksRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const container = document.getElementById('recent-marks-container');
        if (container) {
            container.innerHTML = marksRecords.map(record => `
                <div class="record-card">
                    <div class="record-info">
                        <strong>${getStudentName(record.studentId)}</strong>
                        <span>${record.date} - ${record.marks}/${record.totalMarks}</span>
                        <small>${record.subject}</small>
                    </div>
                    <div class="record-actions">
                        <button onclick="editMarksRecord('${record.id}')">✏️</button>
                        <button onclick="deleteMarksRecord('${record.id}')">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
        
        console.log(`✅ Rendered ${marksRecords.length} marks records`);
    } catch (error) {
        console.error('Error rendering marks:', error);
    }
}

async function renderAttendanceRecentWithEdit() {
    console.log('✅ Rendering recent attendance...');
    
    try {
        // v8 SYNTAX
        const snapshot = await db.collection('attendance')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .limit(10)
            .get();
        
        attendanceRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const container = document.getElementById('recent-attendance-container');
        if (container) {
            container.innerHTML = attendanceRecords.map(record => `
                <div class="record-card">
                    <div class="record-info">
                        <strong>${getStudentName(record.studentId)}</strong>
                        <span>${record.date} - ${record.status}</span>
                        <small>${record.notes || 'No notes'}</small>
                    </div>
                    <div class="record-actions">
                        <button onclick="editAttendanceRecord('${record.id}')">✏️</button>
                        <button onclick="deleteAttendanceRecord('${record.id}')">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
        
        console.log(`✅ Rendered ${attendanceRecords.length} attendance records`);
    } catch (error) {
        console.error('Error rendering attendance:', error);
    }
}

async function renderOverviewReports() {
    console.log('📈 Rendering overview reports...');
    
    try {
        const totalStudents = students.length;
        const totalHours = hoursRecords.reduce((sum, record) => sum + record.hours, 0);
        const totalMarks = marksRecords.length;
        const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
        const attendanceRate = attendanceRecords.length > 0 ? (presentCount / attendanceRecords.length * 100).toFixed(1) : 0;
        
        updateStatCard('total-students', totalStudents);
        updateStatCard('total-hours', totalHours.toFixed(1));
        updateStatCard('total-marks', totalMarks);
        updateStatCard('attendance-rate', `${attendanceRate}%`);
        
        console.log('✅ Overview reports rendered');
    } catch (error) {
        console.error('Error rendering overview:', error);
    }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

function showNotification(message, type = 'info') {
    NotificationSystem.show(message, type);
}

function updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function getStudentName(studentId) {
    const student = students.find(s => s.id === studentId);
    return student ? student.name : 'Unknown Student';
}

async function loadProfileData() {
    try {
        // v8 SYNTAX
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            document.getElementById('profile-display-name').value = userData.displayName || '';
            document.getElementById('profile-school').value = userData.schoolName || '';
            document.getElementById('profile-class').value = userData.className || '';
            document.getElementById('profile-break-duration').value = userData.breakDuration || 30;
            document.getElementById('profile-currency').value = userData.currency || 'USD';
            
            const themeSelect = document.getElementById('profile-theme');
            if (themeSelect) {
                themeSelect.value = userData.theme || 'dark';
            }
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
        showNotification('Error loading profile data', 'error');
    }
}

function updateHeaderStats() {
    console.log('📊 Updating header stats...');
}

function refreshTimestamp() {
    console.log('🕒 Refreshing timestamp...');
    const now = new Date();
    const timestampElement = document.getElementById('last-updated');
    if (timestampElement) {
        timestampElement.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }
}

// ===========================
// STUDENT DROPDOWN MANAGEMENT - v8 SYNTAX
// ===========================

const StudentDropdownManager = {
    async forceRefresh() {
        console.log('🔄 Force refreshing student dropdowns...');
        await this.populateAllDropdowns();
    },

    async populateAllDropdowns() {
        console.log('📋 Populating all student dropdowns...');
        
        try {
            // v8 SYNTAX
            const snapshot = await db.collection('students')
                .where('userId', '==', currentUser.uid)
                .orderBy('name')
                .get();
            
            students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            this.populateDropdown('hours-student', students);
            this.populateDropdown('marks-student', students);
            this.populateDropdown('attendance-student', students);
            
            console.log(`✅ Populated ${students.length} students into dropdowns`);
        } catch (error) {
            console.error('Error populating dropdowns:', error);
        }
    },

    populateDropdown(dropdownId, studentList) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.innerHTML = '<option value="">Select Student</option>' +
                studentList.map(student => 
                    `<option value="${student.id}">${student.name} (${student.grade})</option>`
                ).join('');
        }
    }
};

function manuallyRefreshStudentDropdowns() {
    console.log('🔄 Manually refreshing student dropdowns...');
    StudentDropdownManager.forceRefresh();
}

// ===========================
// EDIT/DELETE FUNCTIONS (Placeholders)
// ===========================

function editHoursRecord(recordId) {
    console.log('✏️ Editing hours record:', recordId);
    showNotification('Edit functionality coming soon!', 'info');
}

function deleteHoursRecord(recordId) {
    console.log('🗑️ Deleting hours record:', recordId);
    showNotification('Delete functionality coming soon!', 'info');
}

function editMarksRecord(recordId) {
    console.log('✏️ Editing marks record:', recordId);
    showNotification('Edit functionality coming soon!', 'info');
}

function deleteMarksRecord(recordId) {
    console.log('🗑️ Deleting marks record:', recordId);
    showNotification('Delete functionality coming soon!', 'info');
}

function editAttendanceRecord(recordId) {
    console.log('✏️ Editing attendance record:', recordId);
    showNotification('Edit functionality coming soon!', 'info');
}

function deleteAttendanceRecord(recordId) {
    console.log('🗑️ Deleting attendance record:', recordId);
    showNotification('Delete functionality coming soon!', 'info');
}

// ===========================
// CACHE & SYNC SYSTEMS (Placeholders)
// ===========================

const EnhancedCache = {
    loadCachedData() {
        console.log('💾 Loading cached data...');
    }
};

const SyncBar = {
    init() {
        console.log('🔄 Initializing sync bar...');
    }
};

const EnhancedStats = {
    init() {
        console.log('📊 Initializing enhanced stats...');
    }
};

// ===========================
// APP INITIALIZATION - v8 SYNTAX
// ===========================

async function initializeApp() {
    console.log('🚀 Initializing WorkLog App with Firebase v8...');
    
    try {
        NotificationSystem.initNotificationStyles();
        initializeTheme();
        
        // v8 SYNTAX - using global auth variable
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('✅ User authenticated:', user.email);
                
                try {
                    await loadUserProfile(user.uid);
                    EnhancedCache.loadCachedData();
                    
                    setupTabNavigation();
                    setupFormHandlers();
                    setupProfileModal();
                    setupFloatingAddButton();
                    SyncBar.init();
                    EnhancedStats.init();
                    
                    await Promise.all([
                        renderStudents(),
                        renderRecentHoursWithEdit(),
                        renderRecentMarksWithEdit(),
                        renderAttendanceRecentWithEdit(),
                        renderOverviewReports()
                    ]);
                    
                    await StudentDropdownManager.forceRefresh();
                    
                    updateHeaderStats();
                    refreshTimestamp();
                    
                    console.log('✅ App initialization complete');
                    
                } catch (error) {
                    console.error('❌ Error during app initialization:', error);
                    showNotification('Error loading application data', 'error');
                }
                
            } else {
                console.log('❌ No user signed in, redirecting to auth...');
                window.location.href = "auth.html";
            }
        });
        
    } catch (error) {
        console.error('❌ Fatal error initializing app:', error);
        showNotification('Fatal error initializing application', 'error');
    }
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM Content Loaded - Starting app initialization...');
    initializeApp();
});

// Make functions globally available for HTML onclick handlers
window.editHoursRecord = editHoursRecord;
window.deleteHoursRecord = deleteHoursRecord;
window.editMarksRecord = editMarksRecord;
window.deleteMarksRecord = deleteMarksRecord;
window.editAttendanceRecord = editAttendanceRecord;
window.deleteAttendanceRecord = deleteAttendanceRecord;
window.manuallyRefreshStudentDropdowns = manuallyRefreshStudentDropdowns;
