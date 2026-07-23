import { z } from 'zod';
import { calculateFiniteRegionSourceEndTime } from '../audio-source-range';
import { calculateFiniteRegionEndTime } from '../region-timeline';

export const AudioCommandType = {
  UNDO: 'UNDO',
  REDO: 'REDO',
  ADD_TRACK: 'ADD_TRACK',
  REMOVE_TRACK: 'REMOVE_TRACK',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  STOP: 'STOP',
  SET_TEMPO: 'SET_TEMPO',
  SET_TRACK_VOLUME: 'SET_TRACK_VOLUME',
  SET_TRACK_PAN: 'SET_TRACK_PAN',
  SET_TRACK_MUTE: 'SET_TRACK_MUTE',
  SET_TRACK_SOLO: 'SET_TRACK_SOLO',
  INSTALL_PLUGIN: 'INSTALL_PLUGIN',
  REMOVE_PLUGIN: 'REMOVE_PLUGIN',
  SET_PLUGIN_PARAMETER: 'SET_PLUGIN_PARAMETER',
  LOAD_REGION: 'LOAD_REGION',
  UNLOAD_REGION: 'UNLOAD_REGION',
  SPLIT_REGION: 'SPLIT_REGION',
  MOVE_REGION: 'MOVE_REGION',
  SET_CURRENT_TIME: 'SET_CURRENT_TIME',
  SET_EXPORT_RANGE: 'SET_EXPORT_RANGE',
  CLEAR_EXPORT_RANGE: 'CLEAR_EXPORT_RANGE',
  EXPORT_AUDIO: 'EXPORT_AUDIO',
  SAVE_PROJECT: 'SAVE_PROJECT',
  LOAD_PROJECT: 'LOAD_PROJECT',
} as const;
export type AudioCommandType = (typeof AudioCommandType)[keyof typeof AudioCommandType];

function isAudioCommandType(value: unknown): value is AudioCommandType {
  return typeof value === 'string' && Object.values(AudioCommandType).some(commandType => commandType === value);
}

const SetExportRangeCommandSchema = z
  .strictObject({
    type: z.literal(AudioCommandType.SET_EXPORT_RANGE),
    startTime: z.number().min(0, 'Start time must be >= 0'),
    endTime: z.number().min(0, 'End time must be >= 0'),
  })
  .refine(command => command.endTime >= command.startTime, {
    message: 'End time must be greater than or equal to start time',
    path: ['endTime'],
  });

const pluginMemberIdSchema = z.string().min(1).max(255);
const pluginParameterValueSchema = z.union([z.boolean(), z.number().finite(), z.string()]);

const LoadRegionCommandSchema = z
  .strictObject({
    type: z.literal(AudioCommandType.LOAD_REGION),
    trackId: z.uuid('Invalid track ID format').optional(),
    regionId: z.uuid('Invalid region ID format').optional(),
    // 호환 파서가 제거하지 못하게 폐기된 필드를 명시적으로 거부한다.
    url: z.never().optional(),
    sourceId: z.uuid('Invalid source ID format').optional(),
    startTime: z.number().min(0, 'Start time must be >= 0'),
    startOffset: z.number().min(0, 'Start offset must be >= 0').optional(),
    duration: z.number().min(0, 'Duration must be >= 0').optional(),
  })
  .refine(
    command =>
      command.duration === undefined ||
      calculateFiniteRegionEndTime({ startTime: command.startTime, duration: command.duration }) !== null,
    {
      message: 'Region end time must be finite',
      path: ['duration'],
    }
  )
  .refine(
    command =>
      command.duration === undefined ||
      calculateFiniteRegionSourceEndTime({
        sourceStartTimeSeconds: command.startOffset ?? 0,
        regionDurationSeconds: command.duration,
      }) !== null,
    {
      message: 'Region Source end time must be finite',
      path: ['duration'],
    }
  );

/**
 * Zod Schema for AI-generated Audio Commands
 *
 * Purpose:
 * - Runtime validation of AI responses (prevents malformed JSON crashes)
 * - Type-safe command parsing
 * - Self-correction loop support (validation error messages)
 */

