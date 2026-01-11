// reports.js - REGULAR SCRIPT VERSION
console.log('reports.js loading...');

class ReportManager {
    constructor() {
        console.log('Creating ReportManager instance');
        
        // Get DataManager instance (it's global)
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
        html += '<button onclick="window.reportManager.copyToClipboard()" class="button small">Copy</button>';
        html += '<button onclick="window.reportManager.printReport()" class="button small" style="margin-left: 10px;">Print</button>';
        html += '<button onclick="window.reportManager.saveAsText()" class="button small" style="margin-left: 10px;">Save</button>';
        html += '</div>';
        html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; max-height: 400px; overflow-y: auto;">`;
        html += `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">${report}</pre>`;
        html += `</div>`;
        html += '</div>';
        
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

    // Add these helper methods
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

    saveAsText() {
        const pre = document.querySelector('#report-content pre');
        if (pre) {
            const blob = new Blob([pre.textContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report_${new Date().toISOString().slice(0,10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    // SIMPLIFIED VERSIONS OF OTHER METHODS (for testing)
    showSubjectSelector() {
        this.updateReportContent(`
            <div style="padding: 20px;">
                <h4>📚 Subject Report</h4>
                <p>This feature is working!</p>
                <p>Click any other button to test different reports.</p>
            </div>
        `);
    }

    showPDFOptions() {
        this.updateReportContent(`
            <div style="padding: 20px;">
                <h4>📄 PDF Export</h4>
                <p>PDF export is ready!</p>
                <button onclick="window.reportManager.testPDF()" class="button success">
                    Test PDF Generation
                </button>
            </div>
        `);
    }

    showEmailForm() {
        this.updateReportContent(`
            <div style="padding: 20px;">
                <h4>📧 Email Report</h4>
                <p>Email functionality is working!</p>
            </div>
        `);
    }

    showClaimFormOptions() {
        this.updateReportContent(`
            <div style="padding: 20px;">
                <h4>💰 Claim Form</h4>
                <p>Claim form generator is ready!</p>
            </div>
        `);
    }

    showInvoiceGenerator() {
        this.updateReportContent(`
            <div style="padding: 20px;">
                <h4>🧾 Invoice Generator</h4>
                <p>Invoice generator is working!</p>
            </div>
        `);
    }

    testPDF() {
        if (typeof jspdf === 'undefined') {
            alert('jsPDF not loaded. Check your script tags.');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text('Test PDF from WorkLogPro', 10, 10);
        doc.save('test_report.pdf');
        
        this.updateReportContent(`
            <div style="padding: 15px; background: #d1e7dd; border: 1px solid #198754; border-radius: 5px; color: #0f5132;">
                <h4 style="margin-top: 0;">✅ Test PDF Generated</h4>
                <p>Check your downloads for test_report.pdf</p>
            </div>
        `);
    }
}

// Initialize ReportManager when scripts are loaded
console.log('Creating ReportManager...');
new ReportManager();
