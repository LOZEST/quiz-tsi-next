# Quiz TSI Next

Application de révision pour la prépa TSI, pensée d'abord pour l'iPad et l'Apple Pencil. **Statut : reconstruction en cours. Aucune fonctionnalité de production n'existe encore.**

Le projet est une réécriture contrôlée. L'[ancien dépôt](https://github.com/LOZEST/quizz-prepa) est une référence en lecture seule : aucun import ou copier-coller global n'est autorisé.

## Architecture documentaire

- Produit : [spécification produit](docs/product/PRODUCT_SPEC.md), [parcours utilisateur](docs/product/USER_FLOWS.md) et [création de questions](docs/product/QUESTION_AUTHORING_SPEC.md)
- Design : [design system](docs/design/DESIGN_SYSTEM_SPEC.md) et [expérience du tableau blanc](docs/design/WHITEBOARD_EXPERIENCE_SPEC.md)
- Architecture : [architecture technique](docs/architecture/TECHNICAL_ARCHITECTURE.md) et [modèle de domaine](docs/architecture/DOMAIN_MODEL.md)
- Héritage : [politique de migration](docs/legacy/LEGACY_MIGRATION_POLICY.md) et [inventaire](docs/legacy/LEGACY_INVENTORY.md)
- Livraison : [roadmap PR0–PR0.1–PR0.2–PR1–PR9](docs/roadmap/IMPLEMENTATION_ROADMAP.md), [matrice d'acceptation](docs/acceptance/ACCEPTANCE_MATRIX.md) et [Definition of Ready/Done](docs/quality/DEFINITION_OF_DONE.md)

## Feuille de route

PR0 documentation et audit ; PR0.1 expérience utilisateur et création de questions (fusionnée) ; PR0.2 finalisation des contrats ; PR1 socle ; PR2 authentification ; PR3 tableau blanc ; PR4 questions et parcours ; PR5 correction et tests ; PR6 progression ; PR7 banque ; PR8 réglages, compte et administration ; PR9 PWA, migration et recette.

La chaîne normative est **PR0 → PR0.1 → PR0.2 → PR1 → PR2 → PR3 → PR4 → PR5 → PR6 → PR7 → PR8 → PR9**. PR1 dépend explicitement de PR0, PR0.1 et PR0.2 fusionnées ; aucune PR de code ne commence avant la fusion de PR0.2.

PR0 ne constitue pas une application fonctionnelle et n'ajoute ni dépendance, ni code applicatif, ni configuration d'exécution.


## Ordre normatif

Prévalence : [spécification produit](docs/product/PRODUCT_SPEC.md), [parcours utilisateur](docs/product/USER_FLOWS.md), [création de questions](docs/product/QUESTION_AUTHORING_SPEC.md), [design system](docs/design/DESIGN_SYSTEM_SPEC.md), [expérience du tableau blanc](docs/design/WHITEBOARD_EXPERIENCE_SPEC.md), [architecture technique](docs/architecture/TECHNICAL_ARCHITECTURE.md), [modèle de domaine](docs/architecture/DOMAIN_MODEL.md), [matrice d'acceptation](docs/acceptance/ACCEPTANCE_MATRIX.md), [Definition of Ready/Done](docs/quality/DEFINITION_OF_DONE.md), [roadmap](docs/roadmap/IMPLEMENTATION_ROADMAP.md), [politique de migration](docs/legacy/LEGACY_MIGRATION_POLICY.md), [inventaire](docs/legacy/LEGACY_INVENTORY.md). En cas de contradiction, le document placé le plus haut prévaut.
