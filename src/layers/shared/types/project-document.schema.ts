import { z } from 'zod';
import { calculateFiniteRegionSourceEndTime, isRegionSourceRangeWithinDuration } from '../audio-source-range';
import { MAX_LOOP_OVERDUB_LAYERS } from '../loop-time';
import { RECORD_MODES } from './multitrack-recording';
import { calculateFiniteRegionEndTime } from '../region-timeline';
import { ROUTING_CHANNEL_COUNTS, ROUTING_SEND_TAP_POINTS, ROUTING_TRACK_KINDS } from './routing-state';
import { AUTOMATION_INTERPOLATIONS, AUTOMATION_MODES, getAutomationTargetKey } from './automation-state';
import { MIDI_RECORD_MODES } from './midi-state';
import {
  EXPORT_CHANNEL_MODES,
  EXPORT_DITHER_MODES,
  EXPORT_FORMATS,
  EXPORT_MODES,
  EXPORT_SAMPLE_FORMATS,
} from './export-state';
import {
  CLIP_FOLLOW_ACTION_TYPES,
  CLIP_LAUNCH_MODES,
  type ClipFollowAction,
  type ClipLaunchMode,
  type CueState,
} from './clip-cue-state';

export const PROJECT_DOCUMENT_SCHEMA_VERSION = 1 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V2 = 2 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V3 = 3 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V4 = 4 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V5 = 5 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V6 = 6 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V7 = 7 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V8 = 8 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V9 = 9 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V10 = 10 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V11 = 11 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V12 = 12 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V13 = 13 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V14 = 14 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V15 = 15 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V16 = 16 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V17 = 17 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V18 = 18 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V19 = 19 as const;

const MAX_NAME_LENGTH = 255;
const MAX_MIME_TYPE_LENGTH = 255;
const MAX_PLUGIN_ENTRIES = 128;
const MAX_LOOP_SLOTS = 16;
const MAX_TIMELINE_MAP_ENTRIES = 256;
const MAX_ROUTING_ENTRIES = 512;
const MAX_RECORDING_ENTRIES = 512;
const MAX_AUTOMATION_LANES = 128;
const MAX_AUTOMATION_POINTS = 10_000;
const MAX_MIDI_REGIONS = 4_096;
const MAX_MIDI_NOTES = 100_000;
const MAX_MIDI_CONTROL_LANES = 128;
const MAX_MIDI_CONTROL_POINTS = 100_000;
const MAX_PLUGIN_STATE_BLOB_LENGTH = 1_000_000;
const MAX_SOURCE_TAGS = 32;
const MAX_EXPORT_PRESETS = 64;
const MAX_EXPORT_RANGES = 256;
const MAX_CUE_PERFORMANCES = 128;
const MAX_CUE_EVENTS = 10_000;
const MAX_TRANSIENT_POSITIONS = 100_000;
const MAX_BWF_TEXT_LENGTH = 65_535;
const nonBlankNameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);
const pluginTextSchema = z
  .string()
  .min(1)
  .max(MAX_NAME_LENGTH)
  .refine(value => value.trim() === value, 'Plugin text must not have surrounding whitespace');
const normalizedAudioValueSchema = z.number().min(0).max(1);
const midiInstrumentIdSchema = z
  .string()
  .min(1)
  .max(MAX_NAME_LENGTH)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/iu, 'Invalid MIDI instrument ID format');

export const ProjectAudioSourceSchema = z.strictObject({
  id: z.uuid('Invalid Source ID format'),
  fileName: nonBlankNameSchema,
  mimeType: z.string().max(MAX_MIME_TYPE_LENGTH),
  byteLength: z.number().int().nonnegative(),
  durationSeconds: z.number().nonnegative().nullable(),
});

const ProjectAudioSourceTagSchema = z
  .string()
  .min(1)
  .max(MAX_NAME_LENGTH)
  .refine(value => value.trim() === value, 'Source tag must not have surrounding whitespace');

export const ProjectBwfMetadataSchema = z.strictObject({
  codingHistory: z.string().max(MAX_BWF_TEXT_LENGTH),
  description: z.string().max(256),
  originationDate: z.string().max(10),
  originationTime: z.string().max(8),
  originator: z.string().max(32),
  originatorReference: z.string().max(32),
  timeReferenceSamples: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

export const ProjectAudioSourceDerivationSchema = z.strictObject({
  operation: z.enum(['reverse', 'stripSilence', 'timeStretch', 'pitchShift', 'transientAnalysis', 'bounce', 'freeze']),
  parameters: z.record(z.string(), z.number().finite()),
  sourceId: z.uuid('Invalid parent Source ID format'),
});

export const ProjectAudioSourceV16Schema = ProjectAudioSourceSchema.safeExtend({
  bwfMetadata: ProjectBwfMetadataSchema.nullable(),
  derivation: ProjectAudioSourceDerivationSchema.nullable(),
  tags: z.array(ProjectAudioSourceTagSchema).max(MAX_SOURCE_TAGS),
  transientPositionsSeconds: z.array(z.number().finite().nonnegative()).max(MAX_TRANSIENT_POSITIONS),
});

export const ProjectRegionSchema = z
  .strictObject({
    id: z.uuid('Invalid Region ID format'),
    sourceId: z.uuid('Invalid Source ID format'),
    startTimeSeconds: z.number().nonnegative(),
    sourceStartTimeSeconds: z.number().nonnegative(),
    durationSeconds: z.number().nonnegative(),
  })
  .refine(
    region =>
      calculateFiniteRegionEndTime({
        startTime: region.startTimeSeconds,
        duration: region.durationSeconds,
      }) !== null,
    {
      message: 'Region end time must be finite',
      path: ['durationSeconds'],
    }
  )
  .refine(
    region =>
      calculateFiniteRegionSourceEndTime({
        sourceStartTimeSeconds: region.sourceStartTimeSeconds,
        regionDurationSeconds: region.durationSeconds,
      }) !== null,
    {
      message: 'Region Source end time must be finite',
      path: ['durationSeconds'],
    }
  );

export const ProjectRegionFadeSchema = z
  .strictObject({
    crossfadeId: z.uuid('Invalid Crossfade ID format').nullable(),
    curve: z.union([z.literal('linear'), z.literal('equalPower')]),
    durationSeconds: z.number().finite().nonnegative(),
  })
  .refine(fade => fade.crossfadeId === null || fade.durationSeconds > 0, {
    message: 'A Crossfade requires a positive fade duration',
    path: ['durationSeconds'],
  });

export const ProjectRegionV8Schema = ProjectRegionSchema.safeExtend({
  fadeIn: ProjectRegionFadeSchema,
  fadeOut: ProjectRegionFadeSchema,
  gain: z.number().finite().nonnegative(),
  isOpaque: z.boolean(),
  layer: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

export const ProjectTrackSchema = z.strictObject({
  id: z.uuid('Invalid Track ID format'),
  name: nonBlankNameSchema,
  volume: normalizedAudioValueSchema,
  pan: z.number().min(-1).max(1),
  isMuted: z.boolean(),
  isSoloed: z.boolean(),
  regions: z.array(ProjectRegionSchema),
});

export const ProjectPluginParameterStateSchema = z.strictObject({
  id: pluginTextSchema,
  value: z.union([z.boolean(), z.number().finite(), pluginTextSchema]),
});

export const ProjectPluginInstanceSchema = z.strictObject({
  id: z.uuid('Invalid Plugin instance ID format'),
  manifestId: pluginTextSchema,
  manifestVersion: pluginTextSchema,
  isEnabled: z.boolean(),
  parameters: z.array(ProjectPluginParameterStateSchema).max(MAX_PLUGIN_ENTRIES),
});

export const ProjectTrackV2Schema = z.strictObject({
  id: z.uuid('Invalid Track ID format'),
  name: nonBlankNameSchema,
  volume: normalizedAudioValueSchema,
  pan: z.number().min(-1).max(1),
  isMuted: z.boolean(),
  isSoloed: z.boolean(),
  pluginInstances: z.array(ProjectPluginInstanceSchema).max(MAX_PLUGIN_ENTRIES),
  regions: z.array(ProjectRegionSchema),
});

const loopLengthBarsSchema = z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]);

export const ProjectLoopSlotSchema = z
  .strictObject({
    id: z.uuid('Invalid Loop Slot ID format'),
    sourceId: z.uuid('Invalid Source ID format').nullable(),
    lengthBars: loopLengthBarsSchema,
    quantizationBars: loopLengthBarsSchema,
    recordedTempoBpm: z.number().positive().nullable(),
    gain: normalizedAudioValueSchema,
  })
  .refine(slot => (slot.sourceId === null) === (slot.recordedTempoBpm === null), {
    message: 'Loop Slot Source and recorded tempo must both be present or absent',
    path: ['recordedTempoBpm'],
  });

export const ProjectTrackV3Schema = z.strictObject({
  id: z.uuid('Invalid Track ID format'),
  name: nonBlankNameSchema,
  volume: normalizedAudioValueSchema,
  pan: z.number().min(-1).max(1),
  isMuted: z.boolean(),
  isSoloed: z.boolean(),
  pluginInstances: z.array(ProjectPluginInstanceSchema).max(MAX_PLUGIN_ENTRIES),
  loopSlots: z.array(ProjectLoopSlotSchema).max(MAX_LOOP_SLOTS),
  regions: z.array(ProjectRegionSchema),
});

export const ProjectLoopSlotV4Schema = ProjectLoopSlotSchema.safeExtend({
  overdubSourceIds: z.array(z.uuid('Invalid Source ID format')).max(MAX_LOOP_OVERDUB_LAYERS),
})
  .refine(slot => slot.sourceId !== null || slot.overdubSourceIds.length === 0, {
    message: 'Loop Slot overdub Sources require a base Source',
    path: ['overdubSourceIds'],
  })
  .refine(
    slot => {
      const sourceIds = slot.sourceId === null ? slot.overdubSourceIds : [slot.sourceId, ...slot.overdubSourceIds];
      return new Set(sourceIds).size === sourceIds.length;
    },
    {
      message: 'Loop Slot Source IDs must be unique',
      path: ['overdubSourceIds'],
    }
  );

export const ProjectTrackV4Schema = ProjectTrackV3Schema.safeExtend({
  loopSlots: z.array(ProjectLoopSlotV4Schema).max(MAX_LOOP_SLOTS),
});

export const ProjectTrackV8Schema = ProjectTrackV4Schema.safeExtend({
  regions: z.array(ProjectRegionV8Schema),
});

export const ProjectTimelineRangeSchema = z
  .strictObject({
    startTimeSeconds: z.number().nonnegative(),
    endTimeSeconds: z.number().nonnegative(),
  })
  .refine(range => range.endTimeSeconds >= range.startTimeSeconds, {
    message: 'Export end time must be greater than or equal to start time',
    path: ['endTimeSeconds'],
  });

const ProjectDocumentV1BaseSchema = z.strictObject({
  documentType: z.literal('drop-ai-project'),
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION),
  project: z.strictObject({
    id: z.uuid('Invalid Project ID format'),
    name: nonBlankNameSchema,
    revision: z.number().int().nonnegative(),
  }),
  timeline: z.strictObject({
    timeUnit: z.literal('seconds'),
    tempoBpm: z.number().positive(),
  }),
  mixer: z.strictObject({
    masterVolume: normalizedAudioValueSchema,
  }),
  exportRange: ProjectTimelineRangeSchema.nullable(),
  audioSources: z.array(ProjectAudioSourceSchema),
  tracks: z.array(ProjectTrackSchema),
});

const ProjectDocumentV2BaseSchema = z.strictObject({
  documentType: z.literal('drop-ai-project'),
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V2),
  project: z.strictObject({
    id: z.uuid('Invalid Project ID format'),
    name: nonBlankNameSchema,
    revision: z.number().int().nonnegative(),
  }),
  timeline: z.strictObject({
    timeUnit: z.literal('seconds'),
    tempoBpm: z.number().positive(),
  }),
  mixer: z.strictObject({
    masterVolume: normalizedAudioValueSchema,
  }),
  exportRange: ProjectTimelineRangeSchema.nullable(),
  audioSources: z.array(ProjectAudioSourceSchema),
  tracks: z.array(ProjectTrackV2Schema),
});

