# Déploiement ZGR CV

## Architecture de production

- **GitHub Pages** héberge uniquement l’interface statique.
- **Cloudflare Worker** expose l’API privée de synchronisation.
- **Cloudflare R2** stocke un objet JSON par client sous `clients/<ID>.json`.
- Les PDF restent générés dans le navigateur et ne sont pas envoyés dans R2.

## Ressources Cloudflare

- Worker : `zgr-cv-storage-api`
- Endpoint : `https://zgr-cv-storage-api.zgrcv-wizi.workers.dev/api/clients`
- Bucket privé : `zgr-cv-clients`
- Binding : `CLIENTS_BUCKET`
- Compte : un seul administrateur, sans inscription ni création d'utilisateur
- Secrets Worker : `ADMIN_PASSWORD`, `SESSION_SECRET`, `GEMINI_API_KEYS` et
  `OPENROUTER_API_KEYS`

Le Worker applique une origine CORS explicite, une session signée HMAC limitée à
12 heures, une comparaison en temps constant, une limite JSON de 5 Mo et des
journaux Cloudflare. Le mot de passe et les clés IA ne sont jamais inclus dans le
dépôt, le build public, le stockage local ou le navigateur.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` compile `dist-spa` à chaque push
sur `main`, puis publie l’artefact avec GitHub Pages. La configuration Vite utilise
des chemins relatifs pour fonctionner depuis un sous-dossier `github.io`.

## Utilisation de la sauvegarde

Après la connexion avec l'unique compte administrateur, ouvrir **Base de données** :

1. L’endpoint est préconfiguré dans le build GitHub Pages.
2. Cliquer sur **Synchroniser maintenant**.

La session reste limitée à l’onglet. Les profils plus récents sont envoyés vers R2
et les versions distantes plus récentes sont récupérées localement. Les PDF restent
locaux ; seuls les JSON clients sont sauvegardés.

Les boutons IA appellent le Worker, qui sélectionne et fait tourner les clés Gemini
ou OpenRouter côté serveur. Aucune clé fournisseur n'est saisie dans l'interface.

## Maintenance

```bash
npm ci
npm run lint
npm run build:spa
npm run check:worker
```

Pour redéployer le Worker avec Wrangler après authentification locale :

```bash
npx wrangler deploy --config wrangler.worker.jsonc
```

Les quatre secrets doivent être configurés dans le tableau de bord Cloudflare ou
avec `wrangler secret put`. Ne jamais placer leurs valeurs dans ce fichier.
