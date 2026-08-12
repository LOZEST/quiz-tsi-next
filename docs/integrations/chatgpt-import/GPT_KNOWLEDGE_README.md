# Knowledge du GPT Import Quiz TSI

Uploader `generated/program-knowledge.json` avec les présentes règles et la spécification MathSource V1. Le fichier est produit par `npm run gpt:export-program-knowledge` depuis `src/data/program/official-program-v2.json`, taxonomie officielle complète de 82 notions. Il contient `chapterId`, `notionId` et leurs libellés, jamais `partId` ni identifiant personnel.

Les types admis sont `formula`, `course`, `calculation`, `reflex`; les difficultés sont `fundamental`, `standard`, `trap` et `null` pour Réflexe. Les contenus sont des segments sûrs. Aucun secret, SQL RLS, donnée utilisateur, token ou détail interne n’appartient au Knowledge.
