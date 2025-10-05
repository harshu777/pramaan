const API_BASE = window.location.origin + '/api';
let currentUser = null;
let certificates = [];
let currentView = 'grid';
let currentFolder = 'all';
let folders = ['all', 'education', 'professional', 'personal'];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadCertificates();
    setupEventListeners();
    loadFolders();
});

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token || !user) {
        window.location.href = '/static/login.html';
        return false;
    }

    currentUser = JSON.parse(user);
    document.getElementById('userName').textContent = currentUser.name || currentUser.did;
    return true;
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/static/login.html';
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');

            const page = this.dataset.page;
            switchPage(page);
        });
    });

    // Folder navigation
    document.querySelectorAll('.folder-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            currentFolder = this.dataset.folder;
            filterCertificates();
        });
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', debounce(searchCertificates, 300));

    // Upload area
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            handleFileUpload(e.dataTransfer.files[0]);
        });

        fileInput.addEventListener('change', (e) => {
            handleFileUpload(e.target.files[0]);
        });
    }

    // Select all checkbox
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.cert-checkbox');
            checkboxes.forEach(cb => cb.checked = this.checked);
        });
    }
}

// Switch pages
function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

    if (page === 'certificates') {
        document.getElementById('certificatesPage').style.display = 'block';
    } else if (page === 'upload') {
        document.getElementById('uploadPage').style.display = 'block';
    } else if (page === 'recent') {
        document.getElementById('certificatesPage').style.display = 'block';
        filterByRecent();
    } else if (page === 'expired') {
        document.getElementById('certificatesPage').style.display = 'block';
        filterByExpired();
    }
}

// Set view (grid/list)
function setView(view) {
    currentView = view;

    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    if (view === 'grid') {
        document.getElementById('gridView').style.display = 'grid';
        document.getElementById('listView').style.display = 'none';
    } else {
        document.getElementById('gridView').style.display = 'none';
        document.getElementById('listView').style.display = 'block';
    }

    displayCertificates(certificates);
}

