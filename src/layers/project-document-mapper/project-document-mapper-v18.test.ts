import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import { createDefaultProjectExportState } from '../shared/types/export-state';
import { createDefaultProjectLifecycleState } from '../shared/types/session-lifecycle';
import {
  createProjectDocumentV17FromSession,
  createProjectDocumentV18FromSession,
  createProjectRestoreSnapshotFromDocumentV18,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SNAPSHOT_ID = '22222222-2222-4222-8222-222222222222';

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportSettings: createDefaultProjectExportState(),
    exportStartTime: null,
    lifecycle: createDefaultProjectLifecycleState(),
    masterVolume: 1,
    project: { id: PROJECT_ID, name: 'Lifecycle', revision: 2 },
    tempo: 120,
    tracks: new Map(),
  };
}

describe('ProjectDocument v18 mapper', () => {
  it('Named Snapshot과 Template을 복제해 저장하고 복원한다', () => {
    const session = createSession();
    const snapshotDocument = createProjectDocumentV17FromSession({ audioSources: [], pluginCatalog: [], session });
    const lifecycle = {
      snapshots: [
        {
          createdAt: '2026-08-14T00:00:00.000Z',
          document: snapshotDocument,
          id: SNAPSHOT_ID,
          name: 'Before mix',
        },
      ],
      templates: [
        {
          createdAt: '2026-08-14T00:00:00.000Z',
          document: snapshotDocument,
          id: '33333333-3333-4333-8333-333333333333',
          kind: 'session' as const,
          name: 'Empty session',
        },
      ],
    };
    const document = createProjectDocumentV18FromSession({
      audioSources: [],
      pluginCatalog: [],
      session: { ...session, lifecycle },
    });
    const restored = createProjectRestoreSnapshotFromDocumentV18({ document, pluginCatalog: [] });

    expect(document.lifecycle).toEqual(lifecycle);
    expect(document.lifecycle).not.toBe(lifecycle);
    expect(restored.session.lifecycle).toEqual(lifecycle);
  });
});
