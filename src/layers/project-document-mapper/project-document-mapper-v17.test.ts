import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import { createDefaultProjectExportState } from '../shared/types/export-state';
import {
  createProjectDocumentV17FromSession,
  createProjectRestoreSnapshotFromDocumentV17,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createSession(): ProjectSessionState {
  const exportSettings = createDefaultProjectExportState();
  return {
    exportEndTime: 5,
    exportSettings: {
      ...exportSettings,
      presets: exportSettings.presets.map(preset => ({ ...preset, sampleFormat: 'pcm24', sampleRate: 48_000 })),
      ranges: [
        {
          endTimeSeconds: 5,
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Chorus',
          startTimeSeconds: 1,
        },
      ],
    },
    exportStartTime: 1,
    masterVolume: 1,
    project: { id: PROJECT_ID, name: 'Export', revision: 1 },
    tempo: 120,
    tracks: new Map(),
  };
}

describe('ProjectDocument v17 mapper', () => {
  it('Export preset과 range를 저장하고 복원한다', () => {
    const session = createSession();
    const document = createProjectDocumentV17FromSession({ audioSources: [], pluginCatalog: [], session });
    const restored = createProjectRestoreSnapshotFromDocumentV17({ document, pluginCatalog: [] });

    expect(document.schemaVersion).toBe(17);
    expect(document.exportSettings).toEqual(session.exportSettings);
    expect(restored.session.exportSettings).toEqual(session.exportSettings);
  });
});
