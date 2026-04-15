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
  if (!isWorklogActive()) return;
  
  const container = getWorklogElement('#worklogContainer');
  if (!container) return;
  
  const entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-message">No worklog entries yet.</p>';
    return;
  }
  
  container.innerHTML = entries.map(entry => `
    <div class="worklog-card ${entry.type || 'student'}">
      <strong>${entry.type === 'student' ? entry.studentName : entry.institution}</strong><br>
      📅 ${entry.date} | ⏱️ ${entry.hours}h | 💰 $${(entry.hours * entry.rate).toFixed(2)}<br>
      📝 ${entry.description || 'No description'}<br>
      <button class="button small danger" onclick="deleteWorklogEntry('${entry.id}')">Delete</button>
    </div>
  `).join('');
  
  const countEl = getWorklogElement('#worklogCount');
  if (countEl) countEl.innerText = entries.length;
  
  const lastDateEl = getWorklogElement('#lastWorklogDate');
  if (lastDateEl && entries.length) lastDateEl.innerText = entries[0].date;
}

// Save worklog entry - THE WORKING VERSION
function saveWorklogEntry() {
  console.log('💾 saveWorklogEntry called');
  
  // Get values directly from DOM (not using getWorklogElement for reliability)
  const type = document.querySelector('input[name="workType"]:checked')?.value || 'student';
  const studentId = document.getElementById('worklogStudent')?.value;
  const institution = document.getElementById('worklogInstitution')?.value;
  const date = document.getElementById('worklogDate')?.value;
  const subject = document.getElementById('worklogSubject')?.value;
  const topic = document.getElementById('worklogTopic')?.value;
  const hours = parseFloat(document.getElementById('worklogDuration')?.value);
  const rate = parseFloat(document.getElementById('worklogRate')?.value) || 25;
  const description = document.getElementById('worklogDescription')?.value;
  const outcomes = document.getElementById('worklogOutcomes')?.value;
  const nextSteps = document.getElementById('worklogNextSteps')?.value;
  const notes = document.getElementById('worklogNotes')?.value;
  
  console.log('Values:', {type, studentId, institution, date, subject, hours, rate});
  
  // Validate
  if (!date) { alert('Please select a date'); return; }
  if (!subject) { alert('Please enter a subject'); return; }
  if (!hours || hours <= 0) { alert('Please enter valid hours'); return; }
  
  if (type === 'student' && !studentId) {
    alert('Please select a student');
    return;
  }
  
  if (type === 'institution' && !institution) {
    alert('Please enter institution name');
    return;
  }
  
  // Get existing entries
  let entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  console.log('Existing entries:', entries.length);
  
  // Get student name if needed
  let studentName = '';
  if (type === 'student' && studentId) {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const student = students.find(s => s.id === studentId);
    studentName = student ? student.name : '';
  }
  
  // Create new entry
  const newEntry = {
    id: Date.now().toString(),
    type,
    studentId: type === 'student' ? studentId : null,
    studentName,
    institution: type === 'institution' ? institution : null,
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
  
  console.log('New entry:', newEntry);
  
  // Save
  entries.unshift(newEntry);
  localStorage.setItem('worklog_entries', JSON.stringify(entries));
  console.log('✅ Saved! Total entries:', entries.length);
  
  // Refresh display
  loadWorklogEntries();
  
  // Clear form
  clearWorklogForm();
  
  alert('Worklog saved!');
  
  // Update stats
  if (typeof updateStats === 'function') updateStats();
  if (typeof refreshAllStats === 'function') refreshAllStats();
}

// Clear form
function clearWorklogForm() {
  const form = document.getElementById('worklogForm');
  if (form) form.reset();
  const dateInput = document.getElementById('worklogDate');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

// Setup the save button - THE KEY FIX
function setupSaveButton() {
  const saveBtn = document.getElementById('worklogSubmitBtn');
  if (!saveBtn) {
    console.log('Save button not found yet');
    return false;
  }
  
  console.log('Found save button, attaching DIRECT click handler');
  
  // Remove any existing handlers
  const newBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newBtn, saveBtn);
  
  // Attach the working handler directly
  newBtn.onclick = function(e) {
    e.preventDefault();
    console.log('🔴 Save button clicked!');
    saveWorklogEntry();
  };
  
  return true;
}

// Initialize worklog tab
function initWorklogTab() {
  if (!isWorklogActive()) return;
  
  console.log('Initializing worklog tab...');
  
  populateWorklogStudentDropdown();
  loadWorklogEntries();
  fixSaveButtonPermanently();
  
  // Setup filter listeners
  const filterType = document.getElementById('worklogFilterType');
  const searchInput = document.getElementById('worklogSearch');
  const sortOrder = document.getElementById('worklogSortOrder');
  
  if (filterType) filterType.onchange = () => filterWorklogs();
  if (searchInput) searchInput.onkeyup = () => filterWorklogs();
  if (sortOrder) sortOrder.onchange = () => filterWorklogs();
  
  // Setup save button - retry if not found
  if (!setupSaveButton()) {
    setTimeout(setupSaveButton, 500);
    setTimeout(setupSaveButton, 1000);
  }
}

// Filter worklogs
function filterWorklogs() {
  if (!isWorklogActive()) return;
  
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
      <strong>${entry.type === 'student' ? entry.studentName : entry.institution}</strong><br>
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
  if (typeof updateStats === 'function') updateStats();
}

// ============= Make functions global ==============
window.toggleWorkType = toggleWorkType;
window.deleteWorklogEntry = deleteWorklogEntry;
window.clearWorklogForm = clearWorklogForm;

// PERMANENT FIX FOR SAVE BUTTON
function fixSaveButtonPermanently() {
  const saveBtn = document.getElementById('worklogSubmitBtn');
  if (!saveBtn) {
    console.log('Save button not found yet, will retry...');
    setTimeout(fixSaveButtonPermanently, 500);
    return;
  }
  
  console.log('🔧 Permanently fixing save button...');
  
  const newBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newBtn, saveBtn);
  
  newBtn.onclick = function(e) {
    e.preventDefault();
    
    const type = document.querySelector('input[name="workType"]:checked')?.value || 'student';
    const studentId = document.getElementById('worklogStudent')?.value;
    const institution = document.getElementById('worklogInstitution')?.value;
    const date = document.getElementById('worklogDate')?.value;
    const subject = document.getElementById('worklogSubject')?.value;
    const hours = parseFloat(document.getElementById('worklogDuration')?.value);
    const rate = parseFloat(document.getElementById('worklogRate')?.value) || 25;
    const description = document.getElementById('worklogDescription')?.value;
    
    if (!date) { alert('Date required'); return; }
    if (!subject) { alert('Subject required'); return; }
    if (!hours || hours <= 0) { alert('Valid hours required'); return; }
    if (type === 'student' && !studentId) { alert('Select a student'); return; }
    if (type === 'institution' && !institution) { alert('Enter institution name'); return; }
    
    let entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
    entries.unshift({
      id: Date.now().toString(),
      type,
      studentId: studentId || null,
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
    if (typeof loadWorklogEntries === 'function') loadWorklogEntries();
    
    document.getElementById('worklogForm')?.reset();
    const dateInput = document.getElementById('worklogDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    alert('Worklog saved!');
  };
  
  console.log('✅ Save button permanently fixed!');
}

// Initialize on page load if worklog is active
if (document.getElementById('worklog')?.classList.contains('active')) {
  setTimeout(fixSaveButtonPermanently, 500);
}

// Also fix when tab becomes active
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function() {
    setTimeout(() => {
      if (this.getAttribute('data-tab') === 'worklog') {
        fixSaveButtonPermanently();
      }
    }, 200);
  });
});

console.log('✅ Fixed worklog.js loaded');
