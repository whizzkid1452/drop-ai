import type { IAudioSourceStager } from '@/layers/audio-source-registry/i-audio-source-registry';
import type { AudioFile } from '@/types/audioFile';
import type { ProjectAudioSource } from '@/types/project-document.schema';
import type { AudioFileMetadata } from '@/utils/audio/convert-file-to-audio-file';

export interface StagedWebAudioSource {
  sourceId: string;
  objectUrl: string;
  audioFile: AudioFile;
}

interface StageWebAudioSourceOptions {
  audioSourceStager: IAudioSourceStager;
  audioFileMetadata: AudioFileMetadata;
  createSourceId?: () => string;
}

function createProjectAudioSource(sourceId: string, audioFileMetadata: AudioFileMetadata): ProjectAudioSource {
  return {
    id: sourceId,
    fileName: audioFileMetadata.name,
    mimeType: audioFileMetadata.type,
    byteLength: audioFileMetadata.size,
    durationSeconds: audioFileMetadata.duration ?? null,
  };
}

export function stageWebAudioSource({
  audioSourceStager,
  audioFileMetadata,
  createSourceId = () => globalThis.crypto.randomUUID(),
}: StageWebAudioSourceOptions): StagedWebAudioSource {
  const sourceId = createSourceId();
  const stagedSource = audioSourceStager.stage({
    blob: audioFileMetadata.file,
    metadata: createProjectAudioSource(sourceId, audioFileMetadata),
  });

  return {
    sourceId: stagedSource.metadata.id,
    objectUrl: stagedSource.objectUrl,
    audioFile: {
      ...audioFileMetadata,
      url: stagedSource.objectUrl,
    },
  };
}
