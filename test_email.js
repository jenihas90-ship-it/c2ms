require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log('Testing SMTP connection...');
    console.log('SMTP_USER:', process.env.SMTP_USER);
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 465),
        secure: Number(process.env.SMTP_PORT || 465) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        }
    });

    try {
        await transporter.verify();
        console.log('SMTP Connection successful!');

        await transporter.sendMail({
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: 'jenihas90@gmail.com',
            subject: 'Test Email from CMS',
            text: 'This is a test email to verify credentials.',
        });
        console.log('Test email sent successfully!');
    } catch (err) {
        console.error('SMTP Error:', err);
    }
}

testEmail();
