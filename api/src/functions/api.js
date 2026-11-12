// Points d'entrée HTTP de l'API (préfixe /api).
//   POST   /api/auth/login        { provider, idToken, nonce } → { token, user }
//   POST   /api/auth/link         { provider, idToken, nonce } → profil ; associe une 2e connexion au compte ouvert
//   DELETE /api/auth/link         { provider } → profil ; retire cette association
//   GET    /api/me                → profil
//   DELETE /api/me                → supprime le compte et toutes les données
//   GET    /api/health            → état du service (surveillance) : 200 ok / 503 dégradé
//   GET    /api/progress/{level}  → { data, etag } ou 204 si rien
//   PUT    /api/progress/{level}  corps = progression ; en-tête If-Match (ETag) ou x-create: 1
//                                 → { etag } ou 412 { data, etag } en cas de conflit
const { app } = require("@azure/functions");
const auth = require("../lib/auth");
const { userIdFor, issueSession, requireSession, AuthError } = auth;
const store = require("../lib/store");

const MAX_BODY = 4 * 1024 * 1024;
// Version déployée (écrite par GitHub Actions : commit + date), pour vérifier un déploiement ou un retour arrière
let VERSION = { commit: "dev", date: null };
try { VERSION = require("../../version.json"); } catch { /* exécution locale */ }
const LEVELS = /^N[1-5]$/;

const json = (status, body) => ({ status, jsonBody: body, headers: { "Cache-Control": "no-store" } });

function wrap(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (e) {
      if (e instanceof AuthError || e.status) return json(e.status || 401, { error: e.message });
      context.error(e);
      return json(500, { error: "Erreur serveur" });
    }
  };
}

async function readBody(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) throw Object.assign(new Error("Données trop volumineuses"), { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY) throw Object.assign(new Error("Données trop volumineuses"), { status: 413 });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error("JSON invalide"), { status: 400 }); }
}

app.http("health", {
  route: "health",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const started = Date.now();
    let storage = "ok";
    try { await store.ping(); } catch (e) { storage = "erreur"; context.error("health: stockage", e.message); }
    const ok = storage === "ok";
    return json(ok ? 200 : 503, { status: ok ? "ok" : "dégradé", storage, version: VERSION, ms: Date.now() - started, time: new Date().toISOString() });
  }
});

/* Une personne peut ouvrir le même compte avec plusieurs connexions (par ex. Google et Clean Work).
   links/<id de la connexion>.json → { uid } : le compte que cette connexion ouvre. */
const linkPath = (id) => `links/${id}.json`;

app.http("login", {
  route: "auth/login",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: wrap(async (request) => {
    const { provider, idToken, nonce, name } = await readBody(request);
    const ident = await auth.verifyIdToken(provider, idToken, nonce);
    const own = userIdFor(ident.provider, ident.sub);
    const now = new Date().toISOString();
    // Connexion associée à un autre compte : on ouvre ce compte-là (s'il existe toujours)
    const link = await store.readJson(linkPath(own));
    if (link) {
      const target = await store.readJson(`users/${link.data.uid}/profile.json`);
      if (target) {
        const profile = { ...target.data, lastLogin: now };
        await store.writeJson(`users/${link.data.uid}/profile.json`, profile);
        return json(200, { token: await issueSession(link.data.uid), user: profile });
      }
    }
    const uid = own;
    const path = `users/${uid}/profile.json`;
    const prev = await store.readJson(path);
    const profile = {
      ...(prev?.data || {}),
      id: uid,
      provider: ident.provider,
      email: ident.email || prev?.data.email || null,
      // Apple n'envoie le nom qu'à la première connexion, côté client
      name: ident.name || (typeof name === "string" ? name.slice(0, 80) : null) || prev?.data.name || null,
      createdAt: prev?.data.createdAt || now,
      lastLogin: now
    };
    await store.writeJson(path, profile);
    return json(200, { token: await issueSession(uid), user: profile });
  })
});

