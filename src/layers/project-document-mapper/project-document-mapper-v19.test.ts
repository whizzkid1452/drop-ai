import { describe, expect, it } from 'vitest';
import { createDefaultLoopSlots, type ProjectSessionState, type TrackState } from '../session/session';
import { createDefaultProjectExportState } from '../shared/types/export-state';
import { createDefaultTrackRecordingState } from '../shared/types/multitrack-recording';
import { createDefaultProjectLifecycleState } from '../shared/types/session-lifecycle';
import {
  createProjectDocumentV19FromSession,
  createProjectRestoreSnapshotFromDocumentV19,
} from './project-document-mapper';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SLOT_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_ID = '66666666-6666-4666-8666-666666666666';

function createSession(): ProjectSessionState {
  const [defaultSlot] = createDefaultLoopSlots({ count: 1, createId: () => SLOT_ID });
  const track: TrackState = {
    id: TRACK_ID,
    isMuted: false,
    isSoloed: false,
    loopSlots: [
      {
        ...defaultSlot,
        followAction: { afterBars: 2, type: 'stop' },
        gain: 0.75,
        launchMode: 'toggle',
        name: 'Verse',
        recordedTempoBpm: 120,
        sourceEndTimeSeconds: 3,
        sourceId: SOURCE_ID,
        sourceStartTimeSeconds: 1,
      },
    ],
    name: 'Audio 1',
    pan: 0,
    pluginInstances: [],
    recording: createDefaultTrackRecordingState(),
    regions: [],
    status: [],
    volume: 1,
  };
  return {
    cue: {
      performances: [
        {
          createdAt: '2026-08-14T00:00:00.000Z',
          events: [
            {
              durationQuarterNotes: 4,
              id: '44444444-4444-4444-8444-444444444444',
              slotId: SLOT_ID,
              startQuarterNotes: 0,
              trackId: TRACK_ID,
            },
          ],
          id: '55555555-5555-4555-8555-555555555555',
          name: 'Take 1',
        },
      ],
    },
    exportEndTime: null,
    exportSettings: createDefaultProjectExportState(),
    exportStartTime: null,
    lifecycle: createDefaultProjectLifecycleState(),
    masterVolume: 1,
    project: { id: PROJECT_ID, name: 'Cue', revision: 1 },
    tempo: 120,
    tracks: new Map([[TRACK_ID, track]]),
  };
}

describe('ProjectDocument v19 mapper', () => {
  it('Clip 설정과 Cue 연주를 저장하고 복원한다', () => {
    const document = createProjectDocumentV19FromSession({
      audioSources: [
        {
          byteLength: 16,
          durationSeconds: 4,
          fileName: 'clip.wav',
          id: SOURCE_ID,
          mimeType: 'audio/wav',
        },
      ],
      pluginCatalog: [],
      session: createSession(),
    });
    const restored = createProjectRestoreSnapshotFromDocumentV19({ document, pluginCatalog: [] });

    expect(document.tracks[0]?.loopSlots[0]).toMatchObject({
      followAction: { afterBars: 2, type: 'stop' },
      gain: 0.75,
      launchMode: 'toggle',
      name: 'Verse',
      sourceEndTimeSeconds: 3,
      sourceStartTimeSeconds: 1,
    });
    expect(restored.session.cue).toEqual(document.cue);
    expect(restored.session.tracks.get(TRACK_ID)?.loopSlots?.[0]).toMatchObject(document.tracks[0]?.loopSlots[0]);
  });
});
