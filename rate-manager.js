// rate-manager.js - USER-SPECIFIC Default Rate Management
console.log('💰 Loading User-Specific RateManager...');

const RateManager = {
    // Get user-specific rate key
    getRateKey: function() {
        const user = firebase.auth().currentUser;
        if (user && user.email) {
            // Create a safe key from email (replace dots and special chars)
            const safeEmail = user.email.replace(/[.#$[\]]/g, '_');
            return `defaultRate_${safeEmail}`;
        }
        return 'defaultRate_guest'; // Fallback for guest
    },
    
    // Get current user email for display
    getCurrentUserEmail: function() {
        const user = firebase.auth().currentUser;
        return user ? user.email : 'Guest';
    },
    
    // Initialize default rate on page load
    init: function() {
        console.log('💰 Initializing User-Specific RateManager...');
        this.loadDefaultRate();
        this.setupEventListeners();
        this.setupAuthListener();
        
        // Display current user
        this.updateUserDisplay();
    },
    
    // Listen for auth changes
    setupAuthListener: function() {
        firebase.auth().onAuthStateChanged((user) => {
            console.log('👤 Auth changed, reloading rate for:', user?.email);
            this.loadDefaultRate();
            this.updateUserDisplay();
        });
    },
    
    // Update UI to show current user
    updateUserDisplay: function() {
        const email = this.getCurrentUserEmail();
        const userDisplay = document.getElementById('currentUserEmail');
        if (userDisplay) {
            userDisplay.textContent = email;
        }
        
        // Also update any rate labels to show user context
        const rateLabels = document.querySelectorAll('.user-specific-rate');
        rateLabels.forEach(label => {
            label.textContent = `Rates for: ${email}`;
        });
    },
    
    // Load default rate for CURRENT user
    loadDefaultRate: function() {
        const rateKey = this.getRateKey();
        const defaultRate = localStorage.getItem(rateKey) || '25.00';
        
        // Also keep a backup in the old key for migration (optional)
        if (!localStorage.getItem(rateKey) && localStorage.getItem('defaultHourlyRate')) {
            // Migrate old rate to new user-specific key
            const oldRate = localStorage.getItem('defaultHourlyRate');
            localStorage.setItem(rateKey, oldRate);
            console.log(`🔄 Migrated old rate ${oldRate} to user-specific key`);
        }
        
        const defaultRateInput = document.getElementById('defaultBaseRate');
        const currentRateDisplay = document.getElementById('currentDefaultRate');
        
        if (defaultRateInput) {
            defaultRateInput.value = defaultRate;
        }
        
        if (currentRateDisplay) {
            currentRateDisplay.textContent = parseFloat(defaultRate).toFixed(2);
        }
        
        console.log(`✅ Default rate loaded for ${this.getCurrentUserEmail()}: $${defaultRate} (key: ${rateKey})`);
    },
    
    // Setup input event listener
    setupEventListeners: function() {
        const defaultRateInput = document.getElementById('defaultBaseRate');
        if (defaultRateInput) {
            defaultRateInput.addEventListener('input', function() {
                const rate = parseFloat(this.value) || 0;
                const currentRateDisplay = document.getElementById('currentDefaultRate');
                if (currentRateDisplay) {
                    currentRateDisplay.textContent = rate.toFixed(2);
                }
            });
        }
    },
    
    // Save default rate for CURRENT user
    saveDefaultRate: function() {
        console.log('💰 Saving user-specific default rate...');
        
        const user = firebase.auth().currentUser;
        if (!user) {
            this.showNotification('Please log in to save rates', 'error');
            return false;
        }
        
        const defaultRateInput = document.getElementById('defaultBaseRate');
        if (!defaultRateInput) {
            console.error('Default rate input not found');
            return false;
        }
        
        const rate = parseFloat(defaultRateInput.value);
        if (isNaN(rate) || rate < 0) {
            this.showNotification('Please enter a valid rate (positive number)', 'error');
            return false;
        }
        
        // Save to user-specific key
        const rateKey = this.getRateKey();
        localStorage.setItem(rateKey, rate.toString());
        
        // Also save to Firestore for cloud sync
        this.saveRateToFirestore(rate);
        
        // Update display
        const currentRateDisplay = document.getElementById('currentDefaultRate');
        if (currentRateDisplay) {
            currentRateDisplay.textContent = rate.toFixed(2);
        }
        
        this.showNotification(`✅ Default rate set to $${rate.toFixed(2)}/hour for ${user.email}`, 'success');
        console.log(`✅ Default rate saved for ${user.email}: $${rate} (key: ${rateKey})`);
        return true;
    },
    
    // Save rate to Firestore
    saveRateToFirestore: async function(rate) {
        try {
            const user = firebase.auth().currentUser;
            if (!user) return;
            
            const db = firebase.firestore();
            await db.collection('users').doc(user.uid).collection('settings').doc('preferences').set({
                defaultHourlyRate: rate,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: user.email
            }, { merge: true });
            
            console.log('☁️ Rate saved to Firestore');
        } catch (error) {
            console.error('Error saving rate to Firestore:', error);
        }
    },
    
    // Load rate from Firestore
    loadRateFromFirestore: async function() {
        try {
            const user = firebase.auth().currentUser;
            if (!user) return null;
            
            const db = firebase.firestore();
            const doc = await db.collection('users').doc(user.uid).collection('settings').doc('preferences').get();
            
            if (doc.exists && doc.data().defaultHourlyRate) {
                const rate = doc.data().defaultHourlyRate;
                
                // Save to localStorage with user-specific key
                const rateKey = this.getRateKey();
                localStorage.setItem(rateKey, rate.toString());
                
                console.log(`☁️ Loaded rate from Firestore: $${rate}`);
                return rate;
            }
            return null;
        } catch (error) {
            console.error('Error loading rate from Firestore:', error);
            return null;
        }
    },
    
    // Use default rate in student form
    useDefaultRate: function() {
        console.log('📝 Using default rate in student form...');
        
        const user = firebase.auth().currentUser;
        const rateKey = this.getRateKey();
        const defaultRate = localStorage.getItem(rateKey) || '25.00';
        
        const studentRateField = document.getElementById('studentRate');
        
        if (studentRateField) {
            studentRateField.value = defaultRate;
            this.showNotification(`Default rate $${defaultRate} applied to form for ${user?.email || 'Guest'}`, 'info');
            return true;
        } else {
            console.error('Student rate field not found');
            this.showNotification('Student form not found', 'error');
            return false;
        }
    },
    
    // Apply default rate to all students for CURRENT user
    applyDefaultRateToAll: async function() {
        console.log('🔄 Applying default rate to all students...');
        
        const user = firebase.auth().currentUser;
        if (!user) {
            this.showNotification('Please log in first', 'error');
            return false;
        }
        
        // Confirm with user
        if (!confirm(`Are you sure you want to update ALL students with the default rate for ${user.email}? This will overwrite their individual rates.`)) {
            return false;
        }
        
        const rateKey = this.getRateKey();
        const defaultRate = parseFloat(localStorage.getItem(rateKey) || '25.00');
        
        // Show loading on button
        const btn = document.querySelector('[onclick="RateManager.applyDefaultRateToAll()"], [onclick="applyDefaultRateToAll()"]');
        const originalText = btn?.textContent || 'Apply to All Students';
        if (btn) {
            btn.textContent = '⏳ Updating...';
            btn.disabled = true;
        }
        
        try {
            // Get all students
            let students = [];
            
            // Try from dataManager first
            if (window.dataManager && typeof window.dataManager.getAllStudents === 'function') {
                students = await window.dataManager.getAllStudents();
            } else {
                // Fallback to localStorage
                students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
            }
            
            if (students.length === 0) {
                this.showNotification('No students found to update', 'warning');
                return false;
            }
            
            console.log(`📊 Found ${students.length} students to update for ${user.email}`);
            
            // Update each student's rate
            let updatedCount = 0;
            
            for (const student of students) {
                // Update both rate fields
                student.rate = defaultRate;
                student.hourlyRate = defaultRate;
                student.updatedAt = new Date().toISOString();
                student.updatedBy = user.email; // Track who updated
                
                // If dataManager exists, update in Firebase
                if (window.dataManager && typeof window.dataManager.updateStudent === 'function') {
                    try {
                        await window.dataManager.updateStudent(student.id, {
                            rate: defaultRate,
                            hourlyRate: defaultRate,
                            updatedBy: user.email
                        });
                        updatedCount++;
                    } catch (e) {
                        console.log(`Failed to update ${student.name} in Firebase:`, e);
                    }
                } else {
                    updatedCount++;
                }
            }
            
            // Save to localStorage
            localStorage.setItem('worklog_students', JSON.stringify(students));
            
            // Refresh UI
            if (window.dataManager && typeof window.dataManager.syncUI === 'function') {
                window.dataManager.syncUI();
            }
            
            // Refresh all stats
            if (typeof refreshAllStats === 'function') {
                refreshAllStats();
            }
            
            this.showNotification(`✅ Updated ${updatedCount} students with $${defaultRate.toFixed(2)} rate for ${user.email}`, 'success');
            return true;
            
        } catch (error) {
            console.error('❌ Error applying default rate:', error);
            this.showNotification('Error updating rates: ' + error.message, 'error');
            return false;
        } finally {
            // Restore button
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    },
    
    // Show notification
    showNotification: function(message, type = 'info') {
        if (window.formHandler && typeof window.formHandler.showNotification === 'function') {
            window.formHandler.showNotification(message, type);
            return;
        }
        
        // Fallback notification
        console.log(`🔔 [${type}] ${message}`);
        alert(message); // Simple fallback
    }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RateManager.init());
} else {
    RateManager.init();
}

// Make functions globally available
window.saveDefaultRate = () => RateManager.saveDefaultRate();
window.useDefaultRate = () => RateManager.useDefaultRate();
window.applyDefaultRateToAll = () => RateManager.applyDefaultRateToAll();
window.initDefaultRate = () => RateManager.loadDefaultRate();

console.log('✅ User-Specific RateManager loaded');
