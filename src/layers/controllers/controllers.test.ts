import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import type { IObjectUrlAdapter } from '../audio-source-registry/i-object-url-adapter';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import { PluginHost } from '../plugin-host/plugin-host';
import { AppController } from './app-controller';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';
import { createSessionStore, type SessionStore } from '../session/session';
import { createDefaultRegionProcessingState } from '../shared/types/region-processing';
import { ProjectStateError, type ProjectStateErrorCode } from './project-state-error';

const INITIAL_PROJECT_METADATA = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '테스트 프로젝트',
  revision: 0,
};
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_REGION_ID = '33333333-3333-4333-8333-333333333333';
const SECOND_SOURCE_REGION_ID = '44444444-4444-4444-8444-444444444444';
const SOURCE_OBJECT_URL = 'blob:registered-source';

interface AddRegisteredTestRegionOptions {
  readonly regionId?: string;
  readonly startTime?: number;
  readonly sourceStartTime?: number;
  readonly duration?: number;
}

function stageSource(audioSourceRegistry: IAudioSourceRegistry, durationSeconds: number | null = 10): void {
  audioSourceRegistry.stage({
    metadata: {
      id: SOURCE_ID,
      fileName: 'source.wav',
      mimeType: 'audio/wav',
      byteLength: 4,
      durationSeconds,
    },
    blob: new Blob(['test'], { type: 'audio/wav' }),
  });
}

