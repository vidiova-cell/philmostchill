/*
 * Logo (P + Stern) als Geometrie – EINE Quelle für alles:
 *  - die SVG-Logodateien (tools/logo.mjs erzeugt sie daraus)
 *  - das Logo-Sternbild auf der Startseite (sky.js)
 *
 * Das P ist nach Phils erstem Logo-Entwurf nachgezeichnet. Koordinaten im
 * 1254×1254-Raster des Originals: oben = 378, der P-Stamm reicht bis 845.
 */
(function (root) {
  'use strict';
  const PMCLogo = {
    // Umriss des P (geschlossenes Polygon) – Form aus Phils erstem Logo-Entwurf
    letters: {
      P: [[168, 378], [440, 378], [488, 426], [488, 560], [430, 618], [262, 618], [262, 757], [168, 845],
        [168, 650], [262, 556], [262, 540], [412, 540], [412, 455], [245, 455], [245, 483], [168, 560]],
    },
    // Der gelbe Vierzack-Stern: Mitte, Armlängen (oben, rechts, unten, links), Taille
    star: { cx: 452, cy: 338, arms: [124, 140, 166, 192], waist: 17 },
    // Farbtropfen für die "Drip"-Variante: [x, y (Unterkante), Länge, Breite, Ansatzbreite]
    drips: [
      [300, 618, 150, 10], [352, 618, 52, 8], [404, 618, 92, 9],
      [372, 455, 30, 6], [214, 801, 70, 8, 0.4],
    ],
    // Schriftzug PHILMOSTCHILL unter dem P (zentriert unter P + Stern)
    wordmark: { x0: 92, x1: 612, baseline: 938, size: 34 },
    gold: '#f9b80f',
    white: '#f2f0ea',
    bounds: { x: 168, y: 214, w: 424, h: 631 }, // P inkl. Stern

    // 4-Zack-Stern als SVG-Pfad (konkave Seiten wie im Logo)
    starPath(s = PMCLogo.star) {
      const { cx, cy, waist: w } = s;
      const [t, r, b, l] = s.arms;
      const k = 0.35; // je kleiner, desto schlanker die Arme
      const seg = (sx, sy, ex, ey, qx, qy) =>
        // von Spitze zu Spitze; Kontrollpunkte nah an der Mitte → konkave Seiten
        ` C${cx + qx * w * (sx ? 1 : k)},${cy + qy * w * (sy ? 1 : k)} ${cx + qx * w * (ex ? 1 : k)},${cy + qy * w * (ey ? 1 : k)} `;
      return `M${cx},${cy - t}` +
        seg(0, 1, 1, 0, 1, -1) + `${cx + r},${cy}` +
        seg(1, 0, 0, 1, 1, 1) + `${cx},${cy + b}` +
        seg(0, 1, 1, 0, -1, 1) + `${cx - l},${cy}` +
        seg(1, 0, 0, 1, -1, -1) + `${cx},${cy - t} Z`;
    },
    polyPath(pts) { return 'M' + pts.map((p) => p.join(',')).join(' L') + ' Z'; },
  };
  root.PMCLogo = PMCLogo;
})(typeof window !== 'undefined' ? window : globalThis);
