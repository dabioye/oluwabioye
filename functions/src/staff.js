const cfg = require('./config');
const { layout, esc, mono, weekday, longDate } = require('./pages');

const staffHead = '<link rel="stylesheet" href="/css/admin.css">';

function loginPage({ kind, error = '' }) {
  const admin = kind === 'admin';
  return layout({
    title: admin ? 'Invitations · Sign in' : 'Gate check-in · Sign in',
    body: `${staffHead}<main class="wrap"><section class="frame center" style="margin-top:60px;max-width:440px;margin-inline:auto">
      ${mono}
      <h1 class="display m" style="margin-top:12px">${admin ? 'Invitation desk' : 'Gate check-in'}</h1>
      <p class="lede">${admin ? 'For Sarah, Damilare and the planning team.' : 'For ushers at the entrance. Ask the planning team for the PIN.'}</p>
      <form method="post" action="${admin ? '/admin/login' : '/checkin/login'}" style="display:grid;gap:12px;margin-top:16px;text-align:left">
        <label for="password">${admin ? 'Password' : 'PIN'}</label>
        <input id="password" name="password" type="password" autocomplete="current-password" ${admin ? '' : 'inputmode="numeric"'} required autofocus>
        <button class="btn" type="submit">Sign in</button>
      </form>
      ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
    </section></main>`,
  });
}

function adminPage() {
  return layout({
    title: 'Invitation desk · Sarah & Damilare',
    body: `${staffHead}
<div class="adm">
  <header class="adm-top">
    <div class="brand"><img src="/img/seal.jpg" alt=""><div><b>Invitation desk</b><small>${esc(weekday())} ${esc(longDate(cfg.date))} · RSVP by ${esc(longDate(cfg.rsvpBy))}</small></div></div>
    <nav><a href="/" target="_blank">Website</a><a href="#church">Church RSVPs</a><a href="/checkin" target="_blank">Gate</a><a href="/api/admin/export.csv">Export guests</a><a href="/logout">Sign out</a></nav>
  </header>

  <h2 style="margin-top:18px">Traditional wedding · private invitations</h2>
  <section class="funnel" id="funnel" aria-label="Invitation progress"></section>

  <section class="side-stats" id="sideStats"></section>

  <div class="adm-grid">
    <section class="panel">
      <div class="toolbar">
        <input id="q" type="search" placeholder="Search name, phone, group or code" aria-label="Search guests">
        <select id="side" aria-label="Filter by side"><option value="">Both sides</option><option value="bride">Bride’s side</option><option value="groom">Groom’s side</option><option value="both">Shared</option></select>
        <button class="abtn primary" id="addBtn" type="button">Add guest</button>
        <button class="abtn" id="importBtn" type="button">Import</button>
      </div>
      <div class="chips" id="chips" role="tablist" aria-label="Filter by stage"></div>
      <div class="bulk" id="bulk" hidden>
        <span id="bulkCount"></span>
        <button class="abtn" type="button" id="bulkNext">Send next on WhatsApp</button>
      </div>
      <div id="list" class="list" aria-live="polite"></div>
    </section>

    <aside class="panel feed">
      <h2>Latest activity</h2>
      <ol id="activity"></ol>
    </aside>
  </div>

  <section class="panel" id="church" style="margin-top:16px">
    <div class="church-head"><h2 style="margin:0">Church wedding · public RSVPs</h2><a class="abtn sm" href="/api/admin/church.csv">Export</a></div>
    <div class="side-stats" id="churchStats" style="margin:10px 0 6px"></div>
    <div class="church-wrap"><table class="church-table"><thead><tr><th>Name</th><th>Phone</th><th>Reply</th><th>Party</th><th>Note</th><th>When</th><th></th></tr></thead><tbody id="churchRows"></tbody></table></div>
  </section>
</div>

<dialog id="guestDlg" class="dlg">
  <form id="guestForm" method="dialog">
    <h2 id="guestTitle">Add guest</h2>
    <div class="fgrid">
      <div class="full"><label for="f_name">Full name</label><input id="f_name" name="name" required></div>
      <div><label for="f_phone">WhatsApp / phone</label><input id="f_phone" name="phone" inputmode="tel" placeholder="0803 000 0000"></div>
      <div><label for="f_email">Email</label><input id="f_email" name="email" type="email"></div>
      <div><label for="f_side">Side</label><select id="f_side" name="side"><option value="bride">Bride</option><option value="groom">Groom</option><option value="both">Shared</option></select></div>
      <div><label for="f_group">Group</label><input id="f_group" name="group" list="groups" placeholder="Family, Church, Work…"><datalist id="groups"></datalist></div>
      <div><label for="f_channel">Send via</label><select id="f_channel" name="channel"><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option><option value="physical">Printed card</option></select></div>
      <div><label for="f_table">Table</label><input id="f_table" name="table"></div>
      <fieldset class="full"><legend>Invited to</legend>
        <label class="chk"><input type="checkbox" name="ev_church" id="f_ev_church" checked> Wedding ceremony (10 AM)</label>
        <label class="chk"><input type="checkbox" name="ev_trad" id="f_ev_trad" checked> Traditional &amp; reception (2 PM)</label>
      </fieldset>
      <fieldset class="full"><legend>Cards</legend>
        <label class="chk"><input type="checkbox" name="driverCard" id="f_driver"> Driver meal card</label>
        <label class="chk"><input type="checkbox" name="cardDelivered" id="f_delivered"> Printed access card handed over</label>
      </fieldset>
      <div class="full"><label for="f_notes">Notes</label><textarea id="f_notes" name="notes" rows="2"></textarea></div>
      <div class="full edit-only"><label for="f_rsvp">RSVP (set manually if they replied by phone)</label>
        <select id="f_rsvp" name="rsvp"><option value="pending">Awaiting reply</option><option value="yes">Attending</option><option value="no">Not attending</option></select></div>
    </div>
    <p class="edit-only small" id="guestMeta"></p>
    <div class="dlg-actions">
      <button type="button" class="abtn danger edit-only" id="delBtn">Remove guest</button>
      <span style="flex:1"></span>
      <button type="button" class="abtn" id="cancelGuest">Cancel</button>
      <button type="submit" class="abtn primary" id="saveGuest">Save</button>
    </div>
    <p class="error" id="guestErr" role="alert"></p>
  </form>
</dialog>

<dialog id="importDlg" class="dlg">
  <form id="importForm" method="dialog">
    <h2>Import guests</h2>
    <p class="small">Paste from Excel or Google Sheets, or choose a .csv file. The first row should be headers. Recognised columns:
    <code>name, phone, email, side (bride/groom/both), group, events (church trad), driverCard (yes/no), channel, table, notes</code>. Only <code>name</code> is required. Duplicates (same name and phone) are skipped.</p>
    <input type="file" id="importFile" accept=".csv,text/csv,.tsv,.txt" aria-label="CSV file">
    <label for="importText" style="margin-top:10px">Or paste rows</label>
    <textarea id="importText" rows="8" placeholder="name,phone,side,group,driverCard&#10;Tope Omidiji,08031234567,groom,Friends,yes"></textarea>
    <div class="dlg-actions"><span style="flex:1"></span><button type="button" class="abtn" id="cancelImport">Cancel</button><button type="submit" class="abtn primary">Import</button></div>
    <p class="small" id="importResult" role="status"></p>
  </form>
</dialog>

<dialog id="confirmDlg" class="dlg small-dlg"><form method="dialog"><p id="confirmMsg"></p><div class="dlg-actions"><span style="flex:1"></span><button class="abtn" value="no">Cancel</button><button class="abtn danger" value="yes">Remove</button></div></form></dialog>

<div class="toast" id="toast" role="status" aria-live="polite"></div>
`,
    script: '<script src="/js/admin.js" defer></script>',
  });
}

