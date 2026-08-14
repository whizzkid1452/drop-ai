import type { ProjectAudioSource, ProjectAudioSourceV16 } from '../shared/types/project-document.schema';

export type AudioSourceMetadata = ProjectAudioSource | ProjectAudioSourceV16;

export interface CreateAudioSourceRequest {
  readonly metadata: AudioSourceMetadata;
  readonly blob: Blob;
}

export interface IAudioSourceRepository {
  create(request: CreateAudioSourceRequest): Promise<void>;
  load(metadata: AudioSourceMetadata): Promise<Blob | null>;
  delete(sourceId: string): Promise<void>;
}
