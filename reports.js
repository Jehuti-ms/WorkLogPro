// reports.js - COMPLETE VERSION WITH ALL FIXES
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
        
        // Initialize
        this.init();
    }

    async init() {
        console.log('Initializing ReportManager...');
        
        try {
            // Setup event listeners first
            this.setupEventListeners();
            
            // Load data in background
            this.loadDataInBackground();
            
            // Update stats
            await this.updateOverviewStats();
            
            console.log('ReportManager initialized successfully');
            
        } catch (error) {
            console.error('Error initializing ReportManager:', error);
        }
    }

    async loadDataInBackground() {
        console.log('Loading data in background...');
        
        try {
            const [subjects, students] = await Promise.all([
                this.dataManager.getAllSubjects(),
                this.dataManager.getAllStudents()
            ]);
            
            this.subjects = subjects;
            this.students = students;
            
            console.log(`✅ Data loaded: ${this.students.length} students, ${this.subjects.length} subjects`);
            
            // Update any open student dropdowns
            this.updateStudentDropdowns();
            
        } catch (error) {
            console.error('Error loading background data:', error);
            // Retry after 3 seconds
            setTimeout(() => this.loadDataInBackground(), 3000);
        }
    }

    updateStudentDropdowns() {
        // Update any existing student dropdowns
        const studentSelects = document.querySelectorAll('select[id*="Student"], select[id*="student"]');
        studentSelects.forEach(select => {
            if (select.options.length <= 1) {
                this.populateStudentDropdown(select);
            }
        });
    }

    populateStudentDropdown(selectElement) {
        // Clear existing options except first
        while (selectElement.options.length > 1) {
            selectElement.remove(1);
        }
        
        // Add student options
        if (this.students && this.students.length > 0) {
            this.students.forEach(student => {
                const rate = student.hourlyRate ? ` ($${student.hourlyRate}/hr)` : '';
                const option = new Option(`${student.name}${rate}`, student.name);
                selectElement.add(option);
            });
        } else {
            const option = new Option('No students found. Add students first.', '', true, true);
            option.disabled = true;
            selectElement.add(option);
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
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
        
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                // Remove any existing listeners
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

    // REPORT DISPLAY METHODS
    createReportTemplate(title, content, showActions = true) {
        let html = '<div class="report-display">';
        
        // Header with close button
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">';
        html += `<h4 style="margin: 0;">${title}</h4>`;
        html += '<button onclick="window.reportManager.clearReport()" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 18px; cursor: pointer; line-height: 1;">×</button>';
        html += '</div>';
        
        // Action buttons
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
            
            const content = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${report}</pre>`;
            const html = this.createReportTemplate(title, content, true);
            this.updateReportContent(html);
            
        } catch (error) {
            console.error(`Error generating ${type} report:`, error);
            this.showError(`Failed to generate ${type} report: ${error.message}`);
        }
    }

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
        
        // Populate with students if available
        if (this.students && this.students.length > 0) {
            this.students.forEach(student => {
                const rate = student.hourlyRate ? ` ($${student.hourlyRate}/hr)` : '';
                content += `<option value="${student.name}">${student.name}${rate}</option>`;
            });
        } else {
            content += '<option value="" disabled>Loading students...</option>';
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

    // HELPER METHODS
    clearReport() {
        const reportContent = document.getElementById('report-content');
        if (reportContent) {
            reportContent.innerHTML = '<p class="empty-message">Select a report type to generate.</p>';
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
        const content = `
            <div style="padding: 15px; background: #f8d7da; border-radius: 5px; border: 1px solid #dc3545; color: #721c24;">
                <h4 style="margin-top: 0;">❌ Error</h4>
                <p>${message}</p>
                <button onclick="window.reportManager.clearReport()" class="button small" style="margin-top: 10px;">
                    Back to Reports
                </button>
            </div>
        `;
        
        const html = this.createReportTemplate('Error', content, false);
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
            const title = document.querySelector('#report-content h4')?.textContent || 'Report';
            const printWindow = window.open('', '_blank');
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
}

// GLOBAL HELPER FUNCTIONS
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
            const content = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${report}</pre>`;
            const html = window.reportManager.createReportTemplate(`📚 ${subject} Report`, content, true);
            window.reportManager.updateReportContent(html);
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
        
        if (typeof jspdf !== 'undefined') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text(report, 10, 10);
            doc.save(`${filename}.pdf`);
            
            const content = `
                <div style="padding: 15px; background: #d1e7dd; border-radius: 5px;">
                    <h4 style="margin-top: 0;">✅ PDF Generated</h4>
                    <p>File <strong>${filename}.pdf</strong> has been downloaded.</p>
                </div>
            `;
            const html = window.reportManager.createReportTemplate('PDF Export', content, false);
            window.reportManager.updateReportContent(html);
        } else {
            const blob = new Blob([report], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            
            const content = `
                <div style="padding: 15px; background: #fff3cd; border-radius: 5px;">
                    <h4 style="margin-top: 0;">⚠️ Text File Downloaded</h4>
                    <p>File <strong>${filename}.txt</strong> has been downloaded instead.</p>
                </div>
            `;
            const html = window.reportManager.createReportTemplate('PDF Export', content, false);
            window.reportManager.updateReportContent(html);
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
        
        const content = `
            <div style="padding: 15px; background: #d1e7dd; border-radius: 5px;">
                <h4 style="margin-top: 0;">✅ Email Ready</h4>
                <p>Your email client has been opened with the report.</p>
            </div>
        `;
        const html = window.reportManager.createReportTemplate('Email Report', content, false);
        window.reportManager.updateReportContent(html);
        
    } catch (error) {
        window.reportManager.showError(`Error sending email: ${error.message}`);
    }
};

window.generateClaimForm = async function() {
    const type = document.getElementById('claimType')?.value;
    const date = document.getElementById('claimDate')?.value;
    if (!type || !window.reportManager) return;
    
    window.reportManager.showLoading();
    
    try {
        const report = await window.reportManager.dataManager.generateClaimForm(type, date);
        const content = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${report}</pre>`;
        const html = window.reportManager.createReportTemplate(`💰 ${type.toUpperCase()} Claim Form`, content, true);
        window.reportManager.updateReportContent(html);
    } catch (error) {
        window.reportManager.showError(`Error generating claim form: ${error.message}`);
    }
};

window.emailClaimForm = async function() {
    const type = document.getElementById('claimType')?.value;
    const date = document.getElementById('claimDate')?.value;
    
    if (!type || !date || !window.reportManager) {
        alert('Please select claim type and date');
        return;
    }
    
    const toEmail = prompt('Enter recipient email address:');
    if (!toEmail) return;
    
    window.reportManager.showLoading();
    
    try {
        const report = await window.reportManager.dataManager.generateClaimForm(type, date);
        const subject = `WorkLogPro ${type} Claim Form`;
        const body = `Hello,\n\nPlease find the attached claim form:\n\n${report}\n\nBest regards,\nWorkLogPro Team`;
        
        window.open(`mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
        
        const content = `
            <div style="padding: 15px; background: #d1e7dd; border-radius: 5px;">
                <h4 style="margin-top: 0;">✅ Email Ready</h4>
                <p>Your claim form has been prepared for email.</p>
            </div>
        `;
        const html = window.reportManager.createReportTemplate('Claim Form', content, false);
        window.reportManager.updateReportContent(html);
        
    } catch (error) {
        window.reportManager.showError(`Error preparing email: ${error.message}`);
    }
};

window.generateInvoice = async function() {
    const student = document.getElementById('invoiceStudent')?.value;
    const start = document.getElementById('invoiceStart')?.value;
    const end = document.getElementById('invoiceEnd')?.value;
    
    if (!student || !start || !end || !window.reportManager) {
        alert('Please select a student and dates');
        return;
    }
    
    window.reportManager.showLoading();
    
    try {
        const report = await window.reportManager.dataManager.generateInvoice(student, start, end);
        const content = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${report}</pre>`;
        const html = window.reportManager.createReportTemplate(`🧾 Invoice for ${student}`, content, true);
        window.reportManager.updateReportContent(html);
    } catch (error) {
        window.reportManager.showError(`Error generating invoice: ${error.message}`);
    }
};

window.emailInvoice = async function() {
    const student = document.getElementById('invoiceStudent')?.value;
    const start = document.getElementById('invoiceStart')?.value;
    const end = document.getElementById('invoiceEnd')?.value;
    
    if (!student || !start || !end || !window.reportManager) {
        alert('Please fill all fields');
        return;
    }
    
    const toEmail = prompt('Enter recipient email address:');
    if (!toEmail) return;
    
    window.reportManager.showLoading();
    
    try {
        const report = await window.reportManager.dataManager.generateInvoice(student, start, end);
        const subject = `Invoice for ${student}`;
        const body = `Hello,\n\nPlease find the attached invoice:\n\n${report}\n\nBest regards,\nWorkLogPro Team`;
        
        window.open(`mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
        
        const content = `
            <div style="padding: 15px; background: #d1e7dd; border-radius: 5px;">
                <h4 style="margin-top: 0;">✅ Email Ready</h4>
                <p>Your invoice has been prepared for email.</p>
            </div>
        `;
        const html = window.reportManager.createReportTemplate('Invoice Generator', content, false);
        window.reportManager.updateReportContent(html);
        
    } catch (error) {
        window.reportManager.showError(`Error preparing email: ${error.message}`);
    }
};

// Initialize ReportManager
console.log('Creating ReportManager...');
new ReportManager();
