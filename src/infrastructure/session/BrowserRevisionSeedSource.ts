import type { RevisionSeedSource } from '@domain/repositories/RevisionStateRepositories';

export class BrowserRevisionSeedSource implements RevisionSeedSource {
  nextSeed(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const values = new Uint32Array(4);
    crypto.getRandomValues(values);
    return [...values]
      .map((value) => value.toString(16).padStart(8, '0'))
      .join('');
  }
}
