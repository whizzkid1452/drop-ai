import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type {
  CommittedAudioSourceRegistration,
  IAudioSourceRegistry,
} from '../audio-source-registry/i-audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import {
  ProjectMutationCompensationError,
  type ProjectMutationCompensationFailure,
} from './project-mutation-compensation-error';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface MediaSourceControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly audioSourceRegistry: IAudioSourceRegistry;
  readonly audioSourceRepository: IAudioSourceRepository;
}

interface SetSourceTagsRequest {
  readonly sourceId: string;
  readonly tags: readonly string[];
}

export interface CleanupUnusedSourcesResult {
  readonly removedSourceIds: readonly string[];
}

export class MediaSourceController {
  readonly #audioEngine: IAudioEngine;
  readonly #audioSourceRegistry: IAudioSourceRegistry;
  readonly #audioSourceRepository: IAudioSourceRepository;

  constructor({ audioEngine, audioSourceRegistry, audioSourceRepository }: MediaSourceControllerDependencies) {
    this.#audioEngine = audioEngine;
    this.#audioSourceRegistry = audioSourceRegistry;
    this.#audioSourceRepository = audioSourceRepository;
  }

  setSourceTags({ sourceId, tags }: SetSourceTagsRequest): void {
    const registration = this.getRequiredRegistration(sourceId);
    this.#audioSourceRegistry.updateMetadata({
      ...registration.metadata,
      tags: this.normalizeTags(tags),
    });
  }

  async auditionSource(sourceId: string): Promise<void> {
    const registration = this.getRequiredRegistration(sourceId);
    await this.#audioEngine.auditionAudioSource({ blob: registration.blob });
  }

  stopAudition(): void {
    this.#audioEngine.stopAudioSourceAudition();
  }

  async cleanupUnusedSources(): Promise<CleanupUnusedSourcesResult> {
    const committedRegistrations = this.#audioSourceRegistry.listCommittedRegistrations();
    const derivedParentSourceIds = new Set(
      committedRegistrations.flatMap(registration =>
        registration.metadata.derivation ? [registration.metadata.derivation.sourceId] : []
      )
    );
    const unusedRegistrations = committedRegistrations.filter(registration =>
      this.isUnused(registration.metadata.id, derivedParentSourceIds)
    );
    if (unusedRegistrations.length === 0) {
      return { removedSourceIds: [] };
    }

    await this.purgeRuntimeRegistrations(unusedRegistrations);
    await this.deleteStoredRegistrations(unusedRegistrations);
    return { removedSourceIds: unusedRegistrations.map(registration => registration.metadata.id) };
  }

  private getRequiredRegistration(sourceId: string): Readonly<CommittedAudioSourceRegistration> {
    const registration = this.#audioSourceRegistry
      .listCommittedRegistrations()
      .find(candidate => candidate.metadata.id === sourceId);
    if (!registration) {
      throw new ProjectStateError(
        ProjectStateErrorCode.AUDIO_SOURCE_NOT_FOUND,
        `Audio Source를 찾을 수 없습니다: ${sourceId}`,
        { sourceId }
      );
    }
    return registration;
  }

  private normalizeTags(tags: readonly string[]): string[] {
    return [...new Set(tags.map(tag => tag.trim()).filter(tag => tag.length > 0))];
  }

  private isUnused(sourceId: string, derivedParentSourceIds: ReadonlySet<string>): boolean {
    const source = this.#audioSourceRegistry.resolve(sourceId);
    return Boolean(
      source &&
        source.regionIds.length === 0 &&
        (source.loopSlotIds?.length ?? 0) === 0 &&
        !derivedParentSourceIds.has(sourceId)
    );
  }

  private async purgeRuntimeRegistrations(
    registrations: readonly Readonly<CommittedAudioSourceRegistration>[]
  ): Promise<void> {
    const purgedRegistrations: Readonly<CommittedAudioSourceRegistration>[] = [];
    try {
      registrations.forEach(registration => {
        this.#audioSourceRegistry.purgeUnused(registration.metadata.id);
        purgedRegistrations.push(registration);
      });
    } catch (cause) {
      const compensationFailures = this.restoreRuntimeRegistrations(purgedRegistrations);
      this.throwCompensationErrorIfNeeded({ cause, compensationFailures, failedPhase: 'runtime Source 정리' });
      throw cause;
    }
  }

  private async deleteStoredRegistrations(
    registrations: readonly Readonly<CommittedAudioSourceRegistration>[]
  ): Promise<void> {
    const deletedRegistrations: Readonly<CommittedAudioSourceRegistration>[] = [];
    try {
      for (const registration of registrations) {
        await this.#audioSourceRepository.delete(registration.metadata.id);
        deletedRegistrations.push(registration);
      }
    } catch (cause) {
      const compensationFailures = await this.restoreCleanupState({ deletedRegistrations, registrations });
      this.throwCompensationErrorIfNeeded({ cause, compensationFailures, failedPhase: '저장 Source 정리' });
      throw cause;
    }
  }

  private async restoreCleanupState({
    deletedRegistrations,
    registrations,
  }: {
    readonly deletedRegistrations: readonly Readonly<CommittedAudioSourceRegistration>[];
    readonly registrations: readonly Readonly<CommittedAudioSourceRegistration>[];
  }): Promise<ProjectMutationCompensationFailure[]> {
    const compensationFailures: ProjectMutationCompensationFailure[] = [];
    for (const registration of [...deletedRegistrations].reverse()) {
      try {
        await this.#audioSourceRepository.create(registration);
      } catch (cause) {
        compensationFailures.push({ cause, step: `저장 Source 복구: ${registration.metadata.id}` });
      }
    }
    compensationFailures.push(...this.restoreRuntimeRegistrations(registrations));
    return compensationFailures;
  }

  private restoreRuntimeRegistrations(
    registrations: readonly Readonly<CommittedAudioSourceRegistration>[]
  ): ProjectMutationCompensationFailure[] {
    const compensationFailures: ProjectMutationCompensationFailure[] = [];
    registrations.forEach(registration => {
      if (this.#audioSourceRegistry.resolve(registration.metadata.id)) {
        return;
      }
      try {
        this.#audioSourceRegistry.restoreCommitted(registration);
      } catch (cause) {
        compensationFailures.push({ cause, step: `runtime Source 복구: ${registration.metadata.id}` });
      }
    });
    return compensationFailures;
  }

  private throwCompensationErrorIfNeeded({
    cause,
    compensationFailures,
    failedPhase,
  }: {
    readonly cause: unknown;
    readonly compensationFailures: readonly ProjectMutationCompensationFailure[];
    readonly failedPhase: string;
  }): void {
    if (compensationFailures.length === 0) {
      return;
    }
    throw new ProjectMutationCompensationError({
      cause,
      compensationFailures,
      failedPhase,
      operation: 'cleanup-unused-sources',
    });
  }
}
