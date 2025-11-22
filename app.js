// Add this section to the WINDOW EXPORTS part at the end of app.js

// ===========================
// REPORT BREAKDOWN FUNCTIONS
// ===========================

function showWeeklyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current week
  const today = new Date();
  const startDate = getStartOfWeek(today);
  const endDate = getEndOfWeek(today);
  
  generateWeeklyReport(startDate, endDate);
}

function showBiWeeklyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current bi-weekly period (last 2 weeks)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 13); // Last 14 days (2 weeks)
  
  generateBiWeeklyReport(startDate, endDate);
}

function showMonthlyBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current month
  const today = new Date();
  const startDate = getStartOfMonth(today);
  const endDate = getEndOfMonth(today);
  
  generateMonthlyReport(startDate, endDate);
}

function showSubjectBreakdown() {
  const user = auth.currentUser;
  if (!user) return;

  // Default to current month
  const today = new Date();
  const startDate = getStartOfMonth(today);
  const endDate = getEndOfMonth(today);
  
  generateSubjectBreakdown(startDate, endDate);
}

// Date helper functions
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfWeek(date) {
  const start = getStartOfWeek(date);
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

function formatDateForDisplay(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

// Report generation functions
function generateWeeklyReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    
    console.log('🔍 Weekly Report - Looking for data between:', formatDateForDisplay(startDate), 'and', formatDateForDisplay(endDate));
    
    const weeklyData = hours.filter(entry => {
      if (!entry.date && !entry.dateIso) return false;
      
      const entryDate = entry.date || entry.dateIso;
      return isDateInRange(entryDate, startDate, endDate);
    });

    console.log('✅ Found entries for weekly report:', weeklyData.length);

    if (weeklyData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for week of ${formatDateForDisplay(startDate)}`);
      return;
    }

    const weeklyHours = weeklyData.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const weeklyTotal = weeklyData.reduce((sum, entry) => sum + (entry.total || 0), 0);
    
    const byDay = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayKey = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      byDay[dayKey] = 0;
    }
    
    weeklyData.forEach(entry => {
      const entryDate = new Date(entry.date || entry.dateIso);
      const dayKey = entryDate.toLocaleDateString('en-US', { 
        weekday: 'short', month: 'short', day: 'numeric' 
      });
      byDay[dayKey] = (byDay[dayKey] || 0) + (entry.hours || 0);
    });

    let breakdown = `Weekly Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
    breakdown += `Total Hours: ${weeklyHours.toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(weeklyTotal)}\n`;
    if (weeklyHours > 0) {
      breakdown += `Average Rate: $${fmtMoney(weeklyTotal / weeklyHours)}/hour\n`;
    }
    breakdown += '\nDaily Breakdown:\n';
    
    Object.entries(byDay).forEach(([day, hours]) => {
      breakdown += `${day}: ${hours.toFixed(1)} hours\n`;
    });

    showReportModal('Weekly Breakdown', breakdown);

  } catch (error) {
    console.error('Error generating weekly breakdown:', error);
    NotificationSystem.notifyError('Failed to generate weekly report');
  }
}

function generateBiWeeklyReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    
    console.log('🔍 Bi-Weekly Report - Looking for data between:', formatDateForDisplay(startDate), 'and', formatDateForDisplay(endDate));
    
    const biWeeklyData = hours.filter(entry => {
      if (!entry.date && !entry.dateIso) return false;
      
      const entryDate = entry.date || entry.dateIso;
      return isDateInRange(entryDate, startDate, endDate);
    });

    console.log('✅ Found entries for bi-weekly report:', biWeeklyData.length);

    if (biWeeklyData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for period ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`);
      return;
    }

    const totalHours = biWeeklyData.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const totalEarnings = biWeeklyData.reduce((sum, entry) => sum + (entry.total || 0), 0);
    
    const byWeek = {};
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(currentDate.getDate() + 6);
      const actualWeekEnd = weekEnd > endDate ? endDate : weekEnd;
      const weekKey = `Week of ${formatDateShort(currentDate)}`;
      
      const weekData = biWeeklyData.filter(entry => {
        if (!entry.date && !entry.dateIso) return false;
        const entryDate = entry.date || entry.dateIso;
        return isDateInRange(entryDate, currentDate, actualWeekEnd);
      });
      
      byWeek[weekKey] = {
        hours: weekData.reduce((sum, entry) => sum + (entry.hours || 0), 0),
        earnings: weekData.reduce((sum, entry) => sum + (entry.total || 0), 0),
        sessions: weekData.length
      };
      
      currentDate.setDate(currentDate.getDate() + 7);
    }

    let breakdown = `Bi-Weekly Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
    breakdown += `Total Hours: ${totalHours.toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(totalEarnings)}\n`;
    if (totalHours > 0) {
      breakdown += `Average Rate: $${fmtMoney(totalEarnings / totalHours)}/hour\n`;
    }
    breakdown += '\nWeekly Breakdown:\n';
    
    Object.entries(byWeek).forEach(([week, data]) => {
      breakdown += `${week}: ${data.hours.toFixed(1)} hours (${data.sessions} sessions) - $${fmtMoney(data.earnings)}\n`;
    });

    showReportModal('Bi-Weekly Breakdown', breakdown);

  } catch (error) {
    console.error('Error generating bi-weekly breakdown:', error);
    NotificationSystem.notifyError('Failed to generate bi-weekly report');
  }
}