export const StrictAudioCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal(AudioCommandType.UNDO),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.REDO),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.ADD_TRACK),
    trackId: z.uuid('Invalid track ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.REMOVE_TRACK),
    trackId: z.uuid('Invalid track ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.PLAY),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.PAUSE),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.STOP),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TEMPO),
    tempo: z.number().positive('Tempo must be > 0'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TRACK_VOLUME),
    trackId: z.string().uuid('Invalid track ID format').optional(),
    volume: z.number().min(0, 'Volume must be >= 0').max(1, 'Volume must be <= 1'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TRACK_PAN),
    trackId: z.uuid('Invalid track ID format').optional(),
    pan: z.number().min(-1, 'Pan must be >= -1').max(1, 'Pan must be <= 1'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TRACK_MUTE),
    trackId: z.uuid('Invalid track ID format'),
    muted: z.boolean(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TRACK_SOLO),
    trackId: z.uuid('Invalid track ID format'),
    soloed: z.boolean(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.INSTALL_PLUGIN),
    trackId: z.uuid('Invalid track ID format'),
    instanceId: z.uuid('Invalid Plugin instance ID format').optional(),
    manifestId: pluginMemberIdSchema,
    parameterValues: z.record(pluginMemberIdSchema, pluginParameterValueSchema).optional(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.REMOVE_PLUGIN),
    trackId: z.uuid('Invalid track ID format'),
    instanceId: z.uuid('Invalid Plugin instance ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_PLUGIN_PARAMETER),
    trackId: z.uuid('Invalid track ID format'),
    instanceId: z.uuid('Invalid Plugin instance ID format'),
    parameterId: pluginMemberIdSchema,
    value: pluginParameterValueSchema,
  }),
  LoadRegionCommandSchema,
  z.strictObject({
    type: z.literal(AudioCommandType.UNLOAD_REGION),
    trackId: z.uuid('Invalid track ID format').optional(),
    regionId: z.uuid('Invalid region ID format').optional(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SPLIT_REGION),
    trackId: z.uuid('Invalid track ID format'),
    regionId: z.uuid('Invalid region ID format'),
    splitTime: z.number().min(0, 'Split time must be >= 0'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.MOVE_REGION),
    trackId: z.uuid('Invalid track ID format'),
    regionId: z.uuid('Invalid region ID format'),
    newStartTime: z.number().min(0, 'New start time must be >= 0'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_CURRENT_TIME),
    time: z.number().min(0, 'Time must be >= 0'),
  }),
  SetExportRangeCommandSchema,
  z.strictObject({
    type: z.literal(AudioCommandType.CLEAR_EXPORT_RANGE),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.EXPORT_AUDIO),
    filename: z.string().optional(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SAVE_PROJECT),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.LOAD_PROJECT),
    projectId: z.uuid('Invalid project ID format'),
  }),
]);

// Web JSON CLI의 기존 보정 규칙은 추가 필드를 제거하므로 호환 Schema를 별도로 유지한다.
const permissiveAudioCommandOptions = StrictAudioCommandSchema.options.map(commandSchema => commandSchema.strip());

export const AudioCommandSchema = z.discriminatedUnion('type', [
  permissiveAudioCommandOptions[0],
  ...permissiveAudioCommandOptions.slice(1),
]);

export type AudioCommand = z.infer<typeof AudioCommandSchema>;
export const AudioCommandBatchSchema = z.array(AudioCommandSchema);
export const AgentAudioCommandBatchSchema = z.array(StrictAudioCommandSchema);

export function parseAgentAudioCommandBatch({ commandString }: { commandString: string }): {
  commands: AudioCommand[] | null;
  error?: string;
} {
  let parsedResponse: unknown;
  try {
    parsedResponse = JSON.parse(commandString.trim());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
    return { commands: null, error: `Agent response is not valid JSON: ${message}` };
  }

  if (!Array.isArray(parsedResponse)) {
    return { commands: null, error: 'Agent response must be a JSON array.' };
  }

  const validatedBatch = AgentAudioCommandBatchSchema.safeParse(parsedResponse);
  if (!validatedBatch.success) {
    const message = validatedBatch.error.issues.map(issue => issue.message).join(', ');
    return { commands: null, error: `Invalid command batch: ${message}` };
  }

  return { commands: validatedBatch.data };
}

/**
 * Parse and validate AI response JSON
 *
 * @param commandString - Full AI response text (may contain JSON)
 * @returns Parsed commands (array) or null if no valid command found
 */
