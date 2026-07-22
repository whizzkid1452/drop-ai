import { describe, expect, it } from 'vitest';
import { AudioCommandBatchSchema, AudioCommandType } from '@/types/audioCommand.schema';
import { createAudioImportCommands } from './audio-import-commands';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const AUDIO_URL = 'blob:https://example.com/audio';

describe('오디오 파일 가져오기 명령', () => {
  it('같은 Track ID로 트랙 추가와 Region 로드 명령을 순서대로 만든다', () => {
    const commands = createAudioImportCommands({
      trackId: TRACK_ID,
      regionId: REGION_ID,
      url: AUDIO_URL,
      duration: 12.5,
    });

    expect(commands).toEqual([
      {
        type: AudioCommandType.ADD_TRACK,
        trackId: TRACK_ID,
        url: AUDIO_URL,
      },
      {
        type: AudioCommandType.LOAD_REGION,
        trackId: TRACK_ID,
        regionId: REGION_ID,
        url: AUDIO_URL,
        startTime: 0,
        startOffset: 0,
        duration: 12.5,
      },
    ]);
  });

  it('생성한 명령 묶음이 공통 Schema를 통과한다', () => {
    const commands = createAudioImportCommands({
      trackId: TRACK_ID,
      regionId: REGION_ID,
      url: AUDIO_URL,
      duration: 0,
    });

    expect(() => AudioCommandBatchSchema.parse(commands)).not.toThrow();
  });
});
