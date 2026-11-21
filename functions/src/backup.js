// A copy of everything, made once a day and kept for 14 days in the site's own database, plus a download for
// an off-site copy. It guards against a mistaken bulk change or deletion: any day's copy can be downloaded and
// restored from. Photos aren't included (they are uploads you still have), nor the gate's rate-limit counters.
const store = require('./store');

const KEEP = 14;
// A copy is stored in pieces: Firestore documents hold at most 1 MB, and 240,000 characters stay under that
// even when every character takes 4 bytes.
const PIECE = 240_000;
const INDEX = 'backup-index';
const today = () => new Date().toISOString().slice(0, 10);

/** Everything the site holds, as one object. The budget only when `withBudget` (it needs the couple's passcode). */
async function snapshot({ withBudget = true } = {}) {
  const [guests, activity, churchRsvps, settings, messages, leads, churchCards, wishes] = await Promise.all([
    store.all(),
    store.activity(500),
    store.publicRsvps(),
    store.getSettings(),
    store.messages({ limit: 100_000 }),
    store.leads(),
    store.budgetItems('churchCards'),
    store.budgetItems('wishes'),
  ]);
  const out = { at: new Date().toISOString(), guests, churchCards, churchRsvps, wishes, messages, activity, leads, settings };
  if (withBudget) {
    const [plan, items, funds] = await Promise.all([store.getDoc('budget'), store.budgetItems('budget'), store.budgetItems('funds')]);
    out.budget = { settings: plan, items, funds };
  }
  return out;
}

const index = async () => (await store.getDoc(INDEX)) || { days: [] };

let doneFor = '';
let running = null;
/** Makes today's copy if there isn't one yet. Cheap after the first call of the day. */
function daily() {
  const day = today();
  if (doneFor === day) return Promise.resolve();
  running ||= (async () => {
    const idx = await index();
    if (!idx.days.some((d) => d.day === day)) {
      const snap = await snapshot();
      const json = JSON.stringify(snap);
      const pieces = Math.max(1, Math.ceil(json.length / PIECE));
      for (let i = 0; i < pieces; i++) await store.setDoc(`backup-${day}-${i}`, { day, piece: i, pieces, json: json.slice(i * PIECE, (i + 1) * PIECE) });
      const days = [{ day, at: snap.at, pieces, size: json.length, guests: snap.guests.length }, ...idx.days.filter((d) => d.day !== day)];
      await store.setDoc(INDEX, { days: days.slice(0, KEEP) });
      for (const old of days.slice(KEEP)) for (let i = 0; i < old.pieces; i++) await store.deleteDoc(`backup-${old.day}-${i}`);
    }
    doneFor = day;
  })()
    // A failed backup must never stop the desk from working; it's tried again on the next request.
    .catch((e) => console.error('Daily backup failed:', e))
    .finally(() => (running = null));
  return running;
}

/** The copies kept, newest first. */
async function list() {
  return (await index()).days;
}

/** One day's copy, or null. */
async function read(day) {
  const entry = (await index()).days.find((d) => d.day === day);
  if (!entry) return null;
  let json = '';
  for (let i = 0; i < entry.pieces; i++) json += (await store.getDoc(`backup-${day}-${i}`))?.json || '';
  return JSON.parse(json);
}

module.exports = { snapshot, daily, list, read, KEEP };
