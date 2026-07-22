import { describe, expect, it } from 'vitest';
import type { StagedWebAudioSource } from '@/layers/apps/web/hooks/stage-web-audio-source';
import { AudioCommandBatchSchema, AudioCommandType } from '@/types/audioCommand.schema';
import { createAudioImportCommands } from './audio-import-commands';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_ID = '33333333-3333-4333-8333-333333333333';
const OBJECT_URL = 'blob:https://example.com/audio';

function createStagedSource({ duration }: { duration?: number } = { duration: 12.5 }): StagedWebAudioSource {
  const file = new File(['audio'], 'sample.wav', { type: 'audio/wav' });

  return {
    sourceId: SOURCE_ID,
    objectUrl: OBJECT_URL,
    audioFile: {
      file,
      name: file.name,
      size: file.size,
      formattedSize: '5 Bytes',
      type: file.type,
      duration,
      formattedDuration: duration === undefined ? undefined : '0:12',
      url: OBJECT_URL,
      volume: 1,
    },
  };
}

describe('오디오 파일 가져오기 명령', () => {
  it('빈 Track과 sourceId 기반 Region 명령을 만든다', () => {
    const commands = createAudioImportCommands({
      trackId: TRACK_ID,
      regionId: REGION_ID,
      stagedSource: createStagedSource(),
    });

    expect(commands).toEqual([
      {
        type: AudioCommandType.ADD_TRACK,
        trackId: TRACK_ID,
      },
      {
        type: AudioCommandType.LOAD_REGION,
        trackId: TRACK_ID,
        regionId: REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        startOffset: 0,
        duration: 12.5,
      },
    ]);
    expect(commands[1]).not.toHaveProperty('url');
  });

  it('재생 시간을 확인하지 못한 파일은 0초 Region 명령으로 만든다', () => {
    const commands = createAudioImportCommands({
      trackId: TRACK_ID,
      regionId: REGION_ID,
      stagedSource: createStagedSource({ duration: undefined }),
    });

    expect(commands[1]).toMatchObject({ duration: 0 });
    expect(() => AudioCommandBatchSchema.parse(commands)).not.toThrow();
  });
});
