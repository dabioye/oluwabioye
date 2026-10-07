// Sends the private traditional-wedding invitation through the WhatsApp Business Cloud API (Meta),
// from the couple's own WhatsApp number, and tracks delivery via Meta's webhook.
//
// The approved template is read from Meta (language, header, variables, button), so the wording can change
// in WhatsApp Manager without a code change: each variable is filled from its name or its example value.
// If the template can't be read, the layout from the README is used: body {{1}} name, {{2}} RSVP date,
// URL button {{1}} the guest's code. When the template starts with an image, the guest's personalised card
// (drawn by the invitation desk) is uploaded and sent with it.
const crypto = require('crypto');
const cfg = require('./config');
const store = require('./store');

const env = (k) => {
  const v = (process.env[k] || '').trim();
  return v && v.toLowerCase() !== 'none' ? v : '';
};
const API = () => (env('WHATSAPP_API_BASE') || `https://graph.facebook.com/${env('WHATSAPP_API_VERSION') || 'v23.0'}`).replace(/\/$/, '');

function settings() {
  return {
    token: env('WHATSAPP_TOKEN'),
    phoneId: env('WHATSAPP_PHONE_ID') || cfg.whatsapp.phoneNumberId,
    template: env('WHATSAPP_TEMPLATE') || cfg.whatsapp.template,
    lang: env('WHATSAPP_LANG') || 'en',
    headerImage: env('WHATSAPP_HEADER_IMAGE'), // a fixed image for an image header when no card is sent
  };
}
const configured = () => { const s = settings(); return !!(s.token && s.phoneId); };

// 0803 123 4567 -> 2348031234567 ; +44 7700 900123 -> 447700900123
function toWaNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1);
  return d.length >= 10 && d.length <= 15 ? d : '';
}

class WhatsAppError extends Error {}
let fetchImpl = (...a) => fetch(...a); // swapped out in tests

async function graph(path, { method = 'GET', body, form } = {}) {
  const headers = { Authorization: `Bearer ${settings().token}` };
  if (body) headers['Content-Type'] = 'application/json';
  let res, j;
  try {
    res = await fetchImpl(API() + path, { method, headers, body: form || (body && JSON.stringify(body)), signal: AbortSignal.timeout(20_000) });
    j = await res.json().catch(() => ({}));
  } catch (e) {
    throw new WhatsAppError(e.message);
  }
  if (!res.ok || j.error) {
    const e = j.error || {};
    const detail = e.error_data?.details;
    throw new WhatsAppError([e.error_user_msg || e.message || `HTTP ${res.status}`, detail && detail !== e.message ? detail : ''].filter(Boolean).join(': '));
  }
  return j;
}

// ---------- the approved template ----------
// A token can describe itself: its expiry, and which WhatsApp accounts it may manage (where the template lives).
async function tokenInfo() {
  const d = (await graph(`/debug_token?input_token=${encodeURIComponent(settings().token)}`)).data || {};
  const accounts = new Set();
  for (const s of d.granular_scopes || []) if (/^whatsapp_business_(management|messaging)$/.test(s.scope)) (s.target_ids || []).forEach((id) => accounts.add(String(id)));
  return { valid: d.is_valid !== false, expiresAt: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null, accounts: [...accounts] };
}

let cached = {}; // name -> { at, value }
async function template({ fresh = false, name = settings().template } = {}) {
  const hit = cached[name];
  if (!fresh && hit && Date.now() - hit.at < 10 * 60e3) return hit.value;
  const accounts = env('WHATSAPP_WABA_ID') ? [env('WHATSAPP_WABA_ID')] : (await tokenInfo()).accounts;
  if (!accounts.length) throw new WhatsAppError('The access token can’t see any WhatsApp Business account');
  const found = [];
  for (const id of accounts) {
    const r = await graph(`/${id}/message_templates?name=${encodeURIComponent(name)}&fields=name,language,status,category,components,parameter_format&limit=50`);
    found.push(...(r.data || []).filter((t) => t.name === name));
  }
  const t = found.find((x) => x.status === 'APPROVED') || found[0];
  if (!t) throw new WhatsAppError(`No template called “${name}” in WhatsApp Manager`);
  cached[name] = { at: Date.now(), value: t };
  return t;
}
// The README's layout, for when the template can't be read (e.g. a token without template access).
function fallbackTemplate() {
  const s = settings();
  return {
    name: s.template, language: s.lang, status: 'UNKNOWN', category: '', fallback: true,
    components: [
      ...(s.headerImage ? [{ type: 'HEADER', format: 'IMAGE' }] : []),
      { type: 'BODY', text: 'Dear {{1}}, … Kindly RSVP by {{2}}.', example: { body_text: [['Tope Omidiji', '30 November 2026']] } },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'View invitation', url: 'https://oluwabioye.dabioye.com/i/{{1}}' }] },
    ],
  };
}
const templateOrFallback = () => template().catch(() => fallbackTemplate());

