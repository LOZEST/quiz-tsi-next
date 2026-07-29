# Spécification de création des questions

> **Objectif :** définir l'expérience d'écriture, le langage mathématique simplifié et la validation des questions. **Document normatif.** L'éditeur et le tutoriel relèvent de PR7.

## Éditeur et chaîne de vérité

L'auteur manipule des blocs de texte, formule, saut de ligne structuré, étape de correction et indice. Texte et formules se mélangent librement. Il n'accède jamais directement au LaTeX, HTML, JSON, JavaScript, à un AST, à `SafeExpressionNode` ni aux contrats internes.

**+ Formule** crée un bloc avec source simple modifiable, aperçu mathématique immédiat, état valide ou invalide et erreur pédagogique. Une erreur ne vide ni ne réécrit automatiquement la source.

La chaîne de vérité est : syntaxe mathématique simple → analyseur sécurisé → arbre mathématique contrôlé → rendu KaTeX → affichage. La source et sa version sont persistées ; le HTML KaTeX ne l'est jamais comme source de vérité. Une migration versionnée et idempotente maintient les anciennes formules lisibles.

## Langage mathématique simplifié

Le langage est versionné, déterministe et facile à taper. Une fraction composée exige des parenthèses explicites.

| Saisie | Signification |
|---|---|
| `a/b` | fraction simple |
| `(a+b)/(c-d)` | fraction composée |
| `2*x` | multiplication |
| `x^2` | puissance |
| `x_(n+1)` | indice composé |
| `sqrt(x)` | racine carrée |
| `abs(x)` | valeur absolue |
| `vec(u)` | vecteur |
| `sin(x)` | sinus |
| `cos(x)` | cosinus |
| `tan(x)` | tangente |
| `ln(x)` | logarithme népérien |
| `exp(x)` | exponentielle |
| `a<=b` | inférieur ou égal |
| `a>=b` | supérieur ou égal |
| `a!=b` | différent |

Le rendu peut cacher les caractères techniques : `2*x` s'affiche comme une multiplication propre, sans astérisque lorsque le contexte le permet.

## Aide, Raccourcis et registre

Près du champ figure « Exemples : `sqrt(x)`, `x^2`, `(a+b)/(c-d)`, `2*x` ». L'action permanente **Raccourcis** ouvre une liste compacte donnant syntaxe, signification, exemple et résultat rendu, par catégories : opérations, fractions, puissances et indices, fonctions, comparaisons, vecteurs et variables paramétrées.

L'analyseur, **Raccourcis**, les exemples, erreurs, tests et tutoriel consomment le même registre versionné. Le tutoriel ne décrit jamais une commande absente du registre.

Les erreurs expliquent la correction : « La fonction sqrt doit contenir une expression entre parenthèses. Exemple : sqrt(x+1) » ou « Une fraction contenant plusieurs termes doit utiliser des parenthèses. Utilise : (a+b)/(c-d) ». Un message limité à une position de syntaxe est interdit.

## Clavier mathématique

Le **Clavier mathématique** insère à la position active, sans effacer la formule, les caractères difficiles à saisir. Il reste compact et textuel, avec les onglets possibles Ensembles | Grec | Logique | Analyse | Géométrie.

| Catégorie | Symboles |
|---|---|
| Ensembles | ℕ ℤ ℚ ℝ ℂ ∅ |
| Grec | α β γ δ ε θ λ μ π ρ σ φ ω Δ Σ Ω |
| Logique | ∈ ∉ ⊂ ⊆ ∪ ∩ ∀ ∃ ⇒ ⇔ |
| Analyse | ∞ ∑ ∏ ∫ ∂ ∇ |
| Géométrie | ∥ ⟂ ∠ |

Chaque entrée expose symbole, nom accessible, libellé de lecteur d'écran et explication au survol ou appui prolongé, par exemple « ℝ — Ensemble des nombres réels ».

Le clavier ne propose pas comme boutons principaux fraction, multiplication, puissance, indice, racine, valeur absolue, sinus, cosinus, logarithme, exponentielle, `<=`, `>=` ou `!=` : ces saisies appartiennent à **Raccourcis**.

## Variables et contraintes

**+ Variable** ouvre un assistant : choisir le nom ; choisir Nombre entier, Nombre décimal ou Choix dans une liste ; définir les valeurs ; ajouter éventuellement une règle ; afficher plusieurs variantes. Une référence utilise `@`, par exemple `@a`, `@b`, `@n`, et se distingue ainsi d'une lettre mathématique. Exemple : nom `a`, Nombre entier, minimum `-9`, maximum `9`, valeurs interdites `0`. L'AST reste invisible.

Le constructeur emploie des phrases visuelles : `[Variable a] [est différente de] [0]`, `[Variable b] [est supérieure à] [Variable a]`, `[Expression a + b] [est supérieure à] [0]`, `[n] [est pair]`. Il couvre égal, différent, inférieur, inférieur ou égal, supérieur, supérieur ou égal, positif, négatif, pair, impair et appartenance à une liste. L'application les traduit vers l'AST sécurisé interne sans l'exposer.

## Variantes, publication et tutoriel

Avant publication paramétrée, au moins dix variantes valides sont générées et contrôlées. Plusieurs énoncés, indices et corrections rendus sont montrés ; l'auteur peut régénérer et modifier domaines ou contraintes. Une mauvaise variante n'est jamais ignorée silencieusement.

Une configuration impossible bloque la publication : « Aucune combinaison ne respecte toutes les règles. Vérifie les intervalles ou supprime une contrainte. » Le brouillon est restaurable, la source n'est jamais perdue après erreur et toute invalidité bloque la publication.

PR7 fournit un tutoriel couvrant texte, formule, fraction, puissance, indice, symbole, variable, contrainte, dix variantes et publication. Il reste accessible via Banque de questions → Aide → Créer une question. Cette PR ne l'implémente pas.

## Banques futures

Aucune question fictive ni aucun format déduit de données absentes n'est autorisé. PR4 prend en charge l'import initial des banques validées lorsqu'elles seront disponibles ; PR7 l'import avancé et les rapports. Schéma et formules sont versionnés, sources conservées, import idempotent, entrées invalides mises en quarantaine sans perdre les valides, et chaque import produit un rapport.
