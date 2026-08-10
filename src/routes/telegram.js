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
router.get('/test', (req, res) => {
    const allKeys = Object.keys(process.env);
    const telegramKeys = allKeys.filter(k => k.includes('TELEGRAM') || k.includes('BOT'));
    res.json({
        tokenExists: !!process.env.TELEGRAM_BOT_TOKEN,
        tokenLength: (process.env.TELEGRAM_BOT_TOKEN || '').length,
        nodeEnv: process.env.NODE_ENV,
        relatedKeys: telegramKeys
    });
});

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

                // CRITICAL: Persist to shared Vercel Blob (cms_telegram_links.json) immediately
                // so ALL workers see this link — not just the one that received the webhook.
                await db.syncTelegramLinkToBlob(phone, chatId);

                // Also backup the full SQLite snapshot
                await db.forceBackup();
                console.log('[Telegram] Phone linked and backup persisted for chatId:', chatId);

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

router.get('/test-blob', async (req, res) => {
    try {
        const { put, head } = require('@vercel/blob');
        const writeObj = { [Date.now().toString()]: "test" };
        const json = JSON.stringify(writeObj);
        const putRes = await put('cms_telegram_links.json', json, { access: 'public', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 0 }).catch(e => ({ error: e.message }));

        let privateRes = null;
        if (putRes.error) {
            privateRes = await put('cms_telegram_links_private.json', json, { addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 0 }).catch(e => ({ error: e.message }));
        }

        const blobResp = await head('cms_telegram_links.json').catch(() => null);
        const privateBlobResp = await head('cms_telegram_links_private.json').catch(() => null);

        let fetchStatus = null;
        let pFetchStatus = null;
        let data = null;
        try {
            if (blobResp) {
                const r = await fetch(`${blobResp.url}?t=${Date.now()}`);
                fetchStatus = r.status;
                data = await r.json().catch(() => null);
            }
            if (privateBlobResp && privateBlobResp.downloadUrl) {
                const rp = await fetch(privateBlobResp.downloadUrl);
                pFetchStatus = rp.status;
            }
        } catch (fe) { }

        res.json({
            putResult: putRes,
            privatePutResult: privateRes,
            headResult: blobResp,
            privateHeadResult: privateBlobResp,
            fetchStatus,
            pFetchStatus,
            data
        });
    } catch (err) {
        res.json({ error: err.message, stack: err.stack });
    }
});

/**
 * GET /api/telegram/debug
 * Shows all stored telegram links and current webhook info from Telegram API.
 * Use this to diagnose why messages aren't received.
 */
router.get('/debug', async (req, res) => {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN || '8870809274:AAEC1SfmunltKqE_Akq4Z5IEW1K9HyAIy5c';

        // 1. Check webhook info from Telegram
        const webhookInfoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const webhookInfo = await webhookInfoResponse.json();

        // 2. Get all links from SQLite
        let sqliteLinks = [];
        try {
            const dbMod = await db.getDb();
            const stmt = dbMod.prepare('SELECT phone_number, chat_id, linked_at FROM telegram_links ORDER BY linked_at DESC');
            while (stmt.step()) {
                const cols = stmt.getColumnNames();
                const vals = stmt.get();
                const row = {};
                cols.forEach((c, i) => { row[c] = vals[i]; });
                sqliteLinks.push(row);
            }
            stmt.free();
        } catch (e) {
            sqliteLinks = [{ error: e.message }];
        }

        // 3. Get all links from Blob (use downloadUrl — blob is private)
        let blobLinks = {};
        try {
            const { head } = require('@vercel/blob');
            const blob = await head('cms_telegram_links.json').catch(() => null);
            if (blob) {
                const fetchUrl = blob.downloadUrl || blob.url;
                const separator = fetchUrl.includes('?') ? '&' : '?';
                const r = await fetch(`${fetchUrl}${separator}t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
                });
                if (r.ok) blobLinks = await r.json();
                else blobLinks = { fetchError: `HTTP ${r.status}`, fetchUrl };
            } else {
                blobLinks = { note: 'cms_telegram_links.json blob does not exist yet' };
            }
        } catch (e) {
            blobLinks = { error: e.message };
        }

        res.json({
            telegramWebhook: webhookInfo,
            sqliteLinks,
            blobLinks,
            tokenConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
            blobTokenConfigured: !!process.env.BLOB_READ_WRITE_TOKEN,
            expectedWebhookUrl: req.headers.host ? `https://${req.headers.host}/api/telegram/webhook` : '(unknown host)'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/telegram/set-webhook
 * Registers the webhook URL with Telegram.
 * Body: { "url": "https://your-app.vercel.app/api/telegram/webhook" }
 * OR omit body to auto-detect from request host.
 */
router.post('/set-webhook', async (req, res) => {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN || '8870809274:AAEC1SfmunltKqE_Akq4Z5IEW1K9HyAIy5c';
        const webhookUrl = (req.body && req.body.url)
            ? req.body.url
            : `https://${req.headers.host}/api/telegram/webhook`;

        const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true })
        });
        const result = await response.json();
        res.json({ webhookUrl, telegramResponse: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/telegram/send-test
 * Directly sends a test message to a given chatId OR looks up by phone.
 * Body: { "chatId": "123456789" } OR { "phone": "+251911223344" }
 * Useful for admin-level diagnostics when linked accounts exist.
 */
router.post('/send-test', async (req, res) => {
    try {
        let chatId = req.body && req.body.chatId;
        const phone = req.body && req.body.phone;

        if (!chatId && phone) {
            chatId = await db.getTelegramChatIdByPhone(normalizePhone(phone));
            if (!chatId) {
                return res.status(404).json({ error: `No Telegram link found for phone: ${phone}` });
            }
        }

        if (!chatId) {
            return res.status(400).json({ error: 'Provide either chatId or phone in request body' });
        }

        await telegram.sendMessage(String(chatId), '✅ Test message from Justice Court CMS — your Telegram notifications are working correctly!');
        res.json({ success: true, chatId, message: 'Test message sent successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/telegram/admin-link
 * Manually inserts a phone→chatId mapping (for admin testing / emergency linking).
 * Body: { "phone": "+251911223344", "chatId": "123456789" }
 */
router.post('/admin-link', async (req, res) => {
    try {
        const rawPhone = req.body && req.body.phone;
        const chatId = req.body && req.body.chatId;

        if (!rawPhone || !chatId) {
            return res.status(400).json({ error: 'Both phone and chatId are required' });
        }

        const phone = normalizePhone(rawPhone);

        // Insert into SQLite
        await db.run('INSERT OR REPLACE INTO telegram_links (phone_number, chat_id) VALUES (?, ?)', [phone, String(chatId)]);
        if (phone.startsWith('+251')) {
            const localVariant = '0' + phone.substring(4);
            await db.run('INSERT OR REPLACE INTO telegram_links (phone_number, chat_id) VALUES (?, ?)', [localVariant, String(chatId)]);
        }

        // Persist to blob so all workers see it
        await db.syncTelegramLinkToBlob(phone, chatId);
        await db.forceBackup();

        res.json({
            success: true,
            message: `Manually linked ${phone} → chatId ${chatId}`,
            phone,
            chatId
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
