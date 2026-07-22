import type { ProjectAudioSource } from '../shared/types/project-document.schema';

export interface CreateAudioSourceRequest {
  readonly metadata: ProjectAudioSource;
  readonly blob: Blob;
}

export interface IAudioSourceRepository {
  create(request: CreateAudioSourceRequest): Promise<void>;
  load(metadata: ProjectAudioSource): Promise<Blob | null>;
  delete(sourceId: string): Promise<void>;
}
