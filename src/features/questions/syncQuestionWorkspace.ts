import type { QuestionRemoteGateway } from '@domain/repositories/QuestionRemoteGateway';
import type {
  QuestionWorkspaceOutboxOperation,
  QuestionWorkspaceRepository,
} from '@domain/repositories/QuestionWorkspaceRepository';

const priority = { course: 0, chapter: 1, notion: 2, question: 3 } as const;
// Deletes must land strictly after every create/update in the same batch:
// deleting a quizz first would strand its (still-syncing) question archives
// behind a classification that no longer exists remotely. Among deletes,
// leaves go first (reverse hierarchy) so a course delete is always last.
const rank = (operation: QuestionWorkspaceOutboxOperation): number =>
  operation.kind === 'delete'
    ? 100 - priority[operation.entity]
    : priority[operation.entity];

export async function syncQuestionWorkspace(
  userId: string,
  local: QuestionWorkspaceRepository,
  remote: QuestionRemoteGateway,
) {
  const operations = [...(await local.listOutbox(userId))]
    .sort(
      (left, right) =>
        rank(left) - rank(right) ||
        left.createdAt.localeCompare(right.createdAt),
    )
    .slice(0, 50);
  let permissionDenied = false;
  let taxonomyConflict = false;
  for (const operation of operations) {
    const result = await remote.push(operation);
    if (result.kind === 'accepted')
      await local.completeOperation(userId, operation.operationId);
    else if (result.kind === 'permission-denied') permissionDenied = true;
    else if (result.kind === 'taxonomy-conflict') taxonomyConflict = true;
    else if (operation.entity === 'question')
      await local.recordConflict(userId, {
        id: crypto.randomUUID(),
        userId,
        entityId: operation.entityId,
        operationId: operation.operationId,
        local: operation.payload,
        remote: result.remote,
        detectedAt: new Date().toISOString(),
      });
  }
  const pulled = await remote.pullRecent(userId, 100);
  await local.applyRemoteWorkspace(userId, pulled);
  return {
    pushed: operations.length,
    permissionDenied,
    taxonomyConflict,
    rejectedRemoteRows: pulled.rejectedRows,
  };
}
