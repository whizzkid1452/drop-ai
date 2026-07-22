export const AudioSourceRepositoryErrorCode = {
  INVALID_SOURCE_METADATA: 'INVALID_SOURCE_METADATA',
  INVALID_SOURCE_ID: 'INVALID_SOURCE_ID',
  INVALID_SOURCE_BLOB: 'INVALID_SOURCE_BLOB',
  SOURCE_BYTE_LENGTH_MISMATCH: 'SOURCE_BYTE_LENGTH_MISMATCH',
  SOURCE_ALREADY_EXISTS: 'SOURCE_ALREADY_EXISTS',
  STORED_SOURCE_BYTE_LENGTH_MISMATCH: 'STORED_SOURCE_BYTE_LENGTH_MISMATCH',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  STORAGE_OPERATION_FAILED: 'STORAGE_OPERATION_FAILED',
} as const;

export type AudioSourceRepositoryErrorCode =
  (typeof AudioSourceRepositoryErrorCode)[keyof typeof AudioSourceRepositoryErrorCode];

interface AudioSourceRepositoryErrorOptions {
  readonly code: AudioSourceRepositoryErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

export class AudioSourceRepositoryError extends Error {
  readonly code: AudioSourceRepositoryErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor({ code, message, details, cause }: AudioSourceRepositoryErrorOptions) {
    super(message, { cause });
    this.name = 'AudioSourceRepositoryError';
    this.code = code;
    this.details = details;
  }
}
