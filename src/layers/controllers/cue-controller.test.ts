import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IObjectUrlAdapter } from '../audio-source-registry/i-object-url-adapter';
import { createDefaultLoopSlots, createSessionStore } from '../session/session';
import { createDefaultTrackRecordingState } from '../shared/types/multitrack-recording';
import { EditorController } from './editor-controller';
import { LoopController } from './loop-controller';
import { RegionController } from './region-controller';
import { CueController } from './cue-controller';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SLOT_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_ID = '44444444-4444-4444-8444-444444444444';
const PERFORMANCE_ID = '55555555-5555-4555-8555-555555555555';
const EVENT_ID = '66666666-6666-4666-8666-666666666666';
const REGION_ID = '77777777-7777-4777-8777-777777777777';

class ObjectUrlAdapterStub implements IObjectUrlAdapter {
  createObjectUrl(): string {
    return 'blob:clip';
  }
  revokeObjectUrl(): void {}
}

describe('CueController', () => {
  let session = createSessionStore({ initialProjectMetadata: { id: PROJECT_ID, name: 'Cue', revision: 0 } });
  let audioEngine = new MockAudioEngine();
  let registry = new AudioSourceRegistry(new ObjectUrlAdapterStub());
  let controller: CueController;

  beforeEach(async () => {
    session = createSessionStore({ initialProjectMetadata: { id: PROJECT_ID, name: 'Cue', revision: 0 } });
    audioEngine = new MockAudioEngine();
    registry = new AudioSourceRegistry(new ObjectUrlAdapterStub());
    registry.restoreCommitted({
      blob: new Blob(['clip'], { type: 'audio/wav' }),
      metadata: { byteLength: 4, durationSeconds: 2, fileName: 'clip.wav', id: SOURCE_ID, mimeType: 'audio/wav' },
    });
    const [slot] = createDefaultLoopSlots({ count: 1, createId: () => SLOT_ID });
    session.getState().addTrack({
      id: TRACK_ID,
      isMuted: false,
      isSoloed: false,
      loopSlots: [{ ...slot, recordedTempoBpm: 120, sourceId: SOURCE_ID, state: 'stopped' }],
      name: 'Audio 1',
      pan: 0,
      pluginInstances: [],
      recording: createDefaultTrackRecordingState(),
      regions: [],
      status: [],
      volume: 1,
    });
    registry.attachLoopSlot({ loopSlotId: SLOT_ID, sourceId: SOURCE_ID });
    await audioEngine.addTrack(TRACK_ID);
    await audioEngine.loadLoop({ trackId: TRACK_ID, slotId: SLOT_ID, url: 'blob:clip' });
    const loopController = new LoopController({ audioEngine, audioSourceRegistry: registry, sessionStore: session });
    const regionController = new RegionController({
      audioEngine,
      audioSourceRegistry: registry,
      sessionStore: session,
    });
    const editorController = new EditorController({ regionRuntime: regionController, sessionStore: session });
    controller = new CueController({
      audioSourceRegistry: registry,
      createEventId: () => EVENT_ID,
      createPerformanceId: () => PERFORMANCE_ID,
      createRegionId: () => REGION_ID,
      editorController,
      loopController,
      regionController,
      sessionStore: session,
    });
  });

  it('Clip 실행을 quarter note 위치의 Cue Event로 기록한다', async () => {
    controller.startRecording();
    await controller.trigger({ slotId: SLOT_ID, trackId: TRACK_ID });
    controller.stopRecording('첫 연주');

    expect(session.getState().cue.performances).toEqual([
      expect.objectContaining({
        id: PERFORMANCE_ID,
        name: '첫 연주',
        events: [expect.objectContaining({ durationQuarterNotes: 4, id: EVENT_ID, startQuarterNotes: 0 })],
      }),
    ]);
    expect(session.getState().cueRecording.isRecording).toBe(false);
  });

  it('Cue Event를 원본 Source를 참조하는 Timeline Region으로 변환한다', async () => {
    session.getState().setCueState({
      performances: [
        {
          createdAt: '2026-08-14T00:00:00.000Z',
          events: [
            {
              durationQuarterNotes: 4,
              id: EVENT_ID,
              slotId: SLOT_ID,
              startQuarterNotes: 0,
              trackId: TRACK_ID,
            },
          ],
          id: PERFORMANCE_ID,
          name: '첫 연주',
        },
      ],
    });

    await controller.convertToArrangement(PERFORMANCE_ID);

    expect(session.getState().tracks.get(TRACK_ID)?.regions).toEqual([
      expect.objectContaining({ duration: 2, id: REGION_ID, sourceId: SOURCE_ID, startTime: 0 }),
    ]);
  });

  it('Source 범위를 벗어난 Clip 설정은 runtime과 Session에 반영하지 않는다', () => {
    const configureLoop = vi.spyOn(audioEngine, 'configureLoop');

    expect(() =>
      controller.configureClip({
        followAction: { afterBars: 1, type: 'none' },
        gain: 0.5,
        launchMode: 'toggle',
        name: 'Verse',
        quantizationBars: 1,
        slotId: SLOT_ID,
        sourceEndTimeSeconds: 3,
        sourceStartTimeSeconds: 1,
        trackId: TRACK_ID,
      })
    ).toThrowError();
    expect(configureLoop).not.toHaveBeenCalled();
    expect(session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0]?.name).toBe('Clip 1');
  });
});
