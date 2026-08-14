import type { RecordingRuntimeListener, RecordingRuntimeState } from '../shared/types/linear-recording';

export interface IRecordingQuerySource {
  getRecordingState(): RecordingRuntimeState;
  subscribeRecordingState(listener: RecordingRuntimeListener): () => void;
}

export interface IRecordingQuery {
  readState(): RecordingRuntimeState;
  subscribe(listener: () => void): () => void;
}

export class RecordingQuery implements IRecordingQuery {
  private cachedState: RecordingRuntimeState | null = null;

  constructor(private readonly source: IRecordingQuerySource) {}

  readState(): RecordingRuntimeState {
    const nextState = this.source.getRecordingState();
    if (
      this.cachedState !== null &&
      areStringArraysEqual(this.cachedState.armedTrackIds, nextState.armedTrackIds) &&
      areInputRoutesEqual(this.cachedState.inputRoutes, nextState.inputRoutes) &&
      this.cachedState.phase === nextState.phase &&
      this.cachedState.recordStartTimeSeconds === nextState.recordStartTimeSeconds
    ) {
      return this.cachedState;
    }

    this.cachedState = {
      ...nextState,
      armedTrackIds: [...nextState.armedTrackIds],
      inputRoutes: nextState.inputRoutes.map(route => ({ ...route })),
    };
    return this.cachedState;
  }

  subscribe(listener: () => void): () => void {
    return this.source.subscribeRecordingState(listener);
  }
}

function areStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function areInputRoutesEqual(
  left: RecordingRuntimeState['inputRoutes'],
  right: RecordingRuntimeState['inputRoutes']
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (route, index) =>
        route.trackId === right[index]?.trackId &&
        route.deviceId === right[index]?.deviceId &&
        route.channelIndex === right[index]?.channelIndex
    )
  );
}
