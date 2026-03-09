// sync-service.js - PROPER CROSS-DEVICE SYNC
console.log('🔄 Loading SyncService...');

class SyncService {
  constructor() {
    this.syncInProgress = false;
    this.lastSyncTime = localStorage.getItem('lastSyncTime');
    this.syncInterval = null;
    this.conflictResolution = 'firebase-wins'; // 'firebase-wins' or 'local-wins' or 'merge'
    
    // Bind methods
    this.sync = this.sync.bind(this);
    this.startAutoSync = this.startAutoSync.bind(this);
    this.stopAutoSync = this.stopAutoSync.bind(this);
    
    // Initialize
    this.init();
  }

  init() {
    console.log('🔄 SyncService initializing...');
    
    // Check if auto-sync was enabled
    const autoSync = localStorage.getItem('autoSyncEnabled') === 'true';
    if (autoSync) {
      this.startAutoSync();
    }
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('📶 App is online');
      this.updateSyncIndicator('Online', 'online');
      if (localStorage.getItem('autoSyncEnabled') === 'true') {
        this.sync();
      }
    });
    
    window.addEventListener('offline', () => {
      console.log('📶 App is offline');
      this.updateSyncIndicator('Offline', 'offline');
    });
    
    // Initial sync if online and auto-sync enabled
    if (navigator.onLine && autoSync) {
      setTimeout(() => this.sync(), 2000);
    }
    
    console.log('✅ SyncService initialized');
  }

 // In sync-service.js, modify the sync method:

async sync(force = false, showNotifications = false) {
    if (this.syncInProgress) {
        console.log('⚠️ Sync already in progress');
        return { success: false, message: 'Sync already in progress' };
    }

    if (!navigator.onLine) {
        console.log('⚠️ Cannot sync: offline');
        this.updateSyncIndicator('Offline', 'offline');
        return { success: false, message: 'Offline' };
    }

    try {
        this.syncInProgress = true;
        console.log('🔄 Starting sync...');
        this.updateSyncIndicator('Syncing...', 'syncing');
        
        // Only show notification on manual sync (showNotifications = true)
        if (showNotifications) {
            this.showNotification('Syncing data...', 'info');
        }

        // Check authentication
        const user = await this.getCurrentUser();
        if (!user) {
            console.log('⚠️ No authenticated user');
            this.updateSyncIndicator('Login Required', 'warning');
            this.syncInProgress = false;
            
            if (showNotifications) {
                this.showNotification('Please login to sync', 'warning');
            }
            return { success: false, message: 'Not authenticated' };
        }

        console.log(`👤 Syncing as: ${user.email}`);

        // Get local data
        const localData = this.getAllLocalData();
        
        // Get remote data
        const remoteData = await this.getRemoteData(user.uid);
        
        // Merge data
        const mergedData = this.mergeData(localData, remoteData);
        
        // Save merged data to Firestore
        await this.saveToFirestore(user.uid, mergedData);
        
        // Save merged data to localStorage
        this.saveToLocalStorage(mergedData);
        
        // Update sync timestamp
        const timestamp = new Date().toISOString();
        localStorage.setItem('lastSyncTime', timestamp);
        this.lastSyncTime = timestamp;
        
        console.log('✅ Sync completed successfully');
        this.updateSyncIndicator('Synced', 'success');
        
        // Only show success notification on manual sync
        if (showNotifications) {
            this.showNotification('Data synced successfully!', 'success');
        }
        
        // Refresh UI
        this.refreshUI();
        
        this.syncInProgress = false;
        
        // Reset indicator after 3 seconds
        setTimeout(() => {
            this.updateSyncIndicator('Online', 'online');
        }, 3000);
        
        return { success: true, timestamp };
        
    } catch (error) {
        console.error('❌ Sync failed:', error);
        this.updateSyncIndicator('Sync Failed', 'error');
        
        // Only show error notification on manual sync
        if (showNotifications) {
            this.showNotification(`Sync failed: ${error.message}`, 'error');
        }
        
        this.syncInProgress = false;
        
        setTimeout(() => {
            this.updateSyncIndicator('Online', 'online');
        }, 3000);
        
        return { success: false, error: error.message };
    }
}

