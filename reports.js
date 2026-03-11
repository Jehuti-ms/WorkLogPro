// reports.js - COMPLETE VERSION WITH BVTB CLAIM FORMS & INVOICES
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
        this.worklogEntries = [];
        
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

            // Setting up Logo and styling
            this.loadSavedLogo();
            this.setupBusinessNameStyling();
            
            // Load data in background
            this.loadDataInBackground();
            
            // Update stats
            await this.updateOverviewStats();
            
            // Set default dates for forms
            this.setDefaultDates();

            // Set business logo
            this.setupLogoUpload();
            
            
            console.log('ReportManager initialized successfully');
            
        } catch (error) {
            console.error('Error initializing ReportManager:', error);
        }
    }

    setDefaultDates() {
        // Set default date range to last 30 days
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        const formatDate = (date) => date.toISOString().split('T')[0];
        
        // These will be used by the new form elements
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
            const [subjects, students] = await Promise.all([
                this.dataManager.getAllSubjects(),
                this.dataManager.getAllStudents()
            ]);
            
            this.subjects = subjects;
            this.students = students;
            
            // Load worklog entries
            this.loadWorklogEntries();
            
            console.log(`✅ Data loaded: ${this.students.length} students, ${this.subjects.length} subjects, ${this.worklogEntries.length} worklog entries`);
            
            // Update any open student dropdowns
            this.updateStudentDropdowns();
            
        } catch (error) {
            console.error('Error loading background data:', error);
            // Retry after 3 seconds
            setTimeout(() => this.loadDataInBackground(), 3000);
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
    console.log(`🔍 Date range check: ${startDate} to ${endDate}`);
    
    // Create dates that cover the full range
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');
    
    console.log(`📅 Start: ${start.toLocaleString()}, End: ${end.toLocaleString()}`);
    
    const filtered = this.worklogEntries.filter(entry => {
        const entryDate = new Date(entry.date + 'T12:00:00'); // Use noon to avoid timezone issues
        const isInRange = entryDate >= start && entryDate <= end;
        
        // Debug log for the date range you're checking (March 6-12)
        if (entry.date >= '2026-03-06') {
            console.log(`Entry ${entry.date}: ${isInRange ? '✅ INCLUDED' : '❌ EXCLUDED'}`);
        }
        
        return isInRange;
    });
    
    console.log(`📊 Found ${filtered.length} entries in range:`, 
        filtered.map(e => e.date).sort());
    
    return filtered;
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

// Fill claim form from latest worklog
fillClaimFromWorklog() {
    if (this.worklogEntries.length === 0) {
        alert('No worklog entries found');
        return;
    }
    
    // Get the most recent worklog entry
    const latestEntry = this.worklogEntries[0];
    
    // Fill claim form fields
    const programmeField = document.getElementById('claimProgramme');
    if (programmeField && latestEntry.subject) {
        programmeField.value = latestEntry.subject;
    }
    
    // If you have a rate field in claim form
    const rateField = document.getElementById('claimRate');
    if (rateField && latestEntry.rate) {
        rateField.value = latestEntry.rate;
    }
    
    // If you have a name field, you could also fill student/institution name
    const claimNameField = document.getElementById('claimName');
    if (claimNameField && latestEntry.entityName) {
        // Optionally ask user before overwriting name
        if (confirm(`Use "${latestEntry.entityName}" as the name?`)) {
            claimNameField.value = latestEntry.entityName;
        }
    }
    
    showNotification('Claim form populated from latest worklog', 'success');
    console.log('📋 Claim form populated from:', latestEntry);
}

// Fill invoice form from latest worklog
fillInvoiceFromWorklog() {
    if (this.worklogEntries.length === 0) {
        alert('No worklog entries found');
        return;
    }
    
    // Get the most recent worklog entry
    const latestEntry = this.worklogEntries[0];
    
    // Fill invoice form fields
    const itemField = document.getElementById('invoiceItem');
    if (itemField && latestEntry.subject) {
        itemField.value = latestEntry.subject;
    }
    
    const rateField = document.getElementById('invoiceRate');
    if (rateField && latestEntry.rate) {
        rateField.value = latestEntry.rate;
    }
    
    // Optionally fill the "Issued To" field
    const issuedToField = document.getElementById('invoiceTo');
    if (issuedToField && latestEntry.entityName) {
        if (confirm(`Set recipient to "${latestEntry.entityName}"?`)) {
            issuedToField.value = latestEntry.entityName;
        }
    }
    
    showNotification('Invoice form populated from latest worklog', 'success');
    console.log('📋 Invoice form populated from:', latestEntry);
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
        'emailReportBtn',
        'generateClaimBtn',
        'printClaimBtn',
        'generateInvoiceBtn',
        'printInvoiceBtn',
        // NEW BUTTONS
        'fillClaimFromWorklogBtn',
        'fillInvoiceFromWorklogBtn'
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
        }
    });
}

  handleButtonClick(event, buttonId) {
    console.log(`Button clicked: ${buttonId}`);
    event.preventDefault();
    event.stopPropagation();
    
    switch(buttonId) {
        // Report buttons
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
        
        // Claim form buttons
        case 'claimFormBtn':
        case 'generateClaimBtn':
            this.generateClaimForm();
            break;
        case 'printClaimBtn':
            this.printDocument('claim');
            break;
        case 'fillClaimFromWorklogBtn':  // NEW
            this.fillClaimFromWorklog();
            break;
        
        // Invoice buttons
        case 'invoiceBtn':
        case 'generateInvoiceBtn':
            this.generateInvoice();
            break;
        case 'printInvoiceBtn':
            this.printDocument('invoice');
            break;
        case 'fillInvoiceFromWorklogBtn':  // NEW
            this.fillInvoiceFromWorklog();
            break;
        
        // PDF and Email
        case 'pdfReportBtn':
            this.showPDFOptions();
            break;
        case 'emailReportBtn':
            this.showEmailForm();
            break;
            
        default:
            console.log('Unhandled button:', buttonId);
    }
}

    // ==================== OPTIONAL: SAVE REPORTS TO FIREBASE ====================
    async saveReportToFirebase(reportType, reportData) {
        try {
            const user = firebase.auth().currentUser;
            if (!user) {
                console.log('Not logged in, cannot save report');
                return false;
            }
            
            const report = {
                type: reportType,
                generatedAt: new Date().toISOString(),
                dateRange: {
                    start: reportData.startDate || null,
                    end: reportData.endDate || null
                },
                totals: reportData.totals || {},
                summary: reportData.summary || '',
                entryCount: reportData.entryCount || 0
                // Don't save full HTML to keep Firebase clean
            };
            
            const db = firebase.firestore();
            await db.collection('users').doc(user.uid)
                .collection('reports').add(report);
                
            console.log(`✅ Report saved to Firebase: ${reportType}`);
            return true;
            
        } catch (error) {
            console.error('Error saving report to Firebase:', error);
            return false;
        }
    }

    // Add to ReportManager class
