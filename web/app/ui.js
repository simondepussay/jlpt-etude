/* JLPT Étude — interface. */
(function () {
  const J = window.J;
  const { esc, MODS, MOD_ORDER } = J;
  const app = document.getElementById("app");
  let view = { name: "home", p: {} };
  let R = null;   // session en cours (leçon ou entraînement)
  let EX = null;  // exercice affiché
  let tick = null;

  J.go = function (name, p = {}) {
    view = { name, p };
    render();
    window.scrollTo(0, 0);
  };

  /* ───────── Rendu principal ───────── */
  function render() {
    clearInterval(tick);
    if (!J.S.onboarded && view.name !== "onboarding" && view.name !== "account") view = { name: "onboarding", p: {} };
    const inRun = view.name === "run";
    app.innerHTML = (inRun ? "" : nav()) + `<main class="${inRun ? "run" : ""}">${VIEWS[view.name](view.p)}</main>`;
    if (view.name === "run" && R && R.timed) {
      tick = setInterval(() => { const el = document.getElementById("timer"); if (el) el.textContent = fmtClock((Date.now() - R.started) / 1000); }, 1000);
    }
    if (view.name === "account") J.mountGoogle(document.getElementById("g-btn"));
    const f = app.querySelector("[autofocus]");
    if (f) f.focus();
  }
  J.render = render;

  function nav() {
    const tabs = [["home", "今日", "Aujourd’hui"], ["mod-v", "語彙", "Vocabulaire"], ["mod-k", "漢字", "Kanji"], ["mod-g", "文法", "Grammaire"], ["progress", "進捗", "Progression"], ["settings", "設定", "Réglages"]];
    const cur = view.name === "mod" ? "mod-" + view.p.m : view.name === "item" ? "mod-" + view.p.m : view.name;
    const u = J.user(), bad = J.store.status === "error" || J.store.status === "offline" || J.store.expired;
    const st = u
      ? `<button class="save ${bad ? "err" : "ok"} ${cur === "account" ? "on" : ""}" data-act="nav" data-v="account" title="${esc(J.store.error || "Progression synchronisée sur ton compte")}">${bad ? "⚠︎" : "●"} ${esc(u.name || u.email || "Mon compte")}</button>`
      : `<button class="save warn ${cur === "account" ? "on" : ""}" data-act="nav" data-v="account" title="Sans compte, la progression reste dans ce navigateur">Se connecter</button>`;
    return `<header class="top"><div class="brand"><span class="hanko" aria-hidden="true">日本<br>語</span><span class="brand-t">JLPT Étude<b>${J.LEVEL}</b></span></div>
      <nav>${tabs.map(([v, jp, fr]) => `<button class="tab ${cur === v ? "on" : ""}" data-act="nav" data-v="${v}"><span class="jp">${jp}</span><span class="tfr">${fr}</span></button>`).join("")}</nav>${st}</header>`;
  }

  const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const bar = (levels, total) =>
    `<div class="lvbar">${[3, 2, 1].map((l) => `<span class="lv${l}" style="width:${(levels[l] / total) * 100}%"></span>`).join("")}</div>`;

  /* ───────── Vues ───────── */
  const VIEWS = {};

  /* Premier lancement */
  VIEWS.onboarding = () => {
    const s = J.S.settings, sessions = J.jlptSessions(4);
    const plan = J.plan();
    return `<section class="card onboard">
      <h1>ようこそ <small>Bienvenue</small></h1>
      <p>Chaque jour, l’appli te prépare une petite leçon : <b>réviser</b> ce qui est dû, <b>apprendre</b> de nouveaux éléments, puis <b>te tester</b>. Ce que tu rates revient à la fin de la leçon.</p>
      ${settingsCore(s, sessions)}
      <div class="preview">
        <h3>Ton planning de départ</h3>
        ${planTable(plan, true)}
        <p class="muted">${planNote(plan)}</p>
      </div>
      <p class="muted">Tu connais déjà une partie du N1 ? Pendant les leçons, le bouton <b>« Déjà connu »</b> permet de passer vite ce que tu sais déjà.</p>
      <div class="row"><button class="btn primary big" data-act="finish-onboard">Commencer</button>
      ${J.authReady ? `<button class="link" data-act="nav" data-v="account">J’ai déjà un compte : me connecter</button>` : ""}</div>
    </section>`;
  };

  function settingsCore(s, sessions) {
    const isCustom = !sessions.includes(s.examDate);
    return `<div class="field"><label>Ma session JLPT ${J.LEVEL}</label>
        <div class="seg wrap">${sessions.map((d) => `<button class="${s.examDate === d ? "on" : ""}" data-act="set-exam" data-d="${d}">${J.fmtDate(d)}</button>`).join("")}
        <label class="seg-date ${isCustom ? "on" : ""}">Autre date <input type="date" data-set="examDate" value="${s.examDate}"></label></div></div>
      <div class="field"><label>Jours d’étude prévus par semaine</label>
        <div class="seg">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<button class="${s.daysPerWeek === n ? "on" : ""}" data-act="set-dpw" data-n="${n}">${n}</button>`).join("")}</div></div>
      <div class="field"><label>Temps maximum par jour d’étude</label>
        <div class="seg wrap">${[15, 20, 30, 45, 60, 90, 120, 0].map((n) => `<button class="${s.maxMinutes === n ? "on" : ""}" data-act="set-max" data-n="${n}">${n ? fmtMin(n) : "Sans limite"}</button>`).join("")}</div></div>`;
  }

  function planTable(plan, onlyNew) {
    return `<table class="plan"><thead><tr><th></th>${onlyNew ? "<th>Nouveaux / jour</th><th>Restants</th>" : "<th>Réviser</th><th>Apprendre</th><th>Tester</th>"}</tr></thead><tbody>
      ${MOD_ORDER.map((m) => { const p = plan.mods[m]; return `<tr><th><span class="jp">${MODS[m].jp}</span> ${MODS[m].fr}</th>${onlyNew ? `<td>${p.new}${p.new < p.needed ? ` <small class="bad">/ ${p.needed} nécessaires</small>` : ""}</td><td>${p.remaining}</td>` : `<td>${p.due}</td><td>${p.newLeft}</td><td>${p.test}</td>`}</tr>`; }).join("")}
      </tbody></table>`;
  }
  function planNote(plan) {
    if (plan.finalPhase) return `Il reste moins de ${J.S.settings.finalWeeks} semaine(s) avant l’examen : plus de nouveaux éléments, uniquement révisions et tests.`;
    let t = `${plan.studyDays} jours d’étude d’ici le ${J.fmtDate(plan.target)} (tu gardes ${J.S.settings.finalWeeks} semaines de révision finale avant l’examen). Durée estimée d’une leçon : <b>${fmtMin(plan.minutes)}</b>.`;
    if (plan.capped) t += ` <br><span class="bad">Pour tout voir à temps, il faudrait environ ${fmtMin(plan.fullMinutes)} par jour d’étude : avec ton maximum, tu seras en retard. Augmente le temps ou les jours, ou choisis une session plus tardive.</span>`;
    return t;
  }

  /* Accueil */
  /* ───────── Formes dessinées (SVG) ───────── */
  // Ensō : cercle au pinceau ; part = fraction tracée (0–1)
  const enso = (part, inner) => {
    const C = 2 * Math.PI * 44, d = Math.max(0.04, Math.min(1, part)) * C * 0.94;
    return `<div class="enso"><svg viewBox="0 0 100 100" aria-hidden="true">
      <circle class="enso-ghost" cx="50" cy="50" r="44"/>
      <circle class="enso-ink" cx="50" cy="50" r="44" stroke-dasharray="${d.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-70 50 50)"/>
      <circle class="enso-ink thin" cx="50.6" cy="49.4" r="41.5" stroke-dasharray="${(d * 0.8).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-64 50 50)"/>
    </svg><div class="enso-in">${inner}</div></div>`;
  };
  const HANAMARU = `<svg class="mark hanamaru" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="M58 16C30 12 10 36 16 60c6 26 46 34 66 14 18-18 6-50-20-50-22 0-34 22-24 38 10 14 32 10 32-6 0-10-12-14-18-8"/><path pathLength="1" class="petal" d="M14 58c-8 8-6 22 6 22M84 70c10 4 12 16 4 22M86 26c10-4 14 6 8 14M30 14c-6-8 4-14 10-8"/></svg>`;
  const BATSU = `<svg class="mark batsu" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="M18 86C40 60 62 36 86 12"/></svg>`;
  const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥"];
  const rot = (seed) => { let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h % 17) - 8); };
  const stamp = (txt, seed, cls = "") => `<span class="stamp ${cls}" style="--r:${rot(seed)}deg">${txt}</span>`;
  const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

  /* Accueil */
  VIEWS.home = () => {
    const plan = J.plan(), proj = J.projection(), warn = J.paceWarning();
    const L = J.S.lesson && J.S.lesson.date === J.today() ? J.S.lesson : null;
    const done = L && L.pos >= L.queue.length;
    const now = new Date();
    const himekuri = `<div class="himekuri" aria-label="${J.fmtDate(J.today())}">
        <div class="hm-rings"><i></i><i></i></div>
        <div class="hm-top"><span>${now.getFullYear()}</span><span>令和${now.getFullYear() - 2018}年</span></div>
        <div class="hm-month">${now.getMonth() + 1}<small>月</small></div>
        <div class="hm-day">${now.getDate()}</div>
        <div class="hm-wd">${WEEKDAY[now.getDay()]}曜日</div>
        <div class="hm-foot">JLPT ${J.LEVEL}まで あと<b>${Math.max(0, plan.examIn)}</b>日</div>
      </div>`;
    let sheet;
    if (done) {
      sheet = `<div class="sheet lesson done">
        <div class="sheet-side">今日の勉強</div>
        ${enso(1, `<b>${fmtMin(Math.round(J.day().sec / 60)).replace(" min", "")}</b><span>分</span>`)}
        <div class="lesson-body"><h2 class="hand">おつかれさま！<small>Leçon du jour terminée</small></h2>
          <p>${L.ok} bonnes réponses · ${L.ko} erreurs.</p>
          <p class="muted">Demain : environ ${J.MOD_ORDER.reduce((a, m) => a + J.dueList(m, J.addDays(J.today(), 1)).length, 0)} révisions prévues.</p>
          <div class="row"><button class="btn" data-act="exam-start">Examen blanc</button><button class="btn" data-act="nav" data-v="mod-g">Revoir la grammaire</button></div></div>
        ${stamp("済", J.today(), "big")}</div>`;
    } else if (L) {
      const left = L.queue.slice(L.pos).filter((i) => !i.skip);
      const cnt = (s) => left.filter((i) => i.s === s).length;
      sheet = `<div class="sheet lesson">
        <div class="sheet-side">今日の勉強</div>
        ${enso(L.pos / L.queue.length, `<b>${pct(L.pos, L.queue.length)}</b><span>%</span>`)}
        <div class="lesson-body"><h2 class="hand">つづき<small>Leçon en cours</small></h2>
          <ol class="timetable">${ttRow("復習", "Réviser", cnt("rev"))}${ttRow("新出", "Apprendre", cnt("learn"))}${ttRow("小テスト", "Tester", cnt("test"))}${ttRow("やり直し", "Rattrapage", cnt("fix"))}</ol>
          <button class="btn primary big" data-act="lesson-start" autofocus>Reprendre <span class="jp">→</span></button></div></div>`;
    } else {
      const sum = (k) => MOD_ORDER.reduce((a, m) => a + plan.mods[m][k], 0);
      const total = sum("due") + sum("newLeft") + sum("test");
      sheet = `<div class="sheet lesson">
        <div class="sheet-side">今日の勉強</div>
        ${enso(Math.min(1, plan.minutes / Math.max(15, J.S.settings.maxMinutes || 60)), `<b>${plan.minutes}</b><span>分</span>`)}
        <div class="lesson-body"><h2 class="hand">今日のレッスン<small>Leçon du jour · environ ${fmtMin(plan.minutes)}</small></h2>
          <ol class="timetable">
            ${ttRow("復習", "Réviser", sum("due"), MOD_ORDER.map((m) => plan.mods[m].due))}
            ${ttRow("新出", "Apprendre", sum("newLeft"), MOD_ORDER.map((m) => plan.mods[m].newLeft))}
            ${ttRow("小テスト", "Tester", sum("test"), MOD_ORDER.map((m) => plan.mods[m].test))}
          </ol>
          ${total ? `<button class="btn primary big" data-act="lesson-start" autofocus>はじめる <span>Commencer</span></button>` : `<p>Rien de prévu aujourd’hui.</p><button class="btn" data-act="exam-start">Examen blanc</button>`}
          ${plan.capped ? `<p class="muted small">Limitée à ${fmtMin(J.S.settings.maxMinutes)} (ton réglage).</p>` : ""}</div></div>`;
    }
    return `<section class="hero">${himekuri}${sheet}</section>
      ${warn ? `<div class="sheet alert"><div class="alert-mark">!</div><div><b>Ton rythme réel est différent de ton planning.</b>
        <p>Tu as prévu <b>${warn.planned} jours</b> d’étude par semaine, mais sur les dernières semaines tu en fais en moyenne <b>${String(warn.measured).replace(".", ",")}</b>. Les leçons sont calculées pour ${warn.planned} jours : en étudiant moins souvent, tu prends du retard.</p>
        <div class="row"><button class="btn primary" data-act="pace-adapt" data-n="${warn.suggest}">Adapter les leçons à ${warn.suggest} j/sem</button><button class="btn" data-act="pace-keep">Je garde ${warn.planned} j/sem</button></div></div></div>` : ""}
      <section class="tickets">${MOD_ORDER.map((m) => modSummary(m, plan, proj)).join("")}</section>
      ${weekStrip()}`;
  };
  // Ligne d’emploi du temps : total + détail par module
  const ttRow = (jp, fr, n, per) => `<li class="${n ? "" : "off"}"><span class="tt-jp">${jp}</span><span class="tt-fr">${fr}</span>
    ${per ? `<span class="tt-per">${per.map((x, i) => (x ? `<i class="m-${MOD_ORDER[i]}">${MODS[MOD_ORDER[i]].jp[0]}${x}</i>` : "")).join("")}</span>` : ""}<b>${n}</b></li>`;

  const KANJI_MARK = { v: "語", k: "漢", g: "文" };
  function modSummary(m, plan, proj) {
    const p = plan.mods[m], pr = proj[m];
    let st;
    if (p.remaining === 0) st = stamp("完了", m + "done", "ok") + `<span class="st-fr">Tout vu</span>`;
    else if (!pr.finish) st = stamp("未着手", m, "grey") + `<span class="st-fr">Pas commencé</span>`;
    else if (pr.onTime) st = stamp("順調", m, "ok") + `<span class="st-fr">Dans les temps</span>`;
    else st = stamp("遅れ", m) + `<span class="st-fr">Retard ≈ ${Math.ceil(pr.late / 7)} sem.</span>`;
    return `<button class="ticket t-${m}" data-act="nav" data-v="mod-${m}">
      <span class="t-stub"><span class="t-kanji">${KANJI_MARK[m]}</span><span class="t-no">No.${m === "v" ? "01" : m === "k" ? "02" : "03"}</span></span>
      <span class="t-body">
        <span class="t-head"><span class="jp t-jp">${MODS[m].jp}</span><span class="t-fr">${MODS[m].fr}</span></span>
        ${bar(p.levels, p.total)}
        <span class="t-n"><b>${p.learned}</b><small>/ ${p.total} ${MODS[m].unit}</small></span>
        <span class="t-meta">${p.levels[3]} maîtrisés${pr.finish ? ` · fin prévue ${J.fmtShort(pr.finish)}` : ""}</span>
        <span class="t-status">${st}</span>
      </span></button>`;
  }

  function weekStrip() {
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(J.addDays(J.today(), -i));
    const streak = J.streak();
    return `<section class="stampcard">
      <div class="sc-head"><h3 class="hand">がんばりカード</h3><span class="muted small">Carte de tampons · prévu ${J.S.settings.daysPerWeek} j/sem · réel ${J.measuredDPW() ?? "—"}</span>
        <span class="sc-streak"><b>${streak}</b>日連続</span></div>
      <div class="sc-grid">${days.map((d) => {
        const x = J.S.days[d], min = x ? Math.round(x.sec / 60) : 0, today = d === J.today();
        return `<div class="sc-cell ${today ? "today" : ""}"><span class="sc-wd">${WEEKDAY[J.parse(d).getDay()]}<small>${J.parse(d).getDate()}</small></span>
          <span class="sc-slot">${x && x.done ? stamp("済", d) : J.studied(d) ? stamp("途中", d, "grey") : ""}</span><span class="sc-min">${min ? min + " min" : ""}</span></div>`;
      }).join("")}</div></section>`;
  }

  /* Pages module */
  VIEWS.mod = ({ m, f = "all", q = "", page = 0 }) => {
    const c = J.counts(m), acc = J.accuracy(m);
    const head = `<section class="mod-head"><div><h1><span class="jp">${MODS[m].jp}</span> ${MODS[m].fr} <small>${J.LEVEL}</small></h1>
      ${bar(c.levels, c.total)}
      <div class="legend">${J.LEVELS.map((l, i) => `<span><i class="lv${i}"></i>${l} ${c.levels[i]}</span>`).join("")}${acc !== null ? `<span>Réussite ${Math.round(acc * 100)} %</span>` : ""}</div></div>
      <div class="row"><button class="btn primary" data-act="practice" data-m="${m}">S’entraîner</button><button class="btn" data-act="mod-test" data-m="${m}">Test JLPT ${MODS[m].fr.toLowerCase()}</button>
      ${m === "g" ? `<a class="btn" href="Fiches-grammaire-N1.html" target="_blank">Fiches imprimables</a>` : ""}</div></section>`;
    const filters = [["all", "Tous"], ["0", "Nouveaux"], ["1", "En cours"], ["2", "Acquis"], ["3", "Maîtrisés"], ["weak", "Points faibles"], ["due", "À réviser"]].concat(m !== "g" ? [["out", "Retirés"]] : []);
    let list = J.items[m];
    if (f === "out") list = J.all[m].filter((x) => J.isExcluded(m, x.id));
    else if (f === "weak") list = J.weak(m, 300);
    else if (f === "due") { const d = new Set(J.dueList(m)); list = list.filter((x) => d.has(x.id)); }
    else if (f !== "all") list = list.filter((x) => J.levelOf(m, x.id) === +f);
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter((x) => (m === "v" ? x.w + x.r + x.m : m === "k" ? x.k + x.on.join() + x.kun.join() + x.m : x.p + x.s + x.f).toLowerCase().includes(ql));
    }
    const ctrl = `<div class="filters"><input id="search" data-m="${m}" placeholder="Rechercher…" value="${esc(q)}">
      <div class="seg wrap">${filters.map(([k, l]) => `<button class="${f === k ? "on" : ""}" data-act="filter" data-m="${m}" data-f="${k}">${l}</button>`).join("")}</div></div>`;
    let body = "";
    if (m === "g") {
      body = J.gcats.map((cat) => {
        const pts = list.filter((x) => x.cat === cat.id);
        if (!pts.length) return "";
        return `<h3 class="cat"><span class="jp">${esc(cat.jp)}</span> · ${esc(cat.fr)}</h3><div class="glist">${pts.map((g) =>
          `<button class="gitem" data-act="open-item" data-m="g" data-id="${g.id}"><i class="dot lv${J.levelOf("g", g.id)}"></i><span class="num">${g.n}</span><span class="jp">${esc(g.p)}</span><span class="muted">${esc(g.s)}</span></button>`).join("")}</div>`;
      }).join("");
    } else {
      const per = m === "k" ? 240 : 120, pages = Math.max(1, Math.ceil(list.length / per)), pg = Math.min(page, pages - 1);
      const slice = list.slice(pg * per, pg * per + per);
      body = m === "k"
        ? `<div class="kgrid">${slice.map((k) => `<button class="ktile lv${J.levelOf("k", k.id)} jp" data-act="open-item" data-m="k" data-id="${esc(k.id)}" title="${esc(k.m)}">${esc(k.k)}</button>`).join("")}</div>`
        : `<div class="vlist">${slice.map((v) => `<button class="vrow" data-act="open-item" data-m="v" data-id="${esc(v.id)}"><i class="dot lv${J.levelOf("v", v.id)}"></i><span class="jp w">${esc(v.w)}</span><span class="jp r">${esc(v.r)}</span><span class="mm">${esc(J.shortMeaning(v.m))}</span></button>`).join("")}</div>`;
      if (pages > 1) body += `<div class="pager">${pg > 0 ? `<button class="btn" data-act="page" data-m="${m}" data-pg="${pg - 1}">← Précédent</button>` : ""}<span>Page ${pg + 1} / ${pages} · ${list.length} éléments</span>${pg < pages - 1 ? `<button class="btn" data-act="page" data-m="${m}" data-pg="${pg + 1}">Suivant →</button>` : ""}</div>`;
    }
    return head + ctrl + (body || `<p class="muted">Aucun élément.</p>`);
  };

  /* Fiche d’un élément */
  VIEWS.item = ({ m, id }) => {
    const r = J.rec(m, id), lv = J.levelOf(m, id);
    const list = J.all[m], idx = list.findIndex((x) => x.id === id);
    const prev = list[idx - 1], next = list[idx + 1];
    const stat = r && r.at ? `<div class="stat-line"><span class="pill lv${lv}">${J.LEVELS[lv]}</span><span>Appris le ${J.fmtShort(r.at)}</span><span>Prochaine révision : ${r.due ? J.fmtShort(r.due) : "—"}</span><span>✓ ${r.ok} · ✗ ${r.ko}</span></div>`
      : `<div class="stat-line"><span class="pill">Nouveau</span><button class="btn sm" data-act="known" data-m="${m}" data-id="${esc(id)}">Je le connais déjà</button></div>`;
    const out = J.isExcluded(m, id);
    const body = (m === "g" ? J.grammarLesson(J.byId.g[id], false) : `<div class="card">${J.learnCard(m, id)}</div>`)
      + (m !== "g" ? `<div class="row">${out ? `<span class="pill bad">Retiré des leçons</span><button class="btn sm" data-act="exclude" data-m="${m}" data-id="${esc(id)}" data-on="0">Remettre dans le N1</button>`
        : `<button class="link" data-act="exclude" data-m="${m}" data-id="${esc(id)}" data-on="1">Pas du N1 : retirer des leçons</button>`}</div>` : "");
    return `<div class="item-nav"><button class="link" data-act="nav" data-v="mod-${m}">← ${MODS[m].fr}</button>
      <span>${prev ? `<button class="btn sm" data-act="open-item" data-m="${m}" data-id="${esc(prev.id)}">←</button>` : ""}
      ${next ? `<button class="btn sm" data-act="open-item" data-m="${m}" data-id="${esc(next.id)}">→</button>` : ""}</span></div>
      ${stat}${body}
      ${m === "g" ? `<div class="row"><button class="btn primary" data-act="drill" data-m="g" data-id="${id}">M’entraîner sur ce point (5 questions)</button></div>` : ""}`;
  };

  /* Choix d’entraînement */
  VIEWS.practice = ({ m }) => {
    const c = J.counts(m);
    return `<section class="card"><h1>S’entraîner · <span class="jp">${MODS[m].jp}</span> ${MODS[m].fr}</h1>
      <p class="muted">L’entraînement libre ne modifie pas ton planning ; il enregistre seulement tes réussites et tes erreurs.</p>
      <div class="field"><label>Sur quels éléments ?</label><div class="seg wrap" id="p-src">
        <button class="on" data-act="pseg" data-g="src" data-v="learned">Déjà vus (${c.learned})</button>
        <button data-act="pseg" data-g="src" data-v="weak">Points faibles (${J.weak(m, 999).length})</button>
        <button data-act="pseg" data-g="src" data-v="all">Tous (${c.total})</button></div></div>
      <div class="field"><label>Nombre de questions</label><div class="seg" id="p-n">
        ${[10, 20, 30, 50].map((n, i) => `<button class="${i === 0 ? "on" : ""}" data-act="pseg" data-g="n" data-v="${n}">${n}</button>`).join("")}</div></div>
      <button class="btn primary big" data-act="practice-go" data-m="${m}">Démarrer</button></section>`;
  };

  /* Progression */
  VIEWS.progress = () => {
    const plan = J.plan(), proj = J.projection();
    const mdpw = J.measuredDPW();
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(J.addDays(J.today(), -i));
    const maxSec = Math.max(60, ...days.map((d) => (J.S.days[d] ? J.S.days[d].sec : 0)));
    let totalSec = 0; for (const d in J.S.days) totalSec += J.S.days[d].sec;
    return `<h1>進捗 · Progression</h1>
      <div class="kpis">
        <div class="kpi"><b>${J.streak()}</b><span>jours d’affilée</span></div>
        <div class="kpi"><b>${fmtMin(Math.round(totalSec / 60))}</b><span>temps total</span></div>
        <div class="kpi"><b>${J.S.settings.daysPerWeek}</b><span>j/sem prévus</span></div>
        <div class="kpi"><b>${mdpw ?? "—"}</b><span>j/sem réels (4 sem.)</span></div>
        <div class="kpi"><b>J-${Math.max(0, plan.examIn)}</b><span>avant le JLPT</span></div>
      </div>
      <div class="card"><h3>Suis-je dans les temps ?</h3>
        <table class="plan"><thead><tr><th></th><th>Vus</th><th>Maîtrisés</th><th>Réussite</th><th>Rythme</th><th>Fin prévue</th><th>Objectif</th></tr></thead><tbody>
        ${MOD_ORDER.map((m) => { const p = plan.mods[m], pr = proj[m], acc = J.accuracy(m);
          return `<tr><th><span class="jp">${MODS[m].jp}</span> ${MODS[m].fr}</th><td>${p.learned}/${p.total}</td><td>${p.levels[3]}</td><td>${acc === null ? "—" : Math.round(acc * 100) + " %"}</td>
          <td>${String(pr.perStudyDay).replace(".", ",")}/jour</td><td class="${pr.onTime ? "good" : "bad"}">${pr.finish ? J.fmtShort(pr.finish) : "—"}</td><td>${J.fmtShort(plan.target)}</td></tr>`; }).join("")}
        </tbody></table>
        <p class="muted small">L’objectif est de tout avoir vu ${J.S.settings.finalWeeks} semaines avant l’examen (${J.fmtDate(J.S.settings.examDate)}), pour garder du temps pour la révision finale. La projection utilise ton rythme réel dès que tu as assez de jours de données.</p>
        <p class="small">${planNote(plan)}</p></div>
      <div class="card"><h3>Temps d’étude, 14 derniers jours</h3><div class="bars">${days.map((d) => { const s = J.S.days[d] ? J.S.days[d].sec : 0;
          return `<div class="b" title="${J.fmtShort(d)} : ${Math.round(s / 60)} min"><span style="height:${(s / maxSec) * 100}%"></span><i>${J.parse(d).getDate()}</i></div>`; }).join("")}</div>
        <p class="muted small">Temps moyen mesuré : vocabulaire ${Math.round(J.S.timing.v.learn)} s par nouveau mot · kanji ${Math.round(J.S.timing.k.learn)} s · grammaire ${fmtMin(Math.round(J.S.timing.g.learn / 60))} par nouveau point. Ces valeurs s’ajustent toutes seules et servent à estimer la durée des leçons.</p></div>
      <div class="card"><h3>Calendrier</h3>${heatmap()}</div>
      <div class="grid3">${MOD_ORDER.map((m) => { const w = J.weak(m, 8);
        return `<div class="card"><h3>Points faibles · ${MODS[m].fr}</h3>${w.length ? w.map((x) => `<button class="weak" data-act="open-item" data-m="${m}" data-id="${esc(x.id)}"><span class="jp">${esc(m === "v" ? x.w : m === "k" ? x.k : x.p)}</span><span class="muted">✗ ${J.rec(m, x.id).ko}</span></button>`).join("") : `<p class="muted">Aucun pour l’instant.</p>`}</div>`; }).join("")}</div>
      <div class="row"><button class="btn primary" data-act="exam-start">Examen blanc (30 questions)</button></div>`;
  };

  function heatmap() {
    const end = J.today();
    const dow = (J.parse(end).getDay() + 6) % 7;
    const n = 7 * 15 + dow + 1;
    const cells = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = J.addDays(end, -i), x = J.S.days[d];
      const min = x ? x.sec / 60 : 0;
      const lv = min === 0 ? 0 : min < 10 ? 1 : min < 25 ? 2 : min < 45 ? 3 : 4;
      cells.push(`<i class="h${lv}" title="${J.fmtShort(d)} : ${Math.round(min)} min"></i>`);
    }
    return `<div class="heat">${cells.join("")}</div><div class="heat-legend">Moins <i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i> Plus</div>`;
  }

  /* Réglages */
  VIEWS.settings = () => {
    const s = J.S.settings;
    const u = J.user();
    const st = u
      ? `<p>Ta progression est synchronisée sur ton compte <b>${esc(u.email || u.name || "")}</b>.${J.store.lastSave ? ` Dernière synchronisation : ${J.store.lastSave.toLocaleTimeString("fr-FR")}.` : ""}</p>${J.store.error ? `<p class="bad">${esc(J.store.error)}</p>` : ""}`
      : `<p class="bad">Tu n’es pas connecté : ta progression est gardée dans ce navigateur seulement. <button class="link" data-act="nav" data-v="account">Se connecter</button></p>`;
    return `<h1>設定 · Réglages</h1>
      <section class="card">${settingsCore(s, J.jlptSessions(4))}
        <div class="field"><label>Semaines de révision finale avant l’examen (sans nouveaux éléments)</label>
          <div class="seg">${[0, 1, 2, 3, 4].map((n) => `<button class="${s.finalWeeks === n ? "on" : ""}" data-act="set-final" data-n="${n}">${n}</button>`).join("")}</div></div>
        <div class="field"><label>Questions de test par leçon</label><div class="row">${MOD_ORDER.map((m) => `<label class="num">${MODS[m].fr} <input type="number" min="0" max="30" data-set="test-${m}" value="${s.tests[m]}"></label>`).join("")}</div></div>
        <div class="field"><label>Vitesse de la voix japonaise</label><input type="range" min="0.6" max="1.2" step="0.05" data-set="rate" value="${s.rate}"></div>
        <div class="preview"><h3>Effet sur ton planning</h3>${planTable(J.plan(), true)}<p class="muted">${planNote(J.plan())}</p></div>
      </section>
      <section class="card"><h3>Sauvegarde</h3>${st}
        <div class="row"><button class="btn" data-act="export">Exporter une copie (.json)</button>
        <button class="btn" data-act="import">Importer une sauvegarde</button><input type="file" id="importFile" accept=".json,application/json" hidden></div>
        <p class="muted small">L’export est une copie de secours ; il peut être réimporté sur n’importe quel appareil.</p></section>
      <section class="card danger"><h3>Zone sensible</h3><button class="btn" data-act="reset">Tout réinitialiser…</button></section>`;
  };

  /* Compte */
  const PROV = { google: "Google", apple: "Apple", microsoft: "Microsoft" };
  VIEWS.account = () => {
    const u = J.user();
    if (u) {
      const status = J.store.expired
        ? `<p class="bad">Ta session a expiré. Reconnecte-toi pour reprendre la synchronisation (rien n’est perdu, tout est gardé dans ce navigateur).</p><button class="btn primary" data-act="relogin">Se reconnecter</button>`
        : J.store.error ? `<p class="bad">${esc(J.store.error)}</p>`
        : `<p class="good">● Progression synchronisée${J.store.lastSave ? ` (dernière fois à ${J.store.lastSave.toLocaleTimeString("fr-FR")})` : ""}.</p>`;
      return `<h1>アカウント · Mon compte</h1>
        <section class="card"><div class="acct"><div class="avatar">${esc((u.name || u.email || "?")[0].toUpperCase())}</div>
          <div><b>${esc(u.name || "")}</b><div class="muted">${esc(u.email || "")} · connexion ${esc(PROV[u.provider] || u.provider)}</div></div></div>
          ${status}
          <div class="row"><button class="btn" data-act="sync-now">Synchroniser maintenant</button><button class="btn" data-act="logout">Se déconnecter</button></div>
          <p class="muted small">Sur un ordinateur partagé, déconnecte-toi : la progression est alors effacée de ce navigateur (elle reste sur ton compte).</p></section>
        <section class="card danger"><h3>Supprimer mon compte</h3><p class="muted">Efface définitivement ton compte et toute ta progression enregistrée en ligne.</p>
          <button class="btn" data-act="delete-account">Supprimer mon compte…</button></section>`;
    }
    const P = Object.fromEntries(J.providers.map((p) => [p.id, p.enabled]));
    return `<h1>アカウント · Se connecter</h1>
      <section class="card login">
        <p>Connecte-toi pour retrouver ta progression sur tous tes appareils (et plus tard dans l’appli iPhone). Sans compte, elle reste uniquement dans ce navigateur.</p>
        ${J.authReady ? `<div class="auth-btns">
          ${P.google ? `<div id="g-btn" class="g-btn"></div>` : ""}
          ${P.apple ? `<button class="btn auth apple" data-act="login-apple"><span aria-hidden="true"></span> Continuer avec Apple</button>` : ""}
          ${P.microsoft ? `<button class="btn auth ms" data-act="login-ms"><span class="ms-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span> Continuer avec Microsoft</button>` : ""}
        </div>` : `<p class="bad">La connexion n’est pas encore activée sur ce site (identifiants Google, Apple ou Microsoft à configurer).</p>`}
        <div id="auth-msg" class="bad"></div>
        <p class="muted small">Ce que tu as déjà fait ici sans compte sera ajouté à ton compte. Aucun mot de passe n’est stocké par JLPT Étude.</p>
      </section>`;
  };

  /* ───────── Session (leçon / entraînement) ───────── */
  function buildLesson() {
    const plan = J.plan(), q = [];
    for (const m of MOD_ORDER) J.shuffle(J.dueList(m).slice(0, J.S.settings.revCap)).forEach((id) => q.push({ s: "rev", m, id }));
    const newIds = {};
    for (const m of MOD_ORDER) {
      const ids = J.items[m].filter((x) => !J.isLearned(m, x.id)).slice(0, plan.mods[m].newLeft).map((x) => x.id);
      newIds[m] = new Set(ids);
      const size = m === "g" ? 2 : 5;
      for (let i = 0; i < ids.length; i += size) {
        const chunk = ids.slice(i, i + size);
        chunk.forEach((id) => q.push({ s: "learn", m, id }));
        J.shuffle(chunk).forEach((id) => q.push({ s: "check", m, id }));
      }
    }
    for (const m of MOD_ORDER) {
      const pool = J.items[m].filter((x) => J.isLearned(m, x.id) && !newIds[m].has(x.id));
      const weak = J.shuffle(J.weak(m, 50).filter((x) => J.isLearned(m, x.id)));
      const n = Math.min(J.S.settings.tests[m], pool.length);
      const chosen = new Set(weak.slice(0, Math.ceil(n / 2)).map((x) => x.id));
      for (const x of J.shuffle(pool)) { if (chosen.size >= n) break; chosen.add(x.id); }
      [...chosen].forEach((id) => q.push({ s: "test", m, id }));
    }
    return { date: J.today(), queue: q, pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now() };
  }

  function startLesson() {
    if (!J.S.lesson || J.S.lesson.date !== J.today()) { J.S.lesson = buildLesson(); J.save(); }
    R = J.S.lesson; R.type = "lesson"; R.title = "今日のレッスン"; R.timed = false;
    EX = null;
    J.go("run");
  }
  function startPractice(m, src, n, testOnly, title) {
    let pool;
    if (src === "weak") pool = J.weak(m, 999);
    else if (src === "all") pool = J.items[m];
    else pool = J.items[m].filter((x) => J.isLearned(m, x.id));
    if (!pool.length) pool = J.items[m].slice(0, 60);
    const ids = J.shuffle(pool).slice(0, n).map((x) => x.id);
    R = { type: "practice", title: title || "練習 · " + MODS[m].fr, queue: ids.map((id) => ({ s: testOnly ? "test" : "rev", m, id, free: true })), pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now(), timed: !!testOnly };
    EX = null;
    J.go("run");
  }
  function startExam() {
    const q = [];
    for (const m of MOD_ORDER) {
      let pool = J.items[m].filter((x) => J.isLearned(m, x.id));
      if (pool.length < 10) pool = pool.concat(J.items[m].slice(0, 80));
      J.shuffle([...new Map(pool.map((x) => [x.id, x])).values()]).slice(0, 10).forEach((x) => q.push({ s: "test", m, id: x.id, free: true }));
    }
    R = { type: "practice", title: "模擬試験 · Examen blanc", queue: q, pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now(), timed: true, noFix: true };
    EX = null;
    J.go("run");
  }

  const STAGE_FR = { rev: "Réviser", learn: "Apprendre", check: "Vérifier", test: "Tester", fix: "Rattrapage" };

  VIEWS.run = () => {
    if (!R) return VIEWS.home();
    while (R.pos < R.queue.length && R.queue[R.pos].skip) R.pos++;
    const it = R.queue[R.pos];
    const head = `<div class="run-head"><button class="link" data-act="quit">✕ Quitter</button><span class="run-title jp">${esc(R.title)}</span>
      ${R.timed ? `<span id="timer" class="timer">${fmtClock((Date.now() - R.started) / 1000)}</span>` : `<span class="muted">${Math.min(R.pos + 1, R.queue.length)} / ${R.queue.length}</span>`}</div>
      <div class="progress ruler"><span style="width:${pct(R.pos, R.queue.length)}%"></span></div>`;
    if (!it) return head + finishView();
    if (it.s !== "learn" && (!EX || EX._pos !== R.pos)) { EX = J.makeEx(it.m, it.id, it.s === "fix" ? "rev" : it.s, it.kind); EX._pos = R.pos; }
    const tag = `<div class="ex-tag"><span class="pill mod-${it.m}"><span class="jp">${MODS[it.m].jp}</span> ${MODS[it.m].fr}</span><span class="pill stage-${it.s}">${STAGE_FR[it.s]}</span>${it.s !== "learn" && EX ? `<span class="muted">${esc(EX.label)}</span>` : ""}</div>`;
    const aside = it.m !== "g" && !it.free ? `<div class="ex-aside"><button data-act="exclude-cur">Ce ${it.m === "v" ? "mot" : "kanji"} n’est pas du niveau N1 ? Le retirer des leçons</button></div>` : "";
    if (it.s === "learn") {
      if (!R.learnT0 || R.learnPos !== R.pos) { R.learnT0 = Date.now(); R.learnPos = R.pos; }
      return head + `<section class="card ex">${`<div class="ex-tag"><span class="pill mod-${it.m}"><span class="jp">${MODS[it.m].jp}</span> ${MODS[it.m].fr}</span><span class="pill stage-learn">Nouveau</span></div>`}
        ${J.learnCard(it.m, it.id)}
        <div class="row end"><button class="btn" data-act="learn-known">Déjà connu</button><button class="btn primary" data-act="learn-next" autofocus>J’ai compris → Suivant <kbd>↵</kbd></button></div></section>${aside}`;
    }
    return head + `<section class="card ex">${tag}${exBody(EX)}</section>${aside}`;
  };

  function exBody(ex) {
    let h = ex.prompt;
    if (ex.mode === "choice") {
      h += `<div class="opts ${ex.bigOpts ? "big" : ""}">${ex.options.map((o, i) => {
        let cls = "";
        if (ex.answered) cls = o === ex.answer ? "ok" : i === ex.chosen ? "ko" : "dim";
        const mark = ex.answered ? (o === ex.answer ? HANAMARU : i === ex.chosen ? BATSU : "") : "";
        return `<button class="opt ${cls} ${ex.jpOpts ? "jp" : ""}" data-act="opt" data-i="${i}" ${ex.answered ? "disabled" : ""}><span class="bubble">${CIRCLED[i]}</span><span class="opt-t">${esc(o)}</span>${mark}</button>`;
      }).join("")}</div>`;
      if (ex.answered) h += feedback(ex.correct, ex.correct ? "" : ex.answer) + ex.back + contBtn();
    } else if (ex.mode === "self") {
      if (!ex.revealed) h += `<div class="row center"><button class="btn primary" data-act="reveal" autofocus>Afficher la réponse <kbd>espace</kbd></button></div>`;
      else h += ex.back + `<p class="q-help center">Comment t’en es-tu sorti ?</p><div class="grades">
        <button class="g0" data-act="grade" data-q="0"><span class="jp">×</span>Raté<kbd>1</kbd></button><button class="g1" data-act="grade" data-q="1"><span class="jp">△</span>Difficile<kbd>2</kbd></button>
        <button class="g2" data-act="grade" data-q="2"><span class="jp">○</span>Bien<kbd>3</kbd></button><button class="g3" data-act="grade" data-q="3"><span class="jp">◎</span>Facile<kbd>4</kbd></button></div>`;
    } else if (ex.mode === "order") {
      const slots = [0, 1, 2, 3].map((k) => {
        const p = ex.picks[k];
        const cls = ex.answered ? (p === k ? "ok" : "ko") : "";
        return `<button class="slot ${k === ex.star ? "star" : ""} ${cls}" data-act="slot" data-k="${k}" ${ex.answered ? "disabled" : ""}>${p !== undefined ? esc(ex.pieces[p]) : k === ex.star ? "★" : "＿＿"}</button>`;
      }).join("");
      h += `<div class="sentence jp order" lang="ja">${esc(ex.pre)}${slots}${esc(ex.post)}</div>`;
      if (!ex.answered) {
        h += `<div class="pieces">${ex.order.map((i) => `<button class="piece jp" data-act="piece" data-i="${i}" ${ex.picks.includes(i) ? "disabled" : ""}>${esc(ex.pieces[i])}</button>`).join("")}</div>
          <div class="row center"><button class="btn" data-act="order-clear">Effacer</button>${ex.picks.length === 4 ? `<button class="btn primary" data-act="order-check" autofocus>Vérifier <kbd>↵</kbd></button>` : ""}</div>`;
      } else {
        h += feedback(ex.correct, ex.correct ? "" : `ordre correct ci-dessous · ★ = ${ex.pieces[ex.star]}`) + ex.back + contBtn();
      }
    }
    return h;
  }
  const feedback = (ok, ans) => `<div class="fb ${ok ? "ok" : "ko"}"><span class="fb-jp">${ok ? "正解！" : "ざんねん"}</span><span>${ok ? "Correct" : `La bonne réponse : <b class="jp">${esc(ans)}</b>`}</span></div>`;
  const contBtn = () => `<div class="row end"><button class="btn primary" data-act="cont" autofocus>Continuer <kbd>↵</kbd></button></div>`;

  function finishView() {
    const lesson = R.type === "lesson";
    if (lesson) { J.day().done = true; J.save(true); }
    const tot = R.ok + R.ko;
    const errs = [...new Map((R.errors || []).map((e) => [e.m + e.id, e])).values()];
    return `<section class="card finish"><h1>${lesson ? "お疲れさまでした！" : "終了！"}</h1>
      <p class="score">${tot ? Math.round((R.ok / tot) * 100) : 0} % <small>${R.ok} ✓ · ${R.ko} ✗</small></p>
      <p>Durée : ${fmtClock((Date.now() - R.started) / 1000)}</p>
      ${errs.length ? `<h3>À revoir</h3><div class="errs">${errs.map((e) => { const x = J.byId[e.m][e.id];
        return `<button class="weak" data-act="open-item" data-m="${e.m}" data-id="${esc(e.id)}"><span class="pill mod-${e.m} jp">${MODS[e.m].jp}</span><span class="jp">${esc(e.m === "v" ? x.w : e.m === "k" ? x.k : x.p)}</span></button>`; }).join("")}</div>` : `<p>Aucune erreur, bravo !</p>`}
      ${lesson ? `<p class="muted">Ce que tu as raté reviendra dans tes prochaines révisions.</p>` : ""}
      <div class="row center"><button class="btn primary" data-act="end-run">Retour à l’accueil</button></div></section>`;
  }

  /* Résultat d’un exercice */
  function result(q) {
    const it = R.queue[R.pos], ok = q > 0;
    const sec = (Date.now() - EX.t0) / 1000;
    J.addTime(it.m, it.s === "test" ? "test" : "rev", sec);
    J.record(it.m, it.id, ok);
    ok ? R.ok++ : R.ko++;
    if (!ok) R.errors.push({ m: it.m, id: it.id });
    if (!it.free) {
      if (it.s === "rev") J.grade(it.m, it.id, q);
      else if (it.s === "check") {
        const r = J.ensure(it.m, it.id);
        r.r++;
        if (ok) { r.iv = 1; r.due = J.addDays(J.today(), 1); } else { r.iv = 0; r.due = J.today(); r.l++; }
        J.save();
      } else if (it.s === "test" && !ok) J.grade(it.m, it.id, 0);
    }
    if (!ok && !R.noFix) {
      const k = it.m + ":" + it.id;
      R.fix[k] = (R.fix[k] || 0) + 1;
      if (R.fix[k] <= 3) R.queue.push({ s: "fix", m: it.m, id: it.id, free: it.free });
    }
  }
  function advance() {
    R.pos++;
    EX = null;
    if (R.type === "lesson") J.save();
    render();
    window.scrollTo(0, 0);
  }

  /* ───────── Actions ───────── */
  const A = {
    nav: (d) => { const v = d.v; if (v.startsWith("mod-")) J.go("mod", { m: v.slice(4) }); else J.go(v); },
    "set-exam": (d) => { J.S.settings.examDate = d.d; J.save(); render(); },
    "set-dpw": (d) => { J.S.settings.daysPerWeek = +d.n; J.S.paceAck = null; J.save(); render(); },
    "set-max": (d) => { J.S.settings.maxMinutes = +d.n; J.save(); render(); },
    "set-final": (d) => { J.S.settings.finalWeeks = +d.n; J.save(); render(); },
    "finish-onboard": () => { J.S.onboarded = true; J.save(true); J.go("home"); },
    "pace-adapt": (d) => { J.S.settings.daysPerWeek = +d.n; J.S.paceAck = J.today(); J.save(); render(); },
    "pace-keep": () => { J.S.paceAck = J.today(); J.save(); render(); },
    "lesson-start": startLesson,
    "exam-start": startExam,
    practice: (d) => J.go("practice", { m: d.m }),
    "mod-test": (d) => startPractice(d.m, "learned", 20, true, "テスト · " + MODS[d.m].fr),
    pseg: (d, el) => { el.parentElement.querySelectorAll("button").forEach((b) => b.classList.remove("on")); el.classList.add("on"); },
    "practice-go": (d) => {
      const src = document.querySelector("#p-src .on").dataset.v, n = +document.querySelector("#p-n .on").dataset.v;
      startPractice(d.m, src, n, false);
    },
    drill: (d) => {
      R = { type: "practice", title: "練習 · " + J.byId.g[d.id].p, queue: ["g-qcm", "g-rev", "g-cloze", "g-ord", "g-qcm"].map((k) => ({ s: "rev", m: "g", id: d.id, free: true, kind: k })), pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now(), noFix: true };
      EX = null; J.go("run");
    },
    filter: (d) => J.go("mod", { m: d.m, f: d.f, q: (document.getElementById("search") || {}).value || "" }),
    page: (d) => J.go("mod", { ...view.p, page: +d.pg }),
    "open-item": (d) => J.go("item", { m: d.m, id: d.id }),
    known: (d) => { J.markKnown(d.m, d.id); render(); },
    say: (d) => J.say(d.say),
    quit: () => { if (R && R.type === "lesson") J.save(true); R = null; EX = null; J.go("home"); },
    "end-run": () => { R = null; EX = null; J.go("home"); },
    "learn-next": () => {
      const it = R.queue[R.pos];
      J.markLearned(it.m, it.id);
      J.addTime(it.m, "learn", (Date.now() - (R.learnT0 || Date.now())) / 1000);
      advance();
    },
    "exclude-cur": () => {
      const it = R.queue[R.pos];
      J.setExcluded(it.m, it.id, true);
      R.queue.forEach((q, i) => { if (i > R.pos && q.m === it.m && q.id === it.id) q.skip = true; });
      advance();
    },
    exclude: (d) => { J.setExcluded(d.m, d.id, d.on === "1"); render(); },
    "learn-known": () => {
      const it = R.queue[R.pos];
      J.markKnown(it.m, it.id);
      R.queue.forEach((q, i) => { if (i > R.pos && q.s === "check" && q.m === it.m && q.id === it.id) q.skip = true; });
      advance();
    },
    opt: (d) => {
      if (!EX || EX.answered) return;
      const i = +d.i;
      EX.answered = true; EX.chosen = i; EX.correct = EX.options[i] === EX.answer;
      if (EX.say && EX.correct) J.say(EX.say);
      render();
    },
    reveal: () => { if (EX && EX.mode === "self") { EX.revealed = true; if (EX.say) J.say(EX.say); render(); } },
    grade: (d) => { result(+d.q); advance(); },
    piece: (d) => { if (EX.picks.length < 4 && !EX.picks.includes(+d.i)) { EX.picks.push(+d.i); render(); } },
    slot: (d) => { const k = +d.k; if (k < EX.picks.length) { EX.picks.splice(k, 1); render(); } },
    "order-clear": () => { EX.picks = []; render(); },
    "order-check": () => {
      EX.answered = true;
      EX.correct = EX.picks.every((p, k) => p === k);
      if (EX.correct) J.say(EX.say);
      render();
    },
    cont: () => { if (EX && EX.answered) { result(EX.correct ? 2 : 0); advance(); } },
    "login-apple": () => J.signInApple(),
    "login-ms": () => J.signInMicrosoft(),
    logout: () => { if (!confirm("Se déconnecter ? La progression sera retirée de ce navigateur (elle reste sur ton compte).")) return; J.logout(); R = null; J.go("onboarding"); },
    relogin: () => { J.dropSession(); J.go("account"); },
    "sync-now": () => { J.save(true); setTimeout(render, 1500); },
    "delete-account": async () => {
      if (!confirm("Supprimer ton compte et toute ta progression en ligne ?")) return;
      if (!confirm("C’est définitif. Confirmer la suppression ?")) return;
      try { await J.deleteAccount(); R = null; alert("Ton compte a été supprimé."); J.go("onboarding"); } catch (e) { alert(e.message); }
    },
    export: () => J.exportFile(),
    import: () => document.getElementById("importFile").click(),
    reset: () => {
      if (!confirm("Effacer toute ta progression ? (Pense à exporter une copie avant.)")) return;
      if (!confirm("Vraiment tout effacer ? Cette action est définitive.")) return;
      J.S = J.defaultState(); J.save(true); R = null; J.go("onboarding");
    }
  };

  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset, el); }
  });
  app.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "importFile" && t.files[0]) {
      t.files[0].text().then((txt) => {
        try { J.importObject(JSON.parse(txt)); alert("Sauvegarde importée."); J.go("home"); } catch (err) { alert(err.message); }
      });
      return;
    }
    const k = t.dataset.set;
    if (!k) return;
    const s = J.S.settings;
    if (k === "examDate" && t.value) s.examDate = t.value;
    else if (k === "rate") s.rate = +t.value;
    else if (k.startsWith("test-")) s.tests[k.slice(5)] = Math.max(0, Math.min(30, +t.value || 0));
    J.save(); render();
  });
  let searchTimer;
  app.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "notes") { J.S.notes[t.dataset.key] = t.value; J.save(); }
    if (t.id === "search") {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        J.go("mod", { ...view.p, q: t.value, page: 0 });
        const s = document.getElementById("search"); s.focus(); s.setSelectionRange(s.value.length, s.value.length);
      }, 250);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (view.name !== "run" || !R || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const it = R.queue[R.pos];
    if (!it) { if (e.key === "Enter") A["end-run"](); return; }
    if (it.s === "learn") { if (e.key === "Enter") { e.preventDefault(); A["learn-next"](); } return; }
    if (!EX) return;
    const n = parseInt(e.key, 10);
    if (EX.mode === "choice") {
      if (!EX.answered && n >= 1 && n <= EX.options.length) A.opt({ i: n - 1 });
      else if (EX.answered && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); A.cont(); }
    } else if (EX.mode === "self") {
      if (!EX.revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); A.reveal(); }
      else if (EX.revealed && n >= 1 && n <= 4) A.grade({ q: n - 1 });
    } else if (EX.mode === "order") {
      if (!EX.answered && e.key === "Enter" && EX.picks.length === 4) { e.preventDefault(); A["order-check"](); }
      else if (!EX.answered && n >= 1 && n <= 4) A.piece({ i: EX.order[n - 1] });
      else if (!EX.answered && e.key === "Backspace") { EX.picks.pop(); render(); }
      else if (EX.answered && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); A.cont(); }
    }
  });
  document.addEventListener("j:saved", () => { const el = document.querySelector(".save"); if (el && view.name !== "run") { const n = document.createElement("div"); n.innerHTML = nav(); const fresh = n.querySelector(".save"); if (fresh) el.replaceWith(fresh); } });

  /* Démarrage */
  J.onAuth(
    () => { R = null; J.go(J.S.onboarded ? "home" : "onboarding"); },
    (e) => {
      const el = document.getElementById("auth-msg");
      if (el) el.textContent = e.message; else alert(e.message);
    }
  );
  (async () => {
    await J.load();
    if (J.S.lesson && J.S.lesson.date !== J.today()) J.S.lesson = null;
    render();
    await J.handleRedirect();
  })();
})();
