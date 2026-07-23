import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ChannelMockState {
  destination?: unknown;
  mute: boolean;
  solo: boolean;
  volume: {
    value: number;
  };
}

interface PlayerMockState {
  buffer: { duration: number };
  destination?: unknown;
  disposed: boolean;
  source: unknown;
  unsyncCount: number;
}

interface GainMockState {
  disposed: boolean;
  destination?: unknown;
  readonly gain: {
    value: number;
    rampTo: (value: number, rampSeconds: number) => void;
  };
}

interface DistortionMockState {
  destination?: unknown;
  disposed: boolean;
  distortion: number;
  oversample: 'none' | '2x' | '4x';
}

const toneMocks = vi.hoisted(() => ({
  channelOptions: [] as Array<{ volume: number; pan: number }>,
  channels: [] as ChannelMockState[],
  distortions: [] as DistortionMockState[],
  gains: [] as GainMockState[],
  outputGains: [] as GainMockState[],
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
  channelConnect: vi.fn(),
  channelConnectFailures: [] as Array<Error | undefined>,
  channelToDestination: vi.fn(),
  gainDisconnect: vi.fn(),
  gainDispose: vi.fn(),
  gainConnect: vi.fn(),
  gainConnectFailures: [] as Array<Error | undefined>,
  gainRampTo: vi.fn(),
  gainToDestination: vi.fn(),
  gainValueFailures: [] as Array<Error | undefined>,
  playerConnect: vi.fn(),
  playerConnectFailures: [] as Array<Error | undefined>,
  playerDisconnect: vi.fn(),
  playerDispose: vi.fn(),
  playerLoad: vi.fn(),
  playerStart: vi.fn(),
  playerStop: vi.fn(),
  playerSync: vi.fn(),
  playerUnsync: vi.fn(),
  transportPause: vi.fn(),
  transportStart: vi.fn(),
  transportStop: vi.fn(),
  transportSeconds: 0,
  transportSecondsFailures: [] as Array<Error | undefined>,
  transportState: 'stopped' as 'paused' | 'started' | 'stopped',
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
    destination?: unknown;
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
      toneMocks.channelToDestination();
      return this;
    }

    connect(destination: unknown) {
      this.destination = destination;
      toneMocks.channelConnect();
      const failure = toneMocks.channelConnectFailures.shift();
      if (failure) {
        throw failure;
      }
      return this;
    }

    disconnect() {
      toneMocks.channelDisconnect();
    }

    dispose() {
      toneMocks.channelDispose();
    }
  }

  class Gain implements GainMockState {
    disposed = false;
    destination?: unknown;
    readonly gain: GainMockState['gain'];

    constructor(options?: number | { gain?: number }) {
      let gainValue = typeof options === 'number' ? options : (options?.gain ?? 1);
      this.gain = {
        get value() {
          return gainValue;
        },
        set value(value: number) {
          const failure = toneMocks.gainValueFailures.shift();
          if (failure) {
            throw failure;
          }
          gainValue = value;
        },
        rampTo: (value, rampSeconds) => {
          gainValue = value;
          toneMocks.gainRampTo(value, rampSeconds);
        },
      };
      toneMocks.gains.push(this);
    }

    toDestination() {
      toneMocks.outputGains.push(this);
      toneMocks.gainToDestination();
      return this;
    }

    connect(destination: unknown) {
      this.destination = destination;
      toneMocks.gainConnect();
      const failure = toneMocks.gainConnectFailures.shift();
      if (failure) {
        throw failure;
      }
      return this;
    }

    disconnect() {
      this.destination = undefined;
      toneMocks.gainDisconnect();
      return this;
    }

    dispose() {
      this.disposed = true;
      toneMocks.gainDispose();
      return this;
    }
  }

  class Distortion implements DistortionMockState {
    destination?: unknown;
    disposed = false;
    distortion: number;
    oversample: 'none' | '2x' | '4x';

    constructor(options: { distortion: number; oversample: 'none' | '2x' | '4x' }) {
      this.distortion = options.distortion;
      this.oversample = options.oversample;
      toneMocks.distortions.push(this);
    }

    connect(destination: unknown) {
      this.destination = destination;
      return this;
    }

    disconnect() {
      this.destination = undefined;
      return this;
    }

    dispose() {
      this.disposed = true;
      return this;
    }
  }

  class Player implements PlayerMockState {
    buffer = { duration: 10 };
    destination?: unknown;
    disposed = false;
    source: unknown;
    unsyncCount = 0;

    constructor(options?: { url?: unknown }) {
      this.source = options?.url;
      toneMocks.playerInstances.push(this);
    }

    connect(destination: unknown) {
      this.destination = destination;
      toneMocks.playerConnect();
      const failure = toneMocks.playerConnectFailures.shift();
      if (failure) {
        throw failure;
      }
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

  const transport = {
    pause: () => {
      toneMocks.transportPause();
      toneMocks.transportState = 'paused';
      return transport;
    },
    start: () => {
      toneMocks.transportStart();
      toneMocks.transportState = 'started';
      return transport;
    },
    stop: () => {
      toneMocks.transportStop();
      toneMocks.transportState = 'stopped';
      return transport;
    },
    get state() {
      return toneMocks.transportState;
    },
    get seconds() {
      return toneMocks.transportSeconds;
    },
    set seconds(value: number) {
      const failure = toneMocks.transportSecondsFailures.shift();
      if (failure) {
        throw failure;
      }
      toneMocks.transportSeconds = value;
    },
  };

  return {
    Channel,
    Distortion,
    Gain,
    Player,
    Transport: { bpm },
    dbToGain: (value: number) => (value === Number.NEGATIVE_INFINITY ? 0 : value),
    gainToDb: (value: number) => (value === 0 ? Number.NEGATIVE_INFINITY : value),
    getContext: () => ({ state: 'running' }),
    getTransport: () => transport,
    Offline: toneMocks.offline,
    start: vi.fn(),
  };
});

import { AudioEngine } from './audio-engine';
import { AudioEngineErrorCode } from './errors';
import { ToneGainPluginRuntimeFactory } from './plugins/tone-gain-plugin-runtime';
import { ToneSaturationPluginRuntimeFactory } from './plugins/tone-saturation-plugin-runtime';

const ORIGINAL_REGION = {
  id: 'region-1',
  url: 'original.wav',
  startTime: 4,
  sourceStartTime: 2,
  duration: 3,
};

function createPluginAudioEngine(): AudioEngine {
  return new AudioEngine({
    pluginRuntimeFactories: [
      new ToneGainPluginRuntimeFactory({
        manifestId: 'builtin.gain',
        parameterId: 'gain',
        minValue: 0,
        maxValue: 2,
        defaultValue: 1,
      }),
    ],
  });
}

function createSaturationAudioEngine(): AudioEngine {
  return new AudioEngine({
    pluginRuntimeFactories: [
      new ToneSaturationPluginRuntimeFactory({
        manifestId: 'builtin.saturation',
        parameterId: 'drive',
        minValue: 0,
        maxValue: 1,
        defaultValue: 0.2,
      }),
    ],
  });
}

describe('AudioEngine 실시간 상태 일관성', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toneMocks.channelOptions.length = 0;
    toneMocks.channels.length = 0;
    toneMocks.distortions.length = 0;
    toneMocks.gains.length = 0;
    toneMocks.outputGains.length = 0;
    toneMocks.playerInstances.length = 0;
    toneMocks.loadFailures.clear();
    toneMocks.loadPromises.clear();
    toneMocks.startFailures.length = 0;
    toneMocks.channelConnectFailures.length = 0;
    toneMocks.gainConnectFailures.length = 0;
    toneMocks.gainRampTo.mockClear();
    toneMocks.gainValueFailures.length = 0;
    toneMocks.playerConnectFailures.length = 0;
    toneMocks.tempoWrites.length = 0;
    toneMocks.transportSeconds = 0;
    toneMocks.transportSecondsFailures.length = 0;
    toneMocks.transportState = 'stopped';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('명시적 mute와 solo 선택을 채널 음소거로 계산한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('track-1');

    engine.setTrackMute('track-1', true);
    engine.setTrackSolo('track-1', true);

    expect(toneMocks.channels[0]).toMatchObject({ mute: true, solo: false });
  });

  it('mute 중 볼륨 변경은 음소거를 유지하고 unmute 전에 목표 볼륨을 적용한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('track-1');
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
    await engine.addTrack('track-1');
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
    await engine.addTrack('track-1');
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
    await engine.addTrack('track-1');
    engine.setTrackVolume('track-1', 0.25);
    engine.removeTrack('track-1');

    await engine.addTrack('track-1');

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

  it('Region Player를 Track input에 연결하고 input을 Channel 앞에 둔다', async () => {
    const engine = new AudioEngine();

    await engine.addRegion('track-1', ORIGINAL_REGION);

    const output = toneMocks.outputGains[0];
    const trackInput = toneMocks.gains.find(gain => gain !== output);
    expect(toneMocks.playerInstances[0]?.destination).toBe(trackInput);
    expect(trackInput?.destination).toBe(toneMocks.channels[0]);
    expect(toneMocks.channels[0]?.destination).toBe(output);
  });

  it('Gain Plugin을 Track input과 Channel 사이에 설치한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    const trackInput = toneMocks.gains[1];

    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: new Map([['gain', 0.5]]),
    });

    const pluginGain = toneMocks.gains[2];
    expect(trackInput?.destination).toBe(pluginGain);
    expect(pluginGain?.destination).toBe(toneMocks.channels[0]);
    expect(pluginGain?.gain.value).toBe(0.5);
  });

  it('Saturation Plugin을 Track 체인에 연결하고 drive를 변경한다', async () => {
    const engine = createSaturationAudioEngine();
    await engine.addTrack('track-1');
    const trackInput = toneMocks.gains[1];

    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.saturation',
      parameterValues: new Map([['drive', 0.4]]),
    });
    const saturation = toneMocks.distortions[0];

    engine.setPluginParameter({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      parameterId: 'drive',
      value: 0.7,
    });

    expect(trackInput?.destination).toBe(saturation);
    expect(saturation?.destination).toBe(toneMocks.channels[0]);
    expect(saturation).toMatchObject({ distortion: 0.7, oversample: '2x' });
  });

  it('여러 Plugin을 설치 순서대로 직렬 연결한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');

    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: new Map(),
    });
    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-2',
      manifestId: 'builtin.gain',
      parameterValues: new Map(),
    });

    expect(toneMocks.gains[1]?.destination).toBe(toneMocks.gains[2]);
    expect(toneMocks.gains[2]?.destination).toBe(toneMocks.gains[3]);
    expect(toneMocks.gains[3]?.destination).toBe(toneMocks.channels[0]);
  });

  it('Plugin을 지정한 index에 설치한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');

    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: new Map(),
    });
    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-2',
      manifestId: 'builtin.gain',
      targetIndex: 0,
      parameterValues: new Map(),
    });

    expect(toneMocks.gains[1]?.destination).toBe(toneMocks.gains[3]);
    expect(toneMocks.gains[3]?.destination).toBe(toneMocks.gains[2]);
    expect(toneMocks.gains[2]?.destination).toBe(toneMocks.channels[0]);
  });

  it('Plugin 설치 index가 범위를 벗어나면 runtime 생성 전에 거부한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');

    expect(() =>
      engine.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.gain',
        targetIndex: 1,
        parameterValues: new Map(),
      })
    ).toThrowError(expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_TARGET_INDEX_OUT_OF_RANGE }));
  });

  it('Plugin runtime 순서를 바꾸고 Track 체인을 다시 연결한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    ['plugin-1', 'plugin-2'].forEach(instanceId =>
      engine.installPlugin({
        trackId: 'track-1',
        instanceId,
        manifestId: 'builtin.gain',
        parameterValues: new Map(),
      })
    );

    engine.movePlugin({ trackId: 'track-1', instanceId: 'plugin-1', targetIndex: 1 });

    expect(toneMocks.gains[1]?.destination).toBe(toneMocks.gains[3]);
    expect(toneMocks.gains[3]?.destination).toBe(toneMocks.gains[2]);
    expect(toneMocks.gains[2]?.destination).toBe(toneMocks.channels[0]);
  });

  it('Plugin 순서 연결이 실패하면 이전 체인을 복원한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    ['plugin-1', 'plugin-2'].forEach(instanceId =>
      engine.installPlugin({
        trackId: 'track-1',
        instanceId,
        manifestId: 'builtin.gain',
        parameterValues: new Map(),
      })
    );
    toneMocks.gainConnectFailures.push(new Error('move failed'));

    expect(() => engine.movePlugin({ trackId: 'track-1', instanceId: 'plugin-1', targetIndex: 1 })).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_CHAIN_UPDATE_FAILED })
    );
    expect(toneMocks.gains[1]?.destination).toBe(toneMocks.gains[2]);
    expect(toneMocks.gains[2]?.destination).toBe(toneMocks.gains[3]);
    expect(toneMocks.gains[3]?.destination).toBe(toneMocks.channels[0]);
  });

  it('Plugin 이동 index가 범위를 벗어나면 체인을 유지한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: new Map(),
    });

    expect(() => engine.movePlugin({ trackId: 'track-1', instanceId: 'plugin-1', targetIndex: 1 })).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_TARGET_INDEX_OUT_OF_RANGE })
    );
    expect(toneMocks.gains[1]?.destination).toBe(toneMocks.gains[2]);
    expect(toneMocks.gains[2]?.destination).toBe(toneMocks.channels[0]);
  });

  it('설치한 Gain Plugin Parameter를 변경한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: new Map(),
    });

    engine.setPluginParameter({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      parameterId: 'gain',
      value: 0.25,
    });

    expect(toneMocks.gainRampTo).toHaveBeenCalledWith(0.25, 0.01);
  });

  it('비활성 Plugin은 체인에서 우회하고 다시 활성화할 수 있다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    const trackInput = toneMocks.gains[1];

    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      isEnabled: false,
      parameterValues: new Map(),
    });
    const pluginGain = toneMocks.gains[2];

    expect(trackInput?.destination).toBe(toneMocks.channels[0]);
    expect(pluginGain?.destination).toBeUndefined();

    engine.setPluginEnabled({ trackId: 'track-1', instanceId: 'plugin-1', isEnabled: true });
    expect(trackInput?.destination).toBe(pluginGain);
    expect(pluginGain?.destination).toBe(toneMocks.channels[0]);

    engine.setPluginEnabled({ trackId: 'track-1', instanceId: 'plugin-1', isEnabled: false });
    expect(trackInput?.destination).toBe(toneMocks.channels[0]);
    expect(pluginGain?.destination).toBeUndefined();
  });

  it('Plugin 활성화 연결이 실패하면 이전 우회 연결을 복원한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      isEnabled: false,
      parameterValues: new Map(),
    });
    toneMocks.gainConnectFailures.push(new Error('connect failed'));

    expect(() => engine.setPluginEnabled({ trackId: 'track-1', instanceId: 'plugin-1', isEnabled: true })).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_CHAIN_UPDATE_FAILED })
    );

    expect(toneMocks.gains[1]?.destination).toBe(toneMocks.channels[0]);
    expect(toneMocks.gains[2]?.destination).toBeUndefined();
  });

  it('Plugin을 제거하고 남은 체인을 다시 연결한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: new Map(),
    });
    const pluginGain = toneMocks.gains[2];

    engine.removePlugin('track-1', 'plugin-1');

    expect(toneMocks.gains[1]?.destination).toBe(toneMocks.channels[0]);
    expect(pluginGain?.disposed).toBe(true);
  });

  it('지원하지 않는 manifest와 중복 instance를 거부한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');

    expect(() =>
      engine.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.missing',
        parameterValues: new Map(),
      })
    ).toThrowError(expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_FACTORY_NOT_FOUND }));

    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: new Map(),
    });
    expect(() =>
      engine.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.gain',
        parameterValues: new Map(),
      })
    ).toThrowError(expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_INSTANCE_ID_CONFLICT }));
  });

  it('Plugin 연결 실패 시 기존 bypass 연결을 복원하고 새 runtime을 폐기한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    toneMocks.gainConnectFailures.push(new Error('connect failed'));

    expect(() =>
      engine.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.gain',
        parameterValues: new Map(),
      })
    ).toThrowError(expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_CHAIN_UPDATE_FAILED }));

    expect(toneMocks.gains[1]?.destination).toBe(toneMocks.channels[0]);
    expect(toneMocks.gains[2]?.disposed).toBe(true);
  });

  it('Plugin 체인 복원이 계속 실패하면 다음 작업을 막고 복원을 재시도한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    toneMocks.gainConnectFailures.push(
      new Error('plugin connect failed'),
      new Error('rollback failed'),
      new Error('next operation retry failed')
    );

    expect(() =>
      engine.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.gain',
        parameterValues: new Map(),
      })
    ).toThrowError(
      expect.objectContaining({
        code: AudioEngineErrorCode.PLUGIN_CHAIN_UPDATE_FAILED,
        details: expect.objectContaining({ isRuntimeRecoveryPending: true }),
      })
    );
    expect(() => engine.getTrackParams('track-1')).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.PROJECT_RUNTIME_RECOVERY_PENDING })
    );

    expect(engine.getTrackParams('track-1')).not.toBeNull();
    expect(toneMocks.gains[1]?.destination).toBe(toneMocks.channels[0]);
    expect(toneMocks.gains[2]?.disposed).toBe(true);
  });

  it('Track을 제거하면 설치한 Plugin runtime도 폐기한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');
    engine.installPlugin({
      trackId: 'track-1',
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      parameterValues: new Map(),
    });
    const pluginGain = toneMocks.gains[2];

    engine.removeTrack('track-1');

    expect(pluginGain?.disposed).toBe(true);
  });

  it('잘못된 초기 Parameter를 Plugin runtime 생성 오류로 변환한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('track-1');

    expect(() =>
      engine.installPlugin({
        trackId: 'track-1',
        instanceId: 'plugin-1',
        manifestId: 'builtin.gain',
        parameterValues: new Map([['gain', 3]]),
      })
    ).toThrowError(
      expect.objectContaining({
        code: AudioEngineErrorCode.PLUGIN_RUNTIME_CREATE_FAILED,
        details: expect.objectContaining({ runtimeErrorCode: 'INVALID_PARAMETER_VALUE' }),
      })
    );
  });

  it('같은 manifest ID의 Plugin runtime factory 등록을 거부한다', () => {
    const factoryOptions = {
      manifestId: 'builtin.gain',
      parameterId: 'gain',
      minValue: 0,
      maxValue: 2,
      defaultValue: 1,
    };

    expect(
      () =>
        new AudioEngine({
          pluginRuntimeFactories: [
            new ToneGainPluginRuntimeFactory(factoryOptions),
            new ToneGainPluginRuntimeFactory(factoryOptions),
          ],
        })
    ).toThrowError(expect.objectContaining({ code: AudioEngineErrorCode.PLUGIN_FACTORY_ID_CONFLICT }));
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
    await engine.addTrack('track-1');
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
    expect(toneMocks.gainDisconnect).toHaveBeenCalledOnce();
    expect(toneMocks.gainDispose).toHaveBeenCalledOnce();
    expect(toneMocks.channelDisconnect).toHaveBeenCalledOnce();
    expect(toneMocks.channelDispose).toHaveBeenCalledOnce();
  });

  it('마지막 Solo 트랙을 제거하면 남은 트랙의 계산된 음소거를 해제한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('track-1');
    await engine.addTrack('track-2');
    engine.setTrackSolo('track-1', true);

    expect(toneMocks.channels[0]?.mute).toBe(false);
    expect(toneMocks.channels[1]?.mute).toBe(true);

    engine.removeTrack('track-1');

    expect(toneMocks.channels[1]?.mute).toBe(false);
    expect(toneMocks.channels[1]?.solo).toBe(false);
  });

  it('Solo가 활성화된 동안 추가한 일반 Track을 즉시 음소거한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('solo-track');
    engine.setTrackSolo('solo-track', true);

    await engine.addTrack('new-track');

    expect(toneMocks.channels[0]?.mute).toBe(false);
    expect(toneMocks.channels[1]?.mute).toBe(true);
  });

  it('새 프로젝트 그래프를 음소거 상태로 준비하고 activate에서 기존 그래프와 교체한다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('current-track', ORIGINAL_REGION);
    toneMocks.transportSeconds = 7;

    const replacement = await engine.prepareProjectGraph({
      tracks: [
        {
          id: 'replacement-track',
          volume: 0.5,
          pan: -0.25,
          isMuted: false,
          isSoloed: true,
          pluginInstances: [],
          regions: [{ ...ORIGINAL_REGION, id: 'replacement-region', url: 'replacement.wav' }],
        },
      ],
    });

    expect(engine.getTrackParams('current-track')).not.toBeNull();
    expect(engine.getTrackParams('replacement-track')).toBeNull();
    expect(toneMocks.channels[1]?.mute).toBe(false);
    expect(toneMocks.channels[1]?.solo).toBe(false);
    expect(toneMocks.outputGains[1]?.gain.value).toBe(0);

    replacement.assertActivatable();
    const retiredGraph = replacement.activate();

    expect(engine.getTrackParams('current-track')).toBeNull();
    expect(engine.getTrackParams('replacement-track')).toEqual({ volume: 0.5, pan: -0.25 });
    expect(toneMocks.transportStop).toHaveBeenCalledOnce();
    expect(toneMocks.transportSeconds).toBe(0);
    expect(toneMocks.channels[1]?.mute).toBe(false);
    expect(toneMocks.channels[1]?.solo).toBe(false);
    expect(toneMocks.outputGains[0]?.gain.value).toBe(0);
    expect(toneMocks.outputGains[1]?.gain.value).toBe(1);
    expect(toneMocks.playerDispose).not.toHaveBeenCalled();

    retiredGraph.dispose();
    expect(toneMocks.playerDispose).toHaveBeenCalledTimes(1);
  });

  it('프로젝트 그래프를 준비할 때 Plugin을 저장 순서대로 연결한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('current-track');

    const replacement = await engine.prepareProjectGraph({
      tracks: [
        {
          id: 'replacement-track',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          pluginInstances: [
            {
              instanceId: 'plugin-1',
              manifestId: 'builtin.gain',
              isEnabled: true,
              parameterValues: new Map([['gain', 0.5]]),
            },
            {
              instanceId: 'plugin-2',
              manifestId: 'builtin.gain',
              isEnabled: true,
              parameterValues: new Map([['gain', 0.25]]),
            },
          ],
          regions: [],
        },
      ],
    });

    const preparedInput = toneMocks.gains[3];
    const firstPlugin = toneMocks.gains[4];
    const secondPlugin = toneMocks.gains[5];
    expect(engine.getTrackParams('current-track')).not.toBeNull();
    expect(engine.getTrackParams('replacement-track')).toBeNull();
    expect(preparedInput?.destination).toBe(firstPlugin);
    expect(firstPlugin?.destination).toBe(secondPlugin);
    expect(secondPlugin?.destination).toBe(toneMocks.channels[1]);
    expect(firstPlugin?.gain.value).toBe(0.5);
    expect(secondPlugin?.gain.value).toBe(0.25);

    replacement.activate();
    expect(() => engine.removePlugin('replacement-track', 'plugin-1')).not.toThrow();
  });

  it('프로젝트 Plugin 준비 실패 시 후보 runtime만 정리하고 기존 그래프를 유지한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('current-track');

    await expect(
      engine.prepareProjectGraph({
        tracks: [
          {
            id: 'replacement-track',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [
              {
                instanceId: 'plugin-1',
                manifestId: 'builtin.gain',
                isEnabled: true,
                parameterValues: new Map(),
              },
              {
                instanceId: 'plugin-2',
                manifestId: 'builtin.missing',
                isEnabled: true,
                parameterValues: new Map(),
              },
            ],
            regions: [],
          },
        ],
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.PLUGIN_FACTORY_NOT_FOUND });

    expect(engine.getTrackParams('current-track')).not.toBeNull();
    expect(engine.getTrackParams('replacement-track')).toBeNull();
    expect(toneMocks.gains[4]?.disposed).toBe(true);
  });

  it('프로젝트 Plugin 연결 실패 시 후보 chain을 정리하고 기존 그래프를 유지한다', async () => {
    const engine = createPluginAudioEngine();
    await engine.addTrack('current-track');
    toneMocks.gainConnectFailures.push(new Error('connect failed'));

    await expect(
      engine.prepareProjectGraph({
        tracks: [
          {
            id: 'replacement-track',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [
              {
                instanceId: 'plugin-1',
                manifestId: 'builtin.gain',
                isEnabled: true,
                parameterValues: new Map(),
              },
            ],
            regions: [],
          },
        ],
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.PLUGIN_CHAIN_UPDATE_FAILED });

    expect(engine.getTrackParams('current-track')).not.toBeNull();
    expect(engine.getTrackParams('replacement-track')).toBeNull();
    expect(toneMocks.gains[4]?.disposed).toBe(true);
  });

  it('같은 Track의 중복 Plugin instance ID를 프로젝트 준비 단계에서 거부한다', async () => {
    const engine = createPluginAudioEngine();
    const pluginInstance = {
      instanceId: 'plugin-1',
      manifestId: 'builtin.gain',
      isEnabled: true,
      parameterValues: new Map(),
    };

    await expect(
      engine.prepareProjectGraph({
        tracks: [
          {
            id: 'replacement-track',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [pluginInstance, pluginInstance],
            regions: [],
          },
        ],
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.PLUGIN_INSTANCE_ID_CONFLICT });
  });

  it('프로젝트의 비활성 Plugin runtime을 만들고 체인에서는 우회한다', async () => {
    const engine = createPluginAudioEngine();

    const preparedGraph = await engine.prepareProjectGraph({
      tracks: [
        {
          id: 'replacement-track',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          pluginInstances: [
            {
              instanceId: 'plugin-1',
              manifestId: 'builtin.gain',
              isEnabled: false,
              parameterValues: new Map(),
            },
          ],
          regions: [],
        },
      ],
    });
    preparedGraph.activate();

    expect(toneMocks.gains).toHaveLength(4);
    expect(toneMocks.gains[2]?.destination).toBe(toneMocks.channels[0]);
    expect(toneMocks.gains[3]?.destination).toBeUndefined();

    engine.setPluginEnabled({ trackId: 'replacement-track', instanceId: 'plugin-1', isEnabled: true });
    expect(toneMocks.gains[2]?.destination).toBe(toneMocks.gains[3]);
    expect(toneMocks.gains[3]?.destination).toBe(toneMocks.channels[0]);
  });

  it('새 프로젝트 Region 로드 실패 시 준비 그래프만 정리하고 기존 그래프를 유지한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    toneMocks.loadFailures.set('broken.wav', new Error('load failed'));

    await expect(
      engine.prepareProjectGraph({
        tracks: [
          {
            id: 'replacement-track',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [],
            regions: [{ ...ORIGINAL_REGION, url: 'broken.wav' }],
          },
        ],
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.REGION_LOAD_FAILED });

    expect(engine.getTrackParams('current-track')).not.toBeNull();
    expect(engine.getTrackParams('replacement-track')).toBeNull();
    expect(toneMocks.channelDispose).toHaveBeenCalledTimes(1);
  });

  it('준비 중 active 그래프가 바뀌면 activate 전에 거부한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    const replacement = await engine.prepareProjectGraph({
      tracks: [
        {
          id: 'replacement-track',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          pluginInstances: [],
          regions: [],
        },
      ],
    });

    engine.setTrackVolume('current-track', 0.25);

    expect(() => replacement.assertActivatable()).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.ACTIVE_GRAPH_CHANGED })
    );
    replacement.discard();
    expect(engine.getTrackParams('current-track')?.volume).toBe(0.25);
    expect(toneMocks.channelDispose).toHaveBeenCalledTimes(1);
  });

  it('준비 시작 전에 실행 중이던 Region 추가가 나중에 완료되면 교체를 거부한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    let finishLoad: (() => void) | undefined;
    toneMocks.loadPromises.set(
      'late.wav',
      new Promise<void>(resolve => {
        finishLoad = resolve;
      })
    );
    const addRegion = engine.addRegion('current-track', { ...ORIGINAL_REGION, url: 'late.wav' });
    await vi.waitFor(() => expect(toneMocks.playerLoad).toHaveBeenCalledWith('late.wav'));
    const replacement = await engine.prepareProjectGraph({ tracks: [] });

    finishLoad?.();
    await addRegion;

    expect(() => replacement.assertActivatable()).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.ACTIVE_GRAPH_CHANGED })
    );
    replacement.discard();
  });

  it('activate 뒤 이전 그래프 정리 실패는 새 그래프를 되돌리지 않는다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    const replacement = await engine.prepareProjectGraph({
      tracks: [
        {
          id: 'replacement-track',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          pluginInstances: [],
          regions: [],
        },
      ],
    });
    replacement.assertActivatable();
    const retiredGraph = replacement.activate();
    toneMocks.channelDispose.mockImplementationOnce(() => {
      throw new Error('dispose failed');
    });
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const firstCleanup = retiredGraph.dispose();
    const retriedCleanup = retiredGraph.dispose();

    expect(firstCleanup.isComplete).toBe(false);
    expect(retriedCleanup).toEqual({ isComplete: true, failedResourceCount: 0 });
    expect(engine.getTrackParams('replacement-track')).not.toBeNull();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('discard 정리가 일부 실패해도 준비 그래프를 다시 활성화하지 못한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    const replacement = await engine.prepareProjectGraph({
      tracks: [
        {
          id: 'replacement-track',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          pluginInstances: [],
          regions: [],
        },
      ],
    });
    toneMocks.channelDispose.mockImplementationOnce(() => {
      throw new Error('candidate dispose failed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const firstCleanup = replacement.discard();
    const retriedCleanup = replacement.discard();

    expect(firstCleanup.isComplete).toBe(false);
    expect(retriedCleanup).toEqual({ isComplete: true, failedResourceCount: 0 });
    expect(() => replacement.assertActivatable()).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.ACTIVE_GRAPH_CHANGED })
    );
    expect(() => replacement.activate()).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.ACTIVE_GRAPH_CHANGED })
    );
    expect(engine.getTrackParams('current-track')).not.toBeNull();
    expect(engine.getTrackParams('replacement-track')).toBeNull();
  });

  it('활성화 중 Transport 초기화가 실패하면 기존 재생 상태와 그래프를 복원한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    engine.setTime(7);
    await engine.play();
    const replacement = await engine.prepareProjectGraph({
      tracks: [
        {
          id: 'replacement-track',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          pluginInstances: [],
          regions: [],
        },
      ],
    });
    toneMocks.transportSecondsFailures.push(new Error('seconds failed'));

    expect(() => replacement.activate()).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.PROJECT_GRAPH_ACTIVATION_FAILED })
    );

    expect(engine.getTrackParams('current-track')).not.toBeNull();
    expect(engine.getTrackParams('replacement-track')).toBeNull();
    expect(engine.getCurrentTime()).toBe(7);
    expect(toneMocks.transportState).toBe('started');
    expect(() => replacement.assertActivatable()).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.ACTIVE_GRAPH_CHANGED })
    );
  });

  it('활성화 실패 후 기존 출력 복원이 한 번 실패해도 즉시 재시도한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    const replacement = await engine.prepareProjectGraph({ tracks: [] });
    toneMocks.gainValueFailures.push(
      undefined,
      new Error('candidate unmute failed'),
      undefined,
      new Error('previous unmute failed')
    );

    expect(() => replacement.activate()).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.PROJECT_GRAPH_ACTIVATION_FAILED })
    );

    expect(toneMocks.outputGains[0]?.gain.value).toBe(1);
    expect(engine.getTrackParams('current-track')).not.toBeNull();
  });

  it('기존 출력 복원이 계속 실패하면 다음 작업을 거부하고 복원을 재시도한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    const replacement = await engine.prepareProjectGraph({ tracks: [] });
    toneMocks.gainValueFailures.push(
      undefined,
      new Error('candidate unmute failed'),
      undefined,
      new Error('previous unmute failed'),
      new Error('immediate retry failed'),
      new Error('next operation retry failed')
    );

    expect(() => replacement.activate()).toThrowError(
      expect.objectContaining({
        code: AudioEngineErrorCode.PROJECT_GRAPH_ACTIVATION_FAILED,
        details: expect.objectContaining({ isRuntimeRecoveryPending: true }),
      })
    );
    expect(() => engine.getTrackParams('current-track')).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.PROJECT_RUNTIME_RECOVERY_PENDING })
    );

    expect(engine.getTrackParams('current-track')).not.toBeNull();
    expect(toneMocks.outputGains[0]?.gain.value).toBe(1);
  });

  it('Transport 복원이 계속 실패하면 다음 작업을 거부하고 재생 상태를 재복원한다', async () => {
    const engine = new AudioEngine();
    engine.setTime(7);
    await engine.play();
    const replacement = await engine.prepareProjectGraph({ tracks: [] });
    toneMocks.transportSecondsFailures.push(
      new Error('activation reset failed'),
      new Error('transport restore failed'),
      new Error('immediate retry failed'),
      new Error('next operation retry failed')
    );

    expect(() => replacement.activate()).toThrowError(
      expect.objectContaining({
        code: AudioEngineErrorCode.PROJECT_GRAPH_ACTIVATION_FAILED,
        details: expect.objectContaining({ isRuntimeRecoveryPending: true }),
      })
    );
    expect(() => engine.getCurrentTime()).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.PROJECT_RUNTIME_RECOVERY_PENDING })
    );

    expect(engine.getCurrentTime()).toBe(7);
    expect(toneMocks.transportState).toBe('started');
  });

  it('비동기 Region 추가 완료 전에 Runtime 복원 대기 상태가 되면 새 Player를 정리한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    let finishLoad: (() => void) | undefined;
    toneMocks.loadPromises.set(
      'late.wav',
      new Promise<void>(resolve => {
        finishLoad = resolve;
      })
    );
    const addRegion = engine.addRegion('current-track', { ...ORIGINAL_REGION, url: 'late.wav' });
    await vi.waitFor(() => expect(toneMocks.playerLoad).toHaveBeenCalledWith('late.wav'));
    const replacement = await engine.prepareProjectGraph({ tracks: [] });
    toneMocks.gainValueFailures.push(
      undefined,
      new Error('candidate unmute failed'),
      undefined,
      new Error('previous unmute failed'),
      new Error('immediate retry failed'),
      new Error('region commit retry failed')
    );
    expect(() => replacement.activate()).toThrowError(
      expect.objectContaining({ code: AudioEngineErrorCode.PROJECT_GRAPH_ACTIVATION_FAILED })
    );

    finishLoad?.();

    await expect(addRegion).rejects.toMatchObject({ code: AudioEngineErrorCode.PROJECT_RUNTIME_RECOVERY_PENDING });
    expect(toneMocks.playerInstances[0]?.disposed).toBe(true);
    expect(engine.getTrackParams('current-track')).not.toBeNull();
  });

  it('이전 그래프 정리가 실패해도 출력 gate가 닫혀 다음 재생에 섞이지 않는다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('current-track', ORIGINAL_REGION);
    const replacement = await engine.prepareProjectGraph({
      tracks: [
        {
          id: 'replacement-track',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          pluginInstances: [],
          regions: [],
        },
      ],
    });
    const retiredGraph = replacement.activate();
    toneMocks.channelDisconnect.mockImplementationOnce(() => {
      throw new Error('disconnect failed');
    });
    toneMocks.channelDispose.mockImplementationOnce(() => {
      throw new Error('dispose failed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    retiredGraph.dispose();

    expect(toneMocks.outputGains[0]?.gain.value).toBe(0);
    expect(engine.getTrackParams('replacement-track')).not.toBeNull();
  });

  it('Channel disconnect가 실패해도 dispose가 성공하면 정리를 완료한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    const replacement = await engine.prepareProjectGraph({ tracks: [] });
    const retiredGraph = replacement.activate();
    toneMocks.channelDisconnect.mockImplementationOnce(() => {
      throw new Error('disconnect failed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const cleanup = retiredGraph.dispose();

    expect(cleanup).toEqual({ isComplete: true, failedResourceCount: 0 });
    expect(toneMocks.channelDispose).toHaveBeenCalledOnce();
  });

  it('Player unsync가 실패해도 dispose가 성공하면 정리를 완료한다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('current-track', ORIGINAL_REGION);
    const replacement = await engine.prepareProjectGraph({ tracks: [] });
    const retiredGraph = replacement.activate();
    toneMocks.playerUnsync.mockImplementationOnce(() => {
      throw new Error('unsync failed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const cleanup = retiredGraph.dispose();

    expect(cleanup).toEqual({ isComplete: true, failedResourceCount: 0 });
    expect(toneMocks.playerDispose).toHaveBeenCalledOnce();
  });

  it('빈 프로젝트 그래프를 활성화하면 기존 Track과 Player를 retired 그래프로 분리한다', async () => {
    const engine = new AudioEngine();
    await engine.addRegion('current-track', ORIGINAL_REGION);
    toneMocks.transportSeconds = 5;
    const replacement = await engine.prepareProjectGraph({ tracks: [] });

    const retiredGraph = replacement.activate();

    expect(engine.getTrackParams('current-track')).toBeNull();
    expect(engine.getCurrentTime()).toBe(0);
    expect(toneMocks.playerDispose).not.toHaveBeenCalled();

    retiredGraph.dispose();
    expect(toneMocks.playerDispose).toHaveBeenCalledTimes(1);
  });

  it('두 번째 Track 준비가 실패하면 앞서 준비한 Track과 Region도 정리한다', async () => {
    const engine = new AudioEngine();
    await engine.addTrack('current-track');
    toneMocks.loadFailures.set('broken.wav', new Error('load failed'));

    await expect(
      engine.prepareProjectGraph({
        tracks: [
          {
            id: 'prepared-track',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [],
            regions: [{ ...ORIGINAL_REGION, id: 'prepared-region', url: 'prepared.wav' }],
          },
          {
            id: 'broken-track',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [],
            regions: [{ ...ORIGINAL_REGION, id: 'broken-region', url: 'broken.wav' }],
          },
        ],
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.REGION_LOAD_FAILED });

    expect(engine.getTrackParams('current-track')).not.toBeNull();
    expect(toneMocks.playerDispose).toHaveBeenCalledTimes(2);
    expect(toneMocks.gainDispose).toHaveBeenCalledTimes(3);
    expect(toneMocks.channelDispose).toHaveBeenCalledTimes(2);
  });

  it('준비 Channel 연결 실패 시 생성한 Channel을 정리한다', async () => {
    const engine = new AudioEngine();
    toneMocks.channelConnectFailures.push(new Error('connect failed'));

    await expect(
      engine.prepareProjectGraph({
        tracks: [
          {
            id: 'replacement-track',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [],
            regions: [],
          },
        ],
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.TRACK_INIT_FAILED });

    expect(toneMocks.gainDispose).toHaveBeenCalledTimes(2);
    expect(toneMocks.channelDispose).toHaveBeenCalledOnce();
  });

  it('준비 input 연결 실패 시 생성한 input과 Channel을 정리한다', async () => {
    const engine = new AudioEngine();
    toneMocks.gainConnectFailures.push(new Error('connect failed'));

    await expect(
      engine.prepareProjectGraph({
        tracks: [
          {
            id: 'replacement-track',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [],
            regions: [],
          },
        ],
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.TRACK_INIT_FAILED });

    expect(toneMocks.gainDispose).toHaveBeenCalledTimes(2);
    expect(toneMocks.channelDispose).toHaveBeenCalledOnce();
  });

  it('준비 Player 연결 실패 시 생성한 Player를 정리한다', async () => {
    const engine = new AudioEngine();
    toneMocks.playerConnectFailures.push(new Error('connect failed'));

    await expect(
      engine.prepareProjectGraph({
        tracks: [
          {
            id: 'replacement-track',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [],
            regions: [{ ...ORIGINAL_REGION, id: 'replacement-region' }],
          },
        ],
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.TRACK_INIT_FAILED });

    expect(toneMocks.playerInstances[0]?.disposed).toBe(true);
  });
});

describe('AudioEngine Export 회귀', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toneMocks.channelOptions.length = 0;
    toneMocks.channels.length = 0;
    toneMocks.distortions.length = 0;
    toneMocks.gains.length = 0;
    toneMocks.outputGains.length = 0;
    toneMocks.playerInstances.length = 0;
    toneMocks.loadFailures.clear();
    toneMocks.loadPromises.clear();
    toneMocks.startFailures.length = 0;
    toneMocks.gainConnectFailures.length = 0;
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
          pluginInstances: [],
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
    const output = toneMocks.outputGains[0];
    const trackInput = toneMocks.gains.find(gain => gain !== output);
    expect(toneMocks.playerInstances[0]?.destination).toBe(trackInput);
    expect(trackInput?.destination).toBe(toneMocks.channels[0]);
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
      pluginInstances: [],
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

  it('활성 Plugin을 오프라인 Track 체인에 연결한다', async () => {
    const engine = createPluginAudioEngine();

    await engine.exportProject({
      tracks: [
        {
          id: 'track-1',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          pluginInstances: [
            {
              instanceId: 'plugin-1',
              manifestId: 'builtin.gain',
              isEnabled: true,
              parameterValues: new Map([['gain', 0.5]]),
            },
          ],
          regions: [{ id: 'region-1', url: 'test.wav', startTime: 0, sourceStartTime: 0, duration: 1 }],
        },
      ],
      masterVolume: 1,
      range: { startTime: 0, endTime: 1 },
      sampleRate: 44100,
    });

    const trackInput = toneMocks.gains[1];
    const pluginGain = toneMocks.gains[2];
    expect(trackInput?.destination).toBe(pluginGain);
    expect(pluginGain?.destination).toBe(toneMocks.channels[0]);
    expect(pluginGain?.gain.value).toBe(0.5);
  });

  it('비활성 Plugin은 오프라인 Track 체인에서 우회한다', async () => {
    const engine = createPluginAudioEngine();

    await engine.exportProject({
      tracks: [
        {
          id: 'track-1',
          volume: 1,
          pan: 0,
          isMuted: false,
          isSoloed: false,
          pluginInstances: [
            {
              instanceId: 'plugin-1',
              manifestId: 'builtin.gain',
              isEnabled: false,
              parameterValues: new Map([['gain', 0.5]]),
            },
          ],
          regions: [{ id: 'region-1', url: 'test.wav', startTime: 0, sourceStartTime: 0, duration: 1 }],
        },
      ],
      masterVolume: 1,
      range: { startTime: 0, endTime: 1 },
      sampleRate: 44100,
    });

    const trackInput = toneMocks.gains[1];
    const disabledPluginGain = toneMocks.gains[2];
    expect(trackInput?.destination).toBe(toneMocks.channels[0]);
    expect(disabledPluginGain?.destination).toBeUndefined();
  });

  it('지원하지 않는 Plugin이 있으면 내보내기를 거부한다', async () => {
    const engine = createPluginAudioEngine();

    await expect(
      engine.exportProject({
        tracks: [
          {
            id: 'track-1',
            volume: 1,
            pan: 0,
            isMuted: false,
            isSoloed: false,
            pluginInstances: [
              {
                instanceId: 'plugin-1',
                manifestId: 'builtin.missing',
                isEnabled: true,
                parameterValues: new Map(),
              },
            ],
            regions: [{ id: 'region-1', url: 'test.wav', startTime: 0, sourceStartTime: 0, duration: 1 }],
          },
        ],
        masterVolume: 1,
        range: { startTime: 0, endTime: 1 },
        sampleRate: 44100,
      })
    ).rejects.toMatchObject({ code: AudioEngineErrorCode.PLUGIN_FACTORY_NOT_FOUND });
  });
});
