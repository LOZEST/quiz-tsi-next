# Pont OAuth GPT Actions vers Supabase PKCE

Ce pont adapte le client OAuth de la GPT Action, qui appelle l’endpoint
d’autorisation sans PKCE, au serveur OAuth Supabase qui exige PKCE S256. Il ne
modifie ni les jetons Supabase, ni `gpt-question-import`, ni les règles RLS. Il
est sans état côté serveur : le `state` et le code intermédiaire sont chiffrés
et authentifiés en AES-256-GCM, avec des durées de vie respectives de 10 et
5 minutes.

## URLs à configurer

Dans la GPT Action OpenAI :

- Authorization URL :
  `https://jxoigcpeevegvfscryrg.supabase.co/functions/v1/gpt-oauth-authorize`
- Token URL :
  `https://jxoigcpeevegvfscryrg.supabase.co/functions/v1/gpt-oauth-token`
- méthode d’authentification : `client_secret_basic`
- scope : `email`
- callback OpenAI, inchangée :
  `https://chat.openai.com/aip/g-6911186baceee17745bfc3e22a1736d6a7c5b084/oauth/callback`

Dans le client OAuth Supabase existant, ajouter comme redirect URI autorisée :

`https://jxoigcpeevegvfscryrg.supabase.co/functions/v1/gpt-oauth-callback`

La callback OpenAI ne doit plus être utilisée comme redirect URI directe par
Supabase pour ce flux : le pont est désormais la callback du serveur OAuth.

## Secrets Edge Functions

Configurer les secrets suivants sans les écrire dans Git :

- `SUPABASE_URL=https://jxoigcpeevegvfscryrg.supabase.co`
- `QUIZ_TSI_GPT_OAUTH_CLIENT_ID` : identifiant du client OAuth Supabase existant
- `QUIZ_TSI_GPT_OAUTH_CLIENT_SECRET` : secret de ce même client
- `QUIZ_TSI_GPT_REDIRECT_URI` : callback OpenAI exacte indiquée ci-dessus
- `QUIZ_TSI_OAUTH_BRIDGE_CALLBACK_URL` : callback Edge Function exacte indiquée ci-dessus
- `QUIZ_TSI_OAUTH_BRIDGE_SECRET` : exactement 32 octets aléatoires, encodés en base64url sans padding

Exemple de génération locale du dernier secret :

```sh
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

Exemple de configuration (remplacer tous les placeholders dans le terminal) :

```sh
npx supabase secrets set --project-ref jxoigcpeevegvfscryrg \
  QUIZ_TSI_GPT_OAUTH_CLIENT_ID='<client-id>' \
  QUIZ_TSI_GPT_OAUTH_CLIENT_SECRET='<client-secret>' \
  QUIZ_TSI_GPT_REDIRECT_URI='https://chat.openai.com/aip/g-6911186baceee17745bfc3e22a1736d6a7c5b084/oauth/callback' \
  QUIZ_TSI_OAUTH_BRIDGE_CALLBACK_URL='https://jxoigcpeevegvfscryrg.supabase.co/functions/v1/gpt-oauth-callback' \
  QUIZ_TSI_OAUTH_BRIDGE_SECRET='<base64url-32-octets>'
```

## Déploiement

Les trois fonctions sont publiques au niveau de la passerelle (`verify_jwt =
false`) parce qu’elles interviennent avant l’émission d’un JWT. Elles valident
elles-mêmes la requête, le client, les URI, l’intégrité et l’expiration des
payloads. Déployer après avoir configuré les secrets :

```sh
npx supabase functions deploy gpt-oauth-authorize --project-ref jxoigcpeevegvfscryrg
npx supabase functions deploy gpt-oauth-callback --project-ref jxoigcpeevegvfscryrg
npx supabase functions deploy gpt-oauth-token --project-ref jxoigcpeevegvfscryrg
```

Le pont ne nécessite ni `SUPABASE_SERVICE_ROLE_KEY`, ni table, ni migration.
Ne jamais journaliser un code, un state, un verifier, un jeton ou un en-tête
Authorization.

## Recette manuelle

1. Dans l’éditeur de la GPT Action, enregistrer les deux URLs du pont, le client
   ID, le client secret et le scope `email`.
2. Lancer la connexion depuis ChatGPT et vérifier le passage par la page
   `/oauth/consent` de Quiz TSI.
3. Accepter, puis vérifier que ChatGPT reçoit un jeton Supabase et peut appeler
   `gpt-question-import` avec `Authorization: Bearer …`.
4. Importer une question et confirmer qu’elle apparaît uniquement comme
   brouillon privé de l’utilisateur connecté.
5. Refuser une seconde autorisation et vérifier le retour d’erreur dans
   ChatGPT. Tester aussi le rafraîchissement après expiration du jeton d’accès.

La recette OAuth réelle nécessite les configurations Supabase et OpenAI de
production ; elle n’est donc pas automatisable dans la CI du dépôt.
