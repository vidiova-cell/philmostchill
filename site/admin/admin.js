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
        added.push({ thumb, full, w: r.w, h: r.h, title, upload: true });
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
      if (e.status === 401) { toast('Anmeldung abgelaufen – bitte neu anmelden.', true); logout(); return; }
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
      ${topbar(`<span class="brand"><img src="../img/logo/pmc.svg" alt="PMC"><span>Admin</span></span>`, {
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
      ${isDirty() ? '<div class="spacer"></div><button class="btn btn-block btn-ghost" data-discard>Änderungen verwerfen</button>' : ''}
      <p class="hint-text" style="margin-top:22px">Tipp: Über „Teilen → Zum Home-Bildschirm“ wird der Admin zur App auf deinem iPhone.</p>
    </div>`;
    const d = $app.querySelector('[data-discard]');
    if (d) d.onclick = discard;
    $app.querySelector('[data-menu]').onclick = () => openSheet(`
      <h3>Menü</h3>
      <a class="btn btn-block" href="${esc(SITE)}" target="_blank" rel="noopener">${ICON.open}Webseite ansehen</a>
      <button class="btn btn-block" data-reload>Neu laden</button>
      ${DEMO ? '' : '<button class="btn btn-block btn-danger" data-logout>Abmelden</button>'}
      <button class="btn btn-block btn-ghost" data-close>Schließen</button>`, (el) => {
      el.querySelector('[data-close]').onclick = closeSheet;
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
        ${imgTag(p.thumb, p.title)}
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
      <div class="sheet-photo">${imgTag(p.full, p.title, false)}</div>
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

  function viewLogin(message) {
    $bar.hidden = true;
    $app.innerHTML = `<div class="screen login">
      <img class="login-logo" src="../img/logo/pmc-logo.svg" alt="philmostchill">
      <h1>Admin</h1>
      <p>Melde dich einmal mit deinem GitHub-Schlüssel an. Danach bleibt dieses Gerät angemeldet.</p>
      ${message ? `<p style="color:var(--danger)">${esc(message)}</p>` : ''}
      <form data-login>
        <label class="field"><span>Schlüssel</span>
          <input class="input" type="password" name="token" autocomplete="current-password" autocapitalize="off" spellcheck="false" placeholder="github_pat_…" required></label>
        <button class="btn btn-primary btn-block" type="submit">Anmelden</button>
      </form>
      <details>
        <summary>Wie bekomme ich einen Schlüssel?</summary>
        <ol>
          <li>Auf github.com anmelden → Profilbild → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>
          <li>Name z. B. „PMC Admin“, Ablaufdatum wählen.</li>
          <li><b>Repository access:</b> Only select repositories → <b>${esc(CFG.owner)}/${esc(CFG.repo)}</b>.</li>
          <li><b>Permissions:</b> Contents = <b>Read and write</b>, Actions = <b>Read-only</b>.</li>
          <li>Erzeugen, kopieren und hier einfügen. Tipp: zusätzlich im Passwort-Manager speichern.</li>
        </ol>
      </details>
    </div>`;
    $app.querySelector('[data-login]').onsubmit = async (e) => {
      e.preventDefault();
      const token = e.target.token.value.trim();
      const btn = e.target.querySelector('button');
      btn.disabled = true; btn.textContent = 'Prüfe …';
      try {
        const s = PMCStore.createGitHubStore({ ...CFG, token });
        await s.checkAccess();
        try { localStorage.setItem(TOKEN_KEY, token); } catch (err) { /* privater Modus */ }
        store = s;
        loadContent();
      } catch (err) {
        viewLogin(err.status === 401 ? 'Dieser Schlüssel ist ungültig oder abgelaufen.' : err.message);
      }
    };
  }

  function logout() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* egal */ }
    store = null; S.data = null;
    location.hash = '#/';
    viewLogin();
  }

  // ---------- Router ----------
  let lastRoute = '';
  function render() {
    if (!S.data) return;
    const route = location.hash.replace(/^#/, '') || '/';
    const keepScroll = route === lastRoute ? window.scrollY : 0;
    lastRoute = route;
    const m = route.match(/^\/kat\/(.+)$/);
    if (m) viewCategory(decodeURIComponent(m[1]));
    else if (route === '/ueber') viewAbout();
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
      S.orig = snapshot();
      render();
    } catch (e) {
      if (e.status === 401 || e.status === 403) { logout(); viewLogin('Bitte neu anmelden.'); return; }
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
    if (!token) { viewLogin(); return; }
    store = PMCStore.createGitHubStore({ ...CFG, token });
    loadContent();
  })();
})();
