import { z } from 'zod';
import { calculateFiniteRegionSourceEndTime, isRegionSourceRangeWithinDuration } from '../audio-source-range';
import { calculateFiniteRegionEndTime } from '../region-timeline';

export const PROJECT_DOCUMENT_SCHEMA_VERSION = 1 as const;

const MAX_NAME_LENGTH = 255;
const MAX_MIME_TYPE_LENGTH = 255;
const nonBlankNameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);
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

export const ProjectTrackSchema = z.strictObject({
  id: z.uuid('Invalid Track ID format'),
  name: nonBlankNameSchema,
  volume: normalizedAudioValueSchema,
  pan: z.number().min(-1).max(1),
  isMuted: z.boolean(),
  isSoloed: z.boolean(),
  regions: z.array(ProjectRegionSchema),
});

const ProjectExportRangeSchema = z
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
  exportRange: ProjectExportRangeSchema.nullable(),
  audioSources: z.array(ProjectAudioSourceSchema),
  tracks: z.array(ProjectTrackSchema),
});

interface IdentifiedDocumentPath {
  id: string;
  path: Array<string | number>;
}

export const ProjectDocumentSchema = ProjectDocumentV1BaseSchema.superRefine((document, context) => {
  function addDuplicateIdIssues(entries: IdentifiedDocumentPath[], label: string): void {
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

  addDuplicateIdIssues(sourceEntries, 'Source');
  addDuplicateIdIssues(trackEntries, 'Track');
  addDuplicateIdIssues(regionEntries, 'Region');

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
  });
});

export type ProjectAudioSource = z.infer<typeof ProjectAudioSourceSchema>;
export type ProjectRegion = z.infer<typeof ProjectRegionSchema>;
export type ProjectTrack = z.infer<typeof ProjectTrackSchema>;
export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>;
export type ProjectMetadata = ProjectDocument['project'];
