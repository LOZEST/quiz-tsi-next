import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@domain/questions/Question';
import type { QuestionWorkspaceSnapshot } from '@domain/repositories/QuestionWorkspaceRepository';
import type { PersonalTaxonomyDraft } from '@domain/repositories/QuestionWorkspaceRepository';
import type {
  PersonalChapter,
  PersonalCourse,
  PersonalNotion,
} from '@domain/questions/personal-taxonomy/PersonalTaxonomy';

const question = (overrides: Partial<Question> = {}): Question => ({
  id: 'private-1',
  version: 1,
  source: 'private',
  ownerId: 'user-1',
  status: 'draft',
  validated: false,
  provenance: null,
  classification: {
    kind: 'official',
    partId: 'numbers',
    chapterId: 'numbers-arithmetic',
    notionId: 'NUM-F01',
  },
  type: 'course',
  difficulty: 'standard',
  parameterization: null,
  prompt: [{ kind: 'text', value: 'Calculer la somme' }],
  hint: [],
  correction: [
    { id: 'step-1', title: null, content: [{ kind: 'text', value: 'Deux' }] },
  ],
  tags: ['somme'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const course = (overrides: Partial<PersonalCourse> = {}): PersonalCourse => ({
  id: 'course-1',
  ownerId: 'user-1',
  title: 'Mécanique',
  description: '',
  visibility: 'private',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

let snapshot: QuestionWorkspaceSnapshot;
let currentRole: 'user' | 'admin' | 'owner' = 'owner';
const load = vi.fn(() => Promise.resolve(snapshot));
const saveQuestion = vi.fn<
  (
    userId: string,
    next: Question,
    kind: string,
    operationId: string,
  ) => Promise<void>
>((_userId, next) => {
  snapshot = {
    ...snapshot,
    questions: [
      ...snapshot.questions.filter((item) => item.id !== next.id),
      next,
    ],
    pendingOperationCount: snapshot.pendingOperationCount + 1,
  };
  return Promise.resolve();
});
const resolveConflict = vi.fn(() => Promise.resolve());
const saveQuestionDraftWithPersonalTaxonomy = vi.fn(
  (_userId, next: Question, taxonomy: PersonalTaxonomyDraft) => {
    snapshot = {
      ...snapshot,
      questions: [...snapshot.questions, next],
      courses: taxonomy.course
        ? [...snapshot.courses, taxonomy.course]
        : snapshot.courses,
      chapters: taxonomy.chapter
        ? [...snapshot.chapters, taxonomy.chapter]
        : snapshot.chapters,
      notions: taxonomy.notion
        ? [...snapshot.notions, taxonomy.notion]
        : snapshot.notions,
      pendingOperationCount: snapshot.pendingOperationCount + 1,
    };
    return Promise.resolve();
  },
);
const listOutbox = vi.fn(() => Promise.resolve([]));
const saveCourse = vi.fn((_userId: string, next: PersonalCourse) => {
  snapshot = {
    ...snapshot,
    courses: [...snapshot.courses.filter((item) => item.id !== next.id), next],
    pendingOperationCount: snapshot.pendingOperationCount + 1,
  };
  return Promise.resolve();
});
const saveChapter = vi.fn((_userId: string, chapter: PersonalChapter) => {
  snapshot = {
    ...snapshot,
    chapters: [...snapshot.chapters, chapter],
    pendingOperationCount: snapshot.pendingOperationCount + 1,
  };
  return Promise.resolve();
});
const saveNotion = vi.fn((_userId: string, notion: PersonalNotion) => {
  snapshot = {
    ...snapshot,
    notions: [...snapshot.notions, notion],
    pendingOperationCount: snapshot.pendingOperationCount + 1,
  };
  return Promise.resolve();
});
const questionWorkspaceRepository = {
  load,
  saveQuestion,
  saveQuestionDraftWithPersonalTaxonomy,
  saveCourse,
  saveChapter,
  saveNotion,
  resolveConflict,
  listOutbox,
  completeOperation: vi.fn(() => Promise.resolve()),
  applyRemoteWorkspace: vi.fn(() => Promise.resolve()),
  recordConflict: vi.fn(() => Promise.resolve()),
};
const questionRemoteGateway = {
  push: vi.fn(() => Promise.resolve({ kind: 'accepted' as const })),
  pullRecent: vi.fn(() =>
    Promise.resolve({
      questions: [],
      courses: [],
      chapters: [],
      notions: [],
      rejectedRows: [] as { index: number; message: string }[],
    }),
  ),
};

vi.mock('@app/providers/AuthProvider', () => ({
  useAuth: () => ({
    state: {
      status: 'authenticated',
      session: { user: { id: 'user-1', role: currentRole } },
    },
  }),
}));
vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    questionRepository: {
      listPublished: () => [
        question({
          id: 'static-1',
          source: 'static',
          ownerId: null,
          status: 'published',
          validated: true,
        }),
      ],
    },
    questionWorkspaceRepository,
    questionRemoteGateway,
    programIndex: null,
  }),
}));

