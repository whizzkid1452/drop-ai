export const ProjectSyncErrorCode = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  LOCAL_MEDIA_MISSING: 'LOCAL_MEDIA_MISSING',
  NETWORK_ERROR: 'NETWORK_ERROR',
  REMOTE_ERROR: 'REMOTE_ERROR',
  REVISION_CONFLICT: 'REVISION_CONFLICT',
} as const;

export type ProjectSyncErrorCode = (typeof ProjectSyncErrorCode)[keyof typeof ProjectSyncErrorCode];

interface ProjectSyncErrorOptions {
  readonly code: ProjectSyncErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class ProjectSyncError extends Error {
  readonly code: ProjectSyncErrorCode;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor({ code, message, retryable, cause, details }: ProjectSyncErrorOptions) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ProjectSyncError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export function isRetryableProjectSyncError(cause: unknown): cause is ProjectSyncError {
  return cause instanceof ProjectSyncError && cause.retryable;
}
