/*
 * philmostchill – Foto-Pipeline
 *
 *   npm run fotos
 *
 * Liest alle Bilder aus fotos/<kategorie>/, und erzeugt daraus
 * webtaugliche Versionen in site/img/fotos/<kategorie>/:
 *   - richtig gedreht (Handy-Ausrichtung)
 *   - verkleinert (800 px Vorschau, 2000 px Vollbild) als WebP
 *   - OHNE Metadaten (EXIF, GPS-Standort, Kameradaten werden entfernt!)
 * Danach wird site/js/photos.js neu geschrieben.
 *
 * Titel: Dateiname wird zum Titel ("nebel-im-wald.jpg" → "Nebel im Wald").
 * Eigene Titel und Reihenfolge optional über fotos/<kategorie>/titel.json:
 *   { "IMG_1234.jpg": "Nebel im Wald" }
 * Dateien, die mit "platzhalter" beginnen, werden als Platzhalter markiert.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'fotos');
const OUT = path.join(ROOT, 'site', 'img', 'fotos');
const MANIFEST = path.join(ROOT, 'site', 'js', 'photos.js');
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.avif', '.heic', '.heif']);
const SIZES = { thumb: 800, full: 2000 };

const slugify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'foto';

function titleFromFile(name) {
  const base = name.replace(/\.[^.]+$/, '');
  if (/^(img|dsc|pxl|photo|image|whatsapp)[\s_-]?\d/i.test(base)) return '';
  const t = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function mtime(p) { try { return (await fs.stat(p)).mtimeMs; } catch { return 0; } }

async function main() {
  const dataSrc = await fs.readFile(path.join(ROOT, 'site', 'js', 'data.js'), 'utf8');
  const knownIds = [...dataSrc.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);

  await fs.mkdir(SRC, { recursive: true });
  const dirs = (await fs.readdir(SRC, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  const manifest = {};
  let made = 0, kept = 0;

  for (const dir of dirs) {
    if (!knownIds.includes(dir)) {
      console.warn(`⚠  Ordner "fotos/${dir}" hat keine passende Kategorie in site/js/data.js – übersprungen.`);
      continue;
    }
    const srcDir = path.join(SRC, dir);
    const outDir = path.join(OUT, dir);
    await fs.mkdir(outDir, { recursive: true });

    let titles = {};
    if (await exists(path.join(srcDir, 'titel.json'))) {
      titles = JSON.parse(await fs.readFile(path.join(srcDir, 'titel.json'), 'utf8'));
    }
    const files = (await fs.readdir(srcDir)).filter((f) => EXT.has(path.extname(f).toLowerCase()));
    // Reihenfolge: zuerst wie in titel.json, dann alphabetisch
    const order = Object.keys(titles);
    files.sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
      return a.localeCompare(b, 'de', { numeric: true });
    });

    const used = new Set();
    manifest[dir] = [];
    for (const file of files) {
      const src = path.join(srcDir, file);
      let slug = slugify(file.replace(/\.[^.]+$/, ''));
      while (used.has(slug)) slug += '-x';
      used.add(slug);
      const out = {
        thumb: path.join(outDir, `${slug}-${SIZES.thumb}.webp`),
        full: path.join(outDir, `${slug}-${SIZES.full}.webp`),
      };

      const srcTime = await mtime(src);
      const fresh = (await mtime(out.thumb)) > srcTime && (await mtime(out.full)) > srcTime;
      let meta;
      try {
        if (!fresh) {
          const img = sharp(src, { failOn: 'none' }).rotate(); // .rotate() = EXIF-Ausrichtung anwenden
          await img.clone().resize({ width: SIZES.full, height: SIZES.full, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82, effort: 5 }).toFile(out.full);
          await img.clone().resize({ width: SIZES.thumb, height: SIZES.thumb * 2, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 78, effort: 5 }).toFile(out.thumb);
          made++;
        } else kept++;
        meta = await sharp(out.full).metadata();
      } catch (e) {
        console.error(`✖  ${dir}/${file}: ${e.message}`);
        if (/heif|heic/i.test(file)) console.error('   Tipp: HEIC-Bilder (iPhone) vorher als JPG exportieren.');
        continue;
      }

      const rel = (p) => path.relative(path.join(ROOT, 'site'), p).split(path.sep).join('/');
      manifest[dir].push({
        thumb: rel(out.thumb),
        full: rel(out.full),
        w: meta.width,
        h: meta.height,
        title: titles[file] ?? titleFromFile(file),
        ...(/^platzhalter/i.test(file) ? { placeholder: true } : {}),
      });
    }

    // Verwaiste Ausgabedateien aufräumen
    const keep = new Set(manifest[dir].flatMap((p) => [path.basename(p.thumb), path.basename(p.full)]));
    for (const f of await fs.readdir(outDir)) if (!keep.has(f)) await fs.rm(path.join(outDir, f));
  }

  const body = '/* Automatisch erzeugt von `npm run fotos` – nicht von Hand bearbeiten. */\n' +
    'window.PMC_PHOTOS = ' + JSON.stringify(manifest, null, 2) + ';\n';
  await fs.writeFile(MANIFEST, body);

  const total = Object.values(manifest).reduce((s, l) => s + l.length, 0);
  console.log(`✔  ${total} Fotos in ${Object.keys(manifest).length} Kategorien (${made} neu verarbeitet, ${kept} unverändert).`);
  console.log('   Metadaten (inkl. GPS) wurden entfernt.');
}

main().catch((e) => { console.error(e); process.exit(1); });
