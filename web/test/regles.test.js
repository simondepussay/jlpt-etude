// Règles métier de JLPT Étude — une règle par test, numérotées (reprises sur la page du portfolio).
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, learned } = require("./env.js");

const V0 = (J) => J.items.v[0].id;
// les objets viennent d’un contexte isolé : on compare leur contenu, pas leur prototype
const same = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, msg);

/* ───────── Répétition espacée ───────── */
test("R01 · une erreur remet l’élément à réviser aujourd’hui et baisse sa facilité", () => {
  const J = load();
  const r = learned(J, "v", V0(J), { iv: 10 });
  r.ef = 2.4;
  J.grade("v", V0(J), 0);
  assert.equal(r.iv, 0);
  assert.equal(r.due, J.today());
  assert.equal(r.l, 1);
  assert.equal(Math.round(r.ef * 100) / 100, 2.2);
});

test("R02 · la facilité ne descend jamais sous 1,3", () => {
  const J = load();
  const r = learned(J, "v", V0(J));
  r.ef = 1.35;
  J.grade("v", V0(J), 0);
  assert.equal(r.ef, 1.3);
});

test("R03 · premiers intervalles : difficile 1 j, bien 2 j, facile 4 j", () => {
  for (const [q, iv] of [[1, 1], [2, 2], [3, 4]]) {
    const J = load();
    const r = learned(J, "v", V0(J), { iv: 0 });
    J.grade("v", V0(J), q);
    assert.equal(r.iv, iv, `q=${q}`);
    assert.equal(r.due, J.addDays(J.today(), iv));
  }
});

test("R04 · intervalle suivant = intervalle × facilité, et toujours au moins +1 jour", () => {
  const J = load();
  const r = learned(J, "v", V0(J), { iv: 10 });
  r.ef = 2.5;
  J.grade("v", V0(J), 2);
  assert.equal(r.iv, 25);
  const r2 = learned(J, "v", J.items.v[1].id, { iv: 1 });
  r2.ef = 1.3;
  J.grade("v", J.items.v[1].id, 1);
  assert.equal(r2.iv, 2); // 1 × 1,2 arrondi = 1 → forcé à 2
});

test("R05 · « difficile » baisse la facilité de 0,15, « facile » la monte de 0,15 (max 3,2)", () => {
  const J = load();
  const a = learned(J, "v", V0(J), { iv: 5 }); a.ef = 2.4;
  J.grade("v", V0(J), 1);
  assert.equal(Math.round(a.ef * 100) / 100, 2.25);
  const b = learned(J, "v", J.items.v[1].id, { iv: 5 }); b.ef = 3.15;
  J.grade("v", J.items.v[1].id, 3);
  assert.equal(b.ef, 3.2);
});

test("R06 · un intervalle ne dépasse jamais 365 jours", () => {
  const J = load();
  const r = learned(J, "v", V0(J), { iv: 300 }); r.ef = 3;
  J.grade("v", V0(J), 3);
  assert.equal(r.iv, 365);
});

test("R07 · « déjà connu » : appris aujourd’hui, prochaine révision dans 30 jours", () => {
  const J = load();
  J.markKnown("v", V0(J));
  const r = J.rec("v", V0(J));
  assert.equal(r.at, J.today());
  assert.equal(r.iv, 30);
  assert.equal(r.due, J.addDays(J.today(), 30));
  assert.equal(J.day().v.n, 1);
});

test("R08 · niveaux : nouveau, en cours (< 7 j), acquis (7–20 j), maîtrisé (≥ 21 j)", () => {
  const J = load();
  const ids = J.items.v.slice(0, 4).map((x) => x.id);
  learned(J, "v", ids[1], { iv: 6 });
  learned(J, "v", ids[2], { iv: 7 });
  learned(J, "v", ids[3], { iv: 21 });
  same(ids.map((id) => J.levelOf("v", id)), [0, 1, 2, 3]);
});

test("R09 · à réviser = éléments appris dont la date est passée, les plus en retard d’abord", () => {
  const J = load();
  const [a, b, c] = J.items.v.slice(0, 3).map((x) => x.id);
  learned(J, "v", a, { due: J.addDays(J.today(), -1) });
  learned(J, "v", b, { due: J.addDays(J.today(), -5) });
  learned(J, "v", c, { due: J.addDays(J.today(), 3) });
  same(J.dueList("v"), [b, a]);
});

