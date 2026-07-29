# Matrice d’acceptation

> **Objectif :** définir les scénarios et preuves nécessaires. **Document normatif.** Aucun scénario n'est validé en PR0.

Statuts autorisés : **À implémenter**, **En cours**, **Existant à caractériser**, **Bloqué**, **Validé**. Un statut Validé exige preuves et validation humaine selon la Definition of Done.

| ID | domaine | scénario | précondition | action | résultat attendu | preuve automatique | preuve manuelle | PR responsable | statut |
|---|---|---|---|---|---|---|---|---|---|
| GLOBAL-001 | Global | Navigation principale limitée aux destinations prévues | shell ouvert | inspecter navigation | 4 destinations tableau prévues | RTL liens | clavier/visuel | PR1 | À implémenter |
| GLOBAL-002 | Global | Absence de dashboard chargé | connexion faite | ouvrir accueil | tableau immédiat, pas dashboard | test route | inspection | PR1 | À implémenter |
| GLOBAL-003 | Global | Divulgation progressive | écran chargé | observer puis ouvrir détails | secondaire fermé puis accessible | RTL états | inspection | PR1 | À implémenter |
| GLOBAL-004 | Global | Cibles tactiles de 44 px | composants rendus | mesurer cibles | minimum 44×44 px | Playwright dimensions | iPad | PR1 | À implémenter |
| GLOBAL-005 | Global | Échap et restauration du focus | tiroir/dialogue ouvert | presser Échap | fermé, focus déclencheur | Playwright | clavier | PR1 | À implémenter |
| AUTH-001 | Auth | Connexion réussie | compte valide | se connecter | `/whiteboard` isolé | intégration | recette | PR2 | À implémenter |
| AUTH-002 | Auth | Erreur compréhensible | identifiants refusés | soumettre | texte actionnable | RTL | recette | PR2 | À implémenter |
| AUTH-003 | Auth | Isolation des comptes | A puis B | changer compte | aucune donnée A | intégration concurrence | recette A/B | PR2 | À implémenter |
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
| ACCOUNT-001 | Compte | Rôles traduits | profils rôles | ouvrir compte | Élève/Administrateur/Propriétaire | unit | inspection | PR8 | À implémenter |
| ACCOUNT-002 | Compte | Déconnexion hors du menu principal | tableau ouvert | ouvrir tiroir | pas de gros bouton déconnexion | RTL absence | inspection | PR8 | À implémenter |
| OFFLINE-001 | Offline | Démarrage hors connexion | espace autorisé | lancer offline | tableau local accessible | browser SW | mode avion | PR9 | À implémenter |
| OFFLINE-002 | Offline | Travail hors connexion | offline | résoudre/corriger | écriture locale sans perte | browser | mode avion iPad | PR9 | À implémenter |
| SYNC-001 | Sync | Outbox reprise | opérations offline | rétablir réseau | push puis pull idempotent | intégration | recette réseau | PR9 | À implémenter |
| SYNC-002 | Sync | Réponse tardive isolée par compte | requête A en vol | passer B puis réponse A | réponse ignorée | test concurrence | recette A/B | PR2 | À implémenter |
| PWA-001 | PWA | Installation | navigateur compatible | installer/lancer | standalone fonctionnel | Playwright audit | iPad installation | PR9 | À implémenter |
| PWA-002 | PWA | Aucune donnée Supabase privée en cache | session active | inspecter caches | zéro réponse privée | test SW | DevTools | PR9 | À implémenter |
| A11Y-001 | Accessibilité | Navigation clavier | application ouverte | parcourir clavier | ordre/action complets | Playwright axe/clavier | lecteur écran | PR9 | À implémenter |
| A11Y-002 | Accessibilité | Focus visible | clavier | tabuler | focus toujours visible | visual/axe | inspection | PR1 | À implémenter |
| A11Y-003 | Accessibilité | prefers-reduced-motion | préférence reduce | utiliser app | mouvements réduits/supprimés | media e2e | inspection | PR1 | À implémenter |
| PERF-001 | Performance | Tableau fluide sur iPad cible | appareil cible/scène réaliste | écrire/effacer/zoomer | seuil mesuré défini en PR3 sans perte d'entrée | trace browser | iPad cible | PR3 | À implémenter |
