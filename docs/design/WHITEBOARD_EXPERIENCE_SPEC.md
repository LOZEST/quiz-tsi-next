# Spécification de l'expérience du tableau blanc

> **Objectif :** fixer précisément l'écran principal et les principes des écrans associés. **Document normatif.**

## Arrivée et état initial

Après connexion, l'utilisateur arrive directement au tableau blanc, sans dashboard, page de lancement, page de statistiques ni écran intermédiaire obligatoire. Le menu est fermé, la question est visible près du haut et centrée dans le viewport complet, une grande zone d'écriture est immédiatement disponible, seuls les outils essentiels sont présents et aucune information technique de synchronisation n'est proéminente.

L'expérience est sobre, classique, très lisible, minimale, rapide et tactile. Elle privilégie iPad et Apple Pencil tout en restant complète à la souris et au clavier ; son élégance ne recherche aucun effet spectaculaire.

## Question, Canvas et menu

La question reste centrée dans le viewport complet, après la safe area supérieure. Compacte, réductible sans perte, lisible en portrait et paysage, elle ne monopolise pas le tableau et ne se déplace jamais à l'ouverture du menu.

Le menu est un `OverlayDrawer` qui s'ouvre depuis la gauche au-dessus du tableau sur téléphone, tablette, iPad, ordinateur et grand écran. Sa largeur est responsive, il respecte les safe areas et ne participe jamais à la largeur de mise en page. Il ne redimensionne jamais le Canvas, ne transforme aucune coordonnée logique et ne déplace ni question, trait ni forme. Il possède un backdrop et se ferme par son bouton, le backdrop, Échap ou une navigation. Ouvert, il piège le focus et permet une navigation clavier complète ; fermé, il restaure le focus sur son déclencheur hors navigation.

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
