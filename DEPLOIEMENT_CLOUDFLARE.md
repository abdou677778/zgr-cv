# Déploiement ZGR CV avec Cloudflare Pages et R2

## Architecture

- `dist-spa/` : application Vite statique.
- `functions/api/clients/` : API privée Cloudflare Pages Functions.
- `CLIENTS_BUCKET` : binding R2 qui stocke uniquement `clients/<ID>.json`.
- `ZGR_SYNC_TOKEN` : secret serveur obligatoire, jamais placé dans Git ou dans le HTML.

## Configuration

1. Créer un bucket R2 nommé `zgr-cv-clients`.
2. Créer un projet Cloudflare Pages relié au dépôt Git.
3. Utiliser `npm run build:spa` comme commande et `dist-spa` comme dossier de sortie.
4. Ajouter le binding R2 `CLIENTS_BUCKET` vers `zgr-cv-clients`.
5. Ajouter le secret `ZGR_SYNC_TOKEN` avec une valeur aléatoire d’au moins 32 caractères.
6. Redéployer le projet.
7. Dans **Base de données → Sauvegarde Cloudflare R2**, conserver `/api/clients` et saisir le jeton uniquement pour la session.

Pour une protection supplémentaire, placer le site derrière Cloudflare Access avec votre adresse
email autorisée. Le jeton reste requis par l’API même si Access est mal configuré.

## Développement local

Le fichier HTML autonome continue d’utiliser IndexedDB sans serveur. Pour tester R2 et les Functions,
utiliser Wrangler Pages en local avec un bucket simulé ou distant selon la documentation Cloudflare.
