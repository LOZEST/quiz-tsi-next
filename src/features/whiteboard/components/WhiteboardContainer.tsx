import { WhiteboardCanvas } from '../canvas/WhiteboardCanvas';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import styles from './Whiteboard.module.css';
import { useRevisionExperience } from '@features/session/RevisionExperienceProvider';
import { QuestionCard } from '@features/questions/QuestionCard';
import { QuestionChangeDialog } from '@features/session/QuestionChangeDialog';
import { QuestionActions } from './QuestionActions';
import { QuestionHelpPanels } from '@features/session/QuestionHelpPanels';

export function WhiteboardContainer() {
  const experience = useRevisionExperience();
  return (
    <section className={styles.container} aria-labelledby="whiteboard-title">
      <h1 id="whiteboard-title" className={styles.visuallyHidden}>
        Tableau blanc
      </h1>
      {experience.state.kind === 'ready' ? (
        <QuestionCard
          prepared={experience.state.prepared}
          question={experience.state.question}
          reflexDeadline={experience.state.reflexDeadline}
          onReflexExceeded={experience.markReflexExceeded}
        />
      ) : (
        <div className={styles.futureQuestion} role="status" aria-live="polite">
          <p>
            {experience.state.kind === 'no-bank' ||
            experience.state.kind === 'no-program' ||
            experience.state.kind === 'no-match' ||
            experience.state.kind === 'error'
              ? experience.state.message
              : experience.state.kind === 'loading'
                ? 'Chargement…'
                : 'Ouvre le menu pour choisir un parcours.'}
          </p>
        </div>
      )}
      {experience.notice ? (
        <p className={styles.attemptNotice} role="status" aria-live="polite">
          {experience.notice}
        </p>
      ) : null}
      <WhiteboardCanvas
        sceneId={
          experience.mode === 'chapter-test' &&
          experience.state.kind === 'ready'
            ? `test:${experience.state.instance.sessionId}:${experience.state.instance.id}`
            : 'main'
        }
        questionInstanceId={
          experience.state.kind === 'ready'
            ? experience.state.instance.id
            : 'whiteboard'
        }
      />
      <WhiteboardToolbar />
      {experience.state.kind === 'ready' ? (
        <QuestionHelpPanels
          content={experience.state.prepared.content}
          hintOpen={experience.hintOpen}
          correctionOpen={experience.correctionOpen}
          onCloseHint={experience.closeHint}
          onCloseCorrection={experience.closeCorrection}
        />
      ) : null}
      <QuestionActions
        active={experience.state.kind === 'ready'}
        hasHint={
          experience.state.kind === 'ready' &&
          experience.state.prepared.content.hint.length > 0
        }
        hasCorrection={
          experience.state.kind === 'ready' &&
          experience.state.prepared.content.correction.length > 0
        }
        hintOpen={experience.hintOpen}
        correctionOpen={experience.correctionOpen}
        completed={
          experience.state.kind === 'ready' &&
          experience.state.attempt.evaluation !== null
        }
        onHint={experience.openHint}
        onCorrection={experience.openCorrection}
        onEvaluate={(action) => void experience.evaluate(action)}
        onNext={experience.nextQuestion}
      />
      <QuestionChangeDialog />
    </section>
  );
}
