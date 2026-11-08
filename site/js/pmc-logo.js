/*
 * PMC-Logo als Geometrie – EINE Quelle für alles:
 *  - die SVG-Logodateien (tools/logo.mjs erzeugt sie daraus)
 *  - das PMC-Sternbild auf der Startseite (sky.js)
 *
 * Nachgezeichnet nach Phils Logo-Entwurf. Koordinaten im 1254×1254-Raster
 * des Originals: oben = 378, Grundlinie = 750, der P-Stamm reicht bis 845.
 */
(function (root) {
  'use strict';
  const PMCLogo = {
    // Umrisse der Buchstaben (je ein geschlossenes Polygon)
    letters: {
      P: [[168, 378], [440, 378], [488, 426], [488, 560], [430, 618], [262, 618], [262, 757], [168, 845],
        [168, 650], [262, 556], [262, 540], [412, 540], [412, 455], [245, 455], [245, 483], [168, 560]],
      M: [[452, 378], [600, 378], [625, 500], [702, 378], [806, 378], [768, 416], [768, 750], [690, 750],
        [690, 540], [619, 605], [548, 528], [548, 750], [447, 750], [447, 618], [500, 565], [500, 426]],
      C: [[830, 378], [978, 378], [1062, 430], [1062, 530], [978, 455], [858, 455], [858, 672], [978, 672],
        [978, 640], [1062, 622], [1062, 750], [820, 750], [780, 710], [780, 428]],
    },
    // Der gelbe Vierzack-Stern: Mitte, Armlängen (oben, rechts, unten, links), Taille
    star: { cx: 1020, cy: 328, arms: [170, 192, 228, 262], waist: 22 },
    // Farbtropfen für die "Drip"-Variante: [x, y (Unterkante), Länge, Breite]
    drips: [
      [300, 618, 150, 10], [352, 618, 52, 8],
      [470, 750, 96, 9], [522, 750, 38, 7], [619, 598, 125, 10, 0.15],
      [722, 750, 64, 8], [754, 750, 30, 6],
      [842, 750, 72, 8], [905, 750, 40, 7], [1000, 750, 98, 9], [1046, 750, 46, 7],
      [935, 455, 44, 7], [372, 455, 30, 6],
    ],
    gold: '#f9b80f',
    white: '#f2f0ea',
    bounds: { x: 168, y: 158, w: 1042, h: 687 }, // inkl. Stern

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
