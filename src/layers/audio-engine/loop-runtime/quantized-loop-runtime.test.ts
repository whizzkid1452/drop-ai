import { describe, expect, it, vi } from 'vitest';
import type { ILiveAudioInput, ILiveAudioInputConnection } from '../live-input/live-audio-input';
import type {
  CapturedPcm,
  ILivePcmCapture,
  SchedulePcmCaptureRequest,
  ScheduledPcmCapture,
} from '../live-input/live-pcm-capture';
import type { ILoopPlaybackAdapter, ILoopPlayer } from './loop-playback-adapter';
import { QuantizedLoopRuntime } from './quantized-loop-runtime';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>(resolve => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: value => resolvePromise?.(value),
  };
}

class LiveAudioInputStub implements ILiveAudioInput {
  readonly connections: ILiveAudioInputConnection[] = [];
  readonly open = vi.fn(async ({ deviceId }: { readonly deviceId?: string }) => {
    const connection: ILiveAudioInputConnection = {
      close: vi.fn(),
      deviceId: deviceId ?? 'default-input',
      stream: {} as MediaStream,
    };
    this.connections.push(connection);
    return connection;
  });
}

class LivePcmCaptureStub implements ILivePcmCapture {
  readonly requests: SchedulePcmCaptureRequest[] = [];
  readonly sessions: ScheduledPcmCapture[] = [];
  readonly completions: Array<Deferred<CapturedPcm>> = [];

  async schedule(request: SchedulePcmCaptureRequest): Promise<ScheduledPcmCapture> {
    const completion = createDeferred<CapturedPcm>();
    const session = { cancel: vi.fn(), completion: completion.promise };
    this.requests.push(request);
    this.sessions.push(session);
    this.completions.push(completion);
    return session;
  }
}

class LoopPlayerStub implements ILoopPlayer {
  readonly dispose = vi.fn();
  readonly startAt = vi.fn();
  readonly stopAt = vi.fn();
}

class LoopPlaybackAdapterStub implements ILoopPlaybackAdapter {
  contextTimeSeconds = 20;
  transportTimeSeconds = 1;
  readonly players: LoopPlayerStub[] = [];
  readonly setMonitoring = vi.fn();
  readonly prepare = vi.fn(async () => undefined);
  readonly decodeAudioData = vi.fn(async () => ({}) as AudioBuffer);

  createAudioBuffer(): AudioBuffer {
    return {} as AudioBuffer;
  }

  createPlayer(): ILoopPlayer {
    const player = new LoopPlayerStub();
    this.players.push(player);
    return player;
  }

  getAudioContext(): AudioContext {
    return { decodeAudioData: this.decodeAudioData } as unknown as AudioContext;
  }

  getContextTimeSeconds(): number {
    return this.contextTimeSeconds;
  }

  getTransportTimeSeconds(): number {
    return this.transportTimeSeconds;
  }
}

function createRuntime() {
  const liveAudioInput = new LiveAudioInputStub();
  const pcmCapture = new LivePcmCaptureStub();
  const playback = new LoopPlaybackAdapterStub();
  const encodeAudioBuffer = vi.fn(() => new Blob(['loop'], { type: 'audio/wav' }));
  const runtime = new QuantizedLoopRuntime({ encodeAudioBuffer, liveAudioInput, pcmCapture, playback });

  return { encodeAudioBuffer, liveAudioInput, pcmCapture, playback, runtime };
}

const destination = {} as AudioNode;
const address = { slotId: 'slot-1', trackId: 'track-1' };

