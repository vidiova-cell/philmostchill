/* philmostchill – Galerie einer Kategorie */
(function () {
  'use strict';
  const data = window.PMC;
  const cats = data.categories;
  const id = new URLSearchParams(location.search).get('k');
  const idx = cats.findIndex((c) => c.id === id);
  if (idx < 0) { location.replace('index.html'); return; }

  const cat = cats[idx];
  const photos = (window.PMC_PHOTOS || {})[cat.id] || [];
  const pad = (n) => String(n).padStart(2, '0');

  document.title = cat.name + ' · philmostchill';
  document.documentElement.style.setProperty('--c', cat.color);
  document.querySelector('meta[name="description"]').content = cat.name + ' – ' + cat.description;

  const sky = window.PMCSky(document.getElementById('sky'), { density: 0.6, parallaxVars: true });
  window.PMCSky.bindWarpLinks(sky);

  // Kopf
  document.querySelector('.g-kicker-no').textContent = 'Stern ' + pad(idx + 1) + ' / ' + pad(cats.length);
  document.querySelector('.g-kicker-coords').textContent = cat.coords;
  document.querySelector('.g-title-text').textContent = cat.name;
  document.querySelector('.g-desc').textContent = cat.description;
  document.querySelector('.g-year').textContent = new Date().getFullYear();

  // Raster
  const grid = document.querySelector('.g-grid');
  if (!photos.length) {
    const note = document.createElement('p');
    note.className = 'g-note';
    note.textContent = 'Dieser Stern leuchtet bald – hier landen demnächst Fotos.';
    grid.before(note);
  } else if (photos.some((p) => p.placeholder)) {
    const note = document.createElement('p');
    note.className = 'g-note';
    note.textContent = 'Entwurf · Die Bilder hier sind KI-Platzhalter und werden durch Phils Fotos ersetzt.';
    grid.before(note);
  }

  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.dataset.index = i;
    const img = document.createElement('img');
    img.src = p.thumb;
    img.srcset = p.thumb + ' 800w, ' + p.full + ' 2000w';
    img.sizes = '(max-width: 700px) 50vw, 33vw';
    img.width = p.w; img.height = p.h;
    img.loading = i < 6 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.alt = p.title || cat.name + ' ' + (i + 1);
    b.appendChild(img);
    const cap = document.createElement('span');
    cap.className = 'tile-cap';
    cap.innerHTML = '<span class="tile-title"></span><span class="tile-no"></span>';
    cap.querySelector('.tile-title').textContent = p.title || '';
    cap.querySelector('.tile-no').textContent = pad(i + 1);
    b.appendChild(cap);
    if (p.placeholder) {
      const badge = document.createElement('span');
      badge.className = 'tile-badge';
      badge.textContent = 'Platzhalter';
      b.appendChild(badge);
    }
    grid.appendChild(b);
  });

  // Sanftes Einblenden beim Scrollen
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -6% 0px' }) : null;
  grid.querySelectorAll('.tile').forEach((t, i) => {
    t.style.transitionDelay = Math.min(i, 8) * 60 + 'ms';
    if (io) io.observe(t); else t.classList.add('is-in');
  });

  // Weitere Sterne
  const ul = document.querySelector('.g-other ul');
  cats.forEach((c) => {
    if (c.id === cat.id) return;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = 'galerie.html?k=' + encodeURIComponent(c.id);
    a.dataset.warp = '';
    a.style.setProperty('--c', c.color);
    a.innerHTML = '<span class="g-other-dot" data-warp-origin></span><span></span>';
    a.lastChild.textContent = c.name;
    li.appendChild(a); ul.appendChild(li);
  });

  // Kopfzeile beim Runterscrollen ausblenden, beim Hochscrollen zeigen
  const header = document.querySelector('.g-header');
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.classList.toggle('is-hidden', y > 160 && y > lastY);
    lastY = y;
  }, { passive: true });

  /* ---------- Lightbox ---------- */
  const lb = document.querySelector('.lightbox');
  const lbImg = lb.querySelector('.lb-img');
  const lbTitle = lb.querySelector('.lb-title');
  const lbCount = lb.querySelector('.lb-count');
  let current = 0;

  function show(i) {
    if (!photos.length) return;
    current = (i + photos.length) % photos.length;
    const p = photos[current];
    lbImg.classList.add('is-loading');
    const pre = new Image();
    pre.onload = pre.onerror = () => {
      lbImg.src = p.full;
      lbImg.alt = p.title || cat.name;
      lbImg.classList.remove('is-loading');
    };
    pre.src = p.full;
    lbTitle.textContent = p.title || '';
    lbCount.textContent = pad(current + 1) + ' / ' + pad(photos.length);
    history.replaceState(null, '', '#foto-' + (current + 1));
    // Nachbarn vorladen
    [1, -1].forEach((d) => { const n = photos[(current + d + photos.length) % photos.length]; new Image().src = n.full; });
  }
  function open(i) { show(i); if (!lb.open) lb.showModal(); }
  function close() { lb.close(); }

  lb.addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search));
  grid.addEventListener('click', (e) => {
    const t = e.target.closest('.tile');
    if (t) open(Number(t.dataset.index));
  });
  lb.querySelector('.lb-prev').addEventListener('click', () => show(current - 1));
  lb.querySelector('.lb-next').addEventListener('click', () => show(current + 1));
  lb.querySelector('.lb-close').addEventListener('click', close);
  let swiped = false;
  lb.querySelector('.lb-stage').addEventListener('click', (e) => {
    if (swiped) { swiped = false; return; }
    if (e.target === e.currentTarget) close();
  });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
  });

  // Wischen auf dem Handy
  let sx = null, sy = null;
  const stage = lb.querySelector('.lb-stage');
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  stage.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = sy = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { swiped = true; show(current + (dx < 0 ? 1 : -1)); }
    else if (dy > 90) { swiped = true; close(); }
    setTimeout(() => { swiped = false; }, 400);
  });

  // Direktlink auf ein Foto (#foto-3)
  const m = location.hash.match(/^#foto-(\d+)$/);
  if (m && photos[m[1] - 1]) open(m[1] - 1);
})();
