const API_BASE = window.location.origin + '/api';

// Tab switching function
function switchTab(tabName) {
    // Update tab buttons
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.getElementById('adminTab').classList.remove('active');
    document.getElementById('athleteTab').classList.remove('active');

    if (tabName === 'admin') {
        document.getElementById('adminTab').classList.add('active');
    } else {
        document.getElementById('athleteTab').classList.add('active');
    }

    // Clear messages
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}

// Admin Login Handler
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const loginBtn = document.getElementById('adminLoginBtn');
    const btnText = document.getElementById('adminBtnText');
    const loader = document.getElementById('adminLoader');

    // Reset messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Show loading
    loginBtn.disabled = true;
    btnText.style.display = 'none';
    loader.style.display = 'block';

    const formData = new FormData(e.target);
    const loginData = {
        username: formData.get('username'),
        password: formData.get('password')
    };

    try {
        const response = await fetch(`${API_BASE}/issuers/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();

        if (result.success) {
            // Store token and user info
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.issuer));

            successDiv.textContent = 'Login successful! Redirecting to Admin Dashboard...';
            successDiv.style.display = 'block';

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/static/dashboard.html';
            }, 1000);
        } else {
            throw new Error(result.message || 'Invalid credentials');
        }
    } catch (error) {
        errorDiv.textContent = error.message || 'Login failed. Please try again.';
        errorDiv.style.display = 'block';

        // Reset button
        loginBtn.disabled = false;
        btnText.style.display = 'inline';
        loader.style.display = 'none';
    }
});

// Athlete Login Handler
document.getElementById('athleteLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const loginBtn = document.getElementById('athleteLoginBtn');
    const btnText = document.getElementById('athleteBtnText');
    const loader = document.getElementById('athleteLoader');

    // Reset messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Show loading
    loginBtn.disabled = true;
    btnText.style.display = 'none';
    loader.style.display = 'block';

    const formData = new FormData(e.target);
    const loginData = {
        email: formData.get('email'),
        password: formData.get('password')
    };

    try {
        const response = await fetch(`${API_BASE}/athletes/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();

        if (result.success) {
            // Store token and user info
            localStorage.setItem('athleteToken', result.token);
            localStorage.setItem('athlete', JSON.stringify(result.athlete));

            successDiv.textContent = 'Login successful! Redirecting to Athlete Dashboard...';
            successDiv.style.display = 'block';

            // Redirect to athlete dashboard
            setTimeout(() => {
                window.location.href = '/static/athlete-dashboard.html';
            }, 1000);
        } else {
            throw new Error(result.message || 'Invalid credentials');
        }
    } catch (error) {
        errorDiv.textContent = error.message || 'Login failed. Please try again.';
        errorDiv.style.display = 'block';

        // Reset button
        loginBtn.disabled = false;
        btnText.style.display = 'inline';
        loader.style.display = 'none';
    }
});

// Check if already logged in
if (localStorage.getItem('token')) {
    window.location.href = '/static/dashboard.html';
} else if (localStorage.getItem('athleteToken')) {
    window.location.href = '/static/athlete-dashboard.html';
}