describe('QuantizedLoopRuntime', () => {
  it('다음 마디 경계부터 지정한 길이만큼 녹음하고 완료 버퍼를 반복 재생한다', async () => {
    const { pcmCapture, playback, runtime } = createRuntime();
    const events = vi.fn();
    runtime.subscribe(events);

    await runtime.arm({
      ...address,
      destination,
      lengthBars: 1,
      quantizationBars: 1,
      tempoBpm: 120,
    });

    expect(pcmCapture.requests[0]).toMatchObject({ durationSeconds: 2, startTimeSeconds: 21 });
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ state: 'armed', type: 'STATE_CHANGED' }));

    pcmCapture.requests[0].onStarted();
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ state: 'recording', type: 'STATE_CHANGED' }));

    pcmCapture.completions[0].resolve({ channels: [new Float32Array([0.1, 0.2])], sampleRate: 48_000 });
    await vi.waitFor(() => expect(playback.players).toHaveLength(1));

    expect(playback.players[0].startAt).toHaveBeenCalledWith(21);
    expect(events).toHaveBeenCalledWith(
      expect.objectContaining({ blob: expect.any(Blob), recordedTempoBpm: 120, type: 'RECORDING_COMPLETED' })
    );
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ state: 'playing', type: 'STATE_CHANGED' }));
  });

  it('대기 중인 슬롯을 지우면 캡처를 취소하고 완료 결과를 무시한다', async () => {
    const { pcmCapture, playback, runtime } = createRuntime();

    await runtime.arm({
      ...address,
      destination,
      lengthBars: 1,
      quantizationBars: 1,
      tempoBpm: 120,
    });
    runtime.clear(address);

    expect(pcmCapture.sessions[0].cancel).toHaveBeenCalledOnce();
    pcmCapture.completions[0].resolve({ channels: [new Float32Array([0.1])], sampleRate: 48_000 });
    await Promise.resolve();
    await Promise.resolve();
    expect(playback.players).toHaveLength(0);
  });

  it('새 입력 장치를 먼저 연 뒤 기존 연결을 닫는다', async () => {
    const { liveAudioInput, runtime } = createRuntime();
    await runtime.setInputDevice('input-a');
    const firstConnection = liveAudioInput.connections[0];

    await runtime.setInputDevice('input-b');

    expect(liveAudioInput.open).toHaveBeenLastCalledWith({ deviceId: 'input-b' });
    expect(firstConnection.close).toHaveBeenCalledOnce();
  });

  it('재생과 정지를 각각 다음 정량화 경계에 예약한다', async () => {
    const { pcmCapture, playback, runtime } = createRuntime();
    await runtime.arm({
      ...address,
      destination,
      lengthBars: 1,
      quantizationBars: 1,
      tempoBpm: 120,
    });
    pcmCapture.completions[0].resolve({ channels: [new Float32Array([0.1])], sampleRate: 48_000 });
    await vi.waitFor(() => expect(playback.players).toHaveLength(1));
    playback.transportTimeSeconds = 2.5;
    playback.contextTimeSeconds = 30;

    await runtime.trigger({ ...address, quantizationBars: 1, tempoBpm: 120 });
    runtime.stop({ ...address, quantizationBars: 1, tempoBpm: 120 });

    expect(playback.players[0].startAt).toHaveBeenLastCalledWith(31.5);
    expect(playback.players[0].stopAt).toHaveBeenCalledWith(31.5);
  });

  it('오버더빙을 별도 Player로 추가하고 기존 Player를 유지한다', async () => {
    const { pcmCapture, playback, runtime } = createRuntime();
    const events = vi.fn();
    runtime.subscribe(events);
    await runtime.arm({ ...address, destination, lengthBars: 1, quantizationBars: 1, tempoBpm: 120 });
    pcmCapture.completions[0].resolve({ channels: [new Float32Array([0.1])], sampleRate: 48_000 });
    await vi.waitFor(() => expect(playback.players).toHaveLength(1));
    const basePlayer = playback.players[0];

    await runtime.overdub({ ...address, destination, lengthBars: 1, quantizationBars: 1, tempoBpm: 120 });
    pcmCapture.completions[1].resolve({ channels: [new Float32Array([0.2])], sampleRate: 48_000 });
    await vi.waitFor(() => expect(playback.players).toHaveLength(2));

    expect(basePlayer.dispose).not.toHaveBeenCalled();
    expect(playback.players[1].startAt).toHaveBeenCalledOnce();
    expect(events).toHaveBeenCalledWith(
      expect.objectContaining({ captureMode: 'overdub', type: 'RECORDING_COMPLETED' })
    );

    playback.transportTimeSeconds = 2.5;
    playback.contextTimeSeconds = 30;
    runtime.stop({ ...address, quantizationBars: 1, tempoBpm: 120 });
    expect(basePlayer.stopAt).toHaveBeenCalledWith(31.5);
    expect(playback.players[1].stopAt).toHaveBeenCalledWith(31.5);
  });

  it('프로젝트 루프를 준비한 뒤 activate 시점에만 기존 루프와 교체한다', async () => {
    const { playback, runtime } = createRuntime();
    await runtime.load({ ...address, destination, url: 'data:audio/wav;base64,AA==' });
    const activePlayer = playback.players[0];

    const replacement = await runtime.prepareReplacement([
      {
        destination,
        slotId: 'slot-2',
        trackId: 'track-2',
        url: 'data:audio/wav;base64,AA==',
      },
    ]);

    expect(activePlayer.dispose).not.toHaveBeenCalled();
    const retired = replacement.activate();
    expect(activePlayer.dispose).not.toHaveBeenCalled();
    await runtime.trigger({ quantizationBars: 1, slotId: 'slot-2', tempoBpm: 120, trackId: 'track-2' });
    expect(playback.players[1].startAt).toHaveBeenCalledOnce();
    expect(() => runtime.stop({ quantizationBars: 1, ...address, tempoBpm: 120 })).toThrow(
      '루프 슬롯에 재생할 오디오가 없습니다.'
    );

    retired.dispose();
    expect(activePlayer.dispose).toHaveBeenCalledOnce();
  });

  it('준비한 루프 교체를 버리면 새 Player만 정리한다', async () => {
    const { playback, runtime } = createRuntime();
    const replacement = await runtime.prepareReplacement([
      { ...address, destination, url: 'data:audio/wav;base64,AA==' },
    ]);

    replacement.discard();

    expect(playback.players[0].dispose).toHaveBeenCalledOnce();
  });
});
