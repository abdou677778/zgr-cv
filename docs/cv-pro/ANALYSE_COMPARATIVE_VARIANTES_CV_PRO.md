# Analyse comparative détaillée des variantes CV PRO

## 1. Portée de l’analyse

Trois couples PDF/PPTX ont été comparés :

1. le modèle de base avec placeholders ;
2. la copie 1, remplie avec un profil réel de densité moyenne ;
3. la copie 2, remplie avec un profil plus dense et une autre couleur.

Les PDF représentent le rendu final. Les PPTX permettent d’observer les objets, les positions, les dimensions, les styles et les retours à la ligne. Les données personnelles des exemples servent uniquement à comprendre la composition ; elles ne doivent jamais devenir des valeurs par défaut du générateur.

## 2. Inventaire technique

| Variante | Page PPTX | Page PDF | Objets PPTX de premier niveau | Objets internes de groupe | Images actives dans le PDF | Couleur principale |
|---|---:|---:|---:|---:|---:|---|
| Base | 595,50 × 841,62 pt | 595,32 × 841,92 pt | 34 | 2 | 17 | `#5C0632` |
| Copie 1 | 595,50 × 841,62 pt | 595,32 × 841,92 pt | 30 | 2 | 15 | `#5C0632` |
| Copie 2 | 595,50 × 841,62 pt | 595,32 × 841,92 pt | 28 | 2 | 9 | `#005C46` |

Les trois fichiers utilisent une page A4 portrait. Le fond du corps est `#FBFBFB`, le texte principal est généralement `#595959`, et le texte secondaire de certaines listes est `#404040`.

## 3. Invariants visuels

Les éléments suivants restent identiques ou presque identiques dans les trois variantes :

- page A4 portrait ;
- bandeau supérieur de `595,50 × 163,52 pt`, placé à `x 0`, `y 0,12 pt` ;
- cartouche d’identité blanc à contour coloré, placé à `x 16,18`, `y 37,11 pt`, dimensions `203,10 × 348,15 pt` ;
- contour du cartouche de `2 pt` ;
- colonne principale commençant autour de `x 241 pt` ;
- barres de section arrondies de `169,25 × 21 pt` ;
- titres de section en Calibri gras, blanc, `15,96/16 pt` ;
- texte courant en Calibri `9 pt` ;
- titres d’entrées en Calibri gras `10,5 ou 11 pt` ;
- texte des contacts en `10,5 ou 11 pt` ;
- corps gris, accents colorés, photo et icônes dans le cartouche ;
- ordre de la colonne principale : Objectif, Expériences, Formation, Éducation.

Ces valeurs forment le squelette du modèle. Les coordonnées verticales des sections ne sont pas des invariants.

## 4. Éléments variables observés

| Élément | Base | Copie 1 | Copie 2 | Règle à en déduire |
|---|---|---|---|---|
| Accent | Bordeaux | Bordeaux | Vert | Une couleur de thème doit recolorer bandeau, contour, barres et puces ensemble |
| Photo | Présente | Non visible dans le rendu | Présente | La présence doit dépendre de `cv.photo`, pas de la présence d’un média dans le PPTX |
| Nom | 30 pt | 30 pt | 40 pt | Taille adaptative selon la largeur mesurée du nom |
| Contacts | 6 lignes | 6 lignes | 5 lignes | Chaque ligne vide doit disparaître sans icône orpheline |
| Compétences | 4 | 7 | 12 | Liste dynamique, hauteur calculée, aucune limite fixe |
| Logiciels | 3 | 3 | 3 | Liste structurée optionnelle ; ne rien inventer |
| Langues | 5 | 3 | 4 | N’afficher que les langues renseignées |
| Participation | 2 | Absente | Absente | Section conditionnelle |
| Référence | 1 bloc | 3 lignes | Absente | Section conditionnelle et hauteur variable |
| Expériences | 3 | 3 | 3, beaucoup plus longues | Nombre, descriptions et hauteur entièrement dynamiques |
| Formations | 3 | 2 | 1 | Nombre dynamique |
| Éducations | 3 | 3 | 2 | Nombre dynamique |
| Ordre latéral | Compétences, Logiciels, Langues, Participation, Référence | Compétences, Logiciels, Langues, Référence | Langues, Compétences, Logiciels | Deux stratégies latérales sont nécessaires : nominale et dense/prioritaire |

