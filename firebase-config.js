// Firebase Configuration for WorkLog (Agrimetrics style)
const firebaseConfig = {
    apiKey: "AIzaSyAO37tTin-BEBEXZNBtWbl57-s2UZAQxL8",
    authDomain: "worklog-3351a.firebaseapp.com",  // CHANGE THIS
    projectId: "worklog-3351a",
    storageBucket: "worklog-3351a.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",  // GET FROM FIREBASE CONSOLE
    appId: "YOUR_APP_ID"  // GET FROM FIREBASE CONSOLE
};

// Initialize Firebase - SIMPLE (no persistence settings)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Make services available
const auth = firebase.auth();
const db = firebase.firestore();

// Make global
window.auth = auth;
window.db = db;

console.log('✅ Firebase initialized for WorkLog');