/* ───────── Planning ───────── */
function planFor(opts) {
  const J = load();
  Object.assign(J.S.settings, { examDate: "2027-07-04", daysPerWeek: 4, finalWeeks: 2, maxMinutes: 0 }, opts);
  return J;
}

test("R10 · objectif = date d’examen moins les semaines de révision finale", () => {
  const J = planFor();
  assert.equal(J.plan().target, "2027-06-20");
});

test("R11 · jours d’étude restants = jours avant l’objectif × jours prévus par semaine ÷ 7", () => {
  const J = planFor();
  const days = J.diffDays(J.today(), "2027-06-20");
  assert.equal(J.plan().studyDays, Math.floor((days * 4) / 7));
  J.S.settings.daysPerWeek = 2;
  assert.equal(J.plan().studyDays, Math.floor((days * 2) / 7));
});

test("R12 · nouveaux par jour = éléments restants ÷ jours d’étude (arrondi au-dessus)", () => {
  const J = planFor();
  const p = J.plan();
  for (const m of J.MOD_ORDER) assert.equal(p.mods[m].new, Math.ceil(J.items[m].length / p.studyDays), m);
});

test("R13 · pendant la révision finale : plus aucun nouvel élément", () => {
  const J = planFor({ examDate: J0().addDays(J0().today(), 10) });
  const p = J.plan();
  assert.equal(p.finalPhase, true);
  for (const m of J.MOD_ORDER) assert.equal(p.mods[m].newLeft, 0);
});
function J0() { return load(); }

test("R14 · un plafond de temps réduit les nouveaux et signale le retard, avec au moins 1 par module", () => {
  const J = planFor({ maxMinutes: 15 });
  const p = J.plan();
  assert.equal(p.capped, true);
  for (const m of J.MOD_ORDER) {
    assert.ok(p.mods[m].new <= p.mods[m].needed, m);
    assert.ok(p.mods[m].new >= 1, m);
  }
  assert.ok(p.mods.v.new < p.mods.v.needed && p.mods.k.new < p.mods.k.needed);
  assert.ok(p.minutes <= 15 + 1);
});

test("R15 · le plan du jour ne bouge pas en cours de journée (les éléments appris aujourd’hui sont déduits)", () => {
  const J = planFor();
  const before = J.plan().mods.v;
  J.items.v.slice(0, 10).forEach((x) => J.markLearned("v", x.id));
  const after = J.plan().mods.v;
  assert.equal(after.new, before.new);
  assert.equal(after.newLeft, before.newLeft - 10);
});

test("R16 · questions de test limitées au nombre d’éléments déjà appris", () => {
  const J = planFor();
  assert.equal(J.plan().mods.v.test, 0);
  J.items.v.slice(0, 3).forEach((x) => learned(J, "v", x.id, { due: J.addDays(J.today(), 5) }));
  assert.equal(J.plan().mods.v.test, 3);
});

test("R17 · double journée : nouveaux et tests × 2", () => {
  const J = planFor();
  J.items.v.slice(0, 20).forEach((x) => learned(J, "v", x.id, { due: J.addDays(J.today(), 5) }));
  const p1 = J.plan();
  J.setTodayMult(2);
  const p2 = J.plan();
  assert.equal(p2.mods.v.newLeft, p1.mods.v.newLeft * 2);
  assert.equal(p2.mods.v.test, p1.mods.v.test * 2);
});

test("R18 · la double journée ne vaut que pour aujourd’hui", () => {
  const J = planFor();
  J.S.dayMult = { date: J.addDays(J.today(), -1), mult: 2 };
  assert.equal(J.todayMult(), 1);
});

/* ───────── Rythme réel ───────── */
function withHistory(daysStudied, { age = 30, planned = 4 } = {}) {
  const J = load();
  J.S.created = J.addDays(J.today(), -age);
  J.S.settings.daysPerWeek = planned;
  for (const i of daysStudied) J.S.days[J.addDays(J.today(), -i)] = { sec: 900, v: { n: 5, r: 5, ok: 4, ko: 1 }, k: { n: 0, r: 0, ok: 0, ko: 0 }, g: { n: 0, r: 0, ok: 0, ko: 0 }, done: true };
  return J;
}

