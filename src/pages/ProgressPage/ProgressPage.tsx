import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';
import {
  projectMasteryEvents,
  type MasteryEvent,
} from '@domain/mastery/MasteryEvent';
import {
  createProgressSnapshot,
  type ProgressSnapshot,
} from '@domain/progress/ProgressSnapshot';
import type { Quizz } from '@domain/questions/quizz/Quizz';
import styles from './ProgressPage.module.css';
import type { MasteryStatus } from '@domain/mastery/MasteryPolicy';

const resultLabels = {
  success: 'Réussi',
  partial: 'Partiel',
  failed: 'Raté',
  skipped: 'Passé',
} as const;
const modeLabels = {
  free: 'Révision libre',
  daily: 'Révision du jour',
  'weak-points': 'Points faibles',
  'chapter-test': 'Test de chapitres',
} as const;
const masteryStatusLabels: Record<MasteryStatus, string> = {
  new: 'Nouveau',
  'needs-review': 'À revoir',
  overdue: 'Révision en retard',
  discovery: 'En découverte',
  fragile: 'Fragile',
  solid: 'Solide',
  progressing: 'En progression',
};
const resultTones = {
  success: 'success',
  partial: 'warning',
  failed: 'danger',
  skipped: 'muted',
} as const;
const masteryStatusTones: Record<
  MasteryStatus,
  'success' | 'warning' | 'danger' | 'muted' | 'accent'
> = {
  new: 'muted',
  discovery: 'muted',
  'needs-review': 'warning',
  overdue: 'danger',
  fragile: 'danger',
  progressing: 'accent',
  solid: 'success',
};

