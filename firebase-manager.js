// firebase-manager.js - WorklogPro Manager
console.log("🔥 Firebase Manager loaded");

const firebaseManager = {
  isInitialized: false,
  currentUser: null,
  
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
      
      // Test Firestore connection
      try {
        await firestore.enableNetwork();
        console.log("✅ Firestore network enabled");
      } catch (networkError) {
        console.warn("⚠️ Firestore network issue:", networkError);
      }
      
      this.isInitialized = true;
      console.log("✅ Firebase Manager initialized successfully");
      
      // Setup auth listener
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
    
    firebaseAuth.onAuthStateChanged((user) => {
      this.currentUser = user;
      if (user) {
        console.log("👤 User signed in:", user.email);
        this.updateAuthUI(true, user.email);
        
        // Auto-load data when user signs in
        setTimeout(() => {
          this.loadData().then(data => {
            if (data) {
              console.log("🔄 Auto-synced data on login");
            }
          });
        }, 1000);
      } else {
        console.log("👤 User signed out");
        this.updateAuthUI(false);
        
        // Optional: Show login prompt
        this.showLoginPrompt();
      }
    });
  },
  
  updateAuthUI: function(isLoggedIn, email = '') {
    const userInfo = document.getElementById('userInfo');
    const loginForm = document.getElementById('loginForm');
    const syncStatus = document.getElementById('syncStatus');
    
    if (userInfo) {
      userInfo.style.display = isLoggedIn ? 'block' : 'none';
      if (isLoggedIn) {
        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.textContent = email;
      }
    }
    
    if (loginForm) {
      loginForm.style.display = isLoggedIn ? 'none' : 'block';
    }
    
    if (syncStatus) {
      syncStatus.textContent = isLoggedIn ? '🟢 Online' : '🔴 Offline';
      syncStatus.className = `sync-status ${isLoggedIn ? 'online' : 'offline'}`;
    }
  },
  
  showLoginPrompt: function() {
    // Optional: Show a subtle login prompt
    console.log("💡 User not authenticated - data will be saved locally");
  },
  
  saveData: async function(data) {
    if (!this.isInitialized || !this.currentUser) {
      console.log("📝 User not authenticated, data saved locally only");
      return false;
    }
    
    try {
      const userId = this.currentUser.uid;
      const userData = {
        data: data,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        appVersion: "1.0.0"
      };
      
      await firestore.collection('worklogProUsers').doc(userId).set(userData, { merge: true });
      console.log("💾 Data saved to Firebase for user:", userId);
      return true;
    } catch (error) {
      console.warn("❌ Failed to save to Firebase:", error);
      return false;
    }
  },
  
  loadData: async function() {
    if (!this.isInitialized || !this.currentUser) {
      console.log("📝 User not authenticated, loading local data only");
      return null;
    }
    
    try {
      const userId = this.currentUser.uid;
      const doc = await firestore.collection('worklogProUsers').doc(userId).get();
      
      if (doc.exists) {
        const userData = doc.data();
        console.log("📥 Data loaded from Firebase:", {
          lastUpdated: userData.lastUpdated?.toDate(),
          students: userData.data?.students?.length || 0,
          payments: userData.data?.payments?.length || 0
        });
        return userData.data;
      } else {
        console.log("📥 No existing data found in Firebase for this user");
        return null;
      }
    } catch (error) {
      console.warn("❌ Failed to load from Firebase:", error);
      return null;
    }
  },
  
  // Authentication methods
  signIn: async function(email, password) {
    try {
      const result = await firebaseAuth.signInWithEmailAndPassword(email, password);
      console.log("✅ Signed in successfully:", result.user.email);
      return { success: true, user: result.user };
    } catch (error) {
      console.error("❌ Sign in failed:", error.message);
      return { success: false, error: error.message };
    }
  },
  
  signUp: async function(email, password) {
    try {
      const result = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      console.log("✅ Account created successfully:", result.user.email);
      return { success: true, user: result.user };
    } catch (error) {
      console.error("❌ Sign up failed:", error.message);
      return { success: false, error: error.message };
    }
  },
  
  signOut: async function() {
    try {
      await firebaseAuth.signOut();
      console.log("✅ Signed out successfully");
      return true;
    } catch (error) {
      console.error("❌ Sign out failed:", error);
      return false;
    }
  },
  
  // Utility methods
  getCurrentUser: function() {
    return this.currentUser;
  },
  
  isUserAuthenticated: function() {
    return !!this.currentUser;
  },
  
  // Data migration helper
  migrateLocalToCloud: async function(localData) {
    if (!this.isUserAuthenticated()) {
      console.warn("⚠️ User not authenticated for migration");
      return false;
    }
    
    try {
      await this.saveData(localData);
      console.log("🚀 Local data migrated to cloud successfully");
      return true;
    } catch (error) {
      console.error("❌ Migration failed:", error);
      return false;
    }
  }
};

// Auto-initialize when loaded
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    if (typeof firebase !== 'undefined') {
      firebaseManager.init();
    }
  }, 500);
});

// Make it globally available
window.firebaseManager = firebaseManager;
