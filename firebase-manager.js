// firebase-manager.js - ENHANCED WITH SYNC MONITORING
/*import { auth, db } from "./firebase-config.js";
import { 
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export class FirebaseManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncQueue = [];
    this.syncInterval = null;
    this.initNetworkListener();
    this.initSyncMonitor();
  }

  initNetworkListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Online - syncing queued operations');
      this.showNetworkStatus('🟢 Online - syncing...');
      this.processSyncQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Offline - operations will be queued');
      this.showNetworkStatus('🔴 Offline - working locally');
    });
  }

  initSyncMonitor() {
    // Update sync status every 5 seconds
    setInterval(() => {
      this.updateSyncIndicator();
    }, 5000);
  }

  async init() {
    try {
      console.log("🔄 Initializing Firebase Manager...");
      
      // Enable offline persistence
      await this.enableOfflinePersistence();
      
      // Setup auth listener
      this.setupAuthListener();
      
      // Initialize auto-sync
      this.initAutoSync();
      
      console.log("✅ Firebase Manager initialized successfully");
      return true;
    } catch (err) {
      console.error("❌ Firebase Manager init failed:", err);
      return false;
    }
  }

  async enableOfflinePersistence() {
    try {
      await enableIndexedDbPersistence(db);
      console.log('✅ Offline persistence enabled');
    } catch (err) {
      if (err.code === 'failed-precondition') {
        console.log('ℹ️ Multiple tabs open - using existing persistence');
      } else if (err.code === 'unimplemented') {
        console.warn('⚠️ Browser does not support offline persistence');
      } else {
        console.warn('⚠️ Offline persistence error:', err);
      }
    }
  }

  setupAuthListener() {
    onAuthStateChanged(auth, async user => {
      if (user) {
        console.log("🟢 User authenticated:", user.email);
        await this.initUserData(user.uid);
        
        // Update UI
        this.updateUserProfile(user);
        
        // Process any pending sync
        if (this.isOnline) {
          this.processSyncQueue();
        }
      } else {
        console.log("🔴 No user authenticated");
        this.clearLocalUserData();
      }
    });
  }

  async initUserData(uid) {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: auth.currentUser.email,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          settings: {
            defaultRate: 25.00,
            autoSync: true,
            theme: 'dark'
          }
        });
        console.log('✅ User document created');
      } else {
        // Update last login
        await updateDoc(userRef, {
          lastLogin: new Date().toISOString()
        });
      }
      
      // Load user settings to localStorage
      const userData = userSnap.exists() ? userSnap.data() : {
        settings: { defaultRate: 25.00, autoSync: true, theme: 'dark' }
      };
      
      localStorage.setItem('userSettings', JSON.stringify(userData.settings));
      localStorage.setItem('userEmail', userData.email || auth.currentUser.email);
      
    } catch (error) {
      console.error('Error initializing user data:', error);
    }
  }

  clearLocalUserData() {
    // Clear only user-specific data
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    collections.forEach(col => {
      localStorage.removeItem(`worklog_${col}`);
    });
    localStorage.removeItem('userSettings');
    console.log('🧹 User data cleared from localStorage');
  }

  initAutoSync() {
    // Clear any existing interval
    if (this.syncInterval) clearInterval(this.syncInterval);
    
    // Check auto-sync setting
    const autoSyncEnabled = localStorage.getItem('autoSyncEnabled') !== 'false'; // Default to true
    
    if (autoSyncEnabled) {
      // Sync every 30 seconds if online
      this.syncInterval = setInterval(() => {
        if (this.isOnline && auth.currentUser && !this.isSyncing) {
          this.syncAllData();
        }
      }, 30000);
      
      console.log('🔄 Auto-sync enabled (every 30 seconds)');
    } else {
      console.log('⏸️ Auto-sync disabled');
    }
  }

  async syncAllData() {
    if (!auth.currentUser || !this.isOnline || this.isSyncing) return;
    
    this.isSyncing = true;
    this.updateSyncIndicator();
    
    console.log('🔄 Syncing data to cloud...');
    const uid = auth.currentUser.uid;
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    
    let syncedCount = 0;
    let errorCount = 0;
    
    try {
      for (const collectionName of collections) {
        try {
          const result = await this.syncCollection(collectionName, uid);
          syncedCount += result.synced;
          errorCount += result.errors;
        } catch (error) {
          console.error(`Error syncing ${collectionName}:`, error);
          errorCount++;
        }
      }
      
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('lastSyncTime', this.lastSyncTime);
      
      console.log(`✅ Sync completed: ${syncedCount} items synced, ${errorCount} errors`);
      
      if (syncedCount > 0) {
        this.showNotification(`Synced ${syncedCount} items to cloud`, 'success');
      }
      
    } catch (error) {
      console.error('Sync failed:', error);
      this.showNotification('Sync failed', 'error');
    } finally {
      this.isSyncing = false;
      this.updateSyncIndicator();
    }
    
    return { synced: syncedCount, errors: errorCount };
  }

  async syncCollection(collectionName, uid) {
    const localKey = `worklog_${collectionName}`;
    const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
    
    let synced = 0;
    let errors = 0;
    
    // Sync new/updated items
    const unsynced = localData.filter(item => !item._synced && !item._deleted);
    
    for (const item of unsynced) {
      try {
        await this.syncItem(collectionName, item, uid);
        synced++;
      } catch (error) {
        console.error(`Failed to sync ${collectionName} item:`, error);
        errors++;
      }
    }
    
    // Sync deletions
    const deletedItems = localData.filter(item => item._deleted && !item._deleteSynced);
    
    for (const item of deletedItems) {
      try {
        if (item._firebaseId) {
          await deleteDoc(doc(db, "users", uid, collectionName, item._firebaseId));
          item._deleteSynced = true;
          this.updateLocalItem(collectionName, item);
        }
      } catch (error) {
        console.error(`Failed to delete ${collectionName} item:`, error);
        errors++;
      }
    }
    
    return { synced, errors };
  }

  async syncItem(collectionName, item, uid) {
    const { _id, _cachedAt, _synced, _deleted, _deleteSynced, ...cleanData } = item;
    
    if (item._firebaseId) {
      // Update existing document
      await updateDoc(doc(db, "users", uid, collectionName, item._firebaseId), cleanData);
    } else {
      // Create new document
      const docRef = await addDoc(collection(db, "users", uid, collectionName), cleanData);
      item._firebaseId = docRef.id;
    }
    
    item._synced = true;
    item._lastSynced = new Date().toISOString();
    this.updateLocalItem(collectionName, item);
    
    return true;
  }

  updateLocalItem(collectionName, item) {
    const key = `worklog_${collectionName}`;
    const localData = JSON.parse(localStorage.getItem(key) || '[]');
    const index = localData.findIndex(i => i._id === item._id);
    
    if (index >= 0) {
      localData[index] = item;
    } else {
      localData.push(item);
    }
    
    localStorage.setItem(key, JSON.stringify(localData));
  }

  // Data operations with offline-first approach
  async getCollection(collectionName, forceRefresh = false) {
    const user = auth.currentUser;
    if (!user) return [];
    
    const localKey = `worklog_${collectionName}`;
    
    // Always check localStorage first (offline-first)
    try {
      const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
      
      if (!forceRefresh && localData.length > 0) {
        // Filter out deleted items
        const activeData = localData.filter(item => !item._deleted);
        console.log(`📁 Using local ${collectionName}: ${activeData.length} items`);
        return activeData;
      }
    } catch (error) {
      console.error(`Error reading local ${collectionName}:`, error);
    }
    
    // If online and (forceRefresh or no local data), fetch from Firestore
    if (this.isOnline) {
      try {
        console.log(`☁️ Fetching ${collectionName} from Firestore...`);
        const querySnapshot = await getDocs(collection(db, "users", user.uid, collectionName));
        const data = [];
        
        querySnapshot.forEach((doc) => {
          data.push({
            ...doc.data(),
            _id: `fb_${doc.id}`,
            _firebaseId: doc.id,
            _synced: true
          });
        });
        
        // Save to localStorage
        localStorage.setItem(localKey, JSON.stringify(data));
        console.log(`✅ Fetched ${data.length} ${collectionName} from Firestore`);
        
        return data;
      } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
        // Fallback to local storage
        const fallback = JSON.parse(localStorage.getItem(localKey) || '[]');
        return fallback.filter(item => !item._deleted);
      }
    }
    
    return [];
  }

  async saveItem(collectionName, data, itemId = null) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    
    // Generate ID if not provided
    const id = itemId || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const isUpdate = !!itemId;
    
    const item = {
      ...data,
      _id: id,
      _cachedAt: new Date().toISOString(),
      _synced: !this.isOnline, // Mark as unsynced if offline
      _isUpdate: isUpdate,
      _updatedAt: new Date().toISOString()
    };
    
    // If updating and we have Firebase ID, preserve it
    if (isUpdate) {
      const localKey = `worklog_${collectionName}`;
      const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
      const existing = localData.find(i => i._id === itemId);
      if (existing && existing._firebaseId) {
        item._firebaseId = existing._firebaseId;
      }
    }
    
    // Save to localStorage immediately
    const localKey = `worklog_${collectionName}`;
    const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
    
    if (isUpdate) {
      const index = localData.findIndex(i => i._id === itemId);
      if (index >= 0) {
        localData[index] = item;
      } else {
        localData.push(item);
      }
    } else {
      localData.push(item);
    }
    
    localStorage.setItem(localKey, JSON.stringify(localData));
    console.log(`💾 Saved to localStorage: ${collectionName} - ${id}`);
    
    // If online, sync immediately
    if (this.isOnline) {
      try {
        await this.syncItem(collectionName, item, user.uid);
      } catch (error) {
        console.error('Immediate sync failed:', error);
      }
    }
    
    return id;
  }

  async deleteItem(collectionName, itemId) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    
    const localKey = `worklog_${collectionName}`;
    const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
    const item = localData.find(i => i._id === itemId);
    
    if (!item) {
      console.warn(`Item ${itemId} not found in ${collectionName}`);
      return false;
    }
    
    // Mark as deleted in localStorage
    item._deleted = true;
    item._synced = false;
    this.updateLocalItem(collectionName, item);
    
    // If online and has Firebase ID, delete from Firestore
    if (this.isOnline && item._firebaseId) {
      try {
        await deleteDoc(doc(db, "users", user.uid, collectionName, item._firebaseId));
        item._deleteSynced = true;
        this.updateLocalItem(collectionName, item);
        console.log(`🗑️ Deleted from Firestore: ${collectionName} - ${item._firebaseId}`);
      } catch (error) {
        console.error('Error deleting from Firestore:', error);
      }
    }
    
    console.log(`🗑️ Marked for deletion: ${collectionName} - ${itemId}`);
    return true;
  }

  // Manual sync with progress indication
  async manualSync() {
    if (!auth.currentUser) {
      throw new Error('Please log in to sync');
    }
    
    if (!this.isOnline) {
      throw new Error('You are offline. Please connect to the internet to sync.');
    }
    
    console.log('🔄 Manual sync started...');
    this.showNotification('Starting sync...', 'info');
    
    try {
      const result = await this.syncAllData();
      
      const message = result.synced > 0 
        ? `Synced ${result.synced} items to cloud${result.errors > 0 ? ` (${result.errors} errors)` : ''}`
        : 'Everything is already synced';
      
      this.showNotification(message, result.errors > 0 ? 'warning' : 'success');
      
      return {
        success: true,
        synced: result.synced,
        errors: result.errors,
        message: message
      };
      
    } catch (error) {
      console.error('Manual sync failed:', error);
      this.showNotification('Sync failed: ' + error.message, 'error');
      throw error;
    }
  }

  // Update UI indicators
  updateSyncIndicator() {
    const syncIndicator = document.getElementById('syncIndicator');
    if (!syncIndicator) return;
    
    if (this.isSyncing) {
      syncIndicator.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
      syncIndicator.title = 'Syncing to cloud...';
      syncIndicator.className = 'syncing';
    } else if (!this.isOnline) {
      syncIndicator.innerHTML = '<i class="fas fa-wifi-slash"></i>';
      syncIndicator.title = 'Offline - working locally';
      syncIndicator.className = 'offline';
    } else {
      const status = this.getSyncStatus();
      if (status.unsynced > 0) {
        syncIndicator.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> ${status.unsynced}`;
        syncIndicator.title = `${status.unsynced} items pending sync`;
        syncIndicator.className = 'pending';
      } else {
        syncIndicator.innerHTML = '<i class="fas fa-cloud-check"></i>';
        syncIndicator.title = 'All data synced';
        syncIndicator.className = 'synced';
      }
    }
  }

  updateUserProfile(user) {
    const userName = document.getElementById('userName');
    if (userName) {
      userName.textContent = user.email.split('@')[0];
    }
    
    const profileUserEmail = document.getElementById('profileUserEmail');
    if (profileUserEmail) {
      profileUserEmail.textContent = user.email;
    }
  }

  showNetworkStatus(message) {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
      syncStatus.innerHTML = message;
    }
  }

  getSyncStatus() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    let total = 0;
    let unsynced = 0;
    
    collections.forEach(collection => {
      const key = `worklog_${collection}`;
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        total += data.filter(item => !item._deleted).length;
        unsynced += data.filter(item => !item._synced && !item._deleted).length;
      } catch (error) {
        console.error(`Error getting status for ${collection}:`, error);
      }
    });
    
    const lastSync = localStorage.getItem('lastSyncTime');
    const lastSyncTime = lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never';
    
    return {
      total,
      unsynced,
      lastSync: lastSyncTime,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing
    };
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Add close button event
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  async exportData() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: auth.currentUser?.email || 'anonymous',
      collections: {}
    };
    
    for (const collection of collections) {
      const key = `worklog_${collection}`;
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      exportData.collections[collection] = data.filter(item => !item._deleted);
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worklog-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ Data exported successfully');
    this.showNotification('Data exported successfully', 'success');
  }

  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          if (!data.collections || !data.version) {
            throw new Error('Invalid backup file format');
          }
          
          console.log('📥 Importing backup data...');
          this.showNotification('Importing data...', 'info');
          
          // Import each collection
          let totalImported = 0;
          for (const [collectionName, items] of Object.entries(data.collections)) {
            const key = `worklog_${collectionName}`;
            const existingData = JSON.parse(localStorage.getItem(key) || '[]');
            
            // Merge items (avoid duplicates by ID)
            const existingIds = new Set(existingData.map(item => item._id));
            const newItems = items.filter(item => !existingIds.has(item._id));
            
            if (newItems.length > 0) {
              const mergedData = [...existingData, ...newItems];
              localStorage.setItem(key, JSON.stringify(mergedData));
              totalImported += newItems.length;
              console.log(`✅ Imported ${newItems.length} ${collectionName}`);
            }
          }
          
          this.showNotification(`Imported ${totalImported} items successfully`, 'success');
          resolve(`Data imported successfully (${totalImported} items)`);
          
        } catch (error) {
          this.showNotification('Import failed: ' + error.message, 'error');
          reject(error);
        }
      };
      
      reader.onerror = () => {
        this.showNotification('Failed to read file', 'error');
        reject(new Error('Failed to read file'));
      };
      reader.readAsText(file);
    });
  }

  async clearAllData() {
    if (!confirm('Are you sure? This will delete ALL local data and sync deletions to cloud!')) {
      return false;
    }
    
    try {
      const user = auth.currentUser;
      const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
      
      // Mark all local items for deletion
      for (const collection of collections) {
        const key = `worklog_${collection}`;
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        
        for (const item of data) {
          await this.deleteItem(collection, item._id);
        }
      }
      
      // Clear local storage
      localStorage.clear();
      
      this.showNotification('All data cleared successfully', 'success');
      return true;
      
    } catch (error) {
      console.error('Error clearing data:', error);
      this.showNotification('Failed to clear data', 'error');
      return false;
    }
  }
}

// Export singleton instance
export const firebaseManager = new FirebaseManager(); */
