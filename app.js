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

let autoSyncInterval = null;
let isAutoSyncEnabled = false;

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
// INITIALIZE SYNC BAR
// ===========================

function initializeSyncBar() {
  initializeNotificationStyles();
  setupAutoSyncToggle();
  setupSyncNowButton();
  setupExportCloudButton();
  setupImportCloudButton();
  setupSyncStatsButton();
  setupExportDataButton();
  setupImportDataButton();
  setupClearAllButton();
  
  console.log('✅ Sync bar initialized with new notification system');
}

// Add to your boot function
function enhancedBoot() {
  // Your existing boot code...
  bindUiEvents();
  initEventListeners();
  
  // Initialize sync bar with new notification system
  initializeSyncBar();
  
  if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
  if (syncMessageLine) syncMessageLine.textContent = "Status: Awaiting authentication";

  console.log("WorkLog App Initialized with Enhanced Sync & Notifications");
}

// Replace your existing boot call
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enhancedBoot);
} else {
  enhancedBoot();
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
// INITIALIZE SYNC BAR
// ===========================

function initializeSyncBar() {
  setupAutoSyncToggle();
  setupSyncNowButton();
  setupExportCloudButton();
  setupImportCloudButton();
  setupSyncStatsButton();
  setupExportDataButton();
  setupImportDataButton();
  setupClearAllButton();
  
  console.log('✅ Sync bar initialized');
}

// Remove any duplicate showNotification declarations from other parts of your app.js
// Make sure showNotification is only declared once in the entire file

// Add this to your existing boot function
function enhancedBoot() {
  // Your existing boot code...
  bindUiEvents();
  initEventListeners();
  
  // Initialize sync bar
  initializeSyncBar();
  
  if (syncMessage) syncMessage.textContent = "Cloud Sync: Ready";
  if (syncMessageLine) syncMessageLine.textContent = "Status: Awaiting authentication";

  console.log("WorkLog App Initialized with Enhanced Sync");
}

// Replace your existing boot call with enhancedBoot
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enhancedBoot);
} else {
  enhancedBoot();
}
