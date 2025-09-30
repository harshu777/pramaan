const API_BASE = 'http://localhost:3000/api';
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

    // Upload area and file input
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
            const file = e.dataTransfer.files[0];
            handleFileSelection(file);
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            handleFileSelection(file);
        });
    }

    // Certificate upload form
    const uploadForm = document.getElementById('certificateUploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleFormSubmit);
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

// Assign folder based on certificate type
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
            <div style="grid-column: 1/-1;">
                <div class="empty-state">
                    <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <div style="font-size: 1.1rem; color: #24292e; margin-bottom: 0.5rem;">No certificates found</div>
                    <div style="font-size: 0.9rem;">Upload your first certificate to get started</div>
                </div>
            </div>
        `;
        return;
    }

    gridView.innerHTML = certs.map(cert => `
        <div class="cert-card" data-id="${cert.id}">
            <div class="cert-card-header">
                <div class="cert-type-badge">
                    ${cert.certificate_type}
                </div>
                <div class="status-badge ${cert.status}">
                    ${cert.status}
                </div>
            </div>
            <div class="cert-card-body">
                <div class="cert-card-title">${cert.subject_name}</div>
                <div class="cert-card-info">
                    <div class="cert-info-row">
                        <span class="cert-info-label">Type:</span>
                        <span>${cert.certificate_type}</span>
                    </div>
                    <div class="cert-info-row">
                        <span class="cert-info-label">Issuer:</span>
                        <span>${cert.issuer_name}</span>
                    </div>
                    <div class="cert-info-row">
                        <span class="cert-info-label">Date:</span>
                        <span>${new Date(cert.issued_date).toLocaleDateString()}</span>
                    </div>
                    <div class="cert-info-row">
                        <span class="cert-info-label">Folder:</span>
                        <span>${cert.folder || 'Unfiled'}</span>
                    </div>
                </div>
            </div>
            <div class="cert-card-actions">
                <button class="cert-action-btn" onclick="viewCertificate('${cert.cert_hash}')">
                    View
                </button>
                <button class="cert-action-btn" onclick="showQR('${cert.cert_hash}')">
                    QR Code
                </button>
                <button class="cert-action-btn" onclick="downloadCertificate('${cert.cert_hash}')">
                    Download
                </button>
                <button class="cert-action-btn" onclick="moveCertificate('${cert.id}')">
                    Move
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
                    <div class="empty-state">
                        <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <div style="font-size: 1.1rem; color: #24292e; margin-bottom: 0.5rem;">No certificates found</div>
                        <div style="font-size: 0.9rem;">Upload your first certificate to get started</div>
                    </div>
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
                <div class="cert-name-cell">${cert.subject_name}</div>
                <div class="cert-hash-cell">${cert.cert_hash.substring(0, 16)}...</div>
            </td>
            <td>${cert.certificate_type}</td>
            <td>${cert.issuer_name}</td>
            <td>${new Date(cert.issued_date).toLocaleDateString()}</td>
            <td>
                <span class="status-badge ${cert.status}">
                    ${cert.status}
                </span>
            </td>
            <td>${cert.folder || 'Unfiled'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" onclick="viewCertificate('${cert.cert_hash}')" title="View">
                        View
                    </button>
                    <button class="action-btn" onclick="showQR('${cert.cert_hash}')" title="QR Code">
                        QR
                    </button>
                    <button class="action-btn" onclick="downloadCertificate('${cert.cert_hash}')" title="Download">
                        Download
                    </button>
                    <button class="action-btn" onclick="moveCertificate('${cert.id}')" title="Move to Folder">
                        Move
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
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
        window.open(`${API_BASE}/certificates/download/${hash}`, '_blank');
    } catch (error) {
        alert('Failed to download certificate');
    }
}

// Move certificate to folder
let currentMovingCertId = null;

function moveCertificate(certId) {
    const cert = certificates.find(c => c.id === certId);
    if (!cert) return;

    currentMovingCertId = certId;

    // Set certificate name in modal
    document.getElementById('movingCertName').textContent = cert.subject_name;

    // Populate folder dropdown
    const folderSelect = document.getElementById('folderSelect');
    folderSelect.innerHTML = '<option value="">Choose a folder...</option>';

    // Add all available folders except 'all'
    const availableFolders = folders.filter(f => f !== 'all');
    availableFolders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = folder.charAt(0).toUpperCase() + folder.slice(1);
        if (cert.folder === folder) {
            option.selected = true;
        }
        folderSelect.appendChild(option);
    });

    // Reset new folder input
    document.getElementById('newFolderInput').style.display = 'none';
    document.getElementById('newFolderName').value = '';

    // Show modal
    document.getElementById('moveCertificateModal').classList.add('active');
}

// Show new folder input
function showNewFolderInput() {
    const inputDiv = document.getElementById('newFolderInput');
    if (inputDiv.style.display === 'none') {
        inputDiv.style.display = 'block';
        document.getElementById('newFolderName').focus();
    } else {
        inputDiv.style.display = 'none';
    }
}

