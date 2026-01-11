// firebase-manager.js - FIXED VERSION (No auto-redirects)
console.log('🔥 Loading FIXED firebase-manager.js...');

// ==================== CONFIGURATION ====================
const AUTH_DELAY = 2000; // 2 second delay before auth checks
const MAX_AUTH_WAIT = 5000; // 5 second timeout

// ==================== AUTH STATE TRACKING ====================
let authStateChecked = false;
let authStateResolvers = [];
let currentAuthUser = null;

// ==================== DELAYED AUTH CHECK ====================
function setupDelayedAuthCheck() {
  console.log('⏳ Setting up DELAYED auth check...');
  
  return new Promise((resolve) => {
    // Add to resolvers list
    authStateResolvers.push(resolve);
    
    // If auth already checked, resolve immediately
    if (authStateChecked) {
      resolve(currentAuthUser);
      return;
    }
    
    // Start the delayed check if not already running
    if (authStateResolvers.length === 1) {
      startDelayedAuthCheck();
    }
  });
}

function startDelayedAuthCheck() {
  console.log(`⏳ Waiting ${AUTH_DELAY}ms before auth check...`);
  
  setTimeout(() => {
    console.log('🔐 Performing delayed auth check...');
    
    try {
      // Get current user from Firebase
      const user = firebase.auth().currentUser;
      currentAuthUser = user;
      authStateChecked = true;
      
      console.log('✅ Auth check complete. User:', user ? user.email : 'None');
      
      // Resolve all waiting promises
      authStateResolvers.forEach(resolve => resolve(user));
      authStateResolvers = [];
      
      // Store auth state for future
      if (user) {
        localStorage.setItem('firebase_last_user', user.email);
        localStorage.setItem('firebase_last_check', Date.now().toString());
      }
      
    } catch (error) {
      console.error('❌ Auth check error:', error);
      
      // Resolve with null on error
      authStateResolvers.forEach(resolve => resolve(null));
      authStateResolvers = [];
    }
  }, AUTH_DELAY);
}

// ==================== SAFE AUTH LISTENER ====================
function setupSafeAuthListener() {
  console.log('🔐 Setting up SAFE auth listener...');
  
  return new Promise((resolve) => {
    try {
      // Set persistence to LOCAL (not SESSION)
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
          console.log('✅ Auth persistence set to LOCAL');
        })
        .catch(err => {
          console.warn('⚠️ Could not set persistence (private mode?):', err);
        });
      
      // Listen for auth changes WITH DELAY
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        console.log('🔐 Auth state changed:', user ? `User ${user.email}` : 'No user');
        
        // Store the user
        currentAuthUser = user;
        authStateChecked = true;
        
        if (user) {
          // User is signed in - update localStorage
          localStorage.setItem('firebase_auth_user', JSON.stringify({
            email: user.email,
            uid: user.uid,
            timestamp: Date.now()
          }));
          localStorage.setItem('firebase_last_auth', Date.now().toString());
          
          console.log('✅ User authenticated');
        } else {
          // User signed out - DO NOT REDIRECT HERE
          console.log('⚠️ No user - NOT redirecting from listener');
          
          // Clear old auth data
          localStorage.removeItem('firebase_auth_user');
        }
        
        // Resolve the promise
        resolve(user);
        
        // Unsubscribe to prevent multiple calls
        setTimeout(() => unsubscribe(), 100);
      });
      
      // Safety timeout
      setTimeout(() => {
        if (!authStateChecked) {
          console.log('⏰ Auth listener timeout - forcing resolution');
          resolve(null);
        }
      }, MAX_AUTH_WAIT);
      
    } catch (error) {
      console.error('❌ Error setting up auth listener:', error);
      resolve(null);
    }
  });
}

