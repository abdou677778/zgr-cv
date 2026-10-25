# ZGR Tech Orders

Ajout du 25 octobre 2026. Paramètres → ZGR Tech Orders, administrateurs uniquement.
Ce module est un registre privé de ventes : il ne crée pas d’abonnement, ne prélève
aucun paiement et ne produit pas de fausse facture fournisseur.

## Utilisation

1. « Services et marges » : créer un service/formule, indiquer le prix fournisseur
   USD **pour sa période standard**, sa durée en mois, le taux DA/USD et le prix de
   vente DA pour cette même période. Les prix ne sont pas récupérés ni certifiés
   automatiquement. Le taux initial 260 est fourni par l’utilisateur, pas un cours
   officiel. Zéro est accepté explicitement pour les montants ; le taux doit être positif.
2. Choisir un logo du catalogue existant ou importer SVG/PNG/JPG/WebP (4 Mo max),
   normalisé sans déformation en PNG transparent 256 × 256. L’image et le service
   sont enregistrés dans le cloud Tech Orders. Un clic sur le logo ouvre le choix
   local : le logo est sauvegardé immédiatement, indépendamment des tarifs, y
   compris avant la première sauvegarde du nouveau service. Le service lui-même
   doit toujours être enregistré avec son nom et ses prix. Aucun logo CV n’est modifié.
   Sans remplacement Tech Orders, la version cloud déjà corrigée dans Logiciels
   est utilisée avant l’icône intégrée au catalogue.
3. Créer une vente : client, lien Facebook HTTPS optionnel, un ou plusieurs services.
   Dès la sélection, un aperçu affiche le logo, le prix catalogue et un prix de vente
   modifiable avant « Ajouter à la vente ». Ce prix privé ne change pas le catalogue.
   Chaque ligne conserve une copie du nom, du coût USD, du taux, du prix de vente,
   du début et de la fin. Tous les montants couvrent la période saisie. Modifier le
   catalogue ne change jamais les transactions passées.
4. La fin est **exclusive** : c’est le jour où renouveler. On peut choisir 1/3/6/12 mois
   depuis le début ou saisir librement la date. Changer les dates d’une vente ne
   change pas les prix : vérifier les montants réels de la période.
5. Une référence et un lien HTTPS permettent de retrouver la facture réelle du
   fournisseur. Aucun fichier PDF fournisseur n’est téléversé dans cette version.
   Ne pas saisir de mots de passe, cartes bancaires ou liens de facture contenant
   des secrets d’accès dans les paramètres de l’URL.
6. « Renouveler » prépare une **nouvelle** vente liée à la précédente. Le début est
   le plus tardif entre aujourd’hui (Africa/Algiers) et l’ancienne fin. Les nouvelles
   dates utilisent des mois calendaires, ajustés au dernier jour du mois si besoin.
   Les prix proposés sont ceux du catalogue, proportionnels à la période choisie ;
   contrôler les remises annuelles, frais et prix réels, puis modifier avant sauvegarde.
   La référence et le lien de facture sont vidés. L’ancienne vente est conservée.
   On choisit les services à reconduire avec des cases à cocher, puis on peut ajouter
   d’autres services au brouillon. « Autre service / vente » reprend seulement le
   client et son lien Facebook pour une vente indépendante. « Nouvelle vente »
   propose aussi les clients existants, sans fusionner des homonymes ayant des
   liens Facebook différents.

## États et filtres

- La colonne « État » et les cartes mobiles affichent un cercle et son libellé :
  jaune si au moins un service actif expire dans 3 jours ou moins ; sinon vert si
  au moins un service est actif ; sinon rouge. Le détail reste visible par service.
  Un abonnement à venir est inactif jusqu’à son début. La fin étant exclusive,
  un service est expiré dès le jour de sa fin. Calcul selon Africa/Algiers, actualisé
  toutes les minutes et au retour sur la page.
- Les filtres client, ID de commande (court TECH- ou complet), état, service et dates
  se combinent. Les dates portent au choix sur le début, la fin ou la création ;
  les bornes sont inclusives. Service et dates doivent correspondre à la même ligne.
- Les totaux affichés et l’export concernent les **ventes retenues entières**, tous
  leurs services inclus ; ils ne sont pas limités aux lignes ayant déclenché le
  filtre. Les totaux de l’ensemble du registre sont affichés séparément. Une plage
  inversée ne renvoie aucune vente et bloque l’export jusqu’à correction.
- Sur mobile, chaque vente devient une carte avec état, services, dates, coût,
  total, marge et actions, sans faire défiler horizontalement un grand tableau.

## Accès mobile privé et APK

L’adresse dédiée est `https://zgr-cv.pages.dev/?workspace=tech-orders`. Elle utilise
la connexion existante et ne monte pas l’éditeur CV. Le rôle administrateur reste
obligatoire côté serveur ; cette adresse n’est pas un lien d’accès sans connexion.

