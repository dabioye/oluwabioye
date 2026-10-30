// Wishes left for the couple on the public site. Each one waits for an admin to approve it before it
// shows on the website; hidden or deleted ones never do.
const crypto = require('crypto');
const store = require('./store');

const COL = 'wishes';
const STATUSES = ['pending', 'approved', 'hidden'];
const str = (v, max) => String(v ?? '').trim().slice(0, max);

/** A clean new wish, or { error } explaining what to fix. */
function clean(input = {}) {
  const wish = {
    id: crypto.randomUUID(),
    name: str(input.name, 80),
    message: str(input.message, 600).replace(/\n{3,}/g, '\n\n'),
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  if (!wish.name) return { error: 'Please tell us your name.' };
  if (wish.message.length < 2) return { error: 'Please write a message for Sarah & Damilare.' };
  return { wish };
}

const newestFirst = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt));
async function all() {
  return (await store.budgetItems(COL)).sort(newestFirst);
}
/** What visitors see: approved wishes only, without the moderation details. */
async function approved() {
  return (await all()).filter((w) => w.status === 'approved').map((w) => ({ id: w.id, name: w.name, message: w.message, at: w.createdAt }));
}
async function add(input) {
  const { wish, error } = clean(input);
  if (error) return { error };
  return { wish: await store.saveBudgetItem(wish, COL) };
}
async function setStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error('Unknown status');
  const w = (await store.budgetItems(COL)).find((x) => x.id === id);
  if (!w) return null;
  return store.saveBudgetItem({ ...w, status, reviewedAt: new Date().toISOString() }, COL);
}
const remove = (id) => store.removeBudgetItem(id, COL);

module.exports = { STATUSES, clean, all, approved, add, setStatus, remove };
