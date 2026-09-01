const nodemailer = require('nodemailer');
const db = require('./db');
const sms = require('./sms');
const telegram = require('./telegram');

/**
 * Normalizes a phone number to E.164 format (+251...) for consistent Telegram lookup.
 * Handles formats: 09..., 07..., 251..., +251...
 */
function normalizePhone(phone) {
  if (!phone) return phone;
  let p = String(phone).trim().replace(/\s+/g, '').replace(/-/g, '');
  if (p.startsWith('09') || p.startsWith('07')) return '+251' + p.substring(1);
  if (p.startsWith('251') && !p.startsWith('+')) return '+' + p;
  if (!p.startsWith('+')) return '+' + p;
  return p;
}

// Gmail SMTP config from environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || 'no-reply@resolver.local';

// Respondent portal URL — hardcoded to the live Vercel deployment
const PORTAL_URL = 'https://jenihas90-ship-it-c2ms.vercel.app/respondent.html';

// Detect placeholder / unconfigured credentials so we don't attempt a real SMTP connection
const PLACEHOLDER_PATTERNS = ['your-gmail', 'your-app-password', 'example.com', 'placeholder'];
function isPlaceholder(val) {
  if (!val) return true;
  const v = val.toLowerCase();
  return PLACEHOLDER_PATTERNS.some(p => v.includes(p));
}

let transporter = null;
if (SMTP_USER && SMTP_PASS && !isPlaceholder(SMTP_USER) && !isPlaceholder(SMTP_PASS)) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  console.log(`[Email] Gmail transporter configured for ${SMTP_USER}`);
} else {
  console.log('[Email] SMTP credentials not configured or still set to placeholder values. Email notifications are DISABLED.');
  console.log('[Email] To enable Gmail: set SMTP_USER and SMTP_PASS (Google App Password) in .env');
}

async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.log('Skipping email send (transporter not configured):', subject, 'to', to);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM_EMAIL, to, subject, text, html });
    console.log('Email sent:', subject, 'to', to);
  } catch (err) {
    console.error('Failed to send email:', err && err.message ? err.message : err);
  }
}

/**
 * Attempts to send a message via Telegram if the phone number is linked.
 * Returns true if sent, false otherwise.
 */
async function sendViaTelegramIfLinked(phone, text) {
  if (!phone) return false;
  // Always normalize before lookup so format mismatches (0911... vs +251911...) don't break delivery
  const normalizedPhone = normalizePhone(phone);
  try {
    const chatId = await db.getTelegramChatIdByPhone(normalizedPhone);
    if (!chatId) {
      console.log(`[Telegram] No linked chatId for ${normalizedPhone} (original: ${phone})`);
      return false;
    }
    await telegram.sendMessage(chatId, text);
    console.log(`[Telegram] ✅ Message dispatched to chatId ${chatId} (phone: ${normalizedPhone})`);
    return true;
  } catch (err) {
    console.warn(`[Telegram] ❌ sendViaTelegramIfLinked failed for ${normalizedPhone}:`, err.message);
    return false;
  }
}

async function notifyNewComplaint(complaintId) {
  try {
    const c = await db.get('SELECT c.*, COALESCE(u.username, \'Anonymous\') as username, u.email FROM complaints c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?', [complaintId]);
    if (!c) return;

    // Notify admins (all admin users)
    const admins = await db.all("SELECT email, username FROM users WHERE role = 'admin'");
    const subject = `New Complaint Filed: #${c.id} - ${c.title}`;
    const text = `A new complaint was filed by ${c.username} (${c.email}).\n\nTitle: ${c.title}\nCategory: ${c.category}\nPriority: ${c.priority}\n\nView in dashboard: /dashboard.html`;

    for (const a of admins) {
      await sendMail({ to: a.email, subject, text });
    }

    // Acknowledge complainant
    await sendMail({ to: c.email, subject: `Your complaint #${c.id} has been received`, text: `We received your complaint titled: ${c.title}. Our team will review it.` });
  } catch (err) {
    console.error('notifyNewComplaint error:', err);
  }
}

