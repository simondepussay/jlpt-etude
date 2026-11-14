// Routes de l’API avec un stockage en mémoire (pas d’Azure) : sessions, isolation, conflits, validations.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

process.env.SESSION_SECRET = "s".repeat(48);
process.env.GOOGLE_CLIENT_ID = "";

/* Faux @azure/functions : on récupère les handlers enregistrés */
const handlers = {};
const fnPath = require.resolve("@azure/functions");
require.cache[fnPath] = { id: fnPath, filename: fnPath, loaded: true, exports: { app: { http: (name, def) => { handlers[name] = def.handler; } } } };

/* Faux stockage : mêmes règles d’ETag que Blob Storage */
const blobs = new Map();
let n = 0, storageDown = false;
const storePath = path.join(__dirname, "..", "src", "lib", "store.js");
require.cache[storePath] = {
  id: storePath, filename: storePath, loaded: true,
  exports: {
    async readJson(p) { const b = blobs.get(p); return b ? { data: JSON.parse(b.body), etag: b.etag } : null; },
    async writeJson(p, data, ifMatch) {
      const cur = blobs.get(p);
      if (ifMatch === null && cur) return { conflict: true };
      if (ifMatch && (!cur || cur.etag !== ifMatch)) return { conflict: true };
      const etag = `"e${++n}"`;
      blobs.set(p, { body: JSON.stringify(data), etag });
      return { etag };
    },
    async deletePrefix(prefix) { let k = 0; for (const p of [...blobs.keys()]) if (p.startsWith(prefix)) { blobs.delete(p); k++; } return k; },
    async ping() { if (storageDown) throw new Error("stockage indisponible"); return true; }
  }
};

require("../src/functions/api.js");
const { issueSession } = require("../src/lib/auth");

const ctx = { error: () => {}, log: () => {} };
function req(method, { params = {}, headers = {}, body } = {}) {
  const text = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  return { method, params, headers: new Headers({ "content-length": String(Buffer.byteLength(text)), ...headers }), text: async () => text };
}
const call = (name, r) => handlers[name](r, ctx);
const progression = (extra = {}) => ({ version: 1, items: { "v:x": { r: 1 } }, ...extra });

test("A01 · /api/health : 200 quand tout va bien, 503 si le stockage ne répond plus", async () => {
  let r = await call("health", req("GET"));
  assert.equal(r.status, 200);
  assert.equal(r.jsonBody.status, "ok");
  assert.ok(r.jsonBody.version);
  storageDown = true;
  r = await call("health", req("GET"));
  assert.equal(r.status, 503);
  storageDown = false;
});

test("A02 · sans session valide : 401", async () => {
  assert.equal((await call("progress", req("GET", { params: { level: "N1" } }))).status, 401);
  assert.equal((await call("progress", req("GET", { params: { level: "N1" }, headers: { "x-jlpt-session": "faux" } }))).status, 401);
});

test("A03 · niveau JLPT invalide : 400", async () => {
  const tok = await issueSession("u-a03");
  const r = await call("progress", req("GET", { params: { level: "N9" }, headers: { "x-jlpt-session": tok } }));
  assert.equal(r.status, 400);
});

test("A04 · création, lecture, mise à jour avec ETag", async () => {
  const h = { "x-jlpt-session": await issueSession("u-a04") };
  assert.equal((await call("progress", req("GET", { params: { level: "N1" }, headers: h }))).status, 204);
  const c = await call("progress", req("PUT", { params: { level: "N1" }, headers: { ...h, "x-create": "1" }, body: progression() }));
  assert.equal(c.status, 200);
  const u = await call("progress", req("PUT", { params: { level: "N1" }, headers: { ...h, "if-match": c.jsonBody.etag }, body: progression({ items: { "v:x": { r: 2 } } }) }));
  assert.equal(u.status, 200);
  const g = await call("progress", req("GET", { params: { level: "N1" }, headers: h }));
  assert.equal(g.jsonBody.data.items["v:x"].r, 2);
});

