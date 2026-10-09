/* Fiches de grammaire imprimables (?lang=fr ou ?lang=en). */
(function () {
  const en = new URLSearchParams(location.search).get("lang") === "en";
  const L = (fr, e) => (en ? e : fr);
  const E = window.DATA["N1-grammaire-en"] || {};
  const tr = (g, f) => (en && E[g.n] ? E[g.n][f] : g[f]);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hl = (s) => esc(s).replace(/\[\[(.+?)\]\]/g, "<mark>$1</mark>");
  const G = window.DATA["N1-grammaire"].slice().sort((a, b) => a.n - b.n), C = window.DATA["N1-grammaire-cats"];
  document.documentElement.lang = en ? "en" : "fr";
  document.title = L("Fiches grammaire N1", "N1 grammar sheets");
  document.getElementById("title").textContent = "文法 N1 · " + L("Fiches de grammaire", "Grammar sheets");
  document.getElementById("print").textContent = L("Imprimer / PDF", "Print / PDF");
  let h = `<div class="recap-wrap"><h2>${L("Tableau récapitulatif", "Summary table")} (${G.length} points)</h2><table class="recap"><tr><th>#</th><th>${L("Forme", "Form")}</th><th>${L("Sens", "Meaning")}</th></tr>` +
    G.map((g) => `<tr><td>${g.n}</td><td class="jp">${esc(g.p)}</td><td>${esc(tr(g, "s"))}</td></tr>`).join("") + `</table></div>`;
  for (const c of C) {
    const pts = G.filter((g) => g.cat === c.id);
    if (!pts.length) continue;
    h += `<h2 class="cathead"><span class="jp">${esc(c.jp)}</span> · ${esc(en ? (E.cats || {})[c.id] : c.fr)}</h2>`;
    h += pts.map((g) => `<article class="glesson"><div class="g-top"><span class="pill">${g.n}</span></div>
      <h3 class="g-pattern jp">${esc(g.p)}</h3><p class="g-sens">${esc(tr(g, "s"))}</p>
      <div class="g-box"><h4>接続 · Construction</h4><div class="jp">${esc(g.f)}</div></div>
      <div class="g-box"><h4>${L("Explication", "Explanation")}</h4><p>${esc(tr(g, "e"))}</p></div>
      <div class="g-box"><h4>例文 · ${L("Exemples", "Examples")}</h4>${g.ex.map(([jp, fr], i) => `<div class="exline"><div><div class="jp">${hl(jp)}</div><div class="fr-trad">${esc(en && E[g.n] ? E[g.n].ex[i] : fr)}</div></div></div>`).join("")}</div>
      ${tr(g, "t") ? `<div class="g-box warn"><h4>⚠︎ ${L("Piège", "Watch out")}</h4><p>${esc(tr(g, "t"))}</p></div>` : ""}</article>`).join("");
  }
  document.getElementById("out").innerHTML = h;
  document.getElementById("print").addEventListener("click", () => print());
})();
