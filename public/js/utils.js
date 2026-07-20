// UI Toast helper
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast'; // reset classes
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.add('success');
    }

    toast.classList.remove('hidden');

    // Fade in animation trigger
    setTimeout(() => {
        toast.classList.add('visible');
    }, 10);

    // Auto hide after 4 seconds
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 4000);
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Format SQLite timestamps to friendly text
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// API request helper wrapper with JSON parsing
async function apiRequest(url, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };

    // If body is FormData (e.g. file uploads), let browser set content-type with Boundary limits
    if (options.body && options.body instanceof FormData) {
        options.headers = options.headers || {};
        // Ensure no Content-Type is forced when sending FormData
        if (options.headers['Content-Type']) delete options.headers['Content-Type'];
    } else {
        options.headers = { ...defaultHeaders, ...options.headers };
    }

    // Include credentials so same-origin cookies (sessions) are sent
    options.credentials = options.credentials || 'include';
    options.cache = 'no-store';

    try {
        const response = await fetch(url, options);

        // Be resilient to non-JSON responses (HTML error pages, redirects)
        const contentType = response.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            const errMsg = typeof data === 'string' ? data : (data.error || JSON.stringify(data));
            throw new Error(errMsg || 'Server request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error details:', error);
        throw error;
    }
}

// Global active session validation
async function checkAuthSession(isAuthPage = false) {
    try {
        const data = await apiRequest('/api/auth/me');
        if (data.loggedIn) {
            if (isAuthPage) {
                // Logged in user hitting index.html -> redirect based on role
                if (data.user.role === 'RESPONDENT') {
                    window.location.href = '/respondent.html';
                } else {
                    window.location.href = '/dashboard.html';
                }
            }
            return data.user;
        } else {
            if (!isAuthPage) {
                // Logged out user hitting auth protected dashboard -> redirect to index.html
                window.location.href = '/';
            }
            return null;
        }
    } catch (error) {
        if (!isAuthPage) {
            window.location.href = '/';
        }
        return null;
    }
}
