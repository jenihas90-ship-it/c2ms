
async function test() {
    try {
        const login = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginIdentifier: 'respondent', password: 'resp123' })
        });
        const loginCookieStr = login.headers.get('set-cookie');
        console.log('Login:', await login.json());
        console.log('Cookie:', loginCookieStr);

        const match = loginCookieStr.match(/(session=\S+?);/);
        if (!match) return;
        const cookieHeader = match[1];

        // Seed a case for respondent
        const createReq = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginIdentifier: 'admin', password: 'admin123' })
        });
        const adminCookie = createReq.headers.get('set-cookie').match(/(session=\S+?);/)[1];

        // Create complaint
        const fd = new FormData();
        fd.append('title', 'Test Case');
        fd.append('category', 'Civil');
        fd.append('description', 'Test desc');
        fd.append('respondent_email', 'respondent@cms.com');

        const res = await fetch('http://localhost:3000/api/complaints', {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: fd
        });

        const casesReq = await fetch('http://localhost:3000/api/respondent/cases', { headers: { cookie: cookieHeader } });
        const cases = await casesReq.json();
        console.log('Cases:', cases);
        if (cases.cases.length === 0) { console.log('No cases. Cannot test.'); return; }

        const cId = cases.cases[0].id;
        const subFd = new FormData();
        subFd.append('remark', '[FORMAL RESPONSE] Test');
        subFd.append('court_fee_receipt', new Blob(['test']), 'test.pdf');

        const resReq = await fetch('http://localhost:3000/api/respondent/case/' + cId + '/respond', {
            method: 'POST',
            body: subFd,
            headers: { cookie: cookieHeader }
        });
        console.log('Submit Response status:', resReq.status, await resReq.text());
    } catch (e) { console.error(e) }
}
test();