setupLogoUpload() {
    const uploadBtn = document.getElementById('uploadLogoBtn');
    const logoPreview = document.getElementById('logoPreview');
    const logoImage = document.getElementById('logoImage');
    const removeBtn = document.getElementById('removeLogoBtn');
    
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (readerEvent) => {
                        const logoData = readerEvent.target.result;
                        localStorage.setItem('invoiceLogo', logoData);
                        logoImage.src = logoData;
                        logoPreview.style.display = 'block';
                        this.showNotification('Logo uploaded!', 'success');
                    };
                    reader.readAsDataURL(file);
                }
            };
            
            input.click();
        });
    }
    
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            localStorage.removeItem('invoiceLogo');
            logoPreview.style.display = 'none';
            logoImage.src = '';
            this.showNotification('Logo removed', 'info');
        });
    }
    
    // Load existing logo
    const savedLogo = localStorage.getItem('invoiceLogo');
    if (savedLogo && logoImage && logoPreview) {
        logoImage.src = savedLogo;
        logoPreview.style.display = 'block';
    }
}

// Add to your ReportManager class
setupBusinessNameStyling() {
    const businessNameInput = document.getElementById('invoiceBusinessName');
    const fontSelect = document.getElementById('invoiceFont');
    const fontSizeSelect = document.getElementById('invoiceFontSize');
    const fontColorInput = document.getElementById('invoiceFontColor');
    const fontBoldCheck = document.getElementById('invoiceFontBold');
    const fontItalicCheck = document.getElementById('invoiceFontItalic');
    const preview = document.getElementById('businessNamePreview');
    
    // Load saved preferences
    this.loadBusinessNameStyles();
    
    // Update preview function
    const updatePreview = () => {
        if (!preview) return;
        
        const businessName = businessNameInput?.value || 'Your Business Name';
        const font = fontSelect?.value || "'Courier New', monospace";
        const size = fontSizeSelect?.value || '24px';
        const color = fontColorInput?.value || '#000000';
        const bold = fontBoldCheck?.checked ? 'bold' : 'normal';
        const italic = fontItalicCheck?.checked ? 'italic' : 'normal';
        
        preview.textContent = businessName || 'Your Business Name';
        preview.style.fontFamily = font;
        preview.style.fontSize = size;
        preview.style.color = color;
        preview.style.fontWeight = bold;
        preview.style.fontStyle = italic;
        
        // Save preferences
        this.saveBusinessNameStyles({
            font, size, color, bold: fontBoldCheck?.checked, italic: fontItalicCheck?.checked
        });
    };
    
    // Add event listeners
    if (businessNameInput) businessNameInput.addEventListener('input', updatePreview);
    if (fontSelect) fontSelect.addEventListener('change', updatePreview);
    if (fontSizeSelect) fontSizeSelect.addEventListener('change', updatePreview);
    if (fontColorInput) fontColorInput.addEventListener('input', updatePreview);
    if (fontBoldCheck) fontBoldCheck.addEventListener('change', updatePreview);
    if (fontItalicCheck) fontItalicCheck.addEventListener('change', updatePreview);
    
    // Initial preview
    updatePreview();
}

