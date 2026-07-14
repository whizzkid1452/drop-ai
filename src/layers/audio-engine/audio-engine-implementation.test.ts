import { beforeEach, describe, expect, it, vi } from 'vitest';

const toneMocks = vi.hoisted(() => ({
  channelDisconnect: vi.fn(),
  channelDispose: vi.fn(),
  playerDisconnect: vi.fn(),
  playerDispose: vi.fn(),
  playerStart: vi.fn(),
  playerStop: vi.fn(),
  playerSync: vi.fn(),
  playerUnsync: vi.fn(),
}));

vi.mock('tone', () => {
  class Channel {
    volume = { value: 0, rampTo: vi.fn() };
    pan = { value: 0, rampTo: vi.fn() };

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

    constructor(options: { onload: () => void }) {
      queueMicrotask(options.onload);
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
    start: vi.fn(),
  };
});

import { AudioEngine } from './audio-engine';

describe('AudioEngine Region 재생', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
