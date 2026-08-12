import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import {
  createProjectDocumentV5FromSession,
  createProjectRestoreSnapshotFromDocumentV5,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    masterVolume: 0.8,
    meterChanges: [
      { quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 },
      { quarterNotePosition: 8, beatsPerBar: 3, beatUnit: 4 },
    ],
    project: { id: PROJECT_ID, name: 'Tempo Map 프로젝트', revision: 1 },
    tempo: 120,
    tempoChanges: [
      { quarterNotePosition: 0, bpm: 120 },
      { quarterNotePosition: 4, bpm: 90 },
    ],
    tracks: new Map(),
  };
}

describe('ProjectDocument v5 mapper', () => {
  it('Tempo·Meter Map을 저장하고 같은 Session 상태로 복원한다', () => {
    const document = createProjectDocumentV5FromSession({
      audioSources: [],
      pluginCatalog: [],
      session: createSession(),
    });
    const restored = createProjectRestoreSnapshotFromDocumentV5({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(5);
    expect(restored.session.tempoChanges).toEqual(createSession().tempoChanges);
    expect(restored.session.meterChanges).toEqual(createSession().meterChanges);
  });
});
