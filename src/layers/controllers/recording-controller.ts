import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { RecordingRuntimeListener, RecordingRuntimeState } from '../shared/types/linear-recording';

export class RecordingController {
  constructor(private readonly audioEngine: IAudioEngine) {}

  getRecordingState(): RecordingRuntimeState {
    return this.audioEngine.getRecordingState();
  }

  subscribeRecordingState(listener: RecordingRuntimeListener): () => void {
    return this.audioEngine.subscribeRecordingState(listener);
  }
}