// ---------- filling it in ----------
const VARS = /{{\s*([\w.]+)\s*}}/g;
const varsIn = (text) => [...new Set([...String(text || '').matchAll(VARS)].map((m) => m[1]))];
const MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

/** What a variable stands for, from its name ({{guest_name}}) or, for {{1}}-style ones, its example value. */
function meaning(key, example, index) {
  const k = String(key).toLowerCase();
  if (!/^\d+$/.test(k)) {
    if (/link|url/.test(k)) return 'link';
    if (/code/.test(k)) return 'code';
    if (/first/.test(k)) return 'first';
    if (/rsvp|deadline|reply|date|by/.test(k)) return 'rsvpBy';
    if (/name|guest/.test(k)) return 'name';
  }
  const ex = String(example ?? '').trim();
  if (/^https?:\/\//i.test(ex)) return 'link';
  if (/^[A-Z0-9]{6}$/.test(ex)) return 'code';
  if (MONTH.test(ex) || /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(ex)) return 'rsvpBy';
  return ['name', 'rsvpBy', 'link'][index] || 'name';
}

function examplesFor(c, named) {
  const ex = c.example || {};
  if (named) return Object.fromEntries((ex[c.type === 'HEADER' ? 'header_text_named_params' : 'body_text_named_params'] || []).map((p) => [p.param_name, p.example]));
  const list = c.type === 'HEADER' ? ex.header_text || [] : (ex.body_text || [])[0] || [];
  return Object.fromEntries(list.map((v, i) => [String(i + 1), v]));
}

/** The part of the guest's link that goes into a button like https://oluwabioye.dabioye.com/i/{{1}}. */
function urlSuffix(url, values) {
  const prefix = String(url).split('{{')[0];
  return prefix && values.link.startsWith(prefix) ? values.link.slice(prefix.length) : values.code;
}

/** Template components for one guest, and the message as the guest will read it. */
function fill(t, values, header, pick = meaning) {
  const named = t.parameter_format === 'NAMED';
  const components = [];
  const read = {};
  for (const c of t.components || []) {
    if (c.type === 'HEADER' && c.format === 'IMAGE') {
      if (header) components.push({ type: 'header', parameters: [{ type: 'image', image: header }] });
    } else if ((c.type === 'HEADER' || c.type === 'BODY') && varsIn(c.text).length) {
      const examples = examplesFor(c, named);
      const keys = varsIn(c.text);
      const parameters = keys.map((key, i) => {
        const text = String(values[pick(key, examples[key], i)] ?? '');
        return named ? { type: 'text', parameter_name: key, text } : { type: 'text', text };
      });
      components.push({ type: c.type.toLowerCase(), parameters });
      read[c.type] = c.text.replace(VARS, (_, k) => parameters[keys.indexOf(k)].text);
    } else if (c.type === 'BUTTONS') {
      c.buttons.forEach((b, i) => {
        if (b.type === 'URL' && varsIn(b.url).length) components.push({ type: 'button', sub_type: 'url', index: String(i), parameters: [{ type: 'text', text: urlSuffix(b.url, values) }] });
      });
    }
    if (c.text && !read[c.type]) read[c.type] = c.text;
  }
  return { components, text: [read.HEADER, read.BODY, read.FOOTER].filter(Boolean).join('\n\n') };
}

/** The template in plain words, for the desk. */
function describe(t) {
  const part = (type) => (t.components || []).find((c) => c.type === type);
  const header = part('HEADER');
  return {
    name: t.name, language: t.language, status: t.status, category: t.category, fallback: !!t.fallback,
    header: header ? header.format : 'NONE',
    needsImage: header?.format === 'IMAGE',
    body: part('BODY')?.text || '',
    footer: part('FOOTER')?.text || '',
    buttons: (part('BUTTONS')?.buttons || []).map((b) => ({ type: b.type, text: b.text, url: b.url || '' })),
  };
}

// ---------- sending ----------
let valuesFor = (g) => ({ name: g.name, first: g.name.split(/\s+/)[0], code: g.code, link: g.code, rsvpBy: '' }); // set by the server
const setValues = (fn) => (valuesFor = fn);

/** Can this guest's invitation go out without a card from the desk (auto-send, send-pending)? */
async function needsCard() {
  const t = await templateOrFallback();
  return describe(t).needsImage && !settings().headerImage;
}

/** Send one guest's invitation. `card` is their personalised card as JPEG, for templates that start with an image. */
async function sendInvite(guest, card) {
  if (!configured()) return { ok: false, error: 'WhatsApp API is not set up yet (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID).' };
  const to = toWaNumber(guest.phone);
  if (!to) {
    await store.setWa(guest.id, { waStatus: 'failed', waError: 'No valid WhatsApp number' }, 'wafailed', 'No valid WhatsApp number');
    return { ok: false, error: `${guest.name}: no valid WhatsApp number` };
  }
  const s = settings();
  try {
    const t = await templateOrFallback();
    let header = null;
    if (describe(t).needsImage) {
      if (card?.length) {
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('type', 'image/jpeg');
        form.append('file', new Blob([card], { type: 'image/jpeg' }), 'invitation.jpg');
        header = { id: (await graph(`/${s.phoneId}/media`, { method: 'POST', form })).id };
      } else if (s.headerImage) header = { link: s.headerImage };
      else throw new WhatsAppError('This template starts with an image, so send it from the invitation desk with the guest’s card');
    }
    const { components } = fill(t, await valuesFor(guest), header);
    const body = await graph(`/${s.phoneId}/messages`, {
      method: 'POST',
      body: { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template', template: { name: t.name, language: { code: t.language }, components } },
    });
    const id = body.messages?.[0]?.id;
    if (!id) throw new WhatsAppError('WhatsApp didn’t return a message id');
    const at = new Date().toISOString();
    await store.setWa(guest.id, { waMessageId: id, waStatus: 'accepted', waError: '', waSentAt: at, sentAt: guest.sentAt || at }, 'sent', 'WhatsApp API');
    return { ok: true, id };
  } catch (e) {
    if (!(e instanceof WhatsAppError)) throw e;
    await store.setWa(guest.id, { waStatus: 'failed', waError: e.message.slice(0, 300) }, 'wafailed', e.message.slice(0, 120));
    return { ok: false, error: `${guest.name}: ${e.message}` };
  }
}

// Send to many guests with limited concurrency (Cloud API allows far more; this keeps the function responsive).
async function sendMany(guests, concurrency = 8) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, guests.length) }, async () => {
    while (i < guests.length) results.push(await sendInvite(guests[i++]));
  }));
  return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).map((r) => r.error) };
}

