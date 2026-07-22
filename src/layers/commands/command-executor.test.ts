import { describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import { AppController } from '../controllers/app-controller';
import { createSessionStore } from '../session/session';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import { AudioCommandType, type AudioCommand } from '../shared/types/audioCommand.schema';
import { CommandBatchExecutionError, CommandExecutor } from './command-executor';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_REGION_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_ID = '55555555-5555-4555-8555-555555555555';
const SOURCE_OBJECT_URL = 'blob:command-source';
const INITIAL_PROJECT_METADATA = {
  id: '44444444-4444-4444-8444-444444444444',
  name: '테스트 프로젝트',
  revision: 0,
};

function createTestContext() {
  const session = createSessionStore({ initialProjectMetadata: INITIAL_PROJECT_METADATA });
  const audioSourceRegistry = new AudioSourceRegistry({
    createObjectUrl: () => SOURCE_OBJECT_URL,
    revokeObjectUrl: vi.fn(),
  });
  const audioSourceRepository: IAudioSourceRepository = {
    create: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const projectRepository = new InMemoryProjectRepository();
  const controller = new AppController({
    sessionStore: session,
    audioEngine: new MockAudioEngine(),
    audioSourceRegistry,
    audioSourceRepository,
    projectRepository,
  });
  const commandExecutor = new CommandExecutor(session, controller);

  return { audioSourceRegistry, commandExecutor, controller, projectRepository, session };
}

function stageSource(audioSourceRegistry: IAudioSourceRegistry): void {
  audioSourceRegistry.stage({
    metadata: {
      id: SOURCE_ID,
      fileName: 'source.wav',
      mimeType: 'audio/wav',
      byteLength: 4,
      durationSeconds: 5,
    },
    blob: new Blob(['test'], { type: 'audio/wav' }),
  });
}

function createDeferredVoid(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise = (): void => undefined;
  const promise = new Promise<void>(resolve => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}

async function captureBatchError(execution: Promise<unknown>): Promise<CommandBatchExecutionError> {
  try {
    await execution;
  } catch (error) {
    if (error instanceof CommandBatchExecutionError) {
      return error;
    }

    throw error;
  }

  throw new Error('명령 묶음이 성공해 실패 정보를 확인할 수 없습니다.');
}

async function addTrack(commandExecutor: CommandExecutor) {
  await commandExecutor.execute({
    type: AudioCommandType.ADD_TRACK,
    trackId: TRACK_ID,
  });
}

async function addRegion(commandExecutor: CommandExecutor, audioSourceRegistry: IAudioSourceRegistry) {
  stageSource(audioSourceRegistry);
  await commandExecutor.execute({
    type: AudioCommandType.LOAD_REGION,
    trackId: TRACK_ID,
    regionId: REGION_ID,
    sourceId: SOURCE_ID,
    startTime: 0,
    duration: 5,
  });
}

describe('CommandExecutor', () => {
  it('SAVE_PROJECT를 ProjectController에 위임한다', async () => {
    const { commandExecutor, controller } = createTestContext();
    const saveProject = vi.spyOn(controller.project, 'saveProject').mockResolvedValue(undefined);

    await commandExecutor.execute({ type: AudioCommandType.SAVE_PROJECT });

    expect(saveProject).toHaveBeenCalledTimes(1);
  });

  it('앞선 편집 결과를 포함한 snapshot을 저장한다', async () => {
    const { commandExecutor, projectRepository } = createTestContext();

    await commandExecutor.executeMany([
      { type: AudioCommandType.SET_TEMPO, tempo: 140 },
      { type: AudioCommandType.SAVE_PROJECT },
    ]);

    const storedDocument = await projectRepository.load(INITIAL_PROJECT_METADATA.id);
    expect(storedDocument?.timeline.tempoBpm).toBe(140);
  });

  it('동시에 요청한 저장을 순서대로 실행해 두 번째 저장에 최신 revision을 사용한다', async () => {
    const { commandExecutor, projectRepository, session } = createTestContext();

    await Promise.all([
      commandExecutor.execute({ type: AudioCommandType.SAVE_PROJECT }),
      commandExecutor.execute({ type: AudioCommandType.SAVE_PROJECT }),
    ]);

    expect(session.getState().project.revision).toBe(1);
    await expect(projectRepository.load(INITIAL_PROJECT_METADATA.id)).resolves.toMatchObject({
      project: { revision: 1 },
    });
  });

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
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);

    await addRegion(commandExecutor, audioSourceRegistry);

    expect(session.getState().tracks.get(TRACK_ID)?.regions).toHaveLength(1);
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]?.id).toBe(REGION_ID);
  });

  it('LOAD_REGION의 sourceId를 Registry 기반 Region으로 전달한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    stageSource(audioSourceRegistry);

    await commandExecutor.execute({
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      sourceId: SOURCE_ID,
      startTime: 0,
      duration: 5,
    });

    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]).toMatchObject({
      id: REGION_ID,
      sourceId: SOURCE_ID,
    });
  });

  it('LOAD_REGION의 trackId를 생략하면 Controller가 첫 Track을 선택한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    stageSource(audioSourceRegistry);

    await commandExecutor.execute({
      type: AudioCommandType.LOAD_REGION,
      regionId: REGION_ID,
      sourceId: SOURCE_ID,
      startTime: 0,
      duration: 5,
    });

    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]).toMatchObject({
      id: REGION_ID,
      sourceId: SOURCE_ID,
    });
  });

  it('LOAD_REGION이 등록 Source 길이를 넘으면 Session과 Registry를 변경하지 않는다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    stageSource(audioSourceRegistry);

    await expect(
      commandExecutor.execute({
        type: AudioCommandType.LOAD_REGION,
        trackId: TRACK_ID,
        regionId: REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        startOffset: 1,
        duration: 5,
      })
    ).rejects.toMatchObject({ code: 'REGION_SOURCE_RANGE_EXCEEDED' });

    expect(session.getState().tracks.get(TRACK_ID)?.regions).toEqual([]);
    expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
  });

  it('LOAD_REGION의 Source를 생략하면 첫 Region의 sourceId를 재사용한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    stageSource(audioSourceRegistry);
    await commandExecutor.execute({
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      sourceId: SOURCE_ID,
      startTime: 0,
      duration: 5,
    });

    await commandExecutor.execute({
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: SECOND_REGION_ID,
      startTime: 5,
      duration: 5,
    });

    expect(session.getState().tracks.get(TRACK_ID)?.regions[1]).toMatchObject({
      id: SECOND_REGION_ID,
      sourceId: SOURCE_ID,
    });
  });

  it('UNLOAD_REGION에서 ID를 생략하면 첫 번째 Region을 제거한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);

    await commandExecutor.execute({ type: AudioCommandType.UNLOAD_REGION });

    expect(session.getState().tracks.get(TRACK_ID)?.regions).toHaveLength(0);
  });

  it('REMOVE_TRACK 명령으로 트랙을 제거한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);

    await commandExecutor.execute({
      type: AudioCommandType.REMOVE_TRACK,
      trackId: TRACK_ID,
    });

    expect(session.getState().tracks.has(TRACK_ID)).toBe(false);
  });

  it('SET_TEMPO 명령으로 프로젝트 템포를 변경한다', async () => {
    const { commandExecutor, session } = createTestContext();

    await commandExecutor.execute({
      type: AudioCommandType.SET_TEMPO,
      tempo: 140,
    });

    expect(session.getState().tempo).toBe(140);
  });

  it('SET_TRACK_MUTE 명령으로 트랙을 음소거한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);

    await commandExecutor.execute({
      type: AudioCommandType.SET_TRACK_MUTE,
      trackId: TRACK_ID,
      muted: true,
    });

    expect(session.getState().tracks.get(TRACK_ID)?.isMuted).toBe(true);
  });

  it('SET_TRACK_SOLO 명령으로 트랙을 Solo 상태로 변경한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);

    await commandExecutor.execute({
      type: AudioCommandType.SET_TRACK_SOLO,
      trackId: TRACK_ID,
      soloed: true,
    });

    expect(session.getState().tracks.get(TRACK_ID)?.isSoloed).toBe(true);
  });

  it('SPLIT_REGION 명령은 겹친 Region 중 지정한 ID만 분할한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);
    await commandExecutor.execute({
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: SECOND_REGION_ID,
      startTime: 0,
      duration: 5,
    });

    await commandExecutor.execute({
      type: AudioCommandType.SPLIT_REGION,
      trackId: TRACK_ID,
      regionId: SECOND_REGION_ID,
      splitTime: 2,
    });

    const regions = session.getState().tracks.get(TRACK_ID)?.regions ?? [];
    expect(regions).toHaveLength(3);
    expect(regions.find(region => region.id === REGION_ID)).toMatchObject({ startTime: 0, endTime: 5 });
    expect(regions.some(region => region.id === SECOND_REGION_ID)).toBe(false);
  });

  it('SPLIT_REGION의 도메인 오류를 호출자에게 전달한다', async () => {
    const { audioSourceRegistry, commandExecutor } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);

    await expect(
      commandExecutor.execute({
        type: AudioCommandType.SPLIT_REGION,
        trackId: TRACK_ID,
        regionId: REGION_ID,
        splitTime: 0,
      })
    ).rejects.toMatchObject({ code: 'INVALID_SPLIT_POSITION' });
  });

  it('MOVE_REGION 명령으로 Region의 시작과 끝 위치를 함께 변경한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);

    await commandExecutor.execute({
      type: AudioCommandType.MOVE_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      newStartTime: 3,
    });

    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]).toMatchObject({ startTime: 3, endTime: 8 });
  });

  it('동시에 들어온 execute 호출을 입력 순서대로 하나씩 실행한다', async () => {
    const { commandExecutor, controller, session } = createTestContext();
    const deferred = createDeferredVoid();
    vi.spyOn(controller.playback, 'handlePlay').mockReturnValueOnce(deferred.promise);

    const playExecution = commandExecutor.execute({ type: AudioCommandType.PLAY });
    const tempoExecution = commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 });
    await Promise.resolve();

    expect(session.getState().tempo).toBe(120);
    deferred.resolve();
    await Promise.all([playExecution, tempoExecution]);

    expect(session.getState().tempo).toBe(140);
  });

  it('앞 명령이 실패해도 뒤에 대기한 명령을 계속 실행한다', async () => {
    const { commandExecutor, session } = createTestContext();

    const failedExecution = commandExecutor.execute({
      type: AudioCommandType.REMOVE_TRACK,
      trackId: TRACK_ID,
    });
    const nextExecution = commandExecutor.execute({
      type: AudioCommandType.SET_TEMPO,
      tempo: 140,
    });

    await expect(failedExecution).rejects.toMatchObject({ code: 'TRACK_NOT_FOUND' });
    await nextExecution;
    expect(session.getState().tempo).toBe(140);
  });

  it('executeMany 묶음 안에는 다른 execute 호출을 끼워 넣지 않는다', async () => {
    const { commandExecutor, controller, session } = createTestContext();
    const deferred = createDeferredVoid();
    vi.spyOn(controller.playback, 'handlePlay').mockReturnValueOnce(deferred.promise);

    const batchExecution = commandExecutor.executeMany([
      { type: AudioCommandType.PLAY },
      { type: AudioCommandType.SET_TEMPO, tempo: 140 },
    ]);
    const nextExecution = commandExecutor.execute({
      type: AudioCommandType.SET_TEMPO,
      tempo: 160,
    });
    await Promise.resolve();

    expect(session.getState().tempo).toBe(120);
    deferred.resolve();
    await Promise.all([batchExecution, nextExecution]);

    expect(session.getState().tempo).toBe(160);
  });

  it('executeMany는 첫 실행 오류의 위치와 앞선 성공 결과를 보존한다', async () => {
    const { commandExecutor, session } = createTestContext();

    const failedCommand: AudioCommand = { type: AudioCommandType.REMOVE_TRACK, trackId: TRACK_ID };
    const error = await captureBatchError(
      commandExecutor.executeMany([
        { type: AudioCommandType.SET_TEMPO, tempo: 130 },
        failedCommand,
        { type: AudioCommandType.SET_TEMPO, tempo: 160 },
      ])
    );

    expect(error.failedIndex).toBe(1);
    expect(error.failedCommand).toEqual(failedCommand);
    expect(error.completedResults).toEqual([undefined]);
    expect(error.cause).toMatchObject({ code: 'TRACK_NOT_FOUND' });
    expect(session.getState().tempo).toBe(130);
  });

  it('executeMany는 오류 전에 생성한 Blob 결과를 보존한다', async () => {
    const { audioSourceRegistry, commandExecutor } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);

    const error = await captureBatchError(
      commandExecutor.executeMany([
        { type: AudioCommandType.EXPORT_AUDIO },
        { type: AudioCommandType.REMOVE_TRACK, trackId: SECOND_REGION_ID },
      ])
    );

    expect(error.completedResults).toHaveLength(1);
    expect(error.completedResults[0]).toBeInstanceOf(Blob);
  });

  it('executeMany는 원래 실행 오류를 같은 참조로 보존한다', async () => {
    const { commandExecutor, controller } = createTestContext();
    const originalError = new Error('재생 일시정지에 실패했습니다.');
    vi.spyOn(controller.playback, 'handlePause').mockImplementationOnce(() => {
      throw originalError;
    });

    const error = await captureBatchError(commandExecutor.executeMany([{ type: AudioCommandType.PAUSE }]));

    expect(error.cause).toBe(originalError);
    expect(error.message).toBe(originalError.message);
  });

  it('executeMany가 실패해도 대기 중인 다음 명령은 계속 실행한다', async () => {
    const { commandExecutor, session } = createTestContext();

    const failedBatch = captureBatchError(
      commandExecutor.executeMany([{ type: AudioCommandType.REMOVE_TRACK, trackId: TRACK_ID }])
    );
    const nextExecution = commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 });

    await failedBatch;
    await nextExecution;

    expect(session.getState().tempo).toBe(140);
  });

  it('executeMany는 모든 명령을 먼저 검증한 뒤 실행한다', async () => {
    const { commandExecutor, session } = createTestContext();
    const invalidCommand = {
      type: AudioCommandType.SET_TEMPO,
      tempo: 0,
    } as AudioCommand;

    const execution = commandExecutor.executeMany([{ type: AudioCommandType.SET_TEMPO, tempo: 130 }, invalidCommand]);

    await expect(execution).rejects.toThrow();
    await expect(execution).rejects.not.toBeInstanceOf(CommandBatchExecutionError);

    expect(session.getState().tempo).toBe(120);
  });

  it('executeMany는 입력 순서와 같은 결과 배열을 반환한다', async () => {
    const { audioSourceRegistry, commandExecutor } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);

    const results = await commandExecutor.executeMany([
      { type: AudioCommandType.SET_TEMPO, tempo: 130 },
      { type: AudioCommandType.EXPORT_AUDIO },
    ]);

    expect(results[0]).toBeUndefined();
    expect(results[1]).toBeInstanceOf(Blob);
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

  it('SET_EXPORT_RANGE 명령은 끝이 시작보다 이르면 Session을 변경하지 않는다', async () => {
    const { commandExecutor, session } = createTestContext();
    session.getState().setExportRange(1, 4);

    await expect(
      commandExecutor.execute({
        type: AudioCommandType.SET_EXPORT_RANGE,
        startTime: 8,
        endTime: 2,
      })
    ).rejects.toThrow('End time must be greater than or equal to start time');

    expect(session.getState()).toMatchObject({ exportStartTime: 1, exportEndTime: 4 });
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
    const { audioSourceRegistry, commandExecutor } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);

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
