# philmostchill

Fotografie-Portfolio als Universum. Auf der Startseite zeichnen die Sterne das
**Logo-P** an den Himmel, daneben leuchtet der goldene Logo-Stern, darunter steht PHILMOSTCHILL. Die hellen Sterne
ringsum sind Kategorien, ein Klick darauf startet einen Warp in die jeweilige Galerie.
Unten rechts sitzt das echte Sternbild **Waage** (Phils Sternzeichen), dahinter steckt
„Über Phil“.

- **Live:** https://vidiova-cell.github.io/philmostchill/ (jeder Push auf `main` geht nach ca. 1 Min. live)
- **Admin fürs iPhone:** https://vidiova-cell.github.io/philmostchill/admin/ → Anleitung in [ADMIN.md](ADMIN.md)

Die Seite ist komplett statisch: HTML, CSS und JavaScript, ohne Framework und
ohne Build-Schritt. Sie läuft deshalb auf jedem Webspace und auch auf kostenlosen
Hostern wie Vercel, Netlify, Cloudflare Pages oder GitHub Pages.

```
site/              ← DAS ist die Webseite (dieser Ordner wird veröffentlicht)
  index.html       Startseite (Universum)
  galerie.html     Galerie einer Kategorie (?k=natur …)
  css/style.css    Design
  admin/           📱 Admin-Oberfläche (Fotos, Texte, Über Phil) – siehe ADMIN.md
  js/data.js       ✏️  Kategorien, Texte, Farben, Positionen der Sterne (JSON-Format)
  js/photos.js     ⚙️  Fotoliste – gepflegt über den Admin und `npm run fotos`
  js/pmc-logo.js   Logo (P + Stern) als Geometrie (für Sternbild und Logo-Export)
  js/sky.js        Sternenhimmel, Sternbild-Schrift, Warp-Effekt
  img/fotos/       ⚙️  automatisch erzeugte, verkleinerte Fotos (WebP)
  fonts/           Schriften lokal eingebunden (keine Google-Server → DSGVO-freundlich)
fotos/             📷 HIER kommen Phils Original-Fotos rein (bleiben privat)
  natur/ stadt/ nacht/ menschen/ unterwegs/
logo/              🎨 fertige Logo-Dateien (SVG/PNG, Instagram-Profilbild)
tools/fotos.mjs    Foto-Pipeline (Import vom PC)
tools/logo.mjs     Logo-Export (`npm run logo`)
tools/serve.mjs    lokaler Testserver
```

## Lokal ansehen

Einmalig: [Node.js](https://nodejs.org) installieren, dann im Projektordner:

```bash
npm install
```

```bash
npm run dev
```

Danach im Browser **http://localhost:4321** öffnen.
(Zur Not geht auch ein Doppelklick auf `site/index.html`.)

Den Admin lokal ohne GitHub ausprobieren (es wird nichts gespeichert):
**http://localhost:4321/admin/?demo**

## Fotos hinzufügen

**Normalfall: über den Admin** (am iPhone), siehe [ADMIN.md](ADMIN.md). Die Fotos werden
dort direkt auf dem Gerät verkleinert, Metadaten inkl. GPS fallen weg, und alles geht
mit „Veröffentlichen“ als ein Commit live.

**Alternativ vom PC (z. B. viele Fotos auf einmal):**

1. Fotos in den passenden Ordner legen, z. B. `fotos/natur/`.
   JPG, PNG und WebP gehen. iPhone-HEIC-Bilder vorher als JPG exportieren.
2. Ausführen:
   ```bash
   npm run fotos
   ```
   Das Skript dreht die Bilder richtig, verkleinert sie (800 px für die Vorschau,
   2000 px für die Vollansicht), speichert sie als WebP und **entfernt alle
   Metadaten, auch den GPS-Standort**. Neue Fotos werden in `site/js/photos.js`
   hinten angehängt. Fotos aus dem Admin, Reihenfolge und Titel bleiben unangetastet.
   Ein einmal importiertes und später gelöschtes Foto kommt nicht wieder
   (Merkliste: `fotos/.import-stand.json`).
3. Committen und pushen, dann ist es nach ca. 1 Minute live.

**Titel:** Aus dem Dateinamen wird der Titel (`nebel-im-wald.jpg` → „Nebel im Wald“).
Handy-Namen wie `IMG_1234.jpg` bekommen keinen Titel. Eigene Titel und die
Reihenfolge lassen sich über `fotos/<kategorie>/titel.json` festlegen:

```json
{
  "IMG_1234.jpg": "Nebel im Wald",
  "IMG_1301.jpg": "Spiegelsee"
}
```

**Platzhalter entfernen:** Die Bilder `platzhalter-*` sind KI-generierte Platzhalter.
Am einfachsten im Admin über „Alle KI-Platzhalter entfernen“.

## Kategorien ändern

Name, Beschreibung und Farbe gehen im Admin. Von Hand: In `site/js/data.js`
(gültiges JSON lassen!) stehen zusätzlich die Position jedes Sterns: `pos` gilt für breite Bildschirme, `posNarrow` fürs Handy hochkant
(Werte von 0 bis 1). Für eine neue Kategorie einen Eintrag hinzufügen und
einen gleichnamigen Ordner in `fotos/` anlegen.

## Veröffentlichen

Aktuell: **GitHub Pages**. Der Workflow `.github/workflows/pages.yml` veröffentlicht
`site/` bei jedem Push auf `main`. Ein Branch `design/logo-pmc` erscheint zusätzlich
unter `/vorschau/`.

Der Ordner `site/` ist die fertige Webseite und läuft auch woanders:

**Am schnellsten, ohne Konto-Gefummel: Netlify Drop**
Unter https://app.netlify.com/drop den Ordner `site/` ins Browserfenster ziehen.

**Vercel (empfohlen für später)**
1. Projekt auf GitHub hochladen. `.gitignore` sorgt dafür, dass die Original-Fotos lokal bleiben.
2. Auf https://vercel.com mit GitHub anmelden → „Add New Project“ → Repo auswählen.
3. Die Einstellungen kommen aus `vercel.json` (Ausgabeordner `site`, kein Build). Einfach „Deploy“ klicken.
4. Ab dann gilt: `npm run fotos` → committen → pushen. Vercel aktualisiert die Seite automatisch.

**Klassischer Webspace (z. B. Strato, IONOS, all-inkl)**
Den Inhalt von `site/` per FTP in das Webverzeichnis hochladen.

**Eigene Domain:** z. B. `philmostchill.de` registrieren und in Vercel bzw. Netlify verbinden.

## Noch offen / Ideen

- [ ] Echte Fotos statt KI-Platzhalter (über den Admin)
- [ ] „Über Phil“-Text und Kontaktlinks im Admin eintragen
- [ ] Zum Livegang `site/robots.txt` wieder für Suchmaschinen öffnen
- [ ] Impressum & Datenschutz: echte Angaben im Admin unter „Impressum & Datenschutz“ eintragen
      (Seiten `site/impressum.html` / `site/datenschutz.html`, Angaben in `data.js` → `legal`)
- [x] Vorschaubild für Social Media (`og:image`)
- [x] Admin-Oberfläche fürs iPhone
