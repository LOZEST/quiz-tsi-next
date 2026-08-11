# Configuration externe et recette manuelle

## Architecture retenue

Le serveur MCP est la fonction Edge `quiz-tsi-mcp`. Il implémente le transport HTTP MCP stateless, valide techniquement le Bearer OAuth, puis le relaie sans le transformer vers la fonction métier existante `gpt-question-import`. Cette dernière reste l’unique frontière de validation métier du lot et appelle la RPC atomique existante.

```text
ChatGPT → quiz-tsi-mcp → gpt-question-import → RPC Supabase → brouillons privés
```

Un service d’hébergement séparé n’est pas nécessaire : les Edge Functions Supabase savent servir le protocole HTTP, effectuer la découverte OAuth et appeler une autre fonction du même projet. L’API OpenAPI historique reste conservée comme outil de diagnostic/compatibilité, mais la connexion ChatGPT principale utilise désormais MCP.

## Variables et secrets Edge Functions

Définir avec `supabase secrets set` :

- `QUIZ_TSI_GPT_OAUTH_CLIENT_ID` : identifiant du client OAuth autorisé, lu par `gpt-question-import` ;
- `QUIZ_TSI_MCP_PUBLIC_URL` : URL HTTPS canonique du MCP, par exemple `https://PROJECT_REF.supabase.co/functions/v1/quiz-tsi-mcp` ;
- `QUIZ_TSI_MCP_TOKEN_AUDIENCE` : audience JWT attendue, normalement identique à `QUIZ_TSI_MCP_PUBLIC_URL` ;
- `QUIZ_TSI_MCP_ALLOWED_ORIGINS` : liste exacte, séparée par des virgules, des origines navigateur acceptées. Par défaut : `https://chatgpt.com,https://chat.openai.com`. Une requête serveur sans `Origin` reste acceptée ; toute origine présente hors liste reçoit `403 origin-forbidden` ;
- `GPT_QUESTION_IMPORT_URL` : facultatif, URL de `gpt-question-import`; par défaut elle est dérivée de `SUPABASE_URL`.

`SUPABASE_URL` et `SUPABASE_ANON_KEY` sont fournis automatiquement aux Edge Functions. Ne jamais définir de `service_role` pour cette intégration et ne jamais placer un secret dans une variable `VITE_*`.

## Déploiement Supabase

1. Activer le serveur OAuth 2.1 Supabase et configurer l’Authorization Path avec l’URL Pages réelle `/quiz-tsi-next/oauth/consent`.
2. Vérifier que l’application React autorise cette URL dans les Redirect URLs Auth.
3. Créer ou conserver le client OAuth ChatGPT avec le scope standard minimal `email` et la callback fournie par ChatGPT. Le client peut être public avec PKCE si la surface ChatGPT le permet ; s’il est confidentiel, le secret reste uniquement dans la configuration ChatGPT.
4. Inscrire le `client_id` dans `public.oauth_integration_clients` avec `purpose = 'chatgpt-question-import'` et `enabled = true`, via une migration dédiée à l’environnement ou une session opérateur privilégiée.
5. Configurer un Custom Access Token Hook Supabase pour ce seul `client_id`, afin que la claim standard `aud` soit exactement `QUIZ_TSI_MCP_TOKEN_AUDIENCE`. Supabase documente actuellement `aud = authenticated` par défaut et ne documente pas la prise en charge du paramètre RFC 8707 `resource` dans son flow OAuth. Le hook d’audience est donc requis pour lier techniquement le token à la ressource MCP sans inventer de claim privée. Les tokens d’autres clients ou audiences sont refusés avant tout appel métier.
6. Définir les secrets ci-dessus.
7. Déployer dans cet ordre :

   ```sh
   supabase functions deploy gpt-question-import
   supabase functions deploy quiz-tsi-mcp --no-verify-jwt
   ```

   `--no-verify-jwt` est intentionnel pour que la fonction puisse émettre elle-même le challenge OAuth RFC 9728. Aucune mutation n’est autorisée sans Bearer : le token est d’abord vérifié par `quiz-tsi-mcp` avec Supabase Auth, l’issuer, l’audience et le `client_id`, puis `gpt-question-import`, son allowlist, la RPC et la RLS appliquent les contrôles métier existants.

