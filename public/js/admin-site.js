(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let data = null;
  let dirty = false;

  const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); };
  const mark = () => { dirty = true; $('#dirty').textContent = 'Unsaved changes'; };
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  async function api(path, opts = {}) {
    const r = await fetch('/api/admin' + path, { credentials: 'same-origin', ...opts });
    if (r.status === 401) { location.href = '/admin/login'; throw new Error('Signed out'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Upload failed. Try a smaller photo.');
    return j;
  }

  // Resize in the browser so every photo lands well under the 1 MB limit.
  async function shrink(file, maxEdge = 1800) {
    const img = await createImageBitmap(file).catch(() => null);
    if (!img) throw new Error(`${file.name} isn’t an image this browser can read. Try a JPEG.`);
    const k = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.84, 0.74, 0.62, 0.5]) {
      const b = await new Promise((res) => c.toBlob(res, 'image/jpeg', q));
      if (b.size < 900 * 1024) return b;
    }
    throw new Error(`${file.name} is still too large after resizing.`);
  }
  async function upload(file) {
    const blob = await shrink(file);
    return (await api('/media', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob })).url;
  }

  const get = (path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), data);
  const set = (path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => (o[k] ||= {}), data)[last] = v; };

  // Single-photo fields (couple photo, invitation cards)
  function renderPhoto(el) {
    const f = el.dataset.field, src = get(f);
    el.innerHTML = `<div class="small">${esc(el.dataset.label)}</div>
      <div class="ed-thumb">${src ? `<img src="${esc(src)}" alt="">` : '<span>No photo yet</span>'}</div>
      <div class="ed-acts"><label class="abtn sm">${src ? 'Replace' : 'Upload'}<input type="file" accept="image/*" hidden></label>
      ${src ? '<button type="button" class="abtn sm danger" data-clear>Remove</button>' : ''}</div>`;
    el.querySelector('input').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      el.querySelector('.ed-thumb').innerHTML = '<span>Uploading…</span>';
      try { set(f, await upload(file)); mark(); } catch (err) { toast(err.message); }
      renderPhoto(el);
    });
    el.querySelector('[data-clear]')?.addEventListener('click', () => { set(f, ''); mark(); renderPhoto(el); });
  }

  function renderStory() {
    const list = data.story;
    $('#story').innerHTML = list.length ? list.map((m, i) => `<div class="ed-item" data-i="${i}">
      <div class="ed-row"><input data-k="when" placeholder="When (e.g. 2019)" value="${esc(m.when)}" aria-label="When"><input data-k="title" placeholder="Title" value="${esc(m.title)}" aria-label="Title"></div>
      <textarea data-k="text" rows="3" placeholder="What happened" aria-label="Story text">${esc(m.text)}</textarea>
      <div class="ed-acts">${m.photo ? `<img class="mini" src="${esc(m.photo)}" alt="">` : ''}
        <label class="abtn sm">${m.photo ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" hidden data-photo></label>
        ${m.photo ? '<button type="button" class="abtn sm" data-nophoto>Remove photo</button>' : ''}
        <button type="button" class="abtn sm" data-up ${i ? '' : 'disabled'}>Move up</button>
        <button type="button" class="abtn sm danger" data-del>Delete</button></div></div>`).join('')
      : '<p class="small">No story yet. Add your first moment: how you met, the proposal, and so on.</p>';
  }
  $('#story').addEventListener('input', (e) => { const it = e.target.closest('[data-i]'); if (!it || !e.target.dataset.k) return; data.story[it.dataset.i][e.target.dataset.k] = e.target.value; mark(); });
  $('#story').addEventListener('click', (e) => {
    const it = e.target.closest('[data-i]'); if (!it) return; const i = +it.dataset.i;
    if (e.target.matches('[data-del]')) { data.story.splice(i, 1); mark(); renderStory(); }
    if (e.target.matches('[data-up]') && i) { [data.story[i - 1], data.story[i]] = [data.story[i], data.story[i - 1]]; mark(); renderStory(); }
    if (e.target.matches('[data-nophoto]')) { data.story[i].photo = ''; mark(); renderStory(); }
  });
  $('#story').addEventListener('change', async (e) => {
    if (!e.target.matches('[data-photo]')) return;
    const i = +e.target.closest('[data-i]').dataset.i;
    try { data.story[i].photo = await upload(e.target.files[0]); mark(); } catch (err) { toast(err.message); }
    renderStory();
  });
  $('#addStory').addEventListener('click', () => { data.story.push({ when: '', title: '', text: '', photo: '' }); mark(); renderStory(); $('#story .ed-item:last-child input').focus(); });

  function renderGallery() {
    $('#gallery').innerHTML = data.gallery.length ? data.gallery.map((g, i) => `<div class="ed-g" data-i="${i}">
      <img src="${esc(g.src)}" alt=""><input data-cap placeholder="Caption (optional)" value="${esc(g.caption)}" aria-label="Caption">
      <div class="ed-acts"><button type="button" class="abtn sm" data-left ${i ? '' : 'disabled'} aria-label="Move earlier">←</button><button type="button" class="abtn sm danger" data-del>Remove</button></div></div>`).join('')
      : '<p class="small">No photos yet. The first photo shows large on the website.</p>';
  }
  $('#gallery').addEventListener('input', (e) => { if (e.target.matches('[data-cap]')) { data.gallery[e.target.closest('[data-i]').dataset.i].caption = e.target.value; mark(); } });
  $('#gallery').addEventListener('click', (e) => {
    const it = e.target.closest('[data-i]'); if (!it) return; const i = +it.dataset.i;
    if (e.target.matches('[data-del]')) { data.gallery.splice(i, 1); mark(); renderGallery(); }
    if (e.target.matches('[data-left]') && i) { [data.gallery[i - 1], data.gallery[i]] = [data.gallery[i], data.gallery[i - 1]]; mark(); renderGallery(); }
  });
  $('#galleryFiles').addEventListener('change', async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    let n = 0;
    for (const f of files) {
      toast(`Uploading ${++n} of ${files.length}…`);
      try { data.gallery.push({ src: await upload(f), caption: '' }); mark(); renderGallery(); } catch (err) { toast(err.message); }
    }
    toast(`${n} photo${n === 1 ? '' : 's'} added. Remember to save.`);
  });

  const simple = [['heroNote', 'hero.note'], ['registryUrl', 'registryUrl'], ['giftsMessage', 'giftsMessage'], ['rsvpBy', 'rsvpBy']];
  function fill() {
    simple.forEach(([id, p]) => { $('#' + id).value = get(p) || ''; });
    $('#publicNotes').value = (data.publicNotes || []).join('\n');
    $('#introHome').checked = !!data.intro?.home; $('#introInvite').checked = !!data.intro?.invite;
    document.querySelectorAll('.ed-photo').forEach(renderPhoto);
    renderStory(); renderGallery();
  }
  simple.forEach(([id, p]) => $('#' + id).addEventListener('input', (e) => { set(p, e.target.value); mark(); }));
  $('#publicNotes').addEventListener('input', (e) => { data.publicNotes = e.target.value.split('\n'); mark(); });
  ['introHome', 'introInvite'].forEach((id) => $('#' + id).addEventListener('change', () => { data.intro = { home: $('#introHome').checked, invite: $('#introInvite').checked }; mark(); }));

  $('#saveBtn').addEventListener('click', async () => {
    const r = /^https:\/\//.test(data.registryUrl || '') || !data.registryUrl;
    if (!r) return toast('The registry link must start with https://');
    $('#saveBtn').disabled = true;
    try {
      data = await api('/site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      dirty = false; $('#dirty').textContent = ''; fill(); toast('Saved. The website is updated.');
    } catch (err) { toast(err.message); }
    $('#saveBtn').disabled = false;
  });

  api('/site').then((d) => { data = d; data.story ||= []; data.gallery ||= []; data.hero ||= {}; data.invitationArt ||= {}; fill(); });
})();