async function hasProgress(uid) {
  for (const level of ["N1", "N2", "N3", "N4", "N5"]) {
    const p = await store.readJson(`users/${uid}/progress-${level}.json`);
    if (p && Object.keys(p.data.items || {}).length) return true;
  }
  return false;
}

app.http("link", {
  route: "auth/link",
  methods: ["POST", "DELETE"],
  authLevel: "anonymous",
  handler: wrap(async (request) => {
    const uid = await requireSession(request);
    const path = `users/${uid}/profile.json`;
    const cur = await store.readJson(path);
    if (!cur) return json(404, { error: "Compte introuvable" });
    const body = await readBody(request);
    const links = cur.data.links || [];

    if (request.method === "DELETE") {
      const keep = links.filter((l) => l.provider !== body.provider);
      for (const l of links) if (l.provider === body.provider) await store.deletePrefix(linkPath(l.id));
      const profile = { ...cur.data, links: keep };
      await store.writeJson(path, profile);
      return json(200, profile);
    }

    const ident = await auth.verifyIdToken(body.provider, body.idToken, body.nonce);
    const id = userIdFor(ident.provider, ident.sub);
    if (id === uid) return json(409, { error: "C’est déjà la connexion de ce compte" });
    const existing = await store.readJson(linkPath(id));
    if (existing && existing.data.uid !== uid && await store.readJson(`users/${existing.data.uid}/profile.json`)) {
      return json(409, { error: "Cette connexion est déjà associée à un autre compte JLPT Étude" });
    }
    // Cette connexion a déjà servi seule : on ne l'associe que si elle n'a aucune progression à perdre
    if (await hasProgress(id)) return json(409, { error: "Cette connexion a déjà sa propre progression JLPT Étude" });
    await store.deletePrefix(`users/${id}/`);
    await store.writeJson(linkPath(id), { uid, provider: ident.provider, at: new Date().toISOString() });
    const profile = { ...cur.data, links: links.filter((l) => l.id !== id).concat([{ provider: ident.provider, id, email: ident.email, at: new Date().toISOString() }]) };
    await store.writeJson(path, profile);
    return json(200, profile);
  })
});

app.http("me", {
  route: "me",
  methods: ["GET", "DELETE"],
  authLevel: "anonymous",
  handler: wrap(async (request) => {
    const uid = await requireSession(request);
    if (request.method === "DELETE") {
      // les connexions associées ne doivent plus mener à un compte supprimé
      const mine = await store.readJson(`users/${uid}/profile.json`);
      for (const l of mine?.data.links || []) await store.deletePrefix(linkPath(l.id));
      const n = await store.deletePrefix(`users/${uid}/`);
      return json(200, { deleted: n });
    }
    const p = await store.readJson(`users/${uid}/profile.json`);
    if (!p) return json(404, { error: "Compte introuvable" });
    return json(200, p.data);
  })
});

app.http("progress", {
  route: "progress/{level}",
  methods: ["GET", "PUT"],
  authLevel: "anonymous",
  handler: wrap(async (request) => {
    const uid = await requireSession(request);
    const level = request.params.level;
    if (!LEVELS.test(level)) return json(400, { error: "Niveau invalide" });
    const path = `users/${uid}/progress-${level}.json`;

    if (request.method === "GET") {
      const cur = await store.readJson(path);
      return cur ? json(200, cur) : { status: 204 };
    }

    const data = await readBody(request);
    if (!data || typeof data !== "object" || !data.version || typeof data.items !== "object") {
      return json(400, { error: "Ce n'est pas une progression JLPT Étude" });
    }
    const ifMatch = request.headers.get("if-match");
    const create = request.headers.get("x-create") === "1";
    if (!ifMatch && !create) return json(428, { error: "If-Match ou x-create requis" });
    const res = await store.writeJson(path, data, create ? null : ifMatch);
    if (res.conflict) {
      const cur = await store.readJson(path);
      return json(412, cur || { data: null, etag: null });
    }
    return json(200, { etag: res.etag });
  })
});
