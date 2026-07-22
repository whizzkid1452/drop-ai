import type { ProjectAudioSource } from '../shared/types/project-document.schema';

export interface AudioSourceRegistration {
  readonly metadata: ProjectAudioSource;
  readonly blob: Blob;
}

export interface AudioSourceAttachment {
  readonly sourceId: string;
  readonly regionId: string;
}

export interface RuntimeAudioSource {
  readonly metadata: Readonly<ProjectAudioSource>;
  readonly objectUrl: string;
  readonly isCommitted: boolean;
  readonly regionIds: readonly string[];
}

export interface IAudioSourceStager {
  stage(registration: AudioSourceRegistration): RuntimeAudioSource;
  discardPending(sourceId: string): void;
}

export interface IAudioSourceResolver {
  resolve(sourceId: string): RuntimeAudioSource | null;
  listCommittedMetadata(): ReadonlyArray<Readonly<ProjectAudioSource>>;
}

export interface ICommittedAudioSourceReader {
  listCommittedRegistrations(): ReadonlyArray<Readonly<AudioSourceRegistration>>;
}

export interface IAudioSourceRegistry extends IAudioSourceStager, IAudioSourceResolver, ICommittedAudioSourceReader {
  restoreCommitted(registration: AudioSourceRegistration): RuntimeAudioSource;
  attach(attachment: AudioSourceAttachment): void;
  detach(attachment: AudioSourceAttachment): void;
  purgeUnused(sourceId: string): void;
  clear(): void;
}
