export const ProjectRepositoryErrorCode = {
  INVALID_DOCUMENT: 'INVALID_DOCUMENT',
  INVALID_EXPECTED_REVISION: 'INVALID_EXPECTED_REVISION',
  INVALID_INITIAL_REVISION: 'INVALID_INITIAL_REVISION',
  INVALID_STORED_DATA: 'INVALID_STORED_DATA',
  PROJECT_ALREADY_EXISTS: 'PROJECT_ALREADY_EXISTS',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  STORAGE_OPERATION_FAILED: 'STORAGE_OPERATION_FAILED',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
} as const;

export type ProjectRepositoryErrorCode = (typeof ProjectRepositoryErrorCode)[keyof typeof ProjectRepositoryErrorCode];

interface ProjectRepositoryErrorOptions {
  code: ProjectRepositoryErrorCode;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  cause?: unknown;
}

export class ProjectRepositoryError extends Error {
  readonly code: ProjectRepositoryErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor({ code, message, details, cause }: ProjectRepositoryErrorOptions) {
    super(message, { cause });
    this.name = 'ProjectRepositoryError';
    this.code = code;
    this.details = details;
  }
}
