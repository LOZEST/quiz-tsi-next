# Vérification PR20 / PR6 — Progression et tableau blanc avancé

## Traçabilité

- Base `origin/main` vérifiée : `c1ae048c0127025446a527249bb274547c5f8494`.
- Branche : `feat/pr6-progress-advanced-whiteboard`.
- Head d'implémentation et de preuves avant la présente correction documentaire : `ec68970`.
- Source historique vérifiée en lecture : `LOZEST/quizz-prepa` au SHA `8d0f7082194b0cdcf9c6bb10084361c52b40bd37`.
- Sources exactes : `scripts/scheduler.js`, `scripts/mastery/mastery-event.js`, `scripts/mastery/mastery-engine.js`, `scripts/mastery/mastery-policy.js`, `scripts/mastery/mastery-model.js`, `scripts/board-shapes.js`, `scripts/board-model.js`, `scripts/board.js`.
- Décision : `REFERENCE-ONLY` + `REWRITE`. Aucun module historique n'est importé ou copié. `LEGACY_INVENTORY.md` contient la caractérisation, les dépendances et les destinations.

## Progression locale

`QuestionEvaluation` reste l'unique journal append-only persistant. La projection pure et idempotente produit un `MasteryEvent` déterministe (`mastery:<evaluation.id>`), calcule la durée seulement depuis deux timestamps valides, déduplique les évaluations et refuse d'inventer le mode des anciennes séances. Les données non résolues sont conservées dans le journal source et la vue signale un snapshot partiel.

La politique centralisée `quiz-tsi-mastery-v1` applique :

- valeurs `success = 1`, `partial = 0.68`, `failed = 0`; `skipped` reste activité seulement ;
- récence `0.5 ^ (ageDays / 90)` ; répétition question `0.58 ^ previousSameQuestionCount` ; corrélation séance `0.8 ^ previousSameSessionCount` ;
- maîtrise = moyenne pondérée, bornée 0–100 et arrondie ;
- confiance = `12 * log2(1 + totalWeight) + 8 * distinctQuestionCount + 6 * distinctActiveDayCount + 4 * distinctSessionModeCount`, bornée et arrondie ;
- stabilité initiale 4 / 1,25 / 0,25 jours, multiplicateurs 2,2 / 1,2 / 0,35, bornes 0,08–180 jours ;
- statuts et difficulté recommandée conformes à la décision V1, avec horloge explicite.

Le plan du jour utilise une frontière de jour injectée. Son contenu dépend uniquement des preuves antérieures au début du jour; les événements du jour mesurent succès, partiels et échecs, et seuls les succès complets accomplissent le quota. Les états `none-scheduled`, `ready`, `completed` et `unavailable` gardent les messages normatifs PR4.

Les points faibles restent en calibration avant 8 preuves non `skipped` et 2 notions couvertes. Après calibration, l'ordre est déterministe, limité à 5, la priorité commence à 1, la difficulté vient de la politique V1 et `recurringErrors` reste `[]` faute de taxonomie réelle.

La page `/progress` affiche un indicateur principal, trois secondaires, travail du jour, grandes parties du `ProgramIndex`, calendrier réel sur 28 jours, points faibles et dix activités récentes maximum. Les notions sans preuve ne valent jamais 0; l'absence de preuve affiche une calibration. Partie, notion, historique, dates et tests liés restent fermés avant action volontaire.

## Tableau blanc V2

La scène courante porte `schemaVersion: 2` et conserve le contrat des strokes PR3. L'union ajoute neuf formes exactes : `line`, `arrow`, `rectangle`, `square`, `circle`, `triangle`, `axes`, `coordinate-system`, `trigonometric-circle`.

La géométrie pure valide nombres finis, dimensions strictement positives, rotation pertinente et `properties: {}` sans clé inconnue. Carré, cercle et cercle trigonométrique gardent leurs proportions à la création et au redimensionnement. Les primitives de rendu, bounds, hit-test, translation, resize et rotation ne dépendent ni de React, ni du DOM, ni de Canvas.

La restauration accepte les scènes V1 manuscrites et V2, migre de façon idempotente, conserve les coordonnées et strokes sans conversion ni doublon, et met seulement chaque shape invalide en quarantaine (`BOARD-007`, `BOARD-010`).

