// reports.js - COMPLETE WORKING VERSION (NO OPTIONAL CHAINING)
console.log('reports.js loading...');

class ReportManager {
    constructor() {
        console.log('Creating ReportManager instance');
        
        this.dataManager = window.dataManager;
        if (!this.dataManager) {
            console.error('DataManager not found!');
            return;
        }
        
        this.subjects = [];
        this.students = [];
        this.worklogEntries = [];
        
        window.reportManager = this;
        this.init();
    }

    async init() {
        console.log('Initializing ReportManager...');
        
        try {
            this.setupEventListeners();
            this.loadSavedLogo();
            this.setupBusinessNameStyling();
            this.loadDataInBackground();
            await this.updateOverviewStats();
            this.setDefaultDates();
            this.setupLogoUpload();
            console.log('ReportManager initialized successfully');
        } catch (error) {
            console.error('Error initializing ReportManager:', error);
        }
    }

    setDefaultDates() {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        const formatDate = function(date) {
            return date.toISOString().split('T')[0];
        };
        
        const claimStart = document.getElementById('claimStartDate');
        const claimEnd = document.getElementById('claimEndDate');
        if (claimStart) claimStart.value = formatDate(thirtyDaysAgo);
        if (claimEnd) claimEnd.value = formatDate(today);
        
        const invoiceDate = document.getElementById('invoiceDate');
        const invoiceStart = document.getElementById('invoiceStartDate');
        const invoiceEnd = document.getElementById('invoiceEndDate');
        
        if (invoiceDate) invoiceDate.value = formatDate(today);
        if (invoiceStart) invoiceStart.value = formatDate(thirtyDaysAgo);
        if (invoiceEnd) invoiceEnd.value = formatDate(today);
    }

    async loadDataInBackground() {
        console.log('Loading data in background...');
        
        try {
            const subjects = await this.dataManager.getAllSubjects();
            const students = await this.dataManager.getAllStudents();
            
            this.subjects = subjects || [];
            this.students = students || [];
            this.loadWorklogEntries();
            
            console.log('Data loaded: ' + this.students.length + ' students, ' + this.subjects.length + ' subjects, ' + this.worklogEntries.length + ' worklog entries');
            this.updateStudentDropdowns();
            
        } catch (error) {
            console.error('Error loading background data:', error);
            setTimeout(function() { this.loadDataInBackground(); }.bind(this), 3000);
        }
    }

    loadWorklogEntries() {
        try {
            this.worklogEntries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
        } catch (error) {
            console.error('Error loading worklog entries:', error);
            this.worklogEntries = [];
        }
    }

    getEntriesInDateRange(startDate, endDate) {
        console.log('Date range check: ' + startDate + ' to ' + endDate);
        
        var start = new Date(startDate + 'T00:00:00');
        var end = new Date(endDate + 'T23:59:59.999');
        
        var filtered = this.worklogEntries.filter(function(entry) {
            var entryDate = new Date(entry.date + 'T12:00:00');
            return entryDate >= start && entryDate <= end;
        });
        
        var normalized = filtered.map(function(entry) {
            return {
                id: entry.id,
                type: entry.type,
                studentId: entry.studentId,
                studentName: entry.studentName,
                institution: entry.institution,
                date: entry.date,
                subject: entry.subject,
                topic: entry.topic,
                hours: entry.hours,
                sessions: entry.sessions, 
                rate: entry.rate,
                description: entry.description,
                outcomes: entry.outcomes,
                nextSteps: entry.nextSteps,
                notes: entry.notes,
                total: entry.total,
                createdAt: entry.createdAt,
                duration: entry.hours,
                totalEarnings: entry.total,
                activity: entry.subject
            };
        });
        
        console.log('Found ' + normalized.length + ' entries in range');
        return normalized;
    }

    updateStudentDropdowns() {
        var studentSelects = document.querySelectorAll('select[id*="Student"], select[id*="student"]');
        var self = this;
        studentSelects.forEach(function(select) {
            if (select.options.length <= 1) {
                self.populateStudentDropdown(select);
            }
        });
    }

    populateStudentDropdown(selectElement) {
        while (selectElement.options.length > 1) {
            selectElement.remove(1);
        }
        
        if (this.students && this.students.length > 0) {
            for (var i = 0; i < this.students.length; i++) {
                var student = this.students[i];
                var rate = student.hourlyRate ? ' ($' + student.hourlyRate + '/hr)' : '';
                var option = new Option(student.name + rate, student.name);
                selectElement.add(option);
            }
        } else {
            var option = new Option('No students found. Add students first.', '', true, true);
            option.disabled = true;
            selectElement.add(option);
        }
    }

