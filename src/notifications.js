const nodemailer = require('nodemailer');
const db = require('./db');

// Read SMTP config from environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@resolver.local';

let transporter = null;
if (SMTP_HOST && SMTP_PORT) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });
} else {
  console.log('SMTP not configured. Email notifications will be disabled. Set SMTP_HOST and SMTP_PORT to enable.');
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

async function notifyNewComplaint(complaintId) {
  try {
    const c = await db.get('SELECT c.*, u.username, u.email FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.id = ?', [complaintId]);
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

async function notifyStatusChange(complaintId, newStatus) {
  try {
    const c = await db.get('SELECT c.*, u.username, u.email FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.id = ?', [complaintId]);
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
    const c = await db.get('SELECT c.*, u.username, u.email FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.id = ?', [complaintId]);
    if (!c) return;

    const author = await db.get('SELECT id, username, email, role FROM users WHERE id = ?', [authorId]);
    if (!author) return;

    const subject = `New message on complaint #${c.id}: ${c.title}`;
    const excerpt = remark.length > 200 ? remark.slice(0, 197) + '...' : remark;
    const linkText = `/dashboard.html`; // relative UI link

    if (author.role === 'admin') {
      // Notify complainant
      const text = `A staff member (${author.username}) has posted a new message on your complaint #${c.id}.

Message: ${excerpt}

View the conversation: ${linkText}`;
      await sendMail({ to: c.email, subject, text });
    } else {
      // Notify all admins
      const text = `A complainant (${author.username}) has added a new message to complaint #${c.id}.

Message: ${excerpt}

Review the conversation: ${linkText}`;
      const admins = await db.all("SELECT email FROM users WHERE role = 'admin'");
      for (const a of admins) {
        await sendMail({ to: a.email, subject, text });
      }
    }
  } catch (err) {
    console.error('notifyRemarkAdded error:', err);
  }
}

async function notifyRespondentOfComplaint(complaintId) {
  try {
    const c = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!c) return;

    if (c.respondent_phone) {
      console.log(`[MOCK SMS] Sent to ${c.respondent_phone}: Notice: A complaint (#${c.id}) has been filed naming you as a respondent.`);
    }

    if (c.respondent_email) {
      const subject = `Notice of Legal Complaint: #${c.id}`;
      const text = `Dear ${c.defendant_name || 'Respondent'},\n\nA complaint titled "${c.title}" naming you as a respondent has been filed at ${c.court_name}.\n\nYou will be contacted by a clerk regarding proceedings.`;
      await sendMail({ to: c.respondent_email, subject, text });
    }
  } catch (err) {
    console.error('notifyRespondentOfComplaint error:', err);
  }
}

module.exports = {
  notifyNewComplaint,
  notifyStatusChange,
  notifyRemarkAdded,
  notifyRespondentOfComplaint,
  sendMail
};
