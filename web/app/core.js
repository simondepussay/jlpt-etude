/* JLPT Étude — cœur : données, sauvegarde, répétition espacée, planning. */
(function () {
  const J = (window.J = {});
  const D = window.DATA || {};
  J.LEVEL = "N1";

  /* ───────── Modules & données ───────── */
  J.MODS = {
    v: { id: "v", jp: "語彙", fr: "Vocabulaire", en: "Vocabulary", unit: ["mots", "words"] },
    k: { id: "k", jp: "漢字", fr: "Kanji", en: "Kanji", unit: ["kanji", "kanji"] },
    g: { id: "g", jp: "文法", fr: "Grammaire", en: "Grammar", unit: ["points", "points"] }
  };

  /* ───────── Langue : tout ce qui n’est pas japonais est en français OU en anglais ───────── */
  J.lang = () => (J.S && J.S.settings && J.S.settings.lang) || ((navigator.language || "").startsWith("fr") ? "fr" : "en");
  J.L = (fr, en) => (J.lang() === "en" ? en : fr);
  J.locale = () => (J.lang() === "en" ? "en-GB" : "fr-FR");
  J.modName = (m) => J.MODS[m][J.lang() === "en" ? "en" : "fr"];
  J.modUnit = (m) => J.MODS[m].unit[J.lang() === "en" ? 1 : 0];
  J.num = (x) => Number(x).toLocaleString(J.locale(), { maximumFractionDigits: 1 });
  J.MOD_ORDER = ["v", "k", "g"];

  const vocab = (D[J.LEVEL + "-vocab"] || []).map((x) => ({ ...x, id: x.w + "|" + x.r }));
  const kanji = (D[J.LEVEL + "-kanji"] || []).map((x) => ({ ...x, id: x.k }));
  const gram = (D[J.LEVEL + "-grammaire"] || []).slice().sort((a, b) => a.n - b.n).map((x) => ({ ...x, id: String(x.n) }));
  J.all = { v: vocab, k: kanji, g: gram };
  J.items = { v: vocab, k: kanji, g: gram }; // sans les éléments retirés par l’utilisateur
  J.byId = {};
  for (const m of J.MOD_ORDER) J.byId[m] = Object.fromEntries(J.all[m].map((x) => [x.id, x]));
  J.gcats = D[J.LEVEL + "-grammaire-cats"] || [];
  /* Contenus traduits : sens français des mots et kanji, grammaire en anglais */
  const VFR = D[J.LEVEL + "-vocab-fr"] || {}, KFR = D[J.LEVEL + "-kanji-fr"] || {};
  const GEN = D[J.LEVEL + "-grammaire-en"] || {}, TFR = D[J.LEVEL + "-grammaire-trad"] || {}, TEN = D[J.LEVEL + "-grammaire-trad-en"] || {};
  J.mean = (m, x) => (J.lang() === "fr" ? (m === "v" ? VFR[x.id] : KFR[x.k]) || x.m : x.m);
  J.hasFr = (m, x) => !!(m === "v" ? VFR[x.id] : KFR[x.k]);
  J.gs = (g, f) => (J.lang() === "en" && GEN[g.n] && GEN[g.n][f] !== undefined ? GEN[g.n][f] : g[f]);
  J.gex = (g, i) => (J.lang() === "en" && GEN[g.n] && GEN[g.n].ex ? GEN[g.n].ex[i] : g.ex[i][1]);
  J.gcat = (c) => (J.lang() === "en" ? (GEN.cats || {})[c.id] || c.fr : c.fr);
  J.trad = (jp) => (J.lang() === "en" ? TEN[jp] : TFR[jp]) || "";

  // kanji → mots du vocabulaire qui le contiennent
  J.kanjiWords = {};
  for (const w of vocab) {
    for (const ch of w.w) {
      if (J.byId.k[ch]) (J.kanjiWords[ch] = J.kanjiWords[ch] || []).push(w.id);
    }
  }

  /* ───────── Dates ───────── */
  const pad = (n) => String(n).padStart(2, "0");
  J.today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  J.parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  J.addDays = (s, k) => { const d = J.parse(s); d.setDate(d.getDate() + k); return J.today(d); };
  J.diffDays = (a, b) => Math.round((J.parse(b) - J.parse(a)) / 864e5);
  J.fmtDate = (s) => J.parse(s).toLocaleDateString(J.locale(), { day: "numeric", month: "long", year: "numeric" });
  J.fmtShort = (s) => { const d = J.parse(s); return d.toLocaleDateString(J.locale(), d.getFullYear() === new Date().getFullYear() ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }); };
  J.jpDate = (d = new Date()) => `${d.getMonth() + 1}月${d.getDate()}日（${"日月火水木金土"[d.getDay()]}）`;

  // Sessions JLPT : 1er dimanche de juillet et de décembre
  J.jlptSessions = (n = 4) => {
    const out = [], t = J.today();
    for (let y = new Date().getFullYear(); out.length < n; y++) {
      for (const mo of [6, 11]) {
        const d = new Date(y, mo, 1);
        d.setDate(1 + ((7 - d.getDay()) % 7));
        const s = J.today(d);
        if (s > t && out.length < n) out.push(s);
      }
    }
    return out;
  };

  /* ───────── État ───────── */
  const DEFAULT_TIMING = {
    v: { learn: 18, rev: 9, test: 12 },
    k: { learn: 22, rev: 10, test: 12 },
    g: { learn: 150, rev: 35, test: 45 }
  };
  J.defaultState = () => ({
    version: 1,
    level: J.LEVEL,
    created: J.today(),
    onboarded: false,
    settings: {
      lang: (navigator.language || "").slice(0, 2) === "fr" ? "fr" : "en",
      examDate: J.jlptSessions(1)[0],
      daysPerWeek: 4,
      maxMinutes: 45,
      tests: { v: 5, k: 5, g: 4 },
      revCap: 200,
      rate: 0.9,
      finalWeeks: 2
    },
    items: {},
    days: {},
    timing: JSON.parse(JSON.stringify(DEFAULT_TIMING)),
    notes: {},
    excluded: {},
    lesson: null,
    paceAck: null
  });
  J.S = J.defaultState();

  function migrate(o) {
    const d = J.defaultState();
    const s = { ...d, ...o };
    s.settings = { ...d.settings, ...(o.settings || {}) };
    s.settings.tests = { ...d.settings.tests, ...((o.settings || {}).tests || {}) };
    s.timing = { ...d.timing, ...(o.timing || {}) };
    return s;
  }

  /* ───────── Sauvegarde : navigateur (invité) + compte en ligne (API Azure) ───────── */
  const LS_KEY = "jlpt-etude-" + J.LEVEL;
  const LS_SESSION = "jlpt-etude-session";
  J.store = { mode: "local", status: "idle", lastSave: null, error: null, user: null };

  function lsGet() { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function lsSet(o) { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {} }
  function sessGet() { try { return JSON.parse(localStorage.getItem(LS_SESSION) || "null"); } catch (e) { return null; } }
  function sessSet(v) { try { v ? localStorage.setItem(LS_SESSION, JSON.stringify(v)) : localStorage.removeItem(LS_SESSION); } catch (e) {} }

  const Cloud = {
    etag: null,
    async call(path, opts = {}) {
      const s = sessGet();
      const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
      if (s) headers["x-jlpt-session"] = s.token;
      const r = await fetch("/api/" + path, { ...opts, headers, cache: "no-store" });
      let body = null;
      if (r.status !== 204) { try { body = await r.json(); } catch (e) {} }
      if (r.status === 401) { J.store.error = J.L("Session expirée", "Session expired"); J.store.expired = true; }
      return { status: r.status, body };
    },
    async load() {
      const r = await this.call("progress/" + J.LEVEL);
      if (r.status === 204) { this.etag = null; return null; }
      if (r.status !== 200) throw new Error((r.body && r.body.error) || "HTTP " + r.status);
      this.etag = r.body.etag;
      return r.body.data;
    },
    async save(state, retry = true) {
      const headers = this.etag ? { "If-Match": this.etag } : { "x-create": "1" };
      const r = await this.call("progress/" + J.LEVEL, { method: "PUT", headers, body: JSON.stringify(state) });
      if (r.status === 200) { this.etag = r.body.etag; return; }
      if (r.status === 412 && retry) {
        // un autre appareil a sauvegardé entre-temps : on fusionne puis on réessaie
        this.etag = r.body && r.body.etag;
        if (r.body && r.body.data) J.S = J.merge(r.body.data, J.S);
        return this.save(J.S, false);
      }
      throw new Error((r.body && r.body.error) || "HTTP " + r.status);
    }
  };

  /* Fusion de deux progressions (deux appareils, ou invité → compte) */
  J.merge = function (a, b) {
    if (!a || !a.version) return b;
    if (!b || !b.version) return a;
    a = migrate(a); b = migrate(b);
    const newer = (a.updatedAt || "") >= (b.updatedAt || "") ? a : b;
    const out = migrate(JSON.parse(JSON.stringify(newer)));
    out.created = a.created < b.created ? a.created : b.created;
    out.onboarded = a.onboarded || b.onboarded;
    out.items = {};
    for (const k of new Set([...Object.keys(a.items), ...Object.keys(b.items)])) {
      const x = a.items[k], y = b.items[k];
      if (!x || !y) { out.items[k] = x || y; continue; }
      const best = x.r !== y.r ? (x.r > y.r ? x : y) : ((x.due || "") >= (y.due || "") ? x : y);
      out.items[k] = { ...best, ok: Math.max(x.ok, y.ok), ko: Math.max(x.ko, y.ko), at: [x.at, y.at].filter(Boolean).sort()[0] || null };
    }
    out.days = {};
    for (const d of new Set([...Object.keys(a.days), ...Object.keys(b.days)])) {
      const x = a.days[d], y = b.days[d];
      if (!x || !y) { out.days[d] = x || y; continue; }
      const m = { sec: Math.max(x.sec, y.sec), done: x.done || y.done, double: !!(x.double || y.double) };
      for (const mo of ["v", "k", "g"]) { m[mo] = {}; for (const f of ["n", "r", "ok", "ko"]) m[mo][f] = Math.max(x[mo][f], y[mo][f]); }
      out.days[d] = m;
    }
    out.notes = { ...b.notes, ...a.notes, ...newer.notes };
    const older = newer === a ? b : a;
    out.excluded = { ...(older.excluded || {}), ...(newer.excluded || {}) };
    return out;
  };

  J.user = () => (sessGet() || {}).user || null;

  J.load = async function () {
    const local = lsGet();
    const s = sessGet();
    let state = local && local.version ? migrate(local) : null;
    if (s) {
      J.store.mode = "cloud";
      J.store.user = s.user;
      try {
        const remote = await Cloud.load();
        // les données locales d'un autre compte ne sont jamais fusionnées
        const mine = state && (!state.owner || state.owner === s.user.id) ? state : null;
        state = remote ? J.merge(remote, mine) : mine;
        J.store.status = "ok";
      } catch (e) {
        J.store.status = "offline";
        J.store.error = J.L("Hors ligne : la progression sera envoyée dès que possible.", "Offline: your progress will be sent as soon as possible.");
      }
      if (state) state.owner = s.user.id;
    }
    J.S = state || J.defaultState();
    if (s) J.S.owner = s.user.id;
    J.refreshItems();
    if (s && J.store.status === "ok") J.save(true);
  };

  let saveTimer = null, saving = false, again = false;
  J.save = function (now) {
    J.S.updatedAt = new Date().toISOString();
    lsSet(J.S);
    if (J.store.mode !== "cloud" || J.store.expired) return;
    clearTimeout(saveTimer);
    const go = async () => {
      if (saving) { again = true; return; }
      saving = true;
      try {
        await Cloud.save(J.S);
        lsSet(J.S);
        J.store.lastSave = new Date();
        J.store.status = "ok";
        J.store.error = null;
      } catch (e) {
        J.store.status = "error";
        J.store.error = J.L("Synchronisation impossible (" + e.message + ") : les données restent dans ce navigateur.", "Sync failed (" + e.message + "): your data stays in this browser.");
      }
      saving = false;
      document.dispatchEvent(new Event("j:saved"));
      if (again) { again = false; go(); }
    };
    if (now) go(); else saveTimer = setTimeout(go, 1500);
  };
  document.addEventListener("visibilitychange", () => { if (document.hidden) J.save(true); });
  window.addEventListener("online", () => J.save(true));

  /* Connexion : échange le jeton du fournisseur contre une session JLPT Étude */
  J.login = async function (provider, idToken, nonce, name) {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, idToken, nonce, name })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || J.L("Connexion refusée", "Sign-in refused"));
    sessSet({ token: body.token, user: body.user });
    J.store.expired = false;
    J.store.error = null;
    await J.load(); // fusionne la progression invité avec celle du compte
  };
  J.logout = function () {
    J.save(true);
    sessSet(null);
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    J.store = { mode: "local", status: "idle", lastSave: null, error: null, user: null };
    J.S = J.defaultState();
    J.refreshItems();
  };
  J.dropSession = function () { sessSet(null); J.store.mode = "local"; J.store.expired = false; J.store.error = null; J.store.user = null; };
  J.deleteAccount = async function () {
    const r = await Cloud.call("me", { method: "DELETE" });
    if (r.status !== 200) throw new Error((r.body && r.body.error) || "HTTP " + r.status);
    J.logout();
  };

  J.exportFile = function () {
    const blob = new Blob([JSON.stringify(J.S, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jlpt-progression-${J.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  J.importObject = function (o) {
    if (!o || !o.version || !o.items) throw new Error(J.L("Ce fichier n’est pas une sauvegarde JLPT Étude.", "This file is not a JLPT Étude backup."));
    const owner = J.S.owner;
    J.S = migrate(o);
    if (owner) J.S.owner = owner;
    J.refreshItems();
    J.save(true);
  };

  /* Éléments retirés (« Pas du N1 ») */
  J.isExcluded = (m, id) => !!(J.S.excluded || {})[m + ":" + id];
  J.refreshItems = function () {
    for (const m of J.MOD_ORDER) J.items[m] = J.all[m].filter((x) => !J.isExcluded(m, x.id));
  };
  J.setExcluded = function (m, id, on) {
    J.S.excluded = J.S.excluded || {};
    J.S.excluded[m + ":" + id] = on;
    J.refreshItems();
    J.save();
  };

  /* ───────── Répétition espacée ───────── */
  const key = (m, id) => m + ":" + id;
  J.rec = (m, id) => J.S.items[key(m, id)];
  J.ensure = (m, id) => J.S.items[key(m, id)] || (J.S.items[key(m, id)] = { iv: 0, ef: 2.4, due: null, r: 0, l: 0, ok: 0, ko: 0, at: null });
  J.isLearned = (m, id) => { const r = J.rec(m, id); return !!(r && r.at); };
  // 0 nouveau · 1 en cours · 2 acquis · 3 maîtrisé
  J.levelOf = (m, id) => { const r = J.rec(m, id); if (!r || !r.at) return 0; return r.iv >= 21 ? 3 : r.iv >= 7 ? 2 : 1; };
  Object.defineProperty(J, "LEVELS", { get: () => J.L(["Nouveau", "En cours", "Acquis", "Maîtrisé"], ["New", "Learning", "Known", "Mastered"]) });

  J.day = (d = J.today()) => {
    const S = J.S;
    if (!S.days[d]) S.days[d] = { sec: 0, v: { n: 0, r: 0, ok: 0, ko: 0 }, k: { n: 0, r: 0, ok: 0, ko: 0 }, g: { n: 0, r: 0, ok: 0, ko: 0 }, done: false };
    return S.days[d];
  };

  J.markLearned = function (m, id) {
    const r = J.ensure(m, id);
    if (!r.at) { r.at = J.today(); r.due = J.today(); J.day()[m].n++; }
  };
  J.markKnown = function (m, id) {
    J.markLearned(m, id);
    const r = J.ensure(m, id);
    r.kn = 1; r.iv = 30; r.ef = 2.6; r.due = J.addDays(J.today(), 30);
    J.save();
  };
  // q : 0 raté · 1 difficile · 2 bien · 3 facile
  J.grade = function (m, id, q) {
    const r = J.ensure(m, id), t = J.today();
    if (!r.at) J.markLearned(m, id);
    r.r++;
    if (q === 0) {
      r.l++; r.ef = Math.max(1.3, r.ef - 0.2); r.iv = 0; r.due = t;
    } else {
      if (r.iv < 1) r.iv = [0, 1, 2, 4][q];
      else r.iv = Math.max(r.iv + 1, Math.round(r.iv * (q === 1 ? 1.2 : q === 2 ? r.ef : r.ef * 1.3)));
      if (q === 1) r.ef = Math.max(1.3, r.ef - 0.15);
      if (q === 3) r.ef = Math.min(3.2, r.ef + 0.15);
      r.iv = Math.min(r.iv, 365);
      r.due = J.addDays(t, r.iv);
    }
    J.save();
  };
  J.record = function (m, id, ok) {
    const r = J.ensure(m, id), d = J.day();
    ok ? r.ok++ : r.ko++;
    d[m].r++; ok ? d[m].ok++ : d[m].ko++;
    J.save();
  };
  J.addTime = function (m, kind, sec) {
    const caps = { learn: m === "g" ? 600 : 120, rev: m === "g" ? 240 : 90, test: m === "g" ? 240 : 90 };
    sec = Math.max(1, Math.min(sec, caps[kind]));
    const T = J.S.timing[m];
    const floors = { learn: m === "g" ? 45 : 6, rev: m === "g" ? 10 : 4, test: m === "g" ? 12 : 5 };
    T[kind] = Math.max(floors[kind], Math.round((T[kind] * 0.85 + sec * 0.15) * 10) / 10);
    J.day().sec += sec;
  };

  /* ───────── Statistiques ───────── */
  J.counts = function (m) {
    const c = [0, 0, 0, 0];
    for (const x of J.items[m]) c[J.levelOf(m, x.id)]++;
    return { total: J.items[m].length, learned: c[1] + c[2] + c[3], levels: c };
  };
  J.dueList = function (m, d = J.today()) {
    const out = [];
    for (const x of J.items[m]) {
      const r = J.rec(m, x.id);
      if (r && r.at && r.due && r.due <= d) out.push(x.id);
    }
    out.sort((a, b) => (J.rec(m, a).due < J.rec(m, b).due ? -1 : 1));
    return out;
  };
  J.accuracy = function (m) {
    let ok = 0, ko = 0;
    for (const k in J.S.items) if (k.startsWith(m + ":")) { ok += J.S.items[k].ok; ko += J.S.items[k].ko; }
    return ok + ko ? ok / (ok + ko) : null;
  };
  J.weak = function (m, n = 10) {
    return J.items[m]
      .map((x) => ({ x, r: J.rec(m, x.id) }))
      .filter((o) => o.r && o.r.ko > 0)
      .sort((a, b) => (b.r.ko / (b.r.ok + b.r.ko) + b.r.l * 0.1) - (a.r.ko / (a.r.ok + a.r.ko) + a.r.l * 0.1))
      .slice(0, n)
      .map((o) => o.x);
  };
  J.studied = (d) => { const x = J.S.days[d]; return !!(x && (x.sec >= 60 || x.v.r + x.k.r + x.g.r + x.v.n + x.k.n + x.g.n >= 5)); };
  J.streak = function () {
    let d = J.today(), n = 0;
    if (!J.studied(d)) d = J.addDays(d, -1);
    while (J.studied(d)) { n++; d = J.addDays(d, -1); }
    return n;
  };

  /* Rythme réel : jours étudiés par semaine sur les 4 dernières semaines */
  J.measuredDPW = function () {
    const age = J.diffDays(J.S.created, J.today()) + 1;
    if (age < 14) return null;
    const span = Math.min(28, age);
    let n = 0;
    for (let i = 0; i < span; i++) if (J.studied(J.addDays(J.today(), -i))) n++;
    return Math.round((n / span) * 7 * 10) / 10;
  };
  /* Avertissement si l’utilisateur étudie nettement moins que prévu */
  J.paceWarning = function () {
    const m = J.measuredDPW(), p = J.S.settings.daysPerWeek;
    if (m === null || m >= p - 0.75) return null;
    if (J.S.paceAck && J.diffDays(J.S.paceAck, J.today()) < 7) return null;
    return { measured: m, planned: p, suggest: Math.max(1, Math.round(m)) };
  };

  /* ───────── Planning ───────── */
  // Leçon double (« double journée ») : multiplie les nouveaux éléments et les tests du jour
  J.todayMult = () => (J.S.dayMult && J.S.dayMult.date === J.today() ? J.S.dayMult.mult : 1);
  J.setTodayMult = (mult) => { J.S.dayMult = { date: J.today(), mult }; J.save(); };
  J.estimateSec = (m, n, due, test) => {
    const T = J.S.timing[m];
    // nouveaux : fiche + vérification immédiate ; révisions : +15 % de rattrapage
    return n * (T.learn + T.rev) + due * T.rev * 1.15 + test * T.test;
  };

  J.plan = function () {
    const S = J.S, s = S.settings, t = J.today();
    const target = J.addDays(s.examDate, -7 * s.finalWeeks);
    const daysLeft = Math.max(0, J.diffDays(t, target));
    const studyDays = daysLeft > 0 ? Math.max(1, Math.floor((daysLeft * s.daysPerWeek) / 7)) : 0;
    const out = { target, daysLeft, studyDays, examIn: J.diffDays(t, s.examDate), mods: {}, finalPhase: daysLeft <= 0 };
    const todayDone = J.S.days[t] || null;
    let fixedSec = 0, wantSec = 0;
    for (const m of J.MOD_ORDER) {
      const c = J.counts(m);
      const learnedToday = todayDone ? todayDone[m].n : 0;
      const remaining = c.total - c.learned + learnedToday; // le plan du jour ne bouge pas en cours de journée
      const needed = studyDays ? Math.ceil(remaining / studyDays) : 0;
      const due = Math.min(J.dueList(m).length, s.revCap);
      const learnedTotal = c.learned;
      const test = Math.min(s.tests[m], Math.max(0, learnedTotal));
      out.mods[m] = { ...c, remaining: c.total - c.learned, needed, due, test, new: needed };
      fixedSec += J.estimateSec(m, 0, due, test);
      wantSec += J.estimateSec(m, needed, 0, 0);
    }
    // plafond de temps quotidien
    const cap = s.maxMinutes > 0 ? s.maxMinutes * 60 : Infinity;
    if (fixedSec + wantSec > cap) {
      const avail = Math.max(0, cap - fixedSec);
      const ratio = wantSec > 0 ? avail / wantSec : 0;
      for (const m of J.MOD_ORDER) {
        const p = out.mods[m];
        p.new = Math.min(p.needed, Math.floor(p.needed * ratio));
        if (p.needed > 0 && p.new === 0 && avail > 0) p.new = 1;
      }
      out.capped = true;
    }
    // déjà appris aujourd’hui (× 2 si leçon double)
    const mult = J.todayMult();
    out.mult = mult;
    for (const m of J.MOD_ORDER) {
      const p = out.mods[m];
      const done = todayDone ? todayDone[m].n : 0;
      p.test = Math.min(p.test * mult, p.learned);
      p.newLeft = Math.max(0, p.new * mult - done);
      p.newLeft = Math.min(p.newLeft, p.remaining);
    }
    out.sec = J.MOD_ORDER.reduce((a, m) => a + J.estimateSec(m, out.mods[m].newLeft, out.mods[m].due, out.mods[m].test), 0);
    out.minutes = Math.max(0, Math.round(out.sec / 60));
    out.fullMinutes = Math.round((fixedSec + wantSec) / 60);
    return out;
  };

  /* Projection : date de fin de l’apprentissage au rythme réel */
  J.projection = function () {
    const s = J.S.settings, t = J.today(), plan = J.plan();
    const dpw = J.measuredDPW() ?? s.daysPerWeek;
    const res = {};
    for (const m of J.MOD_ORDER) {
      const p = plan.mods[m];
      // nouveaux appris par jour d’étude, sur les 14 derniers jours
      let n = 0, days = 0;
      for (let i = 0; i < 14; i++) {
        const d = J.addDays(t, -i), x = J.S.days[d];
        if (J.studied(d)) { days++; n += x[m].n; }
      }
      const perStudyDay = days >= 3 ? n / days : p.new;
      const perDay = (perStudyDay * dpw) / 7;
      const finish = p.remaining === 0 ? t : perDay > 0 ? J.addDays(t, Math.ceil(p.remaining / perDay)) : null;
      const late = finish ? J.diffDays(plan.target, finish) : null;
      res[m] = { perStudyDay: Math.round(perStudyDay * 10) / 10, finish, late, onTime: finish !== null && finish <= plan.target, measured: days >= 3 };
    }
    return res;
  };

  /* ───────── Utilitaires ───────── */
  J.shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  J.pick = (a) => a[Math.floor(Math.random() * a.length)];
  J.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  J.hl = (s) => J.esc(s).replace(/\[\[(.+?)\]\]/g, "<mark>$1</mark>");
  J.strip = (s) => String(s).replace(/\[\[|\]\]/g, "");
  J.blank = (s) => J.esc(s).replace(/\[\[(.+?)\]\]/g, '<span class="blank">＿＿＿＿</span>');
  J.shortMeaning = (m) => m.split(/[,;]/).slice(0, 3).map((x) => x.trim()).filter(Boolean).join(", ");
  J.kunFmt = (s) => s.replace(/\.(.+)$/, "（$1）");

  /* Synthèse vocale japonaise */
  let jaVoice = null;
  const pickVoice = () => {
    const vs = speechSynthesis.getVoices();
    jaVoice = vs.find((v) => v.lang === "ja-JP" && /Kyoko|O-ren|Google/.test(v.name)) || vs.find((v) => v.lang && v.lang.startsWith("ja")) || null;
  };
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  J.say = function (text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(J.strip(text));
    u.lang = "ja-JP";
    if (jaVoice) u.voice = jaVoice;
    u.rate = J.S.settings.rate;
    speechSynthesis.speak(u);
  };
})();
