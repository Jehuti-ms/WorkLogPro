// firebase-config.js - FIXED VERSION
console.log('🔥 Loading FIXED firebase-config.js');

// Use the SAME config as auth.js
const firebaseConfig = {
  apiKey: "AIzaSyDdLP_LgiC6EgzC3hUP_mGuNW4_BUEACs8",
  authDomain: "worklogpro-4284e.firebaseapp.com",
  projectId: "worklogpro-4284e",
  storageBucket: "worklogpro-4284e.firebasestorage.app",
  messagingSenderId: "299567233913",
  appId: "1:299567233913:web:7232a5a5a8aa9b79948da8",
  measurementId: "G-7JMG3LLJXX"
};

try {
  if (typeof firebase !== 'undefined') {
    console.log('✅ Firebase is available');
    
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase initialized with CORRECT config');
    } else {
      console.log('✅ Firebase already initialized');
    }
    
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => console.log('✅ Persistence set to LOCAL'))
      .catch(err => console.log('⚠️ Could not set persistence:', err.message));
      
  } else {
    console.error('❌ Firebase not loaded!');
  }
} catch (error) {
  console.error('❌ Firebase config error:', error);
}