saveBusinessNameStyles(styles) {
    localStorage.setItem('invoiceFontStyles', JSON.stringify(styles));
    console.log('✅ Font styles saved');
}

loadBusinessNameStyles() {
    const saved = localStorage.getItem('invoiceFontStyles');
    if (!saved) return;
    
    try {
        const styles = JSON.parse(saved);
        
        const fontSelect = document.getElementById('invoiceFont');
        const fontSizeSelect = document.getElementById('invoiceFontSize');
        const fontColorInput = document.getElementById('invoiceFontColor');
        const fontBoldCheck = document.getElementById('invoiceFontBold');
        const fontItalicCheck = document.getElementById('invoiceFontItalic');
        
        if (fontSelect && styles.font) fontSelect.value = styles.font;
        if (fontSizeSelect && styles.size) fontSizeSelect.value = styles.size;
        if (fontColorInput && styles.color) fontColorInput.value = styles.color;
        if (fontBoldCheck && styles.bold !== undefined) fontBoldCheck.checked = styles.bold;
        if (fontItalicCheck && styles.italic !== undefined) fontItalicCheck.checked = styles.italic;
        
        console.log('✅ Font styles loaded');
    } catch (error) {
        console.error('Error loading font styles:', error);
    }
}

    // Set up business name and logo 
setupLogoUpload() {
    const uploadBtn = document.getElementById('uploadLogoBtn');
    const logoPreview = document.getElementById('logoPreview');
    const logoImage = document.getElementById('logoImage');
    const removeBtn = document.getElementById('removeLogoBtn');
    const businessNameInput = document.getElementById('invoiceBusinessName');
    
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (readerEvent) => {
                        const logoData = readerEvent.target.result;
                        
                        // Save to localStorage
                        localStorage.setItem('invoiceLogo', logoData);
                        
                        // Show preview
                        if (logoImage && logoPreview) {
                            logoImage.src = logoData;
                            logoPreview.style.display = 'flex';
                        }
                        
                        // Clear business name if logo is uploaded
                        if (businessNameInput) {
                            businessNameInput.value = '';
                        }
                        
                        this.showNotification('Logo uploaded!', 'success');
                    };
                    reader.readAsDataURL(file);
                }
            };
            
            input.click();
        });
    }
    
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            localStorage.removeItem('invoiceLogo');
            if (logoPreview) logoPreview.style.display = 'none';
            if (logoImage) logoImage.src = '';
            this.showNotification('Logo removed', 'info');
        });
    }
    
    // Load existing logo on init
    this.loadSavedLogo();
}