    fillClaimFromWorklog() {
        if (this.worklogEntries.length === 0) {
            alert('No worklog entries found');
            return;
        }
        
        var latestEntry = this.worklogEntries[0];
        var programmeField = document.getElementById('claimProgramme');
        if (programmeField && latestEntry.subject) {
            programmeField.value = latestEntry.subject;
        }
        
        var rateField = document.getElementById('claimRate');
        if (rateField && latestEntry.rate) {
            rateField.value = latestEntry.rate;
        }
        
        var claimNameField = document.getElementById('claimName');
        if (claimNameField && latestEntry.entityName) {
            if (confirm('Use "' + latestEntry.entityName + '" as the name?')) {
                claimNameField.value = latestEntry.entityName;
            }
        }
        
        this.showNotification('Claim form populated from latest worklog', 'success');
    }

    fillInvoiceFromWorklog() {
        if (this.worklogEntries.length === 0) {
            alert('No worklog entries found');
            return;
        }
        
        var latestEntry = this.worklogEntries[0];
        var itemField = document.getElementById('invoiceItem');
        if (itemField && latestEntry.subject) {
            itemField.value = latestEntry.subject;
        }
        
        var rateField = document.getElementById('invoiceRate');
        if (rateField && latestEntry.rate) {
            rateField.value = latestEntry.rate;
        }
        
        var issuedToField = document.getElementById('invoiceTo');
        if (issuedToField && latestEntry.entityName) {
            if (confirm('Set recipient to "' + latestEntry.entityName + '"?')) {
                issuedToField.value = latestEntry.entityName;
            }
        }
        
        this.showNotification('Invoice form populated from latest worklog', 'success');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        var buttons = [
            'weeklyReportBtn', 'biWeeklyReportBtn', 'monthlyReportBtn', 'subjectReportBtn',
            'claimFormBtn', 'invoiceBtn', 'pdfReportBtn', 'emailReportBtn',
            'generateClaimBtn', 'printClaimBtn', 'generateInvoiceBtn', 'printInvoiceBtn',
            'fillClaimFromWorklogBtn', 'fillInvoiceFromWorklogBtn'
        ];
        
        var self = this;
        buttons.forEach(function(btnId) {
            var btn = document.getElementById(btnId);
            if (btn) {
                var newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', function(e) { self.handleButtonClick(e, btnId); });
                console.log('Listener added to ' + btnId);
            }
        });
    }

    handleButtonClick(event, buttonId) {
        console.log('Button clicked: ' + buttonId);
        event.preventDefault();
        event.stopPropagation();
        
        switch(buttonId) {
            case 'weeklyReportBtn': this.displayReport('weekly'); break;
            case 'biWeeklyReportBtn': this.displayReport('biweekly'); break;
            case 'monthlyReportBtn': this.displayReport('monthly'); break;
            case 'subjectReportBtn': this.showSubjectSelector(); break;
            case 'claimFormBtn':
            case 'generateClaimBtn': this.generateClaimForm(); break;
            case 'printClaimBtn': this.printDocument('claim'); break;
            case 'fillClaimFromWorklogBtn': this.fillClaimFromWorklog(); break;
            case 'invoiceBtn':
            case 'generateInvoiceBtn': this.generateInvoice(); break;
            case 'printInvoiceBtn': this.printDocument('invoice'); break;
            case 'fillInvoiceFromWorklogBtn': this.fillInvoiceFromWorklog(); break;
            case 'pdfReportBtn': this.showPDFOptions(); break;
            case 'emailReportBtn': this.showEmailForm(); break;
            default: console.log('Unhandled button:', buttonId);
        }
    }

