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
