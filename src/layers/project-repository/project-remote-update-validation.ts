import { z } from 'zod';
import { isEncodedProjectCrdtUpdate } from '../project-crdt/project-crdt-update-codec';
import { ProjectRepositoryError, ProjectRepositoryErrorCode } from './errors';
import type { RemoteProjectCrdtUpdate } from './i-project-repository';

const RemoteProjectCrdtUpdateSchema = z.strictObject({
  operationId: z.uuid(),
  sequenceId: z.number().int().positive().safe(),
  updateBase64: z.string().refine(isEncodedProjectCrdtUpdate),
});

export function validateRemoteProjectId(projectId: string): string {
  const result = z.uuid().safeParse(projectId);
  if (result.success) {
    return result.data;
  }
  throw createInvalidRemoteUpdateError('원격 update의 Project ID가 유효하지 않습니다.', result.error);
}

export function validateAndSortRemoteProjectUpdates(
  updates: readonly RemoteProjectCrdtUpdate[]
): readonly RemoteProjectCrdtUpdate[] {
  const result = z.array(RemoteProjectCrdtUpdateSchema).safeParse(updates);
  if (!result.success) {
    throw createInvalidRemoteUpdateError('원격 CRDT update 형식이 유효하지 않습니다.', result.error);
  }

  const sequenceIds = new Set<number>();
  result.data.forEach(update => {
    if (sequenceIds.has(update.sequenceId)) {
      throw createInvalidRemoteUpdateError(`원격 CRDT sequence가 중복됐습니다: ${update.sequenceId}`);
    }
    sequenceIds.add(update.sequenceId);
  });
  return [...result.data].sort((left, right) => left.sequenceId - right.sequenceId);
}

function createInvalidRemoteUpdateError(message: string, cause?: unknown): ProjectRepositoryError {
  return new ProjectRepositoryError({
    code: ProjectRepositoryErrorCode.INVALID_REMOTE_UPDATE,
    message,
    cause,
  });
}
