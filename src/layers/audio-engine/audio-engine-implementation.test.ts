import { beforeEach, describe, expect, it, vi } from 'vitest';

const toneMocks = vi.hoisted(() => ({
  channelOptions: [] as Array<{ volume: number; pan: number }>,
  offline: vi.fn(),
  channelDisconnect: vi.fn(),
  channelDispose: vi.fn(),
  playerDisconnect: vi.fn(),
  playerDispose: vi.fn(),
  playerLoad: vi.fn(),
  playerStart: vi.fn(),
  playerStop: vi.fn(),
  playerSync: vi.fn(),
  playerUnsync: vi.fn(),
}));

vi.mock('tone', () => {
  toneMocks.offline.mockImplementation(async (callback: () => Promise<void> | void) => {
    await callback();
    return {
      get: () => ({
        length: 4,
        numberOfChannels: 2,
        sampleRate: 44100,
        getChannelData: () => new Float32Array([0.5, 0.25, -0.25, -0.5]),
      }),
    };
  });

  class Channel {
    volume = { value: 0, rampTo: vi.fn() };
    pan = { value: 0, rampTo: vi.fn() };

    constructor(options: { volume: number; pan: number }) {
      toneMocks.channelOptions.push(options);
    }

    toDestination() {
      return this;
    }

    disconnect() {
      toneMocks.channelDisconnect();
    }

    dispose() {
      toneMocks.channelDispose();
    }
  }

  class Player {
    buffer = { duration: 10 };

    constructor(options?: { onload?: () => void }) {
      if (options?.onload) {
        queueMicrotask(options.onload);
      }
    }

    connect() {
      return this;
    }

    sync() {
      toneMocks.playerSync();
      return this;
    }

    start(...args: unknown[]) {
      toneMocks.playerStart(...args);
      return this;
    }

    async load(url: string) {
      toneMocks.playerLoad(url);
      return this;
    }

    unsync() {
      toneMocks.playerUnsync();
    }

    stop() {
      toneMocks.playerStop();
    }

    disconnect() {
      toneMocks.playerDisconnect();
    }

    dispose() {
      toneMocks.playerDispose();
    }
  }

  return {
    Channel,
    Player,
    Transport: { bpm: { value: 120 } },
    dbToGain: (value: number) => value,
    gainToDb: (value: number) => value,
    getContext: () => ({ state: 'running' }),
    getTransport: () => ({ pause: vi.fn(), seconds: 0, start: vi.fn(), stop: vi.fn() }),
    Offline: toneMocks.offline,
    start: vi.fn(),
  };
});

import { AudioEngine } from './audio-engine';

describe('AudioEngine Region 재생', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toneMocks.channelOptions.length = 0;
  });

  it('Region 길이를 Player 시작 인자로 전달한다', async () => {
    const engine = new AudioEngine();

    await engine.addRegion('track-1', {
      id: 'region-1',
      url: 'test.wav',
      startTime: 4,
      sourceStartTime: 2,
      duration: 3,
    });

    expect(toneMocks.playerSync).toHaveBeenCalledOnce();
    expect(toneMocks.playerStart).toHaveBeenCalledWith(4, 2, 3);
  });

  it('트랙 제거 시 소속 Player와 Channel을 모두 해제한다', async () => {
    const engine = new AudioEngine();
    const region = {
      url: 'test.wav',
      startTime: 0,
      sourceStartTime: 0,
      duration: 3,
    };

    await engine.addRegion('track-1', { ...region, id: 'region-1' });
    await engine.addRegion('track-1', { ...region, id: 'region-2' });

    engine.removeTrack('track-1');

    expect(toneMocks.playerUnsync).toHaveBeenCalledTimes(2);
    expect(toneMocks.playerStop).toHaveBeenCalledTimes(2);
    expect(toneMocks.playerDisconnect).toHaveBeenCalledTimes(2);
    expect(toneMocks.playerDispose).toHaveBeenCalledTimes(2);
    expect(toneMocks.channelDisconnect).toHaveBeenCalledOnce();
    expect(toneMocks.channelDispose).toHaveBeenCalledOnce();
  });

  it('선택 범위를 오프라인 렌더링하고 실제 PCM WAV를 반환한다', async () => {
    const engine = new AudioEngine();

    const blob = await engine.exportProject({
      tracks: [
        {
          id: 'track-1',
          volume: 0.5,
          pan: -0.25,
          isMuted: false,
          isSoloed: false,
          regions: [{ id: 'region-1', url: 'test.wav', startTime: 1, sourceStartTime: 1, duration: 10 }],
        },
      ],
      masterVolume: 0.5,
      range: { startTime: 2, endTime: 5 },
      sampleRate: 44100,
    });

    expect(toneMocks.playerLoad).toHaveBeenCalledWith('test.wav');
    expect(toneMocks.playerStart).toHaveBeenCalledWith(0, 2, 3);
    expect(toneMocks.channelOptions).toContainEqual({ volume: 0.25, pan: -0.25 });
    expect(toneMocks.offline).toHaveBeenCalledWith(expect.any(Function), 3, 2, 44100);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBeGreaterThan(44);
  });

  it('Solo 트랙이 있으면 음소거되지 않은 Solo 트랙만 렌더링한다', async () => {
    const engine = new AudioEngine();
    const createTrack = ({ id, url, isSoloed }: { id: string; url: string; isSoloed: boolean }) => ({
      id,
      volume: 1,
      pan: 0,
      isMuted: false,
      isSoloed,
      regions: [{ id: `${id}-region`, url, startTime: 0, sourceStartTime: 0, duration: 1 }],
    });

    await engine.exportProject({
      tracks: [
        createTrack({ id: 'track-1', url: 'normal.wav', isSoloed: false }),
        createTrack({ id: 'track-2', url: 'solo.wav', isSoloed: true }),
      ],
      masterVolume: 1,
      range: { startTime: 0, endTime: 1 },
      sampleRate: 44100,
    });

    expect(toneMocks.playerLoad).toHaveBeenCalledOnce();
    expect(toneMocks.playerLoad).toHaveBeenCalledWith('solo.wav');
  });
});
