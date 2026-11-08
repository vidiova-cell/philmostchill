/*
 * Das Sternbild Waage (Libra) – Phils Sternzeichen.
 * Positionen aus echten Himmelskoordinaten (RA/Dek) projiziert.
 */
(function () {
  'use strict';
  // [Name, RA in Grad, Dek in Grad, Helligkeit (mag)]
  const STARS = {
    alpha: ['Zubenelgenubi', 222.72, -16.04, 2.75],
    beta: ['Zubeneschamali', 229.25, -9.38, 2.61],
    gamma: ['Zubenelhakrabi', 233.88, -14.79, 3.91],
    sigma: ['Brachium', 226.02, -25.28, 3.29],
    upsilon: ['υ Librae', 234.26, -28.14, 3.58],
    tau: ['τ Librae', 234.66, -29.78, 3.66],
  };
  const LINES = [['sigma', 'alpha'], ['alpha', 'beta'], ['beta', 'gamma'], ['gamma', 'alpha'], ['gamma', 'upsilon'], ['upsilon', 'tau']];

  function points(vbW, vbH, pad) {
    const raw = {};
    for (const [k, [, ra, dec, mag]] of Object.entries(STARS)) {
      // Osten ist am Himmel links, daher -RA
      raw[k] = { x: -(ra - 229) * Math.cos((18 * Math.PI) / 180), y: -dec, mag };
    }
    const xs = Object.values(raw).map((p) => p.x), ys = Object.values(raw).map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const s = Math.min((vbW - pad * 2) / (maxX - minX), (vbH - pad * 2) / (maxY - minY));
    const offX = (vbW - (maxX - minX) * s) / 2, offY = (vbH - (maxY - minY) * s) / 2;
    const out = {};
    for (const [k, p] of Object.entries(raw)) {
      out[k] = { x: offX + (p.x - minX) * s, y: offY + (p.y - minY) * s, r: 1.2 + (4 - p.mag) * 1.25, name: STARS[k][0] };
    }
    return out;
  }

  // Füllt ein <svg viewBox="0 0 W H"> mit dem Sternbild
  function render(svg) {
    const vb = svg.viewBox.baseVal;
    const pts = points(vb.width, vb.height, 14);
    const ns = 'http://www.w3.org/2000/svg';
    const lines = document.createElementNS(ns, 'g');
    lines.setAttribute('class', 'libra-lines');
    LINES.forEach(([a, b], i) => {
      const l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', pts[a].x); l.setAttribute('y1', pts[a].y);
      l.setAttribute('x2', pts[b].x); l.setAttribute('y2', pts[b].y);
      l.style.setProperty('--i', i);
      lines.appendChild(l);
    });
    svg.appendChild(lines);
    const stars = document.createElementNS(ns, 'g');
    stars.setAttribute('class', 'libra-stars');
    Object.values(pts).forEach((p, i) => {
      const glow = document.createElementNS(ns, 'circle');
      glow.setAttribute('cx', p.x); glow.setAttribute('cy', p.y); glow.setAttribute('r', p.r * 3.2);
      glow.setAttribute('class', 'libra-glow');
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', p.r);
      c.setAttribute('class', 'libra-star');
      c.style.setProperty('--i', i);
      stars.append(glow, c);
    });
    svg.appendChild(stars);
    return svg;
  }

  window.PMCLibra = { render };
})();
