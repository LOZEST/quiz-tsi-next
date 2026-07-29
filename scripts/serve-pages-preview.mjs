import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const distDirectory = resolve('dist');
const basePath = '/quiz-tsi-next/';
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

function safeFilePath(pathname) {
  const relative = pathname.slice(basePath.length);
  const candidate = normalize(join(distDirectory, relative || 'index.html'));
  return candidate.startsWith(distDirectory) ? candidate : null;
}

createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${host}:${port}`);
  if (!url.pathname.startsWith(basePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const requestedPath = safeFilePath(url.pathname);
  const filePath =
    requestedPath &&
    existsSync(requestedPath) &&
    statSync(requestedPath).isFile()
      ? requestedPath
      : join(distDirectory, '404.html');
  const status = filePath.endsWith('404.html') ? 404 : 200;

  response.writeHead(status, {
    'content-type':
      contentTypes.get(extname(filePath)) || 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  process.stdout.write(
    `Quiz TSI Pages preview: http://${host}:${port}${basePath}\n`,
  );
});
