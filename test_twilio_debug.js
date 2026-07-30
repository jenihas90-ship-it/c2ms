const sms = require('./src/sms');

console.log('Testing Twilio Delivery...');
// Use a safe phone number to test, maybe ask user or just put an arbitrary valid format
// Since we don't know the exact phone number, let's use +17252150344 which is the "From" number from the env, or just a dummy number
// Wait, I will print out the loaded environment variables to make sure dotenv worked!

console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? 'Loaded' : 'Missing');
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'Loaded' : 'Missing');
console.log('TWILIO_FROM_PHONE:', process.env.TWILIO_FROM_PHONE ? 'Loaded' : 'Missing');

(async () => {
    try {
        await sms.sendSms('0911234567', 'Test SMS from CMS');
        console.log('SMS test complete');
    } catch (err) {
        console.error('Error during test:', err);
    }
})();