/**
 * Creates persistent in-app notifications for ALL Clerk, Judge, and Admin users
 * when a new complaint is filed. These notifications appear in the staff dashboard
 * notification panel and stay visible until dismissed, ensuring staff never miss
 * a newly filed complaint regardless of Vercel worker isolation.
 */
async function notifyStaffNewComplaint(complaintId) {
  try {
    const c = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!c) return;

    const staffUsers = await db.all(
      "SELECT id, role FROM users WHERE role IN ('ADMIN', 'CLERK', 'JUDGE', 'admin', 'clerk', 'judge')"
    );

    const msg = `📋 New complaint #${c.case_number || c.id} filed: "${c.title}" (${c.category}). Click to review.`;

    for (const staff of staffUsers) {
      try {
        await db.run(
          `INSERT INTO in_app_notifications (user_id, message, complaint_id) VALUES (?, ?, ?)`,
          [staff.id, msg, c.id]
        );
      } catch (e) {
        console.warn(`[StaffNotify] Could not insert notification for user #${staff.id}:`, e.message);
      }
    }
    console.log(`[StaffNotify] In-app notifications sent to ${staffUsers.length} staff for complaint #${complaintId}`);
  } catch (err) {
    console.error('[StaffNotify] notifyStaffNewComplaint error:', err.message || err);
  }
}

async function notifyStatusChange(complaintId, newStatus) {
  try {
    const c = await db.get('SELECT c.*, COALESCE(u.username, \'Anonymous\') as username, u.email FROM complaints c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?', [complaintId]);
    if (!c) return;
    const subject = `Complaint #${c.id} status updated: ${newStatus}`;
    const text = `The status of your complaint titled '${c.title}' has been updated to: ${newStatus}.`;

    // Notify complainant
    await sendMail({ to: c.email, subject, text });

    // Notify admins for critical changes (e.g., Rejected or Resolved)
    if (newStatus === 'Resolved' || newStatus === 'Rejected') {
      const admins = await db.all("SELECT email FROM users WHERE role = 'admin'");
      for (const a of admins) {
        await sendMail({ to: a.email, subject: `Complaint #${c.id} is now ${newStatus}`, text: `Complaint '${c.title}' changed to ${newStatus}.` });
      }
    }
  } catch (err) {
    console.error('notifyStatusChange error:', err);
  }
}

