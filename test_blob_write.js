require('dotenv').config();
const { put, head } = require('@vercel/blob');

async function test() {
    try {
        const res = await put('test_blob_write.json', '{"test":1}', {
            access: 'public',
            addRandomSuffix: false,
            contentType: 'application/json',
            cacheControlMaxAge: 0
        });
        console.log('Success:', res);
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
