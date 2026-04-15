// worklog.js - COMPLETE WORKING VERSION
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

// Load worklog entries
function loadWorklogEntries() {
  const container = document.getElementById('worklogContainer');
  if (!container) return;
  
  const entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-message">No worklog entries yet.</p>';
    return;
  }
  
    container.innerHTML = entries.map(entry => `
    <div class="worklog-card ${entry.type || 'student'}">
      <strong>${entry.type === 'student' ? (entry.studentName || 'Unknown') : (entry.institution || 'Unknown')}</strong><br>
      📅 ${entry.date} | ⏱️ ${entry.hours}h | 💰 $${(entry.hours * entry.rate).toFixed(2)}<br>
      📝 ${entry.description || 'No description'}<br>
      <div style="margin-top: 10px;">
        <button class="button small info" onclick="editWorklogEntry('${entry.id}')" style="margin-right: 5px;">✏️ Edit</button>
        <button class="button small danger" onclick="deleteWorklogEntry('${entry.id}')">Delete</button>
      </div>
    </div>
  `).join('');
  
  const countEl = document.getElementById('worklogCount');
  if (countEl) countEl.innerText = entries.length;
  
  const lastDateEl = document.getElementById('lastWorklogDate');
  if (lastDateEl && entries.length) lastDateEl.innerText = entries[0].date;
}

// Save worklog entry
function saveWorklogEntry() {
  console.log('💾 saveWorklogEntry called');
  
  const type = document.querySelector('input[name="workType"]:checked')?.value || 'student';
  const studentId = document.getElementById('worklogStudent')?.value;
  const institution = document.getElementById('worklogInstitution')?.value;
  const date = document.getElementById('worklogDate')?.value;
  const subject = document.getElementById('worklogSubject')?.value;
  const hours = parseFloat(document.getElementById('worklogDuration')?.value);
  const rate = parseFloat(document.getElementById('worklogRate')?.value) || 25;
  const description = document.getElementById('worklogDescription')?.value;
  
  console.log('Values:', {type, studentId, institution, date, subject, hours});
  
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
  
  entries.unshift({
    id: Date.now().toString(),
    type,
    studentId: studentId || null,
    studentName: studentName,
    institution: institution || null,
    date,
    subject,
    hours,
    rate,
    description: description || '',
    total: hours * rate,
    createdAt: new Date().toISOString()
  });
  
  localStorage.setItem('worklog_entries', JSON.stringify(entries));
  console.log('✅ Saved! Total entries:', entries.length);
  
  loadWorklogEntries();
  clearWorklogForm();
  alert('Worklog saved!');
}

// Edit worklog entry
function editWorklogEntry(id) {
  console.log('✏️ Editing worklog entry:', id);
  
  // Get the entry from localStorage
  const entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  const entry = entries.find(e => e.id === id);
  
  if (!entry) {
    alert('Entry not found');
    return;
  }
  
  console.log('Entry to edit:', entry);
  
  // Fill the form with entry data
  if (entry.type === 'student') {
    // Select student radio
    document.querySelector('input[name="workType"][value="student"]').checked = true;
    toggleWorkType('student');
    
    // Set student dropdown
    const studentSelect = document.getElementById('worklogStudent');
    if (studentSelect) {
      studentSelect.value = entry.studentId;
    }
  } else {
    // Select institution radio
    document.querySelector('input[name="workType"][value="institution"]').checked = true;
    toggleWorkType('institution');
    
    // Set institution field
    const institutionInput = document.getElementById('worklogInstitution');
    if (institutionInput) institutionInput.value = entry.institution;
  }
  
  // Fill common fields
  const dateInput = document.getElementById('worklogDate');
  if (dateInput) dateInput.value = entry.date;
  
  const subjectInput = document.getElementById('worklogSubject');
  if (subjectInput) subjectInput.value = entry.subject;
  
  const topicInput = document.getElementById('worklogTopic');
  if (topicInput) topicInput.value = entry.topic || '';
  
  const durationInput = document.getElementById('worklogDuration');
  if (durationInput) durationInput.value = entry.hours;
  
  const rateInput = document.getElementById('worklogRate');
  if (rateInput) rateInput.value = entry.rate;
  
  const descInput = document.getElementById('worklogDescription');
  if (descInput) descInput.value = entry.description || '';
  
  const outcomesInput = document.getElementById('worklogOutcomes');
  if (outcomesInput) outcomesInput.value = entry.outcomes || '';
  
  const nextStepsInput = document.getElementById('worklogNextSteps');
  if (nextStepsInput) nextStepsInput.value = entry.nextSteps || '';
  
  const notesInput = document.getElementById('worklogNotes');
  if (notesInput) notesInput.value = entry.notes || '';
  
  // Store the ID being edited
  window.editingWorklogId = id;
  
  // Change save button text
  const saveBtn = document.getElementById('worklogSubmitBtn');
  if (saveBtn) {
    saveBtn.textContent = '✏️ Update Worklog';
    saveBtn.style.backgroundColor = '#f59e0b';
  }
  
  // Add cancel edit button if not exists
  let cancelBtn = document.getElementById('cancelWorklogEditBtn');
  if (!cancelBtn) {
    cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancelWorklogEditBtn';
    cancelBtn.className = 'button secondary';
    cancelBtn.textContent = '❌ Cancel Edit';
    cancelBtn.style.marginLeft = '10px';
    cancelBtn.onclick = cancelWorklogEdit;
    
    const formActions = document.querySelector('#worklogForm .form-actions');
    if (formActions) {
      formActions.appendChild(cancelBtn);
    }
  } else {
    cancelBtn.style.display = 'inline-block';
  }
  
  // Scroll to form
  document.getElementById('worklogForm').scrollIntoView({ behavior: 'smooth' });
  
  alert('Edit mode activated. Make changes and click Update.');
}

