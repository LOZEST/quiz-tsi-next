# Spécification de création des questions

> **Objectif :** définir l'expérience d'écriture, le langage mathématique simplifié et la validation des questions. **Document normatif.** L'éditeur et le tutoriel relèvent de PR7.

## Éditeur et chaîne de vérité

L'auteur manipule des blocs de texte, formule, saut de ligne structuré, étape de correction et indice. Texte et formules se mélangent librement. Il n'accède jamais directement au LaTeX, HTML, JSON, JavaScript, à un AST, à `SafeExpressionNode` ni aux contrats internes.

**+ Formule** crée un bloc avec source simple modifiable, aperçu mathématique immédiat, état valide ou invalide et erreur pédagogique. Une erreur ne vide ni ne réécrit automatiquement la source.

La chaîne de vérité est : syntaxe mathématique simple → `MathSource` versionné → analyseur sécurisé → arbre mathématique contrôlé → adaptateur KaTeX temporaire → affichage. `MathSource` est la seule source persistée d'une formule : le LaTeX éventuellement généré pour KaTeX et le HTML KaTeX ne sont jamais persistés comme sources de vérité. L'auteur ne saisit et ne voit jamais directement du LaTeX. Une migration versionnée et idempotente convertit un ancien contenu LaTeX persistant vers une forme contrôlée ou le met en quarantaine, sans interpréter silencieusement un contenu invalide.

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
| `arcsin(x)` | arc sinus |
| `arccos(x)` | arc cosinus |
| `arctan(x)` | arc tangente |
| `a<=b` | inférieur ou égal |
| `a>=b` | supérieur ou égal |
| `a!=b` | différent |

Le rendu peut cacher les caractères techniques : `2*x` s'affiche comme une multiplication propre, sans astérisque lorsque le contexte le permet.

## Grammaire minimale normative — version 1

Cette grammaire est suffisamment précise pour que deux implémentations indépendantes produisent le même arbre à partir de la même source. Toute construction non définie ci-dessous est refusée en version 1 et ne peut pas être ajoutée silencieusement.

### 5.1 Nombres

`12`, `-12`, `1.5` et `1,5` sont acceptés. Le point et la virgule sont des séparateurs décimaux équivalents et produisent la même valeur numérique interne. La représentation interne normalisée utilise le point. Le point-virgule `;` sépare plusieurs arguments ou bornes.

### 5.2 Identifiants ordinaires

Un identifiant ordinaire commence par une lettre latine ou grecque supportée par le registre ; les caractères suivants peuvent être des lettres latines ou grecques supportées ou des chiffres. Il ne peut pas contenir `_` : ce caractère est toujours réservé à l'opérateur d'indice dans les expressions mathématiques ordinaires. Le tokenizer termine donc un identifiant ordinaire avant `_`. Aucun mécanisme d'échappement ou de délimitation permettant d'inclure littéralement `_` dans un identifiant ordinaire n'existe en version 1 ; un tel identifiant est hors syntaxe.

Les commandes réservées sont `sqrt`, `abs`, `vec`, `sin`, `cos`, `tan`, `ln`, `exp`, `arcsin`, `arccos` et `arctan`. Elles sont obligatoirement écrites en minuscules ; une autre casse est refusée.

### 5.3 Variables paramétrées

Le format est `@nom`. Le premier caractère est une lettre latine ; les suivants sont des lettres latines, chiffres ou `_`, sans espace ni autre ponctuation. Cette règle est propre aux variables paramétrées et ne permet pas `_` dans un identifiant ordinaire. Un nom de commande réservé est interdit. `@a`, `@n` et `@coefficient_1` sont valides ; `@1a`, `@a b` et `@sqrt` sont invalides. Une variable paramétrée reste distincte d'un identifiant mathématique ordinaire.

### 5.4 Espaces

Les espaces autour des opérateurs sont ignorés : `a+b` et `a + b` sont équivalents. Ils ne créent jamais une multiplication implicite.

### 5.5 Multiplication

La source exige `*` : `2*x` est valide et `2x` est invalide. Message attendu : « Utilise `2*x` pour écrire une multiplication. » Le rendu peut afficher `2x` sans astérisque.

### 5.6 Priorité des opérations

L'ordre exact est : (1) parenthèses et appels de fonctions ; (2) indices et puissances ; (3) signe unaire ; (4) multiplication et division ; (5) addition et soustraction ; (6) comparaisons ; (7) logique et appartenance lorsqu'elles sont utilisées. Ainsi, `-x^2` signifie `-(x^2)` ; le carré de `-x` s'écrit `(-x)^2`.

### 5.7 Puissances et indices

`x^2`, `x_n`, `x_(n+1)`, `x_n^2` et `x_(n+1)^2` sont valides. `_` est toujours l'opérateur d'indice : `x_n` est nécessairement analysé avec l'identifiant `x` comme base et l'identifiant `n` comme indice, jamais comme un identifiant unique. `x_(n+1)` produit un indice composé. L'indice se rattache à la base avant la puissance. Les parenthèses sont obligatoires pour un indice composé.

### 5.8 Division et fractions

