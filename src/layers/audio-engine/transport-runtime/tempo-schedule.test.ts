import { describe, expect, it } from 'vitest';
import { createTempoSchedule } from './tempo-schedule';

describe('createTempoSchedule', () => {
  it('각 Tempo 변경의 quarter note 위치를 앞선 BPM 기준의 초로 변환한다', () => {
    expect(
      createTempoSchedule([
        { bpm: 120, quarterNotePosition: 0 },
        { bpm: 60, quarterNotePosition: 4 },
        { bpm: 180, quarterNotePosition: 6 },
      ])
    ).toEqual([
      { atTimeSeconds: 0, bpm: 120 },
      { atTimeSeconds: 2, bpm: 60 },
      { atTimeSeconds: 4, bpm: 180 },
    ]);
  });

  it('0에서 시작하지 않거나 순서가 뒤집힌 Tempo Map을 거부한다', () => {
    expect(() => createTempoSchedule([{ bpm: 120, quarterNotePosition: 1 }])).toThrowError();
    expect(() =>
      createTempoSchedule([
        { bpm: 120, quarterNotePosition: 0 },
        { bpm: 100, quarterNotePosition: 0 },
      ])
    ).toThrowError();
  });
});
