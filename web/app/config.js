/* Identifiants publics des fournisseurs de connexion (ce ne sont pas des secrets).
   Laisse vide un fournisseur pour masquer son bouton.
   - googleClientId    : Google Cloud Console → API et services → Identifiants → ID client OAuth (type « Application Web »)
   - appleClientId     : Apple Developer → Identifiers → Services ID (Sign in with Apple)
   - microsoftClientId : Azure Portal → Inscriptions d'applications (comptes personnels + professionnels, jetons d'ID activés)
   Les mêmes valeurs doivent être renseignées côté API (paramètres de l'application Azure). */
window.JLPT_CONFIG = {
  googleClientId: "214657172277-4qfioc2rldsldl2tt35vsqaoaf787a0m.apps.googleusercontent.com",
  appleClientId: "",
  microsoftClientId: ""
};
