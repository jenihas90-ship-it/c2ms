const http = require('http');

const data = JSON.stringify({
    title: 'Test Issue',
    category: 'Civil',
    court_name: 'High Court',
    court_address: '123 Fake St, City',
    description: 'A test dispute'
});

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
}, (res) => {
    let responseBody = '';
    res.on('data', chunk => responseBody += chunk);
    res.on('end', () => {
        console.log('Register status:', res.statusCode);
        console.log('Response body:', responseBody);

        // Skip session logic and test DB directly
        const db = require('./src/db');
        db.getDb().then(database => {
            const row = database.exec('SELECT court_name, court_address FROM complaints LIMIT 1');
            console.log('DB row:', JSON.stringify(row));
            process.exit(0);
        });
    });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
