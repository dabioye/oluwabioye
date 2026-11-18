// Church invitations sent from the admin: a person or a group, their name written on the church card.
// The church wedding is open to all, so there is no code or private link; the message points to the website.
const crypto = require('crypto');
const store = require('./store');

const COL = 'churchCards';
const str = (v, max) => String(v ?? '').trim().slice(0, max);

/** A clean entry, or { error } explaining what to fix. */
/** A phone number typed at the end of the name ("Shalom Guard 0802 144 1005") goes in the number instead. */
const TRAILING_PHONE = /^(.*?)[\s,;]+(\+?\d[\d\s()-]{6,}\d)$/;
function splitPhone(name, phone) {
  const m = !phone && name.match(TRAILING_PHONE);
  return m && m[1].trim() ? { name: m[1].trim(), phone: m[2] } : { name, phone };
}

function clean(input = {}) {
  const { name, phone } = splitPhone(str(input.name, 80).replace(/\s+/g, ' '), str(input.phone, 30));
  const card = {
    id: crypto.randomUUID(),
    name,
    phone,
    sentAt: null,
    createdAt: new Date().toISOString(),
  };
  if (!card.name) return { error: 'Type the name of the person or group.' };
  return { card };
}

async function all() {
  return (await store.budgetItems(COL)).sort((a, b) => a.name.localeCompare(b.name));
}
/** Add one or more ("Name, phone" a line). Blank lines are skipped. */
async function add(list) {
  const cards = [];
  for (const input of list) {
    const { card, error } = clean(input);
    if (error) return { error };
    cards.push(card);
  }
  if (!cards.length) return { error: 'Type the name of the person or group.' };
  for (const c of cards) await store.saveBudgetItem(c, COL);
  return { cards };
}
async function update(id, input) {
  const c = (await store.budgetItems(COL)).find((x) => x.id === id);
  if (!c) return null;
  const next = { ...c };
  if ('name' in input) next.name = str(input.name, 80).replace(/\s+/g, ' ') || c.name;
  if ('phone' in input) next.phone = str(input.phone, 30);
  if ('sent' in input) next.sentAt = input.sent ? c.sentAt || new Date().toISOString() : null;
  return store.saveBudgetItem(next, COL);
}
const remove = (id) => store.removeBudgetItem(id, COL);
const byId = async (id) => (await store.budgetItems(COL)).find((x) => x.id === id) || null;

/** Record a send through WhatsApp Business: the message id to follow, or why it failed. */
async function recordSend(c, r) {
  const at = new Date().toISOString();
  const next = r.ok
    ? { ...c, waMessageId: r.id, waStatus: 'accepted', waError: '', waSentAt: at, sentAt: c.sentAt || at }
    : { ...c, waStatus: 'failed', waError: String(r.error || '').slice(0, 300) };
  return store.saveBudgetItem(next, COL);
}

/** A delivery status from WhatsApp for one of these; statuses never move backwards (except to failed). */
async function applyStatus(st, rank) {
  const c = (await store.budgetItems(COL)).find((x) => x.waMessageId === st.id);
  if (!c) return null;
  if (st.status !== 'failed' && (rank[st.status] ?? -1) <= (rank[c.waStatus] ?? -1)) return c;
  const error = st.status === 'failed' ? ((st.errors || [])[0] || {}).title || 'Delivery failed' : '';
  return store.saveBudgetItem({ ...c, waStatus: st.status, waError: error }, COL);
}

module.exports = { all, add, update, remove, byId, recordSend, applyStatus };
