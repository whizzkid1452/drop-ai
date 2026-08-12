import { describe, expect, it } from 'vitest';
import { createSessionStore } from './session';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const MARKER_ID = '22222222-2222-4222-8222-222222222222';

describe('Session Timeline marker', () => {
  it('marker 배열을 복제해 저장한다', () => {
    const session = createSessionStore({
      initialProjectMetadata: { id: PROJECT_ID, name: 'Marker 프로젝트', revision: 0 },
    });
    const markers = [{ id: MARKER_ID, name: 'Verse', quarterNotePosition: 8 }];

    session.getState().setTimelineMarkers(markers);
    markers[0].name = '변경된 외부 값';

    expect(session.getState().timelineMarkers).toEqual([{ id: MARKER_ID, name: 'Verse', quarterNotePosition: 8 }]);
  });
});
