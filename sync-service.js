// sync-service.js - BULLETPROOF VERSION WITH DATA PROTECTION
console.log('🔄 Loading Bulletproof SyncService...');

// ==================== ULTIMATE DATA PROTECTION ====================
(function protectData() {
    // Save a backup every minute if we have students
    setInterval(() => {
        const students = localStorage.getItem('worklog_students');
        if (students && JSON.parse(students).length > 0) {
            localStorage.setItem('worklog_students_AUTO', students);
            localStorage.setItem('worklog_students_' + Date.now(), students);
        }
    }, 60000);
    
    // Block empty overwrites
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        if (key === 'worklog_students') {
            try {
                const newCount = JSON.parse(value).length;
                const current = localStorage.getItem('worklog_students');
                const currentCount = current ? JSON.parse(current).length : 0;
                
                // If trying to replace students with 0 students - BLOCK IT
                if (newCount === 0 && currentCount > 0) {
                    console.log('🚫 BLOCKED attempt to delete students');
                    return;
                }
            } catch (e) {}
        }
        originalSetItem.call(this, key, value);
    };
})();

class SyncService {
    constructor() {
        this.syncInProgress = false;
        this.lastSyncTime = localStorage.getItem('lastSyncTime');
        this.syncInterval = null;
        this.conflictResolution = 'safe-merge';
        
        // Bind methods
        this.sync = this.sync.bind(this);
        this.startAutoSync = this.startAutoSync.bind(this);
        this.stopAutoSync = this.stopAutoSync.bind(this);
        this.forceRefreshFromCloud = this.forceRefreshFromCloud.bind(this);
        this.manualRefresh = this.manualRefresh.bind(this);
        
        // Initialize
        this.init();
    }

    init() {
        console.log('🔄 SyncService initializing with DATA PROTECTION...');
        
        const autoSync = localStorage.getItem('autoSyncEnabled') === 'true';
        const dataLossPrevention = localStorage.getItem('dataLossPrevention') === 'true';
        
        if (autoSync && !dataLossPrevention) {
            console.log('⚠️ Auto-sync was enabled but starting in SAFE MODE');
            this.startAutoSync(60000);
        }
        
        window.addEventListener('online', () => {
            console.log('📶 App is online');
            this.updateSyncIndicator('Online', 'online');
        });
        
        window.addEventListener('offline', () => {
            console.log('📶 App is offline');
            this.updateSyncIndicator('Offline', 'offline');
        });
        
        localStorage.setItem('dataLossPrevention', 'true');
        
        console.log('✅ Bulletproof SyncService initialized');
    }

