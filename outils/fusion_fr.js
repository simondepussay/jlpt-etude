// Fusionne un lot de traductions « index<TAB>sens » dans web/data/n1-vocab-fr.js (clé = mot|lecture).
// Usage : node outils/fusion_fr.js lot.txt
const fs = require("fs"), path = require("path");
const D = path.join(__dirname, "..", "web", "data");
global.window = {};
require(path.join(D, "n1-vocab.js"));
const V = window.DATA["N1-vocab"];
window.DATA = {};
require(path.join(D, "n1-vocab-fr.js"));
const map = window.DATA["N1-vocab-fr"] || {};
let n = 0; const bad = [];
for (const l of fs.readFileSync(process.argv[2], "utf8").trim().split("\n")) {
  const [i, fr] = l.split("\t"), v = V[+i];
  if (!v || !fr) { bad.push(l); continue; }
  map[v.w + "|" + v.r] = fr.trim(); n++;
}
fs.writeFileSync(path.join(D, "n1-vocab-fr.js"), "/* Sens français du vocabulaire N1 (clé = mot|lecture). */\nwindow.DATA = window.DATA || {};\nwindow.DATA[\"N1-vocab-fr\"] = " + JSON.stringify(map) + ";\n");
console.log("ajoutés", n, "· total", Object.keys(map).length, "/", V.length, "· erreurs", bad.length, bad.slice(0, 3));
