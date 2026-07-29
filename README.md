# Quiz TSI Next

Application de révision pour la prépa TSI, pensée d’abord pour l’iPad et l’Apple Pencil.

## État du projet

PR1 fournit le socle exécutable : Vite, React, TypeScript strict, routes, shell accessible, design system minimal, tests, CI et build GitHub Pages. L’authentification, le tableau blanc, les questions et toute logique métier restent volontairement absents.

## Prérequis

- Node.js 24 LTS (`.nvmrc`)
- npm 11

## Installation et développement

```bash
nvm use
npm ci
npm run dev
```

Vite affiche l’URL locale à ouvrir.

## Qualité et tests

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:coverage
npx playwright install chromium
npm run test:browser
```

Les tests navigateur utilisent Chromium avec trois profils : bureau, iPad portrait et iPad paysage. Ces profils reproduisent les viewports et interactions tactiles ; ils ne remplacent pas une recette sur iPad réel.

## Builds et prévisualisation

```bash
npm run build
npm run preview
npm run build:pages
npm run preview:pages
```

La prévisualisation Pages est disponible sur `http://127.0.0.1:4173/quiz-tsi-next/`.

Le mode Pages construit l’application sous `/quiz-tsi-next/`, génère `dist/404.html`, puis le serveur de prévisualisation reproduit la réponse 404 statique de GitHub Pages. Le fallback transporte le chemin, la query string et le hash vers l’index ; l’application restaure ensuite l’URL avec `history.replaceState` avant d’initialiser React Router. Aucun `HashRouter` n’est utilisé.

Après fusion sur `main`, activer si nécessaire le déploiement via GitHub → Settings → Pages → Source → GitHub Actions.

## Structure

- `src/app` : bootstrap, routage et erreurs globales
- `src/pages` : composition des routes temporaires
- `src/design-system` : tokens, styles et composants génériques
- `src/features` : futurs cas d’usage
- `src/domain` : futurs contrats et règles purs
- `src/infrastructure` : futurs adaptateurs
- `tests/unit` : composants, routes et fallback Pages
- `tests/browser` : clavier, tactile, responsive, accessibilité et routes profondes
- `scripts` : génération et prévisualisation du fallback Pages

## Limites actuelles

- aucune authentification ou session ;
- aucun Canvas ou support Pencil réel ;
- aucune donnée, question, progression ou préférence ;
- aucun stockage, mode hors connexion, service worker ou PWA ;
- aucune recette sur iPad ou avec un lecteur d’écran réel.

## Documentation normative

- Produit : [spécification produit](docs/product/PRODUCT_SPEC.md), [parcours utilisateur](docs/product/USER_FLOWS.md) et [création de questions](docs/product/QUESTION_AUTHORING_SPEC.md)
- Design : [design system](docs/design/DESIGN_SYSTEM_SPEC.md) et [expérience du tableau blanc](docs/design/WHITEBOARD_EXPERIENCE_SPEC.md)
- Architecture : [architecture technique](docs/architecture/TECHNICAL_ARCHITECTURE.md) et [modèle de domaine](docs/architecture/DOMAIN_MODEL.md)
- Héritage : [politique de migration](docs/legacy/LEGACY_MIGRATION_POLICY.md) et [inventaire](docs/legacy/LEGACY_INVENTORY.md)
- Livraison : [roadmap](docs/roadmap/IMPLEMENTATION_ROADMAP.md), [matrice d’acceptation](docs/acceptance/ACCEPTANCE_MATRIX.md) et [Definition of Ready/Done](docs/quality/DEFINITION_OF_DONE.md)

La hiérarchie définie dans ces documents reste l’autorité. PR2 ne commence qu’après fusion de PR1.
