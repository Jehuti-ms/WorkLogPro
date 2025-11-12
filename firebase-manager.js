// firebase-manager.js - WorklogPro Cloud Sync Manager
console.log("🔥 Firebase Manager loaded");

const firebaseManager = {
  isInitialized: false,
  currentUser: null,
  syncEnabled: false,
  lastSync: null,
  
  // Initialize the Firebase manager
  init: async function() {
    try {
      console.log("🔄 Initializing Firebase Manager...");
      
      // Check if Firebase is available
      if (typeof firebase === 'undefined') {
        throw new Error("Firebase SDK not available");
      }
      
      // Wait for Firebase to be ready
      if (!firebase.apps.length) {
        console.warn("⚠️ Firebase app not initialized in config");
        return false;
      }
      
      this.isInitialized = true;
      console.log("✅ Firebase Manager initialized successfully");
      
      // Set up authentication listener
      this.setupAuthListener();
      
      return true;
      
    } catch (error) {
      console.warn("❌ Firebase Manager init failed:", error);
      this.isInitialized = false;
      return false;
    }
  },
  
  // Set up authentication state listener
  setupAuthListener: function() {
    if (typeof firebaseAuth === 'undefined') {
      console.warn("⚠️ Firebase Auth not available");
      return;
    }
    
    firebaseAuth.onAuthStateChanged((user) => {
      console.log("🔐 Auth state changed:", user ? user.email : "No user");
      this.currentUser = user;
      this.syncEnabled = !!user;
      
      if (user) {
        this.handleUserSignedIn(user);
      } else {
        this.handleUserSignedOut();
      }
      
      this.updateUI();
    });
  },
  
  // Handle user sign-in
  handleUserSignedIn: async function(user) {
    console.log("👤 User signed in to Firebase:", user.email);
    
    // Check if we have local authentication
    const hasLocalAuth = window.Auth && window.Auth.isAuthenticated && window.Auth.isAuthenticated();
    const localUser = window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser();
    
    if (hasLocalAuth && localUser) {
      console.log("✅ Dual authentication: Local + Firebase");
      await this.syncData();
    } else {
      console.log("🔐 Firebase auth only");
      this.showNotification("🔐 Signed in to cloud backup", "success");
    }
  },
  
  // Handle user sign-out
  handleUserSignedOut: function() {
    console.log("👤 User signed out from Firebase");
    this.syncEnabled = false;
    this.showNotification("🔓 Signed out from cloud backup", "info");
  },
  
  // Sync data between local and cloud
  syncData: async function() {
    if (!this.syncEnabled) return;
    
    try {
      console.log("🔄 Starting data sync...");
      
      // Load data from cloud
      const cloudData = await this.loadData();
      
      if (cloudData) {
        console.log("📥 Cloud data found, merging...");
        await this.mergeData(cloudData);
      } else {
        console.log("☁️ No cloud data found, uploading local data...");
        await this.uploadLocalData();
      }
      
      this.lastSync = new Date();
      console.log("✅ Data sync completed");
      
    } catch (error) {
      console.error("❌ Data sync failed:", error);
      this.showNotification("Sync failed: " + error.message, "error");
    }
  },
  
  // Load data from Firebase
  loadData: async function() {
    if (!this.syncEnabled || !this.currentUser) {
      return null;
    }
    
    try {
      const userId = this.currentUser.uid;
      const doc = await firestore.collection('worklogProUsers').doc(userId).get();
      
      if (doc.exists) {
        const userData = doc.data();
        console.log("📥 Loaded cloud data:", {
          students: userData.data?.students?.length || 0,
          payments: userData.data?.payments?.length || 0,
          lastUpdated: userData.lastUpdated?.toDate()
        });
        return userData.data;
      }
      return null;
    } catch (error) {
      console.warn("❌ Failed to load from cloud:", error);
      return null;
    }
  },
  
  // Save data to Firebase
  saveData: async function(data) {
    if (!this.syncEnabled || !this.currentUser) {
      return false;
    }
    
    try {
      const userId = this.currentUser.uid;
      const userData = {
        data: data,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        appVersion: "1.0.0",
        syncTime: new Date().toISOString()
      };
      
      await firestore.collection('worklogProUsers').doc(userId).set(userData, { merge: true });
      this.lastSync = new Date();
      console.log("💾 Data saved to cloud");
      return true;
    } catch (error) {
      console.warn("❌ Failed to save to cloud:", error);
      return false;
    }
  },
  
  // Merge cloud data with local data
  mergeData: async function(cloudData) {
    if (!cloudData) return;
    
    console.log("🔄 Merging cloud data with local data...");
    
    // Store original counts for reporting
    const originalCounts = {
      students: window.appData?.students?.length || 0,
      payments: window.appData?.payments?.length || 0,
      hours: window.appData?.hours?.length || 0
    };
    
    // Merge data (cloud data takes precedence for simplicity)
    if (cloudData.students) window.appData.students = cloudData.students;
    if (cloudData.payments) {
      window.appData.payments = cloudData.payments;
      if (window.allPayments) window.allPayments = cloudData.payments.slice();
    }
    if (cloudData.hours) window.appData.hours = cloudData.hours;
    if (cloudData.marks) window.appData.marks = cloudData.marks;
    if (cloudData.attendance) window.appData.attendance = cloudData.attendance;
    if (cloudData.settings) window.appData.settings = { ...window.appData.settings, ...cloudData.settings };
    
    // Save merged data locally
    if (window.saveAllData) {
      window.saveAllData();
    }
    
    // Calculate changes
    const newCounts = {
      students: window.appData?.students?.length || 0,
      payments: window.appData?.payments?.length || 0,
      hours: window.appData?.hours?.length || 0
    };
    
    console.log("✅ Data merge completed:", {
      students: `+${newCounts.students - originalCounts.students}`,
      payments: `+${newCounts.payments - originalCounts.payments}`,
      hours: `+${newCounts.hours - originalCounts.hours}`
    });
    
    // Refresh UI
    this.refreshUI();
    
    this.showNotification("✅ Cloud data loaded successfully", "success");
  },
  
  // Upload local data to cloud
  uploadLocalData: async function() {
    if (!window.appData) {
      console.warn("⚠️ No local data to upload");
      return;
    }
    
    try {
      await this.saveData(window.appData);
      this.showNotification("📤 Local data backed up to cloud", "success");
    } catch (error) {
      console.error("❌ Failed to upload local data:", error);
      throw error;
    }
  },
  
  // Refresh UI after data changes
  refreshUI: function() {
    if (window.renderStudents) window.renderStudents();
    if (window.renderPayments) window.renderPayments();
    if (window.renderHours) window.renderHours();
    if (window.renderMarks) window.renderMarks();
    if (window.renderAttendance) window.renderAttendance();
    if (window.updateStats) window.updateStats();
  },
  
  // Manual sync function
  manualSync: async function() {
    if (!this.syncEnabled) {
      this.showNotification("Please enable cloud sync first", "warning");
      return false;
    }
    
    try {
      this.showNotification("🔄 Syncing with cloud...", "info");
      await this.saveData(window.appData);
      this.showNotification("✅ Data synced to cloud!", "success");
      return true;
    } catch (error) {
      console.error("❌ Manual sync failed:", error);
      this.showNotification("Sync failed: " + error.message, "error");
      return false;
    }
  },
  
  // Enable cloud sync (create account or sign in)
  enableCloudSync: async function() {
    const localUser = window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser();
    
    if (!localUser) {
      this.showNotification("Please log in first", "error");
      return;
    }
    
    try {
      const email = localUser.email;
      const password = prompt(`Create a password for cloud backup:\n\nEmail: ${email}\n\nThis will enable automatic cloud backup of your data.`);
      
      if (!password) {
        this.showNotification("Password required for cloud backup", "warning");
        return;
      }
      
      if (password.length < 6) {
        this.showNotification("Password must be at least 6 characters", "error");
        return;
      }
      
      this.showNotification("🔄 Creating cloud account...", "info");
      
      // Create Firebase account
      const result = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      console.log("✅ Firebase account created:", result.user.email);
      
      // Upload local data
      await this.uploadLocalData();
      
      this.showNotification("🎉 Cloud backup enabled! Your data is now safe.", "success");
      
    } catch (error) {
      console.error("❌ Cloud sync enable failed:", error);
      
      if (error.code === 'auth/email-already-in-use') {
        this.handleExistingAccount(localUser.email);
      } else {
        this.showNotification("Failed to enable cloud backup: " + error.message, "error");
      }
    }
  },
  
  // Handle existing Firebase account
  handleExistingAccount: async function(email) {
    if (confirm(`Cloud account already exists for ${email}. Sign in to enable backup?`)) {
      const password = prompt(`Enter password for ${email}:`);
      if (password) {
        try {
          await firebaseAuth.signInWithEmailAndPassword(email, password);
          this.showNotification("🔓 Cloud backup enabled!", "success");
        } catch (error) {
          this.showNotification("Sign in failed: " + error.message, "error");
        }
      }
    }
  },
  
  // Sign out from Firebase (preserves local auth)
  signOut: async function() {
    try {
      await firebaseAuth.signOut();
      this.showNotification("Signed out from cloud backup", "info");
      return true;
    } catch (error) {
      console.error("❌ Cloud sign out failed:", error);
      this.showNotification("Sign out failed", "error");
      return false;
    }
  },
  
  // Update UI elements
  updateUI: function() {
    if (!document.getElementById('syncStatus')) return;
    
    const syncStatus = document.getElementById('syncStatus');
    const cloudControls = document.getElementById('cloudControls');
    const cloudPrompt = document.getElementById('cloudPrompt');
    
    if (syncStatus) {
      if (this.syncEnabled) {
        syncStatus.textContent = '🟢 Cloud Backup';
        syncStatus.className = 'sync-status online';
        syncStatus.title = `Last sync: ${this.lastSync ? this.lastSync.toLocaleTimeString() : 'Never'}`;
      } else if (window.Auth && window.Auth.isAuthenticated && window.Auth.isAuthenticated()) {
        syncStatus.textContent = '🟡 Local Only';
        syncStatus.className = 'sync-status local';
        syncStatus.title = 'Enable cloud backup for data safety';
      } else {
        syncStatus.textContent = '🔴 Offline';
        syncStatus.className = 'sync-status offline';
        syncStatus.title = 'Sign in to enable cloud backup';
      }
    }
    
    if (cloudControls) {
      cloudControls.style.display = this.syncEnabled ? 'flex' : 'none';
    }
    
    if (cloudPrompt) {
      const hasLocalAuth = window.Auth && window.Auth.isAuthenticated && window.Auth.isAuthenticated();
      cloudPrompt.style.display = (hasLocalAuth && !this.syncEnabled) ? 'flex' : 'none';
    }
  },
  
  // Utility methods
  isCloudEnabled: function() {
    return this.syncEnabled;
  },
  
  getCloudUser: function() {
    return this.currentUser;
  },
  
  getLastSync: function() {
    return this.lastSync;
  },
  
  // Notification helper
  showNotification: function(message, type = 'info') {
    console.log(`📢 ${type}: ${message}`);
    
    // Use existing notification system or fallback
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      // Simple fallback notification
      const notification = document.createElement('div');
      notification.className = `notification notification-${type}`;
      notification.innerHTML = `
        <div class="notification-content">
          <span class="notification-message">${message}</span>
          <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
      `;
      
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 300px;
        animation: slideInRight 0.3s ease;
      `;
      
      document.body.appendChild(notification);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 5000);
    }
  }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    if (typeof firebase !== 'undefined') {
      firebaseManager.init();
    }
  }, 1000);
});

// Make globally available
window.firebaseManager = firebaseManager;

// Add CSS for notifications if not exists
if (!document.querySelector('#notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    .notification-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    
    .notification-close {
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .notification-close:hover {
      opacity: 0.8;
    }
  `;
  document.head.appendChild(style);
}
