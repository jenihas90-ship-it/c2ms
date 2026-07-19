async function runTests() {
    console.log('Starting API RBAC Verification...');

    let sessionCookie = '';

    // Helper to run reqs keeping session
    async function request(path, options = {}) {
        const headers = options.headers || {};
        if (sessionCookie) headers['Cookie'] = sessionCookie;
        headers['Content-Type'] = 'application/json';

        const res = await fetch(`http://localhost:3000${path}`, { ...options, headers });
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            sessionCookie = setCookie.split(';')[0];
        }

        const bodyText = await res.text();
        let body;
        try { body = JSON.parse(bodyText); } catch (e) { body = bodyText; }
        return { status: res.status, body };
    }

    // 1. Citizen Flow
    console.log('\\n--- Citizen Test ---');
    let res = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ loginIdentifier: 'user', password: 'user123' }) });
    console.log('Login User (200):', res.status);

    // File Complaint
    const cmpBody = {
        title: 'Test Civil Matter', category: 'Civil', description: 'Test',
        court_name: 'Supreme Court', case_number: 'CV-123', priority: 'Medium'
    };
    res = await request('/api/complaints', { method: 'POST', body: JSON.stringify(cmpBody) });
    console.log('File Complaint (201):', res.status);
    const newId = res.body.id || 1;

    // Try accessing Admin Endpoint (Should fail)
    res = await request('/api/admin/users', { method: 'GET' });
    console.log('Citizen accessing /api/admin/users (403):', res.status);

    // Try accessing Judge Endpoint (Should fail)
    res = await request('/api/judge/calendar', { method: 'GET' });
    console.log('Citizen accessing /api/judge/calendar (403):', res.status);

    await request('/api/auth/logout', { method: 'POST' });

    // 2. Clerk Flow
    console.log('\\n--- Clerk Test ---');
    res = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ loginIdentifier: 'clerk', password: 'clerk123' }) });
    console.log('Login Clerk (200):', res.status);

    // Verify & schedule
    res = await request('/api/clerk/verify', { method: 'POST', body: JSON.stringify({ complaint_id: newId, status: 'In Progress' }) });
    console.log('Clerk Verify/Status (200):', res.status);

    res = await request('/api/clerk/schedule', { method: 'POST', body: JSON.stringify({ complaint_id: newId, hearing_type: 'Preliminary', session_date: '2026-10-10' }) });
    console.log('Clerk Schedule (201):', res.status);

    // Access judge endpoints
    res = await request('/api/judge/notes', { method: 'POST', body: JSON.stringify({ complaint_id: newId, note_text: 'test' }) });
    console.log('Clerk accessing Judge Notes (Should fail 403):', res.status);

    await request('/api/auth/logout', { method: 'POST' });

    // 3. Judge Flow
    console.log('\\n--- Judge Test ---');
    res = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ loginIdentifier: 'judge', password: 'judge123' }) });
    console.log('Login Judge (200):', res.status);

    // Add note
    res = await request('/api/judge/notes', { method: 'POST', body: JSON.stringify({ complaint_id: newId, note_text: 'Judge private note' }) });
    console.log('Judge adding Note (201):', res.status);

    // Adjudicate
    res = await request('/api/judge/adjudicate', { method: 'POST', body: JSON.stringify({ complaint_id: newId, order_type: 'Final Judgment', order_details: 'Guilty', status: 'Resolved' }) });
    console.log('Judge adjudicate (200):', res.status);

    await request('/api/auth/logout', { method: 'POST' });

    // 4. Admin Flow
    console.log('\\n--- Admin Test ---');
    res = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ loginIdentifier: 'admin', password: 'admin123' }) });
    console.log('Login Admin (200):', res.status);

    res = await request('/api/admin/users', { method: 'GET' });
    console.log('Admin accessing Users (200):', res.status);

    await request('/api/auth/logout', { method: 'POST' });
}

runTests().catch(console.error);
