import { describe, expect, it } from 'vitest';
import { createApp } from '../apps/create-app';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import { AudioCommandType } from '../shared/types/audioCommand.schema';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';

function createAudioSourceRepository(): IAudioSourceRepository {
  const blobs = new Map<string, Blob>();
  return {
    create: async ({ metadata, blob }) => {
      blobs.set(metadata.id, blob);
    },
    load: async metadata => blobs.get(metadata.id) ?? null,
    delete: async sourceId => {
      blobs.delete(sourceId);
    },
  };
}

describe('루프 명령 실행 경로', () => {
  it('AudioCommand를 LoopController로 전달해 슬롯을 녹음 대기 상태로 바꾼다', async () => {
    const app = createApp({
      audioEngine: new MockAudioEngine(),
      audioSourceRepository: createAudioSourceRepository(),
      projectRepository: new InMemoryProjectRepository(),
    });
    await app.commandExecutor.execute({ trackId: TRACK_ID, type: AudioCommandType.ADD_TRACK });
    const slotId = app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0]?.id;
    expect(slotId).toBeDefined();

    await app.commandExecutor.execute({
      lengthBars: 1,
      quantizationBars: 1,
      slotId: slotId ?? '',
      trackId: TRACK_ID,
      type: AudioCommandType.ARM_LOOP_SLOT,
    });

    expect(app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0]?.state).toBe('armed');
  });

  it('오버더빙 명령을 재생 중인 루프의 녹음 대기 상태로 전달한다', async () => {
    const audioEngine = new MockAudioEngine();
    const app = createApp({
      audioEngine,
      audioSourceRepository: createAudioSourceRepository(),
      projectRepository: new InMemoryProjectRepository(),
    });
    await app.commandExecutor.execute({ trackId: TRACK_ID, type: AudioCommandType.ADD_TRACK });
    const slotId = app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0]?.id;
    expect(slotId).toBeDefined();
    audioEngine.emitLoopEvent({
      blob: new Blob(['loop'], { type: 'audio/wav' }),
      captureMode: 'initial',
      durationSeconds: 2,
      recordedTempoBpm: 120,
      slotId: slotId ?? '',
      trackId: TRACK_ID,
      type: 'RECORDING_COMPLETED',
    });
    audioEngine.emitLoopEvent({ slotId: slotId ?? '', state: 'playing', trackId: TRACK_ID, type: 'STATE_CHANGED' });

    await app.commandExecutor.execute({
      slotId: slotId ?? '',
      trackId: TRACK_ID,
      type: AudioCommandType.ARM_LOOP_OVERDUB,
    });

    expect(app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0]?.state).toBe('armed');
  });
});
