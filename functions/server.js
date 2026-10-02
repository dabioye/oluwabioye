const express = require('express');
const crypto = require('crypto');
const path = require('path');
const QRCode = require('qrcode');

const cfg = require('./src/config');
const store = require('./src/store');
const content = require('./src/content');
const pages = require('./src/pages');
const { adminPage, sitePage, loginPage, checkinPage, checkinResultPage } = require('./src/staff');
const { parseCsv, toCsv } = require('./src/csv');

const PORT = process.env.PORT || 3000;
const env = (k) => process.env[k] || '';
const BASE_URL = () => (env('BASE_URL') || `http://localhost:${PORT}`).replace(/\/$/, '');
// Private traditional-wedding site (e.g. https://oluwabioye.dabioye.com). Falls back to BASE_URL.
const INVITE_URL = () => (env('INVITE_URL') || BASE_URL()).replace(/\/$/, '');
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
const onInviteHost = (req) => !!env('INVITE_URL') && req.hostname === hostOf(INVITE_URL()) && hostOf(INVITE_URL()) !== hostOf(BASE_URL());
// Read secrets lazily: on Firebase they are injected at request time.
let devSecret;
const SECRET = () => env('SESSION_SECRET') || (devSecret ||= crypto.randomBytes(32).toString('hex'));

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Frame-Options', 'DENY');
  // Dynamic pages must never be cached by the Firebase CDN.
  res.set('Cache-Control', 'private, no-store');
  next();
});
// Locally we serve /public ourselves; on Firebase, Hosting serves it before requests reach here.
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Uploaded photos. Ids are random and never reused, so the CDN can cache them for a year.
app.get('/media/:id', wrap(async (req, res) => {
  const id = String(req.params.id);
  if (!/^[a-f0-9]{20}\.(jpg|png|webp)$/.test(id)) return res.sendStatus(404);
  const m = await store.readMedia(id);
  if (!m) return res.sendStatus(404);
  res.set('Cache-Control', 'public, max-age=31536000, immutable').type(id.split('.').pop()).send(m.buf);
}));

// Load editable site content (admin-edited text and photos) before rendering any page.
app.use(wrap(async (req, res, next) => { await content.apply(); next(); }));

// Two front doors, one app:
//  - public site (BASE_URL): church wedding, RSVP, admin
//  - invite site (INVITE_URL): only personal invitations, access-card QR and the gate
app.use((req, res, next) => {
  if (!env('INVITE_URL') || hostOf(INVITE_URL()) === hostOf(BASE_URL())) return next();
  const p = req.path;
  const inviteOnly = /^\/(i|c)\//.test(p);
  if (onInviteHost(req)) {
    if (p === '/robots.txt') return res.type('text/plain').send('User-agent: *\nDisallow: /\n');
    if (inviteOnly || p.startsWith('/checkin') || p.startsWith('/api/checkin') || p === '/logout') return next();
    return res.status(p === '/' ? 200 : 404).send(pages.privateLanding());
  }
  if (inviteOnly) return res.redirect(301, INVITE_URL() + req.originalUrl);
  next();
});

// ---------- sessions ----------
// Firebase Hosting strips every cookie except one named "__session", so that's the name we use.
const COOKIE = '__session';
const sign = (v) => crypto.createHmac('sha256', SECRET()).update(v).digest('base64url');
function issue(res, role, days) {
  const exp = Date.now() + days * 864e5;
  const val = `${role}.${exp}`;
  res.cookie(COOKIE, `${val}.${sign(val)}`, { httpOnly: true, sameSite: 'lax', secure: BASE_URL().startsWith('https'), maxAge: days * 864e5, path: '/' });
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
const needAdmin = (req, res, next) => (isAdmin(req) ? next() : req.originalUrl.startsWith('/api') ? res.status(401).json({ error: 'Sign in again' }) : res.redirect('/admin/login'));
const needStaff = (req, res, next) => (isStaff(req) ? next() : res.status(401).json({ error: 'Sign in again' }));

// Small per-instance rate limiter for guessable endpoints.
const hits = new Map();
function limit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + req.path;
    const t = Date.now();
    const h = (hits.get(key) || []).filter((x) => t - x < windowMs);
    h.push(t);
    hits.set(key, h);
    if (hits.size > 5000) hits.clear();
    if (h.length > max) return res.status(429).send(pages.simple('Slow down a little', 'Too many attempts. Please wait a minute and try again.'));
    next();
  };
}
const safeEq = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());

