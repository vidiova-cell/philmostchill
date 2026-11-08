/* philmostchill – Startseite: das Universum */
(function () {
  'use strict';
  const data = window.PMC;
  const photos = window.PMC_PHOTOS || {};
  const universe = document.querySelector('.universe');

  const sky = window.PMCSky(document.getElementById('sky'), {
    constellation: ['philmostchill'],
    constellationNarrow: ['philmost', 'chill'],
    parallaxVars: true,
  });
  window.PMCSky.bindWarpLinks(sky);

  // Kategorie-Sterne als echte Links (Tastatur & Screenreader-freundlich)
  const links = data.categories.map((cat, i) => {
    const count = (photos[cat.id] || []).length;
    const a = document.createElement('a');
    a.className = 'cstar';
    a.href = 'galerie.html?k=' + encodeURIComponent(cat.id);
    a.dataset.warp = '';
    a.style.setProperty('--c', cat.color);
    a.style.setProperty('--d', (i * -1.37).toFixed(2) + 's');
    a.style.setProperty('--depth', (0.75 + (i % 3) * 0.2).toFixed(2));
    a.innerHTML =
      '<span class="cstar-body">' +
      '<span class="cstar-ring"></span><span class="cstar-ring cstar-ring--late"></span>' +
      '<span class="cstar-flare" data-warp-origin></span>' +
      '<span class="cstar-core"></span>' +
      '</span>' +
      '<span class="cstar-label">' +
      '<span class="cstar-name"></span>' +
      '<span class="cstar-meta"></span>' +
      '</span>';
    a.querySelector('.cstar-name').textContent = cat.name;
    a.querySelector('.cstar-meta').textContent = count ? count + (count === 1 ? ' Foto' : ' Fotos') : 'bald';
    a.setAttribute('aria-label', cat.name + (count ? ', ' + count + ' Fotos' : ''));
    a.title = cat.coords;
    universe.appendChild(a);
    return { a, cat };
  });

  // Waage-Sternbild → "Über Phil"
  const libra = document.createElement('button');
  libra.type = 'button';
  libra.className = 'libra';
  libra.setAttribute('aria-label', 'Über Phil – Sternbild Waage');
  libra.innerHTML = '<svg viewBox="0 0 70 110" aria-hidden="true"></svg><span class="libra-label"><span class="cstar-name">Waage</span><span class="cstar-meta">über Phil</span></span>';
  window.PMCLibra.render(libra.querySelector('svg'));
  universe.appendChild(libra);

  function place() {
    const narrow = window.PMCSky.isNarrow(window.innerWidth, window.innerHeight);
    links.forEach(({ a, cat }) => {
      const p = narrow ? cat.posNarrow : cat.pos;
      a.style.left = (p.x * 100) + '%';
      a.style.top = (p.y * 100) + '%';
    });
    const lp = narrow ? data.about.posNarrow : data.about.pos;
    libra.style.left = (lp.x * 100) + '%';
    libra.style.top = (lp.y * 100) + '%';
  }
  place();
  window.addEventListener('resize', place);

  // Sterne nacheinander "aufleuchten" lassen
  requestAnimationFrame(() => document.body.classList.add('is-ready'));

  // Über-Dialog
  const dialog = document.querySelector('.about');
  dialog.querySelector('.about-title').textContent = data.about.title;
  const txt = dialog.querySelector('.about-text');
  data.about.text.forEach((t) => { const p = document.createElement('p'); p.textContent = t; txt.appendChild(p); });
  const contact = dialog.querySelector('.about-contact');
  (data.about.contact || []).forEach((c) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = c.href; a.textContent = c.label; a.rel = 'noopener'; a.target = '_blank';
    li.appendChild(a); contact.appendChild(li);
  });
  window.PMCLibra.render(dialog.querySelector('.about-libra'));

  function openAbout() { if (!dialog.open) dialog.showModal(); }
  libra.addEventListener('click', openAbout);
  document.querySelectorAll('[data-open-about]').forEach((b) => b.addEventListener('click', openAbout));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
  });
  if (location.hash === '#ueber') openAbout();

  // Hinweis ausblenden, sobald jemand einen Stern entdeckt hat
  universe.addEventListener('pointerover', (e) => {
    if (e.target.closest('.cstar, .libra')) document.body.classList.add('has-discovered');
  });
})();
