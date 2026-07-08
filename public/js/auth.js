// Check auth on load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthSession(true);
});

// Toggle between sign-in and registration forms
function switchTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }
}

// Prefill helper buttons for easy demo testing
function fillCreds(username, password) {
    document.getElementById('login-identifier').value = username;
    document.getElementById('login-password').value = password;
    showToast(`Prefilled credentials for: ${username}`);
}

// Handle Login Form Submit
async function handleLogin(event) {
    event.preventDefault();

    const loginIdentifier = document.getElementById('login-identifier').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    try {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');

        const response = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ loginIdentifier, password })
        });

        showToast('Logged in successfully! Redirecting...', false);
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1200);
    } catch (error) {
        showToast(error.message || 'Login failed. Please try again.', true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
}

// Handle Registration Form Submit
async function handleRegister(event) {
    event.preventDefault();

    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.querySelector('input[name="reg-role"]:checked').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (password.length < 6) {
        showToast('Password must be at least 6 characters long.', true);
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');

        const response = await apiRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password, role })
        });

        showToast('Registration successful! Please sign in.', false);

        // Automatically switch back to sign-in tab & prepopulate
        setTimeout(() => {
            switchTab('login');
            document.getElementById('login-identifier').value = username;
            document.getElementById('login-password').value = password;
        }, 1500);

    } catch (error) {
        showToast(error.message || 'Registration failed. Try again.', true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
}
