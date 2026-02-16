import { describe, expect, it, vi } from 'vitest';
import { createApp } from './apps/create-app';
import { AudioEngine } from './audio-engine/audio-engine';

vi.mock('tone', () => {
  const Transport = {
    state: 'stopped',
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    seconds: 0,
  };
  const Destination = {
    volume: { value: 0 },
    gain: { value: 1 },
  };

  return {
    Player: vi.fn().mockImplementation(function () {
      return {
        toDestination: vi.fn().mockReturnThis(),
        connect: vi.fn().mockReturnThis(),
        sync: vi.fn().mockReturnThis(),
        unsync: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
        load: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn(),
        loaded: Promise.resolve(),
      };
    }),
    Channel: vi.fn().mockImplementation(function () {
      return {
        toDestination: vi.fn().mockReturnThis(),
        volume: { value: 0 },
        mute: false,
        solo: false,
        dispose: vi.fn(),
      };
    }),
    Transport,
    Destination,
    getTransport: vi.fn().mockReturnValue(Transport),
    getDestination: vi.fn().mockReturnValue(Destination),
    moveRegion: vi.fn(),
  };
});

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

    it('addRegion으로 파일을 업로드하면 트랙에 리전이 추가된다', async () => {
      const { session, controller } = setup();
      const mockFile = new File([''], 'test.mp3', { type: 'audio/mp3' });

      // URL.createObjectURL mock
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');

      // 1. 트랙 생성
      const { id: trackId } = await controller.track.addTrack();

      // 2. 리전 추가
      await controller.track.addRegion(trackId, mockFile, 0);

      const tracks = session.getState().tracks;
      expect(tracks.size).toBe(1);
      const track = Array.from(tracks.values())[0];
      expect(track.regions.length).toBe(1);
      expect(track.regions[0].src).toBe('blob:mock-url');

      // Restore mock
      if (originalCreateObjectURL) {
        URL.createObjectURL = originalCreateObjectURL;
      }
    });

    it('이미 존재하는 트랙에 추가 리전을 넣을 수 있다', async () => {
      const { session, controller } = setup();
      const mockFile1 = new File([''], 'test1.mp3', { type: 'audio/mp3' });
      const mockFile2 = new File([''], 'test2.mp3', { type: 'audio/mp3' });

      // 먼저 트랙 추가
      const { id: trackId } = await controller.track.addTrack();
      expect(session.getState().tracks.size).toBe(1);

      // URL.createObjectURL mock
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');

      // 첫 번째 리전
      await controller.track.addRegion(trackId, mockFile1, 0);

      // 두 번째 리전
      await controller.track.addRegion(trackId, mockFile2, 10);

      const tracks = session.getState().tracks;
      const track = tracks.get(trackId);
      expect(track).toBeDefined();
      expect(track!.regions.length).toBe(2);

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
