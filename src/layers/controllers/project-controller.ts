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
  createProjectDocumentV2FromSession,
  createProjectRestoreSnapshotFromDocumentV2,
  type ProjectRestoreSnapshot,
} from '../project-document-mapper/project-document-mapper';
import type { IProjectRepository } from '../project-repository/i-project-repository';
import type { SessionStore } from '../session/session';
import type {
  ProjectAudioSource,
  ProjectDocumentSnapshot,
  ProjectDocumentV2,
} from '../shared/types/project-document.schema';
import type { ResourceCleanupResult } from '../shared/types/resource-cleanup';
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

export class ProjectController {
  constructor(private readonly dependencies: ProjectControllerDependencies) {}

  async saveProject(): Promise<void> {
    const registrations = this.dependencies.audioSourceRegistry.listCommittedRegistrations();
    const sessionState = this.dependencies.sessionStore.getState();
    const document = createProjectDocumentV2FromSession({
      session: sessionState,
      audioSources: registrations.map(registration => registration.metadata),
      pluginCatalog: [...sessionState.pluginCatalog.values()],
    });

    await this.ensureAudioSources(registrations);
    const savedDocument = await this.saveDocument(document);
    this.dependencies.sessionStore.getState().replaceProjectMetadata(savedDocument.project);
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
  }

  private async prepareProjectRuntime({
    projectId,
    audioSourceRegistry,
  }: {
    readonly projectId: string;
    readonly audioSourceRegistry: IPreparedAudioSourceRegistryReplacement;
  }): Promise<PreparedProjectRuntime> {
    const snapshot = await this.loadProjectSnapshot(projectId);
    await this.restoreAudioSources(snapshot.audioSources, audioSourceRegistry);
    this.attachRegions(snapshot, audioSourceRegistry);
    const audioGraph = await this.dependencies.audioEngine.prepareProjectGraph({
      tracks: this.createAudioGraphTracks(snapshot, audioSourceRegistry),
    });

    return { audioGraph, audioSourceRegistry, snapshot };
  }

  private async loadProjectSnapshot(projectId: string): Promise<ProjectRestoreSnapshot> {
    const document = await this.dependencies.projectRepository.load(projectId);
    if (!document) {
      throw new ProjectLoadError({
        code: ProjectLoadErrorCode.PROJECT_NOT_FOUND,
        message: `프로젝트를 찾을 수 없습니다: ${projectId}`,
        details: { projectId },
      });
    }

    const sessionState = this.dependencies.sessionStore.getState();
    const snapshot = createProjectRestoreSnapshotFromDocumentV2({
      document,
      pluginCatalog: [...sessionState.pluginCatalog.values()],
    });
    if (snapshot.session.project.id !== projectId) {
      throw new ProjectLoadError({
        code: ProjectLoadErrorCode.PROJECT_ID_MISMATCH,
        message: '요청한 Project ID와 저장된 문서의 Project ID가 다릅니다.',
        details: {
          actualProjectId: snapshot.session.project.id,
          requestedProjectId: projectId,
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
      })),
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
          id: region.id,
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
    } catch (cause) {
      publicationError = cause;
      hasPublicationError = true;
    }

    this.disposeRetiredRuntime(retiredAudioGraph, retiredAudioSourceRegistry);
    if (hasPublicationError) {
      throw publicationError;
    }
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

  private async saveDocument(document: ProjectDocumentV2): Promise<ProjectDocumentSnapshot> {
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
