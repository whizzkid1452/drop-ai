import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { LiveAudioInputDevice, LiveInputRuntimeListener, LiveInputRuntimeState } from '../shared/types/live-input';

export class LiveInputController {
  constructor(private readonly audioEngine: IAudioEngine) {}

  getLiveInputState(): LiveInputRuntimeState {
    return this.audioEngine.getLiveInputState();
  }

  listLiveInputDevices(): Promise<readonly LiveAudioInputDevice[]> {
    return this.audioEngine.listLiveInputDevices();
  }

  subscribeLiveInputState(listener: LiveInputRuntimeListener): () => void {
    return this.audioEngine.subscribeLiveInputState(listener);
  }
}