test("R19 · pas de mesure du rythme réel avant 14 jours d’utilisation", () => {
  assert.equal(withHistory([1, 2, 3], { age: 10 }).measuredDPW(), null);
});

test("R20 · rythme réel = jours étudiés sur les 4 dernières semaines, ramené à la semaine", () => {
  const J = withHistory([1, 4, 8, 11, 15, 18, 22, 25]);
  assert.equal(J.measuredDPW(), 2);
});

test("R21 · alerte si on étudie nettement moins que prévu, avec une proposition arrondie", () => {
  const J = withHistory([1, 4, 8, 11, 15, 18, 22, 25], { planned: 4 });
  same(J.paceWarning(), { measured: 2, planned: 4, suggest: 2 });
  const ok = withHistory([1, 2, 4, 5, 8, 9, 11, 12, 15, 16, 18, 19, 22, 23, 25, 26], { planned: 4 });
  assert.equal(ok.paceWarning(), null);
});

test("R22 · « je garde mon rythme » masque l’alerte pendant 7 jours", () => {
  const J = withHistory([1, 4, 8, 11, 15, 18, 22, 25]);
  J.S.paceAck = J.addDays(J.today(), -3);
  assert.equal(J.paceWarning(), null);
  J.S.paceAck = J.addDays(J.today(), -8);
  assert.notEqual(J.paceWarning(), null);
});

test("R23 · un jour compte comme étudié à partir d’une minute ou de 5 actions", () => {
  const J = load();
  const d = J.addDays(J.today(), -1);
  J.S.days[d] = { sec: 30, v: { n: 0, r: 2, ok: 2, ko: 0 }, k: { n: 0, r: 0, ok: 0, ko: 0 }, g: { n: 0, r: 0, ok: 0, ko: 0 } };
  assert.equal(J.studied(d), false);
  J.S.days[d].sec = 60;
  assert.equal(J.studied(d), true);
  J.S.days[d] = { sec: 10, v: { n: 3, r: 2, ok: 2, ko: 0 }, k: { n: 0, r: 0, ok: 0, ko: 0 }, g: { n: 0, r: 0, ok: 0, ko: 0 } };
  assert.equal(J.studied(d), true);
});

test("R24 · série : jours consécutifs, en partant d’aujourd’hui ou d’hier", () => {
  assert.equal(withHistory([1, 2, 3, 5]).streak(), 3);
  assert.equal(withHistory([0, 1, 2]).streak(), 3);
});

/* ───────── Temps mesuré ───────── */
test("R25 · durée moyenne : moyenne glissante, temps aberrants plafonnés, plancher minimum", () => {
  const J = load();
  J.addTime("v", "learn", 1000); // plafonné à 120 s
  assert.equal(J.S.timing.v.learn, Math.round((18 * 0.85 + 120 * 0.15) * 10) / 10);
  for (let i = 0; i < 50; i++) J.addTime("v", "rev", 1);
  assert.equal(J.S.timing.v.rev, 4); // plancher
  assert.equal(J.day().sec, 120 + 50);
});

/* ───────── Synchronisation entre appareils ───────── */
test("R26 · fusion : on garde l’élément le plus révisé, à égalité la date la plus lointaine", () => {
  const J = load();
  const a = J.defaultState(), b = J.defaultState();
  a.items["v:x"] = { r: 3, due: "2026-10-20", ok: 3, ko: 0, at: "2026-10-01", iv: 5, ef: 2.4, l: 0 };
  b.items["v:x"] = { r: 2, due: "2026-11-30", ok: 1, ko: 4, at: "2026-09-01", iv: 9, ef: 2.4, l: 0 };
  a.items["v:y"] = { r: 1, due: "2026-10-12", ok: 1, ko: 0, at: "2026-10-01", iv: 1, ef: 2.4, l: 0 };
  b.items["v:y"] = { r: 1, due: "2026-10-15", ok: 0, ko: 1, at: "2026-10-02", iv: 3, ef: 2.4, l: 0 };
  const m = J.merge(a, b);
  assert.equal(m.items["v:x"].r, 3);
  assert.equal(m.items["v:x"].ko, 4);          // compteurs : maximum des deux
  assert.equal(m.items["v:x"].at, "2026-09-01"); // date d’apprentissage : la plus ancienne
  assert.equal(m.items["v:y"].due, "2026-10-15");
});