const ProjectDocumentV3BaseSchema = z.strictObject({
  documentType: z.literal('drop-ai-project'),
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V3),
  project: z.strictObject({
    id: z.uuid('Invalid Project ID format'),
    name: nonBlankNameSchema,
    revision: z.number().int().nonnegative(),
  }),
  timeline: z.strictObject({
    timeUnit: z.literal('seconds'),
    tempoBpm: z.number().positive(),
  }),
  mixer: z.strictObject({
    masterVolume: normalizedAudioValueSchema,
  }),
  exportRange: ProjectTimelineRangeSchema.nullable(),
  audioSources: z.array(ProjectAudioSourceSchema),
  tracks: z.array(ProjectTrackV3Schema),
});

const ProjectDocumentV4BaseSchema = z.strictObject({
  documentType: z.literal('drop-ai-project'),
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V4),
  project: z.strictObject({
    id: z.uuid('Invalid Project ID format'),
    name: nonBlankNameSchema,
    revision: z.number().int().nonnegative(),
  }),
  timeline: z.strictObject({
    timeUnit: z.literal('seconds'),
    tempoBpm: z.number().positive(),
  }),
  mixer: z.strictObject({
    masterVolume: normalizedAudioValueSchema,
  }),
  exportRange: ProjectTimelineRangeSchema.nullable(),
  audioSources: z.array(ProjectAudioSourceSchema),
  tracks: z.array(ProjectTrackV4Schema),
});

export const ProjectTempoChangeSchema = z.strictObject({
  quarterNotePosition: z.number().nonnegative(),
  bpm: z.number().positive(),
});

export const ProjectMeterChangeSchema = z.strictObject({
  quarterNotePosition: z.number().nonnegative(),
  beatsPerBar: z.number().int().positive(),
  beatUnit: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32)]),
});

export const ProjectTimelineMarkerSchema = z.strictObject({
  id: z.uuid('Invalid Timeline marker ID format'),
  name: nonBlankNameSchema,
  quarterNotePosition: z.number().nonnegative(),
});

const ProjectDocumentV5BaseSchema = z.strictObject({
  documentType: z.literal('drop-ai-project'),
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V5),
  project: z.strictObject({
    id: z.uuid('Invalid Project ID format'),
    name: nonBlankNameSchema,
    revision: z.number().int().nonnegative(),
  }),
  timeline: z.strictObject({
    timeUnit: z.literal('seconds'),
    tempoBpm: z.number().positive(),
    tempoChanges: z.array(ProjectTempoChangeSchema).min(1).max(MAX_TIMELINE_MAP_ENTRIES),
    meterChanges: z.array(ProjectMeterChangeSchema).min(1).max(MAX_TIMELINE_MAP_ENTRIES),
  }),
  mixer: z.strictObject({
    masterVolume: normalizedAudioValueSchema,
  }),
  exportRange: ProjectTimelineRangeSchema.nullable(),
  audioSources: z.array(ProjectAudioSourceSchema),
  tracks: z.array(ProjectTrackV4Schema),
});

const ProjectDocumentV6BaseSchema = z.strictObject({
  documentType: z.literal('drop-ai-project'),
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V6),
  project: z.strictObject({
    id: z.uuid('Invalid Project ID format'),
    name: nonBlankNameSchema,
    revision: z.number().int().nonnegative(),
  }),
  timeline: z.strictObject({
    timeUnit: z.literal('seconds'),
    tempoBpm: z.number().positive(),
    tempoChanges: z.array(ProjectTempoChangeSchema).min(1).max(MAX_TIMELINE_MAP_ENTRIES),
    meterChanges: z.array(ProjectMeterChangeSchema).min(1).max(MAX_TIMELINE_MAP_ENTRIES),
    markers: z.array(ProjectTimelineMarkerSchema).max(MAX_TIMELINE_MAP_ENTRIES),
  }),
  mixer: z.strictObject({
    masterVolume: normalizedAudioValueSchema,
  }),
  exportRange: ProjectTimelineRangeSchema.nullable(),
  audioSources: z.array(ProjectAudioSourceSchema),
  tracks: z.array(ProjectTrackV4Schema),
});

export const ProjectLoopSettingsSchema = z
  .strictObject({
    isEnabled: z.boolean(),
    range: ProjectTimelineRangeSchema.nullable(),
  })
  .refine(loop => loop.range === null || loop.range.endTimeSeconds > loop.range.startTimeSeconds, {
    message: 'Loop end time must be greater than start time',
    path: ['range', 'endTimeSeconds'],
  })
  .refine(loop => !loop.isEnabled || loop.range !== null, {
    message: 'An enabled Loop requires a range',
    path: ['range'],
  });

export const ProjectMetronomeSettingsSchema = z.strictObject({
  isEnabled: z.boolean(),
  volume: normalizedAudioValueSchema,
});

const ProjectDocumentV7BaseSchema = z.strictObject({
  documentType: z.literal('drop-ai-project'),
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V7),
  project: z.strictObject({
    id: z.uuid('Invalid Project ID format'),
    name: nonBlankNameSchema,
    revision: z.number().int().nonnegative(),
  }),
  timeline: z.strictObject({
    timeUnit: z.literal('seconds'),
    tempoBpm: z.number().positive(),
    tempoChanges: z.array(ProjectTempoChangeSchema).min(1).max(MAX_TIMELINE_MAP_ENTRIES),
    meterChanges: z.array(ProjectMeterChangeSchema).min(1).max(MAX_TIMELINE_MAP_ENTRIES),
    markers: z.array(ProjectTimelineMarkerSchema).max(MAX_TIMELINE_MAP_ENTRIES),
    loop: ProjectLoopSettingsSchema,
    metronome: ProjectMetronomeSettingsSchema,
  }),
  mixer: z.strictObject({
    masterVolume: normalizedAudioValueSchema,
  }),
  exportRange: ProjectTimelineRangeSchema.nullable(),
  audioSources: z.array(ProjectAudioSourceSchema),
  tracks: z.array(ProjectTrackV4Schema),
});

const ProjectDocumentV8BaseSchema = ProjectDocumentV7BaseSchema.omit({ schemaVersion: true, tracks: true }).extend({
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V8),
  tracks: z.array(ProjectTrackV8Schema),
});

export const ProjectRoutingRouteTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('master') }),
  z.strictObject({ kind: z.literal('track'), trackId: z.uuid('Invalid Track ID format') }),
  z.strictObject({ kind: z.literal('none') }),
]);

export const ProjectRoutingRouteSchema = z.strictObject({
  trackId: z.uuid('Invalid Track ID format'),
  kind: z.enum(ROUTING_TRACK_KINDS),
  channelCount: z.union([z.literal(ROUTING_CHANNEL_COUNTS[0]), z.literal(ROUTING_CHANNEL_COUNTS[1])]),
  output: ProjectRoutingRouteTargetSchema,
  folderId: z.uuid('Invalid Folder Track ID format').nullable(),
  vcaIds: z.array(z.uuid('Invalid VCA Track ID format')).max(MAX_ROUTING_ENTRIES),
});

export const ProjectRoutingSendSchema = z.strictObject({
  id: z.uuid('Invalid Send ID format'),
  sourceTrackId: z.uuid('Invalid Track ID format'),
  destinationTrackId: z.uuid('Invalid Track ID format'),
  gain: normalizedAudioValueSchema,
  tapPoint: z.enum(ROUTING_SEND_TAP_POINTS),
  isEnabled: z.boolean(),
});

export const ProjectRoutingGraphSchema = z.strictObject({
  routes: z.array(ProjectRoutingRouteSchema).max(MAX_ROUTING_ENTRIES),
  sends: z.array(ProjectRoutingSendSchema).max(MAX_ROUTING_ENTRIES),
});

const ProjectDocumentV9BaseSchema = ProjectDocumentV8BaseSchema.omit({ schemaVersion: true, mixer: true }).extend({
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V9),
  mixer: z.strictObject({
    masterVolume: normalizedAudioValueSchema,
    routing: ProjectRoutingGraphSchema,
  }),
});

export const ProjectTakeSchema = z.strictObject({
  createdAtEpochMilliseconds: z.number().int().nonnegative(),
  durationSeconds: z.number().finite().positive(),
  id: z.uuid('Invalid Take ID format'),
  sourceId: z.uuid('Invalid Source ID format'),
  sourceStartTimeSeconds: z.number().finite().nonnegative(),
  startTimeSeconds: z.number().finite().nonnegative(),
  takeNumber: z.number().int().positive(),
});

export const ProjectCompSegmentSchema = z
  .strictObject({
    endTimeSeconds: z.number().finite().nonnegative(),
    id: z.uuid('Invalid Comp Segment ID format'),
    startTimeSeconds: z.number().finite().nonnegative(),
    takeId: z.uuid('Invalid Take ID format'),
  })
  .refine(segment => segment.endTimeSeconds > segment.startTimeSeconds, {
    message: 'Comp Segment end time must be greater than start time',
    path: ['endTimeSeconds'],
  });

export const ProjectPlaylistSchema = z.strictObject({
  compSegments: z.array(ProjectCompSegmentSchema).max(MAX_RECORDING_ENTRIES),
  id: z.uuid('Invalid Playlist ID format'),
  name: nonBlankNameSchema,
  takes: z.array(ProjectTakeSchema).max(MAX_RECORDING_ENTRIES),
});

export const ProjectTrackRecordingSchema = z.strictObject({
  activePlaylistId: z.uuid('Invalid Playlist ID format').nullable(),
  playlists: z.array(ProjectPlaylistSchema).max(MAX_RECORDING_ENTRIES),
  recordMode: z.enum(RECORD_MODES),
});

export const ProjectTrackV10Schema = ProjectTrackV8Schema.safeExtend({
  recording: ProjectTrackRecordingSchema,
});

