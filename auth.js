 // ============================================================================
// AUTH CONFIGURATION - SINGLE DEFINITION
// ============================================================================

const AUTH_CONFIG = {
    storageKey: 'worklog_auth_v2',
    sessionTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
    googleClientId: '919764968127-fi882r3rsgcnukm65pq14t1qdd4pr8ot.apps.googleusercontent.com',
    googleScope: 'profile email'
};

// Global auth state
let authState = {
    isAuthenticated: false,
    currentUser: null,
    users: []
};

// Google OAuth state management
let googleAuth = null;

// ============================================================================
// CORE AUTH FUNCTIONS
// ============================================================================

function initAuth() {
    console.log('🔐 Initializing auth system...');
    loadAuthData();
    checkExistingSession();
    
    if (window.location.pathname.includes('auth.html')) {
        setupAuthEventListeners();
        if (authState.isAuthenticated) {
            console.log('Already logged in, redirecting to app...');
            setTimeout(() => window.location.href = 'index.html', 1000);
        }
    } else {
        setupMainAppAuthUI();
        if (!authState.isAuthenticated) {
            console.log('Not logged in, redirecting to auth page...');
            setTimeout(() => window.location.href = 'auth.html', 1000);
        }
    }
}

function loadAuthData() {
    try {
        const savedData = localStorage.getItem(AUTH_CONFIG.storageKey);
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            authState.users = parsedData.users || [];
            console.log('Loaded users:', authState.users.length);
        } else {
            console.log('No existing auth data found');
        }
    } catch (error) {
        console.error('Error loading auth data:', error);
        authState.users = [];
    }
}

