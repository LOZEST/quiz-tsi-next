import type { QuestionRemoteGateway } from '@domain/repositories/QuestionRemoteGateway';
import type { QuestionWorkspaceRepository } from '@domain/repositories/QuestionWorkspaceRepository';

export async function syncQuestionWorkspace(
  userId: string,
  local: QuestionWorkspaceRepository,
  remote: QuestionRemoteGateway,
) {
  const priority = { quizz: 0, question: 1 } as const;
  const operations = [...(await local.listOutbox(userId))]
    .sort(
      (left, right) =>
        priority[left.entity] - priority[right.entity] ||
        left.createdAt.localeCompare(right.createdAt),
    )
    .slice(0, 50);
  let permissionDenied = false;
  let taxonomyConflict = false;
  const rejectedPushes: { index: number; message: string }[] = [];
  for (const operation of operations) {
    const result = await remote.push(operation);
    if (result.kind === 'accepted')
      await local.completeOperation(userId, operation.operationId);
    else if (result.kind === 'permission-denied') permissionDenied = true;
    else if (result.kind === 'taxonomy-conflict') taxonomyConflict = true;
    else if (result.kind === 'remote-row-invalid')
      // Left queued for a later retry, same as a conflict or a denied
      // permission — but unlike those, we have no valid `remote` question to
      // record, so this can't go through recordConflict. Collecting it here
      // (rather than throwing) keeps this one broken entity from blocking
      // every other pending push in the batch, or the pull below.
      rejectedPushes.push({ index: -1, message: result.message });
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
    rejectedRemoteRows: [...rejectedPushes, ...pulled.rejectedRows],
  };
}
