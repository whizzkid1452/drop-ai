import { describe, expect, it, vi } from 'vitest';
import { createApp } from './apps/create-app';
import { AudioEngine } from './audio-engine/audio-engine';

describe('Layers Integration', () => {
  function setup() {
    const mockEngine = new AudioEngine();
    const { session, controller } = createApp(mockEngine);
    return { mockEngine, session, controller };
  }

  describe('PlaybackController', () => {
    it('play 시 isPlaying이 true가 된다', async () => {
      const { session, controller } = setup();

      await controller.playback.handlePlay();

      expect(session.getState().isPlaying).toBe(true);
    });

    it('stop 시 isPlaying이 false가 된다', async () => {
      const { session, controller } = setup();
      await controller.playback.handlePlay();

      controller.playback.handleStop();

      expect(session.getState().isPlaying).toBe(false);
    });

    it('pause 시 isPlaying이 false가 된다', async () => {
      const { session, controller } = setup();
      await controller.playback.handlePlay();

      controller.playback.handlePause();

      expect(session.getState().isPlaying).toBe(false);
    });
  });

  describe('TrackController', () => {
    it('트랙을 추가하면 tracks에 반영된다', async () => {
      const { session, controller } = setup();

      const { id } = await controller.track.addTrack();

      const tracks = session.getState().tracks;
      expect(tracks.size).toBe(1);
      expect(tracks.get(id)?.id).toBe(id);
      expect(tracks.get(id)?.volume).toBe(1.0);
    });

    it('트랙 볼륨을 변경하면 session에 반영된다', async () => {
      const { session, controller } = setup();
      const { id } = await controller.track.addTrack();

      controller.track.setTrackVolume(id, 0.5);

      expect(session.getState().tracks.get(id)?.volume).toBe(0.5);
    });

    it('트랙을 제거하면 tracks에서 사라진다', async () => {
      const { session, controller } = setup();
      const { id } = await controller.track.addTrack();

      controller.track.removeTrack(id);

      expect(session.getState().tracks.size).toBe(0);
    });

    it('createTrackFromFile로 파일을 업로드하면 트랙이 추가된다', async () => {
      const { session, controller } = setup();
      const mockFile = new File([''], 'test.mp3', { type: 'audio/mp3' });

      // URL.createObjectURL mock
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');

      await controller.track.createTrackFromFile(mockFile);

      const tracks = session.getState().tracks;
      expect(tracks.size).toBe(1);
      const track = Array.from(tracks.values())[0];
      expect(typeof track.id).toBe('string');
      expect(track.id.length).toBeGreaterThan(0);

      // Restore mock
      if (originalCreateObjectURL) {
        URL.createObjectURL = originalCreateObjectURL;
      }
    });

    it('이미 존재하는 트랙ID로 파일소스 업데이트가 가능하다', async () => {
      const { session, controller } = setup();
      const mockFile = new File([''], 'test.mp3', { type: 'audio/mp3' });

      // 먼저 트랙 추가
      const { id } = await controller.track.addTrack();
      expect(session.getState().tracks.size).toBe(1);

      // URL.createObjectURL mock
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:new-mock-url');

      // 기존 트랙 ID로 업로드
      await controller.track.updateTrackSourceFromFile(id, mockFile);

      const tracks = session.getState().tracks;
      expect(tracks.size).toBe(1); // 개수 유지
      expect(tracks.get(id)).toBeDefined();

      // Restore mock
      if (originalCreateObjectURL) {
        URL.createObjectURL = originalCreateObjectURL;
      }
    });
  });

  describe('Session subscribe', () => {
    it('상태 변경 시 listener가 호출된다', async () => {
      const { session, controller } = setup();
      const listener = vi.fn();
      session.subscribe(listener);

      await controller.playback.handlePlay();
      controller.playback.handleStop();

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('unsubscribe 후에는 listener가 호출되지 않는다', async () => {
      const { session, controller } = setup();
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      await controller.playback.handlePlay();
      unsubscribe();
      controller.playback.handleStop();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
