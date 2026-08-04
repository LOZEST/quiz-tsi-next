import type { InstantiatedContentSegment } from '@domain/questions/QuestionInstantiation';
import { KatexMathRenderer } from './math/KatexMathRenderer';

export function QuestionContentRenderer({
  segments,
}: {
  segments: readonly InstantiatedContentSegment[];
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
            return <KatexMathRenderer key={index} ast={segment.ast} />;
          case 'display-math':
            return (
              <div key={index}>
                <KatexMathRenderer ast={segment.ast} display />
              </div>
            );
        }
      })}
    </>
  );
}
