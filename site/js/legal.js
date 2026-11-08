/* philmostchill – Impressum & Datenschutz: Angaben aus data.js einsetzen (im Admin pflegbar) */
(function () {
  'use strict';
  const legal = (window.PMC && window.PMC.legal) || {};
  const isPlaceholder = (v) => !v || /^\s*\[.*\]\s*$/.test(v);
  let placeholders = false;

  document.querySelectorAll('[data-legal]').forEach((el) => {
    const v = legal[el.dataset.legal] || '';
    if (isPlaceholder(v)) placeholders = placeholders || el.dataset.legal !== 'phone';
    if (el.dataset.link === 'mailto' && !isPlaceholder(v)) {
      const a = document.createElement('a');
      a.href = 'mailto:' + v;
      a.textContent = v;
      el.replaceChildren(a);
    } else {
      el.textContent = v;
      el.classList.toggle('is-placeholder', isPlaceholder(v));
    }
  });
  // Optionale Zeilen (z. B. Telefon) nur zeigen, wenn ausgefüllt
  document.querySelectorAll('[data-legal-optional]').forEach((el) => {
    el.hidden = isPlaceholder(legal[el.dataset.legalOptional]);
  });
  const warn = document.querySelector('.legal-warn');
  if (warn) warn.hidden = !placeholders;
  document.querySelectorAll('.g-year').forEach((el) => { el.textContent = new Date().getFullYear(); });

  const sky = window.PMCSky(document.getElementById('sky'), { density: 0.45, parallaxVars: true });
  window.PMCSky.bindWarpLinks(sky);
})();
