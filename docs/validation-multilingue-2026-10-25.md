# Logiciels, sections personnalisées et contrôle multilingue

## Causes identifiées

- Le prompt maître ne décrivait pas `custom_sections` dans son schéma ; ces sections
  pouvaient être omises pendant la génération ou l'import assisté.
- Une nouvelle section recopiait le même titre dans les sept documents, sans traduire.
- Le partage des logiciels écrasait aussi des descriptions déjà traduites lors d'un
  changement de logo ou d'une édition dans une autre langue.
- La sauvegarde MCP acceptait un document multilingue partiel avec avertissement.
- Les fixtures n'exerçaient ni logiciels ni nouvelles sections. Le contrôle ajouté a
  aussi détecté la spécialité du troisième diplôme absente dans six langues.

## Contrat corrigé

Le prompt maître 1.6 et l'import IA décrivent `logiciels` et `custom_sections`.
Marques, id et icon sont stables ; les titres et la prose sont traduits.
Les titres courants comme Projets, Volontariat et Réalisations ont des suggestions
localisées. Un titre libre n'est pas traduit par une fausse heuristique : le panneau
de contrôle permet d'en demander une traduction IA, relue et acceptée avant application.

Le formulaire de gestion reste en français par conception. Le choix de langue
concerne les valeurs du profil et le document généré. Microsoft Word / Canva ne
doivent pas être renommés artificiellement pour paraître « traduits ».

## Interface

Le panneau « Contrôle multilingue — logiciels et sections personnalisées » liste les
écarts du profil complet. Le bouton transmet uniquement ces deux sections de la
langue active au fournisseur IA configuré, sans coordonnées ni logos encodés.
Les sept propositions sont visibles avant validation. La réponse est refusée en cas
de langue manquante, de marque modifiée, d'id/ordre/icon modifiés, de puce ajoutée ou
supprimée, de nombre modifié ou de texte vide/invalide. Les logos locaux sont conservés.
Une modification du contenu pendant l'appel invalide la proposition avant application.
La validation applique les traductions au profil local, pas une sauvegarde MCP.

## MCP et import

Le MCP passe en 0.9.3. `save_json_version` utilise le contrôle structurel strict pour
les sept langues : absence de langue, section omise, contenu attesté ailleurs devenu
vide, identifiants ou logos incohérents et puces manquantes bloquent la sauvegarde.
Les imports manuels historiques partiels restent possibles avec avertissements.
L'import multilingue expose également un rapport, sans recopier le français dans les
champs manquants et sans inventer une traduction.

Une absence factuelle dans toutes les langues reste "" ou []. Le contrôle n'impose
pas de fausses compétences, diplômes ou logiciels pour remplir tous les champs.
Un audit structurel ne peut pas certifier le sens ni la qualité de toutes les
traductions : la relecture linguistique humaine reste nécessaire. Les titres arabes
ou chinois suspects produisent un avertissement, avec exception possible pour un nom propre.

## Vérification

Les fixtures globales et sept fichiers individuels sont synchronisés. Les tests
couvrent le pack complet, l'absence d'information partout, une langue absente, une
section effacée, un titre vide, une puce supprimée, une marque et un nombre altérés,
la conservation des libellés localisés après changement de logo et les copies du prompt.
Ne pas assimiler ces tests à une exécution réelle du connecteur ChatGPT en production.

État de vérification local du 25 octobre 2026 : 82 tests unitaires réussis
(dont 10 scénarios ciblés de ce chantier), contrôles TypeScript racine/portail
et builds SPA/portail réussis. Aucun appel IA payant ni commande client utilisé.
La publication a d'abord été suspendue pour attendre les deux chantiers. Le propriétaire
a ensuite demandé explicitement le déploiement coordonné le 25 octobre 2026.
Les 82 tests unitaires et les 11 tests ciblés des passerelles/Tech Orders ont été
relancés avec succès, ainsi que les contrôles TypeScript et les builds. Les dépendances
locales racine, incomplètes, ont été restaurées avec `npm ci` sans modification du lockfile.
Publication terminée : MCP 0.9.3, plateforme Pages et Worker principal.
Aucun dossier client modifié pour ce déploiement.

- Pages : `https://a5ef6966.zgr-cv.pages.dev`, production `https://zgr-cv.pages.dev/`.
- Portail : version `c83bd3f1-6bf1-4018-ac0c-50cb2ded6fb9`.
- Worker principal : version `9e395c42-dbcb-4f31-9c4f-f971a0d7a565`.
- Initialisation MCP en ligne : `zgr-cv` version `0.9.3`.
- Plateforme et bundle principal : HTTP 200, panneau multilingue présent dans le bundle.
- CSS portail sous `/c/_next/` : HTTP 200 et `text/css`.
- Contrôle PWA : réussi. Aucun appel authentifié de sauvegarde MCP exécuté pour ce déploiement.
- Une erreur temporaire Cloudflare 10013 au début de l'upload Worker a été résolue par
  une seconde tentative après la fin du déploiement Pages ; la seconde s'est terminée avec succès.
