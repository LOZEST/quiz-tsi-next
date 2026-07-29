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
| `npm run test:coverage` | 39 tests réussis ; statements 86,45 %, branches 88 %, functions 84,09 %, lines 88,76 % |
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
- Aucun code historique n’a été consulté ou copié.

## Audit des dépendances

Les commandes `npm audit --omit=dev` et `npm audit --json` terminent avec le
code `1` et signalent deux entrées de sévérité haute : la dépendance transitive
`react-router` et la dépendance directe `react-router-dom`. Elles correspondent
au même avis :

- source npm : `1124282` ;
- identifiant GitHub : `GHSA-qwww-vcr4-c8h2` ;
- titre : « React Router: RSC Mode CSRF Bypass Allows Action Execution Before
  400 Response » ;
- sévérité : haute ;
- CWE : `CWE-352` ;
- plage vulnérable publiée : `react-router >=7.12.0 <8.3.0` ;
- version corrigée annoncée : `8.3.0`.

L’entrée `react-router` est transitive, installée sous
`node_modules/react-router`, touche la plage `7.12.0 - 8.2.0` et affecte
`react-router-dom`. L’entrée `react-router-dom` est directe, installée sous
`node_modules/react-router-dom`, et sa plage auditée est `>=7.12.0-pre.0`. Le
score CVSS fourni par npm vaut `0` avec un vecteur `null`. Les métadonnées de
l’audit comptent `2` avis hauts, `0` critique et `2` au total.

Au moment de cette correction, npm publie `react-router-dom@7.18.2` comme
dernière version stable et ne connaît pas `react-router-dom@8.3.0`. La suggestion
automatique de l’audit (`7.11.0`) est une rétrogradation hors plage touchée, pas
la version corrigée annoncée ; npm la qualifie en outre de changement SemVer
majeur. Elle n’est donc pas appliquée.

L’avis précise que l’exposition concerne les API RSC instables. PR1 n’utilise
que `BrowserRouter`, `Routes`, `Navigate`, `NavLink` et `useLocation` dans une
SPA rendue avec `createRoot` : aucun paquet ou API RSC, rendu serveur, action
serveur ou exécution d’action n’est présent. Le risque résiduel est accepté
temporairement pour PR1, car la dépendance reste formellement dans la plage
signalée et une évolution future pourrait introduire les API concernées.

Cette acceptation expire dès la publication d’une version stable corrigée
compatible, ou avant toute introduction de RSC, SSR ou action serveur. Le
contrôle de dépendances préalable à PR2 devra réévaluer l’avis ; il ne démarre
pas PR2 dans la présente pull request.