// Load certificates
async function loadCertificates() {
    try {
        const response = await fetch(`${API_BASE}/certificates/search?q=`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const result = await response.json();
        if (result.success) {
            certificates = result.data || [];

            // Add folder property to certificates (mock for now)
            certificates = certificates.map(cert => ({
                ...cert,
                folder: cert.folder || assignFolder(cert)
            }));

            displayCertificates(certificates);
        }
    } catch (error) {
        console.error('Failed to load certificates:', error);
    }
}

// Assign folder based on certificate type (mock logic)
function assignFolder(cert) {
    if (cert.certificate_type === 'degree' || cert.certificate_type === 'diploma') {
        return 'education';
    } else if (cert.certificate_type === 'professional') {
        return 'professional';
    } else {
        return 'personal';
    }
}

// Display certificates
function displayCertificates(certs) {
    if (currentView === 'grid') {
        displayGridView(certs);
    } else {
        displayListView(certs);
    }
}

// Display grid view
function displayGridView(certs) {
    const gridView = document.getElementById('gridView');

    if (!certs.length) {
        gridView.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <div style="font-size: 3rem;">📄</div>
                <div style="color: #888;">No certificates found</div>
            </div>
        `;
        return;
    }

    gridView.innerHTML = certs.map(cert => `
        <div class="cert-card" data-id="${cert.id}">
            <div class="cert-card-header">
                <div class="cert-type-icon">
                    ${getTypeIcon(cert.certificate_type)}
                </div>
                <div class="status-badge ${cert.status}">
                    ${cert.status.toUpperCase()}
                </div>
            </div>
            <div class="cert-card-body">
                <div class="cert-card-title">${cert.subject_name}</div>
                <div class="cert-card-info">
                    <div>📋 ${cert.certificate_type}</div>
                    <div>🏢 ${cert.issuer_name}</div>
                    <div>📅 ${new Date(cert.issued_date).toLocaleDateString()}</div>
                    <div>📁 ${cert.folder || 'Unfiled'}</div>
                </div>
            </div>
            <div class="cert-card-actions">
                <button class="cert-action-btn" onclick="viewCertificate('${cert.cert_hash}')">
                    👁️ View
                </button>
                <button class="cert-action-btn" onclick="showQR('${cert.cert_hash}')">
                    📱 QR
                </button>
                <button class="cert-action-btn" onclick="downloadCertificate('${cert.cert_hash}')">
                    ⬇️ Download
                </button>
                <button class="cert-action-btn" onclick="moveCertificate('${cert.id}')">
                    📁 Move
                </button>
            </div>
        </div>
    `).join('');
}

// Display list view
function displayListView(certs) {
    const listViewBody = document.getElementById('listViewBody');

    if (!certs.length) {
        listViewBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem;">
                    <div style="font-size: 3rem;">📄</div>
                    <div style="color: #888;">No certificates found</div>
                </td>
            </tr>
        `;
        return;
    }

    listViewBody.innerHTML = certs.map(cert => `
        <tr>
            <td>
                <input type="checkbox" class="cert-checkbox list-checkbox" data-id="${cert.id}">
            </td>
            <td>
                <div style="font-weight: 600;">${cert.subject_name}</div>
                <div style="color: #888; font-size: 0.9rem;">${cert.cert_hash.substring(0, 16)}...</div>
            </td>
            <td>${cert.certificate_type}</td>
            <td>${cert.issuer_name}</td>
            <td>${new Date(cert.issued_date).toLocaleDateString()}</td>
            <td>
                <span class="status-badge ${cert.status}">
                    ${cert.status.toUpperCase()}
                </span>
            </td>
            <td>${cert.folder || 'Unfiled'}</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="cert-action-btn" onclick="viewCertificate('${cert.cert_hash}')" title="View">
                        👁️
                    </button>
                    <button class="cert-action-btn" onclick="showQR('${cert.cert_hash}')" title="QR Code">
                        📱
                    </button>
                    <button class="cert-action-btn" onclick="downloadCertificate('${cert.cert_hash}')" title="Download">
                        ⬇️
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Get type icon
function getTypeIcon(type) {
    const icons = {
        'degree': '🎓',
        'diploma': '📜',
        'course': '📚',
        'achievement': '🏆',
        'professional': '💼',
        'default': '📄'
    };
    return icons[type] || icons.default;
}

// Search certificates
function searchCertificates() {
    const query = document.getElementById('searchInput').value.toLowerCase();

    if (!query) {
        displayCertificates(certificates);
        return;
    }

    const filtered = certificates.filter(cert =>
        cert.subject_name.toLowerCase().includes(query) ||
        cert.issuer_name.toLowerCase().includes(query) ||
        cert.certificate_type.toLowerCase().includes(query) ||
        cert.cert_hash.includes(query)
    );

    displayCertificates(filtered);
}

// Filter certificates by folder
function filterCertificates() {
    if (currentFolder === 'all') {
        displayCertificates(certificates);
        return;
    }

    const filtered = certificates.filter(cert => cert.folder === currentFolder);
    displayCertificates(filtered);
}

// Filter by recent (last 7 days)
function filterByRecent() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const filtered = certificates.filter(cert =>
        new Date(cert.issued_date) > weekAgo
    );

    displayCertificates(filtered);
}

// Filter by expired
function filterByExpired() {
    const now = new Date();

    const filtered = certificates.filter(cert =>
        cert.expiry_date && new Date(cert.expiry_date) < now
    );

    displayCertificates(filtered);
}

// View certificate
function viewCertificate(hash) {
    window.open(`/api/certificates/verify/${hash}`, '_blank');
}

// Show QR code
async function showQR(hash) {
    try {
        const response = await fetch(`${API_BASE}/certificates/qr/${hash}`);
        const result = await response.json();

        if (result.success) {
            document.getElementById('qrCodeImage').innerHTML =
                `<img src="${result.qrCode}" alt="QR Code" style="max-width: 300px;">`;
            document.getElementById('qrModal').classList.add('active');
        }
    } catch (error) {
        alert('Failed to generate QR code');
    }
}

// Download certificate (PDF if available, otherwise JSON)
async function downloadCertificate(hash) {
    try {
        // Use the new download endpoint that returns PDF if available
        window.open(`${API_BASE}/certificates/download/${hash}`, '_blank');
    } catch (error) {
        alert('Failed to download certificate');
    }
}

// Move certificate to folder
function moveCertificate(certId) {
    const cert = certificates.find(c => c.id === certId);
    if (!cert) return;

    const newFolder = prompt(`Move certificate to folder:\n${folders.join(', ')}`, cert.folder || 'unfiled');

    if (newFolder && folders.includes(newFolder)) {
        // Update local data
        cert.folder = newFolder;

        // Save to localStorage (in production, this would be an API call)
        saveFolderAssignment(certId, newFolder);

        // Refresh display
        displayCertificates(certificates);

        alert(`Certificate moved to ${newFolder} folder`);
    }
}

// Save folder assignment
function saveFolderAssignment(certId, folder) {
    // Get folder assignments from localStorage
    let assignments = JSON.parse(localStorage.getItem('certificateFolders') || '{}');
    assignments[certId] = folder;
    localStorage.setItem('certificateFolders', JSON.stringify(assignments));
}

// Load folders
function loadFolders() {
    // Load saved folders from localStorage
    const savedFolders = JSON.parse(localStorage.getItem('customFolders') || '[]');
    folders = ['all', 'education', 'professional', 'personal', ...savedFolders];

    // Load folder assignments
    const assignments = JSON.parse(localStorage.getItem('certificateFolders') || '{}');

    // Apply assignments to certificates
    certificates.forEach(cert => {
        if (assignments[cert.id]) {
            cert.folder = assignments[cert.id];
        }
    });

    updateFoldersList();
}

// Update folders list in sidebar
function updateFoldersList() {
    const foldersSection = document.getElementById('foldersSection');
    const customFolders = folders.filter(f => !['all', 'education', 'professional', 'personal'].includes(f));

    const customFoldersHtml = customFolders.map(folder => `
        <div class="folder-item" data-folder="${folder}">
            📁 ${folder}
        </div>
    `).join('');

    // Find the add button
    const addBtn = foldersSection.querySelector('.add-folder-btn');

    // Insert custom folders before the add button
    if (customFolders.length > 0) {
        const div = document.createElement('div');
        div.innerHTML = customFoldersHtml;
        addBtn.parentNode.insertBefore(div, addBtn);
    }
}

// Show add folder modal
function showAddFolderModal() {
    document.getElementById('addFolderModal').classList.add('active');
}

// Create folder
function createFolder() {
    const folderName = document.getElementById('folderName').value.trim();

    if (!folderName) {
        alert('Please enter a folder name');
        return;
    }

    if (folders.includes(folderName.toLowerCase())) {
        alert('Folder already exists');
        return;
    }

    // Add to folders list
    folders.push(folderName.toLowerCase());

    // Save custom folders
    const customFolders = folders.filter(f => !['all', 'education', 'professional', 'personal'].includes(f));
    localStorage.setItem('customFolders', JSON.stringify(customFolders));

    // Update UI
    updateFoldersList();
    setupEventListeners(); // Re-attach event listeners

    // Close modal
    closeModal('addFolderModal');
    document.getElementById('folderName').value = '';
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Handle file upload
async function handleFileUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const fileData = e.target.result;

        // Prompt for certificate details
        const title = prompt('Certificate Title:');
        const recipientName = prompt('Recipient Name:');
        const recipientEmail = prompt('Recipient Email:');
        const type = prompt('Certificate Type (degree/diploma/course/achievement):');

        const certificateData = {
            issuerDid: currentUser?.did || 'did:example:defaultissuer',
            issuerName: currentUser?.name || 'Default Issuer',
            subjectName: recipientName,
            subjectEmail: recipientEmail,
            certificateType: type,
            metadata: {
                title: title,
                fileName: file.name,
                fileSize: file.size,
                fileData: fileData
            }
        };

        try {
            const response = await fetch(`${API_BASE}/certificates/issue`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(certificateData)
            });

            const result = await response.json();

            if (result.success) {
                alert('Certificate uploaded successfully!');
                loadCertificates();
                switchPage('certificates');
            } else {
                alert('Upload failed: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            alert('Upload failed: ' + error.message);
        }
    };

    reader.readAsDataURL(file);
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make functions globally available
window.logout = logout;
window.setView = setView;
window.viewCertificate = viewCertificate;
window.showQR = showQR;
window.downloadCertificate = downloadCertificate;
window.moveCertificate = moveCertificate;
window.showAddFolderModal = showAddFolderModal;
window.createFolder = createFolder;
window.closeModal = closeModal;