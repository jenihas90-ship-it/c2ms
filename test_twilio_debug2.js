const sms = require('./src/sms');

console.log('Testing Twilio Delivery to Verified Number...');

(async () => {
    try {
        await sms.sendSms('0935709738', 'Test SMS from CMS. Your number is successfully verified!');
        console.log('SMS test complete');
    } catch (err) {
        console.error('Error during test:', err);
    }
})();
