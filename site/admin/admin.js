/*
 * philmostchill Admin – Oberfläche
 *
 * Bildschirme:  #/ Übersicht · #/kat/<id> Kategorie mit Fotos · #/ueber Über Phil
 * Änderungen sammeln sich zuerst lokal und gehen mit „Veröffentlichen" als
 * EIN Commit ins Repository. GitHub Pages stellt sie ca. 1 Minute später live.
 *
 * Lokaler Test ohne GitHub:  http://localhost:4321/admin/?demo
 */
(function () {
  'use strict';

  // ---------- Einstellungen ----------
  const CFG = {
    owner: 'vidiova-cell',
    repo: 'philmostchill',
    branch: 'main',
    paths: { data: 'site/js/data.js', photos: 'site/js/photos.js' },
  };
  const SITE = new URL('../', location.href).href; // Basis der Webseite (…/philmostchill/)
  const RAW = `https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${CFG.branch}/site/`;
  const TOKEN_KEY = 'pmc-admin-token';
  const DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('demo');
  const SIZES = { full: 2000, thumb: 800 };
  const SWATCHES = ['#8fe8b8', '#ffb980', '#a5b8ff', '#ff9fc8', '#ffe08a', '#9ee7ff', '#c9a8ff', '#f4f1ea'];

  // ---------- Zustand ----------
  const S = {
    data: null, photos: null, meta: null,
    orig: { data: '', photos: '' },
    uploads: new Map(), // rel. Pfad → Blob (noch nicht veröffentlicht)
    previews: new Map(), // rel. Pfad → Objekt-URL zur Vorschau
    deletes: new Set(), // rel. Pfade zum Löschen
    log: new Map(), // Schlüssel → { text, n } – für die Commit-Nachricht
    deploy: null, // { sha, state }
    busy: false, progress: '',
  };
  let store = null;

  const $app = document.getElementById('app');
  const $sheet = document.querySelector('.sheet');
  const $backdrop = document.querySelector('.sheet-backdrop');
  const $toast = document.querySelector('.toast');
  const $bar = document.createElement('footer');
  $bar.className = 'bar';
  $bar.hidden = true;
  document.body.appendChild($bar);

  // ---------- kleine Helfer ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const slug = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'foto';
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const cat = (id) => S.data.categories.find((c) => c.id === id);
  const photosOf = (id) => (S.photos[id] || (S.photos[id] = []));
  function titleFromFile(name) {
    const base = name.replace(/\.[^.]+$/, '');
    if (/^(img|dsc|pxl|photo|image|whatsapp|bild|fullsizerender)[\s_-]?\d*/i.test(base) || /^\d+$/.test(base)) return '';
    const t = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function imgSrc(rel) { return S.previews.get(rel) || SITE + rel; }

  const ICON = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    photo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    first: '<svg viewBox="0 0 24 24"><path d="M18 5l-7 7 7 7M12 5l-7 7 7 7"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
  };

  // ---------- Änderungen verfolgen ----------
  function snapshot() { return { data: JSON.stringify(S.data), photos: JSON.stringify(S.photos) }; }
  function dataChanged() { return JSON.stringify(S.data) !== S.orig.data; }
  function photosChanged() { return JSON.stringify(S.photos) !== S.orig.photos; }
  function isDirty() {
    if (!S.data) return false; // Anmeldung / Laden: nichts zu verlieren
    return dataChanged() || photosChanged() || S.uploads.size > 0 || S.deletes.size > 0;
  }
  function logChange(key, text, delta = 0) {
    const e = S.log.get(key) || { text, n: 0 };
    e.n += delta;
    e.text = typeof text === 'function' ? text(e.n) : text;
    if (delta && e.n <= 0) S.log.delete(key); else S.log.set(key, e);
    renderBar();
  }
  function changeCount() { return isDirty() ? Math.max(1, S.log.size) : 0; }

  // ---------- Kurzmeldung ----------
  let toastTimer;
  function toast(msg, isErr) {
    $toast.textContent = msg;
    $toast.classList.toggle('err', !!isErr);
    $toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.hidden = true; }, isErr ? 6000 : 3200);
  }

  // ---------- Blatt von unten ----------
  function openSheet(html, bind) {
    $sheet.innerHTML = '<div class="sheet-grip"></div>' + html;
    $sheet.hidden = false;
    $backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    if (bind) bind($sheet);
  }
  function closeSheet() {
    $sheet.hidden = true;
    $backdrop.hidden = true;
    $sheet.innerHTML = '';
    document.body.style.overflow = '';
  }
  $backdrop.addEventListener('click', closeSheet);
  function confirmSheet({ title, text, ok, danger }) {
    return new Promise((resolve) => {
      openSheet(`<h3>${esc(title)}</h3><p>${esc(text)}</p>
        <button class="btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button>
        <button class="btn btn-block btn-ghost" data-cancel>Abbrechen</button>`, (el) => {
        el.querySelector('[data-ok]').onclick = () => { closeSheet(); resolve(true); };
        el.querySelector('[data-cancel]').onclick = () => { closeSheet(); resolve(false); };
      });
      $backdrop.onclick = () => { closeSheet(); resolve(false); $backdrop.onclick = null; };
    });
  }

  // ---------- Fotos auf dem Gerät vorbereiten ----------
  // Verkleinern + neu kodieren: entfernt nebenbei alle Metadaten (GPS, Kamera, …)
  function scaleStep(src, w, h, maxW, maxH) {
    const s = Math.min(1, maxW / w, maxH / h);
    let cw = w, ch = h, cur = src;
    const tw = Math.round(w * s), th = Math.round(h * s);
    // in Halbierungsschritten verkleinern → schärfer als ein großer Sprung
    while (cw / 2 > tw) {
      const c = document.createElement('canvas');
      c.width = Math.round(cw / 2); c.height = Math.round(ch / 2);
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(cur, 0, 0, c.width, c.height);
      cur = c; cw = c.width; ch = c.height;
    }
    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, tw, th);
    return c;
  }
  function encode(canvas, q) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b && b.type === 'image/webp') return resolve(b);
        // Safari kann (noch) kein WebP speichern → JPEG
        canvas.toBlob((j) => (j ? resolve(j) : reject(new Error('Bild konnte nicht umgewandelt werden.'))), 'image/jpeg', Math.min(0.92, q + 0.04));
      }, 'image/webp', q);
    });
  }
  async function prepareImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      try { await img.decode(); } catch (e) {
        throw new Error(/hei[cf]/i.test(file.type + file.name) ? 'HEIC-Format wird hier nicht unterstützt – bitte als JPG wählen.' : 'Dieses Bild kann nicht gelesen werden.');
      }
      const full = scaleStep(img, img.naturalWidth, img.naturalHeight, SIZES.full, SIZES.full);
      const thumb = scaleStep(full, full.width, full.height, SIZES.thumb, SIZES.thumb * 2);
      const [fullBlob, thumbBlob] = await Promise.all([encode(full, 0.82), encode(thumb, 0.78)]);
      return { full: fullBlob, thumb: thumbBlob, w: full.width, h: full.height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------- Bildschutz: Wasserzeichen ----------
  // Ist das Wasserzeichen an, bekommt jedes Foto zusätzlich eine Fassung mit
  // Wasserzeichen (p.wm). Die Webseite zeigt dann nur diese. Die sauberen
  // Dateien bleiben erhalten, damit man es jederzeit wieder ausschalten kann.
  const PROT_DEFAULT = { watermark: false, watermarkText: '© philmostchill', watermarkStyle: 'ecke', noDownload: false };
  const prot = () => S.data.protection;
  const wmKey = () => `${prot().watermarkStyle}|${prot().watermarkText}`;
  const needsWm = (p) => !p.wm || p.wm.key !== wmKey();
  const allPhotos = () => Object.entries(S.photos).flatMap(([c, list]) => list.map((p) => ({ c, p })));
  const missingWm = () => (prot().watermark ? allPhotos().filter(({ p }) => needsWm(p)) : []);

  let wmFont = null;
  const ensureWmFont = () => wmFont || (wmFont = (document.fonts ? document.fonts.load('600 40px Montserrat') : Promise.resolve()).catch(() => {}));

  function drawWatermark(canvas) {
    const pr = prot();
    const text = (pr.watermarkText || '© philmostchill').trim();
    const x = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    x.save();
    if (pr.watermarkStyle === 'diagonal') {
      // kräftig: Schriftzug diagonal über das ganze Bild verteilt
      const size = Math.round(Math.max(W, H) * 0.034);
      x.font = `600 ${size}px Montserrat, sans-serif`;
      x.textBaseline = 'middle';
      x.fillStyle = 'rgba(255,255,255,0.2)';
      x.strokeStyle = 'rgba(0,0,0,0.12)';
      x.lineWidth = Math.max(1, size / 22);
      x.translate(W / 2, H / 2);
      x.rotate(-Math.PI / 6);
      const tw = x.measureText(text).width + size * 3;
      const th = size * 4.2;
      const R = Math.hypot(W, H) / 2 + tw;
      let row = 0;
      for (let yy = -R; yy < R; yy += th, row++) {
        for (let xx = -R + (row % 2 ? tw / 2 : 0); xx < R; xx += tw) { x.strokeText(text, xx, yy); x.fillText(text, xx, yy); }
      }
    } else {
      // dezent: Schriftzug unten rechts
      const size = Math.round(Math.max(16, Math.min(W, H) * 0.034));
      x.font = `600 ${size}px Montserrat, sans-serif`;
      x.textAlign = 'right';
      x.textBaseline = 'alphabetic';
      x.shadowColor = 'rgba(0,0,0,0.5)';
      x.shadowBlur = size * 0.45;
      x.fillStyle = 'rgba(255,255,255,0.82)';
      x.fillText(text, W - size * 0.9, H - size * 0.85);
    }
    x.restore();
  }

  async function loadImg(src) {
    const img = new Image();
    if (/^https?:/.test(src) && !src.startsWith(location.origin)) img.crossOrigin = 'anonymous';
    img.src = src;
    await img.decode();
    return img;
  }
  function copyCanvas(src, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    return c;
  }
  // Sichere Quelle für die saubere Vollansicht: Vorschau (neu), Webseite oder Repository
  async function loadFull(rel) {
    if (S.previews.has(rel)) return loadImg(S.previews.get(rel));
    try { return await loadImg(SITE + rel); } catch (e) { return loadImg(RAW + rel); }
  }

  function dropFiles(rels) {
    for (const rel of rels) {
      if (!rel) continue;
      if (S.uploads.has(rel)) {
        S.uploads.delete(rel);
        URL.revokeObjectURL(S.previews.get(rel));
        S.previews.delete(rel);
      } else {
        S.deletes.add(rel);
      }
    }
  }

  // Erzeugt die Wasserzeichen-Fassung eines Fotos (Vollbild + Vorschau)
  async function makeWm(p, fullImg) {
    await ensureWmFont();
    const img = fullImg || (await loadFull(p.full));
    const c = copyCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
    drawWatermark(c);
    const t = scaleStep(c, c.width, c.height, SIZES.thumb, SIZES.thumb * 2);
    const [fb, tb] = await Promise.all([encode(c, 0.82), encode(t, 0.78)]);
    const ext = (b) => (b.type === 'image/webp' ? 'webp' : 'jpg');
    const base = p.full.replace(/-\d+\.\w+$/, '') + '-wz' + Date.now().toString(36);
    const wm = { full: `${base}-${SIZES.full}.${ext(fb)}`, thumb: `${base}-${SIZES.thumb}.${ext(tb)}`, key: wmKey() };
    S.uploads.set(wm.full, fb); S.uploads.set(wm.thumb, tb);
    S.previews.set(wm.full, URL.createObjectURL(fb)); S.previews.set(wm.thumb, URL.createObjectURL(tb));
    if (p.wm) dropFiles([p.wm.full, p.wm.thumb]); // alte Fassung (anderer Text/Stil) ersetzen
    p.wm = wm;
  }

  // Alle fehlenden/veralteten Wasserzeichen erzeugen
  async function ensureWatermarks(onProgress) {
    const todo = missingWm();
    const failed = [];
    for (let i = 0; i < todo.length; i++) {
      onProgress && onProgress(`Wasserzeichen ${i + 1} von ${todo.length} …`, i / todo.length);
      try { await makeWm(todo[i].p); } catch (e) { failed.push(todo[i].p.title || todo[i].p.full); }
    }
    if (todo.length - failed.length > 0) {
      logChange('wm', (n) => `Wasserzeichen für ${plural(n, 'Foto', 'Fotos')} erstellt`, todo.length - failed.length);
    }
    if (failed.length) throw new Error(`Wasserzeichen fehlgeschlagen bei: ${failed.join(', ')}`);
  }

  async function addPhotos(catId, fileList, $progress) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    if (!files.length) return;
    const added = [];
    const failed = [];
    const stamp = Date.now().toString(36);
    $progress.hidden = false;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      $progress.querySelector('span').textContent = `Bereite Foto ${i + 1} von ${files.length} vor …`;
      $progress.querySelector('i').style.width = `${(i / files.length) * 100}%`;
      try {
        const r = await prepareImage(f);
        const title = titleFromFile(f.name);
        const base = `${slug(title || 'foto')}-${stamp}${i}`;
        const ext = (blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg');
        const thumb = `img/fotos/${catId}/${base}-${SIZES.thumb}.${ext(r.thumb)}`;
        const full = `img/fotos/${catId}/${base}-${SIZES.full}.${ext(r.full)}`;
        S.uploads.set(thumb, r.thumb); S.uploads.set(full, r.full);
        S.previews.set(thumb, URL.createObjectURL(r.thumb)); S.previews.set(full, URL.createObjectURL(r.full));
        const entry = { thumb, full, w: r.w, h: r.h, title, upload: true };
        if (prot().watermark) await makeWm(entry);
        added.push(entry);
      } catch (e) {
        failed.push(`${f.name}: ${e.message}`);
      }
    }
    $progress.hidden = true;
    if (added.length) {
      // Neue Fotos kommen nach vorn (neueste zuerst)
      S.photos[catId] = [...added, ...photosOf(catId)];
      const name = cat(catId).name;
      logChange(`add:${catId}`, (n) => `${plural(n, 'Foto', 'Fotos')} zu „${name}“ hinzugefügt`, added.length);
      toast(`${plural(added.length, 'Foto', 'Fotos')} hinzugefügt – noch „Veröffentlichen“ tippen.`);
    }
    if (failed.length) toast(failed.join(' · '), true);
    render();
  }

  function removePhoto(catId, index) {
    const list = photosOf(catId);
    const [p] = list.splice(index, 1);
    const name = cat(catId).name;
    if (p.wm) dropFiles([p.wm.full, p.wm.thumb]);
    for (const rel of [p.thumb, p.full]) {
      if (S.uploads.has(rel)) {
        S.uploads.delete(rel);
        URL.revokeObjectURL(S.previews.get(rel));
        S.previews.delete(rel);
      } else {
        S.deletes.add(rel);
      }
    }
    if (p.upload && !S.deletes.has(p.thumb)) logChange(`add:${catId}`, (n) => `${plural(n, 'Foto', 'Fotos')} zu „${name}“ hinzugefügt`, -1);
    else logChange(`del:${catId}`, (n) => `${plural(n, 'Foto', 'Fotos')} aus „${name}“ entfernt`, 1);
  }

  // ---------- Veröffentlichen ----------
  function normalizeContacts() {
    const list = (S.data.about.contact || []).filter((c) => (c.label || '').trim() && (c.href || '').trim());
    list.forEach((c) => {
      c.label = c.label.trim();
      let h = c.href.trim();
      if (/@/.test(h) && !/^mailto:|^https?:/i.test(h)) h = 'mailto:' + h;
      else if (!/^(https?:|mailto:|tel:)/i.test(h)) h = 'https://' + h.replace(/^\/+/, '');
      c.href = h;
    });
    S.data.about.contact = list;
  }

  async function publish() {
    if (S.busy || !isDirty()) return;
    S.busy = true;
    S.progress = 'Wird vorbereitet …';
    renderBar();
    try {
      normalizeContacts();
      if (missingWm().length) {
        await ensureWatermarks((t) => { S.progress = t; renderBar(); });
      }
      const files = [];
      for (const [rel, blob] of S.uploads) files.push({ path: 'site/' + rel, blob });
      if (dataChanged()) files.push({ path: CFG.paths.data, text: PMCStore.stringifyWrapped(S.meta.dataHead, S.data) });
      if (photosChanged()) files.push({ path: CFG.paths.photos, text: PMCStore.stringifyWrapped(S.meta.photosHead, S.photos) });
      const deletes = [...S.deletes].map((rel) => 'site/' + rel);
      const summary = [...S.log.values()].map((e) => e.text).join('; ') || 'Inhalte aktualisiert';
      const { sha } = await store.publish({
        files, deletes,
        message: `Admin: ${summary}\n\nÜber die Admin-Oberfläche veröffentlicht.`,
        expect: { [CFG.paths.data]: S.meta.dataSha, [CFG.paths.photos]: S.meta.photosSha },
        onProgress: (t) => { S.progress = t; renderBar(); },
      });
      // Neuer Ausgangszustand
      S.orig = snapshot();
      S.uploads.clear(); S.deletes.clear(); S.log.clear();
      try {
        S.meta.dataSha = await store.fileSha(CFG.paths.data);
        S.meta.photosSha = await store.fileSha(CFG.paths.photos);
      } catch (e) { /* beim nächsten Laden */ }
      S.deploy = { sha, state: 'running', since: Date.now() };
      toast('Gespeichert! In etwa einer Minute ist alles live.');
      watchDeploy(sha);
    } catch (e) {
      if (e.status === 401) { logout('Der Zugang ist abgelaufen – bitte das Kennwort neu einrichten.'); return; }
      toast(e.message || 'Speichern hat nicht geklappt.', true);
    } finally {
      S.busy = false;
      S.progress = '';
      render();
    }
  }

  async function watchDeploy(sha) {
    const until = Date.now() + 6 * 60 * 1000;
    while (S.deploy && S.deploy.sha === sha && Date.now() < until) {
      await sleep(6000);
      try {
        const st = await store.deployStatus(sha);
        if (st.state === 'live' || st.state === 'failed') {
          S.deploy.state = st.state;
          renderBar();
          if (st.state === 'live') toast('Alles ist live ✓');
          return;
        }
      } catch (e) {
        // Schlüssel ohne Actions-Leserecht: Status unbekannt, nach ~90 s als live annehmen
        if (Date.now() - S.deploy.since > 90000) { S.deploy.state = 'assumed'; renderBar(); return; }
      }
    }
  }

  async function discard() {
    const ok = await confirmSheet({ title: 'Änderungen verwerfen?', text: 'Alles, was du seit dem letzten Veröffentlichen geändert hast, geht verloren.', ok: 'Verwerfen', danger: true });
    if (!ok) return;
    for (const rel of S.uploads.keys()) { URL.revokeObjectURL(S.previews.get(rel)); S.previews.delete(rel); }
    S.data = JSON.parse(S.orig.data);
    S.photos = JSON.parse(S.orig.photos);
    S.uploads.clear(); S.deletes.clear(); S.log.clear();
    render();
    toast('Änderungen verworfen.');
  }

  window.addEventListener('beforeunload', (e) => {
    if (isDirty() || S.busy) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- Untere Leiste ----------
  function renderBar() {
    if (!S.data) { $bar.hidden = true; return; }
    $bar.hidden = false;
    let text, action = '';
    const n = changeCount();
    if (S.busy) {
      text = `<strong><span class="status-dot busy"></span>Veröffentliche …</strong>${esc(S.progress)}`;
    } else if (n) {
      text = `<strong>${plural(n, 'Änderung', 'Änderungen')}</strong>Noch nicht live`;
      action = '<button class="btn btn-primary" data-publish>Veröffentlichen</button>';
    } else if (S.deploy && S.deploy.state === 'running') {
      text = '<strong><span class="status-dot busy"></span>Wird veröffentlicht …</strong>Dauert etwa eine Minute';
    } else if (S.deploy && S.deploy.state === 'failed') {
      text = '<strong><span class="status-dot err"></span>Veröffentlichen fehlgeschlagen</strong>Gespeichert, aber die Seite wurde nicht neu gebaut.';
    } else {
      text = `<strong><span class="status-dot"></span>${S.deploy ? 'Alles ist live' : 'Alles aktuell'}</strong>${S.deploy && S.deploy.state === 'assumed' ? 'Sollte jetzt sichtbar sein' : 'Keine offenen Änderungen'}`;
      action = `<a class="btn" href="${esc(SITE)}" target="_blank" rel="noopener">${ICON.open}Seite</a>`;
    }
    $bar.innerHTML = `<div class="bar-inner"><div class="bar-text">${text}</div>${action}</div>`;
    const b = $bar.querySelector('[data-publish]');
    if (b) b.onclick = publish;
  }

  // ---------- Bildschirme ----------
  function topbar(title, { back, right = '' } = {}) {
    return `<header class="topbar">
      ${back ? `<a class="icon-btn" href="${back}" aria-label="Zurück">${ICON.back}</a>` : ''}
      ${title}
      ${right}
    </header>`;
  }

  function imgTag(rel, alt = '', lazy = true) {
    // Frisch veröffentlichte Fotos sind evtl. noch nicht auf der Seite → Fallback aufs Repository
    return `<img src="${esc(imgSrc(rel))}" alt="${esc(alt)}" ${lazy ? 'loading="lazy" ' : ''}decoding="async" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${RAW}${esc(rel)}'}">`;
  }

  function viewHome() {
    const cats = S.data.categories.map((c) => {
      const list = photosOf(c.id);
      const thumbs = list.slice(0, 3).map((p) => imgTag(p.thumb, '', false)).join('');
      return `<a class="row" href="#/kat/${encodeURIComponent(c.id)}" style="--c:${esc(c.color)}">
        <span class="row-dot"></span>
        <span class="row-main"><span class="row-title">${esc(c.name)}</span>
          <span class="row-sub">${plural(list.length, 'Foto', 'Fotos')} · ${esc(c.description)}</span></span>
        <span class="row-thumbs">${thumbs}</span>${ICON.chev}
      </a>`;
    }).join('');
    const a = S.data.about;
    $app.innerHTML = `<div class="screen">
      ${topbar(`<span class="brand"><img src="../img/logo/p.svg" alt="philmostchill"><span>Admin</span></span>`, {
        right: `<button class="icon-btn" data-menu aria-label="Menü">${ICON.more}</button>`,
      })}
      ${DEMO ? '<p class="demo-banner">Demo-Modus: Es wird nichts wirklich gespeichert.</p>' : ''}
      <h2 class="section">Kategorien</h2>
      <div class="list">${cats}</div>
      <h2 class="section">Über dich</h2>
      <div class="list">
        <a class="row" href="#/ueber" style="--c:#c9b8ff">
          <span class="row-dot"></span>
          <span class="row-main"><span class="row-title">Über Phil</span>
            <span class="row-sub">${esc(a.title)} ${esc((a.text || [])[0] || '')}</span></span>${ICON.chev}
        </a>
      </div>
      <h2 class="section">Bildschutz</h2>
      <div class="list">
        <a class="row" href="#/bildschutz" style="--c:#f2c461">
          <span class="row-dot"></span>
          <span class="row-main"><span class="row-title">Wasserzeichen & Co.</span>
            <span class="row-sub">${esc(protSummary())}${missingWm().length ? ' · ⚠︎ ' + missingWm().length + ' offen' : ''}</span></span>${ICON.chev}
        </a>
      </div>
      <h2 class="section">Rechtliches</h2>
      <div class="list">
        <a class="row" href="#/rechtliches" style="--c:#9aa3b5">
          <span class="row-dot"></span>
          <span class="row-main"><span class="row-title">Impressum & Datenschutz</span>
            <span class="row-sub">${legalIncomplete() ? '⚠︎ Noch Platzhalter – bitte ausfüllen' : esc(S.data.legal.name + ' · ' + S.data.legal.city)}</span></span>${ICON.chev}
        </a>
      </div>
      ${isDirty() ? '<div class="spacer"></div><button class="btn btn-block btn-ghost" data-discard>Änderungen verwerfen</button>' : ''}
      <p class="hint-text" style="margin-top:22px">Tipp: Über „Teilen → Zum Home-Bildschirm“ wird der Admin zur App auf deinem iPhone.</p>
    </div>`;
    const d = $app.querySelector('[data-discard]');
    if (d) d.onclick = discard;
    $app.querySelector('[data-menu]').onclick = () => openSheet(`
      <h3>Menü</h3>
      <a class="btn btn-block" href="${esc(SITE)}" target="_blank" rel="noopener">${ICON.open}Webseite ansehen</a>
      <button class="btn btn-block" data-reload>Neu laden</button>
      ${DEMO ? '' : '<a class="btn btn-block" href="#/einrichten" data-close>Kennwort ändern</a>'}
      ${DEMO ? '' : '<button class="btn btn-block btn-danger" data-logout>Abmelden</button>'}
      <button class="btn btn-block btn-ghost" data-close>Schließen</button>`, (el) => {
      el.querySelectorAll('[data-close]').forEach((b) => { b.addEventListener('click', closeSheet); });
      el.querySelector('[data-reload]').onclick = async () => {
        closeSheet();
        if (isDirty() && !(await confirmSheet({ title: 'Neu laden?', text: 'Nicht veröffentlichte Änderungen gehen verloren.', ok: 'Neu laden', danger: true }))) return;
        S.log.clear(); S.uploads.clear(); S.deletes.clear();
        loadContent();
      };
      const lo = el.querySelector('[data-logout]');
      if (lo) lo.onclick = async () => {
        closeSheet();
        if (isDirty() && !(await confirmSheet({ title: 'Abmelden?', text: 'Nicht veröffentlichte Änderungen gehen verloren.', ok: 'Abmelden', danger: true }))) return;
        logout();
      };
    });
  }

  function viewCategory(id) {
    const c = cat(id);
    if (!c) { location.hash = '#/'; return; }
    const list = photosOf(id);
    const placeholders = list.filter((p) => p.placeholder).length;
    const grid = list.length ? list.map((p, i) => `
      <button class="ph" data-i="${i}" aria-label="Foto ${i + 1}${p.title ? ': ' + esc(p.title) : ''} bearbeiten">
        ${imgTag(prot().watermark && p.wm ? p.wm.thumb : p.thumb, p.title)}
        ${S.uploads.has(p.thumb) ? '<span class="ph-badge new">Neu</span>' : p.placeholder ? '<span class="ph-badge">Platzhalter</span>' : ''}
        <span class="ph-no">${i + 1}</span>
      </button>`).join('') : '';
    const swatches = SWATCHES.map((col) => `<button class="swatch" style="--c:${col}" data-color="${col}" aria-label="Farbe ${col}" aria-pressed="${col.toLowerCase() === (c.color || '').toLowerCase()}"></button>`).join('');
    const custom = !SWATCHES.includes((c.color || '').toLowerCase());

    $app.innerHTML = `<div class="screen">
      ${topbar(`<h1>${esc(c.name)}</h1>`, { back: '#/' })}
      <label class="upload">
        ${ICON.photo}
        <strong>Fotos hinzufügen</strong>
        <small>Mehrere auf einmal möglich · werden verkleinert, Standortdaten entfernt</small>
        <input type="file" accept="image/*" multiple data-upload>
      </label>
      <div class="card progress" hidden><span></span><div class="progress-bar"><i></i></div></div>

      <h2 class="section">Fotos (${list.length})</h2>
      ${list.length ? `<div class="grid">${grid}</div><p class="hint-text">Antippen zum Bearbeiten, Sortieren oder Löschen. Die Reihenfolge hier ist die auf der Seite.</p>` : '<div class="card empty">Noch keine Fotos in dieser Kategorie.</div>'}
      ${placeholders ? `<div class="spacer"></div><button class="btn btn-block btn-danger" data-clear-ph>${ICON.trash}Alle KI-Platzhalter entfernen (${placeholders})</button>` : ''}

      <h2 class="section">Texte & Farbe</h2>
      <label class="field"><span>Name</span><input class="input" data-f="name" value="${esc(c.name)}" maxlength="30" autocomplete="off"></label>
      <label class="field"><span>Beschreibung</span><textarea class="textarea" data-f="description" rows="3" maxlength="240">${esc(c.description)}</textarea></label>
      <div class="field"><span>Farbe des Sterns</span>
        <div class="swatches">${swatches}
          <label class="swatch swatch-custom" style="${custom ? `--c:${esc(c.color)};background:${esc(c.color)};border-color:#fff` : ''}" aria-label="Eigene Farbe"><input type="color" value="${esc(c.color)}" data-custom-color></label>
        </div>
      </div>
      <label class="field"><span>Himmelskoordinaten (nur Deko)</span><input class="input" data-f="coords" value="${esc(c.coords || '')}" autocomplete="off"></label>
    </div>`;

    const $progress = $app.querySelector('.progress');
    $app.querySelector('[data-upload]').onchange = (e) => { addPhotos(id, e.target.files, $progress); e.target.value = ''; };
    $app.querySelectorAll('.ph').forEach((b) => { b.onclick = () => photoSheet(id, Number(b.dataset.i)); });
    $app.querySelectorAll('[data-f]').forEach((inp) => {
      inp.oninput = () => {
        c[inp.dataset.f] = inp.value;
        if (inp.dataset.f === 'name') $app.querySelector('.topbar h1').textContent = inp.value || '…';
        logChange(`txt:${id}`, `Texte von „${c.name}“ geändert`);
      };
    });
    const setColor = (col) => { c.color = col; logChange(`txt:${id}`, `Texte von „${c.name}“ geändert`); render(); };
    $app.querySelectorAll('[data-color]').forEach((b) => { b.onclick = () => setColor(b.dataset.color); });
    $app.querySelector('[data-custom-color]').onchange = (e) => setColor(e.target.value);
    const cp = $app.querySelector('[data-clear-ph]');
    if (cp) cp.onclick = async () => {
      if (!(await confirmSheet({ title: 'Platzhalter entfernen?', text: `Die ${placeholders} KI-Platzhalterbilder in „${c.name}“ werden gelöscht.`, ok: 'Entfernen', danger: true }))) return;
      for (let i = list.length - 1; i >= 0; i--) if (list[i].placeholder) removePhoto(id, i);
      render();
      toast('Platzhalter entfernt – noch „Veröffentlichen“ tippen.');
    };
  }

  function photoSheet(id, i) {
    const list = photosOf(id);
    const p = list[i];
    if (!p) return;
    openSheet(`
      <h3>Foto ${i + 1} von ${list.length}</h3>
      <div class="sheet-photo">${imgTag(prot().watermark && p.wm ? p.wm.full : p.full, p.title, false)}</div>
      <label class="field"><span>Titel (optional)</span><input class="input" data-title value="${esc(p.title || '')}" maxlength="60" placeholder="z. B. Nebel im Wald" autocomplete="off" enterkeyhint="done"></label>
      <div class="btn-row">
        <button class="btn" data-move="-1" ${i === 0 ? 'disabled' : ''}>${ICON.left}Nach vorn</button>
        <button class="btn" data-move="1" ${i === list.length - 1 ? 'disabled' : ''}>Nach hinten${ICON.right}</button>
      </div>
      <div class="btn-row">
        <button class="btn" data-first ${i === 0 ? 'disabled' : ''}>${ICON.first}Zum Anfang</button>
        <button class="btn btn-danger" data-del>${ICON.trash}Löschen</button>
      </div>
      <div class="spacer"></div>
      <button class="btn btn-block btn-primary" data-done>Fertig</button>`, (el) => {
      const name = cat(id).name;
      const t = el.querySelector('[data-title]');
      t.oninput = () => { p.title = t.value.trim(); delete p.placeholder; logChange(`title:${id}`, `Fototitel in „${name}“ geändert`); };
      t.onkeydown = (e) => { if (e.key === 'Enter') t.blur(); };
      const move = (to) => {
        const [x] = list.splice(i, 1);
        list.splice(to, 0, x);
        logChange(`order:${id}`, `Reihenfolge in „${name}“ geändert`);
        render();
        photoSheet(id, to);
      };
      el.querySelectorAll('[data-move]').forEach((b) => { b.onclick = () => move(i + Number(b.dataset.move)); });
      el.querySelector('[data-first]').onclick = () => move(0);
      el.querySelector('[data-del]').onclick = async () => {
        closeSheet();
        if (!(await confirmSheet({ title: 'Foto löschen?', text: p.title ? `„${p.title}“ wird aus „${name}“ entfernt.` : `Das Foto wird aus „${name}“ entfernt.`, ok: 'Löschen', danger: true }))) { photoSheet(id, i); return; }
        removePhoto(id, i);
        render();
      };
      el.querySelector('[data-done]').onclick = () => { closeSheet(); render(); };
    });
  }

  function viewAbout() {
    const a = S.data.about;
    a.contact = a.contact || [];
    const contacts = a.contact.map((c, i) => `
      <div class="contact-row">
        <input class="input" data-c="${i}" data-k="label" value="${esc(c.label)}" placeholder="Bezeichnung, z. B. Instagram" autocomplete="off">
        <button class="icon-btn" data-rm="${i}" aria-label="Link entfernen">${ICON.trash}</button>
        <input class="input input-url" data-c="${i}" data-k="href" value="${esc(c.href)}" placeholder="Link oder E-Mail-Adresse" inputmode="url" autocomplete="off" autocapitalize="off">
      </div>`).join('');
    $app.innerHTML = `<div class="screen">
      ${topbar('<h1>Über Phil</h1>', { back: '#/' })}
      <h2 class="section">Text</h2>
      <label class="field"><span>Überschrift</span><input class="input" data-a="title" value="${esc(a.title)}" maxlength="60" autocomplete="off"></label>
      <label class="field"><span>Über dich</span><textarea class="textarea" data-a="text" rows="8">${esc((a.text || []).join('\n\n'))}</textarea></label>
      <p class="hint-text" style="margin-top:-8px">Eine Leerzeile beginnt einen neuen Absatz.</p>
      <h2 class="section">Kontakt & Links</h2>
      ${contacts || '<div class="card empty">Noch keine Links.</div>'}
      <div class="spacer"></div>
      <div class="btn-row">
        <button class="btn" data-add="Instagram|https://instagram.com/">${ICON.plus}Instagram</button>
        <button class="btn" data-add="E-Mail|">${ICON.plus}E-Mail</button>
      </div>
      <div class="spacer"></div>
      <button class="btn btn-block" data-add="|">${ICON.plus}Anderer Link</button>
    </div>`;
    const mark = () => logChange('about', '„Über Phil“ geändert');
    $app.querySelectorAll('[data-a]').forEach((inp) => {
      inp.oninput = () => {
        if (inp.dataset.a === 'text') a.text = inp.value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
        else a[inp.dataset.a] = inp.value;
        mark();
      };
    });
    $app.querySelectorAll('[data-c]').forEach((inp) => {
      inp.oninput = () => { a.contact[Number(inp.dataset.c)][inp.dataset.k] = inp.value; mark(); };
    });
    $app.querySelectorAll('[data-rm]').forEach((b) => {
      b.onclick = () => { a.contact.splice(Number(b.dataset.rm), 1); mark(); render(); };
    });
    $app.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => {
        const [label, href] = b.dataset.add.split('|');
        a.contact.push({ label, href });
        mark();
        render();
        const rows = $app.querySelectorAll('.contact-row');
        const last = rows[rows.length - 1];
        if (last) last.querySelector(label ? '.input-url' : '.input').focus();
      };
    });
  }

  // ---------- Bildschutz-Seite ----------
  function protSummary() {
    const pr = prot();
    return `Wasserzeichen ${pr.watermark ? 'an' : 'aus'} · Speichern ${pr.noDownload ? 'erschwert' : 'erlaubt'}`;
  }
  function viewProtection() {
    const pr = prot();
    const missing = missingWm().length;
    const total = allPhotos().length;
    const sample = allPhotos()[0];
    $app.innerHTML = `<div class="screen">
      ${topbar('<h1>Bildschutz</h1>', { back: '#/' })}
      <p class="hint-text" style="font-size:14px">Hundertprozentigen Schutz gibt es im Netz nicht – Screenshots gehen immer.
        Ein Wasserzeichen schreckt aber wirksam ab, und gesperrtes Speichern hält Gelegenheits-Kopierer fern.</p>

      <h2 class="section">Wasserzeichen</h2>
      <div class="card switch-card">
        <label class="switch-row">
          <span><strong>Wasserzeichen auf Fotos</strong><small>Die Webseite zeigt nur noch Fotos mit Wasserzeichen.</small></span>
          <input type="checkbox" class="switch" data-p="watermark" ${pr.watermark ? 'checked' : ''}>
        </label>
      </div>
      ${pr.watermark ? `
        <div class="spacer"></div>
        <label class="field"><span>Text</span><input class="input" data-p="watermarkText" value="${esc(pr.watermarkText)}" maxlength="40" autocomplete="off"></label>
        <div class="field"><span>Stil</span>
          <div class="seg">
            <button class="seg-btn" data-style="ecke" aria-pressed="${pr.watermarkStyle !== 'diagonal'}">Dezent · Ecke</button>
            <button class="seg-btn" data-style="diagonal" aria-pressed="${pr.watermarkStyle === 'diagonal'}">Kräftig · diagonal</button>
          </div>
        </div>
        ${sample ? '<div class="sheet-photo wm-preview"><canvas data-preview></canvas></div>' : ''}
        <p class="hint-text">${missing
          ? `${plural(missing, 'Foto braucht', 'Fotos brauchen')} noch ein Wasserzeichen – wird beim Veröffentlichen automatisch erstellt.`
          : `Alle ${plural(total, 'Foto', 'Fotos')} haben ein Wasserzeichen.`}</p>
        ${missing ? '<button class="btn btn-block" data-make>Jetzt erstellen</button><div class="card progress" hidden><span></span><div class="progress-bar"><i></i></div></div>' : ''}
      ` : '<p class="hint-text">Aus: Die Webseite zeigt die Fotos ohne Wasserzeichen.</p>'}

      <h2 class="section">Speichern erschweren</h2>
      <div class="card switch-card">
        <label class="switch-row">
          <span><strong>Speichern & Kopieren sperren</strong><small>Kein Rechtsklick-Speichern, kein Ziehen, kein „Foto sichern“ per langem Drücken am Handy.</small></span>
          <input type="checkbox" class="switch" data-p="noDownload" ${pr.noDownload ? 'checked' : ''}>
        </label>
      </div>
      <p class="hint-text">Hinweis: Die Dateien liegen zusätzlich im öffentlichen GitHub-Projekt. Wer sich auskennt, findet dort auch die Fassungen ohne Wasserzeichen.</p>
    </div>`;

    const mark = () => logChange('prot', 'Bildschutz-Einstellungen geändert');
    $app.querySelectorAll('input.switch').forEach((inp) => {
      inp.onchange = () => { pr[inp.dataset.p] = inp.checked; mark(); render(); };
    });
    const txt = $app.querySelector('[data-p="watermarkText"]');
    if (txt) {
      txt.oninput = () => { pr.watermarkText = txt.value; mark(); drawPreview(); };
      txt.onchange = () => { if (!pr.watermarkText.trim()) pr.watermarkText = PROT_DEFAULT.watermarkText; render(); };
    }
    $app.querySelectorAll('[data-style]').forEach((b) => {
      b.onclick = () => { pr.watermarkStyle = b.dataset.style; mark(); render(); };
    });
    const mk = $app.querySelector('[data-make]');
    if (mk) mk.onclick = async () => {
      const $pg = $app.querySelector('.progress');
      mk.disabled = true; $pg.hidden = false;
      try {
        await ensureWatermarks((t, f) => { $pg.querySelector('span').textContent = t; $pg.querySelector('i').style.width = `${f * 100}%`; });
        toast('Wasserzeichen erstellt – noch „Veröffentlichen“ tippen.');
      } catch (e) { toast(e.message, true); }
      render();
    };

    // Vorschau am ersten Foto
    let previewImg = null;
    async function drawPreview() {
      const cv = $app.querySelector('[data-preview]');
      if (!cv || !sample) return;
      try {
        await ensureWmFont();
        previewImg = previewImg || (await loadFull(sample.p.full));
        const w = Math.min(900, previewImg.naturalWidth), h = Math.round(w * previewImg.naturalHeight / previewImg.naturalWidth);
        const c = copyCanvas(previewImg, w, h);
        drawWatermark(c);
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(c, 0, 0);
      } catch (e) { /* Vorschau ist nur nice-to-have */ }
    }
    drawPreview();
  }

  // ---------- Impressum & Datenschutz ----------
  const isPlaceholder = (v) => !v || /^\s*\[.*\]\s*$/.test(v);
  function legalIncomplete() {
    const l = S.data.legal || {};
    return ['name', 'street', 'city', 'email'].some((k) => isPlaceholder(l[k]));
  }
  function viewLegal() {
    const l = S.data.legal;
    const field = (k, label, opts = '') => `<label class="field"><span>${label}</span>
      <input class="input" data-l="${k}" value="${esc(isPlaceholder(l[k]) ? '' : l[k])}" placeholder="${esc(isPlaceholder(l[k]) ? l[k] || '' : '')}" autocomplete="off" ${opts}></label>`;
    $app.innerHTML = `<div class="screen">
      ${topbar('<h1>Impressum</h1>', { back: '#/' })}
      <p class="hint-text" style="font-size:14px">Diese Angaben erscheinen im <a href="../impressum.html" target="_blank" rel="noopener">Impressum</a>
        und in der <a href="../datenschutz.html" target="_blank" rel="noopener">Datenschutzerklärung</a>.
        Für eine öffentliche Webseite in Deutschland sind Name, ladungsfähige Anschrift und E-Mail Pflicht.</p>
      <h2 class="section">Angaben</h2>
      ${field('name', 'Vor- und Nachname', 'autocapitalize="words"')}
      ${field('street', 'Straße und Hausnummer', 'autocapitalize="words"')}
      ${field('city', 'PLZ und Ort', 'autocapitalize="words"')}
      ${field('email', 'E-Mail-Adresse', 'type="email" inputmode="email" autocapitalize="off"')}
      ${field('phone', 'Telefon (optional)', 'type="tel" inputmode="tel"')}
    </div>`;
    $app.querySelectorAll('[data-l]').forEach((inp) => {
      inp.oninput = () => {
        const k = inp.dataset.l;
        const v = inp.value.trim();
        l[k] = v || (k === 'phone' ? '' : inp.placeholder || '');
        logChange('legal', 'Impressum-Angaben geändert');
      };
    });
  }

  // ---------- Anmeldung per Kennwort ----------
  // Der GitHub-Schlüssel liegt verschlüsselt in admin/zugang.json (siehe zugang.js)
  async function fetchZugang() {
    for (const url of ['zugang.json', RAW + 'admin/zugang.json']) {
      try {
        const r = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
        if (r.ok) return await r.json();
      } catch (e) { /* nächste Quelle probieren */ }
    }
    return null;
  }

  async function signIn(token) {
    const s = PMCStore.createGitHubStore({ ...CFG, token });
    await s.checkAccess();
    try { localStorage.setItem(TOKEN_KEY, token); } catch (err) { /* privater Modus */ }
    store = s;
  }

  async function viewLogin(message) {
    $bar.hidden = true;
    $app.innerHTML = '<div class="screen login"><p>Einen Moment …</p></div>';
    const zugang = await fetchZugang();
    if (location.hash.replace(/^#/, '') === '/einrichten') return; // inzwischen weiternavigiert
    const logo = '<img class="login-logo" src="../img/logo/logo.svg" alt="philmostchill">';
    if (!zugang) {
      $app.innerHTML = `<div class="screen login">${logo}<h1>Admin</h1>
        <p>Für den Admin ist noch kein Kennwort eingerichtet.</p>
        <a class="btn btn-primary btn-block" href="#/einrichten">Kennwort einrichten</a></div>`;
      return;
    }
    $app.innerHTML = `<div class="screen login">
      ${logo}
      <h1>Admin</h1>
      <p>Melde dich mit deinem Kennwort an.</p>
      ${message ? `<p style="color:var(--danger)">${esc(message)}</p>` : ''}
      <form data-login autocomplete="on">
        <!-- Benutzername nur für den iCloud-Schlüsselbund (Face ID) -->
        <input class="visually-hidden" type="text" name="username" autocomplete="username" value="philmostchill" tabindex="-1" aria-hidden="true">
        <label class="field"><span>Kennwort</span>
          <input class="input" type="password" name="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required></label>
        <button class="btn btn-primary btn-block" type="submit">Anmelden</button>
      </form>
      <p class="hint-text" style="text-align:center">Tipp: Lass Safari das Kennwort sichern – dann reicht künftig Face ID.</p>
      <p class="hint-text" style="text-align:center"><a href="#/einrichten">Kennwort einrichten oder ändern</a></p>
    </div>`;
    const form = $app.querySelector('[data-login]');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Prüfe …';
      try {
        const token = await PMCZugang.decryptToken(zugang, form.password.value);
        await signIn(token);
        loadContent();
      } catch (err) {
        if (err.wrongPassword) viewLogin('Das Kennwort stimmt nicht.');
        else if (err.status === 401) viewLogin('Der hinterlegte Zugang ist abgelaufen – bitte das Kennwort neu einrichten.');
        else viewLogin(err.message || 'Anmeldung hat nicht geklappt.');
      }
    };
  }

  // Kennwort festlegen: GitHub-Schlüssel wird mit dem Kennwort verschlüsselt und als zugang.json veröffentlicht
  function viewSetup() {
    $bar.hidden = true;
    const loggedIn = !!(store && store.kind === 'github' && store.token);
    $app.innerHTML = `<div class="screen">
      ${topbar('<h1>Kennwort einrichten</h1>', { back: '#/' })}
      ${DEMO ? '<p class="demo-banner">Im Demo-Modus nicht verfügbar.</p>' : ''}
      <p class="hint-text" style="font-size:14px">${loggedIn
        ? 'Lege ein neues Kennwort für den Admin fest. Das alte gilt danach nicht mehr.'
        : 'Hier legst du das Kennwort fest, mit dem sich Phil im Admin anmeldet. Dafür brauchst du einmalig einen GitHub-Schlüssel – Phil selbst sieht davon nichts.'}</p>
      <form data-setup>
        ${loggedIn ? '' : `
        <h2 class="section">1 · GitHub-Schlüssel</h2>
        <label class="field"><span>Schlüssel</span>
          <input class="input" type="password" name="token" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…" required></label>
        <details class="hint-text" style="font-size:14px">
          <summary style="color:var(--gold);cursor:pointer">So bekommst du den Schlüssel</summary>
          <ol style="padding-left:20px">
            <li>github.com → Profilbild → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b></li>
            <li>Name „PMC Admin“, Ablauf z. B. 1 Jahr</li>
            <li><b>Repository access:</b> Only select repositories → <b>${esc(CFG.owner)}/${esc(CFG.repo)}</b></li>
            <li><b>Permissions:</b> Contents = <b>Read and write</b>, Actions = <b>Read-only</b></li>
            <li>Erzeugen, kopieren, hier einfügen</li>
          </ol>
        </details>`}
        <h2 class="section">${loggedIn ? '' : '2 · '}Kennwort für Phil</h2>
        <label class="field"><span>Neues Kennwort (mind. ${PMCZugang.MIN_LENGTH} Zeichen)</span>
          <input class="input" type="text" name="password" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" minlength="${PMCZugang.MIN_LENGTH}" required></label>
        <button class="btn btn-block" type="button" data-suggest>Sicheres Kennwort vorschlagen</button>
        <p class="hint-text">Lange Kennwörter aus mehreren Wörtern sind sicher und trotzdem gut zu merken.</p>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-block" type="submit" ${DEMO ? 'disabled' : ''}>Kennwort speichern</button>
        <p class="hint-text">Das Kennwort ist ca. eine Minute nach dem Speichern aktiv. Gib es Phil am besten persönlich weiter, nicht per Messenger.</p>
      </form>
    </div>`;
    const form = $app.querySelector('[data-setup]');
    $app.querySelector('[data-suggest]').onclick = () => { form.password.value = PMCZugang.suggestPassword(); };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const pw = form.password.value.trim();
      if (pw.length < PMCZugang.MIN_LENGTH) { toast(`Das Kennwort braucht mindestens ${PMCZugang.MIN_LENGTH} Zeichen.`, true); return; }
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Speichere …';
      try {
        if (!loggedIn) await signIn(form.token.value.trim());
        const file = await PMCZugang.encryptToken(store.token, pw);
        await store.publish({
          files: [{ path: 'site/admin/zugang.json', text: JSON.stringify(file, null, 2) + '\n' }],
          deletes: [],
          message: 'Admin: Kennwort für den Admin neu festgelegt',
        });
        toast('Kennwort gespeichert – in ca. einer Minute aktiv.');
        location.hash = '#/';
        if (!S.data) loadContent(); else render();
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Kennwort speichern';
        toast(err.status === 401 ? 'Dieser Schlüssel ist ungültig oder abgelaufen.' : (err.message || 'Speichern hat nicht geklappt.'), true);
      }
    };
  }

  function logout(message) {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* egal */ }
    store = null; S.data = null;
    if (location.hash && location.hash !== '#/') history.replaceState(null, '', location.pathname + location.search);
    viewLogin(message);
  }

  // ---------- Router ----------
  let lastRoute = '';
  function render() {
    const route = location.hash.replace(/^#/, '') || '/';
    if (route === '/einrichten') { lastRoute = route; viewSetup(); return; }
    if (!S.data) { if (!store) viewLogin(); return; }
    const keepScroll = route === lastRoute ? window.scrollY : 0;
    lastRoute = route;
    const m = route.match(/^\/kat\/(.+)$/);
    if (m) viewCategory(decodeURIComponent(m[1]));
    else if (route === '/ueber') viewAbout();
    else if (route === '/rechtliches') viewLegal();
    else if (route === '/bildschutz') viewProtection();
    else viewHome();
    renderBar();
    window.scrollTo(0, keepScroll);
  }
  window.addEventListener('hashchange', () => { closeSheet(); render(); });

  // ---------- Start ----------
  async function loadContent() {
    $app.innerHTML = '<div class="screen login"><p>Lade Inhalte …</p></div>';
    try {
      const r = await store.load(CFG.paths);
      S.data = r.data; S.photos = r.photos; S.meta = r.meta;
      S.data.about = S.data.about || { title: '', text: [], contact: [] };
      S.data.protection = Object.assign({}, PROT_DEFAULT, S.data.protection || {});
      S.data.legal = S.data.legal || { name: '[Vorname Nachname]', street: '[Straße Hausnummer]', city: '[PLZ Ort]', email: '[E-Mail-Adresse]', phone: '' };
      S.orig = snapshot();
      render();
    } catch (e) {
      if (e.status === 401 || e.status === 403) { logout('Bitte neu anmelden.'); return; }
      $app.innerHTML = `<div class="screen login"><p>Laden hat nicht geklappt: ${esc(e.message)}</p><button class="btn btn-primary" onclick="location.reload()">Nochmal versuchen</button></div>`;
    }
  }

  function createDemoStore() {
    return {
      kind: 'demo',
      async checkAccess() { return { login: 'demo' }; },
      async load() {
        const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => r.text());
        const [d, p] = await Promise.all([get('../js/data.js'), get('../js/photos.js')]);
        const a = PMCStore.parseWrapped(d), b = PMCStore.parseWrapped(p);
        return { data: a.obj, photos: b.obj, meta: { dataHead: a.head, photosHead: b.head, dataSha: 'demo', photosSha: 'demo' } };
      },
      async publish({ files, deletes, message, onProgress }) {
        onProgress('Demo: würde jetzt hochladen …');
        await sleep(800);
        window.__lastPublish = {
          message, deletes,
          files: files.map((f) => ({ path: f.path, bytes: f.blob ? f.blob.size : f.text.length, type: f.blob ? f.blob.type : 'text', text: f.text })),
        };
        return { sha: 'demo-' + Date.now() };
      },
      async deployStatus() { return { state: 'live' }; },
      async fileSha() { return 'demo'; },
    };
  }

  (function boot() {
    if (DEMO) { store = createDemoStore(); loadContent(); return; }
    let token = null;
    try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* privater Modus */ }
    if (!token) { render(); return; } // Anmeldung oder Einrichten
    store = PMCStore.createGitHubStore({ ...CFG, token });
    loadContent();
  })();
})();
