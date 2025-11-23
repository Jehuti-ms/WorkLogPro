// ===========================
// GLOBAL HELPERS
// ===========================
const DEBUG_MODE = true;

function safeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(val) {
  const n = safeNumber(val);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatStudentDisplay(student) {
  if (!student) return 'Unknown';
  const name = student.name || student.fullName || 'Unnamed';
  const id = student.id || student._firebaseId || '';
  return id ? `${name} (${id})` : name;
}

// ===========================
// DATE HELPERS
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

function formatDateForDisplay(date) {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatDateShort(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  const pastDays = Math.floor((d - firstDayOfYear) / 86400000);
  return Math.ceil((pastDays + ((firstDayOfYear.getDay() + 6) % 7) + 1) / 7);
}
function isDateInRange(entryDate, startDate, endDate) {
  const ed = new Date(entryDate);
  return ed >= new Date(startDate) && ed <= new Date(endDate);
}

// ===========================
// LOADING & TAB CSS
// ===========================
function injectLoadingStyles() {
  if (!document.querySelector('#loading-styles')) {
    const style = document.createElement('style');
    style.id = 'loading-styles';
    style.textContent = `
      body.loading { cursor: wait !important; }
      body.loading * { pointer-events: none !important; }
      .loading-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; color: white; font-size: 1rem;
      }
      .loading-spinner {
        border: 4px solid #f3f3f3; border-top: 4px solid var(--primary, #3498db);
        border-radius: 50%; width: 42px; height: 42px; animation: spin 1s linear infinite;
        margin-right: 12px;
      }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .report-table { width: 100%; border-collapse: collapse; }
      .report-table th, .report-table td { padding: 8px 10px; border-bottom: 1px solid var(--border, #ddd); }
      .report-table thead tr { background: var(--surface-2, #f6f6f6); }
      .empty-state { padding: 12px; border: 1px dashed var(--border); border-radius: 8px; color: var(--muted); }
    `;
    document.head.appendChild(style);
  }
}
function showLoadingOverlay(message = 'Loading...') {
  let overlay = document.querySelector('.loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `<div class="loading-spinner"></div><div>${message}</div>`;
    document.body.appendChild(overlay);
  }
}
function hideLoadingOverlay() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) overlay.remove();
}

function injectTabCSS() {
  if (!document.querySelector('#tab-css-fixed')) {
    const style = document.createElement('style');
    style.id = 'tab-css-fixed';
    style.textContent = `
      .tabcontent { display: none !important; visibility: hidden !important; }
      .tabcontent.active { display: block !important; visibility: visible !important; }
      .tab.active { background: var(--primary) !important; color: white !important; }
    `;
    document.head.appendChild(style);
  }
}

// ===========================
// TAB NAVIGATION
// ===========================
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
  document.querySelectorAll(`.tab[data-tab="${tabName}"]`).forEach(btn => btn.classList.add('active'));

  document.querySelectorAll('.tabcontent').forEach(content => {
    content.classList.remove('active');
    content.setAttribute('aria-hidden', 'true');
  });
  const target = document.getElementById(tabName);
  if (target) {
    target.classList.add('active');
    target.setAttribute('aria-hidden', 'false');
    if (tabName === 'reports') setTimeout(loadReportData, 200);
    if (tabName === 'hours') setTimeout(populateHoursStudentDropdown, 200);
  }
}
function setupTabNavigation() {
  injectTabCSS();
  const tabButtons = document.querySelectorAll('.tab[data-tab]');
  tabButtons.forEach(btn => {
    const tabName = btn.getAttribute('data-tab');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(tabName);
    });
  });
  switchTab(getInitialTab());
}

// ===========================
// DROPDOWN MANAGER (Hours tab fix)
// ===========================
const StudentDropdownManager = {
  async forceRefresh() {
    const students = await EnhancedCache.loadCollection('students');
    const selectors = [
      '#hoursStudent', '#student', '#marksStudent', '#paymentStudent',
      'select[name="student"]', 'select[name="marksStudent"]', 'select[name="paymentStudent"]'
    ];
    const dropdowns = [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => { if (el) dropdowns.push(el); });
    });
    dropdowns.forEach(dd => populateSingleDropdown(dd, students));
  }
};

