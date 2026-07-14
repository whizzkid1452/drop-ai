import { beforeEach, describe, expect, it, vi } from 'vitest';

const toneMocks = vi.hoisted(() => ({
  playerStart: vi.fn(),
  playerSync: vi.fn(),
}));

vi.mock('tone', () => {
  class Channel {
    volume = { value: 0, rampTo: vi.fn() };
    pan = { value: 0, rampTo: vi.fn() };

    toDestination() {
      return this;
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

    unsync() {}
    stop() {}
    disconnect() {}
    dispose() {}
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
});
