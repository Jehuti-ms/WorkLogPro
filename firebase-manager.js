// firebase-manager.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

console.log("🔥 Firebase Manager loaded");

// --- Manager init ---
export function initFirebaseManager() {
  try {
    if (!auth || !db) {
      throw new Error("Firebase SDK not available");
    }

    console.log("🔄 Initializing Firebase Manager...");
    console.log("✅ Firebase Manager initialized successfully");

    // Example: listen for auth changes
    onAuthStateChanged(auth, user => {
      if (user) {
        console.log("🟢 Manager sees user:", user.email);
      } else {
        console.log("🔴 Manager sees no user");
      }
    });

    return { auth, db };
  } catch (err) {
    console.error("❌ Firebase Manager init failed:", err);
    return null;
  }
}
