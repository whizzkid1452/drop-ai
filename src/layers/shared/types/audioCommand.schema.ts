import { z } from 'zod';
import { calculateFiniteRegionSourceEndTime } from '../audio-source-range';
import { calculateFiniteRegionEndTime } from '../region-timeline';
import {
  ProjectAutomationLaneV12Schema,
  ProjectCompSegmentSchema,
  ProjectRoutingGraphSchema,
  ProjectRoutingRouteTargetSchema,
  ProjectTempoChangeSchema,
  ProjectTimelineMarkerSchema,
  ProjectTimelineRangeSchema,
} from './project-document.schema';
import { RECORD_MODES } from './multitrack-recording';
import { ROUTING_CHANNEL_COUNTS, ROUTING_SEND_TAP_POINTS, ROUTING_TRACK_KINDS } from './routing-state';

export const AudioCommandType = {
  UNDO: 'UNDO',
  REDO: 'REDO',
  ADD_TRACK: 'ADD_TRACK',
  REMOVE_TRACK: 'REMOVE_TRACK',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  STOP: 'STOP',
  SET_AUDIO_INPUT_DEVICE: 'SET_AUDIO_INPUT_DEVICE',
  SET_INPUT_MONITORING: 'SET_INPUT_MONITORING',
  SET_TRACK_RECORD_ARM: 'SET_TRACK_RECORD_ARM',
  SET_TRACK_RECORDING_INPUT: 'SET_TRACK_RECORDING_INPUT',
  SET_PUNCH_RECORDING: 'SET_PUNCH_RECORDING',
  SET_TRACK_RECORD_MODE: 'SET_TRACK_RECORD_MODE',
  SELECT_TAKE: 'SELECT_TAKE',
  SET_COMP_SEGMENTS: 'SET_COMP_SEGMENTS',
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  CANCEL_RECORDING: 'CANCEL_RECORDING',
  ARM_LOOP_SLOT: 'ARM_LOOP_SLOT',
  ARM_LOOP_OVERDUB: 'ARM_LOOP_OVERDUB',
  CANCEL_LOOP_SLOT: 'CANCEL_LOOP_SLOT',
  TRIGGER_LOOP_SLOT: 'TRIGGER_LOOP_SLOT',
  STOP_LOOP_SLOT: 'STOP_LOOP_SLOT',
  CLEAR_LOOP_SLOT: 'CLEAR_LOOP_SLOT',
  STOP_ALL_LOOPS: 'STOP_ALL_LOOPS',
  SET_TEMPO: 'SET_TEMPO',
  SET_TIMELINE_MAP: 'SET_TIMELINE_MAP',
  SET_TIMELINE_MARKERS: 'SET_TIMELINE_MARKERS',
  SET_LOOP_RANGE: 'SET_LOOP_RANGE',
  CLEAR_LOOP_RANGE: 'CLEAR_LOOP_RANGE',
  SET_LOOP_ENABLED: 'SET_LOOP_ENABLED',
  SET_METRONOME: 'SET_METRONOME',
  SET_MASTER_VOLUME: 'SET_MASTER_VOLUME',
  SET_MONITOR_STATE: 'SET_MONITOR_STATE',
  SET_ROUTING_GRAPH: 'SET_ROUTING_GRAPH',
  SET_TRACK_ROUTING: 'SET_TRACK_ROUTING',
  ADD_SEND: 'ADD_SEND',
  UPDATE_SEND: 'UPDATE_SEND',
  REMOVE_SEND: 'REMOVE_SEND',
  SET_TRACK_GROUPS: 'SET_TRACK_GROUPS',
  SET_TRACK_NAME: 'SET_TRACK_NAME',
  SET_TRACK_VOLUME: 'SET_TRACK_VOLUME',
  SET_TRACK_PAN: 'SET_TRACK_PAN',
  SET_TRACK_MUTE: 'SET_TRACK_MUTE',
  SET_TRACK_SOLO: 'SET_TRACK_SOLO',
  SET_AUTOMATION_LANES: 'SET_AUTOMATION_LANES',
  INSTALL_PLUGIN: 'INSTALL_PLUGIN',
  REMOVE_PLUGIN: 'REMOVE_PLUGIN',
  MOVE_PLUGIN: 'MOVE_PLUGIN',
  SET_PLUGIN_ENABLED: 'SET_PLUGIN_ENABLED',
  SET_PLUGIN_PARAMETER: 'SET_PLUGIN_PARAMETER',
  LOAD_REGION: 'LOAD_REGION',
  UNLOAD_REGION: 'UNLOAD_REGION',
  SPLIT_REGION: 'SPLIT_REGION',
  MOVE_REGION: 'MOVE_REGION',
  SET_EDITOR_SELECTION: 'SET_EDITOR_SELECTION',
  COPY_SELECTED_REGIONS: 'COPY_SELECTED_REGIONS',
  CUT_SELECTED_REGIONS: 'CUT_SELECTED_REGIONS',
  PASTE_REGIONS: 'PASTE_REGIONS',
  DUPLICATE_SELECTED_REGIONS: 'DUPLICATE_SELECTED_REGIONS',
  NUDGE_SELECTED_REGIONS: 'NUDGE_SELECTED_REGIONS',
  ALIGN_SELECTED_REGIONS: 'ALIGN_SELECTED_REGIONS',
  TRIM_REGION: 'TRIM_REGION',
  SLIP_REGION: 'SLIP_REGION',
  SET_REGION_PROCESSING: 'SET_REGION_PROCESSING',
  CREATE_REGION_CROSSFADE: 'CREATE_REGION_CROSSFADE',
  REMOVE_REGION_CROSSFADE: 'REMOVE_REGION_CROSSFADE',
  NORMALIZE_SELECTED_REGIONS: 'NORMALIZE_SELECTED_REGIONS',
  REVERSE_SELECTED_REGIONS: 'REVERSE_SELECTED_REGIONS',
  STRIP_SILENCE_SELECTED_REGIONS: 'STRIP_SILENCE_SELECTED_REGIONS',
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
const loopLengthBarsSchema = z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]);
const timelineMeterChangeCommandSchema = z.strictObject({
  quarterNotePosition: z.number().nonnegative(),
  beatsPerBar: z.number().int().positive(),
  beatUnit: z
    .number()
    .int()
    .refine(beatUnit => [1, 2, 4, 8, 16, 32].includes(beatUnit), 'Unsupported beat unit'),
});
const setTimelineMarkersCommandSchema = z
  .strictObject({
    type: z.literal(AudioCommandType.SET_TIMELINE_MARKERS),
    markers: z.array(ProjectTimelineMarkerSchema).max(256),
  })
  .superRefine((command, context) => {
    const markerIds = new Set<string>();
    command.markers.forEach((marker, index) => {
      if (markerIds.has(marker.id)) {
        context.addIssue({ code: 'custom', message: 'Duplicate Timeline marker ID', path: ['markers', index, 'id'] });
      }
      markerIds.add(marker.id);
    });
  });