test("R27 · fusion : jours combinés (maximum par compteur, terminé et double conservés)", () => {
  const J = load();
  const a = J.defaultState(), b = J.defaultState();
  const day = (sec, n, done, double) => ({ sec, done, double, v: { n, r: 1, ok: 1, ko: 0 }, k: { n: 0, r: 0, ok: 0, ko: 0 }, g: { n: 0, r: 0, ok: 0, ko: 0 } });
  a.days["2026-10-09"] = day(600, 10, false, false);
  b.days["2026-10-09"] = day(300, 20, true, true);
  const d = J.merge(a, b).days["2026-10-09"];
  assert.equal(d.sec, 600); assert.equal(d.v.n, 20); assert.equal(d.done, true); assert.equal(d.double, true);
});

test("R28 · fusion : réglages de l’appareil le plus récent, date de création la plus ancienne", () => {
  const J = load();
  const a = J.defaultState(), b = J.defaultState();
  a.updatedAt = "2026-10-09T10:00:00Z"; a.settings.daysPerWeek = 3; a.created = "2026-10-01";
  b.updatedAt = "2026-10-10T10:00:00Z"; b.settings.daysPerWeek = 6; b.created = "2026-10-05";
  const m = J.merge(a, b);
  assert.equal(m.settings.daysPerWeek, 6);
  assert.equal(m.created, "2026-10-01");
});

/* ───────── Exclusions ───────── */
test("R29 · « Pas du N1 » retire l’élément des leçons, des comptes et des révisions, et peut être annulé", () => {
  const J = load();
  const id = V0(J), total = J.items.v.length;
  learned(J, "v", id);
  J.setExcluded("v", id, true);
  assert.equal(J.items.v.length, total - 1);
  assert.equal(J.dueList("v").includes(id), false);
  J.setExcluded("v", id, false);
  assert.equal(J.items.v.length, total);
});

/* ───────── Leçon du jour ───────── */
test("R30 · ordre de la leçon : révisions, puis nouveaux (fiches puis vérification), puis tests", () => {
  const J = load({ ui: true });
  Object.assign(J.S.settings, { examDate: "2027-07-04", maxMinutes: 0 });
  J.items.v.slice(100, 110).forEach((x) => learned(J, "v", x.id, { due: J.addDays(J.today(), -1) }));
  const q = J._test.buildLesson().queue.map((i) => i.s);
  const first = (s) => q.indexOf(s), last = (s) => q.lastIndexOf(s);
  assert.ok(last("rev") < first("learn"));
  assert.ok(first("learn") < first("check"));
  assert.ok(last("check") < first("test"));
});

test("R31 · nouveaux par paquets de 5 (2 en grammaire), chaque fiche vérifiée juste après", () => {
  const J = load({ ui: true });
  Object.assign(J.S.settings, { examDate: "2027-07-04", maxMinutes: 0 });
  const q = J._test.buildLesson().queue.filter((i) => i.m === "v");
  same(q.slice(0, 10).map((i) => i.s), ["learn", "learn", "learn", "learn", "learn", "check", "check", "check", "check", "check"]);
  const g = J._test.buildLesson().queue.filter((i) => i.m === "g").map((i) => i.s);
  assert.equal(g.indexOf("check"), Math.min(2, g.filter((s) => s === "learn").length));
});

test("R32 · une erreur fait revenir l’élément en rattrapage, au plus 3 fois", () => {
  const J = load({ ui: true });
  const id = V0(J);
  learned(J, "v", id);
  J._test.R = { type: "lesson", queue: [{ s: "rev", m: "v", id }], pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now() };
  while (J._test.R.pos < J._test.R.queue.length) {
    J._test.EX = { t0: Date.now() };
    J._test.result(0);
    J._test.R.pos++;
  }
  assert.equal(J._test.R.queue.filter((i) => i.s === "fix").length, 3);
});

