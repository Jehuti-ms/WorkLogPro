// reports.js - UPDATED WITH YOUR ACTUAL METHODS
console.log('reports.js loading...');

class ReportManager {
    constructor() {
        console.log('Creating ReportManager instance');
        
        // Get DataManager instance
        this.dataManager = window.dataManager;
        if (!this.dataManager) {
            console.error('DataManager not found! Make sure data-manager.js is loaded first.');
            return;
        }
        
        this.subjects = [];
        this.students = [];
        
        // Store instance globally
        window.reportManager = this;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('Initializing ReportManager...');
        
        try {
            // Load data
            [this.subjects, this.students] = await Promise.all([
                this.dataManager.getAllSubjects(),
                this.dataManager.getAllStudents()
            ]);
            
            console.log(`Loaded ${this.subjects.length} subjects, ${this.students.length} students`);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update stats
            await this.updateOverviewStats();
            
            console.log('ReportManager initialized successfully');
            
        } catch (error) {
            console.error('Error initializing ReportManager:', error);
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Remove any existing onclick handlers first
        const buttons = [
            'weeklyReportBtn',
            'biWeeklyReportBtn', 
            'monthlyReportBtn',
            'subjectReportBtn',
            'claimFormBtn',
            'invoiceBtn',
            'pdfReportBtn',
            'emailReportBtn'
        ];
        
        // Setup each button
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                // Clone and replace to remove old listeners
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                // Add our click handler
                newBtn.addEventListener('click', (e) => this.handleButtonClick(e, btnId));
                console.log(`Listener added to ${btnId}`);
            } else {
                console.warn(`Button ${btnId} not found`);
            }
        });
    }

    handleButtonClick(event, buttonId) {
        console.log(`Button clicked: ${buttonId}`);
        event.preventDefault();
        event.stopPropagation();
        
        switch(buttonId) {
            case 'weeklyReportBtn':
                this.displayReport('weekly');
                break;
            case 'biWeeklyReportBtn':
                this.displayReport('biweekly');
                break;
            case 'monthlyReportBtn':
                this.displayReport('monthly');
                break;
            case 'subjectReportBtn':
                this.showSubjectSelector();
                break;
            case 'claimFormBtn':
                this.showClaimFormOptions();
                break;
            case 'invoiceBtn':
                this.showInvoiceGenerator();
                break;
            case 'pdfReportBtn':
                this.showPDFOptions();
                break;
            case 'emailReportBtn':
                this.showEmailForm();
                break;
        }
    }

    async displayReport(type) {
        console.log(`Generating ${type} report...`);
        
        this.showLoading();
        
        try {
            let report;
            let title;
            
            switch(type) {
                case 'weekly':
                    report = await this.dataManager.generateWeeklyReport();
                    title = '📅 Weekly Report';
                    break;
                case 'biweekly':
                    report = await this.dataManager.generateBiWeeklyReport();
                    title = '📅 Bi-Weekly Report';
                    break;
                case 'monthly':
                    report = await this.dataManager.generateMonthlyReport();
                    title = '📅 Monthly Report';
                    break;
            }
            
            this.showReportContent(report, title);
            
        } catch (error) {
            console.error(`Error generating ${type} report:`, error);
            this.showError(`Failed to generate ${type} report: ${error.message}`);
        }
    }

    async updateOverviewStats() {
        try {
            const logs = await this.dataManager.getAllLogs();
            const students = await this.dataManager.getAllStudents();
            
            const totalHours = logs.reduce((sum, log) => sum + parseFloat(log.duration || 0), 0);
            const totalEarnings = logs.reduce((sum, log) => {
                const student = students.find(s => s.name === log.studentName);
                const rate = student?.hourlyRate || 0;
                return sum + (parseFloat(log.duration || 0) * rate);
            }, 0);
            
            // Update DOM elements
            const updateElement = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            
            updateElement('totalStudentsReport', students.length);
            updateElement('totalHoursReport', totalHours.toFixed(2));
            updateElement('totalEarningsReport', `$${totalEarnings.toFixed(2)}`);
            updateElement('outstandingBalance', `$${totalEarnings.toFixed(2)}`);
            
        } catch (error) {
            console.error('Error updating overview stats:', error);
        }
    }

    // NEW: Clear report method
    clearReport() {
        const reportContent = document.getElementById('report-content');
        if (reportContent) {
            reportContent.innerHTML = '<p class="empty-message">Select a report type to generate.</p>';
            console.log('Report cleared');
        }
    }

    showLoading() {
        this.updateReportContent(`
            <div style="text-align: center; padding: 50px;">
                <div class="spinner"></div>
                <p>Generating report...</p>
            </div>
        `);
    }

    showError(message) {
        this.updateReportContent(`
            <div style="padding: 15px; background: #f8d7da; border-radius: 5px; border: 1px solid #dc3545; color: #721c24;">
                <h4 style="margin-top: 0;">❌ Error</h4>
                <p>${message}</p>
            </div>
        `);
    }

    // UPDATED: Show report content with close button
