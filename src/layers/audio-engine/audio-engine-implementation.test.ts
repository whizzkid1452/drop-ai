import { beforeEach, describe, expect, it, vi } from 'vitest';

interface ChannelMockState {
  mute: boolean;
  solo: boolean;
  volume: {
    value: number;
  };
}

interface PlayerMockState {
  buffer: { duration: number };
  disposed: boolean;
  source: unknown;
  unsyncCount: number;
}

const toneMocks = vi.hoisted(() => ({
  channelOptions: [] as Array<{ volume: number; pan: number }>,
  channels: [] as ChannelMockState[],
  playerInstances: [] as PlayerMockState[],
  loadFailures: new Map<string, Error>(),
  loadPromises: new Map<string, Promise<void>>(),
  startFailures: [] as Array<Error | undefined>,
  tempoWrites: [] as number[],
  offline: vi.fn(),
  channelVolumeRampTo: vi.fn(),
  channelSoloWrites: vi.fn(),
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

  class Channel implements ChannelMockState {
    private soloed = false;
    private unmutedVolume = 0;
    volume = {
      value: 0,
      rampTo: vi.fn((value: number, duration: number) => {
        this.volume.value = value;
        toneMocks.channelVolumeRampTo(value, duration);
      }),
    };
    pan = { value: 0, rampTo: vi.fn() };

    get mute() {
      return this.volume.value === Number.NEGATIVE_INFINITY;
    }

    set mute(muted: boolean) {
      if (!this.mute && muted) {
        this.unmutedVolume = this.volume.value;
        this.volume.value = Number.NEGATIVE_INFINITY;
        return;
      }
      if (this.mute && !muted) {
        this.volume.value = this.unmutedVolume;
      }
    }

    get solo() {
      return this.soloed;
    }

    set solo(soloed: boolean) {
      this.soloed = soloed;
      toneMocks.channelSoloWrites(soloed);
    }

    constructor(options: { volume: number; pan: number }) {
      toneMocks.channelOptions.push(options);
      toneMocks.channels.push(this);
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

  class Player implements PlayerMockState {
    buffer = { duration: 10 };
    disposed = false;
    source: unknown;
    unsyncCount = 0;

    constructor(options?: { url?: unknown }) {
      this.source = options?.url;
      toneMocks.playerInstances.push(this);
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
      const failure = toneMocks.startFailures.shift();
      if (failure) {
        throw failure;
      }
      return this;
    }

    async load(url: string) {
      toneMocks.playerLoad(url);
      await toneMocks.loadPromises.get(url);
      const failure = toneMocks.loadFailures.get(url);
      if (failure) {
        throw failure;
      }
      return this;
    }

    unsync() {
      this.unsyncCount += 1;
      toneMocks.playerUnsync();
      return this;
    }

    stop() {
      toneMocks.playerStop();
      return this;
    }

    disconnect() {
      toneMocks.playerDisconnect();
      return this;
    }

    dispose() {
      this.disposed = true;
      toneMocks.playerDispose();
      return this;
    }
  }

  const bpm = {
    currentValue: 120,
    get value() {
      return this.currentValue;
    },
    set value(value: number) {
      this.currentValue = value;
      toneMocks.tempoWrites.push(value);
    },
  };

  return {
    Channel,
    Player,
    Transport: { bpm },
    dbToGain: (value: number) => (value === Number.NEGATIVE_INFINITY ? 0 : value),
    gainToDb: (value: number) => (value === 0 ? Number.NEGATIVE_INFINITY : value),
    getContext: () => ({ state: 'running' }),
    getTransport: () => ({ pause: vi.fn(), seconds: 0, start: vi.fn(), stop: vi.fn() }),
    Offline: toneMocks.offline,
    start: vi.fn(),
  };
});

import { AudioEngine } from './audio-engine';
import { AudioEngineErrorCode } from './errors';

const ORIGINAL_REGION = {
  id: 'region-1',
  url: 'original.wav',
  startTime: 4,
  sourceStartTime: 2,
  duration: 3,
};

describe('AudioEngine 실시간 상태 일관성', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toneMocks.channelOptions.length = 0;
    toneMocks.channels.length = 0;
    toneMocks.playerInstances.length = 0;
    toneMocks.loadFailures.clear();
    toneMocks.loadPromises.clear();
    toneMocks.startFailures.length = 0;
    toneMocks.tempoWrites.length = 0;
  });

  it('기존 채널의 mute와 solo 값을 변경한다', async () => {
    const engine = new AudioEngine();
    await engine.loadTrack('track.wav', 'track-1');

    engine.setTrackMute('track-1', true);
    engine.setTrackSolo('track-1', true);

    expect(toneMocks.channels[0]).toMatchObject({ mute: true, solo: true });
  });

  it('mute 중 볼륨 변경은 음소거를 유지하고 unmute 전에 목표 볼륨을 적용한다', async () => {
    const engine = new AudioEngine();
    await engine.loadTrack('track.wav', 'track-1');
    engine.setTrackMute('track-1', true);
    toneMocks.channelVolumeRampTo.mockClear();

    engine.setTrackVolume('track-1', 0.25);

    expect(toneMocks.channels[0]?.mute).toBe(true);
    expect(toneMocks.channelVolumeRampTo).not.toHaveBeenCalled();
    expect(engine.getTrackParams('track-1')?.volume).toBe(0.25);

    engine.setTrackMute('track-1', false);

    expect(toneMocks.channels[0]?.mute).toBe(false);
    expect(toneMocks.channels[0]?.volume.value).toBe(0.25);
    expect(toneMocks.channelVolumeRampTo).not.toHaveBeenCalled();
  });

  it('명시적 mute 없이 volume 0에서 올리면 다시 소리가 나도록 Param을 변경한다', async () => {
    const engine = new AudioEngine();
    await engine.loadTrack('track.wav', 'track-1');
    engine.setTrackVolume('track-1', 0);
    expect(toneMocks.channels[0]?.mute).toBe(true);
    expect(toneMocks.channels[0]?.volume.value).toBe(Number.NEGATIVE_INFINITY);
    toneMocks.channelVolumeRampTo.mockClear();

    engine.setTrackVolume('track-1', 0.25);

    expect(toneMocks.channelVolumeRampTo).toHaveBeenCalledWith(0.25, 0.1);
    expect(toneMocks.channels[0]?.mute).toBe(false);
  });

  it('mute 중 목표 volume이 0이면 unmute해도 이전 gain을 복원하지 않는다', async () => {
    const engine = new AudioEngine();
    await engine.loadTrack('track.wav', 'track-1');
    engine.setTrackMute('track-1', true);
    engine.setTrackVolume('track-1', 0);
    toneMocks.channelVolumeRampTo.mockClear();

    engine.setTrackMute('track-1', false);

    expect(toneMocks.channelVolumeRampTo).not.toHaveBeenCalled();
    expect(toneMocks.channels[0]?.volume.value).toBe(Number.NEGATIVE_INFINITY);
    expect(engine.getTrackParams('track-1')?.volume).toBe(0);

    engine.setTrackVolume('track-1', 0.25);

    expect(toneMocks.channels[0]?.mute).toBe(false);
    expect(toneMocks.channels[0]?.volume.value).toBe(0.25);
  });

  it('트랙을 제거하고 같은 ID로 다시 만들면 목표 볼륨을 기본값으로 초기화한다', async () => {
    const engine = new AudioEngine();
    await engine.loadTrack('track.wav', 'track-1');
    engine.setTrackVolume('track-1', 0.25);
    engine.removeTrack('track-1');

    await engine.loadTrack('track.wav', 'track-1');

    expect(engine.getTrackParams('track-1')?.volume).toBe(1);
  });

  it('없는 트랙의 mute와 solo 변경을 거부한다', () => {
    const engine = new AudioEngine();

    expect(() => engine.setTrackMute('missing-track', true)).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.TRACK_NOT_FOUND })
    );
    expect(() => engine.setTrackSolo('missing-track', true)).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.TRACK_NOT_FOUND })
    );
  });

  it('절대 초 기반 예약을 위해 생성 시 Transport BPM을 변경하지 않는다', () => {
    const engine = new AudioEngine();

    expect('setTempo' in engine).toBe(false);
    expect(toneMocks.tempoWrites).toHaveLength(0);
  });

  it('Region의 시작 위치와 소스 구간을 Player에 예약한다', async () => {
    const engine = new AudioEngine();

    await engine.addRegion('track-1', ORIGINAL_REGION);

    expect(toneMocks.playerLoad).toHaveBeenCalledWith('original.wav');
    expect(toneMocks.playerSync).toHaveBeenCalledOnce();
    expect(toneMocks.playerStart).toHaveBeenCalledWith(4, 2, 3);
  });

  it('Region 로드 실패 시 Player를 보관하지 않는다', async () => {
    const engine = new AudioEngine();
    toneMocks.loadFailures.set('original.wav', new Error('load failed'));

    await expect(engine.addRegion('track-1', ORIGINAL_REGION)).rejects.toMatchObject({
      code: AudioEngineErrorCode.REGION_LOAD_FAILED,
    });

    toneMocks.loadFailures.clear();
    await expect(engine.addRegion('track-1', ORIGINAL_REGION)).resolves.toBeUndefined();

    expect(toneMocks.playerInstances).toHaveLength(2);
    expect(toneMocks.playerInstances[0]?.disposed).toBe(true);
    expect(toneMocks.playerInstances[1]?.disposed).toBe(false);
  });

  it('디코딩된 Buffer를 공유하는 새 Player로 Region 예약을 교체한다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('track-1', ORIGINAL_REGION);
    const originalPlayer = toneMocks.playerInstances[0];

    engine.rescheduleRegion({ trackId: 'track-1', regionId: 'region-1', startTime: 7 });

    expect(toneMocks.playerInstances).toHaveLength(2);
    expect(toneMocks.playerLoad).toHaveBeenCalledOnce();
    expect(toneMocks.playerInstances[1]?.source).toBe(originalPlayer?.buffer);
    expect(originalPlayer?.disposed).toBe(true);
    expect(toneMocks.playerInstances[1]?.disposed).toBe(false);
    expect(toneMocks.playerStart).toHaveBeenLastCalledWith(7, 2, 3);
  });

  it('새 Player 예약 실패 시 원본 예약을 변경하지 않는다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('track-1', ORIGINAL_REGION);
    const originalPlayer = toneMocks.playerInstances[0];
    toneMocks.startFailures.push(new Error('schedule failed'));

    expect(() => engine.rescheduleRegion({ trackId: 'track-1', regionId: 'region-1', startTime: 8 })).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.REGION_SCHEDULE_FAILED })
    );

    expect(toneMocks.playerStart).toHaveBeenCalledTimes(2);
    expect(toneMocks.playerStart).toHaveBeenLastCalledWith(8, 2, 3);
    expect(originalPlayer?.disposed).toBe(false);
    expect(originalPlayer?.unsyncCount).toBe(0);
    expect(toneMocks.playerInstances[1]?.disposed).toBe(true);
  });

  it('순차 duplicate Region 추가를 ID 충돌로 거부한다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('track-1', ORIGINAL_REGION);

    await expect(engine.addRegion('track-1', ORIGINAL_REGION)).rejects.toMatchObject({
      code: AudioEngineErrorCode.REGION_ID_CONFLICT,
    });

    expect(toneMocks.playerInstances).toHaveLength(1);
  });

  it('같은 ID를 동시에 추가하면 늦게 완료된 Player를 정리한다', async () => {
    const engine = new AudioEngine();
    let resolveFirstLoad: (() => void) | undefined;
    let resolveSecondLoad: (() => void) | undefined;
    toneMocks.loadPromises.set(
      'first.wav',
      new Promise(resolve => {
        resolveFirstLoad = resolve;
      })
    );
    toneMocks.loadPromises.set(
      'second.wav',
      new Promise(resolve => {
        resolveSecondLoad = resolve;
      })
    );

    const firstAdd = engine.addRegion('track-1', { ...ORIGINAL_REGION, url: 'first.wav' });
    const secondAdd = engine.addRegion('track-1', { ...ORIGINAL_REGION, url: 'second.wav' });
    await vi.waitFor(() => expect(toneMocks.playerLoad).toHaveBeenCalledTimes(2));
    resolveFirstLoad?.();
    await firstAdd;
    resolveSecondLoad?.();

    await expect(secondAdd).rejects.toMatchObject({ code: AudioEngineErrorCode.REGION_ID_CONFLICT });
    expect(toneMocks.playerInstances[1]?.disposed).toBe(true);
  });

  it('Region 로드 중 트랙이 제거·재생성되면 새 Player를 정리한다', async () => {
    const engine = new AudioEngine();
    let resolveLoad: (() => void) | undefined;
    toneMocks.loadPromises.set(
      'pending.wav',
      new Promise(resolve => {
        resolveLoad = resolve;
      })
    );
    const addRegion = engine.addRegion('track-1', { ...ORIGINAL_REGION, url: 'pending.wav' });
    await vi.waitFor(() => expect(toneMocks.playerLoad).toHaveBeenCalledWith('pending.wav'));

    engine.removeTrack('track-1');
    await engine.loadTrack('new-track.wav', 'track-1');
    resolveLoad?.();

    await expect(addRegion).rejects.toMatchObject({ code: AudioEngineErrorCode.REGION_STATE_CHANGED });
    expect(toneMocks.playerInstances[0]?.disposed).toBe(true);
  });

  it('없는 Region의 재예약을 거부한다', () => {
    const engine = new AudioEngine();

    expect(() =>
      engine.rescheduleRegion({ trackId: 'track-1', regionId: 'missing-region', startTime: 3 })
    ).toThrowError(expect.objectContaining({ code: AudioEngineErrorCode.REGION_NOT_FOUND }));
  });

  it('교체 Region을 모두 예약한 뒤 원본 Player를 제거한다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('track-1', ORIGINAL_REGION);
    const originalPlayer = toneMocks.playerInstances[0];

    await engine.replaceRegion({
      trackId: 'track-1',
      regionId: 'region-1',
      replacements: [
        { ...ORIGINAL_REGION, id: 'region-left', duration: 1 },
        { ...ORIGINAL_REGION, id: 'region-right', startTime: 5, sourceStartTime: 3, duration: 2 },
      ],
    });

    expect(toneMocks.playerLoad).toHaveBeenCalledTimes(3);
    expect(toneMocks.playerStart).toHaveBeenCalledWith(4, 2, 1);
    expect(toneMocks.playerStart).toHaveBeenCalledWith(5, 3, 2);
    expect(originalPlayer?.disposed).toBe(true);
    expect(() => engine.rescheduleRegion({ trackId: 'track-1', regionId: 'region-1', startTime: 0 })).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.REGION_NOT_FOUND })
    );
    expect(() => engine.rescheduleRegion({ trackId: 'track-1', regionId: 'region-left', startTime: 1 })).not.toThrow();
  });

  it('교체 Region 로드 실패 시 새 Player를 정리하고 원본을 유지한다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('track-1', ORIGINAL_REGION);
    const originalPlayer = toneMocks.playerInstances[0];
    let resolveSuccessfulLoad: (() => void) | undefined;
    toneMocks.loadPromises.set(
      'left.wav',
      new Promise(resolve => {
        resolveSuccessfulLoad = resolve;
      })
    );
    toneMocks.loadFailures.set('broken.wav', new Error('load failed'));

    const replaceRegion = engine.replaceRegion({
      trackId: 'track-1',
      regionId: 'region-1',
      replacements: [
        { ...ORIGINAL_REGION, id: 'region-left', url: 'left.wav' },
        { ...ORIGINAL_REGION, id: 'region-right', url: 'broken.wav' },
      ],
    });
    let isSettled = false;
    void replaceRegion.catch(() => {
      isSettled = true;
    });
    await vi.waitFor(() => expect(toneMocks.playerLoad).toHaveBeenCalledTimes(3));
    await Promise.resolve();
    expect(isSettled).toBe(false);
    resolveSuccessfulLoad?.();

    await expect(replaceRegion).rejects.toMatchObject({ code: AudioEngineErrorCode.REGION_LOAD_FAILED });

    expect(originalPlayer?.disposed).toBe(false);
    expect(originalPlayer?.unsyncCount).toBe(0);
    expect(toneMocks.playerInstances.slice(1).every(player => player.disposed)).toBe(true);
    expect(() => engine.rescheduleRegion({ trackId: 'track-1', regionId: 'region-1', startTime: 6 })).not.toThrow();
  });

  it('교체 Region 예약 실패 시 새 Player를 정리하고 원본을 유지한다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('track-1', ORIGINAL_REGION);
    const originalPlayer = toneMocks.playerInstances[0];
    toneMocks.startFailures.push(undefined, new Error('schedule failed'));

    await expect(
      engine.replaceRegion({
        trackId: 'track-1',
        regionId: 'region-1',
        replacements: [
          { ...ORIGINAL_REGION, id: 'region-left', url: 'left.wav' },
          { ...ORIGINAL_REGION, id: 'region-right', url: 'right.wav' },
        ],
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.REGION_SCHEDULE_FAILED });

    expect(originalPlayer?.disposed).toBe(false);
    expect(originalPlayer?.unsyncCount).toBe(0);
    expect(toneMocks.playerInstances.slice(1).every(player => player.disposed)).toBe(true);
    expect(() => engine.rescheduleRegion({ trackId: 'track-1', regionId: 'region-1', startTime: 6 })).not.toThrow();
  });

  it('교체 Region ID가 기존 ID와 충돌하면 로드 전에 거부한다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('track-1', ORIGINAL_REGION);
    await engine.addRegion('track-1', { ...ORIGINAL_REGION, id: 'region-2' });

    await expect(
      engine.replaceRegion({
        trackId: 'track-1',
        regionId: 'region-1',
        replacements: [{ ...ORIGINAL_REGION, id: 'region-2' }],
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.REGION_ID_CONFLICT });

    expect(toneMocks.playerInstances).toHaveLength(2);
  });

  it('교체 로드 중 Region이 이동되면 새 Player를 정리하고 이동 결과를 유지한다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('track-1', ORIGINAL_REGION);
    let resolveLoad: (() => void) | undefined;
    const pendingLoad = new Promise<void>(resolve => {
      resolveLoad = resolve;
    });
    toneMocks.loadPromises.set('left.wav', pendingLoad);
    toneMocks.loadPromises.set('right.wav', pendingLoad);

    const replaceRegion = engine.replaceRegion({
      trackId: 'track-1',
      regionId: 'region-1',
      replacements: [
        { ...ORIGINAL_REGION, id: 'region-left', url: 'left.wav' },
        { ...ORIGINAL_REGION, id: 'region-right', url: 'right.wav' },
      ],
    });
    await vi.waitFor(() => expect(toneMocks.playerLoad).toHaveBeenCalledTimes(3));
    engine.rescheduleRegion({ trackId: 'track-1', regionId: 'region-1', startTime: 7 });
    const movedPlayer = toneMocks.playerInstances[3];
    resolveLoad?.();

    await expect(replaceRegion).rejects.toMatchObject({ code: AudioEngineErrorCode.REGION_STATE_CHANGED });
    expect(movedPlayer?.disposed).toBe(false);
    expect(toneMocks.playerInstances[1]?.disposed).toBe(true);
    expect(toneMocks.playerInstances[2]?.disposed).toBe(true);
  });

  it('트랙 제거 시 소속 Player와 Channel을 모두 해제한다', async () => {
    const engine = new AudioEngine();

    await engine.addRegion('track-1', { ...ORIGINAL_REGION, id: 'region-1' });
    await engine.addRegion('track-1', { ...ORIGINAL_REGION, id: 'region-2' });
    engine.removeTrack('track-1');

    expect(toneMocks.playerUnsync).toHaveBeenCalledTimes(2);
    expect(toneMocks.playerStop).toHaveBeenCalledTimes(2);
    expect(toneMocks.playerDisconnect).toHaveBeenCalledTimes(2);
    expect(toneMocks.playerDispose).toHaveBeenCalledTimes(2);
    expect(toneMocks.channelDisconnect).toHaveBeenCalledOnce();
    expect(toneMocks.channelDispose).toHaveBeenCalledOnce();
  });

  it('Solo 트랙 제거 전에 solo를 해제한다', async () => {
    const engine = new AudioEngine();
    await engine.loadTrack('track.wav', 'track-1');
    engine.setTrackSolo('track-1', true);
    toneMocks.channelSoloWrites.mockClear();

    engine.removeTrack('track-1');

    expect(toneMocks.channelSoloWrites).toHaveBeenCalledWith(false);
    expect(toneMocks.channelSoloWrites).toHaveBeenCalledBefore(toneMocks.channelDispose);
  });
});

describe('AudioEngine Export 회귀', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toneMocks.channelOptions.length = 0;
    toneMocks.channels.length = 0;
    toneMocks.playerInstances.length = 0;
    toneMocks.loadFailures.clear();
    toneMocks.loadPromises.clear();
    toneMocks.startFailures.length = 0;
    toneMocks.tempoWrites.length = 0;
  });

  it('선택 범위를 오프라인 렌더링하고 PCM WAV를 반환한다', async () => {
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
