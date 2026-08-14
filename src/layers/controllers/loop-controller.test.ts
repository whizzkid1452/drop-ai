import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IObjectUrlAdapter } from '../audio-source-registry/i-object-url-adapter';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { createSessionStore, type SessionStore } from '../session/session';
import { MAX_LOOP_OVERDUB_LAYERS } from '../shared/loop-time';
import { LoopController } from './loop-controller';
import { ProjectStateErrorCode } from './project-state-error';
import { TrackController } from './track-controller';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SLOT_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_ID = '44444444-4444-4444-8444-444444444444';
const OVERDUB_SOURCE_ID = '55555555-5555-4555-8555-555555555555';

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
  let persistProjectChange: Mock<() => Promise<void>>;
  let reportPersistenceFailure: Mock<(cause: unknown) => void>;
  let session: SessionStore;

  beforeEach(async () => {
    const sourceIds = [SOURCE_ID, OVERDUB_SOURCE_ID];
    session = createSessionStore({ initialProjectMetadata: { id: PROJECT_ID, name: '테스트', revision: 0 } });
    session.getState().addTrack({
      id: TRACK_ID,
      isMuted: false,
      isSoloed: false,
      loopSlots: [
        {
          errorMessage: null,
          followAction: { afterBars: 1, type: 'none' },
          gain: 1,
          id: SLOT_ID,
          launchMode: 'trigger',
          lengthBars: 1,
          name: 'Clip 1',
          overdubSourceIds: [],
          quantizationBars: 1,
          recordedTempoBpm: null,
          scheduledTimeSeconds: null,
          sourceId: null,
          sourceEndTimeSeconds: null,
          sourceStartTimeSeconds: 0,
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
    persistProjectChange = vi.fn().mockResolvedValue(undefined);
    reportPersistenceFailure = vi.fn();
    controller = new LoopController({
      audioEngine,
      audioSourceRegistry,
      createSourceId: () => sourceIds.shift() ?? OVERDUB_SOURCE_ID,
      persistProjectChange,
      reportPersistenceFailure,
      sessionStore: session,
    });
  });

  it('재생을 시작한 뒤 루프 녹음을 대기시키고 슬롯 설정을 저장한다', async () => {
    await controller.arm({ lengthBars: 2, quantizationBars: 1, slotId: SLOT_ID, trackId: TRACK_ID });

    expect(session.getState().isPlaying).toBe(true);
    expect(readLoopSlot(session)).toMatchObject({ lengthBars: 2, quantizationBars: 1, state: 'armed' });
  });

  it('Clip 설정을 runtime과 Session에 함께 반영한다', () => {
    audioEngine.emitLoopEvent({
      blob: new Blob(['loop'], { type: 'audio/wav' }),
      captureMode: 'initial',
      durationSeconds: 2,
      recordedTempoBpm: 120,
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      type: 'RECORDING_COMPLETED',
    });
    const configureLoop = vi.spyOn(audioEngine, 'configureLoop');

    controller.configureClip({
      followAction: { afterBars: 2, type: 'next' },
      gain: 0.5,
      launchMode: 'toggle',
      name: 'Verse',
      quantizationBars: 2,
      slotId: SLOT_ID,
      sourceEndTimeSeconds: 1.5,
      sourceStartTimeSeconds: 0.25,
      trackId: TRACK_ID,
    });

    expect(configureLoop).toHaveBeenCalledWith(
      expect.objectContaining({ gain: 0.5, sourceEndTimeSeconds: 1.5, sourceStartTimeSeconds: 0.25 })
    );
    expect(readLoopSlot(session)).toMatchObject({
      followAction: { afterBars: 2, type: 'next' },
      gain: 0.5,
      launchMode: 'toggle',
      name: 'Verse',
      quantizationBars: 2,
    });
  });

  it('녹음 완료 Blob을 Source에 연결한 뒤 슬롯에 sourceId를 반영한다', () => {
    const blob = new Blob(['loop'], { type: 'audio/wav' });

    audioEngine.emitLoopEvent({
      blob,
      captureMode: 'initial',
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

  it('녹음 완료로 Source가 연결되면 프로젝트 변경을 저장한다', async () => {
    audioEngine.emitLoopEvent({
      blob: new Blob(['loop'], { type: 'audio/wav' }),
      captureMode: 'initial',
      durationSeconds: 2,
      recordedTempoBpm: 120,
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      type: 'RECORDING_COMPLETED',
    });

    await vi.waitFor(() => expect(persistProjectChange).toHaveBeenCalledOnce());
  });

  it('녹음 완료 저장 실패를 보고한다', async () => {
    const persistenceFailure = new Error('저장 실패');
    persistProjectChange.mockRejectedValueOnce(persistenceFailure);

    audioEngine.emitLoopEvent({
      blob: new Blob(['loop'], { type: 'audio/wav' }),
      captureMode: 'initial',
      durationSeconds: 2,
      recordedTempoBpm: 120,
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      type: 'RECORDING_COMPLETED',
    });

    await vi.waitFor(() => expect(reportPersistenceFailure).toHaveBeenCalledWith(persistenceFailure));
  });

  it('재생 중인 루프의 오버더빙을 별도 Source로 연결한다', async () => {
    audioEngine.emitLoopEvent({
      blob: new Blob(['loop'], { type: 'audio/wav' }),
      captureMode: 'initial',
      durationSeconds: 2,
      recordedTempoBpm: 120,
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      type: 'RECORDING_COMPLETED',
    });
    audioEngine.emitLoopEvent({ slotId: SLOT_ID, state: 'playing', trackId: TRACK_ID, type: 'STATE_CHANGED' });

    await controller.overdub({ slotId: SLOT_ID, trackId: TRACK_ID });
    audioEngine.emitLoopEvent({
      blob: new Blob(['overdub'], { type: 'audio/wav' }),
      captureMode: 'overdub',
      durationSeconds: 2,
      recordedTempoBpm: 120,
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      type: 'RECORDING_COMPLETED',
    });

    expect(readLoopSlot(session)).toMatchObject({
      overdubSourceIds: [OVERDUB_SOURCE_ID],
      sourceId: SOURCE_ID,
    });
    expect(audioSourceRegistry.resolve(SOURCE_ID)?.loopSlotIds).toEqual([SLOT_ID]);
    expect(audioSourceRegistry.resolve(OVERDUB_SOURCE_ID)?.loopSlotIds).toEqual([SLOT_ID]);
  });

  it('저장 가능한 오버더빙 레이어 수를 넘으면 녹음을 시작하지 않는다', async () => {
    session.getState().updateLoopSlot({
      slotId: SLOT_ID,
      trackId: TRACK_ID,
      updates: {
        overdubSourceIds: Array.from({ length: MAX_LOOP_OVERDUB_LAYERS }, (_, index) => `overdub-${index}`),
        sourceId: SOURCE_ID,
        state: 'playing',
      },
    });

    await expect(controller.overdub({ slotId: SLOT_ID, trackId: TRACK_ID })).rejects.toMatchObject({
      code: ProjectStateErrorCode.LOOP_SLOT_OVERDUB_LIMIT_REACHED,
    });
  });

  it('슬롯을 지우면 Source 연결과 등록 데이터도 제거한다', async () => {
    const blob = new Blob(['loop'], { type: 'audio/wav' });
    audioEngine.emitLoopEvent({
      blob,
      captureMode: 'initial',
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
      captureMode: 'initial',
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