export const ProjectRecoverableRecordingSourceSchema = z.strictObject({
  byteLength: z.number().int().nonnegative(),
  createdAtEpochMilliseconds: z.number().int().nonnegative(),
  fileName: nonBlankNameSchema,
  mimeType: z.string().max(MAX_MIME_TYPE_LENGTH),
  sourceId: z.uuid('Invalid Source ID format'),
  trackId: z.uuid('Invalid Track ID format'),
});

export const ProjectPunchRecordingSchema = z
  .strictObject({
    isEnabled: z.boolean(),
    range: ProjectTimelineRangeSchema.nullable(),
  })
  .refine(punch => punch.range === null || punch.range.endTimeSeconds > punch.range.startTimeSeconds, {
    message: 'Punch end time must be greater than start time',
    path: ['range', 'endTimeSeconds'],
  })
  .refine(punch => !punch.isEnabled || punch.range !== null, {
    message: 'Enabled Punch recording requires a range',
    path: ['range'],
  });

export const ProjectRecordingSchema = z.strictObject({
  punch: ProjectPunchRecordingSchema,
  recoverableSources: z.array(ProjectRecoverableRecordingSourceSchema).max(MAX_RECORDING_ENTRIES),
});

const ProjectDocumentV10BaseSchema = ProjectDocumentV9BaseSchema.omit({ schemaVersion: true, tracks: true }).extend({
  recording: ProjectRecordingSchema,
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V10),
  tracks: z.array(ProjectTrackV10Schema),
});

export const ProjectAutomationTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('trackVolume') }),
  z.strictObject({ kind: z.literal('trackPan') }),
  z.strictObject({ kind: z.literal('sendGain'), sendId: z.uuid('Invalid Send ID format') }),
  z.strictObject({
    kind: z.literal('pluginParameter'),
    parameterId: pluginTextSchema,
    pluginInstanceId: z.uuid('Invalid Plugin instance ID format'),
  }),
]);

export const ProjectAutomationPointSchema = z.strictObject({
  id: z.uuid('Invalid Automation point ID format'),
  interpolation: z.enum(AUTOMATION_INTERPOLATIONS),
  timeSeconds: z.number().finite().nonnegative(),
  value: normalizedAudioValueSchema,
});

export const ProjectAutomationLaneSchema = z.strictObject({
  id: z.uuid('Invalid Automation lane ID format'),
  isEnabled: z.boolean(),
  points: z.array(ProjectAutomationPointSchema).max(MAX_AUTOMATION_POINTS),
  target: ProjectAutomationTargetSchema,
});

export const ProjectTrackV11Schema = ProjectTrackV10Schema.safeExtend({
  automationLanes: z.array(ProjectAutomationLaneSchema).max(MAX_AUTOMATION_LANES),
});

const ProjectDocumentV11BaseSchema = ProjectDocumentV10BaseSchema.omit({ schemaVersion: true, tracks: true }).extend({
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V11),
  tracks: z.array(ProjectTrackV11Schema),
});

export const ProjectAutomationLaneV12Schema = ProjectAutomationLaneSchema.safeExtend({
  mode: z.enum(AUTOMATION_MODES),
});

export const ProjectTrackV12Schema = ProjectTrackV11Schema.safeExtend({
  automationLanes: z.array(ProjectAutomationLaneV12Schema).max(MAX_AUTOMATION_LANES),
});

const ProjectDocumentV12BaseSchema = ProjectDocumentV11BaseSchema.omit({ schemaVersion: true, tracks: true }).extend({
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V12),
  tracks: z.array(ProjectTrackV12Schema),
});

export const ProjectMidiNoteSchema = z.strictObject({
  channel: z.number().int().min(1).max(16),
  durationSeconds: z.number().finite().positive(),
  id: z.uuid('Invalid MIDI Note ID format'),
  pitch: z.number().int().min(0).max(127),
  startOffsetSeconds: z.number().finite().nonnegative(),
  velocity: z.number().int().min(1).max(127),
});

export const ProjectMidiRegionSchema = z
  .strictObject({
    durationSeconds: z.number().finite().positive(),
    id: z.uuid('Invalid MIDI Region ID format'),
    name: nonBlankNameSchema,
    notes: z.array(ProjectMidiNoteSchema).max(MAX_MIDI_NOTES),
    startTimeSeconds: z.number().finite().nonnegative(),
  })
  .superRefine((region, context) => {
    region.notes.forEach((note, noteIndex) => {
      const noteEndOffsetSeconds = note.startOffsetSeconds + note.durationSeconds;
      if (Number.isFinite(noteEndOffsetSeconds) && noteEndOffsetSeconds <= region.durationSeconds) {
        return;
      }
      context.addIssue({
        code: 'custom',
        message: 'MIDI Note must stay inside its Region',
        path: ['notes', noteIndex, 'durationSeconds'],
      });
    });
  });

export const ProjectMidiTrackSchema = z.strictObject({
  instrumentId: midiInstrumentIdSchema,
  regions: z.array(ProjectMidiRegionSchema).max(MAX_MIDI_REGIONS),
});

export const ProjectTrackV13Schema = ProjectTrackV12Schema.safeExtend({
  midi: ProjectMidiTrackSchema.nullable(),
});

const ProjectDocumentV13BaseSchema = ProjectDocumentV12BaseSchema.omit({ schemaVersion: true, tracks: true }).extend({
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V13),
  tracks: z.array(ProjectTrackV13Schema),
});

const ProjectMidiControlPointBaseSchema = z.strictObject({
  id: z.uuid('Invalid MIDI Control Point ID format'),
  timeOffsetSeconds: z.number().finite().nonnegative(),
});

export const ProjectMidiControlChangePointSchema = ProjectMidiControlPointBaseSchema.extend({
  value: z.number().int().min(0).max(127),
});

export const ProjectMidiPitchBendPointSchema = ProjectMidiControlPointBaseSchema.extend({
  value: z.number().int().min(-8192).max(8191),
});

export const ProjectMidiChannelPressurePointSchema = ProjectMidiControlPointBaseSchema.extend({
  value: z.number().int().min(0).max(127),
});

const ProjectMidiControlLaneBaseShape = {
  channel: z.number().int().min(1).max(16),
  id: z.uuid('Invalid MIDI Control Lane ID format'),
};

export const ProjectMidiControlChangeLaneSchema = z.strictObject({
  ...ProjectMidiControlLaneBaseShape,
  controllerNumber: z.number().int().min(0).max(127),
  points: z.array(ProjectMidiControlChangePointSchema).max(MAX_MIDI_CONTROL_POINTS),
  type: z.literal('controlChange'),
});

export const ProjectMidiPitchBendLaneSchema = z.strictObject({
  ...ProjectMidiControlLaneBaseShape,
  points: z.array(ProjectMidiPitchBendPointSchema).max(MAX_MIDI_CONTROL_POINTS),
  type: z.literal('pitchBend'),
});

export const ProjectMidiChannelPressureLaneSchema = z.strictObject({
  ...ProjectMidiControlLaneBaseShape,
  points: z.array(ProjectMidiChannelPressurePointSchema).max(MAX_MIDI_CONTROL_POINTS),
  type: z.literal('channelPressure'),
});

export const ProjectMidiControlLaneSchema = z.discriminatedUnion('type', [
  ProjectMidiControlChangeLaneSchema,
  ProjectMidiPitchBendLaneSchema,
  ProjectMidiChannelPressureLaneSchema,
]);

export const ProjectMidiRegionV14Schema = ProjectMidiRegionSchema.safeExtend({
  controlLanes: z.array(ProjectMidiControlLaneSchema).max(MAX_MIDI_CONTROL_LANES),
}).superRefine((region, context) => {
  region.controlLanes.forEach((lane, laneIndex) => {
    lane.points.forEach((point, pointIndex) => {
      if (point.timeOffsetSeconds < region.durationSeconds) {
        return;
      }
      context.addIssue({
        code: 'custom',
        message: 'MIDI Control Point must stay inside its Region',
        path: ['controlLanes', laneIndex, 'points', pointIndex, 'timeOffsetSeconds'],
      });
    });
  });
});

export const ProjectMidiTrackV14Schema = z.strictObject({
  instrumentId: midiInstrumentIdSchema,
  recordMode: z.enum(MIDI_RECORD_MODES),
  regions: z.array(ProjectMidiRegionV14Schema).max(MAX_MIDI_REGIONS),
});

export const ProjectTrackV14Schema = ProjectTrackV13Schema.safeExtend({
  midi: ProjectMidiTrackV14Schema.nullable(),
});

const ProjectDocumentV14BaseSchema = ProjectDocumentV13BaseSchema.omit({ schemaVersion: true, tracks: true }).extend({
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V14),
  tracks: z.array(ProjectTrackV14Schema),
});

export const ProjectPluginInstanceV15Schema = ProjectPluginInstanceSchema.safeExtend({
  presetId: pluginTextSchema.nullable(),
  sidechainSourceTrackId: z.uuid('Invalid sidechain source Track ID format').nullable(),
  stateBlob: z.string().max(MAX_PLUGIN_STATE_BLOB_LENGTH).nullable(),
});

export const ProjectTrackV15Schema = ProjectTrackV14Schema.safeExtend({
  pluginInstances: z.array(ProjectPluginInstanceV15Schema).max(MAX_PLUGIN_ENTRIES),
});

const ProjectDocumentV15BaseSchema = ProjectDocumentV14BaseSchema.omit({ schemaVersion: true, tracks: true }).extend({
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V15),
  tracks: z.array(ProjectTrackV15Schema),
});

const ProjectDocumentV16BaseSchema = ProjectDocumentV15BaseSchema.omit({
  schemaVersion: true,
  audioSources: true,
}).extend({
  audioSources: z.array(ProjectAudioSourceV16Schema),
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V16),
});

export const ProjectExportNormalizationSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('none') }),
  z.strictObject({ mode: z.literal('peak'), targetDbfs: z.number().finite().min(-60).max(0) }),
  z.strictObject({ mode: z.literal('lufs'), targetLufs: z.number().finite().min(-70).max(0) }),
]);

export const ProjectExportPresetSchema = z.strictObject({
  channelMode: z.enum(EXPORT_CHANNEL_MODES),
  dither: z.enum(EXPORT_DITHER_MODES),
  exportMode: z.enum(EXPORT_MODES),
  format: z.enum(EXPORT_FORMATS),
  id: pluginTextSchema,
  name: nonBlankNameSchema,
  normalization: ProjectExportNormalizationSchema,
  sampleFormat: z.enum(EXPORT_SAMPLE_FORMATS),
  sampleRate: z.number().int().min(8_000).max(192_000),
});

export const ProjectExportRangeSchema = z
  .strictObject({
    endTimeSeconds: z.number().finite().positive(),
    id: z.uuid('Invalid Export Range ID format'),
    name: nonBlankNameSchema,
    startTimeSeconds: z.number().finite().nonnegative(),
  })
  .refine(range => range.endTimeSeconds > range.startTimeSeconds, {
    message: 'Export Range end must be greater than start',
    path: ['endTimeSeconds'],
  });

