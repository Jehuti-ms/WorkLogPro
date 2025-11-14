// firebase-manager.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("🔥 Firebase Manager loaded");

class FirebaseManager {
  constructor() {
    this.user = null;
    this.isInitialized = false;
    this.lastSync = null;
  }

  async init() {
    try {
      if (!auth || !db) {
        throw new Error("Firebase SDK not available");
      }

      console.log("🔄 Initializing Firebase Manager...");
      
      return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
          this.user = user;
          if (user) {
            console.log("🟢 Manager sees user:", user.email);
            this.isInitialized = true;
            this.lastSync = new Date();
          } else {
            console.log("🔴 Manager sees no user");
            this.isInitialized = false;
          }
          resolve(true);
        });
      });

    } catch (err) {
      console.error("❌ Firebase Manager init failed:", err);
      return false;
    }
  }

  isCloudEnabled() {
    return this.isInitialized && this.user !== null;
  }

  getCloudUser() {
    return this.user;
  }

  getLastSync() {
    return this.lastSync;
  }

  async saveData(data) {
    if (!this.isCloudEnabled()) {
      throw new Error("Cloud not enabled - no user authenticated");
    }

    try {
      const userRef = doc(db, "users", this.user.uid);
      await setDoc(userRef, {
        ...data,
        lastUpdated: new Date().toISOString(),
        email: this.user.email
      }, { merge: true });
      
      this.lastSync = new Date();
      console.log("✅ Data saved to Firebase");
      return true;
    } catch (error) {
      console.error("❌ Error saving to Firebase:", error);
      throw error;
    }
  }

  async loadData() {
    if (!this.isCloudEnabled()) {
      throw new Error("Cloud not enabled - no user authenticated");
    }

    try {
      const userRef = doc(db, "users", this.user.uid);
      const snapshot = await getDoc(userRef);
      
      if (snapshot.exists()) {
        const data = snapshot.data();
        this.lastSync = new Date();
        console.log("✅ Data loaded from Firebase");
        return data;
      } else {
        console.log("📝 No existing data in Firebase");
        return null;
      }
    } catch (error) {
      console.error("❌ Error loading from Firebase:", error);
      throw error;
    }
  }

  async manualSync(data) {
    if (!this.isCloudEnabled()) {
      throw new Error("Please sign in to enable cloud sync");
    }

    try {
      await this.saveData(data);
      return true;
    } catch (error) {
      console.error("❌ Manual sync failed:", error);
      throw error;
    }
  }
}

// Create and export singleton instance
const firebaseManager = new FirebaseManager();

// Initialize when imported
firebaseManager.init().then(success => {
  if (success) {
    console.log("✅ Firebase Manager ready");
  }
});

export { firebaseManager };
