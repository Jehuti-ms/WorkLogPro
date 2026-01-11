// firebase-manager.js - ULTRA SIMPLE (NO AUTO-REDIRECTS)
console.log('🔥 Loading ULTRA-SIMPLE firebase-manager.js');

// Only expose basic functions
window.firebaseManager = {
  // Get current user WITHOUT any checks
  getCurrentUser: function() {
    if (typeof firebase === 'undefined') return null;
    return firebase.auth().currentUser;
  },
  
  // Check auth WITHOUT redirects
  checkAuth: function() {
    console.log('🔍 Checking auth (NO REDIRECT)');
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = firebase.auth().currentUser;
        console.log('Auth result:', user ? 'User found' : 'No user');
        resolve(user);
      }, 1000); // 1 second delay
    });
  },
  
  // Setup listener WITHOUT actions
  setupAuthListener: function() {
    console.log('🔐 Setting up auth listener (NO ACTIONS)');
    return new Promise((resolve) => {
      if (typeof firebase === 'undefined') {
        resolve(null);
        return;
      }
      
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? 'User' : 'No user');
        unsubscribe(); // Unsubscribe immediately
        resolve(user);
      });
      
      // Timeout after 3 seconds
      setTimeout(() => {
        unsubscribe();
        console.log('⏰ Auth listener timeout');
        resolve(null);
      }, 3000);
    });
  },
  
  // Simple logout
  logout: function() {
    return firebase.auth().signOut();
  }
};

console.log('✅ ULTRA-SIMPLE firebase-manager.js loaded');
