// worklog.js - COMPLETE WORKING VERSION WITH DATE FIXES
console.log('📝 Loading working worklog.js...');

// Helper to get elements ONLY from worklog tab
function getWorklogElement(selector) {
  const worklogTab = document.getElementById('worklog');
  if (!worklogTab) return null;
  return worklogTab.querySelector(selector);
}

// Check if worklog tab is active
function isWorklogActive() {
  const worklogTab = document.getElementById('worklog');
  return worklogTab && worklogTab.classList.contains('active');
}

// Date formatter (uses global if available)
function formatWorklogDate(dateString) {
  if (!dateString) return '';
  if (typeof window.formatDisplayDate === 'function') {
    return window.formatDisplayDate(dateString);
  }
  // Fallback
  const parts = dateString.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
}

// Get today's date in YYYY-MM-DD format
function getTodayDateString() {
  if (typeof window.getTodayDate === 'function') {
    return window.getTodayDate();
  }
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Load worklog entries
function loadWorklogEntries() {
  const container = document.getElementById('worklogContainer');
  if (!container) return;
  
  let entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  
  // Sort by date using string comparison (newest first)
  entries.sort((a, b) => {
    return (b.date || '').localeCompare(a.date || '');
  });
  
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-message">No worklog entries yet.</p>';
    return;
  }
  
  container.innerHTML = entries.map(entry => {
    const displayDate = formatWorklogDate(entry.date);
    return `
      <div class="worklog-card ${entry.type || 'student'}">
        <strong>${entry.type === 'student' ? (entry.studentName || 'Unknown') : (entry.institution || 'Unknown')}</strong><br>
        📅 ${displayDate} | ⏱️ ${entry.hours}h (${entry.sessions || 1} sessions) | 💰 $${(entry.hours * entry.rate).toFixed(2)}<br>
        📝 ${entry.description || 'No description'}<br>
        <div style="margin-top: 10px;">
          <button class="button small info" onclick="editWorklogEntry('${entry.id}')" style="margin-right: 5px;">✏️ Edit</button>
          <button class="button small danger" onclick="deleteWorklogEntry('${entry.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
  
  const countEl = document.getElementById('worklogCount');
  if (countEl) countEl.innerText = entries.length;
  
  const lastDateEl = document.getElementById('lastWorklogDate');
  if (lastDateEl && entries.length) lastDateEl.innerText = formatWorklogDate(entries[0].date);
}

// Clear form
function clearWorklogForm() {
  const form = document.getElementById('worklogForm');
  if (form) form.reset();
  const dateInput = document.getElementById('worklogDate');
  if (dateInput) dateInput.value = getTodayDateString();
}

// Cancel worklog edit
function cancelWorklogEdit() {
  window.editingWorklogId = null;
  
  const saveBtn = document.getElementById('worklogSubmitBtn');
  if (saveBtn) {
    saveBtn.textContent = '💾 Save Worklog';
    saveBtn.style.backgroundColor = '';
  }
  
  const cancelBtn = document.getElementById('cancelWorklogEditBtn');
  if (cancelBtn) {
    cancelBtn.remove();
  }
  
  clearWorklogForm();
  console.log('Edit cancelled');
}

// Save worklog entry - SINGLE VERSION with edit support
async function saveWorklogEntry() {
  console.log('💾 saveWorklogEntry called');
  
  const type = document.querySelector('input[name="workType"]:checked')?.value || 'student';
  const studentId = document.getElementById('worklogStudent')?.value;
  const institution = document.getElementById('worklogInstitution')?.value;
  const date = document.getElementById('worklogDate')?.value;
  const subject = document.getElementById('worklogSubject')?.value;
  const hours = parseFloat(document.getElementById('worklogDuration')?.value);
  const sessions = parseFloat(document.getElementById('worklogSessions')?.value) || 1;
  const rate = parseFloat(document.getElementById('worklogRate')?.value) || 25;
  const description = document.getElementById('worklogDescription')?.value;
  const topic = document.getElementById('worklogTopic')?.value;
  const outcomes = document.getElementById('worklogOutcomes')?.value;
  const nextSteps = document.getElementById('worklogNextSteps')?.value;
  const notes = document.getElementById('worklogNotes')?.value;
  
  console.log('Values:', {type, studentId, institution, date, subject, hours, sessions});
  
  if (!date) { alert('Date required'); return; }
  if (!subject) { alert('Subject required'); return; }
  if (!hours || hours <= 0) { alert('Valid hours required'); return; }
  if (type === 'student' && !studentId) { alert('Select a student'); return; }
  if (type === 'institution' && !institution) { alert('Enter institution name'); return; }
  
  let entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  
  let studentName = '';
  if (type === 'student' && studentId) {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const student = students.find(s => s.id === studentId);
    studentName = student ? student.name : '';
  }
  
  const newEntry = {
    id: Date.now().toString(),
    type,
    studentId: studentId || null,
    studentName: studentName,
    institution: institution || null,
    date,  // Stored as YYYY-MM-DD string
    subject,
    topic: topic || '',
    hours,
    sessions: sessions,
    rate,
    description: description || '',
    outcomes: outcomes || '',
    nextSteps: nextSteps || '',
    notes: notes || '',
    total: hours * rate,
    totalEarnings: hours * rate,  // For consistency
    duration: hours,               // For compatibility
    createdAt: new Date().toISOString()
  };
  
  // Check if we're editing an existing entry
  if (window.editingWorklogId) {
    console.log('Updating existing entry:', window.editingWorklogId);
    const index = entries.findIndex(e => e.id === window.editingWorklogId);
    if (index !== -1) {
      newEntry.id = window.editingWorklogId;
      newEntry.createdAt = entries[index].createdAt;
      entries[index] = newEntry;
      showNotification('Worklog updated!', 'success');
    } else {
      console.log('⚠️ Entry not found with ID:', window.editingWorklogId);
      showNotification('Error: Entry not found', 'error');
    }
    window.editingWorklogId = null;
    if (typeof cancelWorklogEdit === 'function') {
      cancelWorklogEdit();
    }
  } else {
    entries.unshift(newEntry);
    showNotification('Worklog saved!', 'success');
  }
  
  // Save to localStorage
  localStorage.setItem('worklog_entries', JSON.stringify(entries));
  console.log('✅ Saved to localStorage! Total entries:', entries.length);
  
  // ===== NEW: Save to cloud for cross-device sync =====
  if (window.CloudDataService && typeof window.CloudDataService.saveWorklogEntries === 'function') {
    try {
      await window.CloudDataService.saveWorklogEntries(entries);
      console.log('✅ Saved to cloud!');
    } catch (error) {
      console.log('⚠️ Cloud save failed (will retry later):', error);
    }
  } else if (window.syncService && typeof window.syncService.sync === 'function') {
    // Fallback to sync service
    try {
      await window.syncService.sync(false, false);
      console.log('✅ Synced via syncService');
    } catch (error) {
      console.log('⚠️ Sync failed:', error);
    }
  }
  // ===== END CLOUD SYNC =====
  
  // Refresh UI
  if (typeof loadWorklogEntries === 'function') {
    loadWorklogEntries();
  }
  if (typeof clearWorklogForm === 'function') {
    clearWorklogForm();
  }
  if (typeof updateProfileStats === 'function') {
    updateProfileStats();
  }
  if (typeof updateGlobalStats === 'function') {
    updateGlobalStats();
  }
  
  // Reset save button if in edit mode
  const saveBtn = document.getElementById('worklogSubmitBtn');
  if (saveBtn) {
    saveBtn.textContent = '💾 Save Worklog';
    saveBtn.style.backgroundColor = '';
  }
  
  // Trigger auto-sync if enabled
  if (localStorage.getItem('autoSyncEnabled') === 'true' && window.syncService) {
    setTimeout(() => window.syncService.sync(false, false), 500);
  }
}

// Make sure it's globally available
window.saveWorklogEntry = saveWorklogEntry;

// Edit worklog entry
function editWorklogEntry(id) {
  console.log('✏️ Editing worklog entry:', id);
  
  const entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  const entry = entries.find(e => e.id === id);
  
  if (!entry) {
    alert('Entry not found');
    return;
  }
  
  if (entry.type === 'student') {
    document.querySelector('input[name="workType"][value="student"]').checked = true;
    toggleWorkType('student');
    const studentSelect = document.getElementById('worklogStudent');
    if (studentSelect) studentSelect.value = entry.studentId;
  } else {
    document.querySelector('input[name="workType"][value="institution"]').checked = true;
    toggleWorkType('institution');
    const institutionInput = document.getElementById('worklogInstitution');
    if (institutionInput) institutionInput.value = entry.institution;
  }
  
  // Date is stored as YYYY-MM-DD, set directly
  document.getElementById('worklogDate').value = entry.date;
  document.getElementById('worklogSubject').value = entry.subject;
  document.getElementById('worklogTopic').value = entry.topic || '';
  document.getElementById('worklogDuration').value = entry.hours;
  document.getElementById('worklogSessions').value = entry.sessions || 1;
  document.getElementById('worklogRate').value = entry.rate;
  document.getElementById('worklogDescription').value = entry.description || '';
  document.getElementById('worklogOutcomes').value = entry.outcomes || '';
  document.getElementById('worklogNextSteps').value = entry.nextSteps || '';
  document.getElementById('worklogNotes').value = entry.notes || '';
  
  window.editingWorklogId = id;
  
  // Try multiple possible button selectors
  const saveBtn = document.getElementById('worklogSubmitBtn') || 
                  document.querySelector('#worklogForm button[type="submit"]') ||
                  document.querySelector('.worklog-submit-btn') ||
                  document.querySelector('#worklogForm .btn-primary');
  
  if (saveBtn) {
    saveBtn.textContent = '✏️ Update Worklog';
    saveBtn.style.backgroundColor = '#f59e0b';
    console.log('✅ Update button ready');
  } else {
    console.log('⚠️ Save button not found - check the button ID');
  }
  
  let cancelBtn = document.getElementById('cancelWorklogEditBtn');
  if (!cancelBtn) {
    cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancelWorklogEditBtn';
    cancelBtn.className = 'button secondary';
    cancelBtn.textContent = '❌ Cancel Edit';
    cancelBtn.style.marginLeft = '10px';
    cancelBtn.onclick = cancelWorklogEdit;
    const formActions = document.querySelector('#worklogForm .form-actions');
    if (formActions) formActions.appendChild(cancelBtn);
  } else {
    cancelBtn.style.display = 'inline-block';
  }
  
  // Small delay to let everything render, then scroll
  setTimeout(() => {
    const form = document.getElementById('worklogForm');
    if (form) {
      form.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
      document.getElementById('worklogDate').focus();
    }
  }, 200);
  
  alert('Edit mode activated. Make changes and click Update.');
}

// Fix save button
function fixSaveButtonPermanently() {
  const saveBtn = document.getElementById('worklogSubmitBtn');
  if (!saveBtn) {
    setTimeout(fixSaveButtonPermanently, 500);
    return;
  }
  
  const newBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newBtn, saveBtn);
  
  newBtn.onclick = function(e) {
    e.preventDefault();
    console.log('🔴 Save button clicked!');
    saveWorklogEntry();
  };
  
  console.log('✅ Save button fixed!');
}

// Filter worklogs
function filterWorklogs() {
  let entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  const filterType = document.getElementById('worklogFilterType')?.value || '';
  const searchTerm = document.getElementById('worklogSearch')?.value?.toLowerCase() || '';
  const sortOrder = document.getElementById('worklogSortOrder')?.value || 'newest';
  
  if (filterType) entries = entries.filter(e => e.type === filterType);
  if (searchTerm) entries = entries.filter(e => 
    (e.subject || '').toLowerCase().includes(searchTerm) ||
    (e.studentName || '').toLowerCase().includes(searchTerm) ||
    (e.institution || '').toLowerCase().includes(searchTerm)
  );
  
  // Fix sorting to use string comparison (no timezone issues)
  if (sortOrder === 'newest') {
    entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } else {
    entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
  
  const container = document.getElementById('worklogContainer');
  if (!container) return;
  
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-message">No worklog entries found.</p>';
    return;
  }
  
  container.innerHTML = entries.map(entry => {
    const displayDate = formatWorklogDate(entry.date);
    return `
      <div class="worklog-card ${entry.type || 'student'}">
        <strong>${entry.type === 'student' ? (entry.studentName || 'Unknown') : (entry.institution || 'Unknown')}</strong><br>
        📅 ${displayDate} | ⏱️ ${entry.hours}h (${entry.sessions || 1} sessions) | 💰 $${(entry.hours * entry.rate).toFixed(2)}<br>
        📝 ${entry.description || 'No description'}<br>
        <div style="margin-top: 10px;">
          <button class="button small info" onclick="editWorklogEntry('${entry.id}')" style="margin-right: 5px;">✏️ Edit</button>
          <button class="button small danger" onclick="deleteWorklogEntry('${entry.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// Populate student dropdown
function populateWorklogStudentDropdown() {
  const select = document.getElementById('worklogStudent');
  if (!select) return;
  
  let students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  // Sort students by ID
  const sortedStudents = [...students].sort((a, b) => {
    const numA = parseInt((a.studentId || '0').toString().replace(/\D/g, '')) || 0;
    const numB = parseInt((b.studentId || '0').toString().replace(/\D/g, '')) || 0;
    return numA - numB;
  });
  select.innerHTML = '<option value="">Select Student</option>' + 
    sortedStudents.map(s => `<option value="${s.id}">${s.name} (${s.studentId})</option>`).join('');
}

// Toggle work type
function toggleWorkType(type) {
  const studentSection = document.getElementById('studentSection');
  const institutionSection = document.getElementById('institutionSection');
  
  if (type === 'student') {
    if (studentSection) studentSection.style.display = 'block';
    if (institutionSection) institutionSection.style.display = 'none';
  } else {
    if (studentSection) studentSection.style.display = 'none';
    if (institutionSection) institutionSection.style.display = 'block';
  }
}

// Delete entry
function deleteWorklogEntry(id) {
  if (!confirm('Delete this entry?')) return;
  let entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  entries = entries.filter(e => e.id !== id);
  localStorage.setItem('worklog_entries', JSON.stringify(entries));
  loadWorklogEntries();
}

// Initialize worklog tab
function initWorklogTab() {
  if (!isWorklogActive()) return;
  
  const form = document.getElementById('worklogForm');
  if (form) {
    form.onsubmit = function(e) {
      e.preventDefault();
      return false;
    };
  }
  
  console.log('Initializing worklog tab...');
  
  populateWorklogStudentDropdown();
  loadWorklogEntries();
  fixSaveButtonPermanently();
  
  const filterType = document.getElementById('worklogFilterType');
  const searchInput = document.getElementById('worklogSearch');
  const sortOrder = document.getElementById('worklogSortOrder');
  
  if (filterType) filterType.onchange = () => filterWorklogs();
  if (searchInput) searchInput.onkeyup = () => filterWorklogs();
  if (sortOrder) sortOrder.onchange = () => filterWorklogs();
}

// Make functions global
window.toggleWorkType = toggleWorkType;
window.deleteWorklogEntry = deleteWorklogEntry;
window.clearWorklogForm = clearWorklogForm;
window.saveWorklogEntry = saveWorklogEntry;
window.editWorklogEntry = editWorklogEntry;
window.cancelWorklogEdit = cancelWorklogEdit;

// Initialize on page load if worklog is active
if (document.getElementById('worklog')?.classList.contains('active')) {
  setTimeout(initWorklogTab, 500);
}

// Handle tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function() {
    if (this.getAttribute('data-tab') === 'worklog') {
      setTimeout(initWorklogTab, 200);
    }
  });
});

console.log('✅ Fixed worklog.js loaded');
