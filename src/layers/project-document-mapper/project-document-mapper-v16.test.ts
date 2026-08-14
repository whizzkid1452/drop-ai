import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import type { ProjectAudioSourceV16 } from '../shared/types/project-document.schema';
import {
  createProjectDocumentV16FromSession,
  createProjectRestoreSnapshotFromDocumentV16,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';

const source: ProjectAudioSourceV16 = {
  bwfMetadata: null,
  byteLength: 44,
  derivation: null,
  durationSeconds: 1,
  fileName: 'source.wav',
  id: SOURCE_ID,
  mimeType: 'audio/wav',
  tags: ['field-recording'],
  transientPositionsSeconds: [0.25],
};

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    masterVolume: 1,
    project: { id: PROJECT_ID, name: 'Media', revision: 1 },
    tempo: 120,
    tracks: new Map(),
  };
}

describe('ProjectDocument v16 mapper', () => {
  it('Source 관리 metadata를 저장하고 복원한다', () => {
    const document = createProjectDocumentV16FromSession({
      audioSources: [source],
      pluginCatalog: [],
      session: createSession(),
    });
    const restored = createProjectRestoreSnapshotFromDocumentV16({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(16);
    expect(restored.audioSources).toEqual([source]);
  });
});
