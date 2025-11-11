// firebase-manager.js - NON-MODULE VERSION
console.log("🔥 Firebase Manager loaded");

const firebaseManager = {
  isInitialized: false,
  
  init: async function() {
    try {
      if (typeof firebase === 'undefined') {
        throw new Error("Firebase SDK not available");
      }
      
      if (!firebase.apps.length) {
        console.warn("⚠️ Firebase not initialized in config");
        return false;
      }
      
      this.isInitialized = true;
      console.log("✅ Firebase Manager initialized");
      return true;
      
    } catch (error) {
      console.warn("❌ Firebase Manager init failed:", error);
      this.isInitialized = false;
      return false;
    }
  },
  
  saveData: async function(data) {
    if (!this.isInitialized || !firebaseAuth.currentUser) {
      console.log("📝 User not authenticated, data saved locally only");
      return false;
    }
    
    try {
      const userId = firebaseAuth.currentUser.uid;
      await firestore.collection('userData').doc(userId).set({
        data: data,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log("💾 Data saved to Firebase");
      return true;
    } catch (error) {
      console.warn("❌ Failed to save to Firebase:", error);
      return false;
    }
  },
  
  loadData: async function() {
    if (!this.isInitialized || !firebaseAuth.currentUser) {
      console.log("📝 User not authenticated, loading local data only");
      return null;
    }
    
    try {
      const userId = firebaseAuth.currentUser.uid;
      const doc = await firestore.collection('userData').doc(userId).get();
      
      if (doc.exists) {
        const data = doc.data().data;
        console.log("📥 Data loaded from Firebase");
        return data;
      } else {
        console.log("📥 No data found in Firebase");
        return null;
      }
    } catch (error) {
      console.warn("❌ Failed to load from Firebase:", error);
      return null;
    }
  },
  
  // Auth state listener
  setupAuthListener: function() {
    if (typeof firebaseAuth === 'undefined') return;
    
    firebaseAuth.onAuthStateChanged((user) => {
      if (user) {
        console.log("👤 User signed in:", user.email);
        // Auto-sync data when user signs in
        this.loadData().then(data => {
          if (data) {
            // You can add logic to merge data here
            console.log("🔄 Auto-synced data on login");
          }
        });
      } else {
        console.log("👤 User signed out");
      }
    });
  },
  
  // Sign in method
  signIn: async function(email, password) {
    try {
      await firebaseAuth.signInWithEmailAndPassword(email, password);
      return true;
    } catch (error) {
      console.error("❌ Sign in failed:", error);
      return false;
    }
  },
  
  // Sign up method
  signUp: async function(email, password) {
    try {
      await firebaseAuth.createUserWithEmailAndPassword(email, password);
      return true;
    } catch (error) {
      console.error("❌ Sign up failed:", error);
      return false;
    }
  },
  
  // Sign out method
  signOut: async function() {
    try {
      await firebaseAuth.signOut();
      return true;
    } catch (error) {
      console.error("❌ Sign out failed:", error);
      return false;
    }
  }
};

// Initialize auth listener when manager loads
if (typeof firebaseAuth !== 'undefined') {
  firebaseManager.setupAuthListener();
}

// Make it globally available
window.firebaseManager = firebaseManager;
