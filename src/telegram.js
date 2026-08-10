const https = require('https');

function getBotToken() {
    return process.env.TELEGRAM_BOT_TOKEN || '8870809274:AAEC1SfmunltKqE_Akq4Z5IEW1K9HyAIy5c';
}

/**
 * Sends a text message to a user via the Telegram Bot API.
 * @param {string|number} chatId 
 * @param {string} text 
 * @returns {Promise<Object>}
 */
function sendMessage(chatId, text, options = {}) {
    return new Promise((resolve, reject) => {
        const token = getBotToken();
        if (!token) return reject(new Error('TELEGRAM_BOT_TOKEN not configured'));

        const payload = JSON.stringify({ chat_id: chatId, text, ...options });

        const reqOptions = {
            hostname: 'api.telegram.org',
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(reqOptions, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (!parsed.ok) return reject(new Error(parsed.description || 'Telegram API Error'));
                    resolve(parsed.result);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(8000, () => req.destroy(new Error('Telegram request timed out')));
        req.write(payload);
        req.end();
    });
}

module.exports = {
    sendMessage
};
