import { describe, expect, it, vi } from 'vitest';
import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES } from '../audio-engine/errors';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import { AudioSourceRepositoryError } from '../audio-source-repository/errors';
import type { IProjectRepository } from '../project-repository/i-project-repository';
import { ProjectRepositoryError } from '../project-repository/errors';
import {
  createProjectDocumentV3FromSession,
  createProjectDocumentV7FromSession,
} from '../project-document-mapper/project-document-mapper';
import { gainPluginManifest } from '../plugins/builtin/gain/gain-plugin-manifest';
import type { IProjectSyncService } from '../project-sync/i-project-sync';
import { createSessionStore, type SessionState } from '../session/session';
import type {
  ProjectAudioSource,
  ProjectDocument,
  ProjectDocumentSnapshot,
  ProjectDocumentV2,
  ProjectDocumentV3,
} from '../shared/types/project-document.schema';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';
import { ProjectController } from './project-controller';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_SOURCE_ID = '33333333-3333-4333-8333-333333333333';
const LOADED_PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const TRACK_ID = '55555555-5555-4555-8555-555555555555';
const REGION_ID = '66666666-6666-4666-8666-666666666666';
const PLUGIN_INSTANCE_ID = '77777777-7777-4777-8777-777777777777';
const LOOP_SLOT_ID = '88888888-8888-4888-8888-888888888888';
const INITIAL_PROJECT_METADATA = {
  id: PROJECT_ID,
  name: '테스트 프로젝트',
  revision: 0,
};

function createSourceRegistration(sourceId = SOURCE_ID) {
  const blob = new Blob(['test'], { type: 'audio/wav' });
  const metadata: ProjectAudioSource = {
    id: sourceId,
    fileName: 'source.wav',
    mimeType: blob.type,
    byteLength: blob.size,
    durationSeconds: 1,
  };

  return { metadata, blob };
}

function createTestContext(projectSync?: IProjectSyncService) {
  const sessionStore = createSessionStore({ initialProjectMetadata: INITIAL_PROJECT_METADATA });
  sessionStore.getState().replacePluginCatalogState({ manifests: [gainPluginManifest], validationResults: [] });
  const audioEngine = new MockAudioEngine();
  const revokeObjectUrl = vi.fn();
  let objectUrlSequence = 0;
  const audioSourceRegistry = new AudioSourceRegistry({
    createObjectUrl: () => `blob:project-source-${(objectUrlSequence += 1)}`,
    revokeObjectUrl,
  });
  const audioSourceRepository = {
    create: vi.fn<IAudioSourceRepository['create']>().mockResolvedValue(undefined),
    load: vi.fn<IAudioSourceRepository['load']>().mockResolvedValue(null),
    delete: vi.fn<IAudioSourceRepository['delete']>().mockResolvedValue(undefined),
  } satisfies IAudioSourceRepository;
  const projectRepository = {
    create: vi.fn<IProjectRepository['create']>().mockImplementation(async document => document),
    save: vi.fn<IProjectRepository['save']>().mockImplementation(async ({ document, expectedRevision }) => ({
      ...document,
      project: { ...document.project, revision: expectedRevision + 1 },
    })),
    load: vi.fn<IProjectRepository['load']>().mockResolvedValue(null),
    list: vi.fn<IProjectRepository['list']>().mockResolvedValue([]),
    delete: vi.fn<IProjectRepository['delete']>().mockResolvedValue(undefined),
  } satisfies IProjectRepository;
  const controller = new ProjectController({
    sessionStore,
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    projectRepository,
    projectSync,
  });

  return {
    audioEngine,
    audioSourceRegistry,
    audioSourceRepository,
    controller,
    projectRepository,
    revokeObjectUrl,
    sessionStore,
  };
}

function createCurrentDocument(
  sessionStore: ReturnType<typeof createSessionStore>,
  audioSources: ProjectAudioSource[] = []
): ProjectDocumentV3 {
  const sessionState = sessionStore.getState();
  return createProjectDocumentV3FromSession({
    session: sessionState,
    audioSources,
    pluginCatalog: [...sessionState.pluginCatalog.values()],
  });
}

function createLoadedDocument({
  projectId = LOADED_PROJECT_ID,
  audioSources = [createSourceRegistration().metadata],
}: {
  readonly projectId?: string;
  readonly audioSources?: ProjectAudioSource[];
} = {}): ProjectDocument {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: 1,
    project: { id: projectId, name: '불러온 프로젝트', revision: 3 },
    timeline: { timeUnit: 'seconds', tempoBpm: 140 },
    mixer: { masterVolume: 0.75 },
    exportRange: { startTimeSeconds: 1, endTimeSeconds: 4 },
    audioSources,
    tracks: [
      {
        id: TRACK_ID,
        name: '보컬',
        volume: 0.8,
        pan: -0.25,
        isMuted: false,
        isSoloed: true,
        regions: [
          {
            id: REGION_ID,
            sourceId: SOURCE_ID,
            startTimeSeconds: 1,
            sourceStartTimeSeconds: 0,
            durationSeconds: 1,
          },
        ],
      },
    ],
  };
}

