import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IObjectUrlAdapter } from '../audio-source-registry/i-object-url-adapter';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import { CommandExecutor } from '../commands/command-executor';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { PlaybackClockQuery } from '../queries/playback-clock-query';
import { MeterQuery } from '../queries/meter-query';
import { LiveInputQuery } from '../queries/live-input-query';
import { RecordingQuery } from '../queries/recording-query';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import { gainPluginManifest } from '../plugins/builtin/gain/gain-plugin-manifest';
import type { IProjectSyncService } from '../project-sync/i-project-sync';
import { AudioCommandType } from '../shared/types/audioCommand.schema';
import type { ProjectDocument } from '../shared/types/project-document.schema';
import { createApp, createCliTestApp, type CreateAppOptions } from './create-app';

function createTestAudioSourceRepository(): IAudioSourceRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function createTestApp(options: CreateAppOptions = {}) {
  return createApp({
    audioSourceRepository: createTestAudioSourceRepository(),
    projectRepository: new InMemoryProjectRepository(),
    ...options,
  });
}

describe('createApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Project Sync Factory에 동일한 Project·Audio Source Repository를 전달한다', () => {
    const audioSourceRepository = createTestAudioSourceRepository();
    const projectRepository = new InMemoryProjectRepository();
    const projectSync: IProjectSyncService = {
      activateProject: vi.fn(),
      ensureLocalProjectMedia: vi.fn(),
      notifyProjectChanged: vi.fn(),
      resume: vi.fn(),
    };
    const createProjectSync = vi.fn(() => projectSync);

    createApp({
      audioEngine: new MockAudioEngine(),
      audioSourceRepository,
      createProjectSync,
      projectRepository,
    });

    expect(createProjectSync).toHaveBeenCalledWith({
      audioSourceRepository,
      projectRepository,
      remoteProjectDocumentApplicator: expect.objectContaining({
        applyRemoteProjectDocument: expect.any(Function),
      }),
    });
  });

  it('초기 프로젝트를 활성화하고 로컬 commit 뒤 동기화를 요청한다', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const projectSync: IProjectSyncService = {
      activateProject: vi.fn(),
      ensureLocalProjectMedia: vi.fn(),
      notifyProjectChanged: vi.fn(),
      resume: vi.fn(),
    };
    const app = createTestApp({
      audioEngine: new MockAudioEngine(),
      initialProjectMetadata: { id: projectId, name: '동기화 테스트', revision: 0 },
      projectSync,
    });

    await app.commandExecutor.execute({
      type: AudioCommandType.ADD_TRACK,
      trackId: '22222222-2222-4222-8222-222222222222',
    });

    expect(projectSync.activateProject).toHaveBeenCalledWith(projectId);
    expect(projectSync.notifyProjectChanged).toHaveBeenCalledWith(projectId);
  });

  it('주입한 Source Registry를 등록·조회 전용 계약으로만 노출한다', () => {
    const objectUrlAdapter: IObjectUrlAdapter = {
      createObjectUrl: vi.fn(() => 'blob:test-source'),
      revokeObjectUrl: vi.fn(),
    };
    const audioSourceRegistry = new AudioSourceRegistry(objectUrlAdapter);

    const app = createTestApp({ audioEngine: new MockAudioEngine(), audioSourceRegistry });

    const registration = {
      metadata: {
        id: '11111111-1111-4111-8111-111111111111',
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 4,
        durationSeconds: 1,
      },
      blob: new Blob(['test'], { type: 'audio/wav' }),
    };
    const stagedSource = app.audioSourceStager.stage(registration);

    expect(app.audioSourceResolver.resolve(registration.metadata.id)).toEqual(stagedSource);
    expect('audioSourceRegistry' in app).toBe(false);
    expect('attach' in app.audioSourceStager).toBe(false);
    expect('beginReplacement' in app.audioSourceStager).toBe(false);
    expect('stage' in app.audioSourceResolver).toBe(false);
    expect('listCommittedRegistrations' in app.audioSourceResolver).toBe(false);
    expect('beginReplacement' in app.audioSourceResolver).toBe(false);
  });

  it('등록 capability와 Command Controller가 같은 Source Registry를 공유한다', async () => {
    const sourceId = '11111111-1111-4111-8111-111111111111';
    const trackId = '22222222-2222-4222-8222-222222222222';
    const regionId = '33333333-3333-4333-8333-333333333333';
    const objectUrlAdapter: IObjectUrlAdapter = {
      createObjectUrl: vi.fn(() => 'blob:shared-source'),
      revokeObjectUrl: vi.fn(),
    };
    const audioSourceRegistry = new AudioSourceRegistry(objectUrlAdapter);
    const app = createTestApp({ audioEngine: new MockAudioEngine(), audioSourceRegistry });

    app.audioSourceStager.stage({
      metadata: {
        id: sourceId,
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 4,
        durationSeconds: 1,
      },
      blob: new Blob(['test'], { type: 'audio/wav' }),
    });
    await app.commandExecutor.execute({
      type: AudioCommandType.ADD_TRACK,
      trackId,
    });
    await app.commandExecutor.execute({
      type: AudioCommandType.LOAD_REGION,
      trackId,
      regionId,
      sourceId,
      startTime: 0,
      duration: 1,
    });

    expect(app.audioSourceResolver.resolve(sourceId)).toMatchObject({
      isCommitted: true,
      objectUrl: 'blob:shared-source',
      regionIds: [regionId],
    });
    expect(app.session.getState().tracks.get(trackId)?.regions).toEqual([
      expect.objectContaining({ id: regionId, sourceId }),
    ]);
    expect(app.session.getState().tracks.get(trackId)?.regions[0]).not.toHaveProperty('audioFileUrl');
  });

  it('SAVE_PROJECT가 주입한 Source·Project Repository를 같은 저장 절차에서 사용한다', async () => {
    const sourceId = '11111111-1111-4111-8111-111111111111';
    const trackId = '22222222-2222-4222-8222-222222222222';
    const regionId = '33333333-3333-4333-8333-333333333333';
    const initialProjectMetadata = {
      id: '44444444-4444-4444-8444-444444444444',
      name: '저장 통합 테스트',
      revision: 0,
    };
    const audioSourceRegistry = new AudioSourceRegistry({
      createObjectUrl: () => 'blob:save-source',
      revokeObjectUrl: vi.fn(),
    });
    const audioSourceRepository = createTestAudioSourceRepository();
    const projectRepository = new InMemoryProjectRepository();
    const app = createTestApp({
      audioEngine: new MockAudioEngine(),
      audioSourceRegistry,
      audioSourceRepository,
      projectRepository,
      initialProjectMetadata,
    });
    const registration = {
      metadata: {
        id: sourceId,
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 4,
        durationSeconds: 1,
      },
      blob: new Blob(['test'], { type: 'audio/wav' }),
    };
    app.audioSourceStager.stage(registration);
    await app.commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId });
    await app.commandExecutor.execute({
      type: AudioCommandType.LOAD_REGION,
      trackId,
      regionId,
      sourceId,
      startTime: 0,
      duration: 1,
    });

    await app.commandExecutor.execute({ type: AudioCommandType.SAVE_PROJECT });

    expect(audioSourceRepository.create).toHaveBeenCalledWith({
      blob: registration.blob,
      metadata: expect.objectContaining(registration.metadata),
    });
    await expect(projectRepository.load(initialProjectMetadata.id)).resolves.toMatchObject({
      audioSources: [expect.objectContaining(registration.metadata)],
      tracks: [expect.objectContaining({ id: trackId })],
    });
    expect('projectRepository' in app).toBe(false);
    expect('audioSourceRepository' in app).toBe(false);
  });

  it('LOAD_PROJECT가 저장소의 문서를 Session·AudioEngine·Source Registry에 함께 반영한다', async () => {
    const projectId = '44444444-4444-4444-8444-444444444444';
    const sourceId = '11111111-1111-4111-8111-111111111111';
    const trackId = '22222222-2222-4222-8222-222222222222';
    const regionId = '33333333-3333-4333-8333-333333333333';
    const projectRepository = new InMemoryProjectRepository();
    const audioEngine = new MockAudioEngine();
    const audioSourceRepository = createTestAudioSourceRepository();
    const audioSourceRegistry = new AudioSourceRegistry({
      createObjectUrl: () => 'blob:loaded-source',
      revokeObjectUrl: vi.fn(),
    });
    const projectDocument: ProjectDocument = {
      documentType: 'drop-ai-project',
      schemaVersion: 1,
      project: { id: projectId, name: '불러오기 통합 테스트', revision: 0 },
      timeline: { timeUnit: 'seconds', tempoBpm: 128 },
      mixer: { masterVolume: 0.75 },
      exportRange: { startTimeSeconds: 1, endTimeSeconds: 3 },
      audioSources: [
        {
          id: sourceId,
          fileName: 'loaded.wav',
          mimeType: 'audio/wav',
          byteLength: 4,
          durationSeconds: 4,
        },
      ],
      tracks: [
        {
          id: trackId,
          name: '불러온 트랙',
          volume: 0.5,
          pan: -0.25,
          isMuted: true,
          isSoloed: false,
          regions: [
            {
              id: regionId,
              sourceId,
              startTimeSeconds: 1,
              sourceStartTimeSeconds: 0.5,
              durationSeconds: 2,
            },
          ],
        },
      ],
    };
    await projectRepository.create(projectDocument);
    vi.mocked(audioSourceRepository.load).mockResolvedValue(new Blob(['test'], { type: 'audio/wav' }));
    const projectSync: IProjectSyncService = {
      activateProject: vi.fn(),
      ensureLocalProjectMedia: vi.fn(),
      notifyProjectChanged: vi.fn(),
      resume: vi.fn(),
    };
    const app = createTestApp({
      audioEngine,
      audioSourceRegistry,
      audioSourceRepository,
      projectRepository,
      projectSync,
    });

    await app.commandExecutor.execute({ type: AudioCommandType.LOAD_PROJECT, projectId });

    expect(app.session.getState()).toMatchObject({
      project: projectDocument.project,
      tempo: 128,
      masterVolume: 0.75,
      exportStartTime: 1,
      exportEndTime: 3,
    });
    expect(app.session.getState().tracks.get(trackId)?.regions).toEqual([
      expect.objectContaining({ id: regionId, sourceId, startTime: 1, sourceStartTime: 0.5, duration: 2 }),
    ]);
    expect(audioEngine.getTrackParams(trackId)).toEqual({ volume: 0.5, pan: -0.25 });
    expect(app.audioSourceResolver.resolve(sourceId)).toMatchObject({
      isCommitted: true,
      objectUrl: 'blob:loaded-source',
      regionIds: [regionId],
    });
    await expect(app.projectCatalog.listProjects()).resolves.toEqual([
      expect.objectContaining({
        availability: 'local',
        localRevision: 0,
        projectId,
        name: '불러오기 통합 테스트',
      }),
    ]);
    expect('projectRepository' in app).toBe(false);
    expect('audioSourceRepository' in app).toBe(false);
    expect(projectSync.activateProject).toHaveBeenLastCalledWith(projectId);
  });

  it.each([
    ['명시한 대상 Track을 찾지 못하면', '22222222-2222-4222-8222-222222222222'],
    ['Track을 생략했고 Session이 비어 있으면', undefined],
  ] as const)('Command에서 %s staged Source를 정리한다', async (_scenario, requestedTrackId) => {
    const sourceId = '11111111-1111-4111-8111-111111111111';
    const regionId = '33333333-3333-4333-8333-333333333333';
    const revokeObjectUrl = vi.fn();
    const audioSourceRegistry = new AudioSourceRegistry({
      createObjectUrl: () => 'blob:pending-source',
      revokeObjectUrl,
    });
    const app = createTestApp({ audioEngine: new MockAudioEngine(), audioSourceRegistry });

    app.audioSourceStager.stage({
      metadata: {
        id: sourceId,
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 4,
        durationSeconds: 1,
      },
      blob: new Blob(['test'], { type: 'audio/wav' }),
    });

    await expect(
      app.commandExecutor.execute({
        type: AudioCommandType.LOAD_REGION,
        ...(requestedTrackId ? { trackId: requestedTrackId } : {}),
        regionId,
        sourceId,
        startTime: 0,
        duration: 1,
      })
    ).rejects.toMatchObject({ code: 'TRACK_NOT_FOUND' });

    expect(app.audioSourceResolver.resolve(sourceId)).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:pending-source');
  });

  it('기본 Source Registry 조립만으로 Object URL을 만들지 않는다', () => {
    const createObjectUrl = vi.spyOn(globalThis.URL, 'createObjectURL');

    createTestApp({ audioEngine: new MockAudioEngine() });

    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it('새 프로젝트 metadata를 UUID와 revision 0으로 만든다', () => {
    const app = createTestApp({ audioEngine: new MockAudioEngine() });

    expect(app.session.getState().project).toMatchObject({
      name: '새 프로젝트',
      revision: 0,
    });
    expect(app.session.getState().project.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('주입한 프로젝트 metadata로 Session을 조립한다', () => {
    const initialProjectMetadata = {
      id: '11111111-1111-4111-8111-111111111111',
      name: '불러온 프로젝트',
      revision: 4,
    };

    const app = createTestApp({ audioEngine: new MockAudioEngine(), initialProjectMetadata });

    expect(app.session.getState().project).toEqual(initialProjectMetadata);
  });

  it('하나의 CommandExecutor를 조립한다', () => {
    const app = createTestApp({ audioEngine: new MockAudioEngine() });

    expect(app.commandExecutor).toBeInstanceOf(CommandExecutor);
  });

  it('내장 Plugin manifest를 검증해 Session catalog에 요약만 공개한다', () => {
    const app = createTestApp({ audioEngine: new MockAudioEngine() });

    expect(app.session.getState().pluginCatalog.get('builtin.gain')).toEqual({
      category: 'utility',
      id: 'builtin.gain',
      name: 'Gain',
      version: '1.0.0',
      parameters: [
        {
          id: 'gain',
          name: 'Gain',
          type: 'number',
          minValue: 0,
          maxValue: 2,
          defaultValue: 1,
          step: 0.01,
        },
      ],
      presets: [
        { id: 'unity', name: 'Unity', parameterValues: { gain: 1 } },
        { id: 'boost-3db', name: '+3 dB', parameterValues: { gain: 1.4125 } },
        { id: 'cut-6db', name: '-6 dB', parameterValues: { gain: 0.5012 } },
      ],
      supportsSidechain: false,
    });
    expect(app.session.getState().pluginCatalog.get('builtin.gain')).not.toHaveProperty('dsp');
    expect(app.session.getState().pluginValidationResults.get('builtin.gain')).toEqual({
      manifestId: 'builtin.gain',
      status: 'valid',
      issues: [],
    });
    expect(app.session.getState().pluginCatalog.get('builtin.saturation')).toEqual({
      category: 'distortion',
      id: 'builtin.saturation',
      name: 'Saturation',
      version: '1.0.0',
      parameters: [
        {
          id: 'drive',
          name: 'Drive',
          type: 'number',
          minValue: 0,
          maxValue: 1,
          defaultValue: 0.2,
          step: 0.01,
        },
      ],
      presets: [
        { id: 'subtle', name: 'Subtle', parameterValues: { drive: 0.15 } },
        { id: 'warm', name: 'Warm', parameterValues: { drive: 0.4 } },
        { id: 'heavy', name: 'Heavy', parameterValues: { drive: 0.8 } },
      ],
      supportsSidechain: false,
    });
    expect(app.session.getState().pluginValidationResults.get('builtin.saturation')).toEqual({
      manifestId: 'builtin.saturation',
      status: 'valid',
      issues: [],
    });
  });

  it('runtime factory가 없는 metadata-only Plugin을 catalog에서 숨긴다', () => {
    const metadataOnlyManifest = {
      ...gainPluginManifest,
      id: 'external.metadata-only',
      name: 'Metadata Only',
    };
    const app = createTestApp({
      audioEngine: new MockAudioEngine(),
      initialPluginManifests: [gainPluginManifest, metadataOnlyManifest],
    });

    expect(app.session.getState().pluginCatalog.has('builtin.gain')).toBe(true);
    expect(app.session.getState().pluginCatalog.has('external.metadata-only')).toBe(false);
  });

  it('Saturation을 공통 Command 경로로 설치한다', async () => {
    const app = createTestApp({ audioEngine: new MockAudioEngine() });
    const trackId = '11111111-1111-4111-8111-111111111111';
    const instanceId = '22222222-2222-4222-8222-222222222222';

    await app.commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId });
    await app.commandExecutor.execute({
      type: AudioCommandType.INSTALL_PLUGIN,
      trackId,
      instanceId,
      manifestId: 'builtin.saturation',
    });

    expect(app.session.getState().tracks.get(trackId)?.pluginInstances).toEqual([
      {
        availability: 'available',
        id: instanceId,
        manifestSummary: { id: 'builtin.saturation', name: 'Saturation', version: '1.0.0' },
        isEnabled: true,
        parameters: [{ id: 'drive', value: 0.2 }],
        presetId: null,
        sidechainSourceTrackId: null,
        stateBlob: null,
      },
    ]);
  });

  it('PluginHost와 전체 manifest를 App capability로 노출하지 않는다', () => {
    const app = createTestApp({ audioEngine: new MockAudioEngine() });

    expect('pluginHost' in app).toBe(false);
    expect('pluginController' in app).toBe(false);
    expect('pluginManifests' in app).toBe(false);
  });

  it('Command History를 읽기 전용 capability로 노출한다', async () => {
    const app = createTestApp({ audioEngine: new MockAudioEngine() });

    await app.commandExecutor.execute({ type: AudioCommandType.SET_TEMPO, tempo: 140 });

    expect(app.commandHistory.getSnapshot()).toEqual({ canRedo: false, canUndo: true });
    expect('record' in app.commandHistory).toBe(false);
    expect('clear' in app.commandHistory).toBe(false);
    expect('undo' in app.commandHistory).toBe(false);
  });

  it('Controller를 노출하지 않고 읽기 전용 PlaybackClock을 조립한다', () => {
    const audioEngine = new MockAudioEngine();
    audioEngine.setTime(7.5);

    const app = createTestApp({ audioEngine });

    expect(app.playbackClock).toBeInstanceOf(PlaybackClockQuery);
    expect(app.playbackClock.getCurrentTime()).toBe(7.5);
    expect('controller' in app).toBe(false);
  });

  it('AudioEngine을 노출하지 않고 읽기 전용 MeterQuery를 조립한다', () => {
    const audioEngine = new MockAudioEngine();
    audioEngine.setMockMeterFrame(
      { kind: 'master' },
      { capturedAtSeconds: 2, channels: [{ isClipHeld: false, peakDbfs: -3, rmsDbfs: -9 }] }
    );

    const app = createTestApp({ audioEngine });

    expect(app.meter).toBeInstanceOf(MeterQuery);
    expect(app.meter.read({ kind: 'master' })).toMatchObject({ capturedAtSeconds: 2 });
    expect('audioEngine' in app).toBe(false);
  });

  it('입력 장치와 monitoring 상태를 읽기 전용 LiveInputQuery로 조립한다', async () => {
    const audioEngine = new MockAudioEngine();
    audioEngine.setMockLiveInputDevices([{ deviceId: 'mic-1', label: 'Mic' }]);

    const app = createTestApp({ audioEngine });

    expect(app.liveInput).toBeInstanceOf(LiveInputQuery);
    await expect(app.liveInput.listDevices()).resolves.toEqual([{ deviceId: 'mic-1', label: 'Mic' }]);
    expect(app.liveInput.readState()).toEqual({ deviceId: null, monitoringTrackId: null });
  });

  it('Track arm과 녹음 상태를 저장 문서와 분리한 RecordingQuery로 조립한다', () => {
    const app = createTestApp({ audioEngine: new MockAudioEngine() });

    expect(app.recording).toBeInstanceOf(RecordingQuery);
    expect(app.recording.readState()).toEqual({
      armedTrackIds: [],
      inputRoutes: [],
      phase: 'idle',
      recordStartTimeSeconds: null,
    });
  });

  it('CLI 테스트용 AudioEngine도 Composition Root에서 조립한다', async () => {
    const app = createCliTestApp();

    await app.commandExecutor.execute({ type: AudioCommandType.PLAY });

    expect(app.session.getState().isPlaying).toBe(true);
  });

  it('브라우저 오디오 환경을 읽기 전용 capability로 조립한다', () => {
    const app = createTestApp({
      audioEngine: new MockAudioEngine(),
      audioRuntimeEnvironment: {
        crossOriginIsolated: false,
        hasAudioWorklet: true,
        hasGetUserMedia: true,
        hasMediaDevices: true,
        hasSharedArrayBuffer: false,
        hasWebAssembly: true,
        isSecureContext: true,
      },
    });

    expect(app.audioRuntimeCapabilities).toMatchObject({
      meetsAudioWorkletPreconditions: true,
      meetsLiveInputPreconditions: true,
      meetsSharedMemoryPreconditions: false,
      meetsWasmPreconditions: true,
    });
  });
});