export function ProgressPage() {
  const { state } = useAuth();
  const {
    evaluationRepository,
    chapterTestRepository,
    programIndex,
    clock,
    questionWorkspaceRepository,
  } = useAppServices();
  const [data, setData] = useState<{
    events: readonly MasteryEvent[];
    partial: boolean;
  } | null>(null);
  const [quizzes, setQuizzes] = useState<readonly Quizz[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    const userId = state.session.user.id;
    void evaluationRepository
      .listByUser(userId)
      .then(async (evaluations) => {
        const tests = chapterTestRepository.listByUser
          ? await chapterTestRepository.listByUser(userId, 200)
          : await Promise.all(
              [...new Set(evaluations.map((item) => item.sessionId))].map(
                (id) => chapterTestRepository.get(id, userId),
              ),
            );
        const ids = new Set(
          tests.flatMap((test) => (test ? [test.blueprint.sessionId] : [])),
        );
        const projected = projectMasteryEvents(evaluations, ids);
        if (!cancelled)
          setData({ events: projected.events, partial: projected.partial });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chapterTestRepository, evaluationRepository, state]);
  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    void questionWorkspaceRepository
      .load(state.session.user.id)
      .then((snapshot) => {
        if (!cancelled) setQuizzes(snapshot.quizzes);
      })
      .catch(() => {
        if (!cancelled) setQuizzes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [questionWorkspaceRepository, state]);

  const userId = state.status === 'authenticated' ? state.session.user.id : '';
  const snapshot = useMemo(
    () =>
      data
        ? createProgressSnapshot({
            events: data.events,
            userId,
            now: clock.now(),
            programIndex,
            quizzes,
            partial: data.partial,
          })
        : null,
    [clock, data, programIndex, quizzes, userId],
  );
  return (
    <main className={styles.page}>
      <PageHeader
        title="Mon parcours"
        description="Une synthèse locale de ton apprentissage."
      />
      {error ? (
        <p role="alert">
          La progression locale est indisponible. Réessaie plus tard.
        </p>
      ) : null}
      {!snapshot && !error ? (
        <p role="status">Chargement de la progression…</p>
      ) : null}
      {snapshot ? (
        <ProgressContent snapshot={snapshot} programIndex={programIndex} />
      ) : null}
    </main>
  );
}

export function ProgressContent({
  snapshot,
  programIndex,
}: {
  snapshot: ProgressSnapshot;
  programIndex: ReturnType<typeof useAppServices>['programIndex'];
}) {
  const [openPart, setOpenPart] = useState<string | null>(null);
  const [openNotion, setOpenNotion] = useState<string | null>(null);
  const label = (id: string) =>
    programIndex?.getNotion(id)?.label ??
    snapshot.quizzes.find((quizz) => quizz.quizzId === id)?.title ??
    'Notion non disponible';
  return (
    <>
      {snapshot.partial ? (
        <p className={styles.notice} role="status">
          Certaines anciennes séances ne peuvent pas être identifiées. La
          progression affichée est partielle.
        </p>
      ) : null}
      <section className={styles.hero} aria-labelledby="summary-title">
        <h2 id="summary-title" className={styles.visuallyHidden}>
          Synthèse
        </h2>
        <div className={styles.summary}>
          <div className={styles.primary} data-testid="primary-indicator">
            <div
              className={styles.ring}
              style={
                {
                  '--progress': snapshot.globalMastery ?? 0,
                } as React.CSSProperties
              }
            >
              <strong>
                {snapshot.globalMastery === null
                  ? 'Calibration en cours'
                  : `${snapshot.globalMastery} %`}
              </strong>
            </div>
            <span>Maîtrise globale</span>
            {snapshot.globalMasteryDelta !== null ? (
              <span
                className={styles.trend}
                data-direction={
                  snapshot.globalMasteryDelta > 0
                    ? 'up'
                    : snapshot.globalMasteryDelta < 0
                      ? 'down'
                      : 'flat'
                }
              >
                {snapshot.globalMasteryDelta > 0
                  ? `▲ +${snapshot.globalMasteryDelta} pts`
                  : snapshot.globalMasteryDelta < 0
                    ? `▼ ${snapshot.globalMasteryDelta} pts`
                    : '= stable'}{' '}
                cette semaine
              </span>
            ) : null}
          </div>
          <dl className={styles.secondary} data-testid="secondary-indicators">
            <div>
              <dt>Confiance globale</dt>
              <dd>
                {snapshot.globalConfidence === null
                  ? 'En calibration'
                  : `${snapshot.globalConfidence} %`}
              </dd>
            </div>
            <div>
              <dt>Révisions dues</dt>
              <dd>{snapshot.dueCount}</dd>
            </div>
            <div>
              <dt>Activité sur 7 jours</dt>
              <dd>{snapshot.lastSevenDaysActivity}</dd>
            </div>
            <div>
              <dt>Série en cours</dt>
              <dd>
                {snapshot.streakDays} jour{snapshot.streakDays > 1 ? 's' : ''}
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <section className={styles.today}>
        <h2>Travail du jour</h2>
        <DailySummary state={snapshot.dailyPlan} label={label} />
      </section>
      <section>
        <h2>Progression par grandes parties</h2>
        <div className={styles.parts}>
          {snapshot.parts.map((part) => (
            <div key={part.id}>
              <button
                type="button"
                aria-expanded={openPart === part.id}
                onClick={() => {
                  setOpenPart(openPart === part.id ? null : part.id);
                  setOpenNotion(null);
                }}
              >
                <span>{part.label}</span>
                <strong>
                  {part.masteryScore === null
                    ? 'Pas encore de données'
                    : `${part.masteryScore} %`}
                </strong>
                <span className={styles.partTrack} aria-hidden="true">
                  <span style={{ inlineSize: `${part.masteryScore ?? 0}%` }} />
                </span>
              </button>
              {openPart === part.id ? (
                <div className={styles.notionList}>
                  {part.notions.length ? (
                    part.notions.map((notion) => (
                      <div key={notion.notionId}>
                        <button
                          type="button"
                          aria-expanded={openNotion === notion.notionId}
                          onClick={() =>
                            setOpenNotion(
                              openNotion === notion.notionId
                                ? null
                                : notion.notionId,
                            )
                          }
                        >
                          {notion.chapterLabel} — {notion.label}
                        </button>
                        {openNotion === notion.notionId ? (
                          <dl
                            className={styles.details}
                            data-testid="notion-details"
                          >
                            <div>
                              <dt>Maîtrise</dt>
                              <dd>{notion.masteryScore} %</dd>
                            </div>
                            <div>
                              <dt>Confiance</dt>
                              <dd>{notion.confidenceScore} %</dd>
                            </div>
                            <div>
                              <dt>Statut</dt>
                              <dd>
                                <span
                                  className={styles.pill}
                                  data-tone={masteryStatusTones[notion.status]}
                                >
                                  {masteryStatusLabels[notion.status]}
                                </span>
                              </dd>
                            </div>
                            <div>
                              <dt>Dernière activité</dt>
                              <dd>{formatDate(notion.lastReviewedAt)}</dd>
                            </div>
                            <div>
                              <dt>Prochaine révision</dt>
                              <dd>{formatDate(notion.nextReviewAt)}</dd>
                            </div>
                            <div>
                              <dt>Historique</dt>
                              <dd>{notion.evidenceCount} preuve(s)</dd>
                            </div>
                          </dl>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p>Pas encore de données</p>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      {snapshot.quizzes.length ? (
        <section>
          <h2>Progression par Quizz</h2>
          <div className={styles.parts}>
            {snapshot.quizzes.map((quizz) => (
              <div key={quizz.quizzId}>
                <span>{quizz.title}</span>
                <strong>{quizz.masteryScore} %</strong>
                <span
                  className={styles.pill}
                  data-tone={masteryStatusTones[quizz.status]}
                >
                  {masteryStatusLabels[quizz.status]}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className={styles.trendChart}>
        <h2>Évolution du taux de réussite</h2>
        {snapshot.weeklyAccuracy.some((week) => week.accuracy !== null) ? (
          <div
            className={styles.trendBars}
            aria-label="Taux de réussite sur les 4 dernières semaines"
          >
            {snapshot.weeklyAccuracy.map((week) => (
              <div key={week.weekStart}>
                <span
                  className={styles.trendBar}
                  style={{
                    blockSize:
                      week.accuracy === null
                        ? '4%'
                        : `${Math.max(4, week.accuracy)}%`,
                  }}
                  data-empty={week.accuracy === null}
                  title={
                    week.accuracy === null
                      ? 'Aucune donnée'
                      : `${week.accuracy} % (${week.count} question${week.count > 1 ? 's' : ''})`
                  }
                />
                <time dateTime={week.weekStart}>
                  {new Intl.DateTimeFormat('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  }).format(new Date(`${week.weekStart}T12:00:00`))}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <p>Pas encore assez de données pour tracer une évolution.</p>
        )}
      </section>
      <section className={styles.activity}>
        <h2>Activité</h2>
        <div className={styles.weekBars} aria-label="Activité sur 7 jours">
          {snapshot.calendar.slice(-7).map((day) => (
            <div key={day.date}>
              <span
                style={{
                  blockSize: `${Math.max(8, Math.min(100, day.count * 20))}%`,
                }}
              />
              <time dateTime={day.date}>
                {new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' }).format(
                  new Date(`${day.date}T12:00:00`),
                )}
              </time>
            </div>
          ))}
        </div>
        <h3>28 derniers jours</h3>
        <ol className={styles.calendar}>
          {snapshot.calendar.map((day) => (
            <li key={day.date}>
              <span className={styles.visuallyHidden}>
                {day.count} évaluation{day.count > 1 ? 's' : ''}
              </span>
              <span
                className={styles.activityCell}
                data-level={Math.min(4, day.count)}
                title={`${day.date} · ${day.count}`}
              />
            </li>
          ))}
        </ol>
      </section>
      <section className={styles.weakPoints}>
        <h2>Points faibles prioritaires</h2>
        {snapshot.weakPoints.kind === 'calibrating' ? (
          <p>{snapshot.weakPoints.message}</p>
        ) : snapshot.weakPoints.kind === 'ready' ? (
          <ol className={styles.weakList}>
            {snapshot.weakPoints.items.map((item) => (
              <li key={item.notionId}>
                <span className={styles.weakPriority} aria-hidden="true">
                  {item.priority}
                </span>
                <div>
                  <strong>{label(item.notionId)}</strong>
                  <p>{item.rationale}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p>{snapshot.weakPoints.message}</p>
        )}
      </section>
      <section className={styles.recentActivity}>
        <h2>Activité récente</h2>
        {snapshot.recent.length ? (
          <ol className={styles.timeline}>
            {snapshot.recent.map((event) => (
              <li key={event.id} data-tone={resultTones[event.result]}>
                <strong>
                  {label(event.notionId ?? event.quizzId ?? '')}
                </strong>
                <span>
                  <span
                    className={styles.pill}
                    data-tone={resultTones[event.result]}
                  >
                    {resultLabels[event.result]}
                  </span>
                  {` · ${modeLabels[event.sessionMode]}`}
                </span>
                <time dateTime={event.occurredAt}>
                  {formatDate(event.occurredAt)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p>Aucune activité terminée pour le moment.</p>
        )}
      </section>
    </>
  );
}

function DailySummary({
  state,
  label,
}: {
  state: ProgressSnapshot['dailyPlan'];
  label: (id: string) => string;
}) {
  if (state.kind === 'none-scheduled')
    return <p>Aucune révision n’est prévue aujourd’hui. Tu es à jour.</p>;
  if (state.kind === 'unavailable') return <p>{state.message}</p>;
  if (state.kind === 'completed')
    return (
      <p>
        Révision du jour terminée. Toutes les notions prévues ont été révisées.
      </p>
    );
  return (
    <ul>
      {state.items.map((item) => (
        <li key={item.notionId}>
          {label(item.notionId)} — {item.successCount}/{item.plannedCount}
        </li>
      ))}
    </ul>
  );
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
        new Date(value),
      )
    : 'Pas encore disponible';
}
