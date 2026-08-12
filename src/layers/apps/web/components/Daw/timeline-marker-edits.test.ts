import { describe, expect, it } from 'vitest';
import {
  addTimelineMarker,
  moveTimelineMarker,
  removeTimelineMarker,
  renameTimelineMarker,
} from './timeline-marker-edits';

const FIRST_MARKER = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Verse',
  quarterNotePosition: 8,
};
const SECOND_MARKER = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Chorus',
  quarterNotePosition: 16,
};

describe('Timeline marker edits', () => {
  it('marker를 음악 위치 순서로 추가한다', () => {
    expect(addTimelineMarker([SECOND_MARKER], FIRST_MARKER)).toEqual([FIRST_MARKER, SECOND_MARKER]);
  });

  it('ID로 marker 위치와 이름을 바꾸고 삭제한다', () => {
    const moved = moveTimelineMarker([FIRST_MARKER, SECOND_MARKER], SECOND_MARKER.id, 4);
    const renamed = renameTimelineMarker(moved, SECOND_MARKER.id, 'Intro');

    expect(renamed[0]).toEqual({ ...SECOND_MARKER, name: 'Intro', quarterNotePosition: 4 });
    expect(removeTimelineMarker(renamed, SECOND_MARKER.id)).toEqual([FIRST_MARKER]);
  });
});
