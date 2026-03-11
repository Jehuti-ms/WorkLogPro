// worklog.js - Complete Worklog System
console.log('📝 Loading worklog.js...');

class WorklogManager {
    constructor() {
        console.log('📝 WorklogManager constructor called');
        this.entries = [];
        this.students = [];
        this.institutions = [];
        this.init();
    }

    init() {
        console.log('📝 Initializing WorklogManager...');
        this.loadData();
        this.loadEntries();
        this.migrateOldEntries();
        this.setupEventListeners();
        this.updateUI();
        this.updateStats();
        
        // Set today's date in the form
        this.setTodayDate();
    }

    setTodayDate() {
        const today = new Date().toISOString().split('T')[0];
        const dateField = document.getElementById('worklogDate');
        if (dateField) dateField.value = today;
    }

    loadData() {
        // Load students
        this.students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
        
        // Load institutions
        this.loadInstitutions();
    }

    loadInstitutions() {
        const saved = localStorage.getItem('worklog_institutions');
        if (saved) {
            this.institutions = JSON.parse(saved);
        } else {
            // Extract from entries
            const unique = [...new Set(
                this.entries
                    .filter(e => e.workType === 'institution')
                    .map(e => e.institutionName)
            )];
            
            this.institutions = unique.map(name => ({
                id: 'inst_' + name.toLowerCase().replace(/\s+/g, '_'),
                name: name
            }));
            
            localStorage.setItem('worklog_institutions', JSON.stringify(this.institutions));
        }
    }

   loadEntries() {
    try {
        this.entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
        console.log(`✅ Loaded ${this.entries.length} worklog entries`);
        
        // Update stats on load
        if (typeof updateGlobalStats === 'function') {
            updateGlobalStats();
        }
        
        return this.entries;
    } catch (error) {
        console.error('Error loading entries:', error);
        this.entries = [];
        return [];
    }
}

 saveEntries() {
    try {
        localStorage.setItem('worklog_entries', JSON.stringify(this.entries));
        console.log(`✅ Saved ${this.entries.length} entries to localStorage`);
        
        // Trigger global stats update
        if (typeof updateGlobalStats === 'function') {
            updateGlobalStats();
            console.log('📊 Global stats updated from worklog');
        }
        
        // Trigger profile stats update
        if (typeof updateProfileStats === 'function') {
            updateProfileStats();
        }
        
        // Trigger refresh for reports
        document.dispatchEvent(new Event('worklogUpdated'));
        
        if (window.syncService && firebase.auth().currentUser) {
            setTimeout(() => window.syncService.sync(false, false), 500);
        }
        
        this.updateStats();
        return true;
    } catch (error) {
        console.error('❌ Error saving entries:', error);
        return false;
    }
}
    
