// Vérification des jetons d'identité (Google, Apple, Microsoft) et sessions JLPT Étude.
// Aucun mot de passe n'est stocké : on vérifie la signature du jeton du fournisseur,
// puis on émet notre propre jeton de session (HS256) valable 60 jours.
const crypto = require("node:crypto");
const { createRemoteJWKSet, jwtVerify, SignJWT, decodeJwt } = require("jose");

const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

const PROVIDERS = {
  google: {
    jwks: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: () => list(process.env.GOOGLE_CLIENT_ID)
  },
  apple: {
    jwks: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
    issuer: ["https://appleid.apple.com"],
    audience: () => list(process.env.APPLE_CLIENT_IDS)
  },
  microsoft: {
    jwks: createRemoteJWKSet(new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys")),
    // multi-locataire : l'émetteur contient l'identifiant du locataire (vérifié plus bas)
    issuer: null,
    audience: () => list(process.env.MICROSOFT_CLIENT_ID)
  }
};

class AuthError extends Error {
  constructor(msg, status = 401) { super(msg); this.status = status; }
}

async function verifyIdToken(provider, idToken, nonce) {
  const p = PROVIDERS[provider];
  if (!p) throw new AuthError("Fournisseur inconnu", 400);
  const audience = p.audience();
  if (!audience.length) throw new AuthError(`Connexion ${provider} non configurée`, 503);
  if (typeof idToken !== "string" || idToken.length > 8000) throw new AuthError("Jeton invalide", 400);

  const opts = { audience, clockTolerance: 60 };
  if (p.issuer) opts.issuer = p.issuer;
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, p.jwks, opts));
  } catch (e) {
    throw new AuthError("Jeton refusé : " + e.code);
  }
  if (provider === "microsoft") {
    if (!payload.tid || payload.iss !== `https://login.microsoftonline.com/${payload.tid}/v2.0`) throw new AuthError("Émetteur Microsoft invalide");
  }
  if (nonce) {
    // Apple renvoie le nonce haché en SHA-256 quand il est fourni haché ; on accepte les deux formes
    const hashed = crypto.createHash("sha256").update(nonce).digest("hex");
    if (payload.nonce !== nonce && payload.nonce !== hashed) throw new AuthError("Nonce invalide");
  }
  if (!payload.sub) throw new AuthError("Jeton sans identifiant");
  return {
    provider,
    sub: String(payload.sub),
    email: payload.email || payload.preferred_username || null,
    name: payload.name || null
  };
}

const userIdFor = (provider, sub) =>
  crypto.createHash("sha256").update(`${provider}:${sub}`).digest("base64url").slice(0, 32);

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new AuthError("Serveur mal configuré (SESSION_SECRET)", 500);
  return new TextEncoder().encode(s);
}

async function issueSession(uid) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(uid)
    .setIssuer("jlpt-etude")
    .setIssuedAt()
    .setExpirationTime("60d")
    .sign(secret());
}

async function requireSession(request) {
  const tok = request.headers.get("x-jlpt-session");
  if (!tok) throw new AuthError("Non connecté");
  try {
    const { payload } = await jwtVerify(tok, secret(), { issuer: "jlpt-etude", algorithms: ["HS256"] });
    return payload.sub;
  } catch (e) {
    throw new AuthError("Session expirée, reconnecte-toi");
  }
}

module.exports = { verifyIdToken, userIdFor, issueSession, requireSession, AuthError, decodeJwt };
