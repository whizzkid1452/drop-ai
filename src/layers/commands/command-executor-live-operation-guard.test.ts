import { describe, expect, it } from 'vitest';
import { createCliTestApp } from '../apps/create-app';
import { AudioCommandType } from '../shared/types/audioCommand.schema';
import { LiveOperationConflictError } from './live-operation-guard';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';

async function createAppWithPlayingLoop() {
  const app = createCliTestApp();
  await app.commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });
  const loopSlot = app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0];
  if (!loopSlot) {
    throw new Error('테스트할 루프 슬롯이 없습니다.');
  }
  app.session.getState().updateLoopSlot({
    slotId: loopSlot.id,
    trackId: TRACK_ID,
    updates: { state: 'playing' },
  });
  return app;
}

describe('CommandExecutor live operation guard', () => {
  it('활성 루프 중 템포 변경을 Controller 호출 전에 거부한다', async () => {
    const app = await createAppWithPlayingLoop();

    await expect(app.commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 128 })).rejects.toBeInstanceOf(
      LiveOperationConflictError
    );
    expect(app.session.getState().tempo).toBe(120);
  });

  it('Undo가 복원하려는 충돌 명령도 거부한다', async () => {
    const app = createCliTestApp();
    await app.commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });
    await app.commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 128 });
    const loopSlot = app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0];
    if (!loopSlot) {
      throw new Error('테스트할 루프 슬롯이 없습니다.');
    }
    app.session.getState().updateLoopSlot({
      slotId: loopSlot.id,
      trackId: TRACK_ID,
      updates: { state: 'playing' },
    });

    await expect(app.commandExecutor.execute({ type: AudioCommandType.UNDO })).rejects.toBeInstanceOf(
      LiveOperationConflictError
    );
    expect(app.session.getState().tempo).toBe(128);
  });
});
