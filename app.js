// ===========================
// GLOBAL STATE & UTILITIES
// ===========================
const DEBUG_MODE = true;

// Safe number conversion
function safeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

// Money formatting
function fmtMoney(val) {
  const n = safeNumber(val);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Student display helper
function formatStudentDisplay(student) {
  if (!student) return 'Unknown';
  const name = student.name || 'Unnamed';
  const id = student.id || student._firebaseId || 'ID';
  return `${name} (${id})`;
}

// ===========================
// DATE HELPERS (UTC-safe)
// ===========================
function fmtDateISO(yyyyMmDd) {
  if (!yyyyMmDd) return new Date().toISOString();
  try {
    const [year, month, day] = yyyyMmDd.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function formatDateForDisplay(date, useUTC = false) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: useUTC ? 'UTC' : undefined
  });
}

function formatDateShort(date, useUTC = false) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: useUTC ? 'UTC' : undefined
  });
}

function getStartOfWeek(date, mondayStart = true) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = mondayStart ? d.getDate() - day + (day === 0 ? -6 : 1) : d.getDate() - day;
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfWeek(date, mondayStart = true) {
  const start = getStartOfWeek(date, mondayStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getStartOfMonth(date) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfMonth(date) {
  const d = new Date(date);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getWeekNumber(date) {
  const d = new Date(date);
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDaysOfYear = Math.floor((d - firstDayOfYear) / 86400000);
  // Monday start
  return Math.ceil((pastDaysOfYear + ((firstDayOfYear.getDay() + 6) % 7) + 1) / 7);
}

function isDateInRange(entryDate, startDate, endDate) {
  const ed = new Date(entryDate);
  return ed >= new Date(startDate) && ed <= new Date(endDate);
}

// Temporary stubs to prevent ReferenceErrors
function updateProfileButton() {
  console.warn('updateProfileButton is not yet implemented');
}

/*function injectThemeStyles() {
  console.warn('injectThemeStyles is not yet implemented');
}*/

function setupProfileModal() {
  console.warn('setupProfileModal is not yet implemented');
}

function injectThemeStyles() {
  console.warn('injectThemeStyles is not yet implemented');
}

function initializeTheme() {
  console.warn('initializeTheme is not yet implemented');
}

// ===========================
// LOADING OVERLAY & STYLES
// ===========================
function injectLoadingStyles() {
  if (!document.querySelector('#loading-styles')) {
    const style = document.createElement('style');
    style.id = 'loading-styles';
    style.textContent = `
      body.loading { cursor: wait !important; }
      body.loading * { pointer-events: none !important; }
      .loading-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; align-items: center;
        justify-content: center; z-index: 9999; color: white; font-size: 1.2em;
      }
      .loading-spinner {
        border: 4px solid #f3f3f3; border-top: 4px solid var(--primary);
        border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;
        margin-bottom: 20px;
      }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .report-table { display: table; width: 100%; border-collapse: collapse; }
      .report-row { display: table-row; }
      .report-row.header { font-weight: 600; background: var(--surface-2, #f6f6f6); }
      .report-cell { display: table-cell; padding: 8px 10px; border-bottom: 1px solid var(--border, #ddd); }
      .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dropdown-refreshed { border-color: #10b981 !important; }
      .empty-state { padding: 16px; border: 1px dashed var(--border); border-radius: 8px; color: var(--muted); }
    `;
    document.head.appendChild(style);
  }
}

function showLoadingOverlay(message = 'Loading...') {
  let overlay = document.querySelector('.loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.setAttribute('role', 'alert');
    overlay.setAttribute('aria-busy', 'true');
    overlay.innerHTML = `<div class="loading-spinner"></div><div>${message}</div>`;
    document.body.appendChild(overlay);
  }
}

function hideLoadingOverlay() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) overlay.remove();
}

// ===========================
// TAB NAVIGATION SYSTEM
// ===========================
function injectTabCSS() {
  if (!document.querySelector('#tab-css-fixed')) {
    const style = document.createElement('style');
    style.id = 'tab-css-fixed';
    style.textContent = `
      .tabcontent { display: none !important; visibility: hidden !important; opacity: 0 !important; }
      .tabcontent.active { display: block !important; visibility: visible !important; opacity: 1 !important; }
      .tab.active { background: var(--primary) !important; color: white !important; }
    `;
    document.head.appendChild(style);
  }
}

function getInitialTab() {
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) return hash;
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) return activeTab.getAttribute('data-tab');
  return 'students';
}

function switchTab(tabName) {
  if (!tabName) return;
  window.location.hash = tabName;

  document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll(`.tab[data-tab="${tabName}"]`).forEach(btn => {
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
  });

  document.querySelectorAll('.tabcontent').forEach(content => {
    content.classList.remove('active');
    content.setAttribute('aria-hidden', 'true');
  });

  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.classList.add('active');
    targetTab.setAttribute('aria-hidden', 'false');
    if (tabName === 'reports') setTimeout(loadReportData, 300);
  }

  if (DEBUG_MODE) debugTabState();
}

function setupTabNavigation() {
  injectTabCSS();
  const tabButtons = document.querySelectorAll('.tab[data-tab]');
  tabButtons.forEach(button => {
    const tabName = button.getAttribute('data-tab');
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchTab(tabName);
    });
  });
  const initialTab = getInitialTab();
  switchTab(initialTab);
}

function debugTabState() {
  const tabs = ['students', 'hours', 'marks', 'attendance', 'payments', 'reports'];
  tabs.forEach(tabId => {
    const el = document.getElementById(tabId);
    if (el) {
      const cs = window.getComputedStyle(el);
      console.log(`${tabId}:`, { active: el.classList.contains('active'), display: cs.display, visibility: cs.visibility });
    }
  });
}

