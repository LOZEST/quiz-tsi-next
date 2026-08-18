import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@domain/questions/Question';
import type { QuestionWorkspaceSnapshot } from '@domain/repositories/QuestionWorkspaceRepository';
import type { Quizz } from '@domain/questions/quizz/Quizz';

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
const saveQuestionWithQuizz = vi.fn(
  (_userId: string, next: Question, quizz: Quizz | null) => {
    snapshot = {
      ...snapshot,
      questions: [...snapshot.questions, next],
      quizzes: quizz ? [...snapshot.quizzes, quizz] : snapshot.quizzes,
      pendingOperationCount: snapshot.pendingOperationCount + 1,
    };
    return Promise.resolve();
  },
);
const listOutbox = vi.fn(() => Promise.resolve([]));
const saveQuizz = vi.fn((_userId: string, course: Quizz) => {
  snapshot = {
    ...snapshot,
    quizzes: [...snapshot.quizzes, course],
    pendingOperationCount: snapshot.pendingOperationCount + 1,
  };
  return Promise.resolve();
});
const questionWorkspaceRepository = {
  load,
  saveQuestion,
  saveQuestionWithQuizz,
  saveQuizz,
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
      quizzes: [],
      rejectedRows: [] as { index: number; message: string }[],
    }),
  ),
};
const refreshQuestionRepositoryForUser = vi.fn(() => Promise.resolve());

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
    quizzMarketplaceGateway: {
      listSubscribedQuizzContent: () => Promise.resolve([]),
    },
    refreshQuestionRepositoryForUser,
  }),
}));

import { QuestionsPage } from '@pages/QuestionsPage/QuestionsPage';

