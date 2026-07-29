# Vérification PR1

> Document non normatif. Les résultats finaux sont consignés avant publication de la pull request.

## Environnement

- Base : `048643369af0d2e589affdfcf0cebbc1db509f2d`
- Branche : `feat/pr1-application-foundation`
- Système : macOS arm64
- Node.js : `v24.14.1`
- npm : `11.11.0`
- Navigateur automatisé : Chromium 151 via Playwright 1.62.0

## Commandes et résultats

| Commande | Résultat |
|---|---|
| `npm ci` | Réussi ; 299 paquets installés depuis le lockfile |
| `npm run format:check` | Réussi |
| `npm run lint` | Réussi |
| `npm run typecheck` | Réussi |
| `npm run test:coverage` | 25 tests réussis ; seuils globaux > 80 % |
| `npm run build` | Réussi |
| `npm run build:pages` | Réussi ; `dist/404.html` généré |
| `npm run test:browser` | 27 tests réussis sur bureau, iPad portrait et iPad paysage |
| `git diff --check` | Réussi |

La prévisualisation Pages réelle a été démarrée automatiquement par Playwright avec `npm run preview:pages`.

## Scénarios d’acceptation PR1

| Scénario | Preuve automatique | Vérification manuelle restante |
|---|---|---|
| GLOBAL-001 | RTL et Playwright : quatre destinations exactes | inspection clavier et visuelle |
| GLOBAL-003 | RTL : Disclosure fermé, ouvert volontairement, ARIA | inspection visuelle |
| GLOBAL-004 | Playwright : cibles ≥ 44 × 44 px | iPad réel |
| GLOBAL-005 | RTL et Playwright : Échap et restauration du focus | clavier réel |
| A11Y-002 | Playwright : skip link et contour de focus | inspection visuelle et lecteur d’écran |
| A11Y-003 | Playwright : media `reduce` | inspection système |
| ROUTING-001 | Playwright sur build Pages et serveur 404 réel | navigation directe manuelle |

Les lignes restent **En cours** dans la matrice jusqu’à la validation humaine.

## Procédure manuelle

1. Exécuter `npm ci`, puis `npm run dev`.
2. Ouvrir l’URL locale.
3. Tabuler jusqu’au lien d’évitement et vérifier le focus.
4. Ouvrir le menu, parcourir les quatre destinations, puis fermer avec Échap.
5. Vérifier que le focus revient au bouton menu.
6. Tester portrait et paysage dans les DevTools.
7. Activer la réduction des mouvements.
8. Exécuter `npm run build:pages`, puis `npm run preview:pages`.
9. Ouvrir directement `/quiz-tsi-next/questions?type=course#details`.
10. Recharger et vérifier que chemin, query et hash sont conservés sans route dans le hash.

## Limites

- Aucun test sur iPad ou Apple Pencil réel.
- Aucun lecteur d’écran réel.
- Les workflows GitHub ne peuvent être observés qu’après push.
- `npm audit` signale un avis haut lié au mode RSC serveur de React Router ; PR1 utilise uniquement le routage SPA navigateur, sans RSC ni action serveur.
- Aucun code historique n’a été consulté ou copié.
