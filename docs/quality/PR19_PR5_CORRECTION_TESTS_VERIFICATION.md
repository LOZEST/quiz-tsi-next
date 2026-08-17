# Vérification PR19 — PR5 correction et tests

## Base et périmètre

- Base : `0b1161df9b8fe92d6fbd308010b212059a5fb17b`.
- Branche : `feat/pr5-attempt-correction-flow`.
- Banque stable : 60 questions NUM de `quiz-tsi-official-num-v1` ; aucune nouvelle banque importée.
- Hors périmètre respecté : maîtrise, progression PR6, répétition espacée, Marketplace (n’est plus hors-scope depuis PR21, voir `docs/quality/PR21_QUIZZ_MARKETPLACE_VERIFICATION.md`), GPT/photo, formes Canvas et familles ALG/EQI/SUI.

## Contrats et règles

- `QuestionInstance` et `createQuestionInstance(...)` sont réutilisés. Le snapshot, la version, la seed et `parameterValues` restent identiques pour le prompt, l’indice et la correction.
- `QuestionAttemptState` porte l’état transitoire monotone (`startedAt`, `hintUsed`, `correctionViewed`, `timeExceeded`). Un draft borné par utilisateur et `QuestionInstance` est persisté dans IndexedDB.
- `QuestionEvaluation` est un événement terminé immuable. Son outcome est obligatoirement `success`, `partial`, `failed` ou `skipped`.
- `Réussi` dérive `success`, sauf aide ou dépassement qui dérive `partial`. `Raté` dérive `failed`. `Passer` dérive `skipped`. Aucun bouton partial ou « Presque réussi » n’existe.
- Une seconde complétion ne réécrit pas le premier événement. L’unicité append-only est imposée par `userId + questionInstanceId`, y compris si un autre identifiant d’évaluation est présenté.
- Le port `EvaluationRepository` est indépendant de React, IndexedDB et Supabase. `IndexedDbEvaluationRepository` utilise des clés et index préfixés par utilisateur et refuse les écritures intercompte et les doublons.
- Les sources `static`, `private` et `shared` sont conservées dans `questionSource` sans hypothèse réservée à la banque officielle.

## Indice et correction

- Les panneaux superposés conservent le Canvas et ses coordonnées.
- Les vrais boutons exposent `aria-expanded` et `aria-controls` ; Échap et Fermer ferment le panneau et le focus revient au déclencheur.
- L’ouverture de l’indice rend `hintUsed` vrai sans régénérer la question. Fermer le panneau ne réinitialise pas cette valeur.
- La correction utilise le contenu instancié issu du snapshot et de la même table de paramètres.

## Tests de chapitre

- `ChapterTestBlueprint` contient utilisateur, session, chapitre, quantité 20/40, seed, date et liste ordonnée de `FrozenQuestionInstance`.
- La sélection déterministe utilise le moteur seedé existant. Elle ne duplique aucune question, ne change pas de chapitre et ne relâche aucun filtre.
- Les tests domaine prouvent exactement 20 et 40 instances distinctes, l’ordre reproductible et les bornes de navigation.
- `ChapterTestSession` distingue `active`, `submitted` et `abandoned`. Soumission et abandon ne modifient plus un état terminé.
- `IndexedDbChapterTestRepository` isole les sessions par utilisateur et permet la reprise du blueprint et de la position.
- `IndexedDbQuestionAttemptRepository` restaure `startedAt`, `hintUsed`, `correctionViewed` et `timeExceeded` pour la même instance après navigation, changement d’écran, rechargement ou réouverture.
- À la reprise de la question courante, l’évaluation existante est recherchée par session et `questionInstanceId`, restaurée dans la tentative, puis bloque toute nouvelle complétion.
- Chaque Canvas de test utilise une clé comprenant la session et la `QuestionInstance`; la navigation restaure donc un brouillon indépendant.
- Les résultats affichent uniquement les comptages factuels success/partial/failed/skipped.

## Audit NUM

- Les 60 questions possèdent un indice et une correction structurés en `ContentSegment`.
- Les deux vecteurs normatifs de chaque question sont instanciés, soit 120 parcours complets prompt + indice + correction.
- Les tests vérifient : aucune référence `@` résiduelle, aucune structure JSON interne visible, analyse/rendu mathématique valides, produits explicites et parenthésage des valeurs négatives.
- Le cas `NUM-F01-F02`, `a = 12`, `b = -5`, conserve explicitement le produit et la fraction.
- Le classeur XLSX et son parseur ne sont pas embarqués au runtime.

## Preuves automatisées

- `EVALUATION-001` : indice, correction, Réussi donne `partial` avec `hintUsed: true`.
- `EVALUATION-002` : dépassement, Réussi donne `partial` avec `timeExceeded: true`.
- `EVALUATION-003` : un test RTL strict vérifie qu’après ouverture puis fermeture de la correction les boutons restent exactement Réussi, Raté et Question suivante. La phase pédagogique irréversible dépend de `correctionViewed`, indépendamment de la visibilité du panneau. Indice, Voir la correction, Passer, Partiellement réussi et Presque réussi sont absents. Question suivante avant évaluation conserve la question et affiche l’instruction normative.
- Ouvrir la correction ferme un panneau Indice encore visible sans réinitialiser `hintUsed`.
- Les tests de reprise prouvent qu’Indice puis navigation ou reload conserve `hintUsed` et transforme Réussi en `partial`; ils couvrent aussi la conservation de `timeExceeded` et `correctionViewed` par navigation.
- Une question évaluée est reprise avec la même `QuestionEvaluation`; une nouvelle évaluation de la même instance n’est pas ajoutée.
- `TEST-001` : le filtre de chapitre est transmis à la sélection et toutes les instances portent ce chapitre.
- `TEST-002` / `TEST-003` : 20 et 40 instances figées exactes.
- `TEST-004` : la clé de scène contient session et instance ; Playwright vérifie navigation et reprise.
- Vitest : 38 fichiers et 497 tests ; couverture globale 87,45 % statements, 82,11 % branches, 84,76 % fonctions et 90,30 % lignes.
- Playwright : desktop, iPad portrait et iPad paysage ; 72 scénarios lors de la suite complète. Le parcours PR5 utilise une question NUM réelle et couvre aide, correction, Canvas, évaluation, test 40, navigation, rechargement, reprise, soumission et résultat.

## Limites

- Aucun calcul de maîtrise, score ou synchronisation Supabase n’est ajouté.
- Les tests matériels Apple Pencil sur iPad réel restent une validation humaine ; Playwright couvre les viewports et événements pointeur émulés.
- L’avertissement Vite de chunk supérieur à 500 kB est préexistant et non bloquant pour le comportement PR5.
