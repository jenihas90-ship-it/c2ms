/**
 * SMS Module - AI-Generated SMS Content + Delivery
 *
 * Uses Google Gemini API to craft personalized legal SMS notifications.
 * Falls back to a professional template when GEMINI_API_KEY is not set.
 *
 * For real SMS delivery, set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * and TWILIO_FROM_PHONE. Otherwise messages are logged to console.
 */

const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';

// --- Twilio (optional) ---
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_PHONE = process.env.TWILIO_FROM_PHONE;

/**
 * Build an AI-generated SMS message using Gemini.
 * Falls back to a template if no API key is configured.
 *
 * @param {Object} complaint  - The complaint DB row
 * @param {string} orderDetails - The judge's order/judgment text
 * @param {string} orderType    - e.g. "Final Judgment", "Dismissal"
 * @returns {Promise<string>}  - SMS text (max ~160 chars recommended)
 */
async function generateSmsContent(complaint, orderDetails, orderType) {
    if (!GEMINI_API_KEY) {
        return buildFallbackSms(complaint, orderDetails, orderType);
    }

    try {
        const prompt = buildPrompt(complaint, orderDetails, orderType);
        const smsText = await callGemini(prompt);
        // Trim to stay within SMS limits (keep under 480 chars / 3 SMS segments)
        return smsText.slice(0, 480).trim();
    } catch (err) {
        console.error('[AI SMS] Gemini error, using fallback:', err.message || err);
        return buildFallbackSms(complaint, orderDetails, orderType);
    }
}

/**
 * Build the prompt sent to Gemini.
 */
function buildPrompt(complaint, orderDetails, orderType) {
    return `You are a court clerk drafting a formal SMS notification for a legal respondent.
Write a concise, professional SMS (max 3 sentences, under 400 characters) to notify the respondent about a court judgment.

Case details:
- Case Number: ${complaint.case_number || 'N/A'}
- Court: ${complaint.court_name || 'N/A'}
- Complaint Title: ${complaint.title}
- Respondent Name: ${complaint.defendant_name || 'Respondent'}
- Order Type: ${orderType}
- Judge's Order Summary: ${orderDetails}

Write ONLY the SMS text. Do not add any explanation, greeting prefix like "SMS:", or markdown.`;
}

/**
 * Call the Gemini REST API (no SDK needed).
 */
function callGemini(prompt) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 150,
                topP: 0.9
            }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        return reject(new Error(parsed.error.message || 'Gemini API error'));
                    }
                    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!text) return reject(new Error('Empty Gemini response'));
                    resolve(text.trim());
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(8000, () => {
            req.destroy(new Error('Gemini request timed out'));
        });
        req.write(body);
        req.end();
    });
}

/**
 * Professional template fallback — no AI key required.
 */
function buildFallbackSms(complaint, orderDetails, orderType) {
    const name = complaint.defendant_name || 'Respondent';
    const caseRef = complaint.case_number || `Case #${complaint.id}`;
    const court = complaint.court_name || 'the relevant court';
    const summary = orderDetails.length > 120 ? orderDetails.slice(0, 117) + '...' : orderDetails;

    return `COURT NOTICE - ${court}: Dear ${name}, a ${orderType} has been issued on ${caseRef}. Details: ${summary}. Contact the court registry for further information.`;
}

/**
 * Send SMS to a phone number.
 * Uses Twilio if configured, otherwise logs to console (mock mode).
 *
 * @param {string} to      - E.164 format phone number e.g. +251911234567
 * @param {string} message - The SMS body text
 * @returns {Promise<void>}
 */
async function sendSms(to, message) {
    if (!to) {
        console.log('[AI SMS] No respondent phone number — skipping SMS send.');
        return;
    }

    // Normalize phone: ensure it starts with +
    const phone = to.startsWith('+') ? to : `+${to}`;

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_PHONE) {
        await sendViaTwilio(phone, message);
    } else {
        // Mock / console logging (default when no provider is configured)
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[AI SMS] 📱 SMS would be sent to:', phone);
        console.log('[AI SMS] Message:');
        console.log(message);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
    }
}

/**
 * Send via Twilio REST API.
 */
function sendViaTwilio(to, body) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({ To: to, From: TWILIO_FROM_PHONE, Body: body });
        const postData = params.toString();

        const options = {
            hostname: 'api.twilio.com',
            path: `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        console.error('[Twilio] Error:', parsed.message || JSON.stringify(parsed));
                    } else {
                        console.log('[Twilio] SMS sent. SID:', parsed.sid);
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

module.exports = {
    generateSmsContent,
    sendSms
};
