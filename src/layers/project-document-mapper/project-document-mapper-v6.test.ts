import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import {
  createProjectDocumentV6FromSession,
  createProjectRestoreSnapshotFromDocumentV6,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const MARKER_ID = '22222222-2222-4222-8222-222222222222';

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    masterVolume: 0.8,
    meterChanges: [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }],
    project: { id: PROJECT_ID, name: 'Marker 프로젝트', revision: 1 },
    tempo: 120,
    tempoChanges: [{ quarterNotePosition: 0, bpm: 120 }],
    timelineMarkers: [{ id: MARKER_ID, name: 'Verse', quarterNotePosition: 8 }],
    tracks: new Map(),
  };
}

describe('ProjectDocument v6 mapper', () => {
  it('Timeline marker를 저장하고 같은 Session 상태로 복원한다', () => {
    const document = createProjectDocumentV6FromSession({
      audioSources: [],
      pluginCatalog: [],
      session: createSession(),
    });
    const restored = createProjectRestoreSnapshotFromDocumentV6({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(6);
    expect(restored.session.timelineMarkers).toEqual(createSession().timelineMarkers);
  });
});
