import {
  DEFAULT_METRONOME_VOLUME,
  createDefaultLoopSlots,
  type LoopSlotState,
  type ProjectSessionState,
  type RegionState,
  type TrackState,
} from '../session/session';
import { validateProjectPluginCompatibility } from '../shared/project-plugin-compatibility';
import { calculateFiniteRegionEndTime, isRegionEndTimeConsistent } from '../shared/region-timeline';
import type { PluginCatalogEntry, PluginInstanceState } from '../shared/types/plugin-state';
import {
  readProjectDocument,
  readProjectDocumentV2,
  readProjectDocumentV3,
  readProjectDocumentV4,
  readProjectDocumentV5,
  readProjectDocumentV6,
  readProjectDocumentV7,
  readProjectDocumentV8,
  readProjectDocumentV9,
  readProjectDocumentV10,
  readProjectDocumentV11,
  readProjectDocumentV12,
  readProjectDocumentV13,
} from '../shared/types/project-document-reader';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V3,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V4,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V5,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V6,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V8,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V9,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V10,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V11,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V12,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V13,
  ProjectDocumentSchema,
  ProjectDocumentV2Schema,
  ProjectDocumentV3Schema,
  ProjectDocumentV4Schema,
  ProjectDocumentV5Schema,
  ProjectDocumentV6Schema,
  ProjectDocumentV7Schema,
  ProjectDocumentV8Schema,
  ProjectDocumentV9Schema,
  ProjectDocumentV10Schema,
  ProjectDocumentV11Schema,
  ProjectDocumentV12Schema,
  ProjectDocumentV13Schema,
  type ProjectAudioSource,
  type ProjectDocument,
  type ProjectDocumentV2,
  type ProjectDocumentV3,
  type ProjectDocumentV4,
  type ProjectDocumentV5,
  type ProjectDocumentV6,
  type ProjectDocumentV7,
  type ProjectDocumentV8,
  type ProjectDocumentV9,
  type ProjectDocumentV10,
  type ProjectDocumentV11,
  type ProjectDocumentV12,
  type ProjectDocumentV13,
  type ProjectDocumentSnapshot,
  type ProjectLoopSlot,
  type ProjectLoopSlotV4,
  type ProjectPluginInstance,
  type ProjectRegion,
  type ProjectRegionV8,
  type ProjectTrack,
  type ProjectTrackV2,
  type ProjectTrackV3,
  type ProjectTrackV4,
  type ProjectTrackV8,
  type ProjectTrackV10,
  type ProjectTrackV11,
  type ProjectTrackV12,
  type ProjectTrackV13,
} from '../shared/types/project-document.schema';
import { cloneAutomationLaneState } from '../shared/types/automation-state';
import { cloneMidiTrackState } from '../shared/types/midi-state';
import {
  cloneProjectRecordingState,
  cloneTrackRecordingState,
  createDefaultProjectRecordingState,
  createDefaultTrackRecordingState,
} from '../shared/types/multitrack-recording';
import { cloneRoutingGraphSnapshot, createDefaultRoutingGraphSnapshot } from '../shared/types/routing-state';
import { ProjectDocumentMappingError, ProjectDocumentMappingErrorCode } from './errors';

export type SessionProjectSnapshot = ProjectSessionState;

export interface CreateProjectDocumentFromSessionOptions {
  readonly session: SessionProjectSnapshot;
  readonly audioSources: ReadonlyArray<Readonly<ProjectAudioSource>>;
}

export interface CreateProjectDocumentV2FromSessionOptions extends CreateProjectDocumentFromSessionOptions {
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}

export type CreateProjectDocumentV3FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;
export type CreateProjectDocumentV4FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;
export type CreateProjectDocumentV5FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;
export type CreateProjectDocumentV6FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;
export type CreateProjectDocumentV7FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;
export type CreateProjectDocumentV8FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;
export type CreateProjectDocumentV9FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;
export type CreateProjectDocumentV10FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;
export type CreateProjectDocumentV11FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;
export type CreateProjectDocumentV12FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;
export type CreateProjectDocumentV13FromSessionOptions = CreateProjectDocumentV2FromSessionOptions;

export interface ProjectRestoreSnapshot {
  readonly session: SessionProjectSnapshot;
  readonly audioSources: readonly ProjectAudioSource[];
}

export interface CreateProjectRestoreSnapshotFromDocumentV2Options {
  readonly document: ProjectDocument | ProjectDocumentV2;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}

export interface CreateProjectRestoreSnapshotFromDocumentV3Options {
  readonly document: ProjectDocumentSnapshot;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}

export type CreateProjectRestoreSnapshotFromDocumentV4Options = CreateProjectRestoreSnapshotFromDocumentV3Options;
export type CreateProjectRestoreSnapshotFromDocumentV5Options = CreateProjectRestoreSnapshotFromDocumentV3Options;
export type CreateProjectRestoreSnapshotFromDocumentV6Options = CreateProjectRestoreSnapshotFromDocumentV3Options;
export type CreateProjectRestoreSnapshotFromDocumentV7Options = CreateProjectRestoreSnapshotFromDocumentV3Options;
export type CreateProjectRestoreSnapshotFromDocumentV8Options = CreateProjectRestoreSnapshotFromDocumentV3Options;
export type CreateProjectRestoreSnapshotFromDocumentV9Options = CreateProjectRestoreSnapshotFromDocumentV3Options;
export type CreateProjectRestoreSnapshotFromDocumentV10Options = CreateProjectRestoreSnapshotFromDocumentV3Options;
export type CreateProjectRestoreSnapshotFromDocumentV11Options = CreateProjectRestoreSnapshotFromDocumentV3Options;
export type CreateProjectRestoreSnapshotFromDocumentV12Options = CreateProjectRestoreSnapshotFromDocumentV3Options;
export type CreateProjectRestoreSnapshotFromDocumentV13Options = CreateProjectRestoreSnapshotFromDocumentV3Options;

