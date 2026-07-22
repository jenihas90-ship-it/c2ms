async function test() {
    let sessionCookie = '';
    const resAuth = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginIdentifier: 'user', password: 'user123' })
    });
    sessionCookie = resAuth.headers.get('set-cookie').split(';')[0];
    console.log('Login:', resAuth.status);

    const body = {
        title: 'Property Dispute',
        category: 'Property',
        court_name: 'Local Court',
        court_address: '123 Main St',
        description: 'Test dispute over boundary',
        complainant_name: 'John Doe',
        complainant_phone: '555-0001',
        complainant_country: 'USA',
        complainant_region: 'CA',
        complainant_woreda: 'Zone A',
        respondent_name: 'Jane Smith',
        respondent_phone: '555-0002',
        respondent_email: 'jane@example.com',
        respondent_country: 'USA',
        respondent_region: 'CA',
        respondent_woreda: 'Zone B'
    };

    const resComp = await fetch('http://localhost:3000/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
        body: JSON.stringify(body)
    });
    console.log('File Complaint:', resComp.status, await resComp.text());
}
test().catch(console.error);
