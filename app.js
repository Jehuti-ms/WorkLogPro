// app.js - SIMPLIFIED VERSION
import { firebaseManager } from './firebase-manager.js';
import { dataManager } from './data-manager.js';
import { NotificationSystem } from './notification-system.js'; // Extract to separate file
import { EnhancedStats } from './stats-manager.js'; // Extract to separate file

// Global state
let currentEditId = null;
let currentEditType = null;

// Initialize everything
async function initApp() {
  console.log('🚀 Initializing WorkLog App...');
  
  // Initialize Firebase
  await firebaseManager.initFirebaseManager();
  
  // Initialize Data Manager
  await dataManager.init();
  
  // Setup UI components
  setupTabNavigation();
  setupForms();
  setupEventListeners();
  setupProfileModal();
  setupFloatingAddButton();
  
  // Load initial data
  await loadInitialData();
  
  // Start stats system
  EnhancedStats.init();
  
  console.log('✅ App initialized successfully');
}

async function loadInitialData() {
  try {
    // Render all data
    await Promise.all([
      renderStudents(),
      renderHours(),
      renderMarks(),
      renderAttendance(),
      renderPayments(),
      populateAllDropdowns()
    ]);
    
    // Update UI
    updateHeaderStats();
    updateSyncStatus();
    
  } catch (error) {
    console.error('Error loading initial data:', error);
    NotificationSystem.notifyError('Failed to load data');
  }
}

// Simplified form handlers
async function handleStudentSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const studentData = {
    name: formData.get('studentName'),
    email: formData.get('studentEmail'),
    phone: formData.get('studentPhone'),
    gender: formData.get('studentGender'),
    rate: parseFloat(formData.get('studentRate')) || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  try {
    if (currentEditId && currentEditType === 'student') {
      await dataManager.saveStudent(studentData, currentEditId);
      NotificationSystem.notifySuccess('Student updated successfully');
      exitEditMode();
    } else {
      await dataManager.saveStudent(studentData);
      NotificationSystem.notifySuccess('Student added successfully');
    }
    
    // Refresh UI
    await renderStudents();
    await populateAllDropdowns();
    EnhancedStats.calculateStudentStats();
    
    // Clear form
    e.target.reset();
    
  } catch (error) {
    console.error('Error saving student:', error);
    NotificationSystem.notifyError('Failed to save student');
  }
}

async function deleteStudent(id) {
  if (!confirm('Are you sure you want to delete this student?')) return;
  
  try {
    await dataManager.deleteStudent(id);
    await renderStudents();
    await populateAllDropdowns();
    EnhancedStats.calculateStudentStats();
    NotificationSystem.notifySuccess('Student deleted successfully');
  } catch (error) {
    console.error('Error deleting student:', error);
    NotificationSystem.notifyError('Failed to delete student');
  }
}

// Similar simplified handlers for hours, marks, attendance, payments...

// Sync functions
async function syncNow() {
  NotificationSystem.notifyInfo('Syncing...');
  
  try {
    const status = await dataManager.forceSync();
    NotificationSystem.notifySuccess(`Sync complete. ${status.unsynced} pending changes`);
    updateSyncStatus();
  } catch (error) {
    console.error('Sync error:', error);
    NotificationSystem.notifyError('Sync failed');
  }
}

function updateSyncStatus() {
  const status = dataManager.getSyncStatus();
  const syncIndicator = document.getElementById('syncIndicator');
  const syncStatus = document.getElementById('syncStatus');
  
  if (syncIndicator) {
    syncIndicator.textContent = status.unsynced > 0 ? '🔄' : '✅';
    syncIndicator.title = `${status.unsynced} unsynced items`;
  }
  
  if (syncStatus) {
    syncStatus.textContent = status.unsynced > 0 ? 
      `☁️ ${status.unsynced} pending` : 
      '☁️ Synced';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

// Export to window for debugging
window.dataManager = dataManager;
window.firebaseManager = firebaseManager;