## 5. Géométrie exacte de la structure commune

### 5.1 Fond et bandeau

| Objet | X | Y | Largeur | Hauteur | Style |
|---|---:|---:|---:|---:|---|
| Fond de page | 0 | 0,12 | 595,50 | 841,68 | `#FBFBFB`, sans contour |
| Bandeau supérieur | 0 | 0,12 | 595,50 | 163,52 | Couleur d’accent, sans contour |
| Cartouche identité | 16,18 | 37,11 | 203,10 | 348,15 | Blanc, contour accent 2 pt |

Le cartouche se superpose au bandeau. Sa base descend jusqu’à environ `y 385,26 pt`. Les sections latérales commencent ensuite vers `y 404 à 416 pt`.

### 5.2 Photo

- Base : ovale image à `x 43,18`, `y 65,95`, `149,35 × 149,35 pt`.
- Copie 1 : l’objet image existe dans le package, mais le portrait n’est pas visible dans le rendu final observé.
- Copie 2 : image circulaire à `x 40,28`, `y 71,84`, `153,07 × 153,07 pt`.

Conséquences :

- utiliser une seule image recadrée en cercle ;
- ne pas reproduire la segmentation en bandes créée par l’export PowerPoint PDF ;
- conserver par défaut l’enveloppe du cartouche même sans photo, comme dans la copie 1 ;
- ne jamais décider que la photo est visible parce qu’un média inutilisé existe dans le fichier ;
- autoriser le mode compact sans photo uniquement comme stratégie explicite du moteur, pas comme comportement implicite.

### 5.3 Nom et titre du poste

| Variante | X | Y | Largeur | Hauteur | Nom | Titre |
|---|---:|---:|---:|---:|---:|---:|
| Base | 237,08 | 59,30 | 397,50 | 78,25 | 30 pt | 16 pt |
| Copie 1 | 237,08 | 59,30 | 397,50 | 78,25 | 30 pt | 16 pt |
| Copie 2 | 237,08 | 67,18 | 342,24 | 105,69 | 40 pt | 16 pt |

Le nom court de la copie 2 accepte 40 pt. Le nom plus long de la copie 1 reste à 30 pt. Le moteur doit mesurer la largeur réelle avec la police active et choisir la plus grande taille qui tient dans la zone. Un simple seuil sur le nombre de caractères serait insuffisant.

Plage recommandée : `40, 38, 36, 34, 32, 30, 28, 26 pt`, avec deux lignes seulement en dernier recours et sans chevauchement du cartouche.

## 6. Analyse ligne par ligne du cartouche

### 6.1 Modèle de ligne

Chaque information personnelle suit ce patron :

1. cellule icône de largeur fixe ;
2. petit espace ;
3. texte de contact ;
4. ligne centrée dans la largeur interne du cartouche ;
5. hauteur de ligne de `20 à 21 pt`.

Les six rôles observés sont :

- téléphone ;
- e-mail ;
- date de naissance et situation familiale ;
- permis de conduire ;
- service national, facultatif ;
- wilaya et pays.

La copie 2 masque le service national et conserve cinq lignes. Le moteur doit supprimer la ligne complète, y compris l’icône et son espacement.

### 6.2 Coordonnées et typographie

