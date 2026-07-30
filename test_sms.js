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
    console.log(`Sending test SMS to ${TO} from ${process.env.TWILIO_FROM_PHONE}...`);
    try {
        await sendSms(TO, "Test SMS from Court Complaint Management System. Twilio configuration is working!");
        console.log("Success! Twilio SMS API call completed successfully.");
    } catch (err) {
        console.error("Twilio test failed:", err.message);
    }
}

run();
