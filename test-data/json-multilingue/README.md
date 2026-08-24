# Jeux de données JSON multilingues

Ces fichiers contiennent les mêmes informations professionnelles traduites et adaptées au contexte de chaque langue. Ils couvrent les CV, les lettres de motivation et le document de conseils.

## Fichier global

`CV_TEST_GLOBAL_7_LANGUES.json` charge simultanément les sept langues disponibles : français, anglais, espagnol, allemand, italien, chinois et arabe. La clé `default_language` détermine la langue affichée lorsqu'aucune des langues importées n'est déjà active.

## Fichiers individuels

- `CV_TEST_FR_Francais.json`
- `CV_TEST_EN_English.json`
- `CV_TEST_ES_Espanol.json`
- `CV_TEST_DE_Deutsch.json`
- `CV_TEST_IT_Italiano.json`
- `CV_TEST_ZH_Chinois.json`
- `CV_TEST_AR_Arabe.json`

Chaque fichier individuel contient les métadonnées de langue et un objet `document` conforme à la structure directe reconnue par l'importateur.

## Procédure de test

1. Ouvrir `ZGR_CV_Autonome.html`.
2. Cliquer sur **Importer JSON**.
3. Choisir le fichier global ou un fichier individuel.
4. Changer de langue dans la barre supérieure.
5. Parcourir les modèles CV, lettres de motivation et conseils.
6. Contrôler l'aperçu, puis télécharger le modèle actuel ou le pack complet.

Le fichier global doit afficher un message d'import contenant `FR + EN + ES + DE + IT + ZH + AR`.
