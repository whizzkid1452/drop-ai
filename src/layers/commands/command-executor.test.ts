import { describe, expect, it } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { AppController } from '../controllers/app-controller';
import { createSessionStore } from '../session/session';
import { AudioCommandType, type AudioCommand } from '../shared/types/audioCommand.schema';
import { CommandExecutor } from './command-executor';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const AUDIO_URL = 'https://example.com/audio.wav';

function createTestContext() {
  const session = createSessionStore();
  const controller = new AppController(session, new MockAudioEngine());
  const commandExecutor = new CommandExecutor(session, controller);

  return { commandExecutor, session };
}

async function addTrack(commandExecutor: CommandExecutor) {
  await commandExecutor.execute({
    type: AudioCommandType.ADD_TRACK,
    trackId: TRACK_ID,
    url: AUDIO_URL,
  });
}

async function addRegion(commandExecutor: CommandExecutor) {
  await commandExecutor.execute({
    type: AudioCommandType.LOAD_REGION,
    trackId: TRACK_ID,
    regionId: REGION_ID,
    url: AUDIO_URL,
    startTime: 0,
    duration: 5,
  });
}

describe('CommandExecutor', () => {
  it('ADD_TRACK 명령으로 트랙을 추가한다', async () => {
    const { commandExecutor, session } = createTestContext();

    await addTrack(commandExecutor);

    expect(session.getState().tracks.has(TRACK_ID)).toBe(true);
  });

  it('trackId를 생략하면 실행 시점의 첫 번째 트랙을 사용한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);

    await commandExecutor.execute({
      type: AudioCommandType.SET_TRACK_VOLUME,
      volume: 0.4,
    });

    expect(session.getState().tracks.get(TRACK_ID)?.volume).toBe(0.4);
  });

  it('재생 명령 결과를 Session에 반영한다', async () => {
    const { commandExecutor, session } = createTestContext();

    await commandExecutor.execute({ type: AudioCommandType.PLAY });

    expect(session.getState().isPlaying).toBe(true);
  });

  it('LOAD_REGION 명령으로 Region을 추가한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);

    await addRegion(commandExecutor);

    expect(session.getState().tracks.get(TRACK_ID)?.regions).toHaveLength(1);
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]?.id).toBe(REGION_ID);
  });

  it('UNLOAD_REGION에서 ID를 생략하면 첫 번째 Region을 제거한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor);

    await commandExecutor.execute({ type: AudioCommandType.UNLOAD_REGION });

    expect(session.getState().tracks.get(TRACK_ID)?.regions).toHaveLength(0);
  });

  it('SET_EXPORT_RANGE 명령으로 내보내기 범위를 설정한다', async () => {
    const { commandExecutor, session } = createTestContext();

    await commandExecutor.execute({
      type: AudioCommandType.SET_EXPORT_RANGE,
      startTime: 1,
      endTime: 4,
    });

    expect(session.getState().exportStartTime).toBe(1);
    expect(session.getState().exportEndTime).toBe(4);
  });

  it('CLEAR_EXPORT_RANGE 명령으로 내보내기 범위를 해제한다', async () => {
    const { commandExecutor, session } = createTestContext();
    session.getState().setExportRange(1, 4);

    await commandExecutor.execute({
      type: AudioCommandType.CLEAR_EXPORT_RANGE,
    });

    expect(session.getState().exportStartTime).toBeNull();
    expect(session.getState().exportEndTime).toBeNull();
  });

  it('EXPORT_AUDIO 명령 결과로 WAV Blob을 반환한다', async () => {
    const { commandExecutor } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor);

    const result = await commandExecutor.execute({
      type: AudioCommandType.EXPORT_AUDIO,
    });

    expect(result).toBeInstanceOf(Blob);
    expect(result?.type).toBe('audio/wav');
  });

  it('기본 대상 Track이 없으면 명령을 거부한다', async () => {
    const { commandExecutor } = createTestContext();

    await expect(
      commandExecutor.execute({
        type: AudioCommandType.SET_TRACK_VOLUME,
        volume: 0.4,
      })
    ).rejects.toThrow('No tracks available');
  });

  it('존재하지 않는 Track ID를 지정하면 명령을 거부한다', async () => {
    const { commandExecutor } = createTestContext();

    await expect(
      commandExecutor.execute({
        type: AudioCommandType.SET_TRACK_VOLUME,
        trackId: TRACK_ID,
        volume: 0.4,
      })
    ).rejects.toThrow(`Track not found: ${TRACK_ID}`);
  });

  it('유효하지 않은 명령을 실행하지 않는다', async () => {
    const { commandExecutor } = createTestContext();
    const invalidCommand = {
      type: AudioCommandType.SET_TRACK_VOLUME,
      volume: 2,
    } as AudioCommand;

    await expect(commandExecutor.execute(invalidCommand)).rejects.toThrow();
  });
});
