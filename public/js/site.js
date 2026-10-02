// Envelope intro, lightbox for invitation art / photos.
(() => {
  // ---- Wax-seal intro ----
  const intro = document.getElementById('intro');
  if (intro && !intro.hidden) {
    const btn = document.getElementById('sealBtn');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const open = () => {
      if (intro.classList.contains('opening')) return;
      intro.classList.add('opening');
      try { sessionStorage.setItem('opened:' + intro.dataset.key, '1'); } catch {}
      setTimeout(() => { intro.remove(); document.documentElement.classList.remove('intro-on'); }, reduce ? 320 : 1150);
    };
    btn.addEventListener('click', open);
    intro.addEventListener('click', (e) => { if (e.target === intro || e.target.classList.contains('door')) open(); });
    document.addEventListener('keydown', (e) => { if (['Enter', ' ', 'Escape'].includes(e.key) && document.getElementById('intro')) { e.preventDefault(); open(); } });
    btn.focus({ preventScroll: true });
  }

  // ---- Lightbox ----
  const lb = document.getElementById('lightbox');
  const stage = document.getElementById('lbStage');
  if (!lb || !stage) return;
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-zoom]');
    if (!t || lb.contains(t)) return;
    e.preventDefault();
    stage.classList.remove('zoomed');
    const clone = t.classList.contains('art') ? t.cloneNode(true) : t.querySelector('img').cloneNode(true);
    clone.removeAttribute('data-zoom');
    clone.removeAttribute('loading');
    if (clone.tagName === 'BUTTON') clone.setAttribute('aria-label', 'Zoom in or out');
    stage.replaceChildren(clone);
    lb.showModal();
  });
  stage.addEventListener('click', (e) => {
    if (e.target === stage) return lb.close();
    const zoomed = stage.classList.toggle('zoomed');
    if (zoomed) {
      // centre the zoomed image on the tap point
      const r = stage.getBoundingClientRect();
      requestAnimationFrame(() => {
        stage.scrollLeft = (stage.scrollWidth - r.width) * ((e.clientX - r.left) / r.width);
        stage.scrollTop = (stage.scrollHeight - r.height) * ((e.clientY - r.top) / r.height);
      });
    }
  });
  lb.querySelector('.lb-close').addEventListener('click', () => lb.close());
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
})();