async function populateStudentDropdowns() {
  try {
    const students = await EnhancedCache.loadCollection('students');
    const selectors = [
      '#hoursStudent', '#student', '#marksStudent', '#paymentStudent',
      'select[name="student"]', 'select[name="marksStudent"]', 'select[name="paymentStudent"]'
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => populateSingleDropdown(el, students));
    });
  } catch (err) {
    NotificationSystem.notifyError('Failed to populate student dropdowns');
  }
}

function populateSingleDropdown(dropdown, students) {
  if (!dropdown) return;
  const prevValue = dropdown.value;
  dropdown.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = students.length ? 'Select a student...' : 'No students available';
  defaultOption.disabled = true;
  defaultOption.selected = true;
  dropdown.appendChild(defaultOption);

  students.forEach(student => {
    const opt = document.createElement('option');
    opt.value = student.id; // use ID for value to ensure persistence
    opt.textContent = formatStudentDisplay(student);
    dropdown.appendChild(opt);
  });

  if (prevValue && dropdown.querySelector(`option[value="${prevValue}"]`)) {
    dropdown.value = prevValue;
  }
}

async function populateHoursStudentDropdown() {
  const dropdown = document.getElementById('hoursStudent') || document.querySelector('#student');
  if (!dropdown) return;
  const students = await EnhancedCache.loadCollection('students');
  populateSingleDropdown(dropdown, students);
}

// ===========================
// REPORT MODAL
// ===========================
function showReportModal(title, content) {
  const existing = document.querySelector('.modal');
  if (existing) document.body.removeChild(existing);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center; z-index: 10000;
  `;
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--surface); padding: 20px; border-radius: 12px;
    min-width: 300px; max-width: 80vw; max-height: 80vh; overflow-y: auto;
    white-space: pre-line; font-family: monospace; line-height: 1.4;
  `;
  const h3 = document.createElement('h3');
  h3.textContent = title;
  h3.style.cssText = 'margin-bottom: 12px;';
  const pre = document.createElement('div');
  pre.textContent = content;
  const close = document.createElement('button');
  close.textContent = 'Close';
  close.style.cssText = `margin-top: 12px; padding: 8px 12px; background: var(--primary); color: #fff; border: none; border-radius: 6px; cursor: pointer;`;
  close.onclick = () => document.body.removeChild(modal);
  modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };

  modalContent.append(h3, pre, close);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// ===========================