function createLoadedDocumentV2(isEnabled = true): ProjectDocumentV2 {
  const document = createLoadedDocument();

  return {
    ...document,
    schemaVersion: 2,
    tracks: document.tracks.map(track => ({
      ...track,
      pluginInstances: [
        {
          id: PLUGIN_INSTANCE_ID,
          manifestId: gainPluginManifest.id,
          manifestVersion: gainPluginManifest.version,
          isEnabled,
          parameters: [{ id: gainPluginManifest.parameters[0].id, value: 0.75 }],
        },
      ],
    })),
  };
}

function createLoadedDocumentV3(): ProjectDocumentV3 {
  const document = createLoadedDocumentV2();

  return {
    ...document,
    schemaVersion: 3,
    tracks: document.tracks.map(track => ({
      ...track,
      loopSlots: [
        {
          gain: 1,
          id: LOOP_SLOT_ID,
          lengthBars: 1,
          quantizationBars: 1,
          recordedTempoBpm: 140,
          sourceId: SOURCE_ID,
        },
      ],
    })),
  };
}

function addPluginTrack(session: SessionState): void {
  session.addTrack({
    id: TRACK_ID,
    name: 'Plugin Track',
    volume: 1,
    pan: 0,
    isMuted: false,
    isSoloed: false,
    status: [],
    pluginInstances: [
      {
        id: PLUGIN_INSTANCE_ID,
        manifestSummary: {
          id: gainPluginManifest.id,
          name: gainPluginManifest.name,
          version: gainPluginManifest.version,
        },
        isEnabled: true,
        parameters: [{ id: gainPluginManifest.parameters[0].id, value: 0.75 }],
      },
    ],
    regions: [],
  });
}

