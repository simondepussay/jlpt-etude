// Intégrité du contenu N1 : chaque règle vérifie l’ensemble des données, pas un échantillon.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./env.js");

const J = load();
const G = J.all.g;

test("D01 · chaque mot (3 315) a un sens en français et en anglais", () => {
  for (const v of J.all.v) {
    assert.ok(v.m && !v.m.startsWith("#"), `anglais manquant : ${v.w}`);
    assert.ok(J.hasFr("v", v), `français manquant : ${v.w}`);
  }
});

test("D02 · chaque kanji (1 232) a un sens en français et en anglais, et au moins une lecture", () => {
  for (const k of J.all.k) {
    assert.ok(k.m, k.k);
    assert.ok(J.hasFr("k", k), k.k);
    assert.ok(k.on.length + k.kun.length > 0, `aucune lecture : ${k.k}`);
  }
});

test("D03 · identifiants uniques (mot|lecture, kanji, numéro de grammaire)", () => {
  for (const m of ["v", "k", "g"]) {
    const ids = J.all[m].map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, m);
  }
});

test("D04 · chaque point de grammaire existe en français et en anglais (sens, explication, exemples, piège)", () => {
  J.S.settings.lang = "en";
  for (const g of G) {
    assert.ok(J.gs(g, "s") && J.gs(g, "s") !== g.s, `sens EN : ${g.n}`);
    assert.ok(J.gs(g, "e") && J.gs(g, "e") !== g.e, `explication EN : ${g.n}`);
    g.ex.forEach((_, i) => assert.ok(J.gex(g, i) && J.gex(g, i) !== g.ex[i][1], `exemple EN ${g.n}.${i}`));
    assert.equal(!!J.gs(g, "t"), !!g.t, `piège : ${g.n}`);
  }
  J.S.settings.lang = "fr";
});

test("D05 · dans chaque exemple, la forme grammaticale est repérée (surlignage et phrase à trous)", () => {
  for (const g of G) for (const [jp] of g.ex) assert.match(jp, /\[\[.+?\]\]/, `${g.n} : ${jp}`);
});

test("D06 · chaque QCM a 4 choix distincts", () => {
  for (const g of G) for (const [q, c] of g.q) {
    assert.equal(c.length, 4, `${g.n} : ${q}`);
    assert.equal(new Set(c).size, 4, `${g.n} : ${q}`);
  }
});

test("D07 · chaque phrase de QCM et chaque phrase à ordonner est traduite en français et en anglais", () => {
  const sentences = [];
  for (const g of G) {
    for (const [q, c] of g.q) if (q.includes("＿＿＿")) sentences.push(q.replace("＿＿＿", c[0]));
    if (g.o) sentences.push(g.o[0] + g.o[1].join("") + g.o[2]);
  }
  for (const jp of sentences) {
    J.S.settings.lang = "fr"; assert.ok(J.trad(jp), `FR : ${jp}`);
    J.S.settings.lang = "en"; assert.ok(J.trad(jp), `EN : ${jp}`);
  }
  J.S.settings.lang = "fr";
  assert.equal(sentences.length, 279);
});

test("D08 · phrases à ordonner : 4 morceaux, la case ★ sur l’un d’eux", () => {
  for (const g of G.filter((x) => x.o)) {
    assert.equal(g.o[1].length, 4, g.n);
    assert.ok(g.o[3] >= 0 && g.o[3] <= 3, g.n);
  }
});

test("D09 · chaque point est rangé dans une catégorie existante, nommée dans les deux langues", () => {
  const cats = new Set(J.gcats.map((c) => c.id));
  for (const g of G) assert.ok(cats.has(g.cat), `${g.n} → ${g.cat}`);
  J.S.settings.lang = "en";
  for (const c of J.gcats) assert.notEqual(J.gcat(c), c.fr, c.id);
  J.S.settings.lang = "fr";
});

test("D10 · volumes N1 attendus", () => {
  assert.equal(J.all.v.length, 3315);
  assert.equal(J.all.k.length, 1232);
  assert.equal(G.length, 190);
});
