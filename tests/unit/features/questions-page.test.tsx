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
const saveCourse = vi.fn((_userId: string, course: PersonalCourse) => {
  snapshot = {
    ...snapshot,
    courses: [...snapshot.courses, course],
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

describe('QuestionsPage', () => {
  beforeEach(() => {
    currentRole = 'owner';
    snapshot = {
      questions: [question()],
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

  it('ouvre le GPT configuré dans un nouvel onglet sans remplacer la page', async () => {
    const user = userEvent.setup();
    render(<QuestionsPage />);

    const importLink = await screen.findByRole('link', {
      name: 'Importer avec ChatGPT',
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
      screen.getByRole('button', { name: 'Créer une question' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Nouvelle question' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    const previousPullCount =
      questionRemoteGateway.pullRecent.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Synchroniser' }));
    await waitFor(() =>
      expect(
        questionRemoteGateway.pullRecent.mock.calls.length,
      ).toBeGreaterThan(previousPullCount),
    );
  });

  it('ne rend aucun lien lorsque la configuration ChatGPT est dangereuse', () => {
    vi.stubEnv('VITE_CHATGPT_IMPORT_GPT_URL', 'javascript:alert(1)');
    render(<QuestionsPage />);
    expect(
      screen.queryByRole('link', { name: 'Importer avec ChatGPT' }),
    ).not.toBeInTheDocument();
  });

  it('recherche, filtre, relit, partage et archive un brouillon', async () => {
    const user = userEvent.setup();
    render(<QuestionsPage />);
    expect(await screen.findByText('1 en attente')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Recherche'), 'somme');
    await user.selectOptions(screen.getByLabelText('Source'), 'private');
    await user.selectOptions(screen.getByLabelText('Type'), 'course');
    await user.selectOptions(screen.getByLabelText('Difficulté'), 'standard');
    await user.selectOptions(screen.getByLabelText('Statut'), 'draft');
    await user.click(screen.getByRole('button', { name: /Calculer la somme/ }));
    await user.click(
      screen.getByRole('button', { name: 'Valider la relecture' }),
    );
    await waitFor(() => expect(saveQuestion).toHaveBeenCalled());
    expect(
      await screen.findByRole('button', { name: 'Partager' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Partager' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(2));
    await user.selectOptions(screen.getByLabelText('Source'), 'shared');
    await user.selectOptions(screen.getByLabelText('Statut'), 'published');
    await user.click(screen.getByRole('button', { name: /Calculer la somme/ }));
    await user.click(screen.getByRole('button', { name: 'Archiver' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(3));
  });

  it('masque le partage à un user', async () => {
    currentRole = 'user';
    snapshot = { ...snapshot, questions: [question({ validated: true })] };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(
      (await screen.findAllByRole('button', { name: /Calculer la somme/ }))[0]!,
    );
    expect(
      screen.queryByRole('button', { name: 'Partager' }),
    ).not.toBeInTheDocument();
  });

  it('persiste dix variantes prouvées lors de la relecture d’un import paramétré', async () => {
    snapshot = {
      ...snapshot,
      questions: [
        question({
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
    await user.click(
      (await screen.findAllByRole('button', { name: /Calculer/ }))[0]!,
    );
    await user.click(
      screen.getByRole('button', { name: 'Valider la relecture' }),
    );
    await waitFor(() => expect(saveQuestion).toHaveBeenCalled());
    const saved = saveQuestion.mock.calls.at(-1)?.[1] as Question;
    expect(saved.parameterization?.validationVariantCount).toBe(10);
    expect(saved.validated).toBe(true);
    await user.click(await screen.findByRole('button', { name: 'Partager' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(2));
    expect((saveQuestion.mock.calls.at(-1)?.[1] as Question).status).toBe(
      'published',
    );
  });

  it('efface une notion existante lorsqu’un nouveau chapitre est saisi', async () => {
    snapshot = {
      ...snapshot,
      courses: [
        {
          id: 'course',
          ownerId: 'user-1',
          title: 'Cours',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
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
    await user.click(
      await screen.findByRole('button', { name: 'Créer une question' }),
    );
    await user.selectOptions(
      screen.getByLabelText('Type de classification'),
      'personal',
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
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await screen.findByText('1 en attente');
    await user.click(
      screen.getByRole('button', { name: 'Créer une question' }),
    );
    await user.selectOptions(
      screen.getByLabelText('Type de classification'),
      'personal',
    );
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
    snapshot = { ...snapshot, questions: [structured] };
    const user = userEvent.setup();
    render(<QuestionsPage />);
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
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Créer une question' }),
    );
    await user.selectOptions(
      screen.getByLabelText('Type de classification'),
      'personal',
    );
    await user.type(
      screen.getByLabelText('Nouveau cours'),
      'Cours sans sauvegarde',
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

  it('présente un import incomplet, la taxonomie personnelle et les choix de conflit', async () => {
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
      courses: [
        {
          id: 'course-1',
          ownerId: 'user-1',
          title: 'Cours personnel',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
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
    await screen.findByRole('option', { name: 'Cours personnel' });
    await user.selectOptions(
      screen.getByLabelText('Partie / Cours'),
      'course-1',
    );
    await user.click(screen.getByRole('button', { name: /Calculer la somme/ }));
    expect(screen.getByText(/Analyse incomplète/)).toBeInTheDocument();
    expect(screen.getByText(/Schéma illisible/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dupliquer' }));
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

  it('archive en masse les questions sélectionnées puis vide la sélection', async () => {
    snapshot = {
      ...snapshot,
      questions: [
        question({ id: 'private-1', prompt: [{ kind: 'text', value: 'Un' }] }),
        question({
          id: 'private-2',
          prompt: [{ kind: 'text', value: 'Deux' }],
        }),
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(
      await screen.findByRole('checkbox', { name: 'Sélectionner Un' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Deux' }),
    );
    expect(
      screen.getByRole('toolbar', { name: 'Actions groupées' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 sélectionnées')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archiver' }));
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

  it('« Tout sélectionner » ignore les questions officielles en lecture seule', async () => {
    snapshot = {
      ...snapshot,
      questions: [
        question({ id: 'private-1', prompt: [{ kind: 'text', value: 'Un' }] }),
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(
      await screen.findByRole('checkbox', { name: 'Tout sélectionner' }),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Sélectionner Un' }),
    ).toBeChecked();
    expect(
      screen.queryByRole('checkbox', {
        name: /Sélectionner Calculer la somme/,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('1 sélectionnée')).toBeInTheDocument();
  });

  it('déplace en masse les questions sélectionnées vers un dossier existant', async () => {
    snapshot = {
      ...snapshot,
      questions: [
        question({ id: 'private-1', prompt: [{ kind: 'text', value: 'Un' }] }),
      ],
      courses: [
        {
          id: 'course-x',
          ownerId: 'user-1',
          title: 'Cours X',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(
      await screen.findByRole('checkbox', { name: 'Sélectionner Un' }),
    );
    await user.selectOptions(
      screen.getByLabelText('Déplacer vers'),
      'course-x',
    );
    await user.click(screen.getByRole('button', { name: 'Déplacer' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(1));
    const saved = saveQuestion.mock.calls.at(-1)?.[1] as Question;
    expect(saved.classification).toMatchObject({
      kind: 'personal',
      courseId: 'course-x',
    });
  });

  it('navigue dans la vue Dossiers et n’affiche que les questions du dossier courant', async () => {
    snapshot = {
      ...snapshot,
      questions: [
        question({
          id: 'private-1',
          prompt: [{ kind: 'text', value: 'Question perso' }],
        }),
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(screen.getByRole('button', { name: 'Dossiers' }));
    expect(
      screen.queryByRole('button', { name: /Question perso/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Officielle/ }));
    expect(
      await screen.findByRole('button', { name: /Calculer la somme/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Question perso/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tous les dossiers' }));
    expect(
      screen.queryByRole('button', { name: /Calculer la somme/ }),
    ).not.toBeInTheDocument();
  });

  it('crée un cours puis un chapitre depuis la vue Dossiers', async () => {
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(screen.getByRole('button', { name: 'Dossiers' }));
    await user.type(
      screen.getByPlaceholderText('Nouveau cours'),
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
  });
});
