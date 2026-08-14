import type {
  ActivePcmCapture,
  CapturedPcm,
  ILivePcmCapture,
  SchedulePcmCaptureRequest,
  ScheduledPcmCapture,
  StartPcmCaptureRequest,
} from './live-pcm-capture';

const PCM_CAPTURE_PROCESSOR_NAME = 'loop-pcm-capture';
const PCM_CAPTURE_WORKLET_URL = '/loop-pcm-capture-worklet.js';
const moduleLoads = new WeakMap<AudioContext, Promise<void>>();

interface PcmCaptureStartedMessage {
  readonly type: 'started';
}

interface PcmCaptureChunkMessage {
  readonly channels: Float32Array[];
  readonly type: 'chunk';
}

interface PcmCaptureCompleteMessage {
  readonly type: 'complete';
}

type PcmCaptureMessage = PcmCaptureChunkMessage | PcmCaptureCompleteMessage | PcmCaptureStartedMessage;

interface CaptureSession {
  readonly cancel: () => void;
  readonly completion: Promise<CapturedPcm>;
  readonly stop: () => Promise<CapturedPcm>;
}

interface CreateCaptureSessionRequest extends StartPcmCaptureRequest {
  readonly initialMessage: Readonly<Record<string, number | string>>;
}

function loadCaptureModule(audioContext: AudioContext): Promise<void> {
  const currentLoad = moduleLoads.get(audioContext);
  if (currentLoad) {
    return currentLoad;
  }

  const nextLoad = audioContext.audioWorklet.addModule(PCM_CAPTURE_WORKLET_URL);
  moduleLoads.set(audioContext, nextLoad);
  return nextLoad;
}

function concatenateChunks(chunks: readonly Float32Array[]): Float32Array {
  const frameCount = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const channel = new Float32Array(frameCount);
  let writeOffset = 0;
  chunks.forEach(chunk => {
    channel.set(chunk, writeOffset);
    writeOffset += chunk.length;
  });
  return channel;
}

export class AudioWorkletPcmCapture implements ILivePcmCapture {
  async schedule(request: SchedulePcmCaptureRequest): Promise<ScheduledPcmCapture> {
    const capacityFrames = Math.max(1, Math.round(request.durationSeconds * request.audioContext.sampleRate));
    const startFrame = Math.round(request.startTimeSeconds * request.audioContext.sampleRate);
    const session = await this.createCaptureSession({
      ...request,
      initialMessage: { endFrame: startFrame + capacityFrames, startFrame, type: 'schedule' },
    });
    return { cancel: session.cancel, completion: session.completion };
  }

  async start(request: StartPcmCaptureRequest): Promise<ActivePcmCapture> {
    const session = await this.createCaptureSession({
      ...request,
      initialMessage: {
        startFrame: Math.round(request.startTimeSeconds * request.audioContext.sampleRate),
        type: 'start',
      },
    });
    return { cancel: session.cancel, stop: session.stop };
  }

  private async createCaptureSession(request: CreateCaptureSessionRequest): Promise<CaptureSession> {
    await loadCaptureModule(request.audioContext);

    const source = request.audioContext.createMediaStreamSource(request.stream);
    const worklet = new AudioWorkletNode(request.audioContext, PCM_CAPTURE_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    const silentGain = request.audioContext.createGain();
    silentGain.gain.value = 0;
    source.connect(worklet);
    worklet.connect(silentGain);
    silentGain.connect(request.audioContext.destination);

    let channelChunks: Float32Array[][] | null = null;
    let isSettled = false;
    let resolveCompletion: ((capturedPcm: CapturedPcm) => void) | undefined;
    let rejectCompletion: ((error: Error) => void) | undefined;
    const completion = new Promise<CapturedPcm>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    void completion.catch(() => undefined);

    const cleanup = (): void => {
      source.disconnect();
      worklet.disconnect();
      silentGain.disconnect();
      worklet.port.onmessage = null;
    };
    const rejectAndCleanup = (error: Error): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      cleanup();
      rejectCompletion?.(error);
    };
    const resolveAndCleanup = (): void => {
      if (isSettled) {
        return;
      }
      if (channelChunks === null) {
        rejectAndCleanup(new Error('캡처된 PCM 프레임이 없습니다.'));
        return;
      }
      isSettled = true;
      const channels = channelChunks.map(concatenateChunks);
      cleanup();
      resolveCompletion?.({ channels, sampleRate: request.audioContext.sampleRate });
    };

    worklet.port.onmessage = (event: MessageEvent<PcmCaptureMessage>): void => {
      try {
        if (event.data.type === 'started') {
          request.onStarted();
          return;
        }
        if (event.data.type === 'complete') {
          resolveAndCleanup();
          return;
        }

        if (event.data.channels.length === 0) {
          throw new Error('캡처된 PCM 채널이 없습니다.');
        }
        channelChunks ??= event.data.channels.map(() => []);
        if (channelChunks.length !== event.data.channels.length) {
          throw new Error('캡처 중 PCM 채널 수가 변경되었습니다.');
        }
        event.data.channels.forEach((channel, channelIndex) => channelChunks?.[channelIndex]?.push(channel));
      } catch (error: unknown) {
        rejectAndCleanup(error instanceof Error ? error : new Error(String(error)));
      }
    };

    worklet.port.postMessage(request.initialMessage);
    const cancel = (): void => {
      if (isSettled) {
        return;
      }
      worklet.port.postMessage({ type: 'cancel' });
      rejectAndCleanup(new Error('PCM 캡처가 취소되었습니다.'));
    };

    return {
      cancel,
      completion,
      stop: () => {
        if (!isSettled) {
          worklet.port.postMessage({ type: 'stop' });
        }
        return completion;
      },
    };
  }
}
