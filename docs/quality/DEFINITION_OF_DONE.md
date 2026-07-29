# Definition of Ready et Definition of Done

> **Objectif :** définir les portes d'entrée et de sortie de toute tâche. **Document normatif.**

## Definition of Ready

Une tâche n'est prête que si tous les points sont vrais : comportements et contrats définis ; dépendances fusionnées ; sources historiques identifiées (ou explicitement sans objet) ; tests d'acceptation listés ; hors périmètre explicite. L'ambiguïté déclenche une PR documentaire, pas une hypothèse. La PR de roadmap responsable est identifiée.

## Definition of Done

Une fonctionnalité n'est terminée que si :

- [ ] contrat métier défini et documentation normative à jour ;
- [ ] comportement nominal implémenté ;
- [ ] chargement, état vide, erreur et hors connexion traités ;
- [ ] reprise traitée sans perte silencieuse ;
- [ ] portrait et paysage traités ;
- [ ] accessibilité WCAG AA et tactile traitée ;
- [ ] isolation des comptes vérifiée, y compris réponse réseau tardive ;
- [ ] persistance et migrations/version/idempotence/quarantaine vérifiées, avec compatibilité des scènes précédentes pour toute nouvelle forme ;
- [ ] tests unitaires et d'intégration réussis, incluant déterminisme, domaines, contraintes et variantes si la question est paramétrée ;
- [ ] tests navigateur réalisés lorsque nécessaires ;
- [ ] captures et comparaison visuelle réalisées lorsque nécessaires ;
- [ ] aucune régression connue masquée ni test affaibli ;
- [ ] limites restantes et validations non réalisées déclarées ;
- [ ] suite complète et prévisualisation réussies ;
- [ ] validation humaine réalisée avant fusion.

## Preuves attendues

La PR relie chaque scénario de la matrice à une preuve automatique et/ou manuelle reproductible, avec commande, environnement et résultat. Une capture ne remplace pas un test comportemental. Une validation locale ne prouve pas Pencil/iPad, PWA, RLS ou offline réel si ces environnements n'ont pas été exercés. Aucun statut `Validé` sans les deux preuves demandées et la revue humaine prévue.

## Cas non idéal

Erreur réseau, combinaison paramétrée impossible, contenu absent/invalide ou non sûr, migration partielle, stockage saturé, conflit, permission refusée, rotation, réduction de mouvement, lecteur d'écran, compte changé et réponse tardive sont des cas normaux. Si un cas ne concerne réellement pas la fonctionnalité, la PR le justifie au lieu de le cocher implicitement.

## Portes spécialisées

### Fonctionnalité mathématique
- [ ] registre mis à jour ; parser et rendu testés ; aide synchronisée ; migration de version idempotente testée ; erreurs pédagogiques testées ; aucune exécution dynamique arbitraire.

### Éditeur de question
- [ ] brouillon restaurable ; source conservée après erreur ; clavier, tactile, navigation clavier et lecteur d'écran testés ; publication invalide impossible ; au moins dix variantes contrôlées.

### Système de filtres
- [ ] option Tout et cascade parent/enfant testées ; aucun résultat et protection du brouillon testés ; interactions Réflexe/difficulté testées.
