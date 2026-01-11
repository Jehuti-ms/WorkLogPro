// reports.js - COMPLETE REPORTS SYSTEM FOR SINGLE-PAGE APP

import DataManager from './data-manager.js';

class ReportManager {
    constructor() {
        this.dataManager = new DataManager();
        this.initialized = false;
        this.subjects = [];
        this.students = [];
        
        // Initialize when the reports section is shown
        this.setupSectionListener();
    }

    setupSectionListener() {
        // Listen for when reports section is shown
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    mutation.attributeName === 'style' &&
                    document.getElementById('reports-section')?.style.display === 'block') {
                    this.initialize();
                }
            });
        });

        const reportsSection = document.getElementById('reports-section');
        if (reportsSection) {
            observer.observe(reportsSection, { attributes: true });
        }
    }

    async initialize() {
        if (this.initialized) return;
        
        console.log('Initializing Report Manager...');
        
        try {
            // Load initial data
            await this.loadInitialData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('Report Manager initialized successfully');
        } catch (error) {
            console.error('Error initializing Report Manager:', error);
        }
    }

    async loadInitialData() {
        try {
            [this.subjects, this.students] = await Promise.all([
                this.dataManager.getAllSubjects(),
                this.dataManager.getAllStudents()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    setupEventListeners() {
        console.log('Setting up report event listeners...');
        
        // Weekly Report
        const weeklyBtn = document.getElementById('weekly-report-btn');
        if (weeklyBtn) {
            weeklyBtn.addEventListener('click', () => {
                this.displayReport('weekly');
            });
        }

        // Bi-weekly Report
        const biweeklyBtn = document.getElementById('biweekly-report-btn');
        if (biweeklyBtn) {
            biweeklyBtn.addEventListener('click', () => {
                this.displayReport('biweekly');
            });
        }

        // Monthly Report
        const monthlyBtn = document.getElementById('monthly-report-btn');
        if (monthlyBtn) {
            monthlyBtn.addEventListener('click', () => {
                this.displayReport('monthly');
            });
        }

        // Subject Report
        const subjectBtn = document.getElementById('subject-report-btn');
        if (subjectBtn) {
            subjectBtn.addEventListener('click', () => {
                this.showSubjectSelector();
            });
        }

        // PDF Export
        const pdfBtn = document.getElementById('pdf-export-btn');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                this.showPDFOptions();
            });
        }

        // Email Report
        const emailBtn = document.getElementById('email-report-btn');
        if (emailBtn) {
            emailBtn.addEventListener('click', () => {
                this.showEmailForm();
            });
        }

        // Claim Form
        const claimBtn = document.getElementById('claim-form-btn');
        if (claimBtn) {
            claimBtn.addEventListener('click', () => {
                this.showClaimFormOptions();
            });
        }

        // Invoice
        const invoiceBtn = document.getElementById('invoice-btn');
        if (invoiceBtn) {
            invoiceBtn.addEventListener('click', () => {
                this.showInvoiceGenerator();
            });
        }
    }

    async displayReport(type) {
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
            this.showError('Error generating report: ' + error.message);
        }
    }

    async showSubjectSelector() {
        await this.loadInitialData();
        
        let html = '<div class="subject-selector">';
        html += '<h4>📚 Select Subject for Report</h4>';
        
        if (this.subjects.length === 0) {
            html += '<div class="alert alert-info">';
            html += '<p>No subjects detected in your logs. Try adding some activities with subject names.</p>';
            html += '</div>';
        } else {
            html += '<select id="subject-select" class="form-select mb-3">';
            html += '<option value="">Choose a subject...</option>';
            
            this.subjects.forEach(subject => {
                html += `<option value="${subject}">${subject.charAt(0).toUpperCase() + subject.slice(1)}</option>`;
            });
            
            html += '</select>';
        }
        
        html += '<div class="mb-3">';
        html += '<label for="custom-subject" class="form-label">Or enter custom subject:</label>';
        html += '<input type="text" id="custom-subject" class="form-control" placeholder="e.g., Algebra, Reading, Science">';
        html += '</div>';
        
        html += '<button id="generate-subject-report" class="btn btn-primary">Generate Report</button>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        const generateBtn = document.getElementById('generate-subject-report');
        if (generateBtn) {
            generateBtn.addEventListener('click', async () => {
                const select = document.getElementById('subject-select');
                const custom = document.getElementById('custom-subject')?.value.trim() || '';
                
                let subject = select?.value || custom;
                
                if (!subject) {
                    alert('Please select or enter a subject');
                    return;
                }
                
                this.showLoading();
                
                try {
                    const report = await this.dataManager.generateSubjectReport(subject);
                    this.showReportContent(report, `📚 Subject Report: ${subject}`);
                } catch (error) {
                    this.showError('Error generating subject report: ' + error.message);
                }
            });
        }
    }

    showPDFOptions() {
        let html = '<div class="pdf-options">';
        html += '<h4>📄 Export Report as PDF</h4>';
        html += '<p>Select report type to export:</p>';
        
        const reportTypes = [
            { id: 'pdf-weekly', value: 'weekly', label: 'Weekly Report', icon: '📅' },
            { id: 'pdf-biweekly', value: 'biweekly', label: 'Bi-Weekly Report', icon: '📅' },
            { id: 'pdf-monthly', value: 'monthly', label: 'Monthly Report', icon: '📅' },
            { id: 'pdf-subject', value: 'subject', label: 'Subject Report', icon: '📚' },
            { id: 'pdf-claim', value: 'claim', label: 'Claim Form', icon: '💰' },
            { id: 'pdf-invoice', value: 'invoice', label: 'Invoice', icon: '🧾' }
        ];
        
        html += '<div class="row">';
        reportTypes.forEach((type, index) => {
            html += `
                <div class="col-md-6 mb-2">
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="pdf-type" 
                               id="${type.id}" value="${type.value}" ${index === 0 ? 'checked' : ''}>
                        <label class="form-check-label" for="${type.id}">
                            ${type.icon} ${type.label}
                        </label>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        // Subject selector
        html += '<div id="pdf-subject-select" class="mt-3" style="display: none;">';
        html += '<label class="form-label">Select Subject:</label>';
        html += '<select id="pdf-subject-choice" class="form-select">';
        html += '<option value="">Select subject...</option>';
        if (this.subjects && this.subjects.length > 0) {
            this.subjects.forEach(subject => {
                html += `<option value="${subject}">${subject.charAt(0).toUpperCase() + subject.slice(1)}</option>`;
            });
        }
        html += '</select>';
        html += '</div>';
        
        // Student selector for invoice
        html += '<div id="pdf-student-select" class="mt-3" style="display: none;">';
        html += '<label class="form-label">Select Student:</label>';
        html += '<select id="pdf-student-choice" class="form-select">';
        html += '<option value="">Select student...</option>';
        if (this.students && this.students.length > 0) {
            this.students.forEach(student => {
                const rate = student.hourlyRate ? ` ($${student.hourlyRate}/hr)` : '';
                html += `<option value="${student.name}">${student.name}${rate}</option>`;
            });
        }
        html += '</select>';
        html += '</div>';
        
        // Date range for invoice
        html += '<div id="pdf-date-range" class="row mt-3" style="display: none;">';
        html += '<div class="col-md-6">';
        html += '<label class="form-label">Start Date:</label>';
        html += '<input type="date" id="pdf-start-date" class="form-control">';
        html += '</div>';
        html += '<div class="col-md-6">';
        html += '<label class="form-label">End Date:</label>';
        html += '<input type="date" id="pdf-end-date" class="form-control" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        html += '</div>';
        
        // Claim form options
        html += '<div id="pdf-claim-options" class="row mt-3" style="display: none;">';
        html += '<div class="col-md-6">';
        html += '<label class="form-label">Claim Type:</label>';
        html += '<select id="pdf-claim-type" class="form-select">';
        html += '<option value="weekly">Weekly Claim</option>';
        html += '<option value="biweekly">Bi-Weekly Claim</option>';
        html += '<option value="monthly">Monthly Claim</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-6">';
        html += '<label class="form-label">Period End Date:</label>';
        html += '<input type="date" id="pdf-claim-end-date" class="form-control" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        html += '</div>';
        
        html += '<div class="mt-4">';
        html += '<button id="generate-pdf" class="btn btn-success">';
        html += '<i class="fas fa-file-pdf"></i> Generate PDF';
        html += '</button>';
        html += '</div></div>';
        
        this.updateReportContent(html);
        
        // Show/hide options based on selection
        document.querySelectorAll('input[name="pdf-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const subjectDiv = document.getElementById('pdf-subject-select');
                const studentDiv = document.getElementById('pdf-student-select');
                const dateDiv = document.getElementById('pdf-date-range');
                const claimDiv = document.getElementById('pdf-claim-options');
                
                if (subjectDiv) subjectDiv.style.display = e.target.value === 'subject' ? 'block' : 'none';
                if (studentDiv) studentDiv.style.display = e.target.value === 'invoice' ? 'block' : 'none';
                if (dateDiv) dateDiv.style.display = e.target.value === 'invoice' ? 'block' : 'none';
                if (claimDiv) claimDiv.style.display = e.target.value === 'claim' ? 'block' : 'none';
            });
        });
        
        const generateBtn = document.getElementById('generate-pdf');
        if (generateBtn) {
            generateBtn.addEventListener('click', async () => {
                await this.generatePDF();
            });
        }
    }

    async generatePDF() {
        const selectedRadio = document.querySelector('input[name="pdf-type"]:checked');
        if (!selectedRadio) return;
        
        const selectedType = selectedRadio.value;
        let report;
        let filename;
        
        this.showLoading();
        
        try {
            switch(selectedType) {
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
                    const subject = document.getElementById('pdf-subject-choice')?.value;
                    if (!subject) {
                        alert('Please select a subject');
                        return;
                    }
                    report = await this.dataManager.generateSubjectReport(subject);
                    filename = `${subject}_Report_${new Date().toISOString().slice(0,10)}`;
                    break;
                case 'claim':
                    const claimType = document.getElementById('pdf-claim-type')?.value;
                    const endDate = document.getElementById('pdf-claim-end-date')?.value;
                    report = await this.dataManager.generateClaimForm(claimType, endDate);
                    filename = `${claimType}_Claim_Form_${new Date().toISOString().slice(0,10)}`;
                    break;
                case 'invoice':
                    const studentName = document.getElementById('pdf-student-choice')?.value;
                    const startDate = document.getElementById('pdf-start-date')?.value;
                    const invoiceEndDate = document.getElementById('pdf-end-date')?.value;
                    
                    if (!studentName || !startDate || !invoiceEndDate) {
                        alert('Please fill all invoice fields');
                        return;
                    }
                    report = await this.dataManager.generateInvoice(studentName, startDate, invoiceEndDate);
                    filename = `Invoice_${studentName}_${new Date().toISOString().slice(0,10)}`;
                    break;
            }
            
            this.exportAsPDF(report, filename);
        } catch (error) {
            this.showError('Error generating PDF: ' + error.message);
        }
    }

    exportAsPDF(content, filename) {
        // Check if jsPDF is available
        if (typeof jspdf === 'undefined') {
            // Show error and offer text download
            this.updateReportContent(`
                <div class="alert alert-warning">
                    <h5><i class="fas fa-exclamation-triangle"></i> PDF Library Not Available</h5>
                    <p>To export PDFs, please include jsPDF in your project:</p>
                    <code>&lt;script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"&gt;&lt;/script&gt;</code>
                    <div class="mt-3">
                        <button onclick="downloadAsText('${content.replace(/'/g, "\\'")}', '${filename}.txt')" 
                                class="btn btn-secondary">
                            <i class="fas fa-download"></i> Download as Text File
                        </button>
                    </div>
                </div>
            `);
            return;
        }
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Add styling
            doc.setFont("helvetica");
            
            // Add header
            doc.setFontSize(20);
            doc.setTextColor(33, 37, 41);
            doc.text("WorkLogPro Report", 20, 25);
            
            doc.setFontSize(10);
            doc.setTextColor(108, 117, 125);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 35);
            
            // Add content
            doc.setFontSize(11);
            doc.setTextColor(33, 37, 41);
            
            const lines = doc.splitTextToSize(content, 170);
            let y = 45;
            
            lines.forEach(line => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 20, y);
                y += 6;
            });
            
            // Add footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(153, 153, 153);
                doc.text(`Page ${i} of ${pageCount}`, 190, 285, null, null, 'right');
                doc.text('Generated by WorkLogPro', 20, 285);
            }
            
            // Save PDF
            doc.save(`${filename}.pdf`);
            
            // Show success message
            this.updateReportContent(`
                <div class="alert alert-success">
                    <h5><i class="fas fa-check-circle"></i> PDF Generated Successfully!</h5>
                    <p>File <strong>${filename}.pdf</strong> has been downloaded.</p>
                    <button onclick="window.reportManager.showPDFOptions()" class="btn btn-outline-success btn-sm">
                        Generate Another PDF
                    </button>
                </div>
            `);
            
        } catch (error) {
            this.showError('Error creating PDF: ' + error.message);
        }
    }

    async showEmailForm() {
        let html = '<div class="email-form">';
        html += '<h4><i class="fas fa-envelope"></i> Email Report</h4>';
        html += '<p>Send report to:</p>';
        
        html += '<div class="mb-3">';
        html += '<label class="form-label">Recipient Email:</label>';
        html += '<input type="email" id="email-to" class="form-control" placeholder="recipient@example.com" required>';
        html += '</div>';
        
        html += '<div class="mb-3">';
        html += '<label class="form-label">Report Type:</label>';
        html += '<select id="email-report-type" class="form-select">';
        html += '<option value="weekly">Weekly Report</option>';
        html += '<option value="biweekly">Bi-Weekly Report</option>';
        html += '<option value="monthly">Monthly Report</option>';
        html += '<option value="subject">Subject Report</option>';
        html += '<option value="claim">Claim Form</option>';
        html += '<option value="invoice">Invoice</option>';
        html += '</select>';
        html += '</div>';
        
        // Dynamic options container
        html += '<div id="email-options-container"></div>';
        
        html += '<div class="mb-3">';
        html += '<label class="form-label">Additional Message (optional):</label>';
        html += '<textarea id="email-message" class="form-control" rows="3" placeholder="Add a personal message..."></textarea>';
        html += '</div>';
        
        html += '<div class="d-flex gap-2">';
        html += '<button id="send-email" class="btn btn-primary">';
        html += '<i class="fas fa-paper-plane"></i> Send Email';
        html += '</button>';
        html += '<button id="preview-email" class="btn btn-outline-secondary">';
        html += '<i class="fas fa-eye"></i> Preview';
        html += '</button>';
        html += '</div>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Initialize email options
        this.updateEmailOptions('weekly');
        
        // Listen for report type changes
        const emailTypeSelect = document.getElementById('email-report-type');
        if (emailTypeSelect) {
            emailTypeSelect.addEventListener('change', (e) => {
                this.updateEmailOptions(e.target.value);
            });
        }
        
        // Send email button
        const sendBtn = document.getElementById('send-email');
        if (sendBtn) {
            sendBtn.addEventListener('click', async () => {
                await this.sendEmail();
            });
        }
        
        // Preview button
        const previewBtn = document.getElementById('preview-email');
        if (previewBtn) {
            previewBtn.addEventListener('click', async () => {
                await this.previewEmail();
            });
        }
    }

    updateEmailOptions(reportType) {
        const container = document.getElementById('email-options-container');
        if (!container) return;
        
        let html = '';
        
        switch(reportType) {
            case 'subject':
                html += '<div class="mb-3">';
                html += '<label class="form-label">Subject:</label>';
                html += '<input type="text" id="email-subject" class="form-control" placeholder="Enter subject" required>';
                html += '</div>';
                break;
            case 'claim':
                html += '<div class="row mb-3">';
                html += '<div class="col-md-6">';
                html += '<label class="form-label">Claim Type:</label>';
                html += '<select id="email-claim-type" class="form-select">';
                html += '<option value="weekly">Weekly Claim</option>';
                html += '<option value="biweekly">Bi-Weekly Claim</option>';
                html += '<option value="monthly">Monthly Claim</option>';
                html += '</select>';
                html += '</div>';
                html += '<div class="col-md-6">';
                html += '<label class="form-label">Period End Date:</label>';
                html += '<input type="date" id="email-claim-end-date" class="form-control" value="' + new Date().toISOString().split('T')[0] + '" required>';
                html += '</div>';
                html += '</div>';
                break;
            case 'invoice':
                html += '<div class="mb-3">';
                html += '<label class="form-label">Student:</label>';
                html += '<select id="email-invoice-student" class="form-select" required>';
                html += '<option value="">Select student...</option>';
                if (this.students && this.students.length > 0) {
                    this.students.forEach(student => {
                        html += `<option value="${student.name}">${student.name}</option>`;
                    });
                }
                html += '</select>';
                html += '</div>';
                html += '<div class="row mb-3">';
                html += '<div class="col-md-6">';
                html += '<label class="form-label">Start Date:</label>';
                html += '<input type="date" id="email-invoice-start" class="form-control" required>';
                html += '</div>';
                html += '<div class="col-md-6">';
                html += '<label class="form-label">End Date:</label>';
                html += '<input type="date" id="email-invoice-end" class="form-control" value="' + new Date().toISOString().split('T')[0] + '" required>';
                html += '</div>';
                html += '</div>';
                break;
        }
        
        container.innerHTML = html;
    }

    async previewEmail() {
        const reportType = document.getElementById('email-report-type')?.value;
        if (!reportType) return;
        
        this.showLoading();
        
        try {
            let report;
            let title;
            
            switch(reportType) {
                case 'weekly':
                    report = await this.dataManager.generateWeeklyReport();
                    title = 'Weekly Report';
                    break;
                case 'biweekly':
                    report = await this.dataManager.generateBiWeeklyReport();
                    title = 'Bi-Weekly Report';
                    break;
                case 'monthly':
                    report = await this.dataManager.generateMonthlyReport();
                    title = 'Monthly Report';
                    break;
                case 'subject':
                    const subject = document.getElementById('email-subject')?.value.trim();
                    if (!subject) {
                        alert('Please enter a subject');
                        return;
                    }
                    report = await this.dataManager.generateSubjectReport(subject);
                    title = `Subject Report: ${subject}`;
                    break;
                case 'claim':
                    const claimType = document.getElementById('email-claim-type')?.value;
                    const endDate = document.getElementById('email-claim-end-date')?.value;
                    report = await this.dataManager.generateClaimForm(claimType, endDate);
                    title = `${claimType} Claim Form`;
                    break;
                case 'invoice':
                    const studentName = document.getElementById('email-invoice-student')?.value;
                    const startDate = document.getElementById('email-invoice-start')?.value;
                    const invoiceEndDate = document.getElementById('email-invoice-end')?.value;
                    
                    if (!studentName || !startDate || !invoiceEndDate) {
                        alert('Please fill all invoice fields');
                        return;
                    }
                    report = await this.dataManager.generateInvoice(studentName, startDate, invoiceEndDate);
                    title = `Invoice for ${studentName}`;
                    break;
            }
            
            const message = document.getElementById('email-message')?.value.trim() || '';
            
            let preview = `<h5>Email Preview: ${title}</h5>`;
            preview += `<div class="card mt-3">`;
            preview += `<div class="card-body">`;
            preview += `<h6>To: [Enter email address]</h6>`;
            preview += `<h6>Subject: ${title}</h6>`;
            preview += `<hr>`;
            preview += `<pre style="white-space: pre-wrap; background: #f8f9fa; padding: 15px; border-radius: 5px;">`;
            preview += `Hello,\n\nPlease find the attached report.\n\n`;
            if (message) {
                preview += `Message: ${message}\n\n`;
            }
            preview += `${report}\n\nBest regards,\nWorkLogPro Team`;
            preview += `</pre>`;
            preview += `</div></div>`;
            
            preview += `<div class="mt-3">`;
            preview += `<button onclick="window.reportManager.showEmailForm()" class="btn btn-secondary btn-sm">`;
            preview += `Back to Email Form`;
            preview += `</button>`;
            preview += `</div>`;
            
            this.updateReportContent(preview);
            
        } catch (error) {
            this.showError('Error generating preview: ' + error.message);
        }
    }

    async sendEmail() {
        const toEmail = document.getElementById('email-to')?.value.trim();
        const reportType = document.getElementById('email-report-type')?.value;
        const message = document.getElementById('email-message')?.value.trim() || '';
        
        if (!toEmail) {
            alert('Please enter recipient email address');
            return;
        }
        
        if (!reportType) {
            alert('Please select a report type');
            return;
        }
        
        this.showLoading();
        
        try {
            let report;
            let subject = `WorkLogPro ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
            
            switch(reportType) {
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
                    const customSubject = document.getElementById('email-subject')?.value.trim();
                    if (!customSubject) {
                        alert('Please enter a subject for the subject report');
                        return;
                    }
                    report = await this.dataManager.generateSubjectReport(customSubject);
                    subject = `WorkLogPro Subject Report: ${customSubject}`;
                    break;
                case 'claim':
                    const claimType = document.getElementById('email-claim-type')?.value;
                    const endDate = document.getElementById('email-claim-end-date')?.value;
                    if (!claimType || !endDate) {
                        alert('Please fill all claim form fields');
                        return;
                    }
                    report = await this.dataManager.generateClaimForm(claimType, endDate);
                    subject = `WorkLogPro ${claimType} Claim Form`;
                    break;
                case 'invoice':
                    const studentName = document.getElementById('email-invoice-student')?.value;
                    const startDate = document.getElementById('email-invoice-start')?.value;
                    const invoiceEndDate = document.getElementById('email-invoice-end')?.value;
                    
                    if (!studentName || !startDate || !invoiceEndDate) {
                        alert('Please fill all invoice fields');
                        return;
                    }
                    report = await this.dataManager.generateInvoice(studentName, startDate, invoiceEndDate);
                    subject = `Invoice for ${studentName}`;
                    break;
            }
            
            const body = `Hello,\n\nPlease find the attached report.\n\n${message ? `Message: ${message}\n\n` : ''}${report}\n\nBest regards,\nWorkLogPro Team`;
            
            const mailtoLink = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
            // Open email client
            window.open(mailtoLink, '_blank');
            
            // Show success message
            this.updateReportContent(`
                <div class="alert alert-success">
                    <h5><i class="fas fa-check-circle"></i> Email Ready!</h5>
                    <p>Your email client has been opened with the report.</p>
                    <p><strong>To:</strong> ${toEmail}</p>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <div class="mt-3">
                        <button onclick="window.reportManager.showEmailForm()" class="btn btn-outline-success btn-sm">
                            Send Another Email
                        </button>
                    </div>
                </div>
            `);
            
        } catch (error) {
            this.showError('Error preparing email: ' + error.message);
        }
    }

    async showClaimFormOptions() {
        let html = '<div class="claim-form-options">';
        html += '<h4><i class="fas fa-file-invoice-dollar"></i> Generate Claim Form</h4>';
        html += '<p>Create a claim form for payment submission:</p>';
        
        html += '<div class="row mb-3">';
        html += '<div class="col-md-6">';
        html += '<label class="form-label">Claim Type:</label>';
        html += '<select id="claim-type" class="form-select">';
        html += '<option value="weekly">Weekly Claim</option>';
        html += '<option value="biweekly">Bi-Weekly Claim</option>';
        html += '<option value="monthly">Monthly Claim</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-6">';
        html += '<label class="form-label">Period End Date:</label>';
        html += '<input type="date" id="claim-end-date" class="form-control" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        html += '</div>';
        
        html += '<div class="d-flex gap-2">';
        html += '<button id="generate-claim" class="btn btn-primary">';
        html += '<i class="fas fa-eye"></i> Preview Claim Form';
        html += '</button>';
        html += '<button id="download-claim-pdf" class="btn btn-success">';
        html += '<i class="fas fa-file-pdf"></i> Download as PDF';
        html += '</button>';
        html += '<button id="email-claim" class="btn btn-info">';
        html += '<i class="fas fa-envelope"></i> Email Claim Form';
        html += '</button>';
        html += '</div>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Add event listeners
        const generateBtn = document.getElementById('generate-claim');
        if (generateBtn) {
            generateBtn.addEventListener('click', async () => {
                await this.generateClaimForm();
            });
        }
        
        const downloadBtn = document.getElementById('download-claim-pdf');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                await this.downloadClaimAsPDF();
            });
        }
        
        const emailBtn = document.getElementById('email-claim');
        if (emailBtn) {
            emailBtn.addEventListener('click', async () => {
                await this.emailClaimForm();
            });
        }
    }

    async generateClaimForm() {
        const claimType = document.getElementById('claim-type')?.value;
        const endDate = document.getElementById('claim-end-date')?.value;
        
        if (!claimType || !endDate) {
            alert('Please select claim type and end date');
            return;
        }
        
        this.showLoading();
        
        try {
            const claim = await this.dataManager.generateClaimForm(claimType, endDate);
            this.showReportContent(claim, `💰 ${claimType.toUpperCase()} CLAIM FORM`);
        } catch (error) {
            this.showError('Error generating claim form: ' + error.message);
        }
    }

    async downloadClaimAsPDF() {
        const claimType = document.getElementById('claim-type')?.value;
        const endDate = document.getElementById('claim-end-date')?.value;
        
        if (!claimType || !endDate) {
            alert('Please select claim type and end date');
            return;
        }
        
        this.showLoading();
        
        try {
            const claim = await this.dataManager.generateClaimForm(claimType, endDate);
            const filename = `${claimType}_Claim_Form_${new Date().toISOString().slice(0,10)}`;
            this.exportAsPDF(claim, filename);
        } catch (error) {
            this.showError('Error generating claim PDF: ' + error.message);
        }
    }

    async emailClaimForm() {
        const claimType = document.getElementById('claim-type')?.value;
        const endDate = document.getElementById('claim-end-date')?.value;
        
        if (!claimType || !endDate) {
            alert('Please select claim type and end date');
            return;
        }
        
        const toEmail = prompt('Enter recipient email address:');
        if (!toEmail) return;
        
        this.showLoading();
        
        try {
            const claim = await this.dataManager.generateClaimForm(claimType, endDate);
            const subject = `WorkLogPro ${claimType} Claim Form`;
            const body = `Hello,\n\nPlease find the attached claim form.\n\n${claim}\n\nBest regards,\nWorkLogPro Team`;
            
            const mailtoLink = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.open(mailtoLink, '_blank');
            
            this.updateReportContent(`
                <div class="alert alert-success">
                    <h5><i class="fas fa-check-circle"></i> Email Ready!</h5>
                    <p>Your claim form has been prepared for email.</p>
                    <p><strong>Recipient:</strong> ${toEmail}</p>
                    <div class="mt-3">
                        <button onclick="window.reportManager.showClaimFormOptions()" class="btn btn-outline-success btn-sm">
                            Back to Claim Forms
                        </button>
                    </div>
                </div>
            `);
        } catch (error) {
            this.showError('Error preparing claim email: ' + error.message);
        }
    }

    async showInvoiceGenerator() {
        await this.loadInitialData();
        
        let html = '<div class="invoice-generator">';
        html += '<h4><i class="fas fa-receipt"></i> Generate Invoice</h4>';
        html += '<p>Create a professional invoice for a student:</p>';
        
        html += '<div class="row mb-3">';
        html += '<div class="col-md-6">';
        html += '<label class="form-label">Select Student:</label>';
        html += '<select id="invoice-student" class="form-select">';
        html += '<option value="">Select a student...</option>';
        
        if (this.students && this.students.length > 0) {
            this.students.forEach(student => {
                const rate = student.hourlyRate ? ` ($${student.hourlyRate}/hr)` : '';
                html += `<option value="${student.name}">${student.name}${rate}</option>`;
            });
        } else {
            html += '<option value="" disabled>No students found</option>';
        }
        
        html += '</select>';
        html += '</div>';
        html += '<div class="col-md-3">';
        html += '<label class="form-label">Start Date:</label>';
        html += '<input type="date" id="invoice-start-date" class="form-control">';
        html += '</div>';
        html += '<div class="col-md-3">';
        html += '<label class="form-label">End Date:</label>';
        html += '<input type="date" id="invoice-end-date" class="form-control" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        html += '</div>';
        
        html += '<div class="d-flex gap-2">';
        html += '<button id="generate-invoice" class="btn btn-primary">';
        html += '<i class="fas fa-eye"></i> Preview Invoice';
        html += '</button>';
        html += '<button id="download-invoice-pdf" class="btn btn-success">';
        html += '<i class="fas fa-file-pdf"></i> Download as PDF';
        html += '</button>';
        html += '<button id="email-invoice" class="btn btn-info">';
        html += '<i class="fas fa-envelope"></i> Email Invoice';
        html += '</button>';
        html += '</div>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Add event listeners
        const generateBtn = document.getElementById('generate-invoice');
        if (generateBtn) {
            generateBtn.addEventListener('click', async () => {
                await this.generateInvoice();
            });
        }
        
        const downloadBtn = document.getElementById('download-invoice-pdf');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                await this.downloadInvoiceAsPDF();
            });
        }
        
        const emailBtn = document.getElementById('email-invoice');
        if (emailBtn) {
            emailBtn.addEventListener('click', async () => {
                await this.emailInvoice();
            });
        }
    }

    async generateInvoice() {
        const studentName = document.getElementById('invoice-student')?.value;
        const startDate = document.getElementById('invoice-start-date')?.value;
        const endDate = document.getElementById('invoice-end-date')?.value;
        
        if (!studentName || !startDate || !endDate) {
            alert('Please fill all fields');
            return;
        }
        
        this.showLoading();
        
        try {
            const invoice = await this.dataManager.generateInvoice(studentName, startDate, endDate);
            this.showReportContent(invoice, `🧾 INVOICE for ${studentName}`);
        } catch (error) {
            this.showError('Error generating invoice: ' + error.message);
        }
    }

    async downloadInvoiceAsPDF() {
        const studentName = document.getElementById('invoice-student')?.value;
        const startDate = document.getElementById('invoice-start-date')?.value;
        const endDate = document.getElementById('invoice-end-date')?.value;
        
        if (!studentName || !startDate || !endDate) {
            alert('Please fill all fields');
            return;
        }
        
        this.showLoading();
        
        try {
            const invoice = await this.dataManager.generateInvoice(studentName, startDate, endDate);
            const filename = `Invoice_${studentName}_${new Date().toISOString().slice(0,10)}`;
            this.exportAsPDF(invoice, filename);
        } catch (error) {
            this.showError('Error generating invoice PDF: ' + error.message);
        }
    }

    async emailInvoice() {
        const studentName = document.getElementById('invoice-student')?.value;
        const startDate = document.getElementById('invoice-start-date')?.value;
        const endDate = document.getElementById('invoice-end-date')?.value;
        
        if (!studentName || !startDate || !endDate) {
            alert('Please fill all fields');
            return;
        }
        
        const toEmail = prompt('Enter recipient email address:');
        if (!toEmail) return;
        
        this.showLoading();
        
        try {
            const invoice = await this.dataManager.generateInvoice(studentName, startDate, endDate);
            const subject = `Invoice for ${studentName}`;
            const body = `Hello,\n\nPlease find the attached invoice.\n\n${invoice}\n\nBest regards,\nWorkLogPro Team`;
            
            const mailtoLink = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.open(mailtoLink, '_blank');
            
            this.updateReportContent(`
                <div class="alert alert-success">
                    <h5><i class="fas fa-check-circle"></i> Email Ready!</h5>
                    <p>Your invoice has been prepared for email.</p>
                    <p><strong>Recipient:</strong> ${toEmail}</p>
                    <p><strong>Student:</strong> ${studentName}</p>
                    <div class="mt-3">
                        <button onclick="window.reportManager.showInvoiceGenerator()" class="btn btn-outline-success btn-sm">
                            Back to Invoice Generator
                        </button>
                    </div>
                </div>
            `);
        } catch (error) {
            this.showError('Error preparing invoice email: ' + error.message);
        }
    }

    showReportContent(report, title) {
        let html = '<div class="report-display">';
        html += `<h4>${title}</h4>`;
        html += '<div class="btn-group mb-3" role="group">';
        html += '<button id="copy-report" class="btn btn-outline-secondary btn-sm">';
        html += '<i class="fas fa-copy"></i> Copy';
        html += '</button>';
        html += '<button id="print-report" class="btn btn-outline-secondary btn-sm">';
        html += '<i class="fas fa-print"></i> Print';
        html += '</button>';
        html += '<button id="save-report" class="btn btn-outline-secondary btn-sm">';
        html += '<i class="fas fa-download"></i> Save';
        html += '</button>';
        html += '</div>';
        html += `<div class="report-content card">`;
        html += `<div class="card-body">`;
        html += `<pre style="white-space: pre-wrap; margin: 0; font-family: 'Courier New', monospace; font-size: 0.9rem;">${report}</pre>`;
        html += `</div></div>`;
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Add event listeners
        const copyBtn = document.getElementById('copy-report');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(report).then(() => {
                    this.showToast('Report copied to clipboard!');
                });
            });
        }
        
        const printBtn = document.getElementById('print-report');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <html>
                    <head>
                        <title>${title}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            pre { white-space: pre-wrap; font-size: 12px; }
                            @media print {
                                body { padding: 0; }
                                @page { margin: 0.5in; }
                            }
                        </style>
                    </head>
                    <body>
                        <h2>${title}</h2>
                        <pre>${report}</pre>
                        <script>
                            window.onload = function() {
                                window.print();
                                setTimeout(function() {
                                    window.close();
                                }, 500);
                            }
                        <\/script>
                    </body>
                    </html>
                `);
            });
        }
        
        const saveBtn = document.getElementById('save-report');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const blob = new Blob([report], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('Report saved as text file!');
            });
        }
    }

    updateReportContent(html) {
        const reportContent = document.getElementById('report-content');
        if (reportContent) {
            reportContent.innerHTML = html;
        }
    }

    showLoading() {
        this.updateReportContent(`
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Generating report...</p>
            </div>
        `);
    }

    showError(message) {
        this.updateReportContent(`
            <div class="alert alert-danger">
                <h5><i class="fas fa-exclamation-circle"></i> Error</h5>
                <p>${message}</p>
                <button onclick="window.reportManager.initialize()" class="btn btn-outline-danger btn-sm">
                    Try Again
                </button>
            </div>
        `);
    }

    showToast(message) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast show align-items-center text-bg-success border-0 position-fixed bottom-0 end-0 m-3';
        toast.style.zIndex = '1060';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize ReportManager
let reportManager = null;

// Function to initialize when reports section is shown
function initializeReports() {
    if (!reportManager) {
        reportManager = new ReportManager();
        window.reportManager = reportManager;
    }
}

// Export for use in other files
export { ReportManager, initializeReports };

// Auto-initialize if we're already in reports section
if (document.getElementById('reports-section')?.style.display === 'block') {
    setTimeout(() => {
        initializeReports();
    }, 100);
}
