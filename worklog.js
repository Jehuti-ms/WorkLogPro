// worklog.js - FIXED VERSION
// All DOM queries are scoped to ONLY the worklog tab

console.log('📝 Loading fixed worklog.js...');

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

// Load worklog entries - ONLY in worklog tab
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
  
  // Update stats
  const countEl = getWorklogElement('#worklogCount');
  if (countEl) countEl.innerText = entries.length;
  
  const lastDateEl = getWorklogElement('#lastWorklogDate');
  if (lastDateEl && entries.length) lastDateEl.innerText = entries[0].date;
}

// Save worklog entry
function saveWorklogEntry() {
  if (!isWorklogActive()) return;
  
  const type = getWorklogElement('input[name="workType"]:checked')?.value || 'student';
  const studentId = getWorklogElement('#worklogStudent')?.value;
  const institution = getWorklogElement('#worklogInstitution')?.value;
  const date = getWorklogElement('#worklogDate')?.value;
  const subject = getWorklogElement('#worklogSubject')?.value;
  const topic = getWorklogElement('#worklogTopic')?.value;
  const hours = parseFloat(getWorklogElement('#worklogDuration')?.value);
  const rate = parseFloat(getWorklogElement('#worklogRate')?.value);
  const description = getWorklogElement('#worklogDescription')?.value;
  const outcomes = getWorklogElement('#worklogOutcomes')?.value;
  const nextSteps = getWorklogElement('#worklogNextSteps')?.value;
  const notes = getWorklogElement('#worklogNotes')?.value;
  
  if (!date || !subject || !hours) {
    alert('Please fill required fields');
    return;
  }
  
  if (type === 'student' && !studentId) {
    alert('Please select a student');
    return;
  }
  
  if (type === 'institution' && !institution) {
    alert('Please enter institution name');
    return;
  }
  
  const entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  
  // Get student name if needed
  let studentName = '';
  if (type === 'student' && studentId) {
    const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
    const student = students.find(s => s.id === studentId);
    studentName = student ? student.name : '';
  }
  
  entries.unshift({
    id: Date.now().toString(),
    type,
    studentId: type === 'student' ? studentId : null,
    studentName,
    institution: type === 'institution' ? institution : null,
    date,
    subject,
    topic,
    hours,
    rate,
    description,
    outcomes,
    nextSteps,
    notes,
    total: hours * rate,
    createdAt: new Date().toISOString()
  });
  
  localStorage.setItem('worklog_entries', JSON.stringify(entries));
  loadWorklogEntries();
  clearWorklogForm();
  alert('Worklog saved!');
  
  // Update global stats
  if (typeof updateStats === 'function') updateStats();
}

// Clear form
function clearWorklogForm() {
  const form = getWorklogElement('#worklogForm');
  if (form) form.reset();
  const dateInput = getWorklogElement('#worklogDate');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

// Toggle work type
function toggleWorkType(type) {
  const studentSection = getWorklogElement('#studentSection');
  const institutionSection = getWorklogElement('#institutionSection');
  
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

// Populate student dropdown
function populateWorklogStudentDropdown() {
  const select = getWorklogElement('#worklogStudent');
  if (!select) return;
  
  const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
  select.innerHTML = '<option value="">Select Student</option>' + 
    students.map(s => `<option value="${s.id}">${s.name} (${s.studentId})</option>`).join('');
}

// Filter and sort worklogs
function filterWorklogs() {
  if (!isWorklogActive()) return;
  
  let entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
  const filterType = getWorklogElement('#worklogFilterType')?.value || '';
  const searchTerm = getWorklogElement('#worklogSearch')?.value?.toLowerCase() || '';
  const sortOrder = getWorklogElement('#worklogSortOrder')?.value || 'newest';
  
  if (filterType) {
    entries = entries.filter(e => e.type === filterType);
  }
  
  if (searchTerm) {
    entries = entries.filter(e => 
      (e.subject || '').toLowerCase().includes(searchTerm) ||
      (e.studentName || '').toLowerCase().includes(searchTerm) ||
      (e.institution || '').toLowerCase().includes(searchTerm)
    );
  }
  
  if (sortOrder === 'newest') {
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else {
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
  
  const container = getWorklogElement('#worklogContainer');
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

// Initialize worklog tab
function initWorklogTab() {
  if (!isWorklogActive()) return;
  
  console.log('Initializing worklog tab...');
  populateWorklogStudentDropdown();
  loadWorklogEntries();
  
  // Set up filter listeners
  const filterType = getWorklogElement('#worklogFilterType');
  const filterEntity = getWorklogElement('#worklogFilterEntity');
  const searchInput = getWorklogElement('#worklogSearch');
  const sortOrder = getWorklogElement('#worklogSortOrder');
  
  if (filterType) filterType.onchange = () => filterWorklogs();
  if (filterEntity) filterEntity.onchange = () => filterWorklogs();
  if (searchInput) searchInput.onkeyup = () => filterWorklogs();
  if (sortOrder) sortOrder.onchange = () => filterWorklogs();
  
  // Set up form submit
  const form = getWorklogElement('#worklogForm');
  if (form) {
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', function(e) {
      e.preventDefault();
      saveWorklogEntry();
    });
  }
}

// Listen for tab changes
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function() {
    setTimeout(() => {
      if (this.getAttribute('data-tab') === 'worklog') {
        initWorklogTab();
      }
    }, 100);
  });
});

// Initialize on page load if worklog is active
if (document.getElementById('worklog')?.classList.contains('active')) {
  initWorklogTab();
}

// Make functions global
window.toggleWorkType = toggleWorkType;
window.deleteWorklogEntry = deleteWorklogEntry;
window.clearWorklogForm = clearWorklogForm;

console.log('✅ Fixed worklog.js loaded');
