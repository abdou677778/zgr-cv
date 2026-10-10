# Migration des archives OneDrive vers ZGR CV et Google Drive

## Résultat attendu

La migration copie chaque dossier client OneDrive vers une fiche `Archive 2022–2025` de ZGR CV. La plateforme crée ensuite le dossier Google Drive structuré du client :

```text
ANNÉE/
  MOIS/
    DATE_ID_NOM_CLIENT/
      00_COMMANDE/
      01_DOCUMENTS_SOURCES/
        CAPTURE_FACEBOOK/
        INFOS_CLIENT/
        LIVRABLE_HISTORIQUE/
        AUTRES_ARCHIVES/
      02_TRAITEMENT_IA/
      03_PRODUCTION/
      04_LIVRABLES/
      05_ARCHIVES/
```

L’opération est une **copie**. Elle ne supprime et ne déplace jamais les originaux OneDrive.

## Pourquoi le transfert passe par ZGR CV

Une copie directe `rclone OneDrive -> Google Drive` transférerait les fichiers, mais ne créerait ni les fiches clients dans D1, ni les catégories visibles dans la section Archive, ni l’historique de migration. Le script utilise donc OneDrive comme source, l’API administrateur ZGR comme registre et R2 comme zone privée, puis demande à la plateforme de synchroniser son Google Drive configuré.

## Garanties de date et de reprise

- `modifiedAt` de chaque fichier OneDrive est conservé dans D1 et appliqué au fichier Google Drive.
- La date d’import reste distincte de la date source.
- La date de commande proposée est celle du fichier le plus ancien du dossier. Elle est marquée comme **inférée** et doit être acceptée explicitement ou corrigée dans le manifeste.
- Une clé `migrationKey` stable empêche de recréer une deuxième fiche client après une coupure.
- Après chaque fichier, le manifeste est sauvegardé. Une relance reprend au fichier suivant.
- Les fichiers déjà présents avec le même SHA-256 sont traités comme doublons et ne sont pas réimportés.
- La synchronisation Google Drive se fait par lots de 10 fichiers avec un curseur sauvegardé ; une coupure reprend au dernier lot confirmé.
- Les dossiers `Waiting for payment`, `Rejected`, `Annuler` et équivalents sont exclus automatiquement de l’archive des commandes terminées.
- Les fichiers de zéro octet sont consignés dans `skippedFiles` et ne sont jamais envoyés.

> La date affichée sur un dossier OneDrive peut correspondre à un déplacement ou à un repartage. Pour cette raison, le script ne l’utilise pas comme preuve de date de commande.

## 1. Préparer l’accès OneDrive

Le lien public seul permet la consultation, mais Microsoft Graph demande un jeton OAuth pour une lecture récursive stable. Dans le compte Microsoft propriétaire ou autorisé :

1. Ouvrir le dossier partagé.
2. Choisir **Ajouter un raccourci à Mes fichiers** si le dossier se trouve dans « Partagé avec moi ».
3. Installer `rclone` depuis <https://rclone.org/downloads/>.
4. Exécuter `rclone config` et créer un remote nommé `onedrive` avec le compte Microsoft autorisé.
5. Vérifier le chemin sans télécharger :

```powershell
rclone lsd onedrive:
rclone lsd "onedrive:CHEMIN/DU/DOSSIER"
```

Ne jamais placer les jetons rclone, Microsoft ou Google dans Git.

## 2. Générer l’inventaire sans écrire dans ZGR

```powershell
npm run archive:scan -- `
  --source "onedrive:CHEMIN/01 - ABDOU" `
  --manifest ".zgr-migrations/archive-2022-2025.json"
```

Le manifeste contient, pour chaque client : nom proposé, services détectés, date inférée, fichiers, chemins, tailles, catégories, dates source et décision d’éligibilité. Un rapport CSV `*.review.csv` est généré à côté du manifeste pour contrôler les dates et exclusions sans modifier le JSON à l’aveugle.

Pour tester le mécanisme sans compte ni données réelles :

```powershell
npm run archive:scan -- `
  --source "onedrive:EXEMPLE" `
  --inventory "scripts/fixtures/archive-rclone-lsjson.sample.json" `
  --manifest ".zgr-migrations/test.json"
```

## 3. Contrôler le manifeste

Vérifier au minimum :

- `clientName` ;
- `archiveDate` ;
- `services` ;
- les archives qui dépassent 500 fichiers ou 500 Mo ;
- les fichiers individuels qui dépassent 100 Mo ;
- les dossiers homonymes qui pourraient appartenir au même client.

La limite du formulaire public reste fixée à 50 fichiers. Seules les archives administrateur authentifiées peuvent aller jusqu’à 500 fichiers.

Pour confirmer manuellement une date, conserver la date ISO `AAAA-MM-JJ` et définir :

```json
{
  "archiveDate": "2023-08-27",
  "dateConfirmed": true
}
```

Contrôle sans import :

```powershell
npm run archive:migrate -- `
  --manifest ".zgr-migrations/archive-2022-2025.json"
```

## 4. Lancer la copie réelle

Le secret administrateur doit être fourni uniquement dans la session PowerShell courante :

```powershell
$env:ZGR_ARCHIVE_ADMIN_TOKEN="VOTRE_SECRET_ADMIN"
npm run archive:migrate -- `
  --manifest ".zgr-migrations/archive-2022-2025.json" `
  --execute `
  --accept-inferred-dates `
  --actor "nom-utilisateur" `
  --continue-on-error
Remove-Item Env:ZGR_ARCHIVE_ADMIN_TOKEN
```

Omettre `--accept-inferred-dates` oblige à confirmer chaque date dans le manifeste. C’est la méthode recommandée quand la date exacte de commande est disponible.

## 5. Vérification finale

Pour chaque client terminé :

1. le manifeste indique `status: "completed"` ;
2. `orderId` et `driveFolderId` sont renseignés ;
3. la fiche apparaît dans **Administration > Base de données > Archive 2022–2025** ;
4. les fichiers affichent leur chemin et leur date d’origine ;
5. le dossier Google Drive est privé et suit la structure ZGR.

Conserver le manifeste final comme journal technique privé de la migration. Le dossier `.zgr-migrations/` est ignoré par Git.

## Limites et décisions de sécurité

- Le script refuse une date hors 2022–2025.
- Il s’arrête avant l’écriture si une limite de fichier est dépassée.
- Les transferts sont séquentiels pour réduire les erreurs de quota et faciliter la reprise.
- Les envois Google Drive sont découpés en lots de 10 pour rester sous les limites de sous-requêtes Cloudflare.
- Les erreurs 429 et 5xx sont réessayées avec attente progressive.
- Aucun partage public Google Drive n’est créé par cette migration.
- La migration ne lit pas le contenu des documents pour déduire des données personnelles ; elle se limite aux noms, chemins, tailles et dates nécessaires au classement.