// Confirm move operation
function confirmMove() {
    if (!currentMovingCertId) return;

    const cert = certificates.find(c => c.id === currentMovingCertId);
    if (!cert) return;

    let targetFolder = document.getElementById('folderSelect').value;
    const newFolderName = document.getElementById('newFolderName').value.trim();

    // If creating new folder
    if (!targetFolder && newFolderName) {
        const folderNameLower = newFolderName.toLowerCase();

        if (folders.includes(folderNameLower)) {
            alert('Folder already exists');
            return;
        }

        // Add new folder
        folders.push(folderNameLower);
        const customFolders = folders.filter(f => !['all', 'education', 'professional', 'personal'].includes(f));
        localStorage.setItem('customFolders', JSON.stringify(customFolders));

        targetFolder = folderNameLower;

        // Update folder list in sidebar
        updateFoldersList();
        setupEventListeners();
    }

    if (!targetFolder) {
        alert('Please select a folder or create a new one');
        return;
    }

    // Update certificate folder
    cert.folder = targetFolder;
    saveFolderAssignment(currentMovingCertId, targetFolder);

    // Refresh display
    if (currentFolder !== 'all' && currentFolder !== targetFolder) {
        // If we're viewing a specific folder and moving out of it, update view
        filterCertificates();
    } else {
        displayCertificates(certificates);
    }

    // Show confirmation
    showToast(`Certificate moved to ${targetFolder}`);

    // Close modal
    closeModal('moveCertificateModal');
    currentMovingCertId = null;
}

// Show toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #24292e;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

// Add animation styles
if (!document.querySelector('#toastStyles')) {
    const style = document.createElement('style');
    style.id = 'toastStyles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// Save folder assignment
function saveFolderAssignment(certId, folder) {
    let assignments = JSON.parse(localStorage.getItem('certificateFolders') || '{}');
    assignments[certId] = folder;
    localStorage.setItem('certificateFolders', JSON.stringify(assignments));
}

// Load folders
function loadFolders() {
    const savedFolders = JSON.parse(localStorage.getItem('customFolders') || '[]');
    folders = ['all', 'education', 'professional', 'personal', ...savedFolders];

    const assignments = JSON.parse(localStorage.getItem('certificateFolders') || '{}');

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
            <span class="folder-icon"></span>
            ${folder}
        </div>
    `).join('');

    const addBtn = foldersSection.querySelector('.add-folder-btn');

    if (customFolders.length > 0) {
        const div = document.createElement('div');
        div.innerHTML = customFoldersHtml;
        addBtn.parentNode.insertBefore(div, addBtn);
    }
}

// Show add folder modal
function showAddFolderModal() {
    document.getElementById('addFolderModal').classList.add('active');
    document.getElementById('folderName').focus();
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

    folders.push(folderName.toLowerCase());

    const customFolders = folders.filter(f => !['all', 'education', 'professional', 'personal'].includes(f));
    localStorage.setItem('customFolders', JSON.stringify(customFolders));

    updateFoldersList();
    setupEventListeners();

    closeModal('addFolderModal');
    document.getElementById('folderName').value = '';

    showToast(`Folder "${folderName}" created`);
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Handle file selection
let selectedFile = null;
let selectedFileData = null;

function handleFileSelection(file) {
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
    }

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload a PDF or image file');
        return;
    }

    selectedFile = file;

    // Show selected file
    document.getElementById('selectedFile').style.display = 'block';
    document.getElementById('fileName').textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

    // Read file data
    const reader = new FileReader();
    reader.onload = function(e) {
        selectedFileData = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Clear selected file
function clearFile() {
    selectedFile = null;
    selectedFileData = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('selectedFile').style.display = 'none';
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    if (!selectedFile || !selectedFileData) {
        alert('Please select a certificate file');
        return;
    }

    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    const certificateData = {
        issuerDid: currentUser?.did || 'did:example:defaultissuer',
        issuerName: currentUser?.name || 'Default Issuer',
        subjectName: document.getElementById('recipientName').value,
        subjectEmail: document.getElementById('recipientEmail').value,
        certificateType: document.getElementById('certificateType').value,
        expiryDate: document.getElementById('expiryDate').value || null,
        metadata: {
            title: document.getElementById('certTitle').value,
            description: document.getElementById('description').value,
            issueDate: document.getElementById('issueDate').value,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileData: selectedFileData
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
            showToast('Certificate uploaded successfully');

            // Reset form
            document.getElementById('certificateUploadForm').reset();
            clearFile();

            // Load certificates and switch to list view
            loadCertificates();
            switchPage('certificates');
        } else {
            alert('Upload failed: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        alert('Upload failed: ' + error.message);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Certificate';
    }
}

// Cancel upload
function cancelUpload() {
    document.getElementById('certificateUploadForm').reset();
    clearFile();
    switchPage('certificates');
}

// Upload modal
function showUploadModal() {
    document.querySelector('[data-page="upload"]').click();
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
window.showUploadModal = showUploadModal;
window.clearFile = clearFile;
window.cancelUpload = cancelUpload;
window.showNewFolderInput = showNewFolderInput;
window.confirmMove = confirmMove;