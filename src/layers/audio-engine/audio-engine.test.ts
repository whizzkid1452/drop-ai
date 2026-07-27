import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { AudioEngineErrorCode } from './errors';
import { MockAudioEngine } from './mock-audio-engine';
import type { RegionData } from './i-audio-engine';

describe('MockAudioEngine - Phase 2 검증', () => {
  it('RegionData는 중첩 audioFile 계약을 포함하지 않는다', () => {
    expectTypeOf<RegionData>().not.toHaveProperty('audioFile');
  });

  let engine: MockAudioEngine;

  beforeEach(() => {
    engine = new MockAudioEngine();
  });

  describe('Transport Control', () => {
    it('play() 호출 가능', async () => {
      await expect(engine.play()).resolves.toBeUndefined();
    });

    it('pause() 호출 가능', () => {
      expect(() => engine.pause()).not.toThrow();
    });

    it('stop() 호출 가능', () => {
      expect(() => engine.stop()).not.toThrow();
    });

    it('setTime() 호출 가능', () => {
      expect(() => engine.setTime(5)).not.toThrow();
    });

    it('getCurrentTime() 반환값 확인', () => {
      engine.setTime(10.5);
      expect(engine.getCurrentTime()).toBe(10.5);
    });

    it('stop() 호출 시 currentTime이 0으로 리셋', () => {
      engine.setTime(5);
      engine.stop();
      expect(engine.getCurrentTime()).toBe(0);
    });
  });

  describe('Track Management', () => {
    it('addTrack() 호출 가능', async () => {
      await expect(engine.addTrack('track-1')).resolves.toBeUndefined();
    });

    it('setTrackMute()와 setTrackSolo() 호출 가능', async () => {
      await engine.addTrack('track-1');

      expect(() => engine.setTrackMute('track-1', true)).not.toThrow();
      expect(() => engine.setTrackSolo('track-1', true)).not.toThrow();
    });

    it('setTrackVolume() 호출 가능', () => {
      expect(() => engine.setTrackVolume('track-1', 0.7)).not.toThrow();
    });

    it('setTrackPan() 호출 가능', () => {
      expect(() => engine.setTrackPan('track-1', 0.5)).not.toThrow();
    });

    it('getTrackParams() 반환값 확인', async () => {
      await engine.addTrack('track-1');
      const params = engine.getTrackParams('track-1');
      expect(params).toBeDefined();
      expect(params?.volume).toBe(1.0);
      expect(params?.pan).toBe(0);
    });

    it('mute 중 변경한 목표 볼륨을 반환한다', async () => {
      await engine.addTrack('track-1');
      engine.setTrackMute('track-1', true);
      engine.setTrackVolume('track-1', 0.25);

      expect(engine.getTrackParams('track-1')?.volume).toBe(0.25);
    });
  });

  describe('Plugin Management', () => {
    it('Plugin을 설치하고 Parameter를 변경한 뒤 제거할 수 있다', async () => {
      await engine.addTrack('track-1');

      expect(() =>
        engine.installPlugin({
          trackId: 'track-1',
          instanceId: 'plugin-1',
          manifestId: 'builtin.gain',
          parameterValues: new Map([['gain', 1]]),
        })
      ).not.toThrow();
      expect(() =>
        engine.setPluginParameter({
          trackId: 'track-1',
          instanceId: 'plugin-1',
          parameterId: 'gain',
          value: 0.5,
        })
      ).not.toThrow();
      expect(() =>
        engine.setPluginEnabled({ trackId: 'track-1', instanceId: 'plugin-1', isEnabled: false })
      ).not.toThrow();
      expect(() => engine.removePlugin('track-1', 'plugin-1')).not.toThrow();
    });

    it('중복 instance와 없는 instance 작업을 거부한다', async () => {
      await engine.addTrack('track-1');
      engine.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.gain',
        parameterValues: new Map(),
      });

      expect(() =>
        engine.installPlugin({
          trackId: 'track-1',
          instanceId: 'plugin-1',
          manifestId: 'builtin.gain',
          parameterValues: new Map(),
        })
      ).toThrowError(expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_INSTANCE_ID_CONFLICT }));
      expect(() => engine.removePlugin('track-1', 'missing-plugin')).toThrowError(
        expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND })
      );
      expect(() =>
        engine.setPluginParameter({
          trackId: 'track-1',
          instanceId: 'missing-plugin',
          parameterId: 'gain',
          value: 0.5,
        })
      ).toThrowError(expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND }));
      expect(() =>
        engine.setPluginEnabled({ trackId: 'track-1', instanceId: 'missing-plugin', isEnabled: false })
      ).toThrowError(expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_INSTANCE_NOT_FOUND }));
    });
  });

  describe('Region Management', () => {
    const regionData: RegionData = {
      id: 'region-1',
      url: 'test.mp3',
      startTime: 0,
      sourceStartTime: 0,
      duration: 5,
    };

    it('addRegion() 호출 가능', async () => {
      await expect(engine.addRegion('track-1', regionData)).resolves.toBeUndefined();
    });

    it('removeRegion() 호출 가능', async () => {
      await engine.addRegion('track-1', regionData);
      expect(() => engine.removeRegion('track-1', 'region-1')).not.toThrow();
    });

    it('duplicate Region 추가를 거부한다', async () => {
      await engine.addRegion('track-1', regionData);

      await expect(engine.addRegion('track-1', regionData)).rejects.toMatchObject({
        code: 'REGION_ID_CONFLICT',
      });
    });
  });

  describe('준비된 프로젝트 그래프 교체', () => {
    const replacementTrack = {
      id: 'replacement-track',
      volume: 0.5,
      pan: -0.25,
      isMuted: true,
      isSoloed: false,
      pluginInstances: [
        {
          instanceId: 'plugin-1',
          manifestId: 'builtin.gain',
          isEnabled: true,
          parameterValues: new Map([['gain', 0.5]]),
        },
      ],
      regions: [
        {
          id: 'replacement-region',
          url: 'replacement.wav',
          startTime: 1,
          sourceStartTime: 0,
          duration: 2,
        },
      ],
    };

    it('activate 전에는 기존 그래프를 유지하고 activate에서 전체를 교체한다', async () => {
      await engine.addTrack('current-track');
      engine.setTime(8);

      const replacement = await engine.prepareProjectGraph({ tracks: [replacementTrack] });

      expect(engine.getTrackParams('current-track')).not.toBeNull();
      expect(engine.getTrackParams(replacementTrack.id)).toBeNull();

      replacement.assertActivatable();
      const retiredGraph = replacement.activate();

      expect(engine.getTrackParams('current-track')).toBeNull();
      expect(engine.getTrackParams(replacementTrack.id)).toEqual({ volume: 0.5, pan: -0.25 });
      expect(engine.getCurrentTime()).toBe(0);
      expect(() => engine.removePlugin(replacementTrack.id, 'plugin-1')).not.toThrow();
      await expect(engine.addRegion(replacementTrack.id, replacementTrack.regions[0])).rejects.toMatchObject({
        code: 'REGION_ID_CONFLICT',
      });
      expect(() => retiredGraph.dispose()).not.toThrow();
    });

    it('준비 중 active 그래프가 바뀌면 교체를 거부하고 현재 변경을 유지한다', async () => {
      await engine.addTrack('current-track');
      const replacement = await engine.prepareProjectGraph({ tracks: [replacementTrack] });

      engine.setTrackVolume('current-track', 0.75);

      expect(() => replacement.assertActivatable()).toThrowError(
        expect.objectContaining({ code: 'ACTIVE_GRAPH_CHANGED' })
      );
      replacement.discard();
      replacement.discard();

      expect(engine.getTrackParams('current-track')?.volume).toBe(0.75);
      expect(engine.getTrackParams(replacementTrack.id)).toBeNull();
    });

    it('비활성 Plugin을 포함한 프로젝트 그래프를 복원한다', async () => {
      const disabledTrack = {
        ...replacementTrack,
        pluginInstances: replacementTrack.pluginInstances.map(instance => ({ ...instance, isEnabled: false })),
      };

      const preparedGraph = await engine.prepareProjectGraph({ tracks: [disabledTrack] });
      preparedGraph.activate();

      expect(() =>
        engine.setPluginEnabled({ trackId: disabledTrack.id, instanceId: 'plugin-1', isEnabled: true })
      ).not.toThrow();
    });
  });

  describe('Live Loop Control', () => {
    it('루프 슬롯 상태 이벤트를 녹음 대기·재생·정지 순서로 발행한다', async () => {
      await engine.addTrack('track-1');
      const events: string[] = [];
      engine.subscribeLoopEvents(event => {
        if (event.type === 'STATE_CHANGED') {
          events.push(event.state);
        }
      });

      await engine.armLoop({
        lengthBars: 1,
        quantizationBars: 1,
        slotId: 'slot-1',
        tempoBpm: 120,
        trackId: 'track-1',
      });
      await engine.triggerLoop({ quantizationBars: 1, slotId: 'slot-1', tempoBpm: 120, trackId: 'track-1' });
      engine.stopLoop({ quantizationBars: 1, slotId: 'slot-1', tempoBpm: 120, trackId: 'track-1' });

      expect(events).toEqual(['armed', 'playing', 'stopped']);
    });

    it('선택한 입력 장치 식별자를 반환한다', async () => {
      await expect(engine.setLiveInputDevice('input-1')).resolves.toBe('input-1');
    });
  });

  describe('Export', () => {
    const exportRequest = {
      tracks: [
        {
          id: 'track-1',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          pluginInstances: [],
          regions: [{ id: 'region-1', url: 'test.mp3', startTime: 0, sourceStartTime: 0, duration: 10 }],
        },
      ],
      masterVolume: 1,
      range: { startTime: 0, endTime: 10 },
      sampleRate: 44100,
    };

    it('exportProject() Blob 반환', async () => {
      const blob = await engine.exportProject(exportRequest);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
    });

    it('exportProject() 요청 전달 가능', async () => {
      const blob = await engine.exportProject(exportRequest);
      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('IAudioEngine 인터페이스 준수', () => {
    it('모든 필수 메서드가 구현되어 있어야 함', () => {
      // Transport Control
      expect(typeof engine.play).toBe('function');
      expect(typeof engine.pause).toBe('function');
      expect(typeof engine.stop).toBe('function');
      expect(typeof engine.setTime).toBe('function');
      expect(typeof engine.getCurrentTime).toBe('function');
      expect(typeof engine.setLiveInputDevice).toBe('function');
      expect(typeof engine.setLiveInputMonitoring).toBe('function');
      expect(typeof engine.armLoop).toBe('function');
      expect(typeof engine.cancelLoop).toBe('function');
      expect(typeof engine.triggerLoop).toBe('function');
      expect(typeof engine.stopLoop).toBe('function');
      expect(typeof engine.clearLoop).toBe('function');
      expect(typeof engine.stopAllLoops).toBe('function');
      expect(typeof engine.loadLoop).toBe('function');
      expect(typeof engine.subscribeLoopEvents).toBe('function');
      // Track Management
      expect(typeof engine.addTrack).toBe('function');
      expect(typeof engine.removeTrack).toBe('function');
      expect(typeof engine.setTrackVolume).toBe('function');
      expect(typeof engine.setTrackPan).toBe('function');
      expect(typeof engine.setTrackMute).toBe('function');
      expect(typeof engine.setTrackSolo).toBe('function');
      expect(typeof engine.getTrackParams).toBe('function');

      expect(typeof engine.installPlugin).toBe('function');
      expect(typeof engine.removePlugin).toBe('function');
      expect(typeof engine.setPluginParameter).toBe('function');

      // Region Management
      expect(typeof engine.addRegion).toBe('function');
      expect(typeof engine.removeRegion).toBe('function');
      expect(typeof engine.rescheduleRegion).toBe('function');
      expect(typeof engine.replaceRegion).toBe('function');
      expect(typeof engine.prepareProjectGraph).toBe('function');
      // Export
      expect(typeof engine.exportProject).toBe('function');
    });
  });
});
