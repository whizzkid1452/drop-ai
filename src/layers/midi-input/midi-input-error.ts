export const MidiInputErrorCode = {
  ACCESS_FAILED: 'MIDI_INPUT_ACCESS_FAILED',
  UNAVAILABLE: 'MIDI_INPUT_UNAVAILABLE',
} as const;

export type MidiInputErrorCode = (typeof MidiInputErrorCode)[keyof typeof MidiInputErrorCode];

export class MidiInputError extends Error {
  readonly code: MidiInputErrorCode;

  constructor(code: MidiInputErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'MidiInputError';
    this.code = code;
  }
}
