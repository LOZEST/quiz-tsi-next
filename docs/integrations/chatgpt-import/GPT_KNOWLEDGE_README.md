# Knowledge du GPT Import Quiz TSI

Toute question importée reçoit une classification `personal` — ce GPT ne rattache plus jamais une question au programme officiel TSI. `generated/program-knowledge.json` (taxonomie `chapterId`/`notionId` officielle, produite par `npm run gpt:export-program-knowledge` depuis `src/data/program/official-program-v2.json`) n'est donc plus nécessaire au Knowledge de ce GPT : tu peux le retirer de l'onglet Knowledge de sa configuration sans rien casser.

Les règles d'import (présentes instructions, spécification MathSource V1) restent le seul contenu à uploader. Les types admis sont `formula`, `course`, `calculation`, `reflex`; les difficultés sont `fundamental`, `standard`, `trap` et `null` pour Réflexe. Les contenus sont des segments sûrs. Aucun secret, SQL RLS, donnée utilisateur, token ou détail interne n’appartient au Knowledge.
