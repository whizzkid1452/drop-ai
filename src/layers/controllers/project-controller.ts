import type {
  AudioProjectGraphTrack,
  IAudioEngine,
  IPreparedAudioProjectGraph,
  IRetiredAudioProjectGraph,
} from '../audio-engine/i-audio-engine';
import { AudioSourceRepositoryError } from '../audio-source-repository/errors';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import type {
  AudioSourceRegistration,
  IAudioSourceRegistry,
  IPreparedAudioSourceRegistryReplacement,
  IRetiredAudioSourceRegistry,
} from '../audio-source-registry/i-audio-source-registry';
import {
  createProjectDocumentV17FromSession,
  createProjectDocumentV19FromSession,
  createProjectRestoreSnapshotFromDocumentV19,
  type ProjectRestoreSnapshot,
} from '../project-document-mapper/project-document-mapper';
import { readProjectDocumentV19 } from '../shared/types/project-document-reader';
import { createProjectArchiveBlob, readProjectArchiveBlob } from '../shared/types/project-archive';
import type { ILocalFirstProjectRepository, IProjectRepository } from '../project-repository/i-project-repository';
import type { IProjectSyncService } from '../project-sync/i-project-sync';
import type { SessionState, SessionStore } from '../session/session';
import type {
  ProjectAudioSource,
  ProjectDocumentSnapshot,
  ProjectDocumentV17,
  ProjectDocumentV19,
} from '../shared/types/project-document.schema';
import type { ResourceCleanupResult } from '../shared/types/resource-cleanup';
import { cloneMidiTrackState } from '../shared/types/midi-state';
import { ProjectLoadError, ProjectLoadErrorCode } from './project-load-error';
import {
  ProjectMutationCompensationError,
  type ProjectMutationCompensationFailure,
} from './project-mutation-compensation-error';

interface ProjectControllerDependencies {
  readonly sessionStore: SessionStore;
  readonly audioEngine: IAudioEngine;
  readonly audioSourceRegistry: IAudioSourceRegistry;
  readonly audioSourceRepository: IAudioSourceRepository;
  readonly projectRepository: IProjectRepository;
  readonly localProjectRepository?: ILocalFirstProjectRepository;
  readonly projectSync?: IProjectSyncService;
  readonly onRemoteProjectReplaced?: (projectId: string) => void;
}

interface PreparedProjectRuntime {
  readonly audioGraph: IPreparedAudioProjectGraph;
  readonly audioSourceRegistry: IPreparedAudioSourceRegistryReplacement;
  readonly snapshot: ProjectRestoreSnapshot;
}

interface DiscardPreparedRuntimeOptions {
  readonly cause: unknown;
  readonly audioGraph?: IPreparedAudioProjectGraph;
  readonly audioSourceRegistry: IPreparedAudioSourceRegistryReplacement;
}

interface RecordCleanupFailureOptions {
  readonly step: string;
  readonly cleanup: () => ResourceCleanupResult;
  readonly failures: ProjectMutationCompensationFailure[];
}

interface ProjectSessionVersion {
  readonly exportEndTime: SessionState['exportEndTime'];
  readonly exportSettings: SessionState['exportSettings'];
  readonly lifecycle: SessionState['lifecycle'];
  readonly cue: SessionState['cue'];
  readonly exportStartTime: SessionState['exportStartTime'];
  readonly masterVolume: number;
  readonly routingGraph: SessionState['routingGraph'];
  readonly recording: SessionState['recording'];
  readonly pluginCatalog: SessionState['pluginCatalog'];
  readonly project: SessionState['project'];
  readonly tempo: number;
  readonly tempoChanges: SessionState['tempoChanges'];
  readonly meterChanges: SessionState['meterChanges'];
  readonly timelineMarkers: SessionState['timelineMarkers'];
  readonly loopRange: SessionState['loopRange'];
  readonly isLoopEnabled: boolean;
  readonly isMetronomeEnabled: boolean;
  readonly metronomeVolume: number;
  readonly tracks: SessionState['tracks'];
}