// Update startAutoSync to use showNotifications = false
startAutoSync(interval = 30000) {
    if (this.syncInterval) {
        clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
        if (navigator.onLine && !this.syncInProgress) {
            console.log('🔄 Auto-sync triggered');
            // Pass false to hide notifications
            this.sync(false, false);
        }
    }, interval);
    
    localStorage.setItem('autoSyncEnabled', 'true');
    console.log(`✅ Auto-sync started (every ${interval/1000}s) - notifications disabled`);
}
  
  async getCurrentUser() {
    return new Promise((resolve) => {
      const user = firebase.auth().currentUser;
      if (user) {
        resolve(user);
      } else {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });
        setTimeout(() => {
          unsubscribe();
          resolve(null);
        }, 3000);
      }
    });
  }

 getAllLocalData() {
    // Get the current rate using RateManager if available, otherwise fallback to localStorage
    let defaultRate = '25.00';
    
    if (window.RateManager) {
        defaultRate = window.RateManager.getCurrentRate();
    } else {
        defaultRate = localStorage.getItem('defaultHourlyRate') || 
                     localStorage.getItem('defaultRate') || 
                     '25.00';
    }
    
    return {
        students: JSON.parse(localStorage.getItem('worklog_students') || '[]'),
        hours: JSON.parse(localStorage.getItem('worklog_hours') || '[]'),
        marks: JSON.parse(localStorage.getItem('worklog_marks') || '[]'),
        attendance: JSON.parse(localStorage.getItem('worklog_attendance') || '[]'),
        payments: JSON.parse(localStorage.getItem('worklog_payments') || '[]'),
        settings: {
            defaultHourlyRate: defaultRate,
            defaultRate: defaultRate, // Add both for redundancy
            autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
            theme: localStorage.getItem('worklog-theme') || 'dark',
            studentSortMethod: localStorage.getItem('studentSortMethod') || 'id'
        },
        lastLocalUpdate: new Date().toISOString(),
        appVersion: '1.0.0'
    };
}

