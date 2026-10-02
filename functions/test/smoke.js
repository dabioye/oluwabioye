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

  // Public church RSVP + update by phone
  r = await req('/rsvp', form({ name: 'Bisi Ade', phone: '0803 111 2222', attending: 'yes', party: '3' }));
  assert.equal(r.status, 200);
  assert((await r.text()).includes('saved your place'));
  r = await req('/rsvp', form({ name: 'Bisi Ade', phone: '+234 803 111 2222', attending: 'yes', party: '2' }));
  assert((await r.text()).includes('earlier reply was updated'));
  r = await req('/rsvp', form({ name: '', phone: '' }));
  assert.equal(r.status, 400);
  r = await req('/rsvp', form({ name: 'Bot', phone: '1', website: 'spam' }));
  assert.equal(r.status, 200);
  const church = await store.publicRsvps();
  assert.equal(church.length, 1, 'deduped by phone, bot ignored');
  assert.equal(church[0].party, 2);

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
  assert.equal(d.church.length, 1);
  assert(d.activity.some((a) => a.type === 'church'));
  r = await req('/api/admin/export.csv', { headers: { cookie: admin } });
  assert((await r.text()).includes('Ade, Jnr'));
  r = await req('/api/admin/church.csv', { headers: { cookie: admin } });
  assert((await r.text()).includes('Bisi Ade'));
  r = await req('/calendar/church.ics');
  assert((await r.text()).includes('DTSTART:20261217T090000Z'));
  assert((await (await req('/robots.txt')).text()).includes('Disallow: /i/'));

  console.log(`✓ all smoke checks passed (store: ${store.kind})`);
  srv.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
