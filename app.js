// ===========================
// GLOBAL HELPERS
// ===========================
const DEBUG_MODE = true;
const cache = {};

// Safe number conversion
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
// NOTIFICATION SYSTEM
// ===========================
const NotificationSystem = {
  initNotificationStyles() {
    if (!document.querySelector('#notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        .notification { position: fixed; top: 20px; right: 20px; padding: 10px 15px;
          border-radius: 6px; color: #fff; z-index: 10000; }
        .notification.success { background: #10b981; }
        .notification.error { background: #ef4444; }
        .notification.warning { background: #f59e0b; }
        .notification.info { background: #3b82f6; }
      `;
      document.head.appendChild(style);
    }
  },
  notifySuccess(msg, timeout = 2000) { this._show(msg, 'success', timeout); },
  notifyError(msg, timeout = 2000) { this._show(msg, 'error', timeout); },
  notifyWarning(msg, timeout = 2000) { this._show(msg, 'warning', timeout); },
  notifyInfo(msg, timeout = 2000) { this._show(msg, 'info', timeout); },
  _show(msg, type, timeout) {
    const div = document.createElement('div');
    div.className = `notification ${type}`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), timeout);
  }
};

// ===========================
// CACHE MANAGER
// ===========================
const EnhancedCache = {
  _store: {},
  async loadCollection(name) {
    return this._store[name] || [];
  },
  saveToLocalStorageBulk(name, data) {
    localStorage.setItem(name, JSON.stringify(data));
    this._store[name] = data;
  },
  loadFromLocalStorage(name) {
    try {
      return JSON.parse(localStorage.getItem(name)) || [];
    } catch {
      return [];
    }
  },
  loadCachedData() {
    Object.keys(localStorage).forEach(key => {
      try { this._store[key] = JSON.parse(localStorage.getItem(key)); } catch {}
    });
  }
};

// ===========================
// PROFILE FUNCTIONS
// ===========================
async function loadUserProfile(uid) {
  console.log(`Loading profile for user ${uid}`);
  const profile = EnhancedCache.loadFromLocalStorage('profile') || { name: 'Default User', defaultRate: 0 };
  return profile;
}
async function updateProfileModal(updatedProfile) {
  console.log('Profile updated:', updatedProfile);
  EnhancedCache.saveToLocalStorageBulk('profile', updatedProfile);
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
function getStartOfWeek(date) { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); const start = new Date(d.setDate(diff)); start.setHours(0,0,0,0); return start; }
function getEndOfWeek(date) { const start = getStartOfWeek(date); const end = new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999); return end; }
function getStartOfMonth(date) { const d = new Date(date); const start = new Date(d.getFullYear(), d.getMonth(), 1); start.setHours(0,0,0,0); return start; }
function getEndOfMonth(date) { const d = new Date(date); const end = new Date(d.getFullYear(), d.getMonth()+1, 0); end.setHours(23,59,59,999); return end; }
function getWeekNumber(date) { const d = new Date(date); const firstDay = new Date(d.getFullYear(),0,1); const pastDays = Math.floor((d-firstDay)/86400000); return Math.ceil((pastDays+((firstDay.getDay()+6)%7)+1)/7); }
function isDateInRange(entryDate, startDate, endDate) { const ed = new Date(entryDate); return ed>=new Date(startDate)&&ed<=new Date(endDate); }

// ===========================
// DROPDOWN MANAGER (Hours tab fix)
// ===========================
const StudentDropdownManager = {
  async forceRefresh() {
    const students = await EnhancedCache.loadCollection('students');
    const selectors = ['#hoursStudent','#student','#marksStudent','#paymentStudent'];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => populateSingleDropdown(el, students));
    });
  }
};
function populateSingleDropdown(dropdown, students) {
  if (!dropdown) return;
  dropdown.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = students.length ? 'Select a student...' : 'No students available';
  defaultOption.disabled = true;
  defaultOption.selected = true;
  dropdown.appendChild(defaultOption);
  students.forEach(student => {
    const opt = document.createElement('option');
    opt.value = student.id;
    opt.textContent = formatStudentDisplay(student);
    dropdown.appendChild(opt);
  });
}

// ===========================
// REPORTS (Period & Subject tables)
// ===========================
function generatePeriodReport(hours) {
  const container = document.getElementById('periodReport');
  if (!container) return;
  if (!hours || !hours.length) {
    container.innerHTML = '<div class="empty-state">No hours data available</div>';
    return;
  }
  const now = new Date();
  const weekStart = getStartOfWeek(now);
  const monthStart = getStartOfMonth(now);
  const weeklyData = hours.filter(e => new Date(e.date||e.dateIso)>=weekStart);
  const monthlyData = hours.filter(e => new Date(e.date||e.dateIso)>=monthStart);
  const weeklyHours = weeklyData.reduce((s,e)=>s+safeNumber(e.hours),0);
  const weeklyEarnings = weeklyData.reduce((s,e)=>s+safeNumber(e.total||(e.hours||0)*(e.rate||0)),0);
  const monthlyHours = monthlyData.reduce((s,e)=>s+safeNumber(e.hours),0);
  const monthlyEarnings = monthlyData.reduce((s,e)=>s+safeNumber(e.total||(e.hours||0)*(e.rate||0)),0);
  const allHours = hours.reduce((s,e)=>s+safeNumber(e.hours),0);
  const allEarnings = hours.reduce((s,e)=>s+safeNumber(e.total||(e.hours||0)*(e.rate||0)),0);
  container.innerHTML = `
    <table class="report-table">
      <thead><tr><th>Period</th><th>Hours</th><th>Earnings</th><th>Sessions</th><th>Avg Rate/Hour</th></tr></thead>
      <tbody>
        <tr><td>This Week</td><td>${weeklyHours.toFixed(1)}</td><td>$${fmtMoney(weeklyEarnings)}</td><td>${weeklyData        .length}</td>
          <td>$${fmtMoney(weeklyHours > 0 ? weeklyEarnings / weeklyHours : 0)}</td>
        </tr>
        <tr><td>This Month</td><td>${monthlyHours.toFixed(1)}</td>
          <td>$${fmtMoney(monthlyEarnings)}</td><td>${monthlyData.length}</td>
          <td>$${fmtMoney(monthlyHours > 0 ? monthlyEarnings / monthlyHours : 0)}</td>
        </tr>
        <tr><td>All Time</td><td>${allHours.toFixed(1)}</td>
          <td>$${fmtMoney(allEarnings)}</td><td>${hours.length}</td>
          <td>$${fmtMoney(allHours > 0 ? allEarnings / allHours : 0)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

// Subject report table
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

  let html = `
    <table class="report-table">
      <thead><tr>
        <th>Subject</th><th>Avg Mark</th><th>Hours</th><th>Earnings</th><th>Sessions</th><th>Avg Rate</th>
      </tr></thead><tbody>
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
    container.innerHTML = '<div class="empty-state">No marks data available</div>';
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
    perf[sid].grades.push(mark.grade || 'N/A');
  });

  const rows = Object.entries(perf).map(([id, d]) => {
    const avg = d.total / d.count;
    const gCounts = {};
    d.grades.forEach(g => gCounts[g] = (gCounts[g] || 0) + 1);
    const common = Object.entries(gCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const obj = (students || []).find(s => s.id === id) || { name: id };
    const perfLabel = avg >= 80 ? 'Excellent' : avg >= 70 ? 'Good' : avg >= 60 ? 'Average' : 'Needs Improvement';
    return { student: formatStudentDisplay(obj), avg, totalMarks: d.count, subjects: Array.from(d.subjects).join(', '), common, perfLabel };
  }).sort((a, b) => b.avg - a.avg);

  let html = `
    <table class="report-table">
      <thead><tr>
        <th>Student</th><th>Avg Score</th><th>Total Marks</th><th>Subjects</th><th>Common Grade</th><th>Performance</th>
      </tr></thead><tbody>
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
    generatePeriodReport(hours);
    generateSubjectReport(marks, hours);
    generateStudentPerformanceReport(marks, students);
    return true;
  } catch (error) {
    console.error('Error loading report data:', error);
    ['periodReport','subjectReport','studentReport'].forEach(id => {
      const c = document.getElementById(id);
      if (c) c.innerHTML = '<div class="error">Error loading report data</div>';
    });
    return false;
  }
}

// ===========================
// INITIALIZATION & AUTH
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  injectLoadingStyles();
  injectThemeStyles();
  initializeTheme();
  NotificationSystem.initNotificationStyles();
  EnhancedCache.loadCachedData();

  setupTabNavigation();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      document.body.classList.add('loading');
      try {
        if (!localStorage.getItem('memberSince')) {
          localStorage.setItem('memberSince', new Date().toISOString());
        }
        await loadUserProfile(user.uid);
        const dataLoaded = await loadAllData();
        if (!dataLoaded) NotificationSystem.notifyWarning('Using cached data - some features may be limited');
        setupProfileModal();
        await StudentDropdownManager.forceRefresh();
        await loadReportData();
        document.body.classList.remove('loading');
        NotificationSystem.notifySuccess(`Welcome back, ${user.email.split('@')[0]}! All systems ready.`, 3000);
      } catch (error) {
        document.body.classList.remove('loading');
        NotificationSystem.notifyError('Initialization failed: ' + error.message);
      }
    } else {
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      setTimeout(() => { window.location.href = "auth.html"; }, 1000);
    }
  });
});

// ===========================
// EXPORTS
// ===========================
(function exportGlobals() {
  const exports = {
    NotificationSystem,
    EnhancedCache,
    loadUserProfile,
    updateProfileModal,
    StudentDropdownManager,
    populateSingleDropdown,
    populateHoursStudentDropdown,
    formatStudentDisplay,
    generatePeriodReport,
    generateSubjectReport,
    generateStudentPerformanceReport,
    loadReportData,
    switchTab,
    setupTabNavigation,
    injectThemeStyles,
    initializeTheme,
    setupProfileModal
  };
  Object.entries(exports).forEach(([key, ref]) => {
    if (typeof ref !== 'undefined') window[key  Object.entries(exports).forEach(([key, ref]) => {
    if (typeof ref !== 'undefined') {
      window[key] = ref;
    } else {
      console.warn(`Export skipped: ${key} is undefined`);
    }
  });

  console.log('✅ All functions exported to window object');
})();
