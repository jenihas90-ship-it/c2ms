const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function runTest() {
    const BASE_URL = 'https://c2ms.vercel.app';
    console.log("=== Testing Live Vercel Demo ===");

    // 1. Admin Login
    let res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@admin.com', password: 'password123' })
    });
    let cookieHeader = res.headers.raw()['set-cookie'];
    if (!cookieHeader) {
        console.log("Admin login failed, trying default admin/admin...");
        res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        cookieHeader = res.headers.raw()['set-cookie'];
    }

    // Debug blob
    if (cookieHeader) {
        const debugRes = await fetch(`${BASE_URL}/api/admin/debug-blob`, {
            headers: { 'cookie': cookieHeader.join(';') }
        });
        const debugData = await debugRes.json();
        console.log("Debug Blob Status:", debugData);
    }

    // 2. Citizen Login & File Complaint
    const citizenRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'citizen@test.com', password: 'password123' })
    });
    let citizenCookie = citizenRes.headers.raw()['set-cookie'];
    if (!citizenCookie) {
        console.log("Citizen login failed, skipping filing test.");
        return;
    }

    console.log("Filing complaint as citizen...");
    const formData = new URLSearchParams();
    formData.append('title', 'Test Complaint ' + Date.now());
    formData.append('description', 'This is a test to verify persistence.');
    formData.append('priority', 'Medium');
    formData.append('category', 'Other');

    const fileRes = await fetch(`${BASE_URL}/api/complaints`, {
        method: 'POST',
        headers: {
            'cookie': citizenCookie.join(';'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
    });

    const fileData = await fileRes.json();
    console.log("Filing result:", fileData);

    // 3. Clerk Fetch
    console.log("Fetching complaints as clerk...");
    const clerkRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'clerk@test.com', password: 'password123' })
    });
    let clerkCookie = clerkRes.headers.raw()['set-cookie'];
    if (clerkCookie) {
        const listRes = await fetch(`${BASE_URL}/api/complaints`, {
            headers: { 'cookie': clerkCookie.join(';') }
        });
        const listData = await listRes.json();
        console.log("Clerk fetched", listData.length, "complaints. First one:", listData[0] ? listData[0].title : null);
    }
}

runTest().catch(console.error);