`a/b` produit une fraction simple. Une expression composée exige des parenthèses : `(a+b)/(c-d)`. `a/b/c` est refusé avec : « Cette division est ambiguë. Utilise `(a/b)/c` ou `a/(b/c)`. »

### 5.9 Fonctions

Les parenthèses sont obligatoires : `sqrt(x)`, `abs(x)`, `vec(u)`, `sin(x)`, `cos(x)`, `tan(x)`, `ln(x)`, `exp(x)`, `arcsin(x)`, `arccos(x)` et `arctan(x)`. `sqrt x` et `sin x` sont invalides ; le message montre la syntaxe correcte.

### 5.10 Comparaisons

La version 1 définit exactement les formes `a=b`, `a<b`, `a>b`, `a<=b`, `a>=b` et `a!=b`, en cohérence avec les opérateurs de `SafeExpressionNode`. `=` représente une égalité mathématique, notamment dans `∑_(k=1)^n`. Les formes Unicode `≤`, `≥` et `≠` produisent respectivement les mêmes opérateurs internes que `<=`, `>=` et `!=`.

### 5.11 Symboles Unicode

Les tokens sûrs supportés au minimum sont `ℕ ℤ ℚ ℝ ℂ ∅`, `α β γ δ ε θ λ μ π ρ σ φ ω`, `Δ Σ Ω`, `∈ ∉ ⊂ ⊆ ∪ ∩`, `∀ ∃ ⇒ ⇔`, `∞ ∑ ∏ ∫ ∂ ∇` et `∥ ⟂ ∠`. Les formes déterministes minimales sont `x ∈ ℝ`, `θ ∈ [0;π]`, `∑_(k=1)^n` et `∫_a^b`. Le symbole `π` provient du **Clavier mathématique** et représente une constante mathématique ; l'identifiant latin `pi` n'est pas un raccourci de version 1. Ces tokens ne sont jamais interprétés comme HTML ou JavaScript. La grammaire n'est jamais étendue silencieusement.

### 5.12 Intervalles

Les intervalles de version 1 utilisent `;` comme séparateur : `[a;b]` est fermé aux deux extrémités, `]a;b[` est ouvert aux deux extrémités, `[a;b[` est fermé à gauche et ouvert à droite, et `]a;b]` est ouvert à gauche et fermé à droite. Les bornes peuvent contenir toute expression valide ainsi que `∞`. Exemples : `[0;π]`, `]-∞;0]` et `[1;∞[`.

### 5.13 Erreurs

Chaque erreur fournit une explication humaine, l'élément concerné, la source originale intacte et un exemple correct, sans trace interne du parser. « Syntax error at position 6. » est interdit. Message attendu : « La fonction `sqrt` doit contenir une expression entre parenthèses. Exemple : `sqrt(x+1)`. »

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

Les références `@nom` sont autorisées dans le texte de l'énoncé, les blocs de formule, l'indice, les titres des étapes de correction et leur contenu. Pour une même variante, une variable conserve la même valeur dans tous ces emplacements.

Avant publication, toute référence correspond à une variable définie ; une référence inconnue bloque la publication. Une variable définie mais inutilisée produit un avertissement non bloquant. Le renommage met à jour atomiquement toutes ses références et aucune référence intermédiaire cassée n'est persistée. Supprimer une variable utilisée exige une confirmation interne ; supprimer une variable inutilisée n'exige pas de confirmation destructive. L'aperçu affiche l'énoncé, l'indice et la correction avec les mêmes valeurs.

## Variantes, publication et tutoriel

Avant publication paramétrée, au moins dix variantes valides sont générées et contrôlées. L'unique exception concerne une question officielle statique dont l'espace valide fini contient moins de dix variantes : le moteur doit alors en apporter la preuve exhaustive, contrôler toutes les variantes distinctes et fixer `validationVariantCount` à ce nombre exact. Cette exception n'est autorisée ni pour une question privée ou partagée, ni après une recherche bornée non exhaustive. Plusieurs énoncés, indices et corrections rendus sont montrés ; l'auteur peut régénérer et modifier domaines ou contraintes. Une mauvaise variante n'est jamais ignorée silencieusement.

Une configuration impossible bloque la publication : « Aucune combinaison ne respecte toutes les règles. Vérifie les intervalles ou supprime une contrainte. » Le brouillon est restaurable, la source n'est jamais perdue après erreur et toute invalidité bloque la publication.

PR7 fournit un tutoriel couvrant texte, formule, fraction, puissance, indice, symbole, variable, contrainte, dix variantes et publication. Il reste accessible via Banque de questions → Aide → Créer une question. Cette PR ne l'implémente pas.

## Banques futures

Aucune question fictive ni aucun format déduit de données absentes n'est autorisé. PR4 prend en charge l'import initial des banques validées lorsqu'elles seront disponibles ; PR7 l'import avancé et ses rapports détaillés. Dès PR4, l'import initial est versionné, validé, idempotent et traçable ; il met les entrées invalides en quarantaine, conserve toutes les entrées valides et produit un rapport. Schéma et formules sont versionnés et les sources fournies sont conservées sans en inventer.