// ===========================
// DROPDOWN MANAGER (IDs as values)
// ===========================
const StudentDropdownManager = {
  initialized: false,
  dropdowns: [],

  init() {
    if (this.initialized) return;
    this.setupDropdownListeners();
    this.initialized = true;
  },

  setupDropdownListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('.tab[data-tab]')) {
        const tabName = e.target.getAttribute('data-tab');
        setTimeout(() => this.refreshAllDropdowns(), 300);
      }
    });
  },

  async refreshAllDropdowns() {
    await populateStudentDropdowns();
    this.enhanceDropdownBehavior();
  },

  enhanceDropdownBehavior() {
    const dropdownSelectors = ['#student', '#marksStudent', '#paymentStudent', 'select[name="student"]', 'select[name="marksStudent"]', 'select[name="paymentStudent"]'];
    this.dropdowns = [];
    dropdownSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el && !this.dropdowns.includes(el)) this.dropdowns.push(el);
      });
    });
  },

  async forceRefresh() {
    const students = await EnhancedCache.loadCollection('students'); // no force param needed here; loadAllData handles cache freshness
    const dropdownSelectors = ['#student', '#marksStudent', '#paymentStudent', 'select[name="student"]', 'select[name="marksStudent"]', 'select[name="paymentStudent"]'];
    const dropdowns = [];
    dropdownSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => { if (el) dropdowns.push(el); });
    });
    dropdowns.forEach(dropdown => populateSingleDropdown(dropdown, students));
  },

  populateDropdown(dropdown, students) {
    populateSingleDropdown(dropdown, students);
  }
};

async function populateStudentDropdowns() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const students = await EnhancedCache.loadCollection('students');
    const dropdownSelectors = ['#student', '#marksStudent', '#paymentStudent', 'select[name="student"]', 'select[name="marksStudent"]', 'select[name="paymentStudent"]'];
    const dropdowns = [];
    dropdownSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => { if (el && !dropdowns.includes(el)) dropdowns.push(el); });
    });

    dropdowns.forEach(dropdown => populateSingleDropdown(dropdown, students));
    await populateAttendanceStudents(); // keep attendance in sync
  } catch (error) {
    showDropdownError();
  }
}

function populateSingleDropdown(dropdown, students) {
  if (!dropdown) return;

  const currentValue = dropdown.value;
  const currentIndex = dropdown.selectedIndex;
  dropdown.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = students.length > 0 ? 'Select a student...' : 'No students available';
  defaultOption.disabled = true;
  defaultOption.selected = true;
  dropdown.appendChild(defaultOption);

  students.forEach(student => {
    const option = document.createElement('option');
    option.value = student.id; // use ID for value
    option.textContent = formatStudentDisplay(student); // show name + id
    option.setAttribute('data-student-id', student.id);
    dropdown.appendChild(option);
  });

  if (currentValue && dropdown.querySelector(`option[value="${currentValue}"]`)) {
    dropdown.value = currentValue;
  } else if (currentIndex > 0 && dropdown.options.length > currentIndex) {
    dropdown.selectedIndex = currentIndex;
  }

  dropdown.classList.add('dropdown-refreshed');
  setTimeout(() => dropdown.classList.remove('dropdown-refreshed'), 1000);
}

function showDropdownError() {
  const dropdowns = document.querySelectorAll('select[name="student"], select[name="marksStudent"], select[name="paymentStudent"]');
  dropdowns.forEach(dropdown => {
    if (dropdown) {
      dropdown.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Error loading students - Click to refresh';
      option.disabled = true;
      option.selected = true;
      dropdown.appendChild(option);
      const handler = async () => { await populateStudentDropdowns(); dropdown.removeEventListener('click', handler); };
      dropdown.addEventListener('click', handler);
    }
  });
}

async function populateHoursStudentDropdown() {
  const dropdown = document.getElementById('hoursStudent') || document.querySelector('#student');
  if (!dropdown) return false;

  try {
    const students = await EnhancedCache.loadCollection('students');
    populateSingleDropdown(dropdown, students);
    return true;
  } catch (error) {
    return false;
  }
}

async function populateAttendanceStudents() {
  const attendanceContainer = document.getElementById('attendanceStudents');
  if (!attendanceContainer) return;

  try {
    const students = await EnhancedCache.loadCollection('students');
    attendanceContainer.innerHTML = '';

    if (students.length === 0) {
      attendanceContainer.innerHTML = `<div class="empty-state"><p>No students available. Please add students first.</p></div>`;
      return;
    }

    students.forEach(student => {
      const container = document.createElement('div');
      container.className = 'attendance-item';
      container.style.cssText = 'display:flex;align-items:center;gap:12px;margin:8px 0;padding:12px;border-radius:8px;background:var(--surface);border:1px solid var(--border);';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'presentStudents';
      checkbox.value = student.id; // ID for consistency
      checkbox.id = `attendance-${student.id}`;
      checkbox.style.cssText = 'width:18px;height:18px;';

      const label = document.createElement('label');
      label.htmlFor = `attendance-${student.id}`;
      label.textContent = formatStudentDisplay(student);
      label.style.cssText = 'flex:1;margin:0;cursor:pointer;font-weight:500;';

      const studentInfo = document.createElement('span');
      studentInfo.textContent = `Rate: $${fmtMoney(student.rate || 0)}`;
      studentInfo.style.cssText = 'font-size:0.85em;color:var(--muted);';

      container.append(checkbox, label, studentInfo);
      attendanceContainer.appendChild(container);
    });
  } catch (error) {
    NotificationSystem.notifyError('Failed to populate attendance list');
  }
}

