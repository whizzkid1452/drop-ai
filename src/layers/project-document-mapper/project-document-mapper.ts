import type { RegionState, SessionState, TrackState } from '../session/session';
import { readProjectDocument } from '../shared/types/project-document-reader';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  ProjectDocumentSchema,
  type ProjectAudioSource,
  type ProjectDocument,
  type ProjectRegion,
  type ProjectTrack,
} from '../shared/types/project-document.schema';
import { ProjectDocumentMappingError, ProjectDocumentMappingErrorCode } from './errors';

const REGION_END_TIME_TOLERANCE_SECONDS = 1e-9;
const REGION_END_TIME_ULP_FACTOR = 4;

export type SessionProjectSnapshot = Readonly<
  Pick<SessionState, 'project' | 'tempo' | 'masterVolume' | 'exportStartTime' | 'exportEndTime' | 'tracks'>
>;

export interface CreateProjectDocumentFromSessionOptions {
  readonly session: SessionProjectSnapshot;
  readonly audioSources: ReadonlyArray<Readonly<ProjectAudioSource>>;
}

export interface ProjectRestoreSnapshot {
  readonly session: SessionProjectSnapshot;
  readonly audioSources: readonly ProjectAudioSource[];
}

interface SessionTrackEntry {
  readonly mapKey: string;
  readonly track: TrackState;
}

export function createProjectDocumentFromSession({
  session,
  audioSources,
}: CreateProjectDocumentFromSessionOptions): ProjectDocument {
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    project: { ...session.project },
    timeline: {
      timeUnit: 'seconds',
      tempoBpm: session.tempo,
    },
    mixer: {
      masterVolume: session.masterVolume,
    },
    exportRange: createExportRange(session),
    audioSources: audioSources.map(source => ({ ...source })),
    tracks: [...session.tracks.entries()].map(([mapKey, track]) => createProjectTrack({ mapKey, track })),
  };

  return parseSessionDocumentCandidate(documentCandidate);
}

export function createProjectRestoreSnapshotFromDocument(document: ProjectDocument): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentForMapping(document);
  const tracks = new Map<string, TrackState>();

  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrack(track));
  });

  return {
    session: {
      project: { ...validatedDocument.project },
      tempo: validatedDocument.timeline.tempoBpm,
      masterVolume: validatedDocument.mixer.masterVolume,
      exportStartTime: validatedDocument.exportRange?.startTimeSeconds ?? null,
      exportEndTime: validatedDocument.exportRange?.endTimeSeconds ?? null,
      tracks,
    },
    audioSources: validatedDocument.audioSources.map(source => ({ ...source })),
  };
}

function createExportRange(session: SessionProjectSnapshot): ProjectDocument['exportRange'] {
  const { exportStartTime, exportEndTime } = session;
  if (exportStartTime === null && exportEndTime === null) {
    return null;
  }

  if (exportStartTime === null || exportEndTime === null) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Export 범위의 시작과 끝은 함께 설정해야 합니다.',
      details: {
        exportEndTime,
        exportStartTime,
        reason: 'PARTIAL_EXPORT_RANGE',
      },
    });
  }

  return {
    startTimeSeconds: exportStartTime,
    endTimeSeconds: exportEndTime,
  };
}

function createProjectTrack({ mapKey, track }: SessionTrackEntry): ProjectTrack {
  if (mapKey !== track.id) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: `Track Map key와 Track ID가 다릅니다: ${mapKey} / ${track.id}`,
      details: {
        mapKey,
        reason: 'TRACK_ID_MISMATCH',
        trackId: track.id,
      },
    });
  }

  return {
    id: track.id,
    name: track.name,
    volume: track.volume,
    pan: track.pan,
    isMuted: track.isMuted,
    isSoloed: track.isSoloed,
    regions: track.regions.map(createProjectRegion),
  };
}

function createProjectRegion(region: RegionState): ProjectRegion {
  assertSessionRegionEndTime(region);

  return {
    id: region.id,
    sourceId: region.sourceId,
    startTimeSeconds: region.startTime,
    sourceStartTimeSeconds: region.sourceStartTime,
    durationSeconds: region.duration,
  };
}

function assertSessionRegionEndTime(region: RegionState): void {
  const calculatedEndTime = region.startTime + region.duration;
  if (!Number.isFinite(calculatedEndTime) || !Number.isFinite(region.endTime)) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: `Region 끝 시각은 유한수여야 합니다: ${region.id}`,
      details: {
        calculatedEndTime,
        endTime: region.endTime,
        reason: 'REGION_END_TIME_NOT_FINITE',
        regionId: region.id,
      },
    });
  }

  if (isRegionEndTimeConsistent(region.endTime, calculatedEndTime)) {
    return;
  }

  throw new ProjectDocumentMappingError({
    code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
    message: `Region 끝 시각이 시작 시각과 길이의 합과 다릅니다: ${region.id}`,
    details: {
      calculatedEndTime,
      endTime: region.endTime,
      reason: 'REGION_END_TIME_MISMATCH',
      regionId: region.id,
    },
  });
}

function isRegionEndTimeConsistent(endTime: number, calculatedEndTime: number): boolean {
  const magnitudeAdjustedTolerance =
    Number.EPSILON * Math.max(Math.abs(endTime), Math.abs(calculatedEndTime)) * REGION_END_TIME_ULP_FACTOR;
  const allowedDifference = Math.max(REGION_END_TIME_TOLERANCE_SECONDS, magnitudeAdjustedTolerance);

  return Math.abs(endTime - calculatedEndTime) <= allowedDifference;
}

function parseSessionDocumentCandidate(documentCandidate: unknown): ProjectDocument {
  try {
    const result = ProjectDocumentSchema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }

    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument로 변환할 수 없습니다.',
      details: {
        issues: result.error.issues,
        reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION',
      },
      cause: result.error,
    });
  } catch (cause) {
    if (cause instanceof ProjectDocumentMappingError) {
      throw cause;
    }

    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 읽을 수 없습니다.',
      details: { reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' },
      cause,
    });
  }
}

function readDocumentForMapping(document: ProjectDocument): ProjectDocument {
  try {
    return readProjectDocument(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument가 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function createSessionTrack(track: ProjectTrack): TrackState {
  return {
    id: track.id,
    name: track.name,
    volume: track.volume,
    pan: track.pan,
    isMuted: track.isMuted,
    isSoloed: track.isSoloed,
    status: [],
    regions: track.regions.map(createSessionRegion),
  };
}

function createSessionRegion(region: ProjectRegion): RegionState {
  const endTime = region.startTimeSeconds + region.durationSeconds;
  if (!Number.isFinite(endTime)) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: `ProjectDocument Region의 끝 시각을 계산할 수 없습니다: ${region.id}`,
      details: {
        reason: 'REGION_END_TIME_NOT_FINITE',
        regionId: region.id,
      },
    });
  }

  return {
    id: region.id,
    sourceId: region.sourceId,
    startTime: region.startTimeSeconds,
    endTime,
    sourceStartTime: region.sourceStartTimeSeconds,
    duration: region.durationSeconds,
    status: [],
  };
}
