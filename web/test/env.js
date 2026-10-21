// Charge les scripts du site (données + cœur + exercices) dans un contexte isolé, sans navigateur.
// Chaque appel à load() donne une instance neuve de l’appli, avec une date « aujourd’hui » contrôlée.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const WEB = path.join(__dirname, "..");
const SCRIPTS = [
  "data/n1-vocab.js", "data/n1-kanji.js", "data/n1-grammaire.js", "data/n1-grammaire-trad.js",
  "data/n1-grammaire-en.js", "data/n1-grammaire-trad-en.js", "data/n1-vocab-fr.js", "data/n1-kanji-fr.js", "data/n1-kanji-mots.js",
  "app/core.js", "app/exercices.js"
];
const CODE = SCRIPTS.map((f) => [f, fs.readFileSync(path.join(WEB, f), "utf8")]);
const UI = ["app/config.js", "app/compte.js", "app/ui.js"].map((f) => [f, fs.readFileSync(path.join(WEB, f), "utf8")]);

function load({ today = "2026-10-10", lang = "fr", ui = false } = {}) {
  const [y, m, d] = today.split("-").map(Number);
  const RealDate = Date;
  const fixed = new RealDate(y, m - 1, d, 12, 0, 0).getTime();
  // Date figée sur « today » à midi (le reste du comportement de Date est conservé)
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
    static now() { return fixed; }
  }
  const store = {};
  const listeners = {};
  const ctx = {
    Date: FakeDate, Math, JSON, console, URL, TextEncoder, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    navigator: { language: lang === "fr" ? "fr-FR" : "en-US" },
    location: { protocol: "file:", origin: "http://test", hash: "", pathname: "/" },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: {
      addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }, dispatchEvent: () => {}, hidden: false,
      documentElement: {}, querySelector: () => null, querySelectorAll: () => [],
      getElementById: () => ({ innerHTML: "", addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] })
    },
    scrollTo: () => {}, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    history: { replaceState: () => {} },
    addEventListener: () => {},
    Event: class { constructor(t) { this.type = t; } },
    fetch: async () => { throw new Error("pas de réseau dans les tests"); }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const [f, src] of ui ? CODE.concat(UI) : CODE) vm.runInContext(src, ctx, { filename: f });
  const J = ctx.J;
  J.S = J.defaultState();
  J.S.settings.lang = lang;
  J.refreshItems();
  return J;
}

// Raccourci : marque un élément comme appris il y a n jours avec un intervalle donné
function learned(J, m, id, { iv = 1, due, at } = {}) {
  const r = J.ensure(m, id);
  r.at = at || J.addDays(J.today(), -5);
  r.iv = iv;
  r.due = due || J.today();
  return r;
}

module.exports = { load, learned };
