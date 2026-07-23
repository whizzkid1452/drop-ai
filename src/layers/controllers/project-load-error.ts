export const ProjectLoadErrorCode = {
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_ID_MISMATCH: 'PROJECT_ID_MISMATCH',
  AUDIO_SOURCE_NOT_FOUND: 'AUDIO_SOURCE_NOT_FOUND',
  RUNTIME_AUDIO_SOURCE_NOT_FOUND: 'RUNTIME_AUDIO_SOURCE_NOT_FOUND',
} as const;

export type ProjectLoadErrorCode = (typeof ProjectLoadErrorCode)[keyof typeof ProjectLoadErrorCode];

interface ProjectLoadErrorOptions {
  readonly code: ProjectLoadErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

export class ProjectLoadError extends Error {
  readonly code: ProjectLoadErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor({ code, message, details, cause }: ProjectLoadErrorOptions) {
    super(message, { cause });
    this.name = 'ProjectLoadError';
    this.code = code;
    this.details = details;
  }
}
