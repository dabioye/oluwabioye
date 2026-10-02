const cfg = require('./config');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const weekday = () =>
  new Date(cfg.date + 'T12:00:00+01:00').toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Africa/Lagos' });
const longDate = (iso) =>
  new Date(iso + 'T12:00:00+01:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
const telHref = (p) => 'tel:' + p.replace(/[^+\d]/g, '');
const waHref = (p) => 'https://wa.me/' + p.replace(/[^\d]/g, '');

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500;6..96,600&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@400;500;600&family=Pinyon+Script&display=swap';

// A leafy sprig, drawn once and reused in corners.
const sprig = (cls) => `<svg class="sprig ${cls}" viewBox="0 0 200 200" aria-hidden="true" fill="none">
  <path d="M6 6 C60 30 110 70 150 150" stroke="#b99662" stroke-width="1.4"/>
  ${[[30, 20, 30], [52, 34, 50], [74, 50, 25], [94, 70, 55], [112, 92, 30], [128, 114, 60]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y - 10}" rx="12" ry="4.5" transform="rotate(${r - 70} ${x} ${y - 10})" fill="#b99662" opacity=".75"/>
  <ellipse cx="${x - 6}" cy="${y + 10}" rx="12" ry="4.5" transform="rotate(${r + 10} ${x - 6} ${y + 10})" fill="#d2b07a" opacity=".55"/>`)
    .join('')}
  ${[[140, 128], [146, 138], [134, 140]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#d2b07a"/>`).join('')}
</svg>`;

const mono = `<img class="mono" src="/img/monogram-gold.png" alt="Sarah and Damilare’s intertwined monogram" width="160" height="132">`;
const monoNavy = `<img class="mono" src="/img/monogram-navy.png" alt="Sarah and Damilare’s intertwined monogram" width="160" height="132">`;
const rule = `<div class="rule" aria-hidden="true"><span>✦</span></div>`;

// Line icons for the bottom bar
const ICON = {
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/>',
  gift: '<rect x="3" y="9" width="18" height="4"/><path d="M5 13v8h14v-8M12 9v12M12 9c-1.5-4-6-4-6-1.5S10 9 12 9zm0 0c1.5-4 6-4 6-1.5S14 9 12 9z"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M14 9h3v3h-3z"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  invite: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${ICON[k]}</svg>`;

function bottomBar(items) {
  const list = items.filter(Boolean);
  if (!list.length) return '';
  return `<nav class="dock" aria-label="Quick links">${list
    .map((i) => `<a href="${esc(i.href)}"${i.external ? ' target="_blank" rel="noopener"' : ''}>${icon(i.icon)}<span>${esc(i.label)}</span></a>`)
    .join('')}</nav>`;
}

// Wax-seal envelope that opens to reveal the page. Rendered visible only when JS runs (no-JS sees the page).
function intro({ key, line1, line2 }) {
  return `<div class="intro" id="intro" data-key="${esc(key)}" hidden>
  <div class="door l"></div><div class="door r"></div>
  <div class="ribbon" aria-hidden="true"></div>
  <div class="intro-inner">
    <p class="intro-theme">THE MAKING OF ${esc(cfg.couple.surname)}</p>
    <p class="intro-for${key === 'home' ? ' intro-couple' : ''}">${line1}</p>
    <button type="button" class="seal-btn" id="sealBtn" aria-label="Open the invitation"><img src="/img/seal.jpg" alt=""></button>
    <p class="intro-hint">${esc(line2)}</p>
  </div>
</div>
<script>(function(){try{var i=document.getElementById('intro'),k='opened:'+i.dataset.key;
if(sessionStorage.getItem(k)||/[?&]saved=1/.test(location.search))return;i.hidden=false;document.documentElement.classList.add('intro-on');}catch(e){}})();</script>`;
}

// The designed invitation artwork, with the guest's name set into it where the design has one.
function invitationArt({ src, alt, name }) {
  if (!src) return '';
  const n = cfg.invitationArt.nameSlot;
  // Long names go on two balanced lines so they stay legible inside the slot.
  let lines = name ? [name] : [];
  if (name && name.length > 20 && name.includes(' ')) {
    const mid = name.length / 2;
    const cut = [...name.matchAll(/ /g)].map((m) => m.index).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
    lines = [name.slice(0, cut), name.slice(cut + 1)];
  }
  const longest = Math.max(0, ...lines.map((l) => l.length));
  const cap = lines.length > 1 ? n.maxSize * 0.7 : n.maxSize;
  const top = lines.length > 1 ? n.top - 0.7 : n.top;
  const size = name ? Math.min(cap, (n.maxSize * 13) / Math.max(13, longest)) : 0;
  return `<figure class="artcard">
    <button type="button" class="art" data-zoom aria-label="View the invitation full size">
      <img src="${esc(src)}" alt="${esc(alt)}" width="600" height="1010" decoding="async">
      ${name ? `<span class="art-name" style="top:${top}%;font-size:${size.toFixed(2)}cqw">${lines.map(esc).join('<br>')}</span>` : ''}
    </button>
    <figcaption>Tap the card to view it full size</figcaption>
  </figure>`;
}

function layout({ title, body, description = '', script = '', noindex = true, bodyClass = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${cfg.hero.photo && !noindex ? `<meta property="og:image" content="${esc(cfg.hero.photo)}">` : ''}
<meta name="theme-color" content="#0f1a2e">
<link rel="icon" href="/img/seal.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/css/site.css?v=20261001">
</head>
<body class="${esc(bodyClass)}">
${body}
<dialog class="lightbox" id="lightbox" aria-label="Full-size view"><button type="button" class="lb-close" aria-label="Close">×</button><div class="lb-stage" id="lbStage"></div><p class="lb-hint">Tap the image to zoom</p></dialog>
<script src="/js/site.js" defer></script>
${script}
</body>
</html>`;
}

function eventBlock(ev) {
  return `<div class="event">
    <div class="t">${esc(ev.time)}</div>
    <div>
      <h3>${esc(ev.name)}</h3>
      <p class="v">${esc(ev.venue)}<br>${esc(ev.venueLine2)}<br>${esc(ev.address)}</p>
      <div class="links"><a href="${esc(ev.mapUrl)}" target="_blank" rel="noopener">Directions</a><a href="/calendar/${ev.key}.ics">Add to calendar</a></div>
    </div>
  </div>`;
}

function storySection() {
  const s = cfg.story;
  const milestones = s.filter((x) => typeof x === 'object');
  const paras = s.filter((x) => typeof x === 'string');
  return `<section class="frame center" id="story">
    <div class="eyebrow">Our story</div>
    <h2 class="display m" style="margin-top:10px">The Making of ${esc(cfg.couple.surname)}</h2>
    <p class="script" style="margin:10px 0 14px">${esc(cfg.couple.bride)} &amp; ${esc(cfg.couple.groom)}</p>
    ${paras.length ? paras.map((p) => `<p class="lede">${esc(p)}</p>`).join('') : `<p class="lede">A new chapter begins as Sarah and Damilare bring their families, promises and futures together under one name: Oluwabioye.</p><p class="lede story-note">This is the beginning of our story. More moments will be shared here as the celebration draws near.</p>`}
    ${milestones.length ? `<ol class="timeline">${milestones.map((m) => `<li>
      ${m.photo ? `<button type="button" class="tl-photo" data-zoom aria-label="View photo: ${esc(m.title)}"><img src="${esc(m.photo)}" alt="${esc(m.title)}" loading="lazy"></button>` : ''}
      <div class="tl-when">${esc(m.when)}</div><h3>${esc(m.title)}</h3>${m.text ? `<p>${esc(m.text)}</p>` : ''}
    </li>`).join('')}</ol>` : ''}
  </section>`;
}

function gallerySection() {
  if (!cfg.gallery.length) return '';
  return `<section class="frame center" id="gallery">
    <div class="eyebrow">Gallery</div>
    <h2 class="display m" style="margin-top:10px">Moments so far</h2>
    <div class="gallery">${cfg.gallery.map((g, i) => `<button type="button" class="g-item" data-zoom aria-label="View photo ${i + 1}${g.caption ? ': ' + esc(g.caption) : ''}">
      <img src="${esc(g.src)}" alt="${esc(g.caption || `Sarah and Damilare, photo ${i + 1}`)}" loading="lazy">${g.caption ? `<span>${esc(g.caption)}</span>` : ''}</button>`).join('')}</div>
  </section>`;
}

function home({ rsvp = {}, form = {} } = {}) {
  const c = cfg.couple;
  const church = cfg.events.church;
  const maxParty = cfg.churchRsvp.maxParty || 6;
  const rsvpOpen = cfg.churchRsvp.open !== false;
  const photo = cfg.hero.photo;
  const hasStory = true;
  const coupleNames = `<div class="couple-lockup"><div class="couple-name"><span class="name-role">The bride</span><strong>${esc(c.bride)}</strong><small>${esc(c.brideFull)}</small></div><span class="couple-amp" aria-hidden="true">&amp;</span><div class="couple-name"><span class="name-role">The groom</span><strong>${esc(c.groom)}</strong><small>${esc(c.groomFull)}</small></div></div>`;
  const countdown = `<div class="countdown" id="countdown" data-at="${esc(church.startsAt)}" aria-live="off">
    <div><b data-u="d">—</b><small>Days</small></div><div><b data-u="h">—</b><small>Hours</small></div><div><b data-u="m">—</b><small>Minutes</small></div>
  </div>`;

  const hero = photo
    ? `<header class="hero-photo" style="--photo:url('${esc(photo)}')">
    <div class="hp-inner">
      ${coupleNames}
      <h1 class="display hp-theme">The Making of ${esc(c.surname)}</h1>
      <div class="date">${esc(weekday())} · ${esc(longDate(cfg.date))} · Lagos</div>
      ${cfg.hero.note ? `<p class="hp-note">${esc(cfg.hero.note)}</p>` : ''}
      ${countdown}
    </div>
  </header>`
    : `<header class="hero wrap">
  ${sprig('tl')}
  <div>${mono}</div>
  ${coupleNames}
  ${rule}<h1 class="display home-theme">The Making of <span>${esc(c.surname)}</span></h1>
  <div class="date" style="margin-top:18px">${esc(weekday())} · ${esc(longDate(cfg.date))} · Lagos</div>
  ${cfg.hero.note ? `<p class="lede" style="margin-top:14px;font-style:italic">${esc(cfg.hero.note)}</p>` : ''}
  ${countdown}
  ${sprig('br')}
</header>`;

  const body = `
${cfg.intro.home ? intro({ key: 'home', line1: `<span class="intro-name">${esc(c.bride)}</span><span class="intro-amp">&amp;</span><span class="intro-name">${esc(c.groom)}</span>`, line2: 'Tap the seal to open' }) : ''}
<nav class="nav wrap" aria-label="Sections">
  <a href="/invitation">Invitation</a><a href="/our-story">Our Story</a>${cfg.gallery.length ? '<a href="#gallery">Gallery</a>' : ''}${rsvpOpen ? '<a href="#rsvp">RSVP</a>' : ''}<a href="#gifts">Gift Registry</a>
</nav>
${hero}

<main class="wrap">
  <section class="center" id="invitation" style="padding-top:20px">
    <div class="eyebrow">You are invited</div>
    <h2 class="display m" style="margin-top:10px">The Making of ${esc(c.surname)}</h2>
    <p class="script" style="margin-top:8px">${esc(c.bride)} &amp; ${esc(c.groom)}</p>
    <div class="btn-row"><a class="btn" href="/invitation">Read the invitation</a></div>
  </section>

  <section class="frame center" id="day">
    <div class="eyebrow">Together with their families</div>
    <p class="lede" style="margin-top:8px">${esc(cfg.families.bride)}<br>and ${esc(cfg.families.groom)}</p>
    <div class="eyebrow" style="margin-top:14px">invite you to the wedding ceremony</div>
    <div class="day">${eventBlock(church)}</div>
    ${cfg.publicNotes.length ? `<ul class="notes">${cfg.publicNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    <div class="eyebrow" style="margin-top:22px">Colours of the day</div>
    <div class="swatches">${cfg.colours.map((x) => `<div class="swatch"><i style="background:${esc(x.hex)}"></i>${esc(x.name)}</div>`).join('')}</div>
  </section>

  ${storySection()}
  ${gallerySection()}

  ${rsvpOpen ? `<section class="frame center" id="rsvp">
    <div class="eyebrow">Kindly respond by ${esc(longDate(cfg.rsvpBy))}</div>
    <h2 class="display m" style="margin-top:10px">${rsvp.done ? 'Thank you' : 'RSVP for the wedding ceremony'}</h2>
    ${rsvp.done
      ? `<p class="lede">${rsvp.attending === 'no' ? 'We’ll miss you, and thank you for letting us know.' : `We’ve saved your place${rsvp.updated ? ' (your earlier reply was updated)' : ''}. See you at ${esc(church.time)} on ${esc(longDate(cfg.date))}.`}</p>
         <div class="btn-row"><a class="btn ghost" href="${esc(`/calendar/${church.key}.ics`)}">Add to calendar</a></div>`
      : `<form class="rsvp-form" method="post" action="/rsvp#rsvp">
      <div class="choice" role="radiogroup" aria-label="Will you attend?">
        <label><input type="radio" name="attending" value="yes" ${form.attending !== 'no' ? 'checked' : ''}><span>Joyfully accept</span></label>
        <label><input type="radio" name="attending" value="no" ${form.attending === 'no' ? 'checked' : ''}><span>Regretfully decline</span></label>
      </div>
      <div class="fields">
        <div class="full"><label for="r_name">Full name</label><input id="r_name" name="name" required maxlength="120" autocomplete="name" value="${esc(form.name)}"></div>
        <div><label for="r_phone">Phone / WhatsApp</label><input id="r_phone" name="phone" inputmode="tel" autocomplete="tel" maxlength="30" value="${esc(form.phone)}"></div>
        <div><label for="r_party">Number attending</label><select id="r_party" name="party">${Array.from({ length: maxParty }, (_, i) => `<option ${String(i + 1) === String(form.party) ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
        <div class="full"><label for="r_email">Email (optional)</label><input id="r_email" name="email" type="email" autocomplete="email" maxlength="120" value="${esc(form.email)}"></div>
        <div class="full"><label for="r_note">A note for the couple (optional)</label><textarea id="r_note" name="note" rows="3" maxlength="500">${esc(form.note)}</textarea></div>
        <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
      </div>
      <div class="btn-row"><button class="btn" type="submit">Send RSVP</button></div>
      ${rsvp.error ? `<p class="error" role="alert">${esc(rsvp.error)}</p>` : ''}
    </form>`}
  </section>` : ''}

  <section class="frame center registry" id="gifts">
    <div class="eyebrow">Gift registry</div>
    <h2 class="display m" style="margin-top:10px">Celebrate our new chapter</h2>
    <p class="lede" style="margin-top:10px">${esc(cfg.gifts.message)}</p>
    ${cfg.registryUrl ? `<div class="btn-row"><a class="btn" href="${esc(cfg.registryUrl)}" target="_blank" rel="noopener">View our registry on Joy</a></div>` : ''}
    ${cfg.gifts.accounts.length ? `<div class="accounts">${cfg.gifts.accounts.map((a) => `<div><b>${esc(a.bank)}</b><br>${esc(a.name)}<br><span style="font-variant-numeric:tabular-nums">${esc(a.number)}</span></div>`).join('')}</div>` : ''}
    ${!cfg.registryUrl && !cfg.gifts.accounts.length ? `<p class="registry-note">We’re grateful for your love and support.</p>` : ''}
  </section>

  <section class="center" style="padding-block:10px 20px">
    <div class="eyebrow">Questions</div>
    <div class="contacts">${cfg.contacts.map((p) => `<div><b>${esc(p.name)}</b><a href="${telHref(p.phone)}">${esc(p.phone)}</a><a href="${waHref(p.phone)}" target="_blank" rel="noopener" style="font:500 .7rem/1.6 var(--f-ui);letter-spacing:.2em;text-transform:uppercase">WhatsApp</a></div>`).join('')}</div>
  </section>
</main>
<footer>${esc(c.bride)} &amp; ${esc(c.groom)} · ${esc(longDate(cfg.date))}</footer>
${bottomBar([
    { href: '/our-story', icon: 'book', label: 'Our story' },
    cfg.gallery.length && { href: '#gallery', icon: 'camera', label: 'Gallery' },
    rsvpOpen && { href: '#rsvp', icon: 'mail', label: 'RSVP' },
    cfg.registryUrl ? { href: cfg.registryUrl, icon: 'gift', label: 'Registry', external: true } : { href: '#gifts', icon: 'gift', label: 'Registry' },
  ])}`;

  const script = `<script>
(function(){var el=document.getElementById('countdown');if(!el)return;var at=new Date(el.dataset.at).getTime();
function tick(){var s=Math.max(0,Math.floor((at-Date.now())/1000));var d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
el.querySelector('[data-u=d]').textContent=d;el.querySelector('[data-u=h]').textContent=h;el.querySelector('[data-u=m]').textContent=m;}
tick();setInterval(tick,30000);})();
</script>`;

  return layout({
    title: `${c.bride} & ${c.groom} · ${longDate(cfg.date)}`,
    description: `The wedding of ${c.brideFull} and ${c.groomFull}, ${weekday()} ${longDate(cfg.date)}, Lagos.`,
    body,
    script,
    noindex: false,
    bodyClass: 'home-page has-dock',
  });
}

function accessCard(guest, qrSvg, kind = 'access') {
  const driver = kind === 'driver';
  return `<div class="card${driver ? ' driver' : ''}">
    <img class="seal" src="/img/seal.jpg" alt="">
    <div class="eyebrow" style="margin-top:10px">The making of</div>
    <div class="display m">${esc(cfg.couple.surname)}</div>
    <div class="eyebrow" style="margin-top:4px">17 · 12 · 26</div>
    <div class="kind">${driver ? "Driver's meal card" : 'Access card'}</div>
    <div class="who">${esc(driver ? 'Driver of ' + guest.name : guest.name)}</div>
    ${driver ? '<div class="fine">Present at the drivers\' meal point</div>' : `<div class="qr">${qrSvg}</div><div class="codeline">${esc(guest.code)}</div><div class="fine">Admits one guest · Show at the entrance</div>`}
  </div>`;
}

function invite({ guest, qrSvg, justSaved = false }) {
  const c = cfg.couple;
  const events = guest.events.map((k) => cfg.events[k]).filter(Boolean);
  const first = guest.name.split(/\s+/)[0];
  const trad = cfg.events.trad;

  let rsvpBlock;
  if (guest.rsvp === 'yes') {
    rsvpBlock = `
      <span class="status yes">Attending</span>
      <p class="lede" style="margin-top:14px">${justSaved ? 'Thank you, we can’t wait to celebrate with you.' : 'You’re on the list.'} Save this card to your phone (screenshot works) and show it at the entrance.</p>
      <div id="card">${accessCard(guest, qrSvg)}</div>
      ${guest.driverCard ? accessCard(guest, '', 'driver') : ''}
      <details style="margin-top:20px"><summary style="cursor:pointer;font:500 .75rem/1 var(--f-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--ivory-dim)">Change my response</summary>${rsvpForm(guest)}</details>`;
  } else if (guest.rsvp === 'no') {
    rsvpBlock = `
      <span class="status no">Not attending</span>
      <p class="lede" style="margin-top:14px">We’ll miss you, and thank you for letting us know.</p>
      <details style="margin-top:10px"><summary style="cursor:pointer;font:500 .75rem/1 var(--f-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--ivory-dim)">Change my response</summary>${rsvpForm(guest)}</details>`;
  } else {
    rsvpBlock = `<div class="eyebrow">Kindly respond by ${esc(longDate(cfg.rsvpBy))}</div>${rsvpForm(guest)}`;
  }

  const body = `
${cfg.intro.invite ? intro({ key: 'i-' + guest.code, line1: `<span class="eyebrow">An invitation for</span><span class="script">${esc(guest.name)}</span>`, line2: 'Tap the seal to open' }) : ''}
<main class="wrap">
  <section class="center" id="invitation" style="padding-top:clamp(20px,5vw,40px)">
    ${invitationArt({ src: cfg.invitationArt.trad, name: guest.name, alt: `Invitation for ${guest.name} to The Making of ${c.surname}, traditional wedding, ${longDate(cfg.date)}, ${trad.time}, ${trad.venue}.` })}
  </section>

  <section class="frame center" id="details">
    ${sprig('tl')}
    <div>${mono}</div>
    <div class="names">${esc(c.bride)} &nbsp;+&nbsp; ${esc(c.groom)}</div>
    ${rule}
    <div class="eyebrow">Cordially invite</div>
    <p class="script" style="margin:8px 0">${esc(guest.name)}</p>
    <div class="eyebrow">to</div>
    <div class="eyebrow" style="margin-top:14px">The making of</div>
    <h1 class="display xl">${esc(c.surname)}</h1>
    <p class="lede" style="margin-top:16px">Together with their families,<br>${esc(cfg.families.bride)}<br>and ${esc(cfg.families.groom)}</p>
    <div class="date" style="font-family:var(--f-display);letter-spacing:.18em;margin-top:10px">${esc(weekday())} · ${esc(longDate(cfg.date))}</div>
    <div class="day">${events.map(eventBlock).join('')}</div>
    <ul class="notes">${cfg.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    <div class="eyebrow" style="margin-top:22px">Colours of the day · ${cfg.colours.map((x) => esc(x.name)).join(' & ')}</div>
  </section>

  <section class="frame center" id="respond">
    <h2 class="display m" style="margin-bottom:12px">${guest.rsvp === 'pending' ? `Will you join us, ${esc(first)}?` : 'Your RSVP'}</h2>
    ${rsvpBlock}
  </section>

  <p class="center"><a href="/" style="font:500 .75rem/1 var(--f-ui);letter-spacing:.22em;text-transform:uppercase;text-decoration:none">Visit our wedding website</a></p>
</main>
<footer>Questions? ${cfg.contacts.map((p) => `${esc(p.name)} ${esc(p.phone)}`).join(' · ')}</footer>
${bottomBar([
    { href: '#invitation', icon: 'invite', label: 'Invitation' },
    { href: '#respond', icon: 'mail', label: guest.rsvp === 'pending' ? 'RSVP' : 'My RSVP' },
    guest.rsvp === 'yes' && { href: '#card', icon: 'card', label: 'Access card' },
    { href: trad.mapUrl, icon: 'pin', label: 'Directions', external: true },
  ])}`;

  return layout({ title: `Invitation for ${guest.name} · ${c.bride} & ${c.groom}`, description: 'Your personal wedding invitation', body, bodyClass: 'has-dock' });
}

function rsvpForm(guest) {
  return `<form method="post" action="/i/${esc(guest.code)}/rsvp" style="max-width:420px;margin:16px auto 0;text-align:left">
    <div class="choice" role="radiogroup" aria-label="Your response">
      <label><input type="radio" name="response" value="yes" ${guest.rsvp !== 'no' ? 'checked' : ''}><span>Joyfully accept</span></label>
      <label><input type="radio" name="response" value="no" ${guest.rsvp === 'no' ? 'checked' : ''}><span>Regretfully decline</span></label>
    </div>
    <label for="note">A note for the couple (optional)</label>
    <textarea id="note" name="note" rows="3" maxlength="500">${esc(guest.rsvpNote)}</textarea>
    <div class="btn-row"><button class="btn" type="submit">Send RSVP</button></div>
  </form>`;
}

function simple(title, message, back = '/') {
  return layout({
    title,
    body: `<main class="wrap"><section class="frame center" style="margin-top:60px">${mono}${rule}<h1 class="display m">${esc(title)}</h1><p class="lede" style="margin-top:12px">${message}</p><div class="btn-row"><a class="btn ghost" href="${esc(back)}">Back</a></div></section></main>`,
  });
}

function storyPage() {
  const c = cfg.couple;
  const body = `<nav class="nav wrap" aria-label="Sections"><a href="/">Home</a><a href="/#invitation">Invitation</a><a href="/#gifts">Gift Registry</a></nav>
  <main class="wrap story-page">
    <header class="story-hero center"><div class="eyebrow">Our story</div><div class="story-monogram">${monoNavy}</div><p class="script">${esc(c.bride)} &amp; ${esc(c.groom)}</p><div class="rule"><span>✦</span></div>
      <h1 class="display story-title">The Making<br><span>of ${esc(c.surname)}</span></h1>
      <p class="story-intro">Two lives. Two families. One new chapter.</p>
    </header>
    <section class="story-copy frame center"><div class="eyebrow">A beginning, together</div>
      <p class="lede">Every union carries a story larger than the day itself. The Making of Oluwabioye celebrates Sarah and Damilare, the families who shaped them, and the future they begin together.</p>
      <p class="lede">On ${esc(longDate(cfg.date))}, we gather in Lagos to witness this new chapter and celebrate all that brought us here.</p>
      <p class="script story-signoff">With love,<br>${esc(c.bride)} &amp; ${esc(c.groom)}</p>
    </section>
    <section class="center story-end"><div class="eyebrow">Join us for the celebration</div><p class="lede">${esc(longDate(cfg.date))} · Lagos, Nigeria</p><div class="btn-row"><a class="btn" href="/#invitation">View the invitation</a><a class="btn ghost" href="/">Back to the wedding</a></div></section>
  </main><footer>${esc(c.bride)} &amp; ${esc(c.groom)} · ${esc(longDate(cfg.date))}</footer>`;
  return layout({ title: `Our Story · The Making of ${c.surname}`, description: `The story of ${c.bride} and ${c.groom}, and the making of Oluwabioye.`, body, noindex: false, bodyClass: 'story-page-body' });
}

function invitationPage() {
  const c = cfg.couple;
  const ev = cfg.events.church;
  const body = `<nav class="nav wrap" aria-label="Sections"><a href="/">Home</a><a href="/our-story">Our Story</a><a href="/#gifts">Gift Registry</a></nav>
  <main class="wrap invitation-page">
    <article class="invite-paper center">
      <div class="invite-ornament" aria-hidden="true">✦</div>
      <div class="eyebrow">Together with their families</div>
      <p class="invite-families">${esc(cfg.families.bride)}<br>and<br>${esc(cfg.families.groom)}</p>
      <p class="invite-request">request the pleasure of your company<br>at the wedding ceremony of</p>
      <div class="invite-names"><span>${esc(c.brideFull)}</span><i>&amp;</i><span>${esc(c.groomFull)}</span></div>
      <div class="rule"><span>✦</span></div>
      <div class="eyebrow theme-kicker">The Making of ${esc(c.surname)}</div>
      <p class="invite-date">${esc(weekday())}<br><strong>${esc(longDate(cfg.date))}</strong></p>
      <p class="invite-time">${esc(ev.time)}</p>
      <div class="invite-venue"><strong>${esc(ev.venue)}</strong><br>${esc(ev.venueLine2)}<br><span>${esc(ev.address)}</span></div>
      <div class="invite-actions"><a class="btn" href="${esc(ev.mapUrl)}" target="_blank" rel="noopener">Open live map</a><a class="btn ghost" href="/calendar/${ev.key}.ics">Add to calendar</a></div>
      <p class="invite-closing">We look forward to celebrating with you.</p>
    </article>
    ${cfg.churchRsvp.open !== false ? `<section class="center invite-rsvp"><div class="eyebrow">Kindly respond by ${esc(longDate(cfg.rsvpBy))}</div><div class="btn-row"><a class="btn" href="/#rsvp">RSVP</a></div></section>` : ''}
  </main><footer>${esc(c.bride)} &amp; ${esc(c.groom)} · ${esc(longDate(cfg.date))}</footer>`;
  return layout({ title: `Wedding Invitation · ${c.bride} & ${c.groom}`, description: `Invitation to the wedding ceremony of ${c.brideFull} and ${c.groomFull}, ${longDate(cfg.date)} at ${ev.address}.`, body, noindex: false, bodyClass: 'invitation-page-body' });
}

// Front page of the invite-only site. Reveals nothing about the event to people without a link.
function privateLanding() {
  const c = cfg.couple;
  return layout({
    title: `The Making of ${c.surname}`,
    description: 'Strictly by invitation.',
    body: `<main class="wrap"><section class="frame center" style="margin-top:clamp(40px,12vh,120px)">
      ${mono}${rule}
      <div class="eyebrow">Strictly by invitation</div>
      <h1 class="display l" style="margin-top:10px">The Making of ${esc(c.surname)}</h1>
      <p class="lede" style="margin-top:14px">This celebration is private. Please open the personal invitation link that was sent to you.</p>
      <p class="lede">Can’t find your link? ${cfg.contacts.map((p) => `${esc(p.name)} <a href="${waHref(p.phone)}" target="_blank" rel="noopener">${esc(p.phone)}</a>`).join(' or ')}</p>
    </section></main>`,
  });
}

module.exports = { privateLanding, layout, home, invite, invitationPage, storyPage, simple, esc, weekday, longDate, mono, rule, FONTS };
