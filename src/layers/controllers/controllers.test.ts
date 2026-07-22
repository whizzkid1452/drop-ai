import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { createApp } from '../apps/create-app';
import type { AppController } from './app-controller';
import type { SessionStore } from '../session/session';
import { ProjectStateError, type ProjectStateErrorCode } from './project-state-error';

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

  beforeEach(() => {
    engine = new MockAudioEngine();
    const app = createApp({ audioEngine: engine });
    controller = app.controller;
    session = app.session;
  });

  describe('PlaybackController 확장', () => {
    it('handleSeek 호출 가능', () => {
      expect(() => controller.playback.handleSeek(5.5)).not.toThrow();
    });

    it('handleSetTempo는 절대 초 단위 Session tempo만 변경한다', () => {
      expect('setTempo' in engine).toBe(false);

      expect(() => controller.playback.handleSetTempo(140)).not.toThrow();

      expect(session.getState().tempo).toBe(140);
    });

    it('getCurrentTime 반환값 확인', () => {
      engine.setTime(7.5);
      const time = controller.playback.getCurrentTime();
      expect(time).toBe(7.5);
    });
  });

  describe('TrackController 확장', () => {
    beforeEach(async () => {
      await controller.track.addTrack('test.mp3', 'track-1');
    });

    it('addTrack은 중복 Track ID를 AudioEngine 호출 전에 거부한다', async () => {
      const loadTrackSpy = vi.spyOn(engine, 'loadTrack');

      await expectRejectedProjectStateError(
        () => controller.track.addTrack('duplicate.mp3', 'track-1'),
        'TRACK_ID_CONFLICT'
      );

      expect(loadTrackSpy).not.toHaveBeenCalled();
      expect(session.getState().tracks.get('track-1')?.name).toBe('Track track-1');
    });

    it('같은 Track ID를 동시에 추가하면 먼저 완료한 호출만 Session에 반영한다', async () => {
      const deferred = createDeferredVoid();
      const loadTrackSpy = vi.spyOn(engine, 'loadTrack').mockReturnValue(deferred.promise);
      const firstAdd = controller.track.addTrack('first.mp3', 'concurrent-track');
      const secondAdd = controller.track.addTrack('second.mp3', 'concurrent-track');

      expect(loadTrackSpy).toHaveBeenCalledTimes(2);
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
      await controller.track.addTrack('test.mp3', 'track-1');
    });

    it('addRegion 호출 가능', async () => {
      await expect(
        controller.region.addRegion('track-1', {
          id: 'region-1',
          url: 'region.mp3',
          startTime: 0,
          sourceStartTime: 0,
          duration: 10,
        })
      ).resolves.toBeUndefined();
    });

    it('addRegion은 같은 트랙의 중복 Region ID를 AudioEngine 호출 전에 거부한다', async () => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      const addRegionSpy = vi.spyOn(engine, 'addRegion');

      await expectRejectedProjectStateError(
        () =>
          controller.region.addRegion('track-1', {
            id: 'region-1',
            url: 'duplicate.mp3',
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
      const deferred = createDeferredVoid();
      vi.spyOn(engine, 'addRegion').mockReturnValueOnce(deferred.promise);

      const addRegionPromise = controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      session.getState().updateTrack('track-1', {
        regions: [
          {
            id: 'concurrent-region',
            startTime: 20,
            endTime: 25,
            sourceStartTime: 0,
            duration: 5,
            status: [],
            audioFileUrl: 'concurrent.mp3',
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
      ).toEqual(['concurrent-region', 'region-1']);
    });

    it('addRegion은 AudioEngine 대기 중 트랙이 사라지면 명확한 오류를 반환한다', async () => {
      const deferred = createDeferredVoid();
      vi.spyOn(engine, 'addRegion').mockReturnValueOnce(deferred.promise);

      const addRegionPromise = controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      session.getState().removeTrack('track-1');

      deferred.resolve();
      await expectRejectedProjectStateError(() => addRegionPromise, 'TRACK_NOT_FOUND');
    });

    it('removeRegion 호출 가능', async () => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      expect(() => controller.region.removeRegion('track-1', 'region-1')).not.toThrow();
      expect(session.getState().tracks.get('track-1')?.regions).toHaveLength(0);
    });

    it('splitRegion은 찾은 Region ID로 splitRegionById에 위임한다', async () => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });

      const splitRegionByIdSpy = vi.spyOn(controller.region, 'splitRegionById');

      await expect(controller.region.splitRegion('track-1', 2.5)).resolves.toBeUndefined();
      expect(splitRegionByIdSpy).toHaveBeenCalledWith({
        trackId: 'track-1',
        regionId: 'region-1',
        splitTime: 2.5,
      });
    });

    it('splitRegion은 같은 시각에 Region이 겹치면 AudioEngine 호출 전에 거부한다', async () => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'first.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      await controller.region.addRegion('track-1', {
        id: 'region-2',
        url: 'second.mp3',
        startTime: 2,
        sourceStartTime: 0,
        duration: 10,
      });
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
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'first.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      await controller.region.addRegion('track-1', {
        id: 'region-2',
        url: 'second.mp3',
        startTime: 0,
        sourceStartTime: 3,
        duration: 10,
      });
      const replaceRegionSpy = vi.spyOn(engine, 'replaceRegion');

      await controller.region.splitRegionById({ trackId: 'track-1', regionId: 'region-2', splitTime: 4 });

      expect(replaceRegionSpy).toHaveBeenCalledWith({
        trackId: 'track-1',
        regionId: 'region-2',
        replacements: [
          expect.objectContaining({ url: 'second.mp3', startTime: 0, sourceStartTime: 3, duration: 4 }),
          expect.objectContaining({ url: 'second.mp3', startTime: 4, sourceStartTime: 7, duration: 6 }),
        ],
      });
      const regions = session.getState().tracks.get('track-1')?.regions;
      expect(regions).toHaveLength(3);
      expect(regions?.[0].id).toBe('region-1');
      expect(regions?.[1]).toMatchObject({ startTime: 0, endTime: 4, duration: 4 });
      expect(regions?.[2]).toMatchObject({ startTime: 4, endTime: 10, duration: 6 });
    });

    it.each([0, 10])('splitRegionById는 Region 경계 %s에서 분할을 거부한다', async splitTime => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });

      await expect(
        controller.region.splitRegionById({ trackId: 'track-1', regionId: 'region-1', splitTime })
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
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: '',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });

      await expect(
        controller.region.splitRegionById({ trackId: 'track-1', regionId: 'region-1', splitTime: 5 })
      ).rejects.toMatchObject({ code: 'REGION_SOURCE_MISSING' });
    });

    it('splitRegionById의 AudioEngine 호출이 실패하면 SessionStore를 변경하지 않는다', async () => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      vi.spyOn(engine, 'replaceRegion').mockRejectedValueOnce(new Error('replace failed'));
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      await expect(
        controller.region.splitRegionById({ trackId: 'track-1', regionId: 'region-1', splitTime: 5 })
      ).rejects.toThrowError('replace failed');
      expect(session.getState().tracks.get('track-1')?.regions).toBe(regionsBefore);
    });

    it('splitRegionById는 AudioEngine 대기 중 추가된 다른 Region을 보존한다', async () => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      const deferred = createDeferredVoid();
      vi.spyOn(engine, 'replaceRegion').mockReturnValueOnce(deferred.promise);

      const splitRegionPromise = controller.region.splitRegionById({
        trackId: 'track-1',
        regionId: 'region-1',
        splitTime: 5,
      });
      const currentRegions = session.getState().tracks.get('track-1')?.regions ?? [];
      session.getState().updateTrack('track-1', {
        regions: [
          ...currentRegions,
          {
            id: 'concurrent-region',
            startTime: 20,
            endTime: 25,
            sourceStartTime: 0,
            duration: 5,
            status: [],
            audioFileUrl: 'concurrent.mp3',
          },
        ],
      });

      deferred.resolve();
      await splitRegionPromise;

      const updatedRegions = session.getState().tracks.get('track-1')?.regions;
      expect(updatedRegions).toHaveLength(3);
      expect(updatedRegions?.map(region => region.id)).toContain('concurrent-region');
      expect(updatedRegions?.map(region => region.id)).not.toContain('region-1');
    });

    it('splitRegionById는 AudioEngine 대기 중 대상 Region이 사라지면 명확한 오류를 반환한다', async () => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      const deferred = createDeferredVoid();
      vi.spyOn(engine, 'replaceRegion').mockReturnValueOnce(deferred.promise);

      const splitRegionPromise = controller.region.splitRegionById({
        trackId: 'track-1',
        regionId: 'region-1',
        splitTime: 5,
      });
      session.getState().updateTrack('track-1', { regions: [] });

      deferred.resolve();
      await expectRejectedProjectStateError(() => splitRegionPromise, 'REGION_NOT_FOUND');
    });

    it('splitRegion은 분할할 Region이 없으면 명확한 오류를 반환한다', async () => {
      await expect(controller.region.splitRegion('track-1', 2.5)).rejects.toMatchObject({
        code: 'INVALID_SPLIT_POSITION',
      });
    });

    it('moveRegion은 AudioEngine 성공 뒤 시작과 끝 시간을 함께 변경한다', async () => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 2,
        duration: 10,
      });
      const rescheduleRegionSpy = vi.spyOn(engine, 'rescheduleRegion');

      controller.region.moveRegion({ trackId: 'track-1', regionId: 'region-1', newStartTime: 5 });

      expect(rescheduleRegionSpy).toHaveBeenCalledWith({ trackId: 'track-1', regionId: 'region-1', startTime: 5 });
      expect(session.getState().tracks.get('track-1')?.regions[0]).toMatchObject({
        id: 'region-1',
        startTime: 5,
        endTime: 15,
        sourceStartTime: 2,
        duration: 10,
        audioFileUrl: 'region.mp3',
      });
    });

    it('moveRegion의 AudioEngine 호출이 실패하면 SessionStore를 변경하지 않는다', async () => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      vi.spyOn(engine, 'rescheduleRegion').mockImplementationOnce(() => {
        throw new Error('reschedule failed');
      });
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      expect(() =>
        controller.region.moveRegion({ trackId: 'track-1', regionId: 'region-1', newStartTime: 5 })
      ).toThrowError('reschedule failed');
      expect(session.getState().tracks.get('track-1')?.regions).toBe(regionsBefore);
    });

    it('moveRegion은 음수 시작 위치를 AudioEngine 호출 전에 거부한다', async () => {
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 0,
        duration: 10,
      });
      const rescheduleRegionSpy = vi.spyOn(engine, 'rescheduleRegion');
      const regionsBefore = session.getState().tracks.get('track-1')?.regions;

      expectProjectStateError(
        () => controller.region.moveRegion({ trackId: 'track-1', regionId: 'region-1', newStartTime: -0.1 }),
        'INVALID_REGION_POSITION'
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
    it('setExportRange 호출 가능', () => {
      expect(() => controller.export.setExportRange(2, 8)).not.toThrow();
    });

    it('setExportRange null 허용', () => {
      expect(() => controller.export.setExportRange(null, null)).not.toThrow();
    });

    it('exportProject Blob 반환', async () => {
      await controller.track.addTrack('test.mp3', 'track-1');
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
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
      await controller.track.addTrack('test.mp3', 'track-1');
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
        startTime: 0,
        sourceStartTime: 1,
        duration: 10,
      });
      const exportSpy = vi.spyOn(engine, 'exportProject');

      const blob = await controller.export.exportRange(2, 8);

      expect(blob).toBeInstanceOf(Blob);
      expect(exportSpy).toHaveBeenCalledWith({
        tracks: [
          {
            id: 'track-1',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            regions: [
              {
                id: 'region-1',
                url: 'region.mp3',
                startTime: 0,
                sourceStartTime: 1,
                duration: 10,
              },
            ],
          },
        ],
        masterVolume: 1,
        range: { startTime: 2, endTime: 8 },
        sampleRate: 44100,
      });
    });

    it('길이가 0인 Export 범위를 거부한다', async () => {
      await controller.track.addTrack('test.mp3', 'track-1');
      await controller.region.addRegion('track-1', {
        id: 'region-1',
        url: 'region.mp3',
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
      await controller.track.addTrack('test.mp3', 'track-1');
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
