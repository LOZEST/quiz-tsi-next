import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
    kind: 'personal',
    courseId: 'course-mecanique',
    chapter: null,
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

const quizz = (overrides: Partial<Quizz> = {}): Quizz => ({
  id: 'course-mecanique',
  ownerId: 'user-1',
  title: 'Mécanique',
  description: '',
  visibility: 'private',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

let snapshot: QuestionWorkspaceSnapshot;
let currentRole: 'user' | 'admin' | 'owner' = 'owner';
let currentDisplayName: string | undefined;
const load = vi.fn(() =>
  // Mirrors IndexedDbQuestionWorkspaceRepository.load(), which filters
  // soft-deleted quizzes out of the snapshot.
  Promise.resolve({
    ...snapshot,
    quizzes: snapshot.quizzes.filter((item) => !item.deletedAt),
  }),
);
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
  (_userId: string, next: Question, course: Quizz | null) => {
    snapshot = {
      ...snapshot,
      questions: [...snapshot.questions, next],
      quizzes: course ? [...snapshot.quizzes, course] : snapshot.quizzes,
      pendingOperationCount: snapshot.pendingOperationCount + 1,
    };
    return Promise.resolve();
  },
);
const listOutbox = vi.fn(() => Promise.resolve([]));
const saveQuizz = vi.fn((_userId: string, course: Quizz) => {
  snapshot = {
    ...snapshot,
    quizzes: [
      ...snapshot.quizzes.filter((item) => item.id !== course.id),
      course,
    ],
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
const publishQuizz = vi.fn(() => Promise.resolve());
const setOwnListingHidden = vi.fn(() => Promise.resolve());

vi.mock('@app/providers/AuthProvider', () => ({
  useAuth: () => ({
    state: {
      status: 'authenticated',
      session: {
        user: {
          id: 'user-1',
          role: currentRole,
          displayName: currentDisplayName,
        },
      },
    },
  }),
}));
vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    questionWorkspaceRepository,
    questionRemoteGateway,
    programIndex: null,
    quizzMarketplaceGateway: {
      listSubscribedQuizzContent: () => Promise.resolve([]),
      publishQuizz,
      setOwnListingHidden,
    },
    refreshQuestionRepositoryForUser,
  }),
}));

import { QuestionsPage } from '@pages/QuestionsPage/QuestionsPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <QuestionsPage />
    </MemoryRouter>,
  );
}

