import type {
  QuestionReport,
  QuestionReportStatus,
} from '@domain/questions/QuestionReport';
import type {
  QuestionReportGateway,
  QuestionReportSubmission,
} from '@domain/questions/QuestionReportGateway';
import { isUserRole, type UserRole } from '@domain/auth/UserRole';

const SESSION_KEY = 'qtsi-controlled-auth-session';
const REPORTS_KEY = 'qtsi-controlled-question-reports';

function currentIdentity(): { userId: string; email: string; role: UserRole } {
  const stored = sessionStorage.getItem(SESSION_KEY);
  const email = stored
    ? (() => {
        try {
          return (JSON.parse(stored) as { email: string }).email;
        } catch {
          return stored;
        }
      })()
    : 'user@example.test';
  const roleValue = email.split('@')[0];
  const role: UserRole = isUserRole(roleValue) ? roleValue : 'user';
  return { userId: `controlled-${role}`, email, role };
}

function readReports(): QuestionReport[] {
  const stored = sessionStorage.getItem(REPORTS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as QuestionReport[];
  } catch {
    return [];
  }
}

function writeReports(reports: readonly QuestionReport[]): void {
  sessionStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

/**
 * Deterministic browser-test boundary mirroring ControlledAccountManagementGateway.
 * Selected only by the Playwright preview's VITE_AUTH_ADAPTER=controlled flag.
 */
export class ControlledQuestionReportGateway implements QuestionReportGateway {
  submitReport(submission: QuestionReportSubmission): Promise<void> {
    const identity = currentIdentity();
    const report: QuestionReport = {
      id: crypto.randomUUID(),
      questionId: submission.questionId,
      questionVersion: submission.questionVersion,
      reporterId: identity.userId,
      reporterEmail: identity.email,
      reason: submission.reason,
      comment: submission.comment,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    writeReports([report, ...readReports()]);
    return Promise.resolve();
  }

  listReports(): Promise<readonly QuestionReport[]> {
    const identity = currentIdentity();
    if (identity.role === 'user') {
      return Promise.reject(
        new Error('Seuls les administrateurs consultent les signalements.'),
      );
    }
    return Promise.resolve(readReports());
  }

  setReportStatus(
    reportId: string,
    status: QuestionReportStatus,
  ): Promise<void> {
    const identity = currentIdentity();
    if (identity.role === 'user') {
      return Promise.reject(
        new Error('Seuls les administrateurs modifient les signalements.'),
      );
    }
    writeReports(
      readReports().map((report) =>
        report.id === reportId ? { ...report, status } : report,
      ),
    );
    return Promise.resolve();
  }
}
