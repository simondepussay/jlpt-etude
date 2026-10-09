/* JLPT Étude — génération des exercices (kanji, vocabulaire, grammaire). */
(function () {
  const J = window.J;
  const { esc, hl, blank, strip, shuffle, pick, shortMeaning } = J;

  /* ───────── Distracteurs de lecture « à la JLPT » ───────── */
  const DAK = "かがきぎくぐけげこごさざしじすずせぜそぞただちぢつづてでとどはばひびふぶへべほぼ";
  const dakMap = {};
  for (let i = 0; i < DAK.length; i += 2) { dakMap[DAK[i]] = DAK[i + 1]; dakMap[DAK[i + 1]] = DAK[i]; }
  const O_ROW = "こごそぞとどのほぼぽもよろょ";
  function mutations(r) {
    const out = new Set();
    for (let i = 0; i < r.length; i++) {
      const c = r[i];
      if (dakMap[c]) out.add(r.slice(0, i) + dakMap[c] + r.slice(i + 1));
      if (c === "う" && i > 0 && (O_ROW.includes(r[i - 1]) || r[i - 1] === "ゅ")) out.add(r.slice(0, i) + r.slice(i + 1));
      if ((O_ROW.includes(c) || c === "ゅ") && r[i + 1] !== "う" && i < r.length) out.add(r.slice(0, i + 1) + "う" + r.slice(i + 1));
      if (c === "っ") out.add(r.slice(0, i) + r.slice(i + 1));
      if ("かきくけこさしすせそたちつてとぱぴぷぺぽ".includes(c) && i > 0 && r[i - 1] !== "っ" && r[i - 1] !== "ん") out.add(r.slice(0, i) + "っ" + r.slice(i));
      if (c === "ゅ" || c === "ょ" || c === "ゃ") out.add(r.slice(0, i) + { "ゅ": "ゆ", "ょ": "よ", "ゃ": "や" }[c] + r.slice(i + 1));
    }
    out.delete(r);
    return [...out];
  }
  const vByLen = {};
  for (const v of J.items.v) (vByLen[v.r.length] = vByLen[v.r.length] || []).push(v);
  const realReadings = (w) => new Set(J.items.v.filter((x) => x.w === w).map((x) => x.r));

  function readingOptions(word, reading) {
    const bad = realReadings(word);
    const opts = new Set();
    for (const m of shuffle(mutations(reading))) { if (opts.size >= 2) break; if (!bad.has(m)) opts.add(m); }
    const pool = shuffle(vByLen[reading.length] || []);
    for (const x of pool) { if (opts.size >= 3) break; if (!bad.has(x.r) && x.r !== reading) opts.add(x.r); }
    return shuffle([reading, ...[...opts].slice(0, 3)]);
  }
  function otherItems(m, id, n, filter) {
    const pool = shuffle(J.items[m].filter((x) => x.id !== id && (!filter || filter(x))));
    return pool.slice(0, n);
  }
  function uniqueOptions(correct, list) {
    const s = new Set([correct]);
    for (const x of list) { if (s.size >= 4) break; s.add(x); }
    return shuffle([...s]);
  }

  const L = (fr, en) => J.L(fr, en);
  const M = (m, x) => J.mean(m, x);              // sens dans la langue choisie
  const SM = (m, x) => shortMeaning(J.mean(m, x));
  const trad = (jp) => { const t = J.trad(jp); return t ? `<p class="fr-trad">${esc(t)}</p>` : ""; };

  /* ───────── Fiches de réponse ───────── */
  J.vocabBack = (v) =>
    `<div class="ans-card"><div class="ans-word jp" lang="ja">${esc(v.w)}</div><div class="ans-read jp" lang="ja">${esc(v.r)}</div><div class="ans-mean">${esc(M("v", v))}</div>
     <button class="icon-btn" data-act="say" data-say="${esc(v.r)}" title="${L("Écouter", "Listen")}">🔊</button></div>`;
  J.kanjiReadings = (k) =>
    `${k.on.length ? `<span class="tag">音</span><span class="jp" lang="ja">${esc(k.on.join("・"))}</span>` : ""}
     ${k.kun.length ? `<span class="tag">訓</span><span class="jp" lang="ja">${esc(k.kun.map(J.kunFmt).join("・"))}</span>` : ""}`;
  J.kanjiBack = (k) => {
    const words = (J.kanjiWords[k.k] || []).slice(0, 4).map((id) => J.byId.v[id]).filter(Boolean);
    return `<div class="ans-card"><div class="ans-kanji jp" lang="ja">${esc(k.k)}</div><div class="ans-read">${J.kanjiReadings(k)}</div><div class="ans-mean">${esc(M("k", k))}</div>
      ${words.length ? `<div class="mini-words">${words.map((w) => `<span class="jp" lang="ja">${esc(w.w)}<small>${esc(w.r)}</small></span>`).join("")}</div>` : ""}</div>`;
  };
  J.gramBack = (g, extra = "") =>
    `<div class="ans-card left"><div class="ans-pattern jp" lang="ja">${esc(g.p)}</div><div class="ans-mean">${esc(J.gs(g, "s"))}</div>
      <div class="ans-form jp" lang="ja">${esc(g.f)}</div>${extra}
      <button class="link" data-act="open-item" data-m="g" data-id="${g.id}">${L("Revoir la leçon", "Review the lesson")} →</button></div>`;
  const exLine = (g, i) => `<div class="sentence small jp" lang="ja">${hl(g.ex[i][0])}</div><p class="fr-trad">${esc(J.gex(g, i))}</p>`;

  /* ───────── Types d’exercices par module et par étape ───────── */
  const KINDS = {
    v: { rev: ["v-read", "v-mean", "v-word", "v-flash", "v-read"], check: ["v-mean", "v-read"], test: ["v-read", "v-word"] },
    k: { rev: ["k-mean", "k-kanji", "k-read", "k-word", "k-flash"], check: ["k-mean", "k-read"], test: ["k-word", "k-read", "k-word"] },
    g: { rev: ["g-qcm", "g-cloze", "g-rev", "g-ord", "g-flash", "g-qcm"], check: ["g-qcm", "g-rev"], test: ["g-qcm", "g-ord", "g-qcm"] }
  };
  const LABELS = {
    "v-read": ["読み方", "Lecture", "Reading"], "v-mean": ["意味", "Sens", "Meaning"], "v-word": ["語彙", "Quel mot ?", "Which word?"], "v-flash": ["カード", "Rappel", "Recall"],
    "k-mean": ["意味", "Sens du kanji", "Kanji meaning"], "k-kanji": ["漢字", "Quel kanji ?", "Which kanji?"], "k-read": ["読み", "Lecture du kanji", "Kanji reading"], "k-word": ["漢字読み", "Lecture du mot", "Word reading"], "k-flash": ["カード", "Rappel", "Recall"],
    "g-qcm": ["文法形式の判断", "Grammaire", "Grammar"], "g-cloze": ["穴埋め", "Phrase à trous", "Fill the gap"], "g-rev": ["意味 → 形", "Quelle forme ?", "Which form?"], "g-ord": ["文の組み立て", "Phrase à ordonner ★", "Sentence order ★"], "g-flash": ["カード", "Rappel", "Recall"]
  };
  J.kindLabel = (k) => `${LABELS[k][0]} · ${L(LABELS[k][1], LABELS[k][2])}`;

  function usable(m, id, kind) {
    const x = J.byId[m][id];
    if (kind === "v-read") return x.w !== x.r && /[一-龯]/.test(x.w);
    if (kind === "k-word") return (J.kanjiWords[x.k] || []).some((wid) => J.byId.v[wid] && J.byId.v[wid].w !== J.byId.v[wid].r);
    if (kind === "k-read") return x.on.length + x.kun.length > 0;
    if (kind === "g-ord") return !!x.o;
    if (kind === "g-cloze") return x.ex && x.ex.length;
    return true;
  }

  J.makeEx = function (m, id, stage = "rev", kind) {
    let k = kind;
    if (!k || !usable(m, id, k)) {
      const list = KINDS[m][stage].filter((kk) => usable(m, id, kk));
      k = pick(list.length ? list : KINDS[m].rev.filter((kk) => usable(m, id, kk)));
    }
    const ex = BUILD[k](J.byId[m][id]);
    return { m, id, kind: k, stage, label: J.kindLabel(k), answered: false, revealed: false, t0: Date.now(), ...ex };
  };

  const BUILD = {
    /* Vocabulaire */
    "v-read": (v) => ({
      mode: "choice",
      prompt: `<p class="q-help">${L("Choisis la bonne lecture.", "Choose the correct reading.")}</p><div class="big-jp jp" lang="ja">${esc(v.w)}</div>`,
      options: readingOptions(v.w, v.r), answer: v.r, back: J.vocabBack(v), say: v.r, jpOpts: true
    }),
    "v-mean": (v) => {
      const opts = uniqueOptions(SM("v", v), otherItems("v", v.id, 8).map((x) => SM("v", x)));
      return { mode: "choice", prompt: `<p class="q-help">${L("Que signifie ce mot ?", "What does this word mean?")}</p><div class="big-jp jp" lang="ja">${esc(v.w)}</div>`,
        options: opts, answer: SM("v", v), back: J.vocabBack(v), say: v.r };
    },
    "v-word": (v) => {
      const sameLen = otherItems("v", v.id, 12, (x) => x.w.length === v.w.length && x.w !== v.w);
      const opts = uniqueOptions(v.w, sameLen.map((x) => x.w).concat(otherItems("v", v.id, 6).map((x) => x.w)));
      return { mode: "choice", prompt: `<p class="q-help">${L("Quel mot correspond à ce sens ?", "Which word matches this meaning?")}</p><div class="big-fr">${esc(SM("v", v))}</div>`,
        options: opts, answer: v.w, back: J.vocabBack(v), say: v.r, jpOpts: true };
    },
    "v-flash": (v) => ({
      mode: "self", prompt: `<p class="q-help">${L("Lis le mot dans ta tête, donne son sens, puis vérifie.", "Read the word in your head, give its meaning, then check.")}</p><div class="big-jp jp" lang="ja">${esc(v.w)}</div>`,
      back: J.vocabBack(v), say: v.r
    }),
    /* Kanji */
    "k-mean": (k) => {
      const opts = uniqueOptions(SM("k", k), otherItems("k", k.id, 8).map((x) => SM("k", x)));
      return { mode: "choice", prompt: `<p class="q-help">${L("Quel est le sens de ce kanji ?", "What does this kanji mean?")}</p><div class="big-kanji jp" lang="ja">${esc(k.k)}</div>`,
        options: opts, answer: SM("k", k), back: J.kanjiBack(k) };
    },
    "k-kanji": (k) => {
      const opts = uniqueOptions(k.k, otherItems("k", k.id, 6).map((x) => x.k));
      return { mode: "choice", prompt: `<p class="q-help">${L("Quel kanji signifie :", "Which kanji means:")}</p><div class="big-fr">${esc(SM("k", k))}</div>`,
        options: opts, answer: k.k, back: J.kanjiBack(k), jpOpts: true, bigOpts: true };
    },
    "k-read": (k) => {
      const isOn = k.on.length > 0;
      const ans = isOn ? pick(k.on) : J.kunFmt(pick(k.kun));
      const own = new Set([...k.on, ...k.kun.map(J.kunFmt)]);
      const pool = otherItems("k", k.id, 30, (x) => (isOn ? x.on.length : x.kun.length)).map((x) => (isOn ? x.on[0] : J.kunFmt(x.kun[0]))).filter((r) => !own.has(r));
      return { mode: "choice", prompt: `<p class="q-help">${L(`Quelle est une lecture ${isOn ? "音読み (on)" : "訓読み (kun)"} de ce kanji ?`, `Which is a ${isOn ? "音読み (on)" : "訓読み (kun)"} reading of this kanji?`)}</p><div class="big-kanji jp" lang="ja">${esc(k.k)}</div>`,
        options: uniqueOptions(ans, pool), answer: ans, back: J.kanjiBack(k), jpOpts: true };
    },
    "k-word": (k) => {
      const wid = pick((J.kanjiWords[k.k] || []).filter((id) => J.byId.v[id] && J.byId.v[id].w !== J.byId.v[id].r));
      const v = J.byId.v[wid];
      const shown = esc(v.w).replace(esc(k.k), `<u>${esc(k.k)}</u>`);
      return { mode: "choice", prompt: `<p class="q-help">問題1 漢字読み — ${L("Comment se lit le mot ?", "How is this word read?")}</p><div class="big-jp jp" lang="ja">${shown}</div>`,
        options: readingOptions(v.w, v.r), answer: v.r, back: J.vocabBack(v) + J.kanjiBack(k), say: v.r, jpOpts: true };
    },
    "k-flash": (k) => ({
      mode: "self", prompt: `<p class="q-help">${L("Donne le sens et au moins une lecture, puis vérifie.", "Give the meaning and at least one reading, then check.")}</p><div class="big-kanji jp" lang="ja">${esc(k.k)}</div>`,
      back: J.kanjiBack(k)
    }),
    /* Grammaire */
    "g-qcm": (g) => {
      const [q, c] = pick(g.q);
      const filled = q.includes("＿＿＿") ? q.replace("＿＿＿", c[0]) : "";
      const full = filled ? esc(q).replace("＿＿＿", `<mark>${esc(c[0])}</mark>`) : "";
      return { mode: "choice", prompt: `<p class="q-help">（　）に入る最もよいものを選びなさい。</p><div class="sentence jp" lang="ja">${esc(q).replace("＿＿＿", '<span class="blank">（　　　）</span>')}</div>`,
        options: shuffle(c), answer: c[0], back: J.gramBack(g, full ? `<div class="sentence small jp" lang="ja">${full}</div>${trad(filled)}` : ""), say: filled, jpOpts: true };
    },
    "g-cloze": (g) => {
      const i = Math.floor(Math.random() * g.ex.length);
      return { mode: "self", prompt: `<p class="q-help">${L("Quelle grammaire manque ? Dis-la à voix haute, puis vérifie.", "Which grammar is missing? Say it out loud, then check.")}</p>
        <div class="sentence jp" lang="ja">${blank(g.ex[i][0])}</div><p class="fr-trad">${esc(J.gex(g, i))}</p>`,
        back: J.gramBack(g, `<div class="sentence small jp" lang="ja">${hl(g.ex[i][0])}</div>`), say: strip(g.ex[i][0]) };
    },
    "g-rev": (g) => {
      const same = otherItems("g", g.id, 3, (x) => x.cat === g.cat);
      const opts = uniqueOptions(g.p, same.map((x) => x.p).concat(otherItems("g", g.id, 6).map((x) => x.p)));
      return { mode: "choice", prompt: `<p class="q-help">${L("Quelle forme exprime ce sens ?", "Which form expresses this meaning?")}</p><div class="big-fr">${esc(J.gs(g, "s"))}</div>`,
        options: opts, answer: g.p, back: J.gramBack(g, exLine(g, 0)), jpOpts: true };
    },
    "g-ord": (g) => {
      const [pre, pcs, post, star] = g.o;
      const full = pre + pcs.join("") + post;
      return { mode: "order", pre, post, pieces: pcs, star, order: shuffle([0, 1, 2, 3]), picks: [],
        prompt: `<p class="q-help">次の文の ★ に入る最もよいものを選べるよう、並べ替えなさい。</p>`,
        back: J.gramBack(g, `<div class="sentence small jp" lang="ja">${esc(pre)}${pcs.map((p, i) => (i === star ? `<mark>${esc(p)}</mark>` : esc(p))).join("")}${esc(post)}</div>${trad(full)}`), say: full };
    },
    "g-flash": (g) => ({
      mode: "self", prompt: `<p class="q-help">${L("Donne le sens et la construction, puis vérifie.", "Give the meaning and the construction, then check.")}</p><div class="big-jp jp" lang="ja">${esc(g.p)}</div>`,
      back: J.gramBack(g, exLine(g, 0)), say: g.ex[0][0]
    })
  };

  /* ───────── Fiches d’apprentissage ───────── */
  J.learnCard = function (m, id) {
    const x = J.byId[m][id];
    if (m === "v") {
      const ks = [...x.w].filter((c) => J.byId.k[c]).map((c) => J.byId.k[c]);
      return `<div class="learn v">
        <div class="learn-head"><div class="big-jp jp" lang="ja">${esc(x.w)}</div><div class="ans-read jp" lang="ja">${esc(x.r)}</div>
        <button class="icon-btn" data-act="say" data-say="${esc(x.r)}" title="${L("Écouter", "Listen")}">🔊</button></div>
        <div class="learn-mean">${esc(M("v", x))}</div>
        ${ks.length ? `<div class="learn-sub"><h4>${L("Kanji du mot", "Kanji in this word")}</h4>${ks.map((k) => `<div class="kline"><span class="kchar jp" lang="ja">${esc(k.k)}</span><span>${esc(SM("k", k))}</span><span class="muted jp" lang="ja">${esc([...k.on, ...k.kun.map(J.kunFmt)].slice(0, 4).join("・"))}</span></div>`).join("")}</div>` : ""}
      </div>`;
    }
    if (m === "k") {
      const words = (J.kanjiWords[x.k] || []).slice(0, 6).map((wid) => J.byId.v[wid]).filter(Boolean);
      return `<div class="learn k">
        <div class="learn-head"><div class="big-kanji jp" lang="ja">${esc(x.k)}</div></div>
        <div class="learn-read">${J.kanjiReadings(x)}</div>
        <div class="learn-mean">${esc(M("k", x))}</div>
        ${words.length ? `<div class="learn-sub"><h4>${L("Mots N1 avec ce kanji", "N1 words with this kanji")}</h4>${words.map((w) => `<div class="wline"><span class="jp" lang="ja">${esc(w.w)}</span><span class="jp muted" lang="ja">${esc(w.r)}</span><span>${esc(SM("v", w))}</span><button class="icon-btn sm" data-act="say" data-say="${esc(w.r)}">🔊</button></div>`).join("")}</div>` : ""}
      </div>`;
    }
    return J.grammarLesson(x, true);
  };

  J.grammarLesson = function (g, compact) {
    const cat = J.gcats.find((c) => c.id === g.cat);
    const piege = J.gs(g, "t");
    return `<article class="glesson">
      <div class="g-top"><span class="pill">${g.n} · ${esc(cat ? cat.jp : "")}</span><span class="muted">${esc(cat ? J.gcat(cat) : "")}</span></div>
      <h2 class="g-pattern jp" lang="ja">${esc(g.p)}</h2>${g.y ? `<div class="muted jp" lang="ja">${esc(g.y)}</div>` : ""}
      <p class="g-sens">${esc(J.gs(g, "s"))}</p>
      <div class="g-box"><h4>接続 · ${L("Construction", "Construction")}</h4><div class="jp" lang="ja">${esc(g.f)}</div></div>
      <div class="g-box"><h4>${L("Explication", "Explanation")}</h4><p>${esc(J.gs(g, "e"))}</p></div>
      <div class="g-box"><h4>例文 · ${L("Exemples", "Examples")}</h4>${g.ex.map(([jp], i) => `<div class="exline">
        <button class="icon-btn sm" data-act="say" data-say="${esc(strip(jp))}" title="${L("Écouter", "Listen")}">🔊</button>
        <div><div class="jp" lang="ja">${hl(jp)}</div><div class="fr-trad">${esc(J.gex(g, i))}</div></div></div>`).join("")}</div>
      ${piege ? `<div class="g-box warn"><h4>⚠︎ ${L("Piège", "Watch out")}</h4><p>${esc(piege)}</p></div>` : ""}
      ${compact ? "" : `<div class="g-box"><h4>${L("Mes notes et mes phrases", "My notes and sentences")}</h4>
        <textarea id="notes" data-key="g:${g.id}" rows="4" placeholder="${L("Écris ici tes propres phrases avec ce point : c’est le meilleur moyen de le retenir.", "Write your own sentences with this point here: it’s the best way to remember it.")}">${esc(J.S.notes["g:" + g.id] || "")}</textarea></div>`}
    </article>`;
  };
})();
