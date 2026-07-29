# Spécification du design system

> **Objectif :** fixer le langage visuel et les contrats des composants génériques. **Document normatif.** Aucun composant n'est implémenté en PR0.

## Sommaire
1. [Direction](#direction) · 2. [Tokens](#tokens) · 3. [Règles](#règles-dinteraction) · 4. [Composants](#catalogue-des-composants) · 5. [Interdictions](#interdictions-visuelles)

## Direction

Esthétique blanche cassée/blanche/gris clair, texte presque noir, unique bleu doux, séparateurs fins, arrondis sobres, ombres légères, espaces généreux, typographie système, composants tactiles, animations courtes et fonctionnelles. Elle est classique et durable, jamais un dashboard générique.

## Tokens

```css
--qtsi-bg: #f7f7f5;
--qtsi-surface: #ffffff;
--qtsi-surface-muted: #f1f1ef;
--qtsi-surface-hover: #ececea;
--qtsi-text: #1d1d1f;
--qtsi-text-secondary: #6e6e73;
--qtsi-text-tertiary: #8e8e93;
--qtsi-border: rgba(60, 60, 67, 0.14);
--qtsi-border-strong: rgba(60, 60, 67, 0.24);
--qtsi-accent: #0a66d8;
--qtsi-accent-hover: #075bbf;
--qtsi-accent-soft: rgba(10, 102, 216, 0.10);
--qtsi-success: #248a3d;
--qtsi-danger: #c9342f;
--qtsi-warning: #9a6700;
```

Aucune police distante. Police : `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`. Espacement : 4, 8, 12, 16, 20, 24, 32, 40, 48 px. Rayons : 10, 14, 18, 22 px et complet. Toute cible interactive : au moins 44×44 px. Animation : 160–220 ms, `cubic-bezier(0.2, 0, 0, 1)`, supprimée/réduite avec `prefers-reduced-motion`.

## Règles d'interaction

États communs : repos, hover non essentiel, focus visible, actif, désactivé, chargement, erreur. Les libellés restent visibles là où l'icône serait ambiguë. Les erreurs sont textuelles et réparables. Dialogues internes seulement (jamais API bloquante du navigateur), focus piégé, arrière-plan `inert`, Échap et retour au déclencheur. Safe areas et portrait/paysage sont natifs.

## Catalogue des composants

| Composant | Responsabilité et variantes | États / accessibilité / tactile | Ne doit pas |
|---|---|---|---|
| AppShell | cadre routes, zones landmark | chargement/offline ; skip link, ordre DOM | contenir logique métier |
| Sidebar | navigation persistante grands écrans | actif ; `nav`, `aria-current`, liens ≥44 | devenir dashboard |
| MobileDrawer | navigation superposée | ouvert/fermé ; Échap, inert, focus, backdrop | déplacer/redimensionner le Canvas |
| PageHeader | titre et action principale rare | compact/standard ; titre hiérarchique | accumuler statistiques/actions |
| Section | grouper contenu titré | ouverte/simple ; relation titre-contenu | simuler une carte sans raison |
| Surface | fond et séparation | défaut/muted/interactive ; contraste | imposer logique/navigation |
| Button | action textuelle | primary/secondary/danger/quiet ; busy/disabled/focus ; ≥44 | être factice ou icône seule |
| IconButton | action connue compacte | default/danger ; nom accessible/tooltip ; 44×44 | utiliser couleur seule ou icône ambiguë |
| TextField | saisie texte | normal/error/disabled ; label visible, aide liée ; ≥44 | cacher le label dans placeholder |
| Select | choix dans liste bornée | normal/error/disabled ; label et clavier ; ≥44 | remplacer une recherche complexe |
| Checkbox | options indépendantes | checked/mixed/error ; groupe nommé ; 44 | porter choix exclusif |
| RadioGroup | choix exclusif | horizontal/vertical/error ; fieldset/legend ; 44 | autoriser zéro choix si obligatoire |
| SegmentedControl | petit choix exclusif | 2–4 options ; clavier, sélection annoncée ; 44 | servir à une longue taxonomie |
| Disclosure | détails secondaires | ouvert/fermé ; `aria-expanded`/controls ; 44 | ouvrir par hover seul |
| Dialog | décision bloquante interne | standard/danger/busy ; focus, Échap, inert | appeler `alert`/`confirm`/`prompt` |
| Toast | accusé non bloquant | info/success/warning/error ; `aria-live` | porter seule une erreur critique/action durable |
| EmptyState | expliquer absence + action | vide/aucun résultat/offline | décorer excessivement ou mentir |
| StatusBadge | état court | neutral/success/warning/danger | coder l'état uniquement par couleur |
| AccountCard | identité/rôle et lien compte | compact ; contenu lisible, cible 44 | rendre Déconnexion proéminente |
| LoadingState | attente compréhensible | inline/page ; annonce polie | bouger en permanence ou masquer indéfiniment |
| ErrorState | expliquer/réessayer | inline/page ; focus si critique | afficher jargon seul |
| OfflineBanner | réseau indisponible et impact | passive/actionable ; `role=status` | promettre une sync non réalisée |

## Interdictions visuelles

Grands dégradés, néon, glassmorphism généralisé, grosses ombres, cartes multicolores, animations permanentes, grandes illustrations décoratives, formes inutiles, icônes colorées sans fonction, accent différent par page, dashboard générique, grande bannière marketing, zoom au survol et interface dépendante uniquement du hover sont interdits.
