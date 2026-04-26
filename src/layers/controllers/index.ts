import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';
import { PlaybackController } from './playback-controller';
import { TrackController } from './track-controller';

/**
 * Controller Facade
 */
export class AppController {
  public readonly playback: PlaybackController;
  public readonly track: TrackController;
  public readonly session: SessionStore;
  private readonly audioEngine: IAudioEngine;

  constructor(sessionStore: SessionStore, audioEngine: IAudioEngine) {
    this.session = sessionStore;
    this.audioEngine = audioEngine;
    this.playback = new PlaybackController(sessionStore, audioEngine);
    this.track = new TrackController(sessionStore, audioEngine);
  }

  public getDebugInfo(): string {
    return this.audioEngine.getDebugInfo();
  }

  public async exportSession(
    duration: number,
    filename: string
  ): Promise<void> {
    const { tracks } = this.session.getState();
    const blob = await this.audioEngine.exportSession(duration, tracks);

    // Trigger Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

//싱글톤으로 하고싶어서 클래스로 생성??
//합치는 코드가 react app 에 있어야해서.. 클래스코드로... 