export const ProjectExportSettingsSchema = z.strictObject({
  activePresetId: pluginTextSchema,
  presets: z.array(ProjectExportPresetSchema).min(1).max(MAX_EXPORT_PRESETS),
  ranges: z.array(ProjectExportRangeSchema).max(MAX_EXPORT_RANGES),
});

const ProjectDocumentV17BaseSchema = ProjectDocumentV16BaseSchema.omit({ schemaVersion: true }).extend({
  exportSettings: ProjectExportSettingsSchema,
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V17),
});

const lifecycleNameSchema = z.string().trim().min(1).max(120);
const lifecycleTimestampSchema = z.iso.datetime({ offset: true });

export const ProjectNamedSnapshotSchema = z.strictObject({
  createdAt: lifecycleTimestampSchema,
  document: z.lazy(() => ProjectDocumentV17Schema),
  id: z.uuid('Invalid Snapshot ID format'),
  name: lifecycleNameSchema,
});

export const ProjectTemplateSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    createdAt: lifecycleTimestampSchema,
    document: z.lazy(() => ProjectDocumentV17Schema),
    id: z.uuid('Invalid Session Template ID format'),
    kind: z.literal('session'),
    name: lifecycleNameSchema,
  }),
  z
    .strictObject({
      createdAt: lifecycleTimestampSchema,
      document: z.lazy(() => ProjectDocumentV17Schema),
      id: z.uuid('Invalid Track Template ID format'),
      kind: z.literal('track'),
      name: lifecycleNameSchema,
    })
    .refine(template => template.document.tracks.length === 1, {
      message: 'Track Template must contain exactly one Track',
      path: ['document', 'tracks'],
    }),
]);

export const ProjectLifecycleStateSchema = z.strictObject({
  snapshots: z.array(ProjectNamedSnapshotSchema).max(32),
  templates: z.array(ProjectTemplateSchema).max(32),
});

const ProjectDocumentV18BaseSchema = ProjectDocumentV17BaseSchema.omit({ schemaVersion: true }).extend({
  lifecycle: ProjectLifecycleStateSchema,
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V18),
});

export const ProjectClipFollowActionSchema = z.strictObject({
  afterBars: loopLengthBarsSchema,
  type: z.enum(CLIP_FOLLOW_ACTION_TYPES),
});

export const ProjectLoopSlotV19Schema = ProjectLoopSlotV4Schema.safeExtend({
  followAction: ProjectClipFollowActionSchema,
  launchMode: z.enum(CLIP_LAUNCH_MODES),
  name: nonBlankNameSchema,
  sourceEndTimeSeconds: z.number().finite().positive().nullable(),
  sourceStartTimeSeconds: z.number().finite().nonnegative(),
})
  .refine(slot => slot.sourceEndTimeSeconds === null || slot.sourceEndTimeSeconds > slot.sourceStartTimeSeconds, {
    message: 'Clip Source end must be greater than start',
    path: ['sourceEndTimeSeconds'],
  })
  .refine(slot => slot.sourceId !== null || (slot.sourceStartTimeSeconds === 0 && slot.sourceEndTimeSeconds === null), {
    message: 'Empty Clip Slot must not contain a Source range',
    path: ['sourceStartTimeSeconds'],
  });

export const ProjectTrackV19Schema = ProjectTrackV15Schema.omit({ loopSlots: true }).extend({
  loopSlots: z.array(ProjectLoopSlotV19Schema).max(MAX_LOOP_SLOTS),
});

export const ProjectCueEventSchema = z.strictObject({
  durationQuarterNotes: z.number().finite().positive(),
  id: z.uuid('Invalid Cue Event ID format'),
  slotId: z.uuid('Invalid Loop Slot ID format'),
  startQuarterNotes: z.number().finite().nonnegative(),
  trackId: z.uuid('Invalid Track ID format'),
});

export const ProjectCuePerformanceSchema = z.strictObject({
  createdAt: lifecycleTimestampSchema,
  events: z.array(ProjectCueEventSchema).max(MAX_CUE_EVENTS),
  id: z.uuid('Invalid Cue Performance ID format'),
  name: lifecycleNameSchema,
});

export const ProjectCueStateSchema = z.strictObject({
  performances: z.array(ProjectCuePerformanceSchema).max(MAX_CUE_PERFORMANCES),
});

const ProjectDocumentV19BaseSchema = ProjectDocumentV18BaseSchema.omit({ schemaVersion: true, tracks: true }).extend({
  cue: ProjectCueStateSchema,
  schemaVersion: z.literal(PROJECT_DOCUMENT_SCHEMA_VERSION_V19),
  tracks: z.array(ProjectTrackV19Schema),
});

interface IdentifiedDocumentPath {
  id: string;
  path: Array<string | number>;
}

interface DuplicateIdValidationOptions {
  readonly entries: readonly IdentifiedDocumentPath[];
  readonly label: string;
  readonly context: z.RefinementCtx;
}

type RefinableProjectDocument =
  | z.infer<typeof ProjectDocumentV1BaseSchema>
  | z.infer<typeof ProjectDocumentV2BaseSchema>
  | z.infer<typeof ProjectDocumentV3BaseSchema>
  | z.infer<typeof ProjectDocumentV4BaseSchema>
  | z.infer<typeof ProjectDocumentV5BaseSchema>
  | z.infer<typeof ProjectDocumentV6BaseSchema>
  | z.infer<typeof ProjectDocumentV7BaseSchema>
  | z.infer<typeof ProjectDocumentV8BaseSchema>
  | z.infer<typeof ProjectDocumentV9BaseSchema>
  | z.infer<typeof ProjectDocumentV10BaseSchema>
  | z.infer<typeof ProjectDocumentV11BaseSchema>
  | z.infer<typeof ProjectDocumentV12BaseSchema>
  | z.infer<typeof ProjectDocumentV13BaseSchema>
  | z.infer<typeof ProjectDocumentV14BaseSchema>;
type RefinableProjectTrack =
  | z.infer<typeof ProjectTrackSchema>
  | z.infer<typeof ProjectTrackV2Schema>
  | z.infer<typeof ProjectTrackV3Schema>
  | z.infer<typeof ProjectTrackV4Schema>
  | z.infer<typeof ProjectTrackV8Schema>
  | z.infer<typeof ProjectTrackV10Schema>
  | z.infer<typeof ProjectTrackV11Schema>
  | z.infer<typeof ProjectTrackV12Schema>
  | z.infer<typeof ProjectTrackV13Schema>
  | z.infer<typeof ProjectTrackV14Schema>;

function isProjectTrackWithLoopSlots(
  track: RefinableProjectTrack
): track is
  | z.infer<typeof ProjectTrackV3Schema>
  | z.infer<typeof ProjectTrackV4Schema>
  | z.infer<typeof ProjectTrackV8Schema>
  | z.infer<typeof ProjectTrackV10Schema>
  | z.infer<typeof ProjectTrackV11Schema>
  | z.infer<typeof ProjectTrackV12Schema>
  | z.infer<typeof ProjectTrackV13Schema>
  | z.infer<typeof ProjectTrackV14Schema> {
  return 'loopSlots' in track;
}

function getLoopSlotSourceIds(
  slot: z.infer<typeof ProjectLoopSlotSchema> | z.infer<typeof ProjectLoopSlotV4Schema>
): readonly string[] {
  return slot.sourceId === null ? [] : [slot.sourceId, ...('overdubSourceIds' in slot ? slot.overdubSourceIds : [])];
}

