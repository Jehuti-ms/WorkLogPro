// rate-manager.js - FIXED VERSION
console.log('💰 Loading rate-manager.js...');

// Make sure RateManager is globally available
window.RateManager = {
    // Get user-specific rate key
    getRateKey: function() {
        const user = firebase.auth().currentUser;
        if (user && user.email) {
            const safeEmail = user.email.replace(/[.#$[\]]/g, '_');
            return `defaultRate_${safeEmail}`;
        }
        return 'defaultRate_guest';
    },
    
    // Initialize
    init: function() {
        console.log('💰 Initializing RateManager...');
        this.loadDefaultRate();
        this.setupEventListeners();
    },
    
    // Setup input listeners
    setupEventListeners: function() {
        const rateInput = document.getElementById('defaultBaseRate');
        if (rateInput) {
            rateInput.addEventListener('input', () => {
                const rate = parseFloat(rateInput.value) || 0;
                const display = document.getElementById('currentDefaultRate');
                if (display) display.textContent = rate.toFixed(2);
            });
        }
    },
    
    // Load default rate
    loadDefaultRate: function() {
        const rateKey = this.getRateKey();
        const defaultRate = localStorage.getItem(rateKey) || 
                           localStorage.getItem('defaultHourlyRate') || 
                           '25.00';
        
        const rateInput = document.getElementById('defaultBaseRate');
        const rateDisplay = document.getElementById('currentDefaultRate');
        
        if (rateInput) rateInput.value = defaultRate;
        if (rateDisplay) rateDisplay.textContent = parseFloat(defaultRate).toFixed(2);
        
        console.log(`✅ Default rate loaded: $${defaultRate}`);
        return defaultRate;
    },
    
    // SAVE DEFAULT RATE
    saveDefaultRate: function() {
        console.log('💰 Saving default rate...');
        
        const rateInput = document.getElementById('defaultBaseRate');
        if (!rateInput) {
            alert('Rate input not found');
            return false;
        }
        
        const rate = parseFloat(rateInput.value);
        if (isNaN(rate) || rate < 0) {
            alert('Please enter a valid positive rate');
            return false;
        }
        
        // Save to user-specific key
        const rateKey = this.getRateKey();
        localStorage.setItem(rateKey, rate.toString());
        
        // Save to old key for backward compatibility
        localStorage.setItem('defaultHourlyRate', rate.toString());
        localStorage.setItem('defaultRate', rate.toString());
        
        // Update display
        const display = document.getElementById('currentDefaultRate');
        if (display) display.textContent = rate.toFixed(2);
        
        // Show success
        this.showNotification(`✅ Default rate saved: $${rate.toFixed(2)}`, 'success');
        console.log(`✅ Rate saved with key: ${rateKey}`);
        
        return true;
    },
    
    // USE IN STUDENT FORM
    useDefaultRate: function() {
        console.log('📝 Using default rate in student form...');
        
        // Get current rate
        const rateKey = this.getRateKey();
        const rate = localStorage.getItem(rateKey) || 
                    localStorage.getItem('defaultHourlyRate') || 
                    '25.00';
        
        // Find student rate field
        const studentRateField = document.getElementById('studentRate');
        if (!studentRateField) {
            console.error('Student rate field not found');
            alert('Please go to Students tab first');
            return false;
        }
        
        // Set the value
        studentRateField.value = rate;
        
        // Show feedback
        this.showNotification(`💰 Default rate $${rate} applied to form`, 'info');
        console.log(`✅ Applied rate $${rate} to student form`);
        
        return true;
    },
    
    // APPLY TO ALL STUDENTS
    applyDefaultRateToAll: async function() {
        console.log('🔄 Applying default rate to all students...');
        
        // Get current rate
        const rateKey = this.getRateKey();
        const rate = parseFloat(localStorage.getItem(rateKey) || 
                                localStorage.getItem('defaultHourlyRate') || 
                                '25.00');
        
        // Confirm
        if (!confirm(`Update ALL students with rate $${rate.toFixed(2)}/hour?`)) {
            return false;
        }
        
        // Show loading on button
        const btn = document.querySelector('[onclick*="applyDefaultRateToAll"]');
        const originalText = btn ? btn.textContent : 'Apply to All';
        if (btn) {
            btn.textContent = '⏳ Updating...';
            btn.disabled = true;
        }
        
        try {
            // Get students from localStorage
            let students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
            
            if (students.length === 0) {
                this.showNotification('No students found', 'warning');
                return false;
            }
            
            console.log(`📊 Updating ${students.length} students...`);
            
            // Update each student
            let updated = 0;
            students.forEach(student => {
                // Convert old rate if it's a string
                const oldRate = student.rate || student.hourlyRate;
                console.log(`Student ${student.name}: old rate = ${oldRate}, new rate = ${rate}`);
                
                student.rate = rate;
                student.hourlyRate = rate;
                student.updatedAt = new Date().toISOString();
                updated++;
            });
            
            // Save back to localStorage
            localStorage.setItem('worklog_students', JSON.stringify(students));
            console.log(`✅ Saved ${updated} students to localStorage`);
            
            // Update Firebase if dataManager exists
            if (window.dataManager) {
                // Update in-memory array
                window.dataManager.students = students;
                
                // Update UI
                window.dataManager.syncUI();
                
                // Update Firebase if user is logged in
                const user = firebase.auth().currentUser;
                if (user) {
                    console.log('☁️ Syncing to Firebase...');
                    const db = firebase.firestore();
                    
                    // Update each student in Firebase
                    for (const student of students) {
                        try {
                            await db.collection('users').doc(user.uid)
                                .collection('students').doc(student.id)
                                .set({
                                    rate: rate,
                                    hourlyRate: rate,
                                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                                }, { merge: true });
                        } catch (e) {
                            console.log(`Error updating ${student.name}:`, e);
                        }
                    }
                    
                    // Also update consolidated data
                    try {
                        await db.collection('users').doc(user.uid)
                            .collection('data').doc('worklog')
                            .set({
                                students: students,
                                lastSync: firebase.firestore.FieldValue.serverTimestamp()
                            }, { merge: true });
                    } catch (e) {
                        console.log('Error updating consolidated data:', e);
                    }
                }
            }
            
            // Refresh stats
            if (typeof refreshAllStats === 'function') refreshAllStats();
            if (typeof updateGlobalStats === 'function') updateGlobalStats();
            
            this.showNotification(`✅ Updated ${updated} students to $${rate.toFixed(2)}/hour`, 'success');
            
        } catch (error) {
            console.error('❌ Error applying rates:', error);
            this.showNotification('Error: ' + error.message, 'error');
        } finally {
            // Restore button
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    },
    
    // Show notification
    showNotification: function(message, type) {
        if (window.formHandler && window.formHandler.showNotification) {
            window.formHandler.showNotification(message, type);
        } else {
            alert(message);
        }
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RateManager.init());
} else {
    RateManager.init();
}

// Make sure RateManager is defined first
const RateManager = { ... } // Your full RateManager object

// THEN make functions globally available
window.saveDefaultRate = () => RateManager.saveDefaultRate();
window.useDefaultRate = () => RateManager.useDefaultRate();
window.applyDefaultRateToAll = () => RateManager.applyDefaultRateToAll();

console.log('✅ RateManager loaded with working functions');
