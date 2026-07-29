# Quiz TSI Next

Application de révision pour la prépa TSI, pensée d’abord pour l’iPad et l’Apple Pencil.

## État du projet

PR3 ajoute le moteur manuscrit du tableau blanc : Canvas 2D natif, stylo avec
pression et inclinaison, gomme par collision, grille, undo/redo, toolbar
responsive et scènes IndexedDB isolées par compte. Les formes sont reportées à
PR6 ; les questions et la progression restent hors périmètre jusqu’aux PR
responsables.

## Prérequis

- Node.js 24 LTS (`.nvmrc`)
- npm 11

## Installation et développement

```bash
nvm use
npm ci
npm run supabase:start
npm run supabase:reset
npm run dev
```

Vite affiche l’URL locale à ouvrir.

Copier `.env.example` vers `.env.local`, puis renseigner uniquement :

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<clé anon locale>
```

Ces valeurs sont publiques par conception. Une clé `service_role`, un mot de
passe de base, un JWT secret ou un identifiant personnel ne doivent jamais
être placés dans une variable `VITE_*` ni committés.

Supabase local applique les migrations de `supabase/migrations`. L’inscription
publique est désactivée. Créer les utilisateurs temporaires via Supabase Studio
local. Le trigger crée chaque profil avec le rôle `user`. Pour une recette
locale, attribuer `admin` ou `owner` uniquement depuis l’éditeur SQL local avec
un rôle serveur autorisé :

```sql
update public.profiles
set role = 'admin'
where user_id = '<uuid temporaire>';
```

Cette opération n’est pas exposée au navigateur.

## Qualité et tests

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:coverage
npx playwright install chromium
npm run test:browser
npm run test:rls
```

Les tests navigateur utilisent Chromium avec trois profils : bureau, iPad portrait et iPad paysage. Ces profils reproduisent les viewports et interactions tactiles ; ils ne remplacent pas une recette sur iPad réel.

Les tests navigateur construisent une prévisualisation avec un adapter
d’authentification contrôlé par `VITE_AUTH_ADAPTER=controlled`. Cet adapter
existe uniquement pour Playwright, n’est pas un compte de démonstration et ne
contient aucun secret. Ne jamais définir cette variable dans un déploiement.

Les tests RLS nécessitent Docker. Leur séquence reproductible est :

```bash
npm run supabase:start
npm run supabase:reset
npm run test:rls
npm run supabase:stop
```

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
- `src/domain` : contrats Auth et Workspace purs
- `src/infrastructure` : adapters Supabase et IndexedDB
- `tests/unit` : composants, routes et fallback Pages
- `tests/browser` : clavier, tactile, responsive, accessibilité et routes profondes
- `scripts` : génération et prévisualisation du fallback Pages

## Limites actuelles

- aucune inscription publique ni récupération de mot de passe ;
- aucune forme ou opération vectorielle avant PR6 ;
- aucune question, progression ou synchronisation métier ;
- hors connexion limité à une session SDK non expirée et un profil local déjà
  validé ; rôle informatif, aucune opération sensible ;
- aucun service worker ou PWA ;
- aucune recette sur iPad ou avec un lecteur d’écran réel.

## Documentation normative

- Produit : [spécification produit](docs/product/PRODUCT_SPEC.md), [parcours utilisateur](docs/product/USER_FLOWS.md) et [création de questions](docs/product/QUESTION_AUTHORING_SPEC.md)
- Design : [design system](docs/design/DESIGN_SYSTEM_SPEC.md) et [expérience du tableau blanc](docs/design/WHITEBOARD_EXPERIENCE_SPEC.md)
- Architecture : [architecture technique](docs/architecture/TECHNICAL_ARCHITECTURE.md) et [modèle de domaine](docs/architecture/DOMAIN_MODEL.md)
- Héritage : [politique de migration](docs/legacy/LEGACY_MIGRATION_POLICY.md) et [inventaire](docs/legacy/LEGACY_INVENTORY.md)
- Livraison : [roadmap](docs/roadmap/IMPLEMENTATION_ROADMAP.md), [matrice d’acceptation](docs/acceptance/ACCEPTANCE_MATRIX.md) et [Definition of Ready/Done](docs/quality/DEFINITION_OF_DONE.md)

La hiérarchie définie dans ces documents reste l’autorité. La chaîne courante est PR1 → PR1.1 documentaire → PR2 ; PR2 ne commence qu’après fusion de la clarification PR1.1.