interface SessionTrackEntry {
  readonly mapKey: string;
  readonly track: TrackState;
}

interface SessionTrackV2Entry extends SessionTrackEntry {
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}

type SessionTrackV3Entry = SessionTrackV2Entry;
type SessionTrackV4Entry = SessionTrackV2Entry;
type SessionTrackV8Entry = SessionTrackV2Entry;
type SessionTrackV10Entry = SessionTrackV2Entry;
type SessionTrackV11Entry = SessionTrackV2Entry;

interface ValidatePluginInstanceForMappingOptions {
  readonly instance: ProjectPluginInstance;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
  readonly trackId: string;
  readonly errorCode: ProjectDocumentMappingErrorCode;
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

export function createProjectDocumentV2FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV2FromSessionOptions): ProjectDocumentV2 {
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
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
    tracks: [...session.tracks.entries()].map(([mapKey, track]) =>
      createProjectTrackV2({ mapKey, track, pluginCatalog })
    ),
  };

  return parseSessionDocumentCandidateV2(documentCandidate);
}

export function createProjectDocumentV3FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV3FromSessionOptions): ProjectDocumentV3 {
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V3,
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
    tracks: [...session.tracks.entries()].map(([mapKey, track]) =>
      createProjectTrackV3({ mapKey, track, pluginCatalog })
    ),
  };

  return parseSessionDocumentCandidateV3(documentCandidate);
}

export function createProjectDocumentV4FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV4FromSessionOptions): ProjectDocumentV4 {
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V4,
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
    tracks: [...session.tracks.entries()].map(([mapKey, track]) =>
      createProjectTrackV4({ mapKey, track, pluginCatalog })
    ),
  };

  return parseSessionDocumentCandidateV4(documentCandidate);
}

export function createProjectDocumentV5FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV5FromSessionOptions): ProjectDocumentV5 {
  const tempoChanges = session.tempoChanges ?? [{ quarterNotePosition: 0, bpm: session.tempo }];
  const meterChanges = session.meterChanges ?? [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }];
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V5,
    project: { ...session.project },
    timeline: {
      timeUnit: 'seconds',
      tempoBpm: tempoChanges[0]?.bpm ?? session.tempo,
      tempoChanges: tempoChanges.map(change => ({ ...change })),
      meterChanges: meterChanges.map(change => ({ ...change })),
    },
    mixer: { masterVolume: session.masterVolume },
    exportRange: createExportRange(session),
    audioSources: audioSources.map(source => ({ ...source })),
    tracks: [...session.tracks.entries()].map(([mapKey, track]) =>
      createProjectTrackV4({ mapKey, track, pluginCatalog })
    ),
  };
  return parseSessionDocumentCandidateV5(documentCandidate);
}

export function createProjectDocumentV6FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV6FromSessionOptions): ProjectDocumentV6 {
  const tempoChanges = session.tempoChanges ?? [{ quarterNotePosition: 0, bpm: session.tempo }];
  const meterChanges = session.meterChanges ?? [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }];
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V6,
    project: { ...session.project },
    timeline: {
      timeUnit: 'seconds',
      tempoBpm: tempoChanges[0]?.bpm ?? session.tempo,
      tempoChanges: tempoChanges.map(change => ({ ...change })),
      meterChanges: meterChanges.map(change => ({ ...change })),
      markers: (session.timelineMarkers ?? []).map(marker => ({ ...marker })),
    },
    mixer: { masterVolume: session.masterVolume },
    exportRange: createExportRange(session),
    audioSources: audioSources.map(source => ({ ...source })),
    tracks: [...session.tracks.entries()].map(([mapKey, track]) =>
      createProjectTrackV4({ mapKey, track, pluginCatalog })
    ),
  };
  return parseSessionDocumentCandidateV6(documentCandidate);
}

export function createProjectDocumentV7FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV7FromSessionOptions): ProjectDocumentV7 {
  const tempoChanges = session.tempoChanges ?? [{ quarterNotePosition: 0, bpm: session.tempo }];
  const meterChanges = session.meterChanges ?? [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }];
  const loopRange = session.loopRange ? { ...session.loopRange } : null;
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
    project: { ...session.project },
    timeline: {
      timeUnit: 'seconds',
      tempoBpm: tempoChanges[0]?.bpm ?? session.tempo,
      tempoChanges: tempoChanges.map(change => ({ ...change })),
      meterChanges: meterChanges.map(change => ({ ...change })),
      markers: (session.timelineMarkers ?? []).map(marker => ({ ...marker })),
      loop: {
        isEnabled: session.isLoopEnabled === true && loopRange !== null,
        range: loopRange,
      },
      metronome: {
        isEnabled: session.isMetronomeEnabled ?? false,
        volume: session.metronomeVolume ?? DEFAULT_METRONOME_VOLUME,
      },
    },
    mixer: { masterVolume: session.masterVolume },
    exportRange: createExportRange(session),
    audioSources: audioSources.map(source => ({ ...source })),
    tracks: [...session.tracks.entries()].map(([mapKey, track]) =>
      createProjectTrackV4({ mapKey, track, pluginCatalog })
    ),
  };
  return parseSessionDocumentCandidateV7(documentCandidate);
}

