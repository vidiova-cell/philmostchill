/*
 * philmostchill Admin – Speicher-Schicht
 *
 * Liest und schreibt die Inhalte direkt im GitHub-Repository. Jede
 * Veröffentlichung ist EIN Commit (alle Fotos + Texte zusammen); danach
 * baut GitHub Pages die Seite automatisch neu.
 *
 * Bewusst ohne DOM-Code, damit das Modul auch in Node getestet werden kann.
 */
(function (root) {
  'use strict';

  const API = 'https://api.github.com';

  // ---------- Hilfsfunktionen ----------
  function b64ToUtf8(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  async function blobToB64(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
    return btoa(bin);
  }

  // "/* … */ window.NAME = { …JSON… };" ⇄ Objekt
  function parseWrapped(text) {
    const eq = text.indexOf('= ');
    const start = text.indexOf('{', eq);
    const end = text.lastIndexOf('}');
    if (eq < 0 || start < 0 || end < start) throw new Error('Datei hat ein unerwartetes Format.');
    return { head: text.slice(0, start), obj: JSON.parse(text.slice(start, end + 1)) };
  }
  function stringifyWrapped(head, obj) { return head + JSON.stringify(obj, null, 2) + ';\n'; }

  // ---------- GitHub-Zugriff ----------
  function createGitHubStore(cfg) {
    const { owner, repo, branch, token } = cfg;
    const R = `/repos/${owner}/${repo}`;

    async function gh(path, opts = {}) {
      const res = await fetch(API + path, {
        ...opts,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
      if (!res.ok) {
        let msg = '';
        try { msg = (await res.json()).message || ''; } catch (e) { /* leer */ }
        const err = new Error(`GitHub ${res.status}: ${msg}`);
        err.status = res.status;
        throw err;
      }
      return res.status === 204 ? null : res.json();
    }

    async function readFile(path) {
      const f = await gh(`${R}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`);
      return { text: b64ToUtf8(f.content), sha: f.sha };
    }

    return {
      kind: 'github',

      // Prüft Zugang: gibt den Benutzernamen zurück oder wirft einen Fehler
      async checkAccess() {
        const info = await gh(R);
        if (!info.permissions || !info.permissions.push) {
          const e = new Error('Dieser Schlüssel darf das Repository nicht verändern.');
          e.status = 403;
          throw e;
        }
        let login = '';
        try { login = (await gh('/user')).login; } catch (e) { /* fein-granulare Schlüssel dürfen /user evtl. nicht */ }
        return { login };
      },

      // Lädt Inhalte + Fotoliste
      async load(paths) {
        const [d, p] = await Promise.all([readFile(paths.data), readFile(paths.photos)]);
        const data = parseWrapped(d.text), photos = parseWrapped(p.text);
        return {
          data: data.obj, photos: photos.obj,
          meta: { dataHead: data.head, photosHead: photos.head, dataSha: d.sha, photosSha: p.sha },
        };
      },

      /*
       * Veröffentlicht alles als einen Commit.
       *  files:   [{ path, text } | { path, blob }]
       *  deletes: [path, …]
       *  expect:  { [path]: blobSha } – Schutz gegen gleichzeitige Änderungen
       */
      async publish({ files, deletes, message, expect, onProgress }) {
        const step = (t) => onProgress && onProgress(t);
        step('Verbinde mit GitHub …');
        const ref = await gh(`${R}/git/ref/heads/${encodeURIComponent(branch)}`);
        const parentSha = ref.object.sha;
        const parent = await gh(`${R}/git/commits/${parentSha}`);

        // Wurde in der Zwischenzeit etwas anderes gespeichert?
        for (const [path, sha] of Object.entries(expect || {})) {
          const cur = await gh(`${R}/contents/${encodeURI(path)}?ref=${parentSha}`).catch(() => null);
          if (cur && cur.sha !== sha) {
            const e = new Error('Inzwischen wurde etwas anderes gespeichert. Bitte die Seite neu laden und die Änderung wiederholen.');
            e.conflict = true;
            throw e;
          }
        }

        const tree = [];
        let n = 0;
        for (const f of files) {
          n++;
          step(f.blob ? `Lade Foto-Dateien hoch (${n}/${files.length}) …` : 'Speichere Texte …');
          const blob = f.blob
            ? await gh(`${R}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: await blobToB64(f.blob), encoding: 'base64' }) })
            : await gh(`${R}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: f.text, encoding: 'utf-8' }) });
          tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
        }
        for (const path of deletes || []) tree.push({ path, mode: '100644', type: 'blob', sha: null });

        step('Erstelle Veröffentlichung …');
        const newTree = await gh(`${R}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
        const commit = await gh(`${R}/git/commits`, {
          method: 'POST',
          body: JSON.stringify({ message, tree: newTree.sha, parents: [parentSha] }),
        });
        await gh(`${R}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
        return { sha: commit.sha };
      },

      // Status der Veröffentlichung (GitHub Actions) für einen Commit
      async deployStatus(sha) {
        const runs = await gh(`${R}/actions/runs?head_sha=${sha}&per_page=5`);
        const run = (runs.workflow_runs || [])[0];
        if (!run) return { state: 'waiting' };
        if (run.status !== 'completed') return { state: 'running' };
        return { state: run.conclusion === 'success' ? 'live' : 'failed', url: run.html_url };
      },

      // Neuere Dateiversionen nach dem Speichern (für erneutes Speichern ohne Neuladen)
      async fileSha(path) { return (await readFile(path)).sha; },
    };
  }

  root.PMCStore = { createGitHubStore, parseWrapped, stringifyWrapped, blobToB64, b64ToUtf8 };
})(typeof window !== 'undefined' ? window : globalThis);
