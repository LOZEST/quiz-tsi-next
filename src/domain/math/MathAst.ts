export type MathComparisonOperator =
  | 'equal'
  | 'not-equal'
  | 'less-than'
  | 'less-than-or-equal'
  | 'greater-than'
  | 'greater-than-or-equal';

export type MathRelationOperator =
  | 'belongs-to'
  | 'does-not-belong-to'
  | 'strict-subset'
  | 'subset'
  | 'union'
  | 'intersection'
  | 'implies'
  | 'equivalent';

export type MathAstNode =
  | Readonly<{ kind: 'number'; value: string }>
  | Readonly<{ kind: 'identifier'; name: string }>
  | Readonly<{
      kind: 'constant';
      name:
        | 'pi'
        | 'infinity'
        | 'empty-set'
        | 'natural'
        | 'integer'
        | 'rational'
        | 'real'
        | 'complex';
    }>
  | Readonly<{ kind: 'parameter'; name: string }>
  | Readonly<{ kind: 'symbol'; symbol: string }>
  | Readonly<{
      kind: 'unary';
      operator: 'positive' | 'negative';
      operand: MathAstNode;
    }>
  | Readonly<{
      kind: 'binary';
      operator: 'add' | 'subtract' | 'multiply' | 'divide';
      left: MathAstNode;
      right: MathAstNode;
    }>
  | Readonly<{ kind: 'power'; base: MathAstNode; exponent: MathAstNode }>
  | Readonly<{ kind: 'subscript'; base: MathAstNode; subscript: MathAstNode }>
  | Readonly<{
      kind: 'function';
      name: MathFunctionName;
      argument: MathAstNode;
    }>
  | Readonly<{
      kind: 'comparison';
      operator: MathComparisonOperator;
      left: MathAstNode;
      right: MathAstNode;
    }>
  | Readonly<{
      kind: 'relation';
      operator: MathRelationOperator;
      left: MathAstNode;
      right: MathAstNode;
    }>
  | Readonly<{
      kind: 'interval';
      leftClosed: boolean;
      rightClosed: boolean;
      lower: MathAstNode;
      upper: MathAstNode;
    }>
  | Readonly<{
      kind: 'bounded-operator';
      operator: 'sum' | 'product' | 'integral';
      lower: MathAstNode | null;
      upper: MathAstNode | null;
    }>;

export type MathFunctionName =
  | 'sqrt'
  | 'abs'
  | 'vec'
  | 'sin'
  | 'cos'
  | 'tan'
  | 'ln'
  | 'exp';
