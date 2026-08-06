import { WhiteboardCanvas } from '../canvas/WhiteboardCanvas';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import styles from './Whiteboard.module.css';
import { useRevisionExperience } from '@features/session/RevisionExperienceProvider';
import { QuestionCard } from '@features/questions/QuestionCard';
import { QuestionChangeDialog } from '@features/session/QuestionChangeDialog';
import { QuestionActions } from './QuestionActions';

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
      <WhiteboardCanvas />
      <WhiteboardToolbar />
      <QuestionActions
        active={experience.state.kind === 'ready'}
        onNext={(trigger) => experience.nextQuestion(trigger)}
      />
      <QuestionChangeDialog />
    </section>
  );
}
