// ===========================
// MISSING IMPORTS & INITIALIZATION
// ===========================

import { 
  writeBatch,
  query, 
  orderBy,
  where,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ===========================
// SYNC BAR FUNCTIONALITY
// ===========================

let autoSyncInterval = null;
let isAutoSyncEnabled = false;

// ===========================
// NOTIFICATION SYSTEM
// ===========================

const NotificationSystem = {
  // Create notification element
  createNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="NotificationSystem.close(this.parentElement.parentElement)">×</button>
      </div>
    `;
    
    return notification;
  },

  // Get icon for notification type
  getIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  },

  // Show notification
  show(message, type = 'info', duration = 5000) {
    // Remove existing notifications
    this.clearAll();
    
    const notification = this.createNotification(message, type);
    document.body.appendChild(notification);
    
    // Add show class for animation
    setTimeout(() => {
      notification.classList.add('notification-show');
    }, 10);
    
    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.close(notification);
      }, duration);
    }
    
    return notification;
  },

  // Close specific notification
  close(notification) {
    if (notification && notification.parentNode) {
      notification.classList.remove('notification-show');
      notification.classList.add('notification-hide');
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  },

  // Clear all notifications
  clearAll() {
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
      this.close(notification);
    });
  },

  // Quick methods for common types
  success(message, duration = 5000) {
    return this.show(message, 'success', duration);
  },

  error(message, duration = 5000) {
    return this.show(message, 'error', duration);
  },

  warning(message, duration = 5000) {
    return this.show(message, 'warning', duration);
  },

  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }
};

// Initialize notification styles
function initializeNotificationStyles() {
  if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        min-width: 300px;
        max-width: 500px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        transform: translateX(400px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .notification-show {
        transform: translateX(0);
        opacity: 1;
      }

      .notification-hide {
        transform: translateX(400px);
        opacity: 0;
      }

      .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
      }

      .notification-icon {
        font-size: 1.2em;
        flex-shrink: 0;
      }

      .notification-message {
        flex: 1;
        font-weight: 500;
        line-height: 1.4;
        color: var(--text);
      }

      .notification-close {
        background: none;
        border: none;
        font-size: 1.5em;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: var(--muted);
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      .notification-close:hover {
        background: var(--border-light);
        color: var(--text);
      }

      /* Notification type styles */
      .notification-success {
        border-left: 4px solid var(--success);
      }

      .notification-error {
        border-left: 4px solid var(--error);
      }

      .notification-warning {
        border-left: 4px solid var(--warning);
      }

      .notification-info {
        border-left: 4px solid var(--info);
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .notification {
          left: 20px;
          right: 20px;
          min-width: auto;
          max-width: none;
          transform: translateY(-100px);
        }

        .notification-show {
          transform: translateY(0);
        }

        .notification-hide {
          transform: translateY(-100px);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// ===========================
// SYNC BAR FUNCTIONALITY (Updated to use new notification system)
// ===========================
// 1. Manual to Auto-Sync Toggle
function setupAutoSyncToggle() {
  const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
  const autoSyncText = document.getElementById('autoSyncText');
  const syncIndicator = document.getElementById('syncIndicator');

  if (autoSyncCheckbox) {
    autoSyncCheckbox.addEventListener('change', function() {
      isAutoSyncEnabled = this.checked;
      
      if (isAutoSyncEnabled) {
        autoSyncText.textContent = 'Auto';
        if (syncIndicator) {
          syncIndicator.style.backgroundColor = '#10b981';
          syncIndicator.classList.add('sync-connected');
        }
        startAutoSync();
        NotificationSystem.success('Auto-sync enabled - syncing every 60 seconds');
      } else {
        autoSyncText.textContent = 'Manual';
        if (syncIndicator) {
          syncIndicator.style.backgroundColor = '#ef4444';
          syncIndicator.classList.remove('sync-connected');
        }
        stopAutoSync();
        NotificationSystem.info('Auto-sync disabled');
      }
    });

    // Initialize state
    autoSyncCheckbox.checked = false;
    autoSyncText.textContent = 'Manual';
    if (syncIndicator) {
      syncIndicator.style.backgroundColor = '#ef4444';
    }
  }
}

function startAutoSync() {
  stopAutoSync();
  performSync('auto');
  autoSyncInterval = setInterval(() => performSync('auto'), 60000);
}

function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}

// 2. Sync Now Button
function setupSyncNowButton() {
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      await performSync('manual');
    });
  }
}

// Main sync function
async function performSync(mode = 'manual') {
  const user = auth.currentUser;
  if (!user) {
    NotificationSystem.error('Please log in to sync');
    return;
  }

  const syncSpinner = document.getElementById('syncSpinner');
  const syncMessageLine = document.getElementById('syncMessageLine');
  const syncIndicator = document.getElementById('syncIndicator');

  try {
    // Show syncing state
    if (syncSpinner) syncSpinner.style.display = 'inline-block';
    if (syncIndicator) {
      syncIndicator.classList.remove('sync-connected', 'sync-error');
      syncIndicator.classList.add('sync-active');
    }
    if (syncMessageLine) {
      syncMessageLine.textContent = `Status: ${mode === 'auto' ? 'Auto-syncing' : 'Manual syncing'}...`;
    }

    // Perform sync operations
    await Promise.all([
      recalcSummaryStats(user.uid),
      loadUserStats(user.uid),
      renderStudents(),
      renderRecentHours(),
      renderRecentMarks(),
      renderAttendanceRecent(),
      renderPaymentActivity(),
      renderStudentBalances(),
      renderOverviewReports()
    ]);

    // Update sync timestamp
    const now = new Date().toLocaleString();
    if (syncMessageLine) syncMessageLine.textContent = `Status: Last synced at ${now}`;
    if (document.getElementById('statUpdated')) {
      document.getElementById('statUpdated').textContent = now;
    }

    // Show success state
    if (syncIndicator) {
      syncIndicator.classList.remove('sync-active');
      if (isAutoSyncEnabled) {
        syncIndicator.classList.add('sync-connected');
      }
    }

    NotificationSystem.success(`${mode === 'auto' ? 'Auto-' : ''}Sync completed successfully`);

  } catch (error) {
    console.error(`❌ ${mode} sync failed:`, error);
    
    if (syncIndicator) {
      syncIndicator.classList.remove('sync-active', 'sync-connected');
      syncIndicator.classList.add('sync-error');
    }
    if (syncMessageLine) {
      syncMessageLine.textContent = `Status: Sync failed - ${error.message}`;
    }
    
    NotificationSystem.error(`Sync failed: ${error.message}`);
  } finally {
    if (syncSpinner) syncSpinner.style.display = 'none';
  }
}

// 3. Export Cloud Button
function setupExportCloudButton() {
  const exportCloudBtn = document.getElementById('exportCloudBtn');
  if (exportCloudBtn) {
    exportCloudBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) {
        NotificationSystem.error('Please log in to export data');
        return;
      }

      try {
        NotificationSystem.info('Starting cloud export...');
        const backupRef = doc(db, "backups", user.uid);
        const backupData = await createBackupData(user.uid);
        
        await setDoc(backupRef, {
          ...backupData,
          exportedAt: new Date().toISOString(),
          version: '1.0',
          user: user.uid
        });

        NotificationSystem.success('Cloud export completed successfully');
      } catch (error) {
        console.error('❌ Cloud export failed:', error);
        NotificationSystem.error(`Export failed: ${error.message}`);
      }
    });
  }
}

// 4. Import Cloud Button
function setupImportCloudButton() {
  const importCloudBtn = document.getElementById('importCloudBtn');
  if (importCloudBtn) {
    importCloudBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) {
        NotificationSystem.error('Please log in to import data');
        return;
      }

      const proceed = confirm('⚠️ This will overwrite your current data with the cloud backup. This action cannot be undone. Continue?');
      if (!proceed) return;

      try {
        NotificationSystem.info('Starting cloud import...');
        const backupRef = doc(db, "backups", user.uid);
        const backupSnap = await getDoc(backupRef);

        if (!backupSnap.exists()) {
          NotificationSystem.warning('No cloud backup found for your account');
          return;
        }

        const backupData = backupSnap.data();
        await restoreBackupData(user.uid, backupData);
        NotificationSystem.success('Cloud import completed successfully');
        await performSync('manual');
        
      } catch (error) {
        console.error('❌ Cloud import failed:', error);
        NotificationSystem.error(`Import failed: ${error.message}`);
      }
    });
  }
}

// 5. Sync Stats Button
function setupSyncStatsButton() {
  const syncStatsBtn = document.getElementById('syncStatsBtn');
  if (syncStatsBtn) {
    syncStatsBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) {
        NotificationSystem.error('Please log in to sync stats');
        return;
      }

      try {
        NotificationSystem.info('Syncing statistics...');
        await recalcSummaryStats(user.uid);
        await loadUserStats(user.uid);
        NotificationSystem.success('Statistics synced successfully');
      } catch (error) {
        console.error('❌ Stats sync failed:', error);
        NotificationSystem.error(`Stats sync failed: ${error.message}`);
      }
    });
  }
}

// 6. Export Data Button (Local JSON)
function setupExportDataButton() {
  const exportDataBtn = document.getElementById('exportDataBtn');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) {
        NotificationSystem.error('Please log in to export data');
        return;
      }

      try {
        NotificationSystem.info('Preparing data export...');
        const exportData = await createBackupData(user.uid);
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        NotificationSystem.success('Data exported successfully');
      } catch (error) {
        console.error('❌ Local export failed:', error);
        NotificationSystem.error(`Export failed: ${error.message}`);
      }
    });
  }
}

// 7. Import Data Button (Local JSON)
function setupImportDataButton() {
  const importDataBtn = document.getElementById('importDataBtn');
  if (importDataBtn) {
    importDataBtn.addEventListener('click', () => {
      const user = auth.currentUser;
      if (!user) {
        NotificationSystem.error('Please log in to import data');
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const proceed = confirm('⚠️ This will overwrite your current data with the imported file. This action cannot be undone. Continue?');
        if (!proceed) return;

        try {
          NotificationSystem.info('Importing data...');
          const fileText = await file.text();
          const importData = JSON.parse(fileText);
          
          if (!importData.metadata || !importData.students || !importData.hours) {
            throw new Error('Invalid backup file format');
          }

          await restoreBackupData(user.uid, importData);
          NotificationSystem.success('Data imported successfully');
          await performSync('manual');
          
        } catch (error) {
          console.error('❌ Local import failed:', error);
          NotificationSystem.error(`Import failed: ${error.message}`);
        }
      };
      
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  }
}

// 8. Clear All Button
function setupClearAllButton() {
  const clearDataBtn = document.getElementById('clearDataBtn');
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) {
        NotificationSystem.error('Please log in to clear data');
        return;
      }

      const proceed = confirm('⚠️🚨 DANGER ZONE 🚨⚠️\n\nThis will PERMANENTLY DELETE ALL your data including:\n• All students\n• All hours worked\n• All marks & assessments\n• All attendance records\n• All payment records\n\nThis action cannot be undone!\n\nType "DELETE ALL" to confirm:');
      
      if (proceed && prompt('Type "DELETE ALL" to confirm:') === 'DELETE ALL') {
        try {
          NotificationSystem.warning('Clearing all data...');
          await clearAllUserData(user.uid);
          NotificationSystem.success('All data cleared successfully');
          await performSync('manual');
        } catch (error) {
          console.error('❌ Clear data failed:', error);
          NotificationSystem.error(`Clear failed: ${error.message}`);
        }
      } else {
        NotificationSystem.info('Data clearance cancelled');
      }
    });
  }
}

// ===========================
// BACKUP & RESTORE UTILITIES
// ===========================

async function createBackupData(uid) {
  // Get all user data
  const [statsSnap, studentsSnap, hoursSnap, paymentsSnap, marksSnap, attendanceSnap] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDocs(collection(db, "users", uid, "students")),
    getDocs(collection(db, "users", uid, "hours")),
    getDocs(collection(db, "users", uid, "payments")),
    getDocs(collection(db, "users", uid, "marks")),
    getDocs(collection(db, "users", uid, "attendance"))
  ]);

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      user: uid,
      recordCounts: {
        students: studentsSnap.size,
        hours: hoursSnap.size,
        payments: paymentsSnap.size,
        marks: marksSnap.size,
        attendance: attendanceSnap.size
      }
    },
    stats: statsSnap.exists() ? statsSnap.data() : {},
    students: studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    hours: hoursSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    payments: paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    marks: marksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    attendance: attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  };
}

async function restoreBackupData(uid, backupData) {
  const batch = writeBatch(db);
  
  // Clear existing data first
  await clearAllUserData(uid);
  
  // Restore stats
  if (backupData.stats) {
    const statsRef = doc(db, "users", uid);
    batch.set(statsRef, backupData.stats);
  }
  
  // Restore students
  if (backupData.students && Array.isArray(backupData.students)) {
    backupData.students.forEach(student => {
      const studentRef = doc(db, "users", uid, "students", student.id);
      batch.set(studentRef, student);
    });
  }
  
  // Restore hours
  if (backupData.hours && Array.isArray(backupData.hours)) {
    backupData.hours.forEach(hour => {
      const hourRef = doc(collection(db, "users", uid, "hours"));
      batch.set(hourRef, hour);
    });
  }
  
  // Restore payments
  if (backupData.payments && Array.isArray(backupData.payments)) {
    backupData.payments.forEach(payment => {
      const paymentRef = doc(collection(db, "users", uid, "payments"));
      batch.set(paymentRef, payment);
    });
  }
  
  // Restore marks
  if (backupData.marks && Array.isArray(backupData.marks)) {
    backupData.marks.forEach(mark => {
      const markRef = doc(collection(db, "users", uid, "marks"));
      batch.set(markRef, mark);
    });
  }
  
  // Restore attendance
  if (backupData.attendance && Array.isArray(backupData.attendance)) {
    backupData.attendance.forEach(attendance => {
      const attendanceRef = doc(collection(db, "users", uid, "attendance"));
      batch.set(attendanceRef, attendance);
    });
  }
  
  await batch.commit();
  console.log('✅ Backup data restored');
}

async function clearAllUserData(uid) {
  try {
    // Collections to clear
    const collections = ['students', 'hours', 'payments', 'marks', 'attendance'];
    
    for (const collectionName of collections) {
      const colRef = collection(db, "users", uid, collectionName);
      const snapshot = await getDocs(colRef);
      
      // Use batches to delete in chunks
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (snapshot.docs.length > 0) {
        await batch.commit();
      }
    }
    
    // Reset stats
    const statsRef = doc(db, "users", uid);
    await setDoc(statsRef, {
      students: 0,
      hours: 0,
      earnings: 0,
      lastSync: new Date().toLocaleString()
    });
    
    console.log('✅ All user data cleared');
  } catch (error) {
    console.error('❌ Error clearing user data:', error);
    throw error;
  }
}

// ===========================
// SYNC BAR MODULE
// ===========================

const SyncBar = {
  autoSyncInterval: null,
  isAutoSyncEnabled: false,

  // Initialize all sync bar functionality
  init() {
    this.initNotificationStyles();
    this.setupAutoSyncToggle();
    this.setupSyncNowButton();
    this.setupExportCloudButton();
    this.setupImportCloudButton();
    this.setupSyncStatsButton();
    this.setupExportDataButton();
    this.setupImportDataButton();
    this.setupClearAllButton();
    
    console.log('✅ Sync bar initialized');
  },

  // Notification System
  initNotificationStyles() {
    if (!document.querySelector('#notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          min-width: 300px;
          max-width: 500px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          z-index: 10000;
          transform: translateX(400px);
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .notification-show {
          transform: translateX(0);
          opacity: 1;
        }

        .notification-hide {
          transform: translateX(400px);
          opacity: 0;
        }

        .notification-content {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
        }

        .notification-icon {
          font-size: 1.2em;
          flex-shrink: 0;
        }

        .notification-message {
          flex: 1;
          font-weight: 500;
          line-height: 1.4;
          color: var(--text);
        }

        .notification-close {
          background: none;
          border: none;
          font-size: 1.5em;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          color: var(--muted);
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .notification-close:hover {
          background: var(--border-light);
          color: var(--text);
        }

        .notification-success {
          border-left: 4px solid var(--success);
        }

        .notification-error {
          border-left: 4px solid var(--error);
        }

        .notification-warning {
          border-left: 4px solid var(--warning);
        }

        .notification-info {
          border-left: 4px solid var(--info);
        }

        @media (max-width: 768px) {
          .notification {
            left: 20px;
            right: 20px;
            min-width: auto;
            max-width: none;
            transform: translateY(-100px);
          }

          .notification-show {
            transform: translateY(0);
          }

          .notification-hide {
            transform: translateY(-100px);
          }
        }
      `;
      document.head.appendChild(style);
    }
  },

  showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notifications
    this.clearNotifications();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="SyncBar.closeNotification(this.parentElement.parentElement)">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.add('notification-show');
    }, 10);
    
    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        this.closeNotification(notification);
      }, duration);
    }
    
    return notification;
  },

  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  },

  closeNotification(notification) {
    if (notification && notification.parentNode) {
      notification.classList.remove('notification-show');
      notification.classList.add('notification-hide');
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  },

  clearNotifications() {
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
      this.closeNotification(notification);
    });
  },

  // Quick notification methods
  notifySuccess(message, duration = 5000) {
    return this.showNotification(message, 'success', duration);
  },

  notifyError(message, duration = 5000) {
    return this.showNotification(message, 'error', duration);
  },

  notifyWarning(message, duration = 5000) {
    return this.showNotification(message, 'warning', duration);
  },

  notifyInfo(message, duration = 5000) {
    return this.showNotification(message, 'info', duration);
  },

  // 1. Auto-Sync Toggle
  setupAutoSyncToggle() {
    const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
    const autoSyncText = document.getElementById('autoSyncText');
    const syncIndicator = document.getElementById('syncIndicator');

    if (autoSyncCheckbox) {
      autoSyncCheckbox.addEventListener('change', (e) => {
        this.isAutoSyncEnabled = e.target.checked;
        
        if (this.isAutoSyncEnabled) {
          autoSyncText.textContent = 'Auto';
          if (syncIndicator) {
            syncIndicator.style.backgroundColor = '#10b981';
            syncIndicator.classList.add('sync-connected');
          }
          this.startAutoSync();
          this.notifySuccess('Auto-sync enabled - syncing every 60 seconds');
        } else {
          autoSyncText.textContent = 'Manual';
          if (syncIndicator) {
            syncIndicator.style.backgroundColor = '#ef4444';
            syncIndicator.classList.remove('sync-connected');
          }
          this.stopAutoSync();
          this.notifyInfo('Auto-sync disabled');
        }
      });

      // Initialize state
      autoSyncCheckbox.checked = false;
      autoSyncText.textContent = 'Manual';
      if (syncIndicator) {
        syncIndicator.style.backgroundColor = '#ef4444';
      }
    }
  },

  startAutoSync() {
    this.stopAutoSync();
    this.performSync('auto');
    this.autoSyncInterval = setInterval(() => this.performSync('auto'), 60000);
  },

  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  },

  // 2. Sync Now Button
  setupSyncNowButton() {
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        await this.performSync('manual');
      });
    }
  },

  // Main sync function
  async performSync(mode = 'manual') {
    const user = auth.currentUser;
    if (!user) {
      this.notifyError('Please log in to sync');
      return;
    }

    const syncSpinner = document.getElementById('syncSpinner');
    const syncMessageLine = document.getElementById('syncMessageLine');
    const syncIndicator = document.getElementById('syncIndicator');

    try {
      // Show syncing state
      if (syncSpinner) syncSpinner.style.display = 'inline-block';
      if (syncIndicator) {
        syncIndicator.classList.remove('sync-connected', 'sync-error');
        syncIndicator.classList.add('sync-active');
      }
      if (syncMessageLine) {
        syncMessageLine.textContent = `Status: ${mode === 'auto' ? 'Auto-syncing' : 'Manual syncing'}...`;
      }

      // Perform sync operations
      await Promise.all([
        recalcSummaryStats(user.uid),
        loadUserStats(user.uid),
        renderStudents(),
        renderRecentHours(),
        renderRecentMarks(),
        renderAttendanceRecent(),
        renderPaymentActivity(),
        renderStudentBalances(),
        renderOverviewReports()
      ]);

      // Update sync timestamp
      const now = new Date().toLocaleString();
      if (syncMessageLine) syncMessageLine.textContent = `Status: Last synced at ${now}`;
      if (document.getElementById('statUpdated')) {
        document.getElementById('statUpdated').textContent = now;
      }

      // Show success state
      if (syncIndicator) {
        syncIndicator.classList.remove('sync-active');
        if (this.isAutoSyncEnabled) {
          syncIndicator.classList.add('sync-connected');
        }
      }

      this.notifySuccess(`${mode === 'auto' ? 'Auto-' : ''}Sync completed successfully`);

    } catch (error) {
      console.error(`❌ ${mode} sync failed:`, error);
      
      if (syncIndicator) {
        syncIndicator.classList.remove('sync-active', 'sync-connected');
        syncIndicator.classList.add('sync-error');
      }
      if (syncMessageLine) {
        syncMessageLine.textContent = `Status: Sync failed - ${error.message}`;
      }
      
      this.notifyError(`Sync failed: ${error.message}`);
    } finally {
      if (syncSpinner) syncSpinner.style.display = 'none';
    }
  },

  // 3. Export Cloud Button
  setupExportCloudButton() {
    const exportCloudBtn = document.getElementById('exportCloudBtn');
    if (exportCloudBtn) {
      exportCloudBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          this.notifyError('Please log in to export data');
          return;
        }

        try {
          this.notifyInfo('Starting cloud export...');
          const backupRef = doc(db, "backups", user.uid);
          const backupData = await this.createBackupData(user.uid);
          
          await setDoc(backupRef, {
            ...backupData,
            exportedAt: new Date().toISOString(),
            version: '1.0',
            user: user.uid
          });

          this.notifySuccess('Cloud export completed successfully');
        } catch (error) {
          console.error('❌ Cloud export failed:', error);
          this.notifyError(`Export failed: ${error.message}`);
        }
      });
    }
  },

  // 4. Import Cloud Button
  setupImportCloudButton() {
    const importCloudBtn = document.getElementById('importCloudBtn');
    if (importCloudBtn) {
      importCloudBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          this.notifyError('Please log in to import data');
          return;
        }

        const proceed = confirm('⚠️ This will overwrite your current data with the cloud backup. This action cannot be undone. Continue?');
        if (!proceed) return;

        try {
          this.notifyInfo('Starting cloud import...');
          const backupRef = doc(db, "backups", user.uid);
          const backupSnap = await getDoc(backupRef);

          if (!backupSnap.exists()) {
            this.notifyWarning('No cloud backup found for your account');
            return;
          }

          const backupData = backupSnap.data();
          await this.restoreBackupData(user.uid, backupData);
          this.notifySuccess('Cloud import completed successfully');
          await this.performSync('manual');
          
        } catch (error) {
          console.error('❌ Cloud import failed:', error);
          this.notifyError(`Import failed: ${error.message}`);
        }
      });
    }
  },

  // 5. Sync Stats Button
  setupSyncStatsButton() {
    const syncStatsBtn = document.getElementById('syncStatsBtn');
    if (syncStatsBtn) {
      syncStatsBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          this.notifyError('Please log in to sync stats');
          return;
        }

        try {
          this.notifyInfo('Syncing statistics...');
          await recalcSummaryStats(user.uid);
          await loadUserStats(user.uid);
          this.notifySuccess('Statistics synced successfully');
        } catch (error) {
          console.error('❌ Stats sync failed:', error);
          this.notifyError(`Stats sync failed: ${error.message}`);
        }
      });
    }
  },

  // 6. Export Data Button (Local JSON)
  setupExportDataButton() {
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          this.notifyError('Please log in to export data');
          return;
        }

        try {
          this.notifyInfo('Preparing data export...');
          const exportData = await this.createBackupData(user.uid);
          
          const dataStr = JSON.stringify(exportData, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          this.notifySuccess('Data exported successfully');
        } catch (error) {
          console.error('❌ Local export failed:', error);
          this.notifyError(`Export failed: ${error.message}`);
        }
      });
    }
  },

  // 7. Import Data Button (Local JSON)
  setupImportDataButton() {
    const importDataBtn = document.getElementById('importDataBtn');
    if (importDataBtn) {
      importDataBtn.addEventListener('click', () => {
        const user = auth.currentUser;
        if (!user) {
          this.notifyError('Please log in to import data');
          return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const proceed = confirm('⚠️ This will overwrite your current data with the imported file. This action cannot be undone. Continue?');
          if (!proceed) return;

          try {
            this.notifyInfo('Importing data...');
            const fileText = await file.text();
            const importData = JSON.parse(fileText);
            
            if (!importData.metadata || !importData.students || !importData.hours) {
              throw new Error('Invalid backup file format');
            }

            await this.restoreBackupData(user.uid, importData);
            this.notifySuccess('Data imported successfully');
            await this.performSync('manual');
            
          } catch (error) {
            console.error('❌ Local import failed:', error);
            this.notifyError(`Import failed: ${error.message}`);
          }
        };
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
      });
    }
  },

  // 8. Clear All Button
  setupClearAllButton() {
    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
          this.notifyError('Please log in to clear data');
          return;
        }

        const proceed = confirm('⚠️🚨 DANGER ZONE 🚨⚠️\n\nThis will PERMANENTLY DELETE ALL your data including:\n• All students\n• All hours worked\n• All marks & assessments\n• All attendance records\n• All payment records\n\nThis action cannot be undone!\n\nType "DELETE ALL" to confirm:');
        
        if (proceed && prompt('Type "DELETE ALL" to confirm:') === 'DELETE ALL') {
          try {
            this.notifyWarning('Clearing all data...');
            await this.clearAllUserData(user.uid);
            this.notifySuccess('All data cleared successfully');
            await this.performSync('manual');
          } catch (error) {
            console.error('❌ Clear data failed:', error);
            this.notifyError(`Clear failed: ${error.message}`);
          }
        } else {
          this.notifyInfo('Data clearance cancelled');
        }
      });
    }
  },

  // Backup & Restore Utilities
  async createBackupData(uid) {
    const [statsSnap, studentsSnap, hoursSnap, paymentsSnap, marksSnap, attendanceSnap] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDocs(collection(db, "users", uid, "students")),
      getDocs(collection(db, "users", uid, "hours")),
      getDocs(collection(db, "users", uid, "payments")),
      getDocs(collection(db, "users", uid, "marks")),
      getDocs(collection(db, "users", uid, "attendance"))
    ]);

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        user: uid,
        recordCounts: {
          students: studentsSnap.size,
          hours: hoursSnap.size,
          payments: paymentsSnap.size,
          marks: marksSnap.size,
          attendance: attendanceSnap.size
        }
      },
      stats: statsSnap.exists() ? statsSnap.data() : {},
      students: studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      hours: hoursSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      payments: paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      marks: marksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      attendance: attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
  },

  async restoreBackupData(uid, backupData) {
    const batch = writeBatch(db);
    
    // Clear existing data first
    await this.clearAllUserData(uid);
    
    // Restore stats
    if (backupData.stats) {
      const statsRef = doc(db, "users", uid);
      batch.set(statsRef, backupData.stats);
    }
    
    // Restore students
    if (backupData.students && Array.isArray(backupData.students)) {
      backupData.students.forEach(student => {
        const studentRef = doc(db, "users", uid, "students", student.id);
        batch.set(studentRef, student);
      });
    }
    
    // Restore other collections
    ['hours', 'payments', 'marks', 'attendance'].forEach(collectionName => {
      if (backupData[collectionName] && Array.isArray(backupData[collectionName])) {
        backupData[collectionName].forEach(item => {
          const itemRef = doc(collection(db, "users", uid, collectionName));
          batch.set(itemRef, item);
        });
      }
    });
    
    await batch.commit();
    console.log('✅ Backup data restored');
  },

  async clearAllUserData(uid) {
    try {
      const collections = ['students', 'hours', 'payments', 'marks', 'attendance'];
      
      for (const collectionName of collections) {
        const colRef = collection(db, "users", uid, collectionName);
        const snapshot = await getDocs(colRef);
        
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        if (snapshot.docs.length > 0) {
          await batch.commit();
        }
      }
      
      // Reset stats
      const statsRef = doc(db, "users", uid);
      await setDoc(statsRef, {
        students: 0,
        hours: 0,
        earnings: 0,
        lastSync: new Date().toLocaleString()
      });
      
      console.log('✅ All user data cleared');
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
      throw error;
    }
  }
};

