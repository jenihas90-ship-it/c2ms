/**
 * CMS Quick API Verification Script
 * Runs against the locally running server at http://localhost:3000
 */
const http = require('http');

function makeRequest(method, path, data, cookieStr) {
    return new Promise((resolve, reject) => {
        const body = data ? JSON.stringify(data) : null;
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
                ...(cookieStr ? { 'Cookie': cookieStr } : {})
            }
        };
        const req = http.request(options, (res) => {
            let raw = '';
            res.on('data', chunk => { raw += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(raw), headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, body: raw, headers: res.headers });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function extractCookie(headers) {
    const rawCookies = headers['set-cookie'];
    if (!rawCookies) return '';
    return rawCookies.map(c => c.split(';')[0]).join('; ');
}

async function runTests() {
    let failures = 0;
    let passes = 0;

    function check(name, condition, detail = '') {
        if (condition) {
            console.log(`  ✅ PASS: ${name}`);
            passes++;
        } else {
            console.log(`  ❌ FAIL: ${name}${detail ? ' - ' + detail : ''}`);
            failures++;
        }
    }

    // ─── Login as user ───────────────────────────────────────────────────────────
    console.log('\n[1] Login as Complainant (user / user123)');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
        loginIdentifier: 'user', password: 'user123'
    });
    check('Login HTTP 200', loginRes.status === 200, `got ${loginRes.status}`);
    check('Role = complainant', loginRes.body?.user?.role === 'complainant');
    const userCookie = extractCookie(loginRes.headers);
    check('Session cookie issued', !!userCookie);

    // ─── Session check ───────────────────────────────────────────────────────────
    console.log('\n[2] Session Check /api/auth/me');
    const meRes = await makeRequest('GET', '/api/auth/me', null, userCookie);
    check('/me returns logged in', meRes.body?.loggedIn === true);
    check('Correct username in session', meRes.body?.user?.username === 'user');

    // ─── File a complaint ─────────────────────────────────────────────────────────
    console.log('\n[3] File a Complaint (via URI-encoded form - No file attachment)');
    const compRes = await makeRequest('POST', '/api/complaints', {
        title: 'Dispute over land property',
        category: 'Civil',
        priority: 'High',
        court_name: 'Supreme Court',
        case_number: 'CV-2026-101',
        description: 'Neighbor is encroaching on property lines...'
    }, userCookie);
    check('Complaint creation HTTP 201', compRes.status === 201, `got ${compRes.status}: ${JSON.stringify(compRes.body)}`);
    const complaintId = compRes.body?.complaintId;
    check('Complaint ID returned', !!complaintId);

    // ─── Get complaints list ───────────────────────────────────────────────────────
    console.log('\n[4] Get Complaints List');
    const listRes = await makeRequest('GET', '/api/complaints', null, userCookie);
    check('List HTTP 200', listRes.status === 200);
    check('Complaint appears in list', Array.isArray(listRes.body) && listRes.body.some(c => c.id === complaintId));

    // ─── Get complaint details ────────────────────────────────────────────────────
    console.log('\n[5] Get Complaint Details');
    const detailRes = await makeRequest('GET', `/api/complaints/${complaintId}`, null, userCookie);
    check('Details HTTP 200', detailRes.status === 200, `got ${detailRes.status}`);
    check('Correct title', detailRes.body?.complaint?.title === 'Dispute over land property');
    check('Status starts as Filed', detailRes.body?.complaint?.status === 'Filed');

    // ─── Post remark as user ──────────────────────────────────────────────────────
    console.log('\n[6] Post Remark as User');
    const rmkUser = await makeRequest('POST', `/api/complaints/${complaintId}/remarks`, {
        remark: 'I am using a wired ethernet port and still experiencing this issue.'
    }, userCookie);
    check('Remark HTTP 201', rmkUser.status === 201, `got ${rmkUser.status}: ${JSON.stringify(rmkUser.body)}`);
    check('Remark author is user', rmkUser.body?.remark?.username === 'user');

    // ─── Logout user ─────────────────────────────────────────────────────────────
    console.log('\n[7] Logout');
    const logoutRes = await makeRequest('POST', '/api/auth/logout', null, userCookie);
    check('Logout HTTP 200', logoutRes.status === 200);

    // ─── Login as admin ───────────────────────────────────────────────────────────
    console.log('\n[8] Login as Admin (admin / admin123)');
    const adminLoginRes = await makeRequest('POST', '/api/auth/login', {
        loginIdentifier: 'admin', password: 'admin123'
    });
    check('Admin login HTTP 200', adminLoginRes.status === 200, `got ${adminLoginRes.status}`);
    check('Role = admin', adminLoginRes.body?.user?.role === 'admin');
    const adminCookie = extractCookie(adminLoginRes.headers);

    // ─── Admin stats ──────────────────────────────────────────────────────────────
    console.log('\n[9] Admin Stats API');
    const statsRes = await makeRequest('GET', '/api/admin/stats', null, adminCookie);
    check('Stats HTTP 200', statsRes.status === 200, `got ${statsRes.status}: ${JSON.stringify(statsRes.body)}`);
    check('Total > 0', statsRes.body?.summary?.total > 0);
    check('Filed/Pending count > 0', statsRes.body?.summary?.pending >= 0);

    // ─── Admin change status ──────────────────────────────────────────────────────
    console.log('\n[10] Admin: Change Status to In Progress');
    const statusRes = await makeRequest('PATCH', `/api/complaints/${complaintId}/status`, {
        status: 'In Progress'
    }, adminCookie);
    check('Status update HTTP 200', statusRes.status === 200, `got ${statusRes.status}: ${JSON.stringify(statusRes.body)}`);

    // ─── Admin post remark ────────────────────────────────────────────────────────
    console.log('\n[11] Admin: Post Response Remark');
    const rmkAdmin = await makeRequest('POST', `/api/complaints/${complaintId}/remarks`, {
        remark: 'Checking the core link bandwidth logs. Congestion on switch G-2.'
    }, adminCookie);
    check('Admin remark HTTP 201', rmkAdmin.status === 201, `got ${rmkAdmin.status}`);
    check('Admin remark author', rmkAdmin.body?.remark?.username === 'admin');

    // ─── Verify updated details ───────────────────────────────────────────────────
    console.log('\n[12] Verify Updated Status & Remarks');
    const updatedDet = await makeRequest('GET', `/api/complaints/${complaintId}`, null, adminCookie);
    check('Status is now In Progress', updatedDet.body?.complaint?.status === 'In Progress');
    check('Multiple remarks present', Array.isArray(updatedDet.body?.remarks) && updatedDet.body.remarks.length >= 2);

    // ─── Admin resolve ────────────────────────────────────────────────────────────
    console.log('\n[13] Admin: Mark as Resolved');
    const resolveRes = await makeRequest('PATCH', `/api/complaints/${complaintId}/status`, {
        status: 'Resolved'
    }, adminCookie);
    check('Resolved status HTTP 200', resolveRes.status === 200);

    // ─── Verify resolved ──────────────────────────────────────────────────────────
    console.log('\n[14] Verify Final Resolved State');
    const finalDet = await makeRequest('GET', `/api/complaints/${complaintId}`, null, adminCookie);
    check('Status = Resolved', finalDet.body?.complaint?.status === 'Resolved');

    // ─── Summary ─────────────────────────────────────────────────────────────────
    console.log(`\n${'─'.repeat(55)}`);
    console.log(`RESULTS: ${passes} PASSED, ${failures} FAILED`);
    console.log('─'.repeat(55));
    process.exit(failures > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
