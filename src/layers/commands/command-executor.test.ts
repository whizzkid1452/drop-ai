import { describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import { AppController } from '../controllers/app-controller';
import { createSessionStore } from '../session/session';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import { PluginHost } from '../plugin-host/plugin-host';
import { createPluginCatalogEntry } from '../plugin-sdk/plugin-manifest.schema';
import { gainPluginManifest } from '../plugins/builtin/gain/gain-plugin-manifest';
import { AudioCommandType, type AudioCommand } from '../shared/types/audioCommand.schema';
import { CommandHistory } from './command-history';
import { CommandBatchExecutionError, CommandExecutor } from './command-executor';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_TRACK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_REGION_ID = '33333333-3333-4333-8333-333333333333';
const BUS_TRACK_ID = '99999999-9999-4999-8999-999999999999';
const CROSSFADE_ID = '88888888-8888-4888-8888-888888888888';
const SOURCE_ID = '55555555-5555-4555-8555-555555555555';
const SOURCE_OBJECT_URL = 'blob:command-source';
const PLUGIN_INSTANCE_ID = '66666666-6666-4666-8666-666666666666';
const SECOND_PLUGIN_INSTANCE_ID = '77777777-7777-4777-8777-777777777777';
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
  const commandHistory = new CommandHistory();
  const audioEngine = new MockAudioEngine();
  const pluginHost = new PluginHost();
  const registeredManifest = pluginHost.registerManifest(gainPluginManifest);
  session.getState().replacePluginCatalogState({
    manifests: [createPluginCatalogEntry(registeredManifest)],
    validationResults: [{ manifestId: registeredManifest.id, status: 'valid', issues: [] }],
  });
  const controller = new AppController({
    sessionStore: session,
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    projectRepository,
    pluginHost,
  });
  const commandExecutor = new CommandExecutor(session, controller, commandHistory);

  return {
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    commandExecutor,
    commandHistory,
    controller,
    projectRepository,
    session,
  };
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

async function selectRegion(commandExecutor: CommandExecutor): Promise<void> {
  await commandExecutor.execute({
    type: AudioCommandType.SET_EDITOR_SELECTION,
    editPointSeconds: 0,
    range: null,
    regions: [{ regionId: REGION_ID, trackId: TRACK_ID }],
    trackIds: [TRACK_ID],
  });
}

describe('CommandExecutor', () => {
  it('Region 처리값 변경을 실행하고 Undo에서 이전 값을 복원한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);

    await commandExecutor.execute({
      type: AudioCommandType.SET_REGION_PROCESSING,
      fadeIn: { curve: 'linear', durationSeconds: 1 },
      gain: 0.5,
      isOpaque: true,
      layer: 2,
      regionId: REGION_ID,
      trackId: TRACK_ID,
    });

    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]).toMatchObject({
      fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 1 },
      gain: 0.5,
      isOpaque: true,
      layer: 2,
    });
    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]).toMatchObject({
      fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
      gain: 1,
      isOpaque: false,
      layer: 0,
    });
  });

  it('겹치는 Region의 Crossfade를 만들고 한 번의 Undo로 두 Fade를 함께 제거한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);
    await commandExecutor.execute({
      type: AudioCommandType.LOAD_REGION,
      duration: 2,
      regionId: SECOND_REGION_ID,
      sourceId: SOURCE_ID,
      startTime: 3,
      trackId: TRACK_ID,
    });

    await commandExecutor.execute({
      type: AudioCommandType.CREATE_REGION_CROSSFADE,
      crossfadeId: CROSSFADE_ID,
      curve: 'linear',
      fadeInRegionId: SECOND_REGION_ID,
      fadeOutRegionId: REGION_ID,
      trackId: TRACK_ID,
    });

    const crossfadedRegions = session.getState().tracks.get(TRACK_ID)?.regions;
    expect(crossfadedRegions?.find(region => region.id === REGION_ID)?.fadeOut).toEqual({
      crossfadeId: CROSSFADE_ID,
      curve: 'linear',
      durationSeconds: 2,
    });
    expect(crossfadedRegions?.find(region => region.id === SECOND_REGION_ID)?.fadeIn).toEqual({
      crossfadeId: CROSSFADE_ID,
      curve: 'linear',
      durationSeconds: 2,
    });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(
      session
        .getState()
        .tracks.get(TRACK_ID)
        ?.regions.every(region => region.fadeIn.crossfadeId === null && region.fadeOut.crossfadeId === null)
    ).toBe(true);
  });

  it('Normalize는 원본 Source를 유지하고 Region gain만 한 번의 Undo 단위로 변경한다', async () => {
    const { audioEngine, audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);
    await selectRegion(commandExecutor);
    audioEngine.setMockAudioRegionPeak(0.25);
    const originalRegistration = audioSourceRegistry.listCommittedRegistrations()[0];

    await commandExecutor.execute({ type: AudioCommandType.NORMALIZE_SELECTED_REGIONS, targetPeak: 0.5 });

    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]).toMatchObject({ gain: 2, sourceId: SOURCE_ID });
    expect(audioSourceRegistry.listCommittedRegistrations()).toHaveLength(1);
    expect(audioSourceRegistry.listCommittedRegistrations()[0]?.blob).toBe(originalRegistration?.blob);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]).toMatchObject({ gain: 1, sourceId: SOURCE_ID });
  });

  it('Reverse는 파생 Source를 저장해 Region에 연결하고 Undo에서 원본 Source를 복원한다', async () => {
    const { audioSourceRegistry, audioSourceRepository, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);
    await selectRegion(commandExecutor);
    const originalBlob = audioSourceRegistry.listCommittedRegistrations()[0]?.blob;
    vi.mocked(audioSourceRepository.create).mockClear();

    await commandExecutor.execute({ type: AudioCommandType.REVERSE_SELECTED_REGIONS });

    const reversedRegion = session.getState().tracks.get(TRACK_ID)?.regions[0];
    expect(reversedRegion?.sourceId).not.toBe(SOURCE_ID);
    expect(reversedRegion?.sourceStartTime).toBe(0);
    expect(
      vi
        .mocked(audioSourceRepository.create)
        .mock.calls.some(([registration]) => registration.metadata.fileName.startsWith('reverse-'))
    ).toBe(true);
    expect(
      audioSourceRegistry.listCommittedRegistrations().find(source => source.metadata.id === SOURCE_ID)?.blob
    ).toBe(originalBlob);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]?.sourceId).toBe(SOURCE_ID);
  });

  it('파생 Source 연결 실패 시 새 runtime 등록과 저장 파일을 정리한다', async () => {
    const { audioSourceRegistry, audioSourceRepository, commandExecutor, controller } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);
    await selectRegion(commandExecutor);
    vi.mocked(audioSourceRepository.create).mockClear();
    vi.mocked(audioSourceRepository.delete).mockClear();
    vi.spyOn(controller.region, 'replaceTrackRegions').mockRejectedValueOnce(new Error('Region 교체 실패'));

    await expect(commandExecutor.execute({ type: AudioCommandType.REVERSE_SELECTED_REGIONS })).rejects.toThrow(
      'Region 교체 실패'
    );

    const createdRegistration = vi.mocked(audioSourceRepository.create).mock.calls[0]?.[0];
    expect(createdRegistration).toBeDefined();
    expect(audioSourceRepository.delete).toHaveBeenCalledWith(createdRegistration?.metadata.id);
    expect(audioSourceRegistry.resolve(createdRegistration?.metadata.id ?? '')).toBeNull();
  });

  it('Strip Silence 임계값과 최소 길이를 runtime에 전달하고 파생 Source를 연결한다', async () => {
    const { audioEngine, audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);
    await selectRegion(commandExecutor);
    const renderDerivedAudioRegion = vi.spyOn(audioEngine, 'renderDerivedAudioRegion');

    await commandExecutor.execute({
      type: AudioCommandType.STRIP_SILENCE_SELECTED_REGIONS,
      minimumSilenceSeconds: 0.2,
      thresholdDb: -48,
    });

    expect(renderDerivedAudioRegion).toHaveBeenCalledWith(
      expect.objectContaining({ minimumSilenceSeconds: 0.2, operation: 'stripSilence', thresholdDb: -48 })
    );
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]?.sourceId).not.toBe(SOURCE_ID);
  });

  it('선택 Region을 nudge하고 한 번의 Undo·Redo로 전체 편집을 복원한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);
    await commandExecutor.execute({
      type: AudioCommandType.SET_EDITOR_SELECTION,
      editPointSeconds: 0,
      range: null,
      regions: [{ regionId: REGION_ID, trackId: TRACK_ID }],
      trackIds: [TRACK_ID],
    });

    await commandExecutor.execute({ type: AudioCommandType.NUDGE_SELECTED_REGIONS, deltaSeconds: 2 });
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]?.startTime).toBe(2);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]?.startTime).toBe(0);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]?.startTime).toBe(2);
  });

  it('copy와 paste는 runtime Clipboard를 사용하고 Undo·Redo에서 같은 Region ID를 복원한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);
    await commandExecutor.execute({
      type: AudioCommandType.SET_EDITOR_SELECTION,
      editPointSeconds: 0,
      range: null,
      regions: [{ regionId: REGION_ID, trackId: TRACK_ID }],
      trackIds: [TRACK_ID],
    });
    await commandExecutor.execute({ type: AudioCommandType.COPY_SELECTED_REGIONS });
    await commandExecutor.execute({
      type: AudioCommandType.SET_EDITOR_SELECTION,
      editPointSeconds: 6,
      range: null,
      regions: [],
      trackIds: [TRACK_ID],
    });

    await commandExecutor.execute({ type: AudioCommandType.PASTE_REGIONS });
    const pastedRegion = session.getState().tracks.get(TRACK_ID)?.regions.at(-1);
    expect(pastedRegion).toMatchObject({ sourceId: SOURCE_ID, startTime: 6 });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions).toHaveLength(1);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions.at(-1)?.id).toBe(pastedRegion?.id);
  });

  it('단일 Track 녹음을 count-in과 preroll 뒤 시작하고 RecordedTake를 Region으로 저장한다', async () => {
    const { audioEngine, audioSourceRegistry, audioSourceRepository, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({ type: AudioCommandType.SET_CURRENT_TIME, time: 4 });
    await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_RECORD_ARM, trackId: TRACK_ID, armed: true });
    const recordedBlob = new Blob(['recorded'], { type: 'audio/wav' });
    vi.spyOn(audioEngine, 'stopRecording').mockResolvedValueOnce({
      failures: [],
      takes: [
        {
          blob: recordedBlob,
          durationSeconds: 1.5,
          sampleRate: 48_000,
          startedAtSeconds: 6,
          trackId: TRACK_ID,
        },
      ],
    });

    await commandExecutor.execute({ type: AudioCommandType.START_RECORDING, countInBars: 1, prerollSeconds: 1 });
    expect(audioEngine.getMockTransportState().isMetronomeEnabled).toBe(true);
    const result = await commandExecutor.execute({ type: AudioCommandType.STOP_RECORDING });

    expect(result).toMatchObject({
      failures: [],
      takes: [{ durationSeconds: 1.5, startedAtSeconds: 6, trackId: TRACK_ID }],
    });
    expect(audioEngine.getCurrentTime()).toBe(3);
    expect(audioEngine.getMockTransportState().isMetronomeEnabled).toBe(false);
    expect(session.getState().tracks.get(TRACK_ID)?.regions).toEqual([
      expect.objectContaining({ duration: 1.5, sourceStartTime: 0, startTime: 6 }),
    ]);
    const createdRegistration = vi.mocked(audioSourceRepository.create).mock.calls[0]?.[0];
    expect(createdRegistration).toMatchObject({
      blob: recordedBlob,
      metadata: { byteLength: recordedBlob.size, durationSeconds: 1.5, mimeType: 'audio/wav' },
    });
    expect(audioSourceRegistry.resolve(createdRegistration?.metadata.id ?? '')).toMatchObject({ isCommitted: true });
  });

  it('녹음 Source 저장이 실패하면 Region과 runtime Source를 추가하지 않는다', async () => {
    const { audioEngine, audioSourceRegistry, audioSourceRepository, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_RECORD_ARM, trackId: TRACK_ID, armed: true });
    await commandExecutor.execute({ type: AudioCommandType.START_RECORDING, countInBars: 0, prerollSeconds: 0 });
    vi.spyOn(audioEngine, 'stopRecording').mockResolvedValueOnce({
      failures: [],
      takes: [
        {
          blob: new Blob(['recorded'], { type: 'audio/wav' }),
          durationSeconds: 1,
          sampleRate: 48_000,
          startedAtSeconds: 0,
          trackId: TRACK_ID,
        },
      ],
    });
    vi.mocked(audioSourceRepository.create).mockRejectedValueOnce(new Error('OPFS 저장 실패'));

    const result = await commandExecutor.execute({ type: AudioCommandType.STOP_RECORDING });

    expect(result).toMatchObject({
      failures: [{ cause: { message: 'OPFS 저장 실패' }, stage: 'persist', trackId: TRACK_ID }],
      takes: [],
    });

    expect(session.getState().tracks.get(TRACK_ID)?.regions).toEqual([]);
    expect(audioSourceRegistry.listCommittedMetadata()).toEqual([]);
    expect(audioSourceRepository.delete).not.toHaveBeenCalled();
  });

  it('녹음 Region 연결이 실패하면 저장된 Source와 runtime Source를 정리한다', async () => {
    const { audioEngine, audioSourceRegistry, audioSourceRepository, commandExecutor, controller } =
      createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_RECORD_ARM, trackId: TRACK_ID, armed: true });
    await commandExecutor.execute({ type: AudioCommandType.START_RECORDING, countInBars: 0, prerollSeconds: 0 });
    vi.spyOn(audioEngine, 'stopRecording').mockResolvedValueOnce({
      failures: [],
      takes: [
        {
          blob: new Blob(['recorded'], { type: 'audio/wav' }),
          durationSeconds: 1,
          sampleRate: 48_000,
          startedAtSeconds: 0,
          trackId: TRACK_ID,
        },
      ],
    });
    vi.spyOn(controller.region, 'replaceTrackRegions').mockRejectedValueOnce(new Error('Region 연결 실패'));

    const result = await commandExecutor.execute({ type: AudioCommandType.STOP_RECORDING });

    expect(result).toMatchObject({
      failures: [{ cause: { message: 'Region 연결 실패' }, stage: 'persist', trackId: TRACK_ID }],
      takes: [],
    });

    const sourceId = vi.mocked(audioSourceRepository.create).mock.calls[0]?.[0].metadata.id ?? '';
    expect(audioSourceRepository.delete).toHaveBeenCalledWith(sourceId);
    expect(audioSourceRegistry.resolve(sourceId)).toBeNull();
  });

  it('여러 armed Track 중 실패한 Track을 분리하고 성공한 Take를 보존한다', async () => {
    const { audioEngine, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: SECOND_TRACK_ID });
    await commandExecutor.execute({
      type: AudioCommandType.SET_TRACK_RECORDING_INPUT,
      channelIndex: 0,
      deviceId: null,
      trackId: TRACK_ID,
    });
    await commandExecutor.execute({
      type: AudioCommandType.SET_TRACK_RECORDING_INPUT,
      channelIndex: 1,
      deviceId: null,
      trackId: SECOND_TRACK_ID,
    });
    await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_RECORD_ARM, armed: true, trackId: TRACK_ID });
    await commandExecutor.execute({
      type: AudioCommandType.SET_TRACK_RECORD_ARM,
      armed: true,
      trackId: SECOND_TRACK_ID,
    });
    expect(audioEngine.getRecordingState()).toMatchObject({
      armedTrackIds: [TRACK_ID, SECOND_TRACK_ID],
      inputRoutes: [
        { channelIndex: 0, deviceId: null, trackId: TRACK_ID },
        { channelIndex: 1, deviceId: null, trackId: SECOND_TRACK_ID },
      ],
    });

    await commandExecutor.execute({ type: AudioCommandType.START_RECORDING, countInBars: 0, prerollSeconds: 0 });
    const captureFailure = new Error('두 번째 입력 채널 없음');
    vi.spyOn(audioEngine, 'stopRecording').mockResolvedValueOnce({
      failures: [{ cause: captureFailure, stage: 'capture', trackId: SECOND_TRACK_ID }],
      takes: [
        {
          blob: new Blob(['first-track'], { type: 'audio/wav' }),
          durationSeconds: 2,
          sampleRate: 48_000,
          startedAtSeconds: 0,
          trackId: TRACK_ID,
        },
      ],
    });

    const result = await commandExecutor.execute({ type: AudioCommandType.STOP_RECORDING });

    expect(result).toMatchObject({
      failures: [{ cause: captureFailure, stage: 'capture', trackId: SECOND_TRACK_ID }],
      takes: [{ durationSeconds: 2, trackId: TRACK_ID }],
    });
    expect(session.getState().tracks.get(TRACK_ID)?.regions).toHaveLength(1);
    expect(session.getState().tracks.get(SECOND_TRACK_ID)?.regions).toEqual([]);
    expect(audioEngine.getRecordingState().armedTrackIds).toEqual([TRACK_ID, SECOND_TRACK_ID]);
  });

  it('Punch 범위만 Take와 Region으로 공개하고 원본 Source 길이는 유지한다', async () => {
    const { audioEngine, audioSourceRepository, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({
      type: AudioCommandType.SET_PUNCH_RECORDING,
      isEnabled: true,
      range: { endTimeSeconds: 4, startTimeSeconds: 2 },
    });
    await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_RECORD_ARM, armed: true, trackId: TRACK_ID });
    await commandExecutor.execute({ type: AudioCommandType.START_RECORDING, countInBars: 0, prerollSeconds: 0 });
    vi.spyOn(audioEngine, 'stopRecording').mockResolvedValueOnce({
      failures: [],
      takes: [
        {
          blob: new Blob(['punch-source'], { type: 'audio/wav' }),
          durationSeconds: 5,
          sampleRate: 48_000,
          startedAtSeconds: 0,
          trackId: TRACK_ID,
        },
      ],
    });

    const result = await commandExecutor.execute({ type: AudioCommandType.STOP_RECORDING });

    expect(result).toMatchObject({ takes: [{ durationSeconds: 2, startedAtSeconds: 2 }] });
    expect(session.getState().tracks.get(TRACK_ID)?.regions).toEqual([
      expect.objectContaining({ duration: 2, sourceStartTime: 2, startTime: 2 }),
    ]);
    expect(vi.mocked(audioSourceRepository.create).mock.calls[0]?.[0].metadata.durationSeconds).toBe(5);
  });

  it('Take 선택과 Comp 해제를 Undo·Redo하며 같은 Take Region을 다시 구성한다', async () => {
    const { audioEngine, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_RECORD_ARM, armed: true, trackId: TRACK_ID });

    for (const startedAtSeconds of [0, 2]) {
      await commandExecutor.execute({ type: AudioCommandType.START_RECORDING, countInBars: 0, prerollSeconds: 0 });
      vi.spyOn(audioEngine, 'stopRecording').mockResolvedValueOnce({
        failures: [],
        takes: [
          {
            blob: new Blob([`take-${startedAtSeconds}`], { type: 'audio/wav' }),
            durationSeconds: 2,
            sampleRate: 48_000,
            startedAtSeconds,
            trackId: TRACK_ID,
          },
        ],
      });
      await commandExecutor.execute({ type: AudioCommandType.STOP_RECORDING });
    }

    const recording = session.getState().tracks.get(TRACK_ID)?.recording;
    const playlist = recording?.playlists[0];
    const firstTake = playlist?.takes[0];
    expect(playlist?.takes).toHaveLength(2);
    expect(
      session
        .getState()
        .tracks.get(TRACK_ID)
        ?.regions.map(region => region.id)
    ).toEqual(playlist?.takes.map(take => take.id));
    if (!playlist || !firstTake) {
      throw new Error('테스트 Take를 만들지 못했습니다.');
    }

    await commandExecutor.execute({
      type: AudioCommandType.SELECT_TAKE,
      playlistId: playlist.id,
      takeId: firstTake.id,
      trackId: TRACK_ID,
    });
    const selectedRegionId = session.getState().tracks.get(TRACK_ID)?.regions[0]?.id;
    expect(session.getState().tracks.get(TRACK_ID)?.regions).toEqual([
      expect.objectContaining({ duration: 2, sourceId: firstTake.sourceId, startTime: 0 }),
    ]);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.recording?.playlists[0]?.compSegments).toEqual([]);
    expect(
      session
        .getState()
        .tracks.get(TRACK_ID)
        ?.regions.map(region => region.id)
    ).toEqual(playlist.takes.map(take => take.id));

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(
      session
        .getState()
        .tracks.get(TRACK_ID)
        ?.regions.map(region => region.id)
    ).toEqual([selectedRegionId]);
  });

  it('SAVE_PROJECT를 ProjectController에 위임한다', async () => {
    const { commandExecutor, controller } = createTestContext();
    const saveProject = vi.spyOn(controller.project, 'saveProject').mockResolvedValue(undefined);

    await commandExecutor.execute({ type: AudioCommandType.SAVE_PROJECT });

    expect(saveProject).toHaveBeenCalledTimes(1);
  });

  it('LOAD_PROJECT를 ProjectController에 위임한다', async () => {
    const { commandExecutor, controller } = createTestContext();
    const loadProject = vi.spyOn(controller.project, 'loadProject').mockResolvedValue(undefined);

    await commandExecutor.execute({ type: AudioCommandType.LOAD_PROJECT, projectId: INITIAL_PROJECT_METADATA.id });

    expect(loadProject).toHaveBeenCalledWith(INITIAL_PROJECT_METADATA.id);
  });

  it('SET_TEMPO를 Undo하고 같은 값으로 Redo한다', async () => {
    const { commandExecutor, session } = createTestContext();

    await commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 });
    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tempo).toBe(120);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tempo).toBe(140);
  });

  it('SET_TIMELINE_MAP을 적용하고 Undo와 Redo로 전체 Map을 복원한다', async () => {
    const { audioEngine, commandExecutor, session } = createTestContext();
    const command: AudioCommand = {
      type: AudioCommandType.SET_TIMELINE_MAP,
      tempoChanges: [
        { quarterNotePosition: 0, bpm: 120 },
        { quarterNotePosition: 4, bpm: 90 },
      ],
      meterChanges: [
        { quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 },
        { quarterNotePosition: 8, beatsPerBar: 6, beatUnit: 8 },
      ],
    };

    await commandExecutor.execute(command);
    expect(session.getState().tempoChanges).toEqual([
      { quarterNotePosition: 0, bpm: 120 },
      { quarterNotePosition: 4, bpm: 90 },
    ]);
    expect(session.getState().meterChanges[1]).toEqual({ quarterNotePosition: 8, beatsPerBar: 6, beatUnit: 8 });
    expect(audioEngine.getMockTransportState().tempoChanges).toEqual(command.tempoChanges);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tempoChanges).toEqual([{ quarterNotePosition: 0, bpm: 120 }]);
    expect(session.getState().meterChanges).toEqual([{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }]);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tempoChanges).toEqual(command.tempoChanges);
    expect(session.getState().meterChanges).toEqual(command.meterChanges);
  });

  it('Loop 범위·활성 상태와 Metronome 설정을 runtime과 Session에 함께 적용한다', async () => {
    const { audioEngine, commandExecutor, session } = createTestContext();

    await commandExecutor.execute({ type: AudioCommandType.SET_LOOP_RANGE, startTimeSeconds: 2, endTimeSeconds: 8 });
    await commandExecutor.execute({ type: AudioCommandType.SET_LOOP_ENABLED, isEnabled: true });
    await commandExecutor.execute({ type: AudioCommandType.SET_METRONOME, isEnabled: true, volume: 0.5 });

    expect(session.getState()).toMatchObject({
      isLoopEnabled: true,
      isMetronomeEnabled: true,
      loopRange: { endTimeSeconds: 8, startTimeSeconds: 2 },
      metronomeVolume: 0.5,
    });
    expect(audioEngine.getMockTransportState()).toMatchObject({
      isLoopEnabled: true,
      isMetronomeEnabled: true,
      loopRange: { endTimeSeconds: 8, startTimeSeconds: 2 },
      metronomeVolume: 0.5,
    });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState()).toMatchObject({ isMetronomeEnabled: false, metronomeVolume: 0.8 });
    expect(audioEngine.getMockTransportState()).toMatchObject({ isMetronomeEnabled: false, metronomeVolume: 0.8 });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().isLoopEnabled).toBe(false);
    expect(audioEngine.getMockTransportState().isLoopEnabled).toBe(false);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().loopRange).toBeNull();
    expect(audioEngine.getMockTransportState().loopRange).toBeNull();
  });

  it('SET_TIMELINE_MARKERS를 적용하고 Undo와 Redo로 전체 목록을 복원한다', async () => {
    const { commandExecutor, session } = createTestContext();
    const markers = [
      {
        id: '88888888-8888-4888-8888-888888888888',
        name: 'Verse',
        quarterNotePosition: 8,
      },
    ];

    await commandExecutor.execute({ type: AudioCommandType.SET_TIMELINE_MARKERS, markers });
    expect(session.getState().timelineMarkers).toEqual(markers);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().timelineMarkers).toEqual([]);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().timelineMarkers).toEqual(markers);
  });

  it('SET_MASTER_VOLUME을 실행하고 Undo와 Redo로 복원한다', async () => {
    const { audioEngine, commandExecutor, session } = createTestContext();
    const setMasterVolume = vi.spyOn(audioEngine, 'setMasterVolume');

    await commandExecutor.execute({ type: AudioCommandType.SET_MASTER_VOLUME, volume: 0.4 });
    expect(session.getState().masterVolume).toBe(0.4);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().masterVolume).toBe(1);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().masterVolume).toBe(0.4);
    expect(setMasterVolume).toHaveBeenCalledTimes(3);
  });

  it('Monitor 상태를 runtime에만 적용하고 Undo 기록은 만들지 않는다', async () => {
    const { audioEngine, commandExecutor, commandHistory } = createTestContext();

    await commandExecutor.execute({
      type: AudioCommandType.SET_MONITOR_STATE,
      isCut: false,
      isDimmed: true,
      isMono: true,
    });

    expect(audioEngine.getMonitorState()).toEqual({ isCut: false, isDimmed: true, isMono: true });
    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: false });
  });

  it('Track Route 변경을 실행하고 Undo와 Redo로 복원한다', async () => {
    const { audioEngine, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({
      type: AudioCommandType.ADD_TRACK,
      channelCount: 2,
      kind: 'bus',
      trackId: BUS_TRACK_ID,
    });

    await commandExecutor.execute({
      type: AudioCommandType.SET_TRACK_ROUTING,
      channelCount: 2,
      kind: 'audio',
      output: { kind: 'track', trackId: BUS_TRACK_ID },
      trackId: TRACK_ID,
    });
    expect(session.getState().routingGraph.routes.find(route => route.trackId === TRACK_ID)?.output).toEqual({
      kind: 'track',
      trackId: BUS_TRACK_ID,
    });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().routingGraph.routes.find(route => route.trackId === TRACK_ID)?.output).toEqual({
      kind: 'master',
    });

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(audioEngine.getRoutingGraph()).toEqual(session.getState().routingGraph);
  });

  it('실패한 편집은 Undo 기록에 추가하지 않는다', async () => {
    const { commandExecutor, commandHistory, controller } = createTestContext();
    vi.spyOn(controller.playback, 'handleSetTempo').mockImplementation(() => {
      throw new Error('tempo failed');
    });

    await expect(commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 })).rejects.toThrow(
      'tempo failed'
    );

    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: false });
  });

  it('Controller가 성공을 반환해도 Session이 바뀌지 않은 편집은 기록하지 않는다', async () => {
    const { commandExecutor, commandHistory, controller } = createTestContext();
    vi.spyOn(controller.playback, 'handleSetTempo').mockImplementation(() => undefined);

    await commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 });

    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: false });
  });

  it('Session 구독자 오류가 발생해도 반영된 편집은 Undo 기록에 추가한다', async () => {
    const { commandExecutor, commandHistory, session } = createTestContext();
    const unsubscribe = session.subscribe(() => {
      throw new Error('listener failed');
    });

    await expect(commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 })).rejects.toThrow(
      'listener failed'
    );
    unsubscribe();

    expect(session.getState().tempo).toBe(140);
    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: true });
    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tempo).toBe(120);
  });

  it('CommandHistory 구독자 오류가 발생해도 같은 편집을 중복 기록하지 않는다', async () => {
    const { commandExecutor, commandHistory } = createTestContext();
    const unsubscribe = commandHistory.subscribe(() => {
      throw new Error('history listener failed');
    });

    await expect(commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 })).rejects.toThrow(
      'history listener failed'
    );
    unsubscribe();

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(commandHistory.getSnapshot()).toEqual({ canRedo: true, canUndo: false });
  });

  it('Undo 뒤 새 편집을 실행하면 Redo 기록을 제거한다', async () => {
    const { commandExecutor, commandHistory } = createTestContext();
    await commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 });
    await commandExecutor.execute({ type: AudioCommandType.UNDO });

    await commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 130 });

    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: true });
  });

  it('프로젝트 불러오기가 성공하면 이전 프로젝트의 Undo 기록을 제거한다', async () => {
    const { commandExecutor, commandHistory, controller } = createTestContext();
    vi.spyOn(controller.project, 'loadProject').mockResolvedValue(undefined);
    await commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 });

    await commandExecutor.execute({ type: AudioCommandType.LOAD_PROJECT, projectId: INITIAL_PROJECT_METADATA.id });

    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: false });
  });

  it('프로젝트 상태가 교체된 뒤 구독자 오류가 발생해도 이전 Undo 기록을 제거한다', async () => {
    const { commandExecutor, commandHistory, controller, session } = createTestContext();
    await commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 });
    vi.spyOn(controller.project, 'loadProject').mockImplementation(async () => {
      session.getState().replaceProjectState({
        project: { ...INITIAL_PROJECT_METADATA, name: '불러온 프로젝트' },
        tempo: 90,
        masterVolume: 1,
        exportStartTime: null,
        exportEndTime: null,
        tracks: new Map(),
      });
    });
    const unsubscribe = session.subscribe(() => {
      throw new Error('listener failed');
    });

    await expect(
      commandExecutor.execute({ type: AudioCommandType.LOAD_PROJECT, projectId: INITIAL_PROJECT_METADATA.id })
    ).rejects.toThrow('listener failed');
    unsubscribe();

    expect(session.getState().tempo).toBe(90);
    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: false });
  });

  it('Track 추가를 Undo하고 같은 ID로 Redo한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.has(TRACK_ID)).toBe(false);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tracks.has(TRACK_ID)).toBe(true);
  });

  it('Track 이름 변경을 Undo하고 같은 이름으로 Redo한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    const originalName = session.getState().tracks.get(TRACK_ID)?.name;

    await commandExecutor.execute({
      type: AudioCommandType.SET_TRACK_NAME,
      trackId: TRACK_ID,
      name: '보컬',
    });
    expect(session.getState().tracks.get(TRACK_ID)?.name).toBe('보컬');

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.name).toBe(originalName);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tracks.get(TRACK_ID)?.name).toBe('보컬');
  });

  it('없는 Track의 이름 변경을 거부한다', async () => {
    const { commandExecutor } = createTestContext();

    await expect(
      commandExecutor.execute({
        type: AudioCommandType.SET_TRACK_NAME,
        trackId: TRACK_ID,
        name: '보컬',
      })
    ).rejects.toThrow('트랙을 찾을 수 없습니다');
  });

  it('Region 추가를 Undo하고 정규화된 Source 범위로 Redo한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions).toEqual([]);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions).toEqual([
      expect.objectContaining({
        id: REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 5,
      }),
    ]);
  });

  it('Region 상태 공개 뒤 구독자 오류가 발생해도 Source 연결을 유지해 Undo할 수 있다', async () => {
    const { audioSourceRegistry, commandExecutor, commandHistory, session } = createTestContext();
    await addTrack(commandExecutor);
    stageSource(audioSourceRegistry);
    const unsubscribe = session.subscribe(() => {
      throw new Error('listener failed');
    });

    await expect(
      commandExecutor.execute({
        type: AudioCommandType.LOAD_REGION,
        trackId: TRACK_ID,
        regionId: REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        duration: 5,
      })
    ).rejects.toThrow('listener failed');
    unsubscribe();

    expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toContain(REGION_ID);
    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: true });
    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions).toEqual([]);
  });

  it('Region 삭제를 Undo하면 같은 ID와 Source 범위로 복원한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);
    await commandExecutor.execute({
      type: AudioCommandType.UNLOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
    });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });

    expect(session.getState().tracks.get(TRACK_ID)?.regions).toEqual([
      expect.objectContaining({ id: REGION_ID, sourceId: SOURCE_ID, duration: 5 }),
    ]);
  });

  it('Region 이동을 Undo하고 Redo한다', async () => {
    const { audioSourceRegistry, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await addRegion(commandExecutor, audioSourceRegistry);
    await commandExecutor.execute({
      type: AudioCommandType.MOVE_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      newStartTime: 2,
    });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]?.startTime).toBe(0);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tracks.get(TRACK_ID)?.regions[0]?.startTime).toBe(2);
  });

  it('Track 볼륨 변경을 Undo하면 Session과 AudioEngine 값을 함께 복원한다', async () => {
    const { audioEngine, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({
      type: AudioCommandType.SET_TRACK_VOLUME,
      trackId: TRACK_ID,
      volume: 0.4,
    });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });

    expect(session.getState().tracks.get(TRACK_ID)?.volume).toBe(1);
    expect(audioEngine.getTrackParams(TRACK_ID)?.volume).toBe(1);
  });

  it('Track Pan 변경을 Undo한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_PAN, trackId: TRACK_ID, pan: -0.5 });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });

    expect(session.getState().tracks.get(TRACK_ID)?.pan).toBe(0);
  });

  it('Track Mute 변경을 Undo한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_MUTE, trackId: TRACK_ID, muted: true });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });

    expect(session.getState().tracks.get(TRACK_ID)?.isMuted).toBe(false);
  });

  it('Track Solo 변경을 Undo한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({ type: AudioCommandType.SET_TRACK_SOLO, trackId: TRACK_ID, soloed: true });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });

    expect(session.getState().tracks.get(TRACK_ID)?.isSoloed).toBe(false);
  });

  it('Export 범위 해제를 Undo하면 이전 범위를 복원한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await commandExecutor.execute({ type: AudioCommandType.SET_EXPORT_RANGE, startTime: 1, endTime: 4 });
    await commandExecutor.execute({ type: AudioCommandType.CLEAR_EXPORT_RANGE });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });

    expect(session.getState()).toMatchObject({ exportStartTime: 1, exportEndTime: 4 });
  });

  it('Undo 실행이 실패하면 같은 기록을 다음 Undo에서 다시 사용한다', async () => {
    const { commandExecutor, commandHistory, controller } = createTestContext();
    await commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 });
    vi.spyOn(controller.playback, 'handleSetTempo').mockImplementation(() => {
      throw new Error('undo failed');
    });

    await expect(commandExecutor.execute({ type: AudioCommandType.UNDO })).rejects.toThrow('undo failed');

    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: true });
  });

  it('동시에 요청한 편집과 Undo를 Command 대기열 순서로 실행한다', async () => {
    const { commandExecutor, session } = createTestContext();

    await Promise.all([
      commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 }),
      commandExecutor.execute({ type: AudioCommandType.UNDO }),
    ]);

    expect(session.getState().tempo).toBe(120);
  });

  it('아직 복원하지 못하는 Track 삭제는 성공 뒤 기존 Undo 기록을 제거한다', async () => {
    const { commandExecutor, commandHistory } = createTestContext();
    await addTrack(commandExecutor);

    await commandExecutor.execute({ type: AudioCommandType.REMOVE_TRACK, trackId: TRACK_ID });

    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: false });
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
    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances).toEqual([]);
  });

  it('SET_PLUGIN_ENABLED 명령을 실행하고 Undo와 Redo로 복원한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
      manifestId: 'builtin.gain',
    });

    await commandExecutor.execute({
      type: AudioCommandType.SET_PLUGIN_ENABLED,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
      isEnabled: false,
    });
    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.isEnabled).toBe(false);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.isEnabled).toBe(true);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.isEnabled).toBe(false);
  });

  it('비활성화된 Plugin을 제거한 뒤 Undo하면 비활성 상태로 복원한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
      manifestId: 'builtin.gain',
      isEnabled: false,
    });

    await commandExecutor.execute({
      type: AudioCommandType.REMOVE_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
    });
    await commandExecutor.execute({ type: AudioCommandType.UNDO });

    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.isEnabled).toBe(false);
  });

  it('MOVE_PLUGIN으로 순서를 바꾸고 Undo와 Redo로 복원한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    for (const instanceId of [PLUGIN_INSTANCE_ID, SECOND_PLUGIN_INSTANCE_ID]) {
      await commandExecutor.execute({
        type: AudioCommandType.INSTALL_PLUGIN,
        trackId: TRACK_ID,
        instanceId,
        manifestId: 'builtin.gain',
      });
    }

    await commandExecutor.execute({
      type: AudioCommandType.MOVE_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
      targetIndex: 1,
    });
    expect(
      session
        .getState()
        .tracks.get(TRACK_ID)
        ?.pluginInstances.map(instance => instance.id)
    ).toEqual([SECOND_PLUGIN_INSTANCE_ID, PLUGIN_INSTANCE_ID]);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(
      session
        .getState()
        .tracks.get(TRACK_ID)
        ?.pluginInstances.map(instance => instance.id)
    ).toEqual([PLUGIN_INSTANCE_ID, SECOND_PLUGIN_INSTANCE_ID]);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(
      session
        .getState()
        .tracks.get(TRACK_ID)
        ?.pluginInstances.map(instance => instance.id)
    ).toEqual([SECOND_PLUGIN_INSTANCE_ID, PLUGIN_INSTANCE_ID]);
  });

  it('Plugin 제거를 Undo하면 원래 index에 복원한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    for (const instanceId of [PLUGIN_INSTANCE_ID, SECOND_PLUGIN_INSTANCE_ID]) {
      await commandExecutor.execute({
        type: AudioCommandType.INSTALL_PLUGIN,
        trackId: TRACK_ID,
        instanceId,
        manifestId: 'builtin.gain',
      });
    }

    await commandExecutor.execute({
      type: AudioCommandType.REMOVE_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
    });
    await commandExecutor.execute({ type: AudioCommandType.UNDO });

    expect(
      session
        .getState()
        .tracks.get(TRACK_ID)
        ?.pluginInstances.map(instance => instance.id)
    ).toEqual([PLUGIN_INSTANCE_ID, SECOND_PLUGIN_INSTANCE_ID]);
  });

  it('INSTALL_PLUGIN 명령으로 기본값을 가진 Plugin을 설치한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);

    await commandExecutor.execute({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
      manifestId: 'builtin.gain',
    });

    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances).toEqual([
      expect.objectContaining({
        id: PLUGIN_INSTANCE_ID,
        manifestSummary: expect.objectContaining({ id: 'builtin.gain' }),
        parameters: [{ id: 'gain', value: 1 }],
      }),
    ]);
  });

  it('instanceId가 없는 INSTALL_PLUGIN은 생성한 ID를 Redo에서도 재사용한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);

    await commandExecutor.execute({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId: TRACK_ID,
      manifestId: 'builtin.gain',
    });
    const installedInstanceId = session.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.id;

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    await commandExecutor.execute({ type: AudioCommandType.REDO });

    expect(installedInstanceId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.id).toBe(installedInstanceId);
  });

  it('SET_PLUGIN_PARAMETER와 REMOVE_PLUGIN 명령을 순서대로 실행한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
      manifestId: 'builtin.gain',
      parameterValues: { gain: 0.75 },
    });

    await commandExecutor.execute({
      type: AudioCommandType.SET_PLUGIN_PARAMETER,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
      parameterId: 'gain',
      value: 0.5,
    });

    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.parameters).toEqual([
      { id: 'gain', value: 0.5 },
    ]);

    await commandExecutor.execute({
      type: AudioCommandType.REMOVE_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
    });

    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances).toEqual([]);
  });

  it('Plugin 설치·Parameter 변경·제거를 Undo와 Redo로 복원한다', async () => {
    const { commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    await commandExecutor.execute({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
      manifestId: 'builtin.gain',
      parameterValues: { gain: 0.75 },
    });

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances).toEqual([]);
    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.parameters).toEqual([
      { id: 'gain', value: 0.75 },
    ]);

    await commandExecutor.execute({
      type: AudioCommandType.SET_PLUGIN_PARAMETER,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
      parameterId: 'gain',
      value: 0.25,
    });
    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.parameters).toEqual([
      { id: 'gain', value: 0.75 },
    ]);

    await commandExecutor.execute({
      type: AudioCommandType.REMOVE_PLUGIN,
      trackId: TRACK_ID,
      instanceId: PLUGIN_INSTANCE_ID,
    });
    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.parameters).toEqual([
      { id: 'gain', value: 0.75 },
    ]);
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
    if (!(result instanceof Blob)) {
      throw new Error('내보내기 결과가 Blob이 아닙니다.');
    }
    expect(result.type).toBe('audio/wav');
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

  it('Automation lane을 실행하고 Undo와 Redo로 복원한다', async () => {
    const { audioEngine, commandExecutor, session } = createTestContext();
    await addTrack(commandExecutor);
    const automationLanes = [
      {
        id: REGION_ID,
        isEnabled: true,
        mode: 'read' as const,
        points: [
          {
            id: SECOND_REGION_ID,
            interpolation: 'linear' as const,
            timeSeconds: 0,
            value: 0.5,
          },
        ],
        target: { kind: 'trackVolume' as const },
      },
    ];
    const runtimeSpy = vi.spyOn(audioEngine, 'setAutomationLanes');

    await commandExecutor.execute({
      automationLanes,
      trackId: TRACK_ID,
      type: AudioCommandType.SET_AUTOMATION_LANES,
    });
    expect(session.getState().tracks.get(TRACK_ID)?.automationLanes).toEqual(automationLanes);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.automationLanes).toEqual([]);

    await commandExecutor.execute({ type: AudioCommandType.REDO });
    expect(session.getState().tracks.get(TRACK_ID)?.automationLanes).toEqual(automationLanes);
    expect(runtimeSpy).toHaveBeenCalledTimes(3);
  });

  it('여러 write preview 뒤 commit한 gesture를 한 번의 Undo로 복원한다', async () => {
    const { commandExecutor, commandHistory, controller, session } = createTestContext();
    await addTrack(commandExecutor);
    const originalLane = {
      id: REGION_ID,
      isEnabled: true,
      mode: 'touch' as const,
      points: [
        {
          id: SECOND_REGION_ID,
          interpolation: 'linear' as const,
          timeSeconds: 0,
          value: 0.5,
        },
      ],
      target: { kind: 'trackVolume' as const },
    };
    controller.automation.setTrackAutomation({ automationLanes: [originalLane], trackId: TRACK_ID });
    commandHistory.clear();
    const firstSample = {
      id: PLUGIN_INSTANCE_ID,
      interpolation: 'linear' as const,
      timeSeconds: 1,
      value: 0.6,
    };
    const secondSample = {
      id: SECOND_PLUGIN_INSTANCE_ID,
      interpolation: 'linear' as const,
      timeSeconds: 2,
      value: 0.8,
    };
    const passRange = { endTimeSeconds: 2.5, startTimeSeconds: 0.5 };

    await commandExecutor.execute({
      laneId: REGION_ID,
      passRange,
      samples: [firstSample],
      trackId: TRACK_ID,
      type: AudioCommandType.PREVIEW_AUTOMATION_WRITE_PASS,
    });
    await commandExecutor.execute({
      laneId: REGION_ID,
      passRange,
      samples: [firstSample, secondSample],
      trackId: TRACK_ID,
      type: AudioCommandType.PREVIEW_AUTOMATION_WRITE_PASS,
    });
    expect(commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: false });

    await commandExecutor.execute({
      laneId: REGION_ID,
      passRange,
      samples: [firstSample, secondSample],
      trackId: TRACK_ID,
      type: AudioCommandType.COMMIT_AUTOMATION_WRITE_PASS,
    });
    expect(session.getState().tracks.get(TRACK_ID)?.automationLanes?.[0]?.points).toEqual([
      originalLane.points[0],
      firstSample,
      secondSample,
    ]);

    await commandExecutor.execute({ type: AudioCommandType.UNDO });
    expect(session.getState().tracks.get(TRACK_ID)?.automationLanes).toEqual([originalLane]);
    expect(commandHistory.getSnapshot()).toEqual({ canRedo: true, canUndo: false });
  });
});
