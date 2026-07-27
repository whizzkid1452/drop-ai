import { describe, expect, it } from 'vitest';
import { createDefaultLoopSlots, type TrackState } from '../../../session/session';
import { AudioCommandType } from '../../../shared/types/audioCommand.schema';
import { createMidiLoopCommand } from './create-midi-loop-command';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';

function createTrack(): TrackState {
  const loopSlots = createDefaultLoopSlots({
    count: 4,
    createId: () => crypto.randomUUID(),
  });
  loopSlots[0] = { ...loopSlots[0], lengthBars: 2, quantizationBars: 1, state: 'empty' };
  loopSlots[1] = { ...loopSlots[1], state: 'recording' };
  loopSlots[2] = { ...loopSlots[2], sourceId: crypto.randomUUID(), state: 'playing' };
  loopSlots[3] = { ...loopSlots[3], sourceId: crypto.randomUUID(), state: 'stopped' };
  return {
    id: TRACK_ID,
    isMuted: false,
    isSoloed: false,
    loopSlots,
    name: 'MIDI 대상 트랙',
    pan: 0,
    pluginInstances: [],
    regions: [],
    status: [],
    volume: 1,
  };
}

describe('createMidiLoopCommand', () => {
  it('노트 36을 첫 번째 빈 슬롯의 녹음 대기 명령으로 변환한다', () => {
    const track = createTrack();

    expect(createMidiLoopCommand({ note: 36, track })).toEqual({
      lengthBars: 2,
      quantizationBars: 1,
      slotId: track.loopSlots?.[0].id,
      trackId: TRACK_ID,
      type: AudioCommandType.ARM_LOOP_SLOT,
    });
  });

  it.each([
    [37, AudioCommandType.CANCEL_LOOP_SLOT],
    [38, AudioCommandType.STOP_LOOP_SLOT],
    [39, AudioCommandType.TRIGGER_LOOP_SLOT],
  ] as const)('노트 %i를 슬롯 상태에 맞는 %s 명령으로 변환한다', (note, type) => {
    const track = createTrack();

    expect(createMidiLoopCommand({ note, track })).toMatchObject({
      slotId: track.loopSlots?.[note - 36].id,
      trackId: TRACK_ID,
      type,
    });
  });

  it('노트 40을 전체 루프 정지 명령으로 변환한다', () => {
    expect(createMidiLoopCommand({ note: 40, track: createTrack() })).toEqual({
      type: AudioCommandType.STOP_ALL_LOOPS,
    });
  });

  it.each([0, 35, 41, 127])('매핑 범위 밖의 노트 %i를 무시한다', note => {
    expect(createMidiLoopCommand({ note, track: createTrack() })).toBeNull();
  });
});
