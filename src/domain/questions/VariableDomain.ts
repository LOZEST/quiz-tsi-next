import type { ParameterPrimitive, VariableDefinition } from './Question';

export const MAX_PARAMETER_VARIABLES = 32;
export const MAX_MATERIALIZED_DOMAIN_SIZE = 10_000;
export const MAX_DECIMAL_PLACES = 8;
export const MAX_SAFE_SCALED_INTEGER = Number.MAX_SAFE_INTEGER;

type DecimalRational = Readonly<{ numerator: bigint; denominator: bigint }>;

function decimalRational(value: number): DecimalRational | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(
    value.toString(),
  );
  if (!match) return null;
  const sign = match[1] === '-' ? -1n : 1n;
  const integer = match[2] as string;
  const fraction = match[3] ?? '';
  const exponent = Number(match[4] ?? '0');
  if (!Number.isSafeInteger(exponent)) return null;
  const digits = BigInt(`${integer}${fraction}`);
  const decimalExponent = exponent - fraction.length;
  return decimalExponent >= 0
    ? {
        numerator: sign * digits * 10n ** BigInt(decimalExponent),
        denominator: 1n,
      }
    : {
        numerator: sign * digits,
        denominator: 10n ** BigInt(-decimalExponent),
      };
}

function floorDivision(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder < 0n ? quotient - 1n : quotient;
}

function quantizeScaled(
  value: number,
  decimals: number,
  mode: 'ceil' | 'floor' | 'nearest',
): bigint | null {
  const rational = decimalRational(value);
  if (!rational) return null;
  const numerator = rational.numerator * 10n ** BigInt(decimals);
  const floor = floorDivision(numerator, rational.denominator);
  const remainder = numerator - floor * rational.denominator;
  const result =
    mode === 'floor'
      ? floor
      : mode === 'ceil'
        ? remainder === 0n
          ? floor
          : floor + 1n
        : remainder * 2n >= rational.denominator
          ? floor + 1n
          : floor;
  const safeLimit = BigInt(MAX_SAFE_SCALED_INTEGER);
  return result < -safeLimit || result > safeLimit ? null : result;
}

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
      const minimum = quantizeScaled(domain.minimum, domain.decimals, 'ceil');
      const maximum = quantizeScaled(domain.maximum, domain.decimals, 'floor');
      if (minimum === null || maximum === null)
        return failure(
          'domain-limit-exceeded',
          'Une valeur décimale mise à l’échelle dépasse la limite des entiers sûrs.',
        );
      const size = maximum - minimum + 1n;
      if (
        size > BigInt(MAX_MATERIALIZED_DOMAIN_SIZE) ||
        size > BigInt(Number.MAX_SAFE_INTEGER)
      )
        return failure(
          'domain-limit-exceeded',
          'La grille décimale dépasse la limite technique.',
        );
      const excluded = new Set<bigint>();
      const decimalExclusions = domain.excludedValues as readonly number[];
      for (const entry of decimalExclusions) {
        const quantized = quantizeScaled(entry, domain.decimals, 'nearest');
        if (quantized === null)
          return failure(
            'domain-limit-exceeded',
            'Une exclusion décimale mise à l’échelle dépasse la limite des entiers sûrs.',
          );
        excluded.add(quantized);
      }
      const length = size > 0n ? Number(size) : 0;
      const values = Array.from({ length }, (_, index) => {
        const scaled = minimum + BigInt(index);
        const result = Number(scaled) / scale;
        return Object.is(result, -0) ? 0 : result;
      }).filter((_, index) => !excluded.has(minimum + BigInt(index)));
      return values.length === 0
        ? failure('empty-domain', 'Le domaine dérivé est vide.')
        : { ok: true, values: Object.freeze(values) };
    }
    return failure('invalid-domain', 'Type de domaine inconnu.');
  } catch {
    return failure('invalid-domain', 'Domaine de variable inaccessible.');
  }
}