const eligible = (g) => g.channel === 'whatsapp' && !!g.phone && !g.waMessageId && g.rsvp !== 'no';

// ---------- what the desk shows ----------
async function status() {
  if (!configured()) return { configured: false, ready: false };
  const out = { configured: true, ready: false, problems: [] };
  const [info, phone, t] = await Promise.all([
    tokenInfo().catch((e) => ({ error: e.message })),
    graph(`/${settings().phoneId}?fields=display_phone_number,verified_name,quality_rating`).catch((e) => ({ error: e.message })),
    template({ fresh: true }).catch((e) => ({ error: e.message })),
  ]);
  out.token = info;
  out.phone = phone;
  if (phone.error) out.problems.push(`Phone number: ${phone.error}`);
  if (info.expiresAt) out.problems.push(`The access token expires on ${info.expiresAt.slice(0, 10)}. Make one that never expires.`);
  if (t.error)
    out.problems.push(
      `Couldn’t read the template (${t.error}), so messages use the README layout and WhatsApp may drop them. Give the system user the WhatsApp account with full control and make a new token, or set WHATSAPP_WABA_ID.`,
    );
  else if (t.status !== 'APPROVED') out.problems.push(`The template is ${String(t.status).toLowerCase()} in WhatsApp Manager, not approved.`);
  out.template = describe(t.error ? fallbackTemplate() : t);
  // Not ready until the approved template is read: a guessed layout is accepted by Meta, then silently dropped.
  out.ready = !phone.error && !t.error && t.status === 'APPROVED';
  return out;
}