    // ==================== SAFE SYNC METHOD ====================
    async sync(force = false, showNotifications = false) {
        if (this.syncInProgress) {
            console.log('⚠️ Sync already in progress');
            return { success: false };
        }

        if (!navigator.onLine) {
            console.log('⚠️ Cannot sync: offline');
            this.updateSyncIndicator('Offline', 'offline');
            return { success: false };
        }

        try {
            this.syncInProgress = true;
            console.log('🔄 Starting PROTECTED sync...');
            this.updateSyncIndicator('Syncing...', 'syncing');

            const user = await this.getCurrentUser();
            if (!user) {
                console.log('⚠️ No authenticated user');
                this.updateSyncIndicator('Login Required', 'warning');
                this.syncInProgress = false;
                return { success: false };
            }

            // STEP 1: GET LOCAL DATA FIRST (BACKUP)
            const localData = this.getAllLocalData();
            const localStudentCount = localData.students?.length || 0;
            console.log(`📊 Local data: ${localStudentCount} students`);

            // STEP 2: BACKUP LOCAL DATA BEFORE ANY SYNC
            if (localStudentCount > 0) {
                localStorage.setItem('worklog_students_PRE_SYNC', JSON.stringify(localData.students));
                console.log('💾 Pre-sync backup saved');
            }

            // STEP 3: TRY TO GET REMOTE DATA
            let remoteData = null;
            let remoteError = false;
            
            try {
                console.log('☁️ Getting remote data...');
                remoteData = await this.getRemoteData(user.uid);
                console.log('✅ Got remote data:', remoteData?.students?.length || 0, 'students');
            } catch (error) {
                console.error('❌ Failed to get remote data:', error);
                remoteError = true;
                
                if (error.message?.includes('permission-denied') || error.code === 'permission-denied') {
                    console.log('🚨 PERMISSION ERROR DETECTED - USING LOCAL DATA ONLY');
                    this.showNotification('Firebase permission error - using local data', 'warning');
                    
                    this.updateSyncIndicator('Local Only', 'warning');
                    this.syncInProgress = false;
                    return { success: true, mode: 'local-only' };
                }
            }

            // STEP 4: SAFETY CHECKS
            if (remoteError) {
                console.log('🛡️ Remote error - preserving local data');
                this.updateSyncIndicator('Local Only', 'warning');
                this.syncInProgress = false;
                return { success: true, mode: 'local-only' };
            }

            // STEP 5: SAFETY CHECKS - PROTECT AGAINST EMPTY OVERWRITE
            if (this.isEmptyData(localData) && !this.isEmptyData(remoteData)) {
                console.log('🚨 SAFETY TRIGGERED: Local empty but remote has data!');
                console.log('✅ RESTORING from remote to prevent data loss');
                
                this.saveToLocalStorage(remoteData);
                this.showNotification('⚠️ Restored data from cloud (local was empty)', 'warning');
                this.updateSyncIndicator('Restored', 'success');
                this.refreshUI();
                this.syncInProgress = false;
                this.createEmergencyBackup('post-restore');
                
                return { 
                    success: true, 
                    action: 'restored_from_cloud',
                    message: 'Local was empty, restored from cloud'
                };
            }
            
            // SAFETY CHECK 2: PROTECT AGAINST CLOUD OVERWRITE
            if (this.isEmptyData(remoteData) && !this.isEmptyData(localData)) {
                console.log('🚨 SAFETY TRIGGERED: Remote empty but local has data!');
                console.log('✅ PUSHING local to cloud to preserve data');
                
                await this.saveToFirestore(user.uid, localData);
                this.showNotification('☁️ Pushed local data to cloud', 'info');
                this.updateSyncIndicator('Pushed', 'success');
                this.syncInProgress = false;
                
                return { 
                    success: true, 
                    action: 'pushed_to_cloud',
                    message: 'Remote was empty, pushed local data'
                };
            }
            
            // SAFETY CHECK 3: VERIFY DATA INTEGRITY
            if (!this.verifyDataIntegrity(localData) || !this.verifyDataIntegrity(remoteData)) {
                console.error('🚨 DATA INTEGRITY CHECK FAILED!');
                this.showNotification('❌ Data integrity check failed - sync aborted', 'error');
                this.syncInProgress = false;
                return { 
                    success: false, 
                    message: 'Data integrity check failed',
                    action: 'aborted'
                };
            }
            
            // SAFETY CHECK 4: PREVENT MASS DELETION
            if (this.hasMassDataLoss(localData, remoteData)) {
                console.error('🚨 MASS DATA LOSS DETECTED!');
                this.showNotification('❌ Mass data loss detected - sync aborted', 'error');
                this.syncInProgress = false;
                this.createEmergencyBackup('mass-loss-detected');
                
                return { 
                    success: false, 
                    message: 'Mass data loss detected',
                    action: 'aborted'
                };
            }
            
            // ============ SAFE MERGE ============
            if (localStudentCount > 0 && remoteData?.students?.length > 0) {
                console.log('🔄 Both have data - performing SAFE merge');
                
                this.createEmergencyBackup('pre-merge');
                const mergedData = this.safeMerge(localData, remoteData);
                await this.saveToFirestore(user.uid, mergedData);
                this.saveToLocalStorage(mergedData);
                console.log('✅ Safe merge complete');
                this.showNotification('🔄 Data merged successfully', 'success');
                this.createEmergencyBackup('post-merge');
                
            } else {
                console.log('ℹ️ No data to sync or one side empty - already handled');
            }

            // Update sync timestamp
            localStorage.setItem('lastSyncTime', new Date().toISOString());
            this.refreshUI();
            
            this.syncInProgress = false;
            this.updateSyncIndicator('Synced', 'success');
            
            setTimeout(() => this.updateSyncIndicator('Online', 'online'), 3000);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Sync failed:', error);
            this.updateSyncIndicator('Sync Failed', 'error');
            this.syncInProgress = false;
            
            const backup = localStorage.getItem('worklog_students_PRE_SYNC');
            if (backup) {
                const students = JSON.parse(backup);
                localStorage.setItem('worklog_students', backup);
                console.log(`🔄 Restored ${students.length} students from pre-sync backup`);
            }
            
            setTimeout(() => this.updateSyncIndicator('Online', 'online'), 3000);
            return { success: false };
        }
    }

    // ==================== FORCE REFRESH METHODS ====================
    async forceRefreshFromCloud() {
        console.log('📱 FORCE REFRESH from cloud initiated...');
        
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                console.log('⚠️ No user, cannot refresh');
                return false;
            }
            
            console.log('☁️ Fetching fresh data from Firebase...');
            const db = firebase.firestore();
            const docRef = db.collection('users').doc(user.uid).collection('data').doc('worklog');
            const serverDoc = await docRef.get({ source: 'server' });
            