// ===========================
// UI EVENT BINDINGS
// ===========================

function bindUiEvents() {
  console.log('🔧 Binding UI events...');
  
  // Theme toggle
  const themeToggle = document.querySelector('.theme-toggle button');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Form submissions prevention
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => e.preventDefault());
  });
  
  // Auto-calculate total in hours form
  const hoursInput = document.getElementById('hoursWorked');
  const rateInput = document.getElementById('baseRate');
  const workTypeSelect = document.getElementById('workType');
  
  const calculateTotal = () => {
    const hours = parseFloat(hoursInput?.value) || 0;
    const rate = parseFloat(rateInput?.value) || 0;
    const workType = workTypeSelect?.value || "hourly";
    const totalEl = document.getElementById('totalPay');
    
    if (totalEl) {
      const total = workType === "hourly" ? hours * rate : rate;
      if ("value" in totalEl) {
        totalEl.value = fmtMoney(total);
      } else {
        totalEl.textContent = fmtMoney(total);
      }
    }
  };

  if (hoursInput) hoursInput.addEventListener('input', calculateTotal);
  if (rateInput) rateInput.addEventListener('input', calculateTotal);
  if (workTypeSelect) workTypeSelect.addEventListener('change', calculateTotal);
  
  // Real-time percentage calculation for marks
  const scoreInput = document.getElementById('marksScore');
  const maxInput = document.getElementById('marksMax');
  if (scoreInput) scoreInput.addEventListener('input', updateMarksPercentage);
  if (maxInput) maxInput.addEventListener('input', updateMarksPercentage);
  
  console.log('✅ UI events bound');
}

