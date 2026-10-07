// JSON API behind the two static sites. Firebase Hosting serves the pages and forwards
// /api/**, /media/** and /calendar/** here:
//  - public site (BASE_URL):  church wedding pages, /admin
//  - invite site (INVITE_URL): code entry, private invitations /i/CODE, access-card QR /c/CODE, gate /checkin
const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');

const cfg = require('./src/config');
const store = require('./src/store');
const content = require('./src/content');
const { weekday, longDate } = require('./src/dates');
const { parseCsv, toCsv } = require('./src/csv');
const whatsapp = require('./src/whatsapp');

const PORT = process.env.PORT || 3000;
const env = (k) => process.env[k] || '';
const BASE_URL = () => (env('BASE_URL') || `http://localhost:${PORT}`).replace(/\/$/, '');
const INVITE_URL = () => (env('INVITE_URL') || BASE_URL()).replace(/\/$/, '');
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
// Read secrets lazily: on Firebase they are injected at request time.
let devSecret;
const SECRET = () => env('SESSION_SECRET') || (devSecret ||= crypto.randomBytes(32).toString('hex'));

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  // API answers are personal unless a route says otherwise, so the Firebase CDN must not cache them.
  res.set('Cache-Control', 'private, no-store');
  next();
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- sessions ----------
// Firebase Hosting strips every cookie except one named "__session", so that's the name we use.
const COOKIE = '__session';
const sign = (v) => crypto.createHmac('sha256', SECRET()).update(v).digest('base64url');
function issue(req, res, role, days) {
  const exp = Date.now() + days * 864e5;
  const val = `${role}.${exp}`;
  const secure = req.secure || BASE_URL().startsWith('https');
  res.cookie(COOKIE, `${val}.${sign(val)}`, { httpOnly: true, sameSite: 'lax', secure, maxAge: days * 864e5, path: '/' });
}
function roleOf(req) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(req.headers.cookie || '');
  if (!m) return null;
  const [role, exp, sig] = decodeURIComponent(m[1]).split('.');
  if (!role || !exp || !sig) return null;
  const expect = sign(`${role}.${exp}`);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  if (Date.now() > Number(exp)) return null;
  return role;
}
const isAdmin = (req) => roleOf(req) === 'admin';
const isStaff = (req) => ['admin', 'checkin'].includes(roleOf(req));
const needAdmin = (req, res, next) => (isAdmin(req) ? next() : res.status(401).json({ error: 'Sign in again' }));
const needStaff = (req, res, next) => (isStaff(req) ? next() : res.status(401).json({ error: 'Sign in again' }));
const safeEq = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());

// Small per-instance limiter for password and PIN attempts.
const hits = new Map();
function limit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + req.path;
    const t = Date.now();
    const h = (hits.get(key) || []).filter((x) => t - x < windowMs);
    h.push(t);
    hits.set(key, h);
    if (hits.size > 5000) hits.clear();
    if (h.length > max) return res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' });
    next();
  };
}

// Invitation codes can be typed in by hand, so wrong codes are counted per visitor in the store
// (shared by every function instance). Right codes never count, so guests are not slowed down.
const CODE_MISSES = { max: 10, windowMs: 15 * 60e3 };
const missKey = (req) => 'code-' + crypto.createHash('sha256').update(`${SECRET()}|${req.ip}`).digest('hex').slice(0, 32);
const TOO_MANY = 'Too many codes tried. Please wait 15 minutes, or message Busayo or Hope for your link.';
async function lookupCode(req, raw) {
  const key = missKey(req);
  if ((await store.attempts(key)) >= CODE_MISSES.max) return { limited: true };
  const g = await store.byCode(raw);
  if (!g) await store.addAttempt(key, CODE_MISSES.windowMs);
  return { guest: g };
}

// ---------- helpers ----------
const inviteLink = (g) => `${INVITE_URL()}/i/${g.code}`;
const qrSvg = (text) => QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0f1a2e', light: '#f5eee2' } });
const message = (g) =>
  cfg.inviteMessage.replaceAll('{name}', g.name).replaceAll('{link}', inviteLink(g)).replaceAll('{weekday}', weekday()).replaceAll('{rsvpBy}', longDate(cfg.rsvpBy));
