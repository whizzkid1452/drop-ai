import { z } from 'zod';

export const AudioCommandType = {
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  STOP: 'STOP',
  SET_TRACK_VOLUME: 'SET_TRACK_VOLUME',
  SET_TRACK_PAN: 'SET_TRACK_PAN',
  LOAD_REGION: 'LOAD_REGION',
  UNLOAD_REGION: 'UNLOAD_REGION',
  SET_CURRENT_TIME: 'SET_CURRENT_TIME',
  SET_EXPORT_RANGE: 'SET_EXPORT_RANGE',
  CLEAR_EXPORT_RANGE: 'CLEAR_EXPORT_RANGE',
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
    duration: z.number().min(0, 'Duration must be >= 0').optional(),
  }),
  z.object({
    type: z.literal(AudioCommandType.UNLOAD_REGION),
    trackId: z.uuid('Invalid track ID format'),
    regionId: z.uuid('Invalid region ID format'),
  }),
  z.object({
    type: z.literal(AudioCommandType.SET_CURRENT_TIME),
    time: z.number().min(0, 'Time must be >= 0'),
  }),
  z.object({
    type: z.literal(AudioCommandType.SET_EXPORT_RANGE),
    startTime: z.number().min(0, 'Start time must be >= 0'),
    endTime: z.number().min(0, 'End time must be >= 0'),
  }),
  z.object({
    type: z.literal(AudioCommandType.CLEAR_EXPORT_RANGE),
  }),
  z.object({
    type: z.literal(AudioCommandType.EXPORT_AUDIO),
    filename: z.string().optional(),
  }),
]);

export type AudioCommand = z.infer<typeof AudioCommandSchema>;

/**
 * Parse and validate AI response JSON
 *
 * @param commandString - Full AI response text (may contain JSON)
 * @returns Parsed commands (array) or null if no valid command found
 */
export function parseAudioCommandString({
  commandString,
}: {
  commandString: string;
}): {
  commands: AudioCommand[] | null;
  error?: string;
} {
  // 🔧 DEFENSIVE PARSING: Auto-fix malformed JSON from AI
  // Pattern: {"type":"SET_EXPORT_RANGE",...,"type":"EXPORT_AUDIO"}
  const malformedExportPattern = /"type"\s*:\s*"SET_EXPORT_RANGE"[^}]*"startTime"\s*:\s*(\d+(?:\.\d+)?)[^}]*"endTime"\s*:\s*(\d+(?:\.\d+)?)[^}]*"type"\s*:\s*"EXPORT_AUDIO"/;

  const match = commandString.match(malformedExportPattern);
  if (match) {
    const startTime = match[1];
    const endTime = match[2];
    const fixedCommand = `[{"type":"SET_EXPORT_RANGE","startTime":${startTime},"endTime":${endTime}},{"type":"EXPORT_AUDIO"}]`;
    console.warn('[parseAudioCommandString] Auto-fixed malformed export JSON');
    console.warn('Original:', commandString);
    console.warn('Fixed:', fixedCommand);
    commandString = fixedCommand;
  }

  // Try to extract JSON array first
  const arrayMatch = commandString.match(/\[[\s\S]*\]/);

  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (!Array.isArray(parsed)) {
        return { commands: null, error: 'Expected array of commands' };
      }

      const validatedCommands: AudioCommand[] = [];
      const validTypes = Object.values(AudioCommandType);

      for (const item of parsed) {
        // 1. Filter out unknown command types (Hallucinations)
        if (!validTypes.includes(item.type)) {
          console.warn(`[parseAudioCommandString] Filtered out unknown command type: ${item.type}`);
          continue;
        }

        // 2. Validate parameters for known types
        const validated = AudioCommandSchema.safeParse(item);
        if (!validated.success) {
          const errorMsg = validated.error.issues
            .map((e) => e.message)
            .join(', ');
          console.warn(`[parseAudioCommandString] Skipped invalid command (${item.type}): ${errorMsg}`);
          continue;
        }
        validatedCommands.push(validated.data);
      }

      // If we found at least one valid command, return it even if others failed
      if (validatedCommands.length > 0) {
        return { commands: validatedCommands };
      }

      return { commands: null, error: 'No valid commands found in array' };
    } catch (err) {
      return {
        commands: null,
        error: `JSON array parse error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  // Fallback: try single command object
  const jsonMatch = commandString.match(/\{[^}]+\}/);

  if (!jsonMatch) {
    return {
      commands: null,
    };
  }

  try {
    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    // 🔧 AUTO-FIX: Convert "EXPORT_AUDIO with params" to [SET_RANGE, EXPORT]
    // AI sometimes outputs wrong formats like:
    // - {"type":"EXPORT_AUDIO","startTime":10,"endTime":16}
    // - {"type":"EXPORT_AUDIO","from":1,"to":17}
    // - {"type":"EXPORT_AUDIO","start":5,"end":10}
    if (parsed.type === 'EXPORT_AUDIO') {
      // 다양한 파라미터 패턴 감지
      const startParam = parsed.startTime ?? parsed.from ?? parsed.start;
      const endParam = parsed.endTime ?? parsed.to ?? parsed.end;

      if (startParam !== undefined || endParam !== undefined) {
        console.warn('[parseAudioCommandString] Auto-converting EXPORT_AUDIO with params to command array');
        console.warn('Original:', parsed);

        const commands: AudioCommand[] = [];

        // 1. Create SET_EXPORT_RANGE command
        if (typeof startParam === 'number' && typeof endParam === 'number') {
          commands.push({
            type: AudioCommandType.SET_EXPORT_RANGE,
            startTime: startParam,
            endTime: endParam,
          });
        }

        // 2. Create EXPORT_AUDIO command
        commands.push({
          type: AudioCommandType.EXPORT_AUDIO,
          filename: parsed.filename, // keep filename if present
        });

        console.warn('Fixed to:', commands);
        return { commands };
      }
    }

    const validated = AudioCommandSchema.safeParse(parsed);

    if (!validated.success) {
      const errorMsg = validated.error.issues
        .map((e) => e.message)
        .join(', ');
      return {
        commands: null,
        error: `Invalid command format: ${errorMsg}`,
      };
    }

    return {
      commands: [validated.data],
    };
  } catch (err) {
    return {
      commands: null,
      error: `JSON parse error: ${err instanceof Error ? err.message : 'Unknown error'
        }`,
    };
  }
}
