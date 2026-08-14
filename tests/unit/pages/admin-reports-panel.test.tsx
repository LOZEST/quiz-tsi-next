import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QuestionReport } from '@domain/questions/QuestionReport';

const reports: QuestionReport[] = [
  {
    id: 'r1',
    questionId: 'question-open',
    questionVersion: 1,
    reporterId: 'u1',
    reporterEmail: 'user1@example.test',
    reason: 'math_rendering',
    comment: 'La formule ne s’affiche pas.',
    status: 'open',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'r2',
    questionId: 'question-in-progress',
    questionVersion: 2,
    reporterId: 'u2',
    reporterEmail: 'user2@example.test',
    reason: 'hint_unclear',
    comment: null,
    status: 'in_progress',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

const listReports = vi.fn(() => Promise.resolve(reports));
const setReportStatus = vi.fn(() => Promise.resolve());

vi.mock('@app/providers/AuthProvider', () => ({
  useAuth: () => ({
    state: {
      status: 'authenticated',
      session: { user: { id: 'owner-1', role: 'owner' } },
    },
  }),
}));
vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    questionWorkspaceRepository: {
      load: () =>
        Promise.resolve({
          questions: [],
          courses: [],
          chapters: [],
          notions: [],
          pendingOperationCount: 0,
          conflicts: [],
        }),
      saveQuestion: () => Promise.resolve(),
    },
    accountManagementGateway: {
      listAccounts: () => Promise.resolve([]),
      setAccountRole: () => Promise.resolve(),
    },
    questionReportGateway: { listReports, setReportStatus },
  }),
}));

import { AdminPage } from '@pages/AdminPage/AdminPage';

describe('AdminPage reports panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listReports.mockResolvedValue(reports);
  });

  it('filters reports by status', async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('question-open'.slice(0, 8) + ' · v1');
    expect(screen.getByText('question-in-progress'.slice(0, 8) + ' · v2')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('Filtrer par statut'),
      'in_progress',
    );

    expect(
      screen.queryByText('question-open'.slice(0, 8) + ' · v1'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('question-in-progress'.slice(0, 8) + ' · v2'),
    ).toBeInTheDocument();
  });

  it('lets an admin move a report to in_progress', async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('question-open'.slice(0, 8) + ' · v1');
    const select = screen.getByLabelText('Statut du signalement r1');
    await user.selectOptions(select, 'in_progress');
    await waitFor(() =>
      expect(setReportStatus).toHaveBeenCalledWith('r1', 'in_progress'),
    );
  });

  it('copies the filtered reports for pasting into an AI tool', async () => {
    const user = userEvent.setup();
    render(<AdminPage />);
    await screen.findByText('question-open'.slice(0, 8) + ' · v1');
    await user.click(screen.getByRole('button', { name: 'Copier pour l’IA' }));
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).not.toBe(''),
    );
    const copiedText = await navigator.clipboard.readText();
    expect(copiedText).toContain('question-open');
    expect(copiedText).toContain('question-in-progress');
    expect(copiedText).toContain('La formule ne s’affiche pas.');
    expect(
      await screen.findByText('Copié dans le presse-papiers.'),
    ).toBeInTheDocument();
  });
});
