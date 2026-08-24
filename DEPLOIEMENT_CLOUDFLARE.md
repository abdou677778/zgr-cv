# Déploiement de l'API ZGR CV avec Cloudflare Worker et R2

## Architecture

- GitHub Pages : application Vite statique.
- `cloudflare/worker.js` : API privée Cloudflare Worker.
- `CLIENTS_BUCKET` : binding R2 pour les clients, comptes, audits et secrets IA
  chiffrés, séparés par préfixes.
- `ADMIN_USERNAME` : nom du compte administrateur d’amorçage.
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

Il n’existe aucune inscription publique. Seul l’administrateur crée les profils et
réinitialise leurs mots de passe. Au premier accès, le mot de passe d’amorçage est
converti en enregistrement PBKDF2-SHA256 dans R2. La session HMAC expire après
12 heures et contient une version permettant sa révocation après modification du
mot de passe ou désactivation du profil.

Les clés `GEMINI_API_KEYS` et `OPENROUTER_API_KEYS` restent invisibles. Les clés
ajoutées par l’administrateur dans l’interface sont chiffrées AES-GCM dans R2 à
partir de `SESSION_SECRET`; leur valeur n’est jamais retournée au navigateur. Les
secrets ne doivent jamais être préfixés par `VITE_`, car toute variable Vite est
publique dans le navigateur.

## Développement local

Le fichier HTML autonome continue d'utiliser IndexedDB pour ses données locales.
Pour tester l'API distante depuis Vite, utiliser une origine locale explicitement
autorisée et l'endpoint du Worker.