async getRemoteData(userId) {
  try {
    const db = firebase.firestore();
    
    // Try to get the consolidated data document first
    const docRef = db.collection('users').doc(userId).collection('data').doc('worklog');
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      // If it has students, great!
      if (data.students && data.students.length > 0) {
        return data;
      }
    }
    
    // If no consolidated data, check for separate collections
    console.log('No consolidated data, checking separate collections...');
    
    // Get students from separate collection
    const studentsSnapshot = await db.collection('users').doc(userId)
      .collection('students').get();
    
    const students = studentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get hours from separate collection (if exists)
    const hoursSnapshot = await db.collection('users').doc(userId)
      .collection('hours').get();
    
    const hours = hoursSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get marks from separate collection (if exists)
    const marksSnapshot = await db.collection('users').doc(userId)
      .collection('marks').get();
    
    const marks = marksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get attendance from separate collection (if exists)
    const attendanceSnapshot = await db.collection('users').doc(userId)
      .collection('attendance').get();
    
    const attendance = attendanceSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get payments from separate collection (if exists)
    const paymentsSnapshot = await db.collection('users').doc(userId)
      .collection('payments').get();
    
    const payments = paymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Combine into the expected format
    const combinedData = {
      students,
      hours,
      marks,
      attendance,
      payments,
      settings: {
        defaultHourlyRate: localStorage.getItem('defaultHourlyRate') || '25.00',
        autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
        theme: localStorage.getItem('worklog-theme') || 'dark'
      },
      lastSync: new Date().toISOString()
    };
    
    console.log(`📊 Combined data: ${students.length} students, ${hours.length} hours`);
    
    // Save this combined format back to Firestore for future use
    if (students.length > 0) {
      await docRef.set(combinedData, { merge: true });
      console.log('✅ Saved combined data format to Firestore');
    }
    
    return combinedData;
    
  } catch (error) {
    console.error('Error getting remote data:', error);
    return null;
  }
}
  
  mergeData(local, remote) {
    // If no remote data, just use local
    if (!remote) {
      console.log('No remote data, using local');
      return local;
    }
    
    // If no local data, use remote
    if (!local || local.students.length === 0) {
      console.log('No local data, using remote');
      return remote;
    }
    
    console.log('Merging local and remote data...');
    
    // Create maps for efficient merging
    const merged = {
      students: [],
      hours: [],
      marks: [],
      attendance: [],
      payments: [],
      settings: { ...local.settings, ...remote.settings }
    };
    
    // Merge students (by ID)
    const studentMap = new Map();
    
    // Add remote students first (they win by default)
    if (remote.students) {
      remote.students.forEach(student => {
        studentMap.set(student.id, { ...student, source: 'remote' });
      });
    }
    
    // Add local students if they don't exist in remote
    if (local.students) {
      local.students.forEach(student => {
        if (!studentMap.has(student.id)) {
          studentMap.set(student.id, { ...student, source: 'local' });
        }
      });
    }
    
    merged.students = Array.from(studentMap.values());
    
    // Similarly merge other collections
    // For simplicity, we'll just concatenate and remove duplicates
    const allHours = [...(remote.hours || []), ...(local.hours || [])];
    merged.hours = this.removeDuplicates(allHours, 'id');
    
    const allMarks = [...(remote.marks || []), ...(local.marks || [])];
    merged.marks = this.removeDuplicates(allMarks, 'id');
    
    const allAttendance = [...(remote.attendance || []), ...(local.attendance || [])];
    merged.attendance = this.removeDuplicates(allAttendance, 'id');
    
    const allPayments = [...(remote.payments || []), ...(local.payments || [])];
    merged.payments = this.removeDuplicates(allPayments, 'id');
    
    console.log(`Merged: ${merged.students.length} students, ${merged.hours.length} hours`);
    
    return merged;
  }

  removeDuplicates(array, key) {
    const map = new Map();
    array.forEach(item => {
      if (item && item[key]) {
        map.set(item[key], item);
      }
    });
    return Array.from(map.values());
  }

  async saveToFirestore(userId, data) {
    const db = firebase.firestore();
    const docRef = db.collection('users').doc(userId).collection('data').doc('worklog');
    
    await docRef.set({
      ...data,
      lastSync: firebase.firestore.FieldValue.serverTimestamp(),
      syncedFrom: navigator.userAgent,
      syncVersion: '1.0.0'
    }, { merge: true });
    
    console.log('✅ Data saved to Firestore');
  }

 saveToLocalStorage(data) {
    console.log('💾 Saving data to localStorage with settings...');
    
    // Save main data collections
    if (data.students) {
        localStorage.setItem('worklog_students', JSON.stringify(data.students));
        console.log(`✅ Saved ${data.students.length} students`);
    }
    if (data.hours) {
        localStorage.setItem('worklog_hours', JSON.stringify(data.hours));
    }
    if (data.marks) {
        localStorage.setItem('worklog_marks', JSON.stringify(data.marks));
    }
    if (data.attendance) {
        localStorage.setItem('worklog_attendance', JSON.stringify(data.attendance));
    }
    if (data.payments) {
        localStorage.setItem('worklog_payments', JSON.stringify(data.payments));
    }
    
    // Save settings with special attention to rate
    if (data.settings) {
        // Save default rate to multiple keys for redundancy
        if (data.settings.defaultHourlyRate) {
            const rate = data.settings.defaultHourlyRate;
            localStorage.setItem('defaultHourlyRate', rate);
            localStorage.setItem('defaultRate', rate);
            console.log(`✅ Saved default rate: $${rate}`);
            
            // Update UI if RateManager exists
            if (window.RateManager) {
                window.RateManager.updateUI();
            }
        }
        
        // Save other settings
        if (data.settings.autoSyncEnabled !== undefined) {
            localStorage.setItem('autoSyncEnabled', data.settings.autoSyncEnabled);
        }
        if (data.settings.theme) {
            localStorage.setItem('worklog-theme', data.settings.theme);
        }
        if (data.settings.studentSortMethod) {
            localStorage.setItem('studentSortMethod', data.settings.studentSortMethod);
        }
    }
    
    // Also save a consolidated settings object
    const settings = {
        defaultHourlyRate: localStorage.getItem('defaultHourlyRate') || '25.00',
        defaultRate: localStorage.getItem('defaultRate') || '25.00',
        autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
        theme: localStorage.getItem('worklog-theme') || 'dark',
        studentSortMethod: localStorage.getItem('studentSortMethod') || 'id',
        lastSync: data.lastSync || new Date().toISOString()
    };
    localStorage.setItem('worklog_settings', JSON.stringify(settings));
    
    console.log('✅ Data and settings saved to localStorage');
    
    // Trigger UI update for rate if needed
    if (typeof initDefaultRate === 'function') {
        initDefaultRate();
    }
    
    return true;
}

  // Add this method to your sync-service.js to ensure settings are properly synced

