// firebase-config.js - SIMPLE VERSION
console.log('🔥 Loading SIMPLE firebase-config.js');

// Check if Firebase already loaded
if (typeof firebase === 'undefined') {
  console.error('❌ Firebase not loaded! Check CDN scripts.');
} else {
  console.log('✅ Firebase loaded successfully');
  
  const firebaseConfig = {
    apiKey: "AIzaSyALlZosUAK_Zg3DTSRNJXnpw96hEVg8In0",
    authDomain: "worklogpro-4284e.firebaseapp.com",
    projectId: "worklogpro-4284e",
    storageBucket: "worklogpro-4284e.firebasestorage.app",
    messagingSenderId: "492087144637",
    appId: "1:492087144637:web:57017668f55b3361257765"
  };

  try {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized');
    
    // Set persistence
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE)
      .then(() => console.log('✅ Persistence set to NONE'))
      .catch(err => console.log('⚠️ Persistence error:', err.message));
    
  } catch (error) {
    console.error('❌ Firebase init error:', error.message);
  }

  // Add this to firebase-config.js after initialization:
firebase.auth().onAuthStateChanged((user) => {
  if (user && window.AuthManager) {
    console.log('🔥 Firebase auth detected, storing...');
    window.AuthManager.storeAuth(user);
  }
});
}
