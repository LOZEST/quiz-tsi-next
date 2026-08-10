import type { QuestionRemoteGateway } from '@domain/repositories/QuestionRemoteGateway';
import type { QuestionWorkspaceRepository } from '@domain/repositories/QuestionWorkspaceRepository';

export async function syncQuestionWorkspace(
  userId: string,
  local: QuestionWorkspaceRepository,
  remote: QuestionRemoteGateway,
) {
  const operations = (await local.listOutbox(userId)).slice(0, 50);
  let permissionDenied = false;
  for (const operation of operations) {
    const result = await remote.push(operation);
    if (result.kind === 'accepted')
      await local.completeOperation(userId, operation.operationId);
    else if (result.kind === 'permission-denied') permissionDenied = true;
    else
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
  await local.applyRemoteQuestions(
    userId,
    await remote.pullRecent(userId, 100),
  );
  return { pushed: operations.length, permissionDenied };
}