// ==================== SIMPLE AUTH CHECK ====================
function checkAuthSimple() {
  console.log('🔍 Simple auth check...');
  
  return new Promise((resolve) => {
    // First check localStorage (fast)
    const storedAuth = localStorage.getItem('firebase_auth_user');
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        const timestamp = parsed.timestamp || 0;
        
        // If auth was within last hour, accept it
        if (Date.now() - timestamp < 3600000) {
          console.log('✅ Using cached auth from localStorage');
          resolve({ 
            uid: parsed.uid, 
            email: parsed.email,
            displayName: parsed.email.split('@')[0],
            isCached: true 
          });
          return;
        }
      } catch (e) {
        console.log('❌ Could not parse cached auth');
      }
    }
    
    // Then check Firebase (slower)
    const user = firebase.auth().currentUser;
    console.log('Firebase currentUser:', user ? 'Found' : 'Not found');
    resolve(user);
  });
}

// ==================== GET CURRENT USER ====================
function getCurrentUser() {
  // First try Firebase
  const fbUser = firebase.auth().currentUser;
  if (fbUser) return fbUser;
  
  // Then try localStorage
  const stored = localStorage.getItem('firebase_auth_user');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        uid: parsed.uid,
        email: parsed.email,
        displayName: parsed.email.split('@')[0],
        isCached: true
      };
    } catch (e) {
      return null;
    }
  }
  
  return null;
}

// ==================== LOGOUT ====================
function logout() {
  console.log('🚪 Logging out...');
  
  return new Promise((resolve, reject) => {
    firebase.auth().signOut()
      .then(() => {
        console.log('✅ Logout successful');
        
        // Clear local storage
        localStorage.removeItem('firebase_auth_user');
        localStorage.removeItem('firebase_last_auth');
        localStorage.removeItem('firebase_last_user');
        localStorage.removeItem('firebase_last_check');
        
        resolve(true);
      })
      .catch(error => {
        console.error('❌ Logout error:', error);
        reject(error);
      });
  });
}

// ==================== FIRESTORE HELPERS ====================
async function saveToFirestore(collection, data) {
  try {
    const user = getCurrentUser();
    if (!user) {
      console.log('⚠️ No user, skipping Firestore save');
      return { success: false, error: 'No user' };
    }
    
    const db = firebase.firestore();
    const docRef = db.collection('users').doc(user.uid).collection(collection).doc();
    
    await docRef.set({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      userId: user.uid
    });
    
    console.log(`✅ Saved to ${collection}`);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error(`❌ Error saving to ${collection}:`, error);
    return { success: false, error: error.message };
  }
}

async function loadFromFirestore(collection) {
  try {
    const user = getCurrentUser();
    if (!user) {
      console.log('⚠️ No user, skipping Firestore load');
      return { success: false, data: [], error: 'No user' };
    }
    
    const db = firebase.firestore();
    const snapshot = await db.collection('users')
      .doc(user.uid)
      .collection(collection)
      .orderBy('updatedAt', 'desc')
      .get();
    
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Loaded ${data.length} items from ${collection}`);
    return { success: true, data };
  } catch (error) {
    console.error(`❌ Error loading from ${collection}:`, error);
    return { success: false, data: [], error: error.message };
  }
}

// ==================== INITIALIZATION ====================
function initFirebaseManager() {
  console.log('🎯 Initializing Firebase Manager...');
  
  // Check if Firebase is available
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase not loaded!');
    return false;
  }
  
  if (!firebase.auth) {
    console.error('❌ Firebase Auth not available!');
    return false;
  }
  
  console.log('✅ Firebase Manager ready');
  return true;
}

// ==================== EXPORT ====================
window.firebaseManager = {
  // Auth functions (SAFE versions)
  setupAuthListener: setupSafeAuthListener,
  checkAuth: checkAuthSimple,
  checkAuthDelayed: setupDelayedAuthCheck,
  getCurrentUser,
  logout,
  
  // Firestore functions
  saveToFirestore,
  loadFromFirestore,
  
  // Utility
  init: initFirebaseManager
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM loaded - initializing Firebase Manager');
  initFirebaseManager();
});

console.log('✅ FIXED firebase-manager.js loaded');