const publicGuest = (g) => ({ ...g, link: inviteLink(g), message: message(g) });
// What a guest sees about themselves on their invitation.
const inviteGuest = (g) => ({ name: g.name, code: g.code, events: g.events, rsvp: g.rsvp, rsvpNote: g.rsvpNote, driverCard: !!g.driverCard });
whatsapp.setValues(async (g) => ({ name: g.name, first: g.name.split(/\s+/)[0], code: g.code, link: inviteLink(g), rsvpBy: longDate((await content.current()).rsvpBy) }));
whatsapp.setInboxLink((thread) => `${BASE_URL()}/admin/inbox?thread=${encodeURIComponent(thread)}`);
// Auto-send the WhatsApp invitation when a guest is added or imported, if turned on in Edit website
// (and the template doesn't need each guest's card, which only the desk can draw).
const autoSend = async () => whatsapp.configured() && !!(await content.current()).waAutoSend && !(await whatsapp.needsCard().catch(() => true));
const onPublicHost = (req) => !!env('INVITE_URL') && hostOf(INVITE_URL()) !== hostOf(BASE_URL()) && req.hostname === hostOf(BASE_URL());

// ---------- public ----------
// Uploaded photos. Ids are random and never reused, so the CDN can cache them for a year.
app.get('/media/:id', wrap(async (req, res) => {
  const id = String(req.params.id);
  if (!/^[a-f0-9]{20}\.(jpg|png|webp)$/.test(id)) return res.sendStatus(404);
  const m = await store.readMedia(id);
  if (!m) return res.sendStatus(404);
  res.set('Cache-Control', 'public, max-age=31536000, immutable').type(id.split('.').pop()).send(m.buf);
}));

// Editable content for the public pages (couple photo, story, gallery, registry…). Cached briefly at the CDN.
app.get('/api/content', wrap(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=30, s-maxage=60');
  res.json(content.publicView(await content.current()));
}));

app.get('/calendar/:key.ics', (req, res) => {
  const ev = cfg.events[req.params.key];
  // The traditional wedding is private: its calendar file is only offered from the invite site.
  if (!ev || (ev.key === 'trad' && onPublicHost(req))) return res.sendStatus(404);
  const start = new Date(ev.startsAt);
  const end = new Date(start.getTime() + 3 * 3600e3);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SD Wedding//EN', 'BEGIN:VEVENT',
    `UID:${ev.key}-${cfg.date}@sarahanddamilare`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${cfg.couple.bride} & ${cfg.couple.groom} · ${ev.name}`,
    `LOCATION:${[ev.venue, ev.venueLine2, ev.address].join(', ').replace(/,/g, '\\,')}`,
    `URL:${ev.key === 'trad' ? INVITE_URL() : BASE_URL()}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  res.type('text/calendar').set('Content-Disposition', `attachment; filename="${ev.key}.ics"`).send(ics);
});

// Church RSVP (only while churchRsvp.open is true in config).
app.post('/api/rsvp', limit(10, 60_000), wrap(async (req, res) => {
  if (cfg.churchRsvp.open === false) return res.status(410).json({ error: 'RSVP is closed.' });
  if (req.body.website) return res.json({ ok: true }); // bot trap
  try { res.json(await store.savePublicRsvp(req.body)); } catch (e) { res.status(400).json({ error: e.message }); }
}));

// ---------- private invitations ----------
// Code entry on the invite site's front page.
app.post('/api/invite/lookup', wrap(async (req, res) => {
  const r = await lookupCode(req, req.body.code);
  if (r.limited) return res.status(429).json({ error: TOO_MANY });
  if (!r.guest) return res.status(404).json({ error: 'We couldn’t find that code. Check the message you received, or contact Busayo or Hope.' });
  res.json({ code: r.guest.code });
}));

