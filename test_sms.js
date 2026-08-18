const fs = require('fs');

try {
    const envFile = fs.readFileSync('.env', 'utf-8');
    envFile.split('\n').forEach(line => {
        if (!line.includes('=')) return;
        const [key, ...vals] = line.split('=');
        process.env[key.trim()] = vals.join('=').trim();
    });
} catch (e) {
    console.error("Failed to read .env file");
}

const { sendSms } = require('./src/sms');

async function run() {
    const TO = process.argv[2];
    if (!TO) {
        console.error("Usage: node test_sms.js +1234567890");
        return;
    }
    console.log(`Sending test SMS to ${TO} via Africa's Talking / Twilio...`);
    try {
        await sendSms(TO, "Test SMS from Court Complaint Management System. API configuration is working!");
        console.log("Success! SMS API call completed successfully.");
    } catch (err) {
        console.error("SMS test failed:", err.message);
    }
}

run();
