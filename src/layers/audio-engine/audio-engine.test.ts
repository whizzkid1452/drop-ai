import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEngine } from './audio-engine';

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
  };
});

import * as Tone from 'tone';

describe('AudioEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should play', async () => {
    const engine = new AudioEngine();
    await expect(engine.play()).resolves.not.toThrow();
    expect(Tone.Transport.start).toHaveBeenCalled();
  });

  it('should stop', () => {
    const engine = new AudioEngine();
    engine.stop();
    expect(Tone.Transport.stop).toHaveBeenCalled();
  });

  it('should pause', () => {
    const engine = new AudioEngine();
    engine.pause();
    expect(Tone.Transport.pause).toHaveBeenCalled();
  });

  it('should set volume', () => {
    const engine = new AudioEngine();
    engine.setVolume(0.5);
    // 20 * log10(0.5) approx -6
    expect(Tone.Destination.volume.value).toBeCloseTo(-6, 0);
  });

  it('should seek to time', () => {
    const engine = new AudioEngine();
    engine.seekTo(10);
    expect(Tone.Transport.seconds).toBe(10);
  });

  it('loadFile은 File을 로드한다', async () => {
    const engine = new AudioEngine();
    const mockFile = new File([''], 'test.mp3', { type: 'audio/mp3' });
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');

    const result = await engine.loadFile(mockFile);
    expect(result).toEqual({ src: 'blob:mock-url' });

    if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL;
  });

  describe('Track Management', () => {
    it('createTrack creates channel', () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');

      const channelInstance = vi
        .mocked(Tone.Channel)
        .mock.results.at(-1)?.value;
      expect(Tone.Channel).toHaveBeenCalled();
      expect(channelInstance.toDestination).toHaveBeenCalled();
    });

    it('setTrackSource creates player and connects to existing channel', async () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');
      const channelInstance = vi
        .mocked(Tone.Channel)
        .mock.results.at(-1)?.value;

      await engine.setTrackSource('track-1', 'test.mp3');

      expect(Tone.Player).toHaveBeenCalledWith('test.mp3');
      const playerInstance = vi.mocked(Tone.Player).mock.results.at(-1)?.value;
      expect(playerInstance.connect).toHaveBeenCalledWith(channelInstance);
    });

    it('setTrackSource works even if createTrack was not called (fallback)', async () => {
      const engine = new AudioEngine();
      await engine.setTrackSource('track-1', 'test.mp3');

      expect(Tone.Channel).toHaveBeenCalled();
      expect(Tone.Player).toHaveBeenCalled();
    });

    it('setTrackSource reuses player if exists', async () => {
      const engine = new AudioEngine();
      await engine.setTrackSource('track-1', 'test.mp3');
      const playerInstance = vi.mocked(Tone.Player).mock.results.at(-1)?.value;

      // Call again
      await engine.setTrackSource('track-1', 'test2.mp3');

      expect(Tone.Player).toHaveBeenCalledTimes(1); // Should not create new player
      expect(playerInstance.load).toHaveBeenCalledWith('test2.mp3');
    });

    it('setTrackVolume updates channel volume', async () => {
      const engine = new AudioEngine();
      await engine.setTrackSource('track-1', 'test.mp3');
      const channelInstance = vi.mocked(Tone.Channel).mock.results[0].value;

      engine.setTrackVolume('track-1', 0.5);
      expect(channelInstance.volume.value).toBeCloseTo(-6, 0);
    });

    it('setTrackMute updates channel mute', async () => {
      const engine = new AudioEngine();
      await engine.setTrackSource('track-1', 'test.mp3');
      const channelInstance = vi.mocked(Tone.Channel).mock.results[0].value;

      engine.setTrackMute('track-1', true);
      expect(channelInstance.mute).toBe(true);
    });

    it('setTrackSolo updates channel solo', async () => {
      const engine = new AudioEngine();
      await engine.setTrackSource('track-1', 'test.mp3');
      const channelInstance = vi
        .mocked(Tone.Channel)
        .mock.results.at(-1)?.value;

      engine.setTrackSolo('track-1', true);
      expect(channelInstance.solo).toBe(true);
    });

    it('removeTrack disposes player and channel', async () => {
      const engine = new AudioEngine();
      await engine.setTrackSource('track-1', 'test.mp3');
      const playerInstance = vi.mocked(Tone.Player).mock.results.at(-1)?.value;
      const channelInstance = vi
        .mocked(Tone.Channel)
        .mock.results.at(-1)?.value;

      engine.removeTrack('track-1');
      expect(playerInstance.dispose).toHaveBeenCalled();
      expect(channelInstance.dispose).toHaveBeenCalled();
    });

    it('removeTrack disposes channel only if player does not exist', () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');
      const channelInstance = vi
        .mocked(Tone.Channel)
        .mock.results.at(-1)?.value;

      engine.removeTrack('track-1');
      expect(channelInstance.dispose).toHaveBeenCalled();
    });
  });
});
