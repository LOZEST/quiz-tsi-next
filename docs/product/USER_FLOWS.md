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
- **Étapes :** modifier puis Changer maintenant ou Annuler.
- **États :** message et dialogue interne.
- **Résultat attendu :** confirmer efface puis charge ; annuler restaure filtres et brouillon.
- **Erreurs :** chargement échoue explicitement.
- **Reprise :** aucune configuration cachée.

### FLOW-SESSION-003 — Révision du jour

- **Préconditions :** plan local disponible.
- **Étapes :** ouvrir parcours puis détail.
- **États :** compact → disclosure.
- **Résultat attendu :** notion, succès/objectif/état puis détails.
- **Erreurs :** plan absent/obsolète.
- **Reprise :** copie locale puis sync.

### FLOW-SESSION-004 — Points faibles

- **Préconditions :** classement disponible.
- **Étapes :** ouvrir parcours/détail.
- **États :** compact, détails fermés.
- **Résultat attendu :** priorité, notion, difficulté puis justification.
- **Erreurs :** données insuffisantes.
- **Reprise :** proposer libre/recalcul après sync.

## TEST

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
