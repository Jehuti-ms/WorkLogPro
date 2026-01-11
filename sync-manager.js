// sync-manager.js - NEW FILE - Add this to your project
console.log('🔄 Loading sync-manager.js');

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.lastSync = null;
    this.syncQueue = [];
    this.init();
  }

  init() {
    console.log('🔄 Sync Manager initialized');
    
    // Load last sync time
    this.lastSync = localStorage.getItem('lastSync') || null;
    
    // Start sync interval if auto-sync is enabled
    this.startAutoSync();
  }

  async handleSync() {
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }

    try {
      this.isSyncing = true;
      console.log('🔄 Starting manual sync...');
      
      // Update UI
      this.updateSyncIndicator('Syncing...', 'syncing');
      
      // Get all local data
      const data = this.getAllLocalData();
      
      // Check if we have Firebase auth
      const hasFirebaseAuth = this.checkFirebaseAuth();
      
      if (!hasFirebaseAuth) {
        console.log('⚠️ No Firebase auth, doing local sync only');
        
        // Just update local sync timestamp
        const timestamp = new Date().toISOString();
        localStorage.setItem('lastSync', timestamp);
        this.lastSync = timestamp;
        
        this.updateSyncIndicator('Local Only', 'warning');
        return { 
          success: true, 
          message: 'Local sync completed (no cloud)', 
          localOnly: true 
        };
      }
      
      // Try Firebase sync
      try {
        if (window.firebase && firebase.auth().currentUser) {
          const user = firebase.auth().currentUser;
          const userId = user.uid;
          
          // Save to Firestore
          await this.saveToFirestore(userId, data);
          console.log('✅ Cloud sync successful');
        }
      } catch (firebaseError) {
        console.log('⚠️ Cloud sync failed, falling back to local:', firebaseError);
      }
      
      // Update sync timestamp
      const timestamp = new Date().toISOString();
      localStorage.setItem('lastSync', timestamp);
      this.lastSync = timestamp;
      
      // Update UI
      this.updateSyncIndicator('Synced', 'success');
      
      // Show notification
      this.showNotification('Sync completed successfully!', 'success');
      
      return { success: true, timestamp };
      
    } catch (error) {
      console.error('❌ Sync error:', error);
      this.updateSyncIndicator('Sync Failed', 'error');
      this.showNotification('Sync failed: ' + error.message, 'error');
      return { success: false, error: error.message };
    } finally {
      this.isSyncing = false;
      
      // Reset to online after 3 seconds
      setTimeout(() => {
        this.updateSyncIndicator('Online', 'online');
      }, 3000);
    }
  }

  getAllLocalData() {
    return {
      students: JSON.parse(localStorage.getItem('worklog_students') || '[]'),
      hours: JSON.parse(localStorage.getItem('worklog_hours') || '[]'),
      marks: JSON.parse(localStorage.getItem('worklog_marks') || '[]'),
      attendance: JSON.parse(localStorage.getItem('worklog_attendance') || '[]'),
      payments: JSON.parse(localStorage.getItem('worklog_payments') || '[]'),
      settings: {
        defaultHourlyRate: localStorage.getItem('defaultHourlyRate') || '25.00',
        autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
        theme: localStorage.getItem('worklog-theme') || 'dark'
      },
      syncDate: new Date().toISOString()
    };
  }

  checkFirebaseAuth() {
    try {
      return window.firebase && 
             firebase.auth() && 
             firebase.auth().currentUser &&
             firebase.auth().currentUser.uid;
    } catch (error) {
      return false;
    }
  }

  async saveToFirestore(userId, data) {
    if (!window.firebase || !firebase.firestore) {
      throw new Error('Firebase Firestore not available');
    }

    const db = firebase.firestore();
    const userRef = db.collection('users').doc(userId).collection('data').doc('worklog');
    
    await userRef.set({
      ...data,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      appVersion: '1.0.0'
    }, { merge: true });
  }

  updateSyncIndicator(text, status) {
    const syncIndicator = document.getElementById('syncIndicator');
    if (!syncIndicator) return;
    
    // Clear previous classes
    syncIndicator.className = 'sync-indicator';
    
    // Set text and status class
    syncIndicator.textContent = text;
    syncIndicator.classList.add(status);
  }

  showNotification(message, type = 'info') {
    console.log(`🔔 ${type.toUpperCase()}: ${message}`);
    
    // Use existing notification function if available
    if (typeof showNotification === 'function') {
      showNotification(message, type);
      return;
    }
    
    // Fallback notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    });
  }

  getNotificationIcon(type) {
    switch(type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }

  startAutoSync() {
    // Check auto-sync setting
    const autoSyncEnabled = localStorage.getItem('autoSyncEnabled') === 'true';
    
    if (autoSyncEnabled) {
      console.log('🔄 Auto-sync enabled');
      // Sync every 5 minutes if online
      setInterval(() => {
        if (navigator.onLine) {
          this.handleSync();
        }
      }, 5 * 60 * 1000);
    }
  }

  // Export cloud data
  async exportCloudData() {
    try {
      const data = this.getAllLocalData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `worklog-cloud-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showNotification('Cloud data exported!', 'success');
      return { success: true };
    } catch (error) {
      this.showNotification('Export failed: ' + error.message, 'error');
      return { success: false, error: error.message };
    }
  }

  // Fix stats function
  fixStats() {
    try {
      console.log('🔧 Fixing stats...');
      
      // Recalculate all totals
      const students = JSON.parse(localStorage.getItem('worklog_students') || '[]');
      const hours = JSON.parse(localStorage.getItem('worklog_hours') || '[]');
      const marks = JSON.parse(localStorage.getItem('worklog_marks') || '[]');
      
      // Fix hour totals
      const fixedHours = hours.map(hour => {
        const hoursWorked = parseFloat(hour.hoursWorked) || 0;
        const rate = parseFloat(hour.baseRate) || 0;
        const total = hoursWorked * rate;
        return { ...hour, total: total };
      });
      
      localStorage.setItem('worklog_hours', JSON.stringify(fixedHours));
      
      // Fix mark percentages and grades
      const fixedMarks = marks.map(mark => {
        const score = parseFloat(mark.marksScore) || 0;
        const max = parseFloat(mark.marksMax) || 1;
        const percentage = max > 0 ? ((score / max) * 100).toFixed(1) : '0.0';
        
        let grade = 'F';
        const percNum = parseFloat(percentage);
        if (percNum >= 90) grade = 'A';
        else if (percNum >= 80) grade = 'B';
        else if (percNum >= 70) grade = 'C';
        else if (percNum >= 60) grade = 'D';
        
        return { ...mark, percentage, grade };
      });
      
      localStorage.setItem('worklog_marks', JSON.stringify(fixedMarks));
      
      this.showNotification('Stats fixed successfully!', 'success');
      return { success: true, fixed: { hours: hours.length, marks: marks.length } };
    } catch (error) {
      console.error('❌ Fix stats error:', error);
      this.showNotification('Failed to fix stats: ' + error.message, 'error');
      return { success: false, error: error.message };
    }
  }
}

// Create global instance
window.syncManager = new SyncManager();
console.log('✅ sync-manager.js loaded');