| Variante | Zone contact | Police | Interligne nominal |
|---|---|---:|---:|
| Base | `x 24,37`, `y 225,28`, `187,62 × 125,17 pt` | 11 pt | 21 pt |
| Copie 1 | identique | 11 pt | 21 pt |
| Copie 2 | `x 25,53`, `y 245,90`, `178,44 × 147,33 pt` | 10,5 pt | 20 pt |

Les longs e-mails doivent rester sur une ligne lorsqu’ils tiennent. L’algorithme peut réduire cette seule ligne jusqu’au minimum autorisé, puis utiliser une coupure contrôlée pour une adresse réellement trop longue. Le numéro de téléphone et l’e-mail restent en direction LTR dans un document arabe.

## 7. Colonne principale : moteur de flux

### 7.1 Positions comparées

| Bloc | Base Y | Copie 1 Y | Copie 2 Y |
|---|---:|---:|---:|
| Barre Objectif | 183,16 | 184,29 | 182,59 |
| Corps Objectif | 208,25 | 210,50 | 209,54 |
| Barre Expériences | 236,41 | 290,41 | 300,28 |
| Corps Expériences | 264,53 | 319,65 | 327,21 |
| Barre Formation | 484,53 | 528,05 | 653,30 |
| Corps Formation visuel | 515,75 | 557,67 | 679,23 |
| Barre Éducation | 688,76 | 668,13 | 723,40 |
| Corps Éducation | 719,09 | 696,36 | 748,12 |

Cette table prouve que seule la première barre est presque fixe. Toutes les suivantes suivent la hauteur réellement occupée par le contenu précédent.

### 7.2 Objectif

- Police : 9 pt, gris `#595959`.
- Interligne : environ 13 pt.
- Base : placeholder sur une ligne.
- Copie 1 : paragraphe de plusieurs lignes ; la barre Expériences descend d’environ 54 pt.
- Copie 2 : paragraphe encore plus dense ; la barre Expériences descend d’environ 64 pt par rapport à la base.

Le moteur doit calculer les lignes selon la largeur disponible. Il ne doit jamais utiliser la hauteur nominale du cadre PowerPoint, car le texte peut déborder visuellement de son cadre source.

### 7.3 Expériences

Chaque expérience contient des lignes sémantiques distinctes :

1. dates et/ou titre principal, gras, 10,5 ou 11 pt ;
2. employeur et lieu, 9 pt ;
3. libellé facultatif et localisé « Mes responsabilités » lorsque des descriptions existent ;
4. zéro à plusieurs descriptions à puces, 9 pt ;
5. espace de séparation réduit avant l’expérience suivante.

Deux compositions du titre sont observées :

- **inline** : `titre | dates` lorsque l’ensemble tient sur une ligne ;
- **stacked** : dates sur une ligne, titre sur la suivante lorsque le titre est long.

La copie 2 démontre le besoin du mode stacked. L’algorithme doit essayer inline, mesurer, puis basculer vers stacked. Il ne doit pas réduire excessivement le titre pour le forcer sur une ligne.

Les hauteurs de ligne observées sont de 15/16 pt pour les lignes fortes, 13/14 pt pour le corps, et 8/9 pt pour l’espace entre entrées.

L’anomalie de la troisième expérience de la copie 2, où le lieu se rapproche du titre, ne doit pas être reproduite. Le moteur doit conserver les rôles `dates`, `titre`, `employeur`, `lieu` et `descriptions` séparés.

### 7.4 Formation

Chaque formation utilise :

1. `titre | date` en gras ;
2. compétences ou option ;
3. institution et lieu ;
4. espace entre entrées.

Le placeholder du modèle de base utilise le nom `lieu` à droite du séparateur, mais les deux profils remplis affichent une année. La donnée correcte à utiliser dans l’en-tête est donc `formation.date`. `formation.lieu` doit accompagner l’institution ou apparaître sur une ligne secondaire.

### 7.5 Éducation

Chaque éducation utilise :

1. `titre | date` en gras ;
2. option, équivalence ou spécialité si renseignée ;
3. institution et lieu ;
4. espace entre entrées.

