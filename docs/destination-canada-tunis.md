# Destination Canada Tunis — préparation contrôlée

## Sources et limites

Le 22 octobre 2026, Canada.ca annonce les inscriptions ouvertes à la 22e édition.
Le formulaire Tunis `cmumrik1f00v201yp4kzni4ua`, version 2, est public et publié.
Le schéma est extrait de la page publique, pas du HTML personnel joint en exemple.
`node scripts/sync-destination-canada.mjs` régénère les deux instantanés publics ;
relire les différences avant de compiler et déployer une nouvelle version.

La vérification en direct `/api/destination-canada/tunis` contrôle l’annonce officielle,
la version, la publication et l’absence de fermeture du formulaire. Si elle échoue,
aucun état d’ouverture n’est inventé. En cas d’indisponibilité serveur, une
confirmation humaine de l’ouverture et de la concordance des questions permet
la préparation du brouillon. En cas de changement détecté, l’IA reste suspendue.
Il ne s’agit pas d’un contrôle d’admissibilité ou d’une garantie d’invitation.

## Plateforme

Opportunités → Destination Canada → préparation du **profil ouvert**.
Les champs et choix sont ceux du schéma public, avec conditions (secteur/CNP,
partenaire, IRCC), limites et contrôle des réponses manquantes.
Le nom complet n’est pas découpé automatiquement en identité passeport.
Les six compétences linguistiques ne sont pas extrapolées depuis le CV.
Les consentements restent à lire et à confirmer individuellement sur le site officiel.

L’IA configurée propose seulement les deux textes (motivation 250, expérience 350
caractères). Une proposition n’est appliquée qu’après contrôle humain.
L’enregistrement conserve `destination_canada_tunis` dans le profil actif ;
il ne crée aucune inscription officielle. Les sauvegardes de commandes gardent
leur mécanisme de versionnement et de validation existant.

Le bouton « Formulaire Destination Canada — préremplir / modifier » dans le formulaire
du profil ouvre ce parcours. Courriel, ville Europass, LinkedIn, premier établissement
et première expérience disponibles préremplissent une proposition : l’ordre des
études/expériences est à contrôler. Les réponses déjà éditées restent prioritaires,
même vides. Aucune troncature silencieuse : les dépassements sont signalés.
« Ouvrir le formulaire prérempli ZGR » affiche un aperçu isolé, actualisé à chaque
modification ; « Télécharger le formulaire rempli » produit le HTML imprimable.

L’export HTML est un récapitulatif ZGR confidentiel, **pas** une sauvegarde GC Forms.
La saisie et la soumission sur le formulaire officiel restent humaines. Aucun client
n’a été inscrit pendant le développement ; aucun test n’envoie de réponse à IRCC.

## MCP

- `zgr-cv.prepare_destination_canada_tunis(order_id)` : contrat vérifié + profil
  JSON actif de cette seule commande, lecture seule. Lire les documents sources et
  le prompt maître, demander les réponses absentes, présenter le brouillon. Pour
  conserver une version : recharger le JSON actif et utiliser `save_json_version`
  seulement avec validation explicite et `base_version`.
- L’argument optionnel `proposed_answers` permet au modèle de proposer les réponses
  après lecture réelle des sources, même sans JSON actif. Les clés suivent le schéma,
  les choix et longueurs sont contrôlés et les consentements générés sont refusés.
  Le résultat expose `draft`, `validationIssues`, `profilePatch` et `artifact`
  (nom, type MIME et contenu HTML). Le modèle doit matérialiser ce contenu en fichier
  joint s’il le peut, sans prétendre qu’un simple contenu texte est déjà un lien.
  Le serveur ne stocke aucun fichier ni nouvelle version pendant cet appel.
- `zgr-editorial.get_destination_canada_tunis()` : informations publiques uniquement,
  pour une publication sourcée ; aucune donnée personnelle ni soumission.

Les clients MCP peuvent devoir actualiser leurs outils/reconnecter la connexion
pour voir les nouveaux noms. Aucun remplacement local de secrets ou d’authentification.

## Contrôles humains particuliers

Le deuxième choix du niveau d’études porte un libellé français différent du libellé
anglais dans la source officielle. Ne pas le corriger dans le schéma ni l’attribuer
automatiquement. Contrôler le bon choix avec le candidat.
Dernier établissement : 50 caractères ; ne pas tronquer silencieusement son nom.
Chaque conjoint doit s’inscrire individuellement. Aucun document de soutien à une
demande de visa n’est promis par les organisateurs ; voyage et visa restent à vérifier.
