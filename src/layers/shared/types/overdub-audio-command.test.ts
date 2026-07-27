import { describe, expect, it } from 'vitest';
import { AudioCommandSchema, AudioCommandType } from './audioCommand.schema';

describe('오버더빙 AudioCommand', () => {
  it('기존 트랙과 루프 슬롯 주소를 검증한다', () => {
    expect(
      AudioCommandSchema.parse({
        slotId: '11111111-1111-4111-8111-111111111111',
        trackId: '22222222-2222-4222-8222-222222222222',
        type: AudioCommandType.ARM_LOOP_OVERDUB,
      })
    ).toEqual({
      slotId: '11111111-1111-4111-8111-111111111111',
      trackId: '22222222-2222-4222-8222-222222222222',
      type: 'ARM_LOOP_OVERDUB',
    });
  });
});
