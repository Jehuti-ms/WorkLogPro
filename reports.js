// reports.js - COMPLETE REPORTS SYSTEM

import DataManager from './data-manager.js';

class ReportManager {
    constructor() {
        this.dataManager = new DataManager();
        this.initialized = false;
        this.subjects = [];
        this.students = [];
        
        this.init();
    }

    async init() {
        try {
            // Load initial data
            [this.subjects, this.students] = await Promise.all([
                this.dataManager.getAllSubjects(),
                this.dataManager.getAllStudents()
            ]);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update overview stats
            await this.updateOverviewStats();
            
            this.initialized = true;
            console.log('Report Manager initialized successfully');
        } catch (error) {
            console.error('Error initializing Report Manager:', error);
        }
    }

    setupEventListeners() {
        // Weekly Report
        const weeklyBtn = document.getElementById('weeklyReportBtn');
        if (weeklyBtn) {
            weeklyBtn.addEventListener('click', () => this.displayReport('weekly'));
        }

        // Bi-weekly Report
        const biWeeklyBtn = document.getElementById('biWeeklyReportBtn');
        if (biWeeklyBtn) {
            biWeeklyBtn.addEventListener('click', () => this.displayReport('biweekly'));
        }

        // Monthly Report
        const monthlyBtn = document.getElementById('monthlyReportBtn');
        if (monthlyBtn) {
            monthlyBtn.addEventListener('click', () => this.displayReport('monthly'));
        }

        // Subject Report
        const subjectBtn = document.getElementById('subjectReportBtn');
        if (subjectBtn) {
            subjectBtn.addEventListener('click', () => this.showSubjectSelector());
        }

        // Claim Form
        const claimBtn = document.getElementById('claimFormBtn');
        if (claimBtn) {
            claimBtn.addEventListener('click', () => this.showClaimFormOptions());
        }

        // Invoice
        const invoiceBtn = document.getElementById('invoiceBtn');
        if (invoiceBtn) {
            invoiceBtn.addEventListener('click', () => this.showInvoiceGenerator());
        }

        // PDF Export
        const pdfBtn = document.getElementById('pdfReportBtn');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => this.showPDFOptions());
        }

        // Email Report
        const emailBtn = document.getElementById('emailReportBtn');
        if (emailBtn) {
            emailBtn.addEventListener('click', () => this.showEmailForm());
        }
    }

    async updateOverviewStats() {
        try {
            const logs = await this.dataManager.getAllLogs();
            const students = await this.dataManager.getAllStudents();
            
            // Calculate totals
            const totalHours = logs.reduce((sum, log) => sum + parseFloat(log.duration || 0), 0);
            const totalEarnings = logs.reduce((sum, log) => {
                const student = students.find(s => s.name === log.studentName);
                const rate = student?.hourlyRate || 0;
                return sum + (parseFloat(log.duration || 0) * rate);
            }, 0);
            
            // Calculate marks (assuming logs have marks property)
            const logsWithMarks = logs.filter(log => log.mark);
            const avgMark = logsWithMarks.length > 0 
                ? logsWithMarks.reduce((sum, log) => sum + parseFloat(log.mark), 0) / logsWithMarks.length 
                : 0;
            
            // Update DOM
            document.getElementById('totalStudentsReport').textContent = students.length;
            document.getElementById('totalHoursReport').textContent = totalHours.toFixed(2);
            document.getElementById('totalEarningsReport').textContent = `$${totalEarnings.toFixed(2)}`;
            document.getElementById('avgMarkReport').textContent = `${avgMark.toFixed(1)}%`;
            
            // TODO: Add payment calculations when payment system is implemented
            document.getElementById('totalPaymentsReport').textContent = '$0';
            document.getElementById('outstandingBalance').textContent = `$${totalEarnings.toFixed(2)}`;
            
        } catch (error) {
            console.error('Error updating overview stats:', error);
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
        let html = '<div class="subject-selector">';
        html += '<h4>📚 Select Subject for Report</h4>';
        
        if (this.subjects.length === 0) {
            html += '<p class="empty-message">No subjects detected in your logs.</p>';
        } else {
            html += '<select id="subjectSelect" class="form-input" style="margin-bottom: 15px; width: 100%;">';
            html += '<option value="">Choose a subject...</option>';
            
            this.subjects.forEach(subject => {
                html += `<option value="${subject}">${subject.charAt(0).toUpperCase() + subject.slice(1)}</option>`;
            });
            
            html += '</select>';
        }
        
        html += '<input type="text" id="customSubject" placeholder="Or enter custom subject" class="form-input" style="margin-bottom: 15px; width: 100%;">';
        html += '<button id="generateSubjectReport" class="button small" style="width: 100%;">Generate Report</button>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        document.getElementById('generateSubjectReport')?.addEventListener('click', async () => {
            const select = document.getElementById('subjectSelect');
            const custom = document.getElementById('customSubject')?.value.trim() || '';
            
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

    showPDFOptions() {
        let html = '<div class="pdf-options">';
        html += '<h4>📄 Export Report as PDF</h4>';
        html += '<p>Select report type to export:</p>';
        
        const reportTypes = [
            { id: 'pdfWeekly', value: 'weekly', label: 'Weekly Report' },
            { id: 'pdfBiWeekly', value: 'biweekly', label: 'Bi-Weekly Report' },
            { id: 'pdfMonthly', value: 'monthly', label: 'Monthly Report' },
            { id: 'pdfSubject', value: 'subject', label: 'Subject Report' },
            { id: 'pdfClaim', value: 'claim', label: 'Claim Form' },
            { id: 'pdfInvoice', value: 'invoice', label: 'Invoice' }
        ];
        
        reportTypes.forEach((type, index) => {
            html += `
                <div style="margin: 10px 0;">
                    <input type="radio" id="${type.id}" name="pdfType" value="${type.value}" ${index === 0 ? 'checked' : ''}>
                    <label for="${type.id}" style="margin-left: 8px;">${type.label}</label>
                </div>
            `;
        });
        
        // Subject selector
        html += '<div id="pdfSubjectSelect" style="display: none; margin: 15px 0;">';
        html += '<select id="pdfSubjectChoice" class="form-input" style="width: 100%;">';
        html += '<option value="">Select subject...</option>';
        this.subjects.forEach(subject => {
            html += `<option value="${subject}">${subject.charAt(0).toUpperCase() + subject.slice(1)}</option>`;
        });
        html += '</select>';
        html += '</div>';
        
        // Student selector for invoice
        html += '<div id="pdfStudentSelect" style="display: none; margin: 15px 0;">';
        html += '<select id="pdfStudentChoice" class="form-input" style="width: 100%;">';
        html += '<option value="">Select student...</option>';
        this.students.forEach(student => {
            const rate = student.hourlyRate ? ` ($${student.hourlyRate}/hr)` : '';
            html += `<option value="${student.name}">${student.name}${rate}</option>`;
        });
        html += '</select>';
        html += '</div>';
        
        // Date range for invoice
        html += '<div id="pdfDateRange" style="display: none; margin: 15px 0;">';
        html += '<div style="margin-bottom: 10px;">';
        html += '<label>Start Date:</label>';
        html += '<input type="date" id="pdfStartDate" class="form-input" style="width: 100%;">';
        html += '</div>';
        html += '<div>';
        html += '<label>End Date:</label>';
        html += '<input type="date" id="pdfEndDate" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        html += '</div>';
        
        // Claim form options
        html += '<div id="pdfClaimOptions" style="display: none; margin: 15px 0;">';
        html += '<div style="margin-bottom: 10px;">';
        html += '<label>Claim Type:</label>';
        html += '<select id="pdfClaimType" class="form-input" style="width: 100%;">';
        html += '<option value="weekly">Weekly Claim</option>';
        html += '<option value="biweekly">Bi-Weekly Claim</option>';
        html += '<option value="monthly">Monthly Claim</option>';
        html += '</select>';
        html += '</div>';
        html += '<div>';
        html += '<label>Period End Date:</label>';
        html += '<input type="date" id="pdfClaimEndDate" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        html += '</div>';
        
        html += '<button id="generatePDF" class="button success" style="width: 100%; margin-top: 20px;">Generate PDF</button>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Show/hide options based on selection
        document.querySelectorAll('input[name="pdfType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('pdfSubjectSelect').style.display = e.target.value === 'subject' ? 'block' : 'none';
                document.getElementById('pdfStudentSelect').style.display = e.target.value === 'invoice' ? 'block' : 'none';
                document.getElementById('pdfDateRange').style.display = e.target.value === 'invoice' ? 'block' : 'none';
                document.getElementById('pdfClaimOptions').style.display = e.target.value === 'claim' ? 'block' : 'none';
            });
        });
        
        document.getElementById('generatePDF')?.addEventListener('click', async () => {
            await this.generatePDF();
        });
    }

    async generatePDF() {
        const selectedRadio = document.querySelector('input[name="pdfType"]:checked');
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
                    const subject = document.getElementById('pdfSubjectChoice')?.value;
                    if (!subject) {
                        alert('Please select a subject');
                        return;
                    }
                    report = await this.dataManager.generateSubjectReport(subject);
                    filename = `${subject}_Report_${new Date().toISOString().slice(0,10)}`;
                    break;
                case 'claim':
                    const claimType = document.getElementById('pdfClaimType')?.value;
                    const endDate = document.getElementById('pdfClaimEndDate')?.value;
                    report = await this.dataManager.generateClaimForm(claimType, endDate);
                    filename = `${claimType}_Claim_Form_${new Date().toISOString().slice(0,10)}`;
                    break;
                case 'invoice':
                    const studentName = document.getElementById('pdfStudentChoice')?.value;
                    const startDate = document.getElementById('pdfStartDate')?.value;
                    const invoiceEndDate = document.getElementById('pdfEndDate')?.value;
                    
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
        if (typeof jspdf === 'undefined') {
            this.updateReportContent(`
                <div class="alert-warning" style="padding: 15px; border-radius: 5px; background: #fff3cd; border: 1px solid #ffc107;">
                    <h5 style="margin-top: 0;">⚠️ PDF Library Not Available</h5>
                    <p>To export PDFs, please include jsPDF in your project:</p>
                    <code>&lt;script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"&gt;&lt;/script&gt;</code>
                    <div style="margin-top: 15px;">
                        <button onclick="downloadAsText('${content.replace(/'/g, "\\'")}', '${filename}.txt')" 
                                class="button small" style="width: 100%;">
                            📥 Download as Text File
                        </button>
                    </div>
                </div>
            `);
            return;
        }
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Add title
            doc.setFontSize(16);
            doc.text("WorkLogPro Report", 20, 20);
            
            // Add date
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
            
            // Add content
            const lines = doc.splitTextToSize(content, 170);
            let y = 40;
            
            doc.setFontSize(9);
            lines.forEach(line => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 20, y);
                y += 5;
            });
            
            // Save PDF
            doc.save(`${filename}.pdf`);
            
            this.updateReportContent(`
                <div class="alert-success" style="padding: 15px; border-radius: 5px; background: #d1e7dd; border: 1px solid #198754;">
                    <h5 style="margin-top: 0;">✅ PDF Generated Successfully!</h5>
                    <p>File <strong>${filename}.pdf</strong> has been downloaded.</p>
                    <button onclick="window.reportManager.showPDFOptions()" class="button small success" style="margin-top: 10px;">
                        Generate Another PDF
                    </button>
                </div>
            `);
            
        } catch (error) {
            this.showError('Error creating PDF: ' + error.message);
        }
    }

    showEmailForm() {
        let html = '<div class="email-form">';
        html += '<h4>📧 Email Report</h4>';
        html += '<p>Send report to:</p>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Recipient Email:</label>';
        html += '<input type="email" id="emailTo" class="form-input" placeholder="recipient@example.com" style="width: 100%;">';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Report Type:</label>';
        html += '<select id="emailReportType" class="form-input" style="width: 100%;">';
        html += '<option value="weekly">Weekly Report</option>';
        html += '<option value="biweekly">Bi-Weekly Report</option>';
        html += '<option value="monthly">Monthly Report</option>';
        html += '<option value="subject">Subject Report</option>';
        html += '<option value="claim">Claim Form</option>';
        html += '<option value="invoice">Invoice</option>';
        html += '</select>';
        html += '</div>';
        
        // Dynamic options
        html += '<div id="emailOptionsContainer"></div>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Additional Message (optional):</label>';
        html += '<textarea id="emailMessage" class="form-input" rows="3" placeholder="Add a personal message..." style="width: 100%;"></textarea>';
        html += '</div>';
        
        html += '<div style="display: flex; gap: 10px;">';
        html += '<button id="sendEmail" class="button info" style="flex: 1;">Send Email</button>';
        html += '<button id="previewEmail" class="button" style="flex: 1;">Preview</button>';
        html += '</div>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Initialize options
        this.updateEmailOptions('weekly');
        
        // Listen for changes
        document.getElementById('emailReportType')?.addEventListener('change', (e) => {
            this.updateEmailOptions(e.target.value);
        });
        
        // Button listeners
        document.getElementById('sendEmail')?.addEventListener('click', async () => {
            await this.sendEmail();
        });
        
        document.getElementById('previewEmail')?.addEventListener('click', async () => {
            await this.previewEmail();
        });
    }

    updateEmailOptions(reportType) {
        const container = document.getElementById('emailOptionsContainer');
        if (!container) return;
        
        let html = '';
        
        switch(reportType) {
            case 'subject':
                html += '<div style="margin-bottom: 15px;">';
                html += '<label>Subject:</label>';
                html += '<input type="text" id="emailSubject" class="form-input" placeholder="Enter subject" style="width: 100%;">';
                html += '</div>';
                break;
            case 'claim':
                html += '<div style="margin-bottom: 15px;">';
                html += '<label>Claim Type:</label>';
                html += '<select id="emailClaimType" class="form-input" style="width: 100%;">';
                html += '<option value="weekly">Weekly Claim</option>';
                html += '<option value="biweekly">Bi-Weekly Claim</option>';
                html += '<option value="monthly">Monthly Claim</option>';
                html += '</select>';
                html += '</div>';
                html += '<div style="margin-bottom: 15px;">';
                html += '<label>Period End Date:</label>';
                html += '<input type="date" id="emailClaimEndDate" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
                html += '</div>';
                break;
            case 'invoice':
                html += '<div style="margin-bottom: 15px;">';
                html += '<label>Student:</label>';
                html += '<select id="emailInvoiceStudent" class="form-input" style="width: 100%;">';
                html += '<option value="">Select student...</option>';
                this.students.forEach(student => {
                    html += `<option value="${student.name}">${student.name}</option>`;
                });
                html += '</select>';
                html += '</div>';
                html += '<div style="margin-bottom: 15px;">';
                html += '<label>Start Date:</label>';
                html += '<input type="date" id="emailInvoiceStart" class="form-input" style="width: 100%;">';
                html += '</div>';
                html += '<div style="margin-bottom: 15px;">';
                html += '<label>End Date:</label>';
                html += '<input type="date" id="emailInvoiceEnd" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
                html += '</div>';
                break;
        }
        
        container.innerHTML = html;
    }

    async previewEmail() {
        const reportType = document.getElementById('emailReportType')?.value;
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
                    const subject = document.getElementById('emailSubject')?.value.trim();
                    if (!subject) {
                        alert('Please enter a subject');
                        return;
                    }
                    report = await this.dataManager.generateSubjectReport(subject);
                    title = `Subject Report: ${subject}`;
                    break;
                case 'claim':
                    const claimType = document.getElementById('emailClaimType')?.value;
                    const endDate = document.getElementById('emailClaimEndDate')?.value;
                    report = await this.dataManager.generateClaimForm(claimType, endDate);
                    title = `${claimType} Claim Form`;
                    break;
                case 'invoice':
                    const studentName = document.getElementById('emailInvoiceStudent')?.value;
                    const startDate = document.getElementById('emailInvoiceStart')?.value;
                    const invoiceEndDate = document.getElementById('emailInvoiceEnd')?.value;
                    
                    if (!studentName || !startDate || !invoiceEndDate) {
                        alert('Please fill all invoice fields');
                        return;
                    }
                    report = await this.dataManager.generateInvoice(studentName, startDate, invoiceEndDate);
                    title = `Invoice for ${studentName}`;
                    break;
            }
            
            const message = document.getElementById('emailMessage')?.value.trim() || '';
            
            let preview = `<h4>Email Preview: ${title}</h4>`;
            preview += `<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px;">`;
            preview += `<p><strong>To:</strong> [Enter email address]</p>`;
            preview += `<p><strong>Subject:</strong> ${title}</p>`;
            preview += `<hr>`;
            preview += `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px;">`;
            preview += `Hello,\n\nPlease find the attached report.\n\n`;
            if (message) {
                preview += `Message: ${message}\n\n`;
            }
            preview += `${report}\n\nBest regards,\nWorkLogPro Team`;
            preview += `</pre>`;
            preview += `</div>`;
            
            preview += `<div style="margin-top: 15px;">`;
            preview += `<button onclick="window.reportManager.showEmailForm()" class="button small">`;
            preview += `Back to Email Form`;
            preview += `</button>`;
            preview += `</div>`;
            
            this.updateReportContent(preview);
            
        } catch (error) {
            this.showError('Error generating preview: ' + error.message);
        }
    }

    async sendEmail() {
        const toEmail = document.getElementById('emailTo')?.value.trim();
        const reportType = document.getElementById('emailReportType')?.value;
        const message = document.getElementById('emailMessage')?.value.trim() || '';
        
        if (!toEmail) {
            alert('Please enter recipient email address');
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
                    const customSubject = document.getElementById('emailSubject')?.value.trim();
                    if (!customSubject) {
                        alert('Please enter a subject for the subject report');
                        return;
                    }
                    report = await this.dataManager.generateSubjectReport(customSubject);
                    subject = `WorkLogPro Subject Report: ${customSubject}`;
                    break;
                case 'claim':
                    const claimType = document.getElementById('emailClaimType')?.value;
                    const endDate = document.getElementById('emailClaimEndDate')?.value;
                    report = await this.dataManager.generateClaimForm(claimType, endDate);
                    subject = `WorkLogPro ${claimType} Claim Form`;
                    break;
                case 'invoice':
                    const studentName = document.getElementById('emailInvoiceStudent')?.value;
                    const startDate = document.getElementById('emailInvoiceStart')?.value;
                    const invoiceEndDate = document.getElementById('emailInvoiceEnd')?.value;
                    
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
            window.open(mailtoLink, '_blank');
            
            this.updateReportContent(`
                <div class="alert-success" style="padding: 15px; border-radius: 5px; background: #d1e7dd; border: 1px solid #198754;">
                    <h4 style="margin-top: 0;">✅ Email Ready!</h4>
                    <p>Your email client has been opened with the report.</p>
                    <p><strong>To:</strong> ${toEmail}</p>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <button onclick="window.reportManager.showEmailForm()" class="button small success" style="margin-top: 10px;">
                        Send Another Email
                    </button>
                </div>
            `);
            
        } catch (error) {
            this.showError('Error preparing email: ' + error.message);
        }
    }

    async showClaimFormOptions() {
        let html = '<div class="claim-form-options">';
        html += '<h4>💰 Generate Claim Form</h4>';
        html += '<p>Create a claim form for payment submission:</p>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Claim Type:</label>';
        html += '<select id="claimType" class="form-input" style="width: 100%;">';
        html += '<option value="weekly">Weekly Claim</option>';
        html += '<option value="biweekly">Bi-Weekly Claim</option>';
        html += '<option value="monthly">Monthly Claim</option>';
        html += '</select>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Period End Date:</label>';
        html += '<input type="date" id="claimEndDate" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        
        html += '<div style="display: flex; gap: 10px; margin-top: 20px;">';
        html += '<button id="generateClaim" class="button" style="flex: 1;">Preview</button>';
        html += '<button id="downloadClaimPDF" class="button success" style="flex: 1;">PDF</button>';
        html += '<button id="emailClaim" class="button info" style="flex: 1;">Email</button>';
        html += '</div>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Add event listeners
        document.getElementById('generateClaim')?.addEventListener('click', async () => {
            await this.generateClaimForm();
        });
        
        document.getElementById('downloadClaimPDF')?.addEventListener('click', async () => {
            await this.downloadClaimAsPDF();
        });
        
        document.getElementById('emailClaim')?.addEventListener('click', async () => {
            await this.emailClaimForm();
        });
    }

    async generateClaimForm() {
        const claimType = document.getElementById('claimType')?.value;
        const endDate = document.getElementById('claimEndDate')?.value;
        
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
        const claimType = document.getElementById('claimType')?.value;
        const endDate = document.getElementById('claimEndDate')?.value;
        
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
        const claimType = document.getElementById('claimType')?.value;
        const endDate = document.getElementById('claimEndDate')?.value;
        
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
                <div class="alert-success" style="padding: 15px; border-radius: 5px; background: #d1e7dd; border: 1px solid #198754;">
                    <h4 style="margin-top: 0;">✅ Email Ready!</h4>
                    <p>Your claim form has been prepared for email.</p>
                    <p><strong>Recipient:</strong> ${toEmail}</p>
                    <button onclick="window.reportManager.showClaimFormOptions()" class="button small success" style="margin-top: 10px;">
                        Back to Claim Forms
                    </button>
                </div>
            `);
        } catch (error) {
            this.showError('Error preparing claim email: ' + error.message);
        }
    }

    async showInvoiceGenerator() {
        let html = '<div class="invoice-generator">';
        html += '<h4>🧾 Generate Invoice</h4>';
        html += '<p>Create a professional invoice for a student:</p>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Select Student:</label>';
        html += '<select id="invoiceStudent" class="form-input" style="width: 100%;">';
        html += '<option value="">Select a student...</option>';
        
        this.students.forEach(student => {
            const rate = student.hourlyRate ? ` ($${student.hourlyRate}/hr)` : '';
            html += `<option value="${student.name}">${student.name}${rate}</option>`;
        });
        
        html += '</select>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>Start Date:</label>';
        html += '<input type="date" id="invoiceStartDate" class="form-input" style="width: 100%;">';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<label>End Date:</label>';
        html += '<input type="date" id="invoiceEndDate" class="form-input" style="width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        
        html += '<div style="display: flex; gap: 10px; margin-top: 20px;">';
        html += '<button id="generateInvoice" class="button" style="flex: 1;">Preview</button>';
        html += '<button id="downloadInvoicePDF" class="button success" style="flex: 1;">PDF</button>';
        html += '<button id="emailInvoice" class="button info" style="flex: 1;">Email</button>';
        html += '</div>';
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Add event listeners
        document.getElementById('generateInvoice')?.addEventListener('click', async () => {
            await this.generateInvoice();
        });
        
        document.getElementById('downloadInvoicePDF')?.addEventListener('click', async () => {
            await this.downloadInvoiceAsPDF();
        });
        
        document.getElementById('emailInvoice')?.addEventListener('click', async () => {
            await this.emailInvoice();
        });
    }

    async generateInvoice() {
        const studentName = document.getElementById('invoiceStudent')?.value;
        const startDate = document.getElementById('invoiceStartDate')?.value;
        const endDate = document.getElementById('invoiceEndDate')?.value;
        
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
        const studentName = document.getElementById('invoiceStudent')?.value;
        const startDate = document.getElementById('invoiceStartDate')?.value;
        const endDate = document.getElementById('invoiceEndDate')?.value;
        
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
        const studentName = document.getElementById('invoiceStudent')?.value;
        const startDate = document.getElementById('invoiceStartDate')?.value;
        const endDate = document.getElementById('invoiceEndDate')?.value;
        
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
                <div class="alert-success" style="padding: 15px; border-radius: 5px; background: #d1e7dd; border: 1px solid #198754;">
                    <h4 style="margin-top: 0;">✅ Email Ready!</h4>
                    <p>Your invoice has been prepared for email.</p>
                    <p><strong>Recipient:</strong> ${toEmail}</p>
                    <p><strong>Student:</strong> ${studentName}</p>
                    <button onclick="window.reportManager.showInvoiceGenerator()" class="button small success" style="margin-top: 10px;">
                        Back to Invoice Generator
                    </button>
                </div>
            `);
        } catch (error) {
            this.showError('Error preparing invoice email: ' + error.message);
        }
    }

    showReportContent(report, title) {
        let html = '<div class="report-display">';
        html += `<h4>${title}</h4>`;
        html += '<div style="margin-bottom: 15px; display: flex; gap: 10px;">';
        html += '<button id="copyReport" class="button small">Copy</button>';
        html += '<button id="printReport" class="button small">Print</button>';
        html += '<button id="saveReport" class="button small">Save</button>';
        html += '</div>';
        html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; max-height: 400px; overflow-y: auto;">`;
        html += `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${report}</pre>`;
        html += `</div>`;
        html += '</div>';
        
        this.updateReportContent(html);
        
        // Add event listeners
        document.getElementById('copyReport')?.addEventListener('click', () => {
            navigator.clipboard.writeText(report).then(() => {
                alert('Report copied to clipboard!');
            });
        });
        
        document.getElementById('printReport')?.addEventListener('click', () => {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        pre { white-space: pre-wrap; font-size: 12px; }
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
        
        document.getElementById('saveReport')?.addEventListener('click', () => {
            const blob = new Blob([report], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('Report saved as text file!');
        });
    }

    updateReportContent(html) {
        const reportContent = document.getElementById('report-content');
        if (reportContent) {
            reportContent.innerHTML = html;
        }
    }

    showLoading() {
        this.updateReportContent(`
            <div style="text-align: center; padding: 50px;">
                <div class="spinner"></div>
                <p style="margin-top: 15px; color: #666;">Generating report...</p>
            </div>
        `);
    }

    showError(message) {
        this.updateReportContent(`
            <div style="padding: 15px; border-radius: 5px; background: #f8d7da; border: 1px solid #dc3545;">
                <h5 style="margin-top: 0; color: #721c24;">❌ Error</h5>
                <p style="color: #721c24;">${message}</p>
                <button onclick="window.reportManager.init()" class="button small" style="margin-top: 10px;">
                    Try Again
                </button>
            </div>
        `);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.reportManager = new ReportManager();
});

// Helper function for text download
window.downloadAsText = function(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
