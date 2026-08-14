import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioWorkletPcmCapture } from './audio-worklet-pcm-capture';

interface WorkletMessage {
  readonly channels?: Float32Array[];
  readonly type: 'chunk' | 'complete' | 'started';
}

class AudioWorkletNodeStub {
  static instance: AudioWorkletNodeStub | null = null;
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
  readonly port = {
    onmessage: null as ((event: MessageEvent<WorkletMessage>) => void) | null,
    postMessage: vi.fn(),
  };

  constructor() {
    AudioWorkletNodeStub.instance = this;
  }

  emit(message: WorkletMessage): void {
    this.port.onmessage?.({ data: message } as MessageEvent<WorkletMessage>);
  }
}

function createWorkletRuntime() {
  return {
    createAudioWorkletNode: vi.fn(() => new AudioWorkletNodeStub() as unknown as AudioWorkletNode),
    loadAudioWorkletModule: vi.fn().mockResolvedValue(undefined),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  AudioWorkletNodeStub.instance = null;
});

describe('AudioWorkletPcmCapture', () => {
  it('start 이후 stop까지 받은 PCM chunk를 하나의 캡처로 반환한다', async () => {
    vi.stubGlobal('AudioWorkletNode', AudioWorkletNodeStub);
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const silentGain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const audioContext = {
      audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
      createGain: () => silentGain,
      createMediaStreamSource: () => source,
      destination: {},
      sampleRate: 4,
    } as unknown as AudioContext;
    const onStarted = vi.fn();
    const workletRuntime = createWorkletRuntime();

    const session = await new AudioWorkletPcmCapture().start({
      audioContext,
      onStarted,
      startTimeSeconds: 2,
      stream: {} as MediaStream,
      workletRuntime,
    });
    const worklet = AudioWorkletNodeStub.instance;

    expect(worklet?.port.postMessage).toHaveBeenCalledWith({ startFrame: 8, type: 'start' });
    worklet?.emit({ type: 'started' });
    worklet?.emit({ channels: [new Float32Array([1, 2])], type: 'chunk' });
    worklet?.emit({ channels: [new Float32Array([3, 4])], type: 'chunk' });

    const completion = session.stop();
    expect(worklet?.port.postMessage).toHaveBeenLastCalledWith({ type: 'stop' });
    worklet?.emit({ type: 'complete' });

    await expect(completion).resolves.toEqual({ channels: [new Float32Array([1, 2, 3, 4])], sampleRate: 4 });
    expect(onStarted).toHaveBeenCalledOnce();
    expect(source.disconnect).toHaveBeenCalledOnce();
  });

  it('활성 캡처를 취소하면 Worklet 연결을 정리하고 stop을 거부한다', async () => {
    vi.stubGlobal('AudioWorkletNode', AudioWorkletNodeStub);
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const silentGain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const audioContext = {
      audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
      createGain: () => silentGain,
      createMediaStreamSource: () => source,
      destination: {},
      sampleRate: 48_000,
    } as unknown as AudioContext;
    const workletRuntime = createWorkletRuntime();
    const session = await new AudioWorkletPcmCapture().start({
      audioContext,
      onStarted: vi.fn(),
      startTimeSeconds: 2,
      stream: {} as MediaStream,
      workletRuntime,
    });

    session.cancel();

    await expect(session.stop()).rejects.toThrow('PCM 캡처가 취소되었습니다.');
    expect(AudioWorkletNodeStub.instance?.port.postMessage).toHaveBeenLastCalledWith({ type: 'cancel' });
    expect(source.disconnect).toHaveBeenCalledOnce();
  });

  it('절대 Context 프레임 구간을 Worklet에 예약하고 PCM을 순서대로 반환한다', async () => {
    vi.stubGlobal('AudioWorkletNode', AudioWorkletNodeStub);
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const silentGain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const audioContext = {
      audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
      createGain: () => silentGain,
      createMediaStreamSource: () => source,
      destination: {},
      sampleRate: 4,
    } as unknown as AudioContext;
    const onStarted = vi.fn();
    const workletRuntime = createWorkletRuntime();

    const session = await new AudioWorkletPcmCapture().schedule({
      audioContext,
      durationSeconds: 1,
      onStarted,
      startTimeSeconds: 2,
      stream: {} as MediaStream,
      workletRuntime,
    });
    const worklet = AudioWorkletNodeStub.instance;

    expect(workletRuntime.loadAudioWorkletModule).toHaveBeenCalledWith('/loop-pcm-capture-worklet.js');
    expect(worklet?.port.postMessage).toHaveBeenCalledWith({ endFrame: 12, startFrame: 8, type: 'schedule' });
    expect(silentGain.gain.value).toBe(0);

    worklet?.emit({ type: 'started' });
    worklet?.emit({ channels: [new Float32Array([1, 2]), new Float32Array([3, 4])], type: 'chunk' });
    worklet?.emit({ channels: [new Float32Array([5, 6]), new Float32Array([7, 8])], type: 'chunk' });
    worklet?.emit({ type: 'complete' });

    await expect(session.completion).resolves.toEqual({
      channels: [new Float32Array([1, 2, 5, 6]), new Float32Array([3, 4, 7, 8])],
      sampleRate: 4,
    });
    expect(onStarted).toHaveBeenCalledOnce();
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(worklet?.disconnect).toHaveBeenCalledOnce();
    expect(silentGain.disconnect).toHaveBeenCalledOnce();
  });

  it('취소하면 Worklet과 연결을 정리하고 완료 Promise를 거부한다', async () => {
    vi.stubGlobal('AudioWorkletNode', AudioWorkletNodeStub);
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const silentGain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const audioContext = {
      audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
      createGain: () => silentGain,
      createMediaStreamSource: () => source,
      destination: {},
      sampleRate: 48_000,
    } as unknown as AudioContext;
    const workletRuntime = createWorkletRuntime();
    const session = await new AudioWorkletPcmCapture().schedule({
      audioContext,
      durationSeconds: 1,
      onStarted: vi.fn(),
      startTimeSeconds: 2,
      stream: {} as MediaStream,
      workletRuntime,
    });

    session.cancel();

    await expect(session.completion).rejects.toThrow('PCM 캡처가 취소되었습니다.');
    expect(AudioWorkletNodeStub.instance?.port.postMessage).toHaveBeenLastCalledWith({ type: 'cancel' });
    expect(source.disconnect).toHaveBeenCalledOnce();
  });

  it('주입된 Worklet runtime에서 module과 node를 생성한다', async () => {
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const silentGain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const audioContext = {
      createGain: () => silentGain,
      createMediaStreamSource: () => source,
      destination: {},
      sampleRate: 48_000,
    } as unknown as AudioContext;
    const workletRuntime = createWorkletRuntime();

    await new AudioWorkletPcmCapture().start({
      audioContext,
      onStarted: vi.fn(),
      startTimeSeconds: 0,
      stream: {} as MediaStream,
      workletRuntime,
    });

    expect(workletRuntime.loadAudioWorkletModule).toHaveBeenCalledWith('/loop-pcm-capture-worklet.js');
    expect(workletRuntime.createAudioWorkletNode).toHaveBeenCalledWith('loop-pcm-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
  });

  it('장시간 캡처가 메모리 예산을 넘으면 연결을 정리하고 명시적으로 거부한다', async () => {
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const silentGain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const audioContext = {
      createGain: () => silentGain,
      createMediaStreamSource: () => source,
      destination: {},
      sampleRate: 48_000,
    } as unknown as AudioContext;
    const session = await new AudioWorkletPcmCapture({ maximumCapturedBytes: 12 }).start({
      audioContext,
      onStarted: vi.fn(),
      startTimeSeconds: 0,
      stream: {} as MediaStream,
      workletRuntime: createWorkletRuntime(),
    });

    AudioWorkletNodeStub.instance?.emit({ channels: [new Float32Array(4)], type: 'chunk' });

    await expect(session.stop()).rejects.toThrow('메모리 안전 한도');
    expect(source.disconnect).toHaveBeenCalledOnce();
  });
});
