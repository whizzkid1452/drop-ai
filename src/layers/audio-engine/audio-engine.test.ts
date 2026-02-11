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

    it('setTempo() 호출 가능', () => {
      expect(() => engine.setTempo(140)).not.toThrow();
    });

    it('stop() 호출 시 currentTime이 0으로 리셋', () => {
      engine.setTime(5);
      engine.stop();
      expect(engine.getCurrentTime()).toBe(0);
    });
  });

  describe('Track Management', () => {
    it('loadTrack() 호출 가능', async () => {
      await expect(engine.loadTrack('test.mp3', 'track-1')).resolves.toBeUndefined();
    });

    it('setTrackVolume() 호출 가능', () => {
      expect(() => engine.setTrackVolume('track-1', 0.7)).not.toThrow();
    });

    it('setTrackPan() 호출 가능', () => {
      expect(() => engine.setTrackPan('track-1', 0.5)).not.toThrow();
    });

    it('getTrackParams() 반환값 확인', () => {
      const params = engine.getTrackParams('track-1');
      expect(params).toBeDefined();
      expect(params?.volume).toBe(1.0);
      expect(params?.pan).toBe(0);
    });
  });

  describe('Region Management', () => {
    const regionData: RegionData = {
      id: 'region-1',
      url: 'test.mp3',
      startTime: 0,
      sourceStartTime: 0,
      duration: 5
    };

    it('addRegion() 호출 가능', async () => {
      await expect(engine.addRegion('track-1', regionData)).resolves.toBeUndefined();
    });

    it('removeRegion() 호출 가능', async () => {
      await engine.addRegion('track-1', regionData);
      expect(() => engine.removeRegion('track-1', 'region-1')).not.toThrow();
    });

    it('splitRegion() 호출 가능', async () => {
      await engine.addRegion('track-1', regionData);
      await expect(engine.splitRegion('track-1', 2.5)).resolves.toBeUndefined();
    });
  });

  describe('Export', () => {
    it('setExportRange() 호출 가능', () => {
      expect(() => engine.setExportRange(2, 8)).not.toThrow();
    });

    it('setExportRange() null 허용', () => {
      expect(() => engine.setExportRange(null, null)).not.toThrow();
    });

    it('exportProject() Blob 반환', async () => {
      const blob = await engine.exportProject();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
    });

    it('exportProject() options 전달 가능', async () => {
      const blob = await engine.exportProject({
        range: { startTime: 0, endTime: 10 }
      });
      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('Legacy Compatibility', () => {
    it('setVolume() 호출 가능 (legacy)', () => {
      expect(() => engine.setVolume(0.8)).not.toThrow();
    });

    it('seekTo() 호출 가능 (legacy)', () => {
      engine.seekTo(7);
      expect(engine.getCurrentTime()).toBe(7);
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
      expect(typeof engine.setTempo).toBe('function');

      // Track Management
      expect(typeof engine.loadTrack).toBe('function');
      expect(typeof engine.setTrackVolume).toBe('function');
      expect(typeof engine.setTrackPan).toBe('function');
      expect(typeof engine.getTrackParams).toBe('function');

      // Region Management
      expect(typeof engine.addRegion).toBe('function');
      expect(typeof engine.removeRegion).toBe('function');
      expect(typeof engine.splitRegion).toBe('function');

      // Export
      expect(typeof engine.setExportRange).toBe('function');
      expect(typeof engine.exportProject).toBe('function');

      // Legacy
      expect(typeof engine.setVolume).toBe('function');
      expect(typeof engine.seekTo).toBe('function');
    });
  });
});
