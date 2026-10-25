# Accès équipe — Commandes et Nouveau lien client

Règle demandée : chaque compte actif connecté peut ouvrir Commandes et créer
un lien de dépôt client. Cette ouverture ne confère pas les droits d'administration.

- Le bouton Commandes dépend de la session active, pas d'une ancienne permission
  `ordersRead:false` conservée dans le cache du navigateur.
- La normalisation de session rétablit cette permission de consultation de base.
- Le bouton Nouveau lien client est visible pour tous les utilisateurs du panneau
  Commandes. Le bouton de création d'une archive reste réservé aux administrateurs.
- La passerelle serveur autorise seulement `POST /api/admin/client-orders/invitations`
  comme exception à la permission d'écriture des commandes. Les autres méthodes,
  sous-chemins et opérations restent soumis aux permissions existantes.
- L'authentification de la passerelle reste obligatoire ; le secret du portail reste
  interne, jamais transmis au navigateur. Le portail conserve la durée de cinq jours.
- Une impossibilité de copier dans le presse-papiers n'est plus annoncée comme un
  échec de création : le lien déjà créé reste affiché et copiable manuellement.

Tests en mémoire, sans commandes ni comptes de production : administrateur, lecteur,
éditeur, compte sans rôle métier et matrice commandes initialement à none. Contrôle
de la consultation, de la création, de l'identité transmise au portail et du refus
des suppressions, archives et modifications non autorisées. Une requête anonyme
reste refusée. Aucun lien réel n'a été créé pendant ces tests.

Vérifications : scénario d'accès ciblé réussi, 82 tests unitaires réussis,
TypeScript, build SPA, dry-run Worker et contrôle PWA réussis. La suite serveur
élargie termine avec 29 tests réussis sur 30 ; l'échec historique concernant le
responsable de validation des CV reste hors de ce changement. Aucun droit de
validation de CV n'a été modifié pour contourner ce test.

Déploiement du 25 octobre 2026 : Pages `https://241d7e73.zgr-cv.pages.dev`,
production `https://zgr-cv.pages.dev/`, Worker version
`a1fff7ba-b6ea-4c29-b8d6-6075c3aaf3c2`. HTML, bundle principal et bundle Commandes
renvoient HTTP 200 ; la requête anonyme de création d'invitation reste refusée (401).
Le comportement authentifié lecteur/éditeur est vérifié par les tests en mémoire,
sans créer d'invitation ou de compte en production.