function saveAuthData() {
    try {
        const dataToSave = {
            users: authState.users,
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(AUTH_CONFIG.storageKey, JSON.stringify(dataToSave));
        console.log('Auth data saved');
    } catch (error) {
        console.error('Error saving auth data:', error);
    }
}

function checkExistingSession() {
    const sessionId = localStorage.getItem('worklog_session');
    console.log('Checking session:', sessionId);
    
    if (sessionId) {
        const user = authState.users.find(u => u.id === sessionId);
        if (user) {
            authState.isAuthenticated = true;
            authState.currentUser = user;
            console.log('✅ Session restored for:', user.name);
            return true;
        } else {
            console.log('❌ Session exists but user not found');
            localStorage.removeItem('worklog_session');
        }
    }
    return false;
}

// ============================================================================
// AUTH OPERATIONS
// ============================================================================

async function registerUser(name, email, password) {
    console.log('Registering user:', email);
    
    try {
        if (!name || !email || !password) {
            throw new Error('Please fill in all fields');
        }

        const existingUser = authState.users.find(u => 
            u.email.toLowerCase() === email.toLowerCase()
        );
        
        if (existingUser) {
            console.log('User already exists:', existingUser);
            throw new Error('An account with this email already exists');
        }

        const user = {
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: password,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };

        console.log('Creating new user:', user);

        authState.users.push(user);
        authState.isAuthenticated = true;
        authState.currentUser = user;

        saveAuthData();
        localStorage.setItem('worklog_session', user.id);

        showNotification('🎉 Account created successfully!', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);

        return user;
    } catch (error) {
        console.error('Registration error:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

async function loginUser(email, password) {
    console.log('Login attempt:', email);
    
    try {
        if (!email || !password) {
            throw new Error('Please fill in all fields');
        }

        const user = authState.users.find(u => 
            u.email.toLowerCase() === email.toLowerCase()
        );

        console.log('Found user:', user);

        if (!user) {
            throw new Error('No account found with this email');
        }

        if (user.password !== password) {
            throw new Error('Invalid password');
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        
        authState.isAuthenticated = true;
        authState.currentUser = user;

        saveAuthData();
        localStorage.setItem('worklog_session', user.id);

        showNotification(`👋 Welcome back, ${user.name}!`, 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);

        return user;
    } catch (error) {
        console.error('Login error:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

function logoutUser() {
    console.log('Logging out user');
    authState.isAuthenticated = false;
    authState.currentUser = null;
    localStorage.removeItem('worklog_session');
    window.location.href = 'auth.html';
}

function getCurrentUser() {
    return authState.currentUser;
}

function getCurrentUserId() {
    return authState.currentUser ? authState.currentUser.id : null;
}

// ============================================================================
// UI MANAGEMENT
// ============================================================================

function setupAuthEventListeners() {
    console.log('Setting up auth event listeners');
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Login form submitted');
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            try {
                await loginUser(email, password);
            } catch (error) {
                // Error already handled in loginUser
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Register form submitted');
            
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;
            
            if (password !== confirmPassword) {
                showNotification('Passwords do not match', 'error');
                return;
            }
            
            try {
                await registerUser(name, email, password);
            } catch (error) {
                // Error already handled in registerUser
            }
        });
    }

    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchAuthTab(tabName);
        });
    });
}

function setupMainAppAuthUI() {
    console.log('Setting up main app auth UI');
    
    const authButton = document.getElementById('authButton');
    const userMenu = document.getElementById('userMenu');
    
    if (!authButton) {
        console.log('No auth button found!');
        return;
    }

    console.log('Auth state:', authState);

    if (authState.isAuthenticated && authState.currentUser) {
        authButton.innerHTML = `👤 ${authState.currentUser.name}`;
        authButton.onclick = function() {
            if (userMenu) {
                userMenu.style.display = userMenu.style.display === 'block' ? 'none' : 'block';
            }
        };
        
        if (userMenu) {
            const userName = userMenu.querySelector('#userName');
            if (userName) {
                userName.textContent = authState.currentUser.name;
            }
        }
        
        document.addEventListener('click', function(event) {
            if (userMenu && !authButton.contains(event.target) && !userMenu.contains(event.target)) {
                userMenu.style.display = 'none';
            }
        });
    } else {
        authButton.innerHTML = '🔐 Login';
        authButton.onclick = function() {
            window.location.href = 'auth.html';
        };
        if (userMenu) {
            userMenu.style.display = 'none';
        }
    }
}

function switchAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.auth-tab[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.auth-tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    document.getElementById(tabName).classList.add('active');
    document.getElementById(tabName).style.display = 'block';
}

function showNotification(message, type = 'info') {
    alert(`${type.toUpperCase()}: ${message}`);
}

// ============================================================================
// PROFILE MODAL SYSTEM
// ============================================================================

function showProfileModal() {
    console.log('👤 Opening profile modal...');
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Please log in to view profile');
        return;
    }
    
    const modalHTML = `
        <div class="modal-overlay" id="profileModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>👤 User Profile</h3>
                    <button class="modal-close" onclick="closeProfileModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="profile-info">
                        <div class="profile-field">
                            <label>Name:</label>
                            <span>${currentUser.name || 'N/A'}</span>
                        </div>
                        <div class="profile-field">
                            <label>Email:</label>
                            <span>${currentUser.email || 'N/A'}</span>
                        </div>
                        <div class="profile-field">
                            <label>User ID:</label>
                            <span class="user-id">${currentUser.id}</span>
                        </div>
                        <div class="profile-field">
                            <label>Account Created:</label>
                            <span>${currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Unknown'}</span>
                        </div>
                        <div class="profile-field">
                            <label>Last Login:</label>
                            <span>${currentUser.lastLogin ? new Date(currentUser.lastLogin).toLocaleDateString() : 'Unknown'}</span>
                        </div>
                    </div>
                    
                    <div class="profile-stats">
                        <h4>📊 Data Summary</h4>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-number">${window.appData?.students?.length || 0}</span>
                                <span class="stat-label">Students</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${window.hoursEntries?.length || 0}</span>
                                <span class="stat-label">Hours Logged</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${window.appData?.marks?.length || 0}</span>
                                <span class="stat-label">Assessments</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeProfileModal()">Close</button>
                    <button class="btn btn-warning" onclick="showResetDataConfirm()">Reset Data</button>
                    <button class="btn btn-danger" onclick="showLogoutConfirm()">Logout</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.addEventListener('keydown', handleProfileModalEscape);
}

function closeProfileModal() {
    console.log('👤 Closing profile modal...');
    
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.remove();
    }
    
    document.removeEventListener('keydown', handleProfileModalEscape);
}

function handleProfileModalEscape(event) {
    if (event.key === 'Escape') {
        closeProfileModal();
    }
}

function showResetDataConfirm() {
    if (confirm('⚠️ ARE YOU SURE?\n\nThis will delete ALL your local data including:\n• Students\n• Hours entries\n• Marks & assessments\n• Attendance records\n• Payment history\n\nThis action cannot be undone!')) {
        resetAllData();
        closeProfileModal();
    }
}

function resetAllData() {
    console.log('🗑️ Resetting all data...');
    
    if (window.appData && window.resetAppData) {
        window.resetAppData();
    }
    
    if (window.hoursEntries) {
        window.hoursEntries = [];
    }
    
    const userId = getCurrentUserId();
    localStorage.removeItem(`worklog_data_${userId}`);
    localStorage.removeItem('worklog_hours');
    
    if (window.saveAllData) {
        window.saveAllData();
    }
    
    alert('✅ All data has been reset! The page will reload.');
    window.location.reload();
}

function showLogoutConfirm() {
    if (confirm('Are you sure you want to logout?')) {
        logoutUser();
        closeProfileModal();
    }
}

function exportUserData() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showNotification('No user data to export', 'error');
        return;
    }
    
    try {
        const userId = currentUser.id;
        const userData = {
            profile: currentUser,
            appData: JSON.parse(localStorage.getItem(`worklog_data_${userId}`) || '{}'),
            hoursData: window.hoursEntries || [],
            exportDate: new Date().toISOString(),
            exportVersion: '1.0'
        };
        
        const dataStr = JSON.stringify(userData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `worklog_backup_${currentUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        showNotification('📤 User data exported successfully!', 'success');
        closeProfileModal();
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Error exporting data', 'error');
    }
}

// ============================================================================
// SOCIAL AUTH PLACEHOLDERS
// ============================================================================

function signInWithGoogle() {
    showNotification('🔐 Google authentication would be implemented here', 'info');
}

function signInWithGitHub() {
    showNotification('💻 GitHub authentication would be implemented here', 'info'); 
}

// ============================================================================
// DEBUG AND UTILITY FUNCTIONS
// ============================================================================

function resetAuthData() {
    if (confirm('Are you sure you want to reset all authentication data? This will log you out and clear all user accounts.')) {
        localStorage.removeItem(AUTH_CONFIG.storageKey);
        localStorage.removeItem('worklog_session');
        authState = {
            isAuthenticated: false,
            currentUser: null,
            users: []
        };
        showNotification('Auth data reset successfully', 'success');
        setTimeout(() => {
            window.location.href = 'auth.html';
        }, 1000);
    }
}

function debugAuth() {
    console.log('=== AUTH DEBUG INFO ===');
    console.log('Auth state:', authState);
    console.log('Session in localStorage:', localStorage.getItem('worklog_session'));
    console.log('All users:', authState.users);
    console.log('Current user:', authState.currentUser);
    
    const debugInfo = `
Auth State:
- Authenticated: ${authState.isAuthenticated}
- Current User: ${authState.currentUser ? authState.currentUser.name : 'None'}
- Total Users: ${authState.users.length}
- Session: ${localStorage.getItem('worklog_session') ? 'Exists' : 'None'}
    `.trim();
    
    alert(debugInfo);
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

window.Auth = {
    isAuthenticated: () => authState.isAuthenticated,
    getCurrentUser: getCurrentUser,
    getCurrentUserId: getCurrentUserId,
    logoutUser: logoutUser,
    showAuthModal: () => window.location.href = 'auth.html',
    showProfileModal: showProfileModal,
    resetAuthData: resetAuthData,
    debugAuth: debugAuth
};

window.signInWithGoogle = signInWithGoogle;
window.signInWithGitHub = signInWithGitHub;
window.showProfileModal = showProfileModal;
window.closeProfileModal = closeProfileModal;
window.exportUserData = exportUserData;

// ============================================================================
// GOOGLE AUTH INITIALIZATION
// ============================================================================

function initGoogleAuth() {
    return new Promise((resolve, reject) => {
        // Load Google OAuth library dynamically
        if (window.google) {
            initializeGoogleAuth();
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            console.log('✅ Google OAuth library loaded');
            initializeGoogleAuth();
            resolve();
        };
        script.onerror = () => {
            console.error('❌ Failed to load Google OAuth library');
            reject(new Error('Failed to load Google OAuth'));
        };
        document.head.appendChild(script);
    });
}

function initializeGoogleAuth() {
    try {
        google.accounts.id.initialize({
            client_id: AUTH_CONFIG.googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
            context: 'signin',
            ux_mode: 'popup'
        });
        
        console.log('✅ Google OAuth initialized');
    } catch (error) {
        console.error('❌ Error initializing Google OAuth:', error);
    }
}

// ============================================================================
// GOOGLE AUTH HANDLERS
// ============================================================================

function handleGoogleCredentialResponse(response) {
    console.log('🔐 Google credential received');
    
    try {
        // Decode the JWT token to get user info
        const credential = parseJwt(response.credential);
        console.log('Google user info:', credential);
        
        // Create or find user in our system
        handleGoogleUser(credential);
        
    } catch (error) {
        console.error('❌ Error handling Google credential:', error);
        showNotification('Error signing in with Google', 'error');
    }
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT:', error);
        throw new Error('Invalid credential');
    }
}

async function handleGoogleUser(googleUser) {
    try {
        // Check if user already exists
        let user = authState.users.find(u => u.email === googleUser.email);
        
        if (user) {
            // Update existing user with Google info
            user.googleId = googleUser.sub;
            user.avatar = googleUser.picture;
            user.lastLogin = new Date().toISOString();
        } else {
            // Create new user from Google info
            user = {
                id: 'google_' + googleUser.sub,
                googleId: googleUser.sub,
                name: googleUser.name,
                email: googleUser.email.toLowerCase(),
                avatar: googleUser.picture,
                authProvider: 'google',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            };
            
            authState.users.push(user);
        }
        
        // Log the user in
        authState.isAuthenticated = true;
        authState.currentUser = user;
        
        saveAuthData();
        localStorage.setItem('worklog_session', user.id);
        
        showNotification(`👋 Welcome, ${user.name}!`, 'success');
        
        // Redirect to main app
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error handling Google user:', error);
        showNotification('Error creating account with Google', 'error');
    }
}

// ============================================================================
// GOOGLE AUTH UI
// ============================================================================

async function signInWithGoogle() {
    try {
        console.log('🔐 Starting Google sign-in...');
        
        // Initialize Google Auth if not already done
        if (!window.google) {
            await initGoogleAuth();
        }
        
        // Render the Google sign-in button
        renderGoogleSignInButton();
        
    } catch (error) {
        console.error('❌ Google sign-in error:', error);
        showNotification('Google sign-in is currently unavailable', 'error');
    }
}

function renderGoogleSignInButton() {
    // Remove existing button if any
    const existingButton = document.getElementById('googleSignInButton');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Create container for Google button
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'googleSignInButton';
    buttonContainer.style.margin = '15px 0';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    
    // Add to the appropriate form
    const loginForm = document.getElementById('loginForm') || document.getElementById('registerForm');
    if (loginForm) {
        // Insert before the submit button
        const submitButton = loginForm.querySelector('button[type="submit"]');
        if (submitButton) {
            loginForm.insertBefore(buttonContainer, submitButton);
        } else {
            loginForm.appendChild(buttonContainer);
        }
        
        // Render Google button
        setTimeout(() => {
            try {
                google.accounts.id.renderButton(
                    buttonContainer,
                    {
                        theme: 'outline',
                        size: 'large',
                        width: buttonContainer.offsetWidth,
                        text: 'signin_with',
                        shape: 'rectangular',
                        logo_alignment: 'left'
                    }
                );
                
                // Also show the One Tap prompt if appropriate
                google.accounts.id.prompt();
                
            } catch (error) {
                console.error('❌ Error rendering Google button:', error);
                showFallbackGoogleButton(buttonContainer);
            }
        }, 100);
    }
}

function showFallbackGoogleButton(container) {
    container.innerHTML = `
        <button type="button" class="btn btn-google" onclick="manualGoogleSignIn()" 
                style="background: white; color: #757575; border: 1px solid #dadce0; 
                       padding: 12px 24px; border-radius: 4px; font-weight: 500;
                       display: flex; align-items: center; gap: 12px; width: 100%; 
                       justify-content: center; cursor: pointer;">
            <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17Z"/>
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07Z"/>
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3Z"/>
            </svg>
            Sign in with Google
        </button>
    `;
}

function manualGoogleSignIn() {
    // Fallback: redirect to Google OAuth
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?
        client_id=${AUTH_CONFIG.googleClientId}&
        redirect_uri=${encodeURIComponent(window.location.origin + window.location.pathname)}&
        response_type=code&
        scope=profile%20email&
        state=google_auth`.replace(/\s/g, '');
    
    window.location.href = googleAuthUrl;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
// Add click outside to close functionality
document.addEventListener('click', function(event) {
    const modal = document.getElementById('profileModal');
    if (modal && event.target === modal) {
        closeProfileModal();
    }
});