    setupLogoUpload() {
        var uploadBtn = document.getElementById('uploadLogoBtn');
        var logoPreview = document.getElementById('logoPreview');
        var logoImage = document.getElementById('logoImage');
        var removeBtn = document.getElementById('removeLogoBtn');
        var self = this;
        
        if (uploadBtn) {
            uploadBtn.addEventListener('click', function() {
                var input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = function(e) {
                    var file = e.target.files[0];
                    if (file) {
                        var reader = new FileReader();
                        reader.onload = function(readerEvent) {
                            var logoData = readerEvent.target.result;
                            localStorage.setItem('invoiceLogo', logoData);
                            if (logoImage && logoPreview) {
                                logoImage.src = logoData;
                                logoPreview.style.display = 'block';
                            }
                            self.showNotification('Logo uploaded!', 'success');
                        };
                        reader.readAsDataURL(file);
                    }
                };
                input.click();
            });
        }
        
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                localStorage.removeItem('invoiceLogo');
                if (logoPreview) logoPreview.style.display = 'none';
                if (logoImage) logoImage.src = '';
                self.showNotification('Logo removed', 'info');
            });
        }
        
        this.loadSavedLogo();
    }

    loadSavedLogo() {
        var savedLogo = localStorage.getItem('invoiceLogo');
        var logoPreview = document.getElementById('logoPreview');
        var logoImage = document.getElementById('logoImage');
        
        if (savedLogo && logoImage && logoPreview) {
            logoImage.src = savedLogo;
            logoPreview.style.display = 'flex';
            console.log('Logo loaded from storage');
        }
    }

    setupBusinessNameStyling() {
        var businessNameInput = document.getElementById('invoiceBusinessName');
        var fontSelect = document.getElementById('invoiceFont');
        var fontSizeSelect = document.getElementById('invoiceFontSize');
        var fontColorInput = document.getElementById('invoiceFontColor');
        var fontBoldCheck = document.getElementById('invoiceFontBold');
        var fontItalicCheck = document.getElementById('invoiceFontItalic');
        var preview = document.getElementById('businessNamePreview');
        
        this.loadBusinessNameStyles();
        
        var self = this;
        var updatePreview = function() {
            if (!preview) return;
            
            var businessName = businessNameInput ? businessNameInput.value : 'Your Business Name';
            var font = fontSelect ? fontSelect.value : "'Courier New', monospace";
            var size = fontSizeSelect ? fontSizeSelect.value : '24px';
            var color = fontColorInput ? fontColorInput.value : '#000000';
            var bold = (fontBoldCheck && fontBoldCheck.checked) ? 'bold' : 'normal';
            var italic = (fontItalicCheck && fontItalicCheck.checked) ? 'italic' : 'normal';
            
            preview.textContent = businessName || 'Your Business Name';
            preview.style.fontFamily = font;
            preview.style.fontSize = size;
            preview.style.color = color;
            preview.style.fontWeight = bold;
            preview.style.fontStyle = italic;
            
            self.saveBusinessNameStyles({
                font: font, size: size, color: color, 
                bold: fontBoldCheck ? fontBoldCheck.checked : false, 
                italic: fontItalicCheck ? fontItalicCheck.checked : false
            });
        };
        
        if (businessNameInput) businessNameInput.addEventListener('input', updatePreview);
        if (fontSelect) fontSelect.addEventListener('change', updatePreview);
        if (fontSizeSelect) fontSizeSelect.addEventListener('change', updatePreview);
        if (fontColorInput) fontColorInput.addEventListener('input', updatePreview);
        if (fontBoldCheck) fontBoldCheck.addEventListener('change', updatePreview);
        if (fontItalicCheck) fontItalicCheck.addEventListener('change', updatePreview);
        
        updatePreview();
    }

    saveBusinessNameStyles(styles) {
        localStorage.setItem('invoiceFontStyles', JSON.stringify(styles));
    }

    loadBusinessNameStyles() {
        var saved = localStorage.getItem('invoiceFontStyles');
        if (!saved) return;
        
        try {
            var styles = JSON.parse(saved);
            var fontSelect = document.getElementById('invoiceFont');
            var fontSizeSelect = document.getElementById('invoiceFontSize');
            var fontColorInput = document.getElementById('invoiceFontColor');
            var fontBoldCheck = document.getElementById('invoiceFontBold');
            var fontItalicCheck = document.getElementById('invoiceFontItalic');
            
            if (fontSelect && styles.font) fontSelect.value = styles.font;
            if (fontSizeSelect && styles.size) fontSizeSelect.value = styles.size;
            if (fontColorInput && styles.color) fontColorInput.value = styles.color;
            if (fontBoldCheck && styles.bold !== undefined) fontBoldCheck.checked = styles.bold;
            if (fontItalicCheck && styles.italic !== undefined) fontItalicCheck.checked = styles.italic;
        } catch(error) {
            console.error('Error loading font styles:', error);
        }
    }

    generateClaimForm() {
        var name = document.getElementById('claimName') ? document.getElementById('claimName').value : 'David Moseley';
        var address = document.getElementById('claimAddress') ? document.getElementById('claimAddress').value : '142 Coles Terrace, St.Philip';
        var homePhone = document.getElementById('claimHomePhone') ? document.getElementById('claimHomePhone').value : '572-8040';
        var workPhone = document.getElementById('claimWorkPhone') ? document.getElementById('claimWorkPhone').value : '367-8221';
        var programme = document.getElementById('claimProgramme') ? document.getElementById('claimProgramme').value : 'Cosmetology';
        var startDate = document.getElementById('claimStartDate') ? document.getElementById('claimStartDate').value : null;
        var endDate = document.getElementById('claimEndDate') ? document.getElementById('claimEndDate').value : null;
        
        if (!startDate || !endDate) {
            alert('Please select start and end dates');
            return;
        }
        
        var entries = this.getEntriesInDateRange(startDate, endDate);
        
        if (entries.length === 0) {
            alert('No worklog entries found in this date range');
            return;
        }
        
        var groupedEntries = {};
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var date = entry.date;
            if (!groupedEntries[date]) {
                groupedEntries[date] = { date: date, sessions: 0, hours: 0 };
            }
            var sessionCount = entry.sessions || 1;
            groupedEntries[date].sessions += sessionCount;
            groupedEntries[date].hours += entry.duration || 0;
        }
        
        var sortedEntries = Object.values(groupedEntries).sort(function(a, b) {
            return new Date(a.date) - new Date(b.date);
        });
        
        var totalSessions = 0;
        var totalHours = 0;
        for (var j = 0; j < sortedEntries.length; j++) {
            totalSessions += sortedEntries[j].sessions;
            totalHours += sortedEntries[j].hours;
        }
        
        var formatDisplayDate = function(dateStr) {
            var parts = dateStr.split('-');
            return parts[2] + '/' + parts[1] + '/' + parts[0];
        };
        
        var tableRows = '';
        for (var k = 0; k < sortedEntries.length; k++) {
            var entry = sortedEntries[k];
            tableRows += '<tr>' +
                '<td style="border: 1px solid #000; padding: 10px;">' + formatDisplayDate(entry.date) + '</td>' +
                '<td style="border: 1px solid #000; padding: 10px;">' + programme + '</td>' +
                '<td style="border: 1px solid #000; padding: 10px; text-align: center;">' + entry.sessions + '</td>' +
                '<td style="border: 1px solid #000; padding: 10px; text-align: center;">' + entry.hours.toFixed(1) + '</td>' +
                '</tr>';
        }
        
        var claimHTML = '<div style="font-family: \'Courier New\', monospace; max-width: 800px; margin: 0 auto; padding: 20px; background: white; color: black;">' +
            '<h2 style="text-align: center; margin-bottom: 30px;">Social Skills Programme Claim Form</h2>' +
            '<div style="margin-bottom: 30px;">' +
            '<p><strong>Name:</strong> ' + name + '</p>' +
            '<p><strong>Address:</strong> ' + address + '</p>' +
            '<p><strong>Tel Nos:</strong> Home: ' + homePhone + ' (Work: ' + workPhone + ')</p>' +
            '</div>' +
            '<table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">' +
            '<thead><tr style="background: #f0f0f0;">' +
            '<th style="border: 1px solid #000; padding: 10px; text-align: left;">Date</th>' +
            '<th style="border: 1px solid #000; padding: 10px; text-align: left;">Programme</th>' +
            '<th style="border: 1px solid #000; padding: 10px; text-align: center;">Sessions</th>' +
            '<th style="border: 1px solid #000; padding: 10px; text-align: center;">Hours</th>' +
            '</tr></thead><tbody>' + tableRows +
            '<tr style="background: #f9f9f9; font-weight: bold;">' +
            '<td style="border: 1px solid #000; padding: 10px;" colspan="2">Totals</td>' +
            '<td style="border: 1px solid #000; padding: 10px; text-align: center;">' + totalSessions + '</td>' +
            '<td style="border: 1px solid #000; padding: 10px; text-align: center;">' + totalHours.toFixed(1) + '</td>' +
            '</tr></tbody></table>' +
            '<div style="display: flex; justify-content: space-between; margin-top: 50px;">' +
            '<div><p>Signature _________________________</p><p>Date _________________________</p></div>' +
            '<div><p>Verified _________________________</p></div>' +
            '</div></div>';
        
        this.showPreview(claimHTML, 'Claim Form');
    }

    generateInvoice() {
        const businessName = localStorage.getItem('invoiceBusinessName') || localStorage.getItem('businessName') || 'Your Business Name';
        const businessAddress = localStorage.getItem('businessAddress') || '123 Business St, City';
        const businessPhone = localStorage.getItem('businessPhone') || '(555) 123-4567';
        const businessEmail = localStorage.getItem('businessEmail') || 'info@worklog.com';
        var invoiceNumber = document.getElementById('invoiceNumber') ? document.getElementById('invoiceNumber').value : '003';
        var invoiceDate = document.getElementById('invoiceDate') ? document.getElementById('invoiceDate').value : null;
        var invoiceTo = document.getElementById('invoiceTo') ? document.getElementById('invoiceTo').value : 'Barbados Vocational Board\nLawrence Green House\nCulloden Road, St. Michael';
        var itemDesc = document.getElementById('invoiceItem') ? document.getElementById('invoiceItem').value : 'Cosmetology';
        var rate = parseFloat(document.getElementById('invoiceRate') ? document.getElementById('invoiceRate').value : 82.97);
        var startDate = document.getElementById('invoiceStartDate') ? document.getElementById('invoiceStartDate').value : null;
        var endDate = document.getElementById('invoiceEndDate') ? document.getElementById('invoiceEndDate').value : null;
        
        var logoData = localStorage.getItem('invoiceLogo');
        var fontStyles = JSON.parse(localStorage.getItem('invoiceFontStyles') || '{}');
        
        if (!invoiceDate || !startDate || !endDate) {
            alert('Please select all dates');
            return;
        }
        
        var entries = this.getEntriesInDateRange(startDate, endDate);
        
        if (entries.length === 0) {
            alert('No worklog entries found in this date range');
            return;
        }
        
        var groupedEntries = {};
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var date = entry.date;
            if (!groupedEntries[date]) {
                groupedEntries[date] = { date: date, hours: 0, amount: 0 };
            }
            groupedEntries[date].hours += entry.duration || 0;
            groupedEntries[date].amount += entry.totalEarnings || 0;
        }
        
        var sortedEntries = Object.values(groupedEntries).sort(function(a, b) {
            return new Date(a.date) - new Date(b.date);
        });
        
        var totalAmount = 0;
        for (var j = 0; j < sortedEntries.length; j++) {
            totalAmount += sortedEntries[j].amount;
        }
        
        var formatDisplayDate = function(dateStr) {
            var parts = dateStr.split('-');
            return parts[2] + '/' + parts[1] + '/' + parts[0];
        };
        
        var addressLines = invoiceTo.split('\n').map(function(line) { return line.trim(); }).filter(function(line) { return line; });
        
        var logoHTML = logoData ? '<img src="' + logoData + '" style="max-height: 60px; max-width: 200px; object-fit: contain;">' : (businessName || 'INVOICE');
        
        var tableRows = '';
        for (var k = 0; k < sortedEntries.length; k++) {
            var entry = sortedEntries[k];
            tableRows += '<tr>' +
                '<td style="border: 1px solid #000; padding: 10px;">' + formatDisplayDate(entry.date) + '</td>' +
                '<td style="border: 1px solid #000; padding: 10px;">' + itemDesc + ' ' + entry.hours.toFixed(1) + ' hours @ $' + rate.toFixed(2) + '</td>' +
                '<td style="border: 1px solid #000; padding: 10px; text-align: right;">$' + entry.amount.toFixed(2) + '</td>' +
                '</tr>';
        }
        
        var addressHtml = '';
        for (var a = 0; a < addressLines.length; a++) {
            addressHtml += '<p>' + addressLines[a] + '</p>';
        }
        
        var invoiceHTML = '<div style="font-family: \'Courier New\', monospace; max-width: 800px; margin: 0 auto; padding: 20px; background: white; color: black;">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #000;">' +
            '<div style="font-family: ' + (fontStyles.font || "'Courier New', monospace") + '; font-size: ' + (fontStyles.size || '24px') + '; color: ' + (fontStyles.color || '#000000') + '; font-weight: ' + (fontStyles.bold ? 'bold' : 'normal') + '; font-style: ' + (fontStyles.italic ? 'italic' : 'normal') + ';">' + logoHTML + '</div>' +
            '<div style="text-align: right;"><h2 style="margin: 0;">INVOICE</h2><p style="margin: 5px 0 0 0;">No. ' + invoiceNumber + '</p></div>' +
            '</div>' +
            '<div style="text-align: right; margin-bottom: 30px;"><p><strong>Date:</strong> ' + formatDisplayDate(invoiceDate) + '</p></div>' +
            '<div style="margin-bottom: 30px;"><p><strong>Issued to:</strong></p>' + addressHtml + '</div>' +
            '<table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">' +
            '<thead><tr style="background: #f0f0f0;">' +
            '<th style="border: 1px solid #000; padding: 10px; text-align: left;">Date</th>' +
            '<th style="border: 1px solid #000; padding: 10px; text-align: left;">Item</th>' +
            '<th style="border: 1px solid #000; padding: 10px; text-align: right;">Amount</th>' +
            '</tr></thead><tbody>' + tableRows + '</tbody></table>' +
            '<div style="text-align: right; font-size: 1.2rem; font-weight: bold; margin-bottom: 50px;"><p>Total $' + totalAmount.toFixed(2) + '</p></div>' +
            '<div><p>Issued by: _________________________</p></div>' +
            '</div>';
        
        this.showPreview(invoiceHTML, 'Invoice #' + invoiceNumber);
    }

    showPreview(html, title) {
        var previewHTML = this.createReportTemplate('📄 ' + title, html, false);
        this.updateReportContent(previewHTML);
        
        var previewSection = document.getElementById('documentPreview');
        if (previewSection) {
            var previewContent = document.getElementById('previewContent');
            if (previewContent) {
                previewContent.innerHTML = html;
                previewSection.style.display = 'block';
                previewSection.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    printDocument(type) {
        var htmlToPrint = '';
        var previewContent = document.getElementById('previewContent');
        if (previewContent) {
            htmlToPrint = previewContent.innerHTML;
        }
        
        if (!htmlToPrint) return;
        
        var printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>WorkLog Pro - ' + (type === 'claim' ? 'Claim Form' : 'Invoice') + '</title>' +
            '<style>body { font-family: \'Courier New\', monospace; padding: 40px; background: white; color: black; }' +
            '@media print { body { padding: 20px; } }' +
            'table { border-collapse: collapse; width: 100%; }' +
            'th, td { border: 1px solid #000; padding: 8px; text-align: left; }' +
            'th { background: #f0f0f0; }</style></head><body>' + htmlToPrint + '</body></html>');
        printWindow.document.close();
        printWindow.print();
    }

    createReportTemplate(title, content, showActions) {
        var html = '<div class="report-display">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">';
        html += '<h4 style="margin: 0;">' + title + '</h4>';
        html += '<button onclick="window.reportManager.clearReport()" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 18px; cursor: pointer;">×</button>';
        html += '</div>';
        
        if (showActions) {
            html += '<div style="margin-bottom: 15px; display: flex; gap: 10px;">';
            html += '<button onclick="window.reportManager.copyToClipboard()" class="button small">📋 Copy</button>';
            html += '<button onclick="window.reportManager.printReport()" class="button small">🖨️ Print</button>';
            html += '<button onclick="window.reportManager.saveAsText()" class="button small">💾 Save</button>';
            html += '</div>';
        }
        
        html += '<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; max-height: 400px; overflow-y: auto;">' + content + '</div>';
        html += '<div style="margin-top: 15px; text-align: center;"><button onclick="window.reportManager.clearReport()" class="button small">← Back to Reports</button></div>';
        html += '</div>';
        return html;
    }

    async displayReport(type) {
        console.log('Generating ' + type + ' report...');
        this.showLoading();
        
        try {
            var report;
            var title;
            
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
                default:
                    report = 'No report';
                    title = 'Report';
            }
            
            var content = '<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">' + report + '</pre>';
            var html = this.createReportTemplate(title, content, true);
            this.updateReportContent(html);
        } catch (error) {
            console.error('Error generating report:', error);
            this.showError('Failed to generate ' + type + ' report: ' + error.message);
        }
    }

    showSubjectSelector() {
        this.clearReport();
        
        var content = '<p>Select or enter a subject:</p>';
        
        if (this.subjects.length === 0) {
            content += '<p style="color: #666; font-style: italic;">No subjects found. Add some activities with subject names.</p>';
        } else {
            content += '<select id="subjectSelect" class="form-input" style="width: 100%; margin-bottom: 15px;">';
            content += '<option value="">Choose a subject...</option>';
            for (var i = 0; i < this.subjects.length; i++) {
                var subject = this.subjects[i];
                content += '<option value="' + subject + '">' + subject.charAt(0).toUpperCase() + subject.slice(1) + '</option>';
            }
            content += '</select>';
        }
        
        content += '<input type="text" id="customSubject" class="form-input" placeholder="Or enter custom subject" style="width: 100%; margin-bottom: 15px;">';
        content += '<button onclick="window.generateSubjectReport()" class="button" style="width: 100%;">Generate Report</button>';
        
        var html = this.createReportTemplate('📚 Subject Report', content, false);
        this.updateReportContent(html);
    }

    showPDFOptions() {
        this.clearReport();
        
        var content = '<p>Select report type:</p>';
        content += '<div style="margin-bottom: 15px;">';
        content += '<label style="display: block; margin-bottom: 8px;"><input type="radio" name="pdfType" value="weekly" checked> Weekly Report</label>';
        content += '<label style="display: block; margin-bottom: 8px;"><input type="radio" name="pdfType" value="biweekly"> Bi-Weekly Report</label>';
        content += '<label style="display: block; margin-bottom: 8px;"><input type="radio" name="pdfType" value="monthly"> Monthly Report</label>';
        content += '</div>';
        content += '<button onclick="window.generatePDF()" class="button success" style="width: 100%;">📄 Generate PDF</button>';
        
        var html = this.createReportTemplate('PDF Export', content, false);
        this.updateReportContent(html);
    }

    showEmailForm() {
        this.clearReport();
        
        var content = '<div style="margin-bottom: 15px;">';
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
        content += '<button onclick="window.sendEmail()" class="button info" style="width: 100%;">📧 Send Email</button>';
        
        var html = this.createReportTemplate('Email Report', content, false);
        this.updateReportContent(html);
    }

    clearReport() {
        var reportContent = document.getElementById('report-content');
        if (reportContent) {
            reportContent.innerHTML = '<p class="empty-message">Select a report type to generate.</p>';
        }
    }

    showLoading() {
        this.updateReportContent('<div style="text-align: center; padding: 50px;"><div class="spinner"></div><p>Generating report...</p></div>');
    }

    showError(message) {
        var content = '<div style="padding: 15px; background: #f8d7da; border-radius: 5px; border: 1px solid #dc3545; color: #721c24;">' +
            '<h4 style="margin-top: 0;">❌ Error</h4><p>' + message + '</p>' +
            '<button onclick="window.reportManager.clearReport()" class="button small" style="margin-top: 10px;">Back to Reports</button></div>';
        var html = this.createReportTemplate('Error', content, false);
        this.updateReportContent(html);
    }

    updateReportContent(html) {
        var reportContent = document.getElementById('report-content');
        if (reportContent) {
            reportContent.innerHTML = html;
        }
    }

    copyToClipboard() {
        var pre = document.querySelector('#report-content pre');
        if (pre) {
            navigator.clipboard.writeText(pre.textContent).then(function() {
                alert('Report copied to clipboard!');
            });
        }
    }

    printReport() {
        var pre = document.querySelector('#report-content pre');
        if (pre) {
            var titleElem = document.querySelector('#report-content h4');
            var title = titleElem ? titleElem.textContent : 'Report';
            var printWindow = window.open('', '_blank');
            printWindow.document.write('<html><head><title>' + title + '</title></head><body><pre>' + pre.textContent + '</pre></body></html>');
            printWindow.document.close();
            printWindow.print();
        }
    }

    saveAsText() {
        var pre = document.querySelector('#report-content pre');
        var titleElem = document.querySelector('#report-content h4');
        var title = titleElem ? titleElem.textContent : 'Report';
        
        if (pre) {
            var blob = new Blob([pre.textContent], { type: 'text/plain' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0,10) + '.txt';
            a.click();
            URL.revokeObjectURL(url);
            alert('Report saved as text file!');
        }
    }

    async updateOverviewStats() {
        try {
            var logs = await this.dataManager.getAllLogs();
            var students = await this.dataManager.getAllStudents();
            var marks = await this.dataManager.getAllMarks();
            var payments = await this.dataManager.getAllPayments();
            
            var totalHours = 0;
            for (var i = 0; i < logs.length; i++) {
                totalHours += parseFloat(logs[i].duration || 0);
            }
            
            var totalEarnings = 0;
            for (var j = 0; j < logs.length; j++) {
                var log = logs[j];
                var student = null;
                for (var s = 0; s < students.length; s++) {
                    if (students[s].name === log.studentName) {
                        student = students[s];
                        break;
                    }
                }
                var rate = student ? student.hourlyRate : 0;
                totalEarnings += parseFloat(log.duration || 0) * rate;
            }
            
            var avgMark = 0;
            if (marks.length > 0) {
                var totalMark = 0;
                for (var m = 0; m < marks.length; m++) {
                    totalMark += parseFloat(marks[m].percentage || 0);
                }
                avgMark = totalMark / marks.length;
            }
            
            var totalPayments = 0;
            for (var p = 0; p < payments.length; p++) {
                totalPayments += parseFloat(payments[p].paymentAmount || 0);
            }
            var outstandingBalance = totalEarnings - totalPayments;
            
            var worklogHours = 0;
            for (var w = 0; w < this.worklogEntries.length; w++) {
                worklogHours += this.worklogEntries[w].hours || 0;
            }
            
            var worklogEarnings = 0;
            for (var we = 0; we < this.worklogEntries.length; we++) {
                worklogEarnings += this.worklogEntries[we].total || 0;
            }
            
            var now = new Date();
            var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            var monthEarnings = 0;
            for (var me = 0; me < this.worklogEntries.length; me++) {
                var entry = this.worklogEntries[me];
                var entryDate = new Date(entry.date + 'T12:00:00');
                if (entryDate >= startOfMonth) {
                    monthEarnings += entry.total || 0;
                }
            }
            
            var updateElement = function(id, value) {
                var el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            
            updateElement('totalStudentsReport', students.length);
            updateElement('totalHoursReport', totalHours.toFixed(2));
            updateElement('totalEarningsReport', '$' + totalEarnings.toFixed(2));
            updateElement('avgMarkReport', avgMark.toFixed(1) + '%');
            updateElement('totalPaymentsReport', '$' + totalPayments.toFixed(2));
            updateElement('outstandingBalance', '$' + outstandingBalance.toFixed(2));
            updateElement('reportTotalHours', worklogHours.toFixed(1));
            updateElement('reportTotalEarnings', '$' + worklogEarnings.toFixed(2));
            updateElement('reportMonthEarnings', '$' + monthEarnings.toFixed(2));
            updateElement('worklogStatsCount', this.worklogEntries.length);
            
            if (this.worklogEntries.length > 0) {
                var avgDuration = worklogHours / this.worklogEntries.length;
                updateElement('worklogAvgDuration', avgDuration.toFixed(1) + 'h');
            } else {
                updateElement('worklogAvgDuration', '0h');
            }
            
        } catch (error) {
            console.error('Error updating overview stats:', error);
        }
    }

    showNotification(message, type) {
        console.log('Notification:', type, message);
        var notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 12px 20px; background: ' + (type === 'success' ? '#4CAF50' : '#2196F3') + '; color: white; border-radius: 8px; z-index: 10000;';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(function() { notification.remove(); }, 3000);
    }
}

// GLOBAL HELPER FUNCTIONS
window.generateSubjectReport = function() {
    var select = document.getElementById('subjectSelect');
    var custom = document.getElementById('customSubject');
    
    var subject = '';
    if (select && select.value) {
        subject = select.value;
    } else if (custom && custom.value) {
        subject = custom.value.trim();
    }
    
    if (!subject) {
        alert('Please select or enter a subject');
        return;
    }
    
    if (window.reportManager) {
        window.reportManager.showLoading();
        
        window.reportManager.dataManager.generateSubjectReport(subject).then(function(report) {
            var content = '<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0;">' + report + '</pre>';
            var html = window.reportManager.createReportTemplate('📚 ' + subject + ' Report', content, true);
            window.reportManager.updateReportContent(html);
        }).catch(function(error) {
            window.reportManager.showError('Error generating subject report: ' + error.message);
        });
    }
};

window.generatePDF = function() {
    var selected = document.querySelector('input[name="pdfType"]:checked');
    if (!selected || !window.reportManager) return;
    
    window.reportManager.showLoading();
    
    var reportPromise;
    var filename;
    
    switch(selected.value) {
        case 'weekly':
            reportPromise = window.reportManager.dataManager.generateWeeklyReport();
            filename = 'Weekly_Report_' + new Date().toISOString().slice(0,10);
            break;
        case 'biweekly':
            reportPromise = window.reportManager.dataManager.generateBiWeeklyReport();
            filename = 'BiWeekly_Report_' + new Date().toISOString().slice(0,10);
            break;
        case 'monthly':
            reportPromise = window.reportManager.dataManager.generateMonthlyReport();
            filename = 'Monthly_Report_' + new Date().toISOString().slice(0,10);
            break;
        default:
            reportPromise = Promise.resolve('');
            filename = 'Report';
    }
    
    reportPromise.then(function(report) {
        var blob = new Blob([report], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename + '.txt';
        a.click();
        URL.revokeObjectURL(url);
        
        var content = '<div style="padding: 15px; background: #d1e7dd; border-radius: 5px;">' +
            '<h4 style="margin-top: 0;">✅ Report Generated</h4>' +
            '<p>File <strong>' + filename + '.txt</strong> has been downloaded.</p>' +
            '</div>';
        var html = window.reportManager.createReportTemplate('PDF Export', content, false);
        window.reportManager.updateReportContent(html);
    }).catch(function(error) {
        window.reportManager.showError('Error generating report: ' + error.message);
    });
};

window.sendEmail = function() {
    var to = document.getElementById('emailTo');
    var typeSelect = document.getElementById('emailType');
    
    var toValue = to ? to.value : '';
    var typeValue = typeSelect ? typeSelect.value : '';
    
    if (!toValue || !typeValue || !window.reportManager) {
        alert('Please fill all fields');
        return;
    }
    
    window.reportManager.showLoading();
    
    var reportPromise;
    var subject;
    
    switch(typeValue) {
        case 'weekly':
            reportPromise = window.reportManager.dataManager.generateWeeklyReport();
            subject = 'Weekly Report';
            break;
        case 'biweekly':
            reportPromise = window.reportManager.dataManager.generateBiWeeklyReport();
            subject = 'Bi-Weekly Report';
            break;
        case 'monthly':
            reportPromise = window.reportManager.dataManager.generateMonthlyReport();
            subject = 'Monthly Report';
            break;
        default:
            reportPromise = Promise.resolve('');
            subject = 'Report';
    }
    
    reportPromise.then(function(report) {
        var body = 'Hello,\n\nPlease find the attached report:\n\n' + report + '\n\nBest regards,\nWorkLogPro Team';
        window.open('mailto:' + toValue + '?subject=' + encodeURIComponent('WorkLogPro ' + subject) + '&body=' + encodeURIComponent(body), '_blank');
        
        var content = '<div style="padding: 15px; background: #d1e7dd; border-radius: 5px;">' +
            '<h4 style="margin-top: 0;">✅ Email Ready</h4>' +
            '<p>Your email client has been opened with the report.</p>' +
            '</div>';
        var html = window.reportManager.createReportTemplate('Email Report', content, false);
        window.reportManager.updateReportContent(html);
    }).catch(function(error) {
        window.reportManager.showError('Error generating report: ' + error.message);
    });
};

window.generateClaimForm = function() {
    if (window.reportManager) {
        window.reportManager.generateClaimForm();
    }
};

window.generateInvoice = function() {
    if (window.reportManager) {
        window.reportManager.generateInvoice();
    }
};

// Initialize ReportManager
console.log('Creating ReportManager...');
new ReportManager();
