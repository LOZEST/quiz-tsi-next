# Spécification de l'expérience du tableau blanc

> **Objectif :** fixer précisément l'écran principal et les principes des écrans associés. **Document normatif.**

## Arrivée et état initial

Après connexion, l'utilisateur arrive directement au tableau blanc, sans dashboard, page de lancement, page de statistiques ni écran intermédiaire obligatoire. Le menu est fermé, la question est visible près du haut et centrée dans le viewport complet, une grande zone d'écriture est immédiatement disponible, seuls les outils essentiels sont présents et aucune information technique de synchronisation n'est proéminente.

L'expérience est sobre, classique, très lisible, minimale, rapide et tactile. Elle privilégie iPad et Apple Pencil tout en restant complète à la souris et au clavier ; son élégance ne recherche aucun effet spectaculaire.

Le Pencil écrit sans jamais faire défiler le viewport sur la surface du Canvas ; le doigt reste réservé à la navigation tactile prévue. Le Canvas capture le pointeur pendant l'écriture. Une nouvelle question effectivement chargée commence sur un tableau vide sans confirmation ; un changement impossible ne détruit pas le tableau courant.

## Livraison progressive des outils

PR3 fournit exclusivement le moteur manuscrit : Canvas 2D natif, Apple Pencil, pression, inclinaison, stylo, gomme, grille, undo/redo, scènes versionnées, persistance locale isolée et toolbar minimale.

PR3 ne fournit aucune forme géométrique, ligne, rectangle, cercle, flèche ou autre objet vectoriel. Il ne fournit pas non plus la sélection, le déplacement ni le redimensionnement d'objets.

PR6, **Advanced Whiteboard Tools**, ajoute ces formes et objets vectoriels ainsi que leur sélection, leur déplacement et leur redimensionnement, en conservant la compatibilité avec les scènes manuscrites versionnées de PR3.

La palette compacte de PR6 fournit droite, flèche, rectangle, carré, cercle, triangle, axes, repère orthonormé, cercle trigonométrique et tableau de signes. Le tableau de signes est une grille mathématique structurée avec lignes d'en-tête, colonnes et zones d'écriture ; il ne se réduit pas à un rectangle décoratif. La grille reste un réglage secondaire. Les formes magiques, activées par défaut dans les réglages Pencil, transforment après environ 500 ms de maintien un tracé admissible en droite ou cercle selon les seuils historiques déterministes ; la transformation reste annulable.

Sur le côté du tableau, deux boutons principaux seulement sont visibles : **Stylo** et **Formes**. **Stylo** révèle uniquement Stylo et Gomme. **Formes** révèle la palette mathématique et l'accès à la sélection des objets, sans contrôle de taille prédéfinie ; les dimensions sont choisies naturellement lors du placement puis restent modifiables. Annuler et Rétablir restent disponibles dans un contrôle d'historique compact distinct.

## Question, Canvas et menu

La question reste centrée dans le viewport complet, après la safe area supérieure. Compacte, réductible sans perte, lisible en portrait et paysage, elle ne monopolise pas le tableau et ne se déplace jamais à l'ouverture du menu.

Son contrôle de repli est un chevron discret, accessible et doté d'une cible tactile de 44 × 44 px. La correction structurée apparaît dans une carte responsive directement au-dessus des actions **Réussi** et **Raté**, sans masquer ces actions.

Le menu est un `OverlayDrawer` qui s'ouvre depuis la gauche au-dessus du tableau sur téléphone, tablette, iPad, ordinateur et grand écran. Sa largeur est responsive, il respecte les safe areas et ne participe jamais à la largeur de mise en page. Il ne redimensionne jamais le Canvas, ne transforme aucune coordonnée logique et ne déplace ni question ni trait ; à partir de PR6, cette garantie couvre aussi les formes et autres objets vectoriels. Il possède un backdrop et se ferme par son bouton, le backdrop, Échap ou une navigation. Ouvert, il piège le focus et permet une navigation clavier complète ; fermé, il restaure le focus sur son déclencheur hors navigation.

`Sidebar` n'est jamais utilisée sur `/whiteboard` : aucune barre latérale persistante ne réduit le Canvas. Une éventuelle `Sidebar` reste réservée à un écran secondaire explicitement autorisé par un document normatif. L'ancien nom `MobileDrawer` ne désigne pas le composant normatif, qui n'est pas limité au mobile.

Ordre exact :

1. parcours ou session active ;
2. options du parcours ;
3. réglages Apple Pencil repliables ;
4. Tableau blanc ;
5. Mon parcours ;
6. Banque de questions ;
7. Réglages ;
8. carte de compte compacte en bas.

Les réglages Pencil du menu ont un effet immédiat. Le menu n'expose pas logs, clés Supabase, diagnostics, toutes les statistiques, administration complète, gros bouton Déconnexion ni import/export permanent.

## Autres écrans

- **Connexion :** Quiz TSI, phrase courte, email, mot de passe, affichage/masquage, Se connecter, erreurs compréhensibles ; aucune bannière marketing, illustration géante ou statistique publique.
- **Mon parcours :** un indicateur principal, trois secondaires au plus, travail du jour, progression par grandes parties, points faibles prioritaires, calendrier et activité récente. Chapitre, notion, maîtrise et historique exigent une action volontaire.
- **Banque de questions :** recherche, filtres, liste lisible, aperçu, création et modification ; aucune mosaïque inutile de grandes cartes.
- **Réglages :** sections nommées, options secondaires repliées ; aucun détail interne d'outbox ou de Supabase.
- **Compte :** identité, email, rôle traduit, état utile de synchronisation, données locales pertinentes ; déconnexion non proéminente.
- **Administration :** rôles autorisés seulement, séparation visuelle du quotidien ; aucune permission uniquement côté interface.

## Direction visuelle

Fond blanc ou blanc cassé, texte presque noir, gris doux, bleu d'accent unique, séparateurs fins, arrondis modérés, ombres très légères seulement si nécessaires, typographie système, espaces généreux sans gaspillage et cibles tactiles d'au moins 44 × 44 px. Aucune police distante.

L'application n'est ni dashboard générique, ni assemblage de grandes cartes colorées, ni interface administrative permanente, ni imitation excessive d'iOS, ni accumulation d'ombres, dégradés ou animations. Elle ne peut pas être l'ancienne application simplement recouverte d'un nouveau CSS.
