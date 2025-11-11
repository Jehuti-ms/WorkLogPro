// firebase-manager.js - WorklogPro Firebase Manager
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { 
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot 
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

class WorklogProFirebase {
  constructor(config) {
    this.app = initializeApp(config);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.currentUser = null;
    
    this.initAuthListener();
  }

  // Authentication
  initAuthListener() {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      if (user) {
        console.log('👤 WorklogPro User:', user.email);
        this.onUserSignedIn(user);
      } else {
        console.log('🚪 User signed out');
        this.onUserSignedOut();
      }
    });
  }

  async signUp(email, password, userData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.auth, email, password
      );
      
      // Save additional user data to Firestore
      await this.saveUserProfile(userCredential.user.uid, {
        email,
        ...userData,
        createdAt: new Date().toISOString()
      });
      
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(
        this.auth, email, password
      );
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      await signOut(this.auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // User Profile Management
  async saveUserProfile(uid, profileData) {
    try {
      await addDoc(collection(this.db, 'users'), {
        uid,
        ...profileData
      });
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  }

  // Students Management
  async addStudent(studentData) {
    try {
      const docRef = await addDoc(collection(this.db, 'students'), {
        ...studentData,
        userId: this.currentUser.uid,
        createdAt: new Date().toISOString()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getStudents() {
    try {
      const q = query(
        collection(this.db, 'students'),
        where('userId', '==', this.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting students:', error);
      return [];
    }
  }

  async updateStudent(studentId, studentData) {
    try {
      await updateDoc(doc(this.db, 'students', studentId), {
        ...studentData,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteStudent(studentId) {
    try {
      await deleteDoc(doc(this.db, 'students', studentId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Hours Tracking
  async logHours(hoursData) {
    try {
      const docRef = await addDoc(collection(this.db, 'hours'), {
        ...hoursData,
        userId: this.currentUser.uid,
        createdAt: new Date().toISOString(),
        total: (hoursData.hours || 0) * (hoursData.rate || 0)
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getHours(month = null, year = null) {
    try {
      let q = query(
        collection(this.db, 'hours'),
        where('userId', '==', this.currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      let hours = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter by month/year if specified
      if (month !== null && year !== null) {
        hours = hours.filter(entry => {
          const entryDate = new Date(entry.date || entry.createdAt);
          return entryDate.getMonth() === month && entryDate.getFullYear() === year;
        });
      }

      return hours;
    } catch (error) {
      console.error('Error getting hours:', error);
      return [];
    }
  }

  // Real-time Listeners
  setupStudentsListener(callback) {
    const q = query(
      collection(this.db, 'students'),
      where('userId', '==', this.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const students = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(students);
    });
  }

  setupHoursListener(callback) {
    const q = query(
      collection(this.db, 'hours'),
      where('userId', '==', this.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const hours = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(hours);
    });
  }

  // Event handlers (to be overridden by main app)
  onUserSignedIn(user) {
    console.log('WorklogPro: User signed in', user.email);
  }

  onUserSignedOut() {
    console.log('WorklogPro: User signed out');
  }
}

export default WorklogProFirebase;