async function notifyRemarkAdded(complaintId, remark, authorId) {
  try {
    const c = await db.get('SELECT c.*, COALESCE(u.username, \'Anonymous\') as username, u.email FROM complaints c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?', [complaintId]);
    if (!c) return;

    const author = await db.get('SELECT id, username, email, role FROM users WHERE id = ?', [authorId]);
    if (!author) return;

    const subject = `New message on complaint #${c.id}: ${c.title}`;
    const excerpt = remark.length > 200 ? remark.slice(0, 197) + '...' : remark;
    const linkText = `/dashboard.html`; // relative UI link

    const upperRole = author.role ? author.role.toUpperCase() : '';
    if (upperRole === 'ADMIN' || upperRole === 'CLERK' || upperRole === 'JUDGE') {
      // Notify complainant
      const text = `A staff member (${author.username}) has posted a new message on your complaint #${c.id}.

Message: ${excerpt}

View the conversation: ${linkText}`;
      await sendMail({ to: c.email, subject, text });

      // Notify respondent if they have email
      if (c.respondent_email) {
        const respText = `A staff member (${author.username}) has posted a new message on the case where you are named as respondent (${c.title}).\n\nLogin to the respondent portal to view.`;
        await sendMail({ to: c.respondent_email, subject, text: respText });
      }

      // ── BONUS: Telegram via phone if linked (supplemental to email) ──────
      const respondentPhone = c.respondent_phone ? normalizePhone(c.respondent_phone) : null;
      if (respondentPhone) {
        const tgText = `⚖️ Court Update — Case #${c.case_number || c.id}\n\nA staff member (${author.username}) has posted a new message on your case. Check your email or login to the respondent portal for details.`;
        const sentViaTelegram = await sendViaTelegramIfLinked(respondentPhone, tgText);
        if (sentViaTelegram) {
          console.log(`[Remark Telegram] ✅ Telegram also sent to ${respondentPhone}`);
        }
      }
    } else if (upperRole === 'RESPONDENT') {
      // Notify complainant and all admins/clerks
      const text = `The respondent (${author.username}) has added a new message to complaint #${c.id}.

Message: ${excerpt}

Review the conversation: ${linkText}`;
      await sendMail({ to: c.email, subject, text });

      const staff = await db.all("SELECT id, email FROM users WHERE role IN ('ADMIN', 'CLERK', 'admin', 'clerk', 'JUDGE', 'judge')");
      for (const a of staff) {
        await sendMail({ to: a.email, subject, text });
        try {
          await db.run(
            `INSERT INTO in_app_notifications (user_id, message, complaint_id) VALUES (?, ?, ?)`,
            [a.id, `New message from Respondent on case #${c.case_number || c.id}`, c.id]
          );
        } catch (e) {
          console.error("Failed to insert in_app_notification", e);
        }
      }
    } else {
      // Author is CITIZEN (complainant). Notify all admins/clerks, and respondent
      const text = `The complainant (${author.username}) has added a new message to complaint #${c.id}.

Message: ${excerpt}

Review the conversation: ${linkText}`;

      const staff = await db.all("SELECT email FROM users WHERE role IN ('ADMIN', 'CLERK', 'admin', 'clerk', 'admin')");
      for (const a of staff) {
        await sendMail({ to: a.email, subject, text });
      }

      if (c.respondent_email) {
        const respText = `The complainant (${author.username}) has posted a new message on the case where you are named as respondent (${c.title}).\n\nLogin to the respondent portal to view.`;
        await sendMail({ to: c.respondent_email, subject, text: respText });
      }
    }
  } catch (err) {
    console.error('notifyRemarkAdded error:', err);
  }
}

