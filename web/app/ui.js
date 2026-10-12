/* JLPT Étude — interface (français / anglais ; le japonais reste toujours affiché). */
(function () {
  const J = window.J;
  const { esc, MODS, MOD_ORDER } = J;
  const L = (fr, en) => J.L(fr, en);
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
    document.documentElement.lang = J.lang();
    if (!J.S.onboarded && view.name !== "onboarding" && view.name !== "account") view = { name: "onboarding", p: {} };
    const inRun = view.name === "run";
    let body;
    try { body = VIEWS[view.name](view.p); }
    catch (e) {
      console.error(e);
      body = `<section class="card"><h2>${L("Oups, un problème d’affichage", "Oops, a display problem")}</h2>
        <p class="muted small">${esc(e.message)}</p><p>${L("Ta progression est enregistrée.", "Your progress is saved.")}</p>
        <div class="row"><button class="btn primary" data-act="end-run">${L("Retour à l’accueil", "Back to home")}</button></div></section>`;
    }
    app.innerHTML = (inRun ? "" : nav() + moveBanner()) + `<main class="${inRun ? "run" : ""}">${body}</main>`;
    if (view.name === "run" && R && R.timed) {
      tick = setInterval(() => { const el = document.getElementById("timer"); if (el) el.textContent = fmtClock((Date.now() - R.started) / 1000); }, 1000);
    }
    if (view.name === "account") J.mountGoogle(document.getElementById("g-btn"));
    const f = app.querySelector("[autofocus]");
    if (f) f.focus();
  }
  J.render = render;

  /* ───────── Déménagement vers jlpt.simondepussay.com ───────── */
  const NEW_ORIGIN = "https://jlpt.simondepussay.com";
  // ancienne adresse de production uniquement (pas les prévisualisations « …-1.eastasia… » ni le local)
  const OLD_HOST = location.hostname === "purple-flower-00ac22900.5.azurestaticapps.net";
  const moveBanner = () => {
    if (!OLD_HOST) return "";
    const u = J.user();
    const msg = u
      ? L("JLPT Étude a une nouvelle adresse. Ta progression est enregistrée sur ton compte : reconnecte-toi une fois là-bas et tu la retrouveras.",
          "JLPT Étude has a new address. Your progress is saved to your account: sign in once there and it will be back.")
      : L("JLPT Étude a une nouvelle adresse. Ta progression est enregistrée dans ce navigateur, sur cette adresse uniquement : pour la garder, connecte-toi ici d’abord (elle sera envoyée sur ton compte) ou exporte-la puis importe-la là-bas.",
          "JLPT Étude has a new address. Your progress is stored in this browser, for this address only: to keep it, sign in here first (it will be sent to your account) or export it and import it there.");
    return `<div class="move"><b>${L("Nouvelle adresse", "New address")} : <a href="${NEW_ORIGIN}">jlpt.simondepussay.com</a></b><p>${msg}</p>
      <div class="row">${!u ? `<button class="btn" data-act="nav" data-v="account">${L("Me connecter ici d’abord", "Sign in here first")}</button><button class="btn" data-act="export">${L("Exporter ma progression", "Export my progress")}</button>` : ""}
      <a class="btn primary" href="${NEW_ORIGIN}">${L("Aller sur la nouvelle adresse", "Go to the new address")} →</a></div></div>`;
  };

  const langSwitch = () => `<div class="lang" role="group" aria-label="Langue / Language">
    <button class="${J.lang() === "fr" ? "on" : ""}" data-act="set-lang" data-l="fr">FR</button><button class="${J.lang() === "en" ? "on" : ""}" data-act="set-lang" data-l="en">EN</button></div>`;

  function nav() {
    const tabs = [["home", "今日", L("Aujourd’hui", "Today")], ["mod-v", "語彙", J.modName("v")], ["mod-k", "漢字", J.modName("k")], ["mod-g", "文法", J.modName("g")], ["progress", "進捗", L("Progression", "Progress")], ["settings", "設定", L("Réglages", "Settings")]];
    const cur = view.name === "mod" ? "mod-" + view.p.m : view.name === "item" ? "mod-" + view.p.m : view.name;
    const u = J.user(), bad = J.store.status === "error" || J.store.status === "offline" || J.store.expired;
    const st = u
      ? `<button class="save ${bad ? "err" : "ok"} ${cur === "account" ? "on" : ""}" data-act="nav" data-v="account" title="${esc(J.store.error || L("Progression synchronisée sur ton compte", "Progress synced to your account") + (J.store.lastSave ? " · " + J.store.lastSave.toLocaleTimeString(J.locale()) : ""))}">${bad ? "⚠︎" : '<i class="save-pt" aria-hidden="true"></i>'} ${esc(u.name || u.email || L("Mon compte", "My account"))}</button>`
      : `<button class="save warn ${cur === "account" ? "on" : ""}" data-act="nav" data-v="account" title="${L("Sans compte, la progression reste dans ce navigateur", "Without an account, progress stays in this browser")}">${L("Se connecter", "Sign in")}</button>`;
    return `<header class="top"><div class="brand"><span class="hanko" aria-hidden="true">日本<br>語</span><span class="brand-t">JLPT Étude<b>${J.LEVEL}</b></span></div>
      <nav>${tabs.map(([v, jp, tr]) => `<button class="tab ${cur === v ? "on" : ""}" data-act="nav" data-v="${v}"><span class="jp">${jp}</span><span class="tfr">${tr}</span></button>`).join("")}</nav>${langSwitch()}${st}</header>`;
  }

  const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const dpw = () => L("j/sem", "days/wk");
  const bar = (levels, total) =>
    `<div class="lvbar">${[3, 2, 1].map((l) => `<span class="lv${l}" style="width:${(levels[l] / total) * 100}%"></span>`).join("")}</div>`;

  /* ───────── Vues ───────── */
  const VIEWS = {};

  /* Premier lancement */
  VIEWS.onboarding = () => {
    const s = J.S.settings, sessions = J.jlptSessions(4);
    const plan = J.plan();
    return `<section class="card onboard">
      <h1>ようこそ <small>${L("Bienvenue", "Welcome")}</small></h1>
      <div class="field"><label>${L("Langue de l’interface et des traductions", "Language of the interface and translations")}</label>${langSwitch()}</div>
      <p>${L("Chaque jour, l’appli te prépare une petite leçon : <b>réviser</b> ce qui est dû, <b>apprendre</b> de nouveaux éléments, puis <b>te tester</b>. Ce que tu rates revient à la fin de la leçon.",
        "Every day, the app prepares a short lesson for you: <b>review</b> what is due, <b>learn</b> new items, then <b>test yourself</b>. Whatever you miss comes back at the end of the lesson.")}</p>
      ${settingsCore(s, sessions)}
      <div class="preview">
        <h3>${L("Ton planning de départ", "Your starting plan")}</h3>
        ${planTable(plan, true)}
        <p class="muted">${planNote(plan)}</p>
      </div>
      <p class="muted">${L("Tu connais déjà une partie du N1 ? Pendant les leçons, le bouton <b>« Déjà connu »</b> permet de passer vite ce que tu sais déjà.",
        "Already know part of N1? During lessons, the <b>“Already known”</b> button lets you skip what you already know.")}</p>
      <div class="row"><button class="btn primary big" data-act="finish-onboard">${L("Commencer", "Start")}</button>
      ${J.authReady ? `<button class="link" data-act="nav" data-v="account">${L("J’ai déjà un compte : me connecter", "I already have an account: sign in")}</button>` : ""}</div>
    </section>`;
  };

  function settingsCore(s, sessions) {
    const isCustom = !sessions.includes(s.examDate);
    return `<div class="field"><label>${L("Ma session JLPT", "My JLPT session")} ${J.LEVEL}</label>
        <div class="seg wrap">${sessions.map((d) => `<button class="${s.examDate === d ? "on" : ""}" data-act="set-exam" data-d="${d}">${J.fmtDate(d)}</button>`).join("")}
        <label class="seg-date ${isCustom ? "on" : ""}">${L("Autre date", "Other date")} <input type="date" data-set="examDate" value="${s.examDate}"></label></div></div>
      <div class="field"><label>${L("Jours d’étude prévus par semaine", "Planned study days per week")}</label>
        <div class="seg">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<button class="${s.daysPerWeek === n ? "on" : ""}" data-act="set-dpw" data-n="${n}">${n}</button>`).join("")}</div></div>
      <div class="field"><label>${L("Temps maximum par jour d’étude", "Maximum time per study day")}</label>
        <div class="seg wrap">${[15, 20, 30, 45, 60, 90, 120, 0].map((n) => `<button class="${s.maxMinutes === n ? "on" : ""}" data-act="set-max" data-n="${n}">${n ? fmtMin(n) : L("Sans limite", "No limit")}</button>`).join("")}</div></div>`;
  }

  function planTable(plan, onlyNew) {
    const head = onlyNew ? `<th>${L("Nouveaux / jour", "New / day")}</th><th>${L("Restants", "Remaining")}</th>`
      : `<th>${L("Réviser", "Review")}</th><th>${L("Apprendre", "Learn")}</th><th>${L("Tester", "Test")}</th>`;
    return `<table class="plan"><thead><tr><th></th>${head}</tr></thead><tbody>
      ${MOD_ORDER.map((m) => { const p = plan.mods[m]; return `<tr><th><span class="jp">${MODS[m].jp}</span> ${J.modName(m)}</th>${onlyNew ? `<td>${p.new}${p.new < p.needed ? ` <small class="bad">/ ${p.needed} ${L("nécessaires", "needed")}</small>` : ""}</td><td>${p.remaining}</td>` : `<td>${p.due}</td><td>${p.newLeft}</td><td>${p.test}</td>`}</tr>`; }).join("")}
      </tbody></table>`;
  }
  function planNote(plan) {
    const fw = J.S.settings.finalWeeks;
    if (plan.finalPhase) return L(`Il reste moins de ${fw} semaine(s) avant l’examen : plus de nouveaux éléments, uniquement révisions et tests.`,
      `Less than ${fw} week(s) left before the exam: no more new items, only reviews and tests.`);
    let t = L(`${plan.studyDays} jours d’étude d’ici le ${J.fmtDate(plan.target)} (tu gardes ${fw} semaines de révision finale avant l’examen). Durée estimée d’une leçon : <b>${fmtMin(plan.minutes)}</b>.`,
      `${plan.studyDays} study days until ${J.fmtDate(plan.target)} (you keep ${fw} weeks of final review before the exam). Estimated lesson length: <b>${fmtMin(plan.minutes)}</b>.`);
    if (plan.capped) t += ` <br><span class="bad">${L(`Pour tout voir à temps, il faudrait environ ${fmtMin(plan.fullMinutes)} par jour d’étude : avec ton maximum, tu seras en retard. Augmente le temps ou les jours, ou choisis une session plus tardive.`,
      `To cover everything in time you would need about ${fmtMin(plan.fullMinutes)} per study day: with your maximum, you will fall behind. Increase the time or the days, or pick a later session.`)}</span>`;
    return t;
  }

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
  /* Retour visuel d’une action faite : un 判子 s’imprime près du bouton,
     légèrement de travers et jamais au même endroit — comme un vrai cachet. */
  /* L’envoi au nuage est silencieux : un battement du point le rend visible,
     sans rien interrompre. L’événement est émis par J.save après chaque envoi. */
  document.addEventListener("j:saved", () => {
    if (J.store.status !== "ok") return;
    const pt = document.querySelector("header .save .save-pt");
    if (!pt) return;
    pt.classList.remove("bat");
    void pt.offsetWidth;
    pt.classList.add("bat");
  });

  function tampon(el, txt) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    const s = document.createElement("span");
    s.className = "tampon";
    s.textContent = txt;
    s.style.setProperty("--r", (Math.random() * 26 - 13).toFixed(1) + "deg");
    s.style.left = Math.round(r.right - 10) + "px";
    s.style.top = Math.round(r.top + r.height / 2 - 22 + (Math.random() * 10 - 5)) + "px";
    document.body.appendChild(s);
    s.addEventListener("animationend", () => s.remove());
    setTimeout(() => s.remove(), 2500);
  }

  const stamp = (txt, seed, cls = "") => `<span class="stamp ${cls}" style="--r:${rot(seed)}deg">${txt}</span>`;
  const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

  /* Accueil */
  VIEWS.home = () => {
    const plan = J.plan(), proj = J.projection(), warn = J.paceWarning();
    const Ls = J.S.lesson && J.S.lesson.date === J.today() ? J.S.lesson : null;
    const done = Ls && Ls.pos >= Ls.queue.length;
    if (done && !J.day().done) { J.day().done = true; if (Ls.mult === 2) J.day().double = true; J.save(); }
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
        ${enso(1, `<b>${Math.round(J.day().sec / 60)}</b><span>分</span>`)}
        <div class="lesson-body"><h2 class="hand">おつかれさま！<small>${L("Leçon du jour terminée", "Today’s lesson done")}</small></h2>
          <p>${L(`${Ls.ok} bonnes réponses · ${Ls.ko} erreurs.`, `${Ls.ok} correct · ${Ls.ko} mistakes.`)}</p>
          <p class="muted">${L("Demain : environ", "Tomorrow: about")} ${J.MOD_ORDER.reduce((a, m) => a + J.dueList(m, J.addDays(J.today(), 1)).length, 0)} ${L("révisions prévues.", "reviews planned.")}</p>
          <div class="row">${(Ls.mult || 1) === 1 ? `<button class="btn primary" data-act="lesson-double"><span class="jp">倍</span> ${L("Doubler la journée", "Make it a double day")}</button>` : ""}<button class="btn" data-act="exam-start">${L("Petit test", "Quick test")}</button><button class="btn" data-act="nav" data-v="mod-g">${L("Revoir la grammaire", "Review grammar")}</button></div></div>
        ${Ls.mult === 2 ? stamp("倍", J.today(), "big gold") : stamp("済", J.today(), "big")}</div>`;
    } else if (Ls) {
      const left = Ls.queue.slice(Ls.pos).filter((i) => !i.skip);
      const cnt = (s) => left.filter((i) => i.s === s).length;
      sheet = `<div class="sheet lesson">
        <div class="sheet-side">今日の勉強</div>
        ${enso(Ls.pos / Ls.queue.length, `<b>${pct(Ls.pos, Ls.queue.length)}</b><span>%</span>`)}
        <div class="lesson-body"><h2 class="hand">つづき${Ls.mult === 2 ? ` <span class="badge-x2">×2</span>` : ""}<small>${L("Leçon en cours", "Lesson in progress")}${Ls.mult === 2 ? " · " + L("double journée", "double day") : ""}</small></h2>
          <ol class="timetable">${ttRow("復習", L("Réviser", "Review"), cnt("rev"))}${ttRow("新出", L("Apprendre", "Learn"), cnt("learn"))}${ttRow("小テスト", L("Tester", "Test"), cnt("test"))}${ttRow("やり直し", L("Rattrapage", "Retry"), cnt("fix"))}</ol>
          <button class="btn primary big" data-act="lesson-start" autofocus>${L("Reprendre", "Resume")} <span class="jp">→</span></button></div></div>`;
    } else {
      const sum = (k) => MOD_ORDER.reduce((a, m) => a + plan.mods[m][k], 0);
      const total = sum("due") + sum("newLeft") + sum("test");
      sheet = `<div class="sheet lesson">
        <div class="sheet-side">今日の勉強</div>
        ${enso(Math.min(1, plan.minutes / Math.max(15, J.S.settings.maxMinutes || 60)), `<b>${plan.minutes}</b><span>分</span>`)}
        <div class="lesson-body"><h2 class="hand">今日のレッスン<small>${L("Leçon du jour · environ", "Today’s lesson · about")} ${fmtMin(plan.minutes)}</small></h2>
          <ol class="timetable">
            ${ttRow("復習", L("Réviser", "Review"), sum("due"), MOD_ORDER.map((m) => plan.mods[m].due))}
            ${ttRow("新出", L("Apprendre", "Learn"), sum("newLeft"), MOD_ORDER.map((m) => plan.mods[m].newLeft))}
            ${ttRow("小テスト", L("Tester", "Test"), sum("test"), MOD_ORDER.map((m) => plan.mods[m].test))}
          </ol>
          <div class="dose"><span class="dose-l">${L("Dose du jour", "Today’s dose")}</span><div class="seg">
            <button class="${plan.mult === 1 ? "on" : ""}" data-act="set-mult" data-n="1">${L("Normale", "Normal")}</button>
            <button class="${plan.mult === 2 ? "on" : ""}" data-act="set-mult" data-n="2"><span class="jp">倍</span> ${L("Double", "Double")} ×2</button></div></div>
          ${total ? `<button class="btn primary big" data-act="lesson-start" autofocus>はじめる <span>${L("Commencer", "Start")}</span></button>`
            : `<p>${L("Rien de prévu aujourd’hui.", "Nothing planned today.")}</p><button class="btn" data-act="exam-start">${L("Petit test", "Quick test")}</button>`}
          ${plan.mult === 2 ? `<p class="muted small">${L(`Double journée : deux leçons d’affilée, environ ${fmtMin(plan.minutes)}.`, `Double day: two lessons in a row, about ${fmtMin(plan.minutes)}.`)}</p>`
            : plan.capped ? `<p class="muted small">${L(`Limitée à ${fmtMin(J.S.settings.maxMinutes)} (ton réglage).`, `Limited to ${fmtMin(J.S.settings.maxMinutes)} (your setting).`)}</p>` : ""}</div></div>`;
    }
    return `<section class="hero">${himekuri}${sheet}</section>
      ${warn ? `<div class="sheet alert"><div class="alert-mark">!</div><div><b>${L("Ton rythme réel est différent de ton planning.", "Your actual pace differs from your plan.")}</b>
        <p>${L(`Tu as prévu <b>${warn.planned} jours</b> d’étude par semaine, mais sur les dernières semaines tu en fais en moyenne <b>${J.num(warn.measured)}</b>. Les leçons sont calculées pour ${warn.planned} jours : en étudiant moins souvent, tu prends du retard.`,
          `You planned <b>${warn.planned} study days</b> a week, but over the last weeks you averaged <b>${J.num(warn.measured)}</b>. Lessons are sized for ${warn.planned} days: studying less often puts you behind.`)}</p>
        <div class="row"><button class="btn primary" data-act="pace-adapt" data-n="${warn.suggest}">${L(`Adapter les leçons à ${warn.suggest} ${dpw()}`, `Adapt lessons to ${warn.suggest} ${dpw()}`)}</button><button class="btn" data-act="pace-keep">${L(`Je garde ${warn.planned} ${dpw()}`, `Keep ${warn.planned} ${dpw()}`)}</button></div></div></div>` : ""}
      <section class="tickets">${MOD_ORDER.map((m) => modSummary(m, plan, proj)).join("")}</section>
      ${weekStrip()}`;
  };
  // Ligne d’emploi du temps : total + détail par module
  const ttRow = (jp, tr, n, per) => `<li class="${n ? "" : "off"}"><span class="tt-jp">${jp}</span><span class="tt-fr">${tr}</span>
    ${per ? `<span class="tt-per">${per.map((x, i) => (x ? `<i class="m-${MOD_ORDER[i]}">${MODS[MOD_ORDER[i]].jp[0]}${x}</i>` : "")).join("")}</span>` : ""}<b>${n}</b></li>`;

  const KANJI_MARK = { v: "語", k: "漢", g: "文" };
  function modSummary(m, plan, proj) {
    const p = plan.mods[m], pr = proj[m];
    let st;
    if (p.remaining === 0) st = stamp("完了", m + "done", "ok") + `<span class="st-fr">${L("Tout vu", "All seen")}</span>`;
    else if (!pr.finish) st = stamp("未着手", m, "grey") + `<span class="st-fr">${L("Pas commencé", "Not started")}</span>`;
    else if (pr.onTime) st = stamp("順調", m, "ok") + `<span class="st-fr">${L("Dans les temps", "On track")}</span>`;
    else st = stamp("遅れ", m) + `<span class="st-fr">${L(`Retard ≈ ${Math.ceil(pr.late / 7)} sem.`, `≈ ${Math.ceil(pr.late / 7)} wk behind`)}</span>`;
    return `<button class="ticket t-${m}" data-act="nav" data-v="mod-${m}">
      <span class="t-stub"><span class="t-kanji">${KANJI_MARK[m]}</span><span class="t-no">No.${m === "v" ? "01" : m === "k" ? "02" : "03"}</span></span>
      <span class="t-body">
        <span class="t-head"><span class="jp t-jp">${MODS[m].jp}</span><span class="t-fr">${J.modName(m)}</span></span>
        ${bar(p.levels, p.total)}
        <span class="t-n"><b>${p.learned}</b><small>/ ${p.total} ${J.modUnit(m)}</small></span>
        <span class="t-meta">${p.levels[3]} ${L("maîtrisés", "mastered")}${pr.finish ? ` · ${L("fin prévue", "expected end")} ${J.fmtShort(pr.finish)}` : ""}</span>
        <span class="t-status">${st}</span>
      </span></button>`;
  }

  function weekStrip() {
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(J.addDays(J.today(), -i));
    const streak = J.streak();
    return `<section class="stampcard">
      <div class="sc-head"><h3 class="hand">がんばりカード</h3><span class="muted small">${L("Carte de tampons", "Stamp card")} · ${L("prévu", "planned")} ${J.S.settings.daysPerWeek} ${dpw()} · ${L("réel", "actual")} ${J.measuredDPW() === null ? "—" : J.num(J.measuredDPW())}</span>
        <span class="sc-streak"><b>${streak}</b>日連続</span></div>
      <div class="sc-grid">${days.map((d) => {
        const x = J.S.days[d], min = x ? Math.round(x.sec / 60) : 0, today = d === J.today();
        return `<div class="sc-cell ${today ? "today" : ""}"><span class="sc-wd">${WEEKDAY[J.parse(d).getDay()]}<small>${J.parse(d).getDate()}</small></span>
          <span class="sc-slot">${x && x.done ? (x.double ? stamp("倍", d, "gold") : stamp("済", d)) : J.studied(d) ? stamp("途中", d, "grey") : ""}</span><span class="sc-min">${min ? min + " min" : ""}</span></div>`;
      }).join("")}</div></section>`;
  }

  /* Pages module */
  VIEWS.mod = ({ m, f = "all", q = "", page = 0 }) => {
    const c = J.counts(m), acc = J.accuracy(m);
    const head = `<section class="mod-head"><div><h1><span class="jp">${MODS[m].jp}</span> ${J.modName(m)} <small>${J.LEVEL}</small></h1>
      ${bar(c.levels, c.total)}
      <div class="legend">${J.LEVELS.map((l, i) => `<span><i class="lv${i}"></i>${l} ${c.levels[i]}</span>`).join("")}${acc !== null ? `<span>${L("Réussite", "Accuracy")} ${Math.round(acc * 100)} %</span>` : ""}</div></div>
      <div class="row"><button class="btn primary" data-act="practice" data-m="${m}">${L("S’entraîner", "Practice")}</button><button class="btn" data-act="mod-test" data-m="${m}">${L("Test JLPT", "JLPT test")} · ${J.modName(m).toLowerCase()}</button>
      ${m === "g" ? `<a class="btn" href="Fiches-grammaire-N1.html?lang=${J.lang()}" target="_blank">${L("Fiches imprimables", "Printable sheets")}</a>` : ""}</div></section>`;
    const filters = [["all", L("Tous", "All")], ["0", L("Nouveaux", "New")], ["1", L("En cours", "Learning")], ["2", L("Acquis", "Known")], ["3", L("Maîtrisés", "Mastered")], ["weak", L("Points faibles", "Weak spots")], ["due", L("À réviser", "Due")]]
      .concat(m !== "g" ? [["out", L("Retirés", "Removed")]] : []);
    let list = J.items[m];
    if (f === "out") list = J.all[m].filter((x) => J.isExcluded(m, x.id));
    else if (f === "weak") list = J.weak(m, 300);
    else if (f === "due") { const d = new Set(J.dueList(m)); list = list.filter((x) => d.has(x.id)); }
    else if (f !== "all") list = list.filter((x) => J.levelOf(m, x.id) === +f);
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter((x) => (m === "v" ? x.w + x.r + x.m + J.mean("v", x) : m === "k" ? x.k + x.on.join() + x.kun.join() + x.m + J.mean("k", x) : x.p + J.gs(x, "s") + x.f).toLowerCase().includes(ql));
    }
    const ctrl = `<div class="filters"><input id="search" data-m="${m}" placeholder="${L("Rechercher…", "Search…")}" value="${esc(q)}">
      <div class="seg wrap">${filters.map(([k, l]) => `<button class="${f === k ? "on" : ""}" data-act="filter" data-m="${m}" data-f="${k}">${l}</button>`).join("")}</div></div>`;
    let body = "";
    if (m === "g") {
      body = J.gcats.map((cat) => {
        const pts = list.filter((x) => x.cat === cat.id);
        if (!pts.length) return "";
        return `<h3 class="cat"><span class="jp">${esc(cat.jp)}</span> · ${esc(J.gcat(cat))}</h3><div class="glist">${pts.map((g) =>
          `<button class="gitem" data-act="open-item" data-m="g" data-id="${g.id}"><i class="dot lv${J.levelOf("g", g.id)}"></i><span class="num">${g.n}</span><span class="jp">${esc(g.p)}</span><span class="muted">${esc(J.gs(g, "s"))}</span></button>`).join("")}</div>`;
      }).join("");
    } else {
      const per = m === "k" ? 240 : 120, pages = Math.max(1, Math.ceil(list.length / per)), pg = Math.min(page, pages - 1);
      const slice = list.slice(pg * per, pg * per + per);
      body = m === "k"
        ? `<div class="kgrid">${slice.map((k) => `<button class="ktile lv${J.levelOf("k", k.id)} jp" data-act="open-item" data-m="k" data-id="${esc(k.id)}" title="${esc(J.mean("k", k))}">${esc(k.k)}</button>`).join("")}</div>`
        : `<div class="vlist">${slice.map((v) => `<button class="vrow" data-act="open-item" data-m="v" data-id="${esc(v.id)}"><i class="dot lv${J.levelOf("v", v.id)}"></i><span class="jp w">${esc(v.w)}</span><span class="jp r">${esc(v.r)}</span><span class="mm">${esc(J.shortMeaning(J.mean("v", v)))}</span></button>`).join("")}</div>`;
      if (pages > 1) body += `<div class="pager">${pg > 0 ? `<button class="btn" data-act="page" data-m="${m}" data-pg="${pg - 1}">← ${L("Précédent", "Previous")}</button>` : ""}<span>Page ${pg + 1} / ${pages} · ${list.length} ${L("éléments", "items")}</span>${pg < pages - 1 ? `<button class="btn" data-act="page" data-m="${m}" data-pg="${pg + 1}">${L("Suivant", "Next")} →</button>` : ""}</div>`;
    }
    return head + ctrl + (body || `<p class="muted">${L("Aucun élément.", "No items.")}</p>`);
  };

  /* Fiche d’un élément */
  VIEWS.item = ({ m, id }) => {
    const r = J.rec(m, id), lv = J.levelOf(m, id);
    const list = J.all[m], idx = list.findIndex((x) => x.id === id);
    const prev = list[idx - 1], next = list[idx + 1];
    const stat = r && r.at ? `<div class="stat-line"><span class="pill lv${lv}">${J.LEVELS[lv]}</span><span>${L("Appris le", "Learned on")} ${J.fmtShort(r.at)}</span><span>${L("Prochaine révision", "Next review")} : ${r.due ? J.fmtShort(r.due) : "—"}</span><span>✓ ${r.ok} · ✗ ${r.ko}</span></div>`
      : `<div class="stat-line"><span class="pill">${J.LEVELS[0]}</span><button class="btn sm" data-act="known" data-m="${m}" data-id="${esc(id)}">${L("Je le connais déjà", "I already know it")}</button></div>`;
    const out = J.isExcluded(m, id);
    const body = (m === "g" ? J.grammarLesson(J.byId.g[id], false) : `<div class="card">${J.learnCard(m, id)}</div>`)
      + (m !== "g" ? `<div class="row">${out ? `<span class="pill bad">${L("Retiré des leçons", "Removed from lessons")}</span><button class="btn sm" data-act="exclude" data-m="${m}" data-id="${esc(id)}" data-on="0">${L("Remettre dans le N1", "Put back into N1")}</button>`
        : `<button class="link" data-act="exclude" data-m="${m}" data-id="${esc(id)}" data-on="1">${L("Pas du N1 : retirer des leçons", "Not N1: remove from lessons")}</button>`}</div>` : "");
    return `<div class="item-nav"><button class="link" data-act="nav" data-v="mod-${m}">← ${J.modName(m)}</button>
      <span>${prev ? `<button class="btn sm" data-act="open-item" data-m="${m}" data-id="${esc(prev.id)}">←</button>` : ""}
      ${next ? `<button class="btn sm" data-act="open-item" data-m="${m}" data-id="${esc(next.id)}">→</button>` : ""}</span></div>
      ${stat}${body}
      ${m === "g" ? `<div class="row"><button class="btn primary" data-act="drill" data-m="g" data-id="${id}">${L("M’entraîner sur ce point (5 questions)", "Practice this point (5 questions)")}</button></div>` : ""}`;
  };

  /* Choix d’entraînement */
  VIEWS.practice = ({ m }) => {
    const c = J.counts(m);
    return `<section class="card"><h1>${L("S’entraîner", "Practice")} · <span class="jp">${MODS[m].jp}</span> ${J.modName(m)}</h1>
      <p class="muted">${L("L’entraînement libre ne modifie pas ton planning ; il enregistre seulement tes réussites et tes erreurs.", "Free practice does not change your schedule; it only records your correct answers and mistakes.")}</p>
      <div class="field"><label>${L("Sur quels éléments ?", "Which items?")}</label><div class="seg wrap" id="p-src">
        <button class="on" data-act="pseg" data-g="src" data-v="learned">${L("Déjà vus", "Already seen")} (${c.learned})</button>
        <button data-act="pseg" data-g="src" data-v="weak">${L("Points faibles", "Weak spots")} (${J.weak(m, 999).length})</button>
        <button data-act="pseg" data-g="src" data-v="all">${L("Tous", "All")} (${c.total})</button></div></div>
      <div class="field"><label>${L("Nombre de questions", "Number of questions")}</label><div class="seg" id="p-n">
        ${[10, 20, 30, 50].map((n, i) => `<button class="${i === 0 ? "on" : ""}" data-act="pseg" data-g="n" data-v="${n}">${n}</button>`).join("")}</div></div>
      <button class="btn primary big" data-act="practice-go" data-m="${m}">${L("Démarrer", "Start")}</button></section>`;
  };

  /* Progression */
  VIEWS.progress = () => {
    const plan = J.plan(), proj = J.projection();
    const mdpw = J.measuredDPW();
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(J.addDays(J.today(), -i));
    const maxSec = Math.max(60, ...days.map((d) => (J.S.days[d] ? J.S.days[d].sec : 0)));
    let totalSec = 0; for (const d in J.S.days) totalSec += J.S.days[d].sec;
    return `<h1>進捗 · ${L("Progression", "Progress")}</h1>
      <div class="kpis">
        <div class="kpi"><b>${J.streak()}</b><span>${L("jours d’affilée", "day streak")}</span></div>
        <div class="kpi"><b>${fmtMin(Math.round(totalSec / 60))}</b><span>${L("temps total", "total time")}</span></div>
        <div class="kpi"><b>${J.S.settings.daysPerWeek}</b><span>${L("j/sem prévus", "planned days/wk")}</span></div>
        <div class="kpi"><b>${mdpw === null ? "—" : J.num(mdpw)}</b><span>${L("j/sem réels (4 sem.)", "actual days/wk (4 wk)")}</span></div>
        <div class="kpi"><b>J-${Math.max(0, plan.examIn)}</b><span>${L("avant le JLPT", "until the JLPT")}</span></div>
      </div>
      <div class="card"><h3>${L("Suis-je dans les temps ?", "Am I on track?")}</h3>
        <table class="plan"><thead><tr><th></th><th>${L("Vus", "Seen")}</th><th>${L("Maîtrisés", "Mastered")}</th><th>${L("Réussite", "Accuracy")}</th><th>${L("Rythme", "Pace")}</th><th>${L("Fin prévue", "Expected end")}</th><th>${L("Objectif", "Target")}</th></tr></thead><tbody>
        ${MOD_ORDER.map((m) => { const p = plan.mods[m], pr = proj[m], acc = J.accuracy(m);
          return `<tr><th><span class="jp">${MODS[m].jp}</span> ${J.modName(m)}</th><td>${p.learned}/${p.total}</td><td>${p.levels[3]}</td><td>${acc === null ? "—" : Math.round(acc * 100) + " %"}</td>
          <td>${J.num(pr.perStudyDay)}/${L("jour", "day")}</td><td class="${pr.onTime ? "good" : "bad"}">${pr.finish ? J.fmtShort(pr.finish) : "—"}</td><td>${J.fmtShort(plan.target)}</td></tr>`; }).join("")}
        </tbody></table>
        <p class="muted small">${L(`L’objectif est de tout avoir vu ${J.S.settings.finalWeeks} semaines avant l’examen (${J.fmtDate(J.S.settings.examDate)}), pour garder du temps pour la révision finale. La projection utilise ton rythme réel dès que tu as assez de jours de données.`,
          `The target is to have seen everything ${J.S.settings.finalWeeks} weeks before the exam (${J.fmtDate(J.S.settings.examDate)}), to keep time for final review. The projection uses your actual pace once there are enough days of data.`)}</p>
        <p class="small">${planNote(plan)}</p></div>
      <div class="card"><h3>${L("Temps d’étude, 14 derniers jours", "Study time, last 14 days")}</h3><div class="bars">${days.map((d) => { const s = J.S.days[d] ? J.S.days[d].sec : 0;
          return `<div class="b" title="${J.fmtShort(d)} : ${Math.round(s / 60)} min"><span style="height:${(s / maxSec) * 100}%"></span><i>${J.parse(d).getDate()}</i></div>`; }).join("")}</div>
        <p class="muted small">${L(`Temps moyen mesuré : vocabulaire ${Math.round(J.S.timing.v.learn)} s par nouveau mot · kanji ${Math.round(J.S.timing.k.learn)} s · grammaire ${fmtMin(Math.round(J.S.timing.g.learn / 60))} par nouveau point. Ces valeurs s’ajustent toutes seules et servent à estimer la durée des leçons.`,
          `Measured average time: vocabulary ${Math.round(J.S.timing.v.learn)} s per new word · kanji ${Math.round(J.S.timing.k.learn)} s · grammar ${fmtMin(Math.round(J.S.timing.g.learn / 60))} per new point. These values adjust automatically and are used to estimate lesson length.`)}</p></div>
      <div class="card"><h3>${L("Calendrier", "Calendar")}</h3>${heatmap()}</div>
      <div class="grid3">${MOD_ORDER.map((m) => { const w = J.weak(m, 8);
        return `<div class="card"><h3>${L("Points faibles", "Weak spots")} · ${J.modName(m)}</h3>${w.length ? w.map((x) => `<button class="weak" data-act="open-item" data-m="${m}" data-id="${esc(x.id)}"><span class="jp">${esc(m === "v" ? x.w : m === "k" ? x.k : x.p)}</span><span class="muted">✗ ${J.rec(m, x.id).ko}</span></button>`).join("") : `<p class="muted">${L("Aucun pour l’instant.", "None yet.")}</p>`}</div>`; }).join("")}</div>
      <div class="row"><button class="btn primary" data-act="exam-start">${L("Petit test (30 questions)", "Quick test (30 questions)")}</button></div>`;
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
    return `<div class="heat">${cells.join("")}</div><div class="heat-legend">${L("Moins", "Less")} <i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i> ${L("Plus", "More")}</div>`;
  }

  /* Réglages */
  VIEWS.settings = () => {
    const s = J.S.settings;
    const u = J.user();
    const st = u
      ? `<p>${L("Ta progression est synchronisée sur ton compte", "Your progress is synced to your account")} <b>${esc(u.email || u.name || "")}</b>.${J.store.lastSave ? ` ${L("Dernière synchronisation", "Last sync")} : ${J.store.lastSave.toLocaleTimeString(J.locale())}.` : ""}</p>${J.store.error ? `<p class="bad">${esc(J.store.error)}</p>` : ""}`
      : `<p class="bad">${L("Tu n’es pas connecté : ta progression est gardée dans ce navigateur seulement.", "You are not signed in: your progress is only kept in this browser.")} <button class="link" data-act="nav" data-v="account">${L("Se connecter", "Sign in")}</button></p>`;
    return `<h1>設定 · ${L("Réglages", "Settings")}</h1>
      <section class="card">
        <div class="field"><label>${L("Langue de l’interface et des traductions", "Language of the interface and translations")}</label>${langSwitch()}</div>
        ${settingsCore(s, J.jlptSessions(4))}
        <div class="field"><label>${L("Semaines de révision finale avant l’examen (sans nouveaux éléments)", "Weeks of final review before the exam (no new items)")}</label>
          <div class="seg">${[0, 1, 2, 3, 4].map((n) => `<button class="${s.finalWeeks === n ? "on" : ""}" data-act="set-final" data-n="${n}">${n}</button>`).join("")}</div></div>
        <div class="field"><label>${L("Questions de test par leçon", "Test questions per lesson")}</label><div class="row">${MOD_ORDER.map((m) => `<label class="num">${J.modName(m)} <input type="number" min="0" max="30" data-set="test-${m}" value="${s.tests[m]}"></label>`).join("")}</div></div>
        <div class="field"><label>${L("Vitesse de la voix japonaise", "Japanese voice speed")}</label><input type="range" min="0.6" max="1.2" step="0.05" data-set="rate" value="${s.rate}"></div>
        <div class="preview"><h3>${L("Effet sur ton planning", "Effect on your plan")}</h3>${planTable(J.plan(), true)}<p class="muted">${planNote(J.plan())}</p></div>
        <div class="field"><label>${L("Leçon du jour", "Today’s lesson")}</label>
          <button class="btn" data-act="rebuild-lesson">${L("Reconstruire la leçon du jour", "Rebuild today’s lesson")}</button>
          <p class="muted small">${L("La leçon du jour est fabriquée une fois, au premier démarrage. Si tu changes ta date d’examen après coup, elle ne bouge pas avant demain : ce bouton la refait tout de suite. Ce que tu as déjà appris est conservé.",
            "Today’s lesson is built once, the first time you start it. If you change your exam date afterwards, it stays as it is until tomorrow: this button rebuilds it now. What you have already learnt is kept.")}</p></div>
      </section>
      <section class="card"><h3>${L("Sauvegarde", "Backup")}</h3>${st}
        <div class="row"><button class="btn" data-act="export">${L("Exporter une copie (.json)", "Export a copy (.json)")}</button>
        <button class="btn" data-act="import">${L("Importer une sauvegarde", "Import a backup")}</button><input type="file" id="importFile" accept=".json,application/json" hidden></div>
        <p class="muted small">${L("L’export est une copie de secours ; il peut être réimporté sur n’importe quel appareil.", "The export is a safety copy; it can be imported again on any device.")}</p></section>
      <section class="card danger"><h3>${L("Zone sensible", "Danger zone")}</h3><button class="btn" data-act="reset">${L("Tout réinitialiser…", "Reset everything…")}</button></section>`;
  };

  /* Compte */
  const PROV = { google: "Google", apple: "Apple", microsoft: "Microsoft" };
  VIEWS.account = () => {
    const u = J.user();
    if (u) {
      const status = J.store.expired
        ? `<p class="bad">${L("Ta session a expiré. Reconnecte-toi pour reprendre la synchronisation (rien n’est perdu, tout est gardé dans ce navigateur).", "Your session has expired. Sign in again to resume syncing (nothing is lost, everything is kept in this browser).")}</p><button class="btn primary" data-act="relogin">${L("Se reconnecter", "Sign in again")}</button>`
        : J.store.error ? `<p class="bad">${esc(J.store.error)}</p>`
        : `<p class="good">● ${L("Progression synchronisée", "Progress synced")}${J.store.lastSave ? ` (${L("dernière fois à", "last at")} ${J.store.lastSave.toLocaleTimeString(J.locale())})` : ""}.</p>`;
      return `<h1>アカウント · ${L("Mon compte", "My account")}</h1>
        <section class="card"><div class="acct"><div class="avatar">${esc((u.name || u.email || "?")[0].toUpperCase())}</div>
          <div><b>${esc(u.name || "")}</b><div class="muted">${esc(u.email || "")} · ${L("connexion", "signed in with")} ${esc(PROV[u.provider] || u.provider)}</div></div></div>
          ${status}
          <div class="row"><button class="btn" data-act="sync-now">${L("Synchroniser maintenant", "Sync now")}</button><button class="btn" data-act="logout">${L("Se déconnecter", "Sign out")}</button></div>
          <p class="muted small">${L("Sur un ordinateur partagé, déconnecte-toi : la progression est alors effacée de ce navigateur (elle reste sur ton compte).", "On a shared computer, sign out: your progress is then removed from this browser (it stays on your account).")}</p></section>
        <section class="card danger"><h3>${L("Supprimer mon compte", "Delete my account")}</h3><p class="muted">${L("Efface définitivement ton compte et toute ta progression enregistrée en ligne.", "Permanently deletes your account and all progress saved online.")}</p>
          <button class="btn" data-act="delete-account">${L("Supprimer mon compte…", "Delete my account…")}</button></section>`;
    }
    const P = Object.fromEntries(J.providers.map((p) => [p.id, p.enabled]));
    return `<h1>アカウント · ${L("Se connecter", "Sign in")}</h1>
      <section class="card login">
        <p>${L("Connecte-toi pour retrouver ta progression sur tous tes appareils (et plus tard dans l’appli iPhone). Sans compte, elle reste uniquement dans ce navigateur.", "Sign in to keep your progress on all your devices (and later in the iPhone app). Without an account, it only stays in this browser.")}</p>
        ${J.authReady ? `<div class="auth-btns">
          ${P.google ? `<div id="g-btn" class="g-btn"></div>` : ""}
          ${P.apple ? `<button class="btn auth apple" data-act="login-apple"><span aria-hidden="true"></span> ${L("Continuer avec Apple", "Continue with Apple")}</button>` : ""}
          ${P.microsoft ? `<button class="btn auth ms" data-act="login-ms"><span class="ms-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span> ${L("Continuer avec Microsoft", "Continue with Microsoft")}</button>` : ""}
        </div>` : `<p class="bad">${L("La connexion n’est pas encore activée sur ce site.", "Sign-in is not enabled on this site yet.")}</p>`}
        <div id="auth-msg" class="bad"></div>
        <p class="muted small">${L("Ce que tu as déjà fait ici sans compte sera ajouté à ton compte. Aucun mot de passe n’est stocké par JLPT Étude.", "What you have already done here without an account will be added to your account. JLPT Étude never stores passwords.")}</p>
      </section>`;
  };

  /* ───────── Session (leçon / entraînement) ───────── */
  // Nouveaux éléments : fiches par petits paquets, puis vérification immédiate
  function newPart(plan, skip, count = (m) => plan.mods[m].newLeft) {
    const q = [], ids = {};
    for (const m of MOD_ORDER) {
      const list = J.items[m].filter((x) => !J.isLearned(m, x.id) && !skip.has(m + ":" + x.id)).slice(0, count(m)).map((x) => x.id);
      ids[m] = new Set(list);
      const size = m === "g" ? 2 : 5;
      for (let i = 0; i < list.length; i += size) {
        const chunk = list.slice(i, i + size);
        chunk.forEach((id) => q.push({ s: "learn", m, id }));
        J.shuffle(chunk).forEach((id) => q.push({ s: "check", m, id }));
      }
    }
    return { q, ids };
  }
  // Tests : moitié points faibles, moitié au hasard parmi ce qui est déjà vu
  function testPart(plan, exclude, count) {
    const q = [];
    for (const m of MOD_ORDER) {
      const pool = J.items[m].filter((x) => J.isLearned(m, x.id) && !exclude.has(m + ":" + x.id));
      const weak = J.shuffle(J.weak(m, 50).filter((x) => J.isLearned(m, x.id) && !exclude.has(m + ":" + x.id)));
      const n = Math.min(count(m), pool.length);
      const chosen = new Set(weak.slice(0, Math.ceil(n / 2)).map((x) => x.id));
      for (const x of J.shuffle(pool)) { if (chosen.size >= n) break; chosen.add(x.id); }
      [...chosen].forEach((id) => q.push({ s: "test", m, id }));
    }
    return q;
  }
  function buildLesson() {
    const plan = J.plan(), q = [];
    for (const m of MOD_ORDER) J.shuffle(J.dueList(m).slice(0, J.S.settings.revCap)).forEach((id) => q.push({ s: "rev", m, id }));
    const np = newPart(plan, new Set());
    q.push(...np.q);
    const fresh = new Set(MOD_ORDER.flatMap((m) => [...np.ids[m]].map((id) => m + ":" + id)));
    q.push(...testPart(plan, fresh, (m) => plan.mods[m].test));
    // dose de base mémorisée : une « double journée » refait exactement la même quantité
    const base = Object.fromEntries(MOD_ORDER.map((m) => [m, { n: np.ids[m].size, t: q.filter((i) => i.s === "test" && i.m === m).length }]));
    return { date: J.today(), queue: q, pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now(), mult: plan.mult, base };
  }
  // Doubler une journée déjà commencée ou terminée : ajoute une seconde dose à la suite
  function extendLesson() {
    const L0 = J.S.lesson;
    const plan = J.plan();
    const base = L0.base || Object.fromEntries(MOD_ORDER.map((m) => [m, { n: plan.mods[m].new, t: plan.mods[m].test }]));
    J.setTodayMult(2);
    const inQueue = new Set(L0.queue.map((i) => i.m + ":" + i.id));
    const np = newPart(plan, inQueue, (m) => base[m].n);
    const fresh = MOD_ORDER.flatMap((m) => [...np.ids[m]].map((id) => m + ":" + id));
    const tests = testPart(plan, new Set([...inQueue, ...fresh]), (m) => base[m].t);
    L0.queue.push(...np.q, ...tests);
    L0.mult = 2;
    J.save();
  }


  // Titres de session : japonais fixe + traduction selon la langue
  const TITLES = { lesson: "今日のレッスン", practice: "練習", test: "テスト", quick: "ミニテスト" };
  function runTitle() {
    if (R.type === "lesson") return TITLES.lesson + (R.mult === 2 ? " ×2" : "");
    if (R.kind === "quick") return `${TITLES.quick} · ${L("Petit test", "Quick test")}`;
    if (R.kind === "drill") return `${TITLES.practice} · ${J.byId.g[R.ref].p}`;
    return `${R.kind === "test" ? TITLES.test : TITLES.practice} · ${J.modName(R.ref)}`;
  }

  function startLesson() {
    if (!J.S.lesson || J.S.lesson.date !== J.today()) { J.S.lesson = buildLesson(); J.save(); }
    R = J.S.lesson; R.type = "lesson"; R.timed = false;
    if (!R.mult) R.mult = J.todayMult();
    EX = null;
    J.go("run");
  }
  function startPractice(m, src, n, testOnly) {
    let pool;
    if (src === "weak") pool = J.weak(m, 999);
    else if (src === "all") pool = J.items[m];
    else pool = J.items[m].filter((x) => J.isLearned(m, x.id));
    if (!pool.length) pool = J.items[m].slice(0, 60);
    const ids = J.shuffle(pool).slice(0, n).map((x) => x.id);
    R = { type: "practice", kind: testOnly ? "test" : "practice", ref: m, queue: ids.map((id) => ({ s: testOnly ? "test" : "rev", m, id, free: true })), pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now(), timed: !!testOnly };
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
    R = { type: "practice", kind: "quick", queue: q, pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now(), timed: true, noFix: true };
    EX = null;
    J.go("run");
  }

  const STAGE = () => ({ rev: L("Réviser", "Review"), learn: L("Apprendre", "Learn"), check: L("Vérifier", "Check"), test: L("Tester", "Test"), fix: L("Rattrapage", "Retry") });

  VIEWS.run = () => {
    if (!R) return VIEWS.home();
    while (R.pos < R.queue.length && (R.queue[R.pos].skip || !J.byId[R.queue[R.pos].m][R.queue[R.pos].id])) R.pos++;
    const it = R.queue[R.pos];
    const head = `<div class="run-head"><button class="link" data-act="quit">✕ ${L("Quitter", "Quit")}</button><span class="run-title jp">${esc(runTitle())}</span>
      ${R.timed ? `<span id="timer" class="timer">${fmtClock((Date.now() - R.started) / 1000)}</span>` : `<span class="muted">${Math.min(R.pos + 1, R.queue.length)} / ${R.queue.length}</span>`}</div>
      <div class="progress ruler"><span style="width:${pct(R.pos, R.queue.length)}%"></span></div>`;
    if (!it) return head + finishView();
    if (it.s !== "learn" && (!EX || EX._pos !== R.pos || EX._lang !== J.lang())) { EX = J.makeEx(it.m, it.id, it.s === "fix" ? "rev" : it.s, it.kind); EX._pos = R.pos; EX._lang = J.lang(); }
    const modPill = `<span class="pill mod-${it.m}"><span class="jp">${MODS[it.m].jp}</span> ${J.modName(it.m)}</span>`;
    const tag = `<div class="ex-tag">${modPill}<span class="pill stage-${it.s}">${STAGE()[it.s]}</span>${it.s !== "learn" && EX ? `<span class="muted">${esc(EX.label)}</span>` : ""}</div>`;
    const aside = it.m !== "g" && !it.free ? `<div class="ex-aside"><button data-act="exclude-cur">${it.m === "v" ? L("Ce mot n’est pas du niveau N1 ? Le retirer des leçons", "Not an N1 word? Remove it from lessons") : L("Ce kanji n’est pas du niveau N1 ? Le retirer des leçons", "Not an N1 kanji? Remove it from lessons")}</button></div>` : "";
    if (it.s === "learn") {
      if (!R.learnT0 || R.learnPos !== R.pos) { R.learnT0 = Date.now(); R.learnPos = R.pos; }
      return head + `<section class="card ex"><div class="ex-tag">${modPill}<span class="pill stage-learn">${J.LEVELS[0]}</span></div>
        ${J.learnCard(it.m, it.id)}
        <div class="row end"><button class="btn" data-act="learn-known">${L("Déjà connu", "Already known")}</button><button class="btn primary" data-act="learn-next" autofocus>${L("J’ai compris → Suivant", "Got it → Next")} <kbd>↵</kbd></button></div></section>${aside}`;
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
      if (ex.answered) h += feedback(ex.correct, ex.correct ? "" : ex.answer) + ex.back + contBtn(ex);
    } else if (ex.mode === "self") {
      if (!ex.revealed) h += `<div class="row center"><button class="btn primary" data-act="reveal" autofocus>${L("Afficher la réponse", "Show answer")} <kbd>${L("espace", "space")}</kbd></button></div>`;
      else h += ex.back + `<p class="q-help center">${L("Comment t’en es-tu sorti ?", "How did you do?")}</p><div class="grades">
        <button class="g0" data-act="grade" data-q="0"><span class="jp">×</span>${L("Raté", "Missed")}<kbd>1</kbd></button><button class="g1" data-act="grade" data-q="1"><span class="jp">△</span>${L("Difficile", "Hard")}<kbd>2</kbd></button>
        <button class="g2" data-act="grade" data-q="2"><span class="jp">○</span>${L("Bien", "Good")}<kbd>3</kbd></button><button class="g3" data-act="grade" data-q="3"><span class="jp">◎</span>${L("Facile", "Easy")}<kbd>4</kbd></button></div>`;
    } else if (ex.mode === "order") {
      const slots = [0, 1, 2, 3].map((k) => {
        const p = ex.picks[k];
        const cls = ex.answered ? (p === k ? "ok" : "ko") : "";
        return `<button class="slot ${k === ex.star ? "star" : ""} ${cls}" data-act="slot" data-k="${k}" ${ex.answered ? "disabled" : ""}>${p !== undefined ? esc(ex.pieces[p]) : k === ex.star ? "★" : "＿＿"}</button>`;
      }).join("");
      h += `<div class="sentence jp order" lang="ja">${esc(ex.pre)}${slots}${esc(ex.post)}</div>`;
      if (!ex.answered) {
        h += `<div class="pieces">${ex.order.map((i) => `<button class="piece jp" data-act="piece" data-i="${i}" ${ex.picks.includes(i) ? "disabled" : ""}>${esc(ex.pieces[i])}</button>`).join("")}</div>
          <div class="row center"><button class="btn" data-act="order-clear">${L("Effacer", "Clear")}</button>${ex.picks.length === 4 ? `<button class="btn primary" data-act="order-check" autofocus>${L("Vérifier", "Check")} <kbd>↵</kbd></button>` : ""}</div>`;
      } else {
        h += feedback(ex.correct, ex.correct ? "" : `★ = ${ex.pieces[ex.star]}`) + ex.back + contBtn(ex);
      }
    }
    return h;
  }
  const feedback = (ok, ans) => `<div class="fb ${ok ? "ok" : "ko"}"><span class="fb-jp">${ok ? "正解！" : "ざんねん"}</span><span>${ok ? L("Correct", "Correct") : `${L("La bonne réponse", "The right answer")} : <b class="jp">${esc(ans)}</b>`}</span></div>`;
  // Dernière question réussie : le bouton annonce la fin plutôt que « Continuer »
  const isLast = (ex) => R && R.pos >= R.queue.length - 1 && (ex.correct || R.noFix || (R.fix[R.queue[R.pos].m + ":" + R.queue[R.pos].id] || 0) >= 3);
  const contBtn = (ex) => isLast(ex)
    ? `<div class="row end"><button class="btn primary big finish-btn" data-act="cont" autofocus>おつかれさま！ <span>${L("Terminer", "Finish")}</span></button></div>`
    : `<div class="row end"><button class="btn primary" data-act="cont" autofocus>${L("Continuer", "Continue")} <kbd>↵</kbd></button></div>`;

  function finishView() {
    const lesson = R.type === "lesson";
    if (lesson) { J.day().done = true; if (R.mult === 2) J.day().double = true; J.save(true); }
    const tot = R.ok + R.ko;
    const errs = [...new Map((R.errors || []).filter((e) => J.byId[e.m][e.id]).map((e) => [e.m + e.id, e])).values()];
    return `<section class="card finish"><h1>${lesson ? "お疲れさまでした！" : "終了！"}</h1>
      <p class="score">${tot ? Math.round((R.ok / tot) * 100) : 0} % <small>${R.ok} ✓ · ${R.ko} ✗</small></p>
      <p>${L("Durée", "Time")} : ${fmtClock((Date.now() - R.started) / 1000)}</p>
      ${errs.length ? `<h3>${L("À revoir", "To review")}</h3><div class="errs">${errs.map((e) => { const x = J.byId[e.m][e.id];
        return `<button class="weak" data-act="open-item" data-m="${e.m}" data-id="${esc(e.id)}"><span class="pill mod-${e.m} jp">${MODS[e.m].jp}</span><span class="jp">${esc(e.m === "v" ? x.w : e.m === "k" ? x.k : x.p)}</span></button>`; }).join("")}</div>` : `<p>${L("Aucune erreur, bravo !", "No mistakes, well done!")}</p>`}
      ${lesson ? `<p class="muted">${L("Ce que tu as raté reviendra dans tes prochaines révisions.", "What you missed will come back in your next reviews.")}</p>` : ""}
      <div class="row center"><button class="btn primary" data-act="end-run">${L("Retour à l’accueil", "Back to home")}</button></div></section>`;
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

  // Accès pour les tests automatiques (construction de leçon, rattrapage)
  J._test = {
    buildLesson, extendLesson, result,
    get R() { return R; }, set R(v) { R = v; },
    set EX(v) { EX = v; }
  };

  /* ───────── Actions ───────── */
  const A = {
    nav: (d) => { const v = d.v; if (v.startsWith("mod-")) J.go("mod", { m: v.slice(4) }); else J.go(v); },
    "set-lang": (d) => { J.S.settings.lang = d.l; J.saveSettings(); render(); },
    "set-exam": (d) => { J.S.settings.examDate = d.d; J.saveSettings(); render(); },
    "set-dpw": (d) => { J.S.settings.daysPerWeek = +d.n; J.S.paceAck = null; J.saveSettings(); render(); },
    "set-max": (d) => { J.S.settings.maxMinutes = +d.n; J.saveSettings(); render(); },
    "set-final": (d) => { J.S.settings.finalWeeks = +d.n; J.saveSettings(); render(); },
    "finish-onboard": () => { J.S.onboarded = true; J.save(true); J.go("home"); },
    "pace-adapt": (d) => { J.S.settings.daysPerWeek = +d.n; J.S.paceAck = J.today(); J.saveSettings(); render(); },
    "pace-keep": () => { J.S.paceAck = J.today(); J.save(); render(); },
    /* La leçon du jour est figée jusqu’au lendemain : on la refait à la demande.
       Les acquis vivent dans J.S.items, pas dans la file : rien n’est perdu. */
    "rebuild-lesson": () => {
      const L0 = J.S.lesson;
      if (L0 && L0.date === J.today() && (L0.pos || 0) > 0
          && !confirm(L("La leçon du jour est déjà commencée. La refaire remet le compteur à zéro — ce que tu as appris reste acquis. Continuer ?",
                        "Today’s lesson is already under way. Rebuilding resets its counter — what you have learnt is kept. Carry on?"))) return;
      J.S.lesson = null;
      J.S.dayMult = null;
      J.save();
      render();
      tampon(document.querySelector('[data-act="rebuild-lesson"]'), "済");
    },
    "lesson-start": startLesson,
    "set-mult": (d) => { J.setTodayMult(+d.n); render(); },
    "lesson-double": () => { extendLesson(); startLesson(); },
    "exam-start": startExam,
    practice: (d) => J.go("practice", { m: d.m }),
    "mod-test": (d) => startPractice(d.m, "learned", 20, true),
    pseg: (d, el) => { el.parentElement.querySelectorAll("button").forEach((b) => b.classList.remove("on")); el.classList.add("on"); },
    "practice-go": (d) => {
      const src = document.querySelector("#p-src .on").dataset.v, n = +document.querySelector("#p-n .on").dataset.v;
      startPractice(d.m, src, n, false);
    },
    drill: (d) => {
      R = { type: "practice", kind: "drill", ref: d.id, queue: ["g-qcm", "g-rev", "g-cloze", "g-ord", "g-qcm"].map((k) => ({ s: "rev", m: "g", id: d.id, free: true, kind: k })), pos: 0, fix: {}, ok: 0, ko: 0, errors: [], started: Date.now(), noFix: true };
      EX = null; J.go("run");
    },
    filter: (d) => J.go("mod", { m: d.m, f: d.f, q: (document.getElementById("search") || {}).value || "" }),
    page: (d) => J.go("mod", { ...view.p, page: +d.pg }),
    "open-item": (d) => J.go("item", { m: d.m, id: d.id }),
    known: (d) => { J.markKnown(d.m, d.id); render(); },
    say: (d) => J.say(d.say),
    quit: () => { J.save(true); R = null; EX = null; J.go("home"); },
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
    logout: () => { if (!confirm(L("Se déconnecter ? La progression sera retirée de ce navigateur (elle reste sur ton compte).", "Sign out? Your progress will be removed from this browser (it stays on your account)."))) return; J.logout(); R = null; J.go("onboarding"); },
    relogin: () => { J.dropSession(); J.go("account"); },
    "sync-now": () => { J.save(true); setTimeout(render, 1500); },
    "delete-account": async () => {
      if (!confirm(L("Supprimer ton compte et toute ta progression en ligne ?", "Delete your account and all your online progress?"))) return;
      if (!confirm(L("C’est définitif. Confirmer la suppression ?", "This is permanent. Confirm deletion?"))) return;
      try { await J.deleteAccount(); R = null; alert(L("Ton compte a été supprimé.", "Your account has been deleted.")); J.go("onboarding"); } catch (e) { alert(e.message); }
    },
    export: () => J.exportFile(),
    import: () => document.getElementById("importFile").click(),
    reset: () => {
      if (!confirm(L("Effacer toute ta progression ? (Pense à exporter une copie avant.)", "Erase all your progress? (Export a copy first.)"))) return;
      if (!confirm(L("Vraiment tout effacer ? Cette action est définitive.", "Really erase everything? This cannot be undone."))) return;
      const lang = J.S.settings.lang;
      J.S = J.defaultState(); J.S.settings.lang = lang; J.refreshItems();
      // des réglages remis à neuf doivent l’emporter sur ceux du nuage
      J.S.settingsAt = new Date().toISOString(); J.save(true); R = null; J.go("onboarding");
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
        try { J.importObject(JSON.parse(txt)); alert(L("Sauvegarde importée.", "Backup imported.")); J.go("home"); } catch (err) { alert(err.message); }
      });
      return;
    }
    const k = t.dataset.set;
    if (!k) return;
    const s = J.S.settings;
    if (k === "examDate" && t.value) s.examDate = t.value;
    else if (k === "rate") s.rate = +t.value;
    else if (k.startsWith("test-")) s.tests[k.slice(5)] = Math.max(0, Math.min(30, +t.value || 0));
    J.saveSettings(); render();
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
    if (OLD_HOST && !J.user() && !J.S.onboarded && !location.hash) { location.replace(NEW_ORIGIN + "/"); return; }
    if (J.S.lesson && J.S.lesson.date !== J.today()) J.S.lesson = null;
    render();
    await J.handleRedirect();
  })();
})();