function createDeferred<Value>(): {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
} {
  let resolvePromise!: (value: Value) => void;
  const promise = new Promise<Value>(resolve => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe('ProjectController', () => {
  it('새 프로젝트는 Source를 먼저 보존한 뒤 문서를 생성하고 반환 metadata를 반영한다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    context.audioSourceRegistry.restoreCommitted(registration);
    const replaceProjectMetadata = vi.spyOn(context.sessionStore.getState(), 'replaceProjectMetadata');

    await context.controller.saveProject();

    expect(context.audioSourceRepository.load).toHaveBeenCalledWith(registration.metadata);
    expect(context.audioSourceRepository.create).toHaveBeenCalledWith(registration);
    expect(context.projectRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 13,
        project: INITIAL_PROJECT_METADATA,
        audioSources: [registration.metadata],
      })
    );
    expect(context.audioSourceRepository.create.mock.invocationCallOrder[0]).toBeLessThan(
      context.projectRepository.load.mock.invocationCallOrder[0]
    );
    expect(context.audioSourceRepository.create.mock.invocationCallOrder[0]).toBeLessThan(
      context.projectRepository.create.mock.invocationCallOrder[0]
    );
    expect(replaceProjectMetadata).toHaveBeenCalledWith(INITIAL_PROJECT_METADATA);
  });

  it('Session Plugin 체인을 최신 ProjectDocument에 저장한다', async () => {
    const context = createTestContext();
    addPluginTrack(context.sessionStore.getState());

    await context.controller.saveProject();

    expect(context.projectRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 13,
        tracks: [
          expect.objectContaining({
            id: TRACK_ID,
            pluginInstances: [
              {
                id: PLUGIN_INSTANCE_ID,
                manifestId: gainPluginManifest.id,
                manifestVersion: gainPluginManifest.version,
                isEnabled: true,
                parameters: [{ id: gainPluginManifest.parameters[0].id, value: 0.75 }],
              },
            ],
          }),
        ],
      })
    );
  });

  it('루프 슬롯과 연결 Source를 최신 ProjectDocument에 저장한다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    context.audioSourceRegistry.restoreCommitted(registration);
    context.audioSourceRegistry.attachLoopSlot({ loopSlotId: LOOP_SLOT_ID, sourceId: SOURCE_ID });
    context.sessionStore.getState().addTrack({
      id: TRACK_ID,
      isMuted: false,
      isSoloed: false,
      loopSlots: [
        {
          errorMessage: null,
          gain: 1,
          id: LOOP_SLOT_ID,
          lengthBars: 1,
          overdubSourceIds: [],
          quantizationBars: 1,
          recordedTempoBpm: 120,
          scheduledTimeSeconds: null,
          sourceId: SOURCE_ID,
          state: 'stopped',
        },
      ],
      name: 'Loop Track',
      pan: 0,
      pluginInstances: [],
      regions: [],
      status: [],
      volume: 1,
    });

    await context.controller.saveProject();

    expect(context.projectRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audioSources: [registration.metadata],
        schemaVersion: 13,
        tracks: [
          expect.objectContaining({
            loopSlots: [expect.objectContaining({ id: LOOP_SLOT_ID, overdubSourceIds: [], sourceId: SOURCE_ID })],
          }),
        ],
      })
    );
  });

  it('저장된 revision 0 프로젝트는 create가 아니라 save로 교체하고 revision 1을 반영한다', async () => {
    const context = createTestContext();
    const existingDocument = createCurrentDocument(context.sessionStore);
    context.projectRepository.load.mockResolvedValue(existingDocument);

    await context.controller.saveProject();

    expect(context.projectRepository.create).not.toHaveBeenCalled();
    expect(context.projectRepository.save).toHaveBeenCalledWith({
      document: expect.objectContaining({
        project: existingDocument.project,
        schemaVersion: 13,
      }),
      expectedRevision: 0,
    });
    expect(context.sessionStore.getState().project.revision).toBe(1);
  });

  it('이미 저장된 Source는 load로 검증하고 다시 만들지 않는다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    context.audioSourceRegistry.restoreCommitted(registration);
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);

    await context.controller.saveProject();

    expect(context.audioSourceRepository.load).toHaveBeenCalledWith(registration.metadata);
    expect(context.audioSourceRepository.create).not.toHaveBeenCalled();
    expect(context.projectRepository.create).toHaveBeenCalledTimes(1);
  });

  it('동시 생성으로 Source가 먼저 생기면 다시 load로 검증한 뒤 문서를 저장한다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    context.audioSourceRegistry.restoreCommitted(registration);
    context.audioSourceRepository.load.mockResolvedValueOnce(null).mockResolvedValueOnce(registration.blob);
    context.audioSourceRepository.create.mockRejectedValueOnce(
      new AudioSourceRepositoryError({
        code: 'SOURCE_ALREADY_EXISTS',
        message: '동시에 저장됨',
      })
    );

    await context.controller.saveProject();

    expect(context.audioSourceRepository.load).toHaveBeenCalledTimes(2);
    expect(context.projectRepository.create).toHaveBeenCalledTimes(1);
  });

  it('Session을 문서로 변환할 수 없으면 저장소를 호출하지 않는다', async () => {
    const context = createTestContext();
    context.sessionStore.getState().setExportRange(0, null);

    await expect(context.controller.saveProject()).rejects.toMatchObject({
      code: 'INVALID_SESSION_PROJECT_STATE',
    });

    expect(context.audioSourceRepository.load).not.toHaveBeenCalled();
    expect(context.projectRepository.load).not.toHaveBeenCalled();
    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('pending Source는 저장 대상과 ProjectDocument에서 제외한다', async () => {
    const context = createTestContext();
    context.audioSourceRegistry.stage(createSourceRegistration());

    await context.controller.saveProject();

    expect(context.audioSourceRepository.load).not.toHaveBeenCalled();
    expect(context.projectRepository.create).toHaveBeenCalledWith(expect.objectContaining({ audioSources: [] }));
  });

  it('Source 저장이 실패하면 ProjectDocument를 공개하지 않고 Session metadata를 유지한다', async () => {
    const context = createTestContext();
    context.audioSourceRegistry.restoreCommitted(createSourceRegistration());
    const sourceError = new AudioSourceRepositoryError({
      code: 'STORAGE_OPERATION_FAILED',
      message: 'Source 저장 실패',
    });
    context.audioSourceRepository.create.mockRejectedValueOnce(sourceError);

    await expect(context.controller.saveProject()).rejects.toBe(sourceError);

    expect(context.projectRepository.load).not.toHaveBeenCalled();
    expect(context.projectRepository.create).not.toHaveBeenCalled();
    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('여러 Source 중 하나가 실패해도 먼저 만든 Source를 자동 삭제하지 않는다', async () => {
    const context = createTestContext();
    context.audioSourceRegistry.restoreCommitted(createSourceRegistration());
    context.audioSourceRegistry.restoreCommitted(createSourceRegistration(SECOND_SOURCE_ID));
    const sourceError = new AudioSourceRepositoryError({
      code: 'STORAGE_OPERATION_FAILED',
      message: '두 번째 Source 저장 실패',
    });
    context.audioSourceRepository.create.mockImplementation(async ({ metadata }) => {
      if (metadata.id === SECOND_SOURCE_ID) {
        throw sourceError;
      }
    });

    await expect(context.controller.saveProject()).rejects.toBe(sourceError);

    expect(context.audioSourceRepository.create).toHaveBeenCalledTimes(2);
    expect(context.audioSourceRepository.delete).not.toHaveBeenCalled();
    expect(context.projectRepository.load).not.toHaveBeenCalled();
  });

  it('ProjectDocument 저장이 실패하면 성공 revision을 추측하지 않는다', async () => {
    const context = createTestContext();
    const projectError = new ProjectRepositoryError({
      code: 'STORAGE_OPERATION_FAILED',
      message: '프로젝트 저장 실패',
    });
    context.projectRepository.create.mockRejectedValueOnce(projectError);

    await expect(context.controller.saveProject()).rejects.toBe(projectError);

    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('revision 충돌을 그대로 전달하고 Session metadata를 유지한다', async () => {
    const context = createTestContext();
    context.projectRepository.load.mockResolvedValue(createCurrentDocument(context.sessionStore));
    const revisionConflict = new ProjectRepositoryError({
      code: 'REVISION_CONFLICT',
      message: '다른 탭에서 먼저 저장했습니다.',
    });
    context.projectRepository.save.mockRejectedValueOnce(revisionConflict);

    await expect(context.controller.saveProject()).rejects.toBe(revisionConflict);

    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('저장된 Source·AudioEngine·Session을 모두 준비한 뒤 프로젝트를 교체한다', async () => {
    const context = createTestContext();
    const document = createLoadedDocument();
    const registration = createSourceRegistration();
    const oldRegistration = createSourceRegistration(SECOND_SOURCE_ID);
    context.projectRepository.load.mockResolvedValue(document);
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);
    context.audioSourceRegistry.restoreCommitted(oldRegistration);
    await context.audioEngine.addTrack('old-track');
    context.sessionStore.getState().setPlaying(true);
    context.sessionStore.getState().setCurrentTime(9);
    context.sessionStore.getState().addAgentMessage({
      id: 'message-1',
      role: 'user',
      content: '계속 유지',
      timestamp: 1,
    });
    context.revokeObjectUrl.mockImplementation(() => {
      expect(context.sessionStore.getState().project.id).toBe(LOADED_PROJECT_ID);
    });

    await context.controller.loadProject(LOADED_PROJECT_ID);

    const session = context.sessionStore.getState();
    expect(session.project).toEqual(document.project);
    expect(session.tempo).toBe(140);
    expect(session.masterVolume).toBe(0.75);
    expect(session.exportStartTime).toBe(1);
    expect(session.exportEndTime).toBe(4);
    expect(session.currentTime).toBe(0);
    expect(session.isPlaying).toBe(false);
    expect(session.agentMessages).toHaveLength(1);
    expect(session.tracks.get(TRACK_ID)?.regions[0]).toMatchObject({
      id: REGION_ID,
      sourceId: SOURCE_ID,
      startTime: 1,
      endTime: 2,
    });
    expect(context.audioEngine.getTrackParams('old-track')).toBeNull();
    expect(context.audioEngine.getTrackParams(TRACK_ID)).toEqual({ volume: 0.8, pan: -0.25 });
    expect(context.audioSourceRegistry.resolve(SECOND_SOURCE_ID)).toBeNull();
    expect(context.audioSourceRegistry.resolve(SOURCE_ID)).toMatchObject({
      isCommitted: true,
      regionIds: [REGION_ID],
    });
    expect(context.revokeObjectUrl).toHaveBeenCalledTimes(1);
  });

  it('프로젝트를 불러오기 전에 누락된 원격 미디어를 로컬 저장소에 준비한다', async () => {
    const events: string[] = [];
    const projectSync: IProjectSyncService = {
      activateProject: vi.fn(),
      ensureLocalProject: vi.fn(),
      ensureLocalProjectMedia: vi.fn(async () => {
        events.push('media-download');
      }),
      listRemoteProjects: vi.fn(),
      notifyProjectChanged: vi.fn(),
      resume: vi.fn(),
    };
    const context = createTestContext(projectSync);
    const document = createLoadedDocument();
    const registration = createSourceRegistration();
    context.projectRepository.load.mockResolvedValue(document);
    context.audioSourceRepository.load.mockImplementation(async () => {
      events.push('source-load');
      return registration.blob;
    });

    await context.controller.loadProject(LOADED_PROJECT_ID);

    expect(events).toEqual(['media-download', 'source-load']);
    expect(projectSync.ensureLocalProjectMedia).toHaveBeenCalledWith(document);
  });

  it('v7 프로젝트의 Tempo·Loop·Metronome을 runtime과 Session에 복원한다', async () => {
    const context = createTestContext();
    const sourceSession = createSessionStore({
      initialProjectMetadata: { id: LOADED_PROJECT_ID, name: 'Transport 프로젝트', revision: 3 },
    });
    sourceSession.getState().setTimelineMap({
      tempoChanges: [
        { bpm: 120, quarterNotePosition: 0 },
        { bpm: 90, quarterNotePosition: 4 },
      ],
      meterChanges: [{ beatUnit: 4, beatsPerBar: 4, quarterNotePosition: 0 }],
    });
    sourceSession.getState().setLoopState({ range: { endTimeSeconds: 8, startTimeSeconds: 2 }, isEnabled: true });
    sourceSession.getState().setMetronomeState({ isEnabled: true, volume: 0.5 });
    const document = createProjectDocumentV7FromSession({
      audioSources: [],
      pluginCatalog: [],
      session: sourceSession.getState(),
    });
    context.projectRepository.load.mockResolvedValue(document);

    await context.controller.loadProject(LOADED_PROJECT_ID);

    expect(context.audioEngine.getMockTransportState()).toMatchObject({
      isLoopEnabled: true,
      isMetronomeEnabled: true,
      loopRange: { endTimeSeconds: 8, startTimeSeconds: 2 },
      metronomeVolume: 0.5,
      tempoChanges: document.timeline.tempoChanges,
    });
    expect(context.sessionStore.getState()).toMatchObject({
      isLoopEnabled: true,
      isMetronomeEnabled: true,
      loopRange: { endTimeSeconds: 8, startTimeSeconds: 2 },
      metronomeVolume: 0.5,
    });
  });

  it('로컬 문서가 없으면 원격 프로젝트를 복원한 뒤 불러온다', async () => {
    const document = createLoadedDocument();
    const registration = createSourceRegistration();
    const ensureLocalProject = vi.fn().mockResolvedValue(true);
    const projectSync: IProjectSyncService = {
      activateProject: vi.fn(),
      ensureLocalProject,
      ensureLocalProjectMedia: vi.fn(),
      listRemoteProjects: vi.fn(),
      notifyProjectChanged: vi.fn(),
      resume: vi.fn(),
    };
    const context = createTestContext(projectSync);
    context.projectRepository.load.mockResolvedValueOnce(null).mockResolvedValue(document);
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);

    await context.controller.loadProject(LOADED_PROJECT_ID);

    expect(ensureLocalProject).toHaveBeenCalledWith(LOADED_PROJECT_ID);
    expect(context.projectRepository.load).toHaveBeenCalledTimes(2);
    expect(context.sessionStore.getState().project).toEqual(document.project);
  });

  it('원격 문서를 현재 Session과 AudioEngine에 준비 후 교체한다', async () => {
    const context = createTestContext();
    const document = createLoadedDocument({ projectId: PROJECT_ID });
    const registration = createSourceRegistration();
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);

    const applied = await context.controller.applyRemoteProjectDocument(document);

    expect(applied).toBe(true);
    expect(context.projectRepository.load).not.toHaveBeenCalled();
    expect(context.sessionStore.getState().tracks.get(TRACK_ID)?.name).toBe('보컬');
    expect(context.audioEngine.getTrackParams(TRACK_ID)).toEqual({ volume: 0.8, pan: -0.25 });
  });

  it('원격 Runtime 준비 중 현재 Session이 바뀌면 준비 대상을 폐기하고 교체하지 않는다', async () => {
    const context = createTestContext();
    const document = createLoadedDocument({ projectId: PROJECT_ID });
    const sourceLoad = createDeferred<Blob | null>();
    context.audioSourceRepository.load.mockReturnValue(sourceLoad.promise);

    const applyRemoteDocument = context.controller.applyRemoteProjectDocument(document);
    await vi.waitFor(() => expect(context.audioSourceRepository.load).toHaveBeenCalledOnce());
    context.sessionStore.getState().setTempo(130);
    sourceLoad.resolve(createSourceRegistration().blob);

    await expect(applyRemoteDocument).resolves.toBe(false);
    expect(context.sessionStore.getState().tempo).toBe(130);
    expect(context.sessionStore.getState().tracks.size).toBe(0);
    expect(context.audioEngine.getTrackParams(TRACK_ID)).toBeNull();
    expect(context.revokeObjectUrl).toHaveBeenCalledWith('blob:project-source-1');
  });

  it('v2 Plugin 체인을 Session과 AudioEngine 준비 요청에 복원한다', async () => {
    const context = createTestContext();
    const document = createLoadedDocumentV2();
    const registration = createSourceRegistration();
    context.projectRepository.load.mockResolvedValue(document);
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);
    const prepareProjectGraph = vi.spyOn(context.audioEngine, 'prepareProjectGraph');

    await context.controller.loadProject(LOADED_PROJECT_ID);

    expect(context.sessionStore.getState().tracks.get(TRACK_ID)?.pluginInstances).toEqual([
      {
        id: PLUGIN_INSTANCE_ID,
        manifestSummary: {
          id: gainPluginManifest.id,
          name: gainPluginManifest.name,
          version: gainPluginManifest.version,
        },
        isEnabled: true,
        parameters: [{ id: gainPluginManifest.parameters[0].id, value: 0.75 }],
      },
    ]);
    expect(prepareProjectGraph).toHaveBeenCalledWith({
      masterVolume: 0.75,
      routingGraph: {
        routes: [
          {
            channelCount: 2,
            folderId: null,
            kind: 'audio',
            output: { kind: 'master' },
            trackId: TRACK_ID,
            vcaIds: [],
          },
        ],
        sends: [],
      },
      tracks: [
        expect.objectContaining({
          id: TRACK_ID,
          pluginInstances: [
            {
              instanceId: PLUGIN_INSTANCE_ID,
              manifestId: gainPluginManifest.id,
              isEnabled: true,
              parameterValues: new Map([[gainPluginManifest.parameters[0].id, 0.75]]),
            },
          ],
        }),
      ],
    });
  });

  it('v3 루프 슬롯을 Source Registry와 AudioEngine 준비 요청에 복원한다', async () => {
    const context = createTestContext();
    const document = createLoadedDocumentV3();
    const registration = createSourceRegistration();
    context.projectRepository.load.mockResolvedValue(document);
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);
    const prepareProjectGraph = vi.spyOn(context.audioEngine, 'prepareProjectGraph');

    await context.controller.loadProject(LOADED_PROJECT_ID);

    expect(context.sessionStore.getState().tracks.get(TRACK_ID)?.loopSlots).toEqual([
      {
        errorMessage: null,
        gain: 1,
        id: LOOP_SLOT_ID,
        lengthBars: 1,
        overdubSourceIds: [],
        quantizationBars: 1,
        recordedTempoBpm: 140,
        scheduledTimeSeconds: null,
        sourceId: SOURCE_ID,
        state: 'stopped',
      },
    ]);
    expect(context.audioSourceRegistry.resolve(SOURCE_ID)?.loopSlotIds).toEqual([LOOP_SLOT_ID]);
    expect(prepareProjectGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            loops: [{ slotId: LOOP_SLOT_ID, url: 'blob:project-source-1' }],
          }),
        ],
      })
    );
  });

  it('v2의 비활성 Plugin 상태를 Session과 AudioEngine에 복원한다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    context.projectRepository.load.mockResolvedValue(createLoadedDocumentV2(false));
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);

    await context.controller.loadProject(LOADED_PROJECT_ID);

    expect(context.sessionStore.getState().tracks.get(TRACK_ID)?.pluginInstances[0]?.isEnabled).toBe(false);
    expect(() =>
      context.audioEngine.setPluginEnabled({ trackId: TRACK_ID, instanceId: PLUGIN_INSTANCE_ID, isEnabled: true })
    ).not.toThrow();
  });

  it('두 prepared 대상을 먼저 검사하고 Engine→Registry→Session 순서로 교체한다', async () => {
    const context = createTestContext();
    const events: string[] = [];
    const registration = createSourceRegistration();
    context.projectRepository.load.mockResolvedValue(createLoadedDocument());
    context.audioSourceRepository.load.mockImplementation(async () => {
      events.push('source-load');
      return registration.blob;
    });

    const originalBeginReplacement = context.audioSourceRegistry.beginReplacement.bind(context.audioSourceRegistry);
    vi.spyOn(context.audioSourceRegistry, 'beginReplacement').mockImplementation(() => {
      events.push('registry-begin');
      const prepared = originalBeginReplacement();
      return {
        restoreCommitted: value => prepared.restoreCommitted(value),
        attach: value => prepared.attach(value),
        attachLoopSlot: value => prepared.attachLoopSlot(value),
        resolve: sourceId => prepared.resolve(sourceId),
        listCommittedMetadata: () => prepared.listCommittedMetadata(),
        assertActivatable: () => {
          events.push('registry-assert');
          prepared.assertActivatable();
        },
        activate: () => {
          events.push('registry-activate');
          const retired = prepared.activate();
          return {
            dispose: () => {
              events.push('registry-dispose');
              return retired.dispose();
            },
          };
        },
        discard: () => prepared.discard(),
      };
    });

    const originalPrepareProjectGraph = context.audioEngine.prepareProjectGraph.bind(context.audioEngine);
    vi.spyOn(context.audioEngine, 'prepareProjectGraph').mockImplementation(async request => {
      events.push('engine-prepare');
      const prepared = await originalPrepareProjectGraph(request);
      return {
        assertActivatable: () => {
          events.push('engine-assert');
          prepared.assertActivatable();
        },
        activate: () => {
          events.push('engine-activate');
          const retired = prepared.activate();
          return {
            dispose: () => {
              events.push('engine-dispose');
              return retired.dispose();
            },
          };
        },
        discard: () => prepared.discard(),
      };
    });
    const replaceProjectState = context.sessionStore.getState().replaceProjectState;
    vi.spyOn(context.sessionStore.getState(), 'replaceProjectState').mockImplementation(projectState => {
      events.push('session-replace');
      replaceProjectState(projectState);
    });

    await context.controller.loadProject(LOADED_PROJECT_ID);

    expect(events).toEqual([
      'registry-begin',
      'source-load',
      'engine-prepare',
      'registry-assert',
      'engine-assert',
      'engine-activate',
      'registry-activate',
      'session-replace',
      'engine-dispose',
      'registry-dispose',
    ]);
  });

  it('프로젝트를 찾지 못하면 기존 Runtime을 유지한다', async () => {
    const context = createTestContext();
    await context.audioEngine.addTrack('old-track');

    await expect(context.controller.loadProject(LOADED_PROJECT_ID)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });

    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
    expect(context.audioEngine.getTrackParams('old-track')).not.toBeNull();
    expect(context.audioSourceRepository.load).not.toHaveBeenCalled();
  });

  it('요청 ID와 문서 Project ID가 다르면 교체를 거부한다', async () => {
    const context = createTestContext();
    context.projectRepository.load.mockResolvedValue(createLoadedDocument({ projectId: PROJECT_ID }));

    await expect(context.controller.loadProject(LOADED_PROJECT_ID)).rejects.toMatchObject({
      code: 'PROJECT_ID_MISMATCH',
      details: { actualProjectId: PROJECT_ID, requestedProjectId: LOADED_PROJECT_ID },
    });

    expect(context.audioSourceRepository.load).not.toHaveBeenCalled();
    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('저장된 Source Blob을 찾지 못하면 준비한 Registry만 폐기한다', async () => {
    const context = createTestContext();
    context.projectRepository.load.mockResolvedValue(createLoadedDocument());
    await context.audioEngine.addTrack('old-track');

    await expect(context.controller.loadProject(LOADED_PROJECT_ID)).rejects.toMatchObject({
      code: 'AUDIO_SOURCE_NOT_FOUND',
      details: { sourceId: SOURCE_ID },
    });

    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
    expect(context.audioEngine.getTrackParams('old-track')).not.toBeNull();
    expect(context.audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
  });

  it('오디오 그래프 준비가 실패하면 준비한 Object URL을 해제한다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    const prepareError = new AudioEngineError(AudioEngineErrorCode.TRACK_INIT_FAILED, ERROR_MESSAGES.TRACK_INIT_FAILED);
    context.projectRepository.load.mockResolvedValue(createLoadedDocument());
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);
    vi.spyOn(context.audioEngine, 'prepareProjectGraph').mockRejectedValueOnce(prepareError);

    await expect(context.controller.loadProject(LOADED_PROJECT_ID)).rejects.toBe(prepareError);

    expect(context.revokeObjectUrl).toHaveBeenCalledWith('blob:project-source-1');
    expect(context.audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('오디오 그래프 활성화가 실패하면 prepared 그래프와 Registry를 모두 폐기한다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    const activationError = new AudioEngineError(
      AudioEngineErrorCode.PROJECT_GRAPH_ACTIVATION_FAILED,
      ERROR_MESSAGES.PROJECT_GRAPH_ACTIVATION_FAILED
    );
    const discardAudioGraph = vi.fn().mockReturnValue({ isComplete: true, failedResourceCount: 0 });
    context.projectRepository.load.mockResolvedValue(createLoadedDocument());
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);
    vi.spyOn(context.audioEngine, 'prepareProjectGraph').mockResolvedValueOnce({
      assertActivatable: vi.fn(),
      activate: vi.fn(() => {
        throw activationError;
      }),
      discard: discardAudioGraph,
    });

    await expect(context.controller.loadProject(LOADED_PROJECT_ID)).rejects.toBe(activationError);

    expect(discardAudioGraph).toHaveBeenCalledTimes(1);
    expect(context.revokeObjectUrl).toHaveBeenCalledWith('blob:project-source-1');
    expect(context.audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('준비 중 active Registry가 변경되면 새 pending Source와 기존 Runtime을 유지한다', async () => {
    const context = createTestContext();
    const deferredDocument = createDeferred<ProjectDocumentSnapshot | null>();
    const loadedRegistration = createSourceRegistration();
    const stagedRegistration = createSourceRegistration(SECOND_SOURCE_ID);
    context.projectRepository.load.mockReturnValueOnce(deferredDocument.promise);
    context.audioSourceRepository.load.mockResolvedValue(loadedRegistration.blob);
    await context.audioEngine.addTrack('old-track');

    const loadExecution = context.controller.loadProject(LOADED_PROJECT_ID);
    context.audioSourceRegistry.stage(stagedRegistration);
    deferredDocument.resolve(createLoadedDocument());

    await expect(loadExecution).rejects.toMatchObject({ code: 'ACTIVE_REGISTRY_CHANGED' });
    expect(context.audioSourceRegistry.resolve(SECOND_SOURCE_ID)).toMatchObject({ isCommitted: false });
    expect(context.audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
    expect(context.audioEngine.getTrackParams('old-track')).not.toBeNull();
    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('저장소가 잘못된 문서를 반환하면 Source를 읽기 전에 거부한다', async () => {
    const context = createTestContext();
    context.projectRepository.load.mockResolvedValue({
      ...createLoadedDocument(),
      timeline: { timeUnit: 'beats', tempoBpm: 140 },
    } as unknown as ProjectDocument);

    await expect(context.controller.loadProject(LOADED_PROJECT_ID)).rejects.toMatchObject({
      code: 'INVALID_PROJECT_DOCUMENT',
    });

    expect(context.audioSourceRepository.load).not.toHaveBeenCalled();
    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('빈 프로젝트는 기존 Track과 Source를 모두 빈 상태로 교체한다', async () => {
    const context = createTestContext();
    const emptyDocument: ProjectDocument = {
      ...createLoadedDocument(),
      audioSources: [],
      tracks: [],
    };
    context.projectRepository.load.mockResolvedValue(emptyDocument);
    context.audioSourceRegistry.restoreCommitted(createSourceRegistration());
    await context.audioEngine.addTrack('old-track');

    await context.controller.loadProject(LOADED_PROJECT_ID);

    expect(context.sessionStore.getState().tracks.size).toBe(0);
    expect(context.audioSourceRegistry.listCommittedMetadata()).toEqual([]);
    expect(context.audioEngine.getTrackParams('old-track')).toBeNull();
    expect(context.audioSourceRepository.load).not.toHaveBeenCalled();
  });

  it('Session 구독자가 예외를 던져도 이미 교체한 Runtime을 되돌리지 않는다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    const subscriberError = new Error('subscriber failed');
    context.projectRepository.load.mockResolvedValue(createLoadedDocument());
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);
    const unsubscribe = context.sessionStore.subscribe(state => {
      if (state.project.id === LOADED_PROJECT_ID) {
        throw subscriberError;
      }
    });

    await expect(context.controller.loadProject(LOADED_PROJECT_ID)).rejects.toBe(subscriberError);
    unsubscribe();

    expect(context.sessionStore.getState().project.id).toBe(LOADED_PROJECT_ID);
    expect(context.audioEngine.getTrackParams(TRACK_ID)).not.toBeNull();
    expect(context.audioSourceRegistry.resolve(SOURCE_ID)).not.toBeNull();
  });

  it('실패 후 prepared Registry 폐기도 완료하지 못하면 원래 오류와 정리 실패를 함께 보존한다', async () => {
    const context = createTestContext();
    const preparedRegistry = {
      restoreCommitted: vi.fn(),
      attach: vi.fn(),
      attachLoopSlot: vi.fn(),
      resolve: vi.fn().mockReturnValue(null),
      listCommittedMetadata: vi.fn().mockReturnValue([]),
      assertActivatable: vi.fn(),
      activate: vi.fn(),
      discard: vi.fn().mockReturnValue({ isComplete: false, failedResourceCount: 1 }),
    };
    vi.spyOn(context.audioSourceRegistry, 'beginReplacement').mockReturnValue(preparedRegistry);

    const error = await context.controller.loadProject(LOADED_PROJECT_ID).catch(cause => cause);

    expect(error).toBeInstanceOf(ProjectMutationCompensationError);
    expect(error).toMatchObject({
      operation: 'LOAD_PROJECT',
      failedPhase: 'PREPARED_RUNTIME_DISCARD',
      cause: expect.objectContaining({ code: 'PROJECT_NOT_FOUND' }),
      compensationFailures: [expect.objectContaining({ step: 'AUDIO_SOURCE_REGISTRY_DISCARD' })],
    });
  });
});