function addDuplicateIdIssues({ entries, label, context }: DuplicateIdValidationOptions): void {
  const seenIds = new Set<string>();

  entries.forEach(entry => {
    if (seenIds.has(entry.id)) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate ${label} ID: ${entry.id}`,
        path: entry.path,
      });
      return;
    }

    seenIds.add(entry.id);
  });
}

function validateProjectRelations(document: RefinableProjectDocument, context: z.RefinementCtx): void {
  const sourceEntries = document.audioSources.map((source, sourceIndex) => ({
    id: source.id,
    path: ['audioSources', sourceIndex, 'id'],
  }));
  const trackEntries = document.tracks.map((track, trackIndex) => ({
    id: track.id,
    path: ['tracks', trackIndex, 'id'],
  }));
  const regionEntries = document.tracks.flatMap((track, trackIndex) =>
    track.regions.map((region, regionIndex) => ({
      id: region.id,
      path: ['tracks', trackIndex, 'regions', regionIndex, 'id'],
    }))
  );

  addDuplicateIdIssues({ entries: sourceEntries, label: 'Source', context });
  addDuplicateIdIssues({ entries: trackEntries, label: 'Track', context });
  addDuplicateIdIssues({ entries: regionEntries, label: 'Region', context });

  const loopSlotEntries = document.tracks.flatMap((track, trackIndex) =>
    isProjectTrackWithLoopSlots(track)
      ? track.loopSlots.map((slot, slotIndex) => ({
          id: slot.id,
          path: ['tracks', trackIndex, 'loopSlots', slotIndex, 'id'],
        }))
      : []
  );
  addDuplicateIdIssues({ entries: loopSlotEntries, label: 'Loop Slot', context });

  const sourcesById = new Map(document.audioSources.map(source => [source.id, source]));
  document.tracks.forEach((track, trackIndex) => {
    track.regions.forEach((region, regionIndex) => {
      const source = sourcesById.get(region.sourceId);
      if (!source) {
        context.addIssue({
          code: 'custom',
          message: `Region references a missing Source ID: ${region.sourceId}`,
          path: ['tracks', trackIndex, 'regions', regionIndex, 'sourceId'],
        });
        return;
      }

      if (source.durationSeconds === null) {
        return;
      }

      if (
        isRegionSourceRangeWithinDuration({
          sourceDurationSeconds: source.durationSeconds,
          sourceStartTimeSeconds: region.sourceStartTimeSeconds,
          regionDurationSeconds: region.durationSeconds,
        })
      ) {
        return;
      }

      context.addIssue({
        code: 'custom',
        message: `Region exceeds Source duration: ${region.sourceId}`,
        path: ['tracks', trackIndex, 'regions', regionIndex, 'durationSeconds'],
      });
    });

    if (!isProjectTrackWithLoopSlots(track)) {
      return;
    }

    track.loopSlots.forEach((slot, slotIndex) => {
      getLoopSlotSourceIds(slot).forEach((sourceId, sourceIndex) => {
        if (sourcesById.has(sourceId)) {
          return;
        }
        const sourcePath =
          sourceIndex === 0
            ? ['tracks', trackIndex, 'loopSlots', slotIndex, 'sourceId']
            : ['tracks', trackIndex, 'loopSlots', slotIndex, 'overdubSourceIds', sourceIndex - 1];
        context.addIssue({
          code: 'custom',
          message: `Loop Slot references a missing Source ID: ${sourceId}`,
          path: sourcePath,
        });
      });
    });
  });
}

function validatePluginState(
  document:
    | z.infer<typeof ProjectDocumentV2BaseSchema>
    | z.infer<typeof ProjectDocumentV3BaseSchema>
    | z.infer<typeof ProjectDocumentV4BaseSchema>
    | z.infer<typeof ProjectDocumentV5BaseSchema>
    | z.infer<typeof ProjectDocumentV6BaseSchema>
    | z.infer<typeof ProjectDocumentV7BaseSchema>
    | z.infer<typeof ProjectDocumentV8BaseSchema>
    | z.infer<typeof ProjectDocumentV9BaseSchema>
    | z.infer<typeof ProjectDocumentV10BaseSchema>
    | z.infer<typeof ProjectDocumentV11BaseSchema>
    | z.infer<typeof ProjectDocumentV12BaseSchema>
    | z.infer<typeof ProjectDocumentV13BaseSchema>
    | z.infer<typeof ProjectDocumentV14BaseSchema>,
  context: z.RefinementCtx
): void {
  const instanceEntries = document.tracks.flatMap((track, trackIndex) =>
    track.pluginInstances.map((instance, instanceIndex) => ({
      id: instance.id,
      path: ['tracks', trackIndex, 'pluginInstances', instanceIndex, 'id'],
    }))
  );
  addDuplicateIdIssues({ entries: instanceEntries, label: 'Plugin instance', context });

  document.tracks.forEach((track, trackIndex) => {
    track.pluginInstances.forEach((instance, instanceIndex) => {
      const parameterEntries = instance.parameters.map((parameter, parameterIndex) => ({
        id: parameter.id,
        path: ['tracks', trackIndex, 'pluginInstances', instanceIndex, 'parameters', parameterIndex, 'id'],
      }));
      addDuplicateIdIssues({ entries: parameterEntries, label: 'Plugin Parameter', context });
    });
  });
}

export const ProjectDocumentSchema = ProjectDocumentV1BaseSchema.superRefine(validateProjectRelations);
export const ProjectDocumentV2Schema = ProjectDocumentV2BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
});
export const ProjectDocumentV3Schema = ProjectDocumentV3BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
});
export const ProjectDocumentV4Schema = ProjectDocumentV4BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
});
export const ProjectDocumentV5Schema = ProjectDocumentV5BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
  validateTimelineMap(document, context);
});
export const ProjectDocumentV6Schema = ProjectDocumentV6BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
  validateTimelineMap(document, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
});
export const ProjectDocumentV7Schema = ProjectDocumentV7BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
  validateTimelineMap(document, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
});
export const ProjectDocumentV8Schema = ProjectDocumentV8BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
  validateTimelineMap(document, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
  validateRegionProcessing(document, context);
});
export const ProjectDocumentV9Schema = ProjectDocumentV9BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
  validateTimelineMap(document, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
  validateRegionProcessing(document, context);
  validateRoutingGraph(document, context);
});
export const ProjectDocumentV10Schema = ProjectDocumentV10BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
  validateTimelineMap(document, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
  validateRegionProcessing(document, context);
  validateRoutingGraph(document, context);
  validateRecordingState(document, context);
});
export const ProjectDocumentV11Schema = ProjectDocumentV11BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
  validateTimelineMap(document, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
  validateRegionProcessing(document, context);
  validateRoutingGraph(document, context);
  validateRecordingState(document, context);
  validateAutomationState(document, context);
});
export const ProjectDocumentV12Schema = ProjectDocumentV12BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
  validateTimelineMap(document, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
  validateRegionProcessing(document, context);
  validateRoutingGraph(document, context);
  validateRecordingState(document, context);
  validateAutomationState(document, context);
});

export const ProjectDocumentV13Schema = ProjectDocumentV13BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
  validateTimelineMap(document, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
  validateRegionProcessing(document, context);
  validateRoutingGraph(document, context);
  validateRecordingState(document, context);
  validateAutomationState(document, context);
  validateMidiState(document, context);
});

export const ProjectDocumentV14Schema = ProjectDocumentV14BaseSchema.superRefine((document, context) => {
  validateProjectRelations(document, context);
  validatePluginState(document, context);
  validateTimelineMap(document, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
  validateRegionProcessing(document, context);
  validateRoutingGraph(document, context);
  validateRecordingState(document, context);
  validateAutomationState(document, context);
  validateMidiState(document, context);
});

export const ProjectDocumentV15Schema = ProjectDocumentV15BaseSchema.superRefine((document, context) => {
  const v14CompatibleDocument = document as unknown as z.infer<typeof ProjectDocumentV14BaseSchema>;
  validateProjectRelations(v14CompatibleDocument, context);
  validatePluginState(v14CompatibleDocument, context);
  validateTimelineMap(v14CompatibleDocument, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
  validateRegionProcessing(v14CompatibleDocument, context);
  validateRoutingGraph(v14CompatibleDocument, context);
  validateRecordingState(v14CompatibleDocument, context);
  validateAutomationState(v14CompatibleDocument, context);
  validateMidiState(v14CompatibleDocument, context);
  validatePluginSidechains(document as unknown as PluginSidechainDocument, context);
});

function validateProjectDocumentV16State(
  document: z.infer<typeof ProjectDocumentV16BaseSchema>,
  context: z.RefinementCtx
): void {
  const v15CompatibleDocument = document as unknown as z.infer<typeof ProjectDocumentV15BaseSchema>;
  const v14CompatibleDocument = document as unknown as z.infer<typeof ProjectDocumentV14BaseSchema>;
  validateProjectRelations(v14CompatibleDocument, context);
  validatePluginState(v14CompatibleDocument, context);
  validateTimelineMap(v14CompatibleDocument, context);
  addDuplicateIdIssues({
    entries: document.timeline.markers.map((marker, index) => ({
      id: marker.id,
      path: ['timeline', 'markers', index, 'id'],
    })),
    label: 'Timeline marker',
    context,
  });
  validateRegionProcessing(v14CompatibleDocument, context);
  validateRoutingGraph(v14CompatibleDocument, context);
  validateRecordingState(v14CompatibleDocument, context);
  validateAutomationState(v14CompatibleDocument, context);
  validateMidiState(v14CompatibleDocument, context);
  validatePluginSidechains(v15CompatibleDocument as unknown as PluginSidechainDocument, context);
  validateAudioSourceManagement(document, context);
}

export const ProjectDocumentV16Schema = ProjectDocumentV16BaseSchema.superRefine(validateProjectDocumentV16State);

function validateProjectExportSettings(
  exportSettings: z.infer<typeof ProjectExportSettingsSchema>,
  context: z.RefinementCtx,
  pathPrefix: Array<string | number> = []
): void {
  const presetEntries = exportSettings.presets.map((preset, index) => ({
    id: preset.id,
    path: [...pathPrefix, 'presets', index, 'id'],
  }));
  const rangeEntries = exportSettings.ranges.map((range, index) => ({
    id: range.id,
    path: [...pathPrefix, 'ranges', index, 'id'],
  }));
  addDuplicateIdIssues({ entries: presetEntries, label: 'Export Preset', context });
  addDuplicateIdIssues({ entries: rangeEntries, label: 'Export Range', context });
  if (!exportSettings.presets.some(preset => preset.id === exportSettings.activePresetId)) {
    context.addIssue({
      code: 'custom',
      message: 'Active Export Preset must exist',
      path: [...pathPrefix, 'activePresetId'],
    });
  }
  exportSettings.presets.forEach((preset, index) => {
    if (preset.sampleFormat === 'float32' && preset.dither !== 'none') {
      context.addIssue({
        code: 'custom',
        message: '32-bit float Export must not use dither',
        path: [...pathPrefix, 'presets', index, 'dither'],
      });
    }
  });
}

export const ValidatedProjectExportSettingsSchema = ProjectExportSettingsSchema.superRefine((settings, context) => {
  validateProjectExportSettings(settings, context);
});

export const ProjectDocumentV17Schema = ProjectDocumentV17BaseSchema.superRefine((document, context) => {
  validateProjectDocumentV16State(document as unknown as z.infer<typeof ProjectDocumentV16BaseSchema>, context);
  validateProjectExportSettings(document.exportSettings, context, ['exportSettings']);
});

export const ProjectDocumentV18Schema = ProjectDocumentV18BaseSchema.superRefine((document, context) => {
  validateProjectDocumentV16State(document as unknown as z.infer<typeof ProjectDocumentV16BaseSchema>, context);
  validateProjectExportSettings(document.exportSettings, context, ['exportSettings']);
  const lifecycle = document.lifecycle as unknown as {
    readonly snapshots: readonly { readonly id: string }[];
    readonly templates: readonly { readonly id: string }[];
  };
  addDuplicateIdIssues({
    entries: lifecycle.snapshots.map((snapshot, index) => ({
      id: snapshot.id,
      path: ['lifecycle', 'snapshots', index, 'id'],
    })),
    label: 'Named Snapshot',
    context,
  });
  addDuplicateIdIssues({
    entries: lifecycle.templates.map((template, index) => ({
      id: template.id,
      path: ['lifecycle', 'templates', index, 'id'],
    })),
    label: 'Project Template',
    context,
  });
});

export const ProjectDocumentV19Schema = ProjectDocumentV19BaseSchema.superRefine((document, context) => {
  validateProjectDocumentV16State(document as unknown as z.infer<typeof ProjectDocumentV16BaseSchema>, context);
  validateProjectExportSettings(document.exportSettings, context, ['exportSettings']);

  const cueDocument = document as unknown as {
    readonly cue: CueState;
    readonly tracks: readonly { readonly id: string; readonly loopSlots: readonly { readonly id: string }[] }[];
  };
  const slotKeys = new Set(cueDocument.tracks.flatMap(track => track.loopSlots.map(slot => `${track.id}:${slot.id}`)));
  const performances = cueDocument.cue.performances;
  const lifecycle = document.lifecycle as unknown as ProjectLifecycleState;
  addDuplicateIdIssues({
    context,
    entries: lifecycle.snapshots.map((snapshot, index) => ({
      id: snapshot.id,
      path: ['lifecycle', 'snapshots', index, 'id'],
    })),
    label: 'Named Snapshot',
  });
  addDuplicateIdIssues({
    context,
    entries: lifecycle.templates.map((template, index) => ({
      id: template.id,
      path: ['lifecycle', 'templates', index, 'id'],
    })),
    label: 'Project Template',
  });
  addDuplicateIdIssues({
    context,
    entries: performances.map((performance, index) => ({
      id: performance.id,
      path: ['cue', 'performances', index, 'id'],
    })),
    label: 'Cue Performance',
  });
  performances.forEach((performance, performanceIndex) => {
    addDuplicateIdIssues({
      context,
      entries: performance.events.map((event, eventIndex) => ({
        id: event.id,
        path: ['cue', 'performances', performanceIndex, 'events', eventIndex, 'id'],
      })),
      label: 'Cue Event',
    });
    performance.events.forEach((event, eventIndex) => {
      if (!slotKeys.has(`${event.trackId}:${event.slotId}`)) {
        context.addIssue({
          code: 'custom',
          message: 'Cue Event must reference an existing Loop Slot',
          path: ['cue', 'performances', performanceIndex, 'events', eventIndex, 'slotId'],
        });
      }
    });
  });
});

function validateAudioSourceManagement(
  document: z.infer<typeof ProjectDocumentV16BaseSchema>,
  context: z.RefinementCtx
): void {
  const sourceIds = new Set(document.audioSources.map(source => source.id));
  document.audioSources.forEach((source, sourceIndex) => {
    if (new Set(source.tags).size !== source.tags.length) {
      context.addIssue({
        code: 'custom',
        message: 'Source tags must be unique',
        path: ['audioSources', sourceIndex, 'tags'],
      });
    }
    if (source.derivation && (!sourceIds.has(source.derivation.sourceId) || source.derivation.sourceId === source.id)) {
      context.addIssue({
        code: 'custom',
        message: 'Derived Source must reference another Source in the project',
        path: ['audioSources', sourceIndex, 'derivation', 'sourceId'],
      });
    }
    source.transientPositionsSeconds.forEach((position, positionIndex) => {
      const previousPosition = source.transientPositionsSeconds[positionIndex - 1];
      if (previousPosition !== undefined && position <= previousPosition) {
        context.addIssue({
          code: 'custom',
          message: 'Transient positions must be strictly increasing',
          path: ['audioSources', sourceIndex, 'transientPositionsSeconds', positionIndex],
        });
      }
      if (source.durationSeconds !== null && position > source.durationSeconds) {
        context.addIssue({
          code: 'custom',
          message: 'Transient position exceeds Source duration',
          path: ['audioSources', sourceIndex, 'transientPositionsSeconds', positionIndex],
        });
      }
    });
  });
}

interface PluginSidechainDocument {
  readonly tracks: readonly {
    readonly id: string;
    readonly pluginInstances: readonly { readonly sidechainSourceTrackId: string | null }[];
  }[];
}

function validatePluginSidechains(document: PluginSidechainDocument, context: z.RefinementCtx): void {
  const trackIds = new Set(document.tracks.map(track => track.id));
  document.tracks.forEach((track, trackIndex) => {
    track.pluginInstances.forEach((instance, instanceIndex) => {
      const sourceTrackId = instance.sidechainSourceTrackId;
      if (sourceTrackId === null) {
        return;
      }
      const path = ['tracks', trackIndex, 'pluginInstances', instanceIndex, 'sidechainSourceTrackId'];
      if (sourceTrackId === track.id) {
        context.addIssue({ code: 'custom', message: 'Plugin sidechain source must be a different Track', path });
        return;
      }
      if (!trackIds.has(sourceTrackId)) {
        context.addIssue({
          code: 'custom',
          message: `Plugin sidechain source Track is missing: ${sourceTrackId}`,
          path,
        });
      }
    });
  });
}

function getMidiControlLanes(
  region: z.infer<typeof ProjectMidiRegionSchema> | z.infer<typeof ProjectMidiRegionV14Schema>
): readonly z.infer<typeof ProjectMidiControlLaneSchema>[] {
  return 'controlLanes' in region
    ? (region.controlLanes as readonly z.infer<typeof ProjectMidiControlLaneSchema>[])
    : [];
}

function validateMidiState(
  document: z.infer<typeof ProjectDocumentV13BaseSchema> | z.infer<typeof ProjectDocumentV14BaseSchema>,
  context: z.RefinementCtx
): void {
  const midiRegionEntries = document.tracks.flatMap((track, trackIndex) =>
    (track.midi?.regions ?? []).map((region, regionIndex) => ({
      id: region.id,
      path: ['tracks', trackIndex, 'midi', 'regions', regionIndex, 'id'],
    }))
  );
  const midiNoteEntries = document.tracks.flatMap((track, trackIndex) =>
    (track.midi?.regions ?? []).flatMap((region, regionIndex) =>
      region.notes.map((note, noteIndex) => ({
        id: note.id,
        path: ['tracks', trackIndex, 'midi', 'regions', regionIndex, 'notes', noteIndex, 'id'],
      }))
    )
  );
  const midiControlLaneEntries = document.tracks.flatMap((track, trackIndex) =>
    (track.midi?.regions ?? []).flatMap((region, regionIndex) =>
      getMidiControlLanes(region).map((lane, laneIndex) => ({
        id: lane.id,
        path: ['tracks', trackIndex, 'midi', 'regions', regionIndex, 'controlLanes', laneIndex, 'id'],
      }))
    )
  );
  const midiControlPointEntries = document.tracks.flatMap((track, trackIndex) =>
    (track.midi?.regions ?? []).flatMap((region, regionIndex) =>
      getMidiControlLanes(region).flatMap((lane, laneIndex) =>
        lane.points.map((point, pointIndex) => ({
          id: point.id,
          path: [
            'tracks',
            trackIndex,
            'midi',
            'regions',
            regionIndex,
            'controlLanes',
            laneIndex,
            'points',
            pointIndex,
            'id',
          ],
        }))
      )
    )
  );
  addDuplicateIdIssues({ entries: midiRegionEntries, label: 'MIDI Region', context });
  addDuplicateIdIssues({ entries: midiNoteEntries, label: 'MIDI Note', context });
  addDuplicateIdIssues({ entries: midiControlLaneEntries, label: 'MIDI Control Lane', context });
  addDuplicateIdIssues({ entries: midiControlPointEntries, label: 'MIDI Control Point', context });
}

interface CrossfadeEndpoint {
  readonly crossfadeId: string;
  readonly direction: 'in' | 'out';
  readonly durationSeconds: number;
  readonly curve: 'linear' | 'equalPower';
  readonly region: z.infer<typeof ProjectRegionV8Schema>;
  readonly path: Array<string | number>;
}

function validateRegionProcessing(
  document:
    | z.infer<typeof ProjectDocumentV8BaseSchema>
    | z.infer<typeof ProjectDocumentV9BaseSchema>
    | z.infer<typeof ProjectDocumentV10BaseSchema>
    | z.infer<typeof ProjectDocumentV11BaseSchema>
    | z.infer<typeof ProjectDocumentV12BaseSchema>
    | z.infer<typeof ProjectDocumentV13BaseSchema>
    | z.infer<typeof ProjectDocumentV14BaseSchema>,
  context: z.RefinementCtx
): void {
  document.tracks.forEach((track, trackIndex) => {
    const crossfadeEndpoints = new Map<string, CrossfadeEndpoint[]>();

    track.regions.forEach((region, regionIndex) => {
      for (const direction of ['in', 'out'] as const) {
        const fade = direction === 'in' ? region.fadeIn : region.fadeOut;
        const path = ['tracks', trackIndex, 'regions', regionIndex, direction === 'in' ? 'fadeIn' : 'fadeOut'];
        if (fade.durationSeconds > region.durationSeconds) {
          context.addIssue({
            code: 'custom',
            message: 'Fade duration must not exceed Region duration',
            path: [...path, 'durationSeconds'],
          });
        }
        if (fade.crossfadeId === null) {
          continue;
        }

        const endpoint: CrossfadeEndpoint = {
          crossfadeId: fade.crossfadeId,
          curve: fade.curve,
          direction,
          durationSeconds: fade.durationSeconds,
          path,
          region,
        };
        const endpoints = crossfadeEndpoints.get(fade.crossfadeId) ?? [];
        endpoints.push(endpoint);
        crossfadeEndpoints.set(fade.crossfadeId, endpoints);
      }
    });

    crossfadeEndpoints.forEach(endpoints => validateCrossfadeEndpoints(endpoints, context));
  });
}

function validateCrossfadeEndpoints(endpoints: readonly CrossfadeEndpoint[], context: z.RefinementCtx): void {
  const fadeIn = endpoints.find(endpoint => endpoint.direction === 'in');
  const fadeOut = endpoints.find(endpoint => endpoint.direction === 'out');
  if (endpoints.length !== 2 || !fadeIn || !fadeOut || fadeIn.region.id === fadeOut.region.id) {
    endpoints.forEach(endpoint =>
      context.addIssue({
        code: 'custom',
        message: 'A Crossfade must connect one fade-out and one fade-in on different Regions',
        path: [...endpoint.path, 'crossfadeId'],
      })
    );
    return;
  }

  const fadeOutWindowStart = fadeOut.region.startTimeSeconds + fadeOut.region.durationSeconds - fadeOut.durationSeconds;
  const fadeOutWindowEnd = fadeOut.region.startTimeSeconds + fadeOut.region.durationSeconds;
  const fadeInWindowStart = fadeIn.region.startTimeSeconds;
  const fadeInWindowEnd = fadeIn.region.startTimeSeconds + fadeIn.durationSeconds;
  const hasMatchingWindow = fadeOutWindowStart === fadeInWindowStart && fadeOutWindowEnd === fadeInWindowEnd;
  if (hasMatchingWindow && fadeIn.curve === fadeOut.curve) {
    return;
  }

  endpoints.forEach(endpoint =>
    context.addIssue({
      code: 'custom',
      message: 'Crossfade endpoints must use the same time window and curve',
      path: [...endpoint.path, 'crossfadeId'],
    })
  );
}

function validateRoutingGraph(
  document:
    | z.infer<typeof ProjectDocumentV9BaseSchema>
    | z.infer<typeof ProjectDocumentV10BaseSchema>
    | z.infer<typeof ProjectDocumentV11BaseSchema>
    | z.infer<typeof ProjectDocumentV12BaseSchema>
    | z.infer<typeof ProjectDocumentV13BaseSchema>
    | z.infer<typeof ProjectDocumentV14BaseSchema>,
  context: z.RefinementCtx
): void {
  const routes = document.mixer.routing.routes;
  const routeByTrackId = new Map(routes.map(route => [route.trackId, route]));
  const documentTrackIds = new Set(document.tracks.map(track => track.id));

  addDuplicateIdIssues({
    entries: routes.map((route, index) => ({
      id: route.trackId,
      path: ['mixer', 'routing', 'routes', index, 'trackId'],
    })),
    label: 'Route Track',
    context,
  });
  addDuplicateIdIssues({
    entries: document.mixer.routing.sends.map((send, index) => ({
      id: send.id,
      path: ['mixer', 'routing', 'sends', index, 'id'],
    })),
    label: 'Send',
    context,
  });

  document.tracks.forEach((track, trackIndex) => {
    if (!routeByTrackId.has(track.id)) {
      context.addIssue({
        code: 'custom',
        message: `Track requires one Route: ${track.id}`,
        path: ['tracks', trackIndex, 'id'],
      });
    }
  });

  const signalEdges: Array<readonly [string, string]> = [];
  const folderEdges: Array<readonly [string, string]> = [];
  routes.forEach((route, routeIndex) => {
    const path = ['mixer', 'routing', 'routes', routeIndex];
    if (!documentTrackIds.has(route.trackId)) {
      context.addIssue({
        code: 'custom',
        message: `Route references a missing Track ID: ${route.trackId}`,
        path: [...path, 'trackId'],
      });
    }

    const isSignalRoute = route.kind === 'audio' || route.kind === 'aux' || route.kind === 'bus';
    if (isSignalRoute === (route.output.kind === 'none')) {
      context.addIssue({
        code: 'custom',
        message: isSignalRoute ? 'An Audio Route requires an output' : 'Folder and VCA Routes cannot have an output',
        path: [...path, 'output'],
      });
    }
    if (route.output.kind === 'track') {
      const destination = routeByTrackId.get(route.output.trackId);
      if (!destination || (destination.kind !== 'aux' && destination.kind !== 'bus')) {
        context.addIssue({
          code: 'custom',
          message: `Route output must reference an Aux or Bus Track: ${route.output.trackId}`,
          path: [...path, 'output', 'trackId'],
        });
      } else {
        signalEdges.push([route.trackId, route.output.trackId]);
      }
    }

    if (route.folderId !== null) {
      const folder = routeByTrackId.get(route.folderId);
      if (folder?.kind !== 'folder') {
        context.addIssue({
          code: 'custom',
          message: `Folder assignment must reference a Folder Track: ${route.folderId}`,
          path: [...path, 'folderId'],
        });
      } else {
        folderEdges.push([route.trackId, route.folderId]);
      }
    }

    const vcaIds = new Set<string>();
    route.vcaIds.forEach((vcaId, vcaIndex) => {
      const vca = routeByTrackId.get(vcaId);
      if (vca?.kind !== 'vca') {
        context.addIssue({
          code: 'custom',
          message: `VCA assignment must reference a VCA Track: ${vcaId}`,
          path: [...path, 'vcaIds', vcaIndex],
        });
      }
      if (vcaIds.has(vcaId)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate VCA assignment: ${vcaId}`,
          path: [...path, 'vcaIds', vcaIndex],
        });
      }
      vcaIds.add(vcaId);
    });
  });

  document.mixer.routing.sends.forEach((send, sendIndex) => {
    const path = ['mixer', 'routing', 'sends', sendIndex];
    const source = routeByTrackId.get(send.sourceTrackId);
    const destination = routeByTrackId.get(send.destinationTrackId);
    if (!source || (source.kind !== 'audio' && source.kind !== 'aux' && source.kind !== 'bus')) {
      context.addIssue({
        code: 'custom',
        message: `Send source must reference an Audio, Aux, or Bus Track: ${send.sourceTrackId}`,
        path: [...path, 'sourceTrackId'],
      });
    }
    if (!destination || (destination.kind !== 'aux' && destination.kind !== 'bus')) {
      context.addIssue({
        code: 'custom',
        message: `Send destination must reference an Aux or Bus Track: ${send.destinationTrackId}`,
        path: [...path, 'destinationTrackId'],
      });
    }
    if (send.isEnabled && source && destination) {
      signalEdges.push([send.sourceTrackId, send.destinationTrackId]);
    }
  });

  if (
    hasDirectedCycle(
      routes.map(route => route.trackId),
      signalEdges
    )
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Routing graph must not contain an active signal cycle',
      path: ['mixer', 'routing'],
    });
  }
  if (
    hasDirectedCycle(
      routes.map(route => route.trackId),
      folderEdges
    )
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Folder assignments must not contain a hierarchy cycle',
      path: ['mixer', 'routing', 'routes'],
    });
  }
}

