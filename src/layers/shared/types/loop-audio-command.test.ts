import { describe, expect, it } from 'vitest';
import { AudioCommandSchema, AudioCommandType } from './audioCommand.schema';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const SLOT_ID = '22222222-2222-4222-8222-222222222222';

describe('루프 AudioCommand 검증', () => {
  it('지원하는 마디 길이의 녹음 대기 명령을 허용한다', () => {
    expect(
      AudioCommandSchema.parse({
        lengthBars: 4,
        quantizationBars: 1,
        slotId: SLOT_ID,
        trackId: TRACK_ID,
        type: AudioCommandType.ARM_LOOP_SLOT,
      })
    ).toMatchObject({ lengthBars: 4, quantizationBars: 1 });
  });

  it('지원하지 않는 마디 길이는 거부한다', () => {
    expect(() =>
      AudioCommandSchema.parse({
        lengthBars: 3,
        quantizationBars: 1,
        slotId: SLOT_ID,
        trackId: TRACK_ID,
        type: AudioCommandType.ARM_LOOP_SLOT,
      })
    ).toThrow();
  });

  it('입력 장치 해제 명령에서 null을 허용한다', () => {
    expect(AudioCommandSchema.parse({ deviceId: null, type: AudioCommandType.SET_AUDIO_INPUT_DEVICE })).toMatchObject({
      deviceId: null,
    });
  });
});
