export const CLIP_LAUNCH_MODES = ['trigger', 'gate', 'toggle', 'repeat'] as const;
export type ClipLaunchMode = (typeof CLIP_LAUNCH_MODES)[number];

export const CLIP_FOLLOW_ACTION_TYPES = ['none', 'next', 'stop'] as const;
export type ClipFollowActionType = (typeof CLIP_FOLLOW_ACTION_TYPES)[number];

export interface ClipFollowAction {
  readonly afterBars: 1 | 2 | 4 | 8;
  readonly type: ClipFollowActionType;
}

export interface CuePerformanceEvent {
  readonly durationQuarterNotes: number;
  readonly id: string;
  readonly slotId: string;
  readonly startQuarterNotes: number;
  readonly trackId: string;
}

export interface CuePerformance {
  readonly createdAt: string;
  readonly events: readonly CuePerformanceEvent[];
  readonly id: string;
  readonly name: string;
}

export interface CueState {
  readonly performances: readonly CuePerformance[];
}

export interface CueRecordingRuntimeState {
  readonly events: readonly CuePerformanceEvent[];
  readonly isRecording: boolean;
  readonly startQuarterNotes: number;
}

export function createDefaultCueState(): CueState {
  return { performances: [] };
}

export function createDefaultCueRecordingRuntimeState(): CueRecordingRuntimeState {
  return { events: [], isRecording: false, startQuarterNotes: 0 };
}

export function cloneCueState(state: CueState): CueState {
  return {
    performances: state.performances.map(performance => ({
      ...performance,
      events: performance.events.map(event => ({ ...event })),
    })),
  };
}

export function cloneCueRecordingRuntimeState(state: CueRecordingRuntimeState): CueRecordingRuntimeState {
  return { ...state, events: state.events.map(event => ({ ...event })) };
}
