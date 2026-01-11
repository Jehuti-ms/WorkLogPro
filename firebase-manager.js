// firebase-manager.js - UPDATED
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  enableIndexedDbPersistence,
  clearIndexedDbPersistence,
  waitForPendingWrites
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("🔥 Firebase Manager loaded");

export class FirebaseManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pendingOperations = [];
    this.syncQueue = [];
    this.initNetworkListener();
  }

  initNetworkListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Online - syncing queued operations');
      this.processSyncQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Offline - operations will be queued');
    });
  }

  async initFirebaseManager() {
    try {
      if (!auth || !db) {
        throw new Error("Firebase SDK not available");
      }

      console.log("🔄 Initializing Firebase Manager...");
      
      // Enable offline persistence
      await this.enableOfflinePersistence();
      
      // Set up auth state listener
      this.setupAuthListener();
      
      // Initialize sync system
      this.initSyncSystem();
      
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
        console.log("🟢 Manager sees user:", user.email);
        
        // Initialize user-specific data
        await this.initUserData(user.uid);
        
        // Process any pending operations
        this.processSyncQueue();
      } else {
        console.log("🔴 Manager sees no user");
        this.clearUserData();
      }
    });
  }

  initSyncSystem() {
    // Sync every 30 seconds when online
    setInterval(() => {
      if (this.isOnline && auth.currentUser) {
        this.syncLocalToCloud();
      }
    }, 30000);
  }

  async initUserData(uid) {
    try {
      // Create user document if it doesn't exist
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
            theme: 'light'
          }
        });
        console.log('✅ User document created');
      }
    } catch (error) {
      console.error('Error initializing user data:', error);
    }
  }

  clearUserData() {
    // Clear user-specific cache
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    collections.forEach(collection => {
      localStorage.removeItem(`worklog_${collection}`);
    });
    console.log('🧹 User data cleared from localStorage');
  }

  async syncLocalToCloud() {
    if (!auth.currentUser || !this.isOnline) return;
    
    console.log('🔄 Syncing local changes to cloud...');
    const uid = auth.currentUser.uid;
    
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    
    for (const collection of collections) {
      try {
        const localKey = `worklog_${collection}`;
        const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
        const unsynced = localData.filter(item => !item._synced);
        
        console.log(`📦 ${collection}: ${unsynced.length} unsynced items`);
        
        for (const item of unsynced) {
          await this.syncItem(collection, item, uid);
        }
      } catch (error) {
        console.error(`Error syncing ${collection}:`, error);
      }
    }
    
    console.log('✅ Sync completed');
  }

  async syncItem(collection, item, uid) {
    try {
      const { _id, _cachedAt, _synced, ...firebaseData } = item;
      
      if (item._firebaseId) {
        // Update existing document
        await updateDoc(doc(db, "users", uid, collection, item._firebaseId), firebaseData);
      } else {
        // Create new document
        const docRef = await addDoc(collection(db, "users", uid, collection), firebaseData);
        item._firebaseId = docRef.id;
      }
      
      item._synced = true;
      item._lastSynced = new Date().toISOString();
      
      // Update localStorage
      this.updateLocalItem(collection, item);
      
      console.log(`✅ Synced ${collection}: ${item._id}`);
    } catch (error) {
      console.error(`❌ Failed to sync ${collection}:`, error);
      throw error;
    }
  }

  updateLocalItem(collection, updatedItem) {
    const key = `worklog_${collection}`;
    const localData = JSON.parse(localStorage.getItem(key) || '[]');
    const index = localData.findIndex(item => item._id === updatedItem._id);
    
    if (index >= 0) {
      localData[index] = updatedItem;
    } else {
      localData.push(updatedItem);
    }
    
    localStorage.setItem(key, JSON.stringify(localData));
  }

  async getData(collectionName, forceRefresh = false) {
    const user = auth.currentUser;
    if (!user) return [];
    
    const localKey = `worklog_${collectionName}`;
    
    // Always try to load from localStorage first (offline-first)
    try {
      const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
      
      if (!forceRefresh && localData.length > 0) {
        console.log(`📁 Using local cache for ${collectionName}: ${localData.length} items`);
        return localData;
      }
    } catch (error) {
      console.error('Error reading localStorage:', error);
    }
    
    // If online and forceRefresh or no local data, fetch from Firestore
    if (this.isOnline) {
      try {
        console.log(`☁️ Fetching ${collectionName} from Firestore...`);
        const querySnapshot = await getDocs(collection(db, "users", user.uid, collectionName));
        const data = [];
        
        querySnapshot.forEach((doc) => {
          data.push({
            id: doc.id,
            ...doc.data(),
            _firebaseId: doc.id,
            _synced: true
          });
        });
        
        // Save to localStorage
        localStorage.setItem(localKey, JSON.stringify(data));
        console.log(`✅ Fetched ${data.length} ${collectionName} from Firestore`);
        
        return data;
      } catch (error) {
        console.error(`❌ Error fetching ${collectionName}:`, error);
        
        // Fallback to localStorage if available
        const fallback = JSON.parse(localStorage.getItem(localKey) || '[]');
        console.log(`🔄 Using fallback data: ${fallback.length} items`);
        return fallback;
      }
    }
    
    return [];
  }

  async saveData(collectionName, data, isUpdate = false, existingId = null) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    
    const item = {
      ...data,
      _id: existingId || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      _cachedAt: new Date().toISOString(),
      _synced: !this.isOnline, // Mark as unsynced if offline
      _isUpdate: isUpdate
    };
    
    if (existingId && data._firebaseId) {
      item._firebaseId = data._firebaseId;
    }
    
    // Save to localStorage immediately
    const localKey = `worklog_${collectionName}`;
    const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
    
    if (isUpdate) {
      const index = localData.findIndex(i => i._id === item._id);
      if (index >= 0) {
        localData[index] = item;
      } else {
        localData.push(item);
      }
    } else {
      localData.push(item);
    }
    
    localStorage.setItem(localKey, JSON.stringify(localData));
    console.log(`💾 Saved to localStorage: ${collectionName} - ${item._id}`);
    
    // If online, sync immediately
    if (this.isOnline) {
      try {
        await this.syncItem(collectionName, item, user.uid);
      } catch (error) {
        console.error('Immediate sync failed, will retry later:', error);
      }
    }
    
    return item._id;
  }

  async deleteData(collectionName, itemId) {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    
    const localKey = `worklog_${collectionName}`;
    const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
    const item = localData.find(i => i._id === itemId);
    
    if (!item) {
      console.warn(`Item ${itemId} not found in local storage`);
      return false;
    }
    
    // Remove from localStorage
    const filteredData = localData.filter(i => i._id !== itemId);
    localStorage.setItem(localKey, JSON.stringify(filteredData));
    
    // If online, delete from Firestore
    if (this.isOnline && item._firebaseId) {
      try {
        await deleteDoc(doc(db, "users", user.uid, collectionName, item._firebaseId));
        console.log(`🗑️ Deleted from Firestore: ${collectionName} - ${item._firebaseId}`);
      } catch (error) {
        console.error('Error deleting from Firestore:', error);
        
        // If delete fails, mark for later deletion
        item._deleted = true;
        item._synced = false;
        filteredData.push(item);
        localStorage.setItem(localKey, JSON.stringify(filteredData));
      }
    } else if (item._firebaseId) {
      // Offline - mark for deletion
      item._deleted = true;
      item._synced = false;
      filteredData.push(item);
      localStorage.setItem(localKey, JSON.stringify(filteredData));
    }
    
    console.log(`🗑️ Deleted from local: ${collectionName} - ${itemId}`);
    return true;
  }

  getSyncStatus() {
    const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
    const status = {
      total: 0,
      unsynced: 0,
      lastSync: localStorage.getItem('lastSync') || 'Never'
    };
    
    collections.forEach(collection => {
      const key = `worklog_${collection}`;
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        status.total += data.length;
        status.unsynced += data.filter(item => !item._synced).length;
      } catch (error) {
        console.error(`Error getting status for ${collection}:`, error);
      }
    });
    
    return status;
  }

  async clearAllData() {
    const user = auth.currentUser;
    if (!user) return;
    
    if (confirm('Are you sure? This will delete ALL local and cloud data!')) {
      try {
        // Clear localStorage
        const keys = Object.keys(localStorage).filter(key => key.startsWith('worklog_'));
        keys.forEach(key => localStorage.removeItem(key));
        
        // Clear Firestore data
        const collections = ['students', 'hours', 'marks', 'attendance', 'payments'];
        
        for (const collection of collections) {
          const querySnapshot = await getDocs(collection(db, "users", user.uid, collection));
          const batch = writeBatch(db);
          
          querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
          });
          
          await batch.commit();
          console.log(`🗑️ Cleared ${collection} from Firestore`);
        }
        
        NotificationSystem.notifySuccess('All data cleared successfully');
        setTimeout(() => location.reload(), 1000);
      } catch (error) {
        console.error('Error clearing data:', error);
        NotificationSystem.notifyError('Failed to clear all data');
      }
    }
  }
}

// Export singleton instance
export const firebaseManager = new FirebaseManager();
