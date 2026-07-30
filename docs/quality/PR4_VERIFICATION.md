# Vérification PR4 — Programme, questions et parcours

> **Statut initial :** table créée avant toute implémentation. Aucun état n'est marqué implémenté sans code et preuve.

| Exigence | Implémentation | Test automatique | Vérification manuelle | État réel | Justification |
|---|---|---|---|---|---|
| `SESSION-005` — filtre Réflexe non applicable | À créer | À créer | À réaliser | partiel | Contrat documentaire corrigé ; aucun code PR4 |
| `SESSION-007` — aucune révision prévue | À créer | À créer | À réaliser | partiel | Contrat documentaire défini ; aucun code PR4 |
| `SESSION-008` — révision terminée | À créer | À créer | À réaliser | partiel | Contrat documentaire défini ; aucun code PR4 |
| `SESSION-009` — points faibles en calibration | À créer | À créer | À réaliser | partiel | Contrat documentaire défini ; aucun code PR4 |
| `SESSION-010` — configuration du futur test | À créer | À créer | À réaliser | partiel | Contrat documentaire défini ; passation réservée à PR5 |
| `IMPORT-007` — aucune banque validée | À créer | À créer | À réaliser | partiel | Message et comportement documentaire définis |
| Programme versionné et validé | À créer | À créer | À réaliser | partiel | Ancien programme caractérisé, conversion non réalisée |
| Parser mathématique v1 sécurisé | À créer | À créer | À réaliser | partiel | Grammaire normative existante, aucun parser PR4 |
| Génération déterministe par seed | À créer | À créer | À réaliser | partiel | Contrat existant, aucun générateur PR4 |
| Import versionné, idempotent et traçable | À créer | À créer | À réaliser | partiel | Contrats définis ; fixtures de test uniquement |
| Banque historique de production | Aucun | Sans objet avant validation | Revue licence/provenance requise | bloqué | Licence, droits, provenance et conversions non validés |
| Sélection et filtres dépendants | À créer | À créer | À réaliser | partiel | Contrats documentaires existants |
| Instance liée au brouillon Canvas | À créer | À créer | À réaliser | partiel | PR3 utilise encore la scène globale `main` |
| Réflexe 60 secondes | À créer | À créer | À réaliser | partiel | Évaluation du dépassement réservée à PR5 |
| Algorithmes `daily` et `weak-points` | Aucun en PR4 | Sans objet PR4 | Sans objet PR4 | hors périmètre | Calculs définitifs attribués à PR6 |
| Démarrage et blueprint `chapter-test` | Aucun en PR4 | Sans objet PR4 | Sans objet PR4 | hors périmètre | Passation intégralement attribuée à PR5 |

## Banque attendue

Sans banque validée, l'application doit afficher : « Aucune banque de questions validée n’est disponible pour le moment. »

Le fichier attendu est un bundle conforme à `QuestionBankBundle`, avec version de schéma, identifiant de bundle, date de génération, provenance fournie sans invention et entrées de questions conformes aux contrats du domaine. Toute source historique LaTeX ou HTML nécessite en plus son format source original, un convertisseur versionné, un rapport et une quarantaine vérifiable.

## Portes de validation

Après chaque bloc : `npm run format:check`, `npm run lint`, `npm run typecheck` et tests unitaires concernés. L'interface ne commence qu'après validation du programme, des questions, de la sélection, du parser et de la reproductibilité des instances.
