export const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/flac',
] as const;

export const MAX_FILE_SIZE = 500 * 1024 * 1024;
export const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / (1024 * 1024);