Un APK de **test** Android 8 ou ultérieur a été compilé et signé localement, sans
convertisseur en ligne ni nouveau dépôt public. Il charge uniquement cet espace
authentifié ; Internet est nécessaire. Il ne contient ni dossier client ni secret
de connexion. La seule permission déclarée est Internet. Les logos passent par
le sélecteur de fichiers Android et l’Excel par une boîte d’enregistrement système,
sans autorisation générale de lecture du stockage. Les erreurs TLS sont bloquées,
les sauvegardes Android et captures d’écran sont désactivées dans l’application.

Le paquet, les sources natives et la clé de signature locale restent dans le dossier
ignoré `output/android-tech-orders/` et ne sont pas publiés dans GitHub ou Pages.
Ne jamais partager le sous-dossier `.local-signing`. Le paquet actuel est signé
pour les essais, pas pour une diffusion Play Store. Avant usage quotidien, tester
sur le téléphone : connexion, reprise de session, création d’une vente fictive,
import d’un logo, export Excel et déconnexion. Ces essais natifs restent à faire.
Pour une distribution durable, utiliser une clé de production privée sauvegardée
de manière sécurisée et conserver la même clé pour les mises à jour.

## Calcul et export

- Coût DA par ligne = `ROUND(prixUSD × taux, 2)`.
- Marge brute DA = `ROUND(venteDA − coûtDA, 2)`. Une marge négative reste visible.
- Totaux d’une vente = somme de ses lignes, jamais somme des totaux répétés.
- L’Excel `.xlsx` exporte les ventes **filtrées**, une ligne par service, avec vraies
  dates, formules de coût/marge, totaux, filtres, volets figés et valeurs calculées
  en cache. Le texte client est encodé en chaîne Excel, jamais interprété en formule.
- Les modifications Excel ne sont pas réimportées dans le cloud. Le registre cloud
  et le classeur exporté sont indépendants après téléchargement.
- Les marges sont brutes, hors frais, taxes, remboursements et encaissements.
  Ce module n’est pas une comptabilité complète et ne suit pas les paiements reçus.

## Stockage et sécurité

`/api/tech-orders` est derrière l’authentification existante, avec contrôle de rôle
admin pour **toutes** les lectures et écritures. Les routes PUT sont
`/api/tech-orders/services/:id` et `/api/tech-orders/orders/:id`.

Les objets utilisent uniquement `tech-orders/v1/current/{services|orders}/` dans
le binding R2 existant `CLIENTS_BUCKET`. L’historique est séparé dans
`tech-orders/v1/history/`. Aucun accès aux objets CV, dossiers portail, D1 clients
ou outils MCP n’est ajouté. Aucune suppression n’est implémentée.
Les logos privés sont versionnés dans `current/logos/:serviceId.json`, via
`PUT /api/tech-orders/logos/:serviceId`. Ils sont renvoyés séparément des ventes
par le GET ; ils ne changent pas les prix ou versions des fiches services.

Chaque modification vérifie `revision` puis l’ETag R2 (`onlyIf`) pour éviter de
perdre une saisie concurrente. Un conflit retourne 409 et demande un rechargement.
La taille du corps est contrôlée même sans Content-Length. Les liens sont HTTPS
sans identifiants intégrés ; les montants, dates, doublons de lignes et logos sont validés.

## Tests

`npm run typecheck`, `npm run test:unit`, `node --test cloudflare/tech-orders.test.js`.
Les tests couvrent l’exemple 20 × 260 = 5200 ; 6200 − 5200 = 1000, zéros,
arrondis, marges négatives, multi-services, fins de mois, années bissextiles,
renouvellements sans mutation, formules XLSX, injection de formule, accès admin,
isolation des objets et conflits de versions.

Un test navigateur local avec uniquement un client fictif a contrôlé le tableau,
le renouvellement sur trois mois et la modification manuelle du prix (20000 −
15600 = 4400). Aucune vente ou facture réelle n’a été créée pour ce contrôle.
Le modèle Excel fictif a été recalculé et rendu avec la bibliothèque d’artefacts,
y compris la vérification d’un prix nul. L’ouverture dans Microsoft Excel desktop
n’a pas été testée.

Contrôle du 25 octobre 2026 : filtres combinés, seuil exact de 3 jours, états mixtes,
dates inclusives et fuseau d’Alger couverts par tests automatisés. Contrôle local
à 390 px : absence de débordement horizontal, filtre jaune et totaux 6200/5200/1000,
renouvellement d’un seul service sur deux. Aucune vente de production créée.
La fin de la vérification interactive a été interrompue par la désactivation de
l’accès navigateur ; l’ajout au brouillon après renouvellement reste couvert par
les fonctions et tests du code, mais n’a pas été terminé dans le navigateur.
Typecheck, lint des fichiers modifiés, 90 tests unitaires, 12 tests ciblés Worker/Pages,
build SPA et contrôle PWA valides. Le budget du bundle initial reste dépassé :
339,90 Kio gzip après modification, contre 339,47 Kio sur la version de production
précédente, pour un budget de 310 Kio. Ce contrôle de performance n’est donc pas vert.