// ===========================
// REPORT MODALS (Accessible)
// ===========================
function createLabel(text) {
  const label = document.createElement('div');
  label.textContent = text;
  label.style.cssText = 'margin-top: 10px; font-weight: bold; color: var(--text);';
  return label;
}

function createDateSelectionModal(reportType, onConfirm, showMonthPicker = false) {
  const existingModal = document.querySelector('.modal');
  if (existingModal) document.body.removeChild(existingModal);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 10000;
  `;

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.setAttribute('aria-labelledby', 'modal-title');
  modalContent.style.cssText = `
    background: var(--surface); padding: 20px; border-radius: 12px;
    min-width: 300px; max-width: 90vw; max-height: 90vh; overflow-y: auto;
  `;

  const title = document.createElement('h3');
  title.id = 'modal-title';
  title.textContent = `Select ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Period`;

  const dateInput = document.createElement('input');
  dateInput.type = showMonthPicker ? 'month' : 'date';
  dateInput.value = showMonthPicker
    ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    : new Date().toISOString().split('T')[0];

  dateInput.style.cssText = `
    width: 100%; padding: 10px; margin: 10px 0; border: 1px solid var(--border);
    border-radius: 6px; background: var(--background); color: var(--text);
  `;

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 15px;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Generate Report';
  confirmBtn.style.cssText = `
    flex: 1; padding: 10px; background: var(--primary); color: white;
    border: none; border-radius: 6px; cursor: pointer;
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    flex: 1; padding: 10px; background: var(--border); color: var(--text);
    border: none; border-radius: 6px; cursor: pointer;
  `;

  confirmBtn.onclick = () => {
    if (showMonthPicker) {
      const [year, month] = dateInput.value.split('-');
      const selectedStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const selectedEnd = new Date(selectedStart.getFullYear(), selectedStart.getMonth() + 1, 0);
      onConfirm(selectedStart, selectedEnd);
    } else {
      const selectedDate = new Date(dateInput.value);
      onConfirm(selectedDate);
    }
    document.body.removeChild(modal);
  };

  cancelBtn.onclick = () => document.body.removeChild(modal);
  modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };

  modalContent.append(title, dateInput, buttonContainer);
  buttonContainer.append(confirmBtn, cancelBtn);
  modal.appendChild(modalContent);
  return modal;
}

function createDateRangeModal(reportType, onConfirm) {
  const existingModal = document.querySelector('.modal');
  if (existingModal) document.body.removeChild(existingModal);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 10000;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--surface); padding: 20px; border-radius: 12px;
    min-width: 300px; max-width: 90vw;
  `;

  const title = document.createElement('h3');
  title.id = 'modal-title';
  title.textContent = `Select Date Range for ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
  modalContent.setAttribute('aria-labelledby', 'modal-title');

  const startDateInput = document.createElement('input');
  startDateInput.type = 'date';
  startDateInput.value = getStartOfMonth(new Date()).toISOString().split('T')[0];
  startDateInput.style.cssText = `
    width: 100%; padding: 10px; margin: 5px 0; border: 1px solid var(--border);
    border-radius: 6px; background: var(--background); color: var(--text);
  `;
  const endDateInput = document.createElement('input');
  endDateInput.type = 'date';
  endDateInput.value = new Date().toISOString().split('T')[0];
  endDateInput.style.cssText = startDateInput.style.cssText;

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 15px;';
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Generate Report';
  confirmBtn.style.cssText = `
    flex: 1; padding: 10px; background: var(--primary); color: white;
    border: none; border-radius: 6px; cursor: pointer;
  `;
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    flex: 1; padding: 10px; background: var(--border); color: var(--text);
    border: none; border-radius: 6px; cursor: pointer;
  `;

  confirmBtn.onclick = () => {
    const startDate = new Date(startDateInput.value + 'T00:00:00');
    const endDate = new Date(endDateInput.value + 'T23:59:59');
    if (startDate > endDate) {
      NotificationSystem.notifyError('Start date cannot be after end date');
      return;
    }
    onConfirm(startDate, endDate);
    document.body.removeChild(modal);
  };
  cancelBtn.onclick = () => document.body.removeChild(modal);
  modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };

  modalContent.append(title, createLabel('Start Date:'), startDateInput, createLabel('End Date:'), endDateInput, buttonContainer);
  buttonContainer.append(confirmBtn, cancelBtn);
  modal.appendChild(modalContent);
  return modal;
}

function showReportModal(title, content) {
  const existingModal = document.querySelector('.modal');
  if (existingModal) document.body.removeChild(existingModal);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 10000;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--surface); padding: 20px; border-radius: 12px;
    min-width: 300px; max-width: 80vw; max-height: 80vh; overflow-y: auto;
    white-space: pre-line; font-family: monospace; line-height: 1.4;
  `;

  const modalTitle = document.createElement('h3');
  modalTitle.id = 'modal-title';
  modalTitle.textContent = title;
  modalTitle.style.cssText = 'margin-bottom: 15px; color: var(--text);';

  const reportContent = document.createElement('div');
  reportContent.textContent = content;
  reportContent.style.cssText = 'margin-bottom: 15px;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    padding: 10px 20px; background: var(--primary); color: white;
    border: none; border-radius: 6px; cursor: pointer; float: right;
  `;
  closeBtn.onclick = () => document.body.removeChild(modal);
  modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };

  modalContent.append(modalTitle, reportContent, closeBtn);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// ===========================
// REPORT FUNCTIONS
// ===========================
function showWeeklyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;
  const today = new Date();
  const startDate = getStartOfWeek(today);
  const endDate = getEndOfWeek(today);
  try {
    generateWeeklyReport(startDate, endDate);
  } catch (error) {
    NotificationSystem.notifyError('Failed to generate weekly report');
  }
  setTimeout(() => {
    if (confirm('Would you like to generate a report for a different week?')) {
      const modal = createDateSelectionModal('weekly', (selectedDate) => {
        const customStartDate = getStartOfWeek(selectedDate);
        const customEndDate = getEndOfWeek(selectedDate);
        generateWeeklyReport(customStartDate, customEndDate);
      });
      document.body.appendChild(modal);
    }
  }, 800);
}

function showBiWeeklyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 13 * 24 * 60 * 60 * 1000);
  try {
    generateBiWeeklyReport(startDate, endDate);
  } catch {
    NotificationSystem.notifyError('Failed to generate bi-weekly report');
  }
  setTimeout(() => {
    if (confirm('Would you like to generate a report for a different 2-week period?')) {
      const modal = createDateRangeModal('bi-weekly', (customStartDate, customEndDate) => {
        generateBiWeeklyReport(customStartDate, customEndDate);
      });
      document.body.appendChild(modal);
    }
  }, 800);
}

function showMonthlyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;
  const today = new Date();
  const startDate = getStartOfMonth(today);
  const endDate = getEndOfMonth(today);
  try {
    generateMonthlyReport(startDate, endDate);
  } catch {
    NotificationSystem.notifyError('Failed to generate monthly report');
  }
  setTimeout(() => {
    if (confirm('Would you like to generate a report for a different month?')) {
      const modal = createDateSelectionModal('monthly', (selectedStart, selectedEnd) => {
        generateMonthlyReport(selectedStart, selectedEnd);
      }, true);
      document.body.appendChild(modal);
    }
  }, 800);
}

function showSubjectBreakdown() {
  const user = auth.currentUser;
  if (!user) return;
  const today = new Date();
  const startDate = getStartOfMonth(today);
  const endDate = getEndOfMonth(today);
  try {
    generateSubjectReport(cache.marks || [], cache.hours || []);
  } catch {
    NotificationSystem.notifyError('Failed to generate subject report');
  }
  setTimeout(() => {
    if (confirm('Would you like to generate a report for a different period?')) {
      const modal = createDateRangeModal('subject', (customStartDate, customEndDate) => {
        // You can filter by range here if needed
        generateSubjectReport(cache.marks || [], cache.hours || []);
      });
      document.body.appendChild(modal);
    }
  }, 800);
}

// Weekly report
function generateWeeklyReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    const weeklyData = hours.filter(entry => {
      const dateStr = entry.date || entry.dateIso;
      if (!dateStr) return false;
      const entryDate = new Date(dateStr);
      return isDateInRange(entryDate, startDate, endDate);
    });
    if (weeklyData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for week of ${formatDateForDisplay(startDate)}`);
      return;
    }

    const weeklyHours = weeklyData.reduce((sum, e) => sum + safeNumber(e.hours), 0);
    const weeklyTotal = weeklyData.reduce((sum, e) => sum + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0);

    const byDay = {};
    for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 86400000)) {
      const dayKey = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      byDay[dayKey] = 0;
    }
    weeklyData.forEach(e => {
      const entryDate = new Date(e.date || e.dateIso);
      const dayKey = entryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      byDay[dayKey] += safeNumber(e.hours);
    });

    let breakdown = `Weekly Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
    breakdown += `Total Hours: ${weeklyHours.toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(weeklyTotal)}\n`;
    if (weeklyHours > 0) breakdown += `Average Rate: $${fmtMoney(weeklyTotal / weeklyHours)}/hour\n`;
    breakdown += '\nDaily Breakdown:\n';
    Object.entries(byDay).forEach(([day, hrs]) => breakdown += `${day}: ${hrs.toFixed(1)} hours\n`);

    showReportModal('Weekly Breakdown', breakdown);
  } catch (error) {
    NotificationSystem.notifyError('Failed to generate weekly report');
  }
}

// Bi-weekly report
function generateBiWeeklyReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    const biWeeklyData = hours.filter(entry => {
      const dateStr = entry.date || entry.dateIso;
      if (!dateStr) return false;
      const entryDate = new Date(dateStr);
      return isDateInRange(entryDate, startDate, endDate);
    });
    if (biWeeklyData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for period ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`);
      return;
    }

    const totalHours = biWeeklyData.reduce((sum, e) => sum + safeNumber(e.hours), 0);
    const totalEarnings = biWeeklyData.reduce((sum, e) => sum + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0);

    const byWeek = {};
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const weekEnd = new Date(currentDate.getTime() + 6 * 86400000);
      const actualWeekEnd = weekEnd > endDate ? endDate : weekEnd;
      const weekKey = `Week of ${formatDateShort(currentDate)}`;
      const weekData = biWeeklyData.filter(entry => {
        const dateStr = entry.date || entry.dateIso;
        if (!dateStr) return false;
        const entryDate = new Date(dateStr);
        return isDateInRange(entryDate, currentDate, actualWeekEnd);
      });
      byWeek[weekKey] = {
        hours: weekData.reduce((sum, e) => sum + safeNumber(e.hours), 0),
        earnings: weekData.reduce((sum, e) => sum + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0),
        sessions: weekData.length
      };
      currentDate = new Date(currentDate.getTime() + 7 * 86400000);
    }

    let breakdown = `Bi-Weekly Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
    breakdown += `Total Hours: ${totalHours.toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(totalEarnings)}\n`;
    if (totalHours > 0) breakdown += `Average Rate: $${fmtMoney(totalEarnings / totalHours)}/hour\n`;
    breakdown += '\nWeekly Breakdown:\n';
    Object.entries(byWeek).forEach(([week, data]) => {
      breakdown += `${week}: ${data.hours.toFixed(1)} hours (${data.sessions} sessions) - $${fmtMoney(data.earnings)}\n`;
    });

    showReportModal('Bi-Weekly Breakdown', breakdown);
  } catch (error) {
    NotificationSystem.notifyError('Failed to generate bi-weekly report');
  }
}

