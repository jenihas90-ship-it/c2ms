const formData = new FormData();
formData.append('remark', '[FORMAL RESPONSE] Test');
formData.append('court_fee_receipt', new Blob(['test']), 'test.pdf');

async function test() {
    const login = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginIdentifier: 'respondent', password: 'resp123' })
    });
    const loginCookie = login.headers.get('set-cookie');
    console.log('Login:', await login.json());

    // First, we need a case. Let's create one directly in sqlite or using the API
}
test().catch(console.error);