export function createProjectDocumentV8FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV8FromSessionOptions): ProjectDocumentV8 {
  const tempoChanges = session.tempoChanges ?? [{ quarterNotePosition: 0, bpm: session.tempo }];
  const meterChanges = session.meterChanges ?? [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }];
  const loopRange = session.loopRange ? { ...session.loopRange } : null;
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V8,
    project: { ...session.project },
    timeline: {
      timeUnit: 'seconds',
      tempoBpm: tempoChanges[0]?.bpm ?? session.tempo,
      tempoChanges: tempoChanges.map(change => ({ ...change })),
      meterChanges: meterChanges.map(change => ({ ...change })),
      markers: (session.timelineMarkers ?? []).map(marker => ({ ...marker })),
      loop: {
        isEnabled: session.isLoopEnabled === true && loopRange !== null,
        range: loopRange,
      },
      metronome: {
        isEnabled: session.isMetronomeEnabled ?? false,
        volume: session.metronomeVolume ?? DEFAULT_METRONOME_VOLUME,
      },
    },
    mixer: { masterVolume: session.masterVolume },
    exportRange: createExportRange(session),
    audioSources: audioSources.map(source => ({ ...source })),
    tracks: [...session.tracks.entries()].map(([mapKey, track]) =>
      createProjectTrackV8({ mapKey, track, pluginCatalog })
    ),
  };
  return parseSessionDocumentCandidateV8(documentCandidate);
}

export function createProjectDocumentV9FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV9FromSessionOptions): ProjectDocumentV9 {
  const tempoChanges = session.tempoChanges ?? [{ quarterNotePosition: 0, bpm: session.tempo }];
  const meterChanges = session.meterChanges ?? [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }];
  const loopRange = session.loopRange ? { ...session.loopRange } : null;
  const routingGraph = session.routingGraph ?? createDefaultRoutingGraphSnapshot([...session.tracks.keys()]);
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V9,
    project: { ...session.project },
    timeline: {
      timeUnit: 'seconds',
      tempoBpm: tempoChanges[0]?.bpm ?? session.tempo,
      tempoChanges: tempoChanges.map(change => ({ ...change })),
      meterChanges: meterChanges.map(change => ({ ...change })),
      markers: (session.timelineMarkers ?? []).map(marker => ({ ...marker })),
      loop: {
        isEnabled: session.isLoopEnabled === true && loopRange !== null,
        range: loopRange,
      },
      metronome: {
        isEnabled: session.isMetronomeEnabled ?? false,
        volume: session.metronomeVolume ?? DEFAULT_METRONOME_VOLUME,
      },
    },
    mixer: {
      masterVolume: session.masterVolume,
      routing: cloneRoutingGraphSnapshot(routingGraph),
    },
    exportRange: createExportRange(session),
    audioSources: audioSources.map(source => ({ ...source })),
    tracks: [...session.tracks.entries()].map(([mapKey, track]) =>
      createProjectTrackV8({ mapKey, track, pluginCatalog })
    ),
  };
  return parseSessionDocumentCandidateV9(documentCandidate);
}

export function createProjectDocumentV10FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV10FromSessionOptions): ProjectDocumentV10 {
  const tempoChanges = session.tempoChanges ?? [{ quarterNotePosition: 0, bpm: session.tempo }];
  const meterChanges = session.meterChanges ?? [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }];
  const loopRange = session.loopRange ? { ...session.loopRange } : null;
  const routingGraph = session.routingGraph ?? createDefaultRoutingGraphSnapshot([...session.tracks.keys()]);
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V10,
    project: { ...session.project },
    timeline: {
      timeUnit: 'seconds',
      tempoBpm: tempoChanges[0]?.bpm ?? session.tempo,
      tempoChanges: tempoChanges.map(change => ({ ...change })),
      meterChanges: meterChanges.map(change => ({ ...change })),
      markers: (session.timelineMarkers ?? []).map(marker => ({ ...marker })),
      loop: {
        isEnabled: session.isLoopEnabled === true && loopRange !== null,
        range: loopRange,
      },
      metronome: {
        isEnabled: session.isMetronomeEnabled ?? false,
        volume: session.metronomeVolume ?? DEFAULT_METRONOME_VOLUME,
      },
    },
    mixer: {
      masterVolume: session.masterVolume,
      routing: cloneRoutingGraphSnapshot(routingGraph),
    },
    recording: cloneProjectRecordingState(session.recording ?? createDefaultProjectRecordingState()),
    exportRange: createExportRange(session),
    audioSources: audioSources.map(source => ({ ...source })),
    tracks: [...session.tracks.entries()].map(([mapKey, track]) =>
      createProjectTrackV10({ mapKey, track, pluginCatalog })
    ),
  };
  return parseSessionDocumentCandidateV10(documentCandidate);
}

export function createProjectDocumentV11FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV11FromSessionOptions): ProjectDocumentV11 {
  const tempoChanges = session.tempoChanges ?? [{ quarterNotePosition: 0, bpm: session.tempo }];
  const meterChanges = session.meterChanges ?? [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }];
  const loopRange = session.loopRange ? { ...session.loopRange } : null;
  const routingGraph = session.routingGraph ?? createDefaultRoutingGraphSnapshot([...session.tracks.keys()]);
  const documentCandidate = {
    documentType: 'drop-ai-project',
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V11,
    project: { ...session.project },
    timeline: {
      timeUnit: 'seconds',
      tempoBpm: tempoChanges[0]?.bpm ?? session.tempo,
      tempoChanges: tempoChanges.map(change => ({ ...change })),
      meterChanges: meterChanges.map(change => ({ ...change })),
      markers: (session.timelineMarkers ?? []).map(marker => ({ ...marker })),
      loop: {
        isEnabled: session.isLoopEnabled === true && loopRange !== null,
        range: loopRange,
      },
      metronome: {
        isEnabled: session.isMetronomeEnabled ?? false,
        volume: session.metronomeVolume ?? DEFAULT_METRONOME_VOLUME,
      },
    },
    mixer: {
      masterVolume: session.masterVolume,
      routing: cloneRoutingGraphSnapshot(routingGraph),
    },
    recording: cloneProjectRecordingState(session.recording ?? createDefaultProjectRecordingState()),
    exportRange: createExportRange(session),
    audioSources: audioSources.map(source => ({ ...source })),
    tracks: [...session.tracks.entries()].map(([mapKey, track]) =>
      createProjectTrackV11({ mapKey, track, pluginCatalog })
    ),
  };
  return parseSessionDocumentCandidateV11(documentCandidate);
}

