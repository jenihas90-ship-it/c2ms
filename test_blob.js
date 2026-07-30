require('dotenv').config();
const { list } = require('@vercel/blob');
const fs = require('fs');

async function testBlob() {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_5fd79abc01e1ceef86b_G7qY7jT7oI8H3AFTT0LTh8xkVZ3bF2"; // Not real, I need to fetch it from .env

    // Let's just use the process.env that dotenv loads
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error("NO TOKEN FOUND");
        return;
    }

    try {
        const { blobs } = await list({ prefix: 'cms_vercel.sqlite' });
        console.log("Found blobs:", blobs);
        if (blobs.length > 0) {
            const response = await fetch(blobs[0].url);
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync('./downloaded_blob.sqlite', buffer);
            console.log("Downloaded blob to downloaded_blob.sqlite");

            // Let's load the sqlite db and query it
            const initSqlJs = require('sql.js/dist/sql-asm.js');
            const SQL = await initSqlJs();
            const db = new SQL.Database(buffer);

            const res = db.exec("SELECT * FROM complaints");
            if (res.length > 0 && res[0].values) {
                console.log("Complaints in DB:", res[0].values.length);
                console.log("Latest complaint:", res[0].values[res[0].values.length - 1]);
            } else {
                console.log("Complaints in DB: 0");
            }
        }
    } catch (err) {
        console.error("Error:", err);
    }
}
testBlob();
