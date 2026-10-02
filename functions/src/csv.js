// Minimal RFC-4180 CSV parse/serialise (quotes, commas and newlines inside quotes).

const ALIASES = {
  'full name': 'name', guest: 'name', 'guest name': 'name',
  'phone number': 'phone', whatsapp: 'phone', mobile: 'phone',
  'e-mail': 'email',
  'driver': 'driverCard', 'driver card': 'driverCard', drivercard: 'driverCard', 'driver meal card': 'driverCard',
  category: 'group', relationship: 'group',
  event: 'events', invited: 'events',
  'table no': 'table', 'table number': 'table',
};

function rowsOf(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function parseCsv(text) {
  const rows = rowsOf(text.replace(/^﻿/, ''));
  if (!rows.length) return [];
  const head = rows[0].map((h) => {
    const k = h.trim().toLowerCase();
    return ALIASES[k] || (k === 'drivercard' ? 'driverCard' : k);
  });
  // No header row? Treat as "name, phone" lines.
  if (!head.includes('name')) return rows.map((r) => ({ name: r[0]?.trim(), phone: r[1]?.trim() || '' }));
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

const COLS = ['name', 'code', 'phone', 'email', 'side', 'group', 'events', 'driverCard', 'channel', 'table', 'sentAt', 'openedAt', 'openCount', 'rsvp', 'rsvpAt', 'rsvpNote', 'cardDelivered', 'checkedInAt', 'notes', 'link'];
function toCsv(items, cols = COLS) {
  const q = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(','), ...items.map((it) => cols.map((c) => q(it[c])).join(','))].join('\r\n');
}

module.exports = { parseCsv, toCsv };
