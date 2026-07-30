# Vérification PR3

> Document non normatif. Résultats constatés avant publication de la pull
> request.

## Environnement et révisions

- Base fusionnée : `42cb1cef3d96a56257739ecb18e6ee5027be4f61`
- Candidat fonctionnel initial : `93b9c81`
- Durcissement Pencil testé : `5dac2e6`
- Branche : `feat/pr3-whiteboard-engine`
- Système : macOS arm64
- Node.js : `v24.14.1`
- npm : `11.11.0`
- Navigateur automatisé : Chromium 151 via Playwright 1.62.0

La base inclut la décision documentaire fusionnée par la PR #7 : PR3 porte
uniquement le moteur manuscrit. Les formes et les opérations vectorielles sont
reportées à PR6.

## Architecture

Le moteur est séparé de React :

- `src/domain/whiteboard` définit l'enveloppe de scène versionnée, les traits
  et la restauration tolérante ;
- `src/features/whiteboard/canvas` contient coordonnées, rendu, grille,
  contrôleur et composant Canvas ;
- `src/features/whiteboard/tools` contient stylo, gomme par collision et
  gestionnaire d'outil ;
- `src/features/whiteboard/model` contient points, traits, état et snapshots ;
- `src/features/whiteboard/hooks` relie les Pointer Events au contrôleur ;
- `src/features/whiteboard/components` compose la toolbar et la surface ;
- le repository IndexedDB PR2 stocke les scènes sous une clé partitionnée par
  compte et refuse les générations de workspace obsolètes.

React ne reçoit pas chaque mouvement. Le contrôleur conserve la scène active
hors du cycle React, traite les événements coalescés et ne publie un commit
qu'à la fin du geste ou d'une opération undo/redo.

## Choix Canvas natif

Le rendu utilise exclusivement Canvas 2D HTML5 et les Pointer Events natifs.
Aucune bibliothèque de dessin n'est ajoutée. Les entrées conservent
`pointerType`, pression normalisée, inclinaisons, timestamp et coordonnées
logiques.

Le rendu est planifié avec `requestAnimationFrame`. Le ratio de pixels est
borné à 2. Le redimensionnement est idempotent et le passage portrait/paysage
utilise une transformation uniforme centrée : les coordonnées et proportions
logiques ne changent pas.

## Isolation du pointeur actif

Le contrôleur conserve l'identifiant et le type du pointeur actif. Après un
`pointerdown` Pencil ou souris accepté, tout mouvement, relâchement,
`pointercancel` ou `lostpointercapture` provenant d'un autre pointeur est
ignoré. Un doigt, une paume ou un second pointeur ne peut donc ni ajouter un
point au trait actif, ni le terminer, ni libérer sa capture.

La fin et l'annulation remettent l'état actif à zéro. La capture n'est libérée
que si le Canvas la possède encore ; une perte concurrente ne propage aucune
exception. Une annulation ou perte de capture conserve et persiste le trait
partiel déjà reçu, puis autorise immédiatement un nouveau geste.

Lorsque `getCoalescedEvents()` est absent ou renvoie une liste vide,
l'événement `pointermove` courant est utilisé comme échantillon de secours.

## Outils et stockage

- stylo avec largeur réglable et épaisseur influencée par la pression ;
- gomme supprimant les traits touchés, sans peinture blanche ;
- grille purement visuelle, désactivée par défaut ;
- undo/redo par snapshots de scène ;
- modes droitier et gaucher déplaçant la toolbar ;
- tiroir superposé sans redimensionnement du Canvas ;
- persistance et restauration du brouillon principal dans IndexedDB ;
- isolation A/B et suppression ciblée des scènes d'un compte ;
- migration idempotente vers `schemaVersion: 1` et quarantaine objet par
  objet.

## Commandes et résultats

| Commande | Résultat |
|---|---|
| `npm run format:check` | Réussi |
| `npm run lint` | Réussi ; avertissement informatif du resolver sur les multiples tsconfig |
| `npm run typecheck` | Réussi |
| `npm run test:coverage` | 106 tests réussis |
| Couverture | statements 89,39 %, branches 82,12 %, functions 85,02 %, lines 93,54 % |
| `npm run build` | Réussi ; 141 modules transformés |
| `npm run build:pages` | Réussi ; fallback Pages généré |
| `npm run test:browser` | 48 tests réussis : 16 bureau, 16 iPad portrait, 16 iPad paysage |
| `git diff --check` | Réussi |

Vitest/JSDOM annonce que son Canvas ne fournit pas `getContext` sans paquet
`canvas`. Le moteur de rendu est testé avec un contexte 2D contrôlé et le vrai
Canvas Chromium est couvert par Playwright. Aucune dépendance native n'a été
ajoutée pour masquer cette différence d'environnement.

## Performance

Les tests construisent une scène d'au moins 1 000 traits et couvrent le rendu
hors React. Le moteur limite le ratio de pixels, regroupe les échantillons
coalescés et planifie les rafraîchissements avec `requestAnimationFrame`.

La fluidité visuelle a été exercée dans la prévisualisation Chromium des trois
profils. Aucune mesure instrumentée sur iPad physique n'a été réalisée ; la
cible « sans ralentissement visible » reste à confirmer lors de la recette
matérielle.

## Recette iPad automatisée

Les profils Playwright utilisent exactement :

- portrait : `768 × 1024` ;
- paysage : `1024 × 768`.

Ils vérifient l'accès après connexion, le Canvas, le tiroir, la géométrie
immobile à son ouverture, les outils, la grille, l'écriture souris, la
persistance après rechargement, les limites du viewport, les cibles tactiles,
Échap, le focus et Axe.

La prévisualisation Pages a été démarrée sur
`http://127.0.0.1:4173/quiz-tsi-next/` par Playwright.

## Limites et recette manuelle restante

- aucune question, parcours, correction, progression ou synchronisation cloud ;
- aucune forme, ligne, rectangle, cercle, flèche, sélection, déplacement ou
  redimensionnement d'objet conformément au report validé vers PR6 ;
- aucune recette avec un iPad et un Apple Pencil réels ;
- pression, inclinaison, rejet du doigt et fluidité à 1 000 traits à confirmer
  sur matériel ;
- aucun test lecteur d'écran réel ;
- les tests RLS PR2 n'ont pas été rejoués, PR3 ne modifiant aucune politique
  Supabase ;
- la CI et la prévisualisation distante restent à observer après le push.
