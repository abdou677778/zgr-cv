# CV PRO TEAM — Portail clients

Portail séparé de ZGR CV pour recevoir les commandes et leurs documents. L’accès client se fait uniquement par un lien privé créé depuis la fenêtre **Commandes** de ZGR CV. Ce lien reste valable exactement 5 jours et permet au client de rouvrir, modifier puis reconfirmer son dossier pendant cette période.

## Parcours opérationnel

1. Créer un lien client dans ZGR CV.
2. Le client sélectionne les services, ajoute ses consignes et transfère ses fichiers.
3. La commande apparaît dans ZGR CV, triée par date.
4. Compléter au besoin le lien Facebook et ajouter manuellement tout fichier utile au dossier.
5. Télécharger le **Pack IA ZIP** contenant le brief, les sources et le prompt maître.
6. Importer le JSON produit par l’IA. Chaque import crée une version conservée.
7. Ouvrir cette version directement dans le générateur ZGR CV.

## Stockage

- D1 : commandes, invitations, métadonnées, événements et versions JSON.
- R2 : fichiers sources et JSON versionnés.
- Google Drive : copie organisée par année, mois et commande lorsque les identifiants OAuth sont configurés.

## Variables privées du portail

Copier `.env.example` vers un fichier local ignoré puis renseigner :

- `ADMIN_API_TOKEN` : secret long partagé uniquement avec le Worker ZGR CV.
- `NEXT_PUBLIC_SITE_URL` : URL publique finale du portail.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` : autorisation OAuth Google Drive du compte de production.
- `GOOGLE_DRIVE_ROOT_FOLDER_ID` : identifiant du dossier racine dédié, par exemple `CV PRO TEAM — COMMANDES`.
- `MCP_API_TOKEN` : jeton historique réservé au plugin personnel local. Ne pas
  le conserver lorsque le serveur public OAuth est activé.
- `MCP_FILE_SIGNING_SECRET` : secret long indépendant utilisé pour signer les
  liens documentaires temporaires.
- `MCP_OAUTH_ISSUER` : URL canonique de l’émetteur OAuth/OIDC (Auth0 ou autre
  fournisseur compatible OAuth 2.1).
- `MCP_OAUTH_AUDIENCE` : audience exacte de l’API, normalement
  `https://cv-pro-team-clients.zgrcv-wizi.workers.dev/api/mcp`.

Le jeton Google doit autoriser la création et la mise à jour des fichiers dans Drive. Les secrets ne doivent jamais être placés dans le code, GitHub Pages ou une variable `VITE_*`.

## Liaison avec ZGR CV

Configurer dans le Worker principal :

- `CLIENT_PORTAL_API_URL` : URL du portail, sans slash final.
- `CLIENT_PORTAL_ADMIN_TOKEN` : la même valeur que `ADMIN_API_TOKEN`.

Le navigateur n’accède jamais directement au secret du portail : le Worker ZGR CV sert de proxy protégé par la session administrateur existante.

## Plugin MCP ZGR CV

Le serveur MCP distant est exposé sur `/api/mcp`. Il permet de rechercher une
commande, lire son brief et ses documents avec des liens privés de 15 minutes,
charger le prompt maître, consulter une version JSON et enregistrer une nouvelle
version validée.

En développement personnel, configurer `MCP_API_TOKEN` comme secret Cloudflare et
fournir la même valeur dans `ZGR_CV_MCP_TOKEN`. En publication, configurer
`MCP_OAUTH_ISSUER`, `MCP_OAUTH_AUDIENCE` et `MCP_FILE_SIGNING_SECRET`, puis retirer
`MCP_API_TOKEN`. Le fournisseur OAuth doit émettre des jetons RS256 pour l’audience
MCP avec les permissions `zgr:orders:read` et `zgr:orders:write`. Le serveur publie
ses métadonnées sur `/.well-known/oauth-protected-resource` et vérifie signature,
émetteur, audience, expiration et permissions à chaque appel.

Les pages publiques nécessaires à la revue se trouvent aux adresses
`/privacy.html`, `/terms.html` et `/mcp-support.html`. Aucun identifiant de
démonstration ni secret ne doit être commité : les fournir exclusivement dans le
portail de soumission OpenAI.

## Vérifications locales

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Les fichiers sont limités à 100 Mo chacun, 50 fichiers et 500 Mo par commande. Le formulaire client accepte PDF, DOC/DOCX, JPG/JPEG, PNG, WebP et HEIC/HEIF. L’équipe peut ensuite joindre manuellement tout autre type de fichier depuis ZGR CV ; le téléchargement reste forcé en pièce jointe privée.
