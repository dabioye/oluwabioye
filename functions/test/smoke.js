// End-to-end API test. Runs against a throwaway JSON store by default,
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
  // Each "visitor" gets its own forwarded IP so the code-guess limiter can be tested in isolation.
  const req = (p, o = {}) => fetch(base + p, { redirect: 'manual', ...o });
  const json = (m, b, cookie, extra = {}) => ({ method: m, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...extra }, body: JSON.stringify(b) });
  const login = async (kind, password) => {
    const r = await req('/api/login', json('POST', { kind, password }));
    return { status: r.status, cookie: (r.headers.get('set-cookie') || '').split(';')[0], body: await r.json() };
  };

  // Public content: church only, nothing about the traditional wedding
  let r = await req('/api/content');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /public/);
  const pub = await r.json();
  assert.equal(pub.invitationArt.church, '/img/invite-church.jpg');
  assert(!JSON.stringify(pub).includes('invite-trad'), 'trad card not exposed on the public site');
  assert.equal(pub.intro.home, true);

  // Church RSVP is closed
  r = await req('/api/rsvp', json('POST', { name: 'Bisi Ade', phone: '0803 111 2222', attending: 'yes', party: '3' }));
  assert.equal(r.status, 410);
  assert.equal((await store.publicRsvps()).length, 0);

  // Sessions
  assert.deepEqual(await (await req('/api/session')).json(), { role: null });
  assert.equal((await login('admin', 'bad')).status, 401);
  const a = await login('admin', 'test-admin');
  assert.equal(a.status, 200);
  const admin = a.cookie;
  assert(admin.startsWith('__session='), 'Firebase-compatible cookie name');
  assert.deepEqual(await (await req('/api/session', { headers: { cookie: admin } })).json(), { role: 'admin' });
  assert.equal((await req('/api/admin/guests')).status, 401);

  r = await req('/api/admin/guests', json('POST', { name: 'Tope Omidiji', phone: '08031234567', side: 'groom', driverCard: true }, admin));
  const g = await r.json();
  assert.match(g.code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert(g.message.includes(g.link) && g.message.includes('traditional'));
  r = await req('/api/admin/import', json('POST', { csv: 'Full Name,Phone,Side,Events\n"Ade, Jnr",0802,bride,church\nTope Omidiji,08031234567,groom,trad' }, admin));
  assert.deepEqual(await r.json(), { added: 1, skipped: ['Tope Omidiji'] });

  // Code entry on the invite site: forgiving input, right code never counts against the guest
  const guestIp = { 'X-Forwarded-For': '10.0.0.1' };
  r = await req('/api/invite/lookup', json('POST', { code: ` ${g.code.toLowerCase()} ` }, null, guestIp));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { code: g.code });

  // Private invitation
  r = await req('/api/invite/' + g.code, { headers: guestIp });
  assert.equal(r.status, 200);
  let inv = await r.json();
  assert.equal(inv.guest.name, 'Tope Omidiji');
  assert.equal(inv.guest.phone, undefined, 'contact details are not sent to the invitation page');
  assert(inv.qrSvg.startsWith('<svg'));
  assert.equal(inv.invite.art, '/img/invite-trad.jpg');
  assert(inv.invite.notes.length > 0);
  r = await req(`/api/invite/${g.code}/rsvp`, json('POST', { response: 'yes', note: 'Can’t wait' }));
  inv = await r.json();
  assert.equal(inv.guest.rsvp, 'yes');
  assert.equal(inv.guest.driverCard, true);
  r = await req('/api/invite/' + g.code, { headers: guestIp });
  assert.equal(r.status, 200);

  // Wrong codes are limited per visitor (10 per 15 minutes); other visitors are unaffected
  const guesser = { 'X-Forwarded-For': '10.9.9.9' };
  for (let i = 0; i < 10; i++) {
    r = await req('/api/invite/lookup', json('POST', { code: `ZZZZZ${'23456789AB'[i]}` }, null, guesser));
    assert.equal(r.status, 404, `miss ${i + 1}`);
  }
  r = await req('/api/invite/lookup', json('POST', { code: g.code }, null, guesser));
  assert.equal(r.status, 429, 'locked out after 10 wrong codes, even with a right one');
  assert.equal((await req('/api/invite/' + g.code, { headers: guesser })).status, 429, 'same limit on the invitation link');
  assert.equal((await req('/api/invite/' + g.code, { headers: guestIp })).status, 200, 'other visitors unaffected');

  // Gate
  assert.equal((await login('checkin', '0000')).status, 401);
  const gate = (await login('checkin', '4321')).cookie;
  r = await req('/api/checkin', json('POST', { code: base + '/c/' + g.code }, gate));
  assert.equal((await r.json()).status, 'ok');
  r = await req('/api/checkin', json('POST', { code: g.code }, gate));
  assert.equal((await r.json()).status, 'repeat');
  r = await req('/api/checkin', json('POST', { code: 'NOPE22' }, gate));
  assert.equal((await r.json()).status, 'missing');
  assert.equal((await req('/api/admin/guests', { headers: { cookie: gate } })).status, 401, 'gate cannot read admin');
  r = await req('/api/checkin/stats', { headers: { cookie: gate } });
  assert.equal((await r.json()).checkedIn, 1);

  r = await req('/api/admin/guests', { headers: { cookie: admin } });
  const d = await r.json();
  const t = d.guests.find((x) => x.code === g.code);
  assert(t.openedAt && t.openCount === 3 && t.checkedInAt && t.rsvp === 'yes');
  assert.equal(d.church.length, 0);
  r = await req('/api/admin/export.csv', { headers: { cookie: admin } });
  assert((await r.text()).includes('Ade, Jnr'));
  r = await req('/calendar/church.ics');
  assert((await r.text()).includes('DTSTART:20261217T090000Z'));

  // Website editor: content + photo upload
  const png = Buffer.from('ffd8ffe000104a464946', 'hex');
  r = await req('/api/admin/media', { method: 'POST', headers: { 'Content-Type': 'image/jpeg', cookie: admin }, body: png });
  const { url } = await r.json();
  assert.match(url, /^\/media\/[a-f0-9]{20}\.jpg$/);
  r = await req(url);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /immutable/);
  r = await req('/api/admin/site', json('PUT', { hero: { note: 'Hello <b>guests</b>', photo: url }, registryUrl: 'https://withjoy.com/sd', gallery: [{ src: url, caption: 'Us' }, { src: 'javascript:x' }], story: [{ when: '2019', title: 'We met', text: 'At church' }], intro: { home: false, invite: true } }, admin));
  const site = await r.json();
  assert.equal(site.gallery.length, 1, 'unsafe URLs dropped');
  assert.equal((await req('/api/admin/site', json('PUT', {}, gate))).status, 401);
  r = await req('/api/content');
  const c2 = await r.json();
  assert.equal(c2.hero.note, 'Hello <b>guests</b>', 'stored as text; the page escapes it');
  assert.equal(c2.registryUrl, 'https://withjoy.com/sd');
  assert.equal(c2.story[0].title, 'We met');
  assert.equal(c2.intro.home, false);

  // Two domains: links point at the invite site; the trad calendar is not offered on the public site
  process.env.BASE_URL = 'http://public.test';
  process.env.INVITE_URL = 'http://invite.test';
  r = await req('/api/admin/guests', { headers: { cookie: admin, 'X-Forwarded-Host': 'public.test' } });
  assert((await r.json()).guests[0].link.startsWith('http://invite.test/i/'));
  assert.equal((await req('/calendar/trad.ics', { headers: { 'X-Forwarded-Host': 'public.test' } })).status, 404);
  assert.equal((await req('/calendar/trad.ics', { headers: { 'X-Forwarded-Host': 'invite.test' } })).status, 200);

  r = await req('/api/logout', { method: 'POST', headers: { cookie: admin } });
  assert.match(r.headers.get('set-cookie'), /__session=;/);
  assert.equal((await req('/api/nope')).status, 404);

  console.log(`✓ all API checks passed (store: ${store.kind})`);
  srv.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
