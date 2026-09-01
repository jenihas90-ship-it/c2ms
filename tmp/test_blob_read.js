const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/db.js');

async function test() {
    console.log("BLOB TOKEN:", process.env.BLOB_READ_WRITE_TOKEN ? "PRESENT" : "MISSING");
    try {
        const list = await db.getAllComplaintsFromBlob({});
        console.log("Found complaints:", list.length);
    } catch (err) {
        console.error("Error:", err);
    }
}
test();