Le modèle de base répète par erreur `edu2_institution` dans la troisième entrée. Le moteur doit itérer sur les objets réels et utiliser l’institution de chaque entrée.

## 8. Colonne latérale : composition et priorité

### 8.1 Base

| Section | Barre Y | Corps Y | Contenu |
|---|---:|---:|---|
| Compétences | 404,31 | 430,42 | 4 puces |
| Logiciels | 505,20 | 530,92 | 3 lignes avec logos |
| Langues | 596,31 | 626,92 | 5 lignes avec drapeaux |
| Participation | 716,25 | 742,11 | 2 puces |
| Référence | 787,03 | 809,29 | 1 bloc |

Les cadres PowerPoint de Langues et Participation se chevauchent nominalement, alors que leurs glyphes visibles restent séparés. Le moteur doit utiliser la hauteur des lignes rendues, pas la hauteur du cadre source.

### 8.2 Copie 1

| Section | Barre Y | Corps Y | Contenu |
|---|---:|---:|---|
| Compétences | 412,18 | 441,49 | 7 puces |
| Logiciels | 581,40 | 612,72 | 3 lignes |
| Langues | 675,69 | 704,70 | 3 lignes |
| Référence | 767,68 | 787,95 | 3 lignes |

Participation disparaît. Toutes les sections suivantes remontent ou descendent selon la hauteur réelle des compétences.

### 8.3 Copie 2

| Section | Barre Y | Corps Y | Contenu |
|---|---:|---:|---|
| Langues | 415,65 | 447,86 | 4 lignes |
| Compétences | 533,12 | 561,99 | 12 puces |
| Logiciels | 755,65 | 781,50 | 3 lignes |

Référence et Participation disparaissent. Langues passe avant Compétences pour garantir que les informations prioritaires restent sur la première page d’un profil très dense.

### 8.4 Politique déduite

Le moteur doit être déterministe :

- **ordre nominal**, lorsque tout tient : Compétences, Logiciels, Langues, Participation, Référence ;
- **ordre dense**, lorsque la colonne ne tient pas : Langues, Compétences, Logiciels, Participation, Référence ;
- les sections absentes sont supprimées avant la mesure ;
- aucune section remplie n’est supprimée pour tenir ; les blocs de priorité basse passent sur la page suivante ;
- une option du Designer pourra imposer l’ordre, mais le PDF standard doit rester prévisible.

## 9. Typographie et rythme vertical

| Rôle | Taille | Graisse | Couleur | Interligne observé |
|---|---:|---|---|---:|
| Nom | 30 à 40 pt | Gras | Blanc | 0,8 relatif dans PPTX |
| Titre de poste | 16 pt | Gras | `#D9E2F3` | 0,8 relatif |
| Titre de section | 16 pt | Gras | Blanc | Centré verticalement dans 21 pt |
| Titre d’entrée | 10,5 à 11 pt | Gras | `#595959` | 15 à 16 pt |
| Corps principal | 9 pt | Normal | `#595959` | 13 à 14 pt |
| Liste latérale | 9 pt | Normal | `#404040` | 14 à 15 pt |
| Contact | 10,5 à 11 pt | Normal | `#595959` | 20 à 21 pt |
| Puce | environ 12,6 pt | Normal | Accent | Suit la ligne de 14/15 pt |

Le modèle ne doit jamais descendre sous un corps lisible. La réduction de densité doit d’abord toucher les espaces, puis légèrement l’interligne. La taille du corps constitue la dernière variable.

## 10. Actifs visuels

### Icônes de contact

Le modèle utilise un mélange de graphiques et de glyphes de police. Les glyphes doivent être remplacés par des SVG locaux pour garantir le même rendu dans le navigateur, le PDF et le système d’exploitation.

### Logiciels

