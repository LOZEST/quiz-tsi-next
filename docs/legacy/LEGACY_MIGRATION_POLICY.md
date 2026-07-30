# Politique de migration historique

> **Objectif :** autoriser une récupération sélective et traçable depuis `LOZEST/quizz-prepa`. **Document normatif.**

## Sommaire
1. [Règles](#règles-impératives) · 2. [Décisions](#classification) · 3. [Dossier de migration](#dossier-de-migration) · 4. [Données](#données-et-schémas) · 5. [Validation](#validation)

## Règles impératives

1. Aucun copier-coller global.
2. Aucun import direct depuis l'ancien dépôt.
3. Aucun ancien HTML ou CSS.
4. Aucun ancien composant de navigation.
5. Aucun ancien contrôle caché.
6. Aucun accès DOM repris dans le domaine.
7. Aucun `localStorage` global repris.
8. Aucun identifiant DOM conservé pour compatibilité seule.
9. Aucun module migré sans test de caractérisation.
10. Chaque migration documente fichier et commit sources, comportement conservé/modifié, nouveau fichier et tests.
11. Les données passent par des convertisseurs versionnés.
12. Scène, question, progression et préférences persistées portent `schemaVersion`.
13. Toute migration est idempotente.
14. Toute donnée invalide est mise en quarantaine au lieu de bloquer l'application.

L'ancien dépôt est lu seulement. Chaque élément est identifié, caractérisé, extrait sans DOM historique, converti aux contrats TypeScript, intégré dans sa PR dédiée et documenté avec son origine.

## Classification

- **PORT** : logique pure, contrats proches, peu de changement.
- **PORT-WITH-ADAPTER** : logique utile couplée à des contrats historiques ; adapter aux ports actuels.
- **REWRITE** : comportement utile, architecture incompatible ; réimplémenter depuis tests/règles.
- **REFERENCE-ONLY** : sert à comprendre ou comparer, aucun code copié.
- **DISCARD** : interface, rustine ou structure abandonnée.

Une décision porte sur un chemin et un commit précis, jamais sur une catégorie vague. `DISCARD` exige une justification produit ; une capacité utile ne disparaît pas implicitement.

## Dossier de migration

Chaque PR fournit ce manifeste Markdown : dépôt ; chemin exact ; SHA source immuable ; décision ; responsabilités/dépendances constatées ; dépendances DOM, `localStorage`, Supabase ; tests historiques ; tests de caractérisation ajoutés ; comportements conservés et modifiés ; destination ; convertisseur/version ; risques et licence. Le code nouveau ne dépend jamais du checkout historique.

Caractériser d'abord avec entrées/sorties représentatives, limites, erreurs, déterminisme, sérialisation et propriétés métier. Un test ne doit pas figer un bug sans décision explicite. Pour une donnée, conserver fixture minimale autorisée, provenance et empreinte ; jamais une copie générale.

## Données et schémas

Un convertisseur lit une version explicite, valide sans exécution dynamique, normalise vers les contrats du domaine, produit un rapport et met les rejets en quarantaine. Deux exécutions donnent le même résultat. Une migration interrompue reprend sans doublon. Les schémas futurs ne réinterprètent jamais silencieusement une ancienne valeur.

Une banque historique n'est importable en production qu'après validation documentée de sa licence ou de son droit d'utilisation, de ses droits de modification et redistribution, de sa provenance, de son rattachement au programme et de sa qualité pédagogique. Le LaTeX et le HTML historiques passent par des convertisseurs versionnés et validés vers `MathSource` et `ContentSegment`; ils ne sont jamais rendus directement. La source originale est conservée avec le rapport et toute ambiguïté est mise en quarantaine. Tant que ces preuves manquent, la banque porte le statut `BLOCKED` et seules des fixtures minimales réservées aux tests peuvent exercer l'importer générique.

## Validation

La PR responsable dans la roadmap doit être fusionnée au préalable. Revue obligatoire : provenance, licence, test de caractérisation, absence DOM/global, isolation de compte, données invalides, idempotence, comparaison ancien/nouveau et mise à jour de `LEGACY_INVENTORY.md`. Aucun remote, sous-module, archive ou code historique complet n'est commité.
