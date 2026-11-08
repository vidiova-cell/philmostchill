# Admin · philmostchill

Mit dem Admin pflegt Phil seine Webseite direkt vom iPhone aus, nur mit einem Kennwort:
**https://vidiova-cell.github.io/philmostchill/admin/**

---

## Für Phil

### Einmal einrichten (2 Minuten)

1. Den Admin-Link in **Safari** öffnen und dein **Kennwort** eingeben.
2. Wenn Safari fragt, ob das Kennwort gesichert werden soll: **Ja**.
   Ab dann reicht künftig **Face ID**.
3. Unten auf **Teilen** tippen, dann **Zum Home-Bildschirm**. Der Admin liegt jetzt
   als App mit dem goldenen Stern auf deinem iPhone.

### So funktioniert's

- **Fotos hinzufügen**: Kategorie öffnen → *Fotos hinzufügen* → aus der Mediathek
  auswählen (mehrere gleichzeitig gehen). Die Fotos werden auf dem iPhone verkleinert,
  **Standort- und Kameradaten werden entfernt**. Neue Fotos landen vorne.
- **Foto bearbeiten**: Foto antippen. Dort kannst du einen Titel vergeben, es nach
  vorn oder hinten schieben oder löschen.
- **KI-Platzhalter loswerden**: In jeder Kategorie gibt es den Knopf
  *Alle KI-Platzhalter entfernen*.
- **Texte & Farbe** einer Kategorie stehen unten auf der Kategorie-Seite.
- **Über Phil**: Überschrift, Text (eine Leerzeile beginnt einen neuen Absatz) und
  Links zu Instagram, E-Mail und anderem.

- **Bildschutz** (Startseite des Admins → *Wasserzeichen & Co.*):
  - **Wasserzeichen auf Fotos** an/aus, mit eigenem Text (z. B. „© philmostchill“) und Stil:
    *Dezent* (unten rechts) oder *Kräftig* (diagonal über das ganze Bild). Ist es an, bekommt
    jedes Foto automatisch eine Fassung mit Wasserzeichen, und die Webseite zeigt nur noch diese.
    Ausschalten geht jederzeit, dann sind wieder die Fotos ohne Wasserzeichen zu sehen.
  - **Speichern & Kopieren sperren**: kein Rechtsklick-Speichern, kein Ziehen, kein „Foto sichern“
    per langem Drücken. Screenshots lassen sich trotzdem nie verhindern.
- **Impressum & Datenschutz**: Name, Anschrift und E-Mail eintragen. Solange dort Platzhalter
  stehen, zeigen die Seiten einen Entwurf-Hinweis.

**Wichtig:** Änderungen sammeln sich erst einmal. Unten steht dann z. B.
„3 Änderungen · Noch nicht live“. Mit **Veröffentlichen** geht alles zusammen raus,
und nach etwa **einer Minute** ist es auf der Webseite. Danach zeigt die Leiste
„Alles ist live ✓“. Falls du dich vertan hast, kannst du auf der Startseite des
Admins *Änderungen verwerfen* tippen.

### Gut zu wissen

- Große Fotos am besten im WLAN hochladen.
- Die Webseite merkt sich Dateien ein paar Minuten. Wenn du eine Änderung nicht
  sofort siehst, einmal neu laden.
- Alles, was du im Admin machst, ist in der Versionsgeschichte gespeichert und lässt
  sich notfalls zurückholen.

---

## Für die Einrichtung (einmalig, technisch)

Der Admin speichert direkt im GitHub-Repository. Dafür braucht er einen GitHub-Schlüssel.
Phil sieht ihn nie. Der Schlüssel wird **mit Phils Kennwort verschlüsselt**
(PBKDF2-SHA256 mit 600.000 Runden, AES-256-GCM) und liegt als `site/admin/zugang.json`
im Repo. Phils Kennwort entschlüsselt ihn auf seinem iPhone.

### 1. Schlüssel erstellen

github.com (als `vidiova-cell`) → Profilbild → **Settings** → **Developer settings** →
**Personal access tokens** → **Fine-grained tokens** → **Generate new token**

- Name: `PMC Admin`, Ablauf: z. B. 1 Jahr. Danach muss das Kennwort mit einem neuen
  Schlüssel neu eingerichtet werden.
- **Repository access:** *Only select repositories* → `philmostchill`
- **Repository permissions:** **Contents: Read and write** · **Actions: Read-only**.
  Nichts weiter. Ohne „Workflows“-Recht kann der Schlüssel auch die
  Veröffentlichungs-Einstellungen nicht verändern.

### 2. Kennwort festlegen

https://vidiova-cell.github.io/philmostchill/admin/#/einrichten öffnen, den Schlüssel
einfügen, auf **Sicheres Kennwort vorschlagen** tippen (oder ein eigenes mit mindestens
12 Zeichen eingeben) und dann **Kennwort speichern**. Nach etwa einer Minute ist es
aktiv. Das Kennwort Phil am besten persönlich geben.

**Kennwort ändern:** Im Admin über **⋯ → Kennwort ändern**. Das alte gilt danach
nicht mehr. Auf schon angemeldeten Geräten bleibt die Anmeldung bestehen, bis man sich
abmeldet.

### Sicherheit, ehrlich eingeschätzt

- `zugang.json` ist öffentlich. Wer sie hat, kann offline Kennwörter durchprobieren.
  Die 600.000 Runden machen jeden Versuch teuer. Bei einem Kennwort aus 4 zufälligen
  Wörtern plus Zahl (wie vorgeschlagen) dauert das selbst mit einer starken
  Grafikkarte Jahre. Ein kurzes oder geratenes Kennwort („phil1990“) wäre dagegen schnell
  geknackt, deshalb sind mindestens 12 Zeichen Pflicht.
- Im schlimmsten Fall könnte jemand **nur diese Webseite** verändern. Alles lässt sich
  über die Git-Historie zurückholen.
- **Notbremse:** Den Schlüssel auf GitHub löschen (Settings → Developer settings →
  Fine-grained tokens). Dann ist er sofort wertlos, auch auf einem verlorenen iPhone.
  Danach einen neuen Schlüssel erstellen und das Kennwort neu einrichten.
- Noch sicherer wäre eine kleine Server-Funktion (z. B. Cloudflare Worker), die den
  Schlüssel geheim hält und Anmeldeversuche begrenzt. Das bräuchte ein weiteres Konto,
  für ein Portfolio ist es aber nicht nötig.