function validateRecordingState(
  document:
    | z.infer<typeof ProjectDocumentV10BaseSchema>
    | z.infer<typeof ProjectDocumentV11BaseSchema>
    | z.infer<typeof ProjectDocumentV12BaseSchema>
    | z.infer<typeof ProjectDocumentV13BaseSchema>
    | z.infer<typeof ProjectDocumentV14BaseSchema>,
  context: z.RefinementCtx
): void {
  const trackIds = new Set(document.tracks.map(track => track.id));
  const sourceIds = new Set(document.audioSources.map(source => source.id));

  addDuplicateIdIssues({
    entries: document.recording.recoverableSources.map((source, index) => ({
      id: source.sourceId,
      path: ['recording', 'recoverableSources', index, 'sourceId'],
    })),
    label: 'Recoverable Source',
    context,
  });
  document.recording.recoverableSources.forEach((source, index) => {
    if (!trackIds.has(source.trackId)) {
      context.addIssue({
        code: 'custom',
        message: `Recoverable Source references a missing Track ID: ${source.trackId}`,
        path: ['recording', 'recoverableSources', index, 'trackId'],
      });
    }
    if (sourceIds.has(source.sourceId)) {
      context.addIssue({
        code: 'custom',
        message: `Recoverable Source is already committed: ${source.sourceId}`,
        path: ['recording', 'recoverableSources', index, 'sourceId'],
      });
    }
  });

  document.tracks.forEach((track, trackIndex) => {
    const playlistById = new Map(track.recording.playlists.map(playlist => [playlist.id, playlist]));
    addDuplicateIdIssues({
      entries: track.recording.playlists.map((playlist, playlistIndex) => ({
        id: playlist.id,
        path: ['tracks', trackIndex, 'recording', 'playlists', playlistIndex, 'id'],
      })),
      label: 'Playlist',
      context,
    });
    if (track.recording.activePlaylistId !== null && !playlistById.has(track.recording.activePlaylistId)) {
      context.addIssue({
        code: 'custom',
        message: `Active Playlist is missing: ${track.recording.activePlaylistId}`,
        path: ['tracks', trackIndex, 'recording', 'activePlaylistId'],
      });
    }

    track.recording.playlists.forEach((playlist, playlistIndex) => {
      const takeById = new Map(playlist.takes.map(take => [take.id, take]));
      addDuplicateIdIssues({
        entries: playlist.takes.map((take, takeIndex) => ({
          id: take.id,
          path: ['tracks', trackIndex, 'recording', 'playlists', playlistIndex, 'takes', takeIndex, 'id'],
        })),
        label: 'Take',
        context,
      });
      addDuplicateIdIssues({
        entries: playlist.compSegments.map((segment, segmentIndex) => ({
          id: segment.id,
          path: ['tracks', trackIndex, 'recording', 'playlists', playlistIndex, 'compSegments', segmentIndex, 'id'],
        })),
        label: 'Comp Segment',
        context,
      });
      playlist.takes.forEach((take, takeIndex) => {
        if (!sourceIds.has(take.sourceId)) {
          context.addIssue({
            code: 'custom',
            message: `Take references a missing Source ID: ${take.sourceId}`,
            path: ['tracks', trackIndex, 'recording', 'playlists', playlistIndex, 'takes', takeIndex, 'sourceId'],
          });
        }
      });
      playlist.compSegments.forEach((segment, segmentIndex) => {
        const take = takeById.get(segment.takeId);
        const segmentPath = [
          'tracks',
          trackIndex,
          'recording',
          'playlists',
          playlistIndex,
          'compSegments',
          segmentIndex,
        ];
        if (!take) {
          context.addIssue({
            code: 'custom',
            message: `Comp Segment references a missing Take ID: ${segment.takeId}`,
            path: [...segmentPath, 'takeId'],
          });
          return;
        }
        const takeEndTimeSeconds = take.startTimeSeconds + take.durationSeconds;
        if (segment.startTimeSeconds < take.startTimeSeconds || segment.endTimeSeconds > takeEndTimeSeconds) {
          context.addIssue({
            code: 'custom',
            message: 'Comp Segment must stay within its Take range',
            path: segmentPath,
          });
        }
      });
      const orderedSegments = [...playlist.compSegments].sort(
        (left, right) => left.startTimeSeconds - right.startTimeSeconds
      );
      orderedSegments.slice(1).forEach((segment, index) => {
        if (segment.startTimeSeconds < orderedSegments[index].endTimeSeconds) {
          context.addIssue({
            code: 'custom',
            message: 'Comp Segments must not overlap',
            path: ['tracks', trackIndex, 'recording', 'playlists', playlistIndex, 'compSegments'],
          });
        }
      });
    });
  });
}

