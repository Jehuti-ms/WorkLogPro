// firebase-manager.js
import { auth, db } from "./firebase-config.js";
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
  query,
  orderBy,
  where,
  deleteDoc,
  writeBatch,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export class FirebaseManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pendingSync = [];
    this.syncInterval = null;
    this.initNetworkListener();
  }

  initNetworkListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Online - syncing queued operations');
      this.processPendingSync();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Offline - operations will be queued');
    });
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
        console.warn('⚠️ Multiple tabs open, persistence can only be enabled in one tab');
      } else if (err.code === 'unimplemented') {
        console.warn('⚠️ Browser does not support offline persistence');
      }
    }
  }

  setupAuthListener() {
    onAuthStateChanged(auth, async user => {
      if (user) {
        console.log("🟢 User authenticated:", user.email);
        await this.initUserData(user.uid);
        this.processPendingSync();
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
      }
      
      // Load user settings to localStorage
      const userData = userSnap.exists() ? userSnap.data() : {
        settings: { defaultRate: 25.00, autoSync: true, theme: 'dark' }
      };
      
      localStorage.setItem('userSettings', JSON.stringify(userData.settings));
      
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
    
    // Sync every 60 seconds if auto-sync is enabled
    this.syncInterval = setInterval(() => {
      const autoSync = localStorage.getItem('autoSyncEnabled') === 'true';
      if (this.isOnline && auth.currentUser && autoSync) {
        this.syncAllData();
      }
    }, 60000);
  }

  async syncAllData() {
    if (!auth.currentUser || !this.isOnline) return;
    
    console.log('🔄 Auto-syncing data...');
    const uid = auth.currentUser.uid;
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    
    let syncedCount = 0;
    
    for (const collectionName of collections) {
      try {
        const localKey = `worklog_${collectionName}`;
        const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
        const unsynced = localData.filter(item => !item._synced && !item._deleted);
        
        for (const item of unsynced) {
          await this.syncItem(collectionName, item, uid);
          syncedCount++;
        }
        
        // Handle deleted items
        const deletedItems = localData.filter(item => item._deleted && !item._deleteSynced);
        for (const item of deletedItems) {
          if (item._firebaseId) {
            await deleteDoc(doc(db, "users", uid, collectionName, item._firebaseId));
            item._deleteSynced = true;
            this.updateLocalItem(collectionName, item);
          }
        }
        
      } catch (error) {
        console.error(`Error syncing ${collectionName}:`, error);
      }
    }
    
    if (syncedCount > 0) {
      console.log(`✅ Auto-sync completed: ${syncedCount} items synced`);
    }
  }

  async syncItem(collectionName, item, uid) {
    try {
      const { _id, _cachedAt, _synced, _deleted, _deleteSynced, ...cleanData } = item;
      
      if (item._firebaseId) {
        // Update existing
        await updateDoc(doc(db, "users", uid, collectionName, item._firebaseId), cleanData);
      } else {
        // Create new
        const docRef = await addDoc(collection(db, "users", uid, collectionName), cleanData);
        item._firebaseId = docRef.id;
      }
      
      item._synced = true;
      item._lastSynced = new Date().toISOString();
      this.updateLocalItem(collectionName, item);
      
      return true;
    } catch (error) {
      console.error(`Failed to sync ${collectionName}:`, error);
      return false;
    }
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
    
    // Always check localStorage first
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
    
    // If online, fetch from Firestore
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

  async exportData() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
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
          
          // Import each collection
          for (const [collectionName, items] of Object.entries(data.collections)) {
            const key = `worklog_${collectionName}`;
            const existingData = JSON.parse(localStorage.getItem(key) || '[]');
            
            // Merge items (avoid duplicates by ID)
            const existingIds = new Set(existingData.map(item => item._id));
            const newItems = items.filter(item => !existingIds.has(item._id));
            
            if (newItems.length > 0) {
              const mergedData = [...existingData, ...newItems];
              localStorage.setItem(key, JSON.stringify(mergedData));
              console.log(`✅ Imported ${newItems.length} ${collectionName}`);
            }
          }
          
          resolve('Data imported successfully');
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
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
    
    return {
      total,
      unsynced,
      lastSync: localStorage.getItem('lastSyncTime') || 'Never',
      isOnline: this.isOnline
    };
  }

  async manualSync() {
    if (!auth.currentUser) {
      throw new Error('Please log in to sync');
    }
    
    console.log('🔄 Manual sync started...');
    
    try {
      await this.syncAllData();
      localStorage.setItem('lastSyncTime', new Date().toLocaleString());
      
      const status = this.getSyncStatus();
      console.log('✅ Manual sync completed');
      
      return {
        success: true,
        message: `Synced ${status.total} items (${status.unsynced} pending)`,
        status
      };
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const firebaseManager = new FirebaseManager();
