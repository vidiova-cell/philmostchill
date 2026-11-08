# PMC Admin – Anleitung für Phil

Mit dem Admin pflegst du deine Webseite direkt vom iPhone aus:
**https://vidiova-cell.github.io/philmostchill/admin/**

## Einmalig einrichten (ca. 5 Minuten)

1. **GitHub-Zugang**: Du brauchst einen GitHub-Account mit Schreibzugriff auf das
   Repository `vidiova-cell/philmostchill`. Am einfachsten lädt dich der Besitzer
   als *Collaborator* ein (Repository → Settings → Collaborators → Add people),
   und du nimmst die Einladung per Mail an.
2. **Schlüssel erstellen** (am besten am Computer, geht aber auch am Handy):
   github.com → Profilbild → **Settings** → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
   - Name: `PMC Admin`, Ablaufdatum nach Wunsch (z. B. 1 Jahr)
   - **Resource owner:** `vidiova-cell`
   - **Repository access:** *Only select repositories* → `philmostchill`
   - **Permissions → Repository permissions:**
     **Contents: Read and write** · **Actions: Read-only**
   - **Generate token**, dann den Schlüssel (beginnt mit `github_pat_`) kopieren.
     Er wird nur einmal angezeigt, also am besten gleich im Passwort-Manager speichern.
3. **Am iPhone anmelden**: Admin-Link in Safari öffnen, Schlüssel einfügen, *Anmelden*.
   Danach bleibt das iPhone angemeldet.
4. **Als App ablegen**: In Safari auf *Teilen* tippen, dann *Zum Home-Bildschirm*.
   Der Admin erscheint jetzt mit dem goldenen Stern als eigene App.

## So funktioniert's

- **Fotos hinzufügen**: Kategorie öffnen → *Fotos hinzufügen* → aus der Mediathek
  auswählen (mehrere gleichzeitig gehen). Die Fotos werden direkt auf dem iPhone
  verkleinert. Dabei werden **Standort- und Kameradaten entfernt**. Neue Fotos
  landen vorne.
- **Foto bearbeiten**: Foto antippen. Dort kannst du einen Titel vergeben, es nach
  vorn oder hinten schieben oder löschen.
- **KI-Platzhalter loswerden**: In jeder Kategorie gibt es den Knopf
  *Alle KI-Platzhalter entfernen*.
- **Texte & Farbe** einer Kategorie: Name, Beschreibung und Farbe des Sterns stehen
  unten auf der Kategorie-Seite.
- **Über Phil**: Überschrift, Text (eine Leerzeile beginnt einen neuen Absatz)
  sowie Links zu Instagram, E-Mail und anderem.

**Wichtig:** Änderungen sammeln sich erst einmal. Unten steht dann z. B.
„3 Änderungen · Noch nicht live“. Mit **Veröffentlichen** geht alles zusammen raus,
und nach etwa **einer Minute** ist es auf der Webseite. Die Leiste zeigt
„Alles ist live ✓“, sobald es so weit ist. Falls du dich vertan hast, kannst du auf
der Startseite des Admins *Änderungen verwerfen* tippen.

## Gut zu wissen

- Eine Veröffentlichung braucht Netz. Große Fotos am besten im WLAN hochladen.
- Die Webseite merkt sich Dateien ein paar Minuten. Wenn du eine Änderung nicht
  gleich siehst, einmal neu laden.
- Abmelden geht über das **⋯**-Menü oben rechts. Hast du dein iPhone verloren,
  lösche den Schlüssel auf GitHub (Settings → Developer settings → Fine-grained tokens).
  Dann ist er sofort wertlos.
- Alles, was du im Admin machst, ist in der Versionsgeschichte auf GitHub
  gespeichert und lässt sich notfalls zurückholen.
