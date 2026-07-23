import type { ProjectDocumentSnapshot } from '../shared/types/project-document.schema';
import {
  ProjectDocumentReadError,
  ProjectDocumentReadErrorCode,
  readProjectDocumentSnapshot,
} from '../shared/types/project-document-reader';
import { ProjectRepositoryError, ProjectRepositoryErrorCode } from './errors';

interface RevisionConflictContext {
  readonly projectId: string;
  readonly expectedRevision: number;
  readonly documentRevision: number;
  readonly storedRevision: number;
}

interface ReadStoredProjectDocumentOptions {
  readonly document: unknown;
  readonly projectId: string;
}

export function cloneAndValidateProjectDocument(document: ProjectDocumentSnapshot): ProjectDocumentSnapshot {
  try {
    return readProjectDocumentSnapshot(document);
  } catch (cause) {
    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.INVALID_DOCUMENT,
      message: '유효하지 않은 ProjectDocument입니다.',
      cause,
    });
  }
}

export function readStoredProjectDocument({
  document,
  projectId,
}: ReadStoredProjectDocumentOptions): ProjectDocumentSnapshot {
  try {
    return readProjectDocumentSnapshot(document);
  } catch (cause) {
    throwStoredProjectDocumentReadError(cause, projectId);
  }
}

export function throwStoredProjectDocumentReadError(cause: unknown, projectId: string): never {
  const readError = getProjectDocumentReadError(cause);
  if (!readError) {
    throw cause;
  }

  if (readError.code === ProjectDocumentReadErrorCode.UNSUPPORTED_SCHEMA_VERSION) {
    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.UNSUPPORTED_STORED_DOCUMENT_SCHEMA_VERSION,
      message: `현재 앱에서 지원하지 않는 저장 문서 schemaVersion입니다: ${projectId}`,
      details: { projectId, schemaVersion: readError.details?.schemaVersion },
      cause,
    });
  }

  throw new ProjectRepositoryError({
    code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
    message: `저장된 프로젝트 문서가 유효하지 않습니다: ${projectId}`,
    details: { projectId },
    cause,
  });
}

export function validateInitialRevision(document: ProjectDocumentSnapshot): void {
  const { id: projectId, revision } = document.project;
  if (revision === 0) {
    return;
  }

  throw new ProjectRepositoryError({
    code: ProjectRepositoryErrorCode.INVALID_INITIAL_REVISION,
    message: '새 프로젝트의 revision은 0이어야 합니다.',
    details: { projectId, revision },
  });
}

export function validateExpectedRevision(expectedRevision: number): void {
  if (Number.isSafeInteger(expectedRevision) && expectedRevision >= 0) {
    return;
  }

  throw new ProjectRepositoryError({
    code: ProjectRepositoryErrorCode.INVALID_EXPECTED_REVISION,
    message: 'expectedRevision은 0 이상의 안전 정수여야 합니다.',
    details: { expectedRevision },
  });
}

export function validateSaveExpectedRevision(expectedRevision: number): void {
  validateExpectedRevision(expectedRevision);
  if (expectedRevision < Number.MAX_SAFE_INTEGER) {
    return;
  }

  throw new ProjectRepositoryError({
    code: ProjectRepositoryErrorCode.INVALID_EXPECTED_REVISION,
    message: '저장할 revision은 Number.MAX_SAFE_INTEGER보다 작아야 합니다.',
    details: { expectedRevision },
  });
}

export function throwIfRevisionConflict({
  projectId,
  expectedRevision,
  documentRevision,
  storedRevision,
}: RevisionConflictContext): void {
  if (documentRevision === expectedRevision && storedRevision === expectedRevision) {
    return;
  }

  throw new ProjectRepositoryError({
    code: ProjectRepositoryErrorCode.REVISION_CONFLICT,
    message: `프로젝트 revision이 변경되었습니다: ${projectId}`,
    details: { projectId, expectedRevision, documentRevision, storedRevision },
  });
}

function getProjectDocumentReadError(cause: unknown): ProjectDocumentReadError | undefined {
  try {
    return cause instanceof ProjectDocumentReadError ? cause : undefined;
  } catch {
    return undefined;
  }
}
