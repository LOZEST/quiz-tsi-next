const COMPARISONS = Object.freeze({
  '=': 'equal',
  '==': 'equal',
  '!=': 'not-equal',
  '<': 'less-than',
  '<=': 'less-than-or-equal',
  '>': 'greater-than',
  '>=': 'greater-than-or-equal',
});

const BINARY = Object.freeze({
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '%': 'modulo',
  '^': 'power',
  pow: 'power',
});

const FUNCTIONS = Object.freeze({
  abs: 'abs',
  gcd: 'gcd',
  lcm: 'lcm',
  sign: 'sign',
  cos: 'cos',
  binomial: 'binomial',
  is_integer: 'is-integer',
  numeric: 'numeric-value',
  min: 'min',
  max: 'max',
  isSquare: 'is-square',
  squarefree: 'squarefree',
  hasPrimeFactorOtherThan2Or5: 'has-prime-factor-other-than-2-or-5',
});

const literal = (value) => ({ kind: 'literal', value });
const variable = (variableId) => ({ kind: 'variable', variableId });
const comparison = (operator, left, right) => ({
  kind: 'comparison',
  operator: COMPARISONS[operator],
  left,
  right,
});
const binary = (operator, left, right) => ({
  kind: 'binary',
  operator: BINARY[operator],
  left,
  right,
});
const mathFunction = (name, args) => ({
  kind: 'math-function',
  function: FUNCTIONS[name],
  arguments: args,
});
const logical = (operator, operands) => {
  if (operands.length === 0) return literal(operator === 'and');
  if (operands.length === 1) return operands[0];
  return { kind: 'logical', operator, operands };
};

function fail(message, context) {
  throw new Error(`${context}: ${message}`);
}

function tokenize(source, context) {
  const normalized = source.replaceAll(' mod ', '%');
  const tokens = normalized.match(
    /\s*(>=|<=|!=|==|[<>=()+\-*/^%,]|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*)\s*/g,
  );
  if (
    !tokens ||
    tokens.join('').replaceAll(/\s/g, '') !== normalized.replaceAll(/\s/g, '')
  )
    fail(`expression non prise en charge « ${source} »`, context);
  return tokens.map((token) => token.trim());
}

export function parseSourceExpression(source, context = 'expression') {
  if (typeof source === 'number' || typeof source === 'boolean')
    return literal(source);
  if (typeof source !== 'string' || source.length === 0)
    fail('valeur vide ou invalide', context);
  const tokens = tokenize(source, context);
  let cursor = 0;
  const precedence = {
    '=': 0,
    '==': 0,
    '!=': 0,
    '<': 0,
    '<=': 0,
    '>': 0,
    '>=': 0,
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
    '%': 2,
    '^': 3,
  };

  function primary() {
    const token = tokens[cursor++];
    if (token === '-')
      return { kind: 'unary', operator: 'negate', operand: primary() };
    if (token === '(') {
      const value = expression(0);
      if (tokens[cursor++] !== ')')
        fail(`parenthèse fermante absente dans « ${source} »`, context);
      return value;
    }
    if (/^\d/.test(token ?? '')) return literal(Number(token));
    if (/^[A-Za-z_]/.test(token ?? '')) {
      if (token === 'true' || token === 'false')
        return literal(token === 'true');
      if (tokens[cursor] !== '(') return variable(token);
      cursor += 1;
      const args = [];
      if (tokens[cursor] !== ')') {
        while (true) {
          args.push(expression(0));
          if (tokens[cursor] !== ',') break;
          cursor += 1;
        }
      }
      if (tokens[cursor++] !== ')')
        fail(`appel invalide dans « ${source} »`, context);
      if (!FUNCTIONS[token]) fail(`fonction inconnue « ${token} »`, context);
      return mathFunction(token, args);
    }
    fail(`expression invalide « ${source} »`, context);
  }

  function expression(minimum) {
    let left = primary();
    while (
      Object.hasOwn(precedence, tokens[cursor] ?? '') &&
      precedence[tokens[cursor]] >= minimum
    ) {
      const token = tokens[cursor++];
      const priority = precedence[token];
      const right = expression(priority + (token === '^' ? 0 : 1));
      left = COMPARISONS[token]
        ? comparison(token, left, right)
        : binary(token, left, right);
    }
    return left;
  }

  const result = expression(0);
  if (cursor !== tokens.length)
    fail(`expression partiellement lue « ${source} »`, context);
  return result;
}

function pairwiseDistinct(items, context) {
  const expressions = items.map((item) => parseSourceExpression(item, context));
  const comparisons = [];
  for (let left = 0; left < expressions.length; left += 1)
    for (let right = left + 1; right < expressions.length; right += 1)
      comparisons.push(comparison('!=', expressions[left], expressions[right]));
  return logical('and', comparisons);
}

function gcdAll(items, context) {
  const expressions = items.map((item) => parseSourceExpression(item, context));
  let result = expressions[0];
  for (let index = 1; index < expressions.length; index += 1)
    result = mathFunction('gcd', [result, expressions[index]]);
  return result;
}

