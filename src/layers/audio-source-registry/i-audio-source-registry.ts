import type { ProjectAudioSource, ProjectAudioSourceV16 } from '../shared/types/project-document.schema';
import type { ResourceCleanupResult } from '../shared/types/resource-cleanup';

export type AudioSourceMetadata = ProjectAudioSource | ProjectAudioSourceV16;

export interface AudioSourceRegistration {
  readonly metadata: AudioSourceMetadata;
  readonly blob: Blob;
}

export interface CommittedAudioSourceRegistration {
  readonly metadata: ProjectAudioSourceV16;
  readonly blob: Blob;
}

export interface AudioSourceAttachment {
  readonly sourceId: string;
  readonly regionId: string;
}

export interface AudioSourceLoopSlotAttachment {
  readonly sourceId: string;
  readonly loopSlotId: string;
}

export interface RuntimeAudioSource {
  readonly metadata: Readonly<AudioSourceMetadata>;
  readonly objectUrl: string;
  readonly isCommitted: boolean;
  readonly regionIds: readonly string[];
  readonly loopSlotIds?: readonly string[];
}

export interface IAudioSourceStager {
  stage(registration: AudioSourceRegistration): RuntimeAudioSource;
  discardPending(sourceId: string): void;
}

export interface IAudioSourceResolver {
  resolve(sourceId: string): RuntimeAudioSource | null;
  listCommittedMetadata(): ReadonlyArray<Readonly<AudioSourceMetadata>>;
}

export interface ICommittedAudioSourceReader {
  listCommittedRegistrations(): ReadonlyArray<Readonly<CommittedAudioSourceRegistration>>;
}

export interface IRetiredAudioSourceRegistry {
  dispose(): ResourceCleanupResult;
}

export interface IPreparedAudioSourceRegistryReplacement extends IAudioSourceResolver {
  restoreCommitted(registration: AudioSourceRegistration): RuntimeAudioSource;
  attach(attachment: AudioSourceAttachment): void;
  attachLoopSlot(attachment: AudioSourceLoopSlotAttachment): void;
  assertActivatable(): void;
  activate(): IRetiredAudioSourceRegistry;
  discard(): ResourceCleanupResult;
}

export interface IAudioSourceRegistryReplacementCoordinator {
  beginReplacement(): IPreparedAudioSourceRegistryReplacement;
}

export interface IAudioSourceRegistry
  extends IAudioSourceStager,
    IAudioSourceResolver,
    ICommittedAudioSourceReader,
    IAudioSourceRegistryReplacementCoordinator {
  restoreCommitted(registration: AudioSourceRegistration): RuntimeAudioSource;
  attach(attachment: AudioSourceAttachment): void;
  attachLoopSlot(attachment: AudioSourceLoopSlotAttachment): void;
  detach(attachment: AudioSourceAttachment): void;
  detachLoopSlot(attachment: AudioSourceLoopSlotAttachment): void;
  purgeUnused(sourceId: string): void;
  updateMetadata(metadata: AudioSourceMetadata): RuntimeAudioSource;
  clear(): void;
}
