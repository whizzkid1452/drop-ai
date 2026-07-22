import { describe, expect, it, vi } from 'vitest';
import type { IAudioSourceStager } from '@/layers/audio-source-registry/i-audio-source-registry';
import type { AudioFileMetadata } from '@/utils/audio/convert-file-to-audio-file';
import { stageWebAudioSource } from './stage-web-audio-source';

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const OBJECT_URL = 'blob:https://example.com/source';

function createAudioFileMetadata(duration: number | undefined): AudioFileMetadata {
  const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });

  return {
    file,
    name: file.name,
    size: file.size,
    formattedSize: '5 Bytes',
    type: file.type,
    duration,
    formattedDuration: duration === undefined ? undefined : '0:03',
    volume: 1,
  };
}

describe('stageWebAudioSource', () => {
  it('파일과 메타데이터를 Source로 stage하고 호환 AudioFile을 만든다', () => {
    const audioFileMetadata = createAudioFileMetadata(3.5);
    const stage = vi.fn<IAudioSourceStager['stage']>().mockReturnValue({
      metadata: {
        id: SOURCE_ID,
        fileName: audioFileMetadata.name,
        mimeType: audioFileMetadata.type,
        byteLength: audioFileMetadata.size,
        durationSeconds: audioFileMetadata.duration ?? null,
      },
      objectUrl: OBJECT_URL,
      isCommitted: false,
      regionIds: [],
    });

    const result = stageWebAudioSource({
      audioSourceStager: { stage, discardPending: vi.fn() },
      audioFileMetadata,
      createSourceId: () => SOURCE_ID,
    });

    expect(stage).toHaveBeenCalledWith({
      blob: audioFileMetadata.file,
      metadata: {
        id: SOURCE_ID,
        fileName: 'voice.wav',
        mimeType: 'audio/wav',
        byteLength: 5,
        durationSeconds: 3.5,
      },
    });
    expect(result).toEqual({
      sourceId: SOURCE_ID,
      objectUrl: OBJECT_URL,
      audioFile: {
        ...audioFileMetadata,
        url: OBJECT_URL,
      },
    });
    expect(result.audioFile.url).toBe(result.objectUrl);
  });

  it('길이를 모르는 파일은 null duration을 가진 Source로 stage한다', () => {
    const audioFileMetadata = createAudioFileMetadata(undefined);
    const stage = vi.fn<IAudioSourceStager['stage']>().mockReturnValue({
      metadata: {
        id: SOURCE_ID,
        fileName: audioFileMetadata.name,
        mimeType: audioFileMetadata.type,
        byteLength: audioFileMetadata.size,
        durationSeconds: null,
      },
      objectUrl: OBJECT_URL,
      isCommitted: false,
      regionIds: [],
    });

    stageWebAudioSource({
      audioSourceStager: { stage, discardPending: vi.fn() },
      audioFileMetadata,
      createSourceId: () => SOURCE_ID,
    });

    expect(stage).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ durationSeconds: null }),
      })
    );
  });
});
