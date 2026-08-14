import type { AudioMonitorState } from '../shared/types/audio-monitor-state';

export interface IAudioMonitorQuerySource {
  getMonitorState(): AudioMonitorState;
  subscribeMonitorState(listener: () => void): () => void;
}

export interface IAudioMonitorQuery {
  readState(): AudioMonitorState;
  subscribe(listener: () => void): () => void;
}

export class AudioMonitorQuery implements IAudioMonitorQuery {
  private cachedState: AudioMonitorState | null = null;

  constructor(private readonly source: IAudioMonitorQuerySource) {}

  readState(): AudioMonitorState {
    const nextState = this.source.getMonitorState();
    if (
      this.cachedState?.isCut === nextState.isCut &&
      this.cachedState.isDimmed === nextState.isDimmed &&
      this.cachedState.isMono === nextState.isMono
    ) {
      return this.cachedState;
    }

    this.cachedState = { ...nextState };
    return this.cachedState;
  }

  subscribe(listener: () => void): () => void {
    return this.source.subscribeMonitorState(listener);
  }
}
