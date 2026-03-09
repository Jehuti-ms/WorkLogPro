// worklog.js - Session Worklog Management (with Student/Institution support)
console.log('📝 Loading worklog.js...');

class WorklogManager {
    constructor() {
        console.log('📝 WorklogManager constructor called');
        this.worklogs = [];
        this.students = [];
        this.institutions = [];
        this.init();
    }

    init() {
        console.log('📝 Initializing WorklogManager...');
        this.loadData();
        this.loadWorklogs();
        this.setupEventListeners();
        this.updateUI();
    }

    // Load students and institutions
    loadData() {
        // Load students
        this.students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
        
        // Load institutions (from a separate storage or extract from worklogs)
        this.loadInstitutions();
    }

    // Load institutions from worklogs or separate storage
    loadInstitutions() {
        // First, try to load from dedicated storage
        const savedInstitutions = localStorage.getItem('worklog_institutions');
        if (savedInstitutions) {
            this.institutions = JSON.parse(savedInstitutions);
        } else {
            // Extract unique institutions from worklogs
            const worklogs = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
            const uniqueInstitutions = [...new Set(
                worklogs
                    .filter(w => w.workType === 'institution')
                    .map(w => w.institutionName)
            )];
            
            this.institutions = uniqueInstitutions.map(name => ({
                id: 'inst_' + name.toLowerCase().replace(/\s+/g, '_'),
                name: name
            }));
            
            // Save for future use
            localStorage.setItem('worklog_institutions', JSON.stringify(this.institutions));
        }
    }

    // Add a new institution
    addInstitution(name) {
        if (!name || name.trim() === '') return null;
        
        name = name.trim();
        
        // Check if already exists
        let existing = this.institutions.find(i => 
            i.name.toLowerCase() === name.toLowerCase()
        );
        
        if (existing) return existing;
        
        // Create new institution
        const newInst = {
            id: 'inst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: name,
            createdAt: new Date().toISOString()
        };
        
        this.institutions.push(newInst);
        localStorage.setItem('worklog_institutions', JSON.stringify(this.institutions));
        
        return newInst;
    }

    // Load worklogs from localStorage
    loadWorklogs() {
        try {
            this.worklogs = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
            console.log(`✅ Loaded ${this.worklogs.length} worklog entries`);
        } catch (error) {
            console.error('Error loading worklogs:', error);
            this.worklogs = [];
        }
    }

    // Save worklogs to localStorage
    saveWorklogs() {
        try {
            localStorage.setItem('worklog_entries', JSON.stringify(this.worklogs));
            console.log(`✅ Saved ${this.worklogs.length} worklog entries`);
            this.updateUI();
            this.updateStats();
            return true;
        } catch (error) {
            console.error('Error saving worklogs:', error);
            return false;
        }
    }

