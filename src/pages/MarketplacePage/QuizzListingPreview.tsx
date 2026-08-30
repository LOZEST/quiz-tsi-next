import { parseMathSource } from '@domain/math/MathParser';
import type { ContentSegment } from '@domain/questions/Question';
import type { QuizzListingPreview as QuizzListingPreviewData } from '@domain/quizz/QuizzMarketplaceGateway';
import { KatexMathRenderer } from '@features/questions/math/KatexMathRenderer';
import styles from './MarketplacePage.module.css';

function PreviewSegment({ segment }: { segment: ContentSegment }) {
  switch (segment.kind) {
    case 'text':
      return <span>{segment.value}</span>;
    case 'line-break':
      return <br />;
    case 'inline-math':
    case 'display-math': {
      const parsed = parseMathSource(segment.math);
      if (!parsed.ok)
        return <span role="status">Formule mathématique indisponible.</span>;
      // KatexMathRenderer only renders resolved parameters (real
      // instantiated values); this read-only preview shows the quizz's
      // template before any variant is generated, so an unresolved `@a`
      // reference falls back to the readable grammar source rather than
      // crashing mathAstToLatex's "Paramètre non résolu." guard — same
      // handling as RawContentPreview's bank preview.
      if (parsed.parameterReferences.length > 0)
        return <span>{segment.math.source}</span>;
      return (
        <KatexMathRenderer
          ast={parsed.ast}
          display={segment.kind === 'display-math'}
        />
      );
    }
  }
}

function PreviewSegments({
  segments,
}: {
  segments: readonly ContentSegment[];
}) {
  return (
    <>
      {segments.map((segment, index) => (
        <PreviewSegment key={index} segment={segment} />
      ))}
    </>
  );
}

export function QuizzListingPreview({
  preview,
}: {
  preview: QuizzListingPreviewData;
}) {
  return (
    <div className={styles.preview}>
      <p role="note">Aperçu en lecture seule — énoncé et correction.</p>
      <ol className={styles.previewList}>
        {preview.questions.map((question) => (
          <li key={question.id}>
            <div>
              <PreviewSegments segments={question.prompt ?? []} />
            </div>
            <details>
              <summary>Correction</summary>
              {(question.correction ?? []).map((step) => (
                <div key={step.id}>
                  <PreviewSegments segments={step.content ?? []} />
                </div>
              ))}
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
