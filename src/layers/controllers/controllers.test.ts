import { describe, it, expect, beforeEach } from 'vitest';
import { MockAudioEngine } from '../audio-engine';
import { createApp } from '../apps/create-app';
import { type AppController } from './app-controller';
import { type SessionStore } from '@/layers/session';

describe('Controllers - Phase 3 검증', () => {
  let engine: MockAudioEngine;
  let controller: AppController;
  let session: SessionStore;

  beforeEach(() => {
    engine = new MockAudioEngine();
    const app = createApp(engine);
    controller = app.controller;
    session = app.session;
  });

  describe('PlaybackController 확장', () => {
    it('handleSeek 호출 가능', () => {
      expect(() => controller.playback.handleSeek(5.5)).not.toThrow();
    });

    it('handleSetTempo 호출 가능', () => {
      expect(() => controller.playback.handleSetTempo(140)).not.toThrow();
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

    it('setMute 호출 시 SessionStore 업데이트', () => {
      controller.track.setMute('track-1', true);
      const track = session.getState().tracks.get('track-1');
      expect(track?.isMuted).toBe(true);
    });

    it('setSolo 호출 시 SessionStore 업데이트', () => {
      controller.track.setSolo('track-1', true);
      const track = session.getState().tracks.get('track-1');
      expect(track?.isSoloed).toBe(true);
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
          duration: 10
        })
      ).resolves.toBeUndefined();
    });

    it('removeRegion 호출 가능', async () => {
      await controller.region.addRegion('track-1', { id: 'region-1', url: 'region.mp3', startTime: 0, sourceStartTime: 0, duration: 10 });
      expect(() => controller.region.removeRegion('track-1', 'region-1')).not.toThrow();
    });

    it('splitRegion 호출 가능', async () => {
      await controller.region.addRegion('track-1', { id: 'region-1', url: 'region.mp3', startTime: 0, sourceStartTime: 0, duration: 10 });
      await expect(
        controller.region.splitRegion('track-1', 2.5)
      ).resolves.toBeUndefined();
    });

    it('moveRegion 호출 가능', async () => {
      await controller.region.addRegion('track-1', { id: 'region-1', url: 'region.mp3', startTime: 0, sourceStartTime: 0, duration: 10 });
      
      // moveRegion은 SessionStore만 업데이트
      expect(() => controller.region.moveRegion({ trackId: 'track-1', regionId: 'region-1', newStartTime: 5.0 })).not.toThrow();
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
      const blob = await controller.export.exportProject();
      expect(blob).toBeInstanceOf(Blob);
    });

    it('exportRange Blob 반환', async () => {
      const blob = await controller.export.exportRange(0, 10);
      expect(blob).toBeInstanceOf(Blob);
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
