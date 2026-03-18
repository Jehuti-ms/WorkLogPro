// ==================== RATE MANAGEMENT FUNCTIONS ====================

// Save default rate
window.saveDefaultRate = function() {
    console.log('💰 Saving default rate...');
    
    const defaultRateInput = document.getElementById('defaultBaseRate');
    if (!defaultRateInput) {
        console.error('Default rate input not found');
        return;
    }
    
    const rate = parseFloat(defaultRateInput.value);
    if (isNaN(rate) || rate < 0) {
        alert('Please enter a valid rate (positive number)');
        return;
    }
    
    // Save to localStorage (multiple keys for redundancy)
    localStorage.setItem('defaultHourlyRate', rate.toString());
    localStorage.setItem('defaultRate', rate.toString());
    
    // Update display
    const currentRateDisplay = document.getElementById('currentDefaultRate');
    if (currentRateDisplay) {
        currentRateDisplay.textContent = rate.toFixed(2);
    }
    
    // Show success message
    showNotification(`✅ Default rate set to $${rate.toFixed(2)}/hour`, 'success');
    
    console.log(`✅ Default rate saved: $${rate}`);
};

// Use default rate in student form
window.useDefaultRate = function() {
    console.log('📝 Using default rate in student form...');
    
    const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
    const studentRateField = document.getElementById('studentRate');
    
    if (studentRateField) {
        studentRateField.value = defaultRate;
        showNotification(`Default rate $${defaultRate} applied to form`, 'info');
    } else {
        console.error('Student rate field not found');
    }
};

// Apply default rate to all students
window.applyDefaultRateToAll = async function() {
    console.log('🔄 Applying default rate to all students...');
    
    // Confirm with user
    if (!confirm('Are you sure you want to update ALL students with the default rate? This will overwrite their individual rates.')) {
        return;
    }
    
    const defaultRate = parseFloat(localStorage.getItem('defaultHourlyRate') || '25.00');
    
    // Show loading
    const btn = document.querySelector('button[onclick="applyDefaultRateToAll()"]');
    const originalText = btn?.textContent || 'Apply to All Students';
    if (btn) {
        btn.textContent = '⏳ Updating...';
        btn.disabled = true;
    }
    
    try {
        // Get all students
        let students = [];
        
        // Try from dataManager first
        if (window.dataManager) {
            students = await window.dataManager.getAllStudents();
        } else {
            // Fallback to localStorage
            students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
        }
        
        if (students.length === 0) {
            alert('No students found to update');
            return;
        }
        
        console.log(`📊 Found ${students.length} students to update`);
        
        // Update each student's rate
        let updatedCount = 0;
        
        for (const student of students) {
            // Update both rate fields
            student.rate = defaultRate;
            student.hourlyRate = defaultRate;
            student.updatedAt = new Date().toISOString();
            
            // If dataManager exists, update in Firebase
            if (window.dataManager && window.dataManager.updateStudent) {
                try {
                    await window.dataManager.updateStudent(student.id, {
                        rate: defaultRate,
                        hourlyRate: defaultRate
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
        if (window.dataManager) {
            window.dataManager.syncUI();
        }
        
        // Show success
        showNotification(`✅ Updated ${updatedCount} students with $${defaultRate.toFixed(2)} rate`, 'success');
        
    } catch (error) {
        console.error('❌ Error applying default rate:', error);
        showNotification('Error updating rates: ' + error.message, 'error');
    } finally {
        // Restore button
        if (btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
};

// Initialize default rate on page load
window.initDefaultRate = function() {
    console.log('💰 Initializing default rate...');
    
    const defaultRateInput = document.getElementById('defaultBaseRate');
    const currentRateDisplay = document.getElementById('currentDefaultRate');
    
    // Load saved rate
    const savedRate = localStorage.getItem('defaultHourlyRate') || '25.00';
    
    if (defaultRateInput) {
        defaultRateInput.value = savedRate;
    }
    
    if (currentRateDisplay) {
        currentRateDisplay.textContent = parseFloat(savedRate).toFixed(2);
    }
    
    console.log(`✅ Default rate initialized to $${savedRate}`);
};

// Helper notification function (if not already defined)
function showNotification(message, type = 'info') {
    // Check if formHandler has notification method
    if (window.formHandler && typeof window.formHandler.showNotification === 'function') {
        window.formHandler.showNotification(message, type);
        return;
    }
    
    // Fallback notification
    console.log(`🔔 [${type}] ${message}`);
    
    // Create temporary notification
    const notification = document.createElement('div');
    notification.className = `temp-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 4px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize default rate
    if (typeof window.initDefaultRate === 'function') {
        window.initDefaultRate();
    }
    
    // Add event listener to default rate input to update when changed
    const defaultRateInput = document.getElementById('defaultBaseRate');
    if (defaultRateInput) {
        defaultRateInput.addEventListener('change', function() {
            const rate = parseFloat(this.value);
            if (!isNaN(rate) && rate >= 0) {
                // Preview the rate but don't save until button click
                const currentRateDisplay = document.getElementById('currentDefaultRate');
                if (currentRateDisplay) {
                    currentRateDisplay.textContent = rate.toFixed(2);
                }
            }
        });
    }
});
