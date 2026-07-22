import { describe, it, expect, beforeEach } from 'vitest';
import { MockAudioEngine } from './mock-audio-engine';
import type { RegionData } from './i-audio-engine';

describe('MockAudioEngine - Phase 2 검증', () => {
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

  describe('Export', () => {
    const exportRequest = {
      tracks: [
        {
          id: 'track-1',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
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
      // Track Management
      expect(typeof engine.addTrack).toBe('function');
      expect(typeof engine.removeTrack).toBe('function');
      expect(typeof engine.setTrackVolume).toBe('function');
      expect(typeof engine.setTrackPan).toBe('function');
      expect(typeof engine.setTrackMute).toBe('function');
      expect(typeof engine.setTrackSolo).toBe('function');
      expect(typeof engine.getTrackParams).toBe('function');

      // Region Management
      expect(typeof engine.addRegion).toBe('function');
      expect(typeof engine.removeRegion).toBe('function');
      expect(typeof engine.rescheduleRegion).toBe('function');
      expect(typeof engine.replaceRegion).toBe('function');
      // Export
      expect(typeof engine.exportProject).toBe('function');
    });
  });
});
