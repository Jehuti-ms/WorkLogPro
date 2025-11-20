// MANUAL INSTALLATION - Run this after the debug script
console.log('🛠️ === MANUALLY INSTALLING ENHANCEMENTS ===');

// 1. First, let's make sure we can see the student table
const studentTable = document.getElementById('studentTable');
if (!studentTable) {
    console.log('❌ Student table not found. Creating test data...');
    
    // Create a basic student table structure for testing
    const form = document.getElementById('eventForm');
    if (form) {
        const studentSection = document.createElement('div');
        studentSection.innerHTML = `
            <h4 style="margin-top: 30px; margin-bottom: 15px;">
                Student List 
                <span id="studentCountBadge" style="font-size: 0.7em; background: #0078d7; color: white; padding: 2px 8px; border-radius: 12px; margin-left: 10px;">0 students</span>
            </h4>
            <div id="studentTableContainer" class="table-scroll-container">
                <table id="studentTable">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Student Name</th>
                            <th>Form</th>
                            <th>Contact Number</th>
                            <th>Medical / Illness</th>
                            <th>Medication</th>
                            <th>Permission</th>
                            <th>Present</th>
                            <th>Remove</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1</td>
                            <td><input type="text" name="studentName[]"></td>
                            <td><input type="text" name="form[]"></td>
                            <td><input type="text" name="contact[]"></td>
                            <td>
                                <select name="illness[]" class="student-illness">
                                    <option value="None">None</option>
                                    <option value="Asthma">Asthma</option>
                                    <option value="Other">Other</option>
                                </select>
                            </td>
                            <td><input type="checkbox" name="medication[]"></td>
                            <td><input type="checkbox" name="permission[]"></td>
                            <td><input type="checkbox" name="present[]"></td>
                            <td><button type="button" class="delete-row">✖</button></td>
                        </tr>
                    </tbody>
                </table>
                <div id="studentCounter" class="student-counter">Total Students: 1</div>
            </div>
            <button type="button" class="add-row" onclick="addStudentRow()">+ Add Student</button>
        `;
        form.appendChild(studentSection);
        console.log('✅ Created student table structure');
    }
}

// 2. Add CSS for enhancements
console.log('🎨 Adding enhancement CSS...');
const enhancementCSS = `
    /* Search bar */
    .search-container {
        margin-bottom: 15px;
        display: flex;
        gap: 10px;
        align-items: center;
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        border: 2px solid #28a745;
    }
    
    /* Scroll container */
    .table-scroll-container {
        max-height: 400px;
        overflow-y: auto;
        overflow-x: auto;
        margin: 20px 0;
        border: 2px solid #0078d7;
        border-radius: 8px;
        background: white;
        position: relative;
    }
    
    body.dark .table-scroll-container {
        border-color: #60a5fa;
        background: #1e293b;
    }
    
    /* Sticky headers */
    .table-scroll-container thead th {
        position: sticky;
        top: 0;
        background: #f0f2f5 !important;
        z-index: 100;
        font-weight: bold;
        padding: 12px 8px;
        border-bottom: 2px solid #ddd;
    }
    
    body.dark .table-scroll-container thead th {
        background: #162131 !important;
        border-bottom-color: #374151;
    }
    
    /* Student counter */
    .student-counter {
        position: sticky;
        bottom: 0;
        background: #e8f5e8;
        padding: 12px;
        border-top: 2px solid #4caf50;
        font-weight: bold;
        text-align: center;
        z-index: 50;
        color: #2e7d32;
        font-size: 14px;
    }
    
    body.dark .student-counter {
        background: #1b5e20;
        border-top-color: #4caf50;
        color: #e8f5e8;
    }
    
    /* Search input */
    #studentSearch {
        padding: 12px 15px;
        border: 2px solid #0078d7;
        border-radius: 6px;
        flex: 1;
        font-size: 14px;
        background: white;
    }
    
    /* Custom scrollbar */
    .table-scroll-container::-webkit-scrollbar {
        width: 12px;
    }
    
    .table-scroll-container::-webkit-scrollbar-thumb {
        background: #0078d7;
        border-radius: 6px;
    }
`;

const style = document.createElement('style');
style.textContent = enhancementCSS;
document.head.appendChild(style);
console.log('✅ Enhancement CSS added');

