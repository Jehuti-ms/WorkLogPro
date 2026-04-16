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

// Initialize
BackupManager.init();

// Make available globally
window.BackupManager = BackupManager;

console.log('✅ BackupManager loaded');
