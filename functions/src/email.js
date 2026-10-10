// Sends guests their invitation by email: the personalised card, the invitation message and a button to
// their invitation page. Any SMTP mailbox works (Gmail with an app password, Zoho, Namecheap Private Email,
// Resend, …): SMTP_HOST / SMTP_PORT / SMTP_USER / MAIL_FROM are settings, SMTP_PASS is a secret.
const nodemailer = require('nodemailer');
const cfg = require('./config');
const store = require('./store');

const env = (k) => {
  const v = (process.env[k] || '').trim();
  return v && v.toLowerCase() !== 'none' ? v : '';
};
const configured = () => !!(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS'));
const from = () => env('MAIL_FROM') || `${cfg.couple.bride} & ${cfg.couple.groom} <${env('SMTP_USER')}>`;

const sent = []; // what the test transport "sent" (SMTP_HOST=json)
let transport = null;
let transportKey = '';
function mailer() {
  const key = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'].map(env).join('|');
  if (!transport || key !== transportKey) {
    transportKey = key;
    const port = Number(env('SMTP_PORT')) || 465;
    transport =
      env('SMTP_HOST') === 'json'
        ? nodemailer.createTransport({ jsonTransport: true })
        : nodemailer.createTransport({ host: env('SMTP_HOST'), port, secure: port === 465, auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') } });
  }
  return transport;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const valid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

/** The email itself: the card, the message as paragraphs (links clickable), and a button to the invitation. */
function compose(g, { text, link, card }) {
  const c = cfg.couple;
  const paras = String(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#c69a63">$1</a>')}</p>`)
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#0f1a2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1a2e"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;color:#f5eee2;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55">
<tr><td align="center" style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:4px;color:#d2b07a;text-transform:uppercase;padding-bottom:6px">The Making of</td></tr>
<tr><td align="center" style="font-size:30px;letter-spacing:3px;color:#e7cb8f;padding-bottom:22px">${esc(c.surname.toUpperCase())}</td></tr>
${card ? `<tr><td align="center" style="padding-bottom:24px"><img src="cid:card" alt="Your invitation, with your name and access code" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:1px solid #6b5a3e"></td></tr>` : ''}
<tr><td style="padding:0 6px">${paras}</td></tr>
<tr><td align="center" style="padding:8px 0 28px"><a href="${esc(link)}" style="display:inline-block;background:#d2b07a;color:#0f1a2e;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:15px 28px;border-radius:2px">View your invitation &amp; RSVP</a></td></tr>
<tr><td align="center" style="font-family:Arial,sans-serif;font-size:12px;color:#a9a294">${esc(c.bride)} &amp; ${esc(c.groom)} · Questions? ${cfg.contacts.map((p) => `${esc(p.name)} ${esc(p.phone)}`).join(' · ')}</td></tr>
</table></td></tr></table></body></html>`;
  return {
    from: from(),
    to: `${g.name.replace(/[<>",]/g, '')} <${String(g.email).trim()}>`,
    replyTo: env('MAIL_REPLY_TO') || undefined,
    subject: `${c.bride} & ${c.groom} invite you to The Making of ${c.surname}`,
    text: `${text}\n\nYour invitation and RSVP: ${link}`,
    html,
    attachments: card ? [{ filename: `Invitation - ${g.name.replace(/[\\/:*?"<>|]+/g, '')}.jpg`, content: card, contentType: 'image/jpeg', cid: 'card' }] : [],
  };
}

/** Email one guest their invitation and record it (or why it failed) on the guest. `card` may be a promise. */
async function sendInvite(g, { text, link, card }) {
  if (!configured()) return { ok: false, error: 'Email isn’t set up yet (SMTP settings).' };
  if (!valid(g.email)) {
    await store.setWa(g.id, { emailError: 'No valid email address' });
    return { ok: false, error: `${g.name}: no valid email address` };
  }
  try {
    // If the card can't be drawn, the invitation still goes (the guest sees their card on the invitation page).
    const image = await Promise.resolve(card).catch((e) => (console.error('Card for email failed:', e.message), null));
    const info = await mailer().sendMail(compose(g, { text, link, card: image }));
    if (env('SMTP_HOST') === 'json') sent.push(JSON.parse(info.message));
    const at = new Date().toISOString();
    await store.setWa(g.id, { emailSentAt: at, emailError: '', sentAt: g.sentAt || at }, 'sent', 'Email');
    return { ok: true, id: info.messageId };
  } catch (e) {
    const error = String(e.message || e).slice(0, 300);
    await store.setWa(g.id, { emailError: error }, 'emailfailed', error.slice(0, 120));
    return { ok: false, error: `${g.name}: ${error}` };
  }
}

/** Guests who gave an email and haven't been emailed their invitation yet. */
const eligible = (g) => valid(g.email) && !g.emailSentAt && g.rsvp !== 'no';

module.exports = { configured, from, sendInvite, eligible, compose, _sent: sent };
