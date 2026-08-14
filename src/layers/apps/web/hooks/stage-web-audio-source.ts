import type { IAudioSourceStager } from '@/layers/audio-source-registry/i-audio-source-registry';
import type { AudioFile } from '@/types/audioFile';
import type { ProjectAudioSourceV16 } from '@/types/project-document.schema';
import type { AudioFileMetadata } from '@/utils/audio/convert-file-to-audio-file';

export interface StagedWebAudioSource {
  sourceId: string;
  audioFile: AudioFile;
}

interface StageWebAudioSourceOptions {
  audioSourceStager: IAudioSourceStager;
  audioFileMetadata: AudioFileMetadata;
  createSourceId?: () => string;
}

function createProjectAudioSource(sourceId: string, audioFileMetadata: AudioFileMetadata): ProjectAudioSourceV16 {
  return {
    bwfMetadata: audioFileMetadata.bwfMetadata ?? null,
    id: sourceId,
    fileName: audioFileMetadata.name,
    mimeType: audioFileMetadata.type,
    byteLength: audioFileMetadata.size,
    durationSeconds: audioFileMetadata.duration ?? null,
    derivation: null,
    tags: [],
    transientPositionsSeconds: [],
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
    audioFile: { ...audioFileMetadata },
  };
}
