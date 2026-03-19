// rate-manager.js - FIXED User-Specific Rate Management
console.log('💰 Loading FIXED RateManager...');

const RateManager = (function() {
    // Private variables
    let currentUser = null;
    let rateKey = 'defaultRate_guest';
    
    // Initialize
    function init() {
        console.log('💰 Initializing FIXED RateManager...');
        
        // Check for user immediately
        checkCurrentUser();
        
        // Setup auth listener
        setupAuthListener();
        
        // Setup event listeners
        setupEventListeners();
        
        // Load rate
        loadDefaultRate();
        
        console.log('✅ FIXED RateManager ready');
    }
    
    // Check current user
    function checkCurrentUser() {
        currentUser = firebase.auth().currentUser;
        if (currentUser && currentUser.email) {
            const safeEmail = currentUser.email.replace(/[.#$[\]]/g, '_');
            rateKey = `defaultRate_${safeEmail}`;
            console.log(`👤 User: ${currentUser.email}, Rate Key: ${rateKey}`);
            
            // CRITICAL: Migrate old rate to new key if needed
            migrateOldRate();
        } else {
            rateKey = 'defaultRate_guest';
            console.log(`👤 Guest user, Rate Key: ${rateKey}`);
        }
        updateUserDisplay();
    }
    
    // CRITICAL: Migrate old rate to user-specific key
    function migrateOldRate() {
        if (!currentUser) return;
        
        const oldRate = localStorage.getItem('defaultHourlyRate');
        const userRate = localStorage.getItem(rateKey);
        
        console.log('🔄 Checking rate migration:', {
            oldRate: oldRate,
            userRate: userRate,
            rateKey: rateKey
        });
        
        // If user-specific rate doesn't exist but old rate does, migrate it
        if (!userRate && oldRate) {
            console.log(`🔄 Migrating old rate ${oldRate} to ${rateKey}`);
            localStorage.setItem(rateKey, oldRate);
            showNotification(`💰 Migrated your rate: $${oldRate}`, 'info');
        }
        
        // If NEITHER exists, set a default
        if (!userRate && !oldRate) {
            console.log('📝 No rate found, setting default 25.00');
            localStorage.setItem(rateKey, '25.00');
            localStorage.setItem('defaultHourlyRate', '25.00');
        }
    }
    
    // Setup auth listener
    function setupAuthListener() {
        firebase.auth().onAuthStateChanged((user) => {
            console.log('🔄 Auth changed, updating rate...');
            currentUser = user;
            
            if (user && user.email) {
                const safeEmail = user.email.replace(/[.#$[\]]/g, '_');
                rateKey = `defaultRate_${safeEmail}`;
                migrateOldRate(); // Check migration again
            } else {
                rateKey = 'defaultRate_guest';
            }
            
            updateUserDisplay();
            loadDefaultRate();
        });
    }
    
    // Update user display
    function updateUserDisplay() {
        const userDisplay = document.getElementById('currentUserEmail');
        if (userDisplay) {
            userDisplay.textContent = currentUser ? currentUser.email : 'Guest';
        }
    }
    
    // Setup event listeners
    function setupEventListeners() {
        console.log('🔧 Setting up rate button listeners...');
        
        // Save button
        const saveBtn = document.getElementById('saveDefaultRateBtn');
        if (saveBtn) {
            const newBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newBtn, saveBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                saveDefaultRate();
            });
        }
        
        // Use in form button
        const useBtn = document.getElementById('useDefaultRateBtn');
        if (useBtn) {
            const newBtn = useBtn.cloneNode(true);
            useBtn.parentNode.replaceChild(newBtn, useBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                useInStudentForm();
            });
        }
        
        // Apply to all button
        const applyBtn = document.getElementById('applyRateToAllBtn');
        if (applyBtn) {
            const newBtn = applyBtn.cloneNode(true);
            applyBtn.parentNode.replaceChild(newBtn, applyBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                applyToAllStudents();
            });
        }
        
        // Rate input preview
        const rateInput = document.getElementById('defaultBaseRate');
        if (rateInput) {
            rateInput.addEventListener('input', function() {
                const rate = parseFloat(this.value) || 0;
                const preview = document.getElementById('ratePreview');
                if (preview) {
                    preview.textContent = `$${rate.toFixed(2)}/hour`;
                }
            });
        }
    }
    
    // Load default rate - FIXED VERSION
    function loadDefaultRate() {
        console.log('💰 Loading default rate...');
        
        let rate = '25.00'; // Default fallback
        
        // Try user-specific key first
        if (currentUser) {
            rate = localStorage.getItem(rateKey);
            console.log(`🔍 Looking for rate at ${rateKey}:`, rate);
        }
        
        // If no user-specific rate, try old key
        if (!rate) {
            rate = localStorage.getItem('defaultHourlyRate');
            console.log('🔍 Looking for rate at defaultHourlyRate:', rate);
        }
        
        // If still no rate, use default
        if (!rate) {
            rate = '25.00';
            console.log('📝 No rate found, using default:', rate);
            
            // Save default to user-specific key if logged in
            if (currentUser) {
                localStorage.setItem(rateKey, rate);
                console.log(`💾 Saved default to ${rateKey}`);
            }
        }
        
        // Ensure rate is a string with proper format
        rate = rate.toString();
        
        // Update UI
        const rateInput = document.getElementById('defaultBaseRate');
        const rateDisplay = document.getElementById('currentDefaultRate');
        const ratePreview = document.getElementById('ratePreview');
        
        if (rateInput) rateInput.value = rate;
        if (rateDisplay) rateDisplay.textContent = parseFloat(rate).toFixed(2);
        if (ratePreview) ratePreview.textContent = `$${parseFloat(rate).toFixed(2)}/hour`;
        
        console.log(`✅ Loaded rate: $${rate} (${rateKey})`);
        return rate;
    }
    
    // Save default rate - FIXED VERSION
    function saveDefaultRate() {
        console.log('💰 saveDefaultRate called');
        
        const rateInput = document.getElementById('defaultBaseRate');
        if (!rateInput) {
            showNotification('Rate input not found', 'error');
            return;
        }
        
        const rate = parseFloat(rateInput.value);
        if (isNaN(rate) || rate < 0) {
            showNotification('Please enter a valid positive rate', 'error');
            return;
        }
        
        // Show button feedback
        const saveBtn = document.getElementById('saveDefaultRateBtn');
        showButtonFeedback(saveBtn, '💾 Save Default Rate', true);
        
        // CRITICAL: Save to user-specific key
        if (currentUser) {
            localStorage.setItem(rateKey, rate.toString());
            console.log(`✅ Saved to user key: ${rateKey} = $${rate}`);
        }
        
        // Also save to old key for backward compatibility
        localStorage.setItem('defaultHourlyRate', rate.toString());
        localStorage.setItem('defaultRate', rate.toString());
        
        // Update displays
        const rateDisplay = document.getElementById('currentDefaultRate');
        const ratePreview = document.getElementById('ratePreview');
        
        if (rateDisplay) rateDisplay.textContent = rate.toFixed(2);
        if (ratePreview) ratePreview.textContent = `$${rate.toFixed(2)}/hour`;
        
        // Show success
        showNotification(`✅ Default rate saved: $${rate.toFixed(2)}/hour`, 'success');
        
        // Reset button
        setTimeout(() => showButtonFeedback(saveBtn, '💾 Save Default Rate', false), 500);
        
        // Log for debugging
        console.log(`✅ Rate saved: $${rate} (${rateKey})`);
    }
    
    // Use in student form
    function useInStudentForm() {
        console.log('📝 useInStudentForm called');
        
        // Get current rate from user-specific key
        let rate = '25.00';
        
        if (currentUser) {
            rate = localStorage.getItem(rateKey) || localStorage.getItem('defaultHourlyRate') || '25.00';
        } else {
            rate = localStorage.getItem('defaultHourlyRate') || '25.00';
        }
        
        const studentRateField = document.getElementById('studentRate');
        if (!studentRateField) {
            showNotification('Please go to Students tab first', 'error');
            
            // Switch to students tab
            const studentsTab = document.querySelector('.tab[data-tab="students"]');
            if (studentsTab) studentsTab.click();
            
            setTimeout(() => {
                const field = document.getElementById('studentRate');
                if (field) {
                    field.value = rate;
                    field.style.border = '2px solid #4CAF50';
                    setTimeout(() => field.style.border = '', 1000);
                    showNotification(`💰 Rate $${rate} applied to form`, 'success');
                }
            }, 500);
            return;
        }
        
        studentRateField.value = rate;
        
        // Visual feedback
        studentRateField.style.border = '2px solid #4CAF50';
        setTimeout(() => studentRateField.style.border = '', 1000);
        
        showNotification(`💰 Rate $${rate} applied to student form`, 'success');
        console.log(`✅ Applied rate $${rate} to student form`);
    }
    
    // Apply to all students
    async function applyToAllStudents() {
        console.log('🔄 applyToAllStudents called');
        
        // Get current rate from user-specific key
        let rate = 25;
        if (currentUser) {
            rate = parseFloat(localStorage.getItem(rateKey) || localStorage.getItem('defaultHourlyRate') || '25');
        } else {
            rate = parseFloat(localStorage.getItem('defaultHourlyRate') || '25');
        }
        
        // Confirm
        const studentCount = JSON.parse(localStorage.getItem('worklog_students') || '[]').length;
        if (!confirm(`⚠️ Update ALL ${studentCount} students with rate $${rate.toFixed(2)}/hour?`)) {
            return;
        }
        
        const applyBtn = document.getElementById('applyRateToAllBtn');
        showButtonFeedback(applyBtn, '🔄 Apply to All Students', true);
        
        try {
            let students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
            
            if (students.length === 0) {
                showNotification('No students found', 'warning');
                return;
            }
            
            console.log(`📊 Updating ${students.length} students to $${rate.toFixed(2)}...`);
            
            students.forEach(student => {
                student.rate = rate;
                student.hourlyRate = rate;
                student.updatedAt = new Date().toISOString();
                if (currentUser) {
                    student.updatedBy = currentUser.email;
                }
            });
            
            localStorage.setItem('worklog_students', JSON.stringify(students));
            
            // Update UI
            if (window.dataManager) {
                window.dataManager.students = students;
                window.dataManager.syncUI();
            }
            
            showNotification(`✅ Updated ${students.length} students to $${rate.toFixed(2)}/hour`, 'success');
            
        } catch (error) {
            console.error('❌ Error:', error);
            showNotification('Error: ' + error.message, 'error');
        } finally {
            setTimeout(() => showButtonFeedback(applyBtn, '🔄 Apply to All Students', false), 500);
        }
    }
    
    // Show button feedback
    function showButtonFeedback(button, originalText, isLoading) {
        if (!button) return;
        
        if (isLoading) {
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="spinner"></span> Processing...';
            button.disabled = true;
        } else {
            button.innerHTML = button.dataset.originalText || originalText;
            button.disabled = false;
        }
    }
    
    // Show notification
    function showNotification(message, type) {
        console.log(`🔔 [${type}] ${message}`);
        
        const notification = document.createElement('div');
        notification.className = `rate-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Public API
    return {
        init: init,
        saveDefaultRate: saveDefaultRate,
        useInStudentForm: useInStudentForm,
        applyToAllStudents: applyToAllStudents,
        loadDefaultRate: loadDefaultRate
    };
})();

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RateManager.init());
} else {
    RateManager.init();
}

// Make available globally
window.RateManager = RateManager;
window.saveDefaultRate = () => RateManager.saveDefaultRate();
window.useDefaultRate = () => RateManager.useDefaultRate();
window.applyDefaultRateToAll = () => RateManager.applyDefaultRateToAll();

console.log('✅ FIXED RateManager loaded');
