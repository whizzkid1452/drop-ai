import { describe, expect, it } from 'vitest';
import type { ProjectSessionState } from '../session/session';
import type { ProjectAudioSource, ProjectDocumentV2 } from '../shared/types/project-document.schema';
import {
  createProjectDocumentV3FromSession,
  createProjectRestoreSnapshotFromDocumentV3,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SLOT_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_ID = '44444444-4444-4444-8444-444444444444';

const audioSource: ProjectAudioSource = {
  byteLength: 4,
  durationSeconds: 2,
  fileName: 'loop.wav',
  id: SOURCE_ID,
  mimeType: 'audio/wav',
};

function createSession(): ProjectSessionState {
  return {
    exportEndTime: null,
    exportStartTime: null,
    masterVolume: 0.8,
    project: { id: PROJECT_ID, name: '라이브 세트', revision: 1 },
    tempo: 120,
    tracks: new Map([
      [
        TRACK_ID,
        {
          id: TRACK_ID,
          isMuted: false,
          isSoloed: false,
          loopSlots: [
            {
              errorMessage: '저장하지 않을 런타임 오류',
              gain: 0.75,
              id: SLOT_ID,
              lengthBars: 2,
              overdubSourceIds: [],
              quantizationBars: 1,
              recordedTempoBpm: 120,
              scheduledTimeSeconds: 4,
              sourceId: SOURCE_ID,
              state: 'playing',
            },
          ],
          name: '보컬 루프',
          pan: 0,
          pluginInstances: [],
          regions: [],
          status: [],
          volume: 1,
        },
      ],
    ]),
  };
}

describe('ProjectDocument v3 mapper', () => {
  it('루프 슬롯의 영구 상태만 v3 문서에 저장한다', () => {
    const document = createProjectDocumentV3FromSession({
      audioSources: [audioSource],
      pluginCatalog: [],
      session: createSession(),
    });

    expect(document.schemaVersion).toBe(3);
    expect(document.tracks[0]?.loopSlots).toEqual([
      {
        gain: 0.75,
        id: SLOT_ID,
        lengthBars: 2,
        quantizationBars: 1,
        recordedTempoBpm: 120,
        sourceId: SOURCE_ID,
      },
    ]);
  });

  it('v3 루프 슬롯을 정지 상태의 Session으로 복원한다', () => {
    const document = createProjectDocumentV3FromSession({
      audioSources: [audioSource],
      pluginCatalog: [],
      session: createSession(),
    });

    const snapshot = createProjectRestoreSnapshotFromDocumentV3({ document, pluginCatalog: [] });

    expect(snapshot.session.tracks.get(TRACK_ID)?.loopSlots).toEqual([
      {
        errorMessage: null,
        gain: 0.75,
        id: SLOT_ID,
        lengthBars: 2,
        overdubSourceIds: [],
        quantizationBars: 1,
        recordedTempoBpm: 120,
        scheduledTimeSeconds: null,
        sourceId: SOURCE_ID,
        state: 'stopped',
      },
    ]);
  });

  it('v2 Track에는 새 기본 루프 슬롯을 만든다', () => {
    const v3Document = createProjectDocumentV3FromSession({
      audioSources: [audioSource],
      pluginCatalog: [],
      session: createSession(),
    });
    const v2Tracks = v3Document.tracks.map(track => {
      const { loopSlots, ...trackV2 } = track;
      void loopSlots;
      return trackV2;
    });
    const v2Document: ProjectDocumentV2 = {
      ...v3Document,
      schemaVersion: 2,
      tracks: v2Tracks,
    };

    const snapshot = createProjectRestoreSnapshotFromDocumentV3({ document: v2Document, pluginCatalog: [] });

    expect(snapshot.session.tracks.get(TRACK_ID)?.loopSlots).toHaveLength(4);
    expect(snapshot.session.tracks.get(TRACK_ID)?.loopSlots?.every(slot => slot.state === 'empty')).toBe(true);
  });
});