    // Add new worklog entry
    addWorklog(worklogData) {
        try {
            // Calculate total earnings
            const totalEarnings = worklogData.duration * worklogData.rate;
            
            const newWorklog = {
                id: 'worklog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                ...worklogData,
                totalEarnings: totalEarnings,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // If it's an institution, save/update the institution
            if (worklogData.workType === 'institution' && worklogData.institutionName) {
                this.addInstitution(worklogData.institutionName);
            }

            this.worklogs.unshift(newWorklog); // Add to beginning (newest first)
            this.saveWorklogs();
            
            // Update earnings stats
            this.updateEarningsStats();
            
            console.log('✅ Worklog added:', newWorklog);
            return newWorklog;
        } catch (error) {
            console.error('Error adding worklog:', error);
            return null;
        }
    }

    // Update existing worklog
    updateWorklog(worklogId, worklogData) {
        try {
            const index = this.worklogs.findIndex(w => w.id === worklogId);
            if (index === -1) return false;

            const totalEarnings = worklogData.duration * worklogData.rate;

            this.worklogs[index] = {
                ...this.worklogs[index],
                ...worklogData,
                totalEarnings: totalEarnings,
                updatedAt: new Date().toISOString()
            };

            // Update institution if needed
            if (worklogData.workType === 'institution' && worklogData.institutionName) {
                this.addInstitution(worklogData.institutionName);
            }

            this.saveWorklogs();
            this.updateEarningsStats();
            
            console.log('✅ Worklog updated:', worklogId);
            return true;
        } catch (error) {
            console.error('Error updating worklog:', error);
            return false;
        }
    }

    // Delete worklog
    deleteWorklog(worklogId) {
        try {
            if (!confirm('Delete this worklog entry?')) return false;

            this.worklogs = this.worklogs.filter(w => w.id !== worklogId);
            this.saveWorklogs();
            this.updateEarningsStats();
            
            console.log('✅ Worklog deleted:', worklogId);
            return true;
        } catch (error) {
            console.error('Error deleting worklog:', error);
            return false;
        }
    }

    // Get earnings summary
    getEarningsSummary() {
        const summary = {
            total: 0,
            byStudent: {},
            byInstitution: {},
            byMonth: {}
        };
        
        this.worklogs.forEach(log => {
            const earnings = log.totalEarnings || 0;
            summary.total += earnings;
            
            // Group by entity
            if (log.workType === 'student' && log.studentName) {
                summary.byStudent[log.studentName] = (summary.byStudent[log.studentName] || 0) + earnings;
            } else if (log.workType === 'institution' && log.institutionName) {
                summary.byInstitution[log.institutionName] = (summary.byInstitution[log.institutionName] || 0) + earnings;
            }
            
            // Group by month
            const month = log.date.substring(0, 7); // YYYY-MM
            summary.byMonth[month] = (summary.byMonth[month] || 0) + earnings;
        });
        
        return summary;
    }

    // Update earnings stats in UI
    updateEarningsStats() {
        const summary = this.getEarningsSummary();
        
        // You can display this somewhere in your UI
        console.log('💰 Earnings summary:', summary);
        
        // Update any earnings displays if they exist
        const totalEarningsElem = document.getElementById('totalWorkEarnings');
        if (totalEarningsElem) {
            totalEarningsElem.textContent = `$${summary.total.toFixed(2)}`;
        }
    }

    // Get worklogs by type (student/institution)
    getWorklogsByType(type) {
        return this.worklogs.filter(w => w.workType === type);
    }

    // Get worklogs for a specific entity (student or institution)
    getWorklogsByEntity(entityId, type) {
        if (type === 'student') {
            return this.worklogs.filter(w => w.workType === 'student' && w.studentId === entityId);
        } else if (type === 'institution') {
            return this.worklogs.filter(w => w.workType === 'institution' && w.institutionName === entityId);
        }
        return [];
    }

    // Search worklogs
    searchWorklogs(query) {
        query = query.toLowerCase();
        return this.worklogs.filter(w => 
            (w.studentName?.toLowerCase().includes(query)) ||
            (w.institutionName?.toLowerCase().includes(query)) ||
            w.subject?.toLowerCase().includes(query) ||
            w.topic?.toLowerCase().includes(query) ||
            w.description?.toLowerCase().includes(query) ||
            w.outcomes?.toLowerCase().includes(query)
        );
    }

    // Toggle between student and institution sections
    toggleWorkType(type) {
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

    // Setup event listeners
    setupEventListeners() {
        const form = document.getElementById('worklogForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleWorklogSubmit();
            });
        }

        const filterType = document.getElementById('worklogFilterType');
        if (filterType) {
            filterType.addEventListener('change', () => this.updateFilterDropdown());
        }

        const filterEntity = document.getElementById('worklogFilterEntity');
        if (filterEntity) {
            filterEntity.addEventListener('change', () => this.updateUI());
        }

        const searchInput = document.getElementById('worklogSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.updateUI());
        }
    }

