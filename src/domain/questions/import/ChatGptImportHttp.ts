import type { ImportReportV1 } from './ChatGptQuestionImport.ts';

export const importReportHttpStatus = (report: Readonly<ImportReportV1>) =>
  report.accepted.length === 0 ? 422 : 200;