// Update showReportContent to use the template
showReportContent(report, title) {
    const content = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${report}</pre>`;
    const html = this.createReportTemplate(title, content, true);
    this.updateReportContent(html);
}

    updateReportContent(html) {
        const reportContent = document.getElementById('report-content');
        if (reportContent) {
            reportContent.innerHTML = html;
        } else {
            console.error('Element #report-content not found!');
        }
    }

    // Helper methods
    copyToClipboard() {
        const pre = document.querySelector('#report-content pre');
        if (pre) {
            navigator.clipboard.writeText(pre.textContent).then(() => {
                alert('Report copied to clipboard!');
            });
        }
    }

    printReport() {
        const pre = document.querySelector('#report-content pre');
        if (pre) {
            const printWindow = window.open('', '_blank');
            const title = document.querySelector('#report-content h4')?.textContent || 'Report';
            
            printWindow.document.write(`
                <html>
                <head><title>${title}</title></head>
                <body><pre>${pre.textContent}</pre></body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    }

    saveAsText() {
        const pre = document.querySelector('#report-content pre');
        const title = document.querySelector('#report-content h4')?.textContent || 'Report';
        
        if (pre) {
            const blob = new Blob([pre.textContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            alert('Report saved as text file!');
        }
    }

    // SIMPLIFIED VERSIONS OF OTHER METHODS
   showSubjectSelector() {
    this.clearReport();
    
    let content = '<p>Select or enter a subject:</p>';
    
    if (this.subjects.length === 0) {
        content += '<p style="color: #666; font-style: italic;">No subjects found. Add some activities with subject names.</p>';
    } else {
        content += '<select id="subjectSelect" class="form-input" style="width: 100%; margin-bottom: 15px;">';
        content += '<option value="">Choose a subject...</option>';
        this.subjects.forEach(subject => {
            content += `<option value="${subject}">${subject.charAt(0).toUpperCase() + subject.slice(1)}</option>`;
        });
        content += '</select>';
    }
    
    content += '<input type="text" id="customSubject" class="form-input" placeholder="Or enter custom subject" style="width: 100%; margin-bottom: 15px;">';
    content += '<button onclick="generateSubjectReport()" class="button" style="width: 100%;">Generate Report</button>';
    
    const html = this.createReportTemplate('📚 Subject Report', content, false);
    this.updateReportContent(html);
}
    
   showPDFOptions() {
    this.clearReport();
    
    let content = '<p>Select report type:</p>';
    content += '<div style="margin-bottom: 15px;">';
    content += '<label style="display: block; margin-bottom: 8px;"><input type="radio" name="pdfType" value="weekly" checked> Weekly Report</label>';
    content += '<label style="display: block; margin-bottom: 8px;"><input type="radio" name="pdfType" value="biweekly"> Bi-Weekly Report</label>';
    content += '<label style="display: block; margin-bottom: 8px;"><input type="radio" name="pdfType" value="monthly"> Monthly Report</label>';
    content += '</div>';
    
    content += '<button onclick="generatePDF()" class="button success" style="width: 100%;">📄 Generate PDF</button>';
    
    const html = this.createReportTemplate('PDF Export', content, false);
    this.updateReportContent(html);
}


   showEmailForm() {
    this.clearReport();
    
    let content = '<div style="margin-bottom: 15px;">';
    content += '<label style="display: block; margin-bottom: 5px;">Recipient Email:</label>';
    content += '<input type="email" id="emailTo" class="form-input" placeholder="recipient@example.com" style="width: 100%;">';
    content += '</div>';
    
    content += '<div style="margin-bottom: 15px;">';
    content += '<label style="display: block; margin-bottom: 5px;">Report Type:</label>';
    content += '<select id="emailType" class="form-input" style="width: 100%;">';
    content += '<option value="weekly">Weekly Report</option>';
    content += '<option value="biweekly">Bi-Weekly Report</option>';
    content += '<option value="monthly">Monthly Report</option>';
    content += '</select>';
    content += '</div>';
    
    content += '<button onclick="sendEmail()" class="button info" style="width: 100%;">📧 Send Email</button>';
    
    const html = this.createReportTemplate('Email Report', content, false);
    this.updateReportContent(html);
}

 showClaimFormOptions() {
    this.clearReport();
    
    let content = '<div style="margin-bottom: 15px;">';
    content += '<label style="display: block; margin-bottom: 5px;">Claim Type:</label>';
    content += '<select id="claimType" class="form-input" style="width: 100%;">';
    content += '<option value="weekly">Weekly</option>';
    content += '<option value="biweekly">Bi-Weekly</option>';
    content += '<option value="monthly">Monthly</option>';
    content += '</select>';
    content += '</div>';
    
    content += '<div style="margin-bottom: 15px;">';
    content += '<label style="display: block; margin-bottom: 5px;">Period End Date:</label>';
    content += '<input type="date" id="claimDate" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
    content += '</div>';
    
    content += '<button onclick="generateClaimForm()" class="button warning" style="width: 100%; margin-bottom: 10px;">💰 Generate Claim Form</button>';
    content += '<button onclick="emailClaimForm()" class="button info" style="width: 100%;">📧 Email Claim Form</button>';
    
    const html = this.createReportTemplate('Claim Form', content, false);
    this.updateReportContent(html);
}

showInvoiceGenerator() {
    this.clearReport();
    
    let content = '<div style="margin-bottom: 15px;">';
    content += '<label style="display: block; margin-bottom: 5px;">Select Student:</label>';
    content += '<select id="invoiceStudent" class="form-input" style="width: 100%;">';
    content += '<option value="">Choose a student...</option>';
    
    // Students should be loaded here - check if they exist
    if (this.students && this.students.length > 0) {
        this.students.forEach(student => {
            const rate = student.hourlyRate ? ` ($${student.hourlyRate}/hr)` : '';
            content += `<option value="${student.name}">${student.name}${rate}</option>`;
        });
    } else {
        content += '<option value="" disabled>No students found. Add students first.</option>';
    }
    
    content += '</select>';
    content += '</div>';
    
    content += '<div style="margin-bottom: 15px;">';
    content += '<label style="display: block; margin-bottom: 5px;">Start Date:</label>';
    content += '<input type="date" id="invoiceStart" class="form-input" style="width: 100%;">';
    content += '</div>';
    
    content += '<div style="margin-bottom: 15px;">';
    content += '<label style="display: block; margin-bottom: 5px;">End Date:</label>';
    content += '<input type="date" id="invoiceEnd" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
    content += '</div>';
    
    content += '<button onclick="generateInvoice()" class="button warning" style="width: 100%; margin-bottom: 10px;">🧾 Generate Invoice</button>';
    content += '<button onclick="emailInvoice()" class="button info" style="width: 100%;">📧 Email Invoice</button>';
    
    const html = this.createReportTemplate('Invoice Generator', content, false);
    this.updateReportContent(html);
}

// Add this helper method for consistent report display
createReportTemplate(title, content, showActions = true) {
    let html = '<div class="report-display">';
    
    // Header with close button
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">';
    html += `<h4 style="margin: 0;">${title}</h4>`;
    html += '<button onclick="window.reportManager.clearReport()" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 18px; cursor: pointer; line-height: 1;">×</button>';
    html += '</div>';
    
    // Action buttons (if requested)
    if (showActions) {
        html += '<div style="margin-bottom: 15px; display: flex; gap: 10px;">';
        html += '<button onclick="window.reportManager.copyToClipboard()" class="button small">📋 Copy</button>';
        html += '<button onclick="window.reportManager.printReport()" class="button small">🖨️ Print</button>';
        html += '<button onclick="window.reportManager.saveAsText()" class="button small">💾 Save</button>';
        html += '</div>';
    }
    
    // Content area
    html += '<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; max-height: 400px; overflow-y: auto;">';
    html += content;
    html += '</div>';
    
    // Back button
    html += '<div style="margin-top: 15px; text-align: center;">';
    html += '<button onclick="window.reportManager.clearReport()" class="button small">← Back to Reports</button>';
    html += '</div>';
    
    html += '</div>';
    
    return html;
}

// Global helper functions (keep these outside the class)
window.generateSubjectReport = async function() {
    const select = document.getElementById('subjectSelect');
    const custom = document.getElementById('customSubject');
    
    const subject = select?.value || custom?.value.trim();
    
    if (!subject) {
        alert('Please select or enter a subject');
        return;
    }
    
    if (window.reportManager) {
        window.reportManager.showLoading();
        
        try {
            const report = await window.reportManager.dataManager.generateSubjectReport(subject);
            window.reportManager.showReportContent(report, `📚 ${subject} Report`);
        } catch (error) {
            window.reportManager.showError(`Error generating subject report: ${error.message}`);
        }
    }
};

window.generatePDF = async function() {
    const selected = document.querySelector('input[name="pdfType"]:checked');
    if (!selected || !window.reportManager) return;
    
    window.reportManager.showLoading();
    
    try {
        let report;
        let filename;
        
        switch(selected.value) {
            case 'weekly':
                report = await window.reportManager.dataManager.generateWeeklyReport();
                filename = `Weekly_Report_${new Date().toISOString().slice(0,10)}`;
                break;
            case 'biweekly':
                report = await window.reportManager.dataManager.generateBiWeeklyReport();
                filename = `BiWeekly_Report_${new Date().toISOString().slice(0,10)}`;
                break;
            case 'monthly':
                report = await window.reportManager.dataManager.generateMonthlyReport();
                filename = `Monthly_Report_${new Date().toISOString().slice(0,10)}`;
                break;
        }
        
        // Simple PDF generation
        if (typeof jspdf !== 'undefined') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text(report, 10, 10);
            doc.save(`${filename}.pdf`);
            
            window.reportManager.updateReportContent(`
                <div style="padding: 15px; background: #d1e7dd; border: 1px solid #198754; border-radius: 5px; color: #0f5132;">
                    <h4 style="margin-top: 0;">✅ PDF Generated</h4>
                    <p>File <strong>${filename}.pdf</strong> has been downloaded.</p>
                    <button onclick="window.reportManager.clearReport()" class="button small success">
                        Back to Reports
                    </button>
                </div>
            `);
        } else {
            // Fallback to text
            const blob = new Blob([report], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            
            window.reportManager.updateReportContent(`
                <div style="padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; color: #856404;">
                    <h4 style="margin-top: 0;">⚠️ Text File Downloaded</h4>
                    <p>jsPDF not available. File <strong>${filename}.txt</strong> has been downloaded instead.</p>
                    <button onclick="window.reportManager.clearReport()" class="button small">
                        Back to Reports
                    </button>
                </div>
            `);
        }
        
    } catch (error) {
        window.reportManager.showError(`Error generating PDF: ${error.message}`);
    }
};

window.sendEmail = async function() {
    const to = document.getElementById('emailTo')?.value;
    const type = document.getElementById('emailType')?.value;
    
    if (!to || !type || !window.reportManager) {
        alert('Please fill all fields');
        return;
    }
    
    window.reportManager.showLoading();
    
    try {
        let report;
        let subject;
        
        switch(type) {
            case 'weekly':
                report = await window.reportManager.dataManager.generateWeeklyReport();
                subject = 'Weekly Report';
                break;
            case 'biweekly':
                report = await window.reportManager.dataManager.generateBiWeeklyReport();
                subject = 'Bi-Weekly Report';
                break;
            case 'monthly':
                report = await window.reportManager.dataManager.generateMonthlyReport();
                subject = 'Monthly Report';
                break;
        }
        
        const body = `Hello,\n\nPlease find the attached report:\n\n${report}\n\nBest regards,\nWorkLogPro Team`;
        
        window.open(`mailto:${to}?subject=${encodeURIComponent(`WorkLogPro ${subject}`)}&body=${encodeURIComponent(body)}`, '_blank');
        
        window.reportManager.updateReportContent(`
            <div style="padding: 15px; background: #d1e7dd; border: 1px solid #198754; border-radius: 5px; color: #0f5132;">
                <h4 style="margin-top: 0;">✅ Email Ready</h4>
                <p>Your email client has been opened with the report.</p>
                <button onclick="window.reportManager.clearReport()" class="button small success">
                    Back to Reports
                </button>
            </div>
        `);
        
    } catch (error) {
        window.reportManager.showError(`Error sending email: ${error.message}`);
    }
};

window.generateClaimForm = async function() {
    const type = document.getElementById('claimType')?.value;
    if (!type || !window.reportManager) return;
    
    window.reportManager.showLoading();
    
    try {
        const report = await window.reportManager.dataManager.generateClaimForm(type);
        window.reportManager.showReportContent(report, `💰 ${type.toUpperCase()} Claim Form`);
    } catch (error) {
        window.reportManager.showError(`Error generating claim form: ${error.message}`);
    }
};

window.generateInvoice = async function() {
    const student = document.getElementById('invoiceStudent')?.value;
    if (!student || !window.reportManager) {
        alert('Please select a student');
        return;
    }
    
    window.reportManager.showLoading();
    
    try {
        // Use current month as default period
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const report = await window.reportManager.dataManager.generateInvoice(
            student,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );
        
        window.reportManager.showReportContent(report, `🧾 Invoice for ${student}`);
    } catch (error) {
        window.reportManager.showError(`Error generating invoice: ${error.message}`);
    }
};

// Initialize ReportManager
console.log('Creating ReportManager...');
new ReportManager();
