export const ProjectDocumentMappingErrorCode = {
  INVALID_PROJECT_DOCUMENT: 'INVALID_PROJECT_DOCUMENT',
  INVALID_SESSION_PROJECT_STATE: 'INVALID_SESSION_PROJECT_STATE',
} as const;

export type ProjectDocumentMappingErrorCode =
  (typeof ProjectDocumentMappingErrorCode)[keyof typeof ProjectDocumentMappingErrorCode];

interface ProjectDocumentMappingErrorOptions {
  readonly code: ProjectDocumentMappingErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

export class ProjectDocumentMappingError extends Error {
  readonly code: ProjectDocumentMappingErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor({ code, message, details, cause }: ProjectDocumentMappingErrorOptions) {
    super(message, { cause });
    this.name = 'ProjectDocumentMappingError';
    this.code = code;
    this.details = details;
  }
}
