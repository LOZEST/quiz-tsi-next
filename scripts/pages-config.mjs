import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_PATH_KEY = 'VITE_BASE_PATH';
const LOCAL_BASE_PATH = '/';

export function normalizeBasePath(value = LOCAL_BASE_PATH) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${BASE_PATH_KEY} must be a non-empty string`);
  }
  if (value !== value.trim()) {
    throw new TypeError(
      `${BASE_PATH_KEY} must not contain surrounding whitespace`,
    );
  }
  if (!value.startsWith('/') || !value.endsWith('/')) {
    throw new TypeError(`${BASE_PATH_KEY} must start and end with "/"`);
  }
  if (
    value.startsWith('//') ||
    value.includes('://') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('\\')
  ) {
    throw new TypeError(
      `${BASE_PATH_KEY} must be a same-origin path without query or hash`,
    );
  }

  let decodedValue;
  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    throw new TypeError(`${BASE_PATH_KEY} must use valid URL encoding`);
  }
  if (decodedValue.split('/').includes('..')) {
    throw new TypeError(
      `${BASE_PATH_KEY} must not contain parent-directory segments`,
    );
  }

  const baseUrl = new URL(value, 'https://quiz-tsi.invalid');
  if (
    baseUrl.origin !== 'https://quiz-tsi.invalid' ||
    baseUrl.pathname !== value ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new TypeError(
      `${BASE_PATH_KEY} must resolve to an unchanged same-origin path`,
    );
  }

  return value;
}

function readBasePathFromEnvFile(filePath) {
  let contents;
  try {
    contents = readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }

  const matches = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.match(/^VITE_BASE_PATH=(.*)$/))
    .filter(Boolean);

  if (matches.length > 1) {
    throw new TypeError(
      `${BASE_PATH_KEY} must be declared at most once in ${filePath}`,
    );
  }

  return matches[0]?.[1];
}

export function loadPagesBasePath({
  env = process.env,
  cwd = process.cwd(),
  envFile = '.env.pages',
} = {}) {
  const configuredValue =
    env[BASE_PATH_KEY] ??
    readBasePathFromEnvFile(resolve(cwd, envFile)) ??
    LOCAL_BASE_PATH;

  return normalizeBasePath(configuredValue);
}
