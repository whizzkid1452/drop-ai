import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import type { ILocalFirstProjectRepository } from '../project-repository/i-project-repository';
import type { IProjectSyncService } from '../project-sync/i-project-sync';
import type { IPluginHost } from '../plugin-host/i-plugin-host';
import { type SessionStore } from '../session/session';
import { PlaybackController } from './playback-controller';
import { TrackController } from './track-controller';
import { RegionController } from './region-controller';
import { ExportController } from './export-controller';
import { ProjectController } from './project-controller';
import { PluginController } from './plugin-controller';
import { MixerController } from './mixer-controller';
import { LoopController } from './loop-controller';

interface AppControllerDependencies {
  sessionStore: SessionStore;
  audioEngine: IAudioEngine;
  audioSourceRegistry: IAudioSourceRegistry;
  audioSourceRepository: IAudioSourceRepository;
  projectRepository: ILocalFirstProjectRepository;
  projectSync?: IProjectSyncService;
  pluginHost: IPluginHost;
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
  public readonly plugin: PluginController;
  public readonly mixer: MixerController;
  public readonly loop: LoopController;

  constructor({
    sessionStore,
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    projectRepository,
    projectSync,
    pluginHost,
  }: AppControllerDependencies) {
    this.playback = new PlaybackController(sessionStore, audioEngine);
    this.track = new TrackController({ sessionStore, audioEngine, audioSourceRegistry });
    this.region = new RegionController({ sessionStore, audioEngine, audioSourceRegistry });
    this.export = new ExportController({ sessionStore, audioEngine, audioSourceResolver: audioSourceRegistry });
    this.project = new ProjectController({
      sessionStore,
      audioEngine,
      audioSourceRegistry,
      audioSourceRepository,
      projectRepository,
      localProjectRepository: projectRepository,
      projectSync,
    });
    this.plugin = new PluginController({ pluginHost, sessionStore, audioEngine });
    this.mixer = new MixerController({ sessionStore, audioEngine });
    this.loop = new LoopController({
      sessionStore,
      audioEngine,
      audioSourceRegistry,
      persistProjectChange: () => this.project.saveProject(),
    });
  }
}