async function notifyRespondentOfComplaint(complaintId) {
  try {
    const c = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!c) {
      console.warn(`[Notify] Complaint #${complaintId} not found`);
      return;
    }

    const caseRef = c.case_number || '#' + c.id;
    const courtName = c.court_name || 'the relevant court';

    // ── PRIMARY: Gmail Email to Respondent ───────────────────────────────────
    if (c.respondent_email) {
      const subject = `⚖️ Court Notice: Legal Complaint Served — Case ${caseRef}`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
          <div style="background:#1a3c5e;color:#fff;padding:20px 24px">
            <h2 style="margin:0;font-size:20px">⚖️ Official Court Notice</h2>
            <p style="margin:4px 0 0;font-size:13px;opacity:0.85">Case Reference: ${caseRef}</p>
          </div>
          <div style="padding:24px">
            <p>Dear <strong>${c.defendant_name || 'Respondent'}</strong>,</p>
            <p>A legal complaint has been officially served against you at <strong>${courtName}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;width:35%">Case Title</td><td style="padding:8px">${c.title}</td></tr>
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Case Reference</td><td style="padding:8px">${caseRef}</td></tr>
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Category</td><td style="padding:8px">${c.category || 'N/A'}</td></tr>
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Court</td><td style="padding:8px">${courtName}</td></tr>
            </table>
            <p style="color:#c0392b;font-weight:bold">Action Required: Please login to the respondent portal immediately to review the complaint and respond accordingly.</p>
            ${PORTAL_URL ? `<p style="text-align:center;margin:20px 0"><a href="${PORTAL_URL}" style="display:inline-block;background:#1a3c5e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">🔐 Login to Respondent Portal</a></p><p style="font-size:12px;color:#555;text-align:center">Or copy this link: <a href="${PORTAL_URL}" style="color:#1a3c5e">${PORTAL_URL}</a></p>` : ''}
            <p style="font-size:12px;color:#666">Do not ignore this notice — timely response is required by law.</p>
          </div>
          <div style="background:#f5f5f5;padding:12px 24px;font-size:12px;color:#888;text-align:center">
            This is an official automated notice from the Court Management System.
          </div>
        </div>`;
      const text = `Dear ${c.defendant_name || 'Respondent'},\n\nA complaint titled "${c.title}" naming you as a respondent has been officially served at ${courtName}.\n\nCase Reference: ${caseRef}\nCategory: ${c.category || 'N/A'}\n\nPlease login to the respondent portal immediately to review and respond.${PORTAL_URL ? `\nRespondent Portal: ${PORTAL_URL}` : ''}\n\nDo not ignore this notice — timely response is required by law.`;
      await sendMail({ to: c.respondent_email, subject, text, html });
      console.log(`[Serve Email] ✅ Email sent to ${c.respondent_email} for case ${caseRef}`);

      // Log to sms_logs table (reused as notification audit log)
      try {
        await db.run(
          `INSERT INTO sms_logs (complaint_id, recipient_phone, message, status) VALUES (?, ?, ?, ?)`,
          [complaintId, c.respondent_email, `Email notification sent to ${c.respondent_email}`, 'email_sent']
        );
      } catch (logErr) {
        console.warn('[Serve Email] Could not write to sms_logs:', logErr.message);
      }
    } else {
      console.log(`[Serve Email] No respondent_email on complaint #${complaintId} — email skipped.`);
    }

    // ── BONUS: Telegram if respondent has a linked phone ─────────────────────
    if (c.respondent_phone) {
      c.respondent_phone = normalizePhone(c.respondent_phone);
      const tgText = `⚖️ Official Court Notice\n\nA complaint titled "${c.title}" has been served against you at ${courtName}.\nCase: ${caseRef}\n\nCheck your email for full details and login to the respondent portal immediately.`;
      const sentViaTelegram = await sendViaTelegramIfLinked(c.respondent_phone, tgText);
      if (sentViaTelegram) {
        console.log(`[Serve Telegram] ✅ Telegram notification also sent to ${c.respondent_phone}`);
      }
    }
  } catch (err) {
    console.error('notifyRespondentOfComplaint error:', err);
  }
}

/**
 * Notify respondent via Gmail (+ Telegram & in-app) when a court session is scheduled.
 *
 * @param {number} complaintId - DB id of the complaint
 * @param {Object} session     - { judge_name, session_date, session_time, courtroom, hearing_type }
 */