loadSavedLogo() {
    const savedLogo = localStorage.getItem('invoiceLogo');
    const logoPreview = document.getElementById('logoPreview');
    const logoImage = document.getElementById('logoImage');
    
    if (savedLogo && logoImage && logoPreview) {
        logoImage.src = savedLogo;
        logoPreview.style.display = 'flex';
        console.log('✅ Logo loaded from storage');
    }
}
    // ==================== BVTB CLAIM FORM GENERATION ====================
   generateClaimForm() {       
    // Get form values
    const name = document.getElementById('claimName')?.value || 'David Moseley';
    const address = document.getElementById('claimAddress')?.value || '142 Coles Terrace, St.Philip';
    const homePhone = document.getElementById('claimHomePhone')?.value || '572-8040';
    const workPhone = document.getElementById('claimWorkPhone')?.value || '1367-8221';
    const programme = document.getElementById('claimProgramme')?.value || 'Cosmetology';
    const startDate = document.getElementById('claimStartDate')?.value;
    const endDate = document.getElementById('claimEndDate')?.value;
    
    if (!startDate || !endDate) {
        alert('Please select start and end dates');
        return;
    }
    
    // Get entries in date range
    const entries = this.getEntriesInDateRange(startDate, endDate);
    
    if (entries.length === 0) {
        alert('No worklog entries found in this date range');
        return;
    }
    
    // Group entries by date with session counting
    const groupedEntries = {};
    entries.forEach(entry => {
        const date = entry.date;
        if (!groupedEntries[date]) {
            groupedEntries[date] = {
                date: date,
                sessions: 0,
                hours: 0
            };
        }
        
        // USE THE SAVED SESSIONS FIELD - THIS IS THE KEY FIX!
        const sessionCount = entry.sessions || 1; // Default to 1 if not set
        groupedEntries[date].sessions += sessionCount;
        groupedEntries[date].hours += entry.duration || 0;
        
        console.log(`📊 Date ${date}: +${sessionCount} sessions, ${entry.duration} hours`);
    });
    
    // Sort by date
    const sortedEntries = Object.values(groupedEntries).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    // Calculate totals
    const totalSessions = sortedEntries.reduce((sum, e) => sum + e.sessions, 0);
    const totalHours = sortedEntries.reduce((sum, e) => sum + e.hours, 0);
    
    console.log(`📊 Claim Form Totals: ${totalSessions} sessions, ${totalHours} hours`);
    
    // Format dates for display
    const formatDisplayDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    
    // Create claim form HTML
    const claimHTML = `
        <div style="font-family: 'Courier New', monospace; max-width: 800px; margin: 0 auto; padding: 20px; background: white; color: black;">
            <h2 style="text-align: center; margin-bottom: 30px; color: #000;">Social Skills Programme Claim Form</h2>
            
            <div style="margin-bottom: 30px; color: #000;">
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Address:</strong> ${address}</p>
                <p><strong>Tel Nos:</strong> Home: ${homePhone} (Work: ${workPhone})</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; color: #000;">
                <thead>
                    <tr style="background: #f0f0f0;">
                        <th style="border: 1px solid #000; padding: 10px; text-align: left;">Date</th>
                        <th style="border: 1px solid #000; padding: 10px; text-align: left;">Programme</th>
                        <th style="border: 1px solid #000; padding: 10px; text-align: center;">Sessions</th>
                        <th style="border: 1px solid #000; padding: 10px; text-align: center;">Hours</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedEntries.map(entry => `
                        <tr>
                            <td style="border: 1px solid #000; padding: 10px;">${formatDisplayDate(entry.date)}</td>
                            <td style="border: 1px solid #000; padding: 10px;">${programme}</td>
                            <td style="border: 1px solid #000; padding: 10px; text-align: center;">${entry.sessions}</td>
                            <td style="border: 1px solid #000; padding: 10px; text-align: center;">${entry.hours.toFixed(1)}</td>
                        </tr>
                    `).join('')}
                    <tr style="background: #f9f9f9; font-weight: bold;">
                        <td style="border: 1px solid #000; padding: 10px;" colspan="2">Totals</td>
                        <td style="border: 1px solid #000; padding: 10px; text-align: center;">${totalSessions}</td>
                        <td style="border: 1px solid #000; padding: 10px; text-align: center;">${totalHours.toFixed(1)}</td>
                    </tr>
                </tbody>
            </table>
            
            <div style="display: flex; justify-content: space-between; margin-top: 50px; color: #000;">
                <div>
                    <p>Signature _________________________</p>
                    <p>Date _________________________</p>
                </div>
                <div>
                    <p>Verified _________________________</p>
                </div>
            </div>
        </div>
    `;
    
    // Show preview
    this.showPreview(claimHTML, 'Claim Form');
}

    // ==================== BVTB INVOICE GENERATION ====================
