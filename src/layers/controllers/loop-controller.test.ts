import { beforeEach, describe, expect, it } from 'vitest';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IObjectUrlAdapter } from '../audio-source-registry/i-object-url-adapter';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { createSessionStore, type SessionStore } from '../session/session';
import { LoopController } from './loop-controller';
import { TrackController } from './track-controller';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SLOT_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_ID = '44444444-4444-4444-8444-444444444444';

class ObjectUrlAdapterStub implements IObjectUrlAdapter {
  createObjectUrl(): string {
    return 'blob:loop-source';
  }

  revokeObjectUrl(): void {
    return undefined;
  }
}

function readLoopSlot(session: SessionStore) {
  return session
    .getState()
    .tracks.get(TRACK_ID)
    ?.loopSlots?.find(slot => slot.id === SLOT_ID);
}

describe('LoopController', () => {
  let audioEngine: MockAudioEngine;
  let audioSourceRegistry: AudioSourceRegistry;
  let controller: LoopController;
  let session: SessionStore;

  beforeEach(async () => {
    session = createSessionStore({ initialProjectMetadata: { id: PROJECT_ID, name: '테스트', revision: 0 } });
    session.getState().addTrack({
      id: TRACK_ID,
      isMuted: false,
      isSoloed: false,
      loopSlots: [
        {
          errorMessage: null,
          gain: 1,
          id: SLOT_ID,
          lengthBars: 1,
          quantizationBars: 1,
          recordedTempoBpm: null,
          scheduledTimeSeconds: null,
          sourceId: null,
          state: 'empty',
        },
      ],
      name: 'Loop Track',
      pan: 0,
      pluginInstances: [],
      regions: [],
      status: [],
      volume: 1,
    });
    audioEngine = new MockAudioEngine();
    await audioEngine.addTrack(TRACK_ID);
    audioSourceRegistry = new AudioSourceRegistry(new ObjectUrlAdapterStub());
    controller = new LoopController({
      audioEngine,
      audioSourceRegistry,
      createSourceId: () => SOURCE_ID,
      sessionStore: session,
    });
  });

  it('재생을 시작한 뒤 루프 녹음을 대기시키고 슬롯 설정을 저장한다', async () => {
    await controller.arm({ lengthBars: 2, quantizationBars: 1, slotId: SLOT_ID, trackId: TRACK_ID });

    expect(session.getState().isPlaying).toBe(true);
    expect(readLoopSlot(session)).toMatchObject({ lengthBars: 2, quantizationBars: 1, state: 'armed' });
  });

  it('녹음 완료 Blob을 Source에 연결한 뒤 슬롯에 sourceId를 반영한다', () => {
    const blob = new Blob(['loop'], { type: 'audio/wav' });

    audioEngine.emitLoopEvent({
      blob,
      durationSeconds: 2,
      recordedTempoBpm: 120,
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      type: 'RECORDING_COMPLETED',
    });

    expect(readLoopSlot(session)).toMatchObject({ recordedTempoBpm: 120, sourceId: SOURCE_ID });
    expect(audioSourceRegistry.resolve(SOURCE_ID)).toMatchObject({
      isCommitted: true,
      loopSlotIds: [SLOT_ID],
    });
  });

  it('슬롯을 지우면 Source 연결과 등록 데이터도 제거한다', async () => {
    const blob = new Blob(['loop'], { type: 'audio/wav' });
    audioEngine.emitLoopEvent({
      blob,
      durationSeconds: 2,
      recordedTempoBpm: 120,
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      type: 'RECORDING_COMPLETED',
    });

    await controller.clear({ slotId: SLOT_ID, trackId: TRACK_ID });

    expect(readLoopSlot(session)).toMatchObject({ recordedTempoBpm: null, sourceId: null, state: 'empty' });
    expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
  });

  it('트랙을 지우면 루프 슬롯의 Source 연결도 분리한다', () => {
    audioEngine.emitLoopEvent({
      blob: new Blob(['loop'], { type: 'audio/wav' }),
      durationSeconds: 2,
      recordedTempoBpm: 120,
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      type: 'RECORDING_COMPLETED',
    });
    const trackController = new TrackController({ audioEngine, audioSourceRegistry, sessionStore: session });

    trackController.removeTrack(TRACK_ID);

    expect(audioSourceRegistry.resolve(SOURCE_ID)?.loopSlotIds).toEqual([]);
  });
});