// Monthly report
function generateMonthlyReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    const monthlyData = hours.filter(entry => {
      const dateStr = entry.date || entry.dateIso;
      if (!dateStr) return false;
      const entryDate = new Date(dateStr);
      return isDateInRange(entryDate, startDate, endDate);
    });
    if (monthlyData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`);
      return;
    }

    const monthlyHours = monthlyData.reduce((sum, e) => sum + safeNumber(e.hours), 0);
    const monthlyTotal = monthlyData.reduce((sum, e) => sum + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0);

    const byStudent = {}, byWorkType = {}, byWeek = {};
    monthlyData.forEach(e => {
      const studentKey = e.studentId || e.student || 'Unknown';
      if (!byStudent[studentKey]) byStudent[studentKey] = { hours: 0, total: 0, sessions: 0 };
      byStudent[studentKey].hours += safeNumber(e.hours);
      byStudent[studentKey].total += safeNumber(e.total || (e.hours || 0) * (e.rate || 0));
      byStudent[studentKey].sessions++;

      const workType = e.workType || 'General';
      byWorkType[workType] = (byWorkType[workType] || 0) + safeNumber(e.hours);

      const entryDate = new Date(e.date || e.dateIso);
      const weekStart = getStartOfWeek(entryDate);
      const weekKey = `Week ${getWeekNumber(entryDate)} (${formatDateShort(weekStart)})`;
      byWeek[weekKey] = (byWeek[weekKey] || 0) + safeNumber(e.hours);
    });

    let breakdown = `Monthly Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
    breakdown += `Total Hours: ${monthlyHours.toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(monthlyTotal)}\n`;
    if (monthlyHours > 0) breakdown += `Average Rate: $${fmtMoney(monthlyTotal / monthlyHours)}/hour\n`;

    breakdown += '\nBy Student:\n';
    Object.entries(byStudent).sort((a, b) => b[1].total - a[1].total).forEach(([studentKey, data]) => {
      const studentObj = (cache.students || []).find(s => s.id === studentKey || s.name === studentKey);
      const display = studentObj ? formatStudentDisplay(studentObj) : studentKey;
      breakdown += `• ${display}: ${data.hours.toFixed(1)} hours (${data.sessions} sessions) - $${fmtMoney(data.total)}\n`;
    });

    breakdown += '\nBy Work Type:\n';
    Object.entries(byWorkType).sort((a, b) => b[1] - a[1]).forEach(([type, hrs]) => {
      breakdown += `• ${type}: ${hrs.toFixed(1)} hours\n`;
    });

    breakdown += '\nBy Week:\n';
    Object.entries(byWeek).forEach(([week, hrs]) => {
      breakdown += `• ${week}: ${hrs.toFixed(1)} hours\n`;
    });

    showReportModal('Monthly Breakdown', breakdown);
  } catch (error) {
    NotificationSystem.notifyError('Failed to generate monthly report');
  }
}

// Period report table for Reports tab
function generatePeriodReport(hours, students, payments) {
  const container = document.getElementById('periodReport');
  if (!container) return;

  if (!hours || hours.length === 0) {
    container.innerHTML = '<div class="empty-state">No hours data available for reports</div>';
    return;
  }

  const now = new Date();
  const weekStart = getStartOfWeek(now);
  const monthStart = getStartOfMonth(now);

  const weeklyData = hours.filter(entry => {
    const entryDate = new Date(entry.date || entry.dateIso);
    return entryDate >= weekStart;
  });
  const monthlyData = hours.filter(entry => {
    const entryDate = new Date(entry.date || entry.dateIso);
    return entryDate >= monthStart;
  });

  const weeklyHours = weeklyData.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
  const weeklyEarnings = weeklyData.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
  const monthlyHours = monthlyData.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
  const monthlyEarnings = monthlyData.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
  const allHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
  const allEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);

  const reportHTML = `
    <table class="report-table" role="table" aria-label="Period Report">
      <thead>
        <tr class="report-row header" role="row">
          <th class="report-cell" role="columnheader">Period</th>
          <th class="report-cell" role="columnheader">Hours</th>
          <th class="report-cell" role="columnheader">Earnings</th>
          <th class="report-cell" role="columnheader">Sessions</th>
          <th class="report-cell" role="columnheader">Avg Rate/Hour</th>
        </tr>
      </thead>
      <tbody>
        <tr class="report-row" role="row">
          <td class="report-cell" role="cell"><strong>This Week</strong></td>
          <td class="report-cell" role="cell">${weeklyHours.toFixed(1)}</td>
          <td class="report-cell" role="cell">$${fmtMoney(weeklyEarnings)}</td>
          <td class="report-cell" role="cell">${weeklyData.length}</td>
          <td class="report-cell" role="cell">$${fmtMoney(weeklyHours > 0 ? weeklyEarnings / weeklyHours : 0)}</td>
        </tr>
        <tr class="report-row" role="row">
          <td class="report-cell" role="cell"><strong>This Month</strong></td>
          <td class="report-cell" role="cell">${monthlyHours.toFixed(1)}</td>
          <td class="report-cell" role="cell">$${fmtMoney(monthlyEarnings)}</td>
          <td class="report-cell" role="cell">${monthlyData.length}</td>
          <td class="report-cell" role="cell">$${fmtMoney(monthlyHours > 0 ? monthlyEarnings / monthlyHours : 0)}</td>
        </tr>
        <tr class="report-row" role="row">
          <td class="report-cell" role="cell"><strong>All Time</strong></td>
          <td class="report-cell" role="cell">${allHours.toFixed(1)}</td>
          <td class="report-cell" role="cell">$${fmtMoney(allEarnings)}</td>
          <td class="report-cell" role="cell">${hours.length}</td>
          <td class="report-cell" role="cell">$${fmtMoney(allHours > 0 ? allEarnings / allHours : 0)}</td>
        </tr>
      </tbody>
    </table>
  `;
  container.innerHTML = reportHTML;
}

