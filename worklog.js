// worklog.js - FIXED VERSION
// Only run when worklog tab is active

(function() {
  console.log('📝 Loading worklog.js (fixed version)...');
  
  // Check if we're on the worklog tab before doing anything
  function isWorklogTabActive() {
    const worklogTab = document.getElementById('worklog');
    return worklogTab && worklogTab.classList.contains('active');
  }
  
  // Only initialize worklog functionality if worklog tab is active
  function initWorklogIfActive() {
    if (!isWorklogTabActive()) {
      console.log('Worklog tab not active, skipping initialization');
      return;
    }
    
    console.log('Worklog tab is active, initializing...');
    // Your existing initialization code here
    loadWorklogEntries();
    setupWorklogForm();
  }
  
  // Load worklog entries - ONLY for worklog container
  function loadWorklogEntries() {
    // Make sure we're only targeting the worklog tab
    const worklogTab = document.getElementById('worklog');
    if (!worklogTab || !worklogTab.classList.contains('active')) {
      return;
    }
    
    const container = worklogTab.querySelector('#worklogContainer');
    if (!container) {
      console.error('Worklog container not found in worklog tab');
      return;
    }
    
    const entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
    
    if (entries.length === 0) {
      container.innerHTML = '<p class="empty-message">No worklog entries yet.</p>';
      return;
    }
    
    // Render entries
    container.innerHTML = entries.map(entry => `
      <div class="worklog-card ${entry.type || 'student'}">
        <strong>${entry.type === 'student' ? entry.studentName : entry.institution}</strong><br>
        📅 ${entry.date} | ⏱️ ${entry.hours}h | 💰 $${(entry.hours * entry.rate).toFixed(2)}<br>
        📝 ${entry.description || 'No description'}<br>
        <button class="button small danger" onclick="deleteWorklogEntry('${entry.id}')">Delete</button>
      </div>
    `).join('');
  }
  
  // Setup form - ONLY targeting worklog tab elements
  function setupWorklogForm() {
    const worklogTab = document.getElementById('worklog');
    if (!worklogTab || !worklogTab.classList.contains('active')) {
      return;
    }
    
    const form = worklogTab.querySelector('#worklogForm');
    if (!form) return;
    
    // Remove existing listeners to prevent duplicates
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    newForm.addEventListener('submit', function(e) {
      e.preventDefault();
      saveWorklogEntry();
    });
  }
  
  // Save worklog entry
  function saveWorklogEntry() {
    const worklogTab = document.getElementById('worklog');
    if (!worklogTab || !worklogTab.classList.contains('active')) {
      console.error('Cannot save - worklog tab not active');
      return;
    }
    
    // Get values from worklog tab only
    const type = worklogTab.querySelector('input[name="workType"]:checked')?.value || 'student';
    const studentId = worklogTab.querySelector('#worklogStudent')?.value;
    const institution = worklogTab.querySelector('#worklogInstitution')?.value;
    const date = worklogTab.querySelector('#worklogDate')?.value;
    const subject = worklogTab.querySelector('#worklogSubject')?.value;
    const topic = worklogTab.querySelector('#worklogTopic')?.value;
    const hours = parseFloat(worklogTab.querySelector('#worklogDuration')?.value);
    const rate = parseFloat(worklogTab.querySelector('#worklogRate')?.value);
    const description = worklogTab.querySelector('#worklogDescription')?.value;
    
    if (!date || !subject || !hours) {
      alert('Please fill required fields');
      return;
    }
    
    const entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
    entries.unshift({
      id: Date.now().toString(),
      type,
      studentId: type === 'student' ? studentId : null,
      studentName: type === 'student' ? worklogTab.querySelector('#worklogStudent option:checked')?.text?.split('(')[0].trim() : null,
      institution: type === 'institution' ? institution : null,
      date,
      subject,
      topic,
      hours,
      rate,
      description,
      total: hours * rate,
      createdAt: new Date().toISOString()
    });
    
    localStorage.setItem('worklog_entries', JSON.stringify(entries));
    loadWorklogEntries();
    clearWorklogForm();
    alert('Worklog saved!');
  }
  
  function clearWorklogForm() {
    const worklogTab = document.getElementById('worklog');
    if (!worklogTab) return;
    
    worklogTab.querySelector('#worklogSubject').value = '';
    worklogTab.querySelector('#worklogTopic').value = '';
    worklogTab.querySelector('#worklogDuration').value = '';
    worklogTab.querySelector('#worklogDescription').value = '';
    worklogTab.querySelector('#worklogOutcomes').value = '';
    worklogTab.querySelector('#worklogNextSteps').value = '';
    worklogTab.querySelector('#worklogNotes').value = '';
    worklogTab.querySelector('#worklogDate').value = new Date().toISOString().split('T')[0];
  }
  
  function toggleWorkType(type) {
    const worklogTab = document.getElementById('worklog');
    if (!worklogTab) return;
    
    const studentSection = worklogTab.querySelector('#studentSection');
    const institutionSection = worklogTab.querySelector('#institutionSection');
    
    if (type === 'student') {
      if (studentSection) studentSection.style.display = 'block';
      if (institutionSection) institutionSection.style.display = 'none';
    } else {
      if (studentSection) studentSection.style.display = 'none';
      if (institutionSection) institutionSection.style.display = 'block';
    }
  }
  
  function deleteWorklogEntry(id) {
    if (!confirm('Delete this entry?')) return;
    let entries = JSON.parse(localStorage.getItem('worklog_entries') || '[]');
    entries = entries.filter(e => e.id !== id);
    localStorage.setItem('worklog_entries', JSON.stringify(entries));
    loadWorklogEntries();
  }
  
  // Listen for tab changes
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      setTimeout(() => {
        if (this.getAttribute('data-tab') === 'worklog') {
          initWorklogIfActive();
        }
      }, 50);
    });
  });
  
  // Initialize only if worklog is active on page load
  if (isWorklogTabActive()) {
    initWorklogIfActive();
  }
  
  // Make functions global for onclick handlers
  window.toggleWorkType = toggleWorkType;
  window.deleteWorklogEntry = deleteWorklogEntry;
  window.clearWorklogForm = clearWorklogForm;
  
  console.log('✅ worklog.js loaded (fixed version)');
})();
