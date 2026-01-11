// reports.js - COMPLETE REPORTS SYSTEM

import DataManager from './data-manager.js';

class ReportManager {
    constructor() {
        this.dataManager = new DataManager();
        this.initEventListeners();
        this.loadInitialData();
    }

    async loadInitialData() {
        try {
            this.subjects = await this.dataManager.getAllSubjects();
            this.students = await this.dataManager.getAllStudents();
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    initEventListeners() {
        // Weekly Report
        document.getElementById('weekly-report-btn')?.addEventListener('click', () => {
            this.displayReport('weekly');
        });

        // Bi-weekly Report
        document.getElementById('biweekly-report-btn')?.addEventListener('click', () => {
            this.displayReport('biweekly');
        });

        // Monthly Report
        document.getElementById('monthly-report-btn')?.addEventListener('click', () => {
            this.displayReport('monthly');
        });

        // Subject Report
        document.getElementById('subject-report-btn')?.addEventListener('click', () => {
            this.showSubjectSelector();
        });

        // PDF Export
        document.getElementById('pdf-export-btn')?.addEventListener('click', () => {
            this.showPDFOptions();
        });

        // Email Report
        document.getElementById('email-report-btn')?.addEventListener('click', () => {
            this.showEmailForm();
        });

        // Claim Form
        document.getElementById('claim-form-btn')?.addEventListener('click', () => {
            this.showClaimFormOptions();
        });

        // Invoice Generator
        document.getElementById('invoice-btn')?.addEventListener('click', () => {
            this.showInvoiceGenerator();
        });
    }

    async displayReport(type) {
        this.showLoading();
        
        try {
            let report;
            let title;
            
            switch(type) {
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
            }
            
            this.showReportContent(report, title);
        } catch (error) {
            this.showError('Error generating report: ' + error.message);
        }
    }

    async showSubjectSelector() {
        await this.loadInitialData();
        
        let html = '<div class="subject-selector">';
        html += '<h3>Select Subject for Report</h3>';
        
        if (this.subjects.length === 0) {
            html += '<p class="text-muted">No subjects detected in your logs.</p>';
        } else {
            html += '<select id="subject-select" class="form-control" style="margin-bottom: 15px;">';
            html += '<option value="">Choose a subject...</option>';
            
            this.subjects.forEach(subject => {
                html += `<option value="${subject}">${subject.charAt(0).toUpperCase() + subject.slice(1)}</option>`;
            });
            
            html += '</select>';
        }
        
        html += '<div style="margin-top: 10px;">';
        html += '<input type="text" id="custom-subject" placeholder="Or enter custom subject" class="form-control" style="margin-bottom: 10px;">';
        html += '<button id="generate-subject-report" class="btn btn-primary">Generate Report</button>';
        html += '</div></div>';
        
        document.getElementById('report-content').innerHTML = html;
        
        document.getElementById('generate-subject-report')?.addEventListener('click', async () => {
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
                this.showReportContent(report, `Subject Report: ${subject}`);
            } catch (error) {
                this.showError('Error generating subject report: ' + error.message);
            }
        });
    }

    showPDFOptions() {
        let html = '<div class="pdf-options">';
        html += '<h3>Export Report as PDF</h3>';
        html += '<p>Select report type to export:</p>';
        
        const reportTypes = [
            { id: 'pdf-weekly', value: 'weekly', label: 'Weekly Report' },
            { id: 'pdf-biweekly', value: 'biweekly', label: 'Bi-Weekly Report' },
            { id: 'pdf-monthly', value: 'monthly', label: 'Monthly Report' },
            { id: 'pdf-subject', value: 'subject', label: 'Subject Report' },
            { id: 'pdf-claim', value: 'claim', label: 'Claim Form' },
            { id: 'pdf-invoice', value: 'invoice', label: 'Invoice' }
        ];
        
        reportTypes.forEach((type, index) => {
            html += `<div class="pdf-option" style="margin: 10px 0;">`;
            html += `<input type="radio" id="${type.id}" name="pdf-type" value="${type.value}" ${index === 0 ? 'checked' : ''}>`;
            html += `<label for="${type.id}" style="margin-left: 8px;">${type.label}</label>`;
            html += `</div>`;
        });
        
        // Subject selector
        html += '<div id="pdf-subject-select" style="display: none; margin: 15px 0;">';
        html += '<select id="pdf-subject-choice" class="form-control">';
        html += '<option value="">Select subject...</option>';
        if (this.subjects) {
            this.subjects.forEach(subject => {
                html += `<option value="${subject}">${subject.charAt(0).toUpperCase() + subject.slice(1)}</option>`;
            });
        }
        html += '</select>';
        html += '</div>';
        
        // Student selector for invoice
        html += '<div id="pdf-student-select" style="display: none; margin: 15px 0;">';
        html += '<select id="pdf-student-choice" class="form-control">';
        html += '<option value="">Select student...</option>';
        if (this.students) {
            this.students.forEach(student => {
                html += `<option value="${student.name}">${student.name}</option>`;
            });
        }
        html += '</select>';
        html += '</div>';
        
        // Date range for invoice
        html += '<div id="pdf-date-range" style="display: none; margin: 15px 0;">';
        html += '<div class="form-group">';
        html += '<label>Start Date:</label>';
        html += '<input type="date" id="pdf-start-date" class="form-control" style="margin-bottom: 10px;">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>End Date:</label>';
        html += '<input type="date" id="pdf-end-date" class="form-control" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        html += '</div>';
        
        // Claim form options
        html += '<div id="pdf-claim-options" style="display: none; margin: 15px 0;">';
        html += '<div class="form-group">';
        html += '<label>Claim Type:</label>';
        html += '<select id="pdf-claim-type" class="form-control" style="margin-bottom: 10px;">';
        html += '<option value="weekly">Weekly Claim</option>';
        html += '<option value="biweekly">Bi-Weekly Claim</option>';
        html += '<option value="monthly">Monthly Claim</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>Period End Date:</label>';
        html += '<input type="date" id="pdf-claim-end-date" class="form-control" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        html += '</div>';
        
        html += '<div style="margin-top: 20px;">';
        html += '<button id="generate-pdf" class="btn btn-primary">Generate PDF</button>';
        html += '</div></div>';
        
        document.getElementById('report-content').innerHTML = html;
        
        // Show/hide options based on selection
        document.querySelectorAll('input[name="pdf-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const subjectDiv = document.getElementById('pdf-subject-select');
                const studentDiv = document.getElementById('pdf-student-select');
                const dateDiv = document.getElementById('pdf-date-range');
                const claimDiv = document.getElementById('pdf-claim-options');
                
                subjectDiv.style.display = e.target.value === 'subject' ? 'block' : 'none';
                studentDiv.style.display = e.target.value === 'invoice' ? 'block' : 'none';
                dateDiv.style.display = e.target.value === 'invoice' ? 'block' : 'none';
                claimDiv.style.display = e.target.value === 'claim' ? 'block' : 'none';
            });
        });
        
        document.getElementById('generate-pdf')?.addEventListener('click', async () => {
            await this.generatePDF();
        });
    }

    async generatePDF() {
        const selectedType = document.querySelector('input[name="pdf-type"]:checked')?.value;
        if (!selectedType) return;
        
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
        if (typeof jspdf === 'undefined') {
            alert('PDF library not loaded. Please include jsPDF in your HTML file.');
            console.log('PDF content (install jsPDF to export):\n\n', content);
            
            // Fallback: Show content and offer download as text file
            document.getElementById('report-content').innerHTML = 
                `<div class="alert alert-warning">
                    <h4>jsPDF not installed</h4>
                    <p>For PDF export, please include jsPDF library in your HTML:</p>
                    <code>&lt;script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"&gt;&lt;/script&gt;</code>
                    <div style="margin-top: 20px;">
                        <button onclick="downloadAsText('${content.replace(/'/g, "\\'")}', '${filename}.txt')" class="btn btn-secondary">
                            Download as Text File
                        </button>
                    </div>
                </div>`;
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Set document properties
        doc.setProperties({
            title: filename,
            subject: 'WorkLogPro Report',
            author: 'WorkLogPro',
            keywords: 'report, hours, tutoring, invoice',
            creator: 'WorkLogPro'
        });
        
        // Add title
        doc.setFontSize(16);
        doc.setTextColor(40);
        doc.text('WorkLogPro Report', 20, 20);
        
        // Add date
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
        
        // Add content
        const lines = doc.splitTextToSize(content, 170);
        let y = 40;
        
        doc.setFontSize(9);
        doc.setTextColor(20);
        
        lines.forEach(line => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.text(line, 20, y);
            y += 5;
        });
        
        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, 190, 285, null, null, 'right');
            doc.text('WorkLogPro - Professional Work Log Management', 20, 285);
        }
        
        // Save the PDF
        doc.save(`${filename}.pdf`);
        
        document.getElementById('report-content').innerHTML = 
            `<div class="alert alert-success">
                <h4>PDF Generated Successfully!</h4>
                <p>File "${filename}.pdf" has been downloaded.</p>
            </div>`;
    }

    showEmailForm() {
        let html = '<div class="email-form">';
        html += '<h3>Email Report</h3>';
        html += '<p>Send report to:</p>';
        
        html += '<div class="form-group" style="margin-bottom: 15px;">';
        html += '<label>Recipient Email:</label>';
        html += '<input type="email" id="email-to" class="form-control" placeholder="recipient@example.com">';
        html += '</div>';
        
        html += '<div class="form-group" style="margin-bottom: 15px;">';
        html += '<label>Report Type:</label>';
        html += '<select id="email-report-type" class="form-control">';
        html += '<option value="weekly">Weekly Report</option>';
        html += '<option value="biweekly">Bi-Weekly Report</option>';
        html += '<option value="monthly">Monthly Report</option>';
        html += '<option value="subject">Subject Report</option>';
        html += '<option value="claim">Claim Form</option>';
        html += '<option value="invoice">Invoice</option>';
        html += '</select>';
        html += '</div>';
        
        // Dynamic options based on report type
        html += '<div id="email-options-container"></div>';
        
        html += '<div class="form-group" style="margin-bottom: 15px;">';
        html += '<label>Additional Message (optional):</label>';
        html += '<textarea id="email-message" class="form-control" rows="3" placeholder="Add a personal message..."></textarea>';
        html += '</div>';
        
        html += '<button id="send-email" class="btn btn-primary">Send Email</button>';
        html += '</div>';
        
        document.getElementById('report-content').innerHTML = html;
        
        // Show options based on report type
        document.getElementById('email-report-type').addEventListener('change', (e) => {
            this.updateEmailOptions(e.target.value);
        });
        
        // Initialize options
        this.updateEmailOptions('weekly');
        
        document.getElementById('send-email')?.addEventListener('click', async () => {
            await this.sendEmail();
        });
    }

    updateEmailOptions(reportType) {
        const container = document.getElementById('email-options-container');
        let html = '';
        
        switch(reportType) {
            case 'subject':
                html += '<div class="form-group" style="margin-bottom: 15px;">';
                html += '<label>Subject:</label>';
                html += '<input type="text" id="email-subject" class="form-control" placeholder="Enter subject">';
                html += '</div>';
                break;
            case 'claim':
                html += '<div class="form-group" style="margin-bottom: 15px;">';
                html += '<label>Claim Type:</label>';
                html += '<select id="email-claim-type" class="form-control">';
                html += '<option value="weekly">Weekly Claim</option>';
                html += '<option value="biweekly">Bi-Weekly Claim</option>';
                html += '<option value="monthly">Monthly Claim</option>';
                html += '</select>';
                html += '</div>';
                html += '<div class="form-group" style="margin-bottom: 15px;">';
                html += '<label>Period End Date:</label>';
                html += '<input type="date" id="email-claim-end-date" class="form-control" value="' + new Date().toISOString().split('T')[0] + '">';
                html += '</div>';
                break;
            case 'invoice':
                html += '<div class="form-group" style="margin-bottom: 15px;">';
                html += '<label>Student:</label>';
                html += '<select id="email-invoice-student" class="form-control">';
                html += '<option value="">Select student...</option>';
                if (this.students) {
                    this.students.forEach(student => {
                        html += `<option value="${student.name}">${student.name}</option>`;
                    });
                }
                html += '</select>';
                html += '</div>';
                html += '<div class="form-group" style="margin-bottom: 15px;">';
                html += '<label>Start Date:</label>';
                html += '<input type="date" id="email-invoice-start" class="form-control">';
                html += '</div>';
                html += '<div class="form-group" style="margin-bottom: 15px;">';
                html += '<label>End Date:</label>';
                html += '<input type="date" id="email-invoice-end" class="form-control" value="' + new Date().toISOString().split('T')[0] + '">';
                html += '</div>';
                break;
        }
        
        container.innerHTML = html;
    }

    async sendEmail() {
        const toEmail = document.getElementById('email-to')?.value.trim();
        const reportType = document.getElementById('email-report-type')?.value;
        const message = document.getElementById('email-message')?.value.trim() || '';
        
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
            window.location.href = mailtoLink;
            
            document.getElementById('report-content').innerHTML = 
                `<div class="alert alert-success">
                    <h4>Email Ready to Send!</h4>
                    <p>Your email client has been opened with the report content.</p>
                    <p>Recipient: ${toEmail}</p>
                    <p>Subject: ${subject}</p>
                </div>`;
        } catch (error) {
            this.showError('Error preparing email: ' + error.message);
        }
    }

    async showClaimFormOptions() {
        let html = '<div class="claim-form-options">';
        html += '<h3>Generate Claim Form</h3>';
        html += '<p>Select claim period:</p>';
        
        html += '<div class="form-group" style="margin-bottom: 15px;">';
        html += '<label>Claim Type:</label>';
        html += '<select id="claim-type" class="form-control">';
        html += '<option value="weekly">Weekly Claim</option>';
        html += '<option value="biweekly">Bi-Weekly Claim</option>';
        html += '<option value="monthly">Monthly Claim</option>';
        html += '</select>';
        html += '</div>';
        
        html += '<div class="form-group" style="margin-bottom: 15px;">';
        html += '<label>Period End Date:</label>';
        html += '<input type="date" id="claim-end-date" class="form-control" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        
        html += '<div style="margin-top: 20px;">';
        html += '<button id="generate-claim" class="btn btn-primary">Generate Claim Form</button>';
        html += '<button id="download-claim-pdf" class="btn btn-secondary" style="margin-left: 10px;">Download as PDF</button>';
        html += '<button id="email-claim" class="btn btn-info" style="margin-left: 10px;">Email Claim Form</button>';
        html += '</div></div>';
        
        document.getElementById('report-content').innerHTML = html;
        
        document.getElementById('generate-claim')?.addEventListener('click', async () => {
            await this.generateClaimForm();
        });
        
        document.getElementById('download-claim-pdf')?.addEventListener('click', async () => {
            await this.downloadClaimAsPDF();
        });
        
        document.getElementById('email-claim')?.addEventListener('click', async () => {
            await this.emailClaimForm();
        });
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
            this.showReportContent(claim, `${claimType.toUpperCase()} CLAIM FORM`);
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
            window.location.href = mailtoLink;
            
            document.getElementById('report-content').innerHTML = 
                `<div class="alert alert-success">
                    <h4>Email Ready to Send!</h4>
                    <p>Your claim form has been prepared for email.</p>
                    <p>Recipient: ${toEmail}</p>
                </div>`;
        } catch (error) {
            this.showError('Error preparing claim email: ' + error.message);
        }
    }

    async showInvoiceGenerator() {
        await this.loadInitialData();
        
        let html = '<div class="invoice-generator">';
        html += '<h3>Generate Invoice</h3>';
        
        html += '<div class="form-group" style="margin-bottom: 15px;">';
        html += '<label>Select Student:</label>';
        html += '<select id="invoice-student" class="form-control">';
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
        
        html += '<div class="form-group" style="margin-bottom: 15px;">';
        html += '<label>Invoice Period Start Date:</label>';
        html += '<input type="date" id="invoice-start-date" class="form-control">';
        html += '</div>';
        
        html += '<div class="form-group" style="margin-bottom: 15px;">';
        html += '<label>Invoice Period End Date:</label>';
        html += '<input type="date" id="invoice-end-date" class="form-control" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        
        html += '<div style="margin-top: 20px;">';
        html += '<button id="generate-invoice" class="btn btn-primary">Generate Invoice</button>';
        html += '<button id="download-invoice-pdf" class="btn btn-secondary" style="margin-left: 10px;">Download as PDF</button>';
        html += '<button id="email-invoice" class="btn btn-info" style="margin-left: 10px;">Email Invoice</button>';
        html += '</div></div>';
        
        document.getElementById('report-content').innerHTML = html;
        
        document.getElementById('generate-invoice')?.addEventListener('click', async () => {
            await this.generateInvoice();
        });
        
        document.getElementById('download-invoice-pdf')?.addEventListener('click', async () => {
            await this.downloadInvoiceAsPDF();
        });
        
        document.getElementById('email-invoice')?.addEventListener('click', async () => {
            await this.emailInvoice();
        });
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
            this.showReportContent(invoice, `INVOICE for ${studentName}`);
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
            window.location.href = mailtoLink;
            
            document.getElementById('report-content').innerHTML = 
                `<div class="alert alert-success">
                    <h4>Email Ready to Send!</h4>
                    <p>Your invoice has been prepared for email.</p>
                    <p>Recipient: ${toEmail}</p>
                    <p>Student: ${studentName}</p>
                </div>`;
        } catch (error) {
            this.showError('Error preparing invoice email: ' + error.message);
        }
    }

    showReportContent(report, title) {
        let html = '<div class="report-display">';
        html += `<h3>${title}</h3>`;
        html += '<div class="report-actions" style="margin-bottom: 15px;">';
        html += '<button id="copy-report" class="btn btn-sm btn-outline-secondary" style="margin-right: 10px;">Copy to Clipboard</button>';
        html += '<button id="print-report" class="btn btn-sm btn-outline-secondary" style="margin-right: 10px;">Print</button>';
        html += '<button id="save-report" class="btn btn-sm btn-outline-secondary">Save as Text File</button>';
        html += '</div>';
        html += `<pre class="report-content" style="background: #f8f9fa; padding: 20px; border-radius: 5px; max-height: 500px; overflow-y: auto; white-space: pre-wrap;">${report}</pre>`;
        html += '</div>';
        
        document.getElementById('report-content').innerHTML = html;
        
        // Copy functionality
        document.getElementById('copy-report')?.addEventListener('click', () => {
            navigator.clipboard.writeText(report).then(() => {
                alert('Report copied to clipboard!');
            });
        });
        
        // Print functionality
        document.getElementById('print-report')?.addEventListener('click', () => {
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
        
        // Save as text file
        document.getElementById('save-report')?.addEventListener('click', () => {
            const blob = new Blob([report], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    showLoading() {
        document.getElementById('report-content').innerHTML = 
            '<div class="text-center" style="padding: 50px;">' +
            '<div class="spinner-border text-primary" role="status">' +
            '<span class="visually-hidden">Loading...</span>' +
            '</div>' +
            '<p class="mt-3">Generating report...</p>' +
            '</div>';
    }

    showError(message) {
        document.getElementById('report-content').innerHTML = 
            `<div class="alert alert-danger">
                <h4>Error</h4>
                <p>${message}</p>
            </div>`;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.reportManager = new ReportManager();
});

// Helper function for text download fallback
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
