/*
 * philmostchill – Logo-Export
 *
 *   npm run logo
 *
 * Erzeugt aus site/js/pmc-logo.js saubere Vektor-Logos (SVG) und PNGs:
 *   site/img/logo/   → für die Webseite
 *   logo/            → für Phil (Instagram, Druck, …)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(await fs.readFile(path.join(ROOT, 'site/js/pmc-logo.js'), 'utf8'), ctx);
const L = ctx.PMCLogo;

const font = opentype.parse((await fs.readFile(path.join(ROOT, 'node_modules/@fontsource/montserrat/files/montserrat-latin-600-normal.woff'))).buffer);

// Schriftzug PHILMOSTCHILL als Pfad (unabhängig von installierten Schriften)
function wordmark(text, { x0, x1, baseline, size }) {
  const glyphs = font.stringToGlyphs(text);
  const scale = size / font.unitsPerEm;
  const widths = glyphs.map((g) => g.advanceWidth * scale);
  const raw = widths.reduce((a, b) => a + b, 0) - widths.at(-1) + glyphs.at(-1).getBoundingBox().x2 * scale;
  const tracking = (x1 - x0 - raw) / (glyphs.length - 1);
  let x = x0;
  let d = '';
  glyphs.forEach((g, i) => {
    d += g.getPath(x, baseline, size).toPathData(2);
    x += widths[i] + tracking;
  });
  return d;
}

const lettersD = Object.values(L.letters).map((p) => L.polyPath(p)).join(' ');
const starD = L.starPath();
const dripsD = L.drips.map(([x, y, len, w0, flare = 1]) => {
  // Farbtropfen: oben breit angesetzt, läuft schmal aus, rundes Ende
  const w = w0 * 1.35, h = w / 2, f = w * 1.1 * flare, r = h * 1.05;
  const end = y + len;
  return `M${x - h - f},${y - 2} L${x + h + f},${y - 2} Q${x + h},${y} ${x + h},${y + f * 2} ` +
    `L${x + h * 0.9},${end - r} A${r},${r} 0 0 1 ${x - h * 0.9},${end - r} L${x - h},${y + f * 2} Q${x - h},${y} ${x - h - f},${y - 2} Z`;
}).join(' ');
const wordD = wordmark('PHILMOSTCHILL', { x0: 172, x1: 1090, baseline: 935, size: 46 });

function svg({ drips = false, word = true, bg = null, pad = 40, color = L.white, gold = L.gold } = {}) {
  const top = L.bounds.y - pad;
  const bottom = (word ? 950 : (drips ? 870 : 845)) + pad;
  const left = 150 - pad, right = 1215 + pad;
  const w = right - left, h = bottom - top;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${w} ${h}" width="${w}" height="${h}">
  <title>philmostchill</title>
  <defs>
    <mask id="cut" maskUnits="userSpaceOnUse" x="${left}" y="${top}" width="${w}" height="${h}">
      <rect x="${left}" y="${top}" width="${w}" height="${h}" fill="#fff"/>
      <path d="${starD}" fill="#000" stroke="#000" stroke-width="12" stroke-linejoin="round"/>
    </mask>
  </defs>
  ${bg ? `<rect x="${left}" y="${top}" width="${w}" height="${h}" fill="${bg}"/>` : ''}
  <g fill="${color}" mask="url(#cut)">
    <path d="${lettersD}"/>
    ${drips ? `<path d="${dripsD}"/>` : ''}
  </g>
  <path d="${starD}" fill="${gold}"/>
  ${word ? `<path d="${wordD}" fill="${color}"/>` : ''}
</svg>
`;
}

function starSvg({ bg = null, size = 512 } = {}) {
  const s = L.star, m = 30;
  const [t, r, b, l] = s.arms;
  const x = s.cx - l - m, y = s.cy - t - m, w = l + r + 2 * m, h = t + b + 2 * m;
  const side = Math.max(w, h);
  const vx = s.cx - side / 2 + (r - l) / 2, vy = s.cy - side / 2 + (b - t) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${side} ${side}" width="${size}" height="${size}">
  ${bg ? `<rect x="${vx}" y="${vy}" width="${side}" height="${side}" rx="${side * 0.22}" fill="${bg}"/>` : ''}
  <path d="${L.starPath()}" fill="${L.gold}"/>
</svg>
`;
}

const WEB = path.join(ROOT, 'site/img/logo');
const OUT = path.join(ROOT, 'logo');
await fs.mkdir(WEB, { recursive: true });
await fs.mkdir(OUT, { recursive: true });

const files = {
  'pmc-logo.svg': svg(),
  'pmc-logo-drips.svg': svg({ drips: true }),
  'pmc.svg': svg({ word: false }),
  'pmc-drips.svg': svg({ word: false, drips: true }),
  'stern.svg': starSvg(),
  // symmetrischer Funkelstern für die Kategorie-Sterne der Webseite
  'funkel.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200"><path d="${L.starPath({ cx: 0, cy: 0, arms: [100, 100, 100, 100], waist: 9 })}" fill="#fff"/></svg>
`,
};
for (const [name, content] of Object.entries(files)) {
  await fs.writeFile(path.join(WEB, name), content);
  await fs.writeFile(path.join(OUT, name), content);
}
// Favicon: Stern auf Schwarz
await fs.writeFile(path.join(ROOT, 'site/img/favicon.svg'), starSvg({ bg: '#050505', size: 64 }));

// PNGs für Phil
const png = async (content, file, width) => sharp(Buffer.from(content), { density: 300 }).resize({ width }).png().toFile(path.join(OUT, file));
await png(svg(), 'pmc-logo-transparent.png', 2400);
await png(svg({ drips: true }), 'pmc-logo-drips-transparent.png', 2400);
await png(svg({ bg: '#050505' }), 'pmc-logo-schwarz.png', 2400);
await png(svg({ drips: true, bg: '#050505' }), 'pmc-logo-drips-schwarz.png', 2400);
// Instagram-Profilbild (quadratisch, Kreis-tauglich)
const square = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="1080" height="1080" fill="#050505"/>${inner}</svg>`;
const pmcOnly = await sharp(Buffer.from(svg({ word: false })), { density: 300 }).resize({ width: 760 }).png().toBuffer();
const meta = await sharp(pmcOnly).metadata();
await sharp(Buffer.from(square(''))).composite([{ input: pmcOnly, left: Math.round((1080 - meta.width) / 2), top: Math.round((1080 - meta.height) / 2) }])
  .png().toFile(path.join(OUT, 'instagram-profilbild.png'));
await sharp(Buffer.from(starSvg({ bg: '#050505', size: 1024 }))).png().toFile(path.join(OUT, 'stern-icon.png'));

// Vorschaubild für Links (WhatsApp, Instagram, …): 1200×630
const ogLogo = await sharp(Buffer.from(svg()), { density: 300 }).resize({ height: 440 }).png().toBuffer();
const ogMeta = await sharp(ogLogo).metadata();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#050506' } })
  .composite([{ input: ogLogo, left: Math.round((1200 - ogMeta.width) / 2), top: Math.round((630 - ogMeta.height) / 2) }])
  .png().toFile(path.join(WEB, 'og.png'));

console.log('✔  Logos erzeugt in logo/ und site/img/logo/');