// REPORTS
// ===========================
function generateWeeklyReport(startDate, endDate) {
  const hours = Array.isArray(cache.hours) ? cache.hours : [];
  const weeklyData = hours.filter(entry => {
    const dateStr = entry.date || entry.dateIso;
    if (!dateStr) return false;
    return isDateInRange(new Date(dateStr), startDate, endDate);
  });
  if (!weeklyData.length) {
    NotificationSystem.notifyInfo(`No hours logged for week of ${formatDateForDisplay(startDate)}`);
    return;
  }
  const weeklyHours = weeklyData.reduce((s, e) => s + safeNumber(e.hours), 0);
  const weeklyTotal = weeklyData.reduce((s, e) => s + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0);

  const byDay = {};
  for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 86400000)) {
    const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    byDay[key] = 0;
  }
  weeklyData.forEach(e => {
    const ed = new Date(e.date || e.dateIso);
    const key = ed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    byDay[key] += safeNumber(e.hours);
  });

  let breakdown = `Weekly Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
  breakdown += `Total Hours: ${weeklyHours.toFixed(1)}\n`;
  breakdown += `Total Earnings: $${fmtMoney(weeklyTotal)}\n`;
  if (weeklyHours > 0) breakdown += `Average Rate: $${fmtMoney(weeklyTotal / weeklyHours)}/hour\n`;
  breakdown += '\nDaily Breakdown:\n';
  Object.entries(byDay).forEach(([day, hrs]) => breakdown += `${day}: ${hrs.toFixed(1)} hours\n`);
  showReportModal('Weekly Breakdown', breakdown);
}

function generateBiWeeklyReport(startDate, endDate) {
  const hours = Array.isArray(cache.hours) ? cache.hours : [];
  const biWeeklyData = hours.filter(entry => {
    const dateStr = entry.date || entry.dateIso;
    if (!dateStr) return false;
    return isDateInRange(new Date(dateStr), startDate, endDate);
  });
  if (!biWeeklyData.length) {
    NotificationSystem.notifyInfo(`No hours logged for period ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`);
    return;
  }
  const totalHours = biWeeklyData.reduce((s, e) => s + safeNumber(e.hours), 0);
  const totalEarnings = biWeeklyData.reduce((s, e) => s + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0);

  const byWeek = {};
  let current = new Date(startDate);
  while (current <= endDate) {
    const weekEnd = new Date(current.getTime() + 6 * 86400000);
    const actualEnd = weekEnd > endDate ? endDate : weekEnd;
    const key = `Week of ${formatDateShort(current)}`;
    const weekData = biWeeklyData.filter(entry => {
      const ds = entry.date || entry.dateIso;
      if (!ds) return false;
      return isDateInRange(new Date(ds), current, actualEnd);
    });
    byWeek[key] = {
      hours: weekData.reduce((s, e) => s + safeNumber(e.hours), 0),
      earnings: weekData.reduce((s, e) => s + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0),
      sessions: weekData.length
    };
    current = new Date(current.getTime() + 7 * 86400000);
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
}

function generateMonthlyReport(startDate, endDate) {
  const hours = Array.isArray(cache.hours) ? cache.hours : [];
  const monthlyData = hours.filter(entry => {
    const ds = entry.date || entry.dateIso;
    if (!ds) return false;
    return isDateInRange(new Date(ds), startDate, endDate);
  });
  if (!monthlyData.length) {
    NotificationSystem.notifyInfo(`No hours logged for ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`);
    return;
  }

  const monthlyHours = monthlyData.reduce((s, e) => s + safeNumber(e.hours), 0);
  const monthlyTotal = monthlyData.reduce((s, e) => s + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0);

  const byStudent = {}, byWorkType = {}, byWeek = {};
  monthlyData.forEach(e => {
    const studentKey = e.studentId || e.student || 'Unknown';
    if (!byStudent[studentKey]) byStudent[studentKey] = { hours: 0, total: 0, sessions: 0 };
    byStudent[studentKey].hours += safeNumber(e.hours);
    byStudent[studentKey].total += safeNumber(e.total || (e.hours || 0) * (e.rate || 0));
    byStudent[studentKey].sessions++;

    const wt = e.workType || 'General';
    byWorkType[wt] = (byWorkType[wt] || 0) + safeNumber(e.hours);

    const ed = new Date(e.date || e.dateIso);
    const wkStart = getStartOfWeek(ed);
    const wkKey = `Week ${getWeekNumber(ed)} (${formatDateShort(wkStart)})`;
    byWeek[wkKey] = (byWeek[wkKey] || 0) + safeNumber(e.hours);
  });

  let breakdown = `Monthly Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
  breakdown += `Total Hours: ${monthlyHours.toFixed(1)}\n`;
  breakdown += `Total Earnings: $${fmtMoney(monthlyTotal)}\n`;
  if (monthlyHours > 0) breakdown += `Average Rate: $${fmtMoney(monthlyTotal / monthlyHours)}/hour\n`;

  breakdown += '\nBy Student:\n';
  Object.entries(byStudent).sort((a, b) => b[1].total - a[1].total).forEach(([key, data]) => {
    const sObj = (cache.students || []).find(s => s.id === key || s.name === key);
    const display = sObj ? formatStudentDisplay(sObj) : key;
    breakdown += `• ${display}: ${data.hours.toFixed(1)} hours (${data.sessions} sessions) - $${fmtMoney(data.total)}\n`;
  });
  breakdown += '\nBy Work Type:\n';
  Object.entries(byWorkType).sort((a, b) => b[1] - a[1]).forEach(([type, hrs]) => {
    breakdown += `• ${type}: ${hrs.toFixed(1)} hours\n`;
  });
  breakdown += '\nBy Week:\n';
  Object.entries(byWeek).forEach(([wk, hrs]) => {
    breakdown += `• ${wk}: ${hrs.toFixed(1)} hours\n`;
  });

  showReportModal('Monthly Breakdown', breakdown);
}