export class ProjectController {
  private saveTail: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: ProjectControllerDependencies) {}

  async saveProject(): Promise<void> {
    // 녹음 완료 이벤트와 명령 저장이 겹쳐도 앞선 commit의 revision 갱신 뒤 다음 snapshot을 만든다.
    const save = this.saveTail.then(() => this.saveProjectOnce());
    this.saveTail = save.catch(() => undefined);
    return save;
  }

  private async saveProjectOnce(): Promise<void> {
    const registrations = this.dependencies.audioSourceRegistry.listCommittedRegistrations();
    const sessionState = this.dependencies.sessionStore.getState();
    const document = createProjectDocumentV19FromSession({
      session: sessionState,
      audioSources: registrations.map(registration => registration.metadata),
      pluginCatalog: [...sessionState.pluginCatalog.values()],
    });

    await this.ensureAudioSources(registrations);
    const savedDocument = this.dependencies.localProjectRepository
      ? (
          await this.dependencies.localProjectRepository.commitLocal({
            document,
            expectedRevision: document.project.revision,
            operationId: crypto.randomUUID(),
          })
        ).document
      : await this.saveDocument(document);
    this.dependencies.sessionStore.getState().replaceProjectMetadata(savedDocument.project);
    this.dependencies.projectSync?.notifyProjectChanged(savedDocument.project.id);
  }

  async loadProject(projectId: string): Promise<void> {
    const preparedAudioSourceRegistry = this.dependencies.audioSourceRegistry.beginReplacement();
    let preparedAudioGraph: IPreparedAudioProjectGraph | undefined;
    let preparedRuntime: PreparedProjectRuntime;

    try {
      preparedRuntime = await this.prepareProjectRuntime({
        projectId,
        audioSourceRegistry: preparedAudioSourceRegistry,
      });
      preparedAudioGraph = preparedRuntime.audioGraph;
      preparedRuntime.audioSourceRegistry.assertActivatable();
      preparedRuntime.audioGraph.assertActivatable();
    } catch (cause) {
      this.rethrowAfterDiscard({
        cause,
        audioGraph: preparedAudioGraph,
        audioSourceRegistry: preparedAudioSourceRegistry,
      });
    }

    this.activateProjectRuntime(preparedRuntime);
    this.dependencies.projectSync?.activateProject(preparedRuntime.snapshot.session.project.id);
  }

  createSnapshotDocument(session: SessionState = this.dependencies.sessionStore.getState()): ProjectDocumentV17 {
    const registrations = this.dependencies.audioSourceRegistry.listCommittedRegistrations();
    return createProjectDocumentV17FromSession({
      session,
      audioSources: registrations.map(registration => registration.metadata),
      pluginCatalog: [...session.pluginCatalog.values()],
    });
  }

  async restoreSnapshotDocument(document: ProjectDocumentSnapshot): Promise<void> {
    const currentSession = this.dependencies.sessionStore.getState();
    const migratedDocument = readProjectDocumentV19(document);
    const restoreDocument = readProjectDocumentV19({
      ...migratedDocument,
      cue: currentSession.cue,
      lifecycle: currentSession.lifecycle,
      project: currentSession.project,
    });
    const preparedAudioSourceRegistry = this.dependencies.audioSourceRegistry.beginReplacement();
    let preparedAudioGraph: IPreparedAudioProjectGraph | undefined;
    let preparedRuntime: PreparedProjectRuntime;
    try {
      preparedRuntime = await this.prepareProjectRuntimeFromDocument({
        document: restoreDocument,
        expectedProjectId: currentSession.project.id,
        audioSourceRegistry: preparedAudioSourceRegistry,
      });
      preparedAudioGraph = preparedRuntime.audioGraph;
      preparedRuntime.audioSourceRegistry.assertActivatable();
      preparedRuntime.audioGraph.assertActivatable();
    } catch (cause) {
      this.rethrowAfterDiscard({
        cause,
        audioGraph: preparedAudioGraph,
        audioSourceRegistry: preparedAudioSourceRegistry,
      });
    }
    this.activateProjectRuntime(preparedRuntime);
  }

  async exportProjectArchive(): Promise<Blob> {
    const session = this.dependencies.sessionStore.getState();
    const registrations = this.dependencies.audioSourceRegistry.listCommittedRegistrations();
    return createProjectArchiveBlob({
      document: createProjectDocumentV19FromSession({
        session,
        audioSources: registrations.map(registration => registration.metadata),
        pluginCatalog: [...session.pluginCatalog.values()],
      }),
      sources: registrations,
    });
  }

  async importProjectArchive(blob: Blob): Promise<void> {
    const archive = await readProjectArchiveBlob(blob);
    for (const source of archive.sources) {
      try {
        await this.dependencies.audioSourceRepository.create(source);
      } catch (cause) {
        if (!this.isConcurrentSourceCreation(cause)) {
          throw cause;
        }
        const existingBlob = await this.dependencies.audioSourceRepository.load(source.metadata);
        if (!existingBlob || !(await areBlobsEqual(existingBlob, source.blob))) {
          throw new Error(`Archive Source ID가 다른 바이트와 충돌합니다: ${source.metadata.id}`, { cause });
        }
      }
    }
    await this.restoreSnapshotDocument(archive.document);
  }

  async applyRemoteProjectDocument(document: ProjectDocumentSnapshot): Promise<boolean> {
    const expectedSessionVersion = this.captureProjectSessionVersion();
    await this.saveTail;
    if (!this.isProjectSessionVersionCurrent(expectedSessionVersion)) {
      return false;
    }
    if (expectedSessionVersion.project.id !== document.project.id) {
      return false;
    }

    const preparedAudioSourceRegistry = this.dependencies.audioSourceRegistry.beginReplacement();
    let preparedAudioGraph: IPreparedAudioProjectGraph | undefined;
    let preparedRuntime: PreparedProjectRuntime;

    try {
      preparedRuntime = await this.prepareProjectRuntimeFromDocument({
        document,
        expectedProjectId: document.project.id,
        audioSourceRegistry: preparedAudioSourceRegistry,
      });
      preparedAudioGraph = preparedRuntime.audioGraph;
      preparedRuntime.audioSourceRegistry.assertActivatable();
      preparedRuntime.audioGraph.assertActivatable();
    } catch (cause) {
      this.rethrowAfterDiscard({
        cause,
        audioGraph: preparedAudioGraph,
        audioSourceRegistry: preparedAudioSourceRegistry,
      });
    }

    if (!this.isProjectSessionVersionCurrent(expectedSessionVersion)) {
      this.discardPreparedRuntime({
        audioGraph: preparedRuntime.audioGraph,
        audioSourceRegistry: preparedRuntime.audioSourceRegistry,
      });
      return false;
    }

    this.activateProjectRuntime(preparedRuntime);
    this.dependencies.onRemoteProjectReplaced?.(document.project.id);
    return true;
  }

  private async prepareProjectRuntime({
    projectId,
    audioSourceRegistry,
  }: {
    readonly projectId: string;
    readonly audioSourceRegistry: IPreparedAudioSourceRegistryReplacement;
  }): Promise<PreparedProjectRuntime> {
    const snapshot = await this.loadProjectSnapshot(projectId);
    return this.prepareProjectRuntimeFromSnapshot({ snapshot, audioSourceRegistry });
  }

  private async prepareProjectRuntimeFromDocument({
    document,
    expectedProjectId,
    audioSourceRegistry,
  }: {
    readonly document: ProjectDocumentSnapshot;
    readonly expectedProjectId: string;
    readonly audioSourceRegistry: IPreparedAudioSourceRegistryReplacement;
  }): Promise<PreparedProjectRuntime> {
    const snapshot = this.createProjectRestoreSnapshot({ document, expectedProjectId });
    return this.prepareProjectRuntimeFromSnapshot({ snapshot, audioSourceRegistry });
  }

  private async prepareProjectRuntimeFromSnapshot({
    snapshot,
    audioSourceRegistry,
  }: {
    readonly snapshot: ProjectRestoreSnapshot;
    readonly audioSourceRegistry: IPreparedAudioSourceRegistryReplacement;
  }): Promise<PreparedProjectRuntime> {
    await this.restoreAudioSources(snapshot.audioSources, audioSourceRegistry);
    this.attachRegions(snapshot, audioSourceRegistry);
    const audioGraph = await this.dependencies.audioEngine.prepareProjectGraph({
      masterVolume: snapshot.session.masterVolume,
      routingGraph: snapshot.session.routingGraph,
      tracks: this.createAudioGraphTracks(snapshot, audioSourceRegistry),
    });

    return { audioGraph, audioSourceRegistry, snapshot };
  }

  private async loadProjectSnapshot(projectId: string): Promise<ProjectRestoreSnapshot> {
    let document = await this.dependencies.projectRepository.load(projectId);
    if (!document) {
      await this.dependencies.projectSync?.ensureLocalProject?.(projectId);
      document = await this.dependencies.projectRepository.load(projectId);
    }
    if (!document) {
      throw new ProjectLoadError({
        code: ProjectLoadErrorCode.PROJECT_NOT_FOUND,
        message: `프로젝트를 찾을 수 없습니다: ${projectId}`,
        details: { projectId },
      });
    }

    await this.dependencies.projectSync?.ensureLocalProjectMedia(document);
    return this.createProjectRestoreSnapshot({ document, expectedProjectId: projectId });
  }

  private createProjectRestoreSnapshot({
    document,
    expectedProjectId,
  }: {
    readonly document: ProjectDocumentSnapshot;
    readonly expectedProjectId: string;
  }): ProjectRestoreSnapshot {
    const sessionState = this.dependencies.sessionStore.getState();
    const snapshot = createProjectRestoreSnapshotFromDocumentV19({
      document,
      pluginCatalog: [...sessionState.pluginCatalog.values()],
    });
    if (snapshot.session.project.id !== expectedProjectId) {
      throw new ProjectLoadError({
        code: ProjectLoadErrorCode.PROJECT_ID_MISMATCH,
        message: '요청한 Project ID와 저장된 문서의 Project ID가 다릅니다.',
        details: {
          actualProjectId: snapshot.session.project.id,
          requestedProjectId: expectedProjectId,
        },
      });
    }

    return snapshot;
  }

  private async restoreAudioSources(
    audioSources: readonly ProjectAudioSource[],
    registry: IPreparedAudioSourceRegistryReplacement
  ): Promise<void> {
    for (const metadata of audioSources) {
      const blob = await this.dependencies.audioSourceRepository.load(metadata);
      if (!blob) {
        throw new ProjectLoadError({
          code: ProjectLoadErrorCode.AUDIO_SOURCE_NOT_FOUND,
          message: `저장된 오디오 Source를 찾을 수 없습니다: ${metadata.id}`,
          details: { sourceId: metadata.id },
        });
      }
      registry.restoreCommitted({ metadata, blob });
    }
  }

  private attachRegions(snapshot: ProjectRestoreSnapshot, registry: IPreparedAudioSourceRegistryReplacement): void {
    snapshot.session.tracks.forEach(track => {
      track.regions.forEach(region => {
        registry.attach({ sourceId: region.sourceId, regionId: region.id });
      });
      (track.loopSlots ?? []).forEach(loopSlot => {
        const sourceIds = loopSlot.sourceId === null ? [] : [loopSlot.sourceId, ...loopSlot.overdubSourceIds];
        sourceIds.forEach(sourceId => registry.attachLoopSlot({ sourceId, loopSlotId: loopSlot.id }));
      });
    });
  }

  private createAudioGraphTracks(
    snapshot: ProjectRestoreSnapshot,
    registry: IPreparedAudioSourceRegistryReplacement
  ): AudioProjectGraphTrack[] {
    return [...snapshot.session.tracks.values()].map(track => ({
      id: track.id,
      volume: track.volume,
      pan: track.pan,
      isMuted: track.isMuted,
      isSoloed: track.isSoloed,
      pluginInstances: track.pluginInstances.map(instance => ({
        instanceId: instance.id,
        manifestId: instance.manifestSummary.id,
        isEnabled: instance.isEnabled,
        parameterValues: new Map(instance.parameters.map(parameter => [parameter.id, parameter.value] as const)),
        sidechainSourceTrackId: instance.sidechainSourceTrackId ?? null,
        stateBlob: instance.stateBlob ?? null,
      })),
      automationLanes: (track.automationLanes ?? []).map(lane => ({
        ...lane,
        points: lane.points.map(point => ({ ...point })),
        target: { ...lane.target },
      })),
      midi: track.midi ? cloneMidiTrackState(track.midi) : track.midi,
      loops: (track.loopSlots ?? []).flatMap(loopSlot => {
        if (loopSlot.sourceId === null) {
          return [];
        }
        return [loopSlot.sourceId, ...loopSlot.overdubSourceIds].map(sourceId => {
          const source = registry.resolve(sourceId);
          if (!source) {
            throw new ProjectLoadError({
              code: ProjectLoadErrorCode.RUNTIME_AUDIO_SOURCE_NOT_FOUND,
              message: `준비한 Runtime Source를 찾을 수 없습니다: ${sourceId}`,
              details: { loopSlotId: loopSlot.id, sourceId },
            });
          }
          return {
            gain: loopSlot.gain,
            slotId: loopSlot.id,
            sourceEndTimeSeconds: loopSlot.sourceEndTimeSeconds,
            sourceStartTimeSeconds: loopSlot.sourceStartTimeSeconds,
            url: source.objectUrl,
          };
        });
      }),
      regions: track.regions.map(region => {
        const source = registry.resolve(region.sourceId);
        if (!source) {
          throw new ProjectLoadError({
            code: ProjectLoadErrorCode.RUNTIME_AUDIO_SOURCE_NOT_FOUND,
            message: `준비한 Runtime Source를 찾을 수 없습니다: ${region.sourceId}`,
            details: { regionId: region.id, sourceId: region.sourceId },
          });
        }

        return {
          fadeIn: { ...region.fadeIn },
          fadeOut: { ...region.fadeOut },
          gain: region.gain,
          id: region.id,
          isOpaque: region.isOpaque,
          layer: region.layer,
          url: source.objectUrl,
          startTime: region.startTime,
          sourceStartTime: region.sourceStartTime,
          duration: region.duration,
        };
      }),
    }));
  }

  private activateProjectRuntime(preparedRuntime: PreparedProjectRuntime): void {
    let retiredAudioGraph: IRetiredAudioProjectGraph;

    try {
      retiredAudioGraph = preparedRuntime.audioGraph.activate();
    } catch (cause) {
      this.rethrowAfterDiscard({
        cause,
        audioGraph: preparedRuntime.audioGraph,
        audioSourceRegistry: preparedRuntime.audioSourceRegistry,
      });
    }

    const retiredAudioSourceRegistry = preparedRuntime.audioSourceRegistry.activate();
    let publicationError: unknown;
    let hasPublicationError = false;

    try {
      this.dependencies.sessionStore.getState().replaceProjectState(preparedRuntime.snapshot.session);
      this.applyTransportSnapshot(preparedRuntime.snapshot.session);
    } catch (cause) {
      publicationError = cause;
      hasPublicationError = true;
    }

    this.disposeRetiredRuntime(retiredAudioGraph, retiredAudioSourceRegistry);
    if (hasPublicationError) {
      throw publicationError;
    }
  }

  private applyTransportSnapshot(session: ProjectRestoreSnapshot['session']): void {
    this.dependencies.audioEngine.setTempoMap({
      changes: session.tempoChanges ?? [{ bpm: session.tempo, quarterNotePosition: 0 }],
    });
    this.dependencies.audioEngine.setLoopRange(session.loopRange ?? null);
    this.dependencies.audioEngine.setLoopEnabled(session.isLoopEnabled ?? false);
    this.dependencies.audioEngine.setMetronomeVolume(session.metronomeVolume ?? 0.8);
    this.dependencies.audioEngine.setMetronomeEnabled(session.isMetronomeEnabled ?? false);
  }

  private disposeRetiredRuntime(
    audioGraph: IRetiredAudioProjectGraph,
    audioSourceRegistry: IRetiredAudioSourceRegistry
  ): void {
    this.disposeRetiredResource('AUDIO_GRAPH_DISPOSE', () => audioGraph.dispose());
    this.disposeRetiredResource('AUDIO_SOURCE_REGISTRY_DISPOSE', () => audioSourceRegistry.dispose());
  }

  private disposeRetiredResource(step: string, dispose: () => ResourceCleanupResult): void {
    try {
      const result = dispose();
      if (!result.isComplete) {
        console.error(`[ProjectController] ${step} 미완료`, result);
      }
    } catch (error) {
      console.error(`[ProjectController] ${step} 실패`, error);
    }
  }

  private rethrowAfterDiscard(options: DiscardPreparedRuntimeOptions): never {
    const compensationFailures: ProjectMutationCompensationFailure[] = [];
    if (options.audioGraph) {
      const audioGraph = options.audioGraph;
      this.recordCleanupFailure({
        step: 'AUDIO_GRAPH_DISCARD',
        cleanup: () => audioGraph.discard(),
        failures: compensationFailures,
      });
    }
    this.recordCleanupFailure({
      step: 'AUDIO_SOURCE_REGISTRY_DISCARD',
      cleanup: () => options.audioSourceRegistry.discard(),
      failures: compensationFailures,
    });

    if (compensationFailures.length > 0) {
      throw new ProjectMutationCompensationError({
        operation: 'LOAD_PROJECT',
        failedPhase: 'PREPARED_RUNTIME_DISCARD',
        cause: options.cause,
        compensationFailures,
      });
    }
    throw options.cause;
  }

  private discardPreparedRuntime({
    audioGraph,
    audioSourceRegistry,
  }: {
    readonly audioGraph: IPreparedAudioProjectGraph;
    readonly audioSourceRegistry: IPreparedAudioSourceRegistryReplacement;
  }): void {
    const compensationFailures: ProjectMutationCompensationFailure[] = [];
    this.recordCleanupFailure({
      step: 'AUDIO_GRAPH_DISCARD',
      cleanup: () => audioGraph.discard(),
      failures: compensationFailures,
    });
    this.recordCleanupFailure({
      step: 'AUDIO_SOURCE_REGISTRY_DISCARD',
      cleanup: () => audioSourceRegistry.discard(),
      failures: compensationFailures,
    });
    if (compensationFailures.length > 0) {
      throw new ProjectMutationCompensationError({
        operation: 'APPLY_REMOTE_PROJECT',
        failedPhase: 'PREPARED_RUNTIME_DISCARD',
        cause: new Error('원격 프로젝트 적용 전에 Session이 변경됐습니다.'),
        compensationFailures,
      });
    }
  }

  private captureProjectSessionVersion(): ProjectSessionVersion {
    const session = this.dependencies.sessionStore.getState();
    return {
      exportEndTime: session.exportEndTime,
      exportSettings: session.exportSettings,
      lifecycle: session.lifecycle,
      cue: session.cue,
      exportStartTime: session.exportStartTime,
      masterVolume: session.masterVolume,
      routingGraph: session.routingGraph,
      recording: session.recording,
      pluginCatalog: session.pluginCatalog,
      project: session.project,
      tempo: session.tempo,
      tempoChanges: session.tempoChanges,
      meterChanges: session.meterChanges,
      timelineMarkers: session.timelineMarkers,
      loopRange: session.loopRange,
      isLoopEnabled: session.isLoopEnabled,
      isMetronomeEnabled: session.isMetronomeEnabled,
      metronomeVolume: session.metronomeVolume,
      tracks: session.tracks,
    };
  }

  private isProjectSessionVersionCurrent(expected: ProjectSessionVersion): boolean {
    const current = this.dependencies.sessionStore.getState();
    return (
      current.exportEndTime === expected.exportEndTime &&
      current.exportSettings === expected.exportSettings &&
      current.lifecycle === expected.lifecycle &&
      current.cue === expected.cue &&
      current.exportStartTime === expected.exportStartTime &&
      current.masterVolume === expected.masterVolume &&
      current.routingGraph === expected.routingGraph &&
      current.recording === expected.recording &&
      current.pluginCatalog === expected.pluginCatalog &&
      current.project === expected.project &&
      current.tempo === expected.tempo &&
      current.tempoChanges === expected.tempoChanges &&
      current.meterChanges === expected.meterChanges &&
      current.timelineMarkers === expected.timelineMarkers &&
      current.loopRange === expected.loopRange &&
      current.isLoopEnabled === expected.isLoopEnabled &&
      current.isMetronomeEnabled === expected.isMetronomeEnabled &&
      current.metronomeVolume === expected.metronomeVolume &&
      current.tracks === expected.tracks
    );
  }

  private recordCleanupFailure({ step, cleanup, failures }: RecordCleanupFailureOptions): void {
    try {
      const result = cleanup();
      if (result.isComplete) {
        return;
      }
      failures.push({
        step,
        cause: new Error(`${step} 정리가 완료되지 않았습니다. 남은 자원: ${result.failedResourceCount}`),
      });
    } catch (cause) {
      failures.push({ step, cause });
    }
  }

  private async ensureAudioSources(registrations: ReadonlyArray<Readonly<AudioSourceRegistration>>): Promise<void> {
    for (const registration of registrations) {
      await this.ensureAudioSource(registration);
    }
  }

  private async ensureAudioSource(registration: Readonly<AudioSourceRegistration>): Promise<void> {
    const storedBlob = await this.dependencies.audioSourceRepository.load(registration.metadata);
    if (storedBlob) {
      return;
    }

    try {
      await this.dependencies.audioSourceRepository.create(registration);
    } catch (cause) {
      if (!this.isConcurrentSourceCreation(cause)) {
        throw cause;
      }

      const concurrentlyStoredBlob = await this.dependencies.audioSourceRepository.load(registration.metadata);
      if (concurrentlyStoredBlob) {
        return;
      }

      throw cause;
    }
  }

  private async saveDocument(document: ProjectDocumentV19): Promise<ProjectDocumentSnapshot> {
    const storedDocument = await this.dependencies.projectRepository.load(document.project.id);
    if (!storedDocument) {
      return this.dependencies.projectRepository.create(document);
    }

    return this.dependencies.projectRepository.save({
      document,
      expectedRevision: document.project.revision,
    });
  }

  private isConcurrentSourceCreation(cause: unknown): cause is AudioSourceRepositoryError {
    return cause instanceof AudioSourceRepositoryError && cause.code === 'SOURCE_ALREADY_EXISTS';
  }
}

async function areBlobsEqual(left: Blob, right: Blob): Promise<boolean> {
  if (left.size !== right.size || left.type !== right.type) {
    return false;
  }
  const [leftBytes, rightBytes] = await Promise.all([left.arrayBuffer(), right.arrayBuffer()]);
  const leftView = new Uint8Array(leftBytes);
  const rightView = new Uint8Array(rightBytes);
  return leftView.every((value, index) => value === rightView[index]);
}
