# Intégration de la banque complète — 1 765 générateurs

## Sources et statut

La source immuable est `data/source/Base_Complete_Quiz_TSI_1765_Generateurs.json`, SHA-256 `c14bf97843bee18f2d78c6c512bac93577ce16baac9c7730e6586bfae5192669`. Elle contient 1 765 lignes marquées `VALIDE`, dont 1 230 `PRINCIPAL` et 535 `AUTOMATISME`.

Le rapprochement du programme s'appuie, dans cet ordre, sur les 14 intitulés de chapitre et les 82 `Notion_ID` de la source, sur l'inventaire historique documenté du projet et sur le programme officiel TSI publié au Bulletin officiel du 29 juillet 2021 :

- <https://www.education.gouv.fr/bo/21/Hebdo30/ESRS2111438A.htm>
- <https://www.education.gouv.fr/sites/default/files/document/BO_30_MESRI_1416610.pdf-309183.pdf>

La taxonomie résultante comporte 8 parties, 14 chapitres et exactement 82 notions. Les identifiants de notion ne sont jamais dérivés des libellés. Les regroupements en parties et les rattachements des automatismes sont des décisions de classification versionnées ; ils doivent être relus humainement avant de sortir la PR de l'état Draft.

## Conversion déterministe

`scripts/import-full-question-bank.mjs` exécute l'audit bloquant, détecte explicitement les schémas historiques, convertit domaines et relations vers l'AST sûr existant, valide chaque `Question`, instancie les vecteurs source et produit :

- `src/data/question-banks/full-production-v1.json` ;
- `src/data/program/official-program-v2.json` ;
- `tests/fixtures/full-production-bank-audit.json` ;
- `docs/integrations/chatgpt-import/generated/program-knowledge.json` via l'export dédié.

Répartition des schémas : 240 en 1.1, 53 en 2.1, 465 en 3.0, 187 en 4.0, 285 en 5.0 et 535 automatismes sans `schema_version`. Les 3 050 vecteurs source sont conservés avec leurs paramètres, expression initiale et réponse attendue. Aucun calcul symbolique général n'est revendiqué.

Les 196 lignes dont le JSON de paramètres est vide sont représentées par `parameterization: null`. Elles restent 196 entrées officielles distinctes ; aucun paramètre ni aucune variante fictive n'est inventé. Parmi les entrées paramétrées, 1 096 ont un espace valide fini exhaustivement prouvé inférieur à dix. Leur `validationVariantCount` est le nombre exact de variantes valides et toutes sont contrôlées. Les autres utilisent l'objectif de dix variantes.

Pour les 535 automatismes, le niveau source `AUTO-F`, `AUTO-N` ou `AUTO-P` est conservé dans le tag `source-level:*`. `Question.difficulty` reste obligatoirement `null` parce que le contrat métier impose cette valeur à `reflex` ; attribuer une difficulté aurait rendu les questions invalides et aurait cassé le filtre Réflexe.

## Taxonomie des automatismes

Le mapping exécutable et versionné se trouve dans `scripts/full-bank/automation-taxonomy.mjs`. Il couvre les 535 lignes sans classification vide :

| Catégorie | Nombre | Règle principale |
|---|---:|---|
| `FONCTIONS_REFERENCE` | 104 | domaine → `FON-F01`, sinusoïde → `TRI-F05`, autres propriétés/images → `FON-F02` |
| `DOMAINES` | 30 | `FON-F01` |
| `TRIGONOMETRIE` | 68 | longueur d'arc → `MES-F01`, addition/différence → `TRI-F03`, sinusoïde → `TRI-F05`, autres → `TRI-F01` |
| `HYPERBOLIQUES` | 8 | dérivée → `DER-F01`, primitive → `INT-F01`, définition → `FON-F02` |
| `DEVELOPPEMENTS_LIMITES` | 10 | `ANA-F04` |
| `DERIVEES` | 130 | produit → `DER-F02`, quotient → `DER-F03`, composition → `DER-F04`, usuelles → `DER-F01` |
| `PRIMITIVES` | 185 | composition/ajustement affine → `INT-F02`, usuelles → `INT-F01` |

Cette classification est exhaustive mais n'est pas explicitement fournie par la source pour les automatismes. La PR reste donc Draft jusqu'à validation humaine de ces correspondances.

## Contenu et rendu

Le compilateur remplace seulement les accolades correspondant à un identifiant déclaré. Il conserve intégralement `Reponse_generale` et `Correction` dans deux étapes distinctes. Une déclaration visible des paramètres est ajoutée à 102 énoncés dont les variables n'apparaissaient pas sous une forme substituable, afin que les variantes ne restent pas fantômes.

Le parseur mathématique V1 accepte 366 segments source sans ambiguïté. Les 1 004 autres segments, répartis sur 402 `Calcul_ID`, restent en texte original audité ; la liste exacte figure dans `mathFallbacks` et `fallbackCalculIds` du rapport machine-readable. Ce fallback est volontaire : aucune formule n'est supprimée, approximée ou réécrite pour satisfaire le parseur.

## Mesures

| Artefact | Taille |
|---|---:|
| Source JSON | 2 862 887 octets |
| Bundle compact mesuré par l'import | 3 021 453 octets |
| Bundle JSON formaté versionné | 5 028 667 octets |
| Rapport d'audit formaté | 1 554 021 octets |
| Programme V2 | 16 401 octets |

L'import complet prend environ 0,28 seconde sur la machine de référence. La banque est validée une fois à l'initialisation des services de production, importée atomiquement, puis interrogée via les index existants. La configuration Vite isole le gros module JSON dans un chunk `official-question-bank` distinct. Le build de référence passe de 2 252 à 4 892 Kio. Le JavaScript principal passe de 1 042 606 octets (283,56 Kio gzip) à 944 843 octets (274,32 Kio gzip) ; le chunk officiel séparé ajoute 2 798 716 octets (214,21 Kio gzip). L'impact JavaScript total est donc +2 700 953 octets bruts et environ +204,97 Kio gzip, sans gonfler le chunk principal.

## Points de contrôle humain

1. Relire les 8 regroupements de parties par rapport au programme officiel.
2. Valider chaque règle AUTO du tableau ci-dessus, en particulier `HYPERBOLIQUES`, `DEVELOPPEMENTS_LIMITES` et les règles génériques des primitives/dérivées.
3. Échantillonner les 402 questions en fallback texte sur desktop et iPad ; la conservation est garantie, mais la qualité typographique peut être améliorée plus tard sans toucher à la source.
4. Vérifier que l'ajout « Paramètres de cette variante » des 102 énoncés rend bien les variantes compréhensibles sans altérer le sens de l'énoncé source.