// Reports tab tables
function generatePeriodReport(hours, students, payments) {
  const container = document.getElementById('periodReport');
  if (!container) return;

  if (!hours || !hours.length) {
    container.innerHTML = '<div class="empty-state">No hours data available for reports</div>';
    return;
  }

  const now = new Date();
  const weekStart = getStartOfWeek(now);
  const monthStart = getStartOfMonth(now);

  const weeklyData = hours.filter(e => new Date(e.date || e.dateIso) >= weekStart);
  const monthlyData = hours.filter(e => new Date(e.date || e.dateIso) >= monthStart);

  const weeklyHours = weeklyData.reduce((s, e) => s + safeNumber(e.hours), 0);
  const weeklyEarnings = weeklyData.reduce((s, e) => s + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0);
  const monthlyHours = monthlyData.reduce((s, e) => s + safeNumber(e.hours), 0);
  const monthlyEarnings = monthlyData.reduce((s, e) => s + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0);
  const allHours = hours.reduce((s, e) => s + safeNumber(e.hours), 0);
  const allEarnings = hours.reduce((s, e) => s + safeNumber(e.total || (e.hours || 0) * (e.rate || 0)), 0);

  container.innerHTML = `
    <table class="report-table" role="table" aria-label="Period Report">
      <thead>
        <tr>
          <th>Period</th><th>Hours</th><th>Earnings</th><th>Sessions</th><th>Avg Rate/Hour</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>This Week</strong></td>
          <td>${weeklyHours.toFixed(1)}</td>
          <td>$${fmtMoney(weeklyEarnings)}</td>
          <td>${weeklyData.length}</td>
          <td>$${fmtMoney(weeklyHours > 0 ? weeklyEarnings / weeklyHours : 0)}</td>
        </tr>
        <tr>
          <td><strong>This Month</strong></td>
          <td>${monthlyHours.toFixed(1)}</td>
          <td>$${fmtMoney(monthlyEarnings)}</td>
          <td>${monthlyData.length}</td>
          <td>$${fmtMoney(monthlyHours > 0 ? monthlyEarnings / monthlyHours : 0)}</td>
        </tr>
        <tr>
          <td><strong>All Time</strong></td>
          <td>${allHours.toFixed(1)}</td>
          <td>$${fmtMoney(allEarnings)}</td>
          <td>${hours.length}</td>
          <td>$${fmtMoney(allHours > 0 ? allEarnings / allHours : 0)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function generateSubjectReport(marks, hours) {
  const container = document.getElementById('subjectReport');
  if (!container) return;

  if ((!marks || !marks.length) && (!hours || !hours.length)) {
    container.innerHTML = '<div class="empty-state">No marks or hours data available</div>';
    return;
  }

  const subjectMarks = {};
  (marks || []).forEach(mark => {
    const subject = mark.subject || 'General';
    if (!subjectMarks[subject]) subjectMarks[subject] = { totalPercentage: 0, count: 0 };
    subjectMarks[subject].totalPercentage += safeNumber(mark.percentage);
    subjectMarks[subject].count++;
  });

  const subjectHours = {};
  (hours || []).forEach(entry => {
    const subject = entry.subject || 'General';
    if (!subjectHours[subject]) subjectHours[subject] = { hours: 0, earnings: 0, sessions: 0 };
    subjectHours[subject].hours += safeNumber(entry.hours);
    subjectHours[subject].earnings += safeNumber(entry.total || (entry.hours || 0) * (entry.rate || 0));
    subjectHours[subject].sessions++;
  });

  const allSubjects = [...new Set([...Object.keys(subjectMarks), ...Object.keys(subjectHours)])];
  if (!allSubjects.length) {
    container.innerHTML = '<div class="empty-state">No subject data available</div>';
    return;
  }
  allSubjects.sort((a, b) => (subjectHours[b]?.hours || 0) - (subjectHours[a]?.hours || 0));

  let html = `
    <table class="report-table" role="table" aria-label="Subject Report">
      <thead>
        <tr>
          <th>Subject</th><th>Avg Mark</th><th>Hours</th><th>Earnings</th><th>Sessions</th><th>Avg Rate</th>
        </tr>
      </thead>
      <tbody>
  `;
  allSubjects.forEach(subject => {
    const markData = subjectMarks[subject];
    const hourData = subjectHours[subject];
    const avgMarkVal = markData ? (markData.totalPercentage / markData.count) : null;
    const hoursVal = hourData ? hourData.hours : 0;
    const earningsVal = hourData ? hourData.earnings : 0;
    const sessionsVal = hourData ? hourData.sessions : 0;
    const avgRateVal = hoursVal > 0 ? earningsVal / hoursVal : 0;

    html += `
      <tr>
        <td><strong>${subject}</strong></td>
        <td>${avgMarkVal !== null ? avgMarkVal.toFixed(1) + '%' : 'N/A'}</td>
        <td>${hoursVal.toFixed(1)}</td>
        <td>$${fmtMoney(earningsVal)}</td>
        <td>${sessionsVal}</td>
        <td>$${fmtMoney(avgRateVal)}/hr</td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Student performance report
function generateStudentPerformanceReport(marks, students) {
  const container = document.getElementById('studentReport');
  if (!container) return;

  if (!marks || !marks.length) {
    container.innerHTML = '<div class="empty-state">No marks data available for student performance report</div>';
    return;
  }

  const perf = {};
  marks.forEach(mark => {
    const sid = mark.studentId || mark.student;
    if (!sid) return;
    if (!perf[sid]) perf[sid] = { total: 0, count: 0, subjects: new Set(), grades: [] };
    perf[sid].total += safeNumber(mark.percentage);
    perf[sid].count++;
    perf[sid].subjects.add(mark.subject || 'General');
    perf[sid].grades.push(mark.grade || calculateGrade?.(mark.percentage) || 'N/A');
  });

  const rows = Object.entries(perf).map(([id, d]) => {
    const avg = d.total / d.count;
    const gCounts = {};
    d.grades.forEach(g => gCounts[g] = (gCounts[g] || 0) + 1);
    const common = Object.entries(gCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const obj = (students || []).find(s => s.id === id) || { name: id };
    const perfLabel = avg >= 80 ? 'Excellent' : avg >= 70 ? 'Good' : avg >= 60 ? 'Average' : 'Needs Improvement';
    return {
      student: formatStudentDisplay(obj),
      avg,
      totalMarks: d.count,
      subjects: Array.from(d.subjects).join(', '),
      common,
      perfLabel
    };
  }).sort((a, b) => b.avg - a.avg);

  let html = `
    <table class="report-table" role="table" aria-label="Student Performance Report">
      <thead>
        <tr>
          <th>Student</th><th>Avg Score</th><th>Total Marks</th><th>Subjects</th><th>Common Grade</th><th>Performance</th>
        </tr>
      </thead>
      <tbody>
  `;
  rows.forEach(r => {
    html += `
      <tr>
        <td><strong>${r.student}</strong></td>
        <td>${r.avg.toFixed(1)}%</td>
        <td>${r.totalMarks}</td>
        <td title="${r.subjects}">${r.subjects}</td>
        <td>${r.common}</td>
        <td>${r.perfLabel}</td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
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
    console.error('Error loading report data:', error);
    ['periodReport', 'subjectReport', 'studentReport'].forEach(id => {
      const c = document.getElementById(id);
      if (c) c.innerHTML = '<div class="error">Error loading report data</div>';
    });
    return false;
  }
}

// ===========================
// DATA FETCHING
// ===========================
async function loadCollectionWithRetry(collectionName, retries = 3) {
  const user = auth.currentUser;
  if (!user) return [];
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const qs = await getDocs(collection(db, "users", user.uid, collectionName));
      const data = [];
      qs.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data(), _firebaseId: docSnap.id, _synced: true }));
      return data;
    } catch (err) {
      if (attempt === retries) throw err;
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
  } catch (err) {
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
    } catch (cacheErr) {
      hideLoadingOverlay();
      NotificationSystem.notifyError('Failed to load data from Firebase or cache');
      return false;
    }
  }
}

// ===========================
// THEME & PROFILE WIRING (existing DOM in index.html)
// ===========================
function injectThemeStyles() {
  if (!document.querySelector('#theme-styles')) {
    const style = document.createElement('style');
    style.id = 'theme-styles';
    style.textContent = `
      :root {
        --primary: #3498db;
        --surface: #ffffff;
        --surface-2: #f6f6f6;
        --background: #fafafa;
        --border: #ddd;
        --text: #333;
        --muted: #666;
      }
      body.dark {
        --primary: #10b981;
        --surface: #1f2937;
        --surface-2: #374151;
        --background: #111827;
        --border: #4b5563;
        --text: #f9fafb;
        --muted: #9ca3af;
      }
    `;
    document.head.appendChild(style);
  }
}
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.onclick = () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    };
  }
}
function setupProfileModal() {
  const modal = document.getElementById('profileModal');
  const openBtn = document.getElementById('openProfileBtn');
  const closeBtn = document.getElementById('closeProfileBtn');
  const saveBtn = document.getElementById('saveProfileBtn');
  if (!modal) return;
  if (openBtn) openBtn.onclick = () => { modal.style.display = 'flex'; modal.setAttribute('aria-hidden', 'false'); };
  if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); };
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const nameInput = document.getElementById('profileName');
      const rateInput = document.getElementById('profileRate');
      const updated = { name: nameInput?.value?.trim(), defaultRate: parseFloat(rateInput?.value) || 0 };
      try {
        await updateProfileModal(updated);
        NotificationSystem.notifySuccess('Profile updated successfully');
        modal.style.display = 'none';
      } catch (err) {
        NotificationSystem.notifyError('Failed to update profile');
      }
    };
  }
  modal.onclick = (e) => { if (e.target === modal) { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); } };
}

// ===========================
// UI REFRESH
// ===========================
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
      if (res.status === 'rejected') console.error(`UI component ${i} failed:`, res.reason);
    });
    await StudentDropdownManager.forceRefresh();
  } catch (error) {
    console.error('Error refreshing UI:', error);
  }
}

// ===========================
// INITIALIZATION & AUTH
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  injectLoadingStyles();
  injectThemeStyles();
  initializeTheme();
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
        setupProfileModal();
        setupFloatingAddButton?.();
        updateHeaderStats?.();
        setupFormHandlers?.();

        let populated = false;
        for (let retry = 0; retry < 3 && !populated; retry++) {
          try {
            await StudentDropdownManager.forceRefresh();
            const students = await EnhancedCache.loadCollection('students');
            populated = students.length > 0;
            if (!populated) await new Promise(r => setTimeout(r, 1000));
          } catch {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        if (!populated) NotificationSystem.notifyWarning('No students found. Please add students to continue.');

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
            console.error('Periodic data refresh failed:', error);
          }
        }, 300000); // 5 minutes

        document.body.classList.remove('loading');
        document.body.removeAttribute('aria-busy');

        const displayName = user.email.split('@')[0];
        NotificationSystem.notifySuccess(`Welcome back, ${displayName}! All systems ready.`, 3000);
      } catch (error) {
        document.body.classList.remove('loading');
        document.body.removeAttribute('aria-busy');

        let msg = 'Failed to load application. ';
        if (error?.code === 'permission-denied') msg += 'Permission denied. Please check your Firebase rules.';
        else if (error?.code === 'unavailable') msg += 'Network unavailable. Using offline data.';
        else if (error?.message?.includes?.('quota')) msg += 'Firebase quota exceeded. Please try again later.';
        else msg += error?.message || 'Unknown error';
        NotificationSystem.notifyError(msg);

        try {
          EnhancedCache.loadCachedData?.();
          EnhancedStats.forceRefresh?.();
          NotificationSystem.notifyInfo('Loaded cached data. Some features may be limited.');
        } catch (cacheError) {
          console.error('Cache load also failed:', cacheError);
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
// REPORT SHORTCUTS
// ===========================
function showWeeklyBreakdown() {
  const today = new Date();
  generateWeeklyReport(getStartOfWeek(today), getEndOfWeek(today));
}
function showBiWeeklyBreakdown() {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 13 * 86400000);
  generateBiWeeklyReport(startDate, endDate);
}
function showMonthlyBreakdown() {
  const today = new Date();
  generateMonthlyReport(getStartOfMonth(today), getEndOfMonth(today));
}
function showSubjectBreakdown() {
  generateSubjectReport(cache.marks || [], cache.hours || []);
}

// ===========================
// GUARDED EXPORTS (no duplicates, no undefined)
// ===========================
(function exportGlobals() {
  const exports = {
    // Theme & Profile
    injectThemeStyles,
    initializeTheme,
    setupProfileModal,
    updateProfileModal,
    loadUserProfile,

    // Dropdowns
    StudentDropdownManager,
    populateStudentDropdowns,
    populateHoursStudentDropdown,
    populateAttendanceStudents,
    formatStudentDisplay,

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

    // Payment
    renderPaymentActivityWithEdit,
    recordPayment,

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

    // Data & UI
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

  Object.entries(exports).forEach(([key, ref]) => {
    if (typeof ref !== 'undefined') {
      window[key] = ref;
    } else {
      console.warn(`Export skipped: ${key} is undefined`);
    }
  });

  // Aliases without duplication
  if (typeof renderPaymentActivityWithEdit !== 'undefined') {
    window.renderPaymentActivity = renderPaymentActivityWithEdit;
  }

  console.log('✅ All functions exported to window object');
})();
