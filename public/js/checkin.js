(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  let scanner = null;
  let busy = false;
  let lastCode = '';
  let lastAt = 0;

  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 401) { location.reload(); throw new Error('signed out'); }
    return r.json();
  }

  function show(res) {
    const el = $('#result');
    const g = res.guest;
    const extra = g ? [g.table && `Table ${esc(g.table)}`, g.driverCard && 'Driver meal card'].filter(Boolean).join(' · ') : '';
    const m = {
      ok: ['ok', 'Welcome', `${esc(g?.name)}${extra ? `<br><small>${extra}</small>` : ''}`],
      repeat: ['warn', 'Already checked in', `${esc(g?.name)} came in at ${g && time(res.already)}. This card may have been shared. Check ID before admitting.`],
      declined: ['bad', 'Declined invitation', `${esc(g?.name)} said they would not attend. Call the planning team.`],
      missing: ['bad', 'Not on the list', `No invitation matches “${esc(res.code)}”.`],
      undone: ['warn', 'Check-in undone', esc(g?.name)],
    }[res.status];
    el.className = `result show ${m[0]}`;
    el.innerHTML = `<b>${m[1]}</b><p>${m[2]}</p>${res.status === 'ok' ? `<p style="margin-top:10px"><button class="abtn sm" type="button" id="undo">Undo</button></p>` : ''}`;
    if (navigator.vibrate) navigator.vibrate(res.status === 'ok' ? 80 : [60, 60, 60]);
    const u = $('#undo');
    if (u) u.onclick = () => check(g.code, true);
    stats();
  }

  async function check(code, undo = false) {
    if (busy) return;
    busy = true;
    try { show(await post('/api/checkin', { code, undo })); }
    finally { busy = false; }
  }

  async function stats() {
    const r = await fetch('/api/checkin/stats');
    if (!r.ok) return;
    const s = await r.json();
    $('#gateStats').textContent = `${s.checkedIn} arrived of ${s.expected} expected`;
    $('#recent').innerHTML = s.recent.map((x) => `<li><span>${esc(x.name)}${x.table ? ` · T${esc(x.table)}` : ''}</span><small>${time(x.at)}</small></li>`).join('') || '<li><small>No arrivals yet.</small></li>';
  }

  $('#manual').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#code').value.trim();
    if (!v) return;
    if (/^[A-Za-z0-9]{6}$/.test(v) || v.includes('/c/')) { check(v); $('#code').value = ''; $('#matches').innerHTML = ''; }
    else search(v);
  });

  let st;
  $('#code').addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => search(e.target.value), 250); });
  async function search(q) {
    if (q.trim().length < 2 || /^[A-Z0-9]{6}$/.test(q)) { $('#matches').innerHTML = ''; return; }
    const r = await fetch('/api/checkin/search?q=' + encodeURIComponent(q));
    const list = await r.json();
    $('#matches').innerHTML = list.map((g) =>
      `<button type="button" data-code="${esc(g.code)}">${esc(g.name)} <small class="small">· ${g.checkedInAt ? 'arrived ' + time(g.checkedInAt) : g.rsvp === 'yes' ? 'attending' : g.rsvp === 'no' ? 'declined' : 'no reply'}${g.table ? ' · T' + esc(g.table) : ''}</small></button>`).join('');
  }
  $('#matches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-code]');
    if (!b) return;
    check(b.dataset.code);
    $('#matches').innerHTML = '';
    $('#code').value = '';
  });

  $('#camBtn').addEventListener('click', async () => {
    if (scanner) { await scanner.stop(); scanner = null; $('#reader').innerHTML = ''; $('#camBtn').textContent = 'Start camera'; return; }
    if (!window.Html5Qrcode) { alert('The scanner could not load. Type the code instead.'); return; }
    scanner = new Html5Qrcode('reader');
    try {
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 }, (text) => {
        const now = Date.now();
        if (text === lastCode && now - lastAt < 4000) return; // ignore the same card held in front of the lens
        lastCode = text; lastAt = now;
        check(text);
      });
      $('#camBtn').textContent = 'Stop camera';
    } catch (err) {
      scanner = null;
      alert('Camera unavailable: ' + err);
    }
  });

  stats();
  setInterval(() => { if (!document.hidden) stats(); }, 30000);
})();
