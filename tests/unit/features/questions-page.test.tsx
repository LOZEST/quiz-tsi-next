import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@domain/questions/Question';
import type { QuestionWorkspaceSnapshot } from '@domain/repositories/QuestionWorkspaceRepository';

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
const load = vi.fn(() => Promise.resolve(snapshot));
const saveQuestion = vi.fn((_userId, next: Question) => {
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
const listOutbox = vi.fn(() => Promise.resolve([]));
const questionWorkspaceRepository = {
  load,
  saveQuestion,
  resolveConflict,
  listOutbox,
  completeOperation: vi.fn(() => Promise.resolve()),
  applyRemoteQuestion: vi.fn(() => Promise.resolve()),
  recordConflict: vi.fn(() => Promise.resolve()),
  savePersonalCourse: vi.fn(() => Promise.resolve()),
  savePersonalChapter: vi.fn(() => Promise.resolve()),
  savePersonalNotion: vi.fn(() => Promise.resolve()),
};
const questionRemoteGateway = {
  push: vi.fn(() => Promise.resolve({ kind: 'accepted' as const })),
  pullRecent: vi.fn(() => Promise.resolve([])),
};

vi.mock('@app/providers/AuthProvider', () => ({
  useAuth: () => ({
    state: { status: 'authenticated', session: { user: { id: 'user-1' } } },
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
    await user.type(screen.getByLabelText('Texte'), 'Une nouvelle question');
    await user.click(screen.getByRole('button', { name: '+ Formule' }));
    const formula = screen.getByRole('textbox', { name: /Formule en ligne/ });
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
      screen.getByRole('button', { name: '+ Formule affichée' }),
    );
    await user.click(screen.getByRole('button', { name: '+ Saut de ligne' }));
    await user.type(screen.getByLabelText('Indice'), 'Un indice');
    await user.type(screen.getByLabelText('Correction'), 'Une correction');
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
    await waitFor(() => expect(saveQuestion).toHaveBeenCalled());
  });

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
});
