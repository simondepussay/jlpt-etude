// Ajoute aux points déjà présents leur piège (t) et leur phrase à ordonner (o), depuis complements*.js.
// Sans effet sur un point qui a déjà une phrase à ordonner : on peut relancer sans risque.
// Usage : node outils/ajouts-grammaire/completer.js
const fs = require("node:fs");
const path = require("node:path");

const DATA = path.join(__dirname, "..", "..", "web", "data");
const comp = Object.assign({}, ...fs.readdirSync(__dirname).filter((f) => /^complements\d+\.js$/.test(f)).sort()
  .map((f) => require(path.join(__dirname, f))));

global.window = {};
require(path.join(DATA, "n1-grammaire.js"));
const points = Object.fromEntries(window.DATA["N1-grammaire"].map((g) => [g.n, g]));

// Contrôles : on s’arrête à la première erreur
for (const [n, c] of Object.entries(comp)) {
  const err = (m) => { throw new Error(`n°${n} : ${m}`); };
  if (!points[n]) err("point inconnu");
  if (!Array.isArray(c.t) || c.t.length !== 2 || !c.t[0] || !c.t[1]) err("t : il faut [fr, en]");
  const [pre, pcs, post, star, fr, en] = c.o;
  if (pcs.length !== 4 || new Set(pcs).size !== 4) err("4 morceaux distincts");
  if (!(star >= 0 && star <= 3)) err("★ entre 0 et 3");
  if (typeof pre !== "string" || !post || !fr || !en) err("phrase à ordonner incomplète");
}

const J = JSON.stringify;
const lire = (f) => fs.readFileSync(path.join(DATA, f), "utf8");
const ecrire = (f, s) => fs.writeFileSync(path.join(DATA, f), s);
const todo = Object.keys(comp).map(Number).filter((n) => !points[n].o).sort((a, b) => a - b);
if (!todo.length) { console.log("Rien à ajouter : tous les points ont déjà leur phrase à ordonner."); process.exit(0); }

// Découpe le bloc d’un point : de « debut » jusqu’au point suivant (ou à la fin du tableau)
function bloc(s, debut, suivant, fin) {
  const i = s.indexOf(debut);
  if (i < 0) throw new Error("introuvable : " + debut.trim());
  const m = s.slice(i + debut.length).search(suivant);
  const j = m < 0 ? s.lastIndexOf(fin) : i + debut.length + m;
  return [i, j];
}

let fr = lire("n1-grammaire.js"), en = lire("n1-grammaire-en.js");
for (const n of todo) {
  const c = comp[n], [pre, pcs, post, star] = c.o;
  // Français : avant l’accolade fermante du point
  let [i, j] = bloc(fr, `\n{n:${n},`, /\n\{n:\d+,/, "\n];");
  let b = fr.slice(i, j), k = b.lastIndexOf("}");
  if (points[n].t) throw new Error(`n°${n} a déjà un piège`);
  fr = fr.slice(0, i) + b.slice(0, k) + `,\n t:${J(c.t[0])},\n o:[${J(pre)},${J(pcs)},${J(post)},${star}]` + b.slice(k) + fr.slice(j);
  // Anglais : le piège se place avant « ex: »
  [i, j] = bloc(en, `\n${n}: {`, /\n\d+: \{/, "\n};");
  b = en.slice(i, j); k = b.lastIndexOf("ex: [");
  if (k < 0) throw new Error(`n°${n} : « ex: » introuvable en anglais`);
  en = en.slice(0, i) + b.slice(0, k) + `t: ${J(c.t[1])},\n  ` + b.slice(k) + en.slice(j);
}
ecrire("n1-grammaire.js", fr);
ecrire("n1-grammaire-en.js", en);

// Traductions des phrases à ordonner
const ajoute = (f, lignes) => {
  const s = lire(f), i = s.lastIndexOf("};");
  ecrire(f, s.slice(0, i).replace(/\s*$/, "") + ",\n" + lignes.join(",\n") + "\n" + s.slice(i));
};
const phrase = (o) => o[0] + o[1].join("") + o[2];
ajoute("n1-grammaire-trad.js", todo.map((n) => ` ${J(phrase(comp[n].o))}: ${J(comp[n].o[4])}`));
ajoute("n1-grammaire-trad-en.js", todo.map((n) => ` ${J(phrase(comp[n].o))}: ${J(comp[n].o[5])}`));

console.log(`${todo.length} points complétés (n°${todo[0]}–${todo.at(-1)}) : piège + phrase à ordonner.`);