export function parseAudioCommandString({ commandString }: { commandString: string }): {
  commands: AudioCommand[] | null;
  error?: string;
} {
  // 🔧 DEFENSIVE PARSING: Auto-fix malformed JSON from AI

  // Pattern 1: Multiple "type" keys in a single object (invalid JSON)
  // Example: [{"type": "SET_TRACK_VOLUME", "volume": 0.5, "type":"PAUSE", "type":"STOP"}]
  // or: {"type": "SET_TRACK_VOLUME", "volume": 0.5, "type":"PAUSE"}
  const multipleTypePattern = /"type"\s*:\s*"[^"]+"[^}]*"type"\s*:\s*"[^"]+"/;
  if (multipleTypePattern.test(commandString)) {
    console.warn('[parseAudioCommandString] Detected multiple "type" keys in single object, attempting to split');

    try {
      // Extract the object with multiple type keys (could be in array or standalone)
      const objectMatch = commandString.match(/\{[\s\S]*?\}/);
      if (objectMatch) {
        const malformedObj = objectMatch[0];

        // Find all "type" keys and their positions
        const typeMatches = [...malformedObj.matchAll(/"type"\s*:\s*"([^"]+)"/g)];

        if (typeMatches.length > 1) {
          const commands: string[] = [];

          for (let i = 0; i < typeMatches.length; i++) {
            const type = typeMatches[i][1];
            const typeStart = typeMatches[i].index!;

            // Find the end of this command (next "type" or end of object)
            let commandEnd = malformedObj.length - 1; // Default to end of object
            if (i < typeMatches.length - 1) {
              // Find the position before the next "type" key
              commandEnd = typeMatches[i + 1].index!;
            }

            // Extract the section for this command
            const commandSection = malformedObj.substring(typeStart, commandEnd);

            // Extract parameters (everything after "type": "TYPE" until next type or end)
            const afterType = commandSection.substring(typeMatches[i][0].length);
            const params = afterType
              .replace(/^[,\s]+/, '') // Remove leading comma/whitespace
              .replace(/[,\s]+$/, '') // Remove trailing comma/whitespace
              .split(',')
              .filter(p => {
                const trimmed = p.trim();
                // Keep valid key-value pairs, exclude next "type" key
                return trimmed && !trimmed.match(/^\s*"type"\s*:/);
              })
              .join(',');

            // Build the command object
            const paramsStr = params.trim() ? `, ${params.trim()}` : '';
            commands.push(`{"type":"${type}"${paramsStr}}`);
          }

          // Reconstruct as array
          const fixedCommand = `[${commands.join(',')}]`;
          console.warn('[parseAudioCommandString] Auto-fixed multiple type keys');
          console.warn('Original:', commandString);
          console.warn('Fixed:', fixedCommand);
          commandString = fixedCommand;
        }
      }
    } catch (err) {
      console.warn('[parseAudioCommandString] Failed to auto-fix multiple type keys:', err);
    }
  }

  // Pattern 2: {"type":"SET_EXPORT_RANGE",...,"type":"EXPORT_AUDIO"}
  const malformedExportPattern =
    /"type"\s*:\s*"SET_EXPORT_RANGE"[^}]*"startTime"\s*:\s*(\d+(?:\.\d+)?)[^}]*"endTime"\s*:\s*(\d+(?:\.\d+)?)[^}]*"type"\s*:\s*"EXPORT_AUDIO"/;

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

  // Step 1: Try to parse the entire string as JSON first (handles clean arrays)
  try {
    const directParse = JSON.parse(commandString.trim());
    if (Array.isArray(directParse)) {
      return validateAndParseCommands(directParse);
    }
    // If it's a single object, we'll handle it in the fallback section
  } catch {
    // Not valid JSON, continue to regex extraction
  }

  // Step 2: Try to extract JSON array using improved regex
  // This regex finds arrays that may be embedded in text
  const arrayMatch = commandString.match(/\[\s*\{[\s\S]*\}\s*(?:,\s*\{[\s\S]*\}\s*)*\]/);

  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return validateAndParseCommands(parsed);
      }
    } catch {
      // Continue to fallback
    }
  }

  // Helper function to validate and parse commands
  function validateAndParseCommands(parsed: unknown[]): {
    commands: AudioCommand[] | null;
    error?: string;
  } {
    const validatedCommands: AudioCommand[] = [];

    for (const item of parsed) {
      const commandType = typeof item === 'object' && item !== null && 'type' in item ? item.type : undefined;

      // 1. Filter out unknown command types (Hallucinations)
      if (!isAudioCommandType(commandType)) {
        console.warn(`[parseAudioCommandString] Filtered out unknown command type: ${String(commandType)}`);
        continue;
      }

      // 2. Validate parameters for known types
      const validated = AudioCommandSchema.safeParse(item);
      if (!validated.success) {
        const errorMsg = validated.error.issues.map(e => e.message).join(', ');
        console.warn(`[parseAudioCommandString] Skipped invalid command (${commandType}): ${errorMsg}`);
        continue;
      }
      validatedCommands.push(validated.data);
    }

    // If we found at least one valid command, return it even if others failed
    if (validatedCommands.length > 0) {
      return { commands: validatedCommands };
    }

    return { commands: null, error: 'No valid commands found in array' };
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
      const errorMsg = validated.error.issues.map(e => e.message).join(', ');
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
      error: `JSON parse error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
