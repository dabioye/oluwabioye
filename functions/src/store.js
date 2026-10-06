// Guest store with two interchangeable backends, same async API:
//   - Firestore: used on Firebase (or when STORE=firestore, e.g. against the emulator)
//   - JSON file: used for local development / any plain Node host
const crypto = require('crypto');

// No 0/O/1/I/L so codes are easy to read aloud and type at the gate.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');
const now = () => new Date().toISOString();

const FIELDS = ['name', 'phone', 'email', 'side', 'group', 'events', 'driverCard', 'channel', 'notes', 'table', 'cardDelivered'];
const toBool = (v) => v === true || /^(1|true|yes|y)$/i.test(String(v ?? '').trim());

function clean(input) {
  const out = {};
  for (const f of FIELDS) if (input[f] !== undefined) out[f] = input[f];
  if (out.name !== undefined) out.name = String(out.name).trim().slice(0, 120);
  if (out.phone !== undefined) out.phone = String(out.phone).trim().slice(0, 30);
  if (out.email !== undefined) out.email = String(out.email).trim().slice(0, 120);
  if (out.group !== undefined) out.group = String(out.group).trim().slice(0, 60);
  if (out.notes !== undefined) out.notes = String(out.notes).slice(0, 500);
  if (out.table !== undefined) out.table = String(out.table).slice(0, 20);
  if (out.side !== undefined && !['bride', 'groom', 'both'].includes(out.side)) out.side = 'both';
  if (out.channel !== undefined && !['whatsapp', 'email', 'physical', 'sms'].includes(out.channel)) out.channel = 'whatsapp';
  if (out.events !== undefined) {
    const ev = Array.isArray(out.events) ? out.events : String(out.events).split(/[,;| ]+/);
    out.events = ev.map((e) => String(e).trim().toLowerCase()).filter((e) => ['church', 'trad'].includes(e));
    if (!out.events.length) out.events = ['church', 'trad'];
  }
  if (out.driverCard !== undefined) out.driverCard = toBool(out.driverCard);
  if (out.cardDelivered !== undefined) out.cardDelivered = toBool(out.cardDelivered);
  return out;
}

function newGuest(input, code) {
  const d = clean(input);
  if (!d.name) throw new Error('Name is required');
  return {
    id: crypto.randomUUID(), code, name: d.name, phone: d.phone || '', email: d.email || '',
    side: d.side || 'both', group: d.group || '', events: d.events || ['church', 'trad'],
    driverCard: d.driverCard || false, channel: d.channel || 'whatsapp', table: d.table || '', notes: d.notes || '',
    cardDelivered: d.cardDelivered || false, sentAt: null, openedAt: null, openCount: 0,
    rsvp: 'pending', rsvpAt: null, rsvpNote: '', checkedInAt: null, createdAt: now(),
  };
}

function cleanPublicRsvp(input) {
  const name = String(input.name || '').trim().slice(0, 120);
  const phone = String(input.phone || '').trim().slice(0, 30);
  if (!name) throw new Error('Please enter your name.');
  if (!phone && !String(input.email || '').trim()) throw new Error('Please add a phone number or email so we can reach you.');
  const party = Math.min(10, Math.max(1, parseInt(input.party, 10) || 1));
  return {
    name, phone, email: String(input.email || '').trim().slice(0, 120),
    attending: input.attending === 'no' ? 'no' : 'yes',
    party: input.attending === 'no' ? 0 : party,
    note: String(input.note || '').slice(0, 500),
  };
}
const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-10);