describe('QuestionsPage', () => {
  beforeEach(() => {
    currentRole = 'owner';
    currentDisplayName = undefined;
    snapshot = {
      questions: [],
      quizzes: [],
      pendingOperationCount: 0,
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

  it('crée un quizz depuis la page Mes Quizz', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: /Ajoute un quizz/ }),
    );
    await user.type(
      await screen.findByPlaceholderText('Nouveau quizz'),
      'Cinématique',
    );
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() => expect(saveQuizz).toHaveBeenCalledTimes(1));
    const createdCourse = saveQuizz.mock.calls[0]?.[1] as Quizz;
    expect(createdCourse.title).toBe('Cinématique');
    expect(createdCourse.deletedAt).toBeNull();
  });

  it('n’affiche que les questions du quizz dont on a ouvert le dossier', async () => {
    snapshot = {
      ...snapshot,
      quizzes: [quizz()],
      questions: [
        question({
          id: 'private-1',
          prompt: [{ kind: 'text', value: 'Question perso' }],
        }),
      ],
    };
    const user = userEvent.setup();
    renderPage();
    expect(
      screen.queryByRole('button', { name: 'Question perso' }),
    ).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    expect(
      await screen.findByRole('button', { name: 'Question perso' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mes Quizz' }));
    expect(
      screen.queryByRole('button', { name: 'Question perso' }),
    ).not.toBeInTheDocument();
  });

  it('filtre les quizz affichés à la racine par leur titre', async () => {
    snapshot = {
      ...snapshot,
      quizzes: [
        quizz({ id: 'c1', title: 'Mécanique' }),
        quizz({ id: 'c2', title: 'Électricité' }),
      ],
    };
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: /Mécanique/ });
    await user.click(screen.getByRole('button', { name: 'Filtrer' }));
    await user.type(screen.getByLabelText('Recherche'), 'élec');
    expect(
      screen.queryByRole('button', { name: /Mécanique/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Électricité/ }),
    ).toBeInTheDocument();
  });

  it('publie et dépublie un quizz via le switch public/privé', async () => {
    snapshot = {
      ...snapshot,
      quizzes: [quizz({ description: 'Les bases' })],
    };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('checkbox', { name: 'Privé' }));
    await waitFor(() =>
      expect(publishQuizz).toHaveBeenCalledWith({
        quizzId: 'course-mecanique',
        title: 'Mécanique',
        description: 'Les bases',
      }),
    );
    await user.click(await screen.findByRole('checkbox', { name: 'Public' }));
    await waitFor(() =>
      expect(setOwnListingHidden).toHaveBeenCalledWith(
        'course-mecanique',
        true,
      ),
    );
  });

  it('affiche un rappel pour ajouter un nom affiché en publiant sans profil renseigné', async () => {
    currentDisplayName = undefined;
    snapshot = { ...snapshot, quizzes: [quizz({ description: 'Les bases' })] };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('checkbox', { name: 'Privé' }));
    expect(
      await screen.findByText(/Ton profil n’a pas de nom affiché/),
    ).toBeInTheDocument();
  });

  it('n’affiche pas de rappel quand le profil a déjà un nom affiché', async () => {
    currentDisplayName = 'lucien';
    snapshot = { ...snapshot, quizzes: [quizz({ description: 'Les bases' })] };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('checkbox', { name: 'Privé' }));
    await waitFor(() => expect(publishQuizz).toHaveBeenCalled());
    expect(
      screen.queryByText(/Ton profil n’a pas de nom affiché/),
    ).not.toBeInTheDocument();
  });

  it('signale une erreur quand la publication marketplace échoue, puis efface l’erreur une fois la synchronisation réussie', async () => {
    publishQuizz.mockRejectedValueOnce(new Error('denied'));
    snapshot = { ...snapshot, quizzes: [quizz()] };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('checkbox', { name: 'Privé' }));
    expect(
      await screen.findByText(
        'La mise à jour de la visibilité sur la marketplace a échoué.',
      ),
    ).toBeInTheDocument();

    await user.click(await screen.findByRole('checkbox', { name: 'Public' }));
    await waitFor(() =>
      expect(
        screen.queryByText(
          'La mise à jour de la visibilité sur la marketplace a échoué.',
        ),
      ).not.toBeInTheDocument(),
    );
  });

  it('modifie le nom et la description d’un quizz', async () => {
    snapshot = { ...snapshot, quizzes: [quizz({ description: '' })] };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    const titleInput = screen.getByLabelText('Nom du quizz');
    await user.clear(titleInput);
    await user.type(titleInput, 'Mécanique du point');
    await user.type(
      screen.getByLabelText('Description'),
      'Cinématique et dynamique',
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(saveQuizz).toHaveBeenCalled());
    const saved = saveQuizz.mock.calls.at(-1)?.[1] as Quizz;
    expect(saved.title).toBe('Mécanique du point');
    expect(saved.description).toBe('Cinématique et dynamique');
  });

  it('republie un quizz déjà public dès que son titre change', async () => {
    snapshot = {
      ...snapshot,
      quizzes: [quizz({ visibility: 'public' })],
    };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    const titleInput = screen.getByLabelText('Nom du quizz');
    await user.clear(titleInput);
    await user.type(titleInput, 'Mécanique du point');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(publishQuizz).toHaveBeenCalledWith({
        quizzId: 'course-mecanique',
        title: 'Mécanique du point',
        description: '',
      }),
    );
  });

  it('supprime un quizz, archive ses questions et revient à la racine', async () => {
    snapshot = {
      ...snapshot,
      quizzes: [quizz({ visibility: 'public' })],
      questions: [question({ id: 'private-1' })],
    };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    await user.click(
      screen.getByRole('button', { name: 'Supprimer le quizz' }),
    );
    await waitFor(() =>
      expect(setOwnListingHidden).toHaveBeenCalledWith(
        'course-mecanique',
        true,
      ),
    );
    const archivedQuestion = saveQuestion.mock.calls.find(
      (call) => call[1].id === 'private-1',
    )?.[1] as Question;
    expect(archivedQuestion.status).toBe('archived');
    const deletedQuizz = saveQuizz.mock.calls.at(-1)?.[1] as Quizz;
    expect(deletedQuizz.deletedAt).not.toBeNull();
    expect(
      screen.queryByRole('button', { name: /Mécanique/ }),
    ).not.toBeInTheDocument();
  });

  it('répartit les questions du quizz entre validées et à valider, avec les actions attendues', async () => {
    snapshot = {
      ...snapshot,
      quizzes: [quizz()],
      questions: [
        question({
          id: 'validated-1',
          validated: true,
          status: 'published',
          prompt: [{ kind: 'text', value: 'Question validée' }],
        }),
        question({
          id: 'pending-1',
          validated: false,
          status: 'draft',
          prompt: [{ kind: 'text', value: 'Question en attente' }],
        }),
      ],
    };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    const validatedColumn = screen.getByRole('region', {
      name: 'question valider',
    });
    const toValidateColumn = screen.getByRole('region', {
      name: 'question a valider',
    });
    expect(
      within(validatedColumn).getByRole('button', {
        name: 'Question validée',
      }),
    ).toBeInTheDocument();
    expect(
      within(toValidateColumn).getByRole('button', {
        name: 'Question en attente',
      }),
    ).toBeInTheDocument();

    await user.click(
      within(toValidateColumn).getByRole('button', {
        name: 'Question en attente',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'valider' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalled());
    expect((saveQuestion.mock.calls.at(-1)?.[1] as Question).validated).toBe(
      true,
    );
  });

  it('supprime une question depuis le panneau détail', async () => {
    snapshot = {
      ...snapshot,
      quizzes: [quizz()],
      questions: [
        question({
          id: 'pending-1',
          prompt: [{ kind: 'text', value: 'Question en attente' }],
        }),
      ],
    };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    await user.click(
      screen.getByRole('button', { name: 'Question en attente' }),
    );
    await user.click(screen.getByRole('button', { name: 'suprimer' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalled());
    expect((saveQuestion.mock.calls.at(-1)?.[1] as Question).status).toBe(
      'archived',
    );
  });

  it('propose d’ajouter une question via GPT ou manuellement depuis le panneau du quizz', async () => {
    snapshot = { ...snapshot, quizzes: [quizz()] };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    const gptLink = screen.getByRole('link', {
      name: 'ajouter une question avec GPT',
    });
    expect(gptLink).toHaveAttribute(
      'href',
      'https://chatgpt.com/g/quiz-tsi-import',
    );
    expect(gptLink).toHaveAttribute('target', '_blank');
    expect(gptLink.getAttribute('rel')?.split(' ')).toEqual(
      expect.arrayContaining(['noopener', 'noreferrer']),
    );
    await user.click(
      screen.getByRole('button', { name: 'ajouter une question a la mains' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Nouvelle question' }),
    ).toBeVisible();
  });

  it('ne rend aucun lien GPT lorsque la configuration est dangereuse', async () => {
    vi.stubEnv('VITE_CHATGPT_IMPORT_GPT_URL', 'javascript:alert(1)');
    snapshot = { ...snapshot, quizzes: [quizz()] };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    expect(
      screen.queryByRole('link', { name: 'ajouter une question avec GPT' }),
    ).not.toBeInTheDocument();
  });

  it('crée une question personnelle avec un chapitre en texte libre, déjà rattachée au quizz ouvert', async () => {
    snapshot = { ...snapshot, quizzes: [quizz()] };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    await user.click(
      screen.getByRole('button', { name: 'ajouter une question a la mains' }),
    );
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
      courseId: 'course-mecanique',
      chapter: 'B',
    });
  });

  it('crée et édite les segments structurés et les aides mathématiques', async () => {
    snapshot = { ...snapshot, quizzes: [quizz()] };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    await user.click(
      screen.getByRole('button', { name: 'ajouter une question a la mains' }),
    );
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
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledTimes(1));
    const savedQuestion = saveQuestion.mock.calls[0]?.[1] as Question;
    expect(savedQuestion.classification).toMatchObject({
      chapter: 'Chapitre 1',
    });
  }, 10_000);

  it('affiche une erreur si le stockage local est inaccessible', async () => {
    load.mockRejectedValueOnce('stockage');
    renderPage();
    expect(
      await screen.findByText('Stockage local inaccessible.'),
    ).toBeInTheDocument();
  });

  it('applique quand même les changements distants malgré des lignes rejetées', async () => {
    questionRemoteGateway.pullRecent.mockResolvedValueOnce({
      questions: [],
      quizzes: [],
      rejectedRows: [
        { index: 0, message: 'Question distante invalide : provenance.' },
      ],
    });
    renderPage();
    await waitFor(() =>
      expect(
        questionWorkspaceRepository.applyRemoteWorkspace,
      ).toHaveBeenCalled(),
    );
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
    snapshot = { ...snapshot, quizzes: [quizz()], questions: [structured] };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    await user.click(screen.getByRole('button', { name: /Calculer la somme/ }));
    await user.click(screen.getByRole('button', { name: /ennoncer/ }));
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
    snapshot = { ...snapshot, quizzes: [quizz()] };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    await user.click(
      screen.getByRole('button', { name: 'ajouter une question a la mains' }),
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

  it('présente un import incomplet et laisse choisir en cas de conflit', async () => {
    const imported = question({
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
      quizzes: [quizz()],
      questions: [imported],
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
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Mécanique/ }));
    await user.click(screen.getByRole('button', { name: /Calculer la somme/ }));
    expect(screen.getByText(/Analyse incomplète/)).toBeInTheDocument();
    expect(screen.getByText(/Schéma illisible/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'valider' }));
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
});
