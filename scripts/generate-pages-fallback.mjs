import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDirectory = resolve('dist');
const indexPath = resolve(distDirectory, 'index.html');
const fallbackPath = resolve(distDirectory, '404.html');
const basePath = '/quiz-tsi-next/';

await readFile(indexPath, 'utf8');

const fallback = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Redirection — Quiz TSI</title>
  </head>
  <body>
    <p>Redirection vers Quiz TSI…</p>
    <script>
      (function () {
        var base = ${JSON.stringify(basePath)};
        if (!window.location.pathname.startsWith(base)) return;
        var relative = '/' + window.location.pathname.slice(base.length);
        var route = relative + window.location.search + window.location.hash;
        var target = new URL(base, window.location.origin);
        target.searchParams.set('__qtsi_route', route);
        window.location.replace(target.href);
      })();
    </script>
  </body>
</html>
`;

await writeFile(fallbackPath, fallback, 'utf8');