function initEventListeners() {
  console.log('🔧 Initializing event listeners...');
  
  // Set default dates to today
  const dateInputs = document.querySelectorAll('input[type="date"]');
  const today = new Date().toISOString().split('T')[0];
  dateInputs.forEach(input => {
    if (!input.value) {
      input.value = today;
    }
  });
  
  // Initialize student dropdowns
  loadStudentsForDropdowns();
  
  console.log('✅ Event listeners initialized');
}

// ===========================
// THEME MANAGEMENT
// ===========================

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  console.log(`🎨 Theme changed to ${newTheme}`);
}

function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  console.log(`🎨 Theme initialized to ${savedTheme}`);
}

// ===========================
// TAB MANAGEMENT
// ===========================

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tabcontent');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');

      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));

      // Hide all tabcontent
      tabContents.forEach(tc => tc.style.display = 'none');

      // Activate clicked tab
      tab.classList.add('active');

      // Show the selected tab content
      const selected = document.getElementById(target);
      if (selected) {
        selected.style.display = 'block';
        console.log(`📑 Switched to ${target} tab`);
      }
    });
  });

  // Default: show the first tab's content
  const firstActive = document.querySelector('.tab.active');
  if (firstActive) {
    const target = firstActive.getAttribute('data-tab');
    const selected = document.getElementById(target);
    if (selected) selected.style.display = 'block';
  }
  
  console.log('✅ Tabs initialized');
}