    // Update filter dropdown based on selected type
    updateFilterDropdown() {
        const type = document.getElementById('worklogFilterType')?.value;
        const entitySelect = document.getElementById('worklogFilterEntity');
        
        if (!entitySelect) return;
        
        let options = '<option value="">All</option>';
        
        if (type === 'student') {
            this.students.forEach(s => {
                options += `<option value="${s.id}">👤 ${s.name}</option>`;
            });
        } else if (type === 'institution') {
            this.institutions.forEach(i => {
                options += `<option value="${i.name}">🏢 ${i.name}</option>`;
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

    // Handle form submission
    handleWorklogSubmit() {
        // Get work type
        const workType = document.querySelector('input[name="workType"]:checked')?.value;
        
        let worklogData = {
            workType: workType,
            date: document.getElementById('worklogDate').value,
            subject: document.getElementById('worklogSubject').value.trim(),
            topic: document.getElementById('worklogTopic').value.trim(),
            duration: parseFloat(document.getElementById('worklogDuration').value),
            rate: parseFloat(document.getElementById('worklogRate').value),
            description: document.getElementById('worklogDescription').value.trim(),
            outcomes: document.getElementById('worklogOutcomes').value.trim(),
            nextSteps: document.getElementById('worklogNextSteps').value.trim(),
            notes: document.getElementById('worklogNotes').value.trim()
        };

        // Validate based on work type
        if (workType === 'student') {
            const studentId = document.getElementById('worklogStudent').value;
            const student = this.students.find(s => s.id === studentId);
            
            if (!studentId) {
                showNotification('Please select a student', 'error');
                return;
            }
            
            worklogData.studentId = studentId;
            worklogData.studentName = student ? student.name : 'Unknown Student';
            worklogData.entityName = student ? student.name : 'Unknown Student';
            worklogData.entityType = 'student';
            
        } else {
            const institutionName = document.getElementById('worklogInstitution').value.trim();
            const contactPerson = document.getElementById('worklogContactPerson').value.trim();
            
            if (!institutionName) {
                showNotification('Please enter institution name', 'error');
                return;
            }
            
            worklogData.institutionName = institutionName;
            worklogData.contactPerson = contactPerson;
            worklogData.entityName = institutionName;
            worklogData.entityType = 'institution';
        }

        // Validate common fields
        if (!worklogData.subject) {
            showNotification('Subject is required', 'error');
            return;
        }

        if (!worklogData.topic) {
            showNotification('Topic is required', 'error');
            return;
        }

        if (!worklogData.description) {
            showNotification('Description is required', 'error');
            return;
        }

        // Check if we're editing
        if (this.editingId) {
            const result = this.updateWorklog(this.editingId, worklogData);
            if (result) showNotification('Worklog updated!', 'success');
        } else {
            const result = this.addWorklog(worklogData);
            if (result) showNotification('Worklog saved!', 'success');
        }

        this.clearForm();
        this.populateDropdowns();
    }

    // Clear form
    clearForm() {
        const form = document.getElementById('worklogForm');
        if (form) form.reset();
        
        // Reset date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('worklogDate').value = today;
        
        // Reset to student view
        document.querySelector('input[name="workType"][value="student"]').checked = true;
        this.toggleWorkType('student');
        
        // Reset submit button
        document.getElementById('worklogSubmitBtn').textContent = '💾 Save Worklog';
        this.editingId = null;
    }

    // Populate dropdowns
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

   // Update UI with worklog entries - USING NEW CARD STYLES
updateUI() {
    const container = document.getElementById('worklogContainer');
    if (!container) return;

    const filterType = document.getElementById('worklogFilterType')?.value;
    const filterEntity = document.getElementById('worklogFilterEntity')?.value;
    const searchQuery = document.getElementById('worklogSearch')?.value;

    let displayWorklogs = [...this.worklogs];

    // Apply filters
    if (filterType) {
        displayWorklogs = displayWorklogs.filter(w => w.workType === filterType);
    }

    if (filterEntity) {
        if (filterEntity.startsWith('student_')) {
            const studentId = filterEntity.replace('student_', '');
            displayWorklogs = displayWorklogs.filter(w => 
                w.workType === 'student' && w.studentId === studentId
            );
        } else if (filterEntity.startsWith('inst_')) {
            const instName = filterEntity.replace('inst_', '');
            displayWorklogs = displayWorklogs.filter(w => 
                w.workType === 'institution' && w.institutionName === instName
            );
        }
    }

    if (searchQuery) {
        displayWorklogs = this.searchWorklogs(searchQuery);
    }

    if (displayWorklogs.length === 0) {
        container.innerHTML = `
            <div class="worklog-empty">
                <div class="worklog-empty-icon">📝</div>
                <div class="worklog-empty-text">No worklog entries found</div>
                <div class="worklog-empty-subtext">Add your first worklog entry using the form above</div>
            </div>
        `;
        return;
    }

    container.innerHTML = displayWorklogs.map(worklog => {
        const cardClass = worklog.workType === 'student' ? 'student-card' : 'institution-card';
        const entityIcon = worklog.workType === 'student' ? '👤' : '🏢';
        const entityName = worklog.workType === 'student' ? worklog.studentName : worklog.institutionName;
        const entityDetail = worklog.workType === 'institution' && worklog.contactPerson ? 
            `<div class="worklog-entity-detail">Contact: ${worklog.contactPerson}</div>` : '';

        const date = new Date(worklog.date).toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });

        const createdDate = new Date(worklog.createdAt).toLocaleString();

        return `
            <div class="worklog-card ${cardClass}" data-id="${worklog.id}">
                <div class="worklog-header">
                    <div class="worklog-entity">
                        <div class="worklog-entity-icon">${entityIcon}</div>
                        <div>
                            <div class="worklog-entity-name">${entityName}</div>
                            ${entityDetail}
                        </div>
                    </div>
                    <div class="worklog-date-badge">
                        📅 ${date}
                        <span class="worklog-duration-badge">${worklog.duration}h</span>
                    </div>
                </div>

                <div class="worklog-chips">
                    <span class="worklog-chip subject">
                        <span>📚</span> ${worklog.subject}
                    </span>
                    <span class="worklog-chip topic">
                        <span>📌</span> ${worklog.topic}
                    </span>
                </div>

                <div class="worklog-earnings">
                    <span>💰</span> $${(worklog.duration * worklog.rate).toFixed(2)}
                </div>

                <div class="worklog-section description">
                    <div class="worklog-section-title">
                        <span>📖</span> Description
                    </div>
                    <div class="worklog-section-content">${worklog.description.replace(/\n/g, '<br>')}</div>
                </div>

                ${worklog.outcomes ? `
                    <div class="worklog-section outcomes">
                        <div class="worklog-section-title">
                            <span>🎯</span> Outcomes
                        </div>
                        <div class="worklog-section-content">${worklog.outcomes.replace(/\n/g, '<br>')}</div>
                    </div>
                ` : ''}

                ${worklog.nextSteps ? `
                    <div class="worklog-section next-steps">
                        <div class="worklog-section-title">
                            <span>⏭️</span> Next Steps
                        </div>
                        <div class="worklog-section-content">${worklog.nextSteps.replace(/\n/g, '<br>')}</div>
                    </div>
                ` : ''}

                ${worklog.notes ? `
                    <div class="worklog-section notes">
                        <div class="worklog-section-title">
                            <span>📝</span> Notes
                        </div>
                        <div class="worklog-section-content">${worklog.notes}</div>
                    </div>
                ` : ''}

                <div class="worklog-footer">
                    <div class="worklog-timestamp">
                        <span>🕒</span> ${createdDate}
                        ${worklog.updatedAt !== worklog.createdAt ? ' (edited)' : ''}
                    </div>
                    <div class="worklog-actions">
                        <button class="worklog-btn edit" onclick="window.worklogManager.editWorklog('${worklog.id}')">
                            ✏️ Edit
                        </button>
                        <button class="worklog-btn delete" onclick="window.worklogManager.deleteWorklog('${worklog.id}')">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

    // Edit worklog
    editWorklog(worklogId) {
        const worklog = this.worklogs.find(w => w.id === worklogId);
        if (!worklog) return;

        // Set work type
        if (worklog.workType === 'student') {
            document.querySelector('input[name="workType"][value="student"]').checked = true;
            this.toggleWorkType('student');
            document.getElementById('worklogStudent').value = worklog.studentId || '';
        } else {
            document.querySelector('input[name="workType"][value="institution"]').checked = true;
            this.toggleWorkType('institution');
            document.getElementById('worklogInstitution').value = worklog.institutionName || '';
            document.getElementById('worklogContactPerson').value = worklog.contactPerson || '';
        }

        // Fill common fields
        document.getElementById('worklogDate').value = worklog.date;
        document.getElementById('worklogSubject').value = worklog.subject;
        document.getElementById('worklogTopic').value = worklog.topic;
        document.getElementById('worklogDuration').value = worklog.duration;
        document.getElementById('worklogRate').value = worklog.rate;
        document.getElementById('worklogDescription').value = worklog.description;
        document.getElementById('worklogOutcomes').value = worklog.outcomes || '';
        document.getElementById('worklogNextSteps').value = worklog.nextSteps || '';
        document.getElementById('worklogNotes').value = worklog.notes || '';

        // Change submit button
        document.getElementById('worklogSubmitBtn').textContent = '💾 Update Worklog';
        this.editingId = worklogId;

        // Scroll to form
        document.getElementById('worklogForm').scrollIntoView({ behavior: 'smooth' });
    }

    // Update stats
    updateStats() {
        const countElem = document.getElementById('worklogCount');
        if (countElem) countElem.textContent = this.worklogs.length;

        const lastDateElem = document.getElementById('lastWorklogDate');
        if (lastDateElem && this.worklogs.length > 0) {
            const lastDate = new Date(this.worklogs[0].date).toLocaleDateString();
            lastDateElem.textContent = lastDate;
        }

        this.updateEarningsStats();
    }
}

// Initialize WorklogManager
window.worklogManager = new WorklogManager();

// Global helper functions
window.toggleWorkType = function(type) {
    if (window.worklogManager) {
        window.worklogManager.toggleWorkType(type);
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
