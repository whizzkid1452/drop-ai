import { z } from 'zod';
import { calculateFiniteRegionSourceEndTime, isRegionSourceRangeWithinDuration } from '../audio-source-range';
import { MAX_LOOP_OVERDUB_LAYERS } from '../loop-time';
import { calculateFiniteRegionEndTime } from '../region-timeline';
import { ROUTING_CHANNEL_COUNTS, ROUTING_SEND_TAP_POINTS, ROUTING_TRACK_KINDS } from './routing-state';

export const PROJECT_DOCUMENT_SCHEMA_VERSION = 1 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V2 = 2 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V3 = 3 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V4 = 4 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V5 = 5 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V6 = 6 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V7 = 7 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V8 = 8 as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION_V9 = 9 as const;

const MAX_NAME_LENGTH = 255;
const MAX_MIME_TYPE_LENGTH = 255;
const MAX_PLUGIN_ENTRIES = 128;
const MAX_LOOP_SLOTS = 16;
const MAX_TIMELINE_MAP_ENTRIES = 256;
const MAX_ROUTING_ENTRIES = 512;
const nonBlankNameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);
const pluginTextSchema = z
  .string()
  .min(1)
  .max(MAX_NAME_LENGTH)
  .refine(value => value.trim() === value, 'Plugin text must not have surrounding whitespace');
const normalizedAudioValueSchema = z.number().min(0).max(1);

export const ProjectAudioSourceSchema = z.strictObject({
  id: z.uuid('Invalid Source ID format'),
  fileName: nonBlankNameSchema,
  mimeType: z.string().max(MAX_MIME_TYPE_LENGTH),
  byteLength: z.number().int().nonnegative(),
  durationSeconds: z.number().nonnegative().nullable(),
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
  | z.infer<typeof ProjectDocumentV9BaseSchema>;
type RefinableProjectTrack =
  | z.infer<typeof ProjectTrackSchema>
  | z.infer<typeof ProjectTrackV2Schema>
  | z.infer<typeof ProjectTrackV3Schema>
  | z.infer<typeof ProjectTrackV4Schema>
  | z.infer<typeof ProjectTrackV8Schema>;

function isProjectTrackWithLoopSlots(
  track: RefinableProjectTrack
): track is z.infer<typeof ProjectTrackV3Schema> | z.infer<typeof ProjectTrackV4Schema> {
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
    | z.infer<typeof ProjectDocumentV9BaseSchema>,
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

interface CrossfadeEndpoint {
  readonly crossfadeId: string;
  readonly direction: 'in' | 'out';
  readonly durationSeconds: number;
  readonly curve: 'linear' | 'equalPower';
  readonly region: z.infer<typeof ProjectRegionV8Schema>;
  readonly path: Array<string | number>;
}

function validateRegionProcessing(
  document: z.infer<typeof ProjectDocumentV8BaseSchema> | z.infer<typeof ProjectDocumentV9BaseSchema>,
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

function validateRoutingGraph(document: z.infer<typeof ProjectDocumentV9BaseSchema>, context: z.RefinementCtx): void {
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
    | z.infer<typeof ProjectDocumentV9BaseSchema>,
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
export type ProjectDocumentSnapshot =
  | ProjectDocument
  | ProjectDocumentV2
  | ProjectDocumentV3
  | ProjectDocumentV4
  | ProjectDocumentV5
  | ProjectDocumentV6
  | ProjectDocumentV7
  | ProjectDocumentV8
  | ProjectDocumentV9;
