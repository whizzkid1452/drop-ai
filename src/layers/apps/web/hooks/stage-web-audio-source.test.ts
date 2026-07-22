import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { IAudioSourceStager } from '@/layers/audio-source-registry/i-audio-source-registry';
import type { AudioFile } from '@/types/audioFile';
import type { AudioFileMetadata } from '@/utils/audio/convert-file-to-audio-file';
import { stageWebAudioSource, type StagedWebAudioSource } from './stage-web-audio-source';

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
  it('공개 파일 정보 타입에 재생 URL과 정리 함수를 포함하지 않는다', () => {
    expectTypeOf<AudioFile>().not.toHaveProperty('url');
    expectTypeOf<AudioFile>().not.toHaveProperty('dispose');
    expectTypeOf<StagedWebAudioSource>().not.toHaveProperty('objectUrl');
  });

  it('파일을 Source로 stage하고 URL 없는 파일 정보를 반환한다', () => {
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
      audioFile: audioFileMetadata,
    });
    expect(result).not.toHaveProperty('objectUrl');
    expect(result.audioFile).not.toHaveProperty('url');
    expect(result.audioFile).not.toBe(audioFileMetadata);
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
