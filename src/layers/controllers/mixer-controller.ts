import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { SessionStore } from '../session/session';

interface MixerControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly sessionStore: SessionStore;
}

export class MixerController {
  private readonly audioEngine: IAudioEngine;
  private readonly sessionStore: SessionStore;

  constructor({ audioEngine, sessionStore }: MixerControllerDependencies) {
    this.audioEngine = audioEngine;
    this.sessionStore = sessionStore;
  }

  setMasterVolume(volume: number): void {
    this.audioEngine.setMasterVolume(volume);
    this.sessionStore.getState().setMasterVolume(volume);
  }
}
