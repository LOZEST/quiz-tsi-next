import type { ParameterPrimitive, VariableDefinition } from './Question';

export const MAX_PARAMETER_VARIABLES = 32;
export const MAX_MATERIALIZED_DOMAIN_SIZE = 10_000;
export const MAX_DECIMAL_PLACES = 8;

export type VariableDomainResult =
  | Readonly<{ ok: true; values: readonly ParameterPrimitive[] }>
  | Readonly<{
      ok: false;
      code: 'invalid-domain' | 'empty-domain' | 'domain-limit-exceeded';
      message: string;
    }>;

const failure = (
  code: 'invalid-domain' | 'empty-domain' | 'domain-limit-exceeded',
  message: string,
): VariableDomainResult => ({ ok: false, code, message });

export function buildCanonicalVariableDomain(
  value: unknown,
): VariableDomainResult {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return failure('invalid-domain', 'Définition de variable invalide.');
    const variable = value as Partial<VariableDefinition>;
    const domain = variable.domain;
    if (typeof domain !== 'object' || domain === null)
      return failure('invalid-domain', 'Domaine de variable invalide.');
    if (domain.kind === 'choice') {
      if (!Array.isArray(domain.values))
        return failure('invalid-domain', 'Liste de choix invalide.');
      const values: ParameterPrimitive[] = [];
      for (const entry of domain.values) {
        if (
          !(
            typeof entry === 'string' ||
            typeof entry === 'boolean' ||
            (typeof entry === 'number' && Number.isFinite(entry))
          )
        )
          return failure('invalid-domain', 'Valeur de choix invalide.');
        if (
          !values.some(
            (known) => Object.is(known, entry) || (known === 0 && entry === 0),
          )
        )
          values.push(entry);
      }
      if (values.length === 0)
        return failure('empty-domain', 'Le domaine dérivé est vide.');
      if (values.length > MAX_MATERIALIZED_DOMAIN_SIZE)
        return failure(
          'domain-limit-exceeded',
          'Le domaine dépasse la limite technique.',
        );
      return { ok: true, values: Object.freeze(values) };
    }
    if (domain.kind === 'integer') {
      if (
        !Number.isSafeInteger(domain.minimum) ||
        !Number.isSafeInteger(domain.maximum) ||
        !Number.isSafeInteger(domain.step) ||
        domain.step <= 0 ||
        domain.minimum > domain.maximum ||
        !Array.isArray(domain.excludedValues) ||
        !domain.excludedValues.every(Number.isSafeInteger)
      )
        return failure('invalid-domain', 'Domaine entier invalide.');
      const size =
        Math.floor((domain.maximum - domain.minimum) / domain.step) + 1;
      if (!Number.isSafeInteger(size) || size > MAX_MATERIALIZED_DOMAIN_SIZE)
        return failure(
          'domain-limit-exceeded',
          'Le domaine dépasse la limite technique.',
        );
      const excluded = new Set(domain.excludedValues);
      const values = Array.from(
        { length: size },
        (_, index) => domain.minimum + index * domain.step,
      ).filter((entry) => !excluded.has(entry));
      return values.length === 0
        ? failure('empty-domain', 'Le domaine dérivé est vide.')
        : { ok: true, values: Object.freeze(values) };
    }
    if (domain.kind === 'decimal') {
      if (
        !Number.isFinite(domain.minimum) ||
        !Number.isFinite(domain.maximum) ||
        domain.minimum > domain.maximum ||
        !Number.isInteger(domain.decimals) ||
        domain.decimals < 0 ||
        domain.decimals > MAX_DECIMAL_PLACES ||
        !Array.isArray(domain.excludedValues) ||
        !domain.excludedValues.every(Number.isFinite)
      )
        return failure('invalid-domain', 'Domaine décimal invalide.');
      const scale = 10 ** domain.decimals;
      const minimum = Math.ceil(domain.minimum * scale);
      const maximum = Math.floor(domain.maximum * scale);
      const size = maximum - minimum + 1;
      if (!Number.isSafeInteger(size) || size > MAX_MATERIALIZED_DOMAIN_SIZE)
        return failure(
          'domain-limit-exceeded',
          'La grille décimale dépasse la limite technique.',
        );
      const excluded = new Set(
        domain.excludedValues.map((entry) => Math.round(entry * scale)),
      );
      const values = Array.from({ length: Math.max(0, size) }, (_, index) => {
        const result = (minimum + index) / scale;
        return Object.is(result, -0) ? 0 : result;
      }).filter((entry) => !excluded.has(Math.round(entry * scale)));
      return values.length === 0
        ? failure('empty-domain', 'Le domaine dérivé est vide.')
        : { ok: true, values: Object.freeze(values) };
    }
    return failure('invalid-domain', 'Type de domaine inconnu.');
  } catch {
    return failure('invalid-domain', 'Domaine de variable inaccessible.');
  }
}
