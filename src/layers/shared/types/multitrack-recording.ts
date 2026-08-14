import type { TimelineRange } from './project-document.schema';

export const RECORD_MODES = ['soundOnSound', 'nonLayered', 'layered'] as const;
export type RecordMode = (typeof RECORD_MODES)[number];

export interface TakeState {
  readonly createdAtEpochMilliseconds: number;
  readonly durationSeconds: number;
  readonly id: string;
  readonly sourceId: string;
  readonly sourceStartTimeSeconds: number;
  readonly startTimeSeconds: number;
  readonly takeNumber: number;
}

export interface CompSegmentState {
  readonly endTimeSeconds: number;
  readonly id: string;
  readonly startTimeSeconds: number;
  readonly takeId: string;
}

export interface PlaylistState {
  readonly compSegments: readonly CompSegmentState[];
  readonly id: string;
  readonly name: string;
  readonly takes: readonly TakeState[];
}

export interface TrackRecordingState {
  readonly activePlaylistId: string | null;
  readonly playlists: readonly PlaylistState[];
  readonly recordMode: RecordMode;
}

export interface RecoverableRecordingSource {
  readonly byteLength: number;
  readonly createdAtEpochMilliseconds: number;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sourceId: string;
  readonly trackId: string;
}

export interface PunchRecordingState {
  readonly isEnabled: boolean;
  readonly range: TimelineRange | null;
}

export interface ProjectRecordingState {
  readonly punch: PunchRecordingState;
  readonly recoverableSources: readonly RecoverableRecordingSource[];
}

export function createDefaultTrackRecordingState(): TrackRecordingState {
  return { activePlaylistId: null, playlists: [], recordMode: 'layered' };
}

export function createDefaultProjectRecordingState(): ProjectRecordingState {
  return { punch: { isEnabled: false, range: null }, recoverableSources: [] };
}

export function cloneTrackRecordingState(state: TrackRecordingState): TrackRecordingState {
  return {
    activePlaylistId: state.activePlaylistId,
    playlists: state.playlists.map(playlist => ({
      compSegments: playlist.compSegments.map(segment => ({ ...segment })),
      id: playlist.id,
      name: playlist.name,
      takes: playlist.takes.map(take => ({ ...take })),
    })),
    recordMode: state.recordMode,
  };
}

export function cloneProjectRecordingState(state: ProjectRecordingState): ProjectRecordingState {
  return {
    punch: { isEnabled: state.punch.isEnabled, range: state.punch.range ? { ...state.punch.range } : null },
    recoverableSources: state.recoverableSources.map(source => ({ ...source })),
  };
}