export function createProjectDocumentV12FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV12FromSessionOptions): ProjectDocumentV12 {
  const v11Document = createProjectDocumentV11FromSession({ audioSources, pluginCatalog, session });
  const documentCandidate = {
    ...v11Document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V12,
    tracks: v11Document.tracks.map(track => {
      const automationLanes = session.tracks.get(track.id)?.automationLanes ?? [];
      return {
        ...track,
        automationLanes: automationLanes.map(cloneAutomationLaneState),
      };
    }),
  };
  return parseSessionDocumentCandidateV12(documentCandidate);
}

export function createProjectDocumentV13FromSession({
  session,
  audioSources,
  pluginCatalog,
}: CreateProjectDocumentV13FromSessionOptions): ProjectDocumentV13 {
  const v12Document = createProjectDocumentV12FromSession({ audioSources, pluginCatalog, session });
  const documentCandidate = {
    ...v12Document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V13,
    tracks: v12Document.tracks.map(track => {
      const midi = session.tracks.get(track.id)?.midi ?? null;
      return { ...track, midi: midi ? cloneMidiTrackState(midi) : null };
    }),
  };
  return parseSessionDocumentCandidateV13(documentCandidate);
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

export function createProjectRestoreSnapshotFromDocumentV2({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV2Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV2ForMapping(document);
  const tracks = new Map<string, TrackState>();

  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV2({ track, pluginCatalog }));
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

export function createProjectRestoreSnapshotFromDocumentV3({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV3Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV3ForMapping(document);
  const tracks = new Map<string, TrackState>();

  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV3({ track, pluginCatalog }));
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

export function createProjectRestoreSnapshotFromDocumentV4({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV4Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV4ForMapping(document);
  const tracks = new Map<string, TrackState>();

  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV4({ track, pluginCatalog }));
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

export function createProjectRestoreSnapshotFromDocumentV5({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV5Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV5ForMapping(document);
  const tracks = new Map<string, TrackState>();
  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV4({ track, pluginCatalog }));
  });

  return {
    session: {
      project: { ...validatedDocument.project },
      tempo: validatedDocument.timeline.tempoBpm,
      tempoChanges: validatedDocument.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: validatedDocument.timeline.meterChanges.map(change => ({ ...change })),
      masterVolume: validatedDocument.mixer.masterVolume,
      exportStartTime: validatedDocument.exportRange?.startTimeSeconds ?? null,
      exportEndTime: validatedDocument.exportRange?.endTimeSeconds ?? null,
      tracks,
    },
    audioSources: validatedDocument.audioSources.map(source => ({ ...source })),
  };
}

export function createProjectRestoreSnapshotFromDocumentV6({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV6Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV6ForMapping(document);
  const tracks = new Map<string, TrackState>();
  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV4({ track, pluginCatalog }));
  });

  return {
    session: {
      project: { ...validatedDocument.project },
      tempo: validatedDocument.timeline.tempoBpm,
      tempoChanges: validatedDocument.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: validatedDocument.timeline.meterChanges.map(change => ({ ...change })),
      timelineMarkers: validatedDocument.timeline.markers.map(marker => ({ ...marker })),
      masterVolume: validatedDocument.mixer.masterVolume,
      exportStartTime: validatedDocument.exportRange?.startTimeSeconds ?? null,
      exportEndTime: validatedDocument.exportRange?.endTimeSeconds ?? null,
      tracks,
    },
    audioSources: validatedDocument.audioSources.map(source => ({ ...source })),
  };
}

export function createProjectRestoreSnapshotFromDocumentV7({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV7Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV7ForMapping(document);
  const tracks = new Map<string, TrackState>();
  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV4({ track, pluginCatalog }));
  });

  return {
    session: {
      project: { ...validatedDocument.project },
      tempo: validatedDocument.timeline.tempoBpm,
      tempoChanges: validatedDocument.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: validatedDocument.timeline.meterChanges.map(change => ({ ...change })),
      timelineMarkers: validatedDocument.timeline.markers.map(marker => ({ ...marker })),
      loopRange: validatedDocument.timeline.loop.range ? { ...validatedDocument.timeline.loop.range } : null,
      isLoopEnabled: validatedDocument.timeline.loop.isEnabled,
      isMetronomeEnabled: validatedDocument.timeline.metronome.isEnabled,
      metronomeVolume: validatedDocument.timeline.metronome.volume,
      masterVolume: validatedDocument.mixer.masterVolume,
      exportStartTime: validatedDocument.exportRange?.startTimeSeconds ?? null,
      exportEndTime: validatedDocument.exportRange?.endTimeSeconds ?? null,
      tracks,
    },
    audioSources: validatedDocument.audioSources.map(source => ({ ...source })),
  };
}

export function createProjectRestoreSnapshotFromDocumentV8({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV8Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV8ForMapping(document);
  const tracks = new Map<string, TrackState>();
  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV8({ track, pluginCatalog }));
  });

  return {
    session: {
      project: { ...validatedDocument.project },
      tempo: validatedDocument.timeline.tempoBpm,
      tempoChanges: validatedDocument.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: validatedDocument.timeline.meterChanges.map(change => ({ ...change })),
      timelineMarkers: validatedDocument.timeline.markers.map(marker => ({ ...marker })),
      loopRange: validatedDocument.timeline.loop.range ? { ...validatedDocument.timeline.loop.range } : null,
      isLoopEnabled: validatedDocument.timeline.loop.isEnabled,
      isMetronomeEnabled: validatedDocument.timeline.metronome.isEnabled,
      metronomeVolume: validatedDocument.timeline.metronome.volume,
      masterVolume: validatedDocument.mixer.masterVolume,
      exportStartTime: validatedDocument.exportRange?.startTimeSeconds ?? null,
      exportEndTime: validatedDocument.exportRange?.endTimeSeconds ?? null,
      tracks,
    },
    audioSources: validatedDocument.audioSources.map(source => ({ ...source })),
  };
}