            if (serverDoc.exists) {
                const freshData = serverDoc.data();
                console.log('✅ Got fresh server data:', {
                    students: freshData.students?.length || 0,
                    worklogs: freshData.worklogs?.length || 0
                });
                
                this.saveToLocalStorage(freshData);
                this.refreshUI();
                this.showNotification('📱 Data refreshed from cloud', 'success');
                return true;
            } else {
                console.log('⚠️ No data on server');
                return false;
            }
        } catch (error) {
            console.error('❌ Force refresh failed:', error);
            return false;
        }
    }

    async manualRefresh() {
        console.log('🔄 Manual refresh requested');
        this.updateSyncIndicator('Refreshing...', 'syncing');
        
        const result = await this.forceRefreshFromCloud();
        
        if (result) {
            this.updateSyncIndicator('Refreshed', 'success');
        } else {
            this.updateSyncIndicator('Refresh failed', 'error');
        }
        
        setTimeout(() => {
            this.updateSyncIndicator('Online', 'online');
        }, 3000);
        
        return result;
    }

    // ==================== SAFETY HELPER METHODS ====================
    isEmptyData(data) {
        if (!data) return true;
        const checks = [
            !data.students || data.students.length === 0,
            !data.hours || data.hours.length === 0,
            !data.worklogs || data.worklogs.length === 0
        ];
        return checks.every(Boolean);
    }
    
    verifyDataIntegrity(data) {
        if (!data) return true;
        
        if (data.students && !Array.isArray(data.students)) return false;
        if (data.hours && !Array.isArray(data.hours)) return false;
        
        if (data.students) {
            for (const student of data.students) {
                if (!student || typeof student !== 'object') return false;
                if (student.id === undefined) return false;
            }
        }
        
        return true;
    }
    
    hasMassDataLoss(local, remote) {
        if (!local || !remote) return false;
        
        const localCount = local.students?.length || 0;
        const remoteCount = remote.students?.length || 0;
        
        if (localCount > 10 && remoteCount > 10) {
            const ratio = Math.min(localCount, remoteCount) / Math.max(localCount, remoteCount);
            if (ratio < 0.5) {
                console.warn(`⚠️ Mass data loss detected: ${localCount} vs ${remoteCount} (ratio: ${ratio})`);
                return true;
            }
        }
        
        return false;
    }
    
    safeMerge(local, remote) {
        const merged = {
            students: [],
            hours: [],
            marks: [],
            attendance: [],
            payments: [],
            worklogs: [],
            settings: { ...local.settings, ...remote.settings }
        };
        
        const studentMap = new Map();
        
        if (local.students) {
            local.students.forEach(student => {
                studentMap.set(student.id, { ...student, _source: 'local' });
            });
        }
        
        if (remote.students) {
            remote.students.forEach(student => {
                studentMap.set(student.id, { ...student, _source: 'remote' });
            });
        }
        
        merged.students = Array.from(studentMap.values()).map(({ _source, ...student }) => student);
        
        merged.hours = this.mergeCollections(local.hours, remote.hours, 'id');
        merged.marks = this.mergeCollections(local.marks, remote.marks, 'id');
        merged.attendance = this.mergeCollections(local.attendance, remote.attendance, 'id');
        merged.payments = this.mergeCollections(local.payments, remote.payments, 'id');
        merged.worklogs = this.mergeCollections(local.worklogs, remote.worklogs, 'id');
        
        return merged;
    }
    
    mergeCollections(local = [], remote = [], key) {
        const map = new Map();
        
        local.forEach(item => {
            if (item && item[key]) {
                map.set(item[key], { ...item, _source: 'local' });
            }
        });
        
        remote.forEach(item => {
            if (item && item[key]) {
                map.set(item[key], { ...item, _source: 'remote' });
            }
        });
        
        return Array.from(map.values()).map(({ _source, ...item }) => item);
    }
    
    createEmergencyBackup(reason) {
        try {
            const data = this.getAllLocalData();
            const backupKey = `worklog_emergency_${reason}_${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(data));
            
            const backups = Object.keys(localStorage)
                .filter(key => key.startsWith('worklog_emergency_'))
                .sort()
                .reverse();
            
            if (backups.length > 5) {
                backups.slice(5).forEach(key => localStorage.removeItem(key));
            }
            
            console.log(`💾 Emergency backup created: ${backupKey}`);
        } catch (e) {
            console.error('Failed to create backup:', e);
        }
    }

    // ==================== EXISTING METHODS ====================
    async getCurrentUser() {
        return new Promise((resolve) => {
            const user = firebase.auth().currentUser;
            if (user) {
                resolve(user);
            } else {
                const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                    unsubscribe();
                    resolve(user);
                });
                setTimeout(() => {
                    unsubscribe();
                    resolve(null);
                }, 3000);
            }
        });
    }

    getAllLocalData() {
        return {
            students: JSON.parse(localStorage.getItem('worklog_students') || '[]'),
            hours: JSON.parse(localStorage.getItem('worklog_hours') || '[]'),
            marks: JSON.parse(localStorage.getItem('worklog_marks') || '[]'),
            attendance: JSON.parse(localStorage.getItem('worklog_attendance') || '[]'),
            payments: JSON.parse(localStorage.getItem('worklog_payments') || '[]'),
            worklogs: JSON.parse(localStorage.getItem('worklog_entries') || '[]'), 
            settings: {
                defaultHourlyRate: localStorage.getItem('defaultHourlyRate') || '25.00',
                autoSyncEnabled: localStorage.getItem('autoSyncEnabled') === 'true',
                theme: localStorage.getItem('worklog-theme') || 'dark',
                studentSortMethod: localStorage.getItem('studentSortMethod') || 'id'
            },
            lastLocalUpdate: new Date().toISOString()
        };
    }

    async getRemoteData(userId) {
        try {
            const db = firebase.firestore();
            const docRef = db.collection('users').doc(userId).collection('data').doc('worklog');
            const docSnap = await docRef.get();
            
            if (docSnap.exists) {
                console.log('✅ Got data from Firebase');
                return docSnap.data();
            } else {
                console.log('ℹ️ No data in Firebase yet');
                return null;
            }
        } catch (error) {
            console.error('Error getting remote data:', error);
            return null;
        }
    }

    async saveToFirestore(userId, data) {
        const db = firebase.firestore();
        const docRef = db.collection('users').doc(userId).collection('data').doc('worklog');
        
        await docRef.set({
            ...data,
            lastSync: firebase.firestore.FieldValue.serverTimestamp(),
            lastSyncClient: new Date().toISOString()
        }, { merge: true });
        
        console.log('✅ Data pushed to Firebase');
    }

    saveToLocalStorage(data) {
        console.log('💾 Saving data to localStorage...');
        
        if (data.students) {
            localStorage.setItem('worklog_students', JSON.stringify(data.students));
        }
        if (data.hours) {
            localStorage.setItem('worklog_hours', JSON.stringify(data.hours));
        }
        if (data.marks) {
            localStorage.setItem('worklog_marks', JSON.stringify(data.marks));
        }
        if (data.attendance) {
            localStorage.setItem('worklog_attendance', JSON.stringify(data.attendance));
        }
        if (data.payments) {
            localStorage.setItem('worklog_payments', JSON.stringify(data.payments));
        }
        if (data.worklogs) {
            localStorage.setItem('worklog_entries', JSON.stringify(data.worklogs));
        }
        
        if (data.settings) {
            if (data.settings.defaultHourlyRate) {
                localStorage.setItem('defaultHourlyRate', data.settings.defaultHourlyRate);
            }
            if (data.settings.autoSyncEnabled !== undefined) {
                localStorage.setItem('autoSyncEnabled', data.settings.autoSyncEnabled);
            }
            if (data.settings.theme) {
                localStorage.setItem('worklog-theme', data.settings.theme);
            }
            if (data.settings.studentSortMethod) {
                localStorage.setItem('studentSortMethod', data.settings.studentSortMethod);
            }
        }
        
        console.log('✅ Data saved to localStorage');
    }

    updateSyncIndicator(text, status) {
        const indicator = document.getElementById('syncIndicator');
        if (indicator) {
            indicator.textContent = text;
            indicator.className = `sync-indicator ${status}`;
        }
    }

    showNotification(message, type) {
        if (window.formHandler?.showNotification) {
            window.formHandler.showNotification(message, type);
        } else {
            console.log(`🔔 ${type}: ${message}`);
        }
    }

    refreshUI() {
        if (window.dataManager?.syncUI) {
            window.dataManager.syncUI();
        }
        if (typeof refreshAllStats === 'function') {
            refreshAllStats();
        }
    }

    startAutoSync(interval = 60000) {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(() => {
            if (navigator.onLine && !this.syncInProgress) {
                console.log('🔄 Auto-sync triggered');
                this.sync(false, false);
            }
        }, interval);
        
        localStorage.setItem('autoSyncEnabled', 'true');
        console.log(`✅ Auto-sync started (every ${interval/1000}s)`);
    }

    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        localStorage.setItem('autoSyncEnabled', 'false');
        console.log('⏹️ Auto-sync stopped');
    }
}

// Create global instance
window.syncService = new SyncService();

console.log('✅ Bulletproof sync-service.js loaded');
