# Vérification du portail client — 24 octobre 2026

## Correction publiée

Commit `2318432` poussé sur `main`. Assets du portail synchronisés dans
`public/_next`, routes Pages `/_next/*` et `/c/_next/*` ajoutées. Le proxy HTML
référence `/c/_next/*` pour isoler les anciennes réponses HTML mises en cache
aux adresses des scripts et styles. Le calcul du chemin d’asset ne concatène
plus deux fois le chemin URL et les paramètres de route.

Cloudflare Pages et le Worker de stockage ont été déployés. Les scripts et
styles renvoient HTTP 200 avec les types JavaScript/CSS attendus.

## Contrôles

- 7 tests de la passerelle Pages réussis, dont résolution du chemin, rejet non mis
  en cache d’un fallback HTML pour un script manquant et isolation
  du cache historique ; 58 tests unitaires réussis ; contrôle PWA réussi.
- Ancien lien signalé : formulaire initial chargé après rechargement.
- Une seule nouvelle invitation vide créée avec autorisation, puis utilisée pour
  le seul dossier technique. Aucun dossier réel modifié.
- TXT fictif refusé avec message explicite, conformément aux formats publics acceptés.
- Même contenu fictif converti en PDF, relu visuellement puis envoyé dans le même
  dossier après autorisation de l’enregistrement technique.
- Dossier `CPT-20261024-37F28E`, nom `TEST TECHNIQUE ZGR`, email fictif
  `test-zgr@example.com`, statut D1 `RECEIVED`.
- Fichier `test-depot-zgr.pdf`, 1 736 octets, retrouvé dans le bucket privé R2
  `cv-pro-team-clients-files`. Lecture R2 et empreinte SHA-256 comparées avec
  le fichier local et l’enregistrement D1 : concordance dans les deux cas.
- Réouverture du lien : les champs du dossier sont restaurés et le PDF déposé est
  présent dans l’étape des fichiers. Aucun second envoi n’a été effectué.

Le dossier est volontairement conservé et identifié comme test. Aucun email,
document de client réel ou candidature à un tiers n’a été utilisé. Aucun objet
ni dossier existant supprimé. Ce contrôle valide le parcours de dépôt testé,
pas une garantie exhaustive sur tous les services de la plateforme.
