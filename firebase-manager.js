// firebase-manager.js - Final Integration with Local Auth
console.log("🔥 Firebase Manager loaded");

const firebaseManager = {
  isInitialized: false,
  currentUser: null,
  syncEnabled: false,
  
  init: async function() {
    try {
      console.log("🔄 Initializing Firebase Manager...");
      
      if (typeof firebase === 'undefined') {
        throw new Error("Firebase SDK not available");
      }
      
      if (!firebase.apps.length) {
        console.warn("⚠️ Firebase app not initialized");
        return false;
      }
      
      this.isInitialized = true;
      console.log("✅ Firebase Manager initialized successfully");
      
      // Setup auth listener that works with your local auth system
      this.setupAuthListener();
      
      return true;
      
    } catch (error) {
      console.warn("❌ Firebase Manager init failed:", error);
      this.isInitialized = false;
      return false;
    }
  },
  
  setupAuthListener: function() {
    if (typeof firebaseAuth === 'undefined') {
      console.warn("⚠️ Firebase Auth not available for listener");
      return;
    }
    
    firebaseAuth.onAuthStateChanged((firebaseUser) => {
      this.currentUser = firebaseUser;
      this.syncEnabled = !!firebaseUser;
      
      const hasLocalAuth = window.Auth?.isAuthenticated?.();
      const localUser = window.Auth?.getCurrentUser?.();
      
      if (firebaseUser && hasLocalAuth) {
        console.log("✅ Dual auth: Local + Firebase");
        this.handleDualAuth(localUser, firebaseUser);
      } else if (hasLocalAuth) {
        console.log("🟡 Local auth only");
        this.handleLocalAuthOnly(localUser);
      } else {
        console.log("🔴 No auth");
        this.handleNoAuth();
      }
      
      this.updateAuthUI();
    });
  },
  
  handleDualAuth: async function(localUser, firebaseUser) {
    try {
      console.log("🔄 Dual auth detected, syncing data...");
      
      // Load cloud data and merge
      const cloudData = await this.loadData();
      if (cloudData) {
        console.log("📥 Merging cloud data with local...");
        this.mergeCloudData(cloudData);
      } else {
        console.log("☁️ No cloud data, uploading local data...");
        await this.migrateLocalToCloud(window.appData);
      }
      
      showNotification(`🔄 Cloud sync enabled for ${localUser.email}`, 'success');
      
    } catch (error) {
      console.warn("⚠️ Dual auth sync failed:", error);
    }
  },
  
  handleLocalAuthOnly: function(localUser) {
    console.log("💡 Local auth only - Firebase available for upgrade");
    
    // Show upgrade prompt once per session
    if (!sessionStorage.getItem('cloud_upgrade_offered')) {
      setTimeout(() => {
        this.showCloudUpgradePrompt(localUser);
      }, 3000);
    }
  },
  
  handleNoAuth: function() {
    console.log("🔴 No authentication - local mode only");
  },
  
  showCloudUpgradePrompt: function(localUser) {
    sessionStorage.setItem('cloud_upgrade_offered', 'true');
    
    // Create a subtle notification
    this.showUpgradeNotification(localUser.email);
  },
  
  showUpgradeNotification: function(email) {
    const notification = document.createElement('div');
    notification.className = 'cloud-upgrade-notification';
    notification.innerHTML = `
      <div class="upgrade-content">
        <span>💡 Enable cloud backup for ${email}?</span>
        <button onclick="firebaseManager.enableCloudSync()" class="btn-upgrade">Enable</button>
        <button onclick="this.parentElement.parentElement.remove()" class="btn-dismiss">×</button>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 2px solid #667eea;
      border-radius: 10px;
      padding: 15px;
      box-shadow: 0 8px 25px rgba(0,0,0,0.15);
      z-index: 1000;
      max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  },
  
  enableCloudSync: async function() {
    const localUser = window.Auth?.getCurrentUser?.();
    if (!localUser) {
      showNotification('Please log in first', 'error');
      return;
    }
    
    try {
      console.log("🚀 Enabling cloud sync...");
      
      // Remove any existing upgrade notifications
      document.querySelectorAll('.cloud-upgrade-notification').forEach(el => el.remove());
      
      // Create Firebase account with local user's email
      const email = localUser.email;
      const password = prompt(`Create a password for cloud backup:\n\nEmail: ${email}\n\nThis will enable automatic backup of your data.`);
      
      if (!password) {
        console.log("❌ Password required for cloud sync");
        return;
      }
      
      if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
      }
      
      // Show loading state
      showNotification('🔄 Creating cloud account...', 'info');
      
      // Create Firebase account
      const result = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      console.log("✅ Firebase account created:", result.user.email);
      
      // Migrate local data to cloud
      await this.migrateLocalToCloud(window.appData);
      
      showNotification('🎉 Cloud backup enabled! Your data is now safe.', 'success');
      
    } catch (error) {
      console.error("❌ Cloud sync enable failed:", error);
      
      if (error.code === 'auth/email-already-in-use') {
        this.handleExistingAccount(localUser);
      } else {
        showNotification('Failed to enable cloud backup: ' + error.message, 'error');
      }
    }
  },
  
  handleExistingAccount: function(localUser) {
    if (confirm(`Cloud account already exists for ${localUser.email}. Sign in to enable backup?`)) {
      const password = prompt(`Enter password for ${localUser.email}:`);
      if (password) {
        this.signInToExistingAccount(localUser.email, password);
      }
    }
  },
  
  signInToExistingAccount: async function(email, password) {
    try {
      const result = await firebaseAuth.signInWithEmailAndPassword(email, password);
      console.log("✅ Signed in to existing Firebase account");
      showNotification('🔓 Cloud backup enabled!', 'success');
      return true;
    } catch (error) {
      console.error("❌ Firebase sign in failed:", error);
      showNotification('Sign in failed: ' + error.message, 'error');
      return false;
    }
  },
  
  // Data operations
  saveData: async function(data) {
    if (!this.syncEnabled || !this.currentUser) {
      return false; // Silent fail - local save will handle it
    }
    
    try {
      const userId = this.currentUser.uid;
      const userData = {
        data: data,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        appVersion: "1.0.0",
        localUserId: window.Auth?.getCurrentUserId?.()
      };
      
      await firestore.collection('worklogProUsers').doc(userId).set(userData, { merge: true });
      console.log("💾 Data saved to cloud");
      return true;
    } catch (error) {
      console.warn("❌ Cloud save failed:", error);
      return false;
    }
  },
  
  loadData: async function() {
    if (!this.syncEnabled || !this.currentUser) {
      return null;
    }
    
    try {
      const userId = this.currentUser.uid;
      const doc = await firestore.collection('worklogProUsers').doc(userId).get();
      
      if (doc.exists) {
        const userData = doc.data();
        console.log("📥 Cloud data loaded");
        return userData.data;
      }
      return null;
    } catch (error) {
      console.warn("❌ Cloud load failed:", error);
      return null;
    }
  },
  
  mergeCloudData: function(cloudData) {
    if (!cloudData) return;
    
    console.log("🔄 Merging cloud data...");
    
    // Simple merge strategy - cloud data takes precedence
    if (Array.isArray(cloudData.students)) {
      window.appData.students = cloudData.students;
    }
    if (Array.isArray(cloudData.payments)) {
      window.appData.payments = cloudData.payments;
      window.allPayments = cloudData.payments.slice();
    }
    if (Array.isArray(cloudData.hours)) {
      window.appData.hours = cloudData.hours;
    }
    if (Array.isArray(cloudData.marks)) {
      window.appData.marks = cloudData.marks;
    }
    if (Array.isArray(cloudData.attendance)) {
      window.appData.attendance = cloudData.attendance;
    }
    
    // Save merged data locally
    if (window.saveAllData) {
      window.saveAllData();
    }
    
    // Refresh UI
    if (window.renderStudents) window.renderStudents();
    if (window.renderPayments) window.renderPayments();
    if (window.updateStats) window.updateStats();
    
    console.log("✅ Cloud data merged successfully");
  },
  
  migrateLocalToCloud: async function(localData) {
    if (!this.syncEnabled) return false;
    
    try {
      await this.saveData(localData);
      console.log("🚀 Local data migrated to cloud");
      return true;
    } catch (error) {
      console.error("❌ Migration failed:", error);
      return false;
    }
  },
  
  // UI Management
  updateAuthUI: function() {
    if (!document.getElementById('syncStatus')) return;
    
    const hasLocalAuth = window.Auth?.isAuthenticated?.();
    const hasCloudAuth = this.syncEnabled;
    const localUser = window.Auth?.getCurrentUser?.();
    
    const syncStatus = document.getElementById('syncStatus');
    const userInfo = document.getElementById('userInfo');
    const cloudActions = document.getElementById('cloudActions');
    
    if (syncStatus) {
      if (hasCloudAuth && hasLocalAuth) {
        syncStatus.textContent = '🟢 Cloud Backup';
        syncStatus.className = 'sync-status online';
      } else if (hasLocalAuth) {
        syncStatus.textContent = '🟡 Local Only';
        syncStatus.className = 'sync-status local';
      } else {
        syncStatus.textContent = '🔴 Offline';
        syncStatus.className = 'sync-status offline';
      }
    }
    
    if (userInfo) {
      userInfo.style.display = hasLocalAuth ? 'flex' : 'none';
      if (localUser) {
        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.textContent = localUser.email;
      }
    }
    
    if (cloudActions) {
      cloudActions.style.display = hasCloudAuth ? 'flex' : 'none';
    }
  },
  
  // Manual sync
  manualSync: async function() {
    if (!this.syncEnabled) {
      showNotification('Enable cloud backup first', 'warning');
      return false;
    }
    
    try {
      await this.saveData(window.appData);
      showNotification('✅ Data backed up to cloud!', 'success');
      return true;
    } catch (error) {
      console.error("❌ Manual sync failed:", error);
      showNotification('Backup failed: ' + error.message, 'error');
      return false;
    }
  },
  
  // Sign out from cloud (preserves local auth)
  signOut: async function() {
    try {
      await firebaseAuth.signOut();
      this.syncEnabled = false;
      this.updateAuthUI();
      showNotification('Signed out from cloud backup', 'info');
      return true;
    } catch (error) {
      console.error("❌ Cloud sign out failed:", error);
      return false;
    }
  },
  
  // Utility methods
  isCloudEnabled: function() {
    return this.syncEnabled;
  },
  
  getCloudUser: function() {
    return this.currentUser;
  }
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    if (typeof firebase !== 'undefined') {
      firebaseManager.init();
    }
  }, 1000);
});

// Global exposure
window.firebaseManager = firebaseManager;

// Notification helper
function showNotification(message, type = 'info') {
  // Use existing notification system or create simple one
  if (typeof window.showNotification === 'function') {
    window.showNotification(message, type);
  } else {
    // Simple fallback
    const style = type === 'success' ? 'background: #10b981;' : 
                 type === 'error' ? 'background: #ef4444;' : 
                 type === 'warning' ? 'background: #f59e0b;' : 
                 'background: #3b82f6;';
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      z-index: 10000;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      ${style}
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 4000);
  }
}
