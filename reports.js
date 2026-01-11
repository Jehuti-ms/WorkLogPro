// reports.js - FIXED VERSION
console.log('reports.js loading...');

import DataManager from './data-manager.js';

class ReportManager {
    constructor() {
        console.log('Creating ReportManager instance');
        this.dataManager = new DataManager();
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
            // Load data
            [this.subjects, this.students] = await Promise.all([
                this.dataManager.getAllSubjects(),
                this.dataManager.getAllStudents()
            ]);
            
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
        
        // Helper function to setup button
        const setupButton = (id, handler) => {
            const btn = document.getElementById(id);
            if (btn) {
                // Remove any existing listeners by cloning
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                // Add our listener
                newBtn.addEventListener('click', handler);
                console.log(`Event listener added to ${id}`);
                return newBtn;
            }
            console.error(`Button ${id} not found!`);
            return null;
        };

        // Setup all buttons with proper binding
        setupButton('weeklyReportBtn', () => this.displayReport('weekly'));
        setupButton('biWeeklyReportBtn', () => this.displayReport('biweekly'));
        setupButton('monthlyReportBtn', () => this.displayReport('monthly'));
        setupButton('subjectReportBtn', () => this.showSubjectSelector());
        setupButton('claimFormBtn', () => this.showClaimFormOptions());
        setupButton('invoiceBtn', () => this.showInvoiceGenerator());
        setupButton('pdfReportBtn', () => this.showPDFOptions());
        setupButton('emailReportBtn', () => this.showEmailForm());
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
            
            // Update DOM
            const update = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            
            update('totalStudentsReport', students.length);
            update('totalHoursReport', totalHours.toFixed(2));
            update('totalEarningsReport', `$${totalEarnings.toFixed(2)}`);
            update('outstandingBalance', `$${totalEarnings.toFixed(2)}`);
            
        } catch (error) {
            console.error('Error updating stats:', error);
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
            <div style="padding: 15px; background: #f8d7da; border: 1px solid #dc3545; border-radius: 5px; color: #721c24;">
                <h4 style="margin-top: 0;">❌ Error</h4>
                <p>${message}</p>
            </div>
        `);
    }

    showReportContent(report, title) {
        let html = '<div class="report-display">';
        html += `<h4>${title}</h4>`;
        html += '<div style="margin-bottom: 15px;">';
        html += `<button onclick="window.reportManager.copyToClipboard()" class="button small">Copy</button>`;
        html += `<button onclick="window.reportManager.printReport()" class="button small" style="margin-left: 10px;">Print</button>`;
        html += `<button onclick="window.reportManager.saveAsText()" class="button small" style="margin-left: 10px;">Save</button>`;
        html += '</div>';
        html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; max-height: 400px; overflow-y: auto;">`;
        html += `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${report}</pre>`;
        html += `</div>`;
        html += '</div>';
        
        this.updateReportContent(html);
    }

    async showSubjectSelector() {
        let html = '<div class="subject-selector">';
        html += '<h4>📚 Subject Report</h4>';
        
        if (this.subjects.length === 0) {
            html += '<p>No subjects found. Add some activities with subject names.</p>';
        } else {
            html += '<select id="subjectSelect" class="form-input" style="width: 100%; margin-bottom: 15px;">';
            html += '<option value="">Choose a subject...</option>';
            this.subjects.forEach(subject => {
                html += `<option value="${subject}">${subject.charAt(0).toUpperCase() + subject.slice(1)}</option>`;
            });
            html += '</select>';
        }
        
        html += '<input type="text" id="customSubject" class="form-input" placeholder="Or enter custom subject" style="width: 100%; margin-bottom: 15px;">';
        html += '<button id="generateSubjectReportBtn" class="button" style="width: 100%;">Generate Report</button>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Add event listener to the button we just created
        setTimeout(() => {
            const btn = document.getElementById('generateSubjectReportBtn');
            if (btn) {
                btn.addEventListener('click', () => this.generateSubjectReport());
            }
        }, 100);
    }

    async generateSubjectReport() {
        const select = document.getElementById('subjectSelect');
        const custom = document.getElementById('customSubject');
        
        const subject = select?.value || custom?.value.trim();
        
        if (!subject) {
            alert('Please select or enter a subject');
            return;
        }
        
        this.showLoading();
        
        try {
            const report = await this.dataManager.generateSubjectReport(subject);
            this.showReportContent(report, `📚 ${subject} Report`);
        } catch (error) {
            this.showError(`Error generating subject report: ${error.message}`);
        }
    }

