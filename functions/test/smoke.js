// End-to-end smoke test. Runs against a throwaway JSON store by default,
// or the Firestore emulator with `npm run test:firestore`.
const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
if (process.env.STORE !== 'firestore') {
  process.env.STORE = 'json';
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wed-'));
}
process.env.ADMIN_PASSWORD = 'test-admin';
process.env.CHECKIN_PIN = '4321';
process.env.SESSION_SECRET = 'x'.repeat(32);
const app = require('../server');
const store = require('../src/store');

(async () => {
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const req = (p, o = {}) => fetch(base + p, { redirect: 'manual', ...o });
  const form = (o, cookie) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) }, body: new URLSearchParams(o) });
  const json = (m, b, c) => ({ method: m, headers: { 'Content-Type': 'application/json', cookie: c }, body: JSON.stringify(b) });

  // Public homepage: church only, no traditional details, no code lookup
  let r = await req('/');
  assert.equal(r.status, 200);
  const home = await r.text();
  assert(home.includes('Thursday'), 'weekday computed');
  assert(home.includes('Garden of Peace'), 'church shown');
  assert(!home.includes('SCFN'), 'traditional venue hidden from public page');
  assert(!home.includes('/find'), 'no invitation-code lookup on public page');
  assert.equal((await req('/find?code=AAAAAA')).status, 404);

  // RSVP lives only on private invitations: none on the public site
  assert(!/rsvp/i.test(home), 'no RSVP on public homepage');
  assert(!/rsvp/i.test(await (await req('/invitation')).text()), 'no RSVP on public invitation page');
  r = await req('/rsvp', form({ name: 'Bisi Ade', phone: '0803 111 2222', attending: 'yes', party: '3' }));
  assert.equal(r.status, 303);
  assert.equal((await store.publicRsvps()).length, 0, 'public RSVP is closed');

  // Admin
  assert.equal((await req('/admin')).status, 302);
  assert.equal((await req('/admin/login', form({ password: 'bad' }))).status, 401);
  r = await req('/admin/login', form({ password: 'test-admin' }));
  assert.equal(r.status, 302);
  const admin = r.headers.get('set-cookie').split(';')[0];
  assert(admin.startsWith('__session='), 'Firebase-compatible cookie name');
  assert.equal((await req('/admin', { headers: { cookie: admin } })).status, 200);

  r = await req('/api/admin/guests', json('POST', { name: 'Tope Omidiji', phone: '08031234567', side: 'groom', driverCard: true }, admin));
  const g = await r.json();
  assert.match(g.code, /^[A-Z2-9]{6}$/);
  assert(g.message.includes(g.link) && g.message.includes('traditional'));
  r = await req('/api/admin/import', json('POST', { csv: 'Full Name,Phone,Side,Events\n"Ade, Jnr",0802,bride,church\nTope Omidiji,08031234567,groom,trad' }, admin));
  assert.deepEqual(await r.json(), { added: 1, skipped: ['Tope Omidiji'] });

  // Private traditional invitation
  r = await req('/i/' + g.code);
  const inv = await r.text();
  assert(inv.includes('Tope Omidiji') && inv.includes('SCFN') && inv.includes('Joyfully accept'));
  assert(inv.includes('noindex'));
  r = await req('/i/' + g.code + '/rsvp', form({ response: 'yes', note: 'Can’t wait' }));
  assert.equal(r.status, 303);
  r = await req('/i/' + g.code);
  const inv2 = await r.text();
  assert(inv2.includes('<svg') && inv2.includes("Driver's meal card"));
  assert.equal((await req('/i/ZZZZZZ')).status, 404);

  // Gate
  r = await req('/checkin/login', form({ password: '4321' }));
  const gate = r.headers.get('set-cookie').split(';')[0];
  r = await req('/api/checkin', json('POST', { code: base + '/c/' + g.code }, gate));
  assert.equal((await r.json()).status, 'ok');
  r = await req('/api/checkin', json('POST', { code: g.code }, gate));
  assert.equal((await r.json()).status, 'repeat');
  r = await req('/api/checkin', json('POST', { code: 'NOPE22' }, gate));
  assert.equal((await r.json()).status, 'missing');
  assert.equal((await req('/api/admin/guests', { headers: { cookie: gate } })).status, 401, 'gate cannot read admin');

  r = await req('/api/admin/guests', { headers: { cookie: admin } });
  const d = await r.json();
  const t = d.guests.find((x) => x.code === g.code);
  assert(t.openedAt && t.openCount === 2 && t.checkedInAt && t.rsvp === 'yes');
  assert.equal(d.church.length, 0);
  r = await req('/api/admin/export.csv', { headers: { cookie: admin } });
  assert((await r.text()).includes('Ade, Jnr'));
  assert.equal((await req('/api/admin/church.csv', { headers: { cookie: admin } })).status, 200);
  r = await req('/calendar/church.ics');
  assert((await r.text()).includes('DTSTART:20261217T090000Z'));
  assert((await (await req('/robots.txt')).text()).includes('Disallow: /i/'));

  // Website editor: content + photo upload
  const png = Buffer.from('ffd8ffe000104a464946', 'hex');
  r = await req('/api/admin/media', { method: 'POST', headers: { 'Content-Type': 'image/jpeg', cookie: admin }, body: png });
  const { url } = await r.json();
  assert.match(url, /^\/media\/[a-f0-9]{20}\.jpg$/);
  r = await req(url);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /immutable/);
  r = await req('/api/admin/site', json('PUT', { hero: { note: 'Hello <b>guests</b>', photo: url }, registryUrl: 'https://withjoy.com/sd', gallery: [{ src: url, caption: 'Us' }, { src: 'javascript:x' }], story: [{ when: '2019', title: 'We met', text: 'At church' }] }, admin));
  const site = await r.json();
  assert.equal(site.gallery.length, 1, 'unsafe URLs dropped');
  assert.equal((await req('/api/admin/site', json('PUT', {}, gate))).status, 401);
  await new Promise((ok) => setTimeout(ok, 50));
  const h = await (await req('/')).text();
  assert(h.includes('Hello &lt;b&gt;guests&lt;/b&gt;') && h.includes('https://withjoy.com/sd') && h.includes('We met'), 'edits render (escaped)');

  // Two domains
  process.env.BASE_URL = 'http://public.test';
  process.env.INVITE_URL = 'http://invite.test';
  const onInv = (p) => req(p, { headers: { 'X-Forwarded-Host': 'invite.test' } });
  r = await onInv('/');
  const land = await r.text();
  assert(land.includes('Strictly by invitation') && !land.includes('Garden of Peace'), 'invite host front page is private');
  assert.equal((await onInv('/admin')).status, 404, 'no admin on invite host');
  assert.equal((await onInv('/i/' + g.code)).status, 200);
  r = await req('/i/' + g.code, { headers: { 'X-Forwarded-Host': 'public.test' } });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), 'http://invite.test/i/' + g.code);
  assert((await (await onInv('/robots.txt')).text()).includes('Disallow: /\n'));
  r = await req('/api/admin/guests', { headers: { cookie: admin, 'X-Forwarded-Host': 'public.test' } });
  assert((await r.json()).guests[0].link.startsWith('http://invite.test/i/'));

  console.log(`✓ all smoke checks passed (store: ${store.kind})`);
  srv.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
