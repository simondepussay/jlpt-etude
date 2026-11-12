/* JLPT Étude — connexion (Google, Apple, Microsoft, compte Clean Work). */
(function () {
  const J = window.J;
  const C = window.JLPT_CONFIG || {};

  const loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = res;
    s.onerror = () => rej(new Error(J.L("Impossible de charger ", "Could not load ") + new URL(src).host));
    document.head.appendChild(s);
  });
  const randomHex = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); };

  J.providers = [
    { id: "google", label: "Continuer avec Google", enabled: !!C.googleClientId },
    { id: "apple", label: "Continuer avec Apple", enabled: !!C.appleClientId },
    { id: "microsoft", label: "Continuer avec Microsoft", enabled: !!C.microsoftClientId },
    { id: "cleanwork", label: "Continuer avec Clean Work", enabled: !!(C.cleanwork && C.cleanwork.clientId) }
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
      google.accounts.id.renderButton(el, { theme: "outline", size: "large", text: "continue_with", locale: J.lang(), width: 280 });
    } catch (e) { onError(e); }
  };

  /* Apple : fenêtre surgissante Sign in with Apple JS */
  J.signInApple = async function () {
    try {
      await loadScript(`https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/${J.lang() === "fr" ? "fr_FR" : "en_US"}/appleid.auth.js`);
      const nonce = randomHex();
      AppleID.auth.init({ clientId: C.appleClientId, scope: "name email", redirectURI: location.origin + "/", usePopup: true, nonce, state: randomHex() });
      const res = await AppleID.auth.signIn();
      const n = res.user && res.user.name ? [res.user.name.firstName, res.user.name.lastName].filter(Boolean).join(" ") : null;
      await finish("apple", res.authorization.id_token, nonce, n);
    } catch (e) {
      if (e && e.error === "popup_closed_by_user") return;
      onError(e instanceof Error ? e : new Error(J.L("Connexion Apple annulée", "Apple sign-in cancelled")));
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
  /* Clean Work : même annuaire que cleanwork.simondepussay.com (code d'autorisation + PKCE).
     Sans « prompt » : si la personne est déjà connectée à Clean Work dans ce navigateur,
     l'annuaire la reconnaît et la renvoie ici sans rien demander.
     mode « link » : associe le compte Clean Work au compte JLPT Étude déjà ouvert. */
  const CW = C.cleanwork || {};
  const cwBase = () => `https://${CW.tenant}.ciamlogin.com/${CW.tenantId}/oauth2/v2.0`;
  const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  J.signInCleanWork = async function (mode = "login") {
    try {
      const nonce = randomHex(), state = randomHex();
      const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
      sessionStorage.setItem("jlpt-cw", JSON.stringify({ nonce, state, verifier, mode }));
      const q = new URLSearchParams({
        client_id: CW.clientId,
        response_type: "code",
        redirect_uri: location.origin + "/",
        scope: "openid profile email",
        response_mode: "fragment",
        code_challenge: challenge,
        code_challenge_method: "S256",
        nonce, state
      });
      location.href = cwBase() + "/authorize?" + q;
    } catch (e) { onError(e); }
  };
  async function finishCleanWork(h, saved) {
    if (h.get("error")) throw new Error(h.get("error_description") || J.L("Connexion Clean Work annulée", "Clean Work sign-in cancelled"));
    if (saved.state !== h.get("state") || !h.get("code")) throw new Error(J.L("Réponse Clean Work inattendue, réessaie.", "Unexpected Clean Work response, please try again."));
    const r = await fetch(cwBase() + "/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CW.clientId, grant_type: "authorization_code", code: h.get("code"), redirect_uri: location.origin + "/", code_verifier: saved.verifier, scope: "openid profile email" })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body.id_token) throw new Error(body.error_description || J.L("Clean Work n’a pas confirmé la connexion.", "Clean Work did not confirm the sign-in."));
    if (saved.mode === "link") { await J.linkAccount("cleanwork", body.id_token, saved.nonce); onDone("linked"); }
    else await finish("cleanwork", body.id_token, saved.nonce);
  }

  /* Retour de Microsoft ou de Clean Work : à appeler au démarrage */
  J.handleRedirect = async function () {
    const cw = JSON.parse(sessionStorage.getItem("jlpt-cw") || "null");
    if (cw && (location.hash.includes("code=") || location.hash.includes("error="))) {
      const h = new URLSearchParams(location.hash.slice(1));
      history.replaceState(null, "", location.pathname);
      sessionStorage.removeItem("jlpt-cw");
      try { await finishCleanWork(h, cw); } catch (e) { onError(e); }
      return true;
    }
    if (!location.hash.includes("id_token=") && !location.hash.includes("error=")) return false;
    const h = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, "", location.pathname);
    const saved = JSON.parse(sessionStorage.getItem("jlpt-ms") || "null");
    sessionStorage.removeItem("jlpt-ms");
    if (h.get("error")) { onError(new Error(h.get("error_description") || J.L("Connexion Microsoft annulée", "Microsoft sign-in cancelled"))); return true; }
    if (!saved || saved.state !== h.get("state")) { onError(new Error(J.L("Réponse Microsoft inattendue, réessaie.", "Unexpected Microsoft response, please try again."))); return true; }
    await finish("microsoft", h.get("id_token"), saved.nonce);
    return true;
  };
})();