test("A05 · conflit entre deux appareils : 412 avec la version du serveur (le client fusionne)", async () => {
  const h = { "x-jlpt-session": await issueSession("u-a05") };
  const c = await call("progress", req("PUT", { params: { level: "N1" }, headers: { ...h, "x-create": "1" }, body: progression() }));
  await call("progress", req("PUT", { params: { level: "N1" }, headers: { ...h, "if-match": c.jsonBody.etag }, body: progression({ items: { "v:x": { r: 5 } } }) }));
  const stale = await call("progress", req("PUT", { params: { level: "N1" }, headers: { ...h, "if-match": c.jsonBody.etag }, body: progression() }));
  assert.equal(stale.status, 412);
  assert.equal(stale.jsonBody.data.items["v:x"].r, 5);
  const again = await call("progress", req("PUT", { params: { level: "N1" }, headers: { ...h, "x-create": "1" }, body: progression() }));
  assert.equal(again.status, 412); // « création » sur une progression existante refusée aussi
});

test("A06 · écriture sans If-Match ni x-create : 428 (pas d’écrasement aveugle)", async () => {
  const h = { "x-jlpt-session": await issueSession("u-a06") };
  assert.equal((await call("progress", req("PUT", { params: { level: "N1" }, headers: h, body: progression() }))).status, 428);
});

test("A07 · contenu invalide ou trop gros refusé (400 / 413)", async () => {
  const h = { "x-jlpt-session": await issueSession("u-a07"), "x-create": "1" };
  assert.equal((await call("progress", req("PUT", { params: { level: "N1" }, headers: h, body: "{pas du json" }))).status, 400);
  assert.equal((await call("progress", req("PUT", { params: { level: "N1" }, headers: h, body: { hello: 1 } }))).status, 400);
  const big = req("PUT", { params: { level: "N1" }, headers: { ...h, "content-length": String(5 * 1024 * 1024) }, body: progression() });
  assert.equal((await call("progress", big)).status, 413);
});

test("A08 · chaque compte ne voit que ses propres données", async () => {
  const ha = { "x-jlpt-session": await issueSession("u-a08-a") };
  const hb = { "x-jlpt-session": await issueSession("u-a08-b") };
  await call("progress", req("PUT", { params: { level: "N1" }, headers: { ...ha, "x-create": "1" }, body: progression() }));
  assert.equal((await call("progress", req("GET", { params: { level: "N1" }, headers: hb }))).status, 204);
});

test("A09 · suppression du compte : toutes les données de l’utilisateur sont effacées", async () => {
  const h = { "x-jlpt-session": await issueSession("u-a09") };
  await call("progress", req("PUT", { params: { level: "N1" }, headers: { ...h, "x-create": "1" }, body: progression() }));
  const d = await call("me", req("DELETE", { headers: h }));
  assert.equal(d.status, 200);
  assert.equal((await call("progress", req("GET", { params: { level: "N1" }, headers: h }))).status, 204);
});

test("A10 · connexion : fournisseur inconnu 400, fournisseur non configuré 503", async () => {
  assert.equal((await call("login", req("POST", { body: { provider: "facebook", idToken: "a.b.c" } }))).status, 400);
  assert.equal((await call("login", req("POST", { body: { provider: "google", idToken: "a.b.c" } }))).status, 503);
});

/* Connexions associées : faux fournisseur d’identité (le vrai contrôle des jetons est testé dans auth.test.js) */
const auth = require("../src/lib/auth");
const realVerify = auth.verifyIdToken;
const fakeIdentity = () => { auth.verifyIdToken = async (provider, idToken) => { const [sub, email] = idToken.split("|"); return { provider, sub, email, name: null }; }; };
const login = async (provider, sub) => (await call("login", req("POST", { body: { provider, idToken: `${sub}|${sub}@example.com` } }))).jsonBody;
const linkCw = (token, sub) => call("link", req("POST", { headers: { "x-jlpt-session": token }, body: { provider: "cleanwork", idToken: `${sub}|${sub}@example.com` } }));