// ---------- helpers ----------
const inviteLink = (g) => `${INVITE_URL()}/i/${g.code}`;
const qrSvg = (text) => QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0f1a2e', light: '#f5eee2' } });
const message = (g) =>
  cfg.inviteMessage.replaceAll('{name}', g.name).replaceAll('{link}', inviteLink(g)).replaceAll('{weekday}', pages.weekday()).replaceAll('{rsvpBy}', pages.longDate(cfg.rsvpBy));
const publicGuest = (g) => ({ ...g, link: inviteLink(g), message: message(g) });

// ---------- public: church wedding ----------
app.get('/', (req, res) => res.send(pages.home()));
app.get('/invitation', (req, res) => res.send(pages.invitationPage()));
app.get('/our-story', (req, res) => res.send(pages.storyPage()));

app.post('/rsvp', limit(10, 60_000), wrap(async (req, res) => {
  if (cfg.churchRsvp.open === false) return res.redirect(303, '/');
  if (req.body.website) return res.send(pages.home({ rsvp: { done: true, attending: 'yes' } })); // bot trap
  try {
    const r = await store.savePublicRsvp(req.body);
    res.send(pages.home({ rsvp: { done: true, attending: req.body.attending, updated: r.updated } }));
  } catch (e) {
    res.status(400).send(pages.home({ rsvp: { error: e.message }, form: req.body }));
  }
}));

app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /i/\nDisallow: /c/\nDisallow: /admin\nDisallow: /checkin\nDisallow: /api/\n'));

// ---------- private: traditional wedding invitations ----------
app.get('/i/:code', limit(60, 60_000), wrap(async (req, res) => {
  let g = await store.byCode(req.params.code);
  if (!g) return res.status(404).send(pages.simple('Invitation not found', 'This link doesn’t match an invitation. Please check the link you received, or contact Busayo or Hope.'));
  if (!isStaff(req)) g = (await store.markOpened(g)) || g;
  res.send(pages.invite({ guest: g, qrSvg: await qrSvg(`${INVITE_URL()}/c/${g.code}`), justSaved: req.query.saved === '1' }));
}));

app.post('/i/:code/rsvp', limit(20, 60_000), wrap(async (req, res) => {
  const g = await store.byCode(req.params.code);
  if (!g) return res.status(404).send(pages.simple('Invitation not found', 'This link doesn’t match an invitation.'));
  await store.setRsvp(g, req.body.response === 'no' ? 'no' : 'yes', req.body.note);
  res.redirect(303, `/i/${g.code}?saved=1#respond`);
}));

// The QR on the access card points here. Signed-in ushers get the check-in result; anyone else sees the invite.
app.get('/c/:code', wrap(async (req, res) => {
  const g = await store.byCode(req.params.code);
  if (!isStaff(req)) return res.redirect(g ? `/i/${g.code}` : '/');
  if (!g) return res.send(checkinResultPage({ status: 'missing', code: req.params.code }));
  if (g.rsvp === 'no') return res.send(checkinResultPage({ status: 'declined', guest: g }));
  const already = await store.checkIn(g);
  res.send(checkinResultPage({ status: already ? 'repeat' : 'ok', guest: g, already }));
}));