La toolbar principale contient Stylo, Gomme et Formes; la grille reste active par défaut et réglable dans Réglages Apple Pencil. Le sélecteur accessible fournit Sélection et les neuf formes, cibles tactiles, clavier, Échap et restauration du focus. Le Canvas natif place avec aperçu non persisté, sélectionne, déplace, redimensionne et tourne les shapes; sélection et aperçu ne sont pas persistés. Chaque placement, mouvement, resize, rotation ou suppression est une entrée d'historique atomique. Les strokes ne sont ni sélectionnés ni manipulés. La gomme utilise le hit-test géométrique des shapes (`BOARD-009`).

## Preuves exécutées

- Tests unitaires ciblés progression, géométrie, migration, contrôleur, toolbar et UI progression : **46 réussis**.
- Playwright ciblé `tests/browser/whiteboard.spec.ts`, projets desktop, iPad portrait et iPad paysage : **39 réussis**.
- Les commandes finales complètes et l'inspection `dist` sont consignées ci-dessous après leur exécution.

## Validation finale

Passe finale complète du 2026-08-10 :

- `npm run format:check` : réussi ;
- `npm run lint` : réussi (avertissement informatif ESLint sur les projets TypeScript multiples) ;
- `npm run typecheck` : réussi ;
- `npm run test:coverage` : 41 fichiers, 519 tests réussis; couverture globale 85,84 % statements, 81,02 % branches, 84,25 % functions, 88,43 % lines ;
- `npm run build` : réussi ;
- `npm run build:pages` : réussi avec fallback Pages ;
- `npm run test:browser` : 78 tests réussis sur desktop, iPad portrait et iPad paysage ;
- `git diff --check` : réussi.

Les deux builds signalent seulement le chunk JavaScript existant supérieur à 500 kB. L'inspection unique de `dist` ne trouve aucun secret connu, XLS/XLSX, `localStorage`, `eval`, `new Function`, nom de module historique copié ou ancienne dénomination de forme. `package.json` et `package-lock.json` sont inchangés : aucune dépendance de dessin ou autre dépendance npm n'a été ajoutée.

## Correctifs après audit du head `89d9db5`

L'audit fonctionnel de la PR a identifié deux blocages corrigés sans élargir PR6 :

- les conversions `worldPointToShapeLocal` et `shapeLocalPointToWorld`, les positions et hit-tests des handles de resize/rotation sont désormais des fonctions pures partagées par le renderer et le contrôleur ;
- une shape déjà sélectionnée teste le handle de rotation, puis le handle de resize, puis son corps, puis les autres shapes ; le handle de rotation reste donc interactif hors contour ;
- le resize d'une shape tournée est calculé dans son repère local en conservant l'ancre opposée, de sorte que le handle visible suit le pointeur ;
- rotation initiale, nouvelle rotation d'une shape déjà tournée, resize tourné, rejet de l'ancien emplacement non tourné et undo/redo exact sont couverts dans `CanvasController` ;
- la ligne fabriquée « Tests de chapitre liés » est masquée tant qu'aucune donnée factuelle n'existe ;
- les sept statuts métier restent inchangés dans le domaine et utilisent un mapping français unique dans l'interface élève.

Validation ciblée après correction : 37 tests Vitest réussis et le parcours Playwright rotation/resize/undo/redo réussi sur desktop, iPad portrait et iPad paysage (3/3).

Nouvelle passe finale complète après correction :

- `npm run format:check`, `npm run lint` et `npm run typecheck` réussis ;
- `npm run test:coverage` : 41 fichiers, 523 tests réussis, couverture globale 86,02 % statements, 81,39 % branches, 84,26 % functions et 88,59 % lines ;
- `npm run build` et `npm run build:pages` réussis, avec le seul avertissement informatif déjà documenté sur le chunk supérieur à 500 kB ;
- `npm run test:browser` : 78 tests réussis sur desktop, iPad portrait et iPad paysage ;
- `git diff --check` réussi après mise à jour du présent rapport.

## Limites manuelles

- Aucun iPad matériel ni Apple Pencil physique n'a été utilisé. Les projets Playwright iPad portrait/paysage valident les viewports et parcours automatisables, pas la sensation du Pencil, la pression matérielle ni la rotation physique.
- La validation humaine visuelle et la fusion restent requises par la Definition of Done.
