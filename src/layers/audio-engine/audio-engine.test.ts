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
    ToneAudioBuffer: vi.fn().mockImplementation(function () {
      return {
        load: vi.fn().mockResolvedValue(undefined),
        duration: 120, // Mock duration
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

  it('loadFile decodes and caches buffer', async () => {
    const engine = new AudioEngine();
    const mockFile = new File([''], 'test.mp3', { type: 'audio/mp3' });
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');

    const result = await engine.loadFile(mockFile);

    expect(result).toEqual({ src: 'blob:mock-url', duration: 120 });
    expect(Tone.ToneAudioBuffer).toHaveBeenCalled();
    const bufferInstance = vi
      .mocked(Tone.ToneAudioBuffer)
      .mock.results.at(-1)?.value;
    expect(bufferInstance.load).toHaveBeenCalledWith('blob:mock-url');

    if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL;
  });

  describe('Track & Region Management', () => {
    it('createTrack creates channel', () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');

      const channelInstance = vi
        .mocked(Tone.Channel)
        .mock.results.at(-1)?.value;

      expect(Tone.Channel).toHaveBeenCalled();
      expect(channelInstance.toDestination).toHaveBeenCalled();
    });

    it('addRegion creates player from cached buffer', async () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');

      // Simulate loaded file (cache buffer)
      const mockFile = new File([''], 'test.mp3', { type: 'audio/mp3' });
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      await engine.loadFile(mockFile);

      const region = {
        id: 'region-1',
        trackId: 'track-1',
        src: 'blob:mock-url',
        startTime: 0,
        duration: 10,
        offset: 0,
      };

      engine.addRegion('track-1', region);

      expect(Tone.Player).toHaveBeenCalled();
      const playerInstance = vi.mocked(Tone.Player).mock.results.at(-1)?.value;
      const channelInstance = vi
        .mocked(Tone.Channel)
        .mock.results.at(-1)?.value;

      // Should connect to channel
      expect(playerInstance.connect).toHaveBeenCalledWith(channelInstance);
      // Should sync and start
      expect(playerInstance.sync).toHaveBeenCalled();
      expect(playerInstance.start).toHaveBeenCalledWith(0, 0, 10);
    });

    it('removeRegion disposes player', async () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');

      const mockFile = new File([''], 'test.mp3', { type: 'audio/mp3' });
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      await engine.loadFile(mockFile);

      const region = {
        id: 'region-1',
        trackId: 'track-1',
        src: 'blob:mock-url',
        startTime: 0,
        duration: 10,
        offset: 0,
      };

      engine.addRegion('track-1', region);
      const playerInstance = vi.mocked(Tone.Player).mock.results.at(-1)?.value;

      engine.removeRegion('track-1', 'region-1');
      expect(playerInstance.dispose).toHaveBeenCalled();
    });

    it('setTrackVolume updates channel volume', () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');
      const channelInstance = vi.mocked(Tone.Channel).mock.results[0].value;

      engine.setTrackVolume('track-1', 0.5);
      expect(channelInstance.volume.value).toBeCloseTo(-6, 0);
    });

    it('setTrackMute updates channel mute', () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');
      const channelInstance = vi.mocked(Tone.Channel).mock.results[0].value;

      engine.setTrackMute('track-1', true);
      expect(channelInstance.mute).toBe(true);
    });

    it('setTrackSolo updates channel solo', () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');
      const channelInstance = vi
        .mocked(Tone.Channel)
        .mock.results.at(-1)?.value;

      engine.setTrackSolo('track-1', true);
      expect(channelInstance.solo).toBe(true);
    });

    it('removeTrack disposes channel and regions', async () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');

      const mockFile = new File([''], 'test.mp3', { type: 'audio/mp3' });
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      await engine.loadFile(mockFile);

      const region = {
        id: 'region-1',
        trackId: 'track-1',
        src: 'blob:mock-url',
        startTime: 0,
        duration: 10,
        offset: 0,
      };

      engine.addRegion('track-1', region);
      const playerInstance = vi.mocked(Tone.Player).mock.results.at(-1)?.value;
      const channelInstance = vi
        .mocked(Tone.Channel)
        .mock.results.at(-1)?.value;

      engine.removeTrack('track-1');
      expect(channelInstance.dispose).toHaveBeenCalled();
      expect(playerInstance.dispose).toHaveBeenCalled();
    });

    it('moveRegion reschedules player', async () => {
      const engine = new AudioEngine();
      engine.createTrack('track-1');

      const mockFile = new File([''], 'test.mp3', { type: 'audio/mp3' });
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      await engine.loadFile(mockFile);

      const region = {
        id: 'region-1',
        trackId: 'track-1',
        src: 'blob:mock-url',
        startTime: 0,
        duration: 10,
        offset: 0,
      };

      engine.addRegion('track-1', region);
      const playerInstance = vi.mocked(Tone.Player).mock.results.at(-1)?.value;

      engine.moveRegion('track-1', 'region-1', 5);

      expect(playerInstance.unsync).toHaveBeenCalled();
      expect(playerInstance.stop).toHaveBeenCalled();
      expect(playerInstance.sync).toHaveBeenCalled();
      // start(startTime, offset, duration)
      expect(playerInstance.start).toHaveBeenLastCalledWith(5, 0, 10);
    });
  });
});
