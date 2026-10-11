# JLPT Étude — N1

Site d’étude quotidienne pour le JLPT : **漢字 Kanji · 語彙 Vocabulaire · 文法 Grammaire**.
Version web d’abord ; une application iPhone viendra ensuite, branchée sur la même API et les mêmes comptes.

- **Site** : https://jlpt.simondepussay.com (ancienne adresse https://purple-flower-00ac22900.5.azurestaticapps.net : bandeau de déménagement)
- **Comptes** : connexion avec Google, Apple ou Microsoft. Aucun mot de passe n’est stocké. On peut aussi utiliser le site sans compte : la progression reste alors dans le navigateur, puis elle est ajoutée au compte à la première connexion.

## Comment ça marche

**Au premier lancement**, tu choisis ta session JLPT, tes jours d’étude par semaine et ton temps maximum par jour (modifiable dans *Réglages*).

**Chaque jour, une leçon est préparée automatiquement :**

| Étape | Contenu |
|---|---|
| 1. Réviser | Les éléments dus aujourd’hui (répétition espacée) |
| 2. Apprendre | Les nouveaux éléments du jour : une fiche, puis une vérification immédiate. Le bouton « Déjà connu » permet de passer ce que tu sais déjà |
| 3. Tester | Des questions de style JLPT (漢字読み, 文法形式の判断, 文の組み立て ★…) |
| 4. Rattrapage | Ce qui a été raté pendant la leçon revient à la fin (jusqu’à 3 fois) |

- **Nouveaux éléments par jour** = éléments restants ÷ jours d’étude disponibles avant l’objectif. L’objectif est fixé 2 semaines avant l’examen (réglable), pour garder ces semaines pour la révision finale.
- **Durée estimée** : le temps réel passé sur chaque type de carte est mesuré et l’estimation s’ajuste.
- **Rythme réel** : si tu étudies nettement moins de jours que prévu (sur 4 semaines), l’appli te le signale et propose d’adapter les leçons.
- **Suis-je dans les temps ?** La page *Progression* donne une date de fin prévue par module et la compare à l’objectif.

Raccourcis pendant une leçon : `1`–`4` pour répondre ou noter une carte, `Entrée` / `Espace` pour continuer.

## Langue

Le japonais est toujours affiché. Tout le reste (interface, explications, traductions, sens des mots et des kanji) est **entièrement en français ou entièrement en anglais**, au choix : sélecteur FR / EN dans l’en-tête, au premier lancement et dans *Réglages*.

## Contenu N1

- **Vocabulaire** : 3 315 mots (liste Coto Academy, sans les 161 mots déjà présents dans les listes N2–N5), sens en français et en anglais
- **Kanji** : 1 232 kanji (lectures on/kun), sens en français et en anglais, reliés aux mots qui les contiennent
- **Grammaire** : 90 points, en français et en anglais : explication, exemples traduits, pièges, QCM et phrases à ordonner (toutes les phrases sont traduites)
  - 1–50 : liste de la vidéo (pas de n°30 ; le n°34 « 〜とこと » a été interprété comme **〜ところを**)
  - 51–91 : compléments de la liste Coto
- Bouton « Pas du N1 » : écarte un mot ou un kanji mal classé (filtre « Retirés » pour le remettre)
- `Fiches-grammaire-N1.html` : fiches imprimables (`?lang=en` pour l’anglais)

## Architecture

```
jlpt-etude/
├── web/                      ← site statique (Azure Static Web Apps)
│   ├── index.html
│   ├── Fiches-grammaire-N1.html
│   ├── staticwebapp.config.json   (en-têtes de sécurité, runtime de l’API)
│   ├── app/   core.js (planning, répétition espacée, synchro) · exercices.js · ui.js · compte.js · config.js · style.css
│   └── data/  n1-vocab.js · n1-kanji.js · n1-grammaire.js (+ -en, -trad, -trad-en) · n1-vocab-fr.js · n1-kanji-fr.js
├── api/                      ← Azure Functions (Node 20), déployées avec le site
│   └── src/  functions/api.js · lib/auth.js · lib/store.js
├── outils/import_coto.py     ← regénère web/data depuis l’Excel Coto
├── outils/fusion_fr.js       ← fusionne un lot de sens français (index<TAB>sens) dans n1-vocab-fr.js
└── .github/workflows/deploy.yml   ← tests + déploiement à chaque push sur main
```

