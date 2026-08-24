# Déploiement ZGR CV

## Architecture de production

- **GitHub Pages** héberge uniquement l’interface statique.
- **Cloudflare Worker** expose l’API privée de synchronisation.
- **Cloudflare R2** stocke les JSON clients, les comptes hachés, le journal
  d’audit et les clés IA ajoutées depuis l’interface sous forme chiffrée.
- Les PDF restent générés dans le navigateur et ne sont pas envoyés dans R2.

## Ressources Cloudflare

- Worker : `zgr-cv-storage-api`
- Endpoint : `https://zgr-cv-storage-api.zgrcv-wizi.workers.dev/api/clients`
- Bucket privé : `zgr-cv-clients`
- Binding : `CLIENTS_BUCKET`
- Compte initial : administrateur d’amorçage, puis gestion de profils depuis
  **Paramètres du compte**
- Secrets Worker : `ADMIN_PASSWORD`, `SESSION_SECRET`, `GEMINI_API_KEYS` et
  `OPENROUTER_API_KEYS`

Le Worker applique une origine CORS explicite, une session signée HMAC limitée à
7 jours, des mots de passe PBKDF2-SHA256 salés individuellement, une révocation
immédiate des sessions, une limite JSON de 5 Mo et un journal d’audit R2. Les mots
de passe et les clés IA ne sont jamais inclus dans le dépôt, le build public ou le
stockage local du navigateur.

## Publication GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` compile `dist-spa` à chaque push
sur `main`, puis publie l’artefact avec GitHub Pages. La configuration Vite utilise
des chemins relatifs pour fonctionner depuis un sous-dossier `github.io`. Les
moteurs PDF et leurs grandes polices sont chargés à la demande afin de garder la
connexion et l’interface initiale légères. Le générateur autonome désactive cette
division et conserve toutes les ressources dans son fichier HTML unique.

## Utilisation de la sauvegarde

Après la connexion avec un profil actif, ouvrir **Base de données** :

1. L’endpoint est préconfiguré dans le build GitHub Pages.
2. Cliquer sur **Synchroniser maintenant**.

La session est persistante, partagée entre les onglets du même navigateur et peut
rester active simultanément sur plusieurs navigateurs, ordinateurs et téléphones.
Chaque appareil possède son propre jeton signé. Une modification de mot de passe,
de rôle ou d’état révoque les anciens jetons du profil. Les profils plus récents
sont envoyés vers R2 et les versions distantes plus récentes sont récupérées
localement. Les PDF restent locaux ; seuls les JSON clients sont sauvegardés.

Les boutons IA appellent le Worker, qui sélectionne et fait tourner les clés Gemini
ou OpenRouter côté serveur. L’administrateur peut conserver les clés d’environnement
Cloudflare ou en ajouter dans **Paramètres IA**. Une clé saisie est envoyée une seule
fois au Worker, chiffrée avec AES-GCM dans R2, puis elle n’est plus renvoyée au
navigateur.

Le panneau suit un parcours unique : **fournisseur → clé → test réel → modèles →
sauvegarde**. Une nouvelle clé n’est enregistrée que si la liste des modèles et une
génération JSON de contrôle réussissent. Un seul modèle est sélectionné par
fournisseur et partagé par son pool de clés. La priorité des clés est calculée
automatiquement ; sur quota, délai ou erreur serveur, le Worker essaie la clé
suivante, puis le fournisseur suivant si l’auto-switch est actif.

## Comptes et traçabilité

L’administrateur peut créer un profil avec le rôle **Administrateur** ou
**Utilisateur standard**, le renommer, modifier son rôle, le désactiver ou le
supprimer, et réinitialiser son mot de passe. Un utilisateur standard n’accède ni
à la gestion des profils ni aux clés API. Chaque utilisateur peut changer son
propre mot de passe. Les mots de passe sont hachés : ils ne sont jamais lisibles ni
récupérables, mais une nouvelle valeur peut être affichée pendant sa saisie. Le
journal d’audit conserve les connexions réussies ou refusées et les opérations
administratives sans enregistrer de mot de passe ni de clé API.

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
