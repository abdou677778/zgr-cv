# CV PRO TEAM — Portail clients

Portail séparé de ZGR CV pour recevoir les commandes et leurs documents. L’accès client se fait uniquement par un lien d’invitation à usage unique créé depuis la fenêtre **Commandes** de ZGR CV.

## Parcours opérationnel

1. Créer un lien client dans ZGR CV.
2. Le client sélectionne les services, ajoute ses consignes et transfère ses fichiers.
3. La commande apparaît dans ZGR CV, triée par date.
4. Télécharger le **Pack IA ZIP** contenant le brief, les sources et le prompt maître.
5. Importer le JSON produit par l’IA. Chaque import crée une version conservée.
6. Ouvrir cette version directement dans le générateur ZGR CV.

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

Le jeton Google doit autoriser la création et la mise à jour des fichiers dans Drive. Les secrets ne doivent jamais être placés dans le code, GitHub Pages ou une variable `VITE_*`.

## Liaison avec ZGR CV

Configurer dans le Worker principal :

- `CLIENT_PORTAL_API_URL` : URL du portail, sans slash final.
- `CLIENT_PORTAL_ADMIN_TOKEN` : la même valeur que `ADMIN_API_TOKEN`.

Le navigateur n’accède jamais directement au secret du portail : le Worker ZGR CV sert de proxy protégé par la session administrateur existante.

## Vérifications locales

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Les fichiers sont limités à 100 Mo chacun, 50 fichiers et 500 Mo par commande. Les formats acceptés sont PDF, DOC/DOCX, JPG/JPEG, PNG, WebP et HEIC/HEIF.
