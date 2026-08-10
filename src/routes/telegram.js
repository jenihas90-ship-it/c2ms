const express = require('express');
const router = express.Router();
const telegram = require('../telegram');
const db = require('../db');

/**
 * Normalizes a phone number to standard E.164 and local Ethiopian formats
 */
function normalizePhone(phone) {
    if (!phone) return '';
    let p = String(phone).trim().replace(/\s+/g, '');
    if (p.startsWith('09') || p.startsWith('07')) {
        return '+251' + p.substring(1);
    } else if (p.startsWith('251') && !p.startsWith('+')) {
        return '+' + p;
    } else if (!p.startsWith('+')) {
        return '+' + p;
    }
    return p;
}

// Handle all Telegram incoming webhooks
router.post('/webhook', async (req, res) => {
    try {
        const update = req.body;
        if (!update || !update.message) {
            return res.sendStatus(200);
        }

        const msg = update.message;
        const chatId = msg.chat.id;
        const text = msg.text || '';

        // Handle Start Command
        if (text === '/start') {
            const welcome = "Welcome to the Justice Court CMS Bot! ⚖️\n\nTo link your court account, please share your contact number so we can securely match it with your case files.";
            await telegram.sendMessage(chatId, welcome, {
                reply_markup: {
                    keyboard: [
                        [{ text: "📞 Share Phone Number to Link Account", request_contact: true }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
            return res.sendStatus(200);
        }

        // Process Contact Payload or text-based linking
        let rawPhone = null;
        if (msg.contact && msg.contact.phone_number) {
            rawPhone = msg.contact.phone_number;
        } else if (text.startsWith('+') || text.startsWith('09') || text.startsWith('07')) {
            rawPhone = text;
        }

        if (rawPhone) {
            const phone = normalizePhone(rawPhone);

            try {
                await db.run('INSERT OR REPLACE INTO telegram_links (phone_number, chat_id) VALUES (?, ?)', [phone, String(chatId)]);

                // Duplicate the link for local format (09...) to ensure it catches older legacy local phone entries
                if (phone.startsWith('+251')) {
                    const localVariant = '0' + phone.substring(4);
                    await db.run('INSERT OR REPLACE INTO telegram_links (phone_number, chat_id) VALUES (?, ?)', [localVariant, String(chatId)]);
                }

                await telegram.sendMessage(chatId, `✅ Success!\n\nPhone number ${phone} is now securely linked to this chat.\n\nYou will instantly receive official court updates here for any cases filed under your name.`, {
                    reply_markup: { remove_keyboard: true }
                });
            } catch (err) {
                console.error('Telegram link error:', err);
                await telegram.sendMessage(chatId, "An error occurred while linking your account. Please try again.");
            }
        } else if (text) {
            await telegram.sendMessage(chatId, "I didn't recognize that command. To link your account, use the button below or send your full phone number (e.g. +251911223344).", {
                reply_markup: {
                    keyboard: [
                        [{ text: "📞 Share Phone Number to Link Account", request_contact: true }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
        }
    } catch (globalErr) {
        console.error('Webhook error:', globalErr);
    }

    // 200 OK immediately at the END to prevent Vercel from suspending process before messages send
    res.sendStatus(200);
});

module.exports = router;