// ---------------------------------------------------------------- JSON file
function jsonBackend() {
  const fs = require('fs');
  const path = require('path');
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
  const FILE = path.join(DATA_DIR, 'guests.json');
  let state = { guests: [], activity: [], publicRsvps: [], settings: {} };
  let queue = Promise.resolve();
  const limits = new Map();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(FILE)) state = { ...state, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  const persistNow = () => { fs.writeFileSync(FILE + '.tmp', JSON.stringify(state, null, 2)); fs.renameSync(FILE + '.tmp', FILE); };
  const persist = () => (queue = queue.then(persistNow).catch((e) => console.error('persist failed', e)));
  const log = (type, g, extra = '') => {
    state.activity.unshift({ at: now(), type, guestId: g?.id || null, name: g?.name || '', extra });
    state.activity = state.activity.slice(0, 500);
  };
  const find = (id) => state.guests.find((g) => g.id === id);
  const patch = async (id, p, logType, extra) => {
    const g = find(id);
    if (!g) return null;
    Object.assign(g, p);
    if (logType) log(logType, g, extra);
    await persist();
    return { ...g };
  };

  return {
    kind: 'json',
    async all() { return state.guests.map((g) => ({ ...g })); },
    async activity(n = 60) { return state.activity.slice(0, n); },
    async byCode(code) { const g = state.guests.find((x) => x.code === String(code || '').toUpperCase().trim()); return g ? { ...g } : null; },
    async byId(id) { const g = find(id); return g ? { ...g } : null; },
    async create(input) {
      let code; do code = randomCode(); while (state.guests.some((g) => g.code === code));
      const g = newGuest(input, code);
      state.guests.push(g); log('added', g); await persist();
      return { ...g };
    },
    async update(id, input) { return patch(id, clean(input)); },
    async remove(id) {
      const i = state.guests.findIndex((x) => x.id === id);
      if (i < 0) return false;
      log('removed', state.guests[i]); state.guests.splice(i, 1); await persist();
      return true;
    },
    async markSent(g, via) { return patch(g.id, { sentAt: g.sentAt || now() }, 'sent', via || g.channel); },
    async unmarkSent(g) { return patch(g.id, { sentAt: null }); },
    async setWa(id, p, logType, extra) { return patch(id, p, logType, extra); },
    async byWaId(wid) { const g = state.guests.find((x) => x.waMessageId === wid); return g ? { ...g } : null; },
    async markOpened(g) {
      const cur = find(g.id);
      return patch(g.id, { openCount: (cur.openCount || 0) + 1, openedAt: cur.openedAt || now() }, cur.openedAt ? null : 'opened');
    },
    async setRsvp(g, rsvp, note) { return patch(g.id, { rsvp, rsvpAt: now(), rsvpNote: String(note || '').slice(0, 500) }, 'rsvp', rsvp); },
    async checkIn(g) {
      const cur = find(g.id);
      if (cur.checkedInAt) return cur.checkedInAt;
      await patch(g.id, { checkedInAt: now() }, 'checkin');
      return null;
    },
    async undoCheckIn(g) { return patch(g.id, { checkedInAt: null }); },

    async savePublicRsvp(input) {
      const d = cleanPublicRsvp(input);
      const key = phoneKey(d.phone);
      const existing = key && state.publicRsvps.find((r) => phoneKey(r.phone) === key);
      if (existing) Object.assign(existing, d, { updatedAt: now() });
      else state.publicRsvps.push({ id: crypto.randomUUID(), ...d, createdAt: now(), updatedAt: now() });
      log('church', { name: d.name }, d.attending === 'yes' ? `yes · ${d.party}` : 'no');
      await persist();
      return { updated: !!existing };
    },
    async publicRsvps() { return state.publicRsvps.map((r) => ({ ...r })); },
    async removePublicRsvp(id) { state.publicRsvps = state.publicRsvps.filter((r) => r.id !== id); await persist(); return true; },

    async getSettings() { return JSON.parse(JSON.stringify(state.settings || {})); },
    async saveSettings(obj) { state.settings = obj; await persist(); },
    async saveMedia(buf, type) {
      const id = crypto.randomBytes(10).toString('hex') + (type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : '.jpg');
      fs.mkdirSync(path.join(DATA_DIR, 'media'), { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, 'media', id), buf);
      return id;
    },
    async readMedia(id) {
      const f = path.join(DATA_DIR, 'media', path.basename(id));
      return fs.existsSync(f) ? { buf: fs.readFileSync(f) } : null;
    },

    // Attempt counters for the invitation-code limiter. In memory: the JSON store is a single process.
    async attempts(key) {
      const a = limits.get(key);
      return a && a.resetAt > Date.now() ? a.count : 0;
    },
    async addAttempt(key, windowMs) {
      const a = limits.get(key);
      if (a && a.resetAt > Date.now()) a.count++;
      else limits.set(key, { count: 1, resetAt: Date.now() + windowMs });
      if (limits.size > 10000) limits.clear();
    },
  };
}

