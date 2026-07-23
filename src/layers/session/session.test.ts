import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createSessionStore, type RegionState, type SessionStore } from './session';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const INITIAL_PROJECT_METADATA = { id: PROJECT_ID, name: '새 프로젝트', revision: 0 };

describe('RegionState 오디오 식별자 계약', () => {
  it('sourceId 방식의 오디오 소스를 가진다', () => {
    const region: RegionState = {
      id: 'region-1',
      startTime: 0,
      endTime: 5,
      sourceStartTime: 0,
      duration: 5,
      status: [],
      sourceId: '11111111-1111-4111-8111-111111111111',
    };

    expect(region.sourceId).toBe('11111111-1111-4111-8111-111111111111');
    expect(region).not.toHaveProperty('audioFileUrl');
  });

  it('sourceId만 허용한다', () => {
    type RegionCommonFields = {
      id: string;
      startTime: number;
      endTime: number;
      sourceStartTime: number;
      duration: number;
      status: [];
    };

    expectTypeOf<RegionCommonFields & { audioFileUrl: string }>().not.toExtend<RegionState>();
    expectTypeOf<RegionCommonFields & { sourceId: string }>().toExtend<RegionState>();
    expectTypeOf<RegionCommonFields>().not.toExtend<RegionState>();
    expectTypeOf<RegionCommonFields & { audioFileUrl: string; sourceId: string }>().not.toExtend<RegionState>();
  });
});

