# Matrice d’acceptation

> **Objectif :** définir les scénarios et preuves nécessaires. **Document normatif.** Aucun scénario n'est validé en PR0.

Statuts autorisés : **À implémenter**, **En cours**, **Existant à caractériser**, **Bloqué**, **Validé**. Un statut Validé exige preuves et validation humaine selon la Definition of Done.

| ID | domaine | scénario | précondition | action | résultat attendu | preuve automatique | preuve manuelle | PR responsable | statut |
|---|---|---|---|---|---|---|---|---|---|
| GLOBAL-001 | Global | Navigation principale limitée aux destinations prévues | shell ouvert | inspecter navigation | 4 destinations tableau prévues | RTL liens | clavier/visuel | PR1 | En cours |
| GLOBAL-002 | Global | Absence de dashboard chargé | authentification et redirection PR2 disponibles | se connecter puis ouvrir l’accueil | tableau immédiat, pas dashboard | test de route après authentification | inspection | PR3 | À implémenter |
| GLOBAL-003 | Global | Divulgation progressive | écran chargé | observer puis ouvrir détails | secondaire fermé puis accessible | RTL états | inspection | PR1 | En cours |
| GLOBAL-004 | Global | Cibles tactiles de 44 px | composants rendus | mesurer cibles | minimum 44×44 px | Playwright dimensions | iPad | PR1 | En cours |
| GLOBAL-005 | Global | Échap et restauration du focus | tiroir/dialogue ouvert | presser Échap | fermé, focus déclencheur | Playwright | clavier | PR1 | En cours |
| AUTH-001 | Auth | Connexion réussie | compte valide | se connecter | `/whiteboard` isolé | intégration | recette | PR2 | En cours |
| AUTH-002 | Auth | Erreur compréhensible | identifiants refusés | soumettre | texte actionnable | RTL | recette | PR2 | En cours |
| AUTH-003 | Auth | Isolation des comptes | A puis B | changer compte | aucune donnée A | intégration concurrence | recette A/B | PR2 | En cours |
| AUTH-004 | Auth | Protection de la route administration | utilisateurs `user`, `admin` et `owner` authentifiés | ouvrir `/admin` | `user` reçoit un refus compréhensible ; `admin` et `owner` accèdent uniquement au placeholder protégé ; aucune action sensible n'est disponible en PR2 | tests de routage et Playwright | recette des trois rôles | PR2 | En cours |
| WHITEBOARD-001 | Tableau | Accueil après connexion | session valide | ouvrir `/` | redirigé tableau prêt | route e2e | inspection | PR3 | À implémenter |
| WHITEBOARD-002 | Tableau | Question centrée | question active | mesurer portrait/paysage | centrée sur viewport | test visuel | iPad | PR3 | À implémenter |
| WHITEBOARD-003 | Tableau | Tiroir sans déplacement | scène active | ouvrir tiroir | question/Canvas/coordonnées immobiles | Playwright géométrie | Pencil | PR3 | À implémenter |
| WHITEBOARD-004 | Tableau | Écriture Pencil | iPad/Pencil | tracer avec pression | trait fidèle persisté | pointer e2e | iPad réel | PR3 | À implémenter |
| WHITEBOARD-005 | Tableau | Rotation sans déformation | scène tracée | tourner écran | coordonnées logiques intactes | roundtrip/visual | iPad | PR3 | À implémenter |
| WHITEBOARD-006 | Tableau | Brouillon restauré | scène persistée | fermer/revenir | scène exacte | intégration IDB | recette | PR3 | À implémenter |
| SESSION-001 | Sessions | Quatre parcours exacts | menu ouvert | lister | daily, weak-points, free, chapter-test | unit/RTL | inspection libellés | PR4 | À implémenter |
| SESSION-002 | Sessions | Révision libre dynamique | programme chargé | changer filtres | options compatibles réelles | unit sélection | recette | PR4 | À implémenter |
| SESSION-003 | Sessions | Changement immédiat avec tableau vide | question non commencée | changer filtre | nouvelle compatible immédiate | intégration | recette | PR4 | À implémenter |
| SESSION-004 | Sessions | Protection du brouillon | question commencée | changer filtre puis annuler | message, scène/filtres restaurés | Playwright | recette | PR4 | À implémenter |
| SESSION-005 | Sessions | Réflexe masque la difficulté | type libre | choisir Réflexe | Difficulté absente/null | RTL | inspection | PR4 | À implémenter |
| SESSION-006 | Sessions | Réflexe utilise 60 secondes | Réflexe active | démarrer | timer 60, non bloquant | fausse horloge | chronométrage | PR4 | À implémenter |
| EVALUATION-001 | Évaluation | Indice puis Réussi donne partial | question active | indice, correction, Réussi | `partial` hint true | unit | recette | PR5 | À implémenter |
| EVALUATION-002 | Évaluation | Dépassement puis Réussi donne partial | Réflexe active | dépasser puis Réussi | `partial` timeExceeded true | unit horloge | recette | PR5 | À implémenter |
| EVALUATION-003 | Évaluation | Aucun bouton Presque réussi | correction ouverte | inspecter actions | Réussi, Raté, Suivante seulement | RTL absence | inspection | PR5 | À implémenter |
| TEST-001 | Tests | Chapitre réellement utilisé | deux chapitres | démarrer chaque test | instances du chapitre choisi | unit moteur | recette | PR5 | À implémenter |
| TEST-002 | Tests | 20 questions réelles | stock suffisant | choisir 20 | 20 instances figées | unit | recette | PR5 | À implémenter |
| TEST-003 | Tests | 40 questions réelles | stock suffisant | choisir 40 | 40 instances figées | unit | recette | PR5 | À implémenter |
| TEST-004 | Tests | Brouillon par question | test actif | tracer et naviguer | scènes indépendantes | browser | iPad | PR5 | À implémenter |
| PROGRESS-001 | Progression | Première vue synthétique | événements | ouvrir `/progress` | limites d'indicateurs respectées | RTL | inspection | PR6 | À implémenter |
| PROGRESS-002 | Progression | Détails ouverts volontairement | synthèse | ouvrir notion | détails seulement après action | RTL | recette | PR6 | À implémenter |
| QUESTIONS-001 | Banque | Recherche | questions locales | rechercher | résultats exacts/aucun résultat | unit/intégration | recette | PR7 | À implémenter |
| QUESTIONS-002 | Banque | Filtres | questions variées | filtrer | intersection exacte | unit | recette | PR7 | À implémenter |
| QUESTIONS-003 | Banque | Brouillon hors connexion | offline | créer/enregistrer | brouillon local + outbox | intégration IDB | mode avion | PR7 | À implémenter |
| QUESTIONS-004 | Banque | Publication selon le rôle | rôles variés | publier | serveur autorise/refuse | tests RLS | recette rôles | PR7 | À implémenter |
| SETTINGS-001 | Réglages | Sections repliables | page ouverte | observer/ouvrir | secondaires fermées par défaut | RTL | inspection | PR8 | À implémenter |
| ACCOUNT-001 | Compte | Rôles traduits | profils rôles | ouvrir compte | Élève/Administrateur/Propriétaire | unit | inspection | PR2 | En cours |
| ACCOUNT-002 | Compte | Déconnexion hors du menu principal | tableau ouvert | ouvrir tiroir | pas de gros bouton déconnexion | RTL absence | inspection | PR2 | En cours |
| OFFLINE-001 | Offline | Démarrage hors connexion | espace autorisé | lancer offline | tableau local accessible | browser SW | mode avion | PR9 | À implémenter |
| OFFLINE-002 | Offline | Travail hors connexion | offline | résoudre/corriger | écriture locale sans perte | browser | mode avion iPad | PR9 | À implémenter |
| SYNC-001 | Sync | Outbox reprise | opérations offline | rétablir réseau | push puis pull idempotent | intégration | recette réseau | PR9 | À implémenter |
| SYNC-002 | Sync | Réponse tardive isolée par compte | requête A en vol | passer B puis réponse A | réponse ignorée | test concurrence | recette A/B | PR2 | En cours |
| PWA-001 | PWA | Installation | navigateur compatible | installer/lancer | standalone fonctionnel | Playwright audit | iPad installation | PR9 | À implémenter |
| PWA-002 | PWA | Aucune donnée Supabase privée en cache | session active | inspecter caches | zéro réponse privée | test SW | DevTools | PR9 | À implémenter |
| A11Y-001 | Accessibilité | Navigation clavier | application ouverte | parcourir clavier | ordre/action complets | Playwright axe/clavier | lecteur écran | PR9 | À implémenter |
| A11Y-002 | Accessibilité | Focus visible | clavier | tabuler | focus toujours visible | visual/axe | inspection | PR1 | En cours |
| A11Y-003 | Accessibilité | prefers-reduced-motion | préférence reduce | utiliser app | mouvements réduits/supprimés | media e2e | inspection | PR1 | En cours |
| PARAM-001 | Paramétrage | Seed déterministe | question paramétrée valide | générer deux fois avec la même seed | mêmes valeurs et même contenu | test unitaire déterministe | inspection des variantes | PR4 | À implémenter |
| PARAM-002 | Paramétrage | Domaines et contraintes respectés | domaines et contraintes valides | générer des variantes | chaque valeur satisfait domaine et contraintes | tests génératifs bornés | revue d’échantillons | PR4 | À implémenter |
| PARAM-003 | Paramétrage | Configuration impossible explicite | contraintes impossibles | demander une variante | erreur explicite, aucune variante publiée | test unitaire d’échec | inspection du message | PR4 | À implémenter |
| PARAM-004 | Paramétrage | Dix variantes contrôlées avant publication | question paramétrée candidate | lancer validation/publication | au moins 10 variantes valides contrôlées | test validation/publication | revue du rapport | PR4 | À implémenter |
| SECURITY-001 | Sécurité | Aucun HTML ou JavaScript distant arbitraire | contenu distant malveillant | charger et rendre la question | contenu rejeté ou rendu par segments sûrs, rien exécuté | intégration assainissement/CSP | test de contenu hostile | PR7 | À implémenter |
| SECURITY-002 | Sécurité | Absence d’eval et new Function | générateur disponible | analyser et exécuter génération | aucune exécution dynamique arbitraire | analyse statique et tests AST | revue de code | PR4 | À implémenter |
| BOARD-007 | Tableau | Formes mathématiques sérialisées sans perte | chaque forme supportée existe | sérialiser puis restaurer | géométrie, style, identifiant et propriétés identiques | test round-trip par forme | inspection visuelle | PR3 | À implémenter |
| BOARD-008 | Tableau | Migration idempotente d’une ancienne scène | fixture de version antérieure | migrer deux fois | résultat courant identique sans doublon | test migration/idempotence | inspection de fixture | PR3 | À implémenter |
| DATA-003 | Données | Objet historique invalide mis en quarantaine | scène mixte valide/invalide | restaurer ou migrer | invalide quarantainé, valides disponibles | test intégration migration | inspection du rapport | PR9 | À implémenter |
| ADMIN-001 | Administration | Refus serveur impossible à contourner | action interdite par RLS/politique | manipuler l’interface et appeler l’adapter | serveur refuse et aucune mutation locale validée | test RLS/intégration | recette rôle insuffisant | PR8 | À implémenter |
| ROUTING-001 | Routage | Route directe GitHub Pages | preview avec basename | ouvrir/recharger une route profonde | route correcte restaurée sans HashRouter | Playwright sur preview | navigation directe manuelle | PR1 | En cours |
| PERF-001 | Performance | Tableau fluide sur iPad cible | appareil cible/scène réaliste | écrire/effacer/zoomer | seuil mesuré défini en PR3 sans perte d'entrée | trace browser | iPad cible | PR3 | À implémenter |
| AUTHORING-001 | Création | Texte et formules coexistent | brouillon | ajouter les deux blocs | contenu ordonné rendu | intégration éditeur | revue | PR7 | À implémenter |
| AUTHORING-002 | Création | Syntaxe simple rendue | registre chargé | saisir les syntaxes minimales | rendu attendu | tests registre/rendu | revue | PR7 | À implémenter |
| AUTHORING-003 | Création | Erreur sans perte | formule invalide | corriger | source conservée, exemple utile | test état | recette | PR7 | À implémenter |
| AUTHORING-004 | Création | Clavier sans doublons | clavier ouvert | inspecter | aucun raccourci simple dupliqué | test registre | inspection | PR7 | À implémenter |
| AUTHORING-005 | Création | Ensembles et grec insérables | formule active | insérer | symbole au curseur | browser | lecteur d'écran | PR7 | À implémenter |
| AUTHORING-006 | Création | Raccourcis issus du registre | registre chargé | ouvrir Raccourcis | liste identique au registre | test dérivation | inspection | PR7 | À implémenter |
| AUTHORING-007 | Création | AST invisible | éditeur ouvert | parcourir UI | aucun contrat interne affiché | RTL absence | inspection | PR7 | À implémenter |
| AUTHORING-008 | Création | Variable `@nom` | variable créée | insérer | référence distincte | unit/intégration | recette | PR7 | À implémenter |
| AUTHORING-009 | Création | Contrainte visuelle | variables créées | composer phrase | AST sûr produit sans exposition | unit | recette | PR7 | À implémenter |
| AUTHORING-010 | Création | Dix variantes avant publication | candidate paramétrée | publier | dix valides contrôlées | intégration | rapport | PR7 | À implémenter |
| AUTHORING-011 | Création | Tutoriel conforme au registre | tutoriel PR7 | comparer | aucune commande inexistante | test cohérence | revue | PR7 | À implémenter |
| MATH-001 | Math | Déterminisme source/version | source fixée | analyser deux fois | même arbre | unit snapshot | revue | PR4 | À implémenter |
| MATH-002 | Math | Migration idempotente | ancienne version | migrer deux fois | résultat courant identique | unit migration | revue fixture | PR4 | À implémenter |
| MATH-003 | Math | Aucune exécution arbitraire | contenu hostile | analyser/rendre | HTML/JavaScript non exécuté | sécurité/CSP | recette hostile | PR4 | À implémenter |
| FILTER-001 | Filtres | Cinq options générales par défaut | Révision libre | ouvrir | libellés exacts sélectionnés | RTL | inspection | PR4 | À implémenter |
| FILTER-002 | Filtres | Tout n'est pas une entrée | programme chargé | sélectionner Tout | absence de restriction | unit modèle | inspection données | PR4 | À implémenter |
| FILTER-003 | Filtres | Enfants incompatibles réinitialisés | sélection précise | changer parent | enfants sur Tout | unit reducer | recette | PR4 | À implémenter |
| FILTER-004 | Filtres | Réflexe masque Difficulté | filtres ouverts | choisir Réflexe | difficulté masquée/non applicable | RTL | inspection | PR4 | À implémenter |
| FILTER-005 | Filtres | Difficulté précise exclut Réflexe | Tous les types | choisir Standard | aucun Réflexe | unit sélection | recette | PR4 | À implémenter |
| FILTER-006 | Filtres | Aucun résultat strict | combinaison vide | appliquer | message, aucun relâchement | intégration | recette | PR4 | À implémenter |
| IMPORT-001 | Import | Banque versionnée importable | bundle valide | importer | questions et rapport | intégration | revue rapport | PR4 | À implémenter |
| IMPORT-002 | Import | Invalide en quarantaine | bundle mixte | importer | valides conservées | intégration | revue rapport | PR4 | À implémenter |
| IMPORT-003 | Import | Import idempotent | bundle déjà importé | réimporter | aucun doublon | intégration | inspection | PR4 | À implémenter |
| WHITEBOARD-009 | Tableau | OverlayDrawer sur grand écran | `/whiteboard` ouvert sur grand écran | ouvrir le menu | menu superposé ; taille, position et coordonnées du Canvas et de la question strictement identiques | Playwright géométrie avant/après | inspection grand écran | PR3 | À implémenter |
| MATH-004 | Math | Priorité déterministe | source combinant opérateurs | analyser | arbre conforme à l'ordre normatif | unit AST | revue | PR4 | À implémenter |
| MATH-005 | Math | Multiplication implicite refusée | source `2x` | analyser | refus et exemple `2*x` | unit erreur | revue message | PR4 | À implémenter |
| MATH-006 | Math | Symboles sûrs | symboles du Clavier mathématique | analyser | tokens analysés sans exécution arbitraire | sécurité/unit | recette hostile | PR4 | À implémenter |
| MATH-007 | Math | Décimaux normalisés | sources `1,5` et `1.5` | analyser | même valeur normalisée | unit | revue | PR4 | À implémenter |
| MATH-008 | Math | Division ambiguë refusée | source `a/b/c` | analyser | refus avec les deux parenthésages proposés | unit erreur | revue message | PR4 | À implémenter |
| AUTHORING-012 | Création | Valeur cohérente partout | variante générée | afficher énoncé, indice et correction | même variable, même valeur partout | intégration | revue variante | PR7 | À implémenter |
| AUTHORING-013 | Création | Référence inconnue bloquante | `@nom` non défini | publier | publication bloquée et référence signalée | intégration | recette | PR7 | À implémenter |
| AUTHORING-014 | Création | Renommage atomique | variable utilisée | renommer | toutes les références mises à jour sans perte ni état cassé persisté | unit transaction/intégration | recette | PR7 | À implémenter |
| AUTHORING-015 | Création | Variable inutilisée signalée | définition sans référence | valider | avertissement non bloquant | unit validation | inspection | PR7 | À implémenter |
| FILTER-007 | Filtres | Tous les chapitres globaux accessibles | Toutes les parties | ouvrir Chapitre | tous accessibles sans ambiguïté, option générale première | unit/RTL | inspection | PR4 | À implémenter |
| FILTER-008 | Filtres | Sortie de Réflexe | Réflexe sélectionné | choisir un autre type | Difficulté revient à Toutes les difficultés | unit reducer/RTL | recette | PR4 | À implémenter |
| FILTER-009 | Filtres | Homonymes distinguables | chapitres ou notions homonymes | ouvrir options | libellés ou groupes identifient les parents | RTL | inspection | PR4 | À implémenter |
| IMPORT-004 | Import | Rapport avancé par question | bundle importé | consulter rapport | chaque question est acceptée, rejetée, mise à jour, ignorée ou mise en quarantaine | intégration | revue rapport | PR7 | À implémenter |
| CONTENT-001 | Contenu | MathSource persiste la formule | formule valide enregistrée | persister puis rouvrir | `MathSource` conservé, jamais HTML ou LaTeX comme source de vérité | intégration persistance/migration | inspection du stockage | PR4 | À implémenter |
| FILTER-010 | Filtres | Configuration persistée non ambiguë | Révision libre configurée | persister puis restaurer | Tout, valeur précise et non applicable restent distingués sans `null` | unit sérialisation | inspection | PR4 | À implémenter |
| MATH-009 | Math | Égalités et comparaisons strictes | sources avec `=`, `<` et `>` | analyser | opérateurs internes déterministes | unit AST | revue | PR4 | À implémenter |
| MATH-010 | Math | Comparaisons Unicode normalisées | sources avec `≤`, `≥` et `≠` | analyser avec les raccourcis ASCII correspondants | mêmes opérateurs internes | unit équivalence | revue | PR4 | À implémenter |
| MATH-011 | Math | Quatre formes d’intervalles | sources fermée, ouverte et semi-ouvertes | analyser | bornes et ouvertures analysées sans ambiguïté | unit AST | revue | PR4 | À implémenter |
| MATH-012 | Math | Constante π distincte de pi | symbole `π` inséré par le Clavier mathématique | analyser et rendre | constante mathématique rendue, jamais identifiant latin `pi` | unit registre/rendu | inspection | PR4 | À implémenter |
| IMPORT-005 | Import | Provenance résolue persistée | question importée avec provenance | importer puis rouvrir | provenance résolue conservée | intégration persistance | inspection | PR4 | À implémenter |
| IMPORT-006 | Import | Entrée toujours identifiable | bundle contenant des entrées sans identifiant externe | importer et lire le rapport | chaque entrée est distinguée par `entryIndex`, avec identifiants et localisateur disponibles | intégration rapport | interface avancée PR7 | PR4 | À implémenter |
