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
- Secret : `ZGR_SYNC_TOKEN`

Le Worker applique une origine CORS explicite, une authentification Bearer, une
comparaison de jeton en temps constant, une limite JSON de 5 Mo et des journaux
Cloudflare. Le jeton n’est jamais inclus dans le dépôt ni dans le build public.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` compile `dist-spa` à chaque push
sur `main`, puis publie l’artefact avec GitHub Pages. La configuration Vite utilise
des chemins relatifs pour fonctionner depuis un sous-dossier `github.io`.

## Utilisation de la sauvegarde

Dans **Base de données > Sauvegarde Cloudflare R2** :

1. L’endpoint est préconfiguré dans le build GitHub Pages.
2. Saisir le jeton de synchronisation privé.
3. Cliquer sur **Synchroniser maintenant**.

Le jeton reste limité à la session de l’onglet. Les profils plus récents sont
envoyés vers R2 et les versions distantes plus récentes sont récupérées localement.

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