Trois logos sont utilisés dans les exemples : Word, Excel et PowerPoint. Le moteur doit afficher uniquement les logiciels présents dans les données structurées. Les clés d’icône autorisées doivent être mappées à des actifs locaux connus.

### Drapeaux

Les variantes montrent de trois à cinq langues. La taille est d’environ 12 × 7 pt dans la base/copie 1 et 8,5 × 8,5 pt pour plusieurs actifs de la copie 2. Le moteur doit normaliser les drapeaux dans une boîte optique constante sans déformer leur ratio.

### Photo

Le PDF PowerPoint découpe parfois l’image remplissant l’ovale en plusieurs bandes internes. Il ne faut pas imiter cette structure d’export. Une image unique, recadrée par masque circulaire, produit un fichier plus propre et plus léger.

## 11. Anomalies des sources à ne pas copier

- placeholder incorrect de la troisième institution d’éducation ;
- noms de placeholders de Formation qui mélangent date et lieu ;
- fautes ou variations rédactionnelles dans les données d’exemple ;
- troisième expérience de la copie 2 dont des champs semblent concaténés ;
- objets PowerPoint dont les cadres se chevauchent alors que le contenu visible ne se chevauche pas ;
- blocs Éducation qui dépassent théoriquement la page dans les cadres source ;
- média photo présent dans un package alors que le rendu ne l’affiche pas ;
- éléments PowerPoint ordonnés techniquement différemment de leur ordre sémantique visible.

## 12. Architecture du moteur de composition dynamique

### 12.1 Modèle interne

Le moteur doit transformer le CV visible en un arbre de blocs sémantiques :

- `PageShell` : fond, bandeau, cartouche ;
- `IdentityBlock` : photo, nom, titre, contacts ;
- `FlowRegion` : colonne principale ou latérale ;
- `SectionBlock` : barre, titre, contenu ;
- `EntryBlock` : expérience, formation ou éducation ;
- `AdaptiveHeaderRow` : inline ou stacked ;
- `TextBlock` : lignes mesurées ;
- `IconTextRow` : icône et texte ;
- `ListBlock` : puces et règles de fragmentation.

Chaque bloc doit posséder un identifiant Designer stable, une largeur, une hauteur mesurée, des règles de coupure et un niveau de priorité.

### 12.2 Pipeline recommandé

1. appliquer la visibilité aux données sans les détruire ;
2. normaliser et localiser les libellés ;
3. résoudre la police et la direction ;
4. convertir le texte enrichi en fragments sûrs ;
5. mesurer les lignes avec la police locale réellement chargée ;
6. choisir inline ou stacked pour les titres/dates ;
7. construire les blocs et leurs hauteurs ;
8. supprimer les sections vides ;
9. essayer le profil normal ;
10. essayer le profil compact si nécessaire ;
11. choisir l’ordre latéral nominal ou dense ;
12. paginer sans perte de donnée ;
13. produire un plan de placement immuable ;
14. utiliser ce même plan pour pdfmake et la couche de sélection du Designer.

### 12.3 Mesure du texte

Le moteur doit charger les mêmes fichiers de police locaux que le PDF. Il peut utiliser un `TextMeasurer` avec cache, puis insérer explicitement les retours à la ligne planifiés dans pdfmake afin d’éviter une seconde décision de wrapping différente.

Règles :

- segmentation par mots pour le texte normal ;
- segmentation Unicode adaptée pour le chinois ;
- traitement bidi existant pour l’arabe ;
- coupure caractère par caractère seulement pour e-mails, URL ou mots réellement plus larges que la colonne ;
- cache de mesure indexé par police, graisse, taille et texte ;
- tolérance de sécurité de 1 à 2 pt par ligne.

### 12.4 Pagination

Page 1 conserve le grand bandeau et le cartouche. La colonne principale utilise l’espace sous le bandeau. La colonne latérale utilise l’espace sous le cartouche.

Si le contenu dépasse :