async function preview(guest) {
  return fill(await templateOrFallback(), await valuesFor(guest), { id: 'preview' }).text;
}

// ---- Webhook: Meta calls this with delivery/read/failed statuses ----
function verifyChallenge(query) {
  const token = env('WHATSAPP_VERIFY_TOKEN');
  return token && query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === token ? String(query['hub.challenge'] || '') : null;
}
function signatureOk(rawBody, header) {
  const secret = env('WHATSAPP_APP_SECRET');
  if (!secret) return false;
  const expect = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const got = String(header || '');
  return got.length === expect.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expect));
}
const RANK = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
async function handleWebhook(body) {
  const values = (body.entry || []).flatMap((e) => (e.changes || []).map((c) => c.value || {}));
  const statuses = values.flatMap((v) => v.statuses || []);
  for (const st of statuses) {
    // A reply typed in the inbox
    const m = await store.updateMessage(st.id, st.status === 'failed' ? { status: 'failed', error: ((st.errors || [])[0] || {}).title || 'Delivery failed' } : { status: st.status });
    if (m) continue;
    const g = await store.byWaId(st.id);
    if (!g) continue;
    // Statuses can arrive out of order; never move backwards (except to failed).
    if (st.status !== 'failed' && (RANK[st.status] ?? -1) <= (RANK[g.waStatus] ?? -1)) continue;
    const p = { waStatus: st.status };
    if (st.status === 'failed') p.waError = ((st.errors || [])[0] || {}).title || 'Delivery failed';
    if (st.status === 'read') p.waReadAt = new Date(Number(st.timestamp) * 1000 || Date.now()).toISOString();
    await store.setWa(g.id, p, st.status === 'read' ? 'waread' : st.status === 'failed' ? 'wafailed' : null, st.status === 'failed' ? p.waError : st.status);
  }
  let replies = 0;
  for (const v of values) {
    for (const msg of v.messages || []) {
      const contact = (v.contacts || []).find((c) => c.wa_id === msg.from) || {};
      if (await receive(msg, contact.profile?.name || '')) replies++;
    }
  }
  return statuses.length + replies;
}

// ---------- conversations ----------
const DAY = 24 * 3600e3;
/** A guest's thread is their id; someone not on the list gets one by number. */
const threadFor = (g, from) => (g ? g.id : `p:${from}`);

/** Readable text for any kind of WhatsApp message. */
function textOf(m) {
  switch (m.type) {
    case 'text': return m.text?.body || '';
    case 'button': return m.button?.text || '';
    case 'interactive': return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
    case 'reaction': return m.reaction?.emoji ? `Reacted ${m.reaction.emoji}` : 'Removed a reaction';
    case 'image': case 'video': case 'document':
      return [`[${m.type}]`, m[m.type]?.caption || m.document?.filename || ''].filter(Boolean).join(' ');
    case 'location': return `[location] ${[m.location?.name, m.location?.address].filter(Boolean).join(', ')}`.trim();
    default: return `[${m.type || 'message'}]`;
  }
}

async function receive(msg, profileName) {
  const from = String(msg.from || '');
  const g = (await store.all()).find((x) => toWaNumber(x.phone) === from) || null;
  const at = new Date(Number(msg.timestamp) * 1000 || Date.now()).toISOString();
  const text = textOf(msg).slice(0, 4000);
  const fresh = await store.addMessage({
    id: String(msg.id), thread: threadFor(g, from), guestId: g?.id || null, name: g?.name || profileName || `+${from}`,
    phone: from, dir: 'in', type: msg.type || 'text', text, at, read: false,
  });
  if (!fresh) return false; // already saved (Meta retries)
  if (g) await store.setWa(g.id, { waLastInAt: at }, 'wareply', text.slice(0, 120));
  else await store.logActivity('wareply', { id: null, name: profileName || `+${from}` }, text.slice(0, 120));
  await alert(g?.name || profileName || `+${from}`, text, threadFor(g, from)).catch((e) => console.error('WhatsApp alert failed:', e.message));
  return true;
}

