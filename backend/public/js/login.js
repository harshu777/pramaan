const API_BASE = window.location.origin + '/api';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.getElementById('btnText');
    const loader = document.getElementById('loader');

    // Reset messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Show loading
    loginBtn.disabled = true;
    btnText.style.display = 'none';
    loader.style.display = 'block';

    const formData = new FormData(e.target);
    const loginData = {
        did: formData.get('did'),
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

            successDiv.textContent = 'Login successful! Redirecting...';
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

// Check if already logged in
if (localStorage.getItem('token')) {
    window.location.href = '/static/dashboard.html';
}