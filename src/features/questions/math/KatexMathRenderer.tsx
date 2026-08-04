import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ResolvedMathAstNode } from '@domain/questions/QuestionInstantiation';
import { mathAstToLatex } from './MathAstToLatex';

export function KatexMathRenderer({
  ast,
  display = false,
}: {
  ast: ResolvedMathAstNode;
  display?: boolean;
}) {
  let latex: string;
  let html: string;
  try {
    latex = mathAstToLatex(ast);
    html = katex.renderToString(latex, {
      displayMode: display,
      trust: false,
      throwOnError: true,
      strict: 'error',
      macros: {},
      output: 'htmlAndMathml',
    });
  } catch {
    return <span role="status">Formule mathématique indisponible.</span>;
  }
  return (
    <span
      aria-label={latex}
      role="math"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