    addEntry(entryData) {
        try {
            const totalEarnings = entryData.duration * entryData.rate;
            
            const newEntry = {
                id: 'worklog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                ...entryData,
                totalEarnings: totalEarnings,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Save institution if needed
            if (entryData.workType === 'institution' && entryData.institutionName) {
                this.addInstitution(entryData.institutionName);
            }

            this.entries.unshift(newEntry);
            this.saveEntries();
            this.updateUI();
            this.updateStats();
            
            console.log('✅ Worklog entry added:', newEntry);
            return newEntry;
        } catch (error) {
            console.error('❌ Error adding entry:', error);
            return null;
        }
    }

    addInstitution(name) {
        if (!name || name.trim() === '') return null;
        
        name = name.trim();
        let existing = this.institutions.find(i => 
            i.name.toLowerCase() === name.toLowerCase()
        );
        
        if (existing) return existing;
        
        const newInst = {
            id: 'inst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: name,
            createdAt: new Date().toISOString()
        };
        
        this.institutions.push(newInst);
        localStorage.setItem('worklog_institutions', JSON.stringify(this.institutions));
        
        return newInst;
    }

   deleteEntry(entryId) {
    try {
        if (!confirm('Delete this worklog entry?')) return false;
        
        this.entries = this.entries.filter(e => e.id !== entryId);
        this.saveEntries(); // This already calls updateGlobalStats
        
        console.log('✅ Entry deleted:', entryId);
        return true;
    } catch (error) {
        console.error('❌ Error deleting entry:', error);
        return false;
    }
}
    
   editEntry(entryId) {
    const entry = this.entries.find(e => e.id === entryId);
    if (!entry) return;

    console.log('✏️ Editing entry:', entry); // Debug log

    // Set work type
    if (entry.workType === 'student') {
        document.querySelector('input[name="workType"][value="student"]').checked = true;
        this.toggleType('student');
        document.getElementById('worklogStudent').value = entry.studentId || '';
    } else {
        document.querySelector('input[name="workType"][value="institution"]').checked = true;
        this.toggleType('institution');
        document.getElementById('worklogInstitution').value = entry.institutionName || '';
        document.getElementById('worklogContactPerson').value = entry.contactPerson || '';
    }

    // Fill common fields
    document.getElementById('worklogDate').value = entry.date || '';
    document.getElementById('worklogSubject').value = entry.subject || '';
    document.getElementById('worklogTopic').value = entry.topic || '';
    document.getElementById('worklogDuration').value = entry.duration || '';
    
    // 🔴 FIX: ADD SESSIONS FIELD HERE
    const sessionsField = document.getElementById('worklogSessions');
    if (sessionsField) {
        sessionsField.value = entry.sessions || 1;
        console.log(`📊 Setting sessions to: ${entry.sessions || 1}`);
    }
    
    document.getElementById('worklogRate').value = entry.rate || '';
    document.getElementById('worklogDescription').value = entry.description || '';
    document.getElementById('worklogOutcomes').value = entry.outcomes || '';
    document.getElementById('worklogNextSteps').value = entry.nextSteps || '';
    document.getElementById('worklogNotes').value = entry.notes || '';

    // Set payment type if it exists
    const paymentTypeSelect = document.getElementById('worklogPaymentType');
    if (paymentTypeSelect && entry.paymentType) {
        paymentTypeSelect.value = entry.paymentType;
    }

    // Change submit button
    document.getElementById('worklogSubmitBtn').textContent = '💾 Update Entry';
    this.editingId = entryId;

    // Scroll to form
    document.getElementById('worklogForm').scrollIntoView({ behavior: 'smooth' });
}

    toggleType(type) {
        const studentSection = document.getElementById('studentSection');
        const institutionSection = document.getElementById('institutionSection');
        const studentSelect = document.getElementById('worklogStudent');
        const institutionInput = document.getElementById('worklogInstitution');

        if (type === 'student') {
            studentSection.style.display = 'block';
            institutionSection.style.display = 'none';
            studentSelect.required = true;
            institutionInput.required = false;
        } else {
            studentSection.style.display = 'none';
            institutionSection.style.display = 'block';
            studentSelect.required = false;
            institutionInput.required = true;
        }
    }

   setupEventListeners() {
    const form = document.getElementById('worklogForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }

    const filterType = document.getElementById('worklogFilterType');
    if (filterType) {
        filterType.addEventListener('change', () => this.updateUI());
    }

    const filterEntity = document.getElementById('worklogFilterEntity');
    if (filterEntity) {
        filterEntity.addEventListener('change', () => this.updateUI());
    }

    const searchInput = document.getElementById('worklogSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => this.updateUI());
    }

    // ADD THIS - Sort order dropdown
    const sortOrder = document.getElementById('worklogSortOrder');
    if (sortOrder) {
        sortOrder.addEventListener('change', () => {
            console.log('Sort changed to:', sortOrder.value);
            this.updateUI();
        });
    }
}
    
    updateFilterDropdown() {
        const type = document.getElementById('worklogFilterType')?.value;
        const entitySelect = document.getElementById('worklogFilterEntity');
        
        if (!entitySelect) return;
        
        let options = '<option value="">All</option>';
        
        if (type === 'student') {
            this.students.forEach(s => {
                options += `<option value="student_${s.id}">👤 ${s.name}</option>`;
            });
        } else if (type === 'institution') {
            this.institutions.forEach(i => {
                options += `<option value="inst_${i.name}">🏢 ${i.name}</option>`;
            });
        } else {
            // Both types
            this.students.forEach(s => {
                options += `<option value="student_${s.id}">👤 ${s.name}</option>`;
            });
            this.institutions.forEach(i => {
                options += `<option value="inst_${i.name}">🏢 ${i.name}</option>`;
            });
        }
        
        entitySelect.innerHTML = options;
        this.updateUI();
    }

   handleSubmit() {
    const workType = document.querySelector('input[name="workType"]:checked')?.value;
    
    let entryData = {
        workType: workType,
        paymentType: document.getElementById('worklogPaymentType')?.value || 'hourly',
        date: document.getElementById('worklogDate').value,
        subject: document.getElementById('worklogSubject').value.trim(),
        topic: document.getElementById('worklogTopic').value.trim(),
        duration: parseFloat(document.getElementById('worklogDuration').value),
        sessions: parseInt(document.getElementById('worklogSessions').value) || 1, // 🔴 FIX: Add this
        rate: parseFloat(document.getElementById('worklogRate').value),
        description: document.getElementById('worklogDescription').value.trim(),
        outcomes: document.getElementById('worklogOutcomes').value.trim(),
        nextSteps: document.getElementById('worklogNextSteps').value.trim(),
        notes: document.getElementById('worklogNotes').value.trim()
    };

    console.log('📝 Submitting entry data:', entryData); // Debug log

    // Validate based on work type
    if (workType === 'student') {
        const studentId = document.getElementById('worklogStudent').value;
        const student = this.students.find(s => s.id === studentId);
        
        if (!studentId) {
            alert('Please select a student');
            return;
        }
        
        entryData.studentId = studentId;
        entryData.studentName = student ? student.name : 'Unknown Student';
        entryData.entityName = student ? student.name : 'Unknown Student';
        
    } else {
        const institutionName = document.getElementById('worklogInstitution').value.trim();
        const contactPerson = document.getElementById('worklogContactPerson').value.trim();
        
        if (!institutionName) {
            alert('Please enter institution name');
            return;
        }
        
        entryData.institutionName = institutionName;
        entryData.contactPerson = contactPerson;
        entryData.entityName = institutionName;
    }

    // Validate common fields
    if (!entryData.subject) {
        alert('Subject is required');
        return;
    }

    if (!entryData.topic) {
        alert('Topic is required');
        return;
    }

    if (!entryData.description) {
        alert('Description is required');
        return;
    }

    // Check if editing
    if (this.editingId) {
        const index = this.entries.findIndex(e => e.id === this.editingId);
        if (index !== -1) {
            // Preserve the original createdAt
            const originalCreatedAt = this.entries[index].createdAt;
            
            this.entries[index] = {
                ...this.entries[index],
                ...entryData,
                totalEarnings: entryData.duration * entryData.rate,
                createdAt: originalCreatedAt,
                updatedAt: new Date().toISOString()
            };
            
            console.log('✅ Updated entry:', this.entries[index]); // Debug log
            this.saveEntries();
            alert('Entry updated!');
        }
    } else {
        this.addEntry(entryData);
    }

    this.clearForm();
}
    
    clearForm() {
        document.getElementById('worklogForm').reset();
        this.setTodayDate();
        
        // Reset to student view
        document.querySelector('input[name="workType"][value="student"]').checked = true;
        this.toggleType('student');
        
        // Reset submit button
        document.getElementById('worklogSubmitBtn').textContent = '💾 Save Worklog';
        this.editingId = null;
    }

    populateDropdowns() {
        // Student dropdown
        const studentSelect = document.getElementById('worklogStudent');
        if (studentSelect) {
            studentSelect.innerHTML = '<option value="">Select Student</option>' +
                this.students.map(s => `<option value="${s.id}">${s.name} (${s.studentId})</option>`).join('');
        }

        // Update filter dropdown
        this.updateFilterDropdown();
    }

    // Add this method to your WorklogManager class
migrateOldEntries() {
    let needsSave = false;
    
    this.entries.forEach(entry => {
        // Fix missing sessions field
        if (entry.sessions === undefined) {
            // For 4-hour entries, default to 2 sessions (assuming 2 hours each)
            if (entry.duration === 4) {
                entry.sessions = 2;
            } else {
                entry.sessions = 1;
            }
            needsSave = true;
            console.log('🔄 Migrated old entry - added sessions:', entry.id);
        }
        
        // Fix missing totalEarnings
        if (entry.totalEarnings === undefined && entry.duration && entry.rate) {
            entry.totalEarnings = entry.duration * entry.rate;
            needsSave = true;
            console.log('🔄 Migrated old entry - added totalEarnings:', entry.id);
        }
    });
    
    if (needsSave) {
        this.saveEntries();
        console.log('✅ Migrated old entries to include missing fields');
    }
}
    
    // FIXED: Date display with proper formatting
  formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    
    // FIXED: Use split method to avoid timezone issues
    try {
        const [year, month, day] = dateStr.split('-');
        // Create date using local components (month is 0-indexed in JS)
        const date = new Date(year, month - 1, day);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date:', dateStr);
            return dateStr; // Return original if invalid
        }
        
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateStr;
    }
}

updateUI() {
    const container = document.getElementById('worklogContainer');
    if (!container) return;

    const filterType = document.getElementById('worklogFilterType')?.value;
    const filterEntity = document.getElementById('worklogFilterEntity')?.value;
    const searchQuery = document.getElementById('worklogSearch')?.value;
    const sortOrder = document.getElementById('worklogSortOrder')?.value || 'newest'; // Get sort order

    let displayEntries = [...this.entries];

    // ===== APPLY SORTING BASED ON DATE =====
    if (sortOrder === 'newest') {
        displayEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log('📅 Sorting: Newest first');
    } else {
        displayEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
        console.log('📅 Sorting: Oldest first');
    }

    // Apply filters
    if (filterType) {
        displayEntries = displayEntries.filter(e => e.workType === filterType);
    }

    if (filterEntity) {
        if (filterEntity.startsWith('student_')) {
            const studentId = filterEntity.replace('student_', '');
            displayEntries = displayEntries.filter(e => 
                e.workType === 'student' && e.studentId === studentId
            );
        } else if (filterEntity.startsWith('inst_')) {
            const instName = filterEntity.replace('inst_', '');
            displayEntries = displayEntries.filter(e => 
                e.workType === 'institution' && e.institutionName === instName
            );
        }
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        displayEntries = displayEntries.filter(e => 
            e.entityName?.toLowerCase().includes(query) ||
            e.subject?.toLowerCase().includes(query) ||
            e.topic?.toLowerCase().includes(query) ||
            e.description?.toLowerCase().includes(query)
        );
    }

    if (displayEntries.length === 0) {
        container.innerHTML = `
            <div class="worklog-empty">
                <div class="worklog-empty-icon">📝</div>
                <div class="worklog-empty-text">No worklog entries yet</div>
                <div class="worklog-empty-subtext">Add your first entry using the form above</div>
            </div>
        `;
        return;
    }

    container.innerHTML = displayEntries.map(entry => {
        const cardClass = entry.workType === 'student' ? 'worklog-card student-card' : 'worklog-card institution-card';
        const entityIcon = entry.workType === 'student' ? '👤' : '🏢';
        const entityName = entry.workType === 'student' ? entry.studentName : entry.institutionName;

        return `
            <div class="${cardClass}" data-id="${entry.id}">
                <div class="worklog-header">
                    <div class="worklog-entity">
                        <div class="worklog-entity-icon">${entityIcon}</div>
                        <div>
                            <div class="worklog-entity-name">${entityName}</div>
                            ${entry.contactPerson ? `<div class="worklog-entity-detail">Contact: ${entry.contactPerson}</div>` : ''}
                        </div>
                    </div>
                    <div class="worklog-date-badge">
                        📅 ${this.formatDate(entry.date)}
                        <span class="worklog-duration-badge">${entry.duration}h</span>
                    </div>
                </div>

                <div class="worklog-metadata">
                    <div class="worklog-metadata-item">
                        <span class="worklog-metadata-icon">📚</span>
                        <span><strong>Subject:</strong> ${entry.subject}</span>
                    </div>
                    <div class="worklog-metadata-item">
                        <span class="worklog-metadata-icon">📌</span>
                        <span><strong>Topic:</strong> ${entry.topic}</span>
                    </div>
                    <div class="worklog-metadata-item">
                        <span class="worklog-metadata-icon">💰</span>
                        <span><strong>Type:</strong> <span class="worklog-payment-tag">${this.formatPaymentType(entry.paymentType)}</span></span>
                    </div>
                    <div class="worklog-metadata-item">
                        <span class="worklog-metadata-icon">🔄</span>
                        <span><strong>Sessions:</strong> ${entry.sessions || 1}</span>
                    </div>
                </div>

                <div class="worklog-earnings">
                    <span>Total earned:</span> $${entry.totalEarnings?.toFixed(2) || '0.00'}
                </div>

                <div class="worklog-section">
                    <div class="worklog-section-title">
                        <span>📖</span> Description
                    </div>
                    <div class="worklog-section-content">${entry.description.replace(/\n/g, '<br>')}</div>
                </div>

                ${entry.outcomes ? `
                    <div class="worklog-section outcomes">
                        <div class="worklog-section-title">
                            <span>🎯</span> Outcomes
                        </div>
                        <div class="worklog-section-content">${entry.outcomes.replace(/\n/g, '<br>')}</div>
                    </div>
                ` : ''}

                ${entry.nextSteps ? `
                    <div class="worklog-section next-steps">
                        <div class="worklog-section-title">
                            <span>⏭️</span> Next Steps
                        </div>
                        <div class="worklog-section-content">${entry.nextSteps.replace(/\n/g, '<br>')}</div>
                    </div>
                ` : ''}

                ${entry.notes ? `
                    <div class="worklog-section notes">
                        <div class="worklog-section-title">
                            <span>📝</span> Notes
                        </div>
                        <div class="worklog-section-content">${entry.notes}</div>
                    </div>
                ` : ''}

                <div class="worklog-footer">
                    <div class="worklog-timestamp">
                        <span>🕒</span> ${new Date(entry.createdAt).toLocaleString()}
                        ${entry.updatedAt !== entry.createdAt ? ' (edited)' : ''}
                    </div>
                    <div class="worklog-actions">
                        <button class="worklog-btn edit" onclick="window.worklogManager.editEntry('${entry.id}')">
                            ✏️ Edit
                        </button>
                        <button class="worklog-btn delete" onclick="window.worklogManager.deleteEntry('${entry.id}')">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Update stats after rendering
    this.updateStats();
}
    
// Add this helper method to your WorklogManager class
formatPaymentType(type) {
    const types = {
        'hourly': 'Hourly',
        'session': 'Session',
        'contract': 'Contract',
        'project': 'Project',
        'consultation': 'Consultation',
        'other': 'One-off'
    };
    return types[type] || type || 'Hourly';
}

    updateStats() {
        const countElem = document.getElementById('worklogCount');
        const lastDateElem = document.getElementById('lastWorklogDate');
        
        if (countElem) countElem.textContent = this.entries.length;
        
        if (lastDateElem) {
            if (this.entries.length > 0) {
                const lastEntry = this.entries[0];
                lastDateElem.textContent = this.formatDate(lastEntry.date);
            } else {
                lastDateElem.textContent = 'Never';
            }
        }
    }
}

// Initialize
window.worklogManager = new WorklogManager();

// Global helpers
window.toggleWorkType = function(type) {
    if (window.worklogManager) {
        window.worklogManager.toggleType(type);
    }
};

window.clearWorklogForm = function() {
    if (window.worklogManager) {
        window.worklogManager.clearForm();
    }
};

// Update tab loading function
function loadWorklogData() {
    if (window.worklogManager) {
        window.worklogManager.loadData();
        window.worklogManager.populateDropdowns();
        window.worklogManager.updateUI();
        window.worklogManager.updateStats();
    }
}

console.log('✅ worklog.js loaded');