function validateAutomationState(
  document:
    | z.infer<typeof ProjectDocumentV11BaseSchema>
    | z.infer<typeof ProjectDocumentV12BaseSchema>
    | z.infer<typeof ProjectDocumentV13BaseSchema>
    | z.infer<typeof ProjectDocumentV14BaseSchema>,
  context: z.RefinementCtx
): void {
  const sendsById = new Map(document.mixer.routing.sends.map(send => [send.id, send]));

  addDuplicateIdIssues({
    entries: document.tracks.flatMap((track, trackIndex) =>
      track.automationLanes.map((lane, laneIndex) => ({
        id: lane.id,
        path: ['tracks', trackIndex, 'automationLanes', laneIndex, 'id'],
      }))
    ),
    label: 'Automation lane',
    context,
  });

  document.tracks.forEach((track, trackIndex) => {
    const targetKeys = new Set<string>();
    const pluginInstancesById = new Map(track.pluginInstances.map(instance => [instance.id, instance]));
    track.automationLanes.forEach((lane, laneIndex) => {
      const lanePath = ['tracks', trackIndex, 'automationLanes', laneIndex];
      const targetKey = getAutomationTargetKey(lane.target);
      if (targetKeys.has(targetKey)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate Automation target: ${targetKey}`,
          path: [...lanePath, 'target'],
        });
      }
      targetKeys.add(targetKey);

      addDuplicateIdIssues({
        entries: lane.points.map((point, pointIndex) => ({
          id: point.id,
          path: [...lanePath, 'points', pointIndex, 'id'],
        })),
        label: 'Automation point',
        context,
      });
      lane.points.slice(1).forEach((point, pointIndex) => {
        if (point.timeSeconds <= lane.points[pointIndex].timeSeconds) {
          context.addIssue({
            code: 'custom',
            message: 'Automation point times must be strictly increasing',
            path: [...lanePath, 'points', pointIndex + 1, 'timeSeconds'],
          });
        }
      });

      if (lane.target.kind === 'sendGain') {
        const send = sendsById.get(lane.target.sendId);
        if (send?.sourceTrackId !== track.id) {
          context.addIssue({
            code: 'custom',
            message: `Automation Send must belong to its Track: ${lane.target.sendId}`,
            path: [...lanePath, 'target', 'sendId'],
          });
        }
      }
      if (lane.target.kind === 'pluginParameter') {
        const target = lane.target;
        const instance = pluginInstancesById.get(target.pluginInstanceId);
        const parameter = instance?.parameters.find(candidate => candidate.id === target.parameterId);
        if (!instance || typeof parameter?.value !== 'number') {
          context.addIssue({
            code: 'custom',
            message: `Automation Plugin parameter must be a numeric Track parameter: ${lane.target.parameterId}`,
            path: [...lanePath, 'target'],
          });
        }
      }
    });
  });
}

function hasDirectedCycle(nodes: readonly string[], edges: ReadonlyArray<readonly [string, string]>): boolean {
  const outgoing = new Map(nodes.map(node => [node, [] as string[]]));
  const inDegree = new Map(nodes.map(node => [node, 0]));
  edges.forEach(([source, destination]) => {
    if (!outgoing.has(source) || !inDegree.has(destination)) {
      return;
    }
    outgoing.get(source)?.push(destination);
    inDegree.set(destination, (inDegree.get(destination) ?? 0) + 1);
  });

  const remaining = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([node]) => node);
  let visitedCount = 0;
  while (remaining.length > 0) {
    const node = remaining.pop();
    if (!node) {
      continue;
    }
    visitedCount += 1;
    outgoing.get(node)?.forEach(destination => {
      const nextDegree = (inDegree.get(destination) ?? 0) - 1;
      inDegree.set(destination, nextDegree);
      if (nextDegree === 0) {
        remaining.push(destination);
      }
    });
  }
  return visitedCount !== nodes.length;
}

function validateTimelineMap(
  document:
    | z.infer<typeof ProjectDocumentV5BaseSchema>
    | z.infer<typeof ProjectDocumentV6BaseSchema>
    | z.infer<typeof ProjectDocumentV7BaseSchema>
    | z.infer<typeof ProjectDocumentV8BaseSchema>
    | z.infer<typeof ProjectDocumentV9BaseSchema>
    | z.infer<typeof ProjectDocumentV10BaseSchema>
    | z.infer<typeof ProjectDocumentV11BaseSchema>
    | z.infer<typeof ProjectDocumentV12BaseSchema>
    | z.infer<typeof ProjectDocumentV13BaseSchema>
    | z.infer<typeof ProjectDocumentV14BaseSchema>,
  context: z.RefinementCtx
): void {
  validateTimelineMarkerPositions(document.timeline.tempoChanges, 'tempoChanges', context);
  validateTimelineMarkerPositions(document.timeline.meterChanges, 'meterChanges', context);
  if (document.timeline.tempoChanges[0]?.bpm !== document.timeline.tempoBpm) {
    context.addIssue({
      code: 'custom',
      message: 'tempoBpm must equal the first Tempo change',
      path: ['timeline', 'tempoBpm'],
    });
  }

  document.timeline.meterChanges.slice(1).forEach((change, index) => {
    const previous = document.timeline.meterChanges[index];
    const previousBarQuarterNotes = previous.beatsPerBar * (4 / previous.beatUnit);
    if ((change.quarterNotePosition - previous.quarterNotePosition) % previousBarQuarterNotes !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'Meter change must be on the previous meter bar boundary',
        path: ['timeline', 'meterChanges', index + 1, 'quarterNotePosition'],
      });
    }
  });
}

function validateTimelineMarkerPositions(
  changes: readonly { readonly quarterNotePosition: number }[],
  fieldName: 'tempoChanges' | 'meterChanges',
  context: z.RefinementCtx
): void {
  changes.forEach((change, index) => {
    if (index === 0 && change.quarterNotePosition !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'The first timeline marker must start at quarter note 0',
        path: ['timeline', fieldName, index, 'quarterNotePosition'],
      });
    }
    if (index > 0 && change.quarterNotePosition <= changes[index - 1].quarterNotePosition) {
      context.addIssue({
        code: 'custom',
        message: 'Timeline marker positions must be strictly increasing',
        path: ['timeline', fieldName, index, 'quarterNotePosition'],
      });
    }
  });
}

export type ProjectAudioSource = z.infer<typeof ProjectAudioSourceSchema>;
export type ProjectAudioSourceV16 = z.infer<typeof ProjectAudioSourceV16Schema>;
export type ProjectBwfMetadata = z.infer<typeof ProjectBwfMetadataSchema>;
export type ProjectAudioSourceDerivation = z.infer<typeof ProjectAudioSourceDerivationSchema>;
export type ProjectRegion = z.infer<typeof ProjectRegionSchema>;
export type ProjectTrack = z.infer<typeof ProjectTrackSchema>;
export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>;
export type ProjectMetadata = ProjectDocument['project'];
export type ProjectPluginParameterState = z.infer<typeof ProjectPluginParameterStateSchema>;
export type ProjectPluginInstance = z.infer<typeof ProjectPluginInstanceSchema>;
export type ProjectTrackV2 = z.infer<typeof ProjectTrackV2Schema>;
export type ProjectDocumentV2 = z.infer<typeof ProjectDocumentV2Schema>;
export type ProjectLoopSlot = z.infer<typeof ProjectLoopSlotSchema>;
export type ProjectTrackV3 = z.infer<typeof ProjectTrackV3Schema>;
export type ProjectDocumentV3 = z.infer<typeof ProjectDocumentV3Schema>;
export type ProjectLoopSlotV4 = z.infer<typeof ProjectLoopSlotV4Schema>;
export type ProjectTrackV4 = z.infer<typeof ProjectTrackV4Schema>;
export type ProjectDocumentV4 = z.infer<typeof ProjectDocumentV4Schema>;
export type ProjectDocumentV5 = z.infer<typeof ProjectDocumentV5Schema>;
export type ProjectTimelineMarker = z.infer<typeof ProjectTimelineMarkerSchema>;
export type ProjectDocumentV6 = z.infer<typeof ProjectDocumentV6Schema>;
export type TimelineRange = z.infer<typeof ProjectTimelineRangeSchema>;
export type ProjectDocumentV7 = z.infer<typeof ProjectDocumentV7Schema>;
export type ProjectRegionFade = z.infer<typeof ProjectRegionFadeSchema>;
export type ProjectRegionV8 = z.infer<typeof ProjectRegionV8Schema>;
export type ProjectTrackV8 = z.infer<typeof ProjectTrackV8Schema>;
export type ProjectDocumentV8 = z.infer<typeof ProjectDocumentV8Schema>;
export type ProjectDocumentV9 = z.infer<typeof ProjectDocumentV9Schema>;
export type ProjectTake = z.infer<typeof ProjectTakeSchema>;
export type ProjectCompSegment = z.infer<typeof ProjectCompSegmentSchema>;
export type ProjectPlaylist = z.infer<typeof ProjectPlaylistSchema>;
export type ProjectTrackRecording = z.infer<typeof ProjectTrackRecordingSchema>;
export type ProjectTrackV10 = z.infer<typeof ProjectTrackV10Schema>;
export type ProjectRecording = z.infer<typeof ProjectRecordingSchema>;
export type ProjectDocumentV10 = z.infer<typeof ProjectDocumentV10Schema>;
export type ProjectAutomationTarget = z.infer<typeof ProjectAutomationTargetSchema>;
export type ProjectAutomationPoint = z.infer<typeof ProjectAutomationPointSchema>;
export type ProjectAutomationLane = z.infer<typeof ProjectAutomationLaneSchema>;
export type ProjectTrackV11 = z.infer<typeof ProjectTrackV11Schema>;
export type ProjectDocumentV11 = z.infer<typeof ProjectDocumentV11Schema>;
export type ProjectAutomationLaneV12 = z.infer<typeof ProjectAutomationLaneV12Schema>;
export type ProjectTrackV12 = z.infer<typeof ProjectTrackV12Schema>;
export type ProjectDocumentV12 = z.infer<typeof ProjectDocumentV12Schema>;
export type ProjectMidiNote = z.infer<typeof ProjectMidiNoteSchema>;
export type ProjectMidiRegion = z.infer<typeof ProjectMidiRegionSchema>;
export type ProjectMidiTrack = z.infer<typeof ProjectMidiTrackSchema>;
export type ProjectTrackV13 = z.infer<typeof ProjectTrackV13Schema>;
export type ProjectDocumentV13 = z.infer<typeof ProjectDocumentV13Schema>;
export type ProjectMidiControlPoint =
  | z.infer<typeof ProjectMidiControlChangePointSchema>
  | z.infer<typeof ProjectMidiPitchBendPointSchema>
  | z.infer<typeof ProjectMidiChannelPressurePointSchema>;
export type ProjectMidiControlLane = z.infer<typeof ProjectMidiControlLaneSchema>;
export type ProjectMidiRegionV14 = z.infer<typeof ProjectMidiRegionV14Schema>;
export type ProjectMidiTrackV14 = z.infer<typeof ProjectMidiTrackV14Schema>;
export type ProjectTrackV14 = z.infer<typeof ProjectTrackV14Schema>;
export type ProjectDocumentV14 = z.infer<typeof ProjectDocumentV14Schema>;
export interface ProjectPluginInstanceV15 extends ProjectPluginInstance {
  readonly presetId: string | null;
  readonly sidechainSourceTrackId: string | null;
  readonly stateBlob: string | null;
}
export interface ProjectTrackV15 extends Omit<ProjectTrackV14, 'pluginInstances'> {
  readonly pluginInstances: ProjectPluginInstanceV15[];
}
export interface ProjectDocumentV15 extends Omit<ProjectDocumentV14, 'schemaVersion' | 'tracks'> {
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION_V15;
  readonly tracks: ProjectTrackV15[];
}
export interface ProjectDocumentV16 extends Omit<ProjectDocumentV15, 'audioSources' | 'schemaVersion'> {
  readonly audioSources: ProjectAudioSourceV16[];
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION_V16;
}
export type ProjectExportSettings = z.infer<typeof ProjectExportSettingsSchema>;
export interface ProjectDocumentV17 extends Omit<ProjectDocumentV16, 'schemaVersion'> {
  readonly exportSettings: ProjectExportSettings;
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION_V17;
}
export interface ProjectNamedSnapshot {
  readonly createdAt: string;
  readonly document: ProjectDocumentV17;
  readonly id: string;
  readonly name: string;
}
export type ProjectTemplate =
  | {
      readonly createdAt: string;
      readonly document: ProjectDocumentV17;
      readonly id: string;
      readonly kind: 'session';
      readonly name: string;
    }
  | {
      readonly createdAt: string;
      readonly document: ProjectDocumentV17;
      readonly id: string;
      readonly kind: 'track';
      readonly name: string;
    };
export interface ProjectLifecycleState {
  readonly snapshots: readonly ProjectNamedSnapshot[];
  readonly templates: readonly ProjectTemplate[];
}
export interface ProjectDocumentV18 extends Omit<ProjectDocumentV17, 'schemaVersion'> {
  readonly lifecycle: ProjectLifecycleState;
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION_V18;
}
export interface ProjectLoopSlotV19 extends ProjectLoopSlotV4 {
  readonly followAction: ClipFollowAction;
  readonly launchMode: ClipLaunchMode;
  readonly name: string;
  readonly sourceEndTimeSeconds: number | null;
  readonly sourceStartTimeSeconds: number;
}
export interface ProjectTrackV19 extends Omit<ProjectTrackV15, 'loopSlots'> {
  readonly loopSlots: ProjectLoopSlotV19[];
}
export type ProjectCueState = CueState;
export interface ProjectDocumentV19 extends Omit<ProjectDocumentV18, 'schemaVersion' | 'tracks'> {
  readonly cue: ProjectCueState;
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION_V19;
  readonly tracks: ProjectTrackV19[];
}
export type ProjectDocumentSnapshot =
  | ProjectDocument
  | ProjectDocumentV2
  | ProjectDocumentV3
  | ProjectDocumentV4
  | ProjectDocumentV5
  | ProjectDocumentV6
  | ProjectDocumentV7
  | ProjectDocumentV8
  | ProjectDocumentV9
  | ProjectDocumentV10
  | ProjectDocumentV11
  | ProjectDocumentV12
  | ProjectDocumentV13
  | ProjectDocumentV14
  | ProjectDocumentV15
  | ProjectDocumentV16
  | ProjectDocumentV17
  | ProjectDocumentV18
  | ProjectDocumentV19;
