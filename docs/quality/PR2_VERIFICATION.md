# Vérification PR2

> Document non normatif. Résultats constatés avant publication de la pull
> request.

## Environnement et révisions

- Base : `946e523ad21926bcc20e63ed8efc60883d1d023f`
- Candidat testé : `516a7ba` avec le commit documentaire suivant non fonctionnel
- Branche : `feat/pr2-auth-user-workspace`
- Système : macOS arm64
- Node.js : `v24.14.1`
- npm : `11.11.0`
- Navigateur automatisé : Chromium 151 via Playwright 1.62.0

## Dépendances ajoutées

- `@supabase/supabase-js` `2.111.0`
- `idb` `8.0.3`
- `fake-indexeddb` `6.2.5` en développement
- Supabase CLI `2.110.0` verrouillée dans les scripts npm, non installée comme
  dépendance du projet

## Configuration sans secret

Le navigateur accepte uniquement `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY`. `.env.example` contient des valeurs locales
indicatives. Aucun environnement réel, token, session, mot de passe personnel,
secret JWT ou clé `service_role` n’est committé.

Playwright construit une prévisualisation avec
`VITE_AUTH_ADAPTER=controlled`. Cet adapter déterministe n’est jamais activé
par défaut, ne contient aucun secret et ne persiste jamais le mot de passe.

## Commandes et résultats

| Commande | Résultat |
|---|---|
| `npm ci` | Réussi ; 309 paquets installés, 310 audités. Une première exécution dans le sandbox a échoué sur DNS puis l’exécution avec réseau autorisé a réussi. |
| `npm run format:check` | Réussi |
| `npm run lint` | Réussi ; avertissement informatif du resolver sur les multiples tsconfig, aucune alerte ESLint |
| `npm run typecheck` | Réussi |
| `npm run test:coverage` | 72 tests réussis ; statements 85,88 %, branches 80,62 %, functions 86,59 %, lines 90,05 % |
| `npm run build` | Réussi ; 122 modules transformés |
| `npm run build:pages` | Réussi ; fallback `dist/404.html` généré |
| `npm run test:browser` | 36 tests réussis : 12 desktop, 12 iPad portrait, 12 iPad paysage |
| `npm audit --omit=dev` | 2 avis hauts liés au même avis React Router RSC, aucun critique |
| `git diff --check` | Réussi |

La prévisualisation Pages réelle a été démarrée automatiquement par Playwright
sur `http://127.0.0.1:4173/quiz-tsi-next/`.

## Supabase et RLS

Migration ajoutée :
`supabase/migrations/20260729000100_create_profiles.sql`.

Elle crée `profiles`, la contrainte des trois rôles, les timestamps, le trigger
de profil `user`, active RLS, autorise uniquement la lecture de son propre
profil et révoque les écritures navigateur. Les fonctions ont un `search_path`
explicite et des privilèges minimaux.

Les tests pgTAP `supabase/tests/profiles_rls.sql` n’ont pas été exécutés :
Docker et Supabase CLI ne sont pas disponibles sur cette machine. Ils restent
reproductibles avec :

```bash
npm run supabase:start
npm run supabase:reset
npm run test:rls
npm run supabase:stop
```

La validation RLS reste donc **En cours** et ne doit pas être présentée comme
réussie.

## IndexedDB, concurrence et hors connexion

Une base commune versionnée partitionne chaque enregistrement par `userId`.
Son nom ne contient ni email ni identifiant utilisateur. L’ouverture et la
fermeture sont explicites. Une génération active associe chaque mutation au
compte attendu.

Les tests contrôlent l’ouverture A, la fermeture, l’ouverture B, l’isolation
des profils, la suppression ciblée et la réponse A tardive après activation de
B. Le profil local n’est mis en cache qu’après validation serveur.

Le démarrage hors connexion exige une session SDK non expirée et un profil
précédemment validé. Le shell annonce les limites ; le rôle local reste
informatif et ne donne accès à aucune opération sensible. Aucun service worker
ni synchronisation métier n’a été ajouté.

## Scénarios d’acceptation

`AUTH-001`, `AUTH-002`, `AUTH-003`, `AUTH-004`, `ACCOUNT-001`,
`ACCOUNT-002` et `SYNC-002` passent de **À implémenter** à **En cours**. Aucun
scénario n’est marqué **Validé** sans recette humaine.

## Avis npm

`npm audit --omit=dev` signale l’avis
`GHSA-qwww-vcr4-c8h2` sur `react-router` et `react-router-dom`. La commande
propose `react-router-dom@7.11.0` via `--force`, soit une rétrogradation
qualifiée de breaking change, pas une version corrigée compatible. Comme en
PR1, l’application n’utilise ni RSC, ni SSR, ni action serveur. Aucun override
ou affaiblissement n’est appliqué.

## Vérifications manuelles restantes

- recette avec trois comptes temporaires sur Supabase local ou dev ;
- attribution serveur `admin` et `owner` ;
- exécution des tests RLS avec Docker ;
- connexion, expiration et rafraîchissement sur un vrai projet Supabase dev ;
- coupure réseau réelle après profil validé ;
- changement manuel A vers B ;
- clavier et lecteur d’écran réels ;
- iPad portrait et paysage réel ;
- inspection visuelle de la page compte et du tiroir ;
- observation de la CI et de la prévisualisation distante après push.

## Hors périmètre confirmé

Aucun Canvas, Pencil, dessin, question, progression, PWA, service worker,
parser mathématique, import historique, gestion d’utilisateurs, modification
de rôle côté UI ou administration complète n’est ajouté. PR3 n’a pas commencé.
