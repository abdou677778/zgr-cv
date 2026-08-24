# Déploiement de l'API ZGR CV avec Cloudflare Worker et R2

## Architecture

- GitHub Pages : application Vite statique.
- `cloudflare/worker.js` : API privée Cloudflare Worker.
- `CLIENTS_BUCKET` : binding R2 qui stocke uniquement `clients/<ID>.json`.
- `ADMIN_USERNAME` : variable non secrète correspondant au compte unique.
- `ADMIN_PASSWORD` et `SESSION_SECRET` : secrets d'authentification serveur.
- `GEMINI_API_KEYS` et `OPENROUTER_API_KEYS` : tableaux JSON de clés, côté serveur.

## Configuration

1. Créer un bucket R2 nommé `zgr-cv-clients`.
2. Déployer le Worker défini dans `wrangler.worker.jsonc`.
3. Ajouter le binding R2 `CLIENTS_BUCKET` vers `zgr-cv-clients`.
4. Définir `ADMIN_PASSWORD` et une valeur aléatoire d'au moins 40 caractères pour
   `SESSION_SECRET` avec `wrangler secret put`.
5. Définir `GEMINI_API_KEYS` et `OPENROUTER_API_KEYS` sous forme de tableaux JSON.
6. Autoriser uniquement l'origine GitHub Pages et les origines locales de développement.
7. Tester `/health`, la connexion, la synchronisation R2 et les deux fournisseurs IA.

L'API ne propose aucune inscription, création d'utilisateur ou récupération de mot
de passe. La session HMAC expire après 12 heures. Les secrets ne doivent jamais être
préfixés par `VITE_`, car toute variable Vite est publique dans le navigateur.

## Développement local

Le fichier HTML autonome continue d'utiliser IndexedDB pour ses données locales.
Pour tester l'API distante depuis Vite, utiliser une origine locale explicitement
autorisée et l'endpoint du Worker.