8. Vérifier la découverte protégée :

   ```sh
   curl 'https://PROJECT_REF.supabase.co/functions/v1/quiz-tsi-mcp?metadata=oauth-protected-resource'
   curl -i -X POST 'https://PROJECT_REF.supabase.co/functions/v1/quiz-tsi-mcp' \
     -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
   ```

   Le premier appel doit annoncer `${SUPABASE_URL}/auth/v1` dans `authorization_servers`; le second doit répondre `401` avec un header `WWW-Authenticate` contenant `resource_metadata`. Le MCP utilise `verify_jwt = false` uniquement pour permettre cette découverte publique et produire lui-même le challenge conforme. Pour chaque POST authentifié, `quiz-tsi-mcp` vérifie ensuite via Supabase Auth la signature, l’expiration et les claims, puis impose l’issuer du projet, l’audience MCP et le `client_id` dédié avant tout relais.

### Frontière de confiance OAuth

`quiz-tsi-mcp` est le resource server OAuth public. Il valide techniquement le token avant de traiter JSON-RPC. `gpt-question-import` est un composant interne de la même ressource et reçoit le Bearer uniquement après cette validation ; il reste l’autorité pour l’identité courante, l’allowlist OAuth, les droits métier, le payload, l’idempotence, la quarantaine, la RPC et la RLS. Aucun `service_role` n’est utilisé.

MCP 2025-06-18 exige que le client envoie le paramètre RFC 8707 `resource` à l’autorisation et au token endpoint. La documentation Supabase OAuth consultée ne liste pas actuellement ce paramètre. La compatibilité complète de ce paramètre avec ChatGPT et Supabase doit donc être confirmée par la recette réelle. L’audience personnalisée et le `client_id` dédié empêchent néanmoins le MCP d’accepter un token Supabase générique ou destiné à une autre ressource.

## Configuration ChatGPT

1. Dans les réglages Connecteurs/Apps ou Developer mode de ChatGPT, ajouter un serveur MCP distant avec l’URL `QUIZ_TSI_MCP_PUBLIC_URL`.
2. Laisser ChatGPT découvrir le serveur OAuth Supabase via les métadonnées du MCP. Si l’interface demande un client préenregistré, saisir le `client_id` Supabase et conserver tout `client_secret` uniquement dans ChatGPT.
3. Installer les instructions de `GPT_INSTRUCTIONS.md` et le Knowledge `generated/program-knowledge.json`.
4. Vérifier que le seul outil d’écriture exposé est `import_question_drafts` et qu’il est présenté comme une création de brouillons privés, jamais comme une publication.
5. Définir la Privacy Policy URL sur `/quiz-tsi-next/privacy/chatgpt-import`.

## Recette manuelle obligatoire

Tester les comptes A puis B, l’isolation, le replay d’un même `importId`, le conflit avec un payload différent, un payload hostile, une couverture `text-only`/`incomplete`, un token expiré et un échec réseau. Après chaque import, vérifier dans Quiz TSI que les questions apparaissent seulement après synchronisation, avec `source = private`, `status = draft`, `validated = false`, et qu’aucune publication n’a eu lieu.

Tester aussi une origine navigateur refusée, l’absence légitime d’`Origin` pour un appel serveur, un header `MCP-Protocol-Version` incorrect, un token signé mais portant une autre audience, et l’indisponibilité de `gpt-question-import`. La PR reste en draft jusqu’à la recette OAuth réelle complète avec deux comptes.

La page de consentement conserve le texte métier : « Cette application demande l’autorisation de créer des brouillons privés dans ta banque Quiz TSI. »
