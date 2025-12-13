// app.js - Main application module

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

// Simple toast function without Bootstrap dependency
function showToast(message, type = 'success') {
    // Create a simple notification div
    const notification = document.createElement('div');
    notification.className = `simple-toast ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        ${type === 'success' ? 'background: #28a745;' : 
          type === 'warning' ? 'background: #ffc107; color: #000;' : 
          'background: #dc3545;'}
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ==================== STUDENT MANAGEMENT ====================
function saveDefaultRate() {
    const defaultRateInput = document.getElementById('defaultBaseRate');
    if (!defaultRateInput) {
        alert('Default rate input not found');
        return;
    }
    
    const defaultRate = defaultRateInput.value.trim();
    if (!defaultRate || isNaN(defaultRate) || parseFloat(defaultRate) <= 0) {
        alert('Please enter a valid default rate');
        return;
    }
    
    // Save to localStorage
    localStorage.setItem('defaultHourlyRate', defaultRate);
    
    // Update display
    const currentRateDisplay = document.getElementById('currentDefaultRate');
    if (currentRateDisplay) {
        currentRateDisplay.textContent = parseFloat(defaultRate).toFixed(2);
    }
    
    const currentRateDisplayHours = document.getElementById('currentDefaultRateDisplay');
    if (currentRateDisplayHours) {
        currentRateDisplayHours.textContent = parseFloat(defaultRate).toFixed(2);
    }
    
    alert('Default rate saved successfully!');
}

function applyDefaultRateToAll() {
    const defaultRate = localStorage.getItem('defaultHourlyRate');
    if (!defaultRate || defaultRate === '0') {
        alert('Please set a default rate first');
        return;
    }
    
    if (!confirm('Apply default rate to ALL students? This action cannot be undone.')) {
        return;
    }
    
    // Get all student cards and update their rate
    const studentCards = document.querySelectorAll('.student-card');
    const rate = parseFloat(defaultRate);
    
    studentCards.forEach(card => {
        const rateElement = card.querySelector('.student-rate');
        if (rateElement) {
            rateElement.textContent = `$${rate.toFixed(2)}/session`;
        }
    });
    
    alert(`Default rate ($${rate}/session) applied to all students!`);
}

function clearStudentForm() {
    const form = document.getElementById('studentForm');
    if (form) {
        form.reset();
    }
    
    // Reset button states
    const submitBtn = document.getElementById('studentSubmitBtn');
    const cancelBtn = document.getElementById('studentCancelBtn');
    
    if (submitBtn) {
        submitBtn.textContent = '➕ Add Student';
    }
    
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
    
    console.log('Student form cleared');
}

// ==================== FORM RESET FUNCTIONS ====================
function resetHoursForm() {
    const form = document.getElementById('hoursForm') || document.querySelector('#hours .form-grid form');
    if (form) {
        form.reset();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('workDate');
        if (dateInput) {
            dateInput.value = today;
        }
    }
    
    // Reset button states
    const submitBtn = document.getElementById('logHoursBtn');
    const cancelBtn = document.getElementById('cancelHoursEdit');
    const deleteBtn = document.getElementById('deleteHoursBtn');
    
    if (submitBtn) {
        submitBtn.querySelector('#logHoursText').textContent = '💾 Log Work';
    }
    
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
    
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
    
    console.log('Hours form cleared');
}

function resetMarksForm() {
    const form = document.getElementById('marksForm');
    if (form) {
        form.reset();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('marksDate');
        if (dateInput) {
            dateInput.value = today;
        }
    }
    
    // Reset button states
    const submitBtn = document.getElementById('addMarkBtn');
    const cancelBtn = document.getElementById('cancelMarkBtn');
    const deleteBtn = document.getElementById('deleteMarkBtn');
    
    if (submitBtn) {
        submitBtn.textContent = '➕ Add Mark';
    }
    
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
    
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
    
    console.log('Marks form cleared');
}

function clearAttendanceForm() {
    const form = document.getElementById('attendanceForm');
    if (form) {
        form.reset();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('attendanceDate');
        if (dateInput) {
            dateInput.value = today;
        }
        
        // Uncheck all student checkboxes
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    
    // Reset button states
    const submitBtn = document.getElementById('saveAttendanceBtn');
    const cancelBtn = document.getElementById('cancelAttendanceBtn');
    const deleteBtn = document.getElementById('deleteAttendanceBtn');
    
    if (submitBtn) {
        submitBtn.textContent = '💾 Save Attendance';
    }
    
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
    
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
    
    console.log('Attendance form cleared');
}

function resetPaymentForm() {
    const form = document.querySelector('#payments form');
    if (form) {
        form.reset();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('paymentDate');
        if (dateInput) {
            dateInput.value = today;
        }
    }
    
    // Reset button states
    const submitBtn = document.getElementById('recordPaymentBtn');
    const cancelBtn = document.getElementById('cancelPaymentBtn');
    const deleteBtn = document.getElementById('deletePaymentBtn');
    
    if (submitBtn) {
        submitBtn.textContent = '💾 Record Payment';
    }
    
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
    
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
    
    console.log('Payment form cleared');
}

// ==================== REPORTS FUNCTIONS ====================
function generateReport() {
    alert('Report generation would go here');
    // You would implement actual report generation logic
}

function exportReport() {
    alert('Export report functionality would go here');
}

function printReport() {
    window.print();
}

// ==================== INITIALIZATION ====================
function initializeApp() {
    console.log('📱 Initializing Student Management System...');
    
    // Load saved default rate
    const defaultRate = localStorage.getItem('defaultHourlyRate') || '25.00';
    const defaultRateInput = document.getElementById('defaultBaseRate');
    if (defaultRateInput) {
        defaultRateInput.value = defaultRate;
    }
    
    // Update display
    const currentRateDisplay = document.getElementById('currentDefaultRate');
    if (currentRateDisplay) {
        currentRateDisplay.textContent = parseFloat(defaultRate).toFixed(2);
    }
    
    const currentRateDisplayHours = document.getElementById('currentDefaultRateDisplay');
    if (currentRateDisplayHours) {
        currentRateDisplayHours.textContent = parseFloat(defaultRate).toFixed(2);
    }
    
    // Initialize date inputs with today's date
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
    
    // Setup event listeners for forms
    setupFormListeners();
    
    console.log('✅ App initialized successfully');
}

function setupFormListeners() {
    // Student form submission
    const studentSubmitBtn = document.getElementById('studentSubmitBtn');
    if (studentSubmitBtn) {
        studentSubmitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Student form submitted');
            // Add your student submission logic here
        });
    }
    
    // Hours form - calculate total pay
    const hoursWorkedInput = document.getElementById('hoursWorked');
    const baseRateInput = document.getElementById('baseRate');
    const totalPayDisplay = document.getElementById('totalPay');
    
    function calculateTotalPay() {
        if (hoursWorkedInput && baseRateInput && totalPayDisplay) {
            const hours = parseFloat(hoursWorkedInput.value) || 0;
            const rate = parseFloat(baseRateInput.value) || 0;
            const total = hours * rate;
            totalPayDisplay.textContent = `$${total.toFixed(2)}`;
        }
    }
    
    if (hoursWorkedInput) hoursWorkedInput.addEventListener('input', calculateTotalPay);
    if (baseRateInput) baseRateInput.addEventListener('input', calculateTotalPay);
    
    // Marks form - calculate percentage
    function updateMarksPercentage() {
        const scoreInput = document.getElementById('marksScore');
        const maxInput = document.getElementById('marksMax');
        const percentageInput = document.getElementById('percentage');
        const gradeInput = document.getElementById('grade');
        
        if (scoreInput && maxInput && percentageInput && gradeInput) {
            const score = parseFloat(scoreInput.value) || 0;
            const max = parseFloat(maxInput.value) || 1;
            
            if (max > 0) {
                const percentage = (score / max) * 100;
                percentageInput.value = `${percentage.toFixed(1)}%`;
                
                // Calculate grade
                let grade = 'F';
                if (percentage >= 90) grade = 'A';
                else if (percentage >= 80) grade = 'B';
                else if (percentage >= 70) grade = 'C';
                else if (percentage >= 60) grade = 'D';
                
                gradeInput.value = grade;
            }
        }
    }
    
    const marksScoreInput = document.getElementById('marksScore');
    const marksMaxInput = document.getElementById('marksMax');
    if (marksScoreInput) marksScoreInput.addEventListener('input', updateMarksPercentage);
    if (marksMaxInput) marksMaxInput.addEventListener('input', updateMarksPercentage);
}

// ==================== GLOBAL EXPORTS ====================
// Make functions available globally for onclick handlers
window.saveDefaultRate = saveDefaultRate;
window.applyDefaultRateToAll = applyDefaultRateToAll;
window.clearStudentForm = clearStudentForm;
window.resetHoursForm = resetHoursForm;
window.resetMarksForm = resetMarksForm;
window.clearAttendanceForm = clearAttendanceForm;
window.resetPaymentForm = resetPaymentForm;
window.generateReport = generateReport;
window.exportReport = exportReport;
window.printReport = printReport;
window.formatDateShort = formatDateShort;
window.exportData = exportData;
window.importData = importData;
window.clearAllData = clearAllData;

// ==================== STARTUP ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM fully loaded');
    
    // Check if we're on the main app page (not auth page)
    if (document.querySelector('.tabs-container')) {
        // Initialize the app
        setTimeout(initializeApp, 100);
    }
});