describe('QuestionsPage', () => {
  beforeEach(() => {
    currentRole = 'owner';
    snapshot = {
      questions: [question()],
      quizzes: [],
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

  it('recherche, filtre, valide et supprime un brouillon', async () => {
    const user = userEvent.setup();
    render(<QuestionsPage />);
    expect(await screen.findByText('1 en attente')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Recherche'), 'somme');
    await user.selectOptions(screen.getByLabelText('Source'), 'private');
    await user.selectOptions(screen.getByLabelText('Type'), 'course');
    await user.selectOptions(screen.getByLabelText('Difficulté'), 'standard');
    await user.selectOptions(screen.getByLabelText('Statut'), 'draft');
    await user.click(screen.getByRole('button', { name: /Calculer la somme/ }));
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(1));
    expect((saveQuestion.mock.calls.at(-1)?.[1] as Question).validated).toBe(
      true,
    );
    await user.selectOptions(screen.getByLabelText('Statut'), 'published');
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
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalled());
    const saved = saveQuestion.mock.calls.at(-1)?.[1] as Question;
    expect(saved.parameterization?.validationVariantCount).toBe(10);
    expect(saved.validated).toBe(true);
  });

  it('crée une question personnelle avec un chapitre en texte libre', async () => {
    snapshot = {
      ...snapshot,
      quizzes: [
        {
          id: 'course',
          ownerId: 'user-1',
          title: 'Cours',
          description: '',
          visibility: 'private' as const,
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
    await user.selectOptions(screen.getByLabelText('Quizz'), 'course');
    await user.type(screen.getByLabelText('Chapitre facultatif'), 'B');
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
    await waitFor(() => expect(saveQuestion).toHaveBeenCalled());
    const saved = saveQuestion.mock.calls.at(-1)?.[1] as Question;
    expect(saved.classification).toMatchObject({
      kind: 'personal',
      courseId: 'course',
      chapter: 'B',
    });
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
    await user.type(screen.getByLabelText('Nouveau quizz'), 'Mon cours');
    await user.type(screen.getByLabelText('Chapitre facultatif'), 'Chapitre 1');
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
    expect(saveQuestion).not.toHaveBeenCalled();
    expect(saveQuestionWithQuizz).not.toHaveBeenCalled();
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
    await waitFor(() => expect(saveQuestionWithQuizz).toHaveBeenCalledTimes(1));
    const savedQuizz = saveQuestionWithQuizz.mock.calls[0]?.[2] as Quizz;
    expect(savedQuizz?.title).toBe('Mon cours');
    const savedQuestion = saveQuestionWithQuizz.mock.calls[0]?.[1] as Question;
    expect(savedQuestion.classification).toMatchObject({
      chapter: 'Chapitre 1',
    });
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
      quizzes: [],
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
      screen.getByLabelText('Nouveau quizz'),
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
    expect(saveQuestionWithQuizz).not.toHaveBeenCalled();
  });

  it('présente un import incomplet, le quizz personnel et les choix de conflit', async () => {
    const imported = question({
      classification: {
        kind: 'personal',
        courseId: 'course-1',
        chapter: null,
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
      quizzes: [
        {
          id: 'course-1',
          ownerId: 'user-1',
          title: 'Cours personnel',
          description: '',
          visibility: 'private' as const,
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
      screen.getByLabelText('Partie / Quizz'),
      'course-1',
    );
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
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
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
      quizzes: [
        {
          id: 'course-x',
          ownerId: 'user-1',
          title: 'Cours X',
          description: '',
          visibility: 'private' as const,
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

  it('navigue dans la vue Dossiers et n’affiche que les questions du quizz courant', async () => {
    snapshot = {
      ...snapshot,
      quizzes: [
        {
          id: 'course-mecanique',
          ownerId: 'user-1',
          title: 'Mécanique',
          description: '',
          visibility: 'private',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      questions: [
        question({
          id: 'private-1',
          prompt: [{ kind: 'text', value: 'Question perso' }],
          classification: {
            kind: 'personal',
            courseId: 'course-mecanique',
            chapter: null,
          },
        }),
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(screen.getByRole('button', { name: 'Dossiers' }));
    expect(
      screen.queryByRole('checkbox', { name: /Question perso/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Mécanique/ }));
    expect(
      await screen.findByRole('checkbox', { name: /Question perso/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mes Quizz' }));
    expect(
      screen.queryByRole('checkbox', { name: /Question perso/ }),
    ).not.toBeInTheDocument();
  });

  it('crée un quizz depuis la vue Dossiers', async () => {
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(screen.getByRole('button', { name: 'Dossiers' }));
    await user.type(
      screen.getByPlaceholderText('Nouveau quizz'),
      'Cinématique',
    );
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() => expect(saveQuizz).toHaveBeenCalledTimes(1));
    const createdCourse = saveQuizz.mock.calls[0]?.[1] as Quizz;
    expect(createdCourse.title).toBe('Cinématique');
  });

  it('valide en masse les brouillons sélectionnés', async () => {
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
      await screen.findByRole('checkbox', { name: 'Tout sélectionner' }),
    );
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(2));
    expect(
      saveQuestion.mock.calls.every((call) => call[1].validated === true),
    ).toBe(true);
  });

  it('déplace une seule question depuis l’aperçu', async () => {
    snapshot = {
      ...snapshot,
      questions: [
        question({ id: 'private-1', prompt: [{ kind: 'text', value: 'Un' }] }),
      ],
      quizzes: [
        {
          id: 'course-y',
          ownerId: 'user-1',
          title: 'Cours Y',
          description: '',
          visibility: 'private' as const,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(await screen.findByRole('button', { name: /^Un/ }));
    await user.selectOptions(
      screen.getByLabelText('Déplacer vers'),
      'course-y',
    );
    await user.click(screen.getByRole('button', { name: 'Déplacer' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(1));
    const saved = saveQuestion.mock.calls.at(-1)?.[1] as Question;
    expect(saved.classification).toMatchObject({
      kind: 'personal',
      courseId: 'course-y',
    });
  });

  it('n’interrompt pas une action groupée si une question échoue, et le signale', async () => {
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
    saveQuestion.mockImplementationOnce(() =>
      Promise.reject(new Error('Échec réseau simulé')),
    );
    const user = userEvent.setup();
    render(<QuestionsPage />);
    await user.click(
      await screen.findByRole('checkbox', { name: 'Tout sélectionner' }),
    );
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText('private-1 — Échec réseau simulé'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('toolbar', { name: 'Actions groupées' }),
    ).not.toBeInTheDocument();
  });
});
