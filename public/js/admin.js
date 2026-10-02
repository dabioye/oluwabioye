(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let guests = [];
  let activity = [];
  let church = [];
  let stage = 'all';
  let editing = null;

  const STAGES = [
    { key: 'all', label: 'All guests' },
    { key: 'new', label: 'Not sent' },
    { key: 'sent', label: 'Sent, not opened' },
    { key: 'opened', label: 'Opened, no reply' },
    { key: 'yes', label: 'Attending' },
    { key: 'no', label: 'Declined' },
    { key: 'in', label: 'Checked in' },
  ];
  const PILL = { new: 'Not sent', sent: 'Sent', opened: 'Opened', yes: 'Attending', no: 'Declined', in: 'Checked in' };

  function stageOf(g) {
    if (g.checkedInAt) return 'in';
    if (g.rsvp === 'yes') return 'yes';
    if (g.rsvp === 'no') return 'no';
    if (g.openedAt) return 'opened';
    if (g.sentAt) return 'sent';
    return 'new';
  }

  async function api(path, opts = {}) {
    const res = await fetch('/api/admin' + path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) { location.href = '/admin/login'; throw new Error('signed out'); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  async function copy(text, done) {
    try { await navigator.clipboard.writeText(text); toast(done); }
    catch { window.prompt('Copy this:', text); }
  }

  function waNumber(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1); // Nigerian local format
    return d;
  }
  function sendHref(g) {
    const text = encodeURIComponent(g.message);
    if (g.channel === 'email' && g.email) return `mailto:${g.email}?subject=${encodeURIComponent('Invitation · Sarah & Damilare')}&body=${text}`;
    if (g.channel === 'sms' && g.phone) return `sms:${g.phone}?&body=${text}`;
    if (!g.phone) return '';
    return `https://wa.me/${waNumber(g.phone)}?text=${text}`;
  }

  // ---------- render ----------
  function render() {
    const counts = Object.fromEntries(STAGES.map((s) => [s.key, 0]));
    guests.forEach((g) => { counts.all++; counts[stageOf(g)]++; });
    const total = guests.length || 1;
    const sent = guests.filter((g) => g.sentAt || g.cardDelivered).length;
    const opened = guests.filter((g) => g.openedAt).length;
    const yes = guests.filter((g) => g.rsvp === 'yes').length;
    const no = guests.filter((g) => g.rsvp === 'no').length;
    const pending = guests.length - yes - no;
    const inn = counts.in;
    const tiles = [
      ['all', 'Guests', guests.length, 1, ''],
      ['sent', 'Invites sent', sent, sent / total, ''],
      ['opened', 'Opened', opened, opened / total, ''],
      ['yes', 'Attending', yes, yes / total, 'good'],
      ['no', 'Declined', no, no / total, 'bad'],
      ['opened', 'Awaiting reply', pending, pending / total, 'wait'],
      ['in', 'Checked in', inn, yes ? inn / yes : 0, 'good'],
    ];
    $('#funnel').innerHTML = tiles.map(([k, l, n, p, cls]) =>
      `<button type="button" class="stage ${cls}" data-stage="${k}"><span class="n">${n}</span><span class="l">${l}</span><span class="bar"><i style="width:${Math.round(p * 100)}%"></i></span></button>`).join('');

    const side = (s) => guests.filter((g) => g.side === s).length;
    const drivers = guests.filter((g) => g.driverCard).length;
    const driversYes = guests.filter((g) => g.driverCard && g.rsvp === 'yes').length;
    const printed = guests.filter((g) => g.cardDelivered).length;
    const church = guests.filter((g) => g.events.includes('church') && g.rsvp === 'yes').length;
    const trad = guests.filter((g) => g.events.includes('trad') && g.rsvp === 'yes').length;
    $('#sideStats').innerHTML = [
      `Bride’s side <b>${side('bride')}</b>`, `Groom’s side <b>${side('groom')}</b>`, `Shared <b>${side('both')}</b>`,
      `Driver cards <b>${driversYes}</b> of ${drivers}`, `Printed cards handed over <b>${printed}</b>`,
      `Expected at church <b>${church}</b>`, `Expected at reception <b>${trad}</b>`,
    ].map((s) => `<span>${s}</span>`).join('');

    $('#chips').innerHTML = STAGES.map((s) =>
      `<button type="button" class="chip" role="tab" data-stage="${s.key}" aria-selected="${s.key === stage}">${s.label}<b>${counts[s.key]}</b></button>`).join('');

    const q = $('#q').value.trim().toLowerCase();
    const sideF = $('#side').value;
    const rows = guests
      .filter((g) => stage === 'all' || stageOf(g) === stage)
      .filter((g) => !sideF || g.side === sideF)
      .filter((g) => !q || [g.name, g.phone, g.email, g.group, g.code, g.table].join(' ').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));

    const unsent = rows.filter((g) => stageOf(g) === 'new' && g.channel !== 'physical' && sendHref(g));
    $('#bulk').hidden = !(stage === 'new' && unsent.length);
    $('#bulkCount').textContent = `${unsent.length} ready to send`;

    $('#list').innerHTML = rows.length
      ? rows.map(rowHtml).join('')
      : `<div class="empty">${guests.length ? 'No guests match this filter.' : 'No guests yet. Add your first guest or import your list from a spreadsheet.'}</div>`;

    $('#activity').innerHTML = activity.length
      ? activity.slice(0, 40).map((a) => `<li><span>${esc(activityText(a))}</span><small>${ago(a.at)}</small></li>`).join('')
      : '<li><small>Sends, opens, RSVPs and arrivals will show here.</small></li>';

    $('#groups').innerHTML = [...new Set(guests.map((g) => g.group).filter(Boolean))].map((x) => `<option value="${esc(x)}">`).join('');
  }

  function rowHtml(g) {
    const st = stageOf(g);
    const href = sendHref(g);
    const chan = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', physical: 'Printed card' }[g.channel] || 'WhatsApp';
    const meta = [g.group, g.side === 'bride' ? 'Bride' : g.side === 'groom' ? 'Groom' : 'Shared', g.phone, g.code].filter(Boolean).join(' · ');
    const tags = [
      g.driverCard ? '<span class="tag">Driver</span>' : '',
      g.events.length === 1 ? `<span class="tag">${g.events[0] === 'church' ? 'Church only' : 'Reception only'}</span>` : '',
      g.cardDelivered ? '<span class="tag">Card given</span>' : '',
      g.table ? `<span class="tag">T${esc(g.table)}</span>` : '',
    ].join('');
    const sendBtn = g.channel === 'physical'
      ? `<button class="abtn sm" data-act="delivered" data-id="${g.id}" type="button">${g.cardDelivered ? 'Card given ✓' : 'Mark card given'}</button>`
      : href
        ? `<a class="abtn sm ${g.channel === 'whatsapp' ? 'wa' : ''}" data-act="send" data-id="${g.id}" href="${esc(href)}" target="_blank" rel="noopener">${g.sentAt ? 'Resend' : 'Send'} · ${chan}</a>`
        : `<button class="abtn sm" data-act="edit" data-id="${g.id}" type="button">Add ${g.channel === 'email' ? 'email' : 'phone'}</button>`;
    const title = g.rsvpNote ? ` title="${esc(g.rsvpNote)}"` : '';
    return `<div class="row">
      <div class="who" data-act="edit" data-id="${g.id}"><b>${esc(g.name)}${tags}</b><small>${esc(meta)}</small></div>
      <div><span class="pill s-${st}"${title}>${PILL[st]}</span>${g.openCount > 1 ? `<small class="small" style="display:block;margin-top:4px">opened ${g.openCount}×</small>` : ''}</div>
      <div class="acts">${sendBtn}<button class="abtn sm" data-act="copymsg" data-id="${g.id}" type="button">Copy message</button><button class="abtn sm" data-act="copylink" data-id="${g.id}" type="button">Link</button></div>
    </div>`;
  }

  function activityText(a) {
    return {
      added: `${a.name} added`,
      removed: `${a.name} removed`,
      sent: `Invite sent to ${a.name}${a.extra ? ` (${a.extra})` : ''}`,
      opened: `${a.name} opened their invitation`,
      rsvp: `${a.name} ${a.extra === 'yes' ? 'is attending' : a.extra === 'no' ? 'can’t attend' : 'reset to awaiting reply'}`,
      checkin: `${a.name} arrived`,
      church: `${a.name} replied to the church RSVP (${a.extra})`,
    }[a.type] || a.type;
  }
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function renderChurch() {
    const yes = church.filter((r) => r.attending === 'yes');
    const people = yes.reduce((n, r) => n + (Number(r.party) || 0), 0);
    $('#churchStats').innerHTML = [`Replies <b>${church.length}</b>`, `Attending <b>${yes.length}</b>`, `Expected people <b>${people}</b>`, `Declined <b>${church.length - yes.length}</b>`].map((x) => `<span>${x}</span>`).join('');
    const rows = [...church].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    $('#churchRows').innerHTML = rows.length ? rows.map((r) => `<tr>
      <td>${esc(r.name)}${r.email ? `<br><small class="small">${esc(r.email)}</small>` : ''}</td><td class="num">${esc(r.phone)}</td>
      <td><span class="pill ${r.attending === 'yes' ? 's-yes' : 's-no'}">${r.attending === 'yes' ? 'Attending' : 'Declined'}</span></td>
      <td class="num">${r.attending === 'yes' ? esc(r.party) : '–'}</td><td class="note">${esc(r.note)}</td><td><small class="small">${ago(r.updatedAt || r.createdAt)}</small></td>
      <td><button class="abtn sm danger" type="button" data-delchurch="${esc(r.id)}" aria-label="Remove ${esc(r.name)}">Remove</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="empty">No church RSVPs yet. They appear here as guests reply on the website.</td></tr>';
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-delchurch]');
    if (!b) return;
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Confirm'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Remove'; }, 3000); return; }
    api('/church/' + encodeURIComponent(b.dataset.delchurch), { method: 'DELETE' }).then(() => { toast('Removed'); refresh(); });
  });

  async function refresh() {
    const d = await api('/guests');
    guests = d.guests;
    activity = d.activity;
    church = d.church || [];
    render();
    renderChurch();
  }

  // ---------- events ----------
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-stage],[data-act]');
    if (!t) return;
    if (t.dataset.stage) { stage = t.dataset.stage; render(); return; }
    const g = guests.find((x) => x.id === t.dataset.id);
    const act = t.dataset.act;
    if (act === 'edit') return openGuest(g);
    if (act === 'copylink') return copy(g.link, 'Invitation link copied');
    if (act === 'copymsg') {
      await copy(g.message, 'Message copied. Paste it into WhatsApp or SMS.');
      if (!g.sentAt) markSent(g, 'copied');
      return;
    }
    if (act === 'send') { markSent(g, g.channel); return; } // link opens in new tab
    if (act === 'delivered') {
      const u = await api(`/guests/${g.id}`, { method: 'PATCH', body: { cardDelivered: !g.cardDelivered } });
      if (!g.sentAt && u.cardDelivered) await api(`/guests/${g.id}/sent`, { method: 'POST', body: { via: 'physical' } });
      refresh();
    }
  });

  async function markSent(g, via) {
    await api(`/guests/${g.id}/sent`, { method: 'POST', body: { via } });
    toast(`Marked as sent to ${g.name}`);
    refresh();
  }

  $('#bulkNext').addEventListener('click', () => {
    const next = guests.filter((g) => stageOf(g) === 'new' && g.channel !== 'physical' && sendHref(g)).sort((a, b) => a.name.localeCompare(b.name))[0];
    if (!next) return;
    window.open(sendHref(next), '_blank', 'noopener');
    markSent(next, next.channel);
  });

  $('#q').addEventListener('input', render);
  $('#side').addEventListener('change', render);

  // ---------- guest dialog ----------
  const dlg = $('#guestDlg');
  const form = $('#guestForm');
  function openGuest(g) {
    editing = g || null;
    form.reset();
    $('#guestErr').textContent = '';
    $('#guestTitle').textContent = g ? 'Edit guest' : 'Add guest';
    document.querySelectorAll('.edit-only').forEach((el) => (el.hidden = !g));
    if (g) {
      for (const k of ['name', 'phone', 'email', 'side', 'group', 'channel', 'table', 'notes', 'rsvp']) form.elements[k].value = g[k] ?? '';
      form.elements.ev_church.checked = g.events.includes('church');
      form.elements.ev_trad.checked = g.events.includes('trad');
      form.elements.driverCard.checked = !!g.driverCard;
      form.elements.cardDelivered.checked = !!g.cardDelivered;
      const bits = [`Code ${g.code}`];
      if (g.sentAt) bits.push(`sent ${ago(g.sentAt)}`);
      if (g.openedAt) bits.push(`opened ${ago(g.openedAt)}`);
      if (g.rsvpAt) bits.push(`replied ${ago(g.rsvpAt)}`);
      if (g.rsvpNote) bits.push(`note: “${g.rsvpNote}”`);
      if (g.checkedInAt) bits.push(`arrived ${new Date(g.checkedInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
      $('#guestMeta').innerHTML = esc(bits.join(' · ')) + ` · <a href="${esc(g.link)}" target="_blank">Preview invitation</a>`;
    } else {
      form.elements.side.value = 'both';
    }
    dlg.showModal();
    form.elements.name.focus();
  }
  $('#addBtn').addEventListener('click', () => openGuest(null));
  $('#cancelGuest').addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const body = {
      name: f.name.value, phone: f.phone.value, email: f.email.value, side: f.side.value, group: f.group.value,
      channel: f.channel.value, table: f.table.value, notes: f.notes.value,
      events: [f.ev_church.checked && 'church', f.ev_trad.checked && 'trad'].filter(Boolean),
      driverCard: f.driverCard.checked, cardDelivered: f.cardDelivered.checked,
    };
    if (!body.events.length) { $('#guestErr').textContent = 'Pick at least one event.'; return; }
    try {
      if (editing) {
        await api(`/guests/${editing.id}`, { method: 'PATCH', body });
        if (f.rsvp.value !== editing.rsvp) await api(`/guests/${editing.id}/rsvp`, { method: 'POST', body: { rsvp: f.rsvp.value } });
        toast('Saved');
      } else {
        const g = await api('/guests', { method: 'POST', body });
        toast(`${g.name} added · code ${g.code}`);
      }
      dlg.close();
      refresh();
    } catch (err) {
      $('#guestErr').textContent = err.message;
    }
  });

  $('#delBtn').addEventListener('click', () => {
    const c = $('#confirmDlg');
    $('#confirmMsg').textContent = `Remove ${editing.name}? Their invitation link will stop working.`;
    c.returnValue = '';
    c.showModal();
    c.addEventListener('close', async function once() {
      c.removeEventListener('close', once);
      if (c.returnValue !== 'yes') return;
      await api(`/guests/${editing.id}`, { method: 'DELETE' });
      dlg.close();
      toast('Guest removed');
      refresh();
    });
  });

  // ---------- import ----------
  const imp = $('#importDlg');
  $('#importBtn').addEventListener('click', () => { $('#importResult').textContent = ''; imp.showModal(); });
  $('#cancelImport').addEventListener('click', () => imp.close());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) $('#importText').value = await file.text();
  });
  $('#importForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const csv = $('#importText').value;
    if (!csv.trim()) { $('#importResult').textContent = 'Paste some rows or choose a file first.'; return; }
    const r = await api('/import', { method: 'POST', body: { csv } });
    $('#importResult').textContent = `Added ${r.added} guest${r.added === 1 ? '' : 's'}.` + (r.skipped.length ? ` Skipped ${r.skipped.length} already on the list.` : '');
    $('#importText').value = '';
    refresh();
  });

  refresh();
  setInterval(() => { if (!document.hidden && !dlg.open && !imp.open) refresh(); }, 60000);
})();
