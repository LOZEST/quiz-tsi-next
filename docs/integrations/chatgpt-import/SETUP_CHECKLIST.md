# Configuration externe et recette manuelle

1. Activer le serveur OAuth 2.1 Supabase et configurer l’Authorization Path avec l’URL Pages réelle `/quiz-tsi-next/oauth/consent`.
2. Créer le GPT « Import Quiz TSI » et une Action OAuth.
3. Copier exactement la callback URL fournie par ChatGPT dans le client OAuth Supabase.
4. Garder le client secret uniquement dans l’éditeur GPT; ne jamais le committer.
5. Définir `QUIZ_TSI_GPT_OAUTH_CLIENT_ID` dans les secrets de l’Edge Function.
6. Inscrire ce même `client_id` dans `public.oauth_integration_clients` avec `purpose = 'chatgpt-question-import'` et `enabled = true` depuis une migration ou une session opérateur privilégiée; ne jamais accorder cette table à `authenticated` ou `anon`.
7. Remplacer `PROJECT_REF` dans `openapi.yaml`, coller le schéma et `GPT_INSTRUCTIONS.md`, puis uploader le Knowledge généré.
8. Définir la Privacy Policy URL sur `/quiz-tsi-next/privacy/chatgpt-import`.
9. Tester les comptes A puis B, l’isolation, le replay `importId`, un payload hostile et un échec réseau.
10. Vérifier la couverture PDF, les incertitudes, l’absence de publication et la relecture locale après pull.

Le serveur OAuth 2.1 Supabase est une dépendance externe susceptible d’évoluer. La recette réelle GPT/OAuth à deux comptes reste manuelle et la PR demeure draft tant qu’elle n’est pas terminée.