// Subject report table for Reports tab
function generateSubjectReport(marks, hours) {
  const container = document.getElementById('subjectReport');
  if (!container) return;

  if ((!marks || marks.length === 0) && (!hours || hours.length === 0)) {
    container.innerHTML = '<div class="empty-state">No marks or hours data available</div>';
    return;
  }

  const subjectMarks = {};
  marks.forEach(mark => {
    const subject = mark.subject || 'General';
    if (!subjectMarks[subject]) subjectMarks[subject] = { totalPercentage: 0, count: 0 };
    subjectMarks[subject].totalPercentage += safeNumber(mark.percentage);
    subjectMarks[subject].count++;
  });

  const subjectHours = {};
  hours.forEach(entry => {
    const subject = entry.subject || 'General';
    if (!subjectHours[subject]) subjectHours[subject] = { hours: 0, earnings: 0, sessions: 0 };
    subjectHours[subject].hours += safeNumber(entry.hours);
    subjectHours[subject].earnings += safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0));
    subjectHours[subject].sessions++;
  });

  const allSubjects = [...new Set([...Object.keys(subjectMarks), ...Object.keys(subjectHours)])];
  if (allSubjects.length === 0) {
    container.innerHTML = '<div class="empty-state">No subject data available</div>';
    return;
  }

  allSubjects.sort((a, b) => (subjectHours[b]?.hours || 0) - (subjectHours[a]?.hours || 0));

  let reportHTML = `
    <table class="report-table" role="table" aria-label="Subject Report">
      <thead>
        <tr class="report-row header" role="row">
          <th class="report-cell" role="columnheader">Subject</th>
          <th class="report-cell" role="columnheader">Avg Mark</th>
          <th class="report-cell" role="columnheader">Hours</th>
          <th class="report-cell" role="columnheader">Earnings</th>
          <th class="report-cell" role="columnheader">Sessions</th>
          <th class="report-cell" role="columnheader">Avg Rate</th>
        </tr>
      </thead>
      <tbody>
  `;

  allSubjects.forEach(subject => {
    const markData = subjectMarks[subject];
    const hourData = subjectHours[subject];
    const avgMarkVal = markData ? (markData.totalPercentage / markData.count) : null;
    const totalHoursVal = hourData ? hourData.hours : 0;
    const totalEarningsVal = hourData ? hourData.earnings : 0;
    const totalSessionsVal = hourData ? hourData.sessions : 0;
    const avgRateVal = totalHoursVal > 0 ? totalEarningsVal / totalHoursVal : 0;

    reportHTML += `
      <tr class="report-row" role="row">
        <td class="report-cell" role="cell"><strong>${subject}</strong></td>
        <td class="report-cell" role="cell">${avgMarkVal !== null ? avgMarkVal.toFixed(1) + '%' : 'N/A'}</td>
        <td class="report-cell" role="cell">${totalHoursVal.toFixed(1)}</td>
        <td class="report-cell" role="cell">$${fmtMoney(totalEarningsVal)}</td>
        <td class="report-cell" role="cell">${totalSessionsVal}</td>
        <td class="report-cell" role="cell">$${fmtMoney(avgRateVal)}/hr</td>
      </tr>
    `;
  });

  reportHTML += '</tbody></table>';
  container.innerHTML = reportHTML;
}

// Student performance report table
function generateStudentPerformanceReport(marks, students) {
  const container = document.getElementById('studentReport');
  if (!container) return;

  if (!marks || marks.length === 0) {
    container.innerHTML = '<div class="empty-state">No marks data available for student performance report</div>';
    return;
  }

  const performanceByStudent = {};
  marks.forEach(mark => {
    const studentId = mark.studentId || mark.student;
    if (!studentId) return;

    if (!performanceByStudent[studentId]) {
      performanceByStudent[studentId] = { totalPercentage: 0, count: 0, subjects: new Set(), grades: [] };
    }
    performanceByStudent[studentId].totalPercentage += safeNumber(mark.percentage);
    performanceByStudent[studentId].count++;
    performanceByStudent[studentId].subjects.add(mark.subject || 'General');
    performanceByStudent[studentId].grades.push(mark.grade || calculateGrade(mark.percentage));
  });

  const studentPerformance = Object.entries(performanceByStudent).map(([id, data]) => {
    const avgPercentage = data.totalPercentage / data.count;
    const gradeCounts = {};
    data.grades.forEach(g => gradeCounts[g] = (gradeCounts[g] || 0) + 1);
    const mostCommonGrade = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const studentObj = students.find(s => s.id === id) || { name: id };
    return {
      student: formatStudentDisplay(studentObj),
      average: avgPercentage,
      totalMarks: data.count,
      subjects: Array.from(data.subjects).join(', '),
      mostCommonGrade,
      performance: avgPercentage >= 80 ? 'Excellent' :
                   avgPercentage >= 70 ? 'Good' :
                   avgPercentage >= 60 ? 'Average' : 'Needs Improvement'
    };
  }).sort((a, b) => b.average - a.average);

  let reportHTML = `
    <table class="report-table" role="table" aria-label="Student Performance Report">
      <thead>
        <tr class="report-row header" role="row">
          <th class="report-cell" role="columnheader">Student</th>
          <th class="report-cell" role="columnheader">Avg Score</th>
          <th class="report-cell" role="columnheader">Total Marks</th>
          <th class="report-cell" role="columnheader">Subjects</th>
          <th class="report-cell" role="columnheader">Common Grade</th>
          <th class="report-cell" role="columnheader">Performance</th>
        </tr>
      </thead>
      <tbody>
  `;
  studentPerformance.forEach(s => {
    reportHTML += `
      <tr class="report-row" role="row">
        <td class="report-cell" role="cell"><strong>${s.student}</strong></td>
        <td class="report-cell" role="cell">${s.average.toFixed(1)}%</</td>
        <td class="report-cell" role="cell">${s.totalMarks}</td>
        <td class="report-cell truncate" role="cell" title="${s.subjects}">${s.subjects}</td>
        <td class="report-cell" role="cell">${s.mostCommonGrade}</td>
        <td class="report-cell ${s.performance.toLowerCase().replace(' ', '-')}" role="cell">${s.performance}</td>
      </tr>
    `;
  });
  reportHTML += '</tbody></table>';
  container.innerHTML = reportHTML;
}

