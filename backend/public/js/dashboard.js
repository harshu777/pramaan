const API_BASE = 'http://localhost:3000/api';
let currentUser = null;
let certificates = [];

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

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        const page = this.dataset.page;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');

        // Update page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(page).classList.add('active');

        // Load page data
        if (page === 'dashboard') loadDashboard();
        if (page === 'list') loadCertificates();
    });
});

// File upload handler
document.getElementById('pdfFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const label = document.getElementById('fileLabel');

    if (file) {
        label.classList.add('has-file');
        label.innerHTML = `
            <div>📄 ${file.name}</div>
            <div style="font-size: 0.9rem; color: #667eea; margin-top: 0.5rem;">
                ${(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
        `;
    }
});

// Upload form handler
document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const btn = document.getElementById('uploadBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    const formData = new FormData(e.target);
    const file = document.getElementById('pdfFile').files[0];

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async function(e) {
        const fileData = e.target.result;

        const certificateData = {
            issuerDid: currentUser?.did || 'did:example:defaultissuer',
            issuerName: currentUser?.name || 'Default Issuer',
            subjectName: formData.get('recipientName'),
            subjectEmail: formData.get('recipientEmail'),
            certificateType: formData.get('type'),
            metadata: {
                title: formData.get('title'),
                description: formData.get('description'),
                issueDate: formData.get('issueDate'),
                fileName: file.name,
                fileSize: file.size,
                fileData: fileData
            }
        };

        if (formData.get('expiryDate')) {
            certificateData.expiryDate = formData.get('expiryDate');
        }

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
                document.getElementById('uploadForm').reset();
                document.getElementById('fileLabel').classList.remove('has-file');
                document.getElementById('fileLabel').innerHTML = `
                    <div>📁 Click to upload PDF certificate</div>
                    <div style="font-size: 0.9rem; color: #888; margin-top: 0.5rem;">or drag and drop</div>
                `;

                // Switch to list view
                document.querySelector('[data-page="list"]').click();
            } else {
                alert('Upload failed: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            alert('Upload failed: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Upload Certificate to Blockchain';
        }
    };

    reader.readAsDataURL(file);
});

// Load dashboard
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/certificates/search?q=`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const result = await response.json();
        if (result.success) {
            certificates = result.data || [];

            // Update stats
            document.getElementById('totalCerts').textContent = certificates.length;
            document.getElementById('activeCerts').textContent =
                certificates.filter(c => c.status === 'active').length;

            // This month's certificates
            const thisMonth = new Date().getMonth();
            const monthCerts = certificates.filter(c =>
                new Date(c.issued_date).getMonth() === thisMonth
            ).length;
            document.getElementById('monthCerts').textContent = monthCerts;

            // Recent certificates
            const recent = certificates.slice(0, 5);
            const recentHtml = recent.length ? recent.map(cert => `
                <div style="padding: 1rem; border-bottom: 1px solid #e0e0e0;">
                    <div style="font-weight: 600;">${cert.subject_name}</div>
                    <div style="color: #666; font-size: 0.9rem;">
                        ${cert.certificate_type} - ${new Date(cert.issued_date).toLocaleDateString()}
                    </div>
                </div>
            `).join('') : '<div style="padding: 2rem; text-align: center; color: #888;">No certificates yet</div>';

            document.getElementById('recentCertsList').innerHTML = recentHtml;
        }
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
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
            displayCertificates(certificates);
        }
    } catch (error) {
        console.error('Failed to load certificates:', error);
        document.getElementById('certificatesList').innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: #888;">
                    Failed to load certificates
                </td>
            </tr>
        `;
    }
}

// Display certificates
function displayCertificates(certs) {
    const tbody = document.getElementById('certificatesList');

    if (!certs.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    <div class="empty-state">
                        <div style="font-size: 3rem;">📄</div>
                        <div>No certificates found</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = certs.map(cert => `
        <tr>
            <td>
                <div class="cert-name">${cert.certificate_type}</div>
                <div class="cert-subject">${cert.cert_hash.substring(0, 16)}...</div>
            </td>
            <td>
                <div>${cert.subject_name}</div>
                <div style="color: #666; font-size: 0.9rem;">${cert.subject_email || '-'}</div>
            </td>
            <td>${cert.certificate_type}</td>
            <td>${new Date(cert.issued_date).toLocaleDateString()}</td>
            <td>
                <span class="status-badge ${cert.status}">
                    ${cert.status.toUpperCase()}
                </span>
            </td>
            <td>
                <div class="actions">
                    <button class="btn-action btn-view" onclick="viewCertificate('${cert.cert_hash}')" title="View">
                        👁️
                    </button>
                    <button class="btn-action btn-qr" onclick="showQR('${cert.cert_hash}')" title="QR Code">
                        📱
                    </button>
                    <button class="btn-action btn-download" onclick="downloadCertificate('${cert.cert_hash}')" title="Download">
                        ⬇️
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Search certificates
async function searchCertificates() {
    const query = document.getElementById('searchInput').value;

    if (!query.trim()) {
        displayCertificates(certificates);
        return;
    }

    const filtered = certificates.filter(cert =>
        cert.subject_name.toLowerCase().includes(query.toLowerCase()) ||
        cert.certificate_type.toLowerCase().includes(query.toLowerCase()) ||
        cert.cert_hash.includes(query)
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

// Close QR modal
function closeQRModal() {
    document.getElementById('qrModal').classList.remove('active');
}

// Download certificate (PDF if available)
async function downloadCertificate(hash) {
    try {
        // Use the new download endpoint that returns PDF if available
        window.open(`${API_BASE}/certificates/download/${hash}`, '_blank');
    } catch (error) {
        alert('Failed to download certificate');
    }
}

// Initialize
if (checkAuth()) {
    loadDashboard();
}

// Search on enter
document.getElementById('searchInput').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
        searchCertificates();
    }
});

// Make functions globally available for onclick handlers
window.logout = logout;
window.viewCertificate = viewCertificate;
window.showQR = showQR;
window.downloadCertificate = downloadCertificate;
window.searchCertificates = searchCertificates;
window.closeQRModal = closeQRModal;