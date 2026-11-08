# philmostchill

Fotografie-Portfolio als Universum. Auf der Startseite zeichnet sich der Name
**philmostchill** als Sternbild an den Himmel. Die hellen Sterne um ihn herum sind
Kategorien, ein Klick darauf startet einen Warp in die jeweilige Galerie. Unten
rechts sitzt das echte Sternbild **Waage** (Phils Sternzeichen), dahinter steckt „Über Phil“.

Die Seite ist komplett statisch: HTML, CSS und JavaScript, ohne Framework und
ohne Build-Schritt. Sie läuft deshalb auf jedem Webspace und auch auf kostenlosen
Hostern wie Vercel, Netlify, Cloudflare Pages oder GitHub Pages.

```
site/              ← DAS ist die Webseite (dieser Ordner wird veröffentlicht)
  index.html       Startseite (Universum)
  galerie.html     Galerie einer Kategorie (?k=natur …)
  css/style.css    Design
  js/data.js       ✏️  Kategorien, Texte, Farben, Positionen der Sterne
  js/photos.js     ⚙️  automatisch erzeugt – nicht von Hand bearbeiten
  js/sky.js        Sternenhimmel, Sternbild-Schrift, Warp-Effekt
  img/fotos/       ⚙️  automatisch erzeugte, verkleinerte Fotos (WebP)
  fonts/           Schriften lokal eingebunden (keine Google-Server → DSGVO-freundlich)
fotos/             📷 HIER kommen Phils Original-Fotos rein (bleiben privat)
  natur/ stadt/ nacht/ menschen/ unterwegs/
tools/fotos.mjs    Foto-Pipeline
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

## Fotos hinzufügen

1. Fotos in den passenden Ordner legen, z. B. `fotos/natur/`.
   JPG, PNG und WebP gehen. iPhone-HEIC-Bilder vorher als JPG exportieren.
2. Ausführen:
   ```bash
   npm run fotos
   ```
   Das Skript dreht die Bilder richtig, verkleinert sie (800 px für die Vorschau,
   2000 px für die Vollansicht), speichert sie als WebP und **entfernt alle
   Metadaten, auch den GPS-Standort**. Danach schreibt es `site/js/photos.js` neu.
3. Fertig, die Seite neu laden.

**Titel:** Aus dem Dateinamen wird der Titel (`nebel-im-wald.jpg` → „Nebel im Wald“).
Handy-Namen wie `IMG_1234.jpg` bekommen keinen Titel. Eigene Titel und die
Reihenfolge lassen sich über `fotos/<kategorie>/titel.json` festlegen:

```json
{
  "IMG_1234.jpg": "Nebel im Wald",
  "IMG_1301.jpg": "Spiegelsee"
}
```

**Platzhalter entfernen:** Die Bilder `platzhalter-*.jpg` sind KI-generierte
Platzhalter für den Entwurf. Einfach löschen (und ihre Zeilen aus `titel.json`
nehmen), dann `npm run fotos` ausführen.

## Kategorien ändern

In `site/js/data.js` stehen Name, Beschreibung, Farbe und die Position jedes
Sterns: `pos` gilt für breite Bildschirme, `posNarrow` fürs Handy hochkant
(Werte von 0 bis 1). Für eine neue Kategorie einen Eintrag hinzufügen und
einen gleichnamigen Ordner in `fotos/` anlegen.

## Veröffentlichen

Der Ordner `site/` ist die fertige Webseite.

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

- [ ] Echte Fotos statt KI-Platzhalter
- [ ] „Über Phil“-Text und Kontaktlinks (Instagram?) in `site/js/data.js` eintragen
- [ ] Impressum/Datenschutz prüfen, sobald die Seite öffentlich ist und z. B. für Aufträge wirbt
- [ ] Vorschaubild für Social Media (`og:image`)