/** When the 24-hour window for free-text replies closes (null if the guest has never written). */
function windowUntil(messages) {
  // Only a WhatsApp message from the guest opens the window; an RSVP note from their invitation page doesn't.
  const lastIn = [...messages].reverse().find((m) => m.dir === 'in' && m.type !== 'rsvp');
  return lastIn ? new Date(new Date(lastIn.at).getTime() + DAY).toISOString() : null;
}

/** A free-text reply in a thread, only while the guest's 24-hour window is open. */
async function reply(thread, text) {
  if (!configured()) throw new WhatsAppError('WhatsApp API is not set up yet.');
  const body = String(text || '').trim().slice(0, 4096);
  if (!body) throw new WhatsAppError('Type a message first.');
  const history = await store.messages({ thread });
  const until = windowUntil(history);
  if (!until || Date.now() > new Date(until).getTime()) throw new WhatsAppError('The 24-hour window has closed. WhatsApp only lets you reply with a template until they write again.');
  const g = thread.startsWith('p:') ? null : await store.byId(thread);
  const to = g ? toWaNumber(g.phone) : thread.slice(2);
  if (!to) throw new WhatsAppError('No valid WhatsApp number for this conversation.');
  const r = await graph(`/${settings().phoneId}/messages`, { method: 'POST', body: { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body, preview_url: true } } });
  const m = { id: r.messages?.[0]?.id || `local-${crypto.randomUUID()}`, thread, guestId: g?.id || null, name: g?.name || history[0]?.name || `+${to}`, phone: to, dir: 'out', type: 'text', text: body, at: new Date().toISOString(), status: 'accepted', read: true };
  await store.addMessage(m);
  return m;
}

/** An RSVP sent from the invitation page, with its note, lands in the guest's inbox thread too. */
async function rsvpToInbox(g, response, note) {
  const text = [response === 'yes' ? 'RSVP: Joyfully accepts' : 'RSVP: Regretfully declines', String(note || '').trim()].filter(Boolean).join('\n\n');
  const at = new Date().toISOString();
  await store.addMessage({ id: `rsvp-${g.id}-${Date.now()}`, thread: g.id, guestId: g.id, name: g.name, phone: toWaNumber(g.phone), dir: 'in', type: 'rsvp', text, at, read: false });
  await alert(g.name, text, g.id).catch((e) => console.error('WhatsApp alert failed:', e.message));
}

// ---------- alerts to the couple's own phone ----------
// Template guest_reply_alert: body {{1}} guest, {{2}} what they wrote; a URL button to the inbox.
// Template text can't hold line breaks, tabs or long runs of spaces, so the reply is flattened.
const flat = (t, max) => String(t).replace(/\s+/g, ' ').trim().slice(0, max) || '…';
const alertMeaning = (key, example, index) => {
  const k = String(key).toLowerCase();
  if (/link|url/.test(k)) return 'link';
  if (/text|message|reply|body/.test(k)) return 'text';
  if (/name|guest/.test(k)) return 'name';
  return ['name', 'text'][index] || 'text';
};
let inboxLink = (thread) => `/admin/inbox?thread=${encodeURIComponent(thread)}`; // made absolute by the server
const setInboxLink = (fn) => (inboxLink = fn);

async function alert(name, text, thread) {
  const to = toWaNumber(env('WHATSAPP_ALERT_TO'));
  if (!configured() || !to) return null;
  const tplName = env('WHATSAPP_ALERT_TEMPLATE') || 'guest_reply_alert';
  const t = await template({ name: tplName }).catch(() => ({
    name: tplName, language: settings().lang,
    components: [{ type: 'BODY', text: '{{1}} replied to their invitation: {{2}}' }, { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Open inbox', url: '' }] }],
  }));
  const values = { name: flat(name, 60), text: flat(text, 500), link: inboxLink(thread), code: '' };
  const { components } = fill(t, values, null, alertMeaning);
  return graph(`/${settings().phoneId}/messages`, { method: 'POST', body: { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template', template: { name: t.name, language: { code: t.language }, components } } });
}

module.exports = {
  configured, status, preview, needsCard, sendInvite, sendMany, eligible, toWaNumber, setValues,
  verifyChallenge, signatureOk, handleWebhook, reply, windowUntil, rsvpToInbox, setInboxLink, WhatsAppError,
  _setFetch: (f) => (fetchImpl = f), _reset: () => (cached = {}),
};
