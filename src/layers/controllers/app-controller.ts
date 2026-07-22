import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import type { IProjectRepository } from '../project-repository/i-project-repository';
import { type SessionStore } from '../session/session';
import { PlaybackController } from './playback-controller';
import { TrackController } from './track-controller';
import { RegionController } from './region-controller';
import { ExportController } from './export-controller';
import { ProjectController } from './project-controller';

interface AppControllerDependencies {
  sessionStore: SessionStore;
  audioEngine: IAudioEngine;
  audioSourceRegistry: IAudioSourceRegistry;
  audioSourceRepository: IAudioSourceRepository;
  projectRepository: IProjectRepository;
}

/**
 * Controller Facade
 */
export class AppController {
  public readonly playback: PlaybackController;
  public readonly track: TrackController;
  public readonly region: RegionController;
  public readonly export: ExportController;
  public readonly project: ProjectController;

  constructor({
    sessionStore,
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    projectRepository,
  }: AppControllerDependencies) {
    this.playback = new PlaybackController(sessionStore, audioEngine);
    this.track = new TrackController({ sessionStore, audioEngine, audioSourceRegistry });
    this.region = new RegionController({ sessionStore, audioEngine, audioSourceRegistry });
    this.export = new ExportController({ sessionStore, audioEngine, audioSourceResolver: audioSourceRegistry });
    this.project = new ProjectController({
      sessionStore,
      audioSourceReader: audioSourceRegistry,
      audioSourceRepository,
      projectRepository,
    });
  }
}
