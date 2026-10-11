// Points d'entrée HTTP de l'API (préfixe /api).
//   POST   /api/auth/login        { provider, idToken, nonce } → { token, user }
//   GET    /api/me                → profil
//   DELETE /api/me                → supprime le compte et toutes les données
//   GET    /api/health            → état du service (surveillance) : 200 ok / 503 dégradé
//   GET    /api/progress/{level}  → { data, etag } ou 204 si rien
//   PUT    /api/progress/{level}  corps = progression ; en-tête If-Match (ETag) ou x-create: 1
//                                 → { etag } ou 412 { data, etag } en cas de conflit
const { app } = require("@azure/functions");
const { verifyIdToken, userIdFor, issueSession, requireSession, AuthError } = require("../lib/auth");
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

app.http("login", {
  route: "auth/login",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: wrap(async (request) => {
    const { provider, idToken, nonce, name } = await readBody(request);
    const ident = await verifyIdToken(provider, idToken, nonce);
    const uid = userIdFor(ident.provider, ident.sub);
    const path = `users/${uid}/profile.json`;
    const prev = await store.readJson(path);
    const now = new Date().toISOString();
    const profile = {
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

app.http("me", {
  route: "me",
  methods: ["GET", "DELETE"],
  authLevel: "anonymous",
  handler: wrap(async (request) => {
    const uid = await requireSession(request);
    if (request.method === "DELETE") {
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