import { QuestionsPage } from '@pages/QuestionsPage/QuestionsPage';

async function enterCourse(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
) {
  await user.click(
    await screen.findByRole('button', { name: new RegExp(title) }),
  );
}

describe('QuestionsPage', () => {
  beforeEach(() => {
    currentRole = 'owner';
    snapshot = {
      questions: [],
      courses: [],
      chapters: [],
      notions: [],
      pendingOperationCount: 1,
      conflicts: [],
    };
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'generated-id') });
    vi.stubEnv(
      'VITE_CHATGPT_IMPORT_GPT_URL',
      'https://chatgpt.com/g/quiz-tsi-import',
    );
  });

  it('synchronise et affiche les opérations en attente', async () => {
    const user = userEvent.setup();
    render(<QuestionsPage />);
    expect(await screen.findByText('1 en attente')).toBeInTheDocument();
    const previousPullCount =
      questionRemoteGateway.pullRecent.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Synchroniser' }));
    await waitFor(() =>
      expect(
        questionRemoteGateway.pullRecent.mock.calls.length,
      ).toBeGreaterThan(previousPullCount),
    );
  });

  it('ouvre le GPT configuré dans un nouvel onglet et ouvre/ferme l’éditeur manuel', async () => {
    snapshot = { ...snapshot, courses: [course()] };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    const importLink = await screen.findByRole('link', {
      name: 'Ajouter une question avec GPT',
    });
    expect(importLink).toHaveAttribute(
      'href',
      'https://chatgpt.com/g/quiz-tsi-import',
    );
    expect(importLink).toHaveAttribute('target', '_blank');
    expect(importLink.getAttribute('rel')?.split(' ')).toEqual(
      expect.arrayContaining(['noopener', 'noreferrer']),
    );
    await user.click(
      screen.getByRole('button', { name: 'Ajouter une question à la main' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Nouvelle question' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(
      screen.queryByRole('dialog', { name: 'Nouvelle question' }),
    ).not.toBeInTheDocument();
  });

  it('ne rend aucun lien lorsque la configuration ChatGPT est dangereuse', async () => {
    vi.stubEnv('VITE_CHATGPT_IMPORT_GPT_URL', 'javascript:alert(1)');
    snapshot = { ...snapshot, courses: [course()] };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    expect(
      screen.queryByRole('link', { name: 'Ajouter une question avec GPT' }),
    ).not.toBeInTheDocument();
  });

  it('valide une question de brouillon puis la supprime depuis l’espace de travail', async () => {
    snapshot = {
      ...snapshot,
      courses: [course()],
      questions: [
        question({
          classification: {
            kind: 'personal',
            courseId: 'course-1',
            chapterId: null,
            notionId: null,
          },
        }),
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    await user.click(screen.getByRole('button', { name: /Calculer la somme/ }));
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(1));
    expect(saveQuestion.mock.calls[0]?.[1]).toMatchObject({
      status: 'published',
      validated: true,
    });
    expect(saveQuestion.mock.calls[0]?.[2]).toBe('publish');
    await user.click(screen.getByRole('button', { name: /Calculer la somme/ }));
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(2));
    expect((saveQuestion.mock.calls.at(-1)?.[1] as Question).status).toBe(
      'archived',
    );
  });

  it('persiste dix variantes prouvées lors de la relecture d’un import paramétré', async () => {
    snapshot = {
      ...snapshot,
      courses: [course()],
      questions: [
        question({
          classification: {
            kind: 'personal',
            courseId: 'course-1',
            chapterId: null,
            notionId: null,
          },
          prompt: [{ kind: 'text', value: 'Calculer @n' }],
          correction: [
            {
              id: 'step-1',
              title: null,
              content: [{ kind: 'text', value: '@n' }],
            },
          ],
          parameterization: {
            schemaVersion: 1,
            validationVariantCount: 1,
            variables: [
              {
                id: 'n',
                label: 'n',
                domain: {
                  kind: 'integer',
                  minimum: 1,
                  maximum: 10,
                  step: 1,
                  excludedValues: [],
                },
              },
            ],
            constraints: [],
          },
        }),
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    await user.click(
      (await screen.findAllByRole('button', { name: /Calculer/ }))[0]!,
    );
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalled());
    const saved = saveQuestion.mock.calls.at(-1)?.[1] as Question;
    expect(saved.parameterization?.validationVariantCount).toBe(10);
    expect(saved.validated).toBe(true);
  });

  it('efface une notion existante lorsqu’un nouveau chapitre est saisi', async () => {
    snapshot = {
      ...snapshot,
      courses: [{ ...course(), id: 'course' }],
      chapters: [
        {
          id: 'chapter-a',
          courseId: 'course',
          ownerId: 'user-1',
          title: 'A',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      notions: [
        {
          id: 'notion-a1',
          courseId: 'course',
          chapterId: 'chapter-a',
          ownerId: 'user-1',
          title: 'A1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    await user.click(
      screen.getByRole('button', { name: 'Ajouter une question à la main' }),
    );
    await user.selectOptions(screen.getByLabelText('Cours'), 'course');
    await user.selectOptions(
      screen.getByLabelText('Chapitre existant facultatif'),
      'chapter-a',
    );
    await user.selectOptions(
      screen.getByLabelText('Notion existante facultative'),
      'notion-a1',
    );
    await user.type(screen.getByLabelText('Nouveau chapitre facultatif'), 'B');
    await user.type(screen.getByLabelText('Texte'), 'Question');
    const correction = screen.getByRole('group', {
      name: 'Contenu de l’étape 1',
    });
    await user.click(
      within(correction).getByRole('button', { name: '+ Texte' }),
    );
    await user.type(within(correction).getByLabelText('Texte'), 'Réponse');
    await user.click(
      screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
    );
    await waitFor(() =>
      expect(saveQuestionDraftWithPersonalTaxonomy).toHaveBeenCalled(),
    );
    const saved = saveQuestionDraftWithPersonalTaxonomy.mock.calls.at(
      -1,
    )?.[1] as Question;
    expect(saved.classification).toMatchObject({
      courseId: 'course',
      notionId: null,
    });
    expect(
      saved.classification &&
        'chapterId' in saved.classification &&
        saved.classification.chapterId,
    ).not.toBe('chapter-a');
  });

  it('crée et édite les segments structurés et les aides mathématiques', async () => {
    snapshot = { ...snapshot, courses: [course()] };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    await user.click(
      screen.getByRole('button', { name: 'Ajouter une question à la main' }),
    );
    await user.selectOptions(screen.getByLabelText('Cours'), '');
    await user.type(screen.getByLabelText('Nouveau cours'), 'Mon cours');
    await user.type(
      screen.getByLabelText('Nouveau chapitre facultatif'),
      'Chapitre 1',
    );
    await user.type(
      screen.getByLabelText('Nouvelle notion facultative'),
      'Notion 1',
    );
    const prompt = screen.getByRole('group', { name: 'Énoncé' });
    await user.type(
      within(prompt).getByLabelText('Texte'),
      'Une nouvelle question',
    );
    await user.click(within(prompt).getByRole('button', { name: '+ Formule' }));
    const formula = within(prompt).getByRole('textbox', {
      name: /Formule en ligne/,
    });
    await user.clear(formula);
    await user.type(formula, 'x+');
    expect(screen.queryByText('Formule valide')).not.toBeInTheDocument();
    await user.clear(formula);
    await user.type(formula, 'x^2');
    await user.click(
      screen.getByRole('button', { name: 'Clavier mathématique' }),
    );
    await user.click(screen.getByRole('button', { name: /π/ }));
    await user.clear(formula);
    await user.type(formula, '@n^2');
    await user.click(screen.getByRole('button', { name: 'Raccourcis' }));
    await user.click(
      within(prompt).getByRole('button', { name: '+ Formule affichée' }),
    );
    await user.click(
      within(prompt).getByRole('button', { name: '+ Saut de ligne' }),
    );
    const hint = screen.getByRole('group', { name: 'Indice' });
    await user.click(within(hint).getByRole('button', { name: '+ Texte' }));
    await user.type(within(hint).getByLabelText('Texte'), 'Un indice');
    const correction = screen.getByRole('group', {
      name: 'Contenu de l’étape 1',
    });
    await user.click(
      within(correction).getByRole('button', { name: '+ Texte' }),
    );
    await user.type(
      within(correction).getByLabelText('Texte'),
      'Une correction',
    );
    await user.type(screen.getByLabelText('Nom'), 'n!');
    await user.type(screen.getByLabelText('Libellé'), 'Entier n');
    await user.selectOptions(screen.getByLabelText('Domaine'), 'choice');
    await user.clear(
      screen.getByLabelText('Valeurs séparées par des virgules'),
    );
    await user.type(
      screen.getByLabelText('Valeurs séparées par des virgules'),
      '1,2,3,4,5,6,7,8,9,10',
    );
    await user.click(
      screen.getByRole('button', { name: 'Définir la variable' }),
    );
    await user.click(screen.getByRole('button', { name: 'Insérer @n' }));
    await user.selectOptions(screen.getByLabelText('Variable gauche'), 'n');
    await user.type(screen.getByLabelText('Valeur de contrainte'), '0');
    await user.click(
      screen.getByRole('button', { name: 'Ajouter la contrainte' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Tester les variantes' }),
    );
    expect(saveQuestionDraftWithPersonalTaxonomy).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('list', { name: 'Variantes générées' }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText('Valeur droite'),
      'variable',
    );
    await user.selectOptions(screen.getByLabelText('Variable droite'), 'n');
    await user.click(
      screen.getByRole('button', { name: 'Ajouter la contrainte' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
    );
    await waitFor(() =>
      expect(saveQuestionDraftWithPersonalTaxonomy).toHaveBeenCalledTimes(1),
    );
    const savedTaxonomy =
      saveQuestionDraftWithPersonalTaxonomy.mock.calls[0]?.[2];
    expect(savedTaxonomy?.course?.title).toBe('Mon cours');
    expect(savedTaxonomy?.chapter?.title).toBe('Chapitre 1');
    expect(savedTaxonomy?.notion?.title).toBe('Notion 1');
  }, 10_000);

  it('affiche les erreurs de stockage et de synchronisation et réagit au hors-ligne', async () => {
    load.mockRejectedValueOnce('stockage');
    questionRemoteGateway.pullRecent.mockRejectedValueOnce(new Error('réseau'));
    render(<QuestionsPage />);
    expect(
      await screen.findByText('Stockage local inaccessible.'),
    ).toBeInTheDocument();
    window.dispatchEvent(new Event('offline'));
    expect(await screen.findByText(/Hors connexion/)).toBeInTheDocument();
    window.dispatchEvent(new Event('online'));
    await waitFor(() =>
      expect(screen.queryByText(/Hors connexion/)).toBeNull(),
    );
  });

  it('signale les questions distantes rejetées sans bloquer la synchronisation', async () => {
    questionRemoteGateway.pullRecent.mockResolvedValueOnce({
      questions: [],
      courses: [],
      chapters: [],
      notions: [],
      rejectedRows: [
        { index: 0, message: 'Question distante invalide : provenance.' },
        { index: 2, message: 'Question distante invalide : timestamps.' },
      ],
    });

    render(<QuestionsPage />);

    expect(
      await screen.findByText(
        '2 questions distantes n’ont pas pu être chargées.',
      ),
    ).toBeInTheDocument();
    expect(questionWorkspaceRepository.applyRemoteWorkspace).toHaveBeenCalled();
  });

  it('préserve indice structuré, étapes de correction, type et tags à l’édition', async () => {
    const structured = question({
      classification: {
        kind: 'personal',
        courseId: 'course-1',
        chapterId: null,
        notionId: null,
      },
      hint: [
        { kind: 'text', value: 'Utilise ' },
        { kind: 'inline-math', math: { syntaxVersion: 1, source: 'x^2' } },
      ],
      correction: [
        {
          id: 'step-a',
          title: 'Calcul',
          content: [
            { kind: 'text', value: 'On obtient' },
            { kind: 'display-math', math: { syntaxVersion: 1, source: 'x=2' } },
          ],
        },
        {
          id: 'step-b',
          title: null,
          content: [{ kind: 'text', value: 'Conclusion' }],
        },
      ],
      tags: ['algèbre', 'carré'],
    });
    snapshot = { ...snapshot, courses: [course()], questions: [structured] };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    await user.click(
      (await screen.findAllByRole('button', { name: /Calculer la somme/ }))[0]!,
    );
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    const editor = screen.getByRole('dialog', { name: 'Modifier la question' });
    expect(
      within(editor).getByRole('group', { name: 'Indice' }),
    ).toHaveTextContent('Formule en ligne');
    expect(
      within(editor).getByRole('group', { name: 'Contenu de l’étape 1' }),
    ).toHaveTextContent('Formule affichée');
    await user.selectOptions(within(editor).getByLabelText('Type'), 'reflex');
    expect(
      within(editor).queryByLabelText('Difficulté'),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
    );
    await waitFor(() => expect(saveQuestion).toHaveBeenCalled());
    const saved = saveQuestion.mock.calls.at(-1)?.[1] as Question;
    expect(saved.hint).toEqual(structured.hint);
    expect(saved.correction).toEqual(structured.correction);
    expect(saved.tags).toEqual(['algèbre', 'carré']);
    expect(saved).toMatchObject({ type: 'reflex', difficulty: null });
  });

  it('tester plusieurs fois puis annuler ne persiste aucune donnée', async () => {
    snapshot = { ...snapshot, courses: [course()] };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    await user.click(
      screen.getByRole('button', { name: 'Ajouter une question à la main' }),
    );
    await user.type(screen.getByLabelText('Nom'), 'n');
    await user.type(screen.getByLabelText('Libellé'), 'Entier');
    await user.click(
      screen.getByRole('button', { name: 'Définir la variable' }),
    );
    const preview = screen.getByRole('button', {
      name: 'Tester les variantes',
    });
    await user.click(preview);
    await user.click(preview);
    await user.click(preview);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(saveQuestion).not.toHaveBeenCalled();
    expect(saveQuestionDraftWithPersonalTaxonomy).not.toHaveBeenCalled();
  });

  it('présente un import incomplet et les choix de conflit', async () => {
    const imported = question({
      classification: {
        kind: 'personal',
        courseId: 'course-1',
        chapterId: null,
        notionId: null,
      },
      provenance: {
        bundleId: 'import-1',
        importedAt: '2026-01-01T00:00:00.000Z',
        references: [],
        chatGptImport: {
          coverage: 'incomplete',
          entryIndex: 0,
          clientEntryId: 'entry-1',
          uncertainties: [
            {
              code: 'uncertain-visual',
              path: 'prompt',
              message: 'Schéma illisible',
            },
          ],
        },
      },
    });
    snapshot = {
      ...snapshot,
      questions: [imported],
      courses: [course()],
      conflicts: [
        {
          id: 'conflict-1',
          userId: 'user-1',
          entityId: 'private-1',
          operationId: 'operation-1',
          local: imported,
          remote: question({ version: 2 }),
          detectedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    await user.click(screen.getByRole('button', { name: /Calculer la somme/ }));
    expect(screen.getByText(/Analyse incomplète/)).toBeInTheDocument();
    expect(screen.getByText(/Schéma illisible/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalled());
    await user.click(
      screen.getByRole('button', { name: 'Conserver ma version' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Utiliser la version serveur' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Dupliquer ma version' }),
    );
    expect(resolveConflict).toHaveBeenCalledTimes(3);
  });

  it('supprime en masse les questions sélectionnées puis vide la sélection', async () => {
    snapshot = {
      ...snapshot,
      courses: [course()],
      questions: [
        question({
          id: 'private-1',
          prompt: [{ kind: 'text', value: 'Un' }],
          classification: {
            kind: 'personal',
            courseId: 'course-1',
            chapterId: null,
            notionId: null,
          },
        }),
        question({
          id: 'private-2',
          prompt: [{ kind: 'text', value: 'Deux' }],
          classification: {
            kind: 'personal',
            courseId: 'course-1',
            chapterId: null,
            notionId: null,
          },
        }),
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    await user.click(
      await screen.findByRole('checkbox', { name: 'Sélectionner Un' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Deux' }),
    );
    expect(
      screen.getByRole('toolbar', { name: 'Actions groupées' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 questions sélectionnées')).toBeInTheDocument();
    await user.click(
      within(
        screen.getByRole('toolbar', { name: 'Actions groupées' }),
      ).getByRole('button', { name: 'Supprimer' }),
    );
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(2));
    expect(saveQuestion.mock.calls.map((call) => call[2])).toEqual([
      'archive',
      'archive',
    ]);
    expect(
      saveQuestion.mock.calls.every((call) => call[1].status === 'archived'),
    ).toBe(true);
    expect(
      screen.queryByRole('toolbar', { name: 'Actions groupées' }),
    ).not.toBeInTheDocument();
  });

  it('navigue dans la grille Mes Quizz et n’affiche que les questions du quizz courant', async () => {
    snapshot = {
      ...snapshot,
      courses: [{ ...course(), id: 'course-mecanique' }],
      questions: [
        question({
          id: 'private-1',
          prompt: [{ kind: 'text', value: 'Question perso' }],
          classification: {
            kind: 'personal',
            courseId: 'course-mecanique',
            chapterId: null,
            notionId: null,
          },
        }),
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    expect(
      screen.queryByRole('checkbox', { name: /Question perso/ }),
    ).not.toBeInTheDocument();
    await enterCourse(user, 'Mécanique');
    expect(
      await screen.findByRole('checkbox', { name: /Question perso/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mes Quizz' }));
    expect(
      screen.queryByRole('checkbox', { name: /Question perso/ }),
    ).not.toBeInTheDocument();
  });

  it('sélectionne, valide, supprime une question et bascule la visibilité du quizz dans l’espace de travail', async () => {
    snapshot = {
      ...snapshot,
      courses: [
        {
          ...course(),
          id: 'course-mecanique',
          description: 'Chute libre et cinématique',
        },
      ],
      questions: [
        question({
          id: 'draft-1',
          status: 'draft',
          prompt: [{ kind: 'text', value: 'Question brouillon' }],
          hint: [{ kind: 'text', value: 'Un indice' }],
          classification: {
            kind: 'personal',
            courseId: 'course-mecanique',
            chapterId: null,
            notionId: null,
          },
        }),
        question({
          id: 'published-1',
          status: 'published',
          validated: true,
          prompt: [{ kind: 'text', value: 'Question publiée' }],
          classification: {
            kind: 'personal',
            courseId: 'course-mecanique',
            chapterId: null,
            notionId: null,
          },
        }),
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    expect(
      screen.getByText('Sélectionne une question dans les colonnes de gauche.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Question publiée' }));
    expect(screen.getByText('Deux')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Valider' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() =>
      expect(saveQuestion).toHaveBeenLastCalledWith(
        'user-1',
        expect.objectContaining({ id: 'published-1', status: 'archived' }),
        'archive',
        expect.any(String),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: 'Question brouillon' }),
    );
    expect(screen.getByText('Un indice')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await waitFor(() =>
      expect(saveQuestion).toHaveBeenLastCalledWith(
        'user-1',
        expect.objectContaining({ id: 'draft-1', status: 'published' }),
        'publish',
        expect.any(String),
      ),
    );

    expect(screen.getByText('Chute libre et cinématique')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Privé' }));
    await waitFor(() =>
      expect(saveCourse).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          id: 'course-mecanique',
          visibility: 'public',
        }),
        expect.any(String),
        'update',
      ),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Chute libre et cinématique',
      }),
    );
    const titleInput = screen.getByLabelText('Nom du quizz');
    await user.clear(titleInput);
    await user.type(titleInput, 'Mécanique du point');
    const descriptionInput = screen.getByLabelText('Description');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Cinématique et dynamique');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(saveCourse).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          id: 'course-mecanique',
          title: 'Mécanique du point',
          description: 'Cinématique et dynamique',
        }),
        expect.any(String),
        'update',
      ),
    );

    await user.click(
      screen.getByRole('button', { name: 'Ajouter une question à la main' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Nouvelle question' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Cours')).toHaveValue('course-mecanique');
  });

  it('crée un quizz, un chapitre puis une notion, puis re-navigue vers les quizz existants', async () => {
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.type(
      await screen.findByPlaceholderText('Nouveau quizz'),
      'Cinématique',
    );
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() => expect(saveCourse).toHaveBeenCalledTimes(1));
    const createdCourse = saveCourse.mock.calls[0]?.[1] as PersonalCourse;
    expect(createdCourse.title).toBe('Cinématique');
    expect(
      await screen.findByPlaceholderText('Nouveau chapitre'),
    ).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Nouveau chapitre'), 'Vitesse');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() => expect(saveChapter).toHaveBeenCalledTimes(1));
    const createdChapter = saveChapter.mock.calls[0]?.[1] as PersonalChapter;
    expect(createdChapter).toMatchObject({
      title: 'Vitesse',
      courseId: createdCourse.id,
    });
    expect(
      await screen.findByPlaceholderText('Nouvelle notion'),
    ).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Nouvelle notion'), 'MRU');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() => expect(saveNotion).toHaveBeenCalledTimes(1));
    const createdNotion = saveNotion.mock.calls[0]?.[1] as PersonalNotion;
    expect(createdNotion).toMatchObject({
      title: 'MRU',
      courseId: createdCourse.id,
      chapterId: createdChapter.id,
    });
    await user.click(screen.getByRole('button', { name: 'Mes Quizz' }));
    await user.click(screen.getByRole('button', { name: /Cinématique/ }));
    await user.click(screen.getByRole('button', { name: /Vitesse/ }));
    expect(
      await screen.findByRole('button', { name: /MRU/ }),
    ).toBeInTheDocument();
  });

  it('valide en masse les brouillons sélectionnés', async () => {
    snapshot = {
      ...snapshot,
      courses: [course()],
      questions: [
        question({
          id: 'private-1',
          prompt: [{ kind: 'text', value: 'Un' }],
          classification: {
            kind: 'personal',
            courseId: 'course-1',
            chapterId: null,
            notionId: null,
          },
        }),
        question({
          id: 'private-2',
          prompt: [{ kind: 'text', value: 'Deux' }],
          classification: {
            kind: 'personal',
            courseId: 'course-1',
            chapterId: null,
            notionId: null,
          },
        }),
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    await user.click(
      await screen.findByRole('checkbox', { name: 'Sélectionner Un' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Deux' }),
    );
    await user.click(
      within(
        screen.getByRole('toolbar', { name: 'Actions groupées' }),
      ).getByRole('button', { name: 'Valider' }),
    );
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(2));
    expect(
      saveQuestion.mock.calls.every(
        (call) => call[1].status === 'published' && call[1].validated,
      ),
    ).toBe(true);
    expect(saveQuestion.mock.calls.every((call) => call[2] === 'publish')).toBe(
      true,
    );
  });

  it('n’interrompt pas une action groupée si une question échoue, et le signale', async () => {
    snapshot = {
      ...snapshot,
      courses: [course()],
      questions: [
        question({
          id: 'private-1',
          prompt: [{ kind: 'text', value: 'Un' }],
          classification: {
            kind: 'personal',
            courseId: 'course-1',
            chapterId: null,
            notionId: null,
          },
        }),
        question({
          id: 'private-2',
          prompt: [{ kind: 'text', value: 'Deux' }],
          classification: {
            kind: 'personal',
            courseId: 'course-1',
            chapterId: null,
            notionId: null,
          },
        }),
      ],
    };
    saveQuestion.mockImplementationOnce(() =>
      Promise.reject(new Error('Échec réseau simulé')),
    );
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await enterCourse(user, 'Mécanique');
    await user.click(
      await screen.findByRole('checkbox', { name: 'Sélectionner Un' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Deux' }),
    );
    await user.click(
      within(
        screen.getByRole('toolbar', { name: 'Actions groupées' }),
      ).getByRole('button', { name: 'Supprimer' }),
    );
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText('private-1 — Échec réseau simulé'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('toolbar', { name: 'Actions groupées' }),
    ).not.toBeInTheDocument();
  });
});
