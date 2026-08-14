import { describe, expect, it } from 'vitest';
import type { LoopSlotState } from '../../../session/session';
import { AudioCommandType } from '../../../shared/types/audioCommand.schema';
import { createLoopOverdubAction, createLoopSlotAction, getLoopLayerCount } from './loop-slot-action';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const SLOT_ID = '22222222-2222-4222-8222-222222222222';

function createLoopSlot(state: LoopSlotState['state']): LoopSlotState {
  return {
    errorMessage: null,
    followAction: { afterBars: 1, type: 'none' },
    gain: 1,
    id: SLOT_ID,
    launchMode: 'trigger',
    lengthBars: 1,
    name: 'Clip 1',
    overdubSourceIds: [],
    quantizationBars: 1,
    recordedTempoBpm: state === 'empty' ? null : 120,
    scheduledTimeSeconds: null,
    sourceId: state === 'empty' ? null : '33333333-3333-4333-8333-333333333333',
    sourceEndTimeSeconds: null,
    sourceStartTimeSeconds: 0,
    state,
  };
}

describe('Loop Slot UI 명령', () => {
  it('빈 슬롯은 선택한 마디 길이로 녹음 대기한다', () => {
    expect(
      createLoopSlotAction({ lengthBars: 4, loopSlot: createLoopSlot('empty'), quantizationBars: 2, trackId: TRACK_ID })
    ).toEqual({
      lengthBars: 4,
      quantizationBars: 2,
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      type: AudioCommandType.ARM_LOOP_SLOT,
    });
  });

  it.each([
    ['armed', AudioCommandType.CANCEL_LOOP_SLOT],
    ['recording', AudioCommandType.CANCEL_LOOP_SLOT],
    ['playing', AudioCommandType.STOP_LOOP_SLOT],
    ['stopped', AudioCommandType.TRIGGER_LOOP_SLOT],
    ['error', AudioCommandType.CLEAR_LOOP_SLOT],
  ] as const)('%s 슬롯을 상태에 맞는 명령으로 바꾼다', (state, type) => {
    expect(
      createLoopSlotAction({ lengthBars: 1, loopSlot: createLoopSlot(state), quantizationBars: 1, trackId: TRACK_ID })
    ).toEqual({ slotId: SLOT_ID, trackId: TRACK_ID, type });
  });

  it('오버더빙을 별도 명령으로 만들고 전체 레이어 수를 계산한다', () => {
    const loopSlot = { ...createLoopSlot('playing'), overdubSourceIds: ['overdub-1', 'overdub-2'] };

    expect(createLoopOverdubAction({ loopSlotId: SLOT_ID, trackId: TRACK_ID })).toEqual({
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      type: AudioCommandType.ARM_LOOP_OVERDUB,
    });
    expect(getLoopLayerCount(loopSlot)).toBe(3);
  });
});
