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
  assert.deepEqual(await r.json(), { added: 1, skipped: ['Tope Omidiji'], whatsapp: null });

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
  assert.equal(typeof inv.invite.codeSlot.top, 'number', 'card says where to write the access code');
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

  // ---------- WhatsApp Cloud API (Meta mocked) ----------
  const wa = require('../src/whatsapp');
  const meta = { calls: [], template: {
    name: 'oluwabioye_invitation', language: 'en_GB', status: 'APPROVED', category: 'MARKETING',
    components: [
      { type: 'BODY', text: 'Dear {{1}}, … Kindly RSVP by {{2}}.', example: { body_text: [['Tope Omidiji', '30 November 2026']] } },
      { type: 'FOOTER', text: '#TheMakingOfOluwabioye' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'View invitation', url: 'http://invite.test/i/{{1}}', example: ['http://invite.test/i/B27CVE'] }] },
    ],
  } };
  meta.alert = {
    name: 'guest_reply_alert', language: 'en', status: 'APPROVED', category: 'UTILITY',
    components: [
      { type: 'BODY', text: 'Guest reply: {{1}} replied to their invitation: {{2}}', example: { body_text: [['Tope Omidiji', 'Thank you, we will be there!']] } },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Open inbox', url: 'http://public.test/{{1}}', example: ['http://public.test/admin/inbox'] }] },
    ],
  };
  const reply = (status, o) => ({ ok: status < 400, status, json: async () => o });
  wa._setFetch(async (url, opts) => {
    const u = new URL(url);
    u.pathname = u.pathname.replace(/^\/v\d+\.\d+/, '');
    const call = { path: u.pathname, auth: opts.headers.Authorization, body: opts.body };
    meta.calls.push(call);
    if (u.pathname === '/debug_token') return reply(200, { data: { is_valid: true, expires_at: 0, granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['WABA1'] }] } });
    if (u.pathname === '/WABA1/message_templates') return reply(200, { data: [meta.template, meta.alert].filter((t) => t.name === u.searchParams.get('name')) });
    if (u.pathname === '/PHONE1') return reply(200, { display_phone_number: '+234 807 269 2636', verified_name: 'Dabioye Solutions', quality_rating: 'GREEN' });
    if (u.pathname === '/PHONE1/media') return reply(200, { id: 'MEDIA1' });
    if (u.pathname === '/PHONE1/messages') {
      call.json = JSON.parse(opts.body);
      if (call.json.to === '2348000000000') return reply(400, { error: { message: 'Recipient not on WhatsApp' } });
      return reply(200, { messages: [{ id: 'wamid.' + meta.calls.length }] });
    }
    return reply(404, { error: { message: 'Unknown path ' + u.pathname } });
  });
  const lastSend = () => meta.calls.filter((c) => c.path === '/PHONE1/messages').at(-1).json;
  assert.equal(wa.toWaNumber('0803 123 4567'), '2348031234567');
  assert.equal(wa.toWaNumber('+44 7700 900123'), '447700900123');
  assert.equal(wa.toWaNumber('0803'), '');
  r = await req('/api/admin/whatsapp', { headers: { cookie: admin } });
  assert.deepEqual(await r.json(), { configured: false, ready: false, autoSend: false });
  r = await req('/api/admin/guests', json('POST', { name: 'No Api Yet', phone: '08030000001' }, admin));
  assert.equal((await r.json()).whatsapp, null, 'no send before API is configured');
  Object.assign(process.env, { WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_ID: 'PHONE1', WHATSAPP_WABA_ID: 'WABA1', WHATSAPP_APP_SECRET: 'appsecret', WHATSAPP_VERIFY_TOKEN: 'verifyme' });
  r = await req('/api/admin/guests', json('POST', { name: 'Not Auto', phone: '08030000002' }, admin));
  assert.equal((await r.json()).whatsapp, null, 'auto-send is off by default');

  // The desk's view: the approved template, read from Meta, and the message as one guest will read it
  r = await req(`/api/admin/whatsapp?guest=${g.id}`, { headers: { cookie: admin } });
  const st = await r.json();
  assert.equal(st.ready, true, JSON.stringify(st));
  assert.deepEqual(st.problems, []);
  assert.equal(st.template.language, 'en_GB');
  assert.equal(st.template.needsImage, false);
  assert.equal(st.phone.display_phone_number, '+234 807 269 2636');
  assert.equal(st.preview, 'Dear Tope Omidiji, … Kindly RSVP by 30 November 2026.\n\n#TheMakingOfOluwabioye');
  assert(meta.calls.every((c) => c.auth === 'Bearer tok'));

  await req('/api/admin/site', json('PUT', { waAutoSend: true }, admin));
  r = await req('/api/admin/guests', json('POST', { name: 'Ada Lovelace', phone: '0803 555 0000' }, admin));
  const ada = await r.json();
  assert(ada.whatsapp && ada.whatsapp.ok, 'auto-sent on add: ' + JSON.stringify(ada.whatsapp));
  assert.equal(ada.waStatus, 'accepted');
  assert(ada.sentAt);
  assert.deepEqual(lastSend(), {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: '2348035550000', type: 'template',
    template: { name: 'oluwabioye_invitation', language: { code: 'en_GB' }, components: [
      { type: 'body', parameters: [{ type: 'text', text: 'Ada Lovelace' }, { type: 'text', text: '30 November 2026' }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: ada.code }] },
    ] },
  });
  r = await req('/api/admin/import', json('POST', { csv: 'name,phone,channel\nBad Number,08000000000,whatsapp\nGood One,08031112223,whatsapp\nPrinted,08031112224,physical' }, admin));
  const imp = await r.json();
  assert.equal(imp.added, 3);
  assert.equal(imp.whatsapp.sent, 1);
  assert.deepEqual(imp.whatsapp.failed, ['Bad Number: Recipient not on WhatsApp']);
  r = await req('/api/admin/whatsapp/send-pending', json('POST', {}, admin));
  const pend = await r.json();
  assert.equal(pend.sent, 3, 'earlier guests picked up by send-pending: ' + JSON.stringify(pend));
  assert.equal(pend.remaining, 0);
  const all = (await (await req('/api/admin/guests', { headers: { cookie: admin } })).json());
  const bad = all.guests.find((x) => x.name === 'Bad Number');
  assert.deepEqual([bad.waStatus, bad.waError, bad.sentAt], ['failed', 'Recipient not on WhatsApp', null]);
  assert(all.activity.some((a) => a.type === 'wafailed' && a.name === 'Bad Number'));
  assert(!all.guests.find((x) => x.name === 'Printed').waMessageId, 'printed-card guests are skipped');

  // Webhook: Meta's challenge, then signed delivery receipts that never go backwards
  assert.equal(await (await req('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verifyme&hub.challenge=42')).text(), '42');
  assert.equal((await req('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42')).status, 403);
  const hook = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: ada.whatsapp.id, status: 'read', timestamp: '1790000000' }, { id: ada.whatsapp.id, status: 'delivered' }] } }] }] });
  const sig = 'sha256=' + require('crypto').createHmac('sha256', 'appsecret').update(hook).digest('hex');
  assert.equal((await req('/api/whatsapp/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=bad' }, body: hook })).status, 401);
  assert.equal((await req('/api/whatsapp/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig }, body: hook })).status, 200);
  assert.equal((await store.byId(ada.id)).waStatus, 'read', 'read is not downgraded by a late delivered');

  // Replies: saved to the guest's thread and the activity feed, with an alert to the couple's own phone
  process.env.WHATSAPP_ALERT_TO = '0801 111 2222';
  const signed = (o) => { const b = JSON.stringify(o); return { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + require('crypto').createHmac('sha256', 'appsecret').update(b).digest('hex') }, body: b }; };
  const incoming = (from, id, text, name, ts = Math.floor(Date.now() / 1000)) => ({ entry: [{ changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', contacts: [{ profile: { name }, wa_id: from }],
    messages: [{ from, id, timestamp: String(ts), type: 'text', text: { body: text } }],
  } }] }] });
  const sendsTo = (to) => meta.calls.filter((c) => c.path === '/PHONE1/messages' && c.json.to === to).map((c) => c.json);
  r = await req('/api/whatsapp/webhook', signed(incoming('2348035550000', 'wamid.in1', 'Thank you!\n\nWe’ll be there', 'Ada L')));
  assert.equal(r.status, 200);
  assert.equal((await req('/api/whatsapp/webhook', signed(incoming('2348035550000', 'wamid.in1', 'Thank you!\n\nWe’ll be there', 'Ada L')))).status, 200, 'retries are fine');
  const alerts = sendsTo('2348011112222');
  assert.equal(alerts.length, 1, 'one alert, even when Meta retries');
  assert.deepEqual(alerts[0].template, { name: 'guest_reply_alert', language: { code: 'en' }, components: [
    { type: 'body', parameters: [{ type: 'text', text: 'Ada Lovelace' }, { type: 'text', text: 'Thank you! We’ll be there' }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: `admin/inbox?thread=${ada.id}` }] },
  ] });
  assert((await store.byId(ada.id)).waLastInAt, 'the guest’s 24-hour window is open');
  await req('/api/whatsapp/webhook', signed(incoming('447700900123', 'wamid.in2', 'Who is this?', 'Stranger', Math.floor(Date.now() / 1000) + 1)));
  await req('/api/whatsapp/webhook', signed(incoming('2348031112223', 'wamid.in3', 'Late reply', 'Good', Math.floor(Date.now() / 1000) - 2 * 86400)));
  r = await req('/api/admin/inbox', { headers: { cookie: admin } });
  const inbox = await r.json();
  const byName = (list, name) => list.threads.find((t) => t.name === name);
  assert.deepEqual(inbox.threads.filter((t) => t.name !== 'Tope Omidiji').map((t) => [t.name, t.unread]), [['Stranger', 1], ['Ada Lovelace', 1], ['Good One', 1]]);
  assert.equal(byName(inbox, 'Stranger').thread, 'p:447700900123');
  // Tope's RSVP note from the invitation page came to the inbox too, but doesn't open a WhatsApp window
  const tope = byName(inbox, 'Tope Omidiji');
  assert.deepEqual([tope.thread, tope.last.text, tope.windowUntil], [g.id, 'RSVP: Joyfully accepts\n\nCan’t wait', null]);
  r = await req('/api/admin/guests', { headers: { cookie: admin } });
  assert((await r.json()).activity.some((a) => a.type === 'wareply' && a.name === 'Ada Lovelace' && a.extra.startsWith('Thank you!')));
  r = await req(`/api/admin/inbox/${ada.id}`, { headers: { cookie: admin } });
  const thread = await r.json();
  assert.deepEqual(thread.messages.map((m) => [m.dir, m.text]), [['in', 'Thank you!\n\nWe’ll be there']]);
  assert(new Date(thread.windowUntil) > new Date());
  assert.equal(byName(await (await req('/api/admin/inbox', { headers: { cookie: admin } })).json(), 'Ada Lovelace').unread, 0, 'opening a thread marks it read');
  r = await req(`/api/admin/inbox/${ada.id}/reply`, json('POST', { text: 'See you on the 17th!' }, admin));
  const out = await r.json();
  assert.equal(r.status, 200, JSON.stringify(out));
  assert.deepEqual(sendsTo('2348035550000').at(-1), { messaging_product: 'whatsapp', recipient_type: 'individual', to: '2348035550000', type: 'text', text: { body: 'See you on the 17th!', preview_url: true } });
  await req('/api/whatsapp/webhook', signed({ entry: [{ changes: [{ value: { statuses: [{ id: out.id, status: 'delivered' }] } }] }] }));
  r = await req(`/api/admin/inbox/${ada.id}`, { headers: { cookie: admin } });
  assert.deepEqual((await r.json()).messages.map((m) => [m.dir, m.text, m.status || '']), [['in', 'Thank you!\n\nWe’ll be there', ''], ['out', 'See you on the 17th!', 'delivered']]);
  assert.equal((await req('/api/admin/inbox/p:447700900123/reply', json('POST', { text: 'Hi' }, admin))).status, 200, 'numbers not on the list can be answered too');
  const goodId = byName(inbox, 'Good One').thread;
  r = await req(`/api/admin/inbox/${goodId}/reply`, json('POST', { text: 'Sorry for the delay' }, admin));
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /24-hour window has closed/);
  assert.equal((await req(`/api/admin/inbox/${goodId}`, { headers: { cookie: gate } })).status, 401);
  // A decline from the invitation page brings its reason to the inbox and the couple's phone
  r = await req(`/api/invite/${ada.code}/rsvp`, json('POST', { response: 'no', note: ' Travelling that week, so sorry ' }));
  assert.equal((await r.json()).guest.rsvp, 'no');
  assert.deepEqual(sendsTo('2348011112222').at(-1).template.components[0].parameters.map((p) => p.text), ['Ada Lovelace', 'RSVP: Regretfully declines Travelling that week, so sorry']);
  r = await req(`/api/admin/inbox/${ada.id}`, { headers: { cookie: admin } });
  const adaThread = await r.json();
  assert.equal(adaThread.messages.at(-1).text, 'RSVP: Regretfully declines\n\nTravelling that week, so sorry');
  assert(new Date(adaThread.windowUntil) > new Date(), 'her earlier WhatsApp message still keeps the window open');

  // A template that starts with an image gets each guest's card: from the desk, or drawn by the server
  meta.template = { ...meta.template, components: [{ type: 'HEADER', format: 'IMAGE' }, ...meta.template.components] };
  wa._reset();
  r = await req(`/api/admin/guests/${g.id}/whatsapp`, { method: 'POST', headers: { cookie: admin, 'Content-Type': 'image/jpeg' }, body: png });
  let one = await r.json();
  assert.equal(r.status, 200, JSON.stringify(one));
  const upload = meta.calls.filter((c) => c.path === '/PHONE1/media').at(-1);
  assert(upload.body instanceof FormData && (await upload.body.get('file').arrayBuffer()).byteLength === png.length, 'card uploaded');
  assert.deepEqual(lastSend().template.components[0], { type: 'header', parameters: [{ type: 'image', image: { id: 'MEDIA1' } }] });
  assert.equal(one.guest.waMessageId, one.id);
  // Without a card from the desk, the server draws the guest's card itself (here first without any artwork)
  r = await req(`/api/admin/guests/${g.id}/whatsapp`, { method: 'POST', headers: { cookie: admin } });
  one = await r.json();
  assert.equal(r.status, 400);
  assert.match(one.error, /Couldn’t draw Tope Omidiji’s card/);
  const art = require('fs').readFileSync(require('path').join(__dirname, '../../web/site-assets/invite/img/invite-trad.jpg'));
  r = await req('/api/admin/media', { method: 'POST', headers: { cookie: admin, 'Content-Type': 'image/jpeg' }, body: art });
  const artUrl = (await r.json()).url;
  await req('/api/admin/site', json('PUT', { invitationArt: { trad: artUrl }, nameFont: 'Cookie' }, admin));
  const cardUploaded = async () => {
    const f = meta.calls.filter((c) => c.path === '/PHONE1/media').at(-1).body.get('file');
    const meta2 = await require('sharp')(Buffer.from(await f.arrayBuffer())).metadata();
    return [meta2.format, meta2.width, meta2.height];
  };
  r = await req(`/api/admin/guests/${g.id}/whatsapp`, { method: 'POST', headers: { cookie: admin } });
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  assert.deepEqual(await cardUploaded(), ['jpeg', 1024, 1536], 'the server drew a full-size card');
  // Send all pending and automatic sending draw cards too; guests not invited to the traditional wedding get none
  await req('/api/admin/site', json('PUT', { waAutoSend: false }, admin));
  const churchOnly = await (await req('/api/admin/guests', json('POST', { name: 'Church Only', phone: '08030000010', events: ['church'] }, admin))).json();
  const waiting = await (await req('/api/admin/guests', json('POST', { name: 'Pending With Card', phone: '08030000013' }, admin))).json();
  r = await req('/api/admin/whatsapp/send-pending', json('POST', {}, admin));
  const pend2 = await r.json();
  assert.equal(r.status, 200, JSON.stringify(pend2));
  assert(pend2.sent >= 1 && (await store.byId(waiting.id)).waMessageId, 'pending guests sent with their cards');
  assert.deepEqual(await cardUploaded(), ['jpeg', 1024, 1536]);
  assert(!(await store.byId(churchOnly.id)).waMessageId, 'church-only guests are not sent the traditional card');
  await req('/api/admin/site', json('PUT', { waAutoSend: true }, admin));
  r = await req('/api/admin/guests', json('POST', { name: 'Auto With Card', phone: '08030000011' }, admin));
  const autoCard = await r.json();
  assert(autoCard.whatsapp && autoCard.whatsapp.ok, 'auto-send goes with a server-drawn card: ' + JSON.stringify(autoCard.whatsapp));
  assert.deepEqual(await cardUploaded(), ['jpeg', 1024, 1536]);
  r = await req('/api/admin/guests', json('POST', { name: 'Auto Church Only', phone: '08030000012', events: ['church'] }, admin));
  assert.equal((await r.json()).whatsapp, null, 'no traditional card for a church-only guest');
  assert.equal((await req(`/api/admin/guests/${g.id}/whatsapp`, { method: 'POST', headers: { cookie: gate } })).status, 401);
  await req('/api/admin/site', json('PUT', { waAutoSend: false }, admin));

  r = await req('/api/logout', { method: 'POST', headers: { cookie: admin } });
  assert.match(r.headers.get('set-cookie'), /__session=;/);
  assert.equal((await req('/api/nope')).status, 404);

  console.log(`✓ all API checks passed (store: ${store.kind})`);
  srv.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