export function createProjectRestoreSnapshotFromDocumentV9({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV9Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV9ForMapping(document);
  const tracks = new Map<string, TrackState>();
  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV8({ track, pluginCatalog }));
  });

  return {
    session: {
      project: { ...validatedDocument.project },
      tempo: validatedDocument.timeline.tempoBpm,
      tempoChanges: validatedDocument.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: validatedDocument.timeline.meterChanges.map(change => ({ ...change })),
      timelineMarkers: validatedDocument.timeline.markers.map(marker => ({ ...marker })),
      loopRange: validatedDocument.timeline.loop.range ? { ...validatedDocument.timeline.loop.range } : null,
      isLoopEnabled: validatedDocument.timeline.loop.isEnabled,
      isMetronomeEnabled: validatedDocument.timeline.metronome.isEnabled,
      metronomeVolume: validatedDocument.timeline.metronome.volume,
      masterVolume: validatedDocument.mixer.masterVolume,
      routingGraph: cloneRoutingGraphSnapshot(validatedDocument.mixer.routing),
      exportStartTime: validatedDocument.exportRange?.startTimeSeconds ?? null,
      exportEndTime: validatedDocument.exportRange?.endTimeSeconds ?? null,
      tracks,
    },
    audioSources: validatedDocument.audioSources.map(source => ({ ...source })),
  };
}

export function createProjectRestoreSnapshotFromDocumentV10({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV10Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV10ForMapping(document);
  const tracks = new Map<string, TrackState>();
  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV10({ track, pluginCatalog }));
  });

  return {
    session: {
      project: { ...validatedDocument.project },
      tempo: validatedDocument.timeline.tempoBpm,
      tempoChanges: validatedDocument.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: validatedDocument.timeline.meterChanges.map(change => ({ ...change })),
      timelineMarkers: validatedDocument.timeline.markers.map(marker => ({ ...marker })),
      loopRange: validatedDocument.timeline.loop.range ? { ...validatedDocument.timeline.loop.range } : null,
      isLoopEnabled: validatedDocument.timeline.loop.isEnabled,
      isMetronomeEnabled: validatedDocument.timeline.metronome.isEnabled,
      metronomeVolume: validatedDocument.timeline.metronome.volume,
      masterVolume: validatedDocument.mixer.masterVolume,
      routingGraph: cloneRoutingGraphSnapshot(validatedDocument.mixer.routing),
      recording: cloneProjectRecordingState(validatedDocument.recording),
      exportStartTime: validatedDocument.exportRange?.startTimeSeconds ?? null,
      exportEndTime: validatedDocument.exportRange?.endTimeSeconds ?? null,
      tracks,
    },
    audioSources: validatedDocument.audioSources.map(source => ({ ...source })),
  };
}

export function createProjectRestoreSnapshotFromDocumentV11({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV11Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV11ForMapping(document);
  const tracks = new Map<string, TrackState>();
  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV11({ track, pluginCatalog }));
  });

  return {
    session: {
      project: { ...validatedDocument.project },
      tempo: validatedDocument.timeline.tempoBpm,
      tempoChanges: validatedDocument.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: validatedDocument.timeline.meterChanges.map(change => ({ ...change })),
      timelineMarkers: validatedDocument.timeline.markers.map(marker => ({ ...marker })),
      loopRange: validatedDocument.timeline.loop.range ? { ...validatedDocument.timeline.loop.range } : null,
      isLoopEnabled: validatedDocument.timeline.loop.isEnabled,
      isMetronomeEnabled: validatedDocument.timeline.metronome.isEnabled,
      metronomeVolume: validatedDocument.timeline.metronome.volume,
      masterVolume: validatedDocument.mixer.masterVolume,
      routingGraph: cloneRoutingGraphSnapshot(validatedDocument.mixer.routing),
      recording: cloneProjectRecordingState(validatedDocument.recording),
      exportStartTime: validatedDocument.exportRange?.startTimeSeconds ?? null,
      exportEndTime: validatedDocument.exportRange?.endTimeSeconds ?? null,
      tracks,
    },
    audioSources: validatedDocument.audioSources.map(source => ({ ...source })),
  };
}

export function createProjectRestoreSnapshotFromDocumentV12({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV12Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV12ForMapping(document);
  const tracks = new Map<string, TrackState>();
  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV12({ track, pluginCatalog }));
  });

  return {
    session: {
      project: { ...validatedDocument.project },
      tempo: validatedDocument.timeline.tempoBpm,
      tempoChanges: validatedDocument.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: validatedDocument.timeline.meterChanges.map(change => ({ ...change })),
      timelineMarkers: validatedDocument.timeline.markers.map(marker => ({ ...marker })),
      loopRange: validatedDocument.timeline.loop.range ? { ...validatedDocument.timeline.loop.range } : null,
      isLoopEnabled: validatedDocument.timeline.loop.isEnabled,
      isMetronomeEnabled: validatedDocument.timeline.metronome.isEnabled,
      metronomeVolume: validatedDocument.timeline.metronome.volume,
      masterVolume: validatedDocument.mixer.masterVolume,
      routingGraph: cloneRoutingGraphSnapshot(validatedDocument.mixer.routing),
      recording: cloneProjectRecordingState(validatedDocument.recording),
      exportStartTime: validatedDocument.exportRange?.startTimeSeconds ?? null,
      exportEndTime: validatedDocument.exportRange?.endTimeSeconds ?? null,
      tracks,
    },
    audioSources: validatedDocument.audioSources.map(source => ({ ...source })),
  };
}

