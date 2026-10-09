const test = require("node:test");
const assert = require("node:assert");
process.env.SESSION_SECRET = "x".repeat(48);
const { issueSession, requireSession, userIdFor, verifyIdToken } = require("../src/lib/auth");

const req = (token) => ({ headers: new Map(token ? [["x-jlpt-session", token]] : []) });

test("une session émise est acceptée", async () => {
  const tok = await issueSession("abc123");
  assert.strictEqual(await requireSession(req(tok)), "abc123");
});

test("une session falsifiée est refusée", async () => {
  const tok = await issueSession("abc123");
  const forged = tok.slice(0, -4) + "AAAA";
  await assert.rejects(requireSession(req(forged)), /Session expirée/);
  await assert.rejects(requireSession(req(null)), /Non connecté/);
});

test("l'identifiant utilisateur est stable et dépend du fournisseur", () => {
  assert.strictEqual(userIdFor("google", "1"), userIdFor("google", "1"));
  assert.notStrictEqual(userIdFor("google", "1"), userIdFor("apple", "1"));
  assert.strictEqual(userIdFor("google", "1").length, 32);
});

test("un fournisseur non configuré est refusé", async () => {
  process.env.GOOGLE_CLIENT_ID = "";
  await assert.rejects(verifyIdToken("google", "a.b.c"), /non configurée/);
  await assert.rejects(verifyIdToken("facebook", "a.b.c"), /inconnu/);
});