function checkinPage() {
  return layout({
    title: 'Gate check-in · Sarah & Damilare',
    body: `${staffHead}
<div class="adm gate">
  <header class="adm-top">
    <div class="brand"><img src="/img/seal.jpg" alt=""><div><b>Gate check-in</b><small id="gateStats">Loading…</small></div></div>
    <nav><a href="/logout">Sign out</a></nav>
  </header>
  <section class="panel">
    <div id="reader" class="reader"></div>
    <div class="btn-row" style="margin-top:12px"><button class="abtn primary" id="camBtn" type="button">Start camera</button></div>
    <form id="manual" class="toolbar" style="margin-top:14px">
      <input id="code" class="code" maxlength="60" placeholder="Code or guest name" autocomplete="off" aria-label="Invitation code or guest name">
      <button class="abtn primary" type="submit">Check in</button>
    </form>
    <div id="matches" class="matches"></div>
  </section>
  <section id="result" class="result" aria-live="assertive"></section>
  <section class="panel"><h2>Just arrived</h2><ol id="recent" class="recent"></ol></section>
</div>`,
    script: '<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script><script src="/js/checkin.js" defer></script>',
  });
}

function checkinResultPage({ status, guest, already, code }) {
  const map = {
    ok: ['ok', 'Welcome', guest && `${esc(guest.name)} is checked in.${guest.table ? ` Table ${esc(guest.table)}.` : ''}${guest.driverCard ? ' Has a driver meal card.' : ''}`],
    repeat: ['warn', 'Already checked in', guest && `${esc(guest.name)} was checked in at ${new Date(already).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}. This card may have been shared.`],
    declined: ['bad', 'Declined invitation', guest && `${esc(guest.name)} said they would not attend. Call the planning team before admitting.`],
    missing: ['bad', 'Not on the list', `No invitation matches ${esc(code)}.`],
  }[status];
  return layout({
    title: map[1],
    body: `${staffHead}<div class="adm gate"><section class="result show ${map[0]}"><b>${map[1]}</b><p>${map[2]}</p></section><p class="center"><a class="abtn primary" href="/checkin">Scan next guest</a></p></div>`,
  });
}

module.exports = { loginPage, adminPage, checkinPage, checkinResultPage };
