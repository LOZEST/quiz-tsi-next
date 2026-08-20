# Configuration externe et recette manuelle

1. Activer le serveur OAuth 2.1 Supabase et configurer l’Authorization Path avec l’URL Pages réelle `/quiz-tsi-next/oauth/consent`.
2. Créer le GPT « Import Quiz TSI » et une Action OAuth avec le seul scope standard `email`; ce scope identifie le compte et ne constitue jamais une autorisation de base de données.
3. Copier exactement la callback URL fournie par ChatGPT dans le client OAuth Supabase.
4. Garder le client secret uniquement dans l’éditeur GPT; ne jamais le committer.
5. Définir `QUIZ_TSI_GPT_OAUTH_CLIENT_ID` dans les secrets de l’Edge Function.
6. Inscrire ce même `client_id` dans `public.oauth_integration_clients` avec `purpose = 'chatgpt-question-import'` et `enabled = true` depuis une migration ou une session opérateur privilégiée; ne jamais accorder cette table à `authenticated` ou `anon`.
7. Remplacer `PROJECT_REF` dans `openapi.yaml`, coller le schéma et `GPT_INSTRUCTIONS.md` (le Knowledge `program-knowledge.json` n'est plus nécessaire — voir `GPT_KNOWLEDGE_README.md`).
8. Définir la Privacy Policy URL sur `/quiz-tsi-next/privacy/chatgpt-import`.
9. Tester les comptes A puis B, l’isolation, le replay `importId`, un payload hostile et un échec réseau.
10. Vérifier la couverture PDF, les incertitudes, l’absence de publication et la relecture locale après pull.

La page de consentement conserve le texte métier : « Cette application demande l’autorisation de créer des brouillons privés dans ta banque Quiz TSI. » L’autorisation effective reste imposée par le `client_id` allowlisté, `auth.uid()`, la RLS, l’Edge Function et la RPC.

Le serveur OAuth 2.1 Supabase est une dépendance externe susceptible d’évoluer. La recette réelle GPT/OAuth à deux comptes reste manuelle et la PR demeure draft tant qu’elle n’est pas terminée.
