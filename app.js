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
// NOTIFICATION SYSTEM (Move to top to avoid duplicates)
// ===========================

function showNotification(message, type = 'info') {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notification => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  });

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    border-radius: 12px;
    z-index: 10000;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    font-weight: 500;
    max-width: 400px;
    animation: slideInRight 0.3s ease;
  `;

  document.body.appendChild(notification);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 5000);
}

// Add CSS for notification animations (only once)
if (!document.querySelector('#notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes slideOutRight {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }
  `;
  document.head.appendChild(style);
}

// 1. Manual to Auto-Sync Toggle
function setupAutoSyncToggle() {
  const autoSyncCheckbox = document.getElementById('autoSyncCheckbox');
  const autoSyncText = document.getElementById('autoSyncText');
  const syncIndicator = document.getElementById('syncIndicator');

  if (autoSyncCheckbox) {
    autoSyncCheckbox.addEventListener('change', function() {
      isAutoSyncEnabled = this.checked;
      
      if (isAutoSyncEnabled) {
        // Enable auto-sync
        autoSyncText.textContent = 'Auto';
        syncIndicator.style.backgroundColor = '#10b981'; // Green
        syncIndicator.classList.add('sync-connected');
        startAutoSync();
        showNotification('Auto-sync enabled - syncing every 60 seconds', 'success');
      } else {
        // Disable auto-sync
        autoSyncText.textContent = 'Manual';
        syncIndicator.style.backgroundColor = '#ef4444'; // Red
        syncIndicator.classList.remove('sync-connected');
        stopAutoSync();
        showNotification('Auto-sync disabled', 'info');
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
  // Clear any existing interval
  stopAutoSync();
  
  // Run sync immediately
  performSync('auto');
  
  // Set up interval for every 60 seconds
  autoSyncInterval = setInterval(() => {
    performSync('auto');
  }, 60000); // 60 seconds
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
    showNotification('Please log in to sync', 'error');
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

    console.log(`🔄 Starting ${mode} sync...`);

    // Perform the actual sync operations
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

    showNotification(`${mode === 'auto' ? 'Auto-' : ''}Sync completed successfully`, 'success');
    console.log(`✅ ${mode} sync completed`);

  } catch (error) {
    console.error(`❌ ${mode} sync failed:`, error);
    
    // Show error state
    if (syncIndicator) {
      syncIndicator.classList.remove('sync-active', 'sync-connected');
      syncIndicator.classList.add('sync-error');
    }
    if (syncMessageLine) syncMessageLine.textContent = `Status: Sync failed - ${error.message}`;
    
    showNotification(`Sync failed: ${error.message}`, 'error');
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
        showNotification('Please log in to export data', 'error');
        return;
      }

      try {
        showNotification('Starting cloud export...', 'info');
        
        // Create backup in Firestore
        const backupRef = doc(db, "backups", user.uid);
        const backupData = await createBackupData(user.uid);
        
        await setDoc(backupRef, {
          ...backupData,
          exportedAt: new Date().toISOString(),
          version: '1.0',
          user: user.uid
        });

        showNotification('Cloud export completed successfully', 'success');
        console.log('✅ Cloud export complete');
      } catch (error) {
        console.error('❌ Cloud export failed:', error);
        showNotification(`Export failed: ${error.message}`, 'error');
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
        showNotification('Please log in to import data', 'error');
        return;
      }

      const proceed = confirm('⚠️ This will overwrite your current data with the cloud backup. This action cannot be undone. Continue?');
      if (!proceed) return;

      try {
        showNotification('Starting cloud import...', 'info');
        
        const backupRef = doc(db, "backups", user.uid);
        const backupSnap = await getDoc(backupRef);

        if (!backupSnap.exists()) {
          showNotification('No cloud backup found for your account', 'warning');
          return;
        }

        const backupData = backupSnap.data();
        await restoreBackupData(user.uid, backupData);

        showNotification('Cloud import completed successfully', 'success');
        
        // Refresh all data
        await performSync('manual');
        
      } catch (error) {
        console.error('❌ Cloud import failed:', error);
        showNotification(`Import failed: ${error.message}`, 'error');
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
        showNotification('Please log in to sync stats', 'error');
        return;
      }

      try {
        showNotification('Syncing statistics...', 'info');
        await recalcSummaryStats(user.uid);
        await loadUserStats(user.uid);
        showNotification('Statistics synced successfully', 'success');
      } catch (error) {
        console.error('❌ Stats sync failed:', error);
        showNotification(`Stats sync failed: ${error.message}`, 'error');
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
        showNotification('Please log in to export data', 'error');
        return;
      }

      try {
        showNotification('Preparing data export...', 'info');
        
        const exportData = await createBackupData(user.uid);
        
        // Create and download JSON file
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

        showNotification('Data exported successfully', 'success');
        console.log('✅ Local export complete');
      } catch (error) {
        console.error('❌ Local export failed:', error);
        showNotification(`Export failed: ${error.message}`, 'error');
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
        showNotification('Please log in to import data', 'error');
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
          showNotification('Importing data...', 'info');
          
          const fileText = await file.text();
          const importData = JSON.parse(fileText);
          
          // Validate import data structure
          if (!importData.metadata || !importData.students || !importData.hours) {
            throw new Error('Invalid backup file format');
          }

          await restoreBackupData(user.uid, importData);
          
          showNotification('Data imported successfully', 'success');
          
          // Refresh all data
          await performSync('manual');
          
        } catch (error) {
          console.error('❌ Local import failed:', error);
          showNotification(`Import failed: ${error.message}`, 'error');
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
        showNotification('Please log in to clear data', 'error');
        return;
      }

      const proceed = confirm('⚠️🚨 DANGER ZONE 🚨⚠️\n\nThis will PERMANENTLY DELETE ALL your data including:\n• All students\n• All hours worked\n• All marks & assessments\n• All attendance records\n• All payment records\n\nThis action cannot be undone!\n\nType "DELETE ALL" to confirm:');
      
      if (proceed && prompt('Type "DELETE ALL" to confirm:') === 'DELETE ALL') {
        try {
          showNotification('Clearing all data...', 'warning');
          
          await clearAllUserData(user.uid);
          
          showNotification('All data cleared successfully', 'success');
          
          // Refresh UI
          await performSync('manual');
          
        } catch (error) {
          console.error('❌ Clear data failed:', error);
          showNotification(`Clear failed: ${error.message}`, 'error');
        }
      } else {
        showNotification('Data clearance cancelled', 'info');
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
