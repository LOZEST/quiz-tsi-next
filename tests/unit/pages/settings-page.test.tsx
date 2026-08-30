import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@domain/questions/Question';
import type { QuestionWorkspaceSnapshot } from '@domain/repositories/QuestionWorkspaceRepository';

const question: Question = {
  id: 'shared-1',
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
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

let snapshot: QuestionWorkspaceSnapshot;
const load = vi.fn(() => Promise.resolve(snapshot));
const saveQuestion = vi.fn(() => Promise.resolve());
const syncQuestionWorkspaceForUser = vi.fn(() =>
  Promise.resolve({ ok: true as const }),
);

vi.mock('@app/providers/AuthProvider', () => ({
  useAuth: () => ({
    state: {
      status: 'authenticated',
      session: { user: { id: 'user-1', role: 'user' } },
    },
  }),
}));
vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    questionWorkspaceRepository: { load, saveQuestion },
    syncQuestionWorkspaceForUser,
  }),
}));

import { SettingsPage } from '@pages/SettingsPage/SettingsPage';
import { WhiteboardProvider } from '@app/providers/WhiteboardProvider';

function renderSettings() {
  return render(
    <WhiteboardProvider>
      <SettingsPage />
    </WhiteboardProvider>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshot = {
      questions: [question],
      quizzes: [],
      pendingOperationCount: 2,
      conflicts: [
        {
          id: 'conflict-1',
          userId: 'user-1',
          entityId: question.id,
          operationId: 'op-1',
          local: question,
          remote: question,
          detectedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    };
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('shows local data counts, pending sync and conflicts', async () => {
    renderSettings();
    await user_openDisclosures();
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(screen.getByText('2 opération(s) en attente.')).toBeInTheDocument();
    expect(screen.getByText(/Conflit sur la question/)).toBeInTheDocument();
  });

  it('reflects offline status', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    renderSettings();
    await user_openDisclosures();
    expect(screen.getAllByText('Hors connexion').length).toBeGreaterThan(0);
  });

  it('exports a backup as a downloadable file', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    renderSettings();
    await user_openDisclosures();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Exporter mes données' }),
      ).not.toBeDisabled(),
    );
    await user.click(
      screen.getByRole('button', { name: 'Exporter mes données' }),
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(
      await screen.findByText('Sauvegarde téléchargée.'),
    ).toBeInTheDocument();
  });

  it('modifie les réglages Apple Pencil (épaisseur, grille, formes, gomme, main)', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user_openDisclosures();
    await user.click(
      screen.getByRole('checkbox', { name: 'Afficher la grille' }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'Formes magiques' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'Effacer en griffonnant' }),
    );
    await user.click(screen.getByRole('radio', { name: 'Pixel' }));
    await user.click(screen.getByRole('radio', { name: 'Gaucher' }));
    expect(screen.getByRole('radio', { name: 'Gaucher' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Pixel' })).toBeChecked();
  });

  it('restaure une sauvegarde valide et signale les questions rejetées', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user_openDisclosures();
    const input = screen.getByLabelText('Restaurer une sauvegarde');
    const file = new File(
      [
        JSON.stringify({
          questions: [question, { invalid: true }],
        }),
      ],
      'backup.json',
      { type: 'application/json' },
    );
    await user.upload(input, file);
    expect(
      await screen.findByText(
        '1 question(s) restaurée(s), 1 rejetée(s) car invalide(s).',
      ),
    ).toBeInTheDocument();
    expect(saveQuestion).toHaveBeenCalledTimes(1);
  });

  it('restaure une sauvegarde entièrement valide sans mention de rejet', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user_openDisclosures();
    const input = screen.getByLabelText('Restaurer une sauvegarde');
    const file = new File(
      [JSON.stringify({ questions: [question] })],
      'backup.json',
      { type: 'application/json' },
    );
    await user.upload(input, file);
    expect(
      await screen.findByText('1 question(s) restaurée(s).'),
    ).toBeInTheDocument();
  });

  it('signale un fichier de sauvegarde invalide', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user_openDisclosures();
    const input = screen.getByLabelText('Restaurer une sauvegarde');
    const file = new File(['not json'], 'backup.json', {
      type: 'application/json',
    });
    await user.upload(input, file);
    expect(
      await screen.findByText('Le fichier de sauvegarde est invalide.'),
    ).toBeInTheDocument();
  });

  async function user_openDisclosures() {
    const user = userEvent.setup();
    for (const label of [
      'Apple Pencil',
      'Données locales',
      'Synchronisation',
      'Sauvegardes',
      'Hors connexion',
    ]) {
      await user.click(screen.getByRole('button', { name: label }));
    }
  }
});