// ===========================
// REPORT DATA LOADING
// ===========================
async function loadReportData() {
  try {
    const [hours, marks, students, payments] = await Promise.all([
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('marks'),
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('payments')
    ]);

    generatePeriodReport(hours, students, payments);
    generateSubjectReport(marks, hours);
    generateStudentPerformanceReport(marks, students);
    return true;
  } catch (error) {
    const containers = ['periodReport', 'subjectReport', 'studentReport'];
    containers.forEach(id => {
      const c = document.getElementById(id);
      if (c) c.innerHTML = '<div class="error">Error loading report data</div>';
    });
    return false;
  }
}

// ===========================
// OVERVIEW REPORTS
// ===========================
async function renderOverviewReports() {
  try {
    const [students, hours, marks, payments] = await Promise.all([
      EnhancedCache.loadCollection('students'),
      EnhancedCache.loadCollection('hours'),
      EnhancedCache.loadCollection('marks'),
      EnhancedCache.loadCollection('payments')
    ]);

    const totalStudents = students.length;
    const totalHours = hours.reduce((sum, entry) => sum + safeNumber(entry.hours), 0);
    const totalEarnings = hours.reduce((sum, entry) => sum + safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0)), 0);
    const totalPayments = payments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0);

    let avgMark = 0;
    if (marks.length > 0) {
      const totalPercentage = marks.reduce((sum, mark) => sum + safeNumber(mark.percentage), 0);
      avgMark = totalPercentage / marks.length;
    }
    const outstandingBalance = Math.max(totalEarnings - totalPayments, 0);

    const elements = {
      'totalStudentsReport': totalStudents,
      'totalHoursReport': totalHours.toFixed(1),
      'totalEarningsReport': `$${fmtMoney(totalEarnings)}`,
      'avgMarkReport': `${avgMark.toFixed(1)}%`,
      'totalPaymentsReport': `$${fmtMoney(totalPayments)}`,
      'outstandingBalance': `$${fmtMoney(outstandingBalance)}`
    };
    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  } catch (error) {
    ['totalStudentsReport', 'totalHoursReport', 'totalEarningsReport', 'avgMarkReport', 'totalPaymentsReport', 'outstandingBalance'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Error';
    });
  }
}

// ===========================
// SUPPORTING: DATA LOAD & UI REFRESH
// ===========================
async function loadCollectionWithRetry(collectionName, retries = 3) {
  const user = auth.currentUser;
  if (!user) return [];
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const querySnapshot = await getDocs(collection(db, "users", user.uid, collectionName));
      const data = [];
      querySnapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data(), _firebaseId: docSnap.id, _synced: true });
      });
      return data;
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
  return [];
}

async function loadAllData() {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.notifyError('No authenticated user for data loading');
    return false;
  }
  showLoadingOverlay('Loading data...');
  try {
    const [students, hours, marks, attendance, payments] = await Promise.all([
      loadCollectionWithRetry('students'),
      loadCollectionWithRetry('hours'),
      loadCollectionWithRetry('marks'),
      loadCollectionWithRetry('attendance'),
      loadCollectionWithRetry('payments')
    ]);

    cache.students = students;
    cache.hours = hours;
    cache.marks = marks;
    cache.attendance = attendance;
    cache.payments = payments;
    cache.lastSync = Date.now();

    EnhancedCache.saveToLocalStorageBulk('students', students);
    EnhancedCache.saveToLocalStorageBulk('hours', hours);
    EnhancedCache.saveToLocalStorageBulk('marks', marks);
    EnhancedCache.saveToLocalStorageBulk('attendance', attendance);
    EnhancedCache.saveToLocalStorageBulk('payments', payments);

    hideLoadingOverlay();
    return true;
  } catch (error) {
    NotificationSystem.notifyError('Failed to load data from Firebase, attempting cache fallback...');
    try {
      cache.students = EnhancedCache.loadFromLocalStorage('students') || [];
      cache.hours = EnhancedCache.loadFromLocalStorage('hours') || [];
      cache.marks = EnhancedCache.loadFromLocalStorage('marks') || [];
      cache.attendance = EnhancedCache.loadFromLocalStorage('attendance') || [];
      cache.payments = EnhancedCache.loadFromLocalStorage('payments') || [];
      hideLoadingOverlay();
      NotificationSystem.notifyInfo('Loaded cached data. Some features may be limited.');
      return false;
    } catch (cacheError) {
      hideLoadingOverlay();
      NotificationSystem.notifyError('Failed to load data from Firebase or cache');
      return false;
    }
  }
}

