require('dotenv').config();
const { list } = require('@vercel/blob');
const fs = require('fs');

async function testCache() {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_5fd79abc01e1ceef86b_G7qY7jT7oI8H3AFTT0LTh8xkVZ3bF2"; // Not real, I need to fetch it from .env

    // Use full regex match to manually extract token from file safely if needed
    const envData = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
    const match = envData.match(/BLOB_READ_WRITE_TOKEN=(.+)/);
    if (match) {
        process.env.BLOB_READ_WRITE_TOKEN = match[1].trim();
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error("NO TOKEN FOUND");
        return;
    }

    try {
        const { blobs } = await list({ prefix: 'cms_vercel.sqlite' });
        console.log("Blobs found: ", blobs.length);
        if (blobs.length > 0) {
            console.log("URL:", blobs[0].url);

            // Try fetching with explicit cache busting
            const url1 = blobs[0].url + "?cacheBust=" + Date.now();
            console.log("Fetching:", url1);
            const r1 = await fetch(url1, { cache: 'no-store' });
            console.log("Fetch success:", r1.ok);
            // Just check size
            const buf1 = Buffer.from(await r1.arrayBuffer());
            console.log("Size:", buf1.length);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
testCache();
