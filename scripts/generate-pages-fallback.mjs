import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loadPagesBasePath } from './pages-config.mjs';
import { createPagesFallback } from './pages-fallback-template.mjs';

const distDirectory = resolve('dist');
const indexPath = resolve(distDirectory, 'index.html');
const fallbackPath = resolve(distDirectory, '404.html');
const basePath = loadPagesBasePath();

await readFile(indexPath, 'utf8');
const fallback = createPagesFallback(basePath);

await writeFile(fallbackPath, fallback, 'utf8');
