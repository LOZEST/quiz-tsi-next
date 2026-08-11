# Configuration externe et recette manuelle

## Architecture retenue

Le serveur MCP est la fonction Edge `quiz-tsi-mcp`. Il implémente le transport HTTP MCP stateless et relaie le Bearer OAuth de l’utilisateur, sans le transformer, vers la fonction métier existante `gpt-question-import`. Cette dernière reste l’unique frontière de validation du lot et appelle la RPC atomique existante.

```text
ChatGPT → quiz-tsi-mcp → gpt-question-import → RPC Supabase → brouillons privés
```

Un service d’hébergement séparé n’est pas nécessaire : les Edge Functions Supabase savent servir le protocole HTTP, effectuer la découverte OAuth et appeler une autre fonction du même projet. L’API OpenAPI historique reste conservée comme outil de diagnostic/compatibilité, mais la connexion ChatGPT principale utilise désormais MCP.

## Variables et secrets Edge Functions

Définir avec `supabase secrets set` :

- `QUIZ_TSI_GPT_OAUTH_CLIENT_ID` : identifiant du client OAuth autorisé, lu par `gpt-question-import` ;
- `QUIZ_TSI_MCP_PUBLIC_URL` : URL HTTPS canonique du MCP, par exemple `https://PROJECT_REF.supabase.co/functions/v1/quiz-tsi-mcp` ;
- `GPT_QUESTION_IMPORT_URL` : facultatif, URL de `gpt-question-import`; par défaut elle est dérivée de `SUPABASE_URL`.

`SUPABASE_URL` et `SUPABASE_ANON_KEY` sont fournis automatiquement aux Edge Functions. Ne jamais définir de `service_role` pour cette intégration et ne jamais placer un secret dans une variable `VITE_*`.

## Déploiement Supabase

1. Activer le serveur OAuth 2.1 Supabase et configurer l’Authorization Path avec l’URL Pages réelle `/quiz-tsi-next/oauth/consent`.
2. Vérifier que l’application React autorise cette URL dans les Redirect URLs Auth.
3. Créer ou conserver le client OAuth ChatGPT avec le scope standard minimal `email` et la callback fournie par ChatGPT. Le client peut être public avec PKCE si la surface ChatGPT le permet ; s’il est confidentiel, le secret reste uniquement dans la configuration ChatGPT.
4. Inscrire le `client_id` dans `public.oauth_integration_clients` avec `purpose = 'chatgpt-question-import'` et `enabled = true`, via une migration dédiée à l’environnement ou une session opérateur privilégiée.
5. Définir les secrets ci-dessus.
6. Déployer dans cet ordre :

   ```sh
   supabase functions deploy gpt-question-import
   supabase functions deploy quiz-tsi-mcp --no-verify-jwt
   ```

   `--no-verify-jwt` est intentionnel pour que la fonction puisse émettre elle-même le challenge OAuth RFC 9728. Aucune mutation n’est autorisée sans Bearer : le token est ensuite vérifié par `gpt-question-import`, Supabase Auth, l’allowlist du `client_id`, la RPC et la RLS.

7. Vérifier la découverte protégée :

   ```sh
   curl 'https://PROJECT_REF.supabase.co/functions/v1/quiz-tsi-mcp?metadata=oauth-protected-resource'
   curl -i -X POST 'https://PROJECT_REF.supabase.co/functions/v1/quiz-tsi-mcp' \
     -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
   ```

   Le premier appel doit annoncer `${SUPABASE_URL}/auth/v1` dans `authorization_servers`; le second doit répondre `401` avec un header `WWW-Authenticate` contenant `resource_metadata`.

## Configuration ChatGPT

1. Dans les réglages Connecteurs/Apps ou Developer mode de ChatGPT, ajouter un serveur MCP distant avec l’URL `QUIZ_TSI_MCP_PUBLIC_URL`.
2. Laisser ChatGPT découvrir le serveur OAuth Supabase via les métadonnées du MCP. Si l’interface demande un client préenregistré, saisir le `client_id` Supabase et conserver tout `client_secret` uniquement dans ChatGPT.
3. Installer les instructions de `GPT_INSTRUCTIONS.md` et le Knowledge `generated/program-knowledge.json`.
4. Vérifier que le seul outil d’écriture exposé est `import_question_drafts` et qu’il est présenté comme une création de brouillons privés, jamais comme une publication.
5. Définir la Privacy Policy URL sur `/quiz-tsi-next/privacy/chatgpt-import`.

## Recette manuelle obligatoire

Tester les comptes A puis B, l’isolation, le replay d’un même `importId`, le conflit avec un payload différent, un payload hostile, une couverture `text-only`/`incomplete`, un token expiré et un échec réseau. Après chaque import, vérifier dans Quiz TSI que les questions apparaissent seulement après synchronisation, avec `source = private`, `status = draft`, `validated = false`, et qu’aucune publication n’a eu lieu.

La page de consentement conserve le texte métier : « Cette application demande l’autorisation de créer des brouillons privés dans ta banque Quiz TSI. »
