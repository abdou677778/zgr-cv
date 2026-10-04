# Déploiement principal ZGR CV avec Cloudflare Workers

## Architecture

- Cloudflare Workers Static Assets : application Vite statique principale.
- `cloudflare/worker.js` : API privée servie par la même origine HTTPS.
- GitHub Pages : copie de secours uniquement.
- `CLIENTS_BUCKET` : binding R2 pour les clients, comptes, audits et secrets IA
  chiffrés, séparés par préfixes.
- `ADMIN_USERNAME` : nom du compte administrateur d’amorçage.
- `ADMIN_PASSWORD` et `SESSION_SECRET` : secrets d'authentification serveur.
- `GEMINI_API_KEYS` et `OPENROUTER_API_KEYS` : tableaux JSON de clés, côté serveur.

## Adresse permanente

L'adresse de production est :

`https://zgr-cv-storage-api.zgrcv-wizi.workers.dev/`

Cette adresse reste identique après chaque modification. Il n'est pas nécessaire
d'ajouter `?release=...` ou `?refresh=...`. Le service worker et les ressources
versionnées gèrent le renouvellement du cache.

## Configuration

1. Créer un bucket R2 nommé `zgr-cv-clients`.
2. Construire l'application avec `npm run build:spa`.
3. Déployer le Worker et les ressources avec
   `npx wrangler deploy --config wrangler.worker.jsonc`.
4. Ajouter le binding R2 `CLIENTS_BUCKET` vers `zgr-cv-clients`.
5. Définir `ADMIN_PASSWORD` et une valeur aléatoire d'au moins 40 caractères pour
   `SESSION_SECRET` avec `wrangler secret put`.
6. Définir `GEMINI_API_KEYS` et `OPENROUTER_API_KEYS` sous forme de tableaux JSON.
7. Tester `/health`, la connexion, la synchronisation R2 et les deux fournisseurs IA.

## Déploiement continu GitHub

Le workflow `.github/workflows/deploy-cloudflare.yml` est prêt. Pour l'activer une
seule fois dans les paramètres du dépôt GitHub :

1. Ajouter les secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.
2. Ajouter la variable `CLOUDFLARE_DEPLOY_ENABLED` avec la valeur `true`.

Le jeton doit être limité à ce compte et disposer uniquement des droits Workers
Scripts, D1 et R2 nécessaires. La variable d'activation évite qu'un dépôt sans
secrets fasse échouer la branche principale. Chaque push validé sur `main` publie
ensuite automatiquement la même URL de production.

Il n’existe aucune inscription publique. Les profils administrateurs peuvent créer
d’autres administrateurs ou des utilisateurs standards et réinitialiser leurs mots
de passe. Les routes `/api/admin/*` vérifient le rôle côté Worker et répondent `403`
aux utilisateurs standards. Au premier accès, le mot de passe d’amorçage est
converti en enregistrement PBKDF2-SHA256 dans R2. La session HMAC expire après
7 jours et contient une version permettant sa révocation après modification du
mot de passe ou désactivation du profil. Le Worker utilise 100 000 itérations
PBKDF2, qui correspondent au plafond accepté par l’environnement Cloudflare.

Les clés `GEMINI_API_KEYS` et `OPENROUTER_API_KEYS` restent invisibles. Les clés
ajoutées par l’administrateur dans l’interface sont chiffrées AES-GCM dans R2 à
partir de `SESSION_SECRET`; leur valeur n’est jamais retournée au navigateur. Les
secrets ne doivent jamais être préfixés par `VITE_`, car toute variable Vite est
publique dans le navigateur.

`PUT /api/admin/ai-keys` vérifie désormais la clé avant stockage : récupération des
modèles compatibles puis génération JSON courte avec cette clé exacte. Les routes
de modèles et de génération parcourent le pool de clés dans l’ordre et poursuivent
automatiquement sur les réponses de quota, délai ou erreur temporaire. Le
comptage administratif déduplique les clés identiques présentes à la fois dans un
secret Cloudflare et dans le stockage chiffré R2.

## Développement local

Le fichier HTML autonome continue d'utiliser IndexedDB pour ses données locales.
Pour tester l'API distante depuis Vite, utiliser une origine locale explicitement
autorisée et l'endpoint du Worker.
