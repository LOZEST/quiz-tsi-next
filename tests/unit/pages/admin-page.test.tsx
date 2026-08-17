import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@domain/questions/Question';
import type { QuestionWorkspaceSnapshot } from '@domain/repositories/QuestionWorkspaceRepository';
import type { ManagedAccount } from '@domain/account/AccountManagementGateway';

const sharedQuestion: Question = {
  id: 'shared-1',
  version: 1,
  source: 'shared',
  ownerId: 'admin-1',
  status: 'published',
  validated: true,
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
  prompt: [{ kind: 'text', value: 'Question partagée' }],
  hint: [],
  correction: [
    { id: 'step-1', title: null, content: [{ kind: 'text', value: 'R' }] },
  ],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const accounts: ManagedAccount[] = [
  {
    userId: 'owner-1',
    email: 'owner@example.test',
    displayName: 'Owner',
    role: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    userId: 'user-1',
    email: 'user@example.test',
    displayName: null,
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

let snapshot: QuestionWorkspaceSnapshot;
let currentRole: 'admin' | 'owner' = 'owner';
const load = vi.fn(() => Promise.resolve(snapshot));
const saveQuestion = vi.fn(() => Promise.resolve());
const listAccounts = vi.fn(() => Promise.resolve(accounts));
const setAccountRole = vi.fn(() => Promise.resolve());
const listReports = vi.fn(() => Promise.resolve([]));
const setReportStatus = vi.fn(() => Promise.resolve());
const adminListListings = vi.fn(() => Promise.resolve([]));
const adminSetCertified = vi.fn(() => Promise.resolve());
const adminSetHidden = vi.fn(() => Promise.resolve());

vi.mock('@app/providers/AuthProvider', () => ({
  useAuth: () => ({
    state: {
      status: 'authenticated',
      session: { user: { id: 'owner-1', role: currentRole } },
    },
  }),
}));
vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    questionWorkspaceRepository: { load, saveQuestion },
    accountManagementGateway: { listAccounts, setAccountRole },
    questionReportGateway: { listReports, setReportStatus },
    quizzMarketplaceGateway: {
      adminListListings,
      adminSetCertified,
      adminSetHidden,
    },
  }),
}));

import { AdminPage } from '@pages/AdminPage/AdminPage';

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAccounts.mockResolvedValue(accounts);
    currentRole = 'owner';
    snapshot = {
      questions: [sharedQuestion],
      quizzes: [],
      pendingOperationCount: 0,
      conflicts: [],
    };
  });

  it('lists accounts and lets the owner change a role', async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('user@example.test');
    const select = screen.getByLabelText('Rôle de user@example.test');
    await user.selectOptions(select, 'admin');
    await waitFor(() =>
      expect(setAccountRole).toHaveBeenCalledWith('user-1', 'admin'),
    );
  });

  it('hides role controls for admins', async () => {
    currentRole = 'admin';
    render(<AdminPage />);
    await screen.findByText('user@example.test');
    expect(
      screen.queryByLabelText('Rôle de user@example.test'),
    ).not.toBeInTheDocument();
  });

  it('lists shared questions and archives one', async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('Question partagée');
    await user.click(screen.getByRole('button', { name: 'Archiver' }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledOnce());
    const call = saveQuestion.mock.calls[0] as unknown as [
      string,
      Question,
      string,
      string,
    ];
    expect(call[2]).toBe('archive');
    expect(call[1].status).toBe('archived');
  });

  it('shows an error when accounts fail to load', async () => {
    listAccounts.mockRejectedValue(new Error('nope'));
    render(<AdminPage />);
    expect(
      await screen.findByText('La liste des comptes n’a pas pu être chargée.'),
    ).toBeInTheDocument();
  });
});
