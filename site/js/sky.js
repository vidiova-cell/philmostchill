/*
 * philmostchill – Sternenhimmel
 * Zeichnet auf ein <canvas>: Sternenfeld mit Tiefe (Parallax), Funkeln,
 * Sternschnuppen, den Schriftzug als Sternbild und den "Warp"-Übergang
 * beim Klick auf einen Stern.
 */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NARROW_RATIO = 1.1; // Breite/Höhe, ab der der Schriftzug zweizeilig wird

  // Kleiner, deterministischer Zufallsgenerator: gleicher Himmel bei jedem Besuch
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);

  /*
   * Buchstaben als Sternbild-Linien.
   * Einheiten: y = 0 Oberlänge, 0.4 x-Höhe, 1 Grundlinie, 1.4 Unterlänge.
   */
  const GLYPHS = {
    p: { w: 0.5, strokes: [[[0, 0.4], [0, 1.4]], [[0, 0.5], [0.22, 0.4], [0.45, 0.48], [0.5, 0.7], [0.42, 0.92], [0.2, 1], [0, 0.92]]] },
    h: { w: 0.45, strokes: [[[0, 0], [0, 1]], [[0, 0.55], [0.2, 0.4], [0.4, 0.46], [0.45, 0.62], [0.45, 1]]] },
    i: { w: 0, strokes: [[[0, 0.42], [0, 1]]], dots: [[0, 0.18]] },
    l: { w: 0.1, strokes: [[[0, 0], [0, 0.88], [0.1, 1]]] },
    m: { w: 0.62, strokes: [[[0, 1], [0, 0.4]], [[0, 0.52], [0.15, 0.4], [0.31, 0.5], [0.31, 1]], [[0.31, 0.5], [0.47, 0.4], [0.62, 0.5], [0.62, 1]]] },
    o: { w: 0.52, strokes: [[[0.26, 0.4], [0.46, 0.5], [0.52, 0.72], [0.44, 0.93], [0.24, 1], [0.06, 0.9], [0, 0.68], [0.08, 0.48], [0.26, 0.4]]] },
    s: { w: 0.42, strokes: [[[0.42, 0.47], [0.24, 0.4], [0.05, 0.46], [0.04, 0.6], [0.22, 0.69], [0.4, 0.78], [0.41, 0.93], [0.2, 1], [0, 0.94]]] },
    t: { w: 0.32, strokes: [[[0.1, 0.15], [0.1, 0.4], [0.1, 0.9], [0.18, 1], [0.32, 0.97]], [[0, 0.4], [0.1, 0.4], [0.3, 0.4]]] },
    c: { w: 0.42, strokes: [[[0.42, 0.48], [0.26, 0.4], [0.08, 0.47], [0, 0.7], [0.08, 0.92], [0.26, 1], [0.42, 0.94]]] },
  };

  function glowSprite(rgb) {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.1, `rgba(${rgb},0.9)`);
    gr.addColorStop(0.32, `rgba(${rgb},0.22)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    return c;
  }

  function isNarrow(w, h) { return w / h < NARROW_RATIO; }

  function PMCSky(canvas, options) {
    const opts = Object.assign({ density: 1, constellation: null, constellationNarrow: null, shootingStars: true, parallaxVars: false }, options);
    const ctx = canvas.getContext('2d');
    const sprites = { white: glowSprite('255,255,255'), blue: glowSprite('170,196,255'), warm: glowSprite('255,214,170') };
    const COLORS = { white: '#ffffff', blue: '#c4d4ff', warm: '#ffe2c4' };

    let W = 0, H = 0, unit = 1;
    let stars = [];
    let cons = null;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: -9999, py: -9999 };
    const shooting = [];
    let nextShoot = performance.now() + 3000;
    let warp = null;
    // Bei skipIntro ist der Aufbau (Linien, goldener Stern) sofort fertig
    const t0 = performance.now() - (opts.skipIntro ? 60000 : 0);
    let lastPx = null;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
      if (opts.logo) buildLogoConstellation();
      else if (opts.constellation) buildConstellation();
      if (cons && opts.onLayout) opts.onLayout(cons.bounds);
    }

    /*
     * Logo als Sternbild: jede Ecke des P wird ein Stern,
     * die Kanten werden nacheinander eingezeichnet. Danach erscheint der
     * goldene Vierzack-Stern wie im Logo.
     */
    function buildLogoConstellation() {
      const L = opts.logo;
      const rnd = mulberry32(2024);
      const narrow = isNarrow(W, H);
      const b = L.bounds, wm = L.wordmark;
      // Gesamtkomposition: P + Stern oben, Schriftzug darunter
      const cx0 = Math.min(b.x, wm.x0), cx1 = Math.max(b.x + b.w, wm.x1);
      const cy0 = b.y, cy1 = wm.baseline;
      const scale = Math.min((W * (narrow ? 0.8 : 0.4)) / (cx1 - cx0), (H * (narrow ? 0.4 : 0.62)) / (cy1 - cy0));
      const cx = W / 2, cy = H * (narrow ? 0.42 : 0.47);
      const ox = cx - ((cx0 + cx1) / 2) * scale, oy = cy - ((cy0 + cy1) / 2) * scale;
      const map = (p) => ({ x: ox + p[0] * scale, y: oy + p[1] * scale });
      unit = scale * 270;

      const nodes = [], edges = [];
      const STEP = 42;
      let order = 0;
      Object.values(L.letters).forEach((poly) => {
        const ns = poly.map((p) => {
          const q = map(p);
          const n = { x: q.x, y: q.y, s: 0.5 + rnd() * 0.9, ph: rnd() * 6.28, tw: 0.5 + rnd() * 1.6, appear: Infinity, hover: 0 };
          nodes.push(n);
          return n;
        });
        ns.forEach((a, i) => {
          const bN = ns[(i + 1) % ns.length];
          const delay = 350 + order * STEP; order++;
          edges.push({ a, b: bN, delay });
          a.appear = Math.min(a.appear, delay);
          bN.appear = Math.min(bN.appear, delay + 300);
        });
      });

      const s = L.star;
      const starAt = 350 + order * STEP + 150;
      const letterBottom = oy + 845 * scale;
      cons = {
        nodes, edges,
        star: { path: new Path2D(L.starPath()), x: ox, y: oy, scale, cx: ox + s.cx * scale, cy: oy + s.cy * scale, appear: starAt, color: L.gold },
        bounds: {
          top: oy + b.y * scale, bottom: letterBottom,
          left: ox + wm.x0 * scale, right: ox + wm.x1 * scale, // Breite des Schriftzugs
          scale, revealAt: starAt + 150,
        },
      };
    }

    function buildStars() {
      const rnd = mulberry32(42);
      const count = Math.min(1500, Math.round((W * H) / 1700 * opts.density));
      stars = [];
      for (let i = 0; i < count; i++) {
        const z = Math.pow(rnd(), 2.2) * 0.92 + 0.08; // meist weit weg
        const tintR = rnd();
        const tint = tintR < 0.14 ? 'blue' : tintR < 0.22 ? 'warm' : 'white';
        const s = {
          x: rnd() * W, y: rnd() * H, z,
          r: 0.25 + z * 1.25,
          a: 0.22 + z * 0.62 + rnd() * 0.12,
          tw: 0.4 + rnd() * 2.6, ph: rnd() * Math.PI * 2,
          col: COLORS[tint],
          glow: z > 0.82 ? sprites[tint] : null,
        };
        stars.push(s);
      }
    }

    function buildConstellation() {
      const words = isNarrow(W, H) ? (opts.constellationNarrow || opts.constellation) : opts.constellation;
      const rnd = mulberry32(1337);
      const GAP = 0.24, LINE_ADV = 1.75;
      const nodes = [], edges = [], lineWidths = [];
      let order = 0;
      const STEP = 40; // ms zwischen den Linien beim Einzeichnen

      words.forEach((word, li) => {
        let cx = 0;
        [...word].forEach((ch) => {
          const g = GLYPHS[ch];
          if (!g) { cx += 0.3 + GAP; return; }
          const local = new Map();
          const nodeFor = (pt) => {
            const key = pt[0] + ',' + pt[1];
            if (!local.has(key)) {
              const n = {
                ux: cx + pt[0] + (rnd() - 0.5) * 0.035,
                uy: li * LINE_ADV + pt[1] + (rnd() - 0.5) * 0.035,
                s: 0.45 + rnd() * 0.95, ph: rnd() * 6.28, tw: 0.5 + rnd() * 1.6,
                appear: Infinity, line: li, hover: 0, x: 0, y: 0,
              };
              nodes.push(n); local.set(key, n);
            }
            return local.get(key);
          };
          g.strokes.forEach((stroke) => {
            for (let i = 0; i < stroke.length - 1; i++) {
              const a = nodeFor(stroke[i]), b = nodeFor(stroke[i + 1]);
              const delay = 600 + order * STEP; order++;
              edges.push({ a, b, delay });
              a.appear = Math.min(a.appear, delay);
              b.appear = Math.min(b.appear, delay + 260);
            }
          });
          (g.dots || []).forEach((pt) => {
            const n = nodeFor(pt);
            n.s = 1.55; n.dot = true;
            n.appear = 600 + order * STEP; order++;
          });
          cx += g.w + GAP;
        });
        lineWidths[li] = cx - GAP;
      });

      // Zeilen zentrieren, dann alles in Bildschirm-Koordinaten umrechnen
      const maxW = Math.max(...lineWidths);
      nodes.forEach((n) => { n.ux += (maxW - lineWidths[n.line]) / 2; });
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach((n) => { minX = Math.min(minX, n.ux); maxX = Math.max(maxX, n.ux); minY = Math.min(minY, n.uy); maxY = Math.max(maxY, n.uy); });
      const bw = maxX - minX, bh = maxY - minY;
      const narrow = words.length > 1;
      unit = Math.min((W * (narrow ? 0.84 : 0.8)) / bw, (H * (narrow ? 0.36 : 0.3)) / bh);
      const cx = W / 2, cy = H * 0.5;
      nodes.forEach((n) => {
        n.x = cx + (n.ux - (minX + bw / 2)) * unit;
        n.y = cy + (n.uy - (minY + bh / 2)) * unit;
      });
      cons = { nodes, edges, bounds: { top: cy - (bh / 2) * unit, bottom: cy + (bh / 2) * unit } };
    }

    function spawnShoot(now) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const ang = (Math.PI / 180) * (16 + Math.random() * 24);
      const sp = 0.75 + Math.random() * 0.55;
      shooting.push({
        x: W * (0.15 + Math.random() * 0.7), y: H * Math.random() * 0.4,
        ux: dir * Math.cos(ang), uy: Math.sin(ang), sp,
        start: now, dur: 650 + Math.random() * 550, len: 90 + Math.random() * 130,
      });
      nextShoot = now + 5000 + Math.random() * 9000;
    }

    function drawStars(t) {
      const drift = REDUCED ? 0 : t * 0.006;
      const mx = mouse.x * 26, my = mouse.y * 18;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        let x = s.x + drift * s.z - mx * s.z;
        let y = s.y - my * s.z;
        x = ((x % W) + W) % W; y = ((y % H) + H) % H;
        const a = s.a * (REDUCED ? 1 : 0.68 + 0.32 * Math.sin(t * 0.001 * s.tw + s.ph));

        if (warp) {
          const dx = x - warp.x, dy = y - warp.y;
          const k = warp.e * (0.35 + s.z * 1.3);
          ctx.globalAlpha = Math.min(1, a * (1 + warp.p * 2));
          ctx.strokeStyle = s.col;
          ctx.lineWidth = Math.max(0.6, s.r * 1.5);
          ctx.beginPath();
          ctx.moveTo(x + dx * k * 0.55, y + dy * k * 0.55);
          ctx.lineTo(x + dx * k * 1.6, y + dy * k * 1.6);
          ctx.stroke();
          continue;
        }

        ctx.globalAlpha = a;
        if (s.glow) {
          const sz = s.r * 10;
          ctx.drawImage(s.glow, x - sz / 2, y - sz / 2, sz, sz);
        } else if (s.r < 0.8) {
          ctx.fillStyle = s.col;
          ctx.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2);
        } else {
          ctx.fillStyle = s.col;
          ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    function drawConstellation(t) {
      const CZ = 0.38;
      const ox = -mouse.x * 26 * CZ, oy = -mouse.y * 18 * CZ;
      const fade = warp ? Math.max(0, 1 - warp.p * 1.6) : 1;
      if (fade <= 0) return;
      const k = clamp(unit / 170, 0.5, 1.25);

      ctx.lineCap = 'round';
      ctx.strokeStyle = opts.logo ? 'rgb(232,230,224)' : 'rgb(176,198,255)';
      const nodeSprite = opts.logo ? sprites.white : sprites.blue;
      for (const e of cons.edges) {
        const p = REDUCED ? 1 : clamp((t - e.delay) / 450, 0, 1);
        if (p <= 0) continue;
        const ax = e.a.x + ox, ay = e.a.y + oy;
        const bx = e.b.x + ox, by = e.b.y + oy;
        const q = easeOut(p);
        const hb = (e.a.hover + e.b.hover) / 2;
        ctx.globalAlpha = ((opts.logo ? 0.34 : 0.21) + hb * 0.5) * fade;
        ctx.lineWidth = (opts.logo ? 1.3 : 1) + hb * 0.6;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (bx - ax) * q, ay + (by - ay) * q);
        ctx.stroke();
      }

      for (const n of cons.nodes) {
        const p = REDUCED ? 1 : clamp((t - n.appear) / 600, 0, 1);
        if (p <= 0) continue;
        const x = n.x + ox, y = n.y + oy;
        const d = Math.hypot(x - mouse.px, y - mouse.py);
        n.hover += (Math.max(0, 1 - d / 150) - n.hover) * 0.12;
        const tw = REDUCED ? 1 : 0.74 + 0.26 * Math.sin(t * 0.0012 * n.tw + n.ph);
        // kleiner Aufblitz-Effekt beim Erscheinen
        const flash = REDUCED ? 0 : Math.max(0, 1 - Math.abs(p - 0.35) * 3) * 0.8;
        const a = p * tw * fade * (0.72 + n.hover * 0.28);
        const size = (9 + n.s * 10) * k * (1 + n.hover * 0.7 + flash);
        ctx.globalAlpha = a;
        ctx.drawImage(nodeSprite, x - size / 2, y - size / 2, size, size);
        ctx.globalAlpha = Math.min(1, a * 1.15);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, (0.55 + n.s * 0.6) * k, 0, Math.PI * 2); ctx.fill();
      }

      if (cons.star) drawLogoStar(t, ox, oy, fade);
    }

    // Der goldene Vierzack-Stern aus dem Logo
    function drawLogoStar(t, ox, oy, fade) {
      const st = cons.star;
      const p = REDUCED ? 1 : clamp((t - st.appear) / 900, 0, 1);
      if (p <= 0) return;
      const d = Math.hypot(st.cx + ox - mouse.px, st.cy + oy - mouse.py);
      st.hover = (st.hover || 0) + ((Math.max(0, 1 - d / 220)) - (st.hover || 0)) * 0.08;
      const pulse = REDUCED ? 1 : 1 + 0.025 * Math.sin(t * 0.0016);
      const pop = REDUCED ? 1 : 0.6 + 0.4 * easeOut(p) + Math.max(0, 0.18 - Math.abs(p - 0.55)) * 0.9; // kurzes "Aufpoppen"
      const sc = pulse * pop * (1 + st.hover * 0.06);
      ctx.save();
      ctx.globalAlpha = p * fade;
      // um die eigene Mitte skalieren
      ctx.translate(st.cx + ox, st.cy + oy);
      ctx.scale(sc, sc);
      ctx.translate(-st.cx, -st.cy);
      ctx.translate(st.x, st.y);
      ctx.scale(st.scale, st.scale);
      // Leuchten statt Farbfläche: additiv mischen, damit der Stern wie Licht wirkt
      const L = opts.logo.star;
      const shimmer = REDUCED ? 0 : 0.5 + 0.5 * Math.sin(t * 0.0011);
      ctx.globalCompositeOperation = 'lighter';
      // Grundzustand: dezentes Glimmen. In Mausnähe (hover) leuchtet er auf.
      const h = st.hover;
      const k = 0.55 + h * 0.45; // Gesamtintensität
      // weicher Lichthof
      const R = 300;
      const halo = ctx.createRadialGradient(L.cx, L.cy, 0, L.cx, L.cy, R);
      halo.addColorStop(0, 'rgba(255,214,150,' + ((0.07 + shimmer * 0.02) * k + h * 0.08) + ')');
      halo.addColorStop(0.35, 'rgba(255,196,110,' + (0.025 * k) + ')');
      halo.addColorStop(1, 'rgba(255,196,110,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(L.cx - R, L.cy - R, R * 2, R * 2);
      // Sternkörper: innen warmes Weiß, nach außen blasses Gold
      const body = ctx.createRadialGradient(L.cx, L.cy, 0, L.cx, L.cy, 250);
      // heller Kern bleibt auch gedämpft – so wirkt er wie Licht, nicht wie Farbe
      body.addColorStop(0, 'rgba(255,252,242,' + (0.88 + h * 0.1) + ')');
      body.addColorStop(0.08, 'rgba(255,238,200,' + (0.62 + h * 0.2) + ')');
      body.addColorStop(0.2, 'rgba(255,226,170,' + (0.5 * k) + ')');
      body.addColorStop(0.45, 'rgba(245,200,110,' + (0.4 * k) + ')');
      body.addColorStop(1, 'rgba(235,180,80,' + (0.12 * k) + ')');
      ctx.shadowColor = 'rgba(255,200,110,' + (0.28 + h * 0.4) + ')';
      ctx.shadowBlur = 22 + shimmer * 6 + h * 40;
      ctx.fillStyle = body;
      ctx.fill(st.path);
      ctx.restore();
    }

    function drawShooting(now) {
      if (!opts.shootingStars || REDUCED) return;
      if (!warp && now > nextShoot) spawnShoot(now);
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        const age = now - s.start;
        if (age > s.dur) { shooting.splice(i, 1); continue; }
        const hx = s.x + s.ux * s.sp * age, hy = s.y + s.uy * s.sp * age;
        const len = s.len * Math.min(1, age / 220);
        const tx = hx - s.ux * len, ty = hy - s.uy * len;
        const g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,0.95)');
        ctx.globalAlpha = Math.sin((Math.PI * age) / s.dur);
        ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.drawImage(sprites.white, hx - 5, hy - 5, 10, 10);
      }
    }

    function frame(now) {
      const t = now - t0;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      if (warp) {
        warp.p = clamp((now - warp.start) / warp.dur, 0, 1);
        warp.e = Math.pow(warp.p, 2.6) * 5;
      }
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      drawStars(t);
      if (cons) drawConstellation(t);
      drawShooting(now);
      ctx.globalAlpha = 1;

      if (opts.parallaxVars) {
        const key = mouse.x.toFixed(3) + ',' + mouse.y.toFixed(3);
        if (key !== lastPx) {
          lastPx = key;
          document.documentElement.style.setProperty('--px', mouse.x.toFixed(3));
          document.documentElement.style.setProperty('--py', mouse.y.toFixed(3));
        }
      }
      requestAnimationFrame(frame);
    }

    function warpTo(x, y, done) {
      if (warp) return;
      const root = document.documentElement;
      root.style.setProperty('--wx', x + 'px');
      root.style.setProperty('--wy', y + 'px');
      document.body.classList.add('is-warping');
      if (REDUCED) { setTimeout(done, 200); return; }
      warp = { x, y, start: performance.now(), dur: 900, p: 0, e: 0 };
      setTimeout(done, 860);
    }

    function reset() {
      warp = null;
      document.body.classList.remove('is-warping');
    }

    // Maus / Touch
    if (!REDUCED) {
      window.addEventListener('pointermove', (e) => {
        mouse.tx = (e.clientX / W - 0.5) * 2;
        mouse.ty = (e.clientY / H - 0.5) * 2;
        mouse.px = e.clientX; mouse.py = e.clientY;
      }, { passive: true });
      document.addEventListener('pointerleave', () => { mouse.px = mouse.py = -9999; });
      // Handy: sanftes Neigen statt Maus
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null) return;
        mouse.tx = clamp(e.gamma / 30, -1, 1);
        mouse.ty = clamp((e.beta - 45) / 30, -1, 1);
      }, { passive: true });
    }

    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });
    // Zurück-Button (bfcache): Warp-Zustand zurücksetzen
    window.addEventListener('pageshow', (e) => { if (e.persisted) reset(); });

    resize();
    requestAnimationFrame(frame);

    return {
      warpTo, reset,
      get constellationBounds() { return cons ? cons.bounds : null; },
    };
  }

  /* Links mit [data-warp] lösen den Warp-Übergang aus */
  PMCSky.bindWarpLinks = function (sky, root) {
    (root || document).addEventListener('click', (e) => {
      const a = e.target.closest('a[data-warp]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const anchor = a.querySelector('[data-warp-origin]') || a;
      const r = anchor.getBoundingClientRect();
      const centered = a.dataset.warp === 'center';
      const x = centered ? window.innerWidth / 2 : r.left + r.width / 2;
      const y = centered ? window.innerHeight / 2 : r.top + r.height / 2;
      sky.warpTo(x, y, () => { window.location.href = a.href; });
    });
  };

  PMCSky.isNarrow = isNarrow;
  PMCSky.reducedMotion = REDUCED;
  window.PMCSky = PMCSky;
})();