describe('Session Store - Phase 1 검증', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = createSessionStore({ initialProjectMetadata: INITIAL_PROJECT_METADATA });
  });

  describe('기본 상태 초기화', () => {
    it('isPlaying은 false로 초기화되어야 함', () => {
      expect(store.getState().isPlaying).toBe(false);
    });

    it('currentTime은 0으로 초기화되어야 함', () => {
      expect(store.getState().currentTime).toBe(0);
    });

    it('tempo는 120으로 초기화되어야 함', () => {
      expect(store.getState().tempo).toBe(120);
    });

    it('masterVolume은 1.0으로 초기화되어야 함', () => {
      expect(store.getState().masterVolume).toBe(1.0);
    });

    it('exportStartTime과 exportEndTime은 null로 초기화되어야 함', () => {
      expect(store.getState().exportStartTime).toBe(null);
      expect(store.getState().exportEndTime).toBe(null);
    });

    it('tracks는 빈 Map으로 초기화되어야 함', () => {
      expect(store.getState().tracks).toBeInstanceOf(Map);
      expect(store.getState().tracks.size).toBe(0);
    });

    it('Plugin catalog, 검증 결과, 로그는 빈 상태로 초기화한다', () => {
      expect(store.getState().pluginCatalog).toEqual(new Map());
      expect(store.getState().pluginValidationResults).toEqual(new Map());
      expect(store.getState().pluginLogs).toEqual([]);
    });

    it('재생 URL 기반 호환 파일 목록을 Session에 두지 않는다', () => {
      expect(store.getState()).not.toHaveProperty('audioFiles');
      expect(store.getState()).not.toHaveProperty('addAudioFile');
      expect(store.getState()).not.toHaveProperty('removeAudioFile');
    });

    it('Agent 대화와 실행 상태는 비어 있는 상태로 초기화되어야 함', () => {
      expect(store.getState().agentMessages).toEqual([]);
      expect(store.getState().agentStatus).toBe('idle');
      expect(store.getState().agentRunStatus).toBe('idle');
      expect(store.getState().hasSuccessfulAgentResult).toBe(false);
    });
  });

  describe('Plugin Runtime 상태 관리', () => {
    it('Plugin catalog 입력과 Session이 객체 참조를 공유하지 않는다', () => {
      const manifest = { id: 'builtin.gain', name: 'Gain', version: '1.0.0' };

      store.getState().replacePluginCatalogState({ manifests: [manifest], validationResults: [] });
      manifest.name = '외부 변경';

      expect(store.getState().pluginCatalog.get('builtin.gain')).toEqual({
        id: 'builtin.gain',
        name: 'Gain',
        version: '1.0.0',
      });
    });

    it('Plugin 검증 결과의 issue 경로를 복제해 저장한다', () => {
      const validationResult = {
        manifestId: 'builtin.gain',
        status: 'invalid' as const,
        issues: [{ code: 'INVALID_RANGE', message: '범위 오류', path: ['parameters', 'gain'] }],
      };

      store.getState().replacePluginCatalogState({ manifests: [], validationResults: [validationResult] });
      validationResult.issues[0].path[0] = '외부 변경';

      expect(store.getState().pluginValidationResults.get('builtin.gain')?.issues[0]?.path).toEqual([
        'parameters',
        'gain',
      ]);
    });

    it('Plugin catalog와 검증 결과를 한 번의 상태 변경으로 교체한다', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.getState().replacePluginCatalogState({
        manifests: [{ id: 'builtin.gain', name: 'Gain', version: '1.0.0' }],
        validationResults: [{ manifestId: 'builtin.gain', status: 'valid', issues: [] }],
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.getState().pluginCatalog.has('builtin.gain')).toBe(true);
      expect(store.getState().pluginValidationResults.get('builtin.gain')?.status).toBe('valid');
    });

    it('Plugin 로그를 입력과 객체 참조를 공유하지 않고 추가한다', () => {
      const logEntry = {
        id: 'log-1',
        pluginInstanceId: 'plugin-1',
        level: 'info' as const,
        message: '활성화 완료',
        createdAtEpochMs: 1,
      };

      store.getState().addPluginLog(logEntry);
      logEntry.message = '외부 변경';

      expect(store.getState().pluginLogs).toEqual([
        {
          id: 'log-1',
          pluginInstanceId: 'plugin-1',
          level: 'info',
          message: '활성화 완료',
          createdAtEpochMs: 1,
        },
      ]);
    });
  });

  describe('프로젝트 metadata 관리', () => {
    it('주입한 프로젝트 metadata를 원본과 참조를 공유하지 않고 초기화한다', () => {
      const initialProject = { id: PROJECT_ID, name: '불러온 프로젝트', revision: 3 };
      const initializedStore = createSessionStore({ initialProjectMetadata: initialProject });

      initialProject.name = '외부 변경';

      expect(initializedStore.getState().project).toEqual({
        id: PROJECT_ID,
        name: '불러온 프로젝트',
        revision: 3,
      });
    });

    it('프로젝트 metadata 전체를 새 값으로 교체한다', () => {
      const nextProject = { id: PROJECT_ID, name: '저장된 프로젝트', revision: 1 };

      store.getState().replaceProjectMetadata(nextProject);
      nextProject.name = '외부 변경';

      expect(store.getState().project).toEqual({
        id: PROJECT_ID,
        name: '저장된 프로젝트',
        revision: 1,
      });
    });

    it('프로젝트 상태를 한 번에 교체하고 재생 위치만 초기화한다', () => {
      const listener = vi.fn();
      const nextProjectId = '22222222-2222-4222-8222-222222222222';
      const nextTrack = {
        id: '33333333-3333-4333-8333-333333333333',
        name: '복원 트랙',
        volume: 0.75,
        pan: -0.25,
        isMuted: true,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      };
      store.getState().setPlaying(true);
      store.getState().setCurrentTime(8);
      store.getState().addAgentMessage({
        id: 'message-1',
        role: 'user',
        content: '기존 대화',
        timestamp: 1,
      });
      store.subscribe(listener);

      store.getState().replaceProjectState({
        project: { id: nextProjectId, name: '복원 프로젝트', revision: 4 },
        tempo: 132,
        masterVolume: 0.8,
        exportStartTime: 1,
        exportEndTime: 6,
        tracks: new Map([[nextTrack.id, nextTrack]]),
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.getState()).toMatchObject({
        project: { id: nextProjectId, name: '복원 프로젝트', revision: 4 },
        tempo: 132,
        masterVolume: 0.8,
        exportStartTime: 1,
        exportEndTime: 6,
        isPlaying: false,
        currentTime: 0,
      });
      expect(store.getState().tracks.get(nextTrack.id)).toEqual(nextTrack);
      expect(store.getState().agentMessages).toEqual([
        expect.objectContaining({ id: 'message-1', content: '기존 대화' }),
      ]);
    });

    it('교체 입력과 Session 프로젝트 상태가 객체 참조를 공유하지 않는다', () => {
      const trackId = '33333333-3333-4333-8333-333333333333';
      const regionId = '44444444-4444-4444-8444-444444444444';
      const projectState = {
        project: { id: PROJECT_ID, name: '복원 프로젝트', revision: 2 },
        tempo: 128,
        masterVolume: 0.9,
        exportStartTime: null,
        exportEndTime: null,
        tracks: new Map([
          [
            trackId,
            {
              id: trackId,
              name: '복원 트랙',
              volume: 1,
              pan: 0,
              isMuted: false,
              isSoloed: false,
              status: [],
              pluginInstances: [
                {
                  id: 'plugin-1',
                  manifestSummary: { id: 'builtin.gain', name: 'Gain', version: '1.0.0' },
                  isEnabled: true,
                  parameters: [{ id: 'gain', value: 0.5 }],
                },
              ],
              regions: [
                {
                  id: regionId,
                  sourceId: '55555555-5555-4555-8555-555555555555',
                  startTime: 0,
                  endTime: 1,
                  sourceStartTime: 0,
                  duration: 1,
                  status: [],
                },
              ],
            },
          ],
        ]),
      };

      store.getState().replaceProjectState(projectState);
      projectState.project.name = '입력 변경';
      projectState.tracks.get(trackId)!.name = '입력 트랙 변경';
      projectState.tracks.get(trackId)!.pluginInstances[0].manifestSummary.name = '입력 Plugin 변경';
      projectState.tracks.get(trackId)!.pluginInstances[0].parameters[0].value = 1;
      projectState.tracks.get(trackId)!.regions[0].duration = 9;

      expect(store.getState().project.name).toBe('복원 프로젝트');
      expect(store.getState().tracks.get(trackId)?.name).toBe('복원 트랙');
      expect(store.getState().tracks.get(trackId)?.pluginInstances[0]).toMatchObject({
        manifestSummary: { name: 'Gain' },
        parameters: [{ id: 'gain', value: 0.5 }],
      });
      expect(store.getState().tracks.get(trackId)?.regions[0].duration).toBe(1);
    });

    it('빈 프로젝트로 교체하면 기존 Track과 Export 범위를 제거한다', () => {
      store.getState().addTrack({
        id: '33333333-3333-4333-8333-333333333333',
        name: '기존 트랙',
        volume: 1,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      });
      store.getState().setExportRange(1, 4);

      store.getState().replaceProjectState({
        project: { id: PROJECT_ID, name: '빈 프로젝트', revision: 3 },
        tempo: 120,
        masterVolume: 1,
        exportStartTime: null,
        exportEndTime: null,
        tracks: new Map(),
      });

      expect(store.getState().tracks.size).toBe(0);
      expect(store.getState().exportStartTime).toBeNull();
      expect(store.getState().exportEndTime).toBeNull();
    });
  });

  describe('Agent 작업 상태 관리', () => {
    it('Agent 메시지를 추가할 수 있어야 함', () => {
      const message = {
        id: 'message-1',
        role: 'user' as const,
        content: '보컬을 더 선명하게 만들어줘',
        timestamp: 1,
      };

      store.getState().addAgentMessage(message);

      expect(store.getState().agentMessages).toEqual([message]);
    });

    it('Agent 메시지 내용을 갱신할 수 있어야 함', () => {
      store.getState().addAgentMessage({
        id: 'message-1',
        role: 'assistant',
        content: '',
        timestamp: 1,
      });

      store.getState().updateAgentMessage('message-1', '처리가 완료되었습니다.');

      expect(store.getState().agentMessages[0]?.content).toBe('처리가 완료되었습니다.');
    });

    it('Agent 실행 성공 상태를 기록할 수 있어야 함', () => {
      store.getState().setAgentRunStatus('succeeded');

      expect(store.getState().agentRunStatus).toBe('succeeded');
    });

    it('Agent 성공 결과가 생성됐음을 기록할 수 있어야 함', () => {
      store.getState().markAgentResultSuccessful();

      expect(store.getState().hasSuccessfulAgentResult).toBe(true);
    });

    it('새 작업을 시작하면 Agent 대화와 결과 상태를 초기화해야 함', () => {
      store.getState().addAgentMessage({
        id: 'message-1',
        role: 'user',
        content: '드럼을 줄여줘',
        timestamp: 1,
      });
      store.getState().setAgentStatus('error');
      store.getState().setAgentRunStatus('failed');
      store.getState().markAgentResultSuccessful();

      store.getState().resetAgentWorkflow();

      expect(store.getState().agentMessages).toEqual([]);
      expect(store.getState().agentStatus).toBe('idle');
      expect(store.getState().agentRunStatus).toBe('idle');
      expect(store.getState().hasSuccessfulAgentResult).toBe(false);
    });
  });

  describe('재생 상태 관리', () => {
    it('setPlaying으로 재생 상태를 변경할 수 있어야 함', () => {
      store.getState().setPlaying(true);
      expect(store.getState().isPlaying).toBe(true);

      store.getState().setPlaying(false);
      expect(store.getState().isPlaying).toBe(false);
    });

    it('setCurrentTime으로 재생 위치를 변경할 수 있어야 함', () => {
      store.getState().setCurrentTime(5.5);
      expect(store.getState().currentTime).toBe(5.5);

      store.getState().setCurrentTime(10.25);
      expect(store.getState().currentTime).toBe(10.25);
    });

    it('stopPlayback은 재생 상태와 위치를 한 번에 초기화한다', () => {
      const listener = vi.fn();
      store.getState().setPlaying(true);
      store.getState().setCurrentTime(5.5);
      store.subscribe(listener);

      store.getState().stopPlayback();

      expect(store.getState().isPlaying).toBe(false);
      expect(store.getState().currentTime).toBe(0);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('setTempo로 템포를 변경할 수 있어야 함', () => {
      store.getState().setTempo(140);
      expect(store.getState().tempo).toBe(140);

      store.getState().setTempo(90);
      expect(store.getState().tempo).toBe(90);
    });
  });

  describe('Export 범위 관리', () => {
    it('setExportRange로 export 범위를 설정할 수 있어야 함', () => {
      store.getState().setExportRange(2.0, 8.0);
      expect(store.getState().exportStartTime).toBe(2.0);
      expect(store.getState().exportEndTime).toBe(8.0);
    });

    it('setExportRange로 export 범위를 null로 설정할 수 있어야 함', () => {
      store.getState().setExportRange(2.0, 8.0);
      store.getState().setExportRange(null, null);
      expect(store.getState().exportStartTime).toBe(null);
      expect(store.getState().exportEndTime).toBe(null);
    });
  });

  describe('Track 관리', () => {
    it('addTrack으로 트랙을 추가할 수 있어야 함', () => {
      const track1 = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      };

      store.getState().addTrack(track1);
      expect(store.getState().tracks.size).toBe(1);
      expect(store.getState().tracks.get('track-1')).toEqual(track1);
    });

    it('여러 트랙을 추가할 수 있어야 함', () => {
      const track1 = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      };

      const track2 = {
        id: 'track-2',
        name: 'Track 2',
        volume: 1.0,
        pan: -0.5,
        isMuted: true,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      };

      store.getState().addTrack(track1);
      store.getState().addTrack(track2);

      expect(store.getState().tracks.size).toBe(2);
      expect(store.getState().tracks.get('track-1')).toEqual(track1);
      expect(store.getState().tracks.get('track-2')).toEqual(track2);
    });

    it('updateTrack으로 트랙을 업데이트할 수 있어야 함', () => {
      const track = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      };

      store.getState().addTrack(track);
      store.getState().updateTrack('track-1', { volume: 0.5, pan: 0.3 });

      const updatedTrack = store.getState().tracks.get('track-1');
      expect(updatedTrack?.volume).toBe(0.5);
      expect(updatedTrack?.pan).toBe(0.3);
      expect(updatedTrack?.isMuted).toBe(false); // 다른 속성은 유지
    });

    it('존재하지 않는 트랙 업데이트 시 상태가 변경되지 않아야 함', () => {
      const initialState = store.getState();
      store.getState().updateTrack('non-existent', { volume: 0.5 });
      expect(store.getState()).toBe(initialState); // 동일한 참조
    });

    it('removeTrack으로 트랙을 제거할 수 있어야 함', () => {
      const track = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      };

      store.getState().addTrack(track);
      expect(store.getState().tracks.size).toBe(1);

      store.getState().removeTrack('track-1');
      expect(store.getState().tracks.size).toBe(0);
      expect(store.getState().tracks.get('track-1')).toBeUndefined();
    });
  });

  describe('TrackState 속성 검증 (Phase 1 확장)', () => {
    it('TrackState에 pan 속성이 있어야 함', () => {
      const track = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        pan: 0.5, // Phase 1에서 추가된 속성
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      };

      store.getState().addTrack(track);
      const addedTrack = store.getState().tracks.get('track-1');
      expect(addedTrack?.pan).toBe(0.5);
    });

    it('TrackState에 regions 배열이 있어야 함', () => {
      const region1 = {
        id: 'region-1',
        startTime: 0,
        endTime: 5.0,
        sourceStartTime: 0,
        duration: 5.0,
        status: [],
        sourceId: '11111111-1111-4111-8111-111111111111',
      };

      const track = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [region1], // Phase 1에서 추가된 속성
      };

      store.getState().addTrack(track);
      const addedTrack = store.getState().tracks.get('track-1');
      expect(addedTrack?.regions).toHaveLength(1);
      expect(addedTrack?.regions[0]).toEqual(region1);
    });
  });

  describe('상태 불변성 검증', () => {
    it('tracks Map은 업데이트 시마다 새로운 참조여야 함', () => {
      const track1 = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      };

      const initialTracks = store.getState().tracks;
      store.getState().addTrack(track1);
      const updatedTracks = store.getState().tracks;

      expect(updatedTracks).not.toBe(initialTracks); // 다른 참조
      expect(updatedTracks.size).toBe(1);
    });

    it('updateTrack 시 Map과 Track 객체 모두 새로운 참조여야 함', () => {
      const track = {
        id: 'track-1',
        name: 'Track 1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      };

      store.getState().addTrack(track);
      const tracksBeforeUpdate = store.getState().tracks;
      const trackBeforeUpdate = store.getState().tracks.get('track-1');

      store.getState().updateTrack('track-1', { volume: 0.5 });
      const tracksAfterUpdate = store.getState().tracks;
      const trackAfterUpdate = store.getState().tracks.get('track-1');

      expect(tracksAfterUpdate).not.toBe(tracksBeforeUpdate); // Map 참조 변경
      expect(trackAfterUpdate).not.toBe(trackBeforeUpdate); // Track 객체 참조 변경
    });
  });
});
