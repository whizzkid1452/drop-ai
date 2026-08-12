import { describe, expect, it } from 'vitest';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import {
  moveMeterChange,
  moveTempoChange,
  removeMeterChange,
  removeTempoChange,
  snapQuarterNotesToBar,
  upsertMeterChange,
  upsertTempoChange,
} from './timeline-map-edits';

describe('Timeline Map 편집', () => {
  it('Tempo marker를 음악 위치 순서로 추가하고 값을 수정한다', () => {
    const changes = [{ quarterNotePosition: 0, bpm: 120 }];

    expect(upsertTempoChange(changes, { quarterNotePosition: 8, bpm: 90 })).toEqual([
      { quarterNotePosition: 0, bpm: 120 },
      { quarterNotePosition: 8, bpm: 90 },
    ]);
    expect(upsertTempoChange(changes, { quarterNotePosition: 0, bpm: 128 })).toEqual([
      { quarterNotePosition: 0, bpm: 128 },
    ]);
  });

  it('Tempo marker를 이동하고 첫 marker 삭제를 거부한다', () => {
    const changes = [
      { quarterNotePosition: 0, bpm: 120 },
      { quarterNotePosition: 8, bpm: 90 },
    ];

    expect(moveTempoChange(changes, 8, 4)).toEqual([
      { quarterNotePosition: 0, bpm: 120 },
      { quarterNotePosition: 4, bpm: 90 },
    ]);
    expect(() => removeTempoChange(changes, 0)).toThrow('첫 Tempo marker');
  });

  it('Meter marker도 추가·이동·삭제한다', () => {
    const changes = [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }];
    const added = upsertMeterChange(changes, { quarterNotePosition: 8, beatsPerBar: 6, beatUnit: 8 });

    expect(moveMeterChange(added, 8, 12)[1]?.quarterNotePosition).toBe(12);
    expect(removeMeterChange(added, 8)).toEqual(changes);
  });

  it('Meter 이동 위치를 현재 박자표의 마디 시작점에 맞춘다', () => {
    const coordinateMapper = new TimelineCoordinateMapper({
      tempoBpm: 120,
      beatsPerBar: 4,
      beatUnit: 4,
      meterChanges: [
        { quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 },
        { quarterNotePosition: 8, beatsPerBar: 6, beatUnit: 8 },
      ],
    });

    expect(snapQuarterNotesToBar(coordinateMapper, 10.7)).toBe(8);
    expect(snapQuarterNotesToBar(coordinateMapper, 11.2)).toBe(11);
  });
});