async function refreshAllUI() {
  try {
    const results = await Promise.allSettled([
      renderStudents?.(),
      renderRecentHoursWithEdit?.(),
      renderRecentMarksWithEdit?.(),
      renderAttendanceRecentWithEdit?.(),
      renderPaymentActivityWithEdit?.(),
      renderStudentBalancesWithEdit?.(),
      renderOverviewReports()
    ]);
    results.forEach((res, i) => {
      if (res.status === 'rejected') console.error(`❌ UI component ${i} failed:`, res.reason);
    });
    await StudentDropdownManager.forceRefresh();
    setTimeout(debugStudentDropdowns, 1000);
  } catch (error) {
    console.error('❌ Error refreshing UI:', error);
  }
}

// ===========================
// APP INITIALIZATION & AUTH HANDLER
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  injectLoadingStyles();
  injectThemeStyles?.();
  initializeTheme?.();
  NotificationSystem.initNotificationStyles?.();
  EnhancedCache.loadCachedData?.();
  EnhancedStats.init?.();

  setupTabNavigation();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      document.body.classList.add('loading');
      document.body.setAttribute('aria-busy', 'true');
      try {
        if (!localStorage.getItem('memberSince')) {
          localStorage.setItem('memberSince', new Date().toISOString());
        }
        await loadUserProfile?.(user.uid);

        const dataLoaded = await loadAllData();
        if (!dataLoaded) {
          NotificationSystem.notifyWarning('Using cached data - some features may be limited');
        }

        SyncBar.init?.();
        setupProfileModal?.();
        setupFloatingAddButton?.();
        updateHeaderStats?.();

        StudentDropdownManager.init();
        setupFormHandlers?.();

        let dropdownsPopulated = false;
        let retryCount = 0;
        while (!dropdownsPopulated && retryCount < 3) {
          try {
            await StudentDropdownManager.forceRefresh();
            const students = await EnhancedCache.loadCollection('students');
            if (students.length > 0) {
              dropdownsPopulated = true;
            } else {
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        if (!dropdownsPopulated) {
          NotificationSystem.notifyWarning('No students found. Please add students to continue.');
        }

        EnhancedStats.forceRefresh?.();
        setTimeout(() => {
          refreshAllUI();
          EnhancedStats.forceRefresh?.();
        }, 1500);

        setInterval(async () => {
          try {
            await loadAllData();
            EnhancedStats.forceRefresh?.();
          } catch (error) {
            console.error('❌ Periodic data refresh failed:', error);
          }
        }, 300000); // 5 minutes

        document.body.classList.remove('loading');
        document.body.removeAttribute('aria-busy');

        const displayName = user.email.split('@')[0];
        NotificationSystem.notifySuccess(`Welcome back, ${displayName}! All systems ready.`, 3000);
      } catch (error) {
        document.body.classList.remove('loading');
        document.body.removeAttribute('aria-busy');

        let errorMessage = 'Failed to load application. ';
        if (error?.code === 'permission-denied') {
          errorMessage += 'Permission denied. Please check your Firebase rules.';
        } else if (error?.code === 'unavailable') {
          errorMessage += 'Network unavailable. Using offline data.';
        } else if (error?.message?.includes?.('quota')) {
          errorMessage += 'Firebase quota exceeded. Please try again later.';
        } else {
          errorMessage += error?.message || 'Unknown error';
        }
        NotificationSystem.notifyError(errorMessage);

        try {
          EnhancedCache.loadCachedData?.();
          EnhancedStats.forceRefresh?.();
          NotificationSystem.notifyInfo('Loaded cached data. Some features may be limited.');
        } catch (cacheError) {
          console.error('❌ Cache load also failed:', cacheError);
        }
      }
    } else {
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      setTimeout(() => { window.location.href = "auth.html"; }, 1000);
    }
  });
});

// ===========================
// REPORT DATA FUNCTIONS ENTRYPOINT
// ===========================
async function loadReportDataEntrypoint() {
  await loadReportData();
}

// ===========================
// EXPORTS (Guarded)
// ===========================
(function exportGlobals() {
  const exports = {
    // UI & profile
    updateProfileButton,
    setupProfileModal,
    loadUserProfile,
    updateHeaderStats,
    setupFloatingAddButton,
    // Dropdowns & attendance
    StudentDropdownManager,
    populateStudentDropdowns,
    populateHoursStudentDropdown,
    populateAttendanceStudents,
    formatStudentDisplay,
    debugStudentDropdowns,
    manuallyRefreshStudentDropdowns,
    // Reports
    showWeeklyBreakdown,
    showBiWeeklyBreakdown,
    showMonthlyBreakdown,
    showSubjectBreakdown,
    loadReportData,
    generatePeriodReport,
    generateSubjectReport,
    generateStudentPerformanceReport,
    renderOverviewReports,
    // Navigation
    switchTab,
    setupTabNavigation,
    // Payment activity
    renderPaymentActivity: renderPaymentActivityWithEdit,
    // Edit/delete
    startEditHours,
    cancelEditHours,
    deleteHours,
    deleteMark,
    deleteAttendance,
    deletePayment,
    deleteStudent,
    startEditMark,
    cancelEditMark,
    startEditAttendance,
    cancelEditAttendance,
    startEditPayment,
    cancelEditPayment,
    quickAddPayment,
    recordPayment,
    // Support & cache
    loadAllData,
    loadCollectionWithRetry,
    refreshAllUI,
    // Date helpers
    fmtDateISO,
    formatDateForDisplay,
    formatDateShort,
    getStartOfWeek,
    getEndOfWeek,
    getStartOfMonth,
    getEndOfMonth,
    getWeekNumber,
    isDateInRange,
    // Systems
    NotificationSystem,
    EnhancedStats,
    EnhancedCache,
    SyncBar
  };
  Object.entries(exports).forEach(([key, fn]) => {
    if (typeof fn !== 'undefined') window[key] = fn;
  });
  console.log('✅ All functions exported to window object');
})();
