# Règles impératives — Quiz TSI Next

Lis, avant tout changement, les documents normatifs dans cet ordre :

1. `docs/product/PRODUCT_SPEC.md` — comportement produit.
2. `docs/product/USER_FLOWS.md` — parcours utilisateur.
3. `docs/design/DESIGN_SYSTEM_SPEC.md` — rendu et composants visuels.
4. `docs/architecture/TECHNICAL_ARCHITECTURE.md` — architecture logicielle.
5. `docs/architecture/DOMAIN_MODEL.md` — contrats métier.
6. `docs/acceptance/ACCEPTANCE_MATRIX.md` — preuves nécessaires.
7. `docs/quality/DEFINITION_OF_DONE.md` — conditions de fin.
8. `docs/roadmap/IMPLEMENTATION_ROADMAP.md` — ordre des PR.
9. `docs/legacy/LEGACY_MIGRATION_POLICY.md` — récupération autorisée.
10. `docs/legacy/LEGACY_INVENTORY.md` — inventaire réellement constaté.

En cas de contradiction ou d'ambiguïté, n'improvise pas et ne choisis pas silencieusement : bloque l'implémentation, propose une modification documentaire dédiée et fais-la valider avant de coder.

## Travail obligatoire

- Respecte la PR responsable de la roadmap et son hors périmètre ; n'élargis jamais silencieusement la tâche.
- Pars du dernier `origin/main`, travaille sur une branche dédiée, ne modifie jamais `main`, ne fusionne jamais une PR et n'active jamais l'auto-merge.
- Utilise TypeScript strict. Écris les tests avant ou avec l'implémentation, exécute la suite complète, produis une prévisualisation et déclare honnêtement toute validation non réalisée.
- N'importe jamais directement l'ancien code : caractérise sa source, adapte-la aux contrats actuels et documente son origine.
- N'utilise jamais `alert`, `confirm`, `prompt`, `eval` ou `new Function`.
- N'utilise ni Tailwind ni bibliothèque UI généraliste. Ne crée ni fichier minifié ni CSS sur une seule ligne.
- Ne commets aucun secret et ne place aucune donnée privée dans le cache PWA.
- Ne contourne jamais un test en réduisant son exigence et ne crée aucun contrôle caché de compatibilité.