- réduire d’abord les espaces entre entrées et sections ;
- réduire ensuite légèrement les interlignes dans les limites définies ;
- basculer la colonne latérale en ordre dense ;
- conserver ensemble une barre de section et la première ligne suivante ;
- conserver le titre d’une entrée avec au moins une ligne secondaire ;
- autoriser les longues listes de descriptions à se fractionner proprement ;
- envoyer le reste sur une page 2 avec en-tête compact et mêmes styles ;
- ne jamais supprimer un item ou réduire le corps sous le seuil de lisibilité.

## 13. Performance et stabilité de l’aperçu

- calcul pur et déterministe ;
- cache des mesures de texte et des actifs ;
- aucune requête réseau pendant la composition ;
- une passe normale, puis une passe compacte seulement si nécessaire ;
- annulation logique des générations d’aperçu devenues obsolètes ;
- réutilisation du même plan pour l’aperçu, le PDF téléchargé et les coordonnées du Designer ;
- sortie garantie de l’état « Préparation PDF » en cas d’erreur ;
- repli propre lorsque la photo ou une icône n’est pas disponible.

## 14. Conclusion

Les copies confirment que le bon modèle technique n’est pas un calque absolu. Le squelette reste fixe, mais le contenu doit circuler dans deux régions mesurées. Les barres suivantes se positionnent à partir de la hauteur réellement rendue, les lignes fortes basculent entre inline et stacked, les sections vides disparaissent, et le moteur choisit une stratégie latérale adaptée à la densité avant de paginer.

## Annexe A — carte des objets du modèle de base

Toutes les mesures suivantes sont en points PowerPoint.

| ID | Rôle | X | Y | Largeur | Hauteur |
|---:|---|---:|---:|---:|---:|
| 40 | Bandeau supérieur | 0,00 | 0,12 | 595,50 | 163,52 |
| 41 | Cartouche identité | 16,18 | 37,11 | 203,10 | 348,15 |
| 42 | Photo ovale | 43,18 | 65,95 | 149,35 | 149,35 |
| 43 | Contacts | 24,37 | 225,28 | 187,62 | 125,17 |
| 44 | Nom et titre | 237,08 | 59,30 | 397,50 | 78,25 |
| 47 | Barre Objectif | 241,00 | 183,16 | 169,25 | 21,00 |
| 2 | Corps Objectif | 240,73 | 208,25 | 313,16 | 67,26 |
| 3 | Barre Expériences | 240,73 | 236,41 | 169,25 | 21,00 |
| 45 | Corps Expériences | 240,73 | 264,53 | 330,39 | 208,18 |
| 5 | Barre Formation | 241,00 | 484,53 | 169,25 | 21,00 |
| 16 | Corps Formation | 240,73 | 515,75 | 330,39 | 114,01 |
| 52 | Barre Éducation | 240,73 | 688,76 | 169,25 | 21,00 |
| 53 | Corps Éducation | 240,73 | 719,09 | 330,39 | 233,88 |
| 56 | Barre Compétences | 34,75 | 404,31 | 169,25 | 21,00 |
| 57 | Corps Compétences | 34,72 | 430,42 | 157,81 | 69,12 |
| 54 | Barre Logiciels | 34,75 | 505,20 | 169,25 | 21,00 |
| 4 | Corps Logiciels | 52,02 | 530,92 | 156,53 | 53,82 |
| 9 | Barre Langues | 34,75 | 596,31 | 169,25 | 21,00 |
| 10 | Corps Langues | 52,27 | 626,92 | 156,53 | 97,11 |
| 6 | Barre Participation | 34,68 | 716,25 | 169,25 | 21,00 |
| 7 | Corps Participation | 34,72 | 742,11 | 169,25 | 42,87 |
| 14 | Barre Référence | 34,72 | 787,03 | 169,25 | 21,00 |
| 15 | Corps Référence | 34,75 | 809,29 | 169,25 | 22,65 |

