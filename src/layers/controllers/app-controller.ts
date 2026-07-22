import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import { type SessionStore } from '../session/session';
import { PlaybackController } from './playback-controller';
import { TrackController } from './track-controller';
import { RegionController } from './region-controller';
import { ExportController } from './export-controller';

interface AppControllerDependencies {
  sessionStore: SessionStore;
  audioEngine: IAudioEngine;
  audioSourceRegistry: IAudioSourceRegistry;
}

/**
 * Controller Facade
 */
export class AppController {
  public readonly playback: PlaybackController;
  public readonly track: TrackController;
  public readonly region: RegionController;
  public readonly export: ExportController;

  constructor({ sessionStore, audioEngine, audioSourceRegistry }: AppControllerDependencies) {
    this.playback = new PlaybackController(sessionStore, audioEngine);
    this.track = new TrackController({ sessionStore, audioEngine, audioSourceRegistry });
    this.region = new RegionController({ sessionStore, audioEngine, audioSourceRegistry });
    this.export = new ExportController({ sessionStore, audioEngine, audioSourceResolver: audioSourceRegistry });
  }
}
