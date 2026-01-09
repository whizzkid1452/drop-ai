import { z } from 'zod';

export const AudioCommandType = {
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  STOP: 'STOP',
  SET_TRACK_VOLUME: 'SET_TRACK_VOLUME',
  SET_TRACK_PAN: 'SET_TRACK_PAN',
  LOAD_REGION: 'LOAD_REGION',
  UNLOAD_REGION: 'UNLOAD_REGION',
  GET_TRACK_INFO: 'GET_TRACK_INFO',
  SET_CURRENT_TIME: 'SET_CURRENT_TIME',
  EXPORT_AUDIO: 'EXPORT_AUDIO',
} as const;
export type AudioCommandType =
  (typeof AudioCommandType)[keyof typeof AudioCommandType];

/**
 * Zod Schema for AI-generated Audio Commands
 *
 * Purpose:
 * - Runtime validation of AI responses (prevents malformed JSON crashes)
 * - Type-safe command parsing
 * - Self-correction loop support (validation error messages)
 */

export const AudioCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(AudioCommandType.PLAY),
  }),
  z.object({
    type: z.literal(AudioCommandType.PAUSE),
  }),
  z.object({
    type: z.literal(AudioCommandType.STOP),
  }),
  z.object({
    type: z.literal(AudioCommandType.SET_TRACK_VOLUME),
    trackId: z.string().uuid('Invalid track ID format'),
    volume: z
      .number()
      .min(0, 'Volume must be >= 0')
      .max(1, 'Volume must be <= 1'),
  }),
  z.object({
    type: z.literal(AudioCommandType.SET_TRACK_PAN),
    trackId: z.uuid('Invalid track ID format'),
    pan: z.number().min(-1, 'Pan must be >= -1').max(1, 'Pan must be <= 1'),
  }),
  z.object({
    type: z.literal(AudioCommandType.LOAD_REGION),
    trackId: z.uuid('Invalid track ID format'),
    regionId: z.uuid('Invalid region ID format'),
    url: z.url('Invalid URL format'),
    startTime: z.number().min(0, 'Start time must be >= 0'),
    startOffset: z.number().min(0, 'Start offset must be >= 0').optional(),
  }),
  z.object({
    type: z.literal(AudioCommandType.UNLOAD_REGION),
    trackId: z.uuid('Invalid track ID format'),
    regionId: z.uuid('Invalid region ID format'),
  }),
  z.object({
    type: z.literal(AudioCommandType.GET_TRACK_INFO),
  }),
  z.object({
    type: z.literal(AudioCommandType.SET_CURRENT_TIME),
    time: z.number().min(0, 'Time must be >= 0'),
  }),
  z.object({
    type: z.literal(AudioCommandType.EXPORT_AUDIO),
    startTime: z.number().min(0, 'Start time must be >= 0').optional(),
    endTime: z.number().min(0, 'End time must be >= 0').optional(),
  }),
]);

export type AudioCommand = z.infer<typeof AudioCommandSchema>;

/**
 * Parse and validate AI response JSON
 *
 * @param commandString - Full AI response text (may contain JSON)
 * @returns Parsed command or null if no valid command found
 */
export function parseAudioCommandString({
  commandString,
}: {
  commandString: string;
}): {
  command: AudioCommand | null;
  error?: string;
} {
  // Extract JSON from response (supports both inline and last-line formats)
  const jsonMatch = commandString.match(/\{[^}]+\}/);

  if (!jsonMatch) {
    return {
      command: null,
    };
  }

  try {
    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);
    const validated = AudioCommandSchema.safeParse(parsed);

    if (!validated.success) {
      // Validation failed - return error for self-correction
      // Zod v4 uses 'issues' instead of 'errors'
      const errorMsg = validated.error.issues
        .map((e: any) => e.message)
        .join(', ');
      return {
        command: null,
        error: `Invalid command format: ${errorMsg}`,
      };
    }

    return {
      command: validated.data,
    };
  } catch (err) {
    return {
      command: null,
      error: `JSON parse error: ${err instanceof Error ? err.message : 'Unknown error'
        }`,
    };
  }
}
