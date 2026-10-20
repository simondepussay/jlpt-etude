// Vérifie les lots de grammaire (lot*.js) puis les ajoute aux fichiers de web/data.
// Sans effet sur un point déjà présent (même numéro) : on peut relancer sans risque.
// Usage : node outils/ajouts-grammaire/fusionner.js
const fs = require("node:fs");
const path = require("node:path");

const DATA = path.join(__dirname, "..", "..", "web", "data");
const lots = fs.readdirSync(__dirname).filter((f) => /^lot\d+\.js$/.test(f)).sort();
const ajouts = lots.flatMap((f) => require(path.join(__dirname, f)));

global.window = {};
require(path.join(DATA, "n1-grammaire.js"));
const existants = window.DATA["N1-grammaire"];
const cats = new Set(window.DATA["N1-grammaire-cats"].map((c) => c.id));
const dejaN = new Set(existants.map((g) => g.n));
const dejaP = new Set(existants.map((g) => g.p));

// Contrôles : on s’arrête à la première erreur
const vus = new Set();
for (const g of ajouts) {
  const ou = `n°${g.n} ${g.p}`;
  const err = (m) => { throw new Error(`${ou} : ${m}`); };
  if (vus.has(g.n)) err("numéro en double dans les lots");
  vus.add(g.n);
  if (!cats.has(g.cat)) err(`catégorie inconnue ${g.cat}`);
  if (!dejaN.has(g.n) && dejaP.has(g.p)) err("forme déjà présente");
  for (const f of ["s", "e"]) if (!Array.isArray(g[f]) || g[f].length !== 2 || !g[f][0] || !g[f][1]) err(`${f} : il faut [fr, en]`);
  if (!g.f) err("construction manquante");
  if (g.ex.length < 2) err("au moins 2 exemples");
  for (const x of g.ex) {
    if (x.length !== 3 || !x[1] || !x[2]) err(`exemple sans traductions : ${x[0]}`);
    if (!/\[\[.+?\]\]/.test(x[0])) err(`forme non repérée par [[ ]] : ${x[0]}`);
  }
  if (!g.q.length) err("au moins un QCM");
  for (const [q, c, fr, en] of g.q) {
    if ((q.match(/＿＿＿/g) || []).length !== 1) err(`le QCM doit avoir un seul trou : ${q}`);
    if (c.length !== 4 || new Set(c).size !== 4) err(`4 choix distincts : ${q}`);
    if (!fr || !en) err(`QCM sans traductions : ${q}`);
  }
}

const nouveaux = ajouts.filter((g) => !dejaN.has(g.n));
if (!nouveaux.length) { console.log("Rien à ajouter : tous les points sont déjà présents."); process.exit(0); }

const J = JSON.stringify;
const insere = (fichier, avant, texte) => {
  const p = path.join(DATA, fichier);
  const s = fs.readFileSync(p, "utf8");
  const i = s.lastIndexOf(avant);
  if (i < 0) throw new Error(`fin introuvable dans ${fichier}`);
  fs.writeFileSync(p, s.slice(0, i).replace(/\s*$/, "") + texte + "\n" + s.slice(i));
};

// n1-grammaire.js (français)
insere("n1-grammaire.js", "];", ",\n/* ───────── 92– · compléments GrammarOtter ───────── */\n" + nouveaux.map((g) =>
  `{n:${g.n},cat:${J(g.cat)},p:${J(g.p)},${g.y ? `y:${J(g.y)},` : ""}f:${J(g.f)},s:${J(g.s[0])},\n e:${J(g.e[0])},\n ex:[${g.ex.map((x) => `[${J(x[0])},${J(x[1])}]`).join(",\n     ")}],\n q:[${g.q.map(([q, c]) => `[${J(q)},${J(c)}]`).join(",\n    ")}]}`
).join(",\n"));

// n1-grammaire-en.js (anglais)
insere("n1-grammaire-en.js", "};", ",\n" + nouveaux.map((g) =>
  `${g.n}: { s: ${J(g.s[1])},\n  e: ${J(g.e[1])},\n  ex: [${g.ex.map((x) => J(x[2])).join(", ")}] }`
).join(",\n"));

// Traductions des phrases de QCM complétées
const phrases = nouveaux.flatMap((g) => g.q.map(([q, c, fr, en]) => [q.replace("＿＿＿", c[0]), fr, en]));
insere("n1-grammaire-trad.js", "};", ",\n" + phrases.map(([jp, fr]) => ` ${J(jp)}: ${J(fr)}`).join(",\n"));
insere("n1-grammaire-trad-en.js", "};", ",\n" + phrases.map(([jp, , en]) => ` ${J(jp)}: ${J(en)}`).join(",\n"));

console.log(`${nouveaux.length} points ajoutés (n°${nouveaux[0].n}–${nouveaux.at(-1).n}), ${phrases.length} phrases traduites.`);