app.get('/api/invite/:code', wrap(async (req, res) => {
  const r = await lookupCode(req, req.params.code);
  if (r.limited) return res.status(429).json({ error: TOO_MANY });
  let g = r.guest;
  if (!g) return res.status(404).json({ error: 'This link doesn’t match an invitation. Please check the link you received, or contact Busayo or Hope.' });
  if (!isStaff(req)) g = (await store.markOpened(g)) || g;
  res.json({
    guest: inviteGuest(g),
    qrSvg: await qrSvg(`${INVITE_URL()}/c/${g.code}`),
    invite: content.inviteView(await content.current()),
    publicUrl: BASE_URL(),
  });
}));

app.post('/api/invite/:code/rsvp', limit(20, 60_000), wrap(async (req, res) => {
  const g = await store.byCode(req.params.code);
  if (!g) return res.status(404).json({ error: 'This link doesn’t match an invitation.' });
  const response = req.body.response === 'no' ? 'no' : 'yes';
  const note = String(req.body.note || '').trim().slice(0, 500);
  const updated = await store.setRsvp(g, response, note);
  // The note (and every decline) also comes to the couple's inbox, with an alert on their phone.
  if (note || response === 'no') await whatsapp.rsvpToInbox(g, response, note);
  res.json({ guest: inviteGuest(updated) });
}));

// ---------- staff sign-in ----------
app.get('/api/session', (req, res) => res.json({ role: roleOf(req) }));
// Sign-in attempts per minute per visitor (raised only by the browser tests, which sign in often).
app.post('/api/login', limit(Number(env('LOGIN_LIMIT')) || 8, 60_000), (req, res) => {
  const kind = req.body.kind === 'checkin' ? 'checkin' : 'admin';
  const given = String(req.body.password || '');
  const pw = env('ADMIN_PASSWORD');
  const pin = env('CHECKIN_PIN');
  if (kind === 'admin') {
    if (!pw) return res.status(503).json({ error: 'ADMIN_PASSWORD isn’t set on the server yet.' });
    if (!safeEq(given, pw)) return res.status(401).json({ error: 'That password didn’t work.' });
    issue(req, res, 'admin', 30);
    return res.json({ role: 'admin' });
  }
  if (!((pin && safeEq(given, pin)) || (pw && safeEq(given, pw)))) return res.status(401).json({ error: 'That PIN didn’t work.' });
  issue(req, res, 'checkin', 3);
  res.json({ role: 'checkin' });
});
app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

// ---------- WhatsApp Cloud API webhook (delivery / read receipts). Works on either domain. ----------
app.get('/api/whatsapp/webhook', (req, res) => {
  const challenge = whatsapp.verifyChallenge(req.query);
  challenge !== null ? res.type('text/plain').send(challenge) : res.sendStatus(403);
});
app.post('/api/whatsapp/webhook', wrap(async (req, res) => {
  if (!whatsapp.signatureOk(req.rawBody || Buffer.alloc(0), req.get('x-hub-signature-256'))) return res.sendStatus(401);
  await whatsapp.handleWebhook(req.body || {});
  res.sendStatus(200);
}));