generateInvoice() {
    // Get form values
    const invoiceNumber = document.getElementById('invoiceNumber')?.value || '003';
    const invoiceDate = document.getElementById('invoiceDate')?.value;
    const invoiceTo = document.getElementById('invoiceTo')?.value || 'Barbados Vocational Board\nLawrence Green House\nCulloden Road, St. Michael';
    const itemDesc = document.getElementById('invoiceItem')?.value || 'Cosmetology';
    const rate = parseFloat(document.getElementById('invoiceRate')?.value) || 82.97;
    const startDate = document.getElementById('invoiceStartDate')?.value;
    const endDate = document.getElementById('invoiceEndDate')?.value;
    
    // Get business name and logo
    const businessName = document.getElementById('invoiceBusinessName')?.value || '';
    const logoData = localStorage.getItem('invoiceLogo'); // THIS IS THE KEY LINE
    
    // Get font styles
    const fontStyles = JSON.parse(localStorage.getItem('invoiceFontStyles') || '{}');
    
    console.log('📋 Generating invoice with logo:', logoData ? '✅ Present' : '❌ Not found');
    
    if (!invoiceDate || !startDate || !endDate) {
        alert('Please select all dates');
        return;
    }
    
    // Get entries in date range
    const entries = this.getEntriesInDateRange(startDate, endDate);
    
    if (entries.length === 0) {
        alert('No worklog entries found in this date range');
        return;
    }
    
    // Group entries by date
    const groupedEntries = {};
    entries.forEach(entry => {
        const date = entry.date;
        if (!groupedEntries[date]) {
            groupedEntries[date] = {
                date: date,
                hours: 0,
                amount: 0
            };
        }
        groupedEntries[date].hours += entry.duration || 0;
        groupedEntries[date].amount += entry.totalEarnings || 0;
    });
    
    // Sort by date
    const sortedEntries = Object.values(groupedEntries).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    // Calculate total
    const totalAmount = sortedEntries.reduce((sum, e) => sum + e.amount, 0);
    
    // Format dates for display
    const formatDisplayDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    
    // Format address lines
    const addressLines = invoiceTo.split('\n').map(line => line.trim()).filter(line => line);
    
    // Create logo HTML if exists
    const logoHTML = logoData 
        ? `<img src="${logoData}" style="max-height: 60px; max-width: 200px; object-fit: contain;">` 
        : (businessName || 'INVOICE');
    
    // Create invoice HTML
    const invoiceHTML = `
        <div style="font-family: 'Courier New', monospace; max-width: 800px; margin: 0 auto; padding: 20px; background: white; color: black;">
            <!-- Logo/Business Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #000;">
                <div style="
                    font-family: ${fontStyles.font || "'Courier New', monospace"};
                    font-size: ${fontStyles.size || '24px'};
                    color: ${fontStyles.color || '#000000'};
                    font-weight: ${fontStyles.bold ? 'bold' : 'normal'};
                    font-style: ${fontStyles.italic ? 'italic' : 'normal'};
                ">
                    ${logoHTML}
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; color: #000;">INVOICE</h2>
                    <p style="margin: 5px 0 0 0; color: #000;">No. ${invoiceNumber}</p>
                </div>
            </div>
            
            <!-- Invoice Date -->
            <div style="text-align: right; margin-bottom: 30px; color: #000;">
                <p><strong>Date:</strong> ${formatDisplayDate(invoiceDate)}</p>
            </div>
            
            <!-- Issued To -->
            <div style="margin-bottom: 30px; color: #000;">
                <p><strong>Issued to:</strong></p>
                ${addressLines.map(line => `<p>${line}</p>`).join('')}
            </div>
            
            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; color: #000;">
                <thead>
                    <tr style="background: #f0f0f0;">
                        <th style="border: 1px solid #000; padding: 10px; text-align: left;">Date</th>
                        <th style="border: 1px solid #000; padding: 10px; text-align: left;">Item</th>
                        <th style="border: 1px solid #000; padding: 10px; text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedEntries.map(entry => `
                        <tr>
                            <td style="border: 1px solid #000; padding: 10px;">${formatDisplayDate(entry.date)}</td>
                            <td style="border: 1px solid #000; padding: 10px;">${itemDesc} ${entry.hours.toFixed(1)} hours @ $${rate.toFixed(2)}</td>
                            <td style="border: 1px solid #000; padding: 10px; text-align: right;">$${entry.amount.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <!-- Total -->
            <div style="text-align: right; font-size: 1.2rem; font-weight: bold; margin-bottom: 50px; color: #000;">
                <p>Total $${totalAmount.toFixed(2)}</p>
            </div>
            
            <!-- Issued By -->
            <div style="color: #000;">
                <p>Issued by: _________________________</p>
            </div>
        </div>
    `;
    
    // Show preview
    this.showPreview(invoiceHTML, `Invoice #${invoiceNumber}`);
}

    // ==================== PREVIEW & PRINT ====================
    showPreview(html, title) {
        // First, update the report content area
        const previewHTML = this.createReportTemplate(`📄 ${title}`, html, false);
        this.updateReportContent(previewHTML);
        
        // Also try to show the preview section if it exists
        const previewSection = document.getElementById('documentPreview');
        if (previewSection) {
            const previewContent = document.getElementById('previewContent');
            if (previewContent) {
                previewContent.innerHTML = html;
                previewSection.style.display = 'block';
                previewSection.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

printDocument(type) {
    let htmlToPrint = '';
    
    if (type === 'claim') {
        // Get the current claim form HTML from preview or generate fresh
        const previewContent = document.getElementById('previewContent');
        if (previewContent) {
            htmlToPrint = previewContent.innerHTML;
        } else {
            htmlToPrint = this.generateClaimFormHTML(true);
        }
    } else if (type === 'invoice') {
        const previewContent = document.getElementById('previewContent');
        if (previewContent) {
            htmlToPrint = previewContent.innerHTML;
        } else {
            htmlToPrint = this.generateInvoiceHTML(true);
        }
    } else {
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>WorkLog Pro - ${type === 'claim' ? 'Claim Form' : 'Invoice'}</title>
                <style>
                    body { 
                        font-family: 'Courier New', monospace; 
                        padding: 40px; 
                        background: white;
                        color: black;
                    }
                    @media print {
                        body { padding: 20px; }
                    }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                    th { background: #f0f0f0; }
                </style>
            </head>
            <body>
                ${htmlToPrint}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

    generateClaimFormHTML(returnOnly = false) {
        // This is a helper to get just the HTML without showing preview
        const name = document.getElementById('claimName')?.value || 'David Moseley';
        const address = document.getElementById('claimAddress')?.value || '142 Coles Terrace, St.Philip';
        const homePhone = document.getElementById('claimHomePhone')?.value || '572-8040';
        const workPhone = document.getElementById('claimWorkPhone')?.value || '1367-8221';
        const programme = document.getElementById('claimProgramme')?.value || 'Cosmetology';
        const startDate = document.getElementById('claimStartDate')?.value;
        const endDate = document.getElementById('claimEndDate')?.value;
        
        if (!startDate || !endDate) return '';
        
        const entries = this.getEntriesInDateRange(startDate, endDate);
        
        if (entries.length === 0) return '';
        
        const groupedEntries = {};
        entries.forEach(entry => {
            const date = entry.date;
            if (!groupedEntries[date]) {
                groupedEntries[date] = {
                    date: date,
                    sessions: 0,
                    hours: 0
                };
            }
            groupedEntries[date].sessions += entry.sessions || 1; 
            groupedEntries[date].hours += entry.duration || 0;
        });
        
        const sortedEntries = Object.values(groupedEntries).sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        const totalSessions = sortedEntries.reduce((sum, e) => sum + e.sessions, 0);
        const totalHours = sortedEntries.reduce((sum, e) => sum + e.hours, 0);
        
        const formatDisplayDate = (dateStr) => {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        };
        
        return `
            <div style="font-family: 'Courier New', monospace; max-width: 800px; margin: 0 auto; padding: 20px;">
                <h2 style="text-align: center; margin-bottom: 30px;">Social Skills Programme Claim Form</h2>
                
                <div style="margin-bottom: 30px;">
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Address:</strong> ${address}</p>
                    <p><strong>Tel Nos:</strong> Home: ${homePhone} (Work: ${workPhone})</p>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #f0f0f0;">
                            <th style="border: 1px solid #000; padding: 10px; text-align: left;">Date</th>
                            <th style="border: 1px solid #000; padding: 10px; text-align: left;">Programme</th>
                            <th style="border: 1px solid #000; padding: 10px; text-align: center;">Sessions</th>
                            <th style="border: 1px solid #000; padding: 10px; text-align: center;">Hours</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedEntries.map(entry => `
                            <tr>
                                <td style="border: 1px solid #000; padding: 10px;">${formatDisplayDate(entry.date)}</td>
                                <td style="border: 1px solid #000; padding: 10px;">${programme}</td>
                                <td style="border: 1px solid #000; padding: 10px; text-align: center;">${entry.sessions}</td>
                                <td style="border: 1px solid #000; padding: 10px; text-align: center;">${entry.hours.toFixed(1)}</td>
                            </tr>
                        `).join('')}
                        <tr style="background: #f9f9f9; font-weight: bold;">
                            <td style="border: 1px solid #000; padding: 10px;" colspan="2">Totals</td>
                            <td style="border: 1px solid #000; padding: 10px; text-align: center;">${totalSessions}</td>
                            <td style="border: 1px solid #000; padding: 10px; text-align: center;">${totalHours.toFixed(1)}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div style="display: flex; justify-content: space-between; margin-top: 50px;">
                    <div>
                        <p>Signature _________________________</p>
                        <p>Date _________________________</p>
                    </div>
                    <div>
                        <p>Verified _________________________</p>
                    </div>
                </div>
            </div>
        `;
    }

    generateInvoiceHTML(returnOnly = false) {
        // This is a helper to get just the HTML without showing preview
        const invoiceNumber = document.getElementById('invoiceNumber')?.value || '003';
        const invoiceDate = document.getElementById('invoiceDate')?.value;
        const invoiceTo = document.getElementById('invoiceTo')?.value || 'Barbados Vocational Board\nLawrence Green House\nCulloden Road, St. Michael';
        const itemDesc = document.getElementById('invoiceItem')?.value || 'Cosmetology';
        const rate = parseFloat(document.getElementById('invoiceRate')?.value) || 82.97;
        const startDate = document.getElementById('invoiceStartDate')?.value;
        const endDate = document.getElementById('invoiceEndDate')?.value;
        
        if (!invoiceDate || !startDate || !endDate) return '';
        
        const entries = this.getEntriesInDateRange(startDate, endDate);
        
        if (entries.length === 0) return '';
        
        const groupedEntries = {};
        entries.forEach(entry => {
            const date = entry.date;
            if (!groupedEntries[date]) {
                groupedEntries[date] = {
                    date: date,
                    hours: 0,
                    amount: 0
                };
            }
            groupedEntries[date].hours += entry.duration || 0;
            groupedEntries[date].amount += entry.totalEarnings || 0;
        });
        
        const sortedEntries = Object.values(groupedEntries).sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        const totalAmount = sortedEntries.reduce((sum, e) => sum + e.amount, 0);
        
        const formatDisplayDate = (dateStr) => {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        };
        
        const addressLines = invoiceTo.split('\n').map(line => line.trim()).filter(line => line);
        
        return `
            <div style="font-family: 'Courier New', monospace; max-width: 800px; margin: 0 auto; padding: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                    <h2>INVOICE No. ${invoiceNumber}</h2>
                    <p>${formatDisplayDate(invoiceDate)}</p>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <p><strong>Issued to:</strong></p>
                    ${addressLines.map(line => `<p>${line}</p>`).join('')}
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #f0f0f0;">
                            <th style="border: 1px solid #000; padding: 10px; text-align: left;">Date</th>
                            <th style="border: 1px solid #000; padding: 10px; text-align: left;">Item</th>
                            <th style="border: 1px solid #000; padding: 10px; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedEntries.map(entry => `
                            <tr>
                                <td style="border: 1px solid #000; padding: 10px;">${formatDisplayDate(entry.date)}</td>
                                <td style="border: 1px solid #000; padding: 10px;">${itemDesc} ${entry.hours.toFixed(1)} hours @ $${rate.toFixed(2)}</td>
                                <td style="border: 1px solid #000; padding: 10px; text-align: right;">$${entry.amount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div style="text-align: right; font-size: 1.2rem; font-weight: bold; margin-bottom: 50px;">
                    <p>Total $${totalAmount.toFixed(2)}</p>
                </div>
                
                <div>
                    <p>Issued by: _________________________</p>
                </div>
            </div>
        `;
    }

    // ==================== EXISTING REPORT METHODS ====================
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
            // Update from dataManager
            const logs = await this.dataManager.getAllLogs();
            const students = await this.dataManager.getAllStudents();
            const marks = await this.dataManager.getAllMarks();
            const payments = await this.dataManager.getAllPayments();
            
            const totalHours = logs.reduce((sum, log) => sum + parseFloat(log.duration || 0), 0);
            const totalEarnings = logs.reduce((sum, log) => {
                const student = students.find(s => s.name === log.studentName);
                const rate = student?.hourlyRate || 0;
                return sum + (parseFloat(log.duration || 0) * rate);
            }, 0);
            
            const avgMark = marks.length > 0 
                ? marks.reduce((sum, m) => sum + parseFloat(m.percentage || 0), 0) / marks.length 
                : 0;
                
            const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.paymentAmount || 0), 0);
            const outstandingBalance = totalEarnings - totalPayments;
            
            // Update from worklog for summary cards
            const worklogEntries = this.worklogEntries;
            const worklogHours = worklogEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
            const worklogEarnings = worklogEntries.reduce((sum, e) => sum + (e.totalEarnings || 0), 0);
            
            // Get current month's earnings from worklog
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEarnings = worklogEntries
                .filter(e => new Date(e.date + 'T12:00:00') >= startOfMonth)
                .reduce((sum, e) => sum + (e.totalEarnings || 0), 0);
            
            const updateElement = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            
            // Update all stats displays
            updateElement('totalStudentsReport', students.length);
            updateElement('totalHoursReport', totalHours.toFixed(2));
            updateElement('totalEarningsReport', `$${totalEarnings.toFixed(2)}`);
            updateElement('avgMarkReport', `${avgMark.toFixed(1)}%`);
            updateElement('totalPaymentsReport', `$${totalPayments.toFixed(2)}`);
            updateElement('outstandingBalance', `$${outstandingBalance.toFixed(2)}`);
            
            // Update summary cards
            updateElement('reportTotalHours', worklogHours.toFixed(1));
            updateElement('reportTotalEarnings', `$${worklogEarnings.toFixed(2)}`);
            updateElement('reportMonthEarnings', `$${monthEarnings.toFixed(2)}`);
            
            // Update quick stats
            updateElement('worklogStatsCount', worklogEntries.length);
            if (worklogEntries.length > 0) {
                const avgDuration = worklogHours / worklogEntries.length;
                updateElement('worklogAvgDuration', avgDuration.toFixed(1) + 'h');
            } else {
                updateElement('worklogAvgDuration', '0h');
            }
            
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

// Keep existing global functions but redirect to new methods
window.generateClaimForm = function() {
    if (window.reportManager) {
        window.reportManager.generateClaimForm();
    }
};

window.emailClaimForm = function() {
    if (window.reportManager) {
        window.reportManager.emailClaimForm();
    }
};

window.generateInvoice = function() {
    if (window.reportManager) {
        window.reportManager.generateInvoice();
    }
};

window.emailInvoice = function() {
    if (window.reportManager) {
        window.reportManager.emailInvoice();
    }
};

// Initialize ReportManager
console.log('Creating ReportManager...');
new ReportManager();