export function createProjectRestoreSnapshotFromDocumentV13({
  document,
  pluginCatalog,
}: CreateProjectRestoreSnapshotFromDocumentV13Options): ProjectRestoreSnapshot {
  const validatedDocument = readDocumentV13ForMapping(document);
  const tracks = new Map<string, TrackState>();
  validatedDocument.tracks.forEach(track => {
    tracks.set(track.id, createSessionTrackV13({ track, pluginCatalog }));
  });

  return {
    session: {
      project: { ...validatedDocument.project },
      tempo: validatedDocument.timeline.tempoBpm,
      tempoChanges: validatedDocument.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: validatedDocument.timeline.meterChanges.map(change => ({ ...change })),
      timelineMarkers: validatedDocument.timeline.markers.map(marker => ({ ...marker })),
      loopRange: validatedDocument.timeline.loop.range ? { ...validatedDocument.timeline.loop.range } : null,
      isLoopEnabled: validatedDocument.timeline.loop.isEnabled,
      isMetronomeEnabled: validatedDocument.timeline.metronome.isEnabled,
      metronomeVolume: validatedDocument.timeline.metronome.volume,
      masterVolume: validatedDocument.mixer.masterVolume,
      routingGraph: cloneRoutingGraphSnapshot(validatedDocument.mixer.routing),
      recording: cloneProjectRecordingState(validatedDocument.recording),
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
  assertSessionTrackId({ mapKey, track });

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

function createProjectTrackV2({ mapKey, track, pluginCatalog }: SessionTrackV2Entry): ProjectTrackV2 {
  assertSessionTrackId({ mapKey, track });

  return {
    id: track.id,
    name: track.name,
    volume: track.volume,
    pan: track.pan,
    isMuted: track.isMuted,
    isSoloed: track.isSoloed,
    pluginInstances: track.pluginInstances.map(instance =>
      createValidatedProjectPluginInstance({ instance, pluginCatalog, trackId: track.id })
    ),
    regions: track.regions.map(createProjectRegion),
  };
}

function createProjectTrackV3({ mapKey, track, pluginCatalog }: SessionTrackV3Entry): ProjectTrackV3 {
  const projectTrackV2 = createProjectTrackV2({ mapKey, track, pluginCatalog });

  return {
    ...projectTrackV2,
    loopSlots: (track.loopSlots ?? createDefaultLoopSlots()).map(createProjectLoopSlot),
  };
}

function createProjectTrackV4({ mapKey, track, pluginCatalog }: SessionTrackV4Entry): ProjectTrackV4 {
  const projectTrackV2 = createProjectTrackV2({ mapKey, track, pluginCatalog });

  return {
    ...projectTrackV2,
    loopSlots: (track.loopSlots ?? createDefaultLoopSlots()).map(createProjectLoopSlotV4),
  };
}

function createProjectTrackV8({ mapKey, track, pluginCatalog }: SessionTrackV8Entry): ProjectTrackV8 {
  const projectTrackV4 = createProjectTrackV4({ mapKey, track, pluginCatalog });

  return {
    ...projectTrackV4,
    regions: track.regions.map(createProjectRegionV8),
  };
}

function createProjectTrackV10({ mapKey, track, pluginCatalog }: SessionTrackV10Entry): ProjectTrackV10 {
  const projectTrackV8 = createProjectTrackV8({ mapKey, track, pluginCatalog });
  const recording = track.recording ?? createDefaultTrackRecordingState();
  return {
    ...projectTrackV8,
    recording: {
      activePlaylistId: recording.activePlaylistId,
      playlists: recording.playlists.map(playlist => ({
        compSegments: playlist.compSegments.map(segment => ({ ...segment })),
        id: playlist.id,
        name: playlist.name,
        takes: playlist.takes.map(take => ({ ...take })),
      })),
      recordMode: recording.recordMode,
    },
  };
}

function createProjectTrackV11({ mapKey, track, pluginCatalog }: SessionTrackV11Entry): ProjectTrackV11 {
  return {
    ...createProjectTrackV10({ mapKey, track, pluginCatalog }),
    automationLanes: (track.automationLanes ?? []).map(lane => ({
      id: lane.id,
      isEnabled: lane.isEnabled,
      points: lane.points.map(point => ({ ...point })),
      target: { ...lane.target },
    })),
  };
}

function createProjectLoopSlot(loopSlot: LoopSlotState): ProjectLoopSlot {
  if (loopSlot.overdubSourceIds.length > 0) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: '오버더빙 레이어는 ProjectDocument v3에 저장할 수 없습니다.',
      details: { loopSlotId: loopSlot.id, reason: 'OVERDUB_REQUIRES_PROJECT_DOCUMENT_V4' },
    });
  }
  return {
    gain: loopSlot.gain,
    id: loopSlot.id,
    lengthBars: loopSlot.lengthBars,
    quantizationBars: loopSlot.quantizationBars,
    recordedTempoBpm: loopSlot.recordedTempoBpm,
    sourceId: loopSlot.sourceId,
  };
}

function createProjectLoopSlotV4(loopSlot: LoopSlotState): ProjectLoopSlotV4 {
  return {
    gain: loopSlot.gain,
    id: loopSlot.id,
    lengthBars: loopSlot.lengthBars,
    overdubSourceIds: [...loopSlot.overdubSourceIds],
    quantizationBars: loopSlot.quantizationBars,
    recordedTempoBpm: loopSlot.recordedTempoBpm,
    sourceId: loopSlot.sourceId,
  };
}

function assertSessionTrackId({ mapKey, track }: SessionTrackEntry): void {
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
}

function createValidatedProjectPluginInstance({
  instance,
  pluginCatalog,
  trackId,
}: {
  readonly instance: PluginInstanceState;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
  readonly trackId: string;
}): ProjectPluginInstance {
  const projectPluginInstance = createProjectPluginInstance(instance);
  const compatiblePluginInstance = validatePluginInstanceForMapping({
    instance: projectPluginInstance,
    pluginCatalog,
    trackId,
    errorCode: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
  });

  return createProjectPluginInstance(compatiblePluginInstance);
}