// ---------- admin ----------
const api = express.Router();
api.use(needAdmin);
const guestOr404 = async (req, res) => {
  const g = await store.byId(req.params.id);
  if (!g) res.status(404).json({ error: 'Guest not found' });
  return g;
};
api.get('/guests', wrap(async (req, res) => {
  const [guests, activity, church] = await Promise.all([store.all(), store.activity(60), store.publicRsvps()]);
  res.json({ guests: guests.map(publicGuest), activity, church, baseUrl: BASE_URL(), inviteUrl: INVITE_URL() });
}));
api.post('/guests', wrap(async (req, res) => {
  let g;
  try { g = await store.create(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
  let whatsappResult = null;
  if (whatsapp.eligible(g) && (await autoSend())) whatsappResult = await whatsapp.sendInvite(g);
  res.json({ ...publicGuest((await store.byId(g.id)) || g), whatsapp: whatsappResult });
}));
api.patch('/guests/:id', wrap(async (req, res) => {
  const g = await store.update(req.params.id, req.body);
  g ? res.json(publicGuest(g)) : res.status(404).json({ error: 'Guest not found' });
}));
api.delete('/guests/:id', wrap(async (req, res) => res.json({ ok: await store.remove(req.params.id) })));
api.post('/guests/:id/sent', wrap(async (req, res) => {
  const g = await guestOr404(req, res); if (!g) return;
  res.json(publicGuest(req.body.sent === false ? await store.unmarkSent(g) : await store.markSent(g, req.body.via)));
}));
api.post('/guests/:id/rsvp', wrap(async (req, res) => {
  const g = await guestOr404(req, res); if (!g) return;
  const r = ['yes', 'no', 'pending'].includes(req.body.rsvp) ? req.body.rsvp : 'pending';
  res.json(publicGuest(await store.setRsvp(g, r, req.body.note ?? g.rsvpNote)));
}));
api.post('/guests/:id/checkin', wrap(async (req, res) => {
  const g = await guestOr404(req, res); if (!g) return;
  req.body.undo ? await store.undoCheckIn(g) : await store.checkIn(g);
  res.json(publicGuest(await store.byId(g.id)));
}));
api.post('/import', wrap(async (req, res) => {
  const rows = parseCsv(String(req.body.csv || ''));
  const existing = await store.all();
  const seen = new Set(existing.map((g) => `${g.name.toLowerCase()}|${g.phone || ''}`));
  let added = 0;
  const skipped = [];
  const created = [];
  for (const r of rows) {
    if (!r.name) continue;
    const key = `${r.name.toLowerCase()}|${r.phone || ''}`;
    if (seen.has(key)) { skipped.push(r.name); continue; }
    seen.add(key);
    created.push(await store.create(r));
    added++;
  }
  const sendable = created.filter(whatsapp.eligible);
  const whatsappResult = sendable.length && (await autoSend()) ? await whatsapp.sendMany(sendable) : null;
  res.json({ added, skipped, whatsapp: whatsappResult });
}));
api.get('/export.csv', wrap(async (req, res) => {
  const all = await store.all();
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="traditional-guests.csv"').send(toCsv(all.map((g) => ({ ...g, link: inviteLink(g), events: g.events.join(' ') }))));
}));
api.get('/church.csv', wrap(async (req, res) => {
  const rows = await store.publicRsvps();
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="church-rsvps.csv"')
    .send(toCsv(rows, ['name', 'phone', 'email', 'attending', 'party', 'note', 'createdAt', 'updatedAt']));
}));
api.delete('/church/:id', wrap(async (req, res) => res.json({ ok: await store.removePublicRsvp(req.params.id) })));
api.get('/qr/:id.svg', wrap(async (req, res) => {
  const g = await store.byId(req.params.id);
  if (!g) return res.sendStatus(404);
  res.type('image/svg+xml').send(await qrSvg(`${INVITE_URL()}/c/${g.code}`));
}));
api.get('/site', wrap(async (req, res) => res.json({ ...(await content.current()), inviteUrl: INVITE_URL() })));
api.put('/site', wrap(async (req, res) => res.json(await content.save(req.body))));
api.post('/media', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '1mb' }), wrap(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Send a JPEG, PNG or WebP image under 1 MB.' });
  const id = await store.saveMedia(req.body, req.get('content-type'));
  res.json({ url: '/media/' + id });
}));
api.get('/whatsapp', wrap(async (req, res) => {
  const [s, c] = await Promise.all([whatsapp.status(), content.current()]);
  const g = s.configured && req.query.guest ? await store.byId(String(req.query.guest)) : null;
  if (g) s.preview = await whatsapp.preview(g).catch(() => '');
  res.json({ ...s, autoSend: !!c.waAutoSend });
}));
// One guest's invitation; the body may be their personalised card (JPEG) for templates that start with an image.
api.post('/guests/:id/whatsapp', express.raw({ type: 'image/jpeg', limit: '4mb' }), wrap(async (req, res) => {
  const g = await guestOr404(req, res); if (!g) return;
  const r = await whatsapp.sendInvite(g, Buffer.isBuffer(req.body) ? req.body : null);
  res.status(r.ok ? 200 : 400).json({ ...r, guest: publicGuest(await store.byId(g.id)) });
}));
// Send to every WhatsApp guest who hasn't had an API invite yet (150 per call; the page repeats until done).
// Only for templates that don't need each guest's card: the desk sends those one by one with the card.
api.post('/whatsapp/send-pending', wrap(async (req, res) => {
  if (!whatsapp.configured()) return res.status(400).json({ error: 'WhatsApp API is not set up yet.' });
  if (await whatsapp.needsCard()) return res.status(409).json({ error: 'This template needs each guest’s card. Send from the invitation desk.' });
  const pending = (await store.all()).filter(whatsapp.eligible).filter((g) => g.waStatus !== 'failed' || req.body.retryFailed);
  const batch = pending.slice(0, 150);
  const r = await whatsapp.sendMany(batch);
  res.json({ ...r, remaining: pending.length - batch.length });
}));
// Inbox: guests' WhatsApp replies, and free-text answers while their 24-hour window is open.
api.get('/inbox', wrap(async (req, res) => {
  const threads = new Map();
  for (const m of await store.messages({ limit: 2000 })) {
    const t = threads.get(m.thread) || { thread: m.thread, guestId: m.guestId, name: m.name, phone: m.phone, unread: 0, last: null, windowUntil: null };
    if (m.dir === 'in') {
      t.name = m.name;
      t.windowUntil = whatsapp.windowUntil([m]);
      if (!m.read) t.unread++;
    }
    t.last = { dir: m.dir, text: m.text, at: m.at };
    threads.set(m.thread, t);
  }
  res.json({ threads: [...threads.values()].sort((a, b) => b.last.at.localeCompare(a.last.at)), configured: whatsapp.configured() });
}));
api.get('/inbox/:thread', wrap(async (req, res) => {
  const thread = req.params.thread;
  const messages = await store.messages({ thread });
  const g = thread.startsWith('p:') ? null : await store.byId(thread);
  if (!messages.length && !g) return res.status(404).json({ error: 'Conversation not found' });
  await store.markThreadRead(thread);
  res.json({
    thread, guest: g ? publicGuest(g) : null,
    name: g?.name || messages.find((m) => m.dir === 'in')?.name || thread.slice(2),
    phone: g ? whatsapp.toWaNumber(g.phone) : thread.slice(2),
    messages, windowUntil: whatsapp.windowUntil(messages),
  });
}));
api.post('/inbox/:thread/reply', wrap(async (req, res) => {
  try { res.json(await whatsapp.reply(req.params.thread, req.body.text)); } catch (e) {
    if (!(e instanceof whatsapp.WhatsAppError)) throw e;
    res.status(400).json({ error: e.message });
  }
}));
app.use('/api/admin', api);

