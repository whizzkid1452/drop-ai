export const LiveAudioInputErrorCode = {
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  AUDIO_TRACK_MISSING: 'AUDIO_TRACK_MISSING',
  CONSTRAINTS_UNSATISFIED: 'CONSTRAINTS_UNSATISFIED',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  OPEN_FAILED: 'OPEN_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

export type LiveAudioInputErrorCode = (typeof LiveAudioInputErrorCode)[keyof typeof LiveAudioInputErrorCode];

export class LiveAudioInputError extends Error {
  readonly code: LiveAudioInputErrorCode;

  constructor(code: LiveAudioInputErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LiveAudioInputError';
    this.code = code;
  }
}