async function notifySessionScheduled(complaintId, session) {
  try {
    const c = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!c) {
      console.warn(`[Session Notify] Complaint #${complaintId} not found`);
      return;
    }

    const caseRef = c.case_number || '#' + c.id;
    const courtName = c.court_name || 'the relevant court';
    const { judge_name, session_date, session_time, courtroom, hearing_type } = session;

    // ── PRIMARY: Gmail to Respondent ────────────────────────────────────────
    if (c.respondent_email) {
      const subject = `⚖️ Court Hearing Scheduled — Case ${caseRef}`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
          <div style="background:#1a3c5e;color:#fff;padding:20px 24px">
            <h2 style="margin:0;font-size:20px">⚖️ Court Hearing Notice</h2>
            <p style="margin:4px 0 0;font-size:13px;opacity:0.85">Case Reference: ${caseRef}</p>
          </div>
          <div style="padding:24px">
            <p>Dear <strong>${c.defendant_name || 'Respondent'}</strong>,</p>
            <p>A court hearing has been scheduled for your case at <strong>${courtName}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold;width:35%">Case Title</td><td style="padding:8px">${c.title}</td></tr>
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Case Reference</td><td style="padding:8px">${caseRef}</td></tr>
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Hearing Type</td><td style="padding:8px">${hearing_type || 'N/A'}</td></tr>
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Date</td><td style="padding:8px">${session_date || 'TBD'}</td></tr>
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Time</td><td style="padding:8px">${session_time || 'TBD'}</td></tr>
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Courtroom</td><td style="padding:8px">${courtroom || 'TBD'}</td></tr>
              <tr><td style="padding:8px;background:#f5f5f5;font-weight:bold">Judge</td><td style="padding:8px">${judge_name || 'TBD'}</td></tr>
            </table>
            <p style="color:#c0392b;font-weight:bold">Your attendance is required. Please login to the respondent portal for further case details.</p>
            ${PORTAL_URL ? `<p style="text-align:center;margin:20px 0"><a href="${PORTAL_URL}" style="display:inline-block;background:#1a3c5e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">🔐 Login to Respondent Portal</a></p><p style="font-size:12px;color:#555;text-align:center">Or copy this link: <a href="${PORTAL_URL}" style="color:#1a3c5e">${PORTAL_URL}</a></p>` : ''}
            <p style="font-size:12px;color:#666">Failure to appear may result in a default judgment against you.</p>
          </div>
          <div style="background:#f5f5f5;padding:12px 24px;font-size:12px;color:#888;text-align:center">
            This is an official automated notice from the Court Management System.
          </div>
        </div>`;
      const text = `Dear ${c.defendant_name || 'Respondent'},\n\nA ${hearing_type || 'court hearing'} has been scheduled for case "${c.title}" (${caseRef}) at ${courtName}.\n\nDate: ${session_date || 'TBD'}\nTime: ${session_time || 'TBD'}\nCourtroom: ${courtroom || 'TBD'}\nJudge: ${judge_name || 'TBD'}\n\nYour attendance is required. Login to the respondent portal for further details.${PORTAL_URL ? `\nRespondent Portal: ${PORTAL_URL}` : ''}`;
      await sendMail({ to: c.respondent_email, subject, text, html });
      console.log(`[Session Email] ✅ Email sent to ${c.respondent_email} for case ${caseRef}`);

      // Log to sms_logs for audit
      try {
        await db.run(
          `INSERT INTO sms_logs (complaint_id, recipient_phone, message, status) VALUES (?, ?, ?, ?)`,
          [complaintId, c.respondent_email, `Hearing scheduled email sent to ${c.respondent_email}`, 'email_sent']
        );
      } catch (logErr) {
        console.warn('[Session Email] Could not write to sms_logs:', logErr.message);
      }
    } else {
      console.log(`[Session Email] No respondent_email on complaint #${complaintId} — email skipped.`);
    }

    // ── BONUS: Telegram if respondent has a linked phone ─────────────────────
    if (c.respondent_phone) {
      const normalized = normalizePhone(c.respondent_phone);
      const tgText = `⚖️ Court Hearing Scheduled — Case ${caseRef}\n\nType: ${hearing_type || 'Hearing'}\nDate: ${session_date || 'TBD'} ${session_time || ''}\nCourtroom: ${courtroom || 'TBD'}\nJudge: ${judge_name || 'TBD'}\n\nCheck your email for full details.`;
      const sentViaTelegram = await sendViaTelegramIfLinked(normalized, tgText);
      if (sentViaTelegram) {
        console.log(`[Session Telegram] ✅ Telegram also sent to ${normalized}`);
      }
    }

    // ── In-App notification for the respondent's user account ─────────────────
    try {
      const respUser = await db.get(
        `SELECT id FROM users WHERE (email = ? AND email != '') OR (username = ? AND username != '')`,
        [c.respondent_email || '', c.respondent_phone || '']
      );
      if (respUser) {
        await db.run(
          `INSERT INTO in_app_notifications (user_id, message, complaint_id) VALUES (?, ?, ?)`,
          [respUser.id, `Court Hearing Scheduled: ${hearing_type || 'Hearing'} on ${session_date || 'TBD'} — Case ${caseRef}`, c.id]
        );
      }
    } catch (inAppErr) {
      console.warn('[Session] Could not insert in_app_notification for respondent:', inAppErr.message);
    }
  } catch (err) {
    console.error('[Notification] notifySessionScheduled error:', err.message || err);
  }
}