// ===========================
// STUDENT DROPDOWN MANAGEMENT
// ===========================

async function loadStudentsForDropdowns() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
    const studentsList = [];
    studentsSnap.forEach(doc => {
      studentsList.push({ id: doc.id, ...doc.data() });
    });
    
    updateStudentDropdowns(studentsList);
    return studentsList;
  } catch (error) {
    console.error("Error loading students:", error);
    return [];
  }
}

function updateStudentDropdowns(students) {
  const dropdowns = [
    'marksStudent',
    'paymentStudent',
    'hoursStudent'
  ];
  
  dropdowns.forEach(dropdownId => {
    const select = document.getElementById(dropdownId);
    if (select) {
      // Clear existing options except the first one
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name} (${student.id})`;
        select.appendChild(option);
      });
    }
  });
}

// ===========================
// MARKS PERCENTAGE CALCULATION
// ===========================

function updateMarksPercentage() {
  const scoreEl = document.getElementById('marksScore');
  const maxEl = document.getElementById('marksMax');
  const pctEl = document.getElementById('percentage');
  const gradeEl = document.getElementById('grade');

  const score = parseFloat(scoreEl?.value);
  const max = parseFloat(maxEl?.value);

  if (Number.isFinite(score) && Number.isFinite(max) && max > 0) {
    const percentage = (score / max) * 100;
    if (pctEl) pctEl.value = percentage.toFixed(1);
    if (gradeEl) gradeEl.value = calculateGrade(percentage);
  }
}

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

// ===========================
// COMPLETE APP INITIALIZATION
// ===========================

function initializeApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  // Initialize theme first
  initializeTheme();
  
  // Initialize tabs
  initTabs();
  
  // Bind UI events
  bindUiEvents();
  initEventListeners();
  
  // Initialize sync bar
  SyncBar.init();
  
  // Set initial sync status
  if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
  if (syncMessageLine) syncMessageLine.textContent = "Status: Connected";
  
  // Load initial data if user is authenticated
  const user = auth.currentUser;
  if (user) {
    console.log('👤 User authenticated, loading data...');
    loadInitialData(user);
  }
  
  console.log('✅ WorkLog App Fully Initialized');
}

async function loadInitialData(user) {
  try {
    await Promise.all([
      loadUserStats(user.uid),
      loadStudentsForDropdowns(),
      renderStudents(),
      renderRecentHours(),
      renderRecentMarks(),
      renderAttendanceRecent(),
      renderPaymentActivity(),
      renderStudentBalances(),
      renderOverviewReports()
    ]);
    console.log('✅ Initial data loaded');
  } catch (error) {
    console.error('❌ Error loading initial data:', error);
  }
}

// ===========================
// AUTH STATE MANAGEMENT
// ===========================

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('✅ User authenticated:', user.email);
    document.querySelector(".container").style.display = "block";
    
    // Load data if app is already initialized
    if (typeof initializeApp === 'function') {
      loadInitialData(user);
    }
  } else {
    console.log('🚫 No user authenticated - redirecting to login');
    window.location.href = "auth.html";
  }
});

// ===========================
// MISSING UTILITY FUNCTIONS
// ===========================

// Safe number conversion
function safeNumber(n, fallback = 0) {
  if (n === null || n === undefined || n === '') return fallback;
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

// Format money
function fmtMoney(n) {
  return safeNumber(n).toFixed(2);
}

// Format date to ISO
function fmtDateISO(yyyyMmDd) {
  if (!yyyyMmDd) return new Date().toISOString();
  try {
    const d = new Date(yyyyMmDd);
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return 'Never';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

// Refresh timestamp display
function refreshTimestamp() {
  const now = new Date().toLocaleString();
  const syncMessageLine = document.getElementById('syncMessageLine');
  const statUpdated = document.getElementById('statUpdated');
  
  if (syncMessageLine) syncMessageLine.textContent = "Status: Last synced at " + now;
  if (statUpdated) statUpdated.textContent = now;
}

// ===========================
// MISSING UI INITIALIZATION FUNCTIONS
// ===========================
// Tab management
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tabcontent');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');

      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));

      // Hide all tabcontent
      tabContents.forEach(tc => tc.style.display = 'none');

      // Activate clicked tab
      tab.classList.add('active');

      // Show the selected tab content
      const selected = document.getElementById(target);
      if (selected) {
        selected.style.display = 'block';
        console.log(`📑 Switched to ${target} tab`);
      }
    });
  });

  // Default: show the first tab's content
  const firstActive = document.querySelector('.tab.active');
  if (firstActive) {
    const target = firstActive.getAttribute('data-tab');
    const selected = document.getElementById(target);
    if (selected) selected.style.display = 'block';
  }
  
  console.log('✅ Tabs initialized');
}

// UI event bindings
function bindUiEvents() {
  console.log('🔧 Binding UI events...');
  
  // Theme toggle
  const themeToggle = document.querySelector('.theme-toggle button');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Form submissions prevention
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => e.preventDefault());
  });
  
  // Auto-calculate total in hours form
  const hoursInput = document.getElementById('hoursWorked');
  const rateInput = document.getElementById('baseRate');
  const workTypeSelect = document.getElementById('workType');
  
  const calculateTotal = () => {
    const hours = parseFloat(hoursInput?.value) || 0;
    const rate = parseFloat(rateInput?.value) || 0;
    const workType = workTypeSelect?.value || "hourly";
    const totalEl = document.getElementById('totalPay');
    
    if (totalEl) {
      const total = workType === "hourly" ? hours * rate : rate;
      if ("value" in totalEl) {
        totalEl.value = fmtMoney(total);
      } else {
        totalEl.textContent = fmtMoney(total);
      }
    }
  };

  if (hoursInput) hoursInput.addEventListener('input', calculateTotal);
  if (rateInput) rateInput.addEventListener('input', calculateTotal);
  if (workTypeSelect) workTypeSelect.addEventListener('change', calculateTotal);
  
  // Real-time percentage calculation for marks
  const scoreInput = document.getElementById('marksScore');
  const maxInput = document.getElementById('marksMax');
  if (scoreInput) scoreInput.addEventListener('input', updateMarksPercentage);
  if (maxInput) maxInput.addEventListener('input', updateMarksPercentage);
  
  console.log('✅ UI events bound');
}

function initEventListeners() {
  console.log('🔧 Initializing event listeners...');
  
  // Set default dates to today
  const dateInputs = document.querySelectorAll('input[type="date"]');
  const today = new Date().toISOString().split('T')[0];
  dateInputs.forEach(input => {
    if (!input.value) {
      input.value = today;
    }
  });
  
  // Initialize student dropdowns
  loadStudentsForDropdowns();
  
  console.log('✅ Event listeners initialized');
}

// ===========================
// MISSING STUDENT MANAGEMENT FUNCTIONS
// ===========================

async function loadStudentsForDropdowns() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
    const studentsList = [];
    studentsSnap.forEach(doc => {
      studentsList.push({ id: doc.id, ...doc.data() });
    });
    
    updateStudentDropdowns(studentsList);
    return studentsList;
  } catch (error) {
    console.error("Error loading students:", error);
    return [];
  }
}

function updateStudentDropdowns(students) {
  const dropdowns = [
    'marksStudent',
    'paymentStudent',
    'hoursStudent'
  ];
  
  dropdowns.forEach(dropdownId => {
    const select = document.getElementById(dropdownId);
    if (select) {
      // Clear existing options except the first one
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name} (${student.id})`;
        select.appendChild(option);
      });
    }
  });
}