// 3. Create search bar (with very visible styling)
console.log('🔍 Creating search bar...');
if (!document.getElementById('studentSearch')) {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.innerHTML = `
        <input type="text" id="studentSearch" placeholder="🔍 SEARCH STUDENTS - Type to filter by name, form, or contact..." style="padding: 12px 15px; border: 2px solid #dc3545; border-radius: 6px; flex: 1; font-size: 14px; background: #fff3cd; font-weight: bold;">
        <button onclick="clearSearch()" class="btn-secondary" style="padding: 12px 20px; background: #dc3545; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Clear Search</button>
    `;
    
    // Insert after student list header
    const studentHeader = document.querySelector('h4');
    if (studentHeader) {
        studentHeader.parentNode.insertBefore(searchContainer, studentHeader.nextElementSibling);
        console.log('✅ Search bar created with RED BORDER (should be visible!)');
    } else {
        // Insert at top of form as fallback
        const form = document.getElementById('eventForm');
        if (form) {
            form.insertBefore(searchContainer, form.firstChild);
            console.log('✅ Search bar added to top of form');
        }
    }
    
    // Add search functionality
    document.getElementById('studentSearch').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#studentTable tbody tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const name = row.cells[1]?.querySelector('input')?.value.toLowerCase() || '';
            const form = row.cells[2]?.querySelector('input')?.value.toLowerCase() || '';
            const contact = row.cells[3]?.querySelector('input')?.value.toLowerCase() || '';
            
            const matches = name.includes(searchTerm) || form.includes(searchTerm) || contact.includes(searchTerm) || searchTerm === '';
            row.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });
        
        updateStudentCounter();
        console.log(`🔍 Search: ${visibleCount} students match "${searchTerm}"`);
    });
}

// 4. Make headers sticky
console.log('📌 Making headers sticky...');
const thead = document.querySelector('#studentTable thead');
if (thead) {
    const thElements = thead.querySelectorAll('th');
    thElements.forEach(th => {
        th.style.position = 'sticky';
        th.style.top = '0';
        th.style.zIndex = '100';
        th.style.background = '#f0f2f5';
        th.style.fontWeight = 'bold';
    });
    console.log(`✅ Made ${thElements.length} headers sticky`);
}

// 5. Initialize student counter
console.log('👥 Initializing student counter...');
function updateStudentCounter() {
    const rows = document.querySelectorAll('#studentTable tbody tr');
    let validStudents = 0;
    
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const nameInput = row.cells[1]?.querySelector('input');
            if (nameInput && nameInput.value.trim() !== '') {
                validStudents++;
            }
        }
    });
    
    const counter = document.getElementById('studentCounter');
    const badge = document.getElementById('studentCountBadge');
    
    if (counter) counter.textContent = `Total Students: ${validStudents}`;
    if (badge) badge.textContent = `${validStudents} students`;
    
    console.log(`📊 Student counter: ${validStudents} students`);
}

// Create counter if it doesn't exist
if (!document.getElementById('studentCounter')) {
    const scrollContainer = document.getElementById('studentTableContainer');
    if (scrollContainer) {
        const counter = document.createElement('div');
        counter.id = 'studentCounter';
        counter.className = 'student-counter';
        counter.textContent = 'Total Students: 0';
        scrollContainer.appendChild(counter);
        console.log('✅ Student counter created');
    }
}

// Update counter now
updateStudentCounter();

// 6. Add global functions
window.clearSearch = function() {
    const searchInput = document.getElementById('studentSearch');
    if (searchInput) {
        searchInput.value = '';
        const event = new Event('input', { bubbles: true });
        searchInput.dispatchEvent(event);
        console.log('✅ Search cleared');
    }
};

window.addStudentRow = function() {
    const tbody = document.querySelector('#studentTable tbody');
    const rowNum = tbody.rows.length + 1;
    
    const row = tbody.insertRow();
    row.innerHTML = `
        <td>${rowNum}</td>
        <td><input type="text" name="studentName[]"></td>
        <td><input type="text" name="form[]"></td>
        <td><input type="text" name="contact[]"></td>
        <td>
            <select name="illness[]">
                <option value="None">None</option>
                <option value="Asthma">Asthma</option>
                <option value="Other">Other</option>
            </select>
        </td>
        <td><input type="checkbox" name="medication[]"></td>
        <td><input type="checkbox" name="permission[]"></td>
        <td><input type="checkbox" name="present[]"></td>
        <td><button type="button" class="delete-row" onclick="this.closest('tr').remove(); updateStudentCounter();">✖</button></td>
    `;
    
    updateStudentCounter();
    console.log('✅ Added student row');
};

console.log('🎉 MANUAL INSTALLATION COMPLETE!');
console.log('You should now see:');
console.log('  1. 🔍 RED-BORDERED search bar at the top');
console.log('  2. 📊 BLUE-BORDERED scroll container around table');
console.log('  3. 📌 Sticky headers that stay visible');
console.log('  4. 👥 Student counter at bottom');
console.log('  5. 🎯 Working search functionality');

// Force some visual indicators
setTimeout(() => {
    const searchInput = document.getElementById('studentSearch');
    if (searchInput) {
        searchInput.focus();
        searchInput.style.boxShadow = '0 0 10px rgba(220, 53, 69, 0.5)';
    }
}, 500);
