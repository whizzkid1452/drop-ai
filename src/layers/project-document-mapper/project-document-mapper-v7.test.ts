import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import {
  createProjectDocumentV7FromSession,
  createProjectRestoreSnapshotFromDocumentV7,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    isLoopEnabled: true,
    isMetronomeEnabled: true,
    loopRange: { endTimeSeconds: 6, startTimeSeconds: 2 },
    masterVolume: 0.8,
    meterChanges: [{ beatUnit: 4, beatsPerBar: 4, quarterNotePosition: 0 }],
    metronomeVolume: 0.6,
    project: { id: PROJECT_ID, name: 'Transport 프로젝트', revision: 1 },
    tempo: 120,
    tempoChanges: [{ bpm: 120, quarterNotePosition: 0 }],
    timelineMarkers: [],
    tracks: new Map(),
  };
}

describe('ProjectDocument v7 mapper', () => {
  it('Loop와 Metronome 설정을 저장하고 같은 Session 상태로 복원한다', () => {
    const session = createSession();
    const document = createProjectDocumentV7FromSession({ audioSources: [], pluginCatalog: [], session });
    const restored = createProjectRestoreSnapshotFromDocumentV7({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(7);
    expect(restored.session).toMatchObject({
      isLoopEnabled: session.isLoopEnabled,
      isMetronomeEnabled: session.isMetronomeEnabled,
      loopRange: session.loopRange,
      metronomeVolume: session.metronomeVolume,
    });
  });
});
