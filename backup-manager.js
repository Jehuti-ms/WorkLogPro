// backup-manager.js - Automatic Data Backup System
console.log('💾 Loading BackupManager...');

const BackupManager = {
        init: function() {
        console.log('💾 Initializing BackupManager...');
        
        // Create backup on page load
        setTimeout(() => this.createBackup('page-load'), 5000);
        
        // Create backup every hour
        setInterval(() => this.createBackup('hourly'), 3600000);
    
        // Keep only last 3 backups instead of 10 - FIXED
        const existingBackups = Object.keys(localStorage).filter(key => key.startsWith('worklog_backup_'));
        if (existingBackups.length > 3) {
            existingBackups.sort().reverse().slice(3).forEach(key => localStorage.removeItem(key));
        }
        
        // Create backup before page unload
        window.addEventListener('beforeunload', () => {
            this.createBackup('before-unload');
        });
        
        // Listen for data changes
        this.setupDataChangeListener();
        
        console.log('✅ BackupManager ready');
    },
    
    setupDataChangeListener: function() {
        // Monkey patch localStorage methods to detect changes
        const originalSetItem = localStorage.setItem;
        const self = this;
        
        localStorage.setItem = function(key, value) {
            originalSetItem.call(this, key, value);
            
            // If worklog data changed, create backup
            if (key.includes('worklog_') && !key.includes('backup')) {
                self.scheduleBackup('data-change');
            }
        };
    },
    
    scheduleBackup: function(reason) {
        // Debounce backups (wait 2 seconds after last change)
        if (this.backupTimeout) {
            clearTimeout(this.backupTimeout);
        }
        
        this.backupTimeout = setTimeout(() => {
            this.createBackup(reason);
        }, 2000);
    },
    
    createBackup: function(reason) {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                reason: reason,
                data: {
                    students: JSON.parse(localStorage.getItem('worklog_students') || '[]'),
                    hours: JSON.parse(localStorage.getItem('worklog_hours') || '[]'),
                    marks: JSON.parse(localStorage.getItem('worklog_marks') || '[]'),
                    attendance: JSON.parse(localStorage.getItem('worklog_attendance') || '[]'),
                    payments: JSON.parse(localStorage.getItem('worklog_payments') || '[]'),
                    worklogs: JSON.parse(localStorage.getItem('worklog_entries') || '[]'),
                    settings: {
                        defaultHourlyRate: localStorage.getItem('defaultHourlyRate'),
                        autoSyncEnabled: localStorage.getItem('autoSyncEnabled'),
                        theme: localStorage.getItem('worklog-theme')
                    }
                }
            };
            
            // Save to localStorage
            const backupKey = `worklog_backup_${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(backup));
            
            // Keep only last 10 backups
            this.cleanupOldBackups();
            
            console.log(`✅ Backup created (${reason}): ${backupKey}`);
            
        } catch (error) {
            console.error('❌ Backup failed:', error);
        }
    },
    
    cleanupOldBackups: function() {
        const backups = Object.keys(localStorage)
            .filter(key => key.startsWith('worklog_backup_'))
            .sort()
            .reverse();
        
        if (backups.length > 10) {
            backups.slice(10).forEach(key => {
                localStorage.removeItem(key);
                console.log(`🧹 Removed old backup: ${key}`);
            });
        }
    },
    
    restoreLatestBackup: function() {
        const backups = Object.keys(localStorage)
            .filter(key => key.startsWith('worklog_backup_'))
            .sort()
            .reverse();
        
        if (backups.length === 0) {
            alert('No backups found');
            return false;
        }
        
        try {
            const latestBackup = localStorage.getItem(backups[0]);
            const backupData = JSON.parse(latestBackup);
            
            console.log('🔄 Restoring from backup:', backupData.timestamp);
            
            // Restore data
            if (backupData.data.students) {
                localStorage.setItem('worklog_students', JSON.stringify(backupData.data.students));
            }
            if (backupData.data.worklogs) {
                localStorage.setItem('worklog_entries', JSON.stringify(backupData.data.worklogs));
            }
            
            // Refresh UI
            if (window.dataManager) {
                window.dataManager.syncUI();
            }
            
            alert(`✅ Restored from backup: ${new Date(backupData.timestamp).toLocaleString()}`);
            return true;
            
        } catch (error) {
            console.error('❌ Restore failed:', error);
            alert('Restore failed: ' + error.message);
            return false;
        }
    },
    
    listBackups: function() {
        const backups = Object.keys(localStorage)
            .filter(key => key.startsWith('worklog_backup_'))
            .sort()
            .reverse();
        
        console.log('📋 Available backups:');
        backups.forEach(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                console.log(`  ${key}: ${data.timestamp} (${data.reason})`);
            } catch (e) {
                console.log(`  ${key}: (corrupted)`);
            }
        });
        
        return backups;
    }
};

// ==================== SMART BACKUP MANAGER ====================
// Add this to your backup-manager.js file

const SmartBackupManager = {
    // Configuration
    MAX_BACKUPS: 10,           // Maximum number of backups to keep
    MAX_BACKUP_AGE_DAYS: 7,    // Delete backups older than 7 days
    AUTO_CLEANUP: true,        // Automatically clean old backups
    
    // Initialize the manager
    init: function() {
        console.log('🗑️ Smart Backup Manager initialized');
        if (this.AUTO_CLEANUP) {
            this.cleanupOldBackups();
            // Run cleanup every hour
            setInterval(() => this.cleanupOldBackups(), 60 * 60 * 1000);
        }
    },
    
    // Main cleanup function
    cleanupOldBackups: function() {
        console.log('🧹 Running backup cleanup...');
        
        const backups = [];
        const now = Date.now();
        const maxAgeMs = this.MAX_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;
        
        // Collect all backups
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('worklog_backup_') || key.includes('emergency'))) {
                // Extract timestamp from key (format: worklog_backup_1234567890)
                const timestamp = parseInt(key.split('_').pop());
                if (!isNaN(timestamp)) {
                    backups.push({
                        key: key,
                        timestamp: timestamp,
                        age: now - timestamp
                    });
                }
            }
        }
        
        // Sort by timestamp (oldest first)
        backups.sort((a, b) => a.timestamp - b.timestamp);
        
        let removedCount = 0;
        
        // Remove by age
        const oldBackups = backups.filter(b => b.age > maxAgeMs);
        oldBackups.forEach(backup => {
            localStorage.removeItem(backup.key);
            removedCount++;
            console.log(`🗑️ Removed old backup: ${backup.key} (${Math.floor(backup.age / (24*60*60*1000))} days old)`);
        });
        
        // Remove excess backups (keep only MAX_BACKUPS newest)
        const remainingBackups = backups.filter(b => b.age <= maxAgeMs);
        if (remainingBackups.length > this.MAX_BACKUPS) {
            const toRemove = remainingBackups.slice(0, remainingBackups.length - this.MAX_BACKUPS);
            toRemove.forEach(backup => {
                localStorage.removeItem(backup.key);
                removedCount++;
                console.log(`🗑️ Removed excess backup: ${backup.key}`);
            });
        }
        
        if (removedCount > 0) {
            console.log(`✅ Cleanup complete: removed ${removedCount} old backups`);
        } else {
            console.log(`✅ No cleanup needed. ${backups.length} backups within limits`);
        }
        
        return removedCount;
    },
    
    // Create a new backup with automatic cleanup
    createBackup: function(data, type = 'manual') {
        // First, check if we need to cleanup
        if (this.AUTO_CLEANUP) {
            this.cleanupOldBackups();
        }
        
        // Create the backup
        const timestamp = Date.now();
        const key = `worklog_backup_${timestamp}`;
        
        try {
            localStorage.setItem(key, JSON.stringify({
                data: data,
                type: type,
                timestamp: timestamp,
                version: '1.0'
            }));
            console.log(`💾 Backup created: ${key}`);
            return key;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('⚠️ Storage full! Forcing emergency cleanup...');
                this.emergencyCleanup();
                // Try again after cleanup
                try {
                    localStorage.setItem(key, JSON.stringify({
                        data: data,
                        type: type,
                        timestamp: timestamp,
                        version: '1.0'
                    }));
                    console.log(`💾 Backup created after cleanup: ${key}`);
                    return key;
                } catch (retryError) {
                    console.error('❌ Still cannot create backup after cleanup');
                    return null;
                }
            }
            console.error('❌ Backup failed:', error);
            return null;
        }
    },
    
    // Emergency cleanup - more aggressive
    emergencyCleanup: function() {
        console.log('🚨 EMERGENCY CLEANUP - Removing oldest 50% of backups');
        
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('worklog_backup_') || key.includes('emergency'))) {
                const timestamp = parseInt(key.split('_').pop());
                if (!isNaN(timestamp)) {
                    backups.push({ key: key, timestamp: timestamp });
                }
            }
        }
        
        // Sort by timestamp (oldest first)
        backups.sort((a, b) => a.timestamp - b.timestamp);
        
        // Remove oldest 50%
        const toRemove = Math.floor(backups.length / 2);
        for (let i = 0; i < toRemove; i++) {
            localStorage.removeItem(backups[i].key);
            console.log(`🗑️ Emergency removal: ${backups[i].key}`);
        }
        
        console.log(`✅ Emergency cleanup complete. Removed ${toRemove} backups`);
    },
    
    // Get backup stats
    getStats: function() {
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('worklog_backup_')) {
                const timestamp = parseInt(key.split('_').pop());
                if (!isNaN(timestamp)) {
                    backups.push({
                        key: key,
                        timestamp: timestamp,
                        date: new Date(timestamp).toLocaleString()
                    });
                }
            }
        }
        backups.sort((a, b) => b.timestamp - a.timestamp);
        
        console.log(`📊 Backup Stats: ${backups.length} total backups`);
        console.log(`   Most recent: ${backups[0]?.date || 'None'}`);
        console.log(`   Oldest: ${backups[backups.length-1]?.date || 'None'}`);
        
        return {
            total: backups.length,
            newest: backups[0],
            oldest: backups[backups.length-1],
            all: backups
        };
    },
    
    // Manual cleanup trigger
    manualCleanup: function() {
        console.log('🧹 Manual cleanup triggered');
        return this.cleanupOldBackups();
    }
};

// Initialize on page load
if (typeof window !== 'undefined') {
    SmartBackupManager.init();
    window.SmartBackupManager = SmartBackupManager;
}

// Replace the existing createBackup function with the smart version
const originalCreateBackup = window.BackupManager?.createBackup;
if (window.BackupManager) {
    window.BackupManager.createBackup = function(data, type) {
        return SmartBackupManager.createBackup(data, type);
    };
}

// Add this at the beginning of your createBackup function
createBackup: function(data, type = 'auto') {
    // Limit backups to 5 maximum
    const backups = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('worklog_backup_')) {
            backups.push(key);
        }
    }
    
    // If more than 5 backups, delete the oldest
    if (backups.length >= 5) {
        backups.sort(); // Oldest first (by timestamp in key)
        const toDelete = backups.slice(0, backups.length - 4); // Keep last 4
        toDelete.forEach(key => localStorage.removeItem(key));
        console.log(`🧹 Cleaned up ${toDelete.length} old backups`);
    }
    
    // Then create the new backup
    const timestamp = Date.now();
    const key = `worklog_backup_${timestamp}`;
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`💾 Backup created: ${key}`);
        return key;
    } catch (error) {
        console.error('❌ Backup failed:', error);
        return null;
    }
} 

// Initialize
BackupManager.init();

// Make available globally
window.BackupManager = BackupManager;

console.log('✅ BackupManager loaded');