async syncSettings() {
    try {
        const user = await this.getCurrentUser();
        if (!user) return false;
        
        // Get current settings
        const localSettings = {
            defaultHourlyRate: localStorage.getItem('defaultHourlyRate') || '25.00',
            autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
            theme: localStorage.getItem('worklog-theme') || 'dark',
            studentSortMethod: localStorage.getItem('studentSortMethod') || 'id'
        };
        
        // Save to Firestore
        const db = firebase.firestore();
        const settingsRef = db.collection('users').doc(user.uid)
                             .collection('settings').doc('preferences');
        
        await settingsRef.set({
            ...localSettings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Settings synced to cloud');
        return true;
        
    } catch (error) {
        console.error('❌ Error syncing settings:', error);
        return false;
    }
}

  
  updateSyncIndicator(text, status) {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;
    
    indicator.textContent = text;
    indicator.className = `sync-indicator ${status}`;
  }

  showNotification(message, type) {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
    } else {
      console.log(`🔔 ${type}: ${message}`);
    }
  }

  refreshUI() {
    // Trigger UI refresh
    if (typeof refreshAllStats === 'function') {
      refreshAllStats();
    }
    if (typeof loadStudents === 'function') {
      loadStudents();
    }
    if (typeof loadHours === 'function') {
      loadHours();
    }
    if (typeof loadMarks === 'function') {
      loadMarks();
    }
    if (typeof loadAttendance === 'function') {
      loadAttendance();
    }
    if (typeof loadPayments === 'function') {
      loadPayments();
    }
  }

  startAutoSync(interval = 30000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        console.log('🔄 Auto-sync triggered');
        this.sync();
      }
    }, interval);
    
    localStorage.setItem('autoSyncEnabled', 'true');
    console.log(`✅ Auto-sync started (every ${interval/1000}s)`);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    localStorage.setItem('autoSyncEnabled', 'false');
    console.log('⏹️ Auto-sync stopped');
  }

  async exportToCloud() {
    return this.sync(true);
  }

  async importFromCloud() {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        this.showNotification('Please login first', 'error');
        return false;
      }
      
      const remoteData = await this.getRemoteData(user.uid);
      if (!remoteData) {
        this.showNotification('No cloud data found', 'warning');
        return false;
      }
      
      this.saveToLocalStorage(remoteData);
      this.showNotification('Cloud data imported successfully!', 'success');
      this.refreshUI();
      return true;
      
    } catch (error) {
      console.error('Import failed:', error);
      this.showNotification('Import failed: ' + error.message, 'error');
      return false;
    }
  }

  async loadFromFirestore() {
    try {
      const user = await this.getCurrentUser();
      if (!user) return null;
      
      const remoteData = await this.getRemoteData(user.uid);
      if (remoteData) {
        this.saveToLocalStorage(remoteData);
        this.refreshUI();
        console.log('✅ Loaded data from Firestore');
        return remoteData;
      }
      return null;
      
    } catch (error) {
      console.error('Error loading from Firestore:', error);
      return null;
    }
  }
}

// Create global instance
window.syncService = new SyncService();

// Add to window for debugging
window.debug = {
  sync: () => window.syncService.sync(),
  loadFromFirestore: () => window.syncService.loadFromFirestore(),
  checkAuth: () => firebase.auth().currentUser
};

console.log('✅ sync-service.js loaded');