test("A11 · associer Clean Work à un compte Google : les deux connexions ouvrent le même compte", async () => {
  fakeIdentity();
  const g = await login("google", "a11");
  await call("progress", req("PUT", { params: { level: "N1" }, headers: { "x-jlpt-session": g.token, "x-create": "1" }, body: progression() }));
  const r = await linkCw(g.token, "a11cw");
  assert.equal(r.status, 200);
  assert.equal(r.jsonBody.links.length, 1);
  assert.equal(r.jsonBody.links[0].provider, "cleanwork");
  const cw = await login("cleanwork", "a11cw");
  assert.equal(cw.user.id, g.user.id);
  assert.equal(cw.user.provider, "google");
  assert.equal((await call("progress", req("GET", { params: { level: "N1" }, headers: { "x-jlpt-session": cw.token } }))).status, 200);
  auth.verifyIdToken = realVerify;
});

test("A12 · association refusée : sans session, connexion déjà prise, ou qui a déjà sa propre progression", async () => {
  fakeIdentity();
  assert.equal((await call("link", req("POST", { body: { provider: "cleanwork", idToken: "x|x" } }))).status, 401);
  const a = await login("google", "a12a"), b = await login("google", "a12b");
  assert.equal((await linkCw(a.token, "a12cw")).status, 200);
  assert.equal((await linkCw(b.token, "a12cw")).status, 409);
  // une connexion Clean Work utilisée seule, avec de la progression, ne peut pas être absorbée
  const solo = await login("cleanwork", "a12solo");
  await call("progress", req("PUT", { params: { level: "N1" }, headers: { "x-jlpt-session": solo.token, "x-create": "1" }, body: progression() }));
  assert.equal((await linkCw(b.token, "a12solo")).status, 409);
  // … mais sans progression, oui : son compte vide disparaît
  await login("cleanwork", "a12vide");
  assert.equal((await linkCw(b.token, "a12vide")).status, 200);
  assert.equal((await login("cleanwork", "a12vide")).user.id, b.user.id);
  auth.verifyIdToken = realVerify;
});

test("A13 · retirer l’association, ou supprimer le compte, rend sa connexion Clean Work indépendante", async () => {
  fakeIdentity();
  const g = await login("google", "a13");
  await linkCw(g.token, "a13cw");
  const d = await call("link", req("DELETE", { headers: { "x-jlpt-session": g.token }, body: { provider: "cleanwork" } }));
  assert.equal(d.status, 200);
  assert.equal(d.jsonBody.links.length, 0);
  assert.notEqual((await login("cleanwork", "a13cw")).user.id, g.user.id);
  const g2 = await login("google", "a13b");
  await linkCw(g2.token, "a13cw2");
  await call("me", req("DELETE", { headers: { "x-jlpt-session": g2.token } }));
  assert.notEqual((await login("cleanwork", "a13cw2")).user.id, g2.user.id);
  auth.verifyIdToken = realVerify;
});

test("A14 · Clean Work : non configuré → 503 ; jeton d’un autre émetteur refusé", async () => {
  delete process.env.CLEANWORK_CLIENT_ID;
  assert.equal((await call("login", req("POST", { body: { provider: "cleanwork", idToken: "a.b.c" } }))).status, 503);
  process.env.CLEANWORK_CLIENT_ID = "client"; process.env.CLEANWORK_TENANT = "exemple"; process.env.CLEANWORK_TENANT_ID = "x";
  assert.equal((await call("login", req("POST", { body: { provider: "cleanwork", idToken: "a.b.c" } }))).status, 503);
  delete process.env.CLEANWORK_CLIENT_ID;
});