const loopSlotAddressSchema = {
  slotId: z.uuid('Invalid Loop Slot ID format'),
  trackId: z.uuid('Invalid Track ID format'),
};
const editorRegionSelectionSchema = z.strictObject({
  regionId: z.uuid('Invalid Region ID format'),
  trackId: z.uuid('Invalid Track ID format'),
});
const editorRangeSelectionSchema = z
  .strictObject({
    endTimeSeconds: z.number().finite().nonnegative(),
    startTimeSeconds: z.number().finite().nonnegative(),
    trackIds: z.array(z.uuid('Invalid Track ID format')),
  })
  .refine(range => range.endTimeSeconds > range.startTimeSeconds, {
    message: 'Range end time must be greater than start time',
    path: ['endTimeSeconds'],
  });
const regionFadeCommandSchema = z.strictObject({
  curve: z.enum(['equalPower', 'linear']),
  durationSeconds: z.number().finite().nonnegative(),
});
const SetRegionProcessingCommandSchema = z
  .strictObject({
    type: z.literal(AudioCommandType.SET_REGION_PROCESSING),
    fadeIn: regionFadeCommandSchema.optional(),
    fadeOut: regionFadeCommandSchema.optional(),
    gain: z.number().finite().nonnegative().optional(),
    isOpaque: z.boolean().optional(),
    layer: z.number().int().nonnegative().optional(),
    regionId: z.uuid('Invalid Region ID format'),
    trackId: z.uuid('Invalid Track ID format'),
  })
  .refine(
    command =>
      command.fadeIn !== undefined ||
      command.fadeOut !== undefined ||
      command.gain !== undefined ||
      command.isOpaque !== undefined ||
      command.layer !== undefined,
    { message: 'At least one Region processing value is required' }
  );

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
    kind: z.enum(ROUTING_TRACK_KINDS).optional(),
    channelCount: z.union([z.literal(ROUTING_CHANNEL_COUNTS[0]), z.literal(ROUTING_CHANNEL_COUNTS[1])]).optional(),
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
    type: z.literal(AudioCommandType.SET_AUDIO_INPUT_DEVICE),
    deviceId: z.string().trim().min(1).max(512).nullable(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_INPUT_MONITORING),
    trackId: z.uuid('Invalid Track ID format'),
    enabled: z.boolean(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TRACK_RECORD_ARM),
    trackId: z.uuid('Invalid Track ID format'),
    armed: z.boolean(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TRACK_RECORDING_INPUT),
    channelIndex: z.number().int().nonnegative(),
    deviceId: z.string().trim().min(1).max(512).nullable(),
    trackId: z.uuid('Invalid Track ID format'),
  }),
  z
    .strictObject({
      type: z.literal(AudioCommandType.SET_PUNCH_RECORDING),
      isEnabled: z.boolean(),
      range: ProjectTimelineRangeSchema.nullable(),
    })
    .refine(command => command.range === null || command.range.endTimeSeconds > command.range.startTimeSeconds, {
      message: 'Punch end time must be greater than start time',
      path: ['range', 'endTimeSeconds'],
    })
    .refine(command => !command.isEnabled || command.range !== null, {
      message: 'Enabled Punch recording requires a range',
      path: ['range'],
    }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TRACK_RECORD_MODE),
    recordMode: z.enum(RECORD_MODES),
    trackId: z.uuid('Invalid Track ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SELECT_TAKE),
    playlistId: z.uuid('Invalid Playlist ID format'),
    takeId: z.uuid('Invalid Take ID format'),
    trackId: z.uuid('Invalid Track ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_COMP_SEGMENTS),
    compSegments: z.array(ProjectCompSegmentSchema).max(10_000),
    playlistId: z.uuid('Invalid Playlist ID format'),
    trackId: z.uuid('Invalid Track ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.START_RECORDING),
    countInBars: z.number().int().min(0).max(4),
    prerollSeconds: z.number().finite().min(0).max(60),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.STOP_RECORDING),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.CANCEL_RECORDING),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.ARM_LOOP_SLOT),
    ...loopSlotAddressSchema,
    lengthBars: loopLengthBarsSchema,
    quantizationBars: loopLengthBarsSchema,
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.ARM_LOOP_OVERDUB),
    ...loopSlotAddressSchema,
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.CANCEL_LOOP_SLOT),
    ...loopSlotAddressSchema,
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.TRIGGER_LOOP_SLOT),
    ...loopSlotAddressSchema,
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.STOP_LOOP_SLOT),
    ...loopSlotAddressSchema,
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.CLEAR_LOOP_SLOT),
    ...loopSlotAddressSchema,
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.STOP_ALL_LOOPS),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TEMPO),
    tempo: z.number().positive('Tempo must be > 0'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TIMELINE_MAP),
    tempoChanges: z.array(ProjectTempoChangeSchema).min(1).max(256),
    meterChanges: z.array(timelineMeterChangeCommandSchema).min(1).max(256),
  }),
  setTimelineMarkersCommandSchema,
  z
    .strictObject({
      type: z.literal(AudioCommandType.SET_LOOP_RANGE),
      startTimeSeconds: z.number().nonnegative(),
      endTimeSeconds: z.number().nonnegative(),
      isEnabled: z.boolean().optional(),
    })
    .refine(command => command.endTimeSeconds > command.startTimeSeconds, {
      message: 'Loop end time must be greater than start time',
      path: ['endTimeSeconds'],
    }),
  z.strictObject({
    type: z.literal(AudioCommandType.CLEAR_LOOP_RANGE),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_LOOP_ENABLED),
    isEnabled: z.boolean(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_METRONOME),
    isEnabled: z.boolean(),
    volume: z.number().min(0).max(1),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_MASTER_VOLUME),
    volume: z.number().min(0).max(1),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_MONITOR_STATE),
    isCut: z.boolean(),
    isDimmed: z.boolean(),
    isMono: z.boolean(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_ROUTING_GRAPH),
    graph: ProjectRoutingGraphSchema,
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TRACK_ROUTING),
    trackId: z.uuid('Invalid Track ID format'),
    kind: z.enum(ROUTING_TRACK_KINDS),
    channelCount: z.union([z.literal(ROUTING_CHANNEL_COUNTS[0]), z.literal(ROUTING_CHANNEL_COUNTS[1])]),
    output: ProjectRoutingRouteTargetSchema,
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.ADD_SEND),
    id: z.uuid('Invalid Send ID format'),
    sourceTrackId: z.uuid('Invalid Track ID format'),
    destinationTrackId: z.uuid('Invalid Track ID format'),
    gain: z.number().min(0).max(1),
    tapPoint: z.enum(ROUTING_SEND_TAP_POINTS),
    isEnabled: z.boolean(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.UPDATE_SEND),
    id: z.uuid('Invalid Send ID format'),
    gain: z.number().min(0).max(1),
    tapPoint: z.enum(ROUTING_SEND_TAP_POINTS),
    isEnabled: z.boolean(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.REMOVE_SEND),
    id: z.uuid('Invalid Send ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TRACK_GROUPS),
    trackId: z.uuid('Invalid Track ID format'),
    folderId: z.uuid('Invalid Folder Track ID format').nullable(),
    vcaIds: z.array(z.uuid('Invalid VCA Track ID format')).max(512),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_TRACK_NAME),
    trackId: z.string().uuid('Invalid track ID format'),
    name: z.string().trim().min(1).max(255),
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
    type: z.literal(AudioCommandType.SET_AUTOMATION_LANES),
    automationLanes: z.array(ProjectAutomationLaneV12Schema).max(128),
    trackId: z.uuid('Invalid track ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.INSTALL_PLUGIN),
    trackId: z.uuid('Invalid track ID format'),
    instanceId: z.uuid('Invalid Plugin instance ID format').optional(),
    manifestId: pluginMemberIdSchema,
    isEnabled: z.boolean().optional(),
    targetIndex: z.number().int().nonnegative().optional(),
    parameterValues: z.record(pluginMemberIdSchema, pluginParameterValueSchema).optional(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.REMOVE_PLUGIN),
    trackId: z.uuid('Invalid track ID format'),
    instanceId: z.uuid('Invalid Plugin instance ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.MOVE_PLUGIN),
    trackId: z.uuid('Invalid track ID format'),
    instanceId: z.uuid('Invalid Plugin instance ID format'),
    targetIndex: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.SET_PLUGIN_ENABLED),
    trackId: z.uuid('Invalid track ID format'),
    instanceId: z.uuid('Invalid Plugin instance ID format'),
    isEnabled: z.boolean(),
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
    type: z.literal(AudioCommandType.SET_EDITOR_SELECTION),
    editPointSeconds: z.number().finite().nonnegative(),
    range: editorRangeSelectionSchema.nullable(),
    regions: z.array(editorRegionSelectionSchema),
    trackIds: z.array(z.uuid('Invalid Track ID format')),
  }),
  z.strictObject({ type: z.literal(AudioCommandType.COPY_SELECTED_REGIONS) }),
  z.strictObject({ type: z.literal(AudioCommandType.CUT_SELECTED_REGIONS) }),
  z.strictObject({ type: z.literal(AudioCommandType.PASTE_REGIONS) }),
  z.strictObject({
    type: z.literal(AudioCommandType.DUPLICATE_SELECTED_REGIONS),
    offsetSeconds: z.number().finite().positive(),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.NUDGE_SELECTED_REGIONS),
    deltaSeconds: z
      .number()
      .finite()
      .refine(deltaSeconds => deltaSeconds !== 0, 'Nudge delta must not be zero'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.ALIGN_SELECTED_REGIONS),
    edge: z.enum(['end', 'start']),
    targetTimeSeconds: z.number().finite().nonnegative(),
  }),
  z
    .strictObject({
      type: z.literal(AudioCommandType.TRIM_REGION),
      trackId: z.uuid('Invalid Track ID format'),
      regionId: z.uuid('Invalid Region ID format'),
      startTimeSeconds: z.number().finite().nonnegative(),
      sourceStartTimeSeconds: z.number().finite().nonnegative(),
      durationSeconds: z.number().finite().positive(),
    })
    .refine(
      command =>
        calculateFiniteRegionEndTime({
          startTime: command.startTimeSeconds,
          duration: command.durationSeconds,
        }) !== null,
      { message: 'Trimmed Region end time must be finite', path: ['durationSeconds'] }
    )
    .refine(
      command =>
        calculateFiniteRegionSourceEndTime({
          sourceStartTimeSeconds: command.sourceStartTimeSeconds,
          regionDurationSeconds: command.durationSeconds,
        }) !== null,
      { message: 'Trimmed Region Source end time must be finite', path: ['durationSeconds'] }
    ),
  z.strictObject({
    type: z.literal(AudioCommandType.SLIP_REGION),
    trackId: z.uuid('Invalid Track ID format'),
    regionId: z.uuid('Invalid Region ID format'),
    sourceStartTimeSeconds: z.number().finite().nonnegative(),
  }),
  SetRegionProcessingCommandSchema,
  z.strictObject({
    type: z.literal(AudioCommandType.CREATE_REGION_CROSSFADE),
    crossfadeId: z.uuid('Invalid Crossfade ID format'),
    curve: z.enum(['equalPower', 'linear']),
    fadeInRegionId: z.uuid('Invalid fade-in Region ID format'),
    fadeOutRegionId: z.uuid('Invalid fade-out Region ID format'),
    trackId: z.uuid('Invalid Track ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.REMOVE_REGION_CROSSFADE),
    crossfadeId: z.uuid('Invalid Crossfade ID format'),
    trackId: z.uuid('Invalid Track ID format'),
  }),
  z.strictObject({
    type: z.literal(AudioCommandType.NORMALIZE_SELECTED_REGIONS),
    targetPeak: z.number().finite().positive().max(1),
  }),
  z.strictObject({ type: z.literal(AudioCommandType.REVERSE_SELECTED_REGIONS) }),
  z.strictObject({
    type: z.literal(AudioCommandType.STRIP_SILENCE_SELECTED_REGIONS),
    minimumSilenceSeconds: z.number().finite().positive().max(60),
    thresholdDb: z.number().finite().min(-120).max(0),
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
export const AGENT_AUDIO_COMMAND_BATCH_JSON_SCHEMA = JSON.stringify({
  type: 'array',
  items: {
    type: 'object',
  },
});

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

  if (typeof parsedResponse !== 'object' || parsedResponse === null) {
    return { commands: null, error: 'Agent response must be a JSON command or command array.' };
  }

  const commandBatch = Array.isArray(parsedResponse) ? parsedResponse : [parsedResponse];
  const validatedBatch = AgentAudioCommandBatchSchema.safeParse(commandBatch);
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
