# Frontière `shared`

Ce dossier accueille uniquement les utilitaires réellement transversaux, utilisés
par plusieurs couches sans dépendre d'une feature.

- Aucun code métier ni accès direct à Supabase, IndexedDB ou au DOM métier.
- Ce dossier n'est pas un fourre-tout et ne contourne aucune frontière.
- Une abstraction n'y entre qu'en réponse à plusieurs usages réels et testés.
