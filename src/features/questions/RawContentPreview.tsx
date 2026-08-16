import type { ContentSegment } from '@domain/questions/Question';
import { parseMathSource } from '@domain/math/MathParser';
import { KatexMathRenderer } from './math/KatexMathRenderer';

export function RawContentPreview({
  segments,
}: {
  segments: readonly ContentSegment[];
}) {
  return (
    <>
      {segments.map((segment, index) => {
        switch (segment.kind) {
          case 'text':
            return <span key={index}>{segment.value}</span>;
          case 'line-break':
            return <br key={index} />;
          case 'inline-math':
          case 'display-math': {
            const parsed = parseMathSource(segment.math);
            // KatexMathRenderer only renders resolved parameters (real
            // instantiated values); a bank preview shows the template
            // before any variant is generated, so an unresolved `@a`
            // reference falls back to the readable grammar source rather
            // than crashing mathAstToLatex's "Paramètre non résolu." guard.
            if (!parsed.ok || parsed.parameterReferences.length > 0)
              return <span key={index}>{segment.math.source}</span>;
            return segment.kind === 'display-math' ? (
              <div key={index}>
                <KatexMathRenderer ast={parsed.ast} display />
              </div>
            ) : (
              <KatexMathRenderer key={index} ast={parsed.ast} />
            );
          }
        }
      })}
    </>
  );
}
