# Parcours utilisateur

> **Objectif :** décrire les enchaînements observables et leur reprise. **Document normatif.**

## Sommaire
- [Authentification](#auth) · [Tableau blanc](#whiteboard) · [Sessions](#session) · [Tests](#test) · [Progression](#progress) · [Banque](#questions) · [Offline](#offline) · [Synchronisation](#sync) · [Compte](#account)

Chaque flux spécifie préconditions, étapes, états, résultat attendu, erreurs et reprise. Une reprise rend un état cohérent sans perte silencieuse.

## AUTH

### FLOW-AUTH-001 — Connexion réussie

- **Préconditions :** Réseau et identifiants valides.
- **Étapes :** Saisir puis Se connecter.
- **États :** formulaire → chargement → session.
- **Résultat attendu :** ouvrir les repositories du compte et `/whiteboard` prêt.
- **Erreurs :** réseau/profil expliqué.
- **Reprise :** réessayer sans exposer un autre compte.

### FLOW-AUTH-002 — Connexion refusée

- **Préconditions :** aucune session valide.
- **Étapes :** soumettre des identifiants refusés.
- **États :** chargement → erreur textuelle.
- **Résultat attendu :** rester sur `/login`, effacer le mot de passe et focaliser le champ.
- **Erreurs :** message non révélateur.
- **Reprise :** corriger puis resoumettre.

### FLOW-AUTH-003 — Restauration hors connexion

- **Préconditions :** espace local autorisé déjà lié au compte.
- **Étapes :** choisir Restaurer hors connexion.
- **États :** vérification → bannière offline.
- **Résultat attendu :** ouvrir uniquement les données locales du compte.
- **Erreurs :** espace absent/corrompu expliqué.
- **Reprise :** quarantaine puis login ou essai en ligne.

### FLOW-AUTH-004 — Accès à `/admin` en PR2

- **Préconditions :** utilisateur `user`, `admin` ou `owner` authentifié.
- **Étapes :** ouvrir directement `/admin`.
- **États :** vérification de session et de rôle → refus ou placeholder protégé.
- **Résultat attendu :** `user` reçoit un refus compréhensible ; `admin` et `owner` accèdent uniquement au placeholder protégé ; aucune action sensible n'est disponible avant PR8.
- **Erreurs :** une session absente ou expirée revient à `/login` ; les permissions serveur restent l'autorité finale.
- **Reprise :** se reconnecter ou revenir à une route autorisée, sans contourner le refus.

## WHITEBOARD

### FLOW-WHITEBOARD-001 — Arrivée après connexion

- **Préconditions :** session ou restauration valide.
- **Étapes :** atteindre `/whiteboard`.
- **États :** chargement local → normal.
- **Résultat attendu :** question centrée, Canvas prêt, menu fermé.
- **Erreurs :** vide/offline/lecture ont un état dédié.
- **Reprise :** changer parcours ou réessayer sans reload.

### FLOW-WHITEBOARD-002 — Résolution puis correction

- **Préconditions :** question active, scène vide.
- **Étapes :** écrire, Voir la correction, Réussi ou Raté.
- **États :** brouillon → correction → évaluation.
- **Résultat attendu :** `success` sans aide/dépassement ou `failed`.
- **Erreurs :** sync/persistance ne supprime pas scène.
- **Reprise :** outbox locale puis réessai.

### FLOW-WHITEBOARD-003 — Indice puis réussite partielle

- **Préconditions :** question active.
- **Étapes :** Indice, résoudre, correction, Réussi.
- **États :** indice mémorisé.
- **Résultat attendu :** `partial`, `hintUsed: true`.
- **Erreurs :** indice indisponible non compté.
- **Reprise :** réessayer idempotemment.

### FLOW-WHITEBOARD-004 — Réflexe avec dépassement

- **Préconditions :** question `reflex`, 60 s.
- **Étapes :** dépasser, continuer, corriger, Réussi.
- **États :** timer dépassé non bloquant.
- **Résultat attendu :** `partial`, `timeLimitExceeded: true`.
- **Erreurs :** pause système traitée par horloge robuste.
- **Reprise :** restaurer échéance, jamais réinitialiser.

### FLOW-WHITEBOARD-005 — Passer une question

- **Préconditions :** correction fermée.
- **Étapes :** Passer.
- **États :** enregistrement → suivante.
- **Résultat attendu :** `skipped`, sans impact maîtrise implicite.
- **Erreurs :** suivante indisponible.
- **Reprise :** réessayer sans dupliquer événement.

## SESSION

### FLOW-SESSION-001 — Révision libre avec tableau vide

- **Préconditions :** question non commencée.
- **Étapes :** choisir filtres ordonnés.
- **États :** options dynamiques.
- **Résultat attendu :** appliquer et charger compatible immédiatement.
- **Erreurs :** combinaison sans résultat.
- **Reprise :** modifier sans reload.

### FLOW-SESSION-002 — Changement avec brouillon

- **Préconditions :** trait/forme/indice/correction présent.
- **Étapes :** modifier un filtre, le parcours ou demander la question suivante.
- **États :** recherche compatible → nouvelle question ou échec explicite.
- **Résultat attendu :** une nouvelle question efface le tableau précédent sans confirmation ; un changement impossible conserve le brouillon.
- **Erreurs :** chargement échoue explicitement.
- **Reprise :** aucune configuration cachée.

### FLOW-SESSION-003 — Révision du jour

- **Préconditions :** un port ou repository fiable fournit l'état du plan.
- **Étapes :** ouvrir le parcours puis, en état `ready`, un détail.
- **États :** `ready`, `none-scheduled`, `completed` ou `unavailable`.
- **Résultat attendu :** `ready` affiche uniquement les éléments réellement fournis. `none-scheduled` affiche « Aucune révision n’est prévue aujourd’hui. Tu es à jour. ». `completed` affiche « Révision du jour terminée. Toutes les notions prévues ont été révisées. ». `unavailable` affiche le message compréhensible du domaine ou de l'adapter.
- **Erreurs :** une donnée absente, invalide ou inexploitable produit `unavailable`, sans détail technique.
- **Reprise :** dans tout état autre que `ready`, aucune instance n'est créée, aucune question précédente ne reste active et le Canvas demeure disponible sans question associée.

### FLOW-SESSION-004 — Points faibles

- **Préconditions :** une source fiable fournit un `WeakPointsState`.
- **Étapes :** ouvrir le parcours et, en état `ready`, un détail.
- **États :** `ready`, `calibrating` ou `unavailable`.
- **Résultat attendu :** `ready` affiche uniquement priorité, notion, difficulté recommandée et détails réellement fournis. `calibrating` affiche « L’application apprend encore ton niveau. Réponds à davantage de questions pour obtenir une sélection personnalisée. », une jauge fondée sur des preuves réelles ou indéterminée, et une action vers Révision libre. `unavailable` affiche un message compréhensible.
- **Erreurs :** aucune preuve insuffisante ne produit de classement, maîtrise, priorité ou difficulté fictive.
- **Reprise :** `calibrating` et `unavailable` retirent toute ancienne question active, ne créent aucune instance et proposent Révision libre lorsqu'elle est utilisable.

### FLOW-SESSION-005 — Configurer un futur test de chapitres en PR4

- **Préconditions :** programme et repository de questions disponibles.
- **Étapes :** choisir un chapitre réel puis 20 ou 40.
- **États :** configuration compatible ou stock insuffisant.
- **Résultat attendu :** le choix réel est conservé et le stock compatible est compté sans duplication, changement de chapitre ni relâchement. Aucun test, blueprint, ordre, seed, instance ou brouillon n'est créé.
- **Erreurs :** un stock insuffisant indique « Ce chapitre ne contient pas encore assez de questions validées pour préparer un test de 20 questions. », avec la quantité réellement choisie.
- **Reprise :** modifier le chapitre ou la quantité ; aucun bouton ne prétend démarrer la passation avant PR5.

### FLOW-SESSION-006 — Banque validée indisponible

- **Préconditions :** aucun `QuestionBankBundle` validé n'est disponible.
- **Étapes :** ouvrir le tableau blanc ou un parcours.
- **États :** contenu indisponible.
- **Résultat attendu :** afficher « Aucune banque de questions validée n’est disponible pour le moment. » ; aucune question ou instance n'est créée ; filtres, Canvas, réglages Pencil et navigation restent accessibles.
- **Erreurs :** aucune fixture, question historique bloquée ou question fabriquée n'est chargée.
- **Reprise :** réessayer après mise à disposition d'un bundle validé, sans rechargement de contenu non autorisé.

## TEST

Les flux de cette section appartiennent à PR5. PR4 ne fournit que `FLOW-SESSION-005`, la configuration et la validation du stock.

### FLOW-TEST-001 — Démarrer un test de 20 questions

- **Préconditions :** chapitre assez fourni.
- **Étapes :** choisir chapitre, 20, Commencer.
- **États :** configuration → blueprint figé.
- **Résultat attendu :** 20 vraies instances, ordre reproductible.
- **Erreurs :** stock insuffisant bloque et explique.
- **Reprise :** changer choix, aucun faux remplissage.

### FLOW-TEST-002 — Naviguer avec des brouillons

- **Préconditions :** test démarré.
- **Étapes :** écrire, suivante, écrire, précédente.
- **États :** scène par instance.
- **Résultat attendu :** restaurer exactement chaque brouillon.
- **Erreurs :** persistance échouée bloque action destructive.
- **Reprise :** réessayer sans croiser scènes.

### FLOW-TEST-003 — Soumettre un test

- **Préconditions :** test commencé.
- **Étapes :** Soumettre puis dialogue interne.
- **États :** résumé → confirmation → calcul.
- **Résultat attendu :** résultats sur versions figées.
- **Erreurs :** échec ne marque pas soumis.
- **Reprise :** resoumettre idempotemment ; abandon confirmé séparément.

## PROGRESS

### FLOW-PROGRESS-001 — Consulter une synthèse

- **Préconditions :** événements locaux disponibles.
- **Étapes :** ouvrir `/progress`.
- **États :** chargement → synthèse.
- **Résultat attendu :** 1 indicateur principal, ≤3 secondaires et sections prévues.
- **Erreurs :** données partielles signalées.
- **Reprise :** local puis actualisation sync.

### FLOW-PROGRESS-002 — Ouvrir les détails d’une notion

- **Préconditions :** synthèse affichée.
- **Étapes :** cliquer partie/chapitre/notion.
- **États :** disclosure/détail.
- **Résultat attendu :** historique, maîtrise, échéances, tests.
- **Erreurs :** indisponible sans altérer synthèse.
- **Reprise :** fermer ou réessayer.

## QUESTIONS

### FLOW-QUESTIONS-001 — Créer une question privée

- **Préconditions :** Élève, repository ouvert.
- **Étapes :** saisir segments puis enregistrer.
- **États :** validation → brouillon → attente.
- **Résultat attendu :** privée au propriétaire, disponible offline.
- **Erreurs :** champs invalides/sync expliqués.
- **Reprise :** corriger/reprendre.

### FLOW-QUESTIONS-002 — Créer une question paramétrée

- **Préconditions :** droit de création.
- **Étapes :** paramètres bornés et aperçu variantes.
- **États :** validation déterministe.
- **Résultat attendu :** variantes sûres sans exécution dynamique.
- **Erreurs :** paramètre/variante invalide.
- **Reprise :** modifier bornes, garder valide.

### FLOW-QUESTIONS-003 — Publier dans la banque commune

- **Préconditions :** validée et permission serveur.
- **Étapes :** Publier.
- **États :** attente/succès/conflit/refus.
- **Résultat attendu :** version validée publiée par serveur.
- **Erreurs :** RLS/refus jamais contourné.
- **Reprise :** garder brouillon, résoudre/demander droit.

## OFFLINE

### FLOW-OFFLINE-001 — Travailler sans réseau

- **Préconditions :** espace restauré.
- **Étapes :** résoudre/corriger/naviguer disponible.
- **États :** bannière, écritures, outbox.
- **Résultat attendu :** aucune perte, limites explicites.
- **Erreurs :** contenu absent actionnable.
- **Reprise :** reprendre au réseau sans bloquer Canvas.

## SYNC

### FLOW-SYNC-001 — Revenir en ligne

- **Préconditions :** outbox non vide.
- **Étapes :** réseau revient, pousser puis récupérer.
- **États :** attente → sync → succès/conflit.
- **Résultat attendu :** idempotence et local actualisé.
- **Erreurs :** rejet/conflit n’efface rien.
- **Reprise :** backoff/résolution explicite.

## ACCOUNT

### FLOW-ACCOUNT-001 — Changer de compte sans mélanger les données

- **Préconditions :** compte A ouvert.
- **Étapes :** déconnecter A puis connecter B.
- **États :** fermer A → nettoyer → ouvrir B.
- **Résultat attendu :** aucune donnée/réponse tardive de A.
- **Erreurs :** échec arrête en sécurité.
- **Reprise :** fermer ressources et revenir login.

### FLOW-ACCOUNT-002 — Déconnexion en PR2

- **Préconditions :** session valide et page compte minimale `/account` ouverte.
- **Étapes :** activer Déconnexion.
- **États :** fermer l'espace local courant → nettoyer l'état mémoire → terminer la session → revenir à `/login`.
- **Résultat attendu :** repositories et données en mémoire du compte fermés, session réellement terminée et `/login` affiché.
- **Erreurs :** un échec de fermeture arrête la transition en sécurité et n'expose aucune donnée d'un autre compte.
- **Reprise :** terminer le nettoyage puis revenir à `/login`, sans réponse tardive du compte précédent.

## PARAMÉTRAGE ET COMPATIBILITÉ

### FLOW-QUESTIONS-004 — Valider une question paramétrée

- **Préconditions :** définition de variables et AST sûr valides.
- **Étapes :** choisir une seed, générer au moins dix variantes, valider puis demander la publication.
- **États :** validation des domaines → contraintes → contenu segmenté → publication.
- **Résultat attendu :** une seed identique reproduit valeurs et contenu ; seules des variantes valides et rendues sans HTML/JavaScript arbitraire sont publiables.
- **Erreurs :** combinaison impossible, opérateur non autorisé ou moins de dix variantes valides produit une erreur explicite.
- **Reprise :** corriger domaines/contraintes sans publier silencieusement une variante invalide.

### FLOW-WHITEBOARD-006 — Restaurer une scène versionnée

- **Préconditions :** scène d'une version antérieure, éventuellement avec un objet endommagé.
- **Étapes :** charger, migrer, restaurer les formes puis répéter la migration.
- **États :** validation → migration → quarantaine ciblée → rendu.
- **Résultat attendu :** migration idempotente, formes valides sans perte et objet invalide isolé.
- **Erreurs :** une géométrie inconnue est expliquée et ne bloque pas les objets valides.
- **Reprise :** conserver la source et le rapport de quarantaine pour une migration ultérieure.

## AUTHORING

### FLOW-AUTHORING-001 — Créer une question avec texte et formule
- **Préconditions :** auteur autorisé, brouillon ouvert. **Étapes :** écrire du texte, choisir **+ Formule**, saisir la source. **Résultat attendu :** blocs coexistants, aperçu rendu, brouillon restaurable.
### FLOW-AUTHORING-002 — Saisir un raccourci
- **Préconditions :** bloc formule actif. **Étapes :** saisir `sqrt(x)` ou `(a+b)/(c-d)`. **Résultat attendu :** aperçu immédiat conforme au registre.
### FLOW-AUTHORING-003 — Insérer un symbole
- **Préconditions :** curseur dans une formule. **Étapes :** ouvrir le **Clavier mathématique**, choisir ℝ. **Résultat attendu :** insertion au curseur sans effacement.
### FLOW-AUTHORING-004 — Corriger une formule invalide
- **Préconditions :** source invalide. **Étapes :** lire l'erreur pédagogique, corriger. **Résultat attendu :** source initiale conservée puis aperçu valide.
### FLOW-AUTHORING-005 — Créer une variable
- **Préconditions :** question paramétrée. **Étapes :** **+ Variable**, renseigner nom, type et domaine. **Résultat attendu :** `@nom` insérable, AST invisible.
### FLOW-AUTHORING-006 — Créer une contrainte visuelle
- **Préconditions :** variable définie. **Étapes :** composer une phrase de contrainte. **Résultat attendu :** règle sûre créée sans afficher l'AST.
### FLOW-AUTHORING-007 — Tester dix variantes
- **Préconditions :** domaines et contraintes saisis. **Étapes :** générer, contrôler, régénérer. **Résultat attendu :** au moins dix variantes valides avant publication ; impossibilité expliquée.
### FLOW-AUTHORING-008 — Consulter les aides
- **Préconditions :** Banque de questions ouverte. **Étapes :** ouvrir **Raccourcis**, puis Banque de questions → Aide → Créer une question. **Résultat attendu :** registre réel et tutoriel PR7 accessibles.

## FILTER

### FLOW-FILTER-001 — Démarrer sans restriction
- **Préconditions :** Révision libre ouverte. **Étapes :** observer les filtres. **Résultat attendu :** les cinq options générales exactes sont sélectionnées.
### FLOW-FILTER-002 — Restreindre une partie
- **Préconditions :** filtres généraux. **Étapes :** choisir une partie. **Résultat attendu :** **Tous les chapitres** et **Toutes les notions** restent actifs ; toutes les questions de la partie sont admissibles.
### FLOW-FILTER-003 — Réinitialiser les enfants incompatibles
- **Préconditions :** partie, chapitre et notion précis. **Étapes :** choisir une autre partie. **Résultat attendu :** chapitre et notion reviennent immédiatement aux options générales.
### FLOW-FILTER-004 — Choisir Réflexe
- **Préconditions :** Type visible. **Étapes :** choisir Réflexe. **Résultat attendu :** Difficulté est masquée et marquée non applicable.
### FLOW-FILTER-005 — Choisir une difficulté précise
- **Préconditions :** **Tous les types**. **Étapes :** choisir Standard. **Résultat attendu :** aucune question Réflexe n'est admissible.
### FLOW-FILTER-006 — Aucun résultat
- **Préconditions :** combinaison sans question. **Étapes :** appliquer. **Résultat attendu :** message explicite et aucun filtre ignoré, contenu incompatible ou question fabriquée.

### FLOW-AUTHORING-009 — Renommer une variable utilisée
- **Préconditions :** variable définie et référencée dans un ou plusieurs contenus. **Étapes :** renommer la variable. **Résultat attendu :** toutes les références dans l'énoncé, les formules, l'indice et la correction sont mises à jour atomiquement ; aucun état cassé n'est persisté.

### FLOW-AUTHORING-010 — Détecter une référence inconnue
- **Préconditions :** un contenu contient un `@nom` sans définition. **Étapes :** demander la publication. **Résultat attendu :** publication bloquée, référence identifiée et brouillon conservé.

### FLOW-AUTHORING-011 — Afficher la même valeur dans l’énoncé et la correction
- **Préconditions :** variante paramétrée valide. **Étapes :** ouvrir son aperçu. **Résultat attendu :** la même variable affiche la même valeur dans le texte et les formules de l'énoncé, l'indice, les titres et contenus des étapes de correction.

### FLOW-FILTER-007 — Parcourir tous les chapitres depuis Toutes les parties
- **Préconditions :** Partie vaut **Toutes les parties**. **Étapes :** ouvrir Chapitre. **Résultat attendu :** **Tous les chapitres** est premier, tous les chapitres sont disponibles et chacun est regroupé ou libellé avec sa partie sans homonyme ambigu.

### FLOW-FILTER-008 — Quitter Réflexe et restaurer Toutes les difficultés
- **Préconditions :** Réflexe sélectionné et Difficulté non applicable. **Étapes :** choisir **Tous les types**, Formules, Cours ou Calcul. **Résultat attendu :** Difficulté réapparaît sur **Toutes les difficultés** ; aucune valeur cachée antérieure n'est restaurée.

### FLOW-FILTER-009 — Libeller simplement les notions
- **Préconditions :** le contrôle Notion est visible. **Étapes :** ouvrir Notion. **Résultat attendu :** chaque option affiche uniquement `notion.label` ; Partie et Chapitre déterminent le contexte et les identifiants restent inchangés.

## Contrat transversal des filtres

Quand Partie vaut **Toutes les parties**, Chapitre contient d'abord **Tous les chapitres**, puis tous les chapitres regroupés ou libellés par partie. Notion contient d'abord **Toutes les notions**, puis les notions admissibles avec pour libellé visible le seul `notion.label`. Partie et Chapitre portent le contexte de filtrage.

Changer Partie remet tout chapitre incompatible sur **Tous les chapitres** et toute notion incompatible sur **Toutes les notions**. Changer Chapitre remet toute notion incompatible sur **Toutes les notions**. Choisir Réflexe fixe `difficulty` à `{ kind: "not-applicable" }` et masque le contrôle ; le quitter remet toujours `difficulty` à `{ kind: "all" }`. Une difficulté précise exclut Réflexe sans changer Type et peut produire un état sans résultat explicite.