function relationV11(relation, context) {
  if (!relation || typeof relation !== 'object' || Array.isArray(relation))
    fail('relation v1.1 invalide', context);
  if (relation.op === 'and' || relation.op === 'or')
    return logical(
      relation.op,
      (relation.args ?? []).map((entry, index) =>
        relationV11(entry, `${context}.args.${index}`),
      ),
    );
  if (relation.op === 'if')
    return logical('or', [
      {
        kind: 'logical-not',
        operand: relationV11(relation.condition, `${context}.condition`),
      },
      relationV11(relation.then, `${context}.then`),
    ]);
  if (relation.op === 'expression_not_zero')
    return comparison(
      '!=',
      parseSourceExpression(relation.expression, context),
      literal(0),
    );
  if (relation.op === 'parity')
    return comparison(
      '=',
      binary('%', parseSourceExpression(relation.left, context), literal(2)),
      literal(relation.right === 'odd' ? 1 : 0),
    );
  if (relation.op === 'coprime')
    return comparison(
      '=',
      mathFunction('gcd', [
        parseSourceExpression(relation.left, context),
        parseSourceExpression(relation.right, context),
      ]),
      literal(1),
    );
  if (relation.op === 'coprime_all')
    return comparison('=', gcdAll(relation.items, context), literal(1));
  if (relation.op === 'distinct' || relation.op === 'all_distinct')
    return pairwiseDistinct(relation.items, context);
  if (relation.op === 'not_all_zero')
    return logical(
      'or',
      relation.expressions.map((entry) =>
        comparison('!=', parseSourceExpression(entry, context), literal(0)),
      ),
    );
  if (relation.op === 'not_all_equal')
    return logical(
      'or',
      relation.pairs.map(([left, right]) =>
        comparison(
          '!=',
          parseSourceExpression(left, context),
          parseSourceExpression(right, context),
        ),
      ),
    );
  if (relation.op === 'cross_not_equal')
    return comparison(
      '!=',
      binary('*', variable(relation.left_num), variable(relation.right_den)),
      binary('*', variable(relation.right_num), variable(relation.left_den)),
    );
  if (relation.op === 'scaled_not_equal')
    return comparison(
      '!=',
      binary('*', literal(relation.left_multiplier), variable(relation.left)),
      binary('*', literal(relation.right_multiplier), variable(relation.right)),
    );
  if (
    relation.op === 'discriminant_equal' ||
    relation.op === 'discriminant_less_than'
  ) {
    const discriminant = binary(
      '-',
      binary('^', variable(relation.b), literal(2)),
      binary(
        '*',
        literal(4),
        binary('*', variable(relation.a), variable(relation.c)),
      ),
    );
    return comparison(
      relation.op === 'discriminant_equal' ? '=' : '<',
      discriminant,
      literal(relation.value),
    );
  }
  if (COMPARISONS[relation.op])
    return comparison(
      relation.op,
      parseSourceExpression(relation.left, context),
      parseSourceExpression(relation.right ?? relation.right_value, context),
    );
  fail(`opérateur relationnel inconnu « ${relation.op} »`, context);
}

function expressionV2(value, context) {
  if (typeof value === 'number' || typeof value === 'boolean')
    return literal(value);
  if (typeof value === 'string')
    return mathFunction('numeric', [literal(value)]);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('expression objet invalide', context);
  const keys = Object.keys(value);
  if (keys.length !== 1)
    fail(`forme objet inconnue ${keys.join(',')}`, context);
  const key = keys[0];
  const payload = value[key];
  if (key === 'var') return mathFunction('numeric', [variable(payload)]);
  if (key === 'and')
    return logical(
      'and',
      payload.map((entry, index) =>
        expressionV2(entry, `${context}.and.${index}`),
      ),
    );
  if (COMPARISONS[key] || BINARY[key]) {
    if (!Array.isArray(payload) || payload.length !== 2)
      fail(`arité invalide pour ${key}`, context);
    const left = expressionV2(payload[0], `${context}.${key}.0`);
    const right = expressionV2(payload[1], `${context}.${key}.1`);
    return COMPARISONS[key]
      ? comparison(key, left, right)
      : binary(key, left, right);
  }
  if (FUNCTIONS[key]) {
    const args = Array.isArray(payload) ? payload : [payload];
    return mathFunction(
      key,
      args.map((entry, index) =>
        expressionV2(entry, `${context}.${key}.${index}`),
      ),
    );
  }
  fail(`opérateur objet inconnu « ${key} »`, context);
}

export function parseRelations(specification, calculId) {
  const context = `${calculId}.relations`;
  if (specification.schema_version === '1.1') {
    if (!Array.isArray(specification.relations))
      fail('liste de relations attendue', context);
    return specification.relations.map((entry, index) =>
      relationV11(entry, `${context}.${index}`),
    );
  }
  if (specification.schema_version == null) return [];
  const relations = specification.relations;
  if (!relations || typeof relations !== 'object' || Array.isArray(relations))
    fail('objet de relations attendu', context);
  if (relations.mode === 'all_combinations') return [];
  if (relations.mode === 'allowed_tuples') {
    const tuples = relations.tuples.map((tuple) =>
      logical(
        'and',
        relations.variables.map((id, index) =>
          comparison('=', variable(id), literal(tuple[index])),
        ),
      ),
    );
    return [logical('or', tuples)];
  }
  if (!Array.isArray(relations.and))
    fail('clé relations.and attendue', context);
  return relations.and.map((entry, index) =>
    expressionV2(entry, `${context}.and.${index}`),
  );
}

export const supportedRelationOperators = Object.freeze([
  '!=',
  '=',
  '==',
  '<',
  '<=',
  '>',
  '>=',
  'and',
  'or',
  'parity',
  'coprime',
  'coprime_all',
  'distinct',
  'all_distinct',
  'not_all_zero',
  'not_all_equal',
  'cross_not_equal',
  'scaled_not_equal',
  'discriminant_equal',
  'discriminant_less_than',
  'expression_not_zero',
  'if',
  '+',
  '-',
  '*',
  '/',
  'pow',
  'abs',
  'cos',
  'gcd',
  'binomial',
  'is_integer',
  'min',
  'max',
  'allowed_tuples',
  'all_combinations',
]);
