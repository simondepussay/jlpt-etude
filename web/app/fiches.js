/* Fiches de grammaire imprimables. */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hl = (s) => esc(s).replace(/\[\[(.+?)\]\]/g, "<mark>$1</mark>");
  const G = window.DATA["N1-grammaire"].slice().sort((a, b) => a.n - b.n), C = window.DATA["N1-grammaire-cats"];
  let h = `<div class="recap-wrap"><h2>Tableau récapitulatif (${G.length} points)</h2><table class="recap"><tr><th>#</th><th>Forme</th><th>Sens</th></tr>` +
    G.map((g) => `<tr><td>${g.n}</td><td class="jp">${esc(g.p)}</td><td>${esc(g.s)}</td></tr>`).join("") + `</table></div>`;
  for (const c of C) {
    const pts = G.filter((g) => g.cat === c.id);
    if (!pts.length) continue;
    h += `<h2 class="cathead"><span class="jp">${esc(c.jp)}</span> · ${esc(c.fr)}</h2>`;
    h += pts.map((g) => `<article class="glesson"><div class="g-top"><span class="pill">${g.n}</span></div>
      <h3 class="g-pattern jp">${esc(g.p)}</h3><p class="g-sens">${esc(g.s)}</p>
      <div class="g-box"><h4>接続 · Construction</h4><div class="jp">${esc(g.f)}</div></div>
      <div class="g-box"><h4>Explication</h4><p>${esc(g.e)}</p></div>
      <div class="g-box"><h4>例文 · Exemples</h4>${g.ex.map(([jp, fr]) => `<div class="exline"><div><div class="jp">${hl(jp)}</div><div class="fr-trad">${esc(fr)}</div></div></div>`).join("")}</div>
      ${g.t ? `<div class="g-box warn"><h4>⚠︎ Piège</h4><p>${esc(g.t)}</p></div>` : ""}</article>`).join("");
  }
  document.getElementById("out").innerHTML = h;
  document.getElementById("print").addEventListener("click", () => print());