**API** (préfixe `/api`, session dans l’en-tête `x-jlpt-session`) :

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/auth/login` | `{ provider, idToken, nonce }` → vérifie le jeton Google / Apple / Microsoft, renvoie une session de 60 jours |
| GET / DELETE | `/me` | profil / suppression du compte et de toutes les données |
| GET | `/progress/N1` | progression `{ data, etag }` (204 si vide) |
| PUT | `/progress/N1` | enregistre ; `If-Match: <etag>` (ou `x-create: 1`) ; 412 + version serveur en cas de conflit, le client fusionne et réessaie |

L’appli iPhone utilisera exactement ces routes (Sign in with Apple natif → `POST /auth/login` avec `provider: "apple"`).

**Azure** (abonnement Azure for Students, groupe `rg-jlpt-etude`, région East Asia) :
- Static Web App `jlpt-etude` (offre gratuite) : site + API
- Compte de stockage `jlptetude6e6657` : conteneur privé `jlpt`, un dossier par utilisateur (`users/<id>/profile.json`, `users/<id>/progress-N1.json`)
- Paramètres de l’application : `STORAGE_CONNECTION`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_IDS`, `MICROSOFT_CLIENT_ID`

## Activer la connexion

Pour chaque fournisseur, il faut un identifiant client, à renseigner à **deux endroits** : `web/app/config.js` (côté site) et le paramètre de l’application Azure correspondant (côté API).

**Google**
1. https://console.cloud.google.com → créer un projet « JLPT Étude » → *API et services* → *Écran de consentement OAuth* (externe)
2. *Identifiants* → *Créer des identifiants* → *ID client OAuth* → type **Application Web**
3. *Origines JavaScript autorisées* : `https://jlpt.simondepussay.com` et `https://purple-flower-00ac22900.5.azurestaticapps.net` (ancienne adresse) (+ `http://localhost:8765` pour les tests)
4. Copier l’ID client (`xxxx.apps.googleusercontent.com`)

**Apple** (compte Apple Developer)
1. *Identifiers* → **Services IDs** → nouveau, par ex. `com.simondepussay.jlpt.web`, activer *Sign in with Apple*
2. *Configure* : domaine `jlpt.simondepussay.com`, URL de retour `https://jlpt.simondepussay.com/`
3. L’identifiant à utiliser est le Services ID. Pour l’appli iPhone plus tard, ajouter aussi son bundle ID dans `APPLE_CLIENT_IDS` (séparés par des virgules).

**Microsoft**
1. Portail Azure → *Inscriptions d’applications* → nouvelle → « Comptes dans un annuaire organisationnel et comptes Microsoft personnels »
2. Plateforme **Application monopage (SPA)** ou Web, URI de redirection `https://jlpt.simondepussay.com/`, cocher **Jetons d’ID**
3. Copier l’ID d’application (client)

Puis :
```
az staticwebapp appsettings set -n jlpt-etude -g rg-jlpt-etude --setting-names GOOGLE_CLIENT_ID=... APPLE_CLIENT_IDS=... MICROSOFT_CLIENT_ID=...
```

## Développement local

```
python3 -m http.server 8765 --directory web
```
Site seul en mode invité. Pour l’API : copier `api/local.settings.example.json` en `api/local.settings.json`, puis `cd api && npm install && func start`.

Tests de l’API : `cd api && npm test`.

## Ajouter les autres niveaux

```
python3 -m pip install openpyxl
python3 outils/import_coto.py "Coto JLPT Grammar and Vocab Mega List.xlsx" N2 N3 N4 N5
```
Il restera à écrire la grammaire de chaque niveau (format décrit en haut de `web/data/n1-grammaire.js`) et à ajouter un sélecteur de niveau ; l’API gère déjà `N1` à `N5`.
