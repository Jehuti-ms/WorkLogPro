// app.js - Cloud Sync + Stats + Profile Dropdown Integration

import { auth, db } from "./firebase-config.js";
import { initFirebaseManager } from "./firebase-manager.js";

// Firebase Auth SDK
import { onAuthStateChanged } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase Firestore SDK
import { doc, setDoc, getDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ----------------------
// DOM Elements
// ----------------------
const userName     = document.getElementById("userName");
const userEmail    = document.getElementById("userEmail");
const userMenu     = document.getElementById("userMenu");

const statStudents = document.getElementById("statStudents");
const statHours    = document.getElementById("statHours");
const statEarnings = document.getElementById("statEarnings");

// ----------------------
// Auth State Listener
// ----------------------
onAuthStateChanged(auth, async user => {
  if (user) {
    console.log("✅ User authenticated:", user.email);

    // Update profile button + dropdown
    userName.textContent  = user.displayName || "User";
    userEmail.textContent = user.email || "No email";

    // Show app UI
    document.querySelector(".container").style.display = "block";
    const gate = document.getElementById("authGate");
    if (gate) gate.style.display = "none";

    // Route to Students tab
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelector('[data-tab="students"]').classList.add("active");
    document.getElementById("students").classList.add("active");

    // Initialize Firebase Manager (cloud sync)
    initFirebaseManager(user);

    // Load usage stats
    await loadUserStats(user.uid);

  } else {
    console.log("🚫 No user authenticated");
    document.querySelector(".container").style.display = "none";
    const gate = document.getElementById("authGate");
    if (gate) gate.style.display = "block";
  }
});

// ----------------------
// Usage Stats Functions
// ----------------------
async function loadUserStats(uid) {
  try {
    const statsRef = doc(db, "users", uid);
    const statsSnap = await getDoc(statsRef);

    if (statsSnap.exists()) {
      const stats = statsSnap.data();
      statStudents.textContent = stats.students || 0;
      statHours.textContent    = stats.hours || 0;
      statEarnings.textContent = stats.earnings ? stats.earnings.toFixed(2) : "0.00";
    } else {
      // Initialize stats if none exist
      await setDoc(statsRef, { students: 0, hours: 0, earnings: 0 });
      statStudents.textContent = 0;
      statHours.textContent    = 0;
      statEarnings.textContent = "0.00";
    }
  } catch (err) {
    console.error("❌ Error loading stats:", err);
  }
}

export async function updateUserStats(uid, newStats) {
  try {
    const statsRef = doc(db, "users", uid);
    await setDoc(statsRef, newStats, { merge: true });
    console.log("✅ Stats updated:", newStats);

    // Refresh dropdown values
    if (newStats.students !== undefined) statStudents.textContent = newStats.students;
    if (newStats.hours !== undefined) statHours.textContent = newStats.hours;
    if (newStats.earnings !== undefined) statEarnings.textContent = newStats.earnings.toFixed(2);
  } catch (err) {
    console.error("❌ Error updating stats:", err);
  }
}

// ----------------------
// Hook into existing actions
// ----------------------

// Add Student
window.addStudent = async function() {
  // ... your existing add student logic ...

  const uid = auth.currentUser.uid;
  const currentCount = parseInt(statStudents.textContent) || 0;
  await updateUserStats(uid, { students: currentCount + 1 });
};

// Log Hours
window.logHours = async function() {
  // ... your existing log hours logic ...

  const uid = auth.currentUser.uid;
  const hoursWorked = parseFloat(document.getElementById("hoursWorked").value) || 0;
  const totalPay    = parseFloat(document.getElementById("totalPay").value) || 0;

  const currentHours    = parseFloat(statHours.textContent) || 0;
  const currentEarnings = parseFloat(statEarnings.textContent) || 0;

  await updateUserStats(uid, { 
    hours: currentHours + hoursWorked,
    earnings: currentEarnings + totalPay
  });
};

// Record Payment
window.recordPayment = async function() {
  // ... your existing record payment logic ...

  const uid = auth.currentUser.uid;
  const paymentAmount = parseFloat(document.getElementById("paymentAmount").value) || 0;

  const currentEarnings = parseFloat(statEarnings.textContent) || 0;

  await updateUserStats(uid, { 
    earnings: currentEarnings + paymentAmount
  });
};
