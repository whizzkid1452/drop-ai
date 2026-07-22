import { ProjectDocumentSchema, type ProjectDocument } from '../shared/types/project-document.schema';
import { ProjectRepositoryError, ProjectRepositoryErrorCode } from './errors';

interface RevisionConflictContext {
  readonly projectId: string;
  readonly expectedRevision: number;
  readonly documentRevision: number;
  readonly storedRevision: number;
}

interface ValidateDocumentOptions {
  readonly document: ProjectDocument;
  readonly errorCode:
    | typeof ProjectRepositoryErrorCode.INVALID_DOCUMENT
    | typeof ProjectRepositoryErrorCode.INVALID_STORED_DATA;
  readonly message: string;
}

export function cloneAndValidateProjectDocument(document: ProjectDocument): ProjectDocument {
  return validateDocument({
    document,
    errorCode: ProjectRepositoryErrorCode.INVALID_DOCUMENT,
    message: '유효하지 않은 ProjectDocument입니다.',
  });
}

export function cloneAndValidateStoredProjectDocument(document: ProjectDocument): ProjectDocument {
  return validateDocument({
    document,
    errorCode: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
    message: '저장된 ProjectDocument가 유효하지 않습니다.',
  });
}

export function validateInitialRevision(document: ProjectDocument): void {
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

function validateDocument({ document, errorCode, message }: ValidateDocumentOptions): ProjectDocument {
  const result = ProjectDocumentSchema.safeParse(document);
  if (result.success) {
    return result.data;
  }

  throw new ProjectRepositoryError({
    code: errorCode,
    message,
    cause: result.error,
  });
}
