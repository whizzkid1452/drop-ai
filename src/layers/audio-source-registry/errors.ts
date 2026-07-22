export const AudioSourceRegistryErrorCode = {
  INVALID_SOURCE_METADATA: 'INVALID_SOURCE_METADATA',
  INVALID_SOURCE_BLOB: 'INVALID_SOURCE_BLOB',
  SOURCE_BYTE_LENGTH_MISMATCH: 'SOURCE_BYTE_LENGTH_MISMATCH',
  SOURCE_ID_CONFLICT: 'SOURCE_ID_CONFLICT',
  SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
  INVALID_REGION_ID: 'INVALID_REGION_ID',
  REGION_ID_CONFLICT: 'REGION_ID_CONFLICT',
  REGION_ATTACHMENT_NOT_FOUND: 'REGION_ATTACHMENT_NOT_FOUND',
  SOURCE_ALREADY_COMMITTED: 'SOURCE_ALREADY_COMMITTED',
  SOURCE_NOT_COMMITTED: 'SOURCE_NOT_COMMITTED',
  SOURCE_STILL_ATTACHED: 'SOURCE_STILL_ATTACHED',
  OBJECT_URL_CREATION_FAILED: 'OBJECT_URL_CREATION_FAILED',
  OBJECT_URL_REVOCATION_FAILED: 'OBJECT_URL_REVOCATION_FAILED',
} as const;

export type AudioSourceRegistryErrorCode =
  (typeof AudioSourceRegistryErrorCode)[keyof typeof AudioSourceRegistryErrorCode];

interface AudioSourceRegistryErrorOptions {
  readonly code: AudioSourceRegistryErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

export class AudioSourceRegistryError extends Error {
  readonly code: AudioSourceRegistryErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor({ code, message, details, cause }: AudioSourceRegistryErrorOptions) {
    super(message, { cause });
    this.name = 'AudioSourceRegistryError';
    this.code = code;
    this.details = details;
  }
}
