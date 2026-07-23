export const AudioPluginRuntimeErrorCode = {
  INVALID_FACTORY_CONFIG: 'INVALID_FACTORY_CONFIG',
  INVALID_PARAMETER_VALUE: 'INVALID_PARAMETER_VALUE',
  PARAMETER_NOT_FOUND: 'PARAMETER_NOT_FOUND',
} as const;

export type AudioPluginRuntimeErrorCode =
  (typeof AudioPluginRuntimeErrorCode)[keyof typeof AudioPluginRuntimeErrorCode];

interface AudioPluginRuntimeErrorOptions {
  readonly code: AudioPluginRuntimeErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class AudioPluginRuntimeError extends Error {
  readonly code: AudioPluginRuntimeErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor({ code, message, details = {} }: AudioPluginRuntimeErrorOptions) {
    super(message);
    this.name = 'AudioPluginRuntimeError';
    this.code = code;
    this.details = { ...details };
  }
}
