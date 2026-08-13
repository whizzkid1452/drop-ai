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
import { TimelineController } from './timeline-controller';
import { MeterController } from './meter-controller';
import { LiveInputController } from './live-input-controller';
import { RecordingController } from './recording-controller';
import { EditorController } from './editor-controller';
import { RegionProcessingController } from './region-processing-controller';
import { AutomationController } from './automation-controller';
import { MidiController } from './midi-controller';

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
  public readonly timeline: TimelineController;
  public readonly meter: MeterController;
  public readonly liveInput: LiveInputController;
  public readonly recording: RecordingController;
  public readonly editor: EditorController;
  public readonly regionProcessing: RegionProcessingController;
  public readonly automation: AutomationController;
  public readonly midi: MidiController;

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
    this.automation = new AutomationController({ audioEngine, sessionStore });
    this.midi = new MidiController({ audioEngine, sessionStore });
    this.region = new RegionController({ sessionStore, audioEngine, audioSourceRegistry });
    this.editor = new EditorController({ regionRuntime: this.region, sessionStore });
    this.regionProcessing = new RegionProcessingController({
      audioEngine,
      audioSourceRegistry,
      audioSourceRepository,
      editorController: this.editor,
      regionRuntime: this.region,
      sessionStore,
    });
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
    this.timeline = new TimelineController(sessionStore);
    this.meter = new MeterController(audioEngine);
    this.liveInput = new LiveInputController(audioEngine);
    this.recording = new RecordingController({
      sessionStore,
      audioEngine,
      audioSourceRegistry,
      audioSourceRepository,
      regionController: this.region,
    });
    this.loop = new LoopController({
      sessionStore,
      audioEngine,
      audioSourceRegistry,
      persistProjectChange: () => this.project.saveProject(),
    });
  }
}
