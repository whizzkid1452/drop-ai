import { describe, it, expect, vi } from 'vitest';
import { MockAudioEngine } from './audio-engine';
import { createApp } from './apps/create-app';

describe('Layers Integration', () => {
  function setup() {
    const mockEngine = new MockAudioEngine();
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

      await controller.track.addTrack('test-url', 'track-1');

      const tracks = session.getState().tracks;
      expect(tracks.size).toBe(1);
      expect(tracks.get('track-1')?.id).toBe('track-1');
      expect(tracks.get('track-1')?.volume).toBe(1.0);
    });

    it('트랙 볼륨을 변경하면 session에 반영된다', async () => {
      const { session, controller } = setup();
      await controller.track.addTrack('test-url', 'track-1');

      controller.track.setVolume('track-1', 0.5);

      expect(session.getState().tracks.get('track-1')?.volume).toBe(0.5);
    });

    it('트랙을 제거하면 tracks에서 사라진다', async () => {
      const { session, controller } = setup();
      await controller.track.addTrack('test-url', 'track-1');

      controller.track.removeTrack('track-1');

      expect(session.getState().tracks.size).toBe(0);
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
