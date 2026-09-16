
async function test() {
    try {
        const login = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginIdentifier: 'respondent', password: 'resp123' })
        });
        const loginCookieStr = login.headers.get('set-cookie');

        // In node fetch, multiple Set-Cookie headers are comma-separated. Best way is to just grab the raw header.
        // wait, we can just login again via fetch in another node process...

    } catch (e) { console.error(e) }
}
test();