### Actifs du modèle de base

| Rôle | Objet(s) | Position approximative |
|---|---|---|
| Icône téléphone | graphique 19 | `x 58,72`, `y 320,01`, 11,34 pt |
| Icône personnelle | groupe 29, ovale 24, graphique 25 | `x 31,12`, `y 279,29`, 8,50 pt |
| Icône localisation | graphique 28 | `x 52,07`, `y 300,55`, 8,50 pt |
| Logos Word/Excel/PowerPoint | images 22, 26, 30 | `x ≈ 42 pt`, `y 537,26 / 552,73 / 567,35 pt` |
| Drapeaux | images 31, 33, 32, 1026, 1028 | `x ≈ 40,7 pt`, `y 636,04 à 695,24 pt` |

Les objets d’icône de contact n’utilisent pas tous la même technologie. Cette hétérogénéité justifie leur remplacement par une bibliothèque SVG locale homogène.

## Annexe B — modifications structurelles de la copie 1

- Le squelette 40/41 reste identique.
- Le cadre photo 42 conserve `149,35 × 149,35 pt`, mais le portrait n’est pas visible dans le PDF de référence.
- Le nom et le titre conservent les dimensions du modèle de base.
- Le corps principal gagne environ `8,20 pt` de largeur par rapport au modèle de base.
- Expériences se déplace de `y 236,41` à `290,41 pt`.
- Formation se déplace de `y 484,53` à `528,05 pt`.
- Éducation remonte de `y 688,76` à `668,13 pt`, car il n’y a que deux formations.
- Compétences grandit de 4 à 7 lignes, ce qui pousse Logiciels de `y 505,20` à `581,40 pt`.
- Langues ne contient que trois lignes.
- Participation et ses deux objets disparaissent.
- Deux drapeaux disparaissent avec les langues absentes.
- Référence gagne de la hauteur pour afficher trois lignes.

## Annexe C — modifications structurelles de la copie 2

- Le squelette conserve les dimensions du bandeau et du cartouche.
- L’accent complet devient `#005C46`.
- La photo devient une image circulaire autonome de `153,07 × 153,07 pt`.
- Le nom court passe à 40 pt.
- Le bloc contacts descend à `y 245,90 pt` et utilise 10,5 pt.
- Objectif conserve la première ancre, mais Expériences descend à `y 300,28 pt`.
- Le corps Expériences atteint environ `347,29 pt` de hauteur nominale.
- Formation descend à `y 653,30 pt`.
- Éducation commence à `y 723,40 pt`.
- La colonne latérale passe à Langues, Compétences, Logiciels.
- Langues contient quatre lignes, Compétences douze et Logiciels trois.
- Participation et Référence disparaissent.
- Les logos Logiciels sont plus petits, autour de `9 × 9 pt`.
- Le dernier contenu visible descend à environ `y 831 pt` sur une page de `841,92 pt`, soit moins de 11 pt de marge. Le moteur ZGR doit réserver une marge de sécurité supérieure et paginer si nécessaire.

## Annexe D — règles de placement issues des trois variantes

| Règle | Formule fonctionnelle |
|---|---|
| Barre suivante | `ySuivant = basRéelDuBlocPrécédent + espaceSection` |
| Corps de section | `yCorps = yBarre + 21 pt + espaceAprèsBarre` |
| En-tête d’entrée | inline si `largeur(titre + séparateur + date) <= largeurDisponible`, sinon stacked |
| Section vide | hauteur zéro, barre et corps absents |
| Nom | plus grande taille de la liste autorisée qui tient dans la largeur |
| Colonne latérale | ordre nominal, puis ordre dense si dépassement |
| Densité | normale, compacte, puis page suivante |
| Bas de page | ne jamais placer du texte sous la limite de sécurité |
| Designer | zone cliquable issue du même rectangle calculé que le rendu PDF |
