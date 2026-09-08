# Plan étudié — intégration du modèle « CV PRO »

## 1. Conclusion de l’analyse

Le modèle de référence n’est pas une variante cosmétique des CV canadiens actuels. Il combine :

- un bandeau pleine largeur ;
- un grand cartouche d’identité superposé ;
- une photo circulaire dominante ;
- deux colonnes asymétriques ;
- neuf barres de section ;
- des icônes de contact ;
- des logos de logiciels ;
- des drapeaux de langues ;
- une composition d’une page très dense.

Le modèle de base contient 34 objets PowerPoint de premier niveau et deux objets internes à un groupe. Les copies réelles en contiennent respectivement 30 et 28. Cette diminution correspond aux sections et actifs absents. Il est donc possible et préférable de reconstruire le rendu avec des objets vectoriels et du texte réel. Une image de fond casserait la sélection, le Designer, la traduction et le comportement dynamique.

Les deux copies confirment que la mise en page doit être calculée : Expériences descend d’environ 54 à 64 pt lorsque l’objectif grandit, et Formation peut descendre d’environ 169 pt lorsque les expériences sont longues. Les coordonnées du modèle de base sont des ancres, pas un placement final figé.

## 2. Risques à traiter avant le code

### Risque A — gabarit fixe contre données dynamiques

Le fichier source prévoit exactement 3 expériences, 3 formations, 3 éducations, 4 compétences, 5 langues et 2 participations. Le JSON ZGR accepte des listes variables. La future implémentation doit utiliser le design comme cas nominal, sans reprendre ces limites.

### Risque B — dépassement vertical

La zone Éducation du PowerPoint descend théoriquement au-delà de la hauteur A4. Un rendu fidèle mais naïf peut couper le bas du CV. Il faut un calcul de densité et une vraie stratégie multipage.

### Risque C — symboles non portables

Certains contacts du PowerPoint utilisent des glyphes de police symbolique. Le rendu PPTX observé ne restitue pas tous les symboles alors que le PDF les affiche. Ils doivent être remplacés par des SVG locaux et vectoriels.

### Risque D — logiciels inventés

Les logos Word, Excel et PowerPoint sont décoratifs dans la source, mais le JSON courant ne contient pas de section logiciels. Les afficher pour tous les clients inventerait une compétence. Il faut ajouter un champ optionnel rétrocompatible ou masquer la section.

### Risque E — sept langues et arabe RTL

La référence est française/LTR. Les langues européennes peuvent conserver la structure. Le chinois exige une police dédiée. L’arabe exige une adaptation bidi et probablement une géométrie miroir qui devra être validée séparément.

### Risque F — Designer

Les détails décoratifs doivent rester des objets sélectionnables. Une construction sans identifiants stables empêcherait l’édition précise par clic, X/Y, clavier et glisser-déposer.

## 3. Décisions proposées

1. Nom affiché : **CV PRO**.
2. Identifiant interne : **`cv-pro`**.
3. Format : A4 portrait.
4. Référence visuelle : PDF ; géométrie/objets : PowerPoint.
5. Couleur par défaut : `#5C0632` ; texte : `#595959`.
6. Police LTR : Calibri embarquée ; chinois : Noto Sans SC ; arabe : police arabe embarquée.
7. Rendu : pdfmake, texte natif, formes vectorielles et images locales seulement.
8. Disponibilité : toutes les langues du document, avec FR comme référence pixel-visuelle et AR comme adaptation RTL distincte.
9. Débordement : normal, compact, puis multipage ; jamais de troncature silencieuse.
10. Logiciels : nouveau champ optionnel recommandé ; section absente si aucune donnée factuelle.
11. Ordre latéral nominal : Compétences, Logiciels, Langues, Participation, Référence.
12. Ordre latéral dense : Langues, Compétences, Logiciels, Participation, Référence.
13. Titres/dates : ligne commune si elle tient, sinon empilement sur deux lignes.
14. Le même plan de placement alimente le PDF et les zones de sélection du Designer.

## 4. Phases de réalisation

### Phase 0 — validation du contrat

- Valider le prompt d’intégration.
- Valider l’identifiant `cv-pro`.
- Valider que le modèle sera offert dans les sept langues.
- Valider l’ajout du champ JSON optionnel `logiciels`.
- Décider si la version arabe doit être livrée au même jalon ou après validation française.

**Sortie :** portée figée, aucun code modifié avant validation.

### Phase 1 — actifs et spécification géométrique

- Extraire uniquement les actifs nécessaires depuis le PPTX : icônes, logos et drapeaux.
- Remplacer les glyphes système par des SVG locaux cohérents.
- Optimiser les actifs et vérifier leurs licences/usages.
- Convertir toutes les mesures utiles en points PDF.
- Créer une constante centrale de mise en page et attribuer un identifiant stable à chaque élément.
- Transformer l’analyse comparative en cas de calibration automatisés pour les trois variantes.

**Contrôle :** inventaire des actifs, dimensions et couleurs sans données CV.

### Phase 2 — contrat de données rétrocompatible

- Ajouter `logiciels` comme champ optionnel structuré si validé.
- Mettre à jour types, CV vide, normalisation JSON, import/export, formulaire, masquage et prompt maître.
- Ne jamais modifier la signification d’un champ existant.
- Prévoir la migration automatique des anciens JSON sans ce champ.

**Contrôle :** les JSON existants s’importent à l’identique ; un logiciel vide n’affiche rien.

### Phase 3 — squelette PDF fidèle en français

- Créer un constructeur isolé `cv-pro-pdf.ts`.
- Dessiner bandeau, cartouche, cadre photo, colonnes et barres avec des vecteurs.
- Ajouter photo, nom, titre et contacts.
- Ajouter les sections avec un jeu de données nominal proche du PowerPoint.
- Brancher le modèle dans le registre et le dispatch PDF.
- Ajouter la couleur au système de thèmes.

