/* JLPT Étude — connexion (Google, Apple, Microsoft). */
(function () {
  const J = window.J;
  const C = window.JLPT_CONFIG || {};

  const loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = res;
    s.onerror = () => rej(new Error("Impossible de charger " + new URL(src).host));
    document.head.appendChild(s);
  });
  const randomHex = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); };

  J.providers = [
    { id: "google", label: "Continuer avec Google", enabled: !!C.googleClientId },
    { id: "apple", label: "Continuer avec Apple", enabled: !!C.appleClientId },
    { id: "microsoft", label: "Continuer avec Microsoft", enabled: !!C.microsoftClientId }
  ];
  J.authReady = J.providers.some((p) => p.enabled);

  let onDone = () => {};
  let onError = () => {};
  J.onAuth = (done, err) => { onDone = done; onError = err; };

  async function finish(provider, idToken, nonce, name) {
    try { await J.login(provider, idToken, nonce, name); onDone(); }
    catch (e) { onError(e); }
  }

  /* Google : bouton officiel (Google Identity Services) */
  J.mountGoogle = async function (el) {
    if (!el || !C.googleClientId) return;
    try {
      await loadScript("https://accounts.google.com/gsi/client");
      const nonce = randomHex();
      google.accounts.id.initialize({
        client_id: C.googleClientId,
        nonce,
        ux_mode: "popup",
        callback: (r) => finish("google", r.credential, nonce)
      });
      google.accounts.id.renderButton(el, { theme: "outline", size: "large", text: "continue_with", locale: "fr", width: 280 });
    } catch (e) { onError(e); }
  };

  /* Apple : fenêtre surgissante Sign in with Apple JS */
  J.signInApple = async function () {
    try {
      await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/fr_FR/appleid.auth.js");
      const nonce = randomHex();
      AppleID.auth.init({ clientId: C.appleClientId, scope: "name email", redirectURI: location.origin + "/", usePopup: true, nonce, state: randomHex() });
      const res = await AppleID.auth.signIn();
      const n = res.user && res.user.name ? [res.user.name.firstName, res.user.name.lastName].filter(Boolean).join(" ") : null;
      await finish("apple", res.authorization.id_token, nonce, n);
    } catch (e) {
      if (e && e.error === "popup_closed_by_user") return;
      onError(e instanceof Error ? e : new Error("Connexion Apple annulée"));
    }
  };

  /* Microsoft : redirection OpenID Connect (jeton d'ID dans le fragment d'URL) */
  J.signInMicrosoft = function () {
    const nonce = randomHex(), state = randomHex();
    sessionStorage.setItem("jlpt-ms", JSON.stringify({ nonce, state }));
    const q = new URLSearchParams({
      client_id: C.microsoftClientId,
      response_type: "id_token",
      redirect_uri: location.origin + "/",
      scope: "openid email profile",
      response_mode: "fragment",
      prompt: "select_account",
      nonce, state
    });
    location.href = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + q;
  };
  /* Retour de Microsoft : à appeler au démarrage */
  J.handleRedirect = async function () {
    if (!location.hash.includes("id_token=") && !location.hash.includes("error=")) return false;
    const h = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, "", location.pathname);
    const saved = JSON.parse(sessionStorage.getItem("jlpt-ms") || "null");
    sessionStorage.removeItem("jlpt-ms");
    if (h.get("error")) { onError(new Error(h.get("error_description") || "Connexion Microsoft annulée")); return true; }
    if (!saved || saved.state !== h.get("state")) { onError(new Error("Réponse Microsoft inattendue, réessaie.")); return true; }
    await finish("microsoft", h.get("id_token"), saved.nonce);
    return true;
  };
})();
