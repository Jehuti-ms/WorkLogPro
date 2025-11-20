// ===========================
// TAB NAVIGATION SYSTEM - FIXED VERSION
// ===========================

function setupTabNavigation() {
  console.log('🔧 Setting up tab navigation...');
  
  // Debug: Check what tab elements actually exist
  console.log('🔍 Searching for tab elements...');
  
  // Check for various possible tab button selectors
  const possibleSelectors = [
    '.tab-btn',
    '[data-tab]',
    '.tab-button',
    '.nav-btn',
    '.tab',
    'button[data-tab]',
    '.tab-nav button',
    '.tabs button'
  ];
  
  let tabButtons = [];
  let foundSelector = '';
  
  for (const selector of possibleSelectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`Selector "${selector}": found ${elements.length} elements`);
    
    if (elements.length > 0) {
      tabButtons = elements;
      foundSelector = selector;
      break;
    }
  }
  
  if (tabButtons.length === 0) {
    console.error('❌ No tab buttons found with any selector');
    
    // Try to find any buttons in the main content
    const allButtons = document.querySelectorAll('button');
    console.log(`Found ${allButtons.length} total buttons on page`);
    
    allButtons.forEach((btn, index) => {
      console.log(`Button ${index}:`, {
        text: btn.textContent,
        classes: btn.className,
        id: btn.id,
        'data-tab': btn.getAttribute('data-tab')
      });
    });
    
    return;
  }
  
  console.log(`✅ Found ${tabButtons.length} tab buttons with selector: ${foundSelector}`);
  
  // Set up click handlers for tab buttons
  tabButtons.forEach(button => {
    const tabName = button.getAttribute('data-tab');
    console.log(`📝 Setting up tab button: ${tabName}`, {
      text: button.textContent,
      classes: button.className
    });
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      console.log(`🎯 Tab clicked: ${tabName}`);
      switchTab(tabName);
    });
  });
  
  // Set initial active tab
  const initialTab = getInitialTab();
  console.log(`📑 Setting initial tab to: ${initialTab}`);
  switchTab(initialTab);
}

function getInitialTab() {
  // Check if there's an active tab already
  const activeTab = document.querySelector('.tab-btn.active, [data-tab].active, .tab-content.active');
  if (activeTab) {
    if (activeTab.classList.contains('tab-content')) {
      return activeTab.id;
    } else {
      return activeTab.getAttribute('data-tab');
    }
  }
  
  // Try overview first
  if (document.getElementById('overview')) {
    return 'overview';
  }
  
  // Otherwise, get the first available tab
  const firstTabButton = document.querySelector('[data-tab]');
  if (firstTabButton) {
    return firstTabButton.getAttribute('data-tab');
  }
  
  // Fallback
  return 'overview';
}

function switchTab(tabName) {
  console.log(`🔄 Switching to tab: ${tabName}`);
  
  if (!tabName) {
    console.error('❌ No tab name provided for switchTab');
    return;
  }
  
  // Remove active class from all tab buttons
  const allTabButtons = document.querySelectorAll('.tab-btn, [data-tab]');
  allTabButtons.forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to clicked tab button
  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
    console.log(`✅ Activated button for: ${tabName}`);
  } else {
    console.warn(`⚠️ No button found for tab: ${tabName}`);
    
    // Try to find button by text content as fallback
    const buttons = document.querySelectorAll('button');
    const matchingButton = Array.from(buttons).find(btn => 
      btn.textContent.toLowerCase().includes(tabName.toLowerCase())
    );
    if (matchingButton) {
      matchingButton.classList.add('active');
      console.log(`✅ Found button by text content for: ${tabName}`);
    }
  }
  
  // Hide all tab content
  const allTabContents = document.querySelectorAll('.tab-content, [id$="-tab"], .tab-panel, .tab-page');
  allTabContents.forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
  
  // Show active tab content
  const activeContent = document.getElementById(tabName);
  if (activeContent) {
    activeContent.classList.add('active');
    activeContent.style.display = 'block';
    console.log(`✅ Activated content for: ${tabName}`);
  } else {
    console.warn(`⚠️ No content found for tab: ${tabName}`);
    
    // Try alternative content selectors
    const alternativeSelectors = [
      `#${tabName}-tab`,
      `#${tabName}-panel`,
      `#${tabName}-content`,
      `.${tabName}-tab`,
      `.${tabName}-content`
    ];
    
    for (const selector of alternativeSelectors) {
      const altContent = document.querySelector(selector);
      if (altContent) {
        altContent.classList.add('active');
        altContent.style.display = 'block';
        console.log(`✅ Found content with alternative selector: ${selector}`);
        break;
      }
    }
  }
  
  console.log(`✅ Tab switch completed: ${tabName}`);
}

// ===========================
// APP INITIALIZATION - UPDATED
// ===========================

// Start the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🏠 DOM fully loaded, starting app...');
  
  // Initialize core systems
  NotificationSystem.initNotificationStyles();
  initializeTheme();
  setupThemeToggle();
  EnhancedCache.loadCachedData();
  EnhancedStats.init();
  
  // Setup tab navigation with a small delay to ensure DOM is ready
  setTimeout(() => {
    setupTabNavigation();
  }, 100);
  
  // Wait for authentication
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('👤 User authenticated:', user.email);
      try {
        // Load user profile and data in parallel
        await Promise.all([
          loadUserProfile(user.uid),
          loadUserStats(user.uid),
          renderStudents(),
          renderRecentHours(),
          renderRecentMarks(),
          renderAttendanceRecent(),
          renderPaymentActivity(),
          renderStudentBalances(),
          renderOverviewReports()
        ]);
        
        // Initialize systems that depend on user data
        SyncBar.init();
        setupProfileModal();
        setupFloatingAddButton();
        updateHeaderStats();
        
        // Setup form handlers
        setupFormHandlers();
        
        NotificationSystem.notifySuccess(`Welcome back, ${user.email.split('@')[0]}!`);
        console.log('✅ Worklog App initialized successfully');
      } catch (error) {
        console.error('❌ Error during user login:', error);
        NotificationSystem.notifyError('Error loading user data');
      }
    } else {
      console.log('👤 No user, redirecting to auth...');
      window.location.href = "auth.html";
    }
  });
});

// Helper function to setup form handlers
function setupFormHandlers() {
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', handleStudentSubmit);
    console.log('✅ Student form handler attached');
  }
  
  const hoursForm = document.getElementById('hoursForm');
  if (hoursForm) {
    hoursForm.addEventListener('submit', handleHoursSubmit);
    console.log('✅ Hours form handler attached');
  }
  
  const marksForm = document.getElementById('marksForm');
  if (marksForm) {
    marksForm.addEventListener('submit', handleMarksSubmit);
    console.log('✅ Marks form handler attached');
  }
  
  const attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', handleAttendanceSubmit);
    console.log('✅ Attendance form handler attached');
  }
  
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmit);
    console.log('✅ Payment form handler attached');
  }
}