    showPDFOptions() {
        let html = '<div class="pdf-options">';
        html += '<h4>📄 PDF Export</h4>';
        html += '<p>Select report type:</p>';
        
        const options = ['weekly', 'biweekly', 'monthly', 'subject', 'claim', 'invoice'];
        
        options.forEach((option, index) => {
            html += `<div style="margin: 10px 0;">`;
            html += `<input type="radio" id="pdf-${option}" name="pdfType" value="${option}" ${index === 0 ? 'checked' : ''}>`;
            html += `<label for="pdf-${option}" style="margin-left: 8px;">${option.charAt(0).toUpperCase() + option.slice(1)} Report</label>`;
            html += `</div>`;
        });
        
        // Dynamic fields container
        html += '<div id="pdfOptionsContainer" style="margin: 15px 0;"></div>';
        
        html += '<button id="generatePDFBtn" class="button success" style="width: 100%;">Generate PDF</button>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Setup dynamic options
        this.setupPDFOptions();
        
        // Add event listener
        setTimeout(() => {
            const btn = document.getElementById('generatePDFBtn');
            if (btn) {
                btn.addEventListener('click', () => this.generatePDF());
            }
        }, 100);
    }

    setupPDFOptions() {
        const container = document.getElementById('pdfOptionsContainer');
        if (!container) return;
        
        // Show initial options based on default selection
        this.updatePDFOptions('weekly');
        
        // Listen for changes
        document.querySelectorAll('input[name="pdfType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updatePDFOptions(e.target.value);
            });
        });
    }

    updatePDFOptions(type) {
        const container = document.getElementById('pdfOptionsContainer');
        if (!container) return;
        
        let html = '';
        
        switch(type) {
            case 'subject':
                html += '<select id="pdfSubject" class="form-input" style="width: 100%; margin-bottom: 10px;">';
                html += '<option value="">Select subject...</option>';
                this.subjects.forEach(subject => {
                    html += `<option value="${subject}">${subject}</option>`;
                });
                html += '</select>';
                break;
                
            case 'claim':
                html += '<select id="pdfClaimType" class="form-input" style="width: 100%; margin-bottom: 10px;">';
                html += '<option value="weekly">Weekly</option>';
                html += '<option value="biweekly">Bi-Weekly</option>';
                html += '<option value="monthly">Monthly</option>';
                html += '</select>';
                html += '<input type="date" id="pdfClaimDate" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
                break;
                
            case 'invoice':
                html += '<select id="pdfInvoiceStudent" class="form-input" style="width: 100%; margin-bottom: 10px;">';
                html += '<option value="">Select student...</option>';
                this.students.forEach(student => {
                    html += `<option value="${student.name}">${student.name}</option>`;
                });
                html += '</select>';
                html += '<div style="display: flex; gap: 10px;">';
                html += '<input type="date" id="pdfInvoiceStart" class="form-input" style="flex: 1;" placeholder="Start Date">';
                html += '<input type="date" id="pdfInvoiceEnd" class="form-input" style="flex: 1;" value="' + new Date().toISOString().split('T')[0] + '" placeholder="End Date">';
                html += '</div>';
                break;
        }
        
        container.innerHTML = html;
    }

    async generatePDF() {
        const selected = document.querySelector('input[name="pdfType"]:checked');
        if (!selected) return;
        
        const type = selected.value;
        let report;
        let filename;
        
        this.showLoading();
        
        try {
            switch(type) {
                case 'weekly':
                    report = await this.dataManager.generateWeeklyReport();
                    filename = `Weekly_Report_${new Date().toISOString().slice(0,10)}`;
                    break;
                case 'biweekly':
                    report = await this.dataManager.generateBiWeeklyReport();
                    filename = `BiWeekly_Report_${new Date().toISOString().slice(0,10)}`;
                    break;
                case 'monthly':
                    report = await this.dataManager.generateMonthlyReport();
                    filename = `Monthly_Report_${new Date().toISOString().slice(0,10)}`;
                    break;
                case 'subject':
                    const subject = document.getElementById('pdfSubject')?.value;
                    if (!subject) {
                        alert('Please select a subject');
                        return;
                    }
                    report = await this.dataManager.generateSubjectReport(subject);
                    filename = `${subject}_Report_${new Date().toISOString().slice(0,10)}`;
                    break;
                case 'claim':
                    const claimType = document.getElementById('pdfClaimType')?.value;
                    const claimDate = document.getElementById('pdfClaimDate')?.value;
                    report = await this.dataManager.generateClaimForm(claimType, claimDate);
                    filename = `${claimType}_Claim_${new Date().toISOString().slice(0,10)}`;
                    break;
                case 'invoice':
                    const student = document.getElementById('pdfInvoiceStudent')?.value;
                    const start = document.getElementById('pdfInvoiceStart')?.value;
                    const end = document.getElementById('pdfInvoiceEnd')?.value;
                    
                    if (!student || !start || !end) {
                        alert('Please fill all invoice fields');
                        return;
                    }
                    report = await this.dataManager.generateInvoice(student, start, end);
                    filename = `Invoice_${student}_${new Date().toISOString().slice(0,10)}`;
                    break;
            }
            
            this.exportAsPDF(report, filename);
            
        } catch (error) {
            this.showError(`Error generating PDF: ${error.message}`);
        }
    }

    exportAsPDF(content, filename) {
        if (typeof jspdf === 'undefined') {
            this.saveAsText(content, filename);
            return;
        }
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text(content, 10, 10);
            doc.save(`${filename}.pdf`);
            
            this.updateReportContent(`
                <div style="padding: 15px; background: #d1e7dd; border: 1px solid #198754; border-radius: 5px; color: #0f5132;">
                    <h4 style="margin-top: 0;">✅ PDF Generated</h4>
                    <p>File <strong>${filename}.pdf</strong> has been downloaded.</p>
                </div>
            `);
            
        } catch (error) {
            console.error('PDF generation error:', error);
            this.saveAsText(content, filename);
        }
    }

    async showEmailForm() {
        let html = '<div class="email-form">';
        html += '<h4>📧 Email Report</h4>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Recipient Email:</label>';
        html += '<input type="email" id="emailTo" class="form-input" placeholder="recipient@example.com" style="width: 100%;">';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Report Type:</label>';
        html += '<select id="emailType" class="form-input" style="width: 100%;">';
        html += '<option value="weekly">Weekly Report</option>';
        html += '<option value="biweekly">Bi-Weekly Report</option>';
        html += '<option value="monthly">Monthly Report</option>';
        html += '<option value="subject">Subject Report</option>';
        html += '<option value="claim">Claim Form</option>';
        html += '<option value="invoice">Invoice</option>';
        html += '</select>';
        html += '</div>';
        
        html += '<div id="emailOptionsContainer" style="margin-bottom: 15px;"></div>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Message (optional):</label>';
        html += '<textarea id="emailMessage" class="form-input" rows="3" placeholder="Add a message..." style="width: 100%;"></textarea>';
        html += '</div>';
        
        html += '<button id="sendEmailBtn" class="button info" style="width: 100%; margin-bottom: 10px;">Send Email</button>';
        html += '<button id="previewEmailBtn" class="button" style="width: 100%;">Preview</button>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Setup dynamic options
        this.setupEmailOptions();
        
        // Add event listeners
        setTimeout(() => {
            document.getElementById('sendEmailBtn')?.addEventListener('click', () => this.sendEmail());
            document.getElementById('previewEmailBtn')?.addEventListener('click', () => this.previewEmail());
        }, 100);
    }

    setupEmailOptions() {
        const container = document.getElementById('emailOptionsContainer');
        if (!container) return;
        
        this.updateEmailOptions('weekly');
        
        document.getElementById('emailType')?.addEventListener('change', (e) => {
            this.updateEmailOptions(e.target.value);
        });
    }

    updateEmailOptions(type) {
        const container = document.getElementById('emailOptionsContainer');
        if (!container) return;
        
        let html = '';
        
        switch(type) {
            case 'subject':
                html += '<label>Subject:</label>';
                html += '<input type="text" id="emailSubject" class="form-input" placeholder="Enter subject" style="width: 100%;">';
                break;
            case 'claim':
                html += '<label>Claim Type:</label>';
                html += '<select id="emailClaimType" class="form-input" style="width: 100%; margin-bottom: 10px;">';
                html += '<option value="weekly">Weekly</option>';
                html += '<option value="biweekly">Bi-Weekly</option>';
                html += '<option value="monthly">Monthly</option>';
                html += '</select>';
                html += '<label>End Date:</label>';
                html += '<input type="date" id="emailClaimDate" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
                break;
            case 'invoice':
                html += '<label>Student:</label>';
                html += '<select id="emailInvoiceStudent" class="form-input" style="width: 100%; margin-bottom: 10px;">';
                html += '<option value="">Select student...</option>';
                this.students.forEach(student => {
                    html += `<option value="${student.name}">${student.name}</option>`;
                });
                html += '</select>';
                html += '<div style="display: flex; gap: 10px;">';
                html += '<input type="date" id="emailInvoiceStart" class="form-input" style="flex: 1;" placeholder="Start Date">';
                html += '<input type="date" id="emailInvoiceEnd" class="form-input" style="flex: 1;" value="' + new Date().toISOString().split('T')[0] + '" placeholder="End Date">';
                html += '</div>';
                break;
        }
        
        container.innerHTML = html;
    }

    async sendEmail() {
        const to = document.getElementById('emailTo')?.value.trim();
        const type = document.getElementById('emailType')?.value;
        const message = document.getElementById('emailMessage')?.value.trim() || '';
        
        if (!to) {
            alert('Please enter recipient email');
            return;
        }
        
        this.showLoading();
        
        try {
            let report;
            let subject = `WorkLogPro ${type.charAt(0).toUpperCase() + type.slice(1)} Report`;
            
            switch(type) {
                case 'weekly':
                    report = await this.dataManager.generateWeeklyReport();
                    break;
                case 'biweekly':
                    report = await this.dataManager.generateBiWeeklyReport();
                    break;
                case 'monthly':
                    report = await this.dataManager.generateMonthlyReport();
                    break;
                case 'subject':
                    const subjectName = document.getElementById('emailSubject')?.value;
                    if (!subjectName) {
                        alert('Please enter a subject');
                        return;
                    }
                    report = await this.dataManager.generateSubjectReport(subjectName);
                    subject = `WorkLogPro ${subjectName} Report`;
                    break;
                case 'claim':
                    const claimType = document.getElementById('emailClaimType')?.value;
                    const claimDate = document.getElementById('emailClaimDate')?.value;
                    report = await this.dataManager.generateClaimForm(claimType, claimDate);
                    subject = `WorkLogPro ${claimType} Claim Form`;
                    break;
                case 'invoice':
                    const student = document.getElementById('emailInvoiceStudent')?.value;
                    const start = document.getElementById('emailInvoiceStart')?.value;
                    const end = document.getElementById('emailInvoiceEnd')?.value;
                    
                    if (!student || !start || !end) {
                        alert('Please fill all invoice fields');
                        return;
                    }
                    report = await this.dataManager.generateInvoice(student, start, end);
                    subject = `Invoice for ${student}`;
                    break;
            }
            
            const body = `Hello,\n\nPlease find the attached report:\n\n${message ? `Message: ${message}\n\n` : ''}${report}\n\nBest regards,\nWorkLogPro Team`;
            
            window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
            
            this.updateReportContent(`
                <div style="padding: 15px; background: #d1e7dd; border: 1px solid #198754; border-radius: 5px; color: #0f5132;">
                    <h4 style="margin-top: 0;">✅ Email Ready</h4>
                    <p>Your email client has been opened with the report.</p>
                </div>
            `);
            
        } catch (error) {
            this.showError(`Error sending email: ${error.message}`);
        }
    }

    async previewEmail() {
        // Similar to sendEmail but just shows preview
        const type = document.getElementById('emailType')?.value;
        const message = document.getElementById('emailMessage')?.value.trim() || '';
        
        this.showLoading();
        
        try {
            let report;
            let subject = `WorkLogPro ${type.charAt(0).toUpperCase() + type.slice(1)} Report`;
            
            switch(type) {
                case 'weekly':
                    report = await this.dataManager.generateWeeklyReport();
                    break;
                case 'biweekly':
                    report = await this.dataManager.generateBiWeeklyReport();
                    break;
                case 'monthly':
                    report = await this.dataManager.generateMonthlyReport();
                    break;
                case 'subject':
                    const subjectName = document.getElementById('emailSubject')?.value;
                    if (!subjectName) {
                        alert('Please enter a subject');
                        return;
                    }
                    report = await this.dataManager.generateSubjectReport(subjectName);
                    subject = `WorkLogPro ${subjectName} Report`;
                    break;
                case 'claim':
                    const claimType = document.getElementById('emailClaimType')?.value;
                    const claimDate = document.getElementById('emailClaimDate')?.value;
                    report = await this.dataManager.generateClaimForm(claimType, claimDate);
                    subject = `WorkLogPro ${claimType} Claim Form`;
                    break;
                case 'invoice':
                    const student = document.getElementById('emailInvoiceStudent')?.value;
                    const start = document.getElementById('emailInvoiceStart')?.value;
                    const end = document.getElementById('emailInvoiceEnd')?.value;
                    
                    if (!student || !start || !end) {
                        alert('Please fill all invoice fields');
                        return;
                    }
                    report = await this.dataManager.generateInvoice(student, start, end);
                    subject = `Invoice for ${student}`;
                    break;
            }
            
            let preview = `<h4>Email Preview</h4>`;
            preview += `<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px;">`;
            preview += `<p><strong>To:</strong> [Enter email]</p>`;
            preview += `<p><strong>Subject:</strong> ${subject}</p>`;
            preview += `<hr>`;
            preview += `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px;">`;
            preview += `Hello,\n\nPlease find the attached report:\n\n`;
            if (message) {
                preview += `Message: ${message}\n\n`;
            }
            preview += `${report}\n\nBest regards,\nWorkLogPro Team`;
            preview += `</pre>`;
            preview += `</div>`;
            
            this.updateReportContent(preview);
            
        } catch (error) {
            this.showError(`Error generating preview: ${error.message}`);
        }
    }

    showClaimFormOptions() {
        let html = '<div class="claim-form">';
        html += '<h4>💰 Claim Form</h4>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Claim Type:</label>';
        html += '<select id="claimFormType" class="form-input" style="width: 100%;">';
        html += '<option value="weekly">Weekly</option>';
        html += '<option value="biweekly">Bi-Weekly</option>';
        html += '<option value="monthly">Monthly</option>';
        html += '</select>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>End Date:</label>';
        html += '<input type="date" id="claimFormDate" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        
        html += '<button id="generateClaimFormBtn" class="button warning" style="width: 100%; margin-bottom: 10px;">Generate Claim Form</button>';
        html += '<button id="emailClaimFormBtn" class="button info" style="width: 100%;">Email Claim Form</button>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        setTimeout(() => {
            document.getElementById('generateClaimFormBtn')?.addEventListener('click', () => this.generateClaimForm());
            document.getElementById('emailClaimFormBtn')?.addEventListener('click', () => this.emailClaimForm());
        }, 100);
    }

    async generateClaimForm() {
        const type = document.getElementById('claimFormType')?.value;
        const date = document.getElementById('claimFormDate')?.value;
        
        if (!type || !date) return;
        
        this.showLoading();
        
        try {
            const report = await this.dataManager.generateClaimForm(type, date);
            this.showReportContent(report, `💰 ${type.toUpperCase()} Claim Form`);
        } catch (error) {
            this.showError(`Error generating claim form: ${error.message}`);
        }
    }

    async emailClaimForm() {
        const type = document.getElementById('claimFormType')?.value;
        const date = document.getElementById('claimFormDate')?.value;
        
        if (!type || !date) {
            alert('Please fill all fields');
            return;
        }
        
        const to = prompt('Enter recipient email:');
        if (!to) return;
        
        this.showLoading();
        
        try {
            const report = await this.dataManager.generateClaimForm(type, date);
            const subject = `WorkLogPro ${type} Claim Form`;
            const body = `Hello,\n\nPlease find the attached claim form:\n\n${report}\n\nBest regards,\nWorkLogPro Team`;
            
            window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
            
            this.updateReportContent(`
                <div style="padding: 15px; background: #d1e7dd; border: 1px solid #198754; border-radius: 5px; color: #0f5132;">
                    <h4 style="margin-top: 0;">✅ Email Ready</h4>
                    <p>Your claim form has been prepared for email.</p>
                </div>
            `);
            
        } catch (error) {
            this.showError(`Error preparing email: ${error.message}`);
        }
    }

    showInvoiceGenerator() {
        let html = '<div class="invoice-generator">';
        html += '<h4>🧾 Invoice Generator</h4>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Select Student:</label>';
        html += '<select id="invoiceStudent" class="form-input" style="width: 100%;">';
        html += '<option value="">Choose a student...</option>';
        this.students.forEach(student => {
            html += `<option value="${student.name}">${student.name} ($${student.hourlyRate || 0}/hr)</option>`;
        });
        html += '</select>';
        html += '</div>';
        
        html += '<div style="display: flex; gap: 10px; margin-bottom: 15px;">';
        html += '<input type="date" id="invoiceStart" class="form-input" style="flex: 1;" placeholder="Start Date">';
        html += '<input type="date" id="invoiceEnd" class="form-input" style="flex: 1;" value="' + new Date().toISOString().split('T')[0] + '" placeholder="End Date">';
        html += '</div>';
        
        html += '<button id="generateInvoiceBtn" class="button warning" style="width: 100%; margin-bottom: 10px;">Generate Invoice</button>';
        html += '<button id="emailInvoiceBtn" class="button info" style="width: 100%;">Email Invoice</button>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        setTimeout(() => {
            document.getElementById('generateInvoiceBtn')?.addEventListener('click', () => this.generateInvoice());
            document.getElementById('emailInvoiceBtn')?.addEventListener('click', () => this.emailInvoice());
        }, 100);
    }

    async generateInvoice() {
        const student = document.getElementById('invoiceStudent')?.value;
        const start = document.getElementById('invoiceStart')?.value;
        const end = document.getElementById('invoiceEnd')?.value;
        
        if (!student || !start || !end) {
            alert('Please fill all fields');
            return;
        }
        
        this.showLoading();
        
        try {
            const report = await this.dataManager.generateInvoice(student, start, end);
            this.showReportContent(report, `🧾 Invoice for ${student}`);
        } catch (error) {
            this.showError(`Error generating invoice: ${error.message}`);
        }
    }

    async emailInvoice() {
        const student = document.getElementById('invoiceStudent')?.value;
        const start = document.getElementById('invoiceStart')?.value;
        const end = document.getElementById('invoiceEnd')?.value;
        
        if (!student || !start || !end) {
            alert('Please fill all fields');
            return;
        }
        
        const to = prompt('Enter recipient email:');
        if (!to) return;
        
        this.showLoading();
        
        try {
            const report = await this.dataManager.generateInvoice(student, start, end);
            const subject = `Invoice for ${student}`;
            const body = `Hello,\n\nPlease find the attached invoice:\n\n${report}\n\nBest regards,\nWorkLogPro Team`;
            
            window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
            
            this.updateReportContent(`
                <div style="padding: 15px; background: #d1e7dd; border: 1px solid #198754; border-radius: 5px; color: #0f5132;">
                    <h4 style="margin-top: 0;">✅ Email Ready</h4>
                    <p>Your invoice has been prepared for email.</p>
                </div>
            `);
            
        } catch (error) {
            this.showError(`Error preparing email: ${error.message}`);
        }
    }

    // Helper methods
    updateReportContent(html) {
        const reportContent = document.getElementById('report-content');
        if (reportContent) {
            reportContent.innerHTML = html;
        }
    }

    async copyToClipboard() {
        const pre = document.querySelector('#report-content pre');
        if (pre) {
            await navigator.clipboard.writeText(pre.textContent);
            alert('Report copied to clipboard!');
        }
    }

    printReport() {
        const pre = document.querySelector('#report-content pre');
        if (pre) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head><title>Report</title></head>
                <body><pre>${pre.textContent}</pre></body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    }

    saveAsText(content = null, filename = null) {
        const text = content || document.querySelector('#report-content pre')?.textContent;
        if (!text) return;
        
        const name = filename || `report_${new Date().toISOString().slice(0,10)}.txt`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        
        if (!content) {
            this.updateReportContent(`
                <div style="padding: 15px; background: #d1e7dd; border: 1px solid #198754; border-radius: 5px; color: #0f5132;">
                    <h4 style="margin-top: 0;">✅ File Saved</h4>
                    <p>Report saved as <strong>${name}</strong></p>
                </div>
            `);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing ReportManager...');
    new ReportManager();
});