// Cancel worklog edit
function cancelWorklogEdit() {
  window.editingWorklogId = null;
  
  // Reset save button
  const saveBtn = document.getElementById('worklogSubmitBtn');
  if (saveBtn) {
    saveBtn.textContent = '💾 Save Worklog';
    saveBtn.style.backgroundColor = '';
  }
  
  // Hide cancel button
  const cancelBtn = document.getElementById('cancelWorklogEditBtn');
  if (cancelBtn) {
    cancelBtn.style.display = 'none';
  }
  
  // Clear form
  clearWorklogForm();
  
  console.log('Edit cancelled');
}

// Update saveWorklogEntry to handle edit mode
// Replace your existing saveWorklogEntry with this:
function saveWorklogEntry() {
  console.log('💾 saveWorklogEntry called');
  
  const type = document.querySelector('input[name="workType"]:checked')?.value || 'student';
  const studentId = document.getElementById('worklogStudent')?.value;
  const institution = document.getElementById('worklogInstitution')?.value;
  const date = document.getElementById('worklogDate')?.value;
  const subject = document.getElementById('worklogSubject')?.value;
  const hours = parseFloat(document.getElementById('worklogDuration')?.value);
  const rate = parseFloat(document.getElementById('worklogRate')?.value) || 25;
  const description = document.getElementById('worklogDescription')?.value;
  const topic = document.getElementById('worklogTopic')?.value;
  const outcomes = document.getElementById('worklogOutcomes')?.value;
  const nextSteps = document.getElementById('worklogNextSteps')?.value;
  const notes = document.getElementById('worklogNotes')?.value;
  
  // Validate
  if (!date) { alert('Date required'); return; }
  if (!subject) { alert('Subject required'); return; }
  if (!hours || hours <= 0) { alert('Valid hours required'); return; }
  if (type === 'student' && !studentId) { alert('Select a student'); return; }
  if (type === 'institution' && !institution) { alert('Enter institution name'); return; }
  
  let entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  
  // Get student name if needed
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
    date,
    subject,
    topic: topic || '',
    hours,
    rate,
    description: description || '',
    outcomes: outcomes || '',
    nextSteps: nextSteps || '',
    notes: notes || '',
    total: hours * rate,
    createdAt: new Date().toISOString()
  };
  
  // Check if we're editing an existing entry
  if (window.editingWorklogId) {
    console.log('Updating existing entry:', window.editingWorklogId);
    const index = entries.findIndex(e => e.id === window.editingWorklogId);
    if (index !== -1) {
      newEntry.id = window.editingWorklogId; // Keep original ID
      newEntry.createdAt = entries[index].createdAt; // Keep original creation date
      entries[index] = newEntry;
      alert('Worklog updated!');
    }
    // Clear edit mode
    window.editingWorklogId = null;
    cancelWorklogEdit();
  } else {
    // New entry
    entries.unshift(newEntry);
    alert('Worklog saved!');
  }
  
  localStorage.setItem('worklog_entries', JSON.stringify(entries));
  console.log('✅ Saved! Total entries:', entries.length);
  
  loadWorklogEntries();
  clearWorklogForm();
  
  // Reset save button
  const saveBtn = document.getElementById('worklogSubmitBtn');
  if (saveBtn) {
    saveBtn.textContent = '💾 Save Worklog';
    saveBtn.style.backgroundColor = '';
  }
}

// Clear form
function clearWorklogForm() {
  const form = document.getElementById('worklogForm');
  if (form) form.reset();
  const dateInput = document.getElementById('worklogDate');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

// Fix save button
function fixSaveButtonPermanently() {
  const saveBtn = document.getElementById('worklogSubmitBtn');
  if (!saveBtn) {
    console.log('Save button not found yet, will retry...');
    setTimeout(fixSaveButtonPermanently, 500);
    return;
  }
  
  console.log('🔧 Fixing save button...');
  
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
  
  if (sortOrder === 'newest') entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  else entries.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const container = document.getElementById('worklogContainer');
  if (!container) return;
  
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-message">No worklog entries found.</p>';
    return;
  }
  
  container.innerHTML = entries.map(entry => `
    <div class="worklog-card ${entry.type || 'student'}">
      <strong>${entry.type === 'student' ? (entry.studentName || 'Unknown') : (entry.institution || 'Unknown')}</strong><br>
      📅 ${entry.date} | ⏱️ ${entry.hours}h | 💰 $${(entry.hours * entry.rate).toFixed(2)}<br>
      📝 ${entry.description || 'No description'}<br>
      <button class="button small danger" onclick="deleteWorklogEntry('${entry.id}')">Delete</button>
    </div>
  `).join('');
}

// Populate student dropdown
function populateWorklogStudentDropdown() {
  const select = document.getElementById('worklogStudent');
  if (!select) return;
  
  const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  select.innerHTML = '<option value="">Select Student</option>' + 
    students.map(s => `<option value="${s.id}">${s.name} (${s.studentId})</option>`).join('');
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
