function gcd(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function rational(numerator, denominator = 1) {
  if (denominator === 0) throw new Error('Division par zéro.');
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator) || 1;
  return {
    n: (sign * numerator) / divisor,
    d: Math.abs(denominator) / divisor,
  };
}

function rationalText(value) {
  return value.d === 1 ? value.n : `${value.n}/${value.d}`;
}

function powerRational(base, exponent) {
  if (exponent >= 0) return rational(base ** exponent);
  return rational(1, base ** -exponent);
}

function smallestSet(value) {
  if (value.d === 1) return value.n >= 0 ? 'N' : 'Z';
  let denominator = value.d;
  while (denominator % 2 === 0) denominator /= 2;
  while (denominator % 5 === 0) denominator /= 5;
  return denominator === 1 ? 'D' : 'Q';
}

function classified(value) {
  return { value: rationalText(value), set: smallestSet(value) };
}

function integerClassified(value) {
  return { value, set: value >= 0 ? 'N' : 'Z' };
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function simplifySquareRoot(value) {
  if (value === 0) return { coefficient: 0, radicand: 1 };
  let coefficient = 1;
  let radicand = value;
  for (let factor = 2; factor * factor <= radicand; factor += 1)
    while (radicand % (factor * factor) === 0) {
      coefficient *= factor;
      radicand /= factor * factor;
    }
  return { coefficient, radicand };
}

function radicalTerm(coefficient, radicand) {
  if (coefficient === 0) return '0';
  if (radicand === 1) return String(coefficient);
  if (coefficient === 1) return `√${radicand}`;
  if (coefficient === -1) return `-√${radicand}`;
  return `${coefficient}√${radicand}`;
}

function factorization235(a, b, c) {
  return [
    [2, a],
    [3, b],
    [5, c],
  ]
    .filter(([, exponent]) => exponent > 0)
    .map(([prime, exponent]) =>
      exponent === 1 ? String(prime) : `${prime}^${exponent}`,
    )
    .join('·');
}

function firstDivisor(value) {
  for (let divisor = 2; divisor * divisor <= value; divisor += 1)
    if (value % divisor === 0) return divisor;
  return null;
}

function evaluateF01(id, p) {
  switch (id) {
    case 'NUM-F01-F01':
      return integerClassified(p.a - p.b);
    case 'NUM-F01-F02':
      return integerClassified(p.a);
    case 'NUM-F01-F03':
      return classified(rational(p.a, 10 ** p.k));
    case 'NUM-F01-F04':
      return integerClassified(Math.abs(p.a));
    case 'NUM-F01-F05':
      return classified(powerRational(p.a, -p.n));
    case 'NUM-F01-N01':
      return classified(rational(10 ** p.k * p.a + p.b * p.c, 10 ** p.k * p.b));
    case 'NUM-F01-N02':
      return classified(rational(p.a * p.d, p.b * p.c));
    case 'NUM-F01-N03':
      return {
        valeur_exacte: radicalTerm(Math.abs(p.p) - Math.abs(p.q), p.r),
        ensemble: 'R\\Q',
      };
    case 'NUM-F01-N04':
      return classified(
        rational(
          p.a ** Math.max(0, p.m - p.n) * p.b ** Math.max(0, p.n - p.m),
          p.b ** Math.max(0, p.m - p.n) * p.a ** Math.max(0, p.n - p.m),
        ),
      );
    case 'NUM-F01-N05':
      return classified(rational(Math.abs(p.a - p.b), p.c));
    case 'NUM-F01-P01':
      return classified(rational(p.a, p.b));
    case 'NUM-F01-P02':
      return integerClassified(p.a - p.b);
    case 'NUM-F01-P03': {
      const simplified = simplifySquareRoot(p.p * p.q);
      const coefficient = rational(simplified.coefficient, p.q);
      const prefix = coefficient.n === 1 ? '' : String(coefficient.n);
      return {
        valeur_exacte: `${prefix}√${simplified.radicand}${coefficient.d === 1 ? '' : `/${coefficient.d}`}`,
        ensemble: 'R\\Q',
      };
    }
    case 'NUM-F01-P04':
      return integerClassified(p.r - p.a ** 2);
    case 'NUM-F01-P05':
      return { value: 0, set: 'N' };
    default:
      return undefined;
  }
}

function evaluateF02(id, p) {
  switch (id) {
    case 'NUM-F02-F01':
      return positiveModulo(p.N, p.d);
    case 'NUM-F02-F02':
    case 'NUM-F02-N01':
    case 'NUM-F02-P02':
      return 0;
    case 'NUM-F02-F03':
      return Math.max(0, Math.floor(p.U / p.d) - Math.ceil(p.L / p.d) + 1);
    case 'NUM-F02-F04':
      return {
        N: 2 ** p.a * 3 ** p.b * 5 ** p.c,
        decomposition: factorization235(p.a, p.b, p.c),
      };
    case 'NUM-F02-F05': {
      const divisor = firstDivisor(p.n);
      return divisor === null
        ? { est_premier: 'OUI' }
        : { est_premier: 'NON', diviseur_non_trivial: divisor };
    }
    case 'NUM-F02-N02':
      return (
        2 ** Math.min(p.a, p.d) *
        3 ** Math.min(p.b, p.e) *
        5 ** Math.min(p.c, p.f)
      );
    case 'NUM-F02-N03':
      return (
        2 ** Math.max(p.a, p.d) *
        3 ** Math.max(p.b, p.e) *
        5 ** Math.max(p.c, p.f)
      );
    case 'NUM-F02-N04':
      return (p.a + 1) * (p.b + 1) * (p.c + 1);
    case 'NUM-F02-N05':
      return p.d * p.q + p.r;
    case 'NUM-F02-P01':
      return Math.floor(p.N / p.d);
    case 'NUM-F02-P03':
      return {
        x_mod_p: positiveModulo(p.x, p.p),
        x2_mod_p: positiveModulo(p.x ** 2, p.p),
        p_divise_x: 'OUI',
      };
    case 'NUM-F02-P04':
      return (6 * p.a - 1) * (6 * p.a + 1);
    case 'NUM-F02-P05': {
      const q = Math.floor(-p.N / p.d);
      return { q, r: -p.N - p.d * q };
    }
    default:
      return undefined;
  }
}

function numeric(value) {
  return typeof value === 'number' && Number.isInteger(value)
    ? value
    : rationalText(value);
}

function evaluateF03(id, p) {
  let value;
  switch (id) {
    case 'NUM-F03-F01':
      value = powerRational(p.a, p.m + p.n);
      break;
    case 'NUM-F03-F02':
      value = powerRational(p.a, p.m - p.n);
      break;
    case 'NUM-F03-F03':
      value = powerRational(p.a, p.m * p.n);
      break;
    case 'NUM-F03-F04':
      value = rational((p.a * p.b) ** p.n);
      break;
    case 'NUM-F03-F05':
      value = rational(p.a ** p.n, p.b ** p.n);
      break;
    case 'NUM-F03-N01':
      value = powerRational(p.a, p.m + p.n - p.p);
      break;
    case 'NUM-F03-N02':
      value = powerRational(p.a, p.p * (p.m - p.n));
      break;
    case 'NUM-F03-N03':
      value = rational(p.a ** 6);
      break;
    case 'NUM-F03-N04':
      value = rational((-1) ** p.m * p.a ** (p.m + p.n));
      break;
    case 'NUM-F03-N05': {
      const power = powerRational(p.a, p.m + p.n - p.p);
      value = rational(p.c * p.d * power.n, p.e * power.d);
      break;
    }
    case 'NUM-F03-P01':
    case 'NUM-F03-P03':
      return id.endsWith('P01') ? 1 : -1;
    case 'NUM-F03-P02':
      value = powerRational(p.a, p.n - p.m);
      break;
    case 'NUM-F03-P04':
      value = rational(p.b ** (p.n * p.p), p.a ** (p.m * p.p));
      break;
    case 'NUM-F03-P05':
      value = powerRational(p.b, 2 * p.m + p.n - 3 * p.p);
      break;
    default:
      return undefined;
  }
  return numeric(value);
}

function evaluateF04(id, p) {
  let value;
  switch (id) {
    case 'NUM-F04-F01':
      value = rational(p.a * p.b * p.x ** (p.m + p.p) * p.y ** (p.n + p.q));
      break;
    case 'NUM-F04-F02':
      value = rational(
        p.a * p.x ** p.m * p.y ** p.n,
        p.b * p.x ** p.p * p.y ** p.q,
      );
      break;
    case 'NUM-F04-F03':
      value = rational(p.x ** p.m);
      break;
    case 'NUM-F04-F04':
      value = rational(p.a ** 2 * p.b * p.x ** (2 * p.m + p.n));
      break;
    case 'NUM-F04-F05':
      return radicalTerm(Math.abs(p.k), p.r);
    case 'NUM-F04-N01':
      value = rational(
        p.a * p.b * p.x ** (p.m + p.p) * p.y ** p.n,
        p.c * p.x ** p.q * p.y ** p.r,
      );
      break;
    case 'NUM-F04-N02':
      value = rational(p.a ** 2 * p.x ** (2 * p.m), p.b * p.x ** p.n);
      break;
    case 'NUM-F04-N03': {
      const root = simplifySquareRoot(p.u * p.v);
      return radicalTerm(root.coefficient, root.radicand);
    }
    case 'NUM-F04-N04':
      return Math.round(p.x ** ((p.p * p.n + p.q * p.m) / (p.m * p.n)));
    case 'NUM-F04-N05':
      value = rational(p.x ** (p.m + 1));
      break;
    case 'NUM-F04-P01':
    case 'NUM-F04-P04':
      return 1;
    case 'NUM-F04-P02':
      value = rational(p.y ** (p.n + p.q), p.x ** (p.m + p.p));
      break;
    case 'NUM-F04-P03': {
      const first = radicalTerm(p.a, p.r).replace('-', '−');
      const second = radicalTerm(Math.abs(p.b), p.s);
      return p.b < 0 ? `${first} − ${second}` : `${first} + ${second}`;
    }
    case 'NUM-F04-P05':
      return p.x + p.a;
    default:
      return undefined;
  }
  return numeric(value);
}

export function calculateNumAnswer(calculId, parameters) {
  const answer =
    evaluateF01(calculId, parameters) ??
    evaluateF02(calculId, parameters) ??
    evaluateF03(calculId, parameters) ??
    evaluateF04(calculId, parameters);
  if (answer === undefined)
    throw new Error(`Calculateur absent pour ${calculId}.`);
  return answer;
}

export function parseExpectedAnswer(source) {
  try {
    return JSON.parse(source);
  } catch {
    return source;
  }
}
