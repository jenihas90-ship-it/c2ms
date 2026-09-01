const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Inject the token for testing
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
    console.error("BLOB_READ_WRITE_TOKEN is missing from .env!");
    process.exit(1);
}

// Mimic the exact blob read logic
async function testBlobRead() {
    const { list: blobList } = require('@vercel/blob');
    const COMPLAINTS_BLOB_KEY = 'cms_complaints.json';

    console.log("Testing blob listing for:", COMPLAINTS_BLOB_KEY);

    try {
        const { blobs } = await blobList({ prefix: COMPLAINTS_BLOB_KEY, limit: 10, token });
        console.log("All blobs with prefix:", blobs.map(b => ({ pathname: b.pathname, size: b.size, url: b.downloadUrl?.substring(0, 60) + "..." })));

        const blobInfo = blobs.find(b => b.pathname === COMPLAINTS_BLOB_KEY) || null;
        console.log("Exact match found:", blobInfo ? "YES" : "NO");

        if (!blobInfo) {
            console.log("No blob found with exact pathname. Creating it now...");
            const { put } = require('@vercel/blob');
            await put(COMPLAINTS_BLOB_KEY, JSON.stringify([]), { access: 'public', addRandomSuffix: false, contentType: 'application/json', token });
            console.log("Empty blob created with public access.");
            return;
        }

        // Try to fetch the blob
        console.log("Attempting to fetch blob downloadUrl...");
        const headers = { 'Authorization': `Bearer ${token}` };
        const finalUrl = blobInfo.downloadUrl + (blobInfo.downloadUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        console.log("Fetch URL:", finalUrl.substring(0, 80) + "...");
        const res = await fetch(finalUrl, { headers });
        console.log("Fetch status:", res.status, res.statusText);

        if (res.ok) {
            const data = await res.json();
            console.log("Blob data (type):", typeof data, Array.isArray(data) ? `Array(${data.length})` : "not array");
        } else {
            const body = await res.text();
            console.error("Fetch FAILED:", body.substring(0, 300));
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

testBlobRead();
