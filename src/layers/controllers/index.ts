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

  constructor(sessionStore: SessionStore, audioEngine: IAudioEngine) {
    this.session = sessionStore;
    this.playback = new PlaybackController(sessionStore, audioEngine);
    this.track = new TrackController(sessionStore, audioEngine);
  }
}