function createProjectPluginInstance(instance: PluginInstanceState): ProjectPluginInstance {
  return {
    id: instance.id,
    manifestId: instance.manifestSummary.id,
    manifestVersion: instance.manifestSummary.version,
    isEnabled: instance.isEnabled,
    parameters: instance.parameters.map(parameter => ({ ...parameter })),
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

function createProjectRegionV8(region: RegionState): ProjectRegionV8 {
  return {
    ...createProjectRegion(region),
    fadeIn: { ...region.fadeIn },
    fadeOut: { ...region.fadeOut },
    gain: region.gain,
    isOpaque: region.isOpaque,
    layer: region.layer,
  };
}

function assertSessionRegionEndTime(region: RegionState): void {
  const calculatedEndTime = calculateFiniteRegionEndTime({
    startTime: region.startTime,
    duration: region.duration,
  });
  if (calculatedEndTime === null || !Number.isFinite(region.endTime)) {
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

  if (
    isRegionEndTimeConsistent({
      startTime: region.startTime,
      duration: region.duration,
      endTime: region.endTime,
    })
  ) {
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

function parseSessionDocumentCandidateV2(documentCandidate: unknown): ProjectDocumentV2 {
  try {
    const result = ProjectDocumentV2Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }

    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v2로 변환할 수 없습니다.',
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

function parseSessionDocumentCandidateV3(documentCandidate: unknown): ProjectDocumentV3 {
  try {
    const result = ProjectDocumentV3Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }

    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v3로 변환할 수 없습니다.',
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

function parseSessionDocumentCandidateV4(documentCandidate: unknown): ProjectDocumentV4 {
  try {
    const result = ProjectDocumentV4Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }

    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v4로 변환할 수 없습니다.',
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

function parseSessionDocumentCandidateV5(documentCandidate: unknown): ProjectDocumentV5 {
  try {
    const result = ProjectDocumentV5Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v5로 변환할 수 없습니다.',
      details: { issues: result.error.issues, reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' },
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

function parseSessionDocumentCandidateV6(documentCandidate: unknown): ProjectDocumentV6 {
  try {
    const result = ProjectDocumentV6Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v6로 변환할 수 없습니다.',
      details: { issues: result.error.issues, reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' },
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

function parseSessionDocumentCandidateV7(documentCandidate: unknown): ProjectDocumentV7 {
  try {
    const result = ProjectDocumentV7Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v7로 변환할 수 없습니다.',
      details: { issues: result.error.issues, reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' },
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

function parseSessionDocumentCandidateV8(documentCandidate: unknown): ProjectDocumentV8 {
  try {
    const result = ProjectDocumentV8Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v8로 변환할 수 없습니다.',
      details: { issues: result.error.issues, reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' },
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

function parseSessionDocumentCandidateV9(documentCandidate: unknown): ProjectDocumentV9 {
  try {
    const result = ProjectDocumentV9Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v9로 변환할 수 없습니다.',
      details: { issues: result.error.issues, reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' },
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

function parseSessionDocumentCandidateV10(documentCandidate: unknown): ProjectDocumentV10 {
  try {
    const result = ProjectDocumentV10Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v10으로 변환할 수 없습니다.',
      details: { issues: result.error.issues, reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' },
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

function parseSessionDocumentCandidateV11(documentCandidate: unknown): ProjectDocumentV11 {
  try {
    const result = ProjectDocumentV11Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v11로 변환할 수 없습니다.',
      details: { issues: result.error.issues, reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' },
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

function parseSessionDocumentCandidateV12(documentCandidate: unknown): ProjectDocumentV12 {
  try {
    const result = ProjectDocumentV12Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v12로 변환할 수 없습니다.',
      details: { issues: result.error.issues, reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' },
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

function parseSessionDocumentCandidateV13(documentCandidate: unknown): ProjectDocumentV13 {
  try {
    const result = ProjectDocumentV13Schema.safeParse(documentCandidate);
    if (result.success) {
      return result.data;
    }
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_SESSION_PROJECT_STATE,
      message: 'Session 프로젝트 상태를 유효한 ProjectDocument v13으로 변환할 수 없습니다.',
      details: { issues: result.error.issues, reason: 'PROJECT_DOCUMENT_SCHEMA_VIOLATION' },
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

function readDocumentV2ForMapping(document: ProjectDocument | ProjectDocumentV2): ProjectDocumentV2 {
  try {
    return readProjectDocumentV2(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v2가 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV3ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV3 {
  try {
    return readProjectDocumentV3(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v3가 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV4ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV4 {
  try {
    return readProjectDocumentV4(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v4가 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV5ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV5 {
  try {
    return readProjectDocumentV5(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v5가 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV6ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV6 {
  try {
    return readProjectDocumentV6(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v6가 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV7ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV7 {
  try {
    return readProjectDocumentV7(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v7이 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV8ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV8 {
  try {
    return readProjectDocumentV8(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v8이 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV9ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV9 {
  try {
    return readProjectDocumentV9(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v9가 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV10ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV10 {
  try {
    return readProjectDocumentV10(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v10이 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV11ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV11 {
  try {
    return readProjectDocumentV11(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v11이 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV12ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV12 {
  try {
    return readProjectDocumentV12(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v12가 유효하지 않습니다.',
      details: { reason: 'PROJECT_DOCUMENT_READ_FAILED' },
      cause,
    });
  }
}

function readDocumentV13ForMapping(document: ProjectDocumentSnapshot): ProjectDocumentV13 {
  try {
    return readProjectDocumentV13(document);
  } catch (cause) {
    throw new ProjectDocumentMappingError({
      code: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      message: '복원할 ProjectDocument v13이 유효하지 않습니다.',
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
    pluginInstances: [],
    regions: track.regions.map(createSessionRegion),
  };
}

function createSessionTrackV2({
  track,
  pluginCatalog,
}: {
  readonly track: ProjectTrackV2;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}): TrackState {
  return {
    id: track.id,
    name: track.name,
    volume: track.volume,
    pan: track.pan,
    isMuted: track.isMuted,
    isSoloed: track.isSoloed,
    status: [],
    pluginInstances: track.pluginInstances.map(instance =>
      validatePluginInstanceForMapping({
        instance,
        pluginCatalog,
        trackId: track.id,
        errorCode: ProjectDocumentMappingErrorCode.INVALID_PROJECT_DOCUMENT,
      })
    ),
    regions: track.regions.map(createSessionRegion),
  };
}

function createSessionTrackV3({
  track,
  pluginCatalog,
}: {
  readonly track: ProjectTrackV3;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}): TrackState {
  const sessionTrackV2 = createSessionTrackV2({ track, pluginCatalog });

  return {
    ...sessionTrackV2,
    loopSlots: track.loopSlots.length === 0 ? createDefaultLoopSlots() : track.loopSlots.map(createSessionLoopSlot),
  };
}

function createSessionLoopSlot(loopSlot: ProjectLoopSlot): LoopSlotState {
  return {
    errorMessage: null,
    gain: loopSlot.gain,
    id: loopSlot.id,
    lengthBars: loopSlot.lengthBars,
    overdubSourceIds: [],
    quantizationBars: loopSlot.quantizationBars,
    recordedTempoBpm: loopSlot.recordedTempoBpm,
    scheduledTimeSeconds: null,
    sourceId: loopSlot.sourceId,
    state: loopSlot.sourceId === null ? 'empty' : 'stopped',
  };
}

function createSessionTrackV4({
  track,
  pluginCatalog,
}: {
  readonly track: ProjectTrackV4;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}): TrackState {
  const sessionTrackV2 = createSessionTrackV2({ track, pluginCatalog });

  return {
    ...sessionTrackV2,
    loopSlots: track.loopSlots.length === 0 ? createDefaultLoopSlots() : track.loopSlots.map(createSessionLoopSlotV4),
  };
}

function createSessionTrackV8({
  track,
  pluginCatalog,
}: {
  readonly track: ProjectTrackV8;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}): TrackState {
  const sessionTrackV2 = createSessionTrackV2({ track, pluginCatalog });

  return {
    ...sessionTrackV2,
    loopSlots: track.loopSlots.length === 0 ? createDefaultLoopSlots() : track.loopSlots.map(createSessionLoopSlotV4),
    regions: track.regions.map(createSessionRegion),
  };
}

function createSessionTrackV10({
  track,
  pluginCatalog,
}: {
  readonly track: ProjectTrackV10;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}): TrackState {
  const sessionTrackV8 = createSessionTrackV8({ track, pluginCatalog });
  return {
    ...sessionTrackV8,
    recording: cloneTrackRecordingState(track.recording),
  };
}

function createSessionTrackV11({
  track,
  pluginCatalog,
}: {
  readonly track: ProjectTrackV11;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}): TrackState {
  return {
    ...createSessionTrackV10({ track, pluginCatalog }),
    automationLanes: track.automationLanes.map(lane => cloneAutomationLaneState({ ...lane, mode: 'read' })),
  };
}

function createSessionTrackV12({
  track,
  pluginCatalog,
}: {
  readonly track: ProjectTrackV12;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}): TrackState {
  return {
    ...createSessionTrackV10({ track, pluginCatalog }),
    automationLanes: track.automationLanes.map(cloneAutomationLaneState),
  };
}

function createSessionTrackV13({
  track,
  pluginCatalog,
}: {
  readonly track: ProjectTrackV13;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}): TrackState {
  return {
    ...createSessionTrackV12({ track, pluginCatalog }),
    midi: track.midi ? cloneMidiTrackState(track.midi) : null,
  };
}

function createSessionLoopSlotV4(loopSlot: ProjectLoopSlotV4): LoopSlotState {
  return {
    errorMessage: null,
    gain: loopSlot.gain,
    id: loopSlot.id,
    lengthBars: loopSlot.lengthBars,
    overdubSourceIds: [...loopSlot.overdubSourceIds],
    quantizationBars: loopSlot.quantizationBars,
    recordedTempoBpm: loopSlot.recordedTempoBpm,
    scheduledTimeSeconds: null,
    sourceId: loopSlot.sourceId,
    state: loopSlot.sourceId === null ? 'empty' : 'stopped',
  };
}

function validatePluginInstanceForMapping({
  instance,
  pluginCatalog,
  trackId,
  errorCode,
}: ValidatePluginInstanceForMappingOptions): PluginInstanceState {
  const compatibilityResult = validateProjectPluginCompatibility({ instance, pluginCatalog });
  if (compatibilityResult.status === 'compatible') {
    return compatibilityResult.pluginInstance;
  }

  throw new ProjectDocumentMappingError({
    code: errorCode,
    message: `Track Plugin 상태가 현재 catalog와 호환되지 않습니다: ${trackId}`,
    details: {
      instanceId: instance.id,
      issues: compatibilityResult.issues,
      reason: 'PLUGIN_COMPATIBILITY_FAILED',
      trackId,
    },
  });
}

function createSessionRegion(region: ProjectRegion | ProjectRegionV8): RegionState {
  const endTime = calculateFiniteRegionEndTime({
    startTime: region.startTimeSeconds,
    duration: region.durationSeconds,
  });
  if (endTime === null) {
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
    fadeIn: 'fadeIn' in region ? { ...region.fadeIn } : { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
    fadeOut: 'fadeOut' in region ? { ...region.fadeOut } : { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
    gain: 'gain' in region ? region.gain : 1,
    id: region.id,
    isOpaque: 'isOpaque' in region ? region.isOpaque : false,
    layer: 'layer' in region ? region.layer : 0,
    sourceId: region.sourceId,
    startTime: region.startTimeSeconds,
    endTime,
    sourceStartTime: region.sourceStartTimeSeconds,
    duration: region.durationSeconds,
    status: [],
  };
}