function generateMonthlyReport(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    
    console.log('🔍 Monthly Report - Looking for data between:', formatDateForDisplay(startDate), 'and', formatDateForDisplay(endDate));
    
    const monthlyData = hours.filter(entry => {
      if (!entry.date && !entry.dateIso) return false;
      
      const entryDate = entry.date || entry.dateIso;
      return isDateInRange(entryDate, startDate, endDate);
    });

    console.log('✅ Found entries for monthly report:', monthlyData.length);

    if (monthlyData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for ${formatDateForDisplay(startDate)}`);
      return;
    }

    const monthlyHours = monthlyData.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const monthlyTotal = monthlyData.reduce((sum, entry) => sum + (entry.total || 0), 0);
    
    const byStudent = {};
    const byWorkType = {};
    const byWeek = {};
    
    monthlyData.forEach(entry => {
      // By student
      const student = entry.student || 'Unknown Student';
      if (!byStudent[student]) {
        byStudent[student] = { hours: 0, total: 0, sessions: 0 };
      }
      byStudent[student].hours += entry.hours || 0;
      byStudent[student].total += entry.total || 0;
      byStudent[student].sessions += 1;
      
      // By work type
      const workType = entry.workType || 'General';
      byWorkType[workType] = (byWorkType[workType] || 0) + (entry.hours || 0);
      
      // By week
      const entryDate = new Date(entry.date || entry.dateIso);
      const weekStart = getStartOfWeek(entryDate);
      const weekKey = `Week ${getWeekNumber(entryDate)} (${formatDateShort(weekStart)})`;
      byWeek[weekKey] = (byWeek[weekKey] || 0) + (entry.hours || 0);
    });

    let breakdown = `Monthly Breakdown (${formatDateForDisplay(startDate)}):\n\n`;
    breakdown += `Total Hours: ${monthlyHours.toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(monthlyTotal)}\n`;
    if (monthlyHours > 0) {
      breakdown += `Average Rate: $${fmtMoney(monthlyTotal / monthlyHours)}/hour\n`;
    }
    breakdown += '\nBy Student:\n';
    Object.entries(byStudent)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([student, data]) => {
        breakdown += `• ${student}: ${data.hours.toFixed(1)} hours (${data.sessions} sessions) - $${fmtMoney(data.total)}\n`;
      });

    breakdown += '\nBy Work Type:\n';
    Object.entries(byWorkType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([workType, hours]) => {
        breakdown += `• ${workType}: ${hours.toFixed(1)} hours\n`;
      });

    breakdown += '\nBy Week:\n';
    Object.entries(byWeek)
      .forEach(([week, hours]) => {
        breakdown += `• ${week}: ${hours.toFixed(1)} hours\n`;
      });

    showReportModal('Monthly Breakdown', breakdown);

  } catch (error) {
    console.error('Error generating monthly breakdown:', error);
    NotificationSystem.notifyError('Failed to generate monthly report');
  }
}

function generateSubjectBreakdown(startDate, endDate) {
  try {
    const hours = Array.isArray(cache.hours) ? cache.hours : [];
    
    console.log('🔍 Subject Breakdown - Looking for data between:', formatDateForDisplay(startDate), 'and', formatDateForDisplay(endDate));
    
    const periodData = hours.filter(entry => {
      if (!entry.date && !entry.dateIso) return false;
      
      const entryDate = entry.date || entry.dateIso;
      return isDateInRange(entryDate, startDate, endDate);
    });

    console.log('✅ Found entries for subject breakdown:', periodData.length);

    if (periodData.length === 0) {
      NotificationSystem.notifyInfo(`No hours logged for selected period`);
      return;
    }

    const bySubject = {};
    const byOrganization = {};
    const byStudent = {};
    
    periodData.forEach(entry => {
      // By subject
      const subject = entry.subject || 'General';
      if (!bySubject[subject]) {
        bySubject[subject] = { hours: 0, total: 0, sessions: 0, students: new Set() };
      }
      bySubject[subject].hours += entry.hours || 0;
      bySubject[subject].total += entry.total || 0;
      bySubject[subject].sessions += 1;
      if (entry.student) {
        bySubject[subject].students.add(entry.student);
      }
      
      // By organization
      const org = entry.organization || 'Unknown Organization';
      byOrganization[org] = (byOrganization[org] || 0) + (entry.hours || 0);
      
      // By student
      const student = entry.student || 'Unknown Student';
      byStudent[student] = (byStudent[student] || 0) + (entry.hours || 0);
    });

    let breakdown = `Subject Breakdown (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}):\n\n`;
    breakdown += `Total Hours: ${periodData.reduce((sum, entry) => sum + (entry.hours || 0), 0).toFixed(1)}\n`;
    breakdown += `Total Earnings: $${fmtMoney(periodData.reduce((sum, entry) => sum + (entry.total || 0), 0))}\n`;
    if (periodData.reduce((sum, entry) => sum + (entry.hours || 0), 0) > 0) {
      breakdown += `Average Rate: $${fmtMoney(periodData.reduce((sum, entry) => sum + (entry.total || 0), 0) / periodData.reduce((sum, entry) => sum + (entry.hours || 0), 0))}/hour\n`;
    }
    breakdown += '\nBy Subject:\n';
    Object.entries(bySubject)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([subject, data]) => {
        breakdown += `• ${subject}: ${data.hours.toFixed(1)} hours (${data.sessions} sessions) - $${fmtMoney(data.total)}\n`;
        if (data.students.size > 0) {
          breakdown += `  Students: ${Array.from(data.students).join(', ')}\n`;
        }
        breakdown += '\n';
      });

    breakdown += 'By Organization:\n';
    Object.entries(byOrganization)
      .sort((a, b) => b[1] - a[1])
      .forEach(([org, hours]) => {
        breakdown += `• ${org}: ${hours.toFixed(1)} hours\n`;
      });

    breakdown += '\nBy Student:\n';
    Object.entries(byStudent)
      .sort((a, b) => b[1] - a[1])
      .forEach(([student, hours]) => {
        breakdown += `• ${student}: ${hours.toFixed(1)} hours\n`;
      });

    showReportModal('Subject Breakdown', breakdown);

  } catch (error) {
    console.error('Error generating subject breakdown:', error);
    NotificationSystem.notifyError('Failed to generate subject report');
  }
}

function formatDateShort(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function showReportModal(title, content) {
  const modal = document.createElement('div');
  modal.className = 'modal';
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
  
  closeBtn.onclick = () => {
    document.body.removeChild(modal);
  };
  
  modalContent.appendChild(modalTitle);
  modalContent.appendChild(reportContent);
  modalContent.appendChild(closeBtn);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };
}

// ===========================
// WINDOW EXPORTS - UPDATED
// ===========================

window.selectAllStudents = selectAllStudents;
window.loadReportData = loadReportData;
window.switchTab = switchTab;
window.NotificationSystem = NotificationSystem;
window.calculateTotalPay = calculateTotalPay;
window.EnhancedStats = EnhancedStats;

// Add the new report functions to window exports
window.showWeeklyBreakdown = showWeeklyBreakdown;
window.showBiWeeklyBreakdown = showBiWeeklyBreakdown;
window.showMonthlyBreakdown = showMonthlyBreakdown;
window.showSubjectBreakdown = showSubjectBreakdown;

// Placeholder functions for edit/delete operations
window.editStudent = (id) => NotificationSystem.notifyInfo(`Edit student ${id} - Feature coming soon`);
window.deleteStudent = (id) => {
  if (confirm('Are you sure you want to delete this student?')) {
    NotificationSystem.notifyInfo(`Delete student ${id} - Feature coming soon`);
  }
};

window.editMark = (id) => NotificationSystem.notifyInfo(`Edit mark ${id} - Feature coming soon`);
window.deleteMark = (id) => {
  if (confirm('Are you sure you want to delete this mark?')) {
    NotificationSystem.notifyInfo(`Delete mark ${id} - Feature coming soon`);
  }
};

console.log('✅ Worklog App initialized successfully with all report functions');
