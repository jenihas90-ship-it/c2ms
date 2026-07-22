const http = require('http');

async function test() {
    console.log("Testing Registration...");
    const regRes = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testrespz4', email: 'test4@example.com', password: 'password', role: 'RESPONDENT' })
    });
    console.log("REG STATUS:", regRes.status);
    console.log("REG BODY:", await regRes.text());

    console.log("Testing Login...");
    const logRes = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginIdentifier: 'testrespz4', password: 'password' })
    });
    console.log("LOGIN STATUS:", logRes.status);
    console.log("LOGIN BODY:", await logRes.text());
}
test();
