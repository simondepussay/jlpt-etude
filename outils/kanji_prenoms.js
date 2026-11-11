// Liste les kanji N1 qui ne sont que des kanji de prénoms : hors 常用漢字 ET dans aucun mot (N1 à N5).
// Ils sont retirés des leçons par défaut (on peut les remettre un par un depuis le filtre « Retirés »).
//
// Usage : node outils/kanji_prenoms.js chemin/vers/Unihan_OtherMappings.txt
// (fichier de la base Unihan d'Unicode : https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip)
// Produit web/data/n1-kanji-hors.js
const fs = require("node:fs");
const path = require("node:path");

const WEB = path.join(__dirname, "..", "web");
if (!process.argv[2]) { console.error("Usage : node outils/kanji_prenoms.js Unihan_OtherMappings.txt"); process.exit(1); }

const joyo = new Set(fs.readFileSync(process.argv[2], "utf8").split("\n")
  .filter((l) => l.includes("\tkJoyoKanji\t"))
  .map((l) => String.fromCodePoint(parseInt(l.slice(2, l.indexOf("\t")), 16))));
if (joyo.size < 2000) throw new Error("liste 常用漢字 incomplète : " + joyo.size);

const { load } = require(path.join(WEB, "test", "env.js"));
const J = load();
const hors = J.all.k.filter((k) => !joyo.has(k.k) && J.kanjiReadWords(k.k).length === 0).map((k) => k.k);

fs.writeFileSync(path.join(WEB, "data", "n1-kanji-hors.js"),
  "/* Kanji de prénoms (hors 常用漢字, dans aucun mot) : retirés des leçons par défaut. Généré par outils/kanji_prenoms.js. */\n" +
  `window.DATA=window.DATA||{};window.DATA['N1-kanji-hors']=${JSON.stringify(hors.join(""))};\n`);
console.log(`${hors.length} kanji de prénoms sur ${J.all.k.length}`);
