// Church invitations sent from the admin: a person or a group, their name written on the church card.
// The church wedding is open to all, so there is no code or private link; the message points to the website.
const crypto = require('crypto');
const store = require('./store');

const COL = 'churchCards';
const str = (v, max) => String(v ?? '').trim().slice(0, max);

/** A clean entry, or { error } explaining what to fix. */
function clean(input = {}) {
  const card = {
    id: crypto.randomUUID(),
    name: str(input.name, 80).replace(/\s+/g, ' '),
    phone: str(input.phone, 30),
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

module.exports = { all, add, update, remove };
