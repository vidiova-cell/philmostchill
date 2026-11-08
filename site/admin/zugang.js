/*
 * philmostchill Admin – Anmeldung per Kennwort
 *
 * Der GitHub-Schlüssel liegt verschlüsselt in admin/zugang.json:
 *   Schlüssel = PBKDF2-SHA256(Kennwort, Salz, 600.000 Runden) → AES-256-GCM
 * Die Datei ist öffentlich; ohne Kennwort ist sie wertlos. Die vielen Runden
 * machen jeden Rateversuch teuer – ein langes Kennwort ist trotzdem Pflicht.
 *
 * Bewusst ohne DOM-Code, damit es auch in Node getestet werden kann.
 */
(function (root) {
  'use strict';

  const ITERATIONS = 600000;
  const MIN_LENGTH = 12;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const toB64 = (bytes) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };
  const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function deriveKey(password, salt, iterations) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
    );
  }

  // Schlüssel + Kennwort → Inhalt für zugang.json
  async function encryptToken(token, password) {
    if (password.length < MIN_LENGTH) throw new Error(`Das Kennwort braucht mindestens ${MIN_LENGTH} Zeichen.`);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, ITERATIONS);
    const payload = enc.encode(JSON.stringify({ token, created: new Date().toISOString() }));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload));
    return { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, cipher: 'AES-256-GCM', salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
  }

  // zugang.json + Kennwort → Schlüssel (wirft bei falschem Kennwort)
  async function decryptToken(file, password) {
    const key = await deriveKey(password, fromB64(file.salt), file.iterations || ITERATIONS);
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(file.iv) }, key, fromB64(file.data));
      return JSON.parse(dec.decode(plain)).token;
    } catch (e) {
      const err = new Error('Das Kennwort stimmt nicht.');
      err.wrongPassword = true;
      throw err;
    }
  }

  // Gut merkbares, aber starkes Kennwort: 4 Wörter + Zahl (≈ 38 Bit + 600.000 Runden)
  const WORDS = ('Anker Apfel Asche Atlas Bach Ballon Banane Bart Berg Birke Blitz Blume Boje Boot Brief Brille Brot Brunnen Buch Burg ' +
    'Dach Dampf Delfin Docht Donner Drache Dschungel Dose Eiche Eimer Eis Elch Ente Erbse Falke Farn Feder Feld Fels Fenster ' +
    'Feuer Fichte Fisch Flamme Flasche Floss Flagge Fluss Fohlen Frosch Fuchs Funke Gabel Garten Geige Gipfel Glas Glocke Gold Gras ' +
    'Gurke Hafen Hagel Hahn Hammer Hase Hecke Heft Held Helm Himmel Hirsch Honig Horn Hund Hose Igel Insel Jacke Jaguar ' +
    'Kaffee Kaktus Kamel Kanu Kapelle Karte Kerze Kessel Kiesel Kiste Klee Knopf Koffer Komet Korb Krabbe Kran Krone Kugel Kuppel ' +
    'Lager Lampe Laterne Laub Leiter Lerche Licht Lilie Linde Lachs Luchs Mantel Marmor Maus Meer Melone Mond Moos Mixer Muschel ' +
    'Nebel Nest Netz Nudel Oase Ofen Orgel Otter Palme Panda Papier Pferd Pfeil Pilz Pinsel Planet Polar Puls Quelle Rabe ' +
    'Radio Rakete Regen Reh Riff Ring Rose Rubin Sand Sattel Schal Schiff Schnee Schwan Segel Silber Sofa Sonne Spiegel Stein ' +
    'Stern Stiefel Storch Strand Strom Sturm Tango Tanne Teich Tiger Topf Traum Trommel Tulpe Turm Ufer Uhr Vogel Vulkan Wal ' +
    'Wald Walze Wanne Welle Wiese Wind Wolke Wolle Wurzel Wespe Zebra Zelt Ziege Zimt Zirkus Zitrone Zucker Zweig Zwiebel').split(' ');
  function suggestPassword() {
    const r = crypto.getRandomValues(new Uint32Array(5));
    const words = [0, 1, 2, 3].map((i) => WORDS[r[i] % WORDS.length]);
    return words.join('-') + '-' + (10 + (r[4] % 90));
  }

  root.PMCZugang = { encryptToken, decryptToken, suggestPassword, MIN_LENGTH, ITERATIONS };
})(typeof window !== 'undefined' ? window : globalThis);
