# Règles impératives — Quiz TSI Next

Lis, avant tout changement, les documents normatifs dans cet ordre :

1. `docs/product/PRODUCT_SPEC.md` — comportement produit.
2. `docs/product/USER_FLOWS.md` — parcours utilisateur.
3. `docs/product/QUESTION_AUTHORING_SPEC.md` — création de questions et langage mathématique.
4. `docs/design/DESIGN_SYSTEM_SPEC.md` — rendu et composants visuels.
5. `docs/design/WHITEBOARD_EXPERIENCE_SPEC.md` — expérience du tableau blanc.
6. `docs/architecture/TECHNICAL_ARCHITECTURE.md` — architecture logicielle.
7. `docs/architecture/DOMAIN_MODEL.md` — contrats métier.
8. `docs/acceptance/ACCEPTANCE_MATRIX.md` — preuves nécessaires.
9. `docs/quality/DEFINITION_OF_DONE.md` — conditions de fin.
10. `docs/roadmap/IMPLEMENTATION_ROADMAP.md` — ordre des PR.
11. `docs/legacy/LEGACY_MIGRATION_POLICY.md` — récupération autorisée.
12. `docs/legacy/LEGACY_INVENTORY.md` — inventaire réellement constaté.

La hiérarchie normative détermine le document faisant autorité.

Toute contradiction détectée doit néanmoins être signalée.

Codex ne doit jamais choisir silencieusement entre deux exigences.

Lorsqu’une contradiction affecte un comportement à implémenter, le travail concerné est bloqué jusqu’à correction documentaire validée.

Le document supérieur indique la décision de référence, mais ne dispense jamais de corriger la contradiction.

## Travail obligatoire

- Respecte la PR responsable de la roadmap et son hors périmètre ; n'élargis jamais silencieusement la tâche.
- Pars du dernier `origin/main`, travaille sur une branche dédiée, ne modifie jamais `main`, ne fusionne jamais une PR et n'active jamais l'auto-merge.
- Utilise TypeScript strict. Écris les tests avant ou avec l'implémentation, exécute la suite complète, produis une prévisualisation et déclare honnêtement toute validation non réalisée.
- N'importe jamais directement l'ancien code : caractérise sa source, adapte-la aux contrats actuels et documente son origine.
- N'utilise jamais `alert`, `confirm`, `prompt`, `eval` ou `new Function`.
- N'utilise ni Tailwind ni bibliothèque UI généraliste. Ne crée ni fichier minifié ni CSS sur une seule ligne.
- Ne commets aucun secret et ne place aucune donnée privée dans le cache PWA.
- Ne contourne jamais un test en réduisant son exigence et ne crée aucun contrôle caché de compatibilité.
