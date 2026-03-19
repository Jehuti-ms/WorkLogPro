// rate-manager.js - PROFESSIONAL VERSION with Event Listeners & Visual Feedback
console.log('💰 Loading RateManager Pro...');

const RateManager = (function() {
    // Private variables
    let currentUser = null;
    let rateKey = 'defaultRate_guest';
    
    // Initialize
    function init() {
        console.log('💰 Initializing RateManager Pro...');
        
        // Check for user
        checkCurrentUser();
        
        // Setup auth listener
        setupAuthListener();
        
        // Setup all event listeners
        setupEventListeners();
        
        // Load rate
        loadDefaultRate();
        
        console.log('✅ RateManager Pro ready');
    }
    
    // Check current user
    function checkCurrentUser() {
        currentUser = firebase.auth().currentUser;
        if (currentUser) {
            const safeEmail = currentUser.email.replace(/[.#$[\]]/g, '_');
            rateKey = `defaultRate_${safeEmail}`;
            updateUserDisplay();
            console.log(`👤 User: ${currentUser.email}, Rate Key: ${rateKey}`);
        } else {
            rateKey = 'defaultRate_guest';
            updateUserDisplay();
            console.log(`👤 Guest user, Rate Key: ${rateKey}`);
        }
    }
    
    // Setup auth listener
    function setupAuthListener() {
        firebase.auth().onAuthStateChanged((user) => {
            console.log('🔄 Auth changed, updating rate key...');
            currentUser = user;
            if (user) {
                const safeEmail = user.email.replace(/[.#$[\]]/g, '_');
                rateKey = `defaultRate_${safeEmail}`;
            } else {
                rateKey = 'defaultRate_guest';
            }
            updateUserDisplay();
            loadDefaultRate();
        });
    }
    
    // Update user display in UI
    function updateUserDisplay() {
        const userDisplay = document.getElementById('currentUserEmail');
        if (userDisplay) {
            userDisplay.textContent = currentUser ? currentUser.email : 'Guest';
        }
    }
    
    // Setup ALL event listeners
    function setupEventListeners() {
        console.log('🔧 Setting up rate button listeners...');
        
        // 1. Save Default Rate Button
        const saveBtn = document.getElementById('saveDefaultRateBtn');
        if (saveBtn) {
            // Remove old listeners
            const newBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newBtn, saveBtn);
            
            // Add new listener
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                saveDefaultRate();
            });
            console.log('✅ Save button listener attached');
        } else {
            console.warn('⚠️ Save button not found');
        }
        
        // 2. Use in Student Form Button
        const useBtn = document.getElementById('useDefaultRateBtn');
        if (useBtn) {
            const newBtn = useBtn.cloneNode(true);
            useBtn.parentNode.replaceChild(newBtn, useBtn);
            
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                useInStudentForm();
            });
            console.log('✅ Use in form button listener attached');
        } else {
            console.warn('⚠️ Use in form button not found');
        }
        
        // 3. Apply to All Students Button
        const applyBtn = document.getElementById('applyRateToAllBtn');
        if (applyBtn) {
            const newBtn = applyBtn.cloneNode(true);
            applyBtn.parentNode.replaceChild(newBtn, applyBtn);
            
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                applyToAllStudents();
            });
            console.log('✅ Apply to all button listener attached');
        } else {
            console.warn('⚠️ Apply to all button not found');
        }
        
        // 4. Rate input change - live preview
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
    
    // Load default rate
    function loadDefaultRate() {
        const rate = localStorage.getItem(rateKey) || 
                    localStorage.getItem('defaultHourlyRate') || 
                    '25.00';
        
        const rateInput = document.getElementById('defaultBaseRate');
        const rateDisplay = document.getElementById('currentDefaultRate');
        const ratePreview = document.getElementById('ratePreview');
        
        if (rateInput) rateInput.value = rate;
        if (rateDisplay) rateDisplay.textContent = parseFloat(rate).toFixed(2);
        if (ratePreview) ratePreview.textContent = `$${parseFloat(rate).toFixed(2)}/hour`;
        
        console.log(`💰 Loaded rate: $${rate} (${rateKey})`);
    }
    
    // Show notification
    function showNotification(message, type = 'info') {
        console.log(`🔔 [${type}] ${message}`);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `rate-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        // Style it
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            font-family: Arial, sans-serif;
            min-width: 250px;
        `;
        
        // Add animation styles if not present
        if (!document.getElementById('rate-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'rate-notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                .rate-notification {
                    transition: all 0.3s ease;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Show button feedback
    function showButtonFeedback(button, originalText, isLoading = true) {
        if (!button) return;
        
        if (isLoading) {
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="spinner"></span> Processing...';
            button.disabled = true;
            
            // Add spinner styles
            if (!document.getElementById('rate-spinner-styles')) {
                const style = document.createElement('style');
                style.id = 'rate-spinner-styles';
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
            button.innerHTML = button.dataset.originalText || originalText;
            button.disabled = false;
        }
    }
    
    // SAVE DEFAULT RATE
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
            rateInput.focus();
            return;
        }
        
        // Show button feedback
        const saveBtn = document.getElementById('saveDefaultRateBtn');
        showButtonFeedback(saveBtn, '💾 Save Default Rate', true);
        
        // Save to user-specific key
        localStorage.setItem(rateKey, rate.toString());
        
        // Save to old keys for compatibility
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
    
    // USE IN STUDENT FORM
    function useInStudentForm() {
        console.log('📝 useInStudentForm called');
        
        // Get current rate
        const rate = localStorage.getItem(rateKey) || 
                    localStorage.getItem('defaultHourlyRate') || 
                    '25.00';
        
        // Find student rate field
        const studentRateField = document.getElementById('studentRate');
        if (!studentRateField) {
            showNotification('Please go to Students tab first', 'error');
            
            // Switch to students tab
            const studentsTab = document.querySelector('.tab[data-tab="students"]');
            if (studentsTab) studentsTab.click();
            
            // Try again after tab switch
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
        
        // Set the value
        studentRateField.value = rate;
        
        // Visual feedback - highlight the field
        studentRateField.style.border = '2px solid #4CAF50';
        studentRateField.style.transition = 'border 0.5s ease';
        setTimeout(() => studentRateField.style.border = '', 1000);
        
        // Show feedback on button
        const useBtn = document.getElementById('useDefaultRateBtn');
        showButtonFeedback(useBtn, '📝 Use in Student Form', true);
        setTimeout(() => showButtonFeedback(useBtn, '📝 Use in Student Form', false), 500);
        
        showNotification(`💰 Rate $${rate} applied to student form`, 'success');
        console.log(`✅ Applied rate $${rate} to student form`);
    }
    
    // APPLY TO ALL STUDENTS
    async function applyToAllStudents() {
        console.log('🔄 applyToAllStudents called');
        
        // Get current rate
        const rate = parseFloat(localStorage.getItem(rateKey) || 
                                localStorage.getItem('defaultHourlyRate') || 
                                '25.00');
        
        // Confirm with styled dialog
        const studentCount = JSON.parse(localStorage.getItem('worklog_students') || '[]').length;
        
        if (!confirm(`⚠️ Update ALL ${studentCount} students with rate $${rate.toFixed(2)}/hour?\n\nThis will overwrite their individual rates.`)) {
            return;
        }
        
        // Show loading on button
        const applyBtn = document.getElementById('applyRateToAllBtn');
        showButtonFeedback(applyBtn, '🔄 Apply to All Students', true);
        
        try {
            // Get students from localStorage
            let students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
            
            if (students.length === 0) {
                showNotification('No students found', 'warning');
                return;
            }
            
            console.log(`📊 Updating ${students.length} students to $${rate.toFixed(2)}...`);
            
            // Update each student
            let updated = 0;
            students.forEach(student => {
                const oldRate = student.rate || student.hourlyRate || 0;
                console.log(`  ${student.name}: $${oldRate} → $${rate}`);
                
                student.rate = rate;
                student.hourlyRate = rate;
                student.updatedAt = new Date().toISOString();
                if (currentUser) {
                    student.updatedBy = currentUser.email;
                }
                updated++;
            });
            
            // Save to localStorage
            localStorage.setItem('worklog_students', JSON.stringify(students));
            console.log(`✅ Saved ${updated} students to localStorage`);
            
            // Update UI
            if (window.dataManager) {
                window.dataManager.students = students;
                window.dataManager.syncUI();
            }
            
            // Update Firebase if logged in
            if (currentUser) {
                console.log('☁️ Syncing to Firebase...');
                const db = firebase.firestore();
                
                // Update each student in Firebase students collection
                for (const student of students) {
                    try {
                        await db.collection('users').doc(currentUser.uid)
                            .collection('students').doc(student.id)
                            .set({
                                rate: rate,
                                hourlyRate: rate,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                                updatedBy: currentUser.email
                            }, { merge: true });
                    } catch (e) {
                        console.log(`Error updating ${student.name}:`, e);
                    }
                }
                
                // Update consolidated data
                try {
                    await db.collection('users').doc(currentUser.uid)
                        .collection('data').doc('worklog')
                        .set({
                            students: students,
                            lastSync: firebase.firestore.FieldValue.serverTimestamp(),
                            lastSyncClient: new Date().toISOString()
                        }, { merge: true });
                } catch (e) {
                    console.log('Error updating consolidated data:', e);
                }
                
                console.log('✅ Firebase updated');
            }
            
            // Refresh stats
            if (typeof refreshAllStats === 'function') refreshAllStats();
            if (typeof updateGlobalStats === 'function') updateGlobalStats();
            
            showNotification(`✅ Updated ${updated} students to $${rate.toFixed(2)}/hour`, 'success');
            
        } catch (error) {
            console.error('❌ Error:', error);
            showNotification('Error: ' + error.message, 'error');
        } finally {
            // Reset button
            setTimeout(() => showButtonFeedback(applyBtn, '🔄 Apply to All Students', false), 500);
        }
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

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RateManager.init());
} else {
    RateManager.init();
}

// Global references for debugging
window.RateManager = RateManager;

console.log('✅ RateManager Pro loaded with event listeners');