**Contrôle :** comparaison PNG source/généré sur A4, sans encore traiter tous les cas extrêmes.

### Phase 4 — composition dynamique et multipage

- Mesurer/estimer l’occupation des sections avant composition.
- Supprimer les sections vides et redistribuer l’espace.
- Appliquer les profils normal puis compact.
- Passer à une page suivante au-delà du seuil lisible.
- Empêcher orphelins, chevauchements, coupures et dépassements.
- Définir un en-tête compact pour les pages suivantes.
- Construire des blocs sémantiques mesurables et un plan de placement partagé.
- Mesurer les noms pour choisir automatiquement une taille entre 40 et 26 pt.
- Choisir automatiquement les en-têtes d’entrées inline ou stacked.
- Basculer vers l’ordre latéral dense lorsque l’ordre nominal ne tient pas.
- Utiliser la hauteur des lignes rendues et non les hauteurs parfois chevauchantes des cadres PowerPoint.

**Contrôle :** cas vide, court, nominal, long et très long.

### Phase 5 — localisation et RTL

- Ajouter les libellés FR, EN, ES, DE, IT, ZH et AR.
- Tester l’expansion des titres allemands et italiens.
- Tester les polices et la segmentation chinoises.
- Produire l’adaptation arabe miroir et tester les contenus mixtes arabe/latin, les numéros, e-mails, parenthèses et acronymes.

**Contrôle :** sept PDF ouvrables, lisibles et sans caractères manquants.

### Phase 6 — Designer

- Exposer les objets natifs avec identifiants stables.
- Permettre la sélection dans l’aperçu des bandes, cartouche, photo, titres, textes, icônes et sections.
- Raccorder position X/Y, déplacement fin au clavier, glisser-déposer, police, taille, couleur, fond, alignement, direction et visibilité.
- Stocker les réglages uniquement sous `cv-pro`.
- Préserver le lien entre les éléments dynamiques et les identifiants des objets JSON.

**Contrôle :** déplacer ou recolorer une barre ne touche pas les autres modèles ; rechargement et sauvegarde conservent le réglage.

### Phase 7 — intégration interface et exports

- Afficher CV PRO dans le sélecteur principal et le dock d’aperçu.
- Vérifier l’aperçu, le zoom et le téléchargement direct.
- Vérifier les packs multilingues et les exports de commande.
- Vérifier que le PDF final peut être ajouté au dossier Drive d’un client comme les autres modèles.
- Ne pas modifier la logique Europass XML : CV PRO est un modèle PDF, pas un format Europass.

**Contrôle :** aperçu et téléchargement identiques ; aucun état « Préparation PDF » bloqué.

### Phase 8 — tests et validation visuelle

- Ajouter les tests unitaires et d’intégration listés dans le prompt.
- Générer une matrice de référence : 3 volumes de données × 7 langues × photo affichée/masquée.
- Rendre les PDF en PNG pour comparer le cas français nominal au PDF source.
- Vérifier à 100 %, 200 % et impression A4 réelle.
- Vérifier le texte sélectionnable et l’absence de glyphes de remplacement.
- Exécuter tests, lint, TypeScript et build de production.

**Contrôle :** rapport de différences et captures avant/après.

### Phase 9 — déploiement contrôlé

- Conserver des commits petits et réversibles.
- Ne pas réécrire l’historique publié relié à Lovable.
- Déployer d’abord après validation locale.
- Tester le site publié avec cache froid et un second profil navigateur.
- Vérifier un téléchargement PDF réel depuis la version publiée.

**Contrôle :** version publique fonctionnelle, sans régression sur les autres modèles.

## 5. Fichiers probablement concernés lors de l’implémentation

Cette liste est prévisionnelle ; elle ne constitue pas une autorisation de modifier immédiatement les fichiers :

- `src/lib/document-templates.ts`
- `src/lib/document-templates.test.ts`
- `src/lib/cv-types.ts`
- `src/lib/cv-json.ts`
- `src/lib/cv-visibility.ts`
- `src/lib/cv-visibility.test.ts`
- `src/lib/cv-pdf.ts`
- `src/lib/cv-pro-pdf.ts` (nouveau)
- `src/lib/pdf-theme.ts`
- `src/lib/template-designer.ts`
- `src/lib/document-pdf.ts`
- `src/routes/index.tsx`
- composants de formulaire/aperçu liés aux logiciels et au Designer
- ressources locales dédiées à CV PRO
- prompt maître JSON si le champ `logiciels` est validé

## 6. Jeux de validation

### Jeu minimal

Nom, titre et un contact seulement. Attendu : pas de sections vides ni grands blocs fantômes.

### Jeu nominal

Photo, objectif, 3 expériences, 3 formations, 3 éducations, 4 compétences, 5 langues, 2 participations et références. Attendu : forte fidélité à la référence sur une page.

### Jeu réel ZGR

Le JSON de test actuel, avec toutes ses listes, formats enrichis, visibilité et langues. Attendu : aucune perte de donnée.

### Jeu dense

5 expériences longues, 4 formations, 4 éducations et nombreuses compétences. Attendu : page 2 propre, taille lisible, aucune coupure.

### Jeu RTL

Arabe contenant e-mail, téléphone, React, TypeScript, Docker, dates et parenthèses. Attendu : ordre logique et ponctuation correcte.

## 7. Définition de « terminé »

L’intégration n’est terminée que lorsque le modèle français nominal est visuellement validé, les cas dynamiques ne perdent aucune donnée, les sept langues sont lisibles, le Designer peut cibler les éléments nécessaires, l’aperçu égale le téléchargement, et toute la suite de non-régression passe avant le déploiement.