function expectProjectStateError(action: () => unknown, code: ProjectStateErrorCode): void {
  let thrownError: unknown;

  try {
    action();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(ProjectStateError);
  expect(thrownError).toMatchObject({ code });
}

async function expectRejectedProjectStateError(
  action: () => Promise<unknown>,
  code: ProjectStateErrorCode
): Promise<void> {
  let thrownError: unknown;

  try {
    await action();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(ProjectStateError);
  expect(thrownError).toMatchObject({ code });
}

function createDeferredVoid(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise = (): void => undefined;
  const promise = new Promise<void>(resolve => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}

describe('Controllers - Phase 3 검증', () => {
  let engine: MockAudioEngine;
  let controller: AppController;
  let session: SessionStore;
  let audioSourceRegistry: IAudioSourceRegistry;
  let revokeObjectUrl: (objectUrl: string) => void;

  beforeEach(() => {
    engine = new MockAudioEngine();
    session = createSessionStore({ initialProjectMetadata: INITIAL_PROJECT_METADATA });
    revokeObjectUrl = vi.fn();
    const objectUrlAdapter: IObjectUrlAdapter = {
      createObjectUrl: () => SOURCE_OBJECT_URL,
      revokeObjectUrl,
    };
    audioSourceRegistry = new AudioSourceRegistry(objectUrlAdapter);
    const audioSourceRepository: IAudioSourceRepository = {
      create: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    controller = new AppController({
      sessionStore: session,
      audioEngine: engine,
      audioSourceRegistry,
      audioSourceRepository,
      projectRepository: new InMemoryProjectRepository(),
      pluginHost: new PluginHost(),
    });
  });

  describe('PlaybackController 확장', () => {
    it('AudioContext 재개를 AudioEngine에 위임한다', async () => {
      engine.setMockRuntimeHealth({ audioContextState: 'suspended', pendingCleanupResourceCount: 0 });

      await controller.playback.resumeAudioRuntime();

      expect(engine.getRuntimeHealth().audioContextState).toBe('running');
    });

    it('handleSeek 호출 가능', () => {
      expect(() => controller.playback.handleSeek(5.5)).not.toThrow();
    });

    it('handleSetTempo는 AudioEngine Tempo Map과 Session을 함께 변경한다', () => {
      expect(() => controller.playback.handleSetTempo(140)).not.toThrow();

      expect(session.getState().tempo).toBe(140);
      expect(engine.getMockTransportState().tempoChanges[0]?.bpm).toBe(140);
    });

    it('Loop 활성화 적용이 실패하면 runtime 범위를 이전 상태로 복구한다', () => {
      const runtimeFailure = new Error('Loop 활성화 실패');
      vi.spyOn(engine, 'setLoopEnabled').mockImplementationOnce(() => {
        throw runtimeFailure;
      });

      expect(() => controller.playback.handleSetLoopRange({ startTimeSeconds: 1, endTimeSeconds: 3 }, true)).toThrow(
        runtimeFailure
      );

      expect(engine.getMockTransportState()).toMatchObject({ isLoopEnabled: false, loopRange: null });
      expect(session.getState()).toMatchObject({ isLoopEnabled: false, loopRange: null });
    });

    it('Metronome 활성화 적용이 실패하면 runtime 볼륨을 이전 상태로 복구한다', () => {
      const runtimeFailure = new Error('Metronome 활성화 실패');
      const previousVolume = session.getState().metronomeVolume;
      vi.spyOn(engine, 'setMetronomeEnabled').mockImplementationOnce(() => {
        throw runtimeFailure;
      });

      expect(() => controller.playback.handleSetMetronome({ isEnabled: true, volume: 0.25 })).toThrow(runtimeFailure);

      expect(engine.getMockTransportState()).toMatchObject({
        isMetronomeEnabled: false,
        metronomeVolume: previousVolume,
      });
      expect(session.getState()).toMatchObject({ isMetronomeEnabled: false, metronomeVolume: previousVolume });
    });

    it('getCurrentTime 반환값 확인', () => {
      engine.setTime(7.5);
      const time = controller.playback.getCurrentTime();
      expect(time).toBe(7.5);
    });
  });

  describe('TrackController 확장', () => {
    beforeEach(async () => {
      await controller.track.addTrack('track-1');
    });

    it('addTrack은 중복 Track ID를 AudioEngine 호출 전에 거부한다', async () => {
      const addTrackSpy = vi.spyOn(engine, 'addTrack');

      await expectRejectedProjectStateError(() => controller.track.addTrack('track-1'), 'TRACK_ID_CONFLICT');

      expect(addTrackSpy).not.toHaveBeenCalled();
      expect(session.getState().tracks.get('track-1')?.name).toBe('Track track-1');
    });

    it('같은 Track ID를 동시에 추가하면 먼저 완료한 호출만 Session에 반영한다', async () => {
      const deferred = createDeferredVoid();
      const addTrackSpy = vi.spyOn(engine, 'addTrack').mockReturnValue(deferred.promise);
      const firstAdd = controller.track.addTrack('concurrent-track');
      const secondAdd = controller.track.addTrack('concurrent-track');

      expect(addTrackSpy).toHaveBeenCalledTimes(2);
      deferred.resolve();

      await firstAdd;
      await expectRejectedProjectStateError(() => secondAdd, 'TRACK_ID_CONFLICT');
      expect(session.getState().tracks.get('concurrent-track')?.name).toBe('Track concurrent-track');
    });

    it('setVolume 호출 시 SessionStore 업데이트', () => {
      controller.track.setVolume('track-1', 0.8);
      const track = session.getState().tracks.get('track-1');
      expect(track?.volume).toBe(0.8);
    });

    it('setPan 호출 시 SessionStore 업데이트', () => {
      controller.track.setPan('track-1', -0.5);
      const track = session.getState().tracks.get('track-1');
      expect(track?.pan).toBe(-0.5);
    });

    it('setVolume은 없는 트랙을 AudioEngine 호출 전에 거부한다', () => {
      const setTrackVolumeSpy = vi.spyOn(engine, 'setTrackVolume');

      expectProjectStateError(() => controller.track.setVolume('missing-track', 0.5), 'TRACK_NOT_FOUND');

      expect(setTrackVolumeSpy).not.toHaveBeenCalled();
    });

    it('setPan은 없는 트랙을 AudioEngine 호출 전에 거부한다', () => {
      const setTrackPanSpy = vi.spyOn(engine, 'setTrackPan');

      expectProjectStateError(() => controller.track.setPan('missing-track', 0), 'TRACK_NOT_FOUND');

      expect(setTrackPanSpy).not.toHaveBeenCalled();
    });

    it('setMute는 AudioEngine 성공 뒤 SessionStore를 업데이트한다', () => {
      const setTrackMuteSpy = vi.spyOn(engine, 'setTrackMute');

      controller.track.setMute('track-1', true);

      expect(setTrackMuteSpy).toHaveBeenCalledWith('track-1', true);
      const track = session.getState().tracks.get('track-1');
      expect(track?.isMuted).toBe(true);
    });

    it('setMute의 AudioEngine 호출이 실패하면 SessionStore를 변경하지 않는다', () => {
      vi.spyOn(engine, 'setTrackMute').mockImplementationOnce(() => {
        throw new Error('mute failed');
      });

      expect(() => controller.track.setMute('track-1', true)).toThrowError('mute failed');
      expect(session.getState().tracks.get('track-1')?.isMuted).toBe(false);
    });

    it('setSolo는 AudioEngine 성공 뒤 SessionStore를 업데이트한다', () => {
      const setTrackSoloSpy = vi.spyOn(engine, 'setTrackSolo');

      controller.track.setSolo('track-1', true);

      expect(setTrackSoloSpy).toHaveBeenCalledWith('track-1', true);
      const track = session.getState().tracks.get('track-1');
      expect(track?.isSoloed).toBe(true);
    });

    it('setSolo의 AudioEngine 호출이 실패하면 SessionStore를 변경하지 않는다', () => {
      vi.spyOn(engine, 'setTrackSolo').mockImplementationOnce(() => {
        throw new Error('solo failed');
      });

      expect(() => controller.track.setSolo('track-1', true)).toThrowError('solo failed');
      expect(session.getState().tracks.get('track-1')?.isSoloed).toBe(false);
    });

    it('removeTrack 호출 시 AudioEngine과 Session에서 트랙을 제거한다', () => {
      const removeTrackSpy = vi.spyOn(engine, 'removeTrack');

      controller.track.removeTrack('track-1');

      expect(removeTrackSpy).toHaveBeenCalledWith('track-1');
      expect(session.getState().tracks.has('track-1')).toBe(false);
    });

    it('removeTrack의 AudioEngine 호출이 실패하면 SessionStore에서 트랙을 유지한다', () => {
      vi.spyOn(engine, 'removeTrack').mockImplementationOnce(() => {
        throw new Error('remove failed');
      });

      expect(() => controller.track.removeTrack('track-1')).toThrowError('remove failed');
      expect(session.getState().tracks.has('track-1')).toBe(true);
    });

    it('sourceId Region이 있는 Track을 제거하면 Source 연결을 해제한다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });

      controller.track.removeTrack('track-1');

      expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([]);
      expect(revokeObjectUrl).not.toHaveBeenCalled();
    });

    it('sourceId Region이 있는 Track 제거가 실패하면 Source 연결을 복원한다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      vi.spyOn(engine, 'removeTrack').mockImplementationOnce(() => {
        throw new Error('remove failed');
      });

      expect(() => controller.track.removeTrack('track-1')).toThrowError('remove failed');

      expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([SOURCE_REGION_ID]);
      expect(session.getState().tracks.has('track-1')).toBe(true);
    });

    it.each([
      ['removeTrack', () => controller.track.removeTrack('missing-track')],
      ['setMute', () => controller.track.setMute('missing-track', true)],
      ['setSolo', () => controller.track.setSolo('missing-track', true)],
    ])('%s는 없는 트랙을 명확한 오류로 거부한다', (_name, action) => {
      expectProjectStateError(action, 'TRACK_NOT_FOUND');
    });
  });

  describe('RegionController', () => {
    beforeEach(async () => {
      await controller.track.addTrack('track-1');
    });

    async function addRegisteredTestRegion({
      regionId = SOURCE_REGION_ID,
      startTime = 0,
      sourceStartTime = 0,
      duration = 10,
    }: AddRegisteredTestRegionOptions = {}): Promise<void> {
      if (!audioSourceRegistry.resolve(SOURCE_ID)) {
        stageSource(audioSourceRegistry, Math.max(10, sourceStartTime + duration));
      }

      await controller.region.addRegion('track-1', {
        id: regionId,
        sourceId: SOURCE_ID,
        startTime,
        sourceStartTime,
        duration,
      });
    }

    it('기존 URL 입력으로 새 Region을 만들지 않는다', async () => {
      const legacyRegionRequest = {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      } as unknown as Parameters<typeof controller.region.addRegion>[1];

      await expectRejectedProjectStateError(
        () => controller.region.addRegion('track-1', legacyRegionRequest),
        'REGION_SOURCE_MISSING'
      );

      expect(session.getState().tracks.get('track-1')?.regions).toEqual([]);
    });

    it('sourceId Region은 Registry URL로 재생하고 Session에는 sourceId만 저장한다', async () => {
      stageSource(audioSourceRegistry);
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 1,
        sourceStartTime: 2,
        duration: 3,
      });

      expect(addRegionSpy).toHaveBeenCalledWith('track-1', {
        ...createDefaultRegionProcessingState(),
        id: SOURCE_REGION_ID,
        url: SOURCE_OBJECT_URL,
        startTime: 1,
        sourceStartTime: 2,
        duration: 3,
      });
      expect(session.getState().tracks.get('track-1')?.regions[0]).toEqual({
        ...createDefaultRegionProcessingState(),
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 1,
        endTime: 4,
        sourceStartTime: 2,
        duration: 3,
        status: [],
      });
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toMatchObject({
        isCommitted: true,
        regionIds: [SOURCE_REGION_ID],
      });
    });

    it('대상 Track이 없으면 명시한 pending Source와 Object URL을 정리한다', async () => {
      session.getState().removeTrack('track-1');
      stageSource(audioSourceRegistry);
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expectRejectedProjectStateError(
        () =>
          controller.region.addRegion('track-1', {
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            sourceStartTime: 0,
            duration: 10,
          }),
        'TRACK_NOT_FOUND'
      );

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
      expect(revokeObjectUrl).toHaveBeenCalledWith(SOURCE_OBJECT_URL);
    });

    it('Region ID가 충돌하면 명시한 pending Source와 Object URL을 정리한다', async () => {
      session.getState().updateTrack('track-1', {
        regions: [
          {
            ...createDefaultRegionProcessingState(),
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            endTime: 10,
            sourceStartTime: 0,
            duration: 10,
            status: [],
          },
        ],
      });
      stageSource(audioSourceRegistry);
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expectRejectedProjectStateError(
        () =>
          controller.region.addRegion('track-1', {
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 10,
            sourceStartTime: 0,
            duration: 10,
          }),
        'REGION_ID_CONFLICT'
      );

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
      expect(revokeObjectUrl).toHaveBeenCalledWith(SOURCE_OBJECT_URL);
    });

    it('사전 검증이 실패해도 committed Source는 유지한다', async () => {
      stageSource(audioSourceRegistry);
      audioSourceRegistry.attach({ sourceId: SOURCE_ID, regionId: SECOND_SOURCE_REGION_ID });
      session.getState().removeTrack('track-1');

      await expectRejectedProjectStateError(
        () =>
          controller.region.addRegion('track-1', {
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            sourceStartTime: 0,
            duration: 10,
          }),
        'TRACK_NOT_FOUND'
      );

      expect(audioSourceRegistry.resolve(SOURCE_ID)).toMatchObject({
        isCommitted: true,
        regionIds: [SECOND_SOURCE_REGION_ID],
      });
      expect(revokeObjectUrl).not.toHaveBeenCalled();
    });

    it('사전 검증과 pending Source 정리가 모두 실패하면 두 오류를 보존한다', async () => {
      session.getState().removeTrack('track-1');
      stageSource(audioSourceRegistry);
      vi.mocked(revokeObjectUrl).mockImplementationOnce(() => {
        throw new Error('revoke failed');
      });

      let thrownError: unknown;
      try {
        await controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: 0,
          duration: 10,
        });
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ProjectMutationCompensationError);
      expect(thrownError).toMatchObject({
        operation: 'add-region',
        failedPhase: 'Region 추가 사전 검증 후 pending Source 정리',
        cause: expect.objectContaining({ code: 'TRACK_NOT_FOUND' }),
        compensationFailures: [expect.objectContaining({ step: `pending Source 정리: ${SOURCE_ID}` })],
      });
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toMatchObject({ isCommitted: false, regionIds: [] });
    });

    it('sourceId Region은 알려진 Source 길이의 정확한 끝 경계를 허용한다', async () => {
      stageSource(audioSourceRegistry);

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: 2,
          duration: 8,
        })
      ).resolves.toBeUndefined();
    });

    it('sourceId Region은 Source 범위의 부동소수점 덧셈 오차를 허용한다', async () => {
      stageSource(audioSourceRegistry, 0.3);

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: 0.1,
          duration: 0.2,
        })
      ).resolves.toBeUndefined();
    });

    it('sourceId Region이 알려진 Source 길이를 넘으면 Engine 호출 전에 pending Source를 정리한다', async () => {
      stageSource(audioSourceRegistry);
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: 2,
          duration: 8.000000002,
        })
      ).rejects.toMatchObject({ code: 'REGION_SOURCE_RANGE_EXCEEDED' });

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
      expect(revokeObjectUrl).toHaveBeenCalledWith(SOURCE_OBJECT_URL);
      expect(session.getState().tracks.get('track-1')?.regions).toEqual([]);
    });

    it('sourceId Region의 duration을 생략하면 알려진 Source의 남은 길이로 정규화한다', async () => {
      stageSource(audioSourceRegistry);
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 3,
        sourceStartTime: 2,
      });

      expect(addRegionSpy).toHaveBeenCalledWith('track-1', expect.objectContaining({ duration: 8 }));
      expect(session.getState().tracks.get('track-1')?.regions[0]).toMatchObject({
        startTime: 3,
        endTime: 11,
        sourceStartTime: 2,
        duration: 8,
      });
    });

    it('길이를 모르는 Source는 명시한 Region duration을 허용한다', async () => {
      stageSource(audioSourceRegistry, null);

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: 2,
          duration: 8,
        })
      ).resolves.toBeUndefined();
    });

    it('addRegion은 길이를 모르는 Source의 원본 끝 시각 overflow를 Engine 전에 거부하고 정리한다', async () => {
      stageSource(audioSourceRegistry, null);
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: Number.MAX_VALUE,
          duration: Number.MAX_VALUE,
        })
      ).rejects.toMatchObject({ code: 'INVALID_REGION_SOURCE_RANGE' });

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
      expect(revokeObjectUrl).toHaveBeenCalledWith(SOURCE_OBJECT_URL);
      expect(session.getState().tracks.get('track-1')?.regions).toEqual([]);
    });

    it('addRegion의 원본 범위 검증 실패는 committed Source를 유지한다', async () => {
      stageSource(audioSourceRegistry, null);
      audioSourceRegistry.attach({ sourceId: SOURCE_ID, regionId: SECOND_SOURCE_REGION_ID });
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: Number.MAX_VALUE,
          duration: Number.MAX_VALUE,
        })
      ).rejects.toMatchObject({ code: 'INVALID_REGION_SOURCE_RANGE' });

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toMatchObject({
        isCommitted: true,
        regionIds: [SECOND_SOURCE_REGION_ID],
      });
      expect(revokeObjectUrl).not.toHaveBeenCalled();
    });

    it('addRegion은 타임라인 끝 시각 overflow를 Engine 호출 전에 거부하고 pending Source를 정리한다', async () => {
      stageSource(audioSourceRegistry, null);
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: Number.MAX_VALUE,
          sourceStartTime: 0,
          duration: Number.MAX_VALUE,
        })
      ).rejects.toMatchObject({ code: 'INVALID_REGION_TIMELINE_RANGE' });

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
      expect(revokeObjectUrl).toHaveBeenCalledWith(SOURCE_OBJECT_URL);
      expect(session.getState().tracks.get('track-1')?.regions).toEqual([]);
    });

    it('addRegion은 duration 생략 후 Source 길이로 계산된 타임라인 overflow도 거부한다', async () => {
      stageSource(audioSourceRegistry, Number.MAX_VALUE);
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: Number.MAX_VALUE,
          sourceStartTime: 0,
        })
      ).rejects.toMatchObject({ code: 'INVALID_REGION_TIMELINE_RANGE' });

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
      expect(revokeObjectUrl).toHaveBeenCalledWith(SOURCE_OBJECT_URL);
      expect(session.getState().tracks.get('track-1')?.regions).toEqual([]);
    });

    it('타임라인 검증과 pending Source 정리가 모두 실패하면 두 오류를 보존한다', async () => {
      stageSource(audioSourceRegistry, null);
      vi.mocked(revokeObjectUrl).mockImplementationOnce(() => {
        throw new Error('revoke failed');
      });

      let thrownError: unknown;
      try {
        await controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: Number.MAX_VALUE,
          sourceStartTime: 0,
          duration: Number.MAX_VALUE,
        });
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ProjectMutationCompensationError);
      expect(thrownError).toMatchObject({
        operation: 'add-region',
        failedPhase: 'Source 검증 실패 후 pending Source 정리',
        cause: expect.objectContaining({ code: 'INVALID_REGION_TIMELINE_RANGE' }),
        compensationFailures: [expect.objectContaining({ step: `pending Source 정리: ${SOURCE_ID}` })],
      });
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toMatchObject({ isCommitted: false, regionIds: [] });
    });

    it('addRegion의 타임라인 끝 시각 검증 실패는 committed Source를 유지한다', async () => {
      stageSource(audioSourceRegistry, null);
      audioSourceRegistry.attach({ sourceId: SOURCE_ID, regionId: SECOND_SOURCE_REGION_ID });
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: Number.MAX_VALUE,
          sourceStartTime: 0,
          duration: Number.MAX_VALUE,
        })
      ).rejects.toMatchObject({ code: 'INVALID_REGION_TIMELINE_RANGE' });

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toMatchObject({
        isCommitted: true,
        regionIds: [SECOND_SOURCE_REGION_ID],
      });
      expect(revokeObjectUrl).not.toHaveBeenCalled();
    });

    it('길이를 모르는 pending Source에서 Region duration을 생략하면 Source를 정리한다', async () => {
      stageSource(audioSourceRegistry, null);
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: 2,
        })
      ).rejects.toMatchObject({ code: 'REGION_DURATION_REQUIRED' });

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
      expect(revokeObjectUrl).toHaveBeenCalledWith(SOURCE_OBJECT_URL);
    });

    it('Source 생략 fallback도 등록 Source 길이를 넘는 Region을 거부한다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 5,
      });
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expect(
        controller.region.addRegion('track-1', {
          id: SECOND_SOURCE_REGION_ID,
          startTime: 5,
          sourceStartTime: 9,
          duration: 2,
        })
      ).rejects.toMatchObject({ code: 'REGION_SOURCE_RANGE_EXCEEDED' });

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([SOURCE_REGION_ID]);
    });

    it('등록되지 않은 sourceId는 AudioEngine 호출 전에 거부한다', async () => {
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expectRejectedProjectStateError(
        () =>
          controller.region.addRegion('track-1', {
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            sourceStartTime: 0,
            duration: 10,
          }),
        'REGION_SOURCE_MISSING'
      );

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(session.getState().tracks.get('track-1')?.regions).toEqual([]);
    });

    it('Source를 생략하면 첫 Region의 sourceId를 재사용한다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 5,
      });
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await controller.region.addRegion('track-1', {
        id: SECOND_SOURCE_REGION_ID,
        startTime: 5,
        sourceStartTime: 5,
        duration: 5,
      });

      expect(addRegionSpy).toHaveBeenLastCalledWith(
        'track-1',
        expect.objectContaining({ id: SECOND_SOURCE_REGION_ID, url: SOURCE_OBJECT_URL })
      );
      expect(session.getState().tracks.get('track-1')?.regions[1]).toMatchObject({ sourceId: SOURCE_ID });
    });

    it('pending Source의 Region 추가가 실패하면 연결과 Object URL을 정리한다', async () => {
      stageSource(audioSourceRegistry);
      vi.spyOn(engine, 'addRegion').mockRejectedValueOnce(new Error('add failed'));

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: 0,
          duration: 10,
        })
      ).rejects.toThrowError('add failed');

      expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
      expect(revokeObjectUrl).toHaveBeenCalledWith(SOURCE_OBJECT_URL);
      expect(session.getState().tracks.get('track-1')?.regions).toEqual([]);
    });

    it('pending Source 연결 준비가 실패하면 Engine 호출 전 Source와 Object URL을 정리한다', async () => {
      stageSource(audioSourceRegistry);
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expect(
        controller.region.addRegion('track-1', {
          id: 'invalid-region-id',
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: 0,
          duration: 10,
        })
      ).rejects.toMatchObject({ code: 'INVALID_REGION_ID' });

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toBeNull();
      expect(revokeObjectUrl).toHaveBeenCalledWith(SOURCE_OBJECT_URL);
      expect(session.getState().tracks.get('track-1')?.regions).toEqual([]);
    });

    it('committed Source의 Region 추가가 실패하면 새 연결만 해제한다', async () => {
      stageSource(audioSourceRegistry);
      audioSourceRegistry.attach({ sourceId: SOURCE_ID, regionId: SECOND_SOURCE_REGION_ID });
      vi.spyOn(engine, 'addRegion').mockRejectedValueOnce(new Error('add failed'));

      await expect(
        controller.region.addRegion('track-1', {
          id: SOURCE_REGION_ID,
          sourceId: SOURCE_ID,
          startTime: 0,
          sourceStartTime: 0,
          duration: 10,
        })
      ).rejects.toThrowError('add failed');

      expect(audioSourceRegistry.resolve(SOURCE_ID)).toMatchObject({
        isCommitted: true,
        regionIds: [SECOND_SOURCE_REGION_ID],
      });
      expect(revokeObjectUrl).not.toHaveBeenCalled();
    });

    it('addRegion은 같은 트랙의 중복 Region ID를 AudioEngine 호출 전에 거부한다', async () => {
      await addRegisteredTestRegion();
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expectRejectedProjectStateError(
        () =>
          controller.region.addRegion('track-1', {
            id: SOURCE_REGION_ID,
            startTime: 10,
            sourceStartTime: 0,
            duration: 5,
          }),
        'REGION_ID_CONFLICT'
      );

      expect(addRegionSpy).not.toHaveBeenCalled();
      expect(session.getState().tracks.get('track-1')?.regions).toHaveLength(1);
    });

    it('addRegion은 AudioEngine 대기 중 추가된 다른 Region을 보존한다', async () => {
      stageSource(audioSourceRegistry);
      const deferred = createDeferredVoid();
      vi.spyOn(engine, 'addRegion').mockReturnValueOnce(deferred.promise);

      const addRegionPromise = controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      audioSourceRegistry.attach({ sourceId: SOURCE_ID, regionId: SECOND_SOURCE_REGION_ID });
      session.getState().updateTrack('track-1', {
        regions: [
          {
            ...createDefaultRegionProcessingState(),
            id: SECOND_SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 20,
            endTime: 25,
            sourceStartTime: 0,
            duration: 5,
            status: [],
          },
        ],
      });

      deferred.resolve();
      await addRegionPromise;

      expect(
        session
          .getState()
          .tracks.get('track-1')
          ?.regions.map(region => region.id)
      ).toEqual([SECOND_SOURCE_REGION_ID, SOURCE_REGION_ID]);
    });

    it('addRegion은 AudioEngine 대기 중 트랙이 사라지면 명확한 오류를 반환한다', async () => {
      stageSource(audioSourceRegistry);
      const deferred = createDeferredVoid();
      vi.spyOn(engine, 'addRegion').mockReturnValueOnce(deferred.promise);
      const removeRegionSpy = vi.spyOn(engine, 'removeRegion');

      const addRegionPromise = controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      session.getState().removeTrack('track-1');

      deferred.resolve();
      await expectRejectedProjectStateError(() => addRegionPromise, 'TRACK_NOT_FOUND');
      expect(removeRegionSpy).toHaveBeenCalledWith('track-1', SOURCE_REGION_ID);
    });

    it('removeRegion 호출 가능', async () => {
      await addRegisteredTestRegion();
      expect(() => controller.region.removeRegion('track-1', SOURCE_REGION_ID)).not.toThrow();
      expect(session.getState().tracks.get('track-1')?.regions).toHaveLength(0);
    });

    it('sourceId Region 제거가 실패하면 Source 연결과 Session을 복원한다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      vi.spyOn(engine, 'removeRegion').mockImplementationOnce(() => {
        throw new Error('remove failed');
      });

      expect(() => controller.region.removeRegion('track-1', SOURCE_REGION_ID)).toThrowError('remove failed');

      expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([SOURCE_REGION_ID]);
      expect(session.getState().tracks.get('track-1')?.regions).toHaveLength(1);
    });

    it('sourceId Region 제거와 연결 복원이 모두 실패하면 원래 오류와 보상 오류를 함께 보존한다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      const removeFailure = new Error('remove failed');
      const compensationFailure = new Error('attach failed');
      vi.spyOn(engine, 'removeRegion').mockImplementationOnce(() => {
        throw removeFailure;
      });
      vi.spyOn(audioSourceRegistry, 'attach').mockImplementationOnce(() => {
        throw compensationFailure;
      });

      let thrownError: unknown;
      try {
        controller.region.removeRegion('track-1', SOURCE_REGION_ID);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ProjectMutationCompensationError);
      expect(thrownError).toMatchObject({
        operation: 'remove-region',
        failedPhase: 'Source 연결 복원',
        compensationFailures: [{ cause: compensationFailure }],
      });
      expect((thrownError as ProjectMutationCompensationError).cause).toBe(removeFailure);
      expect(session.getState().tracks.get('track-1')?.regions).toHaveLength(1);
    });

    it('sourceId Region을 분할하면 기존 연결을 두 새 Region 연결로 교체한다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });

      await controller.region.splitRegionById({
        trackId: 'track-1',
        regionId: SOURCE_REGION_ID,
        splitTime: 4,
      });

      const regions = session.getState().tracks.get('track-1')?.regions ?? [];
      expect(regions).toHaveLength(2);
      expect(regions.every(region => region.sourceId === SOURCE_ID)).toBe(true);
      expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual(regions.map(region => region.id));
    });

    it('sourceId Region 분할이 실패하면 기존 연결을 복원한다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      vi.spyOn(engine, 'replaceRegion').mockRejectedValueOnce(new Error('replace failed'));

      const splitRegionPromise = controller.region.splitRegionById({
        trackId: 'track-1',
        regionId: SOURCE_REGION_ID,
        splitTime: 4,
      });

      expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([
        SOURCE_REGION_ID,
        expect.any(String),
        expect.any(String),
      ]);

      await expect(splitRegionPromise).rejects.toThrowError('replace failed');

      expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([SOURCE_REGION_ID]);
      expect(
        session
          .getState()
          .tracks.get('track-1')
          ?.regions.map(region => region.id)
      ).toEqual([SOURCE_REGION_ID]);
    });

    it('sourceId Region 분할 준비 취소 중 한 연결 해제가 실패해도 나머지를 정리한다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      vi.spyOn(engine, 'replaceRegion').mockRejectedValueOnce(new Error('replace failed'));
      const detach = audioSourceRegistry.detach.bind(audioSourceRegistry);
      let failedRegionId: string | undefined;
      vi.spyOn(audioSourceRegistry, 'detach').mockImplementation(attachment => {
        if (!failedRegionId) {
          failedRegionId = attachment.regionId;
          throw new Error('detach failed');
        }
        detach(attachment);
      });

      await expect(
        controller.region.splitRegionById({
          trackId: 'track-1',
          regionId: SOURCE_REGION_ID,
          splitTime: 4,
        })
      ).rejects.toMatchObject({
        operation: 'split-region',
        failedPhase: '분할 Source 준비 취소',
        compensationFailures: [{ step: expect.stringContaining('분할 Source 연결 해제') }],
      });

      expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([SOURCE_REGION_ID, failedRegionId]);
      expect(
        session
          .getState()
          .tracks.get('track-1')
          ?.regions.map(region => region.id)
      ).toEqual([SOURCE_REGION_ID]);
    });

    it('sourceId 전환이 실패하면 Engine과 Registry를 기존 Region 상태로 되돌린다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      const detach = audioSourceRegistry.detach.bind(audioSourceRegistry);
      vi.spyOn(audioSourceRegistry, 'detach').mockImplementation(attachment => {
        if (attachment.regionId === SOURCE_REGION_ID) {
          throw new Error('detach failed');
        }
        detach(attachment);
      });
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expect(
        controller.region.splitRegionById({
          trackId: 'track-1',
          regionId: SOURCE_REGION_ID,
          splitTime: 4,
        })
      ).rejects.toThrowError('detach failed');

      expect(addRegionSpy).toHaveBeenCalledWith('track-1', {
        ...createDefaultRegionProcessingState(),
        id: SOURCE_REGION_ID,
        url: SOURCE_OBJECT_URL,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([SOURCE_REGION_ID]);
      expect(
        session
          .getState()
          .tracks.get('track-1')
          ?.regions.map(region => region.id)
      ).toEqual([SOURCE_REGION_ID]);
    });

    it('splitRegion은 찾은 Region ID로 splitRegionById에 위임한다', async () => {
      await addRegisteredTestRegion();

      const splitRegionByIdSpy = vi.spyOn(controller.region, 'splitRegionById');

      await expect(controller.region.splitRegion('track-1', 2.5)).resolves.toBeUndefined();
      expect(splitRegionByIdSpy).toHaveBeenCalledWith({
        trackId: 'track-1',
        regionId: SOURCE_REGION_ID,
        splitTime: 2.5,
      });
    });

    it('splitRegion은 같은 시각에 Region이 겹치면 AudioEngine 호출 전에 거부한다', async () => {
      await addRegisteredTestRegion();
      await addRegisteredTestRegion({ regionId: SECOND_SOURCE_REGION_ID, startTime: 2 });
      const replaceRegionSpy = vi.spyOn(engine, 'replaceRegion');
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      await expectRejectedProjectStateError(
        () => controller.region.splitRegion('track-1', 5),
        'AMBIGUOUS_REGION_TARGET'
      );

      expect(replaceRegionSpy).not.toHaveBeenCalled();
      expect(session.getState().tracks.get('track-1')?.regions).toBe(regionsBefore);
    });

    it('splitRegionById는 겹친 Region 중 지정한 Region만 교체한다', async () => {
      stageSource(audioSourceRegistry, 13);
      await addRegisteredTestRegion();
      await addRegisteredTestRegion({ regionId: SECOND_SOURCE_REGION_ID, sourceStartTime: 3 });
      const replaceRegionSpy = vi.spyOn(engine, 'replaceRegion');

      await controller.region.splitRegionById({
        trackId: 'track-1',
        regionId: SECOND_SOURCE_REGION_ID,
        splitTime: 4,
      });

      expect(replaceRegionSpy).toHaveBeenCalledWith({
        trackId: 'track-1',
        regionId: SECOND_SOURCE_REGION_ID,
        replacements: [
          expect.objectContaining({ url: SOURCE_OBJECT_URL, startTime: 0, sourceStartTime: 3, duration: 4 }),
          expect.objectContaining({ url: SOURCE_OBJECT_URL, startTime: 4, sourceStartTime: 7, duration: 6 }),
        ],
      });
      const regions = session.getState().tracks.get('track-1')?.regions;
      expect(regions).toHaveLength(3);
      expect(regions?.[0].id).toBe(SOURCE_REGION_ID);
      expect(regions?.[1]).toMatchObject({ startTime: 0, endTime: 4, duration: 4 });
      expect(regions?.[2]).toMatchObject({ startTime: 4, endTime: 10, duration: 6 });
    });

    it('splitRegionById는 기존 Region의 끝 시각이 길이와 다르면 부작용 전에 거부한다', async () => {
      stageSource(audioSourceRegistry, null);
      audioSourceRegistry.attach({ sourceId: SOURCE_ID, regionId: SOURCE_REGION_ID });
      session.getState().updateTrack('track-1', {
        regions: [
          {
            ...createDefaultRegionProcessingState(),
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            endTime: 15,
            sourceStartTime: 0,
            duration: 10,
            status: [],
          },
        ],
      });
      const replaceRegionSpy = vi.spyOn(engine, 'replaceRegion');
      const sourceBefore = audioSourceRegistry.resolve(SOURCE_ID);
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      await expect(
        controller.region.splitRegionById({ trackId: 'track-1', regionId: SOURCE_REGION_ID, splitTime: 12 })
      ).rejects.toMatchObject({ code: 'INVALID_REGION_TIMELINE_RANGE' });

      expect(replaceRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toEqual(sourceBefore);
      expect(session.getState().tracks.get('track-1')?.regions).toBe(regionsBefore);
    });

    it('splitRegionById는 길이를 모르는 Source의 기존 원본 범위 overflow를 부작용 전에 거부한다', async () => {
      stageSource(audioSourceRegistry, null);
      audioSourceRegistry.attach({ sourceId: SOURCE_ID, regionId: SOURCE_REGION_ID });
      session.getState().updateTrack('track-1', {
        regions: [
          {
            ...createDefaultRegionProcessingState(),
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            endTime: Number.MAX_VALUE,
            sourceStartTime: Number.MAX_VALUE,
            duration: Number.MAX_VALUE,
            status: [],
          },
        ],
      });
      const attachSpy = vi.spyOn(audioSourceRegistry, 'attach');
      const replaceRegionSpy = vi.spyOn(engine, 'replaceRegion');
      const sourceBefore = audioSourceRegistry.resolve(SOURCE_ID);
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      await expect(
        controller.region.splitRegionById({
          trackId: 'track-1',
          regionId: SOURCE_REGION_ID,
          splitTime: Number.MAX_VALUE / 2,
        })
      ).rejects.toMatchObject({ code: 'INVALID_REGION_SOURCE_RANGE' });

      expect(attachSpy).not.toHaveBeenCalled();
      expect(replaceRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toEqual(sourceBefore);
      expect(session.getState().tracks.get('track-1')?.regions).toBe(regionsBefore);
    });

    it('splitRegionById는 알려진 Source 길이를 넘는 기존 원본 범위를 부작용 전에 거부한다', async () => {
      stageSource(audioSourceRegistry, 10);
      audioSourceRegistry.attach({ sourceId: SOURCE_ID, regionId: SOURCE_REGION_ID });
      session.getState().updateTrack('track-1', {
        regions: [
          {
            ...createDefaultRegionProcessingState(),
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            endTime: 5,
            sourceStartTime: 8,
            duration: 5,
            status: [],
          },
        ],
      });
      const attachSpy = vi.spyOn(audioSourceRegistry, 'attach');
      const replaceRegionSpy = vi.spyOn(engine, 'replaceRegion');
      const sourceBefore = audioSourceRegistry.resolve(SOURCE_ID);
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      await expect(
        controller.region.splitRegionById({ trackId: 'track-1', regionId: SOURCE_REGION_ID, splitTime: 2 })
      ).rejects.toMatchObject({ code: 'REGION_SOURCE_RANGE_EXCEEDED' });

      expect(attachSpy).not.toHaveBeenCalled();
      expect(replaceRegionSpy).not.toHaveBeenCalled();
      expect(audioSourceRegistry.resolve(SOURCE_ID)).toEqual(sourceBefore);
      expect(session.getState().tracks.get('track-1')?.regions).toBe(regionsBefore);
    });

    it('splitRegionById는 계산한 Region 끝을 넘는 분할 위치를 거부한다', async () => {
      stageSource(audioSourceRegistry, null);
      audioSourceRegistry.attach({ sourceId: SOURCE_ID, regionId: SOURCE_REGION_ID });
      session.getState().updateTrack('track-1', {
        regions: [
          {
            ...createDefaultRegionProcessingState(),
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            endTime: 10 + 0.5e-9,
            sourceStartTime: 0,
            duration: 10,
            status: [],
          },
        ],
      });
      const replaceRegionSpy = vi.spyOn(engine, 'replaceRegion');

      await expect(
        controller.region.splitRegionById({
          trackId: 'track-1',
          regionId: SOURCE_REGION_ID,
          splitTime: 10 + 0.25e-9,
        })
      ).rejects.toMatchObject({ code: 'INVALID_SPLIT_POSITION' });

      expect(replaceRegionSpy).not.toHaveBeenCalled();
    });

    it.each([0, 10])('splitRegionById는 Region 경계 %s에서 분할을 거부한다', async splitTime => {
      await addRegisteredTestRegion();

      await expect(
        controller.region.splitRegionById({ trackId: 'track-1', regionId: SOURCE_REGION_ID, splitTime })
      ).rejects.toMatchObject({ code: 'INVALID_SPLIT_POSITION' });
    });

    it('splitRegionById는 없는 트랙을 거부한다', async () => {
      await expect(
        controller.region.splitRegionById({
          trackId: 'missing-track',
          regionId: 'region-1',
          splitTime: 5,
        })
      ).rejects.toMatchObject({ code: 'TRACK_NOT_FOUND' });
    });

    it('splitRegionById는 없는 Region ID를 거부한다', async () => {
      await expect(
        controller.region.splitRegionById({ trackId: 'track-1', regionId: 'missing-region', splitTime: 5 })
      ).rejects.toMatchObject({ code: 'REGION_NOT_FOUND' });
    });

    it('splitRegionById는 오디오 소스가 없는 Region을 거부한다', async () => {
      session.getState().updateTrack('track-1', {
        regions: [
          {
            ...createDefaultRegionProcessingState(),
            id: 'region-1',
            sourceId: SOURCE_ID,
            startTime: 0,
            endTime: 10,
            sourceStartTime: 0,
            duration: 10,
            status: [],
          },
        ],
      });

      await expect(
        controller.region.splitRegionById({ trackId: 'track-1', regionId: 'region-1', splitTime: 5 })
      ).rejects.toMatchObject({ code: 'REGION_SOURCE_MISSING' });
    });

    it('splitRegionById의 AudioEngine 호출이 실패하면 SessionStore를 변경하지 않는다', async () => {
      await addRegisteredTestRegion();
      vi.spyOn(engine, 'replaceRegion').mockRejectedValueOnce(new Error('replace failed'));
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      await expect(
        controller.region.splitRegionById({ trackId: 'track-1', regionId: SOURCE_REGION_ID, splitTime: 5 })
      ).rejects.toThrowError('replace failed');
      expect(session.getState().tracks.get('track-1')?.regions).toBe(regionsBefore);
    });

    it('splitRegionById는 AudioEngine 대기 중 추가된 다른 Region을 보존한다', async () => {
      await addRegisteredTestRegion();
      const deferred = createDeferredVoid();
      vi.spyOn(engine, 'replaceRegion').mockReturnValueOnce(deferred.promise);

      const splitRegionPromise = controller.region.splitRegionById({
        trackId: 'track-1',
        regionId: SOURCE_REGION_ID,
        splitTime: 5,
      });
      const currentRegions = session.getState().tracks.get('track-1')?.regions ?? [];
      audioSourceRegistry.attach({ sourceId: SOURCE_ID, regionId: SECOND_SOURCE_REGION_ID });
      session.getState().updateTrack('track-1', {
        regions: [
          ...currentRegions,
          {
            ...createDefaultRegionProcessingState(),
            id: SECOND_SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 20,
            endTime: 25,
            sourceStartTime: 0,
            duration: 5,
            status: [],
          },
        ],
      });

      deferred.resolve();
      await splitRegionPromise;

      const updatedRegions = session.getState().tracks.get('track-1')?.regions;
      expect(updatedRegions).toHaveLength(3);
      expect(updatedRegions?.map(region => region.id)).toContain(SECOND_SOURCE_REGION_ID);
      expect(updatedRegions?.map(region => region.id)).not.toContain(SOURCE_REGION_ID);
    });

    it('sourceId Region 분할 대기 중 대상이 사라지면 Engine과 Source 연결을 모두 정리한다', async () => {
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      const deferred = createDeferredVoid();
      const replaceRegionSpy = vi.spyOn(engine, 'replaceRegion').mockReturnValueOnce(deferred.promise);
      const removeRegionSpy = vi.spyOn(engine, 'removeRegion');

      const splitRegionPromise = controller.region.splitRegionById({
        trackId: 'track-1',
        regionId: SOURCE_REGION_ID,
        splitTime: 5,
      });
      const splitRegionIds = audioSourceRegistry.resolve(SOURCE_ID)?.regionIds ?? [];
      session.getState().updateTrack('track-1', { regions: [] });

      deferred.resolve();
      await expectRejectedProjectStateError(() => splitRegionPromise, 'REGION_NOT_FOUND');

      const replacements = replaceRegionSpy.mock.calls[0]?.[0].replacements ?? [];
      expect(splitRegionIds).toEqual([SOURCE_REGION_ID, ...replacements.map(region => region.id)]);
      expect(removeRegionSpy.mock.calls.map(([, removedRegionId]) => removedRegionId)).toEqual(
        [...replacements].reverse().map(region => region.id)
      );
      expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([]);
      expect(session.getState().tracks.get('track-1')?.regions).toEqual([]);
    });

    it('splitRegion은 분할할 Region이 없으면 명확한 오류를 반환한다', async () => {
      await expect(controller.region.splitRegion('track-1', 2.5)).rejects.toMatchObject({
        code: 'INVALID_SPLIT_POSITION',
      });
    });

    it('moveRegion은 AudioEngine 성공 뒤 시작과 끝 시간을 함께 변경한다', async () => {
      await addRegisteredTestRegion({ sourceStartTime: 2 });
      const rescheduleRegionSpy = vi.spyOn(engine, 'rescheduleRegion');

      controller.region.moveRegion({ trackId: 'track-1', regionId: SOURCE_REGION_ID, newStartTime: 5 });

      expect(rescheduleRegionSpy).toHaveBeenCalledWith({
        trackId: 'track-1',
        regionId: SOURCE_REGION_ID,
        startTime: 5,
      });
      expect(session.getState().tracks.get('track-1')?.regions[0]).toMatchObject({
        id: SOURCE_REGION_ID,
        startTime: 5,
        endTime: 15,
        sourceStartTime: 2,
        duration: 10,
        sourceId: SOURCE_ID,
      });
    });

    it('moveRegion의 AudioEngine 호출이 실패하면 SessionStore를 변경하지 않는다', async () => {
      await addRegisteredTestRegion();
      vi.spyOn(engine, 'rescheduleRegion').mockImplementationOnce(() => {
        throw new Error('reschedule failed');
      });
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      expect(() =>
        controller.region.moveRegion({ trackId: 'track-1', regionId: SOURCE_REGION_ID, newStartTime: 5 })
      ).toThrowError('reschedule failed');
      expect(session.getState().tracks.get('track-1')?.regions).toBe(regionsBefore);
    });

    it('moveRegion은 음수 시작 위치를 AudioEngine 호출 전에 거부한다', async () => {
      await addRegisteredTestRegion();
      const rescheduleRegionSpy = vi.spyOn(engine, 'rescheduleRegion');
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      expectProjectStateError(
        () => controller.region.moveRegion({ trackId: 'track-1', regionId: SOURCE_REGION_ID, newStartTime: -0.1 }),
        'INVALID_REGION_POSITION'
      );

      expect(rescheduleRegionSpy).not.toHaveBeenCalled();
      expect(session.getState().tracks.get('track-1')?.regions).toBe(regionsBefore);
    });

    it('moveRegion은 새 끝 시각 overflow를 AudioEngine 호출 전에 거부한다', () => {
      session.getState().updateTrack('track-1', {
        regions: [
          {
            ...createDefaultRegionProcessingState(),
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            endTime: Number.MAX_VALUE,
            sourceStartTime: 0,
            duration: Number.MAX_VALUE,
            status: [],
          },
        ],
      });
      const rescheduleRegionSpy = vi.spyOn(engine, 'rescheduleRegion');
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      expectProjectStateError(
        () =>
          controller.region.moveRegion({
            trackId: 'track-1',
            regionId: SOURCE_REGION_ID,
            newStartTime: Number.MAX_VALUE,
          }),
        'INVALID_REGION_TIMELINE_RANGE'
      );

      expect(rescheduleRegionSpy).not.toHaveBeenCalled();
      expect(session.getState().tracks.get('track-1')?.regions).toBe(regionsBefore);
    });

    it('moveRegion은 없는 트랙을 거부한다', () => {
      expectProjectStateError(
        () => controller.region.moveRegion({ trackId: 'missing-track', regionId: 'region-1', newStartTime: 5 }),
        'TRACK_NOT_FOUND'
      );
    });

    it('moveRegion은 없는 Region ID를 거부한다', () => {
      expectProjectStateError(
        () => controller.region.moveRegion({ trackId: 'track-1', regionId: 'missing-region', newStartTime: 5 }),
        'REGION_NOT_FOUND'
      );
    });
  });

  describe('ExportController', () => {
    it('검증된 Export preset과 다중 range를 Session에 저장한다', () => {
      controller.export.setExportSettings({
        activePresetId: 'preset-24',
        presets: [
          {
            channelMode: 'mono',
            dither: 'tpdf',
            exportMode: 'mix',
            format: 'wav',
            id: 'preset-24',
            name: 'WAV 24-bit',
            normalization: { mode: 'lufs', targetLufs: -14 },
            sampleFormat: 'pcm24',
            sampleRate: 48_000,
          },
        ],
        ranges: [
          {
            endTimeSeconds: 8,
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Verse',
            startTimeSeconds: 2,
          },
        ],
      });

      expect(session.getState().exportSettings).toMatchObject({
        activePresetId: 'preset-24',
        ranges: [{ name: 'Verse' }],
      });
    });

    it('저장된 preset과 range로 RenderJob을 시작한다', async () => {
      await controller.track.addTrack('track-1');
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        duration: 10,
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        sourceStartTime: 0,
        startTime: 0,
      });
      controller.export.setExportSettings({
        activePresetId: 'preset-24',
        presets: [
          {
            channelMode: 'stereo',
            dither: 'none',
            exportMode: 'stems',
            format: 'wav',
            id: 'preset-24',
            name: 'Stems',
            normalization: { mode: 'none' },
            sampleFormat: 'float32',
            sampleRate: 48_000,
          },
        ],
        ranges: [
          {
            endTimeSeconds: 8,
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Verse',
            startTimeSeconds: 2,
          },
        ],
      });
      const renderSpy = vi.spyOn(engine, 'startRenderJob');

      const result = await controller.export.startRenderJob();

      expect(result.files).toHaveLength(1);
      expect(renderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: expect.any(String),
          preset: expect.objectContaining({ sampleFormat: 'float32', sampleRate: 48_000 }),
          ranges: [expect.objectContaining({ name: 'Verse', startTimeSeconds: 2, endTimeSeconds: 8 })],
          tracks: [expect.objectContaining({ id: 'track-1' })],
        })
      );
    });

    it('setExportRange 호출 가능', () => {
      expect(() => controller.export.setExportRange(2, 8)).not.toThrow();
    });

    it('setExportRange null 허용', () => {
      expect(() => controller.export.setExportRange(null, null)).not.toThrow();
    });

    it('setExportRange는 길이 0인 드래그 시작 범위를 허용한다', () => {
      expect(() => controller.export.setExportRange(2, 2)).not.toThrow();
      expect(session.getState()).toMatchObject({ exportStartTime: 2, exportEndTime: 2 });
    });

    it.each([
      [8, 2],
      [-1, 2],
      [0, Number.POSITIVE_INFINITY],
      [null, 2],
      [2, null],
    ] as Array<[number | null, number | null]>)(
      'setExportRange는 저장할 수 없는 범위(%s, %s)를 거부한다',
      (startTime, endTime) => {
        controller.export.setExportRange(1, 4);

        expectProjectStateError(() => controller.export.setExportRange(startTime, endTime), 'INVALID_EXPORT_RANGE');
        expect(session.getState()).toMatchObject({ exportStartTime: 1, exportEndTime: 4 });
      }
    );

    it('exportProject Blob 반환', async () => {
      await controller.track.addTrack('track-1');
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      controller.export.setExportRange(2, 8);
      const exportSpy = vi.spyOn(engine, 'exportProject');

      const blob = await controller.export.exportProject();

      expect(blob).toBeInstanceOf(Blob);
      expect(exportSpy).toHaveBeenCalledWith(expect.objectContaining({ range: { startTime: 2, endTime: 8 } }));
    });

    it('exportRange Blob 반환', async () => {
      await controller.track.addTrack('track-1');
      stageSource(audioSourceRegistry, 11);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 1,
        duration: 10,
      });
      session.getState().updateTrack('track-1', {
        pluginInstances: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            manifestSummary: { id: 'builtin.gain', name: 'Gain', version: '1.0.0' },
            isEnabled: false,
            parameters: [{ id: 'gain', value: 0.75 }],
          },
        ],
      });
      const exportSpy = vi.spyOn(engine, 'exportProject');

      const blob = await controller.export.exportRange(2, 8);

      expect(blob).toBeInstanceOf(Blob);
      expect(exportSpy).toHaveBeenCalledWith({
        tracks: [
          {
            automationLanes: [],
            id: 'track-1',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [
              {
                instanceId: '55555555-5555-4555-8555-555555555555',
                manifestId: 'builtin.gain',
                isEnabled: false,
                parameterValues: new Map([['gain', 0.75]]),
              },
            ],
            regions: [
              {
                ...createDefaultRegionProcessingState(),
                id: SOURCE_REGION_ID,
                url: SOURCE_OBJECT_URL,
                startTime: 0,
                sourceStartTime: 1,
                duration: 10,
              },
            ],
          },
        ],
        masterVolume: 1,
        range: { startTime: 2, endTime: 8 },
        routingGraph: {
          routes: [
            {
              channelCount: 2,
              folderId: null,
              kind: 'audio',
              output: { kind: 'master' },
              trackId: 'track-1',
              vcaIds: [],
            },
          ],
          sends: [],
        },
        sampleRate: 44100,
      });
    });

    it('sourceId Region Export는 Registry URL을 AudioEngine 요청에 사용한다', async () => {
      await controller.track.addTrack('track-1');
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 1,
        duration: 9,
      });
      const exportSpy = vi.spyOn(engine, 'exportProject');

      await controller.export.exportRange(2, 8);

      expect(exportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tracks: [
            expect.objectContaining({
              regions: [expect.objectContaining({ id: SOURCE_REGION_ID, url: SOURCE_OBJECT_URL })],
            }),
          ],
        })
      );
    });

    it('sourceId Region의 Registry 항목이 없으면 Export를 명확히 거부한다', async () => {
      await controller.track.addTrack('track-1');
      session.getState().updateTrack('track-1', {
        regions: [
          {
            ...createDefaultRegionProcessingState(),
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            endTime: 10,
            sourceStartTime: 0,
            duration: 10,
            status: [],
          },
        ],
      });
      const exportSpy = vi.spyOn(engine, 'exportProject');

      await expectRejectedProjectStateError(() => controller.export.exportProject(), 'REGION_SOURCE_MISSING');

      expect(exportSpy).not.toHaveBeenCalled();
    });

    it('sourceId Region과 Registry 연결이 끊겼으면 Export를 명확히 거부한다', async () => {
      await controller.track.addTrack('track-1');
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      audioSourceRegistry.detach({ sourceId: SOURCE_ID, regionId: SOURCE_REGION_ID });
      const exportSpy = vi.spyOn(engine, 'exportProject');

      await expectRejectedProjectStateError(() => controller.export.exportProject(), 'REGION_SOURCE_MISSING');

      expect(exportSpy).not.toHaveBeenCalled();
    });

    it('길이가 0인 sourceId Region도 Source 연결이 없으면 Export에서 거부한다', async () => {
      await controller.track.addTrack('track-1');
      stageSource(audioSourceRegistry);
      session.getState().updateTrack('track-1', {
        regions: [
          {
            ...createDefaultRegionProcessingState(),
            id: SOURCE_REGION_ID,
            sourceId: SOURCE_ID,
            startTime: 0,
            endTime: 0,
            sourceStartTime: 0,
            duration: 0,
            status: [],
          },
        ],
      });
      const exportSpy = vi.spyOn(engine, 'exportProject');

      await expectRejectedProjectStateError(() => controller.export.exportRange(0, 1), 'REGION_SOURCE_MISSING');

      expect(exportSpy).not.toHaveBeenCalled();
    });

    it('길이가 0인 Export 범위를 거부한다', async () => {
      await controller.track.addTrack('track-1');
      stageSource(audioSourceRegistry);
      await controller.region.addRegion('track-1', {
        id: SOURCE_REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });

      await expect(controller.export.exportRange(2, 2)).rejects.toMatchObject({
        code: 'EXPORT_ZERO_DURATION',
      });
    });

    it('Region이 없는 프로젝트 Export를 거부한다', async () => {
      await expect(controller.export.exportProject()).rejects.toMatchObject({
        code: 'EXPORT_NO_TRACKS',
      });
    });
  });

  describe('AppController 통합', () => {
    it('모든 Controller가 AppController에 포함되어야 함', () => {
      expect(controller.playback).toBeDefined();
      expect(controller.track).toBeDefined();
      expect(controller.region).toBeDefined();
      expect(controller.export).toBeDefined();
    });

    it('각 Controller 타입 확인', () => {
      expect(controller.playback.constructor.name).toBe('PlaybackController');
      expect(controller.track.constructor.name).toBe('TrackController');
      expect(controller.region.constructor.name).toBe('RegionController');
      expect(controller.export.constructor.name).toBe('ExportController');
    });
  });

  describe('아키텍처 규칙 준수', () => {
    it('Controllers는 SessionStore를 통해 상태 업데이트', async () => {
      // Track 추가
      await controller.track.addTrack('track-1');
      expect(session.getState().tracks.size).toBe(1);

      // Volume 변경
      controller.track.setVolume('track-1', 0.5);
      expect(session.getState().tracks.get('track-1')?.volume).toBe(0.5);

      // Mute 변경
      controller.track.setMute('track-1', true);
      expect(session.getState().tracks.get('track-1')?.isMuted).toBe(true);
    });

    it('Controllers는 AudioEngine을 통해 오디오 제어', async () => {
      // Play
      await controller.playback.handlePlay();
      // MockAudioEngine이 호출되었는지 확인 (console.log로)

      // Seek
      controller.playback.handleSeek(10);
      expect(controller.playback.getCurrentTime()).toBe(10);
    });
  });
});
