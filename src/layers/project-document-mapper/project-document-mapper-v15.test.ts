import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import type { PluginCatalogEntry } from '../shared/types/plugin-state';
import {
  createProjectDocumentV15FromSession,
  createProjectRestoreSnapshotFromDocumentV15,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const PLUGIN_INSTANCE_ID = '33333333-3333-4333-8333-333333333333';

const catalog: PluginCatalogEntry[] = [
  {
    category: 'utility',
    id: 'builtin.gain',
    name: 'Gain',
    parameters: [{ defaultValue: 1, id: 'gain', maxValue: 2, minValue: 0, name: 'Gain', type: 'number' }],
    presets: [{ id: 'unity', name: 'Unity', parameterValues: { gain: 1 } }],
    supportsSidechain: false,
    version: '1.0.0',
  },
];

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    masterVolume: 1,
    project: { id: PROJECT_ID, name: 'Plugin state', revision: 1 },
    tempo: 120,
    tracks: new Map([
      [
        TRACK_ID,
        {
          automationLanes: [],
          id: TRACK_ID,
          isMuted: false,
          isSoloed: false,
          loopSlots: [],
          midi: null,
          name: 'Audio',
          pan: 0,
          pluginInstances: [
            {
              availability: 'available',
              id: PLUGIN_INSTANCE_ID,
              isEnabled: true,
              manifestSummary: { id: 'builtin.gain', name: 'Gain', version: '1.0.0' },
              parameters: [{ id: 'gain', value: 1 }],
              presetId: 'unity',
              sidechainSourceTrackId: null,
              stateBlob: '{"quality":"high"}',
            },
          ],
          recording: { activePlaylistId: null, playlists: [], recordMode: 'layered' },
          regions: [],
          status: [],
          volume: 1,
        },
      ],
    ]),
  };
}

describe('ProjectDocument v15 mapper', () => {
  it('Plugin preset과 state blob을 저장하고 복원한다', () => {
    const document = createProjectDocumentV15FromSession({
      audioSources: [],
      pluginCatalog: catalog,
      session: createSession(),
    });
    const restored = createProjectRestoreSnapshotFromDocumentV15({ document, pluginCatalog: catalog });

    expect(document.schemaVersion).toBe(15);
    expect(document.tracks[0]?.pluginInstances[0]).toMatchObject({
      presetId: 'unity',
      stateBlob: '{"quality":"high"}',
    });
    expect(restored.session.tracks.get(TRACK_ID)?.pluginInstances[0]).toMatchObject({
      availability: 'available',
      presetId: 'unity',
      stateBlob: '{"quality":"high"}',
    });
  });

  it('누락된 Plugin을 비활성 placeholder로 복원하고 다시 저장한다', () => {
    const document = createProjectDocumentV15FromSession({
      audioSources: [],
      pluginCatalog: catalog,
      session: createSession(),
    });
    const restored = createProjectRestoreSnapshotFromDocumentV15({ document, pluginCatalog: [] });
    const instance = restored.session.tracks.get(TRACK_ID)?.pluginInstances[0];

    expect(instance).toMatchObject({ availability: 'missing', isEnabled: false });
    expect(() =>
      createProjectDocumentV15FromSession({ audioSources: [], pluginCatalog: [], session: restored.session })
    ).not.toThrow();
  });
});
