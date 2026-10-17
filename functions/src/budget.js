// The couple's private wedding budget: a target, and the lines that make it up (estimate, actual cost,
// what has been paid, when the balance is due). Kept behind its own passcode on top of the admin password,
// so the planning team can use the invitation desk without seeing it.
const crypto = require('crypto');
const store = require('./store');

const CATEGORIES = [
  'Venue', 'Catering', 'Drinks', 'Cake', 'Decor & flowers', 'Photography & video', 'Attire', 'Hair & makeup',
  'Music & entertainment', 'Stationery & printing', 'Rings', 'Transport', 'Souvenirs', 'Traditional rites', 'Church', 'Other',
];

const str = (v, max) => String(v ?? '').trim().slice(0, max);
/** Whole naira, never negative or absurd. */
const money = (v) => {
  const n = Math.round(Number(String(v ?? '').replace(/[^\d.]/g, '')));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 1e12) : 0;
};
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v, 10)) ? str(v, 10) : '');

function cleanItem(input = {}, existing = null) {
  const pick = (k, fn) => (k in input ? fn(input[k]) : existing ? existing[k] : fn(undefined));
  const item = {
    id: existing?.id || crypto.randomUUID(),
    category: pick('category', (v) => str(v, 60) || 'Other'),
    item: pick('item', (v) => str(v, 120)),
    vendor: pick('vendor', (v) => str(v, 120)),
    estimate: pick('estimate', money),
    actual: pick('actual', money),
    paid: pick('paid', money),
    due: pick('due', date),
    notes: pick('notes', (v) => str(v, 1000)),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!item.item) throw new Error('Give the line a name, e.g. “Hall rental”.');
  return item;
}

// ---------- the passcode (only its scrypt hash is stored) ----------
const LOCK = 'budget-lock';
const hash = (pin, salt) => new Promise((ok, bad) => crypto.scrypt(String(pin), salt, 32, (e, k) => (e ? bad(e) : ok(k.toString('hex')))));
async function hasPasscode() {
  return !!(await store.getDoc(LOCK))?.hash;
}
async function setPasscode(pin) {
  if (String(pin || '').length < 6) throw new Error('Use at least 6 characters.');
  const salt = crypto.randomBytes(16).toString('hex');
  await store.setDoc(LOCK, { salt, hash: await hash(pin, salt), at: new Date().toISOString() });
}
async function checkPasscode(pin) {
  const lock = await store.getDoc(LOCK);
  if (!lock?.hash) return false;
  const got = Buffer.from(await hash(pin, lock.salt), 'hex');
  const want = Buffer.from(lock.hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// ---------- the budget ----------
async function settings() {
  const s = (await store.getDoc('budget')) || {};
  return { total: money(s.total) };
}
async function saveSettings(input) {
  const s = { total: money(input.total) };
  await store.setDoc('budget', s);
  return s;
}
async function items() {
  const all = await store.budgetItems();
  return all.sort((a, b) => a.category.localeCompare(b.category) || String(a.createdAt).localeCompare(String(b.createdAt)));
}
async function addItem(input) {
  return store.saveBudgetItem(cleanItem(input));
}
async function updateItem(id, input) {
  const existing = (await store.budgetItems()).find((b) => b.id === id);
  if (!existing) return null;
  return store.saveBudgetItem(cleanItem(input, existing));
}

module.exports = { CATEGORIES, hasPasscode, setPasscode, checkPasscode, settings, saveSettings, items, addItem, updateItem, removeItem: store.removeBudgetItem, cleanItem };