app.get('/calendar/:key.ics', (req, res) => {
  const ev = cfg.events[req.params.key];
  if (!ev) return res.sendStatus(404);
  const start = new Date(ev.startsAt);
  const end = new Date(start.getTime() + 3 * 3600e3);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SD Wedding//EN', 'BEGIN:VEVENT',
    `UID:${ev.key}-${cfg.date}@sarahanddamilare`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${cfg.couple.bride} & ${cfg.couple.groom} · ${ev.name}`,
    `LOCATION:${[ev.venue, ev.venueLine2, ev.address].join(', ').replace(/,/g, '\\,')}`,
    `URL:${BASE_URL()}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  res.type('text/calendar').set('Content-Disposition', `attachment; filename="${ev.key}.ics"`).send(ics);
});

// ---------- admin ----------
app.get('/admin/login', (req, res) => res.send(loginPage({ kind: 'admin' })));
app.post('/admin/login', limit(8, 60_000), (req, res) => {
  const pw = env('ADMIN_PASSWORD');
  if (!pw || !safeEq(req.body.password || '', pw)) return res.status(401).send(loginPage({ kind: 'admin', error: pw ? 'That password didn’t work.' : 'ADMIN_PASSWORD isn’t set on the server yet.' }));
  issue(res, 'admin', 30);
  res.redirect('/admin');
});
app.get('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.redirect('/');
});
app.get('/admin', needAdmin, (req, res) => res.send(adminPage()));
app.get('/admin/site', needAdmin, (req, res) => res.send(sitePage()));

const api = express.Router();
api.use(needAdmin);
const guestOr404 = async (req, res) => {
  const g = await store.byId(req.params.id);
  if (!g) res.status(404).json({ error: 'Guest not found' });
  return g;
};
api.get('/guests', wrap(async (req, res) => {
  const [guests, activity, church] = await Promise.all([store.all(), store.activity(60), store.publicRsvps()]);
  res.json({ guests: guests.map(publicGuest), activity, church, baseUrl: BASE_URL() });
}));
api.post('/guests', wrap(async (req, res) => {
  try { res.json(publicGuest(await store.create(req.body))); } catch (e) { res.status(400).json({ error: e.message }); }
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
  for (const r of rows) {
    if (!r.name) continue;
    const key = `${r.name.toLowerCase()}|${r.phone || ''}`;
    if (seen.has(key)) { skipped.push(r.name); continue; }
    seen.add(key);
    await store.create(r);
    added++;
  }
  res.json({ added, skipped });
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
api.get('/site', wrap(async (req, res) => res.json(await content.current())));
api.put('/site', wrap(async (req, res) => res.json(await content.save(req.body))));
api.post('/media', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '1mb' }), wrap(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Send a JPEG, PNG or WebP image under 1 MB.' });
  const id = await store.saveMedia(req.body, req.get('content-type'));
  res.json({ url: '/media/' + id });
}));
app.use('/api/admin', api);

// ---------- gate check-in ----------
app.get('/checkin', (req, res) => res.send(isStaff(req) ? checkinPage() : loginPage({ kind: 'checkin' })));
app.post('/checkin/login', limit(8, 60_000), (req, res) => {
  const pin = env('CHECKIN_PIN');
  const pw = env('ADMIN_PASSWORD');
  const given = req.body.password || '';
  if (!((pin && safeEq(given, pin)) || (pw && safeEq(given, pw)))) return res.status(401).send(loginPage({ kind: 'checkin', error: 'That PIN didn’t work.' }));
  issue(res, 'checkin', 3);
  res.redirect('/checkin');
});
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

app.use((req, res) => res.status(404).send(pages.simple('Page not found', 'That page doesn’t exist.')));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(pages.simple('Something went wrong', 'Please try again in a moment.'));
});

if (require.main === module) {
  if (!env('ADMIN_PASSWORD')) console.warn('⚠  ADMIN_PASSWORD is not set. The admin area is locked until you set it.');
  app.listen(PORT, () => console.log(`Wedding site on ${BASE_URL()}  (store: ${store.kind}; admin: /admin, gate: /checkin)`));
}
module.exports = app;