// ---------- gate check-in ----------
app.post('/api/checkin', needStaff, wrap(async (req, res) => {
  const raw = String(req.body.code || '').trim();
  const code = (raw.match(/\/c\/([A-Za-z0-9]+)/) || [, raw])[1];
  const g = await store.byCode(code);
  if (!g) return res.json({ status: 'missing', code });
  if (req.body.undo) { await store.undoCheckIn(g); return res.json({ status: 'undone', guest: g }); }
  if (g.rsvp === 'no') return res.json({ status: 'declined', guest: g });
  const already = await store.checkIn(g);
  res.json({ status: already ? 'repeat' : 'ok', guest: g, already });
}));
app.get('/api/checkin/stats', needStaff, wrap(async (req, res) => {
  const all = await store.all();
  res.json({
    checkedIn: all.filter((g) => g.checkedInAt).length,
    expected: all.filter((g) => g.rsvp === 'yes').length,
    recent: all.filter((g) => g.checkedInAt).sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt)).slice(0, 8).map((g) => ({ name: g.name, at: g.checkedInAt, table: g.table })),
  });
}));
app.get('/api/checkin/search', needStaff, wrap(async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (q.length < 2) return res.json([]);
  const all = await store.all();
  res.json(all.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 8).map((g) => ({ name: g.name, code: g.code, rsvp: g.rsvp, checkedInAt: g.checkedInAt, table: g.table })));
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((req, res) => res.sendStatus(404));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again in a moment.' });
});

module.exports = app;