/**
 * AI-Powered SMS notification to respondent after judge issues a judgment.
 * Generates personalized message via Gemini API (falls back to template).
 * Logs to sms_logs table for audit.
 *
 * @param {number} complaintId  - DB id of the complaint
 * @param {string} orderDetails - The judge's written order/judgment details
 * @param {string} orderType    - e.g. "Final Judgment", "Dismissal"
 * @param {string} [customSmsText] - The exact SMS text the judge confirmed/edited
 */
async function notifyRespondentJudgmentSms(complaintId, orderDetails, orderType, customSmsText) {
  try {
    const c = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!c) {
      console.log('[AI SMS] Complaint not found for SMS:', complaintId);
      return { success: false, error: 'Complaint not found' };
    }

    if (!c.respondent_phone && !c.respondent_email) {
      console.log('[Notice] No respondent phone or email on complaint #' + complaintId + '. Skipping notifications.');
      return { success: false, error: 'No contact information on record' };
    }

    // Use custom text from judge if provided, else regenerate
    const messageText = customSmsText ? customSmsText : await sms.generateSmsContent(c, orderDetails, orderType);

    // ── BONUS: Telegram via phone if linked (supplemental to email) ──────────
    if (c.respondent_phone) {
      c.respondent_phone = normalizePhone(c.respondent_phone);
      const sentViaTelegram = await sendViaTelegramIfLinked(
        c.respondent_phone,
        `⚖️ Court Judgment Issued — Case #${c.case_number || c.id}\n\n${messageText}\n\nCheck your email for full details.`
      );
      if (sentViaTelegram) {
        console.log(`[Judgment Telegram] ✅ Telegram also sent to ${c.respondent_phone}`);
      }
      // Log to sms_logs for audit trail
      try {
        await db.run(
          `INSERT INTO sms_logs (complaint_id, recipient_phone, message, status) VALUES (?, ?, ?, ?)`,
          [complaintId, c.respondent_phone, messageText, sentViaTelegram ? 'telegram' : 'skipped_no_tg_link']
        );
      } catch (logErr) {
        console.warn('[Judgment] Could not log to sms_logs:', logErr.message);
      }
    }

    // Send Email
    if (c.respondent_email) {
      const subject = `Court Judgment Issued: Case #${c.case_number || c.id}`;
      const text = `Dear ${c.defendant_name || 'Respondent'},\n\nA ${orderType} has been issued by the court regarding complaint "${c.title}".\n\nJudgment Details:\n${orderDetails}\n\nLogin to the respondent portal to view your case updates.${PORTAL_URL ? `\nRespondent Portal: ${PORTAL_URL}` : ''}`;
      await sendMail({ to: c.respondent_email, subject, text });
    }

    // Insert In-App Notification for Respondent user (if user account exists for this respondent)
    try {
      const respUser = await db.get(
        `SELECT id FROM users WHERE (email = ? AND email != '') OR (username = ? AND username != '')`,
        [c.respondent_email || '', c.respondent_phone || '']
      );
      if (respUser) {
        await db.run(
          `INSERT INTO in_app_notifications (user_id, message, complaint_id) VALUES (?, ?, ?)`,
          [respUser.id, `Court Notice: A ${orderType} has been issued on case #${c.case_number || c.id}`, c.id]
        );
      }
    } catch (inAppErr) {
      console.warn('[AI SMS] Could not insert in_app_notification for respondent:', inAppErr.message);
    }

    return { success: true, message: messageText };
  } catch (err) {
    console.error('[Notification] notifyRespondentJudgmentSms error:', err.message || err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

module.exports = {
  notifyNewComplaint,
  notifyStaffNewComplaint,
  notifyStatusChange,
  notifyRemarkAdded,
  notifyRespondentOfComplaint,
  notifySessionScheduled,
  notifyRespondentJudgmentSms,
  sendMail
};
