// firebase-config.js - SIMPLIFIED FIX
console.log('🔥 Loading SIMPLIFIED firebase-config.js');

// Single Firebase config (match with auth.js)
const firebaseConfig = {
  apiKey: "AIzaSyALlZosUAK_Zg3DTSRNJXnpw96hEVg8In0",
  authDomain: "worklogpro-4284e.firebaseapp.com",
  projectId: "worklogpro-4284e",
  storageBucket: "worklogpro-4284e.firebasestorage.app",
  messagingSenderId: "492087144637",
  appId: "1:492087144637:web:57017668f55b3361257765"
};

try {
  // Check if Firebase is already initialized
  if (typeof firebase !== 'undefined') {
    console.log('✅ Firebase is available');
    
    // Initialize only if not already initialized
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase initialized from firebase-config.js');
    } else {
      console.log('✅ Firebase already initialized');
    }
    
    // Set persistence
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => console.log('✅ Persistence set to LOCAL'))
      .catch(err => console.log('⚠️ Could not set persistence:', err.message));
      
  } else {
    console.error('❌ Firebase not loaded!');
  }
} catch (error) {
  console.error('❌ Firebase config error:', error);
}
