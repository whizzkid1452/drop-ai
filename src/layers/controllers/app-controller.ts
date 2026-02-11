import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';
import { PlaybackController } from './playback-controller';
import { TrackController } from './track-controller';
import { RegionController } from './region-controller';
import { ExportController } from './export-controller';

/**
 * Controller Facade
 */
export class AppController {
  public readonly playback: PlaybackController;
  public readonly track: TrackController;
  public readonly region: RegionController;
  public readonly export: ExportController;

  constructor(sessionStore: SessionStore, audioEngine: IAudioEngine) {
    this.playback = new PlaybackController(sessionStore, audioEngine);
    this.track = new TrackController(sessionStore, audioEngine);
    this.region = new RegionController(sessionStore, audioEngine);
    this.export = new ExportController(sessionStore, audioEngine);
  }
}