test("R33 · vérification juste après la fiche : réussie → révision demain, ratée → aujourd’hui", () => {
  const J = load({ ui: true });
  const [a, b] = J.items.v.slice(0, 2).map((x) => x.id);
  J.markLearned("v", a); J.markLearned("v", b);
  J._test.R = { type: "lesson", queue: [{ s: "check", m: "v", id: a }, { s: "check", m: "v", id: b }], pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now() };
  J._test.EX = { t0: Date.now() }; J._test.result(2); J._test.R.pos++;
  J._test.EX = { t0: Date.now() }; J._test.result(0);
  assert.equal(J.rec("v", a).due, J.addDays(J.today(), 1));
  assert.equal(J.rec("v", b).due, J.today());
});

test("R34 · l’entraînement libre et le petit test ne modifient pas le planning", () => {
  const J = load({ ui: true });
  const id = V0(J);
  const r = learned(J, "v", id, { iv: 10, due: J.addDays(J.today(), 10) });
  J._test.R = { type: "practice", queue: [{ s: "test", m: "v", id, free: true }], pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now(), noFix: true };
  J._test.EX = { t0: Date.now() }; J._test.result(0);
  assert.equal(r.iv, 10);
  assert.equal(r.ko, 1); // mais l’erreur est comptée dans les statistiques
});

test("R35 · doubler une journée terminée refait exactement la même dose", () => {
  const J = load({ ui: true });
  Object.assign(J.S.settings, { examDate: "2027-07-04", maxMinutes: 30 });
  J.S.lesson = J._test.buildLesson();
  const learn = (L) => L.queue.filter((i) => i.s === "learn").length;
  const first = learn(J.S.lesson);
  J.S.lesson.queue.filter((i) => i.s === "learn").forEach((i) => J.markLearned(i.m, i.id));
  J.S.lesson.pos = J.S.lesson.queue.length;
  J.S.timing.v.learn = 6; // les temps mesurés ont changé entre-temps
  J._test.extendLesson();
  assert.equal(learn(J.S.lesson), first * 2);
  assert.equal(J.S.lesson.mult, 2);
});

/* ───────── Exercices ───────── */
test("R36 · lecture : 4 choix distincts, la bonne réponse incluse, jamais une autre lecture correcte du mot", () => {
  const J = load();
  for (const v of J.items.v.filter((x) => /[一-龯]/.test(x.w)).slice(0, 300)) {
    const ex = J.makeEx("v", v.id, "rev", "v-read");
    assert.equal(new Set(ex.options).size, ex.options.length);
    assert.ok(ex.options.includes(v.r));
    const other = J.items.v.filter((x) => x.w === v.w && x.r !== v.r).map((x) => x.r);
    for (const o of other) assert.ok(!ex.options.includes(o), v.w);
  }
});

test("R37 · QCM de grammaire : 4 choix distincts dont la bonne réponse", () => {
  const J = load();
  for (const g of J.items.g) {
    const ex = J.makeEx("g", g.id, "rev", "g-qcm");
    assert.equal(ex.options.length, 4, g.p);
    assert.equal(new Set(ex.options).size, 4, g.p);
    assert.ok(ex.options.includes(ex.answer), g.p);
  }
});

test("R38 · la langue choisie s’applique à tout sauf au japonais", () => {
  const J = load({ lang: "en" });
  const v = J.items.v[0], g = J.items.g[0];
  assert.equal(J.mean("v", v), v.m);
  assert.notEqual(J.gs(g, "s"), g.s);
  J.S.settings.lang = "fr";
  assert.notEqual(J.mean("v", v), v.m);
  assert.equal(J.gs(g, "s"), g.s);
});

test("R39 · kanji : jamais la lecture d’un kanji seul, toujours la lecture d’un mot qui le contient", () => {
  const J = load();
  for (const k of J.items.k) for (const stage of ["rev", "check", "test"]) {
    const ex = J.makeEx("k", k.id, stage);
    assert.notEqual(ex.kind, "k-read", k.k);
    if (ex.kind === "k-word") {
      assert.ok(ex.prompt.includes(`<u>${k.k}</u>`), `${k.k} : le kanji est souligné dans un mot`);
      assert.equal(ex.options.length, 4, k.k);
      assert.ok(ex.options.includes(ex.answer), k.k);
    }
  }
});

test("R40 · une leçon enregistrée avec l’ancienne question « k-read » se reconstruit sans erreur", () => {
  const J = load();
  const k = J.items.k[0];
  const ex = J.makeEx("k", k.id, "test", "k-read");
  assert.notEqual(ex.kind, "k-read");
});