// ---------------------------------------------------------------- Firestore
function firestoreBackend() {
  const { initializeApp, getApps } = require('firebase-admin/app');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  if (!getApps().length) initializeApp();
  const db = getFirestore();
  const guests = db.collection('guests');
  const acts = db.collection('activity');
  const pub = db.collection('churchRsvps');
  const data = (snap) => (snap.exists ? snap.data() : null);
  const log = (type, g, extra = '') => acts.add({ at: now(), type, guestId: g?.id || null, name: g?.name || '', extra }).catch((e) => console.error(e));
  const patch = async (id, p, logType, extra) => {
    const ref = guests.doc(id);
    await ref.update(p);
    const g = data(await ref.get());
    if (logType) await log(logType, g, extra);
    return g;
  };

  return {
    kind: 'firestore',
    async all() { return (await guests.get()).docs.map((d) => d.data()); },
    async activity(n = 60) { return (await acts.orderBy('at', 'desc').limit(n).get()).docs.map((d) => d.data()); },
    async byCode(code) {
      const c = String(code || '').toUpperCase().trim();
      if (!/^[A-Z0-9]{4,12}$/.test(c)) return null;
      const s = await guests.where('code', '==', c).limit(1).get();
      return s.empty ? null : s.docs[0].data();
    },
    async byId(id) { return id ? data(await guests.doc(String(id)).get()) : null; },
    async create(input) {
      let code;
      // Codes are reserved in their own collection so two creates can never share one.
      for (;;) {
        code = randomCode();
        try { await db.collection('codes').doc(code).create({ at: now() }); break; } catch (e) { if (e.code !== 6) throw e; }
      }
      const g = newGuest(input, code);
      await guests.doc(g.id).set(g);
      await log('added', g);
      return g;
    },
    async update(id, input) {
      const ref = guests.doc(String(id));
      if (!(await ref.get()).exists) return null;
      return patch(id, clean(input));
    },
    async remove(id) {
      const ref = guests.doc(String(id));
      const g = data(await ref.get());
      if (!g) return false;
      await ref.delete();
      await db.collection('codes').doc(g.code).delete().catch(() => {});
      await log('removed', g);
      return true;
    },
    async markSent(g, via) { return patch(g.id, { sentAt: g.sentAt || now() }, 'sent', via || g.channel); },
    async unmarkSent(g) { return patch(g.id, { sentAt: null }); },
    async setWa(id, p, logType, extra) { return patch(id, p, logType, extra); },
    async byWaId(wid) {
      const s = await guests.where('waMessageId', '==', String(wid)).limit(1).get();
      return s.empty ? null : s.docs[0].data();
    },
    async markOpened(g) {
      const first = !g.openedAt;
      const p = { openCount: FieldValue.increment(1) };
      if (first) p.openedAt = now();
      return patch(g.id, p, first ? 'opened' : null);
    },
    async setRsvp(g, rsvp, note) { return patch(g.id, { rsvp, rsvpAt: now(), rsvpNote: String(note || '').slice(0, 500) }, 'rsvp', rsvp); },
    async checkIn(g) {
      // Transaction so two ushers scanning the same card at once can't both get "Welcome".
      const ref = guests.doc(g.id);
      const already = await db.runTransaction(async (tx) => {
        const cur = data(await tx.get(ref));
        if (cur.checkedInAt) return cur.checkedInAt;
        tx.update(ref, { checkedInAt: now() });
        return null;
      });
      if (!already) await log('checkin', g);
      return already;
    },
    async undoCheckIn(g) { return patch(g.id, { checkedInAt: null }); },

    async savePublicRsvp(input) {
      const d = cleanPublicRsvp(input);
      const key = phoneKey(d.phone);
      const ref = key ? pub.doc('p' + key) : pub.doc();
      const updated = (await ref.get()).exists;
      await ref.set({ id: ref.id, ...d, updatedAt: now(), ...(updated ? {} : { createdAt: now() }) }, { merge: true });
      await log('church', { name: d.name }, d.attending === 'yes' ? `yes · ${d.party}` : 'no');
      return { updated };
    },
    async publicRsvps() { return (await pub.get()).docs.map((d) => d.data()); },
    async removePublicRsvp(id) { await pub.doc(String(id)).delete(); return true; },

    // Site content edited in /admin/site
    async getSettings() { return data(await db.collection('settings').doc('site').get()) || {}; },
    async saveSettings(obj) { await db.collection('settings').doc('site').set(obj); },
    // Photos live in Firestore (each under 1 MB after in-browser resizing) and are served
    // through /media/<id> with a long CDN cache, so there is no separate Storage bucket to set up.
    async saveMedia(buf, type) {
      const id = crypto.randomBytes(10).toString('hex') + (type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : '.jpg');
      await db.collection('media').doc(id).set({ bytes: buf, type, size: buf.length, at: now() });
      return id;
    },
    async readMedia(id) {
      const d = data(await db.collection('media').doc(String(id)).get());
      return d ? { buf: Buffer.from(d.bytes) } : null;
    },

    // Attempt counters for the invitation-code limiter. Kept in Firestore so the limit holds across
    // function instances. expireAt lets an optional Firestore TTL policy tidy old documents.
    async attempts(key) {
      const d = data(await db.collection('limits').doc(key).get());
      return d && d.resetAt > Date.now() ? d.count : 0;
    },
    async addAttempt(key, windowMs) {
      const ref = db.collection('limits').doc(key);
      await db.runTransaction(async (tx) => {
        const d = data(await tx.get(ref));
        const t = Date.now();
        if (d && d.resetAt > t) tx.update(ref, { count: d.count + 1 });
        else tx.set(ref, { count: 1, resetAt: t + windowMs, expireAt: new Date(t + windowMs + 864e5) });
      });
    },
  };
}

const useFirestore = process.env.STORE === 'firestore' || (!!process.env.K_SERVICE && process.env.STORE !== 'json');
module.exports = useFirestore ? firestoreBackend() : jsonBackend();
