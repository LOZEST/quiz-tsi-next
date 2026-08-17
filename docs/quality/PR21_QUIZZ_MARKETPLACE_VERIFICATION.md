# PR21 — Marketplace de Quizz

## Périmètre

- Renommage du conteneur personnel `PersonalCourse` → `Quizz` (domaine,
  infrastructure, UI). `courseId` persisté dans `Question.classification` et
  le nom physique du store IndexedDB restent inchangés.
- Marketplace : publication d'un Quizz (`/questions` → `PublishQuizzDialog`),
  visible **immédiatement** sur `/marketplace` (pas de statut
  `pending`/`approved`/`rejected`).
- Certification (`certified`) : booléen par listing, action admin manuelle et
  indépendante de la publication.
- Modération de retrait (`hidden`) : booléen par listing, action admin
  distincte de la certification.
- Abonnement (`subscribeToListing`) : accès en lecture/jeu **par référence**
  au Quizz original, via `quizz_listing_subscriptions` — aucune copie de
  quizz/chapitre/notion/question, aucun nouvel `ownerId`.
- Notation : réservée aux comptes abonnés (vérifié côté serveur), popup de
  notation ignorable affichée après un abonnement réussi.
- Socle de schéma économique inerte (`price_coins`, `quality_score`,
  `purchase_count`) — non lu ni fait varier par une fonctionnalité actuelle.
- Addendum : les Quizz privés/partagés/abonnés de l'utilisateur alimentent
  désormais le repository de jeu des sessions (`MergedQuestionRepository`),
  en plus de la banque statique.

## Mécanisme d'accès par référence

`supabase/migrations/20260819000200_quizz_marketplace.sql` étend la policy
RLS `questions_read_accessible` (et ajoute des policies équivalentes sur
`quizzes`, `quizz_chapters`, `quizz_notions`) pour autoriser la lecture quand
il existe une ligne dans `quizz_listing_subscriptions` correspondant à
l'utilisateur courant et au listing propriétaire du Quizz. Aucune donnée
n'est dupliquée : c'est cette policy qui matérialise l'accès, pas une copie.

## Vérification manuelle (deux comptes, serveur de dev)

1. `user@example.test` crée un Quizz dans `/questions`, le publie — il
   apparaît immédiatement sur `/marketplace`, sans étape d'attente.
2. `owner@example.test` (`/admin`, panneau Marketplace) certifie ce listing —
   le badge « Quizz certifié » apparaît uniquement sur ce listing. Masquer un
   autre listing le retire de `/marketplace`.
3. Un troisième compte ouvre l'aperçu (lecture seule), s'abonne — la popup de
   notation apparaît et peut être fermée sans bloquer la navigation. Le Quizz
   apparaît dans `/questions` sous « Abonnements », en lecture/jeu seule.
4. `user@example.test` modifie le Quizz original — la modification se
   répercute côté abonné (référence vivante, pas de copie figée).
5. Un utilisateur non abonné ne peut pas noter (widget désactivé côté client
   et RPC `rate_quizz_listing` qui refuse côté serveur).
6. Noter en tant qu'abonné met à jour la moyenne affichée.

## Automatisé

- `tests/unit/domain/quizz-listing.test.ts`, validation du domaine
  (`certified`/`hidden`, score de notation).
- `tests/unit/questions/quizz-marketplace-gateway.test.ts`, triade infra.
- `tests/browser/quizz-marketplace.spec.ts`, flux complet (publication
  immédiate, certification/masquage admin, abonnement, popup de notation).