// ===========================
// MISSING MARKS/GRADE FUNCTIONS
// ===========================

function updateMarksPercentage() {
  const scoreEl = document.getElementById('marksScore');
  const maxEl = document.getElementById('marksMax');
  const pctEl = document.getElementById('percentage');
  const gradeEl = document.getElementById('grade');

  const score = parseFloat(scoreEl?.value);
  const max = parseFloat(maxEl?.value);

  if (Number.isFinite(score) && Number.isFinite(max) && max > 0) {
    const percentage = (score / max) * 100;
    if (pctEl) pctEl.value = percentage.toFixed(1);
    if (gradeEl) gradeEl.value = calculateGrade(percentage);
  }
}

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

// ===========================
// MISSING DATA RENDERING FUNCTIONS
// ===========================

async function renderStudents() {
  const user = auth.currentUser;
  if (!user) return;

  const container = document.getElementById('studentsContainer');
  if (!container) return;
  
  container.innerHTML = '<div class="loading">Loading students...</div>';

  try {
    const studentsSnap = await getDocs(collection(db, "users", user.uid, "students"));
    
    if (studentsSnap.size === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Students Yet</h3>
          <p>Add your first student to get started</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    
    studentsSnap.forEach(docSnap => {
      const student = { id: docSnap.id, ...docSnap.data() };
      
      const card = document.createElement("div");
      card.className = "student-card";
      card.innerHTML = `
        <div class="student-card-header">
          <div>
            <strong>${student.name}</strong>
            <span class="student-id">${student.id}</span>
          </div>
          <div class="student-actions">
            <button class="btn-icon" onclick="editStudent('${student.id}')" title="Edit">
              ✏️
            </button>
            <button class="btn-icon" onclick="deleteStudent('${student.id}')" title="Delete">
              🗑️
            </button>
          </div>
        </div>
        <div class="student-details">
          <div class="muted">${student.gender} • ${student.email || 'No email'} • ${student.phone || 'No phone'}</div>
          <div class="student-rate">Rate: $${fmtMoney(student.rate)}/session</div>
          <div class="student-meta">Added: ${formatDate(student.createdAt)}</div>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (error) {
    console.error("Error rendering students:", error);
    container.innerHTML = '<div class="error">Error loading students</div>';
  }
}

async function renderRecentHours(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  
  const container = document.getElementById('hoursContainer');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading recent hours...</div>';

  try {
    const hoursQuery = query(
      collection(db, "users", user.uid, "hours"),
      orderBy("dateIso", "desc")
    );
    
    const snap = await getDocs(hoursQuery);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Hours Logged</h3>
          <p>Log your first work session to get started</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    rows.slice(0, limit).forEach(entry => {
      const item = document.createElement("div");
      item.className = "hours-entry";
      item.innerHTML = `
        <div class="hours-header">
          <strong>${entry.organization}</strong>
          <span class="hours-type">${entry.workType}</span>
        </div>
        <div class="muted">${formatDate(entry.date)} • ${entry.subject || 'General'}</div>
        <div class="hours-details">
          <span>Hours: ${safeNumber(entry.hours)}</span>
          <span>Rate: $${fmtMoney(entry.rate)}</span>
          <span class="hours-total">Total: $${fmtMoney(entry.total)}</span>
        </div>
        ${entry.student ? `<div class="muted">Student: ${entry.student}</div>` : ''}
      `;
      container.appendChild(item);
    });

  } catch (error) {
    console.error("Error rendering hours:", error);
    container.innerHTML = '<div class="error">Error loading hours</div>';
  }
}

async function renderRecentMarks(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById('marksContainer');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading recent marks...</div>';

  try {
    const marksQuery = query(
      collection(db, "users", user.uid, "marks"),
      orderBy("dateIso", "desc")
    );
    
    const snap = await getDocs(marksQuery);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Marks Recorded</h3>
          <p>Add your first mark to get started</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    rows.slice(0, limit).forEach(entry => {
      const item = document.createElement("div");
      item.className = "mark-entry";
      item.innerHTML = `
        <div><strong>${entry.student}</strong> — ${entry.subject} (${entry.topic})</div>
        <div class="muted">${formatDate(entry.date)}</div>
        <div>Score: ${safeNumber(entry.score)}/${safeNumber(entry.max)} — ${safeNumber(entry.percentage).toFixed(2)}% — Grade: ${entry.grade}</div>
      `;
      container.appendChild(item);
    });

    // Update marks summary
    const marksCountEl = document.getElementById('marksCount');
    const avgMarksEl = document.getElementById('avgMarks');
    if (marksCountEl) marksCountEl.textContent = rows.length;
    if (avgMarksEl) {
      const avg = rows.length ? rows.reduce((s, r) => s + safeNumber(r.percentage), 0) / rows.length : 0;
      avgMarksEl.textContent = `${avg.toFixed(1)}%`;
    }

  } catch (error) {
    console.error("Error rendering marks:", error);
    container.innerHTML = '<div class="error">Error loading marks</div>';
  }
}

async function renderAttendanceRecent(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById('attendanceContainer');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading attendance records...</div>';

  try {
    const attendanceQuery = query(
      collection(db, "users", user.uid, "attendance"),
      orderBy("dateIso", "desc")
    );
    
    const snap = await getDocs(attendanceQuery);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Attendance Records</h3>
          <p>Record your first attendance session</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    rows.slice(0, limit).forEach(entry => {
      const item = document.createElement("div");
      item.className = "attendance-entry";
      item.innerHTML = `
        <div><strong>${entry.subject}</strong> — ${entry.topic || "—"}</div>
        <div class="muted">${formatDate(entry.date)}</div>
        <div>Present: ${Array.isArray(entry.present) ? entry.present.length : 0} students</div>
      `;
      container.appendChild(item);
    });

    // Update attendance summary
    if (lastSessionDateEl) lastSessionDateEl.textContent = rows[0]?.date ? formatDate(rows[0].date) : "Never";
    if (attendanceCountEl) attendanceCountEl.textContent = rows.length;

  } catch (error) {
    console.error("Error rendering attendance:", error);
    container.innerHTML = '<div class="error">Error loading attendance</div>';
  }
}

async function renderPaymentActivity(limit = 10) {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById('paymentActivityLog');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading payment activity...</div>';

  try {
    const paymentsQuery = query(
      collection(db, "users", user.uid, "payments"),
      orderBy("dateIso", "desc")
    );
    
    const snap = await getDocs(paymentsQuery);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Payment Activity</h3>
          <p>No recent payment activity recorded</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    rows.slice(0, limit).forEach(entry => {
      const item = document.createElement("div");
      item.className = "activity-item";
      item.innerHTML = `
        <div><strong>$${fmtMoney(entry.amount)}</strong> — ${entry.student}</div>
        <div class="muted">${formatDate(entry.date)} | ${entry.method}</div>
        <div>${entry.notes || ""}</div>
      `;
      container.appendChild(item);
    });

    // Update monthly payments
    if (monthlyPaymentsEl) {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
      const sum = rows
        .filter(r => (r.date || "").startsWith(ym))
        .reduce((s, r) => s + safeNumber(r.amount), 0);
      monthlyPaymentsEl.textContent = `$${fmtMoney(sum)}`;
    }

  } catch (error) {
    console.error("Error rendering payments:", error);
    container.innerHTML = '<div class="error">Error loading payments</div>';
  }
}

async function renderStudentBalances() {
  const user = auth.currentUser;
  if (!user) return;
  const container = document.getElementById('studentBalancesContainer');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading student balances...</div>';

  try {
    const [studentsSnap, hoursSnap, paymentsSnap] = await Promise.all([
      getDocs(collection(db, "users", user.uid, "students")),
      getDocs(collection(db, "users", user.uid, "hours")),
      getDocs(collection(db, "users", user.uid, "payments"))
    ]);

    const earningsByStudent = {};
    hoursSnap.forEach(d => {
      const row = d.data();
      const sid = row.student || "__unknown__";
      earningsByStudent[sid] = (earningsByStudent[sid] || 0) + safeNumber(row.total);
    });

    const paymentsByStudent = {};
    paymentsSnap.forEach(d => {
      const row = d.data();
      const sid = row.student || "__unknown__";
      paymentsByStudent[sid] = (paymentsByStudent[sid] || 0) + safeNumber(row.amount);
    });

    if (studentsSnap.size === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Student Data</h3>
          <p>Add students and record hours/payments to see balances</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    let totalOwed = 0;
    
    studentsSnap.forEach(snap => {
      const student = snap.data();
      const sid = student.id;
      const earned = earningsByStudent[sid] || 0;
      const paid = paymentsByStudent[sid] || 0;
      const owed = Math.max(earned - paid, 0);
      totalOwed += owed;

      const item = document.createElement("div");
      item.className = "activity-item";
      item.innerHTML = `
        <div><strong>${student.name}</strong> (${student.id})</div>
        <div>Earned: $${fmtMoney(earned)} | Paid: $${fmtMoney(paid)} | Owed: $${fmtMoney(owed)}</div>
      `;
      container.appendChild(item);
    });

    // Update total owed display
    if (totalStudentsCountEl) totalStudentsCountEl.textContent = studentsSnap.size;
    if (totalOwedEl) totalOwedEl.textContent = `$${fmtMoney(totalOwed)}`;

  } catch (error) {
    console.error("Error rendering balances:", error);
    container.innerHTML = '<div class="error">Error loading balances</div>';
  }
}

async function renderOverviewReports() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const [studentsSnap, hoursSnap, marksSnap, paymentsSnap] = await Promise.all([
      getDocs(collection(db, "users", user.uid, "students")),
      getDocs(collection(db, "users", user.uid, "hours")),
      getDocs(collection(db, "users", user.uid, "marks")),
      getDocs(collection(db, "users", user.uid, "payments"))
    ]);

    // Calculate totals
    let hoursTotal = 0;
    let earningsTotal = 0;
    hoursSnap.forEach(d => {
      const r = d.data();
      hoursTotal += safeNumber(r.hours);
      earningsTotal += safeNumber(r.total);
    });

    let markSum = 0;
    let markCount = 0;
    marksSnap.forEach(d => {
      const r = d.data();
      markSum += safeNumber(r.percentage);
      markCount += 1;
    });
    const avgMark = markCount ? (markSum / markCount) : 0;

    let paymentsTotal = 0;
    paymentsSnap.forEach(d => {
      const r = d.data();
      paymentsTotal += safeNumber(r.amount);
    });

    const outstanding = Math.max(earningsTotal - paymentsTotal, 0);

    // Update overview elements
    if (totalStudentsReport) totalStudentsReport.textContent = studentsSnap.size;
    if (totalHoursReport) totalHoursReport.textContent = hoursTotal.toFixed(1);
    if (totalEarningsReport) totalEarningsReport.textContent = `$${fmtMoney(earningsTotal)}`;
    if (avgMarkReport) avgMarkReport.textContent = `${avgMark.toFixed(1)}%`;
    if (totalPaymentsReport) totalPaymentsReport.textContent = `$${fmtMoney(paymentsTotal)}`;
    if (outstandingBalance) outstandingBalance.textContent = `$${fmtMoney(outstanding)}`;

  } catch (error) {
    console.error("Error rendering overview:", error);
  }
}

// ===========================
// MISSING FORM RESET FUNCTIONS
// ===========================

function clearStudentForm() {
  const form = document.getElementById("studentForm");
  if (form) form.reset();
}

function resetHoursForm() {
  const form = document.getElementById("hoursForm");
  if (form) {
    form.reset();
    console.log("✅ Hours form reset");
  }
}

function resetMarksForm() {
  const form = document.getElementById("marksForm");
  if (form) form.reset();

  const pctEl = document.getElementById("percentage");
  const gradeEl = document.getElementById("grade");
  if (pctEl) pctEl.value = "";
  if (gradeEl) gradeEl.value = "";
}

function clearAttendanceForm() {
  const dateEl = document.getElementById("attendanceDate");
  const subjectEl = document.getElementById("attendanceSubject");
  const topicEl = document.getElementById("attendanceTopic");

  if (dateEl) dateEl.value = "";
  if (subjectEl) subjectEl.value = "";
  if (topicEl) topicEl.value = "";

  document.querySelectorAll("#attendanceList input[type=checkbox]")
    .forEach(cb => cb.checked = false);
}

function resetPaymentForm() {
  const studentEl = document.getElementById("paymentStudent");
  const amountEl = document.getElementById("paymentAmount");
  const dateEl = document.getElementById("paymentDate");
  const methodEl = document.getElementById("paymentMethod");
  const notesEl = document.getElementById("paymentNotes");

  if (studentEl) studentEl.value = "";
  if (amountEl) amountEl.value = "";
  if (dateEl) dateEl.value = "";
  if (methodEl) methodEl.value = methodEl.options[0]?.value || "";
  if (notesEl) notesEl.value = "";
}

// ===========================
// MISSING STUDENT ACTION FUNCTIONS
// ===========================

function selectAllStudents() {
  document.querySelectorAll("#attendanceList input[type=checkbox]").forEach(cb => cb.checked = true);
}

function deselectAllStudents() {
  document.querySelectorAll("#attendanceList input[type=checkbox]").forEach(cb => cb.checked = false);
}

// Placeholder functions for student actions
async function editStudent(studentId) {
  SyncBar.notifyInfo("Edit student feature coming soon");
}

async function deleteStudent(studentId) {
  if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
    const user = auth.currentUser;
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "students", studentId));
        SyncBar.notifySuccess("Student deleted successfully");
        await renderStudents();
        await loadStudentsForDropdowns();
      } catch (error) {
        console.error("Error deleting student:", error);
        SyncBar.notifyError("Failed to delete student");
      }
    }
  }
}

// ===========================
// MISSING RATE MANAGEMENT FUNCTIONS
// ===========================

function saveDefaultRate() {
  const input = document.getElementById("defaultBaseRate");
  const currentDisplay = document.getElementById("currentDefaultRate");
  const hoursDisplay = document.getElementById("currentDefaultRateDisplay");

  const val = parseFloat(input?.value) || 0;
  if (currentDisplay) currentDisplay.textContent = fmtMoney(val);
  if (hoursDisplay) hoursDisplay.textContent = fmtMoney(val);
  SyncBar.notifySuccess("Default rate saved");
}

function applyDefaultRateToAll() {
  const val = parseFloat(document.getElementById("defaultBaseRate")?.value) || 0;
  const user = auth.currentUser;
  if (!user) return;
  
  SyncBar.notifyInfo("Applying default rate to all students...");
  
  // This would need to be implemented with your Firestore update logic
  SyncBar.notifyWarning("This feature needs Firestore implementation");
}

function useDefaultRate() {
  const val = parseFloat(document.getElementById("defaultBaseRate")?.value) || 0;
  const input = document.getElementById("studentBaseRate");
  if (input) input.value = fmtMoney(val);
}

function useDefaultRateInHours() {
  const defaultRateDisplay = document.getElementById("currentDefaultRateDisplay");
  const baseRateInput = document.getElementById("baseRate");
  if (defaultRateDisplay && baseRateInput) {
    baseRateInput.value = parseFloat(defaultRateDisplay.textContent) || 0;
  }
}

// ===========================
// BOOT THE APPLICATION
// ===========================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

